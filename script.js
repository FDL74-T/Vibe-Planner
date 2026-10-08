let appState = {
    activities: [],
    metrics: {},
    calendar: {
        year: 2026,
        month: 10
    },
    currentFilter: 'all',
    searchKeyword: '',
    priorityFilter: 'all'
};

const STORAGE_KEY = 'vibe_planner_activities_db';

document.addEventListener('DOMContentLoaded', () => {
    initLiveClock();
    setPresetDate(0);

    loadFromLocalStorageFirst();

    document.getElementById('addActivityForm').addEventListener('submit', handleAddActivity);

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        appState.searchKeyword = e.target.value.toLowerCase();
        document.getElementById('clearSearchBtn').style.display = appState.searchKeyword ? 'block' : 'none';
        renderTable();
    });

    document.querySelectorAll('.tab-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            appState.currentFilter = e.currentTarget.getAttribute('data-filter');
            updateActiveCardStyle();
            renderTable();
        });
    });
});

function initLiveClock() {
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        document.getElementById('liveClock').innerText = `${hours}:${minutes}:${seconds}`;

        const h = now.getHours();
        let greeting = "Selamat malam";
        if (h >= 4 && h < 11) greeting = "Selamat pagi";
        else if (h >= 11 && h < 15) greeting = "Selamat siang";
        else if (h >= 15 && h < 18) greeting = "Selamat sore";

        document.getElementById('greetingText').innerText = `${greeting}, rencana Anda tersimpan secara otomatis ✨`;

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDateStr').innerText = now.toLocaleDateString('id-ID', options);
    }
    updateClock();
    setInterval(updateClock, 1000);
}

async function loadFromLocalStorageFirst() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
        try {
            appState.activities = JSON.parse(cached);
            await syncWithBackend(appState.activities);
            return;
        } catch (e) {
            console.error('Gagal membaca cache lokal:', e);
        }
    }
    await fetchFromServer();
}

async function syncWithBackend(list) {
    showAutoSavePulse();
    try {
        const url = `/api/sync?year=${appState.calendar.year}&month=${appState.calendar.month}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activities: list })
        });

        if (response.ok) {
            const data = await response.json();
            appState.activities = data.activities || [];
            appState.metrics = data.metrics || {};
            appState.calendar = data.calendar || appState.calendar;

            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.activities));
            renderUI();
        }
    } catch (err) {
        console.warn('Backend sync tertunda, data tetap aman di browser:', err);
        renderUI();
    }
}

async function fetchFromServer() {
    try {
        const url = `/api/data?year=${appState.calendar.year}&month=${appState.calendar.month}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            appState.activities = data.activities || [];
            appState.metrics = data.metrics || {};
            appState.calendar = data.calendar || appState.calendar;

            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.activities));
            renderUI();
        }
    } catch (err) {
        console.error(err);
    }
}

function showAutoSavePulse() {
    const badge = document.getElementById('autosaveBadge');
    if (badge) {
        badge.style.borderColor = '#10b981';
        setTimeout(() => { badge.style.borderColor = '#a7f3d0'; }, 600);
    }
}

function renderUI() {
    renderStats();
    renderCalendar();
    renderTable();
}

function renderStats() {
    const { total = 0, completed = 0, pending = 0, progress = 0 } = appState.metrics;

    animateCount('statTotal', total);
    animateCount('statCompleted', completed);
    animateCount('statPending', pending);

    document.getElementById('statProgressLabel').innerText = `Selesai (${progress}%)`;

    const bar = document.getElementById('progressBar');
    if (bar) bar.style.width = progress + '%';

    document.getElementById('countAll').innerText = total;
    document.getElementById('countCompleted').innerText = completed;
    document.getElementById('countPending').innerText = pending;

    if (total > 0 && completed === total) {
        triggerConfetti();
    }
}

function animateCount(id, target) {
    const el = document.getElementById(id);
    const start = parseInt(el.innerText) || 0;
    if (start === target) return;

    const duration = 500;
    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        el.innerText = Math.floor(start + (target - start) * progress);
        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            el.innerText = target;
        }
    }
    requestAnimationFrame(step);
}

function changeMonth(direction) {
    appState.calendar.month += direction;
    if (appState.calendar.month > 12) {
        appState.calendar.month = 1;
        appState.calendar.year += 1;
    } else if (appState.calendar.month < 1) {
        appState.calendar.month = 12;
        appState.calendar.year -= 1;
    }
    syncWithBackend(appState.activities);
}

function goToCurrentMonth() {
    const now = new Date();
    appState.calendar.year = now.getFullYear();
    appState.calendar.month = now.getMonth() + 1;
    syncWithBackend(appState.activities);
    showToast('📅 Kembali ke bulan sekarang');
}

function renderCalendar() {
    const tbody = document.getElementById('calendarBody');
    tbody.innerHTML = '';

    document.getElementById('calendarTitle').innerText = 
        `${appState.calendar.month_name || ''} ${appState.calendar.year}`;

    const matrix = appState.calendar.matrix || [];
    const activitiesByDate = appState.calendar.activities_by_date || {};
    const todayStr = new Date().toISOString().split('T')[0];

    matrix.forEach(week => {
        const tr = document.createElement('tr');
        week.forEach(day => {
            const td = document.createElement('td');
            if (day === 0) {
                td.className = 'cal-empty';
            } else {
                const y = appState.calendar.year;
                const m = String(appState.calendar.month).padStart(2, '0');
                const d = String(day).padStart(2, '0');
                const dateKey = `${y}-${m}-${d}`;

                td.className = 'cal-cell';
                if (dateKey === todayStr) td.classList.add('is-today');

                td.onclick = () => selectCalendarDate(dateKey, td);
                td.innerHTML = `<span class="cal-day-num">${day}</span>`;

                const dayActs = activitiesByDate[dateKey] || [];
                dayActs.forEach(act => {
                    const badge = document.createElement('div');
                    badge.className = `cal-badge ${act.completed ? 'badge-done' : 'badge-pending'}`;
                    badge.innerText = (act.completed ? '✓ ' : '• ') + act.title;
                    badge.title = act.title;
                    td.appendChild(badge);
                });
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function selectCalendarDate(dateStr, cellElement) {
    document.querySelectorAll('.cal-cell').forEach(c => c.classList.remove('selected-cell'));
    if (cellElement) cellElement.classList.add('selected-cell');

    const input = document.getElementById('date');
    if (input) {
        input.value = dateStr;
        showToast(`📅 Tanggal ${dateStr} dipilih di formulir`);
        document.getElementById('title').focus();
    }
}

function renderTable() {
    const tbody = document.getElementById('activityTableBody');
    tbody.innerHTML = '';

    const prioritySelect = document.getElementById('priorityFilter').value;

    const filtered = (appState.activities || []).filter(act => {
        const matchesSearch = act.title.toLowerCase().includes(appState.searchKeyword);
        const matchesStatus = (appState.currentFilter === 'all') ||
            (appState.currentFilter === 'completed' && act.completed) ||
            (appState.currentFilter === 'pending' && !act.completed);
        const matchesPriority = (prioritySelect === 'all') || (act.priority === prioritySelect);

        return matchesSearch && matchesStatus && matchesPriority;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: #64748b; padding: 32px 16px;">
                    ✨ Tidak ada kegiatan yang cocok dengan pencarian atau filter.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(act => {
        const tr = document.createElement('tr');
        const isDone = act.completed;

        const priorityConfig = {
            'High': { bg: '#fee2e2', text: '#b91c1c', label: '🔴 High' },
            'Medium': { bg: '#fef3c7', text: '#b45309', label: '🟡 Medium' },
            'Low': { bg: '#ecfdf5', text: '#047857', label: '🟢 Low' }
        }[act.priority] || { bg: '#f1f5f9', text: '#475569', label: act.priority };

        const titleStyle = isDone ? 'text-decoration: line-through; color: #94a3b8;' : 'font-weight: 600; color: #0f172a;';

        tr.innerHTML = `
            <td style="${titleStyle}">${escapeHtml(act.title)}</td>
            <td style="color: #64748b; font-weight: 500;">📅 ${act.date}</td>
            <td>
                <span class="priority-pill" style="background:${priorityConfig.bg}; color:${priorityConfig.text};">
                    ${priorityConfig.label}
                </span>
            </td>
            <td>
                <span class="status-badge ${isDone ? 'done' : 'pending'}">
                    ${isDone ? '✓ Selesai' : '⏳ Tertunda'}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: inline-flex; gap: 6px;">
                    <button class="btn-action ${isDone ? 'btn-toggle-undo' : 'btn-toggle-done'}" onclick="toggleStatus(${act.id})">
                        ${isDone ? '↩️ Batal' : '✓ Ceklis'}
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteAct(${act.id})" title="Hapus Rencana">
                        🗑️
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function handleAddActivity(e) {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const date = document.getElementById('date').value;
    const priority = document.getElementById('priority').value;

    if (!title || !date) return;

    const nextId = appState.activities.length > 0 
        ? Math.max(...appState.activities.map(a => a.id)) + 1 
        : 1;

    const newActivity = {
        id: nextId,
        title: title,
        date: date,
        priority: priority,
        completed: false
    };

    appState.activities.unshift(newActivity);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.activities));
    
    document.getElementById('title').value = '';
    showToast('💾 Rencana baru tersimpan otomatis!');

    await syncWithBackend(appState.activities);
}

async function toggleStatus(id) {
    const act = appState.activities.find(a => a.id === id);
    if (act) {
        act.completed = !act.completed;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.activities));
        showToast(act.completed ? '✅ Kegiatan selesai dicentang (Tersimpan)' : '↩️ Status dikembalikan (Tersimpan)');
        await syncWithBackend(appState.activities);
    }
}

async function deleteAct(id) {
    if (!confirm('Apakah Anda yakin ingin membatalkan kegiatan ini?')) return;
    appState.activities = appState.activities.filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.activities));
    showToast('🗑️ Kegiatan dihapus (Tersimpan)');
    await syncWithBackend(appState.activities);
}

function setPresetDate(offsetDays) {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    document.getElementById('date').value = target.toISOString().split('T')[0];
}

function setPresetWeekend() {
    const today = new Date();
    const day = today.getDay();
    const diff = (6 - day + 7) % 7 || 7; 
    today.setDate(today.getDate() + diff);
    document.getElementById('date').value = today.toISOString().split('T')[0];
}

function applyQuickFilter(type) {
    appState.currentFilter = type;
    document.querySelectorAll('.tab-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === type);
    });
    updateActiveCardStyle();
    renderTable();
    showToast(`🔍 Memfilter kegiatan: ${type.toUpperCase()}`);
}

function updateActiveCardStyle() {
    document.getElementById('cardTotal').classList.toggle('active-filter', appState.currentFilter === 'all');
    document.getElementById('cardCompleted').classList.toggle('active-filter', appState.currentFilter === 'completed');
    document.getElementById('cardPending').classList.toggle('active-filter', appState.currentFilter === 'pending');
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    appState.searchKeyword = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    renderTable();
}

function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#0d9488', '#16a34a', '#d97706', '#3b82f6', '#f59e0b', '#ec4899'];

    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height * 0.3,
            size: Math.random() * 8 + 4,
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 4 - 2,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    let frames = 0;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });

        frames++;
        if (frames < 75) {
            requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    render();
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2400);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}
