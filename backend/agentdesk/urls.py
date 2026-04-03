"""
URL configuration for agentdesk project.
"""
from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse, JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

# Cache for generated skills.md
_skills_cache = {'content': None}


def skills_md_view(request):
    """Serve skills.md generated from the OpenAPI schema. ?refresh=true to rebuild."""
    refresh = request.GET.get('refresh') == 'true'

    if refresh or _skills_cache['content'] is None:
        from tickets.skills_generator import generate_skills_md
        _skills_cache['content'] = generate_skills_md()

    return HttpResponse(_skills_cache['content'], content_type='text/markdown; charset=utf-8')


def heartbeat_md_view(request):
    """Serve heartbeat.md static file."""
    import os
    heartbeat_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tickets', 'heartbeat.md')
    with open(heartbeat_path, 'r') as f:
        content = f.read()
    return HttpResponse(content, content_type='text/markdown; charset=utf-8')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('tickets.urls')),
]

# Serve media files in all environments (Railway doesn't have nginx)
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve as static_serve

# static() only works in DEBUG mode, so we add an explicit media route for production
urlpatterns += [
    path('media/<path:path>', static_serve, {'document_root': settings.MEDIA_ROOT}),
]
# Also keep static() for dev convenience
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Skills document (generated from schema)
    path('api/build-info/', lambda r: JsonResponse({
        'branch': settings.GIT_BRANCH,
        'commit': settings.GIT_COMMIT,
        'environment': settings.RAILWAY_ENVIRONMENT,
    }), name='build-info'),
    path('api/skills/skills.md', skills_md_view, name='skills-md'),
    path('api/skills/heartbeat.md', heartbeat_md_view, name='heartbeat-md'),
]