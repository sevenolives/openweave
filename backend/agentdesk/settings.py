import os
from pathlib import Path
from datetime import timedelta
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# Railway build info
GIT_BRANCH = os.environ.get('RAILWAY_GIT_BRANCH', os.environ.get('GIT_BRANCH', 'local'))
GIT_COMMIT = os.environ.get('RAILWAY_GIT_COMMIT_SHA', os.environ.get('GIT_COMMIT', 'dev'))[:7]
RAILWAY_ENVIRONMENT = os.environ.get('RAILWAY_ENVIRONMENT_NAME', 'local')

SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-insecure-key-change-in-production')
if not os.environ.get('SECRET_KEY') and not os.environ.get('DEBUG'):
    import warnings
    warnings.warn("SECRET_KEY is using insecure default! Set SECRET_KEY env var in production.")
DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1', 'yes')
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'drf_spectacular',
    'django_filters',
    'rest_framework.authtoken',
    'tickets',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'agentdesk.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'agentdesk.wsgi.application'

DATABASES = {
    'default': dj_database_url.config(
        default='sqlite:///db.sqlite3',
        conn_max_age=600,
    )
}

AUTH_USER_MODEL = 'tickets.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTHENTICATION_BACKENDS = [
    'tickets.auth_backends.EmailOrUsernameBackend',
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
# Use persistent volume on Railway (/data/media), fall back to local for dev
import os as _os
MEDIA_ROOT = '/data/media' if _os.path.isdir('/data') else BASE_DIR / 'media'

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS — calculated from branch name
_cors_origins = ['http://localhost:3000', 'http://localhost:8000']
_csrf_origins = ['http://localhost:3000', 'http://localhost:8000']

if GIT_BRANCH == 'main':
    # Production
    _cors_origins += [
        'https://openweave.dev',
        'https://www.openweave.dev',
    ]
    _csrf_origins += [
        'https://openweave.dev',
        'https://*.openweave.dev',
    ]
else:
    # Preview/PR branches — allow Railway preview URLs
    _cors_origins += []  # Will use CORS_ALLOW_ALL_ORIGINS for preview
    _csrf_origins += [
        'https://*.up.railway.app',
        'https://*.railway.app',
    ]

# Always allow Railway URLs for CSRF (deploys hit the Railway URL first)
_csrf_origins += [
    'https://*.up.railway.app',
    'https://*.railway.app',
]

CORS_ALLOWED_ORIGINS = _cors_origins
CORS_ALLOW_ALL_ORIGINS = GIT_BRANCH != 'main'  # Strict on production, open on preview
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = list(set(_csrf_origins))

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'tickets.pagination.FlexiblePageNumberPagination',
    'PAGE_SIZE': 10,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Agent Desk API',
    'DESCRIPTION': 'Agentic Support & Ticketing System API. All authentication is via JWT (humans) or Token (bots). Use POST /api/auth/join/ to register and join workspaces.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'TAGS': [
        {'name': 'auth', 'description': 'Authentication & Registration'},
        {'name': 'users', 'description': 'User management'},
        {'name': 'workspaces', 'description': 'Workspace management'},
        {'name': 'members', 'description': 'Workspace membership'},
        {'name': 'invites', 'description': 'Workspace invite links'},
        {'name': 'projects', 'description': 'Project management'},
        {'name': 'tickets', 'description': 'Ticket management'},
        {'name': 'comments', 'description': 'Ticket comments'},
        {'name': 'audit', 'description': 'Audit trail (read-only)'},
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=24),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
}

# Email configuration
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@openweave.dev')

# Use console backend in development if no SMTP configured, otherwise SMTP
if not EMAIL_HOST_USER:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# Stripe billing
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
STRIPE_PRO_MONTHLY_PRICE_ID = os.environ.get('STRIPE_PRO_MONTHLY_PRICE_ID', '')
STRIPE_PRO_ANNUAL_PRICE_ID = os.environ.get('STRIPE_PRO_ANNUAL_PRICE_ID', '')
