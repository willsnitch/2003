// Furniture and clutter. Positions are world metres (see ROOM in room.js).
import * as THREE from 'three';
import * as T from './textures.js';
import { ROOM } from './room.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCoat, ellipsoid, furPart } from './fur.js';
import { box, boxMM, rbox, cyl, plane, blob, pillow, drape, cable, deg, mulberry32, imageTex } from './util.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const M_RUBBER = std({ color: 0x121213, roughness: 0.9 });

export function curvedScreen(w, h, bulge, mat) {
  const geo = new THREE.PlaneGeometry(w, h, 18, 14);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i) / (w / 2), ny = p.getY(i) / (h / 2);
    p.setZ(i, bulge * (1 - 0.5 * (nx * nx + ny * ny)));
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

export function screenMat(tex) {
  // glass with a soft sheen: glossy enough to catch the glow light, not so glossy it mirrors it as a white spot
  return std({ color: 0x060606, roughness: 0.34, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.5 });
}

/** World-space [x, y, z] of a point given in an object's own frame — for cable ends. */
function worldPt(obj, x, y, z) {
  return obj.localToWorld(new THREE.Vector3(x, y, z)).toArray();
}

/** One material on the top face of a box, another on the sides (keyboards, pads, cases). */
function toppedBox(w, h, d, top, side) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, side, side, side]);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- things you can pick up

// What gives a thing you can take away: a thin rim of blue-white light round it, breathing a little.
const RIM = new THREE.Color(0.1, 0.42, 1);
const rimMat = new THREE.MeshBasicMaterial({ color: RIM.clone(), side: THREE.BackSide, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });

/** The shape of `obj` swollen by `width` all round and turned inside out, so that it shows past its edges and nowhere else. */
function rimOf(obj, width) {
  const rim = new THREE.Group();
  obj.updateMatrixWorld(true);
  const home = obj.matrixWorld.clone().invert(), rel = new THREE.Matrix4(), p = new THREE.Vector3(), n = new THREE.Vector3();
  obj.traverse((part) => {
    if (!part.isMesh || part.userData.noRim) return; // a part that sits wholly inside the outline would only draw a stray ring
    let geo = part.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (name !== 'position') geo.deleteAttribute(name);
    geo.applyMatrix4(rel.multiplyMatrices(home, part.matrixWorld));
    geo = mergeVertices(geo, 1e-5); // one normal to a corner, or the swollen faces would come apart along every edge
    geo.computeVertexNormals();
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).addScaledVector(n.fromBufferAttribute(nor, i), width);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    rim.add(new THREE.Mesh(geo, rimMat));
  });
  return rim;
}

/**
 * Makes `obj` something that can be taken and kept (ctx.inventory). It is not on offer until
 * the returned function is called — once it has stopped moving, say.
 * `reach`: [length, width] of the box that makes it easier to point at; `grip.turn`: which way it points when held;
 * `taken`: called once it has been taken.
 */
export function takeable(ctx, obj, { id, name, line, reach: [w, d], grip, taken = null }) {
  const aid = new THREE.Group(); // what helps you find it and point at it: not part of the thing itself
  aid.userData.aid = true;
  const rim = rimOf(obj, 0.002);
  rim.visible = false; // (lit only while you are pointing at it: main.js, updateFocus — user, 2026-10-20: it was always on)
  obj.userData.rim = rim;
  aid.add(rim);
  const grab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), new THREE.MeshBasicMaterial({ visible: false }));
  grab.position.y = 0.006;
  aid.add(grab);
  aid.visible = false;
  obj.add(aid);
  obj.userData.interact = {
    label: () => `Take the ${name}`,
    use: () => {
      const i = ctx.interact.indexOf(obj);
      if (i < 0) return; // a second press before the prompt has caught up
      ctx.interact.splice(i, 1);
      ctx.inventory.add(id, name, obj, grip);
      obj.visible = false;
      ctx.sound.take(obj.getWorldPosition(new THREE.Vector3()));
      ctx.touch();
      taken?.(); // (out in the house: its lamps' shadows drawn again without it)
    },
    say: line,
  };
  return () => {
    aid.visible = true;
    ctx.interact.push(obj);
  };
}

// ---------------------------------------------------------------- posters

function poster(scene, tex, w, h, wall, along, y, tilt = 0, lift = 0) {
  const geo = new THREE.PlaneGeometry(w, h, 6, 6);
  // paper bows away from the wall a few millimetres, so it catches light unevenly
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i) / (w / 2), ny = p.getY(i) / (h / 2);
    p.setZ(i, 0.006 * (1 - nx * nx) * (0.4 + 0.6 * ny * ny));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, std({ map: tex, roughness: 0.62 }));
  const off = 0.003 + lift;
  if (wall === 'W') { m.position.set(off, y, along); m.rotation.y = Math.PI / 2; }
  if (wall === 'N') { m.position.set(along, y, off); }
  if (wall === 'E') { m.position.set(ROOM.W - off, y, along); m.rotation.y = -Math.PI / 2; }
  if (wall === 'S') { m.position.set(along, y, ROOM.D - off); m.rotation.y = Math.PI; }
  m.rotateZ(tilt);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

function buildPosters(scene) {
  // west wall, south → north (left → right as you face it)
  poster(scene, T.posterPanelsTex(), 0.4, 0.83, 'W', 3.3, 1.72, deg(0.6));
  poster(scene, T.posterSprayTex(), 0.95, 0.63, 'W', 2.5, 1.86, deg(-1.2));
  poster(scene, T.posterBandTex(), 0.3, 0.4, 'W', 1.78, 2.2, deg(1.5));
  // (the wall over the headboard is left clear for the shelf)
  // north wall, either side of the window
  // the tour poster got torn in two: the left piece is still where it was, the right piece was
  // stuck back up on the other side of the window, high, over the edge of the poster already there
  const [tornLeft, tornRight] = T.posterSepiaTornTex(), tornW = 0.62 * T.TORN_POSTER.piece;
  poster(scene, tornLeft, tornW, 0.43, 'N', 0.74 - 0.31 + tornW / 2, 1.36, deg(1.2), 0.002).material.alphaTest = 0.5;
  poster(scene, tornRight, tornW, 0.43, 'N', 2.745 + tornW / 2, 2.1, deg(-2.6), 0.004).material.alphaTest = 0.5; // below the other poster's lettering
  poster(scene, T.posterRapTex(), 0.7, 0.79, 'N', 3.27, 2.08, deg(0.4));
  poster(scene, T.stickerGraffitiTex(), 0.44, 0.22, 'N', 3.0, 1.6, deg(2.5), 0.002);
  poster(scene, T.posterSkullTex(), 0.42, 0.33, 'N', 3.52, 1.56, deg(-0.8), 0.002);
  poster(scene, T.posterStuntTex(), 0.36, 0.47, 'N', 2.96, 1.2, deg(0.6));
  // east wall, in shadow above the desk
  poster(scene, T.posterGenericTex('PUNK', '#3a2030', '#120a10', '#e9d9c0', 301), 0.45, 0.64, 'E', 0.95, 1.95, deg(-0.7));
  poster(scene, T.posterGenericTex('SK8', '#2c3340', '#0e1116', '#e6c84a', 303), 0.45, 0.64, 'E', 1.6, 1.86, deg(0.9));
  poster(scene, T.posterGenericTex('RIDE', '#40301c', '#150f08', '#e9e2d0', 305), 0.45, 0.64, 'E', 2.3, 1.95, deg(-0.4));
  // south wall
  poster(scene, T.posterGenericTex('X-TREME', '#243a52', '#0b121a', '#f0e9d8', 307), 0.6, 0.86, 'S', 1.3, 1.7, deg(0.8));
}

// ---------------------------------------------------------------- console

/** Charcoal 64-bit console, unbranded: humped top, a cartridge in the slot, four pad ports. Front is +z. */
function buildConsole(M) {
  const shell = std({ color: 0x2c2c30, roughness: 0.5 });
  const trim = std({ color: 0x3b3b41, roughness: 0.45 });
  const grey = std({ color: 0x8d8e93, roughness: 0.55 });
  const con = new THREE.Group();
  con.add(rbox(0.26, 0.046, 0.19, 0.016, shell, 0, 0.023, 0, 4));
  // rounded feet bulging out of the front corners
  for (const s of [-1, 1]) con.add(cyl(0.031, 0.034, 0.04, shell, s * 0.1, 0.02, 0.074, 20));
  // raised spine down the middle, with the cartridge standing in its slot
  con.add(rbox(0.15, 0.03, 0.165, 0.014, shell, 0, 0.054, -0.006, 4));
  con.add(box(0.122, 0.004, 0.026, M.tvDark, 0, 0.0695, -0.012));
  con.add(rbox(0.116, 0.078, 0.019, 0.008, grey, 0, 0.105, -0.012, 3));
  con.add(plane(0.084, 0.05, std({ map: T.cartLabelTex(), roughness: 0.4 }), 0, 0.112, -0.0022));
  // expansion bay lid, power slider, reset button, power light
  con.add(box(0.052, 0.003, 0.04, trim, 0, 0.0695, 0.05));
  con.add(box(0.03, 0.007, 0.012, grey, -0.1, 0.049, -0.01));
  con.add(cyl(0.008, 0.008, 0.006, grey, 0.1, 0.049, -0.01, 14));
  con.add(box(0.006, 0.004, 0.003, M.redLed, 0, 0.04, 0.0955));
  // four controller ports along the front, between the feet
  con.userData.ports = [-0.06, -0.02, 0.02, 0.06];
  for (const x of con.userData.ports) {
    con.add(box(0.034, 0.022, 0.004, grey, x, 0.02, 0.096));
    con.add(box(0.022, 0.012, 0.005, M.tvDark, x, 0.02, 0.097));
  }
  return con;
}

/**
 * The console's three-pronged pad, lying on its back: stick on the middle grip, d-pad on the
 * left, six face buttons on the right. The cable leaves from the middle of the top edge (−z).
 */
function buildPad(color) {
  const shell = std({ color, roughness: 0.5 });
  const dark = std({ color: 0x38383c, roughness: 0.5 });
  const stick = std({ color: 0x9a9ba0, roughness: 0.6 });
  const pad = new THREE.Group();
  pad.add(rbox(0.152, 0.03, 0.056, 0.014, shell, 0, 0.016, -0.004, 4));
  for (const s of [-1, 1]) {
    const grip = rbox(0.038, 0.03, 0.088, 0.015, shell, s * 0.058, 0.016, 0.05, 4);
    grip.rotation.y = s * 0.24; // outer grips splay away from the middle one
    pad.add(grip);
    pad.add(box(0.036, 0.012, 0.01, dark, s * 0.052, 0.021, -0.034));
  }
  pad.add(rbox(0.036, 0.032, 0.095, 0.015, shell, 0, 0.016, 0.058, 4));
  pad.add(cyl(0.012, 0.013, 0.004, dark, 0, 0.034, 0.045, 16));
  pad.add(cyl(0.0035, 0.0035, 0.014, stick, 0, 0.041, 0.045, 8));
  pad.add(cyl(0.008, 0.007, 0.004, stick, 0, 0.049, 0.045, 14));
  pad.add(box(0.026, 0.004, 0.009, dark, -0.05, 0.033, -0.004));
  pad.add(box(0.009, 0.004, 0.026, dark, -0.05, 0.033, -0.004));
  const button = (r, c, x, z) => pad.add(cyl(r, r, 0.004, std({ color: c, roughness: 0.4 }), x, 0.033, z, 14));
  button(0.0055, 0xb8262a, 0, -0.008);
  button(0.007, 0x2f8f4a, 0.034, 0.002);
  button(0.007, 0x2b5cc0, 0.045, 0.014);
  for (const [dx, dz] of [[0, -0.011], [0, 0.011], [-0.011, 0], [0.011, 0]]) button(0.0048, 0xe2b93a, 0.06 + dx, -0.01 + dz);
  // strain relief where the lead leaves
  const nub = cyl(0.0045, 0.0045, 0.014, M_RUBBER, 0, 0.014, -0.037, 8);
  nub.rotation.x = Math.PI / 2;
  pad.add(nub);
  return pad;
}

// ---------------------------------------------------------------- TV corner

function buildTvCorner(scene, M, ctx) {
  const cab = new THREE.Group();
  cab.position.set(0.36, 0, 2.02);
  scene.add(cab);
  cab.add(box(0.6, 0.04, 1.03, M.underBed, 0, 0.02, 0));
  cab.add(box(0.62, 0.53, 1.06, M.woodCabinet, 0, 0.305, 0));
  cab.add(box(0.66, 0.035, 1.1, M.woodCabinet, 0, 0.5875, 0));
  for (const z of [-0.265, 0.265]) {
    cab.add(box(0.016, 0.44, 0.47, M.woodCabinetDoor, 0.316, 0.3, z));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), M.knob);
    knob.position.set(0.336, 0.33, z - Math.sign(z) * 0.18);
    knob.castShadow = knob.receiveShadow = true; // in shadow where the cabinet is, not lit through it
    cab.add(knob);
  }
  cab.add(box(0.012, 0.44, 0.05, std({ color: 0x1e3a66, roughness: 0.5 }), 0.312, 0.3, 0));
  // a dinosaur sticker on one door, where an eight-year-old thought it should go: nowhere in particular, and not straight
  const sticker = plane(0.088, 0.088, std({ map: T.dinoStickerTex(), alphaTest: 0.5, roughness: 0.34 }), 0.3246, 0.385, 0.345);
  sticker.rotation.y = Math.PI / 2; // on the front of the door, facing the room
  sticker.rotateZ(deg(-17));
  cab.add(sticker);
  // the cabinet can be climbed; the TV standing on it is still in the way up there
  ctx.colliders.push({ type: 'box', x0: 0.0, x1: 0.71, z0: 1.46, z1: 2.58, top: 0.605, stand: true });
  ctx.colliders.push({ type: 'box', x0: 0.0, x1: 0.71, z0: 1.46, z1: 2.2, base: 0.605, top: 1.25 });
  const topY = 0.605;

  // game case left on the cabinet
  const caseTop = std({ map: T.coverTex('RALLY', '#1c2a4a', '#f2d23c', '#b8322c', 401), roughness: 0.4 });
  const gameCase = toppedBox(0.135, 0.014, 0.19, caseTop, M.blackPlastic);
  gameCase.position.set(-0.08, 0.517, 0.14); // on top of the set
  gameCase.rotation.y = deg(14);

  // ---- CRT television
  const tv = new THREE.Group();
  tv.position.set(0.39, topY, 1.85);
  tv.rotation.y = deg(90); // square to the wall, screen facing straight into the room
  scene.add(tv);
  tv.add(rbox(0.6, 0.5, 0.16, 0.022, M.tvGrey, 0, 0.26, 0.15));
  tv.add(box(0.54, 0.49, 0.22, M.tvGrey, 0, 0.26, -0.02));
  tv.add(box(0.4, 0.34, 0.14, M.tvGrey, 0, 0.24, -0.19));
  tv.add(box(0.5, 0.39, 0.01, M.tvDark, 0, 0.29, 0.229));
  const tvScreenMat = screenMat(T.tvScreenTex());
  const tvScreen = curvedScreen(0.45, 0.345, 0.014, tvScreenMat);
  tvScreen.position.set(0, 0.29, 0.235);
  tv.add(tvScreen);
  // control strip
  tv.add(box(0.56, 0.006, 0.006, M.tvDark, 0, 0.082, 0.231));
  for (let i = 0; i < 4; i++) tv.add(box(0.022, 0.012, 0.008, M.tvDark, 0.12 + i * 0.036, 0.05, 0.232));
  tv.add(box(0.012, 0.008, 0.006, M.redLed, -0.24, 0.05, 0.232));
  for (const x of [-0.24, 0.24]) tv.add(box(0.06, 0.02, 0.3, M.tvDark, x, 0.01, 0.02));

  tv.add(gameCase);

  // ---- the console, on the cabinet beside the set
  const con = buildConsole(M);
  con.position.set(0.5, topY, 2.36);
  con.rotation.y = deg(90);
  scene.add(con);
  con.updateMatrixWorld(true);

  tv.updateMatrixWorld(true);
  ctx.lights.tv.position.copy(tv.localToWorld(new THREE.Vector3(0, 0.3, 0.6)));

  const state = { on: false }; // the set is off when you come home
  tvScreenMat.emissiveIntensity = 0;
  tv.userData.interact = {
    label: () => (state.on ? 'Turn off the TV' : 'Turn on the TV'),
    use: () => {
      state.on = !state.on;
      tvScreenMat.emissiveIntensity = state.on ? 1.5 : 0;
      ctx.lights.tv.userData.base = state.on ? 0.55 : 0;
      ctx.sound.crt(state.on, tv.position);
      ctx.sound.setTv(state.on);
    },
  };
  ctx.lights.tv.userData.base = 0;
  ctx.interact.push(tv);
  // for jumping into the picture: whether there is one, and where the middle of the glass is
  const titleScreen = tvScreenMat.emissiveMap;
  ctx.tv = {
    get on() { return state.on; },
    screen: tv.localToWorld(new THREE.Vector3(0, 0.29, 0.25)),
    /** What is on it: a texture, or nothing for the title screen. */
    show(picture) { tvScreenMat.emissiveMap = picture ?? titleScreen; },
  };

  // ---- the blue pad on the carpet, plugged into the first port on the front of the console
  const pad = buildPad(0x2f4f9e);
  pad.position.set(1.46, 0, 2.08);
  pad.rotation.y = deg(-38);
  scene.add(pad);
  pad.updateMatrixWorld(true);
  const px = con.userData.ports[0];
  con.add(box(0.026, 0.014, 0.02, M.consoleDark, px, 0.02, 0.107)); // the plug
  // out of the plug, across the cabinet top, over its front edge, down to the carpet and away
  scene.add(cable([
    worldPt(con, px, 0.02, 0.118), worldPt(con, px, 0.006, 0.165), worldPt(con, px, -0.02, 0.208),
    worldPt(con, px, -0.3, 0.218), worldPt(con, px, -0.593, 0.26),
    [0.86, 0.006, 2.2], [1.12, 0.006, 2.16], [1.44, 0.013, 2.25], [1.6, 0.006, 2.2], [1.6, 0.006, 2.06], // clear of the clothes heap and of where the backpack spills
    worldPt(pad, 0, 0.004, -0.1), worldPt(pad, 0, 0.014, -0.045),
  ], 0.0035, M.rubber));
  return { tv, con };
}

// ---------------------------------------------------------------- power

/** A wall socket, the strip on the floor by the bed, and the TV and console plugged into it. */
function buildPower(scene, M, { tv, con }) {
  const white = std({ color: 0xdcd6c8, roughness: 0.5 });
  // socket on the west wall, in the gap between the bed and the TV cabinet
  scene.add(box(0.008, 0.115, 0.075, white, 0.004, 0.3, 1.33));
  for (const dy of [-0.026, 0.026]) scene.add(box(0.004, 0.03, 0.03, M.tvDark, 0.0085, 0.3 + dy, 1.33));

  const strip = new THREE.Group();
  strip.position.set(1.26, 0, 1.22);
  strip.rotation.y = deg(-12);
  scene.add(strip);
  strip.add(box(0.3, 0.034, 0.056, white, 0, 0.017, 0));
  for (const sx of [-0.1, -0.045, 0.01, 0.065]) strip.add(box(0.038, 0.002, 0.038, M.tvDark, sx, 0.035, 0));
  strip.add(box(0.022, 0.008, 0.016, M.redLed, 0.122, 0.036, 0));
  strip.updateMatrixWorld(true);

  // the strip's own cord, along the skirting and up into the wall
  scene.add(cable([
    worldPt(strip, -0.15, 0.017, 0), worldPt(strip, -0.21, 0.008, 0.005),
    [0.8, 0.006, 1.3], [0.45, 0.006, 1.37], [0.14, 0.006, 1.36], [0.035, 0.04, 1.34], [0.022, 0.15, 1.332], [0.026, 0.258, 1.33],
  ], 0.004, white));
  scene.add(box(0.03, 0.036, 0.036, white, 0.022, 0.274, 1.33));

  // an appliance lead: from the back of the thing, down behind the cabinet, into a socket on the strip
  const lead = (points, sx) => {
    strip.add(box(0.034, 0.028, 0.034, M.blackPlastic, sx, 0.049, 0));
    scene.add(cable([...points, worldPt(strip, sx - 0.05, 0.085, -0.035), worldPt(strip, sx, 0.062, 0)], 0.0032, M.rubber));
  };
  lead([
    worldPt(tv, 0.06, 0.1, -0.262), worldPt(tv, 0.06, 0.03, -0.3),
    [0.09, 0.615, 1.6], [0.1, 0.612, 1.5], [0.12, 0.58, 1.455], [0.15, 0.3, 1.44], [0.2, 0.012, 1.42], [0.62, 0.006, 1.4], [0.95, 0.006, 1.33],
  ], -0.1);
  // the console's AV lead: along the back of the cabinet, up into the set's inputs
  tv.add(box(0.05, 0.02, 0.012, M.tvDark, -0.1, 0.22, -0.262));
  scene.add(cable([
    worldPt(con, -0.05, 0.025, -0.097), worldPt(con, -0.05, 0.006, -0.2), [0.1, 0.612, 2.2],
    worldPt(tv, -0.14, 0.1, -0.3), worldPt(tv, -0.1, 0.225, -0.27),
  ], 0.003, M.rubber, { floor: 0.605 }));
  // the console's power lead: behind the set, off the far end of the cabinet, across to the strip
  lead([
    worldPt(con, 0.08, 0.025, -0.097), [0.1, 0.612, 2.25], [0.07, 0.612, 2.0], [0.07, 0.612, 1.6],
    [0.09, 0.58, 1.455], [0.12, 0.3, 1.45], [0.18, 0.012, 1.45], [0.64, 0.006, 1.44], [0.98, 0.006, 1.37],
  ], -0.045);
}

// ---------------------------------------------------------------- bed

function buildBed(scene, M, ctx) {
  const g = new THREE.Group();
  scene.add(g);
  const z0 = 0.1, z1 = 1.1, zc = 0.6;
  // frame
  g.add(box(0.045, 0.6, 1.0, M.woodBed, 0.075, 0.64, zc));
  g.add(box(0.07, 0.07, 1.08, M.woodBed, 0.075, 0.965, zc));
  g.add(box(0.045, 0.34, 1.0, M.woodBed, 2.115, 0.42, zc));
  for (const z of [z0, z1]) {
    g.add(box(0.06, 0.96, 0.06, M.woodBed, 0.075, 0.48, z));
    g.add(box(0.06, 0.62, 0.06, M.woodBed, 2.115, 0.31, z));
    g.add(box(2.0, 0.16, 0.03, M.woodBed, 1.095, 0.3, z));
  }
  g.add(box(1.98, 0.1, 0.96, M.underBed, 1.095, 0.31, zc));
  g.add(rbox(1.98, 0.21, 0.96, 0.05, M.sheet, 1.095, 0.465, zc));
  // you can jump up onto the bed; the headboard stays solid
  ctx.colliders.push({ type: 'box', x0: 0.02, x1: 2.16, z0: 0.0, z1: 1.16, top: 0.6, stand: true, surface: 'bed' });
  ctx.colliders.push({ type: 'box', x0: 0.0, x1: 0.13, z0: 0.0, z1: 1.16, top: 1.0 });
  const top = 0.57;

  // flannel blanket: flat across the mattress, then falling over the long side
  const blanket = drape(M.plaid, 1.43, 1.0, 0.27, { seed: 3, wrinkle: 0.016, radius: 0.05, uvScale: 1.5, segW: 60, segL: 60 });
  blanket.position.set(1.385, top + 0.006, 0.125);
  g.add(blanket);
  // rumpled sheet where the blanket's been thrown back
  const sheetLump = blob(M.sheet, 0.36, 0.05, 0.3, { seed: 11, amp: 0.3 });
  sheetLump.position.set(0.78, top - 0.01, 0.74);
  g.add(sheetLump);

  const p1 = pillow(M.pillowPlaid, 0.62, 0.17, 0.42, 1);
  p1.position.set(0.47, top + 0.08, 0.66);
  p1.rotation.set(deg(-4), deg(14), deg(3));
  g.add(p1);
  const p2 = pillow(M.pillowWhite, 0.6, 0.16, 0.4, 2);
  p2.position.set(0.66, top + 0.15, 0.36);
  p2.rotation.set(deg(-38), deg(-10), deg(-4));
  g.add(p2);

  // the day's clothes
  const put = (m, x, y, z, ry = 0) => { m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
  put(blob(M.clothWhite, 0.27, 0.05, 0.2, { seed: 6, amp: 0.34 }), 1.04, top + 0.012, 0.74, 0.5);
  put(blob(M.clothCream, 0.33, 0.085, 0.22, { seed: 2, amp: 0.34 }), 1.3, top + 0.012, 0.52, -0.3);
  put(blob(M.clothRed, 0.32, 0.055, 0.13, { seed: 4, amp: 0.3 }), 1.68, top + 0.014, 0.4, 0.18);
  put(drape(M.clothOlive, 0.52, 0.49, 0.5, { seed: 7, wrinkle: 0.03, radius: 0.055, ragged: 0.22 }), 1.66, top + 0.03, 0.67, deg(3));
  put(drape(M.clothNavy, 0.34, 0.47, 0.4, { seed: 9, wrinkle: 0.022, radius: 0.06, ragged: 0.3 }), 1.93, top + 0.05, 0.74, deg(-5));

  // under the bed: boxes of stuff
  g.add(box(0.46, 0.17, 0.34, M.underBed, 1.0, 0.085, 0.84));
  g.add(box(0.3, 0.13, 0.3, std({ color: 0x4d4034, roughness: 1 }), 1.6, 0.065, 0.8));
}

// ---------------------------------------------------------------- desk

/** Early-2000s wheel mouse: a beige wedge, tall under the palm, two long buttons. Front is +z. */
function buildMouse(M) {
  const wide = 0.058, high = 0.034, long = 0.108;
  const ease = (a) => a * a * (3 - 2 * a);
  // height along its length: t = 0 at the palm end, 1 at the button tips
  const arch = (t) => (t < 0.38 ? 0.76 + 0.24 * ease(t / 0.38) : 1 - 0.46 * ease((t - 0.38) / 0.62));
  let geo = new RoundedBoxGeometry(wide, high, long, 5, 0.011);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo, 1e-5);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getZ(i) / long + 0.5;
    p.setXYZ(i, p.getX(i) * (1 - 0.09 * t), (p.getY(i) + high / 2) * arch(t), p.getZ(i));
  }
  geo.computeVertexNormals();
  const mouse = new THREE.Group();
  const body = new THREE.Mesh(geo, M.beige);
  body.castShadow = body.receiveShadow = true;
  mouse.add(body);

  const top = (t) => high * arch(t);
  const z = (t) => (t - 0.5) * long;
  const fall = Math.atan2(top(0.52) - top(1), 0.48 * long); // how steeply the buttons slope away
  // the gap between the two buttons, the seam where they meet the palm rest, and the wheel
  const split = box(0.0013, 0.004, 0.48 * long, M.beigeDark, 0, top(0.76) - 0.0012, z(0.76));
  split.rotation.x = fall;
  mouse.add(split);
  mouse.add(box(wide * 0.74, 0.004, 0.0013, M.beigeDark, 0, top(0.52) - 0.0016, z(0.52)));
  const wheel = cyl(0.0078, 0.0078, 0.0068, M.tvDark, 0, top(0.74) - 0.0035, z(0.74), 16);
  wheel.rotation.z = Math.PI / 2;
  mouse.add(wheel);
  mouse.userData.cableExit = [0, 0.007, long / 2 - 0.002];
  return mouse;
}

function buildDesk(scene, M, ctx) {
  const g = new THREE.Group();
  scene.add(g);
  const { W } = ROOM;
  const x0 = W - 0.8, z0 = 1.24, z1 = 2.92, topY = 0.75;
  g.add(boxMM(x0, W - 0.005, topY - 0.035, topY, z0, z1, M.woodDesk));
  g.add(boxMM(x0 + 0.03, W - 0.02, 0, topY - 0.035, z0 + 0.02, z0 + 0.05, M.woodDesk));
  g.add(boxMM(x0 + 0.03, W - 0.02, 0, topY - 0.035, z1 - 0.05, z1 - 0.02, M.woodDesk));
  g.add(boxMM(W - 0.045, W - 0.02, 0.28, topY - 0.035, z0 + 0.05, z1 - 0.05, M.woodDesk));
  // drawer pedestal at the door end
  g.add(boxMM(x0 + 0.04, W - 0.05, 0.02, topY - 0.035, z1 - 0.5, z1 - 0.05, M.woodDesk));
  for (const y of [0.56, 0.33, 0.12]) {
    g.add(box(0.012, 0.19, 0.41, M.woodCabinetDoor, x0 + 0.036, y, z1 - 0.275));
    g.add(box(0.014, 0.014, 0.09, M.knob, x0 + 0.026, y, z1 - 0.275));
  }
  // the desk top can be stood on, with the PC and monitor as an obstacle at its far end
  ctx.colliders.push({ type: 'box', x0: x0 - 0.02, x1: W, z0: z0 - 0.02, z1: z1 + 0.02, top: topY, stand: true });
  ctx.colliders.push({ type: 'box', x0: W - 0.62, x1: W, z0: 1.34, z1: 1.98, base: topY, top: 1.35 });

  // ---- desktop PC with the monitor sat on top, angled towards the chair that isn't there
  const pc = new THREE.Group();
  pc.position.set(W - 0.3, topY, 1.66);
  pc.rotation.y = deg(-68);
  g.add(pc);
  const pcFront = std({ map: T.pcFrontTex(), roughness: 0.6 });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.15, 0.42), [M.beige, M.beige, M.beige, M.beige, pcFront, M.beige]);
  tower.position.y = 0.075;
  tower.castShadow = tower.receiveShadow = true;
  pc.add(tower);

  const mon = new THREE.Group();
  mon.position.set(0, 0.15, 0.0);
  pc.add(mon);
  mon.add(cyl(0.12, 0.14, 0.022, M.beige, 0, 0.011, 0.02));
  mon.add(cyl(0.055, 0.075, 0.045, M.beige, 0, 0.04, 0.02));
  const head = new THREE.Group();
  head.position.set(0, 0.06, 0.02);
  head.rotation.x = deg(-5);
  mon.add(head);
  head.add(rbox(0.43, 0.37, 0.1, 0.02, M.beige, 0, 0.19, 0.13));
  head.add(box(0.38, 0.32, 0.2, M.beige, 0, 0.185, -0.01));
  head.add(box(0.27, 0.24, 0.14, M.beigeDark, 0, 0.17, -0.17));
  head.add(box(0.36, 0.275, 0.008, M.beigeDark, 0, 0.205, 0.178));
  const pcScreenMat = screenMat(ctx.desktop.texture);
  pcScreenMat.roughness = 0.55; // read from straight in front, so less sheen than the TV
  const pcScreen = curvedScreen(0.335, 0.252, 0.008, pcScreenMat);
  pcScreen.position.set(0, 0.205, 0.183);
  head.add(pcScreen);
  // its lights — one on the monitor, one on the tower — are dark until the machine is switched on
  const pcLed = std({ color: 0x1b241b, roughness: 0.4, emissive: 0x4dff6a, emissiveIntensity: 0 });
  head.add(box(0.016, 0.01, 0.006, pcLed, 0.16, 0.035, 0.181));
  pc.add(box(0.011, 0.0042, 0.002, pcLed, -0.1238, 0.0498, 0.2102));
  for (let i = 0; i < 3; i++) head.add(box(0.014, 0.01, 0.006, M.beigeDark, 0.06 + i * 0.026, 0.035, 0.181));

  pc.updateMatrixWorld(true);
  ctx.lights.pc.position.copy(head.localToWorld(new THREE.Vector3(0, 0.2, 0.55)));
  ctx.lights.pc.userData.base = 0;
  pcScreenMat.emissiveIntensity = 0; // the machine is off when you come home
  // `reading`: seen from the chair the picture is turned down below the bloom threshold,
  // otherwise white windows glare out and the text can't be read
  ctx.pcPower = (on, reading = false) => {
    pcScreenMat.emissiveIntensity = on ? (reading ? 0.9 : 1.5) : 0;
    pcLed.emissiveIntensity = on ? 2 : 0;
  };
  pc.userData.interact = {
    label: () => ({ off: 'Turn on the computer', on: 'Shut down the computer' }[ctx.desktop.power] ?? 'The computer is busy'),
    use: () => ctx.pcSwitch(),
  };
  // where your eyes end up when you sit at it: square on to the screen, close enough to read
  const screenAt = head.localToWorld(new THREE.Vector3(0, 0.205, 0.19));
  const eyeAt = head.localToWorld(new THREE.Vector3(0, 0.205, 0.19 + 0.52));
  ctx.seat = {
    position: eyeAt,
    quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eyeAt, screenAt, new THREE.Vector3(0, 1, 0))),
    fov: 36,
  };
  ctx.interact.push(pc);

  // keyboard and mouse
  const kb = toppedBox(0.46, 0.024, 0.16, std({ map: T.keyboardTex(), roughness: 0.6 }), M.beige);
  kb.position.set(x0 + 0.2, topY + 0.016, 1.8);
  kb.rotation.set(deg(4), deg(-70), 0, 'YXZ');
  g.add(kb);
  const mouse = buildMouse(M);
  mouse.position.set(x0 + 0.27, topY, 2.14);
  mouse.rotation.y = deg(100); // buttons towards the PC
  g.add(mouse);

  // leads: mouse and keyboard run round either side of the case to the ports on its back,
  // and the monitor's video cable drops down to join them
  kb.updateMatrixWorld(true);
  mouse.updateMatrixWorld(true);
  for (const lx of [-0.1, 0, 0.14]) pc.add(box(0.03, 0.022, 0.012, M.beigeDark, lx, lx ? 0.05 : 0.1, -0.214));
  const lead = (pts, r = 0.0024) => g.add(cable(pts, r, M.beigeDark, { floor: topY }));
  const [mx, my, mz] = mouse.userData.cableExit;
  lead([
    worldPt(mouse, mx, my, mz), worldPt(mouse, mx, 0.004, mz + 0.05),
    worldPt(pc, 0.3, 0.004, 0.16), worldPt(pc, 0.275, 0.004, -0.05), worldPt(pc, 0.255, 0.004, -0.19),
    worldPt(pc, 0.2, 0.03, -0.228), worldPt(pc, 0.14, 0.05, -0.22),
  ]);
  lead([
    worldPt(kb, 0.1, 0, -0.08), worldPt(pc, -0.12, 0.004, 0.25), worldPt(pc, -0.27, 0.004, 0.2),
    worldPt(pc, -0.275, 0.004, -0.1), worldPt(pc, -0.2, 0.03, -0.24), worldPt(pc, -0.1, 0.05, -0.22),
  ]);
  lead([worldPt(head, 0.05, 0.13, -0.24), worldPt(pc, 0.03, 0.26, -0.275), worldPt(pc, 0, 0.1, -0.22)], 0.0035);

  // a can
  const can = (tex, x, z, ry) => {
    const c = new THREE.Group();
    const body = cyl(0.033, 0.033, 0.118, std({ map: tex, metalness: 0.55, roughness: 0.36 }), 0, 0.059, 0, 32);
    c.add(body);
    c.add(cyl(0.028, 0.033, 0.006, M.silver, 0, 0.121, 0, 32));
    c.position.set(x, topY, z);
    c.rotation.y = ry;
    g.add(c);
    return c;
  };
  can(T.canTex('#b8201f', '#f1ebe2', 'Cola', false), x0 + 0.08, 1.34, deg(200));

  // discs and jewel cases
  const cdShiny = std({ map: T.cdTex(false), alphaTest: 0.5, metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide });
  const cdLabel = std({ map: T.cdTex(true), alphaTest: 0.5, metalness: 0.2, roughness: 0.4, side: THREE.DoubleSide });
  const cd = (mat, x, z, lift) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.06, 48), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, topY + 0.002 + lift, z);
    m.receiveShadow = true;
    g.add(m);
  };
  cd(cdShiny, x0 + 0.2, 2.26, 0);
  cd(cdLabel, x0 + 0.31, 2.33, 0.0015);
  cd(cdShiny, x0 + 0.4, 2.24, 0.003);
  const jewel = (title, bg, ink, accent, seed, x, z, ry) => {
    const m = toppedBox(0.142, 0.01, 0.125, std({ map: T.coverTex(title, bg, ink, accent, seed), roughness: 0.25 }), M.blackPlastic);
    m.position.set(x, topY + 0.006, z);
    m.rotation.y = ry;
    g.add(m);
  };
  jewel('HYBRID', '#c8b48a', '#2a2018', '#8f2a22', 411, x0 + 0.17, 2.46, deg(-24));
  jewel('NU ROCK', '#22262e', '#e8e2d2', '#4a6fa8', 413, x0 + 0.47, 2.44, deg(12));

  // headphones, lying on their side
  const hp = new THREE.Group();
  hp.position.set(x0 + 0.2, topY, 2.66);
  hp.rotation.y = deg(-28);
  g.add(hp);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.007, 8, 30, Math.PI), M.blackPlastic);
  band.rotation.x = -Math.PI / 2;
  band.position.y = 0.022;
  band.castShadow = true;
  hp.add(band);
  for (const x of [-0.085, 0.085]) {
    hp.add(cyl(0.04, 0.04, 0.024, M.blackPlastic, x, 0.012, 0.012));
    hp.add(cyl(0.034, 0.036, 0.012, M.rubber, x, 0.03, 0.012));
  }

  // portable CD player on a mat
  const dm = new THREE.Group();
  dm.position.set(W - 0.36, topY, 2.72);
  g.add(dm);
  dm.add(cyl(0.105, 0.105, 0.003, M.rubber, 0, 0.0015, 0, 40));
  dm.add(cyl(0.072, 0.074, 0.02, M.silver, 0, 0.013, 0, 40));
  dm.add(cyl(0.066, 0.07, 0.008, M.silver, 0, 0.027, 0, 40));
  dm.add(cyl(0.04, 0.04, 0.002, M.blackPlastic, 0, 0.032, 0, 32));
  dm.add(cyl(0.016, 0.016, 0.003, M.silver, 0, 0.0335, 0, 20));
  dm.add(box(0.034, 0.004, 0.012, M.blackPlastic, 0, 0.024, 0.071));
  dm.userData.interact = { label: () => 'Look at the CD player', say: 'Dead batteries. As always.' };
  ctx.interact.push(dm);
  hp.updateMatrixWorld(true);
  dm.updateMatrixWorld(true);
  g.add(cable([
    worldPt(hp, -0.085, 0.008, 0.05), worldPt(hp, -0.08, 0.004, 0.12),
    [x0 + 0.14, topY + 0.004, 2.85], [x0 + 0.3, topY + 0.004, 2.85], worldPt(dm, -0.073, 0.014, 0.02),
  ], 0.002, M.rubber, { floor: topY }));
}

// ---------------------------------------------------------------- dresser + turntable

function buildDresser(scene, M, ctx) {
  const { W } = ROOM;
  const g = new THREE.Group();
  scene.add(g);
  const x0 = W - 0.64, x1 = W - 0.03, z0 = 0.04, z1 = 0.5, h = 1.24;
  g.add(boxMM(x0, x1, 0.03, h, z0, z1, M.woodDresser));
  g.add(boxMM(x0 - 0.015, x1 + 0.015, h, h + 0.03, z0, z1 + 0.02, M.woodDresser));
  for (let i = 0; i < 4; i++) {
    const y = 0.2 + i * 0.28;
    g.add(box(x1 - x0 - 0.05, 0.24, 0.014, M.woodCabinetDoor, (x0 + x1) / 2, y, z1 + 0.006));
    for (const dx of [-0.15, 0.15]) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), M.knob);
      k.position.set((x0 + x1) / 2 + dx, y, z1 + 0.024);
      k.castShadow = k.receiveShadow = true;
      g.add(k);
    }
  }
  ctx.colliders.push({ type: 'box', x0: x0 - 0.03, x1: W, z0: 0, z1: z1 + 0.04 });

  const tt = new THREE.Group();
  tt.position.set((x0 + x1) / 2, h + 0.03, 0.26);
  g.add(tt);
  tt.add(box(0.44, 0.07, 0.36, M.woodCabinet, 0, 0.035, 0));
  tt.add(box(0.42, 0.006, 0.34, M.blackPlastic, 0, 0.073, 0));
  tt.add(cyl(0.145, 0.145, 0.012, M.silver, -0.04, 0.082, 0, 40));
  tt.add(cyl(0.14, 0.14, 0.004, M.vinyl, -0.04, 0.09, 0, 40));
  tt.add(cyl(0.045, 0.045, 0.0045, std({ color: 0xb8322c, roughness: 0.6 }), -0.04, 0.0905, 0, 24));
  tt.add(cyl(0.014, 0.014, 0.04, M.silver, 0.16, 0.096, -0.11, 14));
  const arm = box(0.008, 0.008, 0.21, M.silver, 0.13, 0.108, -0.01);
  arm.rotation.y = deg(-16);
  tt.add(arm);
  tt.userData.interact = { label: () => 'Look at the turntable', say: "It was Dad's. The record is still on the platter." };
  ctx.interact.push(tt);
}

// ---------------------------------------------------------------- floor clutter

function buildFloor(scene, M, ctx) {
  const g = new THREE.Group();
  scene.add(g);

  // canvas backpack leaning against the foot of the bed. A zip runs round its front: up one
  // side, over the top and down the other. Pull it and the front, with nothing holding it up
  // any more, slumps onto the carpet and lets everything out.
  const { lerp, clamp } = THREE.MathUtils;
  const bag = new THREE.Group();
  const BAG_YAW = deg(-14), BAG_LEAN = deg(-13);
  bag.position.set(2.03, 0, 1.4);
  bag.rotation.set(BAG_LEAN, BAG_YAW, 0, 'YXZ');
  g.add(bag);
  /** A rectangle with rounded corners (one radius for the bottom pair, one for the top), as a path. */
  const rounded = (path, x0, x1, y0, y1, rb, rt) => {
    path.moveTo(x0 + rb, y0);
    path.lineTo(x1 - rb, y0);
    if (rb) path.absarc(x1 - rb, y0 + rb, rb, -Math.PI / 2, 0);
    path.lineTo(x1, y1 - rt);
    if (rt) path.absarc(x1 - rt, y1 - rt, rt, 0, Math.PI / 2);
    path.lineTo(x0 + rt, y1);
    if (rt) path.absarc(x0 + rt, y1 - rt, rt, Math.PI / 2, Math.PI);
    path.lineTo(x0, y0 + rb);
    if (rb) path.absarc(x0 + rb, y0 + rb, rb, Math.PI, Math.PI * 1.5);
    return path;
  };
  /** That outline given thickness (from z = 0 forwards), its edges softened. */
  const slab = (shape, thick, soft, mat) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thick - soft * 2, bevelEnabled: true, bevelThickness: soft, bevelSize: soft, bevelOffset: -soft, bevelSegments: 3, curveSegments: 8 });
    geo.translate(0, 0, soft);
    const uv = geo.attributes.uv; // extrusions are mapped in metres; the cloth grain expects 0–1 across a panel
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.6, uv.getY(i) * 2.6);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  const liningMat = std({ color: 0x8a6644, roughness: 1 }); // dark brown; it only ever gets bounced light, so nothing darker or it reads as black

  // the body: a back, and walls round the hollow that the front closes over
  const shell = new THREE.Group();
  bag.add(shell);
  shell.add(rbox(0.36, 0.46, 0.08, 0.04, M.canvasTan, 0, 0.23, -0.055, 5));
  const walls = rounded(new THREE.Shape(), -0.18, 0.18, 0, 0.46, 0.055, 0.055);
  walls.holes.push(rounded(new THREE.Path(), -0.148, 0.148, 0.032, 0.428, 0.03, 0.03));
  const rim = slab(walls, 0.125, 0.008, M.canvasTan);
  rim.position.z = -0.032;
  shell.add(rim);
  // the hollow is lined: a panel across its back, a sleeve round its walls
  shell.add(box(0.3, 0.4, 0.004, liningMat, 0, 0.23, -0.014));
  const sleeve = rounded(new THREE.Shape(), -0.1475, 0.1475, 0.0325, 0.4275, 0.0295, 0.0295);
  sleeve.holes.push(rounded(new THREE.Path(), -0.1455, 0.1455, 0.0345, 0.4255, 0.0275, 0.0275));
  const sleeveMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(sleeve, { depth: 0.1, bevelEnabled: false, curveSegments: 8 }), liningMat);
  sleeveMesh.position.z = -0.014;
  sleeveMesh.receiveShadow = true;
  shell.add(sleeveMesh);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 8, 18, Math.PI), M.canvasTanDark);
  loop.position.set(0, 0.455, -0.04);
  loop.castShadow = true;
  shell.add(loop);

  // the front, pocket and all. It is cloth, not a door: it folds down along the bottom seam,
  // and again across its middle (`FOLD`) when it reaches the floor. Its frame: y up it, z out
  // of the bag, the inside face at z = 0.
  const FRONT_Y = 0.025, FRONT_Z = 0.088, FOLD = 0.19, THICK = 0.024;
  const front = new THREE.Group();
  front.position.set(0, FRONT_Y, FRONT_Z);
  bag.add(front);
  const top = new THREE.Group(); // the part above the fold
  top.position.set(0, FOLD, 0);
  front.add(top);
  front.add(slab(rounded(new THREE.Shape(), -0.16, 0.16, -0.005, FOLD + 0.03, 0.02, 0), THICK, 0.005, M.canvasTan));
  front.add(box(0.29, FOLD - 0.012, 0.002, liningMat, 0, (FOLD + 0.012) / 2, -0.0008));
  const upper = slab(rounded(new THREE.Shape(), -0.1598, 0.1598, -0.03, 0.418 - FOLD, 0, 0.04), THICK - 0.0006, 0.005, M.canvasTan);
  upper.position.z = 0.0003;
  top.add(upper);
  top.add(box(0.29, 0.205, 0.002, liningMat, 0, 0.1025, -0.0008));
  // the dark yoke across the top of the front, with its two straps and buckles. For looks
  // only: it is sewn to the front and holds nothing shut. Done up by a child, so not quite even.
  top.add(rbox(0.26, 0.12, 0.02, 0.009, M.canvasTanDark, 0, 0.16, THICK + 0.008, 3));
  for (const [x, lean, buckleY] of [[-0.07, deg(2.5), 0.047], [0.072, deg(-1.5), 0.04]]) {
    const lace = box(0.03, 0.11, 0.008, M.canvasTanDark, x, 0.085, THICK + 0.021);
    lace.rotation.z = lean;
    top.add(lace);
    top.add(box(0.036, 0.022, 0.012, M.brass, x + Math.sin(lean) * 0.045, buckleY, THICK + 0.023));
  }
  const pocket = rbox(0.24, 0.17, 0.05, 0.022, M.canvasTan, 0, 0.115, THICK + 0.02, 4);
  pocket.add(box(0.17, 0.006, 0.004, M.canvasTanDark, 0, 0.05, 0.0245)); // its own little zip, shut
  front.add(pocket);

  // the zip, round the edge of the front: up the right side, over the top, down the left.
  // (x half-width, height of the top run, corner radius, z; `drop` and `foot` re-base it for the front's own frames)
  const ZIP_FOOT = 0.06; // how far up the sides it starts
  const zipLine = (hw, topY, r, z, drop = 0, foot = ZIP_FOOT) => {
    const pts = [];
    const at = (x, y) => pts.push(new THREE.Vector3(x, y - drop, z));
    for (let i = 0; i <= 5; i++) at(hw, lerp(foot, topY - r, i / 5));
    for (let i = 1; i <= 5; i++) at(hw - r + Math.cos((i / 12) * Math.PI) * r, topY - r + Math.sin((i / 12) * Math.PI) * r);
    for (let i = 0; i <= 4; i++) at(lerp(hw - r, r - hw, i / 4), topY);
    for (let i = 7; i <= 11; i++) at(r - hw + Math.cos((i / 12) * Math.PI) * r, topY - r + Math.sin((i / 12) * Math.PI) * r);
    for (let i = 0; i <= 5; i++) at(-hw, lerp(topY - r, foot, i / 5));
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  };
  const zipMetal = std({ color: 0xcdbb86, metalness: 0.45, roughness: 0.42 }); // brass
  const zipTape = std({ color: 0x3d3328, roughness: 1 });
  const zipCurve = zipLine(0.165, 0.448, 0.045, 0.097);
  const ZIP_SEGS = 120, ZIP_SIDES = 6;
  const teeth = new THREE.Mesh(new THREE.TubeGeometry(zipCurve, ZIP_SEGS, 0.005, ZIP_SIDES, false), zipMetal);
  shell.add(teeth);
  // its tape, one half sewn to the body and one to the front
  shell.add(new THREE.Mesh(new THREE.TubeGeometry(zipLine(0.17, 0.453, 0.05, 0.094), 60, 0.004, 5, false), zipTape));
  top.add(new THREE.Mesh(new THREE.TubeGeometry(zipLine(0.16, 0.443, 0.04, THICK / 2, FRONT_Y + FOLD, FRONT_Y + FOLD), 60, 0.004, 5, false), zipTape));
  for (const x of [-0.16, 0.16]) front.add(box(0.007, FRONT_Y + FOLD - ZIP_FOOT, 0.007, zipTape, x, (ZIP_FOOT - FRONT_Y + FOLD) / 2, THICK / 2));
  const slider = new THREE.Group();
  slider.add(box(0.016, 0.022, 0.012, zipMetal));
  const pull = new THREE.Group();
  pull.position.set(0, 0.006, 0.007);
  pull.add(box(0.009, 0.032, 0.003, zipMetal, 0, 0.016, 0));
  slider.add(pull);
  shell.add(slider);
  /** Put the pull `p` (0–1) of the way round; the teeth behind it have come apart. */
  const zipTo = (p) => {
    zipCurve.getPointAt(p, slider.position);
    const along = zipCurve.getTangentAt(p);
    slider.rotation.z = Math.atan2(along.y, along.x) - Math.PI / 2;
    pull.rotation.z = Math.PI * (1 - clamp(p / 0.06, 0, 1)); // hanging down at first, then leading the way
    teeth.geometry.setDrawRange(Math.floor(p * ZIP_SEGS) * ZIP_SIDES * 6, Infinity);
  };
  zipTo(0);

  const strap = cable([[1.9, 0.3, 1.34], [1.83, 0.1, 1.4], [1.75, 0.012, 1.47], [1.7, 0.01, 1.59]], 0.014, M.canvasTanDark);
  g.add(strap);
  ctx.colliders.push({ type: 'box', x0: 1.86, x1: 2.2, z0: 1.24, z1: 1.52, top: 0.46 });

  // ---- what's inside: built now, hidden until they slide out
  const plastic = (color, rough = 0.32) => std({ color, roughness: rough });
  const inside = (obj) => { obj.visible = false; g.add(obj); return obj; };

  const notebook = inside(toppedBox(0.17, 0.012, 0.216, std({ map: imageTex('assets/notebook-cover.jpg'), roughness: 0.55 }), M.paper));
  notebook.rotation.order = 'YXZ'; // turned to face a direction, then tipped

  // pencil case: a canvas tube, zip along the top and open for half its length. Local x runs
  // along it; it tumbles out of the bag and comes to rest three-quarters of a turn over,
  // scribbled side up, the open half of the zip facing back at what fell out of it.
  const pencilCase = inside(new THREE.Group());
  pencilCase.rotation.order = 'YXZ'; // roll about its own length first, then turn
  const green = std({ color: 0x34523b, roughness: 1 });
  const tubeR = 0.034, tubeLen = 0.2;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, tubeLen, 28, 1), [std({ map: T.pencilCaseTex(), roughness: 1 }), green, green]);
  tube.rotation.z = -Math.PI / 2; // the wrap's top (the zip) stays up, its front faces +z
  tube.scale.z = 0.9; // sags a little on the side it ends up lying on
  tube.castShadow = tube.receiveShadow = true;
  pencilCase.add(tube);
  for (const sx of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.SphereGeometry(tubeR, 18, 12), green);
    end.scale.set(0.35, 1, 0.9);
    end.position.x = sx * tubeLen / 2;
    end.castShadow = true;
    pencilCase.add(end);
  }
  const OPEN_HALF = 0.045; // middle of the unzipped half, along the tube
  pencilCase.add(box(0.088, 0.004, 0.024, M.underBed, OPEN_HALF, tubeR - 0.0005, 0)); // the gap where the zip is undone
  pencilCase.add(box(0.012, 0.004, 0.02, std({ color: 0x7d807a, metalness: 0.6, roughness: 0.55 }), 0, tubeR + 0.001, 0.004)); // the pull, stopped half-way

  // what spills from the case. Each lies along its own local x.
  const ruler = inside(toppedBox(0.15, 0.004, 0.034, std({ map: T.rulerTex(), roughness: 0.25 }), plastic(0x2f9a3a, 0.25)));
  /** A round part lying along x: from x0, where its radius is r0, to x1, where it is r1. */
  const along = (x0, r0, x1, r1, mat, sides = 14) => {
    const m = cyl(r1, r0, x1 - x0, mat, (x0 + x1) / 2, 0, 0, sides);
    m.rotation.z = -Math.PI / 2;
    return m;
  };
  // a blue fountain pen, its cap pushed onto the back end the way you write with one
  const pen = inside(new THREE.Group());
  const penBlue = plastic(0x2648b8), capBlue = plastic(0x1b3590), nibGold = std({ color: 0xd8b04a, metalness: 0.9, roughness: 0.28 });
  pen.add(along(-0.03, 0.0056, 0.03, 0.0058, penBlue)); // the barrel; the rest of it is inside the cap
  pen.add(along(-0.052, 0.0042, -0.03, 0.0052, M.blackPlastic)); // where you hold it
  pen.add(along(-0.0535, 0.0046, -0.052, 0.0046, M.chrome, 12));
  const nib = along(-0.073, 0.0003, -0.052, 0.004, nibGold, 10);
  nib.scale.x = 0.3; // flat, not a cone: the cylinder's own x is the pen's up
  pen.add(nib);
  const feed = along(-0.066, 0.0008, -0.052, 0.0034, M.blackPlastic, 8);
  feed.scale.x = 0.5;
  feed.position.y = -0.0013; // the ink's way to the nib, underneath it
  pen.add(feed);
  pen.add(along(0.022, 0.0068, 0.074, 0.0066, capBlue)); // the cap, on the back
  pen.add(along(0.074, 0.0066, 0.078, 0.0036, capBlue));
  pen.add(along(0.022, 0.007, 0.0255, 0.007, M.chrome)); // the band round its lip
  pen.add(box(0.04, 0.0014, 0.003, M.chrome, 0.054, 0.0074, 0)); // and its clip
  pen.add(box(0.004, 0.0026, 0.0036, M.chrome, 0.036, 0.0072, 0));
  // a fat red colouring pencil, the kind for small hands
  const pencil = inside(new THREE.Group());
  pencil.add(along(-0.07, 0.0065, 0.09, 0.0065, plastic(0xc22a26, 0.4), 6));
  pencil.add(along(-0.09, 0.0024, -0.07, 0.0065, std({ color: 0xd9b382, roughness: 0.8 }), 6));
  pencil.add(along(-0.098, 0.0004, -0.09, 0.0024, plastic(0xb3201d, 0.55), 6)); // red all the way through
  // school scissors, round at the nose, left a little open
  const scissors = inside(new THREE.Group());
  const bladeSteel = std({ color: 0xc9ccd0, metalness: 0.85, roughness: 0.3 }), grip = plastic(0xf2b61c, 0.4);
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.008, -0.0055);
  bladeShape.lineTo(0.052, -0.0034);
  bladeShape.absarc(0.052, 0, 0.0034, -Math.PI / 2, Math.PI / 2, false); // the nose
  bladeShape.lineTo(-0.008, 0.0055);
  bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.0011, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2); // flat on the floor
  const ringGeo = new THREE.TorusGeometry(0.0105, 0.0028, 8, 22).rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    // each half: a blade one side of the pivot, its handle across on the other
    const half = new THREE.Group();
    half.rotation.y = s * 0.17;
    const blade = new THREE.Mesh(bladeGeo, bladeSteel);
    blade.position.y = s > 0 ? 0.0002 : -0.0011;
    blade.castShadow = blade.receiveShadow = true;
    half.add(blade);
    const shank = box(0.036, 0.0052, 0.0078, grip, -0.021, 0, s * 0.0068);
    shank.rotation.y = s * 0.31;
    half.add(shank);
    const ring = new THREE.Mesh(ringGeo, grip);
    ring.position.set(-0.047, 0, s * 0.0148);
    ring.scale.x = 1.3; // finger holes are longer than they are wide
    ring.castShadow = ring.receiveShadow = true;
    half.add(ring);
    scissors.add(half);
  }
  const pivot = cyl(0.0024, 0.0024, 0.0042, bladeSteel, 0, 0, 0, 12);
  pivot.userData.noRim = true;
  scissors.add(pivot);
  // two-tone eraser, cut on the slant: pink for pencil, blue for ink
  const eraser = inside(new THREE.Group());
  const slant = new THREE.Matrix4().makeShear(0, 0, 0, 0, 0.5, 0);
  for (const [color, x] of [[0xe98fa0, -0.015], [0x4f7fcc, 0.015]]) {
    const half = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.018, 0.025).applyMatrix4(slant), plastic(color, 0.75));
    half.position.x = x;
    half.castShadow = half.receiveShadow = true;
    eraser.add(half);
  }

  // ---- the spill, as a little script.
  const ZIP = 0.9; // seconds for the pull to run the whole zip
  const DROP = 0.55; // and for the front to come down once nothing holds it
  const LAND = ZIP + DROP;
  // how far the front leans out while it is still half zipped, where its upper part ends up (from upright in
  // the bag: flat on the carpet), and how much steeper the part below the fold lies, propped on the bunched-up base
  const GAPE = deg(9), DOWN = deg(103), CREASE = deg(9);
  // The notebook stood against the front. It rides it down, sliding along it as it tips, and
  // comes to rest just off its edge: [time to stop after the front lands, resting x / height / z, final turn]
  const NOTEBOOK = [0.6, 1.765, 0.009, 2.0, deg(6)];
  // The pencil case lay across the top of the bag. It turns over with the falling front, runs
  // down it quicker than the notebook and is thrown off its top edge while that is still well
  // clear of the floor (`off`: how far through its fall the front is by then). From there it
  // drops and tumbles a little way over the carpet, ending three-quarters of a turn over.
  const CASE = { off: 0.85, dur: 0.8, x: 2.0, y: tubeR * 0.9, z: 2.2, turn: deg(8), roll: deg(270) };
  // Nothing leaves it until the open half of the zip has come round to face the floor. Then
  // each thing falls out of the zip wherever that is just then — the first while the case is
  // still in the air — keeps a little of its speed and is left behind as the case rolls on:
  // [thing, how far round the case is when it goes (degrees), where along the zip it leaves,
  //  how far it carries on / drifts to the left of the case's path, time to settle, the turn it picks up, resting height]
  const fromCase = [
    [scissors, 108, 0.03, 0, -0.035, 0.32, deg(16), 0.003],
    [eraser, 128, 0.06, 0.006, 0.08, 0.3, deg(34), 0.011],
    [pencil, 150, 0.02, 0.012, 0, 0.45, deg(14), 0.0058],
    [pen, 195, 0.03, 0.03, 0.06, 0.4, deg(-30), 0.0068],
    [ruler, 235, 0.004, 0.005, 0, 0.3, deg(-10), 0.005],
  ].map(([obj, at, along, carry, drift, dur, turn, y]) => ({ obj, at, along, carry, drift, dur, turn, y, t0: 0, turn0: 0, from: new THREE.Vector3(), to: new THREE.Vector3() }));
  const END = 2.4;
  const out2 = (p) => 1 - (1 - p) ** 2;
  const out3 = (p) => 1 - (1 - p) ** 3;
  const smooth = (p) => p * p * (3 - 2 * p);
  const mouth = new THREE.Vector3(), slid = new THREE.Vector3();
  const state = { t: -1, landed: false, tilt: 0, thrown: -1, roll: 0 };

  ctx.animated.push((time, dt) => {
    if (state.t < 0 || state.t >= END) return;
    const t = (state.t = Math.min(state.t + dt, END));
    ctx.touch();
    // the pull runs round the zip
    const zp = clamp(t / ZIP, 0, 1);
    zipTo(smooth(zp));
    teeth.visible = zp < 1;
    // once it is over the top the front starts to gape; when it gets to the far side, down it goes
    const gape = smooth(clamp((zp - 0.45) / 0.55, 0, 1));
    const down = clamp((t - ZIP) / DROP, 0, 1);
    const fall = down * down; // gathering speed
    const bounce = t > LAND && t < LAND + 0.26 ? Math.sin(((t - LAND) / 0.26) * Math.PI) * deg(2.5) : 0;
    const crease = CREASE * smooth(clamp((fall - 0.7) / 0.3, 0, 1));
    front.rotation.x = GAPE * gape + (DOWN - GAPE) * fall - bounce + crease;
    top.rotation.x = -crease;
    front.position.y = FRONT_Y + 0.012 * fall; // the cloth bunches at the seam
    pocket.scale.z = lerp(1, 0.3, fall); // squashed flat under it
    pocket.position.z = THICK - 0.005 + 0.025 * pocket.scale.z;
    // and the body, emptied, sags a little
    shell.scale.y = 1 - 0.04 * smooth(clamp((t - ZIP) / 0.9, 0, 1));
    bag.updateMatrixWorld(true);

    // what was leaning on the front lies on the inside face of its upper part
    const tilt = BAG_LEAN + front.rotation.x + top.rotation.x - Math.PI / 2;
    if (t < LAND) {
      const ride = clamp((down - 0.35) / 0.65, 0, 1) ** 2;
      notebook.visible = zp > 0.4;
      top.localToWorld(notebook.position.set(-0.06, lerp(0.15, 0.31, ride) - FOLD, -0.006));
      notebook.rotation.set(tilt, BAG_YAW, 0);
    } else {
      if (!state.landed) {
        // the front is down: whatever was on it keeps going
        state.landed = true;
        state.tilt = tilt;
        slid.copy(notebook.position);
        ctx.sound.bag('spill', slid);
      }
      const [nDur, nx, ny, nz, nTurn] = NOTEBOOK;
      const np = clamp((t - LAND) / nDur, 0, 1), ne = out2(np);
      // it stays up on the front until it is half-way over the edge, then tips down onto the carpet
      const over = smooth(clamp((np - 0.2) / 0.35, 0, 1));
      notebook.position.set(lerp(slid.x, nx, ne), lerp(slid.y, ny, over), lerp(slid.z, nz, ne));
      notebook.rotation.set(state.tilt * (1 - clamp(np * 4, 0, 1)) + Math.sin(over * Math.PI) * deg(9), lerp(BAG_YAW, nTurn, ne), 0);
    }

    if (state.thrown < 0) {
      const run = clamp((down - 0.3) / (CASE.off - 0.3), 0, 1) ** 2;
      pencilCase.visible = zp > 0.4;
      top.localToWorld(pencilCase.position.set(0.02, lerp(0.32, 0.44, run) - FOLD, -tubeR * 0.92));
      state.roll = tilt + Math.PI / 2; // it turns over with what it is lying on
      pencilCase.rotation.set(state.roll, BAG_YAW, 0);
      if (down < CASE.off) return;
      state.thrown = t;
      mouth.copy(pencilCase.position);
    }
    const cp = clamp((t - state.thrown) / CASE.dur, 0, 1);
    const ce = out3(cp), drop = Math.min(1, cp * 3.4);
    pencilCase.position.set(lerp(mouth.x, CASE.x, ce), lerp(mouth.y, CASE.y, drop * (0.5 + 0.5 * drop)), lerp(mouth.z, CASE.z, ce));
    const roll = lerp(state.roll, CASE.roll, ce);
    pencilCase.rotation.set(roll, lerp(BAG_YAW, CASE.turn, ce), 0);
    const rolled = THREE.MathUtils.radToDeg(roll);
    for (const it of fromCase) {
      if (rolled < it.at) continue;
      if (!it.obj.visible) {
        // out it comes through the open zip, still lying the way it lay inside
        it.obj.visible = true;
        it.t0 = t;
        pencilCase.updateMatrixWorld(true);
        pencilCase.localToWorld(it.from.set(it.along, tubeR, 0));
        it.turn0 = pencilCase.rotation.y;
        const hx = CASE.x - mouth.x, hz = CASE.z - mouth.z, h = Math.hypot(hx, hz);
        it.to.set(it.from.x + (hx * it.carry + hz * it.drift) / h, it.y, it.from.z + (hz * it.carry - hx * it.drift) / h);
      }
      const since = t - it.t0;
      const q = out3(clamp(since / it.dur, 0, 1));
      // it drops the last few centimetres on its own, then scuffs to a stop on the carpet
      it.obj.position.set(lerp(it.from.x, it.to.x, q), Math.max(it.y, it.from.y - 4.9 * since * since), lerp(it.from.z, it.to.z, q));
      it.obj.rotation.y = it.turn0 + it.turn * q;
    }
    if (t >= END) for (const offer of onOffer) offer(); // everything has stopped: these two can be picked up
  });

  // two of the things that end up on the carpet can be taken and kept. `turn`: held, a thing
  // points away from you — its blades, its point
  const onOffer = [
    takeable(ctx, scissors, { id: 'scissors', name: 'scissors', line: 'Your school scissors. Round at the end, so nobody gets hurt.', reach: [0.15, 0.085], grip: { turn: Math.PI / 2 } }),
    takeable(ctx, pencil, { id: 'red-pencil', name: 'red pencil', line: 'The fat red one. You never lend it to anyone.', reach: [0.2, 0.04], grip: { turn: -Math.PI / 2 } }),
  ];

  bag.userData.interact = {
    label: () => (state.t < 0 ? 'Open the backpack' : 'Look at the backpack'),
    use: () => {
      if (state.t >= 0) return;
      state.t = 0;
      ctx.sound.bag('open', bag.position);
    },
    say: () => (state.t > 0 ? 'Empty.' : ''),
  };
  ctx.interact.push(bag);

  // socks
  const sock = (pts) => {
    const m = cable(pts, 0.036, M.sock);
    m.scale.y = 0.5;
    g.add(m);
  };
  sock([[1.42, 0.04, 1.7], [1.54, 0.04, 1.68], [1.64, 0.04, 1.7], [1.68, 0.04, 1.77]]);
  sock([[2.28, 0.04, 1.46], [2.38, 0.04, 1.42], [2.48, 0.04, 1.45], [2.52, 0.04, 1.53]]);

  // heaps of clothes
  const heap = (mat, sx, sy, sz, seed, x, z, ry) => {
    const m = blob(mat, sx, sy, sz, { seed, amp: 0.36 });
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    g.add(m);
  };
  heap(M.clothDenim, 0.34, 0.05, 0.2, 21, 2.3, 2.66, 0.4);
  heap(M.clothDark, 0.2, 0.035, 0.15, 23, 1.96, 2.74, -0.5);
  heap(M.clothDark, 0.3, 0.1, 0.22, 25, 1.13, 2.52, 0.3);
  heap(M.clothNavy, 0.17, 0.045, 0.2, 27, 1.4, 2.66, 1.1);
  g.add(cable([[1.3, 0.12, 2.44], [1.46, 0.04, 2.36], [1.58, 0.012, 2.42], [1.62, 0.012, 2.56]], 0.012, M.clothDark));

  // magazines and game cases on the carpet
  const flat = (tex, w, d, thick, x, z, ry, y = 0) => {
    const m = toppedBox(w, thick, d, std({ map: tex, roughness: 0.38 }), M.paper);
    m.position.set(x, y + thick / 2 + 0.003, z);
    m.rotation.y = ry;
    g.add(m);
  };
  flat(T.coverTex('GAMER', '#b8322c', '#f4e9c8', '#20304e', 421), 0.21, 0.28, 0.006, 1.58, 1.3, deg(18));
  flat(T.coverTex('SKATE', '#e7ddc4', '#22262e', '#d0902c', 423), 0.21, 0.28, 0.006, 1.66, 1.38, deg(-22), 0.006);
  flat(T.coverTex('QUEST', '#1d2433', '#e6c84a', '#6a3f8c', 425), 0.135, 0.19, 0.014, 0.9, 1.42, deg(34));
  flat(T.coverTex('RIFF', '#2a4a3c', '#f1ead6', '#c2452e', 427), 0.21, 0.28, 0.006, 0.4, 2.84, deg(-12));
  flat(T.coverTex('CHEATS', '#3a5fa8', '#fff1c0', '#d83a78', 429), 0.21, 0.28, 0.006, 0.52, 2.96, deg(24), 0.006);
  flat(T.coverTex('POP!', '#d83a78', '#fff6dc', '#2f73d6', 431), 0.21, 0.28, 0.006, 1.5, 2.4, deg(-40));
}

// ---------------------------------------------------------------- glow-in-the-dark stars

/**
 * Stick-on stars on the ceiling over the bed, put up by hand into a wobbly letter A.
 * The A reads upright from the room: its feet are at the window wall, its point towards you.
 */
function buildStars(scene, ctx) {
  const outline = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rad = i % 2 ? 0.5 : 1;
    if (i === 0) outline.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else outline.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  // pale plastic by day; the emissive is turned up from main.js when the room goes dark
  const mat = std({ color: 0xe1e5bc, roughness: 0.55, emissive: 0x8dff4a, emissiveIntensity: 0 });

  // letter space: u across, v from the feet (0) up to the point (0.95)
  const letter = [];
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
    const t = i / 7;
    letter.push([side * 0.42 * (1 - t), t * 0.95, 1]);
  }
  letter.push([0, 0.95, 1.35]);
  for (const u of [-0.14, 0, 0.13]) letter.push([u, 0.35, 0.9]);
  const strays = [[-0.82, 0.22], [0.86, 0.78], [0.74, 0.1]];

  const r = mulberry32(2003);
  const mesh = new THREE.InstancedMesh(new THREE.ShapeGeometry(outline), mat, letter.length + strays.length);
  const lean = deg(-5), cx = 1.1, zFeet = 0.17;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const place = (i, u, v, size) => {
    const x = cx + u * Math.cos(lean) - (v - 0.45) * Math.sin(lean);
    const z = zFeet + 0.45 + u * Math.sin(lean) + (v - 0.45) * Math.cos(lean);
    e.set(Math.PI / 2, 0, r() * Math.PI * 2); // flat against the ceiling, spun any old way
    m.compose(new THREE.Vector3(x, ROOM.H - 0.003, z), q.setFromEuler(e), new THREE.Vector3(size, size, 1));
    mesh.setMatrixAt(i, m);
  };
  letter.forEach(([u, v, big], i) => {
    place(i, u + (r() - 0.5) * 0.055, v + (r() - 0.5) * 0.055, (0.03 + r() * 0.018) * big);
  });
  strays.forEach(([u, v], i) => place(letter.length + i, u, v, 0.018 + r() * 0.008));
  mesh.receiveShadow = true;
  scene.add(mesh);
  ctx.stars = mesh;
}

// ---------------------------------------------------------------- toys

/** Plush teddy bear propped against the wall, next to the pillows. */
function buildTeddy(scene, ctx) {
  const plush = makeCoat(0x4a2c14, 0xb9834a, 0x6b4424);
  const pale = makeCoat(0x7a5a34, 0xe2bd86, 0xb08a5a);
  const bear = new THREE.Group();
  bear.position.set(1.07, 0.585, 0.25);
  bear.rotation.set(deg(-9), deg(8), 0, 'YXZ'); // slumped back against the wall
  scene.add(bear);
  const add = (geo, length, coat, x, y, z, rot, front = 0) => {
    const part = furPart(geo, length, coat, { shells: 9, front });
    part.position.set(x, y, z);
    if (rot) part.rotation.set(rot[0], rot[1], rot[2]);
    bear.add(part);
  };
  const solid = (geo, mat, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true; // (eyes, nose, ears, pads: without it the sun lit them through the shut blind — user, 2026-11-02)
    bear.add(m);
  };
  add(ellipsoid(0.088, 0.1, 0.078), 0.012, plush, 0, 0.1, 0);
  add(ellipsoid(0.076, 0.07, 0.068), 0.012, plush, 0, 0.245, 0.012, null, 1);
  add(ellipsoid(0.034, 0.027, 0.03, 14, 10), 0.005, pale, 0, 0.228, 0.066);
  const glossy = std({ color: 0x0b0806, roughness: 0.12 });
  solid(ellipsoid(0.012, 0.009, 0.008, 12, 8), std({ color: 0x2a170c, roughness: 0.35 }), 0, 0.238, 0.1);
  for (const s of [-1, 1]) {
    solid(new THREE.SphereGeometry(0.0095, 14, 10), glossy, s * 0.028, 0.262, 0.079);
    add(ellipsoid(0.03, 0.03, 0.014, 14, 10), 0.01, plush, s * 0.058, 0.305, 0.004);
    solid(ellipsoid(0.017, 0.017, 0.004, 12, 8), pale.skin, s * 0.058, 0.305, 0.026);
    add(ellipsoid(0.03, 0.068, 0.03, 14, 12), 0.012, plush, s * 0.098, 0.13, 0.022, [-0.35, 0, s * 0.55]);
    add(ellipsoid(0.037, 0.037, 0.072, 14, 12), 0.012, plush, s * 0.058, 0.04, 0.095, [0, s * 0.35, 0]);
    // pale pad on the sole, at the far end of the leg
    solid(ellipsoid(0.025, 0.025, 0.005, 12, 8), pale.skin, s * (0.058 + Math.sin(0.35) * 0.084), 0.04, 0.095 + Math.cos(0.35) * 0.084, s * 0.35);
  }
  bear.userData.interact = { label: () => 'Look at the teddy bear', say: "He's been waiting for you all day." };
  ctx.interact.push(bear);
}

/** A well-loved diver doll on its stand, beside the PC: one arm stuck straight up. */
function buildActionFigure(scene, M, ctx) {
  const skin = std({ color: 0xdba27c, roughness: 0.46 });
  const lip = std({ color: 0xa9705a, roughness: 0.5 });
  const hair = std({ color: 0x25221f, roughness: 0.5 }); // moulded, dark and combed back
  const eyeWhite = std({ color: 0xf2f0e8, roughness: 0.3 });
  const iris = std({ color: 0x3f9ae0, roughness: 0.3 });
  const vest = std({ color: 0x1f9cab, roughness: 0.36 }); // the padded jacket
  const orange = std({ color: 0xf28c1a, roughness: 0.42 });
  const shorts = std({ color: 0xc6da58, roughness: 0.62 });
  const tank = std({ color: 0xf0c21a, roughness: 0.34 });
  const steel = std({ color: 0xb9bcc0, metalness: 0.7, roughness: 0.35 });
  const rubber = std({ color: 0x33353a, roughness: 0.62 }); // the air hose
  const black = M.blackPlastic; // his boots and buckle, and the stand

  const mix = THREE.MathUtils.lerp, at = new THREE.Vector3();
  /**
   * A lump of moulded plastic: an ellipsoid squared off towards a block (`square`, 0…1, or
   * [round its sides, at its ends] — a limb is blunt-ended), then pulled about by `pull(p, t)`,
   * t running from 0 at its bottom to 1 at its top. He is made of these rather than of balls and
   * tubes, so he has a jaw, shoulders and calves.
   */
  const lump = (parent, mat, [rx, ry, rz], [x, y, z], square = 0.3, pull = null) => {
    let geo = new THREE.SphereGeometry(1, 14, 10);
    geo.deleteAttribute('uv');
    geo.deleteAttribute('normal');
    geo = mergeVertices(geo);
    const [sides, ends] = [square].flat(), pos = geo.attributes.position, e = 1 - sides * 0.7, ey = 1 - (ends ?? sides) * 0.7;
    for (let i = 0; i < pos.count; i++) {
      at.fromBufferAttribute(pos, i);
      at.set(Math.sign(at.x) * Math.abs(at.x) ** e * rx, Math.sign(at.y) * Math.abs(at.y) ** ey, Math.sign(at.z) * Math.abs(at.z) ** e * rz);
      const t = at.y * 0.5 + 0.5;
      at.y *= ry;
      pull?.(at, t);
      pos.setXYZ(i, at.x, at.y, at.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  /** Narrower at one end than the other. */
  const taper = (bottom, top) => (p, t) => {
    const k = mix(bottom, top, t);
    p.x *= k;
    p.z *= k;
  };

  const fig = new THREE.Group();
  fig.position.set(ROOM.W - 0.2, 0.75, 2.13);
  fig.rotation.y = deg(-75);
  fig.scale.setScalar(1.25); // a bigger toy than the pocket-sized ones: the kind you dress
  scene.add(fig);
  fig.add(cyl(0.032, 0.034, 0.004, black, 0, 0.002, 0, 24));

  const LEAN = 0.13; // how far his legs are planted apart
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.0115, 0.0795, 0);
    leg.rotation.z = s * LEAN;
    lump(leg, skin, [0.0092, 0.019, 0.0098], [0, -0.019, 0], [0.35, 0.75], taper(0.8, 1.05));
    lump(leg, shorts, [0.0112, 0.0125, 0.0118], [0, -0.008, 0], 0.5, (p, t) => { if (t < 0.5) { p.x *= 1.06; p.z *= 1.06; } }); // the leg of his shorts
    lump(leg, skin, [0.0074, 0.0058, 0.008], [0, -0.0368, 0.0012], 0.4);
    lump(leg, skin, [0.0072, 0.0165, 0.0082], [0, -0.051, -0.0006], [0.35, 0.7], (p, t) => {
      taper(0.62, 1)(p, t);
      if (p.z < 0 && t > 0.45) p.z *= 1.14; // the calf
    });
    lump(leg, black, [0.0067, 0.0066, 0.0075], [0, -0.0645, 0], 0.5); // short rubber boots
    lump(leg, black, [0.0073, 0.0042, 0.0138], [0, -0.072, 0.0052], 0.6).rotation.z = -s * LEAN; // soles flat on the stand
    fig.add(leg);
  }
  lump(fig, shorts, [0.0162, 0.0105, 0.0115], [0, 0.0855, 0], 0.5);

  // the jacket: sleeveless and padded in three rolls, an orange panel zipped up the front,
  // an orange strap round the waist and an orange collar
  lump(fig, vest, [0.0195, 0.0086, 0.015], [0, 0.1005, 0], 0.5);
  lump(fig, vest, [0.0228, 0.0086, 0.0165], [0, 0.1135, 0], 0.5);
  lump(fig, vest, [0.0255, 0.0096, 0.0172], [0, 0.1265, 0], 0.5);
  const front = new THREE.Group();
  front.position.set(0.0068, 0.1165, 0.0166);
  front.rotation.x = -0.11; // it follows the chest, which is deeper at the top
  fig.add(front);
  lump(front, orange, [0.0105, 0.0185, 0.0036], [0, 0, 0], 0.7);
  front.add(box(0.0013, 0.03, 0.0012, black, -0.0012, -0.001, 0.0036)); // the zip
  front.add(box(0.003, 0.0034, 0.0016, black, -0.0012, 0.0152, 0.0034)); // and its pull
  lump(fig, orange, [0.0204, 0.0028, 0.0159], [0, 0.0972, 0], 0.5);
  const buckle = cyl(0.004, 0.004, 0.003, black, -0.0055, 0.0972, 0.0158, 14);
  buckle.rotation.x = Math.PI / 2;
  fig.add(buckle);
  fig.add(box(0.005, 0.0062, 0.002, black, 0.0095, 0.0972, 0.0152));
  lump(fig, orange, [0.0138, 0.0052, 0.0126], [0, 0.1372, 0.0004], 0.3);
  fig.add(cyl(0.0068, 0.0078, 0.011, skin, 0, 0.1405, 0, 12));

  // the air tank on his back, and the hose from it over one shoulder to the front of the jacket
  const TANK = { x: -0.005, z: -0.0243, r: 0.0086 };
  fig.add(cyl(TANK.r, TANK.r, 0.036, tank, TANK.x, 0.107, TANK.z, 14));
  lump(fig, tank, [TANK.r, 0.0054, TANK.r], [TANK.x, 0.125, TANK.z], 0);
  lump(fig, tank, [TANK.r, 0.0035, TANK.r], [TANK.x, 0.089, TANK.z], 0);
  fig.add(cyl(0.0034, 0.004, 0.008, steel, TANK.x, 0.1335, TANK.z, 10));
  const valve = cyl(0.0042, 0.0042, 0.011, steel, TANK.x, 0.1395, TANK.z, 10);
  valve.rotation.z = Math.PI / 2;
  fig.add(valve);
  const run = [[TANK.x - 0.005, 0.1392, TANK.z + 0.001], [-0.0165, 0.14, -0.0125], [-0.0195, 0.1386, 0], [-0.0182, 0.1345, 0.0142], [-0.0145, 0.126, 0.0188], [-0.0135, 0.1135, 0.018]];
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run.map((q) => new THREE.Vector3(...q)), false, 'centripetal'), 24, 0.0027, 6, false), rubber);
  hose.castShadow = true;
  fig.add(hose);
  fig.add(box(0.0075, 0.0065, 0.004, black, -0.0135, 0.111, 0.0168));

  // the head, turned a little towards the raised fist: long, with a square jaw and a heavy brow
  const head = new THREE.Group();
  head.position.set(0, 0.1555, 0);
  head.rotation.set(-0.12, 0.3, 0);
  fig.add(head);
  lump(head, skin, [0.0098, 0.0128, 0.0112], [0, 0, 0], 0.35, (p, t) => {
    if (t < 0.45) p.x *= mix(0.8, 1, t / 0.45); // in towards the chin
    p.z *= p.z > 0 ? 0.93 : 1.05; // a flat face, a full back to the skull
  });
  lump(head, skin, [0.0086, 0.0045, 0.0085], [0, -0.0085, 0.0016], 0.6); // the jaw
  lump(head, skin, [0.004, 0.003, 0.003], [0, -0.0108, 0.0088], 0.5); // the chin
  lump(head, skin, [0.0088, 0.0018, 0.0025], [0, 0.0034, 0.0094], 0.5); // the brow, over the eyes
  lump(head, skin, [0.0017, 0.0042, 0.0027], [0, -0.0008, 0.0108], 0.4, (p, t) => { p.z *= mix(1, 0.4, t); }); // the nose, narrow at the bridge
  head.add(box(0.0046, 0.0008, 0.001, lip, 0, -0.0064, 0.0106));
  for (const s of [-1, 1]) {
    lump(head, eyeWhite, [0.0018, 0.001, 0.0008], [s * 0.0041, 0.0011, 0.0101], 0);
    lump(head, iris, [0.0009, 0.0009, 0.0005], [s * 0.0041, 0.0011, 0.0107], 0);
    const brow = box(0.005, 0.0013, 0.0012, hair, s * 0.0043, 0.0037, 0.0116);
    brow.rotation.z = s * 0.2; // set, not friendly
    head.add(brow);
    lump(head, skin, [0.0012, 0.0028, 0.002], [s * 0.0098, 0.0002, -0.0005], 0.2); // ears
    lump(head, hair, [0.0012, 0.004, 0.0066], [s * 0.0093, 0.0056, -0.002], 0.4); // the hair over them
    head.add(box(0.001, 0.0045, 0.0026, hair, s * 0.0096, 0.0018, 0.0028)); // sideburns
  }
  lump(head, hair, [0.0102, 0.0043, 0.0122], [0, 0.0119, -0.001], 0.4, (p, t) => {
    if (p.z > 0 && t > 0.4) p.y += (p.z / 0.0122) * 0.002; // swept up off the forehead
  });
  lump(head, hair, [0.0098, 0.0086, 0.006], [0, 0.0022, -0.0072], 0.4); // and down to the nape

  // bare arms: the shoulder turns, the elbow bends, and that is all they ever did
  const arm = (s, shoulder, elbow) => {
    const upper = new THREE.Group();
    upper.position.set(s * 0.0272, 0.1295, 0);
    upper.rotation.set(shoulder[0], 0, shoulder[1]);
    lump(upper, skin, [0.0086, 0.0098, 0.009], [s * 0.0006, -0.003, 0], 0.4);
    lump(upper, skin, [0.0072, 0.0165, 0.0082], [0, -0.0165, 0.0006], [0.35, 0.75]);
    const lower = new THREE.Group();
    lower.position.set(0, -0.0315, 0);
    lower.rotation.x = elbow;
    lump(lower, skin, [0.0064, 0.0145, 0.0068], [0, -0.0125, 0], [0.35, 0.75], taper(0.74, 1.08));
    lump(lower, skin, [0.0058, 0.006, 0.0066], [0, -0.0305, 0.0005], 0.7); // a fist
    lump(lower, skin, [0.002, 0.0034, 0.0026], [-s * 0.004, -0.0292, 0.0052], 0.4); // and its thumb
    upper.add(lower);
    fig.add(upper);
  };
  arm(1, [-2.95, 0.1], -0.14); // one arm straight up, fist in the air
  arm(-1, [0.15, -0.3], -0.55); // the other cocked at the hip

  fig.userData.interact = { label: () => 'Look at the action figure', say: 'His arm is stuck like that. Still the best one you own.' };
  ctx.interact.push(fig);
}

/** Flat pad with rounded corners and soft edges, lying in the xy plane, thickness along +z. */
function padGeo(w, h, r, depth, bevel) {
  const x = -w / 2, y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 14 });
}

/** Box that tapers along its length (+z): one cross-section at the near end, another at the far end. */
function taperGeo(w0, h0, y0, w1, h1, y1, len) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getZ(i) + 0.5;
    const w = THREE.MathUtils.lerp(w0, w1, t), h = THREE.MathUtils.lerp(h0, h1, t);
    p.setXYZ(i, p.getX(i) * w, THREE.MathUtils.lerp(y0, y1, t) + p.getY(i) * h, t * len);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Kid's swivel chair pulled up to the PC, after the reference photo: thin blue cloth seat and a
 * wide low backrest, both with a black rim; ribbed black post between them; stepped gas lift;
 * five-star plastic base on hooded twin castors.
 */
function buildChair(scene, M, ctx) {
  const cloth = std({ map: T.weaveTex('#2a3fbe', '#1a2a8c', '#4a62e0'), roughness: 1 });
  const black = M.blackPlastic;
  const mesh = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  const chair = new THREE.Group();
  chair.position.set(2.88, 0, 2.0); // pushed in under the desk, so there is room to walk between it and the backpack
  chair.rotation.y = deg(18); // the base sits however it last rolled
  scene.add(chair);

  // ---- base: hub, five flat legs arching down from it, a hooded twin castor under each tip
  chair.add(cyl(0.042, 0.05, 0.055, black, 0, 0.098, 0, 20));
  const legGeo = taperGeo(0.058, 0.04, 0.1, 0.04, 0.026, 0.066, 0.28);
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / 5) * Math.PI * 2;
    const leg = mesh(legGeo, black);
    leg.position.z = 0.03;
    arm.add(leg);
    arm.add(rbox(0.05, 0.02, 0.058, 0.008, black, 0, 0.05, 0.3, 2));
    for (const s of [-1, 1]) {
      const wheel = cyl(0.026, 0.026, 0.017, black, s * 0.014, 0.026, 0.3, 18);
      wheel.rotation.z = Math.PI / 2;
      arm.add(wheel);
    }
    chair.add(arm);
  }
  // ---- gas lift: three plastic sleeves stepping in, then the bright piston
  chair.add(cyl(0.031, 0.035, 0.1, black, 0, 0.17, 0, 20));
  chair.add(cyl(0.027, 0.029, 0.09, black, 0, 0.255, 0, 20));
  chair.add(cyl(0.023, 0.025, 0.05, black, 0, 0.32, 0, 20));
  chair.add(cyl(0.012, 0.012, 0.05, M.chrome, 0, 0.365, 0, 14));

  // ---- everything above the piston swivels together; here it's turned towards the screen
  const top = new THREE.Group();
  top.position.y = 0.385;
  top.rotation.y = deg(112) - chair.rotation.y;
  chair.add(top);
  top.add(cyl(0.05, 0.035, 0.02, black, 0, 0.008, 0, 16));
  const flat = (geo, mat, y) => { // lay a pad down: its thickness becomes height
    const m = mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    top.add(m);
  };
  flat(padGeo(0.45, 0.43, 0.13, 0.008, 0.005), black, 0.022);
  flat(padGeo(0.43, 0.41, 0.125, 0.022, 0.016), cloth, 0.046);
  // height lever, out to one side
  const lever = cyl(0.006, 0.006, 0.2, black, 0.15, -0.004, 0.03, 8);
  lever.rotation.z = Math.PI / 2 - 0.2;
  top.add(lever);
  top.add(rbox(0.055, 0.012, 0.032, 0.005, black, 0.26, -0.027, 0.03, 2));

  // ---- back: a bracket out from under the seat, the ribbed post, then the padded rest
  top.add(box(0.05, 0.016, 0.13, black, 0, 0.014, -0.245));
  const back = new THREE.Group();
  back.position.set(0, 0.016, -0.3);
  back.rotation.x = -0.1;
  top.add(back);
  back.add(box(0.04, 0.34, 0.02, black, 0, 0.17, 0));
  for (let i = 0; i < 14; i++) back.add(rbox(0.058, 0.011, 0.038, 0.004, black, 0, 0.03 + i * 0.0138, 0, 2));
  const curve = (geo) => { // the rest wraps slightly round the sitter
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + 0.55 * p.getX(i) ** 2);
    geo.computeVertexNormals();
    return geo;
  };
  const shell = mesh(curve(padGeo(0.42, 0.255, 0.095, 0.006, 0.005)), black);
  shell.position.set(0, 0.365, 0.006);
  back.add(shell);
  const rest = mesh(curve(padGeo(0.4, 0.235, 0.088, 0.012, 0.012)), cloth);
  rest.position.set(0, 0.365, 0.022);
  back.add(rest);

  ctx.colliders.push({ type: 'box', x0: 2.62, x1: 3.14, z0: 1.74, z1: 2.26, top: 0.95 });
  chair.userData.interact = { label: () => 'Sit at the computer', use: () => ctx.sit() };
  ctx.interact.push(chair);
}

/** Outline of a thick stroke drawn along a centre line — how the rounded letters are cut out. */
function strokeShape(points, t) {
  const left = [], right = [];
  points.forEach((p, i) => {
    const a = points[Math.max(i - 1, 0)], b = points[Math.min(i + 1, points.length - 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    left.push([p[0] - (dy / len) * t / 2, p[1] + (dx / len) * t / 2]);
    right.push([p[0] + (dy / len) * t / 2, p[1] - (dx / len) * t / 2]);
  });
  const shape = new THREE.Shape();
  [...left, ...right.reverse()].forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  return shape;
}

/** Chunky block capitals, as sawn from a plank: `w` wide, `h` tall, strokes `t` thick, origin bottom-left. */
function letterShape(ch, w, h, t) {
  const arc = (cx, cy, rx, ry, from, to, steps) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = deg(from + ((to - from) * i) / steps);
      return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
    });
  const poly = (pts) => {
    const shape = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    return shape;
  };
  if (ch === 'L') return poly([[0, 0], [w * 0.86, 0], [w * 0.86, t], [t, t], [t, h], [0, h]]);
  if (ch === 'U') {
    const r = (w - t) / 2, cy = r + t / 2;
    return strokeShape([[t / 2, h], [t / 2, (h + cy) / 2], ...arc(w / 2, cy, r, r, 180, 360, 12), [w - t / 2, (h + cy) / 2], [w - t / 2, h]], t);
  }
  if (ch === 'C') return strokeShape(arc(w / 2 + 0.002, h / 2, (w - t) / 2, (h - t) / 2, 50, 310, 20), t);
  if (ch === 'A') {
    const shape = poly([[0, 0], [w * 0.26, 0], [w * 0.34, h * 0.26], [w * 0.66, h * 0.26], [w * 0.74, 0], [w, 0], [w * 0.63, h], [w * 0.37, h]]);
    shape.holes.push(poly([[w * 0.41, h * 0.45], [w * 0.59, h * 0.45], [w * 0.5, h * 0.76]]));
    return shape;
  }
  // S: two stacked arcs, the top one opening right, the bottom one opening left
  const r = (h - t) / 4, cx = w / 2;
  return strokeShape([...arc(cx, h - r - t / 2, r, r, 25, 270, 14), ...arc(cx, r + t / 2, r, r, 90, -155, 14).slice(1)], t);
}

/**
 * Shelf on the wall behind the headboard, with the wooden letter train on it: an engine pulling
 * L-U-C-A-S on little red-wheeled wagons and a guard's van at the back. Set down by a child —
 * every wagon a bit off the line, the gaps uneven.
 */
function buildShelf(scene, M, ctx) {
  const topY = 1.3; // just above a child's eye line, so the train is seen side-on from the floor
  const z0 = 0.22, z1 = 1.02, deep = 0.2;
  scene.add(box(deep, 0.024, z1 - z0, M.woodBed, deep / 2, topY - 0.012, (z0 + z1) / 2));
  const bracket = std({ color: 0xd8d2c4, roughness: 0.45, metalness: 0.3 });
  for (const z of [z0 + 0.13, z1 - 0.13]) {
    scene.add(box(0.005, 0.16, 0.028, bracket, 0.0025, topY - 0.104, z));
    scene.add(box(0.17, 0.005, 0.028, bracket, 0.088, topY - 0.0265, z));
    const brace = box(0.18, 0.004, 0.02, bracket, 0.075, topY - 0.095, z);
    brace.rotation.z = 0.72;
    scene.add(brace);
  }
  // your head finds it if you stand on the bed right under it
  ctx.colliders.push({ type: 'box', x0: 0, x1: deep, z0, z1, base: topY - 0.03, top: topY + 0.2 });

  const pine = std({ map: T.woodTex('#e6c993', '#b98c4e', 141, [16, 16], { contrast: 0.7 }), roughness: 0.7 });
  const dark = std({ color: 0x6f4d26, roughness: 0.8 });
  const red = std({ color: 0xc4201c, roughness: 0.3 });
  const white = std({ color: 0xece8de, roughness: 0.5 });

  const wagon = (len) => {
    const g = new THREE.Group();
    g.add(box(len, 0.012, 0.03, pine, 0, 0.016, 0));
    for (const x of [-len / 2 + 0.012, len / 2 - 0.012]) for (const z of [-0.0185, 0.0185]) {
      const wheel = cyl(0.0088, 0.0088, 0.007, red, x, 0.0088, z, 18);
      wheel.rotation.x = Math.PI / 2;
      g.add(wheel);
    }
    g.userData.len = len;
    return g;
  };
  const engine = () => {
    const g = wagon(0.07);
    const boiler = cyl(0.0125, 0.0125, 0.04, pine, -0.013, 0.0345, 0, 18);
    boiler.rotation.z = Math.PI / 2;
    g.add(boiler);
    g.add(cyl(0.0045, 0.0055, 0.013, pine, -0.024, 0.052, 0, 12));
    g.add(box(0.026, 0.034, 0.03, pine, 0.02, 0.039, 0));
    g.add(box(0.034, 0.005, 0.036, pine, 0.02, 0.0585, 0));
    return g;
  };
  const lettered = (ch) => {
    const g = wagon(0.06);
    const w = ch === 'S' ? 0.0335 : 0.042, h = 0.055, t = 0.012;
    const geo = new THREE.ExtrudeGeometry(letterShape(ch, w, h, t), { depth: 0.012, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 1, curveSegments: 6 });
    geo.translate(-w / 2, 0, -0.006);
    const m = new THREE.Mesh(geo, pine);
    m.position.y = 0.022;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return g;
  };
  // the last car: a little van with a roof and two windows through it
  const van = () => {
    const g = wagon(0.06);
    g.add(box(0.046, 0.028, 0.028, pine, 0, 0.036, 0));
    g.add(box(0.056, 0.006, 0.034, pine, 0, 0.053, 0));
    for (const x of [-0.011, 0.011]) g.add(box(0.012, 0.012, 0.0285, dark, x, 0.038, 0));
    return g;
  };

  // The train runs along the wall, engine towards the room's south end, so that from the room
  // (looking at this wall) it reads L-U-C-A-S left to right. In the train's own frame it runs
  // along +x; depth on the shelf is its z. [what, along, depth, turn in degrees]
  const train = new THREE.Group();
  train.position.set(0.105, topY, 0.875);
  train.rotation.y = Math.PI / 2;
  scene.add(train);
  const line = [
    [engine(), 0, 0.009, 6], [lettered('L'), 0.077, 0.003, -4], [lettered('U'), 0.154, -0.005, 3],
    [lettered('C'), 0.226, 0.002, -8], [lettered('A'), 0.308, -0.015, 12], [lettered('S'), 0.396, -0.001, -5],
    [van(), 0.475, 0.011, 7],
  ].map(([g, along, depth, turn]) => {
    g.position.set(along, 0, depth);
    g.rotation.y = deg(turn);
    train.add(g);
    g.updateMatrix();
    return g;
  });
  // white couplings from each hitch to the next, wherever the wagons ended up
  for (let i = 0; i < line.length - 1; i++) {
    const a = new THREE.Vector3(line[i].userData.len / 2, 0.016, 0).applyMatrix4(line[i].matrix);
    const b = new THREE.Vector3(-line[i + 1].userData.len / 2, 0.016, 0).applyMatrix4(line[i + 1].matrix);
    const link = cyl(0.0016, 0.0016, a.distanceTo(b), white, 0, 0, 0, 6);
    link.position.copy(a).lerp(b, 0.5);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    train.add(link);
    for (const p of [a, b]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 6), white);
      eye.receiveShadow = true; // (else the sun lit them through the wall, blind shut: white sparks along the train — user, 2026-11-02)
      eye.position.copy(p);
      train.add(eye);
    }
  }
  // generous invisible target: the letters themselves are thin and full of gaps
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.09, 0.07), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0.24, 0.045, 0);
  train.add(hit);
  train.userData.interact = { label: () => 'Look at the letter train', say: 'L - U - C - A - S.' };
  ctx.interact.push(train);
}

/** Orange lava lamp at the door end of the desk: slow blobs rising and sinking in a lit bottle. */
function buildLavaLamp(scene, M, ctx) {
  const { W } = ROOM;
  const lamp = new THREE.Group();
  lamp.position.set(W - 0.13, 0.75, 2.8);
  scene.add(lamp);
  const lathe = (profile, mat) => {
    const m = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 32), mat);
    lamp.add(m);
    return m;
  };
  lathe([[0, 0], [0.058, 0], [0.058, 0.006], [0.036, 0.07], [0.047, 0.115], [0, 0.115]], M.silver).castShadow = true;
  lathe([[0.024, 0.352], [0.019, 0.405], [0, 0.405]], M.silver).castShadow = true;
  const liquid = new THREE.MeshStandardMaterial({
    color: 0xff8a2a, emissive: 0xff6a10, emissiveIntensity: 0.9, roughness: 0.12,
    transparent: true, opacity: 0.5, depthWrite: false,
  });
  const bottle = lathe([[0.046, 0.112], [0.05, 0.16], [0.043, 0.25], [0.03, 0.33], [0.022, 0.362], [0, 0.362]], liquid);
  bottle.renderOrder = 2;
  const wax = std({ color: 0xff7a18, emissive: 0xff5a08, emissiveIntensity: 2.2, roughness: 0.4 });
  // a pool of wax on the bottom, and a few lumps on their way up or down
  const pool = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 12), wax);
  pool.scale.y = 0.45;
  pool.position.y = 0.128;
  lamp.add(pool);
  const lumps = [0.021, 0.016, 0.024, 0.013, 0.018].map((r, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), wax);
    lamp.add(m);
    return { m, r, speed: 0.11 + i * 0.037, phase: i * 1.9 };
  });
  const glow = new THREE.PointLight(0xff8a30, 0.32, 1.5, 2);
  glow.position.set(0, 0.24, 0);
  lamp.add(glow);

  const state = { on: true, clock: 0 };
  ctx.animated.push((t, dt) => {
    if (state.on) state.clock += dt; // the wax only moves while the lamp is warm
    for (const { m, r, speed, phase } of lumps) {
      const a = state.clock * speed + phase;
      const y = 0.15 + (0.5 + 0.5 * Math.sin(a)) * 0.17;
      const room = THREE.MathUtils.lerp(0.045, 0.026, (y - 0.15) / 0.17) - r; // bottle narrows towards the top
      m.position.set(Math.sin(a * 1.7 + phase) * room * 0.6, y, Math.cos(a * 1.3) * room * 0.6);
      m.scale.set(1, 1 + 0.3 * Math.abs(Math.cos(a)), 1); // stretched while it travels
    }
  });
  lamp.userData.interact = {
    label: () => (state.on ? 'Turn off the lava lamp' : 'Turn on the lava lamp'),
    use: () => {
      state.on = !state.on;
      ctx.sound.click(lamp.position);
      liquid.emissiveIntensity = state.on ? 0.9 : 0;
      wax.emissiveIntensity = state.on ? 2.2 : 0;
      glow.intensity = state.on ? 0.32 : 0;
    },
  };
  ctx.interact.push(lamp);

  // wall socket between the desk and the door: the lamp's cord, and the lead to the PC behind the desk
  const white = std({ color: 0xdcd6c8, roughness: 0.5 });
  scene.add(box(0.008, 0.115, 0.075, white, W - 0.004, 0.3, 3.15));
  for (const dy of [-0.026, 0.026]) scene.add(box(0.03, 0.036, 0.036, M.blackPlastic, W - 0.022, 0.3 + dy, 3.15));
  scene.add(cable([
    [W - 0.085, 0.762, 2.83], [W - 0.07, 0.756, 2.89], [W - 0.065, 0.74, 2.945], [W - 0.06, 0.4, 2.96],
    [W - 0.055, 0.012, 3.0], [W - 0.04, 0.012, 3.1], [W - 0.03, 0.12, 3.15], [W - 0.03, 0.256, 3.15],
  ], 0.003, M.rubber));
  scene.add(cable([
    [W - 0.03, 0.31, 3.15], [W - 0.032, 0.2, 3.13], [W - 0.03, 0.012, 3.04], [W - 0.026, 0.012, 2.8], [W - 0.026, 0.012, 2.3],
  ], 0.0035, M.rubber));
}

export function buildProps(scene, M, ctx) {
  ctx.animated.push((time) => rimMat.color.copy(RIM).multiplyScalar(1.6 + 0.3 * Math.sin(time * 2.6))); // the rims breathe
  buildStars(scene, ctx);
  buildPosters(scene);
  buildPower(scene, M, buildTvCorner(scene, M, ctx));
  buildBed(scene, M, ctx);
  buildDesk(scene, M, ctx);
  buildDresser(scene, M, ctx);
  buildFloor(scene, M, ctx);
  buildTeddy(scene, ctx);
  buildActionFigure(scene, M, ctx);
  buildLavaLamp(scene, M, ctx);
  buildChair(scene, M, ctx);
  buildShelf(scene, M, ctx);
}
