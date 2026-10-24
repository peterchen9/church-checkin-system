"""Apply a reviewed patch to the existing platform, with source guards and backups."""
import datetime
import hashlib
import os
import pathlib
import shutil

root = pathlib.Path(os.environ.get('NADS_ROOT', '/home/apps1/nads26'))
source = pathlib.Path(__file__).resolve().parent
guard = {
    'modules/eureka/models.py': 'd9674a051ad3860c3971bf832038eff0f518e8485ee9096eb8a6697011385206',
    'modules/eureka/urls.py': 'c5da930721217173fe5b57516bc3fd78e6e921a278f71a2d10e8125d3db8affa',
    'modules/eureka/views.py': '049a8a82c30b70f3dcf806cdc002cc382f260fbf1b0102ea3dda89b9d46f236c',
    'templates/eureka/eureka.html': '353c4230d91decf380d13cb00a6f23e16b5615b312cc266e53071b46ec271020',
}


def replacements():
    changes = {}
    path = root / 'modules/eureka/models.py'
    body = path.read_text()
    if 'from .sunday_models import SundayCheckin' not in body:
        changes[path] = body.rstrip() + '\n\nfrom .sunday_models import SundayCheckin\n'
    path = root / 'modules/eureka/urls.py'
    body = path.read_text()
    if "path('sunday/'," not in body:
        body = body.replace('from django.urls import path', 'from django.urls import path, include', 1)
        body = body.replace('urlpatterns = [', "urlpatterns = [\n    path('sunday/', include('modules.eureka.sunday_urls')),", 1)
        changes[path] = body
    path = root / 'modules/eureka/views.py'
    body = path.read_text()
    if "'sunday_attendance':" not in body:
        anchor = "        'att_records': att_records,"
        if body.count(anchor) != 1:
            raise RuntimeError('Unexpected contact detail view; stop for review.')
        body = body.replace('from .models import Member,', 'from .models import SundayCheckin, Member,', 1)
        body = body.replace(anchor, anchor + "\n        'sunday_attendance': SundayCheckin.objects.filter(church_id=member.church_id)[:12],", 1)
        changes[path] = body
    path = root / 'templates/eureka/eureka.html'
    body = path.read_text()
    if 'eureka/sunday_history.html' not in body:
        anchor = '                    <!-- Attendance Blocks -->'
        if body.count(anchor) != 1:
            raise RuntimeError('Unexpected attendance template; stop for review.')
        body = body.replace(anchor, "                    {% include 'eureka/sunday_history.html' %}\n" + anchor, 1)
        changes[path] = body
    for directory in ('modules', 'templates'):
        for path in (source / directory).rglob('*'):
            if path.is_file() and '__pycache__' not in path.parts:
                changes[root / path.relative_to(source)] = path.read_text()
    return changes


changes = replacements()
for relative, digest in guard.items():
    if hashlib.sha256((root / relative).read_bytes()).hexdigest() != digest:
        raise RuntimeError('Source changed since inspection: ' + relative)
backup = root / 'backups' / ('sunday-checkin-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True, exist_ok=False)
for path in changes:
    if path.exists():
        saved = backup / path.relative_to(root)
        saved.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, saved)
for path, body in changes.items():
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding='utf-8')
print('Applied', len(changes), 'files; backup:', backup)
