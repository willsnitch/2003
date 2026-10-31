import base64, http.server, os, sys
OUT = sys.argv[1]
class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        name = os.path.basename(self.path.strip('/')) or 'shot.jpg'
        data = self.rfile.read(int(self.headers['Content-Length']))
        if data.startswith(b'data:'):
            data = base64.b64decode(data.split(b',', 1)[1])
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(data)
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, *a): pass
http.server.HTTPServer(('127.0.0.1', 8199), H).serve_forever()
