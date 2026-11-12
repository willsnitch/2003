// Not part of the game: the same walk in two loads, compared pixel for pixel (notes/tech.md, "Speed: the method").
// Used 2026-11-11 for the rehearsal (main.js): bedroom, Luna, the bathroom dry, its water, her boat, her diving suit.
//
// 1. Serve with tools/measure-server.py and open  /?shot=1&seeded=1  (+ the switch being compared, e.g. &norehearsal=1).
// 2. AT ONCE, while it is still loading, run STEP 1 in the page: no frame is drawn and no time passes but what this
//    script steps, so two loads go through the same frames (Math.random is ?seeded's).
// 3. When GAME is there: eval this file (fetch('/tools/same-picture.js').then(r => r.text()).then(eval)), then call
//    await samePicture('A') again and again until it says done (each call runs ~20 s); in the other load 'B'.
//    The second one to finish reports, view by view: `same` (every pixel equal) or how far apart they are.
//
// ---- STEP 1 (paste while loading)
// window.__realNow = performance.now.bind(performance); window.__now = 1000; performance.now = () => window.__now;
// window.requestAnimationFrame = (cb) => { if (cb.name === 'tick') window.__cb = cb; return 0; };

window.samePicture = async (tag) => {
  const G = GAME, P = G.player, H = G.house, S = H.bath.state, B = H.bathroom, T3 = G.THREE;
  const Q = (window.__seq ??= { phase: 0, f: 0, views: {}, notes: [] });
  if (!window.__cb) throw new Error('the loop was not handed over (STEP 1, while loading)');
  if (Q.phase === 0) {
    await G.rehearsed.finish();
    // the dice from here on, the same in both loads: three draws from Math.random for every object it makes, and
    // whatever the loading made more of in one load (the rehearsal's own pictures, 2026-11-11) left Luna's tail
    // somewhere else in the other — a difference of the test's, not of the game's
    let a = 20031118;
    Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    P.enabled = true;
    Q.phase = 1;
  }
  const frame = () => { P.edge.set(0, 0); window.__now += 25; window.__cb(); Q.f++; };
  const look = (x, z, tx, ty, tz) => { P.setPose(x, z, 0, 0); P.yaw = Math.atan2(-(tx - x), -(tz - z)); P.pitch = Math.atan2(ty - 1.22, Math.hypot(tx - x, tz - z)); };
  const turnTo = (tx, ty, tz) => { const x = P.pos.x, z = P.pos.y; P.yaw = Math.atan2(-(tx - x), -(tz - z)); P.pitch = Math.atan2(ty - G.camera.position.y, Math.hypot(tx - x, tz - z)); };
  const grab = (name) => {
    frame(); frame();
    const c = G.renderer.domElement, s = document.createElement('canvas');
    s.width = c.width; s.height = c.height;
    const g = s.getContext('2d', { willReadFrequently: true });
    g.drawImage(c, 0, 0);
    const d = g.getImageData(0, 0, s.width, s.height).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619) >>> 0;
    const tw = 96, th = Math.round((96 * s.height) / s.width), t = document.createElement('canvas');
    t.width = tw; t.height = th;
    const tg = t.getContext('2d', { willReadFrequently: true });
    tg.drawImage(s, 0, 0, tw, th);
    Q.views[name] = { h, f: Q.f, thumb: Array.from(tg.getImageData(0, 0, tw, th).data) };
  };
  const cat = () => G.cat.pos;
  const until = (cond, most) => { let n = 0; while (!cond() && n++ < most) frame(); return n; };
  const t0 = window.__realNow(), time = () => window.__realNow() - t0 < 18000;
  const steps = [
    () => { for (let i = 0; i < 8; i++) frame(); grab('bedroom'); },
    () => { look(cat().x + 0.9, cat().z + 0.7, cat().x, 0.2, cat().z); grab('luna in the bedroom'); },
    () => { H.bathDoor.turn(true); look(4.14, B.z0 + 2.2, 4.14, 1.0, B.z1); for (let i = 0; i < 120; i++) frame(); grab('bathroom, dry'); },
    () => { turnTo(cat().x, 0.2, cat().z); grab('luna in the bathroom'); Q.notes.push('cat ' + cat().x.toFixed(3) + ',' + cat().z.toFixed(3)); },
    () => { if (H.bathDoor.state.open) H.bathDoor.turn(false); for (let i = 0; i < 60; i++) frame(); let taps = null; H.scene.traverse((o) => { const it = o.userData.interact; if (it && !taps && it.label?.() === 'Turn on the taps') taps = it; }); taps.use(); look(4.14, B.z1 - 2.2, 4.14, 0.5, B.z1 - 0.3); },
    () => { for (let i = 0; i < 300; i++) frame(); },
    () => { for (let i = 0; i < 300; i++) frame(); grab('the bath filling'); },
    () => until(() => S.spread >= 1, 500) < 500 || time(),
    () => until(() => S.spread >= 1, 500) < 500 || time(),
    () => until(() => S.spread >= 1, 500) < 500 || time(),
    () => { until(() => S.flood >= 0.06, 400); look(4.14, B.z1 - 3.2, 4.14, 0.3, B.z1 - 0.6); grab('water on the floor'); },
    () => { S.boost = 5; until(() => S.flood >= 0.45, 600); S.boost = 1; },
    () => { for (let i = 0; i < 80; i++) frame(); turnTo(G.boat.boat.position.x, G.boat.boat.position.y + 0.15, G.boat.boat.position.z); grab('luna in her boat'); Q.notes.push('boat ' + G.boat.boat.position.x.toFixed(3) + ',' + G.boat.boat.position.z.toFixed(3) + ' ride ' + !!G.cat.ride); },
    () => { S.boost = 5; until(() => S.flood >= 1.6, 500); },
    () => { until(() => S.flood >= 1.6, 500); S.boost = 1; },
    () => until(() => G.boat.gear.worn, 500) < 500 || time(),
    () => until(() => G.boat.gear.worn, 500) < 500 || time(),
    () => until(() => G.boat.gear.worn, 500) < 500 || time(),
    () => until(() => G.boat.gear.worn, 500) < 500 || time(),
    () => { until(() => !!G.cat.dive, 600); for (let i = 0; i < 120; i++) frame(); turnTo(cat().x, G.cat.root.position.y + 0.15, cat().z); grab('luna in her suit'); Q.notes.push('worn ' + G.boat.gear.worn + ' dive ' + !!G.cat.dive + ' flood ' + S.flood.toFixed(3)); },
  ];
  while (Q.phase <= steps.length && time()) { steps[Q.phase - 1](); Q.phase++; }
  if (Q.phase <= steps.length) return 'at step ' + Q.phase + ' of ' + steps.length + ', frame ' + Q.f + ': call again';
  sessionStorage.setItem('same-picture-' + tag, JSON.stringify({ views: Q.views, notes: Q.notes, frames: Q.f }));
  const other = sessionStorage.getItem('same-picture-' + (tag === 'A' ? 'B' : 'A'));
  if (!other) return 'done (' + Q.f + ' frames): kept as ' + tag + '; now the other load';
  const O = JSON.parse(other), out = { frames: [Q.f, O.frames], notes: [Q.notes.join(' | '), O.notes.join(' | ')] };
  for (const name of Object.keys(Q.views)) {
    const a = Q.views[name], b = O.views[name];
    if (!b) { out[name] = 'missing in the other'; continue; }
    if (a.h === b.h) { out[name] = 'same'; continue; }
    let sum = 0, worst = 0, n = 0;
    for (let i = 0; i < a.thumb.length; i++) { if (i % 4 === 3) continue; const d = Math.abs(a.thumb[i] - b.thumb[i]); sum += d; worst = Math.max(worst, d); if (d > 2) n++; }
    out[name] = 'differs: mean ' + (sum / (a.thumb.length * 0.75)).toFixed(3) + ' of 255, worst ' + worst + ', ' + n + ' of ' + a.thumb.length * 0.75 + ' thumb values over 2 (frames ' + a.f + '/' + b.f + ')';
  }
  return JSON.stringify(out);
};
'samePicture is here: await samePicture("A")';
