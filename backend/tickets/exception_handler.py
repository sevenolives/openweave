"""Custom DRF exception handler — always returns JSON, never HTML."""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404
from django.core.exceptions import PermissionDenied


def custom_exception_handler(exc, context):
    """Ensure all API errors return JSON responses."""
    response = exception_handler(exc, context)

    if response is not None:
        # Ensure error body is always a dict
        if isinstance(response.data, list):
            response.data = {'detail': response.data}
        elif isinstance(response.data, str):
            response.data = {'detail': response.data}
        return response

    # Handle uncaught exceptions — return 500 JSON instead of HTML
    if isinstance(exc, Http404):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    if isinstance(exc, PermissionDenied):
        return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    # Generic 500
    import logging
    logger = logging.getLogger(__name__)
    logger.exception(f"Unhandled API error: {exc}")
    return Response(
        {'detail': 'Internal server error.', 'error': str(exc)},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
