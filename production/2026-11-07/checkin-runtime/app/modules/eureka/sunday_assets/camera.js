(function (global) {
    'use strict';
    global.CheckinCamera = function ({ button, container, view, notice, onScan, onStateChange }) {
        let scanner = null;
        let active = false;
        let busy = false;
        const idleIcon = button.innerHTML;
        const message = text => {
            notice.textContent = text;
            notice.classList.toggle('hidden', !text);
        };
        const errorText = error => {
            const detail = String(error && (error.name || error.message) || error);
            if (/NotAllowed|PermissionDenied|SecurityError/i.test(detail))
                return '尚未允許相機。請在瀏覽器的網站設定允許相機，再按「切換鏡頭」。';
            if (/NotReadable|TrackStart/i.test(detail))
                return '相機可能被其他程式使用。請關閉其他相機程式後重試。';
            if (/NotFound|DevicesNotFound/i.test(detail))
                return '找不到可用鏡頭，請確認手機或電腦已連接相機。';
            return '相機無法啟動，請確認相機權限後重試。';
        };
        function restore() {
            container.querySelectorAll('video').forEach(video => {
                video.srcObject?.getTracks().forEach(track => track.stop());
            });
            container.classList.add('hidden');
            view.classList.remove('camera-active');
            active = false;
            button.innerHTML = idleIcon;
            button.title = '切換鏡頭';
            button.setAttribute('aria-label', '啟用後鏡頭掃碼');
            button.setAttribute('aria-pressed', 'false');
            onStateChange(false);
        }
        async function start() {
            if (busy || active) return;
            if (!global.isSecureContext || !global.navigator.mediaDevices?.getUserMedia) {
                message('手機相機需要 HTTPS 安全連線。目前的 HTTP 網址無法啟用相機，請改用已設定的 HTTPS 報到網址。');
                return;
            }
            if (typeof global.Html5Qrcode !== 'function') {
                message('掃碼元件尚未載入，請確認網路並重新整理頁面。');
                return;
            }
            busy = true;
            button.disabled = true;
            message('正在請求後鏡頭權限，請在瀏覽器提示中選擇允許。');
            container.classList.remove('hidden');
            view.classList.add('camera-active');
            try {
                scanner = new global.Html5Qrcode('reader');
                const options = { fps: 10, disableFlip: true, qrbox: (width, height) => {
                    const side = Math.max(50, Math.min(280, Math.floor(Math.min(width, height) * 0.7)));
                    return { width: side, height: side };
                }};
                try {
                    await scanner.start({ facingMode: { exact: 'environment' } }, options, onScan, () => {});
                } catch (error) {
                    // Fall back only if a rear lens cannot be selected, never after permission denial.
                    const detail = String(error && (error.name || error.message) || error);
                    if (!/Overconstrained|NotFound|DevicesNotFound|ConstraintNotSatisfied/i.test(detail)) throw error;
                    await scanner.start({ facingMode: 'environment' }, options, onScan, () => {});
                }
                active = true;
                button.innerHTML = '<span aria-hidden="true" style="font-size:24px">✕</span>';
                button.title = '關閉鏡頭';
                button.setAttribute('aria-label', '關閉鏡頭');
                button.setAttribute('aria-pressed', 'true');
                onStateChange(true);
                message('');
            } catch (error) {
                try { await scanner?.clear(); } catch (_) {}
                scanner = null;
                restore();
                message(errorText(error));
            } finally {
                busy = false;
                button.disabled = false;
            }
        }
        async function stop() {
            if (busy) return;
            busy = true;
            button.disabled = true;
            try {
                if (active) await scanner.stop();
                await scanner?.clear();
            } catch (error) {
                message('鏡頭已關閉，若再次啟動失敗請重新整理頁面。');
            } finally {
                scanner = null;
                restore();
                busy = false;
                button.disabled = false;
            }
        }
        button.setAttribute('aria-label', '啟用後鏡頭掃碼');
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => active ? stop() : start());
        global.addEventListener('pagehide', () => { if (active) stop(); });
        return { start, stop, get active() { return active; }, get busy() { return busy; } };
    };
})(window);
