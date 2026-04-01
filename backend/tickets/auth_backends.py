"""Custom authentication backends for OpenWeave."""
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

User = get_user_model()


class EmailOrUsernameBackend(ModelBackend):
    """
    Authenticate with either email or username.
    Django's built-in ModelBackend only supports username.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            return None
        # Try email first
        try:
            user = User.objects.get(email__iexact=username)
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            # Fall back to username
            try:
                user = User.objects.get(username__iexact=username)
            except User.DoesNotExist:
                return None
        
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
