#!/usr/bin/env python3
"""Not part of the game: the game's folder served for measuring (CLAUDE.md, "Working cheaply"). Nothing in the project
is changed by it. Usage: python3 tools/measure-server.py <the game's folder> <port>, then open http://localhost:<port>/?shot=1
with any of:
  ?seeded   the same dice at every load (Math.random), so two loads can be compared pixel for pixel
  ?cold     a first visit: one small number in the shaders changed, so none is found kept by the browser
  ?slow     the two models (.glb) over an ordinary home line, 1.25 MB/s each
  ?gltrace  the first failing draws in window.__glerr (during loading and the first 3 s of play)
Always: window.__marks (when the loading line changed, ms), window.__long (long tasks), and a profile of the page's own
JS (const trace = await __prof.stop(): frames, stacks, samples — the sampling is every ~4 ms here, whatever is asked)."""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HEAD = b"""<script>
window.__t0 = performance.now();
if (location.search.includes('gltrace')) { const P = WebGL2RenderingContext.prototype, d = P.drawElements; window.__glerr = []; window.__gldraws = 0; P.drawElements = function (...a) { d.apply(this, a); if (__glerr.length < 2 && (!window.GAME || (window.__gameAt ??= performance.now()) > performance.now() - 3000)) { window.__gldraws++; const e = this.getError(); if (e) { const g = this, pr = g.getParameter(g.CURRENT_PROGRAM), info = { e, at: Math.round(performance.now()), drawNo: window.__gldraws }; try { info.link = g.getProgramParameter(pr, g.LINK_STATUS); info.log = (g.getProgramInfoLog(pr) || '').slice(0, 200); info.fbo = !!g.getParameter(g.DRAW_FRAMEBUFFER_BINDING); const at = (x) => { try { return g.getFramebufferAttachmentParameter(g.DRAW_FRAMEBUFFER, x, g.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE); } catch (er) { return 'x'; } }; info.color0 = at(g.COLOR_ATTACHMENT0); info.color1 = at(g.COLOR_ATTACHMENT1); info.depth = at(g.DEPTH_ATTACHMENT); info.status = g.checkFramebufferStatus(g.DRAW_FRAMEBUFFER); info.db = [g.getParameter(g.DRAW_BUFFER0), g.getParameter(g.DRAW_BUFFER1)]; info.colorMask = g.getParameter(g.COLOR_WRITEMASK); const n = g.getProgramParameter(pr, g.ACTIVE_UNIFORMS); info.samplers = []; for (let i = 0; i < n; i++) { const u = g.getActiveUniform(pr, i); if (u.type === g.SAMPLER_2D || u.type === g.SAMPLER_CUBE || u.type === 0x8B62 || u.type === 0x8DC5) { const unit = g.getUniform(pr, g.getUniformLocation(pr, u.name)); const was = g.getParameter(g.ACTIVE_TEXTURE); g.activeTexture(g.TEXTURE0 + (Array.isArray(unit) || unit.length ? unit[0] : unit)); info.samplers.push(u.name + ':' + (u.type === g.SAMPLER_2D ? '2D' : u.type === g.SAMPLER_CUBE ? 'cube' : 'shadow') + '@' + (unit.length ? unit[0] : unit) + (g.getParameter(g.TEXTURE_BINDING_2D) ? ' bound2D' : '') + (g.getParameter(g.TEXTURE_BINDING_CUBE_MAP) ? ' boundCube' : '')); g.activeTexture(was); } } info.outs = (g.getAttachedShaders(pr) || []).length; info.frag = g.getFragDataLocation(pr, 'pc_fragColor'); } catch (er) { info.err = String(er); } __glerr.push(info); } } }; }
document.cookie = 'cold=' + (location.search.includes('cold') ? '1' : '0') + '; path=/';
document.cookie = 'slow=' + (location.search.includes('slow') ? '1' : '0') + '; path=/';
if (location.search.includes('seeded')) { let a = 12345; Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
try { window.__prof = new Profiler({ sampleInterval: 10, maxBufferSize: 200000 }); } catch (e) { window.__profErr = String(e); }
window.__marks = []; window.__long = [];
(() => { let last = '';
  new MutationObserver(() => { const t = document.getElementById('start-status')?.textContent ?? ''; if (t !== last) { last = t; __marks.push([Math.round(performance.now()), t]); } })
    .observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) __long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  const mk = document.createElement.bind(document); window.__canv = [];
  document.createElement = function (n, ...a) { const el = mk(n, ...a); if (String(n).toLowerCase() === 'canvas') __canv.push(el); return el; };
})();
</script>
"""


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0] in ("/", "/index.html"):
            body = open(self.directory + "/index.html", "rb").read().replace(b"<head>", b"<head>\n" + HEAD, 1)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.split("?")[0].endswith(".glb") and "slow=1" in (self.headers.get("Cookie") or ""):
            # an ordinary home line: 20 Mbit/s between the two models when both are coming, 10 each
            import time
            data = open(self.directory + self.path.split("?")[0], "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", "model/gltf-binary")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            step = 125000  # bytes per tenth of a second: 1.25 MB/s
            for i in range(0, len(data), step):
                self.wfile.write(data[i:i + step])
                self.wfile.flush()
                time.sleep(0.1)
            return
        if self.path.split("?")[0] == "/js/build.js" and "cold=1" in (self.headers.get("Cookie") or ""):
            # a first visit, every time: one small number in the shaders changed, so none is found kept from before
            import random
            body = open(self.directory + "/js/build.js", "rb").read() + ("\nTHREE.ShaderChunk.common = THREE.ShaderChunk.common.replace('#define EPSILON 1e-6', '#define EPSILON 1.000%de-6');\n" % random.randint(1000, 9999)).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Document-Policy", "js-profiling")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    root, port = sys.argv[1], int(sys.argv[2])
    ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=root)).serve_forever()
