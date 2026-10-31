// The game inside the TV — "The Legend of Zelpa: Kazoo of Space". Its first room, the Hollow:
// the inside of a giant tree, open to the stars, with the wooden ladle waiting on top of the
// heartwood, a gallery hollowed into the wall a floor up, a ladder of pegs to it, and a bad
// mushroom standing guard at the foot of the ladder.
// Built the way a 1998 console would have drawn it: a few hundred triangles, tiny blurry
// textures, lighting painted into the vertices instead of computed, fog, and 240 lines.
// Everything in here is original to this game: layout, textures, names and text.
import * as THREE from 'three';
import { mulberry32 } from './util.js';
import { makeHud } from './zelpa-hud.js';
import { crtFinish } from './textures.js';

const TAU = Math.PI * 2;
const LINES = 240; // vertical resolution of the picture
// You move in here exactly as in the bedroom: same legs, same jump. So the place has to be the
// bedroom's kind of size, or the same walk feels like wading. It is laid out below in big round
// numbers and built at this fraction of them.
const SCALE = 0.5;
const SIDES = 12, WALL_R = 9.4, WALL_H = 18; // the trunk: a tall twelve-sided well
const PILLAR_R = 1.25, PILLAR_H = 3.6; // the heartwood…
const HEART = { x: 0, z: -2.4 }; // …which stands back from the middle, well away from where you come in
// The gallery: a floor up, hollowed into the wall from panel `first` (left of straight ahead as
// you arrive) round by the north to panel `last` (due east). The ladder to it is on the first
// panel, three-quarters of the way from west to north.
const LOFT = { first: 7, last: 11, y: 4.8, h: 4.4, deep: 4.4, ladder: 0.75 };
const inLoft = (i) => i >= LOFT.first && i <= LOFT.last;
// shelf mushrooms winding up the heartwood: [angle round it (degrees), height of the top]
const STEPS = [[60, 0.72], [108, 1.44], [156, 2.16], [204, 2.88]];
const STEP_OUT = 1.8, STEP_R = 0.9, STEP_HALF = 0.7; // how far out they sit, their size, the part you can stand on
// The way back out is the TV's screen seen from behind: a hole in the south wall, the size of the glass.
const HOLE = { w: 0.45, h: 0.345 }; // how high it sits is the TV's own height: see buildZelpa
const FOG = 0x0a1418;

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
// Glows are added to the picture. They must leave its alpha alone: alpha is how the picture
// records where the glass is (see api.render).
const GLOW = { transparent: true, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
const col = (hex) => new THREE.Color(hex);
const WHITE = col(0xffffff);
const UP = v3(0, 1, 0);

// ---------------------------------------------------------------- textures

function tex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.LinearFilter; // smeared, never crisp
  t.generateMipmaps = false;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const barkTex = () => tex(64, 64, (g, w, h) => {
  const rnd = mulberry32(7);
  for (let x = 0; x < w; x++) {
    const l = 0.72 + 0.56 * rnd();
    g.fillStyle = `rgb(${(92 * l) | 0},${(62 * l) | 0},${(38 * l) | 0})`;
    g.fillRect(x, 0, 1, h);
  }
  for (let i = 0; i < 10; i++) {
    let x = rnd() * w;
    g.strokeStyle = 'rgba(24,14,8,0.75)';
    g.lineWidth = 1 + rnd() * 1.6;
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 8; y <= h; y += 8) g.lineTo((x += (rnd() - 0.5) * 5), y);
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(150,112,70,0.5)' : 'rgba(20,12,6,0.5)';
    g.fillRect(rnd() * w, rnd() * h, 1, 1 + rnd() * 3);
  }
});

/**
 * The floor is the cut face of the trunk: growth rings, cracked. Fine rings and some grain:
 * a floor made of big soft blotches reads as being right under your nose, and you feel short.
 */
const ringsTex = () => tex(512, 512, (g, w, h) => {
  const rnd = mulberry32(11), k = w / 256;
  g.fillStyle = '#3a2a1a';
  g.fillRect(0, 0, w, h);
  for (let r = w / 2 - 1; r > 0; r -= 1 + Math.floor(rnd() * 3)) {
    const l = 0.8 + rnd() * 0.4, dark = rnd() < 0.3;
    g.fillStyle = dark ? `rgb(${(128 * l) | 0},${(92 * l) | 0},${(52 * l) | 0})` : `rgb(${(176 * l) | 0},${(134 * l) | 0},${(80 * l) | 0})`;
    g.beginPath();
    g.arc(w / 2 + (rnd() - 0.5), h / 2 + (rnd() - 0.5), r, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 12000; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(58,36,16,0.4)' : 'rgba(220,182,124,0.32)';
    g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1);
  }
  g.strokeStyle = 'rgba(40,24,12,0.8)';
  for (let i = 0; i < 16; i++) {
    const a = rnd() * TAU, r0 = (10 + rnd() * 40) * k, r1 = (66 + rnd() * 58) * k;
    g.lineWidth = 1 + rnd();
    g.beginPath();
    g.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
    g.lineTo(w / 2 + Math.cos(a + 0.05) * r1, h / 2 + Math.sin(a + 0.05) * r1);
    g.stroke();
  }
}, false);

/** Fallen leaves, lying every way: the floor of the gallery. */
const leafTex = () => tex(64, 64, (g, w, h) => {
  const rnd = mulberry32(53);
  g.fillStyle = '#3d3319';
  g.fillRect(0, 0, w, h);
  const shades = ['#5d6b22', '#7a7a28', '#8c6a22', '#a8531f', '#4a5a1e', '#9a8a34', '#6b3f1a'];
  for (let i = 0; i < 150; i++) {
    const x = rnd() * w, y = rnd() * h, len = 5 + rnd() * 6, turn = rnd() * TAU;
    // drawn again one tile over wherever it runs off an edge, so the tiles join
    for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
      g.save();
      g.translate(x + ox, y + oy);
      g.rotate(turn);
      g.fillStyle = shades[i % shades.length];
      g.beginPath();
      g.ellipse(0, 0, len / 2, len / 4.2, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(30,22,8,0.55)';
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(-len / 2, 0);
      g.lineTo(len / 2, 0);
      g.stroke();
      g.restore();
    }
  }
});

/** Grey stone: for the slab that hangs over the pit. `leafy`: with leaves lying on it. */
const stoneTex = (leafy = false) => tex(64, 64, (g, w, h) => {
  const rnd = mulberry32(leafy ? 71 : 67);
  g.fillStyle = '#6f6f6a';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(40,40,38,0.35)' : 'rgba(150,150,140,0.3)';
    g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1 + Math.floor(rnd() * 2), 1);
  }
  g.strokeStyle = 'rgba(30,30,28,0.7)';
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    let x = rnd() * w, y = rnd() * h;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) g.lineTo((x += (rnd() - 0.5) * 16), (y += (rnd() - 0.5) * 16));
    g.stroke();
  }
  if (!leafy) return;
  const shades = ['#5d6b22', '#7a7a28', '#8c6a22', '#a8531f', '#4a5a1e', '#9a8a34'];
  for (let i = 0; i < 26; i++) {
    const len = 6 + rnd() * 6;
    g.save();
    g.translate(4 + rnd() * (w - 8), 4 + rnd() * (h - 8));
    g.rotate(rnd() * TAU);
    g.fillStyle = shades[i % shades.length];
    g.beginPath();
    g.ellipse(0, 0, len / 2, len / 4.2, 0, 0, TAU);
    g.fill();
    g.restore();
  }
}, !leafy);

const capTex = () => tex(32, 32, (g, w, h) => {
  const rnd = mulberry32(19);
  g.fillStyle = '#b4522b';
  g.fillRect(0, 0, w, h);
  const ring = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, 17);
  ring.addColorStop(0, 'rgba(232,150,88,0.9)');
  ring.addColorStop(1, 'rgba(110,40,20,0.9)');
  g.fillStyle = ring;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f1dcb4';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(4 + rnd() * 24, 4 + rnd() * 24, 1 + rnd() * 1.8, 0, TAU);
    g.fill();
  }
}, false);

const signTex = () => tex(128, 64, (g, w, h) => {
  g.fillStyle = '#8a6238';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(50,30,14,0.55)';
  for (const y of [0, 21, 42, 62]) g.fillRect(0, y, w, 2);
  g.strokeStyle = '#3c2410';
  g.lineWidth = 4;
  g.strokeRect(2, 2, w - 4, h - 4);
  g.fillStyle = '#2a1608';
  g.textAlign = 'center';
  g.font = 'bold 19px Georgia, serif';
  g.fillText('THE HOLLOW', w / 2, 30);
  g.font = 'bold 13px Georgia, serif';
  g.fillText('· mind the mushrooms ·', w / 2, 50);
}, false);

const starsTex = () => tex(128, 128, (g, w, h) => {
  const rnd = mulberry32(31);
  g.fillStyle = '#03040b';
  g.fillRect(0, 0, w, h);
  const haze = g.createRadialGradient(40, 84, 2, 40, 84, 60);
  haze.addColorStop(0, 'rgba(70,40,110,0.55)');
  haze.addColorStop(1, 'rgba(70,40,110,0)');
  g.fillStyle = haze;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 110; i++) {
    const big = rnd() < 0.12;
    g.fillStyle = ['#ffffff', '#cfe0ff', '#fff0c8'][Math.floor(rnd() * 3)];
    g.globalAlpha = 0.45 + rnd() * 0.55;
    g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), big ? 2 : 1, big ? 2 : 1);
  }
  g.globalAlpha = 1;
});

const glowTex = () => tex(32, 32, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,240,190,0.55)');
  r.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, w, h);
}, false);

/** Light leaking round the edge of the screen onto the wall it is set in. */
const spillTex = () => tex(64, 64, (g, w, h) => {
  g.shadowColor = 'rgba(255,240,214,1)';
  g.shadowBlur = 13;
  g.fillStyle = '#fff3dc';
  for (let i = 0; i < 3; i++) g.fillRect(w * 0.36, h * 0.37, w * 0.28, h * 0.26);
}, false);

const whiteTex = () => tex(2, 2, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 2, 2); });

// ---------------------------------------------------------------- lighting, painted on

// Nothing here is lit at run time. Each vertex is given its colour once, from these lamps.
const LAMPS = []; // { x, y, z, r, g, b, reach }
const lamp = (x, y, z, hex, reach, power = 1) => {
  const c = col(hex);
  LAMPS.push({ x, y, z, r: c.r * power, g: c.g * power, b: c.b * power, reach });
};

function shade(p, n, out) {
  // what reaches everywhere: cold, blue, a touch more of it higher up where the sky is
  // and under things, a little warmth thrown back up by the floor
  const sky = 0.5 + 0.5 * n.y, floor = 1 - sky;
  let r = 0.1 + 0.05 * sky + 0.1 * floor, g = 0.12 + 0.07 * sky + 0.06 * floor, b = 0.19 + 0.1 * sky + 0.02 * floor;
  for (const L of LAMPS) {
    const dx = L.x - p.x, dy = L.y - p.y, dz = L.z - p.z;
    const d = Math.hypot(dx, dy, dz);
    if (d >= L.reach) continue;
    const fall = (1 - d / L.reach) ** 2;
    const facing = d > 1e-4 ? Math.max(0, (n.x * dx + n.y * dy + n.z * dz) / d) : 1;
    const k = fall * (0.3 + 0.7 * facing);
    r += L.r * k; g += L.g * k; b += L.b * k;
  }
  return out.setRGB(Math.min(r, 1.6), Math.min(g, 1.6), Math.min(b, 1.6));
}

// ---------------------------------------------------------------- triangle soup

const _e1 = v3(0, 0, 0), _e2 = v3(0, 0, 0), _n = v3(0, 0, 0), _c = v3(0, 0, 0), _w = v3(0, 0, 0), _s = col(0);

/** Loose triangles, one texture. Faces are turned to look the way `want` says before lighting. */
class Soup {
  constructor() {
    this.pos = []; this.uv = []; this.tint = []; this.nor = []; this.lit = [];
    this.want = null; // (centre of the face, out) → the direction it should face
    this.bright = false; // glowing things take no lighting
  }

  facing(want, bright = false) {
    this.want = want;
    this.bright = bright;
    return this;
  }

  /** `tint`: one colour, or one for each corner. */
  tri(a, b, c, ua, ub, uc, tint = WHITE) {
    let [ta, tb, tc] = Array.isArray(tint) ? tint : [tint, tint, tint];
    _n.crossVectors(_e1.subVectors(b, a), _e2.subVectors(c, a)).normalize();
    if (this.want) {
      _c.copy(a).add(b).add(c).divideScalar(3);
      if (_n.dot(this.want(_c, _w)) < 0) {
        [b, c, ub, uc, tb, tc] = [c, b, uc, ub, tc, tb];
        _n.negate();
      }
    }
    for (const [p, u, t] of [[a, ua, ta], [b, ub, tb], [c, uc, tc]]) {
      this.pos.push(p.x, p.y, p.z);
      this.uv.push(u[0], u[1]);
      this.nor.push(_n.x, _n.y, _n.z);
      this.tint.push(t.r, t.g, t.b);
      this.lit.push(this.bright ? 0 : 1);
    }
  }

  /** a, b, c, d going round; uv rectangle [u0, v0, u1, v1] with a at (u0, v0), c at (u1, v1). */
  quad(a, b, c, d, [u0, v0, u1, v1] = [0, 0, 1, 1], tint) {
    this.tri(a, b, c, [u0, v0], [u1, v0], [u1, v1], tint);
    this.tri(a, c, d, [u0, v0], [u1, v1], [u0, v1], tint);
  }

  /** A fan round a centre point; uv taken straight from x/z, as if looking down on it. */
  fan(centre, rim, uvOf, tint) {
    for (let i = 0; i < rim.length; i++) this.tri(centre, rim[i], rim[(i + 1) % rim.length], uvOf(centre), uvOf(rim[i]), uvOf(rim[(i + 1) % rim.length]), tint);
  }

  /** `size`: 1 for things given in real metres rather than laid-out ones. */
  mesh(map, opts = {}, size = SCALE) {
    return new THREE.Mesh(this.geometry(size), new THREE.MeshBasicMaterial({ map, vertexColors: true, ...opts }));
  }

  geometry(size = SCALE) {
    const n = this.pos.length / 3, colors = new Float32Array(n * 3);
    const p = v3(0, 0, 0), nn = v3(0, 0, 0);
    for (let i = 0; i < n; i++) {
      let r = 1, g = 1, b = 1;
      if (this.lit[i]) {
        p.fromArray(this.pos, i * 3);
        nn.fromArray(this.nor, i * 3);
        shade(p, nn, _s);
        r = _s.r; g = _s.g; b = _s.b;
      }
      colors[i * 3] = this.tint[i * 3] * r;
      colors[i * 3 + 1] = this.tint[i * 3 + 1] * g;
      colors[i * 3 + 2] = this.tint[i * 3 + 2] * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos.map((v) => v * size), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }
}

const upward = (c, out) => out.copy(UP);
const downward = (c, out) => out.set(0, -1, 0);
const inward = (c, out) => out.set(-c.x, 0, -c.z);
const outwardFrom = (x, y, z) => (c, out) => out.set(c.x - x, c.y - y, c.z - z);
const topDown = (size, ox = 0, oz = 0) => (p) => [(p.x - ox) / size + 0.5, (p.z - oz) / size + 0.5];

// ---------------------------------------------------------------- the room

/** `glassY`: how far the middle of the TV's screen is above the bedroom floor. The hole sits the same height above this one, so you stand as tall beside it on either side. */
export function buildZelpa({ glassY = 0.9 } = {}) {
  const scene = new THREE.Scene();
  scene.background = col(FOG);
  scene.fog = new THREE.Fog(FOG, 9 * SCALE, 40 * SCALE);
  const colliders = [], interact = [], rnd = mulberry32(1998);
  const bark = new Soup(), rings = new Soup(), caps = new Soup(), flat = new Soup(), sign = new Soup(), leaves = new Soup(), stone = new Soup(), slabTop = new Soup();
  const REACH = 16; // metres: half the side of a square that holds the whole place, gallery and vault included
  const api = { scene, colliders, interact, ladders: [], bounds: { x0: -REACH, x1: REACH, z0: -REACH, z1: REACH, top: (WALL_H + 4) * SCALE }, spawn: { x: 0, z: 0, yaw: 0, pitch: 2 }, hole: null, onLeave: null, onSay: null, hasLadle: false, hearts: 3, action: '' };
  const heart = (x, y, z) => v3(HEART.x + x, y, HEART.z + z);

  // the lamps the vertices are painted from
  lamp(HEART.x, 12, HEART.z, 0xbcd6ff, 19, 1.0); // starlight down onto the heartwood

  // ---- the floor: the cut face of the trunk, its rings spreading from the heartwood
  const floorUv = topDown(24.5, HEART.x, HEART.z);
  rings.facing(upward);
  const RING = [0, 3.2, 6.6, 10.1];
  for (let r = 0; r < RING.length - 1; r++) {
    for (let i = 0; i < SIDES; i++) {
      const a0 = ((i + 0.5) / SIDES) * TAU, a1 = ((i + 1.5) / SIDES) * TAU;
      const at = (rad, a) => v3(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      const p = [at(RING[r], a0), at(RING[r + 1], a0), at(RING[r + 1], a1), at(RING[r], a1)];
      rings.tri(p[0], p[1], p[2], floorUv(p[0]), floorUv(p[1]), floorUv(p[2]));
      if (r) rings.tri(p[0], p[2], p[3], floorUv(p[0]), floorUv(p[2]), floorUv(p[3]));
    }
  }

  // ---- the trunk wall: upright as far as the loft, leaning in above it, broken off at the top
  const corner = [];
  for (let i = 0; i < SIDES; i++) corner.push(WALL_R * (0.97 + rnd() * 0.07));
  const ROWS = [0, 1.2, 2.6, LOFT.y, 7, LOFT.y + LOFT.h, 12, 15, WALL_H];
  const wallAt = (i, y) => {
    const k = ((i % SIDES) + SIDES) % SIDES, a = ((k + 0.5) / SIDES) * TAU;
    const rad = corner[k] * (1 - 0.3 * (Math.max(0, y - 10) / (WALL_H - 10)) ** 1.5);
    return v3(Math.cos(a) * rad, y, Math.sin(a) * rad);
  };
  bark.facing(inward);
  for (let i = 0; i < SIDES; i++) {
    const tone = col(0xffffff).multiplyScalar(0.86 + rnd() * 0.2);
    for (let r = 0; r < ROWS.length - 1; r++) {
      if (inLoft(i) && ROWS[r] >= LOFT.y && ROWS[r + 1] <= LOFT.y + LOFT.h) continue; // the gallery looks out here
      bark.quad(wallAt(i, ROWS[r]), wallAt(i + 1, ROWS[r]), wallAt(i + 1, ROWS[r + 1]), wallAt(i, ROWS[r + 1]), [i * 1.5, ROWS[r] / 2.6, (i + 1) * 1.5, ROWS[r + 1] / 2.6], tone);
    }
    // a splinter standing up from the broken rim
    const a = wallAt(i, WALL_H), b = wallAt(i + 1, WALL_H), lean = 0.25 + rnd() * 0.5;
    const tip = a.clone().lerp(b, lean).setY(WALL_H + 0.7 + rnd() * 1.6);
    bark.tri(a, b, tip, [i * 1.5, WALL_H / 2.6], [(i + 1) * 1.5, WALL_H / 2.6], [(i + lean) * 1.5, tip.y / 2.6], tone);
    const p = wallAt(i, 0), q = wallAt(i + 1, 0), wall = { type: 'seg', ax: p.x, az: p.z, bx: q.x, bz: q.z, r: 0.08 };
    if (inLoft(i)) wall.top = LOFT.y; // above that, this stretch of wall is the open side of the gallery
    colliders.push(wall);
  }

  // ---- roots running out from the wall across the floor
  for (const [k, bend] of [[1, 0.5], [3, -0.4], [5, 0.3], [9, -0.5], [11, 0.4]]) {
    const a = ((k + 0.5) / SIDES) * TAU, side = v3(-Math.sin(a), 0, Math.cos(a)), R = corner[k];
    const out = (rad, y, s) => v3(Math.cos(a) * rad, y, Math.sin(a) * rad).addScaledVector(side, s);
    const top0 = out(R - 0.15, 1.7, 0), top1 = out(R - 1.9, 0.55, bend * 0.5), tip = out(R - 3.3, 0, bend);
    const dark = col(0xb89a7c);
    bark.facing(upward);
    for (const s of [-1, 1]) {
      const f0 = out(R - 0.1, 0, s * 0.6), f1 = out(R - 1.9, 0, bend * 0.5 + s * 0.35);
      bark.quad(f0, f1, top1, top0, [0, 0, 1, 0.6], dark);
      bark.tri(f1, tip, top1, [0, 0], [0.5, 0], [0.3, 0.3], dark);
    }
    const from = out(R - 0.2, 0, 0), to = out(R - 3.0, 0, bend);
    colliders.push({ type: 'seg', ax: from.x, az: from.z, bx: to.x, bz: to.z, r: 0.3, top: 0.75 });
  }

  // ---- the heartwood
  const PSIDES = 8, PROWS = [0, 1.2, 2.4, PILLAR_H];
  const pillarAt = (i, y) => {
    const a = (i / PSIDES) * TAU, rad = PILLAR_R * (1 + 0.28 * Math.max(0, 1 - y / 1.2) ** 2);
    return heart(Math.cos(a) * rad, y, Math.sin(a) * rad);
  };
  const fromHeart = (c, o) => o.set(c.x - HEART.x, 0, c.z - HEART.z); // level: the flare at the foot would otherwise tip the test
  bark.facing(fromHeart);
  for (let i = 0; i < PSIDES; i++) {
    for (let r = 0; r < PROWS.length - 1; r++) {
      const y0 = PROWS[r], y1 = PROWS[r + 1];
      bark.quad(pillarAt(i, y0), pillarAt(i + 1, y0), pillarAt(i + 1, y1), pillarAt(i, y1), [i * 0.6, y0 / 2.4, (i + 1) * 0.6, y1 / 2.4], col(0xe6d2b4));
    }
  }
  rings.facing(upward);
  const rim = [];
  for (let i = 0; i < PSIDES; i++) rim.push(pillarAt(i, PILLAR_H));
  rings.fan(heart(0, PILLAR_H, 0), rim, topDown(3.2, HEART.x, HEART.z), col(0xfff2d8));
  colliders.push({ type: 'box', x0: HEART.x - 1.1, x1: HEART.x + 1.1, z0: HEART.z - 1.1, z1: HEART.z + 1.1, top: PILLAR_H, stand: true, surface: 'heartwood' });

  // ---- shelf mushrooms: the way up
  const shelf = (cx, cz, top, rad, turn = 0) => {
    const edge = [];
    for (let i = 0; i < 6; i++) {
      const a = turn + (i / 6) * TAU;
      edge.push(v3(cx + Math.cos(a) * rad, top - 0.07, cz + Math.sin(a) * rad));
    }
    caps.facing(upward);
    caps.fan(v3(cx, top, cz), edge, topDown(rad * 2, cx, cz));
    flat.facing(downward);
    flat.fan(v3(cx, top - 0.34, cz), edge, () => [0, 0], col(0xd9c49a)); // the pale gills underneath
  };
  for (const [angle, top] of STEPS) {
    const a = THREE.MathUtils.degToRad(angle), cx = HEART.x + Math.cos(a) * STEP_OUT, cz = HEART.z + Math.sin(a) * STEP_OUT;
    shelf(cx, cz, top, STEP_R, a);
    colliders.push({ type: 'box', x0: cx - STEP_HALF, x1: cx + STEP_HALF, z0: cz - STEP_HALF, z1: cz + STEP_HALF, top, base: top - 0.3, stand: true, surface: 'fungus' });
  }
  // and more of them up the walls, out of reach, for the look of the place
  for (const [k, y, rad] of [[1, 4.6, 0.8], [4, 6, 0.7], [6, 5, 0.9], [2, 8.6, 0.7], [5, 11.2, 0.7], [0, 9.2, 0.8], [9, 11.6, 0.75], [11, 12.6, 0.8], [8, 13.4, 0.7]]) {
    const p = wallAt(k, y).lerp(wallAt(k + 1, y), 0.3 + rnd() * 0.4);
    shelf(p.x * 0.97, p.z * 0.97, y, rad, rnd() * TAU);
  }

  // ---- glowing mushrooms in little crowds, each lighting the wood round it
  const crowd = (gx, gz, hex, floor = 0) => {
    lamp(gx, floor + 0.5, gz, hex, 4.2, 0.95);
    const glow = col(hex), stem = col(0xcfd8c8);
    for (let m = 0, count = 3 + Math.floor(rnd() * 3); m < count; m++) {
      const x = gx + (rnd() - 0.5) * 0.9, z = gz + (rnd() - 0.5) * 0.9, hgt = 0.14 + rnd() * 0.34, r = 0.09 + rnd() * 0.14, s = 0.025;
      flat.facing(outwardFrom(x, floor + hgt / 2, z), true);
      const ring = [v3(x - s, floor, z - s), v3(x + s, floor, z - s), v3(x + s, floor, z + s), v3(x - s, floor, z + s)];
      for (let i = 0; i < 4; i++) {
        const a = ring[i], b = ring[(i + 1) % 4];
        flat.quad(a, b, b.clone().setY(floor + hgt), a.clone().setY(floor + hgt), undefined, stem);
      }
      const brim = [], tip = v3(x, floor + hgt + r * 0.9, z);
      for (let i = 0; i < 5; i++) brim.push(v3(x + Math.cos((i / 5) * TAU) * r, floor + hgt - 0.02, z + Math.sin((i / 5) * TAU) * r));
      flat.facing(outwardFrom(x, floor + hgt - 0.3, z), true);
      for (let i = 0; i < 5; i++) flat.tri(brim[i], brim[(i + 1) % 5], tip, [0, 0], [0, 0], [0, 0], i % 2 ? glow : glow.clone().multiplyScalar(0.72));
    }
  };
  for (const [x, z, hex] of [[-6, 4.2, 0x5ff5dc], [6.4, 2.7, 0xff6ac8], [6.8, -4.4, 0x5ff5dc], [-7.7, -1, 0xff6ac8], [4.2, -6.6, 0x8dff7a], [4.3, 6.6, 0xff6ac8], [-7.2, -3.9, 0x8dff7a]]) crowd(x, z, hex);

  /** A plain block: centre, and its three half-edges as vectors. */
  const block = (c, ex, ey, ez, tint) => {
    flat.facing(outwardFrom(c.x, c.y, c.z));
    const at = (sx, sy, sz) => c.clone().addScaledVector(ex, sx).addScaledVector(ey, sy).addScaledVector(ez, sz);
    for (const [u, v, w] of [[ex, ey, ez], [ey, ez, ex], [ez, ex, ey]]) {
      for (const side of [-1, 1]) {
        const o = c.clone().addScaledVector(w, side);
        flat.quad(o.clone().sub(u).sub(v), o.clone().add(u).sub(v), o.clone().add(u).add(v), o.clone().sub(u).add(v), undefined, tint);
      }
    }
    return at;
  };

  // ---- the gallery: a floor up, hollowed into the wall and open to the Hollow all along
  const upFloor = LOFT.y, upRoof = LOFT.y + LOFT.h;
  /** A corner of it: out along wall corner `k`, on the wall line (`deep` 0) or back in the wood. */
  const upAt = (k, deep, y) => {
    const p = wallAt(k, 0), r = Math.hypot(p.x, p.z);
    return v3((p.x / r) * (r + deep), y, (p.z / r) * (r + deep));
  };
  /** A floor that isn't square to anything, laid as narrow strips you can stand on. */
  const strips = (poly, alongX, top) => {
    const [u, w] = alongX ? ['x', 'z'] : ['z', 'x'], us = poly.map((q) => q[u]), lo = Math.min(...us), hi = Math.max(...us), STEP = 0.25;
    for (let a = lo; a < hi; a += STEP) {
      // each strip is as long as the floor is anywhere across its width: a hair generous at
      // the edges, but never a gap to fall through where two stretches of floor meet
      const b = Math.min(a + STEP, hi), cuts = [];
      for (const m of [a, (a + b) / 2, b]) {
        for (let i = 0; i < poly.length; i++) {
          const q = poly[i], n = poly[(i + 1) % poly.length];
          if ((q[u] - m) * (n[u] - m) <= 0 && q[u] !== n[u]) cuts.push(q[w] + ((n[w] - q[w]) * (m - q[u])) / (n[u] - q[u]));
        }
      }
      if (cuts.length < 2) continue;
      const c0 = Math.min(...cuts), c1 = Math.max(...cuts);
      colliders.push({ type: 'box', ...(alongX ? { x0: a, x1: b, z0: c0, z1: c1 } : { x0: c0, x1: c1, z0: a, z1: b }), top, base: top - 0.5, stand: true, surface: 'leaves' });
    }
  };
  const upstairs = []; // its outline, panel by panel, for the map
  // Where the gallery reaches the east, its back wall has a way through, 1.2 m wide, into the
  // wood: [how far along that stretch of wall it starts, and stops]
  const DOOR = 0.6, backA = upAt(LOFT.last, LOFT.deep, 0).multiplyScalar(SCALE), backB = upAt(LOFT.last + 1, LOFT.deep, 0).multiplyScalar(SCALE);
  const alongBack = (z) => (z - backA.z) / (backB.z - backA.z), JAMB = [alongBack(-DOOR), alongBack(DOOR)];
  for (let i = LOFT.first; i <= LOFT.last; i++) {
    const p0 = upAt(i, 0, upFloor), p1 = upAt(i + 1, 0, upFloor), q0 = upAt(i, LOFT.deep, upFloor), q1 = upAt(i + 1, LOFT.deep, upFloor);
    const at = (a, d) => p0.clone().lerp(p1, a).lerp(q0.clone().lerp(q1, a), d), centre = at(0.5, 0.5);
    lamp(centre.x, upFloor + 2.6, centre.z, 0xcfe6d8, 6.5, 0.5); // a little light of its own, so it isn't just a dark band on the wall
    const uv = (q) => [q.x / 2.2, q.z / 2.2]; // a carpet of fallen leaves, the same all the way round
    leaves.facing(upward);
    for (let a = 0; a < 2; a++) for (let d = 0; d < 2; d++) {
      const c = [at(a / 2, d / 2), at((a + 1) / 2, d / 2), at((a + 1) / 2, (d + 1) / 2), at(a / 2, (d + 1) / 2)];
      leaves.tri(c[0], c[1], c[2], uv(c[0]), uv(c[1]), uv(c[2]));
      leaves.tri(c[0], c[2], c[3], uv(c[0]), uv(c[2]), uv(c[3]));
    }
    bark.facing(inward);
    for (const [t0, t1] of i === LOFT.last ? [[0, JAMB[0]], [JAMB[1], 1]] : [[0, 1]]) {
      const w0 = q0.clone().lerp(q1, t0), w1 = q0.clone().lerp(q1, t1);
      bark.quad(w0, w1, w1.clone().setY(upRoof), w0.clone().setY(upRoof), [(i + t0) * 1.7, 0, (i + t1) * 1.7, 1.7], col(0xd8c4a8));
      colliders.push({ type: 'seg', ax: w0.x, az: w0.z, bx: w1.x, bz: w1.z, r: 0.08, base: upFloor - 0.2 });
    }
    bark.facing(downward);
    bark.quad(p0.clone().setY(upRoof), p1.clone().setY(upRoof), q1.clone().setY(upRoof), q0.clone().setY(upRoof), [0, 0, 1.7, 1.7], col(0x9c8a74));
    // the floor runs on under its own walls, which are what actually stop you
    const run = p1.clone().sub(p0), a0 = i === LOFT.first ? -0.15 : 0, a1 = i === LOFT.last ? 1.15 : 1;
    const deepEnd = (LOFT.deep + 0.5) / LOFT.deep;
    strips([at(a0, 0), at(a1, 0), at(a1, deepEnd), at(a0, deepEnd)], Math.abs(run.x) >= Math.abs(run.z), upFloor);
    upstairs.push([p0, p1, q1, q0].map((c) => [c.x * SCALE, c.z * SCALE]));
  }
  for (const k of [LOFT.first, LOFT.last + 1]) {
    // and its two ends
    const a = upAt(k, 0, upFloor), b = upAt(k, LOFT.deep, upFloor), into = upAt(k === LOFT.first ? k + 1 : k - 1, LOFT.deep / 2, 0);
    bark.facing((c, o) => o.set(into.x - c.x, 0, into.z - c.z));
    bark.quad(a, b, b.clone().setY(upRoof), a.clone().setY(upRoof), [0, 0, 1.7, 1.7], col(0xd8c4a8));
    colliders.push({ type: 'seg', ax: a.x, az: a.z, bx: b.x, bz: b.z, r: 0.08, base: upFloor - 0.2 });
  }

  // ---- through that way in the back wall: a short passage straight out into the wood, away
  // from the Hollow, and a vault with a pit across the middle of it. Laid out in real metres
  // (M turns them into the units everything above is built in). It runs east: x along it, z across.
  const M = (x, y, z) => v3(x / SCALE, y / SCALE, z / SCALE);
  const backX = (z) => backA.x + (backB.x - backA.x) * alongBack(z);
  const GAP = 0.35; // the two jumps: short enough to make without a run-up or good timing
  const V = { w0: backX(-DOOR), w1: backX(DOOR), half: 1.6, slabHalf: 0.6, floor: upFloor * SCALE, low: upRoof * SCALE, high: 5.4, pit: -0.4 };
  V.a0 = Math.max(V.w0, V.w1) + 1.7; // the passage ends and the vault begins
  V.ledge = V.a0 + 0.8; // the near floor ends
  V.slab0 = V.ledge + GAP; // the hanging slab, from here…
  V.slab1 = V.slab0 + 1.3; // …to here
  V.far = V.slab1 + GAP; // the far floor begins
  V.a1 = V.far + 3.4; // the back wall
  /** A flat sheet from a corner along two edges, cut into a grid so the painted light has somewhere to vary. All in metres. */
  const sheet = (soup, o, u, v, nu, nv, uvOf, tint) => {
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const at = (a, b) => M(o[0] + (u[0] * a) / nu + (v[0] * b) / nv, o[1] + (u[1] * a) / nu + (v[1] * b) / nv, o[2] + (u[2] * a) / nu + (v[2] * b) / nv);
      const c = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      soup.tri(c[0], c[1], c[2], uvOf(c[0]), uvOf(c[1]), uvOf(c[2]), tint);
      soup.tri(c[0], c[2], c[3], uvOf(c[0]), uvOf(c[2]), uvOf(c[3]), tint);
    }
  };
  const towards = (x, y, z) => { const t = M(x, y, z); return (c, o) => o.set(t.x - c.x, t.y - c.y, t.z - c.z); };
  const litter = (q) => [q.x / 2.2, q.z / 2.2], grainZ = (q) => [q.z / 3, q.y / 2.6], grainX = (q) => [q.x / 3, q.y / 2.6], cobble = (q) => [q.x / 1.4, q.z / 1.4];
  const solid = (x0, x1, z0, z1, extra) => colliders.push({ type: 'box', x0: x0 / SCALE, x1: x1 / SCALE, z0: z0 / SCALE, z1: z1 / SCALE, ...extra });
  const fence = (ax, az, bx, bz) => colliders.push({ type: 'seg', ax: ax / SCALE, az: az / SCALE, bx: bx / SCALE, bz: bz / SCALE, r: 0.08, base: upFloor - 0.2 });
  const wallTint = col(0xd8c4a8), dim = col(0x9c8a74), up = V.floor / SCALE;
  // the passage
  leaves.facing(upward);
  leaves.quad(M(V.w0, V.floor, -DOOR), M(V.a0, V.floor, -DOOR), M(V.a0, V.floor, DOOR), M(V.w1, V.floor, DOOR), [0, 0, 1, 0.6]);
  bark.facing(towards((V.w0 + V.a0) / 2, V.floor + 1, 0));
  bark.quad(M(V.w0, V.floor, -DOOR), M(V.a0, V.floor, -DOOR), M(V.a0, V.low, -DOOR), M(V.w0, V.low, -DOOR), [0, 0, 1, 1.7], wallTint);
  bark.quad(M(V.w1, V.floor, DOOR), M(V.a0, V.floor, DOOR), M(V.a0, V.low, DOOR), M(V.w1, V.low, DOOR), [0, 0, 1, 1.7], wallTint);
  bark.facing(downward);
  bark.quad(M(V.w0, V.low, -DOOR), M(V.a0, V.low, -DOOR), M(V.a0, V.low, DOOR), M(V.w1, V.low, DOOR), [0, 0, 1, 1], dim);
  solid(Math.min(V.w0, V.w1) - 0.3, V.a0, -DOOR, DOOR, { top: up, base: up - 0.6, stand: true, surface: 'leaves' });
  fence(V.w0, -DOOR, V.a0, -DOOR);
  fence(V.w1, DOOR, V.a0, DOOR);
  lamp((V.w0 + V.a0) / 2 / SCALE, (V.floor + 1.5) / SCALE, 0, 0xcfe6d8, 5, 0.4);
  // the vault: four walls from the bottom of the pit to the roof
  const tall = V.high - V.pit, long = V.a1 - V.a0, wide = V.half * 2, midA = (V.a0 + V.a1) / 2;
  bark.facing(towards(midA, V.floor + 1, 0));
  sheet(bark, [V.a0, V.pit, -V.half], [long, 0, 0], [0, tall, 0], 5, 4, grainX, wallTint);
  sheet(bark, [V.a0, V.pit, V.half], [long, 0, 0], [0, tall, 0], 5, 4, grainX, wallTint);
  sheet(bark, [V.a1, V.pit, -V.half], [0, 0, wide], [0, tall, 0], 3, 4, grainZ, wallTint);
  sheet(bark, [V.a0, V.floor, -V.half], [0, 0, V.half - DOOR], [0, V.high - V.floor, 0], 1, 2, grainZ, wallTint); // either side of the way in
  sheet(bark, [V.a0, V.floor, DOOR], [0, 0, V.half - DOOR], [0, V.high - V.floor, 0], 1, 2, grainZ, wallTint);
  sheet(bark, [V.a0, V.low, -DOOR], [0, 0, DOOR * 2], [0, V.high - V.low, 0], 1, 1, grainZ, wallTint); // and over it
  bark.facing(downward);
  sheet(bark, [V.a0, V.high, -V.half], [long, 0, 0], [0, 0, wide], 4, 3, cobble, dim);
  fence(V.a0, -V.half, V.a0, -DOOR);
  fence(V.a0, DOOR, V.a0, V.half);
  fence(V.a0, -V.half, V.a1, -V.half);
  fence(V.a0, V.half, V.a1, V.half);
  fence(V.a1, -V.half, V.a1, V.half);
  // its floor, broken in two: the near ledge, the far side, and the drop between them
  leaves.facing(upward);
  sheet(leaves, [V.a0, V.floor, -V.half], [V.ledge - V.a0, 0, 0], [0, 0, wide], 1, 3, litter);
  sheet(leaves, [V.far, V.floor, -V.half], [V.a1 - V.far, 0, 0], [0, 0, wide], 3, 3, litter);
  bark.facing((c, o) => o.set(1, 0, 0));
  sheet(bark, [V.ledge, V.pit, -V.half], [0, 0, wide], [0, V.floor - V.pit, 0], 3, 3, grainZ, col(0x8a7460));
  bark.facing((c, o) => o.set(-1, 0, 0));
  sheet(bark, [V.far, V.pit, -V.half], [0, 0, wide], [0, V.floor - V.pit, 0], 3, 3, grainZ, col(0x8a7460));
  flat.facing(upward);
  flat.quad(M(V.ledge, V.pit, -V.half), M(V.far, V.pit, -V.half), M(V.far, V.pit, V.half), M(V.ledge, V.pit, V.half), undefined, col(0x120c08));
  solid(V.a0, V.ledge, -V.half, V.half, { top: up, base: V.pit / SCALE, stand: true, surface: 'leaves' });
  solid(V.far, V.a1, -V.half, V.half, { top: up, base: V.pit / SCALE, stand: true, surface: 'leaves' });
  // the stone slab hanging over the drop, leaves on it, held by four roots from the roof
  const under = V.floor - 0.32, slabMid = (V.slab0 + V.slab1) / 2;
  slabTop.facing(upward);
  slabTop.quad(M(V.slab0, V.floor, -V.slabHalf), M(V.slab1, V.floor, -V.slabHalf), M(V.slab1, V.floor, V.slabHalf), M(V.slab0, V.floor, V.slabHalf), [0, 0, 1, 1]);
  stone.facing(towards(slabMid, V.floor - 0.16, 0));
  stone.want = ((inner) => (c, o) => inner(c, o).negate())(stone.want); // its sides face out, not in
  const slabRim = [[V.slab0, -V.slabHalf], [V.slab1, -V.slabHalf], [V.slab1, V.slabHalf], [V.slab0, V.slabHalf]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = slabRim[i], [bx, bz] = slabRim[(i + 1) % 4];
    stone.quad(M(ax, under, az), M(bx, under, bz), M(bx, V.floor, bz), M(ax, V.floor, az), [0, 0, 0.8, 0.25]);
  }
  stone.facing(downward);
  stone.quad(M(V.slab0, under, -V.slabHalf), M(V.slab1, under, -V.slabHalf), M(V.slab1, under, V.slabHalf), M(V.slab0, under, V.slabHalf), [0, 0, 0.8, 0.8], col(0x8a8a86));
  for (const [qx, qz] of slabRim) {
    const ix = qx + Math.sign(slabMid - qx) * 0.09, iz = qz - Math.sign(qz) * 0.09;
    block(M(ix, (V.floor + V.high) / 2, iz), v3(0.05, 0, 0), v3(0, (V.high - V.floor) / 2 / SCALE, 0), v3(0, 0, 0.05), col(0x4a3420));
  }
  solid(V.slab0, V.slab1, -V.slabHalf, V.slabHalf, { top: up, base: up - 0.7, stand: true, surface: 'stone' });
  lamp(slabMid / SCALE, (V.floor + 2) / SCALE, 0, 0xcfe6d8, 7, 0.5); // so the slab and the edges can be judged
  crowd((V.a0 + 0.4) / SCALE, (-V.half + 0.45) / SCALE, 0x5ff5dc, up);
  crowd((V.a1 - 0.5) / SCALE, (V.half - 0.5) / SCALE, 0xff6ac8, up);
  crowd((V.a1 - 0.7) / SCALE, (-V.half + 0.5) / SCALE, 0x8dff7a, up);

  // the first stretch is where the ladder comes up: along it, and back into the wood
  const L0 = wallAt(LOFT.first, 0), L1 = wallAt(LOFT.first + 1, 0);
  const along = L1.clone().sub(L0).normalize(), back = v3(along.z, 0, -along.x);
  if (back.dot(L0) < 0) back.negate();
  const loftPt = (t, deep, y) => L0.clone().lerp(L1, t).addScaledVector(back, deep).setY(y);
  const loftFloor = upFloor;
  // the ladder: two poles against the wall and pegs across them
  const pale = col(0xc79a66), HALF = 0.85, foot = loftPt(LOFT.ladder, 0, 0);
  for (const s of [-1, 1]) block(loftPt(LOFT.ladder, -0.14, loftFloor / 2).addScaledVector(along, s * HALF), along.clone().multiplyScalar(0.08), v3(0, loftFloor / 2, 0), back.clone().multiplyScalar(0.08), col(0x9a7448));
  for (let y = 0.5; y < loftFloor - 0.2; y += 0.6) block(loftPt(LOFT.ladder, -0.16, y), along.clone().multiplyScalar(HALF + 0.12), v3(0, 0.07, 0), back.clone().multiplyScalar(0.1), pale);
  // where you can climb, in real metres: the foot of it, the way into the wall, half its width, how far out it reaches, how high it goes
  api.ladders.push({ x: foot.x * SCALE, z: foot.z * SCALE, nx: back.x, nz: back.z, half: HALF * SCALE, depth: 1.25 * SCALE, top: loftFloor * SCALE });

  // ---- a signpost, facing whoever has just arrived
  const SIGN = { x: -2, z: 5.4 };
  flat.facing(outwardFrom(SIGN.x, 0.5, SIGN.z));
  const post = (x0, x1, z0, z1, y0, y1, tint) => {
    const c = [v3(x0, y0, z0), v3(x1, y0, z0), v3(x1, y0, z1), v3(x0, y0, z1)];
    for (let i = 0; i < 4; i++) flat.quad(c[i], c[(i + 1) % 4], c[(i + 1) % 4].clone().setY(y1), c[i].clone().setY(y1), undefined, tint);
  };
  post(SIGN.x - 0.05, SIGN.x + 0.05, SIGN.z - 0.05, SIGN.z + 0.05, 0, 1.45, col(0x7a5a38));
  sign.facing((c, o) => o.set(0, 0, 1));
  sign.quad(v3(SIGN.x - 0.6, 0.85, SIGN.z + 0.06), v3(SIGN.x + 0.6, 0.85, SIGN.z + 0.06), v3(SIGN.x + 0.6, 1.45, SIGN.z + 0.06), v3(SIGN.x - 0.6, 1.45, SIGN.z + 0.06), [0, 0, 1, 1]);
  flat.facing((c, o) => o.set(0, 0, -1));
  flat.quad(v3(SIGN.x - 0.6, 0.85, SIGN.z + 0.05), v3(SIGN.x + 0.6, 0.85, SIGN.z + 0.05), v3(SIGN.x + 0.6, 1.45, SIGN.z + 0.05), v3(SIGN.x - 0.6, 1.45, SIGN.z + 0.05), undefined, col(0x7a5a38));
  colliders.push({ type: 'box', x0: SIGN.x - 0.12, x1: SIGN.x + 0.12, z0: SIGN.z - 0.1, z1: SIGN.z + 0.1, top: 1.45 });

  // ---- the way back out. Where the south wall is, and so where the hole in it sits:
  // (the hole is the size of the TV's glass whatever the Hollow's own scale: real metres from here on)
  const holeZ = Math.min(wallAt(2, 0).z, wallAt(3, 0).z) * SCALE - 0.03;
  api.hole = { x: 0, y: glassY, z: holeZ };
  api.spawn.z = holeZ - 1.1;
  lamp(0, glassY / SCALE, (holeZ - 0.7) / SCALE, 0xfff0d4, 6, 0.42); // what comes through it
  lamp(0, 1, (holeZ - 1.5) / SCALE, 0xfff0d4, 4, 0.3);

  // ---- a stump on top of the heartwood, for the ladle to hang above
  const STUMP = 0.5;
  bark.facing(fromHeart);
  const stump = [];
  for (let i = 0; i < 6; i++) stump.push(heart(Math.cos((i / 6) * TAU) * 0.22, PILLAR_H, Math.sin((i / 6) * TAU) * 0.22));
  for (let i = 0; i < 6; i++) {
    const a = stump[i], b = stump[(i + 1) % 6];
    bark.quad(a, b, b.clone().setY(PILLAR_H + STUMP), a.clone().setY(PILLAR_H + STUMP), [i * 0.2, 0, (i + 1) * 0.2, 0.25], col(0xf0d8b0));
  }
  rings.facing(upward);
  rings.fan(heart(0, PILLAR_H + STUMP, 0), stump.map((p) => p.clone().setY(PILLAR_H + STUMP)), topDown(0.5, HEART.x, HEART.z), col(0xfff2d8));
  colliders.push({ type: 'box', x0: HEART.x - 0.22, x1: HEART.x + 0.22, z0: HEART.z - 0.22, z1: HEART.z + 0.22, base: PILLAR_H, top: PILLAR_H + STUMP + 0.1 });

  // ---- put the painted geometry in the scene
  const white = whiteTex();
  scene.add(bark.mesh(barkTex()), rings.mesh(ringsTex()), caps.mesh(capTex()), flat.mesh(white), leaves.mesh(leafTex()), stone.mesh(stoneTex()), slabTop.mesh(stoneTex(true)));
  const signMesh = sign.mesh(signTex());
  signMesh.userData.interact = { label: () => 'Read the sign', act: 'Read', say: '"The ladle rests where the starlight lands."' };
  scene.add(signMesh);
  interact.push(signMesh);

  // ---- the screen from behind. The bedroom is on the other side of it, seen the way a fat
  // piece of glass shows things: everything at once, bent round at the edges.
  const glassOutline = (grow = 0) => {
    const hw = HOLE.w / 2 + grow, hh = HOLE.h / 2 + grow, r = 0.035 + grow, q = Math.PI / 2, o = new THREE.Shape();
    o.moveTo(-hw + r, -hh);
    o.lineTo(hw - r, -hh);
    o.absarc(hw - r, -hh + r, r, -q, 0);
    o.lineTo(hw, hh - r);
    o.absarc(hw - r, hh - r, r, 0, q);
    o.lineTo(-hw + r, hh);
    o.absarc(-hw + r, hh - r, r, q, 2 * q);
    o.lineTo(-hw, -hh + r);
    o.absarc(-hw + r, -hh + r, r, 2 * q, 3 * q);
    return o;
  };
  // the room is drawn all the way round the spot where the glass is, a little at a time (api.lookOut)
  const roomCube = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: false });
  const eye = new THREE.CubeCamera(0.03, 30, roomCube);
  // The bedroom is not part of the game, so it is not drawn the game's way: the view through the
  // glass goes on the screen at full sharpness, and the 240-line picture is laid over it with a
  // hole where the glass shows (api.render). `view` is that sharp view; `glass`, further down, is
  // the same shape in the small picture, punching the hole.
  const view = new THREE.Mesh(new THREE.ShapeGeometry(glassOutline(), 6), new THREE.ShaderMaterial({
    uniforms: {
      uRoom: { value: roomCube.texture },
      uCentre: { value: v3(0, glassY, holeZ) },
      uHalf: { value: new THREE.Vector2(HOLE.w / 2, HOLE.h / 2) },
      uExposure: { value: 1.25 },
      uVeil: { value: 0.04 }, // how far from clear the glass is: 0 perfectly, 1 a blank pane
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform samplerCube uRoom;
      uniform vec3 uCentre;
      uniform vec2 uHalf;
      uniform float uExposure, uVeil;
      varying vec3 vWorld;
      void main() {
        // where on the glass, with x to the right as you look out through it
        vec2 p = vec2(-(vWorld.x - uCentre.x), vWorld.y - uCentre.y) / uHalf.x;
        float r = length(p);
        // a fat lens: straight out in the middle, bent a long way round towards the edge
        float bend = min(r * 1.05 + r * r * r * 0.17, 1.5);
        vec3 lens = r > 1e-4 ? vec3(sin(bend) * p / r, cos(bend)) : vec3(0.0, 0.0, 1.0);
        // and still a window: move your head and what is behind it moves the other way
        vec3 d = normalize(vWorld - cameraPosition);
        vec3 o = lens + 0.7 * vec3(-d.x, d.y, 0.0);
        o.z = max(o.z, 0.04);
        o = normalize(o);
        // out of the glass is east in the bedroom, to the right of that is south
        vec3 c = textureCube(uRoom, vec3(o.z, o.y, o.x)).rgb * uExposure;
        c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0); // the same film curve the bedroom is shown with
        c *= 1.0 - 0.72 * smoothstep(0.45, 1.25, r); // a tube is darker towards its corners
        // and it is glass: a cool cast, a band of sheen that slides across as you move, a bright
        // edge where the bulge catches the light up and to the left, more shine the more sidelong you look
        c *= vec3(0.93, 0.99, 1.04);
        c = mix(c, vec3(0.74, 0.80, 0.84), uVeil); // and not perfectly clear: a thin milkiness over everything behind it
        float band = p.x * 0.55 + p.y - d.x * 1.5 - 0.2;
        float sheen = exp(-band * band * 8.0) * 0.11 + exp(-(band + 0.6) * (band + 0.6) * 70.0) * 0.08;
        float rim = exp(-pow((length(p * vec2(1.0, 1.3)) - 0.9) * 6.5, 2.0)) * smoothstep(-0.1, 0.9, (p.y - p.x) * 0.8) * 0.2;
        float sidelong = pow(1.0 - abs(d.z), 3.0) * 0.22;
        c += vec3(0.86, 0.94, 1.0) * (sheen + rim + sidelong);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  view.position.set(0, glassY, holeZ);
  view.rotation.y = Math.PI; // facing into the Hollow
  const through = new THREE.Scene();
  through.add(view);
  const glass = new THREE.Mesh(view.geometry, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, blending: THREE.NoBlending, fog: false }));
  glass.position.copy(view.position);
  glass.rotation.copy(view.rotation);
  glass.renderOrder = -1; // before the glows, so they are cut where something stands in front of it but not by it
  glass.userData.interact = { label: () => 'Go back to your room', act: 'Leave', use: () => api.onLeave?.() };
  const surround = new THREE.Mesh(new THREE.ShapeGeometry(glassOutline(0.018), 6), new THREE.MeshBasicMaterial({ color: 0x060505, fog: false }));
  surround.position.set(0, glassY, holeZ + 0.004);
  surround.rotation.y = Math.PI;
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.1), new THREE.MeshBasicMaterial({ map: spillTex(), ...GLOW, opacity: 0.5 }));
  spill.position.set(0, glassY, holeZ + 0.008);
  spill.rotation.y = Math.PI;
  scene.add(spill, surround, glass);
  interact.push(glass);

  // the light it throws into the Hollow: a faint spreading beam, with brighter shafts in it,
  // strong at the glass and gone a few metres in
  const beam = new Soup().facing(null, true);
  const gone = col(0x000000), glow = (k) => col(0xfff0d4).multiplyScalar(k);
  const BEAM = { reach: 0.6, hw: 0.42, hh: 0.32, sink: 0.05 };
  const nearPt = (sx, sy) => v3(sx * HOLE.w / 2, glassY + sy * HOLE.h / 2, holeZ - 0.012);
  const farPt = (sx, sy, reach = 1) => nearPt(sx, sy).lerp(v3(sx * BEAM.hw, glassY - BEAM.sink + sy * BEAM.hh, holeZ - BEAM.reach), reach);
  const edge = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < 4; i++) {
    const a = edge[i], b = edge[(i + 1) % 4], lit = glow(0.05);
    beam.tri(nearPt(...a), nearPt(...b), farPt(...b), [0, 0], [0, 0], [0, 0], [lit, lit, gone]);
    beam.tri(nearPt(...a), farPt(...b), farPt(...a), [0, 0], [0, 0], [0, 0], [lit, gone, gone]);
  }
  for (let i = 0; i < 14; i++) {
    // one shaft: a sliver that starts on the rim of the glass and fans outwards, so the
    // shafts stand round the picture instead of across it
    const along = rnd() * 2 - 1, side = rnd() < 0.5 ? -1 : 1, [sx, sy] = i % 2 ? [along, side] : [side, along];
    const reach = 0.4 + rnd() * 0.6, wide = 0.03 + rnd() * 0.07, lit = glow(0.08 + rnd() * 0.12);
    const [wx, wy] = i % 2 ? [wide, 0] : [0, wide];
    beam.tri(nearPt(sx, sy), farPt(sx - wx, sy - wy, reach), farPt(sx + wx, sy + wy, reach), [0, 0], [0, 0], [0, 0], [lit, gone, gone]);
  }
  const beamMesh = beam.mesh(white, { ...GLOW, side: THREE.DoubleSide }, 1);
  scene.add(beamMesh);

  /** Where in the bedroom the glass is, so the view through it is taken from there. */
  api.setEye = (p) => {
    eye.position.copy(p);
    eye.updateMatrixWorld(true);
  };
  const SIDES_OF_VIEW = [2, 3, 4, 5]; // up, down, south, north; the face behind (the set itself) is never needed again
  let turn = 0;
  /** Redraw the view of the bedroom: all of it (on arriving), or straight out plus one side in turn. */
  // `rooms`: the bedroom, and the rest of the house that shows through its door and window
  api.lookOut = (renderer, rooms, everything = false) => {
    const list = [rooms].flat(), auto = renderer.autoClear;
    // turn its six cameras to their six faces (CubeCamera.update would, but it draws one scene only)
    if (eye.coordinateSystem !== renderer.coordinateSystem) {
      eye.coordinateSystem = renderer.coordinateSystem;
      eye.updateCoordinateSystem();
    }
    eye.updateMatrixWorld(true);
    for (const face of everything ? [0, 1, 2, 3, 4, 5] : [0, SIDES_OF_VIEW[turn++ % 4]]) {
      renderer.setRenderTarget(roomCube, face);
      list.forEach((room, i) => {
        renderer.autoClear = i === 0; // the first clears; the rest go in over it
        renderer.render(room, eye.children[face]);
      });
    }
    renderer.autoClear = auto;
    renderer.setRenderTarget(null);
  };

  // ---- sky through the broken top: stars, nothing else
  const stars = starsTex();
  stars.repeat.set(5, 5);
  const sky = new THREE.Mesh(new THREE.CircleGeometry(20, 12), new THREE.MeshBasicMaterial({ map: stars, fog: false, side: THREE.BackSide }));
  sky.rotation.x = -Math.PI / 2; // lying flat; seen from underneath
  sky.position.y = 22;
  scene.add(sky);

  // ---- dust drifting up through the place
  const MOTES = 110, DUST_TOP = 16, motes = new Float32Array(MOTES * 3), drift = [];
  for (let i = 0; i < MOTES; i++) {
    const a = rnd() * TAU, rad = Math.sqrt(rnd()) * 8.5;
    motes.set([Math.cos(a) * rad, rnd() * DUST_TOP, Math.sin(a) * rad], i * 3);
    drift.push({ x: motes[i * 3], z: motes[i * 3 + 2], rise: 0.12 + rnd() * 0.3, phase: rnd() * TAU });
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motes, 3));
  const dust = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: 0xcffff0, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.75 }));
  dust.scale.setScalar(SCALE);
  scene.add(dust);

  // ---- the wooden ladle — the one that stands where a sword would in this game's own logo —
  // turning slowly in the starlight. Modelled in real metres, a size up from a kitchen one.
  const lad = new Soup();
  const WOOD = { lit: col(0xd9a86e), side: col(0xa97745), under: col(0x7c5330), hollow: col(0x6a4426), hollowLit: col(0x8a5c36) };
  const stick = (y, h) => [v3(-h, y, -h), v3(h, y, -h), v3(h, y, h), v3(-h, y, h)];
  const s0 = stick(-0.21, 0.011), s1 = stick(0.075, 0.015); // the handle, a little stouter towards the bowl
  lad.facing((c, o) => o.set(c.x, 0, c.z), true);
  [WOOD.under, WOOD.side, WOOD.lit, WOOD.side].forEach((tint, i) => lad.quad(s0[i], s0[(i + 1) % 4], s1[(i + 1) % 4], s1[i], undefined, tint));
  lad.facing(downward, true);
  lad.quad(s0[0], s0[1], s0[2], s0[3], undefined, WOOD.under);
  const BOWL = { y: 0.145, rx: 0.058, ry: 0.072 }, lip = [];
  for (let i = 0; i < 8; i++) lip.push(v3(Math.cos((i / 8) * TAU) * BOWL.rx, BOWL.y + Math.sin((i / 8) * TAU) * BOWL.ry, 0.004));
  lad.facing(outwardFrom(0, BOWL.y, 0.09), true); // its rounded back
  for (let i = 0; i < 8; i++) lad.tri(v3(0, BOWL.y, -0.04), lip[i], lip[(i + 1) % 8], [0, 0], [0, 0], [0, 0], i % 2 ? WOOD.side : WOOD.under);
  lad.facing((c, o) => o.set(0, 0, 1), true); // and the hollow of it
  for (let i = 0; i < 8; i++) lad.tri(v3(0, BOWL.y, -0.022), lip[i], lip[(i + 1) % 8], [0, 0], [0, 0], [0, 0], i < 4 ? WOOD.hollowLit : WOOD.hollow);
  const ladle = new THREE.Group();
  const ladleBody = lad.mesh(white, { fog: false }, 1);
  ladleBody.rotation.z = -0.4; // held the way it is in the logo: bowl up, leaning
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), ...GLOW, opacity: 0.8 }));
  halo.scale.setScalar(0.8);
  halo.raycast = () => {}; // only the ladle itself is pointed at
  const grab = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.44), new THREE.MeshBasicMaterial({ visible: false })); // easier to point at
  ladle.add(halo, ladleBody, grab);
  const LADLE_Y = (PILLAR_H + STUMP) * SCALE + 0.5;
  ladle.position.set(HEART.x * SCALE, LADLE_Y, HEART.z * SCALE);
  ladle.userData.interact = {
    label: () => 'Take the ladle',
    act: 'Take',
    use: () => {
      if (api.hasLadle) return; // a second press before the prompt has caught up
      api.hasLadle = true;
      ladle.visible = false;
      hand.visible = true;
      const i = interact.indexOf(ladle);
      if (i >= 0) interact.splice(i, 1);
    },
    say: 'The Wooden Ladle. It is still warm.',
  };
  scene.add(ladle);
  interact.push(ladle);

  // ---- the ladle once it is yours: held out in front of you, and swung
  const hand = new THREE.Mesh(ladleBody.geometry, new THREE.MeshBasicMaterial({ map: white, vertexColors: true, fog: false, depthTest: false, transparent: true }));
  hand.renderOrder = 50; // over everything: it is in your fist, not in the room
  hand.frustumCulled = false;
  hand.visible = false;
  hand.scale.setScalar(0.7);
  scene.add(hand);
  const SWING = 0.34;
  let swing = 0, struck = true;
  api.swing = () => {
    if (!api.hasLadle || swing > 0) return;
    swing = SWING;
    struck = false;
  };

  for (const c of colliders) {
    for (const k of ['x0', 'x1', 'z0', 'z1', 'ax', 'az', 'bx', 'bz', 'r', 'top', 'base']) if (k in c) c[k] *= SCALE;
  }
  // (from here on everything is in real metres)

  // ---- the things that stand guard. This game's own man-eater: a toadstool grown as tall as
  // a man, rooted to the spot, with no eyes. Its mouth is not under the cap — it runs up the
  // stalk, a seam most of its height, laced shut with long thin teeth. At rest the seam eases
  // open and shut as if it breathed. It turns it towards whoever comes near, lets it come
  // open, and then tips over onto them. They only go down to the ladle.
  const hoop = (y, r, n, turn = 0) => Array.from({ length: n }, (_, i) => v3(Math.cos(turn + (i / n) * TAU) * r, y, Math.sin(turn + (i / n) * TAU) * r));
  const level = (c, o) => o.set(c.x, 0, c.z);
  const BITE = 1.2; // how far from its root a bite carries
  const foes = [];
  let washOut = 0, sting = 0, safe = 0; // the picture going white, flashing red, and seconds you can't be hurt again
  const drop = (list, thing) => {
    const i = list.indexOf(thing);
    if (i >= 0) list.splice(i, 1);
  };
  /** You lose a heart and are thrown back from (x, z). With none left you come round at the way in, and the guards are whole again. */
  const hurt = (you, x, z) => {
    api.hearts -= 1;
    sting = 1;
    safe = 1.4;
    const dx = you.pos.x - x, dz = you.pos.y - z, d = Math.hypot(dx, dz) || 1;
    you.shove((dx / d) * 3.6, (dz / d) * 3.6);
    if (api.hearts > 0) return false;
    washOut = 1.3;
    api.hearts = 3;
    you.setPose(api.spawn.x, api.spawn.z, api.spawn.yaw, api.spawn.pitch);
    for (const foe of foes) foe.rest();
    return true;
  };

  /** Plant one at (x, z) on a floor `y` up, facing `yaw`. `onGone` is called when it has been beaten. */
  const plant = ({ x, y = 0, z, yaw, onGone }) => {
    const foeSkin = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
    const part = (soup) => new THREE.Mesh(soup.geometry(1), foeSkin);
    const foe = new THREE.Group(); // stands where it was planted for good; it only ever turns and tips
    foe.position.set(x, y, z);
    // roots gripping the floor round its foot
    const rootSoup = new Soup().facing(upward, true);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3, long = 0.38 + (i % 2) * 0.14;
      const tip = v3(Math.cos(a) * long, 0, Math.sin(a) * long), l = v3(Math.cos(a - 0.4) * 0.17, 0, Math.sin(a - 0.4) * 0.17), r = v3(Math.cos(a + 0.4) * 0.17, 0, Math.sin(a + 0.4) * 0.17), up = v3(Math.cos(a) * 0.14, 0.13, Math.sin(a) * 0.14);
      rootSoup.tri(l, tip, up, [0, 0], [0, 0], [0, 0], col(0x8a80a0));
      rootSoup.tri(tip, r, up, [0, 0], [0, 0], [0, 0], col(0x6c6284));
    }
    foe.add(part(rootSoup));
    // the stalk: eight-sided, in one piece, tipping from the foot. One corner faces forward, and
    // the two sides that meet there, most of the way up, are the lips of the mouth.
    const body = new THREE.Group();
    foe.add(body);
    const TALL = 1.2, LIP0 = 0.2, LIP1 = 1.02; // how tall the stalk is; where the mouth starts and stops
    const girth = (y) => 0.2 - 0.055 * (y / TALL);
    const SIDE = 8, corner8 = (k, y) => v3(Math.cos(Math.PI / 2 + (k / SIDE) * TAU) * girth(y), y, Math.sin(Math.PI / 2 + (k / SIDE) * TAU) * girth(y)); // corner 0 is the front
    const stalk = new Soup().facing(level, true);
    for (const [y0, y1, whole] of [[0, LIP0, true], [LIP0, LIP1, false], [LIP1, TALL, true]]) {
      for (let k = 0; k < SIDE; k++) {
        if (!whole && (k === 0 || k === SIDE - 1)) continue; // the lips go here
        stalk.quad(corner8(k, y0), corner8(k + 1, y0), corner8(k + 1, y1), corner8(k, y1), undefined, col(k % 2 ? 0xa79bb8 : 0x857a98));
      }
    }
    // inside the mouth: a red hollow, closed top and bottom
    const gullet = (y) => [corner8(1, y), v3(-0.07, y, -0.05), v3(0.07, y, -0.05), corner8(SIDE - 1, y)];
    const g0 = gullet(LIP0), g1 = gullet(LIP1);
    stalk.facing((c, o) => o.set(-c.x, 0, 0.12 - c.z), true);
    for (let k = 0; k < 3; k++) stalk.quad(g0[k], g0[k + 1], g1[k + 1], g1[k], undefined, col(k === 1 ? 0xb0182c : 0x8a1222));
    stalk.facing(upward, true);
    stalk.quad(g0[0], g0[1], g0[2], g0[3], undefined, col(0x6a0e1a));
    stalk.facing(downward, true);
    stalk.quad(g1[0], g1[1], g1[2], g1[3], undefined, col(0x6a0e1a));
    body.add(part(stalk));
    // a torn skirt round the stalk above the mouth, the way toadstools have
    const skirt = new Soup().facing(downward, true);
    const sIn = hoop(TALL - 0.04, 0.12, 8), sOut = hoop(TALL - 0.13, 0.27, 8, 0.4);
    for (let k = 0; k < 8; k++) skirt.tri(sIn[k], sIn[(k + 1) % 8], sOut[k], [0, 0], [0, 0], [0, 0], col(k % 2 ? 0xcfc6dc : 0xb0a6c2));
    body.add(part(skirt));
    // the lips: each hinged down its outer edge, meeting at the front corner; and their teeth,
    // long and thin, each lip's laid across the other's so the seam is laced shut with them
    const TEETH = 6, TOOTH = col(0xf2ecd0), lips = [];
    for (const side of [-1, 1]) { // -1: the lip on its right hand (our left as it faces us)
      const hingeK = side < 0 ? 1 : SIDE - 1, h0 = corner8(hingeK, LIP0), h1 = corner8(hingeK, LIP1), f0 = corner8(0, LIP0), f1 = corner8(0, LIP1);
      const lip = new Soup();
      lip.facing(level, true);
      lip.quad(h0, f0, f1, h1, undefined, col(0x9489aa));
      const inset = (q) => q.clone().multiplyScalar(0.97).setY(q.y); // the wet inside of it, a hair behind
      lip.quad(inset(h0), inset(f0), inset(f1), inset(h1), undefined, col(0x9c1626));
      for (let j = 0; j < TEETH; j++) {
        const at = (j + (side < 0 ? 0.25 : 0.75)) / TEETH, long = 0.17 + ((j * 7 + (side < 0 ? 3 : 0)) % 4) * 0.025;
        const root = f0.clone().lerp(f1, at), tip = root.clone().add(v3(-side * long, 0.01, 0.014));
        lip.facing(null, true);
        lip.tri(root.clone().setY(root.y + 0.026), root.clone().setY(root.y - 0.026), tip, [0, 0], [0, 0], [0, 0], TOOTH);
      }
      // hang it on its hinge: a frame whose upright runs up the outer edge
      const hinge = new THREE.Group(), swing = new THREE.Group();
      hinge.position.copy(h0);
      hinge.quaternion.setFromUnitVectors(UP, h1.clone().sub(h0).normalize());
      hinge.updateMatrix();
      const mesh = part(lip);
      mesh.geometry.applyMatrix4(hinge.matrix.clone().invert());
      swing.add(mesh);
      hinge.add(swing);
      body.add(hinge);
      lips.push({ swing, side });
    }
    // the cap: shut, heavy, drooping; whatever it sees with is not in there
    const head = new THREE.Group();
    head.position.y = TALL - 0.02;
    body.add(head);
    const capSoup = new Soup();
    const capRim = hoop(0, 0.4, 8, 0.2), capMid = hoop(0.15, 0.28, 8, 0.2), capTop = v3(0, 0.29, 0);
    capSoup.facing(outwardFrom(0, -0.05, 0), true);
    for (let k = 0; k < 8; k++) {
      const j = (k + 1) % 8;
      capSoup.quad(capRim[k], capRim[j], capMid[j], capMid[k], undefined, col(k % 2 ? 0x6a2e8c : 0x57237a));
      capSoup.tri(capMid[k], capMid[j], capTop, [0, 0], [0, 0], [0, 0], col(k % 2 ? 0x7d3aa3 : 0x6a2e8c));
      if (k % 3 === 0) {
        // a pale wart, standing just proud of the cap
        const mid = capRim[k].clone().add(capRim[j]).add(capMid[j]).add(capMid[k]).multiplyScalar(0.25), o = mid.clone().setY(0).normalize().multiplyScalar(0.006);
        const w = (q) => mid.clone().lerp(q, 0.45).add(o);
        capSoup.quad(w(capRim[k]), w(capRim[j]), w(capMid[j]), w(capMid[k]), undefined, col(0xbff0e0));
      }
    }
    capSoup.facing(downward, true); // gills
    for (let k = 0; k < 8; k++) capSoup.tri(v3(0, 0.06, 0), capRim[k], capRim[(k + 1) % 8], [0, 0], [0, 0], [0, 0], col(k % 2 ? 0x8f9450 : 0x6f7440));
    head.add(part(capSoup));
    foe.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.8).translate(0, 0.75, 0.1), new THREE.MeshBasicMaterial({ visible: false }))); // to point at
    const F = { x, z, yaw, lean: 0.05, open: 0.04, nod: 0.3, hp: 3, mode: 'idle', t: 0, flash: 0, alive: true };
    const foeWall = { type: 'seg', ax: x, az: z, bx: x + 0.02, bz: z, r: 0.3, base: y - 0.1, top: y + 1.4 };
    colliders.push(foeWall);
    foe.userData.interact = {
      label: () => 'The thing standing guard',
      act: () => (api.hasLadle ? 'Attack' : ''),
      use: () => api.swing(),
      say: () => (api.hasLadle ? '' : "It won't let you by. You need something to hit it with."),
    };
    scene.add(foe);
    interact.push(foe);
    const setMode = (mode) => { F.mode = mode; F.t = 0; };
    const me = {
      F,
      rest() {
        if (!F.alive) return;
        F.hp = 3;
        setMode('idle');
      },
      /** A swing of the ladle: does it land? */
      strike(you, camera) {
        if (!F.alive || F.mode === 'dying') return;
        const dx = F.x - you.pos.x, dz = F.z - you.pos.y, d = Math.hypot(dx, dz);
        camera.getWorldDirection(_w);
        if (d > 1.55 || Math.abs(you.feet - y) > 0.9 || (dx * _w.x + dz * _w.z) / (d || 1) < 0.45) return; // out of reach, or not in front of you
        F.hp -= 1;
        F.flash = 1;
        setMode(F.hp > 0 ? 'stun' : 'dying');
      },
      lives(t, dt, you) {
        if (!F.alive) return;
        F.t += dt;
        F.flash = Math.max(0, F.flash - dt * 4);
        const near = you && Math.abs(you.feet - y) < 1.2 ? Math.hypot(you.pos.x - F.x, you.pos.y - F.z) : Infinity;
        const toYou = near < Infinity ? Math.atan2(you.pos.x - F.x, you.pos.y - F.z) : F.yaw;
        // where it wants to be: how far it tips over, how wide the mouth is, how far the cap hangs, how fast it gets there, how fast it turns
        let lean = 0.05, open = 0.04, nod = 0.3, quick = 2.5, turn = 0;
        switch (F.mode) {
          case 'idle': // upright, swaying, the seam easing open and shut again as if it breathed
            open = 0.1 + (0.5 - 0.5 * Math.cos(t * 1.5 + x)) * 0.5; // wide enough at the top of each breath to show the red of it
            if (near < 3.4) setMode('watch');
            break;
          case 'watch': { // it has noticed you: it turns the seam your way and lets it come open
            const close = 1 - Math.min(1, near / 3.4);
            lean = 0.08 + close * 0.2; open = 0.2 + close * 0.55 + Math.sin(t * 2.2) * 0.06; nod = 0.15; turn = 2.6;
            if (near < BITE && F.t > 0.5) setMode('wind');
            else if (near > 3.8) setMode('idle');
            break;
          }
          case 'wind': // rocks back, mouth wide from top to bottom
            lean = -0.1; open = 1.3; nod = -0.25; quick = 11; turn = 5;
            if (F.t > 0.34) setMode('lunge');
            break;
          case 'lunge': // and comes down on you full length
            lean = 1.02; open = 1.2; nod = 0.5; quick = 30;
            if (F.t > 0.14) {
              const off = Math.abs(Math.atan2(Math.sin(toYou - F.yaw), Math.cos(toYou - F.yaw)));
              setMode('spent');
              if (near < BITE + 0.15 && off < 0.6 && safe <= 0) hurt(you, F.x, F.z);
            }
            break;
          case 'spent': // mouth shut on nothing, slow to stand up again: the moment to hit it
            lean = F.t < 0.45 ? 1.02 : 0.05; open = 0; nod = 0.5; quick = F.t < 0.45 ? 30 : 3;
            if (F.t > 1.1) setMode('watch');
            break;
          case 'stun': // struck: thrown back, mouth gaping
            lean = -0.12; open = 0.9; nod = -0.4; quick = 14;
            if (F.t > 0.55) setMode('watch');
            break;
          case 'dying': // it goes over and is gone
            lean = 1.5; open = 0.5; nod = 0.6; quick = 4;
            if (F.t > 1.1) {
              F.alive = false;
              scene.remove(foe);
              drop(interact, foe);
              drop(colliders, foeWall);
              drop(foes, me);
              onGone?.();
              return;
            }
            break;
        }
        const k = Math.min(1, dt * quick);
        F.lean += (lean - F.lean) * k;
        F.open += (open - F.open) * Math.min(1, dt * quick * 1.5);
        F.nod += (nod - F.nod) * k;
        if (turn) F.yaw += Math.atan2(Math.sin(toYou - F.yaw), Math.cos(toYou - F.yaw)) * Math.min(1, dt * turn);
        foe.rotation.y = F.yaw;
        foe.scale.setScalar(F.mode === 'dying' ? Math.max(0.02, 1 - F.t / 1.1) : 1);
        body.rotation.set(F.lean + Math.sin(t * 1.1 + z) * 0.03, 0, Math.sin(t * 0.8 + x) * 0.04); // it is never quite still
        head.rotation.set(F.nod + Math.sin(t * 1.3 + 1) * 0.04, 0, Math.sin(t * 0.9 + 2) * 0.05);
        for (const lip of lips) lip.swing.rotation.y = lip.side * F.open;
        foeSkin.emissive.setScalar(F.flash * 0.9);
      },
    };
    foes.push(me);
    return me;
  };

  // one hard up against the foot of the ladder, its cap all but touching the pegs: nobody climbs while it stands
  const LADDER = api.ladders[0];
  LADDER.locked = true;
  plant({
    x: LADDER.x - LADDER.nx * 0.52, z: LADDER.z - LADDER.nz * 0.52, yaw: Math.atan2(-LADDER.nx, -LADDER.nz),
    onGone: () => { LADDER.locked = false; api.onSay?.('It is gone. The ladder is free.'); },
  });

  // ---- the vault's far side: a chest against the back wall, and another of them standing over it
  let chestFree = false;
  plant({ x: V.a1 - 1.05, y: V.floor, z: 0, yaw: -Math.PI / 2, onGone: () => { chestFree = true; api.onSay?.('It is gone.'); } });
  const WOODS = [col(0x7a4a22), col(0x6a3e1c), col(0x8c5a2c)], IRON = col(0x2c2c34), BRASS = col(0xc9a24a);
  const chestSkin = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const CH = { w: 0.33, h: 0.34, d: 0.21 }; // half width, height of the box, half depth
  const boxSoup = new Soup().facing(outwardFrom(0, 0.17, 0), true);
  const cornersAt = (yy) => [v3(-CH.w, yy, -CH.d), v3(CH.w, yy, -CH.d), v3(CH.w, yy, CH.d), v3(-CH.w, yy, CH.d)];
  const low4 = cornersAt(0), high4 = cornersAt(CH.h);
  for (let i = 0; i < 4; i++) boxSoup.quad(low4[i], low4[(i + 1) % 4], high4[(i + 1) % 4], high4[i], undefined, WOODS[i % 2]);
  boxSoup.facing(upward, true);
  boxSoup.quad(...cornersAt(CH.h - 0.04), undefined, col(0x140c06)); // the dark inside, seen when the lid is up
  boxSoup.facing((c, o) => o.set(0, 0, 1), true);
  for (const bx of [-0.2, 0.2]) boxSoup.quad(v3(bx - 0.03, 0, CH.d + 0.004), v3(bx + 0.03, 0, CH.d + 0.004), v3(bx + 0.03, CH.h, CH.d + 0.004), v3(bx - 0.03, CH.h, CH.d + 0.004), undefined, IRON);
  boxSoup.quad(v3(-0.045, CH.h - 0.11, CH.d + 0.006), v3(0.045, CH.h - 0.11, CH.d + 0.006), v3(0.045, CH.h - 0.01, CH.d + 0.006), v3(-0.045, CH.h - 0.01, CH.d + 0.006), undefined, BRASS); // the lock
  // the lid: a low arch, hinged along the back
  const lidSoup = new Soup(), ARCH = [[0, 0], [0.06, 0.1], [0.21, 0.15], [0.36, 0.1], [0.42, 0]]; // across it from the hinge: [how far forward, how high]
  lidSoup.facing(outwardFrom(0, -0.1, 0.21), true);
  for (let i = 0; i < ARCH.length - 1; i++) {
    const [z0, y0] = ARCH[i], [z1, y1] = ARCH[i + 1];
    lidSoup.quad(v3(-CH.w, y0, z0), v3(CH.w, y0, z0), v3(CH.w, y1, z1), v3(-CH.w, y1, z1), undefined, WOODS[(i % 2) + 1]);
    for (const bx of [-0.2, 0.2]) lidSoup.quad(v3(bx - 0.03, y0 + 0.004, z0), v3(bx + 0.03, y0 + 0.004, z0), v3(bx + 0.03, y1 + 0.004, z1), v3(bx - 0.03, y1 + 0.004, z1), undefined, IRON);
  }
  for (const sx of [-1, 1]) {
    lidSoup.facing((c, o) => o.set(sx, 0, 0), true);
    lidSoup.fan(v3(sx * CH.w, 0, 0.21), ARCH.map(([zz, yy]) => v3(sx * CH.w, yy, zz)), () => [0, 0], WOODS[1]);
  }
  const chest = new THREE.Group(), chestLid = new THREE.Group();
  chestLid.position.set(0, CH.h, -CH.d);
  chestLid.add(new THREE.Mesh(lidSoup.geometry(1), chestSkin));
  chest.add(new THREE.Mesh(boxSoup.geometry(1), chestSkin), chestLid);
  const CHEST = { x: V.a1 - 0.34, z: 0 };
  chest.position.set(CHEST.x, V.floor, CHEST.z);
  chest.rotation.y = -Math.PI / 2; // its front to whoever comes across the pit
  colliders.push({ type: 'box', x0: CHEST.x - 0.26, x1: CHEST.x + 0.26, z0: CHEST.z - 0.38, z1: CHEST.z + 0.38, base: V.floor - 0.1, top: V.floor + 0.5 });
  // the key in it: a ring, a shank and two teeth, flat and gold
  const keySoup = new Soup().facing(null, true), GOLD = [col(0xf2c94c), col(0xc99a2e)];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * TAU, a1 = ((i + 1) / 8) * TAU, at = (a, r) => v3(Math.cos(a) * r, 0.06 + Math.sin(a) * r, 0);
    keySoup.quad(at(a0, 0.026), at(a1, 0.026), at(a1, 0.05), at(a0, 0.05), undefined, GOLD[i % 2]);
  }
  keySoup.quad(v3(-0.009, -0.11, 0), v3(0.009, -0.11, 0), v3(0.009, 0.012, 0), v3(-0.009, 0.012, 0), undefined, GOLD[0]);
  for (const ty of [-0.105, -0.07]) keySoup.quad(v3(0.009, ty, 0), v3(0.04, ty, 0), v3(0.04, ty + 0.022, 0), v3(0.009, ty + 0.022, 0), undefined, GOLD[1]);
  const key = new THREE.Mesh(keySoup.geometry(1), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
  key.scale.setScalar(1.7);
  key.visible = false;
  key.position.set(CHEST.x, V.floor + 0.3, CHEST.z);
  const chestState = { opening: -1 }; // seconds since the lid was lifted, or -1
  api.hasKey = false;
  chest.userData.interact = {
    label: () => 'The chest',
    act: () => (chestFree && chestState.opening < 0 ? 'Open' : ''),
    use: () => { if (chestFree && chestState.opening < 0) chestState.opening = 0; },
    say: () => (chestFree ? '' : 'Not while that thing is standing over it.'),
  };
  scene.add(chest, key);
  interact.push(chest);
  const chestLives = (dt) => {
    if (chestState.opening < 0 || chestState.opening > 3) return;
    const t = (chestState.opening += dt);
    chestLid.rotation.x = -1.9 * (1 - (1 - Math.min(1, t / 0.6)) ** 2); // thrown back
    key.visible = t > 0.5 && t < 2.6; // the key comes up out of it, turns in the light, and is yours
    key.position.y = V.floor + 0.3 + Math.min(1, Math.max(0, (t - 0.5) / 0.9)) * 0.55;
    key.rotation.y = t * 4;
    if (t >= 2.6 && !api.hasKey) {
      api.hasKey = true;
      api.onSay?.('A small key.');
    }
  };

  // ---- the drop in the vault: go down it and you lose a heart and are put back on the last
  // firm ground you stood on
  const firm = { x: V.a0 + 0.4, z: 0 };
  const pitLives = (you) => {
    const x = you.pos.x, z = you.pos.y;
    if (x < V.a0 || x > V.a1 || Math.abs(z) > V.half) return;
    if (you.grounded && you.feet > V.floor - 0.1) {
      // remember it: a step back from the edge if it is one of the two floors, the middle of the slab if it is that
      const onLedge = x < (V.ledge + V.slab0) / 2, onFar = x > (V.slab1 + V.far) / 2;
      firm.x = onLedge ? Math.min(x, V.ledge - 0.3) : onFar ? Math.max(x, V.far + 0.3) : (V.slab0 + V.slab1) / 2;
      firm.z = onLedge || onFar ? z : 0;
    } else if (you.feet < V.floor - 0.9 && x > V.ledge && x < V.far) {
      const fainted = hurt(you, x, z);
      you.push.set(0, 0);
      if (fainted) return;
      you.feet = V.floor + 0.05;
      you.setPose(firm.x, firm.z, THREE.MathUtils.radToDeg(you.yaw), THREE.MathUtils.radToDeg(you.pitch));
    }
  };

  // ---- what is drawn over the picture: hearts, map, action badge
  const hud = makeHud(), tvHud = makeHud();
  tvHud.resize(Math.round((LINES * 4) / 3), LINES);
  const plan = {
    walls: corner.map((_, k) => [wallAt(k, 0).x * SCALE, wallAt(k, 0).z * SCALE]),
    upstairs,
    heart: { x: HEART.x * SCALE, z: HEART.z * SCALE, r: PILLAR_R * SCALE },
    steps: STEPS.map(([a]) => ({ x: (HEART.x + Math.cos(THREE.MathUtils.degToRad(a)) * STEP_OUT) * SCALE, z: (HEART.z + Math.sin(THREE.MathUtils.degToRad(a)) * STEP_OUT) * SCALE })),
    ladder: { x: LADDER.x, z: LADDER.z },
    hole: { x: 0, z: holeZ },
    chest: CHEST,
  };
  const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  upstairs.push([[V.w0, -DOOR], [V.a0, -DOOR], [V.a0, DOOR], [V.w1, DOOR]], rect(V.a0, V.ledge, -V.half, V.half), rect(V.slab0, V.slab1, -V.slabHalf, V.slabHalf), rect(V.far, V.a1, -V.half, V.half));
  const hudState = (who, action) => ({
    hearts: api.hearts, maxHearts: 3, action, plan, white: washOut, red: sting,
    you: who.you ? { x: who.you.pos.x, z: who.you.pos.y, yaw: who.you.yaw } : null,
    foes: foes.map((foe) => ({ x: foe.F.x, z: foe.F.z })),
    key: api.hasKey,
    luna: who.luna ? { x: who.luna.x, z: who.luna.z } : null,
  });
  api.setAction = (word) => { api.action = word; };

  const _eu = new THREE.Euler(), _qt = new THREE.Quaternion();
  /** `who`: { you: the player if they are in here, camera, luna: her position if she is } */
  api.update = (t, dt, who) => {
    ladleBody.rotation.y = t * 1.4;
    ladle.position.y = LADLE_Y + Math.sin(t * 2.1) * 0.05;
    halo.material.opacity = 0.7 + 0.15 * Math.sin(t * 5.3);
    beamMesh.material.opacity = 0.9 + 0.1 * Math.sin(t * 31) * Math.sin(t * 4.7); // a tube never holds quite still
    for (let i = 0; i < MOTES; i++) {
      const d = drift[i];
      let y = motes[i * 3 + 1] + d.rise * dt;
      if (y > DUST_TOP) y -= DUST_TOP;
      motes[i * 3] = d.x + Math.sin(t * 0.5 + d.phase) * 0.25;
      motes[i * 3 + 1] = y;
      motes[i * 3 + 2] = d.z + Math.cos(t * 0.4 + d.phase) * 0.25;
    }
    moteGeo.attributes.position.needsUpdate = true;

    washOut = Math.max(0, washOut - dt * 0.9);
    sting = Math.max(0, sting - dt * 2.5);
    safe = Math.max(0, safe - dt);
    for (const foe of [...foes]) foe.lives(t, dt, who.you);
    chestLives(dt);
    if (!who.you) return;
    pitLives(who.you);
    // the ladle in your hand, and the swing of it
    const reach = swing > 0 ? Math.sin((1 - swing / SWING) * Math.PI) : 0;
    if (swing > 0) {
      swing = Math.max(0, swing - dt);
      if (!struck && swing < SWING * 0.55) {
        struck = true;
        for (const foe of [...foes]) foe.strike(who.you, who.camera);
      }
    }
    who.camera.updateMatrixWorld();
    hand.position.set(0.21 - reach * 0.13, -0.2 - reach * 0.02, -0.42 - reach * 0.12).applyMatrix4(who.camera.matrixWorld);
    hand.quaternion.copy(who.camera.quaternion).multiply(_qt.setFromEuler(_eu.set(-0.2 - reach * 1.3, -0.45 + reach * 0.55, -0.15 + reach * 0.5)));
    hud.draw(hudState(who, api.action));
  };

  // ---- the picture: drawn small, then stretched over the screen
  const picture = new THREE.WebGLRenderTarget(320, LINES, { depthBuffer: true });
  picture.texture.colorSpace = THREE.SRGBColorSpace;
  picture.texture.magFilter = picture.texture.minFilter = THREE.LinearFilter;
  const stretch = new THREE.Scene(), flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // laid over what is already on the screen: opaque everywhere but where the glass punched its hole
  stretch.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: picture.texture, toneMapped: false, fog: false, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor })));
  api.resize = (w, h) => {
    const wide = Math.max(1, Math.round((LINES * w) / h));
    picture.setSize(wide, LINES);
    hud.resize(wide, LINES);
  };
  api.render = (renderer, camera) => {
    renderer.setRenderTarget(picture);
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.render(hud.scene, flatCam); // hearts, map and badge are part of the game's picture
    renderer.autoClear = true;
    renderer.setRenderTarget(null);
    renderer.render(through, camera); // the bedroom through the glass, as sharp as the screen is
    renderer.autoClear = false;
    renderer.render(stretch, flatCam); // the game's picture over it
    renderer.autoClear = true;
  };

  // ---- the same game as the bedroom's TV shows it while you are out there: the Hollow seen
  // from the glass, with the tube's lines over it
  const tvPicture = new THREE.WebGLRenderTarget(Math.round((LINES * 4) / 3), LINES, { depthBuffer: true });
  tvPicture.texture.colorSpace = THREE.SRGBColorSpace;
  tvPicture.texture.magFilter = tvPicture.texture.minFilter = THREE.LinearFilter;
  const tvCam = new THREE.PerspectiveCamera(70, 4 / 3, 0.05, 60);
  tvCam.position.set(0, glassY + 0.12, holeZ - 0.08);
  tvCam.lookAt(HEART.x * SCALE, 1.5, HEART.z * SCALE);
  const tube = new THREE.Scene();
  tube.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex(320, 240, (g, w, h) => crtFinish(g, w, h, 2), false), transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false })));
  api.screen = tvPicture.texture;
  api.drawTv = (renderer, who) => {
    const hidden = [beamMesh, spill, surround, glass, hand].filter((o) => o.visible); // what belongs to being at the glass, or to you
    for (const o of hidden) o.visible = false;
    tvHud.draw(hudState(who, ''));
    renderer.setRenderTarget(tvPicture);
    renderer.render(scene, tvCam);
    renderer.autoClear = false;
    renderer.render(tvHud.scene, flatCam);
    renderer.render(tube, flatCam);
    renderer.autoClear = true;
    renderer.setRenderTarget(null);
    for (const o of hidden) o.visible = true;
  };

  // ---- for whoever follows you in from the bedroom
  // Nothing built above needs lamps, but a visitor is lit as she moves: flat, from the sky.
  const starlight = new THREE.DirectionalLight(0xdbe6ff, 3.2);
  starlight.position.set(-0.5, 1, 0.6);
  scene.add(new THREE.AmbientLight(0x93a2cc, 1.5), starlight);
  // the floor she can walk on, and the first shelf mushroom as somewhere to jump up and settle
  const HOLLOW = WALL_R * SCALE + 0.4; // she keeps to the floor of the Hollow itself
  api.floor = { w: HOLLOW * 2, d: HOLLOW * 2, x0: -HOLLOW, z0: -HOLLOW, inside: (x, z) => Math.hypot(x, z) < WALL_R * SCALE * 0.95 };
  const [stepAngle, stepTop] = STEPS[0], sa = THREE.MathUtils.degToRad(stepAngle), out = (rad) => [(HEART.x + Math.cos(sa) * rad) * SCALE, (HEART.z + Math.sin(sa) * rad) * SCALE];
  api.perches = [{ off: out(STEP_OUT + STEP_HALF + 0.8), land: [out(STEP_OUT)[0], stepTop * SCALE, out(STEP_OUT)[1]], rest: null }];
  return api;
}
