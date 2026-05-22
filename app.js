document.addEventListener('DOMContentLoaded', () => {
    // --- State & DOM Elements ---
    let currentMode = '主日聚會';
    let isProcessing = false;
    let cameraModeActive = false;
    let html5QrcodeScanner = null;

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
    const btnCamera = document.getElementById('toggle-camera');
    const readerContainer = document.getElementById('reader-container');

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
            if (pinInput.value === '47262638') {
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
        viewScan.classList.add('hidden');
        viewSelection.classList.add('hidden');
        viewHome.classList.remove('hidden');
        const btnHome = document.getElementById('btn-home');
        if (btnHome) btnHome.style.display = 'none';
        if (cameraModeActive) stopCamera();
    };

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
    fetchEvents();

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
                option.textContent = evt.name;
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

    // --- Camera Scanner Logic ---
    btnCamera.addEventListener('click', () => {
        if (!cameraModeActive) {
            startCamera();
        } else {
            stopCamera();
        }
    });

    function startCamera() {
        readerContainer.classList.remove('hidden');
        btnCamera.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        cameraModeActive = true;
        viewScan.classList.add('camera-active');
        
        statusCard.classList.add('hidden');

        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
        
        html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    }

    function stopCamera() {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear().then(() => {
                readerContainer.classList.add('hidden');
                btnCamera.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`;
                cameraModeActive = false;
                viewScan.classList.remove('camera-active');
                resetStatus();
            });
        }
    }

    function onScanSuccess(decodedText, decodedResult) {
        if (isProcessing) return;
        // Do not stop camera, let it continue scanning
        handleScan(decodedText);
    }

    function onScanFailure(error) {
        // Ignore continuous stream of failures
    }

    // --- Core Logic ---
    async function handleScan(qrCodeId) {
        if (isProcessing) return;
        isProcessing = true;
        
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
            const response = await fetch('api/checkin.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qr_code_id: qrCodeId,
                    mode: currentMode,
                    event_id: eventId,
                    target_section: targetSection,
                    target_group: targetGroup,
                    target_unit: targetUnit
                })
            });

            const data = await response.json();

            if (data.success) {
                showSuccess(data.member);
            } else {
                showError(data.message);
            }
        } catch (error) {
            showError("網路連線錯誤，請稍後再試。");
            console.error(error);
        }
    }

    function showSuccess(member) {
        statusCard.className = 'glass-card status-card success';
        statusIcon.innerHTML = '<span class="icon">✅</span>';
        statusTitle.textContent = '報到成功！';
        statusMessage.textContent = `${currentMode} 已完成紀錄`;

        userSection.textContent = member.section || '無牧區';
        userGroup.textContent = member.family1 || '無小組';
        
        if (member.status) {
            userName.innerHTML = `${member.name} <br><span style="font-size:0.8em;color:var(--primary);">${member.status}</span>`;
        } else {
            userName.textContent = member.name;
        }
        
        userInfo.classList.remove('hidden');
        
        soundSuccess.currentTime = 0;
        soundSuccess.play().catch(e => console.log('Audio play failed:', e));
        
        setTimeout(resetStatus, 2000);
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
        if (cameraModeActive) {
            statusCard.classList.add('hidden');
        } else {
            statusCard.classList.remove('hidden');
        }
    }

    // --- Fullscreen Logic ---
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });
    }

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

            const response = await fetch('api/checkin.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                    btn.innerHTML = `<strong style="font-size:1.1rem">${m.name}</strong><span style="font-size:0.9rem;opacity:0.8">${m.section || '無牧區'} / ${m.family1 || '無小組'}</span>`;
                    btn.onclick = () => {
                        selectMemberModal.style.display = 'none';
                        isProcessing = false;
                        // Use raw church_id for standard checkin scan logic
                        const paddedId = String(m.church_id).padStart(6, '0');
                        handleScan(`NG${paddedId}000`);
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
            showError("網路連線錯誤，請稍後再試。");
            console.error(error);
        }
    }

});
