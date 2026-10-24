"""Isolated SQLite tests: never connects to the platform's production database."""
import json
import os
import sys
import unittest
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.conf import settings

root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, '/app')
sys.path.insert(0, root)
settings.configure(
    SECRET_KEY='test-only', USE_TZ=True, TIME_ZONE='Asia/Taipei', MEDIA_ROOT='/tmp', ALLOWED_HOSTS=['testserver'],
    DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
    INSTALLED_APPS=['django.contrib.auth', 'django.contrib.contenttypes', 'modules.eureka'],
    ROOT_URLCONF=__name__, LOGIN_URL='/accounts/login/',
    TEMPLATES=[{'BACKEND': 'django.template.backends.django.DjangoTemplates',
                'DIRS': [os.path.join(root, 'templates')], 'APP_DIRS': True}],
)
import django
django.setup()
from django.db import connection
from django.test import RequestFactory
from django.middleware.csrf import get_token
from django.urls import include, path
from modules.eureka.models import Member, SundayCheckin
from modules.eureka import sunday_views as views

urlpatterns = [path('eureka/', include('modules.eureka.urls'))]
with connection.schema_editor() as editor:
    editor.create_model(Member)
    editor.create_model(SundayCheckin)


class SundayTests(unittest.TestCase):
    def setUp(self):
        SundayCheckin.objects.all().delete()
        with connection.cursor() as cursor:
            cursor.execute('DELETE FROM members')
        self.member = Member.objects.create(church_id=123, name='測試人員', mobile1='0912-345-678',
                                             phone_h='03-1234567', section='測試牧區')
        self.factory = RequestFactory()

    def request(self, method='get', data=None, anonymous=False):
        request = (self.factory.post('/', json.dumps(data or {}), content_type='application/json')
                   if method == 'post' else self.factory.get('/', data or {}))
        request.user = SimpleNamespace(is_authenticated=not anonymous, get_username=lambda: 'test-operator')
        if method == 'post':
            request.META['HTTP_X_CSRFTOKEN'] = get_token(request)
            request.COOKIES[settings.CSRF_COOKIE_NAME] = request.META['CSRF_COOKIE']
        return request

    def test_barcode_roundtrip_and_invalid(self):
        self.assertEqual(views.barcode_value(123), 'NG000123708')
        self.assertEqual(views.barcode_value(1), 'NG000001001')
        self.assertEqual(views.barcode_value(999999), 'NG999999209')
        self.assertEqual(views.parse_barcode('ng000123708'), 123)
        self.assertEqual(views.parse_barcode('123'), 123)
        for bad in ('NG123', '<script>', 'NG0001237081', 'NG000123000', 'NG000123987', ''):
            with self.assertRaises(ValueError): views.parse_barcode(bad)
        with self.assertRaises(ValueError): views.barcode_value(1000000)

    def test_requires_login(self):
        for view in (views.search_members, views.sunday_page, views.barcode_page):
            self.assertEqual(view(self.request(anonymous=True)).status_code, 302)

    def test_search_phone_normalization_and_masking(self):
        result = json.loads(views.search_members(self.request(data={'q': '0912345678'})).content)
        self.assertEqual(result['members'][0]['church_id'], '123')
        self.assertEqual(result['members'][0]['phone_hint'], '尾碼 5678')
        self.assertNotIn('0912', json.dumps(result))
        result = json.loads(views.search_members(self.request(data={'q': '031234567'})).content)
        self.assertEqual(len(result['members']), 1)

    def test_checkin_updates_directory_and_deduplicates(self):
        moment = datetime(2026, 10, 25, 9, 0, tzinfo=ZoneInfo('Asia/Taipei'))
        with patch.object(views.timezone, 'localtime', return_value=moment):
            first = json.loads(views.checkin(self.request('post', {'barcode': 'NG000123708'})).content)
            second = json.loads(views.checkin(self.request('post', {'barcode': '123'})).content)
        self.assertTrue(first['success'])
        self.assertFalse(first['duplicate'])
        self.assertTrue(second['duplicate'])
        self.assertEqual(SundayCheckin.objects.count(), 1)
        self.member.refresh_from_db()
        self.assertEqual(self.member.presence, 1)
        self.assertEqual(self.member.first_daka, '2026-10-25')

    def test_non_sunday_allowed_during_testing_and_missing_person_rejected(self):
        with patch.object(views.timezone, 'localtime', return_value=datetime(2026, 10, 22, 9, tzinfo=ZoneInfo('Asia/Taipei'))):
            first = json.loads(views.checkin(self.request('post', {'barcode': '123'})).content)
            second = json.loads(views.checkin(self.request('post', {'barcode': '123'})).content)
            self.assertTrue(first['success'])
            self.assertTrue(second['duplicate'])
        with patch.object(views.timezone, 'localtime', return_value=datetime(2026, 10, 25, 9, tzinfo=ZoneInfo('Asia/Taipei'))):
            self.assertEqual(views.checkin(self.request('post', {'barcode': '999'})).status_code, 404)
        self.assertEqual(SundayCheckin.objects.count(), 1)

    def test_sunday_restriction_can_be_restored(self):
        with patch.object(views, 'SUNDAY_ONLY', True), patch.object(views.timezone, 'localtime', return_value=datetime(2026, 10, 22, 9, tzinfo=ZoneInfo('Asia/Taipei'))):
            self.assertEqual(views.checkin(self.request('post', {'barcode': '123'})).status_code, 400)
        self.assertEqual(SundayCheckin.objects.count(), 0)

    def test_failed_log_write_rolls_back_contact(self):
        with patch.object(views.timezone, 'localtime', return_value=datetime(2026, 10, 25, 9, tzinfo=ZoneInfo('Asia/Taipei'))), patch.object(SundayCheckin.objects, 'get_or_create', side_effect=RuntimeError('test')), self.assertLogs(views.logger, level='ERROR'):
            self.assertEqual(views.checkin(self.request('post', {'barcode': '123'})).status_code, 503)
        self.member.refresh_from_db()
        self.assertEqual(self.member.presence, 0)

    def test_print_three_identical_labels_and_dimensions(self):
        response = views.print_labels(self.request(), 123)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['X-Frame-Options'], 'SAMEORIGIN')
        html = response.content.decode()
        self.assertEqual(html.count('<section class="label">'), 3)
        self.assertEqual(html.count('<div class="name">測試人員</div>'), 3)
        self.assertNotIn('<div class="code">', html)
        self.assertIn('<svg', html)
        self.assertIn('width:20mm;height:20mm', html)
        self.assertIn('font-size:2mm', html)
        self.assertIn('@page{size:25.4mm 25mm;margin:0}', html)
        self.assertIn('width:25.4mm;height:25mm', html)
        self.assertIn('QR Code', html)
        self.assertLess(html.index('<svg', html.index('<section class="label">')),
                        html.index('<div class="name">', html.index('<section class="label">')))
        self.assertEqual(views.print_labels(self.request(data={'width': 'NaN'}), 123).status_code, 400)
        self.assertEqual(views.print_labels(self.request(data={'height': '20'}), 123).status_code, 400)

    def test_page_templates_and_search_validation(self):
        page = views.sunday_page(self.request())
        self.assertEqual(page.status_code, 200)
        self.assertIn(settings.CSRF_COOKIE_NAME, page.cookies)
        self.assertEqual(views.barcode_page(self.request()).status_code, 200)
        print_page = views.barcode_page(self.request()).content.decode()
        self.assertNotIn('label-width', print_page)
        self.assertNotIn('member.phone_hint', print_page)
        self.assertIn('直接列印', print_page)
        self.assertIn('printMemberLabels(member)', print_page)
        self.assertNotIn('window.open(', print_page)
        self.assertIn('form.reset()', print_page)
        self.assertIn('afterprint', print_page)
        self.assertEqual(views.search_members(self.request(data={'q': 'a'})).status_code, 400)
        self.assertEqual(views.checkin(self.request('post', {'barcode': '<script>'})).status_code, 400)

    def test_service_boundaries(self):
        for hour, minute, expected in ((7, 30, '第一堂'), (10, 15, '第一堂'), (10, 16, '第二堂'), (13, 0, '第二堂'), (18, 0, '晚崇拜'), (22, 0, '主日其他時段')):
            self.assertEqual(views.service_at(datetime(2026, 10, 25, hour, minute)), expected)

    def test_csrf_enforced_despite_platform_disable_flag(self):
        request = self.request('post', {'barcode': '123'})
        request._dont_enforce_csrf_checks = True
        del request.META['HTTP_X_CSRFTOKEN']
        with self.assertLogs('django.security.csrf', level='WARNING'):
            self.assertEqual(views.checkin(request).status_code, 403)

    def test_original_screen_and_print_link(self):
        html = views.sunday_page(self.request()).content.decode()
        for element in ('status-card', 'toggle-camera', 'fullscreen-btn', 'scanner-input',
                        'manual-search-input', 'select-member-modal', 'search-sidebar'):
            self.assertIn('id="' + element + '"', html)
        self.assertIn('data-sunday-only="true"', html)
        self.assertLess(html.index('id="manual-search-container"'), html.index('id="barcode-search-container"'))
        self.assertEqual(html.count('id="search-form"'), 1)
        self.assertNotIn('id="print-barcode-link"', html)
        from html.parser import HTMLParser
        class SidebarParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.stack = []
                self.parents = {}
            def handle_starttag(self, tag, attrs):
                attrs = dict(attrs)
                if 'id' in attrs:
                    self.parents[attrs['id']] = [item[1] for item in self.stack]
                if tag not in ('input', 'meta', 'link', 'br', 'img', 'hr', 'source', 'path', 'circle', 'polyline'):
                    self.stack.append((tag, attrs.get('id')))
            def handle_endtag(self, tag):
                for index in range(len(self.stack) - 1, -1, -1):
                    if self.stack[index][0] == tag:
                        del self.stack[index:]
                        break
        parser = SidebarParser()
        parser.feed(html)
        for section in ('manual-search-container', 'barcode-search-container'):
            self.assertIn('search-sidebar', parser.parents[section])
        self.assertIn('printMemberLabels(member)', html)
        self.assertNotIn('搜尋通訊錄</button>', html)

    def test_original_payload_and_manual_search(self):
        moment = datetime(2026, 10, 25, 9, 0, tzinfo=ZoneInfo('Asia/Taipei'))
        with patch.object(views.timezone, 'localtime', return_value=moment):
            scanned = json.loads(views.checkin(self.request('post', {'qr_code_id': 'NG000123708', 'mode': '主日聚會'})).content)
            manual = json.loads(views.checkin(self.request('post', {'qr_code_id': '測試人員', 'is_manual_search': True})).content)
        self.assertTrue(scanned['success'])
        self.assertEqual(scanned['member']['status'], '第一堂')
        self.assertIn('family1', scanned['member'])
        self.assertTrue(manual['duplicate'])
        Member.objects.create(church_id=124, name='測試人員二')
        matched = json.loads(views.checkin(self.request('post', {'qr_code_id': '測試人員', 'is_manual_search': True})).content)
        self.assertTrue(matched['multiple'])
        self.assertEqual(len(matched['matches']), 2)


if __name__ == '__main__':
    unittest.main()

