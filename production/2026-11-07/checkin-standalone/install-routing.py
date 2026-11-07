"""Run with sudo after the independent service has passed its checks."""
import datetime
import os
import pathlib
import re
import shutil
import subprocess
import urllib.request
from routing_probe import wait_for_independent_routes

if os.geteuid() != 0:
    raise SystemExit('Run with sudo.')
response = urllib.request.urlopen('http://127.0.0.1:28022/sunday.html', timeout=5)
if '智能報到系統密碼' not in response.read().decode():
    raise SystemExit('Independent service is not ready; no changes made.')
target = pathlib.Path('/etc/nginx/sites-available/checkin-intranet-8022-8033.conf')
original = target.read_bytes()
text = original.decode()
marker = '    # Independent check-in service'
if marker in text:
    raise SystemExit('Independent routing already installed; stop for review.')
anchor = '    listen 192.168.16.240:8022;'
if text.count(anchor) != 1:
    raise SystemExit('Unexpected Nginx layout; no changes made.')
block = '''
    # Independent check-in service
    location = /sunday.html {
        proxy_pass http://127.0.0.1:28022;
        include /etc/nginx/snippets/checkin-standalone-proxy.conf;
    }
    location = /barcode-print.html {
        proxy_pass http://127.0.0.1:28022;
        include /etc/nginx/snippets/checkin-standalone-proxy.conf;
    }
    location /sunday/ {
        proxy_pass http://127.0.0.1:28022;
        include /etc/nginx/snippets/checkin-standalone-proxy.conf;
    }
'''
snippet = pathlib.Path('/etc/nginx/snippets/checkin-standalone-proxy.conf')
if snippet.exists():
    raise SystemExit('Proxy snippet already exists; stop for review.')
backup = pathlib.Path('/var/backups/church-checkin') / ('standalone-' + datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
backup.mkdir(mode=0o700, parents=True)
shutil.copy2(target, backup / target.name)
snippet.write_text('proxy_set_header Host $http_host;\nproxy_set_header X-Real-IP $remote_addr;\nproxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\nproxy_set_header X-Forwarded-Proto $scheme;\nproxy_redirect off;\n')
target.write_text(text.replace(anchor, anchor + '\n' + block, 1))
try:
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    wait_for_independent_routes('http://192.168.16.240:8022')
except Exception:
    target.write_bytes(original)
    snippet.unlink(missing_ok=True)
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise

# Retire only the hosted Sunday routes; keep contact data and its attendance display.
admin_urls = pathlib.Path('/home/apps1/nads26/modules/eureka/urls.py')
admin_original = admin_urls.read_text()
retired = re.sub(r"(?m)^    path\('sunday/', include\('modules\.eureka\.sunday_urls'\)\),\r?\n", '', admin_original)
if retired != admin_original:
    shutil.copy2(admin_urls, backup / 'administrative-eureka-urls.py')
    admin_urls.write_text(retired)
    subprocess.run(['python3', str(pathlib.Path(__file__).with_name('legacy_redirect.py'))], check=True)
    checked = subprocess.run(['docker', 'exec', 'nads26-web', 'python', 'manage.py', 'check', '--fail-level', 'ERROR'])
    if checked.returncode:
        admin_urls.write_text(admin_original)
        raise SystemExit('Independent service is active; administrative route retirement needs review.')
    subprocess.run(['docker', 'restart', 'nads26-web'], check=True)
print('DEPLOYED: full homepage remains on 8022; Sunday and QR printing are independent.')
print('Backup:', backup)
