// Water as a big engine draws it (user, 2026-10-16: "much more realistic — act like we were using Unreal
// Engine"). The bath's water and the room's flood share it (bath.js):
//  - waves: three layers of one tiling wave-normal map panning different ways, rougher where the stream
//    lands and wherever something has stirred it;
//  - ripples that really travel (RippleSim, user 2026-10-17): the wave equation stepped on a grid over the
//    bathroom's floor, pushed wherever something disturbs the water — you wading or jumping in, the boat,
//    the duck — spreading, crossing and coming back off the walls and the bath's side by themselves;
//  - a planar reflection: the room, the boat, Luna, mirrored in the surface and broken up by its waves,
//    weighed by Fresnel (`PlanarReflection`), the room's own reflection map when there is none;
//  - from underneath, Snell's window: straight up you see through it, at a slant it is a mirror of the
//    water below (total internal reflection);
// and, for what lies under it (bath.js, the volume patch), caustics, and the light absorbed along the
// way under the water, the red first.
import * as THREE from 'three';


/**
 * A tiling field of small waves, as slopes (r: along x, g: along z; 0.5 is level), summed from forty sine
 * waves on whole-number wave vectors so it tiles exactly, the long ones the strongest.
 */
function waveTexture(size = 256, seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const waves = [];
  while (waves.length < 40) {
    const k = 2 + Math.floor(rnd() ** 1.6 * 18), a = rnd() * Math.PI * 2;
    const kx = Math.round(Math.cos(a) * k), ky = Math.round(Math.sin(a) * k);
    if (kx || ky) waves.push({ kx, ky, amp: 1 / Math.hypot(kx, ky) ** 1.35, ph: rnd() * Math.PI * 2 });
  }
  const sx = new Float32Array(size * size), sy = new Float32Array(size * size);
  let max = 1e-6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      for (const w of waves) {
        const c = Math.cos((2 * Math.PI * (w.kx * x + w.ky * y)) / size + w.ph) * w.amp;
        dx += c * w.kx;
        dy += c * w.ky;
      }
      sx[y * size + x] = dx;
      sy[y * size + x] = dy;
      max = Math.max(max, Math.abs(dx), Math.abs(dy));
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = 128 + 127 * (sx[i] / max);
    data[i * 4 + 1] = 128 + 127 * (sy[i] / max);
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** The uniforms every water surface shares: set them every frame (bath.js). */
export function waterUniforms() {
  return {
    uTime: { value: 0 },
    uWaves: { value: waveTexture() },
    uChop: { value: 0.03 }, // how rough the whole surface is
    uRipple: { value: new THREE.Vector4() }, // the stream: x, z where it lands, how hard
    // the ripples (RippleSim): its heights (r), where it lies (x0, z0, x1, z1), its texel, whether it runs
    uSim: { value: null },
    uSimBox: { value: new THREE.Vector4(0, 0, 1, 1) },
    uSimTexel: { value: new THREE.Vector2(1, 1) },
    uSimOn: { value: 0 },
    uReflTex: { value: null },
    uReflMat: { value: new THREE.Matrix4() },
    uLight: { value: 1 }, // how much light there is in the room (the switch, the door)
    uCamUnder: { value: 0 }, // 1 with your eyes under the room's water
  };
}

/** What makes the water's slopes, shared by the surface and by nothing else (GLSL). */
const SLOPE = /* glsl */ `
  uniform float uTime, uChop, uLight, uCamUnder, uReflOn;
  uniform vec4 uRipple, uSimBox;
  uniform vec2 uSimTexel;
  uniform float uSimOn;
  uniform sampler2D uWaves, uReflTex, uSim;
  varying vec3 vWPos;
  varying vec4 vRefl;
  vec2 wavesAt(vec2 p, float s, vec2 pan) { return texture2D(uWaves, p * s + pan * uTime).rg * 2.0 - 1.0; }
  vec2 waterSlope(vec2 p) {
    vec2 toS = p - uRipple.xy;
    float rs = length(toS) + 1e-4;
    // small waves everywhere, more of them near where the stream lands
    float chop = uChop + uRipple.z * 0.3 * exp(-rs * 2.2);
    vec2 s = (wavesAt(p, 0.45, vec2(0.021, 0.013)) * 0.6 + wavesAt(p, 1.3, vec2(-0.019, 0.027)) * 0.32 + wavesAt(p, 3.7, vec2(0.043, -0.031)) * 0.08) * chop;
    // where it lands: tight rings, churned
    float fall = uRipple.z * exp(-rs * 8.0) * smoothstep(0.0, 0.014, rs);
    float w = cos(rs * 95.0 - uTime * 10.0) * fall + 0.45 * cos(rs * 170.0 - uTime * 16.0 + 1.3) * fall * exp(-rs * 6.0);
    s += (toS / rs) * w * 0.55;
    // the ripples: the slope of the simulated surface where this is (RippleSim)
    if (uSimOn > 0.5) {
      vec2 uv = (p - uSimBox.xy) / (uSimBox.zw - uSimBox.xy);
      if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) {
        vec2 cell = (uSimBox.zw - uSimBox.xy) * uSimTexel; // metres a texel
        float hx = texture2D(uSim, uv + vec2(uSimTexel.x, 0.0)).r - texture2D(uSim, uv - vec2(uSimTexel.x, 0.0)).r;
        float hz = texture2D(uSim, uv + vec2(0.0, uSimTexel.y)).r - texture2D(uSim, uv - vec2(0.0, uSimTexel.y)).r;
        s += vec2(hx / (2.0 * cell.x), hz / (2.0 * cell.y));
      }
    }
    return s;
  }`;

/**
 * Makes `mat` (a transparent MeshStandardMaterial with an envMap) a water surface. `U`: waterUniforms();
 * `reflOn`: { value } — 1 while a planar reflection of this surface is being drawn (bath.js).
 */
export function waterSurface(mat, U, reflOn) {
  mat.premultipliedAlpha = true; // what it reflects is added, what is behind it shows through
  const before = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    before?.call(mat, sh, r);
    Object.assign(sh.uniforms, U, { uReflOn: reflOn });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec4 vRefl;\nuniform mat4 uReflMat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRefl = uReflMat * vec4(vWPos, 1.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + SLOPE)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 wSlope = waterSlope(vWPos.xz);
        vec3 wN = normalize(vec3(-wSlope.x, 1.0, -wSlope.y));
        // which side you see it from, by where your eyes are — not gl_FrontFacing: three.js draws a
        // transparent double-sided thing in two passes, and in the back one the back faces count as front
        bool fromBelow = cameraPosition.y < vWPos.y;
        normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz) * (fromBelow ? -1.0 : 1.0);`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        vec4 waterOut;
        {
          vec3 V = normalize(vViewPosition);
          float cosT = clamp(dot(V, normal), 0.0, 1.0);
          float F = 0.02 + 0.98 * pow(1.0 - cosT, 5.0); // Fresnel, water's
          vec3 refl = vec3(0.0);
          if (uReflOn > 0.5 && !fromBelow) refl = texture2D(uReflTex, vRefl.xy / vRefl.w + wSlope * 0.09).rgb;
          #ifdef USE_ENVMAP
            else refl = getIBLRadiance(V, normal, 0.04) * uLight;
          #endif
          vec3 body = vec3(0.045, 0.11, 0.12) * uLight; // the light the water itself scatters
          vec3 spec = reflectedLight.directSpecular; // the lamps, glinting on the waves
          vec3 col = refl * F + spec + body * (1.0 - F) * 0.2;
          float a = F + 0.05 * (1.0 - F);
          if (fromBelow) {
            // from under it (user, 2026-10-16: "super opaque, you can't see through it"): inside Snell's window,
            // straight overhead, what is above — the ceiling, the lamp — seen through it, bent and wavering
            // with its waves (PlanarReflection, drawn from your eyes, only what is above the water); outside
            // it, at a slant, more and more the mirror of the water below
            // the window's edge follows the waves only half way: with the boat's wake, the whole of them
            // tore it into dark blotches (user, 2026-10-16)
            vec3 flatN = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz) * -1.0;
            float cosW = clamp(dot(V, normalize(mix(flatN, normal, 0.5))), 0.0, 1.0);
            float win = smoothstep(0.55, 0.72, cosW);
            vec3 rim = vec3(0.6, 0.75, 0.78) * uLight * 0.05 * exp(-pow((cosW - 0.64) * 30.0, 2.0));
            // outside it, the mirror of the water below, which lets nothing through (user, 2026-10-16: "too
            // black ... darker little by little, as when I look towards the door"): the water's blue-green,
            // lighter near you and darker the further off, as the room fades when you look along it; the
            // waves stir it only a little
            float dist = length(vViewPosition);
            vec3 T = exp(-dist * vec3(0.45, 0.16, 0.13)), haze = vec3(0.045, 0.11, 0.12) * 0.6 * uLight;
            vec3 tir = mix(vec3(0.12, 0.27, 0.285), vec3(0.02, 0.085, 0.095), 1.0 - exp(-dist * 0.5)) * uLight;
            tir = tir * (1.0 + clamp(4.0 * (wSlope.x + wSlope.y), -0.12, 0.12)) + spec * 0.08;
            if (uReflOn > 0.5) {
              vec3 above = texture2D(uReflTex, vRefl.xy / vRefl.w + wSlope * (0.1 + 0.2 * (1.0 - cosW))).rgb;
              if (uCamUnder > 0.5) above = above * T + haze * (1.0 - T); // the water between your eyes and it (bath.js)
              col = mix(tir, above, win) + rim;
              a = 1.0;
            } else {
              col = mix(tir, spec * 0.25, win) + rim;
              a = mix(0.42, 0.03, win);
            }
          }
          // your eyes under the water, this one seen from above (no such case yet): the water between
          if (uCamUnder > 0.5 && !fromBelow) {
            vec3 T = exp(-length(vViewPosition) * vec3(0.45, 0.16, 0.13));
            col = col * T + vec3(0.045, 0.11, 0.12) * 0.6 * uLight * (1.0 - T);
          }
          float edge = clamp(diffuseColor.a / max(opacity, 1e-3), 0.0, 1.0); // a puddle's spreading edge
          waterOut = vec4(col * edge, a * edge);
        }`)
      .replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor = waterOut;');
  };
  mat.customProgramCacheKey = () => key + '|water-surface';
  mat.needsUpdate = true;
  return mat;
}

/**
 * A planar reflection: the scene drawn from under a horizontal water surface (the camera mirrored in
 * it, the near plane laid along it so nothing under it gets in), at half the screen's size, for the
 * surface to sample where it is seen. `render` returns false when there is nothing to draw (you are
 * under it).
 */
export class PlanarReflection {
  constructor() {
    this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
    this.cam = new THREE.PerspectiveCamera();
    this._p = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._u = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._size = new THREE.Vector2();
    this._plane = new THREE.Plane();
    this._clip = new THREE.Vector4();
    this._q = new THREE.Vector4();
    this.bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  }

  /**
   * Draws `scene` as seen in water at height `y` from `camera`, into U.uReflTex / U.uReflMat; `hide`: what
   * must not be in it. `through`: you are under the water — what is above it, from where you are (for the
   * surface to show it, bent by its waves), instead of its reflection.
   */
  render(renderer, scene, camera, y, U, hide = [], through = false) {
    const p = camera.getWorldPosition(this._p);
    if (through ? p.y > y - 0.01 : p.y < y + 0.01) return false;
    renderer.getDrawingBufferSize(this._size);
    const w = Math.max(2, this._size.x >> 1), h = Math.max(2, this._size.y >> 1);
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    const cam = this.cam;
    cam.fov = camera.fov;
    cam.aspect = camera.aspect;
    cam.near = camera.near;
    cam.far = camera.far;
    if (through) {
      cam.position.copy(p);
      camera.getWorldQuaternion(cam.quaternion);
    } else {
      cam.position.set(p.x, 2 * y - p.y, p.z);
      camera.getWorldDirection(this._d);
      this._t.copy(p).add(this._d);
      this._t.y = 2 * y - this._t.y;
      this._u.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(cam.quaternion));
      cam.up.set(this._u.x, -this._u.y, this._u.z);
      cam.lookAt(this._t);
    }
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    U.uReflMat.value.copy(this.bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // the near plane along the water (an oblique projection), so only what is above it is drawn
    this._plane.setFromNormalAndCoplanarPoint(this._u.set(0, 1, 0), this._t.set(0, y, 0)).applyMatrix4(cam.matrixWorldInverse);
    const c = this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant);
    const P = cam.projectionMatrix.elements;
    this._q.set((Math.sign(c.x) + P[8]) / P[0], (Math.sign(c.y) + P[9]) / P[5], -1, (1 + P[10]) / P[14]);
    c.multiplyScalar(2 / c.dot(this._q));
    P[2] = c.x;
    P[6] = c.y;
    P[10] = c.z + 1 - 0.003;
    P[14] = c.w;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const shown = hide.map((o) => o.visible);
    hide.forEach((o) => { o.visible = false; });
    const target = renderer.getRenderTarget(), shadows = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(target);
    renderer.shadowMap.needsUpdate = shadows;
    hide.forEach((o, i) => { o.visible = shown[i]; });
    U.uReflTex.value = this.rt.texture;
    return true;
  }
}

/**
 * Ripples as they really go (user, 2026-10-17: the water round you as you move or jump): the wave equation
 * stepped on a grid over the bathroom's floor (`box`: {x0, x1, z0, z1}), 1.25 cm cells, on the GPU. Whatever
 * disturbs the water pushes it down where it is (`disturb`), and the ripples spread from it, cross each
 * other and come back off the walls, and off whatever stands up out of the water (`setMask`), by
 * themselves. `step(renderer, dt)` every frame it runs; `uniforms` go to the water's (waterUniforms).
 */
export class RippleSim {
  constructor(box, cell = 0.0125) {
    this.box = box;
    const nx = (this.nx = Math.max(8, Math.round((box.x1 - box.x0) / cell)));
    const nz = (this.nz = Math.max(8, Math.round((box.z1 - box.z0) / cell)));
    const rt = () => new THREE.WebGLRenderTarget(nx, nz, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    this.rts = [rt(), rt()];
    this.cur = 0;
    this.maskData = new Uint8Array(nx * nz).fill(255);
    this.mask = new THREE.DataTexture(this.maskData, nx, nz, THREE.RedFormat, THREE.UnsignedByteType);
    this.mask.needsUpdate = true;
    this.drops = Array.from({ length: 24 }, () => new THREE.Vector4());
    this.n = 0;
    this.acc = 0;
    this.clear = true;
    this.uniforms = { uSim: { value: this.rts[0].texture }, uSimBox: { value: new THREE.Vector4(box.x0, box.z0, box.x1, box.z1) }, uSimTexel: { value: new THREE.Vector2(1 / nx, 1 / nz) }, uSimOn: { value: 0 } };
    const C = 0.3, DT = 1 / 120; // m/s the ripples go; s a step
    this.DT = DT;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uState: { value: null }, uMask: { value: this.mask }, uTexel: { value: new THREE.Vector2(1 / nx, 1 / nz) },
        uBox: { value: this.uniforms.uSimBox.value }, uC2: { value: (C * DT / cell) ** 2 }, uDamp: { value: 0.9975 },
        uDrops: { value: this.drops }, uN: { value: 0 }, uClear: { value: 1 },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uState, uMask;
        uniform vec2 uTexel;
        uniform vec4 uBox, uDrops[24];
        uniform float uC2, uDamp, uClear;
        uniform int uN;
        varying vec2 vUv;
        // a neighbour's height; where there is a wall (or the edge), this one's own: the ripple comes back
        float nb(vec2 uv, float h) {
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 || texture2D(uMask, uv).r < 0.5) return h;
          return texture2D(uState, uv).r;
        }
        void main() {
          if (uClear > 0.5 || texture2D(uMask, vUv).r < 0.5) { gl_FragColor = vec4(0.0); return; }
          vec4 s = texture2D(uState, vUv);
          float h = s.r, hp = s.g;
          float lap = nb(vUv + vec2(uTexel.x, 0.0), h) + nb(vUv - vec2(uTexel.x, 0.0), h) + nb(vUv + vec2(0.0, uTexel.y), h) + nb(vUv - vec2(0.0, uTexel.y), h) - 4.0 * h;
          float hn = (2.0 * h - hp + uC2 * lap) * uDamp;
          hn = mix(hn, h + 0.25 * lap, 0.008); // a touch of smoothing: no grid noise
          vec2 p = uBox.xy + vUv * (uBox.zw - uBox.xy);
          for (int i = 0; i < 24; i++) {
            if (i >= uN) break;
            vec4 d = uDrops[i];
            vec2 q = p - d.xy;
            float qq = dot(q, q) / (d.z * d.z);
            hn -= d.w * exp(-qq) * (1.0 - 0.9 * qq); // down in the middle, a lip round it: rings, not one

          }
          gl_FragColor = vec4(clamp(hn, -0.05, 0.05), h, 0.0, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /** A push down into the water at x, z: `amp` as the old rings had it (0.05 a ripple, 0.5 a splash), `r` metres across. */
  disturb(x, z, amp = 0.3, r = 0.05) {
    if (x < this.box.x0 || x > this.box.x1 || z < this.box.z0 || z > this.box.z1) return;
    if (this.n < this.drops.length) this.drops[this.n++].set(x, z, r, amp * 0.004);
    else { const d = this.drops[this.drops.length - 1]; d.w += amp * 0.004; } // (a busy frame: the last one takes the rest)
  }

  /** Which cells the water is open in: `open(x, z)` false where something stands up out of it (or the bath's side). */
  setMask(open) {
    const { nx, nz, box } = this;
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) this.maskData[k * nx + i] = open(box.x0 + ((i + 0.5) / nx) * (box.x1 - box.x0), box.z0 + ((k + 0.5) / nz) * (box.z1 - box.z0)) ? 255 : 0;
    this.mask.needsUpdate = true;
  }

  /** Every frame: steps it on (at 120 a second), with what has disturbed it since; `on`: is there any water at all. */
  step(renderer, dt, on = true) {
    this.uniforms.uSimOn.value = on ? 1 : 0;
    if (!on) { this.clear = true; this.n = 0; return; }
    this.acc = Math.min(this.acc + dt, this.DT * 4);
    const target = renderer.getRenderTarget(), shadows = renderer.shadowMap.needsUpdate, xr = renderer.xr.enabled;
    renderer.xr.enabled = false;
    while (this.acc >= this.DT) {
      this.acc -= this.DT;
      const src = this.rts[this.cur], dst = this.rts[1 - this.cur];
      this.mat.uniforms.uState.value = src.texture;
      this.mat.uniforms.uN.value = this.n;
      this.mat.uniforms.uClear.value = this.clear ? 1 : 0;
      renderer.setRenderTarget(dst);
      renderer.render(this.scene, this.cam);
      this.cur = 1 - this.cur;
      this.n = 0; // (each push goes in once)
      this.clear = false;
    }
    renderer.setRenderTarget(target);
    renderer.shadowMap.needsUpdate = shadows;
    renderer.xr.enabled = xr;
    this.uniforms.uSim.value = this.rts[this.cur].texture;
  }
}

/**
 * Caustics (GLSL): light focused by the waves on what lies under them — bright threads where the cells
 * of two drifting cellular patterns meet. Original, not copied from anywhere.
 */
export const CAUSTICS = /* glsl */ `
  vec2 cHash(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
  float cLayer(vec2 p, float t) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = 0.5 + 0.42 * sin(t * 0.9 + 6.2831 * cHash(i + g));
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    float edge = 1.0 - smoothstep(0.0, 0.17, d2 - d1);
    return edge * edge;
  }
  float caustics(vec2 p, float t) {
    vec2 warp = vec2(sin(p.y * 1.7 + t * 0.6), cos(p.x * 1.9 - t * 0.5)) * 0.18;
    float a = cLayer(p * 3.1 + warp, t), b = cLayer(p * 2.3 - warp * 1.3 + 17.0, t * 1.13);
    return a * 0.55 + b * 0.35 + a * b * 1.1; // a web of light, brighter where its threads cross
  }`;
