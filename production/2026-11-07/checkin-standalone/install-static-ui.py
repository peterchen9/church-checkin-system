"""Update the full system's shared frontend assets; run with sudo."""
import datetime
import os
import pathlib
import shutil

if os.geteuid() != 0:
    raise SystemExit('Run with sudo.')
source = pathlib.Path(__file__).resolve().parent / 'static-ui'
root = pathlib.Path('/home/peterchen/church_checkin')
names = ('index.html', 'app.js', 'style.css')
if not all((source / name).is_file() for name in names):
    raise SystemExit('Missing prepared frontend assets; no changes made.')
backup = pathlib.Path('/var/backups/church-checkin') / ('responsive-ui-' + datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
backup.mkdir(mode=0o700, parents=True)
for name in names:
    target = root / name
    if target.exists():
        shutil.copy2(target, backup / name)
    target.write_bytes((source / name).read_bytes())
    os.chmod(target, 0o644)
print('Full system responsive layout deployed; camera disabled; backup:', backup)
