document.addEventListener('DOMContentLoaded', async () => {
    // --- Sidebar controls ---
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarStorageKey = 'beimen-admin-sidebar-collapsed';
    let sidebarCollapsed = window.matchMedia('(max-width: 767px)').matches;
    try {
        const saved = localStorage.getItem(sidebarStorageKey);
        if (!window.matchMedia('(max-width: 767px)').matches && saved !== null) sidebarCollapsed = saved === 'true';
    } catch {}
    function updateSidebar() {
        sidebar.classList.toggle('is-collapsed', sidebarCollapsed);
        sidebarToggle.setAttribute('aria-expanded', String(!sidebarCollapsed));
        sidebarToggle.setAttribute('aria-label', sidebarCollapsed ? '展開功能選單' : '收合功能選單');
        sidebarToggle.title = sidebarCollapsed ? '展開功能選單' : '收合功能選單';
        sidebarToggle.textContent = sidebarCollapsed ? '☰' : '‹';
    }
    sidebarToggle.addEventListener('click', () => {
        sidebarCollapsed = !sidebarCollapsed;
        updateSidebar();
        try { localStorage.setItem(sidebarStorageKey, String(sidebarCollapsed)); } catch {}
    });
    sidebar.querySelectorAll('.nav-btn').forEach(button => {
        button.title = button.textContent.trim();
        button.setAttribute('aria-label', button.textContent.trim());
        button.addEventListener('click', () => {
            if (window.matchMedia('(max-width: 767px)').matches) {
                sidebarCollapsed = true;
                updateSidebar();
            }
        });
    });
    updateSidebar();

    // --- Auth Check ---
    const checkRes = await fetch('api/login.php?action=check', { cache: 'no-store' });
    const checkData = await checkRes.json();
    if (!checkData.success) {
        window.location.replace('http://192.168.16.240:8033/official-login.php?v=20261027-login-return');
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
            if (target === 'sunday-records') { const url = new URL('/sunday/records/', window.location.href); if (window.location.port === '8033') url.port = '8022'; document.getElementById('sunday-records-frame').src = url.href; }
            if (target === 'events') loadEvents();
            if (target === 'employees') loadEmployees();
            if (target === 'contacts') { fetchSections(); searchContacts(); }
        });
    });

    // Initialize
    document.getElementById('filter-date-start').valueAsDate = new Date();
    document.getElementById('filter-date-end').valueAsDate = new Date();

    
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
            document.querySelector('.nav-btn[data-tab="sunday-records"]').click();
        }
    } else {
        document.querySelector('.nav-btn[data-tab="sunday-records"]').click();
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
    grid.replaceChildren();
    if (!res.success) return;
    res.data.forEach(evt => {
        const card = document.createElement('div'); card.className = 'card event-card';
        const badge = document.createElement('span'); badge.className = 'badge badge-primary';
        badge.textContent = evt.read_only ? '平台課程' : '特別聚會'; card.appendChild(badge);
        const title = document.createElement('h3'); title.textContent = `${evt.code ? evt.code + ' · ' : ''}${evt.name}`;
        card.appendChild(title);
        const info = document.createElement('p');
        info.textContent = `堂數：${evt.total_sessions} ｜ ${evt.read_only ? '費用請洽課程負責人' : '費用：$' + evt.price}`;
        card.appendChild(info);
        if (evt.read_only) {
            const details = document.createElement('p'); details.textContent = [evt.teachers, evt.class_time].filter(Boolean).join(' ｜ '); card.appendChild(details);
            const link = document.createElement('a'); link.className = 'btn';
            link.href = `http://192.168.16.240:26001/education/courses/${evt.platform_course_id}/`;
            link.target = '_blank'; link.rel = 'noopener'; link.textContent = '至平台查看／維護課程'; card.appendChild(link);
        } else {
            const edit = document.createElement('button'); edit.className = 'btn btn-sm'; edit.textContent = '編輯'; edit.onclick = () => editEvent(evt); card.appendChild(edit);
            const remove = document.createElement('button'); remove.className = 'btn btn-sm'; remove.textContent = '刪除'; remove.onclick = () => deleteEvent(evt.id); card.appendChild(remove);
        }
        const register = document.createElement('button'); register.className = 'btn primary';
        register.textContent = '報名管理'; register.onclick = () => openRegModal(evt.id, evt.name);
        register.style.cssText = 'width:100%;margin-top:10px'; card.appendChild(register); grid.appendChild(card);
    });
    if (!res.data.length) grid.textContent = '尚無課程或特別聚會，請到平台建立課程，或新增特別聚會。';
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
        document.getElementById('event-type').value = 'special';
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
// The platform's HR master is authoritative; this page never edits personnel.
async function loadEmployees() {
    const res = await apiCall('get_employees');
    const tbody = document.getElementById('employees-tbody');
    tbody.replaceChildren();
    if (!res.success) return;
    const select = document.getElementById('filter-emp-unit');
    const selected = select.value;
    select.replaceChildren(new Option('全部部門', ''));
    [...new Set(res.data.map(emp => emp.unit))].sort().forEach(unit => select.add(new Option(unit, unit)));
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
    const people = res.data.filter(emp => !select.value || emp.unit === select.value);
    people.forEach(emp => {
        const row = document.createElement('tr');
        for (const value of [emp.name, emp.employee_no || '—', emp.unit, emp.identity_code || '—', Number(emp.is_active) ? '在職' : '停用／離職']) {
            const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
        }
        const cell = document.createElement('td');
        const link = document.createElement('a');
        link.href = 'http://192.168.16.240:26001/eureka/staff/';
        link.target = '_blank'; link.rel = 'noopener'; link.textContent = '至平台管理';
        cell.appendChild(link); row.appendChild(cell); tbody.appendChild(row);
    });
    if (!people.length) {
        const row = document.createElement('tr'); const cell = document.createElement('td');
        cell.colSpan = 6; cell.textContent = '目前沒有符合的人事資料。'; row.appendChild(cell); tbody.appendChild(row);
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
    await fetch('api/login.php?action=logout', { cache: 'no-store' });
    window.location.replace('http://192.168.16.240:8033/official-login.php?v=20261027-login-return');
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

        if (!res.data.length) {
            const cell = tbody.insertRow().insertCell(); cell.colSpan = 24; cell.textContent = '沒有符合條件的人員資料。';
        }
        res.data.forEach(c => {
            const tr = document.createElement('tr');
            const code = (field, map) => map[c[field]] || c[field];
            const note = String(c.note || '');
            const emergency = note.match(/\[緊急聯絡人:\s*(.*?)\s*\((.*?)\)\s*([^\]]*)\]/);
            const visitors = [...note.matchAll(/[（(]訪客資訊[:：]([^）)]*)[）)]/g)].map(m => m[1].trim());
            const birth = String(c.birthday || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
            const values = [c.church_id,c.name,
                code('gender',{M:'男',m:'男',F:'女',f:'女',male:'男',female:'女'}),
                code('marriage',{m:'已婚',M:'已婚',s:'未婚',S:'未婚',yes:'已婚',no:'未婚'}),
                birth ? '民國 '+(Number(birth[1])-1911)+'/'+birth[2]+'/'+birth[3] : c.birthday,
                c.phone_h,c.phone_o,c.mobile1,c.address,c.email1,
                code('baptized',{y:'已受洗',Y:'已受洗',n:'未受洗',N:'未受洗',yes:'已受洗',no:'未受洗'}),
                c.section,c.family1,c.family_id,[c.visitor_info,...visitors].filter(Boolean).join('；'),
                emergency?.[1],emergency?.[3]?.trim(),emergency?.[2],c.note,
                String(c.join_date || '').slice(0,10),String(c.dataindate || '').slice(0,10),c.car_number,c.line_id];
            values.forEach(value => { const td=tr.insertCell(); td.textContent=value === null || value === undefined || value === '' ? '未填寫' : String(value); });
            const actions=document.createElement('td');
            const edit=document.createElement('button'); edit.className='btn btn-sm'; edit.textContent='編輯'; edit.onclick=()=>editContact(c);
            actions.append(edit); tr.insertBefore(actions,tr.children[2]); tbody.appendChild(tr);
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
