import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
config = json.loads(Path(os.environ.get('CHECKIN_CONFIG', '/config/settings.json')).read_text())
SECRET_KEY = config['secret_key']
CHECKIN_PASSWORD_HASH = config['password_hash']
DEBUG = False
ALLOWED_HOSTS = config.get('allowed_hosts', ['192.168.16.240', '127.0.0.1', 'localhost'])
DATABASES = {'default': config['database']}
INSTALLED_APPS = ['django.contrib.auth', 'django.contrib.contenttypes', 'modules.eureka']
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'standalone.auth.OperatorMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'standalone.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates',
              'DIRS': [BASE_DIR / 'templates'], 'APP_DIRS': True,
              'OPTIONS': {'context_processors': ['django.template.context_processors.request',
                                                  'django.template.context_processors.csrf']}}]
WSGI_APPLICATION = 'standalone.wsgi.application'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
TIME_ZONE = 'Asia/Taipei'
USE_TZ = True
LANGUAGE_CODE = 'zh-hant'
LOGIN_URL = '/sunday/login/'
SESSION_ENGINE = 'django.contrib.sessions.backends.signed_cookies'
SESSION_COOKIE_NAME = 'checkin_session'
SESSION_COOKIE_AGE = 8 * 60 * 60
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_NAME = 'checkin_csrftoken'
CSRF_TRUSTED_ORIGINS = ['http://192.168.16.240:8022']
X_FRAME_OPTIONS = 'SAMEORIGIN'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

PUBLIC_NAMES_TOKEN = config.get('public_names_token', '')
