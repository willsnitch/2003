// Lighter textures, the same pictures (user, 2026-11-05: "lighter, without losing quality"). Once the world is built:
//  - textures drawn twice the same, pixel for pixel, share one picture (one upload);
//  - maps the shaders read one channel of (bump, displacement, ao: .r) are kept in one channel, those read in two
//    (roughness, alpha: .g; with bump: .r) in two — the same numbers in the channels that are read, not four bytes a pixel;
//  - each picture is sent to the GPU now, during loading (not the first time it comes into view), and the canvas it was
//    drawn in, or the decoded image, is let go of: the GPU has its copy.
// Only canvasTex's pictures (`userData.drawn`) that nothing draws on again (`userData.redraws`), and the models'
// decoded images. A picture let go of and then asked for again would come out empty: `onUpdate` says so in the console.
import * as THREE from 'three';
import { breathe } from './util.js';

const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'alphaMap', 'emissiveMap', 'aoMap', 'lightMap', 'displacementMap',
  'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'sheenColorMap', 'sheenRoughnessMap', 'transmissionMap', 'thicknessMap',
  'specularIntensityMap', 'specularColorMap', 'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap', 'matcap', 'gradientMap', 'envMap', 'specularMap'];
const RED = new Set(['bumpMap', 'displacementMap', 'aoMap']); // (three reads .x / .r of these)
const RG = new Set([...RED, 'roughnessMap', 'alphaMap']); // (and .g of these)

/** Every texture the materials under `roots` use, with the slots it is used in ('u:' for a shader's own uniform). */
function gather(roots) {
  const uses = new Map();
  const add = (t, slot) => { if (t?.isTexture) (uses.get(t) ?? uses.set(t, new Set()).get(t)).add(slot); };
  const look = (m) => {
    if (!m) return;
    for (const k of SLOTS) add(m[k], k);
    if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k]?.value; if (Array.isArray(v)) v.forEach((t) => add(t, 'u:' + k)); else add(v, 'u:' + k); }
  };
  for (const root of roots) root.traverse((o) => {
    for (const m of [].concat(o.material ?? [])) look(m);
    look(o.customDepthMaterial);
    look(o.customDistanceMaterial);
  });
  return uses;
}

const plain = (t) => t.isTexture && !t.isRenderTargetTexture && !t.isDataTexture && !t.isCubeTexture && !t.isData3DTexture && !t.isDataArrayTexture && !t.isCompressedTexture && !t.isVideoTexture;

/** `share`: identical pictures shared; `slim`: one or two channels; `free`: canvases and images let go of. Returns what it did. */
export async function lighten(renderer, roots, { share = true, slim = true, free = true, progress = null } = {}) {
  const uses = gather(roots), bySource = new Map();
  for (const [t, slots] of uses) if (plain(t) && t.image) (bySource.get(t.source) ?? bySource.set(t.source, []).get(t.source)).push([t, slots]);
  const drawnOnce = (list) => list.every(([t]) => t.userData.drawn && !t.userData.redraws);
  const isCanvas = (s) => typeof HTMLCanvasElement !== 'undefined' && s.data instanceof HTMLCanvasElement && s.data.width > 0;
  const done = { shared: 0, sharedMB: 0, slimmed: 0, slimMB: 0, freed: 0, freedMB: 0 };
  const uploaded = (t) => renderer.properties.has(t) && renderer.properties.get(t).__webglInit;
  const mb = (s, k = 4) => (s.data.width * s.data.height * k * 4) / 3 / 1e6; // (with its mipmaps)

  // ---- the same picture drawn twice: compared pixel for pixel, then one Source for both
  if (share) {
    const thumb = document.createElement('canvas');
    thumb.width = thumb.height = 24;
    const tg = thumb.getContext('2d', { willReadFrequently: true }), groups = new Map();
    for (const [s, list] of bySource) {
      if (!isCanvas(s) || !drawnOnce(list)) continue;
      tg.clearRect(0, 0, 24, 24);
      tg.drawImage(s.data, 0, 0, 24, 24);
      let h = 0;
      for (const v of tg.getImageData(0, 0, 24, 24).data) h = (Math.imul(h, 31) + v) >>> 0;
      const key = `${s.data.width}x${s.data.height}:${h}`;
      (groups.get(key) ?? groups.set(key, []).get(key)).push(s);
    }
    const pixels = (s) => s.data.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, s.data.width, s.data.height).data;
    for (const same of groups.values()) {
      if (same.length < 2) continue;
      const kept = [];
      for (const s of same) {
        const px = pixels(s);
        const twin = kept.find(([, kp]) => kp.length === px.length && kp.every((v, i) => v === px[i]));
        if (!twin) { kept.push([s, px]); continue; }
        for (const [t] of bySource.get(s)) {
          if (uploaded(t)) t.dispose();
          t.source = twin[0];
          bySource.get(twin[0]).push([t, uses.get(t)]);
        }
        done.shared++;
        if (bySource.get(twin[0])[0][0].userData.from) (done.from ??= []).push(bySource.get(twin[0])[0][0].userData.from); // (?texlog: which drew it)
        done.sharedMB += mb(s);
        bySource.delete(s);
        s.data.width = s.data.height = 0;
      }
    }
    await breathe(progress);
  }

  // ---- maps read in one or two channels, kept in that many
  if (slim) {
    for (const [s, list] of bySource) {
      if (!drawnOnce(list)) continue;
      const slots = new Set(list.flatMap(([, sl]) => [...sl]));
      const ok = list.every(([t]) => t.format === THREE.RGBAFormat && t.type === THREE.UnsignedByteType && t.colorSpace === THREE.NoColorSpace && t.internalFormat === null);
      if (!ok) continue;
      const format = [...slots].every((k) => RED.has(k)) ? THREE.RedFormat : [...slots].every((k) => RG.has(k)) ? THREE.RGFormat : null;
      if (!format) continue;
      for (const [t] of list) {
        if (uploaded(t)) t.dispose();
        t.format = format;
      }
      done.slimmed++;
      done.slimMB += mb(s) - mb(s, format === THREE.RedFormat ? 1 : 2);
    }
  }

  // ---- on the GPU now; the canvas or decoded image let go of
  if (free) {
    let n = 0;
    for (const [s, list] of bySource) {
      const canvas = isCanvas(s) && drawnOnce(list), bitmap = typeof ImageBitmap !== 'undefined' && s.data instanceof ImageBitmap;
      if (!canvas && !bitmap) continue;
      for (const [t] of list) renderer.initTexture(t);
      done.freedMB += (s.data.width * s.data.height * 4) / 1e6;
      if (canvas) s.data.width = s.data.height = 0;
      else s.data.close();
      for (const [t] of list) t.onUpdate = () => console.error('lighten.js: a texture whose picture was let go of was sent again (it comes out empty)', t);
      done.freed++;
      if (++n % 25 === 0) await breathe(progress);
    }
  }
  for (const k of ['sharedMB', 'slimMB', 'freedMB']) done[k] = Math.round(done[k]);
  return done;
}
