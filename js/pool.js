// The end of the garden (user, 2026-10-29; laid out again 2026-11-01 after his sketch): past the grove the yard widens to the
// east, the leaf litter thinning over an old paving of stone setts, moss and grass in every joint. On the left a
// wrought-iron table and three chairs, one knocked over, lost in weeds; to the right of it, across the yard and on past
// where the old fence ran, a swimming pool nobody has seen to in years — its water stagnant and green with duckweed,
// leaves rotting in it, its render grey, its tiles coming off. At its far short end a stone angel faces down it
// (tools/bake-angel.mjs). Along all the fence, bushes gone wild, tall and thick, no two alike; past the fence trees, some
// of their crowns coming down over it. Damp, abandoned, quiet. Built in the yard's own frame (yard.js), after the grove.
import * as THREE from 'three';
import * as T from './textures.js';
import { mulberry32, fbm } from './util.js';
import { outsideTrees, leafCards } from './grove.js';

const S = THREE.MathUtils.smoothstep, clamp = THREE.MathUtils.clamp;
const std = (o) => new THREE.MeshStandardMaterial(o);

/** Where the old far fence stood: the wood's end, where the paving begins. */
export const END = -14.0;
/**
 * The pool (user, 2026-11-01: his sketch — long, across the yard; 2026-11-02: its west end a full half-round again, as it
 * was: "it was perfect like that"). Worked out in its own frame: x0…x1 across it, from its square end z1 (corners rounded
 * by `corner`) back to its round end at `tip` — a circle, radius `B` (as wide as the pool: a half-round; bigger, a shallower
 * bow, met by corners of radius `rc`) — and laid in the yard turned a quarter round, that frame's middle at `at`: its square
 * end east, its round end west, its x across the yard's z. `water`: its level; `cope`: the coping's width. 8.2 × 4.2 m inside.
 */
export const POOL = { x0: -2.1, x1: 2.1, z1: 4.1, tip: -4.1, B: 2.1, rc: 0.55, corner: 0.12, water: -0.55, floor: -0.9, cope: 0.3, at: [2.5, -18.4] };
const PR = (POOL.x1 - POOL.x0) / 2, PCX = 0, PZ0 = POOL.tip, ZB = POOL.tip + POOL.B, CX = PR - POOL.rc;
POOL.zc = ZB - Math.sqrt(Math.max(0, (POOL.B - POOL.rc) ** 2 - CX ** 2)); // (where the straight sides end, and the corners begin)
/** The pool's frame to the yard's: (x, z) → [x, z] (yard). */
const toYard = (lx, lz) => [lz + POOL.at[0], POOL.at[1] - lx];
/** The iron table (on the left, level with the pool, as he drew it) and the stone angel at the pool's far short end, facing down it. */
export const TABLE = { x: -3.5, z: -16.86 }; // (nine rows of the paving nearer the house than it first stood: user, 2026-11-02)
export const ANGEL = { x: 7.8, z: -18.4 };
/** Where the drowned flamingo's head comes up: in the far left of the water, seen from the wood (yard.js). */
export const DROWNED = { x: -0.15, z: -19.75 };
/** Bushes he'd see either side of the angel, as in his photograph: [x, z, half-width x, half-width z, height, flowers (0 none, 1 pink, 2 white)]. */
const BUSHES = [[8.1, -20.45, 0.62, 0.6, 1.5, 1], [8.0, -16.3, 0.58, 0.58, 1.35, 2]];
/** Low places where the rain stands on the paving: [x, z, rx, rz]. */
const PUDDLES = [[3.3, -15.25, 0.42, 0.26], [-2.3, -21.0, 0.34, 0.26], [7.45, -21.15, 0.3, 0.22]];

/** Signed distance in plan to the pool's inside edge (the yard's x, z): below 0 inside. */
export function sdPool(x, z) { return sdLocal(POOL.at[1] - z, x - POOL.at[0]); }
/** The same in the pool's own frame. */
function sdLocal(x, z) {
  const px = Math.abs(x), c = POOL.corner;
  if (z >= POOL.zc) {
    const qx = px - (PR - c), qz = z - (POOL.z1 - c);
    if (qx > 0 && qz > 0) return Math.hypot(qx, qz) - c;
    return Math.max(px - PR, z - POOL.z1);
  }
  if (px * (ZB - POOL.zc) > CX * (ZB - z)) return Math.hypot(px - CX, z - POOL.zc) - POOL.rc; // (past the ray through a corner's middle: that corner)
  return Math.hypot(px, z - ZB) - POOL.B;
}
/**
 * Round the pool's edge, `off` out from it (in, below 0), a point every `step` metres: [x, z, nx, nz (outwards), s (how
 * far round, along the inside edge)], from the near end's west corner, east along the near end, down the east side,
 * round the far end and back up the west side.
 */
function ring(off, step = 0.04) {
  const { x0, x1, z1, zc, corner: c, rc: r2, B } = POOL, rc = c + off, out = [], A = Math.atan2(zc - ZB, CX), A2 = -Math.PI - A;
  let s = 0;
  const line = (ax, az, bx, bz, nx, nz, l0) => { const n = Math.max(1, Math.ceil(l0 / step)); for (let i = 0; i < n; i++) { const t = i / n; out.push([ax + (bx - ax) * t, az + (bz - az) * t, nx, nz, s + l0 * t]); } s += l0; };
  const arc = (ox, oz, a0, a1, r0, rr) => { if (Math.abs(a1 - a0) < 1e-6) return; const l0 = Math.abs(a1 - a0) * r0, n = Math.max(2, Math.ceil(l0 / step)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([ox + Math.cos(a) * rr, oz + Math.sin(a) * rr, Math.cos(a), Math.sin(a), s + l0 * (i / n)]); } s += l0; };
  line(x0 + c, z1 + off, x1 - c, z1 + off, 0, 1, x1 - x0 - 2 * c);
  arc(x1 - c, z1 - c, Math.PI / 2, 0, c, rc);
  line(x1 + off, z1 - c, x1 + off, zc, 1, 0, z1 - c - zc);
  arc(CX, zc, 0, A, r2, r2 + off);
  arc(0, ZB, A, A2, B, B + off);
  arc(-CX, zc, A2, -Math.PI, r2, r2 + off);
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
  const Y = yard, r = mulberry32(5401), XW = Y.x2 - Y.x0;
  const dist = (x, z, ax, az) => Math.hypot(x - ax, z - az);
  const angelBox = { x0: ANGEL.x - 0.5, x1: ANGEL.x + 0.55, z0: ANGEL.z - 0.95, z1: ANGEL.z + 0.95, top: 2.2 };
  /** How far from the fence, out here (the old east side stops at the wood's end, its corner stands out). */
  const fenceD = (x, z) => Math.min(x - Y.x0, Y.x2 - x, z - Y.z0, x > Y.x1 ? END - z : Math.hypot(x - Y.x1, END - z));

  // ---- the lie of it: where there is paving, where the weeds have it, where it is damp, where the leaves lie
  const wild = (x, z) => { // round the table the weeds have taken the paving
    const n = fbm(x * 1.6 + 2, z * 1.6 + 8, 0.5, 2) - 0.5;
    return 1 - S(dist(x, z, TABLE.x, TABLE.z) * (1 + n * 0.5), 1.1, 2.3);
  };
  const bed = (x, z) => { // the soil along the fence, where the bushes have it, and round the angel's rocks: no paving
    const n = fbm(x * 2.1 + 5, z * 2.1 + 1, 0.5, 2) - 0.5;
    return Math.max(1 - S(fenceD(x, z) + n * 0.5, 0.7, 1.15), 1 - S(dist(x, z, ANGEL.x, ANGEL.z) + n * 0.2, 0.5, 0.72));
  };
  const paved = (x, z) => { // 1 whole paving … 0 none
    const n = fbm(x * 1.3 + 7, z * 1.3 + 3, 0.5, 3) - 0.5;
    const n2 = fbm(x * 3.7 + 1, z * 3.7 + 5, 0.5, 2) - 0.5;
    return S(-z + n * 2.0 + n2 * 0.6, 14.1, 15.7) * (1 - 0.75 * wild(x, z)) * (1 - bed(x, z));
  };
  const litter = (x, z) => { // last year's leaves: the wood's, fading out over the stones; under the corner trees; in drifts
    const n = fbm(x * 0.9 + 1, z * 0.9 + 6, 0.5, 3) - 0.5, fine = fbm(x * 3 + 4, z * 3 + 2, 0.5, 2) - 0.5;
    let k = 1 - S(-z + n * 2.0 + fine * 0.6, 14.2, 16.3);
    const sp = sdPool(x, z) - POOL.cope; // blown up against the coping, on the wood's side most
    if (sp > 0) k = Math.max(k, (0.35 + 0.35 * S(z, POOL.at[1] - PR, POOL.at[1] + PR)) * (1 - S(sp + fine * 0.15, 0.0, 0.3)) * S(fine, -0.25, 0.1));
    k = Math.max(k, 0.62 * (1 - S(fenceD(x, z) + fine * 0.3, 0.1, 1.2))); // against the fence and under the bushes, off the trees over it
    return clamp(k + fine * 0.2, 0, 1);
  };
  const moss = (x, z) => { // how damp and green: patchy, more by the fences, in the beds, at the far end, round the puddles
    const n = fbm(x * 0.8 + 9, z * 0.8 + 4, 0.5, 3), m2 = fbm(x * 2.7 + 3, z * 2.7 + 7, 0.5, 2);
    let k = 0.5 + (n - 0.5) * 1.1 + (m2 - 0.5) * 0.4;
    k += 0.3 * (1 - S(fenceD(x, z), 0.2, 1.4)) + 0.3 * bed(x, z) + 0.15 * S(-z, 19, 21.5);
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
  const GZ1 = END, GZ0 = Y.z0, groundTex = T.pavingGroundTex({ x0: Y.x0, x1: Y.x2, z0: GZ0, z1: GZ1 }, litter, moss);
  const groundY = (x, z) => { // the joints a little down, the litter level with the yard's, the beds a little up and lumpy
    const p = paved(x, z), b = bed(x, z);
    return -0.02 * S(p, 0.15, 0.6) + b * (0.012 + 0.02 * fbm(x * 3 + 1, z * 3 + 4, 0.5, 2)) - 0.012 * (1 - S(puddleAt(x, z), 0.8, 1.3));
  };
  {
    const SP = 0.08, nx = Math.round(XW / SP) + 1, nz = Math.round((GZ1 - GZ0) / SP) + 1, pos = [], uv = [], idx = [], inside = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = Y.x0 + (i / (nx - 1)) * XW, z = GZ0 + (j / (nz - 1)) * (GZ1 - GZ0);
      pos.push(x, j === nz - 1 ? 0 : groundY(x, z), z); // (meeting the yard's lawn at the wood's end)
      uv.push((x - Y.x0) / XW, 1 - (z - GZ0) / (GZ1 - GZ0));
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
  const setts = [[0.13, 0.12], [0.16, 0.125], [0.19, 0.13], [0.22, 0.13], [0.26, 0.135], [0.3, 0.14]].map(([l, d], i) => settGeo(l, d, 5300 + i)), WHOLE = setts.length;
  const placed = setts.map(() => []); // per shape: [x, y, z, yaw, tiltX, tiltZ, sx, sz, moss, tint, du, dv]
  const grid = new Map(), key = (x, z) => `${Math.floor(x / 0.3)},${Math.floor(z / 0.3)}`;
  const stones = [], holes = [], shattered = [], rm = mulberry32(5431), MARGIN = POOL.cope + 0.012;
  {
    const clear = (xa, xb, zq) => sdPool(xa, zq) >= MARGIN && sdPool(xb, zq) >= MARGIN && sdPool((xa + xb) / 2, zq) >= MARGIN;
    let z = END - 0.32;
    while (z > Y.z0 + 0.14) {
      const depth = 0.118 + r() * 0.026, joint = 0.008 + r() * 0.012;
      let x = Y.x0 + 0.13 + r() * 0.12;
      while (x < Y.x2 - 0.2) {
        let si = Math.floor(r() * WHOLE), len = setts[si].L * (0.92 + r() * 0.16), za = z, zb = z - depth;
        const gap = joint * (0.8 + r() * 0.6) + (r() < 0.04 ? 0.02 + r() * 0.04 : 0);
        // up against the coping (2026-11-02: a row that met it was left off along its whole length, a bare strip beside it):
        // a stone cut narrow to fit where its row runs along the coping, cut short where it runs into it
        if (!(clear(x, x + len, za) && clear(x, x + len, zb) && clear(x, x + len, (za + zb) / 2))) {
          const nearOk = clear(x, x + len, za), farOk = clear(x, x + len, zb);
          if (nearOk || farOk) {
            let lo = 0, hi = 1;
            for (let b = 0; b < 9; b++) { const m = (lo + hi) / 2, q = nearOk ? za + (zb - za) * m : zb + (za - zb) * m; if (clear(x, x + len, q)) lo = m; else hi = m; }
            if (nearOk) zb = za + (zb - za) * lo; else za = zb + (za - zb) * lo;
            if (za - zb < 0.04) { x += len + gap; continue; }
          } else {
            let e = x;
            const bandClear = (q) => sdPool(q, za) >= MARGIN && sdPool(q, zb) >= MARGIN && sdPool(q, (za + zb) / 2) >= MARGIN;
            while (e < x + len && bandClear(e)) e += 0.01;
            const room = e - x - 0.005;
            if (room < 0.07) { e = Math.max(e, x + 0.015); while (e < Y.x2 && !bandClear(e)) e += 0.015; x = e + 0.003; continue; }
            len = room;
            si = setts.slice(0, WHOLE).reduce((b, st, k) => (Math.abs(st.L - room) < Math.abs(setts[b].L - room) ? k : b), 0);
          }
        }
        const zc = (za + zb) / 2, dep = za - zb, cx = x + len / 2, jz = (r() - 0.5) * 0.008, k = paved(cx, zc) + (r() - 0.5) * 0.35;
        const yaw = (r() - 0.5) * 0.05, tx = (r() - 0.5) * 0.025, tz = (r() - 0.5) * 0.025, heave = r(), tint = r(), du = r(), dv = r();
        x += len + gap;
        if ((k < 0.45 && !(k > 0.12 && heave > 0.7 && tint > 0.55)) || cx > Y.x2 - 0.13) continue; // (and the odd one out in the leaves, ahead of the rest)
        if (dist(cx, zc, ANGEL.x, ANGEL.z) < 0.5 + len / 2) continue; // (its rocks)
        // here and there one gone (in twos and threes, as they go), here and there one broken in two (2026-11-02; their own dice)
        const fate = rm(), patch = fbm(cx * 2.3 + 9, zc * 2.3 + 2, 0.4, 2);
        if (fate < 0.045 + 0.13 * S(patch, 0.58, 0.72)) { holes.push([cx, zc, dep]); continue; }
        const broken = rm() < 0.075;
        // sunk where the paving fades out under the leaves, under the puddles; heaved here and there by roots and frost
        const sink = (k < 0.7 ? -0.016 * Math.min(1, (0.7 - k) / 0.4) : 0) + (puddleAt(cx, zc) < 1 ? -0.014 : 0);
        const lift = heave < 0.06 ? 0.006 + heave * 0.08 : 0;
        const y = -0.002 + (tint - 0.5) * 0.005 + sink + lift, big = heave < 0.06 ? 2.5 : 1;
        if (broken) shattered.push({ x: cx, y, z: zc + jz, len, dep, yaw, moss: moss(cx, zc), tint, du, dv });
        else placed[si].push([cx, y, zc + jz, yaw, tx * big, tz * big, len / setts[si].L, dep / setts[si].D, moss(cx, zc), tint, du, dv]);
        const st = { x: cx, z: zc + jz, hx: len / 2, hz: dep / 2, top: y + 0.002 };
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

  g.add(brokenStones(shattered, mossy(std({ map: stoneMap, roughness: 0.88, vertexColors: true }), mossNoise, 'paving-broken', { edge: true }), mulberry32(5441)));

  // ---- the puddles: rain standing in the low places — see-through at their edges, the sunk stones showing under them, the sky
  // faint in them (they were flat black, cut hard across the stones: user, 2026-11-02)
  PUDDLES.forEach(([px, pz, rx, rz], k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2.3, rz * 2.3).rotateX(-Math.PI / 2), std({ map: T.puddleTex(k), transparent: true, depthWrite: false, roughness: 0.14, envMap: M.yardEnv, envMapIntensity: 0.5 }));
    m.position.set(px, -0.007, pz);
    m.rotation.y = 0.4 + k * 1.7;
    m.receiveShadow = true;
    g.add(m);
  });

  // ---- the pool: its walls, its coping, its water
  const pool = buildPool(g, M, ctx, { moss, mossNoise, stoneMap, topAt, r: mulberry32(5501) });

  // ---- the iron table and its chairs, in the weeds
  const furniture = ironSet(g, ctx, topAt);

  // ---- the stone angel at the far short end, facing down the water
  const angel = marbleAngel(g, ctx, mossNoise);

  // ---- the trees outside the fence
  const trees = outsideTrees(g, ctx, { yard: Y, wire, under: [angelBox] });

  // ---- the bushes gone wild, all along the fence: tall and thick, no two alike, some big and some small, crowding
  // each other, here and there a gap where the boards show. Walked out along the fence with their own dice (each with its
  // own lump of dark inside, or you'd see the boards through them)
  const rb = mulberry32(5601), hedge = [...BUSHES];
  const legs = [[Y.x0, -14.9, 1, 0, 0, -1], [Y.x0, Y.z0, 0, 1, 1, 0], [Y.x2, Y.z0, -1, 0, 0, 1], [Y.x2, END, 0, -1, -1, 0]]; // [start, inward, along]
  const LEN = [-14.9 - Y.z0, XW, END - Y.z0, Y.x2 - Y.x1 - 0.35];
  legs.forEach(([ax, az, ix, iz, ux, uz], leg) => {
    for (let s0 = 0.1 + rb() * 0.4; s0 < LEN[leg];) {
      const big = rb(), along = 0.48 + big ** 1.5 * 0.85, deep = 0.45 + rb() * 0.42, h = 1.45 + big * 1.05 + rb() * 0.7, kind = rb(), gap = rb();
      const m = s0 + along * 0.8, off = deep * (0.75 + rb() * 0.35);
      const bx = ax + ux * m + ix * off, bz = az + uz * m + iz * off;
      // (by the table the bushes stay near the boards; behind the angel, the same)
      const tight = dist(bx, bz, TABLE.x, TABLE.z) < 2.0 || dist(bx, bz, ANGEL.x, ANGEL.z) < 1.5;
      const dp = tight ? Math.min(deep, 0.44) : deep, ox = tight ? 0.42 : off;
      hedge.push([ax + ux * m + ix * ox, az + uz * m + iz * ox, ix ? dp : along, iz ? dp : along, h, kind < 0.66 ? 0 : kind < 0.86 ? 1 : 2]);
      s0 += along * (1.0 + rb() * 0.75) + (gap < 0.12 ? 0.5 + rb() * 0.7 : 0);
    }
  });
  const sprays = [T.shrubSprayTex(1, 0), T.shrubSprayTex(2, 1), T.shrubSprayTex(3, 2)], sorted = [[], [], []], stems = [], cores = [];
  const inAngel = (x, z, half) => x > angelBox.x0 - half && x < angelBox.x1 + half && z > angelBox.z0 - half && z < angelBox.z1 + half;
  for (const [bx, bz, rx, rz, h, bloom] of hedge) {
    const n = Math.round((rx * rz * 4 + (rx + rz) * h * 2.2) * 17), ph = rb() * 6.3, mid = new THREE.Vector3(bx, h * 0.45, bz), sag = 0.8 + rb() * 0.35;
    for (let i = 0; i < n; i++) {
      const a = rb() * Math.PI * 2, up = Math.acos(1 - rb() * 1.15); // (over the dome, a little under its rim)
      const lump = 1 + 0.2 * Math.sin(a * 3 + ph) * Math.cos(up * 3) + 0.14 * Math.sin(a * 5 + ph * 2);
      const k = Math.min(1.08, (0.62 + rb() * 0.42) * lump); // (never out past the mass of it: they hung in the air there — user, 2026-11-02)
      const x = bx + Math.cos(a) * Math.sin(up) * rx * k * sag, z = bz + Math.sin(a) * Math.sin(up) * rz * k * sag, y = Math.max(0.2, Math.cos(up) * h * k * 0.92 + h * 0.08);
      const size = 0.42 + rb() * 0.32, half = size * 0.5;
      if (y - half < 1.85 && fenceD(x, z) < half + 0.03) continue; // (not through the fence; over its top it may)
      if (fenceD(x, z) < -0.5) continue;
      if (inAngel(x, z, half) && y - half < 2.2) continue; // (nor through the angel)
      if (sdPool(x, z) < POOL.cope + half && y - half < 0.06) continue; // (nor down into the pool)
      const spot = [x, y, z, size];
      spot.mid = mid;
      sorted[bloom].push(spot);
    }
    for (let k = 0, m = 4 + Math.floor(rb() * 4); k < m; k++) { // the old wood at its foot, crooked, going up into it
      const a = rb() * 6.3, d = rb() * 0.25, x0 = bx + Math.cos(a) * d * rx, z0 = bz + Math.sin(a) * d * rz, pts = [];
      for (let j = 0; j <= 5; j++) { const t = j / 5; pts.push(new THREE.Vector3(x0 + Math.cos(a) * t * rx * 0.5 + (rb() - 0.5) * 0.05, -0.02 + t * h * 0.55, z0 + Math.sin(a) * t * rz * 0.5 + (rb() - 0.5) * 0.05)); }
      stems.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.014 + rb() * 0.012, 5, false));
    }
    for (let q = 0, qs = 1 + Math.floor(rb() * 3); q < qs; q++) { // its long shoots out of the top: a stem from inside it, arching over, the leaves along that
      const a = rb() * 6.3, out = 0.5 + rb() * 0.5, top = h * (1.05 + rb() * 0.32), arch = (0.2 + rb() * 0.35), ca = Math.cos(a), sa = Math.sin(a);
      const pts = [[0.2, h * 0.42], [0.45, h * 0.72], [0.75, top * 0.94], [1.05, top], [1.3, top - arch * 0.5]].map(([f, y]) => new THREE.Vector3(bx + ca * rx * out * f, y, bz + sa * rz * out * f));
      if (pts.some((p) => fenceD(p.x, p.z) < 0.12 && p.y < 1.95) || pts.some((p) => inAngel(p.x, p.z, 0.1) && p.y < 2.3)) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      stems.push(new THREE.TubeGeometry(curve, 16, 0.007, 5, false));
      for (let t = 0.5; t <= 1.0; t += 0.075 + rb() * 0.05) {
        const p = curve.getPoint(t), size = (0.34 - t * 0.12) + rb() * 0.08, half = size * 0.5;
        if (p.y - half < 1.85 && fenceD(p.x, p.z) < half + 0.03) continue;
        const spot = [p.x + (rb() - 0.5) * 0.03, p.y, p.z + (rb() - 0.5) * 0.03, size];
        spot.mid = mid;
        sorted[bloom].push(spot);
      }
    }
    const core = new THREE.SphereGeometry(1, 14, 10), cp = core.attributes.position, cuv = core.attributes.uv; // (its thick inside, lumpy, never a smooth ball)
    for (let i = 0; i < cp.count; i++) {
      const sx = cp.getX(i), sy = cp.getY(i), sz = cp.getZ(i), f = 0.6 + 0.2 * Math.sin(sx * 4.3 + ph) * Math.cos(sz * 3.7 + ph) + 0.14 * Math.sin(sy * 6 + sx * 5 + ph * 2) + 0.07 * Math.sin(sx * 11 + sz * 9 + sy * 7);
      cp.setXYZ(i, bx + sx * rx * f * 0.88, Math.max(0, sy * 0.5 + 0.5) * h * (0.46 + 0.16 * f), bz + sz * rz * f * 0.88); // (well inside what covers it: its top stood out of the leaves, a dark lump)
      cuv.setXY(i, cuv.getX(i) * (rx + rz) * 3 + ph, cuv.getY(i) * h * 1.2);
    }
    core.computeVertexNormals();
    cores.push(core);
    ctx.colliders.push({ type: 'seg', ax: bx - rx * 0.3, az: bz - rz * 0.3, bx: bx + rx * 0.3, bz: bz + rz * 0.3, r: Math.min(rx, rz) * 0.72, hose: false });
  }
  sorted.forEach((spots, bloom) => { if (spots.length) g.add(leafCards(spots, sprays[bloom], [0.24, 0.32, 0.72], false, rb, null, { near: [0.2, 0.5] })); });
  const stemMesh = new THREE.Mesh(merge(stems), std({ color: 0x4a3f33, roughness: 1 }));
  stemMesh.castShadow = stemMesh.receiveShadow = true;
  g.add(stemMesh);
  const coreMesh = new THREE.Mesh(merge(cores), std({ map: T.foliageMassTex(), roughness: 1 }));
  coreMesh.castShadow = coreMesh.receiveShadow = true;
  g.add(coreMesh);

  // ---- weeds: waist-high round the table and along the fences, in the beds, at the coping's edge; grass and moss
  // in the paving's joints
  const weedTexs = [T.weedTex(0, 1), T.weedTex(0, 2), T.weedTex(1, 1), T.weedTex(1, 2)];
  const weeds = weedTexs.map(() => []), tufts = [], rw = mulberry32(5701);
  const free = (x, z, m) => sdPool(x, z) > POOL.cope + m && fenceD(x, z) > 0.08 && dist(x, z, ANGEL.x, ANGEL.z) > 0.42 + m;
  for (let i = 0; i < 32000; i++) {
    const x = Y.x0 + rw() * XW, z = GZ0 + rw() * (GZ1 - GZ0), roll = rw(), size = rw(), kind = rw(), turn = rw();
    const w = wild(x, z), b = bed(x, z), p = paved(x, z), edge = 1 - S(fenceD(x, z), 0.15, 0.7);
    const coping = 1 - S(sdPool(x, z) - POOL.cope, 0.0, 0.12);
    const dense = Math.max(w * 0.9, b * 0.5, edge * 0.55, coping * 0.3, (1 - p) * S(-z, 15.2, 16) * 0.25) * (z > -14.8 ? 0.2 : 1);
    if (roll > dense * 0.06 + 0.002 || !free(x, z, 0.05) || puddleAt(x, z) < 1.2) continue;
    const tall = (0.32 + size * 0.42) * (0.5 + 0.5 * Math.max(w, b * 0.8, edge * 0.7)), big = kind < 0.6; // (knee to hip on a man, as in his photograph: to the boy's middle)
    weeds[(big ? 0 : 2) + (turn < 0.5 ? 0 : 1)].push([x, z, tall * (big ? 1 : 0.75), tall * (big ? 1.0 : 0.6), turn * Math.PI * 4]);
  }
  for (const st of stones) { // in the joints round a stone, now and then: a tuft of grass
    if (rw() > 0.09) continue;
    const side = rw(), along = rw() - 0.5, tall = 0.03 + rw() ** 2.5 * 0.16, x = side < 0.5 ? st.x + along * st.hx * 2 : st.x + (side < 0.75 ? -1 : 1) * (st.hx + 0.006), z = side < 0.5 ? st.z + (side < 0.25 ? -1 : 1) * (st.hz + 0.006) : st.z + along * st.hz * 2;
    if (free(x, z, 0.02) && puddleAt(x, z) > 1.05) tufts.push([x, groundY(x, z), z, tall, rw()]);
  }
  for (const [hx, hz, dep] of holes) if (rw() < 0.45 && free(hx, hz, 0.01) && puddleAt(hx, hz) > 1.2) tufts.push([hx + (rw() - 0.5) * 0.05, groundY(hx, hz), hz + (rw() - 0.5) * dep * 0.4, 0.05 + rw() * 0.14, rw()]); // (grass where a stone has gone)
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
    const x = Y.x0 + rl() * XW, z = GZ0 + rl() * (GZ1 - GZ0), k = litter(x, z), s = 0.05 + rl() * 0.06, roll = rl();
    if (roll > Math.min(0.4, k * (0.25 + 0.3 * k)) || !free(x, z, 0.01) || puddleAt(x, z) < 1) continue;
    leafSpots.push([x, topAt(x, z) + 0.003, z, s, 1]);
  }
  for (let i = 0; i < 26; i++) { const a = rl() * 6.3, d = Math.sqrt(rl()) * 0.95; leafSpots.push([TABLE.x + Math.cos(a) * d * 0.55, 0.748, TABLE.z + Math.sin(a) * d * 0.38, 0.05 + rl() * 0.05, 1]); } // on the table
  for (let i = 0; i < 15000; i++) { // on the water, more against its walls and in the round end, where they drifted
    const lx = POOL.x0 + rl() * PR * 2, lz = PZ0 + rl() * (POOL.z1 - PZ0), sd = sdLocal(lx, lz), roll = rl();
    if (sd > -0.03 || roll > 0.1 + 0.5 * (1 - S(-sd, 0.0, 0.5)) + 0.2 * S(-lz, -POOL.zc - 1, -PZ0)) continue;
    const [x, z] = toYard(lx, lz);
    leafSpots.push([x, POOL.water + 0.0025, z, 0.05 + rl() * 0.05, 0]);
  }
  for (let i = 0; i < 26; i++) { const a = rl() * 6.3, d = 0.05 + rl() ** 1.5 * 0.2; leafSpots.push([DROWNED.x + Math.cos(a) * d, POOL.water + 0.0025, DROWNED.z + Math.sin(a) * d, 0.05 + rl() * 0.05, 0]); } // (caught round its neck)
  litterLeaves(g, leafSpots, rl);

  return {
    pool, furniture, angel, trees, stones: stones.length, weeds: weeds.reduce((n, l) => n + l.length, 0), tufts: tufts.length, leaves: leafSpots.length, // (for checking)
    /** What is underfoot out here, for whatever lies on it. */
    groundAt: (x, z) => (z < END && sdPool(x, z) > POOL.cope ? Math.max(0, topAt(x, z)) : 0),
    shadowsMoved: (fn) => { angel.moved = fn; },
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
    m.compose(new THREE.Vector3(x, y + r() * 0.002, z), q, new THREE.Vector3(s, dry ? s : s * 0.4, s)); // (never mirrored: lit from its wrong side, a mirrored leaf went black, a hole in the stone)
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
        vMossK = aMoss${edge ? ' * ( 1.3 - 0.55 * aEdge )' : ''}${tri ? ' - 0.18' : ''};
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
 * The broken setts, each its own (user, 2026-11-02: "they all have the same cut"): every one cut where it was cut by its own
 * dice — across on the slant, along its length, a corner off, some twice — the break a jagged line of its own, the pieces
 * shifted, turned, tipped and sunk apart, now and then one gone. One mesh, nothing shared.
 */
function brokenStones(list, mat, r) {
  const pos = [], nor = [], uv = [], edge = [], mossA = [], col = [];
  const cut = (poly, i, ti, j, tj) => { // two pieces of a polygon, along a jagged line from its edge i to its edge j
    const P = (e, t) => { const a = poly[e], b = poly[(e + 1) % poly.length]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    const a = P(i, ti), b = P(j, tj), l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, steps = 2 + Math.floor(l / 0.022 + r() * 3), jag = [];
    let off = 0;
    for (let k = 1; k < steps; k++) { off = off * 0.45 + (r() - 0.5) * (0.008 + r() * 0.02); const t = (k + (r() - 0.5) * 0.5) / steps, e = Math.sin(t * Math.PI); jag.push([a[0] + (b[0] - a[0]) * t + nx * off * e, a[1] + (b[1] - a[1]) * t + ny * off * e]); }
    const A = [a], B = [b];
    for (let k = i + 1; k <= j; k++) A.push(poly[k]);
    A.push(b, ...[...jag].reverse());
    for (let k = j + 1; k < poly.length + i + 1; k++) B.push(poly[k % poly.length]);
    B.push(a, ...jag);
    return [A, B];
  };
  const area = (p) => { let s = 0; for (let k = 0; k < p.length; k++) { const q = p[(k + 1) % p.length]; s += p[k][0] * q[1] - q[0] * p[k][1]; } return Math.abs(s) / 2; };
  for (const st of list) {
    const L = st.len, D = st.dep, c = 0.012 + r() * 0.012, w = () => (r() - 0.5) * 0.006;
    const outline = [[-L / 2 + c, -D / 2 + w()], [L / 2 - c, -D / 2 + w()], [L / 2 + w(), -D / 2 + c], [L / 2 + w(), D / 2 - c], [L / 2 - c, D / 2 + w()], [-L / 2 + c, D / 2 + w()], [-L / 2 + w(), D / 2 - c], [-L / 2 + w(), -D / 2 + c]];
    const kind = r(), a = 0.15 + r() * 0.7, b = 0.15 + r() * 0.7;
    let pieces;
    if (kind < 0.42) pieces = cut(outline, 0, a, 4, b); // across it, on whatever slant
    else if (kind < 0.62) pieces = cut(outline, 2, a, 6, b); // along it
    else { const corner = Math.floor(r() * 4) * 2; pieces = cut(outline.map((_, k) => outline[(k + corner) % 8]), 0, 0.25 + r() * 0.5, 2, 0.2 + r() * 0.6); } // a corner off
    if (r() < 0.32) { // and the bigger piece broken again
      pieces.sort((p, q) => area(q) - area(p));
      const big = pieces.shift(), i = Math.floor(r() * big.length), j = (i + Math.floor(big.length / 2)) % big.length;
      pieces.push(...cut(big, Math.min(i, j), 0.25 + r() * 0.5, Math.max(i, j), 0.25 + r() * 0.5));
    }
    const lost = pieces.length > 2 && r() < 0.35 ? pieces.reduce((m, p, k) => (area(p) < area(pieces[m]) ? k : m), 0) : -1;
    pieces.forEach((poly, k) => {
      if (k === lost) return;
      const cx = poly.reduce((v, p) => v + p[0], 0) / poly.length, cz = poly.reduce((v, p) => v + p[1], 0) / poly.length, cl = Math.hypot(cx, cz) || 1;
      const bevel = 0.004 + r() * 0.004, geo = new THREE.ExtrudeGeometry(new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x - cx, y - cz))), { depth: 0.045, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.0055, bevelOffset: -0.0055, bevelSegments: 2, steps: 1 });
      geo.rotateX(-Math.PI / 2).translate(0, -(0.045 + bevel), 0);
      const part = new THREE.Object3D(), spread = 0.002 + r() * 0.007;
      part.rotation.set((r() - 0.5) * 0.09, st.yaw, (r() - 0.5) * 0.09, 'YXZ');
      const ox = cx + (cx / cl) * spread, oz = -(cz + (cz / cl) * spread), cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
      part.position.set(st.x + ox * cy + oz * sy, st.y - r() * 0.008 + (r() < 0.2 ? 0.003 : 0), st.z - ox * sy + oz * cy);
      part.rotateY((r() - 0.5) * 0.09);
      part.updateMatrix();
      const P = geo.attributes.position, N = geo.attributes.normal, v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(part.matrix), shade = 0.82 + st.tint * 0.3;
      for (let i = 0; i < P.count; i++) {
        const up = N.getY(i) > 0.7, lx = P.getX(i), lz = P.getZ(i);
        v.fromBufferAttribute(P, i).applyMatrix4(part.matrix); pos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
        uv.push(lx / 0.5 + st.du + k * 0.37, lz / 0.5 + st.dv); edge.push(up ? 0.7 : 0); mossA.push(st.moss);
        const fresh = up ? 1 : 0.72; col.push(shade * fresh, shade * fresh, shade * fresh * 0.97); // (the break itself darker)
      }
      geo.dispose();
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  geo.setAttribute('aMoss', new THREE.Float32BufferAttribute(mossA, 1));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.userData.live = true;
  m.userData.count = list.length;
  return m;
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
    for (const [x, z, a, l, rr] of [[0.3, 0.6, 0.7, 1.15, 0.018], [-1.3, 2.4, -0.4, 0.42, 0.008], [0.9, -3.0, 1.9, 0.55, 0.01]]) {
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
  const blockZ = (xa, xb, za, zb) => {
    const [ax, az] = toYard(xa, za), [bx, bz] = toYard(xb, zb);
    ctx.colliders.push({ type: 'box', x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz), hose: false });
  };
  blockZ(POOL.x0 + 0.04, POOL.x1 - 0.04, POOL.zc, POOL.z1 - 0.04);
  const [rcx, rcz] = toYard(0, ZB);
  ctx.colliders.push({ type: 'seg', ax: rcx, az: rcz, bx: rcx + 0.001, bz: rcz, r: POOL.B - 0.04, hose: false }); // (the half-round)
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
 * pointed lattice backs and arms sweeping down into the front legs, nothing left of their seats but the frames. One chair drawn up to the
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
    for (const sx of [-0.11, 0.11]) bar(o, [V(sx, SY - 0.012, 0.2), V(sx, SY - 0.012, -0.2)], 0.025, 0.005, V(1, 0, 0), rust); // and the two bars across it its seat's boards lay on, long gone (user, 2026-11-02)
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
    return mesh;
  };
  const chairs = [];
  // [x, z, facing (its front towards), on its back?]: drawn up to the table's west side; pushed back and turned away
  // towards the pool; knocked over on its back on the side towards the wood
  for (const [k, x, z, yaw, down] of [[0, TABLE.x - 0.9, TABLE.z + 0.02, Math.PI / 2 + 0.2, false], [1, TABLE.x + 0.98, TABLE.z + 0.3, 2.2, false], [2, TABLE.x - 0.18, TABLE.z + 1.02, Math.PI + 0.35, true]]) { // (one each side, one on the house's side, as he drew them)
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
 * The angel (for now: he will bring a model of his own): too fine to work out on loading, it is baked once by
 * tools/bake-angel.mjs into assets/models/angel.bin, and comes in a moment after the rest. A little out of true on the soft ground.
 */
function marbleAngel(g, ctx, mossNoise) {
  const blank = new THREE.BufferGeometry(); // (standing in till it arrives: the material is seen by outdoorsOnly with the rest)
  blank.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.01, 0, 0.01, 0, 0], 3));
  blank.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  blank.setAttribute('color', new THREE.Float32BufferAttribute(new Array(9).fill(0.7), 3));
  blank.setAttribute('aMoss', new THREE.Float32BufferAttribute([0, 0, 0], 1));
  const figure = new THREE.Mesh(blank, mossy(std({ roughness: 0.66, vertexColors: true }), mossNoise, 'angel', { tri: T.marbleTex() }));
  figure.castShadow = figure.receiveShadow = true;
  figure.userData.live = true;
  figure.position.set(ANGEL.x, -0.03, ANGEL.z);
  figure.scale.setScalar(0.93); // (a little under life-size; head 1.68 m, wing tips 1.95 m)
  figure.rotation.set(0.016, -Math.PI / 2 + 0.06, -0.018, 'YXZ'); // (its front towards the water, the pool's whole length before it)
  g.add(figure);
  ctx.colliders.push({ type: 'seg', ax: ANGEL.x, az: ANGEL.z, bx: ANGEL.x + 0.001, bz: ANGEL.z, r: 0.4, hose: false });
  const api = { figure, moved: null };
  fetch('assets/models/angel.bin').then((res) => res.arrayBuffer()).then((buf) => {
    const head = new Float32Array(buf, 0, 8), count = head[0], tris = head[1], at = head.slice(2, 5), size = head.slice(5, 8);
    let off = 32;
    const q = new Uint16Array(buf, off, count * 3);
    off += count * 6; off += (4 - (off % 4)) % 4;
    const nor = new Int8Array(buf, off, count * 4);
    off += count * 4;
    const col = new Uint8Array(buf, off, count * 4);
    off += count * 4;
    const pos = new Float32Array(count * 3), n3 = new Int8Array(count * 3), c3 = new Uint8Array(count * 3), m1 = new Uint8Array(count);
    for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = at[k] + (q[i * 3 + k] / 65535) * size[k];
      n3[i * 3 + k] = nor[i * 4 + k];
      c3[i * 3 + k] = col[i * 4 + k];
      if (k === 0) m1[i] = col[i * 4 + 3];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(n3, 3, true));
    geo.setAttribute('color', new THREE.BufferAttribute(c3, 3, true));
    geo.setAttribute('aMoss', new THREE.BufferAttribute(m1, 1, true));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, off, tris * 3), 1));
    blank.dispose();
    figure.geometry = geo;
    api.verts = count;
    api.moved?.();
  });
  return api;
}
