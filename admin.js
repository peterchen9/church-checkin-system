document.addEventListener('DOMContentLoaded', async () => {
    // --- Auth Check ---
    const checkRes = await fetch('api/login.php?action=check');
    const checkData = await checkRes.json();
    if (!checkData.success) {
        window.location.href = 'login.html';
        return;
    }

    // --- Tabs Logic ---
    const navBtns = document.querySelectorAll('.nav-btn[data-tab]');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            navBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');
            
            if (target === 'logs') loadLogs();
            if (target === 'events') loadEvents();
            if (target === 'employees') loadEmployees();
            if (target === 'contacts') searchContacts();
        });
    });

    // Initialize
    document.getElementById('filter-date-start').valueAsDate = new Date();
    document.getElementById('filter-date-end').valueAsDate = new Date();
    fetchSections(); // Load sections for contacts
    
    // Check hash or query param to determine which tab to open
    const urlParams = new URLSearchParams(window.location.search);
    const queryTab = urlParams.get('tab');
    const hash = window.location.hash;
    
    let tabName = null;
    if (queryTab) {
        tabName = queryTab;
    } else if (hash) {
        tabName = hash.replace('#tab-', '');
    }

    if (tabName) {
        const btn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
        if (btn) {
            btn.click();
        } else {
            loadLogs();
        }
    } else {
        loadLogs();
    }
});

// --- Utility: API Call ---
async function apiCall(action, data = {}) {
    const isGet = action.startsWith('get_') || action === 'search_contacts';
    let url = 'api/admin.php';
    let options = {};

    if (isGet) {
        url += `?action=${action}`;
        for (const [key, value] of Object.entries(data)) {
            url += `&${key}=${encodeURIComponent(value)}`;
        }
    } else {
        options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data })
        };
    }

    const res = await fetch(url, options);
    const json = await res.json();
    if (!json.success && json.message) {
        alert(json.message);
    }
    return json;
}

// --- LOGS ---
async function loadLogs() {
    const start_date = document.getElementById('filter-date-start').value;
    const end_date = document.getElementById('filter-date-end').value;
    const name = document.getElementById('filter-name').value;
    
    const checkboxes = document.querySelectorAll('#filter-mode-container input[type="checkbox"]:checked');
    const modes = Array.from(checkboxes).map(cb => cb.value).join(',');
    
    const res = await apiCall('get_logs', { start_date, end_date, modes, name });
    const tbody = document.getElementById('logs-tbody');
    tbody.innerHTML = '';
    
    if (res.success) {
        res.data.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${log.checkin_time.split(' ')[1]}</td>
                <td>${log.name}</td>
                <td>${log.checkin_mode}</td>
                <td>${log.event_name || '-'}</td>
                <td><span class="badge ${log.status === '下班' ? 'badge-danger' : 'badge-primary'}">${log.status || '-'}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function exportLogsToExcel() {
    const tbody = document.getElementById('logs-tbody');
    if (tbody.rows.length === 0) return alert('沒有資料可以匯出');
    
    const wb = XLSX.utils.book_new();
    const ws_data = [['時間', '人名', '類別', '聚會/課程名稱', '狀態/堂次']];
    
    for (let i = 0; i < tbody.rows.length; i++) {
        const row = tbody.rows[i];
        ws_data.push([
            row.cells[0].innerText,
            row.cells[1].innerText,
            row.cells[2].innerText,
            row.cells[3].innerText,
            row.cells[4].innerText
        ]);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "打卡紀錄");
    XLSX.writeFile(wb, "打卡紀錄.xlsx");
}

// --- EVENTS ---
async function loadEvents() {
    const res = await apiCall('get_events');
    const grid = document.getElementById('events-grid');
    grid.innerHTML = '';
    
    if (res.success) {
        res.data.forEach(evt => {
            const card = document.createElement('div');
            card.className = 'card event-card';
            const typeLabel = evt.type === 'course' ? '成人主日學' : '特別聚會';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span class="badge badge-primary">${typeLabel}</span>
                    <div>
                        <button class="btn btn-sm" onclick='editEvent(${JSON.stringify(evt)})' style="background:var(--secondary); color:white; margin-right:5px;">編輯</button>
                        <button class="btn btn-sm" onclick="deleteEvent(${evt.id})" style="background:var(--danger); color:white;">刪除</button>
                    </div>
                </div>
                <h3 style="margin: 10px 0;">${evt.name}</h3>
                <p>堂數: ${evt.total_sessions} | 費用: $${evt.price}</p>
                <button class="btn primary" style="width:100%; margin-top:10px;" onclick="openRegModal(${evt.id}, '${evt.name}')">報名管理</button>
            `;
            grid.appendChild(card);
        });
    }
}

let currentEventId = null;
function openEventModal(evt = null) { 
    if (evt) {
        currentEventId = evt.id;
        document.getElementById('event-type').value = evt.type;
        document.getElementById('event-name').value = evt.name;
        document.getElementById('event-sessions').value = evt.total_sessions;
        document.getElementById('event-price').value = evt.price;
    } else {
        currentEventId = null;
        document.getElementById('event-type').value = 'course';
        document.getElementById('event-name').value = '';
        document.getElementById('event-sessions').value = 1;
        document.getElementById('event-price').value = 0;
    }
    document.getElementById('event-modal').style.display = 'block'; 
}
function editEvent(evt) {
    openEventModal(evt);
}
function closeEventModal() { document.getElementById('event-modal').style.display = 'none'; }
async function saveEvent() {
    const type = document.getElementById('event-type').value;
    const name = document.getElementById('event-name').value;
    const total_sessions = document.getElementById('event-sessions').value;
    const price = document.getElementById('event-price').value;
    
    if (!name) return alert('請輸入名稱');
    
    const action = currentEventId ? 'update_event' : 'add_event';
    const payload = { type, name, total_sessions, price };
    if (currentEventId) payload.id = currentEventId;

    const res = await apiCall(action, payload);
    if (res.success) {
        closeEventModal();
        loadEvents();
    }
}
async function deleteEvent(id) {
    if (confirm('確定要刪除嗎？相關報名資料也會一併刪除！')) {
        await apiCall('delete_event', { id });
        loadEvents();
    }
}

// --- REGISTRATIONS ---
function openRegModal(eventId, eventName) {
    document.getElementById('reg-title').textContent = `${eventName} - 報名清單`;
    document.getElementById('current-reg-event-id').value = eventId;
    document.getElementById('reg-modal').style.display = 'block';
    loadRegistrations(eventId);
}
function closeRegModal() { document.getElementById('reg-modal').style.display = 'none'; }

async function loadRegistrations(eventId) {
    const res = await apiCall('get_registrations', { event_id: eventId });
    const tbody = document.getElementById('regs-tbody');
    tbody.innerHTML = '';
    
    if (res.success) {
        res.data.forEach(reg => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${reg.name}</td>
                <td>${reg.created_at.split(' ')[0]}</td>
                <td>
                    <input type="checkbox" ${reg.is_paid ? 'checked' : ''} onchange="updatePayment(${reg.id}, this.checked)">
                    ${reg.is_paid ? '<span style="color:green">已繳</span>' : '<span style="color:red">未繳</span>'}
                </td>
                <td>${reg.paid_at || '-'}</td>
                <td>${reg.attend_count} / ${reg.total_sessions} (${Math.round((reg.attend_count / reg.total_sessions) * 100)}%)</td>
                <td><button class="btn btn-sm" onclick="deleteRegistration(${reg.id})" style="background:var(--danger); color:white;">移除</button></td>
            `;
            tbody.appendChild(tr);
        });
    }
}

async function addRegistration() {
    const eventId = document.getElementById('current-reg-event-id').value;
    const input = document.getElementById('reg-input').value;
    
    if (!input) return alert('請輸入或掃描');
    
    const res = await apiCall('add_registration', { event_id: eventId, input });
    if (res.success) {
        document.getElementById('reg-input').value = '';
        loadRegistrations(eventId);
    }
}
// Handle fast barcode scanning on input
document.getElementById('reg-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addRegistration();
});

async function updatePayment(id, isPaid) {
    const res = await apiCall('update_payment', { id, is_paid: isPaid });
    if (res.success) loadRegistrations(document.getElementById('current-reg-event-id').value);
}

async function deleteRegistration(id) {
    if (confirm('確定移除報名嗎？')) {
        await apiCall('delete_registration', { id });
        loadRegistrations(document.getElementById('current-reg-event-id').value);
    }
}

// --- EMPLOYEES ---
async function loadEmployees() {
    const res = await apiCall('get_employees');
    const tbody = document.getElementById('employees-tbody');
    tbody.innerHTML = '';
    
    if (res.success) {
        const filterUnit = document.getElementById('filter-emp-unit').value;
        let filteredData = res.data;
        if (filterUnit) {
            filteredData = res.data.filter(emp => emp.unit === filterUnit);
        }

        const grouped = {};
        filteredData.forEach(emp => {
            const unit = emp.unit || '未分配單位';
            if (!grouped[unit]) grouped[unit] = [];
            grouped[unit].push(emp);
        });

        for (const unit in grouped) {
            const unitTr = document.createElement('tr');
            unitTr.innerHTML = `<td colspan="6" style="background: var(--bg-light); font-weight: bold; text-align: center; font-size: 1.1em; color: var(--primary);">${unit}</td>`;
            tbody.appendChild(unitTr);

            grouped[unit].forEach(emp => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${emp.name}</td>
                    <td>${emp.unit || '-'}</td>
                    <td>${emp.title}</td>
                    <td>${emp.position}</td>
                    <td>${emp.emp_type}</td>
                    <td>
                        <button class="btn btn-sm" onclick='editEmployee(${JSON.stringify(emp).replace(/'/g, "&#39;")})' style="background:var(--secondary); color:white;">編輯</button>
                        <button class="btn btn-sm" onclick="deleteEmployee(${emp.id})" style="background:var(--danger); color:white;">移除</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
}

let currentEmployeeId = null;
function openEmployeeModal(emp = null) { 
    if (emp) {
        currentEmployeeId = emp.id;
        document.getElementById('emp-name').value = emp.name;
        document.getElementById('emp-name').disabled = true; // Cannot edit name/church_id
        document.getElementById('emp-title').value = emp.title;
        document.getElementById('emp-position').value = emp.position;
        document.getElementById('emp-type').value = emp.emp_type;
        document.getElementById('emp-unit').value = emp.unit || '新竹北門聖教會';
    } else {
        currentEmployeeId = null;
        document.getElementById('emp-name').value = '';
        document.getElementById('emp-name').disabled = false;
        document.getElementById('emp-title').value = '';
        document.getElementById('emp-position').value = '';
        document.getElementById('emp-type').value = '全職';
        document.getElementById('emp-unit').value = '新竹北門聖教會';
    }
    document.getElementById('employee-modal').style.display = 'block'; 
}
function editEmployee(emp) { openEmployeeModal(emp); }
function closeEmployeeModal() { document.getElementById('employee-modal').style.display = 'none'; }
async function saveEmployee() {
    const name = document.getElementById('emp-name').value;
    const title = document.getElementById('emp-title').value;
    const position = document.getElementById('emp-position').value;
    const emp_type = document.getElementById('emp-type').value;
    const unit = document.getElementById('emp-unit').value;
    
    if (!name && !currentEmployeeId) return alert('請輸入會友名字');
    
    const action = currentEmployeeId ? 'update_employee' : 'add_employee';
    const payload = { name, title, position, emp_type, unit };
    if (currentEmployeeId) payload.id = currentEmployeeId;

    const res = await apiCall(action, payload);
    if (res.success) {
        closeEmployeeModal();
        loadEmployees();
    }
}
async function logout() {
    await fetch('api/login.php?action=logout');
    window.location.href = 'login.html';
}
async function deleteEmployee(id) {
    if (confirm('確定移除此員工設定嗎？')) {
        await apiCall('delete_employee', { id });
        loadEmployees();
    }
}

// --- CONTACTS ---
let allSectionsData = {};

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
    const sectionSelect = document.getElementById('filter-contact-section');
    if (!sectionSelect) return;
    sectionSelect.innerHTML = '<option value="">選擇牧區...</option>';
    for (const sec in allSectionsData) {
        const option = document.createElement('option');
        option.value = sec;
        option.textContent = sec;
        sectionSelect.appendChild(option);
    }
}

const contactSectionSelect = document.getElementById('filter-contact-section');
const contactGroupSelect = document.getElementById('filter-contact-group');
if (contactSectionSelect) {
    contactSectionSelect.addEventListener('change', () => {
        const selectedSec = contactSectionSelect.value;
        contactGroupSelect.innerHTML = '<option value="">選擇小組...</option>';
        if (selectedSec && allSectionsData[selectedSec]) {
            const allOption = document.createElement('option');
            allOption.value = '全小組';
            allOption.textContent = '全小組';
            contactGroupSelect.appendChild(allOption);
            
            allSectionsData[selectedSec].forEach(grp => {
                const option = document.createElement('option');
                option.value = grp;
                option.textContent = grp;
                contactGroupSelect.appendChild(option);
            });
        }
    });
}

let currentContactPage = 1;
let totalContactPages = 1;

async function searchContacts(resetPage = true) {
    if (resetPage) currentContactPage = 1;
    const keyword = document.getElementById('contact-keyword').value;
    const section = document.getElementById('filter-contact-section').value;
    const group = document.getElementById('filter-contact-group').value;
    const res = await apiCall('search_contacts', { keyword, section, group, page: currentContactPage });
    const tbody = document.getElementById('contacts-tbody');
    tbody.innerHTML = '';
    
    if (res.success) {
        totalContactPages = res.total_pages || 1;
        document.getElementById('contact-page-info').textContent = `第 ${currentContactPage} 頁 / 共 ${totalContactPages} 頁`;
        
        document.getElementById('contact-prev-btn').disabled = currentContactPage <= 1;
        document.getElementById('contact-next-btn').disabled = currentContactPage >= totalContactPages;

        res.data.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.church_id}</td>
                <td>${c.name}</td>
                <td>${c.gender || '-'}</td>
                <td>${c.phone_num || '-'}</td>
                <td>${c.section || '-'}/${c.family1 || '-'}</td>
                <td>
                    <button class="btn btn-sm" onclick='editContact(${JSON.stringify(c).replace(/'/g, "&apos;")})' style="background:var(--secondary); color:white; margin-right:5px;">👁️ 檢視/編輯</button>
                    <button class="btn btn-sm" onclick="printQRCode('${c.church_id}', '${c.name}')" style="background:var(--primary); color:white; margin-right:5px;">🖨️ 列印</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function changeContactPage(delta) {
    const newPage = currentContactPage + delta;
    if (newPage >= 1 && newPage <= totalContactPages) {
        currentContactPage = newPage;
        searchContacts(false);
    }
}

function openContactModal() {
    window.location.href = 'contact_form.html';
}

function editContact(contact) {
    window.location.href = 'contact_form.html?id=' + contact.church_id;
}

// Global modal close on outside click
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    });
}

// --- PRINT QR CODE ---
let qrcodeInstance = null;
function printQRCode(churchId, name) {
    document.getElementById('print-name').textContent = name;
    document.getElementById('print-church-id').textContent = '編號: ' + churchId;
    
    const qrContainer = document.getElementById('print-qrcode');
    qrContainer.innerHTML = ''; // clear previous
    
    // Checkin system uses NG + 6-digit church_id + 000 format, or just raw church_id?
    // In checkin.php: preg_match('/^NG(\d{6})\d{3}$/i', $qr_code_id, $matches)
    // To be safe, we can generate NG + padded church_id + 000. Let's pad it to 6 digits.
    const paddedId = String(churchId).padStart(6, '0');
    const fullQrText = `NG${paddedId}000`;

    qrcodeInstance = new QRCode(qrContainer, {
        text: fullQrText,
        width: 100,
        height: 100,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });

    // Wait slightly for QR code to render before printing
    setTimeout(() => {
        window.print();
    }, 500);
}
