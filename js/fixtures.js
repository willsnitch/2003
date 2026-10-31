// Fittings and furniture for the rest of the house, modelled with the care the bedroom's things
// got rather than as boxes: the bathroom's toilet, bath and basin, the kitchen sink, the taps,
// the living room's television and its stand, the sofa, the kitchen table and chairs. Each is
// built facing +z (its front), standing on y = 0 and centred on x = 0 unless it says otherwise;
// the house turns it and puts it where it goes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import { curvedScreen, screenMat } from './props.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const deg = (d) => (d * Math.PI) / 180;

/** Into `parent` at x, y, z, casting and taking shadows. */
function put(parent, mesh, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** A rounded box. */
const rounded = (w, h, d, r, mat, segs = 4) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segs, Math.min(r, w / 2, h / 2, d / 2)), mat);

/** A turned shape from [radius, height] pairs; stretched into an oval by the mesh's own scale, so its shading stays right. */
function lathe(profile, mat, segments = 40) {
  return new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments), mat);
}

/** Points round a rounded rectangle centred on 0, `w` along x and `d` along z, `per` points to each corner. */
function roundRect(w, d, r, per = 8) {
  const pts = [];
  const corners = [[w / 2 - r, d / 2 - r, 0], [-(w / 2 - r), d / 2 - r, Math.PI / 2], [-(w / 2 - r), -(d / 2 - r), Math.PI], [w / 2 - r, -(d / 2 - r), Math.PI * 1.5]];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= per; i++) {
      const a = a0 + (i / per) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

/** The same as a flat 2D shape (x, and z read as the shape's y), for cutting holes in plates. */
export function roundRectShape(w, d, r, ShapeClass = THREE.Shape) {
  const s = new ShapeClass();
  roundRect(w, d, r).forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
}

/**
 * How round a hollow's corners are `inset` in from its opening (w × d, corners r): as the sides come in,
 * the corners stay round to the bottom (user, 2026-10-16: the bottoms of the bath and basin were
 * rectangles, their corners gone to points), never rounder than the opening's.
 */
export function insetRadius(w, d, r, inset) {
  return Math.max(0.005, r - inset, Math.min(r, 0.45 * Math.min(w - 2 * inset, d - 2 * inset)));
}

/**
 * A hollow worked out of a rounded rectangle: rings of [inset, y], top first, each smaller and
 * lower, closed with a floor at the last. The inside of a bath, a basin, a sink; or turned the
 * other way, the curved underside of a basin seen from outside.
 */
function hollow(w, d, r, rings, mat) {
  // (user, 2026-10-17: "that grey stuff" in the bath and basin) the rings joined by straight steps made a
  // crease where the sides met the bottom, a grey band round it, and the bottom a fan of long thin
  // triangles shaded in streaks: now one smooth profile through the rings, many rings down it, and on
  // across the bottom to the middle, just dished, in rings too
  const curve = new THREE.CatmullRomCurve3(rings.map(([i, y]) => new THREE.Vector3(i, y, 0)), false, 'centripetal');
  const prof = curve.getSpacedPoints(Math.max(16, rings.length * 4)).map((p) => [p.x, p.y]);
  const [i0, y0] = prof[prof.length - 1], iMax = Math.min(w, d) / 2 - 0.012;
  for (let k = 1; k <= 8 && iMax > i0; k++) {
    const f = k / 8;
    prof.push([i0 + (iMax - i0) * f, y0 - 0.0015 * f * f]);
  }
  const per = 8, ringPts = prof.map(([inset, y]) => roundRect(w - 2 * inset, d - 2 * inset, Math.min(insetRadius(w, d, r, inset), Math.min(w, d) / 2 - inset - 0.0005), per).map(([x, z]) => [x, y, z]));
  const n = ringPts[0].length, pos = [], idx = [];
  for (const ring of ringPts) for (const p of ring) pos.push(...p);
  for (let k = 0; k < ringPts.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const a = k * n + i, b = k * n + ((i + 1) % n), c = (k + 1) * n + ((i + 1) % n), e = (k + 1) * n + i;
      idx.push(a, b, c, a, c, e);
    }
  }
  // closed at the middle: the last ring, narrow, filled across flat (shrunk to a line it drew a dark one)
  const last = ringPts.length - 1, contour = ringPts[last].map(([x, , z]) => new THREE.Vector2(x, z));
  // facing the way the rings round it face (their normals and its must agree, or the edge shades dark)
  const V = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  const ringNormalY = (k) => { const a = V(k), b = V(k + 1), c = V(k + n + 1); return b.sub(a).cross(c.sub(a)).y; };
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const capY = (() => { const [a, b, c] = tris[0].map((t) => V(last * n + t)); return b.sub(a).cross(c.sub(a)).y; })();
  const flip = Math.sign(capY) !== Math.sign(ringNormalY((last - 1) * n));
  for (const [a, b, c] of tris) idx.push(last * n + a, last * n + (flip ? c : b), last * n + (flip ? b : c));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  m.userData.profile = prof; // [inset, y], top to bottom (the bath's water follows it)
  return m;
}

/** A flat plate (a deck, a worktop, a lid) cut from a rounded rectangle, with a rounded hole in it if `hole` is given. */
function plate(w, d, r, thick, mat, hole = null, bevel = 0.006) {
  const shape = roundRectShape(w, d, r);
  if (hole) {
    const [hw, hd, hr, hx = 0, hz = 0] = hole;
    const path = new THREE.Path();
    roundRect(hw, hd, hr).forEach(([x, z], i) => (i ? path.lineTo(x + hx, -(z + hz)) : path.moveTo(x + hx, -(z + hz))));
    path.closePath();
    shape.holes.push(path);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, thick - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** A tube along points ([x, y, z] each). */
function pipe(points, radius, mat, segs = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, radius, 10, false), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- taps

/** A mixer tap: round foot, body, a spout reaching forward over the bowl, a lever on top. `reach`: how far the spout comes out. */
export function mixerTap(chrome, { tall = 0.14, reach = 0.13, goose = false, front = false } = {}) {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.012, 24), chrome), 0, 0.006, 0);
  put(g, lathe([[0, 0], [0.022, 0], [0.02, 0.02], [0.018, tall * 0.7], [0.021, tall], [0, tall]], chrome, 24), 0, 0.012, 0);
  const top = tall + 0.012;
  if (goose) {
    // a tall neck curving over and down
    // (rising from the back of the body, so the lever on top is clear of it — user, 2026-10-20: it faced backwards)
    g.add(pipe([[0, top - 0.05, -0.012], [0, top + 0.1, -0.027], [0, top + 0.19, reach * 0.35], [0, top + 0.13, reach], [0, top + 0.05, reach]], 0.011, chrome, 32));
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.025, 14), chrome), 0, top + 0.04, reach);
  } else {
    g.add(pipe([[0, top - 0.035, 0.005], [0, top - 0.03, reach * 0.5], [0, top - 0.045, reach * 0.9], [0, top - 0.07, reach]], 0.0105, chrome, 20));
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.018, 14), chrome), 0, top - 0.078, reach);
  }
  // the lever, lying back along the top; or (`front`) reaching forward over the spout, as you would take
  // hold of it (the basin's: user, 2026-10-16, it faced backwards). Lifted, it opens the tap: `lift` is
  // which way that turns it on x
  const dir = front ? 1 : -1;
  const lever = new THREE.Group();
  lever.position.set(0, top, goose ? 0.006 : 0);
  lever.rotation.x = -0.35 * dir;
  put(lever, new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.02, 20), chrome), 0, 0.01, 0);
  const arm = put(lever, rounded(0.016, 0.012, 0.09, 0.005, chrome), 0, 0.024, 0.045 * dir);
  arm.rotation.x = 0.1 * dir;
  Object.assign(lever.userData, { lift: -0.5 * dir, dir });
  g.add(lever);
  // the lever (lifted, turning on x, it opens the tap); `mouth`: the middle of the aerator's face, where
  // the water leaves; `inlet`: inside the aerator, where a stream is drawn from so none of it shows above
  const tip = goose ? top + 0.04 - 0.0125 : top - 0.087;
  Object.assign(g.userData, { lever, mouth: new THREE.Vector3(0, tip, reach), inlet: new THREE.Vector3(0, tip + 0.008, reach) });
  return g;
}

/**
 * Two cross-head taps and a spout, on a wall: the old kind, over a bath. Faces +z, its back on the wall
 * at z = 0. The heads turn: `hot` (red cap, at −x) and `cold` (blue cap, at +x) are their groups, each
 * turning about its own z. `mouth`: where the water leaves the spout.
 */
export function bathTaps(chrome) {
  const g = new THREE.Group();
  const heads = {};
  for (const [x, name, cap] of [[-0.1, 'hot', 0xb8392c], [0.1, 'cold', 0x2e64b0]]) {
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.012, 20).rotateX(Math.PI / 2), chrome), x, 0, 0.006);
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.05, 16).rotateX(Math.PI / 2), chrome), x, 0, 0.035);
    const head = new THREE.Group();
    head.position.set(x, 0, 0.062);
    for (const turn of [0, Math.PI / 2]) {
      const bar = put(head, rounded(0.07, 0.012, 0.012, 0.005, chrome));
      bar.rotation.z = turn + Math.PI / 4;
    }
    put(head, new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), std({ color: cap, roughness: 0.3 })), 0, 0, 0.008);
    g.add(head);
    heads[name] = head;
  }
  g.add(pipe([[0, -0.06, 0.005], [0, -0.06, 0.08], [0, -0.075, 0.14], [0, -0.11, 0.16]], 0.016, chrome, 16));
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.012, 20).rotateX(Math.PI / 2), chrome), 0, -0.06, 0.006);
  // `mouth`: just under the middle of the spout's end, where the water leaves it; `inlet`: up inside
  // the spout, where the falling water is drawn from (the end is cut aslant: drawn from the mouth, a
  // sliver of the empty spout showed between its front lip and the water)
  return { group: g, ...heads, mouth: new THREE.Vector3(0, -0.112, 0.16), inlet: new THREE.Vector3(0, -0.1, 0.157) };
}

// ---------------------------------------------------------------- bathroom

/**
 * A close-coupled toilet in white china: the bowl on its foot, drawn into an oval; the back of it
 * rising into a smooth hump that the cistern sits on, against the wall; the seat down, and the lid up,
 * leaning back against the top of the cistern; a round push button on the cistern's lid. Front +z;
 * its back is at z = −0.36.
 */
export function toilet(ceramic, seatMat, chrome) {
  const g = new THREE.Group();
  const OVAL = 1.3, MID = 0.06, RIM = 0.395;
  // the foot and the bowl, inside and out, turned in one piece and drawn out into an oval
  const bowl = lathe([
    [0.0, 0.0], [0.104, 0.0], [0.11, 0.01], [0.101, 0.04], [0.088, 0.13], [0.09, 0.2], [0.108, 0.265], [0.142, 0.325], [0.17, 0.365], [0.183, 0.385], [0.184, RIM - 0.002],
    [0.178, RIM + 0.003], [0.166, RIM - 0.002], [0.152, 0.37], [0.128, 0.333], [0.1, 0.295], [0.074, 0.265], [0.05, 0.248], [0.025, 0.24], [0.0, 0.238],
  ], ceramic, 72);
  bowl.scale.set(1, 1, OVAL);
  put(g, bowl, 0, 0, MID);
  // the water standing in it, and the dark of the trap at the back
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.077, 40).rotateX(-Math.PI / 2), std({ color: 0xb9c8cc, roughness: 0.03, transparent: true, opacity: 0.75 }));
  water.scale.set(1, 1, OVAL);
  water.position.set(0, 0.262, MID);
  g.add(water);
  g.userData.water = water; // gone under the flood (bath.js)
  const trap = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24).rotateX(-Math.PI / 2), std({ color: 0x3d4446, roughness: 0.5 }));
  trap.scale.set(1, 1, 1.2);
  trap.position.set(0, 0.255, MID - 0.03);
  g.add(trap);
  // the back of it (user, 2026-10-17: a cube stuck on behind, "make it make sense"): one piece with the
  // pan, as on a close-coupled toilet — from the foot it sweeps up and back in a long curve to a ledge at
  // the rim's height that the cistern stands on, and down the wall to the floor; narrower where it leaves
  // the foot, as wide as the cistern at the wall, every edge rounded over
  {
    const side = new THREE.Shape();
    // [back, up]: its front inside the pan all the way up (the foot, then the bowl's outside), so they are one
    side.moveTo(-0.03, 0);
    side.bezierCurveTo(-0.03, 0.12, -0.05, 0.22, -0.09, 0.29);
    side.quadraticCurveTo(-0.15, 0.37, -0.205, RIM + 0.012);
    side.lineTo(-0.335, RIM + 0.012);
    side.lineTo(-0.335, 0);
    side.closePath();
    const bev = 0.025, depth = 0.3;
    const geo = new THREE.ExtrudeGeometry(side, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 5, curveSegments: 24 });
    geo.translate(0, 0, -(depth - 2 * bev) / 2); // across x once turned
    geo.rotateY(-Math.PI / 2); // shape x → z (back), extrusion → x (across)
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { // narrower towards the front
      const z = p.getZ(i), k = THREE.MathUtils.clamp((z + 0.03) / -0.305, 0, 1);
      p.setX(i, p.getX(i) * THREE.MathUtils.lerp(0.72, 1.18, k));
      if (p.getY(i) < 0) p.setY(i, 0); // (the bevel would go under the floor)
    }
    geo.computeVertexNormals();
    const back = new THREE.Mesh(geo, ceramic);
    back.castShadow = back.receiveShadow = true;
    g.add(back);
  }
  // the cistern on it, against the wall, and its lid, a little bigger all round; the button on top
  put(g, rounded(0.39, 0.36, 0.15, 0.03, ceramic, 5), 0, 0.59, -0.285);
  put(g, rounded(0.41, 0.03, 0.17, 0.012, ceramic, 4), 0, 0.785, -0.283);
  // the button: pressed, it flushes (house.js)
  const button = new THREE.Group();
  g.add(button);
  put(button, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 28), chrome), 0, 0.803, -0.285);
  for (const [x, turn] of [[-0.0012, 0], [0.0012, Math.PI]]) put(button, new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 20, 1, false, turn, Math.PI), chrome), x, 0.809, -0.285);
  // the flush, there only while it runs (house.js): the water washing down the inside of the bowl from
  // under the rim, and going round and down in it
  const wash = lathe([[0.162, RIM - 0.006], [0.149, 0.369], [0.125, 0.333], [0.097, 0.296], [0.072, 0.266]], std({ color: 0xe6eef0, roughness: 0.05, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), 72);
  wash.scale.set(1, 1, OVAL);
  put(g, wash, 0, 0, MID).visible = false;
  wash.castShadow = false;
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.077, 40).rotateX(-Math.PI / 2), std({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0, depthWrite: false }));
  swirl.scale.set(1, 1, OVAL);
  swirl.position.set(0, 0.2625, MID);
  swirl.visible = false;
  g.add(swirl);
  g.userData.flush = { button, wash, swirl };
  // the seat: a ring on the rim, its hinges at the back
  const ring = new THREE.Shape();
  ring.absellipse(0, 0, 0.178, 0.232, 0, Math.PI * 2);
  const hole = new THREE.Path();
  hole.absellipse(0, 0.012, 0.112, 0.152, 0, Math.PI * 2);
  ring.holes.push(hole);
  const seat = new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.008, bevelSegments: 4, curveSegments: 48 }).rotateX(-Math.PI / 2), seatMat);
  put(g, seat, 0, RIM + 0.012, MID);
  for (const x of [-0.075, 0.075]) put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.034, 14).rotateZ(Math.PI / 2), chrome), x, RIM + 0.03, -0.165);
  // the lid, on its hinge at the back of the seat: down over the seat, or up and leaning back against the
  // top of the cistern (`userData.lid`: the hinge, turning about x; `userData.up`: its angle when up)
  const lidShape = new THREE.Shape();
  lidShape.absellipse(0, 0, 0.178, 0.234, 0, Math.PI * 2);
  const lidGeo = new THREE.ExtrudeGeometry(lidShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.008, bevelSegments: 4, curveSegments: 48 }).rotateX(-Math.PI / 2);
  lidGeo.translate(0, 0.007, 0.234 + 0.008); // lying forward from the hinge, as it would when down
  const hinge = new THREE.Group();
  hinge.position.set(0, RIM + 0.03, -0.165);
  hinge.rotation.x = -deg(93);
  put(hinge, new THREE.Mesh(lidGeo, seatMat));
  g.add(hinge);
  g.userData.lid = hinge;
  g.userData.up = hinge.userData.up = deg(93);
  return g;
}

/**
 * A toilet roll on its holder: a chrome back plate with two short arms, the spindle between them, the
 * roll on it showing the cardboard at its ends, and the end of the paper hanging down in front. Its
 * back is on the wall at z = 0, facing +z.
 */
export function paperHolder(chrome, paper) {
  const g = new THREE.Group();
  put(g, rounded(0.17, 0.05, 0.012, 0.005, chrome), 0, 0.04, 0.006);
  for (const x of [-0.068, 0.068]) put(g, rounded(0.01, 0.05, 0.075, 0.004, chrome), x, 0.025, 0.045);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.13, 10).rotateZ(Math.PI / 2), chrome), 0, 0.0, 0.07);
  const R = 0.052, len = 0.1;
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(R, R, len, 40, 1, true).rotateZ(Math.PI / 2), paper);
  put(g, roll, 0, -0.012, 0.07);
  // its ends: the paper wound round, the cardboard tube in the middle
  const card = std({ color: 0x9a7a52, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.RingGeometry(0.021, R, 40), paper);
    end.rotation.y = s * Math.PI / 2;
    put(g, end, s * len / 2, -0.012, 0.07);
    const tube = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.021, 32), card);
    tube.rotation.y = s * Math.PI / 2;
    put(g, tube, s * len / 2, -0.012, 0.07);
  }
  // the loose end, coming off the front of the roll and hanging, a little curled at the bottom
  const flap = new THREE.PlaneGeometry(len - 0.004, 0.13, 1, 8);
  const p = flap.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = 0.5 - p.getY(i) / 0.13; // 0 at the top, 1 at the bottom
    p.setZ(i, 0.01 * v * v + 0.004 * Math.sin(v * 9));
  }
  flap.computeVertexNormals();
  const sheet = new THREE.Mesh(flap, paper.clone());
  sheet.material.side = THREE.DoubleSide;
  put(g, sheet, 0, -0.012 - 0.065, 0.07 + R + 0.001);
  return g;
}

/**
 * The bath, built in across the end of the room: `L` long (x), `Wd` deep (z), its top at `Hh`. A deck
 * round it with a rolled lip at the opening; inside, enamel going down steeply, then curving in to a
 * broad flat bottom; the plug hole at the −x end (the taps' end) with its plug on a chain, and the round
 * overflow on that end wall. The tiled front is the house's to build. `userData.inside(y)`: the shape of
 * the water's surface at height y ([w, d, r] of a rounded rectangle), for the water to fill.
 */
export function bathtub(ceramic, chrome, L, Wd, Hh) {
  const g = new THREE.Group();
  const holeW = L - 0.16, holeD = Wd - 0.15, R = 0.2;
  put(g, plate(L, Wd, 0.015, 0.035, ceramic, [holeW, holeD, R, 0, 0.0]), 0, Hh - 0.035, 0);
  // the lip: a rounded roll all round the opening
  const lip = roundRect(holeW + 0.012, holeD + 0.012, R + 0.006, 10).map(([x, z]) => new THREE.Vector3(x, Hh - 0.004, z));
  const lipGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip, true), 220, 0.011, 10, true);
  put(g, new THREE.Mesh(lipGeo, ceramic));
  // the inside, as [how far in from the opening, height]
  const rings = [[0, Hh - 0.01], [0.004, Hh - 0.05], [0.014, Hh - 0.13], [0.028, Hh - 0.22], [0.045, Hh - 0.3], [0.066, Hh - 0.365], [0.09, Hh - 0.41], [0.118, Hh - 0.435], [0.15, Hh - 0.447], [0.2, Hh - 0.452]];
  const tub = hollow(holeW, holeD, R, rings, ceramic.clone());
  tub.material.side = THREE.DoubleSide;
  g.add(tub);
  const floor = Hh - 0.452;
  // the plug hole with the plug in it, on its chain from the overflow
  const px = -holeW / 2 + 0.26;
  put(g, new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 8, 28).rotateX(Math.PI / 2), chrome), px, floor + 0.002, 0);
  put(g, new THREE.Mesh(new THREE.CircleGeometry(0.022, 24).rotateX(-Math.PI / 2), std({ color: 0x1c1d1e, roughness: 0.6 })), px, floor + 0.001, 0);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.012, 20), std({ color: 0x2a2826, roughness: 0.6 })), px, floor + 0.005, 0); // the plug, in
  const of = new THREE.Vector3(-holeW / 2 + 0.035, Hh - 0.12, 0);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 24).rotateZ(Math.PI / 2), chrome), of.x - 0.019, of.y, of.z); // on the end wall
  const chain = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    chain.push(new THREE.Vector3(of.x - 0.012 + t * (px - of.x + 0.012), of.y - 0.01 + (floor + 0.012 - of.y + 0.01) * Math.pow(t, 0.6) - Math.sin(t * Math.PI) * 0.02, 0.012 * Math.sin(t * Math.PI)));
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chain), 40, 0.0018, 5), chrome));
  g.userData.floor = floor;
  g.userData.rim = Hh - 0.012;
  const prof = tub.userData.profile;
  g.userData.inside = (y) => {
    // how far in the sides have come at height y, between the rings either side of it
    let k = 0;
    while (k < prof.length - 2 && prof[k + 1][1] > y) k++;
    const [i0, y0] = prof[k], [i1, y1] = prof[k + 1], f = THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1);
    const inset = i0 + (i1 - i0) * f;
    return [holeW - 2 * inset, holeD - 2 * inset, Math.max(0.003, Math.min(insetRadius(holeW, holeD, R, inset), Math.min(holeW, holeD) / 2 - inset - 0.0005))];
  };
  return g;
}

/** A basin on a pedestal: oval bowl let into a slab with a rounded front, a mixer tap at the back. Its back is at z = −0.22. */
export function pedestalBasin(ceramic, chrome) {
  const g = new THREE.Group();
  const top = 0.85, w = 0.56, d = 0.44;
  // the slab, with the bowl's opening in it
  put(g, plate(w, d, 0.07, 0.04, ceramic, [0.42, 0.28, 0.13, 0, 0.03]), 0, top - 0.04, 0);
  // underneath it: the outside, curving in to where it sits on the pedestal
  const under = hollow(w, d, 0.07, [[0, top - 0.035], [0.02, top - 0.09], [0.08, top - 0.15], [0.17, top - 0.185]], ceramic);
  under.material = ceramic.clone();
  under.material.side = THREE.DoubleSide;
  g.add(under);
  // the bowl
  const bowl = hollow(0.42, 0.28, 0.13, [[0, top - 0.003], [0.015, top - 0.04], [0.04, top - 0.08], [0.07, top - 0.11], [0.1, top - 0.127], [0.122, top - 0.1335], [0.134, top - 0.135]], ceramic.clone()); // (a smooth dish down to the plug)
  bowl.material.side = THREE.DoubleSide;
  bowl.position.z = 0.03;
  g.add(bowl);
  // the plug hole
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 20), chrome), 0, top - 0.133, 0.03);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.002, 12), std({ color: 0x1a1a1a })), 0, top - 0.13, 0.03);
  // the pedestal: wider at the floor, flattened where it meets the wall
  const foot = lathe([[0, 0], [0.12, 0], [0.122, 0.015], [0.1, 0.08], [0.085, 0.4], [0.09, top - 0.19], [0.11, top - 0.17], [0, top - 0.17]], ceramic, 40);
  foot.scale.set(1, 1, 0.8);
  put(g, foot, 0, 0, -0.05);
  const tap = mixerTap(chrome, { tall: 0.1, reach: 0.11, front: true });
  tap.position.set(0, top, -0.17);
  g.add(tap);
  g.userData.bowl = bowl; // (what shows on it under a UV torch is drawn over its shape: house.js)
  g.userData.tap = tap; // (it runs: bath.js runningBasin)
  return g;
}

/** A towel rail with a white towel over it, folded in three and hung to dry. On a wall at z = 0, facing +z. */
export function towelRail(chrome, towelMat) {
  const g = new THREE.Group();
  const len = 0.6, out = 0.08;
  for (const x of [-len / 2, len / 2]) {
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 20).rotateX(Math.PI / 2), chrome), x, 0, 0.005);
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, out, 12).rotateX(Math.PI / 2), chrome), x, 0, out / 2);
  }
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, len, 16).rotateZ(Math.PI / 2), chrome), 0, 0, out);
  // the towel: a sheet hung over the rail, longer in front than behind, its weight pulling the folds straight
  const tw = 0.46, front = 0.52, back = 0.42, rr = 0.014, segW = 30, path = [];
  // its cross-section, [out from the rail, height]: up the back, over the top of the rail, down the front
  for (let i = 0; i <= 18; i++) path.push([-rr, -back * (1 - i / 18)]);
  for (let i = 1; i < 12; i++) {
    const a = Math.PI - (i / 12) * Math.PI;
    path.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  for (let i = 0; i <= 22; i++) path.push([rr, -front * (i / 22)]);
  const pos = [], uv = [], idx = [];
  const total = path.length;
  for (let j = 0; j < total; j++) {
    const [dz, dy] = path[j];
    for (let i = 0; i <= segW; i++) {
      const u = i / segW, x = (u - 0.5) * tw;
      const hang = Math.max(0, -dy) / front;
      const fold = (Math.sin(u * Math.PI * 4 - dy * 1.6) * 0.012 + Math.sin(u * Math.PI * 1.7 + 1) * 0.008) * Math.min(1, hang * 1.6); // folds where it hangs free, the same on both sides at a height
      // (both sides of it fold together: out and in alike, the back one never through the front — user, 2026-10-17)
      pos.push(x * (1 - 0.03 * hang), dy, out + dz + fold);
      uv.push(u, j / (total - 1));
    }
  }
  for (let j = 0; j < total - 1; j++) {
    for (let i = 0; i < segW; i++) {
      const a = j * (segW + 1) + i, b = a + 1, c = a + segW + 2, e = a + segW + 1;
      idx.push(a, e, b, b, e, c);
    }
  }
  // (user, 2026-10-16: "it looks like a sheet of paper") a terry towel has a body to it: the sheet above is
  // its middle, and what is drawn is a shell round it, TH thick, its edges rounded over (clothShell)
  const towel = new THREE.Mesh(clothShell(pos, uv, idx, segW + 1, total, 0.007), towelMat);
  towel.receiveShadow = true; // not cast: a thin cloth in a point light's map only shades itself
  const sh = towel.geometry.userData.shell;
  towel.userData.cloth = { path, segW, tw, out, rr, back, front, rest: Float32Array.from(pos), mid: sh.mid, sync: sh.sync }; // to float it (bath.js)
  towel.userData.live = true; // it moves (floats), so it is never baked into the room (build.bakeStatic)
  g.add(towel);
  return g;
}

/**
 * A cloth with a thickness: `pos`/`uv`/`idx` its middle surface, a grid `cols` across and `rows` along;
 * draws both faces, `th` apart, and the edges rounded over between them. `geometry.userData.shell`:
 * `mid` (the middle's positions — move them) and `sync(waterY)` to rebuild the shell round them, and to
 * wet it: what has been at or under `waterY` (in its own frame), and a little above, stays darker.
 */
function clothShell(pos, uv, idx, cols, rows, th) {
  const NV = cols * rows, h = th / 2;
  const midGeo = new THREE.BufferGeometry();
  midGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos.slice(), 3));
  midGeo.setIndex(idx);
  const mid = midGeo.attributes.position.array;
  // the edges, each a run of the middle's vertices: [vertex, the one in from it]
  const sides = [];
  const side = (list) => sides.push(list);
  side(Array.from({ length: rows }, (_, j) => [j * cols, j * cols + 1]));
  side(Array.from({ length: rows }, (_, j) => [j * cols + cols - 1, j * cols + cols - 2]));
  side(Array.from({ length: cols }, (_, i) => [i, cols + i]));
  side(Array.from({ length: cols }, (_, i) => [(rows - 1) * cols + i, (rows - 2) * cols + i]));
  const NE = sides.reduce((n, l) => n + l.length, 0), N = 2 * NV + NE;
  const P = new Float32Array(N * 3), Nn = new Float32Array(N * 3), C = new Float32Array(N * 3).fill(1), U = new Float32Array(N * 2);
  for (let v = 0; v < NV; v++) { U.set(uv.slice(v * 2, v * 2 + 2), v * 2); U.set(uv.slice(v * 2, v * 2 + 2), (NV + v) * 2); }
  const I = [];
  for (let t = 0; t < idx.length; t += 3) {
    I.push(idx[t], idx[t + 1], idx[t + 2]); // the face the middle faces
    I.push(NV + idx[t], NV + idx[t + 2], NV + idx[t + 1]); // the other, turned round
  }
  const edgeOf = []; // per edge vertex: [middle vertex, the one in from it]
  let e = 2 * NV;
  const midAt = new THREE.Vector3(), nAt = new THREE.Vector3(), inAt = new THREE.Vector3(), out = new THREE.Vector3();
  midGeo.computeVertexNormals();
  for (const list of sides) {
    const first = e;
    for (const [v, w] of list) { edgeOf.push([v, w]); U.set(uv.slice(v * 2, v * 2 + 2), e * 2); e++; }
    // round each edge from one face, over, to the other: which way round is the way out (found at rest)
    const [v0] = list[0], [v1] = list[1];
    midAt.fromArray(mid, v0 * 3); nAt.fromArray(midGeo.attributes.normal.array, v0 * 3);
    out.subVectors(midAt, inAt.fromArray(mid, list[0][1] * 3));
    const along = new THREE.Vector3().fromArray(mid, v1 * 3).sub(midAt);
    const flip = new THREE.Vector3().crossVectors(along, nAt).dot(out) < 0;
    for (let k = 0; k < list.length - 1; k++) {
      const a = list[k][0], b = list[k + 1][0], ma = first + k, mb = first + k + 1;
      const quads = [[a, b, mb, ma], [ma, mb, NV + b, NV + a]];
      for (const [q0, q1, q2, q3] of quads) {
        if (!flip) I.push(q0, q3, q1, q1, q3, q2);
        else I.push(q0, q1, q3, q1, q2, q3);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  geo.setIndex(I);
  const wet = new Float32Array(NV);
  const sync = (waterY = -9) => {
    midGeo.attributes.position.needsUpdate = true;
    midGeo.computeVertexNormals();
    const MN = midGeo.attributes.normal.array;
    for (let v = 0; v < NV; v++) {
      const k = v * 3, b = (NV + v) * 3;
      for (let c = 0; c < 3; c++) {
        P[k + c] = mid[k + c] + MN[k + c] * h; Nn[k + c] = MN[k + c];
        P[b + c] = mid[k + c] - MN[k + c] * h; Nn[b + c] = -MN[k + c];
      }
      // soaked where the water has been, and a little above it, as cloth draws it up; it stays so
      const y = mid[k + 1], soak = Math.min(1, Math.max(0, (waterY + 0.035 - y) / 0.04));
      if (soak > wet[v]) wet[v] = soak;
      const shade = 1 - 0.2 * wet[v];
      C[k] = C[k + 1] = C[k + 2] = C[b] = C[b + 1] = C[b + 2] = shade;
    }
    edgeOf.forEach(([v, w], i) => {
      const k = (2 * NV + i) * 3;
      midAt.fromArray(mid, v * 3); nAt.fromArray(MN, v * 3);
      out.subVectors(midAt, inAt.fromArray(mid, w * 3));
      out.addScaledVector(nAt, -out.dot(nAt)).normalize();
      P[k] = midAt.x + out.x * h * 0.9; P[k + 1] = midAt.y + out.y * h * 0.9; P[k + 2] = midAt.z + out.z * h * 0.9;
      Nn[k] = out.x; Nn[k + 1] = out.y; Nn[k + 2] = out.z;
      C[k] = C[k + 1] = C[k + 2] = 1 - 0.2 * wet[v];
    });
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.computeBoundingSphere();
  };
  sync();
  geo.userData.shell = { mid, sync };
  return geo;
}

/**
 * A flush ceiling light: a shallow drum of brushed nickel, a white diffuser across its underside, lit.
 * Fixed to the ceiling at y = 0, hanging down from it.
 */
export function ceilingDrum(nickel, diffuser, r = 0.17, h = 0.075) {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1, true), nickel), 0, -h / 2, 0).castShadow = false;
  put(g, new THREE.Mesh(new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2), nickel), 0, -0.002, 0).castShadow = false;
  put(g, new THREE.Mesh(new THREE.TorusGeometry(r - 0.002, 0.003, 6, 48).rotateX(Math.PI / 2), nickel), 0, -h, 0).castShadow = false;
  const glow = new THREE.Mesh(new THREE.CircleGeometry(r - 0.004, 48).rotateX(Math.PI / 2), diffuser);
  glow.position.y = -h + 0.004;
  g.add(glow); // no shadow: it is the light
  return g;
}

// ---------------------------------------------------------------- kitchen

/** A stainless sink let into the worktop: one bowl, a ribbed drainer to its left, a tall mixer tap behind. Its middle is the bowl's. */
export function kitchenSink(steel, chrome, top) {
  const g = new THREE.Group();
  const w = 0.86, d = 0.5, bowlX = 0.17;
  put(g, plate(w, d, 0.03, 0.012, steel, [0.4, 0.36, 0.06, bowlX, 0.02], 0.003), 0, top, 0);
  const bowl = hollow(0.4, 0.36, 0.06, [[0, top + 0.002], [0.005, top - 0.05], [0.015, top - 0.16], [0.03, top - 0.18]], steel.clone());
  bowl.material.side = THREE.DoubleSide;
  bowl.position.set(bowlX, 0, 0.02);
  g.add(bowl);
  // the strainer in the plug hole
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.004, 28), chrome), bowlX, top - 0.178, 0.02);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 20), std({ color: 0x202224, roughness: 0.6 })), bowlX, top - 0.176, 0.02);
  // the drainer's ribs, pressed into the steel
  for (let i = 0; i < 7; i++) put(g, rounded(0.3, 0.004, 0.012, 0.002, steel), -0.22, top + 0.013, -0.12 + i * 0.04);
  const tap = mixerTap(chrome, { tall: 0.12, reach: 0.2, goose: true, front: true });
  tap.position.set(bowlX, top + 0.012, -0.21);
  g.add(tap);
  return g;
}

// ---------------------------------------------------------------- living room

/** A big silver television of the time: a deep tube behind a rounded front, speakers under the screen. Front +z, standing on y = 0. */
export function television(M) {
  const g = new THREE.Group();
  const silver = std({ color: 0xb8bbbf, metalness: 0.35, roughness: 0.42 });
  const dark = std({ color: 0x2b2c30, roughness: 0.55 });
  const W = 0.8, Hh = 0.64;
  // the front
  put(g, rounded(W, Hh, 0.12, 0.03, silver, 5), 0, Hh / 2 + 0.03, 0);
  // the tube's housing behind it, narrowing to the back
  const back = new THREE.CylinderGeometry(0.34, 0.52, 0.42, 4, 1);
  back.rotateY(Math.PI / 4);
  back.rotateX(-Math.PI / 2);
  const housing = put(g, new THREE.Mesh(back, dark), 0, Hh / 2 + 0.06, -0.27);
  housing.scale.set(1, 0.78, 1);
  // the screen in its black surround
  put(g, rounded(0.66, 0.5, 0.01, 0.02, std({ color: 0x0e0e10, roughness: 0.4 })), 0, Hh / 2 + 0.08, 0.06);
  const screen = curvedScreen(0.6, 0.45, 0.018, screenMat(T.tvScreenTex()));
  screen.material.emissiveIntensity = 0;
  screen.position.set(0, Hh / 2 + 0.08, 0.064);
  g.add(screen);
  // speakers along the bottom, the buttons and the light between them
  const grille = std({ map: T.grilleTex(), roughness: 0.6 });
  for (const x of [-0.25, 0.25]) put(g, rounded(0.24, 0.05, 0.006, 0.006, grille), x, 0.085, 0.061);
  for (let i = 0; i < 4; i++) put(g, rounded(0.022, 0.01, 0.008, 0.003, dark), -0.06 + i * 0.03, 0.085, 0.062);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.004, 10).rotateX(Math.PI / 2), M.redLed), 0.08, 0.085, 0.062);
  // the feet
  for (const x of [-0.3, 0.3]) put(g, rounded(0.12, 0.03, 0.3, 0.01, dark), x, 0.015, -0.1);
  return { group: g, screen };
}

/** The stand under it: black, two smoked glass doors, a video recorder and a few tapes on the shelf inside. Front +z. */
export function tvStand(M) {
  const g = new THREE.Group();
  const black = std({ color: 0x1c1b1d, roughness: 0.35 });
  const W = 1.3, Hh = 0.5, D = 0.46;
  put(g, rounded(W, 0.03, D, 0.008, black), 0, Hh - 0.015, 0);
  put(g, rounded(W, 0.04, D, 0.008, black), 0, 0.06, 0);
  for (const x of [-W / 2 + 0.015, W / 2 - 0.015]) put(g, rounded(0.03, Hh - 0.05, D, 0.006, black), x, (Hh + 0.04) / 2, 0);
  put(g, rounded(W - 0.04, Hh - 0.08, 0.01, 0.004, black), 0, Hh / 2 + 0.01, -D / 2 + 0.005);
  put(g, rounded(W - 0.06, 0.018, D - 0.04, 0.004, black), 0, 0.27, 0);
  for (const x of [-0.6, 0.6]) put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.04, 16), black), x, 0.02, 0);
  // the video
  const vcr = new THREE.Group();
  vcr.position.set(-0.2, 0.08, 0);
  g.add(vcr);
  const body = std({ color: 0x2c2c30, roughness: 0.45 });
  put(vcr, rounded(0.43, 0.09, 0.3, 0.008, body), 0, 0.045, 0);
  put(vcr, rounded(0.2, 0.025, 0.004, 0.003, std({ color: 0x0a0a0b, roughness: 0.3 })), -0.06, 0.055, 0.151);
  put(vcr, rounded(0.08, 0.02, 0.003, 0.002, std({ color: 0x103018, emissive: 0x3cff7a, emissiveIntensity: 0.8 })), 0.12, 0.06, 0.151); // its clock, blinking 12:00
  for (let i = 0; i < 4; i++) put(vcr, rounded(0.018, 0.008, 0.006, 0.002, M.blackPlastic), 0.08 + i * 0.024, 0.028, 0.152);
  // tapes on their ends
  const sleeve = [0x2a2a30, 0x6a1e1e, 0x1f3b6a, 0xd8d0b8];
  sleeve.forEach((c, i) => put(g, rounded(0.03, 0.19, 0.105, 0.003, std({ color: c, roughness: 0.6 })), 0.22 + i * 0.034, 0.08 + 0.095, -0.05));
  // smoked glass doors
  const glass = std({ color: 0x151517, roughness: 0.08, transparent: true, opacity: 0.55, depthWrite: false });
  for (const x of [-W / 4 + 0.008, W / 4 - 0.008]) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - 0.04, Hh - 0.1, 0.006), glass);
    pane.position.set(x, Hh / 2 + 0.01, D / 2 - 0.004);
    g.add(pane);
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 10), M.knob), x + (x < 0 ? W / 4 - 0.06 : -W / 4 + 0.06), Hh / 2 + 0.01, D / 2 + 0.01);
  }
  return g;
}

/** Smooth value noise in 3D, 0…1 (for lumps in soft things). */
function vnoise(x, y, z) {
  const h = (i, j, k) => { let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi), L = THREE.MathUtils.lerp;
  return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), u), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v), L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
}

/** How far round a rounded box's strip of cloth a point is (softBox): from the middle of its q+ side, either way. */
function strip(cp, cq, np, nq, ep, eq, r) {
  if (Math.abs(np) < 1e-9) return nq > 0 ? cp : Math.sign(cp || 1) * (2 * ep + Math.PI * r + 2 * eq - Math.abs(cp));
  const a = Math.atan2(Math.abs(np), nq);
  return Math.sign(np) * (nq > 1e-9 ? ep + r * a : nq < -1e-9 ? ep + 2 * eq + r * a : ep + (r * Math.PI) / 2 + eq - cq);
}

/**
 * Something upholstered: a box w × h × d with its edges rounded (r), finely divided so it can be soft —
 * `shape(x, y, z, nx, ny, nz)` (x, y, z from -1 to 1 across it) pushes it out (+) or in along its surface (a
 * plump face, a fold), and `lumps` (m) makes it a little uneven, never quite smooth, away from its edges. Its
 * UVs are in metres and cut as upholstery is: the two faces across `wrap` ('x', 'y' or 'z') flat panels, the
 * cloth running on round the other four as one strip, its pattern matched where it turns (its own seam in the
 * middle of the side it starts and ends on: the back, the bottom). The grid falls at even steps round each
 * rounded edge with the box's own edge at 45°: the panels' seams, which `seamLoop` follows for the welting.
 */
export function softBox(w, h, d, r, mat, { shape = null, lumps = 0.003, seed = 1, wrap = 'y' } = {}) {
  const half = [w / 2, h / 2, d / 2], inner = half.map((v) => v - r), B = 3;
  const n = inner.map((e) => Math.max(1, Math.ceil((2 * e) / 0.025)) + 2 * B);
  // along an axis: even over the flat; over the rounding at either end at even angles, the box's edge at 45°
  const at = (u, k) => {
    const i = Math.round((u + 0.5) * n[k]), e = inner[k];
    if (i <= B) return -e - r * Math.tan(((B - i) / B) * (Math.PI / 4));
    if (i >= n[k] - B) return e + r * Math.tan(((i - n[k] + B) / B) * (Math.PI / 4));
    return -e + (2 * e * (i - B)) / (n[k] - 2 * B);
  };
  const geo = new THREE.BoxGeometry(1, 1, 1, ...n);
  const p = geo.attributes.position, uv = geo.attributes.uv, N = p.count, face = new Uint8Array(N);
  for (const { start, count, materialIndex } of geo.groups) for (let k = start; k < start + count; k++) face[geo.index.getX(k)] = materialIndex;
  geo.clearGroups();
  const orig = Float32Array.from(p.array), A = { x: 0, y: 1, z: 2 }[wrap], [P, Q] = [[2, 1], [0, 2], [0, 1]][A], ss = THREE.MathUtils.smoothstep;
  for (let i = 0; i < N; i++) {
    const o = [0, 1, 2].map((k) => at(orig[i * 3 + k], k));
    const c = o.map((v, k) => THREE.MathUtils.clamp(v, -inner[k], inner[k]));
    const dv = o.map((v, k) => v - c[k]), l = Math.hypot(...dv) || 1, nn = dv.map((v) => v / l);
    const X = c.map((v, k) => v + nn[k] * r);
    if (face[i] >> 1 === A) uv.setXY(i, X[P], X[Q]);
    else uv.setXY(i, strip(c[P], c[Q], nn[P], nn[Q], inner[P], inner[Q], r), X[A]);
    // away from the edges only: the second-nearest-to-its-edge of the three, kept off the edge
    const e = [0, 1, 2].map((k) => Math.abs(c[k]) / (inner[k] || 1)).sort((a, b) => b - a)[1];
    let push = lumps * (vnoise(X[0] * 7 + seed, X[1] * 7, X[2] * 7) * 2 - 1 + 0.5 * (vnoise(X[0] * 19, X[1] * 19 + seed, X[2] * 19) * 2 - 1)) * (1 - ss(e, 0.7, 1));
    if (shape) push += shape(X[0] / half[0], X[1] / half[1], X[2] / half[2], ...nn);
    p.setXYZ(i, X[0] + nn[0] * push, X[1] + nn[1] * push, X[2] + nn[2] * push);
  }
  // one smooth piece across the seams: the normals worked out on a welded copy, handed back by place
  const welded = mergeVertices(geo.clone().deleteAttribute('normal').deleteAttribute('uv'), 1e-6);
  welded.computeVertexNormals();
  const wp = welded.attributes.position, wn = welded.attributes.normal, nor = geo.attributes.normal, byPlace = new Map();
  const key = (a, i) => `${Math.round(a.getX(i) * 1e5)},${Math.round(a.getY(i) * 1e5)},${Math.round(a.getZ(i) * 1e5)}`;
  for (let i = 0; i < wp.count; i++) byPlace.set(key(wp, i), i);
  for (let i = 0; i < N; i++) { const j = byPlace.get(key(p, i)); nor.setXYZ(i, wn.getX(j), wn.getY(j), wn.getZ(j)); }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.box = { face, orig };
  return mesh;
}

/** The seam round one of a softBox's panels (face 0…5: +x, −x, +y, −y, +z, −z), in order round it: [points, normals]. */
function seamLoop(mesh, f) {
  const { face, orig } = mesh.userData.box, p = mesh.geometry.attributes.position, n = mesh.geometry.attributes.normal;
  const [P, Q] = [[2, 1], [0, 2], [0, 1]][f >> 1], pts = [];
  for (let i = 0; i < p.count; i++) {
    if (face[i] !== f || (Math.abs(orig[i * 3 + P]) < 0.4999 && Math.abs(orig[i * 3 + Q]) < 0.4999)) continue;
    pts.push({ a: Math.atan2(p.getComponent(i, Q), p.getComponent(i, P)), q: new THREE.Vector3().fromBufferAttribute(p, i), n: new THREE.Vector3().fromBufferAttribute(n, i) });
  }
  pts.sort((u, v) => u.a - v.a);
  return [pts.map((o) => o.q), pts.map((o) => o.n)];
}

/** Gives a piece of upholstery its wear (fabricWear): `wear(x, y, z, nx, ny, nz)` → [faded, rubbed, grimy], in its own frame. */
function upholster(mesh, wear) {
  const geo = mesh.geometry, p = geo.attributes.position, n = geo.attributes.normal, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) a.set(wear(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)), i * 3);
  geo.setAttribute('aWear', new THREE.Float32BufferAttribute(a, 3));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** Welting sewn into a seam: a cord covered in the cloth cut on the bias (its plaid at 45°), along `pts` on the surface, set out from it along `nor`. */
function welt(pts, nor, mat, wear, closed = true) {
  const R = 0.0045, curve = new THREE.CatmullRomCurve3(pts.map((q, i) => q.clone().addScaledVector(nor[i], R * 0.5)), closed, 'centripetal'), L = curve.getLength();
  const geo = new THREE.TubeGeometry(curve, Math.max(8, Math.ceil(L / 0.006)), R, 6, closed), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const a = uv.getX(i) * L, b = uv.getY(i) * Math.PI * 2 * R;
    uv.setXY(i, (a + b) * Math.SQRT1_2, (a - b) * Math.SQRT1_2);
  }
  return upholster(new THREE.Mesh(geo, mat), wear);
}

/**
 * A rolled arm (the photo's): its outline seen from the front — the inside rising from the seat and running out
 * into a fat roll at the top, the roll standing out past the outside with the cloth tucked in under it, the
 * bottom corners rounded — carried from z0 to its front at z1, its front edge rounded (re) on to a flat front
 * panel. The cloth one strip round it (its seam underneath) and the panel's own, their seam at 45° round the
 * front edge (userData.seam, [points, normals]: up one side, over, down the other — for the welt). Pressed down
 * along the top where hands and elbows go. `s`: the outside, +1 (+x) or -1. Its outline's bottom middle at 0.
 */
function rollArm(s, z0, z1, mat, { lumps = 0.0025, seed = 1 } = {}) {
  const re = 0.03, pts = [], ss = THREE.MathUtils.smoothstep;
  const line = (a, b) => { const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.02)); for (let i = 0; i < k; i++) pts.push([a[0] + ((b[0] - a[0]) * i) / k, a[1] + ((b[1] - a[1]) * i) / k]); };
  const corner = (cx, a0) => { for (let i = 0; i < 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); pts.push([cx + re * Math.cos(a), re + re * Math.sin(a)]); } };
  // (drawn with the outside to the right, round anticlockwise from the middle of the bottom)
  line([0, 0], [0.092, 0]);
  corner(0.092, -Math.PI / 2);
  line([0.122, re], [0.122, 0.4]);
  const roll = new THREE.CatmullRomCurve3([[0.122, 0.4], [0.123, 0.425], [0.142, 0.452], [0.158, 0.5], [0.15, 0.545], [0.12, 0.578], [0.075, 0.592], [0.02, 0.595], [-0.035, 0.587], [-0.075, 0.563], [-0.1, 0.527], [-0.114, 0.48], [-0.121, 0.42], [-0.125, 0.33]].map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const rk = Math.ceil(roll.getLength() / 0.01);
  roll.getSpacedPoints(rk).slice(0, rk).forEach((q) => pts.push([q.x, q.y]));
  line([-0.125, 0.33], [-0.125, re]);
  corner(-0.095, Math.PI);
  line([-0.095, 0], [0, 0]);
  pts.push([0, 0]);
  const K = pts.length, u = [0], nrm = [];
  for (let k = 1; k < K; k++) u.push(u[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  for (let k = 0; k < K; k++) {
    const [ax, ay] = pts[k === 0 ? K - 2 : k - 1], [bx, by] = pts[k === K - 1 ? 1 : k + 1], l = Math.hypot(bx - ax, by - ay);
    nrm.push([(by - ay) / l, -(bx - ax) / l]);
  }
  // rings along it, then round the front edge (phi), the last few on the front panel's side of the seam
  const rings = [], zEnd = z1 - re, nz = Math.ceil((zEnd - z0) / 0.025);
  for (let i = 0; i <= nz; i++) rings.push({ z: z0 + ((zEnd - z0) * i) / nz, phi: 0, panel: false });
  for (const [deg, panel] of [[15, false], [30, false], [45, false], [45, true], [60, true], [75, true], [90, true]]) {
    const phi = deg * (Math.PI / 180);
    rings.push({ z: zEnd + re * Math.sin(phi), phi, panel });
  }
  const pos = [], uv = [], idx = [], seamPts = [], seamNor = [], mid = (z0 + z1) / 2, R = rings.length, seamAt = rings.findIndex((q) => q.panel);
  rings.forEach(({ z, phi, panel }, j) => {
    const inset = re * (1 - Math.cos(phi)), c = Math.cos(phi);
    for (let k = 0; k < K; k++) {
      const [px, py] = pts[k], [nx, ny] = nrm[k], x = (px - nx * inset) * s, y = py - ny * inset, n3 = [nx * s * c, ny * c, Math.sin(phi)];
      const away = (1 - ss(phi, 0, Math.PI / 4)) * ss(py, 0.02, 0.06);
      const push = away * (lumps * (vnoise(x * 9 + seed, y * 9, z * 9) * 2 - 1) - Math.max(0, ny) * (0.006 * Math.exp(-(((z - (z1 - 0.13)) / 0.1) ** 2)) + 0.004 * Math.exp(-(((z - mid) / 0.16) ** 2))));
      pos.push(x + n3[0] * push, y + n3[1] * push, z + n3[2] * push);
      uv.push(...(panel ? [x, y] : [u[k], z]));
      if (j === seamAt && py > 0.012) { seamPts.push(new THREE.Vector3(x, y, z)); seamNor.push(new THREE.Vector3(...n3)); }
    }
  });
  for (let j = 0; j < R - 1; j++) {
    if (j + 1 === seamAt) continue;
    for (let k = 0; k < K - 1; k++) {
      const a = j * K + k, b = a + 1, c = a + K + 1, d = a + K;
      idx.push(...(s > 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c]));
    }
  }
  // the front panel, flat, inside the last ring (the bottom corners have closed up to a point there: once each)
  const last = (R - 1) * K, keep = [];
  for (let k = 0; k < K - 1; k++) {
    const q = new THREE.Vector2(pos[(last + k) * 3], pos[(last + k) * 3 + 1]);
    if (!keep.length || q.distanceTo(keep[keep.length - 1].q) > 1e-4) keep.push({ q, i: last + k });
  }
  for (const tri of THREE.ShapeUtils.triangulateShape(keep.map((o) => o.q), [])) {
    const [a, b, c] = tri.map((t) => keep[t]), area = (b.q.x - a.q.x) * (c.q.y - a.q.y) - (c.q.x - a.q.x) * (b.q.y - a.q.y);
    idx.push(...(area > 0 ? [a.i, b.i, c.i] : [a.i, c.i, b.i]));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // the places that are there twice (the panel's seam, the strip's ends): one normal, so it shades as one piece
  const nA = geo.attributes.normal, va = new THREE.Vector3(), vb = new THREE.Vector3();
  const same = (a, b) => { va.fromBufferAttribute(nA, a).add(vb.fromBufferAttribute(nA, b)).normalize(); nA.setXYZ(a, va.x, va.y, va.z); nA.setXYZ(b, va.x, va.y, va.z); };
  for (let k = 0; k < K; k++) same((seamAt - 1) * K + k, seamAt * K + k);
  for (let j = 0; j < R; j++) same(j * K, j * K + K - 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.seam = [seamPts, seamNor];
  return mesh;
}

/**
 * Old cloth's wear, in the material: its meshes carry `aWear` = [faded, rubbed, grimy] (upholster). Faded: a
 * lighter, duller shade of the same colours (the sun, the years). Rubbed: the nap worn flat, the weave's colours
 * run into each other, pills of fibre on it, the threads' relief lower; a welt rubbed hardest (over 0.85) worn
 * through to its cord here and there. Grimy: a little darker and browner (hands, heads). All of it broken up at
 * a few centimetres, never even.
 */
export function fabricWear(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec3 aWear;\nvarying vec3 vWear;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvWear = aWear;');
    sh.fragmentShader = `varying vec3 vWear;
float fwHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float fwNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( fwHash( i ), fwHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( fwHash( i + vec2( 0.0, 1.0 ) ), fwHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
` + sh.fragmentShader
      .replace('#include <bumpmap_pars_fragment>', THREE.ShaderChunk.bumpmap_pars_fragment.replaceAll('bumpScale * texture2D', 'bumpScale * ( 1.0 - 0.6 * clamp( vWear.y, 0.0, 1.0 ) ) * texture2D'))
      .replace('#include <map_fragment>', `
	vec2 wq = vMapUv * 7.0; // (a tile is 0.22 m: broken up at about 3 cm)
	float patchy = 0.45 + 1.1 * fwNoise( wq ) * ( 0.6 + 0.4 * fwNoise( wq * 2.7 + 5.0 ) );
	float rub = clamp( vWear.y * patchy, 0.0, 1.0 ), grime = clamp( vWear.z * patchy, 0.0, 1.0 );
	float fade = clamp( vWear.x * ( 0.8 + 0.4 * fwNoise( wq * 0.5 + 9.0 ) ) + 0.4 * rub, 0.0, 1.0 );
	vec3 cloth = mix( texture2D( map, vMapUv ).rgb, texture2D( map, vMapUv, 3.0 ).rgb, 0.6 * rub );
	vec2 pq = vMapUv * 90.0; // pills, about 2.5 mm apart — only near: further off they would sparkle
	float near = 1.0 - smoothstep( 0.25, 0.8, fwidth( pq.x ) + fwidth( pq.y ) );
	cloth *= 1.0 + 0.35 * rub * near * step( 0.86, fwHash( floor( pq ) ) ) * smoothstep( 0.5, 0.15, length( fract( pq ) - 0.5 ) );
	cloth = mix( cloth, vec3( 0.5, 0.47, 0.4 ), smoothstep( 0.85, 1.0, vWear.y ) * step( 0.45, fwNoise( vMapUv * 60.0 ) ) );
	cloth = pow( cloth, vec3( 1.0 - 0.36 * fade ) ); // (in linear: the darks lifted most, the hue kept)
	cloth = mix( cloth, vec3( dot( cloth, vec3( 0.3, 0.59, 0.11 ) ) ), 0.35 * fade );
	cloth *= mix( vec3( 1.0 ), vec3( 0.8, 0.75, 0.66 ), grime );
	diffuseColor.rgb *= cloth;
`);
  };
  mat.customProgramCacheKey = () => 'fabricWear';
  return mat;
}

/**
 * A two-seater in an old woven plaid (user, 2026-10-20, with a photo of one — its look only; the leather one's
 * size): fat rolled arms standing out past its sides, two loose box cushions on the seat and two plump cushions
 * leaning on the back, a welt in every seam, one round the bottom, short oak feet. Old: the seats sagging where
 * they are sat on, the left one (from the front) most, the cloth gone slack there; the fronts of the seats and
 * the arms' tops rubbed flat and pilled, a welt worn through to its cord; the tops faded by the window behind it,
 * not the sides the cushions keep covered; heads have greyed the backs; one seat cushion pushed out and askew.
 * The tears, a burn and the stains are decals on `seats`, `arms` and `backs` (house.js). `fabric` takes
 * fabricWear. `sag`, `used`: each seat's (the basement's older one more); `sunK`: how faded. Front +z, along x.
 */
export function plaidSofa(fabric, wood, { sag = [0.04, 0.018], used = [0.7, 0.4], sunK = 1 } = {}) {
  fabricWear(fabric);
  const g = new THREE.Group();
  const long = 2.0, deep = 0.92, footH = 0.06, deck = 0.31, front = deep / 2 - 0.01, armX = 0.842, inside = armX - 0.125, o45 = 0.03 * (1 - Math.SQRT1_2);
  const seats = [], arms = [], backs = [], ss = THREE.MathUtils.smoothstep;
  Object.assign(g.userData, { seats, arms, backs, long, deep });
  // the window behind it has faded what faces up and back; all of it a little
  const sun = (ny, nz) => (0.18 + 0.4 * Math.max(0, ny) + 0.2 * Math.max(0, -nz)) * sunK;
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  // the feet: short square blocks of oak tapering to the floor, each set a little differently
  const footGeo = new RoundedBoxGeometry(0.055, footH, 0.055, 2, 0.006), fp = footGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) { const k = 0.8 + 0.2 * (fp.getY(i) / footH + 0.5); fp.setX(i, fp.getX(i) * k); fp.setZ(i, fp.getZ(i) * k); }
  for (const [sx, sz, turn] of [[-1, 1, 0.03], [1, 1, -0.05], [-1, -1, 0.02], [1, -1, 0.06]]) put(g, new THREE.Mesh(footGeo, wood), sx * 0.9, footH / 2, sz * (deep / 2 - 0.065)).rotation.y = turn;
  // the base under the seat cushions, between the arms: its front kicked by heels
  const baseD = front + 0.31, base = softBox(2 * inside + 0.06, deck - footH, baseD, 0.03, fabric, { lumps: 0.0015, seed: 3 });
  upholster(base, (x, y, z, nx, ny, nz) => [sun(ny, nz) * 0.7, nz > 0.5 ? 0.25 * ss(-y, -0.02, 0.1) : 0, nz > 0.5 ? 0.35 * ss(-y, -0.04, 0.1) : 0]);
  add(base, 0, footH + (deck - footH) / 2, front - baseD / 2);
  // the back the cushions lean on, between the arms: it ends where they begin (user, 2026-10-28: it ran the whole
  // width, its corners standing up over the arms) — 1 cm into each
  const backH = 0.86 - footH, frame = softBox(2 * (inside + 0.01), backH, 0.16, 0.03, fabric, { wrap: 'x', lumps: 0.002, seed: 4 });
  upholster(frame, (x, y, z, nx, ny, nz) => [sun(ny, nz) + 0.15 * Math.max(0, ny), 0, 0]);
  add(frame, 0, footH + backH / 2, -deep / 2 + 0.08);
  // the arms, the whole depth of it: rubbed and pilled along the top, most at the front where hands go, greyed there;
  // the welt round the front panel worn through at the top
  for (const s of [-1, 1]) {
    const arm = rollArm(s, -deep / 2 + 0.005, front, fabric, { seed: 10 + s });
    upholster(arm, (x, y, z, nx, ny, nz) => {
      const top = ss(ny, 0.3, 0.8), hand = ss(z, 0.05, front - 0.04), grip = nz > 0.6 ? ss(y, 0.42, 0.56) : 0;
      return [sun(ny, nz), top * (0.3 + 0.45 * hand) + 0.4 * grip, top * 0.35 * hand + 0.3 * grip];
    });
    arms.push(add(arm, s * armX, footH, 0));
    const [wp, wn] = arm.userData.seam;
    arm.add(welt(wp, wn, fabric, (x, y) => [0.3, 0.3 + 0.62 * ss(y, 0.45, 0.58), 0.2 * ss(y, 0.45, 0.58)], false));
  }
  // a welt round the bottom, along the 45° of every piece's lower edge
  {
    const hx = armX + 0.122 - o45, z0 = -deep / 2 + o45, z1 = front - o45, mz = (z0 + z1) / 2, hz = (z1 - z0) / 2, cr = 0.02;
    const pts = roundRect(2 * hx, 2 * hz, cr, 4).map(([x, z]) => new THREE.Vector3(x, footH + o45, z + mz));
    const nor = pts.map((q) => {
      const dx = q.x - THREE.MathUtils.clamp(q.x, -hx + cr, hx - cr), dz = q.z - mz - THREE.MathUtils.clamp(q.z - mz, -hz + cr, hz - cr), l = Math.hypot(dx, dz) || 1;
      return new THREE.Vector3(dx / l, -1, dz / l).normalize();
    });
    g.add(welt(pts, nor, fabric, (x, y, z) => [0.2, z > front - 0.05 ? 0.4 : 0.1, z > front - 0.05 ? 0.35 : 0.1]));
  }
  // the seat cushions: box cushions with a welt round the top and the bottom, crowned, sagging where they are
  // sat on, their fronts rolled down, the cloth gone slack in creases there; the right one pushed out and askew
  const cw = inside + 0.006, ch = 0.155, cd = front - 0.01 + 0.305, hw = cw / 2, hd = cd / 2;
  for (let i = 0; i < 2; i++) {
    const top = (x, z) => 0.014 * Math.max(0, 1 - (x / hw) ** 2) * Math.max(0, 1 - (z / hd) ** 2) - sag[i] * Math.max(0, 1 - (x / (hw - 0.06)) ** 2) * Math.max(0, 1 - ((z - 0.08) / (hd - 0.04)) ** 2) - 0.008 * used[i] * ss(z / hd, 0.6, 1) * Math.max(0, 1 - (x / hw) ** 2);
    const seat = softBox(cw, ch, cd, 0.035, fabric, {
      seed: 20 + i, lumps: 0.003,
      shape: (u, v, w, nx, ny, nz) => {
        const x = u * hw, z = w * hd, slack = 0.0022 * Math.sin(x * 38 + i * 2 + Math.sin(z * 9) * 1.5) * ss(w, 0.1, 0.8) * (1 - u * u) * used[i];
        return ss(ny, 0, 0.9) * (top(x, z) + slack) + ss(nz, 0, 0.9) * 0.012 * Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v) + ss(Math.abs(nx), 0, 0.9) * 0.008 * Math.max(0, 1 - v * v) * Math.max(0, 1 - w * w);
      },
    });
    upholster(seat, (x, y, z, nx, ny, nz) => {
      const sitting = ss(z, 0, hd) * Math.max(0, 1 - (x / hw) ** 2), covered = Math.abs(nx) > 0.6 ? 0.3 : 1; // (its sides, against an arm and the other cushion, out of the sun)
      return [sun(ny, nz) * covered, (ny > 0.3 ? used[i] * sitting : 0) + (nz > 0.6 ? used[i] * 0.6 * ss(y, -0.03, ch / 2) * Math.max(0, 1 - (x / hw) ** 2) : 0), ny > 0.3 ? 0.18 * used[i] * sitting : 0];
    });
    seats.push(add(seat, (i ? 1 : -1) * (hw + 0.002), deck - 0.01 + ch / 2, front - 0.01 - hd + [0, 0.015][i]));
    seat.rotation.set(0, [0.004, 0.018][i], [0.008, -0.01][i]); // never quite level, never quite square
    for (const f of [2, 3]) {
      const [wp, wn] = seamLoop(seat, f);
      seat.add(welt(wp, wn, fabric, (x, y, z) => (f === 2 && z > hd - 0.04 ? [0.35, 0.4 + 0.9 * used[i] * Math.max(0, 1 - (x / hw) ** 2), 0.15] : [0.25, 0.1, 0])));
    }
  }
  // the back cushions, leaning on it: plump, their filling slumped to the bottom over the years — a fold across
  // a third of the way up, the top gone thin and creased — the middle of their tops greyed by heads
  const bw = inside + 0.005, bh = 0.5, bd = 0.2;
  for (let i = 0; i < 2; i++) {
    const back = softBox(bw, bh, bd, 0.06, fabric, {
      wrap: 'z', seed: 40 + i, lumps: 0.006,
      shape: (u, v, w, nx, ny, nz) => {
        const body = Math.max(0, 1 - u * u);
        return ss(nz, 0, 0.9) * body * (0.034 * Math.max(0, 1 - v * v) - 0.016 * Math.exp(-((v + 0.32) ** 2) * 60) - 0.012 * ss(v, 0.2, 1) + 0.0018 * Math.sin(v * 34 + u * 3 + i) * ss(v, -0.1, 0.7)) + 0.008 * Math.max(0, v) ** 3 * ss(ny, 0, 1);
      },
    });
    upholster(back, (x, y, z, nx, ny, nz) => {
      const head = ss(y, 0.05, 0.2) * Math.max(0, 1 - (x / 0.24) ** 2) * ss(nz, 0.2, 0.8);
      return [sun(ny, nz) + 0.1, 0.32 * head, 0.38 * head];
    });
    backs.push(add(back, (i ? 1 : -1) * (bw / 2 + 0.003), deck - 0.01 + ch - 0.012 + 0.263, -0.185));
    back.rotation.set(-0.14 + [0.02, -0.015][i], 0, [0.012, -0.008][i]);
    for (const f of [4, 5]) {
      const [wp, wn] = seamLoop(back, f);
      back.add(welt(wp, wn, fabric, (x, y) => [0.3, f === 4 && y > bh / 2 - 0.05 ? 0.35 : 0.1, 0.1]));
    }
  }
  return g;
}

/** A throw folded into a pad, w × h × d: soft-edged and finely divided, so it can lie down into what it is on (house.js). UVs about a share of its size. */
export function foldedThrow(w, h, d, mat) {
  const m = softBox(w, h, d, 0.02, mat, { lumps: 0.0015, seed: 7 }), uv = m.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w, uv.getY(i) / w);
  return m;
}

// ---------------------------------------------------------------- fruit (user, 2026-10-17: "better, well made")

/** A turned fruit from its outline [radius, height], bottom to top, a little lumpy round (`lobes`), with its skin. */
function turnedFruit(profile, map, { lobes = 5, lump = 0.035, seed = 1, rough = 0.42 } = {}) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 40);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + lump * Math.sin(a * lobes + seed) + lump * 0.5 * Math.sin(a * 2 + seed * 3);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, std({ map, roughness: rough }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** A stalk: a thin bent stick from the top of a fruit at y. */
function stalk(y, len, mat, bend = 0.4) {
  const pts = [new THREE.Vector3(0, y - 0.004, 0), new THREE.Vector3(0.002, y + len * 0.5, 0.001), new THREE.Vector3(len * bend * 0.6, y + len, len * 0.15)];
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.0016, 6), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

const APPLE = [[0.0005, 0.004], [0.012, 0.0012], [0.026, 0.004], [0.036, 0.013], [0.041, 0.027], [0.0405, 0.042], [0.036, 0.055], [0.026, 0.064], [0.014, 0.0665], [0.006, 0.0615], [0.0005, 0.0575]];
const PEAR = [[0.0005, 0.003], [0.014, 0.0005], [0.028, 0.006], [0.035, 0.018], [0.036, 0.032], [0.031, 0.048], [0.022, 0.062], [0.016, 0.076], [0.0125, 0.088], [0.009, 0.097], [0.003, 0.101], [0.0005, 0.1]];

/** An apple (its bottom at y = 0), red or green; `bitten`: a bite out of one side, gone brown. */
export function apple(seed, { green = false, bitten = false } = {}) {
  const g = new THREE.Group();
  const skin = turnedFruit(APPLE, T.appleTex(seed, green ? [150, 160, 50] : [168, 32, 26], green ? [196, 186, 70] : [176, 160, 62]), { seed, lump: 0.03 });
  g.add(skin);
  if (bitten) {
    // the bite: cut flat into one side, the skin standing round it as a rim, the flesh showing in it
    const p = skin.geometry.attributes.position, CUT = 0.022, BR = 0.023;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > CUT && (p.getY(i) - 0.035) ** 2 + p.getZ(i) ** 2 < BR * BR) p.setX(i, CUT);
    skin.geometry.computeVertexNormals();
    const flesh = new THREE.Mesh(new THREE.CircleGeometry(BR, 28), std({ map: T.biteTex(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    flesh.rotation.y = Math.PI / 2;
    flesh.position.set(CUT + 0.0003, 0.035, 0);
    flesh.receiveShadow = true;
    g.add(flesh);
  }
  g.add(stalk(0.062, 0.016, std({ color: 0x4a3420, roughness: 0.8 })));
  g.userData.r = 0.041; // (as round as it is, for setting it down)
  g.userData.h = 0.066;
  return g;
}

/** An orange (its bottom at y = 0). */
export function orange(seed) {
  const geo = new THREE.SphereGeometry(0.037, 36, 26);
  geo.scale(1, 0.94, 1);
  geo.translate(0, 0.037 * 0.94, 0);
  const m = new THREE.Mesh(geo, std({ map: T.orangeTex(seed), bumpMap: T.orangeTex(seed, 'bump'), bumpScale: 0.6, roughness: 0.55 }));
  m.castShadow = m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  g.userData.r = 0.037;
  g.userData.h = 0.07;
  return g;
}

/** A pear (its bottom at y = 0). */
export function pear(seed) {
  const g = new THREE.Group();
  g.add(turnedFruit(PEAR, T.pearTex(seed), { seed, lump: 0.025, lobes: 3, rough: 0.5 }));
  g.add(stalk(0.098, 0.022, std({ color: 0x4f3a22, roughness: 0.8 }), 0.7));
  g.userData.r = 0.036;
  g.userData.h = 0.1;
  return g;
}

/** A banana along `path` (points, tip first, stalk last), its five-sided body thickest in the middle, tapering to a black tip and a stalk. */
export function banana(path, seed = 13) {
  const curve = new THREE.CatmullRomCurve3(path), NA = 48, NR = 20, pos = [], uv = [], idx = [];
  const frames = curve.computeFrenetFrames(NA, false);
  for (let i = 0; i <= NA; i++) {
    const t = i / NA, P = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i];
    const body = 0.0175 * Math.pow(Math.sin(Math.PI * Math.min(1, t / 0.9)), 0.5) * (t > 0.9 ? 0 : 1);
    const r = t > 0.88 ? 0.0055 : Math.max(0.004, body); // the stalk
    for (let j = 0; j <= NR; j++) {
      const a = (j / NR) * Math.PI * 2, rr = r * (1 + 0.06 * Math.cos(a * 5));
      pos.push(P.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * rr, P.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * rr, P.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * rr);
      uv.push(j / NR, t);
    }
  }
  for (let i = 0; i < NA; i++) for (let j = 0; j < NR; j++) {
    const a = i * (NR + 1) + j, b = a + 1, c = a + NR + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, std({ map: T.bananaTex(seed), roughness: 0.6, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

/**
 * A cream glazed fruit bowl on its foot (the foot at y = 0), with fruit in it set down as it would lie
 * — each let down onto the bowl and the fruit already in it, nothing in anything. `inner(r)`: the height
 * of the bowl's inside r from its middle.
 */
export function fruitBowl() {
  const g = new THREE.Group();
  const OUT = [[0.0005, 0.002], [0.044, 0.002], [0.047, 0.0], [0.05, 0.0], [0.052, 0.004], [0.051, 0.01], [0.056, 0.013], [0.075, 0.022], [0.1, 0.038], [0.12, 0.056], [0.133, 0.072], [0.139, 0.084], [0.139, 0.089], [0.135, 0.091]];
  const IN = [[0.13, 0.088], [0.12, 0.074], [0.1, 0.055], [0.075, 0.04], [0.045, 0.031], [0.015, 0.0275], [0.0005, 0.0272]];
  const prof = [...OUT, ...IN], n = prof.length;
  // glazed, cream (no lighter than the plates by the sink), a thin brown line round it under the rim
  const glaze = canvasTexLocal(8, 256, (c, w, h) => {
    c.fillStyle = '#d2c5a6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#6a4a2c';
    for (const k of [10.2, 15.4]) { const y = h * (1 - k / (n - 1)); c.fillRect(0, y - 1, w, 2); }
  });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 64), std({ map: glaze, roughness: 0.45 }));
  bowl.castShadow = false; // (its shadow: house.js)
  // it takes the shadows of the walls (without them the sun lit it through the house, too white — user,
  // 2026-10-17), but not the ceiling lamps': their coarse shadows of the fruit came out on its inside as dashes
  bowl.material.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>',
      THREE.ShaderChunk.lights_fragment_begin.replace('( directLight.visible && receiveShadow ) ? getPointShadow', 'false ? getPointShadow'));
  };
  bowl.material.customProgramCacheKey = () => 'bowl-no-lamp-shadow';
  bowl.receiveShadow = true;
  g.add(bowl);
  const inner = (r) => {
    if (r >= IN[0][0]) return IN[0][1] + (r - IN[0][0]) * 2;
    for (let i = 0; i < IN.length - 1; i++) {
      const [r0, y0] = IN[i], [r1, y1] = IN[i + 1];
      if (r <= r0 && r >= r1) return y1 + ((r - r1) / (r0 - r1)) * (y0 - y1);
    }
    return IN[IN.length - 1][1];
  };
  g.userData.inner = inner;
  // the fruit, each let down where it goes until it rests on the bowl (every point of its skin clear of
  // the bowl's inside) or on the fruit already there (as balls round their middles)
  const placed = [], v = new THREE.Vector3();
  const floorAt = (x, y, z) => { const r = Math.hypot(x, z); return r < IN[0][0] ? inner(r) - y : r < 0.142 ? 0.0915 - y : -Infinity; };
  const above = (obj) => { // how far up obj must go to be clear of the bowl, as it stands
    obj.updateMatrixWorld(true);
    let need = -Infinity;
    obj.traverse((o) => { if (!o.isMesh) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); need = Math.max(need, floorAt(v.x, v.y, v.z)); } });
    return need;
  };
  const settle = (fruit, x, z, yaw, tilt = 0) => {
    const R = fruit.userData.r;
    fruit.position.set(x, 0, z);
    fruit.rotation.set(tilt, yaw, tilt * 0.6, 'YXZ');
    let y = above(fruit);
    for (const o of placed) {
      const dh = Math.hypot(x - o.x, z - o.z), reach = R + o.R;
      if (dh < reach) y = Math.max(y, o.cy + Math.sqrt(reach * reach - dh * dh) - R);
    }
    fruit.position.y = y + 0.0006;
    placed.push({ x, z, R, cy: y + R });
    g.add(fruit);
    return fruit;
  };
  settle(orange(5), -0.012, 0.01, 0.4);
  settle(apple(21), 0.062, -0.028, 1.1, 0.12);
  settle(apple(22, { green: true }), -0.058, 0.05, 2.6, -0.1);
  settle(pear(9), 0.028, 0.072, 0.3, 0.25);
  settle(apple(23), -0.04, -0.062, 4.0, 0.08);
  // (no bananas over the rim any more: user, 2026-10-17)
  return g;
}

/** (a canvas texture, here where textures.js is not wanted for one stripe) */
function canvasTexLocal(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A stuffed cushion, `w` by `h`, `d` thick at its middle: square at its seams, plump in the middle,
 * thin at the corners where the stuffing doesn't reach. Facing ±z.
 */
export function cushion(w, h, d, mat) {
  const geo = new THREE.SphereGeometry(1, 48, 36);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const sx = Math.sign(x) * Math.pow(Math.abs(x), 0.4), sy = Math.sign(y) * Math.pow(Math.abs(y), 0.4);
    const edge = Math.max(Math.abs(sx), Math.abs(sy));
    p.setXYZ(i, (sx * w) / 2, (sy * h) / 2, ((z * d) / 2) * (1 - 0.8 * edge ** 4));
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** A turned table leg, or a chair's: thick where it meets the frame, a ring, tapering to the floor. */
const turnedLeg = (tall, thick, mat) => lathe([[0, 0], [thick * 0.6, 0], [thick * 0.65, tall * 0.05], [thick * 0.8, tall * 0.55], [thick, tall * 0.62], [thick * 0.75, tall * 0.66], [thick * 0.9, tall * 0.8], [thick, tall * 0.82], [thick, tall], [0, tall]], mat, 16);

/** The kitchen table: a thick top with rounded edges, an apron, four turned legs. Centred, front +z, `w` along x. */
export function kitchenTable(wood, w = 1.2, d = 0.8) {
  const g = new THREE.Group();
  put(g, rounded(w, 0.035, d, 0.012, wood), 0, 0.735, 0);
  for (const [x0, z0, ax] of [[0, d / 2 - 0.06, 1], [0, -d / 2 + 0.06, 1], [w / 2 - 0.06, 0, 0], [-w / 2 + 0.06, 0, 0]]) {
    put(g, rounded(ax ? w - 0.16 : 0.025, 0.09, ax ? 0.025 : d - 0.16, 0.004, wood), x0, 0.67, z0);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(g, turnedLeg(0.72, 0.03, wood), x * (w / 2 - 0.06), 0, z * (d / 2 - 0.06));
  return g;
}

/** A kitchen chair: turned front legs, a back of three spindles under a curved top rail. Front +z. */
export function kitchenChair(wood) {
  const g = new THREE.Group();
  const seatH = 0.45;
  put(g, rounded(0.42, 0.035, 0.4, 0.01, wood), 0, seatH, 0.01);
  // (every part into the next — user, 2026-10-20: "parts float": the seat sat 2.5 mm over its front legs, the
  // spindles stopped 1 cm over the seat and 3 cm under the top rail, the back posts short of the floor)
  for (const x of [-0.17, 0.17]) {
    put(g, turnedLeg(seatH - 0.012, 0.019, wood), x, 0, 0.16);
    const post = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.95, 12), wood), x, 0.476, -0.17);
    post.rotation.x = -0.08;
  }
  for (const z of [-0.14, 0.14]) put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 8).rotateZ(Math.PI / 2), wood), 0, 0.16, z);
  for (const x of [-0.08, 0, 0.08]) {
    const L = 0.395; // from inside the seat up into the rail
    const spindle = put(g, lathe([[0, 0], [0.008, 0], [0.011, 0.16], [0.008, L], [0, L]], wood, 10), x, seatH + 0.012, -0.17);
    spindle.rotation.x = -0.08;
  }
  // the top rail, bent to the sitter's back; its ends cut square across (user, 2026-10-28: they were open, the rail
  // hollow — each end closed on the tube's own eight points)
  const R = 0.6, r = 0.022, arc = 0.62;
  const rail = new THREE.Mesh(new THREE.TorusGeometry(R, r, 8, 24, arc), wood);
  rail.rotation.set(Math.PI / 2, 0, -Math.PI / 2 - 0.31); // lying flat, bowed back
  rail.scale.set(1, 1, 1.8); // a rail taller than it is thick
  put(g, rail, 0, 0.85, 0.41);
  for (const u of [0, arc]) {
    const out = new THREE.Vector3(Math.cos(u), Math.sin(u), 0), up = new THREE.Vector3(0, 0, 1), along = new THREE.Vector3(-Math.sin(u), Math.cos(u), 0);
    const basis = u ? new THREE.Matrix4().makeBasis(up, out, along) : new THREE.Matrix4().makeBasis(out, up, along.negate());
    put(rail, new THREE.Mesh(new THREE.CircleGeometry(r, 8).applyMatrix4(basis.setPosition(R * Math.cos(u), R * Math.sin(u), 0)), wood));
  }
  return g;
}

// ---------------------------------------------------------------- living room

/**
 * A rug lying on the floor, `w` along x by `d` along z, centred: a thick pile that isn't quite flat — one
 * corner lifted where it has been kicked up a few times, a soft ridge where it has crept — its bound edge
 * going down to the floor all round, and the fringe lying loose off both short ends.
 */
export function rug(top, edge, fringe, w, d) {
  const g = new THREE.Group();
  const T0 = 0.008, nx = 72, nz = 58;
  const lift = (x, z) => {
    const cx = w / 2 - 0.02, cz = d / 2 - 0.02; // the corner that curls
    const k = THREE.MathUtils.smoothstep(0.32, 0, Math.hypot(x - cx, z - cz));
    const ridge = 0.005 * Math.exp(-(((x + 0.25 * w) / 0.07) ** 2)) * THREE.MathUtils.smoothstep(-d / 2, d / 2, z); // creeping into a fold
    return T0 + 0.03 * k * k + ridge;
  };
  const geo = new THREE.PlaneGeometry(w, d, nx, nz).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, lift(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  put(g, new THREE.Mesh(geo, top)).castShadow = false;
  // the bound edge, from the top of the pile down to the floor, all the way round
  const rim = [];
  for (let i = 0; i <= nx; i++) rim.push([-w / 2 + (i / nx) * w, -d / 2]);
  for (let i = 1; i <= nz; i++) rim.push([w / 2, -d / 2 + (i / nz) * d]);
  for (let i = 1; i <= nx; i++) rim.push([w / 2 - (i / nx) * w, d / 2]);
  for (let i = 1; i <= nz; i++) rim.push([-w / 2, d / 2 - (i / nz) * d]);
  const pos = [];
  for (let i = 0; i < rim.length - 1; i++) {
    const [ax, az] = rim[i], [bx, bz] = rim[i + 1], ay = lift(ax, az), by = lift(bx, bz);
    pos.push(ax, ay, az, bx, 0, bz, bx, by, bz, ax, ay, az, ax, 0, az, bx, 0, bz);
  }
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  skirt.computeVertexNormals();
  const side = edge.clone();
  side.side = THREE.DoubleSide;
  put(g, new THREE.Mesh(skirt, side)).castShadow = false;
  // the fringe, lying on the floor off each short end, not quite straight
  for (const s of [-1, 1]) {
    // the strands run across the strip, tied on along its inner edge
    const fg = new THREE.PlaneGeometry(d - 0.02, 0.075, 24, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
    const fp = fg.attributes.position;
    for (let i = 0; i < fp.count; i++) fp.setX(i, fp.getX(i) + Math.sin(fp.getZ(i) * 7 + s) * 0.006 * (fp.getX(i) + 0.0375) / 0.075);
    const f = new THREE.Mesh(fg, fringe);
    f.scale.x = s; // tied on to the rug on both sides
    put(g, f, s * (w / 2 + 0.0375), 0.0025, 0).castShadow = false;
  }
  return g;
}

/**
 * A small wall cabinet of grey painted steel, the kind screwed up over a basin long ago (user,
 * 2026-10-15): a box of sheet steel with two shelves inside, each with its front edge turned down; a
 * door on a piano hinge down its right side, its middle pressed into a shallow panel, a knob on its
 * left; all of it chipped and rusting at the edges (T.wornEnamelTex). Faces +z, its back on the wall at
 * z = 0, its bottom at y = 0. `userData.door`: the door's hinge, turning on y (positive: open);
 * `userData.size`. `env`: what it reflects.
 */
export function wallCabinet(env) {
  const g = new THREE.Group();
  const W = 0.38, H = 0.5, D = 0.115, DOOR = 0.02, S = 0.006, BOX = D - DOOR; // sizes, the sheet, the box behind the door
  const lit = env ? { envMap: env, envMapIntensity: 0.35 } : {};
  const grey = (seed, catchAt = null, base = '#878b8e', stain = '98,94,88') => {
    const t = T.wornEnamelTex(seed, catchAt, { base, stain });
    return std({ ...lit, map: t.map, bumpMap: t.bump, bumpScale: 0.6, roughness: 0.5, metalness: 0.2 });
  };
  const outside = grey(517), inside = grey(523, null, '#7b7f82', '86,82,76');
  const sheet = (w, h, d, mat, x, y, z) => put(g, rounded(w, h, d, 0.0015, mat), x, y, z);
  // the box: back, sides, top and bottom
  sheet(W, H, S, inside, 0, H / 2, S / 2);
  for (const sd of [-1, 1]) sheet(S, H, BOX, outside, sd * (W / 2 - S / 2), H / 2, BOX / 2);
  sheet(W, S, BOX, outside, 0, H - S / 2, BOX / 2);
  sheet(W, S, BOX, outside, 0, S / 2, BOX / 2);
  // two shelves, a third and two thirds of the way up, their front edges turned down
  const shelfD = BOX - S - 0.01;
  for (const k of [1, 2]) {
    const y = (H * k) / 3 + (k === 2 ? 0.006 : 0); // (not quite evenly)
    sheet(W - 2 * S, 0.004, shelfD, inside, 0, y, S + shelfD / 2);
    sheet(W - 2 * S, 0.014, 0.004, inside, 0, y - 0.007, S + shelfD);
  }
  // the door, on its hinge down the right-hand side of the box's front
  const hinge = new THREE.Group();
  hinge.position.set(W / 2, 0, BOX);
  hinge.userData.live = true; // it opens: never baked into the room
  g.add(hinge);
  put(hinge, rounded(W - 0.004, H - 0.004, DOOR, 0.005, grey(512, [0.08, 0.5])), -W / 2, H / 2, DOOR / 2 + 0.001);
  // where its steel was pressed into a shallow panel: a soft rib round its middle
  const rib = roundRect(W - 0.075, H - 0.085, 0.018, 6).map(([x, z]) => new THREE.Vector3(x - W / 2, z + H / 2, DOOR + 0.0012));
  put(hinge, new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rib, true), 120, 0.0022, 6, true), std({ ...lit, color: 0x7f8386, roughness: 0.5, metalness: 0.2 })));
  // the knob, on the left
  const knob = std({ ...lit, color: 0x958f84, metalness: 0.7, roughness: 0.5 });
  put(hinge, new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0085, 0.014, 16).rotateX(Math.PI / 2), knob), -W + 0.03, H / 2, DOOR + 0.008);
  put(hinge, new THREE.Mesh(new THREE.SphereGeometry(0.0095, 16, 10), knob), -W + 0.03, H / 2, DOOR + 0.015).scale.z = 0.6;
  // the piano hinge itself, down the right edge
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, H - 0.03, 8), std({ ...lit, color: 0x6c6964, metalness: 0.6, roughness: 0.55 })), W / 2 + 0.001, H / 2, BOX + 0.001);
  g.userData.door = hinge;
  g.userData.size = { W, H, D, DOOR, BOX };
  return g;
}

/**
 * A yellow plastic bath duck, of no make: a plump body with its tail turned up behind, a round head, an
 * orange beak a little open, painted eyes. Sits on its flat bottom at y = 0, beak towards +z; about
 * 10 cm long. `env`: what it reflects.
 */
export function bathDuck(env) {
  const g = new THREE.Group();
  const lit = env ? { envMap: env, envMapIntensity: 0.5 } : {};
  const plastic = new THREE.MeshPhysicalMaterial({ ...lit, color: 0xf0bf2a, roughness: 0.33, clearcoat: 0.45, clearcoatRoughness: 0.35 });
  const beakMat = new THREE.MeshPhysicalMaterial({ ...lit, color: 0xe4701c, roughness: 0.35, clearcoat: 0.3 });
  const bodyGeo = new THREE.SphereGeometry(1, 40, 28), p = bodyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * 0.042, y = p.getY(i) * 0.031, z = p.getZ(i) * 0.052;
    const back = Math.max(0, -z / 0.052); // 0 at the middle, 1 at the very back
    y += 0.022 * back ** 3 * (y > -0.01 ? 1 : 0.4); // the tail, swept up
    z -= 0.006 * back ** 3;
    x *= 1 - 0.35 * back ** 2;
    p.setXYZ(i, x, Math.max(y, -0.026) + 0.03, z); // a flat bottom to sit on
  }
  bodyGeo.computeVertexNormals();
  put(g, new THREE.Mesh(bodyGeo, plastic));
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.027, 32, 24), plastic), 0, 0.066, 0.026);
  const beak = (rx, ry, rz) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), beakMat); m.scale.set(rx, ry, rz); return m; };
  put(g, beak(0.016, 0.0055, 0.019), 0, 0.062, 0.05);
  put(g, beak(0.013, 0.004, 0.015), 0, 0.0555, 0.047);
  const white = std({ color: 0xf2f0ea, roughness: 0.3 }), black = std({ color: 0x111111, roughness: 0.3 });
  for (const s of [-1, 1]) {
    put(g, new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 10), white), s * 0.0145, 0.073, 0.045);
    put(g, new THREE.Mesh(new THREE.SphereGeometry(0.0029, 12, 10), black), s * 0.0158, 0.0735, 0.0478);
  }
  return g;
}

/**
 * A UV torch, of no make (user, 2026-10-15: it was in the bathroom cabinet): a pocket torch of black
 * anodised aluminium gone grey at the nicks, a knurled grip, a rubber button in its tail, a steel clip,
 * a wider head with nine little LEDs behind dark violet glass. About 14 cm, lying along x with its head
 * towards +x, resting on y = 0 (thinner at the tail, it lies a little head-up). `userData.leds`: the
 * LEDs' material (they glow when it is on); a child named 'lens' marks the middle of its glass.
 */
export function uvTorch(env) {
  const g = new THREE.Group(), axis = new THREE.Group();
  const lit = env ? { envMap: env, envMapIntensity: 0.4 } : {};
  const alu = std({ ...lit, map: T.torchAluTex(), color: 0xffffff, metalness: 0.55, roughness: 0.42 });
  const grip = std({ ...lit, map: T.torchAluTex(623), color: 0xffffff, metalness: 0.55, roughness: 0.5, bumpMap: T.knurlTex(), bumpScale: 1.2 });
  grip.bumpMap.repeat.set(14, 5);
  const rubber = std({ color: 0x141414, roughness: 0.85 });
  const along = (geo) => geo.rotateZ(-Math.PI / 2); // turned out of y, along x
  // the tail cap, then (after the grip) the body widening into the head and its bezel, turned in to the glass
  const L = 0.136, X = -L / 2;
  const tail = lathe([[0, 0], [0.0104, 0], [0.0117, 0.0015], [0.0119, 0.004], [0.0119, 0.0135], [0.0114, 0.016], [0.0126, 0.0165]], alu, 32);
  along(tail.geometry);
  put(axis, tail, X);
  const knurled = new THREE.Mesh(along(new THREE.CylinderGeometry(0.0126, 0.0126, 0.066, 32, 1, true)), grip);
  put(axis, knurled, X + 0.0165 + 0.033);
  const head = lathe([[0.0126, 0], [0.0126, 0.012], [0.0128, 0.0145], [0.0152, 0.028], [0.0158, 0.031], [0.0158, 0.046], [0.0164, 0.047], [0.0164, 0.0515], [0.0158, 0.0525], [0.0141, 0.0525], [0.0137, 0.0505]], alu, 36);
  along(head.geometry);
  put(axis, head, X + 0.0825);
  // in the tail, the button, a rubber dome
  const button = put(axis, new THREE.Mesh(new THREE.SphereGeometry(0.0082, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), rubber), X + 0.0005);
  button.rotation.z = Math.PI / 2;
  button.scale.set(1, 0.35, 1);
  // the glass, dark violet, and the LEDs behind it: one in the middle, eight round it
  const glassAt = X + L - 0.0035;
  const glass = put(axis, new THREE.Mesh(new THREE.CircleGeometry(0.0138, 32).rotateY(Math.PI / 2), std({ ...lit, color: 0x1e1630, roughness: 0.08, metalness: 0.1 })), glassAt);
  glass.castShadow = false;
  const leds = std({ color: 0x9a90bd, roughness: 0.25, emissive: 0x6a44ff, emissiveIntensity: 0 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI * 2, rr = i < 8 ? 0.0086 : 0;
    const led = put(axis, new THREE.Mesh(new THREE.SphereGeometry(0.0021, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), leds), glassAt - 0.0004, Math.sin(a) * rr, Math.cos(a) * rr);
    led.rotation.z = -Math.PI / 2;
    led.castShadow = false;
  }
  const lens = new THREE.Object3D();
  lens.name = 'lens';
  lens.position.x = glassAt + 0.002;
  axis.add(lens);
  // the clip, a strip of spring steel along the grip, turned a little round from the top
  const clip = new THREE.Group();
  const steel = std({ ...lit, color: 0x9c9da2, metalness: 0.85, roughness: 0.38 });
  put(clip, rounded(0.052, 0.0013, 0.0062, 0.0005, steel), X + 0.046, 0.0141, 0);
  put(clip, rounded(0.006, 0.0032, 0.0066, 0.0008, steel), X + 0.0185, 0.0129, 0); // where it is pinched round the body
  put(clip, rounded(0.004, 0.0024, 0.0062, 0.0008, steel), X + 0.0715, 0.0133, 0); // its end, turned in
  clip.rotation.x = 0.7;
  axis.add(clip);
  // lying down: the head is the wider, so it lies a little tilted, tail down
  axis.rotation.z = Math.atan2(0.0164 - 0.0119, L * 0.9);
  g.add(axis);
  g.updateMatrixWorld(true);
  axis.position.y = -new THREE.Box3().setFromObject(axis).min.y;
  g.userData.leds = leds;
  return g;
}

/**
 * A torch of the time, left lying in the grass by the cellar's doors (user, 2026-10-21): yellow plastic gone pale and
 * scuffed, a waist for the hand, widening into its head; black rubber round the head and on the tail, a cord loop
 * there; a slide switch on top; behind its glass a silvered reflector and a little bulb. Lies along x, its glass at +x
 * (`lens`); `userData.glow`: what lights up when it is on (the glass, the bulb); `userData.mats`: all its materials.
 */
export function oldTorch() {
  const g = new THREE.Group(), axis = new THREE.Group();
  const plastic = std({ color: 0xb39443, roughness: 0.62, bumpMap: T.noiseBump(731, [3, 3]), bumpScale: 0.25 });
  const rubber = std({ color: 0x1c1b1a, roughness: 0.9 });
  const silver = std({ color: 0xb8b6ae, metalness: 0.9, roughness: 0.22 });
  const glass = std({ color: 0x8e908a, roughness: 0.08, metalness: 0.2, emissive: 0xffd9a0, emissiveIntensity: 0 });
  const bulb = std({ color: 0xd8d2c0, roughness: 0.3, emissive: 0xffc070, emissiveIntensity: 0 });
  const along = (geo) => geo.rotateZ(-Math.PI / 2); // turned out of y, along x
  const L = 0.19, X = -L / 2;
  const body = lathe([[0, 0], [0.0152, 0], [0.0166, 0.004], [0.0166, 0.022], [0.0158, 0.06], [0.0156, 0.1], [0.0166, 0.118], [0.0212, 0.138], [0.0252, 0.15], [0.0252, 0.155], [0.0236, 0.155]], plastic, 36);
  along(body.geometry);
  put(axis, body, X);
  const tail = lathe([[0, -0.006], [0.0158, -0.006], [0.0172, -0.003], [0.0172, 0.016], [0.0164, 0.018]], rubber, 32);
  along(tail.geometry);
  put(axis, tail, X);
  const loop = put(axis, new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0022, 6, 16), rubber), X - 0.012, 0, 0);
  loop.rotation.y = Math.PI / 2;
  const bezel = lathe([[0.0236, 0], [0.0266, 0.001], [0.0272, 0.004], [0.0272, 0.017], [0.0262, 0.02], [0.0226, 0.02], [0.0222, 0.017]], rubber, 36);
  along(bezel.geometry);
  put(axis, bezel, X + 0.152);
  const reflector = lathe([[0.004, 0], [0.0222, 0.014]], silver, 28);
  along(reflector.geometry);
  reflector.material.side = THREE.DoubleSide;
  put(axis, reflector, X + 0.155);
  put(axis, new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 8), bulb), X + 0.161).castShadow = false;
  const lensAt = X + 0.1695;
  put(axis, new THREE.Mesh(new THREE.CircleGeometry(0.0224, 32).rotateY(Math.PI / 2), glass), lensAt).castShadow = false;
  const lens = new THREE.Object3D();
  lens.name = 'lens';
  lens.position.x = lensAt + 0.002;
  axis.add(lens);
  put(axis, rounded(0.024, 0.006, 0.011, 0.0025, rubber), X + 0.118, 0.0168, 0); // the switch, slid forward: on
  // lying down: the head is the wider, so it lies tipped, tail down
  axis.rotation.z = Math.atan2(0.0272 - 0.0172, L * 0.9);
  g.add(axis);
  g.updateMatrixWorld(true);
  axis.position.y = -new THREE.Box3().setFromObject(axis).min.y;
  g.userData.glow = [glass, bulb];
  g.userData.mats = [plastic, rubber, silver, glass, bulb];
  return g;
}

/**
 * A light switch on a wall, the plain plastic kind gone a little yellow: a plate with two screws and a
 * rocker that tips to one side or the other. Faces +z, its back on the wall at z = 0, its middle at
 * y = 0. `userData.rocker`: the rocker, tipped by its rotation.x (`userData.flip(on)`). `env`: what it
 * reflects (in the bathroom, the bathroom's own: with the house's dim one it looked brown).
 */
export function wallSwitch(env) {
  const g = new THREE.Group();
  const lit = env ? { envMap: env, envMapIntensity: 0.45 } : {};
  const plastic = std({ ...lit, color: 0xd6cfbd, roughness: 0.55 }), rockerMat = std({ ...lit, color: 0xdbd4c3, roughness: 0.45 });
  put(g, rounded(0.072, 0.114, 0.009, 0.003, plastic), 0, 0, 0.0045);
  for (const y of [-0.044, 0.044]) {
    const screw = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0027, 0.0027, 0.0012, 14).rotateX(Math.PI / 2), std({ ...lit, color: 0x8d8a82, metalness: 0.6, roughness: 0.5 })), 0, y, 0.0094);
    screw.rotation.z = y > 0 ? 0.4 : 1.9; // never turned the same way twice
  }
  const rocker = new THREE.Group();
  rocker.position.z = 0.009;
  put(rocker, rounded(0.027, 0.042, 0.009, 0.0025, rockerMat), 0, 0, 0.0015);
  g.add(rocker);
  g.userData.rocker = rocker;
  g.userData.flip = (on) => { rocker.rotation.x = on ? -0.13 : 0.13; }; // on: pressed in at the top
  g.userData.flip(true);
  return g;
}

/**
 * A decal laid over the top of `mesh` (its upward-facing triangles, projected straight down in its own
 * frame): `at` [x, z] its middle and `size` [x, z] in the mesh's own units, `map` with its own alpha, `lift`
 * off the surface. `front`: laid over its front instead (+z, projected straight back; `at` and `size` then
 * [x, y]). `turn`: the decal turned on the surface, radians. It follows the surface's dips and curves. Added
 * beside the mesh, to its parent, in the mesh's place (a child of it would go when the mesh is baked into
 * the room: build.bakeStatic); returned.
 */
export function projectDecal(mesh, { at: [cx, cz], size: [sx, sz], map, roughness = 1, lift = 0.0015, facing = 0.3, front = false, turn = 0 }) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  if (!src.attributes.normal) src.computeVertexNormals();
  const p = src.attributes.position, n = src.attributes.normal, pos = [], nor = [], uv = [];
  const across = (j) => (front ? p.getY(j) : p.getZ(j)) - cz, c = Math.cos(turn), s = Math.sin(turn);
  const U = (j) => ((p.getX(j) - cx) * c + across(j) * s) / sx + 0.5, V = (j) => (across(j) * c - (p.getX(j) - cx) * s) / sz + 0.5;
  for (let i = 0; i < p.count; i += 3) {
    let up = 0, near = false;
    for (let k = 0; k < 3; k++) {
      up += front ? n.getZ(i + k) : n.getY(i + k);
      if (U(i + k) > -1 && U(i + k) < 2 && V(i + k) > -1 && V(i + k) < 2) near = true;
    }
    if (!near || up / 3 < facing) continue;
    for (let k = 0; k < 3; k++) {
      const j = i + k;
      pos.push(p.getX(j) + n.getX(j) * lift, p.getY(j) + n.getY(j) * lift, p.getZ(j) + n.getZ(j) * lift);
      nor.push(n.getX(j), n.getY(j), n.getZ(j));
      uv.push(U(j), V(j));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  mesh.updateMatrix();
  geo.applyMatrix4(mesh.matrix);
  const m = new THREE.Mesh(geo, std({ map, transparent: true, depthWrite: false, roughness, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  mesh.parent.add(m);
  return m;
}

/**
 * A longcase clock, old (user, 2026-10-16; made again 2026-10-28: "less fake — realistic, old, lived-in"): an English
 * country clock of about 1810, its oak gone near black. Bracket feet under the plinth, the base and the plinth
 * scuffed along the bottom by two hundred years of shoes; a long trunk with a solid door and a round glass in it (a
 * lenticle) where the pendulum's bob goes by, the wax rubbed off round its keyhole; a hood with a break arch, a
 * stepped cornice over it and three brass finials, turned columns capped in brass, its glazed door rubbed at the edge
 * that hands open to wind it; the painted dial behind (T.clockDialTex, cut to its shape here), pierced hands of blued
 * steel, a seconds hand. Brass gone brown. 2.1 m; front +z, standing on y = 0. `pane(w, h, shape)`: glass (house.js
 * M.pane; `shape`, a geometry to cut it to). `userData`: pendulum (turns on z), hands { hour, minute, seconds } (turn on z, clockwise negative), and
 * where it ticks from.
 */
export function longcaseClock(pane, env = null) {
  const g = new THREE.Group();
  const wood = std({ map: T.clockCaseTex(), roughness: 0.62 });
  const brass = std({ color: 0x7b5f30, metalness: 0.75, roughness: 0.55, ...(env ? { envMap: env, envMapIntensity: 0.8 } : {}) });
  // the pendulum's bob, in the dark of the trunk: its own reflection, so it still catches what light there is
  const bobBrass = std({ color: 0x9c7a3c, metalness: 0.85, roughness: 0.35, ...(env ? { envMap: env, envMapIntensity: 2.2 } : {}) });
  const blued = std({ color: 0x151b27, metalness: 0.6, roughness: 0.32 });
  const dark = std({ color: 0x120d09, roughness: 0.9 });
  const W = 0.48, D = 0.25, TW = 0.38, TD = 0.2;
  /** Its UVs in metres, each face along its own axis, from where it is in the clock: the grain runs on from piece to piece. */
  const metres = (mesh) => {
    const p = mesh.geometry.attributes.position, n = mesh.geometry.attributes.normal, uv = mesh.geometry.attributes.uv, o = mesh.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + o.x, y = p.getY(i) + o.y, z = p.getZ(i) + o.z, ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      if (ay > ax && ay > az) uv.setXY(i, x, z);
      else if (ax > az) uv.setXY(i, z, y);
      else uv.setXY(i, x, y);
    }
    return mesh;
  };
  const block = (w, h, d, x, y, z, r = 0.004, mat = wood) => { const m = put(g, rounded(w, h, d, r, mat), x, y, z); return mat === wood ? metres(m) : m; };
  /** `shape` (in metres) made `depth` thick, from z = 0 forwards, its edges softened, no bigger for it. */
  const extrude = (shape, depth, mat = wood, bevel = 0.002) => new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1, curveSegments: 24 }).translate(0, 0, bevel), mat);
  // the base: boards round the foot of the plinth, cut away between bracket feet
  const BW = W + 0.04, BD = D + 0.03, FH = 0.085;
  const feetBoard = (len) => {
    const s = new THREE.Shape(), f = 0.072, cut = 0.042;
    s.moveTo(-len / 2, 0); s.lineTo(-len / 2 + f, 0);
    s.quadraticCurveTo(-len / 2 + f + 0.008, cut, -len / 2 + f + 0.045, cut);
    s.lineTo(len / 2 - f - 0.045, cut);
    s.quadraticCurveTo(len / 2 - f - 0.008, cut, len / 2 - f, 0);
    s.lineTo(len / 2, 0); s.lineTo(len / 2, FH); s.lineTo(-len / 2, FH); s.closePath();
    return extrude(s, 0.02);
  };
  const base = put(g, feetBoard(BW), 0, 0, BD / 2 - 0.018);
  for (const s of [-1, 1]) put(g, feetBoard(BD), s * (BW / 2 - 0.018), 0, 0).rotation.y = s * Math.PI / 2;
  block(BW + 0.01, 0.022, BD + 0.01, 0, FH + 0.011, 0, 0.006);
  // the plinth, a raised panel on its front, the moulding up to the trunk
  const plinth = block(W, 0.32, D, 0, FH + 0.022 + 0.16, 0);
  block(W - 0.1, 0.21, 0.012, 0, FH + 0.022 + 0.16, D / 2 + 0.004, 0.004);
  block(W + 0.02, 0.028, D + 0.02, 0, 0.441, 0, 0.007);
  block(TW + 0.04, 0.02, TD + 0.03, 0, 0.465, 0, 0.006);
  // the trunk: sides, back, the frame round its door; dark inside
  const t0 = 0.475, t1 = 1.4, tm = (t0 + t1) / 2;
  for (const x of [-1, 1]) block(0.018, t1 - t0, TD, x * (TW / 2 - 0.009), tm, 0);
  block(TW, t1 - t0, 0.018, 0, tm, -TD / 2 + 0.009);
  block(TW - 0.04, t1 - t0 - 0.02, 0.01, 0, tm, -TD / 2 + 0.03, 0.003, dark);
  for (const x of [-1, 1]) block(0.045, t1 - t0, 0.02, x * (TW / 2 - 0.0225), tm, TD / 2 - 0.01);
  block(TW - 0.09, 0.05, 0.02, 0, t1 - 0.025, TD / 2 - 0.01);
  block(TW - 0.09, 0.06, 0.02, 0, t0 + 0.03, TD / 2 - 0.01);
  // its door, laid on the frame, a shallow arch over it, hanging a hair out of true; the lenticle where the bob goes by
  const doorY = t0 + 0.053, bobY = 0.75, lens = 0.048;
  const doorShape = new THREE.Shape();
  doorShape.moveTo(-0.15, 0); doorShape.lineTo(0.15, 0); doorShape.lineTo(0.15, 0.775);
  doorShape.quadraticCurveTo(0, 0.83, -0.15, 0.775); doorShape.closePath();
  { const h = new THREE.Path(); h.absarc(0, bobY - doorY, lens, 0, Math.PI * 2, true); doorShape.holes.push(h); }
  const door = put(g, extrude(doorShape, 0.018), 0, doorY, TD / 2 + 0.001);
  door.rotation.z = -0.004;
  const lensGlass = pane(0.11, 0.11);
  lensGlass.position.set(0, bobY, TD / 2 + 0.01);
  g.add(lensGlass);
  put(g, new THREE.Mesh(new THREE.TorusGeometry(lens + 0.002, 0.004, 8, 40), brass), 0, bobY, TD / 2 + 0.02);
  const keyAt = [0.112, 0.43];
  put(g, rounded(0.016, 0.028, 0.002, 0.0008, brass), keyAt[0], doorY + keyAt[1], TD / 2 + 0.02);
  put(g, rounded(0.0035, 0.01, 0.0012, 0.0005, dark), keyAt[0], doorY + keyAt[1] - 0.002, TD / 2 + 0.0212);
  // the pendulum, behind the door: a steel rod, the brass bob
  const pendulum = new THREE.Group();
  pendulum.position.set(0, t1 - 0.03, 0.055);
  g.add(pendulum);
  put(pendulum, new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, t1 - 0.03 - bobY, 8), blued), 0, -(t1 - 0.03 - bobY) / 2, 0);
  put(pendulum, new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 32).rotateX(Math.PI / 2), bobBrass), 0, -(t1 - 0.03 - bobY), 0);
  pendulum.traverse((o) => { o.castShadow = false; });
  // the hood: a break arch over the dial, on the moulding at the top of the trunk
  block(W + 0.02, 0.035, D + 0.02, 0, t1 + 0.0175, 0, 0.006);
  const h0 = t1 + 0.035, SH = 0.38, AC = 0.335, AR = 0.17, a0 = Math.asin((SH - AC) / AR), ax = AR * Math.cos(a0);
  const hoodShape = new THREE.Shape();
  hoodShape.moveTo(-W / 2, 0); hoodShape.lineTo(W / 2, 0); hoodShape.lineTo(W / 2, SH); hoodShape.lineTo(ax, SH);
  hoodShape.absarc(0, AC, AR, a0, Math.PI - a0, false);
  hoodShape.lineTo(-W / 2, SH); hoodShape.closePath();
  put(g, extrude(hoodShape, D, wood, 0.003), 0, h0, -D / 2);
  // its cornice: two bands stepping out over the top, along the shoulders and round the arch
  const band = (y0, r0, t, out) => {
    const r1 = r0 + t, y1 = y0 + t, b0 = Math.asin((y0 - AC) / r0), b1 = Math.asin((y1 - AC) / r1), s = new THREE.Shape();
    s.moveTo(-W / 2 - out, y0); s.lineTo(-W / 2 - out, y1); s.lineTo(-r1 * Math.cos(b1), y1);
    s.absarc(0, AC, r1, Math.PI - b1, b1, true);
    s.lineTo(W / 2 + out, y1); s.lineTo(W / 2 + out, y0); s.lineTo(r0 * Math.cos(b0), y0);
    s.absarc(0, AC, r0, b0, Math.PI - b0, false);
    s.closePath();
    put(g, extrude(s, D + 2 * out), 0, h0, -D / 2 - out);
  };
  band(SH, AR, 0.024, 0.012);
  band(SH + 0.024, AR + 0.024, 0.012, 0.022);
  // finials: brass ball and spire on little plinths, two on the shoulders, one on the arch
  const top = SH + 0.036;
  for (const [x, y] of [[-W / 2 + 0.03, top], [W / 2 - 0.03, top], [0, AC + AR + 0.036]]) {
    block(0.034, 0.03, 0.034, x, h0 + y + 0.015, 0, 0.004);
    put(g, lathe([[0, 0], [0.012, 0], [0.012, 0.006], [0.006, 0.012], [0.015, 0.026], [0.017, 0.034], [0.014, 0.044], [0.005, 0.05], [0.004, 0.064], [0.007, 0.07], [0.0015, 0.09], [0, 0.092]], brass, 16), x, h0 + y + 0.03, 0);
  }
  // its door: the glass over the dial, the opening arched as the dial is
  const hoodDoor = new THREE.Shape();
  hoodDoor.moveTo(-0.175, 0.012); hoodDoor.lineTo(0.175, 0.012); hoodDoor.lineTo(0.175, 0.335); hoodDoor.lineTo(0.125, 0.335);
  hoodDoor.absarc(0, 0.335, 0.125, 0, Math.PI, false);
  hoodDoor.lineTo(-0.175, 0.335); hoodDoor.closePath();
  {
    const h = new THREE.Path();
    h.moveTo(-0.138, 0.045); h.lineTo(-0.138, 0.335); h.lineTo(-0.088, 0.335);
    h.absarc(0, 0.335, 0.088, Math.PI, 0, true);
    h.lineTo(0.138, 0.335); h.lineTo(0.138, 0.045); h.closePath();
    hoodDoor.holes.push(h);
  }
  const hoodDoorMesh = put(g, extrude(hoodDoor, 0.02), 0, h0, D / 2 + 0.001);
  {
    // (the glass cut to the opening, 6 mm into the frame all round: a whole rectangle stood out past the door's arch)
    const s = new THREE.Shape();
    s.moveTo(-0.144, 0.039); s.lineTo(0.144, 0.039); s.lineTo(0.144, 0.335); s.lineTo(0.094, 0.335);
    s.absarc(0, 0.335, 0.094, 0, Math.PI, false);
    s.lineTo(-0.144, 0.335); s.closePath();
    const geo = new THREE.ShapeGeometry(s, 24), gp = geo.attributes.position, guv = geo.attributes.uv, gy = (0.039 + 0.429) / 2;
    for (let i = 0; i < gp.count; i++) { guv.setXY(i, gp.getX(i) / 0.288 + 0.5, (gp.getY(i) - 0.039) / 0.39); gp.setY(i, gp.getY(i) - gy); }
    const glass = pane(0.288, 0.39, geo);
    glass.position.set(0, h0 + gy, D / 2 + 0.013);
    g.add(glass);
  }
  // turned columns either side of it, capped and based in brass
  for (const x of [-1, 1]) {
    const cx = x * (W / 2 - 0.03), cz = D / 2 + 0.006;
    put(g, lathe([[0, 0], [0.012, 0], [0.012, 0.02], [0.0135, 0.04], [0.0115, 0.06], [0.0125, 0.29], [0.0145, 0.305], [0.011, 0.318], [0, 0.318]], wood, 20), cx, h0 + 0.03, cz);
    for (const y of [0.018, 0.348]) put(g, lathe([[0, 0], [0.016, 0], [0.017, 0.004], [0.0155, 0.012], [0, 0.012]], brass, 20), cx, h0 + y, cz);
  }
  // the dial, cut to its shape, its picture in metres
  const dShape = new THREE.Shape();
  dShape.moveTo(-T.DIAL.w / 2, 0); dShape.lineTo(T.DIAL.w / 2, 0); dShape.lineTo(T.DIAL.w / 2, T.DIAL.sq); dShape.lineTo(T.DIAL.arch, T.DIAL.sq);
  dShape.absarc(0, T.DIAL.sq, T.DIAL.arch, 0, Math.PI, false);
  dShape.lineTo(-T.DIAL.w / 2, T.DIAL.sq); dShape.closePath();
  const dGeo = new THREE.ShapeGeometry(dShape, 32), duv = dGeo.attributes.uv, dp = dGeo.attributes.position;
  for (let i = 0; i < dp.count; i++) duv.setXY(i, dp.getX(i) / T.DIAL.w + 0.5, dp.getY(i) / (T.DIAL.sq + T.DIAL.arch));
  const dialY = h0 + 0.035, dialZ = D / 2 + 0.002;
  put(g, new THREE.Mesh(dGeo, std({ map: T.clockDialTex(), roughness: 0.7 })), 0, dialY, dialZ).castShadow = false;
  // the winding holes: brass collets, the square arbors in the dark of them
  for (const [x, y] of T.DIAL.holes) {
    put(g, new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0011, 6, 20), brass), x, dialY + y, dialZ + 0.001);
    put(g, new THREE.Mesh(new THREE.CircleGeometry(0.0034, 16), dark), x, dialY + y, dialZ + 0.0004);
    put(g, rounded(0.0026, 0.0026, 0.004, 0.0004, blued), x, dialY + y, dialZ + 0.0012).rotation.z = 0.3;
  }
  // the hands: blued steel, pierced, drawn pointing up from the arbor (the right half, mirrored)
  const steelHand = (half, holes = []) => {
    const s = new THREE.Shape();
    half.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    for (let i = half.length - 1; i >= 0; i--) if (half[i][0] > 0) s.lineTo(-half[i][0], half[i][1]);
    s.closePath();
    for (const [x, y, rad] of holes) { const h = new THREE.Path(); h.absarc(x, y, rad, 0, Math.PI * 2, true); s.holes.push(h); }
    return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.0011, bevelEnabled: false, curveSegments: 10 }), blued);
  };
  const handAt = ([x, y], z, mesh, nut) => {
    const h = new THREE.Group();
    h.position.set(x, dialY + y, z);
    put(h, mesh);
    put(h, new THREE.Mesh(new THREE.CylinderGeometry(nut, nut, 0.0015, 12).rotateX(Math.PI / 2), brass), 0, 0, 0.002);
    g.add(h);
    return h;
  };
  const hour = handAt([0, T.DIAL.mid], dialZ + 0.003, steelHand([
    [0, -0.02], [0.0035, -0.0195], [0.0045, -0.017], [0.0035, -0.0145], [0.0012, -0.0125], [0.0013, -0.007],
    [0.0045, -0.0045], [0.0058, 0], [0.0045, 0.0045], [0.0014, 0.008], [0.0011, 0.04],
    [0.0035, 0.043], [0.0072, 0.049], [0.0084, 0.055], [0.0072, 0.0605], [0.0042, 0.0635], [0.0016, 0.0655], [0.0009, 0.068], [0, 0.077],
  ], [[0, 0.0545, 0.0027], [0.0045, 0.05, 0.0012], [-0.0045, 0.05, 0.0012]]), 0.0032);
  const minute = handAt([0, T.DIAL.mid], dialZ + 0.0052, steelHand([
    [0, -0.026], [0.003, -0.0255], [0.0038, -0.023], [0.003, -0.0205], [0.0009, -0.019], [0.001, -0.006],
    [0.0042, -0.0035], [0.0048, 0], [0.0038, 0.0035], [0.001, 0.007], [0.0011, 0.03],
    [0.0032, 0.033], [0.0036, 0.037], [0.0028, 0.041], [0.0009, 0.043], [0.0008, 0.09], [0.0005, 0.106], [0, 0.114],
  ], [[0, 0.037, 0.0017]]), 0.0026);
  const seconds = handAt(T.DIAL.seconds, dialZ + 0.003, steelHand([[0, -0.007], [0.0018, -0.0065], [0.002, -0.005], [0.0006, -0.0035], [0.0014, 0], [0.0006, 0.002], [0.0004, 0.018], [0, 0.021]]), 0.0016);
  // wear where use goes: shoes along the bottom, the hands that open the doors
  projectDecal(base, { at: [0.04, 0.05], size: [0.46, 0.11], map: T.woodRubTex('kicks', 8621), front: true, facing: 0.5 });
  projectDecal(plinth, { at: [-0.03, -0.12], size: [0.4, 0.1], map: T.woodRubTex('kicks', 8624), front: true, facing: 0.5 });
  projectDecal(door, { at: keyAt, size: [0.07, 0.12], map: T.woodRubTex('hands', 8622), front: true, facing: 0.5 });
  projectDecal(hoodDoorMesh, { at: [0.158, 0.19], size: [0.05, 0.17], map: T.woodRubTex('hands', 8623), front: true, facing: 0.5 });
  g.userData.pendulum = pendulum;
  g.userData.hands = { hour, minute, seconds };
  g.userData.ticksAt = new THREE.Vector3(0, 1.0, 0);
  return g;
}

/**
 * A heavy glass ashtray of the kind every house had, amber, three rests in its rim, ash in the bottom,
 * and a cigarette left in one rest half smoked — still alight, a thread of smoke going up from it (the
 * house is empty). About 13 cm across, standing on y = 0. `env`: what its glass reflects.
 * `userData`: ember (its material, to flicker), smoke (the meshes, to drift).
 */
export function ashtray(env) {
  const g = new THREE.Group();
  const R = 0.065, H = 0.032;
  const glass = std({ color: 0x86898a, roughness: 0.38, metalness: 0, envMap: env, envMapIntensity: 0.6 }); // grey (user, 2026-10-17)
  // the body: thick, a shallow bowl in its top, three rests cut down into its rim
  const geo = new THREE.LatheGeometry([[0, 0], [R - 0.006, 0], [R, 0.004], [R, H - 0.004], [R - 0.004, H], [R - 0.012, H], [R - 0.016, H - 0.008], [R - 0.024, 0.013], [0, 0.012]].map(([a, b]) => new THREE.Vector2(a, b)), 48);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i), r = Math.hypot(x, z), a = Math.atan2(z, x);
    if (y < H - 0.009 || r < R - 0.018) continue;
    for (const c of [0.3, 0.3 + (Math.PI * 2) / 3, 0.3 + (Math.PI * 4) / 3]) {
      const d = Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c)));
      if (d < 0.13) p.setY(i, y - 0.008 * Math.cos((d / 0.13) * (Math.PI / 2)));
    }
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, glass);
  body.receiveShadow = true;
  g.add(body);
  const ash = new THREE.Mesh(new THREE.CircleGeometry(R - 0.02, 32).rotateX(-Math.PI / 2), std({ map: T.ashTex(), transparent: true, roughness: 1, depthWrite: false }));
  ash.position.y = 0.0135;
  ash.receiveShadow = true;
  ash.renderOrder = 1; // over the glass under it
  g.add(ash);
  // the cigarette, in the first rest: its filter out over the rim, its burnt end over the bowl
  const cig = new THREE.Group();
  const rest = 0.3;
  cig.position.set(Math.cos(rest) * (R - 0.004), H - 0.004, Math.sin(rest) * (R - 0.004));
  cig.rotation.y = -rest + Math.PI; // pointing in, towards the middle
  cig.rotation.z = -0.12; // its end dipping into the bowl
  const paper = std({ color: 0xe8e4da, roughness: 0.8 }), filter = std({ color: 0xc9894a, roughness: 0.7 });
  const along = (len, r, mat, x0) => put(cig, new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14).rotateZ(Math.PI / 2), mat), x0 + len / 2, 0, 0);
  along(0.025, 0.004, filter, -0.022); // filter, outside the rim
  along(0.03, 0.004, paper, 0.003); // what is left of it
  const ember = std({ color: 0x3a2a22, roughness: 0.9, emissive: 0xff5a1a, emissiveIntensity: 0.8 });
  along(0.002, 0.0041, ember, 0.033); // the burning ring
  const ashEnd = put(cig, new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0036, 0.006, 10).rotateZ(Math.PI / 2), std({ color: 0x8a8782, roughness: 1 })), 0.038, 0, 0);
  ashEnd.rotation.y = 0.05;
  g.add(cig);
  // its smoke: a thread rising, two crossed sheets so it reads from anywhere
  const smoke = [];
  const smokeMat = new THREE.MeshBasicMaterial({ map: T.smokeTex(), transparent: true, depthWrite: false, opacity: 0.28, side: THREE.DoubleSide });
  const tip = new THREE.Vector3(0.036, 0, 0).applyEuler(cig.rotation).add(cig.position);
  for (const turn of [0, Math.PI / 2]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.34).translate(0, 0.17, 0), smokeMat);
    m.position.copy(tip);
    m.rotation.y = turn;
    m.castShadow = m.receiveShadow = false;
    m.renderOrder = 3;
    g.add(m);
    smoke.push(m);
  }
  g.userData.ember = ember;
  g.userData.smoke = smoke;
  return g;
}
