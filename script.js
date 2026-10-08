let appState = {
    activities: [],
    metrics: {},
    calendar: {},
    currentFilter: 'all',
    searchKeyword: ''
};

document.addEventListener('DOMContentLoaded', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = todayStr;

    fetchData();

    document.getElementById('addActivityForm').addEventListener('submit', handleAddActivity);

    document.getElementById('searchInput').addEventListener('input', (e) => {
        appState.searchKeyword = e.target.value.toLowerCase();
        renderTable();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            appState.currentFilter = e.target.getAttribute('data-filter');
            renderTable();
        });
    });
});

async function fetchData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error('Gagal mengambil data server');
        appState = { ...appState, ...(await response.json()) };

        renderUI();
    } catch (error) {
        console.error('Error fetching data:', error);
        showToast('⚠️ Gagal terhubung ke backend Python.');
    }
}

function renderUI() {
    renderHeader();
    renderStats();
    renderCalendar();
    renderTable();
}

function renderHeader() {
    if (appState.calendar && appState.calendar.month_name) {
        document.getElementById('headerDate').innerText = 
            `Bulan: ${appState.calendar.month_name} ${appState.calendar.year}`;
        document.getElementById('calendarTitle').innerText = 
            `Kalender: ${appState.calendar.month_name} ${appState.calendar.year}`;
    }
}

function renderStats() {
    const { total, completed, pending, progress } = appState.metrics;
    document.getElementById('statTotal').innerText = total || 0;
    document.getElementById('statCompleted').innerText = completed || 0;
    document.getElementById('statPending').innerText = pending || 0;
    document.getElementById('statProgressLabel').innerText = `Selesai (${progress || 0}%)`;

    const bar = document.getElementById('progressBar');
    if (bar) {
        setTimeout(() => { bar.style.width = (progress || 0) + '%'; }, 100);
    }
}

// 4. Render Kalender (Membaca Array 2D Matriks dari Python)
function renderCalendar() {
    const tbody = document.getElementById('calendarBody');
    tbody.innerHTML = '';

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
                const formattedDate = `${year}-${month}-${dayStr}`;

                td.className = 'cal-cell';
                if (formattedDate === todayStr) {
                    td.classList.add('is-today');
                }

                td.onclick = () => selectCalendarDate(formattedDate);

                td.innerHTML = `<span class="cal-date">${day}</span>`;

                const dayActs = activitiesByDate[formattedDate] || [];
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

    const filtered = (appState.activities || []).filter(act => {
        const matchesSearch = act.title.toLowerCase().includes(appState.searchKeyword);
        const matchesStatus = (appState.currentFilter === 'all') ||
            (appState.currentFilter === 'completed' && act.completed) ||
            (appState.currentFilter === 'pending' && !act.completed);

        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: #64748b; padding: 24px;">
                    Tidak ada kegiatan yang cocok dengan kriteria.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(act => {
        const tr = document.createElement('tr');

        const priorityColors = {
            'High': { bg: '#fee2e2', text: '#b91c1c' },
            'Medium': { bg: '#fef3c7', text: '#b45309' },
            'Low': { bg: '#ecfdf5', text: '#047857' }
        }[act.priority] || { bg: '#f1f5f9', text: '#475569' };

        const isDone = act.completed;
        const titleStyle = isDone ? 'text-decoration: line-through; color: #94a3b8;' : 'font-weight: 500;';

        tr.innerHTML = `
            <td style="${titleStyle}">${escapeHtml(act.title)}</td>
            <td style="color: #64748b;">${act.date}</td>
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
                        ${isDone ? 'Batal' : 'Ceklis'}
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
            showToast('✅ Kegiatan berhasil disimpan!');
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
    if (!confirm('Apakah Anda yakin ingin menghapus kegiatan ini?')) return;
    try {
        const res = await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (res.ok) {
            showToast('🗑️ Kegiatan telah dihapus.');
            fetchData();
        }
    } catch (err) {
        showToast('❌ Gagal menghapus kegiatan.');
    }
}

function selectCalendarDate(dateString) {
    const input = document.getElementById('date');
    if (input) {
        input.value = dateString;
        showToast(`📅 Tanggal ${dateString} dipilih di formulir.`);
        input.focus();
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2500);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}
