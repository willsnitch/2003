// Luna's boat (user, 2026-10-15): once the flooded bathroom stands deeper than the first row of
// tiles, a little wooden rowing boat floats there, and Luna goes about the bathroom in it, wearing a
// yellow oilskin sou'wester. She jumps in when she comes into the flooded bathroom and jumps out at
// the door when you leave it, as she always comes after you. When the water reaches the top, where
// she no longer fits in it under the ceiling, the boat sinks and she swims in diving gear instead.
// All of it is of this game's own making. The boat is roomy enough for all of her, fur and tail,
// sitting (no part of her may go through anything), and it never goes through the walls, the
// fixtures standing above the water, or the floating towel.
import * as THREE from 'three';
import * as T from './textures.js';
import { bubbles as bubbleField } from './bubbles.js';
import { canvasTex } from './util.js';

const DEEP = 0.1; // the first row of tiles: deeper than this, it is boat water
const std = (o) => new THREE.MeshStandardMaterial(o);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const { clamp, lerp } = THREE.MathUtils;

const LEN = 0.82, BEAM = 0.42; // the boat, overall (user: the size it first was)
const SIT = new THREE.Vector3(0, 0.04, 0.06); // where on its boards she sits, facing the bow
const DRAFT = 0.055; // how deep it floats, empty
const WALL = 0.14; // room it keeps from the walls, for what is fixed on them (the paper holder, the mirror)
const UP = new THREE.Vector3(0, 1, 0);
const CEILING_ROOM = 1.88; // as high as she swims, her helmet clear of the ceiling light (2.5 m room)
const POSE_HEAD = { lift: 0.035, fwd: 0 }; // where her head is, swimming: where it always is (cat.js, POSES.swim)

/**
 * `scene`: the house; `cat`: Luna; `bathroom`: {x0, x1, z0, z1, bathFront, door: {x0, x1}}; `water`:
 * the bath's water (bath.js); `colliders`: the house's; `env`: what the bathroom's surfaces reflect;
 * `door`: the bathroom door ({ seg }), whose sweep it keeps out of. Returns `update(dt, time, player)`.
 */
export function lunaBoat(scene, cat, { bathroom: B, water, colliders, env = null, door = null, blocks = () => null }) {
  const boat = rowingBoat(env);
  boat.visible = false;
  scene.add(boat);
  const hat = souwester(env);
  hat.visible = false;
  cat.rig.head.add(hat);
  const wear = (on) => {
    hat.visible = on;
    for (const ear of cat.rig.ears) ear.visible = !on; // folded flat under it
  };
  const gear = diveGear(cat, env, scene, water);

  // what it has to keep clear of: the walls, whatever stands up out of the water (the bath, the basin,
  // the toilet, and the bath's taps out from the wall), and the towel once it is in the water
  const fixtures = colliders.filter((c) => c.type === 'box' && c.top !== undefined && c.x1 > B.x0 && c.x0 < B.x1 && c.z1 > B.z0 && c.z0 < B.z1);
  fixtures.push({ x0: B.x0, x1: B.x0 + 0.22, z0: B.bathFront + 0.2, z1: B.z1 - 0.2, base: 0.7, top: 0.98 });
  if (door) {
    // all the ground the door's leaf sweeps, open or shut, from floor to lintel
    const S = door.seg, lw = Math.hypot(S.bx - S.ax, S.bz - S.az) + 0.06;
    const side = S.ax > (B.door.x0 + B.door.x1) / 2 ? -1 : 1; // which way from the hinge the doorway is
    fixtures.push({ x0: Math.min(S.ax, S.ax + side * lw), x1: Math.max(S.ax, S.ax + side * lw), z0: B.z0 - 0.1, z1: B.z0 + lw, base: 0, top: 9, sweep: true });
  }
  const HL = LEN / 2 + 0.03, HW = BEAM / 2 + 0.03;
  /** Whether it fits at x, z turned to yaw, its keel and rim at those heights, that far off the walls. */
  const fits = (x, z, yaw, keel = water.flood - DRAFT - 0.03, rim = water.flood + 0.22, wall = WALL, towelToo = true) => {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const ex = Math.abs(s) * HL + Math.abs(c) * HW, ez = Math.abs(c) * HL + Math.abs(s) * HW;
    if (x - ex < B.x0 + wall || x + ex > B.x1 - wall || z - ez < B.z0 + wall || z + ez > B.z1 - wall) return false;
    const afloat = [...(towelToo ? [water.towelBlock(), water.duckBlock()] : []), blocks()].filter(Boolean); // and the cabinet's door, open
    for (const f of afloat.length ? [...fixtures, ...afloat] : fixtures) {
      if (f.top < keel || (f.base ?? 0) > rim) continue; // under it, or over it
      const hx = (f.x1 - f.x0) / 2, hz = (f.z1 - f.z0) / 2, dx = (f.x0 + f.x1) / 2 - x, dz = (f.z0 + f.z1) / 2 - z;
      if (Math.abs(dx) >= ex + hx || Math.abs(dz) >= ez + hz) continue;
      if (Math.abs(dx * s + dz * c) >= HL + hx * Math.abs(s) + hz * Math.abs(c)) continue; // apart along the boat
      if (Math.abs(dx * c - dz * s) >= HW + hx * Math.abs(c) + hz * Math.abs(s)) continue; // apart across it
      return false;
    }
    return true;
  };

  const doorX = (B.door.x0 + B.door.x1) / 2;
  // where it waits for her inside the door, clear of the door's sweep
  const dock = new THREE.Vector3(doorX, 0, B.z0 + (door ? Math.hypot(door.seg.bx - door.seg.ax, door.seg.bz - door.seg.az) + 0.12 : WALL) + HL);
  const out = new THREE.Vector2(doorX, B.z0 - 0.47); // and where she lands in the corridor, jumping out
  const at = new THREE.Vector3(), aim = new THREE.Vector3(), deck = new THREE.Vector3(), floor = new THREE.Vector3(), up = new THREE.Vector3();
  let yaw = 0, risen = 0, mode = 'gone', wanderIn = 0, apart = 0, stuck = 0, clipped = false, gearHulled = false, splashed = false;
  let cameBy = false, farFor = 0, leapt = false; // (come up right beside her; how long she has been out of reach of it; off it in a leap)
  const headAt = new THREE.Vector3(), watched = new THREE.Vector3(), stay = new THREE.Vector3(); // (where it settles, come up beside her)
  const shove = new THREE.Vector2(); // what you gave it, wading into it
  const rest = new THREE.Vector3(); // where it waits with her not in: by the door, or where you shoved it to
  const dryPlanes = boat.userData.inside.map(() => new THREE.Plane());
  let wakeIn = 0;
  const lastAt = new THREE.Vector2(NaN, NaN); // where it was last frame, for how fast it goes
  let sinkT = 0, roll = 0, pitch = 0, afloatY = 0, leaping = false, waited = 0;
  // where she wants to go next, riding: she looks there, the boat comes round, bow first, and off it goes
  const intent = { phase: 'go', t: 0, look: new THREE.Vector3() };
  /** Round on the spot towards `aim`, bow first; true once it is facing it (or can turn no further). */
  const comeRound = (dt) => {
    const want = Math.atan2(aim.x - at.x, aim.z - at.z), off = wrap(want - yaw);
    if (Math.abs(off) < 0.1) return true;
    const turn = yaw + Math.sign(off) * Math.min(Math.abs(off), 0.6 * dt);
    if (fits(at.x, at.z, turn)) { yaw = turn; return false; }
    return true; // hemmed in: it will come round as it goes
  };
  // the room it takes up, for her to keep out of while she is not in it (cat.keepClear, cat.swimAlong)
  const hull = { type: 'seg', ax: 0, az: 0, bx: 0, bz: 0, r: BEAM / 2, base: -9, top: -9 };
  (cat.player.extraColliders ??= []).push(hull); // you can't swim through her boat either (nowhere till it comes up)
  // and for the towel to keep out of (bath.js)
  const afloat = { on: false, x: 0, z: 0, yaw: 0, hl: HL, hw: HW };
  water.floaters.push(afloat);
  const inBath = (x, z) => x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1;
  const wander = () => {
    for (let k = 0; k < 16; k++) {
      const x = lerp(B.x0 + 0.4, B.x1 - 0.4, Math.random()), z = lerp(B.z0 + 0.7, B.z1 - 0.6, Math.random());
      if (Math.hypot(x - at.x, z - at.z) > 0.7 && fits(x, z, Math.atan2(x - at.x, z - at.z))) return aim.set(x, 0, z);
    }
    return aim.copy(at);
  };
  /**
   * Towards `aim`, swinging round slowly to the way it goes (bow or stern first, whichever is less
   * turning: it drifts as much as it rows); never into anything. Hemmed in, it straightens up along the
   * room.
   */
  const move = (dt, speed, steer = true, bowFirst = false) => {
    const ok = steer ? fits : (x, z, y) => fits(x, z, y, undefined, undefined, WALL, false); // going down, the towel makes way for it
    const dx = aim.x - at.x, dz = aim.z - at.z, d = Math.hypot(dx, dz);
    if (d < 0.01) return d;
    const step = Math.min(d, speed * dt), nx = at.x + (dx / d) * step, nz = at.z + (dz / d) * step;
    let off = wrap(Math.atan2(dx, dz) - yaw);
    if (!bowFirst && Math.abs(off) > Math.PI / 2) off = wrap(off + Math.PI);
    const turn = d > 0.08 && steer ? yaw + off * (1 - Math.exp(-dt * 0.8)) : yaw;
    const square = steer ? yaw + wrap(Math.round(yaw / Math.PI) * Math.PI - yaw) * Math.min(1, dt * 0.6) : yaw;
    if (ok(nx, nz, turn)) { at.x = nx; at.z = nz; yaw = turn; stuck = 0; }
    else if (ok(nx, nz, yaw)) { at.x = nx; at.z = nz; stuck = 0; }
    else if (ok(nx, nz, square)) { at.x = nx; at.z = nz; yaw = square; stuck = 0; }
    else if (Math.abs(nx - at.x) > 1e-5 && ok(nx, at.z, yaw)) { at.x = nx; stuck = 0; } // (only if it gets somewhere: going
    else if (Math.abs(nz - at.z) > 1e-5 && ok(at.x, nz, yaw)) { at.z = nz; stuck = 0; } // straight at a block, it is stuck)
    else if (ok(at.x, at.z, square)) { yaw = square; stuck += dt; }
    else if (ok(at.x, at.z, turn)) { yaw = turn; stuck += dt; }
    else stuck += dt;
    return d;
  };
  // on the bottom it has to clear everything, whatever the water: the nearest place it can lie, away
  // from the door, where she swims out
  const onBottom = (x, z, y) => fits(x, z, y, -1, 0.35, 0.04);
  const sinkSpot = () => {
    let best = null, bd = Infinity;
    for (let x = B.x0 + 0.35; x <= B.x1 - 0.35; x += 0.05) {
      for (let z = B.z0 + 2.2; z <= B.z1 - 0.9; z += 0.1) {
        const dd = Math.hypot(x - at.x, z - at.z);
        if (dd < bd && onBottom(x, z, yaw)) { bd = dd; best = [x, z]; }
      }
    }
    return best ? aim.set(best[0], 0, best[1]) : aim.copy(at);
  };
  // the water she swims in, once it is full: clear of the walls, top to bottom, under the towel at the
  // top; what stands in it, for her to swim round (cat.js); and the way out under the water's face in
  // the door. The fixtures as they are, the toilet's cistern and its raised lid as well
  const toilet = fixtures.find((f) => f.top > 0.4 && f.top < 0.45);
  const standing = fixtures.filter((f) => !f.sweep);
  if (toilet) standing.push({ x0: toilet.x0, x1: toilet.x0 + 0.27, z0: toilet.z0, z1: toilet.z1, top: 0.9 });
  const moving = (D) => {
    // the boat, wherever it lies, and the door's leaf, wherever it stands
    D.blocks.length = standing.length;
    if (boat.visible) D.blocks.push({ x0: Math.min(hull.ax, hull.bx) - hull.r, x1: Math.max(hull.ax, hull.bx) + hull.r, z0: Math.min(hull.az, hull.bz) - hull.r, z1: Math.max(hull.az, hull.bz) + hull.r, base: hull.base, top: hull.top });
    const open = blocks();
    if (open) D.blocks.push(open); // the cabinet's door, standing open
    if (door) { const S = door.seg; D.blocks.push({ x0: Math.min(S.ax, S.bx) - 0.05, x1: Math.max(S.ax, S.bx) + 0.05, z0: Math.min(S.az, S.bz) - 0.05, z1: Math.max(S.az, S.bz) + 0.05, base: 0, top: 2.1 }); }
    // and you, feet to the top of your head: the room is too narrow to swim round you (0.76 m of water across, and she keeps
    // 0.55 m off you), so her ways go over your head or under your feet — coming to you from behind, she stuck there
    const you = cat.player;
    D.blocks.push({ x0: you.pos.x - 0.25, x1: you.pos.x + 0.25, z0: you.pos.y - 0.25, z1: you.pos.y + 0.25, base: you.feet, top: cat.camera.position.y + 0.15 });
  };
  const dive = (flood) => {
    const D = {
      x0: B.x0 + 0.42, x1: B.x1 - 0.42, z0: B.z0 + 0.5, z1: B.z1 - 0.5, y0: 0.04, y1: Math.min(flood - 0.55, CEILING_ROOM),
      home: false, exit: [doorX, 0.3, B.z0 + 0.3], out: [out.x, out.y], blocks: standing.slice(),
    };
    moving(D);
    return D;
  };
  // where she comes down, the water going back from under her (bath.js drain): the nearest floor she could stand
  // on (her own way about the house, cat.nav) with room for all of her, helmet and all, clear of everything
  // standing here (cat.inBlock), the door's sweep, the boat wherever it lies, and you
  const aside = [...standing, ...fixtures.filter((f) => f.sweep)].filter((f) => f.top > 0.03 && (f.base ?? 0) < 0.5);
  const landing = (player) => {
    let best = [cat.pos.x, cat.pos.z], bd = Infinity;
    const hx = hull.bx - hull.ax, hz = hull.bz - hull.az, m = 0.42; // (the glass of her helmet out in front of her)
    for (let x = B.x0 + m; x <= B.x1 - m; x += 0.05) { // (room to turn round, helmet and all)
      for (let z = B.z0 + m; z <= B.z1 - m; z += 0.05) {
        const dd = Math.hypot(x - cat.pos.x, z - cat.pos.z);
        if (dd >= bd || !cat.nav.free(x, z) || Math.hypot(x - player.pos.x, z - player.pos.y) < 0.75) continue;
        if (aside.some((f) => x > f.x0 - m && x < f.x1 + m && z > f.z0 - m && z < f.z1 + m)) continue;
        if (boat.visible) {
          const t = clamp(((x - hull.ax) * hx + (z - hull.az) * hz) / (hx * hx + hz * hz || 1), 0, 1);
          if (Math.hypot(x - hull.ax - hx * t, z - hull.az - hz * t) < hull.r + 0.45) continue;
        }
        bd = dd;
        best = [x, z];
      }
    }
    return best;
  };
  const poof = poofCloud(scene, () => water.volume.light());
  let shakeOff = false; // the water gone back with her still in her suit: she shakes it off

  // ---- the water going back takes the boat with it (user, 2026-11-02): sucked along the floor to the bath — down
  // the east side, clear of the basin and the toilet on the west wall — up its front and over, into it, and round
  // and round down the plug hole, smaller and smaller, gone. Times from when it starts (as the floor is bared), stretched
  // to end with the water (bath.js drainLeft):
  const SUCK = [1.4, 1.75, 2.0, 3.0]; // along the floor, up the front, over into it, down the hole
  const lane = B.x1 - WALL - HW, tubX = (B.x0 + B.x1) / 2, tubZ = (B.bathFront + B.z1) / 2;
  let suck = null;
  const sucked = (dt) => {
    const S = suck, Q = S.times, t = (S.t += dt), e = (a, b) => THREE.MathUtils.smoothstep(t, a, b), turnTo = (a, b, k) => a + wrap(b - a) * k;
    const lift = water.rim + 0.07; // (its keel clear of the bath's lip)
    let x, y, z, yw, s = 1;
    if (t < Q[0]) { // across to the lane, then down it, faster and faster
      const a = Math.abs(lane - S.x), b = Math.abs(S.zEnd - S.z), d = (t / Q[0]) ** 2 * (a + b);
      x = d < a ? lerp(S.x, lane, d / a) : lane;
      z = d < a ? S.z : lerp(S.z, S.zEnd, (d - a) / Math.max(b, 1e-4));
      y = S.y * (1 - e(0, 0.3));
      yw = turnTo(S.yaw, S.yawZ, e(0, 0.9));
    } else if (t < Q[1]) { // up the bath's front with the water, coming round across it
      const k = e(Q[0], Q[1]);
      x = lerp(lane, tubX, k);
      z = lerp(S.zEnd, B.bathFront - HW - 0.03, k);
      y = lift * k;
      yw = turnTo(S.yawZ, S.yawX, k);
    } else if (t < Q[2]) { // over, into it
      x = tubX;
      z = lerp(B.bathFront - HW - 0.03, tubZ, e(Q[1], Q[2]));
      y = lift;
      yw = S.yawX;
    } else { // down onto the water left in it, and round and round down the hole
      const u = Math.min(1, (t - Q[2]) / (Q[3] - Q[2])), k = THREE.MathUtils.smoothstep(u, 0.2, 0.9);
      s = 1 - THREE.MathUtils.smoothstep(u, 0.25, 1);
      if (s < 0.65) S.spin += dt * (3 + 16 * (0.65 - s) / 0.65); // (only once it is small enough to turn in there)
      x = lerp(tubX, water.plug.x, k);
      z = lerp(tubZ, water.plug.z, k);
      y = Math.max(lerp(lift, water.state.level - DRAFT * s, e(Q[2], Q[2] + 0.3)), water.plug.y + 0.004);
      yw = S.yawX + S.spin;
    }
    const tilt = 1 - e(0, 0.9);
    boat.position.set(x, y, z);
    boat.rotation.set(S.rx * tilt, yw, S.rz * tilt, 'YXZ');
    boat.scale.setScalar(Math.max(s, 1e-3));
    if (t < Q[1]) { // on the floor and coming upright: no corner of it down through the tiles
      boat.updateMatrixWorld(true);
      let low = Infinity;
      const H = boat.userData.hull;
      for (let i = 0; i < H.count; i++) low = Math.min(low, floor.fromBufferAttribute(H, i).applyMatrix4(boat.matrixWorld).y);
      if (low < 0.002) boat.position.y += 0.002 - low;
      y = boat.position.y;
    }
    at.set(x, 0, z);
    yaw = yw;
    const fx = Math.sin(yw) * (LEN / 2 - BEAM / 2) * s, fz = Math.cos(yw) * (LEN / 2 - BEAM / 2) * s;
    Object.assign(hull, { ax: x - fx, az: z - fz, bx: x + fx, bz: z + fz, r: (BEAM / 2) * s, base: y - 0.05, top: y + 0.3 * s });
    if (t >= Q[3]) { // gone: ready to come up out of the water again, should it ever be deep enough
      suck = null;
      mode = 'gone';
      boat.visible = false;
      boat.scale.setScalar(1);
      boat.userData.dry.visible = true;
      risen = sinkT = waited = 0;
      Object.assign(hull, { ax: 1e4, az: 1e4, bx: 1e4, bz: 1e4, r: BEAM / 2, base: -9, top: -9 });
    }
  };

  return {
    boat,
    gear, // (her diving gear, and whether it fits somewhere: for checking them, tools/harness.js)
    poof, // (the same)
    fits,
    update(dt, time, player) {
      const flood = water.flood;
      // she would not fit in it under the ceiling light now — or, a little before, she is up in her suit
      const full = !water.draining && (flood >= water.top - 0.012 || (gear.worn && flood >= water.top - 0.03)); // (in her suit, in the boat or leapt out of it: the water stopped there, she swam nowhere — she stood in it)
      const lunaIn = cat.place.name === 'room' && inBath(cat.pos.x, cat.pos.z);
      const youIn = inBath(player.pos.x, player.pos.y);
      apart = youIn ? 0 : apart + dt;
      poof.update(dt, cat.camera);
      // the taps on, and no boat yet: she keeps by you, sitting looking at you whenever you stop (cat.heelAlong)
      cat.heel = mode === 'gone' && !suck && !water.draining && (water.state.hot || water.state.cold) && lunaIn && youIn && !cat.dive && !cat.ride;

      // ---- the water going back (bath.js drain, the door opened: user, 2026-11-02): swimming, or up in the water
      // off the bow, down she comes with it onto a clear patch of floor (cat.carriedDown); still in her suit once
      // it has all gone, she stands a moment (2 s), then shakes herself as a wet cat does, and the suit is gone in a puff
      if (water.draining) {
        shakeOff = gear.worn;
        if (!cat.dive && gear.worn && lunaIn && !cat.ride && !cat.air && cat.queue[0]?.type !== 'jump' && cat.groundY > 0.05) cat.dive = dive(flood);
        if (cat.dive) {
          cat.dive.carry ??= landing(player);
          cat.dive.y1 = Math.min(flood - 0.55, CEILING_ROOM);
          moving(cat.dive);
        }
      } else if (shakeOff) {
        if (!gear.worn || !lunaIn) shakeOff = false;
        else if (!cat.dive && !cat.ride && !cat.air && !cat.committed && cat.groundY < 0.05) {
          // turned to the door first, wherever she is (user, 2026-11-02), all within the 2 s (cat.js turns her at
          // 0.7 × TURN, 3.85 rad/s)
          const toDoor = Math.atan2(doorX - cat.pos.x, B.z0 - cat.pos.z), turning = Math.abs(wrap(toDoor - cat.yaw)) / 3.85;
          cat.queue = [{ type: 'face', yaw: toDoor, hold: true }, { type: 'pose', pose: 'stand', dur: Math.max(0.3, 2 - turning), look: 'ahead', hold: true }, { type: 'shake', hold: true, then: () => { gear.on(false); poof.start(cat.rig.root); } }];
          shakeOff = false;
        }
      }

      // a little before it is full, in her boat: her diving gear on first, the hat off (user, 2026-10-16);
      // out of the boat before it is on (you left), off again
      if (cat.ride && flood >= water.top - 0.03 && !gear.worn && !gear.dressing) { wear(false); gear.suitUp(); }
      if (gear.dressing && !cat.ride) gear.on(false);
      // ---- full to the top: she swims, in her diving gear
      if (full) {
        if (cat.ride && gear.worn && gear.since > 0.4) { // a moment in it on her feet, then in she goes
          // out of the boat as it starts to go: a leap off the bow, the way she faces, well clear of
          // it, into the water; in the water she is in her diving gear
          const D = dive(flood), ax = Math.sin(yaw), az = Math.cos(yaw);
          let ahead = HL + 0.5;
          const tz = at.z + az * ahead;
          if (tz < D.z0 || tz > D.z1) ahead = -ahead; // no room ahead: off the stern
          const to = [clamp(at.x + ax * ahead, D.x0, D.x1), D.y1, clamp(at.z + az * ahead, D.z0, D.z1)];
          cat.ride = null;
          wear(false);
          cat.queue = [{ type: 'jump', to, arc: 0.35, reach: 2.5, splash: true }]; // (into the water and straight on swimming: no landing on nothing)
          leaping = leapt = true;
          splashed = false;
        }
        // where she goes in, helmet first: the water thrown up and stirred by her dive (bath.js splash; user, 2026-11-11)
        if (leaping && !splashed && cat.air && cat.rig.head.getWorldPosition(headAt).y < flood + 0.06) { water.splash(headAt.x, headAt.z, cat.yaw); splashed = true; }
        if (leaping && cat.queue[0]?.type !== 'jump') leaping = false;
        // (never while she is still in the boat: it started as soon as her suit was on, and she swam up out of
        // the boat sideways, turning over, instead of leaping — user, 2026-10-19: "a horrible movement")
        if (!cat.dive && !cat.ride && !leaping && lunaIn && apart < 1 && !cat.air && cat.queue[0]?.type !== 'jump') {
          gear.on(true);
          cat.dive = dive(flood);
          cat.dive.greet = leapt; // straight from her leap: to you first, in front of your face (cat.planSwim)
          leapt = false;
        }
        if (cat.dive) {
          Object.assign(cat.dive, { y1: Math.min(flood - 0.55, CEILING_ROOM), home: apart > 2 });
          moving(cat.dive);
        }
      }
      if (!cat.dive && gear.worn && !lunaIn) gear.on(false); // out of the water: out of the suit
      if (!cat.ride && clipped) {
        for (const p of cat.clips) p.set(UP, 1e4);
        clipped = false;
      }
      if (!cat.ride && gearHulled) {
        for (const p of gear.hull) p.set(UP, 1e4);
        gearHulled = false;
      }
      gear.update(dt);
      water.volume.dry(null); // (set again below while it floats, dry inside)
      if (water.draining && boat.visible && !suck && flood < 0.02 && !cat.ride) {
        const yawZ = Math.abs(wrap(yaw)) < Math.PI / 2 ? 0 : Math.PI;
        const f = Math.max(1, water.drainLeft / SUCK[3]);
        suck = { t: 0, times: SUCK.map((v) => v * f), x: at.x, z: at.z, y: boat.position.y, yaw, yawZ, yawX: yawZ + Math.PI / 2, rx: boat.rotation.x, rz: boat.rotation.z, zEnd: B.bathFront - HL - 0.03, spin: 0 };
        afloat.on = false;
        boat.userData.dry.visible = false;
      }
      if (suck) { sucked(dt); return; }

      if (flood < DEEP && mode === 'gone') return;
      if (mode === 'gone') {
        // up it comes, out of the water, right beside her wherever she is in here (user, 2026-10-19: not by
        // the door): alongside her, on whichever side there is more room, else just ahead of her or behind;
        // never up into you. By the door only if she isn't in here, or there is no room by her at all.
        mode = 'wait';
        yaw = 0; // its bow to the bath (user, 2026-10-17)
        const cx = cat.pos.x, cz = cat.pos.z, xLo = B.x0 + WALL + HW, xHi = B.x1 - WALL - HW;
        const clear = (x, z) => Math.abs(player.pos.x - x) > HW + 0.3 || Math.abs(player.pos.y - z) > HL + 0.3;
        const sides = cx - B.x0 > B.x1 - cx ? [-1, 1] : [1, -1];
        const spots = [];
        for (const sd of sides) for (const dz of [0, 0.15, -0.15, 0.3, -0.3]) spots.push([THREE.MathUtils.clamp(cx + sd * (HW + 0.17), xLo, xHi), cz + dz, true]);
        for (const sd of [1, -1]) for (const dz of [0, 0.12, 0.25]) spots.push([THREE.MathUtils.clamp(cx, xLo, xHi), cz + sd * (HL + 0.2 + dz), false]);
        const by = inBath(cx, cz) ? spots.find(([x, z, beside]) => (!beside || Math.abs(x - cx) >= HW + 0.12) && clear(x, z) && fits(x, z, yaw)) : null;
        at.copy(by ? aim.set(by[0], 0, by[1]) : dock);
        rest.copy(dock);
        risen = 0;
        boat.visible = true;
        cat.obstacles = [hull];
        // and she stops where she is, turned to it, and watches it come up till she jumps in (user, 2026-11-11: it came
        // up as she walked, and followed her about): it waits there for her — come up by the door, it goes over to her
        cameBy = !!by;
        farFor = 0;
        // settling a little out from her as it comes up (fixed now: it never follows her), so that turning to it she
        // doesn't put her nose into its side (she was pushed off it, sliding: Cat.keepClear)
        const ox = at.x - cx, oz = at.z - cz, o = Math.hypot(ox, oz) || 1;
        stay.set(cx + (ox / o) * Math.max(o, 0.6), 0, cz + (oz / o) * Math.max(o, 0.6));
        cat.heel = false;
        if (lunaIn && !cat.committed && !full) cat.watch(watched.set(at.x, flood + 0.05, at.z));
        if (full) {
          // already full to the top (never in play: it comes up at the first row of tiles): it is
          // simply lying on the bottom, out of the way
          at.copy(sinkSpot());
          mode = 'sink';
          sinkT = 99;
          afloatY = 0;
          boat.userData.dry.visible = false;
        }
      }

      // ---- going down: it drifts off to a clear patch of floor, fills, and settles there on its side
      if (full && mode !== 'sink' && mode !== 'sunk') {
        mode = 'sink';
        sinkT = 0;
        afloatY = boat.position.y;
        sinkSpot();
        boat.userData.dry.visible = false; // the water in it now
      }
      if (mode === 'sink' || mode === 'sunk') {
        if (mode === 'sink') {
          // over to its patch of floor while it still floats (nothing stands up out of the water now),
          // and down only once it is there and she is clear of it
          const there = sinkT > 0 || move(dt, 0.15, false) < 0.03; // held to the heading it was found a place for
          const clear = Math.hypot(cat.pos.x - at.x, cat.pos.z - at.z) > 0.9 || !lunaIn;
          if (there) waited += dt;
          if (there && (clear || sinkT > 0 || waited > 4)) sinkT += dt; // (she gets out from under it as it comes: cat.js)
          afloat.on = sinkT < 1; // the towel keeps clear of it while it is still on the surface
          const k = THREE.MathUtils.smoothstep(sinkT, 0, 9);
          roll = 0.2 * k;
          pitch = -0.07 * k;
          boat.rotation.set(pitch, yaw, roll, 'YXZ');
          boat.position.set(at.x, Math.min(lerp(afloatY, 0, k), Math.max(0, flood - DRAFT)), at.z); // (the water going back: down with it)
          // never lower than its lowest point anywhere on the hull (tilted, a corner of the stern goes deepest)
          boat.updateMatrixWorld(true);
          let low = Infinity;
          const H = boat.userData.hull;
          for (let i = 0; i < H.count; i += 3) low = Math.min(low, floor.fromBufferAttribute(H, i).applyMatrix4(boat.matrixWorld).y);
          if (low < 0.004) boat.position.y += 0.004 - low;
          if (k >= 1) mode = 'sunk';
        }
        boat.updateMatrixWorld(true);
        const fx = Math.sin(yaw) * (LEN / 2 - BEAM / 2), fz = Math.cos(yaw) * (LEN / 2 - BEAM / 2);
        Object.assign(hull, { ax: at.x - fx, az: at.z - fz, bx: at.x + fx, bz: at.z + fz, base: boat.position.y - 0.05, top: boat.position.y + 0.3 });
        return;
      }

      risen = Math.min(1, risen + dt / 2.5);
      const boarding = cat.queue[0]?.board;

      // where it is going
      if (mode === 'ride') {
        if (apart > 2) { mode = 'home'; intent.phase = 'go'; } // you went out: take her to the door
        else if ((wanderIn -= dt) <= 0 || stuck > 1) {
          wander();
          wanderIn = 9 + Math.random() * 8;
          stuck = 0;
          intent.phase = 'look';
          intent.t = 0;
        }
      }
      if (mode === 'wait') {
        // she is in here: it waits where it came up, beside her, for her to jump in; come up by the door, it goes and
        // lies alongside her as she stands watching it (never after her while she walks); hold still while she jumps
        if (boarding || (lunaIn && !cameBy && cat.queue[0]?.type === 'walk')) aim.copy(at);
        else if (lunaIn && cameBy) aim.copy(stay);
        else if (lunaIn && !cat.ride && !cat.air) {
          const ax = at.x - cat.pos.x, az = at.z - cat.pos.z, a = Math.hypot(ax, az) || 1;
          aim.set(cat.pos.x + (ax / a) * 0.75, 0, cat.pos.z + (az / a) * 0.75);
        } else aim.copy(rest);
      }
      if (mode === 'home') aim.copy(dock);
      // the water gone from under it (drain): down on its keel on the floor, where it is
      const aground = risen >= 1 && flood < DRAFT + 0.025;
      let d;
      if (aground) d = Math.hypot(aim.x - at.x, aim.z - at.z);
      else if (mode === 'ride' && intent.phase !== 'go') {
        // first she looks where she wants to go, then the boat comes round to it
        intent.t += dt;
        if (intent.phase === 'look' && intent.t > 1.4) intent.phase = 'turn';
        if (intent.phase === 'turn' && comeRound(dt)) intent.phase = 'go';
        d = Math.hypot(aim.x - at.x, aim.z - at.z);
      } else d = move(dt, mode === 'ride' ? 0.11 : 0.3, true, mode !== 'wait');

      // you, wading or swimming into it, your height within its: you can't go through it (its hull is one of
      // the things you can't pass, player.extraColliders), so touching it and pressing on, you shove it off
      // at your pace, and it drifts on a little (user, 2026-10-17)
      if (player && risen >= 1) {
        const base = flood - DRAFT - 0.05, top = flood - DRAFT + 0.3;
        if (player.feet < top && player.feet + player.eye + 0.12 > base) {
          const ax = Math.sin(yaw), az = Math.cos(yaw), half = LEN / 2 - BEAM / 2;
          const t = clamp((player.pos.x - at.x) * ax + (player.pos.y - at.z) * az, -half, half);
          const dx = at.x + ax * t - player.pos.x, dz = at.z + az * t - player.pos.y, dd = Math.hypot(dx, dz) || 1e-3;
          if (dd < hull.r + 0.2 + 0.02) {
            const nx = dx / dd, nz = dz / dd, into = player.vel.x * nx + player.vel.y * nz, vn = shove.x * nx + shove.y * nz, want = into + 0.03;
            if (into > 0.05 && vn < want) { shove.x += nx * (want - vn); shove.y += nz * (want - vn); }
          }
        }
      }
      if (shove.lengthSq() > 1e-6) { // the shove dying away in the water
        if (fits(at.x + shove.x * dt, at.z + shove.y * dt, yaw)) { at.x += shove.x * dt; at.z += shove.y * dt; } else shove.set(0, 0);
        shove.multiplyScalar(Math.exp(-dt * 1.6));
        if (mode === 'wait') { rest.set(at.x, 0, at.z); stay.copy(rest); } // shoved, it goes where it is shoved, and stays there
        if (shove.lengthSq() < 1e-4) shove.set(0, 0);
      }
      // afloat: bobbing, rocking, a little sunk for the cat in it
      const load = cat.ride ? 0.01 : 0;
      boat.position.set(at.x, flood - DRAFT - load + Math.sin(time * 1.4) * 0.006 - (1 - risen) * 0.3, at.z);
      if (aground) boat.position.y = Math.max(boat.position.y, 0.001);
      // its wake: rings off the bow as it goes, now and then a soft one as it rocks where it is
      const speed = Number.isNaN(lastAt.x) ? 0 : Math.hypot(at.x - lastAt.x, at.z - lastAt.y) / Math.max(dt, 1e-3);
      lastAt.set(at.x, at.z);
      if (risen >= 1 && (wakeIn -= dt) <= 0) {
        if (speed > 0.03) {
          water.disturb(at.x + Math.sin(yaw) * HL * 0.85, at.z + Math.cos(yaw) * HL * 0.85, Math.min(0.55, 0.12 + speed * 1.6));
          wakeIn = 0.38;
        } else {
          water.disturb(at.x, at.z, 0.06);
          wakeIn = 2.5 + Math.random() * 2;
        }
      }
      const rock = aground ? 0 : 1;
      boat.rotation.set(Math.sin(time * 1.1) * 0.02 * rock, yaw, Math.sin(time * 0.9 + 1) * 0.028 * rock, 'YXZ');
      boat.updateMatrixWorld(true);
      if (cat.watching) cat.lookPoint.set(at.x, boat.position.y + 0.12, at.z); // (her eyes on it as it comes up)
      if (boat.userData.dry.visible) water.volume.dry(boat.userData.inside.map((p, i) => dryPlanes[i].copy(p).applyMatrix4(boat.matrixWorld)));
      boat.localToWorld(deck.copy(SIT));
      const fx = Math.sin(yaw) * (LEN / 2 - BEAM / 2), fz = Math.cos(yaw) * (LEN / 2 - BEAM / 2);
      Object.assign(hull, { ax: at.x - fx, az: at.z - fz, bx: at.x + fx, bz: at.z + fz, base: boat.position.y, top: boat.position.y + 0.26 });
      Object.assign(afloat, { on: risen >= 1, x: at.x, z: at.z, yaw });

      // Luna: in, along for the ride, out
      if (mode === 'wait' && lunaIn && !cat.ride && !cat.air && !cat.dive && risen >= 1 && !boarding && !aground) {
        const q = cat.queue[0];
        const far = Math.hypot(cat.pos.x - deck.x, cat.pos.z - deck.z);
        farFor = far >= 1.0 && q?.type !== 'walk' ? farFor + dt : 0; // (shoved off out of her reach, waiting where it is)
        if (q?.type !== 'jump' && far < 1.0) {
          cat.queue = [{ type: 'jump', to: [deck.x, deck.y, deck.z], arc: 0.2, board: true, yaw, reach: 1.3 }];
          cat.groom.on = false;
        } else if (stuck > 1.5 && q?.type !== 'jump' && far < 1.3) {
          // it can't get any nearer (she is in the doorway, it keeps out of the door's way): she jumps
          cat.queue = [{ type: 'jump', to: [deck.x, deck.y, deck.z], arc: 0.25, board: true, yaw, reach: 1.3 }];
          cat.groom.on = false;
        } else if ((stuck > 1.5 || (cameBy && farFor > 1)) && q?.type !== 'jump' && q?.type !== 'walk') {
          // it can't get to her where she is (or it waits out of her reach): she goes to it
          const ax = cat.pos.x - deck.x, az = cat.pos.z - deck.z, a = Math.hypot(ax, az) || 1;
          cat.queue = [{ type: 'walk', x: deck.x + (ax / a) * 0.7, z: deck.z + (az / a) * 0.7, speed: 0.5 }, { type: 'pose', pose: 'stand', dur: 30, look: 'point', watch: true }];
          stuck = farFor = 0;
        } else if (q?.type !== 'jump' && q?.type !== 'pose' && q?.type !== 'walk' && q?.type !== 'face') {
          cat.watch(watched.set(at.x, boat.position.y + 0.12, at.z)); // waiting for it, watching it
        }
      }
      if (mode === 'wait' && cat.boarded) {
        cat.boarded = false;
        cameBy = false;
        mode = 'ride';
        water.state.boost = 2; // she's in: the taps run twice as hard from now on, and up it comes
        wanderIn = 2;
        wear(true);
      }
      if (mode === 'home' && cat.ride && (d < 0.04 || (stuck > 1.5 && Math.hypot(deck.x - out.x, deck.z - out.y) < 2.4))) {
        // at the door: out she jumps, and the hat comes off
        cat.ride = null;
        wear(false);
        cat.queue = [{ type: 'jump', to: [out.x, 0, out.y], arc: 0.3, reach: 2.6 }, { type: 'pose', pose: 'stand', dur: 0.6, look: 'ahead' }];
        mode = 'wait';
      }
      if (mode === 'home' && !cat.ride) mode = 'wait';
      if (cat.ride && aground) {
        // the water gone from under it: out she jumps onto the floor, clear of it, and the hat comes off
        const [lx, lz] = landing(player);
        cat.ride = null;
        wear(false);
        cat.queue = [{ type: 'jump', to: [lx, 0, lz], arc: 0.25, reach: 2.2 }, { type: 'pose', pose: 'stand', dur: 0.6, look: 'ahead' }];
        mode = 'wait';
      }
      if (cat.ride || mode === 'ride') {
        const looking = mode === 'ride' && intent.phase !== 'go';
        cat.ride = { x: deck.x, y: deck.y, z: deck.z, yaw, look: looking ? intent.look.set(aim.x, deck.y + 0.25, aim.z) : youIn ? 'player' : 'around', stand: gear.dressing || gear.worn };
        // and nothing of her shows outside the boat: below its boards, through its sides (in her suit, her
        // coat lies flat under it, and what shows of her is inside the glass: the gear's planes, not these)
        if (!gear.worn) {
          boat.userData.inside.forEach((p, i) => cat.clips[i].copy(p).applyMatrix4(boat.matrixWorld));
          clipped = true;
        }
        if (gear.worn || gear.dressing) {
          boat.userData.inside.forEach((p, i) => gear.hull[i].copy(p).applyMatrix4(boat.matrixWorld));
          gearHulled = true;
        }
      }
    },
  };
}

/**
 * A small wooden rowing boat, a metre long: a painted clinker hull gone pale and chalky, flat across
 * the bottom with a round turn of the bilge, bare wood inside with ribs, floor boards, a seat across
 * the stern on its risers, a rubbing strake round the top, bronze rowlocks. Bow towards +z, its keel
 * on y = 0.
 */
export function rowingBoat(env = null) {
  const g = new THREE.Group();
  const L = LEN, W = BEAM, DEPTH = 0.17, rings = 48, round = 28;
  // lit as the room is: its own reflection of the bathroom (as the tiles have), not the dim house's
  const std = (o) => new THREE.MeshStandardMaterial(env ? { envMap: env, envMapIntensity: 0.35, ...o } : o);
  const halfWidth = (u) => (W / 2) * (1 - Math.pow(Math.max(0, (u - 0.45) / 0.55), 2.2)) * (1 - 0.18 * Math.max(0, (0.12 - u) / 0.12));
  const sheer = (u) => DEPTH + 0.045 * u ** 3 + 0.01 * (1 - u) ** 2; // the top edge, rising to the bow
  const keel = (u) => 0.045 * Math.max(0, (u - 0.6) / 0.4) ** 2; // the bottom rising forward
  // round the section from one top edge to the other: flat across the bottom, turning up into the sides
  const across = (s) => Math.sign(s) * Math.abs(s) ** 0.45, rise = (c) => 1 - Math.abs(c) ** 0.55;
  /** How far out from the middle the inside of the hull is at u, at height y (0 under the bottom). */
  const sideAt = (u, y) => {
    const b = keel(u), t = sheer(u);
    if (y <= b) return 0;
    const c = (1 - Math.min(1, (y - b) / (t - b))) ** (1 / 0.55);
    return halfWidth(u) * Math.sqrt(1 - c * c) ** 0.45;
  };
  const zAt = (u) => -L / 2 + u * L;
  const pos = [], uv = [], idx = [], rim = [[], []], stemLine = [];
  for (let i = 0; i <= rings; i++) {
    const u = i / rings, hw = halfWidth(u), top = sheer(u), bottom = keel(u);
    for (let j = 0; j <= round; j++) {
      const phi = -Math.PI / 2 + (j / round) * Math.PI;
      const x = hw * across(Math.sin(phi));
      const y = bottom + (top - bottom) * rise(Math.cos(phi));
      // the sides meet in a sharp stem at the bow, raked forward towards the top
      const z = zAt(u) + 0.04 * u ** 4 * ((y - bottom) / (top - bottom));
      pos.push(x, y, z);
      uv.push(u * 3, j / round);
      if (j === 0) rim[0].push(new THREE.Vector3(x, y, z));
      if (j === round) rim[1].push(new THREE.Vector3(x, y, z));
      if (i === rings && j <= round / 2) stemLine.push(new THREE.Vector3(0, y, z));
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < round; j++) {
      const a = i * (round + 1) + j, b = a + 1, c = a + round + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // the outside painted a sea blue long ago, the inside bare wood
  const paint = std({ map: T.boatPaintTex(), roughness: 0.85, side: THREE.BackSide });
  const wood = std({ map: T.woodTex('#9b7a52', '#5e4630', 391, [3, 1]), roughness: 0.8, side: THREE.FrontSide });
  for (const m of [paint, wood]) g.add(new THREE.Mesh(geo, m));
  // the stern: a flat board across the end (its inside faces +z)
  const sternPts = [];
  for (let j = 0; j <= round; j++) sternPts.push(new THREE.Vector2(pos[j * 3], pos[j * 3 + 1]));
  const sternGeo = new THREE.ShapeGeometry(new THREE.Shape(sternPts)), sternMap = T.woodTex('#8a6a46', '#54402a', 392);
  const sternIn = std({ map: sternMap, roughness: 0.8, side: THREE.FrontSide }), sternOut = std({ map: sternMap, roughness: 0.8, side: THREE.BackSide });
  for (const m of [sternIn, sternOut]) {
    const stern = new THREE.Mesh(sternGeo, m);
    stern.position.z = -L / 2;
    g.add(stern);
  }
  // the rubbing strake along each top edge, meeting at the stem
  const strake = std({ color: 0x5c3f28, roughness: 0.7 });
  for (const side of rim) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(side), 80, 0.01, 6), strake));
  // the stem: a post of the same wood up the bow, where the planks meet, running on under the keel
  for (let i = rings - 1; i >= rings * 0.7; i--) stemLine.push(new THREE.Vector3(0, keel(i / rings) - 0.002, zAt(i / rings)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stemLine), 40, 0.011, 6), strake));
  // the ends of them rounded off, so no tube is ever seen open: the top of the stem, where the strakes
  // meet it, and the strakes' ends at the stern
  for (const [p, r] of [[stemLine[0], 0.013], [rim[0][0], 0.011], [rim[1][0], 0.011], [stemLine[stemLine.length - 1], 0.011]]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), strake);
    cap.position.copy(p);
    g.add(cap);
  }
  // ribs across the inside, under the boards and up the sides to the strake
  const ribWood = std({ map: T.woodTex('#7e6040', '#4a3622', 394, [1, 1]), roughness: 0.8 });
  for (let k = 0; k < 6; k++) {
    const u = 0.17 + k * 0.13, hw = halfWidth(u), b = keel(u), t = sheer(u) - 0.01, pts = [];
    for (let j = 0; j <= 16; j++) {
      const phi = -Math.PI / 2 + (j / 16) * Math.PI, c = Math.cos(phi);
      pts.push(new THREE.Vector3((hw - 0.007) * across(Math.sin(phi)), b + 0.006 * c + (t - b) * rise(c), zAt(u)));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.005, 5), ribWood));
  }
  // floor boards, each as long as the bottom is wide enough for it
  const boards = std({ map: T.woodTex('#a68660', '#6a5034', 393, [1, 2]), roughness: 0.85 });
  for (let k = -2; k <= 2; k++) {
    const x = k * 0.06, need = Math.abs(x) + 0.032;
    let u0 = 0.5, u1 = 0.5;
    while (u0 > 0.03 && sideAt(u0 - 0.01, SIT.y - 0.012) > need) u0 -= 0.01;
    while (u1 < 0.97 && sideAt(u1 + 0.01, SIT.y - 0.012) > need) u1 += 0.01;
    const z0 = zAt(u0), z1 = zAt(u1);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.053, 0.011, z1 - z0), boards);
    b.position.set(x, SIT.y - 0.006, (z0 + z1) / 2);
    g.add(b);
  }
  // a seat across near the stern, resting on a riser along each side
  const us = 0.11, ys = sheer(us) - 0.05;
  const seatHalf = Math.min(sideAt(us - 0.05 / L - 0.005, ys), sideAt(us + 0.05 / L, ys)); // as wide as the hull is at its narrower edge
  const seat = new THREE.Mesh(new THREE.BoxGeometry(seatHalf * 2 - 0.012, 0.02, 0.1), boards);
  seat.position.set(0, ys + 0.011, zAt(us));
  g.add(seat);
  for (const side of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const u = 0.08 + k * 0.07;
      pts.push(new THREE.Vector3(side * (sideAt(u, ys - 0.01) - 0.008), ys - 0.01, zAt(u)));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.007, 5), ribWood));
  }
  // bronze rowlocks on the strake, where someone once rowed it from the seat
  const bronze = std({ color: 0x7d6038, metalness: 0.6, roughness: 0.5 });
  const ur = 0.47, ir = Math.round(ur * rings);
  for (const side of rim) {
    const p = side[ir];
    const lock = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0035, 6, 14, Math.PI), bronze);
    lock.position.set(p.x, p.y + 0.027, p.z);
    lock.rotation.set(0, Math.PI / 2, Math.PI, 'YXZ'); // a U, open at the top, across the boat
    g.add(lock);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.024, 8), bronze);
    pin.position.set(p.x, p.y + 0.002, p.z);
    g.add(pin);
  }
  // inside it is dry: a lid of nothing across the open top, just under the rubbing strake, drawn into
  // the depth only, after the boat and Luna but before the flood water (bath.js: renderOrder 2), so
  // the water is never seen through the open boat however it rocks
  const lid = [];
  for (let i = 0; i <= rings; i++) for (const side of rim) lid.push(side[i].x, side[i].y - 0.004, side[i].z);
  const lidIdx = [];
  for (let i = 0; i < rings; i++) lidIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const lidGeo = new THREE.BufferGeometry();
  lidGeo.setAttribute('position', new THREE.Float32BufferAttribute(lid, 3));
  lidGeo.setIndex(lidIdx);
  const dry = new THREE.Mesh(lidGeo, new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, side: THREE.DoubleSide }));
  dry.material.depthWrite = true;
  dry.renderOrder = 1.5; // after Luna's contact shadow (renderOrder 1)
  g.add(dry);
  g.userData.dry = dry; // gone once it is sinking
  g.userData.hull = geo.attributes.position; // its shape, to set it down on the floor
  // the room inside it, as planes facing in (cat.clips): the boards, the stern, and each side in
  // straight runs from stern to stem, each run through the inside of the hull just above the boards
  // and just under the strake, so that the planes lie within it everywhere
  const inside = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(SIT.y - 0.002)), new THREE.Plane(new THREE.Vector3(0, 0, 1), L / 2 - 0.012)];
  const stations = [0.02, 0.2, 0.4, 0.6, 0.78, 0.9, 1.0], low = SIT.y + 0.01;
  for (const s of [-1, 1]) {
    for (let k = 0; k < stations.length - 1; k++) {
      const ua = stations[k], ub = stations[k + 1], high = Math.min(sheer(ua), sheer(ub)) - 0.012;
      const p = new THREE.Plane().setFromCoplanarPoints(
        new THREE.Vector3(s * (sideAt(ua, low) - 0.004), low, zAt(ua)),
        new THREE.Vector3(s * (sideAt(ua, high) - 0.004), high, zAt(ua)),
        new THREE.Vector3(s * (sideAt(ub, high) - 0.004), high, zAt(ub)),
      );
      if (p.distanceToPoint(new THREE.Vector3(0, high, zAt((ua + ub) / 2))) < 0) p.negate();
      inside.push(p);
    }
  }
  g.userData.inside = inside;
  // afloat it is dry inside, though the water stands higher outside than its boards (bath.js volume):
  // its inside is never seen through the water, its outside always is
  for (const m of [wood, sternIn, ribWood, boards]) m.userData.waterSide = 'dry';
  for (const m of [paint, sternOut, strake]) m.userData.waterSide = 'wet';
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}

/**
 * A sou'wester, Luna's size: yellow oilskin, worn, creased and a little grimy; a crown of six panels
 * sewn into a dome with a button on top and a brass vent eyelet each side; a broad brim stitched
 * round and round in rings, its edge bound, drooping at the sides, longest at the back to keep the
 * rain off her neck, and turned up in front (user, with a photo of a fisherman's: the shape only); a
 * cotton tape under the chin, riveted to the crown. Sits on the head of the cat's rig (its front +z),
 * over her ears.
 */
export function souwester(env = null) {
  const g = new THREE.Group();
  // lit as the bathroom is, where she wears it: its own reflection of the room, not the dim house's
  const lit = env ? { envMap: env, envMapIntensity: 0.5 } : {};
  const std = (o) => new THREE.MeshStandardMaterial({ ...lit, ...o });
  const oilskin = (tex) => new THREE.MeshPhysicalMaterial({ ...lit, map: tex.map, bumpMap: tex.bump, bumpScale: 1.2, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.55, side: THREE.DoubleSide });
  const crownMat = oilskin(T.oilskinTex([0.07, 0.14], 437));
  const brimMat = oilskin(T.oilskinTex([0.1, 0.26, 0.42, 0.58, 0.74, 0.9], 431));
  const seamMat = std({ color: 0xbf9220, roughness: 0.55 });
  const brass = std({ color: 0x9c7d3c, metalness: 0.7, roughness: 0.4 });
  const smooth = (e0, e1, x) => { const k = clamp((x - e0) / (e1 - e0), 0, 1); return k * k * (3 - 2 * k); };
  const surface = (pos, uv, cols, rows) => {
    const idx = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const a = i * (rows + 1) + j, b = a + 1, c = a + rows + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };

  // ---- the crown: six panels to a dome, each bulging a little between its seams, dented with wear
  const CR = 0.0725, CH = 0.058;
  const crownAt = (a, t, out = 0) => {
    const th = (t * Math.PI) / 2;
    const dent = 1 + 0.02 * Math.sin(3 * a + 1.3) * Math.sin(t * 3.1) + 0.012 * Math.sin(7 * a + 0.4) * t * (1 - t) * 4;
    const panel = 1 + 0.012 * Math.abs(Math.sin(3 * a)) * Math.sin(t * Math.PI);
    const r = CR * Math.cos(th) ** 0.55 * dent * panel + out * Math.cos(th);
    return new THREE.Vector3(Math.sin(a) * r, CH * Math.sin(th) ** 0.9 * (1 + 0.03 * Math.sin(2 * a + 0.5) * t) + out * Math.sin(th), Math.cos(a) * r);
  };
  {
    const cols = 72, rows = 14, pos = [], uv = [];
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        const p = crownAt((i / cols) * Math.PI * 2, j / rows);
        pos.push(p.x, p.y, p.z);
        uv.push(i / cols, j / rows);
      }
    }
    g.add(new THREE.Mesh(surface(pos, uv, cols, rows), crownMat));
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, pts = [];
    for (let i = 0; i <= 12; i++) pts.push(crownAt(a, i / 12 * 0.97, 0.0006));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0017, 4), seamMat));
  }
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), crownMat);
  button.scale.y = 0.55;
  button.position.y = crownAt(0, 1).y - 0.0008;
  g.add(button);
  for (const side of [-1, 1]) {
    // a brass eyelet each side, to let the heat out
    const a = (side * Math.PI) / 2, p = crownAt(a, 0.5, 0.0004), n = crownAt(a, 0.5, 0.01).sub(p).normalize();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0034, 0.0011, 6, 16), brass);
    ring.position.copy(p);
    ring.lookAt(p.clone().add(n));
    g.add(ring);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.0026, 12), std({ color: 0x14100a, roughness: 1 }));
    hole.position.copy(p).addScaledVector(n, -0.0003);
    hole.lookAt(p.clone().add(n));
    g.add(hole);
  }

  // ---- the brim: out from the crown and down, deeper behind, except at the front, where it is
  // turned up against the crown; a little wavy all round, as oilskin goes
  const steps = 96, bands = 8, pos = [], uv = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
    const back = Math.max(0, -cz), upturn = smooth(0.18, 0.86, cz); // how far round to the front: turned up
    const width = 0.058 + 0.05 * back ** 1.3 - 0.008 * upturn; // longest at the back (−z)
    let r = CR, y = 0;
    for (let j = 0; j <= bands; j++) {
      if (j) {
        // each strip of it leans a little more: down as oilskin droops, or up, folded at the crown
        const t = (j - 0.5) / bands, seg = width / bands;
        const slope = lerp(-0.95 * Math.sqrt(t) - 0.12 * back, 0.4 + 0.85 * t, upturn);
        r += Math.cos(slope) * seg;
        y += Math.sin(slope) * seg;
      }
      const t = j / bands, wave = (0.0026 * Math.sin(5 * a + 0.7) + 0.0013 * Math.sin(13 * a + 2)) * t * t * (1 - upturn * 0.7);
      pos.push(sx * (r + 0.0012 * Math.sin(4 * a) * t), y + wave, cz * (r + 0.0012 * Math.sin(4 * a) * t));
      uv.push(i / steps, t);
    }
  }
  g.add(new THREE.Mesh(surface(pos, uv, steps, bands), brimMat));
  // where brim and crown are sewn together, and the bound edge of the brim
  const join = [], edge = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    join.push(new THREE.Vector3(Math.sin(a) * (CR + 0.0008), 0.0012, Math.cos(a) * (CR + 0.0008)));
    const k = i * (bands + 1) + bands;
    edge.push(new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]));
  }
  join.pop();
  edge.pop();
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(join, true), 120, 0.0022, 5, true), seamMat));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true), 160, 0.003, 6, true), seamMat));

  // ---- the chin tape, riveted to the crown each side, down under her chin
  const tape = std({ color: 0x3b3024, roughness: 0.92, side: THREE.DoubleSide });
  const chin = new THREE.CatmullRomCurve3([[-0.069, 0.008, 0.0], [-0.068, -0.03, 0.01], [-0.055, -0.078, 0.025], [0, -0.106, 0.04], [0.055, -0.078, 0.025], [0.068, -0.03, 0.01], [0.069, 0.008, 0.0]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  {
    const tp = [], tuv = [], n = 40;
    for (let i = 0; i <= n; i++) {
      const p = chin.getPoint(i / n);
      tp.push(p.x, p.y, p.z - 0.0045, p.x, p.y, p.z + 0.0045);
      tuv.push(i / n, 0, i / n, 1);
    }
    g.add(new THREE.Mesh(surface(tp, tuv, n, 1), tape));
  }
  for (const side of [-1, 1]) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.002, 10), brass);
    rivet.rotation.z = Math.PI / 2;
    rivet.position.set(side * 0.0745, 0.008, 0);
    g.add(rivet);
  }

  g.position.set(0, 0.043, -0.004);
  g.rotation.x = -0.14; // pushed back a little on her head
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
}

/**
 * Luna's diving gear (user, 2026-10-15, with a picture of how it should be worn: the look only). A dark
 * petrol-blue wetsuit that follows her own shape — her body, chest and full tail as her coat makes them,
 * only pressed in a little — legs sleeved to orange cuffs above her bare black paws; orange piping along
 * her back and flanks, down her legs and along her tail; a grey harness holding a yellow tank on her
 * back, a hose round to the regulator at the front of the collar. Her head stays where it always is:
 * the glass bubble sits on her shoulders round it, the suit coming up to its rim, where the orange
 * collar follows the suit's own neckline; inside, her head and the fur of her chest, dry. Returns
 * `on(bool)`, `worn`, and `update()` for every frame.
 */
function diveGear(cat, env = null, scene = null, water = null) {
  const R = cat.rig;
  // lit as the bathroom is, where she wears it: its own reflection of the room, not the dim house's
  const std = (o) => new THREE.MeshStandardMaterial(env ? { envMap: env, envMapIntensity: 0.55, ...o } : o);
  const fabric = T.noiseBump(441, [8, 8]);
  const NEO = 0x285a66;
  const neo = std({ color: NEO, roughness: 0.58, bumpMap: fabric, bumpScale: 0.22 });
  const orange = std({ color: 0xc8611f, roughness: 0.5 });
  const strapMat = std({ color: 0x3b3e42, roughness: 0.75, side: THREE.DoubleSide });
  const black = std({ color: 0x141518, roughness: 0.6 });
  const yellow = std({ color: 0xe0b51f, roughness: 0.35, metalness: 0.15 });
  const steel = std({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.85 });
  const glass = new THREE.MeshPhysicalMaterial({ ...(env ? { envMap: env, envMapIntensity: 1 } : {}), color: 0xe8f1f3, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.DoubleSide, depthWrite: false });
  const extras = new THREE.Group(); // everything added, on her spine
  const bits = []; // and the pieces hung on her legs
  const keep = (o) => { o.castShadow = false; o.receiveShadow = true; return o; };
  const tube = (pts, r, mat, closed = false, n = 60) => keep(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), n, r, 8, closed), mat));
  const mesh = (pos, uv, idx, mat) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return keep(new THREE.Mesh(geo, mat));
  };

  // ---- what changes on her: under the suit her fur lies flat (hidden) and her body, legs and tail are
  // the suit's; her head, ears, paws and chest stay (the chest only shows inside the bubble)
  const underHead = (o) => { for (let p = o; p; p = p.parent) if (p === R.head) return true; return false; };
  const chestParts = new Set();
  R.chest.traverse((o) => { if (o.isMesh) chestParts.add(o); });
  const changes = [];
  R.root.traverse((o) => {
    if (!o.isMesh || o === R.blob || underHead(o) || chestParts.has(o) || R.legs.some((L) => L.paw === o)) return;
    if (o.isInstancedMesh || o.userData.fluff !== undefined || (o.geometry.type === 'TorusGeometry' && o.parent === R.spine)) changes.push({ o });
  });
  for (const c of changes) c.was = c.o.visible;
  // her bare paws are outside the bubble: they must not be cut away with the rest of her by the planes
  // that keep her inside it (cat.clips), so while she wears the suit they have their own material
  const pawMats = R.legs.map(() => R.legs[0].paw.material.clone()); // (each gets its own cut, below)
  const pawWas = R.legs.map((L) => L.paw.material);

  // ---- her shape as her coat makes it (cat.js: the body, haunches and chest, each its size plus most
  // of its fur, the fur hanging a little), pressed in a little by the suit
  const PRESS = 0.8;
  const parts = [
    { c: [0, -0.006, 0.15], r: [0.082, 0.08, 0.19], fur: 0.046 },
    { c: [0, -0.012, 0.01], r: [0.086, 0.084, 0.09], fur: 0.056 },
    { c: [0, -0.014, 0.285], r: [0.076, 0.078, 0.075], fur: 0.062 },
  ].map(({ c, r, fur }) => ({ c, r: r.map((v) => v + fur * PRESS) }));
  const Z0 = Math.min(...parts.map((p) => p.c[2] - p.r[2])), Z1 = Math.max(...parts.map((p) => p.c[2] + p.r[2]));
  // across, up and down at each step along her: the outline of all three together, smoothed where they meet
  const N = 120, Ws = [], Ts = [], Bs = [];
  for (let i = 0; i <= N; i++) {
    const z = Z0 + ((Z1 - Z0) * i) / N;
    let w = 0, top = -1, bot = 1;
    for (const p of parts) {
      const f = 1 - ((z - p.c[2]) / p.r[2]) ** 2;
      if (f <= 0) continue;
      const k = Math.sqrt(f);
      w = Math.max(w, p.r[0] * k);
      top = Math.max(top, p.c[1] + p.r[1] * k);
      bot = Math.min(bot, p.c[1] - p.r[1] * k);
    }
    Ws.push(w); Ts.push(top > bot ? top : 0); Bs.push(top > bot ? bot : 0);
  }
  for (let pass = 0; pass < 6; pass++) {
    for (const A of [Ws, Ts, Bs]) {
      const B = A.slice();
      for (let i = 2; i < N - 1; i++) A[i] = 0.25 * B[i - 1] + 0.5 * B[i] + 0.25 * B[i + 1];
    }
  }
  const at = (A, z) => {
    const f = clamp(((z - Z0) / (Z1 - Z0)) * N, 0, N), i = Math.min(N - 1, Math.floor(f));
    return lerp(A[i], A[i + 1], f - i);
  };
  const EXP = 2.15; // a little fuller than ellipses, as a coat is
  const sgnPow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
  /** The suit at z, round at angle a (0 on top, π/2 her left, π underneath), pushed out by `out`. */
  const body = (z, a, out = 0) => {
    const w = Math.max(0, at(Ws, z)), t = at(Ts, z), b = at(Bs, z), h = Math.max(0, (t - b) / 2), c = (t + b) / 2;
    return new THREE.Vector3(sgnPow(Math.sin(a), 2 / EXP) * (w + out), c + sgnPow(Math.cos(a), 2 / EXP) * (h + out), z);
  };
  const inSuit = (p) => {
    const w = at(Ws, p.z), t = at(Ts, p.z), b = at(Bs, p.z), h = (t - b) / 2, c = (t + b) / 2;
    return p.z > Z0 && p.z < Z1 && w > 0 && h > 0 && Math.abs(p.x / w) ** EXP + Math.abs((p.y - c) / h) ** EXP <= 1;
  };

  // ---- the bubble and where the suit meets it: centred where her head turns (it holds all of her head
  // whichever way she looks), its rim on a plane across her shoulders, sloping down to the front of her
  // chest; the suit stops at that plane, and the collar runs along the suit's neckline there
  const pivot = new THREE.Vector3(0, 0.065 + POSE_HEAD.lift, 0.36 + POSE_HEAD.fwd);
  const RB = 0.145, OFF = 0.079; // the bubble's radius; how far below where her head turns the rim's plane is
  const n = new THREE.Vector3(0, -0.785, -0.62).normalize(); // out of the bubble through its rim: down and back
  const ringCentre = pivot.clone().addScaledVector(n, OFF);
  const e1 = new THREE.Vector3(1, 0, 0), e2 = new THREE.Vector3(0, -n.z, n.y).negate(); // across the rim: her left, and forward-down
  const dirAt = (phi) => e1.clone().multiplyScalar(Math.cos(phi)).addScaledVector(e2, Math.sin(phi));
  // the neckline: how far out the suit is from the rim's centre, all the way round
  const RIM = 96, neckR = [];
  for (let j = 0; j <= RIM; j++) {
    const d = dirAt((j / RIM) * Math.PI * 2);
    let lo = 0, hi = 0.3;
    for (let k = 0; k < 26; k++) { const m = (lo + hi) / 2; if (inSuit(ringCentre.clone().addScaledVector(d, m))) lo = m; else hi = m; }
    neckR.push(lo);
  }
  const neckAt = (phi) => { const f = (((phi / (Math.PI * 2)) % 1) + 1) % 1 * RIM, i = Math.floor(f); return lerp(neckR[i], neckR[i + 1], f - i); };
  // the suit is cut there (a clip plane, in her spine's frame, carried into the world every frame)
  const suitCut = new THREE.Plane(n.clone(), -(n.dot(pivot) + OFF)); // keeps what is out of the bubble
  const suitCutWorld = new THREE.Plane();
  const torsoMat = neo.clone();
  torsoMat.clippingPlanes = [suitCutWorld];
  torsoMat.side = THREE.DoubleSide; // looking down through the collar, the inside of it, not a hole

  // ---- the suit's body: one smooth piece from her rump to her chest
  {
    const rings = 90, round = 56, pos = [], uv = [], idx = [];
    for (let i = 0; i <= rings; i++) {
      const v = i / rings, z = Z0 + (Z1 - Z0) * (0.5 - 0.5 * Math.cos(v * Math.PI)); // closer rings at the rounded ends
      for (let j = 0; j <= round; j++) {
        const p = body(z, (j / round) * Math.PI * 2);
        pos.push(p.x, p.y, p.z);
        uv.push(j / round, v);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < round; j++) {
      const a = i * (round + 1) + j, b = a + 1, c = a + round + 1, d = c + 1;
      idx.push(a, c, b, b, c, d); // facing out
    }
    extras.add(mesh(pos, uv, idx, torsoMat));
  }
  // orange piping, two lines down each side (user): from the collar, where the suit meets the bubble,
  // back along her to the root of her tail
  const seam = (fn, steps = 70) => {
    const pts = [];
    for (let i = 0; i <= steps; i++) { const [z, a] = fn(i / steps); pts.push(body(z, a, 0.0018)); }
    extras.add(tube(pts, 0.0028, orange, false, steps * 2));
  };
  /** Where on the suit (z, and the angle round it) a point on its surface is. */
  const onSuit = (p) => {
    const w = at(Ws, p.z), t = at(Ts, p.z), b = at(Bs, p.z), h = (t - b) / 2, c = (t + b) / 2;
    return [p.z, Math.atan2(sgnPow(clamp(p.x / w, -1, 1), EXP / 2), sgnPow(clamp((p.y - c) / h, -1, 1), EXP / 2))];
  };
  const tailRoot = Z0 + 0.03;
  for (const side of [-1, 1]) {
    for (const [phi, end] of [[-0.55, 0.6], [0.5, 1.0]]) {
      const ph = side > 0 ? phi : Math.PI - phi; // the same place on her other side
      const [z0, a0] = onSuit(ringCentre.clone().addScaledVector(dirAt(ph), neckAt(ph)));
      seam((t) => [lerp(z0, tailRoot, t), lerp(a0, side * end, t * t * (3 - 2 * t))]);
    }
  }

  // ---- the collar along the neckline, the glass's dark clamp on it, and the bubble
  const collarPts = [], clampPts = [];
  for (let j = 0; j < RIM; j++) {
    const phi = (j / RIM) * Math.PI * 2, d = dirAt(phi), r = neckAt(phi);
    collarPts.push(ringCentre.clone().addScaledVector(d, r + 0.004));
    clampPts.push(ringCentre.clone().addScaledVector(d, r + 0.003).addScaledVector(n, -0.016));
  }
  extras.add(tube(collarPts, 0.013, orange, true, 160));
  extras.add(tube(clampPts, 0.0055, black, true, 160));
  {
    // a sphere round her head, down to the rim's plane, its very edge drawn in to sit on the collar
    const u = n.clone().negate(), cut = Math.PI - Math.acos(OFF / RB), rows = 44, cols = 96, pos = [], idx = [];
    for (let i = 0; i <= rows; i++) {
      const th = (cut * i) / rows, edge = THREE.MathUtils.smoothstep(th, cut - 0.4, cut);
      for (let j = 0; j <= cols; j++) {
        const phi = (j / cols) * Math.PI * 2, d = dirAt(phi);
        const p = pivot.clone().addScaledVector(u, RB * Math.cos(th)).addScaledVector(d, RB * Math.sin(th));
        // where the plain sphere's rim would be, and where the collar is: drawn across to it near the edge
        const sphereRim = ringCentre.clone().addScaledVector(d, Math.sqrt(RB * RB - OFF * OFF));
        const collarRim = ringCentre.clone().addScaledVector(d, neckAt(phi) + 0.004).addScaledVector(n, -0.01);
        p.addScaledVector(collarRim.sub(sphereRim), edge);
        pos.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const bubble = mesh(pos, null, idx, glass);
    bubble.renderOrder = 1.8; // under the water's surface, which is drawn after it
    extras.add(bubble);
  }
  // inside it nothing of her reaches the glass: what of her chest fur and head would is cut away by
  // planes a little inside it (cat.clips): the top, two rings round, and the rim's plane
  const insideBubble = [];
  {
    const u = n.clone().negate(), RIN = 0.128;
    const dirs = [u.clone()];
    for (const [pol, off] of [[0.87, 0], [1.66, Math.PI / 6]]) {
      for (let k = 0; k < 6; k++) dirs.push(u.clone().multiplyScalar(Math.cos(pol)).addScaledVector(dirAt(off + (k / 6) * Math.PI * 2), Math.sin(pol)));
    }
    for (const d of dirs) insideBubble.push(new THREE.Plane(d.clone().negate(), d.dot(pivot) + RIN));
    insideBubble.push(new THREE.Plane(n.clone().negate(), n.dot(pivot) + OFF)); // the rim's plane
    // just over the rim the glass is drawn in to the collar, and the planes above leave a gap there that
    // her chest fur came out through (user, 2026-10-16: a tuft out of her neck at the orange joint): a
    // ring of planes from inside the collar up to where the glass starts to draw in
    const cut = Math.PI - Math.acos(OFF / RB), th1 = cut - 0.45;
    for (let k = 0; k < 10; k++) {
      const phi = (k / 10) * Math.PI * 2, d = dirAt(phi), t = new THREE.Vector3().crossVectors(n, d);
      const a = ringCentre.clone().addScaledVector(d, neckAt(phi) + 0.002).addScaledVector(n, -0.012);
      const b = pivot.clone().addScaledVector(u, RIN * Math.cos(th1)).addScaledVector(d, RIN * Math.sin(th1));
      const out = new THREE.Vector3().crossVectors(b.sub(a), t).normalize();
      if (out.dot(d) < 0) out.negate();
      insideBubble.push(new THREE.Plane(out.clone().negate(), out.dot(a)));
    }
  }

  // ---- the regulator at the front of the collar
  const front = e2.clone();
  const regAt = ringCentre.clone().addScaledVector(front, neckAt(Math.PI / 2) + 0.02);
  const reg = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.018, 0.026, 24), steel));
  reg.position.copy(regAt);
  reg.quaternion.setFromUnitVectors(UP, front);
  extras.add(reg);
  const regFace = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 20), black));
  regFace.position.copy(regAt).addScaledVector(front, 0.015);
  regFace.quaternion.copy(reg.quaternion);
  extras.add(regFace);

  // ---- the tank on her back, on a grey harness round her
  const TR = 0.034, TL = 0.2, tankZ = 0.07, tankY = body(tankZ, 0).y + TR + 0.004;
  const prof = [];
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * (Math.PI / 2); prof.push(new THREE.Vector2(Math.sin(a) * TR, -TL / 2 + TR - Math.cos(a) * TR)); }
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * (Math.PI / 2); prof.push(new THREE.Vector2(Math.cos(a) * TR, TL / 2 - TR + Math.sin(a) * TR)); }
  const tank = keep(new THREE.Mesh(new THREE.LatheGeometry(prof, 40), yellow));
  tank.rotation.x = Math.PI / 2; // its length along her, its top forward
  tank.position.set(0, tankY, tankZ);
  extras.add(tank);
  const footProf = prof.slice(0, 11).map((v) => new THREE.Vector2(v.x * 1.012, v.y));
  footProf.push(new THREE.Vector2(TR * 1.012, -TL / 2 + TR + 0.022)); // its foot painted black
  const foot = keep(new THREE.Mesh(new THREE.LatheGeometry(footProf, 40), black));
  foot.rotation.x = Math.PI / 2;
  foot.position.copy(tank.position);
  extras.add(foot);
  for (const z of [tankZ - 0.045, tankZ + 0.035]) {
    const band = keep(new THREE.Mesh(new THREE.CylinderGeometry(TR + 0.0015, TR + 0.0015, 0.016, 40, 1, true), black));
    band.rotation.x = Math.PI / 2;
    band.position.set(0, tankY, z);
    extras.add(band);
  }
  const valve = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.024, 16), steel));
  valve.rotation.x = Math.PI / 2;
  valve.position.set(0, tankY, tankZ + TL / 2 + 0.01);
  extras.add(valve);
  const knob = keep(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 20), black));
  knob.position.set(0, tankY + 0.016, tankZ + TL / 2 + 0.012);
  extras.add(knob);
  for (const z of [0.02, 0.13]) {
    // a flat strap round her, lying on the suit, and up over the tank
    const n2 = 96, pos = [], idx = [], on = (a, dz) => {
      const p = body(z + dz, a, 0.0025);
      if (Math.abs(p.x) < TR + 0.012 && Math.cos(a) > 0) p.y = Math.max(p.y, tankY + Math.sqrt(Math.max(0, (TR + 0.003) ** 2 - Math.min(p.x * p.x, TR * TR))));
      return p;
    };
    for (let i = 0; i <= n2; i++) for (const dz of [-0.008, 0.008]) { const p = on((i / n2) * Math.PI * 2, dz); pos.push(p.x, p.y, p.z); }
    for (let i = 0; i < n2; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    extras.add(mesh(pos, null, idx, strapMat));
  }
  // the hose, from the valve down her right side, round to the regulator
  extras.add(tube([
    new THREE.Vector3(0.008, tankY + 0.006, tankZ + TL / 2 + 0.024), new THREE.Vector3(0.09, tankY - 0.02, tankZ + TL / 2 + 0.04),
    new THREE.Vector3(0.145, 0.0, 0.29), new THREE.Vector3(0.1, regAt.y - 0.012, regAt.z - 0.035), regAt.clone().add(new THREE.Vector3(0.018, 0, 0)),
  ], 0.0055, black, false, 60));

  // ---- her legs: a sleeve down each, as full as her furred leg, from the joint (inside her body)
  // down to the ankle, where it goes into an orange cuff drawn tight round the top of her bare paw
  // (user: no suit below the cuff, no gap between cuff and paw); piping down its front. In the leg's
  // frame its length runs 0 at the joint to −1 at its end, and every frame that end is set at the cuff
  // (place); across it is metres.
  const ANKLE = 0.024, CUFF_Y = 0.011; // the sleeve's end; the cuff's height above the middle of the paw
  const sleeveRadius = (r0, y) => (y > -0.15 ? r0 : y > -0.45 ? r0 * (1 - 0.45 * (-0.15 - y)) : y > -0.85 ? lerp(r0 * 0.865, 0.031, (-0.45 - y) / 0.4) : lerp(0.031, ANKLE, (-0.85 - y) / 0.15));
  const SLEEVE_Y = [-1, -0.96, -0.9, -0.85, -0.75, -0.62, -0.5, -0.38, -0.25, -0.12, 0]; // up the leg: its outside faces out
  const sleeveGeo = (r0) => new THREE.LatheGeometry([new THREE.Vector2(0, -1), ...SLEEVE_Y.map((y) => new THREE.Vector2(sleeveRadius(r0, y), y))], 32); // closed at its end
  const geos = { true: sleeveGeo(0.05), false: sleeveGeo(0.054) };
  // the cuff: round the paw's own outline at that height, a little to the back where the sleeve comes
  // down into it (the paw's middle is forward of the leg), so it holds both close
  const paw = { x: 0.027, y: 0.02, z: 0.034 }, at_ = Math.sqrt(1 - (CUFF_Y / paw.y) ** 2);
  const cuffPts = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    cuffPts.push(new THREE.Vector3(Math.cos(a) * (paw.x * at_ + 0.004), CUFF_Y, -0.006 + Math.sin(a) * (paw.z * at_ + 0.004)));
  }
  const cuffGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cuffPts, true), 56, 0.0055, 8, true);
  const sleeves = [];
  for (const L of R.legs) {
    const r0 = L.front ? 0.05 : 0.054;
    const sleeve = keep(new THREE.Mesh(geos[L.front], neo));
    L.limb.add(sleeve);
    bits.push(sleeve);
    sleeves.push({ sleeve, L });
    const line = keep(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([-0.6, -0.72, -0.84, -0.94].map((y) => new THREE.Vector3(0, y, sleeveRadius(r0, y) + 0.0012))), 16, 0.0026, 6), orange));
    sleeve.add(line);
    const cuff = keep(new THREE.Mesh(cuffGeo, orange));
    L.paw.add(cuff);
    bits.push(cuff);
  }
  // and nothing of the paw above the cuff: each paw cut off there (its own clip plane, in the paw's
  // frame, carried into the world every frame), so the suit covers all of the leg down to the cuff
  const pawTops = R.legs.map(() => new THREE.Plane());
  const pawCut = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUFF_Y);
  pawMats.forEach((m, i) => { m.clippingPlanes = [pawTops[i]]; m.side = THREE.DoubleSide; }); // (its inside showing where it is cut: black, no hole)
  const fitSleeves = () => {
    // the paw sits 0.014 above the foot of the leg: the sleeve ends where the cuff is
    for (const { sleeve, L } of sleeves) sleeve.scale.y = Math.max(0.1, (L.limb.scale.y - 0.014 - CUFF_Y) / L.limb.scale.y);
    R.legs.forEach((L, i) => pawTops[i].copy(pawCut).applyMatrix4(L.paw.matrixWorld));
  };

  // ---- her tail, sleeved: as full as her furred tail, bending as it does, an orange stripe along its top
  const TAIL_RINGS = 48, TAIL_ROUND = 24;
  const stripe = (() => {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 8;
    const g = c.getContext('2d');
    g.fillStyle = '#' + NEO.toString(16).padStart(6, '0');
    g.fillRect(0, 0, 128, 8);
    g.fillStyle = '#c8611f';
    g.fillRect(0, 0, 3, 8);
    g.fillRect(125, 0, 3, 8);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  })();
  const tailMat = std({ map: stripe, roughness: 0.58, bumpMap: fabric, bumpScale: 0.22 });
  const tailPos = new Float32Array((TAIL_RINGS + 1) * (TAIL_ROUND + 1) * 3), tailUv = [], tailIdx = [];
  for (let i = 0; i <= TAIL_RINGS; i++) for (let j = 0; j <= TAIL_ROUND; j++) tailUv.push(j / TAIL_ROUND, i / TAIL_RINGS);
  for (let i = 0; i < TAIL_RINGS; i++) for (let j = 0; j < TAIL_ROUND; j++) {
    const a = i * (TAIL_ROUND + 1) + j, b = a + 1, c = a + TAIL_ROUND + 1, d = c + 1;
    tailIdx.push(a, b, c, b, d, c); // facing out
  }
  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute('position', new THREE.BufferAttribute(tailPos, 3));
  tailGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tailUv, 2));
  tailGeo.setIndex(tailIdx);
  const tail = keep(new THREE.Mesh(tailGeo, tailMat));
  tail.frustumCulled = false;
  extras.add(tail);
  // how full her tail is along it, as her coat makes it (cat.js: each plume 0.019 + its fur), pressed in
  const plume = [0.92, 1, 1, 1, 0.92, 0.78, 0.55].map((k) => 0.019 + 0.058 * k * 0.72); // pressed in a little more than her body
  const fullness = (t) => {
    const f = t * (plume.length - 1), i = Math.min(plume.length - 2, Math.floor(f));
    const r = lerp(plume[i], plume[i + 1], f - i);
    return t > 0.9 ? r * Math.sqrt(Math.max(0, 1 - ((t - 0.9) / 0.1) ** 2)) : r; // rounded off, closed, at the tip
  };
  const joints = Array.from({ length: R.tail.length + 1 }, () => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(joints);
  const M = new THREE.Matrix4(), P = new THREE.Vector3(), Tn = new THREE.Vector3(), Nn = new THREE.Vector3(), Bn = new THREE.Vector3();
  const shapeTail = () => {
    M.identity();
    R.tail.forEach((seg, i) => {
      seg.updateMatrix();
      M.multiply(seg.matrix);
      joints[i].set(0, 0, -0.012).applyMatrix4(M);
    });
    joints[R.tail.length].set(0, 0, -0.07).applyMatrix4(M);
    curve.updateArcLengths();
    for (let i = 0; i <= TAIL_RINGS; i++) {
      const t = i / TAIL_RINGS;
      curve.getPointAt(t, P);
      curve.getTangentAt(t, Tn);
      Nn.set(0, 1, 0).addScaledVector(Tn, -Tn.y);
      if (Nn.lengthSq() < 1e-6) Nn.set(1, 0, 0);
      Nn.normalize();
      Bn.crossVectors(Tn, Nn);
      const r = fullness(t);
      for (let j = 0; j <= TAIL_ROUND; j++) {
        const a = (j / TAIL_ROUND) * Math.PI * 2, k = (i * (TAIL_ROUND + 1) + j) * 3;
        tailPos[k] = P.x + r * (Math.cos(a) * Nn.x + Math.sin(a) * Bn.x);
        tailPos[k + 1] = P.y + r * (Math.cos(a) * Nn.y + Math.sin(a) * Bn.y);
        tailPos[k + 2] = P.z + r * (Math.cos(a) * Nn.z + Math.sin(a) * Bn.z);
      }
    }
    tailGeo.attributes.position.needsUpdate = true;
    tailGeo.computeVertexNormals();
  };

  // ---- in her boat, nothing of the suit or her paws outside it, as with her coat (cat.clips): the hull's
  // inside planes, set by the boat while she rides (`hull`; far off otherwise) — standing in it, the suit
  // would go down through its boards and her tail out through its side
  const swept = new Set();
  for (const root of [extras, ...bits]) root.traverse((o) => { if (o.isMesh && o.material !== glass) swept.add(o.material); });
  const hull = Array.from({ length: 16 }, () => new THREE.Plane(UP.clone(), 1e4)); // (the boat has 14)
  for (const m of swept) m.clippingPlanes = [...(m.clippingPlanes ?? []), ...hull];
  pawMats.forEach((m) => { m.clippingPlanes = [...m.clippingPlanes, ...hull]; });
  // putting it on (user, 2026-10-17): on her feet in the boat first, then it is on, all at once (suitUp)
  const STAND = 0.7; // s: getting up before it is on
  let dressT = -1, since = 0;

  R.spine.add(extras);
  extras.visible = false;
  for (const b of bits) b.visible = false;
  // ---- bubbles from the regulator: a breath out every couple of seconds; they run up round the glass,
  // never through it, and are gone at the surface
  const dome = new THREE.Vector3(), away = new THREE.Vector3(), mouth = new THREE.Vector3(), jitter = new THREE.Vector3();
  const breath_ = scene ? bubbleField(scene, 32, () => water?.flood ?? 9, (p) => {
    away.copy(p).sub(dome);
    const reach = RB + 0.009;
    if (away.length() >= reach) return false;
    p.copy(dome).add(away.setLength(reach));
    return true;
  }) : null;
  let breath = 1.2, puff = 0, puffGap = 0;
  const breathe = (dt) => {
    if (!breath_) return;
    R.spine.localToWorld(dome.copy(pivot)); // the middle of the glass
    if ((breath -= dt) <= 0) { breath = 1.8 + Math.random() * 1.8; puff = 4 + Math.floor(Math.random() * 5); }
    if (puff > 0 && (puffGap -= dt) <= 0) {
      regFace.getWorldPosition(mouth);
      breath_.emit(mouth.add(jitter.set((Math.random() - 0.5) * 0.01, 0.005, (Math.random() - 0.5) * 0.01)), 0.005 + Math.random() * 0.011);
      puff--;
      puffGap = 0.05 + Math.random() * 0.08;
    }
    breath_.update(dt);
  };

  const place = () => {
    // the planes carried into the world as she moves: the suit's cut at the rim, and the bubble's inside
    R.root.updateMatrixWorld(true);
    suitCutWorld.copy(suitCut).applyMatrix4(R.spine.matrixWorld);
    insideBubble.forEach((p, i) => cat.clips[i].copy(p).applyMatrix4(R.spine.matrixWorld));
    shapeTail();
    fitSleeves();
  };

  const state = {
    worn: false,
    hull,
    /** Her paws' own materials while it is on (main.js: given the bathroom's water and readied with the rest, before the game). */
    paws: pawMats,
    /** Putting it on, in her boat (suitUp): `worn` once it is all on. */
    get dressing() { return dressT >= 0; },
    update(dt = 0) {
      if (dressT >= 0 && (dressT += dt) >= STAND) { dressT = -1; state.on(true); } // up, and on it is
      since = state.worn ? since + dt : 0;
      if (state.worn) { place(); breathe(dt); }
      else breath_?.clear();
    },
    /** How long it has been on. */
    get since() { return since; },
    /** Put it on, in her boat before she jumps: she gets up (`dressing`), then it is on, all at once. */
    suitUp() {
      if (state.worn || dressT >= 0) return;
      dressT = 0;
    },
    on(wear) {
      if (!wear && dressT >= 0) { dressT = -1; return; } // not on yet: never mind
      if (wear === state.worn) return;
      state.worn = wear;
      for (const c of changes) c.o.visible = wear ? false : c.was;
      R.legs.forEach((L, i) => { L.paw.material = wear ? pawMats[i] : pawWas[i]; });
      extras.visible = wear;
      for (const b of bits) b.visible = wear;
      if (wear) {
        cat.pose.headLift = POSE_HEAD.lift;
        cat.pose.headFwd = POSE_HEAD.fwd;
        place();
      } else for (const p of cat.clips) p.set(UP, 1e4);
    },
  };
  return state;
}

/**
 * Poof (user, 2026-11-02: cartoonish, not real vapour; not one cloud but little clouds all round — the classic
 * cartoon of something vanishing): small round puffs drawn as a cartoon draws them — white, a grey shade under each
 * lump, a grey outline — pop up all round her (`start(root)`, her rig's root), one a moment after another, swelling
 * with a little overshoot, drifting out, then shrinking away to nothing; no two alike. Seen by the room's light
 * (`light()`), as the bath's steam is.
 */
function poofCloud(scene, light) {
  const looks = Array.from({ length: 4 }, () => canvasTex(128, 128, (g, w, h) => {
    const lumps = [[w / 2, h / 2 + 4, w * (0.2 + Math.random() * 0.04)]], n = 5 + Math.floor(Math.random() * 3), a0 = Math.random() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5, d = w * (0.16 + Math.random() * 0.05);
      lumps.push([w / 2 + Math.cos(a) * d, h / 2 + 4 + Math.sin(a) * d * 0.8, w * (0.12 + Math.random() * 0.07)]);
    }
    const all = (grow, style, dx = 0, dy = 0, k = 1) => {
      g.fillStyle = style;
      for (const [x, y, r] of lumps) { g.beginPath(); g.arc(x + dx * r, y + dy * r, r * k + grow, 0, Math.PI * 2); g.fill(); }
    };
    g.clearRect(0, 0, w, h);
    all(3.5, '#8d8982'); // the outline
    all(0, '#cfcac1'); // the shade, under each lump…
    g.save();
    g.beginPath();
    for (const [x, y, r] of lumps) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
    g.clip();
    all(0, '#f4f2ed', -0.08, -0.16, 0.95); // …the white over it, a little up and to the left
    g.restore();
  }));
  const puffs = Array.from({ length: 15 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: looks[i % 4], alphaTest: 0.5 }));
    m.material.userData.noVolume = true;
    m.visible = false;
    m.userData.p = { t: 9, delay: 0, grow: 0.12, fade: 0.4, life: 0.8, size: 0.15, v: new THREE.Vector3(), spin: 0 };
    scene.add(m);
    return m;
  });
  const back = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2; // (out a little past it, and back)
  const at = new THREE.Vector3(), out = new THREE.Vector3(), mid = new THREE.Vector3();
  let live = false;
  return {
    start(root) {
      root.updateMatrixWorld(true);
      root.localToWorld(mid.set(0, 0.2, 0.05));
      puffs.forEach((m, i) => {
        const p = m.userData.p, top = i >= 12; // a ring round her, and a few over her back
        const a = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        if (top) at.set((Math.random() - 0.5) * 0.14, 0.36 + Math.random() * 0.1, -0.1 + (i - 12) * 0.14 + (Math.random() - 0.5) * 0.06);
        else at.set(Math.cos(a) * 0.17 * (0.85 + Math.random() * 0.3), 0.08 + Math.random() * 0.26, 0.05 + Math.sin(a) * 0.32 * (0.85 + Math.random() * 0.3));
        root.localToWorld(at);
        out.subVectors(at, mid).setY(0.3 * Math.random()).normalize();
        Object.assign(p, { t: 0, delay: Math.random() * 0.09, grow: 0.1 + Math.random() * 0.06, fade: 0.32 + Math.random() * 0.2, size: 0.12 + Math.random() * 0.1, spin: (Math.random() - 0.5) * 2 });
        p.life = p.fade + 0.2 + Math.random() * 0.15;
        at.y = Math.max(at.y, root.position.y + p.size * 0.62); // (popped up past its size, none of it down through the floor)
        p.v.copy(out).multiplyScalar(0.25 + Math.random() * 0.2);
        m.position.copy(at);
        m.visible = false;
      });
      live = true;
    },
    update(dt, camera) {
      if (!live) return;
      live = false;
      const seen = light();
      for (const m of puffs) {
        const p = m.userData.p;
        if (p.t >= p.delay + p.life) { m.visible = false; continue; }
        live = true;
        p.t += dt;
        const t = p.t - p.delay;
        if (t < 0) continue;
        p.v.multiplyScalar(Math.exp(-dt * 3));
        m.position.addScaledVector(p.v, dt);
        // popping up, past its size and back; then shrinking away to nothing
        const k = t < p.grow ? back(t / p.grow) : 1 - THREE.MathUtils.smoothstep(t, p.fade, p.life);
        const s = Math.max(1e-3, p.size * k);
        m.scale.set(s, s, 1);
        m.visible = k > 0.01;
        if (camera) m.quaternion.copy(camera.quaternion);
        m.rotateZ(p.spin * t);
        m.material.color.setScalar(Math.min(1, seen));
      }
    },
  };
}
