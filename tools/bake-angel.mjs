// Bakes the stone angel at the pool's end (user, 2026-11-02, after his frontal photograph: "copy it accurately, the quality
// of the sculpture and the wear"): great wings of two lobes, long blade and scalloped fan, rows of scale feathers; wavy hair
// falling to the shoulders, the face looking down; a round gathered neckline, the gown's folds fanning to a high girdle; one
// arm straight down, a closed fist; the other bent, its hand on the breast, cloth over the forearm; the long skirt in deep
// folds; stone gone pitted, lichen and black mould over it. Too fine to work out when the game loads, so it is done here,
// once, into assets/models/angel.bin (pool.js loads it). Not part of the game.
//
//   node tools/bake-angel.mjs [cell, metres; default 0.0065] [--preview folder]
//
// --preview writes front / three-quarter / side pictures (PPM) of the result, as points, to look at without the game.
// Frame: metres; y up from the ground under its rocks, it faces +z, x to the right as you look at it.
import { writeFileSync } from 'node:fs';

const arg = process.argv.slice(2), previewAt = arg.indexOf('--preview');
const preview = previewAt >= 0 ? arg[previewAt + 1] : null, C = +arg.find((a, i) => !a.startsWith('--') && i !== previewAt + 1) || 0.0065;
const OUT = new URL('../assets/models/angel.bin', import.meta.url);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), S = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hypot = (a, b, c = 0) => Math.sqrt(a * a + b * b + c * c);
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
const lerp = (a, b, t) => a + (b - a) * t;
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// value noise
const P = new Float32Array(65536), R0 = rng(7001);
for (let i = 0; i < 65536; i++) P[i] = R0();
const lat = (i, j, k) => P[(Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(k, 83492791)) & 65535];
const vn = (x, y, z) => {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), u = x - i, v = y - j, w = z - k, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), c = w * w * (3 - 2 * w);
  const l = (d, e, f) => lat(i + d, j + e, k + f);
  return lerp(lerp(lerp(l(0, 0, 0), l(1, 0, 0), a), lerp(l(0, 1, 0), l(1, 1, 0), a), b), lerp(lerp(l(0, 0, 1), l(1, 0, 1), a), lerp(l(0, 1, 1), l(1, 1, 1), a), b), c);
};
const fbm = (x, y, z, o = 3) => { let s = 0, m = 0.5, n = 0; for (let i = 0; i < o; i++) { s += vn(x, y, z) * m; n += m; m *= 0.5; x *= 2.03; y *= 2.03; z *= 2.03; } return s / n; };
const ell = (x, y, z, rx, ry, rz) => { const k0 = hypot(x / rx, y / ry, z / rz), k1 = hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz)); return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz); };
const cone = (x, y, z, a, b, r1, r2) => {
  const pax = x - a[0], pay = y - a[1], paz = z - a[2], bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (r1 + (r2 - r1) * h);
};
const norm = (v) => { const l = hypot(...v); return v.map((a) => a / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ---------------------------------------------------------------- the wing, as a picture: feathers laid tier over tier
// In the wing's plane, measured off his photograph: s out from the figure's middle, c up from the rocks' top. H: how far its
// carved face stands off the slab; D: how far outside the wing's outline (below 0 inside).
const WS = 0.002, WX0 = 0.06, WX1 = 0.8, WY0 = 0.96, WY1 = 1.84, WW = Math.round((WX1 - WX0) / WS), WH = Math.round((WY1 - WY0) / WS);
function wingPicture(seed) {
  const r = rng(seed), H = new Float32Array(WW * WH), M = new Uint8Array(WW * WH), G = new Float32Array(WW * WH);
  const feather = (s0, c0, s1, c1, W, base, dome, wear = true) => { // from its root to its tip
    const L = hypot(s1 - s0, c1 - c0), ds = (s1 - s0) / L, dc = (c1 - c0) / L, broken = wear && r() < 0.06 ? 0.8 + r() * 0.15 : 1, lean = (r() - 0.5) * 0.3;
    const i0 = Math.max(0, Math.floor((Math.min(s0, s1) - W - WX0) / WS)), i1 = Math.min(WW - 1, Math.ceil((Math.max(s0, s1) + W - WX0) / WS));
    const j0 = Math.max(0, Math.floor((Math.min(c0, c1) - W - WY0) / WS)), j1 = Math.min(WH - 1, Math.ceil((Math.max(c0, c1) + W - WY0) / WS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ps = WX0 + i * WS - s0, pc = WY0 + j * WS - c0, t = (ps * ds + pc * dc) / L; let q = -ps * dc + pc * ds;
      if (t < 0 || t > broken) continue;
      q -= lean * W * t * t;
      const tip = t / broken, wf = W * (tip < 0.6 ? 0.55 + 0.45 * Math.sqrt(tip / 0.6) : Math.sqrt(Math.max(0, 1 - ((tip - 0.6) / 0.4) ** 2.3)));
      if (Math.abs(q) >= wf) continue;
      const e = 1 - Math.abs(q) / wf;
      H[j * WW + i] = base + dome * Math.sqrt(e) * (0.6 + 0.4 * tip) + 0.0022 * Math.exp(-((q / 0.0032) ** 2)) * (1 - tip * 0.5); // domed, its rib down the middle
      G[j * WW + i] = Math.max(1 - Math.min(1, (wf - Math.abs(q)) / 0.006), S(tip, 0.9, 0.985)); // (its edge: the cut round it)
      M[j * WW + i] = 1;
    }
  };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  // the lower lobe: the fan of round-ended feathers
  const FAN = [[0.487, 1.4], [0.487, 1.352], [0.472, 1.305], [0.447, 1.262], [0.415, 1.215], [0.385, 1.17], [0.353, 1.128], [0.32, 1.095], [0.283, 1.07]];
  for (let i = FAN.length - 1; i >= 0; i--) { const u = i / (FAN.length - 1), rt = mix([0.2, 1.45], [0.19, 1.16], u); feather(rt[0], rt[1], FAN[i][0] + (r() - 0.5) * 0.008, FAN[i][1] + (r() - 0.5) * 0.008, 0.044 - u * 0.006, (FAN.length - 1 - i) * 0.0032, 0.0095); }
  // the long blade: its feathers lying out along the top, to the tip
  const BLADE = [[0.707, 1.722], [0.668, 1.668], [0.635, 1.618], [0.602, 1.57], [0.562, 1.522], [0.523, 1.475], [0.487, 1.432]];
  for (let i = BLADE.length - 1; i >= 0; i--) { const u = i / (BLADE.length - 1), rt = mix([0.31, 1.625], [0.25, 1.46], u); feather(rt[0], rt[1], BLADE[i][0], BLADE[i][1], 0.034 - (1 - u) * 0.006, 0.028 + (BLADE.length - 1 - i) * 0.0032, 0.0095); }
  // rows of scale feathers over their roots, curving with the wing's front edge; the leading edge itself
  const Q = [[0.165, 1.34], [0.24, 1.52], [0.33, 1.625], [0.5, 1.678], [0.69, 1.722]], qAt = (t) => { const f = clamp(t, 0, 0.9999) * (Q.length - 1), k = Math.floor(f), e = f - k; const p0 = Q[Math.max(0, k - 1)], p1 = Q[k], p2 = Q[k + 1], p3 = Q[Math.min(Q.length - 1, k + 2)], cr = (a, b, c, d, w) => 0.5 * (2 * b + (c - a) * w + (2 * a - 5 * b + 4 * c - d) * w * w + (3 * b - a - 3 * c + d) * w * w * w); return [cr(p0[0], p1[0], p2[0], p3[0], e), cr(p0[1], p1[1], p2[1], p3[1], e)]; };
  for (let row = 3; row >= 0; row--) {
    const reach = 0.92 - row * 0.14, d = 0.04 + row * 0.044, L = 0.085 + row * 0.014, W = 0.0245 + row * 0.0028;
    for (let t = reach; t >= 0.015; t -= 0.036 / (Q.length * 0.2)) {
      const a = qAt(t), b = qAt(t + 0.01), tl = hypot(b[0] - a[0], b[1] - a[1]) || 1, ts = (b[0] - a[0]) / tl, tc = (b[1] - a[1]) / tl, ps = tc, pc = -ts; // (across it, outwards and down)
      const rs = a[0] + ps * d + (r() - 0.5) * 0.008, rc = a[1] + pc * d + (r() - 0.5) * 0.008, dir = [ps * 0.82 + ts * 0.57, pc * 0.82 + tc * 0.57];
      feather(rs, rc, rs + dir[0] * L, rc + dir[1] * L, W, 0.052 + (3 - row) * 0.0085, 0.0085);
    }
  }
  for (let t = 0.98; t >= 0.0; t -= 0.012) { const a = qAt(t), b = qAt(t + 0.01), tl = hypot(b[0] - a[0], b[1] - a[1]) || 1, ts = (b[0] - a[0]) / tl, tc = (b[1] - a[1]) / tl; feather(a[0] + tc * 0.013, a[1] - ts * 0.013, a[0] + tc * 0.013 + tc * 0.045 + ts * 0.03, a[1] - ts * 0.013 - ts * 0.045 + tc * 0.03, 0.0135, 0.086, 0.005); }
  // the wing's front edge, a rounded ridge
  for (let t = 0; t <= 1; t += 0.002) {
    const a = qAt(t), rad = lerp(0.024, 0.011, t);
    for (let j = Math.floor((a[1] - rad - WY0) / WS); j <= (a[1] + rad - WY0) / WS; j++) for (let i = Math.floor((a[0] - rad - WX0) / WS); i <= (a[0] + rad - WX0) / WS; i++) {
      if (i < 0 || j < 0 || i >= WW || j >= WH) continue;
      const dd = hypot(WX0 + i * WS - a[0], WY0 + j * WS - a[1]);
      if (dd >= rad) continue;
      const h = 0.082 + 0.018 * Math.sqrt(1 - (dd / rad) ** 2), n = j * WW + i;
      H[n] = Math.max(H[n], h); M[n] = 1;
    }
  }
  // how far outside the outline, by a chamfer sweep both ways
  const far = 1e3, Dout = new Float32Array(WW * WH), Din = new Float32Array(WW * WH), sweep = (D) => {
    const a = WS, b = WS * 1.414, at = (i, j) => (i < 0 || j < 0 || i >= WW || j >= WH ? far : D[j * WW + i]);
    for (let j = 0; j < WH; j++) for (let i = 0; i < WW; i++) D[j * WW + i] = Math.min(D[j * WW + i], at(i - 1, j) + a, at(i, j - 1) + a, at(i - 1, j - 1) + b, at(i + 1, j - 1) + b);
    for (let j = WH - 1; j >= 0; j--) for (let i = WW - 1; i >= 0; i--) D[j * WW + i] = Math.min(D[j * WW + i], at(i + 1, j) + a, at(i, j + 1) + a, at(i + 1, j + 1) + b, at(i - 1, j + 1) + b);
  };
  for (let n = 0; n < WW * WH; n++) { Dout[n] = M[n] ? 0 : far; Din[n] = M[n] ? far : 0; }
  sweep(Dout); sweep(Din);
  const D = new Float32Array(WW * WH);
  for (let n = 0; n < WW * WH; n++) D[n] = Dout[n] - Din[n];
  const Hb = H.slice(); // (weathered: every edge softened a little)
  for (let j = 1; j < WH - 1; j++) for (let i = 1; i < WW - 1; i++) { const n = j * WW + i; H[n] = (Hb[n] * 2 + Hb[n - 1] + Hb[n + 1] + Hb[n - WW] + Hb[n + WW]) / 6; }
  return { H, D, G };
}
const pic = (A, s, c, off) => {
  const fx = (s - WX0) / WS, fy = (c - WY0) / WS;
  if (fx < 0 || fy < 0 || fx >= WW - 1 || fy >= WH - 1) return off;
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, n = j * WW + i;
  return lerp(lerp(A[n], A[n + 1], u), lerp(A[n + WW], A[n + WW + 1], u), v);
};
const FIG = 0.13; // how high on its rocks the figure stands
const LONG = 0.17, BELT = 1.1, by = (fy) => (fy >= BELT + LONG ? fy - LONG : (fy * BELT) / (BELT + LONG)); // (the skirt's extra length: his photograph stops at the thigh, and the figure stood too squat)
function wingFrame(root, uDir, seed) { // root: where (s, c) = (0.16, 1.37) is
  const U = norm(uDir), V0 = [0, 1, -0.06], k = dot(V0, U), V = norm([V0[0] - U[0] * k, V0[1] - U[1] * k, V0[2] - U[2] * k]);
  let N = cross(U, V);
  if (N[2] < 0) N = N.map((a) => -a);
  return { root, U, V, N, ...wingPicture(seed) };
}
const wings = [
  wingFrame([-0.14, 1.37 + FIG + LONG, -0.145], [-1, 0, -0.2], 7101), // as in his photograph, near square-on to you
  wingFrame([0.12, 1.37 + FIG + LONG, -0.16], [0.77, 0, -0.62], 7102), // this one swept back: it shows shorter
];
const wingD = (x, y, z, W) => {
  const px = x - W.root[0], py = y - W.root[1], pz = z - W.root[2];
  const s = 0.16 + (px * W.U[0] + py * W.U[1] + pz * W.U[2]) / 1.13, c = 1.37 + (px * W.V[0] + py * W.V[1] + pz * W.V[2]) / 1.13;
  if (s < WX0 - 0.06 || s > WX1 + 0.06 || c < WY0 - 0.06 || c > WY1 + 0.06) return Math.max(WX0 - s, s - WX1, WY0 - c, c - WY1, 0.02);
  const w = px * W.N[0] + py * W.N[1] + pz * W.N[2] + 0.16 * (s - 0.38) * (s - 0.38); // (its tips bent back a little)
  const D = pic(W.D, s, c, 0.12), H = pic(W.H, s, c, 0), inner = Math.max(0, -D), core = 0.0105 * S(inner, 0, 0.011) + 0.0015;
  const front = core + H * 0.62, back = core + H * 0.22, ww = w > 0 ? w - front : -w - back;
  return smax(D, ww, 0.004) * 0.7;
};

// ---------------------------------------------------------------- the figure (its own y from the rocks up; FIG lower)
const pts = (tab, y) => { for (let i = 1; i < tab.length; i++) if (y <= tab[i][0]) { const t = S(y, tab[i - 1][0], tab[i][0]); return lerp(tab[i - 1][1], tab[i][1], t); } return tab[tab.length - 1][1]; };
const SK_X = [[-0.05, 0.25], [0, 0.23], [0.2, 0.19], [0.5, 0.176], [0.76, 0.178], [0.98, 0.156], [1.12, 0.13]], SK_Z = [[-0.05, 0.215], [0, 0.19], [0.2, 0.145], [0.5, 0.128], [0.76, 0.126], [0.98, 0.11], [1.12, 0.09]];
const TO_X = [[1.02, 0.158], [1.08, 0.146], [1.2, 0.158], [1.3, 0.158], [1.37, 0.08]], TO_Z = [[1.02, 0.118], [1.08, 0.106], [1.2, 0.116], [1.3, 0.074], [1.37, 0.045]];
// the head: looking down, a little turned, a little tipped
const HC = [0.012, 1.475, 0.04], rot = (() => {
  const yaw = 0.07, pit = -0.4, rol = -0.05, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit), cr = Math.cos(rol), sr = Math.sin(rol);
  return (x, y, z) => { const x1 = x * cy - z * sy, z1 = x * sy + z * cy, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp, x2 = x1 * cr + y1 * sr, y2 = -x1 * sr + y1 * cr; return [x2, y2, z2]; };
})();
function headD(hx, hy, hz) {
  let h = ell(hx, hy - 0.005, hz - 0.002, 0.07, 0.096, 0.084);
  h = smin(h, ell(hx, hy + 0.04, hz - 0.034, 0.048, 0.056, 0.052), 0.036); // jaw and cheeks
  h = smin(h, ell(hx, hy + 0.074, hz - 0.058, 0.022, 0.02, 0.024), 0.022); // chin
  h = smin(h, cone(hx, hy, hz, [-0.034, 0.026, 0.07], [0.034, 0.026, 0.07], 0.01, 0.01), 0.022); // brow
  for (const sx of [-1, 1]) {
    h = smax(h, -ell(hx - sx * 0.03, hy - 0.002, hz - 0.094, 0.024, 0.0155, 0.019), 0.007); // the eye's hollow
    h = smin(h, ell(hx - sx * 0.03, hy - 0.001, hz - 0.075, 0.0155, 0.0085, 0.0098), 0.0025); // its lid, lowered
    h = smax(h, -cone(hx, hy, hz, [sx * 0.018, -0.0065, 0.0845], [sx * 0.043, -0.0045, 0.078], 0.0016, 0.0016), 0.0018); // the line of the lashes
    h = smin(h, ell(hx - sx * 0.036, hy + 0.03, hz - 0.066, 0.018, 0.02, 0.012), 0.024); // cheek
  }
  h = smin(h, cone(hx, hy, hz, [0, 0.016, 0.082], [0, -0.028, 0.098], 0.0068, 0.0102), 0.009); // nose
  for (const sx of [-1, 1]) h = smin(h, ell(hx - sx * 0.008, hy + 0.033, hz - 0.095, 0.005, 0.0042, 0.0045), 0.004); // its wings
  h = smin(h, ell(hx, hy + 0.0515, hz - 0.089, 0.0175, 0.0055, 0.0085), 0.0035); // upper lip
  h = smin(h, ell(hx, hy + 0.0625, hz - 0.086, 0.0145, 0.006, 0.0088), 0.003); // lower
  h = smax(h, -ell(hx, hy + 0.0572, hz - 0.098, 0.019, 0.0016, 0.008), 0.0015); // between them
  // the hair: waves running back from a parting and round the head, off the face, in rolled locks
  const az = Math.atan2(hx, -hz), up = hy;
  const wave = 0.0125 * Math.pow(Math.abs(Math.sin(up * 28 + Math.abs(hx) * 40 + 1.1 * Math.sin(Math.abs(hx) * 30 + az) + 0.5)), 0.55) - 0.005 * Math.exp(-((hx / 0.007) ** 2));
  let hair = ell(hx, hy - 0.02, hz + 0.02, 0.083, 0.106, 0.1) - wave;
  hair = smax(hair, -Math.max(0.018 - hz, hy - 0.07 + hx * hx * 4.8, Math.abs(hx) - 0.068), 0.016); // off the forehead, in an arch
  for (const [sx, z0, ph, top, bot, ra] of [[-1, 0.02, 0.5, 0.03, -0.19, 0.024], [-1, -0.03, 2.2, 0.05, -0.2, 0.027], [-1, -0.075, 3.9, 0.05, -0.17, 0.026], [1, 0.015, 1.4, 0.03, -0.165, 0.023], [1, -0.035, 3.0, 0.05, -0.18, 0.026], [1, -0.08, 5.0, 0.05, -0.15, 0.025]]) {
    if (hy > top + 0.05 || hy < bot - 0.05) continue;
    const cy = clamp(hy, bot, top), cx = sx * (0.076 + 0.012 * Math.sin(cy * 44 + ph)) + (sx * Math.max(0, -cy - 0.08) * 0.1), cz = z0 + 0.011 * Math.cos(cy * 38 + ph);
    const lock = hypot(hx - cx, hy - cy, hz - cz) - ra * (0.75 + 0.25 * S(cy, bot, bot + 0.06)) - 0.003 * Math.abs(Math.sin(cy * 90 + Math.atan2(hx - cx, hz - cz) * 2 + ph));
    hair = smin(hair, lock * 0.75, 0.008);
  }
  h = smin(h, hair, 0.005);
  return h;
}
const bodyD = (x0, y, z) => {
  const x = x0 + 0.008, th = Math.atan2(x, z), fr = S(z, -0.04, 0.05);
  let d = 1;
  // ---- the skirt, from the high girdle: long deep folds, valleys where they are in his photograph, the thigh under it
  if (y < 1.2) {
    const rx = pts(SK_X, y), rz = pts(SK_Z, y), yy = clamp(y, 0, 1.1);
    const thigh = Math.exp(-(((x + 0.08) / 0.1) ** 2) - ((y - 0.72) / 0.28) ** 2) * fr;
    const wand = 0.36 * Math.sin(yy * 2.1 + th * 1.5) + 1.4 * (vn(th * 1.1 + 9, yy * 1.1, 2.2) - 0.5);
    const a1 = 0.042 * S(1.1 - yy, 0, 0.08) * (0.6 + 0.4 * (1 - yy / 1.1)) * (0.6 + 0.8 * vn(th * 2.1 + 5, 1.5, yy * 0.7)) * (1 - 0.5 * thigh);
    const a2 = 0.011 * (0.7 + 0.6 * vn(th * 5 + 1, yy * 3, 4.4)), a3 = 0.0075 * S(yy, 0.82, 1.04);
    const F = a1 * Math.pow(Math.abs(Math.sin(th * 4 + 1.6 + wand)), 0.6) + a2 * Math.pow(Math.abs(Math.sin(th * 11 + wand * 2.2 + yy * 2)), 0.72) + a3 * Math.pow(Math.abs(Math.sin(th * 19 + yy * 3 + wand)), 0.7);
    d = (hypot(x / rx, z / rz) - 1) * Math.min(rx, rz) - F;
    d = smin(d, ell(x + 0.08, y - 0.72, z - 0.05, 0.088, 0.3, 0.08) - 0.002, 0.05);
    d = smax(d, y - 1.13, 0.01);
    d = smax(d, -y - 0.06, 0.01) * 0.55;
  }
  // ---- the gown's top: folds fanning from the shoulders down to the girdle, bagging a little over it; gathered round the neck
  if (y > 0.98 && y < 1.42) {
    const rx = pts(TO_X, y), rz = pts(TO_Z, y);
    const xn = (x + 0.012) / (0.035 + 0.72 * Math.max(0, y - 1.06));
    const fan = 0.017 * Math.pow(Math.abs(Math.sin(xn * 5.2 + 0.5 + 0.5 * Math.sin(y * 12))), 0.55) * fr * S(y, 1.06, 1.11) * (1 - S(y, 1.26, 1.33));
    const cr = 0.0048 * Math.pow(Math.abs(Math.sin(th * 7 + y * 17 + 2.4 * vn(th * 2, y * 5, 7.7))), 0.65);
    const rad = hypot(x, (z - 0.012) * 1.1), col = 0.0062 * Math.pow(Math.abs(Math.sin(Math.atan2(x, z) * 26)), 0.7) * S(rad, 0.052, 0.07) * (1 - S(rad, 0.098, 0.135)) * S(y, 1.25, 1.3) * fr;
    let t = (hypot(x / rx, z / rz) - 1) * Math.min(rx, rz) - fan - cr - col;
    const edge = 1.05 + 0.012 * Math.sin(th * 3 + 0.7) + 0.008 * Math.sin(th * 8 + 2.1) + 0.005 * Math.sin(th * 17);
    t = smax(t, edge - y, 0.006) * 0.6;
    d = smin(d, t, 0.006);
  }
  if (y > 1.1 && y < 1.3) for (const sx of [-1, 1]) d = smin(d, ell(x - sx * 0.058, y - 1.2, z - 0.05, 0.056, 0.05, 0.046), 0.05); // the breast, under the cloth
  // shoulders, neck; the neckline a soft roll round it
  if (y > 1.17 && y < 1.5) {
    let sh = cone(x, y, z, [-0.118, 1.292, -0.012], [0.118, 1.292, -0.012], 0.05, 0.05);
    sh = smin(sh, cone(x, y, z, [0, 1.3, -0.005], [0.006, 1.41, 0.022], 0.05, 0.044), 0.026);
    d = smin(d, sh, 0.036);
    d = smin(d, hypot(hypot(x, (z - 0.004) / 0.92) - 0.066, y - 1.335 + z * 0.35) - 0.0075, 0.008);
  }
  // ---- the arms in their fitted sleeves. Its right (your left) straight down, the fist closed; its left (your right) bent, the
  // hand on its breast, the cloth it carries hanging from the forearm
  if (y > 0.74 && y < 1.36) {
    const crease = (t, a) => 0.0048 * Math.pow(Math.abs(Math.sin(t * 13 + a * 2.2 + 4 * vn(t * 3, a * 0.8, 3.3))), 0.75) * (0.4 + 1.2 * vn(t * 4 + 2, a * 1.3, 8.1));
    const limb = (a, b, r1, r2) => {
      const c = cone(x, y, z, a, b, r1, r2);
      if (c > 0.05) return c;
      const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2], tt = clamp(((x - a[0]) * bax + (y - a[1]) * bay + (z - a[2]) * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
      return c - crease(tt * 1.2, th * 3);
    };
    const Ra = [-0.172, 1.272, -0.01], Re = [-0.232, 1.09, 0.012], Rw = [-0.208, 0.925, 0.036];
    d = smin(d, limb(Ra, Re, 0.05, 0.05), 0.02);
    d = smin(d, limb(Re, Rw, 0.05, 0.036), 0.01);
    d = smin(d, hypot(hypot(x - Rw[0], z - Rw[2]) - 0.033, y - 0.925) - 0.0055, 0.004); // its cuff
    // the fist: heavy, closed, the fingers curled under and the thumb across
    d = smin(d, ell(x + 0.203, y - 0.868, z - 0.046, 0.04, 0.05, 0.034), 0.008);
    for (let f = 0; f < 4; f++) d = smin(d, cone(x, y, z, [-0.236 + f * 0.0005, 0.893 - f * 0.0185, 0.074], [-0.17, 0.89 - f * 0.0185, 0.074 - f * 0.002], 0.0098, 0.0098), 0.0022);
    d = smin(d, cone(x, y, z, [-0.17, 0.905, 0.058], [-0.205, 0.872, 0.09], 0.0115, 0.0098), 0.003);
    const La = [0.142, 1.272, -0.014], Le = [0.212, 1.122, 0.018], Lw = [0.098, 1.186, 0.128];
    d = smin(d, limb(La, Le, 0.048, 0.048), 0.02);
    d = smin(d, limb(Le, Lw, 0.05, 0.036), 0.01);
    d = smin(d, hypot(hypot((x - Lw[0]) * 0.86 + (y - Lw[1]) * 0.5, z - Lw[2]) - 0.032, (y - Lw[1]) * 0.86 - (x - Lw[0]) * 0.5) - 0.005, 0.004);
    // the hand laid flat, fingers across the breast
    d = smin(d, ell(x - 0.058, y - 1.2, z - 0.147, 0.038, 0.03, 0.015), 0.007);
    for (let f = 0; f < 4; f++) d = smin(d, cone(x, y, z, [0.035, 1.223 - f * 0.0155, 0.151], [-0.018 + f * 0.0045 - f * f * 0.002, 1.232 - f * 0.0172, 0.145], 0.0078, 0.0062), 0.0018);
    d = smin(d, cone(x, y, z, [0.07, 1.226, 0.152], [0.04, 1.252, 0.145], 0.0088, 0.0066), 0.003);
    // the cloth over the forearm: hanging in a few heavy folds
    if (x > 0.05 && z > 0.02 && y > 0.94) {
      const pl = 0.007 * Math.pow(Math.abs(Math.sin(x * 62 + 0.7)), 0.6);
      d = smin(d, smax(ell(x - 0.158, y - 1.08, z - 0.09, 0.048, 0.066, 0.038) - pl, 1.018 - y + 0.01 * Math.sin(x * 70), 0.006), 0.012);
    }
  }
  // ---- the head
  const hx = x - HC[0], hy0 = y - HC[1], hz0 = z - HC[2];
  if (hypot(hx, hy0, hz0) < 0.33) { const [a, b, c] = rot(hx, hy0, hz0), HS = 0.93; d = smin(d, headD(a / HS, b / HS, c / HS) * HS, 0.014); }
  return d;
};
// ---------------------------------------------------------------- the rocks it stands on, rough, with the hem over them
const ROCKS = [[0, 0.015, 0.0, 0.4, 0.15, 0.34], [-0.25, 0.05, 0.17, 0.17, 0.11, 0.15], [0.23, 0.07, 0.15, 0.19, 0.13, 0.16], [0.06, 0.04, 0.27, 0.17, 0.085, 0.11], [-0.2, 0.045, -0.18, 0.19, 0.09, 0.16], [0.27, 0.04, -0.14, 0.13, 0.08, 0.14]];
const rockD = (x, y, z) => {
  let d = 1;
  for (const [a, b, c, rx, ry, rz] of ROCKS) d = smin(d, ell(x - a, y - b, z - c, rx, ry, rz), 0.015);
  if (d > 0.09) return d;
  const big = fbm(x * 8 + 3, y * 8, z * 8 + 1, 3), crack = Math.abs(fbm(x * 15, y * 15 + 5, z * 15, 2) - 0.5);
  return (d - (big - 0.5) * 0.09 + (0.03 - Math.min(0.03, crack * 0.5)) * 0.25) * 0.65;
};
const sdfRaw = (x, y, z) => {
  const fy = y - FIG;
  const box = Math.max(Math.abs(x) - 0.34, fy - 1.9, -0.1 - fy, z - 0.3, -0.26 - z);
  let d = box > 0.05 ? box : bodyD(x, by(fy), z);
  if (y < 0.38) d = Math.min(d, rockD(x, y, z));
  if (y > 0.5 && z < 0.5) for (const W of wings) { const e = wingD(x, y, z, W); if (e < d + 0.012) d = smin(d, e, 0.012); }
  return d;
};
/** Worn: lumpy and pitted over all of it, near the surface. */
const sdf = (x, y, z) => {
  const d = sdfRaw(x, y, z);
  if (Math.abs(d) > 0.016) return d;
  // (the face wears smoother than the rest: the pits and lumps on the arm, the breast, the feathers are what his photograph shows)
  const fyy = y - FIG - LONG, skirt = 1 - 0.55 * S(1.0 - fyy, 0, 0.2), wingy = z < -0.06 || Math.abs(x) > 0.27 ? 0.3 : 1;
  const smooth = (0.35 + 0.65 * S(hypot(x - HC[0], fyy - HC[1] + 0.02, z - HC[2] - 0.075), 0.06, 0.12)) * skirt * wingy;
  return d + smooth * ((fbm(x * 17 + 2, y * 17, z * 17 + 8, 2) - 0.5) * 0.0085 + (fbm(x * 48, y * 48 + 3, z * 48 + 1, 2) - 0.5) * 0.0042 + (vn(x * 130, y * 130, z * 130) - 0.5) * 0.0016);
};

// ---------------------------------------------------------------- its surface
// surface nets within a box at a given cell, into Pos / Idx; finely only in the coarse cells the surface may pass through.
const t0 = Date.now(), Pos = [], Idx = [];
function surface([X0, Y0, Z0, X1, Y1, Z1], C, field, keep = null) {
  const nx = Math.ceil((X1 - X0) / C) + 1, ny = Math.ceil((Y1 - Y0) / C) + 1, nz = Math.ceil((Z1 - Z0) / C) + 1, id = (i, j, k) => (k * ny + j) * nx + i;
  const F = new Float32Array(nx * ny * nz).fill(1), done = new Uint8Array(nx * ny * nz), vid = new Int32Array(nx * ny * nz).fill(-1);
  const CO = 4, CS = CO * C, ccx = Math.ceil((nx - 1) / CO), ccy = Math.ceil((ny - 1) / CO), ccz = Math.ceil((nz - 1) / CO), cid = (i, j, k) => (k * (ccy + 1) + j) * (ccx + 1) + i;
  const coarse = new Float32Array((ccx + 1) * (ccy + 1) * (ccz + 1));
  for (let k = 0; k <= ccz; k++) for (let j = 0; j <= ccy; j++) for (let i = 0; i <= ccx; i++) coarse[cid(i, j, k)] = field(X0 + i * CS, Y0 + j * CS, Z0 + k * CS);
  const active = [];
  for (let ck = 0; ck < ccz; ck++) for (let cj = 0; cj < ccy; cj++) for (let ci = 0; ci < ccx; ci++) {
    let mn = Infinity, mx = -Infinity, near = Infinity;
    for (let c = 0; c < 8; c++) { const v = coarse[cid(ci + (c & 1), cj + ((c >> 1) & 1), ck + (c >> 2))]; mn = Math.min(mn, v); mx = Math.max(mx, v); near = Math.min(near, Math.abs(v)); }
    if (mn > CS) continue;
    const i0 = ci * CO, j0 = cj * CO, k0 = ck * CO, i1 = Math.min(i0 + CO, nx - 1), j1 = Math.min(j0 + CO, ny - 1), k1 = Math.min(k0 + CO, nz - 1);
    if (mx < 0 && near > CS) { for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!done[id(i, j, k)]) F[id(i, j, k)] = -1; continue; }
    active.push([i0, j0, k0, i1, j1, k1]);
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const n = id(i, j, k);
      if (done[n]) continue;
      F[n] = field(X0 + i * C, Y0 + j * C, Z0 + k * C);
      done[n] = 1;
    }
  }
  const base = Pos.length / 3, corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], v8 = new Float32Array(8);
  for (const [i0, j0, k0, i1, j1, k1] of active) for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { v8[c] = F[id(i + corner[c][0], j + corner[c][1], k + corner[c][2])]; if (v8[c] < 0) neg++; }
    if (!neg || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((v8[a] < 0) === (v8[b] < 0)) continue;
      const t = v8[a] / (v8[a] - v8[b]), ca = corner[a], cb = corner[b];
      sx += ca[0] + (cb[0] - ca[0]) * t; sy += ca[1] + (cb[1] - ca[1]) * t; sz += ca[2] + (cb[2] - ca[2]) * t; n++;
    }
    vid[id(i, j, k)] = Pos.length / 3;
    Pos.push(X0 + (i + sx / n) * C, Y0 + (j + sy / n) * C, Z0 + (k + sz / n) * C);
  }
  const around = [[1, 0, 0, [[0, -1, 0], [0, -1, -1], [0, 0, -1]]], [0, 1, 0, [[0, 0, -1], [-1, 0, -1], [-1, 0, 0]]], [0, 0, 1, [[-1, 0, 0], [-1, -1, 0], [0, -1, 0]]]];
  for (const [i0, j0, k0, i1, j1, k1] of active) for (let k = Math.max(1, k0); k < k1; k++) for (let j = Math.max(1, j0); j < j1; j++) for (let i = Math.max(1, i0); i < i1; i++) {
    const v0 = F[id(i, j, k)];
    for (const [di, dj, dk, q] of around) {
      const v1 = F[id(i + di, j + dj, k + dk)];
      if ((v0 < 0) === (v1 < 0)) continue;
      const a = vid[id(i, j, k)], b = vid[id(i + q[0][0], j + q[0][1], k + q[0][2])], c = vid[id(i + q[1][0], j + q[1][1], k + q[1][2])], d = vid[id(i + q[2][0], j + q[2][1], k + q[2][2])];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      const tri = (p, q2, r) => { if (!keep || keep(p, q2, r)) Idx.push(p, q2, r); };
      if (v0 < 0) { tri(a, c, b); tri(a, d, c); } else { tri(a, b, c); tri(a, c, d); }
    }
  }
  return base;
}
// the whole of it; and where the eye goes close, the head and the hands, finer, a hair proud of the coarse surface over the
// few millimetres the two overlap (the coarse one is cut away inside each box)
const HX = HC[0], HY = HC[1] + FIG + LONG, HZ = HC[2];
const FINE = [
  { box: [HX - 0.17, HY - 0.15, HZ - 0.22, HX + 0.17, HY + 0.19, HZ + 0.17], cell: Math.min(C, 0.003) }, // (the head, whole)
  { box: [-0.27, 0.8 + FIG + LONG, -0.02, -0.13, 0.96 + FIG + LONG, 0.13], cell: Math.min(C, 0.0035) }, // (the fist)
  { box: [-0.05, 1.15 + FIG + LONG, 0.09, 0.13, 1.28 + FIG + LONG, 0.19], cell: Math.min(C, 0.0035) }, // (the hand)
];
const inFine = (i, m) => { const x = Pos[i * 3], y = Pos[i * 3 + 1], z = Pos[i * 3 + 2]; return FINE.some(({ box: b }) => x > b[0] + m && x < b[3] - m && y > b[1] + m && y < b[4] - m && z > b[2] + m && z < b[5] - m); };
surface([-1.0, -0.09, -0.72, 1.0, 2.44, 0.5], C, sdf, (a, b, c) => !(inFine(a, C) && inFine(b, C) && inFine(c, C)));
for (const { box, cell } of FINE) surface(box, cell, (x, y, z) => sdf(x, y, z) - 0.0004);
const BOXALL = [-1.0, -0.09, -0.72, 2.0, 2.53, 1.22];
// ---------------------------------------------------------------- normals, and the weather
const count = Pos.length / 3, Nor = new Int8Array(count * 4), Col = new Uint8Array(count * 4), e = 0.0022;
for (let i = 0; i < count; i++) {
  const x = Pos[i * 3], y = Pos[i * 3 + 1], z = Pos[i * 3 + 2];
  const n = norm([sdf(x + e, y, z) - sdf(x - e, y, z), sdf(x, y + e, z) - sdf(x, y - e, z), sdf(x, y, z + e) - sdf(x, y, z - e)]);
  Nor[i * 4] = n[0] * 127; Nor[i * 4 + 1] = n[1] * 127; Nor[i * 4 + 2] = n[2] * 127;
  const grad = Math.max(0.25, hypot(sdf(x + e, y, z) - sdf(x - e, y, z), sdf(x, y + e, z) - sdf(x, y - e, z), sdf(x, y, z + e) - sdf(x, y, z - e)) / (2 * e)); // (the field is scaled where its folds are steep: read off in real distance)
  const raw = (a) => sdfRaw(x + n[0] * a, y + n[1] * a, z + n[2] * a) / grad;
  const ao = clamp(1 - Math.max(0, 0.014 - raw(0.014)) * 22 - Math.max(0, 0.04 - raw(0.04)) * 8 - Math.max(0, 0.09 - raw(0.09)) * 2.5, 0, 1);
  const above = S(0.09 - sdfRaw(x + n[0] * 0.05, y + n[1] * 0.05 + 0.13, z + n[2] * 0.05), 0, 0.09);
  const fy = by(y - FIG), rock = S(rockD(x, y, z) - bodyD(x, fy, z), 0.0, -0.01) * S(0.42 - y, 0, 0.06);
  const inWing = wings.some((W) => wingD(x, y, z, W) < 0.012);
  // where his photograph has it worst: the hanging forearm and fist, the breast and shoulder, the skirt under the girdle, the
  // inner wing — elsewhere blots and flecks; the face and the lower skirt palest
  const faceK = 1 - S(hypot(x - HC[0], fy - HC[1] + 0.02, z - HC[2] - 0.075), 0.05, 0.13);
  let zone = 0.34 + 0.75 * (1 - S(hypot(x + 0.215, (fy - 0.98) * 0.42, z - 0.03), 0.05, 0.14));
  zone += 0.45 * (1 - S(hypot(x + 0.06, (fy - 1.2) * 0.8), 0.06, 0.2)) * S(z, 0, 0.06);
  zone += 0.5 * (1 - S(hypot((x + 0.06) * 1.4, (fy - 0.86) * 0.5), 0.05, 0.14)) * S(z, 0, 0.06);
  if (inWing) zone = 0.42 + 0.45 * S(fbm(x * 3 + 2, y * 3, z * 3, 2), 0.42, 0.62);
  zone *= 1 - 0.7 * faceK;
  const crust = S(fbm(x * 12 + 11, y * 12, z * 12 + 2, 3), 0.52, 0.64) * clamp(zone * 1.3, 0, 1); // lichen: grey-green crusts
  const fleck = S(fbm(x * 44 + 3, y * 44, z * 44 + 8, 2), 0.56, 0.66) * clamp(zone * 1.4, 0, 1); // and flecks of it
  const mould = S(fbm(x * 30 + 3, y * 30, z * 30 + 7, 3) + (vn(x * 90, y * 90, z * 90) - 0.5) * 0.2, 0.55, 0.64) * clamp(zone * 1.15, 0, 1); // black mould, blotched, speckled at its edges
  const pit = S(vn(x * 95, y * 95, z * 95), 0.72, 0.86) * clamp(zone * 1.5, 0.15, 1);
  const run = S(fbm(x * 48 + 3, y * 3, z * 48 + 7, 3), 0.5, 0.7) * (1 - Math.abs(n[1]) * 0.7);
  // the stone itself pale, a little warm; black in its deep hollows; grey where the rain doesn't reach
  let c = [0.74, 0.72, 0.65];
  c = c.map((v, k) => lerp(v, [0.42, 0.44, 0.34][k], crust * 0.62));
  c = c.map((v, k) => lerp(v, [0.24, 0.26, 0.19][k], fleck * 0.6));
  c = c.map((v, k) => lerp(v, [0.075, 0.08, 0.06][k], Math.min(0.9, mould * 0.82)));
  c = c.map((v, k) => lerp(v, [0.06, 0.06, 0.05][k], pit * 0.5));
  let cut = 0; // (in the wings, the cut round every feather, dark as it is in his photograph)
  for (const W of wings) { if (wingD(x, y, z, W) > 0.012) continue; const px = x - W.root[0], py = y - W.root[1], pz = z - W.root[2]; cut = Math.max(cut, pic(W.G, 0.16 + (px * W.U[0] + py * W.U[1] + pz * W.U[2]) / 1.13, 1.37 + (px * W.V[0] + py * W.V[1] + pz * W.V[2]) / 1.13, 0)); }
  const soot = clamp(0.72 * (1 - ao) ** 1.0 + 0.3 * above * (0.3 + 0.7 * run) + 0.05 * run + 0.5 * cut, 0, 0.9);
  c = c.map((v, k) => lerp(v, [0.07, 0.07, 0.06][k], soot));
  const damp = S(0.75 - y, 0, 0.55);
  if (rock > 0) { const m = fbm(x * 21, y * 21, z * 21 + 4, 3), g = 0.17 + m * 0.2; c = c.map((v, k) => lerp(v, [g * 1.03, g, g * 0.88][k], rock)); }
  const moss = clamp(rock * (0.55 + 0.4 * S(n[1], 0, 0.7)) + (1 - rock) * (0.7 * S(0.34 - y, 0, 0.14) + 0.4 * damp * (1 - ao)), 0, 1);
  for (let k = 0; k < 3; k++) Col[i * 4 + k] = clamp(c[k], 0, 1) * 255;
  Col[i * 4 + 3] = moss * 255;
}
// (the quads' winding, one way or the other: turned to face the way the field says is out — wrong, you see its inside)
let agree = 0;
for (let t = 0; t < Idx.length; t += 3 * 31) {
  const [a, b, c] = [Idx[t], Idx[t + 1], Idx[t + 2]].map((k) => [Pos[k * 3], Pos[k * 3 + 1], Pos[k * 3 + 2]]);
  const fn = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
  agree += Math.sign(dot(fn, [Nor[Idx[t] * 4], Nor[Idx[t] * 4 + 1], Nor[Idx[t] * 4 + 2]]));
}
if (agree < 0) for (let t = 0; t < Idx.length; t += 3) { const q = Idx[t + 1]; Idx[t + 1] = Idx[t + 2]; Idx[t + 2] = q; }
console.log('winding', agree < 0 ? 'turned' : 'right');
// positions as 16-bit fractions of the box
const BOX = BOXALL, Q = new Uint16Array(count * 3);
for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) Q[i * 3 + k] = ((Pos[i * 3 + k] - BOX[k]) / BOX[3 + k]) * 65535;
const head = new Float32Array([count, Idx.length / 3, ...BOX]), I = Uint32Array.from(Idx);
const pad = (b) => b; // (all parts below keep 4-byte alignment: Q is padded to a multiple of 4)
const qBytes = new Uint8Array(Q.buffer), qp = (4 - (qBytes.length % 4)) % 4;
const file = Buffer.concat([Buffer.from(head.buffer), Buffer.from(qBytes), Buffer.alloc(qp), Buffer.from(Nor.buffer), Buffer.from(Col.buffer), Buffer.from(I.buffer)].map(pad));
writeFileSync(OUT, file);
console.log(`cell ${C}: ${count} vertices, ${Idx.length / 3} triangles, ${(file.length / 1048576).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ---------------------------------------------------------------- a look at it
if (preview) {
  const W = 620, H = 900, L = norm([-0.45, 0.65, 0.62]);
  for (const [name, yaw, dist] of [['front', 0.0, 3.3], ['left', -0.75, 3.3], ['face', 0.3, 0.75]]) {
    const img = new Uint8Array(W * H * 3).fill(18), zb = new Float32Array(W * H).fill(1e9), cy = Math.cos(yaw), sy = Math.sin(yaw), cam = name === 'face' ? [1.5, HC[1] + FIG + LONG] : [H / 2.65, 1.32];
    const f = name === 'face' ? H * 0.9 : H * 1.28;
    for (let i = 0; i < count; i++) {
      const x = Pos[i * 3], y = Pos[i * 3 + 1], z = Pos[i * 3 + 2], rx = x * cy + z * sy, rz = -x * sy + z * cy, d = dist - rz;
      const px = W / 2 + (rx / d) * f, py = H / 2 - ((y - (name === 'face' ? cam[1] : cam[1])) / d) * f;
      const nxr = (Nor[i * 4] / 127) * cy + (Nor[i * 4 + 2] / 127) * sy, nzr = (-Nor[i * 4] / 127) * sy + (Nor[i * 4 + 2] / 127) * cy, nyr = Nor[i * 4 + 1] / 127;
      if (nzr < -0.15) continue;
      const lam = 0.32 + 0.75 * Math.max(0, nxr * L[0] + nyr * L[1] + nzr * L[2]), R = name === 'face' ? 2 : 1;
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
        const qx = Math.round(px) + a, qy = Math.round(py) + b;
        if (qx < 0 || qy < 0 || qx >= W || qy >= H || d >= zb[qy * W + qx]) continue;
        zb[qy * W + qx] = d;
        for (let k = 0; k < 3; k++) img[(qy * W + qx) * 3 + k] = clamp(Math.pow((Col[i * 4 + k] / 255) * lam, 1 / 2.2), 0, 1) * 255;
      }
    }
    writeFileSync(`${preview}/${name}.ppm`, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), Buffer.from(img)]));
  }
}
