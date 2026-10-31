// Room shell (walls, window, blinds, door) and the lighting rig.
import * as THREE from 'three';
import * as T from './textures.js';
import { box, boxMM, cyl, plane, deg, YARD_SUN, HOUSE_SUN } from './util.js';
import { DAY } from './daytime.js';

// Metres. x = east, y = up, z = south. Interior faces: north wall z = 0, west wall x = 0.
export const ROOM = {
  W: 3.8, D: 4.2, H: 2.5, T: 0.14,
  win: { x0: 1.3, x1: 2.65, y0: 0.95, y1: 2.2 },
  door: { x0: 2.7, x1: 3.6, h: 2.03 },
};

export function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const wood = (base, dark, seed, rough = 0.62, repeat, opts) =>
    std({ map: T.woodTex(base, dark, seed, repeat, opts), roughness: rough });
  const cloth = (color, seed) =>
    std({ color, roughness: 1, bumpMap: T.noiseBump(seed, [6, 6]), bumpScale: 0.6, side: THREE.DoubleSide });
  return {
    carpet: std({ map: T.carpetTex(), bumpMap: T.carpetBump(), bumpScale: 1.4, roughness: 1 }),
    wall: std({ map: T.wallTex(), roughness: 0.94 }),
    ceiling: std({ color: 0xe2d8c4, roughness: 1 }),
    trim: std({ color: 0xe8e1d2, roughness: 0.5 }),
    hall: new THREE.MeshStandardMaterial({ color: 0x4a3e32, roughness: 1, side: THREE.BackSide }),
    door: std({ map: T.doorTex(), roughness: 0.48 }),
    brass: std({ color: 0xb58a42, metalness: 0.9, roughness: 0.56 }), // handled for years: a dull glow, not a mirror
    knob: std({ color: 0x8d8f94, metalness: 0.3, roughness: 0.45 }), // the knobs and pulls: plain grey, worn dull — mostly metal would only mirror the bright window and read white
    chrome: std({ color: 0xd9dade, metalness: 1, roughness: 0.2 }),
    slat: std({ color: 0xf3e6cc, roughness: 0.7, emissive: 0xffc98a, emissiveIntensity: 0.9, side: THREE.DoubleSide }),
    glass: std({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.1, depthWrite: false }), // what is behind it is drawn after it

    woodCabinet: wood('#7a4a2b', '#3d2313', 101),
    woodCabinetDoor: wood('#8a5632', '#44281a', 102),
    woodBed: wood('#a8713f', '#5f3a1c', 103, 0.55),
    woodDesk: wood('#8e633a', '#4d3018', 104, 0.42, [1, 1], { lengthwise: true, contrast: 0.45 }),
    woodDresser: wood('#7d5332', '#40260f', 105),

    sheet: std({ color: 0xded7ca, roughness: 1, bumpMap: T.noiseBump(15, [8, 8]), bumpScale: 0.4 }),
    plaid: std({ map: T.plaidTex(), roughness: 1, side: THREE.DoubleSide }),
    pillowPlaid: std({ map: T.pillowPlaidTex(), roughness: 1 }),
    pillowWhite: std({ color: 0xe9e2d2, roughness: 1 }),
    underBed: std({ color: 0x2a2420, roughness: 1 }),

    clothCream: cloth(0xcfc3aa, 201),
    clothRed: cloth(0x9c3f3b, 202),
    clothWhite: cloth(0xdcd6cb, 203),
    clothOlive: cloth(0x6e6b46, 204),
    clothNavy: cloth(0x2f3850, 205),
    clothDenim: cloth(0x3f4856, 206),
    clothDark: cloth(0x32363c, 207),
    canvasTan: cloth(0xb09a74, 208),
    canvasTanDark: cloth(0x8f7b58, 209),
    sock: cloth(0x9a9a98, 210),

    beige: std({ color: 0xcfc6b0, roughness: 0.6 }),
    beigeDark: std({ color: 0xa69d88, roughness: 0.65 }),
    tvGrey: std({ color: 0x8b8c90, roughness: 0.5 }),
    tvDark: std({ color: 0x2c2c2f, roughness: 0.5 }),
    consoleDark: std({ color: 0x55545a, roughness: 0.6 }),
    blackPlastic: std({ color: 0x18181a, roughness: 0.45 }),
    rubber: std({ color: 0x121213, roughness: 0.9 }),
    silver: std({ color: 0xbfc1c6, metalness: 0.85, roughness: 0.32 }),
    redLed: std({ color: 0x300000, emissive: 0xff2a1a, emissiveIntensity: 2.2 }),
    vinyl: std({ color: 0x0c0c0d, roughness: 0.28 }),
    paper: std({ color: 0xe7e0d0, roughness: 0.9 }),
  };
}

function trimFrame(g, M, x0, x1, y0, y1, z, wide, proud, withBottom) {
  g.add(boxMM(x0 - wide, x0, y0 - (withBottom ? wide : 0), y1 + wide, z, z + proud, M.trim));
  g.add(boxMM(x1, x1 + wide, y0 - (withBottom ? wide : 0), y1 + wide, z, z + proud, M.trim));
  g.add(boxMM(x0, x1, y1, y1 + wide, z, z + proud, M.trim));
  if (withBottom) g.add(boxMM(x0, x1, y0 - wide, y0, z, z + proud, M.trim));
}

export function buildShell(scene, M) {
  const { W, D, H, T: t, win, door } = ROOM;
  const g = new THREE.Group();
  scene.add(g);

  const floor = plane(W, D, M.carpet, W / 2, 0, D / 2);
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  const ceil = plane(W, D, M.ceiling, W / 2, H, D / 2);
  ceil.rotation.x = Math.PI / 2;
  g.add(ceil);

  // walls: boxes so the window reveal has depth and the sun is blocked everywhere else
  g.add(boxMM(-t, 0, 0, H, -t, D + t, M.wall));
  g.add(boxMM(W, W + t, 0, H, -t, D + t, M.wall));
  g.add(boxMM(0, win.x0, 0, H, -t, 0, M.wall));
  g.add(boxMM(win.x1, W, 0, H, -t, 0, M.wall));
  g.add(boxMM(win.x0, win.x1, 0, win.y0, -t, 0, M.wall));
  g.add(boxMM(win.x0, win.x1, win.y1, H, -t, 0, M.wall));
  g.add(boxMM(0, door.x0, 0, H, D, D + t, M.wall));
  g.add(boxMM(door.x1, W, 0, H, D, D + t, M.wall));
  g.add(boxMM(door.x0, door.x1, door.h, H, D, D + t, M.wall));

  // baseboards
  const bb = (x0, x1, z0, z1) => g.add(boxMM(x0, x1, 0, 0.09, z0, z1, M.trim));
  bb(0, 0.014, 0, D);
  bb(W - 0.014, W, 0, D);
  bb(0.014, W - 0.014, 0, 0.014); // (between the side ones, not through them: their tops in one plane flickered in the corners)
  bb(0.014, door.x0 - 0.07, D - 0.014, D);
  bb(door.x1 + 0.07, W - 0.014, D - 0.014, D);

  // ceiling lamp (off — it's the sun doing the work)
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe8e0cf, roughness: 0.35 })
  );
  lamp.scale.y = 0.5;
  lamp.position.set(1.9, H, 2.2);
  g.add(lamp);
  g.add(cyl(0.19, 0.19, 0.012, M.brass, 1.9, H - 0.006, 2.2));

  // light switch by the door
  g.add(box(0.07, 0.115, 0.008, M.trim, door.x0 - 0.2, 1.2, D - 0.004));
  g.add(box(0.012, 0.028, 0.012, M.trim, door.x0 - 0.2, 1.205, D - 0.012));

  return g;
}

export function buildWindow(scene, M) {
  const { T: t, win } = ROOM;
  const g = new THREE.Group();
  scene.add(g);
  const ww = win.x1 - win.x0;
  const cx = (win.x0 + win.x1) / 2;
  const midY = (win.y0 + win.y1) / 2;

  // what's outside is the yard itself (house.js)

  // interior casing and sill — and the sash: painted wood, flat, not the door's satin (user, 2026-10-19: "the
  // window's frame reflects too much": right by the glass it gave back the bright window of the room's
  // reflection, at full strength; its own, dim, and rougher)
  const frameTrim = M.trim.clone();
  Object.assign(frameTrim, { roughness: 0.8, envMap: scene.environment, envMapIntensity: 0.25 });
  outward(frameTrim);
  outward(M.slat, true);
  const FM = { ...M, trim: frameTrim };
  trimFrame(g, FM, win.x0, win.x1, win.y0, win.y1, 0, 0.075, 0.018, false);
  g.add(boxMM(win.x0 - 0.1, win.x1 + 0.1, win.y0 - 0.035, win.y0, -0.02, 0.085, frameTrim));
  g.add(boxMM(win.x0 - 0.075, win.x1 + 0.075, win.y0 - 0.11, win.y0 - 0.035, 0, 0.016, frameTrim));
  // sash: frame + meeting rail of a double-hung window, set back in the reveal
  const sz0 = -0.105, sz1 = -0.07, sw = 0.045;
  g.add(boxMM(win.x0, win.x0 + sw, win.y0, win.y1, sz0, sz1, frameTrim));
  g.add(boxMM(win.x1 - sw, win.x1, win.y0, win.y1, sz0, sz1, frameTrim));
  g.add(boxMM(win.x0, win.x1, win.y1 - sw, win.y1, sz0, sz1, frameTrim));
  g.add(boxMM(win.x0, win.x1, win.y0, win.y0 + sw, sz0, sz1, frameTrim));
  g.add(boxMM(win.x0, win.x1, midY - 0.022, midY + 0.022, sz0, sz1, frameTrim));
  // the glass (user, 2026-10-15: "the window doesn't look like there's glass"): what gives glass away is
  // what is on it and what it gives back — dust, dried rain, a wipe, small fingers; a faint haze over
  // the yard; and the room seen in it, dimly, more at a slant. Two layers: the dirt, and the reflection
  // alone, added on top (a transparent pane's own reflection is scaled down with its opacity). Both
  // are drawn with the house (main.js moves them): the yard is the house's, drawn after the bedroom, and
  // glass drawn before it was simply painted over.
  const pane = new THREE.PlaneGeometry(ww, win.y1 - win.y0);
  // (one-sided, from the room: made two-sided, the room's own reflection showed on it from the yard, and looked
  // wrong — user, 2026-10-18: "put it back as it was")
  const dirt = new THREE.Mesh(pane, new THREE.MeshBasicMaterial({ map: T.windowDirtTex(ww, win.y1 - win.y0), transparent: true, depthWrite: false }));
  const sheen = new THREE.Mesh(pane, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, envMap: scene.environment, envMapIntensity: 4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (const [m, z] of [[dirt, -0.088], [sheen, -0.0878]]) {
    m.position.set(cx, midY, z);
    m.receiveShadow = false;
    m.castShadow = false;
    g.add(m);
  }
  // something small left on the sill
  g.add(box(0.11, 0.022, 0.05, M.blackPlastic, win.x1 - 0.22, win.y0 + 0.011, 0.03));

  // ---- venetian blind: real slats, so the stripes on the wall are real shadows. It comes all the way
  // down to the sill (user, 2026-10-15): open, it is pulled up as it always was, a strip of the street
  // under it, slats half shut; closed, let right down and the slats shut. Pulled up, the slats it has
  // gathered lie stacked flat on its bottom rail, as on a real one.
  const blind = new THREE.Group();
  g.add(blind);
  const bz = -0.04;
  const top = win.y1 - 0.045;
  const UP = win.y0 + 0.31, DOWN = win.y0 + 0.011; // where its bottom rail hangs, pulled up / let down to the sill
  const pitch = 0.03, STACK = 0.0021; // between hanging slats; between stacked ones
  // (the slats to within 3 mm of the reveal, the head down over the top slat: shut, the sun still came in by a slit
  // either side, 15 mm, and one under the head, 7 mm — a band of light up the TV's wall, the TV's screen lit; user,
  // 2026-10-28)
  const slatW = ww - 0.006;
  const head = box(slatW + 0.004, 0.055, 0.05, M.trim, cx, win.y1 - 0.0275, bz);
  blind.add(head);
  const slatGeo = new THREE.BoxGeometry(slatW, 0.0016, 0.036);
  const slats = [];
  for (let y = top - 0.02; y > DOWN + 0.012; y -= pitch) {
    const s = new THREE.Mesh(slatGeo, M.slat);
    s.position.set(cx, y, bz);
    s.userData.hang = y;
    s.castShadow = true;
    s.receiveShadow = false;
    blind.add(s);
    slats.push(s);
  }
  const rail = box(slatW, 0.02, 0.03, M.trim, cx, UP, bz);
  blind.add(rail);
  const cords = [-0.42, 0.42].map((dx) => {
    const cord = cyl(0.0012, 0.0012, 1, M.trim, cx + dx, 0, bz, 5); // stretched to the rail as it moves
    cord.castShadow = false;
    blind.add(cord);
    return cord;
  });
  const wand = cyl(0.004, 0.004, 0.6, M.glass, win.x0 + 0.06, top - 0.32, 0.0, 6);
  wand.castShadow = false;
  blind.add(wand);

  // generous invisible target so the blind is easy to aim at
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(ww, win.y1 - win.y0, 0.12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.set(cx, midY, -0.04);
  blind.add(hit);

  // `drop`: 0 pulled up, 1 let right down; both it and `tilt` ease to their targets (`step`)
  const state = { tilt: deg(32), target: deg(32), drop: 0, dropTarget: 0, mode: 0 };
  const apply = () => {
    const y = UP + (DOWN - UP) * state.drop;
    rail.position.y = y;
    slats.forEach((s, i) => {
      const stacked = y + 0.0118 + (slats.length - 1 - i) * STACK; // where it lies if it is in the stack
      const flat = s.userData.hang < stacked;
      s.position.y = flat ? stacked : s.userData.hang;
      s.rotation.x = flat ? 0 : state.tilt;
    });
    for (const c of cords) {
      c.scale.y = top - y;
      c.position.y = (top + y) / 2;
    }
  };
  apply();
  /** Every frame: eases the slats' tilt and the blind's height to their targets; true if anything moved. */
  // letting it go (user, 2026-10-15: closing, it snaps down as if it fell): the cord let slip, the rail
  // drops from rest, faster and faster, hits the sill, kicks back up a few millimetres and lies there.
  // Pulled up, it goes as it always did.
  const FALL = UP - DOWN, PULL = 6; // metres it falls; m/s² (gravity, less the cord running through its lock)
  let fall = null; // its speed (m/s) while it is falling
  const step = (dt) => {
    const dTilt = state.target - state.tilt, dDrop = state.dropTarget - state.drop;
    if (Math.abs(dTilt) < 1e-4 && Math.abs(dDrop) < 1e-4 && !fall) return false;
    state.tilt += dTilt * (1 - Math.exp(-dt * 7));
    if (state.dropTarget === 1 && (fall || dDrop > 1e-4)) {
      fall = fall ?? { v: 0 };
      fall.v += PULL * dt;
      state.drop += (fall.v * dt) / FALL;
      if (state.drop >= 1) {
        state.drop = 1;
        fall.v = -fall.v * 0.18; // the knock on the sill, and a little bounce
        if (Math.abs(fall.v) < 0.05) fall = null;
      }
    } else {
      fall = null;
      state.drop += Math.abs(dDrop) < 1e-3 ? dDrop : dDrop * (1 - Math.exp(-dt * 2.6)); // pulled up hand over hand
    }
    apply();
    return true;
  };

  return { group: blind, slats, state, apply, step, glass: [dirt, sheen] };
}

export function buildDoor(scene, M, colliders) {
  const { D, T: t, door } = ROOM;
  const g = new THREE.Group();
  scene.add(g);
  const dw = door.x1 - door.x0;

  // casing, both faces of the wall, and jamb liners through its thickness
  trimFrame(g, M, door.x0, door.x1, 0, door.h, D - 0.018, 0.075, 0.018, false);
  g.add(boxMM(door.x0, door.x0 + 0.02, 0, door.h, D, D + t, M.trim));
  g.add(boxMM(door.x1 - 0.02, door.x1, 0, door.h, D, D + t, M.trim));
  g.add(boxMM(door.x0, door.x1, door.h - 0.02, door.h, D, D + t, M.trim));

  // leaf, pivoting on the west jamb, swinging into the room
  const pivot = new THREE.Group();
  pivot.position.set(door.x0 + 0.02, 0, D + 0.02);
  g.add(pivot);
  const lw = dw - 0.045, lh = door.h - 0.03, lt = 0.04;
  const edge = M.trim;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, lt), [edge, edge, edge, edge, M.door, M.door]);
  leaf.position.set(lw / 2, lh / 2 + 0.008, 0);
  leaf.castShadow = leaf.receiveShadow = true;
  pivot.add(leaf);
  for (const side of [1, -1]) {
    const rose = cyl(0.03, 0.03, 0.008, M.knob, lw - 0.07, 0.96, side * (lt / 2 + 0.004));
    rose.rotation.x = Math.PI / 2;
    pivot.add(rose);
    const stem = cyl(0.01, 0.012, 0.04, M.knob, lw - 0.07, 0.96, side * (lt / 2 + 0.024));
    stem.rotation.x = Math.PI / 2;
    pivot.add(stem);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.031, 24, 16), M.knob);
    knob.scale.z = 0.8;
    knob.position.set(lw - 0.07, 0.96, side * (lt / 2 + 0.05));
    knob.castShadow = knob.receiveShadow = true;
    pivot.add(knob);
  }

  const state = { angle: deg(108), target: deg(108), open: true };
  // the leaf is a thin moving wall: a segment collider that follows the hinge angle
  const seg = { type: 'seg', ax: 0, az: 0, bx: 0, bz: 0, r: 0.05 };
  colliders.push(seg);
  const apply = () => {
    pivot.rotation.y = state.angle;
    seg.ax = pivot.position.x;
    seg.az = pivot.position.z;
    seg.bx = pivot.position.x + Math.cos(state.angle) * lw;
    seg.bz = pivot.position.z - Math.sin(state.angle) * lw;
  };
  apply();
  return { group: pivot, state, apply };
}

/**
 * The look of the reference photo: one low, warm sun raking through the blind onto the west
 * wall; the blind itself glowing and softly lighting the bed; two cold CRT pools; and very
 * little else, so the corners fall off into brown shadow.
 */
export function buildLights(scene) {
  const { win } = ROOM;
  const cx = (win.x0 + win.x1) / 2;
  const cy = (win.y0 + win.y1) / 2;

  const hemi = new THREE.HemisphereLight(DAY.hemi.sky, DAY.hemi.ground, DAY.hemi.room);
  scene.add(hemi);

  // the time of day (daytime.js) decides where the sun stands and how warm it is
  const sun = new THREE.SpotLight(DAY.sun.color, DAY.sun.room.cd, 0, 0.24, 0.25, 2);
  sun.position.set(...DAY.sun.room.at);
  sun.target.position.set(cx, cy, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 2.5;
  sun.shadow.camera.far = 13;
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.004;
  scene.add(sun, sun.target);

  // the lit blind as a soft source
  const glow = new THREE.SpotLight(DAY.glow.color, DAY.glow.intensity, 6, 1.25, 1, 2);
  glow.position.set(cx, 1.8, 0.14);
  glow.target.position.set(cx - 0.35, 0.2, 2.0);
  glow.castShadow = true;
  glow.shadow.mapSize.set(2048, 2048);
  // (a spot's shadow depth is perspective: with near at 0.1 m a bias of −0.0008 was worth 3 cm at the bed and 13 at
  // the far wall, and things stood on the floor with a gap of light under their shadows — user, 2026-10-28.
  // Nothing in the room is nearer the blind than half a metre)
  glow.shadow.camera.near = 0.5;
  glow.shadow.camera.far = 6;
  glow.shadow.bias = -0.0001;
  glow.shadow.normalBias = 0.005;
  scene.add(glow, glow.target);

  // where the sun lands, bouncing back into the room
  const bounce = new THREE.PointLight(DAY.bounce.color, DAY.bounce.intensity, 4.5, 2);
  bounce.position.set(...DAY.bounce.at);
  scene.add(bounce);

  const tv = new THREE.PointLight(0x86b4ff, 0.55, 2.6, 2);
  const pc = new THREE.PointLight(0x74e2d6, 0.5, 2.4, 2);
  scene.add(tv, pc);

  return { hemi, sun, glow, bounce, tv, pc };
}

/** Tiny stand-in room for image-based reflections: brown box, hot window, warm west wall. */
export function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(
    new THREE.BoxGeometry(8, 5, 8),
    new THREE.MeshBasicMaterial({ color: 0x2c2016, side: THREE.BackSide })
  ));
  const panel = (w, h, color, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    env.add(m);
  };
  panel(2.2, 1.9, new THREE.Color(...DAY.env.window), 0.2, 0.6, -3.95, 0);
  panel(3.4, 1.6, new THREE.Color(...DAY.env.wall), -3.95, 0.8, 0.4, Math.PI / 2);
  panel(1.0, 0.8, new THREE.Color(0.5, 1.4, 1.3), 3.9, -0.4, -1.2, -Math.PI / 2);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.05).texture;
  pm.dispose();
  return tex;
}

/**
 * The faces of the window's frame and the blind's slats that look out into the yard (−z) lit for an eye out there
 * (user, 2026-10-20: "from outside, my window's frame is too white — the blind too"): the bedroom's own light, made
 * for the room, at the yard's strength (YARD_SUN: 1 indoors), and the slats' glow — the light through them, seen
 * from inside — not on their outer face at all (`glow`). From inside nothing changes.
 */
function outward(m, glow = false) {
  const before = m.onBeforeCompile, key = m.customProgramCacheKey.bind(m);
  const sh0 = () => HOUSE_SUN.light?.shadow, none = new THREE.Matrix4(), one = new THREE.Vector2(1, 1), toSun = new THREE.Vector3(0, 1, 0);
  m.onBeforeCompile = (sh, r) => {
    before.call(m, sh, r);
    sh.uniforms.uYardSun = YARD_SUN;
    sh.uniforms.uHouseShadow = { get value() { return sh0()?.map?.texture ?? null; } };
    sh.uniforms.uHouseShadowMatrix = { get value() { return sh0()?.matrix ?? none; } };
    sh.uniforms.uHouseShadowSize = { get value() { return sh0()?.mapSize ?? one; } };
    sh.uniforms.uHouseShadowBias = { get value() { return sh0() ? [sh0().bias, HOUSE_SUN.wallZ - 0.03, sh0().radius, sh0().map ? 1 : 0] : [0, 0, 1, 0]; } };
    sh.uniforms.uHouseSunDir = { get value() { const l = HOUSE_SUN.light; return l ? toSun.subVectors(l.position, l.target.position).normalize() : toSun; } };
    sh.vertexShader = 'varying vec3 vHouseWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tvHouseWP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    // (the house's sun's shadows too, on the light that comes straight in — the roof's, the trees' — as the kitchen's
    // window has them: user, 2026-10-20 "the shadows fall differently on my window from outside than on the kitchen's")
    sh.fragmentShader = 'uniform float uYardSun;\nuniform sampler2D uHouseShadow;\nuniform mat4 uHouseShadowMatrix;\nuniform vec2 uHouseShadowSize;\nuniform vec4 uHouseShadowBias;\nuniform vec3 uHouseSunDir;\nvarying vec3 vHouseWP;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `{
      vec3 wn = inverseTransformDirection( normal, viewMatrix );
      if ( wn.z < -0.3 ) {
        float hs = 1.0;
        #ifdef USE_SHADOWMAP
          // (taken where the light comes in, out in front of the wall: to the house's sun the bedroom is one solid block)
          if ( uHouseShadowBias.w > 0.5 ) hs = uHouseSunDir.z < -0.02 ? getShadow( uHouseShadow, uHouseShadowSize, 1.0, uHouseShadowBias.x, uHouseShadowBias.z, uHouseShadowMatrix * vec4( vHouseWP + uHouseSunDir * ( ( uHouseShadowBias.y - vHouseWP.z ) / uHouseSunDir.z ), 1.0 ) ) : 0.0;
        #endif
        outgoingLight = (outgoingLight${glow ? ' - totalEmissiveRadiance' : ''} - ( reflectedLight.directDiffuse + reflectedLight.directSpecular ) * ( 1.0 - hs )) * uYardSun;
      }
    }
    #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => key() + '|outward';
  m.needsUpdate = true;
}
