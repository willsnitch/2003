// The grove at the end of the yard (user, 2026-10-17): past the slide and the shed the garden turns into a
// wood — five tall trees close together, each of its own kind: an old oak, a maple, a weeping willow in the
// middle, very thick, its curtain of shoots hanging nearly to the ground (user, 2026-10-18: in place of the
// beech), a silver birch with a big trunk and long branches reaching out and hanging at their ends, a spruce
// in the corner. Each a bare trunk first, its crown from high up; the crowns full and meeting overhead.
// Nobody has seen to them in years. There is no wind: nothing in them moves. The wood is tubes grown limb by
// limb, their surface the bark's own furrows and ridges, flaring at the foot into buttresses and roots; the
// leaves are cards of sprays (textures.js), lit as a round crown is, not as flat cards.
import * as THREE from 'three';
import * as T from './textures.js';
import { mulberry32 } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Where they stand, [x, z], and how far their crowns reach (for the yard's ground under them too). */
export const GROVE = { // (foot: the trunk's radius at the ground, its roots' flare and all; seed: its own, kept when it moved)
  // (user, 2026-10-18: the oak and the willow change places — the oak in the middle, the willow at the back on the left)
  oak: { at: [-0.9, -8.7], reach: 4.4, foot: 0.66, seed: 765 },
  maple: { at: [-4.3, -9.1], reach: 3.4, foot: 0.47 },
  willow: { at: [-2.85, -12.2], reach: 3.6, foot: 0.62, seed: 877 },
  birch: { at: [2.55, -9.3], reach: 3.8, foot: 0.49 },
  spruce: { at: [2.35, -12.5], reach: 2.5, foot: 0.48 },
};

// how each grows, level by level (trunk, limbs, branches, twigs): seg — length of a piece; kids — how many
// off the one before; from — how far along that one they start; angle — off it; lenK — their length to its;
// shrink — shorter the further along; angleLow — the angle of the lowest, if not `angle`; rise/droop — bent up to the light, down by their weight towards the
// tip; wob — crookedness; tip — thickness at the tip to the foot; rk — thickness at the foot to the parent's.
// Tall (12–16 m), full crowns, a clean trunk to about 2 m (user, 2026-10-17: "a thick wood, the trees tall and
// very leafy; first there is the trunk" — then: "the branches start lower")
const HABITS = {
  oak: {
    // (the old oak: its great limbs from low down, under a metre — user, 2026-10-17; in the middle since 2026-10-18)
    // An oak's wood grows crooked: a limb goes on a way, then turns at a knot (kink: how often), and it does not
    // run out to a point but parts in two (fork: their length, to its) — straight tapering limbs looked like the
    // spikes of an early-2000s model (user, 2026-10-18)
    trunk: { len: 5.0, r: 0.42, lean: 0.05, seg: 0.35, rise: 0, droop: 0, wob: 0.05, tip: 0.55 }, floor: 1.0, // (no knots in the trunk: one put it over 30°)
    levels: [
      { kids: 9, from: 0.15, angleLow: 1.2, angle: 0.62, lenK: 0.8, shrink: 0.3, rise: 0.2, droop: 0.04, wob: 0.28, kink: 0.3, fork: 0.45, tip: 0.5, rk: 0.6, seg: 0.35 }, // (the low ones going out nearly level, then up)
      { kids: 9, from: 0.12, angle: 0.8, lenK: 0.45, shrink: 0.45, rise: 0.1, droop: 0.15, wob: 0.35, kink: 0.35, fork: 0.5, tip: 0.4, rk: 0.55, seg: 0.3 },
      { kids: 6, from: 0.2, angle: 0.85, lenK: 0.45, shrink: 0.4, rise: 0.12, droop: 0.2, wob: 0.4, kink: 0.3, tip: 0.3, rk: 0.5, seg: 0.22 },
    ],
    leaves: { card: 1.25, every: 0.19, from: 0.06, tint: [0.22, 0.3, 0.72], minY: 1.15, near: [0.25, 0.75] }, // (on its low limbs too, so they don't end bare like antlers; thinning away near the eye)
  },
  maple: {
    trunk: { len: 4.8, r: 0.3, lean: 0.06, seg: 0.35, rise: 0, droop: 0, wob: 0.05, tip: 0.55 },
    levels: [
      { kids: 6, from: 0.42, angle: 0.5, lenK: 1.25, shrink: 0.3, rise: 0.06, droop: 0.05, wob: 0.16, tip: 0.3, rk: 0.62, seg: 0.45 },
      { kids: 8, from: 0.22, angle: 0.72, lenK: 0.42, shrink: 0.45, rise: 0.1, droop: 0.16, wob: 0.28, tip: 0.28, rk: 0.55, seg: 0.35 },
      { kids: 5, from: 0.25, angle: 0.85, lenK: 0.42, shrink: 0.4, rise: 0.14, droop: 0.15, wob: 0.32, tip: 0.3, rk: 0.5, seg: 0.25 },
    ],
    leaves: { card: 1.25, every: 0.19, from: 0.06, tint: [0.18, 0.35, 0.8], minY: 2.3 },
  },
  willow: {
    // (user, 2026-10-18: the middle one a weeping willow, very thick) a short thick trunk, leaning, gnarled,
    // parting at about 2.5 m into a few great limbs that climb and arch out; branches off them bending over
    // and down; everything at its ends hanging, and from all of it the shoots hanging in curtains (willowCurtain)
    trunk: { len: 3.2, r: 0.4, lean: 0.09, seg: 0.3, rise: 0, droop: 0, wob: 0.08, tip: 0.78, dropSides: true }, // (thick right up to where it parts; dropSides: its great limbs out to the left and the right left off, so it takes less room — user, 2026-10-18)
    levels: [
      { kids: 5, from: 0.7, angle: 0.62, lenK: 1.0, shrink: 0.15, rise: 0.06, droop: 0.15, wob: 0.14, tip: 0.35, rk: 0.62, seg: 0.4 },
      { kids: 10, from: 0.1, angle: 1.0, lenK: 0.95, shrink: 0.4, rise: 0.04, droop: 1.1, wob: 0.2, tip: 0.3, rk: 0.5, seg: 0.3 },
      { kids: 5, from: 0.2, angle: 0.6, lenK: 0.4, shrink: 0.3, rise: 0.0, droop: 1.4, wob: 0.25, tip: 0.3, rk: 0.45, seg: 0.2 },
    ],
    leaves: { curtain: true, card: 1.25, every: 0.1, tint: [0.2, 0.3, 0.77], minY: 0.35 }, // (a little darker: user, 2026-10-18) // (0.085 was one too many to draw: user, 2026-10-18, "it lags")
  },
  birch: {
    // a big trunk going right up; long branches all the way from 4 m, rising, arching out and down, their
    // shoots hanging from them in long strings at the ends
    trunk: { len: 14.2, r: 0.31, lean: 0.07, seg: 0.5, rise: 0.006, droop: 0, wob: 0.025, tip: 0.09, leader: true },
    levels: [
      { kids: 44, from: 0.15, angle: 1.0, lenK: 0.29, shrink: 0.72, rise: 0.0, droop: 0.36, wob: 0.14, tip: 0.2, rk: 0.4, seg: 0.35 },
      { kids: 12, from: 0.15, angle: 0.6, lenK: 0.45, shrink: 0.25, rise: 0.0, droop: 1.1, wob: 0.22, tip: 0.3, rk: 0.45, seg: 0.2 },
    ],
    leaves: { card: 1.15, every: 0.105, from: 0.04, tint: [0.2, 0.35, 0.84], minY: 2.3, hang: true }, // (fuller: user, 2026-10-17)
  },
};
/** How deep each kind's bark stands out of the wood and sinks into it, metres from furrow to ridge (on thick wood). */
const RELIEF = { oak: 0.07, willow: 0.075, maple: 0.03, birch: 0.006, birchBase: 0.05, spruce: 0.006 };
/** How a kind's trunk flares at its foot: lobes round it, how much it swells all round and in the lobes. */
const FLARE = { oak: [6, 0.32, 0.62], willow: [5, 0.24, 0.45], maple: [5, 0.28, 0.48], birch: [4, 0.22, 0.4], spruce: [6, 0.28, 0.42] };
/** The bark's height, its ridges' tops flattened (it was rounded into ropes). */
const flat = (h) => Math.tanh(h * 3) / 3;
/** Where up a birch its bark is white (1) and not the black of its foot (0), at height y, a way round it a (radians). */
const birchWhite = (y, a) => THREE.MathUtils.smoothstep(y + 0.45 * Math.sin(a * 2 + y * 1.3) + 0.3 * Math.sin(a * 5 + 1.7) + 0.25 * Math.sin(a * 11 + y * 7), 0.95, 1.35); // (in islands, a ragged edge)

/**
 * A tapered tube along `pts` (radii `rad`), into `out`'s arrays: drawn through them as a smooth curve, cut
 * into rings close together where the wood is thick (and the bark's relief shows in its outline) and far
 * apart where it is thin, its side `sides` at the least. Its surface is the bark's own (user, 2026-10-18:
 * "the bark too basic, pattern and shape"): pushed out on the ridges and in at the furrows (the heights the
 * bark texture is drawn from, so the two agree); `foot`: a trunk's — flaring at the ground into buttresses
 * that spiral a little and run down into it; `collar`: a limb's — swelling where it leaves its parent.
 * Bark UVs in tiles, 0.6 m round, 1.2 m up; vertex colours from `shade`; `mix` (the birch): its white.
 */
function tube(out, pts, rad, sides, shade, { kind, foot = null, collar = false, wounds = null } = {}) {
  if (pts.length < 2) return;
  // a blunt end (a limb cut short, a thick one) rounded off, not left open or sawn square
  const rEnd = rad[rad.length - 1];
  if (rEnd > 0.012) {
    const a = pts[pts.length - 1], dir = a.clone().sub(pts[pts.length - 2]).normalize();
    pts = [...pts, a.clone().addScaledVector(dir, rEnd * 0.45), a.clone().addScaledVector(dir, rEnd * 0.8)];
    rad = [...rad, rEnd * 0.75, rEnd * 0.12];
  }
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = lens[lens.length - 1];
  if (total < 1e-4) return;
  const radAt = (s) => {
    let i = 1;
    while (i < lens.length - 1 && lens[i] < s) i++;
    const k = Math.min(1, Math.max(0, (s - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1])));
    return rad[i - 1] + (rad[i] - rad[i - 1]) * k;
  };
  const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : new THREE.LineCurve3(pts[0], pts[1]);
  const fine = (r) => r > 0.09; // thick enough for its bark to show in its outline
  const rows = [];
  for (let s = 0; s < total - 1e-4;) { rows.push(s); const r = radAt(s); s += fine(r) ? 0.05 : THREE.MathUtils.clamp(r * 2.5, 0.07, 0.35); } // (5 cm, 3.5 cm round: at 3 and 2.2 the wood was half a million points, user, 2026-10-18: "it lags")
  rows.push(total);
  const R0 = rad[0], ring = fine(R0) ? THREE.MathUtils.clamp(Math.round((2 * Math.PI * R0 * (foot ? 1.6 : 1)) / 0.035), 16, 96) : Math.max(sides, Math.round((2 * Math.PI * R0) / 0.06));
  const around = Math.max(1, Math.round((2 * Math.PI * R0) / 0.6)), base = out.pos.length / 3;
  const P = rows.map((s) => curve.getPointAt(s / total)), Tn = rows.map((s) => curve.getTangentAt(s / total).normalize());
  let nor = Math.abs(Tn[0].y) < 0.95 ? new THREE.Vector3().crossVectors(Tn[0], UP).normalize() : new THREE.Vector3(1, 0, 0);
  const bin = new THREE.Vector3(), axis = new THREE.Vector3(), dir = new THREE.Vector3();
  const [lobes, swell, lobe] = foot ? FLARE[foot.kind] : [0, 0, 0];
  const BINS = 48; // (a trunk's own shape, ring by ring up to 1.6 m, kept for the hose to lie against: out.profile)
  for (let i = 0; i < rows.length; i++) {
    if (i) {
      axis.crossVectors(Tn[i - 1], Tn[i]); // the frame carried along the curve, so it never twists
      const s = axis.length();
      if (s > 1e-6) nor.applyAxisAngle(axis.normalize(), Math.asin(Math.min(1, s)));
    }
    bin.crossVectors(Tn[i], nor).normalize();
    nor = new THREE.Vector3().crossVectors(bin, Tn[i]).normalize();
    const p = P[i], R = radAt(rows[i]), k = (shade ? shade(p) : 1) * (kind === 'oak' ? 0.62 + 0.38 * THREE.MathUtils.smoothstep(R, 0.015, 0.12) : 1), v = rows[i] / 1.2; // (an oak's young wood darker and smoother than its old: pale thin twigs read as sticks)
    const thick = THREE.MathUtils.smoothstep(R, 0.06, 0.32), relief = (RELIEF[kind] ?? 0) * thick; // (all of it on a trunk; on a limb it made a twisted rope)
    const swollen = collar ? 1 + 0.45 * Math.exp(-rows[i] / (R0 * 1.6)) : 1;
    const low = foot ? Math.exp(-Math.max(0, p.y - foot.y0) / 0.42) : 0;
    for (let j = 0; j <= ring; j++) {
      const a = (j / ring) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      dir.set(nor.x * c + bin.x * sn, nor.y * c + bin.y * sn, nor.z * c + bin.z * sn);
      let rr = R * swollen;
      if (foot) rr *= 1 + low * (swell + lobe * Math.max(0, Math.cos(lobes * a + foot.ph + p.y * 0.3)) ** 1.3 * (0.6 + 0.4 * Math.sin(a * 3 + foot.ph))); // (broad and rounded: sharp ones made a star of spikes)
      const u = (j / ring) * around;
      let white = 1, bark = 0;
      if (kind === 'birch') {
        white = birchWhite(p.y, a);
        bark = (flat(T.groveBarkHeight('birchBase', u, v)) * RELIEF.birchBase * (1 - white) ** 2 + flat(T.groveBarkHeight('birch', u, v)) * RELIEF.birch * white) * thick; // (the white smooth, the black rough)
      } else if (relief) bark = flat(T.groveBarkHeight(kind, u, v)) * relief;
      // where the bark has come away (`wounds`: { s along, a round, w, h half its width and height, m }): the
      // nearest one's own coordinates, for the shader's ragged edge and the wood in it; here, a hollow the bark's
      // depth, and round it the bark rolled up in a lip, the way it grows back over a wound
      let wq = null;
      if (wounds) for (const wd of wounds) {
        let da = a - wd.a;
        da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
        const du = (da * R) / wd.w, dv = (rows[i] - wd.s) / wd.h;
        if (Math.abs(du) < 2.4 && Math.abs(dv) < 2.4 && (!wq || du * du + dv * dv < wq[0] * wq[0] + wq[1] * wq[1])) wq = [du, dv, wd.m ?? 0.5];
      }
      if (wq) {
        const q = Math.hypot(wq[0], wq[1]), inside = 1 - THREE.MathUtils.smoothstep(q, 0.85, 1.05);
        rr += bark * (1 - inside) - 0.022 * inside + 0.02 * Math.exp(-(((q - 1.12) / 0.16) ** 2)) * (1 - inside);
      } else rr += bark;
      out.wound.push(wq ? wq[0] : 0, wq ? wq[1] : 0, wq ? 1 + wq[2] : 0);
      out.pos.push(p.x + dir.x * rr, p.y + dir.y * rr, p.z + dir.z * rr);
      if (foot && out.profile && p.y < 1.6) {
        if (j === 0) out.profile.push({ y: p.y, cx: p.x, cz: p.z, r: new Float32Array(BINS) });
        const pr = out.profile[out.profile.length - 1], vx = dir.x * rr, vz = dir.z * rr;
        const b = Math.floor(((Math.atan2(vz, vx) / (2 * Math.PI) + 1) % 1) * BINS) % BINS;
        pr.r[b] = Math.max(pr.r[b], Math.hypot(vx, vz));
      }
      out.nor.push(dir.x, dir.y, dir.z); // (worked out again below, from the surface)
      out.uv.push(u, v);
      out.col.push(k, k, k);
      out.mix.push(white);
    }
  }
  const n = ring + 1;
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < ring; j++) {
    const a = base + i * n + j, b = a + n;
    out.idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  // the normals, from the surface as it now is: round each ring and along the tube, the seam closed
  const at = (i, j) => (base + Math.min(rows.length - 1, Math.max(0, i)) * n + ((j + ring) % ring)) * 3, q = out.pos, e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < rows.length; i++) for (let j = 0; j <= ring; j++) {
    const r1 = at(i, j + 1), r0 = at(i, j - 1), u1 = at(i + 1, j), u0 = at(i - 1, j), me = (base + i * n + j) * 3;
    e1.set(q[r1] - q[r0], q[r1 + 1] - q[r0 + 1], q[r1 + 2] - q[r0 + 2]);
    e2.set(q[u1] - q[u0], q[u1 + 1] - q[u0 + 1], q[u1 + 2] - q[u0 + 2]);
    nn.crossVectors(e1, e2).normalize();
    if (nn.x * out.nor[me] + nn.y * out.nor[me + 1] + nn.z * out.nor[me + 2] < 0) nn.negate();
    if (Number.isFinite(nn.x) && nn.lengthSq() > 0.5) { out.nor[me] = nn.x; out.nor[me + 1] = nn.y; out.nor[me + 2] = nn.z; }
  }
}

/** The point and the direction `t` of the way along a polyline. */
function along(pts, t) {
  const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i;
  return [pts[i].clone().lerp(pts[i + 1], k), pts[i + 1].clone().sub(pts[i]).normalize()];
}

/** Any unit vector square to `v`. */
function square(v) {
  return (Math.abs(v.y) < 0.9 ? new THREE.Vector3().crossVectors(v, UP) : new THREE.Vector3(1, 0, 0)).normalize();
}

/** Nearest distance from p to the polyline `line`. */
function toLine(p, line) {
  let best = Infinity;
  const ab = new THREE.Vector3(), ap = new THREE.Vector3();
  for (let i = 0; i < line.length - 1; i++) {
    ab.subVectors(line[i + 1], line[i]);
    ap.subVectors(p, line[i]);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.lengthSq()));
    best = Math.min(best, ap.addScaledVector(ab, -t).length());
  }
  return best;
}

/**
 * One limb and all it bears, from `p` towards `dir`, `len` long, `r0` thick at its foot, at `level` of the
 * habit `H`. Pushed to G.limbs ({ pts, rad, level }); the ends of the last level to G.ends (where leaves go).
 */
function grow(G, p, dir, len, r0, level, habit, from = null) { // (from: the limb it grows off, and how far along it)
  const r = G.r, last = level === G.H.levels.length;
  const n = Math.max(2, Math.ceil(len / habit.seg)), step = len / n;
  const pts = [p.clone()], d = dir.clone(), q = p.clone();
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    d.y += (habit.rise - habit.droop * t) * step;
    d.x += (r() - 0.5) * habit.wob * step * 2;
    d.z += (r() - 0.5) * habit.wob * step * 2;
    d.y += (r() - 0.5) * habit.wob * step;
    if (habit.kink && r() < habit.kink) d.applyAxisAngle(square(d).applyAxisAngle(d, r() * 6.3), (0.25 + r() * 0.3) * (r() < 0.5 ? -1 : 1)); // a turn at a knot
    d.normalize();
    q.addScaledVector(d, step);
    if (level && G.blocked(q)) break; // cut short where it would come down low, or into the wire or another trunk
    pts.push(q.clone());
  }
  if (pts.length < 2) return;
  const n2 = pts.length - 1;
  const rTip = r0 + (r0 * habit.tip - r0) * (n2 / n);
  const rad = pts.map((_, i) => r0 + (rTip - r0) * (i / n2));
  const me = { pts, rad, level, from };
  G.limbs.push(me);
  if (level >= G.H.levels.length - 1) G.ends.push(pts); // leaves along the last two levels: the branches and their twigs
  if (last) return;
  const K = G.H.levels[level];
  const kids = Math.max(1, Math.round(K.kids * (0.8 + r() * 0.4)));
  let spin = r() * Math.PI * 2;
  const later = []; // (a trunk that drops its side limbs: all of them worked out first, then the two left off)
  for (let k = 0; k < kids; k++) {
    const t = K.from + (1 - K.from) * ((k + 0.3 + r() * 0.4) / kids);
    const [at, ax] = along(pts, t);
    spin += 2.4 + (r() - 0.5) * 0.6; // round the parent by the golden angle, near enough
    const side = square(ax).applyAxisAngle(ax, spin);
    const ang = K.angleLow === undefined ? K.angle : K.angleLow + (K.angle - K.angleLow) * ((t - K.from) / (1 - K.from)); // (angleLow: the lowest further out)
    const cd = ax.clone().multiplyScalar(Math.cos(ang)).addScaledVector(side, Math.sin(ang)).normalize();
    if (level === 0 && G.steer) G.steer(cd); // (a great limb turned up, away from where it must not go)
    const cl = G.room(at, cd, len * K.lenK * (1 - K.shrink * t) * (0.8 + r() * 0.4));
    if (cl < 0.12) continue;
    if (level === 0 && habit.dropSides) later.push([at, cd, cl, (r0 + (rTip - r0) * t) * K.rk, t]);
    else grow(G, at, cd, cl, (r0 + (rTip - r0) * t) * K.rk, level + 1, K, { limb: me, t });
  }
  if (later.length > 2) { // the one going out furthest to the west (left, seen from the house) and the one to the east
    const byX = later.map((l, i) => [l[1].x / Math.max(1e-6, Math.hypot(l[1].x, l[1].z)), i]).sort((a, b) => a[0] - b[0]);
    const gone = new Set([byX[0][1], byX[byX.length - 1][1]]);
    later.forEach(([at, cd, cl, r1, t], i) => { if (!gone.has(i)) grow(G, at, cd, cl, r1, level + 1, K, { limb: me, t }); });
  } else later.forEach(([at, cd, cl, r1, t]) => grow(G, at, cd, cl, r1, level + 1, K, { limb: me, t }));
  // a trunk that divides: one limb goes on up from its top, so it never ends in a stump
  if (level === 0 && !habit.leader) {
    const [at, ax] = along(pts, 0.985);
    const cd = ax.clone().addScaledVector(square(ax).applyAxisAngle(ax, r() * 6.3), 0.25).normalize();
    grow(G, at, cd, G.room(at, cd, len * K.lenK * 0.9), rTip * 0.95, 1, K, { limb: me, t: 0.985 });
  }
  // a limb that parts in two at its end, and does not run out to a point
  if (level > 0 && habit.fork && n2 === n) {
    const [at, ax] = along(pts, 0.97), spin0 = r() * 6.3;
    for (const sgn of [-1, 1]) {
      const cd = ax.clone().applyAxisAngle(square(ax).applyAxisAngle(ax, spin0), sgn * (0.3 + r() * 0.3)).normalize();
      const cl = G.room(at, cd, len * habit.fork * (0.75 + r() * 0.5));
      if (cl > 0.12) grow(G, at, cd, cl, rTip * 0.8, level + 1, K, { limb: me, t: 0.97 });
    }
  }
}

/**
 * Cuts a tree's limbs back where they would grow on into `inside` (another tree's middle), each ending a
 * little short of it and tapering to its end there, and drops whatever grew off a part cut away. Done after
 * the growing, so the rest of the tree is as it was.
 */
function cutBack(G, inside) {
  const gone = new Set();
  for (const l of G.limbs) {
    if (!l.level) continue;
    const up = l.from?.limb;
    if (up && (gone.has(up) || l.from.t > (up.kept ?? 1) + 1e-6)) { gone.add(l); l.pts.length = 0; continue; }
    const i = l.pts.findIndex((q, k) => k > 0 && inside(q));
    if (i < 0) continue;
    if (i < 2) { gone.add(l); l.pts.length = 0; continue; }
    const n = l.pts.length, r0 = l.rad[0], tip = Math.max(l.rad[n - 1], r0 * 0.3);
    l.kept = (i - 1) / (n - 1);
    l.pts.length = i;
    l.rad.length = i;
    for (let k = 1; k < i; k++) l.rad[k] = r0 + (tip - r0) * (k / (i - 1));
  }
  G.limbs = G.limbs.filter((l) => !gone.has(l));
}

/** The leaves along the branches and twigs, a spray every so often from part way along: [x, y, z, size] each. */
function leafSpots(G, L) {
  const r = G.r, out = [];
  for (const pts of G.ends) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = pts[i].distanceTo(pts[i - 1]); segs.push(d); total += d; }
    for (let at = total * L.from + r() * L.every * 0.5; at <= total; at += L.every * (0.7 + r() * 0.6)) {
      let i = 0, run = at;
      while (i < segs.length - 1 && run > segs[i]) run -= segs[i++];
      const p = pts[i].clone().lerp(pts[i + 1], Math.min(1, run / segs[i]));
      const s = L.card * (0.8 + r() * 0.45);
      out.push([p.x + (r() - 0.5) * 0.26, p.y + (r() - 0.5) * 0.2 - (L.hang ? s * 0.25 : 0), p.z + (r() - 0.5) * 0.26, s]);
    }
  }
  return out;
}

/**
 * A crown's leaves as instanced cards: lit as a round crown is — each card's normal points out of the crown's
 * middle (`lift`: how much its height counts in that, 1.3 a round crown, less a curtain). `near`: from how
 * close to the eye a card begins to thin away to nothing, and where it is whole (the willow's: you go in
 * through them).
 */
export function leafCards(spots, map, tint, hang, r, place = null, { lift = 1.3, near = null } = {}) {
  const mid = new THREE.Vector3();
  for (const [x, y, z] of spots) mid.add(new THREE.Vector3(x, y, z));
  mid.divideScalar(Math.max(1, spots.length));
  const geo = new THREE.PlaneGeometry(1, 1);
  const bend = new Float32Array(spots.length * 3);
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec3 aBend;\nvarying float vFacing;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize( aBend );')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vFacing = abs( dot( normalize( mat3( modelViewMatrix ) * mat3( instanceMatrix ) * vec3( 0.0, 0.0, 1.0 ) ), normalize( - mvPosition.xyz ) ) );`);
    // a card seen edge on is a thin dark line across the crown (user, 2026-10-17, low on the oak): it fades out
    sh.fragmentShader = 'varying float vFacing;\n' + sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <alphatest_fragment>', 'diffuseColor.a *= smoothstep( 0.06, 0.28, vFacing );\n' + (near ? `diffuseColor.a *= smoothstep( ${near[0].toFixed(2)}, ${near[1].toFixed(2)}, vViewPosition.z );\n` : '') + '#include <alphatest_fragment>');
  };
  mat.customProgramCacheKey = () => 'grove-leaves' + (near ? `-near${near.join('-')}` : '');
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), n = new THREE.Vector3();
  spots.forEach(([x, y, z, size, yaw, tilt, roll, lenX, lenY], i) => {
    p.set(x, y, z);
    if (place) q.copy(place[i]);
    else {
      e.set(hang ? (r() - 0.5) * 0.5 : (r() - 0.5) * 1.6, r() * Math.PI * 2, (r() - 0.5) * (hang ? 0.4 : 1.2), 'YXZ');
      q.setFromEuler(e);
    }
    m.compose(p, q, s.set(size * (place ? 1 : r() < 0.5 ? -1 : 1) * (lenX ?? 1), size * (lenY ?? (lenX ? 0.5 : 1)), size)); // (mirrored now and then: not a frond, whose branch starts at one end)
    mesh.setMatrixAt(i, m);
    // out of the crown's middle, a little up: the sunny side bright, the far side and the inside dim
    const own = spots[i].mid ?? mid; // (a spot may name its own: one bush of a hedge)
    n.set(x - own.x, (y - own.y) * lift, z - own.z).normalize().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.35, 0)).normalize();
    n.applyQuaternion(q.clone().invert());
    bend.set([n.x, n.y, n.z], i * 3);
    mesh.setColorAt(i, c.setHSL(tint[0] + (r() - 0.5) * 0.04, tint[1] + (r() - 0.5) * 0.15, tint[2] + (r() - 0.5) * 0.16)); // (a tint over the spray's own greens)
  });
  geo.setAttribute('aBend', new THREE.InstancedBufferAttribute(bend, 3));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/**
 * The bark material of a kind: its colour, its normals, vertex colours (darker near the ground). The birch's
 * goes from the black, deeply split bark of its foot up into the white, raggedly (`aMix`, from tube()).
 */
function barkMat(kind) {
  const B = T.groveBark(kind);
  const mat = new THREE.MeshStandardMaterial({ map: B.map, normalMap: B.normalMap, roughness: 0.95, vertexColors: true });
  if (kind === 'oak') { // the openings in it (tube(): aWound): the bare wood, the edge torn along the bark's furrows, the lip round it dark
    const wood = T.woundWoodTex();
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.woodMap = { value: wood };
      sh.vertexShader = 'attribute vec3 aWound;\nvarying vec3 vWound;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWound = aWound;');
      sh.fragmentShader = 'uniform sampler2D woodMap;\nvarying vec3 vWound;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          float woundIn = 0.0;
          if ( vWound.z > 0.5 ) {
            float th = atan( vWound.y, vWound.x ), ph = fract( vWound.z ) * 6.2832; // (each its own shape: z is 1 + its own number)
            float q = length( vWound.xy ) * ( 1.0 + 0.15 * sin( 3.0 * th + ph ) + 0.08 * sin( 7.0 * th + 2.0 * ph ) )
              + ( pow( sampledDiffuseColor.g, 0.4545 ) - 0.42 ) * 0.7; // (the bark breaks along its furrows: a ragged edge)
            woundIn = 1.0 - smoothstep( 0.92, 1.0, q );
            float lip = smoothstep( 0.86, 1.0, q ) * ( 1.0 - smoothstep( 1.05, 1.45, q ) );
            vec3 bare = texture2D( woodMap, vMapUv * vec2( 3.0, 1.5 ) ).rgb * ( 0.32 + 0.68 * ( 1.0 - smoothstep( 0.55, 0.97, q ) ) ); // (in the shadow of the bark's edge round it)
            diffuseColor.rgb = mix( diffuseColor.rgb * ( 1.0 - 0.3 * lip ), diffuse * bare, woundIn );
          }`)
        .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = mix( texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0, vec3( 0.0, 0.0, 1.0 ), woundIn );'));
    };
    mat.customProgramCacheKey = () => 'oak-bark';
    return mat;
  }
  if (kind !== 'birch') return mat;
  const F = T.groveBark('birchBase');
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.baseMap = { value: F.map };
    sh.uniforms.baseNormal = { value: F.normalMap };
    sh.vertexShader = 'attribute float aMix;\nvarying float vMix;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMix = aMix;');
    sh.fragmentShader = 'uniform sampler2D baseMap;\nuniform sampler2D baseNormal;\nvarying float vMix;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix( diffuse * texture2D( baseMap, vMapUv ).rgb, diffuseColor.rgb, vMix );')
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz', 'vec3 mapN = mix( texture2D( baseNormal, vNormalMapUv ).xyz, texture2D( normalMap, vNormalMapUv ).xyz, vMix )'));
  };
  mat.customProgramCacheKey = () => 'birch-bark';
  return mat;
}

/** The arrays as a mesh. */
function meshOf(out, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  geo.setAttribute('aMix', new THREE.Float32BufferAttribute(out.mix, 1));
  geo.setAttribute('aWound', new THREE.Float32BufferAttribute(out.wound, 3));
  geo.setIndex(out.idx);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  m.userData.live = true; // (kept out of build.bakeStatic, whose merging drops the vertex colours: the bark went black)
  return m;
}

/**
 * Where the old oak's bark has come away (user, 2026-10-18, after his photograph: "small and medium openings"):
 * one long one low on the trunk on the house's side, one higher round the back, a few small ones — old branch
 * scars — up the trunk, and one on each of two of its great limbs. limb index → [{ s, a, w, h }].
 */
function oakWounds(limbs) {
  const r = mulberry32(919), out = new Map(), put = (n, wd) => (out.get(n) ?? out.set(n, []).get(n)).push(wd);
  const trunk = limbs.findIndex((l) => l.level === 0), taken = [];
  const free = (s, a, w, h) => taken.every(([s2, a2, w2, h2]) => Math.abs(s - s2) > (h + h2) * 1.4 || Math.abs(Math.atan2(Math.sin(a - a2), Math.cos(a - a2))) * 0.42 > (w + w2) * 1.4);
  const add = (s, a, w, h) => { if (!free(s, a, w, h)) return false; taken.push([s, a, w, h]); put(trunk, { s, a, w, h, m: r() * 0.999 }); return true; };
  add(1.0, 1.5 * Math.PI + 0.35, 0.11, 0.27); // (the tube's angle 3π/2 looks south, at the house)
  add(2.4, 0.5 * Math.PI - 0.5, 0.07, 0.18);
  for (let k = 0, tries = 0; k < 5 && tries < 60; tries++) { const w = 0.022 + r() * 0.022; if (add(0.45 + r() * 3.2, r() * Math.PI * 2, w, w * (1.2 + r() * 0.7))) k++; }
  limbs.map((l, n) => [l, n]).filter(([l]) => l.level === 1 && l.rad[0] > 0.12).slice(0, 2).forEach(([l, n]) => put(n, { s: 0.5 + r() * 0.6, a: r() * Math.PI * 2, w: 0.03, h: 0.05 + r() * 0.03, m: r() * 0.999 }));
  return out;
}

/**
 * A trunk's roots where they show (user, 2026-10-18): out from the foot of each buttress, along the ground,
 * thinning and sinking into it, the odd one going off crooked. `x, z`: the trunk; `R`: its radius.
 */
function roots(out, kind, x, z, R, ph, r, shade) {
  const [lobes] = FLARE[kind], reach = { oak: 1.25, willow: 1.1, maple: 0.8, birch: 0.7, spruce: 0.9 }[kind], laid = [];
  for (let m = 0; m < lobes; m++) {
    if (r() < 0.2) continue;
    const a = (2 * Math.PI * m - ph) / lobes + (r() - 0.5) * 0.25; // where a buttress is (tube(): cos(lobes·a + ph) = 1, its frame's x east, its y north)
    const d = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)), side = new THREE.Vector3(-d.z, 0, d.x);
    const len = reach * (0.6 + r() * 0.6), bend = (r() - 0.5) * 0.5, pts = [], rad = [];
    for (let i = 0; i <= 8; i++) { // (thick, rounded, soon going down into the ground: thin ones running out along it looked like spikes)
      const t = i / 8, out_ = R * 0.5 + len * 0.5 * t;
      pts.push(new THREE.Vector3(x + d.x * out_ + side.x * bend * t * t * len, 0.12 * (1 - t) ** 1.2 - 0.34 * t ** 1.3, z + d.z * out_ + side.z * bend * t * t * len));
      rad.push(R * 0.38 * (1 - t * 0.35));
    }
    tube(out, pts, rad, 8, shade, { kind });
    laid.push({ pts, rad });
  }
  return laid;
}

/**
 * A couple of roots that run out over the ground before they go down into it (user, 2026-10-18: "a couple of
 * roots at the foot of some trees, coming up out of the leaves"): from the trunk's foot, along the ground,
 * winding, rising out of the litter and dipping back under it, thinning, and down. `clear(p)`: nothing there
 * (the fence, another trunk, what stands under the trees).
 */
function surfaceRoots(out, kind, x, z, R, count, r, shade, clear) {
  const ways = [], laid = []; // (not two the same way)
  for (let k = 0, tries = 0; k < count && tries < 30; tries++) {
    const a = r() * Math.PI * 2, d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-d.z, 0, d.x);
    const len = 1.0 + r() * 0.9, wind = (0.12 + r() * 0.14) * (r() < 0.5 ? -1 : 1), ph = r() * 6.3, rise = 0.035 + r() * 0.03, pts = [], rad = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, o = R * 0.75 + len * t, w = wind * Math.sin(t * Math.PI * 1.6 + ph) * len * 0.35;
      const y = 0.16 * Math.max(0, 1 - t / 0.15) ** 1.5 + rise * Math.sin(t * Math.PI * 2.2 + ph) + 0.02 - 0.26 * Math.max(0, (t - 0.8) / 0.2) ** 1.5;
      pts.push(new THREE.Vector3(x + d.x * o + side.x * w, y, z + d.z * o + side.z * w));
      rad.push(R * 0.2 * (1 - 0.5 * t) + 0.022);
    }
    if (!pts.every((p, i) => i < 3 || clear(p, rad[i])) || ways.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 1.2)) continue;
    ways.push(a);
    tube(out, pts, rad, 8, shade, { kind });
    laid.push({ pts, rad });
    k++;
  }
  return laid;
}

/**
 * The grove. `yard`: its extent (nothing low goes over the fence); `wire`: the house's line overhead, as
 * points (nothing grows into it); `under`: what stands in the yard under the trees, as boxes with their tops
 * (the willow's shoots hang no lower than them). Pushes the trunks to ctx.colliders. Returns the trees, by
 * kind, with their limbs ({ pts, rad, level }) and leaves, for checking.
 */
export function grove(g, ctx, { yard, wire, under = [] }) {
  const trees = {};
  const trunks = Object.entries(GROVE).map(([k, v]) => ({ kind: k, x: v.at[0], z: v.at[1], r: (HABITS[k]?.trunk.r ?? 0.32) * 1.3 }));
  const insideYard = (p, d, len) => { // low down, a limb's end stays inside the fence
    if (p.y > 2.1) return len;
    const lim = (v, a, b) => (v > 1e-6 ? (b - a) / v : v < -1e-6 ? (a - b) / -v : Infinity);
    const tx = d.x > 0 ? lim(d.x, p.x, yard.x1 - 0.2) : lim(-d.x, yard.x0 + 0.2, p.x);
    const tz = d.z > 0 ? lim(d.z, p.z, yard.z1 - 0.2) : lim(-d.z, yard.z0 + 0.2, p.z);
    return Math.min(len, Math.max(0, tx), Math.max(0, tz));
  };
  // where nothing of a tree's crown may go: below 1.95 m (room to walk under, and over the fence), into the
  // house's line, through another tree's trunk; the crowns themselves may meet and mingle, as in a wood
  const blockedFor = (kind) => (p) => p.y < (HABITS[kind].floor ?? 1.95) || (p.y < 1.95 && (p.x < yard.x0 + 0.25 || p.x > yard.x1 - 0.25 || p.z < yard.z0 + 0.25)) || (wire && toLine(p, wire) < 1.05) || trunks.some((t) => t.kind !== kind && Math.hypot(p.x - t.x, p.z - t.z) < t.r + 0.45)
    || (kind === 'willow' && Math.hypot(p.x - GROVE.willow.at[0], p.z - GROVE.willow.at[1]) > GROVE.willow.reach) // (the willow kept to its reach)
    || ((kind === 'willow' || kind === 'oak') && under.some((b) => p.x > b.x0 - 0.2 && p.x < b.x1 + 0.2 && p.z > b.z0 - 0.2 && p.z < b.z1 + 0.2 && (p.y < b.top + 0.5 || (kind === 'oak' && b.tall)))); // (they two, moved, kept off the swing, the shed, the slide, the flamingos — and nothing of the oak over the swing at all; the others as they were)
  const byFence = (x, z, m) => Math.min(Math.abs(x - yard.x0), Math.abs(x - yard.x1), Math.abs(z - yard.z0)) < m; // (a leaf low by it would go through the boards)
  const grown = {};
  for (const kind of ['oak', 'maple', 'willow', 'birch']) {
    const H = HABITS[kind], [x, z] = GROVE[kind].at, r = mulberry32(GROVE[kind].seed ?? 700 + kind.length * 31 + Math.round(x * 10));
    const G = { H, r, limbs: [], ends: [], room: (p, d, len) => insideYard(p, d, len), blocked: blockedFor(kind) };
    // the oak's great limb that went out towards the swing, up over it (user, 2026-10-18): turned up instead
    const toward = under.find((b) => b.tall);
    if (kind === 'oak' && toward) {
      const sx = (toward.x0 + toward.x1) / 2 - x, sz = (toward.z0 + toward.z1) / 2 - z, sl = Math.hypot(sx, sz);
      G.steer = (cd) => {
        const hl = Math.hypot(cd.x, cd.z);
        if (hl > 0.2 && (cd.x * sx + cd.z * sz) / (hl * sl) > 0.7) cd.set((cd.x / hl) * 0.4, 0.92, (cd.z / hl) * 0.4).normalize();
      };
    }
    const lean = new THREE.Vector3(Math.sin(r() * 6.3), 0, Math.cos(r() * 6.3)).multiplyScalar(H.trunk.lean);
    grow(G, new THREE.Vector3(x, -0.05, z), UP.clone().add(lean).normalize(), H.trunk.len, H.trunk.r, 0, H.trunk); // (as it was: the same draws from r, the same trees)
    grown[kind] = { H, x, z, r, G };
  }
  // the crowns meet and mingle, but none grows right into the birch's middle (user, 2026-10-18: the branches
  // going into the birch cut back — "not all of them, only so none goes right inside it"): the oak's and the
  // spruce's end 1.5 m from its trunk
  const bt = grown.birch.G.limbs[0].pts;
  const intoBirch = (p) => {
    if (p.y < 1.9 || p.y > bt[bt.length - 1].y + 1) return false;
    let i = 1;
    while (i < bt.length - 1 && bt[i].y < p.y) i++;
    const a = bt[i - 1], b = bt[i], k = Math.min(1, Math.max(0, (p.y - a.y) / (b.y - a.y || 1)));
    return Math.hypot(p.x - (a.x + (b.x - a.x) * k), p.z - (a.z + (b.z - a.z) * k)) < 1.5;
  };
  for (const kind of ['oak', 'maple', 'willow']) cutBack(grown[kind].G, intoBirch);
  for (const kind of ['oak', 'maple', 'willow', 'birch']) {
    const { H, x, z, r, G } = grown[kind];
    // the wood: the trunk flaring into buttresses and its roots, the limbs swelling where they leave it
    const out = { pos: [], nor: [], uv: [], col: [], idx: [], mix: [], wound: [], profile: [] }, r2 = mulberry32(900 + kind.length * 17), ph = r2() * 6.3;
    const dark = (p) => 0.78 + 0.22 * THREE.MathUtils.smoothstep(p.y, 0.0, 0.7);
    const wounds = kind === 'oak' ? oakWounds(G.limbs) : new Map();
    for (const [n, { pts, rad, level }] of G.limbs.entries()) tube(out, pts, rad, level === 0 ? 16 : level === 1 ? 10 : level === 2 ? 6 : 4, dark, { kind, foot: level === 0 ? { kind, y0: 0, ph } : null, collar: level > 0, wounds: wounds.get(n) });
    const buried = roots(out, kind, x, z, H.trunk.r, ph, r2, dark);
    const showing = { oak: 3, maple: 2, willow: 2 }[kind]; // (and some that show, out of the leaves)
    const showingRoots = !showing ? [] : surfaceRoots(out, kind, x, z, H.trunk.r, showing, mulberry32(1200 + kind.length * 7), dark, (p, rad) =>
      p.x > yard.x0 + 0.3 && p.x < yard.x1 - 0.3 && p.z > yard.z0 + 0.3 && p.z < yard.z1 - 0.3
      && trunks.every((t) => t.kind === kind || Math.hypot(p.x - t.x, p.z - t.z) > t.r + 0.35 + rad)
      && under.every((b) => p.x < b.x0 - 0.15 - rad || p.x > b.x1 + 0.15 + rad || p.z < b.z0 - 0.15 - rad || p.z > b.z1 + 0.15 + rad));
    g.add(meshOf(out, barkMat(kind)));
    const L = H.leaves;
    if (L.curtain) {
      // the willow: its shoots hanging from everything in curtains, longest round the outside, nearly to the ground
      const { cards, place } = willowCurtain(G, L, x, z, GROVE[kind].reach, { yard, wire, trunks, under, kind });
      g.add(leafCards(cards, T.willowStrandTex(), L.tint, true, r, place, { lift: 0.15, near: [0.3, 0.9] }));
      trees[kind] = { limbs: G.limbs, leaves: cards, roots: [...buried, ...showingRoots], trunk: { x, z, rings: fillRings(out.profile) } };
    } else {
      // leaves: along the branches and twigs, none low, none in the wire, none through another's trunk
      const spots = leafSpots(G, L).filter(([lx, ly, lz, s]) => ly - s * 0.5 > L.minY - 0.6 && ly > L.minY && !(byFence(lx, lz, s * 0.55) && ly - s * 0.5 < 1.95) && (!wire || toLine(new THREE.Vector3(lx, ly, lz), wire) > s * 0.6 + 0.3) && !trunks.some((t) => t.kind !== kind && Math.hypot(lx - t.x, lz - t.z) < t.r + s * 0.4)
        && !(kind === 'oak' && under.some((b) => lx > b.x0 - s * 0.5 && lx < b.x1 + s * 0.5 && lz > b.z0 - s * 0.5 && lz < b.z1 + s * 0.5 && (ly - s * 0.5 < b.top + 0.1 || b.tall)))); // (the oak's, moved, not down over the swing and the rest, and none over the swing at all)
      g.add(leafCards(spots, T.leafSprayTex(kind), L.tint, L.hang, r, null, L.near ? { near: L.near } : {}));
      trees[kind] = { limbs: G.limbs, leaves: spots, roots: [...buried, ...showingRoots], trunk: { x, z, rings: fillRings(out.profile) } };
    }
    ctx.colliders.push({ type: 'seg', ax: x, az: z, bx: x + 0.001, bz: z, r: H.trunk.r * 1.2 + 0.04, hose: false }); // the trunk in your way (the hose lies against its own shape: `trunk`)
    for (const { pts, rad, level } of G.limbs) { // and limbs low enough to walk into (the oak's)
      if (!level) continue;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], low = Math.min(a.y, b.y) - rad[i];
        if (low > 1.5) continue;
        ctx.colliders.push({ type: 'seg', ax: a.x, az: a.z, bx: b.x, bz: b.z, r: rad[i] + 0.04, base: low, top: Math.max(a.y, b.y) + rad[i] });
      }
    }
  }
  trees.spruce = spruce(g, ctx, GROVE.spruce, yard, wire, trunks, intoBirch);
  return trees;
}

/**
 * A weeping willow's curtains (user, 2026-10-18: "very thick"): from all along its limbs, branches and twigs,
 * every hand's breadth, a hanging shoot — a stack of tall narrow cards one under the other, straight down,
 * turned mostly across the way out from the trunk. Those on the outside of the crown (the furthest out, that
 * way round) come down nearly to the ground, a curtain; those further in hang a metre or two, layer over
 * layer, so the crown is a dome of them. None past its reach, through another tree's trunk, over the fence,
 * in the wire, over what is to be kept clear (`under`, `clear`), or lower than the top of what else stands
 * under them.
 */
function willowCurtain(G, L, tx, tz, reach, { yard, wire, trunks, under, kind }) {
  const r = mulberry32(951), cards = [], place = [], q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3();
  const from = [], BINS = 48, edge = new Float32Array(BINS); // where shoots hang from; how far out the crown reaches, each way round
  const bin = (x, z) => Math.floor(((Math.atan2(z - tz, x - tx) / (2 * Math.PI) + 1) % 1) * BINS) % BINS;
  for (const { pts, level } of G.limbs) { // (off its great limbs as well as everything after them)
    if (!level) continue;
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = pts[i].distanceTo(pts[i - 1]); segs.push(d); total += d; }
    for (let at = r() * L.every; at <= total; at += L.every * (0.6 + r() * 0.8)) {
      let i = 0, run = at;
      while (i < segs.length - 1 && run > segs[i]) run -= segs[i++];
      p.copy(pts[i]).lerp(pts[i + 1], Math.min(1, run / segs[i]));
      const x = p.x + (r() - 0.5) * 0.12, z = p.z + (r() - 0.5) * 0.12, top = p.y + 0.05 + r() * 0.12, out = Math.hypot(x - tx, z - tz);
      if (top < 1.4 || out > reach * 1.05) continue;
      from.push([x, top, z, out]);
      const k = bin(x, z);
      edge[k] = Math.max(edge[k], out);
    }
  }
  const rim = Array.from(edge, (_, k) => Math.max(edge[(k + BINS - 1) % BINS], edge[k], edge[(k + 1) % BINS]) * 0.5 + edge[k] * 0.5); // (smoothed a little)
  const curtainTop = new Float32Array(BINS), outsideOf = from.map(([x, top, z, out]) => out > rim[bin(x, z)] - 0.4 - r() * 0.3);
  from.forEach(([x, top, z], i) => { if (outsideOf[i]) curtainTop[bin(x, z)] = Math.max(curtainTop[bin(x, z)], top); });
  for (const [i, [x, top, z, out]] of from.entries()) {
    const ground = L.minY + r() * 0.45, outside = outsideOf[i], k = bin(x, z);
    // a shoot further in that hangs down behind the curtain, all of it lower than where the curtain begins,
    // can't be seen from outside, and under the tree it only crowds the room round the trunk: left off (half
    // of them; every card is drawn whole, layer after layer, and the willow made the yard lag)
    if (!outside && top < Math.min(curtainTop[k], curtainTop[(k + 1) % BINS], curtainTop[(k + BINS - 1) % BINS]) - 0.2) continue;
    let low = outside ? ground : Math.max(ground, top - (0.9 + r() * 1.3));
    if (x < yard.x0 + 0.2 || x > yard.x1 - 0.2 || z < yard.z0 + 0.2 || z > yard.z1 - 0.2) continue;
    if (trunks.some((t) => t.kind !== kind && Math.hypot(x - t.x, z - t.z) < t.r + 0.4)) continue;
    let over = false;
    for (const b of under) if (x > b.x0 - 0.25 && x < b.x1 + 0.25 && z > b.z0 - 0.25 && z < b.z1 + 0.25) { if (b.clear) over = true; else low = Math.max(low, b.top + 0.15); }
    if (over) continue; // (nothing hangs over the swing, the slide, the shed)
    if (top - low < 0.45) continue;
    if (wire && toLine(new THREE.Vector3(x, top, z), wire) < 0.6) continue;
    const yaw = Math.atan2(x - tx, z - tz) + Math.PI / 2 + (r() - 0.5) * 1.8; // across the way out, more or less
    const H = L.card * (0.85 + r() * 0.3);
    for (let y = top; y > low + 0.05; y -= H * 0.8) {
      const mid = Math.max(y - H / 2, low + H / 2); // (the last card no lower than the shoot reaches)
      e.set((r() - 0.5) * 0.12, yaw + (r() - 0.5) * 0.5, (r() - 0.5) * 0.08, 'YXZ');
      q.setFromEuler(e);
      cards.push([x + (r() - 0.5) * 0.05, mid, z + (r() - 0.5) * 0.05, H, 0, 0, 0, 0.3 * (r() < 0.5 ? -1 : 1), 1]);
      place.push(q.clone());
      if (mid - H / 2 <= low + 0.01) break;
    }
  }
  return { cards, place };
}

/**
 * The spruce: a straight trunk to its point, bare low down but for a few dead stubs, then whorls of branches
 * all the way up — the lowest longest, sweeping down and lifting at their tips, shoots hanging under them —
 * dark, dense, a tall cone.
 */
function spruce(g, ctx, { at: [x, z], reach }, yard, wire, trunks, keepOut = () => false) {
  const r = mulberry32(733), h = 16.5, base = 1.9, limbs = [], out = { pos: [], nor: [], uv: [], col: [], idx: [], mix: [], wound: [], profile: [] };
  const trunk = [], trad = [];
  for (let y = -0.05; y <= h; y += 0.45) {
    trunk.push(new THREE.Vector3(x + Math.sin(y * 0.5) * 0.03, y, z + Math.cos(y * 0.4) * 0.03));
    trad.push(0.3 * (1 - y / h) ** 0.9 + 0.01); // (its foot flares in tube())
  }
  limbs.push({ pts: trunk, rad: trad, level: 0 });
  const near = (p) => (wire && toLine(p, wire) < 1.0) || trunks.some((t) => t.kind !== 'spruce' && Math.hypot(p.x - t.x, p.z - t.z) < t.r + 0.5);
  // the dead stubs under the crown, short, bare, pointing a little down
  for (let y = 0.9; y < base; y += 0.25 + r() * 0.3) {
    const a = r() * Math.PI * 2, len = 0.15 + r() * 0.45, d = new THREE.Vector3(Math.cos(a), -0.15 - r() * 0.2, Math.sin(a)).normalize();
    const p0 = new THREE.Vector3(x, y, z);
    limbs.push({ pts: [p0, p0.clone().addScaledVector(d, len * 0.5), p0.clone().addScaledVector(d, len)], rad: [0.02, 0.014, 0.006], level: 1 });
  }
  const cards = [], place = [];
  const q = new THREE.Quaternion(), mtx = new THREE.Matrix4(), X = new THREE.Vector3(), Yv = new THREE.Vector3(), Z = new THREE.Vector3();
  let spin = r() * 6.3;
  for (let y = base; y < h - 0.4; y += 0.36 + r() * 0.1) {
    const up = (y - base) / (h - base), count = 5 + Math.floor(r() * 2);
    spin += 0.5 + r() * 0.4;
    for (let k = 0; k < count; k++) {
      const a = spin + (k / count) * Math.PI * 2 + (r() - 0.5) * 0.4;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      let len = (reach - 0.15) * (1 - up) ** 0.85 + 0.2 + (r() - 0.5) * 0.15;
      if (y < 2.1) for (const [v, lo, hi, c] of [[dir.x, yard.x0 + 0.25, yard.x1 - 0.25, x], [dir.z, yard.z0 + 0.25, yard.z1 - 0.25, z]]) { // low down, inside the fence
        if (v > 1e-6) len = Math.min(len, (hi - c) / v);
        if (v < -1e-6) len = Math.min(len, (c - lo) / -v);
      }
      const pitch = THREE.MathUtils.lerp(-0.3, 0.45, up), sag = 0.22 * (1 - up);
      const at = (s) => new THREE.Vector3(x + dir.x * s * len, y + Math.tan(pitch) * s * len - sag * Math.sin(Math.PI * s) * len + 0.12 * s ** 3 * len, z + dir.z * s * len);
      const into = () => near(at(1)) || [0.4, 0.6, 0.8, 1].some((f) => keepOut(at(f)));
      for (let tries = 0; tries < 6 && into(); tries++) len *= 0.8; // never into the wire or another trunk, or the birch's middle
      if (near(at(1))) continue;
      const pts = [], rad = [];
      for (let i = 0; i <= 6; i++) { pts.push(at(i / 6)); rad.push((0.04 * (len / reach) + 0.012) * (1 - (i / 6) * 0.8)); }
      limbs.push({ pts, rad, level: 1 });
      // three fronds along it, crossed, hanging from it as the texture does (the branch a third down from the card's top)
      const tip = pts[6], b0 = pts[0], chord = tip.clone().sub(b0), cl = chord.length();
      X.copy(chord).normalize();
      for (const roll of [-0.7, 0, 0.7]) {
        Yv.copy(UP).addScaledVector(X, -UP.dot(X)).normalize().applyAxisAngle(X, roll + (r() - 0.5) * 0.3);
        Z.crossVectors(X, Yv);
        mtx.makeBasis(X, Yv, Z);
        q.setFromRotationMatrix(mtx);
        const hgt = cl * 0.5 * 1.1, mid = b0.clone().addScaledVector(chord, 0.53).addScaledVector(Yv, -0.2 * hgt);
        mid.y += Math.max(0, 0.08 - (mid.y - hgt * 0.55)); // its hanging shoots never into the ground
        cards.push([mid.x, mid.y, mid.z, cl * 1.1, 0, 0, 0, 1]);
        place.push(q.clone());
      }
    }
  }
  // the point: a few shoots standing up
  for (let k = 0; k < 4; k++) {
    const a = k * 1.6;
    X.set(Math.cos(a) * 0.25, 1, Math.sin(a) * 0.25).normalize();
    Yv.set(-Math.cos(a), 0.25, -Math.sin(a)).normalize();
    Z.crossVectors(X, Yv);
    Yv.crossVectors(Z, X);
    mtx.makeBasis(X, Yv, Z);
    q.setFromRotationMatrix(mtx);
    cards.push([x, h - 0.35, z, 0.8, 0, 0, 0, 1]);
    place.push(q.clone());
  }
  const shade = (p) => 0.72 + 0.28 * THREE.MathUtils.smoothstep(p.y, 0, 0.6), r2 = mulberry32(911), ph = r2() * 6.3;
  for (const { pts, rad, level } of limbs) tube(out, pts, rad, level ? 5 : 14, shade, { kind: 'spruce', foot: level ? null : { kind: 'spruce', y0: 0, ph }, collar: level > 0 });
  const buried = roots(out, 'spruce', x, z, 0.31, ph, r2, shade);
  g.add(meshOf(out, barkMat('spruce')));
  g.add(leafCards(cards, T.leafSprayTex('spruce'), [0.3, 0.25, 0.78], false, r, place));
  ctx.colliders.push({ type: 'seg', ax: x, az: z, bx: x + 0.001, bz: z, r: 0.42, hose: false }); // its trunk
  ctx.colliders.push({ type: 'seg', ax: x, az: z, bx: x + 0.001, bz: z, r: reach * 0.78, base: 0.9 }); // and its skirt, low branches hanging to a metre: no walking in under it
  return { limbs, leaves: cards, roots: buried, trunk: { x, z, rings: fillRings(out.profile) } };
}

/** A trunk's rings as tube() kept them, any direction it had no point in filled from its neighbours. */
function fillRings(rings) {
  for (const { r } of rings) {
    for (let pass = 0; pass < 3; pass++) for (let b = 0; b < r.length; b++) if (!r[b]) r[b] = Math.max(r[(b + 1) % r.length], r[(b + r.length - 1) % r.length]);
  }
  return rings;
}

/**
 * Thick trees just outside the fence, past the pool (user, 2026-11-01), grown as the grove's are but apart from it (none of
 * this draws from its dice): some of their crowns come down over the fence into the garden — boughs reaching in and sagging
 * under their own leaves — and a few, nearest the angel, are hung with grey moss in long beards, as in his photographs.
 * `yard`: the whole yard (x0, x1, x2, z0, step); `wire`: every line overhead.
 */
export function outsideTrees(g, ctx, { yard, wire, under = [] }) {
  const { x0, x2, z0, step } = yard, trees = {}, beards = [];
  const LIST = {
    a: { kind: 'oak', at: [-4.05, z0 - 1.0], reach: 3.9, seed: 1931, inward: [0.2, 1], boughs: 5, beard: false },
    b: { kind: 'maple', at: [-0.5, z0 - 0.9], reach: 3.4, seed: 1947, inward: [-0.1, 1], boughs: 2, beard: false },
    c: { kind: 'oak', at: [3.3, z0 - 1.0], reach: 3.6, seed: 2011, inward: [0, 1], boughs: 5, beard: false },
    d: { kind: 'maple', at: [7.05, z0 - 0.95], reach: 3.4, seed: 2029, inward: [0.25, 1], boughs: 4, beard: true },
    e: { kind: 'oak', at: [x2 + 1.0, z0 + 4.4], reach: 3.7, seed: 2053, inward: [-1, 0.1], boughs: 5, beard: true },
    f: { kind: 'maple', at: [x0 - 0.95, z0 + 3.2], reach: 3.3, seed: 2069, inward: [1, -0.1], boughs: 4, beard: false },
  };
  const inGarden = (p) => p.x > x0 && p.x < x2 && p.z > z0 && p.z < step;
  const atFence = (x, z, m) => (z < step + m && ((Math.abs(x - x0) < m || Math.abs(x - x2) < m) && z > z0 - m)) || (Math.abs(z - z0) < m && x > x0 - m && x < x2 + m);
  const trunks = Object.entries(LIST).map(([k, v]) => ({ name: k, x: v.at[0], z: v.at[1], r: HABITS[v.kind].trunk.r * 1.2 }));
  for (const [name, { kind, at: [x, z], reach, seed, inward, boughs, beard }] of Object.entries(LIST)) {
    const H0 = HABITS[kind], r = mulberry32(seed);
    const H = { ...H0, trunk: { ...H0.trunk, len: H0.trunk.len * 0.82, r: H0.trunk.r * 0.88 }, levels: H0.levels.map((l, i) => (i === 2 ? { ...l, kids: Math.max(3, l.kids - 2) } : l)) };
    const blocked = (p) => p.y < (inGarden(p) ? 1.4 : 2.05) || (atFence(p.x, p.z, 0.3) && p.y < 2.1) || (wire && toLine(p, wire) < 1.05)
      || trunks.some((t) => t.name !== name && Math.hypot(p.x - t.x, p.z - t.z) < t.r + 0.4) || Math.hypot(p.x - x, p.z - z) > reach * (p.y > 4.4 ? 1.05 : 1.5) // (the boughs reach in low; high up the crowns leave the sky over the pool)
      || under.some((b) => p.x > b.x0 - 0.2 && p.x < b.x1 + 0.2 && p.z > b.z0 - 0.2 && p.z < b.z1 + 0.2 && p.y < b.top + 0.5);
    const G = { H, r, limbs: [], ends: [], room: (p, d, len) => len, blocked };
    const lean = new THREE.Vector3(inward[0], 0, inward[1]).normalize().multiplyScalar(0.07);
    grow(G, new THREE.Vector3(x, -0.05, z), UP.clone().add(lean).normalize(), H.trunk.len, H.trunk.r, 0, H.trunk);
    // the boughs coming in over the fence, sagging
    const trunk = G.limbs[0], side = new THREE.Vector3(-inward[1], 0, inward[0]).normalize();
    for (let b = 0; b < boughs; b++) {
      const t = 0.5 + r() * 0.34, [at] = along(trunk.pts, t), d = new THREE.Vector3(inward[0], 0.32 + r() * 0.2, inward[1]).normalize().addScaledVector(side, (b / Math.max(1, boughs - 1) - 0.5) * 1.5 + (r() - 0.5) * 0.25).normalize();
      grow(G, at, d, reach * (0.85 + r() * 0.4), 0.07 + r() * 0.035, 1, { seg: 0.3, rise: 0, droop: 0.3 + r() * 0.16, wob: 0.17, kink: 0.14, tip: 0.3 }, { limb: trunk, t });
    }
    const out = { pos: [], nor: [], uv: [], col: [], idx: [], mix: [], wound: [], profile: [] }, r2 = mulberry32(seed + 77), ph = r2() * 6.3;
    const dark = (p) => 0.7 + 0.3 * THREE.MathUtils.smoothstep(p.y, 0.0, 0.9);
    for (const { pts, rad, level } of G.limbs) tube(out, pts, rad, level === 0 ? 14 : level === 1 ? 8 : level === 2 ? 5 : 4, dark, { kind, foot: level === 0 ? { kind, y0: 0, ph } : null, collar: level > 0 });
    roots(out, kind, x, z, H.trunk.r, ph, r2, dark);
    g.add(meshOf(out, barkMat(kind)));
    // leaves all over, thick; those on the far side, that nobody sees from the garden, mostly left off
    const L = { ...H.leaves, every: H.leaves.every * 0.92, hang: true }, rl = mulberry32(seed + 3);
    const away = (lx, lz) => -((lx - x) * inward[0] + (lz - z) * inward[1]) / Math.hypot(inward[0], inward[1]);
    const spots = leafSpots(G, L).filter(([lx, ly, lz, s]) => ly - s * 0.5 > 0.95 && !(atFence(lx, lz, s * 0.55) && ly - s * 0.5 < 1.95) && (!wire || toLine(new THREE.Vector3(lx, ly, lz), wire) > s * 0.6 + 0.3)
      && !under.some((b) => lx > b.x0 - s * 0.5 && lx < b.x1 + s * 0.5 && lz > b.z0 - s * 0.5 && lz < b.z1 + s * 0.5 && ly - s * 0.5 < b.top + 0.1) && (away(lx, lz) < 1.2 || rl() < 0.3));
    g.add(leafCards(spots, T.leafSprayTex(kind, 3), L.tint.map((v, i) => v * [1, 0.95, 0.92][i]), true, r, null, { near: [0.25, 0.75] }));
    ctx.colliders.push({ type: 'seg', ax: x, az: z, bx: x + 0.001, bz: z, r: H.trunk.r * 1.2 + 0.04, hose: false });
    if (beard) { // the moss in beards, off the undersides of its limbs and branches, straight down: there is no wind
      const rm = mulberry32(seed + 11);
      for (const { pts, rad, level } of G.limbs) {
        if (level < 1 || level > 2) continue;
        let run = rm() * 0.4;
        for (let i = 0; i < pts.length - 1; i++) {
          const seg = pts[i].distanceTo(pts[i + 1]);
          for (; run < seg; run += 0.22 + rm() * 0.5) {
            const p = pts[i].clone().lerp(pts[i + 1], run / seg);
            if (p.y < 2.2 || p.y > 9 || rm() > 0.85 * (fbm2(p.x * 0.8 + seed, p.z * 0.8) > 0.4 ? 1 : 0.35)) continue;
            const len = 0.6 + rm() ** 1.4 * 1.7, wide = 0.24 + rm() * 0.22, top = p.y - rad[i] * 0.6;
            if (top - len < 1.25 || (atFence(p.x, p.z, wide) && top - len < 1.95) || under.some((b) => p.x > b.x0 - 0.2 && p.x < b.x1 + 0.2 && p.z > b.z0 - 0.2 && p.z < b.z1 + 0.2 && top - len < b.top + 0.2)) continue;
            if (wire && toLine(p, wire) < 1.0) continue;
            const yaw = rm() * Math.PI;
            for (const turn of [0, Math.PI / 2 + (rm() - 0.5) * 0.6]) beards.push([p.x + (rm() - 0.5) * 0.05, top - len / 2, p.z + (rm() - 0.5) * 0.05, len, yaw + turn, wide / len]);
          }
          run -= seg;
        }
      }
    }
    trees[name] = { kind, limbs: G.limbs, leaves: spots };
  }
  if (beards.length) {
    const rb = mulberry32(1963), q = new THREE.Quaternion(), e = new THREE.Euler();
    const place = beards.map(([, , , , yaw]) => q.setFromEuler(e.set(0, yaw, 0)).clone());
    const spots = beards.map(([bx, by, bz, len, , k]) => [bx, by, bz, len, 0, 0, 0, k, 1]);
    const moss = leafCards(spots, T.hangingMossTex(), [0.17, 0.08, 0.72], true, rb, place, { lift: 0.4, near: [0.2, 0.6] });
    moss.castShadow = false; // (wisps: their shadow was a grey smear on the paving)
    g.add(moss);
    trees.beards = beards.length;
  }
  return trees;
}
/** A smooth value 0…1 over the ground (where the moss has taken on a tree). */
function fbm2(x, z) {
  return 0.5 + 0.25 * Math.sin(x * 1.7 + Math.sin(z * 1.3)) + 0.25 * Math.sin(z * 2.1 + Math.cos(x * 0.9) * 1.5);
}
