import unittest
from unittest.mock import patch

from routing_probe import wait_for_independent_routes


class Reply:
    def __init__(self, url, body):
        self.url, self.body = url, body

    def read(self):
        return self.body.encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class RoutingTests(unittest.TestCase):
    def test_waits_for_old_workers_then_checks_both_routes(self):
        old = Reply('http://test:8022/sunday.html', 'old meta refresh page')
        ready = Reply('http://test:8022/sunday/login/', '智能報到系統密碼')
        with patch('routing_probe.urllib.request.urlopen', side_effect=[old, ready, ready]) as opened:
            wait_for_independent_routes('http://test:8022', attempts=2, interval=0)
        self.assertEqual(opened.call_count, 3)
        self.assertIn('/barcode-print.html', opened.call_args.args[0].full_url)

    def test_wrong_origin_cannot_be_mistaken_for_success(self):
        wrong = Reply('http://other/login/', '智能報到系統密碼')
        with patch('routing_probe.urllib.request.urlopen', return_value=wrong):
            with self.assertRaises(RuntimeError):
                wait_for_independent_routes('http://test:8022', attempts=1, interval=0)

    def test_print_route_must_also_be_ready(self):
        ready = Reply('http://test:8022/sunday/login/', '智能報到系統密碼')
        old = Reply('http://test:8022/barcode-print.html', 'old page')
        with patch('routing_probe.urllib.request.urlopen', side_effect=[ready, old]):
            with self.assertRaises(RuntimeError):
                wait_for_independent_routes('http://test:8022', attempts=1, interval=0)


if __name__ == '__main__':
    unittest.main()
