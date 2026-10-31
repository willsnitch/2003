// Bubbles under water: little sprites that rise, wobble and grow a little, gone at the surface. Each
// source has its own pool: Luna's regulator (boat.js), the tap running under water (bath.js), and you
// (main.js) — the water is still coming, somebody is breathing.
import * as THREE from 'three';

let tex = null;
/** A bubble, as the eye sees one in water: nearly clear, bright at its rim, a fleck where the light catches it. */
function bubbleTex() {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 18, 32, 32, 31);
  gr.addColorStop(0, 'rgba(220,235,240,0.08)');
  gr.addColorStop(0.75, 'rgba(225,240,245,0.25)');
  gr.addColorStop(0.92, 'rgba(245,252,255,0.9)');
  gr.addColorStop(1, 'rgba(245,252,255,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(32, 32, 31, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath(); g.ellipse(23, 21, 6, 4, -0.6, 0, Math.PI * 2); g.fill();
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const NONE = new THREE.Vector3();

/**
 * A pool of `count` bubbles in `parent`. `level()`: how high the water stands, where they burst.
 * `bend(p)`: optional, moves a bubble at p out of something it must not go through (Luna's glass),
 * true if it did. Returns `emit(p, size, push)`, `update(dt)`, `clear()`.
 */
export function bubbles(parent, count, level, bend = null) {
  const mat = new THREE.SpriteMaterial({ map: bubbleTex(), transparent: true, depthWrite: false });
  const pool = Array.from({ length: count }, () => {
    const s = new THREE.Sprite(mat);
    s.visible = false;
    s.renderOrder = 1.9; // under the water's surface, which tints them from above
    parent.add(s);
    return { s, live: false, v: new THREE.Vector3(), size: 0, rise: 0, t: 0, ph: 0, ox: 0, oz: 0 };
  });
  return {
    /** One bubble at p, `size` across; `push`: how it leaves (the water soon stops that, and up it goes). */
    emit(p, size, push = NONE) {
      const b = pool.find((k) => !k.live);
      if (!b || p.y > level() - 0.01) return;
      b.live = true;
      b.size = size;
      b.rise = 0.16 + size * 9; // the bigger, the quicker
      b.t = 0;
      b.ph = Math.random() * 6.28;
      b.v.copy(push);
      b.s.position.copy(p);
      b.ox = p.x;
      b.oz = p.z;
      b.s.visible = true;
    },
    update(dt) {
      const top = level();
      for (const b of pool) {
        if (!b.live) continue;
        b.t += dt;
        b.v.multiplyScalar(Math.exp(-dt * 4));
        b.ox += b.v.x * dt;
        b.oz += b.v.z * dt;
        b.s.position.y += (b.rise * Math.min(1, b.t * 2.5) + b.v.y) * dt;
        const wob = 0.004 + b.size * 0.4;
        b.s.position.x = b.ox + Math.sin(b.t * 7 + b.ph) * wob;
        b.s.position.z = b.oz + Math.cos(b.t * 6 + b.ph) * wob;
        if (bend?.(b.s.position)) {
          b.ox = b.s.position.x - Math.sin(b.t * 7 + b.ph) * wob;
          b.oz = b.s.position.z - Math.cos(b.t * 6 + b.ph) * wob;
        }
        b.s.scale.setScalar(b.size * (1 + Math.min(b.t, 4) * 0.08));
        if (b.s.position.y > top - 0.006 || b.t > 14) { b.live = false; b.s.visible = false; }
      }
    },
    clear() { for (const b of pool) { b.live = false; b.s.visible = false; } },
  };
}
