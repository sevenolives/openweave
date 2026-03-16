"""Plan enforcement utilities for workspace billing limits."""
from rest_framework.exceptions import PermissionDenied
from .models import Subscription, WorkspaceMember, Workspace
import stripe
from django.conf import settings


PLAN_LIMITS = {
    'free': {
        'max_users': 3,
        'max_workspaces_per_owner': 1,
        'max_projects': 2,
        'max_bot_agents': 2,
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
    limits = get_plan_limits(workspace)
    max_users = limits['max_users']
    if max_users is None:
        return
    # Count owner + members
    member_count = WorkspaceMember.objects.filter(workspace=workspace).count() + 1  # +1 for owner
    if member_count >= max_users:
        raise PermissionDenied(f"Upgrade to Pro to add more than {max_users} users.")


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


def sync_seat_count(workspace):
    """Sync seat count with Stripe subscription."""
    subscription = get_subscription(workspace)
    if not subscription.stripe_subscription_id:
        return  # No Stripe subscription to sync
    
    # Count members (owner + WorkspaceMember count)
    member_count = WorkspaceMember.objects.filter(workspace=workspace).count() + 1  # +1 for owner
    
    try:
        stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
        if stripe.api_key:
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                quantity=member_count
            )
    except Exception:
        # Fail silently for now - could log this error in production
        pass
