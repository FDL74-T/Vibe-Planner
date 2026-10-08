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

document.addEventListener('DOMContentLoaded', () => {
    initLiveClock();

    setPresetDate(0);

    fetchData();

    document.getElementById('addActivityForm').addEventListener('submit', handleAddActivity);

    document.getElementById('searchInput').addEventListener('input', (e) => {
        appState.searchKeyword = e.target.value.toLowerCase();
        renderTable();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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

        const hourNum = now.getHours();
        let greeting = "Selamat malam";
        if (hourNum >= 4 && hourNum < 11) greeting = "Selamat pagi";
        else if (hourNum >= 11 && hourNum < 15) greeting = "Selamat siang";
        else if (hourNum >= 15 && hourNum < 18) greeting = "Selamat sore";

        document.getElementById('greetingText').innerText = `${greeting}, tetap produktif hari ini! ✨`;

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('currentDateStr').innerText = now.toLocaleDateString('id-ID', options);
    }
    updateClock();
    setInterval(updateClock, 1000);
}

async function fetchData() {
    try {
        const url = `/api/data?year=${appState.calendar.year}&month=${appState.calendar.month}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Gagal mengambil data');
        const data = await response.json();

        appState.activities = data.activities || [];
        appState.metrics = data.metrics || {};
        appState.calendar = data.calendar || appState.calendar;

        renderUI();
    } catch (error) {
        console.error(error);
        showToast('⚠️ Gagal terhubung ke backend Python.');
    }
}

function renderUI() {
    renderStats();
    renderCalendar();
    renderTable();
}

function renderStats() {
    const { total = 0, completed = 0, pending = 0, progress = 0 } = appState.metrics;

    animateNumber('statTotal', total);
    animateNumber('statCompleted', completed);
    animateNumber('statPending', pending);

    document.getElementById('statProgressLabel').innerText = `Selesai (${progress}%) 👆`;

    const bar = document.getElementById('progressBar');
    if (bar) {
        bar.style.width = progress + '%';
    }

    document.getElementById('countAll').innerText = total;
    document.getElementById('countCompleted').innerText = completed;
    document.getElementById('countPending').innerText = pending;

    // Selebrasi jika seluruh kegiatan rampung (100%)
    if (total > 0 && completed === total) {
        triggerConfetti();
    }
}

function animateNumber(elementId, targetNumber) {
    const el = document.getElementById(elementId);
    const startNumber = parseInt(el.innerText) || 0;
    if (startNumber === targetNumber) return;

    const duration = 600;
    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progressRate = Math.min(elapsed / duration, 1);
        const currentVal = Math.floor(startNumber + (targetNumber - startNumber) * progressRate);
        el.innerText = currentVal;

        if (progressRate < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            el.innerText = targetNumber;
        }
    }
    requestAnimationFrame(updateCounter);
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
    fetchData();
}

function renderCalendar() {
    const tbody = document.getElementById('calendarBody');
    tbody.innerHTML = '';

    document.getElementById('calendarTitle').innerText = 
        `Kalender: ${appState.calendar.month_name} ${appState.calendar.year}`;

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
                const year = appState.calendar.year;
                const month = String(appState.calendar.month).padStart(2, '0');
                const dayStr = String(day).padStart(2, '0');
                const dateKey = `${year}-${month}-${dayStr}`;

                td.className = 'cal-cell';
                if (dateKey === todayStr) {
                    td.classList.add('is-today');
                }

                td.onclick = () => selectCalendarDate(dateKey);
                td.innerHTML = `<span class="cal-date">${day}</span>`;

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
                <td colspan="5" style="text-align: center; color: #64748b; padding: 28px;">
                    ✨ Tidak ada kegiatan yang cocok dengan kriteria.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(act => {
        const tr = document.createElement('tr');
        const isDone = act.completed;

        const priorityColors = {
            'High': { bg: '#fee2e2', text: '#b91c1c' },
            'Medium': { bg: '#fef3c7', text: '#b45309' },
            'Low': { bg: '#ecfdf5', text: '#047857' }
        }[act.priority] || { bg: '#f1f5f9', text: '#475569' };

        const titleStyle = isDone ? 'text-decoration: line-through; color: #94a3b8;' : 'font-weight: 500; color: #0f172a;';

        tr.innerHTML = `
            <td style="${titleStyle}">${escapeHtml(act.title)}</td>
            <td style="color: #64748b;">📅 ${act.date}</td>
            <td>
                <span class="priority-pill" style="background:${priorityColors.bg}; color:${priorityColors.text};">
                    ${act.priority}
                </span>
            </td>
            <td>
                <span class="status-pill ${isDone ? 'done' : 'pending'}">
                    ${isDone ? '✓ Selesai' : '• Tertunda'}
                </span>
            </td>
            <td style="text-align: right;">
                <div style="display: inline-flex; gap: 6px;">
                    <button class="btn-action ${isDone ? 'btn-done' : 'btn-check'}" onclick="toggleStatus(${act.id})">
                        ${isDone ? '↩️ Batal' : '✓ Ceklis'}
                    </button>
                    <button class="btn-action btn-del" onclick="deleteAct(${act.id})" title="Hapus">
                        🗑️
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function applyQuickFilter(filterType) {
    appState.currentFilter = filterType;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-filter') === filterType);
    });
    updateActiveCardStyle();
    renderTable();
    showToast(`🔍 Menampilkan filter: ${filterType.toUpperCase()}`);
}

function updateActiveCardStyle() {
    document.getElementById('cardTotal').classList.toggle('active-card', appState.currentFilter === 'all');
    document.getElementById('cardCompleted').classList.toggle('active-card', appState.currentFilter === 'completed');
    document.getElementById('cardPending').classList.toggle('active-card', appState.currentFilter === 'pending');
}

function setPresetDate(offsetDays) {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    const dateStr = target.toISOString().split('T')[0];
    document.getElementById('date').value = dateStr;
}

function selectCalendarDate(dateString) {
    document.getElementById('date').value = dateString;
    showToast(`📅 Tanggal ${dateString} dipilih di formulir.`);
    document.getElementById('title').focus();
}

async function handleAddActivity(e) {
    e.preventDefault();
    const title = document.getElementById('title').value.trim();
    const date = document.getElementById('date').value;
    const priority = document.getElementById('priority').value;

    if (!title || !date) return;

    try {
        const res = await fetch('/api/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, date, priority })
        });
        if (res.ok) {
            document.getElementById('title').value = '';
            showToast('🎉 Kegiatan berhasil ditambahkan!');
            fetchData();
        }
    } catch (err) {
        showToast('❌ Gagal menambahkan kegiatan.');
    }
}

async function toggleStatus(id) {
    try {
        const res = await fetch('/api/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (res.ok) {
            fetchData();
        }
    } catch (err) {
        showToast('❌ Gagal memperbarui status.');
    }
}

async function deleteAct(id) {
    if (!confirm('Apakah Anda yakin ingin membatalkan kegiatan ini?')) return;
    try {
        const res = await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (res.ok) {
            showToast('🗑️ Kegiatan berhasil dihapus.');
            fetchData();
        }
    } catch (err) {
        showToast('❌ Gagal menghapus kegiatan.');
    }
}

function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#0d9488', '#16a34a', '#ea580c', '#3b82f6', '#facc15'];

    for (let i = 0; i < 70; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height * 0.4,
            size: Math.random() * 8 + 4,
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 4 - 2,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    let animationFrames = 0;
    function renderConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        });

        animationFrames++;
        if (animationFrames < 80) {
            requestAnimationFrame(renderConfetti);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    renderConfetti();
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2600);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}
