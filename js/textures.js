// Every texture in the room is drawn here on a 2D canvas — no image files.
import * as THREE from 'three';
import { canvasTex, mulberry32, fbm } from './util.js';

/**
 * A cut-out texture (leaves, blades) with the colour of its edges run out under the clear parts: drawn on a
 * canvas those are clear black, and the mipmaps blended the black into the edges — dark rims round every
 * blade and leaf, a dark, contrasty look further off (user, 2026-10-17). Same picture, same alpha.
 */
function bleed(tex) {
  const c = tex.image, w = c.width, h = c.height, a = new Uint8ClampedArray(c.getContext('2d').getImageData(0, 0, w, h).data);
  let filled = new Uint8Array(w * h), sum = [0, 0, 0], n = 0;
  for (let i = 0; i < w * h; i++) if (a[i * 4 + 3] > 0) { filled[i] = 1; if (a[i * 4 + 3] > 128) { sum[0] += a[i * 4]; sum[1] += a[i * 4 + 1]; sum[2] += a[i * 4 + 2]; n++; } }
  for (let pass = 0; pass < 10; pass++) {
    const next = filled.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (filled[i]) continue;
      let k = 0, rr = 0, gg = 0, bb = 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || !filled[j]) continue;
        rr += a[j * 4]; gg += a[j * 4 + 1]; bb += a[j * 4 + 2]; k++;
      }
      if (k) { a[i * 4] = rr / k; a[i * 4 + 1] = gg / k; a[i * 4 + 2] = bb / k; next[i] = 1; }
    }
    filled = next;
  }
  for (let i = 0; i < w * h; i++) if (!filled[i]) { a[i * 4] = sum[0] / n; a[i * 4 + 1] = sum[1] / n; a[i * 4 + 2] = sum[2] / n; }
  const rows = new Uint8Array(a.length); // bottom row first, as a canvas texture's flipY has it
  for (let y = 0; y < h; y++) rows.set(a.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  const t = new THREE.DataTexture(rows, w, h, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

const IMPACT = 'Impact, "Arial Narrow Bold", "Helvetica Neue", sans-serif';

function speckle(g, w, h, count, color, maxR = 1.6, seed = 1) {
  const r = mulberry32(seed);
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    g.globalAlpha = 0.04 + r() * 0.1;
    g.beginPath();
    g.arc(r() * w, r() * h, 0.4 + r() * maxR, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Printed paper is never perfectly flat or clean: creases, soft edge wear. */
function paperWear(g, w, h, seed = 3) {
  const r = mulberry32(seed);
  for (let i = 0; i < 5; i++) {
    const x = r() * w;
    g.strokeStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (r() - 0.5) * 60, h);
    g.stroke();
  }
  const edge = g.createLinearGradient(0, 0, 0, h);
  edge.addColorStop(0, 'rgba(0,0,0,0.10)');
  edge.addColorStop(0.06, 'rgba(0,0,0,0)');
  edge.addColorStop(0.94, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,0.14)');
  g.fillStyle = edge;
  g.fillRect(0, 0, w, h);
}

function spacedText(g, text, cx, y, spacing) {
  const widths = [...text].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = cx - total / 2;
  g.textAlign = 'left';
  [...text].forEach((ch, i) => {
    g.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
}

/** Simple standing figure silhouette; feet at (x, y). */
function figure(g, x, y, hgt, color, { lean = 0 } = {}) {
  const s = hgt / 100;
  g.save();
  g.translate(x, y);
  g.rotate(lean);
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(0, -92 * s, 7 * s, 8.5 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-15 * s, -80 * s);
  g.quadraticCurveTo(0, -86 * s, 15 * s, -80 * s);
  g.lineTo(13 * s, -44 * s);
  g.lineTo(-13 * s, -44 * s);
  g.closePath();
  g.fill();
  g.fillRect(-11 * s, -46 * s, 9 * s, 46 * s);
  g.fillRect(2 * s, -46 * s, 9 * s, 46 * s);
  g.restore();
}

// ---------------------------------------------------------------- surfaces

/** A tile of the sofa's plaid (sofaPlaidTex) is this many metres a side (its UVs are in metres: the textures repeat 1 / it). */
const PLAID_TILE = 0.22;
let sofaPixels = null;

/**
 * The sofa's cloth, woven (user, 2026-10-20, with a photo of one — its look only, the sett my own): a teal
 * ground, darker teal bands, thin cream lines in pairs with a tan one between them, a lighter teal stripe and
 * a dark line either side of it, the same both ways; a 2/2 twill, so where two colours cross they mix in fine
 * diagonals. Each yarn a shade off the next and slubbed along its length; each thread rounded, lit on its
 * crown and dark where it dives under the next. Two repeats of the sett to a tile; worked out once for both
 * textures.
 */
function weavePlaid() {
  const S = 1536, THREADS = 400; // (0.55 mm threads)
  const C = { t: [84, 140, 150], d: [50, 94, 106], n: [34, 60, 72], c: [220, 212, 190], k: [162, 130, 92], l: [114, 162, 166] };
  const sett = [['t', 12], ['d', 22], ['t', 12], ['c', 2.2], ['t', 1.6], ['k', 1.1], ['t', 1.6], ['c', 2.2], ['t', 11], ['n', 1.1], ['t', 2.5], ['l', 6], ['t', 2.5], ['n', 1.1], ['t', 11], ['c', 1.1], ['t', 20]];
  const total = sett.reduce((s, [, w]) => s + w, 0);
  // each thread's colour, from where its middle falls in the sett
  const yarn = [];
  for (let i = 0; i < THREADS; i++) {
    let at = (((i + 0.5) * 2) / THREADS % 1) * total, k = 0;
    while (k < sett.length - 1 && at > sett[k][1]) at -= sett[k++][1];
    yarn.push(C[sett[k][0]]);
  }
  const r = mulberry32(4471), tone = [[], []], phase = [[], []];
  for (let i = 0; i < THREADS; i++) for (const k of [0, 1]) { tone[k].push(1.06 + r() * 0.13); phase[k].push(r() * 6.283); }
  const col = new Uint8ClampedArray(S * S * 4), bump = new Uint8ClampedArray(S * S * 4), TAU = Math.PI * 2;
  for (let y = 0; y < S; y++) {
    const fy = (y * THREADS) / S, j = Math.floor(fy), vy = fy - j;
    for (let x = 0; x < S; x++) {
      const fx = (x * THREADS) / S, i = Math.floor(fx), vx = fx - i;
      const k = (i + j) & 3, w = k < 2 ? 0 : 1; // 0: the warp is on top here, 1: the weft
      // the thread on top: across it (0…1), and along its float over two of the others (0…1)
      const across = w ? vy : vx, along = ((w ? k - 2 : k) + (w ? vx : vy)) / 2, id = w ? j : i, at = w ? fx : fy;
      const height = Math.sqrt(Math.sin(Math.PI * across)) * Math.pow(Math.sin(Math.PI * along), 0.4);
      const slub = 1 + 0.05 * Math.sin((at * TAU * 7) / THREADS + phase[w][id]) * Math.sin((at * TAU * 3) / THREADS + 2 * phase[w][id]);
      const c = yarn[id], lit = tone[w][id] * slub * (0.72 + 0.28 * height) * (0.97 + 0.06 * r()), o = (y * S + x) * 4;
      col[o] = c[0] * lit; col[o + 1] = c[1] * lit; col[o + 2] = c[2] * lit; col[o + 3] = 255;
      bump[o] = bump[o + 1] = bump[o + 2] = 40 + 200 * height + 16 * (r() - 0.5); bump[o + 3] = 255;
    }
  }
  return { S, col, bump, left: 2 };
}

/** The sofa's plaid (weavePlaid), `kind` 'color' or 'bump' (the threads high, the gaps between them low). */
export function sofaPlaidTex(kind = 'color') {
  sofaPixels ??= weavePlaid();
  const { S, col, bump } = sofaPixels;
  if (!--sofaPixels.left) sofaPixels = null;
  return canvasTex(S, S, (g) => g.putImageData(new ImageData(kind === 'bump' ? bump : col, S, S), 0, 0), { repeat: [1 / PLAID_TILE, 1 / PLAID_TILE], data: kind === 'bump' });
}

/**
 * A rip in the sofa's plaid (for a decal, square): along the weave, as cloth tears, gaping in the middle and
 * closing at its ends; its lips frayed — the cut threads standing out across it in the plaid's colours, a loose
 * one or two lying over the gap — and in it the stuffing in the lips' shadow: `fill` 'foam' (a seat's: yellowed
 * foam, a skin of grey wadding torn back over it) or 'fibre' (a back cushion's: grey-white fibre in tufts). `len`
 * and `gape`: half its length and half its opening, shares of the square. A `cut` (a blade's) runs straighter. `yarn`:
 * the cloth's colours, [r, g, b, share] (the living room's plaid unless said; the basement's velour).
 */
export function plaidTearTex(seed = 901, { len = 0.3, gape = 0.06, fill = 'foam', cut = false, yarn = [[84, 140, 150, 0.5], [50, 94, 106, 0.22], [220, 212, 190, 0.14], [114, 162, 166, 0.1], [162, 130, 92, 0.04]] } = {}) {
  const r = mulberry32(seed);
  const thread = (a) => { let p = r(); for (const [cr, cg, cb, share] of yarn) { if ((p -= share) <= 0) return `rgba(${cr},${cg},${cb},${a})`; } return `rgba(66,118,128,${a})`; };
  return bleed(canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, L = w * len, G = h * gape, n = 60;
    // the line it went along: the weave's way, jogging a thread or two now and then
    const line = [];
    let off = 0;
    for (let i = 0; i <= n; i++) {
      if (r() < (cut ? 0.05 : 0.2)) off += (r() - 0.5) * (cut ? 3 : 10);
      line.push([cx - L + (2 * L * i) / n, cy + off]);
    }
    const open = (t) => Math.pow(Math.sin(Math.PI * t), 0.75);
    let wa = 1, wb = 1;
    const upper = line.map(([x, y], i) => { wa = Math.max(0.6, Math.min(1.4, wa + (r() - 0.5) * 0.25)); return [x, y - G * open(i / n) * wa]; });
    const lower = line.map(([x, y], i) => { wb = Math.max(0.6, Math.min(1.4, wb + (r() - 0.5) * 0.25)); return [x, y + G * open(i / n) * wb]; });
    const hole = () => { g.beginPath(); upper.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); for (let i = n; i >= 0; i--) g.lineTo(...lower[i]); g.closePath(); };
    const along = (pts, dy) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y + dy) : g.moveTo(x, y + dy))); g.stroke(); };
    // round it the cloth a little grubby, where fingers have picked at it
    const halo = g.createRadialGradient(cx, cy, L * 0.3, cx, cy, L * 1.15);
    halo.addColorStop(0, 'rgba(60,50,38,0.16)');
    halo.addColorStop(1, 'rgba(60,50,38,0)');
    g.fillStyle = halo;
    g.beginPath(); g.ellipse(cx, cy, L * 1.15, L * 0.55, 0, 0, Math.PI * 2); g.fill();
    // the stuffing
    g.save(); hole(); g.clip();
    if (fill === 'foam') {
      g.fillStyle = '#c9b585';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = `rgba(${r() < 0.55 ? '112,92,58' : '236,224,186'},${0.18 + r() * 0.3})`;
        g.beginPath(); g.arc(cx + (r() - 0.5) * 2.2 * L, cy + off / 2 + (r() - 0.5) * 3 * G, 0.8 + r() * 2.2, 0, Math.PI * 2); g.fill();
      }
      // the wadding over it: grey-white wisps, torn back to the lips
      g.lineWidth = 1;
      for (let i = 0; i < 1100; i++) {
        const t = r(), [x, y] = (r() < 0.5 ? upper : lower)[Math.floor(t * n)], k = y < cy ? 1 : -1;
        g.strokeStyle = `rgba(214,210,200,${0.3 + r() * 0.4})`;
        g.beginPath(); g.moveTo(x + (r() - 0.5) * 6, y); g.quadraticCurveTo(x + (r() - 0.5) * 14, y + k * r() * G * 0.5, x + (r() - 0.5) * 20, y + k * r() * G * 0.8); g.stroke();
      }
    } else {
      g.fillStyle = '#b8b3a8';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) {
        const x = cx + (r() - 0.5) * 2 * L, y = cy + off / 2 + (r() - 0.5) * 2 * G, rad = 6 + r() * 16;
        const tuft = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
        tuft.addColorStop(0, 'rgba(232,228,218,0.85)');
        tuft.addColorStop(1, 'rgba(232,228,218,0)');
        g.fillStyle = tuft;
        g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      }
      g.lineWidth = 0.8;
      for (let i = 0; i < 1400; i++) {
        let x = cx + (r() - 0.5) * 2 * L, y = cy + off / 2 + (r() - 0.5) * 2.4 * G, a = r() * 6.28;
        g.strokeStyle = `rgba(${r() < 0.7 ? '240,236,226' : '120,114,104'},${0.2 + r() * 0.3})`;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { a += (r() - 0.5) * 1.6; x += Math.cos(a) * 3; y += Math.sin(a) * 3; g.lineTo(x, y); }
        g.stroke();
      }
    }
    // in the lips' shadow, deepest under the upper one
    g.filter = 'blur(5px)';
    g.strokeStyle = 'rgba(26,18,10,0.8)'; g.lineWidth = 14; along(upper, 4);
    g.strokeStyle = 'rgba(26,18,10,0.45)'; g.lineWidth = 8; along(lower, -2);
    g.filter = 'none';
    g.restore();
    // the lips: the cut threads standing out over the gap, the weave's way, a little bent
    for (const [pts, k] of [[upper, 1], [lower, -1]]) {
      for (let i = 0; i < pts.length * 9; i++) {
        const t = r() * n, a = Math.floor(t), [x0, y0] = pts[a], [x1, y1] = pts[Math.min(n, a + 1)], f = t - a;
        const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, lean = (r() - 0.5) * 0.5, l = 2 + r() * r() * 14;
        g.strokeStyle = thread(0.8 + r() * 0.2);
        g.lineWidth = 0.9 + r() * 0.8;
        g.beginPath(); g.moveTo(x, y - k * 2); g.quadraticCurveTo(x + lean * l * 0.3, y + k * l * 0.6, x + lean * l, y + k * l); g.stroke();
      }
      g.strokeStyle = 'rgba(232,226,210,0.22)'; // the raw edge, fuzzy and pale
      g.lineWidth = 2;
      along(pts, -k * 2);
    }
    // a loose thread or two lying over the gap, its shadow under it
    for (let i = 0; i < (cut ? 2 : 3); i++) {
      const a = Math.floor(n * (0.2 + r() * 0.6)), [x0, y0] = upper[a], [x1, y1] = lower[Math.min(n, a + Math.floor((r() - 0.5) * 10))];
      const mx = (x0 + x1) / 2 + (r() - 0.5) * 30, my = (y0 + y1) / 2 + (r() - 0.5) * 10;
      g.lineWidth = 1.4;
      g.strokeStyle = 'rgba(20,14,8,0.35)';
      g.beginPath(); g.moveTo(x0 + 2, y0 + 3); g.quadraticCurveTo(mx + 2, my + 3, x1 + 2, y1 + 3); g.stroke();
      g.strokeStyle = thread(0.95);
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
    }
  }));
}

/** A cigarette burn in the cloth (for a decal): a small hole melted through, its rim hard and black, scorched brown round it, fading out. */
export function burnTex(seed = 941) {
  const r = mulberry32(seed);
  return bleed(canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2 + (r() - 0.5) * 6, cy = h / 2 + (r() - 0.5) * 6;
    g.filter = 'blur(5px)';
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(86,52,24,${0.16 + r() * 0.12})`;
      g.beginPath(); g.ellipse(cx + (r() - 0.5) * 10, cy + (r() - 0.5) * 8, 15 + r() * 10, 11 + r() * 8, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.filter = 'none';
    const pts = [];
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, k = 0.75 + r() * 0.4; pts.push([cx + Math.cos(a) * 11 * k, cy + Math.sin(a) * 9 * k]); }
    const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    path(); g.fillStyle = '#2e2216'; g.fill(); // the stuffing under it, scorched
    g.filter = 'blur(2px)';
    g.fillStyle = 'rgba(132,104,62,0.7)';
    g.beginPath(); g.arc(cx + 1, cy + 1, 4, 0, Math.PI * 2); g.fill();
    g.filter = 'none';
    g.strokeStyle = 'rgba(16,11,8,0.95)'; // the melted rim
    g.lineWidth = 4.5;
    path(); g.stroke();
  }));
}

// ---- fruit (user, 2026-10-17: "make the fruit better, well made"): their skins unrolled — u round
// them, v from the bottom (0) to the stalk (1)

/** An apple's skin: its red in streaks running down from the stalk over a yellow-green ground, thicker on its sunny side, pale lenticels, browner round the stalk and the eye. */
export function appleTex(seed = 1, red = [168, 32, 26], ground = [176, 160, 62]) {
  const r = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = `rgb(${ground})`;
    g.fillRect(0, 0, w, h);
    const sunny = r();
    for (let x = 0; x < w; x += 1) {
      const side = 0.55 + 0.45 * Math.cos((x / w - sunny) * Math.PI * 2);
      for (let k = 0; k < 2; k++) {
        const a = Math.min(1, side * (0.7 + r() * 0.5)), dark = 0.7 + r() * 0.35;
        g.fillStyle = `rgba(${red.map((c) => Math.round(c * dark)).join(',')},${a})`;
        const top = h * (0.02 + r() * 0.1), len = h * (0.55 + r() * 0.4 * side);
        g.fillRect(x, top, 1.4, len);
      }
    }
    g.filter = 'blur(1px)';
    g.drawImage(g.canvas, 0, 0);
    g.filter = 'none';
    for (let i = 0; i < 380; i++) { // lenticels
      g.fillStyle = `rgba(232,214,150,${0.35 + r() * 0.35})`;
      g.beginPath(); g.ellipse(r() * w, h * (0.08 + r() * 0.84), 0.7 + r() * 0.8, 0.5 + r() * 0.5, 0, 0, Math.PI * 2); g.fill();
    }
    for (const [y0, y1] of [[0, 0.1], [0.9, 1]]) { // round the stalk (top) and the eye (bottom)
      const gr = g.createLinearGradient(0, h * (1 - y1), 0, h * (1 - y0));
      const at = y0 === 0 ? [0, 1] : [1, 0];
      gr.addColorStop(at[0], 'rgba(110,84,40,0)');
      gr.addColorStop(at[1], 'rgba(110,84,40,0.75)');
      g.fillStyle = gr;
      g.fillRect(0, h * (1 - y1), w, h * (y1 - y0));
    }
  });
}

/** An orange's peel: mottled, darker in the pits of its pores, the navel a small dark scar at one pole. `kind` 'bump' for the pores raised. */
export function orangeTex(seed = 5, kind = 'color') {
  const r = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = kind === 'bump' ? '#9a9a9a' : '#de7d1c';
    g.fillRect(0, 0, w, h);
    if (kind === 'color') {
      g.filter = 'blur(8px)';
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '240,150,40' : '190,95,20'},0.35)`; g.beginPath(); g.arc(r() * w, r() * h, 10 + r() * 24, 0, Math.PI * 2); g.fill(); }
      g.filter = 'none';
    }
    for (let i = 0; i < 4200; i++) { // the pores
      g.fillStyle = kind === 'bump' ? `rgba(0,0,0,${0.35 + r() * 0.3})` : `rgba(150,70,10,${0.15 + r() * 0.2})`;
      g.beginPath(); g.arc(r() * w, r() * h, 0.5 + r() * 0.9, 0, Math.PI * 2); g.fill();
    }
    if (kind === 'color') { g.fillStyle = 'rgba(120,90,40,0.8)'; g.fillRect(0, 0, w, 3); g.fillStyle = 'rgba(90,110,40,0.6)'; g.fillRect(0, h - 3, w, 3); }
  });
}

/** A pear's skin: yellow-green, freckled and patched with russet, a little blush, brown at the stalk. */
export function pearTex(seed = 9) {
  const r = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b4ac46';
    g.fillRect(0, 0, w, h);
    g.filter = 'blur(10px)';
    for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(${r() < 0.4 ? '170,120,60' : '196,190,90'},0.35)`; g.beginPath(); g.arc(r() * w, r() * h, 12 + r() * 30, 0, Math.PI * 2); g.fill(); }
    g.filter = 'none';
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(128,92,46,${0.25 + r() * 0.4})`; g.beginPath(); g.arc(r() * w, r() * h, 0.5 + r() * 1.2, 0, Math.PI * 2); g.fill(); }
    const gr = g.createLinearGradient(0, 0, 0, h * 0.18);
    gr.addColorStop(0, 'rgba(120,88,44,0.85)');
    gr.addColorStop(1, 'rgba(120,88,44,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h * 0.18);
  });
}

/** A banana's skin, u round it, v from its tip (0) to its stalk (1): yellow, the ridges a touch greener, brown freckles of a ripe one, a black tip and a dry brown stalk. */
export function bananaTex(seed = 13) {
  const r = mulberry32(seed);
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#e3bf38';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(150,150,40,0.35)'; g.fillRect((k / 5) * w - 1, 0, 2.5, h); } // the ridges
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + r() * 30},${55 + r() * 20},20,${0.35 + r() * 0.45})`; g.beginPath(); g.ellipse(r() * w, h * (0.08 + r() * 0.8), 0.8 + r() * 2.2, 0.8 + r() * 1.6, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#2a2016'; g.fillRect(0, h - h * 0.035, w, h * 0.035); // the tip (v = 0, the bottom of the canvas)
    const st = g.createLinearGradient(0, 0, 0, h * 0.12);
    st.addColorStop(0, '#6b5a3a'); st.addColorStop(0.7, '#8d8a45'); st.addColorStop(1, 'rgba(141,138,69,0)');
    g.fillStyle = st; g.fillRect(0, 0, w, h * 0.12); // the stalk
  });
}

/** Where an apple was bitten and left: the flesh, gone brown at the edges, the marks of teeth across it. */
export function biteTex() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    gr.addColorStop(0, '#dcc98e');
    gr.addColorStop(0.6, '#c9a35e');
    gr.addColorStop(1, '#8a5f2a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(120,80,30,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h * 1.3, h * (0.55 + i * 0.09), Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  });
}

/**
 * Old painted steel tube (the swing's frame, user 2026-10-17: "old and worn, with rust"): the paint gone
 * pale and chalky, flaked off in patches down to rust, rust bleeding down from every chip in streaks,
 * worst towards one end (v = 1: the feet). u round it, v along it.
 */
export function rustyPaintTex(seed = 61, paint = '#647f86') {
  const r = mulberry32(seed);
  return canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = paint;
    g.fillRect(0, 0, w, h);
    // chalked and dulled by years of sun, unevenly
    g.filter = 'blur(6px)';
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${r() < 0.6 ? '196,200,194' : '60,72,74'},${0.08 + r() * 0.12})`; g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 30, 20 + r() * 60, 0, 0, Math.PI * 2); g.fill(); }
    g.filter = 'none';
    const rust = (a) => `rgba(${84 + r() * 40},${40 + r() * 22},${18 + r() * 12},${a})`;
    // the paint flaked off in small ragged bits, more of them towards the feet (the top of the canvas is v = 1)
    for (let i = 0; i < 900; i++) {
      const y = h * Math.pow(r(), 2.2), x = r() * w, n = 5 + Math.floor(r() * 4), rad = 0.6 + r() * (y < h * 0.25 ? 3.2 : 1.8);
      g.fillStyle = rust(0.55 + r() * 0.4);
      g.beginPath();
      for (let k = 0; k < n; k++) { const t = (k / n) * Math.PI * 2, d = rad * (0.5 + r() * 0.8); k ? g.lineTo(x + Math.cos(t) * d, y + Math.sin(t) * d * 1.4) : g.moveTo(x + Math.cos(t) * d, y + Math.sin(t) * d * 1.4); }
      g.closePath(); g.fill();
      if (r() < 0.25) { // and a thin rust run down from it
        const len = 8 + r() * 50, grad = g.createLinearGradient(0, y, 0, y + len);
        grad.addColorStop(0, rust(0.28));
        grad.addColorStop(1, rust(0));
        g.fillStyle = grad;
        g.fillRect(x - 0.6, y, 1.2 + r(), len);
      }
    }
    // the feet: rusted right round, only islands of paint left
    const foot = g.createLinearGradient(0, 0, 0, h * 0.1);
    foot.addColorStop(0, rust(0.92));
    foot.addColorStop(0.6, rust(0.5));
    foot.addColorStop(1, rust(0));
    g.fillStyle = foot;
    g.fillRect(0, 0, w, h * 0.1);
  }, { repeat: [1, 1] });
}

/** Water going round and down a toilet's bowl, from above: pale arms spiralling in to the middle, clear between. */
export function swirlTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let arm = 0; arm < 5; arm++) {
      for (let k = 0; k < 160; k++) {
        const t = k / 160, a = arm * ((Math.PI * 2) / 5) + t * 5.5, r = (1 - t) * w * 0.48;
        g.fillStyle = `rgba(255,255,255,${0.08 + 0.3 * (1 - t) * Math.random()})`;
        g.beginPath();
        g.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 1.5 + 6 * (1 - t), 0, Math.PI * 2);
        g.fill();
      }
    }
  });
}

export function carpetTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const img = g.createImageData(w, h);
    const r = mulberry32(7);
    for (let i = 0; i < w * h; i++) {
      const n = r(), n2 = r();
      const v = 0.8 + n * 0.26 + (n2 > 0.93 ? 0.12 : 0) - (n2 < 0.07 ? 0.16 : 0);
      img.data[i * 4] = 168 * v;
      img.data[i * 4 + 1] = 152 * v;
      img.data[i * 4 + 2] = 131 * v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // worn, slightly matted patches
    for (let i = 0; i < 46; i++) {
      const x = r() * w, y = r() * h, rad = 30 + r() * 90;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() > 0.5 ? 'rgba(70,52,36,0.10)' : 'rgba(240,228,205,0.07)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { repeat: [5, 6] });
}

export function carpetBump() {
  return canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    const r = mulberry32(21);
    for (let i = 0; i < w * h; i++) {
      const v = 90 + r() * 165;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { repeat: [16, 19], data: true });
}

export function wallTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d9cbb0';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5200, '#8a775c', 1.3, 11);
    speckle(g, w, h, 2600, '#fff6e2', 1.5, 12);
    const r = mulberry32(13);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h, rad = 60 + r() * 130;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(120,96,66,0.05)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { repeat: [2, 1.5] });
}

export function noiseBump(seed = 5, repeat = [3, 3]) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, '#000', 1.6, seed);
    speckle(g, w, h, 5000, '#fff', 1.6, seed + 1);
  }, { repeat, data: true });
}

export function woodTex(base, dark, seed = 1, repeat = [1, 1], { lengthwise = false, contrast = 1 } = {}) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = mulberry32(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    if (lengthwise) {
      g.translate(w / 2, h / 2);
      g.rotate(Math.PI / 2);
      g.translate(-w / 2, -h / 2);
    }
    for (let i = 0; i < 260; i++) {
      const y0 = r() * h;
      const amp = 2 + r() * 7;
      const ph = r() * 6.28;
      g.strokeStyle = r() > 0.25 ? dark : '#f1d3a2';
      g.globalAlpha = (0.04 + r() * 0.17) * contrast;
      g.lineWidth = 0.6 + r() * 2.6;
      g.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const y = y0 + Math.sin(x * 0.012 + ph) * amp + Math.sin(x * 0.041 + ph * 2) * amp * 0.3;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const x = r() * w, y = r() * h;
      for (let k = 7; k > 0; k--) {
        g.strokeStyle = dark;
        g.globalAlpha = 0.12;
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(x, y, k * 5, k * 2.2, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }, { repeat });
}

function tartan(g, w, h, base, bands, seed) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (const [pos, size, color, alpha] of bands) {
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(pos, 0, size, h);
  }
  for (const [pos, size, color, alpha] of bands) {
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, pos, w, size);
  }
  g.globalAlpha = 1;
  // twill weave: fine diagonal hatching
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 1;
  for (let i = -h; i < w; i += 4) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + h, h);
    g.stroke();
  }
  speckle(g, w, h, 1500, '#000', 1.2, seed);
}

export function plaidTex() {
  return canvasTex(256, 256, (g, w, h) => {
    tartan(g, w, h, '#5d73a6', [
      [0, 74, '#1e2a52', 0.62],
      [86, 7, '#f3efe6', 0.75],
      [104, 44, '#3a4d86', 0.5],
      [160, 8, '#b23a36', 0.8],
      [180, 46, '#d5dbe8', 0.5],
      [236, 6, '#b23a36', 0.7],
    ], 31);
  }, { repeat: [3, 3] });
}

export function pillowPlaidTex() {
  return canvasTex(256, 256, (g, w, h) => {
    tartan(g, w, h, '#b8adb3', [
      [0, 50, '#6f6680', 0.5],
      [64, 6, '#f2ebe6', 0.7],
      [96, 40, '#8f8496', 0.45],
      [150, 6, '#8b4d58', 0.6],
      [176, 50, '#e4dcda', 0.45],
    ], 33);
  }, { repeat: [3, 2] });
}

export function doorTex(base = '#ece6d8') {
  return canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1800, '#9c8f78', 1.2, 41);
    const panel = (x, y, pw, ph) => {
      // routed groove, then a raised field inside it
      g.lineWidth = 7;
      g.strokeStyle = 'rgba(70,58,42,0.42)';
      g.strokeRect(x, y, pw, ph);
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.strokeRect(x + 5, y + 5, pw - 4, ph - 4);
      const gr = g.createLinearGradient(x, y, x + pw, y + ph);
      gr.addColorStop(0, 'rgba(255,255,255,0.20)');
      gr.addColorStop(1, 'rgba(90,76,58,0.12)');
      g.fillStyle = gr;
      g.fillRect(x + 22, y + 22, pw - 44, ph - 44);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(70,58,42,0.28)';
      g.strokeRect(x + 22, y + 22, pw - 44, ph - 44);
    };
    const cols = [60, 286], pw = 166;
    for (const x of cols) {
      panel(x, 56, pw, 170);
      panel(x, 270, pw, 330);
      panel(x, 650, pw, 318);
    }
  });
}

export function outdoorTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#fff3d6');
    sky.addColorStop(0.5, '#ffe2ae');
    sky.addColorStop(1, '#f7c98c');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    // the neighbours' house: clapboard siding and one window
    g.fillStyle = '#b9b2a2';
    g.fillRect(0, 250, w, 262);
    g.strokeStyle = 'rgba(70,62,50,0.35)';
    g.lineWidth = 2;
    for (let y = 262; y < h; y += 16) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.fillStyle = '#8c8577';
    g.beginPath();
    g.moveTo(-20, 252);
    g.lineTo(200, 170);
    g.lineTo(w + 20, 252);
    g.closePath();
    g.fill();
    g.fillStyle = '#f2ece0';
    g.fillRect(300, 330, 110, 140);
    g.fillStyle = '#4a5560';
    g.fillRect(310, 340, 90, 56);
    g.fillRect(310, 404, 90, 56);
  });
}

// ---------------------------------------------------------------- posters

export function posterSprayTex() {
  return canvasTex(768, 512, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#c2a56c');
    bg.addColorStop(0.6, '#a98b55');
    bg.addColorStop(1, '#7d6539');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 4200, '#3b2c16', 2.4, 51);
    speckle(g, w, h, 1800, '#f5e2b4', 2.2, 52);
    // scaffold
    g.strokeStyle = 'rgba(54,40,22,0.75)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(96, 40); g.lineTo(150, 300);
    g.moveTo(160, 30); g.lineTo(214, 290);
    g.stroke();
    g.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      g.beginPath();
      g.moveTo(100 + t * 52, 60 + t * 236);
      g.lineTo(164 + t * 52, 50 + t * 236);
      g.stroke();
    }
    // crouched writer with a mask, one arm out with the can
    g.fillStyle = '#231a10';
    g.beginPath();
    g.ellipse(520, 150, 30, 33, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(480, 180);
    g.quadraticCurveTo(540, 160, 590, 200);
    g.lineTo(620, 290);
    g.lineTo(450, 290);
    g.closePath();
    g.fill();
    g.lineWidth = 22;
    g.lineCap = 'round';
    g.strokeStyle = '#231a10';
    g.beginPath();
    g.moveTo(495, 205);
    g.lineTo(410, 190);
    g.lineTo(372, 168);
    g.stroke();
    g.fillRect(352, 140, 18, 40);
    g.fillStyle = '#c9b58a';
    g.fillRect(496, 150, 46, 12);
    const mist = g.createRadialGradient(320, 150, 4, 320, 150, 90);
    mist.addColorStop(0, 'rgba(250,236,200,0.55)');
    mist.addColorStop(1, 'rgba(250,236,200,0)');
    g.fillStyle = mist;
    g.fillRect(220, 60, 200, 190);
    // title strip
    g.fillStyle = 'rgba(22,17,11,0.86)';
    g.fillRect(0, 308, w, 86);
    g.fillStyle = '#f4ecd8';
    g.font = `58px ${IMPACT}`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText('LINKIN PARK', 34, 353);
    g.fillRect(338, 322, 5, 58);
    g.fillText('METEORA', 362, 353);
    paperWear(g, w, h, 53);
  });
}

export function posterBandTex() {
  return canvasTex(384, 512, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#8d927f');
    bg.addColorStop(1, '#4b4f43');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2600, '#1c1e18', 2, 65);
    [70, 150, 232, 312].forEach((x, i) => figure(g, x, 470, 300 + (i % 2) * 26, '#1c1d19'));
    g.fillStyle = '#e8e4d4';
    g.font = `36px ${IMPACT}`;
    g.textAlign = 'center';
    g.fillText('LIVE 2001', w / 2, 62);
    paperWear(g, w, h, 66);
  });
}

export function posterPanelsTex() {
  return canvasTex(384, 800, (g, w, h) => {
    g.fillStyle = '#16233c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9e2cd';
    g.font = `34px ${IMPACT}`;
    g.textAlign = 'left';
    g.fillText('ON TOUR', 28, 132);
    const head = (cx, cy, cap, skin) => {
      g.fillStyle = skin;
      g.beginPath();
      g.ellipse(cx, cy, 58, 66, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = cap;
      g.beginPath();
      g.ellipse(cx, cy - 34, 66, 42, 0, Math.PI, 0);
      g.fill();
      g.fillRect(cx - 82, cy - 40, 164, 14);
      g.fillStyle = '#17120e';
      g.beginPath();
      g.ellipse(cx - 22, cy + 4, 9, 13, 0, 0, Math.PI * 2);
      g.ellipse(cx + 22, cy + 4, 9, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(cx - 20, cy + 36, 40, 5);
    };
    g.fillStyle = '#c9b68c';
    g.fillRect(96, 170, 260, 190);
    head(226, 276, '#7a3b2a', '#d8a77c');
    g.fillStyle = '#d6c7a2';
    g.fillRect(96, 384, 260, 190);
    head(226, 490, '#a84a32', '#c98f6a');
    g.fillStyle = '#28446e';
    g.fillRect(96, 598, 260, 170);
    paperWear(g, w, h, 68);
  });
}

function drawSepiaPoster(g, w, h) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#9a8468');
  bg.addColorStop(1, '#4a3b2b');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  speckle(g, w, h, 3000, '#1e1610', 2.2, 75);
  g.fillStyle = 'rgba(42,31,22,0.8)';
  g.fillRect(0, 300, w, 148);
  [90, 190, 300, 420, 540].forEach((x, i) => figure(g, x, 420, 250 + (i % 3) * 22, '#231a12'));
  g.fillStyle = '#e4d6b8';
  g.font = `30px ${IMPACT}`;
  g.textAlign = 'right';
  g.fillText('TOUR 2002', w - 26, 50);
  paperWear(g, w, h, 76);
}

/**
 * The tour poster, torn in two down the middle: [left piece, right piece]. Each is clear beyond
 * its ragged edge, and the two edges are the same rip. `TORN_POSTER.piece` of the whole
 * poster's width is how wide either piece's picture is.
 */
export const TORN_POSTER = { piece: 0.5 + 22 / 640 };
export function posterSepiaTornTex() {
  const W = 640, H = 448, half = Math.round(W * TORN_POSTER.piece);
  const whole = document.createElement('canvas');
  whole.width = W;
  whole.height = H;
  drawSepiaPoster(whole.getContext('2d'), W, H);
  // the rip: a line that wanders as it comes down
  const r = mulberry32(91), rip = [];
  for (let y = 0, x = W / 2 + 5; y <= H; y += 8) {
    x = Math.min(W / 2 + 16, Math.max(W / 2 - 16, x + (r() - 0.5) * 10));
    rip.push([x + (r() - 0.5) * 3, y]);
  }
  const piece = (right) => canvasTex(half, H, (g, w, h) => {
    const dx = right ? half - W : 0, outer = right ? w : 0;
    g.clearRect(0, 0, w, h);
    g.beginPath();
    g.moveTo(outer, 0);
    for (const [x, y] of rip) g.lineTo(x + dx, y);
    g.lineTo(outer, h);
    g.closePath();
    g.clip();
    g.drawImage(whole, dx, 0);
    // torn paper shows its pale inside along the rip
    g.strokeStyle = 'rgba(232,222,200,0.9)';
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.beginPath();
    rip.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y) : g.moveTo(x + dx, y)));
    g.stroke();
  });
  return [piece(false), piece(true)];
}

export function posterRapTex() {
  return canvasTex(640, 720, (g, w, h) => {
    g.fillStyle = '#17181a';
    g.fillRect(0, 0, w, h);
    const cone = g.createRadialGradient(w / 2, 560, 10, w / 2, 520, 420);
    cone.addColorStop(0, 'rgba(210,205,195,0.55)');
    cone.addColorStop(0.5, 'rgba(120,118,112,0.18)');
    cone.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = cone;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#efede8';
    g.font = `112px ${IMPACT}`;
    g.textBaseline = 'middle';
    spacedText(g, 'EMINEM', w / 2, 84, 10);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, 610, w, 110);
    // small seated figure, alone under the spot
    g.fillStyle = '#0c0c0d';
    g.beginPath();
    g.ellipse(320, 488, 20, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(286, 520);
    g.quadraticCurveTo(320, 500, 356, 520);
    g.lineTo(372, 612);
    g.lineTo(270, 612);
    g.closePath();
    g.fill();
    speckle(g, w, h, 2600, '#000', 2, 78);
    paperWear(g, w, h, 79);
  });
}

export function stickerGraffitiTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#f1ede4';
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h / 2 + 6);
    g.rotate(-0.05);
    g.transform(1, 0, -0.18, 1, 0, 0);
    g.font = `118px ${IMPACT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#141414';
    g.fillText('GORILLAZ', 6, 6);
    g.fillStyle = '#c4201f';
    g.fillText('GORILLAZ', 0, 0);
    g.restore();
    speckle(g, w, h, 900, '#141414', 2.4, 81);
  });
}

function skull(g, cx, cy, s) {
  g.fillStyle = '#ece8dd';
  g.beginPath();
  g.ellipse(cx, cy, 62 * s, 56 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.roundRect(cx - 36 * s, cy + 30 * s, 72 * s, 48 * s, 10 * s);
  g.fill();
  g.fillStyle = '#0a0a0a';
  g.beginPath();
  g.ellipse(cx - 25 * s, cy + 4 * s, 17 * s, 19 * s, 0.2, 0, Math.PI * 2);
  g.ellipse(cx + 25 * s, cy + 4 * s, 17 * s, 19 * s, -0.2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(cx, cy + 22 * s);
  g.lineTo(cx - 9 * s, cy + 40 * s);
  g.lineTo(cx + 9 * s, cy + 40 * s);
  g.closePath();
  g.fill();
  for (let i = -3; i <= 3; i++) g.fillRect(cx + i * 9 * s - 1.5 * s, cy + 52 * s, 3 * s, 24 * s);
}

function crossed(g, cx, cy, len, thick, knobs) {
  for (const a of [0.6, -0.6]) {
    g.save();
    g.translate(cx, cy);
    g.rotate(a);
    g.fillStyle = '#ece8dd';
    g.beginPath();
    g.roundRect(-len / 2, -thick / 2, len, thick, thick / 2);
    g.fill();
    if (knobs) {
      for (const e of [-len / 2, len / 2]) {
        g.beginPath();
        g.arc(e, -thick * 0.6, thick * 0.75, 0, Math.PI * 2);
        g.arc(e, thick * 0.6, thick * 0.75, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.fillRect(len / 2 - thick * 0.6, -thick * 2.2, thick * 1.2, thick * 4.4);
    }
    g.restore();
  }
}

export function posterSkullTex() {
  return canvasTex(512, 400, (g, w, h) => {
    g.fillStyle = '#0c0c0d';
    g.fillRect(0, 0, w, h);
    crossed(g, w / 2, h / 2 + 30, 400, 26, true);
    skull(g, w / 2, h / 2 - 30, 1.5);
    paperWear(g, w, h, 84);
  });
}

export function posterStuntTex() {
  return canvasTex(400, 520, (g, w, h) => {
    g.fillStyle = '#0d0d0e';
    g.fillRect(0, 0, w, h);
    crossed(g, w / 2, 250, 330, 16, false);
    skull(g, w / 2, 140, 1.25);
    g.fillStyle = '#ece8dd';
    g.font = '700 74px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('jackass', w / 2, 440);
    paperWear(g, w, h, 86);
  });
}

export function posterGenericTex(title, top, bottom, ink, seed) {
  return canvasTex(448, 640, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, top);
    bg.addColorStop(1, bottom);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const r = mulberry32(seed);
    g.strokeStyle = ink;
    g.globalAlpha = 0.35;
    g.lineWidth = 10;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(w / 2 + (r() - 0.5) * 120, 360 + (r() - 0.5) * 90, 60 + r() * 150, r() * 6, r() * 6 + 2.4);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = ink;
    g.font = `92px ${IMPACT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(title, w / 2, 96);
    figure(g, w / 2, 610, 300, 'rgba(0,0,0,0.75)', { lean: -0.12 });
    paperWear(g, w, h, seed + 1);
  });
}

// ---------------------------------------------------------------- screens

export function crtFinish(g, w, h, lineStep) {
  g.fillStyle = 'rgba(0,0,0,0.20)';
  for (let y = 0; y < h; y += lineStep) g.fillRect(0, y, w, 1);
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}

/** The TV picture: the supplied title-screen image, under scanlines and a tube vignette. */
export function tvScreenTex() {
  let tex = null;
  tex = canvasTex(768, 588, (g, w, h) => {
    g.fillStyle = '#05060a';
    g.fillRect(0, 0, w, h);
    const img = new Image();
    img.onload = () => {
      // fill the screen without squashing: trim whatever the image has to spare
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const sw = w / scale, sh = h / scale;
      g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
      crtFinish(g, w, h, 3);
      tex.needsUpdate = true;
    };
    img.src = 'assets/tv-title.webp';
  });
  return tex;
}

/** Woven upholstery for the desk chair. */
export function weaveTex(base, dark, light) {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
      g.fillStyle = (x / 4 + y / 4) % 2 ? dark : light;
      g.globalAlpha = 0.35;
      g.fillRect(x, y, 3, 3);
    }
    g.globalAlpha = 1;
    speckle(g, w, h, 160, '#000', 1, 97);
  }, { repeat: [14, 14] });
}

// ---------------------------------------------------------------- school things

/**
 * Wrap for the pencil case: worn green canvas all the way round, the scribbled side panel
 * (supplied artwork) across the front, the zip along the top. u runs round the tube
 * (0 = front, 0.25 = underneath, 0.75 = top), v along it.
 */
export function pencilCaseTex() {
  let tex = null;
  tex = canvasTex(1024, 1024, (g, w, h) => {
    const zip = () => {
      g.fillStyle = '#1d2a20';
      g.fillRect(0.735 * w, 0, 0.03 * w, h);
      g.fillStyle = '#6f7a70';
      for (let y = 0; y < h; y += 9) g.fillRect(0.744 * w, y, 0.012 * w, 4);
    };
    g.fillStyle = '#34523b';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 9000, '#1c2f21', 1.4, 311);
    speckle(g, w, h, 5000, '#7f9a80', 1.3, 312);
    zip();
    const img = new Image();
    img.onload = () => {
      // the panel spans the front 158° and straddles the seam of the wrap, so it goes on twice;
      // it is turned a quarter so its long side runs along the tube
      const from = 0.78 * w, span = 0.44 * w;
      for (const x0 of [from, from - w]) {
        g.save();
        g.translate(x0, h);
        g.rotate(-Math.PI / 2);
        g.drawImage(img, 0, 0, h, span);
        g.restore();
      }
      zip();
      tex.needsUpdate = true;
    };
    img.src = 'assets/pencil-case-side.jpg';
  });
  return tex;
}

export function rulerTex() {
  return canvasTex(600, 120, (g, w, h) => {
    g.fillStyle = '#3fae45';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(0, h * 0.55, w, h * 0.12);
    g.fillStyle = '#10361a';
    g.font = '700 22px Arial, Helvetica, sans-serif';
    g.textAlign = 'center';
    // 15 cm: a long tick each centimetre, a medium one at the half, short ones for millimetres
    for (let mm = 0; mm <= 150; mm++) {
      const x = 18 + (mm / 150) * (w - 36);
      g.fillRect(x - 1, 0, 2, mm % 10 === 0 ? 40 : mm % 5 === 0 ? 28 : 18);
      if (mm % 10 === 0) g.fillText(String(mm / 10), x, 66);
    }
  });
}

// ---------------------------------------------------------------- small props

export function keyboardTex() {
  return canvasTex(736, 256, (g, w, h) => {
    g.fillStyle = '#d6cdb8';
    g.fillRect(0, 0, w, h);
    const key = (x, y, kw, kh, dark) => {
      g.fillStyle = dark ? '#a9a394' : '#ece5d2';
      g.beginPath();
      g.roundRect(x, y, kw, kh, 4);
      g.fill();
      g.strokeStyle = 'rgba(70,60,44,0.45)';
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + 4, y + 3, kw - 8, kh * 0.45);
    };
    const u = 32, rows = [56, 92, 128, 164, 200];
    for (let i = 0; i < 13; i++) key(18 + i * (u + 4) + (i > 0 ? 14 : 0), 14, u, 26, i === 0);
    rows.forEach((y, r) => {
      const inset = [0, 16, 26, 40, 0][r];
      let x = 18;
      if (inset) { key(x, y, inset + u - 4, u, true); x += inset + u; }
      const n = [14, 12, 11, 10, 0][r];
      for (let i = 0; i < n; i++) { key(x, y, u, u, false); x += u + 4; }
      if (r < 4) key(x, y, 520 - x, u, true);
    });
    key(18, 200, 44, u, true);
    key(66, 200, 44, u, true);
    key(114, 200, 250, u, false);
    key(368, 200, 44, u, true);
    key(416, 200, 104, u, true);
    // arrows / nav cluster and numpad
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) key(536 + c * 36, 56 + r * 36, u, u, true);
    key(572, 164, u, u, true);
    for (let c = 0; c < 3; c++) key(536 + c * 36, 200, u, u, true);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) key(656 + c * 36, 56 + r * 36, u, u, r === 0);
  });
}

/** Label on the game cartridge: plain gold foil with a dark band — no title on it yet. */
export function cartLabelTex() {
  return canvasTex(256, 152, (g, w, h) => {
    const foil = g.createLinearGradient(0, 0, w, h);
    foil.addColorStop(0, '#e6c766');
    foil.addColorStop(0.5, '#b88d2c');
    foil.addColorStop(1, '#dcb955');
    g.fillStyle = foil;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(30,22,8,0.8)';
    g.fillRect(0, h - 34, w, 34);
    speckle(g, w, h, 500, '#3a2a0a', 1.2, 95);
  });
}

export function pcFrontTex() {
  return canvasTex(640, 220, (g, w, h) => {
    g.fillStyle = '#d3cab4';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 700, '#8d8571', 1.2, 91);
    g.strokeStyle = 'rgba(80,70,52,0.5)';
    g.lineWidth = 2;
    g.strokeRect(330, 28, 280, 62);
    g.fillStyle = '#c4bba5';
    g.fillRect(332, 30, 276, 58);
    g.fillStyle = '#6c6657';
    g.fillRect(350, 72, 30, 6);
    g.strokeRect(330, 116, 200, 44);
    g.fillStyle = '#34312b';
    g.fillRect(352, 136, 156, 6);
    g.fillStyle = '#bdb49e';
    g.beginPath();
    g.arc(86, 150, 22, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#39423a'; // the power light, unlit: the lit one is a part of its own (props.js)
    g.fillRect(132, 144, 16, 6);
    g.fillStyle = '#5c4b2e'; // and the disk light
    g.fillRect(156, 144, 16, 6);
    g.fillStyle = 'rgba(80,70,52,0.4)';
    for (let i = 0; i < 9; i++) g.fillRect(40, 30 + i * 9, 180, 3);
  });
}

export function canTex(base, band, title, italic = true) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const sheen = g.createLinearGradient(0, 0, w, 0);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, w, h);
    g.fillStyle = band;
    g.beginPath();
    g.ellipse(256, 128, 150, 62, -0.12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = base;
    g.font = `${italic ? 'italic ' : ''}700 62px Georgia, "Times New Roman", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.translate(256, 128);
    g.rotate(-0.12);
    g.fillText(title, 0, 4);
    g.restore();
  });
}

/** A die-cut sticker of a cartoon dinosaur: white edge, flat colours, picked at in one place. Clear round it. */
export function dinoStickerTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const shape = (draw) => {
      const p = new Path2D();
      draw(p);
      return p;
    };
    const spike = (x, y, lean) => shape((p) => {
      const c = Math.cos(lean), s = Math.sin(lean), at = (u, v) => [x + u * c - v * s, y + u * s + v * c];
      p.moveTo(...at(-19, 8));
      p.lineTo(...at(0, -30));
      p.lineTo(...at(19, 8));
      p.closePath();
    });
    const GREEN = '#63b84a', PLATE = '#f2a23a';
    // back to front: the plates along its back, tail, far leg, body, neck, head, near leg, arm
    const parts = [
      [spike(92, 222, -0.75), PLATE], [spike(138, 236, -0.35), PLATE], [spike(196, 226, -0.2), PLATE], [spike(248, 216, 0), PLATE],
      [spike(300, 172, -0.85), PLATE], [spike(326, 122, -0.75), PLATE],
      [shape((p) => { p.moveTo(180, 250); p.quadraticCurveTo(95, 250, 45, 188); p.quadraticCurveTo(72, 292, 182, 348); p.closePath(); }), GREEN],
      [shape((p) => { p.roundRect(196, 340, 48, 82, 18); p.ellipse(226, 422, 36, 16, 0, 0, Math.PI * 2); }), '#57a842'],
      [shape((p) => p.ellipse(250, 300, 100, 80, 0, 0, Math.PI * 2)), GREEN],
      [shape((p) => { p.moveTo(292, 238); p.quadraticCurveTo(298, 165, 334, 124); p.lineTo(402, 176); p.quadraticCurveTo(366, 216, 352, 300); p.closePath(); }), GREEN],
      [shape((p) => p.ellipse(382, 134, 70, 51, -0.12, 0, Math.PI * 2)), GREEN],
      [shape((p) => { p.roundRect(274, 345, 48, 78, 18); p.ellipse(304, 423, 36, 16, 0, 0, Math.PI * 2); }), GREEN],
      [shape((p) => p.ellipse(356, 276, 27, 11, 0.5, 0, Math.PI * 2)), GREEN],
    ];
    g.lineJoin = g.lineCap = 'round';
    // the white edge it was cut out with, then the drawn outline, then the colours
    for (const [width, ink, fill] of [[50, '#fbfaf5', true], [14, '#1f5a34', false]]) {
      g.strokeStyle = g.fillStyle = ink;
      g.lineWidth = width;
      for (const [part] of parts) {
        g.stroke(part);
        if (fill) g.fill(part);
      }
    }
    for (const [part, colour] of parts) {
      g.fillStyle = colour;
      g.fill(part);
    }
    g.fillStyle = '#d9ed9e'; // belly
    g.beginPath();
    g.ellipse(266, 324, 60, 46, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#429a3b'; // spots
    for (const [x, y, r] of [[196, 268, 11], [228, 248, 8], [176, 296, 7], [322, 208, 8], [120, 262, 7]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(240,128,140,0.85)'; // cheek
    g.beginPath();
    g.ellipse(372, 156, 12, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(400, 120, 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#16241a';
    g.beginPath();
    g.arc(404, 122, 8, 0, Math.PI * 2);
    g.arc(436, 124, 3.2, 0, Math.PI * 2); // and a nostril
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(401, 118, 2.8, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1f5a34';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(404, 142, 30, 0.12 * Math.PI, 0.62 * Math.PI); // the grin
    g.stroke();
    // it has been on the door a while: scuffed, and picked at where the tail ends
    g.strokeStyle = 'rgba(255,255,255,0.3)';
    g.lineWidth = 2;
    for (const [x0, y0, x1, y1] of [[214, 286, 268, 262], [300, 352, 322, 392], [352, 150, 372, 172]]) {
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    }
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(10, 150);
    g.lineTo(58, 196);
    g.lineTo(34, 226);
    g.lineTo(6, 214);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'source-over';
  });
}

export function cdTex(labelled = false) {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    if (labelled) {
      g.fillStyle = '#dcd9d2';
    } else {
      const con = g.createConicGradient(0.6, cx, cy);
      const stops = ['#f2f2f4', '#b8f0ff', '#d9b8ff', '#ffc9de', '#fff3b0', '#c4ffcf', '#f2f2f4', '#9fd8ff', '#e6c2ff', '#f2f2f4'];
      stops.forEach((c, i) => con.addColorStop(i / (stops.length - 1), c));
      g.fillStyle = con;
    }
    g.beginPath();
    g.arc(cx, cy, 126, 0, Math.PI * 2);
    g.fill();
    if (labelled) {
      g.fillStyle = '#2a2a2e';
      g.font = `26px ${IMPACT}`;
      g.textAlign = 'center';
      g.fillText('SUMMER MIX', cx, 62);
      g.font = '14px monospace';
      g.fillText('CD-R 700MB', cx, 206);
    }
    g.fillStyle = 'rgba(210,214,220,0.95)';
    g.beginPath();
    g.arc(cx, cy, 40, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(cx, cy, 15, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
  });
}

export function coverTex(title, bg, ink, accent, seed) {
  return canvasTex(360, 480, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const r = mulberry32(seed);
    g.fillStyle = accent;
    g.beginPath();
    g.moveTo(0, 190 + r() * 60);
    g.lineTo(w, 120 + r() * 60);
    g.lineTo(w, 380);
    g.lineTo(0, 420);
    g.closePath();
    g.fill();
    g.fillStyle = ink;
    g.beginPath();
    g.arc(110 + r() * 140, 280, 54 + r() * 30, 0, Math.PI * 2);
    g.fill();
    g.font = `60px ${IMPACT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(title, w / 2, 62, w - 30);
    g.fillStyle = '#fff';
    g.fillRect(w - 86, h - 50, 66, 32);
    g.fillStyle = '#111';
    for (let i = 0; i < 16; i++) g.fillRect(w - 82 + i * 4, h - 46, 1 + (i % 3), 24);
  });
}

// ---------------------------------------------------------------- the rest of the house
// These repeat by the metre: `PERIOD` says how many metres one copy of each covers, and the
// house lays its UVs out in metres so every surface gets the same size of tile, plank or board.

export const PERIOD = { tile: 0.8, plank: 1.2, lino: 0.6, lawn: 2.4, siding: 1.2, sand: 1, counter: 0.6, asphalt: 4, pave: 1.5 };

/** Small square tiles, 10 cm, 8 × 8 of them, white and glossy, with thin light grey grout. `bump`: grout low, tiles high. */
export function tileTex(bump = false) {
  return canvasTex(512, 512, (g, w, h) => {
    const n = 8, s = w / n, grout = 3;
    g.fillStyle = bump ? '#000' : '#c3c6c8';
    g.fillRect(0, 0, w, h);
    const r = mulberry32(61);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (bump) {
          g.fillStyle = '#fff';
        } else {
          const v = 243 + Math.floor(r() * 9); // not one tile quite the same white as the next
          g.fillStyle = `rgb(${v},${v},${Math.min(255, v + 2)})`;
        }
        g.fillRect(i * s + grout / 2, j * s + grout / 2, s - grout, s - grout);
      }
    }
  }, { repeat: [1, 1], data: bump });
}

/** Floorboards: eight rows of oak strips, 15 cm wide, joints staggered, each board its own shade. */
export function plankTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const r = mulberry32(71), rows = 8, rh = h / rows;
    for (let row = 0; row < rows; row++) {
      let x = -r() * 400;
      while (x < w) {
        const len = 380 + r() * 520, tone = r();
        g.fillStyle = `rgb(${Math.round(150 + tone * 30)},${Math.round(104 + tone * 22)},${Math.round(62 + tone * 16)})`;
        g.fillRect(x, row * rh, len, rh);
        // grain along the board
        for (let k = 0; k < 14; k++) {
          const y = row * rh + 4 + r() * (rh - 8);
          g.strokeStyle = r() > 0.3 ? 'rgba(70,44,22,0.16)' : 'rgba(255,226,180,0.1)';
          g.lineWidth = 0.8 + r() * 1.6;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.7, y + (r() - 0.5) * 6, x + len, y + (r() - 0.5) * 4);
          g.stroke();
        }
        g.fillStyle = 'rgba(40,24,12,0.55)'; // the joint at its end
        g.fillRect(x + len - 2, row * rh, 3, rh);
        x += len;
      }
      g.fillStyle = 'rgba(40,24,12,0.5)'; // and down its sides
      g.fillRect(0, row * rh, w, 2);
    }
    speckle(g, w, h, 2400, '#3a2410', 1.2, 72);
  }, { repeat: [1, 1] });
}

/** Kitchen vinyl: a checker of cream and faded sage, 30 cm squares, yellowed and scuffed. */
export function linoTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const s = w / 2;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#8f9a7b' : '#ddd2b6';
        g.fillRect(i * s, j * s, s, s);
      }
    }
    speckle(g, w, h, 3000, '#5c5440', 1.4, 81);
    speckle(g, w, h, 1500, '#fffaf0', 1.2, 82);
    const r = mulberry32(83);
    g.strokeStyle = 'rgba(60,50,36,0.12)';
    for (let k = 0; k < 40; k++) {
      g.lineWidth = 1 + r() * 2;
      const x = r() * w, y = r() * h;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 90, y + (r() - 0.5) * 20);
      g.stroke();
    }
    g.fillStyle = 'rgba(70,60,40,0.35)';
    g.fillRect(0, 0, w, 2);
    g.fillRect(0, 0, 2, h);
  }, { repeat: [1, 1] });
}

/** A lawn nobody has mown for a couple of weeks: blades in a dozen greens, dry patches. */
export function lawnTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#4b6129';
    g.fillRect(0, 0, w, h);
    const r = mulberry32(91);
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, rad = 40 + r() * 160;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() > 0.5 ? 'rgba(150,140,70,0.28)' : 'rgba(40,60,20,0.3)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const greens = ['#5f7a33', '#3e5420', '#6f8a3c', '#7d8f45', '#a29a56', '#33461a'];
    for (let i = 0; i < 26000; i++) {
      const x = r() * w, y = r() * h, len = 4 + r() * 9, lean = (r() - 0.5) * 0.9;
      g.strokeStyle = greens[Math.floor(r() * greens.length)];
      g.lineWidth = 1 + r();
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + lean * len, y - len);
      g.stroke();
    }
  }, { repeat: [1, 1] });
}

/** The outside of the house: painted clapboard, ten boards to 1.2 m, chalky and streaked. */
export function sidingTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const n = 10, bh = h / n;
    for (let i = 0; i < n; i++) {
      const y = i * bh;
      const gr = g.createLinearGradient(0, y, 0, y + bh);
      gr.addColorStop(0, '#cfc6b1'); // in the shadow of the board above
      gr.addColorStop(0.18, '#e2dac6');
      gr.addColorStop(1, '#d8cfba');
      g.fillStyle = gr;
      g.fillRect(0, y, w, bh);
      g.fillStyle = 'rgba(60,52,40,0.45)';
      g.fillRect(0, y + bh - 2, w, 2);
    }
    speckle(g, w, h, 2600, '#8c826c', 1.2, 101);
    const r = mulberry32(102);
    for (let i = 0; i < 18; i++) {
      const x = r() * w;
      g.strokeStyle = `rgba(110,98,78,${0.04 + r() * 0.06})`;
      g.lineWidth = 2 + r() * 6;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + (r() - 0.5) * 30, h);
      g.stroke();
    }
  }, { repeat: [1, 1] });
}

/**
 * A ragged patch of lifted paint, as a path: round (cx, cy), `rx` along the grain (x) and `ry` across it, its
 * edge torn — for what comes off old paint (peelingPaintTex, peelingSidingTex).
 */
function flake(g, r, cx, cy, rx, ry) {
  const n = 18 + Math.floor(r() * 12), ph = r() * 6.3;
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, j = 0.62 + r() * 0.5 + 0.18 * Math.sin(a * 3 + ph);
    const x = cx + Math.cos(a) * rx * j, y = cy + Math.sin(a) * ry * j;
    if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}

/** Grey weathered wood, the grain running along x (what shows where paint has come away). */
function bareWood(g, w, h, r, base = '#8c877b') {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < Math.round(h / 2.2); i++) {
    const y0 = r() * h, amp = 0.6 + r() * 2.5, ph = r() * 6.3;
    g.strokeStyle = r() < 0.6 ? `rgba(58,52,44,${0.12 + r() * 0.25})` : `rgba(190,184,170,${0.08 + r() * 0.16})`;
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    for (let x = -10; x <= w + 10; x += 20) { const y = y0 + Math.sin(x * 0.01 + ph) * amp; if (x < 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  }
}

/**
 * Old paint coming away from wood (user, 2026-10-19, the back door after his photo: green paint and white
 * trim, chipped and peeling to grey wood): the paint `color` laid over weathered wood, lifted off in ragged
 * flakes along the grain (x), each with the dark lip of its torn edge, the white undercoat showing at some,
 * crazed in places, grimy. `amount`: how much of it has gone (0…1). 512 px over 0.6 m.
 */
export function peelingPaintTex(color, seed = 1, amount = 0.3, under = '#d8d2c2') {
  return canvasTex(512, 512, (g, w, h) => {
    const r = mulberry32(seed);
    bareWood(g, w, h, r);
    const p = document.createElement('canvas');
    p.width = w; p.height = h;
    const q = p.getContext('2d');
    q.fillStyle = color;
    q.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { // the paint's own unevenness: brushed, faded in streaks along the grain
      q.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.02 + r() * 0.05})` : `rgba(0,0,0,${0.02 + r() * 0.06})`;
      q.fillRect(r() * w, r() * h, 20 + r() * 160, 1 + r() * 3);
    }
    for (let i = 0; i < 90; i++) { // crazing: fine cracks, more across the grain than along it
      const x = r() * w, y = r() * h;
      q.strokeStyle = `rgba(30,26,20,${0.12 + r() * 0.2})`;
      q.lineWidth = 0.6;
      q.beginPath(); q.moveTo(x, y);
      let cx = x, cy = y;
      for (let k = 0; k < 5; k++) { cx += (r() - 0.5) * 18; cy += (r() - 0.5) * 6; q.lineTo(cx, cy); }
      q.stroke();
    }
    // flakes gone: undercoat round some of them, then the wood
    const flakes = Array.from({ length: Math.round(16 + amount * 70) }, () => [r() * w, r() * h, 6 + r() * 46 * (0.5 + amount), 2 + r() * 10 * (0.5 + amount)]);
    q.globalCompositeOperation = 'destination-out';
    q.fillStyle = '#000'; // (opaque: what it cuts away is wholly gone)
    for (const [x, y, rx, ry] of flakes) { flake(q, r, x, y, rx, ry); q.fill(); }
    q.globalCompositeOperation = 'source-over';
    // laid over the wood, its torn edges casting a little shadow, a pale lip where they lift
    g.save();
    g.shadowColor = 'rgba(20,16,10,0.7)';
    g.shadowBlur = 3;
    g.shadowOffsetX = 1;
    g.shadowOffsetY = 1.5;
    g.drawImage(p, 0, 0);
    g.restore();
    g.fillStyle = under; // the old undercoat at the edge of a few
    for (const [x, y, rx, ry] of flakes) if (r() < 0.35) { g.globalAlpha = 0.5; flake(g, r, x + rx * 0.6, y, rx * 0.35, ry * 0.5); g.fill(); }
    g.globalAlpha = 1;
    for (let i = 0; i < 7; i++) { // grime
      const x = r() * w, y = r() * h, rad = 30 + r() * 90, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(48,42,32,${0.08 + r() * 0.12})`);
      gr.addColorStop(1, 'rgba(48,42,32,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    speckle(g, w, h, 900, '#2a261e', 1.0, seed + 5);
  }, { repeat: [1, 1] });
}

/**
 * The house's clapboards outside (user, 2026-10-19: "the outside walls more worn, like this"): white paint
 * gone grey and peeling off in long strips along the boards to the grey wood under it, worst low down and
 * along each board's lower edge where the wet runs off; mildew and splashed dirt at the foot; the lap of each
 * board over the next a dark line. 2048 × 1024 px over 5.28 × 2.64 m (22 boards of 12 cm, floor to roof);
 * `bump`: the boards' wedge and the paint standing proud of the bare wood.
 */
export function peelingSidingTex(bump = false) {
  return canvasTex(2048, 1024, (g, w, h) => {
    const r = mulberry32(4471), n = 22, bh = h / n;
    const low = (y) => y / h; // 0 at the top of the wall … 1 at its foot
    if (bump) {
      for (let i = 0; i < n; i++) { // each board a wedge, thickest at its lower edge
        const gr = g.createLinearGradient(0, i * bh, 0, (i + 1) * bh);
        gr.addColorStop(0, '#3a3a3a');
        gr.addColorStop(0.92, '#b0b0b0');
        gr.addColorStop(1, '#202020');
        g.fillStyle = gr;
        g.fillRect(0, i * bh, w, bh);
      }
    } else bareWood(g, w, h, r, '#a29d91'); // (weathered silver-grey, as in his photo: not dark)
    // the paint, on its own layer, then what has peeled off it
    const p = document.createElement('canvas');
    p.width = w; p.height = h;
    const q = p.getContext('2d');
    q.fillStyle = bump ? 'rgba(255,255,255,0.18)' : '#d4cdbd';
    q.fillRect(0, 0, w, h);
    if (!bump) {
      for (let i = 0; i < n; i++) { // each board's paint a shade apart, darker under the lap above
        q.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '60,54,44'},${0.02 + r() * 0.05})`;
        q.fillRect(0, i * bh, w, bh);
        const gr = q.createLinearGradient(0, i * bh, 0, i * bh + bh * 0.3);
        gr.addColorStop(0, 'rgba(60,52,40,0.28)');
        gr.addColorStop(1, 'rgba(60,52,40,0)');
        q.fillStyle = gr;
        q.fillRect(0, i * bh, w, bh * 0.3);
      }
      for (let i = 0; i < 1100; i++) { // streaks of chalky fading along the boards
        q.fillStyle = `rgba(${r() < 0.55 ? '235,230,218' : '90,84,70'},${0.03 + r() * 0.06})`;
        q.fillRect(r() * w, r() * h, 40 + r() * 300, 1 + r() * 3);
      }
    }
    q.globalCompositeOperation = 'destination-out';
    q.fillStyle = '#000'; // (opaque: what it cuts away is wholly gone)
    for (let i = 0; i < 1100; i++) { // long strips along the boards, most low down and at the boards' lower edges
      const row = Math.floor(r() * n), y = row * bh + bh * (r() < 0.6 ? 0.6 + r() * 0.38 : r()), lw = low(y);
      if (r() > 0.25 + lw * 0.7) continue;
      flake(q, r, r() * w, y, 10 + r() * 75 * (0.6 + lw), 2 + r() * 8 * (0.6 + lw * 0.8));
      q.fill();
    }
    for (let i = 0; i < 16; i++) { // and here and there a board nearly bare for a stretch
      const row = Math.floor(r() * n), x = r() * w;
      flake(q, r, x, row * bh + bh * 0.5, 80 + r() * 220, bh * (0.35 + r() * 0.2));
      q.fill();
    }
    q.globalCompositeOperation = 'source-over';
    g.save();
    if (!bump) { g.shadowColor = 'rgba(24,20,14,0.4)'; g.shadowBlur = 2.5; g.shadowOffsetX = 1; g.shadowOffsetY = 1.5; }
    g.drawImage(p, 0, 0);
    g.restore();
    // the lap: each board's lower edge over the next, a hard dark line and its shadow
    for (let i = 1; i <= n; i++) {
      g.fillStyle = bump ? '#101010' : 'rgba(36,30,22,0.55)';
      g.fillRect(0, i * bh - 2, w, 2);
      if (!bump) { g.fillStyle = 'rgba(36,30,22,0.18)'; g.fillRect(0, i * bh, w, 4); }
    }
    if (bump) return;
    // at the foot: green-black mildew and the dirt that rain splashes up, streaks running down from the eaves
    const foot = g.createLinearGradient(0, h * 0.78, 0, h);
    foot.addColorStop(0, 'rgba(52,58,36,0)');
    foot.addColorStop(0.7, 'rgba(52,58,36,0.25)');
    foot.addColorStop(1, 'rgba(40,36,26,0.55)');
    g.fillStyle = foot;
    g.fillRect(0, h * 0.78, w, h * 0.22);
    for (let i = 0; i < 40; i++) {
      const x = r() * w, len = 60 + r() * 380, wd = 3 + r() * 14, gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, `rgba(58,50,36,${0.1 + r() * 0.14})`);
      gr.addColorStop(1, 'rgba(58,50,36,0)');
      g.fillStyle = gr;
      g.fillRect(x, 0, wd, len);
    }
    speckle(g, w, h, 5000, '#2a281e', 1.1, 4472);
  }, { repeat: [0.5, 1], data: bump });
}

/**
 * A lace curtain (the back door's, behind its glass): a fine net, off-white, with flowers worked into it in
 * rows and a scalloped hem — of no maker. Alpha: the holes see through. 256 × 512 over its width and height.
 */
export function laceTex() {
  return canvasTex(256, 512, (g, w, h) => {
    const r = mulberry32(5113);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(236,230,214,0.55)'; // the net
    g.lineWidth = 0.9;
    for (let x = -h; x < w + h; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * 0.5, h); g.stroke(); g.beginPath(); g.moveTo(x, 0); g.lineTo(x - h * 0.5, h); g.stroke(); }
    g.fillStyle = 'rgba(240,234,220,0.9)'; // the flowers, row on row, every other row shifted
    for (let row = 0, y = 40; y < h - 50; y += 58, row++) {
      for (let x = (row % 2) * 32 + 16; x < w; x += 64) {
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 6, 3.2, a, 0, Math.PI * 2); g.fill(); }
        g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(240,234,220,0.75)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x, y + 12); g.quadraticCurveTo(x + 10, y + 22, x + 4, y + 30); g.stroke(); // a stalk and a leaf
        g.beginPath(); g.ellipse(x + 8, y + 22, 5, 2.2, 0.8, 0, Math.PI * 2); g.fill();
      }
    }
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.arc(x + 8, h - 12, 8, 0, Math.PI); g.fill(); } // the scalloped hem
    g.fillRect(0, h - 14, w, 4);
    g.globalCompositeOperation = 'destination-out'; // worn: a few threads gone, a yellowed patch
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 3, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createRadialGradient(w * 0.3, h * 0.7, 0, w * 0.3, h * 0.7, h * 0.4);
    gr.addColorStop(0, 'rgba(190,160,100,0.35)');
    gr.addColorStop(1, 'rgba(190,160,100,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

/**
 * The corridor's wallpaper (user, 2026-10-19, after the pattern he sent, its flowers made bigger — drawn here in
 * its manner, nothing of the picture itself; his first take on it had read as specks of dirt, not flowers): warm
 * beige paper, a little mottled and flecked with age; posies of two or three big five-petalled flowers — broad
 * round petals, rose-brown to tan, watercolour-soft, darker and veined towards a ringed ochre eye — among
 * pointed olive leaves, set in staggered rows; between them sprays of little ochre flowers on thin brown stems.
 * Tiles every 0.8 m (`period` in house.js): the big flowers ~5 cm across. 2048 px.
 */
export function floralWallpaperTex() {
  return canvasTex(2048, 2048, (g, w, h) => {
    const r = mulberry32(8123);
    const pick = (rr, list) => list[Math.floor(rr() * list.length)];
    g.fillStyle = '#d7bf94';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) { // the paper, mottled
      const x = r() * w, y = r() * h, rad = 60 + r() * 260, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${r() < 0.5 ? '196,170,124' : '228,212,176'},${0.06 + r() * 0.1})`);
      gr.addColorStop(1, 'rgba(210,190,150,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    speckle(g, w, h, 16000, '#b39d74', 1.1, 8124);
    for (let i = 0; i < 700; i++) { // pale flecks and scuffs in the print
      const x = r() * w, y = r() * h, a = r() * Math.PI, l = 3 + r() * 12;
      g.strokeStyle = `rgba(238,226,198,${0.25 + r() * 0.35})`; g.lineWidth = 1 + r() * 1.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    const wrapped = (x, y, m, fn) => { for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) if (x + ox > -m && x + ox < w + m && y + oy > -m && y + oy < h + m) fn(x + ox, y + oy); }; // (it tiles)
    const ROSE = [[184, 128, 100], [174, 116, 88], [192, 140, 108], [198, 152, 112], [166, 112, 88], [204, 160, 118]]; // (a shade lighter than they look in his picture: on the wall, in the corridor's dim light, they went near black)
    const OLIVE = [[142, 138, 96], [128, 126, 86], [150, 146, 104], [118, 118, 80]];
    const rgb = (c, k = 1, a = 1) => `rgba(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)},${a})`;
    const stem = (pts, width, c = '#8d7450') => { g.strokeStyle = c; g.lineWidth = width; g.lineCap = 'round'; g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i += 2) g.quadraticCurveTo(...pts[i], ...pts[i + 1]); g.stroke(); };
    const leaf = (rr, x, y, len, a, c) => { // pointed, a little lopsided, veined
      const wd = len * (0.36 + rr() * 0.1), bend = (rr() - 0.5) * 0.25;
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(len * 0.25, -wd * 1.05, len * 0.7, -wd * (0.8 + bend), len, 0);
      g.bezierCurveTo(len * 0.7, wd * (0.8 - bend), len * 0.25, wd * 1.05, 0, 0);
      const gr = g.createLinearGradient(0, -wd, 0, wd);
      gr.addColorStop(0, rgb(c, 1.08, 0.92)); gr.addColorStop(0.5, rgb(c, 0.92, 0.95)); gr.addColorStop(1, rgb(c, 0.8, 0.92));
      g.fillStyle = gr; g.fill();
      g.strokeStyle = rgb(c, 0.62, 0.35); g.lineWidth = 1.1; g.stroke();
      g.strokeStyle = rgb(c, 0.6, 0.55); g.lineWidth = 1.4; g.beginPath(); g.moveTo(len * 0.04, 0); g.quadraticCurveTo(len * 0.5, wd * bend * 0.6, len * 0.92, 0); g.stroke(); // midrib
      g.lineWidth = 0.8; g.strokeStyle = rgb(c, 0.65, 0.35);
      for (let k = 1; k <= 4; k++) { const u = k / 5.2; g.beginPath(); g.moveTo(len * u, 0); g.lineTo(len * (u + 0.12), -wd * 0.55); g.moveTo(len * u, 0); g.lineTo(len * (u + 0.12), wd * 0.55); g.stroke(); }
      g.restore();
    };
    const bigFlower = (rr, x, y, R, c, back) => { // five broad round petals, each a little notched, overlapping
      const a0 = rr() * Math.PI * 2, k = back ? 1.06 : 1;
      for (let p = 0; p < 5; p++) {
        const a = a0 + (p / 5) * Math.PI * 2 + (rr() - 0.5) * 0.18, L = R * (0.92 + rr() * 0.14), W = L * 0.66, lt = 0.94 + rr() * 0.12;
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath(); g.moveTo(0, 0);
        g.bezierCurveTo(L * 0.3, -W * 0.95, L * 1.04, -W * 1.0, L * 0.98, -W * 0.16);
        g.quadraticCurveTo(L * 0.9, 0, L * 0.98, W * 0.16);
        g.bezierCurveTo(L * 1.04, W * 1.0, L * 0.3, W * 0.95, 0, 0);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, L);
        gr.addColorStop(0, rgb(c, 0.62 * k, 0.96)); gr.addColorStop(0.3, rgb(c, 0.84 * k * lt, 0.93)); gr.addColorStop(0.72, rgb(c, 0.98 * k * lt, 0.9)); gr.addColorStop(1, rgb(c, 1.08 * k, 0.88));
        g.fillStyle = gr; g.fill();
        g.strokeStyle = rgb(c, 0.58, 0.35); g.lineWidth = 1.3; g.stroke();
        g.lineWidth = 1.0; // veins, darker, from the eye
        for (let v = 0; v < 5; v++) { const t = (v / 4 - 0.5) * 0.9; g.strokeStyle = rgb(c, 0.55, 0.25 + rr() * 0.2); g.beginPath(); g.moveTo(L * 0.14, t * W * 0.15); g.quadraticCurveTo(L * 0.4, t * W * 0.55, L * (0.55 + rr() * 0.2), t * W * 0.8); g.stroke(); }
        g.restore();
      }
      // the eye: an ochre ring, cream inside it, a dark point, specks of stamens round it
      g.fillStyle = 'rgba(186,146,86,0.92)'; g.beginPath(); g.arc(x, y, R * 0.19, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(222,204,160,0.85)'; g.beginPath(); g.arc(x, y, R * 0.11, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(92,62,40,0.95)'; g.beginPath(); g.arc(x, y, R * 0.055, 0, Math.PI * 2); g.fill();
      for (let s = 0; s < 9; s++) { const t = (s / 9) * Math.PI * 2; g.fillStyle = 'rgba(110,70,44,0.7)'; g.beginPath(); g.arc(x + Math.cos(t) * R * 0.25, y + Math.sin(t) * R * 0.25, R * 0.03, 0, Math.PI * 2); g.fill(); }
    };
    const smallFlower = (rr, x, y, s) => { // five round petals, ochre to tan, outlined
      const c = pick(rr, [[196, 152, 96], [184, 136, 84], [202, 164, 108], [176, 128, 82]]), a0 = rr() * 6.3;
      g.beginPath();
      for (let p = 0; p < 5; p++) { const a = a0 + (p / 5) * Math.PI * 2; g.moveTo(x + Math.cos(a) * s * 0.55 + s * 0.48, y + Math.sin(a) * s * 0.55); g.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.48, s * 0.4, a, 0, Math.PI * 2); }
      g.fillStyle = rgb(c, 1, 0.92); g.fill();
      g.strokeStyle = rgb(c, 0.62, 0.55); g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(236,222,188,0.95)'; g.beginPath(); g.arc(x, y, s * 0.26, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(98,64,40,0.95)'; g.beginPath(); g.arc(x, y, s * 0.11, 0, Math.PI * 2); g.fill();
    };
    const bud = (rr, x, y, s) => { g.fillStyle = rgb(pick(rr, [[170, 116, 76], [186, 140, 90]]), 1, 0.9); g.beginPath(); g.ellipse(x, y, s, s * 0.75, rr() * 6.3, 0, Math.PI * 2); g.fill(); };
    const spray = (rr, x, y) => { // a little branch: a curving stem, short side stems, each with a flower or a bud, a leaf or two
      const a = rr() * Math.PI * 2, len = 70 + rr() * 80, bendA = (rr() - 0.5) * 1.2, n = 3 + Math.floor(rr() * 4);
      const along = (u) => [x + Math.cos(a + bendA * u) * len * u, y + Math.sin(a + bendA * u) * len * u];
      stem([along(0), along(0.5), along(1)], 1.6);
      const heads = [];
      for (let k = 0; k < n; k++) {
        const u = 0.18 + (k / n) * 0.75, [sx, sy] = along(u), side = k % 2 ? 1 : -1, sa = a + bendA * u + side * (0.7 + rr() * 0.6), sl = 20 + rr() * 26;
        const hx = sx + Math.cos(sa) * sl, hy = sy + Math.sin(sa) * sl;
        stem([[sx, sy], [(sx + hx) / 2 + side * 3, (sy + hy) / 2], [hx, hy]], 1.1);
        heads.push([hx, hy, rr() < 0.8]);
      }
      heads.push([...along(1), true]);
      leaf(rr, ...along(0.1 + rr() * 0.3), 24 + rr() * 12, a + (rr() < 0.5 ? 1 : -1) * 0.9, pick(rr, OLIVE));
      if (rr() < 0.6) leaf(rr, ...along(0.45 + rr() * 0.3), 20 + rr() * 10, a + (rr() < 0.5 ? 1 : -1) * 1.1, pick(rr, OLIVE));
      for (const [hx, hy, open] of heads) open ? smallFlower(rr, hx, hy, 15 + rr() * 5) : bud(rr, hx, hy, 5 + rr() * 2);
    };
    const posy = (rr, x, y) => { // two or three big flowers, leaves round them, a sprig or two going off
      const q = rr(), n = q < 0.2 ? 2 : q < 0.8 ? 3 : 4, R = 62 + rr() * 14, a0 = rr() * 6.3, heads = [];
      for (let k = 0; k < n; k++) { const a = a0 + (k / n) * Math.PI * 2 + (rr() - 0.5) * 0.6, d = R * (0.82 + rr() * 0.3); heads.push([x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.8 + rr() * 0.3)]); }
      for (let k = 0; k < 2; k++) if (rr() < 0.8) { const a = rr() * 6.3; const sx = x + Math.cos(a) * R * 2.2, sy = y + Math.sin(a) * R * 2.2; stem([[x, y], [x + Math.cos(a + 0.3) * R * 1.2, y + Math.sin(a + 0.3) * R * 1.2], [sx, sy]], 1.5); heads.push([sx, sy, 0]); }
      const nl = 8 + Math.floor(rr() * 5);
      for (let k = 0; k < nl; k++) { // leaves from under the flowers, outwards, some in pairs
        const a = rr() * Math.PI * 2, d = R * (1.0 + rr() * 0.7), lx = x + Math.cos(a) * d * 0.55, ly = y + Math.sin(a) * d * 0.55, c = pick(rr, OLIVE), len = R * (1.0 + rr() * 0.5);
        leaf(rr, lx, ly, len, a + (rr() - 0.5) * 0.5, c);
        if (rr() < 0.35) leaf(rr, lx, ly, len * 0.8, a + 0.7 + rr() * 0.3, c);
      }
      const cols = [pick(rr, ROSE), pick(rr, ROSE), pick(rr, ROSE)];
      heads.filter((hd) => hd[2]).sort((p, q) => p[2] - q[2]).forEach(([hx, hy, hr], k) => bigFlower(rr, hx, hy, hr, cols[k % 3], k === 0 && heads.length > 2));
      for (const [hx, hy, hr] of heads) if (!hr) { smallFlower(rr, hx, hy, 15 + rr() * 5); bud(rr, hx + 14, hy - 10, 6); }
    };
    // where the posies go: staggered rows, four by four, each a little off its place
    const posies = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) posies.push([((i + (j % 2) * 0.5 + (r() - 0.5) * 0.22) / 4) * w, ((j + (r() - 0.5) * 0.2) / 4) * h]);
    const dist = (p, q) => { let dx = Math.abs(p[0] - q[0]), dy = Math.abs(p[1] - q[1]); dx = Math.min(dx, w - dx); dy = Math.min(dy, h - dy); return Math.hypot(dx, dy); };
    const sprays = [];
    for (let tries = 0; tries < 8000 && sprays.length < 110; tries++) {
      const p = [r() * w, r() * h];
      if (posies.some((q) => dist(p, q) < 215) || sprays.some((q) => dist(p, q) < 100)) continue;
      sprays.push(p);
    }
    for (const [x, y] of sprays) { const seed = Math.floor(r() * 1e9); wrapped(x, y, 160, (px, py) => spray(mulberry32(seed), px, py)); }
    for (const [x, y] of posies) { const seed = Math.floor(r() * 1e9); wrapped(x, y, 260, (px, py) => posy(mulberry32(seed), px, py)); }
    g.fillStyle = 'rgba(214,198,164,0.34)'; // printed long ago and faded, its colours gone towards the paper's (user, 2026-10-19: "more faded"); the wear that differs along the walls is laid over it (wallpaperWearTex)
    g.fillRect(0, 0, w, h);
  }, { repeat: [1, 1] });
}

/**
 * The corridor's paper worn, a wall at a time (user, 2026-10-19: "more worn and faded"), laid over the printed
 * pattern so it never repeats: `len` along the wall by `hgt` up it, from the rail to the ceiling (1.07 m up),
 * transparent where the paper is only itself. Yellowed and paled in broad patches; grime under the ceiling; a
 * long rub at shoulder height; hands' smudges by the doors (`scuffs`: where, along); the seams between the
 * lengths of paper, their edges lifted, open at the top on some; brown runs from a leak (`stains`: { x, w, len });
 * where a picture hung once, cleaner, a line of dust round it (`ghost`: { x, y, w, h }, y its middle above the
 * floor); scrapes; a tear or two showing the plaster. 192 px to the metre.
 */
export function wallpaperWearTex({ len, hgt, seed, seams = 0.53, stains = [], scuffs = [], ghost = null, tears = 2 }) {
  const S = 192, W = Math.round(len * S), H = Math.round(hgt * S), B0 = 1.07;
  return canvasTex(W, H, (g) => {
    const r = mulberry32(seed), yAt = (y) => (hgt - (y - B0)) * S;
    const blob = (x, y, rx, ry, rgba, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, rx);
      gr.addColorStop(0, `rgba(${rgba},${a})`); gr.addColorStop(1, `rgba(${rgba},0)`);
      g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
      g.fillStyle = gr; g.fillRect(x - rx, y - rx, rx * 2, rx * 2);
      g.restore();
    };
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < len * 9; i++) blob(r() * W, r() * H, (0.2 + r() * 0.7) * S, (0.15 + r() * 0.55) * S, r() < 0.6 ? '146,112,60' : '230,220,194', 0.08 + r() * 0.14); // yellowed here, paled there
    let gr = g.createLinearGradient(0, 0, 0, 0.35 * S); // under the ceiling: years of grime
    gr.addColorStop(0, 'rgba(78,62,40,0.34)'); gr.addColorStop(0.35, 'rgba(78,62,40,0.12)'); gr.addColorStop(1, 'rgba(78,62,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 0.35 * S);
    gr = g.createLinearGradient(0, H, 0, H - 0.12 * S); // and over the rail
    gr.addColorStop(0, 'rgba(78,62,40,0.18)'); gr.addColorStop(1, 'rgba(78,62,40,0)');
    g.fillStyle = gr; g.fillRect(0, H - 0.12 * S, W, 0.12 * S);
    for (let x = 0; x < len; x += 0.12) if (r() < 0.65) blob(x * S, yAt(1.32 + (r() - 0.5) * 0.14), (0.15 + r() * 0.3) * S, (0.04 + r() * 0.03) * S, '92,76,54', 0.05 + r() * 0.07); // shoulders going by
    for (const sx of scuffs) for (let k = 0; k < 8; k++) blob((sx + (r() - 0.5) * 0.22) * S, yAt(1.12 + r() * 0.32), (0.02 + r() * 0.04) * S, (0.02 + r() * 0.03) * S, '84,70,52', 0.12 + r() * 0.16); // hands
    for (let i = 0; i < len * 12; i++) { // scrapes, paler, most low down where things are carried past
      const x = r() * W, y = yAt(B0 + r() ** 1.8 * hgt), l = 4 + r() * 24, a = (r() - 0.5) * 0.6;
      g.strokeStyle = `rgba(236,224,198,${0.25 + r() * 0.3})`; g.lineWidth = 0.8 + r() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    if (ghost) { // where a picture hung: none of the wear behind it, its colour a little stronger, dust along where the frame met the wall;
      // before the seams, which ran on behind it (user, 2026-11-02: it broke the line)
      const x = (ghost.x - ghost.w / 2) * S, y = yAt(ghost.y + ghost.h / 2), w = ghost.w * S, h = ghost.h * S;
      g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.9)'; g.fillRect(x, y, w, h); g.restore();
      g.fillStyle = 'rgba(170,124,80,0.13)'; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(64,50,32,0.3)'; g.lineWidth = 2.5; g.strokeRect(x, y, w, h);
    }
    for (let x = seams * (0.3 + r() * 0.5); x < len; x += seams) { // the seams: a hairline, the edge catching the light; lifting from the top on some
      const px = x * S;
      g.fillStyle = 'rgba(70,54,36,0.4)'; g.fillRect(px, 0, 1.3, H);
      g.fillStyle = 'rgba(240,228,200,0.3)'; g.fillRect(px + 1.3, 0, 1.6, H);
      if (r() < 0.3) {
        const l = (0.05 + r() * 0.15) * S, wd = 2 + r() * 3;
        g.fillStyle = '#b9b09a'; g.beginPath(); g.moveTo(px, 0); g.lineTo(px + wd, 0); g.lineTo(px + 1, l); g.closePath(); g.fill(); // the wall under it
        g.strokeStyle = 'rgba(60,46,30,0.55)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(px + wd + 1, 0); g.lineTo(px + 1.5, l); g.stroke(); // the curled edge's shadow
      }
    }
    for (const st of stains) { // a leak: brown runs down from the ceiling, tide-lined
      const x0 = st.x * S, w = st.w * S;
      blob(x0, 0, w, 0.2 * S, '128,94,50', 0.34);
      for (let k = 0; k < 4; k++) { // each run broad and soft, wandering a little, its edge a darker tide line
        const x = x0 + (r() - 0.5) * w * 0.8, l = st.len * (0.4 + r() * 0.6) * S, wd = (0.03 + r() * 0.05) * S, j = () => (r() - 0.5) * wd * 0.8;
        gr = g.createLinearGradient(0, 0, 0, l);
        gr.addColorStop(0, 'rgba(140,104,56,0.3)'); gr.addColorStop(0.7, 'rgba(140,104,56,0.12)'); gr.addColorStop(1, 'rgba(140,104,56,0)');
        g.beginPath(); g.moveTo(x - wd, 0);
        g.bezierCurveTo(x - wd + j(), l * 0.35, x - wd * 0.7 + j(), l * 0.7, x + j() * 0.3, l);
        g.bezierCurveTo(x + wd * 0.7 + j(), l * 0.7, x + wd + j(), l * 0.35, x + wd, 0);
        g.fillStyle = gr; g.fill();
        g.strokeStyle = 'rgba(112,80,42,0.3)'; g.lineWidth = 1.6; g.stroke();
      }
    }
    for (let i = 0; i < tears; i++) { // torn away: the plaster, a ragged rim of paper fibre
      const cx = (0.4 + r() * (len - 0.8)) * S, cy = yAt(1.15 + r() * 0.25), rad = (0.015 + r() * 0.025) * S, pts = [];
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, d = rad * (0.6 + r() * 0.6); pts.push([cx + Math.cos(a) * d * 1.4, cy + Math.sin(a) * d]); }
      g.beginPath(); pts.forEach(([px, py], k) => g[k ? 'lineTo' : 'moveTo'](px, py)); g.closePath();
      g.fillStyle = '#c9c0aa'; g.fill();
      g.strokeStyle = 'rgba(244,236,214,0.8)'; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = 'rgba(80,62,40,0.35)'; g.lineWidth = 3; g.stroke();
    }
    speckle(g, W, H, Math.round(len * 700), '#4e4030', 1, seed + 1); // fly specks
  });
}

/**
 * The corridor's wainscot (user, 2026-10-19, after a photo): narrow tongue-and-groove boards, a bead at each
 * joint, painted a grey green gone dull, scuffed low down by shoes and the hoover, scratched, chipped to the
 * wood at the joints here and there. 512 px over 0.9 m (ten boards). `bump`: the grooves.
 */
export function beadboardTex(bump = false) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = mulberry32(bump ? 7801 : 7800), r2 = mulberry32(7802), n = 10, bw = w / n;
    g.fillStyle = bump ? '#a0a0a0' : '#8d9484';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const x = i * bw;
      if (!bump) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,46,36'},${0.03 + r() * 0.05})`; g.fillRect(x, 0, bw, h); }
      g.fillStyle = bump ? '#202020' : 'rgba(40,44,36,0.7)'; // the groove
      g.fillRect(x, 0, 3, h);
      g.fillStyle = bump ? '#e0e0e0' : 'rgba(220,226,210,0.25)'; // the bead's round, catching light
      g.fillRect(x + 5, 0, 3, h);
    }
    // brush marks, up and down
    for (let i = 0; i < 400; i++) { g.fillStyle = bump ? 'rgba(255,255,255,0.05)' : `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.04})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 20 + r() * 120); }
    // scuffs low down, scratches, chips at the joints
    for (let i = 0; i < 70; i++) {
      const x = r2() * w, y = h * (0.62 + r2() * 0.38), rx = 6 + r2() * 30, ry = 2 + r2() * 6;
      g.fillStyle = bump ? 'rgba(60,60,60,0.3)' : `rgba(52,48,40,${0.12 + r2() * 0.18})`;
      g.beginPath(); g.ellipse(x, y, rx, ry, (r2() - 0.5) * 0.4, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 140; i++) {
      const x = r2() * w, y = r2() * h, a = (r2() - 0.5) * 1.2, len = 6 + r2() * 40;
      g.strokeStyle = bump ? 'rgba(0,0,0,0.5)' : `rgba(${r2() < 0.6 ? '196,200,186' : '60,54,44'},${0.2 + r2() * 0.3})`;
      g.lineWidth = 0.6 + r2();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    for (let i = 0; i < 26; i++) { // chips: the wood under the paint
      const x = Math.floor(r2() * n) * bw + (r2() < 0.5 ? 2 : bw - 6), y = r2() * h;
      g.fillStyle = bump ? '#303030' : '#8a6e50';
      flake(g, r2, x, y, 3 + r2() * 4, 5 + r2() * 14);
      g.fill();
    }
  }, { repeat: [1, 1], data: bump });
}

/**
 * Dirt on the corridor's carpet, laid over it (`len` × `wid` m): greyer along the walls where the hoover never
 * reaches, a trodden lane down the middle, darker at the doors, spots and stains, and under the attic's hatch at
 * the far end a pale dust fallen from above. Alpha: clean where clear.
 */
export function corridorDirtTex(len, wid, doors = []) {
  const W = 2048, H = Math.round((W * wid) / len);
  return canvasTex(W, H, (g, w, h) => {
    const r = mulberry32(9911), px = w / len;
    g.clearRect(0, 0, w, h);
    for (const [y0, y1, side] of [[0, 0.12, 'n'], [1, 0.88, 's']]) { // along both walls, not across their doorways (`doors`: [from, to, side], metres along)
      const gr = g.createLinearGradient(0, y0 * h, 0, y1 * h);
      gr.addColorStop(0, 'rgba(58,50,40,0.36)');
      gr.addColorStop(1, 'rgba(58,50,40,0)');
      g.fillStyle = gr;
      let at = 0;
      for (const [a, b] of doors.filter((d) => d[2] === side).sort((p, q) => p[0] - q[0])) { g.fillRect(at, Math.min(y0, y1) * h, a * px - at, Math.abs(y1 - y0) * h); at = b * px; }
      g.fillRect(at, Math.min(y0, y1) * h, w - at, Math.abs(y1 - y0) * h);
    }
    for (let i = 0; i < 220; i++) { // the lane, worn and greyed, in smudges along the middle
      const x = r() * w, y = h * (0.5 + (r() - 0.5) * 0.4), rx = (0.1 + r() * 0.3) * px, ry = (0.05 + r() * 0.12) * px, gr = g.createRadialGradient(x, y, 0, x, y, rx);
      gr.addColorStop(0, `rgba(70,62,52,${0.06 + r() * 0.08})`);
      gr.addColorStop(1, 'rgba(70,62,52,0)');
      g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
      g.fillStyle = gr; g.fillRect(x - rx, y - rx, rx * 2, rx * 2);
      g.restore();
    }
    for (let i = 0; i < 26; i++) { // stains
      const x = r() * w, y = r() * h, rad = (0.03 + r() * 0.09) * px, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${50 + r() * 30},${36 + r() * 20},${24 + r() * 12},${0.3 + r() * 0.3})`);
      gr.addColorStop(0.7, 'rgba(50,36,24,0.1)');
      gr.addColorStop(1, 'rgba(50,36,24,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    speckle(g, w, h, 5000, '#3a3026', 1.4, 9912); // grit
    // at the far end, under the hatch: plaster dust and bits fallen from the attic
    const fx = w - 1.0 * px, gr = g.createRadialGradient(fx, h / 2, 0, fx, h / 2, 0.6 * px);
    gr.addColorStop(0, 'rgba(200,192,176,0.35)');
    gr.addColorStop(1, 'rgba(200,192,176,0)');
    g.fillStyle = gr; g.fillRect(fx - 0.6 * px, 0, 1.2 * px, h);
    speckle(g, w, h, 0, '#000', 1, 1);
  });
}

/** Fine wire screen, as alpha (a door's insect screen): wires one way and the other, 8 to the tile, the holes clear. */
export function wireScreenTex() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    for (let k = 0; k < 8; k++) { g.fillRect(k * 8, 0, 2.2, h); g.fillRect(0, k * 8, w, 2.2); }
  }, { repeat: [1, 1], data: true });
}

/**
 * The screen as a whole (its colour, and where it is torn away): rusted iron wire, darker and redder low down
 * and round the edges where the wet gets in, dusty, two tears with the wires sprung loose round them. Alpha:
 * the tears are open.
 */
export function wireScreenWearTex() {
  return canvasTex(256, 320, (g, w, h) => {
    const r = mulberry32(6211);
    g.fillStyle = '#5a554c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { // rust, in blooms
      const x = r() * w, y = h * (0.35 + 0.65 * r() ** 0.7), rad = 10 + r() * 50, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${120 + r() * 30},${60 + r() * 20},${28 + r() * 12},${0.35 + r() * 0.35})`);
      gr.addColorStop(1, 'rgba(120,60,28,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const edge = 14; // rust where it is held in the frame
    g.fillStyle = 'rgba(110,56,26,0.45)';
    g.fillRect(0, 0, edge, h); g.fillRect(w - edge, 0, edge, h); g.fillRect(0, h - edge, w, edge);
    speckle(g, w, h, 1500, '#2a2620', 1.2, 6212);
    // dust (user, 2026-10-20: "a little dirty, dusty more than anything"): a pale grey film over the wires, thicker
    // low down and in the corners where it settles and nobody wipes, a few clots of fluff, fine grit
    let dg = g.createLinearGradient(0, 0, 0, h);
    dg.addColorStop(0, 'rgba(176,168,150,0.06)'); dg.addColorStop(0.6, 'rgba(176,168,150,0.12)'); dg.addColorStop(1, 'rgba(176,168,150,0.24)'); // (lightly: a third less than first tried, it read grey)
    g.fillStyle = dg; g.fillRect(0, 0, w, h);
    for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      dg = g.createRadialGradient(cx, cy, 0, cx, cy, 60);
      dg.addColorStop(0, 'rgba(184,176,158,0.3)'); dg.addColorStop(1, 'rgba(184,176,158,0)');
      g.fillStyle = dg; g.fillRect(cx - 60, cy - 60, 120, 120);
    }
    for (let i = 0; i < 12; i++) { // fluff caught in it
      const x = r() < 0.5 ? r() * 30 + (r() < 0.5 ? 0 : w - 30) : r() * w, y = h * (0.55 + r() * 0.45), rad = 3 + r() * 7;
      dg = g.createRadialGradient(x, y, 0, x, y, rad);
      dg.addColorStop(0, 'rgba(196,190,176,0.45)'); dg.addColorStop(1, 'rgba(196,190,176,0)');
      g.fillStyle = dg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    speckle(g, w, h, 600, '#b4ac98', 0.9, 6213);
    g.globalCompositeOperation = 'destination-out'; // the tears: ragged holes, a corner pushed in
    g.fillStyle = '#000';
    for (const [cx, cy, rx, ry] of [[w * 0.3, h * 0.72, 26, 16], [w * 0.78, h * 0.3, 12, 20]]) { flake(g, r, cx, cy, rx, ry); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(70,60,48,0.9)'; // and the wires sprung loose into them
    g.lineWidth = 1;
    for (const [cx, cy, rx, ry] of [[w * 0.3, h * 0.72, 26, 16], [w * 0.78, h * 0.3, 12, 20]]) {
      for (let k = 0; k < 14; k++) { const a = r() * Math.PI * 2, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * (4 + r() * 10), y - Math.sin(a) * (4 + r() * 10)); g.stroke(); }
    }
  });
}

/** One fence board, as the whole board: paint that was cream once, worn through to grey wood, dirt at its foot. */
export function fenceBoardTex(variants = 8) {
  // (user, 2026-10-17: every board the same pattern) `variants` boards side by side, each its own: how much
  // paint it has kept, its grain, a knot or two, a split, how green it has gone at the foot — the fence
  // picks one for each board (yard.js), and turns some round
  return canvasTex(128 * variants, 1024, (g, W, h) => {
    const w = 128;
    for (let k = 0; k < variants; k++) {
      const r = mulberry32(111 + k * 37);
      g.save();
      g.translate(k * w, 0);
      g.beginPath(); g.rect(0, 0, w, h); g.clip();
      // the paint, cream once, each board gone its own way
      const keep = 0.25 + r() * 0.7, warm = r();
      g.fillStyle = `rgb(${222 + warm * 12},${212 + warm * 8},${186 + warm * 6})`;
      g.fillRect(0, 0, w, h);
      // where it has gone the wood shows, silver-grey and grained: more of it on some boards than others
      for (let i = 0; i < 30 + (1 - keep) * 120; i++) {
        const x = r() * w, y = r() * h, pw = 4 + r() * 34, ph = 20 + r() * 180;
        g.fillStyle = `rgba(${128 + r() * 30},${120 + r() * 26},${102 + r() * 20},${0.35 + r() * 0.45})`;
        g.beginPath(); g.ellipse(x, y, pw / 2, ph / 2, 0, 0, Math.PI * 2); g.fill();
      }
      for (let i = 0; i < 30 + r() * 30; i++) { // the grain
        const x = r() * w;
        g.strokeStyle = `rgba(90,80,64,${0.06 + r() * 0.14})`;
        g.lineWidth = 0.6 + r() * 1.4;
        g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 10, h * 0.3, x + (r() - 0.5) * 10, h * 0.7, x + (r() - 0.5) * 8, h); g.stroke();
      }
      for (let i = 0; i < Math.floor(r() * 3); i++) { // knots, the grain bent round them
        const x = w * (0.2 + r() * 0.6), y = h * (0.1 + r() * 0.75), rr = 3 + r() * 6;
        g.fillStyle = 'rgba(70,52,36,0.7)'; g.beginPath(); g.ellipse(x, y, rr, rr * 1.6, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(80,66,50,0.35)'; g.lineWidth = 1;
        for (let k2 = 1; k2 < 4; k2++) { g.beginPath(); g.ellipse(x, y, rr + k2 * 3, (rr + k2 * 3) * 2.2, 0, 0, Math.PI * 2); g.stroke(); }
      }
      if (r() < 0.6) { // a split up from the foot, or down from the top
        const x = w * (0.25 + r() * 0.5), fromTop = r() < 0.4, len = h * (0.1 + r() * 0.35);
        g.strokeStyle = 'rgba(40,32,24,0.75)'; g.lineWidth = 1.2 + r();
        g.beginPath(); g.moveTo(x, fromTop ? 0 : h); g.lineTo(x + (r() - 0.5) * 6, fromTop ? len : h - len); g.stroke();
      }
      const foot = g.createLinearGradient(0, h * (0.7 + r() * 0.15), 0, h);
      foot.addColorStop(0, 'rgba(70,74,40,0)');
      foot.addColorStop(1, `rgba(62,60,34,${0.5 + r() * 0.4})`); // damp and green at the bottom
      g.fillStyle = foot;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(50,40,30,0.7)'; // nail heads at the rails, a rust run under some
      for (const y of [h * 0.2, h * 0.78]) for (const x of [w * (0.28 + r() * 0.05), w * (0.7 + r() * 0.05)]) {
        g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
        if (r() < 0.4) { g.fillStyle = 'rgba(120,60,30,0.3)'; g.fillRect(x - 1, y, 2, 20 + r() * 40); g.fillStyle = 'rgba(50,40,30,0.7)'; }
      }
      g.restore();
    }
  });
}

/** Boards left out in the weather for decades: grey-brown, split, the grain standing up. */
export function weatheredTex(seed = 121) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6f6556';
    g.fillRect(0, 0, w, h);
    const r = mulberry32(seed);
    const boards = 4, bw = w / boards;
    for (let b = 0; b < boards; b++) {
      g.fillStyle = `rgba(${90 + r() * 30},${80 + r() * 26},${64 + r() * 20},0.6)`;
      g.fillRect(b * bw, 0, bw, h);
      for (let k = 0; k < 26; k++) {
        const x = b * bw + r() * bw;
        g.strokeStyle = r() > 0.4 ? 'rgba(40,34,26,0.35)' : 'rgba(190,180,160,0.18)';
        g.lineWidth = 0.6 + r() * 1.8;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 10, h * 0.33, x + (r() - 0.5) * 10, h * 0.66, x + (r() - 0.5) * 8, h);
        g.stroke();
      }
      g.fillStyle = 'rgba(25,20,15,0.8)';
      g.fillRect(b * bw, 0, 3, h);
    }
    speckle(g, w, h, 3000, '#2a241c', 1.4, seed + 1);
    for (let i = 0; i < 6; i++) {
      const x = r() * w, y = r() * h, rad = 30 + r() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(60,70,40,0.3)'); // lichen
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }, { repeat: [1, 1] });
}

export function sandTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c8b38a';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 6000, '#8d7a56', 1.1, 131);
    speckle(g, w, h, 4000, '#efe2c2', 1.0, 132);
  }, { repeat: [1, 1] });
}

/**
 * The sandbox's sand, close to (one tile a metre square; user, 2026-10-18: "make the sand better"): old play
 * sand gone a dull grey-beige, every grain its own — pale quartz, dark grains, a few rusty ones — a pebble here
 * and there, a bit of twig, faint patches where it is damper. `bump`: the same as heights (the grains, the
 * pebbles, proud).
 */
export function sandboxSandTex(bump = false) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = mulberry32(1311);
    g.fillStyle = bump ? '#808080' : '#ab9a7b';
    g.fillRect(0, 0, w, h);
    const tile = (x, y, reach, fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { if (x + dx < -reach || x + dx > w + reach || y + dy < -reach || y + dy > h + reach) continue; g.save(); g.translate(x + dx, y + dy); fn(); g.restore(); } };
    if (!bump) for (let i = 0; i < 26; i++) { // damper and drier, in soft patches
      const x = r() * w, y = r() * h, s = 30 + r() * 90, dark = r() < 0.5;
      tile(x, y, s, () => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, s); gr.addColorStop(0, dark ? 'rgba(92,80,60,0.16)' : 'rgba(214,202,176,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-s, -s, s * 2, s * 2); });
    }
    const grain = (n, cols, size, heights) => {
      for (let i = 0; i < n; i++) {
        const x = r() * w, y = r() * h, k = Math.floor(r() * cols.length), s = size[0] + r() * size[1];
        g.fillStyle = bump ? heights[k] : cols[k];
        g.globalAlpha = 0.55 + r() * 0.45;
        g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    };
    grain(26000, ['#c9b994', '#98876a', '#d9ccb0', '#7d6e55', '#b5a27e'], [0.5, 1.0], ['#9a9a9a', '#6a6a6a', '#a8a8a8', '#5a5a5a', '#8a8a8a']); // the grains
    grain(5000, ['#efe6d0', '#e4dcc8'], [0.4, 0.7], ['#b0b0b0', '#a8a8a8']); // quartz, catching the light
    grain(3500, ['#4e443a', '#3a332c', '#8a5e42'], [0.4, 0.8], ['#505050', '#484848', '#606060']); // dark grains, rusty ones
    for (let i = 0; i < 34; i++) { // pebbles
      const x = r() * w, y = r() * h, s = 1.8 + r() * 3.5, v = r();
      tile(x, y, 8, () => {
        g.fillStyle = bump ? '#d0d0d0' : `rgb(${Math.round(110 + v * 60)},${Math.round(104 + v * 54)},${Math.round(96 + v * 50)})`;
        g.beginPath(); g.ellipse(0, 0, s, s * (0.55 + r() * 0.4), r() * 3, 0, Math.PI * 2); g.fill();
        if (!bump) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-s * 0.25, -s * 0.25, s * 0.4, s * 0.25, 0.5, 0, Math.PI * 2); g.fill(); }
      });
    }
    for (let i = 0; i < 6; i++) { // bits of twig and leaf
      const x = r() * w, y = r() * h, len = 8 + r() * 22, a = r() * 3.14;
      tile(x, y, 30, () => { g.strokeStyle = bump ? '#b8b8b8' : `rgba(${70 + r() * 30},${54 + r() * 20},${36 + r() * 14},0.85)`; g.lineWidth = 1 + r() * 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke(); });
    }
  }, { repeat: [1, 1], data: bump });
}

/**
 * Sand kicked out over the grass round the sandbox (a sheet `w` × `d` metres with the box, `bw` × `bd`, in
 * its middle): thick against the boards, thinning out in drifts and grains, most on the side the children
 * climb in and out (the south, then the east). Clear where there is none.
 */
export function sandSpillTex(w, d, bw, bd) {
  return canvasTex(512, Math.round((512 * d) / w), (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const r = mulberry32(1313), sx = W / w, sy = H / d, x0 = ((w - bw) / 2) * sx, y0 = ((d - bd) / 2) * sy, x1 = W - x0, y1 = H - y0;
    const reach = (px, py) => { // how far out from the box, in metres, and which side
      const dx = Math.max(x0 - px, 0, px - x1) / sx, dy = Math.max(y0 - py, 0, py - y1) / sy;
      const side = py > y1 ? 1.0 : px > x1 ? 0.8 : px < x0 ? 0.45 : 0.35; // (v down the canvas: south, the house's side)
      return [Math.hypot(dx, dy), side];
    };
    for (let i = 0; i < 26000; i++) {
      const px = r() * W, py = r() * H, [m, side] = reach(px, py);
      if (r() > Math.exp(-m / (0.12 * side + 0.02)) * side * 1.4) continue;
      const v = r();
      g.fillStyle = `rgba(${Math.round(176 + v * 34)},${Math.round(160 + v * 30)},${Math.round(126 + v * 28)},${0.35 + r() * 0.5})`;
      g.beginPath(); g.ellipse(px, py, 0.8 + r() * 2.4, 0.8 + r() * 1.8, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.clearRect(x0, y0, x1 - x0, y1 - y0); // (not under the box itself: a pit is dug there)
  });
}

/**
 * The slide's chute, stainless steel sheet (user, 2026-10-18: "it's metal"): u across it from one lip to the
 * other, v down it (a tile 1.4 m). Brushed along its length; down the middle of the bed a band rubbed bright
 * by years of trousers, dulled at its edges; water marks up the sides; scuffs and scratches across; a brown
 * stain run down from each bolt. `rough`: its roughness, as data (the bright band smoothest).
 */
export function metalSlideTex(rough = false) {
  return canvasTex(256, 512, (g, w, h) => {
    const r = mulberry32(1411);
    const band = (u) => Math.exp(-(((u - 0.5) / 0.17) ** 2)); // the rubbed band down the middle
    for (let x = 0; x < w; x++) { // across it, column by column: dull sides, the bright band
      const b = band(x / w);
      const v = rough ? Math.round(255 * (0.5 - 0.28 * b)) : Math.round(150 + 34 * b);
      g.fillStyle = rough ? `rgb(${v},${v},${v})` : `rgb(${v},${v + 3},${v + 5})`;
      g.fillRect(x, 0, 1, h);
    }
    for (let i = 0; i < 900; i++) { // brushed: fine streaks along it
      const x = r() * w, len = 30 + r() * 300, y = r() * h, v = r() < 0.5;
      g.fillStyle = rough ? (v ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : v ? 'rgba(255,255,255,0.06)' : 'rgba(40,44,48,0.06)';
      for (const dy of [-h, 0]) g.fillRect(x, y + dy, 0.6 + r() * 0.8, len);
    }
    for (let i = 0; i < 70; i++) { // scuffs and scratches, mostly across the band
      const x = w * (0.25 + r() * 0.5), y = r() * h, len = 6 + r() * 40, a = (r() - 0.5) * 0.8;
      g.strokeStyle = rough ? 'rgba(255,255,255,0.15)' : `rgba(${r() < 0.5 ? '220,224,226' : '90,94,98'},${0.12 + r() * 0.2})`;
      g.lineWidth = 0.6 + r();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.3); g.stroke();
    }
    for (let i = 0; i < 40; i++) { // water marks, dried, up the sides
      const x = r() < 0.5 ? r() * w * 0.25 : w * (0.75 + r() * 0.25), y = r() * h, s = 3 + r() * 12;
      g.strokeStyle = rough ? 'rgba(255,255,255,0.2)' : 'rgba(205,200,186,0.3)';
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.stroke();
      if (!rough) { g.fillStyle = 'rgba(120,118,108,0.08)'; g.fill(); }
    }
    for (const u of [0.04, 0.96]) for (let k = 0; k < 3; k++) { // rust run down from the bolts along the lips
      const x = u * w, y0 = (k / 3 + r() * 0.1) * h, len = 40 + r() * 90, gr = g.createLinearGradient(0, y0, 0, y0 + len);
      gr.addColorStop(0, rough ? 'rgba(255,255,255,0.4)' : 'rgba(120,70,36,0.5)');
      gr.addColorStop(1, 'rgba(120,70,36,0)');
      g.fillStyle = gr;
      g.fillRect(x - 3 - r() * 3, y0, 4 + r() * 5, len);
    }
    // (user, 2026-10-18: "worn, rusty in places") dull worn patches where the shine has gone; rust come through
    // in places — up the walls and along the lips, where the water stands in the corners of the bed, round a
    // scratch — lumpy, darker in the middle, pitted, a stain run from each
    const q = mulberry32(1416); // (its own draws, the same for the colour and the roughness, so the rust is where the roughness says)
    for (let i = 0; i < 22; i++) {
      const x = q() * w, y = q() * h, s = 10 + q() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, s);
      gr.addColorStop(0, rough ? 'rgba(255,255,255,0.25)' : 'rgba(120,118,112,0.28)');
      gr.addColorStop(1, 'rgba(120,118,112,0)');
      g.fillStyle = gr;
      for (const dy of [-h, 0, h]) g.fillRect(x - s, y - s + dy, s * 2, s * 2);
    }
    const rustAt = (x, y, s) => {
      for (const dy of [-h, 0, h]) for (let k = 0; k < 26; k++) { // (lumped together into a patch, the middle thickest: scattered, they read as spots)
        const c = q(), a = rough ? 0.5 + q() * 0.4 : 0.22 + q() * 0.3, rr = Math.sqrt(q()) * 0.5;
        g.fillStyle = rough ? `rgba(255,255,255,${a})` : c < 0.4 ? `rgba(132,80,44,${a})` : c < 0.75 ? `rgba(104,62,34,${a})` : `rgba(72,44,26,${a})`;
        const ang = q() * 6.3;
        g.beginPath(); g.ellipse(x + Math.cos(ang) * rr * s, y + dy + Math.sin(ang) * rr * s * 1.6, 1.5 + q() * s * 0.3 * (1 - rr), 1.5 + q() * s * 0.45 * (1 - rr), q() * 3, 0, Math.PI * 2); g.fill();
      }
      const len = 20 + q() * 80; // its stain, run down the slide
      if (!rough) {
        const gr = g.createLinearGradient(0, y, 0, y + len);
        gr.addColorStop(0, 'rgba(120,66,32,0.35)');
        gr.addColorStop(1, 'rgba(120,66,32,0)');
        g.fillStyle = gr;
        for (const dy of [-h, 0]) g.fillRect(x - s * 0.3, y + dy, s * 0.6, len);
      }
    };
    for (let i = 0; i < 7; i++) rustAt(q() < 0.5 ? q() * w * 0.14 : w * (0.86 + q() * 0.14), q() * h, 14 + q() * 26); // up the walls, along the lips
    for (let i = 0; i < 4; i++) rustAt(w * (q() < 0.5 ? 0.17 + q() * 0.05 : 0.78 + q() * 0.05), q() * h, 10 + q() * 16); // in the corners of the bed, where the water stands
    for (let i = 0; i < 2; i++) rustAt(w * (0.35 + q() * 0.3), q() * h, 4 + q() * 5); // and once or twice in the bed, round a deep scratch
    if (!rough) speckle(g, w, h, 300, '#6a3a1c', 0.8, 1415); // pitting
  }, { repeat: [1, 1], data: rough });
}

/**
 * A coir doormat seen from above (the back door's; user, 2026-10-18: "brown coconut fibre, like the classic
 * ones, no writing"), `w` × `d` metres: stiff fibres in close tufted rows, golden brown to dark, the odd
 * straw-pale one; trodden darker and flatter in the middle where feet are wiped, grit and a bit of leaf in
 * it, its edges frayed and greyed. `bump`: the same as heights.
 */
/**
 * How worn the old coir doormat is at (u, v), 0..1 across it and down its picture: the trodden middle, and in it two
 * ovals, a little apart, where the feet stand and wipe (yard.js wears the mat thinner by it too).
 */
export function coirWear(u, v) {
  let k = 0.45 * Math.exp(-(((u - 0.5) / 0.34) ** 2 + ((v - 0.5) / 0.4) ** 2));
  for (const [fu, fv] of [[0.37, 0.53], [0.62, 0.46]]) k += 0.75 * Math.exp(-(((u - fu) / 0.09) ** 2 + ((v - fv) / 0.2) ** 2));
  return Math.min(1, k);
}

/**
 * The back door's doormat, coir, years old (user, 2026-10-23: "worn and old, a bit dusty"): the bristles faded in the
 * sun to a lighter, duller brown; where the feet go (coirWear) trodden short and flat and in two places gone, down to
 * the rubber backing; the edge ragged, tufts out all along it; grit and dried mud in the middle, and dust over all of
 * it, thickest where no foot comes — its edges and corners. `bump`: its relief (the bristles up, the bald backing low).
 */
export function coirMatTex(w, d, bump = false) {
  return canvasTex(512, Math.round((512 * d) / w), (g, W, H) => {
    const r = mulberry32(1611);
    g.fillStyle = bump ? '#262626' : '#433830'; // (the backing, where the fibre is gone)
    g.fillRect(0, 0, W, H);
    const border = 16; // (px: the ragged band round its edge)
    for (let row = 3; row < H - 2; row += 4.2) for (let col = 3 + (Math.round(row / 4.2) % 2) * 2.1; col < W - 2; col += 4.2) { // the tufts, row on row
      const worn = coirWear(col / W, row / H), fray = Math.max(0, 1 - Math.min(col, row, W - col, H - row) / border);
      if (r() < worn * 0.62 - 0.12 || r() < fray * fray * 0.65 || r() < 0.02) continue; // (gone: bald where worn most, ragged at the edge, one here and there)
      for (let k = 0; k < 5; k++) {
        const v = r(), a = r() * Math.PI * 2, len = (1.5 + r() * 3.5) * (1 - worn * 0.55) * (1 - fray * 0.35);
        const c = v < 0.08 ? [204, 180, 140] : v < 0.55 ? [170, 140, 104] : v < 0.85 ? [146, 118, 88] : [112, 92, 70];
        const k2 = 1 - worn * 0.16;
        g.strokeStyle = bump ? `rgba(255,255,255,${(0.32 + r() * 0.4) * (1 - worn * 0.6)})` : `rgb(${Math.round(c[0] * k2)},${Math.round(c[1] * k2)},${Math.round(c[2] * k2)})`;
        g.lineWidth = 0.8 + r() * 0.9;
        const x = col + (r() - 0.5) * 2.4, y = row + (r() - 0.5) * 2.4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
      }
    }
    if (bump) return;
    for (let i = 0; i < 26; i++) { // grit and dried mud trodden in, where the feet are
      const [fu, fv] = r() < 0.5 ? [0.37, 0.53] : [0.62, 0.46], x = (fu + (r() - 0.5) * 0.3) * W, y = (fv + (r() - 0.5) * 0.6) * H, s = 4 + r() * 14;
      const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, `rgba(84,70,56,${0.22 + r() * 0.25})`); gr.addColorStop(1, 'rgba(84,70,56,0)');
      g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2);
    }
    speckle(g, W, H, 1100, '#9a917f', 1.0, 1612); // sand, grit
    // the dust: a grey film, uneven, heavier the further from where feet go and the nearer the edge
    const im = g.getImageData(0, 0, W, H), px = im.data, n = mulberry32(1613), G = 24, cells = Array.from({ length: (G + 1) * (G + 1) }, () => n());
    const noise = (u, v) => { const x = u * G, y = v * G, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, at = (a, b) => cells[Math.min(b, G) * (G + 1) + Math.min(a, G)]; return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H, edge = Math.min(u * W, v * H, (1 - u) * W, (1 - v) * H);
      const a = Math.min(0.42, (0.06 + 0.13 * (1 - coirWear(u, v)) + 0.16 * Math.max(0, 1 - edge / 40)) * (0.55 + 0.9 * noise(u, v)));
      const k = (y * W + x) * 4;
      px[k] += (158 - px[k]) * a; px[k + 1] += (151 - px[k + 1]) * a; px[k + 2] += (138 - px[k + 2]) * a;
    }
    g.putImageData(im, 0, 0);
    // bits of dry leaf blown in, caught at its edges
    for (const [x, y, a, s] of [[W * 0.86, H * 0.12, 0.7, 1], [W * 0.06, H * 0.8, 2.1, 0.8], [W * 0.5, H * 0.93, 0.2, 0.6]]) {
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(118,88,52,0.85)'; g.beginPath(); g.ellipse(0, 0, 9 * s, 4 * s, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(80,58,34,0.8)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-9 * s, 0); g.lineTo(9 * s, 0); g.stroke(); g.restore();
    }
  }, { data: bump });
}

/**
 * Old timber left out for years (user, 2026-10-18: "make the slide's tower worn"): gone silver-grey over the
 * brown, the grain standing up in ridges where the soft wood between has worn away, checks split along it,
 * a knot or two, dark where the wet stays, specks of mould and pale lichen. The grain runs down the picture
 * (v), 0.5 m across by 1 m down. `bump`: its relief (the ridges up, the splits deep).
 */
export function oldTimberTex(bump = false, scratched = false, weathered = false) {
  return canvasTex(512, 1024, (g, W, H) => {
    const r = mulberry32(2207);
    g.fillStyle = bump ? '#808080' : '#7a7062';
    g.fillRect(0, 0, W, H);
    // its tone in long streaks, browner here, greyer there
    for (let x = 0; x < W; x += 4 + r() * 18) {
      const w = 6 + r() * 40, k = r();
      g.fillStyle = bump ? `rgba(128,128,128,0)` : k < 0.5 ? `rgba(140,132,116,${0.1 + r() * 0.2})` : `rgba(88,70,50,${0.08 + r() * 0.18})`;
      g.fillRect(x, 0, w, H);
    }
    // the grain: ridges and the worn grooves between, wandering a little; bent round the knots
    const knots = Array.from({ length: 4 }, () => [r() * W, r() * H, 5 + r() * 9]);
    const bent = (x, y) => { let dx = 0; for (const [kx, ky, kr] of knots) { const d = Math.hypot((x - kx) / 2.2, (y - ky) / 6); if (d < kr * 5) dx += Math.sign(x - kx || 1) * kr * 1.6 * Math.exp(-d / (kr * 1.4)); } return dx; };
    for (let i = 0; i < 300; i++) {
      const x0 = r() * W, amp = 1 + r() * 4, ph = r() * 6.3, ridge = r() < 0.55;
      g.strokeStyle = bump ? (ridge ? `rgba(230,230,230,${0.25 + r() * 0.35})` : `rgba(30,30,30,${0.2 + r() * 0.3})`) : ridge ? `rgba(176,168,150,${0.1 + r() * 0.22})` : `rgba(46,40,32,${0.12 + r() * 0.3})`;
      g.lineWidth = 0.6 + r() * (ridge ? 2.2 : 1.4);
      g.beginPath();
      for (let y = -8; y <= H + 8; y += 16) {
        const x = x0 + Math.sin(y * 0.006 + ph) * amp + Math.sin(y * 0.023 + ph * 1.7) * amp * 0.35 + bent(x0, y);
        if (y < 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    // the knots: dark, hard, standing a little proud, rings round them
    for (const [kx, ky, kr] of knots) {
      for (let k = 5; k > 0; k--) {
        g.strokeStyle = bump ? 'rgba(200,200,200,0.35)' : `rgba(52,40,28,${0.12 + 0.05 * (5 - k)})`;
        g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(kx, ky, kr * (0.6 + k * 0.32), kr * (1.4 + k * 0.9), 0, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = bump ? 'rgba(210,210,210,0.8)' : 'rgba(40,30,20,0.85)';
      g.beginPath(); g.ellipse(kx, ky, kr * 0.55, kr * 1.1, 0, 0, Math.PI * 2); g.fill();
      if (!bump) { g.strokeStyle = 'rgba(16,12,8,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(kx, ky - kr * 1.1); g.lineTo(kx + (r() - 0.5) * 2, ky - kr * 1.1 - 10 - r() * 30); g.stroke(); } // the split out of it
    }
    // the checks: long splits along the grain, wide in the middle, closing to nothing at their ends
    for (let i = 0; i < 46; i++) {
      const x0 = r() * W, y0 = r() * H, len = 40 + r() * (r() < 0.2 ? 420 : 160), wd = 0.8 + r() * 2.4;
      g.fillStyle = bump ? 'rgba(0,0,0,0.9)' : `rgba(18,14,10,${0.6 + r() * 0.3})`;
      g.beginPath();
      const steps = 12, wob = (r() - 0.5) * 3;
      for (let k = 0; k <= steps; k++) { const t = k / steps; g.lineTo(x0 + Math.sin(t * Math.PI) * wd / 2 + wob * t, y0 + t * len); }
      for (let k = steps; k >= 0; k--) { const t = k / steps; g.lineTo(x0 - Math.sin(t * Math.PI) * wd / 2 + wob * t, y0 + t * len); }
      g.fill();
    }
    if (weathered) { // years out in it (the porch's boards round its foot — user, 2026-10-28: "too perfect, they look new"): washed out to
      // a duller, lighter brown; mildew in blooms and specks; more checks, opened wider; the soft wood between the grain worn
      // back so the grain stands up (the same dice for the picture and its relief)
      const q = mulberry32(2311);
      if (!bump) { g.fillStyle = 'rgba(152,140,122,0.24)'; g.fillRect(0, 0, W, H); }
      for (let i = 0; i < 260; i++) { // the grain raised
        const x0 = q() * W, a = q(), lw = 0.8 + q() * 1.6, ph = q() * 6.3;
        g.strokeStyle = bump ? `rgba(235,235,235,${0.25 + a * 0.35})` : `rgba(${168 + a * 20},${158 + a * 18},${138 + a * 14},${0.06 + a * 0.12})`;
        g.lineWidth = lw;
        g.beginPath();
        for (let y = -8; y <= H + 8; y += 24) { const x = x0 + Math.sin(y * 0.005 + ph) * 3; if (y < 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
      for (let i = 0; i < 110; i++) { // mildew: soft dark blooms, longer along the grain, and specks in them
        const x = q() * W, y = q() * H, rr = 6 + q() * 38, a = 0.05 + q() * 0.13, n = Math.floor(q() * 16);
        if (!bump) {
          const gr = g.createRadialGradient(x, y, 0, x, y, rr);
          gr.addColorStop(0, `rgba(34,30,24,${a})`); gr.addColorStop(1, 'rgba(34,30,24,0)');
          g.save(); g.translate(x, y); g.scale(1, 2.2); g.translate(-x, -y); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); g.restore();
        }
        for (let k = 0; k < n; k++) {
          const sx = x + (q() - 0.5) * rr, sy = y + (q() - 0.5) * rr * 3, sz = 1 + q() * 1.6, sa = 0.3 + q() * 0.4;
          g.fillStyle = bump ? `rgba(70,70,70,${sa})` : `rgba(18,16,12,${sa})`;
          g.fillRect(sx, sy, sz, sz);
        }
      }
      for (let i = 0; i < 70; i++) { // more checks, opened wide by the sun and the wet
        const x0 = q() * W, y0 = q() * H, len = 30 + q() * (q() < 0.25 ? 380 : 140), wd = 1.2 + q() * 3.2, wob = (q() - 0.5) * 4, a = 0.55 + q() * 0.35;
        g.fillStyle = bump ? 'rgba(0,0,0,0.9)' : `rgba(16,12,9,${a})`;
        g.beginPath();
        for (let k = 0; k <= 12; k++) { const t = k / 12; g.lineTo(x0 + Math.sin(t * Math.PI) * wd / 2 + wob * t, y0 + t * len); }
        for (let k = 12; k >= 0; k--) { const t = k / 12; g.lineTo(x0 - Math.sin(t * Math.PI) * wd / 2 + wob * t, y0 + t * len); }
        g.fill();
      }
    }
    if (scratched) { // knocked about for years: pale scratches every way, gouges with dark edges, the edges of the grain rubbed
      const q = mulberry32(2290);
      for (let i = 0; i < 260; i++) {
        const x = q() * W, y = q() * H, a = (q() < 0.5 ? Math.PI / 2 : 0) + (q() - 0.5) * 1.6, len = 8 + q() * 70;
        g.strokeStyle = bump ? `rgba(0,0,0,${0.3 + q() * 0.4})` : `rgba(${200 + q() * 30},${190 + q() * 25},${170 + q() * 20},${0.25 + q() * 0.35})`;
        g.lineWidth = 0.6 + q() * 1.3;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (q() - 0.5) * 6, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
      }
      for (let i = 0; i < 40; i++) { // gouges and dents
        const x = q() * W, y = q() * H, rx = 3 + q() * 10, ry = 1 + q() * 3;
        g.fillStyle = bump ? 'rgba(0,0,0,0.8)' : 'rgba(52,40,28,0.7)';
        g.beginPath(); g.ellipse(x, y, rx, ry, q() * 3, 0, Math.PI * 2); g.fill();
        if (!bump) { g.fillStyle = 'rgba(214,200,176,0.45)'; g.beginPath(); g.ellipse(x + 1, y - 1, rx * 0.8, ry * 0.5, q() * 3, 0, Math.PI * 2); g.fill(); }
      }
    }
    if (bump) return;
    // where the wet stays: darker, browner, soft-edged
    for (let i = 0; i < 9; i++) {
      const x = r() * W, y = r() * H, rx = 20 + r() * 70, ry = 60 + r() * 200;
      const gr = g.createRadialGradient(x, y, 0, x, y, ry);
      gr.addColorStop(0, `rgba(44,36,26,${0.15 + r() * 0.2})`);
      gr.addColorStop(1, 'rgba(44,36,26,0)');
      g.save(); g.translate(x, y); g.scale(rx / ry, 1); g.translate(-x, -y);
      g.fillStyle = gr; g.fillRect(x - ry, y - ry, ry * 2, ry * 2);
      g.restore();
    }
    speckle(g, W, H, 2600, '#1f1d17', 1.2, 2208); // mould
    for (let i = 0; i < 40; i++) { // lichen, pale grey-green, in small crusts
      const x = r() * W, y = r() * H, s = 1.5 + r() * 4;
      g.fillStyle = `rgba(${150 + r() * 30},${160 + r() * 25},${130 + r() * 20},${0.35 + r() * 0.35})`;
      g.beginPath(); g.ellipse(x, y, s, s * (0.7 + r() * 0.6), r() * 3, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: [1, 1], data: bump });
}

/**
 * A wooden chopping board (user, 2026-10-18), light beech gone grey at the edges with washing, its middle
 * scored all over by the knife, a dark stain where something was cut and left. The grain along its length (x).
 */
export function choppingBoardTex(w, d) {
  return canvasTex(512, Math.round((512 * d) / w), (g, W, H) => {
    const r = mulberry32(1777);
    g.fillStyle = '#c4a073';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) { // the grain
      const y0 = r() * H, amp = 1 + r() * 4, ph = r() * 6.3;
      g.strokeStyle = r() < 0.7 ? `rgba(120,84,48,${0.06 + r() * 0.16})` : `rgba(236,214,176,${0.08 + r() * 0.12})`;
      g.lineWidth = 0.6 + r() * 2;
      g.beginPath();
      for (let x = 0; x <= W; x += 16) { const y = y0 + Math.sin(x * 0.01 + ph) * amp; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 520; i++) { // the knife's scores, crossing every way, most in the middle
      const x = W / 2 + (r() + r() + r() - 1.5) * W * 0.42, y = H / 2 + (r() + r() + r() - 1.5) * H * 0.42, a = (r() < 0.6 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.9, len = 6 + r() * 30;
      g.strokeStyle = r() < 0.5 ? `rgba(90,62,36,${0.12 + r() * 0.2})` : `rgba(240,224,196,${0.15 + r() * 0.2})`;
      g.lineWidth = 0.5 + r() * 0.7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    const gr = g.createRadialGradient(W * 0.62, H * 0.42, 0, W * 0.62, H * 0.42, H * 0.3); // the stain
    gr.addColorStop(0, 'rgba(92,54,40,0.32)');
    gr.addColorStop(0.7, 'rgba(92,54,40,0.12)');
    gr.addColorStop(1, 'rgba(92,54,40,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, 0, 22, 0, 0, W, 22], [0, H, 0, H - 22, 0, H - 22, W, 22], [0, 0, 22, 0, 0, 0, 22, H], [W, 0, W - 22, 0, W - 22, 0, 22, H]]) { // the edges grey from the sink
      const e = g.createLinearGradient(x0, y0, x1, y1);
      e.addColorStop(0, 'rgba(120,112,98,0.45)');
      e.addColorStop(1, 'rgba(120,112,98,0)');
      g.fillStyle = e;
      g.fillRect(rx, ry, rw, rh);
    }
  });
}

/**
 * A carrot's skin (Mum's, mother.js), round it (u, wrapping) and down it from the crown (v: 0) to the tip (1): orange,
 * duller and browner up by the crown, paler to the tip, ringed all down with the fine pale ridges and darker creases
 * a carrot has, a few dark root scars, a little soil left in them, faint streaks along it.
 */
export function carrotSkinTex() {
  return canvasTex(256, 512, (g, W, H) => {
    const r = mulberry32(7121);
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#8c4a1c');
    base.addColorStop(0.035, '#b8601e');
    base.addColorStop(0.12, '#d8701f');
    base.addColorStop(0.7, '#e07a22');
    base.addColorStop(1, '#e89a4a');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    const wrap = (draw) => { for (const dx of [-W, 0, W]) draw(dx); }; // (round the carrot: no seam)
    for (let i = 0; i < 140; i++) { // streaks along it
      const x = r() * W, w = 1 + r() * 5, light = r() < 0.5;
      g.fillStyle = light ? `rgba(246,170,92,${0.05 + r() * 0.08})` : `rgba(150,66,18,${0.04 + r() * 0.07})`;
      wrap((dx) => g.fillRect(x + dx, 0, w, H));
    }
    for (let i = 0; i < 120; i++) { // the rings: a fine crease, the pale ridge under it, a short way round (all of them all round, and close, it read as a stack of discs)
      const y = Math.pow(r(), 0.85) * H, x = r() * W, len = W * (0.1 + r() * (r() < 0.12 ? 0.8 : 0.35)), bow = (r() - 0.5) * 3;
      const line = (dy, style, lw) => { g.strokeStyle = style; g.lineWidth = lw; wrap((dx) => { g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + len / 2, y + dy + bow, x + dx + len, y + dy); g.stroke(); }); };
      line(0, `rgba(130,58,16,${0.08 + r() * 0.17})`, 0.6 + r() * 0.8);
      line(1.4, `rgba(250,190,120,${0.05 + r() * 0.12})`, 0.6 + r() * 0.6);
    }
    for (let i = 0; i < 26; i++) { // root scars, a little soil in some
      const x = r() * W, y = (0.08 + r() * 0.85) * H, w = 2 + r() * 5;
      g.fillStyle = `rgba(92,48,20,${0.35 + r() * 0.35})`;
      wrap((dx) => { g.beginPath(); g.ellipse(x + dx, y, w, 0.8 + r() * 1.2, 0, 0, Math.PI * 2); g.fill(); });
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(70,52,36,${0.2 + r() * 0.3})`;
      const x = r() * W, y = r() * H;
      wrap((dx) => g.fillRect(x + dx, y, 0.6 + r() * 1.4, 0.6 + r()));
    }
  });
}

/**
 * The face of a carrot cut across (fills a disc: centre in the middle, the skin at the edge): the thin dark skin, the
 * deep orange flesh, a paler ring and the paler, yellower core inside it with faint rays out from the middle; wet.
 */
export function carrotCutTex() {
  return canvasTex(256, 256, (g, W, H) => {
    const r = mulberry32(7122), c = W / 2;
    const rad = g.createRadialGradient(c, c, 0, c, c, c);
    rad.addColorStop(0, '#eda04a');
    rad.addColorStop(0.5, '#f0a347');
    rad.addColorStop(0.56, '#f7bd62');
    rad.addColorStop(0.62, '#ec7f22');
    rad.addColorStop(0.9, '#e2701c');
    rad.addColorStop(0.95, '#c2581a');
    rad.addColorStop(1, '#a24a16');
    g.fillStyle = rad;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { // rays out from the middle, through the core
      const a = r() * Math.PI * 2, l = c * (0.3 + r() * 0.28);
      g.strokeStyle = `rgba(252,206,130,${0.08 + r() * 0.14})`;
      g.lineWidth = 0.6 + r() * 1.2;
      g.beginPath(); g.moveTo(c + Math.cos(a) * 6, c + Math.sin(a) * 6); g.lineTo(c + Math.cos(a) * l, c + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 500; i++) { // its grain
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * c * 0.94;
      g.fillStyle = r() < 0.5 ? `rgba(255,210,150,${0.06 + r() * 0.1})` : `rgba(190,80,20,${0.05 + r() * 0.08})`;
      g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, 1 + r() * 2, 1 + r() * 2);
    }
  });
}

/**
 * Mum's iris, seen straight on, its edge the canvas's (mother.js turns it with her eye): olive, a little green (the
 * one painted on her was lighter, too light; then too dark — user, 2026-10-28), a darker ring round the pupil, a dark rim, the pupil
 * wide — the kitchen is dim — and its fibres out from it, a crypt or two, nothing even.
 */
export function irisTex() {
  return canvasTex(256, 256, (g, W) => {
    const r = mulberry32(5310), c = W / 2, P = 0.48 * c; // (the pupil: 3 mm of 6.3)
    g.fillStyle = '#4a4634';
    g.fillRect(0, 0, W, W);
    const rad = g.createRadialGradient(c, c, P, c, c, c);
    rad.addColorStop(0, '#565039');
    rad.addColorStop(0.14, '#76714f');
    rad.addColorStop(0.45, '#8a865f');
    rad.addColorStop(0.78, '#817c59');
    rad.addColorStop(0.92, '#645f46');
    rad.addColorStop(1, '#45412f');
    g.fillStyle = rad;
    g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 260; i++) { // the fibres, light and dark, from the pupil's ring out, wavering
      const a = r() * Math.PI * 2, a1 = a + (r() - 0.5) * 0.12, d0 = P * (1.02 + r() * 0.3), d1 = c * (0.7 + r() * 0.26);
      g.strokeStyle = r() < 0.5 ? `rgba(178,174,128,${0.12 + r() * 0.22})` : `rgba(38,36,22,${0.14 + r() * 0.24})`;
      g.lineWidth = 0.6 + r() * 1.6;
      g.beginPath(); g.moveTo(c + Math.cos(a) * d0, c + Math.sin(a) * d0);
      g.quadraticCurveTo(c + Math.cos((a + a1) / 2 + 0.04) * (d0 + d1) / 2, c + Math.sin((a + a1) / 2 + 0.04) * (d0 + d1) / 2, c + Math.cos(a1) * d1, c + Math.sin(a1) * d1);
      g.stroke();
    }
    g.strokeStyle = 'rgba(48,40,26,0.4)'; // (the collarette: a crinkled ring a third of the way out)
    g.lineWidth = 2.2;
    g.beginPath();
    for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2, d = P * 1.32 + (r() - 0.5) * 5; k ? g.lineTo(c + Math.cos(a) * d, c + Math.sin(a) * d) : g.moveTo(c + Math.cos(a) * d, c + Math.sin(a) * d); }
    g.stroke();
    for (let i = 0; i < 9; i++) { // crypts: small dark hollows just outside the collarette
      const a = r() * Math.PI * 2, d = P * (1.4 + r() * 0.35);
      g.fillStyle = `rgba(48,40,28,${0.25 + r() * 0.2})`;
      g.beginPath(); g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d, 2 + r() * 3, 1.2 + r() * 1.5, a, 0, Math.PI * 2); g.fill();
    }
    const rim = g.createRadialGradient(c, c, c * 0.84, c, c, c); // (the dark rim, soft into the white)
    rim.addColorStop(0, 'rgba(50,44,34,0)');
    rim.addColorStop(0.75, 'rgba(30,27,21,0.45)');
    rim.addColorStop(1, 'rgba(30,27,21,0.75)');
    g.fillStyle = rim;
    g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    const pupil = g.createRadialGradient(c, c, P * 0.9, c, c, P * 1.05);
    pupil.addColorStop(0, '#0d0b09');
    pupil.addColorStop(1, 'rgba(13,11,9,0)');
    g.fillStyle = pupil;
    g.beginPath(); g.arc(c, c, P * 1.05, 0, Math.PI * 2); g.fill();
  });
}

/** Kitchen worktop laminate: oatmeal with darker flecks. */
export function counterTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d6ccb6';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2400, '#8f8470', 1.3, 141);
    speckle(g, w, h, 800, '#5e5546', 1.0, 142);
  }, { repeat: [1, 1] });
}

/** The sky from the top of the dome (v = 0) to its bottom, the horizon at the middle. `stops`: [at, colour] pairs. */
export function skyTex(stops) {
  return canvasTex(64, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    for (const [at, colour] of stops) sky.addColorStop(at, colour);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
  });
}

/**
 * What stands round the yard beyond the fence, all the way round: the neighbours' houses — siding,
 * roofs, a lit window or two — trees, a telegraph pole and its wires. Clear above, so the sky shows.
 */
export function backdropTex() {
  return canvasTex(4096, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(151);
    const ground = 420;
    // trees behind everything
    for (let i = 0; i < 46; i++) {
      const x = r() * w, rad = 40 + r() * 90, y = ground - 150 - r() * 120;
      g.fillStyle = `rgb(${38 + r() * 20},${44 + r() * 22},${30 + r() * 12})`;
      for (let k = 0; k < 7; k++) {
        g.beginPath();
        g.arc(x + (r() - 0.5) * rad, y + (r() - 0.5) * rad * 0.8, rad * (0.5 + r() * 0.5), 0, Math.PI * 2);
        g.fill();
      }
      g.fillRect(x - 6, y, 12, ground - y);
    }
    // houses
    let x = -60;
    while (x < w) {
      const hw = 420 + r() * 380, top = ground - 150 - r() * 60, ridge = top - 60 - r() * 70;
      const tone = 170 + r() * 40;
      g.fillStyle = `rgb(${tone},${tone - 8},${tone - 22})`;
      g.fillRect(x, top, hw, ground - top + 92);
      g.strokeStyle = 'rgba(60,52,40,0.35)';
      g.lineWidth = 2;
      for (let y = top + 10; y < h; y += 13) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + hw, y);
        g.stroke();
      }
      g.fillStyle = `rgb(${70 + r() * 30},${60 + r() * 20},${54 + r() * 16})`;
      g.beginPath();
      g.moveTo(x - 24, top + 4);
      g.lineTo(x + hw * (0.3 + r() * 0.4), ridge);
      g.lineTo(x + hw + 24, top + 4);
      g.closePath();
      g.fill();
      for (let k = 0; k < 2; k++) {
        const wx = x + 60 + r() * (hw - 180), wy = top + 30 + r() * 30;
        g.fillStyle = '#efe7d6';
        g.fillRect(wx - 6, wy - 6, 92, 82);
        g.fillStyle = r() > 0.7 ? '#ffd38a' : '#3c4652'; // now and then somebody is home
        g.fillRect(wx, wy, 80, 32);
        g.fillRect(wx, wy + 38, 80, 32);
      }
      x += hw + 60 + r() * 220;
    }
    // poles and the wires between them
    g.strokeStyle = '#2c2620';
    let last = null;
    for (let px = 300; px < w; px += 900 + r() * 400) {
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(px, h);
      g.lineTo(px, 120);
      g.moveTo(px - 50, 140);
      g.lineTo(px + 50, 140);
      g.stroke();
      if (last !== null) {
        g.lineWidth = 2;
        for (const dx of [-40, 40]) {
          g.beginPath();
          g.moveTo(last + dx, 140);
          g.quadraticCurveTo((last + px) / 2 + dx, 190, px + dx, 140);
          g.stroke();
        }
      }
      last = px;
    }
  });
}

/**
 * A hand-knotted wool rug, its own design, long way along u: an ivory outer guard, a broad navy border of
 * hooked diamonds, a gold inner guard with a red zigzag, and a madder-red field with a stepped navy
 * medallion, corner pieces and a scatter of small motifs, all drawn knot by knot. Bands of slightly
 * different dye run across it (each batch of wool a little different), the pile is worn pale along the
 * way people walk, and there is a faint old stain. `bump`: the pile itself, for a bump map.
 */
export function rugTex(bump = false) {
  const W = 1024, H = 834, K = 3; // a knot is K pixels
  return canvasTex(W, H, (g, w, h) => {
    const r = mulberry32(371);
    const knot = (x, y, c) => { g.fillStyle = c; g.fillRect(Math.floor(x / K) * K, Math.floor(y / K) * K, K, K); };
    const rect = (x, y, rw, rh, c) => { g.fillStyle = c; g.fillRect(Math.round(x / K) * K, Math.round(y / K) * K, Math.round(rw / K) * K, Math.round(rh / K) * K); };
    // a stepped diamond, knot by knot: the way a loom draws one
    const diamond = (cx, cy, rx, ry, c) => {
      for (let y = -ry; y <= ry; y += K) {
        const half = Math.floor((rx * (1 - Math.abs(y) / ry)) / (K * 2)) * K * 2;
        rect(cx - half, cy + y, half * 2 + K, K, c);
      }
    };
    const IVORY = '#d9cba8', NAVY = '#26304a', GOLD = '#b4894a', RED = '#7b2a24', DEEP = '#5e1f1c', TEAL = '#3f6a68';
    if (!bump) {
      rect(0, 0, w, h, IVORY);
      // the border
      const o = 15, b = 66, gd = 14;
      rect(o, o, w - 2 * o, h - 2 * o, NAVY);
      rect(o + b, o + b, w - 2 * (o + b), h - 2 * (o + b), GOLD);
      rect(o + b + gd, o + b + gd, w - 2 * (o + b + gd), h - 2 * (o + b + gd), RED);
      // small ticks in the outer guard
      for (let x = 6; x < w; x += 18) { knot(x, 6, NAVY); knot(x, h - 9, NAVY); }
      for (let y = 6; y < h; y += 18) { knot(6, y, NAVY); knot(w - 9, y, NAVY); }
      // hooked diamonds all round the border
      const mid = o + b / 2;
      const along = (len, step, put) => { for (let t = step / 2; t < len; t += step) put(t); };
      const motif = (x, y) => { diamond(x, y, 22, 22, IVORY); diamond(x, y, 13, 13, RED); diamond(x, y, 5, 5, GOLD); knot(x - 26, y, GOLD); knot(x + 26, y, GOLD); };
      along(w - 2 * mid, 62, (t) => { motif(mid + t, mid); motif(mid + t, h - mid); });
      along(h - 2 * mid - 40, 62, (t) => { motif(mid, mid + 20 + t); motif(w - mid, mid + 20 + t); });
      // a red zigzag along the gold guard
      for (let x = o + b; x < w - o - b; x += K) {
        const z = (Math.floor(x / (K * 3)) % 4 < 2 ? Math.floor(x / K) % 3 : 2 - (Math.floor(x / K) % 3)) * K;
        knot(x, o + b + 4 + z, RED);
        knot(x, h - o - b - 7 - z, RED);
      }
      for (let y = o + b; y < h - o - b; y += K) {
        const z = (Math.floor(y / (K * 3)) % 4 < 2 ? Math.floor(y / K) % 3 : 2 - (Math.floor(y / K) % 3)) * K;
        knot(o + b + 4 + z, y, RED);
        knot(w - o - b - 7 - z, y, RED);
      }
      // the field: small motifs scattered in rows, the medallion, the corners
      const f0 = o + b + gd, fx1 = w - f0, fy1 = h - f0;
      for (let y = f0 + 30, row = 0; y < fy1 - 20; y += 52, row++) {
        for (let x = f0 + 30 + (row % 2) * 34; x < fx1 - 20; x += 68) {
          diamond(x, y, 9, 9, r() < 0.5 ? NAVY : DEEP);
          knot(x, y, r() < 0.5 ? IVORY : GOLD);
        }
      }
      for (const [cx, cy] of [[f0, f0], [fx1, f0], [f0, fy1], [fx1, fy1]]) {
        diamond(cx, cy, 120, 96, NAVY);
        diamond(cx, cy, 84, 66, TEAL);
        diamond(cx, cy, 52, 40, NAVY);
      }
      const cx = w / 2, cy = h / 2;
      diamond(cx, cy, 240, 170, NAVY);
      diamond(cx, cy, 214, 150, IVORY);
      diamond(cx, cy, 196, 136, RED);
      diamond(cx, cy, 150, 104, NAVY);
      diamond(cx, cy, 104, 72, GOLD);
      diamond(cx, cy, 80, 56, DEEP);
      for (const [dx, dy] of [[-56, 0], [56, 0], [0, -38], [0, 38]]) diamond(cx + dx, cy + dy, 16, 16, IVORY);
      diamond(cx, cy, 22, 22, TEAL);
      // pendants off the ends of the medallion
      for (const s of [-1, 1]) { diamond(cx + s * 270, cy, 30, 24, NAVY); diamond(cx + s * 270, cy, 14, 12, GOLD); }
      // the dye, a little different from batch to batch, in bands across the rug
      for (let x = 0; x < w;) {
        const bw = 20 + r() * 70;
        g.fillStyle = r() < 0.5 ? `rgba(255,236,214,${0.03 + r() * 0.06})` : `rgba(30,10,8,${0.03 + r() * 0.07})`;
        g.fillRect(x, 0, bw, h);
        x += bw;
      }
      // worn pale where people walk, from the corridor across to the sofa; an old stain by the table
      const wear = g.createLinearGradient(w, h * 0.2, 0, h * 0.8);
      wear.addColorStop(0.2, 'rgba(236,222,200,0)');
      wear.addColorStop(0.5, 'rgba(236,222,200,0.16)');
      wear.addColorStop(0.8, 'rgba(236,222,200,0)');
      g.fillStyle = wear;
      g.fillRect(0, 0, w, h);
      const st = g.createRadialGradient(w * 0.63, h * 0.38, 4, w * 0.63, h * 0.38, 46);
      st.addColorStop(0, 'rgba(60,30,20,0.18)');
      st.addColorStop(0.8, 'rgba(60,30,20,0.12)');
      st.addColorStop(1, 'rgba(60,30,20,0)');
      g.fillStyle = st;
      g.fillRect(0, 0, w, h);
    } else {
      rect(0, 0, w, h, '#808080');
    }
    // every knot a little different, and the rows of weft between them
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4, cell = ((Math.floor(x / K) * 73856093) ^ (Math.floor(y / K) * 19349663)) >>> 0;
        const n = ((cell % 1000) / 1000 - 0.5) * (bump ? 0.5 : 0.14) + ((x % K === 0) ? -0.05 : 0) + ((y % K === 0) ? (bump ? -0.25 : -0.04) : 0) + (Math.random() - 0.5) * (bump ? 0.2 : 0.06);
        for (let c = 0; c < 3; c++) d[k + c] = Math.max(0, Math.min(255, d[k + c] * (1 + n)));
      }
    }
    g.putImageData(img, 0, 0);
  }, bump ? { data: true } : {});
}

/** The rug's fringe: cotton warp ends, loose, a few twisted together, see-through between. */
export function fringeTex() {
  return canvasTex(512, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(381);
    for (let x = 1; x < w; x += 2.6 + r() * 1.4) {
      const len = h * (0.75 + r() * 0.25), bend = (r() - 0.5) * 10;
      g.strokeStyle = `rgb(${214 + r() * 20},${204 + r() * 18},${180 + r() * 16})`;
      g.lineWidth = 1.2 + r() * 0.8;
      g.beginPath();
      g.moveTo(x, 0);
      g.quadraticCurveTo(x + bend * 0.3, len * 0.5, x + bend, len);
      g.stroke();
    }
  });
}

/** A framed print for over the sofa: hills, a lake, a sky that has faded in the sun. */
export function landscapeTex() {
  return canvasTex(512, 360, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, '#9fb4bf');
    sky.addColorStop(1, '#e6dcc4');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7c8a72';
    g.beginPath();
    g.moveTo(0, h * 0.55);
    g.quadraticCurveTo(w * 0.3, h * 0.3, w * 0.55, h * 0.5);
    g.quadraticCurveTo(w * 0.8, h * 0.36, w, h * 0.52);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.fill();
    g.fillStyle = '#93a8ad';
    g.fillRect(0, h * 0.62, w, h * 0.12);
    g.fillStyle = '#5d6b4f';
    g.fillRect(0, h * 0.74, w, h * 0.26);
    speckle(g, w, h, 1500, '#3f4636', 1.4, 171);
    paperWear(g, w, h, 172);
  });
}

/** A crayon drawing stuck on the fridge: the house, a sun, two people holding hands, a cat. */
export function fridgeDrawingTex() {
  return canvasTex(300, 400, (g, w, h) => {
    g.fillStyle = '#f4f1e8';
    g.fillRect(0, 0, w, h);
    const crayon = (color, width, pts) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.lineJoin = g.lineCap = 'round';
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    };
    crayon('#f2b51c', 5, [[230, 60], [262, 60], [262, 90], [230, 90], [230, 60]]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      crayon('#f2b51c', 3, [[246 + Math.cos(a) * 24, 75 + Math.sin(a) * 24], [246 + Math.cos(a) * 38, 75 + Math.sin(a) * 38]]);
    }
    crayon('#b8342a', 5, [[40, 200], [110, 130], [180, 200]]);
    crayon('#7a4a2a', 5, [[50, 200], [50, 290], [170, 290], [170, 200]]);
    crayon('#3a6fc0', 4, [[70, 220], [100, 220], [100, 248], [70, 248], [70, 220]]);
    crayon('#7a4a2a', 4, [[120, 240], [120, 290], [148, 290], [148, 240], [120, 240]]);
    crayon('#2f8a3a', 6, [[0, 300], [w, 300]]);
    // two people holding hands, the big one and the little one
    const person = (x, top, tall, color) => {
      g.strokeStyle = color;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(x, top, tall * 0.12, 0, Math.PI * 2);
      g.stroke();
      crayon(color, 4, [[x, top + tall * 0.12], [x, top + tall * 0.6]]);
      crayon(color, 4, [[x - tall * 0.15, top + tall], [x, top + tall * 0.6], [x + tall * 0.15, top + tall]]);
      crayon(color, 4, [[x - tall * 0.22, top + tall * 0.38], [x + tall * 0.22, top + tall * 0.38]]);
    };
    person(205, 222, 110, '#c2337a');
    person(250, 270, 66, '#2f5fb0');
    crayon('#222', 4, [[60, 340], [92, 340], [100, 326], [104, 346], [92, 356], [60, 352], [56, 340]]); // the cat
    g.fillStyle = '#e04a3a';
    g.font = 'bold 26px "Comic Sans MS", cursive';
    g.fillText('ME + MUM', 40, 390);
  });
}

// ---------------------------------------------------------------- the house, in more detail

/** A cupboard door: a frame of four rails round a flat panel, in the kitchen's wood. */
export function cabinetDoorTex() {
  return canvasTex(256, 512, (g, w, h) => {
    const r = mulberry32(181);
    g.fillStyle = '#8a5a36';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      const x = r() * w;
      g.strokeStyle = r() > 0.3 ? 'rgba(60,34,16,0.18)' : 'rgba(240,200,150,0.08)';
      g.lineWidth = 0.6 + r() * 1.8;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + (r() - 0.5) * 12, h * 0.3, x + (r() - 0.5) * 12, h * 0.7, x + (r() - 0.5) * 8, h);
      g.stroke();
    }
    const m = 38;
    // the panel sits lower than the frame: a shadow along its top and left, a lit edge along the others
    g.fillStyle = 'rgba(40,22,10,0.28)';
    g.fillRect(m, m, w - 2 * m, h - 2 * m);
    g.fillStyle = 'rgba(30,16,6,0.55)';
    g.fillRect(m, m, w - 2 * m, 5);
    g.fillRect(m, m, 5, h - 2 * m);
    g.fillStyle = 'rgba(255,220,170,0.22)';
    g.fillRect(m, h - m - 4, w - 2 * m, 4);
    g.fillRect(w - m - 4, m, 4, h - 2 * m);
    g.strokeStyle = 'rgba(30,16,6,0.6)'; // where the rails meet the stiles
    g.lineWidth = 2;
    for (const y of [m - 1, h - m + 1]) {
      g.beginPath();
      g.moveTo(m, y);
      g.lineTo(w - m, y);
      g.stroke();
    }
    g.strokeStyle = 'rgba(20,10,4,0.5)';
    g.strokeRect(1, 1, w - 2, h - 2);
  });
}

/** A loudspeaker grille: dark plastic, punched with rows of small holes. */
export function grilleTex() {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#4a4b4f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#121214';
    for (let y = 5; y < h; y += 7) {
      for (let x = (y / 7) % 2 ? 4 : 7.5; x < w; x += 7) {
        g.beginPath();
        g.arc(x, y, 2, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
}

/** Brushed steel, the grain all one way. */
export function brushedTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#a9adb2';
    g.fillRect(0, 0, w, h);
    const r = mulberry32(191);
    for (let i = 0; i < 900; i++) {
      const y = r() * h;
      g.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(40,44,50,0.12)';
      g.lineWidth = 0.5 + r();
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + (r() - 0.5) * 2);
      g.stroke();
    }
  }, { repeat: [3, 3] });
}

/**
 * A plastic lawn flamingo's paint, side on, laid flat through it from one side to the other (`F`: where
 * its parts lie, in its own metres — see FLAMINGO in yard.js). Faded coral pink, deeper low down and
 * bleached along the top; scuffed through to the chalky white plastic along the belly, the front of the
 * neck and the end of the tail; the moulded wing outlined, with the black feathers painted along its
 * front and bottom edge and worn grey at their tips; a pale face; the beak grey at the root, black from
 * the bend; dirt splashed up from the lawn. `seed`: each one worn its own way.
 */
export function flamingoTex(seed, F) {
  const [x0, x1, y0, y1] = F.box;
  const W = 1024, H = Math.round((W * (y1 - y0)) / (x1 - x0));
  return canvasTex(W, H, (g, w, h) => {
    const r = mulberry32(seed);
    const px = (x) => ((x - x0) / (x1 - x0)) * w, py = (y) => (1 - (y - y0) / (y1 - y0)) * h, pm = (m) => (m / (x1 - x0)) * w;
    const blob = (x, y, rad, colour, alpha) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, colour.replace('A', alpha));
      gr.addColorStop(1, colour.replace('A', 0));
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    };
    // the pink: faded by many summers (user, 2026-10-17), bleached almost to salmon-white at the top where
    // the sun gets it, a little deeper further down
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#ecc6bb');
    base.addColorStop(0.3, '#e5aa9f');
    base.addColorStop(0.65, '#dc9289');
    base.addColorStop(1, '#d48a83');
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) blob(r() * w, r() * h, pm(0.04 + r() * 0.1), r() > 0.45 ? 'rgba(255,196,184,A)' : 'rgba(214,86,84,A)', 0.05 + r() * 0.07);
    // worn through to the white plastic: a soft pale cloud, and in it a frost of fine grains, thickest at the
    // middle and thinning out raggedly, where hands and mowers and weather got at it
    const chalk = (x, y, rx, ry, strength) => {
      g.save();
      g.translate(px(x), py(y));
      g.scale(1, ry / rx);
      blob(0, 0, pm(rx), 'rgba(236,226,220,A)', strength * 0.45);
      g.restore();
      g.fillStyle = 'rgb(240,232,226)';
      for (let i = 0; i < 2600 * (rx / 0.05); i++) {
        const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7);
        if (r() > 1.15 - d) continue; // fewer, further out
        g.globalAlpha = strength * (0.25 + r() * 0.6) * (1 - d * 0.7);
        g.fillRect(px(x + Math.cos(a) * d * rx), py(y + Math.sin(a) * d * ry), 1 + r() * 2.2, 1 + r() * 1.6);
      }
      g.globalAlpha = 1;
    };
    // weathered all over, and plainly (user, 2026-10-17: "more visible marks"): a chalky bloom; dirty water
    // run down it in streaks; mud splashed up its lower half by rain; the plastic crazed by the sun on its
    // back; scratches and gouges through to the white; chips of paint gone, their edges darker
    g.fillStyle = 'rgba(236,226,216,0.16)';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { // streaks of dirty water, from the top down
      const x = r() * w, y0 = r() * h * 0.6, len = h * (0.1 + r() * 0.35), gr = g.createLinearGradient(0, y0, 0, y0 + len);
      gr.addColorStop(0, 'rgba(92,80,66,0)'); gr.addColorStop(0.3, `rgba(92,80,66,${0.16 + r() * 0.16})`); gr.addColorStop(1, 'rgba(92,80,66,0)');
      g.fillStyle = gr; g.fillRect(x, y0, 2 + r() * 5, len);
    }
    for (let i = 0; i < 26; i++) blob(r() * w, h * (0.55 + r() * 0.45), pm(0.02 + r() * 0.06), 'rgba(96,84,66,A)', 0.12 + r() * 0.12);
    for (let i = 0; i < 520; i++) { // mud splashed up from the lawn
      const y = h * (1 - Math.pow(r(), 1.6) * 0.45);
      g.fillStyle = `rgba(${72 + r() * 30},${58 + r() * 20},${40 + r() * 14},${0.3 + r() * 0.45})`;
      g.beginPath(); g.ellipse(r() * w, y, 0.8 + r() * 2.6, 0.6 + r() * 1.8, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(120,70,64,0.4)'; // the sun's crazing, over the back
    g.lineWidth = 0.8;
    for (let i = 0; i < 160; i++) { let x = r() * w, y = h * r() * 0.5, a = r() * Math.PI * 2; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { a += (r() - 0.5) * 1.6; x += Math.cos(a) * (3 + r() * 6); y += Math.sin(a) * (3 + r() * 6); g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 190; i++) { // scratches and gouges
      const x = r() * w, y = r() * h, a = r() * Math.PI, len = 6 + r() * 34;
      g.strokeStyle = `rgba(246,238,232,${0.55 + r() * 0.35})`;
      g.lineWidth = 0.8 + r() * 1.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    for (let i = 0; i < 46; i++) { // chips: the paint gone, the white plastic under, a darker rim round each
      const x = r() * w, y = r() * h, rad = pm(0.002 + r() * 0.007), n = 6 + Math.floor(r() * 5), pts = [];
      for (let k = 0; k < n; k++) { const t = (k / n) * Math.PI * 2, d = rad * (0.5 + r() * 0.8); pts.push([x + Math.cos(t) * d, y + Math.sin(t) * d]); }
      g.beginPath(); pts.forEach(([px_, py_], k) => (k ? g.lineTo(px_, py_) : g.moveTo(px_, py_))); g.closePath();
      g.strokeStyle = 'rgba(150,62,60,0.7)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = `rgb(${236 + r() * 10},${228 + r() * 8},${220 + r() * 8})`; g.fill();
    }
    chalk(0.02, 0.528, 0.17, 0.026, 0.95); // the belly
    chalk(-0.01, 0.56, 0.16, 0.022, 0.75); // and up the lower side, where the grass rubs
    chalk(0.215, 0.655, 0.024, 0.06, 0.8); // the breast and the front of the neck, low down
    chalk(-0.195, 0.513, 0.03, 0.018, 0.7); // the end of the tail
    chalk(0.2 + (r() - 0.5) * 0.02, 0.82 + r() * 0.06, 0.014, 0.045, 0.5); // a way up the neck
    for (let i = 0; i < 4; i++) chalk(-0.12 + r() * 0.28, 0.6 + r() * 0.1, 0.02 + r() * 0.02, 0.012 + r() * 0.01, 0.4); // rubbed on the sides
    // the face, pale over the front of the head
    const [fx, fy, fr] = F.face;
    blob(px(fx), py(fy), pm(fr), 'rgba(226,222,216,A)', 0.95);
    blob(px(fx - 0.006), py(fy + 0.004), pm(fr * 0.75), 'rgba(232,228,222,A)', 0.8);
    // the beak: grey at the root going black from the bend to the tip
    const [bx, by] = F.beak;
    const bk = g.createLinearGradient(0, py(by + 0.022), 0, py(by - 0.012));
    bk.addColorStop(0, 'rgba(196,192,186,0)');
    bk.addColorStop(0.35, 'rgba(176,172,166,1)');
    bk.addColorStop(0.7, 'rgba(48,46,44,1)');
    bk.addColorStop(1, 'rgba(26,25,24,1)');
    g.fillStyle = bk;
    g.fillRect(px(bx - 0.03), py(by + 0.022), w - px(bx - 0.03), h - py(by + 0.022));
    // the wing: its moulded edge, the feather lines in it, and the black along its front and bottom
    const [cx, cy, rx, ry, tilt] = F.wing;
    const at = (phi, k = 1) => {
      const ex = Math.cos(phi) * rx * k, ey = Math.sin(phi) * ry * k;
      return [px(cx + ex * Math.cos(tilt) - ey * Math.sin(tilt)), py(cy + ex * Math.sin(tilt) + ey * Math.cos(tilt))];
    };
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(176,72,74,0.55)';
    g.lineWidth = pm(0.003);
    g.beginPath();
    for (let i = 0; i <= 64; i++) g[i ? 'lineTo' : 'moveTo'](...at((i / 64) * Math.PI * 2));
    g.stroke();
    g.strokeStyle = 'rgba(196,92,92,0.35)';
    g.lineWidth = pm(0.0018);
    for (let k = 0.45; k < 0.95; k += 0.12) {
      g.beginPath();
      for (let i = 0; i <= 24; i++) g[i ? 'lineTo' : 'moveTo'](...at(-0.2 - (i / 24) * 2.6, k));
      g.stroke();
    }
    // the black: a band painted along the wing's edge, from the top of its front, round, and along the bottom
    // to the tail, thickest at the front, its inner side broken into the points of feathers lying back
    const from = 0.95, to = -3.0;
    for (let i = 0; i < 80; i++) {
      const u = i / 79, phi = from + (to - from) * u;
      const thick = 0.004 + 0.007 * Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5) * (1 - u * 0.55);
      const [ax, ay] = at(phi, 1.0), [bx2, by2] = at(phi - 0.055, 1.0);
      g.strokeStyle = `rgba(${24 + r() * 10},${22 + r() * 8},${22 + r() * 8},0.92)`;
      g.lineWidth = pm(thick);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx2, by2);
      g.stroke();
    }
    for (let i = 0; i < 22; i++) {
      const u = 0.15 + (i / 21) * 0.8 + (r() - 0.5) * 0.02, phi = from + (to - from) * u;
      const [ox, oy] = at(phi, 0.97), [ix, iy] = at(phi - 0.16 - r() * 0.06, 0.86 - r() * 0.05); // pointing back, in towards the middle
      g.fillStyle = `rgba(26,24,24,${0.75 + r() * 0.2})`;
      const [nx, ny] = [-(iy - oy), ix - ox], k = pm(0.003 + r() * 0.002) / Math.hypot(nx, ny);
      g.beginPath();
      g.moveTo(ox + nx * k, oy + ny * k);
      g.lineTo(ix, iy);
      g.lineTo(ox - nx * k, oy - ny * k);
      g.fill();
    }
    // where the black has gone thin: streaks of the grey-green primer along it
    for (let i = 0; i < 26; i++) {
      const u = r(), phi = from + (to - from) * u, len = 0.05 + r() * 0.12;
      const [ax, ay] = at(phi, 0.985 - r() * 0.04), [bx2, by2] = at(phi - len, 0.985 - r() * 0.04);
      g.strokeStyle = `rgba(${108 + r() * 30},${116 + r() * 24},${100 + r() * 20},${0.35 + r() * 0.35})`;
      g.lineWidth = pm(0.0012 + r() * 0.0015);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx2, by2);
      g.stroke();
    }
    // scratches to the white, and fine cracks in the old paint
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h;
      g.strokeStyle = `rgba(246,238,232,${0.3 + r() * 0.5})`;
      g.lineWidth = 0.6 + r() * 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * pm(0.03), y + (r() - 0.5) * pm(0.012));
      g.stroke();
    }
    g.strokeStyle = 'rgba(150,70,70,0.22)';
    g.lineWidth = 0.7;
    for (let i = 0; i < 40; i++) {
      let x = r() * w, y = r() * h;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) g.lineTo((x += (r() - 0.5) * 14), (y += (r() - 0.5) * 14));
      g.stroke();
    }
    // the lawn's dirt, splashed up the lower half and settled in the creases
    const dirt = g.createLinearGradient(0, py(0.62), 0, h);
    dirt.addColorStop(0, 'rgba(96,84,66,0)');
    dirt.addColorStop(1, 'rgba(96,84,66,0.5)');
    g.fillStyle = dirt;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 2600, '#5e5040', 1.6, seed + 1);
    speckle(g, w, h, 1200, '#f4ece6', 1.2, seed + 2);
  });
}

/**
 * The whole back yard's ground, once, edge to edge (`plan`: x0, x1, z0, z1 in metres; `bare(x, z)`:
 * 0 for thick grass … 1 for no grass at all): grass where it grows, dirt where it doesn't, a path
 * worn from the back door.
 */
export function yardGroundTex(plan, bare, wood = () => 0, needles = () => 0) {
  const W = 2048, Hh = Math.round(2048 * (plan.z1 - plan.z0) / (plan.x1 - plan.x0));
  return canvasTex(W, Hh, (g, w, h) => {
    const r = mulberry32(211);
    g.fillStyle = '#52682c'; // (a little lighter, and the blades over it nearer to it, below: less contrast — user, 2026-10-17)
    g.fillRect(0, 0, w, h);
    // the dirt underneath shows where the grass is thin: paint it in from the same map the tufts use
    const cell = 6;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const wx = plan.x0 + (x / w) * (plan.x1 - plan.x0), wz = plan.z0 + (y / h) * (plan.z1 - plan.z0);
        const b = bare(wx, wz) + (r() - 0.5) * 0.2; // (a ragged edge, never a clean line)
        if (b < 0.25) continue;
        const v = Math.min(1, (b - 0.25) / 0.5);
        g.fillStyle = `rgba(${104 + r() * 16},${84 + r() * 12},${58 + r() * 10},${v})`;
        g.fillRect(x, y, cell, cell);
      }
    }
    speckle(g, w, h, 15000, '#3b3020', 1.6, 212);
    speckle(g, w, h, 12000, '#9c8a64', 1.4, 213);
    // towards the trees the lawn gives way to last year's leaves, brown, lying thick (user, 2026-10-17):
    // the ground under them first, then the leaves one by one — curled, every brown from ochre to almost
    // black, the odd one still yellow — twigs among them, and under the spruce its needles
    const at = (x, y) => [plan.x0 + (x / w) * (plan.x1 - plan.x0), plan.z0 + (y / h) * (plan.z1 - plan.z0)];
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
      const k = wood(...at(x, y)) + (r() - 0.5) * 0.15;
      if (k < 0.12) continue;
      g.fillStyle = `rgba(${84 + r() * 18},${66 + r() * 12},${44 + r() * 10},${Math.min(1, (k - 0.12) / 0.5)})`;
      g.fillRect(x, y, cell, cell);
    }
    const dead = ['#6f5133', '#80603a', '#9a7640', '#5a3f26', '#43301f', '#8a5434', '#a08a5a', '#7b6a3c', '#b09040'];
    for (let i = 0, n = Math.round(320000 * (h / 3090)); i < n; i++) {
      const x = r() * w, y = r() * h, k = wood(...at(x, y));
      if (r() > k * 1.15) continue;
      const len = 5 + r() * 9, wide = len * (0.3 + r() * 0.3), a = r() * Math.PI * 2;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = 'rgba(30,20,12,0.35)'; g.beginPath(); g.ellipse(0.8, 0.8, len / 2, wide / 2, 0, 0, Math.PI * 2); g.fill(); // its shadow, it lies a little curled
      g.fillStyle = dead[Math.floor(r() * dead.length)];
      g.beginPath(); g.ellipse(0, 0, len / 2, wide / 2 * (0.6 + r() * 0.4), 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(40,26,14,0.5)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke(); // its midrib
      g.restore();
    }
    for (let i = 0, n = Math.round(9000 * (h / 3090)); i < n; i++) { // twigs
      const x = r() * w, y = r() * h, k = wood(...at(x, y));
      if (r() > k) continue;
      let a = r() * Math.PI * 2, px = x, py = y;
      g.strokeStyle = r() < 0.5 ? 'rgba(52,38,24,0.85)' : 'rgba(92,72,50,0.85)'; g.lineWidth = 1 + r() * 1.4;
      g.beginPath(); g.moveTo(px, py);
      for (let s = 0, m = 2 + Math.floor(r() * 4); s < m; s++) { a += (r() - 0.5) * 0.7; px += Math.cos(a) * 7; py += Math.sin(a) * 7; g.lineTo(px, py); }
      g.stroke();
    }
    for (let i = 0, n = Math.round(160000 * (h / 3090)); i < n; i++) { // the spruce's needles
      const x = r() * w, y = r() * h, k = needles(...at(x, y));
      if (r() > k) continue;
      const a = r() * Math.PI, len = 3 + r() * 3;
      g.strokeStyle = r() < 0.6 ? 'rgba(122,82,48,0.8)' : 'rgba(84,58,36,0.8)'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    // short blades all over where it grows
    const greens = ['#5f7a33', '#4f6829', '#6a8439', '#768a42', '#93905a', '#56702d'];
    for (let i = 0, n = Math.round(120000 * (h / 1580)); i < n; i++) { // (as thick as it was before the yard was longer)
      const x = r() * w, y = r() * h;
      const wx = plan.x0 + (x / w) * (plan.x1 - plan.x0), wz = plan.z0 + (y / h) * (plan.z1 - plan.z0);
      if (bare(wx, wz) > 0.55 + r() * 0.2 || wood(wx, wz) > 0.35 + r() * 0.45) continue;
      const len = 3 + r() * 8, lean = (r() - 0.5) * 0.9;
      g.strokeStyle = greens[Math.floor(r() * greens.length)];
      g.lineWidth = 1 + r() * 0.8;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + lean * len, y - len);
      g.stroke();
    }
  });
}

/**
 * A tuft of grass, seen side on: thin blades from a common root, tapering, darker low down and lighter at
 * their tips, the odd one gone dry — in the lawn's own greens (no darker than it: user, 2026-10-17), clear
 * between them.
 */
export function grassTuftTex() {
  return bleed(canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(221);
    for (let i = 0; i < 140; i++) {
      const x0 = w / 2 + (r() - 0.5) * 150, lean = (r() - 0.5) * 120, tall = h * (0.35 + r() * 0.65), wide = 1.4 + r() * 2.2, dry = r() < 0.1, v = r();
      const tipX = x0 + lean, tipY = h - tall, cx = x0 + lean * 0.25, cy = h - tall * 0.6;
      const gr = g.createLinearGradient(0, h, 0, tipY);
      gr.addColorStop(0, dry ? '#83804b' : `rgb(${82 + v * 12},${104 + v * 14},${46 + v * 8})`);
      gr.addColorStop(1, dry ? '#9c9762' : `rgb(${98 + v * 14},${122 + v * 14},${54 + v * 10})`);
      g.fillStyle = gr;
      g.beginPath(); // a blade: wide at its root, to a point
      g.moveTo(x0 - wide, h);
      g.quadraticCurveTo(cx - wide * 0.6, cy, tipX, tipY);
      g.quadraticCurveTo(cx + wide * 0.6, cy, x0 + wide, h);
      g.closePath();
      g.fill();
    }
  }));
}

/** Leaves for the trees round the yard: a clump of them, clear round the edge. */
export function leafClumpTex(seed = 231, hue = 0) {
  return bleed(canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(seed);
    for (let i = 0; i < 420; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 110;
      const x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d * 0.9;
      const shade = 0.55 + r() * 0.45 - (d / 110) * 0.15;
      g.fillStyle = `rgb(${Math.round((46 + hue) * shade)},${Math.round(78 * shade)},${Math.round(34 * shade)})`;
      g.beginPath();
      g.ellipse(x, y, 4 + r() * 6, 2 + r() * 3, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }));
}

/** Bark: grey-brown, split in long ridges. */
export function barkTex() {
  return canvasTex(128, 512, (g, w, h) => {
    g.fillStyle = '#4c4238';
    g.fillRect(0, 0, w, h);
    const r = mulberry32(241);
    for (let i = 0; i < 60; i++) {
      const x = r() * w;
      g.strokeStyle = r() > 0.4 ? 'rgba(20,16,12,0.6)' : 'rgba(150,140,124,0.25)';
      g.lineWidth = 1 + r() * 3;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + (r() - 0.5) * 16, h * 0.3, x + (r() - 0.5) * 16, h * 0.7, x + (r() - 0.5) * 10, h);
      g.stroke();
    }
  }, { repeat: [1, 1] });
}

/** Roof shingles, grey-brown, rows of tabs. */
export function shingleTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = mulberry32(251);
    const rows = 8, rh = h / rows;
    for (let row = 0; row < rows; row++) {
      const off = row % 2 ? 16 : 0;
      for (let x = -off; x < w; x += 32) {
        const v = 70 + r() * 30;
        g.fillStyle = `rgb(${v + 6},${v},${v - 6})`;
        g.fillRect(x, row * rh, 31, rh);
      }
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, row * rh + rh - 3, w, 3);
    }
    speckle(g, w, h, 2500, '#1a1816', 1.2, 252);
  }, { repeat: [1, 1] });
}

/** A soft cloud, white with a warm underside, clear round it. */
export function cloudTex(seed = 261, [core, rim] = ['rgba(255,236,224,0.16)', 'rgba(255,220,200,0)']) {
  return canvasTex(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(seed);
    for (let i = 0; i < 60; i++) {
      const x = w * (0.15 + r() * 0.7), y = h * (0.4 + r() * 0.3), rad = 30 + r() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, core);
      gr.addColorStop(1, rim);
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
}

/** A line of trees far off, against the sky, softened by the air between: clear above them. */
export function treelineTex() {
  return canvasTex(2048, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(271);
    for (const [base, tone, count] of [[0.62, 82, 150], [0.72, 60, 130]]) {
      g.fillStyle = `rgb(${tone - 8},${tone + 2},${tone - 12})`;
      for (let i = 0; i < count; i++) {
        const x = r() * w, y = h * (base - r() * 0.25), rad = 14 + r() * 30;
        g.beginPath();
        g.arc(x, y, rad, 0, Math.PI * 2);
        g.fill();
        g.fillRect(x - rad, y, rad * 2, h);
      }
    }
  });
}

/** A white bath towel: terry loops, and a woven band near each end. v runs from one end to the other. */
export function towelTex() {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#f7f6f2';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 9000, '#dcd9d0', 1.3, 291);
    speckle(g, w, h, 5000, '#ffffff', 1.2, 292);
    for (const y of [h * 0.07, h * 0.93]) {
      g.fillStyle = 'rgba(200,196,186,0.8)';
      g.fillRect(0, y - 12, w, 24);
      g.fillStyle = 'rgba(240,238,232,1)';
      for (let x = 0; x < w; x += 6) g.fillRect(x, y - 10, 3, 20);
    }
  });
}

/** An old residential street's asphalt, 4 m square: grey gone pale with sun, darker patches where it was mended, hairline cracks. */
export function asphaltTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#4d4c4a';
    g.fillRect(0, 0, w, h);
    const r = mulberry32(331);
    for (let i = 0; i < 30; i++) {
      const x = r() * w, y = r() * h, rad = 60 + r() * 200;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() > 0.5 ? 'rgba(120,118,112,0.18)' : 'rgba(25,25,25,0.2)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // a mended trench, blacker than the rest
    g.fillStyle = 'rgba(28,28,28,0.55)';
    g.fillRect(w * 0.12, h * 0.55, w * 0.62, 70);
    speckle(g, w, h, 60000, '#9a9790', 1.4, 332);
    speckle(g, w, h, 40000, '#1e1e1e', 1.3, 333);
    g.strokeStyle = 'rgba(20,20,20,0.45)';
    for (let i = 0; i < 9; i++) {
      let x = r() * w, y = r() * h;
      g.lineWidth = 1 + r();
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 12; k++) g.lineTo((x += (r() - 0.5) * 50), (y += (r() - 0.3) * 30));
      g.stroke();
    }
  });
}

/** Sidewalk concrete: 1.5 m square flags with joints between them, weathered and a little stained. */
export function paveTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#a7a39a';
    g.fillRect(0, 0, w, h);
    const r = mulberry32(341);
    for (let i = 0; i < 12; i++) {
      const x = r() * w, y = r() * h, rad = 40 + r() * 120;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() > 0.5 ? 'rgba(80,76,66,0.16)' : 'rgba(210,206,196,0.18)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    speckle(g, w, h, 16000, '#6f6b62', 1.1, 342);
    speckle(g, w, h, 9000, '#d4d0c6', 1.0, 343);
    g.fillStyle = 'rgba(60,57,50,0.75)';
    g.fillRect(0, 0, w, 3);
    g.fillRect(0, 0, 3, h);
  });
}

/** Toilet paper, round a roll: soft off-white, a faint quilted emboss, the edges of the turns showing as fine lines. v runs round the roll. */
export function paperRollTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#efece5';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(205,200,190,0.35)';
    for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) g.fillRect(x, y, 2, 2);
    speckle(g, w, h, 3000, '#ffffff', 1.2, 351);
    speckle(g, w, h, 1500, '#cfc9be', 1.0, 352);
  });
}

/** A small boat's outside: sea blue paint gone chalky, a white band along the top, the planks' lines, scrapes to the wood. u runs along it (three times), v round from one top edge to the other. */
export function boatPaintTex() {
  return canvasTex(512, 256, (g, w, h) => {
    const r = mulberry32(401);
    g.fillStyle = '#5a7f8e';
    g.fillRect(0, 0, w, h);
    // the white band under each top edge
    g.fillStyle = '#d9d4c6';
    g.fillRect(0, 0, w, h * 0.09);
    g.fillRect(0, h * 0.91, w, h * 0.09);
    // the lap of each plank, a dark line with light just above it
    for (let k = 1; k < 9; k++) {
      const y = (k / 9) * h;
      g.fillStyle = 'rgba(20,30,34,0.35)';
      g.fillRect(0, y - 1, w, 2);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, y + 1, w, 2);
    }
    // chalky and worn: pale blotches, scrapes through to the wood
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, rad = 6 + r() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(220,226,222,${0.12 + r() * 0.18})`);
      gr.addColorStop(1, 'rgba(220,226,222,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = 'rgba(120,88,58,0.7)';
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h;
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 6);
      g.stroke();
    }
    speckle(g, w, h, 3000, '#2c3a3e', 1.2, 402);
  }, { repeat: [1, 1] });
}

/**
 * Yellow oilskin for Luna's sou'wester (boat.js): waxed cotton gone a little blotchy and grimy, pale
 * along the creases where the wax has cracked and rubbed, with rings of stitching at each of `rows`
 * (fractions of v, which runs out from the crown on the brim, up the crown on the crown). u runs once
 * round the hat. Returns { map, bump }.
 */
export function oilskinTex(rows, seed = 431) {
  const draw = (bump) => (g, w, h) => {
    const r = mulberry32(seed);
    g.fillStyle = bump ? '#808080' : '#f4c632';
    g.fillRect(0, 0, w, h);
    // blotches where the wax is thicker or worn thin
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, rad = 8 + r() * 40, light = r() < 0.5, k = r(); // the same draws for both maps
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const c = bump ? (light ? '150,150,150' : '110,110,110') : light ? '252,226,120' : '206,152,30';
      gr.addColorStop(0, `rgba(${c},${bump ? 0.25 : 0.06 + k * 0.1})`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // creases: soft wandering lines, a groove with the wax cracked pale along it
    for (let i = 0; i < 46; i++) {
      let x = r() * w, y = r() * h, a = r() * Math.PI * 2;
      const len = 14 + r() * 60;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < len; s += 4) {
        a += (r() - 0.5) * 0.5;
        x += Math.cos(a) * 4;
        y += Math.sin(a) * 4 * 0.6;
        g.lineTo(x, y);
      }
      g.lineWidth = 1 + r() * 1.6;
      const k = r();
      g.strokeStyle = bump ? 'rgba(60,60,60,0.55)' : `rgba(250,232,170,${0.25 + k * 0.25})`;
      g.stroke();
    }
    // grime, worked into the lower part (on the brim: towards the edge)
    if (!bump) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(90,64,20,0)');
      gr.addColorStop(1, 'rgba(90,64,20,0.08)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      speckle(g, w, h, 500, 'rgba(96,70,24,0.4)', 1.0, seed + 1);
    }
    // the stitching: rows of short stitches, each sunk a little into the cloth
    for (const v of rows) {
      const y = v * h;
      for (let x = r() * 6; x < w; x += 7) {
        g.fillStyle = bump ? 'rgba(40,40,40,0.8)' : 'rgba(150,104,18,0.75)';
        g.fillRect(x, y - 0.8, 4.2, 1.6);
        if (!bump) {
          g.fillStyle = 'rgba(255,236,160,0.35)';
          g.fillRect(x, y - 2.2, 4.2, 1);
        }
      }
    }
  };
  return {
    map: canvasTex(1024, 256, draw(false), { repeat: [1, 1] }),
    bump: canvasTex(1024, 256, draw(true), { repeat: [1, 1], data: true }),
  };
}

/**
 * Old painted steel, for the bathroom's wall cabinet: the paint (`look.base`) gone patchy (`look.stain`),
 * chipped to the dark metal at the edges and corners with rust round the chips, rust run down from them
 * and along the bottom edge, grey finger-marks by the catch (`catchAt`: [u, v], or null). Returns
 * { map, bump }.
 */
export function wornEnamelTex(seed = 511, catchAt = null, look = {}) {
  const { base = '#e4dfd2', stain = '196,182,148' } = look;
  const draw = (bump) => (g, w, h) => {
    const r = mulberry32(seed);
    g.fillStyle = bump ? '#9a9a9a' : base;
    g.fillRect(0, 0, w, h);
    if (!bump) {
      // yellowed unevenly, a little grimier low down (its own draws: the chips fall in the same
      // places on both maps)
      const ry = mulberry32(seed + 7);
      for (let i = 0; i < 26; i++) {
        const x = ry() * w, y = ry() * h, rad = 30 + ry() * 120;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(${stain},${0.08 + ry() * 0.1})`);
        gr.addColorStop(1, `rgba(${stain},0)`);
        g.fillStyle = gr;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      const low = g.createLinearGradient(0, h * 0.6, 0, h);
      low.addColorStop(0, 'rgba(120,100,70,0)');
      low.addColorStop(1, 'rgba(120,100,70,0.16)');
      g.fillStyle = low;
      g.fillRect(0, 0, w, h);
      if (catchAt) {
        const [cu, cv] = catchAt, x = cu * w, y = cv * h, gr = g.createRadialGradient(x, y, 0, x, y, w * 0.12);
        gr.addColorStop(0, 'rgba(90,86,80,0.22)');
        gr.addColorStop(1, 'rgba(90,86,80,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      }
    }
    // chips, most of them near the edges and corners, each with rust round it and a run below
    for (let i = 0; i < 46; i++) {
      const edge = r();
      let x = r() * w, y = r() * h;
      if (edge < 0.7) { // pushed out to an edge
        const side = Math.floor(r() * 4);
        if (side === 0) x = r() * w * 0.06; else if (side === 1) x = w - r() * w * 0.06; else if (side === 2) y = r() * h * 0.06; else y = h - r() * h * 0.08;
      } else r();
      const s = 1.5 + r() * 7;
      const pts = [];
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, rr = s * (0.6 + r() * 0.7); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      const path = () => { g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); };
      const runLen = r() * 60 * (y / h + 0.3);
      if (bump) {
        g.fillStyle = 'rgba(40,40,40,0.9)';
        path(); g.fill();
      } else {
        g.fillStyle = 'rgba(138,78,36,0.55)'; // the rust round it
        g.save(); g.translate(x, y); g.scale(1.8, 1.8); g.translate(-x, -y); path(); g.fill(); g.restore();
        g.fillStyle = '#3a3633'; // bare metal
        path(); g.fill();
        if (runLen > 6) {
          const gr = g.createLinearGradient(x, y, x, y + runLen);
          gr.addColorStop(0, 'rgba(130,72,32,0.45)');
          gr.addColorStop(1, 'rgba(130,72,32,0)');
          g.fillStyle = gr;
          g.fillRect(x - s * 0.5, y, s, runLen);
        }
      }
    }
    // the bottom edge, rusted along its length
    if (!bump) {
      const gr = g.createLinearGradient(0, h * 0.94, 0, h);
      gr.addColorStop(0, 'rgba(120,66,30,0)');
      gr.addColorStop(1, 'rgba(120,66,30,0.5)');
      g.fillStyle = gr;
      g.fillRect(0, h * 0.94, w, h * 0.06);
      speckle(g, w, h, 1400, 'rgba(110,90,60,0.6)', 1.1, seed + 3);
    }
  };
  return {
    map: canvasTex(512, 512, draw(false)),
    bump: canvasTex(512, 512, draw(true), { data: true }),
  };
}

/**
 * A little clock of segment figures, the cooker's or the microwave's (user, 2026-10-29: "too perfect", "softer"):
 * `digits` (four, null for a blank) in `lit` on a dark face, centred on it, leaning a little; old — soft-edged, a
 * glow round each lit segment, not all of them as bright (one gone dim), the unlit ones a ghost behind.
 */
export function cookerClockTex(digits = [null, 6, 0, 4], lit = [138, 212, 150], seed = 3671) { // (6:04 — the time of the evening, as the PC's: no 24-hour clocks here; green: user, 2026-10-29)
  return canvasTex(240, 80, (g, w, h) => {
    const r = mulberry32(seed);
    g.fillStyle = '#05070a';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 300, '#141a1e', 1, seed + 1);
    const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
    const sw = 26, sh = 22, t = 5, gap = 9, cg = 8, cw = 5, x0 = (w - (4 * sw + 2 * gap + 2 * cg + cw)) / 2, y0 = (h - (2 * sh + t)) / 2;
    const at = [x0, x0 + sw + gap, x0 + 2 * sw + gap + 2 * cg + cw, x0 + 3 * sw + 2 * gap + 2 * cg + cw];
    const rgba = (a) => `rgba(${lit[0]},${lit[1]},${lit[2]},${a})`;
    const segs = [];
    digits.forEach((d, i) => {
      const x = at[i], y = y0;
      const seg = { a: [x + t, y, sw - 2 * t, t], b: [x + sw - t, y + t, t, sh - t], c: [x + sw - t, y + sh + t, t, sh - t], d: [x + t, y + 2 * sh, sw - 2 * t, t], e: [x, y + sh + t, t, sh - t], f: [x, y + t, t, sh - t], g: [x + t, y + sh, sw - 2 * t, t] };
      for (const k of 'abcdefg') segs.push([seg[k], d !== null && SEG[d].includes(k)]);
    });
    const dim = Math.floor(r() * segs.length);
    g.setTransform(1, 0, -0.1, 1, 0.1 * h * 0.5, 0); // (leaning, as they did)
    const draw = (blur, a) => {
      g.filter = `blur(${blur}px)`;
      segs.forEach(([[x, y, sx, sy], on], i) => {
        if (!on) return;
        g.fillStyle = rgba(a * (i === dim ? 0.45 : 0.78 + r() * 0.22));
        g.beginPath();
        g.roundRect(x + 0.5, y + 0.5, sx - 1, sy - 1, 2);
        g.fill();
      });
    };
    g.filter = 'blur(0.6px)';
    for (const [[x, y, sx, sy], on] of segs) if (!on) { g.fillStyle = rgba(0.07); g.fillRect(x + 0.5, y + 0.5, sx - 1, sy - 1); }
    draw(3.5, 0.32); // the glow round them
    draw(0.9, 1);
    g.filter = 'blur(0.9px)';
    g.fillStyle = rgba(0.85); // the colon, its lower dot dimmer
    const cx = x0 + 2 * sw + gap + cg;
    g.fillRect(cx, y0 + sh * 0.55, cw, cw);
    g.fillStyle = rgba(0.6);
    g.fillRect(cx, y0 + sh * 1.35, cw, cw);
    g.filter = 'none';
    g.setTransform(1, 0, 0, 1, 0, 0);
  });
}

/**
 * The scuffed clear plastic over a little clock (user, 2026-10-29): gone milky, more so at its edges, scratched
 * every way and most across the middle where it is wiped, a smear or two of grease and a fingermark, grime packed
 * into its edges, a crack from one corner. Mostly see-through: its alpha is what is on it.
 */
export function clockCoverTex(seed = 3691) {
  return canvasTex(256, 104, (g, w, h) => {
    const r = mulberry32(seed);
    g.fillStyle = 'rgba(206,210,204,0.10)';
    g.fillRect(0, 0, w, h);
    const edge = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.55);
    edge.addColorStop(0, 'rgba(206,210,204,0)');
    edge.addColorStop(1, 'rgba(206,210,204,0.16)');
    g.fillStyle = edge;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { // grease
      const x = r() * w, y = r() * h, s = 10 + r() * 26, gr = g.createRadialGradient(x, y, 0, x, y, s);
      gr.addColorStop(0, `rgba(176,164,132,${0.08 + r() * 0.1})`);
      gr.addColorStop(1, 'rgba(176,164,132,0)');
      g.fillStyle = gr;
      g.fillRect(x - s, y - s, s * 2, s * 2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) { // scratches, most of them along it, across its middle
      const x = r() * w, y = h * (0.15 + 0.7 * r()), a = (r() < 0.7 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.9, l = 6 + r() * (r() < 0.15 ? 120 : 30);
      g.strokeStyle = `rgba(238,238,232,${0.12 + r() * 0.3})`;
      g.lineWidth = 0.5 + r() * 0.7;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    for (let k = 0; k < 4; k++) { // a fingermark
      g.strokeStyle = `rgba(150,140,120,${0.1 + r() * 0.08})`;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(w * 0.72, h * 0.62, 13 - k * 3, 9 - k * 2, 0.4, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = 'rgba(70,62,48,0.55)'; // grime in its edges
    g.lineWidth = 4;
    g.strokeRect(0, 0, w, h);
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
      const gr = g.createRadialGradient(x, y, 0, x, y, 14);
      gr.addColorStop(0, 'rgba(70,62,48,0.6)');
      gr.addColorStop(1, 'rgba(70,62,48,0)');
      g.fillStyle = gr;
      g.fillRect(x - 14, y - 14, 28, 28);
    }
    let x = w - 2, y = 3; // the crack, in from the top right corner
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < 9; i++) { x -= 4 + r() * 6; y += 2 + r() * 4; g.lineTo(x, y); }
    g.strokeStyle = 'rgba(236,236,230,0.55)';
    g.lineWidth = 1;
    g.stroke();
  });
}

/** A torch's black anodised aluminium, worn: faint scuffs and the bare metal showing at a few nicks. */
export function torchAluTex(seed = 621) {
  const r = mulberry32(seed);
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#1c1d20';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { // scuffs, along it and across
      g.strokeStyle = `rgba(150,150,155,${0.04 + r() * 0.08})`;
      g.lineWidth = 0.6 + r();
      const x = r() * w, y = r() * h, a = (r() - 0.5) * 0.6 + (r() < 0.5 ? 0 : Math.PI / 2), l = 4 + r() * 22;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 9; i++) { // nicks to the bare metal
      g.fillStyle = `rgba(178,178,182,${0.5 + r() * 0.4})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 0.8 + r() * 2, 0.6 + r() * 1.2, r() * 3, 0, 7); g.fill();
    }
  }, { repeat: [1, 1] });
}

/** Knurling, as a bump map: a fine diamond grip cut into metal. */
export function knurlTex() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#000000';
    g.lineWidth = 3;
    for (let k = -2; k <= 2; k++) {
      g.beginPath(); g.moveTo(k * w, 0); g.lineTo(k * w + w, h); g.stroke(); g.beginPath(); g.moveTo(k * w + w / 2, 0); g.lineTo(k * w + w * 1.5, h); g.stroke();
      g.beginPath(); g.moveTo(k * w + w, 0); g.lineTo(k * w, h); g.stroke(); g.beginPath(); g.moveTo(k * w + w * 1.5, 0); g.lineTo(k * w + w / 2, h); g.stroke();
    }
  }, { repeat: [1, 1], data: true });
}

/**
 * What was washed down the basin, as it shows under a UV torch in the dark (user, 2026-10-15, after a
 * photo of a basin under one): a mask (white, its alpha the amount) seen from above over the bowl's
 * opening, 0.42 m across (u) by 0.28 m (v); the top of the picture is the back, under the tap. Nothing
 * even or centred: a wash left where it dried, heavier behind and to the left of the plug hole; a few
 * runs where the water carried it down, wandering, thinning; a broken line of drops from the spout; spots
 * flicked about on one side; the plug hole's rim; a smear where a hand wiped at it.
 */
export function basinTraceTex() {
  const r = mulberry32(611);
  return canvasTex(512, 342, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const px = w / 0.42, cx = w / 2 + 2, cy = h / 2 + 1; // pixels to a metre; the plug hole
    const spout = cy - 0.09 * px;
    const dot = (x, y, rad, a, core = 0.55) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(core, `rgba(255,255,255,${a * 0.85})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    };
    // the wash, where it dried: soft uneven patches, behind and left of the hole, one tongue down to it
    g.filter = 'blur(3px)';
    for (const [ox, oy, sx, sy, n, a] of [[-38, -26, 46, 22, 18, 0.15], [-4, -8, 22, 16, 9, 0.12], [52, 30, 20, 12, 6, 0.1]]) {
      for (let i = 0; i < n; i++) {
        const t = r() * Math.PI * 2, d = Math.sqrt(r());
        dot(cx + ox + Math.cos(t) * d * sx, cy + oy + Math.sin(t) * d * sy, 6 + r() * 16, a + r() * a, 0.3);
      }
    }
    // runs down the slopes towards the hole: few, wandering, wider where they started
    g.lineCap = g.lineJoin = 'round';
    g.filter = 'blur(0.8px)';
    const run = (x, y, width, alpha, bend) => {
      let x0 = x, y0 = y, k = 0;
      while (k++ < 60) {
        const dx = cx - x0, dy = cy - y0, d = Math.hypot(dx, dy);
        if (d < 12) break;
        const step = 3 + r() * 3, side = bend * Math.min(1, d / 50) + (r() - 0.5) * 0.7;
        const x1 = x0 + (dx / d) * step - (dy / d) * side * step, y1 = y0 + (dy / d) * step + (dx / d) * side * step;
        g.strokeStyle = `rgba(255,255,255,${alpha * (0.6 + 0.4 * r())})`;
        g.lineWidth = Math.max(1, width * (0.35 + 0.65 * Math.min(1, d / 70)));
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        if (r() < 0.06) dot(x1, y1, width * 1.2, alpha * 0.8); // where it hung a moment
        x0 = x1; y0 = y1;
      }
    };
    run(cx - 6, spout + 6, 6, 0.6, 0.12); // from under the tap
    run(cx - 0.09 * px, cy - 0.05 * px, 5, 0.5, -0.3); // down the left slope from the wash
    run(cx - 0.12 * px, cy + 0.01 * px, 3.5, 0.4, 0.2);
    run(cx + 0.07 * px, cy - 0.065 * px, 2.5, 0.35, 0.35); // a thin one on the right
    // the drops from the spout: a broken line down the back slope
    g.filter = 'none';
    for (let y = spout + 2; y < cy - 14; y += 4 + r() * 10) dot(cx - 2 + (r() - 0.5) * 7, y, 1.4 + r() * 2.4, 0.7 + r() * 0.3);
    // round the hole's rim, more on the left
    for (let i = 0; i < 22; i++) {
      const a = Math.PI * (0.4 + r() * 1.3), d = 0.019 * px + (r() - 0.3) * 5;
      dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.5 + r() * 3.5, 0.3 + r() * 0.45);
    }
    // spots flicked about, nearly all to the right and in front, a few far up the side
    for (let i = 0; i < 34; i++) {
      const a = -0.9 + r() * 2.3, d = (0.03 + r() ** 0.8 * 0.13) * px;
      const x = cx + 14 + Math.cos(a) * d * 1.3, y = cy + Math.sin(a) * d * 0.75;
      if (x < 6 || x > w - 6 || y < 6 || y > h - 6) continue;
      dot(x, y, 0.7 + r() ** 2.5 * 3.2, 0.5 + r() * 0.5, 0.7);
    }
    // a smear on the front slope, left: something wiped across it, fingers dragging
    g.save();
    g.translate(cx - 0.085 * px, cy + 0.07 * px);
    g.rotate(-0.3);
    g.filter = 'blur(1.5px)';
    for (let f = 0; f < 4; f++) {
      g.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.12})`;
      g.lineWidth = 3 + r() * 3;
      g.beginPath();
      g.moveTo(-30, f * 7 - 10);
      g.bezierCurveTo(-8, f * 7 - 16 + r() * 4, 14, f * 7 - 4, 34 + r() * 8, f * 7 - 12 + r() * 6);
      g.stroke();
    }
    g.restore();
    g.filter = 'none';
  });
}

/**
 * What is on a window's glass, `w` × `h` metres (user, 2026-10-15: it must read as glass): a faint haze
 * all over; dust gathered along the bottom and into the corners; dried rain spots, some with a run under
 * them, more up top where the rain hit; a wipe that only moved the dirt about; and a few small greasy
 * smudges low down on the lower half, where a child's hands go. Colour with its own alpha (for a
 * transparent, unlit layer).
 */
export function windowDirtTex(w, h, seed = 741, { halves = 2, veil = 0.07, rain = true, worn = 0 } = {}) {
  const r = mulberry32(seed);
  const W = 512, H = Math.round((512 * h) / w), px = W / w;
  return canvasTex(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = `rgba(206,202,192,${veil})`; // (the film over all of it)
    g.fillRect(0, 0, W, H);
    // dust settled along the bottom of each half (a sash window's meet in the middle; a door's one pane has one
    // bottom — user, 2026-10-23: the middle's line of dust lay across the back door's glass, a stripe) and in the corners
    for (const [y0, y1, a] of halves > 1 ? [[H, H * 0.76, 0.22], [H * 0.5 + 6, H * 0.36, 0.11]] : [[H, H * 0.76, 0.22]]) {
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, `rgba(190,184,170,${a})`);
      gr.addColorStop(1, 'rgba(190,184,170,0)');
      g.fillStyle = gr;
      g.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
    }
    // and in a thin line along every edge of the glass, where the cloth never reached
    const edge = (x0, y0, x1, y1, a) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, `rgba(180,174,160,${a})`);
      gr.addColorStop(1, 'rgba(180,174,160,0)');
      g.fillStyle = gr;
      g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) || W, Math.abs(y1 - y0) || H);
    };
    const e = 0.03 * px;
    edge(0, 0, e, 0, 0.22); edge(W, 0, W - e, 0, 0.22); // the sides
    for (const y of halves > 1 ? [0, H / 2] : [0]) edge(0, y, 0, y + e, 0.16); // under the top of each half
    for (const y of halves > 1 ? [H / 2, H] : [H]) edge(0, y, 0, y - e * 1.4, 0.26); // along the bottom of each half
    // dried rain: spots with a pale rim, more towards the top; now and then one that ran (not on glass indoors)
    for (let i = 0; i < (rain ? 300 : 0); i++) {
      const x = r() * W, y = H * r() ** 1.6, rad = 0.7 + r() ** 3 * 2.6, a = 0.14 + r() * 0.26;
      g.fillStyle = `rgba(214,212,204,${a * 0.6})`;
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(220,218,210,${a})`;
      g.lineWidth = 0.6;
      g.stroke();
      if (r() < 0.05) {
        g.strokeStyle = `rgba(214,212,204,${a * 0.5})`;
        g.lineWidth = 0.8 + r();
        g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (r() - 0.5) * 3, y + 15, x + (r() - 0.5) * 4, y + 30, x + (r() - 0.5) * 5, y + 20 + r() * 50); g.stroke();
      }
    }
    // a wipe, once, that smeared more than it cleaned: the cloth's streaks, fine curved lines side by side
    g.lineCap = 'butt';
    for (let k = 0; k < 2; k++) {
      const ox = W * (0.35 + k * 0.27), oy = H * (0.97 + r() * 0.08), rad = H * (0.33 + r() * 0.08), a0 = Math.PI * (1.15 + r() * 0.08), a1 = Math.PI * (1.7 + r() * 0.08);
      for (let i = 0; i < 12; i++) {
        g.strokeStyle = `rgba(200,196,186,${0.025 + r() * 0.045})`;
        g.lineWidth = 0.6 + r() * 1.4;
        const along = r() * 0.06;
        g.beginPath(); g.arc(ox, oy, rad + (i - 6) * 1.8 + (r() - 0.5), a0 + along, a1 - along * 2); g.stroke();
      }
    }
    // small fingers, low on the lower half, to the right of the middle
    for (let i = 0; i < 6; i++) {
      const x = W * (0.6 + r() * 0.18), y = H - (0.12 + r() * 0.16) * px;
      g.save();
      g.translate(x, y);
      g.rotate((r() - 0.5) * 0.8);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 7);
      gr.addColorStop(0, 'rgba(210,204,192,0.18)');
      gr.addColorStop(1, 'rgba(210,204,192,0)');
      g.fillStyle = gr;
      g.scale(0.7, 1);
      g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // `worn` (a picture's glass, user, 2026-10-28): gone cloudy in from its edges, where the frame holds it and the
    // cloth never got — a band wider here and narrower there, thickest in the corners and along the bottom (dust
    // settles, fingers set it straight); fine scratches along it from a cloth worked round inside the frame; flecks
    if (worn > 0) {
      const wave = () => { const p = [r() * 6.3, r() * 6.3, r() * 6.3]; return (t) => 0.5 + 0.25 * Math.sin(t * 9 + p[0]) + 0.15 * Math.sin(t * 23 + p[1]) + 0.1 * Math.sin(t * 57 + p[2]); };
      const sides = [[[0, H], [W, H], [0, -1], 1.4], [[0, 0], [W, 0], [0, 1], 0.8], [[0, 0], [0, H], [1, 0], 1], [[W, 0], [W, H], [-1, 0], 1.1]]; // (from, to, inwards, how much: bottom, top, left, right)
      for (const [[x0, y0], [x1, y1], , k] of sides) {
        const depth = wave(), len = Math.hypot(x1 - x0, y1 - y0);
        for (let s = 0; s <= len; s += 2) {
          const corner = Math.max(0, 1 - Math.min(s, len - s) / (0.04 * px)), d = (0.005 + 0.016 * depth(s / len) * k + 0.012 * corner) * px;
          const x = x0 + ((x1 - x0) * s) / len, y = y0 + ((y1 - y0) * s) / len, gr = g.createRadialGradient(x, y, 0, x, y, d);
          gr.addColorStop(0, `rgba(196,190,178,${0.05 * worn})`);
          gr.addColorStop(0.6, `rgba(196,190,178,${0.018 * worn})`);
          gr.addColorStop(1, 'rgba(196,190,178,0)');
          g.fillStyle = gr;
          g.fillRect(x - d, y - d, 2 * d, 2 * d);
        }
      }
      g.lineCap = 'round';
      for (let i = 0; i < 16; i++) { // the scratches: along an edge, a little in from it, a hair curved
        const [[x0, y0], [x1, y1], [nx, ny]] = sides[Math.floor(r() * 4)], len = Math.hypot(x1 - x0, y1 - y0);
        const s = r() * len, l = (0.01 + r() * 0.04) * px, inn = (0.004 + r() ** 2 * 0.025) * px, tx = (x1 - x0) / len, ty = (y1 - y0) / len, bow = (r() - 0.5) * 0.006 * px;
        const ax = x0 + tx * s + nx * inn, ay = y0 + ty * s + ny * inn;
        g.strokeStyle = `rgba(222,218,208,${(0.12 + r() * 0.2) * worn})`;
        g.lineWidth = 0.5 + r() * 0.7;
        g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(ax + tx * l / 2 + nx * bow, ay + ty * l / 2 + ny * bow, ax + tx * l + nx * bow * 0.3, ay + ty * l + ny * bow * 0.3); g.stroke();
      }
      for (let i = 0; i < 60; i++) { // flecks, most of them near an edge
        const [[x0, y0], [x1, y1], [nx, ny]] = sides[Math.floor(r() * 4)], t = r(), inn = r() ** 2.5 * 0.05 * px;
        g.fillStyle = `rgba(206,200,188,${(0.15 + r() * 0.3) * worn})`;
        g.beginPath(); g.arc(x0 + (x1 - x0) * t + nx * inn, y0 + (y1 - y0) * t + ny * inn, 0.5 + r() * 1.2, 0, Math.PI * 2); g.fill();
      }
    }
  });
}

/**
 * An old stain on fabric (user, 2026-10-16: the sofa, "a couple of old dark stains"): an uneven blot gone
 * into the weave, darker in a tide-mark round its edge where it dried, a run or two out of it. Dark brown
 * with its own alpha, transparent all round the edge (for a decal).
 */
export function stainTex(seed = 801) {
  const r = mulberry32(seed);
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = w * 0.3;
    // its outline: a wobbly ring of points
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, k = 0.72 + r() * 0.42 + Math.sin(a * 3 + r()) * 0.08;
      pts.push([cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k * (0.75 + r() * 0.1)]);
    }
    const blot = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    g.filter = 'blur(3px)';
    g.fillStyle = 'rgba(38,22,12,0.42)';
    blot(); g.fill();
    g.filter = 'blur(1.2px)';
    g.strokeStyle = 'rgba(30,16,8,0.55)'; // the tide-mark
    g.lineWidth = 3;
    blot(); g.stroke();
    g.filter = 'blur(2px)';
    for (let k = 0; k < 2; k++) { // where it ran a little
      const [x, y] = pts[Math.floor(r() * pts.length)];
      g.fillStyle = 'rgba(38,22,12,0.3)';
      g.beginPath(); g.ellipse(x + (x - cx) * 0.15, y + (y - cy) * 0.15, 4 + r() * 5, 3 + r() * 3, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.filter = 'none';
  });
}

/** Where fabric has been sat on and leaned on for years: the nap flattened and a little lighter, uneven, fading out at its edges (for a decal). */
export function wornNapTex(seed = 811) {
  const r = mulberry32(seed);
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.filter = 'blur(6px)';
    for (let i = 0; i < 18; i++) {
      const x = w * (0.25 + r() * 0.5), y = h * (0.25 + r() * 0.5), rad = w * (0.1 + r() * 0.15);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(196,170,146,${0.14 + r() * 0.12})`);
      gr.addColorStop(1, 'rgba(196,170,146,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
    g.filter = 'none';
    for (let i = 0; i < 90; i++) { // pills of fibre
      const x = w * (0.2 + r() * 0.6), y = h * (0.2 + r() * 0.6);
      g.fillStyle = `rgba(${r() < 0.5 ? '205,186,166' : '90,66,50'},0.35)`;
      g.fillRect(x, y, 1.2, 1.2);
    }
  });
}

/**
 * A longcase clock's dial (user, 2026-10-28: "less fake, realistic, old and lived-in" — it was a clean white face
 * and a smiling moon): a country maker's painted iron dial of about 1810, a break arch over a square (the arch
 * narrower, on shoulders). A faded painted scene in the arch, roses in the corners, Roman hours and the minutes in
 * figures outside them, a seconds dial, a date in its window, two winding holes ringed with the key's scratches; the
 * ground gone the yellow of old varnish and smoke, darkest up top, crazed all over, the paint flaked off down to the
 * iron at the edges and round the holes, a hand that once rubbed on it, fly specks. 1024 × 1359 for 0.3 × 0.398 m
 * (`DIAL`, below: the shape it is cut to in fixtures.js).
 */
export const DIAL = { w: 0.3, sq: 0.3, arch: 0.098, mid: 0.15, holes: [[-0.044, 0.122], [0.044, 0.122]], seconds: [0, 0.212], date: [0, 0.096] };
export function clockDialTex() {
  const r = mulberry32(821), PX = 1024 / DIAL.w;
  return canvasTex(1024, Math.round((DIAL.sq + DIAL.arch) * PX), (g, w, h) => {
    const X = (m) => w / 2 + m * PX, Y = (m) => h - m * PX, L = (m) => m * PX;
    const cx = X(0), cy = Y(DIAL.mid), sq = Y(DIAL.sq), ar = L(DIAL.arch);
    // the ground: white lead gone ivory, warmer and darker towards the edges
    g.fillStyle = '#e2d4ae';
    g.fillRect(0, 0, w, h);
    let gr = g.createRadialGradient(cx, cy, L(0.06), cx, cy, L(0.24));
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(110,80,40,0.28)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { // its brushwork, uneven
      const x = r() * w, y = r() * h;
      g.fillStyle = r() < 0.5 ? `rgba(255,248,225,${0.04 + r() * 0.06})` : `rgba(120,95,55,${0.03 + r() * 0.05})`;
      g.beginPath(); g.ellipse(x, y, 6 + r() * 30, 2 + r() * 6, (r() - 0.5) * 0.6, 0, Math.PI * 2); g.fill();
    }
    // the arch: a faded scene, a cottage under a tree on a hill, the sky gone to cream
    g.save();
    g.beginPath(); g.arc(cx, sq, ar - 6, Math.PI, 0); g.closePath(); g.clip();
    gr = g.createLinearGradient(0, sq - ar, 0, sq);
    gr.addColorStop(0, '#9aa3a0');
    gr.addColorStop(0.55, '#c9c3a4');
    gr.addColorStop(1, '#d9caa0');
    g.fillStyle = gr;
    g.fillRect(cx - ar, sq - ar, 2 * ar, ar);
    const hill = (y0, amp, col, seed) => {
      g.fillStyle = col;
      g.beginPath(); g.moveTo(cx - ar, sq);
      for (let x = -ar; x <= ar; x += 8) g.lineTo(cx + x, sq - y0 - amp * Math.sin(x / ar * 2.2 + seed) - amp * 0.4 * Math.sin(x / ar * 5 + seed * 2));
      g.lineTo(cx + ar, sq); g.closePath(); g.fill();
    };
    hill(ar * 0.42, ar * 0.08, 'rgba(128,140,118,0.85)', 1);
    hill(ar * 0.22, ar * 0.1, 'rgba(112,118,72,0.9)', 3);
    hill(ar * 0.08, ar * 0.05, 'rgba(126,120,70,0.95)', 5);
    const hx = cx - ar * 0.25, hy = sq - ar * 0.26; // the cottage
    g.fillStyle = '#d8ceb2'; g.fillRect(hx, hy - 34, 70, 34);
    g.fillStyle = '#6e4a36';
    g.beginPath(); g.moveTo(hx - 8, hy - 32); g.lineTo(hx + 35, hy - 58); g.lineTo(hx + 78, hy - 32); g.closePath(); g.fill();
    g.fillStyle = '#4a3a30'; g.fillRect(hx + 12, hy - 22, 10, 10); g.fillRect(hx + 44, hy - 22, 10, 10); g.fillRect(hx + 30, hy - 18, 9, 18);
    g.fillStyle = '#5e4a3e'; g.fillRect(hx + 52, hy - 66, 8, 14);
    g.fillStyle = '#4a3a2a'; g.fillRect(cx + ar * 0.3, sq - ar * 0.5, 9, ar * 0.32); // the tree
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = r() * 42;
      g.fillStyle = `rgba(${60 + r() * 30},${80 + r() * 30},${45 + r() * 20},0.75)`;
      g.beginPath(); g.arc(cx + ar * 0.3 + 4 + Math.cos(a) * d, sq - ar * 0.62 + Math.sin(a) * d * 0.8, 14 + r() * 12, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 5; i++) { // birds, far off
      const bx = cx - ar * 0.6 + r() * ar * 1.1, by = sq - ar * (0.72 + r() * 0.15);
      g.strokeStyle = 'rgba(70,64,56,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(bx - 7, by); g.quadraticCurveTo(bx - 3, by - 5, bx, by); g.quadraticCurveTo(bx + 3, by - 5, bx + 7, by); g.stroke();
    }
    g.restore();
    g.strokeStyle = '#b39553'; g.lineWidth = 5; // (a gilt line round it)
    g.beginPath(); g.arc(cx, sq, ar - 6, Math.PI, 0); g.stroke();
    g.strokeStyle = '#3a2c1c'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - ar + 6, sq); g.lineTo(cx + ar - 6, sq); g.stroke();
    // the corners: a rose, buds, leaves, in faded colour; gilt scrolls on the shoulders of the arch
    const rose = (x, y, s, turn) => {
      g.save(); g.translate(x, y); g.rotate(turn); g.scale(s, s);
      for (const [lx, ly, la] of [[-34, 18, 2.4], [30, 22, 0.7], [4, -36, -1.4], [-30, -20, -2.4]]) {
        g.fillStyle = 'rgba(88,108,64,0.8)';
        g.beginPath(); g.ellipse(lx, ly, 22, 9, la, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(60,72,44,0.7)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(lx - Math.cos(la) * 20, ly - Math.sin(la) * 20); g.lineTo(lx + Math.cos(la) * 20, ly + Math.sin(la) * 20); g.stroke();
      }
      g.fillStyle = 'rgba(168,74,62,0.85)'; g.beginPath(); g.arc(0, 0, 21, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        g.strokeStyle = 'rgba(222,160,140,0.75)'; g.lineWidth = 3;
        g.beginPath(); g.arc(Math.cos(a) * 7, Math.sin(a) * 7, 12, a + 0.6, a + 2.3); g.stroke();
      }
      g.fillStyle = 'rgba(120,40,36,0.8)'; g.beginPath(); g.arc(2, 1, 6, 0, Math.PI * 2); g.fill();
      for (const [bx, by] of [[40, -10], [-12, 40]]) { g.fillStyle = 'rgba(176,90,80,0.8)'; g.beginPath(); g.ellipse(bx, by, 7, 10, 0.5, 0, Math.PI * 2); g.fill(); }
      g.restore();
    };
    rose(X(-0.118), Y(0.032), 1.05, 0.3);
    rose(X(0.118), Y(0.032), 1, -0.4);
    rose(X(-0.118), Y(0.268), 0.95, 2.6);
    rose(X(0.12), Y(0.27), 1.05, -2.5);
    g.strokeStyle = 'rgba(176,148,84,0.8)'; g.lineWidth = 3;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(X(s * 0.104), sq - 6);
      g.bezierCurveTo(X(s * 0.115), sq - 50, X(s * 0.14), sq - 30, X(s * 0.135), sq - 12); g.stroke();
      g.beginPath(); g.arc(X(s * 0.13), sq - 22, 9, 0, Math.PI * 1.6); g.stroke();
    }
    // the chapter ring: the minute track and its figures, the hours
    const ink = '#211910';
    const at = (rad, a) => [cx + Math.sin(a) * L(rad), cy - Math.cos(a) * L(rad)];
    g.strokeStyle = ink;
    for (const [rad, lw] of [[0.1285, 3], [0.1195, 2], [0.088, 2]]) { g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, L(rad), 0, Math.PI * 2); g.stroke(); }
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, [x0, y0] = at(0.1195, a), [x1, y1] = at(0.1285, a);
      g.lineWidth = i % 5 ? 2 : 4;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    for (let i = 0; i < 12; i++) { // half-hour marks: a small fleur between the hours
      const a = ((i + 0.5) / 12) * Math.PI * 2, [x, y] = at(0.112, a);
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = ink;
      g.beginPath(); g.moveTo(0, -9); g.quadraticCurveTo(5, -2, 0, 7); g.quadraticCurveTo(-5, -2, 0, -9); g.fill();
      g.restore();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ink;
    ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((t, i) => {
      const a = (i / 12) * Math.PI * 2, [x, y] = at(0.1035, a);
      g.save(); g.translate(x, y); g.rotate(a); g.scale(0.78, 1);
      g.font = `${Math.round(L(0.0175))}px "Times New Roman", Georgia, serif`;
      g.fillText(t, 0, 0);
      g.restore();
    });
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2, [x, y] = at(0.1365, a);
      g.save(); g.translate(x, y); g.rotate(a);
      g.font = `${Math.round(L(0.0085))}px "Times New Roman", Georgia, serif`;
      g.fillText(String(i * 5), 0, 0);
      g.restore();
    }
    // the seconds, over the middle
    {
      const [sx, sy] = [X(DIAL.seconds[0]), Y(DIAL.seconds[1])];
      g.lineWidth = 1.5;
      for (const rad of [0.024, 0.0205]) { g.beginPath(); g.arc(sx, sy, L(rad), 0, Math.PI * 2); g.stroke(); }
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, k = i % 5 ? 0.0215 : 0.0195;
        g.beginPath(); g.moveTo(sx + Math.sin(a) * L(k), sy - Math.cos(a) * L(k)); g.lineTo(sx + Math.sin(a) * L(0.024), sy - Math.cos(a) * L(0.024)); g.stroke();
      }
      g.font = `${Math.round(L(0.0045))}px "Times New Roman", Georgia, serif`;
      for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; g.fillText(String(i * 10), sx + Math.sin(a) * L(0.0155), sy - Math.cos(a) * L(0.0155)); }
    }
    // the date, in its window: the wheel behind, the cut's edge shadowed
    {
      const [dx, dy] = [X(DIAL.date[0]), Y(DIAL.date[1])], dw = L(0.014), dh = L(0.0095);
      g.fillStyle = '#cdbf98'; g.fillRect(dx - dw / 2, dy - dh / 2, dw, dh);
      gr = g.createLinearGradient(0, dy - dh / 2, 0, dy - dh / 2 + 10);
      gr.addColorStop(0, 'rgba(30,22,12,0.7)'); gr.addColorStop(1, 'rgba(30,22,12,0)');
      g.fillStyle = gr; g.fillRect(dx - dw / 2, dy - dh / 2, dw, dh);
      g.fillStyle = ink; g.font = `${Math.round(L(0.0068))}px "Times New Roman", Georgia, serif`;
      g.fillText('17', dx + 2, dy + 3);
      g.strokeStyle = '#3a2c1c'; g.lineWidth = 2.5; g.strokeRect(dx - dw / 2, dy - dh / 2, dw, dh);
    }
    // the maker, in a fine hand under the middle, half of it gone
    g.fillStyle = 'rgba(33,25,16,0.85)';
    g.font = `italic ${Math.round(L(0.0075))}px "Times New Roman", Georgia, serif`;
    g.fillText('Thos. Lumb', cx, Y(0.064));
    g.font = `italic ${Math.round(L(0.0058))}px "Times New Roman", Georgia, serif`;
    g.fillText('Halifax', cx, Y(0.053));
    // varnish gone yellow, and smoke: darkest at the top
    gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(120,80,30,0.32)');
    gr.addColorStop(0.45, 'rgba(160,120,50,0.16)');
    gr.addColorStop(1, 'rgba(140,100,40,0.2)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // crazing: a fine net of cracks all over, tighter where the paint is thickest
    for (let i = 0; i < 520; i++) {
      let x = r() * w, y = r() * h;
      g.strokeStyle = `rgba(70,50,25,${0.12 + r() * 0.2})`; g.lineWidth = 0.8 + r() * 0.7;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3 + r() * 4; k++) { x += (r() - 0.5) * 34; y += (r() - 0.5) * 34; g.lineTo(x, y); }
      g.stroke();
    }
    // the key's scratches round the winding holes (ten thousand windings, the key missing the hole), and the holes
    for (const [hx, hy] of DIAL.holes) {
      const x = X(hx), y = Y(hy);
      gr = g.createRadialGradient(x, y, L(0.004), x, y, L(0.016));
      gr.addColorStop(0, 'rgba(60,44,24,0.45)'); gr.addColorStop(1, 'rgba(60,44,24,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, L(0.016), 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 70; k++) {
        const rad = L(0.0055 + r() * 0.009), a0 = r() * Math.PI * 2;
        g.strokeStyle = r() < 0.6 ? `rgba(60,48,36,${0.2 + r() * 0.35})` : `rgba(250,240,215,${0.15 + r() * 0.2})`;
        g.lineWidth = 0.7 + r() * 1.2;
        g.beginPath(); g.arc(x, y, rad, a0, a0 + 0.2 + r() * 1.1); g.stroke();
      }
    }
    // paint gone: flakes off to the iron (dark, a rust rim), most at the edges, the arch's rim and round the holes
    const flake = (x, y, s) => {
      const n = 7 + Math.floor(r() * 6), pts = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, d = s * (0.5 + r() * 0.7); pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * (0.6 + r() * 0.6)]); }
      g.fillStyle = 'rgba(122,78,44,0.85)';
      g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill();
      g.fillStyle = 'rgba(52,46,40,0.95)';
      g.beginPath(); pts.forEach(([px, py], k) => { const qx = x + (px - x) * 0.75, qy = y + (py - y) * 0.75; k ? g.lineTo(qx, qy) : g.moveTo(qx, qy); }); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,246,222,0.35)'; g.lineWidth = 1.2; // (the lifted edge of the paint round it)
      g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.stroke();
    };
    for (let i = 0; i < 46; i++) { // along the edges
      const side = r(), t = r();
      const [x, y] = side < 0.3 ? [t * w, h - r() * 14] : side < 0.5 ? [r() * 14, sq + t * (h - sq)] : side < 0.7 ? [w - r() * 14, sq + t * (h - sq)] : side < 0.85 ? [cx + Math.cos(Math.PI + t * Math.PI) * (ar - r() * 12), sq + Math.sin(Math.PI + t * Math.PI) * (ar - r() * 12)] : [r() < 0.5 ? r() * (cx - ar) : w - r() * (cx - ar), sq + r() * 14];
      flake(x, y, 4 + r() * 13);
    }
    for (const [hx, hy] of DIAL.holes) for (let i = 0; i < 4; i++) { const a = r() * Math.PI * 2, d = L(0.006 + r() * 0.004); flake(X(hx) + Math.cos(a) * d, Y(hy) + Math.sin(a) * d, 3 + r() * 6); }
    for (let i = 0; i < 9; i++) flake(r() * w, sq + r() * (h - sq), 2 + r() * 7);
    flake(X(-0.06), Y(0.33), 16); flake(X(0.03), Y(0.37), 9); // (two off the scene: its sky)
    // a hand, bent once, rubbed an arc into the paint before someone set it straight
    g.strokeStyle = 'rgba(250,240,214,0.35)'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, L(0.074), -2.4, -0.9); g.stroke();
    g.strokeStyle = 'rgba(70,52,30,0.25)'; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, L(0.0752), -2.3, -1.0); g.stroke();
    // fly specks, and the dark round the edge where the hood has sat on it
    for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(40,30,18,${0.4 + r() * 0.4})`; g.beginPath(); g.arc(r() * w, r() * h, 0.8 + r() * 1.6, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(60,42,20,0.35)'; g.lineWidth = 14;
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, sq); g.lineTo(cx - ar, sq); g.arc(cx, sq, ar, Math.PI, 0); g.lineTo(w, sq); g.lineTo(w, h); g.closePath(); g.stroke();
  });
}

/**
 * A longcase clock's case wood: oak gone near black-brown with two hundred years of wax and smoke, the grain
 * lengthwise (up the texture), the oak's silver flecks dulled to brown, a fine scratch or two. Repeats every
 * 0.6 m: the clock gives its pieces UVs in metres.
 */
export function clockCaseTex() {
  const r = mulberry32(8611);
  const t = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#66472e';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { // broad streaks of tone, along the grain
      const x = r() * w;
      g.fillStyle = r() < 0.5 ? `rgba(30,18,10,${0.08 + r() * 0.14})` : `rgba(110,76,46,${0.06 + r() * 0.1})`;
      g.fillRect(x, 0, 4 + r() * 26, h);
    }
    for (let i = 0; i < 300; i++) { // the grain: long, wavering lines up it
      let x = r() * w;
      g.strokeStyle = `rgba(24,14,8,${0.15 + r() * 0.3})`; g.lineWidth = 0.6 + r() * 1.4;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 16) { x += (r() - 0.5) * 2.2; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 160; i++) { // the oak's rays: short pale flecks across the grain
      const x = r() * w, y = r() * h;
      g.fillStyle = `rgba(122,88,56,${0.18 + r() * 0.2})`;
      g.beginPath(); g.ellipse(x, y, 1 + r() * 2.5, 3 + r() * 10, (r() - 0.5) * 0.3, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 14; i++) { // a fine scratch or two, paler: the same wood under its dark wax
      const x = r() * w, y = r() * h, a = r() * Math.PI, l = 10 + r() * 40;
      g.strokeStyle = `rgba(128,92,60,${0.25 + r() * 0.25})`; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.6, 1 / 0.6);
  return t;
}

/**
 * Wear on old dark wood, as a decal (transparent round it): the wax rubbed through to paler, duller wood of the same
 * brown in a patch, and scratches and small dents in it. `kind`: 'kicks' (along the bottom edge: shoes, the
 * hoover — the scratches mostly across, the dents many), 'hands' (round a keyhole or a door's edge: a soft rub,
 * scratches every way, short).
 */
export function woodRubTex(kind = 'hands', seed = 8621) {
  const r = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const kicks = kind === 'kicks';
    const rub = g.createRadialGradient(w / 2, kicks ? h * 0.85 : h / 2, 4, w / 2, kicks ? h * 0.85 : h / 2, w * 0.5);
    rub.addColorStop(0, 'rgba(140,102,66,0.6)');
    rub.addColorStop(0.6, 'rgba(128,92,58,0.3)');
    rub.addColorStop(1, 'rgba(128,92,58,0)');
    g.fillStyle = rub;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < (kicks ? 70 : 45); i++) {
      const x = w * (0.1 + r() * 0.8), y = kicks ? h * (0.55 + r() * 0.42) : h * (0.15 + r() * 0.7);
      const a = kicks ? (r() - 0.5) * 0.5 : r() * Math.PI, l = kicks ? 8 + r() * 40 : 4 + r() * 16;
      g.strokeStyle = `rgba(${160 + r() * 30},${118 + r() * 24},${78 + r() * 20},${0.4 + r() * 0.4})`; g.lineWidth = 0.8 + r() * 1.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < (kicks ? 26 : 6); i++) { // dents: a dark crush with a pale lip
      const x = w * (0.1 + r() * 0.8), y = kicks ? h * (0.6 + r() * 0.38) : h * (0.2 + r() * 0.6), s = 1.5 + r() * 3.5;
      g.fillStyle = 'rgba(30,18,10,0.5)'; g.beginPath(); g.ellipse(x, y, s * 1.6, s, r() * 3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(150,110,72,0.4)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y - 1, s * 1.8, s * 1.1, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
  });
}

/** Cigarette ash in the bottom of an ashtray: grey and black, flaky, a few darker burnt bits. Its own alpha, ragged at the edge. */
export function ashTex(seed = 831) {
  const r = mulberry32(seed);
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * w * 0.42, x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d;
      const v = 70 + Math.floor(r() * 110);
      g.fillStyle = `rgba(${v},${v},${v - 4},${0.35 + r() * 0.5})`;
      g.beginPath(); g.ellipse(x, y, 1 + r() * 3.5, 1 + r() * 2, r() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(20,18,16,0.6)'; g.fillRect(w / 2 + (r() - 0.5) * w * 0.6, h / 2 + (r() - 0.5) * h * 0.6, 2, 2); }
  });
}

/** A thread of smoke: a thin line wavering up, widening and thinning out as it rises (v up), its own alpha. */
export function smokeTex() {
  return canvasTex(64, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let y = h; y >= 0; y -= 4) {
        const up = 1 - y / h, x = w / 2 + Math.sin(up * 9 + k * 2) * up * 14 + Math.sin(up * 23 + k) * up * up * 6;
        if (y === h) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = `rgba(225,225,222,${0.5 - k * 0.12})`;
      g.lineWidth = 2 + k * 2;
      g.filter = `blur(${1 + k * 1.5}px)`;
      g.stroke();
    }
    g.filter = 'none';
    // fading out at the top and from nothing at the bottom
    g.globalCompositeOperation = 'destination-in';
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.45, 'rgba(0,0,0,0.6)');
    gr.addColorStop(0.92, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0.2)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  });
}

// ---------------------------------------------------------------- the grove (grove.js; user, 2026-10-17)

/** A lattice of random values for `pnoise`, 256 by 256. */
function lattice(seed) {
  const r = mulberry32(seed), v = new Float32Array(65536);
  for (let i = 0; i < v.length; i++) v[i] = r();
  return v;
}
/** Value noise that repeats every `px` by `py` (whole numbers up to 256). */
function pnoise(L, x, y, px, py) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = L[(y0 & 255) * 256 + (x0 & 255)], b = L[(y0 & 255) * 256 + (x1 & 255)], c = L[(y1 & 255) * 256 + (x0 & 255)], d = L[(y1 & 255) * 256 + (x1 & 255)]; // (a period over 256: the lattice twice over)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
/** Fractal noise over a tile, u and v 0…1, `fx` × `fy` cells across it at the coarsest: 0…1, repeating with the tile. */
function pfbm(L, u, v, fx, fy, oct = 4) {
  let s = 0, amp = 0.5, n = 0;
  for (let o = 0; o < oct; o++) { s += amp * pnoise(L, u * fx, v * fy, fx, fy); n += amp; amp *= 0.5; fx *= 2; fy *= 2; }
  return s / n;
}

/**
 * Cells over a tile `TW` by `TH` metres that repeats: `cx` × `cy` of them, one seed point each, jittered.
 * `at(x, y)` (metres) → [F1, F2, dy to the nearest seed, its number], distances measured with y squeezed by `stretch`
 * (cells drawn out up the trunk).
 */
function cells(seed, cx, cy, TW, TH, stretch = 1) {
  const r = mulberry32(seed), pts = new Float32Array(cx * cy * 2), cw = TW / cx, ch = TH / cy;
  for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) { pts[(j * cx + i) * 2] = (i + 0.1 + r() * 0.8) * cw; pts[(j * cx + i) * 2 + 1] = (j + 0.1 + r() * 0.8) * ch; }
  const out = [0, 0, 0, 0], RI = Math.ceil(ch / stretch / cw) + 1, RJ = Math.ceil((cw * stretch) / ch) + 1; // how many cells round to look, either way
  const inv = 1 / (stretch * stretch);
  return (x, y) => {
    x -= Math.floor(x / TW) * TW;
    y -= Math.floor(y / TH) * TH;
    const ci = Math.floor(x / cw), cj = Math.floor(y / ch);
    let f1 = 1e9, f2 = 1e9, dyn = 0, kn = 0;
    for (let dj = -RJ; dj <= RJ; dj++) {
      let j = cj + dj, oy = 0;
      if (j < 0) { j += cy; oy = -TH; } else if (j >= cy) { j -= cy; oy = TH; }
      const row = j * cx;
      for (let di = -RI; di <= RI; di++) {
        let i = ci + di, ox = 0;
        if (i < 0) { i += cx; ox = -TW; } else if (i >= cx) { i -= cx; ox = TW; }
        const k = (row + i) * 2, dx = pts[k] + ox - x, dy = pts[k + 1] + oy - y, d = dx * dx + dy * dy * inv;
        if (d < f1) { f2 = f1; f1 = d; dyn = dy; kn = row + i; } else if (d < f2) f2 = d;
      }
    }
    out[0] = Math.sqrt(f1); out[1] = Math.sqrt(f2); out[2] = dyn; out[3] = kn;
    return out;
  };
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const BARK = {};

/**
 * Bark for the grove's trees (user, 2026-10-18: "the bark is too basic, pattern and shape"), one tile 0.6 m
 * round by 1.2 m up, repeating both ways without a seam. Worked out first as heights, the way the bark is
 * built: 'oak' — thick blocky plates split by deep furrows and broken across, lichen on them; 'willow' — a
 * net of thick corky ridges round deep lens-shaped furrows; 'maple' — long shallow ridges crossing and
 * parting; 'birch' — chalky white, papery, its dark lenticels across it and a strip peeling, black
 * diamonds where twigs were; 'birchBase' — what an old birch's foot turns to, black and deeply fissured;
 * 'spruce' — small thin scales laid like shingles. From the heights: its colour, a normal map, and (blurred)
 * the heights themselves, for the trunk's own shape (grove.js). Kept: each is worked out once.
 */
export function groveBark(kind) {
  if (BARK[kind]) return BARK[kind];
  const OW = 512, OH = 1024, TW = 0.6, TH = 1.2, N = OW * OH;
  // the heights worked out at half that and blended up, but for the birch's fine marks (2.5 s for the six, at full size)
  const Q = kind === 'birch' ? 1 : 0.5, W = OW * Q, H = OH * Q, n = W * H;
  const seed = { oak: 401, birch: 402, spruce: 403, maple: 404, willow: 407, birchBase: 408 }[kind];
  const L = lattice(seed), r = mulberry32(seed + 9);
  const h = new Float32Array(n); // 0 deep … 1 proud
  const tone = new Float32Array(n); // a second value per pixel for the colour: lichen, a peeled strip, a scar
  // what changes slowly across the tile is worked out every few pixels and blended between (it was 2.5 s for the six)
  const field = (step, fn) => {
    const gw = W / step, gh = H / step, f = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) f[j * gw + i] = fn(i / gw, j / gh);
    return (x, y) => {
      const fx = x / step, fy = y / step, i0 = Math.floor(fx), j0 = Math.floor(fy), a = fx - i0, b = fy - j0, i1 = (i0 + 1) % gw, j1 = (j0 + 1) % gh, k0 = j0 * gw, k1 = j1 * gw;
      return f[k0 + i0] * (1 - a) * (1 - b) + f[k0 + i1] * a * (1 - b) + f[k1 + i0] * (1 - a) * b + f[k1 + i1] * a * b;
    };
  };
  const warpOf = (ax, ay, f) => [field(8, (u, v) => (pfbm(L, u, v, f, f * 2, 3) - 0.5) * ax), field(8, (u, v) => (pfbm(L, u + 0.37, v + 0.71, f, f * 2, 3) - 0.5) * ay)];
  const toneOf = field(4, (u, v) => pfbm(L, u + 0.21, v + 0.13, 5, 10, 4)); // where lichen grows
  const hash = (k) => { const x = Math.sin(k * 12.9898 + seed) * 43758.5453; return x - Math.floor(x); };
  if (kind === 'oak') {
    // (user, 2026-10-18, two photographs of oak bark, for its look only) grey bark of narrow rough ridges that
    // part and meet again up the trunk, round long narrow dark furrows; the ridges' tops flaky and broken here
    // and there; lichen on them (below)
    const C = cells(seed + 11, 26, 5, TW, TH, 7), F = cells(seed + 12, 34, 30, TW, TH, 1.3); // (long narrow cells: the furrows long cracks close together, not pits)
    const [warpX, warpY] = warpOf(0.03, 0.04, 3), lump = field(4, (u, v) => pfbm(L, u + 0.5, v, 6, 12, 3));
    const breaks = field(2, (u, v) => pfbm(L, u * 1.0 + 0.7, v, 24, 8, 2));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H, wx = warpX(x, y), wy = warpY(x, y), py = v * TH + wy;
      let c = C(u * TW + wx, py);
      const edge = c[1] - c[0], ridge = 1 - smooth(0.01, 0.024, edge) ** 0.8; // the ridges: the net; the cells' insides the furrows, narrow, V-shaped
      c = F(u * TW + wx * 0.5, py);
      const flake = 1 - smooth(0.0, 0.0035, c[1] - c[0]); // small breaks across the ridges' tops
      const broken = smooth(0.62, 0.72, breaks(x, y)) * flake; // and here and there a ridge broken right through
      const fine = pnoise(L, x * 0.5, y * 0.5, W / 2, H / 2) - 0.5, finer = pnoise(L, x, y, W, H) - 0.5;
      const hh = ridge * (0.7 + 0.3 * lump(x, y)) * (1 - 0.5 * broken) - 0.12 * flake * ridge + (fine * 0.26 + finer * 0.12) * ridge;
      h[y * W + x] = Math.max(0, Math.min(1, hh));
      tone[y * W + x] = toneOf(x, y);
    }
  } else if (kind === 'birchBase' || kind === 'willow') {
    // long ridges standing proud, deep furrows between them, wavy, running up the trunk; here and there a
    // ridge broken across into blocks (the willow's: narrower, thick and corky, not broken, parting and meeting)
    const oak = kind === 'oak', willow = kind === 'willow';
    const C = oak ? cells(seed, 9, 2, TW, TH, 7) : willow ? cells(seed, 11, 2, TW, TH, 7.5) : cells(seed, 7, 5, TW, TH, 3.2); // (the oak's ridges long, side by side)
    const fur = oak ? 0.045 : willow ? 0.034 : 0.04, [warpX, warpY] = warpOf(0.03, 0.03, 3), lump = field(4, (u, v) => pfbm(L, u + 0.5, v, 6, 12, 3));
    const wiggle = field(2, (u, v) => (pfbm(L, u + 0.13, v + 0.4, 16, 32, 2) - 0.5) * 0.012);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H, wx = warpX(x, y), wy = warpY(x, y), py = v * TH + wy;
      const c = C(u * TW + wx, py), k = c[3];
      const plate = smooth(0.0, fur, c[1] - c[0]) ** 0.4; // (flat-topped, steep-sided)
      let crack = 0; // a ridge broken across, once or twice along it (some of them)
      if (!willow && hash(k * 7.1) < (oak ? 0.7 : 0.8)) for (let b = 0; b < (hash(k) < 0.4 ? 1 : oak ? 3 : 2); b++) {
        let d = py - hash(k + 0.37 * b + 0.5) * TH + wiggle(x, y);
        d -= Math.round(d / TH) * TH;
        crack = Math.max(crack, 1 - smooth(0.0015, 0.007, Math.abs(d)));
      }
      const streak = pnoise(L, x * 0.75, y * 0.0625, W * 0.75, H * 0.0625) - 0.5; // fine lines up the ridges
      const hh = plate * (0.7 + 0.3 * lump(x, y)) * (1 - crack * 0.7) + streak * 0.14 * plate + (pnoise(L, x * 0.5, y * 0.5, W / 2, H / 2) - 0.5) * 0.12 * plate; // (the plates' tops rough)
      h[y * W + x] = Math.max(0, Math.min(1, hh));
      tone[y * W + x] = toneOf(x, y);
    }
  } else if (kind === 'maple') {
    // a net: the cells' edges are the ridges, shallow; their insides the furrows, long lenses, the ridges
    // parting round them and meeting again
    const willow = false;
    const C = cells(seed, 16, 5, TW, TH, 6);
    const ridge = 0.016, [warpX, warpY] = warpOf(0.02, 0.03, 4), corkyOf = field(2, (u, v) => pfbm(L, u, v, 12, 24, 4));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = C((x / W) * TW + warpX(x, y), (y / H) * TH + warpY(x, y));
      const top = 1 - smooth(0, ridge, c[1] - c[0]); // on the ridge
      const streak = pnoise(L, x * 0.75, y * 0.0625, W * 0.75, H * 0.0625) - 0.5;
      let hh = top ** 0.7 * (0.72 + 0.35 * corkyOf(x, y)) + streak * 0.08 * top + (pnoise(L, x * 0.25, y * 0.25, W / 4, H / 4) - 0.5) * 0.08;
      if (!willow) hh = 0.3 + hh * 0.6;
      h[y * W + x] = Math.max(0, Math.min(1, hh));
      tone[y * W + x] = toneOf(x, y);
    }
  } else if (kind === 'spruce') {
    // scales: each a little plate, its lower edge lifted off the next one down (as shingles lie), each its own shade
    const C = cells(seed, 20, 34, TW, TH, 1.2), ch = TH / 34, [warpX, warpY] = warpOf(0.012, 0.024, 8);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = C((x / W) * TW + warpX(x, y), (y / H) * TH + warpY(x, y)), edge = c[1] - c[0];
      const lip = Math.min(1, Math.max(0, 0.5 - c[2] / ch)); // higher towards the scale's lower edge (rows run down the trunk: below its seed, dy < 0)
      h[y * W + x] = smooth(0, 0.0035, edge) * (0.45 + 0.55 * lip) * (0.85 + 0.3 * pnoise(L, x / 6, y / 6, W / 6, H / 6));
      tone[y * W + x] = hash(c[3]);
    }
  } else { // birch
    h.fill(0.55);
    const bands = field(2, (u, v) => pfbm(L, u, v, 4, 64, 3));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) h[y * W + x] += (bands(x, y) - 0.5) * 0.2; // papery bands round it
    const at = (x, y) => ((((y % H) + H) % H) * W + (((x % W) + W) % W));
    const dash = (x0, y0, len, th, depth, mark) => { // a lenticel, a scar: a dent, marked in `tone`
      for (let dy = -Math.ceil(th); dy <= Math.ceil(th); dy++) for (let dx = -Math.ceil(len / 2); dx <= Math.ceil(len / 2); dx++) {
        const q = (dx / (len / 2)) ** 2 + (dy / th) ** 2;
        if (q > 1) continue;
        const i = at(x0 + dx, y0 + dy);
        h[i] -= depth * (1 - q);
        tone[i] = Math.max(tone[i], mark * (1 - q * 0.6));
      }
    };
    for (let i = 0; i < 260; i++) dash(Math.floor(r() * W), Math.floor(r() * H), 8 + r() * (r() < 0.15 ? 120 : 50), 1.5 + r() * 2.8, 0.25, 1); // lenticels, across
    for (let i = 0; i < 7; i++) { // black scars where twigs were: a rough chevron, wider than tall, its edges torn
      const x0 = Math.floor(r() * W), y0 = Math.floor(r() * H), s = 10 + r() * 20, wide = 1.8 + r() * 1.2, droop = 0.3 + r() * 0.4;
      for (let dy = -s; dy <= s; dy++) for (let dx = -s * wide; dx <= s * wide; dx++) {
        const q = Math.abs(dx) / (s * wide), lift = dy / s + droop * q * q * 2 - droop; // (the wings bent down)
        if (Math.abs(lift) > (1 - q) * (0.75 + 0.5 * pnoise(L, (x0 + dx) * 0.25, (y0 + dy) * 0.25, W * 0.25, H * 0.25))) continue;
        const k = at(Math.round(x0 + dx), Math.round(y0 + dy)); h[k] -= 0.3; tone[k] = 2;
      }
    }
    for (let i = 0; i < 6; i++) { // strips of the paper peeling round it: ragged, wider here than there, warm under them, the curled edge dark
      const x0 = Math.floor(r() * W), y0 = Math.floor(r() * H), len = 50 + r() * 150, th = 5 + r() * 9;
      for (let dx = 0; dx < len; dx++) {
        const t = dx / len, w = th * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.5 * (0.7 + 0.6 * pnoise(L, (x0 + dx) * 0.0625, y0, W * 0.0625, H));
        for (let dy = 0; dy < w; dy++) { const k = at(x0 + dx, y0 + dy); tone[k] = 3; h[k] -= 0.12; }
        for (let dy = Math.floor(w); dy < w + 2; dy++) { const k = at(x0 + dx, y0 + dy); h[k] += 0.3; tone[k] = 4; }
      }
    }
  }
  // up to full size: the heights blended, a fine grain over them; the marks as they are
  let hO = h, toneO = tone;
  if (Q !== 1) {
    hO = new Float32Array(N);
    toneO = new Float32Array(N);
    for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
      const fx = x * Q, fy = y * Q, x0 = Math.floor(fx), y0 = Math.floor(fy), a = fx - x0, b = fy - y0, x1 = (x0 + 1) % W, y1 = (y0 + 1) % H;
      const v = h[y0 * W + x0] * (1 - a) * (1 - b) + h[y0 * W + x1] * a * (1 - b) + h[y1 * W + x0] * (1 - a) * b + h[y1 * W + x1] * a * b;
      hO[y * OW + x] = Math.max(0, Math.min(1, v + (pnoise(L, x * 0.5, y * 0.5, OW / 2, OH / 2) - 0.5) * 0.06));
      toneO[y * OW + x] = tone[y0 * W + x0];
    }
  }
  // the colour, from the heights: deep is dark; the tops of the plates catch the light and the weather
  const img = new Uint8ClampedArray(N * 4), mottOf = field(4, (u, v) => pfbm(L, u + 0.77, v + 0.19, 3, 6, 4));
  const pal = {
    oak: [[54, 50, 46], [102, 98, 92], [136, 132, 124]], // furrow, ridge, its weathered top: grey (his photographs), a little warm
    willow: [[50, 42, 35], [104, 95, 82], [128, 120, 106]],
    maple: [[64, 58, 51], [116, 109, 98], [136, 130, 120]],
    birchBase: [[22, 20, 19], [62, 58, 54], [96, 92, 86]],
    spruce: [[74, 56, 45], [112, 88, 71], [130, 108, 91]],
    birch: [[150, 146, 136], [206, 202, 190], [222, 219, 208]],
  }[kind];
  for (let i = 0; i < N; i++) {
    const x = i % OW, y = (i / OW) | 0, hh = hO[i], t = toneO[i];
    const k1 = smooth(0.05, 0.55, hh), k2 = smooth(0.6, 1, hh);
    let c0 = pal[0][0] + (pal[1][0] - pal[0][0]) * k1 + (pal[2][0] - pal[1][0]) * k2;
    let c1 = pal[0][1] + (pal[1][1] - pal[0][1]) * k1 + (pal[2][1] - pal[1][1]) * k2;
    let c2 = pal[0][2] + (pal[1][2] - pal[0][2]) * k1 + (pal[2][2] - pal[1][2]) * k2;
    const mott = (kind === 'oak' ? 0.68 + 0.6 * mottOf(x * Q, y * Q) : 0.82 + 0.36 * mottOf(x * Q, y * Q)), fine = 0.92 + 0.16 * pnoise(L, x * 0.5, y * 0.5, OW / 2, OH / 2);
    c0 *= mott * fine; c1 *= mott * fine; c2 *= mott * fine;
    if ((kind === 'oak' || kind === 'willow' || kind === 'maple') && t > 0.62 && hh > 0.4) { // lichen on the proud parts, grey-green, in small crusts
      const a = smooth(0.62, 0.72, t) * smooth(0.42, 0.58, pnoise(L, x * 0.125, y * 0.125, OW * 0.125, OH * 0.125)) * 0.55;
      c0 += (146 - c0) * a; c1 += (150 - c1) * a; c2 += (126 - c2) * a;
    }
    if (kind === 'birch') {
      if (t === 2) { c0 = 30; c1 = 27; c2 = 25; } // a scar
      else if (t === 3) { c0 = 176; c1 = 140; c2 = 112; } // under a peeled strip
      else if (t === 4) { c0 = 70; c1 = 58; c2 = 50; } // its curled edge
      else if (t > 0) { const a = Math.min(1, t) * 0.85; c0 += (40 - c0) * a; c1 += (35 - c1) * a; c2 += (32 - c2) * a; } // a lenticel
    }
    if (kind === 'spruce') { const a = (t - 0.5) * 0.5; c0 *= 1 + a; c1 *= 1 + a * 0.85; c2 *= 1 + a * 0.7; }
    if (kind === 'oak' && hh < 0.25) { const a = (1 - hh / 0.25) * 0.35 * mottOf((x * Q + 37) % W, y * Q); c0 += 18 * a; c1 += 6 * a; c2 -= 4 * a; } // the furrows' bottoms brownish here and there
    img[i * 4] = c0; img[i * 4 + 1] = c1; img[i * 4 + 2] = c2; img[i * 4 + 3] = 255;
  }
  if (kind === 'oak') { // lichen: small pale blue-green dots in clusters, and pale grey crusts, on the ridges
    const dot = (x0, y0, rad, rgb, a) => {
      for (let dy = -Math.ceil(rad); dy <= Math.ceil(rad); dy++) for (let dx = -Math.ceil(rad); dx <= Math.ceil(rad); dx++) {
        const q = (dx * dx + dy * dy) / (rad * rad);
        if (q > 1) continue;
        const x = (((x0 + dx) % OW) + OW) % OW, y = (((y0 + dy) % OH) + OH) % OH, i = y * OW + x;
        if (hO[i] < 0.35) continue; // (not down in the furrows)
        const k = a * (1 - q * q);
        img[i * 4] += (rgb[0] - img[i * 4]) * k; img[i * 4 + 1] += (rgb[1] - img[i * 4 + 1]) * k; img[i * 4 + 2] += (rgb[2] - img[i * 4 + 2]) * k;
      }
    };
    for (let n = 0; n < 34; n++) { // clusters
      const cx = Math.floor(r() * OW), cy = Math.floor(r() * OH), spread = 20 + r() * 50, crust = r() < 0.4;
      for (let m = 0; m < (crust ? 30 : 16); m++) {
        const x = Math.round(cx + (r() - 0.5) * spread * 2), y = Math.round(cy + (r() - 0.5) * spread * 2.6);
        if (crust) dot(x, y, 3 + r() * 6, [170 + r() * 14, 172 + r() * 12, 158 + r() * 10], 0.35 + r() * 0.25);
        else dot(x, y, 1.5 + r() * 3, [164 + r() * 20, 192 + r() * 14, 184 + r() * 12], 0.6 + r() * 0.3);
      }
    }
  }
  // the normals, from the heights (how deep a furrow is, in metres for a step of one pixel's 1.2 mm)
  const depth = { oak: 0.03, willow: 0.034, maple: 0.012, birchBase: 0.024, spruce: 0.006, birch: 0.003 }[kind] / (TW / OW);
  const nrm = new Uint8ClampedArray(N * 4), H0 = (x, y) => hO[((y + OH) % OH) * OW + ((x + OW) % OW)];
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
    const du = (H0(x + 1, y) - H0(x - 1, y)) * 0.5 * depth, dv = (H0(x, y - 1) - H0(x, y + 1)) * 0.5 * depth; // (row 0 is the top of the tile: v = 1)
    const l = Math.hypot(du, dv, 1), i = (y * OW + x) * 4;
    nrm[i] = (-du / l * 0.5 + 0.5) * 255; nrm[i + 1] = (-dv / l * 0.5 + 0.5) * 255; nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
  }
  const tex = (data, colour) => {
    const t = canvasTex(OW, OH, (g) => g.putImageData(new ImageData(data, OW, OH), 0, 0), { repeat: [1, 1], data: !colour });
    return t;
  };
  // and the heights again, blurred and smaller, for the trunk's shape: the furrows and ridges a few centimetres across
  const SW = 128, SH = 256, small = new Float32Array(SW * SH);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    let s = 0;
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) s += hO[(y * 4 + dy) * OW + x * 4 + dx];
    small[y * SW + x] = s / 16;
  }
  if (kind === 'oak') for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) small[y * SW + x] += (pfbm(L, x / SW + 0.3, y / SH, 5, 3, 3) - 0.5) * 0.7; // broad swellings up the trunk (its fine ridges too small to be shape)
  for (let pass = 0; pass < (kind === 'oak' ? 8 : 3); pass++) { // box blur, wrapping
    const tmp = small.slice();
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      let s = 0;
      for (let d = -2; d <= 2; d++) s += tmp[y * SW + ((x + d + SW) % SW)] + tmp[((y + d + SH) % SH) * SW + x];
      small[y * SW + x] = s / 10;
    }
  }
  let mean = 0;
  for (const v of small) mean += v;
  mean /= small.length;
  BARK[kind] = { map: tex(img, true), normalMap: tex(nrm, false), heights: { w: SW, h: SH, data: small, mean } };
  return BARK[kind];
}

/**
 * The wood where an oak's bark has come away (user, 2026-10-18: "some small and medium openings in the bark"):
 * bare, weathered, its grain in long fibres up the trunk, tan going grey, a few long splits, dark stains
 * run down it, the odd beetle hole. Tiles both ways (one tile ≈ 0.2 m round by 0.8 m up, as grove.js maps it).
 */
export function woundWoodTex() {
  return canvasTex(256, 512, (g, w, h) => {
    const r = mulberry32(1511);
    g.fillStyle = '#9c8468';
    g.fillRect(0, 0, w, h);
    const tile = (x, fn) => { for (const dx of [-w, 0, w]) { g.save(); g.translate(dx, 0); fn(x); g.restore(); } };
    for (let i = 0; i < 26; i++) { // grey weathering, in long soft streaks
      const x = r() * w, wd = 10 + r() * 40, a = 0.12 + r() * 0.2;
      tile(x, () => { const gr = g.createLinearGradient(x - wd, 0, x + wd, 0); gr.addColorStop(0, 'rgba(140,134,124,0)'); gr.addColorStop(0.5, `rgba(140,134,124,${a})`); gr.addColorStop(1, 'rgba(140,134,124,0)'); g.fillStyle = gr; g.fillRect(x - wd, 0, wd * 2, h); });
    }
    for (let i = 0; i < 420; i++) { // the fibres: thin lines up it, wandering a little, lighter and darker
      const x0 = r() * w, v = r(), sway = (r() - 0.5) * 6, ph = r() * 6.3;
      g.strokeStyle = v < 0.5 ? `rgba(${70 + v * 40},${54 + v * 30},${40 + v * 20},${0.25 + r() * 0.3})` : `rgba(${190 + v * 30},${168 + v * 26},${136 + v * 20},${0.15 + r() * 0.25})`;
      g.lineWidth = 0.6 + r() * 1.4;
      tile(x0, () => { g.beginPath(); for (let y = 0; y <= h; y += 8) { const x = x0 + sway * Math.sin((y / h) * Math.PI * 2 + ph); y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); });
    }
    for (let i = 0; i < 7; i++) { // long splits along the grain
      const x0 = r() * w, y0 = r() * h, len = 80 + r() * 260;
      g.strokeStyle = 'rgba(40,30,22,0.85)';
      g.lineWidth = 1 + r() * 2.2;
      for (const dy of [-h, 0, h]) tile(x0, () => { g.beginPath(); g.moveTo(x0, y0 + dy); g.quadraticCurveTo(x0 + (r() - 0.5) * 10, y0 + dy + len / 2, x0 + (r() - 0.5) * 6, y0 + dy + len); g.stroke(); });
    }
    for (let i = 0; i < 9; i++) { // dark stains run down from above
      const x = r() * w, y0 = r() * h, len = 60 + r() * 200, gr = g.createLinearGradient(0, y0, 0, y0 + len);
      gr.addColorStop(0, `rgba(54,40,30,${0.25 + r() * 0.25})`);
      gr.addColorStop(1, 'rgba(54,40,30,0)');
      g.fillStyle = gr;
      for (const dy of [-h, 0]) tile(x, () => g.fillRect(x, y0 + dy, 4 + r() * 12, len));
    }
    for (let i = 0; i < 16; i++) { const x = r() * w, y = r() * h; g.fillStyle = 'rgba(28,20,14,0.9)'; g.beginPath(); g.ellipse(x, y, 1.2 + r() * 1.5, 1.5 + r() * 2, 0, 0, Math.PI * 2); g.fill(); } // beetle holes
    speckle(g, w, h, 1500, '#3a2c20', 1.1, 1512);
  }, { repeat: [1, 1] });
}

/** The blurred bark height of a kind at u (round, in tiles) and v (up, in tiles), bilinear: about −0.5…0.5 round its mean. */
export function groveBarkHeight(kind, u, v) {
  const { w, h, data, mean } = groveBark(kind).heights;
  const x = (((u % 1) + 1) % 1) * w, y = (1 - (((v % 1) + 1) % 1)) * h; // (row 0 is v = 1)
  const x0 = Math.floor(x) % w, y0 = Math.floor(y) % h, x1 = (x0 + 1) % w, y1 = (y0 + 1) % h, fx = x - Math.floor(x), fy = y - Math.floor(y);
  const a = data[y0 * w + x0], b = data[y0 * w + x1], c = data[y1 * w + x0], d = data[y1 * w + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy - mean;
}

/** One leaf's outline, petiole at 0, 0 and its tip up the -y of the canvas, `L` long. */
function leafOutline(g, kind, L) {
  g.beginPath();
  if (kind === 'maple') {
    // five lobes, pointed, the lower two small, round a middle a third of the way up
    const cy = -L * 0.36;
    for (let i = 0; i <= 120; i++) {
      const a = -Math.PI + (i / 120) * Math.PI * 2, lobe = Math.pow(Math.abs(Math.cos(a * 2.5)), 1.7);
      const rr = L * 0.56 * (0.36 + 0.64 * lobe) * (1 - 0.38 * Math.min(1, Math.max(0, (Math.abs(a) - 1.6) / 1.0)));
      const x = Math.sin(a) * rr, y = cy - Math.cos(a) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
  } else {
    const side = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      let half;
      if (kind === 'oak') half = L * 0.3 * Math.sin(Math.PI * Math.pow(t, 0.85)) * (0.62 + 0.38 * Math.abs(Math.cos(t * Math.PI * 4.5)));
      else if (kind === 'birch') half = L * 0.36 * Math.sin(Math.PI * Math.pow(t, 0.55)) * (1 - t * 0.25) * (1 + 0.07 * Math.sin(t * 44));
      else if (kind === 'beech') half = L * 0.31 * Math.pow(Math.sin(Math.PI * t), 0.8) * (1 + 0.045 * Math.sin(t * 30)); // wavy-edged
      else half = L * 0.27 * Math.pow(Math.sin(Math.PI * t), 0.85) * (1 + 0.03 * Math.sin(t * 50)); // apple
      side.push([half, -t * L]);
    }
    g.moveTo(0, 0);
    for (const [x, y] of side) g.lineTo(x, y);
    for (let i = side.length - 1; i >= 0; i--) g.lineTo(-side[i][0], side[i][1]);
  }
  g.closePath();
}

/**
 * A spray of leaves on its twig, for the grove's crowns (a card each, clear round them): 'oak', 'birch',
 * 'maple', 'apple' — each leaf its own shape, size and shade, some seen edge-on, the odd one gone yellow or
 * spotted. 'spruce': a branch end with its needles, the hanging shoots under it (wider than tall).
 */
export function leafSprayTex(kind, seed = 1) {
  const S = { oak: [52, 30, '#3a4f25'], birch: [95, 15, '#5d7430'], maple: [24, 44, '#506a2a'], apple: [46, 27, '#46602d'], beech: [56, 26, '#4a6a29'] };
  if (kind === 'spruce') {
    return bleed(canvasTex(512, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const r = mulberry32(611 + seed);
      // the branch from the left, sagging, its tip lifting; shoots hanging from it like a comb
      const along = (t) => [10 + t * (w - 30), h * 0.3 + Math.sin(t * Math.PI) * h * 0.1 - t * t * h * 0.06];
      const needles = (x0, y0, x1, y1, len, n) => {
        for (let i = 0; i < n; i++) {
          const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, a = Math.atan2(y1 - y0, x1 - x0);
          for (const s of [-1, 1]) {
            const b = a + s * (0.7 + r() * 0.5), l = len * (0.7 + r() * 0.5) * (1 - t * 0.35), v = r();
            g.strokeStyle = `rgb(${Math.round(36 + v * 26 + t * 14)},${Math.round(56 + v * 28 + t * 22)},${Math.round(34 + v * 16)})`;
            g.lineWidth = 1.6 + r() * 0.8;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l); g.stroke();
          }
        }
      };
      for (let k = 0; k < 13; k++) { // the shoots hanging under it
        const t = 0.1 + (k / 13) * 0.82 + r() * 0.03, [x, y] = along(t), dx = 6 + r() * 14, dy = h * (0.35 + r() * 0.3) * (1 - t * 0.4);
        g.strokeStyle = 'rgba(70,48,32,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dx, y + dy * 0.4, x + dx * 0.7, y + dy); g.stroke();
        needles(x, y, x + dx * 0.7, y + dy, 11, 22);
      }
      g.strokeStyle = 'rgba(82,58,40,1)'; g.lineWidth = 4; g.beginPath(); for (let i = 0; i <= 30; i++) { const [x, y] = along(i / 30); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      for (let i = 0; i < 30; i++) { const [x0, y0] = along(i / 30), [x1, y1] = along((i + 1) / 30); needles(x0, y0, x1, y1, 16, 8); }
    }));
  }
  const [count, size, base] = S[kind];
  return bleed(canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(503 + seed * 17 + count);
    const c0 = rgbOf(base);
    // twigs: one up the middle, a few off it
    const twigs = [];
    const twig = (x0, y0, a, len, depth) => {
      const pts = [[x0, y0]];
      let x = x0, y = y0;
      for (let i = 0; i < 8; i++) { a += (r() - 0.5) * 0.3 + (kind === 'birch' ? 0.06 : 0); x += Math.sin(a) * len / 8; y -= Math.cos(a) * len / 8; pts.push([x, y]); }
      twigs.push(pts);
      g.strokeStyle = kind === 'birch' ? 'rgba(82,60,50,0.8)' : 'rgba(92,76,54,0.8)';
      g.lineWidth = depth ? 1.0 : 1.8; // (thin: up close, low on a tree, a thick one read as a dark stick across the view)
      g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
      if (!depth) for (let k = 0; k < 4; k++) { const p = pts[2 + k]; twig(p[0], p[1], a + (k % 2 ? 1 : -1) * (0.6 + r() * 0.4), len * (0.5 - k * 0.06), 1); }
    };
    twig(w * 0.5, h * 0.86, (r() - 0.5) * 0.3, h * 0.72, 0); // (not from the card's very edge, where no leaves hide it)
    // the leaves along them, alternate sides, pointing out and up, the nearer ones bigger
    for (let i = 0; i < count; i++) {
      const pts = twigs[Math.floor(r() * twigs.length)], p = pts[1 + Math.floor(r() * (pts.length - 1))];
      const L = size * (0.75 + r() * 0.5) * (w / 512) * (kind === 'maple' ? 2.2 : kind === 'birch' ? 1.4 : kind === 'beech' ? 1.5 : 1.7);
      const turn = (r() < 0.5 ? -1 : 1) * (0.5 + r() * 1.1) + (r() - 0.5) * 0.4;
      const edge = 0.35 + r() * 0.65; // seen at an angle
      const v = r(), sick = r() < 0.035;
      const fill = sick ? `rgb(${Math.round(150 + v * 30)},${Math.round(138 + v * 25)},${Math.round(60 + v * 20)})` : `rgb(${Math.round(c0.r * (0.72 + v * 0.5))},${Math.round(c0.g * (0.72 + v * 0.45))},${Math.round(c0.b * (0.7 + v * 0.4))})`;
      g.save();
      g.translate(p[0], p[1]);
      g.rotate(turn);
      g.strokeStyle = 'rgba(70,80,40,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L * 0.18); g.stroke(); // the stalk
      g.translate(0, -L * 0.16);
      g.scale(edge, 1);
      leafOutline(g, kind, L);
      g.fillStyle = fill; g.fill();
      g.save(); g.clip();
      g.fillStyle = 'rgba(255,255,230,0.09)'; g.fillRect(0, -L * 1.2, L, L * 1.3); // one half catches more light than the other
      g.strokeStyle = 'rgba(200,210,150,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L); g.stroke(); // the midrib
      if (L > 30) for (let k = 1; k < 6; k++) { const y = -L * k / 6.5; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, y); g.lineTo(L * 0.3, y - L * 0.1); g.moveTo(0, y); g.lineTo(-L * 0.3, y - L * 0.1); g.stroke(); }
      if (sick || r() < 0.08) for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(70,52,26,0.5)'; g.beginPath(); g.arc((r() - 0.5) * L * 0.3, -L * (0.2 + r() * 0.6), 1 + r() * 2.5, 0, Math.PI * 2); g.fill(); }
      g.restore();
      leafOutline(g, kind, L);
      g.strokeStyle = 'rgba(20,28,12,0.45)'; g.lineWidth = 1; g.stroke();
      g.restore();
    }
  }));
}

/**
 * A weeping willow's hanging shoots, for a tall narrow card (1 : 4; grove.js hangs them in curtains from its
 * branches; user, 2026-10-18): four or five thin shoots coming straight down from the top, swaying a little,
 * each with its narrow leaves along it pointing down off it, side and side about, smaller towards its tip;
 * yellow-green, some turned to show their silvery undersides, the odd one gone yellow. Clear round them.
 */
export function willowStrandTex(seed = 1) {
  return bleed(canvasTex(256, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(651 + seed), shoots = 4 + Math.floor(r() * 2);
    for (let s = 0; s < shoots; s++) {
      const x0 = w * (0.14 + (0.72 * (s + 0.2 + r() * 0.6)) / shoots), len = h * (0.7 + r() * 0.29), sway = (r() - 0.5) * w * 0.22, ph = r() * 6;
      const at = (t) => [x0 + sway * t * t + Math.sin(t * 3 + ph) * w * 0.025, t * len]; // from the top, down
      g.strokeStyle = 'rgba(104,94,60,0.9)';
      g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i <= 40; i++) { const [x, y] = at(i / 40); i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      let side = r() < 0.5 ? 1 : -1;
      for (let y = 2 + r() * 8; y < len - 6; y += 9 + r() * 8) {
        const t = y / len, [x, yy] = at(t);
        side = -side;
        const L = (50 + r() * 34) * (1 - t * 0.4), wd = L * (0.1 + r() * 0.05);
        const under = r() < 0.28, yellow = r() < 0.035, v = r();
        g.save();
        g.translate(x, yy);
        g.rotate(-side * (0.18 + r() * 0.42)); // off the shoot, pointing down
        g.scale(0.55 + r() * 0.45, 1); // seen a little edge-on, some of them
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(wd * 1.9, L * 0.32, 0, L);
        g.quadraticCurveTo(-wd * 1.9, L * 0.32, 0, 0);
        g.fillStyle = yellow ? `rgb(${Math.round(186 + v * 20)},${Math.round(170 + v * 18)},${Math.round(74 + v * 20)})`
          : under ? `rgb(${Math.round(140 + v * 22)},${Math.round(156 + v * 20)},${Math.round(118 + v * 18)})`
          : `rgb(${Math.round(96 + v * 40)},${Math.round(126 + v * 38)},${Math.round(48 + v * 24)})`;
        g.fill();
        g.strokeStyle = 'rgba(220,226,170,0.35)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(0, L * 0.05); g.lineTo(0, L * 0.92); g.stroke(); // the midrib
        g.restore();
      }
    }
  }));
}

/** A colour from '#rrggbb' as 0–255 r, g, b. */
function rgbOf(hex) { const n = parseInt(hex.slice(1), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }

/**
 * Galvanised steel gone rusty (the house's gutter and downpipes; user, 2026-10-17): dull mottled zinc, rust
 * coming through in patches, orange to dark brown, running down in streaks, pitted (tiles; up the texture is
 * along the pipe, or round the gutter from its lip to its bottom).
 */
export function rustyMetalTex(seed = 71) {
  const r = mulberry32(seed);
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#878b8b';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { // the zinc's spangle, gone dull: lighter and darker flakes
      const v = 110 + r() * 50;
      g.fillStyle = `rgba(${v},${v + 3},${v + 4},${0.15 + r() * 0.2})`;
      g.beginPath(); g.ellipse(r() * w, r() * h, 4 + r() * 14, 3 + r() * 10, r() * 3, 0, Math.PI * 2); g.fill();
    }
    const tile = (x, y, fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(x + dx, y + dy); fn(); g.restore(); } };
    for (let i = 0; i < 34; i++) { // rust through it in patches, lumpy, darker at their middles
      const x = r() * w, y = r() * h, s = 8 + r() * 34;
      tile(x, y, () => {
        for (let k = 0; k < 14; k++) {
          const c = r();
          g.fillStyle = c < 0.4 ? `rgba(138,74,38,${0.25 + r() * 0.35})` : c < 0.75 ? `rgba(108,56,28,${0.3 + r() * 0.35})` : `rgba(70,38,22,${0.3 + r() * 0.4})`;
          g.beginPath(); g.ellipse((r() - 0.5) * s, (r() - 0.5) * s, 2 + r() * s * 0.45, 2 + r() * s * 0.35, r() * 3, 0, Math.PI * 2); g.fill();
        }
      });
    }
    for (let i = 0; i < 40; i++) { // and run down from them in streaks
      const x = r() * w, y0 = r() * h, len = 40 + r() * 200;
      const gr = g.createLinearGradient(0, y0, 0, y0 + len);
      gr.addColorStop(0, `rgba(120,62,30,${0.25 + r() * 0.3})`);
      gr.addColorStop(1, 'rgba(120,62,30,0)');
      g.fillStyle = gr;
      for (const dy of [-h, 0]) g.fillRect(x, y0 + dy, 1 + r() * 4, len);
    }
    speckle(g, w, h, 2500, '#2a1a10', 1.3, seed + 1); // pitting
    speckle(g, w, h, 1500, '#b06a38', 1.0, seed + 2);
  }, { repeat: [1, 1] });
}

/**
 * Sixteen fallen leaves, 4 × 4 (the litter heaped round the grove's trunks and along its fence): oak, beech,
 * maple, birch shapes, every brown from ochre to near black, one or two still yellowish, spotted, torn at the
 * edge; each fills its cell, clear round it.
 */
export function deadLeavesTex() {
  return bleed(canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(731), kinds = ['oak', 'beech', 'maple', 'birch'];
    const browns = [[118, 84, 48], [140, 100, 54], [96, 64, 38], [72, 50, 30], [160, 118, 60], [130, 76, 44], [150, 132, 70], [104, 80, 52]];
    for (let i = 0; i < 16; i++) {
      const cx = (i % 4) * 128 + 64, cy = Math.floor(i / 4) * 128 + 118, kind = kinds[i % 4], L = kind === 'maple' ? 60 : kind === 'birch' ? 80 : 104;
      const [cr, cg, cb] = browns[Math.floor(r() * browns.length)], v = 0.85 + r() * 0.3;
      g.save(); g.translate(cx, kind === 'maple' ? cy - 26 : cy); g.scale(kind === 'birch' ? 1.4 : 1, 1);
      leafOutline(g, kind, L);
      g.fillStyle = `rgb(${Math.round(cr * v)},${Math.round(cg * v)},${Math.round(cb * v)})`; g.fill();
      g.save(); g.clip();
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,38,20' : '190,150,90'},${0.08 + r() * 0.14})`; g.beginPath(); g.arc((r() - 0.5) * L * 0.7, -r() * L, 2 + r() * 8, 0, Math.PI * 2); g.fill(); } // blotched as it rots
      g.strokeStyle = 'rgba(50,32,18,0.55)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L); g.stroke(); // the midrib
      g.lineWidth = 0.8; for (let k = 1; k < 6; k++) { const y = -L * k / 6.5; g.beginPath(); g.moveTo(0, y); g.lineTo(L * 0.28, y - L * 0.1); g.moveTo(0, y); g.lineTo(-L * 0.28, y - L * 0.1); g.stroke(); }
      if (r() < 0.5) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc((r() < 0.5 ? -1 : 1) * L * 0.3, -L * (0.3 + r() * 0.4), 4 + r() * 7, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; } // a bite out of the edge
      g.restore();
      leafOutline(g, kind, L); g.strokeStyle = 'rgba(40,26,14,0.6)'; g.lineWidth = 1.2; g.stroke();
      g.strokeStyle = 'rgba(70,48,28,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 9); g.stroke(); // its stalk
      g.restore();
    }
  }));
}

/**
 * A ceiling of old white emulsion, one picture over the whole of it (`x0…x1` by `z0…z1`, metres; the
 * texture's repeat/offset put it there over world UVs, `period` 1): faint roller laps, a soft mottle, greyer
 * along the walls (`walls`: 'n', 's', 'e', 'w') where the dust settles, fly specks, and `marks` — `ghost`
 * (the dust ring round a fitting), `grease` (over a cooker), `water` (a dried leak, its tide lines), `crack`,
 * `smudge` (fingers). Returns { map, glow }: glow is the same picture × `light(x, z)` (0…1), the light the room
 * throws back up at it, for the emissive map.
 */
export function ceilingTex({ x0, x1, z0, z1, seed, walls = '', gaps = {}, marks = [], light }) {
  const S = 160, W = Math.round((x1 - x0) * S), H = Math.round((z1 - z0) * S);
  const at = (x, z) => [(x - x0) * S, (z1 - z) * S];
  const place = (t) => {
    t.repeat.set(1 / (x1 - x0), 1 / (z1 - z0));
    t.offset.set(-x0 / (x1 - x0), -z0 / (z1 - z0));
    return t;
  };
  const blob = (g, x, y, rx, ry, rgba, a0, a1 = 0) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rx);
    gr.addColorStop(0, `rgba(${rgba},${a0})`);
    gr.addColorStop(1, `rgba(${rgba},${a1})`);
    g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
    g.fillStyle = gr; g.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    g.restore();
  };
  const map = canvasTex(W, H, (g) => {
    const r = mulberry32(seed);
    g.fillStyle = '#e8e7e2';
    g.fillRect(0, 0, W, H);
    // the roller's laps, across the room: long soft bands a shade lighter or darker, each edge feathered
    for (let y = -20; y < H; ) {
      const b = (0.4 + r() * 0.25) * S, gr = g.createLinearGradient(0, y, 0, y + b), c = r() < 0.5 ? '255,255,252' : '96,92,84', a = r() < 0.5 ? 0.025 + r() * 0.03 : 0.02 + r() * 0.02;
      gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(0.3, `rgba(${c},${a})`); gr.addColorStop(0.7, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(0, y, W, b);
      y += b * (0.55 + r() * 0.35);
    }
    for (let i = 0; i < (W * H) / 9000; i++) blob(g, r() * W, r() * H, (0.15 + r() * 0.5) * S, (0.1 + r() * 0.4) * S, r() < 0.5 ? '255,255,250' : '110,104,94', 0.02 + r() * 0.03);
    // along the walls, greyer: dust, the warm air carrying it up
    for (const side of walls) {
      const d = (0.1 + r() * 0.06) * S, [ax, ay, bx, by, fx, fy, fw, fh] = {
        n: [0, H, 0, H - d, 0, H - d, W, d], s: [0, 0, 0, d, 0, 0, W, d], w: [0, 0, d, 0, 0, 0, d, H], e: [W, 0, W - d, 0, W - d, 0, d, H],
      }[side];
      const gr = g.createLinearGradient(ax, ay, bx, by);
      gr.addColorStop(0, 'rgba(84,78,70,0.22)'); gr.addColorStop(0.25, 'rgba(84,78,70,0.09)'); gr.addColorStop(1, 'rgba(84,78,70,0)');
      g.fillStyle = gr;
      g.save(); // (`gaps`: where that side has no wall — an opening — [from, to] along it in metres)
      g.beginPath(); g.rect(fx, fy, fw, fh);
      for (const [a, b] of gaps[side] ?? []) {
        if (side === 'e' || side === 'w') { const [, ya] = at(0, b), [, yb] = at(0, a); g.rect(fx + fw, ya, -fw, yb - ya); }
        else { const [xa] = at(a, 0), [xb] = at(b, 0); g.rect(xb, fy, xa - xb, fh); }
      }
      g.clip('evenodd'); g.fillRect(fx, fy, fw, fh);
      g.restore();
    }
    for (const m of marks) {
      const [x, y] = at(m.x, m.z), k = m.amount ?? 1;
      if (m.type === 'ghost') { // round a fitting: a grey halo, darkest just past its rim
        const gr = g.createRadialGradient(x, y, 0.16 * S, x, y, (m.r ?? 0.55) * S);
        gr.addColorStop(0, `rgba(80,74,66,${0.2 * k})`); gr.addColorStop(0.35, `rgba(80,74,66,${0.08 * k})`); gr.addColorStop(1, 'rgba(80,74,66,0)');
        g.fillStyle = gr; g.fillRect(x - S, y - S, 2 * S, 2 * S);
      } else if (m.type === 'grease') { // years of cooking: yellowed, browner nearest the pans
        blob(g, x, y, m.rx * S, m.rz * S, '168,134,72', 0.24 * k);
        blob(g, x, y + 0.12 * S, m.rx * 0.5 * S, m.rz * 0.4 * S, '120,92,48', 0.14 * k);
      } else if (m.type === 'water') { // a leak, dried: a pale stain, brown tide lines round it, one inside the other
        const pts = [], n = 48, ph = [r() * 6, r() * 6, r() * 6];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, f = 1 + 0.22 * Math.sin(a * 2 + ph[0]) + 0.12 * Math.sin(a * 5 + ph[1]) + 0.06 * Math.sin(a * 9 + ph[2]);
          pts.push([Math.cos(a) * m.rx * f, Math.sin(a) * m.rz * f]);
        }
        const ring = (s, dx, dy) => { g.beginPath(); pts.forEach(([px, py], i) => g[i ? 'lineTo' : 'moveTo'](x + dx + px * s * S, y + dy + py * s * S)); g.closePath(); };
        ring(1, 0, 0); g.fillStyle = `rgba(172,140,86,${0.13 * k})`; g.fill();
        for (const [s, dx, dy, a] of [[1, 0, 0, 0.42], [0.72, 0.05 * S, 0.03 * S, 0.26], [0.45, 0.08 * S, 0.05 * S, 0.18]]) {
          ring(s, dx, dy);
          for (const [lw, la] of [[7, 0.05], [4, 0.1], [1.6, 1]]) { g.lineWidth = lw; g.strokeStyle = `rgba(124,92,50,${a * la * k})`; g.stroke(); }
          ring(s, dx, dy); g.fillStyle = `rgba(150,118,70,${0.05 * k})`; g.fill();
        }
        for (let i = 0; i < 4; i++) blob(g, x + (r() - 0.3) * m.rx * 1.8 * S, y + (r() - 0.5) * m.rz * 1.6 * S, (0.03 + r() * 0.05) * S, (0.03 + r() * 0.04) * S, '140,108,60', 0.2 * k); // drips that spread on their own
      } else if (m.type === 'crack') { // a hairline, wandering, with a twig or two off it
        const twigs = [], walk = (sx, sy, ang, len, w) => {
          let px = sx, py = sy, a = ang;
          g.beginPath(); g.moveTo(px, py);
          for (let d = 0; d < len * S; d += 4) { a += (r() - 0.5) * 0.5; px += Math.cos(a) * 4; py += Math.sin(a) * 4; g.lineTo(px, py); if (w > 1 && r() < 0.02) twigs.push([px, py, a + (r() < 0.5 ? 0.9 : -0.9)]); }
          g.lineWidth = w; g.strokeStyle = 'rgba(78,72,64,0.5)'; g.stroke();
        };
        walk(x, y, m.angle, m.len, 1.3);
        for (const [tx, ty, ta] of twigs) walk(tx, ty, ta, m.len * 0.2, 0.8);
      } else if (m.type === 'smudge') { // grey finger marks, a few together
        for (let i = 0; i < (m.n ?? 6); i++) blob(g, x + (r() - 0.5) * 0.22 * S, y + (r() - 0.5) * 0.12 * S, (0.015 + r() * 0.02) * S, (0.01 + r() * 0.015) * S, '74,68,60', 0.18 + r() * 0.12);
      }
    }
    speckle(g, W, H, Math.round((W * H) / 2500), '#4a463e', 1.1, seed + 1); // fly specks, dust
  });
  // the light thrown back up: worked out coarse, then laid over the picture, smoothed
  const glow = canvasTex(W, H, (g) => {
    const lw = Math.ceil(W / 16), lh = Math.ceil(H / 16), small = document.createElement('canvas');
    small.width = lw; small.height = lh;
    const sg = small.getContext('2d'), img = sg.createImageData(lw, lh);
    for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
      const v = Math.round(255 * Math.min(1, Math.max(0, light(x0 + ((i + 0.5) / lw) * (x1 - x0), z1 - ((j + 0.5) / lh) * (z1 - z0)))) ** (1 / 2.2)); // (as sRGB: it is read back linear)
      img.data.set([v, v, v, 255], (j * lw + i) * 4);
    }
    sg.putImageData(img, 0, 0);
    g.drawImage(map.image, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.imageSmoothingEnabled = true;
    g.drawImage(small, 0, 0, W, H);
  });
  return { map: place(map), glow: place(glow) };
}

/**
 * A family's wall calendar, October 2003, open on its nail: { picture, month }. The picture: the photograph he sent
 * of a lake under mountains, printed, gone a little flat with the years, its caption; the hole it hangs by. The month: the
 * grid, September and November small in the empty days, and the house's own marks in biro — the days crossed
 * off up to the 16th and then not, the 17th ringed and nothing written by it; appointments; a child's pumpkin.
 */
export function calendarTex() {
  const PAPER = '#ddd7c9';
  const aged = (g, w, h, seed) => {
    const r = mulberry32(seed);
    for (let i = 0; i < 30; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 80, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(150,128,88,${0.03 + r() * 0.04})`); gr.addColorStop(1, 'rgba(150,128,88,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (const [x0, y0, x1, y1, ww, hh, fx, fy] of [[0, 0, 0, 18, w, 18, 0, 0], [0, h, 0, h - 18, w, 18, 0, h - 18], [0, 0, 18, 0, 18, h, 0, 0], [w, 0, w - 18, 0, 18, h, w - 18, 0]]) {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(120,100,66,0.16)'); gr.addColorStop(1, 'rgba(120,100,66,0)');
      g.fillStyle = gr; g.fillRect(fx, fy, ww, hh);
    }
  };
  // the picture (user, 2026-10-20): the photograph he sent, a lake under snowy mountains in morning mist, the white
  // strip with its words cut off (assets/calendar-photo.jpg, 4:3), printed on the page; until it has loaded, the
  // page with a grey-blue where it goes
  const drawPicture = (g, w, h, photo) => {
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
    const px0 = 34, py0 = 66, pw = w - 68, ph = Math.round(pw * 0.75);
    g.save();
    g.beginPath(); g.rect(px0, py0, pw, ph); g.clip();
    if (photo) g.drawImage(photo, px0, py0, pw, ph);
    else { g.fillStyle = '#7d8a92'; g.fillRect(px0, py0, pw, ph); }
    // printed, and old: flatter, a little magenta, grain, darker to the corners
    g.fillStyle = 'rgba(176,150,150,0.12)'; g.fillRect(px0, py0, pw, ph);
    const gr = g.createRadialGradient(w / 2, py0 + ph / 2, ph * 0.3, w / 2, py0 + ph / 2, ph * 0.85);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)');
    g.fillStyle = gr; g.fillRect(px0, py0, pw, ph);
    speckle(g, w, h, 1800, '#2a2a28', 0.8, 1032);
    g.restore();
    g.fillStyle = '#4b463e';
    g.font = 'italic 17px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.fillText('Morning mist on the lake', w / 2, py0 + ph + 34);
    aged(g, w, h, 1033);
    g.fillStyle = '#3a342c'; g.beginPath(); g.arc(w / 2, 22, 6, 0, Math.PI * 2); g.fill(); // the hole it hangs by
    g.strokeStyle = 'rgba(120,100,70,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, 22, 9, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); // torn a little at its lip
  };
  const picture = canvasTex(600, 600, (g, w, h) => drawPicture(g, w, h, null));
  const photo = new Image();
  photo.onload = () => { const c = picture.image; drawPicture(c.getContext('2d'), c.width, c.height, photo); picture.needsUpdate = true; };
  photo.src = 'assets/calendar-photo.jpg';
  const month = canvasTex(600, 600, (g, w, h) => {
    const r = mulberry32(1041);
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3a3a3e';
    g.font = `bold 46px ${IMPACT}`;
    g.textAlign = 'left'; g.fillText('OCTOBER', 30, 70);
    g.textAlign = 'right'; g.fillText('2003', w - 30, 70);
    const gx = 22, gy = 96, cw = (w - 44) / 7, ch = 92;
    g.fillStyle = '#585e66'; g.fillRect(gx, gy, w - 44, 26);
    g.fillStyle = '#e2ddd0'; g.font = `15px ${IMPACT}`; g.textAlign = 'center';
    ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].forEach((d, i) => g.fillText(d, gx + cw * (i + 0.5), gy + 19));
    const top = gy + 26, cell = (n) => { const k = n + 2; return [gx + (k % 7) * cw, top + Math.floor(k / 7) * ch]; }; // the 1st a Wednesday
    g.strokeStyle = '#8a8478'; g.lineWidth = 1;
    for (let i = 0; i <= 7; i++) { g.beginPath(); g.moveTo(gx + i * cw, top); g.lineTo(gx + i * cw, top + 5 * ch); g.stroke(); }
    for (let j = 0; j <= 5; j++) { g.beginPath(); g.moveTo(gx, top + j * ch); g.lineTo(w - gx, top + j * ch); g.stroke(); }
    g.fillStyle = '#34343a'; g.font = 'bold 19px Arial, Helvetica, sans-serif'; g.textAlign = 'left';
    for (let n = 1; n <= 31; n++) { const [x, y] = cell(n); g.fillText(String(n), x + 6, y + 21); }
    const mini = (name, x, y, first, days) => { // the months either side, small, in the empty days
      g.fillStyle = '#4a4a4e'; g.font = 'bold 9px Arial, sans-serif'; g.textAlign = 'center';
      g.fillText(name, x + cw / 2, y + 13);
      g.font = '8px Arial, sans-serif';
      for (let n = 1; n <= days; n++) { const k = n - 1 + first; g.fillText(String(n), x + 7 + (k % 7) * ((cw - 10) / 7), y + 26 + Math.floor(k / 7) * 11); }
    };
    mini('SEPTEMBER', gx, top, 1, 30);
    mini('NOVEMBER', gx + cw, top, 6, 30);
    // the biro: blue, a little blotchy, every mark its own
    const pen = (a = 0.85) => { g.strokeStyle = `rgba(32,44,118,${a})`; g.fillStyle = `rgba(32,44,118,${a})`; g.lineCap = 'round'; };
    for (let n = 1; n <= 16; n++) { // crossed off, day by day — then not
      const [x, y] = cell(n), j = () => (r() - 0.5) * 10;
      pen(0.65 + r() * 0.25); g.lineWidth = 1.6 + r() * 1.2;
      g.beginPath(); g.moveTo(x + 8 + j(), y + 8 + j()); g.lineTo(x + cw - 8 + j(), y + ch - 8 + j());
      g.moveTo(x + cw - 8 + j(), y + 8 + j()); g.lineTo(x + 8 + j(), y + ch - 8 + j()); g.stroke();
    }
    { // the 17th: ringed, twice round, nothing by it
      const [x, y] = cell(17);
      pen(0.8); g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(x + 16, y + 15, 17, 14, -0.2, 0.3, Math.PI * 2 + 0.9); g.stroke();
      g.beginPath(); g.ellipse(x + 17, y + 14, 15, 13, -0.1, 1.1, Math.PI * 2 + 0.4); g.stroke();
    }
    const hand = '"Segoe Print", "Bradley Hand", "Noteworthy", "Comic Sans MS", cursive';
    const note = (n, lines, size = 13, turn = 0, a = 0.85) => {
      const [x, y] = cell(n);
      pen(a); g.font = `${size}px ${hand}`; g.textAlign = 'left';
      g.save(); g.translate(x + 6, y + 40); g.rotate(turn);
      lines.forEach((s, i) => g.fillText(s, (r() - 0.5) * 3, i * (size + 3)));
      g.restore();
    };
    note(6, ['Lucas', 'dentist 4.15'], 13, -0.04);
    note(9, ["parents'", 'eve 6.30'], 13, 0.03);
    note(11, ["Gran's", 'bday!'], 14, -0.06);
    note(14, ['pay gas'], 14, 0.02);
    { const [x, y] = cell(14); pen(0.8); g.lineWidth = 1.3; g.beginPath(); g.moveTo(x + 7, y + 45); g.lineTo(x + 58, y + 43); g.stroke(); } // underlined, as she does
    note(22, ['school', 'photos'], 13, -0.03);
    note(26, ['clocks', 'back'], 13, 0.05);
    { // the 31st: a pumpkin and a word, his, in orange felt tip
      const [x, y] = cell(31);
      g.fillStyle = 'rgba(214,112,30,0.9)'; g.strokeStyle = 'rgba(214,112,30,0.9)'; g.lineWidth = 2.2;
      g.beginPath(); g.ellipse(x + 40, y + 62, 17, 13, 0.08, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x + 40, y + 49); g.lineTo(x + 43, y + 42); g.stroke();
      g.beginPath(); g.moveTo(x + 32, y + 58); g.lineTo(x + 35, y + 54); g.lineTo(x + 37, y + 59); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x + 43, y + 58); g.lineTo(x + 46, y + 53); g.lineTo(x + 49, y + 58); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x + 31, y + 66); g.lineTo(x + 36, y + 70); g.lineTo(x + 40, y + 66); g.lineTo(x + 44, y + 70); g.lineTo(x + 49, y + 65); g.stroke();
      g.font = 'bold 11px "Comic Sans MS", "Chalkboard", cursive';
      [...'HALOWEEN'].forEach((c, i) => g.fillText(c, x + 8 + i * 8.6, y + 40 + (r() - 0.5) * 4));
    }
    aged(g, w, h, 1042);
    speckle(g, w, h, 400, '#5a5246', 0.8, 1043);
    // the corner that gets lifted to see next month: grubby, from thumbs
    let gr = g.createRadialGradient(w - 10, h - 10, 0, w - 10, h - 10, 90);
    gr.addColorStop(0, 'rgba(96,80,58,0.26)'); gr.addColorStop(1, 'rgba(96,80,58,0)');
    g.fillStyle = gr; g.fillRect(w - 100, h - 100, 100, 100);
    for (let i = 0; i < 9; i++) { // from the pans: a few spots, dried
      const x = 40 + r() * (w - 80), y = h * (0.55 + r() * 0.42), rad = 1.5 + r() * 4;
      gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(150,118,70,0.32)'); gr.addColorStop(0.7, 'rgba(130,100,58,0.4)'); gr.addColorStop(1, 'rgba(130,100,58,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
  return { picture, month };
}

/**
 * A brass carpet strip's face, along its length (u across it, v along it): dull, tarnished brown at the ends by
 * the walls and along its edges where nobody treads, rubbed back to bright metal across the middle where feet go
 * over it, scratched across, grime in the angle at each edge.
 */
export function brassStripTex() {
  return canvasTex(64, 512, (g, w, h) => {
    const r = mulberry32(5511);
    g.fillStyle = '#a7834a';
    g.fillRect(0, 0, w, h);
    let gr = g.createLinearGradient(0, 0, 0, h); // rubbed in the middle, where the way through is
    gr.addColorStop(0, 'rgba(92,72,40,0.55)'); gr.addColorStop(0.22, 'rgba(92,72,40,0)'); gr.addColorStop(0.3, 'rgba(214,180,110,0)');
    gr.addColorStop(0.5, 'rgba(214,180,110,0.35)'); gr.addColorStop(0.7, 'rgba(214,180,110,0)'); gr.addColorStop(0.78, 'rgba(92,72,40,0)'); gr.addColorStop(1, 'rgba(92,72,40,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { // tarnish, in blooms
      const x = r() < 0.5 ? r() * w * 0.25 : w - r() * w * 0.25, y = r() * h, rad = 6 + r() * 26;
      gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${80 + r() * 20},${70 + r() * 16},${36 + r() * 10},${0.2 + r() * 0.25})`); gr.addColorStop(1, 'rgba(80,70,36,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 260; i++) { // scratches across, most in the middle
      const y = h * (0.5 + (r() - 0.5) * (r() < 0.7 ? 0.5 : 1));
      g.strokeStyle = `rgba(${r() < 0.6 ? '236,206,140' : '70,54,30'},${0.12 + r() * 0.25})`;
      g.lineWidth = 0.5 + r() * 0.8;
      g.beginPath(); g.moveTo(r() * w * 0.3, y); g.lineTo(w * (0.6 + r() * 0.4), y + (r() - 0.5) * 6); g.stroke();
    }
    for (const x of [3, w - 4]) { g.fillStyle = 'rgba(40,30,18,0.5)'; g.fillRect(x - 2, 0, 4, h); } // grime in the angles
  });
}

/**
 * Old brass, for a picture frame: dull and brown with tarnish, near black in blooms and at the ends of each piece
 * (the frame's corners, where the polish never reached), rubbed back to warm metal along the middle, fine
 * scratches. Each face's UVs run 0…1 along it.
 */
export function antiqueBrassTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = mulberry32(6611);
    g.fillStyle = '#8c6a38';
    g.fillRect(0, 0, w, h);
    let gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6); // rubbed bright in the middle of the face, dark to its ends
    gr.addColorStop(0, 'rgba(196,160,96,0.45)'); gr.addColorStop(0.6, 'rgba(196,160,96,0)'); gr.addColorStop(1, 'rgba(48,36,18,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { // tarnish
      const x = r() * w, y = r() * h, rad = 6 + r() * 30;
      gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${50 + r() * 20},${40 + r() * 14},${20 + r() * 10},${0.25 + r() * 0.3})`); gr.addColorStop(1, 'rgba(50,40,20,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 120; i++) { // verdigris, a fleck here and there
      if (r() > 0.25) continue;
      g.fillStyle = `rgba(96,120,92,${0.2 + r() * 0.25})`; g.beginPath(); g.arc(r() * w, r() * h, 0.6 + r() * 1.8, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 160; i++) { // scratches
      const x = r() * w, y = r() * h, a = r() * Math.PI, l = 3 + r() * 16;
      g.strokeStyle = `rgba(${r() < 0.6 ? '214,184,120' : '40,30,16'},${0.15 + r() * 0.25})`; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
}

/**
 * The corridor portrait's brass frame, the whole of its face in one picture (`fw` × `fh` m, the frame's outer size;
 * u across it left to right, v up it): antique brass, tarnished, scratched — and worn through to the grey metal under
 * the brass where hands have gone (user, 2026-10-24: "the colour gone in places"): its bottom corners, where it gets
 * straightened on its nail; along the top, where it is lifted off it; down its right side; a few spots on the bead
 * round the picture, and chips here and there. Each worn place ragged at its edge, the brass round it darkened.
 * `rough`: its roughness instead (the brass 0.42, the bare metal duller, 0.7: shiny as the brass, it lit up white).
 */
export function wornBrassTex(fw, fh, rough = false) {
  const W = 512, H = Math.round((512 * fh) / fw);
  return canvasTex(W, H, (g) => {
    const r = mulberry32(6612);
    g.fillStyle = '#8c6a38';
    g.fillRect(0, 0, W, H);
    let gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7); // rubbed brighter on the face, dark to its edges
    gr.addColorStop(0, 'rgba(196,160,96,0.35)'); gr.addColorStop(0.65, 'rgba(196,160,96,0)'); gr.addColorStop(1, 'rgba(48,36,18,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { // tarnish
      const x = r() * W, y = r() * H, rad = 6 + r() * 34;
      gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${50 + r() * 20},${40 + r() * 14},${20 + r() * 10},${0.25 + r() * 0.3})`); gr.addColorStop(1, 'rgba(50,40,20,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 200; i++) { // scratches
      const x = r() * W, y = r() * H, a = r() * Math.PI, l = 3 + r() * 16;
      g.strokeStyle = `rgba(${r() < 0.6 ? '214,184,120' : '40,30,16'},${0.15 + r() * 0.25})`; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // worn through: [u, v, half-width, half-height (of the frame), how far] — ragged by noise, a dark rim round each
    const n = mulberry32(6613), G = 40, cells = Array.from({ length: (G + 1) * (G + 1) }, () => n());
    const noise = (u, v) => { // (wrapping round: asked past 1 it tiles, it doesn't run away)
      const x = u * G, y = v * G, fx = x - Math.floor(x), fy = y - Math.floor(y), i = ((Math.floor(x) % G) + G) % G, j = ((Math.floor(y) % G) + G) % G, at = (a, b) => cells[b * (G + 1) + a];
      return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
    };
    const worn = [
      [0.03, 0.03, 0.06, 0.045, 1], [0.005, 0.1, 0.015, 0.04, 0.7], [0.97, 0.035, 0.04, 0.035, 0.9], // the bottom corners
      [0.6, 0.99, 0.07, 0.02, 1], [0.4, 0.993, 0.03, 0.012, 0.6], // along the top
      [0.99, 0.47, 0.016, 0.06, 0.9], [0.988, 0.65, 0.012, 0.025, 0.6], // down the right side
      [0.012, 0.33, 0.01, 0.022, 0.6], // a rub on the left
      [0.5, 0.095, 0.045, 0.01, 0.8], [0.3, 0.905, 0.025, 0.008, 0.7], [0.9, 0.6, 0.01, 0.025, 0.6], // on the bead
    ];
    for (let i = 0; i < 14; i++) worn.push([0.05 + r() * 0.9, 0.04 + r() * 0.92, 0.003 + r() * 0.006, 0.003 + r() * 0.006, 0.9]); // chips
    if (rough) { g.fillStyle = 'rgb(107,107,107)'; g.fillRect(0, 0, W, H); }
    const img = g.getImageData(0, 0, W, H), px = img.data;
    for (const [cu, cv, hw, hh, k] of worn) {
      const x0 = Math.max(0, Math.floor((cu - hw * 1.8) * W)), x1 = Math.min(W - 1, Math.ceil((cu + hw * 1.8) * W));
      const y0 = Math.max(0, Math.floor((1 - cv - hh * 1.8) * H)), y1 = Math.min(H - 1, Math.ceil((1 - cv + hh * 1.8) * H));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const u = x / W, v = 1 - y / H, d = Math.hypot((u - cu) / hw, (v - cv) / hh) - 0.7 * (noise(u * 3, v * 3) - 0.5) - 0.45 * (noise(u * 12, v * 12) - 0.5) - 0.25 * (noise(u * 30, v * 30) - 0.5);
        const o = (y * W + x) * 4;
        if (d < k * 0.82) { // the metal under it: dull grey, a little uneven (lighter than the brass, and matt)
          const s = 0.85 + 0.3 * noise(u * 14, v * 14);
          if (rough) px[o] = px[o + 1] = px[o + 2] = 178;
          else { px[o] = 124 * s; px[o + 1] = 118 * s; px[o + 2] = 104 * s; }
        } else if (!rough && d < k * 0.82 + 0.16) { // the brass's worn edge, darkened
          const a = 0.55 * (1 - (d - k * 0.82) / 0.16);
          px[o] *= 1 - a * 0.55; px[o + 1] *= 1 - a * 0.6; px[o + 2] *= 1 - a * 0.6;
        }
      }
    }
    g.putImageData(img, 0, 0);
  }, { data: rough });
}

/**
 * What is caught in a door's wire screen, over the whole of it (256 × 320, the screen's shape): dust and grime
 * silting up the holes — barely any in the middle, thick along the frame where it gathers and nobody brushes it
 * out, thickest at the foot and in the corners, darker there with the dirt off shoes; blotches of it; fluff and
 * a dead leaf's crumbs caught. Its alpha is how full the holes are.
 */
export function screenDustTex() {
  return canvasTex(256, 320, (g, w, h) => {
    const r = mulberry32(6231);
    g.clearRect(0, 0, w, h);
    const edge = (x0, y0, x1, y1, fx, fy, fw, fh, a) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, `rgba(104,94,76,${a})`); gr.addColorStop(0.35, `rgba(128,118,98,${a * 0.6})`); gr.addColorStop(1, 'rgba(140,130,110,0)');
      g.fillStyle = gr; g.fillRect(fx, fy, fw, fh);
    };
    g.fillStyle = 'rgba(150,142,124,0.14)'; // a film all over
    g.fillRect(0, 0, w, h);
    edge(0, h, 0, h - 90, 0, h - 90, w, 90, 0.85); // the foot
    edge(0, 0, 50, 0, 0, 0, 50, h, 0.7); // the sides
    edge(w, 0, w - 50, 0, w - 50, 0, 50, h, 0.7);
    edge(0, 0, 0, 40, 0, 0, w, 40, 0.55); // the top
    for (const [cx, cy, rad] of [[0, h, 70], [w, h, 70], [0, 0, 45], [w, 0, 45]]) { // the corners, full
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, 'rgba(92,82,64,0.9)'); gr.addColorStop(1, 'rgba(110,100,82,0)');
      g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 70; i++) { // blotches, more of them low down and near the edges
      const nearEdge = r() < 0.6, x = nearEdge ? (r() < 0.5 ? r() * 40 : w - r() * 40) : r() * w, y = h * (0.3 + r() ** 0.6 * 0.7), rad = 4 + r() * 18;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${120 + r() * 40},${112 + r() * 36},${94 + r() * 30},${0.2 + r() * 0.35})`); gr.addColorStop(1, 'rgba(130,120,100,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 14; i++) { // fluff, and crumbs of dead leaf
      const x = r() * w, y = h * (0.45 + r() * 0.55), rad = 2 + r() * 5;
      g.fillStyle = r() < 0.6 ? `rgba(206,200,186,${0.55 + r() * 0.3})` : `rgba(96,70,40,${0.6 + r() * 0.3})`;
      g.beginPath(); g.ellipse(x, y, rad, rad * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill();
    }
    // (none where it is torn: there is nothing there to hold it — the tears of wireScreenWearTex)
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    for (const [cx, cy, rx, ry] of [[w * 0.3, h * 0.72, 26, 16], [w * 0.78, h * 0.3, 12, 20]]) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  });
}

/**
 * The cooker's cream enamel (user, 2026-10-29, with a photo of an old freestanding cooker — its look and its wear,
 * not its name): each part drawn at its own size, `o.W` × `o.H` metres, x right and y down from its top-left
 * corner, and worn where use put it — grease and fingermarks round the knobs and under the handle, burnt-on rings
 * round the burners and old boil-overs, heat stains where the oven breathes out, chips with rust round them where
 * pans and the grates' feet knock, rust along the foot where the floor is mopped, shoe scuffs low down, red-brown
 * specks of spatter. `part`: 'hob' (o.burners [x, y, r, use], o.feet [x, y]), 'panel' (o.knobs [x, y, r, use,
 * corner: 'bl' 'fl' 'fr' 'br' for a burner's, null for the oven's], o.timer [x, y, r], o.icons: y of the print over
 * the knobs), 'door' (o.hole [x0, y0, x1, y1], o.handle: its y), 'drawer' (o.groove [y0, y1]), 'body', 'handle'.
 * Returns { map, bump, rough } (rough for a roughness of 1: the enamel 0.45, rust and bare steel much rougher).
 */
export function cookerEnamelTex(part, o) {
  const { W, H } = o, dense = o.dense ?? (part === 'body' ? 600 : 1700);
  const w = Math.min(1024, Math.round(W * dense)), k = w / W, h = Math.max(8, Math.round(H * k));
  const P = { // each mark's colour on the picture, how it stands out of the surface, how rough it is
    base: { map: o.base ?? (part === 'panel' ? [205, 199, 182] : part === 'handle' ? [214, 201, 160] : [212, 205, 186]), bump: [128, 128, 128], rough: [115, 115, 115] },
    pale: { map: (o.base ?? [212, 205, 186]).map((c) => Math.round(c + (206 - c) * 0.35 + 6)), rough: [140, 140, 140] }, // paint rubbed thin: a paler, duller shade of itself
    flour: { map: [222, 216, 202], bump: [140, 140, 140], rough: [210, 210, 210] },
    primer: { map: [146, 148, 142], bump: [80, 80, 80], rough: [150, 150, 150] }, // paint chipped off to its grey undercoat
    food: { map: [94, 80, 60], bump: [138, 138, 138], rough: [180, 180, 180] }, // spatter dried on, not rust
    plate: { map: [148, 92, 54], bump: [150, 150, 150], rough: [205, 205, 205] },
    lip: { map: [222, 218, 206], bump: [176, 176, 176] },
    groove: { map: [70, 64, 54], bump: [84, 84, 84] },
    caked: { map: [60, 54, 44], bump: [150, 150, 150], rough: [205, 205, 205] }, // dirt caked on, dark, as on the air conditioner's grille
    yellow: { map: [188, 166, 112] },
    heat: { map: [166, 128, 74] },
    grime: { map: [102, 90, 72], rough: [138, 138, 138] },
    grease: { map: [134, 92, 46], rough: [98, 98, 98] },
    burnt: { map: [76, 48, 26], bump: [158, 158, 158], rough: [190, 190, 190] },
    rust: { map: [148, 76, 36], bump: [146, 146, 146], rough: [222, 222, 222] },
    metal: { map: [56, 52, 47], bump: [40, 40, 40], rough: [165, 165, 165] },
    speck: { map: [146, 60, 36], bump: [140, 140, 140], rough: [205, 205, 205] },
    scuff: { map: [44, 41, 38], rough: [150, 150, 150] },
    scratch: { map: [238, 234, 224], bump: [96, 96, 96], rough: [150, 150, 150] },
    dirt: { map: [112, 104, 92], bump: [96, 96, 96], rough: [150, 150, 150] },
    ink: { map: [62, 60, 56] },
    dust: { map: [146, 140, 126], rough: [160, 160, 160] },
    dent: { map: [120, 112, 98], bump: [96, 96, 96] },
  };
  const draw = (mode) => (g) => {
    const r = mulberry32(o.seed ?? 9301); // (every draw taken in every mode: the marks fall alike on all three)
    const rustless = !!o.rustless; // (painted and kept indoors: chipped to its undercoat, never rusting — user, 2026-10-29)
    const col = (c, a) => { const v = c[mode]; return v ? `rgba(${v[0]},${v[1]},${v[2]},${a})` : null; };
    const base = P.base[mode];
    g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
    g.fillRect(0, 0, w, h);
    const soft = (x, y, rad, c, a) => { // a round mark fading out
      const s0 = col(c, a);
      if (!s0 || a <= 0) return;
      const X = x * k, Y = y * k, R = Math.max(0.8, rad * k), gr = g.createRadialGradient(X, Y, 0, X, Y, R);
      gr.addColorStop(0, s0);
      gr.addColorStop(1, col(c, 0));
      g.fillStyle = gr;
      g.fillRect(X - R, Y - R, R * 2, R * 2);
    };
    const path = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); g.closePath(); };
    const poly = (pts, c, a, blur = 0) => {
      const s = col(c, a);
      if (!s) return;
      g.filter = blur ? `blur(${blur}px)` : 'none';
      g.fillStyle = s;
      path(pts);
      g.fill();
      g.filter = 'none';
    };
    const rim = (pts, c, a, lw, blur = 0) => {
      const s = col(c, a);
      if (!s) return;
      g.filter = blur ? `blur(${blur}px)` : 'none';
      g.strokeStyle = s;
      g.lineWidth = lw;
      path(pts);
      g.stroke();
      g.filter = 'none';
    };
    const line = (x, y, ang, len, c, a, lw = 0.7) => {
      const s = col(c, a);
      if (!s) return;
      g.strokeStyle = s;
      g.lineWidth = lw;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x * k, y * k);
      g.lineTo((x + Math.cos(ang) * len) * k, (y + Math.sin(ang) * len) * k);
      g.stroke();
    };
    const band = (y0, y1, c, a0, a1) => { // a stain across the whole part, fading from y0 to y1
      if (!col(c, 0)) return;
      const gr = g.createLinearGradient(0, y0 * k, 0, y1 * k);
      gr.addColorStop(0, col(c, a0));
      gr.addColorStop(1, col(c, a1));
      g.fillStyle = gr;
      g.fillRect(0, Math.min(y0, y1) * k, w, Math.abs(y1 - y0) * k);
    };
    const blob = (x, y, s, n = 8) => { // an uneven outline round x, y
      const pts = [];
      for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2 + r() * 0.5, d = s * (0.45 + r() * 0.8); pts.push([x + Math.cos(t) * d, y + Math.sin(t) * d]); }
      return pts;
    };
    const drip = (x, y, len, wid, c, a) => { // a run down from x, y, wandering a little, thinning out
      let dx = 0;
      for (let t = 0; t < len; t += 0.0012) {
        dx += (r() - 0.5) * 0.0005;
        soft(x + dx, y + t, wid * (1 - 0.45 * (t / len)), c, a * Math.pow(1 - t / len, 0.6) * 0.45);
      }
      soft(x + dx, y + len, wid * 0.9, c, a * 0.35); // (the drop it ended in)
    };
    const chip = (x, y, s, run = 0) => { // knocked to the steel, rust round it, and run from it (rustless: to its undercoat)
      const pts = blob(x, y, s);
      soft(x, y, s * 2.3, rustless ? P.primer : P.rust, rustless ? 0.35 : 0.55);
      poly(pts, rustless ? P.primer : P.metal, 1);
      if (run > 0 && !rustless) drip(x, y, run, s * 0.7, P.rust, 0.5);
    };
    const finger = (x, y, s) => { // a fingermark: the whorl, smudged
      const t = r() * 3;
      for (let i = 0; i < 4; i++) {
        const a = 0.07 + r() * 0.07, st = col(P.grime, a);
        if (!st) continue;
        g.save();
        g.translate(x * k, y * k);
        g.rotate(t);
        g.strokeStyle = st;
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(0, 0, Math.max(0.5, (s - i * 0.0012) * k), Math.max(0.4, (s - i * 0.0012) * 0.72 * k), 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      soft(x, y, s * 1.3, P.grime, 0.06);
    };
    const yellowing = (n) => { for (let i = 0; i < n; i++) soft(r() * W, r() * H, 0.03 + r() * 0.1, P.yellow, 0.04 + r() * 0.07); };
    const scatter = (specks, scratches, y0 = 0, y1 = H) => { // spatter dried on in bursts where a pan spat, rust come through a pinhole here and there, a few light scratches
      const bursts = [];
      for (let i = 0, n = 2 + Math.round(specks / 18); i < n; i++) bursts.push([r() * W, y0 + r() * (y1 - y0), 0.008 + r() * 0.03]);
      for (let i = 0; i < specks; i++) {
        let x, y;
        if (r() < 0.75) {
          const [bx, by, sp] = bursts[Math.floor(r() * bursts.length)], t = r() * Math.PI * 2, d = sp * Math.sqrt(-2 * Math.log(1 - r() * 0.999)) * 0.6;
          x = bx + Math.cos(t) * d; y = by + Math.sin(t) * d;
        } else { x = r() * W; y = y0 + r() * (y1 - y0); }
        const s = 0.0005 + r() * 0.0016;
        soft(x, y, s * 2.6, rustless ? P.food : P.speck, 0.3 + r() * 0.3);
        soft(x, y, s, rustless ? P.food : P.speck, 0.95);
      }
      for (let i = 0; i < scratches; i++) {
        const x = r() * W, y = y0 + r() * (y1 - y0), a = r() * Math.PI, l = 0.004 + r() * 0.024, light = r() < 0.6;
        line(x, y, a, l, light ? P.scratch : P.dirt, 0.16 + r() * 0.2);
      }
    };
    const rims = (n, a) => { // grime gathered along its edges, where the cloth never quite gets
      for (let i = 0; i < n; i++) {
        const t = r(), side = Math.floor(r() * 4), d = Math.pow(r(), 2) * 0.012;
        const [x, y] = side === 0 ? [t * W, d] : side === 1 ? [t * W, H - d] : side === 2 ? [d, t * H] : [W - d, t * H];
        soft(x, y, 0.004 + r() * 0.012, P.grime, a * (0.3 + r() * 0.7));
      }
    };
    const edge = (side, s, run = 0, from = 0, to = 1) => { // a chip along one of the part's edges
      const t = from + r() * (to - from), inset = 0.0008 + r() * 0.004;
      const [x, y] = side === 'top' ? [t * W, inset] : side === 'bottom' ? [t * W, H - inset] : side === 'left' ? [inset, t * H] : [W - inset, t * H];
      chip(x, y, s, run);
    };

    if (part === 'hob') {
      yellowing(30);
      band(0, 0.05, P.dust, 0.22, 0); // behind the grates, at the back: a dusty film nobody wipes
      const spill = (x, y, s) => { // an old boil-over, cooked on: a pale brown pool, its rim darker
        const pts = blob(x, y, s, 12);
        poly(pts, P.grease, 0.16 + r() * 0.14, 3);
        rim(pts, P.burnt, 0.22 + r() * 0.18, 1.6, 1.2);
      };
      for (const [x, y, rd, use] of o.burners) {
        soft(x, y, rd + 0.075, P.heat, 0.1 + 0.12 * use); // browned by the heat all round it
        for (let i = 0, n = 40 + Math.round(70 * use); i < n; i++) { // burnt on in a patchy ring just outside it
          const t = r() * Math.PI * 2, d = rd + 0.002 + Math.pow(r(), 1.6) * (0.012 + 0.03 * use);
          soft(x + Math.cos(t) * d, y + Math.sin(t) * d, 0.002 + r() * 0.006, P.burnt, (0.12 + r() * 0.28) * (0.5 + use));
        }
        for (let i = 0, n = 1 + Math.round(2.6 * use); i < n; i++) { // boil-overs that ran out from it
          const t = r() * Math.PI * 2, d = rd + 0.012 + r() * 0.03;
          spill(x + Math.cos(t) * d, y + Math.sin(t) * d, 0.012 + r() * 0.022);
        }
        for (let i = 0, n = 10 + Math.round(22 * use); i < n; i++) { // crumbs burnt black
          const t = r() * Math.PI * 2, d = rd + 0.006 + r() * 0.08;
          soft(x + Math.cos(t) * d, y + Math.sin(t) * d, 0.0005 + r() * 0.001, P.burnt, 0.85);
        }
        for (let i = 0, n = 8 + Math.round(14 * use); i < n; i++) { // scratched where pans were dragged off it
          const t = r() * Math.PI * 2, d = rd + 0.012 + r() * 0.07;
          line(x + Math.cos(t) * d, y + Math.sin(t) * d, t + Math.PI / 2 + (r() - 0.5) * 0.7, 0.004 + r() * 0.02, P.scratch, 0.14 + r() * 0.2);
        }
      }
      for (let i = 0; i < 3; i++) spill(0.08 + r() * (W - 0.16), 0.08 + r() * (H - 0.16), 0.01 + r() * 0.025); // and others, older
      for (const [x, y] of o.feet) { // where the grates' feet stand and are put back: rubbed grey, chipped through at some
        soft(x, y, 0.009, P.dirt, 0.3);
        for (let i = 0; i < 4; i++) line(x + (r() - 0.5) * 0.008, y + (r() - 0.5) * 0.008, r() * Math.PI, 0.003 + r() * 0.008, P.dirt, 0.3);
        if (r() < 0.45) chip(x + (r() - 0.5) * 0.004, y + (r() - 0.5) * 0.004, 0.0012 + r() * 0.0015);
      }
      for (let i = 0; i < 7; i++) edge('bottom', 0.0012 + r() * 0.0028, 0, 0.2, 0.8); // the front edge, knocked by pans
      for (let i = 0; i < 2; i++) { edge('left', 0.0012 + r() * 0.002); edge('right', 0.0012 + r() * 0.002); }
      soft(0.02, 0.015, 0.03, P.rust, 0.28); // the back left corner, against the damp wall: rust coming through
      for (let i = 0; i < 4; i++) chip(0.004 + r() * 0.03, 0.003 + r() * 0.025, 0.001 + r() * 0.002);
      scatter(50, 26);
    } else if (part === 'panel') {
      yellowing(14);
      band(0, 0.022, P.heat, 0.2, 0); // under the hob's lip, browned by what boiled on it
      band(H, H - 0.03, P.heat, 0.24, 0); // along its foot, where the oven's hot air comes out over the door
      // the print, dark grey: the marks round each knob, the burner it works over it (a square, a dot in its
      // corner), an oven over the oven's, the minutes round the timer
      const ink = (a) => col(P.ink, a);
      const dot = (x, y, s, a) => { const st = ink(a); if (!st) return; g.fillStyle = st; g.beginPath(); g.arc(x * k, y * k, s * k, 0, Math.PI * 2); g.fill(); };
      const flame = (x, y, s, a) => {
        const st = ink(a);
        if (!st) return;
        g.fillStyle = st;
        g.beginPath();
        g.moveTo(x * k, (y - s) * k);
        g.quadraticCurveTo((x + s * 0.75) * k, (y + s * 0.15) * k, x * k, (y + s * 0.6) * k);
        g.quadraticCurveTo((x - s * 0.75) * k, (y + s * 0.15) * k, x * k, (y - s) * k);
        g.fill();
      };
      const box = (x, y, s, a) => { const st = ink(a); if (!st) return; g.strokeStyle = st; g.lineWidth = Math.max(1, 0.0007 * k); g.strokeRect((x - s / 2) * k, (y - s / 2) * k, s * k, s * k); };
      for (const [x, y, rd, use, corner] of o.knobs) {
        const a = 0.85 - 0.45 * use * r(); // (rubbed fainter on the ones used most)
        dot(x, y - rd - 0.006, 0.0016, a);
        if (corner) {
          flame(x - rd - 0.008, y, 0.0035, a); // full on, a quarter turn back
          flame(x - (rd + 0.008) * 0.7, y + (rd + 0.008) * 0.7, 0.0022, a); // low, further round
          box(x, o.icons, 0.012, a);
          dot(x + (corner[1] === 'r' ? 0.0032 : -0.0032), o.icons + (corner[0] === 'f' ? 0.0032 : -0.0032), 0.0019, a);
        } else {
          for (let i = 0; i <= 6; i++) { const t = -Math.PI / 2 + (i / 6) * Math.PI * 0.9; line(x + Math.cos(t) * (rd + 0.004), y + Math.sin(t) * (rd + 0.004), t, 0.002 + (i % 2) * 0.0015, P.ink, a, Math.max(1, 0.0006 * k)); }
          box(x, o.icons, 0.012, a);
          line(x - 0.005, o.icons - 0.0035, 0, 0.01, P.ink, a, Math.max(1, 0.0008 * k));
          line(x - 0.005, o.icons + 0.0035, 0, 0.01, P.ink, a, Math.max(1, 0.0008 * k));
        }
      }
      if (o.timer) { const [x, y, rd] = o.timer; for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; line(x + Math.cos(t) * (rd + 0.003), y + Math.sin(t) * (rd + 0.003), t, i % 3 ? 0.0015 : 0.003, P.ink, 0.75, Math.max(1, 0.0006 * k)); } }
      for (const [x, y, rd, use] of o.knobs) { // where fingers go: the print rubbed off in places, grime round and under each knob
        for (let i = 0; i < 6; i++) soft(x + (r() - 0.5) * 0.03, y + (r() - 0.5) * 0.03, 0.004 + r() * 0.006, P.base, 0.5 * use);
        soft(x + 0.003, y + 0.006, rd + 0.024, P.grime, 0.08 + 0.18 * use);
        for (let i = 0, n = 2 + Math.round(6 * use); i < n; i++) finger(x + (r() - 0.5) * 0.06, y + (r() - 0.3) * 0.05, 0.004 + r() * 0.003);
      }
      for (let i = 0; i < 3; i++) drip(0.06 + r() * (W - 0.12), 0, 0.012 + r() * 0.04, 0.0012 + r() * 0.0012, P.grease, 0.55); // boiled over the edge and run down
      for (let i = 0; i < 3; i++) edge('top', 0.0012 + r() * 0.002, 0.004 + r() * 0.01);
      for (let i = 0; i < 2; i++) edge('bottom', 0.001 + r() * 0.002);
      soft(0.008, H - 0.008, 0.016, P.rust, 0.3); // its bottom left corner rusting
      chip(0.004, H - 0.005, 0.0035, 0);
      chip(W - 0.003, 0.004, 0.0025, 0.012);
      rims(120, 0.14);
      scatter(40, 16, 0, H * 0.6);
      scatter(16, 8);
    } else if (part === 'door') {
      const [hx0, hy0, hx1, hy1] = o.hole;
      yellowing(22);
      band(0, 0.03, P.heat, 0.18, 0); // along the top, browned by the hot air out of the oven
      for (let i = 0; i < 180; i++) { // round the window, grease seeped out past the seal, most along its top
        const t = r(), side = r(), d = 0.001 + r() * 0.012;
        const [x, y, a] = side < 0.4 ? [hx0 + t * (hx1 - hx0), hy0 - d, 0.2] : side < 0.6 ? [hx0 + t * (hx1 - hx0), hy1 + d, 0.1] : side < 0.8 ? [hx0 - d, hy0 + t * (hy1 - hy0), 0.12] : [hx1 + d, hy0 + t * (hy1 - hy0), 0.12];
        soft(x, y, 0.003 + r() * 0.006, P.grease, a * (0.4 + r() * 0.6));
      }
      for (let i = 0; i < 26; i++) soft(0.05 + r() * 0.3, o.handle + 0.016 + r() * 0.035, 0.006 + r() * 0.012, P.grime, 0.05 + r() * 0.09); // under the handle, where knuckles touch it as it is pulled (left of the towel)
      for (let i = 0; i < 9; i++) finger(0.05 + r() * 0.32, o.handle + 0.014 + r() * 0.03, 0.004 + r() * 0.003);
      for (let i = 0; i < 10; i++) { // low down, kicked: rubber scuffs from shoes
        const x = 0.04 + r() * (W - 0.08), y = H - 0.004 - r() * 0.06, a = (r() - 0.5) * 0.8, l = 0.008 + r() * 0.035;
        line(x, y, a, l, P.scuff, 0.16 + r() * 0.26, (0.0008 + r() * 0.0015) * k);
      }
      soft(W * 0.74, H - 0.06, 0.02, P.dent, 0.35); // a shallow dent low on the right, a ring of scuff round it
      for (let i = 0; i < 7; i++) edge('bottom', 0.0012 + r() * 0.003);
      chip(0.004, H - 0.005, 0.006, 0.006);
      chip(W - 0.005, H - 0.004, 0.005);
      chip(0.003, 0.004, 0.0025, 0.01);
      for (let i = 0; i < 2; i++) { edge('left', 0.0012 + r() * 0.002, 0.008, 0.5, 1); edge('right', 0.0012 + r() * 0.002, 0.008, 0.5, 1); }
      rims(220, 0.15);
      scatter(70, 30);
    } else if (part === 'drawer') {
      const [g0, g1] = o.groove;
      yellowing(8);
      band(0, H, P.dust, 0, 0.14); // dust settling low down
      for (let i = 0; i < 100; i++) soft(W * (0.18 + r() * 0.64), g0 + r() * (g1 - g0), 0.004 + r() * 0.01, P.grime, 0.05 + r() * 0.1); // dirt in the grip, most where it is pulled
      for (let i = 0; i < 80; i++) soft(r() * W, H - r() * 0.006, 0.002 + r() * 0.006, P.rust, 0.2 + r() * 0.35); // rust along its foot, where the floor is mopped
      for (let i = 0; i < 6; i++) chip(r() * W, H - 0.002 - r() * 0.008, 0.0015 + r() * 0.003);
      chip(0.004, H - 0.006, 0.0045);
      chip(W - 0.004, H - 0.008, 0.0035);
      for (let i = 0; i < 12; i++) { // shoe scuffs
        const x = 0.03 + r() * (W - 0.06), y = H * (0.35 + r() * 0.6), a = (r() - 0.5) * 0.7, l = 0.008 + r() * 0.035;
        line(x, y, a, l, P.scuff, 0.18 + r() * 0.3, (0.0008 + r() * 0.0014) * k);
      }
      rims(90, 0.12);
      scatter(30, 18);
    } else if (part === 'body') {
      yellowing(10);
      band(H - 0.25, H, P.dust, 0, 0.12);
      for (let i = 0; i < 60; i++) soft(r() * W, H - r() * 0.025, 0.003 + r() * 0.01, P.rust, 0.2 + r() * 0.3); // its foot rusting
      for (let i = 0; i < 6; i++) chip(r() * W, H - 0.004 - r() * 0.05, 0.0015 + r() * 0.003, 0.01 * r());
      rims(80, 0.1);
      scatter(40, 14);
    } else if (part === 'mwShell') { // the microwave's case unfolded: its left side (its foot to its top), its top, its right side (down to its foot); y from its back to its front
      const S = o.side, T0 = S, T1 = W - S;
      for (let i = 0; i < 16; i++) soft(T0 + r() * (T1 - T0), r() * H, 0.04 + r() * 0.08, P.pale, 0.1 + r() * 0.12); // the top faded, patchy
      for (let i = 0; i < 260; i++) soft(T0 + r() * (T1 - T0), r() * H, 0.004 + r() * 0.012, P.dust, 0.04 + r() * 0.06); // dust on it
      for (const [x, y, rad, kind] of o.marks) {
        if (kind === 'clean') soft(x, y, rad, P.base, 0.45); // under what stands there, less dust
        else if (kind === 'ring') { // a sticky ring where the jar stood before
          const st = col(P.grease, 0.28);
          if (st) { g.strokeStyle = st; g.lineWidth = 0.0018 * k; g.beginPath(); g.arc(x * k, y * k, rad * k, 0, Math.PI * 2); g.stroke(); }
          soft(x, y, rad * 1.1, P.grease, 0.07);
        } else if (kind === 'flour') for (let i = 0; i < 180; i++) { const t = r() * Math.PI * 2, d = rad * Math.pow(r(), 0.7); soft(x + Math.cos(t) * d, y + Math.sin(t) * d * 0.6, 0.0006 + r() * 0.002, P.flour, 0.25 + r() * 0.45); }
        else if (kind === 'slide') for (let i = 0; i < 6; i++) line(x + (r() - 0.5) * rad, y + (r() - 0.5) * 0.02, Math.PI / 2 + (r() - 0.5) * 0.15, rad * (0.5 + r()), P.scratch, 0.18 + r() * 0.2);
      }
      for (let c2 = 0; c2 < 2; c2++) for (let i = 0; i < 10; i++) { // the vents in the left side, low near its front: slots pressed into it
        const x = 0.03 + i * 0.011, y = H - 0.055 - c2 * 0.034;
        poly([[x - 0.0013, y - 0.0125], [x + 0.0013, y - 0.0125], [x + 0.0013, y + 0.0125], [x - 0.0013, y + 0.0125]], P.metal, 0.95);
        line(x + 0.0022, y - 0.012, Math.PI / 2, 0.024, P.pale, 0.5, Math.max(1, 0.0012 * k));
        soft(x - 0.004, y, 0.006, P.grime, 0.12); // (dust drawn into them)
      }
      for (let i = 0; i < 10; i++) finger(r() < 0.6 ? 0.04 + r() * (S - 0.06) : T1 + 0.02 + r() * (S - 0.06), H - 0.01 - r() * 0.05, 0.005 + r() * 0.003); // where it is taken hold of to move it
      for (let i = 0; i < 120; i++) { const d = Math.pow(r(), 2) * 0.006; soft(r() * W, H - d, 0.003 + r() * 0.008, P.pale, 0.2 + r() * 0.4); } // its front edge rubbed paler
      for (const fx of [S, W - S]) for (let i = 0; i < 50; i++) soft(fx + (r() - 0.5) * 0.008, r() * H, 0.003 + r() * 0.01, P.pale, 0.15 + r() * 0.3); // and the top's edges
      for (const [fx, s] of [[0.002, 1], [W - 0.002, -1]]) { // its foot on the worktop: grimy along it, chipped
        for (let i = 0; i < 40; i++) soft(fx + s * r() * 0.01, r() * H, 0.002 + r() * 0.006, P.grime, 0.12 + r() * 0.25);
        for (let i = 0; i < 4; i++) chip(fx + s * r() * 0.006, r() * H, 0.001 + r() * 0.0025);
      }
      chip(0.004, H - 0.004, 0.004, 0);
      chip(W - 0.004, H - 0.005, 0.0035);
      chip(S + 0.002, H - 0.003, 0.003);
      chip(W - S - 0.003, H - 0.002, 0.0025);
      scatter(24, 30);
    } else if (part === 'mwDoor') {
      for (let i = 0; i < 8; i++) soft(r() * W, r() * H, 0.03 + r() * 0.06, P.pale, 0.06 + r() * 0.08);
      // its free edge, by the keys, where it is pushed shut: the paint rubbed paler, grime, fingermarks
      for (let i = 0; i < 90; i++) soft(W - Math.pow(r(), 2) * 0.012, H * (0.25 + r() * 0.5), 0.003 + r() * 0.008, P.pale, 0.2 + r() * 0.4);
      for (let i = 0; i < 26; i++) soft(W - 0.005 - r() * 0.03, H * (0.3 + r() * 0.4), 0.004 + r() * 0.01, P.grime, 0.05 + r() * 0.1);
      for (let i = 0; i < 7; i++) finger(W - 0.01 - r() * 0.03, H * (0.3 + r() * 0.4), 0.004 + r() * 0.003);
      rims(140, 0.14);
      for (let i = 0; i < 70; i++) soft(r() * W, H - Math.pow(r(), 2) * 0.008, 0.003 + r() * 0.008, P.pale, 0.2 + r() * 0.35); // its foot rubbed
      chip(0.004, H - 0.005, 0.0045, 0.004);
      chip(W - 0.004, H - 0.004, 0.004);
      for (let i = 0; i < 4; i++) edge('bottom', 0.001 + r() * 0.0025);
      for (let i = 0; i < 2; i++) edge('top', 0.001 + r() * 0.002);
      scatter(34, 22);
    } else if (part === 'mwPanel') {
      for (const [x, y, kw, kh, , use] of o.keys) soft(x, y, Math.max(kw, kh) * 0.9, P.grime, 0.05 + 0.2 * use); // grimy round the keys, most round those pressed most
      for (let i = 0; i < 6; i++) finger(0.015 + r() * (W - 0.03), H * (0.3 + r() * 0.6), 0.004 + r() * 0.003);
      rims(80, 0.14);
      for (let i = 0; i < 50; i++) soft(r() * W, H - Math.pow(r(), 2) * 0.008, 0.002 + r() * 0.006, P.pale, 0.2 + r() * 0.35);
      chip(W - 0.004, H - 0.005, 0.0035, 0.003);
      scatter(10, 10);
    } else if (part === 'mwKeys') { // each key: its label, worn off on those pressed most, grey in its middle where the finger goes, dirt round its edge
      for (const [x, y, kw, kh, label, use] of o.keys) {
        soft(x, y, Math.min(kw, kh) * 0.55, P.grime, 0.08 + 0.3 * use);
        const st = col(P.grime, 0.35);
        if (st) { g.strokeStyle = st; g.lineWidth = 0.0012 * k; g.strokeRect((x - kw / 2) * k, (y - kh / 2) * k, kw * k, kh * k); }
        if (mode === 'map') {
          g.fillStyle = `rgba(66,62,56,${0.85 - 0.55 * use})`;
          g.font = `bold ${Math.round((label.length > 2 ? 0.0034 : 0.0062) * k)}px Arial, Helvetica, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(label, x * k, y * k);
        }
        for (let i = 0; i < 3; i++) soft(x + (r() - 0.5) * kw * 0.5, y + (r() - 0.5) * kh * 0.4, kh * 0.25, P.base, 0.5 * use); // (rubbed off)
      }
    } else if (part === 'acFront') { // the air conditioner outside (user, 2026-10-29, after his photo — its wear, not its maker's name)
      band(0, H, P.grime, 0.12, 0.38); // dirtier the lower it goes
      for (let i = 0; i < 26; i++) soft(r() * W, r() * H, 0.05 + r() * 0.12, r() < 0.4 ? P.dust : P.grime, 0.12 + r() * 0.18);
      for (let i = 0; i < 130; i++) drip(r() * W, 0, 0.04 + r() * (r() < 0.35 ? 0.45 : 0.16), 0.002 + r() * 0.006, P.grime, 0.6 + r() * 0.6); // rain run down off its top
      band(0, 0.03, P.grime, 0.35, 0); // and dirt along its top edge, where the rain comes off
      // caked on in patches, as on its grille (user, 2026-10-29), where dirt gathers: round the fan's opening, most
      // under it where what the fan throws settles; along its foot and in its corners; round the screws, the slot,
      // the plate; a little along its top. Dark and patchy, the cream showing through.
      // (laid down as a crust: many small marks run together, a ragged edge where it thins out — not dots)
      const wav = (u, k) => 0.5 + 0.25 * Math.sin(u * 7 + k) + 0.15 * Math.sin(u * 17 + k * 2.1) + 0.1 * Math.sin(u * 41 + k * 3.7); // (0…1, uneven along it)
      const crust = (n, at, a) => { for (let i = 0; i < n; i++) { const [x, y, f] = at(); if (f > 0) soft(x, y, 0.0025 + r() * 0.005, P.caked, a * f * (0.5 + r() * 0.5)); } };
      const [fx, fy, fr] = o.fan;
      crust(1400, () => { // round the opening, a crescent of it heaviest under it
        const t = r() * Math.PI * 2, low = Math.max(0, Math.sin(t)), reach = 0.004 + (0.01 + 0.045 * low) * wav(t, 1), q = r();
        const d = fr + 0.003 + q * reach;
        return [fx + Math.cos(t) * d, fy + Math.sin(t) * d, 1 - q * q];
      }, 0.5);
      crust(1200, () => { const x = r() * W, reach = 0.006 + 0.04 * wav((x / W) * 3, 2), q = r(); return [x, H - q * reach, 1 - q * q]; }, 0.55); // along its foot, ragged
      crust(500, () => { const x = r() * W, reach = 0.003 + 0.016 * wav((x / W) * 3, 5), q = r(); return [x, q * reach, 1 - q]; }, 0.35); // a little along its top
      for (const [cx, cy] of [[0, H], [W, H], [0, 0], [W, 0]]) crust(160, () => { const q = r(), t = r() * Math.PI * 0.5; return [Math.abs(cx - Math.cos(t) * q * 0.06), Math.abs(cy - Math.sin(t) * q * 0.06), 1 - q]; }, cy ? 0.6 : 0.35); // into its corners
      for (const [x, y] of o.screws) crust(70, () => { const q = r(); return [x + (r() - 0.5) * 0.012, y + q * 0.035, 1 - q]; }, 0.55); // run down from its screws
      const [sx0, sy0, sw0, sh0] = o.slot, [px0, py0, pw0, ph0] = o.plate;
      crust(120, () => { const q = r(); return [sx0 + r() * sw0, sy0 + sh0 + q * 0.016, 1 - q]; }, 0.5); // under the slot
      crust(140, () => { const q = r(), under = r() < 0.7; return [px0 + r() * pw0, under ? py0 + ph0 + q * 0.012 : py0 - q * 0.006, 1 - q]; }, 0.45); // round the plate
      const [px, py, pw, ph] = o.plate; // its maker's plate, rusted orange-brown, the name long gone
      poly([[px, py], [px + pw, py], [px + pw, py + ph], [px, py + ph]], P.plate, 0.95);
      for (let i = 0; i < 30; i++) soft(px + r() * pw, py + r() * ph, 0.003 + r() * 0.008, r() < 0.5 ? P.rust : P.grime, 0.3 + r() * 0.4);
      for (let i = 0; i < 9; i++) line(px + pw * (0.08 + i * 0.1), py + ph * (0.3 + r() * 0.2), Math.PI / 2, ph * (0.3 + r() * 0.2), P.groove, 0.35, Math.max(1, 0.002 * k)); // (what is left of its letters)
      drip(px + pw * 0.3, py + ph, 0.06, 0.003, P.rust, 0.6);
      drip(px + pw * 0.8, py + ph, 0.1, 0.004, P.rust, 0.5);
      const [sx, sy, sw, sh] = o.slot;
      poly([[sx, sy], [sx + sw, sy], [sx + sw, sy + sh], [sx, sy + sh]], P.metal, 1);
      rim([[sx, sy], [sx + sw, sy], [sx + sw, sy + sh], [sx, sy + sh]], P.lip, 0.8, Math.max(1, 0.002 * k));
      const [qx, qy, qw, qh] = o.panel, rr = 0.012, corner = (cx, cy, a0) => { const pts = []; for (let i = 0; i <= 4; i++) { const t = a0 + (i / 4) * (Math.PI / 2); pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]); } return pts; };
      const pan = [...corner(qx + qw - rr, qy + rr, -Math.PI / 2), ...corner(qx + qw - rr, qy + qh - rr, 0), ...corner(qx + rr, qy + qh - rr, Math.PI / 2), ...corner(qx + rr, qy + rr, Math.PI)];
      rim(pan, P.groove, 0.5, Math.max(1, 0.003 * k)); // the service panel pressed into it, dirt in its edge
      rim(pan.map(([x, y]) => [x - 0.0015, y - 0.0015]), P.lip, 0.5, Math.max(1, 0.0015 * k));
      for (const [x, y] of o.screws) chip(x, y, 0.0022, 0.05 + r() * 0.1); // its screws rusting, and run
      for (let i = 0; i < 70; i++) soft(r() * W, H - Math.pow(r(), 2) * 0.02, 0.004 + r() * 0.01, P.rust, 0.2 + r() * 0.35); // its foot
      for (let i = 0; i < 6; i++) edge('bottom', 0.002 + r() * 0.004, 0);
      chip(0.006, H - 0.008, 0.006, 0.02);
      chip(W - 0.005, H - 0.006, 0.005, 0.03);
      rims(200, 0.2);
      scatter(30, 40);
    } else if (part === 'handle') {
      for (const [cx, a] of [[W * 0.36, 0.24], [W * 0.56, 0.12]]) { // greyed where hands take it, the left more (the towel hangs on the right)
        for (let i = 0; i < 30; i++) soft(cx + (r() - 0.5) * 0.12, r() * H, 0.005 + r() * 0.01, P.grime, a * (0.3 + r() * 0.5));
      }
      band(0, H, P.yellow, 0, 0.18); // yellower underneath, out of the light
      scatter(5, 12);
    }
  };
  return {
    map: canvasTex(w, h, draw('map')),
    bump: canvasTex(w, h, draw('bump'), { data: true }),
    rough: canvasTex(w, h, draw('rough'), { data: true }),
  };
}

/**
 * The oven door's glass: a black border printed round it (`edge` metres wide, from the glass's own edge), and
 * through it the door's inside — its fine square screen, the oven dark behind, grease spattered on the inside of
 * the glass, most at the foot, and one run of it. `W` × `H` metres. Returns { map, glow } (glow: where the oven's
 * lamp shows through when it is on).
 */
export function cookerGlassTex(W, H, edge, seed = 3307) {
  const k = 1700, w = Math.round(W * k), h = Math.round(H * k), e = edge * k, rad = 0.014 * k;
  const pane = (g) => {
    g.beginPath();
    g.roundRect(e, e, w - 2 * e, h - 2 * e, rad);
  };
  const map = canvasTex(w, h, (g) => {
    const r = mulberry32(seed);
    g.fillStyle = '#121010';
    g.fillRect(0, 0, w, h);
    g.save();
    pane(g);
    g.clip();
    let gr = g.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.55); // the oven: a little lighter at its back
    gr.addColorStop(0, '#4a4239');
    gr.addColorStop(1, '#1e1914');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(130,122,108,0.34)'; // the screen inside the door, 3 mm squares
    g.lineWidth = 1;
    for (let x = e; x < w - e; x += 0.003 * k) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = e; y < h - e; y += 0.003 * k) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    gr = g.createLinearGradient(0, h - e - 0.07 * k, 0, h - e); // grease baked on low down
    gr.addColorStop(0, 'rgba(84,54,26,0)');
    gr.addColorStop(1, 'rgba(84,54,26,0.45)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { // and spattered over it
      const x = r() * w, y = h * Math.pow(r(), 0.6), s = (0.0006 + r() * 0.003) * k, a = 0.2 + r() * 0.35;
      const sg = g.createRadialGradient(x, y, 0, x, y, s);
      sg.addColorStop(0, `rgba(112,72,34,${a})`);
      sg.addColorStop(1, 'rgba(112,72,34,0)');
      g.fillStyle = sg;
      g.fillRect(x - s, y - s, s * 2, s * 2);
    }
    let x = e + 0.12 * k; // one run, down from a splash
    for (let y = e + 0.05 * k; y < h - e; y += 2) { x += (r() - 0.5) * 1.2; g.fillStyle = 'rgba(100,64,30,0.1)'; g.fillRect(x - 2, y, 4, 2); }
    g.restore();
  });
  const glow = canvasTex(w, h, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    pane(g);
    g.clip();
    const gr = g.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.6); // the lamp high at the back
    gr.addColorStop(0, '#9a9a9a');
    gr.addColorStop(1, '#1c1c1c');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  return { map, glow };
}

/**
 * Old handling on a printed pack, over its whole picture: the print faded unevenly, rubbed to the grey board along
 * the folds (`folds`: x positions in pixels) and its top and foot, a grease spot soaked in, creases.
 */
function packWear(g, w, h, r, folds) {
  g.save(); // the colours gone flat and yellowed, as print kept in a kitchen does (user, 2026-10-29: "too clean, AI")
  g.globalCompositeOperation = 'saturation';
  g.fillStyle = 'rgba(128,128,128,0.5)';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = 'rgba(212,198,168,0.45)';
  g.fillRect(0, 0, w, h);
  g.restore();
  speckle(g, w, h, Math.round(w * h * 0.02), 'rgba(90,76,56,1)', 1.1, 6401); // grime ground in
  for (let i = 0; i < 26; i++) { // grey where fingers take it, more low down
    const x = r() * w, y = h * (0.35 + r() * 0.6), s = 8 + r() * 22, gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, `rgba(96,86,70,${0.06 + r() * 0.1})`);
    gr.addColorStop(1, 'rgba(96,86,70,0)');
    g.fillStyle = gr;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  for (const x of folds) { // dirt along the folds
    const gr = g.createLinearGradient(x - 8, 0, x + 8, 0);
    gr.addColorStop(0, 'rgba(80,68,50,0)');
    gr.addColorStop(0.5, 'rgba(80,68,50,0.28)');
    gr.addColorStop(1, 'rgba(80,68,50,0)');
    g.fillStyle = gr;
    g.fillRect(x - 8, 0, 16, h);
  }
  const tide = h * (0.86 + r() * 0.08); // stood in something wet once: a tide line across part of its foot
  g.beginPath();
  g.moveTo(w * 0.1, h);
  for (let x = w * 0.1; x <= w * 0.7; x += 6) g.lineTo(x, tide + Math.sin(x * 0.05) * 3 + r() * 2);
  g.lineTo(w * 0.7, h);
  g.closePath();
  g.fillStyle = 'rgba(130,104,66,0.14)';
  g.fill();
  g.strokeStyle = 'rgba(110,84,50,0.35)';
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = 'rgba(236,230,214,0.14)';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) {
    const x = r() * w, y = r() * h, s = 20 + r() * 60, gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, `rgba(236,230,214,${0.08 + r() * 0.12})`);
    gr.addColorStop(1, 'rgba(236,230,214,0)');
    g.fillStyle = gr;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  const rub = (x, y) => { const s = 1.5 + r() * 4, gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, `rgba(196,186,166,${0.4 + r() * 0.5})`); gr.addColorStop(1, 'rgba(196,186,166,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2); };
  for (const x of folds) for (let i = 0; i < 60; i++) rub(x + (r() - 0.5) * 5, r() * h);
  for (let i = 0; i < 90; i++) rub(r() * w, r() < 0.5 ? r() * 4 : h - r() * 4);
  const x = r() * w, y = h * (0.3 + r() * 0.5), s = 10 + r() * 14, gr = g.createRadialGradient(x, y, 0, x, y, s);
  gr.addColorStop(0, 'rgba(120,96,56,0.22)');
  gr.addColorStop(0.8, 'rgba(120,96,56,0.16)');
  gr.addColorStop(1, 'rgba(120,96,56,0)');
  g.fillStyle = gr;
  g.fillRect(x - s, y - s, s * 2, s * 2);
  for (let i = 0; i < 5; i++) { // creases: a light line with its shadow
    const cx = r() * w, cy = r() * h, a = r() * Math.PI, l = 20 + r() * 60;
    for (const [dx, c] of [[0, 'rgba(240,236,226,0.35)'], [1.2, 'rgba(60,50,40,0.18)']]) {
      g.strokeStyle = c;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx + dx, cy + dx);
      g.lineTo(cx + Math.cos(a) * l + dx, cy + Math.sin(a) * l + dx);
      g.stroke();
    }
  }
}

/** Lines of small print: grey bars of words, `n` lines from x, y, `lw` wide, `lh` apart. */
function smallPrint(g, r, x, y, lw, lh, n, color) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    let cx = x;
    const end = x + lw * (i === n - 1 ? 0.3 + r() * 0.5 : 0.9 + r() * 0.1);
    while (cx < end) { const ww = 3 + r() * 12; g.fillRect(cx, y + i * lh, Math.min(ww, end - cx), lh * 0.45); cx += ww + 2.5; }
  }
}

/**
 * Old chrome, a stretch of it that repeats (`period` metres): smudged with fingers and grease, swirled with fine
 * scratches from wiping, a few pits gone dull. Returns { map, rough }: map tints it (greys, a warm cast where grease
 * sits), rough for a roughness of 1 (bright chrome low, the smudges higher).
 */
export function chromeWearTex(seed = 6501) {
  const draw = (rough) => (g, w, h) => {
    const r = mulberry32(seed);
    g.fillStyle = rough ? '#2e2e2e' : '#d8d8d8';
    g.fillRect(0, 0, w, h);
    const blot = (x, y, s, c) => wrapped(w, h, (dx, dy) => { const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, s); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + dx - s, y + dy - s, s * 2, s * 2); });
    for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h, s = 20 + r() * 50, a = 0.15 + r() * 0.25; blot(x, y, s, rough ? `rgba(120,120,120,${a})` : `rgba(150,140,120,${a * 0.6})`); } // smears of grease
    for (let i = 0; i < 18; i++) { // fingermarks
      const x = r() * w, y = r() * h, t = r() * 3;
      for (let j = 0; j < 4; j++) {
        g.save(); g.translate(x, y); g.rotate(t);
        g.strokeStyle = rough ? 'rgba(150,150,150,0.5)' : 'rgba(140,132,118,0.3)';
        g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(0, 0, 12 - j * 2.6, 9 - j * 2, 0, 0, Math.PI * 2); g.stroke();
        g.restore();
      }
    }
    for (let i = 0; i < 160; i++) { // fine scratches, curved, from wiping
      const x = r() * w, y = r() * h, rad = 20 + r() * 80, a0 = r() * 6.3;
      g.strokeStyle = rough ? `rgba(110,110,110,${0.3 + r() * 0.3})` : `rgba(235,235,235,${0.15 + r() * 0.2})`;
      g.lineWidth = 0.6;
      g.beginPath(); g.arc(x, y, rad, a0, a0 + 0.1 + r() * 0.3); g.stroke();
    }
    for (let i = 0; i < 40; i++) blot(r() * w, r() * h, 1.5 + r() * 3, rough ? 'rgba(200,200,200,0.9)' : 'rgba(110,104,96,0.7)'); // pits
  };
  return {
    map: canvasTex(256, 256, draw(false), { repeat: [1, 1] }),
    rough: canvasTex(256, 256, draw(true), { repeat: [1, 1], data: true }),
  };
}

/**
 * Inside the air conditioner, behind its fan: the coil's fins, close upright lines of thin metal, cream gone grey with
 * dust packed into them, darker in patches and low down.
 */
export function acInsideTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = mulberry32(6601);
    g.fillStyle = '#b9b09a';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) { g.fillStyle = x % 4 ? 'rgba(80,72,58,0.35)' : 'rgba(236,228,206,0.25)'; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 40; i++) {
      const x = r() * w, y = r() * h, s = 10 + r() * 40, gr = g.createRadialGradient(x, y, 0, x, y, s);
      gr.addColorStop(0, `rgba(84,74,58,${0.15 + r() * 0.25})`);
      gr.addColorStop(1, 'rgba(84,74,58,0)');
      g.fillStyle = gr;
      g.fillRect(x - s, y - s, s * 2, s * 2);
    }
    const low = g.createLinearGradient(0, h * 0.5, 0, h);
    low.addColorStop(0, 'rgba(70,62,48,0)');
    low.addColorStop(1, 'rgba(70,62,48,0.4)');
    g.fillStyle = low;
    g.fillRect(0, 0, w, h);
  });
}

/**
 * A fan grille's wire, white once (user, 2026-10-29: "white but very dirty, that's why it looks black"): along it,
 * grime caked dark brown-grey over most of it, the white showing through only in short patches. Repeats along the wire.
 */
export function dirtyWireTex() {
  return canvasTex(256, 16, (g, w, h) => {
    const r = mulberry32(6611);
    g.fillStyle = '#5a5246';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { const x = r() * w, l = 4 + r() * 22; g.fillStyle = `rgba(206,198,176,${0.35 + r() * 0.45})`; g.fillRect(x, 0, l, h); } // the white showing through
    for (let i = 0; i < 60; i++) { const x = r() * w, l = 2 + r() * 10; g.fillStyle = `rgba(52,46,38,${0.3 + r() * 0.5})`; g.fillRect(x, r() * h * 0.5, l, h * (0.5 + r() * 0.5)); } // caked on
  }, { repeat: [6, 1] });
}

/**
 * A carton's print, its faces laid out flat (user, 2026-10-29, with a picture of a microwave with these on it — their
 * feel, not their print: no brand on them): along the top row its front, right side, back and left side, under them
 * its top; `w` × `h` × `d` metres. 'biscuits': cream, a sky band with the sun coming up in it, the name, biscuits
 * drawn under it, the facts on one side, a barcode on the other; 'tea': yellow-green, its name over a cup steaming.
 * Old and handled (packWear).
 */
export function cartonTex(kind, w, h, d) {
  const k = 2000, W = Math.round(2 * (w + d) * k), H = Math.round((h + d) * k), fh = h * k;
  return canvasTex(W, H, (g) => {
    const r = mulberry32(kind === 'tea' ? 6201 : 6101);
    const tea = kind === 'tea';
    const C = tea ? { ground: '#c4bd62', top: '#ece2c2', ink: '#36522a', accent: '#9c3d27', side: '#b2ab55' } : { ground: '#e8dabc', top: '#8eb1c9', ink: '#7a3d18', accent: '#e5a332', side: '#dccfae' };
    g.fillStyle = C.ground;
    g.fillRect(0, 0, W, H);
    const xs = [0, w * k, (w + d) * k, (2 * w + d) * k], ws = [w * k, d * k, w * k, d * k];
    const text = (s, x, y, size, color, font = 'bold', family = 'Arial, Helvetica, sans-serif', stroke = null) => {
      g.font = `${font} ${Math.round(size)}px ${family}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.filter = 'blur(0.5px)'; // (printed on board, not drawn crisp)
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = size * 0.16; g.lineJoin = 'round'; g.strokeText(s, x, y); }
      g.fillStyle = color;
      g.fillText(s, x, y);
      g.filter = 'none';
    };
    for (const i of [1, 3]) { g.fillStyle = C.side; g.fillRect(xs[i], 0, ws[i], fh); }
    if (!tea) {
      for (const i of [0, 2]) { // front and back alike: the sky band, the sun in it, the name, the biscuits
        const x0 = xs[i], fw = ws[i], cx = x0 + fw / 2;
        const sky = g.createLinearGradient(0, 0, 0, fh * 0.42);
        sky.addColorStop(0, '#7fa5c0');
        sky.addColorStop(1, '#cfdde0');
        g.fillStyle = sky;
        g.fillRect(x0, 0, fw, fh * 0.42);
        g.save();
        g.beginPath();
        g.rect(x0, 0, fw, fh * 0.42);
        g.clip();
        g.fillStyle = '#f0bf4c';
        for (let a = 0; a < 12; a++) { const t = Math.PI + (a + 0.5) * (Math.PI / 12); g.beginPath(); g.moveTo(cx, fh * 0.42); g.lineTo(cx + Math.cos(t - 0.06) * fw, fh * 0.42 + Math.sin(t - 0.06) * fw); g.lineTo(cx + Math.cos(t + 0.06) * fw, fh * 0.42 + Math.sin(t + 0.06) * fw); g.closePath(); g.globalAlpha = 0.35; g.fill(); }
        g.globalAlpha = 1;
        g.beginPath();
        g.arc(cx, fh * 0.42, fw * 0.24, Math.PI, 0);
        g.fill();
        g.restore();
        g.fillStyle = C.accent;
        g.fillRect(x0, fh * 0.42, fw, fh * 0.012);
        text('Biscuits', cx, fh * 0.5, fw * 0.24, C.ink, 'italic bold', 'Georgia, "Times New Roman", serif', '#f4ead2');
        text('BUTTER & OAT', cx, fh * 0.585, fw * 0.075, '#8a5a32');
        for (const [bx, by, br] of [[-0.2, 0.74, 0.2], [0.17, 0.72, 0.19], [0, 0.8, 0.21]]) { // the biscuits, golden, docked
          const px = cx + bx * fw, py = fh * by, pr = br * fw, gr = g.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr);
          gr.addColorStop(0, '#e2b067');
          gr.addColorStop(0.85, '#c88c3e');
          gr.addColorStop(1, '#9c6428');
          g.fillStyle = gr;
          g.beginPath();
          g.arc(px, py, pr, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(110,64,24,0.6)';
          for (let j = 0; j < 7; j++) { const t = (j / 7) * Math.PI * 2; g.beginPath(); g.arc(px + Math.cos(t) * pr * 0.5, py + Math.sin(t) * pr * 0.5, pr * 0.05, 0, Math.PI * 2); g.fill(); }
        }
        text('250 g', x0 + fw * 0.8, fh * 0.95, fw * 0.07, C.ink);
      }
      // the right side: the facts in a box; the left: what is in them, a barcode, the date
      const x1 = xs[1] + 8, f1 = ws[1] - 16;
      g.strokeStyle = '#3c3a36';
      g.lineWidth = 1.5;
      g.strokeRect(x1, fh * 0.1, f1, fh * 0.5);
      text('Nutrition Information', xs[1] + ws[1] / 2, fh * 0.13, f1 * 0.085, '#3c3a36');
      for (let i = 0; i < 11; i++) { g.fillStyle = 'rgba(60,58,54,0.5)'; g.fillRect(x1, fh * (0.17 + i * 0.038), f1, 1); }
      smallPrint(g, r, x1 + 2, fh * 0.18, f1 * 0.6, fh * 0.038, 11, 'rgba(60,58,54,0.55)');
      smallPrint(g, r, x1, fh * 0.66, f1, 9, 8, 'rgba(60,58,54,0.5)');
      const x3 = xs[3] + 8, f3 = ws[3] - 16;
      text('INGREDIENTS', xs[3] + ws[3] / 2, fh * 0.1, f3 * 0.1, C.ink);
      smallPrint(g, r, x3, fh * 0.14, f3, 9, 16, 'rgba(60,58,54,0.5)');
      g.fillStyle = '#f4efe2';
      g.fillRect(x3 + f3 * 0.1, fh * 0.72, f3 * 0.8, fh * 0.17);
      g.fillStyle = '#1c1b1a';
      for (let bx = x3 + f3 * 0.15; bx < x3 + f3 * 0.85; bx += 2 + r() * 3) g.fillRect(bx, fh * 0.735, 1 + Math.floor(r() * 2.5), fh * 0.12);
    } else {
      for (const i of [0, 2]) {
        const x0 = xs[i], fw = ws[i], cx = x0 + fw / 2;
        g.fillStyle = C.top;
        g.fillRect(x0, 0, fw, fh * 0.42);
        g.fillStyle = C.ink;
        g.fillRect(x0, fh * 0.42, fw, fh * 0.02);
        text('TEA', cx, fh * 0.17, fw * 0.3, C.ink, 'bold', 'Georgia, "Times New Roman", serif');
        text('BAGS', cx, fh * 0.32, fw * 0.17, C.ink);
        const px = cx + fw * 0.05, py = fh * 0.72; // the cup, steaming
        g.fillStyle = C.accent;
        g.beginPath();
        g.moveTo(px - fw * 0.2, py - fh * 0.1);
        g.lineTo(px + fw * 0.2, py - fh * 0.1);
        g.quadraticCurveTo(px + fw * 0.19, py + fh * 0.06, px, py + fh * 0.07);
        g.quadraticCurveTo(px - fw * 0.19, py + fh * 0.06, px - fw * 0.2, py - fh * 0.1);
        g.fill();
        g.lineWidth = fw * 0.035;
        g.strokeStyle = C.accent;
        g.beginPath();
        g.arc(px + fw * 0.22, py - fh * 0.04, fw * 0.06, -Math.PI / 2, Math.PI / 2);
        g.stroke();
        g.fillRect(px - fw * 0.3, py + fh * 0.075, fw * 0.6, fh * 0.012);
        g.strokeStyle = 'rgba(54,82,42,0.7)';
        g.lineWidth = fw * 0.02;
        for (const sx of [-0.08, 0.02, 0.12]) { g.beginPath(); g.moveTo(px + sx * fw, py - fh * 0.12); g.bezierCurveTo(px + (sx - 0.06) * fw, py - fh * 0.17, px + (sx + 0.06) * fw, py - fh * 0.21, px + sx * fw, py - fh * 0.26); g.stroke(); }
        text('40', x0 + fw * 0.18, fh * 0.5, fw * 0.12, C.ink);
      }
      for (const i of [1, 3]) smallPrint(g, r, xs[i] + 6, fh * 0.12, ws[i] - 12, 9, 14, 'rgba(54,82,42,0.55)');
    }
    g.fillStyle = tea ? C.top : '#d8cbac'; // its top
    g.fillRect(0, fh, W, H - fh);
    if (!tea) { // a price sticker on its front, half peeled off
      g.save();
      g.translate(w * k * 0.72, fh * 0.9);
      g.rotate(-0.25);
      g.fillStyle = '#d98a46';
      g.fillRect(-26, -10, 52, 20);
      g.fillStyle = '#3a2a1c';
      g.font = 'bold 13px Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('0.89', -2, 0);
      g.fillStyle = '#efe6cf'; // its corner come up, the glue's grey patch under it
      g.beginPath();
      g.moveTo(26, -10);
      g.lineTo(12, -10);
      g.lineTo(26, 4);
      g.closePath();
      g.fill();
      g.restore();
    }
    packWear(g, W, H, r, xs.slice(1).concat([W]));
  });
}

/**
 * A plastic jar of peanut butter's outside, round it (u) and up it (v): the spread through the plastic, brown, low
 * down; a teal label round its middle, an orange oval on its front with the name (no brand), the small print and a
 * barcode at its back where the label's ends meet, one end lifting; a smear of it on the label by the lid; above the
 * label, the spread scraped down inside, streaky. `l0`, `l1`: the label's foot and top, as a part of the way up.
 */
export function jarLabelTex(l0, l1) {
  return canvasTex(512, 256, (g, w, h) => {
    const r = mulberry32(6301);
    const y0 = (1 - l1) * h, y1 = (1 - l0) * h;
    const pb = g.createLinearGradient(0, 0, 0, h);
    pb.addColorStop(0, '#6a4a2c');
    pb.addColorStop(1, '#8c5a2a');
    g.fillStyle = pb;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { // scraped down inside, above where it is now
      g.fillStyle = `rgba(${r() < 0.5 ? '178,140,92' : '74,48,26'},${0.15 + r() * 0.25})`;
      const x = r() * w;
      g.fillRect(x, r() * y0 * 0.7, 2 + r() * 8, y0 * (0.3 + r() * 0.5));
    }
    g.fillStyle = '#3c8689';
    g.fillRect(0, y0, w, y1 - y0);
    g.fillStyle = '#e9dfc4';
    g.fillRect(0, y0 + 4, w, 3);
    g.fillRect(0, y1 - 7, w, 3);
    const cx = w * 0.5, cy = (y0 + y1) / 2; // its front
    g.fillStyle = '#e9dfc4';
    g.beginPath();
    g.ellipse(cx, cy, w * 0.14, (y1 - y0) * 0.36, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#df8a2e';
    g.beginPath();
    g.ellipse(cx, cy, w * 0.13, (y1 - y0) * 0.33, 0, 0, Math.PI * 2);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fbf3df';
    g.font = 'bold 30px "Arial Black", Arial, sans-serif';
    g.fillText('PEANUT', cx, cy - 15);
    g.fillText('BUTTER', cx, cy + 16);
    g.font = 'bold 12px Arial, sans-serif';
    g.fillStyle = '#e9dfc4';
    g.fillText('SMOOTH', cx, y1 - 18);
    g.fillText('NET WT 510 g', w * 0.78, y1 - 18);
    smallPrint(g, r, w * 0.03, y0 + 16, w * 0.2, 8, 9, 'rgba(233,223,196,0.7)');
    g.fillStyle = '#efe8d6';
    g.fillRect(w * 0.9, y0 + 18, w * 0.08, (y1 - y0) * 0.5);
    g.fillStyle = '#1c1b1a';
    for (let bx = w * 0.905; bx < w * 0.975; bx += 2 + r() * 2) g.fillRect(bx, y0 + 22, 1, (y1 - y0) * 0.42);
    g.fillStyle = '#7a4e26'; // a strip of the label torn away, the spread showing through
    g.beginPath();
    g.moveTo(w * 0.63, y0);
    for (let y = y0; y <= y1; y += 6) g.lineTo(w * 0.63 + Math.sin(y * 0.3) * 4 + r() * 4, y);
    for (let y = y1; y >= y0 + (y1 - y0) * 0.35; y -= 6) g.lineTo(w * 0.69 + r() * 5, y);
    g.lineTo(w * 0.66, y0 + (y1 - y0) * 0.3);
    g.closePath();
    g.fill();
    packWear(g, w, h, r, [0, w]);
    const lift = g.createLinearGradient(w - 26, 0, w, 0); // the label's end lifting, its glue gone grey
    lift.addColorStop(0, 'rgba(60,50,40,0)');
    lift.addColorStop(1, 'rgba(60,50,40,0.35)');
    g.fillStyle = lift;
    g.fillRect(w - 26, y0, 26, y1 - y0);
    const sx = w * 0.42, sy = y0 + 8, gr = g.createRadialGradient(sx, sy, 0, sx, sy, 22); // a smear of it, from a finger, by the lid
    gr.addColorStop(0, 'rgba(120,76,36,0.75)');
    gr.addColorStop(0.7, 'rgba(120,76,36,0.4)');
    gr.addColorStop(1, 'rgba(120,76,36,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(sx, sy, 22, 9, 0.2, 0, Math.PI * 2);
    g.fill();
  });
}

/**
 * The cooker's cast-iron grates, seen from above over the hob (`W` × `H` metres, `burners` [x, y, r, use] on it):
 * black, grainy; rubbed to grey metal on the fingers' tops where pans sit and slide, most over the burners used
 * most; burnt brown nearer the flame; browned and rusting a little at their outer edges.
 */
export function cookerGrateTex(W, H, burners) {
  const w = 512, k = w / W, h = Math.round(H * k);
  return canvasTex(w, h, (g) => {
    const r = mulberry32(5521);
    g.fillStyle = '#1d1b1a';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, '#3c3936', 1.2, 5522);
    const soft = (x, y, s, c) => { const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, s * 2, s * 2); };
    for (let i = 0; i < 90; i++) { // the outer edges
      const t = r(), side = Math.floor(r() * 4), d = r() * 0.02 * k;
      const [x, y] = side === 0 ? [t * w, d] : side === 1 ? [t * w, h - d] : side === 2 ? [d, t * h] : [w - d, t * h];
      soft(x, y, (0.004 + r() * 0.01) * k, `rgba(98,58,32,${0.15 + r() * 0.25})`);
    }
    for (const [bx, by, rd, use] of burners) {
      for (let i = 0; i < 140; i++) { // rubbed grey where the pans sit
        const t = r() * Math.PI * 2, d = (rd + 0.004 + r() * 0.05) * k;
        soft(bx * k + Math.cos(t) * d, by * k + Math.sin(t) * d, (0.002 + r() * 0.005) * k, `rgba(128,124,118,${(0.12 + 0.3 * use) * r()})`);
      }
      for (let i = 0; i < 60; i++) { // burnt brown nearer the flame
        const t = r() * Math.PI * 2, d = (rd - 0.004 + r() * 0.016) * k;
        soft(bx * k + Math.cos(t) * d, by * k + Math.sin(t) * d, (0.003 + r() * 0.004) * k, `rgba(90,58,32,${0.2 + r() * 0.3})`);
      }
    }
  });
}

/**
 * A gas burner's crown, round its side (u once round, v up): dull aluminium blackened by its flame towards the
 * top, `n` ports cut down from its top edge, grease browned on.
 */
export function burnerCrownTex(n) {
  return canvasTex(256, 32, (g, w, h) => {
    g.fillStyle = '#75716a';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 300, '#4a4640', 1.4, 7710 + n);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(34,28,22,0.7)');
    gr.addColorStop(1, 'rgba(60,44,28,0.15)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0e0c0b';
    for (let i = 0; i < n; i++) g.fillRect((i + 0.5) * (w / n) - 2.5, 0, 5, h * 0.42);
  });
}

/**
 * The kitchen's hand towel: its old blue plaid (plaidTex), now in terry like the bathroom's towel (user,
 * 2026-10-20: "its stuff and how it's made, not its look" — the material, the loops, not the white and the
 * bands): the checks woven into the pile, each about 9 cm square on it (`len` along it, `wid` across), faded with
 * washing, stained — tea, something tomato, grease — the marks dried with darker rims, the most where hands
 * wipe and along its ends; a scorch from the oven door.
 */
export function kitchenTowelTex(len = 0.78, wid = 0.26) {
  const plaid = plaidTex().image;
  return canvasTex(256, 512, (g, w, h) => {
    const r = mulberry32(5521), tw = w / (wid / 0.087), th = h / (len / 0.087);
    for (let y = 0; y < h; y += th) for (let x = 0; x < w; x += tw) g.drawImage(plaid, x, y, tw, th);
    speckle(g, w, h, 14000, '#1c2238', 1.1, 5522); // the loops of the pile, in shadow and catching the light
    speckle(g, w, h, 9000, '#c9cedc', 1.0, 5523);
    g.fillStyle = 'rgba(206,200,184,0.16)'; // faded with washing
    g.fillRect(0, 0, w, h);
    // a stain as it really dries into cloth (user, 2026-10-20: "halos, not pointed shapes"): a soft blot of a few
    // overlapping rounds, paler inside, the colour gathered at its edge into a darker ring that fades both ways
    const stain = (x, y, rad, rgb, a) => {
      for (let k = 0; k < 4; k++) {
        const cx = x + (r() - 0.5) * rad * 0.7, cy = y + (r() - 0.5) * rad * 0.6, rr = rad * (0.6 + r() * 0.4), sq = 0.75 + r() * 0.4;
        g.save(); g.translate(cx, cy); g.scale(1, sq);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, rr);
        gr.addColorStop(0, `rgba(${rgb},${a * 0.35})`); gr.addColorStop(0.62, `rgba(${rgb},${a * 0.45})`); gr.addColorStop(0.84, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    };
    // (on the dark blue the first ones didn't show — user, 2026-10-20: yellowed, browned and bleached, bigger)
    for (let i = 0; i < 10; i++) stain(r() * w, h * (0.2 + r() * 0.6), 12 + r() * 22, ['176,132,62', '168,96,52', '150,112,60'][i % 3], 0.3 + r() * 0.16); // tea, tomato, gravy
    for (let i = 0; i < 4; i++) stain(r() * w, h * (0.2 + r() * 0.6), 14 + r() * 16, '214,206,182', 0.24 + r() * 0.12); // bleach, splashed
    for (let i = 0; i < 6; i++) stain(r() * w, h * (r() < 0.5 ? 0.04 + r() * 0.15 : 0.8 + r() * 0.15), 14 + r() * 24, '150,128,84', 0.24 + r() * 0.12); // grease, grime, at the ends that hang lowest
    let gr = g.createRadialGradient(w * 0.55, h * 0.5, 0, w * 0.55, h * 0.5, w * 0.7); // where hands wipe: the middle, over the bar
    gr.addColorStop(0, 'rgba(110,100,80,0.18)'); gr.addColorStop(1, 'rgba(110,100,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    gr = g.createRadialGradient(w * 0.3, h * 0.58, 0, w * 0.3, h * 0.58, 22); // a scorch
    gr.addColorStop(0, 'rgba(70,46,24,0.7)'); gr.addColorStop(0.6, 'rgba(110,76,40,0.35)'); gr.addColorStop(1, 'rgba(110,76,40,0)');
    g.fillStyle = gr; g.fillRect(w * 0.3 - 22, h * 0.58 - 22, 44, 44);
    // a little hole torn in it (user, 2026-10-20): ragged, the loops pulled loose round them, pale; cut out of
    // the alpha (the material keeps what has alpha over a half)
    for (const [cx, cy, rad] of [[w * 0.22, h * 0.86, 6]]) { // (one: the other, top right, went — user, 2026-10-20)
      const pts = [];
      for (let k = 0; k < 16; k++) { const t = (k / 16) * Math.PI * 2, d = rad * (0.55 + r() * 0.7); pts.push([cx + Math.cos(t) * d * 1.3, cy + Math.sin(t) * d]); }
      const ring = () => { g.beginPath(); pts.forEach(([px, py], k) => g[k ? 'lineTo' : 'moveTo'](px, py)); g.closePath(); };
      ring(); g.strokeStyle = 'rgba(216,212,198,0.85)'; g.lineWidth = 4; g.stroke(); // frayed, pale threads
      for (let k = 0; k < 12; k++) { const t = r() * Math.PI * 2, x0 = cx + Math.cos(t) * rad * 1.1, y0 = cy + Math.sin(t) * rad * 0.9; g.strokeStyle = 'rgba(220,216,204,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 - Math.cos(t) * (3 + r() * 6), y0 - Math.sin(t) * (3 + r() * 6)); g.stroke(); }
      g.save(); g.globalCompositeOperation = 'destination-out'; ring(); g.fillStyle = '#000'; g.fill(); g.restore();
    }
  });
}

/**
 * The house's foundation (user, 2026-10-20: the house raised on it): old poured concrete, grey, the lines of its
 * shuttering boards across it, darker and greener from the ground up where the wet rises, streaks down from the
 * sill above, a crack or two, a patch made good. Tiles along (u: 2.4 m), v from the ground (0) up 1.2 m.
 */
export function foundationTex() {
  return canvasTex(1024, 512, (g, w, h) => {
    const r = mulberry32(9301);
    g.fillStyle = '#8a857b';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { // mottle
      const x = r() * w, y = r() * h, rad = 20 + r() * 90, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${r() < 0.5 ? '110,104,94' : '160,154,142'},${0.08 + r() * 0.1})`); gr.addColorStop(1, 'rgba(130,124,114,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let y = 0; y < h; y += 64 + r() * 20) { g.fillStyle = 'rgba(70,66,58,0.18)'; g.fillRect(0, y, w, 2); } // the shuttering's lines
    let gr = g.createLinearGradient(0, h, 0, h * 0.45); // the wet, rising from the ground
    gr.addColorStop(0, 'rgba(62,70,52,0.55)'); gr.addColorStop(0.5, 'rgba(70,74,58,0.22)'); gr.addColorStop(1, 'rgba(70,74,58,0)');
    g.fillStyle = gr; g.fillRect(0, h * 0.45, w, h * 0.55);
    for (let i = 0; i < 26; i++) { // streaks down from the top
      const x = r() * w, l = h * (0.2 + r() * 0.6), wd = 3 + r() * 10;
      gr = g.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, 'rgba(60,54,46,0.3)'); gr.addColorStop(1, 'rgba(60,54,46,0)');
      g.fillStyle = gr; g.fillRect(x, 0, wd, l);
    }
    for (let i = 0; i < 3; i++) { // cracks
      let x = r() * w, y = r() * h * 0.3;
      g.strokeStyle = 'rgba(40,36,30,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 30; k++) { x += (r() - 0.5) * 14; y += 6 + r() * 6; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(150,146,136,0.5)'; g.fillRect(w * 0.62, h * 0.35, 90, 60); // a patch made good, paler
    speckle(g, w, h, 9000, '#5e594f', 1.2, 9302);
  }, { repeat: [1, 1] });
}

// ---------------------------------------------------------------- the storm cellar and the basement (user, 2026-10-21)

/** Drawn three times over across each edge, so a picture tiles. */
const wrapped = (w, h, fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(dx, dy); };
/** A crack: a line wandering off from x, y, `n` steps of about `step` px, mostly going `a`. */
function crack(g, r, x, y, a, n, step, style, width) {
  g.strokeStyle = style; g.lineWidth = width; g.beginPath(); g.moveTo(x, y);
  for (let k = 0; k < n; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * step * (0.5 + r()); y += Math.sin(a) * step * (0.5 + r()); g.lineTo(x, y); }
  g.stroke();
}

/**
 * Old poured concrete out of doors (the cellar's curb, its cheeks and its steps — user, 2026-10-21: "worn concrete"):
 * grey, its skin worn off to the gravel in it, pitted with air holes, darker and paler in blotches, hairline cracks,
 * a speck or two of lichen. Tiles both ways, 0.5 m across by 1 m (wornWood's UVs). `bump`: its relief.
 */
export function oldConcreteTex(bump = false) {
  return canvasTex(512, 1024, (g, w, h) => {
    const r = mulberry32(5521);
    g.fillStyle = bump ? '#808080' : '#8d887e';
    g.fillRect(0, 0, w, h);
    if (!bump) {
      g.filter = 'blur(16px)';
      for (let i = 0; i < 80; i++) { const x = r() * w, y = r() * h, rad = 25 + r() * 90, c = `rgba(${r() < 0.5 ? '158,152,140' : '84,79,70'},${0.08 + r() * 0.14})`; wrapped(w, h, (dx, dy) => { g.fillStyle = c; g.beginPath(); g.arc(x + dx, y + dy, rad, 0, 6.283); g.fill(); }); }
      g.filter = 'none';
    }
    for (let i = 0; i < 3200; i++) { // the gravel, where the skin has worn off it: each stone lit on top
      const x = r() * w, y = r() * h, s = 1 + r() * r() * 5, v = 96 + r() * 96;
      g.fillStyle = bump ? `rgba(255,255,255,${0.2 + r() * 0.3})` : `rgba(${v},${v - 5},${v - 12},${0.3 + r() * 0.35})`;
      g.beginPath(); g.ellipse(x, y, s, s * (0.55 + r() * 0.45), r() * 3, 0, 6.283); g.fill();
    }
    for (let i = 0; i < 2200; i++) { // air holes
      const x = r() * w, y = r() * h, s = 0.6 + r() * r() * 2.6;
      g.fillStyle = bump ? 'rgba(0,0,0,0.6)' : `rgba(38,35,30,${0.35 + r() * 0.4})`;
      g.beginPath(); g.arc(x, y, s, 0, 6.283); g.fill();
    }
    for (let i = 0; i < 5; i++) { const x = r() * w, y = r() * h, a = r() * 6.283; wrapped(w, h, (dx, dy) => crack(g, mulberry32(400 + i), x + dx, y + dy, a, 40, 7, bump ? 'rgba(0,0,0,0.7)' : 'rgba(40,36,30,0.55)', 1.1)); }
    if (!bump) for (let i = 0; i < 26; i++) { // lichen: little pale crusts, the odd green fleck
      const x = r() * w, y = r() * h, n = 4 + Math.floor(r() * 10), c = r() < 0.6 ? '186,184,150' : '104,118,62';
      for (let k = 0; k < n; k++) { g.fillStyle = `rgba(${c},${0.35 + r() * 0.4})`; g.beginPath(); g.arc(x + (r() - 0.5) * 18, y + (r() - 0.5) * 18, 1 + r() * 3.5, 0, 6.283); g.fill(); }
    }
  }, { repeat: [1, 1], data: bump });
}

/**
 * The basement's walls: concrete blocks, 40 × 20 cm, painted off-white long ago — the paint gone grey and yellowed,
 * flaking off in patches down to the bare block, run with brown streaks from above, a crack stepping down the joints.
 * Tiles both ways, 1.6 m (four blocks by eight courses).
 */
export function blockWallTex(bump = false) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const r = mulberry32(7711), bw = w / 4, bh = h / 8, joint = 5;
    g.fillStyle = bump ? '#202020' : '#6f6b62';
    g.fillRect(0, 0, w, h); // (the mortar)
    for (let row = 0; row < 8; row++) for (let col = -1; col < 4; col++) {
      const x = col * bw + (row % 2 ? bw / 2 : 0), y = row * bh, v = r();
      g.fillStyle = bump ? `rgb(${190 + v * 30},${190 + v * 30},${190 + v * 30})` : `rgb(${168 + v * 14},${163 + v * 12},${150 + v * 10})`;
      for (const dx of [0, w]) g.fillRect(x + joint / 2 + dx, y + joint / 2, bw - joint, bh - joint);
    }
    // the block's open face, through the paint: pores
    for (let i = 0; i < 9000; i++) { g.fillStyle = bump ? 'rgba(0,0,0,0.25)' : `rgba(80,76,68,${0.08 + r() * 0.12})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    if (bump) return;
    // the paint gone off: flaked away here and there, more low down, each patch ragged, its edges lighter, curling
    for (let i = 0; i < 22; i++) {
      const x = r() * w, y = h * (0.35 + r() ** 0.6 * 0.65), pts = [], n = 22, rad = 5 + r() ** 2 * 40, stretch = 0.6 + r() * 1.2;
      let q = rad;
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.283; q = Math.max(rad * 0.25, Math.min(rad * 1.6, q + (r() - 0.5) * rad * 0.6)); pts.push([x + Math.cos(a) * q * stretch, y + Math.sin(a) * q / stretch]); }
      wrapped(w, h, (dx, dy) => {
        g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px + dx, py + dy) : g.moveTo(px + dx, py + dy))); g.closePath();
        g.fillStyle = 'rgba(122,118,108,0.75)'; g.fill(); g.strokeStyle = 'rgba(214,210,198,0.6)'; g.lineWidth = 1.5; g.stroke();
      });
    }
    // yellowed, unevenly
    g.filter = 'blur(24px)';
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, rad = 40 + r() * 120, c = `rgba(${r() < 0.6 ? '150,130,90' : '90,86,78'},${0.05 + r() * 0.08})`; wrapped(w, h, (dx, dy) => { g.fillStyle = c; g.beginPath(); g.arc(x + dx, y + dy, rad, 0, 6.283); g.fill(); }); }
    g.filter = 'none';
    // runs from above: brown streaks, thinning downwards
    for (let i = 0; i < 18; i++) {
      const x = r() * w, l = h * (0.15 + r() * 0.5), y0 = r() * h, wd = 2 + r() * 7, gr = g.createLinearGradient(0, y0, 0, y0 + l);
      gr.addColorStop(0, 'rgba(96,72,44,0.32)'); gr.addColorStop(1, 'rgba(96,72,44,0)');
      g.fillStyle = gr; g.fillRect(x, y0, wd, l);
      if (y0 + l > h) { g.fillRect(x, y0 - h, wd, l); }
    }
    // a crack down through the joints, stepping
    let cx = w * 0.62, cy = 0;
    g.strokeStyle = 'rgba(34,30,26,0.75)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, cy);
    for (let row = 0; row < 8; row++) { cy = (row + 1) * bh; g.lineTo(cx + (r() - 0.5) * 6, cy); cx += (r() < 0.5 ? 1 : -1) * bw / 2; g.lineTo(cx, cy); }
    g.stroke();
  }, { repeat: [1, 1], data: bump });
}

/**
 * The basement's floor: a concrete slab, trowelled once, grey-brown, dusty: old stains (oil, a rust ring from a tin that
 * stood there, tide marks where water has stood and dried), long cracks, chips, grit. Tiles both ways, 2 m.
 */
export function cellarFloorTex(bump = false) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const r = mulberry32(8811);
    g.fillStyle = bump ? '#808080' : '#7d776c';
    g.fillRect(0, 0, w, h);
    if (!bump) {
      g.filter = 'blur(20px)';
      for (let i = 0; i < 60; i++) { const x = r() * w, y = r() * h, rad = 40 + r() * 130, c = `rgba(${r() < 0.5 ? '150,144,132' : '82,76,66'},${0.06 + r() * 0.1})`; wrapped(w, h, (dx, dy) => { g.fillStyle = c; g.beginPath(); g.arc(x + dx, y + dy, rad, 0, 6.283); g.fill(); }); }
      g.filter = 'none';
      for (let i = 0; i < 14; i++) { // the trowel's arcs, faint
        const x = r() * w, y = r() * h, rad = 60 + r() * 160;
        g.strokeStyle = `rgba(${r() < 0.5 ? '160,154,142' : '70,66,58'},0.08)`; g.lineWidth = 2 + r() * 5;
        g.beginPath(); g.arc(x, y, rad, r() * 6, r() * 6 + 1 + r()); g.stroke();
      }
      for (let i = 0; i < 6; i++) { // stains: oil, dark; a rust ring; a tide mark
        const x = r() * w, y = r() * h, rad = 18 + r() * 60, k = r();
        g.filter = 'blur(6px)';
        g.fillStyle = k < 0.4 ? 'rgba(30,26,22,0.35)' : k < 0.7 ? 'rgba(96,58,30,0.25)' : 'rgba(60,56,48,0.2)';
        g.beginPath(); g.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), r() * 3, 0, 6.283); g.fill();
        g.filter = 'none';
        if (k >= 0.4) { g.strokeStyle = k < 0.7 ? 'rgba(110,62,30,0.4)' : 'rgba(54,48,40,0.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, rad, rad * 0.85, r(), 0, 6.283); g.stroke(); }
      }
    }
    for (let i = 0; i < 7000; i++) { g.fillStyle = bump ? `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},0.3)` : `rgba(${r() < 0.5 ? '50,46,40' : '170,164,152'},${0.15 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 4; i++) { const x = r() * w, y = r() * h, a = r() * 6.283, seed = 600 + i; wrapped(w, h, (dx, dy) => crack(g, mulberry32(seed), x + dx, y + dy, a, 60, 9, bump ? 'rgba(0,0,0,0.8)' : 'rgba(32,28,24,0.6)', 1.4)); }
  }, { repeat: [1, 1], data: bump });
}

/**
 * The wet rising up a basement wall from the floor (a strip laid over the wall's foot, 2 m along by 0.6 m up, tiling
 * along): darker where it is damp, ragged at the top, a white crust of salts along its edge, black mould in specks.
 */
export function dampFootTex() {
  return canvasTex(1024, 320, (g, w, h) => {
    const r = mulberry32(9911);
    g.clearRect(0, 0, w, h);
    const top = [];
    for (let x = 0; x <= w; x += 8) top.push(h * (0.25 + 0.3 * (0.5 + 0.5 * Math.sin((x / w) * Math.PI * 2 * 3 + 1.3) * Math.sin((x / w) * Math.PI * 2 * 7))) + (r() - 0.5) * 14);
    top[top.length - 1] = top[0];
    const edge = () => { g.beginPath(); g.moveTo(0, h); top.forEach((y, i) => g.lineTo(i * 8, y)); g.lineTo(w, h); g.closePath(); };
    const gr = g.createLinearGradient(0, h, 0, h * 0.2);
    gr.addColorStop(0, 'rgba(46,44,36,0.62)'); gr.addColorStop(0.7, 'rgba(56,54,44,0.38)'); gr.addColorStop(1, 'rgba(56,54,44,0.25)');
    g.filter = 'blur(3px)'; edge(); g.fillStyle = gr; g.fill(); g.filter = 'none';
    g.strokeStyle = 'rgba(214,210,196,0.55)'; g.lineWidth = 4; g.filter = 'blur(1.5px)';
    g.beginPath(); top.forEach((y, i) => (i ? g.lineTo(i * 8, y - 2) : g.moveTo(0, y - 2))); g.stroke(); g.filter = 'none';
    for (let i = 0; i < 1600; i++) { const x = r() * w, y = h * (0.45 + r() * 0.55); g.fillStyle = `rgba(16,18,14,${0.15 + r() * 0.35})`; g.beginPath(); g.arc(x, y, 0.6 + r() * 2.2, 0, 6.283); g.fill(); }
  }, { repeat: [1, 1] });
}

/** A child's trainer's print in the dust (for a decal, 7 × 17 cm): one sole's shape — round toe, narrow waist, heel — the dust pushed off the floor there, darker, the ridges of the tread across it, the edge soft. */
export function printTex(seed = 1) {
  const r = mulberry32(seed);
  return canvasTex(64, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const sole = () => {
      g.beginPath();
      g.moveTo(w * 0.5, h * 0.03);
      g.bezierCurveTo(w * 0.95, h * 0.04, w * 0.98, h * 0.36, w * 0.8, h * 0.5); // the toe and the ball, round
      g.bezierCurveTo(w * 0.7, h * 0.6, w * 0.74, h * 0.68, w * 0.78, h * 0.8); // the waist, in on the outside
      g.bezierCurveTo(w * 0.82, h * 0.98, w * 0.22, h * 0.99, w * 0.24, h * 0.8); // the heel
      g.bezierCurveTo(w * 0.26, h * 0.66, w * 0.16, h * 0.58, w * 0.14, h * 0.46);
      g.bezierCurveTo(w * 0.06, h * 0.2, w * 0.18, h * 0.03, w * 0.5, h * 0.03);
      g.closePath();
    };
    g.filter = 'blur(1.2px)';
    g.fillStyle = `rgba(34,30,25,${0.55 + r() * 0.15})`; sole(); g.fill();
    g.filter = 'none';
    g.save(); sole(); g.clip();
    for (let y = 5; y < h; y += 6) { g.strokeStyle = 'rgba(140,134,122,0.35)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 3); g.stroke(); } // (dust left between the ridges)
    g.restore();
  });
}

/**
 * A cardboard box's side (each face takes the whole picture): kraft brown, faded, its corrugations faint under it,
 * a strip of brown tape across, damp-stained along the bottom, a handwritten word in marker (`label`, may be '').
 */
export function cardboardTex(seed = 1, label = '') {
  const r = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    const k = 0.85 + r() * 0.25;
    g.fillStyle = `rgb(${Math.round(168 * k)},${Math.round(130 * k)},${Math.round(86 * k)})`;
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) { g.fillStyle = 'rgba(80,58,32,0.06)'; g.fillRect(x, 0, 2, h); }
    g.filter = 'blur(10px)';
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '90,64,36' : '196,170,124'},${0.08 + r() * 0.1})`; g.beginPath(); g.arc(r() * w, r() * h, 20 + r() * 50, 0, 6.283); g.fill(); }
    g.filter = 'none';
    const gr = g.createLinearGradient(0, h, 0, h * 0.6); // damp up from the floor
    gr.addColorStop(0, 'rgba(70,48,26,0.55)'); gr.addColorStop(1, 'rgba(70,48,26,0)');
    g.fillStyle = gr; g.fillRect(0, h * 0.6, w, h * 0.4);
    if (r() < 0.75) { // the tape, peeling at an end
      const y = h * (0.42 + r() * 0.1);
      g.fillStyle = 'rgba(150,104,52,0.75)'; g.fillRect(0, y, w * (0.8 + r() * 0.2), 22);
      g.fillStyle = 'rgba(220,190,140,0.18)'; g.fillRect(0, y + 3, w, 3);
    }
    if (label) {
      g.save();
      g.translate(w * (0.3 + r() * 0.3), h * (0.24 + r() * 0.1));
      g.rotate((r() - 0.5) * 0.18);
      g.fillStyle = 'rgba(24,22,26,0.82)';
      g.font = `bold ${label.length > 6 ? 30 : 40}px "Arial Narrow", Arial, sans-serif`;
      g.textAlign = 'center';
      g.fillText(label, 0, 0);
      g.restore();
    }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(60,44,26,${r() * 0.18})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
  });
}

/**
 * The basement sofa's cloth: an old gold velour, a flowered pattern pressed into it (of the seventies), tone on tone
 * — gold, a darker brown in the flowers' outlines and their leaves, the nap lighter one way than the other in
 * blotches. Tiles both ways, 0.45 m (its UVs are in metres). `bump`: the pattern pressed in.
 */
export function velourTex(bump = false) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const r = mulberry32(6611);
    g.fillStyle = bump ? '#a0a0a0' : '#93722f';
    g.fillRect(0, 0, w, h);
    if (!bump) {
      g.filter = 'blur(26px)';
      for (let i = 0; i < 50; i++) { const x = r() * w, y = r() * h, rad = 40 + r() * 120, c = `rgba(${r() < 0.5 ? '176,142,74' : '96,72,28'},${0.12 + r() * 0.15})`; wrapped(w, h, (dx, dy) => { g.fillStyle = c; g.beginPath(); g.arc(x + dx, y + dy, rad, 0, 6.283); g.fill(); }); }
      g.filter = 'none';
    }
    // the flowers: four to a tile, half dropped, each a ring of petals round a centre, a leaf or two off it
    const flower = (cx, cy, s, turn) => wrapped(w, h, (dx, dy) => {
      g.save(); g.translate(cx + dx, cy + dy); g.rotate(turn);
      g.strokeStyle = bump ? '#303030' : 'rgba(78,54,20,0.75)'; g.lineWidth = 7;
      g.fillStyle = bump ? '#606060' : 'rgba(120,92,40,0.55)';
      for (let k = 0; k < 6; k++) { g.save(); g.rotate((k / 6) * 6.283); g.beginPath(); g.ellipse(0, -s * 0.48, s * 0.2, s * 0.36, 0, 0, 6.283); g.fill(); g.stroke(); g.restore(); }
      g.beginPath(); g.arc(0, 0, s * 0.16, 0, 6.283); g.fillStyle = bump ? '#202020' : 'rgba(70,48,18,0.8)'; g.fill();
      for (const [a, l] of [[0.7, 1.15], [2.6, 0.95], [4.4, 1.05]]) { // the leaves and a stalk
        g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, s * 0.8); g.quadraticCurveTo(s * 0.3, s * (0.8 + l * 0.4), 0, s * (0.8 + l * 0.8)); g.quadraticCurveTo(-s * 0.3, s * (0.8 + l * 0.4), 0, s * 0.8);
        g.fillStyle = bump ? '#505050' : 'rgba(96,74,30,0.5)'; g.fill(); g.lineWidth = 5; g.stroke(); g.restore();
      }
      g.restore();
    });
    flower(w * 0.25, h * 0.25, 120, 0.2); flower(w * 0.75, h * 0.5, 110, 1.1); flower(w * 0.25, h * 0.75, 115, 2.3); flower(w * 0.75, h * 0.0, 105, 0.7);
    for (let i = 0; i < 26000; i++) { g.fillStyle = bump ? `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},0.12)` : `rgba(${r() < 0.5 ? '60,44,14' : '190,160,96'},${0.05 + r() * 0.08})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); } // the nap
  }, { repeat: [1 / 0.45, 1 / 0.45], data: bump });
}

/** What a torch throws on a wall (its spot light's map): a hot middle, a faint ring round it, a wide dim spill fading out, a smudge or two on its glass. */
export function torchCookieTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = mulberry32(7121), c = w / 2;
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.22, '#f4f1ea'); gr.addColorStop(0.34, '#d6d2c8'); gr.addColorStop(0.4, '#e2ded4'); gr.addColorStop(0.48, '#9a968e');
    gr.addColorStop(0.7, '#6a6762'); gr.addColorStop(0.9, '#2a2928'); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.filter = 'blur(10px)';
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(0,0,0,0.14)'; g.beginPath(); g.arc(c + (r() - 0.5) * 70, c + (r() - 0.5) * 70, 12 + r() * 16, 0, 6.283); g.fill(); } // (the glass is dirty)
    g.filter = 'none';
  });
}

/** A cobweb (a card), old and grey with dust: threads out from a corner, the spiral sagging between them, torn, a strand hanging off. */
export function cobwebTex(seed = 1) {
  const r = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const spokes = 9 + Math.floor(r() * 5), ends = [];
    g.strokeStyle = 'rgba(206,202,192,0.55)'; g.lineWidth = 1;
    for (let i = 0; i < spokes; i++) { const a = (i / (spokes - 1)) * (Math.PI / 2) + (r() - 0.5) * 0.08, l = w * (0.7 + r() * 0.3); ends.push([a, l]); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke(); }
    for (let d = 14; d < w; d += 9 + r() * 8) {
      if (r() < 0.2) continue; // (torn)
      g.strokeStyle = `rgba(206,202,192,${0.25 + r() * 0.3})`; g.beginPath();
      ends.forEach(([a, l], i) => { if (d > l) return; const x = Math.cos(a) * d, y = Math.sin(a) * d; if (!i) g.moveTo(x, y); else { const [pa] = ends[i - 1], mid = (a + pa) / 2; g.quadraticCurveTo(Math.cos(mid) * d * 0.9 + 2, Math.sin(mid) * d * 0.9 + 4, x, y); } });
      g.stroke();
    }
    g.fillStyle = 'rgba(190,186,176,0.18)'; g.filter = 'blur(6px)'; g.beginPath(); g.arc(w * 0.12, h * 0.12, w * 0.18, 0, 6.283); g.fill(); g.filter = 'none'; // dust caught in it
    g.strokeStyle = 'rgba(206,202,192,0.5)'; g.beginPath(); g.moveTo(w * 0.5, h * 0.3); g.quadraticCurveTo(w * 0.55, h * 0.6, w * 0.5, h * 0.95); g.stroke();
  });
}

/** An old dust sheet: off-white cotton gone grey, its weave, brown stains, a darned tear. Tiles, about 1 m. */
export function dustSheetTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = mulberry32(3131);
    g.fillStyle = '#9e988b'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${r() < 0.5 ? '90,86,78' : '220,214,202'},0.06)`; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(${r() < 0.5 ? '90,86,78' : '220,214,202'},0.05)`; g.fillRect(x, 0, 1, h); }
    g.filter = 'blur(10px)';
    for (let i = 0; i < 9; i++) { const x = r() * w, y = r() * h, rad = 10 + r() * 40; wrapped(w, h, (dx, dy) => { g.fillStyle = 'rgba(120,92,52,0.18)'; g.beginPath(); g.arc(x + dx, y + dy, rad, 0, 6.283); g.fill(); }); }
    g.filter = 'none';
  }, { repeat: [1, 1] });
}

/** An old single mattress's cover (1 m by 2 m on the picture): ticking, off-white with faded blue stripes, buttons, brown tide-marked stains, mould low on one end. */
export function mattressTex() {
  return canvasTex(512, 1024, (g, w, h) => {
    const r = mulberry32(4141);
    g.fillStyle = '#c4beb0'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 26) { g.fillStyle = 'rgba(80,96,124,0.35)'; g.fillRect(x, 0, 5, h); g.fillRect(x + 9, 0, 2, h); }
    for (let i = 0; i < 6; i++) { // stains, each dried in a ring
      const x = r() * w, y = r() * h, rad = 30 + r() * 90;
      g.filter = 'blur(5px)'; g.fillStyle = `rgba(150,112,52,${0.18 + r() * 0.15})`; g.beginPath(); g.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), r() * 3, 0, 6.283); g.fill();
      g.filter = 'blur(1.5px)'; g.strokeStyle = 'rgba(120,84,36,0.45)'; g.lineWidth = 3; g.stroke(); g.filter = 'none';
    }
    for (let i = 0; i < 2500; i++) { const y = h * (0.75 + r() * 0.25); g.fillStyle = `rgba(30,32,26,${r() * 0.3})`; g.beginPath(); g.arc(r() * w, y, 0.6 + r() * 2, 0, 6.283); g.fill(); }
    for (let y = 80; y < h; y += 160) for (let x = 64; x < w; x += 128) { g.fillStyle = 'rgba(70,66,60,0.6)'; g.beginPath(); g.arc(x + (y % 320 ? 64 : 0), y, 6, 0, 6.283); g.fill(); }
  });
}

/**
 * The passage beyond the basement, finished once (the seventies): wall panelling, a dark walnut-look veneer in grooved
 * sheets 1.22 m wide, grooves at odd spacings as the cheap kind had, its finish gone dull, scuffed low down. Tiles
 * along (u 1.22 m) and up (v 2.44 m).
 */
export function panellingTex() {
  return canvasTex(512, 1024, (g, w, h) => {
    const r = mulberry32(8181);
    g.fillStyle = '#5a3f2a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { // the veneer's figure, up the sheet
      const x = r() * w, wd = 1 + r() * 6;
      g.strokeStyle = `rgba(${r() < 0.6 ? '40,26,16' : '120,88,58'},${0.08 + r() * 0.18})`; g.lineWidth = wd;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * 0.01 + i) * 4 + (r() - 0.5) * 2, y);
      g.stroke();
    }
    for (const x of [0, 0.19, 0.31, 0.52, 0.66, 0.83].map((u) => u * w)) { g.fillStyle = 'rgba(22,14,8,0.85)'; g.fillRect(x, 0, 4, h); g.fillStyle = 'rgba(140,110,80,0.25)'; g.fillRect(x + 4, 0, 1, h); } // the grooves
    const gr = g.createLinearGradient(0, h, 0, h * 0.8); gr.addColorStop(0, 'rgba(150,130,104,0.25)'); gr.addColorStop(1, 'rgba(150,130,104,0)'); // scuffed by feet
    g.fillStyle = gr; g.fillRect(0, h * 0.8, w, h * 0.2);
  }, { repeat: [1, 1] });
}

/** A dropped ceiling's tiles, 0.61 m square in their thin metal grid: off-white mineral board, pitted with little fissures, brown water rings on some. Tiles both ways, 1.22 m (two by two). */
export function ceilingTilesTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = mulberry32(8282);
    g.fillStyle = '#b6b0a2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(80,74,64,${0.2 + r() * 0.3})`; g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 3); g.fillRect(0, 0, 2 + r() * 5, 1); g.restore(); }
    for (let i = 0; i < 3; i++) { // water rings
      const x = r() * w, y = r() * h, rad = 20 + r() * 50;
      g.filter = 'blur(4px)'; g.fillStyle = 'rgba(150,110,60,0.22)'; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill();
      g.filter = 'none'; g.strokeStyle = 'rgba(120,80,40,0.45)'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, rad * (0.9 + r() * 0.2), 0, 6.283); g.stroke();
    }
    g.fillStyle = '#d0cbc0'; for (const p of [0, w / 2]) { g.fillRect(p, 0, 7, h); g.fillRect(0, p, w, 7); } // the grid
    g.fillStyle = 'rgba(60,56,50,0.4)'; for (const p of [0, w / 2]) { g.fillRect(p + 7, 0, 1, h); g.fillRect(0, p + 7, w, 1); }
  }, { repeat: [1, 1] });
}

/** Where a lock's staple was torn out of old rotten wood (for a decal): the wood under the weather pale and raw, ragged, splinters standing up off it, two screw holes dark in it. */
export function splinterTex() {
  return bleed(canvasTex(128, 128, (g, w, h) => {
    const r = mulberry32(9771);
    g.clearRect(0, 0, w, h);
    const pts = [];
    for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.283, k = 0.7 + r() * 0.45; pts.push([w / 2 + Math.cos(a) * w * 0.26 * k, h / 2 + Math.sin(a) * h * 0.4 * k]); }
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    g.fillStyle = '#b39a76'; g.fill();
    g.save(); g.clip();
    for (let i = 0; i < 40; i++) { const x = r() * w; g.strokeStyle = `rgba(${r() < 0.5 ? '120,96,64' : '214,196,160'},0.6)`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, h); g.stroke(); } // the grain, torn along
    g.restore();
    for (let i = 0; i < 14; i++) { const [x, y] = pts[Math.floor(r() * pts.length)]; g.strokeStyle = 'rgba(200,180,140,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + (r() < 0.5 ? -1 : 1) * (6 + r() * 12)); g.stroke(); }
    for (const [x, y] of [[w * 0.45, h * 0.32], [w * 0.55, h * 0.68]]) { g.fillStyle = 'rgba(30,22,14,0.9)'; g.beginPath(); g.arc(x, y, 4, 0, 6.283); g.fill(); }
  }));
}

/**
 * The storm cellar's steel doors (user, 2026-10-22: "the doors are metal"): one leaf's top, 512 px across from its
 * hinge (left) to the edge where the two leaves meet (right), 1024 up it from its foot (bottom) to its top. A dark
 * grey-green enamel put on once, long ago, faded lighter and duller in broad patches; chipped where things knock and
 * rub — along the meeting edge most, round the handle and the lock, where feet have stood on it low down, along the
 * pressed ribs — the chips gone to rust and rust run down the slope from them and from every bolt; the foot rusted
 * worst, where the wet sits against the sill; dirt washed down from the header; the brown ghosts of wet leaves that
 * lay on it. `o` (metres): { half, Ls, bolts: [[u, z]…], handle: [u, z], lock: [u, z], ribs: [u…], pools: [[u, z, r]…]
 * (its dents), feet, seed };
 * `bump`: its relief (the paint standing proud of the chips, rust blistered).
 */
export function cellarDoorTex(o, bump = false) {
  return canvasTex(512, 1024, (g, w, h) => {
    const r = mulberry32(o.seed), mx = w / o.half, my = h / o.Ls;
    const X = (u) => u * mx, Y = (z) => h - z * my;
    const col = (c, b) => (bump ? b : c);
    g.fillStyle = col('#525947', '#808080'); // (a grey, olive green: bluer, under the evening sky it read as teal)
    g.fillRect(0, 0, w, h);
    // faded: broad patches a lighter, duller green, more of them up the slope where nothing shades it
    for (let i = 0; i < 12; i++) {
      const x = r() * w, y = r() ** 1.5 * h, rad = 90 + r() * 240, a = 0.16 + r() * 0.24;
      if (bump) continue;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(128,132,108,${a})`);
      gr.addColorStop(1, 'rgba(128,132,108,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // brushed on up and down the slope
    for (let i = 0; i < 320; i++) {
      const x = r() * w, y = r() * h, len = 30 + r() * 200, a = 0.02 + r() * 0.04, light = r() < 0.5;
      g.fillStyle = bump ? `rgba(${light ? 150 : 100},${light ? 150 : 100},${light ? 150 : 100},${a * 2})` : light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      g.fillRect(x, y, 1 + (i % 2), len);
    }
    // dirt washed down from the header in streaks
    for (let i = 0; i < 26; i++) {
      const x = r() * w, len = 60 + r() * 420, wd = 3 + r() * 12, a = 0.12 + r() * 0.18;
      if (bump) continue;
      const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, `rgba(46,40,30,${a})`);
      gr.addColorStop(1, 'rgba(46,40,30,0)');
      g.fillStyle = gr;
      g.fillRect(x, 0, wd, len);
    }
    // where wet leaves lay: their shapes left in brown on the lower half
    for (let i = 0; i < 6; i++) {
      const x = X(o.half * (0.1 + r() * 0.8)), y = Y(o.Ls * (0.04 + r() * 0.45)), L = (0.05 + r() * 0.05) * mx, turn = r() * 6.28, kind = ['oak', 'beech', 'maple', 'birch'][Math.floor(r() * 4)], a = 0.12 + r() * 0.12;
      if (bump) continue;
      g.save(); g.translate(x, y); g.rotate(turn);
      leafOutline(g, kind, L);
      g.fillStyle = `rgba(74,52,30,${a})`; g.fill();
      g.restore();
    }
    // a chip: the paint gone in a ragged flake, rust in it, the paint's torn edge dark under, pale where it lifts
    const chip = (x, y, s, rust = 0.5) => {
      const n = 9 + Math.floor(r() * 6), ax = 0.6 + r() * 0.8, turn = r() * 3.14, pts = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * 6.283, q = s * (0.55 + r() * 0.6); pts.push([Math.cos(a) * q * ax, Math.sin(a) * q / ax]); }
      const tone = r(), bare = r() < 0.2 * (1 - rust);
      g.save(); g.translate(x, y); g.rotate(turn);
      g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath();
      g.fillStyle = bump ? '#5c5c5c' : bare ? '#6e706a' : tone < 0.4 ? '#7a5232' : tone < 0.75 ? '#5a3c24' : '#906438'; // (brown and orange: redder, in the evening light the rust read as blood)
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = bump ? '#a8a8a8' : 'rgba(26,24,18,0.55)';
      g.stroke();
      g.restore();
    };
    const streak = (x, y, len, wd, a) => { // rust run down the slope, from y towards the foot
      if (bump) return;
      const gr = g.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, `rgba(118,82,44,${a})`);
      gr.addColorStop(1, 'rgba(118,82,44,0)');
      g.fillStyle = gr;
      g.fillRect(x - wd / 2, y, wd, len);
    };
    // along the edge where the two leaves meet and rub: chipped all along it
    for (let i = 0; i < 80; i++) { const x = w - r() ** 2 * 0.035 * mx, y = r() * h, s = 1.5 + r() * 7; chip(x, y, s); if (r() < 0.3) streak(x, y, 30 + r() * 160, 2 + r() * 4, 0.3 + r() * 0.3); }
    for (let i = 0; i < 26; i++) chip(r() ** 2 * 0.03 * mx, r() * h, 1.5 + r() * 5); // the hinge side
    for (let i = 0; i < 22; i++) { const x = r() * w, y = r() ** 2 * 0.03 * my; chip(x, y, 1.5 + r() * 5); if (r() < 0.4) streak(x, y, 40 + r() * 200, 2 + r() * 5, 0.25 + r() * 0.25); } // the top, against the header
    // the foot: the wet sits there against the sill — rusted, the paint lifted off it in a ragged band, higher in
    // some places than others and worst at the corners; blistered and flaking at its edge in patches, not all along
    const ph = [r() * 6.3, r() * 6.3, r() * 6.3], reach = (x) => {
      const t = x / w, corner = Math.max(0, 1 - t / 0.18) ** 2 + Math.max(0, 1 - (1 - t) / 0.18) ** 2;
      return (0.012 + 0.016 * (0.5 + 0.5 * Math.sin(t * 9 + ph[0])) * (0.5 + 0.5 * Math.sin(t * 23 + ph[1])) + 0.006 * Math.sin(t * 61 + ph[2]) + 0.035 * corner) * my;
    };
    if (!bump) {
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) g.lineTo(x, h - reach(x));
      g.lineTo(w, h); g.closePath();
      const gr = g.createLinearGradient(0, h, 0, h - 0.06 * my);
      gr.addColorStop(0, 'rgba(92,62,36,0.95)');
      gr.addColorStop(0.6, 'rgba(110,76,42,0.6)');
      gr.addColorStop(1, 'rgba(110,76,42,0.25)');
      g.fillStyle = gr; g.fill();
    }
    for (let k = 0; k < 9; k++) { // flaking where the rust has got under the paint, in places
      const cx = r() * w, n = 4 + Math.floor(r() * 9);
      for (let i = 0; i < n; i++) { const x = cx + (r() - 0.5) * 0.08 * mx, y = h - reach(Math.min(w, Math.max(0, x))) * (0.6 + r() * 0.8); chip(x, y, 2 + r() * 7, 1); }
    }
    for (let i = 0; i < 40; i++) { const x = r() * w, y = h - reach(x) * r(), rad = 1 + r() * 2.5; g.fillStyle = col(r() < 0.5 ? 'rgba(150,108,62,0.5)' : 'rgba(56,40,26,0.45)', '#a4a4a4'); g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill(); } // blisters
    // its dents: the paint cracked off where the steel was knocked in, rusted, a ring of rust round each
    for (const [u, z, rad] of o.pools ?? []) {
      const x = X(u), y = Y(z), R = rad * mx * 0.8;
      for (let k = 0; k < 6; k++) { // (not a round blot: patches run together, more of it below, where the wet runs out)
        const bx = x + (r() - 0.5) * R, by = y + (r() - 0.3) * R, br = R * (0.25 + r() * 0.4), turn = r() * 3;
        if (bump) continue;
        g.fillStyle = `rgba(104,72,40,${0.16 + 0.1 * (k % 2)})`;
        g.beginPath(); g.ellipse(bx, by, br, br * (0.5 + 0.4 * ((k * 7) % 3) / 2), turn, 0, 6.283); g.fill();
      }
      for (let i = 0; i < 10; i++) { const a = r() * 6.283, d = r() * 0.6; chip(x + Math.cos(a) * d * R, y + Math.sin(a) * d * R, 2 + r() * 6, 1); }
      streak(x, y + R * 0.6, 60 + r() * 160, 4 + r() * 8, 0.3);
    }
    // the ribs' crests: the paint rubbed thin along them, a chip or two
    for (const u of o.ribs) {
      g.fillStyle = col('rgba(132,136,112,0.22)', 'rgba(120,120,120,0.3)'); // (no stronger: at 0.45 they read as painted stripes)
      g.fillRect(X(u) - 3, Y(o.Ls - 0.09), 6, (o.Ls - 0.18) * my);
      for (let i = 0; i < 7; i++) chip(X(u) + (r() - 0.5) * 6, Y(0.09 + r() * (o.Ls - 0.18)), 1.5 + r() * 4);
    }
    // rust from every bolt and hinge, down the slope
    for (const [u, z] of o.bolts) {
      const x = X(u), y = Y(z), ex = 7 + r() * 5, ey = 6 + r() * 5;
      if (!bump) { g.fillStyle = 'rgba(112,78,44,0.35)'; g.beginPath(); g.ellipse(x, y, ex, ey, 0, 0, 6.283); g.fill(); }
      for (let k = 0, n = 1 + Math.floor(r() * 2); k < n; k++) streak(x + (r() - 0.5) * 6, y, 40 + r() * 240, 2 + r() * 6, 0.3 + r() * 0.35);
    }
    // the handle: the paint worn off round it by hands, to dark bare steel, rust at the edge of that; scratched
    if (o.handle) {
      const x = X(o.handle[0]), y = Y(o.handle[1]);
      if (!bump) {
        const gr = g.createRadialGradient(x, y, 0, x, y, 0.08 * mx);
        gr.addColorStop(0, 'rgba(84,86,80,0.6)');
        gr.addColorStop(0.6, 'rgba(96,70,46,0.3)');
        gr.addColorStop(1, 'rgba(96,70,46,0)');
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(x, y, 0.06 * mx, 0.1 * my, 0, 0, 6.283); g.fill();
      }
      for (let i = 0; i < 30; i++) { const a = r() * 6.283, d = r() ** 0.7 * 0.09; chip(x + Math.cos(a) * d * mx, y + Math.sin(a) * d * my, 1.5 + r() * 5); }
      for (let i = 0; i < 26; i++) { const a = r() * 6.283, d = 0.03 + r() * 0.07, len = 0.5 + r(); g.strokeStyle = col(`rgba(${r() < 0.5 ? '140,146,134' : '40,34,26'},0.45)`, '#6a6a6a'); g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, d * mx, a, a + len * 0.4); g.stroke(); }
    }
    // the lock: the padlock swinging against the steel has scored arcs round it, knocked the paint off
    if (o.lock) {
      const x = X(o.lock[0]), y = Y(o.lock[1]);
      for (let i = 0; i < 20; i++) { const a = r() * 6.283, d = r() * 0.05; chip(x + Math.cos(a) * d * mx, y + Math.sin(a) * d * my, 1.5 + r() * 5); }
      for (let i = 0; i < 34; i++) { const a = 1.2 + r() * 0.8, d = 0.02 + r() * 0.05, len = 0.2 + r() * 0.6; g.strokeStyle = col(`rgba(${r() < 0.6 ? '150,154,142' : '44,36,26'},0.5)`, '#686868'); g.lineWidth = 0.7 + r() * 0.6; g.beginPath(); g.arc(x, y - 0.012 * my, d * mx, a, a + len); g.stroke(); }
    }
    // where feet have stood on it, low down: scuffed paler, a rubber mark or two, a few chips
    if (o.feet) {
      for (let i = 0; i < 16; i++) {
        const x = X(o.half * (0.3 + r() * 0.55)), y = Y(o.Ls * (0.15 + r() * 0.3)), len = (0.04 + r() * 0.08) * mx, turn = (r() - 0.5) * 0.8, dark = r() < 0.25, a = 0.18 + r() * 0.2;
        g.save(); g.translate(x, y); g.rotate(turn);
        g.fillStyle = bump ? 'rgba(112,112,112,0.5)' : dark ? `rgba(28,28,26,${a * 0.6})` : `rgba(122,128,116,${a})`;
        g.beginPath(); g.ellipse(0, 0, len / 2, 2 + r() * 4, 0, 0, 6.283); g.fill();
        g.restore();
      }
      for (let i = 0; i < 8; i++) chip(X(o.half * (0.3 + r() * 0.55)), Y(o.Ls * (0.15 + r() * 0.3)), 1.5 + r() * 4);
    }
    for (let i = 0; i < 30; i++) chip(r() * w, r() * h, 1.2 + r() * 3.5); // and a few anywhere
    speckle(g, w, h, 2400, col('#2a2018', '#5a5a5a'), 1.1, o.seed + 3); // pitting
  }, { data: bump });
}

/** Where a padlock's staple was torn out of a steel door rusted thin under it (for a decal): the paint flaked back round it, rust, and in the middle a ragged hole, its torn lips bent up and bright, the two rivet holes beside it. */
export function rustTearTex() {
  return bleed(canvasTex(128, 128, (g, w, h) => {
    const r = mulberry32(9773);
    g.clearRect(0, 0, w, h);
    const blob = (cx, cy, rx, ry, n, k) => {
      g.beginPath();
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, q = 1 - k + r() * k * 2; i ? g.lineTo(cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q) : g.moveTo(cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q); }
      g.closePath();
    };
    blob(w / 2, h / 2, w * 0.4, h * 0.43, 26, 0.2);
    g.fillStyle = '#6a4626'; g.fill();
    g.strokeStyle = 'rgba(128,140,118,0.85)'; g.lineWidth = 2; g.stroke(); // the paint's edge, lifting
    g.save(); g.clip();
    for (let i = 0; i < 140; i++) { g.fillStyle = r() < 0.5 ? 'rgba(150,104,58,0.55)' : 'rgba(54,36,22,0.5)'; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 4, 0, 6.283); g.fill(); }
    g.restore();
    blob(w * 0.5, h * 0.5, w * 0.15, h * 0.19, 14, 0.38);
    g.fillStyle = '#070504'; g.fill(); // the hole, the dark under the doors in it
    g.strokeStyle = '#a8784c'; g.lineWidth = 2.2; g.stroke(); // its torn lips, bent up, the steel bright at the tear
    for (const y of [h * 0.17, h * 0.83]) { g.fillStyle = '#0c0806'; g.beginPath(); g.arc(w / 2 + (r() - 0.5) * 3, y, 3.5, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(150,90,44,0.8)'; g.lineWidth = 1.5; g.stroke(); }
  }));
}

/**
 * A knot gone out of an old board (the porch's step, user, 2026-10-28: "move this hole a bit to the right and make it
 * better"): an oval hole along the grain, its rim ragged, the dark of it deep, the wall on its far side catching a
 * little light; round it the knot's last ring and the grain bent round it, darker; a check run out of each end along
 * the grain. Its own alpha (nothing round it): a decal, the grain along its width.
 */
export function knotHoleTex(seed = 4401) {
  const r = mulberry32(seed);
  return canvasTex(256, 160, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.5, rx = W * 0.145, ry = H * 0.2;
    const blob = (k, jag) => { // the hole's outline, ragged, a little wider at one end
      g.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2, wob = 1 + jag * (Math.sin(a * 5 + 1.3) * 0.5 + Math.sin(a * 11 + 0.4) * 0.3 + (r() - 0.5) * 0.25);
        const x = cx + Math.cos(a) * rx * k * wob * (Math.cos(a) > 0 ? 1.08 : 0.94), y = cy + Math.sin(a) * ry * k * wob;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath();
    };
    // the grain bent round where the knot was, darker, fading out
    for (let i = 0; i < 26; i++) {
      const off = (i - 13) / 13, k = 1.25 + Math.abs(off) * 2.2, a = 0.16 + (1 - Math.abs(off)) * 0.36;
      g.strokeStyle = `rgba(40,30,20,${a})`;
      g.lineWidth = 0.8 + r() * 1.2;
      g.beginPath();
      for (let x = 0; x <= W; x += 6) {
        const u = (x - cx) / (rx * k * 1.9), bend = Math.exp(-u * u * 2.2) * ry * k * Math.sign(off || 1);
        const y = cy + off * H * 0.5 + bend * (1 - Math.abs(off) * 0.6) + Math.sin(x * 0.05 + i) * 1.2;
        if (x) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
    const fade = g.createRadialGradient(cx, cy, rx * 0.8, cx, cy, rx * 3.4); // (the bent grain only near it)
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = fade;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    // the knot's last ring: hard, dark, half gone
    blob(1.32, 0.1);
    g.fillStyle = 'rgba(52,34,20,0.8)';
    g.fill();
    // the hole: the wall at its far end catching a little light, the rest dark, darkest deep in
    blob(1.0, 0.18);
    const wall = g.createLinearGradient(cx, cy - ry, cx, cy + ry);
    wall.addColorStop(0, 'rgba(92,72,52,1)'); wall.addColorStop(0.35, 'rgba(34,24,16,1)'); wall.addColorStop(1, 'rgba(12,9,6,1)');
    g.fillStyle = wall;
    g.fill();
    const deep = g.createRadialGradient(cx + rx * 0.1, cy + ry * 0.15, 0, cx, cy, rx * 0.9);
    deep.addColorStop(0, 'rgba(5,4,3,0.95)'); deep.addColorStop(1, 'rgba(5,4,3,0)');
    g.fillStyle = deep;
    g.fill();
    // a splinter of the rim broken in at one side, and the checks out of each end along the grain
    g.strokeStyle = 'rgba(14,10,7,0.85)';
    for (const e of [-1, 1]) {
      g.lineWidth = 1.4 + r();
      g.beginPath();
      let x = cx + e * rx * 1.02, y = cy + (r() - 0.5) * ry * 0.4;
      g.moveTo(x, y);
      for (let k = 0, n = 6 + Math.floor(r() * 5); k < n; k++) { x += e * (5 + r() * 7); y += (r() - 0.5) * 2.5; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(150,126,98,0.55)'; // (the rim worn pale where a heel catches it, on the near side)
    g.beginPath(); g.ellipse(cx - rx * 0.2, cy + ry * 1.05, rx * 0.55, ry * 0.12, 0.05, 0, Math.PI * 2); g.fill();
  });
}

// ---------------------------------------------------------------- the end of the garden (pool.js; user, 2026-10-29)

/** A picture drawn pixel by pixel: fn(u, v) → [r, g, b] (0–255), u and v 0…1 over it. */
function perPixel(g, w, h, fn) {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, gg, b] = fn(x / w, y / h, x, y), k = (y * w + x) * 4;
    img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
/** Draws `fn` at x, y and again a tile over each way, so what crosses an edge comes in at the other. */
function wrapDraw(g, w, h, x, y, fn) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(x + dx, y + dy); fn(); g.restore(); }
}

/**
 * Grey moss hanging off the corner trees' limbs in beards (for a tall card, its top on the limb): a tangle of fine
 * wiry strands, crinkled, grey-green, thick near the top where they hang from, thinning down into single wisps of
 * different lengths; clear round them.
 */
export function hangingMossTex() {
  return bleed(canvasTex(256, 768, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(5101);
    const strand = (x0, y0, len, wd, shade) => {
      let x = x0, y = y0, a = Math.PI / 2 + (r() - 0.5) * 0.3;
      g.strokeStyle = `rgb(${Math.round(128 * shade)},${Math.round(136 * shade)},${Math.round(112 * shade)})`;
      g.lineWidth = wd;
      g.beginPath(); g.moveTo(x, y);
      const steps = Math.ceil(len / 4);
      for (let i = 0; i < steps; i++) {
        a += (r() - 0.5) * 1.1; // crinkled, every few pixels a kink
        a += (Math.PI / 2 - a) * 0.25; // but hanging
        x += Math.cos(a) * 4; y += Math.sin(a) * 4;
        g.lineTo(x, y);
        if (r() < 0.05) { // a curl off it
          const ca = a + (r() < 0.5 ? 1 : -1) * (0.8 + r()), cl = 6 + r() * 14;
          g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(ca) * cl, y + Math.sin(ca) * cl * 0.5, x + Math.cos(ca + 1.2) * cl * 0.6, y + cl * 0.8); g.moveTo(x, y);
        }
      }
      g.stroke();
    };
    for (let i = 0; i < 150; i++) { // the beard: from a clump at the top, thick, in festoons (it has to read from the ground, 3–8 m below)
      const x0 = w * (0.5 + (r() - 0.5) * 0.5 * (0.4 + r())), len = h * (0.2 + r() ** 0.8 * 0.78);
      strand(x0, r() * 40, len, 1.6 + r() * 1.8, 0.7 + r() * 0.45);
    }
    for (let i = 0; i < 60; i++) strand(w * (0.5 + (r() - 0.5) * 0.75), 10 + r() * h * 0.4, h * (0.1 + r() * 0.35), 1.2 + r() * 1.0, 0.78 + r() * 0.35); // and loose wisps lower down
  }));
}

/**
 * The ground past the wood, under the old paving and round it (`plan` x0…x1 by z0…z1, the picture's top its z0): dark
 * soil, green with moss in the damp (`moss(x, z)` 0…1), last year's leaves lying on it where the wood is (`litter`,
 * drawn as the yard's ground draws them, so the two meet without a line).
 */
export function pavingGroundTex(plan, litter, moss) {
  const PX = 2048 / 9.2, W = Math.round((plan.x1 - plan.x0) * PX), Hh = Math.round((plan.z1 - plan.z0) * PX), WK = W / 2048; // (as fine as the yard's own)
  return canvasTex(W, Hh, (g, w, h) => {
    const r = mulberry32(5111);
    const at = (x, y) => [plan.x0 + (x / w) * (plan.x1 - plan.x0), plan.z0 + (y / h) * (plan.z1 - plan.z0)];
    g.fillStyle = '#433727';
    g.fillRect(0, 0, w, h);
    const cell = 6;
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
      const [wx, wz] = at(x, y), m = moss(wx, wz) + (r() - 0.5) * 0.25, d = fbm(wx * 3.1 + 4, wz * 3.1 + 9, 0.5, 2);
      if (m > 0.2) { const v = Math.min(1, (m - 0.2) / 0.45), k = r(); g.fillStyle = `rgba(${Math.round(62 + k * 22 + d * 20)},${Math.round(76 + k * 22 + d * 18)},${Math.round(34 + k * 10)},${v})`; g.fillRect(x, y, cell, cell); }
      else { g.fillStyle = `rgba(${Math.round(52 + d * 30)},${Math.round(42 + d * 22)},${Math.round(30 + d * 14)},0.5)`; g.fillRect(x, y, cell, cell); }
    }
    speckle(g, w, h, 30000, '#2a2216', 1.6, 5112);
    speckle(g, w, h, 16000, '#6f6a3e', 1.2, 5113);
    for (let i = 0, n = Math.round(60000 * WK * (h / 3090)); i < n; i++) { // moss in little cushions, brighter green where it catches the damp
      const x = r() * w, y = r() * h, m = moss(...at(x, y));
      if (r() > m) continue;
      g.fillStyle = `rgba(${Math.round(78 + r() * 40)},${Math.round(98 + r() * 36)},${Math.round(36 + r() * 16)},${0.35 + r() * 0.4})`;
      g.beginPath(); g.arc(x, y, 1.5 + r() * 4, 0, Math.PI * 2); g.fill();
    }
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) { // the leaf litter's own ground, as the yard's
      const k = litter(...at(x, y)) + (r() - 0.5) * 0.15;
      if (k < 0.12) continue;
      g.fillStyle = `rgba(${84 + r() * 18},${66 + r() * 12},${44 + r() * 10},${Math.min(1, (k - 0.12) / 0.5)})`;
      g.fillRect(x, y, cell, cell);
    }
    const dead = ['#6f5133', '#80603a', '#9a7640', '#5a3f26', '#43301f', '#8a5434', '#a08a5a', '#7b6a3c', '#b09040'];
    for (let i = 0, n = Math.round(320000 * WK * (h / 3090)); i < n; i++) {
      const x = r() * w, y = r() * h, k = Math.max(litter(...at(x, y)), 0.06);
      if (r() > k * 1.15) continue;
      const len = 5 + r() * 9, wide = len * (0.3 + r() * 0.3), a = r() * Math.PI * 2, wet = moss(...at(x, y)) > 0.5 && r() < 0.6;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = 'rgba(30,20,12,0.35)'; g.beginPath(); g.ellipse(0.8, 0.8, len / 2, wide / 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = wet ? ['#3e2c1c', '#4a3520', '#33261a'][Math.floor(r() * 3)] : dead[Math.floor(r() * dead.length)]; // (rotting dark in the wet)
      g.beginPath(); g.ellipse(0, 0, len / 2, wide / 2 * (0.6 + r() * 0.4), 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(40,26,14,0.5)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke();
      g.restore();
    }
    for (let i = 0, n = Math.round(9000 * WK * (h / 3090)); i < n; i++) { // twigs
      const x = r() * w, y = r() * h, k = Math.max(litter(...at(x, y)), 0.1);
      if (r() > k) continue;
      let a = r() * Math.PI * 2, px = x, py = y;
      g.strokeStyle = r() < 0.5 ? 'rgba(52,38,24,0.85)' : 'rgba(92,72,50,0.85)'; g.lineWidth = 1 + r() * 1.4;
      g.beginPath(); g.moveTo(px, py);
      for (let s = 0, m = 2 + Math.floor(r() * 4); s < m; s++) { a += (r() - 0.5) * 0.7; px += Math.cos(a) * 7; py += Math.sin(a) * 7; g.lineTo(px, py); }
      g.stroke();
    }
  });
}

/**
 * The old paving stones' faces (setts, tumbled once, weathered for decades; a tile 0.5 m square, repeating): grey with
 * a little brown, mottled lighter and darker, fine grain, pits, and lichen — pale grey rosettes, dark crusts, the odd
 * ochre fleck. `light`: the angel's paler stone.
 */
export function pavingStoneTex(light = false) {
  const L = lattice(light ? 5131 : 5121), r = mulberry32(light ? 5132 : 5122);
  return canvasTex(512, 512, (g, w, h) => {
    perPixel(g, w, h, (u, v) => {
      const big = pfbm(L, u, v, 3, 3, 3), mid = pfbm(L, u + 0.31, v + 0.57, 9, 9, 3), grain = pnoise(L, u * 160, v * 160, 160, 160);
      const k = (light ? 168 : 132) + (big - 0.5) * 70 + (mid - 0.5) * 36 + (grain - 0.5) * 26;
      return [k + (light ? 2 : 6), k + (light ? 2 : 3) - (big < 0.4 ? 4 : 0), k - (light ? 4 : 5)];
    });
    speckle(g, w, h, 9000, '#3a3630', 1.2, 5123); // pits
    speckle(g, w, h, 5000, light ? '#f0ece2' : '#c8c4b8', 1.0, 5124);
    for (let i = 0; i < (light ? 18 : 34); i++) { // lichen: crusts spreading in irregular patches, a little paler or darker than the stone, soft-edged
      const x = r() * w, y = r() * h, rad = 6 + r() ** 1.5 * 30, c = r();
      const col = c < 0.6 ? [172 + r() * 16, 176 + r() * 14, 160 + r() * 10, 0.16] : c < 0.92 ? [70, 74, 64, 0.18] : [150, 132, 84, 0.16];
      wrapDraw(g, w, h, x, y, () => {
        for (let k = 0; k < 18; k++) { // (built of many small overlapping blots: a crust, no outline)
          const a = r() * Math.PI * 2, d = rad * Math.sqrt(r()) * 0.85, s2 = 2 + r() * rad * 0.35;
          g.fillStyle = `rgba(${Math.round(col[0])},${Math.round(col[1])},${Math.round(col[2])},${col[3] * (0.6 + r() * 0.8)})`;
          g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, s2, s2 * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); g.fill();
        }
      });
    }
  }, { repeat: [1, 1] });
}

/**
 * A tiling noise for the moss (and the wet) on the stones, the coping, the angel: greyscale, data.
 */
export function mossNoiseTex() {
  const L = lattice(5141);
  const t = canvasTex(256, 256, (g, w, h) => perPixel(g, w, h, (u, v) => { const k = Math.round(pfbm(L, u, v, 6, 6, 4) * 255); return [k, Math.round(pfbm(L, u + 0.5, v + 0.2, 24, 24, 3) * 255), k]; }), { repeat: [1, 1], data: true });
  return t;
}

/**
 * The pool's wall, unrolled (`len` metres round it, from the near end's west corner, by `depth` down from under the
 * coping): a band of pale blue tiles at the top, 15 cm, grout gone black, some cracked, some fallen off and the grey
 * adhesive showing; under it the white render gone grey — rings of grime where the water stood for years at different
 * levels, green slime just over the water, mould where it is damp, streaks run down from the tiles, patches where the
 * render has come away, hairline cracks; under the water, slime. `water`: how far down the water is.
 */
export function poolWallTex(len, depth, water, marks = [], seed = 5151) {
  const S = 300, W = Math.min(8192, Math.round(len * S)), Hh = Math.round(depth * S), r = mulberry32(seed), L = lattice(seed); // (300 a metre: a break in the render holds up at half a metre)
  return canvasTex(W, Hh, (g, w, h) => {
    const sx = w / len, sy = h / depth, TILE = 0.15, band = TILE, wy = water * sy;
    perPixel(g, w, h, (u, v, px, py) => {
      const y = py / sy, x = px / sx, n = pfbm(L, x / 8, y / 8, 40, 40, 3), n2 = pfbm(L, x / 8 + 0.3, y / 8 + 0.6, 160, 160, 2);
      let k = 188 + (n - 0.5) * 40 + (n2 - 0.5) * 18;
      let c = [k, k - 2, k - 9];
      const grime = Math.max(0, Math.sin((y - band) * 31 + n * 3) * 0.5 + 0.5) * THREE.MathUtils.smoothstep(y, band, band + 0.25) * 0.25; // the rings where it stood
      c = c.map((ch) => ch * (1 - grime));
      const nearWater = 1 - THREE.MathUtils.smoothstep(Math.abs(y - water + 0.06), 0, 0.09 + n * 0.05); // the slime band just over it
      c = [c[0] * (1 - 0.55 * nearWater) + 40 * nearWater, c[1] * (1 - 0.45 * nearWater) + 58 * nearWater, c[2] * (1 - 0.65 * nearWater) + 18 * nearWater];
      if (y > water) { const d = Math.min(1, (y - water) / 0.05); c = c.map((ch, i) => ch * (1 - d) + [34, 42, 26][i] * d); } // under the water
      const dark = THREE.MathUtils.smoothstep(y, band + 0.1, water) * 0.25; // darker down to the water
      return c.map((ch) => ch * (1 - dark));
    });
    // streaks run down from the tiles, dark, where the rain off the coping goes: in runs where it comes over, a few
    // together, each its own width, wavering, splitting, thinning out as it goes (user, 2026-11-03: straight bars, all
    // alike, were part of what read as made by a machine)
    for (let i = 0; i < len * 9; i++) for (let k = 0; k < 5; k++) r(); // (the old ones' dice, thrown and left: the tiles stay as they were)
    {
      const rs = mulberry32(seed + 55);
      for (let i = 0; i < len * 2.2; i++) {
        const x0 = rs() * w, rust = rs() < 0.25, n = 1 + Math.floor(rs() ** 1.5 * 5), spread = (0.01 + rs() * 0.05) * sx;
        for (let k = 0; k < n; k++) {
          let x = x0 + (rs() - 0.5) * spread, wd = (0.003 + rs() ** 2 * 0.02) * sx;
          const l = (0.04 + rs() ** 1.4 * 0.4) * sy, a0 = 0.12 + rs() * 0.28, ph = rs() * 6, y0 = band * sy - 1;
          const left = [], right = [];
          for (let y = 0; y <= l; y += 3) {
            const t = y / l, wob = Math.sin(y * 0.05 + ph) * 1.4 + Math.sin(y * 0.17 + ph * 2) * 0.6;
            const half = wd * 0.5 * (1 - t) ** 0.7 * (0.75 + 0.5 * Math.abs(Math.sin(y * 0.09 + ph)));
            left.push([x + wob - half, y0 + y]); right.push([x + wob + half, y0 + y]);
          }
          const gr = g.createLinearGradient(0, y0, 0, y0 + l);
          gr.addColorStop(0, `rgba(${rust ? '92,72,42' : '42,42,34'},${a0})`); gr.addColorStop(0.6, `rgba(${rust ? '92,72,42' : '42,42,34'},${a0 * 0.45})`); gr.addColorStop(1, 'rgba(42,42,34,0)');
          g.fillStyle = gr;
          g.beginPath(); [...left, ...right.reverse()].forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill();
        }
      }
    }
    // (the dice the old patches and mould spots took, thrown and left, so the tiles after them stay as they were)
    for (let i = 0; i < len * 3; i++) for (let k = 0; k < 25; k++) r();
    for (let i = 0; i < len * 40; i++) { r(); r(); for (let k = 0, m = 3 + Math.floor(r() * 12); k < m; k++) { r(); r(); r(); r(); } }
    // Where it is damp: just over the water, where it stood for years, and under the tiles, where the rain off the
    // coping runs down; a little anywhere, in patches
    const damp = (x, y) => Math.max(1 - THREE.MathUtils.smoothstep(Math.abs(y - water + 0.07), 0.0, 0.2), 0.45 * (1 - THREE.MathUtils.smoothstep(y - band, 0.0, 0.13))) * (0.55 + 0.9 * pfbm(L, x / 8 + 0.7, y / 8, 40, 40, 2));
    // The render come away, each patch its own (user, 2026-11-03: the old ones, a blob with a pale ring, read as made by
    // a machine): the finish coat flaked off showing the grey scratch coat under it, and in some, deeper, the concrete;
    // a ragged edge, a step down as thick as the render, its shadow under the upper lip and the broken edge catching
    // the light at the lower; hairline cracks running off it; a little dirt washed down out of it. Most under the tiles
    // and where the water stood, where frost and the wet get in; a few anywhere.
    const rp = mulberry32(seed + 77);
    const outline = (cx, cy, rx, ry) => { // a ragged loop round cx, cy (pixels): broad lobes, and the small steps of a break
      const N = 84, a2 = 0.16 + rp() * 0.14, a3 = 0.08 + rp() * 0.12, a5 = 0.04 + rp() * 0.07, a9 = 0.02 + rp() * 0.04, p = [rp(), rp(), rp(), rp()].map((v) => v * 6.28), pts = [];
      let e = 0;
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2;
        e = e * 0.55 + (rp() - 0.5) * 0.13;
        const q = Math.max(0.35, 1 + a2 * Math.sin(2 * a + p[0]) + a3 * Math.sin(3 * a + p[1]) + a5 * Math.sin(5 * a + p[2]) + a9 * Math.sin(9 * a + p[3]) + e);
        pts.push([cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]);
      }
      return pts;
    };
    const trace = (pts, dx = 0, dy = 0) => { g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy))); g.closePath(); };
    const grains = (pts, n, cols, rMax) => { // sand or stones in what shows, in the patch's box
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      for (let k = 0; k < n; k++) { g.fillStyle = cols[Math.floor(rp() * cols.length)]; g.beginPath(); g.arc(x0 + rp() * (x1 - x0), y0 + rp() * (y1 - y0), 0.4 + rp() ** 2 * rMax, 0, Math.PI * 2); g.fill(); }
    };
    const layer = (pts, fill, sand, deep, slime) => { // what shows where a layer has come off, its edges
      const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]), top = Math.min(...ys), bottom = Math.max(...ys), left = Math.min(...xs), right = Math.max(...xs);
      g.save();
      trace(pts);
      g.clip();
      g.fillStyle = fill; g.fill();
      for (let k = 0, n = 5 + Math.floor(rp() * 8); k < n; k++) { // never one flat colour: blotched lighter and darker
        g.fillStyle = rp() < 0.5 ? `rgba(60,58,48,${0.08 + rp() * 0.12})` : `rgba(190,186,172,${0.06 + rp() * 0.1})`;
        const br = (0.2 + rp() * 0.35) * (right - left);
        g.beginPath(); g.ellipse(left + rp() * (right - left), top + rp() * (bottom - top), br, br * (0.4 + rp() * 0.4), rp() * 3, 0, Math.PI * 2); g.fill();
      }
      grains(pts, Math.min(900, Math.round((bottom - top) * (right - left) * 0.35)), sand, deep ? 1.6 : 0.8);
      if (slime > 0.05) { g.fillStyle = `rgba(40,58,20,${0.5 * slime})`; g.fillRect(left, top, right - left, bottom - top); }
      const wet = g.createLinearGradient(0, top, 0, bottom); // (damper, dirtier low down in it, where the wet sits)
      wet.addColorStop(0, 'rgba(40,42,30,0)'); wet.addColorStop(1, `rgba(40,42,30,${0.16 + rp() * 0.14})`);
      g.fillStyle = wet; g.fillRect(0, top, w, bottom - top);
      g.lineJoin = 'round';
      g.strokeStyle = `rgba(30,28,24,${deep ? 0.75 : 0.6})`; g.lineWidth = deep ? 5 : 3.6; trace(pts, 0, deep ? 2.4 : 1.8); g.stroke(); // the shadow under its upper lip
      g.strokeStyle = 'rgba(214,210,198,0.28)'; g.lineWidth = 1.6; trace(pts, 0, -1.4); g.stroke(); // its lower lip, broken clean, catching the light
      g.restore();
    };
    for (let i = 0; i < len * 2.6; i++) {
      const zone = rp(), x = rp() * w;
      const y = (zone < 0.4 ? band + 0.008 + rp() * 0.07 : zone < 0.8 ? water - 0.03 - rp() * 0.15 : band + rp() * (water - band)) * sy;
      const rx = (0.018 + rp() ** 1.7 * 0.14) * sx, ry = rx * (0.32 + rp() * 0.45);
      const outer = outline(x, y, rx, ry);
      const sc = 128 + rp() * 18, slime = 1 - THREE.MathUtils.smoothstep(Math.abs(y / sy - water + 0.06), 0, 0.12); // (in the slime band, slimed over like the rest of it)
      layer(outer, `rgb(${Math.round(sc + 4)},${Math.round(sc + 1)},${Math.round(sc - 8)})`, ['rgba(96,92,82,0.5)', 'rgba(170,166,154,0.4)', 'rgba(118,112,94,0.4)'], false, slime);
      if (rp() < 0.5 && rx > 0.03 * sx) { // deeper in it, down to the concrete
        const k = 0.35 + rp() * 0.3, inner = outline(x + (rp() - 0.5) * rx * 0.5, y + (rp() - 0.2) * ry * 0.4, rx * k, ry * k * (0.8 + rp() * 0.3)), cc = 98 + rp() * 18;
        layer(inner, `rgb(${Math.round(cc + 6)},${Math.round(cc)},${Math.round(cc - 12)})`, ['rgba(60,54,44,0.6)', 'rgba(150,144,130,0.5)', 'rgba(126,112,88,0.5)', 'rgba(44,40,34,0.6)'], true, slime);
      }
      for (let c = 0, n = Math.floor(rp() * 3.4); c < n; c++) { // hairline cracks off it, mostly along the wall
        const [sx0, sy0] = outer[Math.floor(rp() * outer.length)];
        const dir0 = (rp() < 0.5 ? 0 : Math.PI) + (rp() - 0.5) * 1.1;
        let cx = sx0, cy = sy0, dir = dir0;
        g.strokeStyle = `rgba(58,56,48,${0.3 + rp() * 0.25})`; g.lineWidth = 0.7 + rp() * 0.4;
        g.beginPath(); g.moveTo(cx, cy);
        for (let s = 0, l = (0.03 + rp() * 0.09) * sx; s < l; s += 4) { dir = dir0 + (dir - dir0) * 0.6 + (rp() - 0.5) * 0.9; cx += Math.cos(dir) * 4; cy += Math.sin(dir) * 4; g.lineTo(cx, cy); } // (straight on the whole, jagged in its steps)
        g.stroke();
      }
      if (y < wy - ry) { // dirt washed down out of it
        const yb = y + ry * 0.8, l = (0.02 + rp() * 0.07) * sy, gr = g.createLinearGradient(0, yb, 0, yb + l);
        gr.addColorStop(0, `rgba(58,56,40,${0.1 + rp() * 0.1})`); gr.addColorStop(1, 'rgba(58,56,40,0)');
        g.fillStyle = gr; g.fillRect(x - rx * (0.15 + rp() * 0.3), yb, rx * (0.3 + rp() * 0.4), l);
      }
    }
    for (let i = 0; i < len * 0.8; i++) { // a few long hairline cracks across the render, by themselves
      const dir0 = (rp() < 0.5 ? 0 : Math.PI) + (rp() - 0.5) * 0.6;
      let cx = rp() * w, cy = (band + 0.03 + rp() * (water - band - 0.05)) * sy, dir = dir0;
      g.strokeStyle = `rgba(62,60,52,${0.22 + rp() * 0.2})`; g.lineWidth = 0.6 + rp() * 0.3;
      g.beginPath(); g.moveTo(cx, cy);
      for (let s = 0, l = (0.08 + rp() * 0.3) * sx; s < l; s += 4) { dir = dir0 + (dir - dir0) * 0.6 + (rp() - 0.5) * 0.8; cx += Math.cos(dir) * 4; cy += Math.sin(dir) * 4; g.lineTo(cx, cy); }
      g.stroke();
    }
    // Mould: colonies where it is damp, most of them a dusting of specks too small to make out one by one, thickest at
    // their middle, a few bigger spots among them, a faint stain where they crowd; hardly any where it stays dry
    const rm = mulberry32(seed + 91);
    for (let i = 0; i < len * 30; i++) {
      const xm = rm() * len, ym = band + rm() * (water + 0.02 - band);
      if (rm() > damp(xm, ym) * 0.85 + 0.05) continue;
      const R = (0.01 + rm() ** 1.6 * 0.06) * sx, cx = xm * sx, cy = ym * sy, n = Math.min(160, Math.round(8 + (R * R) * 0.12 * (0.5 + rm())));
      if (R > 0.02 * sx) { const st = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.75); st.addColorStop(0, `rgba(30,32,26,${0.1 + rm() * 0.14})`); st.addColorStop(1, 'rgba(30,32,26,0)'); g.fillStyle = st; g.beginPath(); g.ellipse(cx, cy, R * 0.75, R * 0.55, 0, 0, Math.PI * 2); g.fill(); }
      for (let k = 0; k < n; k++) {
        const a = rm() * Math.PI * 2, d = Math.sqrt(-2 * Math.log(1 - rm() * 0.999)) * R * 0.42, big = rm() < 0.04;
        g.fillStyle = `rgba(24,26,22,${(0.2 + rm() * 0.45) * (1 - Math.min(0.7, d / R * 0.5))})`;
        g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75, big ? 0.9 + rm() * 1.1 : 0.3 + rm() ** 2 * 0.7, 0, Math.PI * 2); g.fill();
      }
    }
    for (const [mu, my] of marks) { // under a fitting in the wall (`marks`: [metres round, metres down]): rust run down from it
      const x = mu * sx, y = my * sy, gr = g.createLinearGradient(0, y, 0, y + 0.3 * sy);
      gr.addColorStop(0, 'rgba(112,64,30,0.75)'); gr.addColorStop(1, 'rgba(112,64,30,0)');
      g.fillStyle = gr; g.fillRect(x - 0.025 * sx, y, 0.05 * sx, 0.3 * sy);
      g.fillStyle = 'rgba(70,50,30,0.5)'; g.beginPath(); g.arc(x, y, 0.07 * sx, 0, Math.PI * 2); g.fill();
    }
    // the tiles: pale blue, each its own shade, grout gone black, cracks, the odd one off
    const n = Math.floor(len / TILE);
    for (let i = 0; i <= n; i++) {
      const x0 = i * TILE * sx, tw = TILE * sx, v = r();
      if (r() < 0.07) { // fallen off: the grey adhesive, combed
        g.fillStyle = `rgb(${132 + v * 14},${130 + v * 12},${122 + v * 10})`; g.fillRect(x0, 0, tw, band * sy);
        g.strokeStyle = 'rgba(90,88,80,0.6)'; g.lineWidth = 1.2;
        for (let k = 3; k < tw; k += 5) { g.beginPath(); g.moveTo(x0 + k, 2); g.lineTo(x0 + k + (r() - 0.5) * 3, band * sy - 2); g.stroke(); }
        continue;
      }
      const grd = g.createLinearGradient(0, 0, 0, band * sy);
      grd.addColorStop(0, `rgb(${Math.round(186 + v * 12)},${Math.round(205 + v * 10)},${Math.round(212 + v * 8)})`); // (paler: user, 2026-11-02)
      grd.addColorStop(0.75, `rgb(${Math.round(174 + v * 12)},${Math.round(193 + v * 10)},${Math.round(199 + v * 9)})`);
      grd.addColorStop(1, `rgb(${Math.round(130 + v * 10)},${Math.round(146 + v * 9)},${Math.round(141 + v * 9)})`); // greener and dirtier at its foot
      g.fillStyle = grd; g.fillRect(x0, 0, tw, band * sy);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x0 + 2, 2, tw * 0.5, band * sy * 0.4); // its glaze
      for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,70,50' : '220,226,220'},${0.05 + r() * 0.08})`; g.beginPath(); g.ellipse(x0 + r() * tw, r() * band * sy, 2 + r() * 8, 1 + r() * 4, r() * 3, 0, Math.PI * 2); g.fill(); } // stains and lime
      if (r() < 0.16) { // cracked across
        g.strokeStyle = 'rgba(40,46,40,0.8)'; g.lineWidth = 1;
        let cx = x0 + r() * tw, cy = 0; g.beginPath(); g.moveTo(cx, cy);
        while (cy < band * sy) { cx += (r() - 0.5) * 8; cy += 3 + r() * 5; g.lineTo(cx, cy); }
        g.stroke();
      }
      if (r() < 0.06) { g.fillStyle = `rgb(${120 + v * 10},${118 + v * 10},${110 + v * 8})`; g.beginPath(); g.moveTo(x0 + tw * r(), band * sy); g.lineTo(x0 + tw, band * sy * (0.3 + r() * 0.5)); g.lineTo(x0 + tw, band * sy); g.fill(); } // a corner gone
    }
    g.fillStyle = 'rgba(30,34,28,0.85)'; // the grout lines
    for (let i = 0; i <= n; i++) g.fillRect(i * TILE * sx - 1.2, 0, 2.4, band * sy);
    g.fillRect(0, band * sy - 1.5, w, 3);
  });
}

/**
 * The stagnant water's face, over the pool's footprint (`W` × `D` metres; top of the picture its far end): almost black
 * green-brown water, duckweed spread over it in drifts — thick against the walls and in the far, rounded end, where
 * the air pushed it — algae in mats, a few open patches of black water, seeds and bits. Returns { map, rough }.
 */
export function poolWaterTex(W, D, scum) {
  const S = 160, w = Math.round(W * S), h = Math.round(D * S), r = mulberry32(5161);
  const amount = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) amount[y * w + x] = scum(x / S, y / S);
  const map = canvasTex(w, h, (g) => {
    perPixel(g, w, h, (u, v, px, py) => {
      const a = amount[py * w + px], n = fbm(px * 0.08, py * 0.08, 0.3, 2);
      const mat = THREE.MathUtils.smoothstep(a, 0.25, 0.85) ** 1.3; // (algae, a film thickening into mats)
      return [16 + n * 10 + mat * (48 + n * 30), 20 + n * 10 + mat * (58 + n * 34), 13 + n * 6 + mat * (18 + n * 8)];
    });
    for (let i = 0; i < w * h * 0.09; i++) { // duckweed: each frond a tiny bright oval, in colonies thinning out at their edges
      const x = r() * w, y = r() * h, a = amount[Math.floor(y) * w + Math.floor(x)];
      if (r() > a * a * 1.4) continue;
      const v = r();
      g.fillStyle = `rgba(${Math.round(92 + v * 50)},${Math.round(118 + v * 46)},${Math.round(34 + v * 18)},${0.7 + r() * 0.3})`;
      g.beginPath(); g.ellipse(x, y, 0.6 + r() * 0.9, 0.5 + r() * 0.6, r() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 2500; i++) { // seeds, needles, bits of bark floating
      const x = r() * w, y = r() * h;
      g.strokeStyle = `rgba(${60 + r() * 40},${44 + r() * 26},${24 + r() * 16},0.8)`; g.lineWidth = 0.8;
      const a = r() * 3, l = 1 + r() * 4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
  const rough = canvasTex(w, h, (g) => perPixel(g, w, h, (u, v, px, py) => { const k = Math.round((0.05 + 0.85 * THREE.MathUtils.smoothstep(amount[py * w + px], 0.15, 0.5)) * 255); return [k, k, k]; }), { data: true });
  return { map, rough };
}

/**
 * Old wrought iron painted cream, out in the weather for years (the table and chairs): the paint chalky, yellowed and
 * grimed in its hollows, green with algae on its north faces; `rust`: what shows where it has flaked; `flake`: a
 * noise (data) the shader cuts the flakes out of. Tiles along the bars.
 */
export function ironPaintTex() {
  const L = lattice(5171), r = mulberry32(5172);
  const paint = canvasTex(256, 256, (g, w, h) => {
    perPixel(g, w, h, (u, v) => { const n = pfbm(L, u, v, 4, 4, 4), k = 184 + (n - 0.5) * 40; return [k, k - 7, k - 24]; });
    speckle(g, w, h, 3000, '#5a5040', 1.2, 5173);
    for (let i = 0; i < 40; i++) wrapDraw(g, w, h, r() * w, r() * h, () => { g.fillStyle = `rgba(${r() < 0.5 ? '90,96,60' : '120,104,70'},${0.08 + r() * 0.14})`; g.beginPath(); g.ellipse(0, 0, 6 + r() * 30, 4 + r() * 12, r() * 3, 0, Math.PI * 2); g.fill(); });
  }, { repeat: [1, 1] });
  const rust = canvasTex(256, 256, (g, w, h) => {
    perPixel(g, w, h, (u, v) => { const n = pfbm(L, u + 0.4, v + 0.1, 6, 6, 4), m = pfbm(L, u, v + 0.5, 24, 24, 2); return [96 + n * 70 - m * 20, 52 + n * 34 - m * 12, 26 + n * 14]; });
    speckle(g, w, h, 4000, '#2a160c', 1.4, 5174);
  }, { repeat: [1, 1] });
  const flake = canvasTex(256, 256, (g, w, h) => perPixel(g, w, h, (u, v) => { const k = Math.round((pfbm(L, u + 0.7, v + 0.3, 8, 8, 4) * 0.8 + pnoise(L, u * 64, v * 64, 64, 64) * 0.2) * 255); return [k, k, k]; }), { repeat: [1, 1], data: true });
  return { paint, rust, flake };
}

/**
 * The iron table's top, a slab of cast stone gone dark grey-green (its picture over the oval, `W` × `D` metres): green
 * with algae and mildew, darker in the middle where the rain stands, lichen in rosettes, a paler band round the rim,
 * the rings of old wet leaves that rotted on it.
 */
export function tableTopTex(W, D) {
  const r = mulberry32(5181), L = lattice(5182);
  return canvasTex(512, Math.round(512 * D / W), (g, w, h) => {
    perPixel(g, w, h, (u, v) => {
      const n = pfbm(L, u, v, 5, 4, 4), d = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2), rim = THREE.MathUtils.smoothstep(d, 0.78, 0.98);
      const k = 62 + (n - 0.5) * 38 + rim * 24;
      return [k * 1.02, k * 1.0, k * 0.84]; // (grey with a little green in it, not painted green: the sky over it makes it bluer)
    });
    for (let i = 0; i < 14; i++) { const x = (0.2 + r() * 0.6) * w, y = (0.2 + r() * 0.6) * h, s = 8 + r() * 26; g.strokeStyle = `rgba(30,34,24,${0.2 + r() * 0.2})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.ellipse(x, y, s, s * (0.4 + r() * 0.3), r() * 3, 0, Math.PI * 2); g.stroke(); } // the ghosts of leaves rotted on it
    for (let i = 0; i < 26; i++) { // lichen, in crusts of irregular shape, not spots
      const x = r() * w, y = r() * h, rad = 3 + r() ** 2 * 12;
      g.fillStyle = r() < 0.7 ? 'rgba(128,134,112,0.32)' : 'rgba(120,108,62,0.3)';
      g.beginPath(); for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI * 2, q = rad * (0.5 + r() * 0.6); k ? g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.8) : g.moveTo(x + q, y); } g.fill();
    }
    speckle(g, w, h, 6000, '#1e2418', 1.4, 5183);
  });
}

/**
 * A spray of an overgrown shrub's leaves on its twigs (for a card ~0.6 m square; pool.js heaps them into bushes):
 * small leathery leaves, dark and dull, some yellowing, a few eaten; `bloom` 1: pink flowers in loose clusters,
 * faded, some gone brown at their edges, 2: white ones; clear round them.
 */
export function shrubSprayTex(seed = 1, bloom = 0) {
  return bleed(canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(5191 + seed * 13 + bloom * 101);
    const twigs = [];
    const twig = (x0, y0, a, len, depth) => {
      const pts = [[x0, y0]];
      let x = x0, y = y0;
      for (let i = 0; i < 7; i++) { a += (r() - 0.5) * 0.45; x += Math.sin(a) * len / 7; y -= Math.cos(a) * len / 7; pts.push([x, y]); }
      twigs.push(pts);
      g.strokeStyle = 'rgba(84,70,52,0.85)'; g.lineWidth = depth ? 1.2 : 2.2;
      g.beginPath(); pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
      if (depth < 1) for (let k = 0; k < 5; k++) { const p = pts[1 + k]; twig(p[0], p[1], a + (k % 2 ? 1 : -1) * (0.5 + r() * 0.6), len * (0.55 - k * 0.07), depth + 1); }
    };
    twig(w * 0.5, h * 0.92, (r() - 0.5) * 0.4, h * 0.78, 0);
    for (let i = 0; i < 460; i++) {
      const pts = twigs[Math.floor(r() * twigs.length)], p = pts[1 + Math.floor(r() * (pts.length - 1))];
      const Lf = (22 + r() * 18) * (1 - 0.25 * (p[1] < h * 0.3 ? 1 : 0)), turn = (r() - 0.5) * 3.2, edge = 0.3 + r() * 0.7, v = r(), yellow = r() < 0.06, eaten = r() < 0.1;
      g.save(); g.translate(p[0] + (r() - 0.5) * 8, p[1] + (r() - 0.5) * 8); g.rotate(turn); g.scale(edge, 1);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Lf * 0.42, -Lf * 0.45, 0, -Lf); g.quadraticCurveTo(-Lf * 0.42, -Lf * 0.45, 0, 0);
      g.fillStyle = yellow ? `rgb(${Math.round(150 + v * 30)},${Math.round(138 + v * 24)},${Math.round(62 + v * 20)})` : `rgb(${Math.round(46 + v * 34)},${Math.round(66 + v * 36)},${Math.round(30 + v * 18)})`;
      g.fill();
      g.save(); g.clip(); g.fillStyle = 'rgba(230,240,210,0.1)'; g.fillRect(0, -Lf, Lf, Lf); g.restore(); // one half shines more
      g.strokeStyle = 'rgba(170,186,130,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -Lf * 0.9); g.stroke();
      if (eaten) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc((r() < 0.5 ? -1 : 1) * Lf * 0.2, -Lf * (0.3 + r() * 0.4), 2 + r() * 4, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; }
      g.restore();
    }
    if (bloom) for (let c = 0, n = 5 + Math.floor(r() * 5); c < n; c++) { // flowers in loose clusters at the twigs' ends
      const pts = twigs[Math.floor(r() * twigs.length)], [cx, cy] = pts[pts.length - 1];
      for (let k = 0, m = 2 + Math.floor(r() * 5); k < m; k++) {
        const fx = cx + (r() - 0.5) * 34, fy = cy + (r() - 0.5) * 28, R = 9 + r() * 7, v = r(), brown = r() < 0.3;
        const base = bloom === 1 ? [186 + v * 26, 108 + v * 34, 130 + v * 30] : [186 + v * 18, 180 + v * 16, 160 + v * 16];
        g.save(); g.translate(fx, fy); g.rotate(r() * 6.3); g.scale(1, 0.55 + r() * 0.45);
        for (let p = 0; p < 5; p++) {
          g.rotate((Math.PI * 2) / 5);
          g.fillStyle = `rgb(${Math.round(base[0] * (0.85 + r() * 0.15))},${Math.round(base[1] * (0.85 + r() * 0.15))},${Math.round(base[2] * (0.85 + r() * 0.15))})`;
          g.beginPath(); g.ellipse(0, -R * 0.55, R * 0.38, R * 0.55, 0, 0, Math.PI * 2); g.fill();
          if (brown) { g.fillStyle = 'rgba(120,80,50,0.5)'; g.beginPath(); g.ellipse(0, -R * 0.95, R * 0.3, R * 0.2, 0, 0, Math.PI * 2); g.fill(); }
        }
        g.fillStyle = bloom === 1 ? 'rgba(150,60,80,0.8)' : 'rgba(190,170,90,0.8)'; g.beginPath(); g.arc(0, 0, R * 0.18, 0, Math.PI * 2); g.fill();
        g.restore();
      }
    }
  }));
}

/**
 * Weeds for a crossed card (pool.js): tall leafy stalks with their leaves in pairs up them, a few grass blades, a
 * seed head or two gone to fluff, all dusty, some leaves yellowing; `kind` 0 bushy (the waist-high growth round the
 * table), 1 thin and grassy (between the stones). Clear round them.
 */
export function weedTex(kind = 0, seed = 1) {
  return bleed(canvasTex(256, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(5201 + kind * 37 + seed * 7);
    const blades = kind ? 46 : 5, stalks = kind ? 3 : 8;
    for (let i = 0; i < blades; i++) { // grass blades
      const x0 = w * (0.5 + (r() - 0.5) * 0.7), tall = h * (0.25 + r() * (kind ? 0.6 : 0.4)), lean = (r() - 0.5) * w * 0.5, v = r(), dry = r() < 0.15;
      g.fillStyle = dry ? `rgb(${Math.round(150 + v * 30)},${Math.round(142 + v * 24)},${Math.round(92 + v * 20)})` : `rgb(${Math.round(78 + v * 30)},${Math.round(102 + v * 32)},${Math.round(44 + v * 16)})`;
      g.beginPath(); g.moveTo(x0 - 2, h); g.quadraticCurveTo(x0 + lean * 0.3, h - tall * 0.6, x0 + lean, h - tall); g.quadraticCurveTo(x0 + lean * 0.3 + 2, h - tall * 0.6, x0 + 2.5, h); g.fill();
    }
    for (let s = 0; s < stalks; s++) { // the stalks, leaves in pairs up them
      const x0 = w * (0.5 + (r() - 0.5) * 0.6), tall = h * (kind ? 0.5 + r() * 0.4 : 0.55 + r() * 0.44), sway = (r() - 0.5) * w * 0.35, ph = r() * 6;
      const at = (t) => [x0 + sway * t * t + Math.sin(t * 4 + ph) * 4, h - t * tall];
      g.strokeStyle = 'rgba(88,98,54,0.95)'; g.lineWidth = kind ? 1.4 : 2.4;
      g.beginPath(); for (let i = 0; i <= 30; i++) { const [x, y] = at(i / 30); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      for (let t = 0.08 + r() * 0.06; t < 0.97; t += (kind ? 0.12 : 0.06) + r() * 0.035) {
        const [x, y] = at(t), Lf = (kind ? 14 : 20 + r() * 16) * (1 - t * 0.4), v = r(), yellow = r() < 0.035;
        for (const sd of [-1, 1]) { // (broad and oval, in pairs, as the weeds in his photograph)
          g.save(); g.translate(x, y); g.rotate(sd * (0.8 + r() * 0.7) - 0.1); g.scale(kind ? 0.5 + r() * 0.5 : 0.75 + r() * 0.35, 1);
          g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Lf * (kind ? 0.5 : 0.75), -Lf * 0.5, 0, -Lf); g.quadraticCurveTo(-Lf * (kind ? 0.5 : 0.75), -Lf * 0.5, 0, 0);
          g.fillStyle = yellow ? `rgb(${Math.round(140 + v * 30)},${Math.round(132 + v * 24)},${Math.round(64 + v * 20)})` : `rgb(${Math.round(54 + v * 30)},${Math.round(78 + v * 30)},${Math.round(36 + v * 14)})`;
          g.fill();
          g.strokeStyle = 'rgba(190,200,150,0.3)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -Lf * 0.85); g.stroke();
          g.restore();
        }
      }
      if (r() < 0.12) { const [x, y] = at(1); g.fillStyle = 'rgba(176,168,140,0.7)'; for (let k = 0; k < 12; k++) { g.beginPath(); g.arc(x + (r() - 0.5) * 9, y + (r() - 0.5) * 9, 0.6 + r() * 0.6, 0, Math.PI * 2); g.fill(); } } // gone to seed
    }
  }));
}

/** The angel's stone (a tile 0.5 m square, laid on three ways): near white, sugary, pitted all over by the weather. */
export function marbleTex() {
  const L = lattice(5251);
  return canvasTex(512, 512, (g, w, h) => {
    perPixel(g, w, h, (u, v) => {
      const a = pfbm(L, u, v, 3, 3, 4), vein = Math.pow(1 - Math.abs(2 * pfbm(L, u + a * 0.25, v + a * 0.2, 4, 4, 4) - 1), 14), grain = pnoise(L, u * 180, v * 180, 180, 180), g2 = pnoise(L, u * 70, v * 70, 70, 70);
      const k = 240 + (a - 0.5) * 16 + (grain - 0.5) * 18 - vein * 14 - Math.max(0, g2 - 0.72) * 170;
      return [k, k - 1, k - 5];
    });
    speckle(g, w, h, 9000, '#4b473e', 1.3, 5252);
  }, { repeat: [1, 1] });
}

/**
 * Rain standing on the paving (a picture over one puddle, its own `seed`, no two alike): murky, clear at its ragged edge so
 * the stones and the moss show through the shallows, darker where it is deeper, silt and bits of green and seed on it.
 */
export function puddleTex(seed) {
  const L = lattice(5271 + seed), r = mulberry32(5281 + seed);
  return canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h, d = Math.hypot(u - 0.5, v - 0.5) * 2.3, n = pfbm(L, u, v, 5, 5, 4), silt = pfbm(L, u + 0.4, v + 0.7, 14, 14, 3);
      const a = 1 - THREE.MathUtils.smoothstep(d + (n - 0.5) * 0.65, 0.62, 0.92), k = (y * w + x) * 4;
      img.data[k] = 36 + silt * 34; img.data[k + 1] = 38 + silt * 32; img.data[k + 2] = 22 + silt * 18;
      img.data[k + 3] = a * (118 + 80 * THREE.MathUtils.smoothstep(a, 0.4, 1) + (silt - 0.5) * 60);
    }
    g.putImageData(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 700; i++) { const x = r() * w, y = r() * h, c = r(); g.fillStyle = c < 0.55 ? `rgba(${70 + r() * 40},${92 + r() * 40},${30 + r() * 16},${0.35 + r() * 0.5})` : `rgba(${60 + r() * 40},${46 + r() * 26},${26 + r() * 14},${0.3 + r() * 0.5})`; g.beginPath(); g.ellipse(x, y, 0.5 + r() * 1.2, 0.4 + r() * 0.8, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'source-over';
  });
}

/**
 * The drowned flamingo's paint (`flamingoTex`, side on): years under and half out of stagnant water. Bleached, grey-green
 * mould in blotches, thick low down and round its slime line, black specks of it spreading higher, the beak's black gone
 * grey (`F`: its box and where its parts are).
 */
export function mouldyFlamingoTex(seed, F) {
  const t = flamingoTex(seed, F), g = t.image.getContext('2d'), w = t.image.width, h = t.image.height, r = mulberry32(seed + 5);
  const [x0, x1, y0, y1] = F.box, px = (x) => ((x - x0) / (x1 - x0)) * w, py = (y) => (1 - (y - y0) / (y1 - y0)) * h;
  g.fillStyle = 'rgba(214,170,170,0.14)'; g.fillRect(0, 0, w, h); // faded, still pink
  const X0 = px(0.15), X1 = px(0.35), Yw = py(0.782), Ytop = py(0.99);
  for (let i = 0; i < 260; i++) { // blotches: low down thick, thinning upwards
    const up = r() ** 1.7, x = X0 + r() * (X1 - X0), y = Yw + (Ytop - Yw) * up + (r() - 0.5) * h * 0.02, rad = (2 + r() ** 2 * 11) * (w / 512) * (1.2 - up * 0.7), c = r();
    g.fillStyle = c < 0.45 ? `rgba(${58 + r() * 26},${72 + r() * 26},${38 + r() * 14},${0.3 + r() * 0.4})` : c < 0.8 ? `rgba(26,30,20,${0.28 + r() * 0.4})` : `rgba(84,66,40,${0.25 + r() * 0.3})`;
    g.beginPath(); for (let k = 0; k <= 10; k++) { const a = (k / 10) * 6.283, q = rad * (0.6 + r() * 0.6); k ? g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.8) : g.moveTo(x + q, y); } g.fill();
  }
  speckle(g, w, h, 2200, '#14160e', 1.5, seed + 6);
  g.fillStyle = 'rgba(40,52,24,0.75)'; g.fillRect(0, py(0.804), w, py(0.768) - py(0.804)); // the slime line
  t.needsUpdate = true;
  return t;
}

/**
 * The inside of an overgrown bush, seen between its outer sprays (no cut-outs: a tile 1 m square, repeating): leaf over
 * leaf, darker the deeper, twigs among them, nothing bare showing.
 */
export function foliageMassTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = mulberry32(5261);
    g.fillStyle = '#10180c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, L = 14 + r() * 16, a = r() * 6.3, deep = i / 2600, v = r(), e = 0.4 + r() * 0.6;
      wrapDraw(g, w, h, x, y, () => {
        g.rotate(a); g.scale(e, 1);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.42, -L * 0.45, 0, -L); g.quadraticCurveTo(-L * 0.42, -L * 0.45, 0, 0);
        g.fillStyle = `rgb(${Math.round((30 + v * 26) + deep * 30)},${Math.round((46 + v * 32) + deep * 44)},${Math.round((22 + v * 14) + deep * 16)})`;
        g.fill();
      });
    }
  }, { repeat: [1, 1] });
}
