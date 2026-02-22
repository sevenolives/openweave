"""
Custom exception handlers for consistent API error responses.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404
from django.core.exceptions import PermissionDenied, ValidationError
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error response format.
    """
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    # Log the error for debugging
    view = context.get('view')
    request = context.get('request')
    if view and request:
        logger.error(f"API Error in {view.__class__.__name__}: {str(exc)}", 
                    extra={'request': request, 'view': view.__class__.__name__})

    if response is not None:
        # Customize the response data structure
        custom_response_data = {
            'error': True,
            'message': 'An error occurred',
            'details': {},
            'status_code': response.status_code
        }

        # Handle different types of errors
        if response.status_code == status.HTTP_400_BAD_REQUEST:
            custom_response_data['message'] = 'Bad request'
            custom_response_data['details'] = response.data
        
        elif response.status_code == status.HTTP_401_UNAUTHORIZED:
            custom_response_data['message'] = 'Authentication required'
            custom_response_data['details'] = response.data
            
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            custom_response_data['message'] = 'Permission denied'
            custom_response_data['details'] = response.data
            
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            custom_response_data['message'] = 'Resource not found'
            custom_response_data['details'] = response.data
            
        elif response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
            custom_response_data['message'] = 'Method not allowed'
            custom_response_data['details'] = response.data
            
        elif response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            custom_response_data['message'] = 'Rate limit exceeded'
            custom_response_data['details'] = {
                'throttle': 'Too many requests. Please try again later.'
            }
            
        elif response.status_code >= 500:
            custom_response_data['message'] = 'Internal server error'
            custom_response_data['details'] = {
                'error': 'An unexpected error occurred. Please try again later.'
            }
        
        else:
            custom_response_data['message'] = 'Request failed'
            custom_response_data['details'] = response.data

        response.data = custom_response_data

    else:
        # Handle exceptions not caught by DRF's exception handler
        if isinstance(exc, Http404):
            custom_response_data = {
                'error': True,
                'message': 'Resource not found',
                'details': {'detail': str(exc)},
                'status_code': 404
            }
            response = Response(custom_response_data, status=status.HTTP_404_NOT_FOUND)
            
        elif isinstance(exc, PermissionDenied):
            custom_response_data = {
                'error': True,
                'message': 'Permission denied',
                'details': {'detail': str(exc)},
                'status_code': 403
            }
            response = Response(custom_response_data, status=status.HTTP_403_FORBIDDEN)
            
        elif isinstance(exc, ValidationError):
            custom_response_data = {
                'error': True,
                'message': 'Validation error',
                'details': {'detail': str(exc)},
                'status_code': 400
            }
            response = Response(custom_response_data, status=status.HTTP_400_BAD_REQUEST)

    return response