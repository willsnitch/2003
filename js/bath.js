// The bath's water. Two taps you can turn, hot and cold; the water runs from the spout for as long
// as either is on, fills the bath (steaming if it runs hot), and once the bath is full it goes over
// the front, spreads across the bathroom floor, and then the bathroom fills: the level goes on rising
// for as long as a tap runs, and the water stays in the bathroom, standing in the doorway like a wall
// of glass (user, 2026-10-15). Nothing turns it off but you, and nothing drains it.
import * as THREE from 'three';
import * as T from './textures.js';
import { canvasTex, fbm } from './util.js';
import { roundRectShape, bathDuck } from './fixtures.js';
import { bubbles } from './bubbles.js';
import { waterUniforms, waterSurface, PlanarReflection, CAUSTICS, RippleSim } from './water.js';

const ONE_TAP = 60; // seconds for one tap to fill the bath from empty: two do it in half
const SPREAD = 10; // seconds for one tap's overflow to cover the whole floor, however long it is
const RISE = 0.005; // metres a second the bathroom fills with one tap running, once the floor is covered
const std = (o) => new THREE.MeshStandardMaterial(o);

/**
 * `g`: where to put it; `tub`: the bath (fixtures.bathtub), already placed; `taps`: its taps
 * (fixtures.bathTaps), already placed; `floor`: the bathroom floor in front of the bath, {x0, x1, z0, z1},
 * the bath's front along z1; `room`: the whole bathroom, the same way; `door`: the doorway's {x0, x1} in
 * the room's z0 wall; `top`, how high it stands when the room is full (just under the top of the door),
 * and `ceiling`, as high as it goes after that, the door shut; `env`: what the water reflects; `towel`:
 * the towel rail (fixtures.towelRail), whose towel floats once the water reaches it; `bowl`: the water
 * standing in the toilet, lost under the flood once it is over it.
 */
export function bathWater(g, ctx, { tub, taps, floor, room, door, top, ceiling = top, env, towel, bowl, basin = null }) {
  g.updateMatrixWorld(true);
  const at = tub.position.clone(); // the bath isn't turned: its own frame is the room's, moved
  const { floor: bottom, rim, inside } = tub.userData;
  const mouth = taps.group.localToWorld(taps.mouth.clone()), inlet = taps.group.localToWorld(taps.inlet.clone());
  // `boost`: how much harder the taps run — 2 once Luna is in her boat (boat.js), so the room fills twice as fast (user, 2026-10-16)
  const state = { hot: false, cold: false, level: bottom, heat: 0, spread: 0, flood: 0, boost: 1 };
  let drainT = null; // all of it going back (drain): { t, secs, done, and where flood, spread and level started from }
  const plugAt = new THREE.Vector3(at.x + tub.userData.plug, bottom, at.z);

  // ---- how water looks (user, 2026-10-16: as a big engine draws it — water.js): waves, rings, a planar
  // reflection with Fresnel, Snell's window from under it. The bath's water and the room's share it.
  const WU = waterUniforms(), rippleU = WU.uRipple, bathRefl = { value: 0 }, roomRefl = { value: 0 };
  const mirror = new PlanarReflection();
  // the ripples, over the whole bathroom (water.js RippleSim): what stirs the water pushes it (`disturb`)
  const sim = new RippleSim(room);
  Object.assign(WU, sim.uniforms);
  // the floor's water its own reflection, drawn at its own height: till it is one with the bath's it had none, only the
  // white room it reflects when there is none — a pale film on it up to the bath's top (user, 2026-11-03)
  const floorMirror = new PlanarReflection(), floorU = Object.assign({}, WU, { uReflTex: { value: null }, uReflMat: { value: new THREE.Matrix4() } });
  let maskKey = '', maskIn = 0;

  // ---- the water in the bath: its surface, cut to the bath's shape at whatever height it has reached
  const water = std({ color: 0x6f8e92, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.35, envMap: env, envMapIntensity: 0.7, depthWrite: false });
  waterSurface(water, WU, bathRefl);
  const surface = new THREE.Mesh(new THREE.BufferGeometry(), water);
  surface.renderOrder = 2;
  surface.visible = false;
  g.add(surface);
  let shapedAt = -1;
  const reshape = () => {
    const [w, d, r] = inside(state.level);
    surface.geometry.dispose();
    surface.geometry = new THREE.ShapeGeometry(roundRectShape(w, d, r), 6).rotateX(-Math.PI / 2);
    surface.position.set(at.x, state.level, at.z);
    shapedAt = state.level;
  };

  // ---- the running water: a column from the spout down to where it lands, a ring where it hits the water
  const column = fallingWater(env), streamTime = column.userData.time;
  column.position.copy(inlet);
  g.add(column);
  // where it lands: churned white water turning round on itself, two layers each its own way, and
  // drops thrown up out of it that fall back
  const foamMat = new THREE.MeshStandardMaterial({ map: foamTex(), color: 0xf2f6f7, roughness: 0.5, transparent: true, depthWrite: false, envMap: env, envMapIntensity: 0.6 });
  const ring = new THREE.Group(); // (the foam, where the stream lands)
  for (const k of [1, -1]) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), foamMat);
    f.userData.spin = k * (1.3 + Math.random());
    f.position.y = k > 0 ? 0.0012 : 0.0006;
    ring.add(f);
  }
  ring.visible = false;
  ring.renderOrder = 3;
  ring.children.forEach((f) => { f.renderOrder = 3; });
  g.add(ring);
  const dropMat = new THREE.MeshStandardMaterial({ color: 0xe8f0f2, roughness: 0.05, transparent: true, opacity: 0.8, envMap: env, envMapIntensity: 1.2 });
  const drops = Array.from({ length: 40 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), dropMat);
    m.visible = false;
    m.renderOrder = 3;
    g.add(m);
    return { m, v: new THREE.Vector3(), live: false, floor: 0 };
  });
  let splash = 0, rippling = 0;
  // under the water, the tap still running: bubbles out of the spout, rising, so you can see it is
  const tapBubbles = bubbles(g, 220, () => state.flood); // enough for a steady column all the way up
  let tapBubbling = 0;
  const _push = new THREE.Vector3(), _at = new THREE.Vector3();
  // where the column lands while the bath is still empty: on the sloping end, below the spout
  const local = mouth.x - at.x;
  let endHit = bottom;
  for (let y = rim; y > bottom; y -= 0.005) {
    if (Math.abs(local) > inside(y)[0] / 2) { endHit = y; break; }
  }

  // ---- steam off hot water: a few soft puffs rising and thinning
  const puffMat = new THREE.MeshBasicMaterial({ map: puffTex(), transparent: true, depthWrite: false, opacity: 0 });
  const puffs = Array.from({ length: 14 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), puffMat.clone());
    m.visible = false;
    m.renderOrder = 4;
    m.userData.age = (i / 14) * 6;
    g.add(m);
    return m;
  });

  // ---- going down the plug hole, plug and all (drain): a whirl over it, turning fast, wider as the bath empties
  const whirl = new THREE.Mesh(new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2), std({ color: 0xdfe8ea, alphaMap: whirlTex(), roughness: 0.05, metalness: 0, transparent: true, opacity: 0, envMap: env, envMapIntensity: 1.2, depthWrite: false }));
  whirl.renderOrder = 3;
  whirl.receiveShadow = true;
  whirl.visible = false;
  g.add(whirl);

  // ---- over the front once it is full, and the spread of it on the floor (user, 2026-10-15: more real).
  // The water wells over the rolled lip, runs across the bath's top in one sheet, round its front edge and
  // down the tiled front, close to it: a thin film where the tiles show through, thicker runs here and
  // there, ripples running down it. It starts at one place along the lip and spreads both ways; when the
  // taps go off it thins, the thin parts going first, until only a few runs are left, then nothing. Where
  // it reaches the water on the floor: a line of churned foam, and drops thrown up out of it.
  const fz = floor.z1;
  const SPAN = 1.32; // along the front, where the opening runs straight
  // its path, [into the bath from its front, height], 1.5-3 mm off the enamel and the tiles
  const path = [[0.083, 0.549], [0.0805, 0.5585], [0.0755, 0.5655], [0.069, 0.5687], [0.0625, 0.5655], [0.058, 0.562], [0.05, 0.5615], [0.01, 0.5615], [0.004, 0.5605], [0, 0.557], [-0.0028, 0.551], [-0.003, 0.54], [-0.003, 0.27], [-0.003, 0]];
  const along = [0];
  for (let i = 1; i < path.length; i++) along.push(along[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const total = along[along.length - 1], EDGE = along[11] / total; // where it goes over the front edge
  const NX = 96, sp = [], suv = [], sidx = [];
  for (let i = 0; i <= NX; i++) {
    const u = i / NX;
    path.forEach(([dz, y], j) => { sp.push(at.x - SPAN / 2 + u * SPAN, y, fz + dz); suv.push(u, along[j] / total); });
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < path.length - 1; j++) {
    const a = i * path.length + j, b = a + 1, c = a + path.length, d = c + 1;
    sidx.push(a, c, b, b, c, d);
  }
  const sheetGeo = new THREE.BufferGeometry();
  sheetGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sheetGeo.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2));
  sheetGeo.setIndex(sidx);
  sheetGeo.computeVertexNormals();
  const runs = runsTex(), ripples = ripplesTex();
  runs.repeat.set(4, 1.4);
  ripples.repeat.set(9, 3);
  const spillU = { uCover: { value: 0 }, uFlow: { value: 0 }, uFloor: { value: 0 }, uOrigin: { value: 0.38 }, uEdge: { value: EDGE }, uSpan: { value: SPAN }, uLen: { value: total }, uTime: { value: 0 } };
  // dark and glossy: what shows of water on a wall is what it gives back, and the wall gone darker under it
  const sheet = new THREE.Mesh(sheetGeo, std({ color: 0x4c5a60, roughness: 0.04, metalness: 0, transparent: true, depthWrite: false, envMap: env, envMapIntensity: 1.7, alphaMap: runs, bumpMap: ripples, bumpScale: 0, side: THREE.DoubleSide }));
  // (user, 2026-10-16, twice: make it more real) not a pattern sliding down but water: a thin glossy film
  // all over that darkens the tiles, a few thicker runs where it gathers, wandering a little and slowly
  // shifting, and roll waves — the little steps a film of running water forms — racing down them faster
  // than the film itself, each run its own, so the lamp's glints run down it as they do on the real thing
  sheet.material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, spillU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSpill;\nvarying float vSpillY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpill = uv;\nvSpillY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vSpill;
        varying float vSpillY;
        uniform float uCover, uFlow, uFloor, uOrigin, uEdge, uSpan, uLen, uTime;
        float sHash(float n) { return fract(sin(n) * 43758.5453); }
        float sNoise(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(sHash(i), sHash(i + 1.0), f); }`)
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        if (vSpillY < uFloor) discard; // under the water on the floor: nothing to see
        vec2 sm = vec2(vSpill.x * uSpan, vSpill.y * uLen); // in metres: across, and down along its path
        float down = smoothstep(uEdge - 0.01, uEdge + 0.04, vSpill.y); // 0 over the lip, 1 down the front
        // the runs: where the flow gathers, wandering from side to side down the front, slowly shifting
        float mx = sm.x + 0.012 * sin(sm.y * 9.0 + sNoise(sm.x * 3.0) * 6.0) + 0.005 * sin(sm.y * 23.0 + sm.x * 5.0) + 0.008 * sin(uTime * 0.4 + sm.x * 7.0);
        float riv = clamp(pow(sNoise(mx * 14.0), 6.0) * 2.2, 0.0, 1.0) * down;
        // roll waves racing down, each run its own
        float roll = pow(0.5 + 0.5 * sin(sm.y * 34.0 - uTime * 26.0 + sNoise(mx * 6.0) * 9.0), 5.0);
        float spillHt = 0.003 * riv + 0.0014 * roll * (0.35 + riv) + 0.0004 * sin(sm.x * 60.0 + sm.y * 13.0 - uTime * 3.0);
        // water on white glazed tiles hardly darkens them (a little, more where it runs thick): it shows by
        // what it gives back, the room and the lamp bent in its runs and waves (spillGloss, added whole)
        float a = 0.16 + 0.42 * riv + 0.16 * roll;
        a = max(a, (1.0 - down) * 0.22); // over the lip: one sheet
        float spread = 1.0 - smoothstep(uCover * 0.85 - 0.05, uCover * 0.85 + 0.03, abs(vSpill.x - uOrigin));
        float ends = smoothstep(0.0, 0.06, vSpill.x) * smoothstep(1.0, 0.94, vSpill.x);
        float there = spread * ends * smoothstep(0.0, 0.3, uFlow); // drying up, it goes
        diffuseColor.a = a * there;
        float spillGloss = there * (0.15 + 0.85 * riv) * mix(1.0, 0.6, (1.0 - uFlow)); // the runs shine; the film between stays clear`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = perturbNormalArb(-vViewPosition, normal, vec2(dFdx(spillHt), dFdy(spillHt)), faceDirection);')
      .replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor.rgb = totalDiffuse * gl_FragColor.a + totalSpecular * spillGloss * 3.0;');
  };
  sheet.material.premultipliedAlpha = true; // (its reflections added whole, its darkening by its alpha)
  sheet.material.customProgramCacheKey = () => 'bath-spill-sheet-3';
  sheet.renderOrder = 2.2;
  sheet.visible = false;
  g.add(sheet);
  // ---- and over the lip, a curtain of it falling clear of the front (user, 2026-10-17, a third time: the
  // way the water comes down from the bath "is so badly done"): it rolls over the edge and drops a
  // centimetre or two off the tiles, in strands that run together and come apart as they fall, faster and
  // thinner the further down, white where the air is in it; at the bottom it churns the water on the floor
  // (ripples running off across the room, and the foam band)
  const cpath = [[0.006, 0.5612], [0.001, 0.5585], [-0.004, 0.553], [-0.009, 0.544], [-0.013, 0.53], [-0.017, 0.505], [-0.02, 0.46], [-0.022, 0.38], [-0.024, 0.25], [-0.025, 0.12], [-0.025, 0]];
  const calong = [0];
  for (let i = 1; i < cpath.length; i++) calong.push(calong[i - 1] + Math.hypot(cpath[i][0] - cpath[i - 1][0], cpath[i][1] - cpath[i - 1][1]));
  const CL = calong[calong.length - 1], NCX = 140, cp = [], cuv = [], cidx = [];
  for (let i = 0; i <= NCX; i++) cpath.forEach(([dz, y], j) => { cp.push(at.x - SPAN / 2 + (i / NCX) * SPAN, y, fz + dz); cuv.push(i / NCX, calong[j] / CL); });
  for (let i = 0; i < NCX; i++) for (let j = 0; j < cpath.length - 1; j++) {
    const a = i * cpath.length + j, b = a + 1, c = a + cpath.length, d = c + 1;
    cidx.push(a, c, b, b, c, d);
  }
  const curtainGeo = new THREE.BufferGeometry();
  curtainGeo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
  curtainGeo.setAttribute('uv', new THREE.Float32BufferAttribute(cuv, 2));
  curtainGeo.setIndex(cidx);
  curtainGeo.computeVertexNormals();
  // it bends what is behind it (transmission: the tiles seen through it, wavering), and gives back the room
  const curtainMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transmission: 1, thickness: 0.15, ior: 1.33, transparent: true, depthWrite: false, envMap: env, envMapIntensity: 1.2, bumpMap: ripples, bumpScale: 0, side: THREE.DoubleSide });
  curtainMat.premultipliedAlpha = true;
  curtainMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, spillU, { uCLen: { value: CL } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vC;\nvarying float vCY;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vC = uv;
        transformed.z += sin(uv.x * 37.0 + uTime * 5.0) * 0.0012 * uv.y; // it never falls quite flat
        vCY = (modelMatrix * vec4(transformed, 1.0)).y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vC;
        varying float vCY;
        uniform float uCover, uFlow, uFloor, uOrigin, uSpan, uCLen, uTime;
        float cH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float cN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(cH(i), cH(i + vec2(1.0, 0.0)), f.x), mix(cH(i + vec2(0.0, 1.0)), cH(i + vec2(1.0, 1.0)), f.x), f.y); }`)
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
        if (vCY < uFloor) discard;
        vec2 sm = vec2(vC.x * uSpan, vC.y * uCLen); // metres: across, and down from the lip
        float fall = sm.y;
        // where the flow gathers into strands, straight down (it falls), shifting only slowly; lower down they part
        float sx = sm.x + 0.003 * sin(uTime * 0.7 + sm.x * 11.0);
        float strands = cN(vec2(sx * 26.0, uTime * 0.12)) * 0.6 + cN(vec2(sx * 61.0 + 3.0, uTime * 0.17)) * 0.4;
        float body = smoothstep(0.25 + fall * 0.5, 0.55 + fall * 0.4, strands);
        // long thin streaks racing down them, faster the further they have fallen
        float streak = pow(cN(vec2(sx * 140.0, fall * 2.5 - uTime * (6.0 + fall * 10.0))), 3.0);
        float cA = body * (0.55 + 0.45 * streak);
        cA = max(cA, (1.0 - smoothstep(0.0, 0.035, fall)) * 0.6); // rolling over the edge: one sheet
        float spread = 1.0 - smoothstep(uCover * 0.85 - 0.05, uCover * 0.85 + 0.03, abs(vC.x - uOrigin));
        float ends = smoothstep(0.0, 0.06, vC.x) * smoothstep(1.0, 0.94, vC.x);
        float there = spread * ends * smoothstep(0.0, 0.3, uFlow);
        diffuseColor.a = cA * there;
        float curtHt = 0.003 * streak * body + 0.0025 * strands;`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = perturbNormalArb(-vViewPosition, normal, vec2(dFdx(curtHt), dFdy(curtHt)), faceDirection);')
      .replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor.rgb = (totalDiffuse + totalSpecular * 1.6) * gl_FragColor.a;');
  };
  curtainMat.customProgramCacheKey = () => 'bath-spill-curtain';
  const curtain = new THREE.Mesh(curtainGeo, curtainMat);
  curtain.renderOrder = 2.25;
  curtain.visible = false;
  g.add(curtain);
  // the churn where it meets the water on the floor: a band of foam along the foot of the bath
  const churn = foamBandTex();
  churn.repeat.set(5, 1);
  const churnMat = new THREE.MeshStandardMaterial({ map: churn, color: 0xeef3f4, roughness: 0.55, transparent: true, depthWrite: false, envMap: env, envMapIntensity: 0.5, opacity: 0 });
  const band = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, 0.06).rotateX(-Math.PI / 2), churnMat);
  band.position.set(at.x, 0.004, fz - 0.03);
  band.renderOrder = 2.3;
  band.visible = false;
  g.add(band);
  let spilling = 0, spillAge = 0, spillDrops = 0;
  // how soon each part of the floor gets wet once the bath runs over: 0 at the bath's front, 1 at the far end
  const fw = floor.x1 - floor.x0, fd = floor.z1 - floor.z0;
  const arrival = (x, z) => THREE.MathUtils.clamp((floor.z1 - z) / fd * 0.92 + (fbm(x * 3.1, z * 3.1, 7.3) - 0.5) * 0.22 + Math.pow(Math.abs((x - floor.x0) / fw - 0.5) * 2, 3) * 0.06, 0, 1);
  const arriveTex = canvasTex(128, Math.round((128 * fd) / fw), (cg, w, h) => {
    const img = cg.createImageData(w, h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const v = Math.round(arrival(floor.x0 + ((i + 0.5) / w) * fw, floor.z0 + ((j + 0.5) / h) * fd) * 255), k = (j * w + i) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
        img.data[k + 3] = 255;
      }
    }
    cg.putImageData(img, 0, 0);
  }, { data: true });
  arriveTex.flipY = false; // row 0 is z0
  const spreadU = { value: 0 };
  const puddleMat = std({ color: 0x66868a, roughness: 0.08, transparent: true, opacity: 0.32, envMap: env, envMapIntensity: 0.7, depthWrite: false });
  puddleMat.onBeforeCompile = (sh) => {
    sh.uniforms.uSpread = spreadU;
    sh.uniforms.uArrive = { value: arriveTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWet;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvWet = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSpread;\nuniform sampler2D uArrive;\nvarying vec2 vWet;')
      .replace('#include <alphatest_fragment>', 'float arrive = texture2D(uArrive, vWet).r;\nif (arrive > uSpread) discard;\ndiffuseColor.a *= smoothstep(uSpread, uSpread - 0.015, arrive);\n#include <alphatest_fragment>');
  };
  waterSurface(puddleMat, floorU, roomRefl);
  const puddleGeo = new THREE.PlaneGeometry(fw, fd).rotateX(-Math.PI / 2);
  // u along x from x0, v along z from z0, to match the map above
  const pp = puddleGeo.attributes.position, pu = puddleGeo.attributes.uv;
  for (let i = 0; i < pp.count; i++) pu.setXY(i, pp.getX(i) / fw + 0.5, pp.getZ(i) / fd + 0.5);
  const puddle = new THREE.Mesh(puddleGeo, puddleMat);
  puddle.position.set((floor.x0 + floor.x1) / 2, 0.003, (floor.z0 + floor.z1) / 2);
  puddle.renderOrder = 2; // after the dry lid in Luna's boat (boat.js)
  puddle.visible = false;
  puddleMat.side = THREE.DoubleSide; // seen from underneath too, once it is over your head
  puddleMat.forceSinglePass = true; // (only one side of a flat sheet is ever in sight: one pass, not two)
  g.add(puddle);
  // once it is over the bath, it is one water from wall to wall
  const roomGeo = new THREE.PlaneGeometry(room.x1 - room.x0, room.z1 - room.z0).rotateX(-Math.PI / 2);
  roomGeo.attributes.uv.array.fill(0); // nowhere still to reach: all of it already wet
  let whole = false;
  // and where the doorway is, the water simply stops: a face of it standing in the opening
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), std({ color: 0x6f8487, roughness: 0.05, transparent: true, opacity: 0.55, envMap: env, envMapIntensity: 1, depthWrite: false, side: THREE.DoubleSide }));
  // (behind the shut door's leaf, which stands 4-44 mm into the wall: in front of it, the face made the
  // door alone look blue from under the water — user, 2026-10-15)
  wall.position.set((door.x0 + door.x1) / 2, 0, room.z0 - 0.047);
  wall.scale.x = door.x1 - door.x0;
  wall.renderOrder = 2;
  wall.visible = false;
  g.add(wall);

  // ---- the taps: E on either turns both on (user, 2026-10-19: not one at a time), and once on they
  // never turn off again (user, 2026-11-02)
  const run = ctx.sound.steady('bath-run', mouth), spill = ctx.sound.steady('bath-spill', new THREE.Vector3(at.x, 0.2, fz));
  let stuck = false;
  for (const which of ['hot', 'cold']) {
    const head = taps[which];
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.08), new THREE.MeshBasicMaterial({ visible: false }));
    head.add(grip); // the cross is thin: something easier to point at
    head.userData.interact = {
      label: () => (state.hot || state.cold ? 'Turn off the taps' : 'Turn on the taps'),
      say: () => (stuck ? "It won't turn." : ''), // (after use: whether it was already on, or not to be turned on yet)
      use: () => {
        stuck = state.hot || state.cold || !api.mayOpen(); // (`mayOpen`: main.js — only with Luna in here and the door shut)
        if (stuck) return;
        state.hot = state.cold = true;
        ctx.sound.sample('tap-turn', head.getWorldPosition(new THREE.Vector3()));
      },
    };
    ctx.interact.push(head);
  }

  // ---- the basin's tap: lift its lever and the water runs, and away down the plug hole as it should
  const sink = basin ? runningBasin(g, ctx, basin, env, () => state.flood) : null;

  const inRoom = (x, z) => x > room.x0 && x < room.x1 && z > room.z0 && z < room.z1;
  // ---- seen from above, whatever is under the water is seen through it: green-grey and dim, the more
  // the more water there is between it and you (user: with the water just under your eyes, what was
  // under it looked dry). Every material in the house scene gets it (patch); from under the water
  // the screen's own tint does it instead (main.js).
  // (the box takes in the walls' own faces too, but not past the doorway)
  // Afloat, Luna's boat is dry inside though its boards are under the water's level outside: inside
  // the planes of its inside (`dry`) nothing is tinted. A material's `userData.waterSide`: 'dry' (the
  // boat's own inside: dry whenever the boat is), 'wet' (its outside, never dry).
  const DRY = 14;
  // (the boxes run on into the walls as far as the ceiling does, 13.5 cm, short of their outer faces; and the point
  // is taken on the surface itself, `centroid`: at its edges a wall or the ceiling seen side-on was worked out a
  // little — or a long way — past its end, out of the box, and with the light off it lit up there at full strength:
  // a line of light down both corners and along the top of the end wall, as you moved — user, 2026-11-03)
  const IN = 0.137;
  const volumeU = { uWL: { value: -9 }, uWBox: { value: new THREE.Vector4(room.x0 - IN, room.z0 - 0.02, room.x1 + IN, room.z1 + IN) }, uTL: { value: -9 }, uTBox: { value: new THREE.Vector4() }, uWCam: { value: new THREE.Vector3() }, uDry: { value: Array.from({ length: DRY }, () => new THREE.Vector4(0, 1, 0, 1e4)) }, uDryOn: { value: 0 }, uDim: { value: 1 }, uVTime: { value: 0 }, uDBox: { value: new THREE.Vector4(room.x0 - IN, room.z0 - IN, room.x1 + IN, room.z1 + IN) },
    // the ripples (the same as the water's, under other names: the water's own shader has those)
    uRipH: sim.uniforms.uSim, uRipBox: sim.uniforms.uSimBox, uRipTexel: sim.uniforms.uSimTexel, uRipOn: sim.uniforms.uSimOn };
  // The same patch dims the room with its light off (house.js, the switch by the door): in the box of
  // the room, the light from all round (the house's sky fill, what things reflect) goes down to `uDim`;
  // the lamps' own light is the lamps' business. The water itself gets only this (`noVolume`).
  const patched = new WeakSet();
  const patchOne = (m) => {
    if (patched.has(m) || m.userData.noWater || !(m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return;
    patched.add(m);
    const before = m.onBeforeCompile, key = m.customProgramCacheKey();
    const side = ({ dry: '#define DRY_SIDE\n', wet: '#define WET_SIDE\n' }[m.userData.waterSide] ?? '') + (m.userData.noVolume ? '#define NO_TINT\n' : '');
    m.onBeforeCompile = (sh, r) => {
      before?.call(m, sh, r);
      Object.assign(sh.uniforms, volumeU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\ncentroid varying vec3 vWaterW;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 waterW = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            waterW = instanceMatrix * waterW;
          #endif
          vWaterW = (modelMatrix * waterW).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${side}centroid varying vec3 vWaterW;\nuniform float uWL, uTL, uDryOn, uDim, uVTime;\nuniform vec4 uWBox, uTBox, uDBox, uDry[${DRY}];\nuniform vec3 uWCam;\nuniform sampler2D uRipH;\nuniform vec4 uRipBox;\nuniform vec2 uRipTexel;\nuniform float uRipOn;\n${CAUSTICS}`)
        // the window panels (house.js windowLight) can't cast shadows, and from the living room and the
        // kitchen their light went through the walls into the bathroom, which has no window: not in here
        .replace('#include <lights_fragment_begin>', 'bool inBathroom = vWaterW.x > uDBox.x && vWaterW.x < uDBox.z && vWaterW.z > uDBox.y && vWaterW.z < uDBox.w;\n' +
          THREE.ShaderChunk.lights_fragment_begin.replace('RE_Direct_RectArea( rectAreaLight,', 'if ( !inBathroom ) RE_Direct_RectArea( rectAreaLight,'))
        .replace('#include <lights_fragment_end>', `{
            float dimHere = (vWaterW.x > uDBox.x && vWaterW.x < uDBox.z && vWaterW.z > uDBox.y && vWaterW.z < uDBox.w) ? uDim : 1.0;
            #if defined( RE_IndirectDiffuse )
              irradiance *= dimHere;
              iblIrradiance *= dimHere;
            #endif
            #if defined( RE_IndirectSpecular )
              radiance *= dimHere;
            #endif
          }
          #include <lights_fragment_end>`)
        .replace('#include <fog_fragment>', `#include <fog_fragment>
          #ifndef NO_TINT
          {
            float lvl = (vWaterW.x > uWBox.x && vWaterW.x < uWBox.z && vWaterW.z > uWBox.y && vWaterW.z < uWBox.w) ? uWL : -9.0;
            if (vWaterW.x > uTBox.x && vWaterW.x < uTBox.z && vWaterW.z > uTBox.y && vWaterW.z < uTBox.w) lvl = max(lvl, uTL);
            bool dry = false;
            #if defined(DRY_SIDE)
              dry = uDryOn > 0.5;
            #elif !defined(WET_SIDE)
              if (uDryOn > 0.5) {
                dry = true;
                for (int i = 0; i < ${DRY}; i++) if (dot(uDry[i].xyz, vWaterW) + uDry[i].w < -0.002) dry = false;
              }
            #endif
            float lightHere = (vWaterW.x > uDBox.x && vWaterW.x < uDBox.z && vWaterW.z > uDBox.y && vWaterW.z < uDBox.w) ? uDim : 1.0;
            if (!dry && vWaterW.y < lvl) {
              // caustics: the light focused by the waves on what lies under them, sharp near the top
              #if defined( RE_IndirectDiffuse )
                vec3 nW = inverseTransformDirection(normal, viewMatrix);
                // the floor's pattern and the walls', each in its own plane, blended by how the surface faces:
                // a mix of their coordinates bent it into crowded squashed rings round the bath's curved
                // sides (user, 2026-10-16)
                float up = smoothstep(0.25, 0.85, abs(nW.y)), cst = 0.0;
                if (up > 0.01) cst += up * caustics(vWaterW.xz, uVTime);
                if (up < 0.99) cst += (1.0 - up) * caustics(vec2(vWaterW.x + vWaterW.z * 0.7, vWaterW.y * 1.3 + vWaterW.z * 0.3), uVTime);
                float depth = lvl - vWaterW.y;
                gl_FragColor.rgb *= 1.0 + 0.32 * cst * lightHere * exp(-depth * 0.55) * smoothstep(0.0, 0.04, depth) * (0.4 + 0.6 * max(nW.y, 0.0)); // (faint: still water)
                // and the ripples' own: their crests focus the light into bright rings on the bottom, their
                // troughs spread it thin (the curvature of the simulated surface over this point)
                if (uRipOn > 0.5) {
                  vec2 ruv = (vWaterW.xz - uRipBox.xy) / (uRipBox.zw - uRipBox.xy);
                  if (ruv.x > 0.0 && ruv.y > 0.0 && ruv.x < 1.0 && ruv.y < 1.0) {
                    vec2 cellM = (uRipBox.zw - uRipBox.xy) * uRipTexel;
                    float h0 = texture2D(uRipH, ruv).r;
                    float lap = (texture2D(uRipH, ruv + vec2(uRipTexel.x * 2.0, 0.0)).r + texture2D(uRipH, ruv - vec2(uRipTexel.x * 2.0, 0.0)).r - 2.0 * h0) / (4.0 * cellM.x * cellM.x)
                              + (texture2D(uRipH, ruv + vec2(0.0, uRipTexel.y * 2.0)).r + texture2D(uRipH, ruv - vec2(0.0, uRipTexel.y * 2.0)).r - 2.0 * h0) / (4.0 * cellM.y * cellM.y);
                    float focus = clamp(-lap * min(depth, 0.6) * 0.35, -0.5, 1.8) * smoothstep(0.0, 0.03, depth);
                    gl_FragColor.rgb *= 1.0 + focus * lightHere * (0.35 + 0.65 * max(nW.y, 0.0));
                  }
                }
              #endif
              // seen from above it: what the water took out of the light on the way, the red first, and
              // what it scatters back (as dark as the room is)
              if (uWCam.y > lvl) {
                float along = length(vWaterW - uWCam) * clamp((lvl - vWaterW.y) / max(uWCam.y - vWaterW.y, 1e-3), 0.0, 1.0);
                vec3 T = exp(-along * vec3(1.1, 0.42, 0.36));
                gl_FragColor.rgb = gl_FragColor.rgb * T + vec3(0.05, 0.115, 0.125) * lightHere * (1.0 - T);
              }
            }
            // your eyes under the room's water: all you see, you see through it — the further, the greener and dimmer
            if (uWCam.y < uWL && uWCam.x > uWBox.x && uWCam.x < uWBox.z && uWCam.z > uWBox.y && uWCam.z < uWBox.w) {
              float d = length(vWaterW - uWCam);
              float along = vWaterW.y > uWL ? d * clamp((uWL - uWCam.y) / max(vWaterW.y - uWCam.y, 1e-3), 0.0, 1.0) : d;
              vec3 T = exp(-along * vec3(0.45, 0.16, 0.13));
              gl_FragColor.rgb = gl_FragColor.rgb * T + vec3(0.045, 0.11, 0.12) * 0.6 * lightHere * (1.0 - T);
            }
          }
          #endif`);
    };
    m.customProgramCacheKey = () => key + '|under-water' + side;
    m.needsUpdate = true;
  };
  const volume = {
    /** Give everything in `scene` (and anything added to it later: call it again) the look of being under the water. */
    patch(scene) {
      scene.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) patchOne(m);
      });
    },
    /** Every frame: where your eye is, how high the room's water and the bath's stand. */
    update(eye) {
      volumeU.uWCam.value.copy(eye);
      WU.uCamUnder.value = state.flood > 0.002 && inRoom(eye.x, eye.z) && eye.y < state.flood ? 1 : 0;
      // from under it, what is in the water with you is between you and it: drawn after it (Luna's glass
      // bubble, the bubbles — user, 2026-10-16: the surface was over her helmet); still after the dry lid
      puddle.renderOrder = WU.uCamUnder.value ? 1.6 : 2;
      volumeU.uWL.value = state.flood > 0.002 ? state.flood : -9;
      if (state.level > bottom + 0.002) {
        const [w, d] = inside(state.level);
        volumeU.uTBox.value.set(at.x - w / 2, at.z - d / 2, at.x + w / 2, at.z + d / 2);
        volumeU.uTL.value = state.level;
      } else volumeU.uTL.value = -9;
    },
    /** How much of the light from all round there is in the room: 1 with its light on, little with it off. */
    dim(k) { volumeU.uDim.value = k; },
    /** That same amount of light, for what is drawn over the picture (the screen under the water, main.js). */
    light: () => volumeU.uDim.value,
    /** The boat's inside, as world planes facing in, while it floats dry; null when there is none. */
    dry(planes) {
      volumeU.uDryOn.value = planes ? 1 : 0;
      planes?.forEach((p, i) => volumeU.uDry.value[i].set(p.normal.x, p.normal.y, p.normal.z, p.constant));
    },
  };
  for (const m of [water, puddleMat, wall.material, column.material, sheet.material, curtainMat, whirl.material]) m.userData.noVolume = true; // the water itself
  const floaters = []; // things afloat that the towel keeps clear of: { on, x, z, yaw, hl, hw } (Luna's boat)
  // the ceiling light, once the water is up round it: the towel keeps away from it too
  floaters.push({ on: false, x: (room.x0 + room.x1) / 2, z: (room.z0 + room.z1) / 2, yaw: 0, hl: 0.17, hw: 0.17, lamp: true });
  const floater = towel ? floatingTowel(towel, room, floaters, ceiling, () => api.you) : null;
  // what the duck drifts round: the taps out from the wall, and what house.js sets in `api.blocks`
  // (the basin, the toilet, the cabinet and its door open), as boxes {x0, x1, z0, z1, base, top}
  const tapsBox = { x0: Math.min(room.x0, mouth.x) - 0.01, x1: Math.max(room.x0, mouth.x) + 0.035, z0: mouth.z - 0.14, z1: mouth.z + 0.14, base: mouth.y - 0.03, top: taps.group.position.y + 0.045 };
  const duck = rubberDuck(g, env, tub, floor.z1, room, floaters, ceiling, () => floater?.block() ?? null, () => [tapsBox, ...api.blocks()], (x, z, a) => api.disturb(x, z, a), () => api.you);
  const api = {
    /** How high the water may go: up to just under the top of the door. */
    top,
    /** For tuning from the console: the water's uniforms, the reflections and which surface uses which. */
    look: { WU, floorU, mirror, floorMirror, bathRefl, roomRefl, sim },
    /** Something stirs the water at x, z: ripples run out from there, `amp` strong (0.05 a touch, 0.6 a splash), `r` metres across. */
    disturb(x, z, amp = 0.3, r = 0.05) {
      sim.disturb(x, z, amp, r);
    },
    /** Every frame: the ripples stepped on (main.js), while there is any water in here at all. */
    simulate(renderer, dt) {
      sim.step(renderer, dt, state.flood > 0.002 || state.level > bottom + 0.002);
    },
    /**
     * Every frame, before the picture is drawn: if you are in the bathroom above its water, the room as the
     * water shows it (water.js PlanarReflection), on whichever surface you are looking at — the room's
     * once it is one water, the bath's before. `hide`: what must not be in it (what is in your hand).
     */
    reflect(renderer, scene, camera, hide = []) {
      bathRefl.value = roomRefl.value = 0;
      const eye = camera.position;
      if (!inRoom(eye.x, eye.z)) return;
      const skip = [surface, puddle, wall, sheet, band, ...hide];
      if (puddle.visible) { // the floor's water (under it: what is above, seen up through it)
        const under = whole && eye.y < state.flood;
        if (floorMirror.render(renderer, scene, camera, puddle.position.y, floorU, skip, under)) roomRefl.value = 1;
        if (under) return;
      }
      // and the bath's, while it is a water of its own
      if (surface.visible && mirror.render(renderer, scene, camera, state.level, WU, skip)) bathRefl.value = 1;
    },
    /** What stands up into the room's water, as boxes (set by house.js): the floating duck drifts round them. */
    blocks: () => [],
    /** Whether the taps may be turned on now (set by main.js). */
    mayOpen: () => true,
    /** You (the Player, set by main.js): walking or swimming into the duck, you push it. */
    you: null,
    volume,
    floaters,
    /** Where the towel is in the water, as a box {x0, x1, z0, z1, base, top}, or null while it is dry. */
    towelBlock: () => floater?.block() ?? null,
    /** The duck, once it floats, as a box {x0, x1, z0, z1, base, top}, or null while it sits on the bath. */
    duckBlock: () => duck.block(),
    /** Whether the floor is under water at x, z. */
    wet: (x, z) => (state.flood > 0.002 && inRoom(x, z)) || (state.spread > 0 && x > floor.x0 && x < floor.x1 && z > floor.z0 && z < floor.z1 && arrival(x, z) < state.spread),
    /** How high the water stands at x, z (−∞ outside the bathroom, or with none on the floor). */
    levelAt: (x, z) => (state.flood > 0.002 && inRoom(x, z) ? state.flood : -Infinity),
    /** Whether `p` (the eye) is under the water. */
    under: (p) => state.flood > 0.002 && inRoom(p.x, p.z) && p.y < state.flood,
    /** How high the water stands on the bathroom floor. */
    get flood() { return state.flood; },
    /** Whether the water is going back (drain), and how many seconds of that are left. */
    get draining() { return !!drainT; },
    get drainLeft() { return drainT ? drainT.secs - drainT.t : 0; },
    /** Whether it is up to the ceiling, as high as it goes. */
    get atCeiling() { return state.flood >= ceiling - 0.013; },
    /** The bath's top, and its plug hole (on its bottom). */
    rim,
    plug: plugAt,
    /**
     * All the water there is goes back the way it came, in `secs` (user, 2026-11-02: as the door is opened): down
     * out of the room, off the floor back up over the front into the bath, and away down its plug hole, the plug in
     * as it is; then the taps turn themselves off (user, 2026-11-02), and `done()`. They run on all the while till then.
     */
    drain(secs, done) {
      drainT = { t: 0, secs, done, flood: state.flood, spread: state.spread, level: state.level, swirl: 0 };
    },
    state,
    update(dt, time) {
      // the heads turn a quarter round to open
      for (const which of ['hot', 'cold']) {
        const head = taps[which], to = state[which] ? -Math.PI / 2 : 0;
        head.rotation.z += (to - head.rotation.z) * (1 - Math.exp(-dt * 10));
      }
      const flow = (state.hot ? 1 : 0) + (state.cold ? 1 : 0);
      let backUp = false; // (draining: the floor's water running back up the bath's front)
      if (drainT) {
        // going back, fast: the room's water down to the floor, then what is on the floor back up over the front into
        // the bath, then the bath down its plug hole, swirling round the plug
        const D = drainT, k = Math.min(1, (D.t += dt) / D.secs), part = (a, b) => THREE.MathUtils.smoothstep(k, a, b);
        state.flood = D.flood * (1 - part(0, 0.45));
        state.spread = D.spread * (1 - part(0.45, 0.72));
        state.level = THREE.MathUtils.lerp(D.level, bottom, part(0.68, 1));
        backUp = D.spread > 0 && k > 0.4 && k < 0.74;
        const going = THREE.MathUtils.smoothstep(k, 0.66, 0.72) * (1 - THREE.MathUtils.smoothstep(k, 0.95, 1));
        whirl.visible = going > 0.01;
        if (whirl.visible) {
          D.swirl += dt * 11;
          sim.disturb(plugAt.x + Math.cos(D.swirl) * 0.05, plugAt.z + Math.sin(D.swirl) * 0.05, 8 * dt, 0.03);
          const r = 0.045 + 0.06 * part(0.68, 1);
          whirl.position.set(plugAt.x, Math.max(state.level, bottom + 0.004) + 0.002, plugAt.z);
          whirl.scale.set(r, 1, r);
          whirl.rotation.y -= dt * 21; // (about three and a half times round a second, the way water goes down a plug hole here)
          whirl.material.opacity = 0.75 * going;
        }
        if (k >= 1) {
          drainT = null;
          whirl.visible = false;
          state.hot = state.cold = false;
          ctx.sound.sample('tap-turn', taps.group.localToWorld(new THREE.Vector3())); // (silent until there is a recording)
          D.done?.();
        }
      } else if (flow) {
        // the bath fills; what comes in hot warms what is there, what comes in cold cools it
        const room = rim - state.level, rise = ((rim - bottom) / ONE_TAP) * flow * dt;
        const into = Math.min(room, rise), depth = Math.max(0.001, state.level - bottom);
        const mix = (state.hot ? 1 : 0) / flow;
        state.heat += (mix - state.heat) * Math.min(1, into / (depth + into) + dt * 0.01);
        state.level += into;
        // over the side: first across the floor, then the room fills
        // (the room as long as it is or not, it fills in the same time: the water spreads over the whole floor in
        // SPREAD — faster down a longer one — and the level rises at RISE however much water that takes; user,
        // 2026-10-19: "the room must fill in the time it did before")
        if (rise > room - 1e-6) {
          if (state.spread < 1) state.spread = Math.min(1, state.spread + (flow * dt) / SPREAD);
          else state.flood = Math.min(ceiling - 0.012, state.flood + RISE * flow * state.boost * (state.flood >= ceiling / 2 ? 1.25 : 1) * dt); // up past the door's top, the door shut, to the ceiling; a quarter faster from halfway up (user, 2026-11-02)
        }
      } else state.heat = Math.max(0, state.heat - dt / 900); // cooling, slowly
      if (Math.abs(state.level - shapedAt) > 0.002) reshape();
      surface.visible = state.level > bottom + 0.002 && !whole;
      const over = drainT ? backUp : flow > 0 && state.level >= rim - 1e-4;
      // the column of water, thicker with both taps on, falling to the water or the enamel; once the
      // room's water is over the spout there is nothing falling to see
      const under = state.flood > mouth.y - 0.004;
      column.visible = flow > 0 && !under;
      if (flow && !under) {
        const land = Math.max(state.level, endHit, state.flood), len = inlet.y - land, r = (flow > 1 ? 0.0085 : 0.006) * (state.boost > 1 ? 1.3 : 1); // fuller, running harder
        column.scale.set(r, len, r);
        column.material.map.offset.y = (time * 2.6 * Math.sqrt(state.boost)) % 1;
        column.material.map.repeat.set(1, len * 6);
        streamTime.value = time;
        // the foam, on water it lands in (not on the bare enamel)
        const onWater = land > endHit + 0.002;
        ring.visible = onWater;
        ring.position.set(mouth.x, land + 0.0008, mouth.z);
        const size = (flow > 1 ? 0.075 : 0.055) * (1 + 0.08 * Math.sin(time * 11));
        ring.children.forEach((f, i) => {
          f.rotation.y += f.userData.spin * dt;
          f.scale.setScalar(size * (i ? 0.7 : 1));
        });
        // drops thrown up, as many as the stream is strong
        splash += dt * (flow > 1 ? 70 : 40);
        while (splash > 1) {
          splash--;
          const d = drops.find((k) => !k.live);
          if (!d) break;
          const a = Math.random() * Math.PI * 2, out = 0.06 + Math.random() * 0.2, up = (0.25 + Math.random() * 0.45) * (flow > 1 ? 1.15 : 1);
          d.live = true;
          d.floor = land;
          d.m.position.set(mouth.x + Math.cos(a) * 0.008, land + 0.004, mouth.z + Math.sin(a) * 0.008);
          d.v.set(Math.cos(a) * out, up, Math.sin(a) * out);
          d.m.scale.setScalar(0.0012 + Math.random() * 0.0022);
          d.m.visible = true;
        }
      } else ring.visible = false;
      if (flow && under) {
        tapBubbling += dt * (flow > 1 ? 24 : 15);
        while (tapBubbling > 1) {
          tapBubbling--;
          // driven down and out by the water coming out, then up they go
          const a = Math.random() * Math.PI * 2, out = Math.random() * 0.12;
          tapBubbles.emit(_at.copy(mouth).add(_push.set((Math.random() - 0.5) * 0.008, -0.004, (Math.random() - 0.5) * 0.008)), 0.002 + Math.random() * 0.006,
            _push.set(Math.cos(a) * out, -(0.2 + Math.random() * 0.35) * (flow > 1 ? 1.2 : 1), Math.sin(a) * out));
        }
      }
      tapBubbles.update(dt);
      sink?.update(dt, time);
      for (const d of drops) {
        if (!d.live) continue;
        d.v.y -= 9.8 * dt;
        d.m.position.addScaledVector(d.v, dt);
        if (d.m.position.y < d.floor) { d.live = false; d.m.visible = false; }
      }
      // rings running out from where it lands
      rippling += ((column.visible && ring.visible ? (flow > 1 ? 1 : 0.7) : 0) - rippling) * (1 - Math.exp(-dt * 2));
      rippleU.value.set(mouth.x, mouth.z, rippling, time);
      if (rippling > 0.05) sim.disturb(mouth.x + (Math.random() - 0.5) * 0.02, mouth.z + (Math.random() - 0.5) * 0.02, rippling * 9 * dt, 0.03); // and ripples spreading from it over the water
      WU.uTime.value = time;
      WU.uLight.value = volumeU.uDim.value;
      WU.uChop.value = 0.022 + (flow ? 0.035 * state.boost : 0); // still, but never glass; stirred while the taps run
      volumeU.uVTime.value = time;
      // over the front: it spreads along the lip once it starts, thins and stops when the taps do
      const fl = Math.max(0.003, state.flood);
      spilling += ((over ? 1 : 0) - spilling) * (1 - Math.exp(-dt * (over ? 1.6 : drainT ? 6 : 0.55))); // (going back, gone at once)
      spillAge = over ? spillAge + dt : spilling > 0.02 ? spillAge : 0;
      if (backUp) spillAge = Math.max(spillAge, 6); // (all along the front at once, going back)
      spillU.uFlow.value = spilling;
      spillU.uCover.value = Math.min(1.2, spillAge / 5);
      spillU.uFloor.value = fl;
      sheet.visible = spilling > 0.01 && state.flood < rim - 0.01;
      curtain.visible = sheet.visible;
      if (sheet.visible && spilling > 0.2) { // where it comes down into the water on the floor: churned, ripples running off
        const half = Math.min(0.45, spillU.uCover.value * 0.85);
        for (let k = 0; k < 3; k++) {
          const u = THREE.MathUtils.clamp(spillU.uOrigin.value + (Math.random() * 2 - 1) * half, 0.05, 0.95);
          sim.disturb(at.x - SPAN / 2 + u * SPAN, fz - 0.03, spilling * dt * 10, 0.035);
        }
      }
      spillU.uTime.value = time;
      const way = drainT ? -1 : 1; // (going back: up it, into the bath)
      runs.offset.y = (runs.offset.y - way * dt * 0.45) % 1; // running down (v grows downstream)
      ripples.offset.y = (ripples.offset.y - way * dt * 1.35) % 1;
      ripples.offset.x = Math.sin(time * 0.7) * 0.01;
      // the foam and the drops where it meets the floor's water
      const reach = Math.min(1, spillU.uCover.value * 0.85 + 0.03);
      band.visible = sheet.visible;
      band.position.y = fl + 0.0015;
      churnMat.opacity = 0.55 * spilling;
      churn.offset.x = Math.sin(time * 1.3) * 0.02;
      churn.offset.y = (time * 0.6) % 1;
      band.scale.x = Math.max(0.02, Math.min(1, 2 * reach)); // as far along as the sheet has spread
      band.position.x = at.x - SPAN / 2 + SPAN * THREE.MathUtils.clamp(spillU.uOrigin.value, reach, 1 - reach);
      if (sheet.visible && !drainT) {
        spillDrops += dt * 30 * spilling * reach;
        while (spillDrops > 1) {
          spillDrops--;
          const d = drops.find((k) => !k.live);
          if (!d) break;
          const u = THREE.MathUtils.clamp(spillU.uOrigin.value + (Math.random() * 2 - 1) * reach, 0.05, 0.95);
          d.live = true;
          d.floor = fl;
          d.m.position.set(at.x - SPAN / 2 + u * SPAN, fl + 0.004, fz - 0.006);
          d.v.set((Math.random() - 0.5) * 0.12, 0.18 + Math.random() * 0.35, -(0.05 + Math.random() * 0.22));
          d.m.scale.setScalar(0.001 + Math.random() * 0.0018);
          d.m.visible = true;
        }
      }
      if (whole && state.flood <= rim) { // down under the bath's top again (drain): the floor's water, as it spread
        whole = false;
        puddle.geometry = puddleGeo;
        puddle.position.x = (floor.x0 + floor.x1) / 2;
        puddle.position.z = (floor.z0 + floor.z1) / 2;
      }
      puddle.visible = state.spread > 0;
      spreadU.value = whole ? 2 : state.spread;
      if (!whole && state.flood > rim) {
        whole = true;
        puddle.geometry = roomGeo;
        puddle.position.x = (room.x0 + room.x1) / 2;
        puddle.position.z = (room.z0 + room.z1) / 2;
        surface.visible = false;
      }
      puddle.position.y = fl;
      puddleMat.opacity = 0.32; // how much you see down through it is the volume's business (deeper, murkier)
      wall.visible = state.flood > 0.004;
      wall.scale.y = Math.min(fl, top + 0.08); // the face of it stands only in the doorway
      // steam, as much as the water is hot
      const steam = surface.visible ? THREE.MathUtils.smoothstep(state.heat, 0.35, 0.9) : 0;
      for (const p of puffs) {
        p.userData.age += dt;
        if (p.userData.age > 6) {
          p.userData.age = 0;
          const [w, d] = inside(state.level);
          p.position.set(at.x + (Math.random() - 0.5) * w * 0.8, state.level, at.z + (Math.random() - 0.5) * d * 0.7);
          p.userData.drift = (Math.random() - 0.5) * 0.04;
        }
        const a = p.userData.age / 6;
        p.visible = steam > 0.01;
        p.position.y += dt * 0.07;
        p.position.x += dt * p.userData.drift;
        p.scale.setScalar(0.7 + a * 1.6);
        // seen by the light it catches: white with the light on, as dark as the room with it off (a little
        // grey with the door open) — white even at a whisper of opacity, it hung there like a glow
        const seen = volumeU.uDim.value;
        p.material.color.setScalar(seen);
        p.material.opacity = steam * 0.32 * Math.sin(Math.PI * a) * (0.3 + 0.7 * seen);
        if (ctx.camera) p.quaternion.copy(ctx.camera.quaternion);
      }
      floaters.find((f) => f.lamp).on = state.flood > ceiling - 0.11;
      floater?.update(dt, time, state.flood);
      duck.update(dt, time, state.flood);
      // the ripples' walls (now and then, when they change): the bath's side while the water is below its
      // rim — inside it and out are two waters then — and whatever stands up out of the water
      if ((maskIn -= dt) <= 0) {
        maskIn = 0.5;
        const standing = [tapsBox, ...api.blocks()].filter((b) => b && b.top > state.flood + 0.01 && (b.base ?? 0) < Math.max(state.flood, 0.01));
        const key = (whole ? 'w' : 'b') + standing.map((b) => [b.x0, b.x1, b.z0, b.z1].map((v) => v.toFixed(2)).join(',')).join(';');
        if (key !== maskKey) {
          maskKey = key;
          const [bw, bd] = inside(rim - 0.005);
          sim.setMask((x, z) => {
            if (standing.some((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)) return false;
            return whole || z < floor.z1 - 0.005 || (Math.abs(x - at.x) < bw / 2 && Math.abs(z - at.z) < bd / 2);
          });
        }
      }
      if (bowl) bowl.visible = state.flood < bowl.getWorldPosition(_bowlAt).y - 0.004;
      run.set(flow ? 0.7 + 0.3 * (flow - 1) : 0);
      spill.set(over ? 0.8 : 0);
    },
  };
  return api;
}

/** Running water: bright streaks down it, see-through between. */
export function streamTex() {
  return canvasTex(64, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w, y = Math.random() * h, len = 30 + Math.random() * 90;
      const gr = g.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, `rgba(255,255,255,${0.4 + Math.random() * 0.5})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(x, y, 2 + Math.random() * 4, len);
      g.fillRect(x, y - h, 2 + Math.random() * 4, len); // wrapped round, so it repeats seamlessly
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, 0, w, h);
  }, { repeat: [1, 1] });
}

/** A puff of steam: soft, white, nothing at its edge. */
/** The whirl over a plug hole, as an alpha map: bright streaks curling in to the middle, four arms, none alike. */
function whirlTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let arm = 0; arm < 4; arm++) {
      for (let k = 0; k < 3; k++) {
        const a0 = (arm / 4) * Math.PI * 2 + Math.random() * 0.5, curl = 2.2 + Math.random() * 0.9, wd = 2 + Math.random() * 4;
        g.beginPath();
        for (let i = 0; i <= 40; i++) {
          const t = i / 40, r = (0.06 + 0.42 * t) * w, a = a0 + curl * (1 - t) + k * 0.12;
          const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.strokeStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.35})`;
        g.lineWidth = wd;
        g.filter = `blur(${1 + k}px)`;
        g.stroke();
      }
    }
    g.filter = 'none';
    // nothing at the rim, so it melts into the water round it; thick in the middle, where it goes down
    g.globalCompositeOperation = 'multiply';
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, '#fff');
    gr.addColorStop(0.6, '#999');
    gr.addColorStop(1, '#000');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    const core = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.09);
    core.addColorStop(0, 'rgba(255,255,255,0.9)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core;
    g.fillRect(0, 0, w, h);
  }, { data: true });
}

function puffTex() {
  return canvasTex(128, 128, (g, w, h) => {
    for (let i = 0; i < 9; i++) {
      const x = w * (0.3 + Math.random() * 0.4), y = h * (0.3 + Math.random() * 0.4), r = w * (0.18 + Math.random() * 0.2);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
  });
}

const _bowlAt = new THREE.Vector3();

/**
 * The towel over its rail, once the water comes up to it (user, 2026-10-15: "it floats naturally on
 * the water, moving as the water rises"). While the rail is above the water, what hangs below the
 * waterline floats up: each side of the towel goes down from the waterline, turns in a soft loop and
 * comes back up, its hem lying at the surface, the loop swaying. Once the water is over the rail it
 * lifts off, settles into a doubled sheet lying on the water, and drifts, slowly turning, kept off the
 * walls and out of the way of anything else afloat (`floaters`). Worked in the rail's own frame:
 * x along it, y up from it, z out from the wall.
 */
function floatingTowel(rail, room, floaters, ceiling, you = () => null) {
  const mesh = rail.children.find((o) => o.userData.cloth);
  const C = mesh.userData.cloth, { path, segW, tw, out, rr, back, front } = C;
  const P = C.mid; // the cloth's middle surface: its shell is built round it (fixtures.js clothShell: C.sync)
  const total = path.length, backEnd = 18, frontStart = total - 23, topJ = Math.round((backEnd + frontStart) / 2);
  // arc length along the cloth from the back hem, and where the top of the rail is along it
  const arc = [0];
  for (let j = 1; j < total; j++) arc.push(arc[j - 1] + Math.hypot(path[j][0] - path[j - 1][0], path[j][1] - path[j - 1][1]));
  rail.updateMatrixWorld(true);
  const railY = rail.getWorldPosition(new THREE.Vector3()).y;
  const inv = new THREE.Matrix4().copy(rail.matrixWorld).invert();
  // the room in the rail's frame: how far along the wall each way, and across to the far wall
  const corners = [[room.x0, room.z0], [room.x1, room.z1]].map(([x, z]) => new THREE.Vector3(x, railY, z).applyMatrix4(inv));
  const along = [Math.min(corners[0].x, corners[1].x), Math.max(corners[0].x, corners[1].x)];
  const across = Math.max(corners[0].z, corners[1].z);
  const MARGIN = 0.15, RAD = 0.36; // kept off the walls (and what is on them); the doubled towel, as a circle
  const drift = { x: 0, z: 0, vx: 0, vz: 0, turn: 0, spin: 0 };
  let wet = false, block = null;
  const smooth = (e0, e1, x) => { const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
  const v = new THREE.Vector3();

  /** One side hanging from y = 0 at z = zp, `len` long, `dir` the way its loop turns; the point `l` down it. */
  const hang = (zp, len, dir, rmax, l, hl, time, phase) => {
    const sub = hl + len; // how much of it is under the water
    const dl = l - (0 - hl); // how far this point is below the waterline, along the cloth
    if (sub <= 0 || dl <= 0) return [zp, -l];
    const R = Math.min(rmax, sub / Math.PI) * (1 + 0.08 * Math.sin(time * 0.6 + phase)), a = Math.max(0, (sub - Math.PI * R) / 2);
    const sway = 0.008 * Math.sin(time * 0.5 + dl * 6 + phase) * Math.min(1, dl * 4);
    if (dl <= a) return [zp + dir * sway, hl - dl];
    if (dl <= a + Math.PI * R) {
      const f = (dl - a) / R;
      return [zp + dir * (R - R * Math.cos(f)) + dir * sway, hl - a - R * Math.sin(f)];
    }
    return [zp + dir * 2 * R + dir * sway, Math.min(hl - 0.003, hl - a + (dl - a - Math.PI * R))];
  };
  /** The point of the cloth at index j, in the rail's frame, its middle at height hl on the water. */
  const shapeAt = (j, hl, time) => {
    // hanging from the rail, the water at hl (≤ 0)
    let A;
    if (j <= backEnd) A = hang(out - rr, back, -1, (out - rr - 0.012) / 2, back * (1 - j / backEnd), hl, time, 0.0);
    else if (j >= frontStart) A = hang(out + rr, front, 1, 0.07, front * ((j - frontStart) / (total - 1 - frontStart)), hl, time, 1.7);
    else A = [out + path[j][0], path[j][1]];
    return A;
  };

  return {
    block: () => block,
    update(dt, time, flood) {
      const hl = flood - railY;
      if (hl <= -front) {
        if (wet) { // back on its rail as it was, not where it had drifted to
          P.set(C.rest); C.sync(hl); wet = false;
          Object.assign(drift, { x: 0, z: 0, vx: 0, vz: 0, turn: 0, spin: 0 });
          mesh.position.set(0, 0, 0); mesh.rotation.y = 0;
        }
        block = null;
        return;
      }
      wet = true;
      // (user, 2026-10-16: "very broken" going from the rail to the water and up) three shapes, one after
      // the other, none of them through the rail: hanging, the hems afloat (shapeAt); then, the water at the
      // rail, lying on it — the front half spread out on the water, the back half bunched up against the
      // wall behind the rail; then, only once the water is over the rail, the back half slides out over it
      // and under the front one: a doubled sheet, which drifts off
      const toLying = smooth(-0.05, 0, hl), lift = smooth(0.035, 0.15, hl); // lift: 1 = off the rail, afloat
      const Sb = arc[topJ]; // the back half's length
      const level = Math.min(hl, 0); // where the water stands on it while it hangs
      const sTop = arc[topJ], zW = 0.016, zG = out - rr - 0.008, W = zG - zW; // the gap behind the rail
      for (let j = 0; j < total; j++) {
        const sg = arc[j] - sTop;
        let [z, y] = toLying < 1 ? shapeAt(j, level, time) : [0, 0];
        if (toLying > 0) {
          // lying on the water at the rail: the back half, where it would run into the wall, folded to and fro
          // in the gap between the wall and the rail, each fold a little lower
          let lz = out + sg, ly = hl - 0.002;
          if (sg < 0 && lz < zG) {
            const d = zG - lz, k = Math.floor(d / W), f = d - k * W;
            lz = k % 2 === 0 ? zG - f : zW + f;
            ly = hl - 0.004 - 0.007 * (k + 1); // (the cloth has a body, 7 mm: room for every fold)
          }
          z = THREE.MathUtils.lerp(z, lz, toLying);
          y = THREE.MathUtils.lerp(y, ly, toLying);
        }
        if (lift > 0) {
          // the water over the rail: the back half drawn out from behind it, at the surface, under the front
          // half — from the fold first, the bunch after it fold by fold from the top, each only once the
          // water has it clear above the rail (user, 2026-10-17: it went through the rail coming off)
          const f = sg >= 0 ? lift : THREE.MathUtils.clamp((lift - 0.55 * (-sg / Sb)) / 0.45, 0, 1), e = f * f * (3 - 2 * f);
          const fz = out + Math.abs(sg), fy = sg >= 0 ? hl - 0.002 : hl - 0.012 * smooth(0, 0.02, -sg);
          z = THREE.MathUtils.lerp(z, fz, e);
          y = THREE.MathUtils.lerp(y, fy, e);
        }
        for (let i = 0; i <= segW; i++) {
          const u = i / segW, k = (j * (segW + 1) + i) * 3;
          const x = C.rest[k];
          // on the water the cloth lifts and settles with it, never quite flat
          const onWater = Math.max(toLying * (sg >= 0 ? 1 : 0.4), lift);
          const wave = 0.004 * Math.sin(time * 0.7 + z * 9 + x * 6) + 0.002 * Math.sin(time * 1.3 + u * 11);
          // soft, never a flat sheet: wet terry lies in low rucks, its edges sagging under the water a little
          // (both layers of it alike where it is doubled: by how far from the fold, not which side)
          const as = Math.abs(sg), rim = Math.max(0, 1 - Math.min(u, 1 - u) / 0.07, 1 - Math.min(j, total - 1 - j) / 3);
          const ruck = 0.007 * Math.sin(x * 23 + as * 17) * Math.sin(as * 11 - x * 9) + 0.003 * Math.sin(x * 41 + as * 29) - 0.009 * rim;
          let px = x * (1 + 0.04 * lift), py = Math.min(y + (wave + ruck) * onWater, ceiling - railY - 0.005), pz = z + (C.rest[k + 2] - out - path[j][0]) * (1 - toLying);
          if (lift < 1) {
            // never into the rail (round it, the way out from its middle) or the wall
            const dz = pz - out, dd = Math.hypot(dz, py), keep = rr + 0.005;
            if (dd < keep) { const kk = dd > 1e-5 ? keep / dd : 0; pz = dd > 1e-5 ? out + dz * kk : pz; py = dd > 1e-5 ? py * kk : keep; }
            pz = Math.max(pz, 0.012);
          }
          P[k] = px;
          P[k + 1] = py;
          P[k + 2] = pz;
        }
      }
      // afloat: drifting slowly, turning, off the walls, out of the way of the boat
      if (lift >= 1) {
        drift.vx += (Math.random() - 0.5) * 0.02 * dt;
        drift.vz += (Math.random() - 0.5) * 0.02 * dt;
        drift.spin += (Math.random() - 0.5) * 0.02 * dt;
        const cx = drift.x, cz = out + 0.26 + drift.z;
        for (const f of floaters) {
          if (!f.on) continue;
          v.set(f.x, railY, f.z).applyMatrix4(inv);
          // the boat as a capsule along its length
          const ax = Math.sin(f.yaw - rail.rotation.y), az = Math.cos(f.yaw - rail.rotation.y); // its length, in the rail's frame
          const t = THREE.MathUtils.clamp((cx - v.x) * ax + (cz - v.z) * az, -(f.hl - f.hw), f.hl - f.hw);
          const dx = cx - (v.x + ax * t), dz = cz - (v.z + az * t), d = Math.hypot(dx, dz) || 1, room2 = RAD + f.hw + 0.05;
          if (d < room2 + 0.15) {
            const push = (room2 + 0.15 - d) * 1.5;
            drift.vx += (dx / d) * push * dt;
            drift.vz += (dz / d) * push * dt;
          }
          // out of its way, but carried, not snapped: at most as fast as the boat could shove it
          if (d < room2) { const fix = Math.min(room2 - d, 0.35 * dt); drift.x += (dx / d) * fix; drift.z += (dz / d) * fix; }
        }
        // you, wading or swimming into it, the water at your height: pushed along ahead of you, and on a little
        // after (user, 2026-10-17)
        const p = you();
        if (p && flood > p.feet - 0.04 && flood < p.feet + p.eye + 0.12) {
          v.set(p.pos.x, railY, p.pos.y).applyMatrix4(inv);
          const px = v.x, pz = v.z;
          v.set(p.pos.x + p.vel.x, railY, p.pos.y + p.vel.y).applyMatrix4(inv); // your velocity, in its frame
          const pvx = v.x - px, pvz = v.z - pz, dx = cx - px, dz = cz - pz, d = Math.hypot(dx, dz) || 1e-3, reach = 0.3 + 0.2;
          if (d < reach) {
            const nx = dx / d, nz = dz / d, into = Math.max(0, pvx * nx + pvz * nz), vn = drift.vx * nx + drift.vz * nz, want = into + 0.02;
            drift.x += nx * (reach - d);
            drift.z += nz * (reach - d);
            if (vn < want) { drift.vx += nx * (want - vn); drift.vz += nz * (want - vn); }
            drift.spin += (dx * pvz - dz * pvx) * 0.6 * dt; // caught off its middle, it turns
          }
        }
        const fast = Math.hypot(drift.vx, drift.vz), cap = fast > 0.08 ? 1.2 : 0.08;
        const damp = Math.exp(-dt * (0.4 + 3 * Math.max(0, fast - 0.08))); // pushed fast, the water holds it back hard
        drift.vx = THREE.MathUtils.clamp(drift.vx * damp, -cap, cap);
        drift.vz = THREE.MathUtils.clamp(drift.vz * damp, -cap, cap);
        drift.spin = THREE.MathUtils.clamp(drift.spin * damp, -0.6, 0.6);
        drift.x += drift.vx * dt;
        drift.z += drift.vz * dt;
        drift.turn += drift.spin * dt;
        // the walls: the doubled sheet's own extent, turned as it is (a circle round its middle reached into
        // the wall it starts against, and put it out from it with a jump)
        const ct = Math.abs(Math.cos(drift.turn)), st = Math.abs(Math.sin(drift.turn)), HX = tw / 2 + 0.02, HZ = 0.27;
        const ex = ct * HX + st * HZ, ez = st * HX + ct * HZ, mz0 = out + 0.26;
        const minX = along[0] + 0.03 + ex, maxX = along[1] - 0.03 - ex, minZ = 0.02 + ez - mz0, maxZ = across - 0.03 - ez - mz0;
        if (drift.x < minX || drift.x > maxX) { drift.x = THREE.MathUtils.clamp(drift.x, minX, maxX); drift.vx *= -0.3; }
        if (drift.z < minZ || drift.z > maxZ) { drift.z = THREE.MathUtils.clamp(drift.z, minZ, maxZ); drift.vz *= -0.3; }
      }
      // turned and moved about its middle as it drifts
      mesh.position.set(drift.x, 0, drift.z);
      const mz = out + 0.26;
      mesh.rotation.y = drift.turn;
      mesh.position.x += -Math.sin(drift.turn) * mz;
      mesh.position.z += mz - Math.cos(drift.turn) * mz;
      C.sync(hl); // its shell round the middle, wet where the water has been
      // and where it is, for the boat to keep out of
      const box = lift >= 1 ? [drift.x - RAD, drift.x + RAD, mz + drift.z - RAD, mz + drift.z + RAD] : [-tw / 2 - 0.02, tw / 2 + 0.02, 0, 0.26];
      block = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, base: flood - (lift >= 1 ? 0.03 : 0.3), top: Math.max(flood, railY) + 0.03 };
      for (const bx of [box[0], box[1]]) for (const bz of [box[2], box[3]]) {
        v.set(bx, 0, bz).applyMatrix4(rail.matrixWorld);
        block.x0 = Math.min(block.x0, v.x); block.x1 = Math.max(block.x1, v.x);
        block.z0 = Math.min(block.z0, v.z); block.z1 = Math.max(block.z1, v.z);
      }
    },
  };
}

/** Churned white water: many small bubbles crowded at the middle, thinning out to the edge. */
/**
 * Where water runs down a surface: its alpha (green) — a thin film all over, thicker runs wandering down
 * it, beads hanging in them, a few drier streaks. Tiles both ways; v runs down.
 */
function runsTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = Math.random;
    g.fillStyle = 'rgb(62,62,62)'; // the film
    g.fillRect(0, 0, w, h);
    g.lineCap = g.lineJoin = 'round';
    // a run: nearly straight down, kinking a little now and then, closing on itself at the top and bottom
    const run = (width, shade) => {
      const x0 = r() * w, pts = [];
      let x = 0;
      for (let y = 0; y <= h; y += 8) {
        if (r() < 0.25) x += (r() - 0.5) * 6;
        pts.push([x, y]);
      }
      const drift = pts[pts.length - 1][0];
      g.strokeStyle = `rgb(${shade},${shade},${shade})`;
      g.lineWidth = width;
      for (const dx of [-w, 0, w]) {
        g.beginPath();
        pts.forEach(([px, y], i) => { const xx = x0 + px - (drift * y) / h + dx; (i ? g.lineTo(xx, y) : g.moveTo(xx, y)); });
        g.stroke();
      }
    };
    g.filter = 'blur(1.5px)';
    for (let i = 0; i < 6; i++) run(3 + r() * 5, 20 + r() * 25); // drier streaks
    for (let i = 0; i < 11; i++) run(1.5 + r() * 3.5, 150 + r() * 70); // runs
    g.filter = 'none';
    for (let i = 0; i < 30; i++) { // beads
      const x = r() * w, y = r() * h, rad = 1.2 + r() * 2.2;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgb(230,230,230)');
      gr.addColorStop(1, 'rgba(230,230,230,0)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x, y, rad * 0.8, rad * 1.3, 0, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: [1, 1], data: true });
}

/** Ripples on running water, as a bump map: soft streaks along the way it runs (v), tiling both ways. */
function ripplesTex() {
  return canvasTex(128, 256, (g, w, h) => {
    const r = Math.random;
    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);
    g.filter = 'blur(1.5px)';
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, len = 6 + r() * 26, v = Math.floor(90 + r() * 120);
      g.fillStyle = `rgb(${v},${v},${v})`;
      for (const [dx, dy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) g.fillRect(x + dx, y + dy, 1.5 + r() * 2.5, len);
    }
    g.filter = 'none';
  }, { repeat: [1, 1], data: true });
}

/** Churned water: white foam in clots and threads, its own alpha, tiling along x. */
function foamBandTex() {
  return canvasTex(256, 32, (g, w, h) => {
    const r = Math.random;
    g.clearRect(0, 0, w, h);
    g.filter = 'blur(1.2px)';
    for (let c = 0; c < 26; c++) { // clots: a few bubbles together, then gaps
      const cx = r() * w, n = 3 + Math.floor(r() * 8);
      for (let i = 0; i < n; i++) {
        const x = cx + (r() - 0.5) * 14, y = h * (0.35 + r() * 0.3), rad = 0.8 + r() * 2.6;
        for (const dx of [-w, 0, w]) {
          const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, rad);
          gr.addColorStop(0, `rgba(255,255,255,${0.25 + r() * 0.45})`);
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr;
          g.beginPath(); g.arc(x + dx, y, rad, 0, Math.PI * 2); g.fill();
        }
      }
    }
    g.filter = 'none';
  }, { repeat: [1, 1] });
}

function foamTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r0 = w / 2;
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.pow(Math.random(), 0.7) * r0 * 0.96;
      const x = r0 + Math.cos(a) * d, y = r0 + Math.sin(a) * d, s = 1 + Math.random() * (5 - 3.5 * (d / r0));
      const fade = Math.max(0, 1 - d / r0) ** 0.8;
      g.strokeStyle = `rgba(255,255,255,${0.55 * fade})`;
      g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.stroke();
      g.fillStyle = `rgba(255,255,255,${0.18 * fade})`;
      g.fill();
    }
    const gr = g.createRadialGradient(r0, r0, 0, r0, r0, r0);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.22)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

/**
 * A yellow plastic duck sitting on a corner of the bath (user, 2026-10-15). When the room's water comes
 * up over the bath's edge it floats off: bobbing, rocking, turning slowly, and drifting slowly one way
 * across the room, the way bending as it goes (user: it mustn't sit on the spot while the water rises);
 * it comes round off the walls and whatever stands up into the water (`blocks()`), keeps away from
 * whatever else is afloat (`floaters`: the boat, the ceiling light once the water is up round it;
 * `towel()`: the towel's box), and never goes up through the ceiling. Walk or swim into it (`you()`, the
 * Player) and it is pushed on ahead of you, gliding on a little after (user, 2026-10-16).
 */
function rubberDuck(g, env, tub, front, room, floaters, ceiling, towel, blocks, stir = () => {}, you = () => null) {
  const duck = bathDuck(env);
  duck.userData.live = true; // it moves: never baked into the room (build.bakeStatic)
  // the front corner by the east wall, where the bath's edge is widest, turned to look into the room
  const deck = tub.userData.rim + 0.012, R = 0.058; // the edge's top; the duck's reach, turned any way
  const sx = room.x1 - 0.08, sz = front + 0.062;
  duck.position.set(sx, deck, sz);
  duck.rotation.y = -2.45;
  g.add(duck);
  const me = { on: false, x: sx, z: sz, yaw: 0, hl: R, hw: R };
  floaters.push(me);
  const SPEED = 0.025; // m/s: slow, but you see it go
  // off it goes out into the room, away from its corner (x: sin, z: cos of the way)
  const s = { afloat: false, x: sx, z: sz, vx: 0, vz: 0, yaw: -2.45, spin: 0, way: Math.atan2(-0.6, -0.8) + (Math.random() - 0.5) * 0.8, bend: 0 };
  const WALL = R + 0.05, CLEAR = R + 0.012;
  let block = null, stirIn = 1, shoveRing = 0;
  /** What it would run into at x, z, riding at y: a wall ('x'/'z') or a box, or null. */
  const into = (x, z, y, list) => {
    if (x < room.x0 + WALL || x > room.x1 - WALL) return 'x';
    if (z < room.z0 + WALL || z > room.z1 - WALL) return 'z';
    for (const b of list) {
      if (b.top < y + 0.004 || (b.base ?? 0) > y + 0.09) continue; // under it (afloat over it), or over it
      if (x > b.x0 - CLEAR && x < b.x1 + CLEAR && z > b.z0 - CLEAR && z < b.z1 + CLEAR) return b;
    }
    return null;
  };
  return {
    block: () => block,
    update(dt, time, flood) {
      if (s.afloat && flood < deck - 0.02) {
        // the water gone back (drain, user 2026-11-02): back on its corner of the edge as it was, as the towel goes
        // back on its rail
        Object.assign(s, { afloat: false, x: sx, z: sz, vx: 0, vz: 0, yaw: -2.45, spin: 0 });
        duck.position.set(sx, deck, sz);
        duck.rotation.set(0, -2.45, 0);
        me.on = false;
        block = null;
        return;
      }
      if (!s.afloat) {
        if (flood < deck + 0.012) return;
        s.afloat = true; // lifted off the edge by the water
      }
      // riding the water, a little of it under it; pressed under it at the ceiling rather than through it
      const y = Math.min(flood - 0.014 + Math.sin(time * 1.7 + 1) * 0.003, ceiling - 0.092);
      const list = blocks().filter(Boolean);
      // the way it drifts bends a little, now one way, now the other; coming up to a wall or something in
      // the water it comes round, the way it was already bending, until the way ahead is clear
      s.bend = THREE.MathUtils.clamp(s.bend + (Math.random() - 0.5) * 0.5 * dt, -0.18, 0.18);
      s.way += s.bend * dt;
      if (into(s.x + Math.sin(s.way) * 0.16, s.z + Math.cos(s.way) * 0.16, y, list)) s.way += (s.bend >= 0 ? 1 : -1) * 0.9 * dt;
      // the water takes a while to carry it, or to stop it; pushed fast, it holds it back hard (drag)
      const ease = 1 - Math.exp(-dt * (0.6 + 3 * Math.max(0, Math.hypot(s.vx, s.vz) - SPEED)));
      s.vx += (Math.sin(s.way) * SPEED - s.vx) * ease;
      s.vz += (Math.cos(s.way) * SPEED - s.vz) * ease;
      s.spin = THREE.MathUtils.clamp(s.spin + (Math.random() - 0.5) * 0.6 * dt, -0.15, 0.15); // turning slowly about
      // away from what else is afloat
      const keep = (x, z, ax, az, half, r) => {
        const t = THREE.MathUtils.clamp((s.x - x) * ax + (s.z - z) * az, -half, half);
        const dx = s.x - (x + ax * t), dz = s.z - (z + az * t), d = Math.hypot(dx, dz) || 1e-3, room2 = R + r + 0.03;
        if (d < room2 + 0.1) { s.vx += (dx / d) * (room2 + 0.1 - d) * 2 * dt; s.vz += (dz / d) * (room2 + 0.1 - d) * 2 * dt; }
        if (d < room2) { s.x += (dx / d) * (room2 - d); s.z += (dz / d) * (room2 - d); }
      };
      for (const f of floaters) if (f !== me && f.on) keep(f.x, f.z, Math.sin(f.yaw), Math.cos(f.yaw), f.hl - f.hw, f.hw);
      const tb = towel();
      if (tb && tb.top > flood - 0.05 && tb.base < flood + 0.05) keep((tb.x0 + tb.x1) / 2, (tb.z0 + tb.z1) / 2, 1, 0, 0, Math.min(tb.x1 - tb.x0, tb.z1 - tb.z0) / 2);
      // you, walking or swimming into it, its height within yours: out of your way, and on ahead of you
      // as fast as you go into it; the water slows it again (the ease above)
      const p = you();
      shoveRing -= dt;
      if (p && y > p.feet - 0.04 && y < p.feet + p.eye + 0.12) {
        const dx = s.x - p.pos.x, dz = s.z - p.pos.y, d = Math.hypot(dx, dz) || 1e-3, reach = R + 0.2; // (your radius, player.js)
        if (d < reach) {
          const nx = dx / d, nz = dz / d, into = Math.max(0, p.vel.x * nx + p.vel.y * nz);
          s.x += nx * (reach - d);
          s.z += nz * (reach - d);
          const vn = s.vx * nx + s.vz * nz, want = into * 1.15 + 0.03;
          if (vn < want) { s.vx += nx * (want - vn); s.vz += nz * (want - vn); }
          s.spin = THREE.MathUtils.clamp(s.spin + (Math.random() - 0.5) * into * 3 * dt * 10, -0.9, 0.9);
          if (into > 0.15 && shoveRing <= 0) { stir(s.x, s.z, Math.min(0.3, 0.08 + into * 0.15)); shoveRing = 0.4; }
        }
      }
      const cap = Math.max(0.06, Math.hypot(s.vx, s.vz) > 0.06 ? 1.6 : 0.06);
      s.vx = THREE.MathUtils.clamp(s.vx, -cap, cap);
      s.vz = THREE.MathUtils.clamp(s.vz, -cap, cap);
      s.spin *= Math.exp(-dt * 0.8) + (Math.abs(s.spin) < 0.15 ? 1 - Math.exp(-dt * 0.8) : 0); // a shove's turn dies away
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.yaw += s.spin * dt;
      // never into a wall or anything standing in the water: put back out the shortest way, the drift
      // turned back off it
      for (let k = 0; k < 3; k++) {
        const hit = into(s.x, s.z, y, list);
        if (!hit) break;
        if (hit === 'x' || hit === 'z') {
          s.x = THREE.MathUtils.clamp(s.x, room.x0 + WALL, room.x1 - WALL);
          s.z = THREE.MathUtils.clamp(s.z, room.z0 + WALL, room.z1 - WALL);
          if (hit === 'x') { s.vx *= -0.3; s.way = -s.way; } else { s.vz *= -0.3; s.way = Math.PI - s.way; }
          continue;
        }
        const out = [[s.x - (hit.x0 - CLEAR), -1, 'x'], [hit.x1 + CLEAR - s.x, 1, 'x'], [s.z - (hit.z0 - CLEAR), -1, 'z'], [hit.z1 + CLEAR - s.z, 1, 'z']].sort((a, b) => a[0] - b[0])[0];
        if (out[2] === 'x') { s.x += out[1] * (out[0] + 0.001); s.vx = 0; s.way = -s.way; } else { s.z += out[1] * (out[0] + 0.001); s.vz = 0; s.way = Math.PI - s.way; }
      }
      duck.position.set(s.x, y, s.z);
      const rock = 1 + Math.min(4, Math.hypot(s.vx, s.vz) * 8); // pushed, it rocks more
      duck.rotation.set(Math.sin(time * 1.3) * 0.06 * rock, s.yaw, Math.sin(time * 1.1 + 2) * 0.07 * rock, 'YXZ');
      Object.assign(me, { on: true, x: s.x, z: s.z });
      // bobbing, now and then it sends a small ring out over the water
      if ((stirIn -= dt) <= 0) { stir(s.x, s.z, 0.05 + Math.random() * 0.04); stirIn = 1.8 + Math.random() * 2.5; }
      block = { x0: s.x - R, x1: s.x + R, z0: s.z - R, z1: s.z + R, base: y, top: y + 0.09 };
    },
  };
}

/** A column of falling water: unit radius and length (scale it), hanging down from where it is put, wavering as it falls. `userData.time`: its clock. */
function fallingWater(env) {
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 1, 18, 28, true).translate(0, -0.5, 0), std({ map: streamTex(), color: 0xdfe8ea, roughness: 0.05, transparent: true, opacity: 0.7, envMap: env, envMapIntensity: 1.2, depthWrite: false }));
  const time = { value: 0 };
  column.material.onBeforeCompile = (sh) => {
    // it never falls quite straight: it wavers, more the further it has fallen
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float fallen = -position.y;
        transformed.x += sin(position.y * 23.0 + uTime * 17.0) * 0.2 * fallen;
        transformed.z += cos(position.y * 19.0 + uTime * 13.0) * 0.16 * fallen;
        transformed.xz *= 1.0 + 0.12 * sin(position.y * 41.0 + uTime * 23.0);`);
  };
  column.material.map.wrapT = THREE.RepeatWrapping;
  column.visible = false;
  column.renderOrder = 3;
  column.userData.time = time;
  return column;
}

/**
 * The basin's mixer tap (user, 2026-10-15: "you can open the sink, the water runs normally, it doesn't
 * clog"). E lifts the lever and the water falls from the aerator onto the back of the bowl, splashes,
 * runs down to the plug hole in a thin sheet and is gone: the basin never fills. Shut, the sheet drains
 * away in a few seconds. Under the room's water: no stream, bubbles out of the aerator instead.
 * `basin`: { tap: the mixer (fixtures.mixerTap: `userData.lever`, `mouth`, `inlet`), bowl: the bowl's mesh }.
 */
function runningBasin(g, ctx, { tap, bowl }, env, flood) {
  g.updateMatrixWorld(true);
  const lever = tap.userData.lever, rest = lever.rotation.x, LIFT = lever.userData.lift ?? 0.5;
  const mouth = tap.localToWorld(tap.userData.mouth.clone()), inlet = tap.localToWorld(tap.userData.inlet.clone());
  // where it lands: straight down from the aerator onto the bowl
  const hit = new THREE.Raycaster(mouth.clone(), new THREE.Vector3(0, -1, 0), 0, 0.5).intersectObject(bowl, false)[0];
  const land = hit ? hit.point.clone() : mouth.clone().setY(mouth.y - 0.15);
  const up = hit ? hit.face.normal.clone().transformDirection(bowl.matrixWorld) : new THREE.Vector3(0, 1, 0);
  if (up.y < 0) up.negate();
  const R = 0.0045; // the stream: a basin tap's, thinner than the bath's
  const column = fallingWater(env);
  column.position.copy(inlet);
  column.scale.set(R, inlet.y - land.y, R);
  column.material.map.repeat.set(1, (inlet.y - land.y) * 6);
  g.add(column);
  // the splash where it lands, lying on the slope there
  const foamMat = new THREE.MeshStandardMaterial({ map: foamTex(), color: 0xf2f6f7, roughness: 0.5, transparent: true, depthWrite: false, envMap: env, envMapIntensity: 0.6, opacity: 0.8 });
  const splash = new THREE.Group();
  for (const k of [1, -1]) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), foamMat);
    f.userData.spin = k * (1.6 + Math.random());
    f.position.y = k > 0 ? 0.0012 : 0.0007;
    f.renderOrder = 3;
    splash.add(f);
  }
  splash.position.copy(land);
  splash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  splash.visible = false;
  g.add(splash);
  // the sheet of water running from there down into the plug hole: a copy of the bowl's surface, wet
  // only along the way it runs (its mask drawn for where the stream lands), glossy, its ripples moving
  bowl.updateMatrixWorld(true);
  const into = bowl.worldToLocal(land.clone()), drain = new THREE.Vector3(0, 0, 0);
  const sheetGeo = bowl.geometry.clone(), sp = sheetGeo.attributes.position, suv = [];
  for (let i = 0; i < sp.count; i++) suv.push(sp.getX(i) / 0.42 + 0.5, 0.5 - sp.getZ(i) / 0.28);
  sheetGeo.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2));
  const ripples = T.noiseBump(733, [3, 2]);
  const sheetMat = new THREE.MeshStandardMaterial({ color: 0x9fa8aa, roughness: 0.16, metalness: 0, transparent: true, opacity: 0, depthWrite: false, alphaMap: runnelTex(into, drain), bumpMap: ripples, bumpScale: 0.25, envMap: env, envMapIntensity: 0.35, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  sheetMat.userData.noVolume = true; // (water: not tinted as if under water)
  const sheet = new THREE.Mesh(sheetGeo, sheetMat);
  sheet.position.copy(bowl.position);
  sheet.renderOrder = 2.6;
  sheet.userData.live = true;
  sheet.visible = false;
  bowl.parent.add(sheet);
  // under water, the tap still on: bubbles
  const fizz = bubbles(g, 90, flood);
  const _p = new THREE.Vector3();
  // lever, sound
  const run = ctx.sound.steady('basin-run', land);
  let on = false, flow = 0, wet = 0;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), new THREE.MeshBasicMaterial({ visible: false }));
  grip.position.set(0, 0.02, 0.04 * (lever.userData.dir ?? -1));
  lever.add(grip); // the lever is small: something easier to point at
  lever.userData.interact = {
    label: () => (on ? 'Turn off the tap' : 'Turn on the tap'),
    use: () => {
      on = !on;
      ctx.sound.sample('basin-tap', lever.getWorldPosition(new THREE.Vector3()));
    },
  };
  ctx.interact.push(lever);
  return {
    update(dt, time) {
      lever.rotation.x += ((on ? rest + LIFT : rest) - lever.rotation.x) * (1 - Math.exp(-dt * 9));
      flow += ((on ? 1 : 0) - flow) * (1 - Math.exp(-dt * (on ? 5 : 9))); // full in a moment, cut off sharply
      const level = flood(), under = level > mouth.y - 0.004, drowned = level > land.y + 0.002;
      const running = flow > 0.03 && !under;
      run.set(running ? flow : 0);
      column.visible = running;
      if (running) {
        const bottom = Math.max(land.y, level);
        column.scale.set(R * (0.55 + 0.45 * flow), inlet.y - bottom, R * (0.55 + 0.45 * flow));
        column.material.map.offset.y = (time * 2.6) % 1;
        column.userData.time.value = time;
      }
      // the splash, on the bowl, or on the room's water if that is up over it
      splash.visible = running;
      if (running) {
        if (drowned) { splash.position.set(land.x, level + 0.0008, land.z); splash.quaternion.identity(); } else { splash.position.copy(land); splash.quaternion.setFromUnitVectors(_p.set(0, 1, 0), up); }
        const size = 0.02 * flow * (1 + 0.1 * Math.sin(time * 13));
        splash.children.forEach((f, i) => { f.rotation.y += f.userData.spin * dt; f.scale.setScalar(size * (i ? 0.7 : 1)); });
      }
      // the sheet: wet while it runs, draining away within seconds after
      wet += ((running && !drowned ? 1 : 0) - wet) * (1 - Math.exp(-dt * (running ? 3 : 0.45)));
      sheet.visible = wet > 0.01;
      sheetMat.opacity = 0.3 * wet; // wet ceramic reads a shade darker, never brighter
      ripples.offset.y = (ripples.offset.y + dt * 0.9) % 1; // running towards the hole
      // under the water: bubbles out of the aerator, as many as it runs
      if (under && flow > 0.03 && Math.random() < dt * 14 * flow) fizz.emit(_p.copy(mouth).add(new THREE.Vector3((Math.random() - 0.5) * 0.006, -0.003, (Math.random() - 0.5) * 0.006)), 0.0015 + Math.random() * 0.004);
      fizz.update(dt);
    },
  };
}

/**
 * Where the basin's running water wets the bowl, seen from above over its opening (0.42 × 0.28 m,
 * the back at the top): a band from where the stream lands (`from`, the bowl's own coordinates) down to
 * the plug hole (`to`), widening as it spreads, and the pool round the hole. White = wet.
 */
function runnelTex(from, to) {
  return canvasTex(256, 171, (g, w, h) => {
    g.fillStyle = '#000'; // (an alpha map is read from its green: black is dry)
    g.fillRect(0, 0, w, h);
    const px = (p) => [(p.x / 0.42 + 0.5) * w, (p.z / 0.28 + 0.5) * h];
    const [ax, ay] = px(from), [bx, by] = px(to);
    g.filter = 'blur(2px)';
    g.lineCap = 'round';
    for (let k = 0; k < 14; k++) {
      const t = k / 13, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, r = 4 + t * 9;
      const gr = g.createRadialGradient(x, y, 0, x, y, r * 1.6);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r * 1.6, 0, Math.PI * 2); g.fill();
    }
    const gr = g.createRadialGradient(bx, by, 0, bx, by, 18);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(bx, by, 18, 0, Math.PI * 2); g.fill();
    g.filter = 'none';
  }, { data: true });
}
