"""Plan enforcement utilities for workspace billing limits."""
import os
from rest_framework.exceptions import PermissionDenied
from .models import Subscription, WorkspaceMember, Workspace
import stripe
from django.conf import settings


PLAN_LIMITS = {
    'free': {
        'max_users': int(os.environ.get('FREE_MAX_USERS', '5')),
        'max_workspaces_per_owner': int(os.environ.get('FREE_MAX_WORKSPACES', '1')),
        'max_projects': int(os.environ.get('FREE_MAX_PROJECTS', '5')),
        'max_bot_agents': int(os.environ.get('FREE_MAX_BOT_AGENTS', '2')),
    },
    'pro': {
        'max_users': None,  # unlimited
        'max_workspaces_per_owner': None,
        'max_projects': None,
        'max_bot_agents': None,
    },
    'enterprise': {
        'max_users': None,
        'max_workspaces_per_owner': None,
        'max_projects': None,
        'max_bot_agents': None,
    },
}


def get_subscription(workspace):
    """Get or create subscription for a workspace."""
    try:
        return workspace.subscription
    except Subscription.DoesNotExist:
        return Subscription.objects.create(workspace=workspace)


def get_plan_limits(workspace):
    """Get plan limits for a workspace."""
    sub = get_subscription(workspace)
    return PLAN_LIMITS.get(sub.plan, PLAN_LIMITS['free'])


def check_member_limit(workspace):
    """Check if workspace can add more members."""
    subscription = get_subscription(workspace)
    
    if subscription.plan == 'free':
        # Free tier: hard limit of 3 users
        limits = get_plan_limits(workspace)
        max_users = limits['max_users']  # 3 for free
        member_count = WorkspaceMember.objects.filter(workspace=workspace).count() + 1  # +1 for owner
        if member_count >= max_users:
            raise PermissionDenied(f"Upgrade to Pro to add more than {max_users} users.")
    else:
        # Pro/Enterprise: check against licensed seats
        member_count = WorkspaceMember.objects.filter(workspace=workspace).count() + 1  # +1 for owner
        if member_count >= subscription.licensed_seats:
            raise PermissionDenied(
                f"Cannot add more users. You have {subscription.licensed_seats} licensed seats and {member_count} would exceed the limit. "
                "Purchase more seats to add additional users."
            )


def check_project_limit(workspace):
    """Check if workspace can add more projects."""
    limits = get_plan_limits(workspace)
    max_projects = limits['max_projects']
    if max_projects is None:
        return
    current = workspace.projects.count()
    if current >= max_projects:
        raise PermissionDenied(f"Upgrade to Pro to add more than {max_projects} projects.")


def check_bot_agent_limit(workspace):
    """Check if workspace can add more bot agents."""
    limits = get_plan_limits(workspace)
    max_bots = limits['max_bot_agents']
    if max_bots is None:
        return
    from .models import User
    current = WorkspaceMember.objects.filter(
        workspace=workspace, user__user_type='BOT'
    ).count()
    if current >= max_bots:
        raise PermissionDenied(f"Upgrade to Pro to add more than {max_bots} bot agents.")


def check_workspace_limit(owner):
    """Check if owner can create more workspaces."""
    # Get the owner's first workspace subscription to determine plan
    first_workspace = Workspace.objects.filter(owner=owner).first()
    if first_workspace:
        limits = get_plan_limits(first_workspace)
    else:
        limits = PLAN_LIMITS['free']
    max_ws = limits['max_workspaces_per_owner']
    if max_ws is None:
        return
    current = Workspace.objects.filter(owner=owner).count()
    if current >= max_ws:
        raise PermissionDenied(f"Upgrade to Pro to create more than {max_ws} workspace(s).")


def get_seat_info(workspace):
    """Get seat information for a workspace."""
    subscription = get_subscription(workspace)
    member_count = WorkspaceMember.objects.filter(workspace=workspace).count() + 1  # +1 for owner
    
    return {
        'licensed_seats': subscription.licensed_seats,
        'occupied_seats': member_count,
        'available_seats': max(0, subscription.licensed_seats - member_count),
        'plan': subscription.plan,
    }


def sync_seat_count(workspace, operation='add'):
    """
    Sync seat count with Stripe subscription.
    
    Args:
        workspace: The workspace to sync
        operation: 'add' or 'remove' - on add, auto-upgrade seats if needed.
                   On remove, do NOT auto-downgrade (GitHub style).
    """
    subscription = get_subscription(workspace)
    if not subscription.stripe_subscription_id:
        return  # No Stripe subscription to sync
    
    # Count members (owner + WorkspaceMember count)
    member_count = WorkspaceMember.objects.filter(workspace=workspace).count() + 1  # +1 for owner
    
    try:
        stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
        if not stripe.api_key:
            return
        
        # If adding members and they exceed licensed seats, auto-upgrade
        if operation == 'add' and member_count > subscription.licensed_seats:
            new_seat_count = member_count
            stripe_sub = stripe.Subscription.retrieve(subscription.stripe_subscription_id)
            if stripe_sub.get('items') and stripe_sub['items']['data']:
                item_id = stripe_sub['items']['data'][0]['id']
                stripe.SubscriptionItem.modify(item_id, quantity=new_seat_count)
            subscription.licensed_seats = new_seat_count
            subscription.save(update_fields=['licensed_seats'])
        # On remove, do NOT auto-downgrade seats (GitHub style)
        # Users keep their paid seats until the end of the billing period
    except Exception:
        # Fail silently for now - could log this error in production
        pass
