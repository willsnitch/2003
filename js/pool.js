// The end of the garden (user, 2026-10-29: "let's make the garden longer — after the trees, a pool"): past the grove
// the leaf litter thins out over an old paving of stone setts, moss and grass in every joint; on it, on the left, a
// wrought-iron table and its chairs (one knocked over) lost in weeds; then a swimming pool nobody has seen to in years
// — its water stagnant and green with duckweed, leaves rotting in it, its render grey, its tiles coming off; past its
// rounded far end a stone angel, head bowed over the water, among bushes gone wild; and a tree in each corner, hung
// with grey moss. Damp, abandoned, quiet. Built in the yard's own frame (yard.js), after the grove; his two
// photographs were for the shape and the feel (no palms).
import * as THREE from 'three';
import * as T from './textures.js';
import { mulberry32, fbm } from './util.js';
import { cornerTrees, CORNERS, leafCards } from './grove.js';

const S = THREE.MathUtils.smoothstep, clamp = THREE.MathUtils.clamp;
const std = (o) => new THREE.MeshStandardMaterial(o);

/** Where the old far fence stood: the wood's end, where the paving begins. */
export const END = -14.0;
/**
 * The pool (user, 2026-10-29: "horizontal, and bigger"): across the yard, its long side to the wood, its west end
 * rounded as in his photograph. Worked out in its own frame — x0…x1 across it, from its square end z1 (corners rounded
 * by `corner`) back to zc, then the half-round end about (0, zc) — and laid in the yard turned a quarter round, that
 * frame's middle at `at`: its square end east, its round end west, its x across the yard's z. `water`: its level;
 * `cope`: the coping's width round it. 7.3 × 4.2 m inside.
 */
export const POOL = { x0: -2.1, x1: 2.1, z1: 2.6, zc: -2.6, corner: 0.12, water: -0.55, floor: -0.9, cope: 0.3, at: [0.45, -21.7] };
const PR = (POOL.x1 - POOL.x0) / 2, PCX = 0, PZ0 = POOL.zc - PR; // the round end's radius, the middle, the round end
/** The pool's frame to the yard's: (x, z) → [x, z] (yard). */
const toYard = (lx, lz) => [lz + POOL.at[0], POOL.at[1] - lx];
/** The iron table (on the left before the pool, seen from the wood) and the stone angel past the pool's round end, as in his photograph. */
export const TABLE = { x: -3.2, z: -17.45 };
export const ANGEL = { x: -2.85, z: -25.3, plinth: 0.36 };
/** The bushes: [x, z, half-width x, half-width z, height, flowers (0 none, 1 pink, 2 white)]. */
const BUSHES = [
  [-3.95, -25.55, 0.5, 0.45, 1.15, 1], // either side of the angel
  [-1.75, -25.75, 0.65, 0.5, 1.35, 2],
  [-2.85, -26.85, 0.8, 0.45, 1.55, 1], // behind it, against the far fence
  [-0.9, -26.85, 0.75, 0.48, 1.3, 0],
  [0.75, -26.8, 0.9, 0.5, 1.45, 2],
  [2.0, -26.95, 0.5, 0.4, 1.0, 1],
  [-4.9, -20.4, 0.32, 0.85, 1.05, 0], // in the narrow strip by the west fence, past the round end
  [-4.8, -18.3, 0.45, 0.55, 0.95, 1], // and behind the table
  [3.62, -21.6, 0.28, 0.9, 1.1, 2], // the east strip, leaning over the coping
];
/** Low places where the rain stands on the paving: [x, z, rx, rz]. */
const PUDDLES = [[2.25, -18.35, 0.42, 0.26], [0.55, -25.05, 0.45, 0.3], [-1.3, -18.6, 0.3, 0.22]];

/** Signed distance in plan to the pool's inside edge (the yard's x, z): below 0 inside. */
export function sdPool(x, z) { return sdLocal(POOL.at[1] - z, x - POOL.at[0]); }
/** The same in the pool's own frame. */
function sdLocal(x, z) {
  if (z < POOL.zc) return Math.hypot(x - PCX, z - POOL.zc) - PR;
  const c = POOL.corner, qx = Math.abs(x - PCX) - (PR - c), qz = z - (POOL.z1 - c);
  if (qx > 0 && qz > 0) return Math.hypot(qx, qz) - c;
  return Math.max(Math.abs(x - PCX) - PR, z - POOL.z1);
}
/**
 * Round the pool's edge, `off` out from it (in, below 0), a point every `step` metres: [x, z, nx, nz (outwards), s (how
 * far round, along the inside edge)], from the near end's west corner, east along the near end, down the east side,
 * round the far end and back up the west side.
 */
function ring(off, step = 0.04) {
  const { x0, x1, z1, zc, corner: c } = POOL, R = PR + off, rc = c + off, out = [];
  let s = 0;
  const line = (ax, az, bx, bz, nx, nz, l0) => { const n = Math.max(1, Math.ceil(l0 / step)); for (let i = 0; i < n; i++) { const t = i / n; out.push([ax + (bx - ax) * t, az + (bz - az) * t, nx, nz, s + l0 * t]); } s += l0; };
  const arc = (ox, oz, a0, a1, r0, rr) => { const l0 = Math.abs(a1 - a0) * r0, n = Math.max(2, Math.ceil(l0 / step)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([ox + Math.cos(a) * rr, oz + Math.sin(a) * rr, Math.cos(a), Math.sin(a), s + l0 * (i / n)]); } s += l0; };
  line(x0 + c, z1 + off, x1 - c, z1 + off, 0, 1, x1 - x0 - 2 * c);
  arc(x1 - c, z1 - c, Math.PI / 2, 0, c, rc);
  line(x1 + off, z1 - c, x1 + off, zc, 1, 0, z1 - c - zc);
  arc(PCX, zc, 0, -Math.PI, PR, R);
  line(x0 - off, zc, x0 - off, z1 - c, -1, 0, z1 - c - zc);
  arc(x0 + c, z1 - c, Math.PI, Math.PI / 2, c, rc);
  out.len = s;
  return out;
}

/**
 * The end of the garden, into `g` (the yard's frame). `yard`: the whole yard, to its new far fence; `wire`: every line
 * overhead (the corner trees keep off them); `lit(fn)`: how the yard lights a two-sided card (yard.js bothFacesLit);
 * `merge`: geometries into one. Pushes colliders to ctx. Returns what the hose and the checks need.
 */
export function poolGarden(g, M, ctx, { yard, wire, lit, merge }) {
  const Y = yard, r = mulberry32(5401);
  const dist = (x, z, ax, az) => Math.hypot(x - ax, z - az);
  const angelBox = { x0: ANGEL.x - 0.45, x1: ANGEL.x + 0.45, z0: ANGEL.z - 0.45, z1: ANGEL.z + 0.45, top: 1.95 };

  // ---- the lie of it: where there is paving, where the weeds have it, where it is damp, where the leaves lie
  const wild = (x, z) => { // round the table the weeds have taken the paving
    const n = fbm(x * 1.6 + 2, z * 1.6 + 8, 0.5, 2) - 0.5;
    return 1 - S(dist(x, z, TABLE.x, TABLE.z) * (1 + n * 0.5), 1.1, 2.3);
  };
  const bed = (x, z) => { // the beds of soil along the fences and round the trees and the angel, where nothing was ever laid
    const n = fbm(x * 2.1 + 5, z * 2.1 + 1, 0.5, 2) - 0.5;
    let b = S(-(z - Y.z0) + n * 0.35, -1.45, -1.15); // along the far fence
    b = Math.max(b, (1 - S(x - Y.x0 + n * 0.3, 0.55, 0.85)) * S(-z, 18.6, 19.2)); // the west fence, past the table
    b = Math.max(b, 1 - S(Y.x1 - x + n * 0.2, 0.32, 0.5)); // the east fence
    for (const { at: [tx, tz] } of Object.values(CORNERS)) b = Math.max(b, 1 - S(dist(x, z, tx, tz) + n * 0.4, 0.95, 1.35));
    b = Math.max(b, 1 - S(Math.max(Math.abs(x - ANGEL.x), Math.abs(z - ANGEL.z)) + n * 0.2, 0.42, 0.62));
    return b;
  };
  const paved = (x, z) => { // 1 whole paving … 0 none
    const n = fbm(x * 1.3 + 7, z * 1.3 + 3, 0.5, 3) - 0.5;
    const n2 = fbm(x * 3.7 + 1, z * 3.7 + 5, 0.5, 2) - 0.5;
    return S(-z + n * 2.6 + n2 * 0.7, 14.5, 16.8) * (1 - 0.75 * wild(x, z)) * (1 - bed(x, z));
  };
  const litter = (x, z) => { // last year's leaves: the wood's, fading out over the stones; under the corner trees; in drifts
    const n = fbm(x * 0.9 + 1, z * 0.9 + 6, 0.5, 3) - 0.5, fine = fbm(x * 3 + 4, z * 3 + 2, 0.5, 2) - 0.5;
    let k = 1 - S(-z + n * 2.4 + fine * 0.6, 14.4, 17.4);
    for (const { at: [tx, tz] } of Object.values(CORNERS)) k = Math.max(k, 0.75 * (1 - S(dist(x, z, tx, tz) + n, 0.9, 2.6)));
    const sp = sdPool(x, z) - POOL.cope; // blown up against the coping, on the wood's side most
    if (sp > 0) k = Math.max(k, (0.35 + 0.35 * S(z, POOL.at[1] - PR, POOL.at[1] + PR)) * (1 - S(sp + fine * 0.15, 0.0, 0.3)) * S(fine, -0.25, 0.1));
    k = Math.max(k, 0.5 * (1 - S(Math.min(x - Y.x0, Y.x1 - x, z - Y.z0) + fine * 0.2, 0.1, 0.5))); // against the fence's boards
    return clamp(k + fine * 0.2, 0, 1);
  };
  const moss = (x, z) => { // how damp and green: patchy, more by the fences, in the beds, at the far end, round the puddles
    const n = fbm(x * 0.8 + 9, z * 0.8 + 4, 0.5, 3), m2 = fbm(x * 2.7 + 3, z * 2.7 + 7, 0.5, 2);
    let k = 0.5 + (n - 0.5) * 1.1 + (m2 - 0.5) * 0.4;
    k += 0.3 * (1 - S(Math.min(x - Y.x0, Y.x1 - x, z - Y.z0), 0.2, 1.4)) + 0.3 * bed(x, z) + 0.18 * S(-z, 23.5, 26.5);
    for (const [px, pz, rx, rz] of PUDDLES) k += 0.45 * (1 - S(Math.hypot((x - px) / rx, (z - pz) / rz), 0.9, 2.2));
    // where feet went, years ago: from the wood to the pool's long side, and round the pool
    const path = Math.abs(x - (0.6 + (z + 14.5) * -0.15)) < 0.45 && z > POOL.at[1] + PR + POOL.cope && z < -14.4;
    if (path) k -= 0.22;
    const sp = sdPool(x, z) - POOL.cope;
    if (sp > 0 && sp < 0.5) k -= 0.1;
    return clamp(k, 0, 1);
  };
  const puddleAt = (x, z) => PUDDLES.reduce((m, [px, pz, rx, rz]) => Math.min(m, Math.hypot((x - px) / rx, (z - pz) / rz)), 9); // < 1 in one

  // ---- the ground: dark soil and moss under the paving and in the beds, the wood's leaves at its near end
  const GZ1 = END, GZ0 = Y.z0, groundTex = T.pavingGroundTex({ x0: Y.x0, x1: Y.x1, z0: GZ0, z1: GZ1 }, litter, moss);
  const groundY = (x, z) => { // the joints a little down, the litter level with the yard's, the beds a little up and lumpy
    const p = paved(x, z), b = bed(x, z);
    return -0.02 * S(p, 0.15, 0.6) + b * (0.012 + 0.02 * fbm(x * 3 + 1, z * 3 + 4, 0.5, 2)) - 0.012 * (1 - S(puddleAt(x, z), 0.8, 1.3));
  };
  {
    const SP = 0.08, nx = Math.round((Y.x1 - Y.x0) / SP) + 1, nz = Math.round((GZ1 - GZ0) / SP) + 1, pos = [], uv = [], idx = [], inside = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = Y.x0 + (i / (nx - 1)) * (Y.x1 - Y.x0), z = GZ0 + (j / (nz - 1)) * (GZ1 - GZ0);
      pos.push(x, j === nz - 1 ? 0 : groundY(x, z), z); // (meeting the yard's lawn at the wood's end)
      uv.push((x - Y.x0) / (Y.x1 - Y.x0), 1 - (z - GZ0) / (GZ1 - GZ0));
      inside.push(sdPool(x, z) < 0.16);
    }
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (inside[a] || inside[b] || inside[c] || inside[d]) continue; // (the hole the pool is in: under the coping)
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, std({ map: groundTex, roughness: 1 }));
    ground.receiveShadow = true;
    g.add(ground);
  }

  // ---- the stones, and what grows on them
  const mossNoise = T.mossNoiseTex();
  const stoneMap = T.pavingStoneTex();
  const setts = [[0.13, 0.12], [0.16, 0.125], [0.19, 0.13], [0.22, 0.13], [0.26, 0.135], [0.3, 0.14]].map(([l, d], i) => settGeo(l, d, 5300 + i));
  const placed = setts.map(() => []); // per shape: [x, y, z, yaw, tiltX, tiltZ, sx, sz, moss, tint, du, dv]
  const grid = new Map(), key = (x, z) => `${Math.floor(x / 0.3)},${Math.floor(z / 0.3)}`;
  const stones = [];
  const forbidden = (za, zb) => { // across a row, where the pool and its coping are (one stretch: it is convex)
    let lo = Infinity, hi = -Infinity;
    for (let x = Y.x0; x < Y.x1; x += 0.015) for (const z of [za, zb, (za + zb) / 2]) if (sdPool(x, z) < POOL.cope + 0.012) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    return lo < hi ? [lo - 0.015, hi + 0.015] : null;
  };
  {
    let z = END - 0.32;
    while (z > Y.z0 + 0.14) {
      const depth = 0.118 + r() * 0.026, joint = 0.008 + r() * 0.012, zc = z - depth / 2, cut = forbidden(z, z - depth);
      let x = Y.x0 + 0.13 + r() * 0.12;
      while (x < Y.x1 - 0.2) {
        let si = Math.floor(r() * setts.length), len = setts[si].L * (0.92 + r() * 0.16);
        const gap = joint * (0.8 + r() * 0.6) + (r() < 0.04 ? 0.02 + r() * 0.04 : 0);
        if (cut && x + len > cut[0] && x < cut[1]) { // up to the coping: a cut stone, or none, then on past the pool
          const room = cut[0] - x;
          if (room > 0.07) { len = room; si = setts.reduce((b, s, k) => (Math.abs(s.L - room) < Math.abs(setts[b].L - room) ? k : b), 0); }
          else { x = cut[1] + gap; continue; }
        }
        const cx = x + len / 2, jz = (r() - 0.5) * 0.008, k = paved(cx, zc) + (r() - 0.5) * 0.35;
        const yaw = (r() - 0.5) * 0.06, tx = (r() - 0.5) * 0.025, tz = (r() - 0.5) * 0.025, heave = r(), tint = r(), du = r(), dv = r();
        x += len + gap;
        if ((k < 0.45 && !(k > 0.12 && heave > 0.7 && tint > 0.55)) || cx > Y.x1 - 0.13) continue; // (and the odd one out in the leaves, ahead of the rest)
        if (Math.abs(cx - ANGEL.x) < 0.32 + len / 2 && Math.abs(zc - ANGEL.z) < 0.4) continue;
        if (Object.values(CORNERS).some(({ at: [tx2, tz2] }) => dist(cx, zc, tx2, tz2) < 0.9)) continue;
        // sunk where the paving fades out under the leaves, under the puddles; heaved here and there by roots and frost
        const sink = (k < 0.7 ? -0.016 * Math.min(1, (0.7 - k) / 0.4) : 0) + (puddleAt(cx, zc) < 1 ? -0.014 : 0);
        const lift = heave < 0.06 ? 0.006 + heave * 0.08 : 0;
        const y = -0.002 + (tint - 0.5) * 0.005 + sink + lift, big = heave < 0.06 ? 2.5 : 1;
        const sx = len / setts[si].L, sz = depth / setts[si].D;
        placed[si].push([cx, y, zc + jz, yaw, tx * big, tz * big, sx, sz, moss(cx, zc), tint, du, dv]);
        const st = { x: cx, z: zc + jz, hx: len / 2, hz: depth / 2, top: y + 0.002 };
        stones.push(st);
        const kk = key(cx, zc);
        (grid.get(kk) ?? grid.set(kk, []).get(kk)).push(st);
      }
      z -= depth + joint;
    }
  }
  /** The top of whatever is at x, z: a stone, or the ground between them. */
  const topAt = (x, z) => {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const st of grid.get(`${Math.floor(x / 0.3) + dx},${Math.floor(z / 0.3) + dz}`) ?? []) {
      if (Math.abs(x - st.x) < st.hx - 0.01 && Math.abs(z - st.z) < st.hz - 0.01) return st.top;
    }
    return groundY(x, z);
  };
  const stoneMat = mossy(std({ map: stoneMap, roughness: 0.88 }), mossNoise, 'paving', { inst: true, edge: true });
  setts.forEach((geo, si) => {
    const list = placed[si];
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, stoneMat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    const mossA = new Float32Array(list.length), off = new Float32Array(list.length * 2);
    list.forEach(([x, y, z, yaw, tx, tz, sx, sz, mk, tint, du, dv], i) => {
      m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(tx, yaw, tz)), new THREE.Vector3(sx, 1, sz));
      mesh.setMatrixAt(i, m4);
      const v = 0.82 + tint * 0.3;
      mesh.setColorAt(i, c.setRGB(v * (tint > 0.8 ? 1.06 : 1), v, v * (tint > 0.8 ? 0.93 : 0.98)));
      mossA[i] = mk;
      off.set([du, dv], i * 2);
    });
    geo.setAttribute('aMoss', new THREE.InstancedBufferAttribute(mossA, 1));
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
    mesh.castShadow = false; // (a few millimetres proud of the ground: their own shading shows them)
    mesh.receiveShadow = true;
    g.add(mesh);
  });

  // ---- the puddles: rain standing in the low places, black, the sky in them
  const puddleMat = std({ color: 0x15170f, roughness: 0.06, envMap: M.yardEnv, envMapIntensity: 0.35 });
  for (const [px, pz, rx, rz] of PUDDLES) {
    const pts = [];
    for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2, w = 0.82 + 0.18 * Math.sin(a * 3 + px) + 0.08 * Math.sin(a * 7 + pz); pts.push(new THREE.Vector2(px + Math.cos(a) * rx * w, -(pz + Math.sin(a) * rz * w))); }
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, puddleMat);
    m.position.y = -0.008;
    m.receiveShadow = true;
    g.add(m);
  }

  // ---- the pool: its walls, its coping, its water
  const pool = buildPool(g, M, ctx, { moss, mossNoise, stoneMap, topAt, r: mulberry32(5501) });

  // ---- the iron table and its chairs, in the weeds
  const furniture = ironSet(g, ctx, topAt);

  // ---- the angel on its plinth, head bowed over the water
  const angel = stoneAngel(g, ctx, mossNoise);

  // ---- the corner trees
  const trees = cornerTrees(g, ctx, { yard: Y, wire, under: [angelBox, ...BUSHES.map(([x, z, rx, rz, h]) => ({ x0: x - rx * 0.6, x1: x + rx * 0.6, z0: z - rz * 0.6, z1: z + rz * 0.6, top: h * 0.7 }))] });

  // ---- the bushes, gone wild
  const sprays = [T.shrubSprayTex(1, 0), T.shrubSprayTex(2, 1), T.shrubSprayTex(3, 2)];
  const stems = [], rb = mulberry32(5601);
  for (const [bx, bz, rx, rz, h, bloom] of BUSHES) {
    const spots = [], n = Math.round((rx * rz * 4 + (rx + rz) * h * 2.2) * 9);
    const ph = rb() * 6.3;
    for (let i = 0; i < n; i++) {
      const a = rb() * Math.PI * 2, up = Math.acos(1 - rb() * 1.15); // over the dome, and a little under its rim
      const lump = 1 + 0.16 * Math.sin(a * 3 + ph) * Math.cos(up * 3) + 0.1 * Math.sin(a * 5 + ph * 2);
      const k = (0.62 + rb() * 0.42) * lump;
      const x = bx + Math.cos(a) * Math.sin(up) * rx * k, z = bz + Math.sin(a) * Math.sin(up) * rz * k, y = Math.max(0.22, Math.cos(up) * h * k * 0.92 + h * 0.08);
      const size = 0.42 + rb() * 0.3, half = size * 0.5;
      if (x < Y.x0 + half + 0.04 || x > Y.x1 - half - 0.04 || z < Y.z0 + half + 0.04) continue; // (not through the fence)
      if (Math.hypot(x - ANGEL.x, z - ANGEL.z) < 0.5 + half && y - half < 1.95) continue; // (nor through the angel)
      if (sdPool(x, z) < POOL.cope + half && y - half < 0.06) continue; // (nor down into the pool)
      spots.push([x, y, z, size]);
    }
    const mesh = leafCards(spots, sprays[bloom], [0.24, 0.32, 0.75], false, rb, null, { near: [0.2, 0.5] });
    g.add(mesh);
    for (let k = 0, m = 4 + Math.floor(rb() * 4); k < m; k++) { // the old wood at its foot, crooked, going up into it
      const a = rb() * 6.3, d = rb() * 0.25, x0 = bx + Math.cos(a) * d * rx, z0 = bz + Math.sin(a) * d * rz, pts = [];
      for (let j = 0; j <= 5; j++) { const t = j / 5; pts.push(new THREE.Vector3(x0 + Math.cos(a) * t * rx * 0.5 + (rb() - 0.5) * 0.05, -0.02 + t * h * 0.55, z0 + Math.sin(a) * t * rz * 0.5 + (rb() - 0.5) * 0.05)); }
      stems.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.014 + rb() * 0.01, 5, false));
    }
    ctx.colliders.push({ type: 'seg', ax: bx - rx * 0.35, az: bz, bx: bx + rx * 0.35, bz: bz + 0.001, r: Math.min(rx, rz) * 0.75, hose: false });
  }
  const stemMesh = new THREE.Mesh(merge(stems), std({ color: 0x4a3f33, roughness: 1 }));
  stemMesh.castShadow = stemMesh.receiveShadow = true;
  g.add(stemMesh);

  // ---- weeds: waist-high round the table and along the fences, in the beds, at the coping's edge; grass and moss
  // in the paving's joints
  const weedTexs = [T.weedTex(0, 1), T.weedTex(0, 2), T.weedTex(1, 1), T.weedTex(1, 2)];
  const weeds = weedTexs.map(() => []), tufts = [], rw = mulberry32(5701);
  const free = (x, z, m) => sdPool(x, z) > POOL.cope + m && x > Y.x0 + 0.08 && x < Y.x1 - 0.08 && z > Y.z0 + 0.08
    && Object.values(CORNERS).every(({ at: [tx, tz] }) => dist(x, z, tx, tz) > 0.55 + m) && !(Math.abs(x - ANGEL.x) < 0.3 + m && Math.abs(z - ANGEL.z) < 0.3 + m);
  for (let i = 0; i < 26000; i++) {
    const x = Y.x0 + rw() * (Y.x1 - Y.x0), z = GZ0 + rw() * (GZ1 - GZ0), roll = rw(), size = rw(), kind = rw(), turn = rw();
    const w = wild(x, z), b = bed(x, z), p = paved(x, z), edge = 1 - S(Math.min(x - Y.x0, Y.x1 - x, z - Y.z0), 0.15, 0.7);
    const coping = 1 - S(sdPool(x, z) - POOL.cope, 0.0, 0.12);
    const dense = Math.max(w * 0.9, b * 0.5, edge * 0.55, coping * 0.3, (1 - p) * S(-z, 15.2, 16) * 0.25) * (z > -14.8 ? 0.2 : 1);
    if (roll > dense * 0.06 + 0.002 || !free(x, z, 0.05)) continue;
    const tall = (0.32 + size * 0.42) * (0.5 + 0.5 * Math.max(w, b * 0.8, edge * 0.7)), big = kind < 0.6; // (knee to hip on a man, as in his photograph: to the boy's middle)
    weeds[(big ? 0 : 2) + (turn < 0.5 ? 0 : 1)].push([x, z, tall * (big ? 1 : 0.75), tall * (big ? 1.0 : 0.6), turn * Math.PI * 4]);
  }
  for (const st of stones) { // in the joints round a stone, now and then: a tuft of grass
    if (rw() > 0.09) continue;
    const side = rw(), along = rw() - 0.5, tall = 0.03 + rw() ** 2.5 * 0.16, x = side < 0.5 ? st.x + along * st.hx * 2 : st.x + (side < 0.75 ? -1 : 1) * (st.hx + 0.006), z = side < 0.5 ? st.z + (side < 0.25 ? -1 : 1) * (st.hz + 0.006) : st.z + along * st.hz * 2;
    if (free(x, z, 0.02) && puddleAt(x, z) > 1.05) tufts.push([x, groundY(x, z), z, tall, rw()]);
  }
  const card = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), cross = merge([card.clone(), card.clone().rotateY(Math.PI / 2)]);
  for (const geo of [cross]) { const n = geo.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
  weeds.forEach((list, k) => {
    if (!list.length) return;
    const mat = lit(std({ map: weedTexs[k], alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 }), 'weeds');
    const mesh = new THREE.InstancedMesh(cross, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    list.forEach(([x, z, h, w, yaw], i) => {
      m4.compose(new THREE.Vector3(x, groundY(x, z) - 0.01, z), q.setFromEuler(e.set((rw() - 0.5) * 0.15, yaw, (rw() - 0.5) * 0.15)), new THREE.Vector3(w, h, w));
      mesh.setMatrixAt(i, m4);
      const v = 0.82 + rw() * 0.3;
      mesh.setColorAt(i, c.setRGB(v * (0.95 + rw() * 0.1), v, v * 0.9));
    });
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    g.add(mesh);
  });
  {
    const blade = new THREE.PlaneGeometry(0.32, 1).translate(0, 0.5, 0), tuftGeo = merge([0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => blade.clone().rotateY(a)));
    const n = tuftGeo.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    const mesh = new THREE.InstancedMesh(tuftGeo, lit(std({ map: T.grassTuftTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 }), 'tufts'), tufts.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    tufts.forEach(([x, y, z, h, v], i) => {
      const wd = Math.min(1.3, Math.max(0.35, h * 3.4)) * (0.7 + v * 0.5);
      m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set((v - 0.5) * 0.3, v * 9, 0)), new THREE.Vector3(wd, h, wd));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, v < 0.2 ? c.setRGB(0.95, 0.86, 0.6) : c.setRGB(0.62 + v * 0.14, 0.68 + v * 0.1, 0.5));
    });
    mesh.receiveShadow = true;
    g.add(mesh);
  }

  // ---- last year's leaves: thick where the wood ends, thinning over the stones, in drifts against the coping and the
  // fence, under the corner trees; on the table, on the water
  const leafSpots = [], rl = mulberry32(5801);
  for (let i = 0; i < 70000; i++) {
    const x = Y.x0 + rl() * (Y.x1 - Y.x0), z = GZ0 + rl() * (GZ1 - GZ0), k = litter(x, z), s = 0.05 + rl() * 0.06, roll = rl();
    if (roll > Math.min(0.4, k * (0.25 + 0.3 * k)) || !free(x, z, 0.01) || puddleAt(x, z) < 1) continue;
    leafSpots.push([x, topAt(x, z) + 0.003, z, s, 1]);
  }
  for (let i = 0; i < 26; i++) { const a = rl() * 6.3, d = Math.sqrt(rl()) * 0.95; leafSpots.push([TABLE.x + Math.cos(a) * d * 0.55, 0.748, TABLE.z + Math.sin(a) * d * 0.38, 0.05 + rl() * 0.05, 1]); } // on the table
  for (let i = 0; i < 13000; i++) { // on the water, more against its walls and in the round end, where they drifted
    const lx = POOL.x0 + rl() * PR * 2, lz = PZ0 + rl() * (POOL.z1 - PZ0), sd = sdLocal(lx, lz), roll = rl();
    if (sd > -0.03 || roll > 0.1 + 0.5 * (1 - S(-sd, 0.0, 0.5)) + 0.2 * S(-lz, -POOL.zc - 1, -PZ0)) continue;
    const [x, z] = toYard(lx, lz);
    leafSpots.push([x, POOL.water + 0.0025, z, 0.05 + rl() * 0.05, 0]);
  }
  litterLeaves(g, leafSpots, rl);

  return {
    pool, furniture, angel, trees, stones: stones.length, weeds: weeds.reduce((n, l) => n + l.length, 0), tufts: tufts.length, leaves: leafSpots.length, // (for checking)
    /** What is underfoot out here, for whatever lies on it. */
    groundAt: (x, z) => (z < END && sdPool(x, z) > POOL.cope ? Math.max(0, topAt(x, z)) : 0),
  };
}

/**
 * Last year's leaves, one by one, curled a little, lying on what is under them (as yard.js leafHeaps lays them):
 * [x, y, z, size, dry (1) or soaked (0)].
 */
function litterLeaves(g, spots, r) {
  const geo = new THREE.PlaneGeometry(1, 1, 2, 2).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, 0.14 * p.getX(i) ** 2 + 0.06 * p.getZ(i) ** 2);
  geo.computeVertexNormals();
  const cells = new Float32Array(spots.length);
  const mat = std({ map: T.deadLeavesTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aCell;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv = (vMapUv + vec2(mod(aCell, 4.0), 3.0 - floor(aCell / 4.0))) / 4.0;
      #endif`);
  };
  mat.customProgramCacheKey = () => 'litter-far';
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  spots.forEach(([x, y, z, s, dry], i) => {
    q.setFromEuler(e.set((r() - 0.5) * (dry ? 0.35 : 0.1), r() * Math.PI * 2, (r() - 0.5) * (dry ? 0.35 : 0.1), 'YXZ'));
    m.compose(new THREE.Vector3(x, y + r() * 0.002, z), q, new THREE.Vector3(s * (r() < 0.5 ? -1 : 1), dry ? s : s * 0.4, s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, dry ? c.setScalar(0.78 + r() * 0.3) : c.setRGB(0.42 + r() * 0.12, 0.4 + r() * 0.1, 0.3)); // (soaked dark on the water)
    cells[i] = Math.floor(r() * 16);
  });
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1));
  mesh.receiveShadow = true;
  g.add(mesh);
}

/**
 * The moss on stone (the paving, the coping, the plinth, the angel): green where it is damp (`aMoss`, per vertex or
 * per instance) and where it faces up, in patches as `noise` (mossNoiseTex) has them, cushions in the patches; never a
 * flat wash. `inst`: instanced, `aOff` moves each one's picture; `edge`: `aEdge` (1 in a stone's middle, 0 at its rim)
 * — the moss comes in from the joints. `tri`: no UVs, the picture laid on three ways from the object's own axes.
 */
function mossy(mat, noise, key, { inst = false, edge = false, tri = null } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.mossNoise = { value: noise };
    if (tri) sh.uniforms.triMap = { value: tri };
    sh.vertexShader = `attribute float aMoss;\n${edge ? 'attribute float aEdge;\n' : ''}${inst ? 'attribute vec2 aOff;\n' : ''}varying float vMossK;\nvarying vec3 vWPos;\nvarying float vUp;\n${tri ? 'varying vec3 vOPos;\nvarying vec3 vONor;\n' : ''}` + sh.vertexShader
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n${inst ? '#ifdef USE_MAP\n vMapUv += aOff;\n#endif' : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 mw = vec4( transformed, 1.0 );
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          mw = instanceMatrix * mw;
          wn = mat3( instanceMatrix ) * wn;
        #endif
        mw = modelMatrix * mw;
        vWPos = mw.xyz;
        vUp = normalize( mat3( modelMatrix ) * wn ).y;
        vMossK = aMoss${edge ? ' * ( 1.3 - 0.55 * aEdge )' : ''};
        ${tri ? 'vOPos = transformed; vONor = objectNormal;' : ''}`);
    sh.fragmentShader = `uniform sampler2D mossNoise;\n${tri ? 'uniform sampler2D triMap;\nvarying vec3 vOPos;\nvarying vec3 vONor;\n' : ''}varying float vMossK;\nvarying vec3 vWPos;\nvarying float vUp;\nfloat mossAmt;\n` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        ${tri ? `vec3 tw = pow( abs( normalize( vONor ) ), vec3( 4.0 ) ); tw /= tw.x + tw.y + tw.z;
        vec3 tc = texture2D( triMap, vOPos.zy * 2.0 ).rgb * tw.x + texture2D( triMap, vOPos.xz * 2.0 ).rgb * tw.y + texture2D( triMap, vOPos.xy * 2.0 ).rgb * tw.z;
        diffuseColor.rgb *= tc; // (an sRGB texture: the GPU hands it back linear already)` : ''}
        vec4 mn = texture2D( mossNoise, vWPos.xz * 0.9 + vWPos.y * 0.3 ), mf = texture2D( mossNoise, vWPos.xz * 6.0 + vWPos.y * 2.0 );
        mossAmt = smoothstep( 0.44, 0.64, vMossK + ( mn.r - 0.5 ) * 0.9 + ( mf.g - 0.5 ) * 0.35 ) * smoothstep( -0.15, 0.55, vUp + vMossK * 0.4 );
        vec3 mossC = mix( vec3( 0.07, 0.09, 0.028 ), vec3( 0.19, 0.24, 0.065 ), mf.r );
        diffuseColor.rgb = mix( diffuseColor.rgb, mossC, mossAmt );`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor, 1.0, mossAmt );');
  };
  mat.customProgramCacheKey = () => 'mossy-' + key;
  return mat;
}

/**
 * One old sett, `L` long by `D` across (metres; scaled a little each time it is laid): its top domed and worn, its
 * rim rounded off unevenly, its sides not quite straight, a skirt going down into the ground. UVs in half-metres (the
 * stone picture's tile); `aEdge`: 1 in its middle, 0 at its rim.
 */
function settGeo(L, D, seed) {
  const r = mulberry32(seed), NU = 10, NV = 7, P = 5, RIM = 0.012, ph = [r() * 6.3, r() * 6.3, r() * 6.3];
  const ts = (n) => Array.from({ length: n + 1 }, (_, i) => { const t = (i / n) * 2 - 1; return Math.sign(t) * (1 - (1 - Math.abs(t)) ** 1.7); });
  const us = ts(NU), vs = ts(NV), pos = [], uv = [], edge = [], idx = [];
  const plan = (u, v) => { // the square to the stone's rounded, wobbly outline
    const m = Math.max(Math.abs(u), Math.abs(v)), q = (Math.abs(u) ** P + Math.abs(v) ** P) ** (1 / P), k = m > 1e-6 ? m / q : 1;
    const a = Math.atan2(v, u), wob = 1 + 0.05 * Math.sin(a * 2 + ph[0]) + 0.03 * Math.sin(a * 3 + ph[1]);
    return [u * k * wob * L / 2, v * k * wob * D / 2, 1 - q];
  };
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const [x, z, e] = plan(us[i], vs[j]), dm = e * Math.min(L, D) / 2, rim = RIM * (0.75 + 0.5 * (0.5 + 0.5 * Math.sin(Math.atan2(vs[j], us[i]) * 3 + ph[2])));
    let y = dm < rim ? -rim + Math.sqrt(Math.max(0, rim * rim - (rim - dm) ** 2)) : 0;
    y += 0.0022 * Math.min(1, e * 2.2) + 0.0012 * Math.sin(x * 61 + ph[0]) * Math.sin(z * 47 + ph[1]) * Math.min(1, e * 4); // domed, a little lumpy
    pos.push(x, y, z);
    uv.push(x / 0.5 + 0.5, z / 0.5 + 0.5);
    edge.push(S(e, 0.0, 0.4));
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  // the skirt: round the rim and down into the ground
  const rim = [];
  for (let i = 0; i < NU; i++) rim.push(i);
  for (let j = 0; j < NV; j++) rim.push(j * (NU + 1) + NU);
  for (let i = NU; i > 0; i--) rim.push(NV * (NU + 1) + i);
  for (let j = NV; j > 0; j--) rim.push(j * (NU + 1));
  const base = pos.length / 3;
  rim.forEach((k, n) => {
    const x = pos[k * 3], z = pos[k * 3 + 2], l = Math.hypot(x, z) || 1;
    pos.push(x + (x / l) * 0.003, -0.05, z + (z / l) * 0.003);
    uv.push(n * 0.03, 0);
    edge.push(0);
  });
  for (let n = 0; n < rim.length; n++) {
    const a = rim[n], b = rim[(n + 1) % rim.length], c = base + n, d = base + ((n + 1) % rim.length);
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.L = L;
  geo.D = D;
  return geo;
}

// ---------------------------------------------------------------- the pool

/**
 * The pool: its walls (render and a band of tiles, `poolWallTex`), the coping round it (bull-nosed stone, piece by
 * piece: each a little out of level, its nose chipped here and there, one cracked across, one gone — it lies on the
 * paving by the west side, broken in two — the mortar bed showing where it was), the inlet on the far wall, the two
 * rusted sockets of a ladder taken out long ago, and the water: still, near black, duckweed in drifts, leaves.
 */
function buildPool(yardG, M, ctx, { moss: mossYard, mossNoise, stoneMap, topAt: topYard, r }) {
  const { water, floor } = POOL, TOP = -0.012;
  const g = new THREE.Group(); // (everything here in the pool's own frame)
  g.position.set(POOL.at[0], 0, POOL.at[1]);
  g.rotation.y = Math.PI / 2;
  yardG.add(g);
  const moss = (x, z) => mossYard(...toYard(x, z)), topAt = (x, z) => topYard(...toYard(x, z));
  const inner = ring(0, 0.03), len = inner.len;
  // the inlet, on the far end's wall, in its middle
  const inletS = inner.reduce((b, p) => (Math.abs(p[0] - PCX) + Math.abs(p[1] - PZ0) < Math.abs(b[0] - PCX) + Math.abs(b[1] - PZ0) ? p : b))[4];
  const wallTex = T.poolWallTex(len, TOP - floor, TOP - water, [[inletS, 0.32]]);
  {
    const pos = [], nor = [], uv = [], idx = [], n = inner.length;
    for (let i = 0; i <= n; i++) {
      const [x, z, nx, nz, s] = inner[i % n], ss = i === n ? len : s;
      for (const y of [TOP, floor]) { pos.push(x, y, z); nor.push(-nx, 0, -nz); uv.push(ss / len, 1 - (TOP - y) / (TOP - floor)); }
    }
    for (let i = 0; i < n; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const wall = new THREE.Mesh(geo, std({ map: wallTex, roughness: 0.9, side: THREE.FrontSide }));
    // (which way round its triangles go: facing in)
    const tri = new THREE.Triangle(new THREE.Vector3(...pos.slice(0, 3)), new THREE.Vector3(...pos.slice(6, 9)), new THREE.Vector3(...pos.slice(3, 6)));
    if (tri.getNormal(new THREE.Vector3()).dot(new THREE.Vector3(nor[0], 0, nor[2])) < 0) { for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]]; geo.setIndex(idx); }
    wall.receiveShadow = wall.castShadow = true;
    g.add(wall);
  }
  // the inlet: a ring in the wall, dark inside, rust run down from it (in the wall's picture)
  {
    const p = inner.find((q) => q[4] >= inletS), [x, z, nx, nz] = p, y = TOP - 0.32;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 8, 22), std({ color: 0xb8b2a2, roughness: 0.6 }));
    rim.position.set(x - nx * 0.004, y, z - nz * 0.004);
    rim.lookAt(x - nx, y, z - nz);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 18), std({ color: 0x14140f, roughness: 1 }));
    hole.position.set(x - nx * 0.002, y, z - nz * 0.002);
    hole.lookAt(x - nx, y, z - nz);
    for (const m of [rim, hole]) { m.receiveShadow = true; g.add(m); }
  }
  // the coping, stone by stone
  const pieces = [];
  for (let s = 0, k = 0; s < len - 0.08; k++) {
    const p = inner.find((q) => q[4] >= s) ?? inner[0], curved = Math.abs(p[2]) > 0.05 && Math.abs(p[3]) > 0.05 || (p[1] < POOL.zc - 0.01);
    const l = curved ? 0.3 + r() * 0.06 : 0.46 + r() * 0.14, gap = 0.006 + r() * 0.007;
    pieces.push([s, Math.min(len - gap, s + l)]);
    s += l + gap;
  }
  const westMid = inner.reduce((b, q) => (q[2] < -0.9 && Math.abs(q[1] - (POOL.z1 + POOL.zc) / 2) < Math.abs(b[1] - (POOL.z1 + POOL.zc) / 2) ? q : b), inner[0])[4];
  const gone = pieces.findIndex(([a, b]) => westMid >= a && westMid <= b);
  const cracked = pieces.findIndex(([a, b]) => a > 4.5 && b - a > 0.45); // (on the east side)
  const prof = [[0.0, -0.045], [-0.03, -0.045], [-0.04, -0.034], [-0.046, -0.018], [-0.045, -0.002], [-0.039, 0.008], [-0.027, 0.0135], [-0.01, 0.015], [0.06, 0.0155], [0.2, 0.015], [0.282, 0.0135], [0.296, 0.009], [0.301, 0.0], [0.302, -0.045]];
  const at = (s) => { // the inside edge at s round: x, z, nx, nz
    let i = inner.findIndex((q) => q[4] > s);
    if (i < 0) i = inner.length;
    const a = inner[(i - 1 + inner.length) % inner.length], b = inner[i % inner.length], sb = i === inner.length ? len : b[4], k = clamp((s - a[4]) / Math.max(1e-6, sb - a[4]), 0, 1);
    const nx = a[2] + (b[2] - a[2]) * k, nz = a[3] + (b[3] - a[3]) * k, nl = Math.hypot(nx, nz);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, nx / nl, nz / nl];
  };
  const out = { pos: [], nor: [], uv: [], moss: [], col: [], idx: [] };
  const fallen = [];
  const piece = (s0, s1, { dy = 0, tilt = 0, chips = [], into = out } = {}) => {
    const n = Math.max(2, Math.ceil((s1 - s0) / 0.03)), P = prof.length, base = into.pos.length / 3, tint = 0.86 + r() * 0.2;
    for (let i = 0; i <= n; i++) {
      const t = i / n, s = s0 + (s1 - s0) * t, [x, z, nx, nz] = at(s);
      for (let k = 0; k < P; k++) {
        let [o, y] = prof[k];
        if (k >= 1 && k <= 7) for (const [tc, w, d] of chips) { const f = Math.max(0, 1 - Math.abs(t - tc) / w); y -= d * f * (k >= 3 ? 1 : 0.4); o += d * 1.4 * f * (k <= 5 ? 1 : 0.3); } // its nose knocked off here and there
        y += dy + tilt * (t - 0.5) + (k >= 4 && k <= 11 ? 0.0012 * Math.sin(s * 37 + k) : 0);
        const p = new THREE.Vector3(x + nx * o, y, z + nz * o);
        into.pos.push(p.x, p.y, p.z);
        into.uv.push(s / 0.5, (o + y) / 0.5);
        const joint = Math.min(t, 1 - t) * (s1 - s0) < 0.025 ? 0.35 : 0;
        into.moss.push(clamp(moss(x, z) * 0.75 + S(o, 0.22, 0.3) * 0.35 + joint, 0, 1));
        into.col.push(tint, tint * 0.99, tint * 0.96);
      }
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < P - 1; k++) {
      const a = base + i * P + k, b = a + 1, c = a + P, d = c + 1;
      into.idx.push(a, b, c, b, d, c);
    }
    for (const [i, flip] of [[0, true], [n, false]]) { // its ends
      const c0 = into.pos.length / 3;
      for (let k = 0; k < P; k++) { const j = (base + i * P + k) * 3; into.pos.push(into.pos[j], into.pos[j + 1], into.pos[j + 2]); into.uv.push(prof[k][0] / 0.5, prof[k][1] / 0.5); into.moss.push(0.4); into.col.push(tint * 0.95, tint * 0.94, tint * 0.9); }
      for (let k = 1; k < P - 1; k++) flip ? into.idx.push(c0, c0 + k + 1, c0 + k) : into.idx.push(c0, c0 + k, c0 + k + 1);
    }
  };
  pieces.forEach(([s0, s1], i) => {
    if (i === gone) return;
    const chips = [];
    for (let c = 0; c < 3; c++) if (r() < 0.32) chips.push([r(), 0.06 + r() * 0.14, 0.004 + r() * 0.008]);
    const dy = (r() - 0.6) * 0.004, tilt = (r() - 0.5) * 0.004;
    if (i === cracked) { // cracked across, the two halves gone a little apart, one sunk
      const m = s0 + (s1 - s0) * (0.4 + r() * 0.2);
      piece(s0, m - 0.002, { dy, tilt, chips });
      piece(m + 0.002, s1, { dy: dy - 0.004, tilt: tilt + 0.003, chips: [] });
    } else piece(s0, s1, { dy, tilt, chips });
  });
  const cope = meshFrom(out, mossy(std({ map: stoneMap, roughness: 0.86, vertexColors: true }), mossNoise, 'coping'));
  g.add(cope);
  // where the one has gone: its mortar bed, cracked, dirt and moss in it; and the stone itself, on the paving to the
  // west, broken in two (lifted out and dropped there, years ago)
  {
    const [s0, s1] = pieces[gone], bed = { pos: [], nor: [], uv: [], moss: [], col: [], idx: [] };
    const n = 8, base = 0;
    for (let i = 0; i <= n; i++) {
      const [x, z, nx, nz] = at(s0 - 0.004 + (s1 - s0 + 0.008) * (i / n));
      for (const o of [0, 0.3]) { bed.pos.push(x + nx * o, TOP + 0.003 + (o ? -0.006 : 0), z + nz * o); bed.uv.push(i * 0.1, o * 2); bed.moss.push(o ? 0.9 : 0.5); bed.col.push(0.62, 0.6, 0.56); }
    }
    for (let i = 0; i < n; i++) { const a = base + i * 2; bed.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.add(meshFrom(bed, mossy(std({ map: stoneMap, roughness: 1, vertexColors: true }), mossNoise, 'coping')));
    const [x, z, nx, nz] = at((s0 + s1) / 2), half = (s1 - s0) / 2;
    for (const [k, a, b] of [[0, -half, -0.02], [1, 0.01, half]]) { // the two halves, lying askew, one on the other's edge
      const piecesOut = { pos: [], nor: [], uv: [], moss: [], col: [], idx: [] };
      piece((s0 + s1) / 2 + a, (s0 + s1) / 2 + b, { into: piecesOut, chips: [[0.5, 0.4, 0.008]] });
      // lift it off the ring and lay it on the ground, out to the west of where it was
      const P = piecesOut.pos, c = new THREE.Vector3();
      for (let i = 0; i < P.length; i += 3) c.add(new THREE.Vector3(P[i], 0, P[i + 2]));
      c.divideScalar(P.length / 3);
      const xf = new THREE.Matrix4().makeTranslation(x + nx * (0.85 + k * 0.3) + k * 0.05, 0.046 + (k ? 0.02 : 0), z + nz * 0.3 + (k ? 0.22 : -0.05))
        .multiply(new THREE.Matrix4().makeRotationY(0.6 + k * 1.1)).multiply(new THREE.Matrix4().makeRotationZ(k ? 0.12 : 0)).multiply(new THREE.Matrix4().makeTranslation(-c.x, 0, -c.z));
      for (let i = 0; i < P.length; i += 3) { const v = new THREE.Vector3(P[i], P[i + 1], P[i + 2]).applyMatrix4(xf); P[i] = v.x; P[i + 1] = v.y; P[i + 2] = v.z; }
      let lift = 0; // (set down on the stones under it, not into them)
      for (let i = 0; i < P.length; i += 3) if (P[i + 1] < 0.03) lift = Math.max(lift, topAt(P[i], P[i + 2]) + 0.001 - P[i + 1]);
      for (let i = 1; i < P.length; i += 3) P[i] += lift;
      fallen.push(meshFrom(piecesOut, cope.material));
    }
    for (const f of fallen) g.add(f);
  }
  // the ladder's sockets: two rusted rims in the paving by the near end's east side, the ladder long gone
  {
    const rust = std({ map: T.rustyMetalTex(93), roughness: 0.8, metalness: 0.3 });
    for (const dz of [0, 0.52]) {
      const x = POOL.x1 + 0.37, z = POOL.z1 - 0.55 - dz;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 16).rotateX(Math.PI / 2), rust);
      rim.position.set(x, 0.002, z);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.026, 14).rotateX(-Math.PI / 2), std({ color: 0x15120d, roughness: 1 }));
      hole.position.set(x, 0.003, z);
      for (const m of [rim, hole]) { m.receiveShadow = true; g.add(m); }
    }
  }
  // the water: still, near black, a skin of duckweed in drifts
  const W = PR * 2, D = POOL.z1 - PZ0;
  const scum = (xm, ym) => {
    const x = POOL.x0 + xm, z = PZ0 + ym, d = Math.max(0, -sdLocal(x, z));
    const n = fbm(x * 1.4 + 5, z * 1.4 + 2, 0.7, 3), f = fbm(x * 5 + 1, z * 5 + 3, 0.2, 2);
    const g2 = fbm(x * 11 + 4, z * 11 + 9, 0.4, 2);
    return clamp(0.3 + (1 - S(d, 0.0, 0.8)) * 0.4 + (n - 0.5) * 0.9 + (f - 0.5) * 0.45 + (g2 - 0.5) * 0.3 + S(-z, -POOL.zc - 1, -PZ0) * 0.25, 0, 1);
  };
  const { map, rough } = T.poolWaterTex(W, D, scum);
  const shape = new THREE.Shape(ring(-0.001, 0.05).map(([x, z]) => new THREE.Vector2(x, -z)));
  const wgeo = new THREE.ShapeGeometry(shape, 4).rotateX(-Math.PI / 2);
  const wuv = wgeo.attributes.uv, wp = wgeo.attributes.position;
  for (let i = 0; i < wp.count; i++) wuv.setXY(i, (wp.getX(i) - POOL.x0) / W, 1 - (wp.getZ(i) - PZ0) / D);
  const surface = new THREE.Mesh(wgeo, std({ map, roughnessMap: rough, roughness: 1, envMap: M.yardEnv, envMapIntensity: 0.28 }));
  surface.position.y = water;
  surface.receiveShadow = true;
  g.add(surface);
  // what floats in it: a dead branch, a couple of sticks
  {
    const bark = std({ color: 0x3b3227, roughness: 1 }), rs = mulberry32(5551), sticks = [];
    for (const [x, z, a, l, rr] of [[0.3, 0.6, 0.7, 1.15, 0.018], [-1.3, 1.7, -0.4, 0.42, 0.008], [0.9, -3.6, 1.9, 0.55, 0.01]]) {
      const pts = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6 - 0.5; pts.push(new THREE.Vector3(x + Math.cos(a) * t * l + (rs() - 0.5) * 0.03, water - rr * 0.35, z + Math.sin(a) * t * l + (rs() - 0.5) * 0.03)); }
      sticks.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, rr, 6, false));
      if (l > 1) for (const t of [0.3, 0.62]) { // its twigs, half under
        const p = pts[Math.round(t * 6)], b = a + (rs() < 0.5 ? 0.8 : -0.8);
        sticks.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p, p.clone().add(new THREE.Vector3(Math.cos(b) * 0.18, 0.004, Math.sin(b) * 0.18)), p.clone().add(new THREE.Vector3(Math.cos(b + 0.3) * 0.32, -0.006, Math.sin(b + 0.3) * 0.32))]), 8, 0.005, 5, false));
      }
    }
    const m = new THREE.Mesh(mergeTubes(sticks), bark);
    m.receiveShadow = m.castShadow = true;
    g.add(m);
  }
  // in your way: the water (a box for the long part, a round for the round end), not the coping
  const [ax, az] = toYard(POOL.x1 - 0.04, POOL.zc - 0.04), [bx, bz] = toYard(POOL.x0 + 0.04, POOL.z1 - 0.04), [cx, cz] = toYard(PCX, POOL.zc);
  ctx.colliders.push({ type: 'box', x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz), hose: false });
  ctx.colliders.push({ type: 'seg', ax: cx, az: cz, bx: cx + 0.001, bz: cz, r: PR - 0.04, hose: false });
  return { len, pieces: pieces.length, gone, cracked, surface };
}

/** A mesh from arrays built here (positions, uvs, `moss`, vertex colours), its normals worked out. */
function meshFrom(o, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
  geo.setAttribute('aMoss', new THREE.Float32BufferAttribute(o.moss, 1));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
  geo.setIndex(o.idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  m.userData.live = true; // (kept out of the bake: it drops vertex colours and our own attributes)
  return m;
}
function mergeTubes(list) {
  const pos = [], nor = [], idx = [];
  let base = 0;
  for (const geo of list) {
    const p = geo.attributes.position, n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    for (let i = 0; i < geo.index.count; i++) idx.push(geo.index.getX(i) + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setIndex(idx);
  return out;
}

// ---------------------------------------------------------------- the iron table and chairs

/**
 * A wrought-iron bar along a smooth curve through `pts`, into `o`: its section `w` along `side` (made square to the
 * curve) by `h` the other way, a rounded rectangle, or round when `h` is 0 (`w` its diameter); `rust(p, up)`: how far
 * gone its paint is there (0 sound … 1 all rust).
 */
function bar(o, pts, w, h, side, rust, { closed = false, step = 0.012 } = {}) {
  const curve = pts.length > 2 || closed ? new THREE.CatmullRomCurve3(pts, closed, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
  const len = curve.getLength(), n = Math.max(1, Math.ceil(len / step));
  const sec = [];
  if (!h) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; sec.push([(Math.cos(a) * w) / 2, (Math.sin(a) * w) / 2, Math.cos(a), Math.sin(a)]); }
  else {
    const rr = Math.min(w, h) * 0.35;
    for (const [cx, cy, a0] of [[1, 1, 0], [-1, 1, Math.PI / 2], [-1, -1, Math.PI], [1, -1, Math.PI * 1.5]]) for (let j = 0; j <= 2; j++) {
      const a = a0 + (j / 2) * (Math.PI / 2);
      sec.push([cx * (w / 2 - rr) + Math.cos(a) * rr, cy * (h / 2 - rr) + Math.sin(a) * rr, Math.cos(a), Math.sin(a)]);
    }
  }
  const K = sec.length, base = o.pos.length / 3, B = new THREE.Vector3(), N = new THREE.Vector3(), sv = side.clone().normalize();
  for (let i = 0; i <= n; i++) {
    const t = i / n, P = curve.getPointAt(t), Tg = curve.getTangentAt(t);
    B.copy(sv).addScaledVector(Tg, -sv.dot(Tg));
    if (B.lengthSq() < 1e-6) B.set(0, 1, 0).addScaledVector(Tg, -Tg.y);
    B.normalize();
    N.crossVectors(Tg, B).normalize();
    for (let k = 0; k < K; k++) {
      const [sx, sy, nx, ny] = sec[k];
      o.pos.push(P.x + B.x * sx + N.x * sy, P.y + B.y * sx + N.y * sy, P.z + B.z * sx + N.z * sy);
      const nn = new THREE.Vector3().addScaledVector(B, nx).addScaledVector(N, ny).normalize();
      o.nor.push(nn.x, nn.y, nn.z);
      o.uv.push((t * len) / 0.25, k / K);
      o.rust.push(clamp(rust(P) + 0.18 * Math.max(0, nn.y), 0, 1)); // (where the rain sits on it, more)
    }
  }
  const rows = closed ? n : n;
  for (let i = 0; i < rows; i++) for (let k = 0; k < K; k++) {
    const a = base + i * K + k, b = base + i * K + ((k + 1) % K), c = a + K, d = b + K;
    o.idx.push(a, c, b, b, c, d);
  }
  if (!closed) for (const [i, sgn] of [[0, -1], [n, 1]]) { // its ends
    const Tg = curve.getTangentAt(i / n), P = curve.getPointAt(i / n), c0 = o.pos.length / 3;
    o.pos.push(P.x, P.y, P.z); o.nor.push(Tg.x * sgn, Tg.y * sgn, Tg.z * sgn); o.uv.push(0, 0); o.rust.push(clamp(rust(P) + 0.2, 0, 1));
    for (let k = 0; k < K; k++) { const j = (base + i * K + k) * 3; o.pos.push(o.pos[j], o.pos[j + 1], o.pos[j + 2]); o.nor.push(Tg.x * sgn, Tg.y * sgn, Tg.z * sgn); o.uv.push(sec[k][0] * 8, sec[k][1] * 8); o.rust.push(clamp(rust(P) + 0.2, 0, 1)); }
    for (let k = 0; k < K; k++) sgn > 0 ? o.idx.push(c0, c0 + 1 + k, c0 + 1 + ((k + 1) % K)) : o.idx.push(c0, c0 + 1 + ((k + 1) % K), c0 + 1 + k);
  }
}

/** The old cream paint on wrought iron, flaking off it where `aRust` says (ironPaintTex): rust under it, the paint's edge lifted dark round a flake. */
function ironMat() {
  const { paint, rust, flake } = T.ironPaintTex();
  const m = std({ map: paint, roughness: 0.74 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rustMap = { value: rust };
    sh.uniforms.flakeMap = { value: flake };
    sh.vertexShader = 'attribute float aRust;\nvarying float vRust;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRust = aRust;');
    sh.fragmentShader = 'uniform sampler2D rustMap;\nuniform sampler2D flakeMap;\nvarying float vRust;\nfloat rustK;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float fl = texture2D( flakeMap, vMapUv ).r;
        rustK = smoothstep( fl - 0.035, fl + 0.035, vRust * 0.85 + 0.08 );
        float lip = rustK * ( 1.0 - rustK ) * 4.0;
        vec3 rc = texture2D( rustMap, vMapUv * 1.3 ).rgb;
        diffuseColor.rgb = mix( diffuseColor.rgb * ( 1.0 - 0.4 * lip ), rc, rustK );`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix( roughnessFactor, 0.93, rustK );');
  };
  m.customProgramCacheKey = () => 'iron-paint';
  return m;
}
function ironMesh(o, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
  geo.setAttribute('aRust', new THREE.Float32BufferAttribute(o.rust, 1));
  geo.setIndex(o.idx);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  m.userData.live = true;
  return m;
}

/**
 * The set, after his photograph: an oval table of cast stone gone green-grey on a cream-painted iron base — four legs
 * of doubled C-scrolls curling out into scroll feet, a cross stretcher with a ring at its middle — and its chairs with
 * pointed lattice backs and arms sweeping down into the front legs, seats of grey boards. One chair drawn up to the
 * table, one pushed back and turned away, one knocked over on its back. All of it rusting from the feet up.
 */
function ironSet(g, ctx, topAt) {
  const mat = ironMat(), r = mulberry32(5901);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const noise = (p, s) => fbm(p.x * 9 + s, p.y * 9 + s * 2, p.z * 9, 2);
  // ---- the table
  {
    const o = { pos: [], nor: [], uv: [], rust: [], idx: [] }, rust = (p) => 0.3 + 0.6 * (1 - S(p.y, 0.0, 0.32)) + (noise(p, 1) - 0.5) * 0.6;
    const RX = 0.6, RZ = 0.425, TOPY = 0.712;
    const ell = [];
    for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; ell.push(V(Math.cos(a) * (RX - 0.07), TOPY - 0.018, Math.sin(a) * (RZ - 0.06))); }
    bar(o, ell, 0.03, 0.005, V(0, 1, 0), rust, { closed: true });
    for (let k = 0; k < 4; k++) {
      const th = Math.PI / 4 + (k * Math.PI) / 2, ex = Math.cos(th) * (RX - 0.07), ez = Math.sin(th) * (RZ - 0.06), rt = Math.hypot(ex, ez), d = V(ex / rt, 0, ez / rt), tg = V(-d.z, 0, d.x);
      const at = (rho, y, s = 0) => V(d.x * rho + tg.x * s, y, d.z * rho + tg.z * s);
      const leg = [[rt, TOPY - 0.03], [rt + 0.035, 0.62], [rt + 0.02, 0.5], [rt - 0.06, 0.37], [rt - 0.11, 0.24], [rt - 0.08, 0.1], [rt - 0.02, 0.035], [rt + 0.04, 0.016], [rt + 0.075, 0.032], [rt + 0.072, 0.062], [rt + 0.05, 0.058]];
      for (const s of [-0.012, 0.012]) bar(o, leg.map(([rho, y]) => at(rho, y, s)), 0.02, 0.006, tg, rust);
      for (const s of [-0.012, 0.012]) bar(o, [[rt - 0.005, TOPY - 0.04], [rt - 0.06, TOPY - 0.045], [rt - 0.1, 0.64], [rt - 0.09, 0.605], [rt - 0.065, 0.61], [rt - 0.07, 0.632]].map(([rho, y]) => at(rho, y, s)), 0.016, 0.005, tg, rust);
      for (const y of [0.56, 0.3, 0.12]) bar(o, [at(rho(leg, y) - 0.008, y, -0.022), at(rho(leg, y) - 0.008, y, 0.022)], 0.014, 0.012, d, rust); // collars binding the pair
      bar(o, [at(rt - 0.105, 0.22), at(0.05, 0.2)], 0.014, 0, V(0, 1, 0), rust); // the stretcher, to the ring
    }
    const ringO = new THREE.TorusGeometry(0.05, 0.007, 8, 28).rotateX(Math.PI / 2).translate(0, 0.2, 0);
    const P = ringO.attributes.position, Nn = ringO.attributes.normal, U = ringO.attributes.uv, base = o.pos.length / 3;
    for (let i = 0; i < P.count; i++) { o.pos.push(P.getX(i), P.getY(i), P.getZ(i)); o.nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i)); o.uv.push(U.getX(i) * 2, U.getY(i)); o.rust.push(0.55 + 0.3 * r()); }
    for (let i = 0; i < ringO.index.count; i++) o.idx.push(ringO.index.getX(i) + base);
    const base2 = ironMesh(o, mat);
    const topGeo = new THREE.ExtrudeGeometry(new THREE.Shape(new THREE.EllipseCurve(0, 0, RX, RZ, 0, Math.PI * 2).getPoints(64)), { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.012, bevelSegments: 3, curveSegments: 64 });
    topGeo.rotateX(-Math.PI / 2).translate(0, TOPY - 0.0, 0);
    const tuv = topGeo.attributes.uv, tp = topGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) tuv.setXY(i, tp.getX(i) / (RX * 2) + 0.5, 0.5 - tp.getZ(i) / (RZ * 2));
    const top = new THREE.Mesh(topGeo, std({ map: T.tableTopTex(RX * 2, RZ * 2), roughness: 0.92 }));
    top.castShadow = top.receiveShadow = true;
    const table = new THREE.Group();
    table.add(base2, top);
    table.position.set(TABLE.x, 0, TABLE.z);
    table.rotation.set(0.006, 0.42, -0.01); // (not square to anything; standing a little out of true on the uneven paving)
    settle(table, topAt);
    g.add(table);
    ctx.colliders.push({ type: 'seg', ax: TABLE.x - Math.cos(0.42) * 0.22, az: TABLE.z + Math.sin(0.42) * 0.22, bx: TABLE.x + Math.cos(0.42) * 0.22, bz: TABLE.z - Math.sin(0.42) * 0.22, r: 0.42, top: 0.76, hose: false });
  }
  // ---- the chairs
  const seatMat = std({ map: T.oldTimberTex(false, false, true), color: 0x8e9286, roughness: 0.95 });
  const chair = (seed) => {
    const o = { pos: [], nor: [], uv: [], rust: [], idx: [] }, s0 = seed * 3.1;
    const rust = (p) => 0.3 + 0.6 * (1 - S(p.y, 0.0, 0.3)) + (noise(p, s0) - 0.5) * 0.65;
    const SY = 0.44, backZ = (y) => -0.205 - (y - 0.46) * 0.15, nb = V(0, 0.15, 1).normalize();
    const side = V(1, 0, 0);
    for (const sx of [-1, 1]) {
      bar(o, [V(sx * 0.234, SY, 0.2), V(sx * 0.238, 0.3, 0.212), V(sx * 0.246, 0.1, 0.228), V(sx * 0.25, 0.03, 0.245), V(sx * 0.25, 0.014, 0.272), V(sx * 0.25, 0.032, 0.292), V(sx * 0.25, 0.055, 0.282)], 0.014, 0.014, side, rust); // front leg, its foot curled
      bar(o, [V(sx * 0.218, 0.05, -0.322), V(sx * 0.218, 0.014, -0.305), V(sx * 0.214, 0.03, -0.28), V(sx * 0.208, 0.2, -0.245), V(sx * 0.2, SY, -0.205), V(sx * 0.2, 0.62, backZ(0.62)), V(sx * 0.2, 0.84, backZ(0.84))], 0.014, 0.014, side, rust); // back leg and up into the back
      bar(o, [V(sx * 0.2, 0.655, backZ(0.655) + 0.004), V(sx * 0.214, 0.662, -0.12), V(sx * 0.235, 0.658, 0.05), V(sx * 0.246, 0.628, 0.15), V(sx * 0.246, 0.56, 0.2), V(sx * 0.24, 0.49, 0.212), V(sx * 0.236, SY + 0.012, 0.206)], 0.022, 0.006, side, rust); // the arm, sweeping down into the front leg
      bar(o, [V(sx * 0.246, 0.6, 0.186), V(sx * 0.258, 0.62, 0.214), V(sx * 0.262, 0.6, 0.238), V(sx * 0.258, 0.576, 0.226), V(sx * 0.252, 0.586, 0.21)], 0.016, 0.005, side, rust); // the scroll at its front
      bar(o, [V(sx * 0.243, 0.14, 0.224), V(sx * 0.226, 0.135, 0.0), V(sx * 0.21, 0.14, -0.248)], 0.01, 0, V(0, 1, 0), rust); // a stretcher low between the legs
    }
    bar(o, [V(-0.234, SY, 0.2), V(0, SY, 0.205), V(0.234, SY, 0.2), V(0.2, SY, -0.205), V(0, SY, -0.205), V(-0.2, SY, -0.205)], 0.025, 0.006, V(0, 1, 0), rust, { closed: true }); // the seat's frame
    for (const sx of [-0.11, 0.11]) bar(o, [V(sx, SY - 0.012, 0.2), V(sx, SY - 0.012, -0.2)], 0.025, 0.005, V(1, 0, 0), rust); // and under its boards
    // the back: its pointed top, and the lattice in it, the uprights a little in front of the cross bars
    const arch = [];
    for (let k = 0; k <= 16; k++) { const x = -0.2 + (k / 16) * 0.4, ax = Math.abs(x), y = ax > 0.19 ? 0.84 + (0.2 - ax) * 4 : 0.88 + 0.04 * Math.cos((ax / 0.19) * Math.PI * 0.5) + 0.065 * Math.max(0, 1 - ax / 0.07) ** 1.6; arch.push(V(x, y, backZ(y))); }
    arch[0].y = 0.84; arch[16].y = 0.84;
    bar(o, arch, 0.006, 0.02, nb, rust);
    const topAtX = (x) => { let best = arch[0]; for (const p of arch) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p; return best.y; };
    for (const x of [-0.1, 0, 0.1]) { const y1 = topAtX(x) - 0.006; bar(o, [V(x, SY + 0.012, backZ(SY + 0.012)).addScaledVector(nb, 0.0016), V(x, y1, backZ(y1)).addScaledVector(nb, 0.0016)], 0.004, 0.014, nb, rust); }
    for (const y of [0.54, 0.64, 0.74, 0.84]) { const x1 = y < 0.84 ? 0.2 : 0.196; bar(o, [V(-x1, y, backZ(y)).addScaledVector(nb, -0.0016), V(x1, y, backZ(y)).addScaledVector(nb, -0.0016)], 0.004, 0.014, nb, rust); }
    const mesh = new THREE.Group();
    mesh.add(ironMesh(o, mat));
    // the seat's boards, grey, split, one gone short
    for (const [z, w, short] of [[0.135, 0.12, 0], [0.0, 0.125, seed === 2 ? 0.12 : 0], [-0.135, 0.12, 0]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.4 - short, 0.02, w - 0.008), seatMat);
      b.position.set(short / 2, SY + 0.004, z);
      b.rotation.y = (r() - 0.5) * 0.02;
      b.castShadow = b.receiveShadow = true;
      mesh.add(b);
    }
    return mesh;
  };
  const chairs = [];
  // [x, z, facing (its front towards), on its back?]: drawn up to the table's far side; pushed back and turned away
  // towards the pool; knocked over on its back between the table and the wood
  for (const [k, x, z, yaw, down] of [[0, TABLE.x - 0.86, TABLE.z - 0.1, Math.PI / 2 + 0.25, false], [1, TABLE.x + 0.95, TABLE.z + 0.45, 2.2, false], [2, TABLE.x - 0.55, TABLE.z - 1.0, 0.6, true]]) {
    const c = chair(k + 1);
    const holder = new THREE.Group();
    holder.add(c);
    if (down) c.rotation.set(-Math.PI / 2 + 0.2, 0, 0.05); // on its back: the top of its back and its back legs' feet on the ground, its front legs in the air
    holder.position.set(x, 0, z);
    holder.rotation.y = yaw;
    if (!down) holder.rotation.z = (r() - 0.5) * 0.02;
    settle(holder, topAt);
    g.add(holder);
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    if (down) ctx.colliders.push({ type: 'seg', ax: x + sn * 0.2, az: z + cs * 0.2, bx: x - sn * 0.85, bz: z - cs * 0.85, r: 0.28, top: 0.6, hose: false });
    else ctx.colliders.push({ type: 'seg', ax: x - sn * 0.2, az: z - cs * 0.2, bx: x + sn * 0.2, bz: z + cs * 0.2, r: 0.26, top: 0.98, hose: false });
    chairs.push(holder);
  }
  return { chairs };
}
/**
 * Sets a thing down on what is under it: raised or lowered so that its lowest point anywhere just touches the stones or
 * the ground there, and nothing of it goes into them.
 */
function settle(obj, topAt) {
  obj.updateMatrixWorld(true);
  let lift = -Infinity;
  const v = new THREE.Vector3();
  obj.traverse((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
      if (v.y - obj.position.y < 0.08) lift = Math.max(lift, topAt(v.x, v.z) + 0.001 - v.y);
    }
  });
  obj.position.y += lift;
}
/** How far out a leg's path is at height y (its first point down past it). */
function rho(leg, y) { for (let i = 1; i < leg.length; i++) if (leg[i][1] <= y) { const [a, ya] = leg[i - 1], [b, yb] = leg[i]; return a + (b - a) * ((ya - y) / (ya - yb)); } return leg[leg.length - 1][0]; }

// ---------------------------------------------------------------- the angel

/**
 * The stone angel (after his photograph, its shape and its state): a figure in a long robe falling in folds to its
 * feet, a cord at the waist, hands together at its breast, head bowed, hair to its shoulders, its wings raised behind
 * it, their long feathers down to its calves; stood on a plinth that has settled a little crooked in the soft ground.
 * Carved, then weathered for decades: its face worn nearly smooth, grime run down it in streaks, green in its hollows,
 * moss at its foot. Worked out as a distance field and its surface found cell by cell (surface nets).
 */
function stoneAngel(g, ctx, mossNoise) {
  const H0 = ANGEL.plinth;
  const hypot = (a, b, c = 0) => Math.sqrt(a * a + b * b + c * c); // (Math.hypot is several times slower, and this is called a million times)
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const seg = (px, py, pz, ax, ay, az, bx, by, bz) => { const pax = px - ax, pay = py - ay, paz = pz - az, bax = bx - ax, bay = by - ay, baz = bz - az, h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1); return [hypot(pax - bax * h, pay - bay * h, paz - baz * h), h]; };
  const cone = (px, py, pz, a, b, r1, r2) => { const [d, h] = seg(px, py, pz, ...a, ...b); return d - (r1 + (r2 - r1) * h); };
  const ell = (px, py, pz, rx, ry, rz) => { const k0 = hypot(px / rx, py / ry, pz / rz), k1 = hypot(px / (rx * rx), py / (ry * ry), pz / (rz * rz)); return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz); };
  // the head: bowed forward and down
  const HC = [0, 1.085, 0.05], HP = -0.5, cp = Math.cos(HP), sp = Math.sin(HP);
  // each wing in its own frame: from the shoulder blade, back and out (a), up (b), through (w)
  const wings = [-1, 1].map((sx) => {
    const R = new THREE.Vector3(sx * 0.07, 0.9, -0.07), A = new THREE.Vector3(sx * 1.35, 0.1, -1).normalize(), B0 = new THREE.Vector3(0, 1, -0.1);
    const B = B0.addScaledVector(A, -B0.dot(A)).normalize(), Wd = new THREE.Vector3().crossVectors(A, B).normalize();
    return { R, A, B, W: Wd };
  });
  const feathers = []; // [a0, b0, a1, b1, r0, r1, layer]
  feathers.push([0.0, 0.02, 0.2, 0.5, 0.032, 0.028, 0], [0.2, 0.5, 0.31, 0.68, 0.028, 0.02, 0]); // its leading edge, the arm of it, to the tip over the head
  for (let i = 0; i < 7; i++) feathers.push([0.25 - 0.022 * i, 0.58 - 0.065 * i, 0.43 - 0.035 * i, -0.56 + 0.055 * i, 0.022, 0.034, 1 + i]); // the long flight feathers, fanning down
  for (let j = 0; j < 5; j++) feathers.push([0.12 - 0.022 * j, 0.38 - 0.06 * j, 0.2 - 0.03 * j, -0.2 + 0.05 * j, 0.026, 0.032, 8 + j]); // shorter ones towards the body
  const coverts = [];
  for (let row = 0; row < 4; row++) for (let k = 0; k < 6 - row; k++) coverts.push([0.035 + 0.038 * k + row * 0.022, 0.5 - 0.075 * row - 0.032 * k, 0.026, 0.055 - row * 0.004, 14 + row + (k % 2) * 0.5]);
  const wingD = (x, y, z, { R, A, B, W }, near) => { // (near: what is nearer already — a feather further off than that can't count)
    const px = x - R.x, py = y - R.y, pz = z - R.z, a = px * A.x + py * A.y + pz * A.z, b = px * B.x + py * B.y + pz * B.z;
    if (a < -0.1 || a > 0.5 || b < -0.72 || b > 0.76) return 1;
    let w = px * W.x + py * W.y + pz * W.z;
    if (Math.abs(w) > 0.25) return 1;
    w -= 0.32 * a * a - 0.05 * b; // cupped round the body, a little
    let d = 1;
    for (const [a0, b0, a1, b1, r0, r1, layer] of feathers) {
      const dx = a1 - a0, db = b1 - b0, ll = dx * dx + db * db, h = clamp(((a - a0) * dx + (b - b0) * db) / ll, 0, 1), bow = layer ? 0.025 * Math.sin(Math.PI * h) * Math.sqrt(ll) : 0;
      const d2 = hypot(a - a0 - dx * h - (db / Math.sqrt(ll)) * bow, b - b0 - db * h + (dx / Math.sqrt(ll)) * bow) - (r0 + (r1 - r0) * Math.min(1, h * 1.6)) * (h > 0.78 ? Math.max(0.15, 1 - (h - 0.78) * 3.2) : 1);
      if (d2 - 0.003 > Math.min(d, near) + 0.006) continue;
      const th = (layer ? 0.008 : 0.017) * (1 - 0.35 * h), ww = Math.abs(w - layer * 0.0042) - th;
      const e = hypot(Math.max(d2, 0), Math.max(ww, 0)) + Math.min(Math.max(d2, ww), 0) - 0.003;
      d = smin(d, e, 0.005);
    }
    for (const [ca, cb, rr, rl, layer] of coverts) {
      const d2 = hypot((a - ca) / rr, (b - cb) / rl) - 1, ww = Math.abs(w - layer * 0.0042) - 0.009;
      if (d2 * Math.min(rr, rl) - 0.003 > Math.min(d, near) + 0.007) continue;
      const e = hypot(Math.max(d2 * Math.min(rr, rl), 0), Math.max(ww, 0)) + Math.min(Math.max(d2 * Math.min(rr, rl), ww), 0) - 0.003;
      d = smin(d, e, 0.006);
    }
    return d;
  };
  const sdf = (x, y, z) => {
    const box = Math.max(Math.abs(x) - 0.25, y - 1.22, -0.05 - y, z - 0.25, -0.19 - z); // (all of the figure but its wings is in this box: well outside it, that is near enough its distance)
    let d = box > 0.04 ? box : body(x, y, z);
    if (z < 0.05 && y > 0.1) for (const w of wings) { const e = wingD(x, y, z, w, d + 0.03); if (e < d + 0.02) d = smin(d, e, 0.02); }
    return d;
  };
  const body = (x, y, z) => { // (each part only where it is near enough to count: a part further off than its blend can't change what is found)
    // the robe: falling straight from the waist, its folds deepening to the hem, flaring a little at the foot
    let d = y - 0.7;
    if (y < 0.8) {
      const t = clamp(y / 0.64, 0, 1), an = Math.atan2(x, z);
      const rad = 0.2 - 0.088 * t ** 0.9 + (y < 0.07 ? 0.014 * (1 - y / 0.07) ** 2 : 0);
      const fold = (0.012 * Math.sin(an * 7 + 0.5 * Math.sin(y * 5)) + 0.006 * Math.sin(an * 12 + 1.7 + y * 3)) * (1.15 - t);
      const sq = 0.8 + 0.1 * t;
      d = Math.max((hypot(x, z / sq) - rad - fold) * 0.85, -y - 0.03, y - 0.7);
    }
    // the feet, their toes out from under the hem
    if (y < 0.08 && z > 0.06) for (const sx of [-1, 1]) d = smin(d, ell(x - sx * 0.055, y - 0.02, z - 0.17, 0.034, 0.024, 0.055), 0.02);
    // the body under the robe: waist, chest, shoulders; the cord at the waist
    if (y > 0.52) d = smin(d, ell(x, y - 0.8, z + 0.005, 0.122, 0.2, 0.088), 0.06);
    if (y > 0.84 && y < 1.06) d = smin(d, cone(x, y, z, [-0.115, 0.945, -0.012], [0.115, 0.945, -0.012], 0.05, 0.05), 0.05);
    if (Math.abs(y - 0.64) < 0.03) d = smin(d, hypot(hypot(x, z / 0.85) - 0.112, y - 0.64) - 0.011, 0.012);
    // the neck, the head bowed, its face worn nearly smooth; the hair
    if (y > 0.88 && y < 1.11) d = smin(d, cone(x, y, z, [0, 0.95, 0.0], [0, 1.03, 0.03], 0.038, 0.034), 0.03);
    const hx = x - HC[0], hy0 = y - HC[1], hz0 = z - HC[2], hy = hy0 * cp - hz0 * sp, hz = hy0 * sp + hz0 * cp;
    if (Math.abs(hx) < 0.17 && Math.abs(hy) < 0.18 && Math.abs(hz) < 0.18) {
      let h = ell(hx, hy - 0.005, hz - 0.002, 0.07, 0.09, 0.08); // the skull
      h = smin(h, ell(hx, hy + 0.035, hz - 0.03, 0.05, 0.054, 0.05), 0.03); // the jaw and the cheeks, forward of it
      h = smin(h, ell(hx, hy + 0.068, hz - 0.052, 0.025, 0.021, 0.025), 0.018); // the chin
      h = smin(h, cone(hx, hy, hz, [-0.033, 0.023, 0.066], [0.033, 0.023, 0.066], 0.012, 0.012), 0.016); // the brow
      for (const sx of [-1, 1]) {
        h = -smin(-h, ell(hx - sx * 0.026, hy - 0.004, hz - 0.08, 0.018, 0.011, 0.012), 0.008); // the eye's hollow under it
        h = smin(h, ell(hx - sx * 0.026, hy - 0.002, hz - 0.07, 0.014, 0.0085, 0.009), 0.004); // the lid, shut, swelling in it
      }
      h = smin(h, cone(hx, hy, hz, [0, 0.012, 0.077], [0, -0.026, 0.091], 0.009, 0.013), 0.01); // the nose
      h = smin(h, ell(hx, hy + 0.045, hz - 0.079, 0.016, 0.0065, 0.008), 0.006); // the lips
      // the hair over the crown, parted, falling in waves either side of the face to the shoulders; off the face
      const hair = ell(hx, hy - 0.022, hz + 0.016, 0.08, 0.092, 0.086) - 0.004 * Math.sin(Math.atan2(hx, -hz) * 10 + hy * 45);
      h = smin(h, Math.max(hair, -(hz - 0.035 + hy * 0.25)), 0.01);
      for (const sx of [-1, 1]) h = smin(h, cone(hx, hy, hz, [sx * 0.056, 0.05, 0.03], [sx * 0.074, -0.075, -0.008], 0.021, 0.028) - 0.003 * Math.sin(hy * 70), 0.014); // a lock framing the face
      h = -smin(-h, hypot(hx * 2.2, hy - 0.098, Math.max(0, hz - 0.03) * 0.5) - 0.006, 0.006); // the parting
      d = smin(d, h, 0.02);
    }
    if (y > 0.85 && y < 1.13 && z < 0.0) for (const sx of [-1, 1]) d = smin(d, cone(x, y, z, [sx * 0.04, 1.06, -0.05], [sx * 0.07, 0.92, -0.07], 0.03, 0.038), 0.025); // the hair down to the shoulders
    // the arms, in wide sleeves, the hands together at the breast
    if (y > 0.6 && y < 1.03) for (const sx of [-1, 1]) {
      d = smin(d, cone(x, y, z, [sx * 0.14, 0.93, -0.005], [sx * 0.17, 0.745, 0.02], 0.038, 0.042), 0.025);
      d = smin(d, cone(x, y, z, [sx * 0.17, 0.745, 0.02], [sx * 0.04, 0.85, 0.105], 0.044, 0.05), 0.022);
      if (y < 0.82) d = smin(d, ell(x - sx * 0.115, y - 0.735, z - 0.06, 0.038, 0.058, 0.034), 0.02); // the sleeve hanging
      if (z > 0.06 && Math.abs(x) < 0.06 && y > 0.82) {
        const hy = (y - 0.905) * 0.94 - (z - 0.128) * 0.34, hz = (y - 0.905) * 0.34 + (z - 0.128) * 0.94; // (leaning forward)
        d = smin(d, ell(x - sx * 0.011, hy, hz, 0.0135, 0.058, 0.021), 0.005); // a hand, palm to palm
      }
    }
    return d;
  };
  // ---- its surface: the field on a coarse grid first, then finely only in the coarse cells the surface may pass
  // through (a cell whose corners are all further from it than its own size can't hold any of it)
  const t0 = performance.now(), C = 0.0075, X0 = -0.56, X1 = 0.56, Y0 = -0.035, Y1 = 1.72, Z0 = -0.5, Z1 = 0.27;
  const nx = Math.ceil((X1 - X0) / C) + 1, ny = Math.ceil((Y1 - Y0) / C) + 1, nz = Math.ceil((Z1 - Z0) / C) + 1;
  const F = new Float32Array(nx * ny * nz).fill(1), done = new Uint8Array(nx * ny * nz), id = (i, j, k) => (k * ny + j) * nx + i;
  const CO = 4, ccx = Math.ceil((nx - 1) / CO), ccy = Math.ceil((ny - 1) / CO), ccz = Math.ceil((nz - 1) / CO), CS = CO * C;
  const coarse = new Float32Array((ccx + 1) * (ccy + 1) * (ccz + 1)), cid = (i, j, k) => (k * (ccy + 1) + j) * (ccx + 1) + i;
  for (let k = 0; k <= ccz; k++) for (let j = 0; j <= ccy; j++) for (let i = 0; i <= ccx; i++) coarse[cid(i, j, k)] = sdf(X0 + i * CS, Y0 + j * CS, Z0 + k * CS);
  const T1 = performance.now(), active = [];
  let evals = 0;
  for (let ck = 0; ck < ccz; ck++) for (let cj = 0; cj < ccy; cj++) for (let ci = 0; ci < ccx; ci++) {
    let mn = Infinity, mx = -Infinity;
    for (let c = 0; c < 8; c++) { const v = coarse[cid(ci + (c & 1), cj + ((c >> 1) & 1), ck + (c >> 2))]; mn = Math.min(mn, v); mx = Math.max(mx, v); }
    let near = Infinity;
    for (let c = 0; c < 8; c++) near = Math.min(near, Math.abs(coarse[cid(ci + (c & 1), cj + ((c >> 1) & 1), ck + (c >> 2))]));
    if (mn > CS * 0.87) continue; // (all outside: as it is, 1; no corner is near enough for the surface to pass through it)
    const i0 = ci * CO, j0 = cj * CO, k0 = ck * CO, i1 = Math.min(i0 + CO, nx - 1), j1 = Math.min(j0 + CO, ny - 1), k1 = Math.min(k0 + CO, nz - 1);
    if (mx < 0 && near > CS * 0.87) { for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!done[id(i, j, k)]) F[id(i, j, k)] = -1; continue; }
    active.push([i0, j0, k0, i1, j1, k1]);
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const n = id(i, j, k);
      if (done[n]) continue;
      F[n] = sdf(X0 + i * C, Y0 + j * C, Z0 + k * C);
      done[n] = 1;
      evals++;
    }
  }
  const T2 = performance.now();
  // surface nets: a point in every cell the surface goes through, a quad across every edge it cuts
  const vid = new Int32Array(nx * ny * nz).fill(-1), P = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (const [i0, j0, k0, i1, j1, k1] of active) for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { v[c] = F[id(i + corner[c][0], j + corner[c][1], k + corner[c][2])]; if (v[c] < 0) neg++; }
    if (!neg || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]), ca = corner[a], cb = corner[b];
      sx += ca[0] + (cb[0] - ca[0]) * t; sy += ca[1] + (cb[1] - ca[1]) * t; sz += ca[2] + (cb[2] - ca[2]) * t; n++;
    }
    vid[id(i, j, k)] = P.length / 3;
    P.push(X0 + (i + sx / n) * C, Y0 + (j + sy / n) * C, Z0 + (k + sz / n) * C);
  }
  const idx = [], around = [[1, 0, 0, [[0, -1, 0], [0, -1, -1], [0, 0, -1]]], [0, 1, 0, [[0, 0, -1], [-1, 0, -1], [-1, 0, 0]]], [0, 0, 1, [[-1, 0, 0], [-1, -1, 0], [0, -1, 0]]]];
  for (const [i0, j0, k0, i1, j1, k1] of active) for (let k = Math.max(1, k0); k < k1; k++) for (let j = Math.max(1, j0); j < j1; j++) for (let i = Math.max(1, i0); i < i1; i++) {
    const v0 = F[id(i, j, k)];
    for (const [di, dj, dk, q] of around) {
      const v1 = F[id(i + di, j + dj, k + dk)];
      if ((v0 < 0) === (v1 < 0)) continue;
      const a = vid[id(i, j, k)], b = vid[id(i + q[0][0], j + q[0][1], k + q[0][2])], c = vid[id(i + q[1][0], j + q[1][1], k + q[1][2])], d = vid[id(i + q[2][0], j + q[2][1], k + q[2][2])];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      if (v0 < 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
    }
  }
  // normals from the field (read off the grid); the weather: dark in the hollows, grime run down it in streaks, green low down
  const at = (x, y, z) => {
    const fx = (x - X0) / C, fy = (y - Y0) / C, fz = (z - Z0) / C, i = clamp(Math.floor(fx), 0, nx - 2), j = clamp(Math.floor(fy), 0, ny - 2), k = clamp(Math.floor(fz), 0, nz - 2), u = fx - i, w2 = fy - j, t = fz - k;
    const c = (a, b, e) => F[id(i + a, j + b, k + e)];
    return (1 - t) * ((1 - w2) * ((1 - u) * c(0, 0, 0) + u * c(1, 0, 0)) + w2 * ((1 - u) * c(0, 1, 0) + u * c(1, 1, 0))) + t * ((1 - w2) * ((1 - u) * c(0, 0, 1) + u * c(1, 0, 1)) + w2 * ((1 - u) * c(0, 1, 1) + u * c(1, 1, 1)));
  };
  const T3 = performance.now(), N = [], col = [], mossA = [], e = C * 0.6;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2];
    const n = new THREE.Vector3(at(x + e, y, z) - at(x - e, y, z), at(x, y + e, z) - at(x, y - e, z), at(x, y, z + e) - at(x, y, z - e)).normalize();
    N.push(n.x, n.y, n.z);
    const ao = clamp(1 - (0.012 - at(x + n.x * 0.012, y + n.y * 0.012, z + n.z * 0.012)) * 9 - (0.035 - Math.min(0.035, at(x + n.x * 0.035, y + n.y * 0.035, z + n.z * 0.035))) * 5, 0.35, 1);
    const streak = S(fbm(x * 14 + 3, y * 1.6, z * 14 + 7, 3), 0.5, 0.72) * (1 - Math.abs(n.y)) * 0.42;
    const grime = 0.12 * (1 - S(y, 0.0, 0.5)) + 0.1 * S(-n.y, 0.2, 0.8);
    const k = ao * (1 - streak) * (1 - grime);
    const green = (1 - ao) * 0.6 + (1 - S(y, 0.0, 0.3)) * 0.4;
    col.push(k * (1 - 0.1 * green), k * (1 - 0.02 * green), k * (1 - 0.16 * green));
    mossA.push(clamp(0.72 * (1 - S(y, 0.02, 0.24)) + 0.35 * (1 - ao) + 0.12, 0, 1));
  }
  { // (the quads' winding, one way or the other: turned to face the way the field says is out)
    let agree = 0;
    for (let t = 0; t < idx.length; t += 3 * 97) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map((k) => new THREE.Vector3(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]));
      const fn = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
      agree += Math.sign(fn.dot(new THREE.Vector3(N[idx[t] * 3], N[idx[t] * 3 + 1], N[idx[t] * 3 + 2])));
    }
    if (agree < 0) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aMoss', new THREE.Float32BufferAttribute(mossA, 1));
  geo.setIndex(idx);
  const stone = T.pavingStoneTex(true);
  const figure = new THREE.Mesh(geo, mossy(std({ color: 0xd2cdc0, roughness: 0.92, vertexColors: true }), mossNoise, 'angel', { tri: stone }));
  figure.castShadow = figure.receiveShadow = true;
  figure.userData.live = true;
  figure.position.y = H0;
  // the plinth: a moulded base, the die, a cap; settled a little out of true
  const plinth = new THREE.Group(), pm = mossy(std({ map: stone, color: 0xbab5a8, roughness: 0.93 }), mossNoise, 'plinth');
  for (const [w, y0, y1] of [[0.54, -0.04, 0.1], [0.42, 0.1, 0.3], [0.5, 0.3, H0]]) {
    const b = new THREE.BoxGeometry(w, y1 - y0, w, 3, 3, 3), p = b.attributes.position, uv = b.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), q = Math.abs(p.getX(i)) > w / 2 - 1e-4 ? [z, y] : Math.abs(z) > w / 2 - 1e-4 ? [x, y] : [x, z]; uv.setXY(i, q[0] / 0.5 + 0.3 * y0, q[1] / 0.5 + y0); p.setXYZ(i, x * (1 + 0.012 * Math.sin(y * 30 + z * 20)), y, z * (1 + 0.012 * Math.sin(y * 24 + x * 26))); }
    b.translate(0, (y0 + y1) / 2, 0);
    b.computeVertexNormals();
    const pp = b.attributes.position, m = new Float32Array(pp.count);
    for (let i = 0; i < pp.count; i++) m[i] = clamp(0.85 * (1 - S(pp.getY(i), -0.02, 0.18)) + (pp.getY(i) > y1 - 0.002 ? 0.45 : 0.2), 0, 1);
    b.setAttribute('aMoss', new THREE.BufferAttribute(m, 1));
    const mesh = new THREE.Mesh(b, pm);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.live = true;
    plinth.add(mesh);
  }
  const holder = new THREE.Group();
  holder.add(plinth, figure);
  holder.position.set(ANGEL.x, -0.02, ANGEL.z);
  // facing the pool's near end, so it looks down over the water; the ground under it soft: it leans, a little
  holder.rotation.set(0.022, Math.atan2(POOL.at[0] - 1.6 - ANGEL.x, POOL.at[1] + 0.9 - ANGEL.z), -0.016, 'YXZ');
  g.add(holder);
  ctx.colliders.push({ type: 'seg', ax: ANGEL.x, az: ANGEL.z, bx: ANGEL.x + 0.001, bz: ANGEL.z, r: 0.36, hose: false });
  return { figure, verts: P.length / 3, tris: idx.length / 3, ms: Math.round(performance.now() - t0), parts: [T1 - t0, T2 - T1, T3 - T2, performance.now() - T3].map(Math.round), evals, active: active.length };
}
