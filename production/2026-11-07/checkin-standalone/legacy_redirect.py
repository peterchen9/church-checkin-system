"""Preserve old bookmarks as redirects only, without hosting check-in in the platform."""
import datetime
import pathlib
import shutil

root = pathlib.Path('/home/apps1/nads26')
path = root / 'modules/eureka/urls.py'
body = path.read_text()
if "include('modules.eureka.sunday_urls')" in body:
    raise SystemExit('Hosted Sunday routes are still present; stop for review.')
marker = '# Legacy check-in links: redirect only; application is independent.'
if marker in body:
    print('Legacy redirects already installed.')
    raise SystemExit(0)
if body.count('urlpatterns = [') != 1:
    raise SystemExit('Unexpected URL layout; stop for review.')
original = body
body = 'from django.views.generic.base import RedirectView\n' + body
routes = '''
    # Legacy check-in links: redirect only; application is independent.
    path('sunday/', RedirectView.as_view(url='http://192.168.16.240:8022/sunday.html?entry=independent-20261024', permanent=False)),
    path('sunday/barcodes/', RedirectView.as_view(url='http://192.168.16.240:8022/barcode-print.html?entry=independent-20261024', permanent=False)),
'''
body = body.replace('urlpatterns = [', 'urlpatterns = [' + routes, 1)
compile(body, str(path), 'exec')
backup = root / 'backups' / ('legacy-checkin-redirect-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True)
shutil.copy2(path, backup / 'urls.py')
path.write_text(body)
print('Legacy bookmark redirects installed; check-in application remains independent.')
