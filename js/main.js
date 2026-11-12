import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ROOM, makeMaterials, buildShell, buildWindow, buildDoor, buildLights, buildEnvironment } from './room.js';
import { buildProps } from './props.js';
import { Player } from './player.js';
import { Cat } from './cat.js';
import { Desktop } from './pc.js';
import { Sound } from './audio.js';
import { makeInventory } from './inventory.js';
import { uvBeam, UV_TORCH } from './uvtorch.js';
import { buildHouse, HOUSE_LAMPS } from './house.js';
import { TORCH } from './basement.js';
import { DAY } from './daytime.js';
import { shadowTwin, shadowOnly, countLamps, standIns, beginShaders as beginEarly, lampsAsSaid } from './build.js';
import { lunaBoat } from './boat.js';
import { bubbles } from './bubbles.js';
import { buildZelpa } from './zelpa.js';
import { deg, breathe, built, arrivals } from './util.js';
import { lighten } from './lighten.js';

// Every shadow looked up on the surface itself (`centroid`): at the edge of a surface seen side-on — a wall at a corner,
// the top of the corridor's rail — the picture's samples worked its point out past the end of it, out through the
// wall, into the sun: a line of light down the far corners of the corridor and of the bathroom and along the rail,
// coming and going as you moved (user, 2026-11-03). The more so the smaller the window.
for (const k of ['shadowmap_pars_vertex', 'shadowmap_pars_fragment']) THREE.ShaderChunk[k] = THREE.ShaderChunk[k].replaceAll('varying vec4 v', 'centroid varying vec4 v');
const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');
const HEAVY = params.has('heavy'); // (the textures left as drawn, nothing let go of: for comparing against — lighten.js) // clean frame for comparing against the reference photo
const REHEARSE = !params.has('norehearsal'); // (each thing drawn once before it is needed — `rehearse`, below; `?norehearsal`: as it was, readied at first sight: to measure against)

// Where the reference photo was taken from: just inside the door, looking north-west.
const START = { x: 3.3, z: 3.72, yaw: 33, pitch: -12 };

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.localClippingEnabled = true; // Luna in her boat (cat.clip)
// The rehearsal's state (`rehearse`, far below), here because the game's first handlers read it.
const rehearsed = {
  ms: 0, shaders: 0, drawn: 0, rounds: 0, steps: [], line: null, // (`steps`: what each round drew and took, for measuring)
  left: 0, // how many things are still to be drawn
  playing: false, still: 0, hurry: false, // you are playing; for how long your eye has not moved; no waiting for that (finish)
  first: null, whole: null, // promises: the water's mirror ready; all of it done
  /** All that is left, now, whether you are playing or not (for measuring); resolves when it is done. */
  finish() { rehearsed.hurry = true; return rehearsed.whole; },
};
/** For how long the eye has stood still (the rehearsal takes its turns then: a held frame shows in nothing that you see move by your own doing). */
const eyeWas = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
function stillFor(dt) {
  if (camera.position.distanceToSquared(eyeWas.p) < 1e-8 && Math.abs(camera.quaternion.dot(eyeWas.q)) > 1 - 1e-8) rehearsed.still += dt;
  else {
    rehearsed.still = 0;
    eyeWas.p.copy(camera.position);
    eyeWas.q.copy(camera.quaternion);
  }
}
/**
 * Leaves three's count of cutting planes at `n`, by drawing one small thing cut by that many into a pixel of its own:
 * `compile` makes each shader for the count the last thing drawn left behind (0 for nearly everything).
 */
const primer = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mats: new Map(), mesh: null, target: null };
function planesLeft(n, draw = true) {
  let m = primer.mats.get(n);
  if (!m) {
    primer.mats.set(n, (m = new THREE.MeshBasicMaterial({ clippingPlanes: n ? Array.from({ length: n }, () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e4)) : null })));
    m.customProgramCacheKey = () => 'planes-left'; // (its own shader: never one of the game's, which are made later, from the shader code as the house sets it)
  }
  if (!primer.mesh) {
    primer.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    primer.mesh.frustumCulled = false;
    primer.scene.add(primer.mesh);
    primer.target = new THREE.WebGLRenderTarget(1, 1);
  }
  primer.mesh.material = m;
  if (!draw) return;
  const was = renderer.getRenderTarget(), due = renderer.shadowMap.needsUpdate;
  renderer.shadowMap.needsUpdate = false;
  renderer.setRenderTarget(primer.target);
  renderer.render(primer.scene, primer.cam);
  renderer.setRenderTarget(was);
  renderer.shadowMap.needsUpdate = due;
}
// (made now, with nothing else for the card to do: asked for in the middle of the loading, each waited its turn behind
// every other shader — 7 s. The counts: none; Luna's suit, 16, its torso and paws, 17 — boat.js; her coat, 24 — cat.js CLIPS.
// Another count is made when it is asked for. With `?norehearsal` they are made all the same and not drawn: three
// takes from Math.random for every thing it makes, and two loads with the same dice — tools/measure-server.py `?seeded`,
// tools/same-picture.js — must make the same things in the same order to build the same house.)
for (const n of [16, 17, 24, 0]) planesLeft(n, REHEARSE);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // (and less when the frames come slowly: sharpen())
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // the room is static; re-render shadows only when something moves
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = null; // the house is drawn into the same picture after the bedroom, sky and all
renderer.setClearColor(0x070504);
const camera = new THREE.PerspectiveCamera(56, 1, 0.05, 62); // (62: the sky round the yard, from the far end past the pool — 2026-10-29)

// ---------------------------------------------------------------- world

const M = makeMaterials();
const lights = buildLights(scene);
scene.environment = buildEnvironment(renderer);
scene.environmentIntensity = 0.32;
const ROOM_ENV = scene.environmentIntensity; // (with the blind as it hangs open; less as it shuts: tick)

const sound = new Sound();
const desktop = new Desktop();
const inventory = makeInventory({ renderer, scene, camera, environment: scene.environment });
const ctx = { colliders: [], interact: [], animated: [], ladders: [], lights, desktop, sound, inventory, environment: scene.environment, camera, player: null }; // (player: set once there is one; ladders: the slide's, yard.js)
const shell = buildShell(scene, M);
{
  // the window's wall once more, into the sun's shadow alone and from both sides (build.js shadowTwin): its shadow
  // then starts at its sunny outer face. Taken at its inner face, as three takes a wall's, it was level with what
  // stands against it, and a thread of sun got in down the corner by the shelf and along the window's casing (user,
  // 2026-10-28). A centimetre clear of the window's opening, so the sun on its reveals is as it was.
  const { W, H, T: t, win } = ROOM, e = 0.01;
  const slab = ([x0, x1], [y0, y1]) => new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, t)).translateX((x0 + x1) / 2).translateY((y0 + y1) / 2).translateZ(-t / 2);
  scene.add(shadowOnly(shadowTwin([slab([-t, win.x0 - e], [0, H]), slab([win.x1 + e, W + t], [0, H]), slab([win.x0 - e, win.x1 + e], [0, win.y0 - e]), slab([win.x0 - e, win.x1 + e], [win.y1 + e, H])]), [lights.sun]));
  // and a lid over the room, 30 cm thick: the sun's shadow of the ceiling alone, a plane, let a dashed line of it in
  // along the top of the west wall, right under the ceiling, the blind shut (user, 2026-11-03)
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * t, 0.3, ROOM.D + 2 * t)).translateX(W / 2).translateY(H + 0.15).translateZ(ROOM.D / 2);
  scene.add(shadowOnly(shadowTwin([lid]), [lights.sun]));
}
const blind = buildWindow(scene, M);
{
  // the sash too, from both sides, a hair inside its faces (so its own sunny faces keep their light): taken at its
  // far faces, a thread of sun lay along its foot on the reveal, right by the glass (user, 2026-11-03)
  const k = 0.0015, piece = ([x0, x1, y0, y1, z0, z1]) => new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 2 * k, y1 - y0 - 2 * k, z1 - z0 - 2 * k)).translateX((x0 + x1) / 2).translateY((y0 + y1) / 2).translateZ((z0 + z1) / 2);
  // and a band round the glass, just outside the sash (the shadow a glazing bead would give): the low sun through the
  // glass lit the sash's own faces round it, the ones that look into the opening, a thin bright line down one side of
  // the glass and along its foot — "a line of light on the frame by the glass" (user, 2026-11-03). Its sides 4 cm,
  // its rails 2 cm: wide enough for those faces right through to the room side at 15° of sun
  const [west, east, top, bottom, meeting] = blind.sash, z0 = west[4] - 0.006, z1 = west[4] - 0.001, S = 0.04, R = 0.02;
  const bands = [[west[1], west[1] + S, bottom[3], top[2]], [east[0] - S, east[0], bottom[3], top[2]], [west[1], east[0], bottom[3], bottom[3] + R], [west[1], east[0], top[2] - R, top[2]],
    [west[1], east[0], meeting[3], meeting[3] + R], [west[1], east[0], meeting[2] - R, meeting[2]]].map(([x0, x1, y0, y1]) => [x0, x1, y0, y1, z0, z1]);
  scene.add(shadowOnly(shadowTwin([...blind.sash, ...bands].map(piece)), [lights.sun]));
}
const door = buildDoor(scene, M, ctx.colliders);
buildProps(scene, M, ctx);
// The bedroom's shaders, begun early, for the graphics card to get on with while the page builds the house and the yard
// (build.js). Its lamps as they will be: the room's own and the UV torch's beam, which comes with the house. Not
// before the house has set the lighting code every shader shares (`twoFills`: begun before it, 14 of them kept the
// code as it was, under the same name): house.js calls this back as soon as it has.
const ROOM_LAMPS = { hemi: 1, rect: 0, dir: [0, 0], point: [0, 4], spot: [2, 1] };
ctx.sharedShaderCodeSet = () => beginEarly(renderer, scene, standIns(scene, ROOM_LAMPS, countLamps(scene)));
// the rest of the house and the yard: a scene of its own, with its own lamps (house.js)
await breathe(0.05);
const house = await buildHouse(renderer, M, ctx);
for (const pane of blind.glass) house.scene.add(pane); // the window's glass, drawn after the yard it is in front of (room.js)

let shadowsDirty = 3;
const SLAT_GLOW = M.slat.emissiveIntensity; // (the light through the blind's slats, as they hang open)
// Props that move on their own call ctx.touch() each frame they do: the window-glow shadow map
// follows them, and the big sun map is redrawn once when they have come to rest.
let stirring = 0;
ctx.touch = () => { stirring = 0.3; };
// the blind: open is pulled up as it always hangs, slats half shut; closed is let right down to the
// sill, slats shut (user, 2026-10-15: no more wide-open slats)
const BLIND_MODES = [
  { tilt: deg(32), drop: 0, label: 'Close the blinds' },
  { tilt: deg(78), drop: 1, label: 'Open the blinds' },
];
blind.group.userData.interact = {
  label: () => BLIND_MODES[blind.state.mode].label,
  use: () => {
    blind.state.mode = (blind.state.mode + 1) % BLIND_MODES.length;
    blind.state.target = BLIND_MODES[blind.state.mode].tilt;
    blind.state.dropTarget = BLIND_MODES[blind.state.mode].drop;
    sound.blinds([1.975, 1.6, 0]);
  },
  when: () => player.pos.y > -ROOM.T, // (only from in the room: out in the yard it isn't yours to work — user, 2026-10-18)
};
door.group.userData.interact = {
  label: () => (door.state.open ? 'Close the door' : 'Open the door'),
  use: () => {
    door.state.open = !door.state.open;
    door.state.target = door.state.open ? deg(108) : 0;
    sound.door(door.state.open, [ROOM.door.x0, 1, ROOM.D]);
  },
};
ctx.interact.push(blind.group, door.group);

const player = new Player(camera, canvas, ctx.colliders, house.bounds);
ctx.player = player; // (the yard's swing and hose need you)
player.ladders = ctx.ladders; // (the slide's, to climb)
house.bath.you = player; // the floating duck: you push it, walking or swimming into it
player.extraColliders = house.extraColliders.slice(); // (the boat adds itself: boat.js)
player.setPose(START.x, START.z, START.yaw, START.pitch);
player.onStep = (surface, speed, first) => sound.step(surface, speed, first);
player.onLand = (speed, surface) => sound.land(speed, surface);
const cat = new Cat(scene, ctx, player, camera);
cat.swinging = house.swinging; // the fridge's doors, open, are in her way too
cat.doors = [door.seg, ...house.doorSegs]; // (shut across her way after she set off: she finds another, or stops this side)
// her boat, for when the bathroom has flooded (boat.js)
house.bath.volume.patch(house.scene); // what is under the water seen through it, from above (bath.js)
// in the bathroom's water you float (player.js), never up through the head of its doorway
player.waterAt = (x, z) => house.bath.levelAt(x, z);
player.baseAt = (x, z) => house.baseAt(x, z, player.feet); // (the yard lower than the house: house.js LIFT; the cellar's steps and the basement under it: basement.js)
player.headroomAt = (x, z) => {
  const B = house.bathroom;
  return x > B.door.x0 - 0.3 && x < B.door.x1 + 0.3 && Math.abs(z - B.z0) < 0.45 ? ROOM.door.h - 0.1 : Infinity;
};
const boat = lunaBoat(house.scene, cat, { bathroom: house.bathroom, water: house.bath, colliders: ctx.colliders, env: house.bathEnv, door: house.bathDoor, blocks: () => house.cabinetBlock() });
// Luna, her boat, her hat and her diving suit take the bathroom's water (bath.js `volume`) here, with everything else:
// they took it as they came (every 60th frame, in the loop), each one's shaders made over again there and then, the
// game stopped while they were (user, 2026-11-11, playing on the web: "it freezes to load" as she takes to her boat)
if (REHEARSE) {
  house.bath.volume.patch(house.scene);
  house.bath.volume.patch(cat.root);
  house.bath.volume.patchThese(boat.gear.paws);
}
// she has the run of the house, and follows you from room to room
cat.wholeHouse({ colliders: ctx.colliders, ...house.catFloor, stamp: () => `${Math.round(door.state.angle * 20)}|${house.doorStamp()}`, roomAt: house.roomAt, perches: house.catPerches });

// The game in the TV is a place of its own; `world` says which one you are standing in.
const zelpa = buildZelpa({ glassY: ctx.tv.screen.y });
const ROOM_BOUNDS = player.bounds;
let world = 'room'; // or 'zelpa'
let interactables = ctx.interact;
zelpa.setEye(ctx.tv.screen.clone().add(new THREE.Vector3(0.02, 0, 0))); // it looks back out from just in front of the glass
cat.addPlace('zelpa', { scene: zelpa.scene, colliders: zelpa.colliders, ...zelpa.floor, still: true, perches: zelpa.perches, interact: zelpa.interact, flat: true });
// In the bedroom you are yourself; in the game you are its hero, who is a good deal shorter. [eyes standing, eyes crouched]
const HEIGHT = { room: [player.tall, player.low], zelpa: [0.8, 0.52] };

// Shadow maps are redrawn by hand. The sun's is big and only changes with the blind or the door;
// the window glow's is small and follows the cat. The cat is kept out of the sun's map so a
// stale silhouette never gets baked onto the wall.
lights.sun.shadow.autoUpdate = false;
lights.glow.shadow.autoUpdate = false;

// ---------------------------------------------------------------- post

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.52 },
    uGrain: { value: 0.035 },
    uTint: { value: new THREE.Vector3(...DAY.tint) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain;
    uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      float edge = smoothstep(0.2, 0.82, length(q * vec2(1.0, 1.12)));
      c.rgb *= 1.0 - uVignette * edge;
      c.rgb *= uTint;
      float n = hash(vUv * 913.0 + fract(uTime) * 61.0) - 0.5;
      c.rgb += n * uGrain * (0.25 + c.rgb);
      gl_FragColor = vec4(max(c.rgb, 0.0), c.a);
      // and straight onto the screen: tone mapped and into sRGB as OutputPass did, one full-screen pass fewer
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

/**
 * The picture the scenes are drawn into: multisampled, half-float, with its depth. Three resolves a multisampled
 * target after every render into it — three times a frame here, colour and depth, every sample written out and read
 * back in for the next scene — so this one is three's in name only (`setRenderTargetFramebuffer`) and is resolved by
 * hand, once, colour only, when every scene is in; its samples are then let go of, never written out.
 */
function sharedPicture() {
  const gl = renderer.getContext(), state = renderer.state, samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
  const fb = gl.createFramebuffer(), color = gl.createRenderbuffer(), depth = gl.createRenderbuffer();
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  renderer.setRenderTargetFramebuffer(rt, fb);
  return {
    rt,
    setSize(w, h) {
      w = Math.floor(w);
      h = Math.floor(h);
      for (const [rb, format] of [[color, gl.RGBA16F], [depth, gl.DEPTH_COMPONENT24]]) {
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, format, w, h);
      }
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      state.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      state.bindFramebuffer(gl.FRAMEBUFFER, null);
      // (its size set by hand: setSize would dispose of it, and of the framebuffer with it)
      rt.width = w;
      rt.height = h;
      rt.viewport.set(0, 0, w, h);
      rt.scissor.set(0, 0, w, h);
    },
    resolve(into) {
      renderer.setRenderTarget(into); // (three makes its framebuffer the first time)
      state.setScissorTest(false);
      state.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
      state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, renderer.properties.get(into).__webglFramebuffer);
      gl.blitFramebuffer(0, 0, rt.width, rt.height, 0, 0, rt.width, rt.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.invalidateFramebuffer(gl.READ_FRAMEBUFFER, [gl.COLOR_ATTACHMENT0, gl.DEPTH_ATTACHMENT]);
      state.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    },
  };
}
const picture = sharedPicture();
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false }));
// The bedroom is drawn first, then the rest of the house and the yard into the same picture and
// against the same depth, so each shows only where nothing of the other stands in front of it.
// Each scene has its own lamps and its own shadow maps, redrawn when its own things move.
let roomShadowsDue = true;
const roomPass = { scene, shadowsDue: () => roomShadowsDue, enabled: true, hide: () => hideUnseen('room') };
const housePass = { scene: house.scene, shadowsDue: () => house.shadowsDue(), enabled: true, hide: () => hideUnseen('list') };
// and under the house, the basement (basement.js): drawn only when it can be seen; from down there the house and the
// bedroom only when the cellar's open doors are in view
const cellarPass = { scene: house.cellar.scene, shadowsDue: () => house.cellar.shadowsDue(), enabled: true, hide: () => hideUnseen('cellar') };
class ScenesPass extends Pass {
  constructor(list) {
    super();
    this.list = list;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(picture.rt);
    renderer.clear();
    for (const p of this.list) {
      if (!p.enabled) continue;
      renderer.shadowMap.needsUpdate = p.shadowsDue();
      p.hide?.(); // (left out of the picture only: three shows them again before it draws shadows)
      renderer.render(p.scene, camera);
      showUnseen();
    }
    picture.resolve(readBuffer);
    renderer.autoClear = autoClear;
  }
}
composer.addPass(new ScenesPass([roomPass, housePass, cellarPass]));
// No bloom (user, 2026-10-14): it put a halo round everything bright — sunlit sheets, plates, even
// Luna's eyes. The pass stays in place, switched off, in case it is ever wanted for the lamps alone.
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.42, 0.75, 1.0);
bloom.enabled = false;
composer.addPass(bloom);
const grade = new ShaderPass(GradeShader);
composer.addPass(grade);

function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  picture.setSize(composer.readBuffer.width, composer.readBuffer.height);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  zelpa.resize(w, h);
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- HUD + interaction

const $ = (id) => document.getElementById(id);
const startEl = $('start'), startBtn = $('start-btn'), statusEl = $('start-status');
const crossEl = $('crosshair'), promptEl = $('prompt'), promptLabel = $('prompt-label'), sayEl = $('say'), hintEl = $('hint');
const underEl = $('underwater');

const ray = new THREE.Raycaster();
// walls stop the eye: something you could use on the other side of one is out of reach
const walls = [...shell.children.filter((m) => m.isMesh), ...house.occluders];
// the UV torch's beam, in the bedroom and out in the house; on while it is in your hand
const uv = uvBeam([scene, house.scene], camera), lensAt = new THREE.Vector3(), torchAt = new THREE.Vector3(), torchDir = new THREE.Vector3();
ray.far = 2.1;
const CENTRE = new THREE.Vector2(0, 0);
let focus = null;
let sayTimer = 0;

/** Whether any of Luna can be seen from your eye: rays to five points on her, any not stopped by a wall (doors and windows are holes in them). */
const sightRay = new THREE.Raycaster(), catPt = new THREE.Vector3(), toCat = new THREE.Vector3();
function catInSight() {
  if (world !== 'room' || cat.place.name !== 'room') return true;
  const eye = camera.position;
  for (const [dx, dy, dz] of [[0, 0.2, 0], [0.24, 0.25, 0], [-0.24, 0.15, 0], [0, 0.2, 0.24], [0, 0.2, -0.24]]) {
    catPt.set(cat.pos.x + dx, cat.pos.y + dy, cat.pos.z + dz);
    toCat.subVectors(catPt, eye);
    const d = toCat.length();
    if (d < 1.5) return true;
    sightRay.set(eye, toCat.divideScalar(d));
    sightRay.far = d;
    if (!sightRay.intersectObjects(walls, false).length) return true;
  }
  return false;
}

function findInteract(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData.interact) return o.userData.interact.when?.() === false ? null : o.userData.interact; // (`when`: only now and then, the sand with the spade in your hand)
  return null;
}

/** The blue rim of a thing you can take (props.js takeable): lit while you point at it, and only then. */
let rimOn = null;
function rimFor(obj) {
  for (let o = obj; o; o = o.parent) if (o.userData.interact) return o.userData.rim ?? null;
  return null;
}

function updateFocus() {
  ray.setFromCamera(CENTRE, camera);
  const hit = ray.intersectObjects(world === 'room' ? [...interactables, ...walls] : interactables, true)[0];
  focus = hit ? findInteract(hit.object) : null;
  const show = !!focus && player.enabled && !player.seat && !inventory.open;
  const rim = show && hit ? rimFor(hit.object) : null;
  if (rim !== rimOn) {
    if (rimOn) rimOn.visible = false;
    if (rim) rim.visible = true;
    rimOn = rim;
  }
  crossEl.classList.toggle('hot', show);
  if (world === 'zelpa') {
    // in the game it is the game's own badge that names what you can do: one word
    promptEl.hidden = true;
    const act = show ? (typeof focus.act === 'function' ? focus.act() : focus.act) ?? focus.label().split(' ')[0] : '';
    zelpa.setAction(act || (atLadder ? 'Climb' : ''));
    return;
  }
  promptEl.hidden = !show;
  if (show) promptLabel.textContent = focus.label();
}

function say(line, seconds = 3.2) {
  if (!line) return;
  sayEl.textContent = line;
  sayEl.hidden = false;
  sayTimer = seconds;
}

function use() {
  if (player.ride) { player.ride.off(); return; } // getting off the swing
  if (player.holding) { player.holding.release(); return; } // putting the hose down, or back on its hook
  if (!player.enabled || player.seat) return;
  if (!focus) {
    if (world === 'zelpa') zelpa.swing(); // nothing in front of you: a swing at the air, if you have something to swing
    return;
  }
  if (focus.use) focus.use();
  say(typeof focus.say === 'function' ? focus.say() : focus.say);
}

// ---- what you are carrying (I): while it is open you stand still and the keys choose from it
function setInventory(on) {
  if (inventory.open === on) return;
  inventory.show(on);
  player.frozen = on;
  crossEl.hidden = on || !player.enabled || !!player.seat;
  if (on) promptEl.hidden = true;
}
function inventoryKey(code) {
  if (inventory.key(code)) setInventory(false); // something taken in hand, or put away: back to the room
}

// ---- sitting at the PC: the view locks onto the screen and the mouse and keyboard go to the desktop
let nearScreen = false; // standing at the glass, on one side of it or the other, close enough to jump through
let atLadder = false; // at the foot of something climbable
let swimFor = 0, swimHint = false; // how long you have had water over your head; the keys shown, its first seconds
let rideHint = false, heldHint = ''; // on the swing; holding the hose
function showHint() {
  const seated = !!player.seat && player.enabled;
  const leap = !seated && player.enabled && nearScreen, climb = !seated && !leap && player.enabled && atLadder;
  const swim = !seated && !leap && !climb && player.enabled && swimHint;
  const riding = !!player.ride && !seated && player.ride.hint !== ''; // (going down the slide: nothing to press)
  const holding = !riding && !seated && player.enabled && !!player.holding; // (the hose, yard.js)
  hintEl.hidden = !seated && !leap && !climb && !swim && !riding && !holding;
  if (seated) hintEl.innerHTML = `${desktop.power === 'off' ? '<kbd>Click</kbd> switch on · ' : ''}<kbd>Tab</kbd> get up`;
  else if (leap) hintEl.innerHTML = world === 'room' ? '<kbd>Space</kbd> jump into the screen' : '<kbd>Space</kbd> jump back out';
  else if (climb) hintEl.innerHTML = '<kbd>W</kbd> climb';
  else if (swim) hintEl.innerHTML = '<kbd>Space</kbd> swim up · <kbd>C</kbd> swim down'; // (user, 2026-10-17)
  if (riding) hintEl.innerHTML = player.ride.hint ?? '<kbd>W</kbd> <kbd>S</kbd> swing · <kbd>E</kbd> get off'; // (user, 2026-10-17)
  else if (holding) hintEl.innerHTML = player.holding.hint();
}

function setSeated(on) {
  if (!!player.seat === on) return;
  if (on) player.sit(ctx.seat);
  else player.stand();
  sound.chair(on, [2.88, 0.45, 2.0]);
  ctx.pcPower(desktop.power !== 'off', on);
  desktop.active = on;
  desktop.up();
  desktop.dirty = true;
  crossEl.hidden = on || !player.enabled;
  promptEl.hidden = true;
  showHint();
}
ctx.sit = () => setSeated(true);
player.onSeatMouse = (dx, dy) => desktop.move(dx, dy);

// ---- the PC's power button: boots it if it's off, shuts it down properly if it's running
ctx.pcSwitch = () => {
  if (desktop.power === 'off') desktop.powerOn();
  else desktop.shutdown();
};
desktop.onPower = (on) => {
  ctx.pcPower(on, !!player.seat);
  sound.pcPower(on);
  showHint();
};
desktop.onSound = (name) => sound.ui(name);

function setPlaying(on) {
  player.enabled = on;
  rehearsed.playing = on; // (the rehearsal: flat out behind the start window, only while you stand still once you play)
  player.edge.set(0, 0);
  startEl.hidden = on;
  crossEl.hidden = !on || !!player.seat;
  showHint();
  sound.setPaused(!on);
  document.body.classList.toggle('playing', on);
  if (!on) promptEl.hidden = true;
}

function pause() {
  setInventory(false);
  startBtn.textContent = 'Resume';
  setPlaying(false);
}

startBtn.addEventListener('click', () => {
  startBtn.blur(); // so Space jumps instead of pressing the button again
  sound.start(); // audio may only begin from a click
  setPlaying(true);
  // pointer lock can be refused (embedded previews); the view still follows the cursor then
  const req = canvas.requestPointerLock?.();
  if (req?.catch) req.catch(() => {});
});
canvas.addEventListener('click', () => {
  // ?shot=1 hides the start window: then a click on the picture is what starts the game
  if (!player.enabled && startEl.hidden) return startBtn.click();
  if (inventory.open) inventoryKey('KeyE');
  else if (!player.seat) use();
});
canvas.addEventListener('mousedown', (e) => {
  if (!player.seat || !player.enabled) return;
  if (desktop.power === 'off') ctx.pcSwitch(); // reaching over to the power button
  else desktop.down(e.button === 2);
});
addEventListener('mouseup', () => desktop.up());
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let locked = false;
document.addEventListener('pointerlockchange', () => {
  const now = document.pointerLockElement === canvas;
  if (locked && !now && player.enabled) pause(); // Esc released the lock
  locked = now;
});
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && player.enabled && !locked) return pause();
  if (player.seat && player.enabled) {
    // at the desk typing belongs to the PC, except the key that gets you up;
    // browser shortcuts (reload and so on) are left alone
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Tab') e.preventDefault();
    if (e.code === 'Tab') setSeated(false);
    else desktop.key(e);
    return;
  }
  if (inventory.open) {
    // everything goes to it until it is shut
    if (e.code === 'KeyI' || e.code === 'Tab') setInventory(false);
    else inventoryKey(e.code);
    if (e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
    return;
  }
  if (e.code === 'KeyI' && player.enabled && world === 'room' && !warp.to) setInventory(true);
  if (e.code === 'KeyE') use();
  if (e.code === 'KeyM' && player.enabled) {
    sayEl.textContent = sound.toggleMute() ? 'Sound off' : 'Sound on';
    sayEl.hidden = false;
    sayTimer = 1.5;
  }
});

// ---------------------------------------------------------------- into the TV and back

const WARP = 0.4, CLEAR = 0.7; // seconds to white out, and to see again on the other side
// looking square at the glass, from the bedroom and from inside the game
const INTO_SCREEN = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0, 'YXZ'));
const OUT_OF_GAME = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0, 'YXZ'));
const HOLE_AT = new THREE.Vector3(zelpa.hole.x, zelpa.hole.y, zelpa.hole.z);
// When you and Luna are on different sides of the glass she knows where you went: for her,
// "you" are the glass itself — the TV screen from the bedroom, the hole from inside the game.
const SCREEN = ctx.tv.screen;
const BEYOND = {
  room: { player: { pos: new THREE.Vector2(0.95, SCREEN.z), yaw: -Math.PI / 2, feet: 5 }, camera: { position: SCREEN } },
  zelpa: { player: { pos: new THREE.Vector2(0, zelpa.hole.z - 0.5), yaw: 0, feet: 5 }, camera: { position: HOLE_AT } },
};
function lunaLooksFor() {
  const together = cat.place.name === world;
  cat.player = together ? player : BEYOND[cat.place.name].player;
  cat.camera = together ? camera : BEYOND[cat.place.name].camera;
}
// And she won't be left behind. A few seconds after you go through, she trots up to the glass
// and jumps through after you. Each way: the floor she takes off from, the point she leaps at,
// and where she comes out on the other side (appearing at / landing at).
const WAYS = {
  zelpa: { off: [1.15, SCREEN.z], to: [SCREEN.x - 0.03, SCREEN.y - 0.2, SCREEN.z], out: [0, zelpa.hole.y - 0.2, zelpa.hole.z - 0.06], land: [0.14, zelpa.hole.z - 0.85] },
  room: { off: [0, zelpa.hole.z - 0.75], to: [0, zelpa.hole.y - 0.2, zelpa.hole.z - 0.03], out: [SCREEN.x + 0.04, SCREEN.y - 0.2, SCREEN.z], land: [1.25, SCREEN.z + 0.12] },
};
let followIn = 3;
// The bathroom door shuts behind you when you go in (user, 2026-10-15), once each time you go in, and
// only once Luna is in too; it never swings through you, her, or her boat.
const bathShut = { armed: false, wait: 0, since: 0, was: false, hinge: new THREE.Vector3() };
function bathDoorBehind(dt) {
  const D = house.bathDoor, S = D.seg, here = house.roomAt(player.pos.x, player.pos.y) === 'bath';
  if (here && !bathShut.was) { bathShut.armed = D.state.target > 0.01; bathShut.wait = 0; bathShut.since = 0; }
  bathShut.was = here;
  if (!bathShut.armed || !here) return;
  bathShut.wait += dt;
  const reach = Math.hypot(S.bx - S.ax, S.bz - S.az) + 0.35; // all the leaf sweeps, and a little
  // and she comes straight in after you, 3 s behind you at most (user, 2026-11-03: "so the door shuts and the level
  // can start"): from wherever she is in the house to just past where the door sweeps, then she sits and waits
  if (cat.place.name === 'room' && !cat.ride && !cat.dive && !cat.hurrying && !cat.committed && house.roomAt(cat.pos.x, cat.pos.z) !== 'bath') {
    const B = house.bathroom, x = (B.door.x0 + B.door.x1) / 2 + 0.12, z = B.z0 + reach + 0.45;
    const [tx, tz] = cat.nav.free(x, z) ? [x, z] : cat.nav.centre(cat.nav.nearest(x, z));
    cat.hurryTo(tx, tz, Math.max(0.6, 2.2 - bathShut.since)); // (aimed short of 3 s: through the doorway she slows to turn)
  }
  bathShut.since += dt;
  const near = (x, z, r = 0) => Math.hypot(x - S.ax, z - S.az) < reach + r;
  if (near(player.pos.x, player.pos.y)) return;
  if (cat.place.name !== 'room' || house.roomAt(cat.pos.x, cat.pos.z) !== 'bath') return; // not till she is in
  if (near(cat.pos.x, cat.pos.z, 0.15)) return; // in its way
  for (const c of cat.obstacles) {
    const abx = c.bx - c.ax, abz = c.bz - c.az, t = THREE.MathUtils.clamp(((S.ax - c.ax) * abx + (S.az - c.az) * abz) / (abx * abx + abz * abz || 1), 0, 1);
    if (Math.hypot(S.ax - c.ax - abx * t, S.az - c.az - abz * t) < reach + c.r) return; // her boat
  }
  // slammed (user): fast, hard, a bang
  D.state.open = false;
  D.state.target = 0;
  D.state.slam = true;
  D.onSlam = () => sound.sample('door-slam', bathShut.hinge.set(S.ax, 1, S.az)); // silent until there is a recording
  bathShut.armed = false;
}
// And going out (user, 2026-11-11: "when you leave the bathroom, Luna leaves with you and then the door closes"): the
// moment you are through the doorway she comes straight out after you, to just outside it on your side; once you are
// both clear of the doorway it shuts behind you the way it does going in — never on her, never with her still in there.
const bathLeft = { armed: false, was: false, byHand: false, hinge: new THREE.Vector3() };
// In there, or on her way in (user, 2026-11-12: "always make sure she's out before the door closes" — you had gone in
// and straight out again while she was still coming from the living room; it shut behind you, she went on in, and
// was shut in there): wherever she is walking, leaping or climbing to counts as where she is.
const inBath = (x, z) => house.roomAt(x, z) === 'bath';
const lunaHeadedIn = () => cat.queue.some((s) => (s.type === 'walk' && inBath(s.x, s.z)) || ((s.type === 'jump' || s.type === 'line') && s.to && inBath(s.to[0], s.to[2])));
const lunaInBath = () => cat.place.name === 'room' && (inBath(cat.pos.x, cat.pos.z) || lunaHeadedIn());
function bathDoorAfter() {
  const D = house.bathDoor, S = D.seg, B = house.bathroom, room = house.roomAt(player.pos.x, player.pos.y);
  if (room === 'bath') { bathLeft.was = true; bathLeft.armed = false; bathLeft.byHand = false; return; }
  if (bathLeft.was) { bathLeft.was = false; bathLeft.armed = D.state.target > 0.01; } // (out into the doorway: on your way out)
  if (!bathLeft.armed) return;
  if (D.state.target <= 0.01) { bathLeft.armed = false; return; } // (shut some other way meanwhile)
  const doorX = (B.door.x0 + B.door.x1) / 2, goingIn = lunaHeadedIn(), catIn = lunaInBath();
  if (catIn && !cat.ride && !cat.dive && (!cat.hurrying || goingIn) && !cat.committed) {
    // just outside, a little your way
    const ox = doorX, oz = B.z0 - 0.55, vx = player.pos.x - ox, vz = player.pos.y - oz, v = Math.hypot(vx, vz), k = v > 0.9 ? Math.min(0.5, v - 0.8) / v : 0;
    const x = ox + vx * k, z = Math.min(oz + vz * k, B.z0 - 0.4);
    const [tx, tz] = cat.nav.free(x, z) ? [x, z] : cat.nav.centre(cat.nav.nearest(x, z));
    cat.hurryTo(tx, tz, THREE.MathUtils.clamp(Math.hypot(cat.pos.x - tx, cat.pos.z - tz) / 2.2, 1.5, 4));
  }
  // both of you out, and clear of the doorway (its frame, and a stride past it)
  const inWay = (x, z, m) => Math.abs(x - doorX) < (B.door.x1 - B.door.x0) / 2 + 0.25 && z > B.z0 - m;
  if (catIn || cat.place.name !== 'room' || inWay(cat.pos.x, cat.pos.z, 0.5) || inWay(player.pos.x, player.pos.y, 0.35) || cat.air) return; // (her: tail and all)
  bathLeft.armed = false;
  if (bathLeft.byHand) { bathLeft.byHand = false; D.turn(false); return; } // (you went to shut it: shut as a hand shuts it)
  D.state.open = false;
  D.state.target = 0;
  D.state.slam = true;
  D.onSlam = () => sound.sample('door-slam', bathLeft.hinge.set(S.ax, 1, S.az)); // silent until there is a recording
}
// Nor can you shut it yourself, in there, till she is in too (user, 2026-11-02). And with water in the room (once it
// is up to the ceiling), opening it first sends all the water back where it came from — off the floor into the bath
// and down its plug hole, the plug in as it is — in 8 s (bath.js drain), and the taps go off; only then does it open.
// The taps only turn on with her in here and the door shut.
house.bath.mayOpen = () => cat.place.name === 'room' && house.roomAt(cat.pos.x, cat.pos.z) === 'bath' && !house.bathDoor.state.open && house.bathDoor.state.angle < 0.01;
house.bathDoor.before = (opening) => {
  const B = house.bath;
  if (B.draining) return true; // (it is going: wait)
  if (!opening) {
    const here = house.roomAt(player.pos.x, player.pos.y) === 'bath', lunaIn = lunaInBath();
    if (here) return bathShut.armed && !lunaIn ? "It won't budge." : null;
    // shutting it from outside with her still in there (or on her way in): she comes out to you first, then it shuts
    // (bathDoorAfter) — never on her
    if (lunaIn) { bathLeft.armed = bathLeft.byHand = true; return true; }
    return null;
  }
  // and once the taps are on, it won't open at all till the water is up to the ceiling (user, 2026-11-02)
  if ((B.state.hot || B.state.cold) && !B.atCeiling) return "It won't budge.";
  if (B.state.spread <= 0 && B.flood <= 0.002) return null;
  B.drain(8, () => house.bathDoor.turn(true));
  return true;
};

// your own breath, under water: now and then a few bubbles out in front of your face, rising past
const yourBubbles = bubbles(house.scene, 16, () => house.bath.flood);
const yourBreath = { next: 2, puff: 0, gap: 0, at: new THREE.Vector3(), fwd: new THREE.Vector3() };
function breatheOut(dt) {
  const B = yourBreath, under = house.bath.under(camera.position);
  if (under && (B.next -= dt) <= 0) { B.next = 3 + Math.random() * 4; B.puff = 3 + Math.floor(Math.random() * 4); }
  if (under && B.puff > 0 && (B.gap -= dt) <= 0) {
    camera.getWorldDirection(B.fwd);
    B.at.copy(camera.position).addScaledVector(B.fwd, 0.3).add(new THREE.Vector3((Math.random() - 0.5) * 0.03, -0.14, (Math.random() - 0.5) * 0.03)); // far enough off to be seen going up
    yourBubbles.emit(B.at, 0.006 + Math.random() * 0.01);
    B.puff--;
    B.gap = 0.06 + Math.random() * 0.1;
  }
  yourBubbles.update(dt);
}

function lunaFollows(dt) {
  if (cat.place.name === world) {
    followIn = 2 + Math.random() * 2.5;
    if (cat.following && !cat.committed) cat.queue = []; // you came back before she had gone
    return;
  }
  if (cat.following || cat.committed || warp.to || (followIn -= dt) > 0) return;
  followIn = 4; // should she give up on the way, she tries again
  const dest = world, way = WAYS[dest];
  cat.follow({
    off: way.off,
    to: way.to,
    then: () => {
      cat.arrive(dest, way.out, way.land);
      lunaLooksFor();
      ctx.touch(); // her shadow has left the bedroom, or come back to it
    },
  });
}
const fadeEl = $('fade');
const ears = new THREE.PerspectiveCamera(); // where you are still heard from while in the game: in front of the set
const warp = { to: null, t: 0, clearing: 0, from: new THREE.Vector3(), look: new THREE.Quaternion() };
const _dir = new THREE.Vector3();

/** Close to the glass and looking at it: a jump from here goes through. */
function atScreen() {
  if (player.seat || !player.enabled) return false;
  if (world === 'zelpa') {
    const h = zelpa.hole, back = h.z - player.pos.y;
    return back < 1.4 && Math.abs(player.pos.x - h.x) < 0.6 && player.feet < 0.3 && camera.getWorldDirection(_dir).z > 0.6;
  }
  if (!ctx.tv.on) return false;
  const s = ctx.tv.screen, dx = player.pos.x - s.x, dz = player.pos.y - s.z;
  return dx > 0.1 && dx < 1.3 && Math.abs(dz) < 0.5 && camera.getWorldDirection(_dir).x < -0.6;
}

function startWarp(to) {
  if (warp.to) return;
  Object.assign(warp, { to, t: 0 });
  warp.from.copy(camera.position);
  warp.look.copy(camera.quaternion);
  if (to === 'zelpa') {
    ears.position.copy(camera.position);
    ears.quaternion.copy(camera.quaternion);
    ears.updateMatrixWorld(true);
  }
}
zelpa.onLeave = () => startWarp('room');
zelpa.onSay = (line) => say(line);
let tvOnFor = 0; // seconds the set has been on: the title screen for the first five, then the game itself
const TITLE_FOR = 5;

function setWorld(name) {
  world = name;
  const inGame = name === 'zelpa';
  player.colliders = inGame ? zelpa.colliders : ctx.colliders;
  player.bounds = inGame ? zelpa.bounds : ROOM_BOUNDS;
  player.floor = inGame ? 'earth' : 'carpet';
  player.ladders = inGame ? zelpa.ladders : ctx.ladders;
  player.setStature(...HEIGHT[name]);
  interactables = inGame ? zelpa.interact : ctx.interact;
  if (inGame) player.setPose(zelpa.spawn.x, zelpa.spawn.z, zelpa.spawn.yaw, zelpa.spawn.pitch);
  else player.setPose(1.35, ctx.tv.screen.z, -90, -4); // out of the glass and onto the carpet, the room in front of you
  lunaLooksFor();
  if (inGame) zelpa.lookOut(renderer, [scene, house.scene], true);
  focus = null;
  promptEl.hidden = true;
  nearScreen = atLadder = false;
  showHint();
  shadowsDirty = 3;
}

function stepWarp(dt) {
  if (warp.to) {
    warp.t += dt;
    const p = Math.min(warp.t / WARP, 1);
    // head first at the glass
    camera.position.lerpVectors(warp.from, warp.to === 'zelpa' ? ctx.tv.screen : HOLE_AT, p * p);
    camera.quaternion.slerpQuaternions(warp.look, warp.to === 'zelpa' ? INTO_SCREEN : OUT_OF_GAME, Math.min(1, p * 1.6));
    fadeEl.style.opacity = p * p;
    if (p < 1) return;
    setWorld(warp.to);
    Object.assign(warp, { to: null, clearing: CLEAR });
  } else if (warp.clearing > 0) {
    warp.clearing = Math.max(0, warp.clearing - dt);
    fadeEl.style.opacity = (warp.clearing / CLEAR) ** 2;
  }
}

// ---------------------------------------------------------------- loop

const STAR_GLOW = 2.0;
const clock = new THREE.Clock();
let frame = 0;
let sunOwed = true, glowOwed = true; // the bedroom's two shadows, wanting drawing as soon as it can be seen
let calm = 0, glowWait = 0; // seconds since anything in the bedroom changed; since its glow's shadow was last drawn

/**
 * Whether anything of the bedroom can be seen: from in it, always; from anywhere else only through its door and its
 * window (the outsides of its walls are the house's), so not with neither of them in view. From the kitchen it was
 * drawn whole behind the corridor's walls every frame, for nothing.
 */
const OPENINGS = [
  // (the door's reaching out into the corridor: Luna, lying in the doorway, is the bedroom's)
  new THREE.Box3(new THREE.Vector3(ROOM.door.x0 - 0.4, 0, ROOM.D - 0.1), new THREE.Vector3(ROOM.door.x1 + 0.4, ROOM.door.h + 0.15, ROOM.D + ROOM.T + 0.6)),
  new THREE.Box3(new THREE.Vector3(ROOM.win.x0 - 0.15, ROOM.win.y0 - 0.15, -ROOM.T - 0.1), new THREE.Vector3(ROOM.win.x1 + 0.15, ROOM.win.y1 + 0.15, 0.1)),
];
const inView = new THREE.Frustum(), viewProj = new THREE.Matrix4();
function bedroomSeen() {
  const p = camera.position, T = ROOM.T + 0.1;
  if (p.x > -T && p.x < ROOM.W + T && p.z > -T && p.z < ROOM.D + T && p.y > -0.5 && p.y < ROOM.H + 0.5) return true;
  if (ROOMS[1].inside(p) && house.bathDoor.state.angle <= 0.003) return false; // (from the bathroom, its door shut: none of it — it was drawn behind the walls, user, 2026-11-03)
  camera.updateMatrixWorld();
  inView.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  return OPENINGS.some((b) => inView.intersectsBox(b));
}

/**
 * And the other way round: what no straight line from the eye can reach is left out of the picture. The house is rooms
 * (the bedroom, the bathroom, the corridor, the kitchen and living room) and the gaps between them and out of doors
 * (`GAPS`: doorways, windows, the corridor's open end, the attic's hatch). Two rules:
 *  - from inside a room, the rest of the house and the yard can only be seen through that room's gaps out: what lies
 *    outside them all, as seen from the eye, is left out (from the bedroom: the porch, most of the trees, the kitchen
 *    and Mum — two million triangles drawn behind the walls);
 *  - what stands wholly inside another room can only be seen through that room's gaps in, wherever the eye is (from
 *    the lawn, looking at the house, every room's furniture was drawn behind its walls: ~1,300 of the frame's 2,400
 *    draws — players, 2026-11-09: "it lags").
 * A door that is shut is no way through (the bedroom's, the bathroom's: plain leaves; the back door is glazed, so it
 * always is one). Both scenes, the bedroom's too. Not out of the shadows: shown again before they are drawn
 * (`renderer.shadowMap.render`, below). Only meshes with nothing hung on them, and not ones three is told never to
 * leave out (they move about in ways their bounds don't follow). A new opening in a wall goes in `GAPS` and in the
 * `ROOMS` it joins, or what is seen through it disappears. `?seeall`: nothing is left out (for comparing against).
 */
const BATH = house.bathroom, BATH_H = 2.05, OPEN = house.openings, HALL = OPEN.corridor, LIV = OPEN.living;
/** A gap in a wall, by its four corners (a little wider than the hole: its frame); `open()`: whether the eye gets through it now. */
const gap = (pts, open = null) => {
  const q = pts.map((p) => new THREE.Vector3(...p)), mid = q.reduce((m, p) => m.addScaledVector(p, 0.25), new THREE.Vector3());
  for (const p of q) p.add(p.clone().sub(mid).normalize().multiplyScalar(0.1));
  return { q, mid, reach: q[0].distanceTo(mid) + 0.5, open, planes: Array.from({ length: 5 }, () => new THREE.Plane()), on: true, near: 0, by: false };
};
const acrossZ = (z, x0, x1, y0, y1, open) => gap([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], open);
const acrossX = (x, z0, z1, y0, y1, open) => gap([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], open);
const GAPS = {
  window: acrossZ(0, ROOM.win.x0, ROOM.win.x1, ROOM.win.y0, ROOM.win.y1),
  door: acrossZ(ROOM.D, ROOM.door.x0, ROOM.door.x1, 0, ROOM.door.h, () => Math.abs(door.state.angle) > 0.003),
  bath: acrossZ(BATH.z0, BATH.door.x0, BATH.door.x1, 0, BATH_H, () => Math.abs(house.bathDoor.state.angle) > 0.003),
  hallEnd: acrossX(HALL.x0, HALL.z0, HALL.z1, 0, ROOM.H), // (the corridor runs straight into the living room: no wall, no door)
  hatch: gap([[OPEN.hatch.x0, ROOM.H, OPEN.hatch.z0], [OPEN.hatch.x1, ROOM.H, OPEN.hatch.z0], [OPEN.hatch.x1, ROOM.H, OPEN.hatch.z1], [OPEN.hatch.x0, ROOM.H, OPEN.hatch.z1]]),
  kitchenWin: acrossZ(0, OPEN.kitchenWin.x0, OPEN.kitchenWin.x1, OPEN.kitchenWin.y0, OPEN.kitchenWin.y1),
  back: acrossZ(0, OPEN.back.x0, OPEN.back.x1, 0, OPEN.doorH), // (glazed: seen through shut as well)
  front: acrossX(LIV.x0, OPEN.front.z0, OPEN.front.z1, 0, OPEN.doorH),
  livingWin: acrossX(LIV.x0, OPEN.livingWin.z0, OPEN.livingWin.z1, OPEN.livingWin.y0, OPEN.livingWin.y1),
  cellar: gap(house.cellar.mouth), // (the storm doors' opening in the lawn: the only way to see down into the basement)
};
const EVERY_GAP = Object.values(GAPS);
/**
 * A room by its inside faces: `inside(eye)`; `around`: what is in the room itself, its glass (never left out from in
 * it); `within`: what stands wholly in it (against its walls, on its floor, under its ceiling); its `gaps` in and out.
 */
const room = (x0, x1, z0, z1, gaps, floor = 0) => ({
  inside: (e) => e.x > x0 + 0.05 && e.x < x1 - 0.05 && e.z > z0 + 0.05 && e.z < z1 - 0.05 && e.y > floor && e.y < ROOM.H,
  around: new THREE.Box3(new THREE.Vector3(x0 - 0.3, -1, z0 - 0.3), new THREE.Vector3(x1 + 0.3, ROOM.H + 0.6, z1 + 0.3)),
  within: new THREE.Box3(new THREE.Vector3(x0 - 0.03, -0.03, z0 - 0.03), new THREE.Vector3(x1 + 0.03, ROOM.H + 0.03, z1 + 0.03)),
  gaps,
});
// (the bathroom's door the only way into it, and only while it stands open — user, 2026-11-03: "is anything out of
// sight weighing on the game while the water runs?": door shut, the house and the yard behind its walls, 2,600 draws
// and 8 million triangles a frame, for nothing)
const ROOMS = [
  room(0, ROOM.W, 0, ROOM.D, [GAPS.window, GAPS.door]),
  room(BATH.x0, BATH.x1, BATH.z0, BATH.z1, [GAPS.bath], -0.5),
  room(HALL.x0, HALL.x1, HALL.z0, HALL.z1, [GAPS.door, GAPS.bath, GAPS.hallEnd, GAPS.hatch]),
  room(LIV.x0, LIV.x1, LIV.z0, LIV.z1, [GAPS.hallEnd, GAPS.kitchenWin, GAPS.back, GAPS.front, GAPS.livingWin]),
];
// and the basement, a scene of its own: from above ground, what of it lies under the ground is seen only down through
// its doors' opening (from the lawn all of it was drawn, 130 draws, for the dark between the doors' boards)
const UNDERGROUND = [{ within: new THREE.Box3(new THREE.Vector3(-Infinity, -Infinity, -Infinity), new THREE.Vector3(Infinity, house.cellar.mouth[0][1] + 0.03, Infinity)), gaps: [GAPS.cellar] }];
const unseen = { list: [], room: [], cellar: [], at: -1000, off: [], aimed: -1, all: params.has('seeall') }, ball = new THREE.Sphere();
/** Each gap as seen from the eye: its four sides and its own face, the far side of it the side that counts. */
function aim(eye) {
  if (unseen.aimed === frame) return;
  unseen.aimed = frame;
  for (const w of EVERY_GAP) {
    w.on = !w.open || w.open();
    if (!w.on) continue;
    const q = w.q, planes = w.planes;
    for (let i = 0; i < 4; i++) {
      planes[i].setFromCoplanarPoints(eye, q[i], q[(i + 1) % 4]);
      if (planes[i].distanceToPoint(w.mid) < 0) planes[i].negate();
    }
    planes[4].setFromCoplanarPoints(q[0], q[1], q[2]);
    const d = planes[4].distanceToPoint(eye);
    if (d > 0) planes[4].negate();
    // (the eye in the gap itself, in the thickness of the wall: it has no sides then, everything either side of it may
    // be seen — near its face and by it, not just anywhere along the line of that wall)
    w.near = Math.abs(d);
    w.by = eye.distanceTo(w.mid) < w.reach;
  }
}
/** Whether any of `gaps` lets the eye reach the ball `s`; within `near` of a gap's own face and by it, the eye is taken to be in it. */
function seenThrough(gaps, s, near) {
  for (let k = 0; k < gaps.length; k++) {
    const w = gaps[k];
    if (!w.on) continue;
    if (w.by && w.near < near) return true;
    const p = w.planes, c = s.center, r = -s.radius;
    if (p[0].distanceToPoint(c) >= r && p[1].distanceToPoint(c) >= r && p[2].distanceToPoint(c) >= r && p[3].distanceToPoint(c) >= r && p[4].distanceToPoint(c) >= r) return true;
  }
  return false;
}
/**
 * A mesh's bounds in the world, a little more, and the room it stands wholly in (or none): worked out again only when
 * it has moved (a crowd of copies, or one with bones — Mum, Luna: bounds of their own, looked at every time).
 */
const kept = new WeakMap(), KEY = [0, 1, 2, 5, 6, 10, 12, 13, 14], wide = new THREE.Box3();
function where(o, rooms) {
  let k = kept.get(o);
  if (!k) kept.set(o, (k = { ball: new THREE.Sphere(), room: null, key: new Float64Array(KEY.length).fill(NaN), geo: null, r: -1 }));
  const e = o.matrixWorld.elements, own = o.isInstancedMesh || o.isSkinnedMesh, from = own ? o : o.geometry;
  if (from.boundingSphere === null) from.computeBoundingSphere();
  let same = !own && k.geo === o.geometry && k.r === from.boundingSphere.radius;
  for (let i = 0; same && i < KEY.length; i++) same = k.key[i] === e[KEY[i]];
  if (same) return k;
  for (let i = 0; i < KEY.length; i++) k.key[i] = e[KEY[i]];
  k.geo = o.geometry;
  k.r = from.boundingSphere.radius;
  k.ball.copy(from.boundingSphere).applyMatrix4(o.matrixWorld);
  const c = k.ball.center;
  if (o.isSkinnedMesh) {
    // (her ball is far bigger than she is: in a room if its middle is well inside it — she stands on its floor)
    k.room = rooms.find((r) => c.x > r.within.min.x + 0.25 && c.x < r.within.max.x - 0.25 && c.z > r.within.min.z + 0.25 && c.z < r.within.max.z - 0.25) ?? null;
  } else {
    if (own) wide.min.copy(c).addScalar(-k.ball.radius), wide.max.copy(c).addScalar(k.ball.radius);
    else {
      if (o.geometry.boundingBox === null) o.geometry.computeBoundingBox();
      wide.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    }
    k.room = rooms.find((r) => r.within.containsBox(wide)) ?? null;
  }
  k.ball.radius += 0.25; // (anything moving may have gone a little further since its matrix was last worked out)
  return k;
}
/** Leaves out of `which` scene's picture ('list': the house and the yard; 'room': the bedroom; 'cellar': the basement) what the eye can't reach. */
function hideUnseen(which) {
  if (unseen.all) return;
  const eye = camera.position, here = ROOMS.find((r) => r.inside(eye)) ?? null;
  if (which === 'room' && here === ROOMS[0]) return; // (in the bedroom: all of it)
  if (which === 'cellar' && house.cellar.below(eye)) return; // (down in it: all of it)
  listUnseen();
  aim(eye);
  const list = unseen[which], rooms = which === 'cellar' ? UNDERGROUND : ROOMS;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (!o.visible) continue;
    const k = where(o, rooms), s = k.ball;
    if ((here && !here.around.intersectsSphere(s) && !seenThrough(here.gaps, s, 0.02)) || (k.room && k.room !== here && !seenThrough(k.room.gaps, s, 0.25))) {
      o.visible = false;
      unseen.off.push(o);
    }
  }
}
/** What there is to leave out, looked over every few seconds (Mum came after the house). */
function listUnseen() {
  if (frame - unseen.at <= 120) return;
  unseen.at = frame;
  unseen.list.length = unseen.room.length = unseen.cellar.length = 0;
  house.scene.traverse((o) => { if (o.isMesh && o.frustumCulled && !o.children.length) unseen.list.push(o); });
  scene.traverse((o) => { if (o.isMesh && o.frustumCulled && !o.children.length) unseen.room.push(o); });
  house.cellar.scene.traverse((o) => { if (o.isMesh && o.frustumCulled && !o.children.length) unseen.cellar.push(o); });
}
/** Its bounds in the world, a little more (`ball`). */
function boundsOf(o) {
  if (o.isInstancedMesh || o.isSkinnedMesh) {
    if (o.boundingSphere === null) o.computeBoundingSphere();
    ball.copy(o.boundingSphere);
  } else {
    if (o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere();
    ball.copy(o.geometry.boundingSphere);
  }
  ball.applyMatrix4(o.matrixWorld);
  ball.radius += 0.25;
  return ball;
}
/**
 * The bathroom's water mirrors the bathroom, and with its door open the corridor: nothing else of the house can be in
 * it, so the rest is left out of the reflection (with the water up, it had drawn the house and the yard behind the
 * walls once more every frame — the angel, the trees, the porch, Mum: 4 million triangles; user, 2026-11-03). Returns
 * what it hid, to be shown again.
 */
const CORRIDOR_AROUND = new THREE.Box3(new THREE.Vector3(-0.5, -1, ROOM.D - 0.3), new THREE.Vector3(11.5, ROOM.H + 0.6, BATH.z0 + 0.3));
function hideForReflection() {
  const off = [];
  if (!ROOMS[1].inside(camera.position)) return off;
  listUnseen();
  const keep = house.bathDoor.state.angle > 0.003 ? [ROOMS[1].around, CORRIDOR_AROUND] : [ROOMS[1].around];
  for (const o of unseen.list) {
    if (!o.visible) continue;
    const b = boundsOf(o);
    if (keep.some((k) => k.intersectsSphere(b))) continue;
    o.visible = false;
    off.push(o);
  }
  return off;
}
function showUnseen() {
  for (const o of unseen.off) {
    o.visible = true;
    o.skeleton?.update(); // (Mum's bones, left as they were while she wasn't looked at: her shadow is drawn from them)
  }
  unseen.off.length = 0;
}
{
  const draw = renderer.shadowMap.render;
  renderer.shadowMap.render = function (...args) {
    showUnseen();
    return draw.apply(this, args);
  };
}

function animate(obj, dt, rate, apply) {
  const d = obj.target - (obj.tilt ?? obj.angle);
  if (Math.abs(d) < 1e-4) return;
  const step = d * (1 - Math.exp(-dt * rate));
  if ('tilt' in obj) obj.tilt += step; else obj.angle += step;
  apply();
  shadowsDirty = 2;
}

// Wading or swimming in the bathroom's water: rings run out from you as you move (water.js)
let wadeFeet = 0, wadeVy = 0, wadeAir = false;
function wade(dt) {
  const B = house.bath, x = player.pos.x, z = player.pos.y, speed = player.vel.length(), level = B.state.flood;
  const feet = player.feet, was = [wadeFeet, wadeVy, wadeAir];
  [wadeFeet, wadeVy, wadeAir] = [feet, player.vy, !player.grounded];
  if (world !== 'room' || level < 0.02 || !B.wet(x, z)) return;
  // (user, 2026-10-17: the water round you as you move or jump) the water at your body, pushed where you
  // are every moment you move through it — a wake, of itself (water.js RippleSim)
  const inIt = level > feet + 0.01 && level < feet + player.eye + 0.2;
  if (inIt && speed > 0.05) B.disturb(x, z, Math.min(1.3, speed * 0.6) * dt * 8, 0.065);
  // coming down into it from above: a splash, as hard as you came; landing on the bottom under it, a smaller one
  if (was[0] > level + 0.005 && feet <= level + 0.005 && was[1] < -0.8) B.disturb(x, z, Math.min(3, -was[1] * 0.7), 0.16);
  else if (was[2] && player.grounded && inIt && was[1] < -0.8) B.disturb(x, z, Math.min(2.5, -was[1] * 0.9), 0.14);
}

// ---------------------------------------------------------------- how sharp the picture is drawn
// As sharp as ever (up to 1.5 screen pixels a pixel) while the frames come quickly enough; when they don't, a step less
// sharp at a time, and only as long as that helps: where the time goes on the scene's shapes rather than on its pixels a
// softer picture buys nothing, and it goes back (2026-11-05: on players' machines the game lagged). Never in ?shot.
const SHARP = Math.min(devicePixelRatio, 1.5);
const sharp = { scale: SHARP, low: Math.min(SHARP, 0.6), times: [], last: 0, tried: null, hold: 0, from: Infinity };
function sharpen(now) {
  if (SHOT || document.hidden || (rehearsed.left && !rehearsed.playing)) return void (sharp.last = 0); // (nor while the rehearsal runs flat out behind the start window: its frames are not the machine's)
  if (sharp.from === Infinity) sharp.from = now + 4000; // (not the first seconds: every shadow being drawn)
  if (sharp.last) sharp.times.push(now - sharp.last);
  sharp.last = now;
  if (sharp.times.length < 45) return;
  const ms = sharp.times.sort((a, b) => a - b)[22]; // (the middle one: a hitch now and then is not the machine)
  sharp.times.length = 0;
  if (now < sharp.from) return;
  let to = sharp.scale;
  if (sharp.tried) { // the last step down: did it help?
    if (ms > sharp.tried.ms * 0.92) { to = sharp.tried.scale; sharp.hold = now + 45000; }
    sharp.tried = null;
  } else if (ms > 34 && sharp.scale > sharp.low && now > sharp.hold) {
    sharp.tried = { scale: sharp.scale, ms };
    to = Math.max(sharp.low, sharp.scale * 0.85);
  } else if (ms < 21 && sharp.scale < SHARP) to = Math.min(SHARP, sharp.scale * 1.12);
  if (to !== sharp.scale) {
    sharp.scale = to;
    renderer.setPixelRatio(to);
    resize();
  }
}

function tick() {
  sharpen(performance.now());
  if (frame % 30 === 0) keepProgramArrays(); // (any compiled since)
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  frame++;

  player.update(dt);
  if (rehearsed.left) stillFor(dt);
  swimFor = player.swimming ? swimFor + dt : 0; // (the swim keys: shown for its first seconds)
  if (!warp.to && !player.grounded && player.vy > 0.5 && atScreen()) startWarp(world === 'room' ? 'zelpa' : 'room');
  stepWarp(dt);
  const inGame = world === 'zelpa'; // the bedroom carries on without you: it can be seen from in there
  if (blind.step(dt)) shadowsDirty = 2;
  animate(door.state, dt, 5, door.apply);

  // the ceiling stars only show once the blind has shut the daylight out
  const dark = THREE.MathUtils.smoothstep(blind.state.tilt, deg(48), deg(70));
  const starMat = ctx.stars.material;
  starMat.emissiveIntensity += (dark * STAR_GLOW - starMat.emissiveIntensity) * (1 - Math.exp(-dt * 2.2));
  // and the room goes dark with it (user, 2026-10-28: "when you close the blinds it gets quite dark"; the slats only
  // stopped the sun): the blind's own glow, the sun's patch thrown back off the bed and the daylight filling the room,
  // all but what gets round its edges; and the corridor gets that little through the door
  const shut = THREE.MathUtils.smoothstep(blind.state.tilt, deg(36), deg(76)) * (0.45 + 0.55 * blind.state.drop);
  lights.glow.intensity = DAY.glow.intensity * (1 - 0.92 * shut);
  lights.bounce.intensity = DAY.bounce.intensity * (1 - 0.95 * shut);
  lights.hemi.intensity = DAY.hemi.room * (1 - 0.62 * shut);
  M.slat.emissiveIntensity = SLAT_GLOW * (1 - 0.7 * shut); // (the slats shut flat, less of the day comes through them: a bright white panel, it was)
  // and what the room reflects (buildEnvironment: a hot window in it) goes dark with the window: shut, it still lit
  // the wall facing the window flat and bright, and glinted on the bear and the pillows (user, 2026-10-28)
  scene.environmentIntensity = ROOM_ENV * (1 - 0.8 * shut);

  for (const step of ctx.animated) step(t, dt);
  desktop.update(dt);
  lights.pc.userData.base = 0.5 * desktop.glow; // the monitor lights the desk only as much as its picture does
  if (!inGame) player.floor = house.floorAt(player.pos.x, player.pos.y, player.feet);
  house.update(dt, t, camera.position, THREE.MathUtils.clamp(door.state.angle / deg(108), 0, 1), 1 - 0.85 * shut);
  underEl.hidden = !(world === 'room' && house.bath.under(camera.position)); // your head under the water in the bathroom
  if (!underEl.hidden) underEl.style.filter = `brightness(${Math.max(0.06, house.bath.volume.light()).toFixed(3)})`; // as dark as the room is
  house.bath.volume.update(camera.position); // and from above it, what is under it seen through it
  if (frame % 60 === 0) house.bath.volume.patch(house.scene); // Luna, her boat and the like, as they come
  const underground = !inGame && house.cellar.below(camera.position);
  sound.setOutside(1 - dark, inGame || underground ? 0 : house.outdoors(camera.position), inGame ? 'bedroom' : underground ? 'cellar' : house.roomAt(camera.position.x, camera.position.z) ?? 'bedroom'); // (the room you are in: through which walls the street reaches you)
  sound.update(dt, inGame ? ears : camera);

  // CRTs never sit perfectly still
  lights.tv.intensity = lights.tv.userData.base * (0.92 + 0.08 * Math.sin(t * 37) * Math.sin(t * 5.3));
  lights.pc.intensity = lights.pc.userData.base * (0.97 + 0.03 * Math.sin(t * 61));

  if (frame % 4 === 0) {
    updateFocus();
    const near = atScreen(), rungs = player.grounded && !!player.ladderHere(), swim = player.swimming && swimFor < 6;
    const ride = !!player.ride, held = player.holding?.hint() ?? '';
    if (near !== nearScreen || rungs !== atLadder || swim !== swimHint || ride !== rideHint || held !== heldHint) {
      nearScreen = near;
      atLadder = rungs;
      swimHint = swim;
      rideHint = ride;
      heldHint = held;
      showHint();
    }
  }
  if (sayTimer > 0 && (sayTimer -= dt) <= 0) sayEl.hidden = true;
  inventory.update(dt, !inGame && !player.seat, player.bobT, Math.min(player.vel.length() / 1.7, 1.4)); // nothing in your hand in the TV's game, or at the PC
  // what you hold is lit by the lamps of where you are; the UV torch in your hand is on
  const youInBedroom = camera.position.x > 0 && camera.position.x < ROOM.W && camera.position.z > 0 && camera.position.z < ROOM.D && camera.position.y > 0;
  inventory.place(underground ? house.cellar.scene : youInBedroom ? scene : house.scene);
  const lens = inventory.held === UV_TORCH ? inventory.point('lens', lensAt) : null;
  // the torch from by the cellar: held, on — its own beam down in the basement, the rooms' torch light up here
  const torchLit = inventory.held === TORCH && !inGame ? inventory.point('lens', torchAt) : null;
  house.cellar.torch(torchLit, camera.getWorldDirection(torchDir));
  uv.update(!!lens, !!torchLit);
  house.torch.userData.leds.emissiveIntensity = lens ? 1.3 : 0;

  lunaFollows(dt);
  bathDoorBehind(dt);
  bathDoorAfter();
  breatheOut(dt);
  wade(dt);
  const catMoved = cat.update(dt, t);
  boat.update(dt, t, cat.player);
  // out of the bedroom she is lit by the house's lamps, not the bedroom's: she belongs to whichever she is in
  if (cat.place.name === 'room') {
    const inBedroom = cat.pos.x > 0 && cat.pos.x < ROOM.W && cat.pos.z > 0 && cat.pos.z < ROOM.D;
    const home = inBedroom ? scene : house.scene;
    if (cat.root.parent !== home) {
      home.add(cat.root);
      ctx.touch();
    }
  }
  // (in the bathroom her eyes stay as they were: right there — user, 2026-10-18); and in the bedroom with the blind
  // shut, the slats keep the sun off her eyes as off everything else, and their own faint light goes with the room's
  // (user, 2026-10-29: in the dark they caught the light)
  cat.housed(cat.root.parent === house.scene ? house.roomAt(cat.pos.x, cat.pos.z) !== 'bath' : cat.root.parent === scene && shut > 0.3);
  cat.eyeLight(cat.root.parent === scene ? 1 - 0.9 * shut : 1);
  // Luna out of sight behind the walls is not drawn: her fur, shell over shell, was a third of every frame
  // looking at the house from the yard, she indoors and nowhere to be seen (user, 2026-10-18: "the swing lags")
  if (frame % 3 === 0) cat.root.visible = catInSight();
  // (the bedroom out of sight: not drawn, and its shadows wait for it to come back into view)
  const bedroomInView = inGame || bedroomSeen();
  const sunTurn = bedroomInView && (sunOwed || (shadowsDirty > 0 && frame % 2 === 0));
  const moving = stirring > 0;
  if (moving && (stirring -= dt) <= 0) shadowsDirty = 3;
  // The window-glow's shadow follows whatever moves in the bedroom — Luna only while she is in it: walking about the
  // living room she "moved", and it was drawn again every frame, the whole bedroom, ~500 draws, nothing in it changed
  // (players, 2026-11-09: "it lags") — and is looked at again every 8th frame for a few seconds after anything has
  // changed, then every few seconds (in case something moved unannounced): not 7 times a second for good.
  const stirred = (catMoved && cat.root.parent === scene) || moving;
  calm = stirred || shadowsDirty > 0 || sunOwed ? 0 : calm + dt;
  glowWait += dt;
  if (stirred || (calm < 3 ? frame % 8 === 0 : glowWait >= 4)) glowOwed = true;
  const glowTurn = bedroomInView && (sunOwed || (!sunTurn && glowOwed));
  if (glowTurn) { glowOwed = false; glowWait = 0; }
  if (sunTurn) {
    shadowsDirty--;
    sunOwed = false;
  }
  cat.castShadows(!sunTurn && cat.root.parent !== house.scene); // the house's shadows are drawn once and kept: she mustn't be in them
  lights.sun.shadow.needsUpdate = sunTurn;
  lights.glow.shadow.needsUpdate = glowTurn;
  roomShadowsDue = sunTurn || glowTurn;
  grade.uniforms.uTime.value = t;
  tvOnFor = ctx.tv.on ? tvOnFor + dt : 0;
  const tvPlays = tvOnFor > TITLE_FOR;
  ctx.tv.show(tvPlays ? zelpa.screen : null);
  const who = { you: inGame ? player : null, camera, luna: cat.place.name === 'zelpa' ? cat.pos : null };
  if (inGame) {
    zelpa.lookOut(renderer, [scene, house.scene]); // the bedroom, as seen through the glass from the other side
    zelpa.update(t, dt, who);
    zelpa.render(renderer, camera);
  } else {
    if (tvPlays) {
      // the game goes on without you, and the set shows it
      zelpa.update(t, dt, who);
      zelpa.drawTv(renderer, who);
    }
    house.bath.simulate(renderer, dt); // its ripples, stepped on
    const notInIt = hideForReflection();
    house.bath.reflect(renderer, house.scene, camera, [inventory.hand]); // the bathroom's water, mirroring the room
    for (const o of notInIt) o.visible = true;
    const view = house.cellar.passes(camera);
    roomPass.enabled = view.above && bedroomInView;
    housePass.enabled = view.above;
    cellarPass.enabled = view.below;
    composer.render(dt);
    inventory.draw();
  }
  requestAnimationFrame(tick);
}

/**
 * Three sends a material's arrays of numbers to the GPU again every time it switches to that material, changed or not —
 * the lamps' shadow matrices, `uDry` — ~2000 times a frame looking at the house from the yard: 60 % of the frame on the
 * M2 (2026-11-05, players' complaints of lag). Each program now keeps what it was last sent and is sent only what has
 * changed, as three does already for single values. (A program's uniforms keep their values on the GPU between draws.)
 */
const ARRAY_SETTERS = { setValueM4Array: 16, setValueV4fArray: 4, setValueV3fArray: 3, setValueV2fArray: 2, setValueV1fArray: 1 };
const keptPrograms = new WeakSet();
function keepArrays(u) {
  const send = u.setValue, k = ARRAY_SETTERS[send.name], n = u.size * k, sent = new Float32Array(n), now = new Float32Array(n);
  let primed = false;
  u.unkept = send; // (to measure against)
  u.setValue = function (gl, v, textures) {
    if (typeof v[0] === 'number') for (let i = 0, m = Math.min(n, v.length); i < m; i++) now[i] = v[i];
    else for (let i = 0, m = Math.min(u.size, v.length); i < m; i++) v[i].toArray(now, i * k);
    if (primed) {
      let i = 0;
      while (i < n && sent[i] === now[i]) i++;
      if (i === n) return;
    }
    send.call(this, gl, v, textures);
    sent.set(now);
    primed = true;
  };
}
function keepProgramArrays() {
  const walk = (seq) => { for (const u of seq) if (u.seq) walk(u.seq); else if (u.size && ARRAY_SETTERS[u.setValue.name]) keepArrays(u); };
  for (const p of renderer.info.programs) {
    if (keptPrograms.has(p) || !p.isReady()) continue; // (not yet compiled: asking for its uniforms would wait for it)
    keptPrograms.add(p);
    walk(p.getUniforms().seq);
  }
}

/**
 * Every shader the game draws with, compiled before the first frame and side by side, while the loading line shows
 * (2026-11-05, players' complaints: compiled one by one as each thing first came into view, the first frames held the
 * page ~10 s on an M2 and far longer elsewhere). As they are drawn: into the shared picture (no tone mapping: the grade
 * pass does it), each scene with its own lamps; Luna also as she will be in the house and in the TV's game.
 */
/** Has the graphics card make the shaders of every world (what is made already is found made); resolves when all are ready. */
function beginShaders() {
  renderer.setRenderTarget(picture.rt);
  const jobs = [[scene], [house.scene], [house.cellar.scene], [zelpa.scene], [cat.root, house.scene], [cat.root, zelpa.scene]];
  if (REHEARSE) {
    planesLeft(0); // (`compile` makes a shader for as many cutting planes as the last thing drawn had: none)
    jobs.splice(4, 1); // (Luna in the house: below, as she is really drawn there)
  }
  const begun = jobs.map(([what, lit]) => renderer.compileAsync(what, camera, lit ?? null));
  if (REHEARSE) {
    const sim = house.bath.look.sim; // the ripples' own shader (water.js RippleSim: on nothing in any world), made as the taps were opened
    begun.push(renderer.compileAsync(sim.scene, sim.cam));
    const L = lunaParts(), bare = L.paws.map((p) => p.material);
    begun.push(...beginCut(L.plain, scene), ...beginCut(L.all, house.scene));
    L.paws.forEach((p, i) => { p.material = boat.gear.paws[i]; }); // (her suit's paws: on her only while it is)
    begun.push(...beginCut(L.paws, house.scene));
    L.paws.forEach((p, i) => { p.material = bare[i]; });
  }
  const ready = Promise.all(begun);
  renderer.setRenderTarget(null);
  return ready;
}
async function prepareShaders() {
  await breathe(0.9);
  await beginShaders(); // (again: those of what came since — Mum, the angel — and the wait for them all)
  // and what three asks of each the first time it is used (its log, its uniforms: questions the page waits on the GPU
  // to answer — asked during the first frame, behind every shadow map, they held it ~2 s)
  const programs = renderer.info.programs;
  for (let i = 0; i < programs.length; i++) {
    programs[i].getUniforms();
    programs[i].getAttributes();
    if (i % 40 === 39) await breathe(0.9 + (0.05 * i) / programs.length);
  }
  keepProgramArrays();
}

/**
 * A dress rehearsal, while the loading line runs (user, 2026-11-11, playing on the web: "it freezes to load" when the
 * taps are opened and when Luna takes to her boat and her diving suit). Two things were still left to the moment a
 * thing is first drawn, and on a first visit the game stood still for each (2.9 s as the taps opened, 1.2 s as the
 * water went over the side, ~1 s as it spread, 0.6 s as the boat came, 0.6 and 1.1 s as it came into view):
 * - the graphics card readies a shader again for every kind of picture it is drawn into (its format, how many
 *   samples), at the first draw there: ~0.15 s for each of the rooms' shaders on an M2 (the second draw, nothing).
 *   The bathroom's water mirrors the room in a picture of another kind than the screen's; and what waits hidden — the
 *   water, the drops, the boat, the suit — had never been drawn in any;
 * - a shader is made for the number of planes its material is cut by (Luna's coat: 24; her suit: 16 or 17), which
 *   `compile` takes from the last thing drawn, not from the material: the ones it made for her were never used, hers
 *   were made at first sight, one at a time, ~0.4 s each. (And she, her boat and her suit took the bathroom's water
 *   patch only as they came, every 60th frame: made over again there.)
 * So her shaders are begun with the others, for the planes she has (`beginCut`), and each thing is drawn once as it
 * will be, shown or hidden, in view or not, into a few pixels of each kind of picture: what the water can mirror
 * (`hideForReflection`: the bathroom) and all that waits hidden in the house, in the mirror's kind; the hidden, in the
 * screen's; Luna as the bedroom has her and as the house has her, with her suit and without, in both. It goes on beside
 * the loading from the moment every lamp is in (the page is only waiting then, for Mum, the angel and the shaders),
 * each thing as soon as its shaders are ready. Nothing is changed by it: what was hidden is hidden again, the lamps'
 * shadows are not touched. See REHEARSE for the switch: without it none of this, all as it was (to measure against).
 */
const drawable = (o) => o.isMesh || o.isPoints || o.isLine || o.isSprite;
/** Whether `o` is shown now: itself and all it hangs from. */
const shownNow = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
/** Begins the shaders of `things` as `world`'s lamps light them, each for the planes its material is cut by. Returns the promises. */
function beginCut(things, world) {
  const byPlanes = new Map();
  for (const o of things) {
    const n = [].concat(o.material)[0].clippingPlanes?.length ?? 0;
    (byPlanes.get(n) ?? byPlanes.set(n, []).get(n)).push(o);
  }
  const begun = [];
  for (const [n, list] of byPlanes) {
    planesLeft(n);
    begun.push(renderer.compileAsync({ traverse: (f) => list.forEach(f), traverseVisible() {} }, camera, world)); // (a stand-in for a scene: just these)
  }
  planesLeft(0);
  return begun;
}
/** Luna's parts: `all`, `plain` (as she is without her hat and her suit) and her four `paws`. */
function lunaParts() {
  const all = [], plain = [];
  cat.root.traverse((o) => {
    if (!drawable(o)) return;
    all.push(o);
    for (let q = o; q && q !== cat.root; q = q.parent) if (!q.visible) return;
    plain.push(o);
  });
  return { all, plain, paws: cat.rig.legs.map((L) => L.paw) };
}
/**
 * Draws those of `world`'s things that are in `pick`, once, into `target` — whether shown now or not, in view or not —
 * by the lamps as they are lit now (a shader is made for the lamps there are: one that is off stays off), and leaves
 * everything as it was. The others are not drawn (by their layers: their lamps, if they carry any, still count).
 */
function drawOnce(world, target, pick) {
  const undo = [], set = (o, key, v) => { const was = o[key]; if (was !== v) { o[key] = v; undo.push(() => { o[key] = was; }); } };
  const lampsOff = [], chosen = [], rest = [];
  world.updateMatrixWorld(true);
  world.traverse((o) => {
    if (o.isLight) { if (!shownNow(o)) lampsOff.push(o); return; }
    if (drawable(o)) (pick.has(o) ? chosen : rest).push(o);
  });
  for (const o of rest) set(o.layers, 'mask', 0);
  for (const o of chosen) {
    for (let q = o; q; q = q.parent) set(q, 'visible', true);
    set(o, 'frustumCulled', false);
    if (o.isInstancedMesh && o.count === 0) set(o, 'count', 1);
  }
  for (const l of lampsOff) set(l, 'visible', false);
  const was = renderer.getRenderTarget(), due = renderer.shadowMap.needsUpdate;
  renderer.shadowMap.needsUpdate = false; // (the lamps' shadows are the game's to draw, with what is really there)
  renderer.setRenderTarget(target);
  renderer.render(world, camera);
  renderer.setRenderTarget(was);
  renderer.shadowMap.needsUpdate = due;
  for (let i = undo.length - 1; i >= 0; i--) undo[i]();
  planesLeft(0);
  rehearsed.drawn += chosen.length;
}
/** Resolves when the graphics card has done all it has been sent (the page is free meanwhile, the loading line goes on). */
async function cardDone(most = 30000) {
  const gl = renderer.getContext(), mark = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), t0 = performance.now();
  gl.flush();
  do await breathe(rehearsed.line); while (gl.getSyncParameter(mark, gl.SYNC_STATUS) !== gl.SIGNALED && !gl.isContextLost() && performance.now() - t0 < most);
  gl.deleteSync(mark);
}
/** `shaders`: the promise of all the shaders begun (after it, everything is drawn whether its shaders say ready or not). */
async function rehearse(shaders) {
  shaders.catch(() => {});
  if (!REHEARSE) return;
  let firstDone = null;
  rehearsed.first = new Promise((r) => { firstDone = r; });
  await null; // (whoever called goes on first: the wait for Mum and the angel begins now, not after the first things are sent)
  const t0 = performance.now(), made = renderer.info.programs.length;
  const screens = sharedPicture(); // the screen's kind: half-float, multisampled, with its depth
  screens.setSize(8, 8);
  const mirrors = new THREE.WebGLRenderTarget(8, 8, { type: THREE.HalfFloatType }); // the water's (water.js PlanarReflection)
  // what stands in the bathroom, which its water mirrors; and whatever in the house waits hidden
  const bath = ROOMS[1].around, hidden = [], standing = [];
  house.scene.updateMatrixWorld(true);
  house.scene.traverse((o) => {
    if (!drawable(o)) return;
    if (!shownNow(o)) hidden.push(o);
    else if (bath.intersectsSphere(boundsOf(o))) standing.push(o);
  });
  // Luna: where the bedroom has her; and in the house, with all she wears in the bathroom — her hat, her suit, its paws
  const L = lunaParts(), suit = boat.gear.paws;
  const inHouse = (draw) => {
    const home = cat.root.parent, at = home.children.indexOf(cat.root);
    house.scene.add(cat.root);
    draw();
    house.scene.remove(cat.root);
    home.children.splice(at, 0, cat.root); // (back where she was, in the same place among the others)
    cat.root.parent = home;
  };
  const suited = (draw) => inHouse(() => {
    const bare = L.paws.map((p) => p.material);
    L.paws.forEach((p, i) => { p.material = suit[i]; });
    draw();
    L.paws.forEach((p, i) => { p.material = bare[i]; });
  });
  const suitOf = (o) => [suit[L.paws.indexOf(o)]], own = (o) => [].concat(o.material);
  // (what lets light through — the water falling over the bath's side — by itself in the mirror's kind: with it three
  // draws all that is solid once more, into a picture of the screen's kind, which the room will have had by then)
  const clear = (o) => own(o).some((m) => m.transmission > 0);
  // (of what waits hidden, the water mirrors only what is in the bathroom, or put away where the bedroom is — the boat,
  // the drops, the bubbles wait at the house's origin — not the hob's flames or the hose's water)
  const byTheWater = (o) => bath.intersectsSphere(boundsOf(o)) || ROOMS[0].around.intersectsSphere(boundsOf(o));
  const jobs = [
    { world: house.scene, target: mirrors, kind: 'm', left: standing.filter((o) => !clear(o)) }, // (the room in its water: the 2.9 s as the taps opened — the loading waits for this one)
    { world: house.scene, target: screens.rt, kind: 's', left: hidden },
    { world: house.scene, target: mirrors, kind: 'm', left: hidden.filter((o) => !clear(o) && byTheWater(o)) },
    { world: house.scene, target: mirrors, kind: 'm', left: [...standing, ...hidden].filter(clear) },
    { world: house.scene, target: screens.rt, kind: 's', left: L.all, around: inHouse },
    { world: house.scene, target: mirrors, kind: 'm', left: L.all, around: inHouse },
    { world: house.scene, target: screens.rt, kind: 's', left: L.paws, around: suited, mats: suitOf },
    { world: house.scene, target: mirrors, kind: 'm', left: L.paws, around: suited, mats: suitOf },
  ];
  // A thing is drawn once its shaders are ready (asked without waiting), a few shaders new to a kind of picture at a
  // time (~0.15 s each on a first visit), and the card is let finish before the next few: sent all at once, the page
  // stood still until the card had done them all (16 s). What three asks of a shader the first time it is used is
  // asked here, before anything is sent: asked in the middle, each answer waits for the draws before it.
  // The loading waits only for the first job, the water's mirror — done by then as it is, on a first visit, the page
  // waiting for the shaders anyway (the card does one or the other: all of it under the loading line would be ~10 s
  // more). The rest goes on behind the start window, three at a time; and once you play, one at a time and only while
  // your eye has stood still for half a second, a second apart (0.08–0.45 s each on a first visit; none while you move).
  const seen = new Set(), asked = new WeakSet();
  let all = false, lastAt = 0;
  shaders.then(() => { all = true; }, () => { all = true; });
  const programsOf = (mats) => mats.flatMap((m) => [...(renderer.properties.get(m).programs?.values() ?? [])]);
  const ready = (ps) => all || (ps.length > 0 && ps.every((p) => p.isReady()));
  const paced = () => rehearsed.playing && !rehearsed.hurry;
  const count = () => (rehearsed.left = jobs.reduce((n, j) => n + j.left.length, 0));
  for (let idle = 0; count(); ) {
    while (paced() && !(rehearsed.still >= 0.5 && !player.seat && performance.now() - lastAt > 1000)) await breathe(); // (not at the PC: its pointer would stop with each)
    const at = performance.now(), most = paced() ? 1 : 3;
    let fresh = 0, drew = 0;
    for (const j of jobs) {
      const now = new Set(), matsOf = j.mats ?? own;
      for (const o of j.left) {
        const ps = programsOf(matsOf(o));
        if (!ready(ps)) continue;
        const key = j.kind + ps.map((p) => p.id).join('.');
        if (!seen.has(key)) {
          if (fresh >= most) continue;
          seen.add(key);
          fresh++;
        }
        for (const p of ps) if (!asked.has(p) && p.isReady()) { asked.add(p); p.getUniforms(); p.getAttributes(); }
        now.add(o);
      }
      if (!now.size) continue;
      j.left = j.left.filter((o) => !now.has(o));
      (j.around ?? ((draw) => draw()))(() => drawOnce(j.world, j.target, now));
      drew += now.size;
    }
    const sent = performance.now() - at;
    await cardDone();
    lastAt = performance.now();
    if (drew) rehearsed.steps.push([Math.round(at - t0), Math.round(sent), Math.round(lastAt - at), drew, fresh, most]); // (when, ms to send, ms in all, things, shaders new to a kind, at most)
    else if (++idle > 3000) all = true; // (never: the shaders' promise comes first)
    if (!jobs[0].left.length) firstDone();
    rehearsed.rounds++;
  }
  firstDone();
  mirrors.dispose();
  keepProgramArrays();
  rehearsed.ms = Math.round(performance.now() - t0);
  rehearsed.shaders = renderer.info.programs.length - made;
}

built(); // (Mum and the angel, whenever they come)
// The shaders, begun now and not waited for: the graphics card gets on with them while Mum and the angel are still on
// their way over the network and the textures are lightened, where before it only began after both (on a first visit
// the shaders take ~11 s of their own — players, 2026-11-09: "too long to load"; later visits find them kept by the
// browser). Only once every lamp is in its scene: a shader is made for the lamps there are.
rehearsed.whole = rehearse(beginShaders()).catch((e) => console.error('rehearsal', e)); // (beside the rest of the loading, from here; and on after it)
lampsAsSaid(scene, ROOM_LAMPS, 'the bedroom');
lampsAsSaid(house.scene, HOUSE_LAMPS, 'the house');
await Promise.race([Promise.all(arrivals), new Promise((r) => setTimeout(r, 8000))]); // (here in time: compiled with the rest)
const WORLDS = [scene, house.scene, house.cellar.scene, zelpa.scene];
const lightened = HEAVY ? null : await lighten(renderer, WORLDS, { progress: 0.88 }); // (the same pictures, lighter: lighten.js)
await prepareShaders();
rehearsed.line = 0.97;
await Promise.race([rehearsed.first, rehearsed.whole]); // (the water's mirror; the rest goes on behind the start window)
rehearsed.line = null;
statusEl.textContent = '';
statusEl.hidden = true; // (its empty line under the button set it off-centre: user, 2026-11-11)
$('start-load').hidden = true; // loaded: the bar goes, the Start button comes up in its place
startBtn.hidden = false;
startBtn.disabled = false;
if (SHOT) startEl.hidden = true; // camera stays parked on the reference pose
requestAnimationFrame(tick);

// handles for tuning from the console
window.GAME = { THREE, scene, camera, renderer, composer, passes: { room: roomPass, house: housePass, cellar: cellarPass }, player, cat, boat, desktop, sound, inventory, sit: setSeated, stars: ctx.stars, lights, blind, door, bloom, grade, M, ROOM, START,
  reshadow: () => { shadowsDirty = 3; }, sharp, unseen, lightened, rehearsed, lighten: (o) => lighten(renderer, WORLDS, o), zelpa, house, colliders: ctx.colliders, tv: ctx.tv, warpTo: startWarp, world: () => world };
