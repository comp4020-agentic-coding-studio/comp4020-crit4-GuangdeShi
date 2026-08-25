#!/usr/bin/env python3
"""Tiny local static server + logging endpoint for the camera bellows test.

Serves index.html/app.js from this directory and appends every JSON sample
the page POSTs to /log into bellows-camera.log, so the live signal can be
inspected from the terminal instead of just eyeballing the page.
"""
import http.server
import os
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
LOG_PATH = HERE / "bellows-camera.log"


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/log":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            with LOG_PATH.open("a") as f:
                f.write(body.decode("utf-8") + "\n")
            self.send_response(204)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the terminal quiet; bellows-camera.log has the real data


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8934
    os.chdir(HERE)
    LOG_PATH.write_text("")
    httpd = http.server.HTTPServer(("127.0.0.1", port), Handler)
    print(f"serving on http://127.0.0.1:{port}")
    httpd.serve_forever()
