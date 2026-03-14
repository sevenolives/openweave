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
from datetime import datetime


def _get_stripe():
    """Configure and return stripe module using django settings."""
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


class CreateCheckoutSessionView(APIView):
    """POST /api/billing/checkout/ — create Stripe Checkout session."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace_id = request.data.get('workspace_id')
        plan = request.data.get('plan', 'pro_monthly')

        if not workspace_id:
            return Response({'detail': 'workspace_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'detail': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Verify membership
        is_member = (
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
            customer_id = sub.stripe_customer_id
        else:
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

        session = s.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{'price': price_id, 'quantity': 1}],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={'workspace_id': str(workspace.id)},
        )

        return Response({'checkout_url': session.url})


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
        except s.error.SignatureVerificationError:
            return Response({'detail': 'Invalid signature.'}, status=status.HTTP_400_BAD_REQUEST)

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
            sub, _ = Subscription.objects.get_or_create(
                workspace_id=int(workspace_id)
            )
            sub.plan = 'pro'
            sub.status = 'active'
            sub.stripe_customer_id = session.get('customer')
            sub.stripe_subscription_id = session.get('subscription')
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
        workspace_id = request.data.get('workspace_id')
        if not workspace_id:
            return Response({'detail': 'workspace_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sub = Subscription.objects.get(workspace_id=workspace_id)
        except Subscription.DoesNotExist:
            return Response({'detail': 'No subscription found.'}, status=status.HTTP_404_NOT_FOUND)

        if not sub.stripe_customer_id:
            return Response({'detail': 'No Stripe customer linked.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify membership
        workspace = sub.workspace
        is_member = (
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


class SubscriptionStatusView(APIView):
    """GET /api/billing/status/?workspace=<id> — get subscription status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace_id = request.query_params.get('workspace')
        if not workspace_id:
            return Response({'detail': 'workspace query param is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            workspace = Workspace.objects.get(id=workspace_id)
        except Workspace.DoesNotExist:
            return Response({'detail': 'Workspace not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Verify membership
        is_member = (
            workspace.owner_id == request.user.id or
            WorkspaceMember.objects.filter(workspace=workspace, user=request.user).exists()
        )
        if not is_member:
            return Response({'detail': 'Not a member of this workspace.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            sub = workspace.subscription
        except Subscription.DoesNotExist:
            sub = Subscription.objects.create(workspace=workspace)

        return Response({
            'plan': sub.plan,
            'status': sub.status,
            'current_period_end': sub.current_period_end,
            'stripe_customer_id': sub.stripe_customer_id,
            'stripe_subscription_id': sub.stripe_subscription_id,
        })
