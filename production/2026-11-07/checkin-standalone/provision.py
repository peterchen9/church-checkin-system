"""Provision the independent service without copying secrets into source control."""
import base64
import hashlib
import json
import os
import pathlib
import re
import secrets
import subprocess
import time
import urllib.request

root = pathlib.Path('/home/peter/church-checkin-standalone')
config_dir = root / 'config'
config_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
os.chmod(config_dir, 0o700)
config_file = config_dir / 'settings.json'
if not config_file.exists():
    script = (
        'import os,json; os.environ.setdefault("DJANGO_SETTINGS_MODULE","nads26.settings"); '
        'import django; django.setup(); from django.conf import settings; '
        'd=settings.DATABASES["default"]; '
        'print(json.dumps({k:d[k] for k in ("ENGINE","NAME","USER","PASSWORD","HOST","PORT","OPTIONS") if k in d}))'
    )
    database = json.loads(subprocess.check_output(['docker', 'exec', 'nads26-web', 'python', '-c', script]))
    login_php = pathlib.Path('/home/peterchen/church_checkin/api/login.php').read_text()
    match = re.search(r"(?m)^\$ADMIN_PASSWORD\s*=\s*'([^'\r\n]*)';", login_php)
    if not match:
        raise RuntimeError('Cannot read the existing independent check-in password; stopped.')
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', match.group(1).encode(), salt.encode(), 1000000)
    password_hash = 'pbkdf2_sha256$1000000$' + salt + '$' + base64.b64encode(digest).decode()
    configuration = {'secret_key': secrets.token_urlsafe(64), 'password_hash': password_hash,
                     'database': database, 'allowed_hosts': ['192.168.16.240', '127.0.0.1', 'localhost']}
    descriptor = os.open(config_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        json.dump(configuration, stream)
os.chmod(config_file, 0o600)
subprocess.run(['docker', 'build', '-t', 'church-checkin-standalone:local', str(root)], check=True)
name = 'church-checkin-standalone'
existing = subprocess.run(['docker', 'inspect', name], capture_output=True, text=True)
if existing.returncode == 0:
    info = json.loads(existing.stdout)[0]
    if info['Config'].get('Labels', {}).get('nghcc.service') != 'church-checkin-standalone':
        raise RuntimeError('Container name belongs to an unrelated service; stopped.')
    subprocess.run(['docker', 'rm', '-f', name], check=True)
subprocess.run([
    'docker', 'run', '-d', '--name', name, '--restart', 'unless-stopped',
    '--label', 'nghcc.service=church-checkin-standalone', '--network', 'nads26_default',
    '-p', '127.0.0.1:28022:8000', '--read-only', '--tmpfs', '/tmp:rw,nosuid,size=64m',
    '--mount', f'type=bind,source={config_dir},target=/config,readonly',
    'church-checkin-standalone:local',
], check=True)
for attempt in range(30):
    try:
        response = urllib.request.urlopen('http://127.0.0.1:28022/sunday.html', timeout=2)
        page = response.read().decode()
        if '智能報到系統密碼' in page and '北門行政平台' not in page:
            print('Independent service is ready; standalone login verified.')
            break
    except Exception:
        pass
    time.sleep(1)
else:
    raise RuntimeError('Independent service did not become ready; original routing is unchanged.')
