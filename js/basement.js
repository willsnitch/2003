// The storm cellar (user, 2026-10-21): its way in, out in the yard against the bedroom's north wall — two leaning
// doors of old painted steel (2026-10-22: they were timber) on a worn concrete curb, padlocked, that rattle and won't
// give until the third go tears the lock's staple out of the steel rusted thin under it — and under them concrete
// steps going down beneath the house into a basement nobody has been down to in years. It has no light of its own at
// all: only a torch left lying in the grass by the doors (held, it is on), and what little comes down the steps from
// the open doors. Dust on everything; an old
// sofa worn right through, facing a television turned to the wall; boxes; shapes under sheets; and at its far side a
// way on, panelled, further than the house goes. It is a scene of its own, drawn after the house against the same
// depth (main.js), lit by those and nothing else.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import * as F from './fixtures.js';
import { ROOM } from './room.js';
import { mulberry32, deg } from './util.js';
import { slab, flat, metric, bakeStatic, outdoorSun } from './build.js';
import { CELLAR as C, wornWood } from './yard.js';
import { takeable } from './props.js';

const t = ROOM.T;
const std = (o) => new THREE.MeshStandardMaterial(o);
export const TORCH = 'torch';
/** The basement's floor, and the underside of its joists (the house's floor, 0, over them). */
const FL = -2.42, CE = -0.32;
/** Its walls' inner faces; and a passage on, east out of its far wall — finished once, panelled, its ceiling lower. */
const ROOMB = { x0: -0.6, x1: 5.4, z0: 0.5, z1: 5.7 };
const HALL = { x0: 5.4, x1: 10.4, z0: 2.7, z1: 3.6, top: -0.52 };
const TH = 0.2; // its walls' thickness, outward
/** Where the basement's room is, walls and all: the house's foundation keeps out of it (house.js — from down there it hung through its ceiling). */
export const UNDER = { x0: ROOMB.x0 - TH, x1: ROOMB.x1 + TH, z0: ROOMB.z0 - TH, z1: ROOMB.z1 + TH };
/** The torch's light: warm, a bulb's; reach in metres; its cone. */
const BEAM = { color: 0xffd9a8, power: 4.2, reach: 14, angle: 0.62, soft: 0.5 };

/**
 * Dust, on everything down here (user, 2026-10-21: "lots of dusty things"): thickest on what faces up, a little on
 * everything, never even. `k`: how much (1: years of it).
 */
function dusty(m, k = 1) {
  const before = m.onBeforeCompile, key = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => {
    before.call(m, sh, r);
    sh.uniforms.uDust = { value: k };
    sh.vertexShader = 'varying vec3 vDustW;\nvarying vec3 vDustN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
	#ifdef USE_INSTANCING
		vDustW = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
		vDustN = normalize( mat3( modelMatrix ) * mat3( instanceMatrix ) * objectNormal );
	#else
		vDustW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
		vDustN = normalize( mat3( modelMatrix ) * objectNormal );
	#endif`);
    sh.fragmentShader = `uniform float uDust;
varying vec3 vDustW;
varying vec3 vDustN;
float dHash( vec2 p ) { return fract( sin( dot( p, vec2( 41.3, 289.1 ) ) ) * 9737.31 ); }
float dNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( dHash( i ), dHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( dHash( i + vec2( 0.0, 1.0 ) ), dHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
	{
		vec3 dn = normalize( vDustN );
		vec2 dq = vDustW.xz * abs( dn.y ) + vDustW.xy * abs( dn.z ) + vDustW.zy * abs( dn.x );
		float lie = 0.2 + 0.8 * smoothstep( 0.15, 0.85, dn.y );
		float dust = uDust * lie * ( 0.45 + 0.55 * dNoise( dq * 7.0 ) + 0.25 * dNoise( dq * 41.0 ) );
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.25, 0.24, 0.22 ), clamp( dust * 0.6, 0.0, 0.8 ) );
	}`);
  };
  m.customProgramCacheKey = () => key() + '|dust';
  return m;
}

/** Into `parent` at x, y, z, casting and taking shadows. */
function put(parent, mesh, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const rbox = (w, h, d, r, mat, seg = 2) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)), mat);
const cylY = (r0, r1, h, mat, seg = 20) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);

/** `geo`'s vertices from y0 up, sheared so its top runs from `lo` (at z0) to `hi` (at z1): the cheeks' slope. Its normals follow. */
function slope(geo, y0, top, z0, z1, lo, hi) {
  const p = geo.attributes.position, n = geo.attributes.normal, H = top - y0;
  const k = (z) => (lo + ((hi - lo) * (z - z0)) / (z1 - z0) - y0) / H, dk = (hi - lo) / (z1 - z0) / H;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i), kz = k(z);
    p.setY(i, y0 + (y - y0) * kz);
    const nx = n.getX(i), ny = n.getY(i) / kz, nz = n.getZ(i) - (dk * (y - y0) * n.getY(i)) / kz, l = Math.hypot(nx, ny, nz);
    n.setXYZ(i, nx / l, ny / l, nz / l);
  }
  return geo;
}

/** `geo`'s uv from where each point is, `p` metres to the picture, each face by the way it faces (as build.js's slab). */
function metricUV(geo, p) {
  const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i));
    const [u, v] = nx >= ny && nx >= nz ? [P.getZ(i), P.getY(i)] : ny >= nz ? [P.getX(i), P.getZ(i)] : [P.getX(i), P.getY(i)];
    UV.setXY(i, u / p, v / p);
  }
  return geo;
}

/**
 * A leaf of the storm cellar's steel doors (user, 2026-10-22: "the doors are metal"): a pan of sheet steel, its top
 * turned down all round into a rim, the bend never quite even; ribs pressed up along it at `ribs`; `bend(u, z)`: how
 * far it is pushed out of true there (a dent down, a corner bent up). Hollow underneath, three channels across it.
 * Built in u (0 at the hinge … `half` at the edge where it meets the other leaf; along x the way `s` says), z (its
 * foot … `Ls`) and y up off the slope to `TB`. `top`: the painted outside, its uv the leaf's picture (u across, z up
 * — T.cellarDoorTex); `inside`: the steel's inside, seen only when it stands open.
 */
function steelLeaf(half, Ls, TB, s, ribs, bend) {
  const SK = 0.003, RIB = 0.008, RW = 0.03, rest = 0.0005; // the sheet; a rib's height and half-width; the rim's foot off the concrete
  const lines = (L, extra = []) => { // where its grid runs: every 2 cm, closer at the edges (the bend) and across the ribs
    const v = new Set(), n = Math.ceil(L / 0.02);
    for (let i = 0; i <= n; i++) v.add(+((i * L) / n).toFixed(5));
    for (const e of [0.0012, 0.003, 0.0055, 0.009]) { v.add(e); v.add(+(L - e).toFixed(5)); }
    for (const e of extra) if (e > 0.012 && e < L - 0.012) v.add(+e.toFixed(5));
    return [...v].sort((p, q) => p - q);
  };
  const us = lines(half, ribs.flatMap((c) => [-1, -0.66, -0.33, 0, 0.33, 0.66, 1].map((k) => c + k * RW))), zs = lines(Ls);
  const R = (t) => 0.0042 + 0.0016 * Math.sin(t * 17 + s * 2) + 0.0008 * Math.sin(t * 43 + 1); // the bend's radius, along each edge its own
  const drop = (d, rad) => (d >= rad ? 0 : rad - Math.sqrt(Math.max(0, rad * rad - (rad - d) ** 2)));
  const rib = (u, z) => {
    const e = THREE.MathUtils.smoothstep(Math.min(z - 0.07, Ls - 0.07 - z), 0, 0.06);
    let h = 0;
    for (const c of ribs) { const q = Math.abs(u - c) / RW; if (q < 1) h = Math.max(h, RIB * 0.5 * (1 + Math.cos(Math.PI * q)) * e); }
    return h;
  };
  const top = (u, z) => TB - Math.max(drop(u, R(z)), drop(half - u, R(z + 3)), drop(z, R(u + 7)), drop(Ls - z, R(u + 11))) + rib(u, z) + bend(u, z);
  const foot = (u, z) => rest + Math.max(0, bend(u, z));
  const out = { top: [], inside: [] }, f = new THREE.Vector3(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
  // a surface over A × B, each point at(a, b) → [u, y, z], its faces turned towards `face`
  const sheet = (A, B, at, face, list) => {
    const pos = [], uv = [], idx = [], n = A.length;
    for (const b of B) for (const a of A) { const [u, y, z] = at(a, b); pos.push(s * u, y, z); uv.push(u / half, z / Ls); }
    for (let j = 0; j < B.length - 1; j++) for (let i = 0; i < n - 1; i++) {
      const k = j * n + i;
      for (const tri of [[k, k + n, k + 1], [k + 1, k + n, k + n + 1]]) {
        p0.fromArray(pos, tri[0] * 3); p1.fromArray(pos, tri[1] * 3); p2.fromArray(pos, tri[2] * 3);
        if (f.subVectors(p1, p0).cross(p2.sub(p0)).dot(face) < 0) tri.reverse();
        idx.push(...tri);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    list.push(geo);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // outside: the top, and the rim turned down from it all round
  sheet(us, zs, (u, z) => [u, top(u, z), z], V(0, 1, 0), out.top);
  sheet(zs, [0, 1], (z, k) => [0, k ? foot(0, z) : top(0, z), z], V(-s, 0, 0), out.top);
  sheet(zs, [0, 1], (z, k) => [half, k ? foot(half, z) : top(half, z), z], V(s, 0, 0), out.top);
  sheet(us, [0, 1], (u, k) => [u, k ? foot(u, 0) : top(u, 0), 0], V(0, 0, -1), out.top);
  sheet(us, [0, 1], (u, k) => [u, k ? foot(u, Ls) : top(u, Ls), Ls], V(0, 0, 1), out.top);
  // inside: under the top, the rim's inner faces, the rim's foot (its thickness), three channels across
  const ui = [SK, ...us.filter((u) => u > SK + 1e-4 && u < half - SK - 1e-4), half - SK], zi = [SK, ...zs.filter((z) => z > SK + 1e-4 && z < Ls - SK - 1e-4), Ls - SK];
  sheet(ui, zi, (u, z) => [u, top(u, z) - SK, z], V(0, -1, 0), out.inside);
  sheet(zi, [0, 1], (z, k) => [SK, k ? foot(SK, z) : top(SK, z) - SK, z], V(s, 0, 0), out.inside);
  sheet(zi, [0, 1], (z, k) => [half - SK, k ? foot(half - SK, z) : top(half - SK, z) - SK, z], V(-s, 0, 0), out.inside);
  sheet(ui, [0, 1], (u, k) => [u, k ? foot(u, SK) : top(u, SK) - SK, SK], V(0, 0, 1), out.inside);
  sheet(ui, [0, 1], (u, k) => [u, k ? foot(u, Ls - SK) : top(u, Ls - SK) - SK, Ls - SK], V(0, 0, -1), out.inside);
  sheet(zs, [0, SK], (z, d) => [d, foot(d, z), z], V(0, -1, 0), out.inside);
  sheet(zs, [half - SK, half], (z, u) => [u, foot(u, z), z], V(0, -1, 0), out.inside);
  sheet(us, [0, SK], (u, d) => [u, foot(u, d), d], V(0, -1, 0), out.inside);
  sheet(us, [Ls - SK, Ls], (u, z) => [u, foot(u, z), z], V(0, -1, 0), out.inside);
  for (const zc of [0.2, Ls / 2, Ls - 0.22]) { // (a hat channel, its flanges against the steel: solid enough at this size)
    const geo = new THREE.BoxGeometry(half - 2 * SK - 0.004, 0.024, 0.04, 24, 1, 1);
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const u = P.getX(i) + half / 2, z = P.getZ(i) + zc; P.setXYZ(i, s * u, P.getY(i) + TB - SK - 0.012 + bend(u, z), z); }
    if (s < 0) { const ix = geo.index.array; for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]]; } // (mirrored: turned the right way out again)
    geo.computeVertexNormals();
    out.inside.push(geo);
  }
  return { top: mergeGeometries(out.top, false), inside: mergeGeometries(out.inside, false) };
}

/**
 * The cellar: its doors out in the yard (in `g`, the house's), and the basement under them (a scene of its own).
 * `lift`: how much lower the yard is than the house's floor; `redraw(frames)`: the sun's and the sky's shadows want
 * drawing again (the doors have moved); `occluders`: the house's list of what stops the eye (the basement's walls and
 * ceiling join it: nothing in the bedroom can be reached through its floor).
 */
export function cellar(g, ctx, { lift, redraw, occluders }) {
  const G = -lift, zf = C.z0 - C.sill / 2, zs = C.z0 + C.sill / 2, xa = C.x0 - C.side, xb = C.x1 + C.side, W = xb - xa;
  const r = mulberry32(5150);
  const top = (z) => G + C.curb + ((C.rise - C.curb) * (z - zf)) / (C.z1 - zf); // the cheeks' sloping tops
  const at = new THREE.Vector3((C.x0 + C.x1) / 2, G + 0.4, (zf + C.z1) / 2);

  // ---------------------------------------------------------------- out in the yard
  // the concrete: a sill across its foot, its cheeks up either side sloping up to the wall — worn, chipped along
  // every edge, the corners knocked off, green and dark where it meets the lawn
  const crete = std({ map: T.oldConcreteTex(), bumpMap: T.oldConcreteTex(true), bumpScale: 1.6, roughness: 0.95, vertexColors: true });
  g.add(wornWood([[xa, xb, G - 0.1, G + C.curb, zf, zs, { round: 0.016, nicks: 9, chips: 5, marks: 2, damp: [G - 0.1, G + 0.1], k: 0.95 }]], crete, r));
  for (const [x0, x1] of [[xa, C.x0], [C.x1, xb]]) {
    const cheek = wornWood([[x0, x1, G - 0.1, G + C.rise, zf, C.z1 - 0.002, { round: 0.016, nicks: 8, chips: 4, marks: 2, damp: [G - 0.1, G + 0.12], ends: [true, false], k: 0.95 }]], crete, r);
    slope(cheek.geometry, G - 0.1, G + C.rise, zf, C.z1, G + C.curb, G + C.rise);
    g.add(cheek);
  }
  // (the wooden doors drew this many numbers from `r` here: drawn and let go, so all that is drawn after — the steps'
  // wear, what lies about the basement — stays where it was; the steel ones draw from their own)
  for (let i = 0; i < 2711; i++) r();
  // the doors lean on the cheeks, their top ends against a steel header bolted to the wall: a box section, painted
  // with them once, rusting (user, 2026-10-22: "the doors are metal" — it was a timber ledger)
  const iron = std({ map: T.rustyMetalTex(91), color: 0x9a7c64, metalness: 0.3, roughness: 0.82 }); // (forged, gone brown with rust: not black — matte enough to show it in the shade)
  const steel = std({ map: T.rustyMetalTex(83), color: 0x7a8670, metalness: 0.2, roughness: 0.8 }); // (their green, mottled with rust: the header)
  put(g, new THREE.Mesh(metricUV(new RoundedBoxGeometry(W + 0.04, 0.14, 0.072, 2, 0.004), 0.6), steel), (xa + xb) / 2, G + C.rise + 0.03, C.z1 - 0.039);
  const bolt = (parent, x, y, z) => { const b = put(parent, new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), iron), x, y, z); b.scale.y = 0.55; return b; };
  for (const x of [xa + 0.18, (xa + xb) / 2, xb - 0.18]) bolt(g, x, G + C.rise + 0.03, C.z1 - 0.077).rotation.x = -Math.PI / 2;

  // the doors: a frame laid along the slope (x across, y up off it, z up it), a leaf hinged on each side of it
  const a = Math.atan2(C.rise - C.curb, C.z1 - zf), Ls = (C.z1 - 0.075 - zf) / Math.cos(a) - 0.01;
  const frame = new THREE.Group();
  frame.position.set(xa, G + C.curb + 0.001, zf);
  frame.rotation.x = -a;
  frame.userData.live = true; // (it moves: kept out of the bake)
  g.add(frame);
  const half = W / 2 - 0.004, TB = 0.032; // a leaf's width; how deep its steel is, rim and all
  // each leaf a pan of sheet steel (steelLeaf), painted a dark grey-green once, two ribs pressed up along it; dented
  // where it was knocked — and the east one's top corner by the other leaf bent up a little, as if something was once
  // levered under it
  const RIBS = [0.25, 0.48], HINGES = [0.24, Ls - 0.26], zh = Ls * 0.36, uh = half - 0.11, zl = 0.32;
  // (inside: the same paint, darker, never knocked or stood on — rusted only at its edges and the hinges; the galvanised
  // rust picture there before showed big red blots in the sun, open)
  const inside = std({ map: T.cellarDoorTex({ half, Ls, bolts: HINGES.flatMap((z) => [[0.04, z], [0.1, z]]), ribs: [], seed: 6199 }), color: 0xa4a89a, roughness: 0.85 });
  const dent = (u, z, [u0, z0, rad, d]) => { const q = Math.hypot(u - u0, z - z0) / rad; return q < 1 ? -d * (1 - q * q) ** 2 : 0; };
  const DENTS = { 1: [[0.44, 0.38, 0.07, 0.004], [0.31, 1.12, 0.05, 0.0025]], [-1]: [[0.36, 0.64, 0.09, 0.003]] }; // [u, z, radius, depth]
  const outOfTrue = {
    1: (u, z) => DENTS[1].reduce((y, d) => y + dent(u, z, d), 0),
    [-1]: (u, z) => DENTS[-1].reduce((y, d) => y + dent(u, z, d), 0) + 0.006 * Math.max(0, 1 - Math.hypot(half - u, Ls - z) / 0.22) ** 2,
  };
  const leaves = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.x = s > 0 ? 0 : W;
    frame.add(pivot);
    const bolts = [...HINGES.flatMap((z) => [[0.04, z], [0.1, z], [0.155, z]]), ...[-0.087, 0.087].flatMap((dz) => [[uh - 0.016, zh + dz], [uh + 0.016, zh + dz]])];
    const o = { half, Ls, bolts, handle: [uh, zh], lock: [half - 0.07, zl], ribs: RIBS, pools: DENTS[s], feet: true, seed: s > 0 ? 6101 : 6177 };
    const paint = std({ map: T.cellarDoorTex(o), bumpMap: T.cellarDoorTex(o, true), bumpScale: 1.4, roughness: 0.74 });
    const leaf = steelLeaf(half, Ls, TB, s, RIBS, outOfTrue[s]);
    put(pivot, new THREE.Mesh(leaf.top, paint));
    put(pivot, new THREE.Mesh(leaf.inside, inside));
    // the hinges: a short forged strap riveted across the top from the hinge side, an arm down its edge to the knuckle
    // on the hinge line, and under that a plate bolted to the cheek's side (in the frame: it doesn't move)
    const strap = new THREE.Shape([new THREE.Vector2(0, -0.022), new THREE.Vector2(0.13, -0.015), new THREE.Vector2(0.17, 0), new THREE.Vector2(0.13, 0.015), new THREE.Vector2(0, 0.022)]);
    for (const zc of HINGES) {
      const geo = new THREE.ExtrudeGeometry(strap, { depth: 0.006, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.0015, bevelSegments: 1 });
      geo.rotateX(Math.PI / 2); // (the shape lies flat on the steel: its y across it, along the slope)
      const m = put(pivot, new THREE.Mesh(geo, iron), 0, TB + 0.007, zc);
      if (s < 0) m.scale.x = -1;
      for (const u of [0.04, 0.1, 0.155]) bolt(pivot, s * u, TB + 0.008, zc);
      put(pivot, rbox(0.004, TB + 0.004, 0.05, 0.0015, iron), -s * 0.0025, (TB + 0.004) / 2 + 0.004, zc);
      put(pivot, new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.075, 12).rotateX(Math.PI / 2), iron), 0, 0, zc);
      const px = s > 0 ? -0.0025 : W + 0.0025;
      put(frame, rbox(0.004, 0.072, 0.07, 0.0015, iron), px, -0.046, zc);
      for (const dz of [-0.022, 0.022]) bolt(frame, px - s * 0.002, -0.062, zc + dz).rotation.z = s * Math.PI / 2;
    }
    // the handle: a thick bar of old iron bent into a D on two plates, near the inside edge, a third of the way up
    const xh = s * uh;
    const bar = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, 0, -0.075], [0, 0.04, -0.07], [0, 0.064, -0.035], [0, 0.068, 0], [0, 0.064, 0.035], [0, 0.04, 0.07], [0, 0, 0.075]].map((q) => new THREE.Vector3(...q))), 24, 0.0095, 8);
    put(pivot, new THREE.Mesh(bar, iron), xh, TB, zh);
    for (const dz of [-0.075, 0.075]) {
      put(pivot, rbox(0.05, 0.008, 0.05, 0.003, iron), xh, TB + 0.004, zh + dz);
      for (const dx of [-0.016, 0.016]) bolt(pivot, xh + dx, TB + 0.009, zh + dz + Math.sign(dz) * 0.012);
    }
    leaves.push({ s, pivot });
  }
  // the hasp on the right leaf (seen from the yard), folded over the gap onto a staple on the left one, and the
  // padlock through it: old, heavy, its iron gone brown; on the left leaf under the staple the steel is rusted thin
  const haspPivot = new THREE.Group();
  haspPivot.position.set(-half + 0.075, TB + 0.006, zl);
  leaves[1].pivot.add(haspPivot);
  put(haspPivot, rbox(0.05, 0.007, 0.06, 0.003, iron), 0.012, 0, 0);
  for (const dz of [-0.018, 0.018]) bolt(haspPivot, 0.02, 0.004, dz);
  put(haspPivot, new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 10).rotateX(Math.PI / 2), iron), 0, 0.002, 0);
  put(haspPivot, rbox(0.17, 0.006, 0.036, 0.003, iron), -0.085, 0.002, 0); // (over the gap)
  const lock = new THREE.Group(); // the staple and the padlock, through the hasp's slot at its end
  lock.position.set(-0.15, 0.004, 0);
  haspPivot.add(lock);
  put(lock, new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0035, 6, 12, Math.PI), iron), 0, 0, 0).rotation.y = Math.PI / 2;
  put(lock, rbox(0.03, 0.006, 0.07, 0.002, iron), 0, -0.005, 0);
  const swing = new THREE.Group(); // the padlock, hanging from the staple
  swing.position.set(0, 0.012, 0);
  lock.add(swing);
  const shackle = put(swing, new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0045, 8, 16, Math.PI), iron), 0, 0.0, 0);
  shackle.rotation.set(0, Math.PI / 2, Math.PI);
  put(swing, rbox(0.022, 0.06, 0.056, 0.008, std({ map: T.rustyMetalTex(97), color: 0xa07a56, metalness: 0.35, roughness: 0.72 }), 3), 0, -0.042, 0);
  put(swing, new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 10).rotateZ(Math.PI / 2), iron), 0.012, -0.05, 0);
  // where it tore out: a ragged hole in the rusted steel, its lips bent up, under where the staple was (shown once it has gone)
  const torn = put(leaves[0].pivot, new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.1).rotateX(-Math.PI / 2), std({ map: T.rustTearTex(), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })), W - half - 0.075, TB + 0.0015, zl); // (the staple's place, on the left leaf by its inner edge)
  torn.castShadow = false;
  torn.visible = false;

  // the torch, lying in the grass by the west cheek where someone dropped it — on its side, its glass towards the doors
  const torch = F.oldTorch();
  torch.position.set(xa - 0.4, G + 0.002, zf + 0.42);
  torch.rotation.y = 0.55;
  torch.userData.live = true;
  g.add(torch);
  // (lying out there it takes the open air's light; once taken, the plain kind, so it is lit right wherever it is held)
  const plain = new Map();
  torch.traverse((o) => { if (o.isMesh && !plain.has(o.material)) { plain.set(o.material, o.material.clone()); outdoorSun(o.material, true); } });
  const glow = torch.userData.glow.map((m) => plain.get(m));
  takeable(ctx, torch, {
    id: TORCH, name: 'torch', line: 'Somebody left a torch out here in the grass.', reach: [0.22, 0.07], grip: { turn: Math.PI / 2 },
    taken: () => { torch.traverse((o) => { if (o.isMesh) o.material = plain.get(o.material) ?? o.material; }); redraw(2); },
  })();

  // ---- in the way: the concrete; the doors while they are shut; the doors open, standing up off either side
  const box = (x0, x1, z0, z1, topY, extra = {}) => { const c = { type: 'box', x0, x1, z0, z1, base: -6, top: topY, ...extra }; ctx.colliders.push(c); return c; };
  box(xa, xb, zf, zs, G + C.curb, { stand: true, step: true, surface: 'concrete' });
  box(xa, C.x0, zf, C.z1, G + C.rise);
  box(C.x1, xb, zf, C.z1, G + C.rise);
  const shut = box(xa, xb, zf, C.z1, G + C.rise + 0.05);
  const stood = [box(xa - 0.24, xa, zf, C.z1, -10), box(xb, xb + 0.24, zf, C.z1, -10)];

  // ---- the doors at work: rattled against the lock, and the third time the rusted steel under the staple gives
  const D = { tries: 0, t: -1, open: false, theta: 0, haspAngle: 0, haspVel: 0, lockSwing: 0, lockVel: 0, settled: false };
  const OPEN = deg(104);
  const jolt = (e, at, amp, len = 0.13) => { const u = (e - at) / len; return u > 0 && u < 1 ? amp * Math.sin(Math.PI * u) * (1 - 0.35 * u) : 0; };
  const lines = ['Padlocked.', "The metal round the lock's rusted through. It moved.", ''];
  frame.userData.interact = {
    label: () => 'Open the cellar',
    when: () => !D.open && D.t < 0,
    use: () => {
      D.tries++;
      D.t = 0;
      ctx.sound.sample(D.tries < 3 ? 'cellar-rattle' : 'cellar-give', at);
    },
    say: () => lines[Math.min(2, D.tries - 1)],
  };
  ctx.interact.push(frame);
  const wd = new THREE.Vector3(), q = new THREE.Quaternion();
  function doorsStep(dt) {
    if ((D.t < 0 && !D.open) || D.settled) return;
    if (D.t >= 0) D.t += dt;
    const e = D.t;
    let L = 0, R = 0;
    if (!D.open) {
      if (D.tries < 3) { // tugged, twice, against the lock: up a hand's breadth and dropped back, the lock clattering
        L = jolt(e, 0, 0.05) + jolt(e, 0.26, 0.04) + jolt(e, 0.47, 0.018, 0.1);
        R = jolt(e, 0.02, 0.035) + jolt(e, 0.28, 0.03) + jolt(e, 0.49, 0.012, 0.1);
        if (e > 0.75) D.t = -1;
      } else { // harder; and at the second heave the staple tears out of the rusted steel: then they come up
        L = jolt(e, 0, 0.07) + jolt(e, 0.3, 0.1, 0.18);
        R = jolt(e, 0.02, 0.05) + jolt(e, 0.32, 0.06, 0.16);
        if (e > 0.36 && !torn.visible) { torn.visible = true; D.haspVel = -6; }
        if (e > 0.75) { D.open = true; D.t = 0; ctx.sound.sample('cellar-open', at); }
      }
      if (D.tries < 3 || !torn.visible) D.lockVel += (L + R) * 60 * dt * Math.sin(e * 40);
    } else { // swung right open, slow at first, heavy, dropping back against their stops with a bump
      const u = Math.min(1, e / 1.7), ease = u * u * (3 - 2 * u);
      L = R = OPEN * ease + (u >= 1 ? 0.035 * Math.exp(-(e - 1.7) * 7) * Math.sin((e - 1.7) * 18) : 0);
      if (u < 1 && Math.round(e * 60) % 4 === 0) redraw(1);
      if (e > 2.6) { L = R = OPEN; D.settled = true; shut.top = -10; for (const c of stood) c.top = G + 1.7; redraw(2); }
    }
    D.theta = L;
    leaves[0].pivot.rotation.z = L;
    leaves[1].pivot.rotation.z = -R;
    // once the staple is out, the hasp hangs from its leaf with the padlock on it, swinging down as gravity takes it
    if (torn.visible) {
      leaves[1].pivot.updateMatrixWorld(true);
      wd.set(0, -1, 0).applyQuaternion(q.copy(haspPivot.parent.getWorldQuaternion(q)).invert());
      const want = Math.atan2(-wd.y, -wd.x);
      let d = want - D.haspAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      D.haspVel += (d * 40 - D.haspVel * 3.2) * dt;
      D.haspAngle += D.haspVel * dt;
      // (it can lift off the leaf and fold right over, never go down through it)
      if (D.haspAngle > 0) { D.haspAngle = 0; D.haspVel *= -0.3; }
      if (D.haspAngle < -Math.PI) { D.haspAngle = -Math.PI; D.haspVel *= -0.3; }
      haspPivot.rotation.z = D.haspAngle;
    }
    D.lockVel += (-D.lockSwing * 90 - D.lockVel * 4) * dt;
    D.lockSwing += D.lockVel * dt;
    swing.rotation.z = D.lockSwing;
  }

  // ---------------------------------------------------------------- underneath: its own scene
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const W1 = ROOMB;
  // what lights it: the torch (main.js aims it), and what comes in at the open doors, down the steps
  const beam = new THREE.SpotLight(BEAM.color, 0, BEAM.reach, BEAM.angle, BEAM.soft, 1.5); // (falling off a little slower than it should: close up it blinded, further off there was nothing)
  beam.castShadow = true;
  beam.shadow.mapSize.set(1024, 1024);
  beam.shadow.camera.near = 0.2; // (perspective depth: at 0.05 m the bias was worth 3 cm two metres off, 20 at five)
  beam.shadow.camera.far = BEAM.reach;
  beam.shadow.bias = -0.00005;
  beam.shadow.normalBias = 0.006;
  beam.map = T.torchCookieTex();
  scene.add(beam, beam.target);
  const daylight = new THREE.SpotLight(0x9eacc4, 0, 7, 0.8, 0.85, 2);
  daylight.position.set((C.x0 + C.x1) / 2, G + 0.9, zs - 0.2);
  daylight.target.position.set((C.x0 + C.x1) / 2, FL, 1.2);
  daylight.castShadow = true;
  daylight.shadow.autoUpdate = false;
  daylight.shadow.mapSize.set(512, 512);
  daylight.shadow.camera.near = 0.2;
  daylight.shadow.bias = -0.0001; // (−0.0008 was worth 3.5 cm three metres off, 10 at five)
  daylight.shadow.normalBias = 0.004;
  scene.add(daylight, daylight.target);
  scene.add(new THREE.AmbientLight(0x343a44, 0.045)); // (eyes that have been down there a while: next to nothing)

  // ---- the steps: concrete, each worn hollow in the middle where feet go, the noses rounded off and chipped
  const stairCrete = dusty(std({ map: T.oldConcreteTex(), bumpMap: T.oldConcreteTex(true), bumpScale: 1.6, roughness: 0.95, vertexColors: true }), 0.6);
  const STEPS = 9, rise = (G - FL) / STEPS, run = (W1.z0 - zs) / (STEPS - 1);
  const trodden = (x) => Math.max(0, 1 - Math.abs(x - (C.x0 + C.x1) / 2 + 0.05) / 0.42);
  const treads = [];
  for (let i = 0; i < STEPS - 1; i++) {
    const y = G - (i + 1) * rise;
    treads.push([C.x0 + 0.004, C.x1 - 0.004, y - 0.3, y, zs + i * run - (i ? 0.025 : 0), zs + (i + 1) * run, { round: 0.012, deck: true, tread: true, nicks: 7, ends: [false, false], k: 0.9 + r() * 0.1 }]);
  }
  root.add(wornWood(treads, stairCrete, r, (x) => trodden(x)));
  // (and solid under them down to the floor, from wall to wall: under them was nothing at all, and through the slits
  // at their ends the sky's colour showed between the steps — user, 2026-10-22)
  // the stairwell: block walls either side, a front under the sill; past the house's wall a concrete ceiling over it
  const blockMat = dusty(metric(std({ map: T.blockWallTex(), bumpMap: T.blockWallTex(true), bumpScale: 1.2, roughness: 0.94 }), 1.6), 0.55);
  const crete2 = dusty(metric(std({ map: T.foundationTex(), roughness: 0.95, color: 0x9a958c }), 2.4), 0.5);
  const wall = (x0, x1, y0, y1, z0, z1, mat = blockMat) => root.add(slab(x0, x1, y0, y1, z0, z1, mat));
  const e3 = 0.003; // (3 mm in front of the house's own faces of the same concrete: no two faces in one plane)
  // (their tops 4 cm under the lawn, inside the concrete of the cheeks and the sill: level with the lawn they showed
  // through it round the way in, flickering — user, 2026-10-22)
  const GW = G - 0.04;
  wall(C.x0 - TH, C.x0 + e3, FL - 0.05, GW, zs, C.z1 + 0.006); // beside the steps out under the doors… (on 6 mm into the house's concrete, over the start of the next)
  wall(C.x1 - e3, C.x1 + TH, FL - 0.05, GW, zs, C.z1 + 0.006);
  // …and on under the house (ending just inside the room's north wall: their ends were in its face; and beginning just
  // inside the house's: their other ends were in its concrete face beside the cheeks, two dark flickering slots out in the
  // yard — user, 2026-10-28)
  wall(C.x0 - TH, C.x0 + e3, FL - 0.05, -0.3, C.z1 + 0.004, W1.z0 - 0.004);
  wall(C.x1 - e3, C.x1 + TH, FL - 0.05, -0.3, C.z1 + 0.004, W1.z0 - 0.004);
  wall(C.x0, C.x1, G - rise - 0.3, GW, zs - TH, zs + e3, crete2); // under the sill
  for (const [, , , y, z0, z1] of treads) if (y - 0.29 > FL - 0.05) wall(C.x0, C.x1, FL - 0.05, y - 0.29, z0 + 0.01, z1 - 0.01, crete2); // what the steps stand on
  wall(C.x0, C.x1, -0.34, -0.3, C.z1 + 0.005, W1.z0, crete2); // the ceiling over the steps under the house

  // ---- the room: block walls, a slab floor, the house's joists and floorboards overhead
  const floorMat = dusty(metric(std({ map: T.cellarFloorTex(), bumpMap: T.cellarFloorTex(true), bumpScale: 0.8, roughness: 0.95 }), 2), 0.8);
  root.add(flat(W1.x0, W1.x1, W1.z0, W1.z1, FL, floorMat), flat(HALL.x0, HALL.x1, HALL.z0, HALL.z1, FL, floorMat));
  wall(W1.x0 - TH, C.x0, FL - 0.05, -0.12, W1.z0 - TH, W1.z0); // north, either side of the steps' doorway, and over it
  wall(C.x1, W1.x1 + TH, FL - 0.05, -0.12, W1.z0 - TH, W1.z0);
  wall(C.x0, C.x1, -0.3, -0.12, W1.z0 - TH, W1.z0);
  wall(W1.x0 - TH, W1.x1 + TH, FL - 0.05, -0.12, W1.z1, W1.z1 + TH); // south
  wall(W1.x0 - TH, W1.x0, FL - 0.05, -0.12, W1.z0, W1.z1); // west
  wall(W1.x1, W1.x1 + TH, FL - 0.05, -0.12, W1.z0, HALL.z0); // east, either side of the way on, and over it
  wall(W1.x1, W1.x1 + TH, FL - 0.05, -0.12, HALL.z1, W1.z1);
  wall(W1.x1, W1.x1 + TH, HALL.top, -0.12, HALL.z0, HALL.z1);
  // the wet up the walls' feet, all round
  const damp = new THREE.MeshStandardMaterial({ map: T.dampFootTex(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
  const strip = (x0, z0, x1, z1) => { // along a wall's face, 4 mm off it, the picture 2 m along
    const L = Math.hypot(x1 - x0, z1 - z0), geo = new THREE.PlaneGeometry(L, 0.6);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * L + x0 * 0.37 + z0 * 0.61) / 2);
    const m = new THREE.Mesh(geo, damp);
    m.position.set((x0 + x1) / 2, FL + 0.3, (z0 + z1) / 2);
    m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    m.receiveShadow = true;
    root.add(m);
  };
  const o4 = 0.004;
  strip(W1.x0, W1.z0 + o4, C.x0, W1.z0 + o4); strip(C.x1, W1.z0 + o4, W1.x1, W1.z0 + o4); // north (facing in: +z)
  strip(W1.x1, W1.z1 - o4, W1.x0, W1.z1 - o4); // south
  strip(W1.x0 + o4, W1.z1, W1.x0 + o4, W1.z0); // west
  strip(W1.x1 - o4, W1.z0, W1.x1 - o4, HALL.z0); strip(W1.x1 - o4, HALL.z1, W1.x1 - o4, W1.z1); // east
  // overhead: the floorboards under the house's floor, the joists under them, a beam under those on two steel posts
  const boardsTex = T.oldTimberTex();
  boardsTex.repeat.set(2, 1);
  const under = dusty(metric(std({ map: boardsTex, color: 0x9a8a78, roughness: 0.95 }), 1), 0.3);
  root.add(flat(W1.x0, W1.x1, W1.z0, W1.z1, -0.12, under, false));
  const joist = dusty(std({ map: T.oldTimberTex(), color: 0xa08e78, roughness: 0.94 }), 0.9);
  for (let x = W1.x0 + 0.2; x < W1.x1 - 0.1; x += 0.4) put(root, new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, W1.z1 - W1.z0), joist), x, -0.22, (W1.z0 + W1.z1) / 2);
  const BZ = 3.05;
  put(root, new THREE.Mesh(new THREE.BoxGeometry(W1.x1 - W1.x0, 0.24, 0.16), joist), (W1.x0 + W1.x1) / 2, CE - 0.12, BZ);
  const rust = dusty(std({ map: T.rustyMetalTex(77), color: 0x6b5442, metalness: 0.5, roughness: 0.7 }), 0.4);
  for (const x of [1.15, 4.15]) {
    put(root, cylY(0.044, 0.044, CE - 0.24 - FL, rust, 16), x, (FL + CE - 0.24) / 2, BZ);
    put(root, new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.16), rust), x, CE - 0.246, BZ);
    put(root, new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.14), rust), x, FL + 0.006, BZ);
  }

  // ---- the way on: a passage east, panelled, a dropped ceiling with a tile gone, a door at its end that won't open
  const panel = T.panellingTex();
  panel.repeat.set(1, 0.5);
  const panelMat = dusty(metric(std({ map: panel, roughness: 0.7 }), 1.22), 0.35);
  // (from the far side of the room's wall: through it the opening is the blocks' own — the panelling and the tiles
  // started in its thickness, face to face with the blocks, and flickered there — user, 2026-10-22)
  const HX0 = W1.x1 + TH;
  wall(HX0, HALL.x1 + TH, FL - 0.05, HALL.top, HALL.z0 - TH, HALL.z0, panelMat);
  wall(HX0, HALL.x1 + TH, FL - 0.05, HALL.top, HALL.z1, HALL.z1 + TH, panelMat);
  const tiles = dusty(metric(std({ map: T.ceilingTilesTex(), roughness: 0.95 }), 1.22), 0.15);
  const gapAt = 8.24;
  root.add(flat(HX0, gapAt - 0.305, HALL.z0, HALL.z1, HALL.top, tiles, false));
  root.add(flat(gapAt + 0.305, HALL.x1, HALL.z0, HALL.z1, HALL.top, tiles, false));
  root.add(flat(gapAt - 0.305, gapAt + 0.305, HALL.z0, HALL.z0 + 0.3, HALL.top, tiles, false));
  root.add(flat(gapAt - 0.305, gapAt + 0.305, HALL.z0 + 0.91, HALL.z1, HALL.top, tiles, false));
  // above the tiles: the void, shut in — block walls on up from the panelling, a concrete slab over it (user,
  // 2026-10-23: it was open, and looking up through the hole at a slant you saw the trees outside, past the house)
  wall(HX0, HALL.x1 + TH, HALL.top + 0.002, -0.12, HALL.z0 - TH, HALL.z0);
  wall(HX0, HALL.x1 + TH, HALL.top + 0.002, -0.12, HALL.z1, HALL.z1 + TH);
  wall(HALL.x1, HALL.x1 + TH, HALL.top + 0.002, -0.12, HALL.z0, HALL.z1);
  wall(HX0, HALL.x1, -0.16, -0.12, HALL.z0, HALL.z1, crete2);
  const wire = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[gapAt - 0.1, -0.165, HALL.z0 + 0.4], [gapAt, -0.4, HALL.z0 + 0.55], [gapAt + 0.04, -0.68, HALL.z0 + 0.6]].map((p) => new THREE.Vector3(...p))), 16, 0.004, 5);
  put(root, new THREE.Mesh(wire, dusty(std({ color: 0x2a2826, roughness: 0.7 }), 0.2)));
  const skirt = dusty(std({ color: 0x3a2818, roughness: 0.6 }), 0.8);
  put(root, new THREE.Mesh(new THREE.BoxGeometry(HALL.x1 - HX0, 0.08, 0.015), skirt), (HX0 + HALL.x1) / 2, FL + 0.04, HALL.z0 + 0.0075);
  put(root, new THREE.Mesh(new THREE.BoxGeometry(HALL.x1 - HX0, 0.08, 0.015), skirt), (HX0 + HALL.x1) / 2, FL + 0.04, HALL.z1 - 0.0075);
  wall(HALL.x1, HALL.x1 + TH, FL - 0.05, HALL.top, HALL.z0, HALL.z1, panelMat);
  const endDoor = new THREE.Group();
  endDoor.position.set(HALL.x1 - 0.004, FL, (HALL.z0 + HALL.z1) / 2);
  root.add(endDoor);
  const doorMat = dusty(std({ map: T.doorTex('#8c8270'), roughness: 0.75 }), 0.5);
  put(endDoor, new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.83, 0.76), [doorMat, doorMat, skirt, skirt, doorMat, doorMat]), -0.018, 0.915, 0);
  for (const dz of [-0.42, 0.42]) put(endDoor, new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.9, 0.07), skirt), -0.01, 0.95, dz);
  put(endDoor, new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.91), skirt), -0.01, 1.865, 0);
  const knob = put(endDoor, new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), dusty(std({ color: 0x8a7a52, metalness: 0.8, roughness: 0.45 }), 0.3)), -0.075, 0.92, 0.3);
  put(endDoor, cylY(0.008, 0.008, 0.04, knob.material, 10), -0.05, 0.92, 0.3).rotation.z = Math.PI / 2;
  endDoor.userData.interact = { label: () => 'Open the door', use: () => { D.knob = 0.4; ctx.sound.sample('door-locked', knob.getWorldPosition(new THREE.Vector3())); }, say: 'Locked.' };
  ctx.interact.push(endDoor);

  // ---- what has been put down here, and left (each its own builder, below)
  const things = new THREE.Group();
  root.add(things);
  const block = (x0, x1, z0, z1, h) => ctx.colliders.push({ type: 'box', x0, x1, z0, z1, base: -6, top: Math.min(FL + h, G - 0.06) });
  furnish(things, block, ctx, r);

  // in the way down here: the walls (none of it higher than the lawn, or it would stop you up in the yard)
  const wallBox = (x0, x1, z0, z1) => block(x0, x1, z0, z1, 3);
  wallBox(C.x0 - TH, C.x0, zs, W1.z0); wallBox(C.x1, C.x1 + TH, zs, W1.z0);
  wallBox(W1.x0 - TH, C.x0, W1.z0 - TH, W1.z0); wallBox(C.x1, W1.x1 + TH, W1.z0 - TH, W1.z0);
  wallBox(W1.x0 - TH, W1.x1 + TH, W1.z1, W1.z1 + TH); wallBox(W1.x0 - TH, W1.x0, W1.z0, W1.z1);
  wallBox(W1.x1, W1.x1 + TH, W1.z0, HALL.z0); wallBox(W1.x1, W1.x1 + TH, HALL.z1, W1.z1);
  wallBox(HALL.x0, HALL.x1, HALL.z0 - TH, HALL.z0); wallBox(HALL.x0, HALL.x1, HALL.z1, HALL.z1 + TH); wallBox(HALL.x1 - 0.05, HALL.x1 + TH, HALL.z0, HALL.z1);
  for (const x of [1.15, 4.15]) block(x - 0.07, x + 0.07, BZ - 0.07, BZ + 0.07, 3);

  // dust in the air, seen only in the torch's beam
  const air = motes(800, { x0: W1.x0, x1: W1.x1, y0: FL + 0.1, y1: CE - 0.05, z0: W1.z0, z1: W1.z1 });
  root.add(air.points);

  bakeStatic(root); // (what never moves, merged by material; the steps, the sofa and what moves stay as they are)
  scene.updateMatrixWorld(true);
  const shell = [blockMat, crete2, floorMat, under, panelMat, tiles];
  root.traverse((o) => { if (o.isMesh && shell.includes(o.material)) occluders.push(o); });

  // ---------------------------------------------------------------- what the house and main.js ask of it
  const inWell = (x, z) => x > C.x0 && x < C.x1 && z > zs && z < W1.z0;
  const inRoom = (x, z) => (x > W1.x0 && x < W1.x1 && z > W1.z0 && z < W1.z1) || (x >= HALL.x0 && x < HALL.x1 && z > HALL.z0 && z < HALL.z1);
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
  const wellBox = new THREE.Box3(new THREE.Vector3(W1.x0 - TH, FL - 0.1, zs), new THREE.Vector3(HALL.x1 + TH, G + 0.1, W1.z1 + TH));
  const sky = new THREE.Box3(new THREE.Vector3(C.x0, G - 0.6, zf), new THREE.Vector3(C.x1, G + 2.5, C.z1)); // (the doors' opening, and the sky over it)
  let dayDone = false, close = false; // (close: the eye down in it or by its doors — only then does the torch's beam down there, shadows and all, cost anything)
  const topStep = new THREE.Vector3((C.x0 + C.x1) / 2, G, zs);
  const lensGlow = (on) => { for (const m of glow) m.emissiveIntensity = on ? (m === glow[0] ? 1.4 : 3) : 0; };
  return {
    scene,
    TORCH,
    /** Whether the doors stand open. */
    get open() { return D.open; },
    /** The ground here for someone whose feet are at `feet`, if the cellar has a say in it: its steps, its floor. */
    baseAt(x, z, feet) {
      if (D.open && inWell(x, z) && (z < C.z1 || feet < -0.9)) return G - THREE.MathUtils.clamp((z - zs) / (W1.z0 - zs), 0, 1) * (G - FL);
      if (feet < -0.9 && inRoom(x, z)) return FL;
      return undefined;
    },
    /** Whether `p` (an eye) is down in it: on the steps under the lawn or under the house, or in the basement. */
    // (under the house's wall the eye is still a few cm over the lawn's level: there it was neither down here nor
    // out in the yard, and for a frame only the sky was drawn, seen from below — a flash of green-blue on the way down)
    below: (p) => (inWell(p.x, p.z) && (p.y < G + 0.05 || p.z > C.z1)) || (p.y < G + 0.05 && inRoom(p.x, p.z)),
    /** What the camera wants drawn: the basement (`below`), the house and the bedroom (`above`: from down there only when the doors' opening is in view). */
    passes(camera) {
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const down = this.below(camera.position);
      close = down || camera.position.distanceTo(topStep) < 3.5;
      return {
        below: down || (camera.position.z < C.z1 && frustum.intersectsBox(wellBox)), // (from the yard, shut too: it is what shows dark between the doors' boards; never from the house, over it)
        above: !down || camera.position.y > G - 0.7 || frustum.intersectsBox(sky),
      };
    },
    /** The torch in your hand (its glass at `from`, aimed `dir`), or not (`from` null): its beam, its glass lit. */
    torch(from, dir) {
      lensGlow(!!from);
      beam.intensity = from && close ? BEAM.power : 0;
      air.beam(from, dir);
      if (!from) return;
      beam.position.copy(from);
      beam.target.position.copy(from).addScaledVector(dir, 4);
      beam.updateMatrixWorld();
      beam.target.updateMatrixWorld();
    },
    /** Whether its shadows want drawing this frame (the torch's every frame it is on; the daylight's once, when the doors are open). */
    shadowsDue() {
      if (D.open && !dayDone) { dayDone = true; daylight.shadow.needsUpdate = true; return true; }
      return beam.intensity > 0;
    },
    update(dt, time) {
      doorsStep(dt);
      daylight.intensity = D.open ? 2.6 * THREE.MathUtils.clamp(D.theta / OPEN, 0, 1) : 0;
      air.update(time);
      if (D.knob > 0) { D.knob = Math.max(0, D.knob - dt); knob.rotation.x = Math.sin(D.knob * 60) * 0.15 * D.knob; }
    },
    /** The ground underfoot down there. */
    floorAt: (x, z, feet) => (feet < G - 0.1 && (inWell(x, z) || inRoom(x, z)) ? 'concrete' : null),
  };
}

/**
 * Dust in the air (user, 2026-10-21: "uncanny"): specks drifting slowly through the dark, seen only where the
 * torch's beam goes through them — `beam(from, dir)` — brighter nearer it.
 */
function motes(n, b) {
  const r = mulberry32(9917), pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set([b.x0 + r() * (b.x1 - b.x0), b.y0 + r() * (b.y1 - b.y0), b.z0 + r() * (b.z1 - b.z0)], i * 3); seed[i] = r(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const U = { uTime: { value: 0 }, uFrom: { value: new THREE.Vector3(0, -99, 0) }, uDir: { value: new THREE.Vector3(0, -1, 0) }, uOn: { value: 0 }, uCosOut: { value: Math.cos(BEAM.angle) }, uCosIn: { value: Math.cos(BEAM.angle * (1 - BEAM.soft)) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `
      attribute float aSeed; uniform float uTime, uOn, uCosOut, uCosIn; uniform vec3 uFrom, uDir; varying float vLit;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.11 + aSeed * 31.0) * 0.18, sin(uTime * 0.07 + aSeed * 17.0) * 0.12, cos(uTime * 0.09 + aSeed * 23.0) * 0.18);
        vec3 l = p - uFrom; float d = max(length(l), 0.05);
        float cone = smoothstep(uCosOut, uCosIn, dot(l / d, uDir));
        vLit = uOn * cone * (0.5 + 0.5 * sin(uTime * 1.3 + aSeed * 40.0)) / (1.0 + 0.9 * d * d);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(5.0 / -mv.z, 1.0, 5.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vLit;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vec3(1.0, 0.94, 0.84) * vLit * a * 0.55, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.userData.live = true;
  return {
    points,
    beam(from, dir) { U.uOn.value = from ? 1 : 0; if (from) { U.uFrom.value.copy(from); U.uDir.value.copy(dir); } },
    update(time) { U.uTime.value = time; },
  };
}

/**
 * Everything put down in the basement and left (user, 2026-10-21: "lots of dusty objects, an old dusty sofa, worn right
 * through; we are in 2003"). The sofa in the middle facing the far wall, the television in front of it turned to the
 * wall; a trail of small shoe prints in the dust from the foot of the steps to the sofa, and none back. Boxes stacked
 * and sagging, one of them LUCAS; things under sheets; a mattress against a wall; a child's chair in a corner facing
 * into it; shelves of tins and jars; the water heater, cold; a bulb on a chain that doesn't light. `block(x0, x1, z0,
 * z1, h)`: in the way, h high.
 */
function furnish(g, block, ctx, r) {
  // ---- the sofa: old gold velour, sat to death — sagging, rubbed through, torn open in places, one seat cushion
  // fallen off onto the floor in front of it, a back cushion slumped over; thick with dust
  const velour = new THREE.MeshPhysicalMaterial({ map: T.velourTex(), bumpMap: T.velourTex(true), bumpScale: 0.9, roughness: 1, sheen: 0.45, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x7a6438) });
  const legs = dusty(std({ map: T.woodTex('#4a2e18', '#22140a', 971), roughness: 0.7 }), 0.6);
  const sofa = F.plaidSofa(velour, legs, { sag: [0.075, 0.06], used: [0.7, 0.7], sunK: 0.25 });
  dusty(velour, 0.95);
  sofa.position.set(2.6, FL, 3.72);
  sofa.userData.live = true; // (its cloth's wear is in its vertices: kept out of the bake)
  g.add(sofa);
  const { seats, backs, arms } = sofa.userData;
  const fallen = seats[1];
  fallen.position.set(0.52, 0.0775 + 0.024, 0.9); // (on the floor, not into it: its tipped corners)
  fallen.rotation.set(0.04, 0.42, -0.03);
  backs[0].rotation.x -= 0.3;
  backs[0].rotation.z += 0.22;
  backs[0].position.y -= 0.07;
  sofa.updateMatrixWorld(true);
  const yarn = [[147, 114, 47, 0.55], [96, 72, 28, 0.25], [176, 142, 74, 0.2]];
  const rip = { roughness: 1, lift: 0.003 };
  F.projectDecal(seats[0], { at: [0.05, 0.12], size: [0.3, 0.3], map: T.plaidTearTex(1901, { len: 0.36, gape: 0.1, yarn }), ...rip });
  F.projectDecal(seats[0], { at: [-0.2, -0.01], size: [0.22, 0.22], map: T.plaidTearTex(1902, { len: 0.34, gape: 0.07, yarn }), ...rip, front: true, turn: 0.05 });
  F.projectDecal(fallen, { at: [-0.1, 0.05], size: [0.26, 0.26], map: T.plaidTearTex(1903, { len: 0.3, gape: 0.12, yarn }), ...rip });
  F.projectDecal(backs[1], { at: [0.08, 0.05], size: [0.34, 0.34], map: T.plaidTearTex(1904, { len: 0.4, gape: 0.06, fill: 'fibre', yarn }), ...rip, front: true, turn: -0.3 });
  F.projectDecal(backs[0], { at: [-0.1, -0.06], size: [0.24, 0.24], map: T.plaidTearTex(1905, { len: 0.3, gape: 0.09, fill: 'fibre', yarn }), ...rip, front: true, turn: 0.4 });
  F.projectDecal(arms[0], { at: [0.0, 0.2], size: [0.2, 0.2], map: T.plaidTearTex(1906, { len: 0.3, gape: 0.14, yarn }), ...rip });
  F.projectDecal(arms[1], { at: [0.01, 0.28], size: [0.18, 0.18], map: T.plaidTearTex(1907, { len: 0.28, gape: 0.1, yarn }), ...rip });
  F.projectDecal(seats[0], { at: [0.18, -0.05], size: [0.16, 0.14], map: T.stainTex(1951), lift: 0.002 });
  // (where somebody small sat, not long ago: the dust on the seat wiped off in a patch — the velour under it darker)
  F.projectDecal(seats[0], { at: [-0.05, 0.02], size: [0.34, 0.3], map: T.stainTex(1952), lift: 0.0015, roughness: 0.9 }).material.opacity = 0.45;
  block(1.55, 3.65, 3.26, 4.2, 0.95);
  block(2.75, 3.5, 4.2, 4.98, 0.16);

  // ---- the television in front of it, turned round to face the wall: a set of the seventies in a wooden case,
  // rabbit ears on top, its back to the sofa
  const set = new THREE.Group();
  set.position.set(2.62, FL, 5.28);
  set.rotation.y = 0.04; // (screen to the wall: +z)
  g.add(set);
  const caseWood = dusty(std({ map: T.woodTex('#5a3a22', '#2a180c', 975, [1, 1]), roughness: 0.6 }), 0.9);
  const plasticBack = dusty(std({ color: 0x2a2420, roughness: 0.7 }), 1);
  put(set, rbox(0.62, 0.05, 0.42, 0.01, caseWood), 0, 0.2, 0); // the low cabinet it stands on
  for (const [x, z] of [[-0.27, -0.17], [0.27, -0.17], [-0.27, 0.17], [0.27, 0.17]]) put(set, cylY(0.016, 0.012, 0.18, caseWood, 8), x, 0.09, z);
  put(set, rbox(0.58, 0.46, 0.4, 0.02, caseWood), 0, 0.455, 0.02);
  put(set, rbox(0.46, 0.36, 0.01, 0.02, dusty(std({ color: 0x14161a, roughness: 0.25 }), 0.4)), -0.04, 0.455, 0.222);
  const tube = put(set, new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.26, 4, 1).rotateY(Math.PI / 4).rotateX(Math.PI / 2), plasticBack), 0, 0.46, -0.3);
  tube.scale.set(1, 0.8, 1);
  for (const s of [-1, 1]) { const rod = put(set, cylY(0.003, 0.003, 0.5, dusty(std({ color: 0x9a9890, metalness: 0.8, roughness: 0.4 }), 0.3), 6), s * 0.08, 0.9, -0.02); rod.rotation.z = s * 0.5; }
  put(set, cylY(0.03, 0.035, 0.03, plasticBack, 12), 0, 0.7, -0.02);
  block(2.3, 2.95, 5.05, 5.52, 0.95);

  // ---- the shoe prints: from the foot of the steps to the front of the sofa, a child's; and none coming back
  const prints = [];
  const path = new THREE.CatmullRomCurve3([[1.78, 0, 0.72], [1.95, 0, 1.6], [2.3, 0, 2.6], [2.45, 0, 3.0], [1.55, 0, 3.3], [1.6, 0, 4.25], [2.2, 0, 4.42]].map((p) => new THREE.Vector3(...p)));
  const steps = Math.floor(path.getLength() / 0.27);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, p = path.getPointAt(u), d = path.getTangentAt(u), side = i % 2 ? 1 : -1, yaw = Math.atan2(d.x, d.z);
    const geo = new THREE.PlaneGeometry(0.07, 0.17).rotateX(-Math.PI / 2).rotateY(yaw + (r() - 0.5) * 0.15);
    geo.translate(p.x + Math.cos(yaw) * side * 0.06, FL + 0.003, p.z - Math.sin(yaw) * side * 0.06);
    prints.push(geo);
  }
  for (const dx of [-0.07, 0.07]) prints.push(new THREE.PlaneGeometry(0.07, 0.17).rotateX(-Math.PI / 2).rotateY(Math.PI + 0.1).translate(2.25 + dx, FL + 0.003, 4.38)); // (stood here, facing the sofa)
  const printMat = new THREE.MeshStandardMaterial({ map: T.printTex(7), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  const trail = new THREE.Mesh(mergeGeometries(prints, false), printMat);
  trail.receiveShadow = true;
  g.add(trail);

  // ---- boxes: stacked against the walls, sagging, taped, a word on some
  const cartons = [
    // [x, z, w, h, d, yaw, label, crush] — bottom ones first
    [-0.28, 5.3, 0.6, 0.42, 0.45, 0.05, 'XMAS', 0.02], [-0.3, 5.28, 0.5, 0.36, 0.4, -0.08, 'KITCHEN', 0.04, 0.42], [-0.26, 5.3, 0.42, 0.3, 0.36, 0.12, '', 0.05, 0.78],
    [0.45, 5.4, 0.55, 0.45, 0.42, -0.03, 'BOOKS', 0.01], [0.43, 5.42, 0.48, 0.4, 0.4, 0.1, 'LUCAS 0-2', 0.03, 0.45],
    [-0.32, 4.45, 0.45, 0.4, 0.5, 0.02, 'TAXES 97-99', 0.02], [-0.3, 4.48, 0.4, 0.32, 0.42, -0.12, '', 0.06, 0.4],
    [4.9, 0.95, 0.5, 0.38, 0.45, 0.2, 'GARAGE', 0.03],
    [1.0, 5.32, 0.4, 0.34, 0.5, 0.6, 'DAD', 0.04], // (over on its side, burst: papers out of it)
  ];
  cartons.forEach(([x, z, w, h, d, yaw, label, crush, y0 = 0], i) => {
    const geo = new THREE.BoxGeometry(w, h, d, 4, 3, 4), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const u = p.getX(k) / (w / 2), v = p.getY(k) / (h / 2), s = p.getZ(k) / (d / 2), mid = (1 - u * u) * (1 - s * s);
      if (v > 0.99) p.setY(k, p.getY(k) - crush * mid);
      if (Math.abs(u) > 0.99) p.setX(k, p.getX(k) + Math.sign(u) * 0.01 * (1 - v * v) * (1 - s * s));
      if (Math.abs(s) > 0.99) p.setZ(k, p.getZ(k) + Math.sign(s) * 0.01 * (1 - v * v) * (1 - u * u));
    }
    geo.computeVertexNormals();
    const m = put(g, new THREE.Mesh(geo, dusty(std({ map: T.cardboardTex(2300 + i, label), roughness: 0.96 }), 1.2)), x, FL + y0 + h / 2, z);
    m.rotation.y = yaw;
    if (label === 'DAD') { m.rotation.set(0, yaw, Math.PI / 2); m.position.y = FL + w / 2 + 0.012; }
    if (!y0) block(x - Math.max(w, d) / 2, x + Math.max(w, d) / 2, z - Math.max(w, d) / 2, z + Math.max(w, d) / 2, 1.2);
  });
  const paper = dusty(std({ color: 0xcfc8b6, roughness: 0.9 }), 0.7);
  for (let i = 0; i < 9; i++) { const sh = put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29).rotateX(-Math.PI / 2), paper), 1.35 + r() * 0.5, FL + 0.002 + i * 0.0006, 5.05 + r() * 0.45); sh.rotation.y = r() * 3; sh.material.side = THREE.DoubleSide; }

  // ---- under sheets: something tall against the east wall (a wardrobe, a mirror), and an armchair by the boxes
  const sheet = dusty(std({ map: T.dustSheetTex(), roughness: 1 }), 1);
  // (a sheet thrown over something: hanging in deep folds from its top edges, wider at the floor where it lies in a
  // heap, the top sagging between what holds it up, never flat)
  const draped = (w, h, d, seed) => F.softBox(w, h, d, 0.12, sheet, {
    lumps: 0.012, seed, wrap: 'y',
    shape: (u, v, s, nx, ny) => {
      const low = Math.max(0, -v), side = 1 - Math.abs(ny), along = u * w + s * d;
      const folds = 0.03 * Math.sin(along * 9 + seed) * (0.35 + low) + 0.018 * Math.sin(along * 23 + seed * 2.3) * low + 0.012 * Math.sin(along * 4 + v * 2 + seed);
      return side * (0.05 * low ** 1.4 + folds) - (ny > 0.5 ? 0.03 * (1 - u * u) * (1 - s * s) : 0) + 0.008 * Math.sin(u * 7 + s * 5 + seed) * Math.max(0, ny);
    },
  });
  put(g, draped(0.9, 1.78, 0.52, 3), 5.08, FL + 0.89, 1.25).rotation.y = -Math.PI / 2 + 0.06;
  block(4.75, 5.4, 0.75, 1.75, 1.8);
  put(g, draped(0.82, 0.86, 0.8, 7), 0.25, FL + 0.43, 3.55).rotation.y = 0.5;
  block(-0.2, 0.7, 3.1, 4.0, 0.9);

  // ---- a mattress leant against the east wall, stained
  const mtex = T.mattressTex();
  mtex.wrapS = mtex.wrapT = THREE.RepeatWrapping;
  mtex.repeat.set(1, 0.5);
  const mattress = put(g, F.softBox(0.92, 1.88, 0.15, 0.05, dusty(std({ map: mtex, roughness: 0.95 }), 0.8), { wrap: 'z', lumps: 0.01, seed: 11 }), 5.22, FL + 0.946, 4.35);
  mattress.rotation.set(0, -Math.PI / 2, 0);
  mattress.rotateX(-0.1);
  block(5.0, 5.4, 3.85, 4.85, 1.9);

  // ---- a child's chair in the south-east corner, facing into it
  const chair = F.kitchenChair(dusty(std({ map: T.woodTex('#6a5a48', '#3a2c20', 981), color: 0x9fb0b8, roughness: 0.7 }), 1));
  chair.scale.setScalar(0.62);
  chair.position.set(5.08, FL, 5.38);
  chair.rotation.y = Math.PI * 0.75;
  g.add(chair);
  block(4.85, 5.32, 5.15, 5.62, 0.6);

  // ---- shelves of steel along the west wall: tins of paint, jars, a radio, a toolbox, rags
  const steel = dusty(std({ color: 0x6f716c, metalness: 0.35, roughness: 0.6 }), 0.9);
  const sx = -0.38, sz0 = 1.45, sz1 = 2.45;
  for (const z of [sz0, sz1]) for (const x of [sx - 0.18, sx + 0.18]) put(g, new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.82, 0.035), steel), x, FL + 0.91, z);
  for (const y of [0.12, 0.58, 1.04, 1.5]) put(g, new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, sz1 - sz0 + 0.03), steel), sx, FL + y, (sz0 + sz1) / 2);
  const tin = (x, y, z, c, s = 1) => {
    const m = put(g, cylY(0.084 * s, 0.084 * s, 0.19 * s, dusty(std({ color: 0x8b8880, metalness: 0.6, roughness: 0.55 }), 1), 18), x, FL + y + 0.095 * s, z);
    put(g, cylY(0.085 * s, 0.085 * s, 0.11 * s, dusty(std({ color: c, roughness: 0.7 }), 0.6), 18), x, FL + y + 0.09 * s, z); // (its label)
    return m;
  };
  tin(sx - 0.05, 0.13, 1.6, 0x7a2a22); tin(sx + 0.06, 0.13, 1.82, 0x2e4a6a); tin(sx - 0.02, 0.59, 2.3, 0xb8b090, 0.8); tin(sx + 0.05, 1.05, 1.55, 0x3a5a3a, 0.75);
  const jar = dusty(std({ color: 0x2a1a10, roughness: 0.25 }), 0.9), lid = dusty(std({ color: 0x8a8678, metalness: 0.7, roughness: 0.5 }), 0.9);
  for (let i = 0; i < 7; i++) { const z = 1.62 + i * 0.1 + (r() - 0.5) * 0.03, x = sx + (r() - 0.5) * 0.18; put(g, cylY(0.038, 0.038, 0.13, jar, 14), x, FL + 1.05 + 0.065, z); put(g, cylY(0.039, 0.039, 0.015, lid, 14), x, FL + 1.05 + 0.137, z); }
  put(g, rbox(0.14, 0.12, 0.26, 0.012, dusty(std({ color: 0x4a3626, roughness: 0.6 }), 1)), sx, FL + 0.59 + 0.06, 1.75); // the radio
  put(g, rbox(0.2, 0.17, 0.4, 0.01, dusty(std({ color: 0x7a2420, metalness: 0.4, roughness: 0.6 }), 1)), sx + 0.01, FL + 0.13 + 0.085, 2.2); // the toolbox
  put(g, rbox(0.3, 0.06, 0.3, 0.02, dusty(std({ color: 0x8a8070, roughness: 1 }), 1)), sx, FL + 1.51 + 0.03, 1.95); // rags
  block(sx - 0.22, sx + 0.22, sz0 - 0.03, sz1 + 0.03, 1.9);

  // ---- the water heater in the north-west corner, its pilot long out; pipes up into the joists
  const enamel = dusty(std({ color: 0x9c9482, roughness: 0.6 }), 1.1); // (white once: yellowed, dusty — not to glow in the torch)
  const hx = -0.22, hz = 0.88;
  put(g, cylY(0.25, 0.25, 1.38, enamel, 32), hx, FL + 0.08 + 0.69, hz);
  put(g, cylY(0.17, 0.25, 0.06, enamel, 32), hx, FL + 0.08 + 1.41, hz);
  put(g, cylY(0.27, 0.27, 0.05, dusty(std({ map: T.rustyMetalTex(83), color: 0x8a6a4a, metalness: 0.5, roughness: 0.75 }), 0.5), 32), hx, FL + 0.025, hz); // its pan, rusty
  const galv = dusty(std({ map: T.rustyMetalTex(85), metalness: 0.5, roughness: 0.6 }), 0.5);
  put(g, cylY(0.05, 0.05, CE - (FL + 1.52), galv, 16), hx, (FL + 1.52 + CE) / 2, hz);
  const copper = dusty(std({ color: 0x6a4a30, metalness: 0.8, roughness: 0.45 }), 0.5);
  for (const dx of [-0.12, 0.12]) put(g, cylY(0.011, 0.011, CE - (FL + 1.45), copper, 8), hx + dx, (FL + 1.45 + CE) / 2, hz - 0.1);
  put(g, rbox(0.1, 0.12, 0.07, 0.01, dusty(std({ color: 0x1e1e1e, roughness: 0.5 }), 0.6)), hx + 0.26, FL + 0.32, hz);
  block(hx - 0.28, hx + 0.32, hz - 0.28, hz + 0.28, 1.6);

  // ---- a fuse box on the north wall by the steps, grey, its door shut
  put(g, rbox(0.32, 0.42, 0.1, 0.01, dusty(std({ color: 0x8a8c88, metalness: 0.4, roughness: 0.55 }), 0.5)), 0.55, -1.15, ROOMB.z0 + 0.05);
  put(g, cylY(0.012, 0.012, -0.12 - (-0.94), galv, 8), 0.62, (-0.94 + -0.12) / 2, ROOMB.z0 + 0.03);

  // ---- a lamp with no shade by the sofa's end, its bulb bare
  const brass = dusty(std({ color: 0x8a7444, metalness: 0.75, roughness: 0.5 }), 0.9);
  put(g, new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.15, 0], [0.15, 0.012], [0.1, 0.03], [0.02, 0.05], [0, 0.05]].map(([a, b]) => new THREE.Vector2(a, b)), 28), brass), 1.18, FL, 4.05);
  put(g, cylY(0.011, 0.011, 1.38, brass, 10), 1.18, FL + 0.74, 4.05);
  put(g, cylY(0.02, 0.022, 0.07, dusty(std({ color: 0x1a1612, roughness: 0.6 }), 0.5), 12), 1.18, FL + 1.46, 4.05);
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), dusty(std({ color: 0xb8b2a0, roughness: 0.25 }), 0.5)), 1.18, FL + 1.53, 4.05);
  block(1.05, 1.31, 3.92, 4.18, 1.6);

  // ---- two suitcases one on the other against the west wall
  const vinyl = dusty(std({ color: 0x4e3626, roughness: 0.6, bumpMap: T.noiseBump(441, [4, 4]), bumpScale: 0.3 }), 1);
  put(g, rbox(0.7, 0.22, 0.46, 0.035, vinyl, 3), -0.27, FL + 0.113, 2.95).rotation.y = Math.PI / 2 + 0.04;
  put(g, rbox(0.6, 0.19, 0.4, 0.03, vinyl, 3), -0.28, FL + 0.315, 2.98).rotation.y = Math.PI / 2 - 0.1;
  const strapMat = dusty(std({ color: 0x1e1610, roughness: 0.7 }), 0.6);
  for (const dz of [-0.16, 0.16]) put(g, new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.225, 0.03), strapMat), -0.27, FL + 0.1135, 2.95 + dz);
  block(-0.55, 0.0, 2.6, 3.3, 0.45);

  // ---- a carpet rolled up, leant in the north-east corner
  const roll = put(g, cylY(0.12, 0.12, 2.0, dusty(std({ map: T.rugTex(), roughness: 1 }), 1), 20), 5.15, FL + 1.01, 0.78);
  roll.rotation.set(-0.12, 0, 0.1);
  block(4.95, 5.4, 0.55, 1.0, 1.9);

  // ---- the bulb overhead on its chain: pull it — nothing
  const pull = new THREE.Group();
  pull.position.set(2.3, CE, 2.25);
  g.add(pull);
  const porcelain = dusty(std({ color: 0xc8c0aa, roughness: 0.45 }), 0.6);
  put(pull, cylY(0.04, 0.03, 0.06, porcelain, 16), 0, -0.03, 0);
  put(pull, new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.012, 0], [0.013, -0.02], [0.03, -0.055], [0.033, -0.08], [0.028, -0.1], [0.012, -0.11], [0, -0.112]].map(([a, b]) => new THREE.Vector2(a, b)), 20), dusty(std({ color: 0x9a948a, roughness: 0.3, transparent: true, opacity: 0.85 }), 0.8)), 0, -0.06, 0);
  const chainGeo = new THREE.CylinderGeometry(0.0015, 0.0015, 0.5, 4);
  put(pull, new THREE.Mesh(chainGeo, brass), 0.03, -0.31, 0).castShadow = false;
  put(pull, cylY(0.006, 0.006, 0.025, brass, 8), 0.03, -0.57, 0);
  pull.userData.interact = { label: () => 'Pull the chain', use: () => ctx.sound.sample('chain-pull', pull.getWorldPosition(new THREE.Vector3())), say: 'Nothing.' };
  ctx.interact.push(pull);
  pull.userData.live = true;

  // ---- a cast-iron drain stack down the south wall into the floor
  const castIron = dusty(std({ map: T.rustyMetalTex(87), color: 0x403a34, metalness: 0.5, roughness: 0.75 }), 0.6);
  put(g, cylY(0.055, 0.055, CE - FL, castIron, 16), 4.6, (FL + CE) / 2, ROOMB.z1 - 0.08);
  for (const y of [FL + 0.4, FL + 1.3]) put(g, cylY(0.066, 0.066, 0.07, castIron, 16), 4.6, y, ROOMB.z1 - 0.08);

  // ---- cobwebs in the corners and between the joists
  const webs = [[ROOMB.x0, ROOMB.z0, 0], [ROOMB.x1, ROOMB.z0, 1], [ROOMB.x1, ROOMB.z1, 2], [ROOMB.x0, ROOMB.z1, 3], [ROOMB.x0, 2.0, 0], [ROOMB.x1, 4.3, 1]];
  webs.forEach(([x, z, k], i) => {
    const web = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55).translate(0.275, -0.275, 0), new THREE.MeshStandardMaterial({ map: T.cobwebTex(1700 + i), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1 }));
    web.position.set(x, CE + 0.0, z);
    web.rotation.set(-0.5, -Math.PI / 4 - (k * Math.PI) / 2, 0, 'YXZ');
    web.receiveShadow = true;
    g.add(web);
  });
  for (let i = 0; i < 6; i++) { // strung between joists
    const x = ROOMB.x0 + 0.2 + Math.floor(r() * 14) * 0.4 + 0.0225, z = ROOMB.z0 + 0.4 + r() * 4.4;
    const web = new THREE.Mesh(new THREE.PlaneGeometry(0.355, 0.2).translate(0.1775, -0.1, 0), new THREE.MeshStandardMaterial({ map: T.cobwebTex(1720 + i), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1 }));
    web.position.set(x, -0.12, z);
    web.rotation.y = r() < 0.5 ? 0 : Math.PI;
    if (web.rotation.y) web.position.x += 0.355;
    g.add(web);
  }
}
