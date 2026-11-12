import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- deterministic random / noise ----------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

const smooth = (t) => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;

// A cell's eight corner values, kept: the textures and the yard's maps ask for the same cells over and over, and
// the sines were a third of the time spent drawing them (2026-11-05, load time). Same numbers as worked out afresh.
const CELLS = 1 << 14, cellKey = new Float64Array(CELLS * 3).fill(NaN), cellVal = new Float64Array(CELLS * 8);
export function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = smooth(x - xi), v = smooth(y - yi), w = smooth(z - zi);
  const slot = ((Math.imul(xi | 0, 73856093) ^ Math.imul(yi | 0, 19349663) ^ Math.imul(zi | 0, 83492791)) >>> 0) & (CELLS - 1), k = slot * 3, o = slot * 8;
  if (cellKey[k] !== xi || cellKey[k + 1] !== yi || cellKey[k + 2] !== zi) {
    cellKey[k] = xi; cellKey[k + 1] = yi; cellKey[k + 2] = zi;
    cellVal[o] = hash3(xi, yi, zi); cellVal[o + 1] = hash3(xi + 1, yi, zi); cellVal[o + 2] = hash3(xi, yi + 1, zi); cellVal[o + 3] = hash3(xi + 1, yi + 1, zi);
    cellVal[o + 4] = hash3(xi, yi, zi + 1); cellVal[o + 5] = hash3(xi + 1, yi, zi + 1); cellVal[o + 6] = hash3(xi, yi + 1, zi + 1); cellVal[o + 7] = hash3(xi + 1, yi + 1, zi + 1);
  }
  return mix(
    mix(mix(cellVal[o], cellVal[o + 1], u), mix(cellVal[o + 2], cellVal[o + 3], u), v),
    mix(mix(cellVal[o + 4], cellVal[o + 5], u), mix(cellVal[o + 6], cellVal[o + 7], u), v),
    w
  );
}

export function fbm(x, y, z, octaves = 3) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += vnoise(x, y, z) * amp;
    norm += amp;
    x *= 2.03; y *= 2.03; z *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

// ---------- loading ----------

// The world takes a good many seconds to build (its textures are drawn, its boards cut one by one). Built in one go the
// page froze that long and browsers called it hung (2026-11-05, players' complaints): it stops now and then to let the
// browser breathe and to move the loading line on. `whenBuilt`: what arrives over the network (Mum, the angel) waits
// for the build to be done, as it always did when the build ran in one go.
let builtDone;
export const whenBuilt = new Promise((r) => { builtDone = r; });
export const built = () => builtDone();
/** What is still on its way over the network (Mum, the angel), for its shaders to be compiled with the rest if it is here in time. */
export const arrivals = [];
export const arrive = (p) => { arrivals.push(p.catch(() => {})); return p; };
/**
 * A file sent for at once, as the page starts, not when its turn comes late in the building of the world: Mum and the
 * angel, 21 MB between them, were only asked for ten seconds in, and on a slow line were still coming when everything
 * else was ready (players, 2026-11-09: "too long to load"). Behind whatever the build itself asks for. Gives its bytes.
 */
const sentFor = new Map();
export function fetchEarly(url) {
  if (!sentFor.has(url)) {
    const bytes = fetch(url, { priority: 'low' }).then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.arrayBuffer(); });
    bytes.catch(() => {}); // (whoever uses it hears of it)
    sentFor.set(url, bytes);
  }
  return sentFor.get(url);
}
export function breathe(share) {
  if (share != null) {
    const el = document.getElementById('start-status'), fill = document.getElementById('start-fill');
    if (el) el.textContent = `Loading… ${Math.round(share * 100)}%`;
    if (fill) {
      // the bar, in whole blocks (a block and its gap: 10 px; styles.css)
      const bar = fill.parentElement, blocks = Math.floor((bar.clientWidth - 6) / 10);
      fill.style.width = `${Math.min(blocks, Math.round(share * blocks)) * 10}px`;
      bar.setAttribute('aria-valuenow', String(Math.round(share * 100)));
    }
  }
  return new Promise((r) => {
    if (document.hidden) { // (no frames in a tab out of sight, and its timers slowed to one a second)
      const ch = new MessageChannel();
      ch.port1.onmessage = () => r();
      ch.port2.postMessage(0);
      return;
    }
    let done = false;
    const go = () => { if (!done) { done = true; setTimeout(r, 0); } };
    requestAnimationFrame(go); // (a frame drawn: the line shows)
    setTimeout(go, 60);
  });
}

// ---------- textures ----------

const TEXLOG = typeof location !== 'undefined' && location.search.includes('texlog'); // (which function drew each texture)
export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.userData.drawn = true; // (drawn once here: lighten.js may share it, slim it and let its canvas go once it is on the GPU)
  if (TEXLOG) t.userData.from = new Error().stack.split('\n')[2]?.trim();
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  if (opts.pixel) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
  }
  return t;
}

/** Texture from an image file in assets/ (artwork supplied for the game). */
export function imageTex(url) {
  const t = new THREE.Texture();
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const img = new Image();
  img.onload = () => {
    t.image = img;
    t.needsUpdate = true;
  };
  img.src = url;
  return t;
}

// ---------- mesh helpers ----------

export function shadowed(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

/** Box positioned by its centre. */
export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Box given by min/max corners, handy for architecture. */
export function boxMM(x0, x1, y0, y1, z0, z1, mat) {
  return box(x1 - x0, y1 - y0, z1 - z0, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

export function rbox(w, h, d, r, mat, x = 0, y = 0, z = 0, seg = 3) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, r), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function cyl(rTop, rBot, h, mat, x = 0, y = 0, z = 0, seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Textured flat rectangle (posters, covers, labels). Faces local +z. */
export function plane(w, h, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

function planarUV(geo, scale) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) * scale;
    uv[i * 2 + 1] = p.getZ(i) * scale + p.getY(i) * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/**
 * Lumpy heap (clothes, bags): a noise-displaced ball with a flattened underside,
 * resting on y = 0.
 */
export function blob(mat, sx, sy, sz, { seed = 0, amp = 0.28, freq = 1.7, detail = 14, uvScale = 4 } = {}) {
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo, 1e-4);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = fbm(x * freq + seed * 7.3, y * freq + seed * 1.7, z * freq - seed * 3.1, 4);
    const r = 1 + (n - 0.5) * 2 * amp;
    const yy = y < 0 ? y * 0.12 : y;
    p.setXYZ(i, x * r * sx, (yy * r + 0.12) * sy, z * r * sz);
  }
  planarUV(geo, uvScale);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Pillow: superellipsoid so it reads as a stuffed cushion, not a ball. */
export function pillow(mat, w, h, d, seed = 0) {
  const geo = new THREE.SphereGeometry(1, 40, 28);
  const p = geo.attributes.position;
  const pw = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = (fbm(x * 2 + seed, y * 2, z * 2 + seed, 3) - 0.5) * 0.12;
    p.setXYZ(i, pw(x, 0.45) * (w / 2) * (1 + n), pw(y, 1.0) * (h / 2) * (1 + n * 2), pw(z, 0.45) * (d / 2) * (1 + n));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/**
 * Cloth laid flat on a surface then falling over its edge.
 * Local frame: cloth spans x in [-w/2, w/2]; it runs along +z for `flat` metres at y = 0,
 * then bends over a rounded edge and hangs down for `hang` metres.
 */
export function drape(mat, w, flat, hang, { seed = 0, wrinkle = 0.02, radius = 0.04, uvScale = 2, segW = 30, segL = 44, ragged = 0 } = {}) {
  const total = flat + hang;
  const geo = new THREE.PlaneGeometry(w, total, segW, segL);
  const p = geo.attributes.position;
  const uv = geo.attributes.uv;
  const arc = (Math.PI / 2) * radius;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    // a garment isn't a rectangle: let the hem wander and the sides pull in as it falls
    const hem = 1 - ragged * (0.5 + 0.5 * Math.sin(x * 9 + seed * 2.3)) * 0.6;
    const s = (total / 2 - p.getY(i)) * hem; // distance along the cloth
    let y, z, ny, nz;
    if (s <= flat - radius) {
      y = 0; z = s; ny = 1; nz = 0;
    } else if (s <= flat - radius + arc) {
      const a = (s - (flat - radius)) / radius;
      z = flat - radius + Math.sin(a) * radius;
      y = -radius + Math.cos(a) * radius;
      ny = Math.cos(a); nz = Math.sin(a);
    } else {
      const t = s - (flat - radius + arc);
      z = flat; y = -radius - t; ny = 0; nz = 1;
    }
    // hanging part ripples more, and the hem is ragged
    const hangAmt = s > flat ? 1 : 0.45;
    const n = (fbm(x * 5 + seed * 3.1, s * 5 + seed, seed * 1.3, 3) - 0.5) * 2 * wrinkle * hangAmt;
    const fold = Math.sin(x * 14 + seed * 5 + s * 3) * wrinkle * 0.8 * (s > flat ? 1 : 0.15);
    const d = n + fold + wrinkle * 0.6;
    const pinch = 1 - ragged * 0.5 * Math.max(0, s - flat) / Math.max(hang, 1e-3);
    p.setXYZ(i, x * pinch, y + ny * d, z + nz * d);
    uv.setXY(i, x * uvScale, s * uvScale);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/**
 * Cable through a list of [x, y, z] points. The spline is sampled and every sample is held
 * above `floor` — the surface the cable lies on — so it can never dip out of sight between
 * the points that define it.
 */
export function cable(points, radius, mat, { floor = 0 } = {}) {
  const rough = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const samples = rough.getPoints(points.length * 14);
  for (const p of samples) p.y = Math.max(p.y, floor + radius);
  const curve = new THREE.CatmullRomCurve3(samples, false, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, samples.length * 2, radius, 6, false), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const deg = (d) => (d * Math.PI) / 180;

/**
 * How strong the sun and the sky are on what is out of doors, as a share of what they are indoors (house.js sets it
 * as you go in and out: the eye opens up indoors). Shared by the house's outdoor materials (build.js) and the
 * outward faces of the bedroom's window (room.js).
 */
export const YARD_SUN = { value: 1 };

/** The house's sun (house.js), whose shadows — the roof's, the trees' — the bedroom's window takes on its outer faces (room.js). */
export const HOUSE_SUN = { light: null, wallZ: 0 }; // (wallZ: the bedroom's north wall's outer face)
