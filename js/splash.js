// Luna's dive off her boat (boat.js → bath.js `splash`; user, 2026-11-11: "an animation of the water moved by the
// dive"): where she goes in, the water is pushed down and rings run out (the ripples, water.js RippleSim), her body
// and tail following through; a crown of drops thrown up and out, most of them the way she was going; the hole
// closing up behind her and throwing a little jet back up; white churned water spreading out and breaking up;
// and the air she takes down with her, coming back up as bubbles. Nothing new to compile: the bath's own drop and
// foam materials (a copy of the foam's, for its own fading), the bubbles' sprite.
import * as THREE from 'three';
import { bubbles } from './bubbles.js';

const DROPS = 44;
const rnd = Math.random; // (a splash is never the same twice)
const between = (a, b) => a + rnd() * (b - a);

/**
 * `parent`: the bath's group (world frame); `dropMat`, `foamMat`: the bath's; `level()`: where the water stands;
 * `roof`: the ceiling's height; `disturb(x, z, amp, r)`: the ripples. Returns `start(x, z, yaw)` and `update(dt)`.
 */
export function diveSplash(parent, { dropMat, foamMat, level, roof, disturb }) {
  const geo = new THREE.SphereGeometry(1, 8, 6);
  const drops = Array.from({ length: DROPS }, () => {
    const m = new THREE.Mesh(geo, dropMat);
    m.visible = false;
    m.renderOrder = 3;
    parent.add(m);
    return { m, v: new THREE.Vector3(), live: false, size: 0 };
  });
  // the churned water: one face up, one down (seen from under the water too), its own fading copy of the foam
  const churnMat = foamMat.clone();
  churnMat.opacity = 0;
  const churn = new THREE.Group();
  for (const [turn, y] of [[-Math.PI / 2, 0.003], [Math.PI / 2, -0.003]]) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(turn), churnMat);
    f.position.y = y;
    f.renderOrder = 3;
    churn.add(f);
  }
  churn.visible = false;
  parent.add(churn);
  const air = bubbles(parent, 40, level);
  const at = new THREE.Vector3(), push = new THREE.Vector3();
  let S = null; // the splash going on: { t, x, z, dx, dz, beats }

  const throwDrop = (x, y, z, vx, vy, vz, size) => {
    const d = drops.find((k) => !k.live);
    if (!d) return;
    d.live = true;
    d.size = size;
    d.m.position.set(x, y, z);
    d.v.set(vx, vy, vz);
    d.m.scale.setScalar(size);
    d.m.visible = true;
  };
  /** Air taken down with her: `n` bubbles from `top` to `deep` under the surface, along the way she went. */
  const takeDown = (n, top, deep) => {
    const y0 = level();
    for (let i = 0; i < n; i++) {
      const k = between(top, deep), a = rnd() * Math.PI * 2, r = between(0, 0.05);
      at.set(S.x + S.dx * k * 0.7 + Math.cos(a) * r, y0 - k, S.z + S.dz * k * 0.7 + Math.sin(a) * r);
      push.set(S.dx * between(0.05, 0.25) + Math.cos(a) * between(0, 0.12), -between(0.15, 0.55), S.dz * between(0.05, 0.25) + Math.sin(a) * between(0, 0.12));
      air.emit(at, between(0.003, 0.011), push);
    }
  };

  return {
    /** She goes in at x, z (her helmet first), heading `yaw`. */
    start(x, z, yaw) {
      const dx = Math.sin(yaw), dz = Math.cos(yaw), y = level();
      S = { t: 0, x, z, dx, dz, beats: [] };
      // the push where she goes in, and the rings from it
      disturb(x, z, 2.2, 0.1);
      // the crown: up and out all round, more of it and further the way she was going
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2 + between(-0.12, 0.12), cx = Math.cos(a), cz = Math.sin(a);
        const ahead = Math.max(0, cx * dx + cz * dz), r = between(0.05, 0.1);
        throwDrop(x + cx * r, y + 0.004, z + cz * r, cx * between(0.25, 0.7) + dx * 0.35 * ahead, between(0.6, 1.25) + 0.35 * ahead, cz * between(0.25, 0.7) + dz * 0.35 * ahead, between(0.0016, 0.0042));
      }
      takeDown(16, 0.03, 0.3);
      churn.visible = true;
      churn.position.set(x + dx * 0.04, y, z + dz * 0.04);
      churn.rotation.y = rnd() * Math.PI * 2;
      // and after it, in the order the water does it: her body and tail through, the hole closing (a jet back up),
      // the last of it settling; a little more air from her coat as she goes deeper
      S.beats = [
        [0.07, () => disturb(x + dx * 0.08, z + dz * 0.08, 1.0, 0.09)],
        [0.14, () => disturb(x + dx * 0.16, z + dz * 0.16, 0.5, 0.08)],
        [0.18, () => takeDown(8, 0.2, 0.5)],
        [0.24, () => {
          disturb(x, z, -1.1, 0.045);
          const yy = level();
          for (let i = 0; i < 9; i++) {
            const a = rnd() * Math.PI * 2, o = between(0.05, 0.22);
            throwDrop(x + Math.cos(a) * 0.012, yy + 0.006, z + Math.sin(a) * 0.012, Math.cos(a) * o, between(0.9, 1.7), Math.sin(a) * o, between(0.002, 0.0048));
          }
        }],
        [0.5, () => disturb(x, z, 0.35, 0.06)],
      ];
    },
    update(dt) {
      if (S) { S.t += dt; while (S.beats.length && S.t >= S.beats[0][0]) S.beats.shift()[1](); }
      air.update(dt);
      const y = level();
      for (const d of drops) {
        if (!d.live) continue;
        d.v.y -= 9.8 * dt;
        const p = d.m.position.addScaledVector(d.v, dt);
        if (p.y > roof - d.size && d.v.y > 0) d.v.y *= -0.2; // (the ceiling is near: off it they come)
        if (p.y < y) {
          // back into the water: the bigger ones leave a ring of their own
          if (d.size > 0.003) disturb(p.x, p.z, 0.05, 0.02);
          d.live = false;
          d.m.visible = false;
        }
      }
      if (!S) return;
      // the white water: out to some 30 cm, breaking up and gone in under 2 s
      const k = Math.min(1, S.t / 1.8);
      churn.position.y = y;
      churn.scale.setScalar(0.08 + 0.26 * (1 - (1 - k) ** 2.2));
      churn.rotation.y += dt * 0.35;
      churnMat.opacity = 0.85 * (1 - THREE.MathUtils.smoothstep(k, 0.05, 1)) * Math.min(1, S.t / 0.05);
      if (k >= 1) {
        churn.visible = false;
        if (!S.beats.length) S = null;
      }
    },
  };
}
