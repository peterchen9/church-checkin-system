"""A bearer-link, read-only list exposing only today's checked-in names."""
import secrets
from datetime import datetime, timedelta

from django.conf import settings
from django.db import connection
from django.http import Http404
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

from modules.eureka.models import Member, SundayCheckin


@never_cache
@require_GET
def public_names(request, token):
    expected = getattr(settings, 'PUBLIC_NAMES_TOKEN', '')
    if not expected or not token.isascii() or not secrets.compare_digest(expected, token):
        raise Http404()
    today = timezone.localdate()
    latest = {}

    def remember(church_id, moment, record_id):
        if isinstance(moment, str):
            moment = datetime.fromisoformat(moment)
        if timezone.is_aware(moment):
            moment = timezone.localtime(moment).replace(tzinfo=None)
        key = (moment, record_id)
        if church_id not in latest or key > latest[church_id]:
            latest[church_id] = key

    for church_id, moment, record_id in SundayCheckin.objects.filter(date=today).values_list('church_id', 'checked_in_at', 'id'):
        remember(church_id, moment, -record_id)
    # Other check-ins are stored as Taiwan local DATETIME values by PHP.
    with connection.cursor() as cursor:
        cursor.execute('SELECT church_id, checkin_time, id FROM checkin_logs WHERE checkin_time >= %s AND checkin_time < %s',
                       [today.isoformat() + ' 00:00:00', (today + timedelta(days=1)).isoformat() + ' 00:00:00'])
        for church_id, moment, record_id in cursor.fetchall():
            remember(church_id, moment, record_id)
    # Match desktop time DESC / record ID DESC; retain the latest row per person.
    members = dict(Member.objects.filter(church_id__in=latest).exclude(name__isnull=True).exclude(name='').values_list('church_id', 'name'))
    names = [members[church_id] for church_id in sorted(latest, key=latest.get, reverse=True) if church_id in members]
    response = render(request, 'public_names.html', {'names': names})
    response['Referrer-Policy'] = 'no-referrer'
    response['X-Robots-Tag'] = 'noindex, nofollow, noarchive'
    response['X-Frame-Options'] = 'DENY'
    response['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    return response
