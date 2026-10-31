// Luna, the cat: long black shell-fur on a small hand-built rig, and a brain that picks what
// to do next at random — wander, sit, wash a paw, hop on the bed and loaf, or come and stare at you.
// She can also follow you into the game in the TV, where she is drawn the way that game draws
// things: a handful of flat-shaded polygons and no fur.
import * as THREE from 'three';
import { canvasTex } from './util.js';
import { ROOM } from './room.js';
import { makeCoat, ellipsoid, furPart as fur } from './fur.js';

const rnd = Math.random; // deliberately unseeded: the cat never does the same thing twice
const pick = (a) => a[Math.floor(rnd() * a.length)];
const between = (a, b) => a + rnd() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const { lerp, clamp } = THREE.MathUtils;

const WALK = 0.5, TROT = 1.15, TURN = 5.5, SWIM = 0.22;
const BODY_UP = 0.47; // how far up from her feet she goes, swimming, helmet and all
export const CLIPS = 24; // planes she can be cut by, in her boat or her diving bubble (boat.js)
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);

// ---------------------------------------------------------------- fur

const COAT = makeCoat(0x070606, 0x302924, 0x050505);
const SKIN = COAT.skin;
const furPart = (geo, length, skins, opts = {}) => fur(geo, length, COAT, { ...opts, skins });

// ---------------------------------------------------------------- the 1998 version of her

const lowCache = new Map();

/**
 * The same part on a 1998 polygon budget. Without her coat she would come out half the cat:
 * the fur is most of her outline, so each part is swollen by the length of the hair that grew
 * on it (`fluff`) — all round, or all round but the front where the hair was `trimmed` short.
 */
function lowPoly(geo, fluff = 0, trimmed = false) {
  const key = `${geo.uuid}:${fluff}:${trimmed}`;
  if (lowCache.has(key)) return lowCache.get(key);
  geo.computeBoundingBox();
  const size = geo.boundingBox.getSize(new THREE.Vector3()), p = geo.parameters;
  const big = Math.max(size.x, size.y, size.z) > 0.05; // the parts that make her shape get a few more faces, to stay round
  let low = geo;
  if (geo.type === 'SphereGeometry') low = new THREE.SphereGeometry(1, big ? 8 : 6, big ? 6 : 4);
  else if (geo.type === 'ConeGeometry') low = new THREE.ConeGeometry(p.radius, p.height, 4, 1);
  else if (geo.type === 'CylinderGeometry') low = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, 6, 1);
  else if (geo.type === 'TorusGeometry') low = new THREE.TorusGeometry(p.radius, p.tube * 1.6, 4, 8);
  if (low !== geo) {
    // whatever was done to the original (squashed, stretched, moved off-centre), fit to it
    low.computeBoundingBox();
    const have = low.boundingBox.getSize(new THREE.Vector3());
    const want = size.clone().add(new THREE.Vector3(2, 2, trimmed ? 1.12 : 2).multiplyScalar(fluff));
    low.scale(want.x / have.x, want.y / have.y, want.z / have.z);
    low.computeBoundingBox();
    const shift = geo.boundingBox.getCenter(new THREE.Vector3()).sub(low.boundingBox.getCenter(new THREE.Vector3()));
    low.translate(shift.x, shift.y, shift.z - (trimmed ? 0.44 * fluff : 0)); // the long hair is all behind the face
  }
  lowCache.set(key, low);
  return low;
}

const faceted = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
const flatPaint = (color) => new THREE.MeshBasicMaterial({ color });
const IRIS_GLOW = 0.06;
// What each of her materials (by its colour) turns into in there. A black cat in a dark place at
// 240 lines would be a hole in the picture, so the coat is charcoal and the eyes are simply lit.
const FLAT = new Map([
  [0x050505, faceted(0x35323c)], // coat
  [0xcfd564, flatPaint(0xe2ea6c)], // irises
  [0x020202, flatPaint(0x000000)], // pupils
  [0x1a1214, flatPaint(0x0e0b0c)], // nose
  [0x33211f, faceted(0x704a46)], // inside the ears
  [0xc48a92, faceted(0xdc93a0)], // collar
  [0xd9788a, faceted(0xea8494)], // tongue
  [0x5c5853, null], // whiskers: finer than a pixel, gone
]);

// ---------------------------------------------------------------- rig

const POSES = {
  stand: { hipY: 0.195, pitch: 0, hindFold: 0, tuck: 0, tailLift: 0.85, curlX: 0.14, curlY: 0, headLift: 0.035, headFwd: 0 },
  sit: { hipY: 0.085, pitch: 0.8, hindFold: 1, tuck: 0, tailLift: -0.2, curlX: 0.02, curlY: 0.42, headLift: -0.01, headFwd: 0 },
  loaf: { hipY: 0.083, pitch: 0.07, hindFold: 1, tuck: 1, tailLift: -0.1, curlX: 0, curlY: 0.5, headLift: 0.02, headFwd: 0 },
  crouch: { hipY: 0.125, pitch: 0.2, hindFold: 0.35, tuck: 0, tailLift: 0.1, curlX: 0.05, curlY: 0, headLift: -0.01, headFwd: 0 },
  swim: { hipY: 0.195, pitch: 0, hindFold: 0, tuck: 0, tailLift: 0.12, curlX: 0.03, curlY: 0, headLift: 0.035, headFwd: 0 }, // her head where it always is (boat.js: the bubble round it)
};

function buildRig(skins) {
  const root = new THREE.Group();
  const spine = new THREE.Group();
  root.add(spine);
  const at = (obj, x, y, z, parent = spine) => { obj.position.set(x, y, z); parent.add(obj); return obj; };

  at(furPart(ellipsoid(0.082, 0.08, 0.19), 0.046, skins), 0, 0, 0.15);
  at(furPart(ellipsoid(0.086, 0.084, 0.09), 0.056, skins), 0, -0.006, 0.01);
  const chest = at(furPart(ellipsoid(0.076, 0.078, 0.075), 0.062, skins), 0, -0.008, 0.285);
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.058, 0.006, 8, 22),
    new THREE.MeshStandardMaterial({ color: 0xc48a92, roughness: 0.7 })
  );
  collar.rotation.x = 1.0;
  at(collar, 0, 0.045, 0.33);

  // ---- head
  const head = new THREE.Group();
  at(head, 0, 0.065, 0.36);
  at(furPart(ellipsoid(0.06, 0.054, 0.056), 0.024, skins, { shells: 14, front: 1 }), 0, 0, 0.01, head);
  for (const s of [-1, 1]) at(furPart(ellipsoid(0.027, 0.026, 0.026, 14, 10), 0.03, skins, { shells: 14, front: 1 }), s * 0.046, -0.034, -0.004, head);
  at(furPart(ellipsoid(0.026, 0.018, 0.02, 14, 10), 0.005, skins, { shells: 5 }), 0, -0.02, 0.06, head);
  const nose = new THREE.Mesh(ellipsoid(0.007, 0.005, 0.005, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1a1214, roughness: 0.4 }));
  at(nose, 0, -0.012, 0.081, head);
  const tongue = new THREE.Mesh(ellipsoid(0.0055, 0.0028, 0.012, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9788a, roughness: 0.45 }));
  at(tongue, 0, -0.03, 0.08, head);
  tongue.visible = false;

  const iris = new THREE.MeshStandardMaterial({ color: 0xcfd564, roughness: 0.22, emissive: 0x6a7020, emissiveIntensity: IRIS_GLOW }); // they catch the light; they don't give it
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.08 });
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    at(eye, s * 0.026, 0.011, 0.058, head);
    eye.rotation.y = s * 0.3;
    eye.add(new THREE.Mesh(ellipsoid(0.0135, 0.0135, 0.009, 18, 12), iris));
    const pupil = new THREE.Mesh(ellipsoid(0.0046, 0.0088, 0.003, 12, 10), pupilMat);
    pupil.position.z = 0.0068;
    eye.add(pupil);
    eyes.push(eye);
  }

  const earGeo = new THREE.ConeGeometry(0.031, 0.066, 12);
  earGeo.scale(1, 1, 0.5);
  earGeo.translate(0, 0.033, 0);
  const innerGeo = new THREE.ConeGeometry(0.019, 0.046, 10);
  innerGeo.scale(1, 1, 0.3);
  innerGeo.translate(0, 0.025, 0);
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x33211f, roughness: 0.9 });
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, SKIN);
    ear.castShadow = true;
    at(ear, s * 0.037, 0.04, -0.002, head);
    ear.rotation.set(-0.12, 0, -s * 0.34);
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(0, 0.004, 0.009);
    ear.add(inner);
    skins.push(ear);
    ears.push(ear);
  }

  const whiskerMat = new THREE.MeshStandardMaterial({ color: 0x5c5853, roughness: 0.5 });
  const whiskerGeo = new THREE.CylinderGeometry(0.0005, 0.0002, 0.06, 4);
  whiskerGeo.translate(0, 0.03, 0);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(whiskerGeo, whiskerMat);
    at(w, s * 0.018, -0.02 - i * 0.004, 0.068, head);
    w.rotation.set(0.25 - i * 0.2, 0, -s * (1.35 + i * 0.12));
  }

  // ---- tail: a chain of plumes
  const tail = [];
  let parent = spine;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Group();
    if (i === 0) seg.position.set(0, 0.03, -0.04); else seg.position.set(0, 0, -0.05);
    parent.add(seg);
    const taper = [1, 1, 1, 1, 0.92, 0.78, 0.55][i];
    at(furPart(ellipsoid(0.019, 0.019, 0.034, 12, 10), 0.058 * taper, skins, { shells: 16 }), 0, 0, -0.025, seg);
    tail.push(seg);
    parent = seg;
  }

  // ---- legs live in root space so they can always reach the ground under a tilted spine
  const limbGeo = new THREE.CylinderGeometry(0.03, 0.023, 1, 12, 1);
  limbGeo.translate(0, -0.5, 0);
  const pawGeo = ellipsoid(0.027, 0.02, 0.034, 12, 10);
  const legs = [];
  for (const front of [true, false]) for (const s of [-1, 1]) {
    const group = new THREE.Group();
    root.add(group);
    const limb = furPart(limbGeo, 0.022, skins, { shells: 10 });
    group.add(limb);
    const paw = new THREE.Mesh(pawGeo, SKIN);
    paw.castShadow = true;
    group.add(paw);
    skins.push(paw);
    legs.push({ group, limb, paw, front, side: s });
  }

  // soft contact shadow so the cat sits on the carpet rather than floating over it
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.62),
    new THREE.MeshBasicMaterial({
      map: canvasTex(64, 64, (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
        gr.addColorStop(0, 'rgba(0,0,0,0.85)');
        gr.addColorStop(0.55, 'rgba(0,0,0,0.35)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      }),
      transparent: true, depthWrite: false, opacity: 0.5,
    })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.renderOrder = 1;
  root.add(blob);

  // what keeps her out of things (Cat.keepClear): a sphere round each part of her, fur and all
  // (the fur reaches out up to 1.38× its length; 1.2× is the thick of it)
  const probes = [];
  const probe = (obj, x, y, z, r) => probes.push({ obj, at: new THREE.Vector3(x, y, z), r });
  for (const z of [0.06, 0.15, 0.24]) probe(spine, 0, 0, z, 0.082 + 0.046 * 1.2); // the back
  probe(spine, 0, -0.006, 0.01, 0.086 + 0.056 * 1.2); // the haunches
  probe(spine, 0, -0.008, 0.285, 0.078 + 0.062 * 1.2); // the chest
  probe(head, 0, 0, 0.01, 0.06 + 0.024 * 1.2);
  probe(head, 0, -0.016, 0.07, 0.03); // the muzzle
  for (const s of [-1, 1]) probe(head, s * 0.046, -0.034, -0.004, 0.027 + 0.03 * 1.2); // the cheeks
  tail.forEach((seg, i) => probe(seg, 0, 0, -0.025, 0.019 + 0.058 * [1, 1, 1, 1, 0.92, 0.78, 0.55][i] * 1.2));

  return { root, spine, chest, head, eyes, ears, tongue, tail, legs, blob, probes };
}

// ---------------------------------------------------------------- navigation

/** Coarse floor grid + A*, rebuilt on demand (the door leaf moves). */
class Nav {
  /**
   * `x0`, `z0`: the corner the grid starts from. `inside(x, z)`: optional extra test for
   * odd-shaped floors. `still`: nothing in the place ever moves, so the grid is worked out once.
   * `stamp()`: optional; something that changes whenever anything that blocks the way has moved
   * (the doors), so the grid is only worked out again then.
   */
  constructor(colliders, w, d, x0 = 0, z0 = 0, inside = null, still = false, stamp = null) {
    this.colliders = colliders;
    this.still = still;
    this.stamp = stamp;
    this.w = w; this.d = d;
    this.x0 = x0; this.z0 = z0;
    this.inside = inside;
    this.res = 0.1; this.r = 0.17;
    this.nx = Math.round(w / this.res); this.nz = Math.round(d / this.res);
    this.blocked = new Uint8Array(this.nx * this.nz);
    this.rebuild();
  }

  rebuild() {
    if (this.stamp) {
      const now = this.stamp();
      if (now === this.built) return;
      this.built = now;
    }
    const { res, r, nx, nz, w, d } = this;
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const lx = (ix + 0.5) * res, lz = (iz + 0.5) * res, x = lx + this.x0, z = lz + this.z0;
      let b = lx < r || lx > w - r || lz < r || lz > d - r || (this.inside ? !this.inside(x, z) : false);
      for (const c of this.colliders) {
        if (b) break;
        if ((c.top ?? Infinity) <= 0.03) continue; // (under the floor: the basement's walls and things, under the bedroom and the corridor, had shut her in)
        if (c.type === 'box') b = x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r;
        else {
          const abx = c.bx - c.ax, abz = c.bz - c.az;
          const t = clamp(((x - c.ax) * abx + (z - c.az) * abz) / (abx * abx + abz * abz), 0, 1);
          b = Math.hypot(x - c.ax - abx * t, z - c.az - abz * t) < c.r + r;
        }
      }
      this.blocked[iz * nx + ix] = b ? 1 : 0;
    }
  }

  cell(x, z) {
    return [clamp(Math.floor((x - this.x0) / this.res), 0, this.nx - 1), clamp(Math.floor((z - this.z0) / this.res), 0, this.nz - 1)];
  }

  free(x, z) {
    const [ix, iz] = this.cell(x, z);
    return !this.blocked[iz * this.nx + ix];
  }

  nearest(x, z) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.blocked.length; i++) {
      if (this.blocked[i]) continue;
      const cx = this.x0 + ((i % this.nx) + 0.5) * this.res, cz = this.z0 + (Math.floor(i / this.nx) + 0.5) * this.res;
      const dd = (cx - x) ** 2 + (cz - z) ** 2;
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }

  centre(i) {
    return [this.x0 + ((i % this.nx) + 0.5) * this.res, this.z0 + (Math.floor(i / this.nx) + 0.5) * this.res];
  }

  clear(a, b) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (this.res * 0.5));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      if (!this.free(lerp(a[0], b[0], t), lerp(a[1], b[1], t))) return false;
    }
    return true;
  }

  random() {
    for (let k = 0; k < 60; k++) {
      const i = Math.floor(rnd() * this.blocked.length);
      if (!this.blocked[i]) return this.centre(i);
    }
    return null;
  }

  /** Waypoints from a to b as [x, z] pairs, or null if b can't be reached. */
  path(ax, az, bx, bz) {
    if (!this.still) this.rebuild();
    const { nx, nz } = this;
    const start = this.nearest(ax, az), goal = this.nearest(bx, bz);
    if (start < 0 || goal < 0) return null;
    const g = new Float32Array(nx * nz).fill(Infinity);
    const f = new Float32Array(nx * nz).fill(Infinity);
    const from = new Int32Array(nx * nz).fill(-1);
    const shut = new Uint8Array(nx * nz);
    // the open cells, cheapest first: a binary heap, so a path across the whole house stays quick
    const heap = [];
    const push = (i) => {
      heap.push(i);
      for (let k = heap.length - 1; k > 0;) {
        const up = (k - 1) >> 1;
        if (f[heap[up]] <= f[heap[k]]) break;
        [heap[up], heap[k]] = [heap[k], heap[up]];
        k = up;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let k = 0; ;) {
          const a = 2 * k + 1, b = a + 1;
          let m = k;
          if (a < heap.length && f[heap[a]] < f[heap[m]]) m = a;
          if (b < heap.length && f[heap[b]] < f[heap[m]]) m = b;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
    const gx = goal % nx, gz = Math.floor(goal / nx);
    const h = (i) => Math.hypot((i % nx) - gx, Math.floor(i / nx) - gz);
    g[start] = 0;
    f[start] = h(start);
    push(start);
    let found = false;
    while (heap.length) {
      const cur = pop();
      if (shut[cur]) continue;
      if (cur === goal) { found = true; break; }
      shut[cur] = 1;
      const cx = cur % nx, cz = Math.floor(cur / nx);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const x = cx + dx, z = cz + dz;
        if (x < 0 || z < 0 || x >= nx || z >= nz) continue;
        const n = z * nx + x;
        if (this.blocked[n]) continue;
        if (dx && dz && (this.blocked[cz * nx + x] || this.blocked[z * nx + cx])) continue; // no corner cutting
        const cost = g[cur] + (dx && dz ? 1.4142 : 1);
        if (cost < g[n]) {
          g[n] = cost;
          f[n] = cost + h(n);
          from[n] = cur;
          push(n);
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = from[i]) cells.push(this.centre(i));
    cells.reverse();
    // string-pull: skip every waypoint we can already see past
    const out = [];
    let cur = cells[0], i = 1;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.clear(cur, cells[j])) j--;
      out.push(cells[j]);
      cur = cells[j];
      i = j + 1;
    }
    return out.length ? out : [cells[0]];
  }
}

// ---------------------------------------------------------------- the cat

// Somewhere to jump up to and settle: where on the floor she takes off from (and comes back
// down to), where the jump lands, and optionally a cosier spot to walk on to. These are on the bed.
const BED_SPOTS = [
  { off: [1.18, 1.52], land: [1.18, 0.615, 0.95], rest: null },
  { off: [0.88, 1.52], land: [0.88, 0.6, 0.97], rest: null },
  { off: [1.2, 1.52], land: [1.2, 0.615, 0.95], rest: [1.3, 0.68, 0.58] }, // on the hoodie, obviously
];

const PET_LINES = ['Prrr…', 'Meow.', 'Luna looks at you, then slowly half-closes her eyes.', 'She purrs.', 'She pushes her head against your hand.'];

export class Cat {
  constructor(scene, ctx, player, camera) {
    this.player = player;
    this.camera = camera;
    this.skins = [];
    this.rig = buildRig(this.skins);
    this.root = this.rig.root;
    scene.add(this.root);
    // the parts of her that aren't fur (eyes, nose, inner ears…) take no shadows in the bedroom — she casts
    // there, and her own head would shade them; in the living room and the kitchen they must, or the sun
    // lights them through the walls: her eyes shone there (user, 2026-10-17). Not in the bathroom: they were
    // right there as they were (user, 2026-10-18). housed(): main.js
    this.bare = [];
    this.root.traverse((o) => { if (o.isMesh && !o.receiveShadow && o !== this.rig.blob) this.bare.push(o); });
    // where she can be: the bedroom, and anywhere added later (addPlace)
    this.places = { room: { name: 'room', scene, nav: new Nav(ctx.colliders, ROOM.W, ROOM.D), perches: BED_SPOTS, interact: ctx.interact, flat: false } };
    this.place = this.places.room;
    this.nav = this.place.nav;
    this.perch = null; // what she is up on, if anything
    this.sound = ctx.sound;
    // both ways of drawing every part of her: as built, and as the game in the TV would
    this.root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o === this.rig.blob) return;
      const hex = o.material.color.getHex(), paint = FLAT.get(hex);
      // her eyes a size up, or they are lost at that resolution (and nudged so they sit in the blockier head)
      const pad = o.userData.fluff ?? (hex === 0xcfd564 ? 0.006 : 0), forward = hex === 0xcfd564 ? -0.002 : hex === 0x020202 ? 0.005 : 0;
      o.userData.looks = [
        { geo: o.geometry, mat: o.material, show: true, z: o.position.z },
        { geo: lowPoly(o.geometry, pad, o.userData.trimmed), mat: paint ?? o.material, show: paint !== null, z: o.position.z + forward },
      ];
    });

    this.pos = new THREE.Vector3(2.45, 0, 2.7);
    this.yaw = Math.atan2(player.pos.x - this.pos.x, player.pos.y - this.pos.z);
    this.groundY = 0;
    this.pose = { ...POSES.sit };
    this.target = POSES.sit;
    this.gait = 0;
    this.moveBlend = 0;
    this.speedNow = 0;
    this.air = null; // { front, hind, pitch } while off the ground
    this.lookMode = 'player';
    this.lookYaw = 0; this.lookPitch = 0;
    this.glance = { yaw: 0, pitch: 0, t: 0, player: false };
    this.blink = { t: between(1, 4), closing: 0 };
    this.squint = 0;
    this.flick = 0;
    // washing a paw: only ever starts once she has settled into a sit or a loaf
    this.groom = { on: false, t: 0, side: 1, blend: 0, wait: between(3, 8) };
    this.tailSide = 1;
    this.shy = 0; // seconds before it will bolt from under your feet again
    this.queue = [{ type: 'pose', pose: 'sit', dur: between(3, 5), look: 'player' }];
    this.last = '';
    // which room of the house a point is in (null in a doorway, or anywhere she doesn't know); set by
    // the house. Where you go she goes: once you have been in another room a few seconds, she comes.
    this.roomAt = () => null;
    this.ride = null; // { x, y, z, yaw, look }: carried along in her boat (boat.js)
    this.aboard = null; // what she is doing in it: { q }
    this.lookPoint = new THREE.Vector3(); // somewhere she is looking at (look mode 'point')
    // swimming, in her diving gear (boat.js), in the room the water leaves her: { x0, x1, z0, z1, y0, y1,
    // home, exit: [x, y, z], out: [x, z] }; `home`: you have gone, so out through the door after you
    this.dive = null;
    this.swimming = null; // { q, speed, pitch, inside }
    this.boarded = false; // she has just landed from a jump that was getting in
    this.apart = 0;
    this.waitApart = between(1.5, 3.5);

    this.root.userData.interact = {
      label: () => 'Pet Luna',
      say: () => pick(PET_LINES),
      use: () => this.pet(),
    };
    ctx.interact.push(this.root);
    // nothing of her is drawn outside these planes: all far away, except in her boat, where they are
    // its boards and the inside of its hull, so fur pressed against them never shows through (boat.js)
    this.clips = Array.from({ length: CLIPS }, () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e4));
    this.root.traverse((o) => { if (o.material) o.material.clippingPlanes = this.clips; });
    this.obstacles = []; // things that move that she must keep out of, as colliders (her boat)
    this.swinging = []; // doors that swing out into the room (house.js: the fridge's), as colliders
    this.pressed = false; // pushed back against the way she was going, last frame (keepClear)
    this.update(0, 0);
  }

  castShadows(on) {
    if (this.casting === on) return;
    this.casting = on;
    for (const s of this.skins) s.castShadow = on;
  }

  housed(on) {
    if (this.inHouse === on) return;
    this.inHouse = on;
    for (const o of this.bare) o.receiveShadow = on;
  }

  /** Her irises' own faint light (they catch the light; they don't give it), `k` of what it is by day. */
  eyeLight(k) {
    this.rig.eyes[0].children[0].material.emissiveIntensity = IRIS_GLOW * k;
  }

  // ---------------- brain

  plan() {
    const r = rnd();
    let kind = r < 0.32 ? 'wander' : r < 0.44 ? 'sit' : r < 0.56 ? 'wash' : r < 0.78 ? 'bed' : 'visit';
    if (kind === 'visit' && this.place.name === 'room' && this.roomAt(this.player.pos.x, this.player.pos.y) === 'yard') kind = 'wander'; // you are out: she doesn't come out to you
    // up on something, in whatever room she is in: the bed here, the sofa or a table there
    const here = this.place.name === 'room' ? this.roomAt(this.pos.x, this.pos.z) : null;
    const spots = here ? this.place.perches.filter((p) => this.roomAt(p.off[0], p.off[1]) === here) : this.place.perches;
    if (kind === 'bed' && !spots.length) kind = 'visit';
    if (kind === this.last && kind !== 'wander') kind = 'wander'; // variety
    this.last = kind;
    const rise = { type: 'pose', pose: 'stand', dur: 0.45, look: 'ahead' };
    const q = this.queue;

    if (kind === 'wander') {
      q.push(rise);
      for (let n = 1 + Math.floor(rnd() * 3); n > 0; n--) {
        const p = this.somewhereHere();
        if (!p) break;
        q.push({ type: 'walk', x: p[0], z: p[1], speed: WALK });
        q.push({ type: 'pose', pose: 'stand', dur: between(0.4, 2.6), look: 'around' });
      }
    } else if (kind === 'wash') {
      q.push({ type: 'pose', pose: 'sit', dur: between(5, 8), look: 'around', groom: true });
    } else if (kind === 'sit') {
      q.push({ type: 'pose', pose: 'sit', dur: between(4, 10), look: 'around' });
    } else if (kind === 'bed') {
      const spot = pick(spots);
      const [ox, oz] = spot.off, [lx, ly, lz] = spot.land;
      q.push(rise);
      q.push({ type: 'walk', x: ox + between(-0.06, 0.06), z: oz, speed: WALK });
      q.push({ type: 'jump', to: [lx, ly, lz], arc: spot.arc ?? 0.3, perch: spot, rise: !!spot.edge });
      if (spot.rest) q.push({ type: 'line', to: spot.rest });
      q.push({ type: 'face', yaw: between(-0.9, 0.9) });
      q.push({ type: 'pose', pose: rnd() < 0.75 ? 'loaf' : 'sit', dur: between(9, 22), look: 'around' });
      q.push(rise);
      if (spot.rest) q.push({ type: 'line', to: spot.land });
      q.push(...this.hopDown(spot));
    } else {
      q.push(rise);
      q.push({ type: 'approach', speed: between(0.6, 0.85) });
      q.push({ type: 'face', at: 'player' });
      q.push({ type: 'pose', pose: 'sit', dur: between(6, 13), look: 'player', visit: true });
    }
  }

  /** You have gone out: back to the living room and the kitchen (down off wherever she is first), to go about her own business there. */
  stayIn() {
    let p = null;
    for (let k = 0; k < 60 && !p; k++) { const c = this.nav.random(); if (c && this.roomAt(c[0], c[1]) === 'living') p = c; }
    if (!p) return;
    const q = [{ type: 'pose', pose: 'stand', dur: 0.35, look: 'ahead', indoors: true }];
    if (this.perch) {
      if (this.perch.rest) q.push({ type: 'line', to: this.perch.land, indoors: true });
      q.push(...this.hopDown(this.perch, { indoors: true }));
    }
    q.push({ type: 'walk', x: p[0], z: p[1], speed: WALK, indoors: true });
    this.groom.on = false;
    this.queue = q;
  }

  /** A free spot on the floor of the room she is in (anywhere, if rooms don't apply where she is). */
  somewhereHere() {
    const here = this.place.name === 'room' ? this.roomAt(this.pos.x, this.pos.z) : null;
    for (let k = 0; k < 40; k++) {
      const p = this.nav.random();
      if (!p || !here || this.roomAt(p[0], p[1]) === here) return p;
    }
    return null;
  }

  /** On her way to the room you are in. */
  get chasing() {
    return this.queue.some((s) => s.chase);
  }

  /** You are in another room: give up whatever she was doing (if she can) and come after you. */
  comeAfter() {
    const q = [{ type: 'pose', pose: 'stand', dur: 0.35, look: 'ahead', chase: true }];
    if (this.perch) {
      if (this.perch.rest) q.push({ type: 'line', to: this.perch.land, chase: true });
      q.push(...this.hopDown(this.perch, { chase: true }));
    }
    q.push({ type: 'approach', speed: between(0.75, 0.95), chase: true });
    q.push({ type: 'face', at: 'player' });
    q.push({ type: 'pose', pose: 'sit', dur: between(4, 9), look: 'player', visit: true });
    this.groom.on = false;
    this.queue = q;
  }

  /**
   * Down off it to the floor. `edge`: the spot's rim, where she goes first and leaps from, high enough to clear
   * it (user, 2026-10-18: off the kitchen table she went down through its top). `also`: added to each step.
   */
  hopDown(spot, also = {}) {
    if (!spot.edge) return [{ type: 'jump', to: [spot.off[0] + between(-0.1, 0.1), 0, spot.off[1] + 0.08], arc: 0.08, perch: null, ...also }];
    const to = [spot.drop[0] + between(-0.05, 0.05), 0, spot.drop[1] + between(-0.05, 0.05)];
    return [{ type: 'line', to: spot.edge, ...also }, { type: 'jump', to, arc: 0.2, perch: null, out: true, ...also }];
  }

  // ---------------- other places

  /** Somewhere else she can be. `flat`: drawn the way the game in the TV draws things. */
  addPlace(name, { scene, colliders, w, d, x0 = 0, z0 = 0, inside = null, still = false, perches = [], interact, flat = false }) {
    this.places[name] = { name, scene, nav: new Nav(colliders, w, d, x0, z0, inside, still), perches, interact, flat };
  }

  /**
   * Let her out of the bedroom: her floor becomes the whole house (`x0`, `z0`, `w`, `d`, `inside`), the
   * way through it worked out again whenever `stamp()` changes (a door has moved), and `roomAt(x, z)`
   * tells her which room is which.
   */
  wholeHouse({ colliders, w, d, x0, z0, inside, stamp, roomAt, perches = [] }) {
    const room = this.places.room;
    room.nav = new Nav(colliders, w, d, x0, z0, inside, false, stamp);
    room.perches = [...room.perches, ...perches]; // up on things in the other rooms too
    if (this.place === room) this.nav = room.nav;
    this.roomAt = roomAt;
  }

  setFlat(flat) {
    this.root.traverse((o) => {
      if (o.isInstancedMesh) o.visible = !flat; // the shells of fur
      const look = o.userData.looks?.[flat ? 1 : 0];
      if (!look) return;
      o.geometry = look.geo;
      o.material = look.mat;
      o.position.z = look.z;
      if (o !== this.rig.tongue) o.visible = look.show;
    });
  }

  /** In the middle of something that can't be broken off. */
  get committed() {
    const s = this.queue[0];
    return !!this.air || s?.type === 'jump' || s?.type === 'line';
  }

  /** On her way after you. */
  get following() {
    return this.queue.some((s) => s.follow);
  }

  /**
   * Drop everything, go to a way out of this place and leap through it.
   * `off`: the floor in front of it, `to`: the point to leap at, `then`: called as she goes through.
   */
  follow({ off, to, arc = 0.12, then }) {
    const q = [{ type: 'pose', pose: 'stand', dur: 0.4, look: 'ahead', follow: true }];
    if (this.perch) {
      if (this.perch.rest) q.push({ type: 'line', to: this.perch.land, follow: true });
      q.push(...this.hopDown(this.perch, { follow: true }));
    }
    q.push({ type: 'walk', x: off[0], z: off[1], speed: TROT, follow: true });
    q.push({ type: 'jump', to, arc, into: then, follow: true });
    this.groom.on = false;
    this.queue = q;
  }

  /** Come out of a way in: appearing at `from` [x, y, z] in the place called `name`, down to the floor at `to` [x, z]. */
  arrive(name, from, to) {
    const place = this.places[name], was = this.place.interact.indexOf(this.root);
    if (was >= 0) this.place.interact.splice(was, 1);
    place.scene.add(this.root);
    place.interact.push(this.root);
    this.place = place;
    this.nav = place.nav;
    this.perch = null;
    this.setFlat(place.flat);
    this.pos.set(from[0], 0, from[2]);
    this.groundY = from[1];
    this.yaw = Math.atan2(to[0] - from[0], to[1] - from[2]);
    // already in the air: straight into the second half of a jump
    this.queue = [{ type: 'jump', to: [to[0], 0, to[1]], arc: 0.1, t: 0.42 }, { type: 'pose', pose: 'stand', dur: between(0.8, 1.6), look: 'player' }];
  }

  /** Too close for comfort: get out from under the player's feet. */
  bolt() {
    const pl = this.player.pos;
    let best = null, bd = -1;
    for (let k = 0; k < 8; k++) {
      const p = this.somewhereHere();
      if (!p) continue;
      const d = Math.hypot(p[0] - pl.x, p[1] - pl.y);
      if (d > bd) { bd = d; best = p; }
    }
    if (!best) return;
    this.queue = [
      { type: 'walk', x: best[0], z: best[1], speed: TROT },
      { type: 'pose', pose: 'stand', dur: between(0.6, 1.4), look: 'player' },
    ];
    this.target = POSES.stand;
    this.shy = 4;
  }

  /** Where her voice comes from. */
  get mouthAt() {
    return [this.pos.x, this.groundY + 0.3, this.pos.z];
  }

  pet() {
    this.squint = 1.6;
    this.flick = 1;
    this.groom.on = false;
    this.sound.purr(this.mouthAt);
    if (this.groundY > 0.1 || this.air || this.queue[0]?.type === 'jump') return;
    this.queue = [{ type: 'face', at: 'player' }, { type: 'pose', pose: 'sit', dur: between(4, 7), look: 'player' }];
    this.shy = 6; // being stroked is not a reason to run
  }

  /** Step along the heading towards (tx, tz); true once there. */
  moveToward(tx, tz, speed, dt, arrive = 0.05) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < arrive) return true;
    const off = wrap(Math.atan2(dx, dz) - this.yaw);
    const turn = clamp(off, -TURN * dt, TURN * dt);
    this.yaw += turn;
    const step = Math.abs(off) < 1.1 ? Math.min(dist, speed * dt * Math.cos(off)) : 0;
    this.pos.x += Math.sin(this.yaw) * step;
    this.pos.z += Math.cos(this.yaw) * step;
    this.gait += (step / 0.3 + Math.abs(turn) * 0.12) * Math.PI * 2;
    this.speedNow = Math.max(this.speedNow, step / Math.max(dt, 1e-4), Math.abs(turn) > 1e-3 ? 0.2 : 0);
    return false;
  }

  followPath(s, dt) {
    if (!s.path.length) return true;
    // up against something on the last stretch (keepClear): that is as near as she gets
    const [ex, ez] = s.path[s.path.length - 1];
    if (this.pressed && s.path.length === 1 && Math.hypot(ex - this.pos.x, ez - this.pos.z) < 0.5) {
      s.path.length = 0;
      return true;
    }
    if (this.moveToward(s.path[0][0], s.path[0][1], s.speed, dt, s.path.length > 1 ? 0.09 : 0.05)) s.path.shift();
    return !s.path.length;
  }

  // ---------------- in her boat (boat.js)

  /**
   * Along for the ride: going wherever the boat goes, sitting in it facing the bow (user: always
   * sitting, facing forwards, never turning round or lying down in it), looking about or at you, and
   * washing now and then.
   */
  rideAlong(dt) {
    const R = this.ride;
    this.queue = [];
    this.air = null;
    this.perch = null;
    const B = (this.aboard ??= { q: [] });
    if (R.stand && B.q[0]?.pose !== 'stand') B.q = [{ type: 'pose', pose: 'stand', dur: 60, look: 'ahead' }]; // up on her feet in it (her diving gear)
    if (!B.q.length) {
      const you = R.look === 'player' && rnd() < 0.6;
      B.q.push({ type: 'pose', pose: 'sit', dur: between(7, 15), look: you ? 'player' : 'around', groom: !you && rnd() < 0.3 });
    }
    const s = B.q[0];
    s.t = (s.t ?? 0) + dt;
    if (this.holdPose(s, dt)) B.q.shift();
    if (typeof R.look === 'object') {
      // looking where she wants the boat to go
      this.lookMode = 'point';
      this.lookPoint.copy(R.look);
    } else if (this.lookMode === 'point') this.lookMode = s.look;
    this.pos.set(R.x, 0, R.z);
    this.groundY = R.y;
    this.yaw = R.yaw;
  }

  /** Holding a pose for a while (sit, loaf, stand), washing now and then; true once it is over. */
  holdPose(s, dt) {
    if (!s.started) {
      s.started = true;
      this.target = POSES[s.pose];
      this.lookMode = s.look;
      if (s.pose !== 'stand') this.tailSide = rnd() < 0.5 ? -1 : 1;
      if (s.groom) this.groom.wait = 0.5;
    }
    // she hardly ever says anything: a meow every few minutes at most, and never just for sitting down
    if (s.visit && s.t > 3 && rnd() < dt * 0.01) this.sound.meow(this.mouthAt);
    const G = this.groom;
    if (G.on) {
      if ((G.t -= dt) <= 0) { G.on = false; G.wait = between(4, 10); }
    } else if ((s.pose === 'sit' || s.pose === 'loaf') && s.t > 1.2 && (G.wait -= dt) <= 0) {
      if (s.groom || rnd() < 0.5) {
        G.on = true;
        G.t = between(3.5, 7);
        G.side = rnd() < 0.5 ? -1 : 1;
        s.groom = false;
      } else G.wait = between(3, 7);
    }
    let done = s.t > s.dur && !G.on; // never walks off mid-lick
    // came over to see you, and you walked off
    if (s.visit && s.t > 2 && Math.hypot(this.player.pos.x - this.pos.x, this.player.pos.y - this.pos.z) > 3) done = true;
    return done;
  }

  /**
   * Her body never goes into anything (user, 2026-10-15: her head through a door, her tail through
   * it, her fur through the boat): once she has moved and taken her pose, every part of her, fur and
   * all (rig.probes), is pushed out of the walls, doors and furniture by moving her whole self back, a
   * little each frame. On the floor only: up on things and in her boat she is put where she fits.
   */
  keepClear(dt) {
    const R = this.rig, probes = R.probes;
    R.root.updateMatrixWorld(true);
    const pts = (this.probePts ??= probes.map(() => new THREE.Vector3()));
    probes.forEach((p, i) => pts[i].copy(p.at).applyMatrix4(p.obj.matrixWorld));
    let ox = 0, oz = 0;
    for (let it = 0; it < 4; it++) {
      let worst = 0.001, px = 0, pz = 0;
      for (let i = 0; i < pts.length; i++) {
        const x = pts[i].x + ox, y = pts[i].y, z = pts[i].z + oz, r0 = probes[i].r;
        for (const list of [this.nav.colliders, this.obstacles, this.swinging]) for (const c of list) {
          const top = c.top ?? Infinity, base = c.base ?? -Infinity;
          if (top <= this.groundY + 0.03) continue; // what she stands on, or anything lower
          const dy = y > top ? y - top : y < base ? base - y : 0;
          if (dy >= r0) continue;
          const r = dy ? Math.sqrt(r0 * r0 - dy * dy) : r0;
          let nx, nz, d;
          if (c.type === 'box') {
            if (x < c.x0 - r || x > c.x1 + r || z < c.z0 - r || z > c.z1 + r) continue;
            nx = x - clamp(x, c.x0, c.x1);
            nz = z - clamp(z, c.z0, c.z1);
            d = Math.hypot(nx, nz);
            if (d < 1e-6) {
              // right inside it: out by the nearest side
              const e = [x - c.x0, c.x1 - x, z - c.z0, c.z1 - z], m = e.indexOf(Math.min(...e));
              nx = m === 0 ? -1 : m === 1 ? 1 : 0;
              nz = m === 2 ? -1 : m === 3 ? 1 : 0;
              d = -e[m];
            } else { nx /= d; nz /= d; }
          } else {
            const abx = c.bx - c.ax, abz = c.bz - c.az;
            const t = clamp(((x - c.ax) * abx + (z - c.az) * abz) / (abx * abx + abz * abz || 1), 0, 1);
            nx = x - c.ax - abx * t;
            nz = z - c.az - abz * t;
            const len = Math.hypot(nx, nz);
            if (len > 1e-6) { nx /= len; nz /= len; } else { nx = 1; nz = 0; }
            d = len - c.r;
          }
          const pen = r - d;
          if (pen > worst) { worst = pen; px = nx * pen; pz = nz * pen; }
        }
      }
      if (worst <= 0.001) break;
      ox += px;
      oz += pz;
    }
    this.pressed = false;
    const len = Math.hypot(ox, oz);
    if (len < 1e-4) return;
    const k = Math.min(1, (0.9 * dt + 0.004) / len); // eased out over a few frames, never a jump
    this.pos.x += ox * k;
    this.pos.z += oz * k;
    R.root.position.x = this.pos.x;
    R.root.position.z = this.pos.z;
    this.pressed = ox * Math.sin(this.yaw) + oz * Math.cos(this.yaw) < -0.5 * len;
  }

  // ---------------- swimming (boat.js: the bathroom full to the top)

  /**
   * Swimming in her diving suit (user, 2026-10-15): on along at a gentle paddle, stopping now and then
   * to hang in the water and look about, and now and then coming over to hang in front of you and
   * look at you. Never out of the room the water leaves her (`dive`), never into you or anything else
   * in the water (`obstacles`).
   */
  swimAlong(dt) {
    const D = this.dive, pl = this.player.pos;
    this.queue = [];
    this.air = null;
    this.perch = null;
    this.groom.on = false;
    this.target = POSES.swim;
    const S = (this.swimming ??= { q: [], speed: 0, pitch: 0, inside: false });
    if (D.home && S.inside && !S.q[0]?.home) S.q.length = 0; // you have gone: she drops whatever she was doing
    if (!S.q.length) this.planSwim(S, D);
    const s = S.q[0];
    s.t = (s.t ?? 0) + dt;
    let want = 0, done = false, vy = 0;
    if (s.type === 'swim') {
      const [tx, ty, tz] = s.at === 'player' ? this.inFrontOfYou(D) : s.to;
      const dx = tx - this.pos.x, dy = ty - this.groundY, dz = tz - this.pos.z, dh = Math.hypot(dx, dz);
      const off = wrap(Math.atan2(dx, dz) - this.yaw);
      if (dh > 0.05) this.yaw += clamp(off, -TURN * 0.3 * dt, TURN * 0.3 * dt);
      want = Math.hypot(dh, dy) > 0.06 ? SWIM * (Math.abs(off) < 0.9 || dh < 0.05 ? 1 : 0.35) * (s.home ? 1.6 : 1) : 0; // quicker after you
      vy = Math.sign(dy) * Math.min(Math.abs(dy) * 4, 1) * SWIM * 0.8; // straight up or down to it, not round in circles
      S.ahead = clamp(dh / 0.3, 0, 1); // and only as far forward as it is
      this.lookMode = 'ahead';
      // getting no nearer (something has come in the way): give it up and think again
      const left = Math.hypot(dh, dy);
      if (left < (s.best ?? Infinity) - 0.02) { s.best = left; s.since = 0; } else s.since = (s.since ?? 0) + dt;
      done = (dh < 0.07 && Math.abs(dy) < 0.06) || s.t > 25 || s.since > (s.free ? 4 : 1.5);
      if (s.since > (s.free ? 4 : 1.5)) S.q.length = 1; // stuck: the rest of the way is no good either — plan it again
    } else {
      // hanging in the water, paddling slowly, turned to you if it is you she came to see
      if (s.look === 'player') {
        const off = wrap(Math.atan2(pl.x - this.pos.x, pl.y - this.pos.z) - this.yaw);
        this.yaw += clamp(off, -TURN * 0.25 * dt, TURN * 0.25 * dt);
        if (s.t > 2 && Math.hypot(pl.x - this.pos.x, pl.y - this.pos.z) > 2.6) done = true; // you swam off
      }
      this.lookMode = s.look;
      done ||= s.t > s.dur;
    }
    if (done) {
      S.q.shift();
      if (s.exit) {
        // at the door: out through it and down onto the corridor floor (boat.js takes the suit off)
        this.dive = null;
        this.swimming = null;
        this.queue = [{ type: 'jump', to: [D.out[0], 0, D.out[1]], arc: 0.12, reach: 2 }, { type: 'pose', pose: 'stand', dur: 0.8, look: 'ahead' }];
        return;
      }
    }
    S.speed += (want - S.speed) * (1 - Math.exp(-dt * 1.6));
    const h = S.speed * dt * (s.type === 'swim' ? S.ahead ?? 1 : 1);
    if (s.type !== 'swim') vy = 0;
    this.pos.x += Math.sin(this.yaw) * h;
    this.pos.z += Math.cos(this.yaw) * h;
    this.groundY += vy * dt;
    S.pitch += (clamp(Math.atan2(vy, Math.max(S.speed, 0.05)), -0.5, 0.5) - S.pitch) * (1 - Math.exp(-dt * 2)); // nose up as she rises
    this.gait += dt * (1.6 + (S.speed / SWIM) * 5); // the paws paddle all the time, harder when she is going somewhere
    this.speedNow = S.speed;
    // kept out of you, and out of anything else in the water
    const keepOff = (ax, az, bx, bz, r, base, top) => {
      if (this.groundY > top || this.groundY + 0.45 < base) return;
      const abx = bx - ax, abz = bz - az, t = clamp(((this.pos.x - ax) * abx + (this.pos.z - az) * abz) / (abx * abx + abz * abz || 1), 0, 1);
      const nx = this.pos.x - ax - abx * t, nz = this.pos.z - az - abz * t, d = Math.hypot(nx, nz) || 1e-3, room = r + 0.3;
      if (d < room) {
        const k = Math.min(room - d, 0.7 * dt);
        this.pos.x += (nx / d) * k;
        this.pos.z += (nz / d) * k;
      }
    };
    keepOff(pl.x, pl.y, pl.x, pl.y, 0.25, this.player.feet, this.camera.position.y + 0.15);
    // and never inside anything standing in the water: up off it (or down from under it), as she swims
    for (const b of D.blocks) {
      if (!this.inBlock(b, this.pos.x, this.groundY, this.pos.z)) continue;
      // out the nearest way: up off it, down from under it, or along or across the room clear of it
      const m = 0.3, k = 0.5 * dt + 0.002, ways = [
        [b.top + 0.03 - this.groundY, 0, 1, 0],
        [b.base > 0 ? this.groundY + BODY_UP - b.base : Infinity, 0, -1, 0],
        [this.pos.z - (b.z0 - m), 0, 0, -1], [b.z1 + m - this.pos.z, 0, 0, 1],
        [this.pos.x - (b.x0 - m) + (b.x0 - m < D.x0 ? Infinity : 0), -1, 0, 0], [b.x1 + m - this.pos.x + (b.x1 + m > D.x1 ? Infinity : 0), 1, 0, 0],
      ];
      const [d, wx, wy, wz] = ways.reduce((a, w) => (w[0] < a[0] ? w : a));
      const step = Math.min(d, k);
      this.pos.x += wx * step;
      this.groundY += wy * step;
      this.pos.z += wz * step;
    }
    for (const c of this.obstacles) if (c.type === 'seg') keepOff(c.ax, c.az, c.bx, c.bz, c.r, c.base ?? -Infinity, c.top ?? Infinity);
    // the room is narrow: what she can't get round sideways, she backs away from along it
    for (const c of this.obstacles) {
      if (c.type !== 'seg' || this.groundY > c.top || this.groundY + 0.45 < c.base) continue;
      const lo = Math.min(c.az, c.bz) - c.r - 0.3, hi = Math.max(c.az, c.bz) + c.r + 0.3;
      const across = Math.abs(this.pos.x - (c.ax + c.bx) / 2) < c.r + 0.3;
      if (across && this.pos.z > lo && this.pos.z < hi) {
        const mid = (lo + hi) / 2, k = 0.7 * dt;
        this.pos.z += this.pos.z < mid ? -Math.min(k, this.pos.z - lo) : Math.min(k, hi - this.pos.z);
      }
    }
    // and in the water's room: once she is in it she stays in it (she comes in from the boat, or the floor)
    const e = 0.1, inBox = this.pos.x > D.x0 - e && this.pos.x < D.x1 + e && this.pos.z > D.z0 - e && this.pos.z < D.z1 + e && this.groundY > D.y0 - e && this.groundY < D.y1 + e;
    S.inside ||= inBox;
    if (S.inside && !s.free) {
      // eased back in if she is over the edge of it, never snapped
      const k = 0.3 * dt, back = (v, lo, hi) => (v < lo ? Math.min(lo, v + k) : v > hi ? Math.max(hi, v - k) : v);
      this.pos.x = back(this.pos.x, D.x0, D.x1);
      this.pos.z = back(this.pos.z, D.z0, D.z1);
      this.groundY = back(this.groundY, D.y0, D.y1);
    }
  }

  /** Whether her body, swimming with its feet at y, would be in block b (a box with a base and a top). */
  inBlock(b, x, y, z) {
    const m = 0.3; // half her length, turned any way
    return x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m && y < b.top + 0.03 && y + BODY_UP > (b.base ?? -1);
  }

  /** Whether she can swim straight from a to b ([x, y, z]) without going into anything standing in the water. */
  swimClear(D, a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.05));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), z = lerp(a[2], b[2], t);
      if (D.blocks.some((k) => this.inBlock(k, x, y, z))) return false;
    }
    return true;
  }

  /**
   * A way through the water from a to b ([x, y, z]) round whatever stands in it or lies on the bottom
   * (user, 2026-10-17: she must never get stuck swimming): A* over 10 cm cells of the water's room, then
   * pulled straight wherever she can swim straight. A few points to swim to, the last b; or null.
   */
  swimPath(D, a, b) {
    const C = 0.1, nx = Math.max(1, Math.round((D.x1 - D.x0) / C)), ny = Math.max(1, Math.round((D.y1 - D.y0) / C) + 1), nz = Math.max(1, Math.round((D.z1 - D.z0) / C));
    const X = (i) => lerp(D.x0, D.x1, nx > 1 ? i / (nx - 1) : 0.5), Y = (j) => lerp(D.y0, D.y1, ny > 1 ? j / (ny - 1) : 0.5), Z = (k) => lerp(D.z0, D.z1, nz > 1 ? k / (nz - 1) : 0.5);
    const blocks = this.swimBlocks(D), id = (i, j, k) => (k * ny + j) * nx + i, N = nx * ny * nz;
    const open = new Uint8Array(N);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) open[id(i, j, k)] = blocks.some((q) => this.inBlock(q, X(i), Y(j), Z(k))) ? 0 : 1;
    const cellOf = ([x, y, z]) => [Math.round(clamp((x - D.x0) / (D.x1 - D.x0 || 1), 0, 1) * (nx - 1)), Math.round(clamp((y - D.y0) / (D.y1 - D.y0 || 1), 0, 1) * (ny - 1)), Math.round(clamp((z - D.z0) / (D.z1 - D.z0 || 1), 0, 1) * (nz - 1))];
    const nearestOpen = (c) => { // the nearest open cell to c (breadth first)
      const seen = new Uint8Array(N), q = [c];
      seen[id(...c)] = 1;
      while (q.length) {
        const [i, j, k] = q.shift();
        if (open[id(i, j, k)]) return [i, j, k];
        for (const [di, dj, dk] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const I = i + di, J = j + dj, K = k + dk;
          if (I < 0 || J < 0 || K < 0 || I >= nx || J >= ny || K >= nz || seen[id(I, J, K)]) continue;
          seen[id(I, J, K)] = 1;
          q.push([I, J, K]);
        }
      }
      return null;
    };
    const s0 = nearestOpen(cellOf(a)), s1 = nearestOpen(cellOf(b));
    if (!s0 || !s1) return null;
    const goal = id(...s1), g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const h = (i, j, k) => Math.hypot(i - s1[0], j - s1[1], k - s1[2]);
    // a binary heap of [f, cell]
    const heap = [], push = (e) => { heap.push(e); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], end = heap.pop(); if (heap.length) { heap[0] = end; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    push([h(...s0), id(...s0)]);
    g[id(...s0)] = 0;
    const steps = [];
    for (const di of [-1, 0, 1]) for (const dj of [-1, 0, 1]) for (const dk of [-1, 0, 1]) if (di || dj || dk) steps.push([di, dj, dk, Math.hypot(di, dj, dk)]);
    while (heap.length) {
      const [, cur] = pop();
      if (done[cur]) continue;
      done[cur] = 1;
      if (cur === goal) break;
      const i = cur % nx, j = Math.floor(cur / nx) % ny, k = Math.floor(cur / (nx * ny));
      for (const [di, dj, dk, w] of steps) {
        const I = i + di, J = j + dj, K = k + dk;
        if (I < 0 || J < 0 || K < 0 || I >= nx || J >= ny || K >= nz) continue;
        const nId = id(I, J, K);
        if (!open[nId] || done[nId] || g[cur] + w >= g[nId]) continue;
        g[nId] = g[cur] + w;
        from[nId] = cur;
        push([g[nId] + h(I, J, K), nId]);
      }
    }
    if (!done[goal]) return null;
    const cells = [];
    for (let c = goal; c >= 0; c = from[c]) cells.unshift([X(c % nx), Y(Math.floor(c / nx) % ny), Z(Math.floor(c / (nx * ny)))]);
    cells.push(b);
    // pulled straight: from each point, on to the furthest one she can swim to directly
    const way = [];
    let at = a, n = 0;
    while (n < cells.length - 1) {
      let far = n + 1;
      for (let m = cells.length - 1; m > n + 1; m--) if (this.swimClear(D, at, cells[m])) { far = m; break; }
      way.push(cells[far]);
      at = cells[far];
      n = far;
    }
    return way;
  }

  /** What stands in the water for her to keep out of: the room's fixtures, and her boat on its way down or on the bottom. */
  swimBlocks(D) {
    const segs = this.obstacles.filter((c) => c.type === 'seg').map((c) => ({ x0: Math.min(c.ax, c.bx) - c.r, x1: Math.max(c.ax, c.bx) + c.r, z0: Math.min(c.az, c.bz) - c.r, z1: Math.max(c.az, c.bz) + c.r, base: c.base ?? -1, top: c.top ?? 9 }));
    return [...D.blocks, ...segs];
  }

  /** What she does next in the water. */
  planSwim(S, D) {
    const q = S.q, inside = (x, y, z, m = 0) => [clamp(x, D.x0 + m, D.x1 - m), clamp(y, D.y0 + m, D.y1 - m), clamp(z, D.z0 + m, D.z1 - m)];
    if (!S.inside) {
      // into the open water first, from wherever she came in
      q.push({ type: 'swim', to: inside(this.pos.x + Math.sin(this.yaw) * 0.5, this.groundY, this.pos.z + Math.cos(this.yaw) * 0.5, 0.12) });
      return;
    }
    const here = [this.pos.x, this.groundY, this.pos.z];
    const legs = (to, extra = {}) => { const way = this.swimPath(D, here, to); if (!way) return false; for (const p of way) q.push({ type: 'swim', to: p, ...extra }); return true; };
    if (D.home) {
      // you have gone: to the door, down to the gap under the water's face, and out after you
      const [ex, ey, ez] = D.exit;
      if (!legs(inside(ex, 0.3, ez + 0.35), { home: true })) q.push({ type: 'swim', to: inside(ex, 0.3, ez + 0.35), home: true });
      q.push({ type: 'swim', to: [ex, ey, ez], free: true, home: true });
      q.push({ type: 'hover', dur: 0.2, look: 'ahead', free: true, exit: true, home: true });
      return;
    }
    const you = this.player.pos;
    const youHere = you.x > D.x0 - 0.5 && you.x < D.x1 + 0.5 && you.y > D.z0 - 0.6 && you.y < D.z1 + 0.6;
    // inside something (pushed there, or it came down on her): out to the nearest open water first
    const blocks = this.swimBlocks(D);
    if (blocks.some((b) => this.inBlock(b, ...here))) {
      for (let r = 0.1; r <= 1.2; r += 0.1) {
        const near = [];
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1]]) {
          const p = inside(here[0] + dx * r, here[1] + dy * r, here[2] + dz * r);
          if (!blocks.some((b) => this.inBlock(b, ...p))) near.push(p);
        }
        if (near.length) { q.push({ type: 'swim', to: near[0], free: true }); return; }
      }
    }
    if (youHere && rnd() < 0.3) {
      const front = this.inFrontOfYou(D), way = this.swimPath(D, here, front);
      if (way) {
        for (const p of way.slice(0, -1)) q.push({ type: 'swim', to: p });
        q.push({ type: 'swim', at: 'player' });
        q.push({ type: 'hover', dur: between(4, 8), look: 'player' });
        return;
      }
    }
    // somewhere else in the water, not over (or past) anything still going down through it
    const sinking = this.obstacles.filter((c) => c.type === 'seg' && c.top > 0.6); // the boat while it is still on its way down
    for (let k = 0; k < 20; k++) {
      // anywhere from just off the floor to the top, low as often as high
      const p = [between(D.x0, D.x1), lerp(D.y0, D.y1, rnd() ** 1.3), between(D.z0, D.z1)];
      const blocked = sinking.some((c) => {
        const cz = (c.az + c.bz) / 2, reach = Math.abs(c.az - c.bz) / 2 + c.r + 0.45;
        return Math.abs(p[2] - cz) < reach || Math.sign(p[2] - cz) !== Math.sign(this.pos.z - cz);
      });
      if (!blocked && Math.hypot(p[0] - this.pos.x, p[2] - this.pos.z) > 0.7 && !this.swimBlocks(D).some((b) => this.inBlock(b, ...p)) && legs(p)) break;
    }
    if (!q.length) q.push({ type: 'hover', dur: between(1, 2.5), look: 'around' });
    if (rnd() < 0.55) q.push({ type: 'hover', dur: between(1.5, 4.5), look: 'around' });
  }

  /** A spot a little under your eyes, most of a metre in front of you, in the water's room. */
  inFrontOfYou(D) {
    const pl = this.player.pos, yaw = this.player.yaw;
    return [clamp(pl.x - Math.sin(yaw) * 0.8, D.x0, D.x1), clamp(this.camera.position.y - 0.34, D.y0, D.y1), clamp(pl.y - Math.cos(yaw) * 0.8, D.z0, D.z1)];
  }

  think(dt) {
    if (this.dive) return this.swimAlong(dt);
    this.swimming = null;
    if (this.ride) return this.rideAlong(dt);
    this.aboard = null;
    const pl = this.player.pos;
    const s0 = this.queue[0];
    this.shy -= dt;
    if (this.shy <= 0 && this.groundY === 0 && this.player.feet < 0.2 && !this.air && s0?.type !== 'jump' &&
        Math.hypot(pl.x - this.pos.x, pl.y - this.pos.z) < 0.3) this.bolt();

    // you went into another room: after a moment, she follows — but not out of doors: while you are out in
    // the yard she stays in, about her own business in the living room and the kitchen (user, 2026-10-17)
    if (this.place.name === 'room') {
      const mine = this.roomAt(this.pos.x, this.pos.z), yours = this.roomAt(pl.x, pl.y);
      const out = yours === 'yard';
      this.apart = mine && yours && mine !== yours && !this.following && !out ? this.apart + dt : 0;
      if (this.apart > this.waitApart && !this.committed && !this.chasing) {
        this.apart = 0;
        this.waitApart = between(1.5, 3.5);
        this.comeAfter();
      }
      if (out && mine && mine !== 'living' && !this.queue.some((s) => s.indoors || s.type === 'jump') && !this.air) this.stayIn();
    }
    if (!this.queue.length) this.plan();
    const s = this.queue[0];
    if (!s) return;
    if (s.type !== 'pose') this.groom.on = false;
    s.t = (s.t ?? 0) + dt;
    let done = false;

    switch (s.type) {
      case 'walk': {
        if (!s.path) {
          s.path = this.nav.path(this.pos.x, this.pos.z, s.x, s.z) ?? [];
          this.target = POSES.stand;
          this.lookMode = 'ahead';
        }
        done = this.followPath(s, dt) || s.t > 14;
        break;
      }
      case 'approach': {
        this.target = POSES.stand;
        this.lookMode = 'player';
        s.repath = (s.repath ?? 0) - dt;
        if (s.repath <= 0) {
          // a spot roughly a metre in front of wherever you're facing
          const yaw = this.player.yaw;
          const gx = pl.x - Math.sin(yaw) * 0.95, gz = pl.y - Math.cos(yaw) * 0.95;
          s.path = this.nav.path(this.pos.x, this.pos.z, gx, gz) ?? [];
          s.repath = 0.7;
        }
        done = this.followPath(s, dt) || s.t > 14;
        break;
      }
      case 'line': {
        const [tx, ty, tz] = s.to;
        this.target = POSES.stand;
        s.from ??= { y: this.groundY, d: Math.hypot(tx - this.pos.x, tz - this.pos.z) || 1 };
        done = this.moveToward(tx, tz, WALK * 0.7, dt, 0.03) || s.t > 5;
        const left = Math.hypot(tx - this.pos.x, tz - this.pos.z);
        this.groundY = done ? ty : lerp(ty, s.from.y, clamp(left / s.from.d, 0, 1));
        break;
      }
      case 'face': {
        const want = s.at === 'player' ? Math.atan2(pl.x - this.pos.x, pl.y - this.pos.z) : s.yaw;
        const off = wrap(want - this.yaw);
        const turn = clamp(off, -TURN * 0.7 * dt, TURN * 0.7 * dt);
        this.yaw += turn;
        this.gait += Math.abs(turn) * 1.4;
        this.speedNow = Math.max(this.speedNow, 0.25);
        done = Math.abs(off) < 0.06 || s.t > 2.5;
        break;
      }
      case 'pose':
        done = this.holdPose(s, dt);
        break;
      case 'jump': {
        const [tx, ty, tz] = s.to;
        const PREP = 0.42, AIR = 0.5, LAND = 0.22;
        if (!s.from && Math.hypot(tx - this.pos.x, tz - this.pos.z) > (s.reach ?? 1.2)) {
          this.queue = []; // never got to the take-off spot: forget the whole idea
          return;
        }
        if (s.t < PREP) {
          this.target = POSES.crouch;
          this.lookMode = 'ahead';
          const off = wrap(Math.atan2(tx - this.pos.x, tz - this.pos.z) - this.yaw);
          this.yaw += clamp(off, -TURN * dt, TURN * dt);
          this.speedNow = Math.max(this.speedNow, 0.2);
        } else if (s.t < PREP + AIR) {
          s.from ??= this.pos.clone().setY(this.groundY);
          const p = (s.t - PREP) / AIR;
          if (s.yaw != null) {
            // twisting round in the air, to land facing the way she means to sit (into her boat)
            s.yaw0 ??= this.yaw;
            this.yaw = s.yaw0 + wrap(s.yaw - s.yaw0) * p * p * (3 - 2 * p);
          }
          const up = ty >= s.from.y;
          // off a table she leaps out first and then drops (`out`), up onto one she rises first and then comes
          // in over its edge (`rise`): a straight line through the air took her through its edge
          const ph = s.out ? 1 - (1 - p) ** 2 : s.rise ? p * p : p, pv = s.out ? p * p : s.rise ? 1 - (1 - p) ** 2 : p;
          this.pos.x = lerp(s.from.x, tx, ph);
          this.pos.z = lerp(s.from.z, tz, ph);
          this.groundY = lerp(s.from.y, ty, pv) + s.arc * 4 * p * (1 - p);
          this.target = POSES.stand;
          this.air = s.out ? { // (level as she goes off its edge, nose down only once clear of it, her forepaws not reaching down onto it)
            pitch: -0.45 * Math.sin(Math.PI * Math.min(1, p * 1.2)),
            front: lerp(-0.3, 0.25, p),
            hind: lerp(0.95, -0.35, p),
          } : s.rise ? { // (her forepaws kept in under her until she is over its edge, not reaching into it from below)
            pitch: lerp(0.45, -0.1, p),
            front: lerp(-0.3, 0.25, p),
            hind: lerp(0.95, -0.35, p),
          } : {
            pitch: up ? lerp(0.6, -0.2, p) : lerp(-0.55, 0.1, p),
            front: lerp(-1.0, 0.25, p),
            hind: lerp(0.95, -0.35, p),
          };
        } else if (s.into) {
          // she doesn't land: she is through, and somewhere else
          this.air = null;
          this.queue = [];
          s.into();
          return;
        } else {
          if (this.air && ty < 0.1) this.sound.catLand(this.mouthAt); // paws on the carpet; onto the bed she lands silently
          if ('perch' in s) this.perch = s.perch;
          if (s.board) this.boarded = true;
          if (s.yaw != null) this.yaw = s.yaw;
          this.air = null;
          this.pos.x = tx; this.pos.z = tz;
          this.groundY = ty;
          this.target = s.t < PREP + AIR + LAND * 0.5 && !s.splash ? POSES.crouch : POSES.stand;
          done = s.splash || s.t > PREP + AIR + LAND; // (`splash`: into deep water, nothing to land on — swimming at once)
        }
        break;
      }
    }
    if (done) this.queue.shift();
  }

  // ---------------- body

  updateLook(dt, t) {
    const R = this.rig;
    let wantYaw = 0, wantPitch = 0;
    let mode = this.lookMode;
    if (this.groom.on) {
      // head down over the raised paw, nodding with each stroke of the tongue
      mode = 'groom';
      wantYaw = this.groom.side * 0.2;
      wantPitch = (this.target === POSES.loaf ? 0.42 : 0.55) + Math.sin(t * 10) * 0.07;
    }
    if (mode === 'around') {
      const g = this.glance;
      if ((g.t -= dt) <= 0) {
        g.t = between(1.6, 4.5);
        g.player = rnd() < 0.45;
        g.yaw = between(-1, 1);
        g.pitch = between(-0.25, 0.2);
      }
      if (g.player) mode = 'player'; else { wantYaw = g.yaw; wantPitch = g.pitch; }
    }
    if (mode === 'player' || mode === 'point') {
      const eye = R.root.worldToLocal((mode === 'point' ? this.lookPoint : this.camera.position).clone());
      const headAt = R.head.position.clone().applyMatrix4(R.spine.matrix);
      eye.sub(headAt);
      const yaw = Math.atan2(eye.x, eye.z);
      if (Math.abs(yaw) < 2.3) { // not when you're right behind it
        wantYaw = clamp(yaw, -1.25, 1.25);
        wantPitch = clamp(-Math.atan2(eye.y, Math.hypot(eye.x, eye.z)), -0.85, 0.5);
      }
    }
    const k = 1 - Math.exp(-dt * 6);
    this.lookYaw += (wantYaw - this.lookYaw) * k;
    this.lookPitch += (wantPitch - this.lookPitch) * k;
  }

  /** Returns true when the cat visibly moved this frame (so its shadow needs redrawing). */
  update(dt, t) {
    const R = this.rig;
    const before = this.pos.x + this.pos.z * 3 + this.yaw * 5 + this.groundY * 7;
    this.speedNow = 0;
    if (dt > 0) this.think(dt);

    // ease the pose
    let drift = 0;
    const k = 1 - Math.exp(-dt * 7);
    for (const key in this.pose) {
      const d = this.target[key] - this.pose[key];
      this.pose[key] += d * k;
      drift = Math.max(drift, Math.abs(d));
    }
    const P = this.pose;
    this.moveBlend += ((this.speedNow > 0.02 ? 1 : 0) - this.moveBlend) * (1 - Math.exp(-dt * 10));
    const mb = this.moveBlend;
    const air = this.air;

    R.root.position.set(this.pos.x, this.groundY, this.pos.z);
    R.root.rotation.y = this.yaw;
    R.root.updateMatrixWorld();

    const swim = this.swimming;
    const pitch = air ? air.pitch : swim ? swim.pitch : P.pitch;
    const bob = Math.abs(Math.sin(this.gait)) * 0.006 * mb;
    R.spine.position.set(0, P.hipY + bob, -0.13);
    R.spine.rotation.set(-pitch, 0, Math.sin(this.gait) * 0.035 * mb);
    R.spine.updateMatrix();
    R.chest.scale.setScalar(1 + Math.sin(t * 2.1) * 0.012);

    // head: undo the spine's tilt, then look where it wants to look
    this.updateLook(dt, t);
    R.head.position.set(0, 0.065 + P.headLift - bob * 0.5, 0.36 + P.headFwd);
    const q = R.head.quaternion;
    q.setFromAxisAngle(X, pitch);
    q.multiply(_q.setFromAxisAngle(Y, this.lookYaw));
    q.multiply(_q.setFromAxisAngle(X, this.lookPitch));

    // washing: where the mouth is, in root space, for the raised paw to meet it
    const G = this.groom;
    G.blend += ((G.on ? 1 : 0) - G.blend) * (1 - Math.exp(-dt * 5));
    const lick = Math.sin(t * 10);
    const washing = G.blend > 0.01;
    if (washing) {
      _mouth.set(G.side * 0.012, -0.034 + lick * 0.004, 0.082).applyQuaternion(q).add(R.head.position).applyMatrix4(R.spine.matrix);
    }
    if (G.blend > 0.6 && lick > 0 && !this.licking) this.sound.lick(this.mouthAt);
    this.licking = lick > 0;
    // the tongue only shows for the moment of each lick, flicked out and straight back in
    const flick = Math.max(0, (lick - 0.55) / 0.45);
    R.tongue.visible = G.blend > 0.8 && flick > 0;
    R.tongue.scale.z = 0.3 + 0.9 * flick;

    // legs: from shoulder / hip straight down to whatever the cat is standing on
    const v = _v;
    for (const L of R.legs) {
      const phase = this.gait + (L.front === (L.side > 0) ? 0 : Math.PI); // diagonal pairs
      v.set(L.side * (L.front ? 0.052 : 0.058), L.front ? -0.02 : -0.03, L.front ? 0.27 : 0.03).applyMatrix4(R.spine.matrix);
      L.group.position.copy(v);
      let len = Math.max(v.y, 0.04);
      let rot = Math.sin(phase) * 0.5 * mb;
      len *= 1 - 0.11 * Math.max(0, Math.cos(phase)) * mb; // lift the foot on the forward swing
      if (!L.front) {
        len = lerp(len, 0.13, P.hindFold);
        rot = lerp(rot, -1.25, P.hindFold);
      }
      if (air) { rot = L.front ? air.front : air.hind; len = Math.min(0.16, Math.max(v.y, 0.04) / Math.max(Math.cos(rot), 0.35)); } // (stretched out, but never down through what she leaps off: user, 2026-10-18)
      else if (swim) { len = 0.22; rot = L.front ? 0.5 + Math.sin(phase) * 0.25 : 0.65 + Math.sin(phase) * 0.5; } // legs out, front paws back under her, hind paws kicking
      len = lerp(len, 0.05, P.tuck);
      L.group.visible = P.tuck < 0.93;
      L.group.quaternion.setFromAxisAngle(X, rot);
      if (washing && L.front && L.side === G.side) {
        // this paw leaves the ground (or comes out from under her) and reaches for the mouth
        _reach.copy(_mouth).sub(v);
        const dist = _reach.length();
        L.group.quaternion.slerp(_q.setFromUnitVectors(DOWN, _reach.divideScalar(dist)), G.blend);
        len = lerp(len, dist - 0.012, G.blend);
        L.group.visible = true;
      }
      L.limb.scale.y = len;
      L.paw.position.set(0, -len + 0.014, 0.014);
    }

    // eyes: blinks, slow squint when content
    const b = this.blink;
    if ((b.t -= dt) <= 0) { b.t = between(2, 6.5); b.closing = 0.16; }
    b.closing = Math.max(0, b.closing - dt);
    this.squint = Math.max(0, this.squint - dt);
    const sleepy = this.target === POSES.loaf && this.lookMode !== 'player' ? 0.5 : 1;
    const open = Math.min(b.closing > 0 ? 0.08 : 1, this.squint > 0 ? 0.3 : 1, sleepy, G.on ? 0.45 : 1);
    for (const e of R.eyes) e.scale.y += (open - e.scale.y) * (1 - Math.exp(-dt * 22));

    // tail: up like a flag when walking, wrapped round when settled, with the odd flick at the tip
    if (rnd() < dt * 0.25) this.flick = 1;
    this.flick = Math.max(0, this.flick - dt * 0.8);
    const sway = Math.sin(t * 1.4) * 0.07 + Math.sin(this.gait * 0.5) * 0.1 * mb + (swim ? Math.sin(t * 2.1) * 0.16 : 0);
    R.tail[0].rotation.set(pitch + (air ? 0.4 : P.tailLift), sway, 0);
    for (let i = 1; i < R.tail.length; i++) {
      const tip = i / (R.tail.length - 1);
      R.tail[i].rotation.set(P.curlX, P.curlY * this.tailSide + sway * 0.6 + Math.sin(t * 6 + i) * 0.22 * this.flick * tip, 0);
    }

    // contact shadow: fainter while it's in the air, lifted clear of the rumpled blanket on the bed
    R.blob.visible = !swim;
    R.blob.position.set(0, this.groundY > 0.1 ? 0.03 : 0.012, 0.02);
    R.blob.material.opacity = air ? 0.15 : 0.5;

    if (dt > 0 && !air && !this.ride && !swim && this.groundY < 0.05) this.keepClear(dt);
    const after = this.pos.x + this.pos.z * 3 + this.yaw * 5 + this.groundY * 7;
    return after !== before || drift > 0.004 || mb > 0.05 || !!air || G.blend > 0.02;
  }
}

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3(), _mouth = new THREE.Vector3(), _reach = new THREE.Vector3();
