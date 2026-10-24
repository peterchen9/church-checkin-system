import hashlib
import json
import logging
import re
from pathlib import Path
from datetime import time
from decimal import Decimal, InvalidOperation
from functools import wraps

from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Q, Value
from django.db.models.functions import Replace
from django.http import FileResponse, Http404, JsonResponse
from django.middleware.csrf import CsrfViewMiddleware
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.utils.safestring import mark_safe
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.clickjacking import xframe_options_sameorigin

from .models import Member, SundayCheckin

logger = logging.getLogger(__name__)
# Temporarily disabled for end-to-end testing. Restore to True after testing.
SUNDAY_ONLY = False


def csrf_required(view):
    @wraps(view)
    def protected(request, *args, **kwargs):
        # The host platform disables CSRF globally; enforce it specifically for this write API.
        request._dont_enforce_csrf_checks = False
        middleware = CsrfViewMiddleware(lambda request: None)
        middleware.process_request(request)
        rejected = middleware.process_view(request, view, args, kwargs)
        if rejected:
            return JsonResponse({'success': False, 'message': '驗證已失效，請重新整理報到頁後重試。'}, status=403)
        return view(request, *args, **kwargs)
    return protected


def parse_barcode(value):
    value = str(value).strip()
    match = re.fullmatch(r'NG(\d{6})\d{3}', value, re.I)
    if match:
        number = int(match.group(1))
        if value.upper() != barcode_value(number):
            raise ValueError('條碼檢查碼不正確，請重新掃描。')
        return number
    if re.fullmatch(r'\d{1,18}', value):
        return int(value)
    raise ValueError('請掃描活石條碼，或輸入人員編號。')


def barcode_value(church_id):
    number = int(church_id)
    if not 1 <= number <= 999999:
        raise ValueError('此編號不適用現有 6 位活石條碼格式，請先確認編號對應。')
    # Exact legacy to_nghc_id algorithm: first seven MD5 hex digits, modulo 1000.
    prefix = f'NG{number:06d}'
    digest = hashlib.md5(prefix.encode('utf-8')).hexdigest()
    return prefix + f'{int(digest[:7], 16) % 1000:03d}'


def service_at(moment):
    clock = moment.time().replace(tzinfo=None)
    if time(7, 30) <= clock <= time(10, 15, 59, 999999):
        return '第一堂'
    if time(10, 16) <= clock <= time(13, 0, 59, 999999):
        return '第二堂'
    if time(18) <= clock <= time(21, 30, 59, 999999):
        return '晚崇拜'
    return '主日其他時段'


@never_cache
@login_required
@ensure_csrf_cookie
@require_GET
def sunday_page(request):
    return render(request, 'eureka/sunday_checkin.html')


@never_cache
@login_required
@require_GET
def barcode_page(request):
    return render(request, 'eureka/barcode_print.html')


@login_required
@require_GET
def sunday_asset(request, filename):
    if filename not in ('app.js', 'style.css'):
        raise Http404()
    return FileResponse((Path(__file__).parent / 'sunday_assets' / filename).open('rb'),
                        content_type='text/javascript' if filename.endswith('.js') else 'text/css')


def member_result(member):
    digits = re.sub(r'\D', '', member.mobile1 or '')
    return {'church_id': str(member.church_id), 'name': member.name,
            'section': member.section, 'group': member.family1, 'family1': member.family1,
            'phone_hint': ('尾碼 ' + digits[-4:]) if digits else '未填手機'}


def matching_members(keyword):
    if not 2 <= len(keyword) <= 50:
        raise ValueError('請輸入 2 至 50 字的姓名或電話。')
    query = Q(name__icontains=keyword)
    digits = re.sub(r'\D', '', keyword)
    members = Member.objects.all()
    if len(digits) >= 2:
        for field in ('mobile1', 'phone_h', 'phone_o'):
            expression = field
            for character in (' ', '-', '(', ')', '+', '　'):
                expression = Replace(expression, Value(character), Value(''))
            alias = 'normalized_' + field
            members = members.annotate(**{alias: expression})
            query |= Q(**{alias + '__contains': digits})
    return list(members.filter(query).order_by('name', 'church_id')[:21])


@never_cache
@login_required
@require_GET
def search_members(request):
    try:
        matches = matching_members(request.GET.get('q', '').strip())
    except ValueError as error:
        return JsonResponse({'success': False, 'message': str(error)}, status=400)
    return JsonResponse({'success': True, 'members': [member_result(m) for m in matches[:20]],
                         'has_more': len(matches) > 20})


@never_cache
@login_required
@require_POST
@csrf_required
def checkin(request):
    try:
        data = json.loads(request.body)
        if not isinstance(data, dict):
            raise ValueError('請提供報到資料。')
        if data.get('is_manual_search'):
            matches = matching_members(str(data.get('qr_code_id', '')).strip())
            if not matches:
                return JsonResponse({'success': False, 'message': '通訊錄找不到符合的人員。'})
            if len(matches) > 1:
                return JsonResponse({'success': False, 'multiple': True,
                                     'matches': [member_result(m) for m in matches[:20]]})
            church_id = matches[0].church_id
        else:
            church_id = parse_barcode(data.get('barcode', data.get('qr_code_id', '')))
    except (ValueError, TypeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': '條碼格式不正確。'}, status=400)
    now = timezone.localtime()
    if SUNDAY_ONLY and now.weekday() != 6:
        return JsonResponse({'success': False, 'message': '今天不是主日，未寫入報到紀錄。'}, status=400)
    service = service_at(now)
    try:
        # Lock the canonical contact so concurrent scans cannot create duplicate attendance.
        with transaction.atomic():
            member = Member.objects.select_for_update().filter(church_id=church_id).first()
            if member is None:
                return JsonResponse({'success': False, 'message': '通訊錄找不到此人，請確認活石編號對應。'}, status=404)
            record, created = SundayCheckin.objects.get_or_create(
                church_id=church_id, date=now.date(), service=service,
                defaults={'checked_in_at': now, 'recorded_by': request.user.get_username()})
            member.presence = 1
            fields = ['presence']
            if not member.first_daka:
                member.first_daka = now.date().isoformat()
                fields.append('first_daka')
            member.save(update_fields=fields)
        member_data = member_result(member)
        member_data['status'] = service
        return JsonResponse({'success': True, 'duplicate': not created,
                             'message': f'{member.name} {service}' + ('已報到，未重複記錄。' if not created else '報到成功！'),
                             'member': member_data, 'service': service})
    except Exception:
        logger.exception('Sunday check-in failed')
        return JsonResponse({'success': False, 'message': '報到未完成，請聯絡管理員後重試。'}, status=503)


def dimension(raw, fallback, low, high):
    try:
        value = Decimal(raw if raw is not None else fallback)
        if not value.is_finite() or not low <= value <= high:
            raise ValueError()
        return value
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError('標籤寬度需為 25–100 mm，高度需為 25–80 mm，讓 QR Code 保持足夠尺寸。')


@never_cache
@login_required
@require_GET
@xframe_options_sameorigin
def print_labels(request, church_id):
    member = get_object_or_404(Member, church_id=church_id)
    try:
        value = barcode_value(member.church_id)
        width = dimension(request.GET.get('width'), '25.4', 25, 100)
        height = dimension(request.GET.get('height'), '25', 25, 80)
        from reportlab.graphics.barcode.qr import QrCodeWidget
        from reportlab.graphics.shapes import Drawing
        from reportlab.lib.units import mm
        # Preserve a square QR code, including a four-module quiet zone on every side.
        qr_size = Decimal('20')
        name_font = Decimal('2')
        widget = QrCodeWidget(value, barLevel='M', barBorder=4)
        bounds = widget.getBounds()
        side = float(qr_size) * mm
        scale = side / (bounds[2] - bounds[0])
        drawing = Drawing(side, side, transform=[scale, 0, 0, scale, 0, 0])
        drawing.add(widget)
        svg = drawing.asString('svg')
        if isinstance(svg, bytes):
            svg = svg.decode('utf-8')
    except ValueError as error:
        return render(request, 'eureka/barcode_print.html', {'error': str(error)}, status=400)
    return render(request, 'eureka/barcode_labels.html', {
        'member': member, 'barcode': value, 'barcode_svg': mark_safe(svg),
        'width': format(width, 'f'), 'height': format(height, 'f'),
        'qr_size': format(qr_size, 'f'), 'name_font': format(name_font, 'f'),
        'copies': range(3)})
