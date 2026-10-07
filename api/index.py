import json
import calendar
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import os

# ==============================================================================
# 1. VARIABEL & DATA
# ==============================================================================
APP_NAME: str = "VibePlanner"
PORT: int = int(os.environ.get("PORT", 8000))

# Data awal (in-memory)
activities: list[dict] = [
    {
        "id": 1,
        "title": "Review Algoritma & Flowchart",
        "date": "2026-10-10",
        "priority": "High",
        "completed": False,
    },
    {
        "id": 2,
        "title": "Praktek Looping & Array 2D",
        "date": "2026-10-15",
        "priority": "Medium",
        "completed": True,
    },
]

# ==============================================================================
# 2. LOGIKA & FUNCTIONS
# ==============================================================================
def calculate_progress(items: list[dict]) -> tuple[int, int, int, float]:
    total: int = len(items)
    if total == 0:
        return 0, 0, 0, 0.0
    completed: int = sum(1 for item in items if item.get("completed", False))
    pending: int = total - completed
    percentage: float = round((completed / total) * 100, 1)
    return total, completed, pending, percentage


def toggle_activity_status(act_id: int) -> bool:
    for act in activities:
        if act["id"] == act_id:
            act["completed"] = not act["completed"]
            return True
    return False


def delete_activity(act_id: int) -> bool:
    for index, act in enumerate(activities):
        if act["id"] == act_id:
            activities.pop(index)
            return True
    return False


def generate_calendar_matrix(year: int, month: int) -> list[list[int]]:
    cal = calendar.Calendar(firstweekday=0)
    return cal.monthdayscalendar(year, month)


def get_activities_for_date(items: list[dict], target_date_str: str) -> list[dict]:
    return [act for act in items if act["date"] == target_date_str]


# ==============================================================================
# 3. HTML & CSS RENDERING
# ==============================================================================
def render_html_page(year: int = 2026, month: int = 10) -> str:
    total, completed, pending, progress = calculate_progress(activities)
    month_name = calendar.month_name[month]
    matrix_2d = generate_calendar_matrix(year, month)

    table_rows_html = ""
    if activities:
        for act in activities:
            is_done = act["completed"]
            title_style = "text-decoration: line-through; color: #94a3b8;" if is_done else "color: #1e293b; font-weight: 500;"
            p_bg, p_color = {
                "High": ("#fee2e2", "#b91c1c"),
                "Medium": ("#fef3c7", "#b45309"),
                "Low": ("#ecfdf5", "#047857"),
            }.get(act["priority"], ("#f1f5f9", "#475569"))

            status_badge = '<span class="pill-done">✓ Selesai</span>' if is_done else '<span class="pill-pending">• Tertunda</span>'

            table_rows_html += f"""
            <tr>
                <td style="{title_style}">{act['title']}</td>
                <td style="color: #64748b;">{act['date']}</td>
                <td><span class="badge-priority" style="background:{p_bg}; color:{p_color};">{act['priority']}</span></td>
                <td>{status_badge}</td>
                <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 6px;">
                        <form method="POST" action="/toggle" style="margin:0;">
                            <input type="hidden" name="id" value="{act['id']}">
                            <button type="submit" class="btn-action {'btn-done' if is_done else 'btn-check'}">
                                {'Batal Selesai' if is_done else 'Ceklis'}
                            </button>
                        </form>
                        <form method="POST" action="/delete" style="margin:0;" onsubmit="return confirm('Hapus kegiatan ini?');">
                            <input type="hidden" name="id" value="{act['id']}">
                            <button type="submit" class="btn-action btn-del" title="Hapus">🗑️</button>
                        </form>
                    </div>
                </td>
            </tr>
            """
    else:
        table_rows_html = """
        <tr>
            <td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">
                Belum ada kegiatan yang direncanakan.
            </td>
        </tr>
        """

    calendar_cells_html = ""
    for week in matrix_2d:
        calendar_cells_html += "<tr>"
        for day in week:
            if day == 0:
                calendar_cells_html += "<td class='cal-empty'></td>"
            else:
                formatted_date = f"{year:04d}-{month:02d}-{day:02d}"
                day_acts = get_activities_for_date(activities, formatted_date)
                badges_html = ""
                for act in day_acts:
                    cls = "badge-cal-done" if act["completed"] else "badge-cal-pending"
                    icon = "✓ " if act["completed"] else "• "
                    badges_html += f"<div class='cal-badge {cls}'>{icon}{act['title']}</div>"

                calendar_cells_html += f"""
                <td class='cal-cell'>
                    <span class='cal-date'>{day}</span>
                    {badges_html}
                </td>
                """
        calendar_cells_html += "</tr>"

    return f"""
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{APP_NAME}</title>
        <style>
            * {{ box-sizing: border-box; }}
            body {{
                margin: 0;
                padding: 30px 20px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #f4f7f8;
                color: #1e293b;
            }}
            .wrapper {{ max-width: 1050px; margin: 0 auto; }}
            .header-bar {{ display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }}
            .brand-icon {{ width: 16px; height: 16px; background-color: #0d9488; border-radius: 50%; }}
            .header-title {{ margin: 0; font-size: 24px; font-weight: 700; color: #0f3c44; }}

            .stat-row {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }}
            .stat-card {{ background: #ffffff; border-radius: 10px; padding: 16px 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }}
            .stat-card.teal {{ border-left: 4px solid #0d9488; }}
            .stat-card.green {{ border-left: 4px solid #16a34a; }}
            .stat-card.orange {{ border-left: 4px solid #ea580c; }}
            .stat-value {{ font-size: 28px; font-weight: 700; color: #0f172a; }}
            .stat-label {{ font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 500; }}

            .content-grid {{ display: grid; grid-template-columns: 1fr 1.25fr; gap: 20px; margin-bottom: 20px; }}
            .card-panel {{ background: #ffffff; border-radius: 10px; padding: 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }}
            .panel-title {{ font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; }}

            .form-group {{ margin-bottom: 12px; }}
            .form-group label {{ display: block; font-size: 13px; font-weight: 500; color: #475569; margin-bottom: 5px; }}
            .form-group input, .form-group select {{ width: 100%; padding: 9px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; }}
            .btn-primary {{ width: 100%; padding: 10px; background: #0d9488; color: #ffffff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }}
            .btn-primary:hover {{ background: #0f766e; }}

            .table-wrap {{ border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }}
            table.styled-table {{ width: 100%; border-collapse: collapse; text-align: left; }}
            table.styled-table th {{ background-color: #e2f0ef; color: #115e59; padding: 10px 14px; font-size: 13px; font-weight: 600; }}
            table.styled-table td {{ padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }}
            table.styled-table tr:last-child td {{ border-bottom: none; }}

            .pill-done {{ background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; }}
            .pill-pending {{ background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; }}
            .badge-priority {{ font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 6px; }}

            .btn-action {{ padding: 4px 8px; font-size: 11px; border-radius: 5px; border: 1px solid #cbd5e1; background: #ffffff; cursor: pointer; }}
            .btn-check {{ color: #0284c7; border-color: #bae6fd; }}
            .btn-done {{ color: #64748b; background: #f8fafc; }}
            .btn-del {{ color: #dc2626; border-color: #fca5a5; }}

            table.cal-table {{ width: 100%; border-collapse: collapse; }}
            table.cal-table th {{ font-size: 12px; color: #64748b; padding: 8px 4px; text-align: center; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }}
            table.cal-table td.cal-cell {{ border: 1px solid #f1f5f9; height: 64px; vertical-align: top; padding: 5px; width: 14.28%; }}
            .cal-empty {{ background: #fafafa; border: 1px solid #f8fafc; }}
            .cal-date {{ font-size: 11px; font-weight: 600; color: #475569; }}
            .cal-badge {{ font-size: 10px; padding: 2px 4px; border-radius: 4px; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
            .badge-cal-pending {{ background: #e0f2fe; color: #0284c7; }}
            .badge-cal-done {{ background: #dcfce7; color: #16a34a; text-decoration: line-through; }}

            @media (max-width: 768px) {{
                .stat-row {{ grid-template-columns: 1fr; }}
                .content-grid {{ grid-template-columns: 1fr; }}
            }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="header-bar">
                <div class="brand-icon"></div>
                <h1 class="header-title">{APP_NAME}</h1>
            </div>

            <div class="stat-row">
                <div class="stat-card teal">
                    <div class="stat-value">{total}</div>
                    <div class="stat-label">Total kegiatan</div>
                </div>
                <div class="stat-card green">
                    <div class="stat-value">{completed}</div>
                    <div class="stat-label">Selesai ({progress}%)</div>
                </div>
                <div class="stat-card orange">
                    <div class="stat-value">{pending}</div>
                    <div class="stat-label">Sedang berjalan</div>
                </div>
            </div>

            <div class="content-grid">
                <div class="card-panel">
                    <h2 class="panel-title">Tambah Kegiatan</h2>
                    <form method="POST" action="/add">
                        <div class="form-group">
                            <label>Nama Kegiatan</label>
                            <input type="text" name="title" required placeholder="Contoh: Belajar Python List">
                        </div>
                        <div class="form-group">
                            <label>Tanggal Rencana</label>
                            <input type="date" name="date" required value="{year}-{month:02d}-10">
                        </div>
                        <div class="form-group">
                            <label>Tingkat Prioritas</label>
                            <select name="priority">
                                <option value="Low">Low</option>
                                <option value="Medium" selected>Medium</option>
                                <option value="High">High</option>
                            </select>
                        </div>
                        <button type="submit" class="btn-primary">+ Simpan Kegiatan</button>
                    </form>
                </div>

                <div class="card-panel">
                    <h2 class="panel-title">Kalender: {month_name} {year}</h2>
                    <table class="cal-table">
                        <thead>
                            <tr>
                                <th>Sen</th><th>Sel</th><th>Rab</th><th>Kam</th><th>Jum</th><th>Sab</th><th>Min</th>
                            </tr>
                        </thead>
                        <tbody>
                            {calendar_cells_html}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card-panel">
                <h2 class="panel-title">Daftar Rencana Kegiatan</h2>
                <div class="table-wrap">
                    <table class="styled-table">
                        <thead>
                            <tr>
                                <th>Nama Kegiatan</th>
                                <th>Tanggal</th>
                                <th>Prioritas</th>
                                <th>Status</th>
                                <th style="text-align: right;">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {table_rows_html}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </body>
    </html>
    """

# ==============================================================================
# 4. VERCEL SERVERLESS HANDLER
# ==============================================================================
class handler(BaseHTTPRequestHandler):
    """Class name 'handler' wajib untuk runtime Python Vercel Serverless."""

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        html_content = render_html_page(year=2026, month=10)
        self.wfile.write(html_content.encode("utf-8"))

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length).decode("utf-8")
        parsed_data = urllib.parse.parse_qs(post_data)

        # Parse rute URL
        clean_path = urllib.parse.urlparse(self.path).path

        if clean_path.endswith("/add"):
            title = parsed_data.get("title", [""])[0].strip()
            date = parsed_data.get("date", [""])[0].strip()
            priority = parsed_data.get("priority", ["Medium"])[0].strip()

            if title and date:
                next_id = max([item["id"] for item in activities], default=0) + 1
                activities.append({
                    "id": next_id,
                    "title": title,
                    "date": date,
                    "priority": priority,
                    "completed": False
                })

        elif clean_path.endswith("/toggle"):
            act_id_str = parsed_data.get("id", [""])[0]
            if act_id_str.isdigit():
                toggle_activity_status(int(act_id_str))

        elif clean_path.endswith("/delete"):
            act_id_str = parsed_data.get("id", [""])[0]
            if act_id_str.isdigit():
                delete_activity(int(act_id_str))

        self.send_response(303)
        self.send_header("Location", "/")
        self.end_headers()


# Jalankan server jika dijalankan secara lokal (python api/index.py)
if __name__ == "__main__":
    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, handler)
    print(f"[*] Server lokal aktif di http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Server dimatikan.")
        httpd.server_close()
