document.addEventListener('DOMContentLoaded', () => {
    const sundayOnly = document.body.dataset.sundayOnly === 'true';
    const checkinApi = document.body.dataset.checkinApi || 'api/checkin.php';
    const checkinHeaders = { 'Content-Type': 'application/json' };
    if (sundayOnly) {
        checkinHeaders['X-CSRFToken'] = document.querySelector('[name=csrfmiddlewaretoken]').value;
    }
    // --- State & DOM Elements ---
    let currentMode = '主日聚會';
    let isProcessing = false;
    let successDisplay = null;
    let successDisplayTimer;
    let cameraModeActive = false;


    const tabs = document.querySelectorAll('.tab');
    const statusCard = document.getElementById('status-card');
    const statusIcon = document.getElementById('status-icon');
    const statusTitle = document.getElementById('status-title');
    const statusMessage = document.getElementById('status-message');
    const userInfo = document.getElementById('user-info');
    const userSection = document.getElementById('user-section');
    const userGroup = document.getElementById('user-group');
    const userName = document.getElementById('user-name');
    
    const eventSelectionContainer = document.getElementById('event-selection-container');
    const eventSelect = document.getElementById('event-select');
    
    const cellgroupSelectionContainer = document.getElementById('cellgroup-selection-container');
    const sectionSelect = document.getElementById('section-select');
    const groupSelect = document.getElementById('group-select');
    
    const unitSelectionContainer = document.getElementById('unit-selection-container');
    const unitSelect = document.getElementById('unit-select');

    const pinModal = document.getElementById('pin-modal');
    const pinInput = document.getElementById('pin-input');
    const btnSubmitPin = document.getElementById('btn-submit-pin');
    const pinError = document.getElementById('pin-error');
    
    let allEvents = [];
    let allSectionsData = {};
    
    const scannerInput = document.getElementById('scanner-input');
    const soundSuccess = document.getElementById('sound-success');
    const soundError = document.getElementById('sound-error');

    // --- View Navigation ---
    const viewHome = document.getElementById('view-home');
    const viewSelection = document.getElementById('view-selection');
    const viewScan = document.getElementById('view-scan');
    const currentCategoryTitle = document.getElementById('current-category-title');
    const selectionCategoryTitle = document.getElementById('selection-category-title');
    const scanThemeDisplay = document.getElementById('scan-theme-display');
    const btnEnterScan = document.getElementById('btn-enter-scan');

    window.closePinModal = function() {
        if (pinModal) {
            pinModal.style.display = 'none';
            pinInput.value = '';
            if (pinError) pinError.style.display = 'none';
        }
    };

    if (btnSubmitPin) {
        btnSubmitPin.addEventListener('click', () => {
            if (pinInput.value === '__PRIVATE_BACKUP_ONLY__') {
                closePinModal();
                proceedWithCategory('同工打卡');
            } else {
                pinError.style.display = 'block';
                pinInput.value = '';
            }
        });
    }

    if (pinInput) {
        pinInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                btnSubmitPin.click();
            }
        });
    }

    window.selectCategory = function(category) {
        if (category === '同工打卡') {
            if (pinModal) {
                pinModal.style.display = 'block';
                setTimeout(() => pinInput.focus(), 100);
            }
            return;
        }
        proceedWithCategory(category);
    };

    function proceedWithCategory(category) {
        currentMode = category;
        viewScan.classList.toggle('sunday-scan', category === '主日聚會');
        
        viewHome.classList.add('hidden');
        
        const btnHome = document.getElementById('btn-home');
        if (btnHome) btnHome.style.display = 'flex'; // show home button in header

        if (currentMode === '成主課程' || currentMode === '特別聚會' || currentMode === '牧區小組聚會' || currentMode === '同工打卡') {
            // Need selection
            viewSelection.classList.remove('hidden');
            viewScan.classList.add('hidden');
            selectionCategoryTitle.textContent = category;
            
            if (currentMode === '牧區小組聚會') {
                eventSelectionContainer.classList.add('hidden');
                if (unitSelectionContainer) unitSelectionContainer.classList.add('hidden');
                cellgroupSelectionContainer.classList.remove('hidden');
                if (Object.keys(allSectionsData).length === 0) fetchSections();
            } else if (currentMode === '同工打卡') {
                eventSelectionContainer.classList.add('hidden');
                cellgroupSelectionContainer.classList.add('hidden');
                if (unitSelectionContainer) unitSelectionContainer.classList.remove('hidden');
                fetchStaffUnits();
            } else {
                eventSelectionContainer.classList.remove('hidden');
                cellgroupSelectionContainer.classList.add('hidden');
                if (unitSelectionContainer) unitSelectionContainer.classList.add('hidden');
                populateEventSelect();
            }
        } else {
            // Direct to scan
            viewSelection.classList.add('hidden');
            viewScan.classList.remove('hidden');
            currentCategoryTitle.textContent = category;
            scanThemeDisplay.textContent = ''; // Or display category name
            resetStatus();
        }
    }

    if (btnEnterScan) {
        btnEnterScan.addEventListener('click', () => {
            let themeText = '';
            if (currentMode === '成主課程' || currentMode === '特別聚會') {
                if (!eventSelect.value) {
                    alert('請先選擇一個課程或聚會！');
                    return;
                }
                themeText = eventSelect.options[eventSelect.selectedIndex].text;
            } else if (currentMode === '牧區小組聚會') {
                if (!sectionSelect.value || !groupSelect.value) {
                    alert('請先選擇牧區及小組！');
                    return;
                }
                themeText = `${sectionSelect.value} - ${groupSelect.value}`;
            } else if (currentMode === '同工打卡') {
                if (!unitSelect || !unitSelect.value) {
                    alert('請先選擇所屬單位！');
                    return;
                }
                themeText = unitSelect.value;
            }
            
            // Proceed to scan view
            viewSelection.classList.add('hidden');
            viewScan.classList.remove('hidden');
            currentCategoryTitle.textContent = currentMode;
            scanThemeDisplay.textContent = themeText;
            resetStatus();
        });
    }

    window.goHome = function() {
        if (sundayOnly) return;
        viewScan.classList.add('hidden');
        viewSelection.classList.add('hidden');
        viewHome.classList.remove('hidden');
        const btnHome = document.getElementById('btn-home');
        if (btnHome) btnHome.style.display = 'none';

    };

    async function fetchStaffUnits() {
        if (!unitSelect) return;
        unitSelect.replaceChildren(new Option('讀取平台部門中...', ''));
        try {
            const response = await fetch('api/sections.php');
            const data = await response.json();
            if (!data.success) throw new Error('Cannot load platform departments');
            unitSelect.replaceChildren(new Option('請選擇平台部門...', ''));
            (data.staff_units || []).forEach(unit => unitSelect.add(new Option(unit, unit)));
        } catch (error) {
            unitSelect.replaceChildren(new Option('平台部門讀取失敗，請重試', ''));
        }
    }

    
    // --- Fetch Events ---
    async function fetchEvents() {
        try {
            const response = await fetch('api/events.php');
            const data = await response.json();
            if (data.success) {
                allEvents = data.events;
                // If user is already on a page that needs events, populate it now
                if (!eventSelectionContainer.classList.contains('hidden')) {
                    populateEventSelect();
                }
            }
        } catch (e) {
            console.error('Failed to fetch events', e);
        }
    }
    if (!sundayOnly) fetchEvents();

    function populateEventSelect() {
        const typeMapping = {
            '成主課程': 'course',
            '特別聚會': 'special'
        };
        const targetType = typeMapping[currentMode];
        
        eventSelect.innerHTML = '<option value="">請選擇...</option>';
        allEvents.forEach(evt => {
            if (evt.type === targetType) {
                const option = document.createElement('option');
                option.value = evt.id;
                option.textContent = evt.code ? `${evt.code} · ${evt.name}` : evt.name;
                eventSelect.appendChild(option);
            }
        });
    }

    // --- Fetch Sections & Groups ---
    async function fetchSections() {
        try {
            const response = await fetch('api/sections.php');
            const data = await response.json();
            if (data.success) {
                allSectionsData = data.sections;
                populateSectionSelect();
            }
        } catch (e) {
            console.error('Failed to fetch sections', e);
        }
    }

    function populateSectionSelect() {
        sectionSelect.innerHTML = '<option value="">請選擇牧區...</option>';
        for (const sec in allSectionsData) {
            const option = document.createElement('option');
            option.value = sec;
            option.textContent = sec;
            sectionSelect.appendChild(option);
        }
    }

    sectionSelect.addEventListener('change', () => {
        const selectedSec = sectionSelect.value;
        groupSelect.innerHTML = '<option value="">請選擇小組...</option>';
        if (selectedSec && allSectionsData[selectedSec]) {
            // Add "全小組" option
            const allOption = document.createElement('option');
            allOption.value = '全小組';
            allOption.textContent = '全小組';
            groupSelect.appendChild(allOption);
            
            // Add other groups
            allSectionsData[selectedSec].forEach(grp => {
                const option = document.createElement('option');
                option.value = grp;
                option.textContent = grp;
                groupSelect.appendChild(option);
            });
        }
    });

    // --- Barcode Scanner Logic (Keyboard wedge) ---
    // Focus the hidden input to capture fast scanner typing
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION' || e.target.closest('button')) {
            return; // Do not steal focus from interactive elements
        }
    });

    let scanBuffer = '';
    let scanTimeout;

    // Global keydown to capture input even if input loses focus
    document.addEventListener('keydown', (e) => {
        if (cameraModeActive || isProcessing) return;
        if (e.target.closest('input:not(#scanner-input), textarea, select, button, a')) return;
        
        // Ensure input is focused for direct value reading, or fallback to buffer
        if (e.key === 'Enter') {
            e.preventDefault(); // Stop default browser action that might break fullscreen
            const code = scannerInput.value || scanBuffer;
            if (code.trim().length > 0) {
                handleScan(code.trim());
            }
            scannerInput.value = '';
            scanBuffer = '';
            clearTimeout(scanTimeout);
        } else if (e.key.length === 1) {
            scanBuffer += e.key;
            clearTimeout(scanTimeout);
            scanTimeout = setTimeout(() => { scanBuffer = ''; }, 100);
        }
    });

    // Camera scanning is temporarily disabled; keyboard scanners remain available.
    // --- Core Logic ---
    async function handleScan(qrCodeId) {
        if (isProcessing) return;
        isProcessing = true;
        clearTimeout(successDisplayTimer);
        successDisplay = null;
        
        // UI Loading
        statusCard.classList.remove('hidden');
        statusCard.className = 'glass-card status-card idle';
        statusIcon.innerHTML = '<span class="icon">⏳</span>';
        statusTitle.textContent = '處理中...';
        statusMessage.textContent = '正在驗證您的身分';
        userInfo.classList.add('hidden');

        try {
            let eventId = null;
            let targetSection = null;
            let targetGroup = null;
            let targetUnit = null;

            if (currentMode === '成主課程' || currentMode === '特別聚會') {
                eventId = eventSelect.value ? parseInt(eventSelect.value) : null;
                // Validation already happened on the selection page, but we keep it safe
            } else if (currentMode === '牧區小組聚會') {
                targetSection = sectionSelect.value;
                targetGroup = groupSelect.value;
            } else if (currentMode === '同工打卡') {
                targetUnit = unitSelect ? unitSelect.value : null;
            }

            // Call Backend API
            const response = await fetch(checkinApi, {
                method: 'POST',
                headers: checkinHeaders,
                body: JSON.stringify({
                    qr_code_id: qrCodeId,
                    mode: currentMode,
                    event_id: eventId,
                    target_section: targetSection,
                    target_group: targetGroup,
                    target_unit: targetUnit
                })
            });

            if (response.redirected) throw new Error('登入已逾時，請重新整理頁面後登入。');
            const data = await response.json();

            if (data.success) {
                showSuccess(data.member);
            } else {
                showError(data.message);
            }
        } catch (error) {
            showError(error.message.includes('登入') ? error.message : "網路連線錯誤，請稍後再試。");
            console.error(error);
        }
    }

    function showSuccess(member) {
        statusCard.className = 'glass-card status-card success';
        statusIcon.innerHTML = '<span class="icon">✅</span>';
        statusTitle.textContent = '報到成功';
        const serviceLabels = { '第一堂': '第一堂崇拜', '第二堂': '第二堂崇拜', '晚崇拜': '晚崇拜' };
        statusMessage.textContent = serviceLabels[member.status] || member.status || `${currentMode} 已完成紀錄`;

        userSection.textContent = member.section || '無牧區';
        userGroup.textContent = member.family1 || '無小組';
        
        userName.textContent = member.name;
        
        userInfo.classList.remove('hidden');
        
        playCheckinFeedback();
        if (currentMode === '主日聚會') {
            statusCard.classList.add('sunday-success');
            isProcessing = false;
            successDisplay = new Promise(resolve => {
                successDisplayTimer = setTimeout(() => {
                    successDisplay = null;
                    if (!isProcessing) resetStatus();
                    resolve();
                }, 3000);
            });
        } else {
            setTimeout(resetStatus, 2000);
        }
    }

    function showError(message) {
        statusCard.className = 'glass-card status-card error';
        statusIcon.innerHTML = '<span class="icon">❌</span>';
        statusTitle.textContent = '報到失敗';
        statusMessage.textContent = message;
        userInfo.classList.add('hidden');
        
        soundError.currentTime = 0;
        soundError.play().catch(e => console.log('Audio play failed:', e));
        setTimeout(resetStatus, 2000);
    }

    function resetStatus() {
        isProcessing = false;
        statusCard.className = 'glass-card status-card idle';
        statusIcon.innerHTML = '<span class="icon">✨</span>';
        statusTitle.textContent = '等待掃描中...';
        statusMessage.textContent = '請使用條碼掃描器掃描您的專屬 QR Code';
        userInfo.classList.add('hidden');
        statusCard.classList.remove('hidden');
    }

    // --- Check-in feedback settings ---
    const feedbackKey = 'beimen-checkin-recordings';
    const recordingLimit = 500000;
    let feedback = { mode: 'bell', clips: [] };
    let nextClip = 0;
    const recordedAudio = new Audio();
    try {
        const saved = JSON.parse(localStorage.getItem(feedbackKey));
        if (saved && ['silent', 'bell', 'recorded'].includes(saved.mode) && Array.isArray(saved.clips)) {
            feedback = { mode: saved.mode, clips: saved.clips.slice(0, 5) };
        }
    } catch {
        // Browser storage may be unavailable.
    }

    function playCheckinFeedback() {
        recordedAudio.pause();
        soundSuccess.pause();
        soundSuccess.currentTime = 0;
        if (feedback.mode === 'silent') return;
        if (feedback.mode === 'bell') {
            soundSuccess.play().catch(error => console.log('Audio play failed:', error));
            return;
        }
        const clips = feedback.clips.filter(Boolean);
        if (!clips.length) return;
        recordedAudio.src = clips[nextClip].data;
        nextClip = (nextClip + 1) % clips.length;
        recordedAudio.play().catch(error => console.log('Recording play failed:', error));
    }

    const feedbackButton = document.createElement('button');
    feedbackButton.type = 'button';
    feedbackButton.className = 'icon-btn';
    feedbackButton.id = 'feedback-settings-btn';
    feedbackButton.title = '報到音效設定';
    feedbackButton.setAttribute('aria-label', feedbackButton.title);
    feedbackButton.setAttribute('aria-haspopup', 'dialog');
    feedbackButton.textContent = '⚙';
    document.getElementById('fullscreen-btn').before(feedbackButton);

    const feedbackDialog = document.createElement('dialog');
    feedbackDialog.className = 'feedback-dialog';
    feedbackDialog.setAttribute('aria-labelledby', 'feedback-settings-title');
    feedbackDialog.innerHTML = `
        <form method="dialog">
            <h2 id="feedback-settings-title">報到音效設定</h2>
            <label for="feedback-mode">報到成功音效</label>
            <select id="feedback-mode">
                <option value="silent">無聲</option>
                <option value="bell">原始鈴聲</option>
                <option value="recorded">自行錄製</option>
            </select>
            <fieldset>
                <legend>錄音（最多 5 段）</legend>
                <p>每位報到成功播放一段，依序輪播。每段音檔上限 500 KB。</p>
                <p data-mic-help>目前的瀏覽器或網址無法使用麥克風，可上傳已錄好的音檔。</p>
                ${Array.from({ length: 5 }, (_, index) => `
                    <div class="feedback-clip">
                        <label>第 ${index + 1} 段 <input type="file" accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm"></label>
                        <span data-clip-name></span>
                        <button type="button" data-record>錄音</button>
                        <button type="button" data-preview>試聽</button>
                        <button type="button" data-remove>移除</button>
                    </div>`).join('')}
            </fieldset>
            <p class="feedback-settings-status" role="status"></p>
            <div class="feedback-actions">
                <button type="button" data-cancel>取消</button>
                <button type="submit">儲存</button>
            </div>
        </form>`;
    document.body.append(feedbackDialog);

    const feedbackForm = feedbackDialog.querySelector('form');
    const feedbackSelect = feedbackDialog.querySelector('select');
    const feedbackFieldset = feedbackDialog.querySelector('fieldset');
    const feedbackStatus = feedbackDialog.querySelector('[role="status"]');
    const rows = [...feedbackDialog.querySelectorAll('.feedback-clip')];
    const canRecord = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
    const preview = new Audio();
    let draft = [];
    let recording = null;
    let pending = false;
    let editSession = 0;

    function refreshFeedback() {
        feedbackFieldset.disabled = feedbackSelect.value !== 'recorded';
        feedbackDialog.querySelector('[type="submit"]').disabled = Boolean(recording || pending);
        rows.forEach((row, index) => {
            const active = recording?.index === index;
            row.querySelector('[data-clip-name]').textContent = draft[index]?.name || '尚未設定';
            const recordButton = row.querySelector('[data-record]');
            recordButton.hidden = !canRecord;
            recordButton.textContent = active ? '停止錄音' : '錄音';
            recordButton.disabled = pending || Boolean(recording && !active);
            row.querySelector('input').disabled = Boolean(recording || pending);
            row.querySelector('[data-preview]').disabled = !draft[index] || Boolean(recording || pending);
            row.querySelector('[data-remove]').disabled = !draft[index] || Boolean(recording || pending);
        });
    }

    async function loadClip(index, file, name, session) {
        if (session !== editSession) return;
        if (file.size === 0 || file.size > recordingLimit) {
            feedbackStatus.textContent = '請使用非空白且不超過 500 KB 的音檔。';
            return;
        }
        pending = true;
        refreshFeedback();
        try {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            if (session === editSession) {
                draft[index] = { name, data };
                feedbackStatus.textContent = '';
            }
        } catch {
            if (session === editSession) feedbackStatus.textContent = '無法讀取這段音檔。';
        } finally {
            if (session === editSession) {
                pending = false;
                refreshFeedback();
            }
        }
    }

    feedbackDialog.querySelector('[data-mic-help]').hidden = canRecord;
    rows.forEach((row, index) => {
        const input = row.querySelector('input');
        input.addEventListener('change', () => {
            const file = input.files[0];
            if (file) loadClip(index, file, file.name, editSession);
            input.value = '';
        });
        row.querySelector('[data-preview]').addEventListener('click', () => {
            preview.src = draft[index].data;
            preview.play().catch(() => { feedbackStatus.textContent = '無法播放這段音檔。'; });
        });
        row.querySelector('[data-remove]').addEventListener('click', () => {
            draft[index] = null;
            refreshFeedback();
        });
        row.querySelector('[data-record]').addEventListener('click', async () => {
            if (recording) {
                if (recording.recorder.state !== 'inactive') recording.recorder.stop();
                return;
            }
            const session = editSession;
            let stream;
            pending = true;
            refreshFeedback();
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (session !== editSession) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                preview.pause();
                const recorder = new MediaRecorder(stream);
                const chunks = [];
                recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
                const timer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 15000);
                recorder.addEventListener('stop', () => {
                    clearTimeout(timer);
                    stream.getTracks().forEach(track => track.stop());
                    if (session !== editSession) return;
                    recording = null;
                    loadClip(index, new Blob(chunks, { type: recorder.mimeType }), `麥克風錄音 ${index + 1}`, session);
                    refreshFeedback();
                });
                recorder.start();
                recording = { index, recorder, stream };
                feedbackStatus.textContent = '錄音中，最長 15 秒。';
            } catch {
                stream?.getTracks().forEach(track => track.stop());
                if (session === editSession) feedbackStatus.textContent = '無法使用麥克風，可改為上傳音檔。';
            } finally {
                if (session === editSession) {
                    pending = false;
                    refreshFeedback();
                }
            }
        });
    });

    feedbackButton.addEventListener('click', () => {
        editSession++;
        draft = [...feedback.clips];
        feedbackSelect.value = feedback.mode;
        feedbackStatus.textContent = '';
        refreshFeedback();
        feedbackDialog.showModal();
    });
    feedbackSelect.addEventListener('change', () => {
        if (recording && recording.recorder.state !== 'inactive') recording.recorder.stop();
        refreshFeedback();
    });
    feedbackDialog.querySelector('[data-cancel]').addEventListener('click', () => feedbackDialog.close());
    feedbackDialog.addEventListener('close', () => {
        editSession++;
        preview.pause();
        if (recording) {
            if (recording.recorder.state !== 'inactive') recording.recorder.stop();
            recording.stream.getTracks().forEach(track => track.stop());
        }
        recording = null;
        pending = false;
    });
    feedbackForm.addEventListener('submit', event => {
        event.preventDefault();
        if (pending || recording) return;
        const mode = feedbackSelect.value;
        if (mode === 'recorded' && !draft.some(Boolean)) {
            feedbackStatus.textContent = '請至少加入一段錄音。';
            return;
        }
        const updated = { mode, clips: draft };
        try {
            localStorage.setItem(feedbackKey, JSON.stringify(updated));
        } catch {
            feedbackStatus.textContent = '儲存失敗，請試著縮短音檔或減少錄音段數。';
            return;
        }
        feedback = updated;
        nextClip = 0;
        feedbackDialog.close();
    });

    // --- Fullscreen Logic ---
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    async function enterFullscreen() {
        if (!document.fullscreenElement && document.fullscreenEnabled) {
            try {
                await document.documentElement.requestFullscreen();
            } catch {
                // Direct navigation may require a gesture on this page.
            }
        }
    }

    fullscreenBtn?.addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else {
            enterFullscreen();
        }
    });

    // --- Manual Search Logic ---
    const btnManualSearch = document.getElementById('btn-manual-search');
    const inputManualSearch = document.getElementById('manual-search-input');
    const selectMemberModal = document.getElementById('select-member-modal');
    const memberSelectList = document.getElementById('member-select-list');

    window.closeSelectMemberModal = function() {
        selectMemberModal.style.display = 'none';
        isProcessing = false;
        resetStatus();
    };

    if (btnManualSearch && inputManualSearch) {
        btnManualSearch.addEventListener('click', () => {
            const keyword = inputManualSearch.value.trim();
            if (keyword) handleManualSearch(keyword);
        });
        inputManualSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const keyword = inputManualSearch.value.trim();
                if (keyword) handleManualSearch(keyword);
            }
        });
    }

    async function handleManualSearch(keyword) {
        if (isProcessing) return;
        isProcessing = true;
        if (successDisplay) await successDisplay;
        
        statusCard.classList.remove('hidden');
        statusCard.className = 'glass-card status-card idle';
        statusIcon.innerHTML = '<span class="icon">⏳</span>';
        statusTitle.textContent = '搜尋中...';
        statusMessage.textContent = '正在尋找您的資料';
        userInfo.classList.add('hidden');

        try {
            let eventId = null;
            let targetSection = null;
            let targetGroup = null;
            let targetUnit = null;

            if (currentMode === '成主課程' || currentMode === '特別聚會') {
                eventId = eventSelect.value ? parseInt(eventSelect.value) : null;
            } else if (currentMode === '牧區小組聚會') {
                targetSection = sectionSelect.value;
                targetGroup = groupSelect.value;
            } else if (currentMode === '同工打卡') {
                targetUnit = unitSelect ? unitSelect.value : null;
            }

            const response = await fetch(checkinApi, {
                method: 'POST',
                headers: checkinHeaders,
                body: JSON.stringify({
                    qr_code_id: keyword,
                    is_manual_search: true,
                    mode: currentMode,
                    event_id: eventId,
                    target_section: targetSection,
                    target_group: targetGroup,
                    target_unit: targetUnit
                })
            });

            if (response.redirected) throw new Error('登入已逾時，請重新整理頁面後登入。');
            const data = await response.json();

            if (data.multiple) {
                // Show modal to select person
                memberSelectList.innerHTML = '';
                data.matches.forEach(m => {
                    const btn = document.createElement('button');
                    btn.className = 'btn primary';
                    btn.style.textAlign = 'left';
                    btn.style.padding = '15px';
                    btn.style.display = 'flex';
                    btn.style.flexDirection = 'column';
                    const name = document.createElement('strong');
                    name.style.fontSize = '1.1rem';
                    name.textContent = m.name;
                    const detail = document.createElement('span');
                    detail.style.cssText = 'font-size:0.9rem;opacity:0.8';
                    detail.textContent = `${m.section || '無牧區'} / ${m.family1 || '無小組'}`;
                    btn.append(name, detail);
                    btn.onclick = () => {
                        selectMemberModal.style.display = 'none';
                        isProcessing = false;
                        // Use raw church_id for standard checkin scan logic
                        handleScan(String(m.church_id));
                    };
                    memberSelectList.appendChild(btn);
                });
                selectMemberModal.style.display = 'block';
            } else if (data.success) {
                showSuccess(data.member);
                inputManualSearch.value = '';
            } else {
                showError(data.message);
            }
        } catch (error) {
            showError(error.message.includes('登入') ? error.message : "網路連線錯誤，請稍後再試。");
            console.error(error);
        }
    }

    if (sundayOnly) {
        proceedWithCategory('主日聚會');
        enterFullscreen();
        document.addEventListener('click', event => {
            if (event.target.closest('a, #fullscreen-btn, #btn-home, #feedback-settings-btn')) return;
            enterFullscreen();
        }, { once: true });
        document.getElementById('btn-home').style.display = 'flex';
        document.title = '主日聚會報到 - 北門報到系統';
    }
});
