// Test harness for checking the game in the Browser pane. Not part of the game.
//
// 0. If http://localhost:8141 doesn't load, the server is down: preview_start { name: '2003' } (it
//    opens its own tab: pass that tabId to the browser tools).
// 1. Start the receiver (it saves frames as JPEGs): python3 -I tools/snap-receiver.py <folder> in the
//    background (it listens on 127.0.0.1:8199; use a scratch folder, not the project).
// 2. Open http://localhost:8141/?shot=1 at 1280x760 (resize_window — with the pane hidden the page can be 0 px),
//    wait ~8 s for it to build (the yard's textures take a while).
// 3. Run STEP 1 below, take one small screenshot (scale 0.2, so the game hands its loop over), then STEP 2.
// 4. grid('name.jpg', [[x, z, lookX, lookY, lookZ, fov], …]) puts you at each x, z looking at the point
//    and saves the pictures side by side (2 a row, 1100 px wide) as one JPEG: Read it from there. One grid
//    of 2–4 views per check — cheap. grab('name.jpg', x, z, …) is the single-view version.
//    It runs 30 frames per view, a pause every 5, so the eye's adaptation out in the yard (house.js gain) has settled.
// 5. Numbers beat pictures: read GAME.* in JS (GAME.house.scene.traverse, GAME.player.colliders…). A
//    raycast from the camera hits invisible helper planes 0.3–0.5 m in front of it: filter distance > 0.8.
// 6. Afterwards: pkill -f snap-receiver.py; resize_window preset 'desktop'; navigate to http://localhost:8141/.

// ---- STEP 1
window.__errs = [];
addEventListener('error', (e) => window.__errs.push(String(e.message)));
window.requestAnimationFrame = (cb) => { window.__cb = cb; return 0; };

// ---- STEP 2
if (!window.__cb) throw new Error('the loop was not handed over');
window.__now = performance.now();
performance.now = () => window.__now;
const P = GAME.player;
P.enabled = true;
window.frames = (n) => { for (let i = 0; i < n; i++) { P.edge.set(0, 0); window.__now += 25; window.__cb(); } }; // 40 frames = 1 s
window.stand = (x, z, tx, ty, tz, fov = 56, eye) => {
  P.setPose(x, z, 0, 0);
  P.yaw = Math.atan2(-(tx - x), -(tz - z));
  P.pitch = Math.atan2(ty - (eye ?? 1.22), Math.hypot(tx - x, tz - z));
  GAME.camera.fov = fov;
  GAME.camera.updateProjectionMatrix();
  frames(8);
};
window.grid = async (name, views, cols = 2) => {
  const c = GAME.renderer.domElement, tw = Math.round(1100 / cols), th = Math.round((tw * c.height) / c.width), rows = Math.ceil(views.length / cols);
  const s = document.createElement('canvas');
  s.width = tw * cols;
  s.height = th * rows;
  const x = s.getContext('2d');
  // (a breath between every few frames: 240 frames of the yard in one go lost the GPU, and Chrome then
  // refused WebGL to localhost — open the game as http://room.localhost:8141/ if that happens)
  for (const [i, v] of views.entries()) {
    stand(...v);
    for (let k = 0; k < 30; k += 5) { frames(5); await new Promise((r) => setTimeout(r, 30)); }
    frames(1);
    x.drawImage(c, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
  }
  return (await fetch('http://127.0.0.1:8199/' + name, { method: 'POST', body: s.toDataURL('image/jpeg', 0.85) })).status;
};
window.grab = async (name, ...a) => {
  if (a.length) stand(...a);
  frames(1);
  const c = GAME.renderer.domElement, s = document.createElement('canvas');
  s.width = 1100;
  s.height = Math.round((1100 * c.height) / c.width);
  s.getContext('2d').drawImage(c, 0, 0, s.width, s.height);
  return (await fetch('http://127.0.0.1:8199/' + name, { method: 'POST', body: s.toDataURL('image/jpeg', 0.88) })).status;
};
document.getElementById('prompt').style.visibility = 'hidden';
