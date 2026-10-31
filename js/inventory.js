// What you are carrying, and what is in your hand.
// I opens it: a dark see-through sheet with a raised grey edge, a slot for each thing, and in
// each slot the thing itself — the same model with the same materials as when it lay in the
// room, drawn by the game's own renderer straight onto the picture. Pick one and it is held up
// in front of you; pick it again and it goes back.
import * as THREE from 'three';

const SLOTS = 8, ACROSS = 4;
const VIEW = new THREE.Vector3(0, 0.82, 0.57); // where a slot's thing is seen from: above and in front
const HAND = new THREE.Vector3(0.15, -0.125, -0.34); // where a held thing sits, from your eyes: right, down, ahead

export function makeInventory({ renderer, scene, camera, environment }) {
  const el = document.getElementById('inventory'), grid = document.getElementById('inv-slots');
  const nameEl = document.getElementById('inv-name'), actEl = document.getElementById('inv-act'), keysEl = document.getElementById('inv-keys');
  const slots = Array.from({ length: SLOTS }, () => grid.appendChild(Object.assign(document.createElement('div'), { className: 'slot' })));
  const items = []; // { id, name, show, grip }
  let open = false, chosen = 0, held = null, heldCopy = null, spin = 0, jab = 0;

  // ---- the sheet behind it all: drawn here rather than by the page, so that what is in the slots sits on it undimmed
  const sheet = new THREE.Scene();
  sheet.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0x0a0704, transparent: true, opacity: 0.62, depthTest: false, depthWrite: false, toneMapped: false })));
  const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---- a little studio the slots look into: one thing shown at a time
  const studio = new THREE.Scene();
  studio.environment = environment;
  studio.environmentIntensity = 0.6;
  studio.add(new THREE.HemisphereLight(0xfff1dc, 0x6b5f52, 1.5));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
  key.position.set(-0.7, 2, 1.1);
  studio.add(key);
  const lens = new THREE.PerspectiveCamera(22, 1, 0.01, 10);
  const frame = new THREE.Box3(), mid = new THREE.Vector3(), port = new THREE.Vector4();

  /** A copy of something from the room, without what only helped you find it and point at it. */
  const copyOf = (obj) => {
    const copy = obj.clone(true);
    for (const part of [...copy.children]) if (part.userData.aid) copy.remove(part);
    copy.position.set(0, 0, 0);
    copy.rotation.set(0, 0, 0);
    copy.visible = true;
    return copy;
  };

  // ---- what is in your hand: in the room itself, so the room's own lamps light it (out in the house, the
  // house's: `place`)
  const hand = new THREE.Group();
  hand.visible = false;
  scene.add(hand);
  const gl = renderer.getContext();
  // drawn into the nearest sliver of the depth range: it can't sink into a wall you walk up to
  const near = () => gl.depthRange(0, 0.1), far = () => gl.depthRange(0, 1);

  function hold(item) {
    hand.clear();
    held = item;
    heldCopy = null;
    if (!item) return;
    const copy = copyOf(item.thing);
    heldCopy = copy;
    // things lie along their own x; in the hand that points away from you, tipped up and a little inwards
    copy.rotation.set(0, item.grip.turn ?? Math.PI / 2, 0);
    const tilt = new THREE.Group();
    tilt.rotation.set(0.5, 0.22, -0.12, 'YXZ');
    tilt.add(copy);
    hand.add(tilt);
    tilt.traverse((part) => {
      if (!part.isMesh) return;
      part.castShadow = false; // its shadow would have to be redrawn every time you moved
      part.frustumCulled = false;
      part.onBeforeRender = near;
      part.onAfterRender = far;
    });
  }

  function label() {
    const item = items[chosen];
    for (const [i, slot] of slots.entries()) {
      slot.classList.toggle('chosen', i === chosen);
      slot.classList.toggle('held', !!items[i] && items[i] === held);
    }
    nameEl.textContent = item ? item.name[0].toUpperCase() + item.name.slice(1) : items.length ? '' : 'Nothing yet.';
    keysEl.hidden = !item;
    actEl.textContent = item && item === held ? 'put away' : 'hold';
  }

  const api = {
    /** Keep `obj` (the thing as it lies in the room) under `id`. `grip.turn`: which way it points when held. */
    add(id, name, obj, grip = {}) {
      if (items.length >= SLOTS || items.some((it) => it.id === id)) return;
      const show = new THREE.Group(); // centred, so it turns about its own middle
      const copy = copyOf(obj);
      show.add(copy);
      frame.setFromObject(copy);
      copy.position.sub(frame.getCenter(mid));
      show.visible = false;
      studio.add(show);
      items.push({ id, name, thing: obj, show, grip, reach: frame.getSize(mid).length() / 2 });
      label();
    },
    has: (id) => items.some((it) => it.id === id),
    get count() { return items.length; },
    get open() { return open; },
    /** The id of what is in your hand, or null. */
    get held() { return held ? held.id : null; },
    /** Where the part of the held thing named `name` is now (into `target`), or null if nothing is on show in your hand. */
    point(name, target) {
      const part = hand.visible && heldCopy ? heldCopy.getObjectByName(name) : null;
      return part ? part.getWorldPosition(target) : null;
    },
    /** The held thing used once: it dips down and in and comes back. */
    jab() { jab = 0.45; },
    /** What is in your hand, as drawn (to keep it out of reflections). */
    get hand() { return hand; },
    /** Which scene your hand is in: the one you are in, so its lamps light what you hold. */
    place(where) { if (hand.parent !== where) where.add(hand); },

    show(on) {
      if (open === on) return;
      open = on;
      el.hidden = !on;
      if (on) {
        chosen = Math.max(0, held ? items.indexOf(held) : Math.min(chosen, items.length - 1));
        label();
      }
    },

    /** A key pressed while it is open. Returns true if that should close it. */
    key(code) {
      const step = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1, ArrowUp: -ACROSS, KeyW: -ACROSS, ArrowDown: ACROSS, KeyS: ACROSS }[code];
      if (step) {
        const to = chosen + step;
        if (to >= 0 && to < SLOTS && (Math.abs(step) > 1 || Math.floor(to / ACROSS) === Math.floor(chosen / ACROSS))) chosen = to;
        label();
        return false;
      }
      if (code !== 'KeyE' && code !== 'Enter') return false;
      const item = items[chosen];
      if (!item) return false;
      hold(item === held ? null : item);
      return true;
    },

    /** Every frame: the held thing rides with your eyes. `seen`: whether it is on show at all; `stride`, `pace`: your walk. */
    update(dt, seen, stride = 0, pace = 0) {
      spin += dt;
      hand.visible = seen && !!held;
      if (!hand.visible) return;
      hand.position.copy(camera.position);
      hand.quaternion.copy(camera.quaternion);
      const tilt = hand.children[0];
      tilt.position.copy(HAND);
      tilt.position.y -= Math.abs(Math.sin(stride)) * 0.007 * pace; // it dips a little with each step
      tilt.position.x += Math.sin(stride) * 0.003 * pace;
      // put to use (the spade into the sand): down and in, and back
      jab = Math.max(0, jab - dt);
      const k = Math.sin((1 - jab / 0.45) * Math.PI) * (jab > 0 ? 1 : 0);
      tilt.position.y -= 0.07 * k;
      tilt.position.z -= 0.06 * k;
      tilt.rotation.x = 0.5 + 0.55 * k;
      hand.updateMatrixWorld(true);
    },

    /** Every frame, after the room has been drawn: the sheet, and each thing in its slot. */
    draw() {
      if (!open) return;
      const high = renderer.domElement.clientHeight, auto = renderer.autoClear;
      renderer.getViewport(port);
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      const into = (r, inset) => {
        const x = Math.round(r.left) + inset, y = Math.round(high - r.bottom) + inset, w = Math.round(r.width) - inset * 2, h = Math.round(r.height) - inset * 2;
        renderer.setViewport(x, y, w, h);
        renderer.setScissor(x, y, w, h);
        return w / h;
      };
      into(el.getBoundingClientRect(), 0);
      renderer.render(sheet, flat);
      for (const [i, item] of items.entries()) {
        lens.aspect = into(slots[i].getBoundingClientRect(), 2);
        lens.position.copy(VIEW).multiplyScalar((item.reach / Math.sin(THREE.MathUtils.degToRad(lens.fov / 2))) * 0.9);
        lens.lookAt(0, 0, 0);
        lens.updateProjectionMatrix();
        item.show.rotation.y = -0.6 + (i === chosen ? spin * 0.9 : 0); // the one you are on turns, to be looked at
        item.show.visible = true;
        renderer.clearDepth();
        renderer.render(studio, lens);
        item.show.visible = false;
      }
      renderer.setScissorTest(false);
      renderer.setViewport(port);
      renderer.autoClear = auto;
    },
  };
  label();
  return api;
}
