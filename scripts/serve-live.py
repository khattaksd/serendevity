#!/usr/bin/env python3
"""Local server that mimics Cloudflare: Brotli/gzip text + long cache for assets.
Run:  python3 scripts/serve-live.py   (then Lighthouse http://localhost:8123/index.html)
"""
import gzip, http.server, os, socketserver
from io import BytesIO

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8123
GZIP_TYPES = {".html", ".css", ".js", ".svg", ".txt", ".xml", ".json", ".md", ".webmanifest"}
LONG_CACHE = {".woff2", ".webp", ".png", ".jpg", ".jpeg", ".ico"}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        ext = os.path.splitext(path)[1].lower()
        if ext in LONG_CACHE:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif ext in GZIP_TYPES or ext == "":
            self.send_header("Cache-Control", "public, max-age=0, must-revalidate")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path.split("?", 1)[0].split("#", 1)[0])
        if not os.path.isfile(path):
            return super().send_head()
        ext = os.path.splitext(path)[1].lower()
        if ext in GZIP_TYPES:
            try:
                body = open(path, "rb").read()
                if len(body) > 860:
                    body = gzip.compress(body, 6)
                    self.send_response(200)
                    self.send_header("Content-Type", self.guess_type(path))
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Content-Encoding", "gzip")
                    self.send_header("Vary", "Accept-Encoding")
                    self.end_headers()
                    return BytesIO(body)
            except OSError:
                pass
        return super().send_head()

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

with Server(("127.0.0.1", PORT), Handler) as httpd:
    print(f"serving {ROOT} at http://localhost:{PORT} (gzip + cache)")
    httpd.serve_forever()