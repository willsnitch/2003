// The UV torch from the bathroom cabinet (user, 2026-10-15). In your hand it is on: a violet beam where
// you look, in the bedroom and the house alike (a spot light in each scene, no shadows: see uvBeam). What is
// drawn for it alone (`glowMaterial`: what was washed down the basin) glows where the beam falls, and
// only in the dark.
import * as THREE from 'three';

export const UV_TORCH = 'uv-torch';
const COLOR = 0x5b3dff, POWER = 1.3, REACH = 6, ANGLE = 0.42, SOFT = 0.7;
/** The torch from by the cellar (user, 2026-10-21), the same light in the rooms: a bulb's, warm, wider and further. */
const WHITE = { color: 0xffd9a8, power: 1.7, reach: 10, angle: 0.46 };

/** Where the beam is, for whatever glows under it. */
const beam = {
  uFrom: { value: new THREE.Vector3(0, -99, 0) },
  uDir: { value: new THREE.Vector3(0, -1, 0) },
  uOn: { value: 0 },
  uCosOut: { value: Math.cos(ANGLE) },
  uCosIn: { value: Math.cos(ANGLE * (1 - SOFT)) },
};

/**
 * The beam, in each of `scenes`. It shines from just by your eyes, the way you look: with no shadows, a
 * light where your eyes are reaches exactly what you can see (from the torch's own end, out in front of
 * you, it lit the floor under the basin through the basin). Returns `update(on)`, every frame.
 */
export function uvBeam(scenes, camera) {
  const lights = scenes.map((s) => {
    const l = new THREE.SpotLight(COLOR, 0, REACH, ANGLE, SOFT, 2);
    l.castShadow = false;
    s.add(l, l.target);
    return l;
  });
  const BY = new THREE.Vector3(0.05, -0.06, 0); // from your eyes: a little to the right and down, towards your hand
  const from = new THREE.Vector3(), aim = new THREE.Vector3(), fwd = new THREE.Vector3();
  return {
    /** `on`: the UV torch is in your hand; `white`: the ordinary one (basement.js has its own beam down there). */
    update(on, white = false) {
      beam.uOn.value = on ? 1 : 0;
      for (const l of lights) {
        l.intensity = on ? POWER : white ? WHITE.power : 0;
        l.color.set(on ? COLOR : WHITE.color);
        l.distance = on ? REACH : WHITE.reach;
        l.angle = on ? ANGLE : WHITE.angle;
      }
      if (!on && !white) return;
      from.copy(BY).applyQuaternion(camera.quaternion).add(camera.position);
      aim.copy(from).addScaledVector(camera.getWorldDirection(fwd), 4);
      for (const l of lights) {
        l.position.copy(from);
        l.target.position.copy(aim);
        l.updateMatrixWorld();
        l.target.updateMatrixWorld();
      }
      beam.uFrom.value.copy(from);
      beam.uDir.value.copy(fwd);
    },
  };
}

/**
 * What shows only under the beam: `mask` (its alpha, on the mesh's uv) glowing a cold green-white where
 * the beam falls on it, the nearer the brighter, drawn over the surface it lies on. `dark.value`: 0 with
 * the room's light on (nothing shows), 1 in the dark. `near` (m), if given: further off than about that it
 * fades away fast — it comes out only as you come up to it (the corridor's writing).
 */
export function glowMaterial(mask, dark, near = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { ...beam, uMask: { value: mask }, uDark: dark, uNear: { value: near }, uColor: { value: new THREE.Color(0.3, 1, 0.74) } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vW, vN;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform sampler2D uMask; uniform vec3 uFrom, uDir, uColor; uniform float uOn, uDark, uNear, uCosOut, uCosIn;
      varying vec2 vUv; varying vec3 vW, vN;
      void main() {
        float m = texture2D(uMask, vUv).a;
        vec3 l = vW - uFrom; float d = length(l); l /= d;
        float cone = smoothstep(uCosOut, uCosIn, dot(l, uDir));
        float facing = 0.75 + 0.25 * abs(dot(normalize(vN), l));
        float g = m * cone * facing * uOn * uDark / (1.0 + 1.6 * d * d);
        if (uNear > 0.0) g /= 1.0 + pow(d / uNear, 4.0);
        gl_FragColor = vec4(uColor * g * 3.0, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    side: THREE.DoubleSide,
  });
}
