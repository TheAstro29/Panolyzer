const scriptURL = "https://script.google.com/macros/s/AKfycbyoDpjNfMwS0tp8A78uwe8QmuMaJVLhhR7dKdILP0wczmRu-KXX-CsnxSwGE4RwAg2J/exec";
const CACHE_KEY = "c2tech_machines_data_v2";
let machines = [];
let currentLang = localStorage.getItem('c2_lang') || 'th';
let searchTimeout;

// ตั้งค่าพื้นฐานสำหรับ Toast
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
        search: "ค้นหา S/N, ลูกค้า, โหมด...", allClients: "-- ลูกค้าทั้งหมด --", reset: "ล้างค่าการค้นหา",
        total: "รวม", unit: "เครื่อง", updated: "อัปเดตเมื่อ:", days: "วัน",
        cols: ["S/N Analyzer", "S/N Edge", "ลูกค้า", "สถานที่", "Mode", "ประเภท", "สถานะ", "ส่งมอบ", "ระยะเวลา"],
        stats: ["Lab ทั้งหมด", "Real-time ทั้งหมด", "ในคลัง (Stock)", "ส่งซ่อม (Broken)", "เครื่องเทส (TEST)"],
        msg: { loading: "กำลังซิงค์ข้อมูล", syncSuccess: "ข้อมูลล่าสุดแล้ว", langChange: "เปลี่ยนเป็นภาษาไทย" },
        clients: {}
    },
    en: {
        menu: "Menu", overview: "System Overview", refresh: "Refresh Data", mainTitle: "All Machines",
        search: "Search S/N, Client, Mode...", allClients: "-- All Clients --", reset: "Clear Filters",
        total: "Total", unit: "units", updated: "Updated at:", days: "days",
        cols: ["S/N Analyzer", "S/N Edge", "Client", "Location", "Mode", "Type", "Status", "Delivery", "Period"],
        stats: ["Total Lab", "Total Real-time", "In Stock", "Broken/Repair", "Test Units"],
        msg: { loading: "Syncing Data", syncSuccess: "Data Updated", langChange: "Switched to English" },
        clients: {
            "ตัวอย่าง": "Tua-Yang"
        }
    }
};

window.onload = () => {
    setLanguage(currentLang, true); // true = ไม่แสดง Toast ตอนเปิดเว็บครั้งแรก
    loadFromCache();
    fetchData();
};

function setLanguage(lang, silent = false) {
    currentLang = lang;
    localStorage.setItem('c2_lang', lang);

    // UI Updates
    document.querySelectorAll('.lang-btn, .mobile-lang-btn').forEach(b => b.classList.remove('active'));
    if (document.getElementById(`btn-${lang}`)) document.getElementById(`btn-${lang}`).classList.add('active');
    if (document.getElementById(`m-btn-${lang}`)) document.getElementById(`m-btn-${lang}`).classList.add('active');

    document.getElementById('m-menu-text').innerText = i18n[lang].menu;
    document.getElementById('nav-label-ov').innerHTML = `<i class="fas fa-chart-pie"></i> ${i18n[lang].overview}`;
    document.getElementById('refresh-btn').innerHTML = `<i class="fas fa-sync-alt"></i> ${i18n[lang].refresh}`;
    document.getElementById('main-title').innerText = i18n[lang].mainTitle;
    document.getElementById('searchInput').placeholder = i18n[lang].search;
    document.getElementById('reset-btn').innerHTML = `<i class="fas fa-undo"></i> ${i18n[lang].reset}`;
    document.querySelector('#tableHead tr').innerHTML = i18n[lang].cols.map(c => `<th>${c}</th>`).join('');

    updateClientDropdown();
    updateStats();
    renderTable();

    if (!silent) {
        Toast.fire({ icon: 'info', title: i18n[lang].msg.langChange });
    }
}

function translateClient(name) {
    if (!name || name === "-") return "-";
    return (currentLang === 'en' && i18n.en.clients[name]) ? i18n.en.clients[name] : name;
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

function loadFromCache() {
    const cached = localStorage.getItem(CACHE_KEY);
    const lastSync = localStorage.getItem("last_sync_time");
    if (cached) {
        machines = JSON.parse(cached);
        if (lastSync) document.getElementById('updateTime').innerText = `${i18n[currentLang].updated} ${lastSync}`;
        updateClientDropdown(); updateStats(); renderTable();
    }
}

async function fetchData() {
    // แสดงหน้าจอโหลด (ถ้ามีการเรียกใหม่)
    const loader = document.getElementById('app-loader');
    loader.classList.remove('loader-hidden');
    document.getElementById('loader-msg').innerText = i18n[currentLang].msg.loading;
    const minimumDisplayTime = new Promise(resolve => setTimeout(resolve, 2500));

    try {
        const [response] = await Promise.all([
            fetch(scriptURL),
            minimumDisplayTime
        ]);
        const data = await response.json();
        if (data && data.length > 0) {
            machines = data;
            const now = new Date().toLocaleString(currentLang === 'th' ? 'th-TH' : 'en-GB', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            localStorage.setItem(CACHE_KEY, JSON.stringify(machines));
            localStorage.setItem("last_sync_time", now);
            document.getElementById('updateTime').innerText = `${i18n[currentLang].updated} ${now}`;
            updateClientDropdown(); updateStats(); renderTable();
            Swal.close();
            Toast.fire({ icon: 'success', title: i18n[currentLang].msg.syncSuccess });
        }
        updateClientDropdown();
        updateStats();
        renderTable();

        // ซ่อนหน้าจอโหลด
        loader.classList.add('loader-hidden');
        Toast.fire({ icon: 'success', title: i18n[currentLang].msg.syncSuccess });
    }
    catch (e) {
        loader.classList.add('loader-hidden'); // ซ่อนเพื่อแสดง Error
        Swal.fire({ icon: 'error', title: 'Connection Error', text: 'ไม่สามารถเชื่อมต่อข้อมูลได้' });
    }
}

// [script.js] - ส่วนที่แนะนำให้ปรับปรุง

function renderTable() {
    // ใช้เทคนิค Debounce เพื่อไม่ให้ Render บ่อยเกินไปขณะพิมพ์
    clearTimeout(window.renderTimer);
    window.renderTimer = setTimeout(() => {
        const search = document.getElementById('searchInput').value.toLowerCase().trim();
        const client = document.getElementById('clientFilter').value;
        const mode = document.getElementById('modeFilter').value;
        const body = document.getElementById('tableBody');
        const labels = i18n[currentLang].cols;

        // กรองข้อมูล (Filter)
        const filtered = machines.filter(m => {
            const isNotSorter = String(m["Type"] || "").toLowerCase() !== 'sorter';

            // กรองด้วย Search
            const matchSearch = !search || Object.values(m).some(v => String(v).toLowerCase().includes(search));

            // กรองด้วย Client
            const matchClient = (client === 'all' || m["Client name"] === client);

            // กรองด้วย Mode (Milled rice / Paddy)
            const matchMode = (mode === 'all' || m["Mode"] === mode);

            return isNotSorter && matchSearch && matchClient && matchMode;
        });

        // แสดงข้อความเมื่อไม่พบข้อมูล
        if (filtered.length === 0) {
            body.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 50px; color:#999;">No Data Found</td></tr>`;
            document.getElementById('totalCounter').innerText = `${i18n[currentLang].total} 0 ${i18n[currentLang].unit}`;
            return;
        }

        // ใช้ DocumentFragment เพื่อ Performance ที่ดีขึ้น
        const fragment = document.createDocumentFragment();

        filtered.forEach(m => {
            const tr = document.createElement('tr');
            const s = (m["Status"] || "Stock").trim();
            const bClass = s.toLowerCase().includes('complete') ? "bg-complete" :
                s.toLowerCase().includes('broken') ? "bg-broken" :
                    s.toLowerCase().includes('test') ? "bg-test" : "bg-stock";
            const p = parseInt(m["Period"]) || 0;

            // ปรับปรุงการแสดงผล Period ให้มีสีเตือนเมื่อเกิน 1 ปี
            const periodStyle = p > 365 ? 'color:#e67e22; font-weight:bold;' : '';

            tr.innerHTML = `
                <td data-label="${labels[0]}"><div class="val-text">${m["S/N Analyzer"] || "-"}</div></td>
                <td data-label="${labels[1]}"><div class="val-text">${m["S/N Edge server"] || "-"}</div></td>
                <td data-label="${labels[2]}"><div class="val-text">${translateClient(m["Client name"])}</div></td>
                <td data-label="${labels[3]}"><div class="val-text">${m["Location"] || "-"}</div></td>
                <td data-label="${labels[4]}"><div class="val-text"><span class="mode-tag">${m["Mode"] || "-"}</span></div></td>
                <td data-label="${labels[5]}"><div class="val-text">${m["Type"] || "-"}</div></td>
                <td data-label="${labels[6]}"><div class="val-text"><span class="badge ${bClass}">${s.toUpperCase()}</span></div></td>
                <td data-label="${labels[7]}"><div class="val-text">${formatDate(m["Delivery date"])}</div></td>
                <td data-label="${labels[8]}"><div class="val-text" style="${periodStyle}">${p} ${i18n[currentLang].days}</div></td>
            `;
            fragment.appendChild(tr);
        });

        body.innerHTML = '';
        body.appendChild(fragment);
        document.getElementById('totalCounter').innerText = `${i18n[currentLang].total} ${filtered.length} ${i18n[currentLang].unit}`;
    }, 150); // ลดเวลาหน่วงลงเหลือ 150ms เพื่อความรู้สึกที่ไวขึ้น
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

    const st = {
        L: count('LAB'), R: count('REAL'),
        S: { n: count('stock'), l: count('stock', 'lab'), r: count('stock', 'real') },
        B: { n: count('broken'), l: count('broken', 'lab'), r: count('broken', 'real') },
        T: { n: count('test'), l: count('test', 'lab'), r: count('test', 'real') }
    };

    const sl = i18n[currentLang].stats;
    document.getElementById('statsBox').innerHTML = `
            <div class="stat-card card-lab" onclick="quickFilter('Lab')"><span class="stat-label">${sl[0]}</span><span class="stat-val">${st.L}</span></div>
            <div class="stat-card card-real" onclick="quickFilter('Real-time')"><span class="stat-label">${sl[1]}</span><span class="stat-val">${st.R}</span></div>
            <div class="stat-card card-stock" onclick="quickFilter('Stock')">
                <span class="stat-label">${sl[2]}</span>
                <div style="text-align:right"><span class="stat-val">${st.S.n}</span><span class="stat-detail">L: ${st.S.l} | R: ${st.S.r}</span></div>
            </div>
            <div class="stat-card card-broken" onclick="quickFilter('Broken')">
                <span class="stat-label">${sl[3]}</span>
                <div style="text-align:right"><span class="stat-val">${st.B.n}</span><span class="stat-detail">L: ${st.B.l} | R: ${st.B.r}</span></div>
            </div>
            <div class="stat-card card-test" onclick="quickFilter('TEST')">
                <span class="stat-label">${sl[4]}</span>
                <div style="text-align:right"><span class="stat-val">${st.T.n}</span><span class="stat-detail">L: ${st.T.l} | R: ${st.T.r}</span></div>
            </div>
        `;
}

function quickFilter(term) {
    const input = document.getElementById('searchInput');
    if (input.value === term) {
        input.value = '';
        Toast.fire({ icon: 'info', title: currentLang === 'th' ? 'แสดงเครื่องทั้งหมด' : 'Showing all units' });
    } else {
        input.value = term;
        document.getElementById('clientFilter').value = 'all';
        Toast.fire({ icon: 'success', title: `${currentLang === 'th' ? 'กรอง' : 'Filter'}: ${term}` });
    }
    renderTable();
    if (window.innerWidth <= 992) toggleSidebar();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clientFilter').value = 'all';
    document.getElementById('modeFilter').value = 'all';
    renderTable();
    Toast.fire({ icon: 'success', title: currentLang === 'th' ? 'ล้างตัวกรองแล้ว' : 'Filters cleared' });
}

function updateClientDropdown() {
    const activeMachines = machines.filter(m => String(m["Type"] || "").toLowerCase() !== 'sorter');
    const cls = [...new Set(activeMachines.map(m => m["Client name"]))].filter(Boolean).sort();
    const sel = document.getElementById('clientFilter');
    const currentVal = sel.value;
    sel.innerHTML = `<option value="all">${i18n[currentLang].allClients}</option>`;
    cls.forEach(c => {
        const isSelected = c === currentVal ? 'selected' : '';
        sel.innerHTML += `<option value="${c}" ${isSelected}>${translateClient(c)}</option>`;
    });
}