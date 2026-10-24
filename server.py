#!/usr/bin/env python3
"""Serve the editors and proxy API calls for the JSON client.

The browser cannot call a project API that does not allow this page.
This server makes the call itself, the same way Postman does.

    python3 server.py
    open http://127.0.0.1:8787/json/
"""

import json
import os
import ssl
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
MAX_BYTES = 8 * 1024 * 1024
TIMEOUT = 30
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
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/__proxy":
            self._send_json(200, {"ok": True, "proxy": True})
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/__proxy":
            self.send_error(404)
            return
        self._proxy()

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


def main():
    os.chdir(ROOT)
    server = ThreadingHTTPServer((HOST, PORT), EditorHandler)
    print("API client ready at http://%s:%s/json/" % (HOST, PORT))
    print("Project APIs are called by this server, so browser CORS does not block them.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()
