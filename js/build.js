// Building blocks shared by the house and the yard: boxes and flats whose textures repeat by
// the metre and line up from piece to piece, and walls cut round their openings.
import * as THREE from 'three';
import { ROOM } from './room.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const { H } = ROOM;

// ---------------------------------------------------------------- building blocks

/** A material whose texture repeats every `period` metres: surfaces get UVs measured on themselves. */
export const metric = (mat, period) => {
  mat.userData.period = period;
  return mat;
};

/** Six faces' materials: `all` everywhere, except the faces named in `over` (px, nx, py, ny, pz, nz). */
export const faces = (all, over = {}) => ['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((k) => over[k] ?? all);

/**
 * A box from its corners, solid and shadowing. A face whose material repeats by the metre gets UVs
 * from where it is in the world, so tiles and boards line up from one piece of wall to the next.
 */
export function slab(x0, x1, y0, y1, z0, z1, mats) {
  const list = Array.isArray(mats) ? mats : faces(mats);
  const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  list.forEach((m, f) => {
    const p = m.userData.period;
    if (!p) return;
    for (let i = f * 4; i < f * 4 + 4; i++) {
      const x = pos.getX(i) + cx, y = pos.getY(i) + cy, z = pos.getZ(i) + cz;
      const [a, b] = f < 2 ? [z, y] : f < 4 ? [x, z] : [x, y];
      uv.setXY(i, a / p, b / p);
    }
  });
  const mesh = new THREE.Mesh(geo, list.every((m) => m === list[0]) ? list[0] : list);
  mesh.position.set(cx, cy, cz);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** A floor (facing up) or ceiling (facing down), x0…x1 by z0…z1 at height y. */
export function flat(x0, x1, z0, z1, y, mat, up = true) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  geo.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const p = mat.userData.period;
  if (p) {
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / p, pos.getZ(i) / p);
  }
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

/** Pieces of a wall round its openings. `span`: [a0, a1] along the wall; `holes`: [a0, a1, y0, y1] each. */
export function pierced(span, holes, make, top = H) {
  const cuts = [...holes].sort((p, q) => p[0] - q[0]);
  let at = span[0];
  for (const [a0, a1, y0, y1] of cuts) {
    if (a0 > at) make(at, a0, 0, top);
    if (y0 > 0) make(a0, a1, 0, y0);
    make(a0, a1, y1, top);
    at = a1;
  }
  if (span[1] > at) make(at, span[1], 0, top);
}

/**
 * The walls `meshes` once more, all in one, drawn into shadows from both sides: a wall's shadow is
 * then taken at its sunny outer face, not its inner one, which leaves the whole of its thickness for
 * the bias to eat into, and no thin line of sun gets in where one wall meets the next. Pass it to
 * `shadowOnly`.
 */
export function shadowTwin(meshes) {
  const list = meshes.map((m) => {
    m.updateWorldMatrix(true, false);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry).attributes.position.clone());
    return geo.applyMatrix4(m.matrixWorld);
  });
  return new THREE.Mesh(mergeGeometries(list, false), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
}

const UNSEEN = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

/**
 * `mesh` drawn into the shadows of `lights` alone, and into nothing else: not the picture, and not
 * the shadow of any other lamp. (Layers can't do this: three.js picks what goes into a shadow by
 * the layers of the camera you look through, not the light's.)
 */
export function shadowOnly(mesh, lights) {
  const cams = lights.map((l) => l.shadow.camera);
  if (mesh.material.side === THREE.DoubleSide) mesh.material.colorWrite = mesh.material.depthWrite = false;
  else mesh.material = UNSEEN;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.onBeforeShadow = (renderer, object, camera, shadowCamera, geometry) => {
    geometry.drawRange.count = cams.includes(shadowCamera) ? Infinity : 0;
  };
  mesh.onBeforeRender = (renderer, scene, camera, geometry) => {
    geometry.drawRange.count = 0;
  };
  return mesh;
}

/**
 * The shadow of `light` (in `scene`) in two layers: what stands still, drawn only when something has
 * moved that marks it (`light.userData.stale`: how many more times) and kept, and on it, whenever the
 * shadow is wanted, only what `movers()` gives (roots of what goes about by itself: Mum). The same map
 * for a fraction of the work: the kitchen lamp's, drawn again every frame while she walked, drew the
 * whole house and the porch six times over, 6.6 million triangles, for her alone.
 */
export function layeredShadow(renderer, scene, light, movers) {
  const gl = renderer.getContext(), sm = renderer.shadowMap, draw = sm.render;
  let kept = null; // the still layer, as last drawn
  light.userData.stale = 1;
  const copy = (from, to) => {
    renderer.state.setScissorTest(false);
    renderer.state.buffers.depth.setMask(true);
    renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER, renderer.properties.get(from).__webglFramebuffer);
    renderer.state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, renderer.properties.get(to).__webglFramebuffer);
    gl.blitFramebuffer(0, 0, from.width, from.height, 0, 0, to.width, to.height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    renderer.state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  };
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const once = (lights, root, camera) => {
    sm.needsUpdate = true;
    light.shadow.needsUpdate = true;
    draw.call(sm, lights, root, camera);
  };
  sm.render = function (lights, root, camera) {
    if (root !== scene || !this.needsUpdate || !light.shadow.needsUpdate || !lights.includes(light)) return draw.call(this, lights, root, camera);
    const target = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), level = renderer.getActiveMipmapLevel();
    draw.call(this, lights.filter((l) => l !== light), root, camera); // the other lamps as ever
    const who = movers().filter(shown);
    if (light.userData.stale > 0 || !kept) {
      // what stands still, without them, kept
      const off = [];
      for (const m of who) m.traverse((o) => { if (o.castShadow) { o.castShadow = false; off.push(o); } });
      once([light], root, camera);
      for (const o of off) o.castShadow = true;
      if (!kept) {
        kept = light.shadow.map.clone();
        renderer.initRenderTarget(kept);
      }
      copy(light.shadow.map, kept);
      light.userData.stale = Math.max(0, light.userData.stale - 1);
    } else copy(kept, light.shadow.map);
    // and on it, each of them where they are now (not cleared first: drawn over what was kept)
    const clear = renderer.clear;
    renderer.clear = () => {};
    try {
      for (const m of who) once([light], m, camera);
    } finally {
      renderer.clear = clear;
    }
    light.shadow.needsUpdate = false;
    this.needsUpdate = false;
    renderer.setRenderTarget(target, face, level); // (the copies leave no framebuffer bound)
  };
}

/**
 * `mesh` (indexed) cut into pieces `size` m square across x and z, each triangle going to the piece its middle is in:
 * the same triangles, sharing the same buffers, but what is out of view is now left out, where before one corner in
 * view drew the whole of it (the porch's boards: 1.2 million triangles in three meshes, all drawn from the bedroom for
 * the bit of railing in the window). Returns the pieces, to add in its place.
 */
export function inPieces(mesh, size) {
  const geo = mesh.geometry, P = geo.attributes.position, I = geo.index.array, cells = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const x = (P.getX(I[t]) + P.getX(I[t + 1]) + P.getX(I[t + 2])) / 3, z = (P.getZ(I[t]) + P.getZ(I[t + 1]) + P.getZ(I[t + 2])) / 3;
    const key = (Math.floor(x / size) + 4096) * 8192 + Math.floor(z / size) + 4096;
    let list = cells.get(key);
    if (!list) cells.set(key, (list = []));
    list.push(I[t], I[t + 1], I[t + 2]);
  }
  const v = new THREE.Vector3();
  return [...cells.values()].map((list) => {
    const part = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geo.attributes)) part.setAttribute(name, attr);
    part.setIndex(new THREE.BufferAttribute(P.count > 65535 ? new Uint32Array(list) : new Uint16Array(list), 1));
    // (its bounds from its own corners: three's would take every vertex of the buffers it shares)
    const box = (part.boundingBox = new THREE.Box3());
    for (const i of list) box.expandByPoint(v.fromBufferAttribute(P, i));
    const sphere = (part.boundingSphere = new THREE.Sphere(box.getCenter(new THREE.Vector3()), 0));
    for (const i of list) sphere.radius = Math.max(sphere.radius, sphere.center.distanceToSquared(v.fromBufferAttribute(P, i)));
    sphere.radius = Math.sqrt(sphere.radius);
    const piece = new THREE.Mesh(part, mesh.material);
    piece.position.copy(mesh.position);
    piece.quaternion.copy(mesh.quaternion);
    piece.scale.copy(mesh.scale);
    piece.castShadow = mesh.castShadow;
    piece.receiveShadow = mesh.receiveShadow;
    piece.userData = { ...mesh.userData };
    return piece;
  });
}

/**
 * Everything under `root` that never moves, merged into one mesh per material (and per way it
 * takes shadow), so the house costs a few dozen draws instead of a thousand. Left alone: anything
 * that can be used or that moves (an `interact` or `live` on it or above it), instanced meshes,
 * meshes with a material per face, and see-through ones, which must stay sorted.
 */
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const moving = (o) => {
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.interact || p.userData.live) return true;
    return false;
  };
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) && !o.material.transparent && o.visible && !moving(o)) meshes.push(o);
  });
  const groups = new Map();
  for (const m of meshes) {
    let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    geo.morphAttributes = {};
    geo.clearGroups();
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.applyMatrix4(m.matrixWorld);
    if (m.matrixWorld.determinant() < 0) {
      // a mirrored piece: turn its triangles back round the right way
      for (const attr of Object.values(geo.attributes)) {
        for (let i = 0; i < attr.count; i += 3) {
          for (let k = 0; k < attr.itemSize; k++) {
            const a = attr.array[(i + 1) * attr.itemSize + k];
            attr.array[(i + 1) * attr.itemSize + k] = attr.array[(i + 2) * attr.itemSize + k];
            attr.array[(i + 2) * attr.itemSize + k] = a;
          }
        }
      }
    }
    const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}`;
    if (!groups.has(key)) groups.set(key, { material: m.material, cast: m.castShadow, receive: m.receiveShadow, list: [] });
    groups.get(key).list.push(geo);
    m.parent.remove(m);
  }
  for (const { material, cast, receive, list } of groups.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(list, false), material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    root.add(mesh);
  }
  return { merged: meshes.length, into: groups.size };
}

// ---------------------------------------------------------------- out of doors

/** The lighting code without the point, spot and area lights' parts (whether the include is still there or another patch has spelt it out). */
const noLamps = (s) => s.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin)
  .replace('( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )', '( 0 > 0 )')
  .replace('( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )', '( 0 > 0 )')
  .replace('( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )', '( 0 > 0 )');

/**
 * How strong the sun and the sky are on what is out of doors, as a share of what they are indoors: the eye
 * opens up indoors and the yard through a window is far brighter than the room; out in it, it isn't (house.js
 * sets it as you go in and out). The rooms keep theirs whatever: seen from the yard they look as they do from
 * inside (user, 2026-10-20).
 */
import { YARD_SUN } from './util.js';
export { YARD_SUN };

/** `m`'s sun and sky scaled by YARD_SUN, and its fill the open air's (`twoFills`): an outdoor thing, whatever lamps light it. */
export function outdoorSun(m, lamps = true) {
  if (m.userData.outdoorSun) return;
  m.userData.outdoorSun = true;
  const before = m.onBeforeCompile, key = m.customProgramCacheKey.bind(m), as = m.userData.sunAs; // (the sun's colour, multiplied by `as`, on this one: { tint: the sun's colour normalised, as })
  m.onBeforeCompile = (sh, r) => {
    before.call(m, sh, r);
    sh.uniforms.uYardSun = YARD_SUN;
    if (as) Object.assign(sh.uniforms, { uSunTint: { value: as.tint }, uSunAs: { value: as.as } });
    let f = sh.fragmentShader.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin);
    f = f.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= uYardSun;' + (as ? '\n\t\tif ( distance( normalize( directionalLight.color ), uSunTint ) < 0.02 ) directLight.color *= uSunAs;' : ''));
    sh.fragmentShader = '#define OUTDOOR_FILL\nuniform float uYardSun;\n' + (as ? 'uniform vec3 uSunTint;\nuniform vec3 uSunAs;\n' : '') + (lamps ? f : noLamps(f));
  };
  m.customProgramCacheKey = () => key() + (lamps ? '|outdoorSun' : '|outdoors') + (as ? '|sunAs' : '');
  m.needsUpdate = true;
}

/** `m` lit by the sun, the sky and the open air alone (its directional and hemisphere lights): see `outdoorsOnly`. */
export function outdoorLit(m) {
  if (m.userData.outdoors) return;
  m.userData.outdoors = true;
  outdoorSun(m, false);
}

/**
 * Before the bake: a thing out of doors whose material is also used indoors gets its own copy of it, so it can be
 * lit as out of doors (outdoorsOnly) while the rooms keep theirs — the window's casing outside, the tap's brass.
 */
export function splitOutdoor(root, rooms, wall = 0) {
  const box = new THREE.Box3(), inside = new Set(), outside = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    box.makeEmpty().expandByObject(o, false);
    // (what is in a wall counts as the room's — a window's sash, seen from both sides; what stands out of a wall's
    // outer face, or over the ceilings, is outside)
    const indoors = rooms.some((r) => box.max.x > r.x0 - wall + 0.02 && box.min.x < r.x1 + wall - 0.02 && box.max.z > r.z0 - wall + 0.02 && box.min.z < r.z1 + wall - 0.02 && box.min.y < 2.51);
    if (indoors) for (const m of Array.isArray(o.material) ? o.material : [o.material]) inside.add(m);
    else outside.push(o);
  });
  const copies = new Map();
  const copy = (m) => {
    if (!inside.has(m) || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial) || m.userData.outdoors || m.userData.outdoorSun) return m;
    if (!copies.has(m)) { const c = m.clone(); outdoorLit(c); copies.set(m, c); } // (marked now: merged by the bake, its pieces all round the house make one mesh whose bounds take in the rooms, and outdoorsOnly would have kept it indoors)
    return copies.get(m);
  };
  for (const o of outside) o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material);
  return copies.size;
}

/**
 * What is out of doors is lit by the sun, the sky and the open air, and by nothing else: the lamps, the
 * window panels and the corridor's spot can't reach it through the walls. But three.js works out every light
 * in a scene for every pixel of it, and out there — the lawn, the grass, the leaves on their cards layer over
 * layer, the bark — that was most of the cost: the yard ran at 9–11 frames a second once the willow was in
 * (user, 2026-10-18: "it lags since the willow"; measured: 97 ms a frame looking at the wood, 33 without the
 * lamps, the same picture). Every material whose meshes under `root` all stand clear of `rooms` ({ x0, x1,
 * z0, z1 }, up to the ceiling) gets lighting code without them; one also used indoors keeps them all.
 */
export function outdoorsOnly(root, rooms) {
  const box = new THREE.Box3(), seenIndoors = new Map();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    box.makeEmpty().expandByObject(o, false);
    const indoors = rooms.some((r) => box.max.x > r.x0 + 0.02 && box.min.x < r.x1 - 0.02 && box.max.z > r.z0 + 0.02 && box.min.z < r.z1 - 0.02 && box.min.y < 2.51); // (2.51: the ceilings' height; the roof's soffit and fascia over the rooms are out of doors — lit as indoors they shone, seen from the yard: user, 2026-10-20)
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) seenIndoors.set(m, seenIndoors.get(m) || indoors);
  });
  let n = 0;
  for (const [m, indoors] of seenIndoors) if (!indoors && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) { outdoorLit(m); n++; }
  return n;
}

// A surface turned away from a light gets none of it (its share goes with the cosine, and stops at 0), so the light's
// shadow need not be looked up there: indoors, five lamps' shadows, up to a hundred texture reads a pixel, read for
// nothing. The same picture. (Clearcoat, with a normal of its own, and toon shading, which lights the far side, keep
// theirs; a cut-out lit on both faces turns its normal before this, so it goes by the normal it is lit by.)
{
  const facing = `
		#if !defined( USE_CLEARCOAT ) && !defined( TOON )
		directLight.visible = directLight.visible && dot( geometryNormal, directLight.direction ) > 0.0;
		#endif`;
  const calls = ['getPointLightInfo( pointLight, geometryPosition, directLight );', 'getSpotLightInfo( spotLight, geometryPosition, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );'];
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  if (calls.every((c) => chunk.split(c).length === 2)) THREE.ShaderChunk.lights_fragment_begin = calls.reduce((s, c) => s.replace(c, c + facing), chunk);
}

/**
 * Two hemisphere lights in one scene, each for its own side of the walls (user, 2026-10-20: "from the yard the
 * rooms look far brighter than from inside"): there was one fill for the whole house, set by where your eye
 * was — out in the yard the open sky's, so the rooms seen through the door and the windows took it too. Now
 * the scene's first hemisphere light lights what is indoors, always the same, and the second what is out of
 * doors (outdoorLit's materials, OUTDOOR_FILL). With one hemisphere light (every other scene) nothing changes.
 */
export function twoFills() {
  const loop = `	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif`;
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  if (!chunk.includes(loop)) return; // (already done)
  THREE.ShaderChunk.lights_fragment_begin = chunk.replace(loop, `	#if ( NUM_HEMI_LIGHTS == 1 )
		irradiance += getHemisphereLightIrradiance( hemisphereLights[ 0 ], geometryNormal );
	#elif ( NUM_HEMI_LIGHTS > 1 )
		#ifdef OUTDOOR_FILL
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ 1 ], geometryNormal );
		#else
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ 0 ], geometryNormal );
		#endif
	#endif`);
}
