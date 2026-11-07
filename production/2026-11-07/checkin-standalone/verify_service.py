"""Verify independent login and read-only functionality; never submit a check-in."""
import hashlib
import http.cookiejar
import json
import pathlib
import re
import subprocess
import sys
import urllib.parse
import urllib.request

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:28022'
password_source = pathlib.Path('/home/peterchen/church_checkin/api/login.php').read_text()
match = re.search(r"(?m)^\$ADMIN_PASSWORD\s*=\s*'([^'\r\n]*)';", password_source)
if not match:
    raise SystemExit('Cannot determine the existing check-in password for verification.')
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
login = client.open(base + '/sunday/login/').read().decode()
token = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', login).group(1)
payload = urllib.parse.urlencode({'password': match.group(1), 'csrfmiddlewaretoken': token, 'next': '/sunday.html'}).encode()
page = client.open(base + '/sunday/login/', payload).read().decode()
if 'id="scanner-input"' not in page or '26001' in page:
    raise SystemExit('Independent login did not reach the standalone original screen.')
print('INDEPENDENT_LOGIN_AND_ORIGINAL_SCREEN_OK')
prefix = 'NG000015'
qr = prefix + str(int(hashlib.md5(prefix.encode()).hexdigest()[:7], 16) % 1000).zfill(3)
result = json.load(client.open(base + '/sunday/members/?q=' + qr))
if not result.get('success') or not result.get('members'):
    raise SystemExit('Independent directory search failed.')
if any(person['church_id'] != '15' for person in result['members']):
    raise SystemExit('QR code lookup returned an unexpected contact.')
labels = client.open(base + '/sunday/barcodes/15/print/').read().decode()
assert labels.count('<section class="label">') == 3
print('INDEPENDENT_SHARED_DIRECTORY_AND_THREE_QR_LABELS_OK')
info = subprocess.check_output(['docker', 'inspect', 'church-checkin-standalone', '--format', '{{.State.Running}}']).decode().strip()
assert info == 'true'
print('INDEPENDENT_CONTAINER_RUNNING; NO_ATTENDANCE_WRITES')
