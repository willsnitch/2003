// The back yard, and what can be seen from it: the lawn — long in places, worn to dirt in others,
// a path trodden from the back door — the old fence, the slide and its sandbox, the swing, the
// shed, the flamingos, the hose by the tap, the cellar doors; and over the fence the neighbours'
// houses, the trees, the telegraph poles and their wires, the sky (as the time of day has it); and out
// the front, past the living room's window, the street and the houses across it.
import * as THREE from 'three';
import * as T from './textures.js';
import { ROOM } from './room.js';
import { cyl, deg, mulberry32, fbm, canvasTex } from './util.js';
import { metric, slab, flat, pierced } from './build.js';
import { DAY, AFTERNOON } from './daytime.js';
import { gardenHose } from './hose.js';
import { grove, GROVE } from './grove.js';
import { poolGarden, END, POOL, DROWNED } from './pool.js';
import { takeable } from './props.js';
import { projectDecal } from './fixtures.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const t = ROOM.T;
const std = (o) => new THREE.MeshStandardMaterial(o);
let Y, YF, BACK, DZ; // the yard's extent to the wood's end (Y: its lawn, grass, leaves and trees as they were) and to its far fence past the pool (YF); the back door's; how much further off than it was the far fence is
// where this frame is in the house's (plan.offset): the yard lower than the house and further out, past its porch
// (user, 2026-10-20) — everything here is built where it always was, in this frame; what is fixed to the house itself
// (its roof, its walls) is put back where the house is, and what the player is given is moved out to the world
let OY = 0, OZ = 0, LIFT = 0, PORCH = 0, PX1 = 0, WALL = 0; // (PX1: where the porch ends, east; WALL: the house's wall, in this frame)
// the houses round about, as volumes (house(): walls and roof), and ours (its roofs): trees grow round them, not through
// them (user, 2026-10-17: "past the fence the trees go through the houses")
const HOUSES = [];
const OURS = [{ x0: -5.7, x1: 4.35, z0: -0.6, z1: 9.6, top: 5.5 }, { x0: 2.9, x1: 11.6, z0: 3.8, z1: 20.8, top: 2.9 }]; // (the corridor's end and the bathroom, house.js PLAN)
function inHouse(x, y, z, m) {
  if (OURS.some((b) => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m && y < b.top + m)) return true;
  return HOUSES.some((h) => {
    if (x < h.x0 - m || x > h.x1 + m || z < h.z0 - m || z > h.z1 + m) return false;
    if (y < h.eaves + m) return true;
    const half = (h.alongX ? h.z1 - h.z0 : h.x1 - h.x0) / 2, off = h.alongX ? Math.abs(z - (h.z0 + h.z1) / 2) : Math.abs(x - (h.x0 + h.x1) / 2);
    return y < h.eaves + h.pitch * Math.max(0, 1 - off / half) + m * 1.4 + (h.chimney ? 0.6 : 0);
  });
}
/**
 * The storm cellar's way in, in the world's frame (basement.js builds it; the lawn here has a hole where its steps go
 * down): its opening x0…x1, from the bedroom's north wall (z1: the wall's outer face) out to z0; `sill`: the concrete
 * across its foot, `side`: its cheeks' thickness, `curb`: how high they stand over the lawn at the foot, `rise`: at the
 * wall (user, 2026-10-21: rebuilt, longer, with steps down under it).
 */
export const CELLAR = { x0: 1.2, x1: 2.5, z0: -t - 1.5, z1: -t, sill: 0.12, side: 0.12, curb: 0.18, rise: 0.95 };

/** Low over the yard (inside its fence, below `y`): where the trees round about must not hang down into. */
const overYard = (x, z, m) => x > YF.x0 - m && x < (z < YF.step + m ? YF.x2 : YF.x1) + m && z > YF.z0 - m && z < YF.z1 + m;

/**
 * A two-sided cut-out lit as the ground or a crown is, from its own normal on both its faces: three.js
 * turns the normal round on a back face, and the grass's normal (up) went down there — half of every tuft
 * black, the dark, contrasty look (user, 2026-10-17).
 */
function bothFacesLit(mat, key) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

/**
 * How far into the wood the ground is at x, z: 0 lawn … 1 nothing but last year's leaves (user, 2026-10-17:
 * the lawn fading into brown towards the trees, leaves lying there). Ragged, never a line.
 */
function woodland(x, z) {
  const n = fbm(x * 0.7 + 3.3, z * 0.7 + 7.7, 0.5, 3) - 0.5, fine = fbm(x * 2.6 + 1.1, z * 2.6 + 2.2, 0.5, 2) - 0.5;
  let w = THREE.MathUtils.smoothstep(-(z + n * 1.8 + fine * 0.5), 6.4, 9.6);
  for (const { at: [tx, tz] } of Object.values(GROVE)) w = Math.max(w, 1 - THREE.MathUtils.smoothstep(Math.hypot(x - tx, z - tz) + fine * 0.8, 1.3, 3.2));
  return Math.min(1, w);
}
/** Under the spruce, its needles. */
function needleFall(x, z) {
  const [sx, sz] = GROVE.spruce.at;
  return 1 - THREE.MathUtils.smoothstep(Math.hypot(x - sx, z - sz) + (fbm(x * 3 + 5, z * 3 + 1, 0.5, 2) - 0.5) * 0.8, 0.8, 2.4);
}

/** How bare the ground is at x, z: 0 thick grass … 1 no grass at all. */
function bareness(x, z) {
  // bald patches where nothing much grows, big and small, their edges ragged (user, 2026-10-17: more random)
  const rag = fbm(x * 5.3 + 2.1, z * 5.3 + 8.4, 0.5, 2) - 0.5;
  let b = Math.max(0, fbm(x * 0.42 + 11.3, z * 0.42 + 3.7, 0.5, 4) - 0.55 + rag * 0.12) * 4;
  b = Math.max(b, Math.max(0, fbm(x * 1.7 + 5.2, z * 1.7 + 9.1, 0.5, 3) - 0.64 + rag * 0.1) * 5); // worn spots here and there
  b = Math.max(b, Math.max(0, fbm(x * 4.1 + 1.3, z * 4.1 + 4.4, 0.5, 2) - 0.7) * 3.5); // and little ones
  // the path trodden from the back door out to the swing, with a fork off to the sandbox
  const paths = [[BACK.mid, -0.6, -1.7, -2.4, 0.42], [-1.7, -2.4, 0.0, -4.3, 0.36], [-1.95, -1.9, SANDBOX.x1 - 0.05, -2.75, 0.3]];
  for (const [ax, az, bx, bz, w] of paths) {
    const dx = bx - ax, dz = bz - az, k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - ax - dx * k, z - az - dz * k) * (1 + rag * 0.9); // never a clean edge
    b = Math.max(b, 0.85 * (1 - THREE.MathUtils.smoothstep(d, w * 0.4, w)));
  }
  // under the swing, where feet drag; round the sandbox where the sand gets kicked out; at the foot of the
  // slide's ladder and under its tower
  b = Math.max(b, 1 - THREE.MathUtils.smoothstep(Math.hypot((x - 0.05) * 1.2, z + 4.7), 0.25, 0.65));
  b = Math.max(b, 0.7 * (1 - THREE.MathUtils.smoothstep(outside(x, z, SANDBOX) + rag * 0.25, -0.1, 0.35)));
  b = Math.max(b, 0.75 * (1 - THREE.MathUtils.smoothstep(outside(x, z, { ...TOWER, z0: TOWER.z0 - TOWER.run - 0.2 }) + rag * 0.3, -0.05, 0.45)));
  // along the house the eaves keep the rain off: dry and thin
  b = Math.max(b, 0.55 * (1 - THREE.MathUtils.smoothstep(-t - z, 0.0, 0.5)));
  // under the grove's trees: bare round the trunks, thin in their shade, a carpet of needles under the spruce
  for (const [kind, { at: [tx, tz], reach }] of Object.entries(GROVE)) {
    const d0 = Math.hypot(x - tx, z - tz);
    if (d0 > reach * 1.4 + 0.3) continue;
    const d = d0 * (1 + 0.25 * fbm(x * 1.7 + tx, z * 1.7, 0.5, 2));
    b = Math.max(b, (kind === 'spruce' ? 0.98 : 0.9) * (1 - THREE.MathUtils.smoothstep(d, kind === 'spruce' ? reach * 0.7 : 0.35, kind === 'spruce' ? reach + 0.2 : 1.1)));
    b = Math.max(b, 0.45 * (1 - THREE.MathUtils.smoothstep(d, reach * 0.5, reach * 1.1)));
  }
  return Math.min(1, b);
}

export function backYard(g, M, mat, ctx, scene, plan) {
  YF = plan.yard;
  Y = { ...YF, z0: END }; // (user, 2026-10-29: the garden longer again, the pool past the wood — what was built to the old fence stays as it was; 2026-11-01: wider there, to x2)
  ({ y: OY, z: OZ } = plan.offset ?? { y: 0, z: 0 });
  LIFT = -OY; PORCH = -OZ; PX1 = plan.porchX1 ?? Y.x1; WALL = -t + PORCH;
  for (const o of OURS) { o.z0 -= OZ; o.z1 -= OZ; o.top -= OY; } // (the house, where it is in this frame)
  OURS.push({ x0: Y.x0 - 0.1, x1: PX1 + 0.1, z0: -t - 0.1, z1: WALL, top: LIFT + 1.1 }); // and its porch
  DZ = YF.z0 + 7.2 - 3; // (3: room behind the far fence now for the trees along it, 2026-11-01)
  // (user, 2026-10-17: the garden longer, a grove at its end — and what was over the fence, as far again; 2026-10-29, and again)
  BACK = { ...plan.backDoor, mid: (plan.backDoor.x0 + plan.backDoor.x1) / 2 };
  const r = mulberry32(301);

  // ---- the ground: one picture of the whole yard, then long grass standing up out of it where it grows
  const ground = std({ map: T.yardGroundTex(Y, bareness, woodland, needleFall), roughness: 1 });
  // (with a hole where the sandbox is: its sand goes on down into a pit, to be dug into: user, 2026-10-18)
  const lawnShape = new THREE.Shape([new THREE.Vector2(Y.x0, -Y.z0), new THREE.Vector2(Y.x1, -Y.z0), new THREE.Vector2(Y.x1, -Y.z1), new THREE.Vector2(Y.x0, -Y.z1)]);
  const SBX = SANDBOX, pit = new THREE.Path([new THREE.Vector2(SBX.x0 + SBX.board, -(SBX.z0 + SBX.board)), new THREE.Vector2(SBX.x0 + SBX.board, -(SBX.z1 - SBX.board)), new THREE.Vector2(SBX.x1 - SBX.board, -(SBX.z1 - SBX.board)), new THREE.Vector2(SBX.x1 - SBX.board, -(SBX.z0 + SBX.board))]);
  lawnShape.holes.push(pit);
  // (and where the cellar's steps go down, inside its concrete: basement.js — user, 2026-10-21)
  const C = CELLAR, cz0 = C.z0 + C.sill / 2 - OZ, cz1 = C.z1 - OZ;
  lawnShape.holes.push(new THREE.Path([new THREE.Vector2(C.x0, -cz0), new THREE.Vector2(C.x0, -cz1), new THREE.Vector2(C.x1, -cz1), new THREE.Vector2(C.x1, -cz0)]));
  const lawn = new THREE.Mesh(new THREE.ShapeGeometry(lawnShape).rotateX(-Math.PI / 2), ground);
  lawn.receiveShadow = true;
  const uv = lawn.geometry.attributes.uv, pos = lawn.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - Y.x0) / (Y.x1 - Y.x0), 1 - (pos.getZ(i) - Y.z0) / (Y.z1 - Y.z0));
  g.add(lawn);
  // and beyond the fence, the neighbours' grass, which is all that shows through the gaps
  const out = metric(std({ map: T.lawnTex(), roughness: 1, color: 0x8a8a7a }), T.PERIOD.lawn);
  // (right up to the lawn's edge: a 6 cm gap was left under the fence, and the sky showed through it between the
  // boards' feet, a strip of blue-green — user, 2026-10-21)
  for (const [x0, x1, z0, z1] of [[-70, 70, -70, YF.z0], [-70, Y.x0, YF.z0, -t], [-70, Y.x0, -t, 30], [YF.x2, 70, YF.z0, END], [Y.x1, 70, END, -t + PORCH]]) g.add(flat(x0, x1, z0, z1, -0.005, out)); // (the last on along the porch's end to the house)
  longGrass(g, r, ground.map.image);
  const heapAt = leafHeaps(g, mulberry32(313), ground);

  // ---- the sky, and the far trees along the bottom of it; lit by nothing, brighter seen from indoors
  const skyMat = new THREE.MeshBasicMaterial({ map: T.skyTex(DAY.dome), side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(36, 32, 16), skyMat);
  dome.position.set(-2.5, 0, -8); // round the yard and the street out the front alike (bigger, and further back, since the garden reaches past the pool)
  dome.renderOrder = -2;
  scene.add(dome);
  const far = T.treelineTex();
  far.wrapS = THREE.RepeatWrapping;
  far.repeat.set(3, 1);
  const farMat = new THREE.MeshBasicMaterial({ map: far, side: THREE.BackSide, transparent: true, alphaTest: 0.5, fog: false, color: 0x6f7062 });
  const treeline = new THREE.Mesh(new THREE.CylinderGeometry(33, 33, 9, 64, 1, true), farMat);
  treeline.position.set(-2.5, 4.2, -8);
  // (drawn with the clouds, before anything see-through: it is sorted by where it stands, its middle by the house, so
  // from indoors it came after the windows' dirt and the far trees showed through the glass as if it were clean —
  // user, 2026-10-23)
  treeline.renderOrder = -1;
  scene.add(treeline);
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const a = deg(-60 + i * 38 + r() * 20), d = 21 + r() * 4;
    const c = new THREE.Mesh(new THREE.PlaneGeometry(14 + r() * 8, 5 + r() * 2), new THREE.MeshBasicMaterial({ map: T.cloudTex(261 + i, DAY.cloud), transparent: true, depthWrite: false, fog: false }));
    c.position.set(-0.7 + Math.cos(a) * d, 11 + r() * 5, -3.6 - Math.sin(a) * d);
    c.lookAt(-0.7, 2, -3.6);
    c.renderOrder = -1;
    scene.add(c);
    clouds.push(c.material);
  }
  // the glow round the sun
  const glowMat = new THREE.MeshBasicMaterial({ map: sunGlowTex(DAY.glowDisc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), glowMat);
  const [sx, sy, sz] = DAY.sun.dir;
  glow.position.set(-0.7 - sx * 25, Math.max(5, -sy * 25), -3.6 - sz * 25);
  glow.lookAt(-0.7, 6, -3.6);
  glow.renderOrder = -1;
  scene.add(glow);

  // ---- over the fence: the houses round about, their trees, the poles along the back alley
  neighbours(g, mat, r);
  const wire = poles(g, M), lines = [...wire, ...wire.span];
  trees(g, r, undefined, lines);
  // ---- out the front: the street
  street(g, M, mat, { z0: plan.frontDoor.z0 - OZ, z1: plan.frontDoor.z1 - OZ });

  // ---- the fence: old boards, cream once, standing round three sides
  fence(g, mat, ctx, r);

  // (the cellar's doors against the bedroom's wall under the window, and what is under them: basement.js)
  // the step outside the back door, the tap and its hose, the lamp over the door
  // the doormat outside the back door: coir, brown, no words on it (user, 2026-10-18: it was a grey slab), a
  // little off the middle and askew, as it was last kicked
  // ---- the porch along the back of the house, the steps down from it (porch(); the doormat is up on it now)
  porch(g, M, mat, ctx);
  const MW = 0.74, MD = 0.44, matX = (BACK.x0 + BACK.x1) / 2 + 0.06, matZ = -t + PORCH - 0.3;
  const coir = std({ map: T.coirMatTex(MW, MD), bumpMap: T.coirMatTex(MW, MD, true), bumpScale: 2.2, roughness: 1 });
  const edges = std({ color: 0x5e4c3a, roughness: 1 }); // (faded, dusty)
  // old (user, 2026-10-23): trodden thinner where the feet go, a corner curled up off the boards, never lying flat
  const matGeo = new THREE.BoxGeometry(MW, 0.022, MD, 36, 1, 22), MP = matGeo.attributes.position;
  for (let i = 0; i < MP.count; i++) {
    const x = MP.getX(i), y = MP.getY(i), z = MP.getZ(i), corner = Math.hypot(x - MW / 2, z + MD / 2);
    let dy = 0.0012 * Math.sin(x * 17 + 1) * Math.sin(z * 23 + 2) + (corner < 0.16 ? 0.01 * (1 - corner / 0.16) ** 2 : 0);
    if (y > 0) dy -= 0.006 * T.coirWear(x / MW + 0.5, z / MD + 0.5);
    MP.setY(i, y + dy);
  }
  matGeo.computeVertexNormals();
  const doormat = new THREE.Mesh(matGeo, [edges, edges, coir, edges, edges, edges]);
  doormat.position.set(matX, LIFT + 0.011, matZ);
  doormat.rotation.y = deg(-3.5);
  doormat.castShadow = doormat.receiveShadow = true;
  g.add(doormat);
  ctx.colliders.push({ type: 'box', x0: matX - MW / 2 - 0.01, x1: matX + MW / 2 + 0.01, z0: matZ - MD / 2 - 0.02, z1: matZ + MD / 2 + 0.02, top: LIFT + 0.022, stand: true, surface: 'carpet', over: true });
  // the tap: a brass bib out of the house's wall on its flange, the valve on it, its spout turned down to take the
  // hose's coupling, a small red wheel on top (hose.js screws the hose onto the spout's end)
  const tapAt = new THREE.Vector3(BACK.x0 - 1.12, LIFT + 0.45, WALL - 0.035); // (on the house's wall on the porch, right of the back door seen from the yard: user, 2026-10-20)
  const wheel = std({ color: 0x7c2d24, roughness: 0.55 });
  g.add(cyl(0.03, 0.03, 0.008, M.brass, tapAt.x, tapAt.y, WALL - 0.004, 18).rotateX(Math.PI / 2)); // the flange
  g.add(cyl(0.014, 0.014, 0.09, M.brass, tapAt.x, tapAt.y, WALL - 0.045, 12).rotateX(Math.PI / 2)); // out of the wall
  g.add(cyl(0.021, 0.021, 0.04, M.brass, tapAt.x, tapAt.y, WALL - 0.09, 14).rotateX(Math.PI / 2)); // the valve
  g.add(cyl(0.014, 0.014, 0.04, M.brass, tapAt.x, tapAt.y - 0.02, WALL - 0.105, 12)); // the spout, down
  g.add(cyl(0.0165, 0.0165, 0.012, M.brass, tapAt.x, tapAt.y - 0.042, WALL - 0.105, 12)); // its threaded end
  g.add(cyl(0.005, 0.005, 0.035, M.brass, tapAt.x, tapAt.y + 0.035, WALL - 0.09, 8)); // the stem
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0045, 6, 18).rotateX(Math.PI / 2), wheel);
  rim.position.set(tapAt.x, tapAt.y + 0.054, WALL - 0.09);
  rim.rotation.y = 0.4;
  rim.receiveShadow = rim.castShadow = true;
  g.add(rim);
  for (const a of [0.4, 0.4 + Math.PI / 2]) { const spoke = slab(-0.02, 0.02, -0.003, 0.003, -0.003, 0.003, wheel); spoke.position.set(tapAt.x, tapAt.y + 0.054, WALL - 0.09); spoke.rotation.y = a; g.add(spoke); }
  // the hose: yellow, coiled on its hook by the tap and screwed onto it — take it to water (hose.js;
  // user, 2026-10-17: in place of the sprinkler)
  // (what it lies on and goes round, besides the yard's colliders: worked out below, once all is built)
  let groundAt = () => 0;
  const hoseOnly = [];
  let hoseMoved = () => {};
  const hose = gardenHose(g, ctx, { tapAt, wallZ: WALL, yard: Y, ground: (x, z) => groundAt(x, z), extra: () => hoseOnly, moved: () => hoseMoved(), offset: { y: OY, z: OZ }, floorY: LIFT }); // (it hangs over the porch's boards)
  const lantern = new THREE.Group();
  lantern.position.set(BACK.x0 - 0.3, 2.0 - OY, -t - 0.03 - OZ); // (on the house's wall, by its door)
  lantern.add(slab(-0.06, 0.06, -0.06, 0.12, -0.12, 0, M.blackPlastic));
  lantern.add(slab(-0.05, 0.05, -0.04, 0.1, -0.11, -0.01, M.glass));
  g.add(lantern);

  // ---- the slide, with the sandbox at its foot
  const play = slideAndSandbox(g, M, mat, ctx, hoseOnly);
  // ---- the swing: two seats' worth of frame, one seat
  const swing = swingSet(g, M, mat, ctx, hoseOnly);
  // ---- the shed, locked
  shed(g, M, mat, ctx);
  // ---- pink plastic flamingos stuck in the lawn, many summers old and faded (user, 2026-10-17): one by the
  // slide; one in the corner between the house and the cellar doors (30 cm further from them since 2026-10-21: the door
  // swung open went through it), a little crooked, looking out at the
  // yard; the one gone right over to one side right behind the willow, turned three-quarters to the right as
  // you look at it from the house; and one behind the shed, over by the fence, looking to the left and a
  // little away (user, 2026-10-18): [x, z, facing (its head towards cos, −sin of it), roll, pitch, seed]
  const FLAMINGOS = [[GROVE.willow.at[0], GROVE.willow.at[1] - 1.1, -45, 24, -6, 201], [-2.8, -5.8, 158, -7, 4, 208], [3.05, WALL - 0.27, 104, 9, -5, 215], [3.42, -7.4, 160, 5, 3, 222]];
  // ---- past them, the grove (grove.js): none of the willow's shoots over the slide, the swing, the shed; over
  // the flamingos, none lower than their heads
  const under = [
    { x0: TOWER.x0 - 0.1, x1: TOWER.x1 + 1.0, z0: TOWER.z0 - TOWER.run - 0.15, z1: SANDBOX.z1, top: TOWER.deck + 0.65, clear: true }, // the slide and the sandbox
    { x0: 1.85, x1: 3.65, z0: -6.9, z1: -5.5, top: 2.4, clear: true }, // the shed
    { x0: swing.box.x0, x1: swing.box.x1, z0: swing.box.z0, z1: swing.box.z1, top: 2.1, clear: true, tall: true }, // the swing (tall: nothing of the oak over it at all)
    ...FLAMINGOS.map(([x, z]) => ({ x0: x - 0.35, x1: x + 0.35, z0: z - 0.35, z1: z + 0.35, top: 1.05 })),
  ];
  const wood = grove(g, ctx, { yard: Y, wire, under });
  // ---- past the wood: the old paving, the iron table, the pool, the angel, the corner trees (pool.js)
  const past = poolGarden(g, M, ctx, { yard: YF, wire: lines, lit: bothFacesLit, merge: mergeAll });
  drownedFlamingo(g, M, DROWNED.x, POOL.water, DROWNED.z);
  FLAMINGOS.forEach(([x, z, turn, roll, pitch, seed]) => {
    // in your way, the hose's and the water's (user, 2026-10-18: "the water goes through the flamingos"): its body,
    // as it leans, from its tail to its breast, and its two wire legs down into the lawn
    const f = flamingo(g, M, x, z, deg(turn), deg(roll), deg(pitch), seed);
    f.updateMatrixWorld(true);
    const at = (a, b) => new THREE.Vector3(a, b, 0).applyMatrix4(f.matrix), tail = at(-0.19, 0.56), breast = at(0.2, 0.64), head = at(0.26, 0.92), foot = at(0, 0.02);
    ctx.colliders.push({ type: 'seg', ax: tail.x, az: tail.z, bx: breast.x, bz: breast.z, r: 0.08, base: Math.min(tail.y, breast.y) - 0.1, top: head.y + 0.05 });
    ctx.colliders.push({ type: 'seg', ax: foot.x, az: foot.z, bx: foot.x + 0.001, bz: foot.z, r: 0.04, top: 0.58 });
  });
  // and one up on the roof (user, 2026-10-18), on the yard's side over the back door, a little to the left of it
  // seen from the yard, its wire legs pushed in between the shingles, a little crooked — leaning to the right,
  // seen from the yard — looking down at the swing. Nobody puts a flamingo on a roof.
  {
    const rx = BACK.mid + 0.3, rz = 0.4 - OZ, eaveZ = -t - 0.32 - 0.03 - OZ, roofY = 2.52 + 0.175 + (rz - eaveZ) * Math.tan(deg(24)) - OY; // (house.js: EAVE, the hip roof's pitch; the roof where the house is)
    const head = Math.atan2(-(swing.seatAt.z - rz), swing.seatAt.x - rx); // (its head towards cos, −sin of it)
    const f = flamingo(g, M, rx, rz, head, deg(-11), deg(6), 229);
    f.position.y = roofY;
  }
  // and one up in the birch (user, 2026-10-18), stood on the limb that leaves its trunk at 3.15 m going west (the
  // one he pointed at), facing the back of the yard and leaning forward, looking down: how it got there nobody knows
  const birdInTree = (() => {
    const limb = wood.birch.limbs.filter((l) => l.level === 1 && l.pts[0].y > 3.0 && l.pts[0].y < 3.3).sort((a, b) => (a.pts[2].x - a.pts[0].x) - (b.pts[2].x - b.pts[0].x))[0]; // (the westward one)
    // where along it: the first spot from 0.55 m out where it stands clear of the trunk and of every twig; across
    // the limb, so its two feet are one up the slope and one down it — each wire leg as long as it needs to be
    // to stand on the bark (`feet`), neither in it nor short of it
    const limbs = wood.birch.limbs, v = new THREE.Vector3();
    const gap = (p) => { // how far p is outside the birch's wood, everywhere
      let best = 9;
      for (const l of limbs) for (let j = 0; j < l.pts.length - 1; j++) {
        const a = l.pts[j], ab = v.subVectors(l.pts[j + 1], a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
        best = Math.min(best, p.distanceTo(a.clone().addScaledVector(ab, t)) - (l.rad[j] + (l.rad[j + 1] - l.rad[j]) * t));
      }
      return best;
    };
    const along = (out) => { // the point `out` metres along it, its radius there, the way it goes
      let s = 0, i = 1;
      for (; i < limb.pts.length - 1 && s + limb.pts[i].distanceTo(limb.pts[i - 1]) < out; i++) s += limb.pts[i].distanceTo(limb.pts[i - 1]);
      const a = limb.pts[i - 1], b = limb.pts[i], k = Math.min(1, (out - s) / a.distanceTo(b));
      return [a, b, a.clone().lerp(b, k), limb.rad[i - 1] + (limb.rad[i] - limb.rad[i - 1]) * k];
    };
    const BODY = [[-0.19, 0.56], [0, 0.6], [0.2, 0.64], [0.26, 0.92], [0.1, 0.8], [0.3, 0.86]].map(([x, y]) => new THREE.Vector3(x, y, 0));
    const f = flamingo(g, M, 0, 0, 0, 0, 0, 236);
    f.rotation.set(deg(1.5), Math.PI / 2, deg(-22), 'YXZ'); // (its head towards −z, the far fence; leaning forward over the limb)
    let at, rr, ends = [-0.06, -0.06];
    for (let out = 0.55; out < 1.3; out += 0.05) {
      const [a, b, p, r0] = along(out), ab = b.clone().sub(a);
      const host = (q) => { const t = q.clone().sub(a).dot(ab) / ab.lengthSq(); return q.distanceTo(a.clone().addScaledVector(ab, t)) - r0; };
      const footAt = (sd) => { // how far down its own leg the bark is, under each foot
        for (let y = 0.15; y > -0.45; y -= 0.0005) if (host(new THREE.Vector3(0, y, sd * 0.036).applyMatrix4(f.matrix)) <= 0) return y + 0.0005;
        return -0.06;
      };
      f.position.set(p.x, p.y + r0 + 0.06, p.z);
      for (let k = 0; k < 3; k++) { // its middle 6 cm over the bark, as on the lawn
        f.updateMatrixWorld(true);
        ends = [footAt(1), footAt(-1)];
        f.position.y += (ends[0] + ends[1]) / 2 + 0.06;
      }
      f.updateMatrixWorld(true);
      ends = [footAt(1), footAt(-1)];
      at = p; rr = r0;
      if (ends.every((e, i) => gap(new THREE.Vector3(0, e, (i ? -1 : 1) * 0.036).applyMatrix4(f.matrix)) > -0.001) && BODY.every((q) => gap(q.clone().applyMatrix4(f.matrix)) > 0.08)) break;
    }
    f.userData.feet(...ends);
    f.userData.ends = ends;
    f.userData.limb = { at, rr }; // (for checking)
    return f;
  })();
  // what the hose lies on: the leaf heaps, the sand (dug or not), the trees' roots where they show; and against
  // the trunks themselves, their flare and buttresses
  const rootSegs = [];
  for (const tree of Object.values(wood)) for (const { pts, rad } of tree.roots ?? []) for (let i = 0; i < pts.length - 1; i++) rootSegs.push([pts[i], pts[i + 1], Math.max(rad[i], rad[i + 1])]);
  const rootTop = (x, z) => {
    let top = 0;
    for (const [a, b, rr] of rootSegs) {
      if (x < Math.min(a.x, b.x) - rr || x > Math.max(a.x, b.x) + rr || z < Math.min(a.z, b.z) - rr || z > Math.max(a.z, b.z) + rr) continue;
      const abx = b.x - a.x, abz = b.z - a.z, k = Math.min(1, Math.max(0, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1)));
      const d = Math.hypot(x - a.x - abx * k, z - a.z - abz * k);
      if (d < rr) top = Math.max(top, a.y + (b.y - a.y) * k + Math.sqrt(rr * rr - d * d));
    }
    return top;
  };
  groundAt = (x, z) => play.sandAt(x, z) ?? Math.max(z < -5.35 ? heapAt(x, z) : 0, rootTop(x, z));
  for (const tree of Object.values(wood)) if (tree.trunk) hoseOnly.push({ type: 'trunk', ...tree.trunk }); // (the trunks as they are, to lie against)

  return {
    wood, swing, birdInTree, past, // (for checking)
    /** What to call when something out here has moved that throws a shadow (the spade taken, the sand dug). */
    shadowsMoved: (fn) => { play.shadowsMoved(fn); past.shadowsMoved(fn); hoseMoved = fn; }, // (and the hose off its hook or back on it: its shadow on the wall went with it — user, 2026-10-19)
    brighten(gain) {
      skyMat.color.setScalar(1.15 * gain);
      farMat.color.setRGB(DAY.far[0] * gain, DAY.far[1] * gain, DAY.far[2] * gain);
      for (const c of clouds) c.color.setScalar(0.9 * gain);
      glowMat.color.setScalar(gain);
    },
    update(dt, time) {
      swing.sway(time, dt);
      play.update(dt);
      hose?.update(dt, time);
    },
  };
}

// ---------------------------------------------------------------- long grass

/**
 * Last year's leaves, lying in the wood (user, 2026-10-17: "give the leaves volume, round the trunks and along
 * the fence" — then: "they float in nothing: make heaps"): mounds of them — the ground itself raised, in the
 * lawn's own picture (brown there), deepest at the trunks' roots and blown up against the fence's boards —
 * and on them, and on the flat ground round them, the leaves one by one, each lying on what is under it,
 * a little curled. Fewer under the spruce. Never in a trunk, a post, the shed or the slide.
 */
function leafHeaps(g, r, groundMat) {
  const trunks = Object.entries(GROVE);
  const inward = (x, z) => Math.min(x - Y.x0, Y.x1 - x, z - Y.z0); // how far in from the fence (as it stood before the pool: the leaves' dice are thrown as they were)
  // the heaps, scattered as the wind left them (user, 2026-10-17: "random heaps round the trunks — this is
  // too even"): a few lumpy ones round each trunk, at odds distances and sizes, some up against it, some well
  // off; a few more out in the wood; at the roots only here and there; along the fence in drifts with gaps
  const shed = [1.8, 3.7, -7.0, -5.4];
  const blobs = []; // [x, z, rx, rz, turn, height]
  const blob = (x, z, rx, h) => {
    if (x < Y.x0 + 0.1 || x > Y.x1 - 0.1 || z < Y.z0 + 0.1 || z > -6.0) return;
    if (x > shed[0] - rx - 0.25 && x < shed[1] + rx + 0.25 && z > shed[2] - rx - 0.25) return; // not on the shed
    blobs.push([x, z, rx, rx * (0.45 + r() * 0.6), r() * Math.PI, h]);
  };
  for (const [kind, { at: [tx, tz], foot }] of trunks) {
    for (let k = 0, n = (kind === 'spruce' ? 2 : 3) + Math.floor(r() * 4); k < n; k++) {
      const a = r() * Math.PI * 2, d = foot + 0.05 + r() ** 0.9 * 2.0;
      blob(tx + Math.cos(a) * d, tz + Math.sin(a) * d, 0.22 + r() * 0.55, (kind === 'spruce' ? 0.06 : 0.1) + r() * 0.15 * Math.max(0.4, 1 - (d - foot) / 2.2));
    }
  }
  for (let k = 0; k < 9; k++) { const x = Y.x0 + 0.4 + r() * (Y.x1 - Y.x0 - 0.8), z = Y.z0 + 0.4 + r() * 6.5; if (woodland(x, z) > 0.6) blob(x, z, 0.2 + r() * 0.4, 0.05 + r() * 0.08); }
  const heapAt = (x, z, old = false) => { // (old: with the drift along the old far fence, as the dice were thrown for it)
    let h = 0;
    for (const [bx, bz, rx, rz, turn, bh] of blobs) {
      const dx = x - bx, dz = z - bz;
      if (Math.abs(dx) > rx * 1.1 || Math.abs(dz) > rx * 1.1) continue;
      const c = Math.cos(turn), sn = Math.sin(turn), u = (dx * c + dz * sn) / rx, v = (-dx * sn + dz * c) / rz, q = u * u + v * v;
      if (q < 1) h = Math.max(h, bh * (1 - q) ** 1.4 * (0.7 + 0.6 * fbm(x * 4 + bx, z * 4 + bz, 0.5, 2)));
    }
    for (const [kind, { at: [tx, tz], foot }] of trunks) { // against the roots, only on some sides
      const d = Math.hypot(x - tx, z - tz);
      if (d > foot + 0.7) continue;
      const side = Math.max(0, (fbm(x * 2.2 + tx, z * 2.2 + tz, 0.5, 2) - 0.45) * 3);
      h = Math.max(h, (kind === 'spruce' ? 0.06 : 0.14) * Math.max(0, 1 - Math.max(0, d - foot) / 0.6) ** 1.5 * Math.min(1, side));
    }
    const d = old ? inward(x, z) : Math.min(x - Y.x0, Y.x1 - x); // (no drift where the far fence was: it is past the pool now)
    if (d < 0.7) {
      const along = Math.abs(d - (x - Y.x0)) < 1e-6 ? z : Math.abs(d - (Y.x1 - x)) < 1e-6 ? z + 20 : x + 40; // which fence, and how far along it
      const drift = Math.max(0, (fbm(along * 0.9 + 3, 1.7, 0.5, 2) - 0.42) * 2.6); // in drifts, with gaps between
      h = Math.max(h, 0.13 * Math.max(0, 1 - d / (0.4 + 0.35 * drift)) ** 1.4 * woodland(x, z) * Math.min(1, drift) * (0.6 + 0.8 * fbm(x * 2.5 + 4, z * 2.5 + 6, 0.5, 2)));
    }
    return h;
  };
  // the mounds: the ground raised where the heaps are, nothing where they aren't
  const Z1 = -5.4, S = 0.05, nx = Math.round((Y.x1 - Y.x0) / S) + 1, nz = Math.round((Z1 - Y.z0) / S) + 1;
  const pos = [], uv = [], idx = [], H = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = Y.x0 + i * S, z = Y.z0 + j * S, h = heapAt(x, z);
    H.push(h);
    pos.push(x, h + 0.002, z);
    uv.push((x - Y.x0) / (Y.x1 - Y.x0), 1 - (z - Y.z0) / (Y.z1 - Y.z0));
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if (Math.max(H[a], H[b], H[c], H[d]) < 0.003) continue;
    idx.push(a, c, b, b, c, d);
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  mg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  mg.setIndex(idx);
  mg.computeVertexNormals();
  const moundMat = groundMat.clone();
  moundMat.shadowSide = THREE.DoubleSide; // (an open sheet: it still throws its shadow)
  const mounds = new THREE.Mesh(mg, moundMat);
  mounds.receiveShadow = mounds.castShadow = true; // (the low sun throws a heap's shadow: it reads as a heap)
  g.add(mounds);

  // the leaves on them
  const keepOff = [[1.8, 3.7, -7.0, -5.4], [TOWER.x0 - 0.1, SANDBOX.x1 + 0.1, TOWER.z0 - TOWER.run - 0.2, SANDBOX.z1 + 0.1]]; // the shed; the slide and the sandbox
  const posts = [];
  for (const run of [{ a: [Y.x0, Y.z0], b: [Y.x1, Y.z0], n: [0, 1] }, { a: [Y.x0, -t - 0.06], b: [Y.x0, Y.z0], n: [1, 0] }, { a: [Y.x1, Y.z0], b: [Y.x1, Y.z1], n: [-1, 0] }]) { // as fence() puts them
    const len = Math.hypot(run.b[0] - run.a[0], run.b[1] - run.a[1]), k = Math.ceil(len / 2.3);
    for (let i = 0; i <= k; i++) posts.push([run.a[0] + ((run.b[0] - run.a[0]) * i) / k + run.n[0] * 0.06, run.a[1] + ((run.b[1] - run.a[1]) * i) / k + run.n[1] * 0.06]);
  }
  const free = (x, z, s) => x > Y.x0 + 0.03 && x < Y.x1 - 0.03 && z > Y.z0 + 0.03 && trunks.every(([, { at: [tx, tz], foot }]) => Math.hypot(x - tx, z - tz) > foot + s * 0.5) && posts.every(([px, pz]) => Math.abs(x - px) > 0.05 + s * 0.5 || Math.abs(z - pz) > 0.05 + s * 0.5) && !keepOff.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  const spots = [];
  const add = (x, z, drift = false) => { const s = 0.05 + r() * 0.06; if (free(x, z, s)) spots.push([x, z, s, drift]); };
  for (const [bx, bz, rx] of blobs) for (let i = 0, n = Math.round(rx * rx * 1500); i < n; i++) { // thick on the heaps
    const a = r() * Math.PI * 2, d = rx * Math.sqrt(r()), x = bx + Math.cos(a) * d, z = bz + Math.sin(a) * d;
    if (heapAt(x, z, true) > 0.004) add(x, z);
  }
  for (let i = 0; i < 30000; i++) { // on the root heaps and the fence's drifts
    const x = Y.x0 + r() * (Y.x1 - Y.x0), z = Y.z0 + r() * 8.5, h = heapAt(x, z, true);
    if (h > 0.004 && r() < Math.min(1, h / 0.05)) add(x, z, true);
  }
  for (let i = 0; i < 14000; i++) { // and, fewer, everywhere under the trees, flat on the ground
    const x = Y.x0 + r() * (Y.x1 - Y.x0), z = Y.z0 + r() * 8.5, w = woodland(x, z);
    if (r() > w * w * (1 - 0.8 * needleFall(x, z))) continue;
    add(x, z);
  }
  // one leaf: curled a little at its edges and along it
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
  mat.customProgramCacheKey = () => 'litter';
  const leaves = new THREE.InstancedMesh(geo, mat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), at = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
  spots.forEach(([x, z, s, drift], i) => {
    // lying on what is under it: turned to the slope of the heap, a little askew, its middle just on it
    const e2 = 0.04, h = heapAt(x, z), gone = drift && h < 0.004; // (one of the drift's along the old far fence: drawn at nothing)
    n.set(-(heapAt(x + e2, z) - heapAt(x - e2, z)) / (2 * e2), 1, -(heapAt(x, z + e2) - heapAt(x, z - e2)) / (2 * e2)).normalize();
    q.setFromUnitVectors(UP, n);
    e.set((r() - 0.5) * 0.4, r() * Math.PI * 2, (r() - 0.5) * 0.4, 'YXZ');
    q.multiply(q2.setFromEuler(e));
    m.compose(at.set(x, h + 0.003 + r() * 0.003, z), q, sc.set(s * (r() < 0.5 ? -1 : 1), s, s));
    if (gone) m.makeScale(0, 0, 0);
    leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, c.setScalar(0.78 + r() * 0.3));
    cells[i] = Math.floor(r() * 16);
  });
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1));
  leaves.receiveShadow = true;
  g.add(leaves);
  return heapAt; // (what the hose lies on)
}

/**
 * Tufts of grass wherever the lawn isn't worn bare: short, mown, uneven — thick in some places and thin in
 * others, in clumps big and small — and long where the mower never reached, along the fence, round the
 * shed and the trunks (user, 2026-10-17: shorter, the long kept at the edges, more random).
 */
function longGrass(g, r, lawnPicture) {
  const keepOff = [
    [SANDBOX.x0 - 0.02, SANDBOX.x1 + 0.02, SANDBOX.z0 - 0.02, SANDBOX.z1 + 0.02], // the sandbox
    [TOWER.x0 - 0.04, TOWER.x1 + 0.04, TOWER.z0 - TOWER.run - 0.1, TOWER.z1 + 0.04], // the slide's tower and its ladder
    [1.8, 3.7, -7.0, -5.4], // the shed
    [0.45, 1.95, -1.1, -0.1], // the cellar doors
    [BACK.x0 - 0.2, BACK.x1 + 0.2, -0.75, -0.1], // the doormat by the back door
  ];
  const shed = keepOff[2], trunks = Object.values(GROVE).map(({ at }) => at);
  const spots = [];
  for (let x = Y.x0 + 0.05; x < Y.x1 - 0.05; x += 0.085) {
    for (let z = Y.z0 + 0.05; z < Y.z1 - 0.12; z += 0.085) {
      const px = x + (r() - 0.5) * 0.08, pz = z + (r() - 0.5) * 0.08;
      if (keepOff.some(([x0, x1, z0, z1]) => px > x0 && px < x1 && pz > z0 && pz < z1)) continue;
      const bare = bareness(px, pz);
      const thick = fbm(px * 0.9 + 31, pz * 0.9 + 17, 0.5, 3), fine = fbm(px * 3.3 + 7, pz * 3.3 + 3, 0.5, 2);
      const wood = woodland(px, pz);
      if (wood > 0.3) { // in the wood: now and then a tuft through the leaves, and by the fence the odd tall one (user, 2026-10-17)
        const edge = Math.min(px - Y.x0, Y.x1 - px, pz - Y.z0);
        if (edge < 0.45 ? r() > 0.011 : r() > 0.00275) continue; // (rare: a score or so in all, and a few tall ones by the fence — halved, user, 2026-10-17)
        spots.push([px, pz, edge < 0.45 ? 0.3 + r() * 0.3 : 0.05 + r() * 0.05, wood]); // (the ones in the leaves short: user, 2026-10-17)
        continue;
      }
      if (r() < 0.2 + bare * 1.3 + (0.5 - thick) * 1.1 + (0.5 - fine) * 0.7 + wood * 1.5) continue; // thin where it's worn, none where bare, in clumps, thinning out towards the trees
      // how near something the mower can't get close to: the fence, the shed's walls, the trunks
      const reach = Math.min(px - Y.x0, Y.x1 - px, pz - Y.z0, Math.hypot(px - THREE.MathUtils.clamp(px, shed[0], shed[1]), pz - THREE.MathUtils.clamp(pz, shed[2], shed[3])) + 0.1, ...trunks.map(([tx, tz]) => Math.hypot(px - tx, pz - tz) - 0.2));
      const uncut = 1 - THREE.MathUtils.smoothstep(reach + (fine - 0.5) * 0.2, 0.18, 0.6);
      const mown = (0.045 + r() * 0.045 + 0.06 * Math.max(0, thick - 0.45)) * (1 - bare * 0.6);
      const long = (0.13 + r() * 0.12) * (1.9 + r() * 0.6) * (1 - bare * 0.5);
      let tall = (mown + (long - mown) * uncut) * (1 - wood * 0.6);
      if (wood > 0.12) { // where the lawn gives way to the wood: half as many, and none tall but by the fence
        if (r() < 0.5) continue;
        if (Math.min(px - Y.x0, Y.x1 - px, pz - Y.z0) > 0.45) tall = Math.min(tall, 0.09);
      }
      spots.push([px, pz, tall, wood]);
    }
  }
  // (2026-10-29: the far fence gone from the wood's end — the tall tufts the mower couldn't reach along it short now,
  // as the rest in the wood; worked out after the dice, so nothing else moves)
  for (const sp of spots) if (sp[3] > 0.3 && sp[2] >= 0.3 && Math.min(sp[0] - Y.x0, Y.x1 - sp[0]) >= 0.45) sp[2] = 0.05 + (sp[2] - 0.3) / 6;
  // none where the cellar's concrete and its steps are now (left where they were drawn, so nothing else moves: a
  // tuft there is drawn at nothing), and round its concrete the long grass the mower never gets at (user,
  // 2026-10-21: "a few tufts of grass around it"), drawn with their own dice after all the rest
  const Cx0 = CELLAR.x0 - CELLAR.side, Cx1 = CELLAR.x1 + CELLAR.side, Cz0 = CELLAR.z0 - CELLAR.sill / 2 - OZ, Cz1 = CELLAR.z1 - OZ;
  const onCellar = (x, z) => x > Cx0 - 0.02 && x < Cx1 + 0.02 && z > Cz0 - 0.02 && z < Cz1;
  const rc = mulberry32(2131);
  for (let i = 0; i < 34; i++) {
    const side = rc(), along = rc();
    const [x, z] = side < 0.36 ? [Cx0 + (Cx1 - Cx0) * along, Cz0 - 0.03 - rc() * 0.09] : side < 0.68 ? [Cx0 - 0.03 - rc() * 0.08, Cz0 + (Cz1 - Cz0 - 0.06) * along] : [Cx1 + 0.03 + rc() * 0.08, Cz0 + (Cz1 - Cz0 - 0.06) * along];
    if (rc() < 0.25) continue; // (not a hedge of it: gaps)
    spots.push([x, z, (0.12 + rc() * 0.2) * (along > 0.85 && side >= 0.36 ? 1.25 : 1), 0]); // (longest where the cheeks meet the wall)
  }
  // one tuft: three cards crossed, lit as if they were the ground
  const card = new THREE.PlaneGeometry(0.32, 1);
  card.translate(0, 0.5, 0);
  const parts = [0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => card.clone().rotateY(a));
  const geo = mergeAll(parts);
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  const tuftMat = bothFacesLit(std({ map: T.grassTuftTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 }), 'tufts');
  const tufts = new THREE.InstancedMesh(geo, tuftMat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  // each tuft the colour of the ground it stands in (the lawn's picture, there): it grows out of it, so it
  // never stands out darker or lighter than it (user, 2026-10-17) — a little lighter, its tips catching the light
  const pic = lawnPicture.getContext('2d').getImageData(0, 0, lawnPicture.width, lawnPicture.height), W = pic.width, H = pic.height;
  const tuft = new THREE.Color().setRGB(94 / 255, 117 / 255, 52 / 255, THREE.SRGBColorSpace); // the tuft texture's own, on average
  const under = (x, z) => {
    const cx = Math.round(((x - Y.x0) / (Y.x1 - Y.x0)) * (W - 1)), cy = Math.round(((z - Y.z0) / (Y.z1 - Y.z0)) * (H - 1));
    let rr = 0, gg = 0, bb = 0, n = 0;
    for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) {
      const k = (Math.min(H - 1, Math.max(0, cy + dy)) * W + Math.min(W - 1, Math.max(0, cx + dx))) * 4;
      rr += pic.data[k]; gg += pic.data[k + 1]; bb += pic.data[k + 2]; n++;
    }
    return c.setRGB(rr / n / 255, gg / n / 255, bb / n / 255, THREE.SRGBColorSpace);
  };
  const green = new THREE.Color().setRGB(92 / 255, 104 / 255, 48 / 255, THREE.SRGBColorSpace); // the lawn's, gone a little yellow: the tufts among the leaves are still green, in the shade
  spots.forEach(([x, z, tall, wood], i) => {
    e.set((r() - 0.5) * 0.25, r() * Math.PI, (r() - 0.5) * 0.25);
    q.setFromEuler(e);
    const wide = Math.min(1.5, Math.max(0.4, tall * 3.2)) * (0.7 + r() * 0.5); // a short tuft is a narrow one: its blades not squashed
    m.compose(p.set(x, 0, z), q, onCellar(x, z) ? s.set(0, 0, 0) : s.set(wide, tall, wide));
    tufts.setMatrixAt(i, m);
    under(x, z).lerp(green, Math.min(0.8, wood * 1.2));
    const k = 1.08 + (r() - 0.5) * 0.14;
    tufts.setColorAt(i, c.setRGB(Math.min(1.4, (c.r / tuft.r) * k), Math.min(1.4, (c.g / tuft.g) * k), Math.min(1.4, (c.b / tuft.b) * k)));
  });
  tufts.receiveShadow = true;
  g.add(tufts);
}

/**
 * A flamingo drowned in the pool (user, 2026-11-02): only its head out of the water and a bit of its neck, crooked, years in
 * there — bleached, mould over it, a slime line where the water stands, one eye gone: on the side you see from the house,
 * a hole where it was. The rest of it is under the water, which you can't see into.
 */
function drownedFlamingo(g, M, x, y, z) {
  const F = FLAMINGO, ROUND = 32;
  const paint = std({ map: T.mouldyFlamingoTex(243, F), color: 0xa39490, roughness: 0.86 }); // (dull: it looked lit by itself against the water)
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  holder.rotation.set(deg(15), deg(205), deg(-17), 'YXZ'); // (its head towards the house's side and west; leaning right over)
  g.add(holder);
  const f = new THREE.Group();
  f.position.set(-0.206, -0.782, 0); // (the water at this height of its neck: the head and its beak clear, a bit of neck)
  holder.add(f);
  const neck = loft(F.neck, (t) => along(F.neckR, t), (t) => along(F.neckR, t) * along(F.neckW, t), 170, ROUND);
  const m = new THREE.Mesh(sideOn(neck.geo), paint);
  m.castShadow = m.receiveShadow = true;
  f.add(m);
  const at = neck.curve.getPoint(F.eye), tan = neck.curve.getTangent(F.eye), ux = -tan.y, uy = tan.x, a = along(F.neckR, F.eye), b = a * along(F.neckW, F.eye), c = Math.cos(1.0), sn = Math.sin(1.0);
  const spot = (s, k = 0.95) => new THREE.Vector3(at.x + ux * a * c * k, at.y + uy * a * c * k, s * b * sn * k);
  // the eye it still has, dull and dirty
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), fourOClockSun(std({ color: new THREE.Color(0xe8c23a).multiplyScalar(0.55), roughness: 0.85 })));
  eye.position.copy(spot(1));
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 12, 8), M.blackPlastic);
  pupil.position.copy(eye.position).add(new THREE.Vector3(ux * 0.002, uy * 0.002, 0.007));
  // where the other was: the hole it came out of, black, its rim of plastic a little raised, a dirty run down from it
  const hole = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 14, 10).scale(1, 1, 0.5), std({ color: 0x070605, roughness: 1 }));
  hole.position.copy(spot(-1, 0.985));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0122, 0.002, 6, 18), paint);
  rim.position.copy(hole.position);
  rim.lookAt(hole.position.clone().add(new THREE.Vector3(ux * c, uy * c, -sn)));
  for (const o of [eye, pupil, hole, rim]) { o.receiveShadow = true; f.add(o); }
}

/** Geometries into one (all with the same attributes). */
function mergeAll(list) {
  const pos = [], nor = [], uv = [], idx = [];
  let base = 0;
  for (const geo of list) {
    const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u.getX(i), u.getY(i));
    }
    for (let i = 0; i < geo.index.count; i++) idx.push(geo.index.getX(i) + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

// ---------------------------------------------------------------- round about

/** What the houses round about are made of. */
function houseMats() {
  return {
    shingles: std({ map: T.shingleTex(), roughness: 0.95 }),
    glassDark: std({ color: 0x1f2328, roughness: 0.1, metalness: 0.3 }),
    glassLit: std({ color: 0x2a2018, emissive: 0xffbe72, emissiveIntensity: DAY.litWindows, roughness: 0.3 }),
    trim: std({ color: 0xe8e3d6, roughness: 0.6 }),
    brick: std({ color: 0x7a4436, roughness: 0.9 }),
    door: std({ map: T.doorTex('#d9d2c2'), roughness: 0.5 }),
  };
}

/** The houses that back onto the yard: siding, a roof of shingles, windows (one or two lit), gutters, a chimney. */
function neighbours(g, mat, r) {
  const m = houseMats();
  // [x0, x1, z0, z1, eaves, tint, ridge along x?, the side that faces this way]
  const houses = [
    [-9.5, -1.5, -17.5 + DZ, -11.0 + DZ, 2.9, 0xc9d2d8, true, 'z1'],
    [1.0, 8.0, -18.0 + DZ, -11.5 + DZ, 2.7, 0xe6dcc4, true, 'z1'],
    [-24.1, -18.6, -7.5, 0.5, 2.8, 0xcfd5bf, false, 'x1'], // across the street, past the yard's west fence
    [9.0, 15.5, -8.0, 0.5, 2.9, 0xf0ece2, false, 'x0'],
  ];
  houses.forEach((h, k) => house(g, mat, m, h, k % 2 === 0, r, h[7] === 'x1'));
}

/**
 * One house: foundation, sided walls, a gable roof of shingles overhanging, maybe a chimney, three
 * windows in trim on the side that faces this way (`face`: 'z1', 'x1' or 'x0') and, if `door`, the
 * front door in place of the middle one, with a step.
 */
function house(g, mat, m, [x0, x1, z0, z1, eaves, tint, alongX, face], chimney, r, door = false) {
  const siding = metric(std({ map: T.sidingTex(), color: tint, roughness: 0.85 }), T.PERIOD.siding);
  g.add(slab(x0, x1, -0.3, 0.25, z0, z1, mat.concrete)); // the foundation
  g.add(slab(x0, x1, 0.25, eaves, z0, z1, siding));
  // the roof: a prism over the long way, overhanging
  const span = alongX ? z1 - z0 : x1 - x0, len = alongX ? x1 - x0 : z1 - z0, pitch = 1.6 + r() * 0.6;
  HOUSES.push({ x0: x0 - 0.42, x1: x1 + 0.42, z0: z0 - 0.42, z1: z1 + 0.42, eaves, pitch, alongX, chimney });
  const gable = new THREE.Shape([new THREE.Vector2(-span / 2 - 0.4, 0), new THREE.Vector2(span / 2 + 0.4, 0), new THREE.Vector2(0, pitch)]);
  const geo = new THREE.ExtrudeGeometry(gable, { depth: len + 0.6, bevelEnabled: false });
  geo.translate(0, 0, -(len + 0.6) / 2);
  const roof = new THREE.Mesh(geo, [m.shingles, m.shingles]);
  roof.position.set((x0 + x1) / 2, eaves, (z0 + z1) / 2);
  if (alongX) roof.rotation.y = Math.PI / 2;
  roof.castShadow = roof.receiveShadow = true;
  g.add(roof);
  // the gable ends, in siding
  for (const s of [-1, 1]) {
    const tri = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, pitch - 0.3)])), siding);
    tri.position.set((x0 + x1) / 2 + (alongX ? s * len / 2 : 0), eaves, (z0 + z1) / 2 + (alongX ? 0 : s * len / 2));
    tri.rotation.y = alongX ? s * Math.PI / 2 : s > 0 ? 0 : Math.PI;
    g.add(tri);
  }
  if (chimney) g.add(slab((x0 + x1) / 2 + 1.2, (x0 + x1) / 2 + 1.8, eaves, eaves + pitch + 0.6, (z0 + z1) / 2 - 0.3, (z0 + z1) / 2 + 0.3, m.brick));
  // windows on the side facing this way
  const onZ = face === 'z1', f = { z1, x1, x0 }[face], out = face === 'x0' ? -1 : 1;
  const along = onZ ? [x0 + 0.8, x1 - 0.8] : [z0 + 0.8, z1 - 0.8];
  const count = 3;
  // a box standing proud of that side: from `a` to `b` along it, `y0` to `y1` up, `d0` to `d1` out from it
  const proud = (a, b, y0, y1, d0, d1, mt) => {
    const [o0, o1] = out > 0 ? [f + d0, f + d1] : [f - d1, f - d0];
    return onZ ? slab(a, b, y0, y1, o0, o1, mt) : slab(o0, o1, y0, y1, a, b, mt);
  };
  for (let i = 0; i < count; i++) {
    const c = along[0] + ((along[1] - along[0]) * (i + 0.5)) / count, lit = r() < 0.35;
    if (door && i === 1) {
      g.add(proud(c - 0.48, c + 0.48, 0.25, 2.35, 0, 0.05, m.door));
      for (const [a, b, y0, y1] of [[c - 0.56, c - 0.48, 0.25, 2.43], [c + 0.48, c + 0.56, 0.25, 2.43], [c - 0.56, c + 0.56, 2.35, 2.43]]) g.add(proud(a, b, y0, y1, 0, 0.08, m.trim));
      g.add(proud(c - 0.75, c + 0.75, 0, 0.25, 0, 0.7, mat.concrete)); // the step
      continue;
    }
    g.add(proud(c - 0.45, c + 0.45, 1.0, 2.2, 0, 0.06, lit ? m.glassLit : m.glassDark));
    g.add(proud(c - 0.52, c + 0.52, 0.92, 1.0, 0.02, 0.08, m.trim));
    g.add(proud(c - 0.52, c + 0.52, 2.2, 2.28, 0.02, 0.08, m.trim));
    g.add(proud(c - 0.03, c + 0.03, 1.0, 2.2, 0.06, 0.08, m.trim));
  }
  // a gutter along the eaves on that side
  if (onZ) g.add(slab(x0 - 0.3, x1 + 0.3, eaves - 0.12, eaves, f + 0.5 - 0.06, f + 0.5 + 0.06, m.trim));
}

/**
 * Out the front, seen from the living room's window: the front lawn, the path from the front door
 * and its step, the sidewalk, the street — old asphalt, a kerb's height below the sidewalks — and the
 * houses across it, a mailbox by the path, a tree on each side.
 */
function street(g, M, mat, front) {
  const r = mulberry32(351);
  const X = Y.x0; // the house's west wall, outside
  const S = { lawn: -9.0, walk: -10.4, road: -15.4, far: -16.8 };
  const pave = metric(std({ map: T.paveTex(), roughness: 0.95 }), T.PERIOD.pave);
  const asphalt = metric(std({ map: T.asphaltTex(), roughness: 0.92 }), T.PERIOD.asphalt);
  // the stoop up to the front door, as high as the house's floor (user, 2026-10-20: the house raised): a landing
  // and steps down to the path, old concrete
  const steps = Math.max(1, Math.round(LIFT / 0.15)), rise = LIFT / steps, LAND = 0.9;
  g.add(slab(X - LAND, X, 0, LIFT, front.z0 - 0.25, front.z1 + 0.25, mat.concrete));
  for (let k = 1; k < steps + (LIFT > 0 ? 0 : 0); k++) g.add(slab(X - LAND - k * 0.28, X - LAND - (k - 1) * 0.28, 0, LIFT - k * rise, front.z0 - 0.1, front.z1 + 0.1, mat.concrete));
  g.add(slab(S.lawn, X - LAND - (steps - 1) * 0.28, 0, 0.02, front.z0 + 0.02, front.z1 - 0.02, pave)); // the path
  g.add(slab(S.walk, S.lawn, 0, 0.1, -40, 40, pave));
  g.add(slab(S.far, S.road, 0, 0.1, -40, 40, pave));
  g.add(slab(S.road, S.walk, -0.02, 0, -40, 40, asphalt));
  // the mailbox at the end of the path: a post, a box with a rounded top, its flag down
  const mz = front.z1 + 0.45, mx = S.lawn + 0.35;
  const metal = std({ color: 0x55595c, metalness: 0.6, roughness: 0.55 });
  g.add(slab(mx - 0.045, mx + 0.045, 0, 1.0, mz - 0.045, mz + 0.045, std({ color: 0x5a4632, roughness: 0.9 })));
  g.add(slab(mx - 0.26, mx + 0.24, 1.0, 1.13, mz - 0.1, mz + 0.1, metal));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 16, 1, false, 0, Math.PI), metal);
  top.rotation.z = Math.PI / 2; // lying along the box, the round half up
  top.position.set(mx - 0.01, 1.13, mz);
  top.castShadow = true;
  g.add(top);
  g.add(slab(mx - 0.05, mx + 0.1, 1.06, 1.1, mz + 0.1, mz + 0.115, std({ color: 0xa8322a, roughness: 0.6 })));
  // across the street, two more houses facing this way, and a tree each side
  const m = houseMats();
  house(g, mat, m, [-24.1, -18.6, 3.0, 10.4, 2.8, 0xd9cdb8, false, 'x1'], true, r, true);
  house(g, mat, m, [-24.1, -18.6, 13.2, 18.4, 2.9, 0xc4ccd6, false, 'x1'], false, r, true);
  trees(g, r, [[-7.3, 10.6, 8.5], [-17.7, 11.9, 10]]);
}

/**
 * The trees round about: a trunk, a few limbs, and the leaves in clumps of crossed cards — grown round the
 * houses, never into them (a limb that would reach in is cut short, a clump that would is left off), and
 * never hanging down into the yard. Those past the far fence stand as much further off as the fence is.
 */
function trees(g, r, spots = [[-6.5, -9.9, 9.5], [-0.25, -14.6, 11], [11.2, -9.6, 8.5], [-7.9, -2.4, 9], [6.7, -5.4, 10], [-3.0, -20.0, 12], [12.0, -14.0, 10.5]].map(([x, z, h]) => [x, z < -7.2 ? z + DZ : z, h]), wire = null) {
  const bark = std({ map: T.barkTex(), roughness: 1 });
  const leafMat = bothFacesLit(std({ map: T.leafClumpTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), 'far-leaves');
  const cards = [];
  const o = new THREE.Object3D(), tip = new THREE.Vector3();
  const near = (x, y, z, m) => wire && wire.some((w) => Math.hypot(w.x - x, w.y - y, w.z - z) < m + 0.6);
  const clear = (x, y, z, m) => !inHouse(x, y, z, m) && !(y - m < 2.3 && overYard(x, z, m)) && !near(x, y, z, m);
  for (const [x, z, h] of spots) {
    const trunkH = h * 0.45;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 + h * 0.008, 0.22 + h * 0.012, trunkH, 12), bark);
    trunk.position.set(x, trunkH / 2, z);
    trunk.castShadow = trunk.receiveShadow = true;
    g.add(trunk);
    const limbs = 4 + Math.floor(r() * 2), tips = [];
    for (let i = 0; i < limbs; i++) {
      const a = (i / limbs) * Math.PI * 2 + r(), up = 0.45 + r() * 0.35;
      let len = h * (0.2 + r() * 0.08);
      o.position.set(x, trunkH * (0.8 + r() * 0.2), z);
      o.rotation.set(0, a, up);
      o.updateMatrix();
      for (let k = 0; k < 6 && (tip.set(0, len, 0).applyMatrix4(o.matrix), !clear(tip.x, tip.y, tip.z, 0.4)); k++) len *= 0.72;
      if (!clear(tip.x, tip.y, tip.z, 0.4)) continue;
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.1, len, 8), bark);
      limb.geometry.translate(0, len / 2, 0);
      limb.position.copy(o.position);
      limb.rotation.copy(o.rotation);
      limb.castShadow = true;
      g.add(limb);
      tips.push(tip.clone());
    }
    tips.push(new THREE.Vector3(x, trunkH + h * 0.35, z));
    // the crown: clumps over the end of every limb and over the top, so no bare limb shows
    const crown = h * 0.3;
    for (let c = 0; c < 18; c++) {
      const at = tips[c % tips.length];
      const cx = at.x + (r() - 0.5) * crown * 0.9, cy = at.y + (r() - 0.3) * crown * 0.7, cz = at.z + (r() - 0.5) * crown * 0.9, size = 1.6 + r() * 1.4;
      for (let k = 0; k < 6; k++) {
        const card = [cx + (r() - 0.5) * 0.8, cy + (r() - 0.5) * 0.7, cz + (r() - 0.5) * 0.8, size, r() * Math.PI, (r() - 0.5) * 1.2];
        if (clear(card[0], card[1], card[2], size * 0.45)) cards.push(card);
      }
    }
  }
  const geo = new THREE.PlaneGeometry(1, 1);
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // lit from above, like a crown is
  const leaves = new THREE.InstancedMesh(geo, leafMat, cards.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  cards.forEach(([x, y, z, size, yaw, tilt], i) => {
    e.set(tilt, yaw, 0, 'YXZ');
    q.setFromEuler(e);
    m.compose(p.set(x, y, z), q, s.set(size, size, size));
    leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, col.setHSL(0.22 + r() * 0.05, 0.35 + r() * 0.15, 0.45 + r() * 0.2));
  });
  leaves.castShadow = leaves.receiveShadow = true;
  g.add(leaves);
}

/** Telegraph poles along the back alley, wires slung between them, one line down to the house. */
function poles(g, M) {
  const wood = std({ color: 0x4a3c2e, roughness: 0.95 });
  const wire = std({ color: 0x1b1a19, roughness: 0.6 });
  const z = -9.4 + DZ, at = [-10.1, -2, 8, 18]; // the first on the sidewalk by the street
  const zHouse = -9.4 + END + 7.2; // (where the alley was before the garden reached past the pool: the house's line comes from there still)
  const tops = [];
  for (const x of at) {
    g.add(cyl(0.11, 0.14, 9, wood, x, 4.5, z, 10));
    g.add(slab(x - 0.9, x + 0.9, 8.4, 8.52, z - 0.06, z + 0.06, wood));
    for (const dx of [-0.75, 0, 0.75]) g.add(cyl(0.035, 0.035, 0.12, std({ color: 0x5f7d6a, roughness: 0.3 }), x + dx, 8.6, z, 8));
    tops.push(x);
  }
  for (let i = 0; i < tops.length - 1; i++) {
    for (const dx of [-0.75, 0, 0.75]) {
      const a = [tops[i] + dx, 8.66, z], b = [tops[i + 1] + dx, 8.66, z];
      const mid = [(a[0] + b[0]) / 2, 8.1, z];
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a), new THREE.Vector3(...mid), new THREE.Vector3(...b)), 24, 0.008, 4, false), wire));
    }
  }
  // the house's own line, from the pole behind the east neighbour's (along the wood's edge, not through it:
  // the trees are tall now) to a hook in the wall under the eaves, by the bedroom's corner: it passes under
  // the gutter, not through it
  const from = new THREE.Vector3(8 - 0.75, 8.6, zHouse), to = new THREE.Vector3(3.6, 2.3 - OY, -t - 0.07 - OZ); // (the hook on the house: where the house is in this frame)
  // (2026-11-01: the garden wider past the wood took in where it came from. The line to the house stays exactly where it
  // ran, the grove having grown round it; it now starts from a pole of its own just outside the fence's step, fed along
  // that fence from a pole further east, and that from the alley)

  const sag = from.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(0, -1.2, 0));
  const line = new THREE.QuadraticBezierCurve3(from, sag, to);
  const cut = (END + 0.4 - from.z) / (to.z - from.z), feed = line.getPoint(cut), kept = [];
  for (let k = 0; k <= 40; k++) kept.push(line.getPoint(cut + ((1 - cut) * k) / 40));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(kept), 48, 0.01, 4, false), wire));
  const stub = (x, zz, top) => {
    g.add(cyl(0.1, 0.13, top, wood, x + 0.02, top / 2, zz - 0.02, 10));
    g.add(slab(x - 0.3, x + 0.3, top - 0.2, top - 0.09, zz - 0.055, zz + 0.055, wood));
    g.add(cyl(0.035, 0.035, 0.12, std({ color: 0x5f7d6a, roughness: 0.3 }), x, top - 0.03, zz, 8));
  };
  const eastX = 18 - 0.75;
  stub(feed.x, feed.z, feed.y + 0.05);
  stub(eastX, feed.z, feed.y + 0.05);
  const hung = (a, b, drop) => new THREE.QuadraticBezierCurve3(a, a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, -drop, 0)), b);
  const spanE = hung(feed.clone().setY(feed.y + 0.06), new THREE.Vector3(eastX, feed.y + 0.06, feed.z), 0.45), spanA = hung(new THREE.Vector3(eastX, feed.y + 0.06, feed.z), new THREE.Vector3(eastX, 8.66, z), 0.5);
  for (const c of [spanE, spanA]) g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 36, 0.008, 4, false), wire));
  const hook = std({ color: 0x2a2826, metalness: 0.5, roughness: 0.6 });
  g.add(slab(to.x - 0.03, to.x + 0.03, to.y - 0.05, to.y + 0.05, -t - 0.012 - OZ, -t - OZ, hook)); // its plate on the wall
  g.add(cyl(0.006, 0.006, 0.07, hook, to.x, to.y, -t - 0.045 - OZ, 6).rotateX(Math.PI / 2));
  g.add(cyl(0.016, 0.02, 0.03, std({ color: 0x3d4a40, roughness: 0.35 }), to.x, to.y - 0.01, -t - 0.075 - OZ, 10)); // the insulator
  const pts = line.getSpacedPoints(48);
  // (what else is overhead now, for what grows out there to keep off)
  pts.span = [...kept, ...spanE.getSpacedPoints(24), ...spanA.getSpacedPoints(16).slice(1)]; // (no point twice: a length of nothing made the distance to the line NaN, and every leaf went)
  for (let x = -10; x <= 18; x += 0.7) pts.span.push(new THREE.Vector3(x, 8.3, z));
  return pts;
}

/** A soft round glow, white at the middle. `stops`: its colour at the middle, a fifth of the way out, and the edge. */
function sunGlowTex(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  [0, 0.2, 1].forEach((at, i) => gr.addColorStop(at, stops[i]));
  x.fillStyle = gr;
  x.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function fence(g, mat, ctx, r0) {
  const HIGH = 1.8, WIDE = 0.14, GAP = 0.012;
  // (2026-10-29: the far side moved out past the pool, its boards as they were; each side carried on from where it ended,
  // the new lengths with their own dice, after the old — the old boards, their shades, leans and knot holes, unchanged.
  // 2026-11-01: past the wood the yard is wider: the east side turns out along `step` to x2, down, and back along the far side)
  const r2 = mulberry32(5311);
  const runs = [
    { a: [YF.x0, YF.z0], b: [YF.x1, YF.z0], inward: [0, 1] }, // the far side
    { a: [Y.x0, -t - 0.06], b: [Y.x0, Y.z0], inward: [1, 0] }, // the west side, to the porch's corner (the porch's side on to the house)
    { a: [Y.x1, Y.z0], b: [Y.x1, Y.z1], inward: [-1, 0] }, // the east side
    { a: [Y.x0, Y.z0], b: [YF.x0, YF.z0], inward: [1, 0], r: r2, first: false }, // and on, past the wood
    { a: [YF.x1, YF.z0], b: [YF.x2, YF.z0], inward: [0, 1], r: r2, first: false }, // the far side, on to the east
    { a: [YF.x2, YF.z0], b: [YF.x2, END], inward: [-1, 0], r: r2 }, // the east side there
    { a: [YF.x2, END], b: [Y.x1, END], inward: [0, -1], r: r2, last: false }, // and back along the step to the old east side
  ];
  const boards = [];
  for (const run of runs) {
    const r = run.r ?? r0;
    const [ax, az] = run.a, [bx, bz] = run.b, len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const n = Math.floor(len / (WIDE + GAP));
    for (let i = 0; i < n; i++) {
      if (r() < 0.012) continue; // one gone here and there
      const s = (i + 0.5) * (WIDE + GAP);
      const b = { x: ax + ux * s, z: az + uz * s, along: Math.atan2(-uz, ux), h: HIGH + (r() - 0.5) * 0.06, lean: (r() - 0.5) * 0.02 + (r() < 0.02 ? 0.12 : 0), wide: 0.93 + r() * 0.1, tint: 0.88 + r() * 0.14, warm: r() * 0.06 };
      // never two in the one plane where they overlap (user, 2026-10-18: "some of the fence's boards glitch as I
      // walk" — leaning, a board crossed its neighbour, the two in the same plane, flickering): a few millimetres
      // apart, one in two or three, and one that leans well over set back behind the others, nailed on behind
      const back = Math.abs(b.lean) > 0.05 ? 0.022 : (i % 3) * 0.003;
      b.x -= run.inward[0] * back;
      b.z -= run.inward[1] * back;
      boards.push(b);
    }
    // posts and two rails, on the yard side
    const inX = run.inward[0] * 0.03, inZ = run.inward[1] * 0.03;
    const posts = Math.ceil(len / 2.3);
    for (let i = 0; i <= posts; i++) {
      if ((i === 0 && run.first === false) || (i === posts && run.last === false)) continue; // (the post there is the old stretch's)
      const s = (i / posts) * len;
      const px = ax + ux * s + inX * 2, pz = az + uz * s + inZ * 2;
      g.add(slab(px - 0.045, px + 0.045, 0, HIGH - 0.05, pz - 0.045, pz + 0.045, mat.rail));
    }
    for (const y of [0.35, 1.42]) {
      const x0 = Math.min(ax, bx) + inX, x1 = Math.max(ax, bx) + inX, z0 = Math.min(az, bz) + inZ, z1 = Math.max(az, bz) + inZ;
      g.add(slab(x0 - (ux ? 0 : 0.02), x1 + (ux ? 0 : 0.02), y, y + 0.09, z0 - (uz ? 0 : 0.02), z1 + (uz ? 0 : 0.02), mat.rail));
    }
    ctx.colliders.push({ type: 'box', x0: Math.min(ax, bx) - 0.05, x1: Math.max(ax, bx) + 0.05, z0: Math.min(az, bz) - 0.05, z1: Math.max(az, bz) + 0.05 });
  }
  const geo = new THREE.BoxGeometry(WIDE, 1, 0.02);
  geo.translate(0, 0.5, 0);
  // each board its own (user, 2026-10-17): one of the texture's eight boards, some turned round, its own
  // width and shade; and here and there one with a knot gone out of it, a hole you can see through, its rim
  // dark (user, 2026-10-18) — the sun's light through it too
  const knotHoles = (sh) => {
    const decl = 'varying vec2 vBoardP;\nvarying vec3 vHole;\n';
    sh.vertexShader = decl + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vBoardP = vec2(position.x * length(instanceMatrix[0].xyz), position.y * length(instanceMatrix[1].xyz)); // across it and up it, in metres
      uint hh = uint(gl_InstanceID) + 13000u; hh ^= hh >> 16u; hh *= 0x7feb352du; hh ^= hh >> 15u; hh *= 0x846ca68bu; hh ^= hh >> 16u;
      float hk = float(hh >> 16u) / 65535.0; // (a hash of which board it is, the same on every machine: ten boards or so)
      vHole = hk < 0.045 ? vec3((fract(hk * 371.0) - 0.5) * 0.06, 0.64 + fract(hk * 917.0) * 0.66, 0.011 + fract(hk * 533.0) * 0.011) : vec3(0.0); // (between the rails, clear of the board's edges)`);
    sh.fragmentShader = decl + sh.fragmentShader.replace('void main() {', `void main() {
      float knotShade = 1.0;
      if (vHole.z > 0.0) {
        vec2 dh = vBoardP - vHole.xy;
        float rr = vHole.z * (1.0 + 0.16 * sin(atan(dh.y, dh.x) * 3.0 + vHole.y * 40.0)), d = length(dh * vec2(1.0, 0.72)); // (longer up the grain, not quite round)
        if (d < rr) discard;
        knotShade = mix(0.42, 1.0, smoothstep(rr, rr * 2.1, d));
      }`);
  };
  const boardMat = mat.fence.clone();
  boardMat.color.setHex(0x9e978a); // (darker: user, 2026-10-19 — weathered, wetted and dried for years)
  boardMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        float board = mod(float(gl_InstanceID) * 5.0 + floor(float(gl_InstanceID) / 8.0) * 3.0, 8.0);
        vec2 bu = vMapUv;
        if (mod(float(gl_InstanceID), 3.0) < 1.0) bu.x = 1.0 - bu.x;
        vMapUv = vec2((bu.x + board) / 8.0, bu.y);
      #endif`);
    knotHoles(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= knotShade;');
  };
  boardMat.customProgramCacheKey = () => 'fence-boards-holes';
  const inst = new THREE.InstancedMesh(geo, boardMat, boards.length);
  inst.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  inst.customDepthMaterial.onBeforeCompile = knotHoles;
  inst.customDepthMaterial.customProgramCacheKey = () => 'fence-holes-depth';
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  boards.forEach((b, i) => {
    e.set(0, b.along, b.lean, 'YXZ');
    q.setFromEuler(e);
    m.compose(p.set(b.x, -0.02, b.z), q, s.set(b.wide, b.h, 1));
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, c.setRGB(b.tint + b.warm, b.tint, b.tint - b.warm));
  });
  inst.castShadow = inst.receiveShadow = true;
  g.add(inst);
}

// the slide's tower, the sandbox (their outsides), the sand's level in it, near enough
const TOWER = { x0: -4.92, x1: -4.18, z0: -6.12, z1: -5.38, deck: 1.22, run: 0.44 }; // run: how far out the ladder's foot stands
const SANDBOX = { x0: -4.65, x1: -2.65, z0: -3.85, z1: -2.15, rim: 0.26, board: 0.045 };
const SAND = 0.2, PIT_FLOOR = -0.14; // (how deep it can be dug: into a pit under the box, below the lawn)
/**
 * Pieces of old wood as one mesh (the porch's: user, 2026-10-20 — "holes, bits missing or gouged, scratches, dents,
 * realistic", then "not a uniform pattern"): each [x0, x1, y0, y1, z0, z1, o], the grain along its longest side.
 * Every piece worn its own amount (`o.wear`, drawn at random from very little to a lot unless given): chunks broken
 * out of its long edges and its ends, paler in them; dents; holes gone deep and dark; splits along the grain; the
 * texture's scratches laid at its own scale and way round. `o.deck`: a board walked on — its top cupped, and where
 * feet go (`rubbed(x, z)`, 0…1) dished, smoothed and worn pale. `o.broken`: [lo, hi] — its ends there snapped off
 * ragged. `o.damp`: [y0, y1] — darker and greener from y0 up to y1. `o.k`: how light it is. `o.chips`: at least
 * that many chips. `o.rot`: turned about its middle. Vertex colours: `mat` must take them; the mesh stays out of the
 * bake (which drops them). `scuff(x, z)`: an attribute `aWear` = [scuffed, rubbed] for the deck's material.
 */
export function wornWood(list, mat, r, rubbed = () => 0, scuff) {
  const geos = [], v = new THREE.Vector3(), q = new THREE.Quaternion();
  const turns = [new THREE.Quaternion(), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)];
  const clamp = (a, lo, hi) => (a < lo ? lo : a > hi ? hi : a);
  for (const [x0, x1, y0, y1, z0, z1, o = {}] of list) {
    const size = [x1 - x0, y1 - y0, z1 - z0], long = size.indexOf(Math.max(...size)), L = size[long];
    const A = long === 1 ? size[0] : size[1], B = long === 2 ? size[0] : size[2]; // across: canonical y and z (x along)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const w = o.wear ?? r() ** 1.6 * 1.6 + 0.15, k = o.k ?? 0.86 + r() * 0.18;
    // `o.round`: its edges rounded off about that far — more here, less there, each edge its own way (user, 2026-10-20:
    // "the edges too perfect") — and its ends (`o.ends` [−x, +x]: not where it stands or meets another piece); a board
    // walked on (`o.deck`) rounded right off along the top where feet go; `o.gnaw`: [{ u0, u1, edges: [[y, z, deep], …] }]
    // — gnawed along that stretch (0…1 of its length), bite after bite out of those edges ([±1, ±1]: which corner; deep:
    // how far at most); `o.step`: how fine along its length (nicks need it fine)
    const cap = Math.min(A, B) * 0.45, base = Math.min(o.round ?? 0, cap), worn = o.deck ? 0.0095 : 0;
    const rad = base ? Math.min(cap, base * 1.6 + worn) : 0, ends = o.ends ?? [true, true], gn = (o.gnaw ?? []).map((s) => [-L / 2 + s.u0 * L, -L / 2 + s.u1 * L, s]);
    const ph = Array.from({ length: 8 }, () => r() * 6.3), fq = [8 + r() * 6, 26 + r() * 14, 70 + r() * 30];
    // `o.weather` (0…1): years out in all weathers — duller and a little greyer (the brown still in it), mottled, streaked
    // darker down from its top edge where rain runs off; `o.drips`: [[x, y, z], …] its nails' heads, a thin dark run down
    // from each. (Its own dice, from where it is: nothing else's wear moves for it)
    const wq = o.weather ? mulberry32((Math.floor((cx * 73.1 + cy * 151.7 + cz * 31.3) * 1000) >>> 0) + 17) : null;
    const wp = wq && Array.from({ length: 5 }, () => wq() * 6.3), wf = wq && [34 + wq() * 22, 90 + wq() * 40, 11 + wq() * 7, 2.2 + wq() * 2.5];
    // (`o.rough`: worn round only here and there along it, sharp between, and jagged — user, 2026-10-28: "the edges of
    // all the porch's boards and posts too rounded off: more irregular")
    const edgeK = (X, j) => {
      const k = 0.4 + 0.6 * (1 + 0.55 * Math.sin(X * fq[0] + ph[j]) + 0.3 * Math.sin(X * fq[1] + ph[j + 4]) + 0.15 * Math.sin(X * fq[2] + ph[j] * 2.3));
      if (!o.rough) return k;
      const patch = Math.max(0, Math.sin(X * fq[0] * 0.55 + ph[(j + 3) % 8] * 1.3) + 0.6 * Math.sin(X * fq[1] * 0.7 + ph[(j + 5) % 8]) + 0.15);
      return 0.12 + k * Math.min(1.6, patch) + 0.45 * Math.abs(Math.sin(X * fq[2] * 1.9 + ph[j] * 3.1)) ** 3;
    };
    // `o.wob`: its long sides not dead straight, in and out by up to that much (the gaps between boards uneven)
    const wob = (X, s) => (o.wob ?? 0) * (0.6 * Math.sin(X * fq[0] * 0.7 + ph[s > 0 ? 2 : 3] * 1.7) + 0.4 * Math.sin(X * fq[1] * 0.5 + ph[s > 0 ? 5 : 6]));
    const xs = [-L / 2], fineAt = (x) => gn.some(([a, b]) => x > a - 0.02 && x < b + 0.02);
    while (xs[xs.length - 1] < L / 2 - 1e-6) xs.push(Math.min(L / 2, xs[xs.length - 1] + (fineAt(xs[xs.length - 1]) ? 0.005 : o.step ?? 0.025)));
    if (xs.length > 3 && L / 2 - xs[xs.length - 2] < 0.004) xs.splice(xs.length - 2, 1);
    if (rad && ends[0] && xs[1] - xs[0] > rad * 1.3) xs.splice(1, 0, -L / 2 + rad);
    if (rad && ends[1] && xs[xs.length - 1] - xs[xs.length - 2] > rad * 1.3) xs.splice(xs.length - 1, 0, L / 2 - rad);
    const nX = xs.length - 1, across = (s) => (o.fine ? (s > 0.05 ? 20 : 10) : rad || gn.length ? (s > 0.05 ? 12 : 8) : s > 0.05 ? 6 : 3), nA = across(A), nB = across(B); // (`o.fine`: finer across, for its marks)
    const geo = new THREE.BoxGeometry(L, A, B, nX, nA, nB);
    const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv, col = [], wear = scuff ? [] : null;
    const an = new Float32Array(P.count * 3), own = new Uint8Array(P.count), wd = new Float32Array(P.count); // (its true normal where rounded; `own`: worked out from the surface instead)
    // its length in steps, finer where it is gnawed; rounded: three steps of each face into each rounded edge
    const sq = (s, h, n) => { const z = 6 / n, u = Math.abs(s) / h; return Math.sign(s) * (u >= 1 - z - 1e-6 ? h - rad + ((u - (1 - z)) / z) * rad : (u / (1 - z)) * (h - rad)); };
    for (let i = 0; i < P.count; i++) {
      let X = xs[Math.round((P.getX(i) + L / 2) / (L / nX))], Yv = P.getY(i), Zv = P.getZ(i);
      if (rad) {
        Yv = sq(Yv, A / 2, nA); Zv = sq(Zv, B / 2, nB);
        let rl = base * edgeK(X, (Yv > 0 ? 0 : 1) + (Zv > 0 ? 0 : 2));
        if (worn && Yv > 0) { v.set(X, Yv, Zv).applyQuaternion(turns[long]); rl += worn * rubbed(v.x + cx, v.z + cz); }
        rl = Math.min(cap, rl);
        const ix = ends[X < 0 ? 0 : 1] ? clamp(X, -L / 2 + rl, L / 2 - rl) : X, iy = clamp(Yv, -A / 2 + rl, A / 2 - rl), iz = clamp(Zv, -B / 2 + rl, B / 2 - rl);
        const dx = X - ix, dy = Yv - iy, dz = Zv - iz, d = Math.hypot(dx, dy, dz);
        if (d > 1e-9) { X = ix + (dx / d) * rl; Yv = iy + (dy / d) * rl; Zv = iz + (dz / d) * rl; an[i * 3] = dx / d; an[i * 3 + 1] = dy / d; an[i * 3 + 2] = dz / d; }
        else { an[i * 3] = N.getX(i); an[i * 3 + 1] = N.getY(i); an[i * 3 + 2] = N.getZ(i); }
      }
      if (o.wob) { wd[i] = (Zv / (B / 2)) * wob(X, Zv); Zv += wd[i]; }
      P.setXYZ(i, X, Yv, Zv);
    }
    const su = (0.75 + r() * 0.6) * (r() < 0.5 ? -1 : 1), sv = (0.7 + r() * 0.6) * (r() < 0.5 ? -1 : 1), ou = r() * 3, ov = r() * 9;
    const faces = [[1, A / 2, B], [1, -A / 2, B], [2, B / 2, A], [2, -B / 2, A]]; // [which axis it faces along, where, how wide across]
    let marks = [];
    const at = () => (r() - 0.5) * L * 0.96;
    // (`o.marks`: how many more dents and chips than its wear gives; `o.dentK`: how deep and dark its dents; `o.nicks`:
    // small nicks out of its edges, so many a metre)
    const mk = o.marks ?? 1, dk = o.dentK ?? 1;
    for (let i = 0, n = Math.round(L * 5 * w * r() * mk); i < n; i++) { const f = faces[o.deck ? (r() < 0.8 ? 0 : 2 + (r() < 0.5 ? 1 : 0)) : Math.floor(r() * 4)]; marks.push({ t: 'dent', f, s: at(), c: (r() - 0.5) * f[2] * 0.6, rad: 0.006 + r() * 0.022, d: (0.0006 + r() * 0.002) * dk, dk }); }
    for (let i = 0, n = Math.max(o.chips ?? 0, Math.round(L * 2.2 * w * r() * mk)); i < n; i++) { const len = 0.015 + r() ** 1.5 * 0.1, s = at(), sy = r() < 0.5 ? 1 : -1, sz = r() < 0.5 ? 1 : -1; marks.push({ t: 'chip', ny: sy / Math.SQRT2, nz: sz / Math.SQRT2, sy, sz, s0: s, s1: s + len, deep: Math.min(0.004 + r() * 0.02 * Math.min(1.4, w), 0.42 * Math.min(A, B)) + base * 0.41, ph: r() * 9 }); }
    for (let i = 0, n = Math.round(L * (o.nicks ?? 0) * (0.6 + 0.8 * r())); i < n; i++) { const len = 0.012 + r() * 0.035, s = at(), sy = o.deck && r() < 0.75 ? 1 : r() < 0.5 ? 1 : -1, sz = r() < 0.5 ? 1 : -1; marks.push({ t: 'chip', nick: true, ny: sy / Math.SQRT2, nz: sz / Math.SQRT2, sy, sz, s0: s, s1: s + len, deep: 0.002 + r() * 0.006 + base * 0.41, ph: r() * 9 }); }
    for (const e of [-1, 1]) if (r() < 0.55 * w || o.broken?.includes(e)) { const hard = o.broken?.includes(e); marks.push({ t: 'end', e, into: hard ? 0.03 + r() * 0.05 : 0.008 + r() * 0.03, sy: r() < 0.5 ? 1 : -1, sz: r() < 0.5 ? 1 : -1, hard, ph: r() * 9 }); }
    for (let i = 0, n = r() < 0.4 * w ? (r() < 0.3 ? 2 : 1) : 0; i < n; i++) { const f = faces[o.deck ? 0 : Math.floor(r() * 4)]; marks.push({ t: 'hole', f, s: at() * 0.9, c: (r() - 0.5) * f[2] * 0.5, rad: 0.004 + r() * 0.011 * Math.min(1.5, w) }); }
    for (let i = 0, n = r() < 0.5 * w ? 1 + Math.floor(r() * 2) : 0; i < n; i++) { const f = faces[o.deck ? 0 : Math.floor(r() * 4)], len = Math.min(L * 0.9, 0.1 + r() * 0.7); marks.push({ t: 'split', f, s0: at() * 0.5 - len / 2, len, c: (r() - 0.5) * f[2] * 0.5, wob: r() * 8, d: 0.002 + r() * 0.003 }); }
    // (`o.holes` false: none of its own — the dice still thrown, so nothing after it moves; `o.knot` [s, c]: where a knot
    // fell out of its top, a shallow dip for the decal laid over it)
    if (o.holes === false) marks = marks.filter((m) => m.t !== 'hole');
    if (o.knot) marks.push({ t: 'dent', f: faces[0], s: o.knot[0], c: o.knot[1], rad: 0.04, d: 0.003, dk: 0.6 });
    if (o.deck && !o.tread) { // a board walked on: knocked about where feet go, less elsewhere (user, 2026-10-20: "too many random scratches, above all where nobody walks")
      const keep = { dent: 0.15, chip: 0.45, hole: 0.5, split: 0.3 };
      marks = marks.filter((m) => m.t === 'end' || m.nick || r() < keep[m.t] + (1 - keep[m.t]) * rubbed(cx + (m.s ?? (m.s0 + (m.s1 ?? m.s0 + m.len)) / 2), cz + (m.c ?? 0)));
    }
    for (const [s0, s1, s] of gn) for (const [ey, ez, deep] of s.edges) { // gnawed: bite after bite along the edge, the deepest in the middle of the stretch
      const bites = [], ny = ey * (s.flat ?? 0.7071), nz = ez * Math.sqrt(1 - (s.flat ?? 0.7071) ** 2);
      for (let b = 0, n = Math.round((s1 - s0) / 0.009); b < n; b++) { const sb = s0 + r() * (s1 - s0), mid = Math.sin((Math.PI * (sb - s0)) / (s1 - s0)); bites.push([sb, 0.006 + r() * 0.012, deep * (0.35 + 0.65 * mid) * (0.7 + r() * 0.3)]); }
      marks.push({ t: 'gnaw', ny, nz, sy: ey, sz: ez, s0: s0 - 0.02, s1: s1 + 0.02, bites });
    }
    for (let i = 0; i < P.count; i++) {
      let X = P.getX(i), Y = P.getY(i), Z = P.getZ(i);
      const n = [Math.abs(N.getX(i)), Math.abs(N.getY(i)), Math.abs(N.getZ(i))], face = n.indexOf(Math.max(...n));
      // the grain along X: across 0.5 m of the texture, along 1 m, at this piece's own scale and way round
      if (face === 1) UV.setXY(i, (Z / 0.5) * su + ou, X * sv + ov); else if (face === 2) UV.setXY(i, (Y / 0.5) * su + ou, X * sv + ov); else UV.setXY(i, (Z / 0.5) * su + ou, Y * sv + ov);
      let c = [k, k, k];
      const pale = (f) => { c = [c[0] * (1 + 0.14 * f), c[1] * (1 + 0.07 * f), c[2] * (1 - 0.04 * f)]; }, dark = (f) => { c = c.map((u) => u * (1 - f)); };
      for (const m of marks) {
        if (m.t === 'chip' || m.t === 'end' || m.t === 'gnaw') { // the corner cut back, ragged (gnawed: in scallops, fresh wood in them)
          let reach = 0;
          if (m.t === 'chip') { const u = (X - m.s0) / (m.s1 - m.s0); if (u <= 0 || u >= 1) continue; reach = m.deep * (1 - Math.abs(2 * u - 1) ** 2.4) * (0.8 + 0.2 * Math.sin(u * 13 + m.ph)); }
          else if (m.t === 'gnaw') { if (X <= m.s0 || X >= m.s1) continue; for (const [sb, rb, db] of m.bites) { const u = (X - sb) / rb; if (u > -1 && u < 1) reach = Math.max(reach, db * Math.sqrt(1 - u * u)); } }
          else { const inn = (L / 2 - X * m.e); if (inn > m.into) continue; reach = (m.hard ? Math.min(A, B) * 0.75 : Math.min(A, B) * 0.4) * (1 - inn / m.into) * (0.75 + 0.25 * Math.sin(Y * 90 + Z * 70 + m.ph)); }
          const ny = m.ny ?? m.sy / Math.SQRT2, nz = m.nz ?? m.sz / Math.SQRT2, cyy = (m.sy * A) / 2, czz = (m.sz * B) / 2, over = (Y - cyy) * ny + (Z - czz) * nz + reach;
          if (over > 0) { Y -= over * ny; Z -= over * nz; own[i] = 1; if (m.t === 'gnaw') { const f = Math.min(1, over / 0.002); c = [c[0] * (1 + 0.6 * f), c[1] * (1 + 0.45 * f), c[2] * (1 + 0.18 * f)]; } else pale(Math.min(1, over / 0.002)); }
          continue;
        }
        const [ax, pos, wide] = m.f, onIt = Math.abs((ax === 1 ? Y : Z - wd[i]) - pos) < 1e-5, acr = ax === 1 ? Z : Y;
        if (!onIt) continue;
        const inward = (dd) => { if (ax === 1) Y -= Math.sign(pos) * dd; else Z -= Math.sign(pos) * dd; own[i] = 1; };
        if (Math.abs(acr) > wide * 0.42) continue; // (marks keep off the edges: the faces there are not theirs alone)
        if (m.t === 'dent') { const qd = Math.hypot(X - m.s, acr - m.c) / m.rad; if (qd < 1) { inward(m.d * (1 - qd * qd)); dark(0.08 * m.dk * (1 - qd)); } }
        else if (m.t === 'hole') { const qd = Math.hypot(X - m.s, (acr - m.c) * 1.2) / m.rad; if (qd < 1) { inward((ax === 1 ? A : B) * 0.7 * Math.min(1, (1 - qd) * 3)); dark(0.75); } else if (qd < 1.9) dark(0.18); }
        else if (m.t === 'split') { const u = (X - m.s0) / m.len; if (u > 0 && u < 1 && Math.abs(acr - (m.c + 0.004 * Math.sin(u * m.wob))) < 0.0018 + 0.0018 * Math.sin(u * Math.PI)) { inward(m.d); dark(0.5); } }
      }
      v.set(X, Y, Z).applyQuaternion(turns[long]);
      const wx = v.x + cx, wz = v.z + cz;
      if (o.deck && N.getY(i) > 0.5) { // a board walked on: its top cupped; where feet go, dished, smooth, pale and faded
        const e = Math.min(1, Math.abs(Z) / (B / 2)), rb = rubbed(wx, wz);
        Y += 0.0016 * e * e * (1 - 0.8 * rb) - 0.0038 * rb * (1 - e * e) * (0.75 + 0.25 * Math.sin(X * 6.5 + ph[1])); // (hollowed a little where feet go, not evenly)
        if (rb > 0) c = [c[0] * (1 + 0.38 * rb), c[1] * (1 + 0.3 * rb), c[2] * (1 + 0.16 * rb)]; // (a lighter brown: user, 2026-10-20 — grey-white wasn't real)
        if (Math.abs(an[i * 3 + 1]) > 0.999) own[i] = 1; // (its top's flat: cupped, dished)
      }
      v.set(X, Y, Z).applyQuaternion(turns[long]).add(new THREE.Vector3(cx, cy, cz));
      P.setXYZ(i, v.x, v.y, v.z);
      if (o.damp && v.y < o.damp[1]) { const f = 1 - Math.max(0, (v.y - o.damp[0]) / (o.damp[1] - o.damp[0])); c = [c[0] * (1 - 0.32 * f), c[1] * (1 - 0.22 * f), c[2] * (1 - 0.3 * f)]; }
      if (wp) { // weathered: duller and a little greyer, mottled; streaked darker where rain runs down it; a rust-dark run under each nail
        const along = v.x + v.z, hy = Math.min(1, Math.max(0, (y1 - v.y) / Math.max(0.05, y1 - y0)));
        const mottle = 0.5 + 0.5 * Math.sin(along * wf[3] + wp[3]) * Math.sin(v.y * 6.3 + wp[4]), W = o.weather * (0.7 + 0.3 * mottle);
        const streak = Math.min(1, Math.max(0, Math.sin(along * wf[0] + wp[0]) + 0.7 * Math.sin(along * wf[1] + wp[1]) + 0.5 * Math.sin(along * wf[2] + wp[2]) - 0.85) / 0.9);
        const prof = long === 1 ? 0.45 + 0.55 * (1 - hy) : 0.75 * (1 - hy) ** 0.6 + 0.35 * hy * hy; // (from its top edge down; on a horizontal board, splashed back up at its foot too)
        c = [c[0] * (1 - 0.19 * W) * (1 + 0.07 * W), c[1] * (1 - 0.08 * W) * (1 + 0.07 * W), c[2] * (1 + 0.07 * W)]; // (a lighter, duller brown: not grey)
        dark(0.36 * W * streak * prof);
        for (const d of o.drips ?? []) { const dx = Math.hypot(v.x - d[0], v.z - d[2]), dy = d[1] - v.y; if (dx < 0.008 && dy > -0.004 && dy < 0.09) dark(0.32 * (1 - dx / 0.008) * (1 - Math.max(0, dy) / 0.09)); }
      }
      col.push(...c);
      if (wear) wear.push(scuff(v.x, v.z), rubbed(v.x, v.z));
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (wear) geo.setAttribute('aWear', new THREE.Float32BufferAttribute(wear, 2));
    geo.computeVertexNormals();
    if (rad) { // rounded: its true normals there, smooth round the edges (where nothing has been knocked out of it)
      const nn = geo.attributes.normal;
      for (let i = 0; i < nn.count; i++) if (!own[i]) { v.fromArray(an, i * 3).applyQuaternion(turns[long]); nn.setXYZ(i, v.x, v.y, v.z); }
    }
    if (o.lean) { // knocked askew: about its foot (`o.lean[2]` 'top': hanging from its top, sprung out at the foot)
      const foot = new THREE.Vector3(cx, o.lean[2] === 'top' ? y1 : y0, cz);
      geo.translate(-foot.x, -foot.y, -foot.z).applyQuaternion(q.setFromAxisAngle(new THREE.Vector3(...o.lean[0]), o.lean[1])).translate(foot.x, foot.y, foot.z);
    }
    if (o.rot) geo.translate(-cx, -cy, -cz).applyQuaternion(o.rot).translate(cx, cy, cz); // (laid at a slope: the handrails)
    geos.push(geo);
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.live = true; // (out of the bake: it drops vertex colours)
  return mesh;
}

/**
 * The porch along the back of the house (user, 2026-10-20: "raise the house, make an old, worn wooden porch";
 * "there is a stair in front of the door"; then: along the kitchen only, four boards less deep, all one wood, a light
 * brown-beige; "really worn": every piece of it worn its own way — wornWood). Level with the house's floor, LIFT
 * over the lawn. Its boards in two or three lengths, joints staggered, two snapped with a piece gone; worn smooth and
 * pale and dished from the back door down to the last step, where everyone has walked for years; a fascia and a
 * skirt of upright boards round it down to the ground, dark through their gaps; posts and a railing round its three
 * open sides — the posts no higher than the rail, the balusters between not one quite like the next, three gone,
 * five gnawed, one knocked askew; steps down to the lawn, a handrail each side ending on a short post. In this frame its front is
 * z = −t, the house wall behind it −t + PORCH; it runs from the yard's west edge to `PX1`.
 */
function porch(g, M, mat, ctx) {
  const zf = -t, zb = -t + PORCH, x0 = Y.x0, x1 = PX1, top = LIFT;
  const grain = T.oldTimberTex(), relief = T.oldTimberTex(true), scratched = T.oldTimberTex(false, true), scratchedRelief = T.oldTimberTex(true, true);
  // (the old timber's grey-brown, lifted to a light brown-beige — user, 2026-10-20; the texture is dark, so more than
  // 1 — and then faded by years of weather towards grey, the brown only in it: "it looks too new")
  const BEIGE = new THREE.Color(2.05, 1.82, 1.5);
  const deckMat = std({ map: grain, bumpMap: relief, bumpScale: 2.2, color: BEIGE, roughness: 0.93, vertexColors: true });
  // the scratches only where shoes scuff it (aWear.x), and the colour faded out of it where they wear it (aWear.y)
  // (user, 2026-10-20: "still too many random scratches, above all where nobody walks"; "the way from the rug to the
  // foot of the steps visibly more worn and faded")
  deckMat.onBeforeCompile = (sh) => {
    sh.uniforms.mapScr = { value: scratched };
    sh.uniforms.bumpScr = { value: scratchedRelief };
    sh.vertexShader = 'attribute vec2 aWear;\nvarying vec2 vWear;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvWear = aWear;');
    const bump = THREE.ShaderChunk.bumpmap_pars_fragment.replace(/texture2D\( bumpMap, (vBumpMapUv[^)]*?) \)\.x/g, 'wornH( $1 )').replace('uniform float bumpScale;', 'uniform float bumpScale;\n\tfloat wornH( vec2 uv ) { return mix( texture2D( bumpMap, uv ).x, texture2D( bumpScr, uv ).x, vWear.x ); }');
    const map = THREE.ShaderChunk.map_fragment.replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', `vec4 sampledDiffuseColor = mix( texture2D( map, vMapUv ), texture2D( mapScr, vMapUv ), vWear.x );
\tsampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, dot( sampledDiffuseColor.rgb, vec3( 0.3, 0.55, 0.15 ) ) * vec3( 1.15, 0.97, 0.76 ), 0.45 * vWear.y );`);
    sh.fragmentShader = 'uniform sampler2D mapScr;\nuniform sampler2D bumpScr;\nvarying vec2 vWear;\n' + sh.fragmentShader.replace('#include <bumpmap_pars_fragment>', bump).replace('#include <map_fragment>', map).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor *= 1.0 - 0.2 * vWear.y; // (worn smooth)');
  };
  deckMat.customProgramCacheKey = () => 'porchDeck';
  const woodMat = std({ map: grain, bumpMap: relief, bumpScale: 1.8, color: BEIGE, roughness: 0.95, vertexColors: true });
  const r = mulberry32(8181);
  const BW = 0.135, GAP = 0.007, TH = 0.028, sx0 = BACK.mid - 0.62, sx1 = BACK.mid + 0.62, RUN = 0.28;
  const steps = Math.max(1, Math.round(LIFT / 0.15)), rise = LIFT / steps, foot = zf - (steps - 1) * RUN;
  // where feet have gone for years: from the back door straight out to the steps and down them, widest in the middle
  // of the way, fading off its sides unevenly
  const rubbed = (x, z) => {
    const half = 0.38 + 0.08 * Math.sin(z * 4.1) + 0.05 * Math.sin(z * 9.3 + 1);
    const d = Math.abs(x - BACK.mid - 0.05 * Math.sin(z * 2.7));
    return Math.max(0, Math.min(1, (half - d) / 0.22)) * (0.75 + 0.25 * Math.sin(x * 11 + z * 5) ** 2);
  };
  const deck = [], rest = [];
  // the deck: rows of boards, each row in lengths, the joints staggered; two snapped, a piece gone between
  const rows = [], board = { deck: true, round: 0.005, nicks: 9, wob: 0.0016, step: 0.015 }; // (their edges worn round, unevenly, and nicked: "too perfect" — user, 2026-10-20)
  for (let z = zb - BW; z > zf - BW; z -= BW + GAP) rows.push(z);
  const brokenRows = [rows[3 + Math.floor(r() * 3)], rows[rows.length - 3 - Math.floor(r() * 2)]];
  for (const z of rows) {
    const za = Math.max(zf - 0.012, z), zz = z + BW, cuts = [x0 - 0.015];
    for (let x = x0 + 0.9 + r() * 1.8; x < x1 - 0.8; x += 1.8 + r() * 1.8) cuts.push(x);
    cuts.push(x1 + 0.015);
    for (let j = 0; j < cuts.length - 1; j++) {
      const a = cuts[j] + 0.003, b = cuts[j + 1] - 0.003, proud = r() < 0.12 ? 0.002 + r() * 0.004 : 0;
      if (brokenRows.includes(z) && j === 0 && b - a > 0.6) { // snapped, a piece gone: the dark under it through the gap
        const m = a + 0.25 + r() * (b - a - 0.5), gap = 0.05 + r() * 0.09;
        deck.push([a, m - gap / 2, top - TH, top, za, zz, { ...board, broken: [1], wear: 1.2 }], [m + gap / 2, b, top - TH, top + proud, za, zz, { ...board, broken: [-1], wear: 1.2 }]);
      } else deck.push([a, b, top - TH, top + proud, za, zz, { ...board }]);
    }
  }
  for (let j = 1; j < steps; j++) { const y = top - j * rise; deck.push([sx0 + 0.03, sx1 - 0.03, y - 0.032, y, zf - j * RUN - 0.015, zf - (j - 1) * RUN + 0.005, { deck: true, tread: true, wear: 1.5 + r() * 0.7, round: 0.01, chips: 5 + Math.floor(r() * 4), marks: 3, dentK: 2.4, nicks: 14, wob: 0.003, step: 0.012, lean: j === 2 ? [[0, 0, 1], 0.0045] : undefined, holes: j === 2 ? false : undefined, knot: j === 2 ? [-0.145, 0.01] : undefined }]); } // the treads (dented and nicked all over: user, 2026-10-20; the second from the top a little down at its west end, 2026-10-28)
  // some boards gnawed along their sides (user, 2026-10-20), out of the way of feet: by the railing and the ends
  const gnawable = deck.filter(([a, b, , , za, zz, o]) => o.deck && za > zf - 0.02 && b - a > 0.7 && rubbed((a + b) / 2, (za + zz) / 2) < 0.15);
  for (let n = 0; n < 5 && gnawable.length; n++) {
    const [a, b, , , za, , o] = gnawable.splice(Math.floor(r() * gnawable.length), 1)[0], len = 0.07 + r() * 0.16, u0 = 0.06 + r() * (0.88 - len / (b - a));
    const side = za < zf + 0.01 ? -1 : r() < 0.5 ? 1 : -1; // (the front board: on its outer side)
    o.gnaw = [{ u0, u1: u0 + len / (b - a), edges: [[1, side, 0.018 + r() * 0.014]], flat: 0.42 }];
    if (r() < 0.4) o.gnaw.push({ u0: Math.min(0.9, u0 + len / (b - a) + 0.05 + r() * 0.1), u1: Math.min(0.97, u0 + len / (b - a) + 0.12 + r() * 0.12), edges: [[1, side, 0.01 + r() * 0.01]], flat: 0.42 });
  }
  // where shoes scuff it: the way from the door down the steps above all; by the mat; a little at the head of the
  // steps and where the hose is pulled about by the tap; elsewhere hardly at all
  const blob = (x, z, a, b, sx, sz) => Math.exp(-(((x - a) / sx) ** 2) - ((z - b) / sz) ** 2);
  const walked = (x, z) => (z < zf ? 0.9 * rubbed(x, zf) : rubbed(x, z));
  // (and here and there all over it, where a chair stood, something was dragged: user, 2026-10-20)
  const rs = mulberry32(8282), spots = Array.from({ length: 10 }, () => [x0 + rs() * (x1 - x0), zf + rs() * (zb - zf), 0.1 + rs() * 0.25, 0.2 + rs() * 0.3, rs() * 3]);
  const scuff = (x, z) => Math.min(1, 1.15 * walked(x, z) + (z < zf ? 0.4 : 0) + 0.45 * blob(x, z, BACK.mid, zb - 0.4, 0.75, 0.3) + 0.3 * blob(x, z, BACK.x0 - 1.12, zb - 0.35, 0.45, 0.35) + spots.reduce((s, [a, b, rr, k, an]) => s + k * blob(x, z, a, b, rr * (1 + 0.6 * Math.cos(an)), rr * (1 + 0.6 * Math.sin(an))), 0) + 0.05);
  // the edges of everything on the porch worn round less, and unevenly: here round, there sharp, nicked and jagged
  // (user, 2026-10-28: "the corners and edges of all the porch's boards and posts too rounded off: more irregular")
  const roughened = new WeakSet(), roughen = (list) => { for (const p of list) { const o = p[6] ?? (p[6] = {}); if (roughened.has(o)) continue; roughened.add(o); o.round = o.round ? o.round * 0.6 : 0.003; o.rough = true; o.nicks = (o.nicks ?? 3) * 1.5 + 4; } };
  roughen(deck);
  // the second step down on its own, for the knot gone out of it (user, 2026-10-28: "move this hole a bit to the right and
  // make it better" — to the west, as he stood: a dent the dice had made in the middle of it, crumpled; now a knot hole)
  const knotStep = deck.findIndex((p) => p[6].knot), step2 = deck.splice(knotStep, 1);
  g.add(wornWood(deck, deckMat, r, walked, scuff));
  const step2Mesh = wornWood(step2, deckMat, mulberry32(8787), walked, scuff);
  g.add(step2Mesh);
  projectDecal(step2Mesh, { at: [(sx0 + sx1) / 2 - 0.145, zf - 1.5 * RUN - 0.005 + 0.01], size: [0.125, 0.078], map: T.knotHoleTex(), lift: 0.0006, roughness: 0.95 });
  // the fascia round its edge, and the skirt under it down to the ground, set back a little behind it: upright
  // boards, gaps between, dark behind
  // (FO: the fascia stands that far proud of the posts — their outer faces were in one plane with its, and the corner
  // flickered as you walked: user, 2026-10-28; the front in two lengths, the west one dropped a little at the joint)
  // the boards round its foot — the fascia, the skirt and what it is nailed to, the steps' risers and sides — in wood
  // gone old out in the weather (user, 2026-10-28: "too perfect, they look new"): their own picture of it, and their own dice
  const base = [], baseMat = std({ map: T.oldTimberTex(false, false, true), bumpMap: T.oldTimberTex(true, false, true), bumpScale: 2.6, color: BEIGE, roughness: 0.97, vertexColors: true });
  const FH = 0.2, under = top - TH - FH, FO = 0.005, joint = sx0 - 1.15, nails = [];
  const nailAt = (p, out, lean, pivot) => { // a nail's head on a board's face at p (outwards: `out`), turned with the board
    if (lean) p.sub(pivot).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...lean[0]), lean[1])).add(pivot);
    nails.push([p.addScaledVector(out, 0.0004), out]);
  };
  // (and old boards, like the rest — user, 2026-10-28: "too perfect, they look new": their edges worn round unevenly,
  // knocked and nicked, split along the grain, a knot gone; gone dull and streaked with the rain off the deck, darker
  // along the foot where the wet sits; nailed to the joists' ends every 40 cm or so, a rust run under each nail.
  // From their own dice, `rf`)
  const rf = mulberry32(8585);
  const fascia = (b0, b1, y0, y1, along, face) => {
    const o = { k: 0.8 * (0.9 + rf() * 0.12), weather: 1, wear: 2.2 + rf() * 0.6, round: 0.006 + rf() * 0.005, nicks: 12 + rf() * 6, chips: 4 + Math.floor(rf() * 4), marks: 3, dentK: 2, wob: 0.0018, step: 0.012, damp: [y0 - 0.01, y0 + 0.07], drips: [] };
    const out = along === 'x' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(along === 'w' ? -1 : 1, 0, 0);
    for (let a = b0 + 0.12 + rf() * 0.2; a < b1 - 0.08; a += 0.38 + rf() * 0.06) for (const yy of [y1 - 0.035 - rf() * 0.01, y0 + 0.035 + rf() * 0.01]) {
      const p = along === 'x' ? new THREE.Vector3(a + (rf() - 0.5) * 0.02, yy, face) : new THREE.Vector3(face, yy, a + (rf() - 0.5) * 0.02);
      o.drips.push(p.toArray());
      nailAt(p, out);
    }
    base.push(along === 'x' ? [b0, b1, y0, y1, face, face + 0.025, o] : along === 'w' ? [face, face + 0.025, y0, y1, b0, b1, o] : [face - 0.025, face, y0, y1, b0, b1, o]);
  };
  fascia(x0 - 0.02 - FO, joint - 0.0015, under - 0.005, top - TH - 0.005, 'x', zf - FO);
  fascia(joint + 0.0015, x1 + 0.02 + FO, under, top - TH, 'x', zf - FO);
  fascia(zf + 0.025 - FO, zb, under, top - TH, 'w', x0 - FO);
  fascia(zf + 0.025 - FO, zb, under, top - TH, 'e', x1 + FO);
  // the skirt (user, 2026-10-28: "the porch a little more ramshackle"; then "a good idea, but now they seem to float,
  // not fixed to the porch"): upright boards nailed at the top to a rail behind the fascia — their tops go on up behind
  // it — and low down to a kicker along the ground, the frame showing through the gaps. Years in the wet: feet rotted
  // ragged and green, a few off the ground; edges knocked, chipped and nicked, split; none quite plumb, one or two pulled
  // a little off the kicker at the foot (nails gone); neighbours never in one plane (where two overlapped, their faces
  // flickered). What is new draws from its own dice (`rk`): the posts, rails and balusters drawn after stay where they were
  const rk = mulberry32(8383);
  const skirt = (a0, a1, along) => {
    const out = along === 'x' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(along === 'w' ? -1 : 1, 0, 0);
    for (let a = a0, n = 0; a < a1 - 0.03; a += 0.115 + r() * 0.03, n++) {
      const w = Math.min(0.1 + r() * 0.02, a1 - a), lo0 = r() < 0.15 ? 0.04 + r() * 0.05 : 0, k = 0.7 + r() * 0.2, dampTop = 0.3 + r() * 0.15;
      const rotten = rk() < 0.35, rottedAway = rotten && rk() < 0.25; // (a few rotted away at the foot, a few centimetres)
      const lo = rottedAway ? 0.035 + rk() * 0.035 : rotten ? 0.004 + rk() * 0.02 : lo0 ? 0.006 + rk() * 0.012 : -0.008, hi = under + 0.03;
      const back = (n % 2) * 0.003 + rk() * 0.0015, loose = rk() < 0.07, tip = loose ? 0.02 + rk() * 0.022 : (rk() - 0.5) * 0.012, across = (rk() - 0.5) * 0.014;
      const turn = along === 'x' ? new THREE.Vector3(tip, 0, across) : new THREE.Vector3(across, 0, along === 'w' ? -tip : tip); // (tip: about its top, the foot outwards)
      const o = { k: k * (0.8 + rk() * 0.24), damp: [0, dampTop + 0.16], wear: 2 + rk() * 1.2, round: 0.007 + rk() * 0.007, nicks: 14 + rk() * 12, chips: 4 + Math.floor(rk() * 5), marks: 3.5, dentK: 2.2, step: 0.016, lean: [turn.clone().normalize().toArray(), turn.length(), 'top'], weather: 1, drips: [] };
      if (rotten || rk() < 0.2) o.broken = [-1];
      const face = along === 'x' ? zf + 0.008 + back : along === 'w' ? x0 + 0.008 + back : x1 - 0.008 - back;
      const box = (b0, b1, y0, y1) => (along === 'x' ? [b0, b1, y0, y1, face, face + 0.018] : along === 'w' ? [face, face + 0.018, y0, y1, b0, b1] : [face - 0.018, face, y0, y1, b0, b1]);
      const pivot = along === 'x' ? new THREE.Vector3(a + w / 2, hi, face + 0.009) : new THREE.Vector3(face + (along === 'w' ? 0.009 : -0.009), hi, a + w / 2);
      const nail = (u, y) => { const p = along === 'x' ? new THREE.Vector3(a + u * w, y, face) : new THREE.Vector3(face, y, a + u * w); o.drips.push(p.toArray()); nailAt(p, out, o.lean, pivot); };
      for (const u of w > 0.085 ? [0.27, 0.73] : [0.5]) { nail(u + (rk() - 0.5) * 0.08, under - 0.022 - rk() * 0.008); if (!loose && lo < 0.05) nail(u + (rk() - 0.5) * 0.08, 0.072 + rk() * 0.012); }
      if (rk() < 0.08 && w > 0.09) { // split down its length, the crack opened up, one half a little shorter
        const m = a + w * (0.4 + rk() * 0.2), gap = 0.004 + rk() * 0.005;
        base.push([...box(a, m - gap / 2, lo, hi), o], [...box(m + gap / 2, a + w, lo + rk() * 0.02, hi), { ...o, lean: [o.lean[0], o.lean[1] + (rk() - 0.5) * 0.006, 'top'] }]); // (never touching: in one plane they'd flicker)
      } else base.push([...box(a, a + w, lo, hi), o]);
    }
  };
  skirt(x0 + 0.03, x1 - 0.03, 'x');
  skirt(zf + 0.03, zb, 'w');
  skirt(zf + 0.03, zb, 'e');
  // what they are nailed to: a rail along the top, behind the fascia's foot, and a kicker along the ground
  for (const [y0, y1] of [[under - 0.05, under + 0.02], [0.03, 0.12]]) {
    base.push([x0 + 0.09, x1 - 0.09, y0, y1, zf + 0.034, zf + 0.072, { k: 0.66, damp: [0, 0.2], round: 0.006, weather: 0.8 }]);
    base.push([x0 + 0.034, x0 + 0.072, y0, y1, zf + 0.09, zb - 0.01, { k: 0.66, damp: [0, 0.2], round: 0.006, weather: 0.8 }]);
    base.push([x1 - 0.072, x1 - 0.034, y0, y1, zf + 0.09, zb - 0.01, { k: 0.66, damp: [0, 0.2], round: 0.006, weather: 0.8 }]);
  }
  g.add(Object.assign(slab(x0 + 0.04, x1 - 0.04, 0, top - TH - 0.004, zf + 0.04, zb - 0.01, new THREE.MeshBasicMaterial({ color: 0x0b0907 })), { castShadow: false })); // the dark under it
  // posts, no higher than the rail they carry, and the railing round three sides: a gap at the head of the steps
  // (their edges and the stairs', the handrails', worn round, knocked here and there — user, 2026-10-20)
  const RAIL = 0.9, PS = 0.09, post = (x, z, h) => rest.push([x, x + PS, 0, h, z, z + PS, { damp: [0, 0.3 + r() * 0.15], k: 0.82 + r() * 0.12, round: 0.013 + r() * 0.005, ends: [false, true], chips: 1 + Math.floor(r() * 3) }]);
  const front = [x0, x1 - PS, sx0 - PS, sx1];
  for (const x of front) post(x, zf, top + RAIL);
  for (const x of [x0, x1 - PS]) post(x, zb - PS, top + RAIL);
  const railRun = (a0, a1, side, gone = [], gnawed = []) => { // top rail, bottom rail, balusters between; side: 'f' along the front, 'w'/'e' down the ends
    const piece = (a, b, y0, y1, d0, d1, o) => rest.push(side === 'f' ? [a, b, y0, y1, zf + d0, zf + d1, o] : [side === 'w' ? x0 + d0 : x1 - d1, side === 'w' ? x0 + d1 : x1 - d0, y0, y1, a, b, o]);
    piece(a0, a1, top + RAIL - 0.04, top + RAIL, 0, PS, { round: 0.01, ends: [false, false], chips: 1 + Math.floor(r() * 2) });
    piece(a0, a1, top + 0.08, top + 0.12, 0.025, 0.065, { k: 0.8 });
    // the balusters: not one quite like the next — each its own width and set, some a little thinner where they
    // have worn, a hand's gap one place and a tighter one the next, standing not quite plumb; `gone` of them
    // missing and `gnawed` gnawed, here and there along it (user, 2026-10-20) — none of them inside a post
    const bal = [];
    for (let a = a0 + 0.06 + r() * 0.03; a < a1 - 0.05; a += 0.1 + r() * 0.035) if (side !== 'f' || !front.some((p) => a + 0.045 > p - 0.01 && a < p + PS + 0.01)) bal.push(a);
    const taken = [], pick = (xs) => xs.map((x) => { let j = -1; bal.forEach((a, i) => { if (!taken.includes(i) && (j < 0 || Math.abs(a - x) < Math.abs(bal[j] - x))) j = i; }); taken.push(j); return j; });
    const holes = pick(gone), chewed = pick(gnawed);
    bal.forEach((a, j) => {
      const qq = r();
      if (holes.includes(j)) return;
      const bw = 0.03 + r() * 0.012, bd = 0.03 + r() * 0.01, mid = 0.045 + (r() - 0.5) * 0.008, sag = (r() - 0.5) * 0.004;
      const tilt = (qq > 0.985 ? 0.06 : (r() - 0.5) * 0.018) + (rk() - 0.5) * 0.022; // (one knocked askew; the rest only out of true — more so since 2026-10-28)
      const o = { k: 0.78 + r() * 0.2, lean: [side === 'f' ? [0, 0, 1] : [1, 0, 0], tilt] };
      if (chewed.includes(j)) { // gnawed: low down mostly, a stretch or two, round three or four of its corners
        o.gnaw = [];
        for (let n = 0, m = r() < 0.4 ? 2 : 1; n < m; n++) {
          const u0 = n ? 0.45 + r() * 0.3 : 0.03 + r() * 0.3, len = 0.08 + r() * 0.16, deep = 0.011 + r() * 0.008;
          o.gnaw.push({ u0, u1: Math.min(0.97, u0 + len), edges: [[1, 1], [1, -1], [-1, 1], [-1, -1]].filter(() => r() < 0.8).map(([y, z]) => [y, z, deep * (0.6 + r() * 0.6)]) });
        }
      }
      piece(a, a + bw, top + 0.12 + sag, top + RAIL - 0.04 + (r() < 0.2 ? -0.004 : 0), mid - bd / 2, mid + bd / 2, o);
    });
  };
  // (left and right as you look out at the trees: two gone and two gnawed east of the steps, one gone and three
  // gnawed west of them, the one gone about midway — user, 2026-10-20)
  railRun(x0 + PS, sx0 - PS, 'f', [-4.15], [-4.89, -4.64, -3.59]);
  railRun(sx1 + PS, x1 - PS, 'f', [-1.11, -1.59], [-0.43, -1.21]);
  railRun(zf + PS, zb - PS, 'w');
  railRun(zf + PS, zb - PS, 'e');
  // the steps: risers, the treads (above) on stepped stringers — and on the stringers' outsides, nailed on, upright
  // boards to the height of each tread (user, 2026-10-28: "by the boards at the sides of the steps I meant these"; "much
  // more worn and uneven, lived-in wood, realistic; a board is missing"): two or three to a step, gaps between, each its
  // own — knocked and chewed round its edges, split, dented, its foot gone dark and green and rotted ragged, its top
  // not quite level, hanging a hair out of true from its nails; never two in one plane. One gone: on the east side
  // (left of the steps as you look at the house from the yard), the front one under the second tread — the stringer
  // behind it showing
  const laid = { [-1]: 0, [1]: 0 };
  for (let j = 1; j < steps; j++) {
    const y = top - j * rise, z0 = zf - j * RUN, z1 = zf - (j - 1) * RUN, last = j === steps - 1;
    base.push([sx0 + 0.04, sx1 - 0.04, last ? 0 : y - rise + 0.004, y - 0.033, z0 + 0.01, z0 + 0.03, { k: 0.78, round: 0.008, marks: 2.6, dentK: 2, nicks: 12, step: 0.012, damp: last ? [0, 0.2] : undefined, weather: 0.9 }]); // its riser (the last down to the lawn: a second one stood in the same place, and their faces flickered)
    g.add(Object.assign(slab(sx0 + 0.06, sx1 - 0.06, 0, y - 0.036, z0 + 0.035, z1 - 0.002, new THREE.MeshBasicMaterial({ color: 0x0b0907 })), { castShadow: false })); // the dark under the treads
    for (const x of [sx0, sx1 - 0.05]) { // the stringer, set in behind the boards
      const chips = 1 + Math.floor(r() * 2), x0s = x === sx0 ? sx0 + 0.024 : x, x1s = x === sx0 ? sx0 + 0.05 : sx1 - 0.024;
      base.push([x0s, x1s, 0, y - 0.033, z0, z1, { k: 0.6, damp: [0, 0.3], round: 0.006, ends: [false, true], chips, marks: 1.6, dentK: 1.8, nicks: 6, step: 0.015, weather: 0.8 }]);
    }
    for (const side of [-1, 1]) {
      const two = rk() < 0.5, n = last ? 3 : two ? 2 : 3, cuts = [z0]; // (the last step's three: narrower than they are tall, their grain up and down like the rest)
      for (let i = 1; i < n; i++) cuts.push(z0 + (RUN * (i + (rk() - 0.5) * 0.35)) / n);
      cuts.push(z1);
      for (let i = n - 1; i >= 0; i--) { // (from the porch out to the foot: each a hair further out or in than the one before, never in one plane)
        const d = (laid[side]++ % 2) * 0.002 + rk() * 0.001;
        if (side > 0 && j === 2 && i === 0) continue; // (the one gone)
        const za = cuts[i] + (i ? 0.002 + rk() * 0.004 : 0), zz = cuts[i + 1] - (i < n - 1 ? 0.002 + rk() * 0.004 : 0);
        const face = side < 0 ? sx0 + d : sx1 - d, rotten = rk() < 0.4, lo = rotten ? 0.003 + rk() * 0.02 : -0.01, hi = y - 0.006 - (rk() < 0.3 ? rk() * 0.014 : 0);
        const turn = new THREE.Vector3((rk() - 0.5) * 0.016, 0, side * (rk() - 0.5) * 0.01), out = new THREE.Vector3(side, 0, 0);
        const o = { k: 0.74 * (0.8 + rk() * 0.25), damp: [0, 0.3 + rk() * 0.14], wear: 2.2 + rk() * 1.2, round: 0.007 + rk() * 0.007, chips: 4 + Math.floor(rk() * 5), marks: 3.5, dentK: 2.4, nicks: 16 + rk() * 10, step: 0.012, lean: [turn.clone().normalize().toArray(), turn.length(), 'top'], weather: 1, drips: [], fine: true };
        if (rotten) o.broken = [-1];
        base.push([side < 0 ? face : face - 0.02, side < 0 ? face + 0.02 : face, lo, hi, za, zz, o]);
        const pivot = new THREE.Vector3(face - side * 0.01, hi, (za + zz) / 2);
        for (const u of zz - za > 0.085 ? [0.28, 0.72] : [0.5]) for (const yy of [hi - 0.035 - rk() * 0.01, 0.06 + rk() * 0.015]) if (yy > lo + 0.02) { const p = new THREE.Vector3(face, yy, za + (u + (rk() - 0.5) * 0.08) * (zz - za)); o.drips.push(p.toArray()); nailAt(p, out, o.lean, pivot); }
      }
    }
  }
  // the handrails: from the porch's post down to a short post at the foot, which ends where the rail does
  const handY = rise + RAIL - 0.02;
  for (const x of [sx0 - PS, sx1]) {
    post(x, foot - PS, handY + 0.02);
    const a = new THREE.Vector3(x + PS / 2, top + RAIL - 0.02, zf + PS / 2), b = new THREE.Vector3(x + PS / 2, handY, foot - PS / 2), len = a.distanceTo(b), m = a.clone().add(b).multiplyScalar(0.5);
    rest.push([m.x - 0.03, m.x + 0.03, m.y - 0.02, m.y + 0.02, m.z - len / 2, m.z + len / 2, { round: 0.014, chips: 2 + Math.floor(r() * 2), k: 0.9, rot: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize()) }]);
    ctx.colliders.push({ type: 'seg', ax: x + PS / 2, az: foot - PS, bx: x + PS / 2, bz: zf, r: 0.06, top: top + RAIL }); // (no getting onto the steps over their sides)
  }
  roughen(base);
  roughen(rest);
  g.add(wornWood(base, baseMat, mulberry32(8686)));
  g.add(wornWood(rest, woodMat, r));
  // the nails' heads, gone dark with rust
  const nailMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.003, 0.0033, 0.003, 7), std({ color: 0x3b332c, metalness: 0.45, roughness: 0.62 }), nails.length), m4 = new THREE.Matrix4(), qn = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  nails.forEach(([p, n], i) => nailMesh.setMatrixAt(i, m4.compose(p, qn.setFromUnitVectors(up, n), one)));
  nailMesh.receiveShadow = true;
  g.add(nailMesh);
  // in your way, and to stand on: the porch (walked onto from its steps; the hose lies on it and over its edge),
  // the steps (each a stair, player.js `step`), the railing round it (the hose goes round it)
  ctx.colliders.push({ type: 'box', x0, x1, z0: zf, z1: zb + 0.05, top, stand: true, step: true, surface: 'wood', over: true });
  for (let j = 1; j < steps; j++) ctx.colliders.push({ type: 'box', x0: sx0 + 0.03, x1: sx1 - 0.03, z0: zf - j * RUN, z1: zf, top: top - j * rise, stand: true, step: true, surface: 'wood' });
  for (const [a, b, c, d] of [[x0, sx0, zf, zf + 0.08], [sx1, x1, zf, zf + 0.08], [x0, x0 + 0.08, zf, zb], [x1 - 0.08, x1, zf, zb]]) ctx.colliders.push({ type: 'box', x0: a, x1: b, z0: c, z1: d, base: top, top: top + RAIL });
}

/** A point in this frame, moved to where it is in the world (the house's). */
const toWorld = (v) => v.set(v.x, v.y + OY, v.z + OZ);
/** How far outside the box x0–x1, z0–z1 the point x, z is (inside: how far in, negative). */
const outside = (x, z, b) => Math.max(b.x0 - x, x - b.x1, b.z0 - z, z - b.z1);

/**
 * The slide (user, 2026-10-18: "redo the slide: it's metal and it has a bend, a wooden ladder"): a tower of
 * old weathered timber — four posts, a deck of boards, a rail round two sides — a wooden ladder up its north
 * side, and off its east side a stainless steel chute that turns through a quarter circle as it comes down
 * and runs out south into the sandbox. The sandbox: bigger (2 × 1.7 m), boards gone grey, a ledge to sit on
 * along the house's side; the sand a surface of its own, uneven, that the spade digs into; the spade stuck in
 * it (the bucket gone).
 */
/**
 * A post or a board of old timber, x0…x1 by y0…y1 by z0…z1 (as `slab`): its edges rounded off by the years, the
 * grain of `oldTimberTex` along its length, each one from its own part of the wood (`seed`).
 */
function timber(x0, x1, y0, y1, z0, z1, mat, seed) {
  const size = [x1 - x0, y1 - y0, z1 - z0], long = size.indexOf(Math.max(...size));
  const geo = new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(0.007, Math.min(...size) * 0.3));
  const r = mulberry32(seed * 7 + 3), ou = r(), ov = r() * 7;
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, p = [0, 0, 0], n = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    p[0] = pos.getX(i); p[1] = pos.getY(i); p[2] = pos.getZ(i);
    n[0] = Math.abs(nor.getX(i)); n[1] = Math.abs(nor.getY(i)); n[2] = Math.abs(nor.getZ(i));
    const face = n.indexOf(Math.max(...n)), along = face === long ? (long + 1) % 3 : long, across = 3 - face - along;
    uv.setXY(i, p[across] / 0.5 + ou, p[along] / 1.0 + ov); // (the texture: 0.5 m across, the grain 1 m down it)
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function slideAndSandbox(g, M, mat, ctx, hoseOnly) {
  const T0 = TOWER, D = T0.deck;
  // ---- the tower (user, 2026-10-18: "worn", then "make the tower's wood worn"): old timber gone silver-grey,
  // its grain standing up in ridges, split along it, its edges rounded off (`timber`); the posts dark and green
  // at the foot where the wet gets them, rusty bolts through the rails and the ladder, the treads and the deck
  // by the ladder's top rubbed pale by shoes, the top rail by hands
  const grain = T.oldTimberTex(), relief = T.oldTimberTex(true);
  const old = std({ map: grain, bumpMap: relief, bumpScale: 1.8, roughness: 0.97 });
  const rusty = std({ color: 0x7a4426, roughness: 0.82, metalness: 0.35 });
  const damp = std({ map: grain, bumpMap: relief, bumpScale: 1.8, color: 0xa3ad88, roughness: 1 }); // (darker and greener than the rest, not black)
  const rubbed = std({ map: grain, color: 0xe9e0d0, roughness: 0.82 });
  let seed = 1;
  const wood = mat.weathered, part = (x0, x1, y0, y1, z0, z1, m = old) => timber(x0, x1, y0, y1, z0, z1, m, seed++); // (`wood`: the sandbox's boards, as they were)
  const bolt = (x, y, z, ax) => { const b = cyl(0.011, 0.011, 0.008, rusty, x, y, z, 6); if (ax === 'x') b.rotation.z = Math.PI / 2; else b.rotation.x = Math.PI / 2; g.add(b); };
  const posts = [[T0.x0, T0.z0], [T0.x1 - 0.09, T0.z0], [T0.x0, T0.z1 - 0.09], [T0.x1 - 0.09, T0.z1 - 0.09]];
  posts.forEach(([x, z], i) => {
    const foot = 0.22 + ((i * 0.37) % 0.15); // (not all alike)
    g.add(part(x, x + 0.09, -0.05, D + 0.6 - (i === 1 ? 0.012 : 0), z, z + 0.09)); // (one sawn a little short)
    g.add(part(x - 0.001, x + 0.091, -0.05, foot, z - 0.001, z + 0.091, damp)); // (the wet in it, over its foot)
  });
  for (const z of [T0.z0 + 0.09, T0.z1 - 0.135]) g.add(part(T0.x0 + 0.09, T0.x1 - 0.09, D - 0.028 - 0.12, D - 0.028, z, z + 0.045)); // the joists
  for (let i = 0; i < 5; i++) { // the deck: five boards, gaps between, one a little proud
    const w = (T0.z1 - T0.z0 - 4 * 0.012) / 5, z = T0.z0 + i * (w + 0.012);
    g.add(part(T0.x0 - 0.01, T0.x1 + 0.01, D - 0.028, D + (i === 3 ? 0.003 : 0), z, z + w));
  }
  g.add(part(T0.x0 + 0.12, T0.x1 - 0.14, D + 0.0002, D + 0.0012, T0.z0 + 0.004, T0.z0 + 0.12, rubbed)); // where you step off the ladder
  for (const y of [D + 0.02, D + 0.3, D + 0.56]) { // the rail: boards round the west and the south, bolted to the posts
    g.add(part(T0.x0 - 0.025, T0.x0, y, y + 0.09, T0.z0, T0.z1));
    g.add(part(T0.x0, T0.x1, y, y + 0.09, T0.z1, T0.z1 + 0.025));
    for (const z of [T0.z0 + 0.045, T0.z1 - 0.045]) bolt(T0.x0 - 0.028, y + 0.045, z, 'x');
    for (const x of [T0.x0 + 0.045, T0.x1 - 0.045]) bolt(x, y + 0.045, T0.z1 + 0.028, 'z');
  }
  // the ladder: two stringers leaning on the north joist, four treads, flat, between them; the deck the last step
  const lad = new THREE.Group(), cx = (T0.x0 + T0.x1) / 2, rise = D - 0.06, lean = Math.atan2(T0.run, rise), long = Math.hypot(rise, T0.run);
  lad.position.set(cx, 0, T0.z0 - T0.run - 0.035);
  lad.rotation.x = lean; // (its y up the ladder)
  g.add(lad);
  for (const x of [-0.255, 0.22]) lad.add(part(x, x + 0.035, -0.04, long + 0.02, -0.035, 0.075));
  for (let k = 1; k <= 4; k++) {
    const y = (D * k) / 5 / Math.cos(lean), tread = part(-0.22, 0.22, -0.0125, 0.0125, -0.055, 0.055);
    tread.position.set(0, y, 0.02);
    tread.rotation.x = -lean + (k === 2 ? 0.035 : 0); // flat (the second a little off: a nail gone)
    tread.add(part(-0.12, 0.12, 0.0122, 0.0132, -0.042, 0.042, rubbed)); // rubbed pale by shoes
    for (const x of [-0.262, 0.262]) { const b = cyl(0.01, 0.01, 0.008, rusty, x, 0, 0, 6); b.rotation.z = Math.PI / 2; tread.add(b); } // its bolts, through the stringers
    lad.add(tread);
  }
  for (const x of [-0.24, 0.235]) lad.add(slab(x, x + 0.03, long - 0.02, long + 0.06, 0.075, 0.082, rusty)); // the hooks over the joist at its top, rusted
  // you climb it (user, 2026-10-18: "you can go up the slide"): the deck is a floor up there, nothing under it to
  // walk into; the rail round two sides and the posts hold you on it; the ladder (player.js: a leaning one) takes
  // you up from its foot onto the deck, and stops you walking through it down here
  ctx.colliders.push({ type: 'box', x0: T0.x0, x1: T0.x1, z0: T0.z0, z1: T0.z1, top: D, stand: true, surface: 'wood' });
  ctx.colliders.push({ type: 'box', x0: T0.x0 - 0.03, x1: T0.x0 + 0.03, z0: T0.z0, z1: T0.z1, base: D, top: D + 0.65 }); // the rail, west
  ctx.colliders.push({ type: 'box', x0: T0.x0, x1: T0.x1, z0: T0.z1 - 0.03, z1: T0.z1 + 0.03, base: D, top: D + 0.65 }); // and south
  for (const [x, z] of posts) ctx.colliders.push({ type: 'box', x0: x, x1: x + 0.09, z0: z, z1: z + 0.09 });
  ctx.colliders.push({ type: 'box', x0: cx - 0.27, x1: cx + 0.27, z0: T0.z0 - T0.run - 0.08, z1: T0.z0, top: 0.25, hose: false });
  hoseOnly.push({ type: 'box', x0: cx - 0.27, x1: cx + 0.27, z0: T0.z0 - T0.run - 0.08, z1: T0.z0 }); // (the hose goes round the ladder, not over it)
  ctx.ladders.push({ x: cx, z: T0.z0, nx: 0, nz: 1, half: 0.2, depth: T0.run + 0.6, top: D, out0: T0.run + 0.28, lean: (T0.run + 0.07) / D, over: 0.45 });

  // ---- the chute: off the deck heading east, a quarter turn to the south, down and out over the sandbox
  const xs = T0.x1 - 0.05, zc = (T0.z0 + T0.z1) / 2, A = 0.14, Rc = 0.72, arc = (Math.PI / 2) * Rc, B = 0.88, RUN = 0.6, S = A + arc + B + RUN;
  const plan = (s) => { // where its middle line is, s along it, and which way it heads: [x, z, hx, hz]
    if (s <= A) return [xs + s, zc, 1, 0];
    if (s <= A + arc) { const psi = (s - A) / Rc; return [xs + A + Rc * Math.sin(psi), zc + Rc - Rc * Math.cos(psi), Math.cos(psi), Math.sin(psi)]; }
    return [xs + A + Rc, zc + Rc + (s - A - arc), 0, 1];
  };
  const yTop = D + 0.004, yEnd = 0.33, yAt = (s) => yEnd + (yTop - yEnd) * (1 - THREE.MathUtils.smoothstep(s, 0.08, S - 0.42)); // a seat at the top, steep, flat at the end
  const bend = (s) => (s > A && s < A + arc ? Math.sin((Math.PI * (s - A)) / arc) : 0);
  const W = 0.42, R = 0.03;
  // across it (u to the right, v up), left lip to right lip; the outside of the bend (the left) walled higher, the bed tilted in there
  const profile = (s) => {
    const hl = 0.14 + 0.08 * bend(s), hr = 0.14, pts = [[-W / 2, hl], [-W / 2, R + 0.04]];
    for (let k = 0; k <= 4; k++) { const a = Math.PI + (k / 4) * (Math.PI / 2); pts.push([-W / 2 + R + R * Math.cos(a), R + R * Math.sin(a)]); }
    for (const u of [-0.1, 0, 0.1]) pts.push([u, 0]);
    for (let k = 0; k <= 4; k++) { const a = 1.5 * Math.PI + (k / 4) * (Math.PI / 2); pts.push([W / 2 - R + R * Math.cos(a), R + R * Math.sin(a)]); }
    pts.push([W / 2, R + 0.04], [W / 2, hr]);
    const b = 0.13 * bend(s), c = Math.cos(b), sn = Math.sin(b);
    return pts.map(([u, v]) => [u * c + v * sn, -u * sn + v * c]);
  };
  const point = (s, u, v, out = new THREE.Vector3()) => { const [x, z, hx, hz] = plan(s); return out.set(x - hz * u, yAt(s) + v, z + hx * u); }; // (right of heading hx, hz: −hz, hx)
  const nS = Math.ceil(S / 0.03), P0 = profile(0), nP = P0.length, pos = [], uv = [], idx = [];
  const along = [0];
  for (let k = 1; k < nP; k++) along.push(along[k - 1] + Math.hypot(P0[k][0] - P0[k - 1][0], P0[k][1] - P0[k - 1][1]));
  const v3 = new THREE.Vector3();
  for (let i = 0; i <= nS; i++) {
    const s = (S * i) / nS, prof = profile(s);
    prof.forEach(([u, v], k) => { point(s, u, v, v3); pos.push(v3.x, v3.y, v3.z); uv.push(along[k] / along[nP - 1], s / 1.4); });
  }
  for (let i = 0; i < nS; i++) for (let k = 0; k < nP - 1; k++) { const a = i * nP + k, b = a + nP; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const sheet = new THREE.BufferGeometry();
  sheet.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sheet.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  sheet.setIndex(idx);
  sheet.computeVertexNormals();
  const steel = std({ map: T.metalSlideTex(), roughnessMap: T.metalSlideTex(true), roughness: 1, metalness: 0.85, envMap: M.yardEnv, envMapIntensity: 0.8, side: THREE.DoubleSide });
  const chute = new THREE.Mesh(sheet, steel);
  chute.castShadow = chute.receiveShadow = true;
  g.add(chute);
  // the lips rolled over along both sides, and across the end
  const lip = (pts, rad) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, rad, 8), steel); m.castShadow = m.receiveShadow = true; g.add(m); };
  for (const k of [0, nP - 1]) lip(Array.from({ length: 41 }, (_, i) => { const s = (S * i) / 40, [u, v] = profile(s)[k]; return point(s, u + (k ? 0.005 : -0.005), v + 0.004); }), 0.011);
  lip(profile(S).map(([u, v]) => point(S, u, v + 0.002).add(new THREE.Vector3(0, 0, 0.004))), 0.009);
  // its legs: galvanised tube, a pair under the bend, a pair under the straight, two short feet in the sand
  const galv = std({ map: T.rustyMetalTex(87), metalness: 0.4, roughness: 0.7, envMap: M.yardEnv, envMapIntensity: 0.4 }); // (galvanised once, rusty now: user, 2026-10-18)
  const rod = (a, b, r) => { const m = cyl(r, r, a.distanceTo(b), galv, 0, 0, 0, 10); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m); };
  // each pair held under the chute by a cross bar right under the sheet (tilted with it through the bend), a
  // strap up the outside of each wall bolted to it, the legs off the bar's ends (user, 2026-10-18: they stood
  // loose under it, and the bar showed through the bed)
  const banked = (s, u, v) => { const b = 0.13 * bend(s), c = Math.cos(b), sn = Math.sin(b); return point(s, u * c + v * sn, -u * sn + v * c); }; // (as profile() turns it)
  for (const [s, foot] of [[A + arc * 0.55, -0.05], [A + arc + 0.5, -0.05], [S - 0.08, SAND - 0.06]]) {
    const [, , hx, hz] = plan(s);
    rod(banked(s, -W / 2 - 0.03, -0.02), banked(s, W / 2 + 0.03, -0.02), 0.015); // the bar
    for (const side of [-1, 1]) {
      const end = banked(s, side * (W / 2 + 0.02), -0.02), strapTop = banked(s, side * (W / 2 + 0.009), 0.11);
      rod(banked(s, side * (W / 2 + 0.009), -0.03), strapTop, 0.008); // the strap up the wall
      const bolt = cyl(0.009, 0.009, 0.006, galv, 0, 0, 0, 8);
      bolt.position.copy(banked(s, side * (W / 2 + 0.015), 0.07));
      bolt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-hz * side, 0, hx * side));
      g.add(bolt);
      const bot = new THREE.Vector3(end.x - hz * side * 0.09, foot, end.z + hx * side * 0.09);
      rod(end, bot, 0.019); // the leg, off the bar's end, splayed out a little
      ctx.colliders.push({ type: 'box', x0: bot.x - 0.04, x1: bot.x + 0.04, z0: bot.z - 0.04, z1: bot.z + 0.04, top: end.y, hose: false });
      hoseOnly.push({ type: 'capsule', a: end.clone(), b: bot.clone(), r: 0.019 }); // (the hose round it as it leans)
    }
  }
  for (let s = 0.35; s < S; s += 0.25) { // in your way: the chute, as high as it is there (not over the deck: you stand at the top of it)
    const [ax, az] = plan(s - 0.2), [bx, bz] = plan(s), y = yAt(s - 0.1);
    ctx.colliders.push({ type: 'seg', ax, az, bx, bz, r: 0.23, base: Math.max(0, y - 0.1), top: y + 0.18 });
  }
  // and going down it: at the top, E, and you sit and go — faster down the steep, round the bend with it, the
  // view turning as it turns, slower along the flat, and off the end into the sand, on your feet
  let sliding = null; // { s: how far down, v: how fast, yaw: the way it heads }
  const headingYaw = (hx, hz) => Math.atan2(-hx, -hz); // (as the player's: 0 looks north)
  chute.userData.interact = {
    when: () => { const p = ctx.player; return !!p && !p.ride && p.feet - OY > D - 0.1 && Math.hypot(p.pos.x - xs, p.pos.y - OZ - zc) < 0.8; },
    label: () => 'Slide down',
    use: () => {
      const p = ctx.player;
      sliding = { s: 0.03, v: 0.7, yaw: headingYaw(1, 0), sit: 0, from: p.camera.position.clone() }; // (a push off with your hands, once you are sat down)
      p.ride = { off: () => {}, hint: '' }; // (no getting off half way)
      p.yaw = sliding.yaw;
      p.pitch = -0.2;
      ctx.sound.sample?.('slide', toWorld(point(0.6, 0, 0))); // (silent until there is a recording)
    },
  };
  ctx.interact.push(chute);
  const slideOn = (dt) => {
    const p = ctx.player, sl = sliding;
    if (sl.up) { // off the end: on along the sand a little, slowing, sitting in it, then up onto your feet (user, 2026-10-18: not with a jerk)
      const u = sl.up;
      u.t = Math.min(1, u.t + dt / 1.0);
      const along = 1 - (1 - Math.min(1, u.t / 0.45)) ** 2, rise = THREE.MathUtils.smoothstep(u.t, 0.32, 1);
      const sitY = THREE.MathUtils.lerp(u.from.y, SAND + 0.58 + OY, along);
      p.camera.position.set(THREE.MathUtils.lerp(u.from.x, u.to.x, along), THREE.MathUtils.lerp(sitY, u.to.y, rise), THREE.MathUtils.lerp(u.from.z, u.to.z, along));
      p.pitch = THREE.MathUtils.lerp(u.pitch, -0.12, rise);
      p.camera.rotation.set(p.pitch, p.yaw, 0);
      p.pos.set(p.camera.position.x, p.camera.position.z);
      if (u.t >= 1) { sliding = null; p.ride = null; p.setPose(u.to.x, u.to.z, THREE.MathUtils.radToDeg(p.yaw), THREE.MathUtils.radToDeg(p.pitch)); } // (u.to: in the world already)
      return;
    }
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
    let slope = 0;
    if (sl.sit < 1) { // sitting down at the top first: from where your eyes were, down onto the chute
      sl.sit = Math.min(1, sl.sit + dt / 0.35);
      const e = THREE.MathUtils.smoothstep(sl.sit, 0, 1);
      p.camera.position.lerpVectors(sl.from, toWorld(point(sl.s, 0, 0.6)), e);
      p.camera.rotation.set(p.pitch, p.yaw, 0);
      return;
    }
    for (let i = 0; i < steps; i++) {
      slope = (yAt(sl.s + 0.01) - yAt(sl.s - 0.01)) / 0.02; // dy/ds, down: negative
      const k = 1 / Math.hypot(1, slope);
      sl.v += (9.8 * (-slope * k - 0.22 * k) - 0.1 * sl.v * sl.v) * h; // gravity down it, a child's trousers on old steel, the air
      sl.v = Math.max(sl.v, 0.45); // (along the flat you shuffle on)
      sl.s += sl.v * h;
    }
    if (sl.s >= S) { // off the end, into the sand
      const [x, z, hx, hz] = plan(S);
      sl.up = { t: 0, from: p.camera.position.clone(), to: toWorld(new THREE.Vector3(x + hx * 0.6, SAND + 1.22, z + hz * 0.6)), pitch: p.pitch };
      return;
    }
    const [, , hx, hz] = plan(sl.s), want = headingYaw(hx, hz);
    p.yaw += want - sl.yaw; // the view goes round the bend with you, and you can still look about
    sl.yaw = want;
    const eye = toWorld(point(sl.s, 0, 0.6)); // sitting on it: a child's eyes over the bed
    p.camera.position.copy(eye);
    p.camera.rotation.set(p.pitch + Math.atan(slope) * 0.5, p.yaw, 0);
    p.pos.set(eye.x, eye.z);
  };

  // ---- the sandbox: two boards high, gone grey; corner blocks; a ledge along the south to sit on
  const SB = SANDBOX, bt = SB.board, half = SB.rim / 2;
  for (const [y0, y1] of [[0, half - 0.002], [half + 0.002, SB.rim]]) {
    for (const [x0, x1, z0, z1] of [[SB.x0, SB.x1, SB.z0, SB.z0 + bt], [SB.x0, SB.x1, SB.z1 - bt, SB.z1], [SB.x0, SB.x0 + bt, SB.z0 + bt, SB.z1 - bt], [SB.x1 - bt, SB.x1, SB.z0 + bt, SB.z1 - bt]]) g.add(slab(x0, x1, y0, y1, z0, z1, wood));
  }
  for (const [x, z] of [[SB.x0 + bt, SB.z0 + bt], [SB.x1 - bt - 0.05, SB.z0 + bt], [SB.x0 + bt, SB.z1 - bt - 0.05], [SB.x1 - bt - 0.05, SB.z1 - bt - 0.05]]) g.add(slab(x, x + 0.05, 0, SB.rim - 0.01, z, z + 0.05, wood));
  g.add(slab(SB.x0 - 0.01, SB.x1 + 0.01, SB.rim, SB.rim + 0.025, SB.z1 - 0.14, SB.z1 + 0.012, wood)); // the ledge
  // sand kicked out over the grass round it
  const spillW = SB.x1 - SB.x0 + 1.3, spillD = SB.z1 - SB.z0 + 1.3;
  const spill = flat(SB.x0 - 0.65, SB.x1 + 0.65, SB.z0 - 0.65, SB.z1 + 0.65, 0.004, new THREE.MeshStandardMaterial({ map: T.sandSpillTex(spillW, spillD, SB.x1 - SB.x0, SB.z1 - SB.z0), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  g.add(spill);
  // the sand: a surface of its own, 2 cm a step — heaped against the boards, lumpy; what is left of a castle
  // with its moat, an old hole and the sand thrown out of it beside, a hollow kicked out where the chute ends;
  // small footprints going in from the ledge, and stopping
  const sx0 = SB.x0 + bt, sx1 = SB.x1 - bt, sz0 = SB.z0 + bt, sz1 = SB.z1 - bt, STEP = 0.02;
  const nx = Math.round((sx1 - sx0) / STEP) + 1, nz = Math.round((sz1 - sz0) / STEP) + 1;
  const mx = (sx0 + sx1) / 2, mz = (sz0 + sz1) / 2, [ex, ez] = plan(S);
  const lump = (x, z, cx, cz, rx, rz, h) => { const q = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2; return q < 1 ? h * (1 - q) ** 2 : 0; };
  const prints = [[mx - 0.1, sz1 - 0.12, 0.2], [mx - 0.02, sz1 - 0.3, -0.1], [mx - 0.08, sz1 - 0.47, 0.15], [mx + 0.01, sz1 - 0.62, -0.05]]; // left, right, left, right
  const sandAt = (x, z) => {
    const edge = Math.min(x - sx0, sx1 - x, z - sz0, sz1 - z);
    let h = SAND + 0.03 * Math.exp(-edge / 0.07) + (fbm(x * 1.7 + 4, z * 1.7 + 9, 0.5, 3) - 0.5) * 0.05 + (fbm(x * 9 + 2, z * 9 + 5, 0.5, 2) - 0.5) * 0.009;
    h += lump(x, z, mx - 0.5, mz + 0.18, 0.22, 0.19, 0.085) + lump(x, z, mx - 0.46, mz + 0.15, 0.08, 0.07, 0.035); // the castle, slumped
    h -= 0.02 * Math.exp(-(((Math.hypot((x - mx + 0.5) / 1.1, z - mz - 0.18) - 0.27) / 0.035) ** 2)); // its moat
    h -= lump(x, z, mx + 0.5, mz - 0.38, 0.13, 0.12, 0.07); // an old hole
    h += lump(x, z, mx + 0.72, mz - 0.3, 0.14, 0.11, 0.04); // and what came out of it
    h -= lump(x, z, ex, ez + 0.22, 0.17, 0.28, 0.035); // where feet land off the chute
    for (const [px, pz, a] of prints) { // a child's shoe, 17 cm, toe and heel pressed deeper
      const dx = x - px, dz = z - pz, c = Math.cos(a), sn = Math.sin(a), u = dx * c - dz * sn, v = dx * sn + dz * c;
      const w = 0.032 * (v < 0 ? 1 : 0.85);
      if (Math.abs(v) < 0.085 && Math.abs(u) < w) h -= 0.009 * (1 - (u / w) ** 2) * (0.7 + 0.3 * Math.abs(v / 0.085));
    }
    return h;
  };
  const hts = new Float32Array(nx * nz), col = new Float32Array(nx * nz * 3), spos = new Float32Array(nx * nz * 3), suv = new Float32Array(nx * nz * 2), sidx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = sx0 + i * STEP, z = sz0 + j * STEP, h = sandAt(x, z);
    hts[k] = h;
    spos.set([x, h, z], k * 3);
    suv.set([x, -z], k * 2);
    const damp = 1 - 0.1 * THREE.MathUtils.smoothstep(SAND - h, 0.02, 0.07) - 0.05 * Math.exp(-Math.min(x - sx0, sx1 - x, z - sz0, sz1 - z) / 0.05); // a little damper in the deep hollows, by the boards
    col.set([damp, damp, damp], k * 3);
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i; sidx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  sg.setAttribute('uv', new THREE.BufferAttribute(suv, 2));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sg.setIndex(sidx);
  sg.computeVertexNormals();
  // under it, the pit the sand fills, lined with earth: what shows when you dig down by the boards, or to the bottom
  const earth = std({ color: 0x4a3c2e, roughness: 1 });
  for (const [x0, x1, z0, z1] of [[sx0, sx1, sz0, sz0 + 0.004], [sx0, sx1, sz1 - 0.004, sz1], [sx0, sx0 + 0.004, sz0, sz1], [sx1 - 0.004, sx1, sz0, sz1]]) g.add(slab(x0, x1, PIT_FLOOR - 0.02, 0.001, z0, z1, earth));
  g.add(slab(sx0, sx1, PIT_FLOOR - 0.04, PIT_FLOOR - 0.005, sz0, sz1, earth));
  const sand = new THREE.Mesh(sg, std({ map: T.sandboxSandTex(), bumpMap: T.sandboxSandTex(true), bumpScale: 0.8, roughness: 1, vertexColors: true }));
  sand.castShadow = sand.receiveShadow = true;
  sand.userData.live = true; // (it changes when you dig)
  g.add(sand);
  ctx.colliders.push({ type: 'box', x0: SB.x0, x1: SB.x1, z0: SB.z0, z1: SB.z1, top: SAND, stand: true, surface: 'grass', hose: false });
  for (const [x0, x1, z0, z1, top] of [[SB.x0, SB.x1, SB.z0, SB.z0 + bt, SB.rim], [SB.x0, SB.x1, SB.z1 - 0.14, SB.z1, SB.rim + 0.025], [SB.x0, SB.x0 + bt, SB.z0, SB.z1, SB.rim], [SB.x1 - bt, SB.x1, SB.z0, SB.z1, SB.rim]]) hoseOnly.push({ type: 'box', x0, x1, z0, z1, top }); // (its boards, the ledge: the hose over them, onto the sand)
  const heightAt = (x, z) => hts[Math.round(THREE.MathUtils.clamp((z - sz0) / STEP, 0, nz - 1)) * nx + Math.round(THREE.MathUtils.clamp((x - sx0) / STEP, 0, nx - 1))];

  // ---- the spade: yellow plastic gone pale, a scoop of a blade, a T at the end of its handle
  const yellow = std({ color: 0xc9b25a, roughness: 0.72 });
  const spade = new THREE.Group();
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, -0.04); bladeShape.lineTo(0.085, -0.052); bladeShape.quadraticCurveTo(0.125, -0.05, 0.127, 0); bladeShape.quadraticCurveTo(0.125, 0.05, 0.085, 0.052); bladeShape.lineTo(0, 0.04); bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.004, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2); // (x along it, z across)
  const bp = bladeGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) + 0.014 * (bp.getZ(i) / 0.052) ** 2); // dished: its sides turned up
  bladeGeo.computeVertexNormals();
  const blade = new THREE.Mesh(bladeGeo, yellow);
  blade.position.x = 0.025;
  spade.add(blade);
  const handle = cyl(0.0105, 0.012, 0.2, yellow, -0.075, 0.012, 0, 12);
  handle.rotation.z = Math.PI / 2 + 0.06; // (rising a little to the blade)
  spade.add(handle);
  const grip = cyl(0.012, 0.012, 0.075, yellow, -0.178, 0.012, 0, 12);
  grip.rotation.x = Math.PI / 2;
  spade.add(grip);
  spade.traverse((m) => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
  // stuck in the sand in the far left corner, seen from the house (user, 2026-10-18), its blade half in, the
  // handle leaning a little out of the corner, as it was left the last time
  const spadeX = sx0 + 0.2, spadeZ = sz0 + 0.19, tilt = deg(16), out = new THREE.Vector3(0.55, 0, 0.83).normalize();
  const down = new THREE.Vector3(-out.x * Math.sin(tilt), -Math.cos(tilt), -out.z * Math.sin(tilt)); // which way its blade points (its x)
  const into = new THREE.Vector3(spadeX, heightAt(spadeX, spadeZ), spadeZ); // where it goes into the sand
  spade.quaternion.setFromAxisAngle(down, deg(38)).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), down));
  spade.position.copy(into).addScaledVector(down, -0.077); // (7.5 cm of its 12.7 cm blade in the sand)
  g.add(spade);
  const spadePole = { type: 'capsule', a: into.clone(), b: spade.position.clone().addScaledVector(down, -0.19), r: 0.013 }; // (the hose round its handle)
  hoseOnly.push(spadePole);
  let redraw = () => {};
  takeable(ctx, spade, { id: 'spade', name: 'spade', line: "Your spade. You haven't played in the sand for ages.", reach: [0.32, 0.12], grip: { turn: Math.PI / 2 }, taken: () => { hoseOnly.splice(hoseOnly.indexOf(spadePole), 1); redraw(); } })();

  // ---- digging (user, 2026-10-18: "you can take the spade to dig"): the spade in your hand and the sand in
  // front of you, E takes out a spadeful where you look — a hollow, the sand under the top damp and darker —
  // and throws it to your right in a heap, as much sand as came out. Down to the earth at the bottom, no further.
  const ray = new THREE.Raycaster(), right = new THREE.Vector3(), CENTRE = new THREE.Vector2();
  ray.far = 2.3;
  const reshape = (cx, cz, rad, fn) => { // fn(height, falloff 0…1) → new height, for every point within rad of cx, cz
    let vol = 0;
    const i0 = Math.max(0, Math.floor((cx - rad - sx0) / STEP)), i1 = Math.min(nx - 1, Math.ceil((cx + rad - sx0) / STEP));
    const j0 = Math.max(0, Math.floor((cz - rad - sz0) / STEP)), j1 = Math.min(nz - 1, Math.ceil((cz + rad - sz0) / STEP));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * nx + i, d = Math.hypot(sx0 + i * STEP - cx, sz0 + j * STEP - cz);
      if (d >= rad) continue;
      const was = hts[k], now = fn(was, (1 - (d / rad) ** 2) ** 2);
      hts[k] = now;
      spos[k * 3 + 1] = now;
      vol += (was - now) * STEP * STEP;
      if (Math.abs(now - was) > 0.002) { const c = now < PIT_FLOOR + 0.015 ? [0.5, 0.44, 0.38] : now < was ? [0.68 - Math.max(0, -now) * 0.8, 0.66 - Math.max(0, -now) * 0.8, 0.62 - Math.max(0, -now) * 0.8] : [0.8, 0.78, 0.75]; col.set(c, k * 3); } // fresh: damp in the hole, damper deeper, less so thrown out; at the bottom, earth
    }
    return vol;
  };
  sand.userData.interact = {
    when: () => ctx.inventory.held === 'spade',
    label: () => 'Dig',
    use: () => {
      ray.setFromCamera(CENTRE, ctx.camera);
      const hit = ray.intersectObject(sand)[0];
      if (!hit) return;
      const p = hit.point.clone();
      p.y -= OY; p.z -= OZ; // (in this frame)
      const out = reshape(p.x, p.z, 0.11, (h, f) => Math.max(PIT_FLOOR, h - 0.05 * f));
      if (out < 1e-5) return; // nothing left there to dig
      right.set(1, 0, 0).applyQuaternion(ctx.camera.quaternion).setY(0).normalize();
      const qx = THREE.MathUtils.clamp(p.x + right.x * 0.24, sx0 + 0.1, sx1 - 0.1), qz = THREE.MathUtils.clamp(p.z + right.z * 0.24, sz0 + 0.1, sz1 - 0.1);
      let sum = 0;
      reshape(qx, qz, 0.13, (h, f) => { sum += f; return h; });
      const k = out / (sum * STEP * STEP);
      reshape(qx, qz, 0.13, (h, f) => Math.min(SB.rim + 0.06, h + k * f));
      sg.attributes.position.needsUpdate = true;
      sg.attributes.color.needsUpdate = true;
      sg.computeVertexNormals();
      ctx.inventory.jab?.();
      ctx.sound.sample?.('sand-dig', hit.point); // (silent until there is a recording)
      redraw();
    },
  };
  ctx.interact.push(sand);
  return {
    shadowsMoved: (fn) => { redraw = fn; },
    /** The sand's height at x, z inside the box, else null. */
    sandAt: (x, z) => (x > sx0 && x < sx1 && z > sz0 && z < sz1 ? heightAt(x, z) : null),
    update(dt) { if (sliding) slideOn(dt); },
  };
}

function swingSet(g, M, mat, ctx, hoseOnly) {
  // a painted steel frame, old (user, 2026-10-17): the paint chalky and flaking to rust all over it, rust
  // running down from every chip, the feet rusted right round; two places to hang a seat, one seat
  const legPaint = std({ map: T.rustyPaintTex(61), roughness: 0.7, metalness: 0.25 });
  const barPaint = std({ map: T.rustyPaintTex(67), roughness: 0.7, metalness: 0.25 });
  barPaint.map.repeat.set(1, 2);
  const sx = 0.55, sz = -4.7, span = 1.25, TOP = 2.05, splay = 0.75;
  const set = new THREE.Group();
  set.position.set(sx, 0, sz);
  g.add(set);
  const tube = (a, b, rad, m) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const mesh = cyl(rad, rad, len, m, 0, 0, 0, 12);
    mesh.position.copy(va).add(vb).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()); // (its v = 1 end at b)
    set.add(mesh);
    return mesh;
  };
  tube([-span, TOP, 0], [span, TOP, 0], 0.03, barPaint);
  for (const x of [-span, span]) {
    for (const z of [-splay, splay]) {
      // each leg runs on 5 cm into the ground, its foot rusted right round in its own paint (the rusty sleeve
      // that was put over it stood out of it: user, 2026-10-18)
      const a = new THREE.Vector3(x, TOP, 0), b = new THREE.Vector3(x * 1.04, 0, z);
      tube(a.toArray(), b.clone().addScaledVector(b.clone().sub(a).normalize(), 0.05).toArray(), 0.026, legPaint);
      hoseOnly.push({ type: 'capsule', a: a.clone().add(new THREE.Vector3(sx, 0, sz)), b: b.clone().add(new THREE.Vector3(sx, 0, sz)), r: 0.026 }); // (the hose round the leg as it leans, not just round its foot)
    }
  }
  // the chains: real ones, oval links, each turned a quarter to the last (user, 2026-10-17); hung on rings
  // under the bar, the seat hung on them by an eye bolted through each end of it — every link round the
  // one before it, nothing left in the air between them (user, 2026-10-18)
  const chainMat = std({ color: 0x5a4636, metalness: 0.55, roughness: 0.7 }); // rusted
  const LINK = 0.026, LR = 0.0072, LW = 0.0021, LS = 1.75; // a link: its pitch, its ring's radius and wire, how long it is drawn out
  const linkGeo = new THREE.TorusGeometry(LR, LW, 6, 12).scale(1, LS, 1);
  const LIP = LR * LS; // from a link's middle to the middle of its wire at either end
  const HOOK = 0.025, HW = 0.006; // the rings under the bar
  const PIVOT = TOP - 0.062 - HOOK + LW * LS + HW + LINK / 2 - LIP; // so that link 0's top wire rides on its ring's bottom one
  const chain = (parent, x0, x1, n) => { // n links down from the parent's origin, from x0 at the top to x1 at the bottom
    const m = new THREE.InstancedMesh(linkGeo, chainMat, n), mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      e.set(0, i % 2 ? Math.PI / 2 : 0, 0);
      mx.compose(new THREE.Vector3(x0 + ((x1 - x0) * i) / Math.max(1, n - 1), -(i + 0.5) * LINK, 0), q.setFromEuler(e), new THREE.Vector3(1, 1, 1));
      m.setMatrixAt(i, mx);
    }
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // the rings: four, under the bar, each on a short bolt up through it; turned square to the first link
  for (const x of [-0.75, -0.25, 0.25, 0.75]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(HOOK, HW, 6, 14), mat.rust);
    ring.position.set(x, TOP - 0.062, 0);
    ring.rotation.y = Math.PI / 2;
    ring.castShadow = ring.receiveShadow = true;
    set.add(ring);
    set.add(cyl(0.005, 0.005, 0.03, mat.rust, x, TOP - 0.026, 0, 8));
  }
  // the seat that is left: black rubber gone grey, a steel plate over each end with an eye on it
  const seat = new THREE.Group();
  seat.position.set(-0.5, PIVOT, 0);
  seat.userData.live = true; // it sways
  set.add(seat);
  const N = 58; // links in each chain
  const EYE = 0.012, EW = 0.0028;
  const plateTop = -(N - 0.5) * LINK - LIP + LW * LS + EW - EYE; // the eye's top wire riding in the last link's bottom one
  const SEAT = { half: 0.235, deep: 0.085, thick: 0.03 };
  for (const s of [-1, 1]) {
    chain(seat, s * 0.25, s * 0.215, N); // (the rings 50 cm apart, the eyes 43: a little in towards the seat)
    const eye = new THREE.Mesh(new THREE.TorusGeometry(EYE, EW, 6, 12, Math.PI), chainMat); // a half ring standing on the plate
    eye.position.set(s * 0.215, plateTop, 0);
    eye.rotation.y = (N - 1) % 2 ? 0 : Math.PI / 2; // square to the last link
    eye.castShadow = eye.receiveShadow = true;
    seat.add(eye);
    const across = (a, b) => [Math.min(s * a, s * b), Math.max(s * a, s * b)]; // from a to b out from the middle, on this side
    seat.add(slab(...across(0.185, SEAT.half + 0.006), plateTop - 0.003, plateTop, -0.026, 0.026, chainMat)); // the plate
    seat.add(slab(...across(SEAT.half, SEAT.half + 0.006), plateTop - 0.006 - SEAT.thick, plateTop, -0.026, 0.026, chainMat)); // bent down round the seat's end
    for (const dz of [-0.016, 0.016]) seat.add(cyl(0.0045, 0.0045, 0.004, chainMat, s * 0.2, plateTop + 0.002, dz, 6)); // the nuts
  }
  const rubber = std({ color: 0x2b2927, roughness: 0.88 });
  const seatTop = plateTop - 0.003;
  const pad = new THREE.Mesh(new RoundedBoxGeometry(SEAT.half * 2, SEAT.thick, SEAT.deep * 2, 3, 0.008), rubber);
  pad.position.set(0, seatTop - SEAT.thick / 2, 0);
  pad.castShadow = pad.receiveShadow = true;
  seat.add(pad);
  // where the other one was: a short end of chain on one hook, nothing on the other
  const stub = new THREE.Group();
  stub.position.set(0.75, PIVOT, 0);
  set.add(stub);
  chain(stub, 0, 0, 16);
  const seatY = PIVOT + seatTop; // the top of the seat over the ground, hanging still
  const seatBox = { type: 'box', x0: sx - 0.76, x1: sx - 0.24, z0: sz - 0.12, z1: sz + 0.12, top: seatY, hose: false }; // (the hose passes under it)
  ctx.colliders.push(seatBox);
  for (const x of [-span, span]) for (const z of [-splay, splay]) ctx.colliders.push({ type: 'box', x0: sx + x * 1.04 - 0.08, x1: sx + x * 1.04 + 0.08, z0: sz + z - 0.08, z1: sz + z + 0.08, hose: false }); // (yours; the hose has the legs as they lean)

  // ---- you can sit on it (user, 2026-10-17): E on it, and you are sitting on it, facing the house; W and
  // S work it, higher and higher (or back down), and it slows of itself; E again and you drag your feet
  // till it has all but stopped, and get off, in front of it (user, 2026-10-18: it went on swinging after,
  // in jerks). A pendulum on its chains.
  let ang = 0, angV = 0, riding = false, stopping = 0;
  const G = 9.8, L = -seatTop + 0.1, eye = new THREE.Vector3(), at = new THREE.Vector3(); // (L: to the middle of a child on it)
  const getOff = () => {
    const P = ctx.player;
    riding = false;
    stopping = 0;
    P.ride = null;
    seat.getWorldPosition(at);
    P.setPose(at.x, sz + 0.75 + OZ, 180, 0); // stood up in front of it, still facing the house (in the world)
  };
  const off = () => { if (stopping) getOff(); else stopping = 0.001; }; // (E once: feet down; again: off there and then)
  seat.userData.interact = {
    label: () => 'Sit on the swing',
    use: () => {
      const P = ctx.player;
      if (!P || riding) return;
      riding = true;
      P.ride = { off };
      P.yaw = Math.PI; // facing the house
      P.pitch = 0;
    },
  };
  ctx.interact.push(seat);
  return {
    box: { x0: sx - span * 1.04 - 0.1, x1: sx + span * 1.04 + 0.1, z0: sz - splay - 0.1, z1: sz + splay + 0.1 }, // all of it, on the ground
    seatAt: { x: sx - 0.5, z: sz }, // where its seat hangs
    sway(t, dt = 1 / 60) {
      const P = ctx.player;
      // worked (user, 2026-10-18: "W to go forward, S to go back"): W leans you into it while it goes forward,
      // towards the house, S while it goes back; each only on its own half of the swing (or from still), so W
      // and S in turn take it up fastest. Forward is −ang (the seat swung towards +z).
      const fwdKey = riding && (P.keys.has('KeyW') || P.keys.has('ArrowUp')), backKey = riding && (P.keys.has('KeyS') || P.keys.has('ArrowDown'));
      // empty, it never quite hangs still: there is no wind, and yet it goes on moving a little, slowly, to
      // and fro — a place it is pulled towards that wanders, so the swing follows it smoothly (it was added
      // on top, and came and went with a jolt at every turn: user, 2026-10-18)
      const rest = riding ? 0 : Math.sin(t * 0.9) * 0.025 + Math.sin(t * 0.37) * 0.015;
      const steps = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const push = (backKey && angV > -0.05 ? 1 : 0) - (fwdKey && angV < 0.05 ? 1 : 0); // (+: back, −: forward)
        // working it adds less and less the higher it goes, nothing past 0.55 rad, and the chains hold it back
        // more and more smoothly above 0.45 (no step anywhere): it turns back at the top, about 50°, as a
        // pendulum does, slowing into it and away (user, 2026-10-17: no jolt at the top). Empty, it is light
        // and the air takes it: it dies down in a few swings (user, 2026-10-18: it went on and on)
        const reach = Math.max(0, 1 - (Math.max(0, push * ang) / 0.85) ** 4); // (the further it already is the way you push, the less; higher: user, 2026-10-18)
        const hold = (riding ? (stopping ? 4.5 : 0.12) : 0.9) + 10 * Math.max(0, Math.abs(ang) - 0.72) ** 2; // (feet dragging: it comes to a stop in a second or so)
        angV += (-(G / L) * Math.sin(ang - rest) - hold * angV + (stopping ? 0 : push * 0.9 * reach)) * h;
        ang += angV * h;
      }
      seat.rotation.x = ang;
      if (stopping && (stopping += dt) && ((Math.abs(ang) < 0.05 && Math.abs(angV) < 0.2) || stopping > 2.5)) getOff();
      if (riding) {
        // you, on the seat, your eyes a child's sitting height over it, going with it
        seat.updateMatrixWorld(true);
        seat.localToWorld(eye.set(0, seatTop + 0.72, -0.03)); // (0.64 sat you too low: user, 2026-10-18)
        P.camera.position.copy(eye);
        P.camera.rotation.set(P.pitch - ang * 0.35, P.yaw, 0);
        P.pos.set(eye.x, eye.z);
      }
    },
  };
}

function shed(g, M, mat, ctx) {
  const x0 = 1.85, x1 = 3.65, z0 = -6.9, z1 = -5.5, eaves = 1.95, ridge = 2.3;
  // walls of upright boards, a door on the side facing the house
  const door = [2.42, 3.08];
  pierced([x0, x1], [[door[0], door[1], 0, 1.82]], (a0, a1, y0, y1) => g.add(slab(a0, a1, y0, Math.min(y1, eaves), z1 - 0.04, z1, mat.shed)));
  g.add(slab(x0, x1, 0, eaves, z0, z0 + 0.04, mat.shed));
  for (const x of [x0, x1 - 0.04]) {
    g.add(slab(x, x + 0.04, 0, eaves, z0, z1, mat.shed));
    // the gable above it
    const gable = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(z1 - z0, 0), new THREE.Vector2((z1 - z0) / 2, ridge - eaves)]);
    const geo = new THREE.ExtrudeGeometry(gable, { depth: 0.04, bevelEnabled: false });
    const m = new THREE.Mesh(geo, mat.shed);
    m.rotation.y = -Math.PI / 2;
    m.position.set(x + 0.04, eaves, z0);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  // a small dirty window in the west end
  g.add(slab(x0 - 0.005, x0, 1.1, 1.5, -6.45, -5.95, std({ color: 0x1d1f1c, roughness: 0.25 })));
  g.add(slab(x0 - 0.02, x0, 1.08, 1.52, -6.47, -5.93, mat.rail));
  // roof: two slopes of tarred felt, overhanging
  const pitch = Math.atan2(ridge - eaves, (z1 - z0) / 2), slopeLen = Math.hypot(ridge - eaves, (z1 - z0) / 2) + 0.18;
  for (const side of [-1, 1]) {
    const roofSide = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.24, 0.03, slopeLen), std({ color: 0x2f3330, roughness: 0.95 }));
    roofSide.position.set((x0 + x1) / 2, (eaves + ridge) / 2 + 0.03, (z0 + z1) / 2 + side * ((z1 - z0) / 4 + 0.045));
    roofSide.rotation.x = side * pitch;
    roofSide.castShadow = roofSide.receiveShadow = true;
    g.add(roofSide);
  }
  // the door: boards, a Z of battens, a hasp and a padlock
  const d = new THREE.Group();
  d.position.set(door[0], 0, z1);
  g.add(d);
  d.add(slab(0, door[1] - door[0], 0.02, 1.8, 0, 0.035, mat.shed));
  for (const y of [0.25, 1.55]) d.add(slab(0.04, door[1] - door[0] - 0.04, y, y + 0.1, 0.035, 0.06, mat.shed));
  const brace = slab(-0.04, 0.04, 0, 1.25, 0.035, 0.058, mat.shed);
  brace.position.set((door[1] - door[0]) / 2, 0.92, 0);
  brace.rotation.z = Math.atan2(door[1] - door[0] - 0.12, 1.2);
  d.add(brace);
  d.add(slab(door[1] - door[0] - 0.14, door[1] - door[0] + 0.05, 1.0, 1.05, 0.04, 0.05, mat.rust));
  d.add(slab(door[1] - door[0] - 0.02, door[1] - door[0] + 0.02, 0.92, 1.0, 0.05, 0.085, std({ color: 0x8a6a3a, metalness: 0.7, roughness: 0.55 })));
  for (const y of [0.3, 1.5]) d.add(slab(-0.01, 0.3, y, y + 0.04, 0.035, 0.045, mat.rust));
  ctx.colliders.push({ type: 'box', x0, x1, z0, z1 });
  d.userData.interact = { label: () => 'Open the shed', say: 'Padlocked.' };
  ctx.interact.push(d);
}


// ---------------------------------------------------------------- the flamingos

/**
 * The moulded lawn flamingo, side on: metres in its own frame, x towards the head, y up from the lawn,
 * z through it from side to side. Its paint is laid on flat from the side (T.flamingoTex), so the parts
 * here and the marks in the paint line up.
 */
const FLAMINGO = {
  box: [-0.225, 0.36, 0.48, 1.01], // all of it, side on: what the paint covers
  // the body: along a spine from the breast back to the point of the tail
  body: [[0.205, 0.627], [0.1, 0.636], [-0.03, 0.607], [-0.13, 0.56], [-0.218, 0.505]],
  // the neck, a question mark: up out of the breast, over, and down into the head; the beak bent on down out of it
  neck: [[0.158, 0.635], [0.196, 0.705], [0.212, 0.79], [0.206, 0.875], [0.214, 0.945], [0.245, 0.98], [0.283, 0.966], [0.303, 0.929], [0.317, 0.889], [0.321, 0.851], [0.316, 0.822]],
  neckR: [0.035, 0.032, 0.029, 0.026, 0.024, 0.024, 0.03, 0.038, 0.022, 0.012, 0], // half-depth of it at each of those
  neckW: [0.92, 0.92, 0.9, 0.9, 0.9, 0.95, 1.0, 0.92, 0.72, 0.72, 0.72], // and its width, as a share of that
  wing: [-0.06, 0.632, 0.15, 0.078, -0.2], // the wing pressed into each side: middle x, y, half-length, half-height, tilt
  face: [0.316, 0.925, 0.03], // the pale patch on the front of the head
  beak: [0.32, 0.868], // where the black of the beak begins
  eye: 0.69, // how far along the neck's curve the eyes are
};

/**
 * A tube along a flat curve through `pts` ([x, y] in the z = 0 plane), each ring an ellipse `depth(t)` across
 * the curve in that plane and `width(t)` along z, t running 0…1 down the curve. Where a size is 0 it closes.
 * `squash(t)`: how much flatter its underside is (1: not at all).
 */
function loft(pts, depth, width, rings, round, squash = () => 1) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const pos = [], idx = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    curve.getPoint(t, P);
    curve.getTangent(t, T);
    const ux = -T.y, uy = T.x; // across the curve, in its plane
    const a = depth(t), b = width(t), sq = squash(t);
    for (let j = 0; j < round; j++) {
      const th = (j / round) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const k = uy * c < 0 ? sq : 1; // the half below the curve
      pos.push(P.x + ux * a * c * k, P.y + uy * a * c * k, b * sn);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < round; j++) {
      const a = i * round + j, b = i * round + ((j + 1) % round), c = a + round, d = b + round;
      idx.push(a, b, c, b, d, c); // facing out (it was inside out: you saw the far eye through the head)
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, curve };
}

/** Paint laid on flat from the side: u, v from x, y across the flamingo's box. */
function sideOn(geo) {
  const [x0, x1, y0, y1] = FLAMINGO.box, p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - x0) / (x1 - x0);
    uv[i * 2 + 1] = (p.getY(i) - y0) / (y1 - y0);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Where along a list of sizes, `t` 0…1 across them, smoothly. */
const along = (list, t) => {
  const f = t * (list.length - 1), i = Math.min(list.length - 2, Math.floor(f)), k = f - i, e = k * k * (3 - 2 * k);
  return list[i] + (list[i + 1] - list[i]) * e;
};

/**
 * A pink plastic lawn flamingo, many summers old, after the user's reference: a fat moulded body with a
 * breast, the wings raised a little off its sides and running to the point of the tail, a thick neck in a
 * question mark, a big head hung forward with the beak bent down out of it, the round yellow eyes that
 * stand out of the head (one each side), and two wire legs pushed into the lawn. `roll`, `pitch`: how
 * crooked it has been pushed in.
 */
/**
 * The flamingos' eyes: the sun on them the four o'clock sun's colour, whatever sun it is (daytime.js) — the
 * evening's golden light turned them orange (user, 2026-10-19). Only the sun's: their yellow itself had been taken
 * back by as much, and wherever the sun doesn't reach them (most of the lawn at six) that left them olive and dark
 * (user, 2026-10-21). For outdoorSun (build.js).
 */
function fourOClockSun(m) {
  const now = new THREE.Color(DAY.sun.color), was = new THREE.Color(AFTERNOON.sun.color), lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, k = lum(now) / lum(was);
  m.userData.sunAs = { tint: new THREE.Vector3(now.r, now.g, now.b).normalize(), as: new THREE.Vector3((was.r * k) / now.r, (was.g * k) / now.g, (was.b * k) / now.b) };
  return m;
}

function flamingo(g, M, x, z, turn, roll, pitch, seed) {
  const F = FLAMINGO;
  const paint = std({ map: T.flamingoTex(seed, F), roughness: 0.74 });
  const f = new THREE.Group();
  f.position.set(x, 0, z);
  f.rotation.set(roll, turn, pitch, 'YXZ');
  g.add(f);
  // the body: round at the breast, deepest a third of the way back, drawn out to a point; flatter underneath
  // ...and ended where the feathers end, at the black line, rounded off there: no point of a tail past it
  // (user, 2026-10-17)
  const END = 0.72, CAP = 0.085;
  const bodyD = (t) => {
    const front = t < 0.25 ? Math.sqrt(Math.max(0, 1 - ((0.25 - t) / 0.25) ** 2)) : 1;
    const back = t > 0.36 ? Math.pow(Math.max(0, 1 - (t - 0.36) / 0.64), 1.2) : 1;
    const cap = t > END ? 0 : t > END - CAP ? Math.sqrt(Math.max(0, 1 - ((t - (END - CAP)) / CAP) ** 2)) : 1;
    return 0.102 * front * back * cap;
  };
  const bodyW = (t) => bodyD(t) * (0.6 - Math.max(0, t - 0.5) * 0.25);
  const body = loft(F.body, bodyD, bodyW, 72, 48, () => 0.86);
  // the wings: the side of the body raised where each wing is, a little proud, with a soft edge
  const [cx, cy, rx, ry, tilt] = F.wing;
  const p = body.geo.attributes.position, n = body.geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const dx = p.getX(i) - cx, dy = p.getY(i) - cy;
    const ex = dx * Math.cos(-tilt) - dy * Math.sin(-tilt), ey = dx * Math.sin(-tilt) + dy * Math.cos(-tilt);
    const e = Math.sqrt((ex / rx) ** 2 + (ey / ry) ** 2);
    const side = Math.min(1, Math.abs(n.getZ(i)) / 0.55); // only on the sides, not over the back
    const k = THREE.MathUtils.smoothstep(1.0, 0.86, e) * side * 0.006;
    if (k > 0) p.setXYZ(i, p.getX(i) + n.getX(i) * k, p.getY(i) + n.getY(i) * k, p.getZ(i) + n.getZ(i) * k);
  }
  body.geo.computeVertexNormals();
  // the neck, the head and the beak, in one
  const neck = loft(F.neck, (t) => along(F.neckR, t), (t) => along(F.neckR, t) * along(F.neckW, t), 170, 32);
  for (const part of [body.geo, neck.geo]) {
    const m = new THREE.Mesh(sideOn(part), paint);
    m.castShadow = m.receiveShadow = true;
    f.add(m);
  }
  // the eyes: yellow, round, standing out of the head, one on each side
  const at = neck.curve.getPoint(F.eye), tan = neck.curve.getTangent(F.eye);
  const ux = -tan.y, uy = tan.x, a = along(F.neckR, F.eye), b = a * along(F.neckW, F.eye);
  // (yellow as they were by the four o'clock sun: fourOClockSun; and no lighter than the body's paint, its plastic
  // gone as dull — too bright, they looked lit on their own in the shade: user, 2026-10-20; then too dark: 0.6 → 0.72;
  // then 15% more light on them: 0.828 — user, 2026-10-22)
  const yellow = fourOClockSun(std({ color: new THREE.Color(0xe8c23a).multiplyScalar(0.828), roughness: 0.7 }));
  for (const s of [-1, 1]) {
    const c = Math.cos(1.0), sn = Math.sin(1.0); // towards the front of the head from its side
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), yellow);
    eye.position.set(at.x + ux * a * c * 0.95, at.y + uy * a * c * 0.95, s * b * sn * 0.95);
    f.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 12, 8), M.blackPlastic);
    pupil.position.copy(eye.position).add(new THREE.Vector3(ux * 0.002, uy * 0.002, s * 0.007));
    f.add(pupil);
    eye.receiveShadow = pupil.receiveShadow = true; // (in the shade with the rest of it: they were lit by the sun through the head and the trees — user, 2026-10-20)
  }
  // two wire legs pushed into the lawn, one a little bent from being stood on; `feet(a, b)`: where each ends,
  // down its own line (−0.06: 6 cm into the lawn) — up a sloping limb, one longer than the other
  const legMat = std({ color: 0x4a4744, metalness: 0.6, roughness: 0.6 }), legs = [];
  const legGeo = (s, bend, end) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.0, 0.56, s * 0.024), new THREE.Vector3(bend, 0.3 + (end + 0.06) / 2, s * 0.032), new THREE.Vector3(0.0, end, s * 0.036)]), 12, 0.0035, 6);
  for (const [s, bend] of [[1, 0.012], [-1, 0.035]]) {
    const m = new THREE.Mesh(legGeo(s, bend, -0.06), legMat);
    m.castShadow = m.receiveShadow = true;
    f.add(m);
    legs.push([m, s, bend]);
  }
  f.userData.feet = (...ends) => legs.forEach(([m, s, bend], i) => { m.geometry.dispose(); m.geometry = legGeo(s, bend, ends[i]); });
  return f;
}
