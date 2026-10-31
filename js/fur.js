// Shell fur, shared by the cat (long, black) and the teddy bear (short plush).
import * as THREE from 'three';
import { canvasTex, mulberry32 } from './util.js';

let furTex = null;

/** Random strand heights, skewed tall so the coat stays thick right out to the tips. */
function furNoise() {
  furTex ??= canvasTex(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    const r = mulberry32(77);
    for (let i = 0; i < w * h; i++) {
      const v = (1 - r() ** 2) * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { repeat: [1, 1], data: true });
  return furTex;
}

/** A coat: the colour at the root and tip of each hair, and the skin underneath. */
export function makeCoat(root, tip, skin = root) {
  return {
    root: new THREE.Color(root),
    tip: new THREE.Color(tip),
    skin: new THREE.MeshStandardMaterial({ color: skin, roughness: 0.92 }),
  };
}

/**
 * The same mesh drawn `shells` times (as instances), each copy pushed a little further out
 * along the normal and cut away wherever the strand map says the hair has ended.
 */
function furMaterial(length, shells, density, front, coat) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uFurMap: { value: furNoise() },
      uFurLen: { value: length },
      uShells: { value: shells },
      uDensity: { value: density },
      uFront: { value: front },
      uRoot: { value: coat.root },
      uTip: { value: coat.tip },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uFurLen, uShells, uFront;
        varying float vShell;
        varying vec2 vFurUv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vShell = (float(gl_InstanceID) + 1.0) / uShells;
        vFurUv = uv;
        // hair hangs in locks: vary the length over the body, and let it droop
        float lock = 0.5 + 0.5 * sin(position.x * 150.0 + position.y * 95.0) * sin(position.z * 125.0 - position.y * 70.0);
        float face = uFront * smoothstep(0.05, 0.6, normal.z);
        float len = uFurLen * (0.62 + 0.76 * lock) * mix(1.0, 0.1, face);
        transformed += normalize(normal) * len * vShell;
        transformed.y -= len * vShell * vShell * 0.28;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uFurMap;
        uniform vec2 uDensity;
        uniform vec3 uRoot, uTip;
        varying float vShell;
        varying vec2 vFurUv;`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        if (texture2D(uFurMap, vFurUv * uDensity).r < vShell * 0.96) discard;
        vec4 diffuseColor = vec4(mix(uRoot, uTip, vShell), opacity);`);
  };
  mat.customProgramCacheKey = () => 'shell-fur';
  return mat;
}

export function ellipsoid(rx, ry, rz, ws = 22, hs = 16) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

/**
 * A furry body part: a skin mesh (the only thing that casts a shadow) wrapped in fur shells.
 * `front: 1` trims the fur short on forward-facing surfaces, for faces. Skins are collected
 * in `skins` when the caller needs to toggle their shadows.
 */
export function furPart(geo, length, coat, { shells = 18, front = 0, skins = null } = {}) {
  const g = new THREE.Group();
  const skin = new THREE.Mesh(geo, coat.skin);
  skin.castShadow = skin.receiveShadow = true;
  skin.userData.fluff = length; // how far the coat stands out from this part…
  skin.userData.trimmed = !!front; // …except on its front, where it is cut short (faces)
  g.add(skin);
  skins?.push(skin);
  geo.computeBoundingBox();
  const s = geo.boundingBox.getSize(new THREE.Vector3());
  // aim for strands about a millimetre across whatever the size of the part
  const texel = 128 * 0.0011;
  const density = new THREE.Vector2((Math.PI * (s.x + s.z) * 0.5) / texel, (Math.PI * (s.y + Math.max(s.x, s.z)) * 0.25) / texel);
  const fur = new THREE.InstancedMesh(geo, furMaterial(length, shells, density, front, coat), shells);
  fur.frustumCulled = false;
  fur.receiveShadow = true;
  fur.raycast = () => {}; // the skin underneath is enough to aim at
  g.add(fur);
  return g;
}
