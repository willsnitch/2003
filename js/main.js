import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ROOM, makeMaterials, buildShell, buildWindow, buildDoor, buildLights, buildEnvironment } from './room.js';
import { buildProps } from './props.js';
import { Player } from './player.js';
import { Cat } from './cat.js';
import { Desktop } from './pc.js';
import { Sound } from './audio.js';
import { makeInventory } from './inventory.js';
import { uvBeam, UV_TORCH } from './uvtorch.js';
import { buildHouse } from './house.js';
import { TORCH } from './basement.js';
import { DAY } from './daytime.js';
import { shadowTwin, shadowOnly } from './build.js';
import { lunaBoat } from './boat.js';
import { bubbles } from './bubbles.js';
import { buildZelpa } from './zelpa.js';
import { deg } from './util.js';

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot'); // clean frame for comparing against the reference photo

// Where the reference photo was taken from: just inside the door, looking north-west.
const START = { x: 3.3, z: 3.72, yaw: 33, pitch: -12 };

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.localClippingEnabled = true; // Luna in her boat (cat.clip)
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
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
}
const blind = buildWindow(scene, M);
const door = buildDoor(scene, M, ctx.colliders);
buildProps(scene, M, ctx);
// the rest of the house and the yard: a scene of its own, with its own lamps (house.js)
const house = buildHouse(renderer, M, ctx);
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
    }`,
};

const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, target);
// The bedroom is drawn first, then the rest of the house and the yard into the same picture and
// against the same depth, so each shows only where nothing of the other stands in front of it.
// Each scene has its own lamps and its own shadow maps, redrawn when its own things move.
class ScenePass extends RenderPass {
  constructor(scene, camera, shadowsDue) {
    super(scene, camera);
    this.shadowsDue = shadowsDue;
  }
  render(renderer, ...rest) {
    renderer.shadowMap.needsUpdate = this.shadowsDue();
    super.render(renderer, ...rest);
  }
}
let roomShadowsDue = true;
const roomPass = new ScenePass(scene, camera, () => roomShadowsDue);
composer.addPass(roomPass);
const housePass = new ScenePass(house.scene, camera, () => house.shadowsDue());
housePass.clear = false;
composer.addPass(housePass);
// and under the house, the basement (basement.js): drawn only when it can be seen; from down there the house and the
// bedroom only when the cellar's open doors are in view
const cellarPass = new ScenePass(house.cellar.scene, camera, () => house.cellar.shadowsDue());
cellarPass.clear = false;
composer.addPass(cellarPass);
// No bloom (user, 2026-10-14): it put a halo round everything bright — sunlit sheets, plates, even
// Luna's eyes. The pass stays in place, switched off, in case it is ever wanted for the lamps alone.
const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.42, 0.75, 1.0);
bloom.enabled = false;
composer.addPass(bloom);
const grade = new ShaderPass(GradeShader);
composer.addPass(grade);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
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
const bathShut = { armed: false, wait: 0, was: false, hinge: new THREE.Vector3() };
function bathDoorBehind(dt) {
  const D = house.bathDoor, S = D.seg, here = house.roomAt(player.pos.x, player.pos.y) === 'bath';
  if (here && !bathShut.was) { bathShut.armed = D.state.target > 0.01; bathShut.wait = 0; }
  bathShut.was = here;
  if (!bathShut.armed || !here) return;
  bathShut.wait += dt;
  const reach = Math.hypot(S.bx - S.ax, S.bz - S.az) + 0.35; // all the leaf sweeps, and a little
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

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  frame++;

  player.update(dt);
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
  const first = frame === 1;
  const sunTurn = first || (shadowsDirty > 0 && frame % 2 === 0);
  const moving = stirring > 0;
  if (moving && (stirring -= dt) <= 0) shadowsDirty = 3;
  const glowTurn = first || (!sunTurn && (catMoved || moving || frame % 8 === 0));
  if (sunTurn) shadowsDirty--;
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
    house.bath.reflect(renderer, house.scene, camera, [inventory.hand]); // the bathroom's water, mirroring the room
    const view = house.cellar.passes(camera);
    roomPass.enabled = housePass.enabled = view.above;
    cellarPass.enabled = view.below;
    cellarPass.clear = !view.above;
    composer.render(dt);
    inventory.draw();
  }
  requestAnimationFrame(tick);
}

statusEl.textContent = '';
if (SHOT) startEl.hidden = true; // camera stays parked on the reference pose
requestAnimationFrame(tick);

// handles for tuning from the console
window.GAME = { THREE, scene, camera, renderer, player, cat, boat, desktop, sound, inventory, sit: setSeated, stars: ctx.stars, lights, blind, door, bloom, grade, M, ROOM, START,
  reshadow: () => { shadowsDirty = 3; }, zelpa, house, colliders: ctx.colliders, tv: ctx.tv, warpTo: startWarp, world: () => world };
