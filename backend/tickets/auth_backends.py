from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

User = get_user_model()


class EmailOrUsernameBackend(ModelBackend):
    """Allow login with either username or email."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        # Also accept 'email' kwarg from the login serializer
        identifier = username or kwargs.get('email')
        if not identifier:
            return None

        try:
            user = User.objects.get(Q(username=identifier) | Q(email=identifier))
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
