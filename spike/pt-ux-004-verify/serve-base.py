#!/usr/bin/env python3
"""Serve app/dist under the /pdf-tools/ base path — mirrors GitHub Pages.

PT-UX-004 e2e: production asset URLs are /pdf-tools/assets/... and routes are
/pdf-tools/<tool>/; this server maps the prefix onto dist/ so the built site
can be verified locally exactly as it will be served.
"""
import http.server
import os
import sys
import urllib.parse

DIST = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "app", "dist"))
BASE = "/pdf-tools/"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173


class BasePathHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        parsed = urllib.parse.urlsplit(urllib.parse.unquote(path))
        p = parsed.path
        if p == BASE or p == BASE.rstrip("/"):
            p = "/index.html"
        elif p.startswith(BASE):
            p = p[len(BASE) - 1:]  # keep leading slash
        # clean URLs: /pdf-tools/merge -> merge/index.html
        if p != "/" and not os.path.splitext(p)[1]:
            p = p.rstrip("/") + "/index.html"
        return os.path.join(DIST, p.lstrip("/"))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print(f"serving {DIST} at http://127.0.0.1:{PORT}/pdf-tools/")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), BasePathHandler).serve_forever()
