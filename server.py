#!/usr/bin/env python3
"""Serve the editors and proxy API calls for the JSON client.

The browser cannot call a project API that does not allow this page.
This server makes the call itself, the same way Postman does.

    python3 server.py
    open http://127.0.0.1:8787/json/
"""

import json
import os
import secrets
import ssl
import sys
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
MAX_BYTES = 8 * 1024 * 1024
TIMEOUT = 30
INTERVIEW_DIR = os.path.join(os.path.expanduser("~"), ".js-zero-interview")
BOOKINGS_FILE = os.path.join(INTERVIEW_DIR, "bookings.json")
PASSWORD_FILE = os.path.join(INTERVIEW_DIR, "password")
BMC_TOKEN_FILE = os.path.join(INTERVIEW_DIR, "bmc-token")
BMC_SUPPORTERS = "https://developers.buymeacoffee.com/api/v1/supporters"
interview_lock = threading.Lock()
SKIP_HEADERS = {
    "host",
    "content-length",
    "connection",
    "transfer-encoding",
    "keep-alive",
    "upgrade",
    "proxy-connection",
    "te",
    "trailer",
}


class EditorHandler(SimpleHTTPRequestHandler):
    # Safari's fetch cannot read an HTTP/1.0 body. It then reports
    # "The string did not match the expected pattern."
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.close_connection = True
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/__proxy":
            self._send_json(200, {"ok": True, "proxy": True})
            return
        if path.startswith("/.interview") or path.startswith("/.js-zero-interview"):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/__proxy":
            self._proxy()
            return
        if path == "/__interview":
            try:
                self._interview()
            except Exception:
                self._send_json(500, {"ok": False, "error": "Could not check the payment."})
            return
        self.send_error(404)

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 0 or length > 20000:
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None

    def _interview(self):
        payload = self._read_json()
        if not isinstance(payload, dict):
            self._send_json(400, {"ok": False, "error": "Send the booking as JSON."})
            return
        action = payload.get("action")
        if action == "check":
            self._check_interview_payment(payload)
            return
        if action == "book":
            self._book_interview(payload)
            return
        if action == "list":
            self._list_interviews(payload)
            return
        self._send_json(400, {"ok": False, "error": "Unknown request."})

    def _check_interview_payment(self, payload):
        email = _clip(payload.get("email"), 120)
        if "@" not in email or "." not in email.split("@")[-1]:
            self._send_json(400, {"ok": False, "error": "Add the email you used for the coffee."})
            return
        payment, problem = _find_coffee(email)
        if problem == "not-configured":
            self._send_json(503, {"ok": False, "error": "Payment check is not connected yet."})
            return
        if problem:
            self._send_json(502, {"ok": False, "error": "Could not reach Buy Me a Coffee."})
            return
        if not payment:
            self._send_json(402, {"ok": False, "error": "No coffee payment found for this email."})
            return
        if _coffee_already_used(payment["support_id"]):
            self._send_json(409, {"ok": False, "error": "This coffee was already used to book a slot."})
            return
        self._send_json(200, {"ok": True, "payment": _public_payment(payment), "name": payment.get("payer_name") or ""})

    def _book_interview(self, payload):
        email = _clip(payload.get("email"), 120)
        payment, problem = _find_coffee(email)
        if problem == "not-configured":
            self._send_json(503, {"ok": False, "error": "Payment check is not connected yet."})
            return
        if problem:
            self._send_json(502, {"ok": False, "error": "Could not reach Buy Me a Coffee."})
            return
        if not payment:
            self._send_json(402, {"ok": False, "error": "No coffee payment found for this email."})
            return
        if _coffee_already_used(payment["support_id"]):
            self._send_json(409, {"ok": False, "error": "This coffee was already used to book a slot."})
            return
        name = _clip(payload.get("name"), 80)
        phone = _clip(payload.get("phone"), 40)
        experience = _clip(payload.get("experience"), 80)
        times = _clip(payload.get("times"), 400)
        note = _clip(payload.get("note"), 1000)
        topics = payload.get("topics")
        if not isinstance(topics, list):
            topics = []
        topics = [_clip(item, 40) for item in topics if _clip(item, 40)][:8]
        if not name or "@" not in email or "." not in email.split("@")[-1]:
            self._send_json(400, {"ok": False, "error": "Add your name and a real email."})
            return
        if not times:
            self._send_json(400, {"ok": False, "error": "Add the days and times you can meet."})
            return
        booking = {
            "id": secrets.token_hex(6),
            "at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "name": name,
            "email": email,
            "phone": phone,
            "experience": experience,
            "topics": topics,
            "times": times,
            "note": note,
            "payment": _public_payment(payment),
        }
        with interview_lock:
            os.makedirs(INTERVIEW_DIR, exist_ok=True)
            rows = _read_bookings()
            rows.append(booking)
            with open(BOOKINGS_FILE, "w", encoding="utf-8") as handle:
                json.dump(rows, handle, indent=2)
        self._send_json(200, {"ok": True})

    def _list_interviews(self, payload):
        given = str(payload.get("password") or "")
        with interview_lock:
            expected = ""
            if os.path.exists(PASSWORD_FILE):
                with open(PASSWORD_FILE, encoding="utf-8") as handle:
                    expected = handle.read().strip()
        if not expected or not secrets.compare_digest(given, expected):
            self._send_json(401, {"ok": False, "error": "That password does not open the desk."})
            return
        with interview_lock:
            rows = list(reversed(_read_bookings()))
        self._send_json(200, {"ok": True, "bookings": rows})

    def _proxy(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 0 or length > MAX_BYTES:
            self._send_json(400, {"ok": False, "error": "Request body is too large."})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json(400, {"ok": False, "error": "The proxy expected a JSON request."})
            return

        url = str(payload.get("url") or "").strip()
        method = str(payload.get("method") or "GET").upper()
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            self._send_json(200, {"ok": False, "error": "Enter an http or https URL."})
            return
        if method not in ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"):
            self._send_json(200, {"ok": False, "error": "That method is not supported."})
            return

        headers = {}
        raw_headers = payload.get("headers") or {}
        if isinstance(raw_headers, dict):
            items = raw_headers.items()
        else:
            items = []
        for key, value in items:
            name = str(key).strip()
            if not name or name.lower() in SKIP_HEADERS:
                continue
            headers[name] = str(value)

        body = payload.get("body")
        data = None if body in (None, "") or method in ("GET", "HEAD") else str(body).encode("utf-8")
        request = Request(url, data=data, headers=headers, method=method)
        context = ssl._create_unverified_context() if payload.get("insecure") else ssl.create_default_context()

        try:
            with urlopen(request, timeout=TIMEOUT, context=context) as response:
                self._send_json(200, self._pack(response))
        except HTTPError as error:
            self._send_json(200, self._pack(error))
        except URLError as error:
            reason = getattr(error, "reason", error)
            self._send_json(200, {"ok": False, "error": "Could not reach the API: " + str(reason)})
        except Exception as error:
            self._send_json(200, {"ok": False, "error": "Could not reach the API: " + str(error)})

    def _pack(self, response):
        raw = response.read(MAX_BYTES + 1)
        truncated = len(raw) > MAX_BYTES
        if truncated:
            raw = raw[:MAX_BYTES]
        text = raw.decode("utf-8", errors="replace")
        header_rows = []
        for key in response.headers:
            for value in response.headers.get_all(key) or []:
                header_rows.append([key, value])
        return {
            "ok": True,
            "status": getattr(response, "status", None) or getattr(response, "code", 0),
            "statusText": getattr(response, "reason", "") or "",
            "headers": header_rows,
            "body": text,
            "url": response.geturl(),
            "truncated": truncated,
        }

    def _send_json(self, status, payload):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt, *args):
        if str(args[0]).startswith("GET /__proxy") or str(args[0]).startswith("POST /__proxy"):
            sys.stderr.write("%s\n" % (fmt % args))
            return
        super().log_message(fmt, *args)


def _clip(value, limit):
    return " ".join(str(value or "").split())[:limit]


def _bmc_token():
    if not os.path.exists(BMC_TOKEN_FILE):
        return ""
    with open(BMC_TOKEN_FILE, encoding="utf-8") as handle:
        return handle.read().strip()


def _coffee_already_used(support_id):
    for row in _read_bookings():
        payment = row.get("payment") or {}
        if payment.get("support_id") == support_id:
            return True
    return False


def _public_payment(payment):
    return {
        "support_id": payment.get("support_id"),
        "coffees": payment.get("coffees"),
        "price": payment.get("price"),
        "currency": payment.get("currency"),
        "paid_at": payment.get("paid_at"),
        "email": payment.get("email"),
    }


def _match_coffee(rows, email):
    wanted = email.strip().lower()
    for row in rows:
        if row.get("is_refunded") is True:
            continue
        addresses = [row.get("support_email"), row.get("payer_email")]
        if wanted not in [str(item or "").strip().lower() for item in addresses]:
            continue
        return {
            "support_id": row.get("support_id"),
            "coffees": row.get("support_coffees"),
            "price": row.get("support_coffee_price"),
            "currency": row.get("support_currency") or "USD",
            "paid_at": row.get("support_created_on") or "",
            "email": wanted,
            "payer_name": row.get("supporter_name") or row.get("payer_name") or "",
        }
    return None


def _find_coffee(email):
    token = _bmc_token()
    if not token:
        return None, "not-configured"
    url = BMC_SUPPORTERS
    for _ in range(6):
        request = Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
        try:
            with urlopen(request, timeout=TIMEOUT) as response:
                body = json.loads(response.read().decode("utf-8"))
        except HTTPError:
            return None, "bmc"
        except (URLError, json.JSONDecodeError, TimeoutError):
            return None, "bmc"
        rows = body.get("data") if isinstance(body, dict) else None
        if not isinstance(rows, list):
            return None, "bmc"
        found = _match_coffee(rows, email)
        if found:
            return found, None
        url = body.get("next_page_url") if isinstance(body, dict) else None
        if not url:
            return None, None
    return None, None


def _read_bookings():
    if not os.path.exists(BOOKINGS_FILE):
        return []
    try:
        with open(BOOKINGS_FILE, encoding="utf-8") as handle:
            rows = json.load(handle)
        return rows if isinstance(rows, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def _ensure_interview_desk():
    os.makedirs(INTERVIEW_DIR, exist_ok=True)
    if not os.path.exists(PASSWORD_FILE):
        with open(PASSWORD_FILE, "w", encoding="utf-8") as handle:
            handle.write(secrets.token_urlsafe(9))
    with open(PASSWORD_FILE, encoding="utf-8") as handle:
        password = handle.read().strip()
    print("Interview desk: http://%s:%s/interview-desk.html" % (HOST, PORT), flush=True)
    print("Interview desk password: %s" % password, flush=True)


def main():
    os.chdir(ROOT)
    _ensure_interview_desk()
    server = ThreadingHTTPServer((HOST, PORT), EditorHandler)
    print("API client ready at http://%s:%s/json/" % (HOST, PORT))
    print("Project APIs are called by this server, so browser CORS does not block them.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()
