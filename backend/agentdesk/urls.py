"""
URL configuration for agentdesk project.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
import os


def skills_md(request):
    skills_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'skills.md')
    with open(skills_path, 'r') as f:
        content = f.read()
    return HttpResponse(content, content_type='text/markdown; charset=utf-8')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('tickets.urls')),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # Skills document
    path('skills.md', skills_md, name='skills-md'),
]