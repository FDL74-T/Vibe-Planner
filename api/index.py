import json
import calendar
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import os

# ==============================================================================
# 1. VARIABEL & STRUKTUR DATA
# ==============================================================================
APP_NAME: str = "VibePlanner"
PORT: int = int(os.environ.get("PORT", 8000))

# In-memory List 1D of Dictionaries
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
    {
        "id": 3,
        "title": "Setup Deployment Vercel",
        "date": "2026-10-08",
        "priority": "High",
        "completed": True,
    },
]

# ==============================================================================
# 2. FUNCTIONS & LOGIKA ALGORITMA
# ==============================================================================
def calculate_metrics(items: list[dict]) -> dict:
    """Menghitung metrik progres kegiatan."""
    total: int = len(items)
    if total == 0:
        return {"total": 0, "completed": 0, "pending": 0, "progress": 0.0}

    completed: int = sum(1 for item in items if item.get("completed", False))
    pending: int = total - completed
    progress: float = round((completed / total) * 100, 1)

    return {
        "total": total,
        "completed": completed,
        "pending": pending,
        "progress": progress
    }


def generate_calendar_matrix(year: int, month: int) -> list[list[int]]:
    """Array 2D (Minggu x Hari) kalender."""
    cal = calendar.Calendar(firstweekday=0)
    return cal.monthdayscalendar(year, month)


def get_calendar_payload(year: int = 2026, month: int = 10) -> dict:
    """Menyusun representasi data Array 2D kalender dan pemetaan kegiatan."""
    matrix = generate_calendar_matrix(year, month)
    activities_by_date = {}

    for act in activities:
        d = act["date"]
        if d not in activities_by_date:
            activities_by_date[d] = []
        activities_by_date[d].append(act)

    return {
        "year": year,
        "month": month,
        "month_name": calendar.month_name[month],
        "matrix": matrix,
        "activities_by_date": activities_by_date
    }


def toggle_activity_status(act_id: int) -> bool:
    """Toggle status selesai (True <-> False)."""
    for act in activities:
        if act["id"] == act_id:
            act["completed"] = not act["completed"]
            return True
    return False


def delete_activity(act_id: int) -> bool:
    """Menghapus elemen dari list."""
    for index, act in enumerate(activities):
        if act["id"] == act_id:
            activities.pop(index)
            return True
    return False


# ==============================================================================
# 3. HELPER: PENANGANAN FILE STATIS (Untuk Server Lokal)
# ==============================================================================
def find_static_file(filename: str) -> str:
    """Mencari lokasi berkas statis (root atau parent)."""
    if os.path.exists(filename):
        return filename
    parent_path = os.path.join(os.path.dirname(__file__), "..", filename)
    if os.path.exists(parent_path):
        return os.path.abspath(parent_path)
    return filename


# ==============================================================================
# 4. SERVERLESS REQUEST HANDLER
# ==============================================================================
class handler(BaseHTTPRequestHandler):
    def send_json(self, data: dict, status: int = 200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def serve_file(self, filepath: str, content_type: str):
        full_path = find_static_file(filepath)
        if os.path.exists(full_path):
            self.send_response(200)
            self.send_header("Content-Type", f"{content_type}; charset=utf-8")
            self.end_headers()
            with open(full_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        clean_path = urllib.parse.urlparse(self.path).path

        # 1. Endpoint API JSON: Mengirimkan Data State ke JavaScript
        if clean_path in ("/api/data", "/api/data/"):
            payload = {
                "metrics": calculate_metrics(activities),
                "calendar": get_calendar_payload(year=2026, month=10),
                "activities": activities
            }
            self.send_json(payload)

        # 2. Handler Statis untuk Pengujian Lokal
        elif clean_path in ("/", "/index.html"):
            self.serve_file("index.html", "text/html")
        elif clean_path == "/style.css":
            self.serve_file("style.css", "text/css")
        elif clean_path == "/script.js":
            self.serve_file("script.js", "application/javascript")
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        clean_path = urllib.parse.urlparse(self.path).path
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length).decode("utf-8")

        # Parsing Payload (JSON atau Form Data)
        data = {}
        if self.headers.get("Content-Type", "").startswith("application/json"):
            try:
                data = json.loads(raw_body)
            except Exception:
                data = {}
        else:
            parsed = urllib.parse.parse_qs(raw_body)
            data = {k: v[0] for k, v in parsed.items()}

        # 1. Endpoint Tambah Kegiatan
        if clean_path.endswith("/api/add") or clean_path == "/add":
            title = data.get("title", "").strip()
            date = data.get("date", "").strip()
            priority = data.get("priority", "Medium").strip()

            if title and date:
                next_id = max([act["id"] for act in activities], default=0) + 1
                activities.append({
                    "id": next_id,
                    "title": title,
                    "date": date,
                    "priority": priority,
                    "completed": False
                })
                self.send_json({"success": True})
            else:
                self.send_json({"error": "Data tidak lengkap"}, status=400)

        # 2. Endpoint Ceklis (Toggle Status Selesai)
        elif clean_path.endswith("/api/toggle") or clean_path == "/toggle":
            act_id = int(data.get("id", 0))
            success = toggle_activity_status(act_id)
            self.send_json({"success": success})

        # 3. Endpoint Hapus Kegiatan
        elif clean_path.endswith("/api/delete") or clean_path == "/delete":
            act_id = int(data.get("id", 0))
            success = delete_activity(act_id)
            self.send_json({"success": success})

        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, handler)
    print(f"[*] Server lokal aktif di http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Server dimatikan.")
        httpd.server_close()
