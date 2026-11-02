// The garden hose (user, 2026-10-17, in place of the sprinkler): yellow, coiled on a hook on the wall by
// the outside tap and screwed onto it. Take it (E) and the tap is turned on: you carry its nozzle, the
// water arcs out where you look and darkens the lawn where it lands, and the hose follows you over the
// ground — a rope of points, pulled along, lying on the lawn, round what stands in the yard, never into
// the house or through anything. E again: back on its hook if you are by the tap, down on the lawn if
// not (pick it up again from its nozzle). It goes no further than its length; it does not come indoors.
import * as THREE from 'three';
import { streamTex } from './bath.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const N = 64, LEN = 11.5, SEG = LEN / (N - 1), R = 0.011; // points along it; metres long; its radius

/**
 * `tapAt`: the tap's middle on the wall; `wallZ`: the house wall's face (the yard is beyond it, −z); `yard`:
 * {x0, x1, z0, z1}; `ground(x, z)`: the height of what it lies on there (the lawn, a leaf heap, the sand, a
 * root); `extra()`: what it goes round or over besides the yard's colliders.
 */
export function gardenHose(g, ctx, { tapAt, wallZ, yard, ground = () => 0, extra = () => [], moved = () => {}, offset = { y: 0, z: 0 }, floorY = 0, hookY = floorY + 1.14 }) { // (floorY: the floor under where it hangs — the porch's)
  // (it lives in the yard's frame, which stands `offset` from the world's: the player and the camera are in the world's)
  const OY = offset.y, OZ = offset.z;
  const yellow = std({ color: 0xcfae2e, roughness: 0.6 }); // gone a little dull in the sun
  const grey = std({ color: 0x6f716e, roughness: 0.5 });
  const dark = std({ color: 0x2c2b29, metalness: 0.5, roughness: 0.6 });

  // ---- on the tap (yard.js: its spout turned down, its threaded end at tapAt.y − 0.048): the coupling
  // screwed onto it — a hex nut, the grey body under it, a collar where the hose is pushed onto it — and
  // the hose going on down out of that (user, 2026-10-17: "connect the hose to the tap better")
  const conn = new THREE.Vector3(tapAt.x, tapAt.y - 0.05, tapAt.z - 0.07);
  const fitting = new THREE.Group();
  fitting.position.copy(conn);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.02, 6), grey);
  nut.position.y = -0.006;
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0135, 0.034, 14), grey);
  shank.position.y = -0.033;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.016, 14), yellow);
  sleeve.position.y = -0.056;
  fitting.add(nut, shank, sleeve);
  fitting.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.add(fitting);
  const start = new THREE.Vector3(conn.x, conn.y - 0.062, conn.z); // where the hose leaves it, going down

  // ---- the hook on the wall beside the tap, and the hose coiled on it, its nozzle hanging from the end
  const hook = new THREE.Vector3(tapAt.x + 0.55, hookY, wallZ - 0.02); // (lower on the porch's front than it was on the wall: user, 2026-10-20)
  const bracket = new THREE.Group();
  bracket.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.008), dark).translateZ(-0.004));
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.19, 8).rotateX(Math.PI / 2), dark); // (long enough for its six loops side by side)
  arm.position.set(0, 0, -0.095);
  bracket.add(arm);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), dark);
  lip.position.set(0, 0.016, -0.188);
  bracket.add(lip);
  bracket.position.set(hook.x, hook.y, wallZ);
  bracket.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.add(bracket);
  // the coil: from the tap the hose hangs down, sags low and comes up the near side of the coil into it;
  // six loops hang on the hook, each a little further out, pinched narrow over it and wider at the bottom,
  // none quite like the last; the end comes off the far side going down, and hangs there, its nozzle
  // pointing at the ground (user, 2026-10-17: it had run to the coil's middle and dropped straight down)
  const LOOPS = 6, RX = 0.15, RY = 0.2, top = hook.y + 0.008 + R, cx = hook.x, cy = top - RY; // (every loop's top resting on the hook's arm)
  const loopAt = (n) => { // n loops round from the near side (−x, the tap's), going up and over
    const f = n - Math.floor(n), k = Math.floor(n), wob = Math.sin(k * 2.3 + 0.7) * 0.012, sag = Math.sin(k * 1.7) * 0.008;
    const phi = Math.PI - f * Math.PI * 2, c = Math.cos(phi), sn = Math.sin(phi);
    return new THREE.Vector3(cx + (RX + wob) * c * (0.8 + 0.2 * (1 - sn)) + (k - 2.5) * 0.003, top - (RY + sag) * (1 - sn) - (sn < 0 ? 0.02 * -sn : 0), wallZ - 0.03 - n * 0.0225); // (side by side: a hose's width apart, never through each other)
  };
  const near = loopAt(0);
  const coilPts = [start.clone(), start.clone().add(new THREE.Vector3(0.004, -0.09, -0.004)), new THREE.Vector3(tapAt.x + 0.1, floorY + 0.2, wallZ - 0.07), new THREE.Vector3((tapAt.x + near.x) / 2 + 0.05, floorY + 0.16, wallZ - 0.06), new THREE.Vector3(near.x - 0.03, floorY + 0.42, wallZ - 0.045), new THREE.Vector3(near.x - 0.008, cy - 0.12, wallZ - 0.04)];
  for (let k = 0; k <= (LOOPS + 0.5) * 28; k++) coilPts.push(loopAt(k / 28));
  const off = coilPts[coilPts.length - 1]; // the far side, going down
  coilPts.push(off.clone().add(new THREE.Vector3(0.006, -0.1, -0.01)), off.clone().add(new THREE.Vector3(0.003, -0.24, -0.016)), off.clone().add(new THREE.Vector3(-0.004, -0.33, -0.018)));
  const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts, false, 'centripetal'), coilPts.length * 3, R, 8, false), yellow);
  coil.castShadow = coil.receiveShadow = true;
  g.add(coil);

  // ---- the nozzle: a pistol-grip spray nozzle, grey and yellow
  const nozzle = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.11, 12).rotateX(Math.PI / 2), yellow);
  nozzle.add(body);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.03, 12).rotateX(Math.PI / 2), grey);
  tip.position.z = -0.07;
  nozzle.add(tip);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.09, 0.03), grey);
  grip.position.set(0, -0.05, 0.035);
  grip.rotation.x = 0.25;
  nozzle.add(grip);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.05, 0.012), dark);
  trigger.position.set(0, -0.035, 0.0);
  nozzle.add(trigger);
  nozzle.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  nozzle.userData.live = true;
  g.add(nozzle);
  const hangNozzle = () => { // hanging from the end of the hose off the coil: its back up, its tip to the ground
    nozzle.position.copy(coilPts[coilPts.length - 1]).add(new THREE.Vector3(-0.003, -0.056, -0.002));
    nozzle.rotation.set(-Math.PI / 2, 0.12, 0.06);
  };
  hangNozzle();

  // ---- the hose off its hook: a rope of points
  const P = new Float32Array(N * 3), Q = new Float32Array(N * 3);
  // drawn as a smooth curve through its points, three samples a length (not a chain of straight sticks)
  const SUB = 3, M = (N - 1) * SUB + 1;
  const ropeGeo = new THREE.BufferGeometry(), RAD = 8, rv = M * (RAD + 1);
  ropeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rv * 3), 3));
  ropeGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rv * 3), 3));
  const ridx = [];
  for (let i = 0; i < M - 1; i++) for (let j = 0; j < RAD; j++) {
    const a = i * (RAD + 1) + j, b = a + 1, c = a + RAD + 1, d = c + 1;
    ridx.push(a, c, b, b, c, d);
  }
  ropeGeo.setIndex(ridx);
  const knots = Array.from({ length: N }, () => new THREE.Vector3()), curve = new THREE.CatmullRomCurve3(knots, false, 'centripetal'), smooth = Array.from({ length: M }, () => new THREE.Vector3());
  const rope = new THREE.Mesh(ropeGeo, yellow);
  rope.castShadow = rope.receiveShadow = true;
  rope.frustumCulled = false;
  rope.visible = false;
  rope.userData.live = true;
  rope.userData.knots = P; // (for checking)
  rope.userData.prev = Q;
  g.add(rope);

  // what it lies round: the yard's boxes (the shed, the swing's feet, the slide, the fence...)
  const inYard = (c) => (c.type === 'box' ? c.x1 > yard.x0 - 0.2 && c.x0 < yard.x1 + 0.2 && c.z1 > yard.z0 - 0.2 && c.z0 < wallZ + 0.2 : c.ax > yard.x0 - 0.5 && c.ax < yard.x1 + 0.5 && c.az > yard.z0 - 0.5 && c.az < wallZ + 0.5); // (and the trees: segments, grove.js)
  const boxes = () => ctx.colliders.filter((c) => c.hose !== false && inYard(c)).concat(extra());

  // ---- the water: an arc out of the nozzle, falling, where it lands the lawn going dark
  const stream = new THREE.Mesh(new THREE.BufferGeometry(), std({ map: streamTex(), color: 0xf2f6f7, roughness: 0.05, transparent: true, opacity: 0.88, depthWrite: false, emissive: 0x2a3234 }));
  stream.material.map.wrapT = THREE.RepeatWrapping;
  stream.frustumCulled = false;
  stream.visible = false;
  stream.userData.live = true;
  g.add(stream);
  const wetTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(18,22,10,0.55)');
    gr.addColorStop(0.6, 'rgba(18,22,10,0.35)');
    gr.addColorStop(1, 'rgba(18,22,10,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const wets = Array.from({ length: 40 }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: wetTex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.visible = false;
    m.renderOrder = 1;
    m.userData.live = true;
    g.add(m);
    return { m, age: 99 };
  });
  let wetIn = 0, wetAt = 0;
  // where it lands, drops thrown up and falling back
  const DROPS = 48, dropPos = new Float32Array(DROPS * 3), dropVel = new Float32Array(DROPS * 3);
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  const drops = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: 0xe8eef0, size: 0.014, transparent: true, opacity: 0.8, depthWrite: false }));
  drops.frustumCulled = false;
  drops.visible = false;
  drops.userData.live = true;
  g.add(drops);
  let dropAt = 0;
  const run = ctx.sound.steady('hose-run', conn);

  // ---- holding it, putting it back
  let state = 'hung'; // 'hung' | 'held' | 'down'
  const hand = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), v = new THREE.Vector3(), w = new THREE.Vector3();
  const nearTap = () => { const pl = ctx.player; return pl && Math.hypot(pl.pos.x - hook.x, pl.pos.y - OZ - (wallZ - 0.5)) < 1.6; };
  // the wall where it hangs, the tap and its hook (user, 2026-10-18: click there and it goes back on its hook,
  // held or lying wherever it was left)
  const zone = new THREE.Mesh(new THREE.BoxGeometry(hook.x - tapAt.x + 0.6, 1.4, 0.32), new THREE.MeshBasicMaterial({ visible: false }));
  zone.position.set((tapAt.x + hook.x) / 2 + 0.05, hook.y - 0.29, wallZ - 0.17);
  g.add(zone);
  const aim = new THREE.Raycaster(), MID = new THREE.Vector2();
  aim.far = 2.6;
  const aimingAtIt = () => { aim.setFromCamera(MID, ctx.camera); return aim.intersectObject(zone).length > 0; };
  const holding = {
    hint: () => (nearTap() ? '<kbd>E</kbd> hang the hose back up' : '<kbd>E</kbd> put the hose down'),
    release: () => {
      if (nearTap() || aimingAtIt()) hangUp();
      else { state = 'down'; ctx.player.holding = null; }
      ctx.sound.sample('tap-turn', conn);
    },
  };
  const take = () => {
    if (state === 'hung') {
      // off the hook: the hose down from the tap and lying in loose loops on the ground under the hook, each
      // length of it its own length along the loops, to be pulled out after you
      let a = 0;
      for (let i = 0; i < N; i++) {
        let x, y, z;
        if (i < 3) { x = start.x; y = Math.max(floorY + R, start.y - i * SEG); z = start.z; }
        else {
          const rr = 0.2 + 0.026 * (a / (Math.PI * 2));
          x = hook.x + Math.cos(a) * rr; y = floorY + R + 0.0005; z = wallZ - 0.45 - Math.sin(a) * rr;
          a += SEG / rr;
        }
        P.set([x, y, z], i * 3);
        Q.set([x, y, z], i * 3);
      }
    }
    state = 'held';
    coil.visible = false;
    moved(); // (the coil's shadow off the wall)
    rope.visible = true;
    ctx.player.holding = holding;
    ctx.sound.sample('tap-turn', conn);
  };
  const hangUp = () => {
    state = 'hung';
    coil.visible = true;
    moved();
    rope.visible = false;
    stream.visible = false;
    drops.visible = false;
    hangNozzle();
    if (ctx.player.holding === holding) ctx.player.holding = null;
  };
  coil.userData.interact = { label: () => 'Take the hose', use: take };
  zone.userData.interact = { label: () => (state === 'hung' ? 'Take the hose' : 'Hang the hose up'), use: () => (state === 'hung' ? take() : hangUp()) };
  ctx.interact.push(zone);
  ctx.interact.push(coil);
  nozzle.userData.interact = { label: () => (state === 'held' ? '' : 'Take the hose'), use: () => { if (state !== 'held') take(); } };
  ctx.interact.push(nozzle);
  // while it hangs, it takes pointing at the hose itself (user, 2026-11-02: the wall's whole zone said "Take the hose"): the zone is
  // only for hanging it back; a box just round the loops, as they are thin to aim at (three's rays pass over another layer)
  const loops = new THREE.Box3();
  for (let k = 0; k <= (LOOPS + 0.5) * 28; k++) loops.expandByPoint(loopAt(k / 28));
  loops.expandByScalar(0.018);
  const loopBox = new THREE.Mesh(new THREE.BoxGeometry(...loops.getSize(new THREE.Vector3()).toArray()), new THREE.MeshBasicMaterial({ visible: false }));
  loops.getCenter(loopBox.position);
  g.add(loopBox);
  loopBox.userData.interact = coil.userData.interact;
  ctx.interact.push(loopBox);

  const handAt = () => {
    const cam = ctx.camera;
    cam.getWorldPosition(hand);
    cam.getWorldDirection(fwd);
    up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    right.crossVectors(fwd, up).normalize();
    hand.addScaledVector(fwd, 0.42).addScaledVector(right, 0.15).addScaledVector(up, -0.16); // low in the corner of your eye
    return hand.set(hand.x, hand.y - OY, hand.z - OZ); // (in the yard's frame)
  };

  // (user, 2026-10-18: "the hose must never go through anything" — it went into the step outside the back door)
  const pushOut = (i, list) => {
    const k = i * 3;
    [P[k], P[k + 1], P[k + 2]] = pushPoint(P[k], P[k + 1], P[k + 2], list, i > 3);
  };
  const pushPoint = (x, y, z, list, offWall = true) => {
    const gy = ground(x, z);
    if (y < gy + R) y = gy + R; // the lawn, or what lies on it
    if (z > wallZ - R && offWall) z = wallZ - R; // never into the house
    x = Math.min(Math.max(x, yard.x0 + R + 0.05), yard.x1 - R - 0.05);
    z = Math.max(z, yard.z0 + R + 0.05);
    for (const b of list) {
      if (b.type === 'capsule') { // a pole leaning (the swing's legs, the slide's): away from it, every way
        const ax = b.b.x - b.a.x, ay = b.b.y - b.a.y, az = b.b.z - b.a.z, t = Math.min(1, Math.max(0, ((x - b.a.x) * ax + (y - b.a.y) * ay + (z - b.a.z) * az) / (ax * ax + ay * ay + az * az)));
        const cx = b.a.x + ax * t, cy = b.a.y + ay * t, cz = b.a.z + az * t, d = Math.hypot(x - cx, y - cy, z - cz), rr = b.r + R;
        if (d < rr) {
          if (d > 1e-6) { x = cx + ((x - cx) / d) * rr; y = cy + ((y - cy) / d) * rr; z = cz + ((z - cz) / d) * rr; }
          else x = cx + rr;
        }
        continue;
      }
      if (b.type === 'trunk') { // a tree's trunk as it is, its flare and buttresses: hugged, not kept off (user, 2026-10-18: "a gap")
        const rings = b.rings;
        if (y > rings[rings.length - 1].y || Math.abs(x - b.x) > 2.2 || Math.abs(z - b.z) > 2.2) continue;
        let i = 0;
        while (i < rings.length - 2 && rings[i + 1].y < y) i++;
        const A = rings[i], Bn = rings[i + 1], k = Math.min(1, Math.max(0, (y - A.y) / (Bn.y - A.y || 1)));
        const cx = A.cx + (Bn.cx - A.cx) * k, cz = A.cz + (Bn.cz - A.cz) * k, d = Math.hypot(x - cx, z - cz);
        const f = ((Math.atan2(z - cz, x - cx) / (2 * Math.PI) + 1) % 1) * A.r.length, j0 = Math.floor(f) % A.r.length, j1 = (j0 + 1) % A.r.length, fj = f - Math.floor(f);
        const rr = (A.r[j0] * (1 - fj) + A.r[j1] * fj) * (1 - k) + (Bn.r[j0] * (1 - fj) + Bn.r[j1] * fj) * k + R;
        if (d < rr) { if (d > 1e-6) { x = cx + ((x - cx) / d) * rr; z = cz + ((z - cz) / d) * rr; } else x = cx + rr; }
        continue;
      }
      if (y > (b.top ?? 9) + R || y < (b.base ?? -1) - R) continue;
      if (b.type !== 'box') { // a trunk, a low limb: round it
        const abx = b.bx - b.ax, abz = b.bz - b.az, t = Math.min(1, Math.max(0, ((x - b.ax) * abx + (z - b.az) * abz) / (abx * abx + abz * abz || 1)));
        const cx = b.ax + abx * t, cz = b.az + abz * t, d = Math.hypot(x - cx, z - cz), rr = b.r + R;
        if (d < rr) { if (d > 1e-6) { x = cx + ((x - cx) / d) * rr; z = cz + ((z - cz) / d) * rr; } else x = cx + rr; }
        continue;
      }
      const x0 = b.x0 - R, x1 = b.x1 + R, z0 = b.z0 - R, z1 = b.z1 + R;
      if (x <= x0 || x >= x1 || z <= z0 || z >= z1) continue;
      // out the nearest way: over its top if that is nearest and low, else round its side
      const ways = [[x - x0, -1, 0], [x1 - x, 1, 0], [z - z0, 0, -1], [z1 - z, 0, 1]];
      const top = b.top !== undefined && (b.over || (b.top < 0.6 && !b.round)) ? (b.top + R) - y : Infinity; // (a thin leg: round it, never over; `over`: lain on, however high — the porch)
      const [d, dx, dz] = ways.reduce((a, c) => (c[0] < a[0] ? c : a));
      if (top < d) y = b.top + R;
      else { x += dx * d; z += dz * d; }
    }
    return [x, y, z];
  };

  // the thin poles (the swing's legs, the slide's, a flamingo's) as [ax, ay, az, bx, by, bz, how near]: its
  // lengths are kept off them too, not only its points — between two points a length went straight through a
  // leg (user, 2026-10-18: "the hose still goes through the swing's poles")
  const polesOf = (list) => {
    const out = [];
    for (const b of list) {
      if (b.type === 'capsule') out.push([b.a.x, b.a.y, b.a.z, b.b.x, b.b.y, b.b.z, b.r + R]);
      else if (b.type === 'seg' && b.r < 0.1 && Math.abs(b.bx - b.ax) + Math.abs(b.bz - b.az) < 0.01) out.push([b.ax, b.base ?? 0, b.az, b.ax, b.top ?? 3, b.az, b.r + R]);
    }
    return out;
  };
  const nr = new Float64Array(6), cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  /** The nearest points of the length p→q and the pole a→b: nr = [s along the length, t along the pole, the way from the pole's to the length's (x, y, z), how far]. */
  const nearest = (px, py, pz, qx, qy, qz, ax, ay, az, bx, by, bz) => {
    const ux = qx - px, uy = qy - py, uz = qz - pz, vx = bx - ax, vy = by - ay, vz = bz - az, rx = px - ax, ry = py - ay, rz = pz - az;
    const A = ux * ux + uy * uy + uz * uz, E = vx * vx + vy * vy + vz * vz, F = vx * rx + vy * ry + vz * rz, C = ux * rx + uy * ry + uz * rz, Bv = ux * vx + uy * vy + uz * vz, den = A * E - Bv * Bv;
    let s = A < 1e-9 ? 0 : den > 1e-9 ? cl((Bv * F - C * E) / den) : 0, t = (Bv * s + F) / E;
    if (t < 0) { t = 0; s = A < 1e-9 ? 0 : cl(-C / A); } else if (t > 1) { t = 1; s = A < 1e-9 ? 0 : cl((Bv - C) / A); }
    nr[0] = s; nr[1] = t;
    nr[2] = px + ux * s - (ax + vx * t); nr[3] = py + uy * s - (ay + vy * t); nr[4] = pz + uz * s - (az + vz * t);
    nr[5] = Math.hypot(nr[2], nr[3], nr[4]);
  };
  rope.userData.poles = () => polesOf(boxes()); // (for checking)
  const keepLengthOff = (i, poles, held) => {
    const a = i * 3, b = a + 3, fixA = i === 0, fixB = i + 1 === N - 1 && held;
    for (const [ax, ay, az, bx, by, bz, rr] of poles) {
      if (Math.min(P[a], P[b]) > Math.max(ax, bx) + rr || Math.max(P[a], P[b]) < Math.min(ax, bx) - rr || Math.min(P[a + 2], P[b + 2]) > Math.max(az, bz) + rr || Math.max(P[a + 2], P[b + 2]) < Math.min(az, bz) - rr) continue;
      nearest(Q[a], Q[a + 1], Q[a + 2], Q[b], Q[b + 1], Q[b + 2], ax, ay, az, bx, by, bz); // where it was a moment ago: which side of the pole
      const wx = nr[2], wy = nr[3], wz = nr[4], wd = nr[5];
      nearest(P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], ax, ay, az, bx, by, bz);
      const s = nr[0], t = nr[1], d = nr[5];
      const through = t > 0.001 && t < 0.999 && wd > 1e-5 && nr[2] * wx + nr[3] * wy + nr[4] * wz < 0; // gone through it since: back the way it came
      if (!through && d >= rr) continue;
      let nx, ny, nz, gap;
      if (through || d < 1e-5) { nx = wx / (wd || 1); ny = wy / (wd || 1); nz = wz / (wd || 1); if (wd < 1e-5) { nx = 1; ny = 0; nz = 0; } }
      else { nx = nr[2] / d; ny = nr[3] / d; nz = nr[4] / d; }
      const dx = nx * rr - nr[2], dy = ny * rr - nr[3], dz = nz * rr - nr[4]; // its nearest point onto the pole's surface, on the right side
      const wa = fixA ? 0 : 1 - s, wb = fixB ? 0 : s, norm = Math.max(wa * wa + wb * wb, 0.09); // (never a free end flung far for a touch by the fixed one)
      if (wa + wb < 1e-3) continue;
      P[a] += (dx * wa) / norm; P[a + 1] += (dy * wa) / norm; P[a + 2] += (dz * wa) / norm;
      P[b] += (dx * wb) / norm; P[b + 1] += (dy * wb) / norm; P[b + 2] += (dz * wb) / norm;
    }
  };
  /** The same for the curve as it is drawn: each piece of it between two samples off the poles, both its ends moved. */
  const keepChordOff = (A, B, poles) => {
    for (const [ax, ay, az, bx, by, bz, rr] of poles) {
      if (Math.min(A.x, B.x) > Math.max(ax, bx) + rr || Math.max(A.x, B.x) < Math.min(ax, bx) - rr || Math.min(A.z, B.z) > Math.max(az, bz) + rr || Math.max(A.z, B.z) < Math.min(az, bz) - rr) continue;
      nearest(A.x, A.y, A.z, B.x, B.y, B.z, ax, ay, az, bx, by, bz);
      const d = nr[5];
      if (d >= rr || d < 1e-6) continue;
      const k = (rr - d) / d;
      A.x += nr[2] * k; A.y += nr[3] * k; A.z += nr[4] * k;
      B.x += nr[2] * k; B.y += nr[3] * k; B.z += nr[4] * k;
    }
  };

  const writeRope = () => {
    const pos = ropeGeo.attributes.position.array, nor = ropeGeo.attributes.normal.array;
    for (let i = 0; i < N; i++) knots[i].set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    const list = boxes();
    for (let i = 0; i < M; i++) { // the curve drawn through them pushed out too: between its points it cut the corners of things
      curve.getPoint(i / (M - 1), smooth[i]);
      if (i > 0) smooth[i].set(...pushPoint(smooth[i].x, smooth[i].y, smooth[i].z, list, i > SUB * 3)); // (by the tap only the ground: it hangs off the wall there)
    }
    const poles = polesOf(list);
    for (let pass = 0; pass < 2; pass++) for (let i = SUB * 3; i < M - 1; i++) keepChordOff(smooth[i], smooth[i + 1], poles);
    const S = smooth;
    const T = new THREE.Vector3(), Nn = new THREE.Vector3(1, 0, 0), B = new THREE.Vector3(), prevN = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < M; i++) {
      const a = Math.max(0, i - 1), b = Math.min(M - 1, i + 1);
      T.subVectors(S[b], S[a]).normalize();
      // carried along from the last point's, so it never twists
      Nn.copy(prevN).addScaledVector(T, -prevN.dot(T));
      if (Nn.lengthSq() < 1e-6) Nn.set(T.y, -T.x, 0);
      Nn.normalize();
      prevN.copy(Nn);
      B.crossVectors(T, Nn);
      for (let j = 0; j <= RAD; j++) {
        const ang = (j / RAD) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang), o = (i * (RAD + 1) + j) * 3;
        const nx = Nn.x * c + B.x * s, ny = Nn.y * c + B.y * s, nz = Nn.z * c + B.z * s;
        pos[o] = S[i].x + nx * R; pos[o + 1] = S[i].y + ny * R; pos[o + 2] = S[i].z + nz * R;
        nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
      }
    }
    ropeGeo.attributes.position.needsUpdate = true;
    ropeGeo.attributes.normal.needsUpdate = true;
  };

  const writeStream = (time, list) => {
    // the arc: out of the nozzle's tip as you point it, falling, until it meets the lawn or something in the way
    tip.getWorldPosition(v);
    v.set(v.x, v.y - OY, v.z - OZ); // (in the yard's frame)
    nozzle.getWorldDirection(w).negate(); // (its nose is −z)
    const speed = 4.2, pts = [];
    let land = null;
    for (let k = 0; k <= 30; k++) {
      const t = k * 0.03, p = new THREE.Vector3(v.x + w.x * speed * t, v.y + w.y * speed * t - 4.9 * t * t, v.z + w.z * speed * t);
      const hit = p.y <= ground(p.x, p.z) + 0.01 || p.z > wallZ || list.some((b) => {
        if (b.type === 'capsule' || b.type === 'trunk') { const q = pushPoint(p.x, p.y, p.z, [b]); return q[0] !== p.x || q[2] !== p.z || q[1] !== p.y; } // (inside it: pushed)
        if (p.y > (b.top ?? 9) || p.y < (b.base ?? -1)) return false;
        if (b.type === 'box') return p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1;
        const abx = b.bx - b.ax, abz = b.bz - b.az, t = Math.min(1, Math.max(0, ((p.x - b.ax) * abx + (p.z - b.az) * abz) / (abx * abx + abz * abz || 1)));
        return Math.hypot(p.x - b.ax - abx * t, p.z - b.az - abz * t) < b.r; // a trunk, a flamingo: the water stops at it (user, 2026-10-18)
      });
      if (hit) p.y = Math.max(p.y, Math.min(ground(p.x, p.z), p.y + 0.15)); // (onto what it lands on, not into it)
      pts.push(p);
      if (hit) { land = p; break; }
    }
    if (pts.length < 3) { stream.visible = false; return null; }
    stream.geometry.dispose();
    stream.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.011, 8, false);
    stream.material.map.offset.y = (-time * 3) % 1;
    stream.visible = true;
    return land;
  };

  return {
    update(dt, time) {
      zone.layers.set(state === 'hung' ? 1 : 0);
      loopBox.layers.set(state === 'hung' ? 0 : 1);
      const pl = ctx.player;
      run.set(state === 'held' ? 1 : 0);
      for (const wv of wets) { // the wet patches drying
        if (wv.age > 60) continue;
        wv.age += dt;
        wv.m.material.opacity = Math.max(0, 0.8 - wv.age / 45) * Math.min(1, wv.age * 3);
        wv.m.visible = wv.m.material.opacity > 0.01;
      }
      if (state === 'hung' || !pl) return;
      const list = boxes(), poles = polesOf(list);
      if (state === 'held') {
        // gone indoors with it: you let go of it at the door
        if (pl.pos.y - OZ > wallZ - 0.15) { state = 'down'; pl.holding = null; } // (up onto the porch: let go of at its edge)
        // no further than it goes: pulled up short
        v.set(pl.pos.x - start.x, 0, pl.pos.y - OZ - start.z);
        const far = v.length();
        if (far > LEN - 0.6) { v.multiplyScalar((LEN - 0.6) / far); pl.pos.set(start.x + v.x, start.z + v.z + OZ); }
        // nor further than it goes the way it lies, round what it is wrapped round: it holds you back (user,
        // 2026-10-18: pulled on round the swing's leg, it was drawn tight straight through it)
        let run = 0;
        for (let i = 0; i < N - 1; i++) run += Math.hypot(P[i * 3 + 3] - P[i * 3], P[i * 3 + 4] - P[i * 3 + 1], P[i * 3 + 5] - P[i * 3 + 2]);
        const over = run - LEN * 1.04, e = (N - 3) * 3;
        v.set(P[e] - pl.pos.x, 0, P[e + 2] - (pl.pos.y - OZ));
        const back = v.length();
        if (over > 0 && back > 1e-3) pl.pos.set(pl.pos.x + (v.x / back) * Math.min(over, 0.05), pl.pos.y + (v.z / back) * Math.min(over, 0.05));
      }
      if (state === 'held') {
        handAt();
        nozzle.position.copy(hand);
        nozzle.quaternion.copy(ctx.camera.quaternion);
        nozzle.rotateX(-0.12);
      }
      // the rope: let fall, then held to its length point by point, onto the lawn and round what is there
      const h = Math.min(dt, 1 / 30) / 2;
      for (let step = 0; step < 2; step++) {
        for (let i = 1; i < N; i++) {
          const k = i * 3;
          for (let c = 0; c < 3; c++) {
            const vel = (P[k + c] - Q[k + c]) * 0.9;
            Q[k + c] = P[k + c];
            P[k + c] += vel + (c === 1 ? -9.8 * h * h : 0);
          }
        }
        for (let it = 0; it < 10; it++) {
          P.set([start.x, start.y, start.z], 0);
          if (state === 'held') {
            // its end in your hand, at the nozzle's back
            nozzle.getWorldDirection(w);
            P.set([hand.x + w.x * 0.06, hand.y + w.y * 0.06 - 0.03, hand.z + w.z * 0.06], (N - 1) * 3);
          }
          for (let i = 0; i < N - 1; i++) {
            // each length of it back to its length, split between its ends — none of it on the tap's end, or on your hand's
            const a = i * 3, b = a + 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
            const wa = i === 0 ? 0 : 1, wb = i + 1 === N - 1 && state === 'held' ? 0 : 1, sum = wa + wb;
            if (!sum) continue;
            const diff = (d - SEG) / d;
            P[a] += dx * diff * (wa / sum); P[a + 1] += dy * diff * (wa / sum); P[a + 2] += dz * diff * (wa / sum);
            P[b] -= dx * diff * (wb / sum); P[b + 1] -= dy * diff * (wb / sum); P[b + 2] -= dz * diff * (wb / sum);
          }
          for (let i = 3; i < N - (state === 'held' ? 1 : 0); i++) pushOut(i, list);
          for (let i = 2; i < N - 1; i++) keepLengthOff(i, poles, state === 'held');
        }
        // and last of all the poles again, back and forth along it: pulled tight round one (further than it
        // goes), its lengths drawn straight would cut through it — it stretches a little rather
        if (poles.length) for (let pass = 0; pass < 8; pass++) for (let j = 2; j < N - 1; j++) keepLengthOff(pass % 2 ? N - j : j, poles, state === 'held');
      }
      if (state === 'down') { // its nozzle lying on the lawn at the end of it
        const e = (N - 1) * 3;
        nozzle.position.set(P[e], R + 0.012, P[e + 2]);
        nozzle.rotation.set(0, Math.atan2(P[e] - P[e - 3], P[e + 2] - P[e - 1]) + Math.PI, Math.PI / 2);
        stream.visible = false;
        drops.visible = false;
      }
      writeRope();
      if (state === 'held') {
        const land = writeStream(time, list);
        drops.visible = !!land;
        if (land) {
          for (let k = 0; k < 3; k++) { // new ones up out of where it lands
            const i = (dropAt++ % DROPS) * 3;
            dropPos.set([land.x, Math.max(land.y, 0.01), land.z], i);
            dropVel.set([(Math.random() - 0.5) * 0.9, 0.6 + Math.random() * 1.1, (Math.random() - 0.5) * 0.9], i);
          }
          for (let i = 0; i < DROPS * 3; i += 3) {
            dropVel[i + 1] -= 9.8 * dt;
            for (let c = 0; c < 3; c++) dropPos[i + c] += dropVel[i + c] * dt;
            if (dropPos[i + 1] < 0) { dropPos[i + 1] = -1; dropVel.fill(0, i, i + 3); } // fallen back in
          }
          dropGeo.attributes.position.needsUpdate = true;
        }
        if (land && land.y <= ground(land.x, land.z) + 0.02 && land.z < -0.2 && (wetIn -= dt) <= 0) { // darkening the lawn where it lands
          wetIn = 0.18;
          const wv = wets[wetAt++ % wets.length], s = 0.22 + Math.random() * 0.25;
          wv.m.position.set(land.x + (Math.random() - 0.5) * 0.08, 0.004 + (wetAt % 5) * 0.0004, land.z + (Math.random() - 0.5) * 0.08);
          wv.m.scale.set(s, 1, s * (0.8 + Math.random() * 0.4));
          wv.age = 0;
        }
      }
    },
  };
}
