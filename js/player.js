// First-person walker: the view follows the mouse (no dragging), WASD, jumping, and collision
// with furniture — some of which (colliders marked `stand`) can be jumped onto and walked on.
import * as THREE from 'three';

// The player is an 8-year-old, so the eyes sit well below adult height (metres).
const EYE = 1.22, EYE_CROUCH = 0.78, RADIUS = 0.2;
const WALK = 1.7, RUN = 2.9, CROUCH = 0.9;
const JUMP = 2.3, GRAVITY = 9.8; // a kid's hop: about a quarter of a metre
// Next to something climbable the same key becomes a scramble up onto it.
const CLIMB_MIN = 0.3, CLIMB_MAX = 0.95, CLIMB_REACH = 0.25, CLIMB_CLEAR = 0.1;
const CLIMB_TOWARD = 0.4; // m/s you must be going towards it at for the jump to be a scramble up onto it
const BODY = 0.12; // top of the head above the eyes
const STEP = 0.2; // a stair you walk up without a hop (colliders marked `step`: the porch's: user, 2026-10-20)
const SWIM = 1.0, SWIM_UP = 0.8; // m/s through water over your head, along and up or down
const LADDER = 1.15; // m/s up or down a climbable wall
// One footfall per STRIDE metres actually covered; the first of a walk lands almost at once,
// so even the smallest shuffle is one step, and a proper move is two.
const STRIDE = 0.75, FIRST_STEP = 0.08;
const SENS = 0.0022;
// Without pointer lock the cursor can run out of screen: holding it against an edge keeps turning.
const EDGE = 0.1, EDGE_YAW = 1.9, EDGE_PITCH = 1.1;

export class Player {
  constructor(camera, dom, colliders, bounds) {
    this.camera = camera;
    this.dom = dom;
    this.colliders = colliders;
    this.bounds = bounds;
    this.pos = new THREE.Vector2(0, 0); // x, z
    this.vel = new THREE.Vector2(0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.eye = EYE;
    this.tall = EYE; // eye height standing and crouched: yours here, whoever you are somewhere else (setStature)
    this.low = EYE_CROUCH;
    // climbable strips of wall: { x, z: the foot of it, nx, nz: the way into the wall, half: half its width,
    // depth: how far out from the wall it can be reached, top: how high it goes }; a ladder leaning on
    // something (the slide's) also has lean: how much nearer it you come for each metre up, out0: how far out
    // you start, over: the step forward off its top
    this.ladders = [];
    this.climbing = null;
    this.push = new THREE.Vector2(0, 0); // being knocked: a shove that dies away in a fraction of a second
    this.bobT = 0;
    this.feet = 0; // height of the soles: 0 on the carpet, higher on the bed, desk or cabinet
    this.vy = 0;
    this.grounded = true;
    this.dip = 0; // knees giving a little on landing
    this.seat = null; // { position, quaternion, fov } while sitting somewhere; the view is fixed there
    this.sitBlend = 0;
    this.lastSeat = null;
    this.baseFov = camera.fov;
    this.onSeatMouse = null; // (dx, dy) — where the mouse goes while seated
    this.floor = 'carpet'; // what the bare floor is made of
    this.surface = 'carpet'; // what's underfoot right now: the floor, or a collider's own `surface`
    this.onStep = null; // (surface, speed, first) — `first` on the opening step of a walk
    this.walking = false;
    this.opening = false; // the next footfall is the first of a walk
    this.still = 0;
    this.onLand = null; // (speed, surface)
    this.keys = new Set();
    this.enabled = false;
    this.frozen = false; // true while you are looking through what you carry: no walking, no looking about
    this.ride = null; // { off() } while something carries you (the swing, yard.js): you look about, it puts you where you are
    this.swimming = false; // in water over your head, floating (update)
    this.extraColliders = null; // things that move that you can't go through (her boat, boat.js)
    this.edge = new THREE.Vector2(0, 0); // −1…1 push from the screen edges, unlocked mode only
    camera.rotation.order = 'YXZ';

    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' && this.enabled && !this.seat && !this.frozen) {
        e.preventDefault();
        this.jump();
      }
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    addEventListener('blur', () => this.keys.clear());
    // look: the view turns with every mouse movement, button or no button
    addEventListener('mousemove', (e) => {
      if (!this.enabled || this.frozen) return;
      if (this.seat) { this.onSeatMouse?.(e.movementX, e.movementY); return; }
      this.yaw -= e.movementX * SENS;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * SENS, -1.45, 1.45);
      if (document.pointerLockElement === dom) { this.edge.set(0, 0); return; }
      const zone = (v, size) => {
        const n = v / size;
        return n < EDGE ? (n - EDGE) / EDGE : n > 1 - EDGE ? (n - (1 - EDGE)) / EDGE : 0;
      };
      this.edge.set(zone(e.clientX, innerWidth), zone(e.clientY, innerHeight));
    });
    document.documentElement.addEventListener('mouseleave', () => this.edge.set(0, 0));
    addEventListener('blur', () => this.edge.set(0, 0));
    document.addEventListener('pointerlockchange', () => this.edge.set(0, 0));
  }

  setPose(x, z, yawDeg, pitchDeg = 0) {
    this.pos.set(x, z);
    this.yaw = THREE.MathUtils.degToRad(yawDeg);
    this.pitch = THREE.MathUtils.degToRad(pitchDeg);
    this.vel.set(0, 0);
    this.feet = this.ground();
    this.vy = 0;
    this.grounded = true;
    this.climbing = null;
    this.sync(0);
  }

  /** How tall you are from now on: eye height standing, and crouched. */
  setStature(tall, low) {
    this.tall = this.eye = tall;
    this.low = low;
  }

  /** Knocked that way, at that speed to begin with. */
  shove(x, z) {
    this.push.set(x, z);
  }

  /** The climbable strip of wall you are up against, if any (and if nothing is barring it). */
  ladderHere() {
    for (const L of this.ladders) {
      if (L.locked) continue;
      const dx = this.pos.x - L.x, dz = this.pos.y - L.z;
      const out = -(dx * L.nx + dz * L.nz), side = dz * L.nx - dx * L.nz;
      if (out > -0.05 && out < L.depth && Math.abs(side) < L.half && this.feet < L.top) return L;
    }
    return null;
  }

  sit(seat) {
    this.seat = this.lastSeat = seat;
    this.vel.set(0, 0);
    this.edge.set(0, 0);
  }

  stand() {
    this.seat = null;
    this.keys.clear(); // whatever was typed at the desk isn't a walking instruction
  }

  /** How deep the water stands here (−∞ where there is none): set by the house (bath.js). */
  waterAt() { return -Infinity; }

  /** How high your eyes may go here (under a doorway's head, say): set by the house. */
  headroomAt() { return Infinity; }

  /** The height of the ground here with nothing on it: 0 in the house and on its porch, lower out in the yard (set by the house). */
  baseAt() { return 0; }

  /** Is this collider in the way at the height the player is at right now? */
  blocks(c) {
    if (c.step && c.top - this.feet <= STEP) return false; // (a stair: walked up, not into)
    return this.feet < (c.top ?? Infinity) - 0.03 && this.feet + this.eye + BODY > (c.base ?? 0);
  }

  /** Height of whatever is underfoot: the floor, or the top of a piece of furniture. */
  ground() {
    const p = this.pos;
    let g = this.baseAt(p.x, p.y);
    this.surface = this.floor;
    for (const c of this.colliders) {
      if (!c.stand || c.top > this.feet + (c.step ? STEP : 0.05) || c.top <= g) continue;
      if (p.x > c.x0 - 0.05 && p.x < c.x1 + 0.05 && p.y > c.z0 - 0.05 && p.y < c.z1 + 0.05) {
        g = c.top;
        this.surface = c.surface ?? 'wood';
      }
    }
    return g;
  }

  jump() {
    if (this.swimming || this.ride) return; // in the water, Space takes you up (update); on the swing, no
    if (this.climbing) {
      // let go and push off
      this.vel.set(-this.climbing.nx * 1.6, -this.climbing.nz * 1.6);
      this.vy = 1;
      this.climbing = null;
      return;
    }
    if (!this.grounded) return;
    const p = this.pos;
    let v = JUMP;
    for (const c of this.colliders) {
      if (!c.stand) continue;
      const rise = c.top - this.feet;
      if (rise < CLIMB_MIN || rise > CLIMB_MAX) continue;
      const dx = p.x - THREE.MathUtils.clamp(p.x, c.x0, c.x1), dz = p.y - THREE.MathUtils.clamp(p.y, c.z0, c.z1), d = Math.hypot(dx, dz);
      if (d >= RADIUS + CLIMB_REACH) continue;
      // only going at it (user, 2026-10-17: by the bed, a plain hop sent you sky high "for no reason")
      const toward = d > 1e-4 ? -(this.vel.x * dx + this.vel.y * dz) / d : this.vel.length();
      if (toward > CLIMB_TOWARD) v = Math.max(v, Math.sqrt(2 * GRAVITY * (rise + CLIMB_CLEAR)));
    }
    this.vy = v;
    this.grounded = false;
  }

  collide() {
    const p = this.pos, b = this.bounds;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.extraColliders ? [...this.colliders, ...this.extraColliders] : this.colliders) {
        if (!this.blocks(c)) continue;
        let cx, cz, r = RADIUS;
        if (c.type === 'box') {
          cx = THREE.MathUtils.clamp(p.x, c.x0, c.x1);
          cz = THREE.MathUtils.clamp(p.y, c.z0, c.z1);
          if (cx === p.x && cz === p.y) {
            // centre ended up inside: leave through the nearest face
            const d = [p.x - c.x0, c.x1 - p.x, p.y - c.z0, c.z1 - p.y];
            const k = d.indexOf(Math.min(...d));
            if (k === 0) p.x = c.x0 - r; else if (k === 1) p.x = c.x1 + r;
            else if (k === 2) p.y = c.z0 - r; else p.y = c.z1 + r;
            continue;
          }
        } else {
          const abx = c.bx - c.ax, abz = c.bz - c.az;
          const t = THREE.MathUtils.clamp(((p.x - c.ax) * abx + (p.y - c.az) * abz) / (abx * abx + abz * abz), 0, 1);
          cx = c.ax + abx * t;
          cz = c.az + abz * t;
          r += c.r;
        }
        const dx = p.x - cx, dz = p.y - cz;
        const dist = Math.hypot(dx, dz);
        if (dist < r && dist > 1e-6) {
          p.x = cx + (dx / dist) * r;
          p.y = cz + (dz / dist) * r;
        }
      }
      p.x = THREE.MathUtils.clamp(p.x, b.x0 + RADIUS, b.x1 - RADIUS);
      p.y = THREE.MathUtils.clamp(p.y, b.z0 + RADIUS, b.z1 - RADIUS);
    }
  }

  update(dt) {
    const k = this.keys;
    let f = 0, s = 0;
    const free = this.enabled && !this.seat && !this.frozen;
    this.sitBlend += ((this.seat ? 1 : 0) - this.sitBlend) * (1 - Math.exp(-dt * 6));
    if (free && (this.edge.x || this.edge.y)) {
      this.yaw -= this.edge.x * EDGE_YAW * dt;
      this.pitch = THREE.MathUtils.clamp(this.pitch - this.edge.y * EDGE_PITCH * dt, -1.45, 1.45);
    }
    if (this.ride) { // carried (the swing): only looking about; what carries you puts the camera where you are
      this.vel.set(0, 0);
      this.vy = 0;
      this.camera.rotation.set(this.pitch, this.yaw, 0);
      return;
    }
    if (free) {
      f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    }
    // in water over your head you float (user, 2026-10-15): no walking, no falling; Space up, C down
    const level = this.waterAt(this.pos.x, this.pos.y);
    if (!this.swimming && level > this.feet + this.tall + 0.06) { this.swimming = true; this.climbing = null; }
    if (this.swimming && level < this.feet + this.tall * 0.55) this.swimming = false;
    const swim = this.swimming;
    // down on the bottom, C crouches you as it does anywhere (in open water it takes you down)
    const crouch = free && k.has('KeyC') && (!swim || this.feet <= this.ground() + 0.01);
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = swim ? SWIM : crouch ? CROUCH : run ? RUN : WALK;
    const len = Math.hypot(f, s) || 1;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // yaw 0 looks north (−z); forward = (−sin, −cos), right = (cos, −sin)
    const wx = ((-sin * f + cos * s) / len) * speed;
    const wz = ((-cos * f - sin * s) / len) * speed;
    const ease = 1 - Math.exp(-dt * (swim ? 2.5 : 12)); // water holds you back and carries you on
    this.vel.x += (wx - this.vel.x) * ease;
    this.vel.y += (wz - this.vel.y) * ease;
    const fromX = this.pos.x, fromZ = this.pos.y;
    this.pos.x += (this.vel.x + this.push.x) * dt;
    this.pos.y += (this.vel.y + this.push.y) * dt;
    this.push.multiplyScalar(Math.exp(-dt * 7));
    this.collide();
    const covered = Math.hypot(this.pos.x - fromX, this.pos.y - fromZ); // after walls have had their say

    // a climbable wall: push at it and you go up, pull back and you come down, do neither and you hang on
    const L = free ? this.ladderHere() : null;
    const push = L && (f || s) ? (wx * L.nx + wz * L.nz) / speed : 0;
    if (L && !swim && !this.climbing && push > 0.35) this.climbing = L;
    if (this.climbing !== L) this.climbing = null; // shuffled off the side of it, or the top
    if (this.climbing) {
      // holding on: no stepping back off it, only in against it and a slow shuffle along it
      const mx = this.pos.x - fromX, mz = this.pos.y - fromZ;
      const along = (mz * L.nx - mx * L.nz) * 0.4, inward = Math.max(0, mx * L.nx + mz * L.nz);
      this.pos.set(fromX - L.nz * along + L.nx * inward, fromZ + L.nx * along + L.nz * inward);
      this.vel.set(0, 0);
      this.vy = 0;
      this.grounded = false;
      this.feet += (push > 0.35 ? 1 : push < -0.35 ? -1 : 0) * LADDER * dt;
      if (L.lean) { // up a leaning ladder you come nearer what it leans on as you go
        const o = L.out0 - L.lean * Math.max(0, this.feet - (L.foot ?? 0)), side = (this.pos.y - L.z) * L.nx - (this.pos.x - L.x) * L.nz;
        this.pos.set(L.x - L.nx * o - L.nz * side, L.z - L.nz * o + L.nx * side);
      }
      if (this.feet >= L.top) {
        // over the top: a step forward onto whatever is up there
        this.feet = L.top;
        this.pos.x += L.nx * (L.over ?? 0.6);
        this.pos.y += L.nz * (L.over ?? 0.6);
        this.climbing = null;
      } else if (this.feet <= this.ground()) {
        this.feet = this.ground();
        this.grounded = true;
        this.climbing = null;
      }
    } else if (swim) {
      // floating: up and down as you swim, drifting to a stop, never through the floor, the ceiling or
      // the top of a doorway; your head can just break the surface
      const want = ((free && k.has('Space') ? 1 : 0) - (free && k.has('KeyC') ? 1 : 0)) * SWIM_UP - 0.02;
      this.vy += (want - this.vy) * (1 - Math.exp(-dt * 2.5));
      this.feet += this.vy * dt;
      const g = this.ground();
      if (this.feet < g) { this.feet = g; this.vy = Math.max(0, this.vy); }
      const top = Math.min(level + 0.1, this.bounds.top - 0.08, this.headroomAt(this.pos.x, this.pos.y));
      if (this.feet + this.eye > top) { this.feet = top - this.eye; this.vy = Math.min(0, this.vy); }
      this.grounded = false;
    } else if (!this.grounded || this.feet > this.ground() + 1e-4) {
      // vertical: in the air after a jump, or after walking off the edge of something
      this.grounded = false;
      this.vy -= GRAVITY * dt;
      if (this.vy > 0 && this.feet + this.eye + BODY > this.bounds.top) this.vy = 0; // ceiling
      // what is underfoot from where the fall started this frame, not only where it ended: in a long frame you went
      // down past a cushion's top in one step, through the sofa's seat, and out behind its back (user, 2026-10-28)
      const was = this.feet;
      this.feet = Math.max(was, was + this.vy * dt);
      const g = this.ground();
      this.feet = was + this.vy * dt;
      if (this.vy <= 0 && this.feet <= g) {
        this.onLand?.(-this.vy, this.surface);
        this.dip = Math.min(0.06, -this.vy * 0.018);
        this.feet = g;
        this.vy = 0;
        this.grounded = true;
      }
    }
    if (!this.climbing && !swim && this.grounded) { // up a stair: onto it, the view following a moment after, not with a jump
      const g = this.ground();
      if (g > this.feet + 1e-4) { this.lag = (this.lag ?? 0) + (g - this.feet); this.feet = g; }
    }
    this.lag = (this.lag ?? 0) * Math.exp(-dt * 14);
    this.dip *= Math.exp(-dt * 9);
    this.eye += ((crouch ? this.low : this.tall) - this.eye) * (1 - Math.exp(-dt * 10));
    const moving = dt > 0 ? covered / dt : 0;
    if (moving > 0.15) this.still = 0;
    else if ((this.still += dt) > 0.25) this.walking = false;
    if (this.grounded && moving > 0.15) {
      if (!this.walking) {
        // setting off: wind the stride so the first foot comes down after FIRST_STEP
        this.walking = this.opening = true;
        this.bobT = Math.PI * (1 - FIRST_STEP / STRIDE);
      }
      const strides = Math.floor(this.bobT / Math.PI);
      this.bobT += (covered / STRIDE) * Math.PI;
      if (Math.floor(this.bobT / Math.PI) !== strides) {
        this.onStep?.(this.surface, moving, this.opening);
        this.opening = false;
      }
    }
    this.sync(Math.min(moving / WALK, 1.4));
  }

  sync(bobAmount) {
    const bob = Math.sin(this.bobT) * 0.016 * bobAmount;
    this.camera.position.set(this.pos.x, this.feet + this.eye + bob - this.dip - (this.lag ?? 0), this.pos.y);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    // sitting: glide from wherever you stood to the fixed seated view, and back again
    const b = this.sitBlend, seat = this.lastSeat;
    if (seat && b > 0.001) {
      const e = b * b * (3 - 2 * b);
      this.camera.position.lerp(seat.position, e);
      this.camera.quaternion.slerp(seat.quaternion, e);
      this.camera.fov = THREE.MathUtils.lerp(this.baseFov, seat.fov, e);
      this.camera.updateProjectionMatrix();
    } else if (seat && this.camera.fov !== this.baseFov) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
      this.lastSeat = null;
    }
  }
}
