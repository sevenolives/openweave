"""Custom throttle classes for auth endpoints."""
from rest_framework.throttling import SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    """Rate limit auth endpoints (login, register, forgot-password, verify) by IP."""
    scope = 'auth'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }
