const scriptURL = "https://script.google.com/macros/s/AKfycbwTreMfsLHYUq7TEW8nu7brQKyuLL-ALyRRa4pdzNFopY-TlRg4UXo3Ei4AVLk-KOv0/exec";
const CACHE_KEY = "c2tech_machines_data_v3"; // เปลี่ยน Key Cache เพื่อรีเซ็ตของเก่า
let machines = [];
let rejectedMachines = [];
let histories = []; // เพิ่มตัวแปรเก็บประวัติ
let currentView = 'all';
let trialStatusQuickFilter = 'all'; // 'all' | 'In Progress' -- ใช้ตอนคลิกจากการ์ด TEST เพื่อกรองเฉพาะเครื่องที่กำลังทดลองอยู่
let currentLang = localStorage.getItem('c2_lang') || 'th';
let searchTimeout;

// --- ระบบ Admin Login สำหรับปลดล็อกการเพิ่มข้อมูล ---
let isAdmin = false;
let adminPasswordCache = ''; // เก็บรหัสไว้ใน memory เท่านั้น (ไม่ persist) เพื่อส่งให้ backend เช็คซ้ำทุกครั้งที่แก้ไขข้อมูล
const _0x1a2b = "MTkwOTE1MTI="; // เก็บรหัสแบบ base64 (เหมือนระบบ Service Tracker)

async function adminAuth() {
    if (isAdmin) {
        isAdmin = false;
        adminPasswordCache = '';
        updateLockIcons();
        Toast.fire({ icon: 'info', title: 'ออกจากระบบ Admin แล้ว' });
        return;
    }

    const { value: password } = await Swal.fire({
        title: 'Admin Access',
        input: 'password',
        inputLabel: 'กรุณาใส่รหัสผ่านเพื่อเพิ่มข้อมูล',
        inputPlaceholder: 'Password',
        confirmButtonColor: '#1b4332',
        showCancelButton: true,
        cancelButtonText: 'ยกเลิก'
    });

    if (password === undefined) return; // กดยกเลิก

    if (btoa(password) === _0x1a2b) {
        isAdmin = true;
        adminPasswordCache = password;
        updateLockIcons();
        Toast.fire({ icon: 'success', title: 'ยินดีต้อนรับ Admin' });
    } else if (password) {
        Swal.fire({ icon: 'error', title: 'รหัสผ่านไม่ถูกต้อง' });
    }
}

function updateLockIcons() {
    document.querySelectorAll('.admin-login-btn').forEach(icon => {
        icon.className = isAdmin ? 'fas fa-lock-open admin-login-btn active' : 'fas fa-lock admin-login-btn';
    });
    const adminBtnText = document.getElementById('adminBtnText');
    if (adminBtnText) adminBtnText.innerText = isAdmin ? 'ออกจากระบบ Admin' : 'Admin Login';
}

const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

const i18n = {
    th: {
        menu: "เมนู", overview: "ภาพรวมระบบ", refresh: "รีเฟรชข้อมูล", mainTitle: "เครื่องทั้งหมด",
        rejectedTitle: "ประวัติการทดลอง",
        search: "ค้นหา S/N, ลูกค้า, โหมด...", allClients: "-- ลูกค้าทั้งหมด --", reset: "ล้างค่าการค้นหา",
        total: "รวม", unit: "เครื่อง", updated: "อัปเดตเมื่อ:", days: "วัน",
        cols: ["S/N Analyzer", "S/N Edge", "Model", "ลูกค้า", "สถานที่", "Mode", "ประเภท", "สถานะ", "ส่งมอบ", "ระยะเวลา"],
        rejectedCols: ["ชื่อโรงสี/ลูกค้า", "S/N Analyzer", "Model", "Mode", "จังหวัด", "วันเริ่มทดลอง", "วันสิ้นสุดทดลอง", "รวมระยะเวลา", "สถานะทดลอง", "ผลลัพธ์"],
        rejectedColsCompact: ["ชื่อโรงสี/ลูกค้า", "S/N Analyzer", "Model", "Mode", "จังหวัด", "วันเริ่มทดลอง", "รวมระยะเวลา"],
        resultOptions: { all: "-- ผลลัพธ์ทั้งหมด --", Pending: "รอพิจารณา", Bought: "ซื้อ", "Not Bought": "ไม่ซื้อ" },
        stats: ["Lab ทั้งหมด", "Real-time ทั้งหมด", "ในคลัง (Stock)", "ส่งซ่อม (Broken)", "เครื่องเทส (TEST)"],
        msg: { loading: "กำลังซิงค์ข้อมูล", syncSuccess: "ข้อมูลล่าสุดแล้ว", langChange: "เปลี่ยนเป็นภาษาไทย" },
        clients: {}
    },
    en: {
        menu: "Menu", overview: "System Overview", refresh: "Refresh Data", mainTitle: "All Machines",
        rejectedTitle: "Trial History",
        search: "Search S/N, Client, Mode...", allClients: "-- All Clients --", reset: "Clear Filters",
        total: "Total", unit: "units", updated: "Updated at:", days: "days",
        cols: ["S/N Analyzer", "S/N Edge", "Model", "Client", "Location", "Mode", "Type", "Status", "Delivery", "Period"],
        rejectedCols: ["Customer/Client", "S/N Analyzer", "Model", "Mode", "Province", "Start Date", "End Date", "Total Period", "Trial Status", "Result"],
        rejectedColsCompact: ["Customer/Client", "S/N Analyzer", "Model", "Mode", "Province", "Start Date", "Total Period"],
        resultOptions: { all: "-- All Results --", Pending: "Pending", Bought: "Bought", "Not Bought": "Not Bought" },
        stats: ["Total Lab", "Total Real-time", "In Stock", "Broken/Repair", "Test Units"],
        msg: { loading: "Syncing Data", syncSuccess: "Data Updated", langChange: "Switched to English" },
        clients: { "ตัวอย่าง": "Tua-Yang" }
    }
};

window.onload = () => {
    setLanguage(currentLang, true);
    loadFromCache();
    fetchData();
};

// คำนวณคอลัมน์ที่ควรแสดงในตาราง ตาม view ปัจจุบัน + ตัวกรองสถานะทดลอง (ถ้ามาจากการ์ด TEST จะใช้คอลัมน์แบบย่อ)
function getActiveCols(lang) {
    if (currentView !== 'all') {
        return trialStatusQuickFilter === 'In Progress' ? i18n[lang].rejectedColsCompact : i18n[lang].rejectedCols;
    }
    return i18n[lang].cols;
}

function setLanguage(lang, silent = false) {
    currentLang = lang;
    localStorage.setItem('c2_lang', lang);

    document.querySelectorAll('.lang-btn, .mobile-lang-btn').forEach(b => b.classList.remove('active'));
    if (document.getElementById(`btn-${lang}`)) document.getElementById(`btn-${lang}`).classList.add('active');
    if (document.getElementById(`m-btn-${lang}`)) document.getElementById(`m-btn-${lang}`).classList.add('active');

    document.getElementById('m-menu-text').innerText = i18n[lang].menu;
    document.getElementById('nav-label-ov').innerHTML = `<i class="fas fa-chart-pie"></i> ${i18n[lang].overview}`;
    document.getElementById('refresh-btn').innerHTML = `<i class="fas fa-sync-alt"></i> ${i18n[lang].refresh}`;

    document.getElementById('main-title').innerText = currentView === 'all' ? i18n[lang].mainTitle : i18n[lang].rejectedTitle;
    document.getElementById('searchInput').placeholder = i18n[lang].search;
    document.getElementById('reset-btn').innerHTML = `<i class="fas fa-undo"></i> ${i18n[lang].reset}`;

    const activeCols = getActiveCols(lang);
    document.querySelector('#tableHead tr').innerHTML = activeCols.map(c => `<th>${c}</th>`).join('');

    updateResultFilterOptions(lang);

    updateClientDropdown();
    updateStats();
    renderTable();

    if (!silent) Toast.fire({ icon: 'info', title: i18n[lang].msg.langChange });
}

function translateClient(name) {
    if (!name || name === "-") return "-";
    return (currentLang === 'en' && i18n.en.clients[name]) ? i18n.en.clients[name] : name;
}

// อัปเดตตัวเลือกใน resultFilter dropdown ให้เป็นภาษาที่เลือก (เดิม dropdown นี้ hardcode เป็นภาษาไทยอย่างเดียว)
function updateResultFilterOptions(lang) {
    const sel = document.getElementById('resultFilter');
    const currentVal = sel.value;
    const opts = i18n[lang].resultOptions;
    sel.innerHTML = Object.keys(opts).map(key =>
        `<option value="${key}" ${key === currentVal ? 'selected' : ''}>${opts[key]}</option>`
    ).join('');
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === "-") return "-";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return dateStr; }
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    sb.classList.toggle('active');
    ov.classList.toggle('active');
    document.body.style.overflow = sb.classList.contains('active') ? 'hidden' : 'auto';
}

// --- ส่วนที่ 1: วางทับฟังก์ชัน loadFromCache เดิม ---
function loadFromCache() {
    const cached = localStorage.getItem(CACHE_KEY);
    const lastSync = localStorage.getItem("last_sync_time");
    if (cached) {
        const parsedData = JSON.parse(cached);
        
        // ดักจับข้อมูลทั้งแบบเก่าและแบบใหม่
        if (Array.isArray(parsedData)) {
            machines = parsedData;
            rejectedMachines = [];
            histories = [];
            buildMachineIndex();
        } else {
            machines = parsedData.machines || [];
            histories = parsedData.histories || [];
            buildMachineIndex(); // สร้าง index ใหม่ทุกครั้งที่ machines เปลี่ยน
            rejectedMachines = getTrialHistoryList(); // คำนวณอัตโนมัติจาก histories แทนการอ่านจากชีตตรงๆ
        }
        
        if (lastSync) document.getElementById('updateTime').innerText = `${i18n[currentLang].updated} ${lastSync}`;
        updateClientDropdown(); updateStats(); renderTable();
    }
}

// --- ส่วนที่ 2: วางทับฟังก์ชัน fetchData เดิม ---
async function fetchData(options = {}) {
    const silent = options.silent === true; // silent = true ใช้ตอนอัปเดตเบื้องหลัง (add/edit/delete) ไม่ต้องโชว์หน้าโหลดเต็มจอ
    const loader = document.getElementById('app-loader');

    if (!silent) {
        loader.classList.remove('loader-hidden');
        document.getElementById('loader-msg').innerText = i18n[currentLang].msg.loading;
    }
    const minimumDisplayTime = silent ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, 2000));

    try {
        const [response] = await Promise.all([
            fetch(scriptURL + "?app=panolyzer&v=" + new Date().getTime(), { cache: "no-store", redirect: "follow" }),
            minimumDisplayTime
        ]);
        
        const data = await response.json();
        console.log("Raw data from server:", data); // ตรวจสอบรูปแบบข้อมูลใน Console

        if (data) {
            // ดักจับข้อมูลทั้งแบบเก่าและแบบใหม่
            if (Array.isArray(data)) {
                // กรณีที่ API ยังส่งมาเป็นข้อมูลแบบเก่า
                machines = data;
                rejectedMachines = [];
                histories = [];
                buildMachineIndex();
                console.warn("⚠️ ข้อมูล API เป็นเวอร์ชันเก่า: ตารางทำงานได้ แต่จะไม่พบประวัติ History");
            } else {
                // กรณีที่ API อัปเดตเป็นเวอร์ชันใหม่เรียบร้อยแล้ว
                machines = data.machines || [];
                histories = data.histories || [];
                buildMachineIndex(); // สร้าง index ใหม่ทุกครั้งที่ machines เปลี่ยน
                rejectedMachines = getTrialHistoryList(); // คำนวณอัตโนมัติจาก histories (Status=Completed, ทุก Result)
            }
            
            const now = new Date().toLocaleString(currentLang === 'th' ? 'th-TH' : 'en-GB', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            localStorage.setItem(CACHE_KEY, JSON.stringify({ machines, histories }));
            localStorage.setItem("last_sync_time", now);

            document.getElementById('updateTime').innerText = `${i18n[currentLang].updated} ${now}`;
            updateClientDropdown(); 
            updateStats(); 
            renderTable();

            if (!silent) {
                Swal.close();
                Toast.fire({ icon: 'success', title: i18n[currentLang].msg.syncSuccess });
            }
        }
        if (!silent) loader.classList.add('loader-hidden');
    }
    catch (e) {
        console.error("Fetch error details:", e);
        if (!silent) {
            loader.classList.add('loader-hidden');
            Swal.fire({ icon: 'error', title: 'Connection Error', text: 'ไม่สามารถเชื่อมต่อข้อมูลได้' });
        } else {
            Toast.fire({ icon: 'error', title: 'อัปเดตข้อมูลล้มเหลว กรุณารีเฟรชใหม่' });
        }
    }
}

function switchView(view) {
    currentView = view;
    trialStatusQuickFilter = 'all'; // รีเซ็ตเสมอเมื่อเข้าเมนูปกติ เพื่อให้เห็นทุกสถานะการทดลอง
    document.getElementById('main-title').innerText = view === 'all' ? i18n[currentLang].mainTitle : i18n[currentLang].rejectedTitle;
    updateFilterVisibility();

    const activeCols = getActiveCols(currentLang);
    document.querySelector('#tableHead tr').innerHTML = activeCols.map(c => `<th>${c}</th>`).join('');

    document.getElementById('searchInput').value = '';
    document.getElementById('clientFilter').value = 'all';
    document.getElementById('resultFilter').value = 'all';
    document.getElementById('modeFilter').value = 'all';

    renderTable();
    if (window.innerWidth <= 992) toggleSidebar();
}

// โชว์/ซ่อน dropdown ตัวกรองด้านบน ตาม view ปัจจุบัน + ว่ากำลังกรองเฉพาะ 'กำลังทดลอง' จากการ์ด TEST อยู่หรือไม่
function updateFilterVisibility() {
    const isCompactTest = currentView === 'rejected' && trialStatusQuickFilter === 'In Progress';
    document.getElementById('modeFilter').style.display = (currentView === 'all' || isCompactTest) ? 'inline-block' : 'none';
    document.getElementById('resultFilter').style.display = (currentView === 'rejected' && !isCompactTest) ? 'inline-block' : 'none';
}

// ป้องกัน XSS: escape อักขระที่มีความหมายพิเศษใน HTML ก่อนแสดงผลข้อมูลที่มาจาก Sheets/ฟอร์ม
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// กำหนด class ของ badge ตามข้อความสถานะ (ใช้ร่วมกันทุกที่ที่ต้องโชว์สถานะเครื่อง ป้องกันสีไม่ตรงกับความหมายจริง)
function getStatusBadgeClass(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes('complete')) return 'bg-complete';
    if (s.includes('broken')) return 'bg-broken';
    if (s.includes('test') || s.includes('progress')) return 'bg-test';
    return 'bg-stock';
}

// ฟังก์ชันหาค่า Key ที่อาจพิมพ์หลายแบบ
const findKey = (obj, keys) => {
    const foundKey = keys.find(k => obj.hasOwnProperty(k) && obj[k] !== "");
    return foundKey ? obj[foundKey] : "-";
};

// แปลงค่า Result ให้เป็น 1 ใน 3 สถานะเสมอ (รองรับข้อมูลเก่าที่ Result เป็นค่าว่าง = ถือเป็น Pending)
function normalizeResult(r) {
    const v = String(r || "").trim();
    if (v === "Bought" || v === "Not Bought") return v;
    return "Pending";
}

// สร้าง Map ของ machines (S/N -> ข้อมูลเครื่อง) ไว้ล่วงหน้า เพื่อให้ lookup เร็วขึ้น (O(1) ต่อครั้ง)
// ต้องเรียก buildMachineIndex() ใหม่ทุกครั้งที่ machines เปลี่ยน (ทำใน loadFromCache/fetchData)
let machineIndex = new Map();
function buildMachineIndex() {
    machineIndex = new Map(machines.map(m => [String(m["S/N Analyzer"]), m]));
}

// ค้นหาข้อมูล Model ของเครื่องจาก S/N Analyzer (อ้างจากชีต Panolyzer Data)
function getModelBySn(sn) {
    const found = machineIndex.get(String(sn));
    return (found && found["Model"]) ? found["Model"] : "-";
}

// สร้างรายการ "ประวัติทดลอง" จากประวัติเครื่อง (Machine History)
// แสดงทุกสถานะ (ทั้งที่กำลังทดลองอยู่ และที่เสร็จสิ้นแล้ว)
function getTrialHistoryList() {
    return histories.map(h => ({
        ...h,
        "Model": getModelBySn(h["S/N Analyzer"]),
        "Result": normalizeResult(h["Result"]),
        "Total Period": calculateTrialDays(h["Start Date"], h["End Date"], h["Status"])
    }));
}

function renderTable() {
    clearTimeout(window.renderTimer);
    window.renderTimer = setTimeout(() => {
        const search = document.getElementById('searchInput').value.toLowerCase().trim();
        const client = document.getElementById('clientFilter').value;
        const mode = document.getElementById('modeFilter').value;
        const resultFilterVal = document.getElementById('resultFilter').value;
        const body = document.getElementById('tableBody');
        const labels = getActiveCols(currentLang);

        let sourceData = currentView === 'all' ? machines : rejectedMachines;

        if (!sourceData || sourceData.length === 0) {
            body.innerHTML = `<tr><td colspan="${labels.length}" style="text-align:center; padding: 50px; color:#999;">ไม่พบข้อมูลในระบบ</td></tr>`;
            document.getElementById('totalCounter').innerText = `${i18n[currentLang].total} 0 ${i18n[currentLang].unit}`;
            return;
        }

        let sortedData = [...sourceData];
        if (currentView === 'rejected') {
            // เรียง "ไม่ซื้อ" ขึ้นก่อนเสมอ แล้วค่อยเรียงตามระยะเวลาทดลองมากไปน้อยภายในกลุ่มเดียวกัน
            sortedData.sort((a, b) => {
                const aFlag = normalizeResult(a["Result"]) === "Not Bought" ? 0 : 1;
                const bFlag = normalizeResult(b["Result"]) === "Not Bought" ? 0 : 1;
                if (aFlag !== bFlag) return aFlag - bFlag;
                return (parseInt(b["Total Period"]) || 0) - (parseInt(a["Total Period"]) || 0);
            });
        } else {
            sortedData.sort((a, b) => {
                let valA = parseInt(a["Period"] || a["Total Period"] || a["รวมทั้งหมด"]) || 0;
                let valB = parseInt(b["Period"] || b["Total Period"] || b["รวมทั้งหมด"]) || 0;
                return valB - valA;
            });
        }

        const filtered = sortedData.filter(m => {
            if (currentView === 'all') {
                const isNotSorter = String(m["Type"] || "").toLowerCase() !== 'sorter';
                const matchSearch = !search || Object.values(m).some(v => String(v).toLowerCase().includes(search));
                const matchClient = (client === 'all' || m["Client name"] === client);
                const matchMode = (mode === 'all' || m["Mode"] === mode);
                return isNotSorter && matchSearch && matchClient && matchMode;
            } else {
                const matchSearch = !search || Object.values(m).some(v => String(v).toLowerCase().includes(search));
                const currentClientName = findKey(m, ["Client Name", "Client name", "ชื่อโรงสี/ลูกค้า"]);
                const matchClient = (client === 'all' || currentClientName === client);
                const matchResult = (resultFilterVal === 'all' || normalizeResult(m["Result"]) === resultFilterVal);
                const matchTrialStatus = (trialStatusQuickFilter === 'all') ||
                    (trialStatusQuickFilter === 'In Progress' ? String(m["Status"] || "").trim() !== 'Completed' : String(m["Status"] || "").trim() === trialStatusQuickFilter);
                const matchMode = (trialStatusQuickFilter !== 'In Progress') || (mode === 'all' || m["Mode"] === mode);
                return matchSearch && matchClient && matchResult && matchTrialStatus && matchMode;
            }
        });

        if (filtered.length === 0) {
            body.innerHTML = `<tr><td colspan="${labels.length}" style="text-align:center; padding: 50px; color:#999;">ไม่พบข้อมูลที่ค้นหา</td></tr>`;
            document.getElementById('totalCounter').innerText = `${i18n[currentLang].total} 0 ${i18n[currentLang].unit}`;
            return;
        }

        const fragment = document.createDocumentFragment();

        filtered.forEach(m => {
            const tr = document.createElement('tr');
            
            // ดึงค่า S/N ออกมาเพื่อใช้ทำ Event Click ให้แถว
            const snVal = currentView === 'all' ? (m["S/N Analyzer"] || "") : findKey(m, ["SN Analyzer", "S/N Analyzer", "S/N"]);
            
            // เพิ่ม Hover Effect และ Onclick
            tr.style.cursor = 'pointer';
            tr.classList.add('table-row-hover'); // อาจจะต้องเพิ่ม .table-row-hover:hover { background: #f8fbf9; } ใน CSS
            tr.onclick = () => openMachineHistoryModal(snVal);

            if (currentView === 'all') {
                const s = (m["Status"] || "Stock").trim();
                const bClass = getStatusBadgeClass(s);
                const p = parseInt(m["Period"]) || 0;
                const periodStyle = p > 365 ? 'color:#e67e22; font-weight:bold;' : '';

                tr.innerHTML = `
                    <td data-label="${labels[0]}"><div class="val-text">${escapeHtml(m["S/N Analyzer"]) || "-"}</div></td>
                    <td data-label="${labels[1]}"><div class="val-text">${escapeHtml(m["S/N Edge server"]) || "-"}</div></td>
                    <td data-label="${labels[2]}"><div class="val-text">${escapeHtml(m["Model"]) || "-"}</div></td>
                    <td data-label="${labels[3]}"><div class="val-text">${escapeHtml(translateClient(m["Client name"]))}</div></td>
                    <td data-label="${labels[4]}"><div class="val-text">${escapeHtml(m["Location"]) || "-"}</div></td>
                    <td data-label="${labels[5]}"><div class="val-text"><span class="mode-tag">${escapeHtml(m["Mode"]) || "-"}</span></div></td>
                    <td data-label="${labels[6]}"><div class="val-text">${escapeHtml(m["Type"]) || "-"}</div></td>
                    <td data-label="${labels[7]}"><div class="val-text"><span class="badge ${bClass}">${escapeHtml(s.toUpperCase())}</span></div></td>
                    <td data-label="${labels[8]}"><div class="val-text">${escapeHtml(formatDate(m["Delivery date"]))}</div></td>
                    <td data-label="${labels[9]}"><div class="val-text" style="${periodStyle}">${p} ${i18n[currentLang].days}</div></td>
                `;
            } else {
                const clientName = findKey(m, ["Client Name", "Client name", "ชื่อโรงสี/ลูกค้า"]);
                const locVal = findKey(m, ["Location", "location", "จังหวัด"]);
                const startDate = findKey(m, ["Start Date", "Start date", "วันเริ่มทดลอง"]);
                const endDate = findKey(m, ["End Date", "End date", "วันสิ้นสุดทดลอง"]);
                const totalPeriod = findKey(m, ["Total Period", "Total period", "รวมทั้งหมด", "รวมทั้งหมด(วัน)", "Period"]);
                const resultVal = normalizeResult(m["Result"]);
                const resultBadge = resultVal === 'Bought' ? '<span class="badge bg-complete">ซื้อ</span>' :
                                     resultVal === 'Not Bought' ? '<span class="badge bg-broken">ไม่ซื้อ</span>' :
                                     '<span class="badge bg-test">รอพิจารณา</span>';
                const trialStatusVal = String(m["Status"] || "").trim();
                const trialStatusBadge = trialStatusVal === 'Completed'
                    ? '<span class="badge bg-complete">เสร็จสิ้น</span>'
                    : '<span class="badge bg-stock">กำลังทดลอง</span>';

                if (trialStatusQuickFilter === 'In Progress') {
                    // มุมมองย่อจากการ์ด TEST: ซ่อนวันสิ้นสุดทดลอง/สถานะทดลอง/ผลลัพธ์ เพราะทุกแถวคือ "กำลังทดลอง" อยู่แล้ว ไม่มีข้อมูลใหม่จะโชว์
                    tr.innerHTML = `
                        <td data-label="${labels[0]}"><div class="val-text" style="font-weight:bold; color:#1b4332;">${escapeHtml(translateClient(clientName))}</div></td>
                        <td data-label="${labels[1]}"><div class="val-text">${escapeHtml(snVal)}</div></td>
                        <td data-label="${labels[2]}"><div class="val-text">${escapeHtml(m["Model"]) || "-"}</div></td>
                        <td data-label="${labels[3]}"><div class="val-text"><span class="mode-tag">${escapeHtml(m["Mode"]) || "-"}</span></div></td>
                        <td data-label="${labels[4]}"><div class="val-text">${escapeHtml(locVal)}</div></td>
                        <td data-label="${labels[5]}"><div class="val-text">${escapeHtml(formatDate(startDate))}</div></td>
                        <td data-label="${labels[6]}"><div class="val-text" style="color:#e74c3c; font-weight:bold;">${escapeHtml(totalPeriod)} ${i18n[currentLang].days}</div></td>
                    `;
                } else {
                    tr.innerHTML = `
                        <td data-label="${labels[0]}"><div class="val-text" style="font-weight:bold; color:#1b4332;">${escapeHtml(translateClient(clientName))}</div></td>
                        <td data-label="${labels[1]}"><div class="val-text">${escapeHtml(snVal)}</div></td>
                        <td data-label="${labels[2]}"><div class="val-text">${escapeHtml(m["Model"]) || "-"}</div></td>
                        <td data-label="${labels[3]}"><div class="val-text"><span class="mode-tag">${escapeHtml(m["Mode"]) || "-"}</span></div></td>
                        <td data-label="${labels[4]}"><div class="val-text">${escapeHtml(locVal)}</div></td>
                        <td data-label="${labels[5]}"><div class="val-text">${escapeHtml(formatDate(startDate))}</div></td>
                        <td data-label="${labels[6]}"><div class="val-text">${trialStatusVal === 'Completed' ? escapeHtml(formatDate(endDate)) : '-'}</div></td>
                        <td data-label="${labels[7]}"><div class="val-text" style="color:#e74c3c; font-weight:bold;">${escapeHtml(totalPeriod)} ${i18n[currentLang].days}</div></td>
                        <td data-label="${labels[8]}"><div class="val-text">${trialStatusBadge}</div></td>
                        <td data-label="${labels[9]}"><div class="val-text">${resultBadge}</div></td>
                    `;
                }
            }
            fragment.appendChild(tr);
        });

        body.innerHTML = '';
        body.appendChild(fragment);
        document.getElementById('totalCounter').innerText = `${i18n[currentLang].total} ${filtered.length} ${i18n[currentLang].unit}`;
    }, 150);
}

function updateStats() {
    const activeMachines = machines.filter(m => String(m["Type"] || "").toLowerCase() !== 'sorter');
    const count = (sk, tk) => activeMachines.filter(m => {
        const s = String(m["Status"] || "").toLowerCase();
        const t = String(m["Type"] || "").toLowerCase();
        if (sk === 'LAB') return t.includes('lab');
        if (sk === 'REAL') return t.includes('real-time');
        return s.includes(sk.toLowerCase()) && (tk ? t.includes(tk.toLowerCase()) : true);
    }).length;

    // นับ "เครื่องเทส (TEST)" จากสถานะใน Machine_History (Status != Completed = กำลังทดลอง)
    // แทนการเช็ค Status ในชีต Panolyzer Data แบบเดิม แล้วนับเป็นจำนวนเครื่อง (ไม่ซ้ำ S/N)
    const testingSNs = [...new Set(
        histories.filter(h => String(h["Status"] || "").trim() !== "Completed")
                 .map(h => String(h["S/N Analyzer"]))
    )];
    const testingType = (sn) => {
        const mach = machineIndex.get(sn);
        return String((mach && mach["Type"]) || "").toLowerCase();
    };
    const testTotal = testingSNs.length;
    const testLab = testingSNs.filter(sn => testingType(sn).includes('lab')).length;
    const testReal = testingSNs.filter(sn => testingType(sn).includes('real-time')).length;

    const st = {
        L: count('LAB'), R: count('REAL'),
        S: { n: count('stock'), l: count('stock', 'lab'), r: count('stock', 'real') },
        B: { n: count('broken'), l: count('broken', 'lab'), r: count('broken', 'real') },
        T: { n: testTotal, l: testLab, r: testReal }
    };

    const sl = i18n[currentLang].stats;
    document.getElementById('statsBox').innerHTML = `
            <div class="stat-card card-lab" onclick="switchView('all'); quickFilter('Lab')"><span class="stat-label">${sl[0]}</span><span class="stat-val">${st.L}</span></div>
            <div class="stat-card card-real" onclick="switchView('all'); quickFilter('Real-time')"><span class="stat-label">${sl[1]}</span><span class="stat-val">${st.R}</span></div>
            <div class="stat-card card-stock" onclick="switchView('all'); quickFilter('Stock')"><span class="stat-label">${sl[2]}</span><div style="text-align:right"><span class="stat-val">${st.S.n}</span><span class="stat-detail">L: ${st.S.l} | R: ${st.S.r}</span></div></div>
            <div class="stat-card card-broken" onclick="switchView('all'); quickFilter('Broken')"><span class="stat-label">${sl[3]}</span><div style="text-align:right"><span class="stat-val">${st.B.n}</span><span class="stat-detail">L: ${st.B.l} | R: ${st.B.r}</span></div></div>
            <div class="stat-card card-test" onclick="switchView('rejected'); quickFilterTrialStatus('In Progress')"><span class="stat-label">${sl[4]}</span><div style="text-align:right"><span class="stat-val">${st.T.n}</span><span class="stat-detail">L: ${st.T.l} | R: ${st.T.r}</span></div></div>
        `;
}

function updateClientDropdown() {
    const activeMachines = machines.filter(m => String(m["Type"] || "").toLowerCase() !== 'sorter');
    const clients1 = activeMachines.map(m => m["Client name"]);
    const clients2 = rejectedMachines.map(m => findKey(m, ["Client Name", "Client name", "ชื่อโรงสี/ลูกค้า"]));

    const cls = [...new Set([...clients1, ...clients2])].filter(Boolean).sort();
    const sel = document.getElementById('clientFilter');
    const currentVal = sel.value;
    sel.innerHTML = `<option value="all">${i18n[currentLang].allClients}</option>`;
    cls.forEach(c => {
        const isSelected = c === currentVal ? 'selected' : '';
        sel.innerHTML += `<option value="${escapeHtml(c)}" ${isSelected}>${escapeHtml(translateClient(c))}</option>`;
    });
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clientFilter').value = 'all';
    document.getElementById('modeFilter').value = 'all';
    document.getElementById('resultFilter').value = 'all';
    trialStatusQuickFilter = 'all';

    updateFilterVisibility();

    const activeCols = getActiveCols(currentLang);
    document.querySelector('#tableHead tr').innerHTML = activeCols.map(c => `<th>${c}</th>`).join('');

    renderTable();
}

function quickFilter(status) {
    document.getElementById('searchInput').value = status;
    document.getElementById('clientFilter').value = 'all';
    document.getElementById('modeFilter').value = 'all';
    renderTable();
}

// ใช้ตอนคลิกจากการ์ด "เครื่องเทส (TEST)" เพื่อกรองเฉพาะเครื่องที่สถานะ "กำลังทดลอง" อยู่ในหน้าประวัติทดลอง
function quickFilterTrialStatus(status) {
    trialStatusQuickFilter = status;
    document.getElementById('resultFilter').value = 'all';
    document.getElementById('clientFilter').value = 'all';
    document.getElementById('modeFilter').value = 'all';
    document.getElementById('searchInput').value = '';

    updateFilterVisibility();

    const activeCols = getActiveCols(currentLang);
    document.querySelector('#tableHead tr').innerHTML = activeCols.map(c => `<th>${c}</th>`).join('');

    renderTable();
}

/* =========================================================================================
   MACHINE HISTORY & CRUD SYSTEM
   ระบบจัดการประวัติการเคลื่อนย้าย
========================================================================================= */

// ฟังก์ชันคำนวณวัน
function calculateTrialDays(start, end, status) {
    if (!start) return "-";
    const startDate = new Date(start);
    let endDate = new Date(); // ถ้า In Progress ให้ใช้วันปัจจุบัน
    
    if (status === 'Completed' && end) {
        endDate = new Date(end);
    }
    
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// 1. ฟังก์ชันเปิดหน้าต่างแสดงรายละเอียดประวัติ
function openMachineHistoryModal(serialNumber) {
    if (!serialNumber || serialNumber === "-") return;

    // หาข้อมูลเครื่อง และ ประวัติของเครื่องนี้
    const machineInfo = machineIndex.get(String(serialNumber)) || rejectedMachines.find(m => findKey(m, ["SN Analyzer", "S/N Analyzer"]) === serialNumber) || {};
    const machineHistories = histories.filter(h => String(h["S/N Analyzer"]) === String(serialNumber));

    // สร้างตารางประวัติ
    let historyRowsHTML = machineHistories.map(h => {
        const days = calculateTrialDays(h["Start Date"], h["End Date"], h["Status"]);
        const statusBadge = h["Status"] === 'Completed' ? `<span class="badge bg-complete">เสร็จสิ้น</span>` : `<span class="badge bg-test">กำลังทดลอง</span>`;
        const resultValNorm = normalizeResult(h["Result"]);
        const resultText = resultValNorm === 'Bought' ? `<b style="color: green;">ซื้อแล้ว</b>` : (resultValNorm === 'Not Bought' ? `<b style="color: red;">ไม่ซื้อ</b>` : `<b style="color:#f39c12;">รอพิจารณา</b>`);
        
        // Escape เครื่องหมายคำพูดสำหรับใส่ใน onClick
        const hDataStr = encodeURIComponent(JSON.stringify(h));

        return `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 10px; font-size: 12px;">
                ${escapeHtml(formatDate(h["Start Date"]))} <br>ถึง ${escapeHtml(formatDate(h["End Date"]))}<br>
                <span style="color:#e67e22; font-weight:bold;">(${days} วัน)</span>
            </td>
            <td style="padding: 10px;">
                <b>${escapeHtml(h["Client Name"])}</b><br><small style="color:#666;">${escapeHtml(h["Location"])}</small>
            </td>
            <td style="padding: 10px; text-align:center;">
                ${statusBadge}<br>${resultText}<br><small style="color:#888;">${escapeHtml(h["Remark"]) || ""}</small>
            </td>
            <td style="padding: 10px; text-align:center;">
                ${isAdmin ? `
                    <button onclick="editHistoryModal('${hDataStr}')" style="background:var(--action-warning); color:#fff; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; margin-right:4px;"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteHistory('${h["ID"]}')" style="background:var(--action-danger); color:#fff; border:none; padding:5px 8px; border-radius:4px; cursor:pointer;"><i class="fas fa-trash"></i></button>
                ` : `<i class="fas fa-lock" style="color:#bbb;" title="Admin เท่านั้น"></i>`}
            </td>
        </tr>`;
    }).join('');

    Swal.fire({
        title: `<div style="color:var(--c2-dark); font-size:20px;">ประวัติเครื่อง: ${escapeHtml(serialNumber)}</div>`,
        html: `
            <div style="text-align: left; max-height: 70vh; overflow-y: auto;">
                <!-- ครึ่งบน: ข้อมูลเครื่อง -->
                <div style="background: #f8fbf9; padding: 15px; border-radius: 12px; margin-bottom: 15px; border: 1px solid #e0f2e5; font-size: 14px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                        <div>
                            <p style="margin: 5px 0;"><b>ลูกค้า:</b> ${escapeHtml(machineInfo["Client name"]) || "-"} &nbsp;|&nbsp; <b>สถานที่:</b> ${escapeHtml(machineInfo["Location"]) || "-"}</p>
                            <p style="margin: 5px 0;"><b>Mode:</b> ${escapeHtml(machineInfo["Mode"]) || "-"} &nbsp;|&nbsp; <b>Type:</b> ${escapeHtml(machineInfo["Type"]) || "-"}</p>
                            <p style="margin: 5px 0;"><b>Model:</b> ${escapeHtml(machineInfo["Model"]) || "-"} &nbsp;|&nbsp; <b>Status ปัจจุบัน:</b> <span class="badge ${getStatusBadgeClass(machineInfo["Status"])}">${escapeHtml(String(machineInfo["Status"] || "-").toUpperCase())}</span></p>
                        </div>
                        ${isAdmin ? `
                            <button onclick="editMachineModal('${escapeHtml(serialNumber)}')" style="background:var(--action-info); color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold; white-space:nowrap; flex-shrink:0;">
                                <i class="fas fa-pen"></i> แก้ไขข้อมูลเครื่อง
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- ครึ่งล่าง: ตาราง History -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: #1b4332; font-size:16px;">ประวัติการทดลอง (History)</h4>
                    ${isAdmin ? `
                        <button onclick="addHistoryModal('${serialNumber}')" style="background: var(--action-success); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;">
                            <i class="fas fa-plus"></i> เพิ่มประวัติ
                        </button>
                    ` : `
                        <button onclick="adminAuth()" style="background: var(--action-muted); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;" title="ต้องล็อกอินเป็น Admin ก่อน">
                            <i class="fas fa-lock"></i> เพิ่มประวัติ (Admin เท่านั้น)
                        </button>
                    `}
                </div>
                <div style="overflow-x: auto; border: 1px solid #eee; border-radius: 8px;">
                    <table style="width: 100%; min-width: 500px; font-size: 13px; border-collapse: collapse;">
                        <thead style="background: #f1f3f5;">
                            <tr>
                                <th style="padding:10px; text-align:left;">ช่วงเวลา</th>
                                <th style="padding:10px; text-align:left;">ลูกค้า / สถานที่</th>
                                <th style="padding:10px; text-align:center;">สถานะ / ผลลัพธ์</th>
                                <th style="padding:10px; text-align:center;">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${historyRowsHTML || '<tr><td colspan="4" style="text-align:center; color:#999; padding:20px;">ยังไม่มีประวัติการเคลื่อนย้าย</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `,
        width: '800px',
        showCloseButton: true,
        showConfirmButton: false
    });
}

// 2. ฟังก์ชันแสดงฟอร์มสำหรับ เพิ่มประวัติ
async function addHistoryModal(serialNumber) {
    if (!isAdmin) {
        Swal.fire({ icon: 'warning', title: 'สิทธิ์ไม่เพียงพอ', text: 'กรุณาล็อกอินเป็น Admin ก่อนเพิ่มข้อมูล' });
        return;
    }

    // เช็คก่อนว่าเครื่องนี้มีประวัติ "กำลังทดลอง" ค้างอยู่ไหม (เผื่อ Admin ลืมปิดของเก่า)
    const oldTrial = histories.find(h => String(h["S/N Analyzer"]) === String(serialNumber) && String(h["Status"] || "").trim() === "In Progress");
    let autoClose = false;

    if (oldTrial) {
        const confirmClose = await Swal.fire({
            icon: 'warning',
            title: 'พบการทดลองค้างอยู่',
            html: `เครื่องนี้มีประวัติ <b>"กำลังทดลอง"</b> ค้างอยู่<br>
                   ลูกค้า: <b>${escapeHtml(oldTrial["Client Name"]) || '-'}</b> &nbsp;|&nbsp; เริ่มทดลอง: ${escapeHtml(formatDate(oldTrial["Start Date"]))}
                   <br><br>
                   ระบบจะ<b>ปิดรายการเดิมให้เป็น "เสร็จสิ้น / ไม่ซื้อ"</b> โดยอัตโนมัติ (วันที่สิ้นสุด = วันนี้) ก่อนเพิ่มรายการใหม่<br><br>
                   ต้องการดำเนินการต่อหรือไม่?`,
            showCancelButton: true,
            confirmButtonText: 'ดำเนินการต่อ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#e67e22'
        });

        if (!confirmClose.isConfirmed) {
            openMachineHistoryModal(serialNumber);
            return;
        }
        autoClose = true;
    }

    Swal.fire({
        title: '<i class="fas fa-plus-circle" style="color:var(--action-success);"></i> เพิ่มประวัติใหม่',
        html: getHistoryFormHTML(serialNumber),
        width: '560px',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => getHistoryFormData()
    }).then((result) => {
        if (result.isConfirmed) {
            const payload = result.value;
            payload.autoCloseOldTrials = autoClose;
            sendHistoryData("add", payload);
        } else if (result.isDismissed) {
            openMachineHistoryModal(serialNumber); // กลับไปหน้าเดิมถ้ายกเลิก
        }
    });
}

// 3. ฟังก์ชันแสดงฟอร์มสำหรับ แก้ไขประวัติ
function editHistoryModal(hDataStr) {
    if (!isAdmin) {
        Swal.fire({ icon: 'warning', title: 'สิทธิ์ไม่เพียงพอ', text: 'กรุณาล็อกอินเป็น Admin ก่อนแก้ไขข้อมูล' });
        return;
    }
    const h = JSON.parse(decodeURIComponent(hDataStr));
    Swal.fire({
        title: '<i class="fas fa-edit" style="color:var(--action-warning);"></i> แก้ไขประวัติ',
        html: getHistoryFormHTML(h["S/N Analyzer"], h),
        width: '560px',
        showCancelButton: true,
        confirmButtonText: 'อัปเดต',
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => getHistoryFormData(h["ID"])
    }).then((result) => {
        if (result.isConfirmed) {
            sendHistoryData("edit", result.value);
        } else if (result.isDismissed) {
            openMachineHistoryModal(h["S/N Analyzer"]);
        }
    });
}

// 4. ฟังก์ชันสำหรับ ลบประวัติ
function deleteHistory(id) {
    if (!isAdmin) {
        Swal.fire({ icon: 'warning', title: 'สิทธิ์ไม่เพียงพอ', text: 'กรุณาล็อกอินเป็น Admin ก่อนลบข้อมูล' });
        return;
    }
    Swal.fire({
        title: 'ยืนยันการลบ?',
        text: "คุณไม่สามารถกู้คืนข้อมูลนี้ได้!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: 'ใช่, ลบทิ้งเลย',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            sendHistoryData("delete", { ID: id });
        }
    });
}

// โครงสร้าง HTML ของฟอร์ม (ใช้ร่วมกันทั้ง Add และ Edit)
function getHistoryFormHTML(sn, data = {}) {
    // ตัดเวลาออกจาก Date string (ถ้ามี) เพื่อใส่ใน input type="date"
    const startD = data["Start Date"] ? new Date(data["Start Date"]).toISOString().split('T')[0] : '';
    const endD = data["End Date"] ? new Date(data["End Date"]).toISOString().split('T')[0] : '';
    const inputStyle = "width:100%; height:40px; margin:0; box-sizing:border-box;";

    return `
        <div style="text-align: left; font-size: 14px;">
            <input type="hidden" id="h-sn" value="${escapeHtml(sn)}">

            <div class="form-section">
                <div class="form-section-title"><i class="fas fa-user"></i> ข้อมูลลูกค้า</div>
                <div class="form-row">
                    <div class="form-field">
                        <label>Client Name (ชื่อลูกค้า)</label>
                        <input id="h-client" class="swal2-input" style="${inputStyle}" value="${escapeHtml(data["Client Name"]) || ''}">
                    </div>
                    <div class="form-field">
                        <label>Location (สถานที่/จังหวัด)</label>
                        <input id="h-location" class="swal2-input" style="${inputStyle}" value="${escapeHtml(data["Location"]) || ''}">
                    </div>
                    <div class="form-field">
                        <label>Mode ที่ทดลอง</label>
                        <select id="h-mode" class="swal2-select" style="${inputStyle} font-size:14px; padding:0 10px;">
                            ${buildSelectOptions(data["Mode"], ["Milled rice", "Paddy"])}
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title"><i class="fas fa-calendar-alt"></i> ระยะเวลาทดลอง</div>
                <div class="form-row">
                    <div class="form-field">
                        <label>Start Date</label>
                        <input type="date" id="h-start" class="swal2-input" style="${inputStyle}" value="${startD}">
                    </div>
                    <div class="form-field">
                        <label>End Date</label>
                        <input type="date" id="h-end" class="swal2-input" style="${inputStyle}" value="${endD}">
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title"><i class="fas fa-flag"></i> สถานะและผลลัพธ์</div>
                <div class="form-row">
                    <div class="form-field">
                        <label>Status</label>
                        <select id="h-status" class="swal2-select" style="${inputStyle} font-size:14px; padding:0 10px;">
                            <option value="In Progress" ${data["Status"] === 'In Progress' ? 'selected' : ''}>In Progress (กำลังทดลอง)</option>
                            <option value="Completed" ${data["Status"] === 'Completed' ? 'selected' : ''}>Completed (เสร็จสิ้น)</option>
                        </select>
                    </div>
                    <div class="form-field">
                        <label>Result</label>
                        <select id="h-result" class="swal2-select" style="${inputStyle} font-size:14px; padding:0 10px;">
                            <option value="Pending" ${(!data["Result"] || data["Result"] === 'Pending') ? 'selected' : ''}>Pending (รอพิจารณา)</option>
                            <option value="Bought" ${data["Result"] === 'Bought' ? 'selected' : ''}>Bought (ซื้อ)</option>
                            <option value="Not Bought" ${data["Result"] === 'Not Bought' ? 'selected' : ''}>Not Bought (ไม่ซื้อ)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title"><i class="fas fa-sticky-note"></i> หมายเหตุ</div>
                <input id="h-remark" class="swal2-input" style="${inputStyle}" value="${escapeHtml(data["Remark"]) || ''}" placeholder="เหตุผล/หมายเหตุเพิ่มเติม (ไม่บังคับ)">
            </div>

            <div style="padding:10px 12px; background:#f8fbf9; border-radius:8px; border:1px solid #e0f2e5;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; font-weight:bold; color:var(--c2-dark); margin:0;">
                    <input type="checkbox" id="h-sync" checked style="width:16px; height:16px; margin:0;">
                    ซิงค์สถานะ/ลูกค้า/สถานที่/Mode ของเครื่องนี้ในชีตหลักให้อัตโนมัติ
                </label>
                <div style="font-size:11px; color:#888; margin-top:4px; padding-left:24px;">
                    กำลังทดลอง → Status เครื่องเปลี่ยนเป็น Test + sync Mode ตามที่ทดลอง • เสร็จสิ้น+ซื้อ → Complete • เสร็จสิ้น+ไม่ซื้อ → กลับเป็น Stock
                </div>
            </div>
        </div>
    `;
}

// ฟังก์ชันดึงค่าจากฟอร์ม
function getHistoryFormData(id = null) {
    const data = {
        "S/N Analyzer": document.getElementById('h-sn').value,
        "Client Name": document.getElementById('h-client').value,
        "Location": document.getElementById('h-location').value,
        "Start Date": document.getElementById('h-start').value,
        "End Date": document.getElementById('h-end').value,
        "Status": document.getElementById('h-status').value,
        "Result": document.getElementById('h-result').value,
        "Mode": document.getElementById('h-mode').value,
        "Remark": document.getElementById('h-remark').value,
        "syncMachineStatus": document.getElementById('h-sync').checked
    };
    if (id) data.ID = id;
    
    // ตรวจสอบข้อมูลเบื้องต้น
    if (!data["Client Name"]) {
        Swal.showValidationMessage('กรุณากรอกชื่อลูกค้า');
        return false;
    }
    return data;
}

/* =========================================================================================
   แก้ไขข้อมูลเครื่องโดยตรง (แทนการเข้าไปแก้ในหลังบ้าน/Google Sheets) — Admin เท่านั้น
========================================================================================= */

function editMachineModal(serialNumber) {
    if (!isAdmin) {
        Swal.fire({ icon: 'warning', title: 'สิทธิ์ไม่เพียงพอ', text: 'กรุณาล็อกอินเป็น Admin ก่อนแก้ไขข้อมูลเครื่อง' });
        return;
    }
    const machineInfo = machineIndex.get(String(serialNumber)) || {};

    Swal.fire({
        title: `<i class="fas fa-pen" style="color:var(--action-info); font-size:18px;"></i> แก้ไขข้อมูลเครื่อง: ${escapeHtml(serialNumber)}`,
        html: getMachineFormHTML(serialNumber, machineInfo),
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        width: '560px',
        preConfirm: () => getMachineFormData(serialNumber)
    }).then((result) => {
        if (result.isConfirmed) {
            sendMachineEditData(result.value, serialNumber);
        } else if (result.isDismissed) {
            openMachineHistoryModal(serialNumber);
        }
    });
}

// สร้าง <option> list ให้ dropdown โดยถ้าค่าปัจจุบันไม่ตรงกับตัวเลือกมาตรฐานเป๊ะๆ (เช่น สะกดต่างในชีตเดิม)
// จะเติม option พิเศษที่ selected ไว้ก่อน เพื่อไม่ให้ข้อมูลเดิมถูกเปลี่ยนโดยไม่ตั้งใจถ้า Admin ไม่ได้แก้ค่านี้
function buildSelectOptions(currentVal, standardOptions) {
    const cur = String(currentVal || "").trim();
    const isKnown = standardOptions.includes(cur);
    let html = standardOptions.map(opt => `<option value="${opt}" ${opt === cur ? 'selected' : ''}>${opt}</option>`).join('');
    if (cur && !isKnown) {
        html = `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)} (ค่าเดิมในชีต)</option>` + html;
    }
    return html;
}

function getMachineFormHTML(sn, m) {
    const inputStyle = "width:100%; height:40px; margin:0; box-sizing:border-box;";

    return `
        <div style="text-align:left; font-size:14px;">
            <div class="form-section">
                <div class="form-section-title"><i class="fas fa-user"></i> ผู้ใช้งานปัจจุบัน</div>
                <div class="form-row">
                    <div class="form-field">
                        <label>ชื่อลูกค้า (Client name)</label>
                        <input id="mf-client" class="swal2-input" style="${inputStyle}" value="${escapeHtml(m["Client name"]) || ''}">
                    </div>
                    <div class="form-field">
                        <label>สถานที่ (Location)</label>
                        <input id="mf-location" class="swal2-input" style="${inputStyle}" value="${escapeHtml(m["Location"]) || ''}">
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title"><i class="fas fa-microchip"></i> รายละเอียดเครื่อง</div>
                <div class="form-row">
                    <div class="form-field">
                        <label>Status</label>
                        <select id="mf-status" class="swal2-select" style="${inputStyle} font-size:14px; padding:0 10px;">
                            ${buildSelectOptions(m["Status"], ["Stock", "Test", "In Progress", "Complete", "Broken"])}
                        </select>
                    </div>
                    <div class="form-field">
                        <label>Model</label>
                        <select id="mf-model" class="swal2-select" style="${inputStyle} font-size:14px; padding:0 10px;">
                            ${buildSelectOptions(m["Model"], ["Gen 1", "Gen 2"])}
                        </select>
                    </div>
                    <div class="form-field">
                        <label>Mode</label>
                        <select id="mf-mode" class="swal2-select" style="${inputStyle} font-size:14px; padding:0 10px;">
                            ${buildSelectOptions(m["Mode"], ["Milled rice", "Paddy"])}
                        </select>
                    </div>
                    <div class="form-field">
                        <label>Type</label>
                        <select id="mf-type" class="swal2-select" style="${inputStyle} font-size:14px; padding:0 10px;">
                            ${buildSelectOptions(m["Type"], ["Lab", "Real-time"])}
                        </select>
                    </div>
                </div>
            </div>

            <div class="form-section">
                <div class="form-section-title"><i class="fas fa-info-circle"></i> ข้อมูลอื่นๆ</div>
                <div class="form-row">
                    <div class="form-field">
                        <label>S/N Edge server</label>
                        <input id="mf-edge" class="swal2-input" style="${inputStyle}" value="${escapeHtml(m["S/N Edge server"]) || ''}">
                    </div>
                    <div class="form-field">
                        <label>Delivery date</label>
                        <input type="date" id="mf-delivery" class="swal2-input" style="${inputStyle}" value="${m["Delivery date"] ? new Date(m["Delivery date"]).toISOString().split('T')[0] : ''}">
                    </div>
                </div>
            </div>

            <div style="font-size:11px; color:#999;"><i class="fas fa-lock"></i> ไม่สามารถแก้ไข S/N Analyzer ได้จากหน้านี้ (ใช้เป็นตัวระบุหลักของเครื่อง)</div>
        </div>
    `;
}

function getMachineFormData(sn) {
    return {
        "S/N Analyzer": sn,
        "Client name": document.getElementById('mf-client').value,
        "Location": document.getElementById('mf-location').value,
        "Status": document.getElementById('mf-status').value,
        "Model": document.getElementById('mf-model').value,
        "Mode": document.getElementById('mf-mode').value,
        "Type": document.getElementById('mf-type').value,
        "S/N Edge server": document.getElementById('mf-edge').value,
        "Delivery date": document.getElementById('mf-delivery').value
    };
}

async function sendMachineEditData(payload, serialNumber) {
    Swal.fire({ title: 'กำลังบันทึกข้อมูลเครื่อง...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const response = await fetch(scriptURL, {
            method: 'POST',
            body: JSON.stringify({ action: "edit_machine", data: payload, adminPassword: adminPasswordCache }),
            headers: { "Content-Type": "text/plain;charset=utf-8" }
        });

        const result = await response.json();

        if (result.status === "success") {
            Swal.close();
            await fetchData({ silent: true });
            Toast.fire({ icon: 'success', title: result.message || 'อัปเดตข้อมูลเครื่องแล้ว' });
            openMachineHistoryModal(serialNumber);
        } else {
            Swal.fire('ข้อผิดพลาด!', result.message, 'error');
        }
    } catch (error) {
        console.error("Error saving machine data:", error);
        Swal.fire('ไม่สามารถเชื่อมต่อได้', 'กรุณาลองใหม่อีกครั้ง', 'error');
    }
}

// 5. ฟังก์ชันส่งข้อมูลไปยัง Google Apps Script (POST)
async function sendHistoryData(action, payload) {
    const snToReopen = payload["S/N Analyzer"] || (action === "delete" ? histories.find(h => h.ID === payload.ID)?.["S/N Analyzer"] : null);

    Swal.fire({
        title: 'กำลังบันทึกข้อมูล...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const response = await fetch(scriptURL, {
            method: 'POST',
            body: JSON.stringify({ action: action, data: payload, adminPassword: adminPasswordCache }),
            headers: { "Content-Type": "text/plain;charset=utf-8" } // ใช้ text/plain เลี่ยงปัญหา CORS Preflight
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            Swal.close();
            await fetchData({ silent: true }); // อัปเดตข้อมูลเบื้องหลัง ไม่โชว์หน้าโหลดเต็มจอเหมือนเข้าครั้งแรก
            Toast.fire({ icon: 'success', title: result.message || 'Update data complete' });
            // เปิดหน้าต่าง S/N เดิมกลับขึ้นมาให้ดูความเปลี่ยนแปลงทันที (ไม่ต้องหน่วงเวลาแล้ว)
            if (snToReopen) openMachineHistoryModal(snToReopen);
        } else {
            Swal.fire('ข้อผิดพลาด!', result.message, 'error');
        }
    } catch (error) {
        console.error("Error saving history:", error);
        Swal.fire('ไม่สามารถเชื่อมต่อได้', 'กรุณาลองใหม่อีกครั้ง', 'error');
    }
}

/* =========================================================================================
   DASHBOARD สรุปภาพรวมการทดลอง
========================================================================================= */

let dashboardChartInstance = null;

// คำนวณสถิติทั้งหมดสำหรับ Dashboard
// "ขายแล้ว" อ้างจากสถานะเครื่องจริงในชีต Panolyzer Data (Status = Complete) ไม่ใช่ Result ในประวัติทดลอง
function getDashboardStats() {
    const activeMachines = machines.filter(m => String(m["Type"] || "").toLowerCase() !== 'sorter');
    const soldCount = activeMachines.filter(m => String(m["Status"] || "").toLowerCase().includes('complete')).length;

    const completedTrials = histories.filter(h => String(h["Status"] || "").trim() === "Completed");
    const inProgress = histories.filter(h => String(h["Status"] || "").trim() !== "Completed");

    const notBought = completedTrials.filter(h => normalizeResult(h["Result"]) === "Not Bought");
    const pending = completedTrials.filter(h => normalizeResult(h["Result"]) === "Pending");

    return {
        soldCount: soldCount,
        inProgressCount: inProgress.length,
        notBoughtCount: notBought.length,
        pendingCount: pending.length
    };
}

function dashboardKpiCard(label, value, subText, color, bg, icon) {
    return `
        <div style="background:${bg}; border-radius:14px; padding:16px; border-left:5px solid ${color}; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
            <div style="font-size:11px; font-weight:800; color:${color}; text-transform:uppercase; letter-spacing:.5px;">
                <i class="fas ${icon}"></i> ${label}
            </div>
            <div style="font-size:28px; font-weight:900; color:${color}; margin-top:6px; line-height:1;">${value}</div>
            ${subText ? `<div style="font-size:11px; color:${color}; opacity:.75; font-weight:700; margin-top:3px;">${subText}</div>` : ''}
        </div>
    `;
}

function dashboardLegendRow(color, label, count, pct) {
    return `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            <span style="width:13px; height:13px; border-radius:4px; background:${color}; display:inline-block; flex-shrink:0;"></span>
            <span style="min-width:80px; font-weight:700; color:#333;">${label}</span>
            <span style="color:#666; font-size:13px;">${count} เครื่อง <b style="color:${color};">(${pct}%)</b></span>
        </div>
    `;
}

function showDashboard() {
    const s = getDashboardStats();
    const total = s.soldCount + s.notBoughtCount + s.pendingCount;
    const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

    const COLOR_BOUGHT = "#2e7d32";
    const COLOR_NOTBOUGHT = "#c62828";
    const COLOR_PENDING = "#d4a017";
    const COLOR_PROGRESS = "#1565c0";

    Swal.fire({
        title: `<div style="color:var(--c2-dark); font-size:22px; font-weight:800;"><i class="fas fa-chart-pie"></i> Dashboard ภาพรวมการทดลอง</div>`,
        html: `
            <div style="text-align:left;">
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(135px,1fr)); gap:12px; margin-bottom:20px;">
                    ${dashboardKpiCard('ขายแล้ว', s.soldCount, total > 0 ? pct(s.soldCount) + '% ของทั้งหมด' : '', COLOR_BOUGHT, '#e8f5e9', 'fa-check-circle')}
                    ${dashboardKpiCard('ไม่ซื้อ', s.notBoughtCount, total > 0 ? pct(s.notBoughtCount) + '% ของทั้งหมด' : '', COLOR_NOTBOUGHT, '#fdedec', 'fa-times-circle')}
                    ${dashboardKpiCard('รอพิจารณา', s.pendingCount, total > 0 ? pct(s.pendingCount) + '% ของทั้งหมด' : '', COLOR_PENDING, '#fff9db', 'fa-hourglass-half')}
                    ${dashboardKpiCard('กำลังทดลองอยู่', s.inProgressCount, 'ยังไม่เสร็จสิ้น', COLOR_PROGRESS, '#e3f2fd', 'fa-vial')}
                </div>

                <div style="background:#fff; border:1px solid #eee; border-radius:16px; padding:18px;">
                    <div style="font-weight:800; color:var(--c2-dark); margin-bottom:14px; font-size:14px;">
                        สรุปผลรวม (${total} เครื่อง) — ขายแล้วดูจากสถานะเครื่องจริง, ไม่ซื้อ/รอพิจารณาดูจากผลการทดลอง
                    </div>
                    ${total > 0 ? `
                        <div style="display:flex; align-items:center; gap:24px; flex-wrap:wrap; justify-content:center;">
                            <div style="width:190px; height:190px; position:relative;">
                                <canvas id="dashDoughnut"></canvas>
                            </div>
                            <div>
                                ${dashboardLegendRow(COLOR_BOUGHT, 'ขายแล้ว', s.soldCount, pct(s.soldCount))}
                                ${dashboardLegendRow(COLOR_NOTBOUGHT, 'ไม่ซื้อ', s.notBoughtCount, pct(s.notBoughtCount))}
                                ${dashboardLegendRow(COLOR_PENDING, 'รอพิจารณา', s.pendingCount, pct(s.pendingCount))}
                            </div>
                        </div>
                    ` : `<div style="text-align:center; color:#999; padding:30px 0;">ยังไม่มีข้อมูล</div>`}
                </div>
            </div>
        `,
        width: '680px',
        showCloseButton: true,
        showConfirmButton: false,
        didOpen: () => {
            if (total === 0) return;
            const ctx = document.getElementById('dashDoughnut');
            if (dashboardChartInstance) dashboardChartInstance.destroy();
            dashboardChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['ขายแล้ว', 'ไม่ซื้อ', 'รอพิจารณา'],
                    datasets: [{
                        data: [s.soldCount, s.notBoughtCount, s.pendingCount],
                        backgroundColor: [COLOR_BOUGHT, COLOR_NOTBOUGHT, COLOR_PENDING],
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        hoverOffset: 6
                    }]
                },
                options: {
                    cutout: '68%',
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `${ctx.label}: ${ctx.raw} เครื่อง (${pct(ctx.raw)}%)`
                            }
                        }
                    }
                }
            });
        }
    });
}