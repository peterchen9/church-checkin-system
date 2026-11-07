import time
import urllib.parse
import urllib.request


def wait_for_independent_routes(base_url, attempts=30, interval=0.5):
    """Nginx reload is asynchronous: wait for both new routes before rollback."""
    expected_host = urllib.parse.urlsplit(base_url).netloc
    last_error = 'No response received.'
    for attempt in range(attempts):
        try:
            for path in ('/sunday.html', '/barcode-print.html'):
                request = urllib.request.Request(
                    base_url + path + '?route_probe=' + str(time.time_ns()),
                    headers={'Cache-Control': 'no-cache', 'Connection': 'close'})
                with urllib.request.urlopen(request, timeout=5) as response:
                    destination = urllib.parse.urlsplit(response.url)
                    page = response.read().decode()
                    if (destination.netloc != expected_host or destination.path != '/sunday/login/'
                            or '智能報到系統密碼' not in page):
                        raise RuntimeError('Entry still returns an old or unexpected page: ' + path)
            return
        except Exception as error:
            last_error = str(error)
            if attempt + 1 < attempts:
                time.sleep(interval)
    raise RuntimeError('Independent routes did not become ready: ' + last_error)
