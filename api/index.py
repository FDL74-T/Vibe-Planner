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

# Berkas penyimpanan permanen (menggunakan /tmp di lingkungan Vercel)
STORAGE_FILE = "/tmp/activities_data.json" if os.environ.get("VERCEL") else "activities_data.json"

DEFAULT_ACTIVITIES: list[dict] = [
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
# 2. FILE HANDLING (Penyimpanan Berkas JSON)
# ==============================================================================
def load_activities() -> list[dict]:
    """Membaca data kegiatan dari berkas JSON."""
    if os.path.exists(STORAGE_FILE):
        try:
            with open(STORAGE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return DEFAULT_ACTIVITIES.copy()
    return DEFAULT_ACTIVITIES.copy()


def save_activities(items: list[dict]) -> None:
    """Menulis data kegiatan ke berkas JSON."""
    try:
        with open(STORAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving to file: {e}")


activities: list[dict] = load_activities()

# ==============================================================================
# 3. LOGIKA & FUNCTIONS PYTHON
# ==============================================================================
def calculate_metrics(items: list[dict]) -> dict:
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
    """Membuat matriks Array 2D kalender."""
    cal = calendar.Calendar(firstweekday=0)
    return cal.monthdayscalendar(year, month)


def get_calendar_payload(items: list[dict], year: int, month: int) -> dict:
    matrix = generate_calendar_matrix(year, month)
    activities_by_date = {}

    for act in items:
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


def find_static_file(filename: str) -> str:
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
        parsed_url = urllib.parse.urlparse(self.path)
        clean_path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # 1. API: Data & Kalender Bulanan
        if clean_path in ("/api/data", "/api/data/"):
            global activities
            activities = load_activities()
            year = int(query_params.get("year", [2026])[0])
            month = int(query_params.get("month", [10])[0])

            payload = {
                "metrics": calculate_metrics(activities),
                "calendar": get_calendar_payload(activities, year=year, month=month),
                "activities": activities
            }
            self.send_json(payload)

        # 2. File Statis untuk Pengujian Lokal
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
        query_params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length).decode("utf-8")

        data = {}
        try:
            data = json.loads(raw_body)
        except Exception:
            data = {}

        global activities

        # Endpoint Sinkronisasi Auto-Save
        if clean_path.endswith("/api/sync") or clean_path == "/sync":
            new_activities = data.get("activities", [])
            activities = new_activities
            save_activities(activities)

            year = int(query_params.get("year", [2026])[0])
            month = int(query_params.get("month", [10])[0])

            payload = {
                "metrics": calculate_metrics(activities),
                "calendar": get_calendar_payload(activities, year=year, month=month),
                "activities": activities
            }
            self.send_json(payload)

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
