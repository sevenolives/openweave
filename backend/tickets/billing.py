import stripe
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from .models import Workspace, WorkspaceMember, Subscription
from .plan_limits import get_seat_info
from datetime import datetime


def _get_stripe():
    """Configure and return stripe module using django settings."""
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


class CreateCheckoutSessionView(APIView):
    """POST /api/billing/checkout/ — create Stripe Checkout session."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace_slug = request.data.get('workspace')
        plan = request.data.get('plan', 'pro_monthly')

        if not workspace_slug:
            return Response({'detail': 'workspace is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            workspace = Workspace.objects.get(slug=workspace_slug)
        except Workspace.DoesNotExist:
            return Response({'detail': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Verify membership
        is_member = (
            request.user.is_superuser or
            workspace.owner_id == request.user.id or
            WorkspaceMember.objects.filter(workspace=workspace, user=request.user).exists()
        )
        if not is_member:
            return Response({'detail': 'Not a member of this workspace.'}, status=status.HTTP_403_FORBIDDEN)

        # Map plan to price ID
        price_map = {
            'pro_monthly': settings.STRIPE_PRO_MONTHLY_PRICE_ID,
            'pro_annual': settings.STRIPE_PRO_ANNUAL_PRICE_ID,
        }
        price_id = request.data.get('price_id') or price_map.get(plan)
        if not price_id:
            return Response({'detail': 'Invalid plan or price_id.'}, status=status.HTTP_400_BAD_REQUEST)

        s = _get_stripe()
        sub, _ = Subscription.objects.get_or_create(workspace=workspace)

        # Create or retrieve Stripe customer
        if sub.stripe_customer_id:
            # Validate customer exists in current Stripe mode (test vs live)
            try:
                s.Customer.retrieve(sub.stripe_customer_id)
                customer_id = sub.stripe_customer_id
            except Exception:
                # Customer from wrong mode (test/live mismatch) — create new
                sub.stripe_customer_id = ''
                sub.save(update_fields=['stripe_customer_id'])
        if not sub.stripe_customer_id:
            customer = s.Customer.create(
                email=request.user.email,
                name=workspace.name,
                metadata={'workspace_id': str(workspace.id)},
            )
            customer_id = customer.id
            sub.stripe_customer_id = customer_id
            sub.save(update_fields=['stripe_customer_id'])

        # Build success/cancel URLs
        frontend_url = request.data.get('frontend_url', 'https://openweave.dev')
        success_url = f"{frontend_url}/private/{workspace.slug}/billing?success=true"
        cancel_url = f"{frontend_url}/private/{workspace.slug}/billing?cancelled=true"

        # Calculate pricing: $29/mo base (10 agents included) + $4/mo per extra agent
        member_count = WorkspaceMember.objects.filter(workspace=workspace).count() + 1  # +1 for owner
        extra_agents = max(0, member_count - 10)

        # Build line items: base price (qty=1) + extra agents if any
        line_items = [{'price': price_id, 'quantity': 1}]
        if extra_agents > 0:
            additional_price_id = getattr(settings, 'STRIPE_PRO_ADDITIONAL_AGENT_PRICE_ID', 'price_1TIKNvCem0qlWtF4NFcVdDIi')
            line_items.append({'price': additional_price_id, 'quantity': extra_agents})

        try:
            checkout_params = dict(
                customer=customer_id,
                payment_method_types=['card'],
                line_items=line_items,
                mode='subscription',
                success_url=success_url,
                cancel_url=cancel_url,
                allow_promotion_codes=True,
                metadata={'workspace_id': str(workspace.id), 'extra_agents': str(extra_agents)},
            )
            # Apply coupon if provided
            coupon = request.data.get('coupon')
            if coupon:
                checkout_params['discounts'] = [{'coupon': coupon}]
                # Can't use both allow_promotion_codes and discounts
                del checkout_params['allow_promotion_codes']

            session = s.checkout.Session.create(**checkout_params)
            return Response({'checkout_url': session.url})
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    """POST /api/billing/webhook/ — handle Stripe webhook events."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        s = _get_stripe()
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        try:
            event = s.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            return Response({'detail': 'Invalid payload.'}, status=status.HTTP_400_BAD_REQUEST)
        except (s.error.SignatureVerificationError, s.SignatureVerificationError, Exception) as e:
            if 'signature' in str(e).lower() or 'webhook' in str(e).lower():
                return Response({'detail': 'Invalid signature.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({'detail': 'Webhook error.'}, status=status.HTTP_400_BAD_REQUEST)

        event_type = event['type']
        data_object = event['data']['object']

        if event_type == 'checkout.session.completed':
            self._handle_checkout_completed(data_object)
        elif event_type == 'customer.subscription.updated':
            self._handle_subscription_updated(data_object)
        elif event_type == 'customer.subscription.deleted':
            self._handle_subscription_deleted(data_object)
        elif event_type == 'invoice.payment_failed':
            self._handle_payment_failed(data_object)

        return Response({'status': 'ok'})

    def _handle_checkout_completed(self, session):
        workspace_id = session.get('metadata', {}).get('workspace_id')
        if not workspace_id:
            return
        try:
            sub, created = Subscription.objects.get_or_create(
                workspace_id=int(workspace_id)
            )
            sub.plan = 'pro'
            sub.status = 'active'
            sub.stripe_customer_id = session.get('customer')
            sub.stripe_subscription_id = session.get('subscription')
            
            # Set initial licensed seats based on subscription quantity
            if sub.stripe_subscription_id:
                s = _get_stripe()
                stripe_sub = s.Subscription.retrieve(sub.stripe_subscription_id)
                if stripe_sub and stripe_sub.get('items', {}).get('data'):
                    quantity = stripe_sub['items']['data'][0]['quantity']
                    sub.licensed_seats = quantity
            
            sub.save()
        except (Workspace.DoesNotExist, ValueError):
            pass

    def _handle_subscription_updated(self, subscription):
        try:
            sub = Subscription.objects.get(stripe_subscription_id=subscription['id'])
        except Subscription.DoesNotExist:
            return
        stripe_status = subscription.get('status', '')
        status_map = {
            'active': 'active',
            'past_due': 'past_due',
            'canceled': 'cancelled',
            'trialing': 'trialing',
        }
        sub.status = status_map.get(stripe_status, sub.status)
        period_end = subscription.get('current_period_end')
        if period_end:
            sub.current_period_end = timezone.make_aware(
                datetime.utcfromtimestamp(period_end)
            ) if period_end else None
        sub.save()

    def _handle_subscription_deleted(self, subscription):
        try:
            sub = Subscription.objects.get(stripe_subscription_id=subscription['id'])
        except Subscription.DoesNotExist:
            return
        sub.plan = 'free'
        sub.status = 'cancelled'
        sub.stripe_subscription_id = None
        sub.save()

    def _handle_payment_failed(self, invoice):
        subscription_id = invoice.get('subscription')
        if not subscription_id:
            return
        try:
            sub = Subscription.objects.get(stripe_subscription_id=subscription_id)
        except Subscription.DoesNotExist:
            return
        sub.status = 'past_due'
        sub.save(update_fields=['status', 'updated_at'])


class CustomerPortalView(APIView):
    """POST /api/billing/portal/ — create Stripe Customer Portal session."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace_slug = request.data.get('workspace')
        if not workspace_slug:
            return Response({'detail': 'workspace is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sub = Subscription.objects.get(workspace__slug=workspace_slug)
        except Subscription.DoesNotExist:
            return Response({'detail': 'No subscription found.'}, status=status.HTTP_404_NOT_FOUND)

        if not sub.stripe_customer_id:
            return Response({'detail': 'No Stripe customer linked.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify membership
        workspace = sub.workspace
        is_member = (
            request.user.is_superuser or
            workspace.owner_id == request.user.id or
            WorkspaceMember.objects.filter(workspace=workspace, user=request.user).exists()
        )
        if not is_member:
            return Response({'detail': 'Not a member of this workspace.'}, status=status.HTTP_403_FORBIDDEN)

        s = _get_stripe()
        frontend_url = request.data.get('frontend_url', 'https://openweave.dev')
        return_url = f"{frontend_url}/private/{workspace.slug}/billing"

        session = s.billing_portal.Session.create(
            customer=sub.stripe_customer_id,
            return_url=return_url,
        )

        return Response({'portal_url': session.url})


class SyncSubscriptionView(APIView):
    """POST /api/billing/sync/ — manually sync subscription from Stripe."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace_slug = request.data.get('workspace')
        if not workspace_slug:
            return Response({'detail': 'workspace required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            workspace = Workspace.objects.get(slug=workspace_slug)
        except Workspace.DoesNotExist:
            return Response({'detail': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)
        from .permissions import is_admin_or_owner
        if not request.user.is_superuser and not is_admin_or_owner(request.user, workspace):
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)

        sub, _ = Subscription.objects.get_or_create(workspace=workspace)
        if not sub.stripe_customer_id:
            return Response({'detail': 'No Stripe customer linked.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            s = _get_stripe()
            subs = list(s.Subscription.list(customer=sub.stripe_customer_id, status='active', limit=1))
            if not subs:
                return Response({'detail': 'No active Stripe subscription found.'}, status=status.HTTP_404_NOT_FOUND)

            stripe_sub = subs[0]
            sub.stripe_subscription_id = stripe_sub.id
            sub.plan = 'pro'
            sub.status = 'active'
            if stripe_sub.get("items", {}).get("data"):
                sub.licensed_seats = stripe_sub['items']['data'][0]['quantity']
            sub.save()

            from .plan_limits import get_seat_info
            return Response({
                'synced': True,
                'plan': sub.plan,
                'stripe_subscription_id': sub.stripe_subscription_id,
                **get_seat_info(workspace),
            })
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SubscriptionStatusView(APIView):
    """GET /api/billing/status/?workspace=<slug> — get subscription status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace_slug = request.query_params.get('workspace')
        if not workspace_slug:
            return Response({'detail': 'workspace query param is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            workspace = Workspace.objects.get(slug=workspace_slug)
        except Workspace.DoesNotExist:
            return Response({'detail': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Verify membership
        is_member = (
            request.user.is_superuser or
            workspace.owner_id == request.user.id or
            WorkspaceMember.objects.filter(workspace=workspace, user=request.user).exists()
        )
        if not is_member:
            return Response({'detail': 'Not a member of this workspace.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            sub = workspace.subscription
        except Subscription.DoesNotExist:
            sub = Subscription.objects.create(workspace=workspace)

        # Get seat information
        seat_info = get_seat_info(workspace)

        return Response({
            'plan': sub.plan,
            'status': sub.status,
            'current_period_end': sub.current_period_end,
            'stripe_customer_id': sub.stripe_customer_id,
            'stripe_subscription_id': sub.stripe_subscription_id,
            'licensed_seats': seat_info['licensed_seats'],
            'occupied_seats': seat_info['occupied_seats'],
            'available_seats': seat_info['available_seats'],
        })


class ManageSeatsView(APIView):
    """PATCH /api/billing/seats/ — manually adjust seat count."""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        workspace_slug = request.data.get('workspace')
        new_seat_count = request.data.get('licensed_seats')

        if not workspace_slug:
            return Response({'detail': 'workspace is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not new_seat_count or not isinstance(new_seat_count, int) or new_seat_count < 1:
            return Response({'detail': 'licensed_seats must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            workspace = Workspace.objects.get(slug=workspace_slug)
        except Workspace.DoesNotExist:
            return Response({'detail': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Verify membership and admin access
        is_owner = workspace.owner_id == request.user.id
        if not is_owner:
            return Response({'detail': 'Only workspace owners can manage seats.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            sub = workspace.subscription
        except Subscription.DoesNotExist:
            return Response({'detail': 'No subscription found.'}, status=status.HTTP_404_NOT_FOUND)

        if sub.plan == 'free':
            return Response({'detail': 'Seat management is only available for Pro and Enterprise plans.'}, status=status.HTTP_400_BAD_REQUEST)

        if not sub.stripe_subscription_id:
            return Response({'detail': 'No Stripe subscription found.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if decreasing seats would violate current usage
        member_count = WorkspaceMember.objects.filter(workspace=workspace).count() + 1  # +1 for owner
        if new_seat_count < member_count:
            return Response({
                'detail': f'Cannot reduce to {new_seat_count} seats. You currently have {member_count} members. '
                         'Remove members first before reducing seat count.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update Stripe subscription
        try:
            s = _get_stripe()
            stripe_sub = s.Subscription.retrieve(sub.stripe_subscription_id)
            if stripe_sub.get('items') and stripe_sub['items']['data']:
                item_id = stripe_sub['items']['data'][0]['id']
                s.SubscriptionItem.modify(item_id, quantity=new_seat_count)
            else:
                raise Exception('No subscription items found')
            
            # Update local record
            sub.licensed_seats = new_seat_count
            sub.save(update_fields=['licensed_seats'])

            # Return updated seat info
            seat_info = get_seat_info(workspace)
            return Response({
                'message': f'Seat count updated to {new_seat_count}.',
                'licensed_seats': seat_info['licensed_seats'],
                'occupied_seats': seat_info['occupied_seats'],
                'available_seats': seat_info['available_seats'],
            })

        except Exception as e:
            return Response({
                'detail': f'Failed to update Stripe subscription: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

