from urllib.parse import urlsplit
from types import SimpleNamespace

from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.shortcuts import redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods


class OperatorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == '/sunday/records/' and request.headers.get('Sec-Fetch-Dest') == 'document':
            return redirect('http://192.168.16.240:8033/admin.html?tab=sunday-records')
        operator = request.session.get('checkin_operator', '')
        request.user = SimpleNamespace(is_authenticated=bool(operator), is_superuser=False,
                                       get_username=lambda: operator)
        response = self.get_response(request)
        # The existing PHP back office uses port 8033; permit only that origin
        # to embed the read-only records and their independent login screen.
        if request.path in ('/sunday/records/', '/sunday/login/'):
            response.headers.pop('X-Frame-Options', None)
            response['Content-Security-Policy'] = "frame-ancestors 'self' http://192.168.16.240:8033"
        return response


@never_cache
@require_http_methods(['GET', 'POST'])
def login(request):
    target = request.POST.get('next', request.GET.get('next', '/sunday.html'))
    if not url_has_allowed_host_and_scheme(target, allowed_hosts={request.get_host()}):
        target = '/sunday.html'
    error = ''
    if request.method == 'POST':
        if check_password(request.POST.get('password', ''), settings.CHECKIN_PASSWORD_HASH):
            request.session.cycle_key()
            request.session['checkin_operator'] = 'checkin-operator'
            return redirect(target)
        error = '密碼錯誤，請重新輸入。'
    return render(request, 'checkin_login.html', {'next': target, 'error': error, 'is_backend': urlsplit(target).path == '/sunday/records/'})
