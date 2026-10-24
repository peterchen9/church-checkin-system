"""Run using sudo after deploying the native administrative platform integration."""
import datetime
import os
import pathlib
import shutil

if os.geteuid() != 0:
    raise SystemExit('Run with sudo.')
source = pathlib.Path(__file__).resolve().parent / 'sunday-links'
root = pathlib.Path('/home/peterchen/church_checkin')
backup = pathlib.Path('/var/backups/church-checkin') / ('sunday-links-' + datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
backup.mkdir(parents=True, mode=0o700)
for name in ('index.html', 'sunday.html', 'barcode-print.html'):
    incoming = source / name
    if not incoming.is_file():
        raise SystemExit('Missing prepared page: ' + name)
for name in ('index.html', 'sunday.html', 'barcode-print.html'):
    target = root / name
    if target.exists():
        shutil.copy2(target, backup / name)
        target.write_bytes((source / name).read_bytes())
    else:
        target.write_bytes((source / name).read_bytes())
        os.chmod(target, 0o644)
print('Sunday and barcode links installed; backup:', backup)
