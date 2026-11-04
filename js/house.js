// The rest of the house round the bedroom, and the yard behind it, after the plan drawn for it.
// The bedroom door opens onto a corridor that runs out past the bedroom to a dead end. On the
// corridor are Mum's door (locked: her room is not part of the game) and the bathroom's. At its
// west end it opens into the kitchen and living room, one long room, with the front door
// (locked: it goes nowhere). Behind the kitchen and the bedroom is the back yard, fenced with
// old boards: the slide and its sandbox, the swing with one seat, the shed, the flamingos, the
// sprinkler, and the storm cellar's doors against the bedroom wall.
//
// It is a scene of its own, drawn after the bedroom into the same picture (main.js). Its lamps
// light only it and the bedroom's light only the bedroom: the bedroom's light is finished, and no
// lamp out here may reach in, nor a bedroom lamp shine out through a wall.
import * as THREE from 'three';
import * as T from './textures.js';
import { ROOM } from './room.js';
import { box, boxMM, cyl, cable, deg, mulberry32, canvasTex, HOUSE_SUN } from './util.js';
import { curvedScreen, screenMat, takeable } from './props.js';
import { glowMaterial, UV_TORCH } from './uvtorch.js';
import { metric, faces, slab, flat, pierced, bakeStatic, shadowTwin, shadowOnly, layeredShadow, outdoorsOnly, outdoorSun, outdoorLit, splitOutdoor, twoFills, YARD_SUN } from './build.js';
import { backYard } from './yard.js';
import { WIND, dappleCuts } from './grove.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as F from './fixtures.js';
import { cellar, UNDER } from './basement.js';
import { CELLAR } from './yard.js';
import { DAY } from './daytime.js';
import { bathWater, streamTex } from './bath.js';
import { mother } from './mother.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const { W, D, H, T: t } = ROOM;
const DOOR_H = ROOM.door.h;
const std = (o) => new THREE.MeshStandardMaterial(o);

// The plan, in metres, by interior faces (x east, z south; the bedroom is x 0…W, z 0…D).
export const PLAN = {
  corridor: { x0: -t, x1: 11.0, z0: D + t, z1: D + t + 1.2 }, // (longer: user, 2026-10-19 — the attic's hatch at its end)
  bath: { x0: 3.34, x1: 4.94, z0: D + 2 * t + 1.2, z1: 20.2 }, // long and narrow — far too long (user, 2026-10-19: "much longer, the bath far away"): 14.5 m, the bath at its end
  living: { x0: -5.16, x1: -t, z0: 0, z1: 9 }, // kitchen at the north end, living room at the south
  kitchenTo: 3.9, // where the kitchen's floor gives way to the living room's
  yard: { x0: -5.16 - t, x1: W + t, z0: -22.2, z1: -t, x2: 9.3, step: -14.0 }, // (6.8 m longer, for the grove at its end: user, 2026-10-17; past the wood, from `step` on, 8.2 m more and wider to the east, to x2, for the pool: 2026-11-01, his sketch — pool.js)
};
const C = PLAN.corridor, B = PLAN.bath, L = PLAN.living, Y = PLAN.yard;
const DOORS = {
  bath: { x0: 3.85, x1: 4.65 }, // in the corridor's south wall
  mum: { x0: 1.2, x1: 2.05 },
  back: { x0: -3.0, x1: -2.15 }, // in the kitchen's north wall
  front: { z0: 3.9, z1: 4.8 }, // in the west wall
};
const KWIN = { x0: -1.9, x1: -0.9, y0: 1.0, y1: 2.05 }; // over the sink
const LWIN = { z0: 6.4, z1: 7.9, y0: 0.9, y1: 2.1 }; // behind the sofa, curtains drawn
const YARD_LIGHT = 1; // how bright the yard is to you out in it (0.72 from 2026-10-17 to 2026-10-28: user asked it back to 1)
const CEILING = 0xe4e8ec, BOUNCE = 0xfff4e6, HOME_GLOW = 0.15, HALL_GLOW = 0.12; // the ceilings' white, and their glow (ceilingMat)
// the house stands on its foundation LIFT over the yard, and a porch PORCH deep runs along its back, the yard out
// past it (user, 2026-10-20: "raise the house, make a porch; take nothing off the garden")
export const LIFT = 0.75, PORCH = 1.85; // (13 boards: four fewer than it was — user, 2026-10-20)
const PORCH_X1 = -t; // it runs along the kitchen only, from the house's west corner to where the bedroom's wall begins (user, 2026-10-20)
const EAVE = 2.52; // underside of the roof: just above the bedroom's ceiling, so the two never fight
const TOP = 2.62; // walls run on up into the roof, so no light finds its way in over them

// ---------------------------------------------------------------- building blocks

/** Casing round an opening, on one face of a wall: in a frame where x runs along the wall and the face is at z, proud towards `out`. */
function casing(g, M, w, h, z, out, sill = false) {
  const z0 = out > 0 ? z : z - 0.018, z1 = z0 + 0.018, wide = 0.075;
  g.add(boxMM(-wide, 0, sill ? -wide : 0, h + wide, z0, z1, M.trim));
  g.add(boxMM(w, w + wide, sill ? -wide : 0, h + wide, z0, z1, M.trim));
  g.add(boxMM(0, w, h, h + wide, z0, z1, M.trim));
  if (sill) g.add(boxMM(0, w, -wide, 0, z0, z1, M.trim));
}

/** A frame placed on an opening: its x runs along the wall from `a` to `b`, its z through the wall, towards `face`. */
function onWall(parent, a, b, face) {
  const g = new THREE.Group();
  const n = new THREE.Vector2(...face).normalize();
  const phi = Math.atan2(-n.x, -n.y); // turns the frame's −z onto `face`
  const ux = Math.cos(phi), uz = -Math.sin(phi);
  let [A, Bp] = [new THREE.Vector2(...a), new THREE.Vector2(...b)];
  if ((Bp.x - A.x) * ux + (Bp.y - A.y) * uz < 0) [A, Bp] = [Bp, A];
  g.position.set(A.x, 0, A.y);
  g.rotation.y = phi;
  g.userData.width = A.distanceTo(Bp);
  parent.add(g);
  return g;
}

export function buildHouse(renderer, bedroomM, ctx) {
  twoFills(); // (one fill for indoors, one for out: build.js)
  // the bedroom's whites are made for its own light. Out here white paint is everyday off-white and as
  // matt as eggshell, no whiter than the plates by the sink (user, 2026-10-15: "the white things in the
  // kitchen and living room look lit differently, too bright; only the plates work")
  const offWhite = (m, color, roughness) => {
    const c = m.clone();
    c.color.set(color);
    c.roughness = roughness;
    return c;
  };
  const M = { ...bedroomM, trim: offWhite(bedroomM.trim, 0xd4cdbe, 0.62), door: offWhite(bedroomM.door, 0xe2dbcd, 0.6) };
  const scene = new THREE.Scene();
  scene.environment = homeRoom(renderer); // what shiny things out here reflect: a dim room, a daylit window, nothing hot
  scene.environmentIntensity = 0.26;
  let seed = 750;
  M.pane = (w, h, inside = false, lay, shape) => glassPane(w, h, scene.environment, seed++, inside, lay, shape); // window glass that looks like glass (below)
  M.env = scene.environment; // (for what needs its own reflection strength out here)
  M.yardEnv = yardSky(renderer); // (and what bare metal out in the yard reflects: the sky, not a room)
  const g = new THREE.Group();
  scene.add(g);
  const occluders = []; // what the line of sight to something you could use is stopped by
  const solid = (mesh) => {
    g.add(mesh);
    occluders.push(mesh);
    return mesh;
  };
  const wallCollider = (x0, x1, z0, z1) => ctx.colliders.push({ type: 'box', x0, x1, z0, z1 });

  // ---- materials
  const cool = coolRoom(renderer); // what the bathroom's glaze reflects: white, and the light in the ceiling
  const fromWall = (tex) => { tex.offset.x = -B.x0 / T.PERIOD.tile; return tex; }; // (tiles counted along x from the bathroom's west wall)
  const mat = {
    plank: metric(std({ map: T.plankTex(), roughness: 0.48 }), T.PERIOD.plank),
    lino: metric(std({ map: T.linoTex(), roughness: 0.4 }), T.PERIOD.lino),
    tile: metric(std({ map: T.tileTex(), bumpMap: T.tileTex(true), bumpScale: 0.7, roughness: 0.1, envMap: cool, envMapIntensity: 0.32 }), T.PERIOD.tile),
    // the same, for what is laid across the bathroom (its floor, its ceiling, the walls at its ends, the bath's front):
    // the rows counted from its west wall, so they come out whole at both sides, none cut (user, 2026-11-02)
    tileX: metric(std({ map: fromWall(T.tileTex()), bumpMap: fromWall(T.tileTex(true)), bumpScale: 0.7, roughness: 0.1, envMap: cool, envMapIntensity: 0.32 }), T.PERIOD.tile),
    siding: metric(std({ map: T.peelingSidingTex(), bumpMap: T.peelingSidingTex(true), bumpScale: 1.4, roughness: 0.9 }), 2.64), // (old white paint peeling off the boards: user, 2026-10-19)
    lawn: metric(std({ map: T.lawnTex(), roughness: 1 }), T.PERIOD.lawn),
    sand: metric(std({ map: T.sandTex(), roughness: 1 }), T.PERIOD.sand),
    counter: metric(std({ map: T.counterTex(), roughness: 0.5 }), T.PERIOD.counter),
    weathered: metric(std({ map: T.weatheredTex(), roughness: 0.95 }), 0.9),
    shed: metric(std({ map: T.weatheredTex(127), color: 0xb4c2a6, roughness: 0.92 }), 0.9), // painted green once
    fence: std({ map: T.fenceBoardTex(), roughness: 0.9 }),
    rail: metric(std({ map: T.weatheredTex(133), color: 0xd8cdb4, roughness: 0.92 }), 0.9),
    // white things: off-white and only softly glossy, or under the lamps they shine like lamps themselves
    ceramic: std({ color: 0xf1f0ec, roughness: 0.24, envMap: cool, envMapIntensity: 0.45 }), // (this white, not a brighter one: user, 2026-10-17)
    enamel: std({ color: 0xd5cfc2, roughness: 0.45 }), // the fridge, the cooker: cream gone a little grey
    steel: std({ color: 0xbfc2c6, metalness: 0.85, roughness: 0.3 }),
    rust: std({ color: 0x6a3f26, metalness: 0.5, roughness: 0.82 }),
    concrete: std({ color: 0x8f8a80, roughness: 0.96 }),
    roof: std({ color: 0x3b3633, roughness: 0.95 }),
    sofa: std({ color: 0x7a5a46, roughness: 1, bumpMap: T.noiseBump(221, [6, 6]), bumpScale: 0.6 }),
    curtain: std({ color: 0xa88e5c, roughness: 1, side: THREE.DoubleSide, bumpMap: T.noiseBump(222, [5, 8]), bumpScale: 0.4 }),
    // the corridor (user, 2026-10-19, after a photo): old flowered wallpaper, carpet wall to wall
    wallpaper: metric(std({ map: T.floralWallpaperTex(), roughness: 0.88 }), 0.8), // (after the pattern he sent, its flowers bigger: user, 2026-10-19)
    wainscot: metric(std({ map: T.beadboardTex(), bumpMap: T.beadboardTex(true), bumpScale: 1.2, roughness: 0.7 }), 0.9),
    // terry, white: soft, a velvet's sheen at the edges, not paper; greyer where it is wet (its colours)
    towel: new THREE.MeshPhysicalMaterial({ map: T.towelTex(), roughness: 1, bumpMap: T.noiseBump(224, [14, 30]), bumpScale: 0.55, sheen: 1, sheenRoughness: 0.9, sheenColor: 0x8f8b84, vertexColors: true, envMap: cool, envMapIntensity: 0.4 }),
    darkWood: std({ map: T.woodTex('#3a2a20', '#1a110b', 231), roughness: 0.5 }),
    doorWhite: std({ map: T.doorTex('#f2f0ea'), roughness: 0.55, envMap: cool, envMapIntensity: 0.45 }), // eggshell paint, as bathrooms get
    trimWhite: std({ color: 0xeeece6, roughness: 0.55, envMap: cool, envMapIntensity: 0.45 }),
    seat: std({ color: 0xfbfbf8, roughness: 0.3, envMap: cool, envMapIntensity: 0.6 }), // white plastic, as white as the china
    paperRoll: std({ map: T.paperRollTex(), roughness: 0.96, envMap: cool, envMapIntensity: 0.5 }),
    chrome: std({ color: 0x8e9196, metalness: 0.75, roughness: 0.3, envMap: cool, envMapIntensity: 0.35 }), // the bathroom's taps and fittings: grey metal, not a mirror of the white tiles
    cupboard: std({ map: T.cabinetDoorTex(), roughness: 0.55 }),
    // the kitchen's tiles: the bathroom's glaze, but off-white and lit by the kitchen (the bathroom's own
    // reflection, white and bright, made them shine like a lamp over the worktop)
    kitchenTile: metric(std({ map: T.tileTex(), bumpMap: T.tileTex(true), bumpScale: 0.7, color: 0xd9d4ca, roughness: 0.2 }), T.PERIOD.tile),
    brushed: std({ map: T.brushedTex(), metalness: 0.85, roughness: 0.38 }),
  };

  // ---- the bedroom's walls, as seen from outside it. The bedroom draws them; here they only stop
  // you walking through them, and get a skin wherever a lamp out here must be seen to light them.
  wallCollider(-t, 0, -t, D + t);
  wallCollider(W, W + t, -t, D + t);
  wallCollider(-t, W + t, -t, 0);
  wallCollider(-t, ROOM.door.x0, D, D + t);
  wallCollider(ROOM.door.x1, W + t, D, D + t);
  const SKIN = 0.004;
  // and for the sun and the sky alone (see the light, below), the whole bedroom as one solid: their
  // light must not pass through where it stands and on into the corridor and the kitchen
  const bedroom = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * t, TOP, D + 2 * t), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); // its shadow taken at the sunny side: no sliver of sun along its foot
  bedroom.position.set(W / 2, TOP / 2, D / 2);
  scene.add(bedroom);
  // its south face, which is the corridor's north wall
  pierced([-t, W + t], [[ROOM.door.x0, ROOM.door.x1, 0, DOOR_H]], (a0, a1, y0, y1) => solid(slab(a0, a1, y0, y1, D + t, D + t + SKIN, faces(M.wall, { pz: mat.wallpaper }))), TOP);
  // its west face, which is the kitchen's east wall
  solid(slab(-t - SKIN, -t, 0, TOP, 0, D + t, M.wall));
  // its north face, which the yard sees: siding, round the window
  const { win } = ROOM;
  // (4 mm, flush with the kitchen's beside it: 3 cm proud, it stood out as a step down the wall — user, 2026-10-20)
  pierced([-t, W + t], [[win.x0, win.x1, win.y0, win.y1]], (a0, a1, y0, y1) => solid(slab(a0, a1, y0, y1, -t - 0.004, -t, mat.siding)), TOP);
  {
    const f = onWall(g, [win.x0, -t - 0.004], [win.x1, -t - 0.004], [0, -1]);
    casing(f, M, f.userData.width, win.y1 - win.y0, 0, -1);
    f.position.y = win.y0;
    f.add(boxMM(-0.1, f.userData.width + 0.1, -0.05, 0, -0.09, 0, M.trim)); // the sill, standing out to throw the rain off (up to the wall's face: run 2 cm into it, its top lay in one plane with the siding's and the bedroom's reveal and flickered — user, 2026-11-03)
    // its glass as the yard sees it (user, 2026-10-19: "my room has no glass in its window any more"): the
    // bedroom's own is one-sided, seen from the room (two-sided, the room's reflection showed out here, and
    // looked wrong); this one faces out, like the kitchen's window, and from the room isn't there at all
    const out = M.pane(win.x1 - win.x0, win.y1 - win.y0);
    out.traverse((m) => { if (m.material) m.material.side = THREE.FrontSide; });
    out.rotation.y = Math.PI;
    out.position.set((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, -0.0905);
    g.add(out);
  }
  // the bedroom door's casing, on the corridor side
  {
    const f = onWall(g, [ROOM.door.x0, D + t + SKIN], [ROOM.door.x1, D + t + SKIN], [0, 1]);
    casing(f, M, f.userData.width, DOOR_H, 0, -1);
  }

  // ---------------------------------------------------------------- corridor
  // the bedroom's carpet, on out of its door and down the corridor (user, 2026-10-19: "it is the same as in my
  // room, it simply goes on"), the same pile at the same size; dirtier out here, laid over it
  // Laid the same way round and at the same size as the room's, so it runs on out of its door unbroken (user,
  // 2026-10-19: "the room's pattern, then a strip, then the corridor's"): the room lays its textures so many
  // times over its 3.8 × 4.2 m, v running north; here UVs are metres (period 1), turned into the room's by each
  // texture's repeat and offset. The doorways too, in the same metres.
  const carpet = M.carpet.clone();
  carpet.color.setScalar(0.82); // (a shade down: it read lighter than the room's)
  const asRoom = (tex) => {
    const c = tex.clone();
    c.repeat.set(tex.repeat.x / W, -tex.repeat.y / D);
    c.offset.set(tex.offset.x, tex.offset.y + tex.repeat.y);
    c.needsUpdate = true;
    return c;
  };
  carpet.map = asRoom(M.carpet.map);
  carpet.bumpMap = asRoom(M.carpet.bumpMap);
  g.add(flat(C.x0, C.x1, C.z0, C.z1, 0, metric(carpet, 1)));
  // where it meets the living room's boards, a brass edging strip (user, 2026-10-19): bevelled, held down by
  // screws, dull with years and rubbed bright where feet go over it (T.brassStripTex)
  {
    const strip = soft(C.x0 - 0.018, C.x0 + 0.018, -0.002, 0.005, C.z0, C.z1, 0.003, std({ map: T.brassStripTex(), metalness: 0.6, roughness: 0.45, envMap: M.env, envMapIntensity: 1.5 })); // (its own reflection: at the house's 0.26 it was a black line)
    const uv = strip.geometry.attributes.uv, P = strip.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i) / 0.036 + 0.5, P.getZ(i) / (C.z1 - C.z0) + 0.5); // (the picture laid along it, whichever face)
    g.add(strip);
    for (const z of [C.z0 + 0.09, (C.z0 + C.z1) / 2 + 0.02, C.z1 - 0.1]) g.add(cyl(0.0035, 0.0035, 0.0012, std({ color: 0x5c4a2c, metalness: 0.8, roughness: 0.55 }), C.x0 + 0.002, 0.0054, z, 10)); // its screws, darker
  }
  g.add(flat(ROOM.door.x0, ROOM.door.x1, D - 0.002, D + t + 0.012, 0.001, carpet)); // through the bedroom's doorway, lapping both floors: one carpet
  for (const d of [DOORS.mum, DOORS.bath]) g.add(flat(d.x0 - 0.005, d.x1 + 0.005, C.z1 - 0.006, C.z1 + t + 0.006, 0.001, carpet)); // and through Mum's and the bathroom's, under their doors
  // (the dust along the walls stops at the doorways: it had gone on across them, a dark band before each door)
  const dirt = flat(C.x0, C.x1, C.z0, C.z1, 0.0012, std({ map: T.corridorDirtTex(C.x1 - C.x0, C.z1 - C.z0, [[ROOM.door.x0 - C.x0, ROOM.door.x1 - C.x0, 'n'], [DOORS.mum.x0 - C.x0, DOORS.mum.x1 - C.x0, 's'], [DOORS.bath.x0 - C.x0, DOORS.bath.x1 - C.x0, 's']]), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  dirt.renderOrder = 1;
  g.add(dirt);

  // a lid on the room, its edges run into the walls round it: if it stopped at their faces, the strip
  // of wall above it would show along the corner, lit by whatever gets in under the roof
  const IN = t - 0.005;
  // (round the attic's hatch at its far end: the ceiling in four pieces, the hole left in the middle)
  const HATCH = { x0: C.x1 - 1.12, x1: C.x1 - 0.3, z0: (C.z0 + C.z1) / 2 - 0.31, z1: (C.z0 + C.z1) / 2 + 0.31 };
  // white (user, 2026-10-19), and lived under: dust round the lamps, a leak dried brown in the corner by the
  // hatch, fingermarks where the lid gets pushed up; its glow the hatch lamp's light thrown back up (atticHatch)
  const lampX = HATCH.x0 - 0.6, mid = (C.z0 + C.z1) / 2;
  const hallCeiling = ceilingMat({
    x0: C.x0 - 0.1, x1: C.x1 + IN, z0: C.z0 - IN, z1: C.z1 + IN, seed: 771, walls: 'nse',
    marks: [{ type: 'ghost', x: 2.3, z: mid, amount: 0.6 }, { type: 'ghost', x: 5.6, z: mid, amount: 0.8 }, { type: 'ghost', x: lampX, z: mid }, { type: 'water', x: C.x1 - 0.3, z: C.z0 + 0.13, rx: 0.26, rz: 0.12 }, { type: 'smudge', x: HATCH.x1 + 0.13, z: mid + 0.04, n: 7 }],
    light: (x, z) => Math.exp(-(((x - lampX) / 1.8) ** 2) - ((z - mid) / 2.4) ** 2),
  }, 0, 0.07);
  for (const [x0, x1, z0, z1] of [[C.x0, HATCH.x0, C.z0 - IN, C.z1 + IN], [HATCH.x1, C.x1 + IN, C.z0 - IN, C.z1 + IN], [HATCH.x0, HATCH.x1, C.z0 - IN, HATCH.z0], [HATCH.x0, HATCH.x1, HATCH.z1, C.z1 + IN]]) {
    g.add(Object.assign(flat(x0, x1, z0, z1, H, hallCeiling, false), { castShadow: true }));
  }
  // north wall, on past the bedroom (its other face out of doors, past it: the house's old siding)
  solid(slab(W + t, C.x1 + t, 0, TOP, D, D + t, faces(M.wall, { nz: mat.siding, pz: mat.wallpaper, px: mat.siding })));
  wallCollider(W + t, C.x1 + t, D, D + t);
  // south wall: Mum's door and the bathroom's. Its south face is tiled where the bathroom is.
  const south = C.z1;
  pierced([C.x0, C.x1 + t], [[DOORS.mum.x0, DOORS.mum.x1, 0, DOOR_H], [DOORS.bath.x0, DOORS.bath.x1, 0, DOOR_H]], (a0, a1, y0, y1) => {
    // split where the rooms behind it change, so each piece can wear the right face on that side
    for (const [p0, p1] of [[a0, Math.min(a1, B.x0)], [Math.max(a0, B.x0), Math.min(a1, B.x1)], [Math.max(a0, B.x1), a1]]) {
      if (p1 - p0 < 1e-3) continue;
      const tiled = p0 >= B.x0 - 1e-3 && p1 <= B.x1 + 1e-3, outside = p0 >= B.x1 - 1e-3; // (past the bathroom its south face is out of doors)
      solid(slab(p0, p1, y0, y1, south, south + t, faces(M.wall, { nz: mat.wallpaper, ...(tiled ? { pz: mat.tileX } : outside ? { pz: mat.siding, px: mat.siding } : {}) })));
    }
  }, TOP);
  wallCollider(C.x0, DOORS.mum.x0, south, south + t);
  wallCollider(DOORS.mum.x1, DOORS.bath.x0, south, south + t);
  wallCollider(DOORS.bath.x1, C.x1 + t, south, south + t);
  // the dead end, between the two walls' ends (where two walls overlapped, their faces lay in one plane and
  // flickered between each other as you moved — user, 2026-10-20: "parts of the walls glitch": no wall here
  // overlaps another any more, each corner belongs to one of them)
  solid(slab(C.x1, C.x1 + t, 0, TOP, D + t, south, faces(M.wall, { px: mat.siding, nx: mat.wallpaper })));
  wallCollider(C.x1, C.x1 + t, D, south + t);
  // skirting
  for (const [x0, x1] of [[C.x0, ROOM.door.x0 - 0.075], [ROOM.door.x1 + 0.075, C.x1]]) g.add(boxMM(x0, x1, 0, 0.09, D + t, D + t + 0.014, M.trim));
  for (const [x0, x1] of [[C.x0, DOORS.mum.x0 - 0.075], [DOORS.mum.x1 + 0.075, DOORS.bath.x0 - 0.075], [DOORS.bath.x1 + 0.075, C.x1]]) g.add(boxMM(x0, x1, 0, 0.09, south - 0.014, south, M.trim));
  g.add(boxMM(C.x1 - 0.014, C.x1, 0, 0.09, C.z0 + 0.014, C.z1 - 0.014, M.trim)); // (between the side ones: overlapping them, the tops lay in one plane in the corners and flickered)
  // the lower part of the walls: tongue-and-groove boards in a dull grey green up to a little over a metre,
  // a rail along their top, scuffed and scratched (user, 2026-10-19, after a photo); the paper above. Stopping
  // at the doors' casings; the skirting stands in front of them
  const WH = 1.02, rail = std({ map: T.peelingPaintTex('#7f8676', 71, 0.12), roughness: 0.6 });
  const nz = D + t + SKIN, sz = south;
  for (const [x0, x1] of [[C.x0, ROOM.door.x0 - 0.075], [ROOM.door.x1 + 0.075, C.x1]]) {
    g.add(slab(x0, x1, 0, WH, nz, nz + 0.008, mat.wainscot));
    g.add(slab(x0, x1, WH, WH + 0.05, nz, nz + 0.024, rail));
  }
  for (const [x0, x1] of [[C.x0, DOORS.mum.x0 - 0.075], [DOORS.mum.x1 + 0.075, DOORS.bath.x0 - 0.075], [DOORS.bath.x1 + 0.075, C.x1]]) {
    g.add(slab(x0, x1, 0, WH, sz - 0.008, sz, mat.wainscot));
    g.add(slab(x0, x1, WH, WH + 0.05, sz - 0.024, sz, rail));
  }
  // (the end's boards and rail butted against the sides', not run through them: where they overlapped in the corners
  // their tops lay in one plane and flickered as you moved, light along the rail — user, 2026-10-28)
  g.add(slab(C.x1 - 0.008, C.x1, 0, WH, nz + 0.008, sz - 0.008, mat.wainscot));
  g.add(slab(C.x1 - 0.024, C.x1, WH, WH + 0.05, nz + 0.024, sz - 0.024, rail));
  // the paper worn and faded, never the same twice along it (user, 2026-10-19): over each wall, rail to ceiling,
  // a skin of its own wear (T.wallpaperWearTex), cut round the doors — the leak's runs at the far end come from
  // the stain on the ceiling there; where a picture hung once, its nail still in
  {
    const B0 = WH + 0.05;
    const skin = (len, seed, opts, at, facing, holes) => { // at(a, y): the world point `a` along the wall, `y` up it
      const pos = [], uv = [], nrm = [];
      const quad = (a0, a1, y0, y1) => {
        if (a1 - a0 < 0.005) return;
        const P = [[a0, y0], [a1, y0], [a1, y1], [a0, y0], [a1, y1], [a0, y1]].map(([a, y]) => [at(a, y), [a / len, (y - B0) / (H - B0)]]);
        const e1 = new THREE.Vector3(...P[1][0]).sub(new THREE.Vector3(...P[0][0])), e2 = new THREE.Vector3(...P[2][0]).sub(new THREE.Vector3(...P[0][0]));
        const tris = e1.cross(e2).dot(new THREE.Vector3(...facing)) > 0 ? P : [P[0], P[2], P[1], P[3], P[5], P[4]];
        for (const [p, q] of tris) { pos.push(...p); uv.push(...q); nrm.push(...facing); }
      };
      let a = 0;
      for (const [h0, h1] of holes) { quad(a, h0, B0, H); quad(h0, h1, DOOR_H, H); a = h1; }
      quad(a, len, B0, H);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      const m = new THREE.Mesh(geo, std({ map: T.wallpaperWearTex({ len, hgt: H - B0, seed, ...opts }), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.receiveShadow = true;
      m.renderOrder = 1;
      g.add(m);
    };
    const len = C.x1 - C.x0, rel = (x) => x - C.x0;
    skin(len, 611, { scuffs: [rel(ROOM.door.x0) - 0.12, rel(ROOM.door.x1) + 0.12, rel(7.9)], stains: [{ x: rel(C.x1 - 0.35), w: 0.4, len: 0.9 }] },
      (a, y) => [C.x0 + a, y, nz + 0.002], [0, 0, 1], [[rel(ROOM.door.x0), rel(ROOM.door.x1)]]);
    skin(len, 612, { scuffs: [rel(DOORS.mum.x0) - 0.12, rel(DOORS.bath.x0) - 0.12, rel(DOORS.bath.x1) + 0.12], ghost: { x: rel(7.5), y: 1.62, w: 0.42, h: 0.32 }, tears: 3 },
      (a, y) => [C.x0 + a, y, sz - 0.002], [0, 0, -1], [[rel(DOORS.mum.x0), rel(DOORS.mum.x1)], [rel(DOORS.bath.x0), rel(DOORS.bath.x1)]]);
    skin(C.z1 - C.z0, 613, { stains: [{ x: 0.12, w: 0.25, len: 1.1 }], tears: 1 }, (a, y) => [C.x1 - 0.002, y, C.z0 + a], [-1, 0, 0], []);
    // the nail the picture hung from, still in, a little bent
    const nail = cyl(0.0022, 0.0022, 0.012, std({ color: 0x4a4038, metalness: 0.6, roughness: 0.55 }), 7.5, 1.62 + 0.16 + 0.07, sz - 0.006, 8);
    nail.rotation.set(Math.PI / 2 + 0.25, 0, 0.1);
    g.add(nail, cyl(0.0045, 0.0045, 0.0012, nail.material, 7.5, 1.62 + 0.16 + 0.07 + 0.0015, sz - 0.0115, 12).rotateX(Math.PI / 2 + 0.25));
  }
  // a runner down the middle of it, and a lamp nobody has switched on
  ceilingLamp(g, M, 2.3, C.z0 + 0.6);
  ceilingLamp(g, M, 5.6, C.z0 + 0.6);
  // the picture (user, 2026-10-20): his old family photograph — a man, his wife, their boy in a sailor suit, a black
  // cat on the man's lap (2026-10-28; the dog before) — cut to 3:4 (assets/family-portrait.jpg, the same cut as the
  // old one), in an antique brass frame; a matte print (a glossy one gave back the room's light, bright, in the dark:
  // "too lit"), under glass
  brassPortrait(g, M, oldPhotoTex('assets/family-portrait.jpg'), 0.24, 0.32, [6.1 + 5 * 0.53, 1.56, D + t + SKIN], deg(-0.9)); // (five lengths of paper on from where the old print was: user, 2026-10-20, four and then one more)
  const hatchLamp = atticHatch(g, M, ctx, HATCH, hallCeiling);
  // on the paper past it, the arrow towards the hatch (user, 2026-10-22): HELL, written in blood and washed off —
  // there only under the UV torch: the darker it is, the more it shows (with the lamp by the hatch lit, a third of
  // it), and it comes out as you come up to it, faint from down the corridor; the writing is his photograph as it is
  // (assets/hell-writing.jpg, bloodTraceTex). Letters to arrow's tip 1.05 m along the wall, about 0.38 m high.
  {
    const dark = { value: 1 }, PX = 1.05 / 1670; // (a pixel of the photo, in metres: its letters and arrow are 1670 px)
    const hell = new THREE.Mesh(new THREE.PlaneGeometry(2000 * PX, 1116 * PX), glowMaterial(bloodTraceTex('assets/hell-writing.jpg'), dark, 1.5));
    hell.position.set(9.555 - 60 * PX, 1.63, nz + 0.004); // (the letters sit 60 px right of the photo's middle; 2 mm in front of the paper's wear)
    hell.renderOrder = 2.5;
    hell.userData.live = true;
    g.add(hell);
    ctx.animated.push(() => { dark.value = 1 - 0.65 * Math.min(1, hatchLamp.intensity / 0.9); }); // (the lamp's full light: 0.9)
  }

  // ---- doors on it
  const doors = [];
  // (the corridor's carpet right up to them and through, under the leaves: no strip of wood — user, 2026-10-19)
  doors.push(hingedDoor(ctx, M, g, { a: [DOORS.mum.x0, south + t / 2], b: [DOORS.mum.x1, south + t / 2], swing: [0, 1], locked: "It's locked. That's Mum's room." })); // (its sill: the corridor's carpet, above)
  doors.push(hingedDoor(ctx, M, g, { a: [DOORS.bath.x0, south + t / 2], b: [DOORS.bath.x1, south + t / 2], swing: [0, 1], inner: mat.doorWhite, innerTrim: mat.trimWhite })); // (its sill: the corridor's carpet, above) shut to begin with (user, 2026-10-15)

  // ---------------------------------------------------------------- Mum's room: walls only
  solid(slab(-t, 0, 0, TOP, south + t, L.z1 + t, M.wall)); // also the living room's east wall, south of the corridor (from behind its south wall: see the dead end)
  wallCollider(-t, 0, south, L.z1 + t);
  solid(slab(-t, B.x0 - t, 0, TOP, L.z1, L.z1 + t, M.wall));
  g.add(flat(0, B.x0 - t, south + t, L.z1, 0, mat.plank)); // so the gap under her door isn't a void

  // ---------------------------------------------------------------- bathroom: long and narrow, tiled all over, white, no window
  solid(slab(B.x0 - t, B.x0, 0, TOP, B.z0, B.z1, faces(M.wall, { px: mat.tile })));
  solid(slab(B.x1, B.x1 + t, 0, TOP, south + t, B.z1, faces(M.wall, { nx: mat.tile }))); // (between the corridor's wall and its own end wall: see the dead end)
  solid(slab(B.x0 - t, B.x1 + t, 0, TOP, B.z1, B.z1 + t, faces(M.wall, { nz: mat.tileX })));
  wallCollider(B.x0 - t, B.x0, B.z0, B.z1 + t);
  wallCollider(B.x1, B.x1 + t, south, B.z1 + t);
  wallCollider(B.x0 - t, B.x1 + t, B.z1, B.z1 + t);
  g.add(flat(B.x0, B.x1, B.z0, B.z1, 0, mat.tileX));
  g.add(Object.assign(flat(B.x0 - IN, B.x1 + IN, B.z0 - IN, B.z1 + IN, H, mat.tileX, false), { castShadow: true }));
  const bath = bathroom(g, M, mat, ctx, cool);

  // ---------------------------------------------------------------- kitchen and living room
  g.add(flat(L.x0, L.x1, L.z0, PLAN.kitchenTo, 0, mat.lino));
  g.add(flat(L.x0, L.x1, PLAN.kitchenTo, L.z1, 0, mat.plank));
  g.add(boxMM(L.x0, L.x1, 0, 0.004, PLAN.kitchenTo - 0.015, PLAN.kitchenTo + 0.015, M.silver)); // the strip where the floors meet
  // white (user, 2026-10-19), and lived under: yellowed over the cooker, dust round the lamps, a hairline crack
  // from the living room's far corner; its glow the kitchen lamp's light thrown back up off the floor and walls
  const homeCeiling = ceilingMat({
    x0: L.x0 - IN, x1: L.x1, z0: L.z0 - IN, z1: L.z1 + IN, seed: 772, walls: 'nswe', gaps: { e: [[C.z0, C.z1]] }, // (no wall where the corridor opens: its dust had run on across, a dark line where the ceilings meet)
    marks: [{ type: 'ghost', x: -2.7, z: 2.0 }, { type: 'ghost', x: -2.7, z: 6.8, amount: 0.7 }, { type: 'grease', x: -4.15, z: 0.35, rx: 0.75, rz: 0.5 }, { type: 'crack', x: L.x0 + 0.02, z: L.z1 - 0.6, angle: -0.5, len: 1.1 }],
    light: (x, z) => 0.16 + 0.84 * Math.exp(-((x + 2.7) ** 2 + (z - 2.0) ** 2) / 2.9 ** 2),
  }, HOME_GLOW);
  g.add(Object.assign(flat(L.x0 - IN, L.x1, L.z0 - IN, L.z1 + IN, H, homeCeiling, false), { castShadow: true })); // not east: the corridor's ceiling meets it there
  // west wall: the front door, and the living room's window
  pierced([0, L.z1 + t], [[DOORS.front.z0, DOORS.front.z1, 0, DOOR_H], [LWIN.z0, LWIN.z1, LWIN.y0, LWIN.y1]], (a0, a1, y0, y1) => solid(slab(L.x0 - t, L.x0, y0, y1, a0, a1, M.wall)), TOP); // (from 0: the corner is the north wall's, its siding)
  wallCollider(L.x0 - t, L.x0, -t, DOORS.front.z0);
  wallCollider(L.x0 - t, L.x0, DOORS.front.z1, L.z1 + t);
  // north wall: the back door and the window over the sink; siding outside
  pierced([L.x0 - t, -t], [[DOORS.back.x0, DOORS.back.x1, 0, DOOR_H], [KWIN.x0, KWIN.x1, KWIN.y0, KWIN.y1]], (a0, a1, y0, y1) => solid(slab(a0, a1, y0, y1, -t, 0, faces(M.wall, { nz: mat.siding }))), TOP);
  // and its siding 4 mm out, as the bedroom's is, so the two are one face
  pierced([L.x0 - t, -t], [[DOORS.back.x0, DOORS.back.x1, 0, DOOR_H], [KWIN.x0, KWIN.x1, KWIN.y0, KWIN.y1]], (a0, a1, y0, y1) => g.add(slab(a0, a1, y0, y1, -t - 0.004, -t, mat.siding)), TOP);
  wallCollider(L.x0 - t, DOORS.back.x0, -t, 0);
  wallCollider(DOORS.back.x1, -t, -t, 0);
  // south wall
  solid(slab(L.x0 - t, -t, 0, TOP, L.z1, L.z1 + t, M.wall));
  wallCollider(L.x0 - t, 0, L.z1, L.z1 + t);
  // skirting
  g.add(boxMM(L.x0, L.x0 + 0.014, 0, 0.09, PLAN.kitchenTo - 1.5, DOORS.front.z0 - 0.075, M.trim));
  g.add(boxMM(L.x0, L.x0 + 0.014, 0, 0.09, DOORS.front.z1 + 0.075, L.z1, M.trim));
  g.add(boxMM(L.x0, -t, 0, 0.09, L.z1 - 0.014, L.z1, M.trim));
  g.add(boxMM(-t - 0.014, -t, 0, 0.09, south, L.z1, M.trim));
  // (its threshold: not a strip of floorboards between the step and the kitchen's floor — user, 2026-10-17)
  const alu = std({ color: 0x9fa19d, metalness: 0.65, roughness: 0.45, envMap: M.env, envMapIntensity: 0.45 });
  // the back door opens out, into the yard (user, 2026-10-19)
  const wornWhite = metric(std({ map: T.peelingPaintTex('#d6d0c1', 62, 0.42, '#b9b3a4'), roughness: 0.8 }), 0.6);
  doors.push(hingedDoor(ctx, M, g, { a: [DOORS.back.x0, -t / 2], b: [DOORS.back.x1, -t / 2], swing: [0, -1], label: 'back door', glass: true, threshold: alu, worn: wornWhite }));
  doors.push(hingedDoor(ctx, M, g, { a: [L.x0 - t / 2, DOORS.front.z0], b: [L.x0 - t / 2, DOORS.front.z1], swing: [1, 0], label: 'front door', locked: "It's locked.", front: true, sill: mat.plank }));
  windowIn(g, M, [KWIN.x0, -t / 2], [KWIN.x1, -t / 2], [0, 1], KWIN.y0, KWIN.y1);
  windowIn(g, M, [L.x0 - t / 2, LWIN.z0], [L.x0 - t / 2, LWIN.z1], [1, 0], LWIN.y0, LWIN.y1);
  const kit = kitchen(g, M, mat, ctx);
  livingRoom(g, M, mat, ctx);
  ceilingLamp(g, M, -2.7, 2.0, true); // the kitchen's, on
  ceilingLamp(g, M, -2.7, 6.8);

  // under every floor, something dark: where two floors meet, a crack must not open onto the sky below
  g.add(Object.assign(slab(L.x0 - t + 0.02, C.x1 + t - 0.02, -0.05, -0.002, -t + 0.02, B.z1 + t - 0.02, new THREE.MeshBasicMaterial({ color: 0x0a0705 })), { castShadow: false, receiveShadow: false })); // (inside the foundation's faces: on them it flickered against them, along the foot of the walls — user, 2026-10-20)
  // and the foundation the house stands on, down to the ground (user, 2026-10-20: the house raised): old
  // concrete, stained by the wet from the ground up, under every outside wall
  {
    const footing = std({ map: T.foundationTex(), roughness: 0.96 });
    outdoorLit(footing); // (only ever seen from outside: no lamp of the house's lights it through its walls)
    // (under the bedroom, the cellar's steps go through it: cut out from the ground up to just under the floor — basement.js;
    // and none of it where the basement is: seen from down there with the doors open behind you, it hung through the
    // basement's ceiling and walls — user, 2026-10-22)
    const outside = ([x0, x1, z0, z1, y0], { x0: a0, x1: a1, z0: b0, z1: b1 } = UNDER) => x1 <= a0 || x0 >= a1 || z1 <= b0 || z0 >= b1 ? [[x0, x1, z0, z1, y0]]
      : [[x0, a0, z0, z1], [a1, x1, z0, z1], [Math.max(x0, a0), Math.min(x1, a1), z0, b0], [Math.max(x0, a0), Math.min(x1, a1), b1, z1]].filter(([p, q, s, u]) => q - p > 1e-6 && u - s > 1e-6).map((b) => [...b, y0]);
    for (const [x0, x1, z0, z1, y0 = -LIFT - 0.05] of [[L.x0 - t, -t, -t, L.z1 + t], [-t, CELLAR.x0, -t, D], [CELLAR.x1, W + t, -t, D], [CELLAR.x0, CELLAR.x1, -t, D, -0.32], [-t, C.x1 + t, D, C.z1 + t], [B.x0 - t, B.x1 + t, C.z1 + t, B.z1 + t]].flatMap((b) => outside(b))) {
      const f = slab(x0, x1, y0, -0.004, z0, z1, footing);
      const uv = f.geometry.attributes.uv, P = f.geometry.attributes.position, N = f.geometry.attributes.normal, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cy = (y0 - 0.004) / 2;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (Math.abs(N.getX(i)) > 0.5 ? P.getZ(i) + cz : P.getX(i) + cx) / 2.4, (P.getY(i) + cy + LIFT + 0.05) / 1.2); // (2.4 m along a tile, the ground at its foot)
      g.add(f);
    }
  }

  // ---------------------------------------------------------------- outside
  roof(g, M, mat);
  // the yard, down where the ground is and out past the porch: yard.js builds it where it always stood, in its
  // own frame — LIFT lower and PORCH further out here — and what it gives the player (what is in your way, the
  // slide's ladder) goes where it is in the world
  const yg = new THREE.Group();
  yg.position.set(0, -LIFT, -PORCH);
  g.add(yg);
  const shiftC = (c) => { const w = { ...c, local: c }; for (const k of ['z0', 'z1', 'az', 'bz']) if (k in w) w[k] -= PORCH; w.base = (c.base ?? 0) - LIFT; if (c.top !== undefined) w.top = c.top - LIFT; return w; };
  const unshiftC = (w) => w.local ?? { ...w, ...Object.fromEntries(['z0', 'z1', 'az', 'bz'].filter((k) => k in w).map((k) => [k, w[k] + PORCH])), base: (w.base ?? 0) + LIFT, ...(w.top !== undefined ? { top: w.top + LIFT } : {}) };
  const yctx = Object.create(ctx);
  yctx.colliders = { push: (...cs) => { for (const c of cs) ctx.colliders.push(shiftC(c)); }, filter: (f) => ctx.colliders.map(unshiftC).filter(f) };
  yctx.ladders = { push: (L) => ctx.ladders.push({ ...L, z: L.z - PORCH, top: L.top - LIFT, foot: -LIFT }) };
  const yard = backYard(yg, M, mat, yctx, scene, { yard: { ...Y, z1: -t + PORCH }, backDoor: DOORS.back, frontDoor: DOORS.front, offset: { y: -LIFT, z: -PORCH }, porchX1: PORCH_X1 }); // (its lawn on up to the house's wall beside the porch)
  // the storm cellar's doors in the yard against the bedroom's wall, and the basement under the house (basement.js)
  const cellarWay = cellar(g, ctx, { lift: LIFT, redraw: (n) => mark([sun, sky], n), occluders });

  // ---------------------------------------------------------------- what never moves, merged
  // the walls, thick to the sun and the sky (see the light, below); and the roof down to the ceilings, solid:
  // ceiling and roof are only a couple of centimetres apart, too close for the sun's shadow to tell from the
  // wall just under them, and the top of every sunward wall showed a ragged line of light
  const attic = roofPieces().map(([x0, x1, z0, z1]) => slab(x0, x1, H, EAVE + 0.18, z0, z1, M.wall));
  // and the front door, which never opens, as solid as the wall it is in: a leaf is too thin for them,
  // and the sky got in round its edges
  const frontDoor = slab(L.x0 - t, L.x0, 0, DOOR_H, DOORS.front.z0, DOORS.front.z1, M.wall);
  const thick = shadowTwin([...occluders, ...attic, frontDoor]);
  scene.add(thick);
  // everything in the house takes the shadows of what lights it. Small things made with new THREE.Mesh
  // had been left out, and the sun and the sky lit them through the walls and the roof (the papers on
  // the coffee table were nearly white); all of them now, see-through ones too (the bath's water, its
  // stream and foam shone in the dark bathroom by the sun through the roof), but what gives light
  const inside = (p) => p.x > L.x0 - t && p.x < B.x1 + t && p.z > -t && p.z < B.z1 + t;
  const at = new THREE.Vector3();
  g.traverse((o) => {
    if (!o.isMesh || o.receiveShadow) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.isMeshBasicMaterial || (m.emissive && m.emissive.getHex() && m.emissiveIntensity > 0)) return;
    if (inside(o.getWorldPosition(at))) o.receiveShadow = true;
  });
  splitOutdoor(g, [{ x0: L.x0, x1: W, z0: 0, z1: L.z1 }, { x0: -t, x1: C.x1, z0: D, z1: B.z1 }], t - 0.004); // (what is outside on a material the rooms use too: its own copy, lit as outside)
  bakeStatic(g);
  // out of doors only the sun, the sky and the open air light anything (build.js): the rooms, inside their walls
  const outdoorMaterials = outdoorsOnly(g, [{ x0: L.x0, x1: W, z0: 0, z1: L.z1 }, { x0: -t, x1: C.x1, z0: D, z1: B.z1 }]);
  corridorFill(g);

  // ---------------------------------------------------------------- light
  // the same fill the bedroom has, so the house reads as the same house
  const hemi = new THREE.HemisphereLight(DAY.hemi.sky, DAY.hemi.ground, DAY.hemi.house);
  scene.add(hemi);
  // and out of doors its own (build.js twoFills: what is indoors keeps the first, whatever your eye)
  const hemiOut = new THREE.HemisphereLight(DAY.hemi.sky, DAY.hemi.ground, DAY.hemi.house);
  scene.add(hemiOut);
  // out in the yard the whole sky lights the shade, blue from above and green off the lawn: indoors
  // it is the house's own dim fill. The eye is where it decides which (see update).
  const fill = { inSky: new THREE.Color(DAY.hemi.sky), inGround: new THREE.Color(DAY.hemi.ground), outSky: new THREE.Color(DAY.hemi.yard.sky), outGround: new THREE.Color(DAY.hemi.yard.ground) };
  // the sun, from the same quarter as the one through the bedroom blind, and the sky high over it (daytime.js)
  const middle = new THREE.Vector3(0.6, 0, 1);
  const sun = outdoorLight(scene, DAY.sun.color, new THREE.Vector3(...DAY.sun.dir).normalize(), middle, 4096); // (its sharp shadows want the finer map: at 2048 a texel is 2 cm)
  const sky = outdoorLight(scene, DAY.sky.color, new THREE.Vector3(...DAY.sky.dir).normalize(), middle);
  dappleCuts([sun, sky], 59); // (for the spots of light under the trees moving on the lawn: grove.js)
  Object.assign(HOUSE_SUN, { light: sun, wallZ: -t - 0.004 }); // (its shadows on the bedroom window's outer faces: room.js `outward`)
  const SUN = DAY.sun.house, SKY = DAY.sky.house;
  // the bedroom's light, spilling out of its door into the corridor while the door is open. It stands
  // well back in the bedroom, so the doorway frames it cleanly: from right behind the wall it lit a
  // ragged sliver of ceiling along the top of the wall.
  const spill = new THREE.SpotLight(DAY.spill, 0, 3.8, 0.8, 0.9, 2); // reaching the corridor's far wall, no further
  spill.position.set((ROOM.door.x0 + ROOM.door.x1) / 2, 1.75, D - 0.6);
  spill.target.position.set(spill.position.x - 0.2, 0, D + 1.5);
  spill.castShadow = true; // or it would shine on through the corridor's far wall into the bathroom
  spill.shadow.mapSize.set(512, 512);
  // (a spot's shadow depth is perspective: with its near plane at 0.1 m a bias of −0.002 was worth some
  // 15 cm out at the bathroom, and the floor that far behind the corridor's wall and the bathroom's door
  // came out lit — user, 2026-10-15, the bathroom in the dark. Near at 0.5 m, a small bias; and it sees
  // the walls as solid blocks, like the sun: `thick` below)
  spill.shadow.camera.near = 0.5;
  spill.shadow.camera.far = 3.8;
  spill.shadow.bias = -0.0001;
  spill.shadow.normalBias = 0.005;
  scene.add(spill, spill.target);
  const indoorLamps = [];
  // the kitchen's ceiling light, switched on
  const kitchenLight = shadowedLamp(0xffe4bf, 1.5, 6.5, [-2.7, H - 0.13, 2.0]);
  scene.add(kitchenLight);
  indoorLamps.push(kitchenLight);
  // the bathroom: flush lights down the middle of its ceiling, one after another the length of it, each a
  // drum of brushed nickel with a white diffuser under it, cold and white. The two nearer the door shadowed
  // (walls on the other side of them: the corridor, the living room); the far one, by the bath, has nothing
  // past its walls to light
  const diffuser = std({ color: 0xf6f8fa, emissive: 0xeef3fa, emissiveIntensity: 1.1, roughness: 0.6 });
  const drumMetal = Object.assign(mat.brushed.clone(), { envMap: cool, envMapIntensity: 0.8 });
  const bathLamps = [1 / 6, 3 / 6, 5 / 6].map((f, i) => {
    const z = B.z0 + (B.z1 - B.z0) * f;
    const drum = F.ceilingDrum(drumMetal, diffuser);
    drum.position.set((B.x0 + B.x1) / 2, H, z);
    g.add(drum);
    const at = [(B.x0 + B.x1) / 2, H - 0.13, z];
    const l = i < 2 ? shadowedLamp(0xeef3ff, 1.7, 7, at) : new THREE.PointLight(0xeef3ff, 1.7, 7, 2);
    l.position.set(...at);
    scene.add(l);
    if (i < 2) indoorLamps.push(l);
    return l;
  });
  // and its light out of its door into the corridor while the door is open (user, 2026-11-03: "it stops on the
  // threshold"): the lit white room seen through the doorway is a lamp of its own to the corridor. In the doorway
  // itself, turned away from the bathroom, so its cone, not a shadow, keeps it to the corridor (one more shadowed
  // light in here and Mum stops drawing: she has one texture to spare)
  const bathSpill = new THREE.SpotLight(0xeef3ff, 0, 4.2, 1.15, 1, 2);
  bathSpill.position.set((DOORS.bath.x0 + DOORS.bath.x1) / 2, 1.45, C.z1 + t / 2);
  bathSpill.target.position.set(bathSpill.position.x, 0.6, C.z0 - 0.6);
  scene.add(bathSpill, bathSpill.target);
  // the standard lamp by the sofa
  const lamp = shadowedLamp(0xffb36a, 1.6, 7, [-4.62, 1.515, 8.55]); // (in its bulb: below.)
  scene.add(lamp);
  indoorLamps.push(lamp);
  // the daylight in at the living room's window, the curtains being open, and at the kitchen's: each
  // window itself a soft panel of light the size of its glass, shining into the room. A panel, not a
  // lamp: things close to the glass are lit as by a window and not as by a bulb a hand's width away.
  RectAreaLightUniformsLib.init();
  const windowLight = (cfg, w, h, at, to) => {
    const l = new THREE.RectAreaLight(cfg.color, cfg.intensity, w, h);
    l.position.set(...at);
    l.lookAt(...to);
    scene.add(l);
    return l;
  };
  const lz = (LWIN.z0 + LWIN.z1) / 2, kx = (KWIN.x0 + KWIN.x1) / 2;
  windowLight(DAY.window, LWIN.z1 - LWIN.z0, LWIN.y1 - LWIN.y0, [L.x0 + 0.02, (LWIN.y0 + LWIN.y1) / 2, lz], [L.x0 + 3, (LWIN.y0 + LWIN.y1) / 2 - 0.6, lz]);
  windowLight(DAY.kitchen, KWIN.x1 - KWIN.x0, KWIN.y1 - KWIN.y0, [kx, (KWIN.y0 + KWIN.y1) / 2, 0.02], [kx, (KWIN.y0 + KWIN.y1) / 2 - 0.6, 3]);
  // what only the light from outside sees: the bedroom in one piece, and every wall as thick as it
  // really is (a wall's shadow taken at its inner face lets a thin line of light in along its edges)
  shadowOnly(bedroom, [sun, sky]);
  shadowOnly(thick, [sun, sky, spill]); // (the spill too: with only a wall's far face in its shadow, the floor just behind it, and the corner where two walls meet, caught its light)

  // ---- what happens every frame: doors swing, the outside brightens or dims for the eye, the
  // corridor gets what light the bedroom door lets out
  const shadowed = [sun, sky, spill, ...indoorLamps];
  for (const l of shadowed) l.shadow.autoUpdate = false;
  let gain = 1.8, bedroomDoor = -1, doorTick = 0;
  const due = new Map(); // light → how many more frames its shadow wants drawing
  const mark = (lights, n = 2) => {
    for (const l of lights) {
      due.set(l, Math.max(due.get(l) ?? 0, n));
      l.userData.stale = Math.max(l.userData.stale ?? 0, n); // (what stands still has moved: layeredShadow)
    }
  };
  mark(shadowed, 3);
  yard.shadowsMoved(() => mark([sun, sky], 2)); // (the spade taken off the sand, the sand dug)
  doors[1].lights = bathLamps; // the bathroom door
  shadowOnly(doors[1].block, bathLamps); // (and for its lamps, solid past its edges: no light round it shut)
  for (const d of doors) if (d.block && d !== doors[1]) d.block.removeFromParent(); // (the other doors have no lamp beyond them)
  // the fridge's doors swing like the others; what they shade is drawn again, the fridge's own lamp too
  for (const d of kit.fridge.doors) {
    d.lights = [kitchenLight, kit.fridge.light];
    doors.push(d);
  }
  mark([kit.fridge.light], 3);
  // Mum (user, 2026-10-23): in the kitchen, between the sink and the table, arms folded, facing the way in from the
  // corridor (mother.js); she can see you anywhere in the kitchen and living room (one room, no wall between), up in
  // the house; once she is there, what she shades is drawn again
  // (as she moves, the lamp's shadow is drawn again for her alone, over the house's as it was kept: layeredShadow)
  let mum = null;
  layeredShadow(renderer, scene, kitchenLight, () => (mum ? [mum] : []));
  mother(g, ctx, -1.45, 1.35, [-0.3, 4.9], (p) => p.y > 0.5 && p.x > L.x0 && p.x < L.x1 && p.z > L.z0 && p.z < L.z1,
    { board: kit.board, moved: () => due.set(kitchenLight, Math.max(due.get(kitchenLight) ?? 0, 1)), renderer }).then((her) => { mum = her; mark(shadowed, 2); }); // (now and then off to the chopping board: the lamp's shadow of her drawn again as she goes)
  // the toilet's lid turns like a door does, and lets you know when it has
  const lid = bath.lid;
  lid.userData.door = { state: { angle: 0, target: 0 }, lights: bathLamps, apply() { lid.rotation.x = -this.state.angle; } }; // (down to begin with: user, 2026-10-20)
  lid.userData.door.apply();
  doors.push(lid.userData.door);
  // the wall cabinet's door: E opens it and shuts it, swinging out into the room on its hinge (a door
  // like the others, so what it shades is drawn again); open, you bump into it and the boat keeps off it
  const cabinet = bath.cabinet, cabHinge = cabinet.userData.door, { W: cabW, DOOR: cabDoorT } = cabinet.userData.size;
  const cabSeg = { type: 'seg', ax: 0, az: 0, bx: 0, bz: 0, r: 0.012, base: cabinet.position.y - 0.01, top: cabinet.position.y + 0.51 };
  const cabA = new THREE.Vector3(), cabB = new THREE.Vector3();
  const cabDoor = {
    state: { angle: 0, target: 0 },
    lights: bathLamps,
    apply() {
      cabHinge.rotation.y = this.state.angle;
      cabHinge.updateMatrixWorld(true);
      cabHinge.localToWorld(cabA.set(0, 0, cabDoorT));
      cabHinge.localToWorld(cabB.set(-cabW, 0, cabDoorT));
      Object.assign(cabSeg, { ax: cabA.x, az: cabA.z, bx: cabB.x, bz: cabB.z });
    },
  };
  cabDoor.apply();
  doors.push(cabDoor);
  cabHinge.userData.interact = {
    label: () => (cabDoor.state.target > 0.5 ? 'Close the cabinet' : 'Open the cabinet'),
    use: () => {
      const opening = cabDoor.state.target < 0.5;
      cabDoor.state.target = opening ? deg(105) : 0;
      ctx.sound.sample(opening ? 'cabinet-open' : 'cabinet-close', cabA); // silent until there is a recording
    },
  };
  ctx.interact.push(cabHinge);
  const cabinetBlock = () => (cabDoor.state.angle > 0.05 ? { x0: Math.min(cabSeg.ax, cabSeg.bx) - 0.02, x1: Math.max(cabSeg.ax, cabSeg.bx) + 0.02, z0: Math.min(cabSeg.az, cabSeg.bz) - 0.02, z1: Math.max(cabSeg.az, cabSeg.bz) + 0.02, base: cabSeg.base, top: cabSeg.top } : null);
  // what stands up into the bathroom's water (the bath, the basin, the toilet, the cabinet, and its door
  // open): the floating duck drifts round it (bath.js)
  const standing = ctx.colliders.filter((c) => c.type === 'box' && c.top !== undefined && c.x1 > B.x0 && c.x0 < B.x1 && c.z1 > B.z0 && c.z0 < B.z1);
  bath.water.blocks = () => [...standing, cabinetBlock()];
  // in the cabinet, lying on its lower shelf: a UV torch (user, 2026-10-15). Take it, hold it (I), and it is on.
  const torch = F.uvTorch(cool);
  torch.position.set(0.045, cabinet.userData.size.H / 3 + 0.002, 0.049);
  torch.rotation.y = 0.17;
  torch.userData.live = true;
  cabinet.add(torch);
  takeable(ctx, torch, { id: UV_TORCH, name: 'UV torch', line: "A torch with a purple light. Like on Mum's crime shows.", reach: [0.15, 0.045], grip: { turn: Math.PI / 2 }, taken: () => mark(bathLamps) })();
  // the light switch by the door, inside, beside the casing on the latch side (the door is hinged on the
  // east: open, it would stand in front of a switch on that side): off, the room is dark but for what comes
  // in at the door
  let bathLit = true;
  const BATH_LAMP = bathLamps[0].intensity, DIFFUSER = diffuser.emissiveIntensity, BATH_SPILL = 2.2; // (BATH_SPILL: its light out of the door, the door wide open)
  const lightSwitch = F.wallSwitch(cool);
  lightSwitch.position.set(DOORS.bath.x0 - 0.15, 1.2, B.z0);
  g.add(lightSwitch);
  lightSwitch.userData.interact = {
    label: () => (bathLit ? 'Turn the light off' : 'Turn the light on'),
    use: () => {
      bathLit = !bathLit;
      lightSwitch.userData.flip(bathLit);
      for (const l of bathLamps) l.intensity = bathLit ? BATH_LAMP : 0;
      diffuser.emissiveIntensity = bathLit ? DIFFUSER : 0;
      bath.traceDark.value = bathLit ? 0 : 1;
      ctx.sound.click(lightSwitch.getWorldPosition(new THREE.Vector3()));
    },
  };
  ctx.interact.push(lightSwitch);
  doors[2].lights = [sun, sky, kitchenLight]; // the back door (its leaf shades the kitchen's lamp too)
  const api = {
    scene,
    occluders,
    yard, // (its trees, swing and the like, for checking)
    outdoorMaterials, // (how many are lit by the sun and the sky alone)
    bath: bath.water, // the bath's water and its taps (bath.js)
    /** The bathroom's floor, where the bath's front is, and its doorway. */
    bathroom: { ...B, bathFront: B.z1 - 0.76, door: DOORS.bath },
    /** The bathroom's door ({ state, seg }: it shuts behind you, main.js) and what its glaze reflects. */
    bathDoor: doors[1],
    bathEnv: cool,
    /** Things that move that you can't walk through, and that aren't in the colliders (Luna's paths would go round them): the open cabinet door. */
    extraColliders: [cabSeg, ...kit.fridge.segs],
    /** Doors that swing out into the room, as segment colliders, for Luna to keep out of (the fridge's). */
    swinging: kit.fridge.segs,
    /** The wall cabinet's door while it stands open, as a box {x0, x1, z0, z1, base, top}, or null. */
    cabinetBlock,
    /** Whether the bathroom's light is on. */
    bathLit: () => bathLit,
    /** The UV torch (its LEDs: `userData.leds`). */
    torch,
    /** The storm cellar and the basement under the house (basement.js). */
    cellar: cellarWay,
    /** Which room x, z is in: 'bedroom', 'corridor', 'bath', 'living' (the kitchen too) or 'yard'; null in a doorway or a wall. */
    roomAt(x, z) {
      if (x > 0 && x < W && z > 0 && z < D) return 'bedroom';
      if (x > C.x0 && x < C.x1 && z > C.z0 && z < C.z1) return 'corridor';
      if (x > B.x0 && x < B.x1 && z > B.z0 && z < B.z1) return 'bath';
      if (x > L.x0 && x < L.x1 && z > L.z0 && z < L.z1) return 'living';
      if (x > Y.x0 && x < (z < Y.step - PORCH ? Y.x2 : Y.x1) && z > Y.z0 - PORCH && z < -t) return 'yard'; // (the porch too: out of doors)
      return null;
    },
    /** The floor Luna can get about on: every room of the house but Mum's, and the doorways between (not the yard). */
    catFloor: {
      x0: L.x0 - t, z0: -t, w: C.x1 + 2 * t - L.x0, d: B.z1 + 2 * t,
      inside: (x, z) => [[0, W, 0, D], [C.x0, C.x1, C.z0, C.z1], [B.x0, B.x1, B.z0, B.z1], [L.x0, L.x1, L.z0, L.z1]].some(([a, b, c, d]) => x > a - t && x < b + t && z > c - t && z < d + t),
    },
    /**
     * Where Luna jumps up to, out of the bedroom (as BED_SPOTS in cat.js): the floor she takes off from,
     * where she lands, and somewhere on it to walk on to. The sofa, the coffee table, the kitchen table.
     * Not the bath (user, 2026-10-15): she never climbs on it — afloat in her boat or swimming in her
     * diving gear she goes over it, as the water does.
     */
    catPerches: [
      { off: [-3.95, 6.72], land: [-4.56, 0.452, 6.72], rest: [-4.58, 0.447, 7.3] }, // the sofa (its seats' tops, where they sag)
      { off: [-3.95, 7.12], land: [-4.56, 0.458, 7.12], rest: null },
      { off: [-3.64, 6.96], land: [-3.13, 0.45, 6.96], rest: null }, // the coffee table, in the clear corner of it (she landed on the ashtray: user, 2026-10-17)
      { off: [-4.05, 2.4], land: [-3.38, 0.76, 2.42], rest: [-3.2, 0.76, 2.55], edge: [-3.4, 0.76, 2.42], drop: [-4.2, 2.44], arc: 0.15 }, // the kitchen table (up and down over its edge, not through it: cat.js)
    ],
    /** Changes whenever one of the house's doors has moved. */
    doorStamp: () => doors.map((d) => Math.round(d.state.angle * 20)).join(','),
    bounds: { x0: Y.x0, x1: C.x1 + t, z0: Y.z0 - PORCH, z1: B.z1 + t, top: H },
    /** What you are walking on at x, z, your feet at `feet`. */
    floorAt(x, z, feet = 0) {
      const below = cellarWay.floorAt(x, z, feet);
      if (below) return below;
      if (x >= 0 && x <= W && z >= 0 && z <= D) return 'carpet';
      if (bath.water.wet(x, z)) return 'water';
      if (Math.abs(x + 2.75) < 1.35 && Math.abs(z - 7.15) < 1.1) return 'carpet'; // the rug
      if (z < -t) return z > -t - PORCH && x > Y.x0 && x < PORCH_X1 ? 'wood' : 'grass'; // (the porch's boards)
      if (x >= B.x0 && x <= B.x1 && z >= B.z0) return 'tile';
      if (x < -t && z < PLAN.kitchenTo) return 'tile';
      if (x > C.x0 && x < C.x1 && z > C.z0 - t && z < C.z1 + t) return 'carpet'; // the corridor's, and through its doorways
      return 'wood';
    },
    /** How high the ground is here with nothing on it, for feet at `feet`: the house's floor and its porch 0, the yard LIFT lower, the cellar's steps and the basement under it all. */
    baseAt: (x, z, feet = 0) => cellarWay.baseAt(x, z, feet) ?? (z >= -t || (z >= -t - PORCH && x >= Y.x0 && x <= PORCH_X1) ? 0 : -LIFT),
    /** 0 indoors, 1 out in the yard. */
    outdoors: (p) => THREE.MathUtils.clamp((-t - p.z) / 0.4, 0, 1),
    /** Whether its shadows want drawing this frame; asks for them if so. */
    shadowsDue() {
      if (!due.size) return false;
      for (const [l, n] of due) {
        l.shadow.needsUpdate = true;
        if (n <= 1) due.delete(l);
        else due.set(l, n - 1);
      }
      return true;
    },
    update(dt, time, eye, bedroomDoorOpen, bedroomLit = 1) {
      WIND.time.value = time; // (the breeze in the leaves: grove.js)
      doorTick++;
      // the bathroom with its light off: dark, but for what comes in at the door, the more the wider it stands
      bath.water.volume.dim(bathLit ? 1 : 0.025 + 0.07 * THREE.MathUtils.clamp(doors[1].state.angle / deg(70), 0, 1));
      for (const d of doors) {
        if (d.state.slam) {
          // flung shut: a shove, faster and faster, the bang on the frame, a small kick back off it, still
          d.vel = d.vel ?? -1.5;
          d.vel -= 10 * dt;
          d.state.angle += d.vel * dt;
          if (d.state.angle <= d.state.target) {
            d.state.angle = d.state.target;
            if (!d.banged) { d.banged = true; d.onSlam?.(); }
            d.vel = -d.vel * 0.12;
            if (d.vel < 0.08) { d.state.slam = false; d.vel = undefined; d.banged = false; }
          }
          d.apply();
          d.moving = true;
          mark(d.lights ?? shadowed, 1);
          continue;
        }
        const delta = d.state.target - d.state.angle;
        if (Math.abs(delta) < 1e-4) {
          if (d.moving) mark(d.lights ?? shadowed); // come to rest: draw what it shades once more
          d.moving = false;
          continue;
        }
        d.state.angle += delta * (1 - Math.exp(-dt * 5));
        d.apply();
        d.moving = true;
        if (doorTick % 4 === 0) mark(d.lights ?? shadowed, 1); // while it swings, now and then is enough
      }
      // the eye opens up indoors, so the yard through a window is far brighter than the room; out in it, it
      // isn't — and out there it is dimmer than it was (YARD_LIGHT: user, 2026-10-17, "lower the brightness in the yard")
      gain += ((api.outdoors(eye) > 0.5 ? YARD_LIGHT : 1.8) - gain) * (1 - Math.exp(-dt * 1.6));
      // (the rooms keep the sun they have from inside wherever your eye is — seen from the yard they had been lit
      // by the open sky's fill and far brighter: user, 2026-10-20; what is out of doors takes `gain` as before)
      sun.intensity = SUN * 1.8;
      sky.intensity = SKY * 1.8;
      YARD_SUN.value = gain / 1.8;
      const out = api.outdoors(eye);
      fill.k = (fill.k ?? out) + (out - (fill.k ?? out)) * (1 - Math.exp(-dt * 4));
      hemiOut.color.lerpColors(fill.inSky, fill.outSky, fill.k);
      hemiOut.groundColor.lerpColors(fill.inGround, fill.outGround, fill.k);
      hemiOut.intensity = THREE.MathUtils.lerp(DAY.hemi.house, DAY.hemi.yard.intensity * YARD_LIGHT, fill.k);
      yard.brighten(gain + (1 - YARD_LIGHT) * 0.6 * fill.k); // (the sky itself dimmed less)
      spill.intensity = DAY.spillPower * bedroomDoorOpen * bedroomLit; // (as much light as the bedroom has: less with its blind shut)
      bathSpill.intensity = bathLit ? BATH_SPILL * THREE.MathUtils.clamp(doors[1].state.angle / deg(70), 0, 1) : 0;
      if (Math.abs(bedroomDoorOpen - bedroomDoor) > 1e-3) {
        bedroomDoor = bedroomDoorOpen;
        if (doorTick % 4 === 0) mark([spill], 1); // the bedroom door moved: what it lets out has changed
      } else if (bedroomDoor >= 0 && !due.has(spill) && spill.userData.settled !== bedroomDoor) {
        spill.userData.settled = bedroomDoor;
        mark([spill]);
      }
      bath.water.update(dt, time);
      yard.update(dt, time, eye); // (eye: where the grass is drawn finest)
      cellarWay.update(dt, time);
    },
  };
  return api;
}

// ---------------------------------------------------------------- light helpers

/** A light from far off, its shadow covering the whole house and yard; `size` its shadow map's side. */
function outdoorLight(scene, color, dir, middle, size = 2048) {
  const l = new THREE.DirectionalLight(color, 1);
  l.position.copy(middle).addScaledVector(dir, -40); // (further back since the garden reached past the pool: the far corner high up was in front of it)
  l.target.position.copy(middle);
  l.castShadow = true;
  l.shadow.mapSize.set(size, size);
  const cam = l.shadow.camera;
  // just big enough for the house and the whole yard to its far fence, the grove's crowns too, seen the
  // way the light sees them (across it: left/right, cam.x = dir × up; up it: bottom/top)
  const x = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), y = new THREE.Vector3().crossVectors(x, dir);
  const ext = [Infinity, -Infinity, Infinity, -Infinity], p = new THREE.Vector3();
  for (const px of [-8.0, 13.0]) for (const py of [-LIFT, 17.5]) for (const pz of [Y.z0 - PORCH - 5.0, B.z1 + 0.7]) { // (the wood's tall crowns; the yard where it is now)
    p.set(px, py, pz).sub(middle);
    const u = p.dot(x), v = p.dot(y);
    ext[0] = Math.min(ext[0], u); ext[1] = Math.max(ext[1], u); ext[2] = Math.min(ext[2], v); ext[3] = Math.max(ext[3], v);
  }
  [cam.left, cam.right, cam.bottom, cam.top] = ext;
  // its depth: from just short of the nearest corner of all that, 59 m deep as it always was (the bias below is a
  // fraction of that: the same in metres)
  let near = Infinity;
  for (const px of [-8.0, 13.0]) for (const py of [-LIFT, 17.5]) for (const pz of [Y.z0 - PORCH - 5.0, B.z1 + 0.7]) near = Math.min(near, p.set(px, py, pz).sub(l.position).dot(dir));
  cam.near = Math.max(1, near - 1);
  cam.far = cam.near + 59;
  // (margins of a few millimetres: at 3.5 cm deep and 3 along the surface, with the sun 15° up every shadow on the
  // ground came up short by 11 cm, a gap opened under whatever stood on it, and anything within 3 cm of a wall —
  // a strap, a frame — threw none at all; user, 2026-10-28: "not placed precisely". Three draws the back faces
  // into the map, so closed things don't shadow themselves without them)
  l.shadow.bias = -0.0001;
  l.shadow.normalBias = 0.006;
  scene.add(l, l.target);
  return l;
}

/** A lamp in a room, whose walls keep its light in. */
function shadowedLamp(color, intensity, reach, [x, y, z]) {
  const l = new THREE.PointLight(color, intensity, reach, 2);
  l.position.set(x, y, z);
  l.castShadow = true;
  l.shadow.mapSize.set(512, 512);
  l.shadow.camera.near = 0.05;
  l.shadow.camera.far = reach;
  l.shadow.bias = -0.0005; // (3.5 mm along the ray; at 1.4 cm, and 2 along the surface, shadows stood off what cast them and came up short)
  l.shadow.normalBias = 0.008;
  return l;
}

/** What the house's shiny things reflect: a dim room in the colours of the house, a daylit window, no lamps. */
function homeRoom(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(8, 5, 8), new THREE.MeshBasicMaterial({ color: 0x3a332c, side: THREE.BackSide })));
  // dim: seen edge-on, anything reflects what it faces almost whole, and a bright window here made every narrow edge a line of light
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.78, 0.84) }));
  win.position.set(-3.95, 0.6, 0.5);
  win.rotation.y = Math.PI / 2;
  env.add(win);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.05).texture;
  pm.dispose();
  return tex;
}

/**
 * What bare metal out in the yard reflects (the slide): the sky above, hazy and pale as steel shows it (the
 * dome's own blue made the steel read as blue plastic), the fences and the lawn below, darker.
 */
function yardSky(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16), new THREE.MeshBasicMaterial({ map: T.skyTex([[0, '#a9b3bd'], [0.4, '#c9cfd2'], [0.49, '#dcdcd6'], [0.52, '#6f6c60'], [1, '#3e3d34']]), side: THREE.BackSide })));
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.04).texture;
  pm.dispose();
  return tex;
}

/** What the bathroom's glaze reflects: a white room with a softly bright square in the ceiling. */
function coolRoom(renderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshBasicMaterial({ color: 0xc6cacd, side: THREE.BackSide })));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3.15, 3.5) }));
  panel.rotation.x = Math.PI / 2;
  panel.position.y = 1.45;
  env.add(panel);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.04).texture;
  pm.dispose();
  return tex;
}

// ---------------------------------------------------------------- doors, windows, fittings

const FAN_SPEED = 0.9; // (the air conditioner's fan, radians a second)
/**
 * One jam of the fan, as lengths of time each with its speed (`v(u)`, u 0…1 along it), by dice `r`. It may catch sharply and break free
 * sharply, but it never stops out of nothing: first it shows it is struggling, dragging and uneven (user, 2026-11-02). 0 it drags a
 * moment, catches, gets going again; 1 it struggles for longer, hesitating, catches, tries and sticks again, then goes; 2 it
 * runs down slower and slower, catches hard, stays stuck a good while, then gets going and races before it settles. From still it
 * always starts slowly, half a second creeping round (`wake`).
 */
function fanJam(r) {
  const ease = (u) => u * u * u * (u * (u * 6 - 15) + 10), N = FAN_SPEED, kind = Math.floor(r() * 3), parts = [];
  const lerp = (dur, a, b) => parts.push([dur, (u) => a + (b - a) * ease(u)]);
  const still = (dur) => parts.push([dur, () => 0]);
  const drag = (dur, level, beats, dip) => parts.push([dur, (u) => level * (1 - dip * Math.sin(Math.PI * beats * u) ** 2)]); // (uneven, labouring round)
  // (off again from still: half a second creeping round, slowly picking up, before it gets going — not with a jerk: user, 2026-11-03)
  const wake = (level) => parts.push([0.5, (u) => level * u * u]);
  if (kind === 0) {
    const low = N * (0.5 + r() * 0.2);
    lerp(0.5 + r() * 0.4, N, low);
    drag(0.5 + r() * 0.8, low, 1 + Math.floor(r() * 2), 0.3 + r() * 0.25);
    lerp(0.14 + r() * 0.14, low, 0);
    still(0.25 + r() * 0.8);
    const w = N * (0.3 + r() * 0.1);
    wake(w);
    lerp(0.2 + r() * 0.1, w, N * 1.25);
    lerp(0.4 + r() * 0.3, N * 1.25, N);
  } else if (kind === 1) {
    const low = N * (0.42 + r() * 0.2);
    lerp(0.5 + r() * 0.4, N, low);
    drag(1.2 + r() * 1.5, low, 2 + Math.floor(r() * 3), 0.45 + r() * 0.3);
    lerp(0.14 + r() * 0.12, low, 0);
    still(0.35 + r() * 0.7);
    const kick = N * (0.25 + r() * 0.15); // (a try that doesn't take)
    wake(kick);
    lerp(0.15 + r() * 0.12, kick, 0);
    still(0.3 + r() * 0.7);
    const w = N * (0.3 + r() * 0.1);
    wake(w);
    lerp(0.2 + r() * 0.1, w, N * 1.2);
    lerp(0.4 + r() * 0.3, N * 1.2, N);
  } else {
    const low = N * (0.2 + r() * 0.12), surge = N * (1.5 + r() * 0.4);
    lerp(1 + r() * 0.8, N, low);
    drag(0.4 + r() * 0.5, low, 1, 0.4 + r() * 0.3);
    lerp(0.1 + r() * 0.08, low, 0);
    still(1.8 + r() * 2.8);
    const w = N * (0.3 + r() * 0.1);
    wake(w);
    lerp(0.25 + r() * 0.1, w, surge);
    lerp(1 + r() * 0.8, surge, N);
  }
  return parts;
}
/** The fan's speed `s` seconds into a jam; null when it is over. */
function fanJamSpeed(parts, s) {
  for (const [dur, v] of parts) { if (s < dur) return v(s / dur); s -= dur; }
  return null;
}

/**
 * A door in a wall, made like the bedroom's: casing on both faces, the jambs lined, a panelled
 * leaf with a knob each side. `a`, `b`: the jambs, on the wall's centre line ([x, z]); `swing`:
 * the side it opens into; `open`: how far it stands open to begin with; `locked`: what you think
 * when you try it, if it won't open; `inner`, `innerTrim`: the leaf and casing on the side it opens to, if not the usual.
 */
function hingedDoor(ctx, M, parent, { a, b, swing, open = 0, locked = null, label = 'door', glass = false, front = false, inner = null, innerTrim = null, sill = null, threshold = null, worn = null }) {
  const f = onWall(parent, a, b, swing);
  const dw = f.userData.width;
  // in the frame: x along the opening from the hinge jamb, the wall across z −t/2…t/2, opening towards −z
  if (worn) {
    // `worn`: the casing on the side it opens to, outdoors — wide flat boards, a drip cap over the head, white
    // paint peeling off them to grey wood (user, 2026-10-19, after his photo)
    const up = metric(std({ map: rotated(worn.map), roughness: worn.roughness }), worn.userData.period);
    const z0 = -t / 2 - 0.024, z1 = -t / 2, W2 = 0.13;
    f.add(slab(-W2, 0, 0, DOOR_H + 0.16, z0, z1, up));
    f.add(slab(dw, dw + W2, 0, DOOR_H + 0.16, z0, z1, up));
    f.add(slab(0, dw, DOOR_H, DOOR_H + 0.16, z0, z1, worn));
    f.add(slab(-W2 - 0.02, dw + W2 + 0.02, DOOR_H + 0.16, DOOR_H + 0.19, z0 - 0.02, z1, worn)); // the drip cap
  } else casing(f, innerTrim ? { trim: innerTrim } : M, dw, DOOR_H, -t / 2, -1);
  casing(f, M, dw, DOOR_H, t / 2, 1);
  f.add(boxMM(0, 0.02, 0, DOOR_H, -t / 2, t / 2, M.trim));
  f.add(boxMM(dw - 0.02, dw, 0, DOOR_H, -t / 2, t / 2, M.trim));
  f.add(boxMM(0, dw, DOOR_H - 0.02, DOOR_H, -t / 2, t / 2, M.trim));
  // the floor through the opening, lapping a little onto the floors either side so no crack shows
  if (sill && !threshold) f.add(slab(-0.005, dw + 0.005, -0.01, 0.001, -t / 2 - 0.006, t / 2 + 0.006, sill));
  if (threshold) { // an outside door's: an aluminium saddle across the whole depth of the wall, bevelled down to the floor each side
    const e = t / 2 + 0.01, flatTo = t / 2 - 0.018, hgt = 0.013;
    const shape = new THREE.Shape([[-e, 0], [-flatTo, hgt], [flatTo, hgt], [e, 0]].map(([u, v]) => new THREE.Vector2(u, v)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: dw + 0.01, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-0.005, 0, 0);
    const saddle = new THREE.Mesh(geo, threshold);
    saddle.receiveShadow = true;
    f.add(saddle);
  }
  const lw = dw - 0.045, lh = DOOR_H - 0.025 - (threshold ? 0.014 : 0), lt = front ? 0.05 : 0.04; // (over a threshold: shorter, standing on it)
  const pivot = new THREE.Group();
  pivot.position.set(0.02, 0, -t / 2 + lt / 2 + 0.004); // the leaf sits wholly inside the frame: no edge of it stands proud
  f.add(pivot);
  // the stops round the frame that the leaf shuts against: no light round the edges of a shut door
  const sz0 = pivot.position.z + lt / 2, sz1 = sz0 + 0.012;
  // (each runs a little into the jamb it stands on, so not even a hairline shows where they meet)
  f.add(boxMM(dw - 0.036, dw - 0.012, 0, DOOR_H - 0.012, sz0, sz1, M.trim));
  f.add(boxMM(0.012, 0.034, 0, DOOR_H - 0.012, sz0, sz1, M.trim));
  f.add(boxMM(0.012, dw - 0.012, DOOR_H - 0.036, DOOR_H - 0.012, sz0, sz1, M.trim));
  const edge = DOOR_EDGE; // matte: seen edge-on, a glossy edge catches the light like a blade
  const faceMats = [edge, edge, edge, edge, M.door, inner ?? M.door]; // its −z face is the side it opens to
  if (!glass) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, lt), faceMats);
    leaf.position.set(lw / 2, lh / 2 + 0.003, 0); // down to just above the floor: no gap of light under it
    leaf.castShadow = leaf.receiveShadow = true;
    pivot.add(leaf);
  } else {
    // the back door (user, 2026-10-19, after his photo of an old farmhouse door — its shape and feel, nothing
    // of it copied): a green painted frame of narrow stiles and rails, chipped and peeling to grey wood; the
    // top half one big pane of glass with a lace curtain behind it, gathered on a rod top and bottom; the
    // bottom half a grille of big square holes with a rusted wire screen behind it. It opens out, over the step: the leaf stands a
    // little higher off the threshold than an inside door, clear of the doormat
    const green = metric(std({ map: T.peelingPaintTex('#2e5a3d', 61, 0.34), roughness: 0.72 }), 0.6);
    const greenUp = metric(std({ map: rotated(green.map), roughness: 0.72 }), 0.6); // (the stiles: grain up them)
    const ST = 0.08, TOPR = 0.08, MID0 = 0.93, MID1 = 1.01, BOT = 0.085, y0 = 0.028, lh2 = DOOR_H - 0.022 - y0;
    const part = (x0, x1, a, b, depth = lt, m = green) => {
      const geo = new RoundedBoxGeometry(x1 - x0, b - a, depth, 2, 0.003), P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
      const cx = (x0 + x1) / 2, cy = (a + b) / 2 + y0;
      for (let i = 0; i < P.count; i++) { // its UVs from where it is, in metres, on whichever face (the paint's pattern lines up and never stretches)
        const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i)), x = P.getX(i) + cx, y = P.getY(i) + cy, z = P.getZ(i);
        U.setXY(i, ...(nz >= nx && nz >= ny ? [x, y] : nx >= ny ? [z, y] : [x, z]).map((v) => v / 0.6));
      }
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(cx, cy, 0);
      mesh.castShadow = mesh.receiveShadow = true;
      pivot.add(mesh);
      return mesh;
    };
    part(0, ST, 0, lh2, lt, greenUp); // the stiles
    part(lw - ST, lw, 0, lh2, lt, greenUp);
    part(ST, lw - ST, lh2 - TOPR, lh2); // the rails: top, in the middle, bottom
    part(ST, lw - ST, MID0, MID1);
    part(ST, lw - ST, 0, BOT);
    // the glass, and a bead round it each side
    const gx0 = ST, gx1 = lw - ST, gy0 = MID1, gy1 = lh2 - TOPR;
    // (one pane, so one bottom to its dust; and a film over all of it, thicker than a window's: through the lace and
    // the glass the yard was dimmed only where the dust lay in bands, and seen straight on, where the glass reflects
    // least, the trees showed clear in between — user, 2026-10-23)
    const pane = M.pane(gx1 - gx0, gy1 - gy0, false, { halves: 1, veil: 0.13 });
    pane.position.set((gx0 + gx1) / 2, (gy0 + gy1) / 2 + y0, 0);
    pivot.add(pane);
    for (const side of [1, -1]) {
      const z = side * (lt / 2 - 0.004);
      for (const [x0, x1, a, b] of [[gx0, gx1, gy0, gy0 + 0.014], [gx0, gx1, gy1 - 0.014, gy1], [gx0, gx0 + 0.014, gy0, gy1], [gx1 - 0.014, gx1, gy0, gy1]]) {
        const bead = part(x0, x1, a, b, 0.012);
        bead.position.z = z + side * 0.002;
      }
    }
    // inside, behind the glass: the lace, gathered in soft folds between a rod at its top and one at its foot
    const cw = gx1 - gx0 - 0.03, ch = gy1 - gy0 - 0.05, cz = lt / 2 + 0.014;
    const lace = new THREE.PlaneGeometry(cw, ch, 60, 1), LP = lace.attributes.position;
    for (let i = 0; i < LP.count; i++) LP.setZ(i, 0.006 * Math.sin((LP.getX(i) / cw) * Math.PI * 2 * 9) + 0.002 * Math.sin((LP.getX(i) / cw) * 23.0));
    lace.computeVertexNormals();
    const curtain = new THREE.Mesh(lace, std({ map: T.laceTex(), alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }));
    curtain.position.set((gx0 + gx1) / 2, (gy0 + gy1) / 2 + y0, cz);
    curtain.receiveShadow = true;
    pivot.add(curtain);
    for (const y of [gy1 - 0.02, gy0 + 0.02]) {
      const rod = cyl(0.004, 0.004, cw + 0.04, M.knob, (gx0 + gx1) / 2, y + y0, cz + 0.004, 8);
      rod.rotation.z = Math.PI / 2;
      pivot.add(rod);
    }
    // below (user, 2026-10-19): a grille of square holes on the outside, its bars painted the green once and
    // gone dark and rusty, and behind it a screen of fine iron wire, rusted, sagging, torn here and there —
    // you see through it, dimly, into the kitchen (and out of it)
    const bars = std({ color: 0x3a3428, roughness: 0.78, metalness: 0.25 });
    // (twice as many squares, half the size — user, 2026-10-20; the bars a little lighter with them)
    const lx0 = ST, lx1 = lw - ST, ly0 = BOT, ly1 = MID0, cols = 12, cell = (lx1 - lx0) / cols, rows = Math.round((ly1 - ly0) / cell), cellY = (ly1 - ly0) / rows, bz = -lt / 2 + 0.008, BW = 0.005;
    for (let i = 1; i < cols; i++) pivot.add(boxMM(lx0 + i * cell - BW, lx0 + i * cell + BW, ly0 + y0, ly1 + y0, bz - 0.006, bz + 0.006, bars));
    for (let j = 1; j < rows; j++) pivot.add(boxMM(lx0, lx1, ly0 + j * cellY - BW + y0, ly0 + j * cellY + BW + y0, bz - 0.006, bz + 0.006, bars));
    const sw2 = lx1 - lx0, sh2 = ly1 - ly0, wire = T.wireScreenTex(), screen = new THREE.Mesh(new THREE.PlaneGeometry(sw2, sh2, 12, 16), std({ map: T.wireScreenWearTex(), alphaMap: wire, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.35 }));
    wire.repeat.set(sw2 / 0.036, sh2 / 0.036); // (a wire every 4.5 mm)
    const SP = screen.geometry.attributes.position; // sagging a little in the middle, bellied out by a knee or a dog
    for (let i = 0; i < SP.count; i++) { const u = SP.getX(i) / sw2, v = SP.getY(i) / sh2; SP.setZ(i, -0.006 * Math.cos(u * Math.PI) * Math.cos(v * Math.PI) - 0.004 * Math.exp(-((u + 0.18) ** 2 + (v + 0.2) ** 2) / 0.02)); }
    screen.geometry.computeVertexNormals();
    screen.material.forceSinglePass = true;
    screen.position.set((lx0 + lx1) / 2, (ly0 + ly1) / 2 + y0, bz + 0.012);
    screen.receiveShadow = true;
    screen.renderOrder = 2;
    pivot.add(screen);
    // the dust and grime caught in its holes (user, 2026-10-20: "in the little holes"; "dirtier at the edges"): a
    // film in the same sagging shape, drawn first, so the wires lie over it — thin in the middle, the holes silted
    // up along the frame and thickest at the foot and in the corners, fluff caught here and there (T.screenDustTex)
    const dust = new THREE.Mesh(screen.geometry, std({ map: T.screenDustTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1 }));
    dust.material.forceSinglePass = true;
    dust.position.copy(screen.position);
    dust.receiveShadow = true;
    dust.renderOrder = 1;
    pivot.add(dust);
    // lit by the kitchen's lamp as well as the sky: it stands in the doorway, half in, and its inside face
    // went black (outdoorsOnly passes over a material already marked)
    pivot.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial && o.material !== M.knob) outdoorSun(o.material); }); // (its lamps kept: build.js)
  }
  for (const side of [1, -1]) {
    const rose = cyl(0.03, 0.03, 0.008, M.knob, lw - 0.07, 0.96, side * (lt / 2 + 0.004));
    rose.rotation.x = Math.PI / 2;
    pivot.add(rose);
    const stem = cyl(0.01, 0.012, 0.04, M.knob, lw - 0.07, 0.96, side * (lt / 2 + 0.024));
    stem.rotation.x = Math.PI / 2;
    pivot.add(stem);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.031, 24, 16), M.knob);
    knob.scale.z = 0.8;
    knob.position.set(lw - 0.07, 0.96, side * (lt / 2 + 0.05));
    knob.castShadow = knob.receiveShadow = true; // without it the sun lit it through the house, and it shone white
    pivot.add(knob);
  }
  if (front) {
    // the front door: a deadbolt over the knob and a spyhole at a grown-up's eye
    for (const side of [1, -1]) {
      const bolt = cyl(0.028, 0.028, 0.012, M.knob, lw - 0.07, 1.16, side * (lt / 2 + 0.006));
      bolt.rotation.x = Math.PI / 2;
      pivot.add(bolt);
    }
    const spy = cyl(0.009, 0.009, lt + 0.01, M.knob, lw / 2, 1.55, 0);
    spy.rotation.x = Math.PI / 2;
    pivot.add(spy);
  }
  // three hinges on the hinge side
  for (const y of [0.25, 1.0, 1.75]) pivot.add(boxMM(-0.012, 0.004, y - 0.05, y + 0.05, -lt / 2 - 0.002, -lt / 2 + 0.01, M.knob));
  const state = { angle: open, target: open, open: open > 0 };
  const seg = { type: 'seg', ax: 0, az: 0, bx: 0, bz: 0, r: 0.05 };
  ctx.colliders.push(seg);
  const hinge = new THREE.Vector3(), tip = new THREE.Vector3();
  const apply = () => {
    pivot.rotation.y = state.angle;
    f.updateMatrixWorld(true);
    pivot.localToWorld(hinge.set(0, 0, 0));
    pivot.localToWorld(tip.set(lw, 0, 0));
    Object.assign(seg, { ax: hinge.x, az: hinge.z, bx: tip.x, bz: tip.z });
  };
  apply();
  const turn = (open) => {
    state.open = open;
    state.target = open ? deg(95) : 0;
    state.slam = false; // a hand on it now
    ctx.sound.door(open, hinge);
  };
  let said = '';
  pivot.userData.interact = {
    label: () => (state.open && !locked ? `Close the ${label}` : `Open the ${label}`),
    use: () => {
      said = '';
      if (locked) return;
      // `before(opening)`, set from outside (the bathroom's: main.js): something that happens first, or not
      // now — true, or what you think — instead of the door moving
      const no = door.before?.(!state.open);
      if (no) { said = no === true ? '' : no; return; }
      turn(!state.open);
    },
    say: () => locked ?? said,
  };
  ctx.interact.push(pivot);
  // a slab behind the leaf, a little bigger than it all round, for the lamps beyond it to see as solid (house.js
  // gives it to them, shadowOnly): the leaf and its stops are thinner than a texel of a lamp's shadow, and a line of
  // its light showed round the shut door — user, 2026-10-20, the bathroom's, white in the dark corridor
  const block = new THREE.Mesh(new THREE.BoxGeometry(lw + 0.06, lh + 0.05, 0.02), new THREE.MeshBasicMaterial());
  block.position.set(lw / 2, lh / 2 + 0.003, -lt / 2 - 0.012);
  pivot.add(block);
  const door = { state, apply, seg, block, turn, before: null };
  return door;
}

const DOOR_EDGE = new THREE.MeshStandardMaterial({ color: 0xddd6c7, roughness: 0.85, envMapIntensity: 0.15 });

/** The same picture turned a quarter round (for boards whose grain runs up them). */
function rotated(tex) {
  const t2 = tex.clone();
  t2.center.set(0.5, 0.5);
  t2.rotation = Math.PI / 2;
  t2.needsUpdate = true;
  return t2;
}

/** A window in a wall: casing inside and out, a sash, a sill. */
function windowIn(parent, M, a, b, inside, y0, y1) {
  const f = onWall(parent, a, b, inside);
  const w = f.userData.width, h = y1 - y0;
  f.position.y = y0;
  casing(f, M, w, h, -t / 2, -1);
  casing(f, M, w, h, t / 2, 1);
  // sill, through the wall and out both sides — in two, so the part out of doors is lit as out of doors (build.js
  // splitOutdoor); its top 4 mm over the opening's foot (flush with it, the two flickered as you moved — user, 2026-10-28)
  f.add(boxMM(-0.08, w + 0.08, -0.031, 0.004, -t / 2, t / 2 + 0.04, M.trim));
  f.add(boxMM(-0.08, w + 0.08, -0.031, 0.004, -t / 2 - 0.08, -t / 2, M.trim));
  const sw = 0.045, z0 = -0.02, z1 = 0.015;
  f.add(boxMM(0, sw, 0, h, z0, z1, M.trim));
  f.add(boxMM(w - sw, w, 0, h, z0, z1, M.trim));
  f.add(boxMM(0, w, h - sw, h, z0, z1, M.trim));
  f.add(boxMM(0, w, 0, sw, z0, z1, M.trim));
  f.add(boxMM(0, w, h / 2 - 0.022, h / 2 + 0.022, z0, z1, M.trim));
  const pane = M.pane(w, h);
  pane.position.set(w / 2, h / 2, 0);
  f.add(pane);
  return f;
}

/**
 * Glass as you see it (user, 2026-10-15: the kitchen's and living room's windows and the back door's
 * glass like the bedroom's, room.js): what is on it (`T.windowDirtTex`, its own alpha, unlit) and, added
 * on top, what it gives back (black, glossy, additive: the reflection alone). Both faces, so it is glass
 * from the yard too. `w` × `h`, facing ±z.
 */
function glassPane(w, h, env, seed, inside = false, lay = undefined, shape = null) {
  const g = new THREE.Group(), geo = shape ?? new THREE.PlaneGeometry(w, h); // (`shape`: a pane not quite whole, its picture laid as on a w × h one)
  // (a window's dust is lit from behind by the day, so it is drawn unlit; glass indoors — a clock's door —
  // has its dust lit by the room, and less of it: unlit, it hung there like frosted glass, glowing. `lay`: how
  // the dust lies, windowDirtTex's — one pane or two, how thick the film)
  const dust = T.windowDirtTex(w, h, seed, lay);
  const dirt = new THREE.Mesh(geo, inside
    ? new THREE.MeshStandardMaterial({ map: dust, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, opacity: 0.45 })
    : new THREE.MeshBasicMaterial({ map: dust, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const sheen = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, envMap: env, envMapIntensity: 4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  sheen.position.z = 0.0008;
  for (const m of [dirt, sheen]) {
    m.castShadow = false;
    m.receiveShadow = inside; // (glass indoors, lit by the room: without, the sun lit its dust through the walls — the photograph's, glowing in the dark corridor; user, 2026-10-28)
    g.add(m);
  }
  return g;
}

/**
 * The kitchen's calendar, October 2003 (textures.js calendarTex), on the wall at `x` facing west, its nail at
 * `y`, `z`: open — the picture above, the month below the spiral — hung by the hole in its top, not quite
 * straight; the paper bowed off the wall a little, the month's foot curling away from it, its right corner most
 * (thumbed: it is the one that gets lifted to look at next month); the months gone folded back behind.
 */
function calendar(g, x, y, z) {
  const { picture, month } = T.calendarTex();
  const cal = new THREE.Group();
  cal.position.set(x, y, z);
  cal.rotation.set(0, -Math.PI / 2, deg(-1.8)); // (its front faces into the kitchen; askew on its nail)
  g.add(cal);
  const PW = 0.3, TOP = 0.011, SPIRAL = TOP - PW - 0.006;
  const page = (map, y0, shape) => {
    const geo = new THREE.PlaneGeometry(PW, PW, 10, 10), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const u = P.getX(i) / PW + 0.5, v = 0.5 - P.getY(i) / PW; // v: 0 at the page's top edge, 1 at its foot
      P.setXYZ(i, P.getX(i), y0 - v * PW, shape(u, v));
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, std({ map, roughness: 0.82, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    cal.add(m);
    return m;
  };
  // the picture: held at the nail and at the spiral, bowed out between
  page(picture, TOP, (u, v) => 0.0045 + 0.004 * Math.sin(v * Math.PI) * (0.7 + 0.3 * Math.sin(u * Math.PI)));
  // the month, from the spiral: lying flat at first, its foot lifting off the wall, the right-hand corner most
  page(month, SPIRAL - 0.004, (u, v) => 0.006 + 0.016 * v ** 3 + 0.014 * (u ** 4) * (v ** 5) - 0.002 * u * (1 - u) * v);
  const sheets = std({ color: 0xcfc8b8, roughness: 0.9 }); // the months gone, folded back over; and the ones to come
  for (const [y0, y1, z0, z1] of [[SPIRAL + 0.004, TOP - 0.004, 0.0005, 0.0035], [SPIRAL - PW, SPIRAL - 0.002, 0.0005, 0.005]]) cal.add(boxMM(-PW / 2 + 0.002, PW / 2 - 0.002, y0, y1, z0, z1, sheets));
  // the spiral: a coil of wire along the binding
  const turns = 34, coil = new THREE.Curve();
  coil.getPoint = (t, out = new THREE.Vector3()) => out.set((t - 0.5) * (PW - 0.012), SPIRAL + 0.0045 * Math.cos(t * turns * Math.PI * 2), 0.0055 + 0.0045 * Math.sin(t * turns * Math.PI * 2));
  const wire = new THREE.Mesh(new THREE.TubeGeometry(coil, turns * 14, 0.0007, 5), std({ color: 0x8e8d88, metalness: 0.7, roughness: 0.45 }));
  wire.receiveShadow = true;
  cal.add(wire);
  // the nail, its head a little out from the paper
  const iron = std({ color: 0x4a4640, metalness: 0.6, roughness: 0.5 });
  for (const nail of [cyl(0.0032, 0.0032, 0.0015, iron, 0, 0, 0.0115, 12), cyl(0.0012, 0.0012, 0.008, iron, 0, 0, 0.007, 8)]) {
    nail.rotation.x = Math.PI / 2;
    cal.add(nail);
  }
}

/**
 * How the corridor is lit by what it has no lamp of its own for (user, 2026-10-19: "a sharp cut between the
 * living room and the corridor"; "the far end a little darker"). It has no window: its light comes in at its
 * open end from the living room and the kitchen, and through the doors along it. The house's fill (hemisphere,
 * environment, the ceiling's base) was the same all down its 11 m, while the living room has lamps and windows
 * — so it went from bright to dim in a line where the two meet. Here the fill in the corridor is brighter at its
 * open end, falls away over the first metre or two, then slowly on to the end, which has a little more than half.
 * A patch on every material
 * with a mesh in the corridor: by where the pixel is, so shared ones are unchanged anywhere else.
 */
function corridorFill(root) {
  const box = new THREE.Box3(), done = new Set();
  // (`centroid`: the point taken on the surface itself — at its edge, a wall or the rail's top seen side-on was worked
  // out past its end, out past the box, and lit up at full strength: a line of light down the far corners and along
  // the rail at the end, as you moved — user, 2026-11-03)
  const glsl = `
centroid varying vec3 vCorridor;
vec3 corridorFill( vec3 p ) {
  if ( p.x < ${C.x0.toFixed(3)} || p.x > ${(C.x1 + 0.3).toFixed(3)} || p.z < ${(D - 0.005).toFixed(3)} || p.z > ${(C.z1 + t - 0.002).toFixed(3)} ) return vec3( 1.0 ); // (the doorways along it too, their carpet with it)
  float d = p.x - ${C.x0.toFixed(3)};
  float f = 0.6 + 0.4 * exp( -d / 5.0 ) + 0.8 * exp( -d / 1.3 ) - 0.22 * smoothstep( 6.0, 10.0, d ); // (its last few metres darker again: 'a little darker' three times — user, 2026-10-19/20)
  return vec3( f );
}
`;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    box.makeEmpty().expandByObject(o, false);
    if (box.max.x < C.x0 || box.min.x > C.x1 + 0.3 || box.max.z < D - 0.005 || box.min.z > C.z1 + t) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (done.has(m) || !(m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) continue;
      done.add(m);
      const before = m.onBeforeCompile, key = m.customProgramCacheKey.bind(m);
      m.onBeforeCompile = (sh, r) => {
        before.call(m, sh, r);
        sh.vertexShader = 'centroid varying vec3 vCorridor;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  vec4 cfW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    cfW = instanceMatrix * cfW;
  #endif
  vCorridor = ( modelMatrix * cfW ).xyz;`);
        sh.fragmentShader = glsl + sh.fragmentShader.replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
  {
    vec3 cf = corridorFill( vCorridor );
    #if defined( RE_IndirectDiffuse )
      irradiance *= cf;
      iblIrradiance *= cf;
    #endif
    #if defined( RE_IndirectSpecular )
      radiance *= cf;
    #endif
  }`);
      };
      m.customProgramCacheKey = () => key() + '|corridor';
      m.needsUpdate = true;
    }
  });
  return done.size;
}

/**
 * A ceiling out here (textures.js ceilingTex): old white emulsion, matte, a touch cool against the warm light
 * so it reads white. Its glow (emissive) is the light the floor and the walls throw back up at it, which the
 * hemisphere's brown 'ground' couldn't give it: under it, it had read dark brown. `power`: how strong; `base`:
 * light it has even with every lamp off (the corridor's, whose lamp is dark most of the time: as bright as its
 * walls then, and greyer, where it had been half as bright and brown).
 */
function ceilingMat(spec, power, base = 0) {
  const { map, glow } = T.ceilingTex(spec);
  const m = std({ map, color: CEILING, roughness: 1, emissive: BOUNCE, emissiveMap: glow, emissiveIntensity: power });
  if (base) { // a little light that is always there, whatever the lamps do (`lightMap`: lit like the paint, its marks too), warm: off the walls
    m.lightMap = new THREE.DataTexture(new Uint8Array([255, 222, 184, 255]), 1, 1);
    m.lightMap.needsUpdate = true;
    m.lightMapIntensity = base;
  }
  m.userData.period = 1; // (world UVs: the texture's repeat and offset put the picture where it belongs)
  return m;
}

/** The dome light the bedroom has, switched off. */
function ceilingLamp(g, M, x, z, on = false) {
  const shade = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xe2dacb, roughness: 0.55, emissive: on ? 0xffe2b4 : 0x000000, emissiveIntensity: on ? 1.2 : 0 })
  );
  shade.scale.y = 0.5;
  shade.receiveShadow = true; // (without, the bathroom's lamps and the bedroom's spill lit it through the walls: a white gleam on one side, a yellow on the other — user, 2026-10-19)
  shade.position.set(x, H, z);
  g.add(shade);
  g.add(cyl(0.19, 0.19, 0.012, M.brass, x, H - 0.006, z));
  return shade;
}

/**
 * A photograph in an old brass frame on a wall facing +z: `w` × `h` the print, `at` its middle on the wall, `tilt`
 * how crooked it hangs. The frame a moulding of a flat band with a bead round the opening and a step to the wall,
 * brass gone brown with tarnish, darker in the corners, rubbed bright on the high places (T.antiqueBrassTex); a
 * dark card behind the print; the print matte.
 */
function brassPortrait(g, M, tex, w, h, at, tilt) {
  const pic = new THREE.Group();
  pic.position.set(...at);
  pic.rotation.z = tilt;
  g.add(pic);
  const B = 0.032, DEPTH = 0.02, ow = w / 2 + B, oh = h / 2 + B;
  // (one picture over the whole frame, laid on it from the front — not one on every piece: its worn places are each
  // where they are, not the same on every side)
  const brass = std({ map: T.wornBrassTex(2 * ow, 2 * oh), roughnessMap: T.wornBrassTex(2 * ow, 2 * oh, true), metalness: 0.8, roughness: 1, envMap: M.env, envMapIntensity: 1.3 }); // (its own reflection: at the house's 0.26 brass reads black)
  // the band: long sides full width, the short ones between them
  for (const [x0, x1, y0, y1] of [[-ow, ow, oh - B, oh], [-ow, ow, -oh, -oh + B], [-ow, -ow + B, -oh + B, oh - B], [ow - B, ow, -oh + B, oh - B]]) {
    pic.add(soft(x0, x1, y0, y1, 0.004, DEPTH - 0.004, 0.003, brass)); // the band
    pic.add(soft(x0, x1, y0, y1, 0, 0.006, 0.002, brass)); // the step to the wall
  }
  // the bead round the opening, standing proud of the band
  const bead = (len) => new THREE.CylinderGeometry(0.0045, 0.0045, len, 10);
  for (const [x, y, len, rot] of [[0, h / 2 + 0.003, w + 0.012, Math.PI / 2], [0, -h / 2 - 0.003, w + 0.012, Math.PI / 2], [-w / 2 - 0.003, 0, h + 0.012, 0], [w / 2 + 0.003, 0, h + 0.012, 0]]) {
    const m = new THREE.Mesh(bead(len), brass);
    m.rotation.z = rot;
    m.position.set(x, y, DEPTH - 0.004);
    m.castShadow = m.receiveShadow = true;
    pic.add(m);
  }
  const p = new THREE.Vector3();
  for (const m of pic.children) {
    if (m.material !== brass) continue;
    m.updateMatrix();
    const P = m.geometry.attributes.position, U = m.geometry.attributes.uv;
    for (let i = 0; i < P.count; i++) { p.fromBufferAttribute(P, i).applyMatrix4(m.matrix); U.setXY(i, (p.x + ow) / (2 * ow), (p.y + oh) / (2 * oh)); }
  }
  pic.add(boxMM(-w / 2 - 0.004, w / 2 + 0.004, -h / 2 - 0.004, h / 2 + 0.004, 0.002, 0.005, std({ color: 0x2a241c, roughness: 0.95 }))); // the card behind (1.5 mm behind the print: half a millimetre flickered)
  const print = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: tex, color: 0xf2eee6, roughness: 0.9, envMap: M.env, envMapIntensity: 0.12 }));
  print.position.z = 0.0065;
  print.receiveShadow = true;
  pic.add(print);
  // over it a glass (user, 2026-10-24), 3 mm off the print, its edges under the bead; a bit gone from its top edge
  // towards the right — chipped off, the break ragged, its edge catching the light
  const gw = w + 0.004, gh = h + 0.004, top = gh / 2;
  const chip = [[0.026, 0], [0.031, -0.004], [0.037, -0.011], [0.046, -0.016], [0.055, -0.019], [0.061, -0.015], [0.066, -0.016], [0.072, -0.009], [0.078, -0.006], [0.083, 0]];
  const outline = new THREE.Shape();
  outline.moveTo(-gw / 2, -gh / 2);
  outline.lineTo(gw / 2, -gh / 2);
  outline.lineTo(gw / 2, top);
  for (let i = chip.length - 1; i >= 0; i--) outline.lineTo(chip[i][0], top + chip[i][1]);
  outline.lineTo(-gw / 2, top);
  const paneGeo = new THREE.ShapeGeometry(outline), PU = paneGeo.attributes.uv, PP = paneGeo.attributes.position;
  for (let i = 0; i < PP.count; i++) PU.setXY(i, PP.getX(i) / gw + 0.5, PP.getY(i) / gh + 0.5);
  const glass = M.pane(gw, gh, true, { halves: 1, veil: 0.025, rain: false, worn: 2 }, paneGeo); // (a faint film of dust, no rain: the print plain through it; gone cloudy in from its edges — user, 2026-10-28)
  // (and a window's shine was too much for it: in the dim corridor the reflected daylight laid a blue haze over the print)
  const [dust, sheen] = glass.children;
  dust.material.opacity = 0.5; // (at 0.3 the cloudy edges were all but lost on the dark print, however thick they were drawn)
  sheen.material.envMapIntensity = 0.9;
  glass.position.z = 0.0095;
  pic.add(glass);
  const breakLine = new THREE.CatmullRomCurve3(chip.map(([x, y]) => new THREE.Vector3(x, top + y, 0.0095)), false, 'centripetal', 0.2);
  // (it catches only what light there is: unshadowed, the sun lit it through the walls, and a strong reflection of
  // the house's daylit window lit it in the dark too — a white line glowing in the black corridor; user, 2026-10-28)
  const broken = new THREE.Mesh(new THREE.TubeGeometry(breakLine, 40, 0.0006, 4), std({ color: 0xc9d6c8, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.55, envMap: M.env, envMapIntensity: 0.4 }));
  broken.castShadow = false;
  broken.receiveShadow = true;
  pic.add(broken);
  return pic;
}

/**
 * A photograph as an old print: the picture from `url`, faded — its blacks gone grey-brown, a little yellowed,
 * a few foxing spots, the corners rubbed (in the dark half of the corridor, as it was, it read as a black card).
 */
function oldPhotoTex(url) {
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'), w = (c.width = img.naturalWidth), h = (c.height = img.naturalHeight), x = c.getContext('2d'), r = mulberry32(1909);
    x.drawImage(img, 0, 0);
    x.fillStyle = 'rgba(206,190,160,0.24)'; // faded
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { // foxing
      const px = r() * w, py = r() * h, rad = 1 + r() * 4, gr = x.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, `rgba(140,100,60,${0.2 + r() * 0.3})`); gr.addColorStop(1, 'rgba(140,100,60,0)');
      x.fillStyle = gr; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) { // the corners, rubbed pale
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, w * 0.12);
      gr.addColorStop(0, 'rgba(228,216,190,0.35)'); gr.addColorStop(1, 'rgba(228,216,190,0)');
      x.fillStyle = gr; x.fillRect(cx - w * 0.12, cy - w * 0.12, w * 0.24, w * 0.24);
    }
    tex.image = c;
    tex.needsUpdate = true;
  };
  img.src = url;
  return tex;
}

/**
 * Blood that was washed off, for the UV torch (`glowMaterial`'s mask): the photograph at `url` — blood on a pale
 * ground — as alpha, by how dark the blood lies on it (thick pools full, the brush's thin streaks faint), and only
 * where it is red or near black (the ground's grey and specks of dust: nothing). The photo's white glints on the wet pools are
 * filled in from the blood round them.
 */
function bloodTraceTex(url) {
  const tex = new THREE.Texture();
  tex.anisotropy = 8;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'), w = (c.width = img.naturalWidth), h = (c.height = img.naturalHeight), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const im = x.getImageData(0, 0, w, h), d = im.data;
    // the ground's own shade, uneven (darker to the bottom corners): a smooth surface fitted to its grey pixels
    const N = Array.from({ length: 6 }, () => new Array(7).fill(0)), cf = [];
    for (let j = 0; j < h; j += 5) for (let i = 0; i < w; i += 5) {
      const k = (j * w + i) * 4, u = i / w, v = j / h, b = [1, u, v, u * u, v * v, u * v];
      if (d[k + 1] < 200 || Math.abs(d[k] - d[k + 1]) > 6) continue;
      for (let p = 0; p < 6; p++) { for (let q = 0; q < 6; q++) N[p][q] += b[p] * b[q]; N[p][6] += b[p] * d[k + 1]; }
    }
    for (let p = 0; p < 6; p++) for (let r = p + 1; r < 6; r++) { const f = N[r][p] / N[p][p]; for (let q = p; q < 7; q++) N[r][q] -= f * N[p][q]; }
    for (let p = 5; p >= 0; p--) { let s = N[p][6]; for (let q = p + 1; q < 6; q++) s -= N[p][q] * cf[q]; cf[p] = s / N[p][p]; }
    // the blood: darker than the ground and red
    const a = new Float32Array(w * h), grey = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const p = j * w + i, k = p * 4, R = d[k], G = d[k + 1], u = i / w, v = j / h;
      const bg = cf[0] + cf[1] * u + cf[2] * v + cf[3] * u * u + cf[4] * v * v + cf[5] * u * v;
      const red = Math.min(1, Math.max(0, (R - G - 3) / 15, (90 - R - G) / 40)); // (or near black: the thickest of it)
      a[p] = red * red * (3 - 2 * red) * Math.min(1, Math.max(0, (bg - G - 8) / (bg - 12))) ** 0.8;
      grey[p] = G < bg - 25 && R - G < 18 ? 1 : 0;
    }
    // the glints: grey in the middle of blood (or anything deep inside a pool)
    const W1 = w + 1, S = new Float64Array(W1 * (h + 1)), RAD = 10;
    for (let j = 0; j < h; j++) for (let i = 0, row = 0; i < w; i++) { row += a[j * w + i]; S[(j + 1) * W1 + i + 1] = S[j * W1 + i + 1] + row; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const p = j * w + i, i0 = Math.max(0, i - RAD), i1 = Math.min(w, i + RAD + 1), j0 = Math.max(0, j - RAD), j1 = Math.min(h, j + RAD + 1);
      const mean = (S[j1 * W1 + i1] - S[j0 * W1 + i1] - S[j1 * W1 + i0] + S[j0 * W1 + i0]) / ((i1 - i0) * (j1 - j0));
      const v = (grey[p] && mean > 0.5) || mean > 0.8 ? Math.max(a[p], mean) : a[p];
      d[p * 4] = d[p * 4 + 1] = d[p * 4 + 2] = 255;
      d[p * 4 + 3] = Math.round(255 * 0.5 * v); // (at full strength the pools burned white close up, the brush's streaks lost in them)
    }
    x.putImageData(im, 0, 0);
    tex.image = c;
    tex.needsUpdate = true;
  };
  img.src = url;
  return tex;
}

/** A framed picture on a wall. `at`: its middle; `turn`: which way it faces (0: +z). */
function frame(g, tex, w, h, at, turn, M) {
  const pic = new THREE.Group();
  pic.position.set(...at);
  pic.rotation.y = turn;
  pic.add(boxMM(-w / 2 - 0.03, w / 2 + 0.03, -h / 2 - 0.03, h / 2 + 0.03, 0, 0.022, M.woodCabinet ?? M.trim));
  const print = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: tex, roughness: 0.4 }));
  print.position.z = 0.0235;
  pic.add(print);
  g.add(pic);
  return pic;
}

/**
 * A board of old wood, x0…x1 by y0…y1 by z0…z1: its edges worn round, the grain of `oldTimberTex` along its
 * length, from its own part of the wood (`seed`). In whatever frame it is added to.
 */
function oldBoard(x0, x1, y0, y1, z0, z1, mat, seed) {
  const size = [x1 - x0, y1 - y0, z1 - z0], long = size.indexOf(Math.max(...size));
  const geo = new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(0.005, Math.min(...size) * 0.3));
  const r = mulberry32(seed * 13 + 5), ou = r(), ov = r() * 7, P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, p = [0, 0, 0], n = [0, 0, 0];
  for (let i = 0; i < P.count; i++) {
    p[0] = P.getX(i); p[1] = P.getY(i); p[2] = P.getZ(i);
    n[0] = Math.abs(N.getX(i)); n[1] = Math.abs(N.getY(i)); n[2] = Math.abs(N.getZ(i));
    const face = n.indexOf(Math.max(...n)), along = face === long ? (long + 1) % 3 : long, across = 3 - face - along;
    U.setXY(i, p[across] / 0.5 + ou, p[along] + ov);
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/**
 * At the corridor's far end, in its ceiling, the way up into the attic (user, 2026-10-19): an old wooden
 * lid lying over the hole in a frame of the same old boards, pushed a little aside so there is a slit of black
 * along one edge; an old wooden ladder, heavy, leant up into that slit from the middle of the corridor; and
 * the lamp by it, the only one on, that goes off and on by fits as if something were wrong with it.
 */
function atticHatch(g, M, ctx, A, ceiling) {
  const old = std({ map: T.oldTimberTex(), bumpMap: T.oldTimberTex(true), bumpScale: 1.4, color: 0xc2b29a, roughness: 0.92 });
  const dark = std({ map: T.oldTimberTex(), color: 0x8a7a64, roughness: 0.95 });
  // (the ladder's: knocked about for years, scratched and gouged all over — user, 2026-10-19)
  const worn = std({ map: T.oldTimberTex(false, true), bumpMap: T.oldTimberTex(true, true), bumpScale: 1.8, color: 0xc2b29a, roughness: 0.9 });
  const rubbed = std({ map: T.oldTimberTex(false, true), color: 0xe0d4be, roughness: 0.75 });
  let seed = 1;
  // the lamp (user, 2026-10-19): dark most of the time; then it tries to come on — the supply failing, it
  // stutters up through dim and bright and sags, buzzing between, the filament never snapping on or off but
  // swelling and dying (it has a little heat in it); now and then it holds on for a second or two, then dies
  const shade = ceilingLamp(g, M, A.x0 - 0.6, (A.z0 + A.z1) / 2, true), ON = 0.9;
  const glow = new THREE.PointLight(0xffd9ad, 0, 2.8, 2); // (unshadowed: nothing but the corridor within its reach)
  glow.position.set(A.x0 - 0.6, H - 0.12, (A.z0 + A.z1) / 2);
  g.add(glow);
  const fr = mulberry32(4242);
  // when: dark, then a fit, and each fit unlike the one before (user, 2026-10-19: "the flickers are different from
  // one another"): a fast stutter, a few slow tries that never quite catch, one or two hard blinks, a buzzing
  // half-light, a surge that dies away; sometimes after it it holds on a second or two. Steps: [level, how long,
  // how slowly the glow follows (0: the filament's own), how hard the current wavers]
  const fits = {
    stutter() {
      const s = [], rate = 0.5 + fr(); // (user, 2026-10-19: "more violent and faster")
      for (let n = 0, len = 0.4 + fr() * 1.8; n < len; ) {
        const d = (0.015 + fr() * (fr() < 0.12 ? 0.25 : 0.06)) * rate;
        s.push([s.length % 2 ? fr() * 0.06 : fr() < 0.15 ? 1.35 : 0.6 + fr() * 0.4, d]); // (now and then a surge, brighter than it should be)
        n += d;
      }
      return s;
    },
    tries() { const s = []; for (let k = 0, n = 2 + Math.floor(fr() * 3); k < n; k++) s.push([0.2 + fr() * 0.35, 0.12 + fr() * 0.25, 0.09], [0, 0.15 + fr() * 0.4]); return s; },
    blinks() { const s = []; for (let k = 0, n = 1 + Math.floor(fr() * 2); k < n; k++) s.push([1 + fr() * 0.3, 0.05 + fr() * 0.08], [0, 0.08 + fr() * 0.3]); return s; },
    buzz() { return [[0.45 + fr() * 0.25, 0.8 + fr() * 1.7, 0.03, 0.35], [0, 0.06], [0.5, 0.05], [0, 0.1], [0.3, 0.04]]; },
    surge() { return [[1.4, 0.08], [0.8, 0.25, 0.2], [0.3, 0.35, 0.25], [0, 0.4, 0.3]]; },
  };
  let wait = 2 + fr() * 3, steps = [], step = null, left = 0, last = '', want = 0, tau = 0, waver = 0, level = 0;
  ctx.animated.push((time, dt) => {
    if (step || steps.length) {
      if ((left -= dt) <= 0) {
        step = steps.shift();
        if (step) [want, left, tau = 0, waver = 0] = step;
        else { want = 0; tau = 0; waver = 0; wait = 1 + fr() * 4.5; } // dark again, half as long as it was (user, 2026-10-19)
      }
    } else if ((wait -= dt) <= 0) {
      const kinds = Object.keys(fits).filter((k) => k !== last);
      last = kinds[Math.floor(fr() * kinds.length)];
      steps = fits[last]();
      if (fr() < 0.25) steps.push([1, 0.6 + fr() * 1.8]); // and holds a while
      left = 0;
    }
    // how: the filament's glow follows, fast up and only a little slower down; while lit the current wavers hard
    level += (want - level) * (1 - Math.exp(-dt / (tau || (want > level ? 0.014 : 0.03))));
    const sag = want > 0.2 ? 0.78 + (0.14 + waver) * Math.sin(time * 97) * Math.sin(time * 41.3) + 0.08 * Math.sin(time * 13.1) : 1; // (a failing supply: never steady)
    const lit = Math.max(0, level * sag);
    glow.intensity = ON * lit;
    shade.material.emissiveIntensity = 1.2 * lit + 0.03 * Math.min(1, level * 8); // (the filament's last red as it dies)
    ceiling.emissiveIntensity = HALL_GLOW * lit; // (its light thrown back up at the ceiling: it comes and goes with it)
  });
  // what is above: dark (just under the roof's own boards)
  g.add(Object.assign(flat(A.x0, A.x1, A.z0, A.z1, H + 0.0195, new THREE.MeshBasicMaterial({ color: 0x050403, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), false), { castShadow: false })); // (half a millimetre under the roof's underside: drawn in front of it, or the two flickered)
  // the frame round the hole, a little below the ceiling
  const F2 = 0.07;
  g.add(oldBoard(A.x0 - F2, A.x1 + F2, H - 0.018, H, A.z0 - F2, A.z0, old, seed++));
  g.add(oldBoard(A.x0 - F2, A.x1 + F2, H - 0.018, H, A.z1, A.z1 + F2, old, seed++));
  g.add(oldBoard(A.x0 - F2, A.x0, H - 0.018, H, A.z0, A.z1, old, seed++));
  g.add(oldBoard(A.x1, A.x1 + F2, H - 0.018, H, A.z0, A.z1, old, seed++));
  // the lid: three boards, lying over the hole on the ceiling above, pushed 16 cm aside to the west — a slit of
  // black along the east edge, where the ladder goes in — and turned a little, not square to the hole
  const lid = new THREE.Group();
  lid.position.set((A.x0 + A.x1) / 2 - 0.16, H + 0.001, (A.z0 + A.z1) / 2);
  lid.rotation.y = deg(2.5);
  g.add(lid);
  const LL = A.x1 - A.x0 + 0.1, LW = A.z1 - A.z0 + 0.1, bw = LW / 3;
  for (let k = 0; k < 3; k++) lid.add(oldBoard(-LL / 2, LL / 2 - (k === 1 ? 0.03 : 0), 0, 0.018, -LW / 2 + bw * k + 0.002, -LW / 2 + bw * (k + 1) - 0.002, k === 1 ? dark : old, seed++));
  // the ladder: old and heavy, two thick stringers and round rungs through them every 30 cm, every one there
  // (user, 2026-10-19: "a rung is missing" — it had been left out), the third split; rubbed pale in the middle
  // by feet; its feet where they were, leant up across the corridor to the far side of the hole and into the slit
  const footX = A.x0 - 0.02 - H * Math.tan(deg(16)), zc = (A.z0 + A.z1) / 2, topX = A.x1 - 0.1, topY = H - 0.035; // (its top end just under the lid, in the slit: clear of the lid and the frame by a centimetre or two)
  const LEAN = Math.atan2(topX - footX, topY - 0.006), LEN = Math.hypot(topX - footX, topY - 0.006);
  const lad = new THREE.Group();
  lad.position.set(footX, 0.006, zc);
  lad.rotation.z = -LEAN; // (its y up the ladder, towards +x)
  g.add(lad);
  const SD = 0.13, ST = 0.075, HW = 0.215; // a stringer's depth and thickness (heavy, old timber); half the ladder's width, between its stringers
  // (chunks broken out of their edges, and the rungs', really gone — user, 2026-10-20: `chippedTimber`, `chippedRung`;
  // the wood inside them browner, by vertex colour: these materials take it, these meshes are kept out of the bake)
  const tinted = (m) => Object.assign(m.clone(), { vertexColors: true });
  const wornC = tinted(worn), rubbedC = tinted(rubbed), darkC = tinted(dark);
  for (const z of [-HW, HW]) lad.add(chippedTimber(-SD / 2, SD / 2, 0, LEN, z - ST / 2 * Math.sign(z) - ST / 2, z - ST / 2 * Math.sign(z) + ST / 2, wornC, seed++, 18, 0.26));
  for (const z of [-HW, HW]) lad.add(oldBoard(-SD / 2 - 0.001, SD / 2 + 0.001, 0, 0.22, z - ST / 2 * Math.sign(z) - ST / 2 - 0.001, z - ST / 2 * Math.sign(z) + ST / 2 + 0.001, dark, seed++)); // (its feet dark with wet)
  const cr = mulberry32(5150);
  for (let k = 1; k * 0.3 < LEN - 0.12; k++) {
    const y = k * 0.3;
    const rung = new THREE.Group(); // (through the stringers, its ends showing; its middle third rubbed pale)
    const third = (2 * HW + 0.02) / 3;
    for (const [z, m, ends] of [[-third, k === 3 ? darkC : wornC, -1], [0, rubbedC, 0], [third, k === 3 ? darkC : wornC, 1]]) {
      const piece = chippedRung(third, m, cr, ends);
      piece.position.z = z;
      piece.castShadow = piece.receiveShadow = true;
      rung.add(piece);
    }
    rung.position.set(0, y, 0);
    if (k === 3) rung.rotation.x = deg(3); // (split, sagging a little)
    lad.add(rung);
  }
  // in your way, and Luna's: the ladder and the end of the corridor behind it, which there is no getting to
  // past it (a pocket of free floor nobody could reach: she would set off for it and walk into the wall)
  ctx.colliders.push({ type: 'box', x0: footX - 0.07, x1: C.x1, z0: C.z0, z1: C.z1, top: 2.2 });
  return glow;
}

/**
 * A long timber along y (its section x0…x1 by z0…z1), the corners worn round, with `n` chunks broken out of its
 * four long edges above `from` (user, 2026-10-20: "edges gouged — really missing"): each a piece gone from one
 * edge, cut back flat and rough where it broke, ragged at its ends; inside, the grey weathered face gone, the wood
 * browner (vertex colour — `mat` takes it). Rings close together only where there are chips. The grain of
 * oldTimberTex along it, as oldBoard lays it.
 */
function chippedTimber(x0, x1, y0, y1, z0, z1, mat, seed, n, from = 0) {
  const r = mulberry32(seed * 31 + 7), R = 0.005, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ou = r(), ov = r() * 7;
  const corners = [[x1, z1], [x0, z1], [x0, z0], [x1, z0]];
  // the section: round the rectangle, its points close together near the corners (where the chips are)
  const sec = [], near = [0, 0.002, 0.004, 0.007, 0.01, 0.014, 0.019, 0.025, 0.032];
  for (let c = 0; c < 4; c++) {
    const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4], L = Math.hypot(bx - ax, bz - az), ts = [...near];
    for (let t = 0.05; t < L - 0.05; t += 0.025) ts.push(t);
    for (const t of near.slice().reverse()) if (t > 0) ts.push(L - t);
    for (const t of ts.filter((v, i, a) => v < L && (i === 0 || v > a[i - 1] + 1e-4))) {
      let px = ax + ((bx - ax) * t) / L, pz = az + ((bz - az) * t) / L;
      for (const [qx, qz] of corners) { // into the corner's quarter round
        const sx = Math.sign(qx - cx), sz = Math.sign(qz - cz), ix = qx - sx * R, iz = qz - sz * R;
        if ((px - ix) * sx > 0 && (pz - iz) * sz > 0) { const l = Math.hypot(px - ix, pz - iz); px = ix + ((px - ix) / l) * R; pz = iz + ((pz - iz) / l) * R; }
      }
      sec.push([px, pz]);
    }
  }
  const arc = [0];
  for (let j = 1; j <= sec.length; j++) arc.push(arc[j - 1] + Math.hypot(sec[j % sec.length][0] - sec[j - 1][0], sec[j % sec.length][1] - sec[j - 1][1]));
  // the chips: which edge, where along, how long, how deep
  const chips = [];
  for (let i = 0; i < n; i++) {
    const len = 0.025 + r() ** 1.3 * 0.1, at = from + r() * (y1 - from - len - 0.05);
    chips.push({ c: Math.floor(r() * 4), a: at, b: at + len, deep: Math.min(0.009 + r() * 0.018, 0.4 * Math.min(x1 - x0, z1 - z0)), ph: r() * 9 });
  }
  const rings = new Set();
  for (let y = y0; y < y1; y += 0.08) rings.add(+y.toFixed(4));
  rings.add(y1);
  for (const ch of chips) for (let y = ch.a - 0.004; y <= ch.b + 0.004; y += 0.005) rings.add(+y.toFixed(4));
  const ys = [...rings].filter((y) => y >= y0 && y <= y1).sort((p, q) => p - q);
  const pos = [], col = [], uv = [], idx = [], N = sec.length;
  for (const y of ys) {
    for (let j = 0; j < N; j++) {
      let [px, pz] = sec[j], hurt = 0;
      for (const ch of chips) {
        if (y <= ch.a || y >= ch.b) continue;
        const u = (y - ch.a) / (ch.b - ch.a), [qx, qz] = corners[ch.c], bx = Math.sign(qx - cx) / Math.SQRT2, bz = Math.sign(qz - cz) / Math.SQRT2;
        const cut = ch.deep * (1 - Math.abs(2 * u - 1) ** 2.5) * (0.82 + 0.18 * Math.sin(u * 17 + ch.ph)) + 0.0012 * Math.sin(y * 310 + px * 470 + pz * 530); // (broken, not sawn: rough)
        const over = (px - qx) * bx + (pz - qz) * bz + cut;
        if (over > 0) { px -= over * bx; pz -= over * bz; hurt = Math.max(hurt, Math.min(1, over / 0.002)); }
      }
      pos.push(px, y, pz);
      col.push(1 + 0.3 * hurt, 1 + 0.08 * hurt, 1 - 0.12 * hurt); // (paler, browner, where the grey face has gone)
      uv.push(arc[j] / 0.5 + ou, y + ov);
    }
  }
  for (let i = 0; i < ys.length - 1; i++) for (let j = 0; j < N; j++) { const a = i * N + j, b = i * N + ((j + 1) % N), c = a + N, d = b + N; idx.push(a, c, b, b, c, d); }
  // its two ends
  for (const [y, k] of [[y0, 0], [y1, ys.length - 1]]) {
    const ci = pos.length / 3;
    pos.push(cx, y, cz); col.push(1, 1, 1); uv.push(ou, y + ov);
    for (let j = 0; j < N; j++) { const a = k * N + j, b = k * N + ((j + 1) % N); idx.push(...(k ? [ci, b, a] : [ci, a, b])); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  // (which way round the section goes decides which way the faces look: outwards, checked on the first one)
  const P = geo.attributes.position, v = (i) => new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
  const nrm = v(N).sub(v(0)).cross(v(1).sub(v(0)));
  if (nrm.dot(v(0).sub(new THREE.Vector3(cx, v(0).y, cz))) < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  m.userData.live = true; // (out of the bake: it drops vertex colours)
  return m;
}

/**
 * A third of a round rung, `len` long across the ladder (along z), with a chip or two broken off it — a flat where
 * a piece split away, rough, the wood browner in it (vertex colour); `ends`: which end runs into a stringer
 * (−1, 1; 0: the middle third), kept clear. `r`: the random it draws from.
 */
function chippedRung(len, mat, r, ends) {
  const RAD = 0.027, geo = new THREE.CylinderGeometry(RAD, RAD, len, 28, Math.ceil(len / 0.005), false);
  const P = geo.attributes.position, col = [];
  const chips = [];
  for (let i = 0, n = r() < 0.25 ? 0 : 1 + Math.floor(r() * 2); i < n; i++) {
    const l = 0.02 + r() * 0.045, lo = -len / 2 + 0.01 + (ends < 0 ? 0.075 : 0), hi = len / 2 - 0.01 - (ends > 0 ? 0.075 : 0) - l; // (not inside the stringers)
    if (hi <= lo) continue;
    const a = lo + r() * (hi - lo), t = r() * Math.PI * 2;
    chips.push({ a, b: a + l, nx: Math.cos(t), nz: Math.sin(t), deep: 0.006 + r() * 0.01, ph: r() * 9 });
  }
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i), hurt = 0;
    if (Math.hypot(x, z) > RAD * 0.99) for (const ch of chips) {
      if (y <= ch.a || y >= ch.b) continue;
      const u = (y - ch.a) / (ch.b - ch.a), cut = ch.deep * (1 - Math.abs(2 * u - 1) ** 2.5) * (0.82 + 0.18 * Math.sin(u * 15 + ch.ph)) + 0.0008 * Math.sin(y * 400 + x * 600);
      const over = x * ch.nx + z * ch.nz - (RAD - cut);
      if (over > 0) { x -= over * ch.nx; z -= over * ch.nz; hurt = Math.max(hurt, Math.min(1, over / 0.0015)); }
    }
    P.setXYZ(i, x, y, z);
    col.push(1 + 0.3 * hurt, 1 + 0.08 * hurt, 1 - 0.12 * hurt);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  m.userData.live = true;
  return m;
}

// ---------------------------------------------------------------- bathroom

/** A rounded box from its corners, for the furniture: softer than a slab. */
function soft(x0, x1, y0, y1, z0, z1, r, mat) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(x1 - x0, y1 - y0, z1 - z0, 3, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function bathroom(g, M, mat, ctx, cool) {
  const { x0, x1, z0, z1 } = B;
  // the bath across the far end, its front tiled like everything else
  const deep = 0.76, bz = z1 - deep, top = 0.56;
  g.add(slab(x0, x1, 0, top - 0.04, bz, bz + 0.06, mat.tileX));
  const tub = F.bathtub(mat.ceramic, mat.chrome, x1 - x0, deep, top);
  tub.position.set((x0 + x1) / 2, 0, bz + deep / 2);
  g.add(tub);
  const taps = F.bathTaps(mat.chrome);
  taps.group.position.set(x0, 0.82, bz + deep / 2);
  taps.group.rotation.y = Math.PI / 2;
  g.add(taps.group);
  ctx.colliders.push({ type: 'box', x0, x1, z0: bz, z1, top, stand: true, surface: 'tile' });
  // the basin by the door, the toilet beyond it, both on the west wall
  const basin = F.pedestalBasin(mat.ceramic, mat.chrome);
  basin.rotation.y = Math.PI / 2;
  basin.position.set(x0 + 0.22, 0, z0 + 0.82);
  g.add(basin);
  ctx.colliders.push({ type: 'box', x0, x1: x0 + 0.46, z0: z0 + 0.54, z1: z0 + 1.1, top: 0.85 });
  // what was washed down it (user, 2026-10-15): there all along, and seen only under the UV torch with
  // the light off (uvtorch.js). Drawn over the bowl's own shape, its mask laid on from above.
  const bowl = basin.userData.bowl, traceGeo = bowl.geometry.clone(), tp = traceGeo.attributes.position, tuv = [];
  for (let i = 0; i < tp.count; i++) tuv.push(tp.getX(i) / 0.42 + 0.5, 0.5 - tp.getZ(i) / 0.28);
  traceGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
  const traceDark = { value: 0 };
  const traces = new THREE.Mesh(traceGeo, glowMaterial(T.basinTraceTex(), traceDark));
  traces.position.copy(bowl.position);
  traces.renderOrder = 2.5;
  traces.userData.live = true;
  basin.add(traces);
  // over it, a little old wall cabinet of grey steel, not quite in the middle of it; it opens (below)
  const cabinet = F.wallCabinet(cool);
  cabinet.rotation.y = Math.PI / 2;
  cabinet.position.set(x0, 1.22, z0 + 0.835);
  g.add(cabinet);
  ctx.colliders.push({ type: 'box', x0, x1: x0 + 0.125, z0: z0 + 0.835 - 0.2, z1: z0 + 0.835 + 0.2, base: 1.21, top: 1.73 });
  const wc = F.toilet(mat.ceramic, mat.seat, mat.chrome);
  wc.rotation.y = Math.PI / 2;
  wc.position.set(x0 + 0.385, 0, z0 + 2.15);
  g.add(wc);
  ctx.colliders.push({ type: 'box', x0, x1: x0 + 0.68, z0: z0 + 1.92, z1: z0 + 2.38, top: 0.42 });
  const lid = wc.userData.lid;
  lid.userData.interact = {
    label: () => (lid.userData.door.state.target > 0.5 ? 'Put the lid down' : 'Lift the lid'),
    use: () => {
      const d = lid.userData.door;
      d.state.target = d.state.target > 0.5 ? 0 : wc.userData.up;
      ctx.sound.sample('toilet-lid', lid.getWorldPosition(new THREE.Vector3()));
    },
  };
  ctx.interact.push(lid);
  // the flush (user, 2026-10-17: press the button on the cistern and it flushes): the button goes down, the
  // water washes down the bowl from under the rim and goes round and down out of it, and the bowl fills
  // again; the cistern takes a while to fill, and a press before then is only a click
  const FL = wc.userData.flush, bowlWater = wc.userData.water, restY = bowlWater.position.y, OVAL = bowlWater.scale.z;
  const washTex = streamTex();
  washTex.wrapS = washTex.wrapT = THREE.RepeatWrapping;
  washTex.repeat.set(9, 1);
  FL.wash.material.map = washTex;
  FL.swirl.material.map = T.swirlTex();
  FL.swirl.material.map.center.set(0.5, 0.5);
  const flushGrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.08), new THREE.MeshBasicMaterial({ visible: false }));
  flushGrip.position.set(0, 0.81, -0.285);
  FL.button.add(flushGrip); // (the button is small: something easier to point at)
  let flushT = -1, pressT = -1;
  FL.button.userData.interact = {
    label: () => 'Flush',
    use: () => {
      pressT = 0;
      if (flushT >= 0) return; // still filling
      flushT = 0;
      ctx.sound.sample('toilet-flush', FL.button.getWorldPosition(new THREE.Vector3()));
    },
  };
  ctx.interact.push(FL.button);
  const wcAt = new THREE.Vector3();
  ctx.animated.push((time, dt) => {
    if (pressT >= 0) { // pushed in, and back up
      pressT += dt;
      FL.button.position.y = -0.004 * (pressT < 0.1 ? pressT / 0.1 : Math.max(0, 1 - (pressT - 0.3) / 0.15));
      if (pressT > 0.5) pressT = -1;
    }
    if (flushT < 0) return;
    flushT += dt;
    const t = flushT, ss = THREE.MathUtils.smoothstep, dry = bowlWater.visible; // (under the flood, there is no bowl of water to see)
    const wash = ss(t, 0.1, 0.35) * (1 - ss(t, 1.8, 3.2)); // all at once from under the rim, thinning out
    const down = ss(t, 0.6, 1.6) * (1 - ss(t, 2.6, 7)); // round and down, then filling back up
    FL.wash.visible = dry && wash > 0.01;
    FL.wash.material.opacity = 0.7 * wash;
    washTex.offset.y = (washTex.offset.y - dt * 2.4) % 1;
    bowlWater.position.y = restY - 0.035 * down;
    bowlWater.scale.set(1 - 0.4 * down, 1, OVAL * (1 - 0.4 * down));
    FL.swirl.visible = dry && Math.max(wash, down) > 0.01;
    FL.swirl.material.opacity = 0.55 * Math.max(wash, down * 0.8);
    FL.swirl.material.map.rotation -= dt * (7 * wash + 3.5 * down);
    FL.swirl.position.y = bowlWater.position.y + 0.0012;
    FL.swirl.scale.copy(bowlWater.scale);
    if (!dry && down > 0.3 && Math.random() < dt * 4) { // under the flood: it stirs the water over it
      wc.localToWorld(wcAt.set(0, 0, 0.06));
      water.disturb(wcAt.x, wcAt.z, 0.12);
    }
    if (t > 7.5) {
      flushT = -1;
      bowlWater.position.y = restY;
      bowlWater.scale.set(1, 1, OVAL);
      FL.wash.visible = FL.swirl.visible = false;
    }
  });
  // the toilet roll on its holder, beside the toilet, and the towel over its rail across from the basin
  const roll = F.paperHolder(mat.chrome, mat.paperRoll);
  roll.rotation.y = Math.PI / 2 + deg(2); // never quite straight
  roll.position.set(x0, 0.7, z0 + 2.57);
  g.add(roll);
  const rail = F.towelRail(mat.chrome, mat.towel);
  rail.rotation.y = -Math.PI / 2;
  rail.position.set(x1, 1.2, z0 + 1.0);
  g.add(rail);
  // and the water: the taps turn, the bath fills, and over it goes onto the floor
  const water = bathWater(g, ctx, { tub, taps, floor: { x0, x1, z0, z1: bz }, room: { x0, x1, z0, z1 }, door: DOORS.bath, top: DOOR_H - 0.08, ceiling: H, env: cool, towel: rail, bowl: wc.userData.water, basin: { tap: basin.userData.tap, bowl: basin.userData.bowl } });
  return { water, lid, cabinet, traceDark };
}

// ---------------------------------------------------------------- kitchen

function kitchen(g, M, mat, ctx) {
  const TOP = 0.92, DEEP = 0.62, X0 = L.x0;
  /** A cupboard door, panelled, a bar handle on it near its free edge. `face`: where its front is; `alongX`: the run goes along x. */
  const cupboard = (a, b, y0, y1, face, alongX, handleAt = 'top') => {
    const door = alongX ? soft(a + 0.004, b - 0.004, y0, y1, face, face + 0.02, 0.004, mat.cupboard) : soft(face, face + 0.02, y0, y1, a + 0.004, b - 0.004, 0.004, mat.cupboard);
    g.add(door);
    const hy = handleAt === 'top' ? y1 - 0.09 : y0 + 0.09;
    const hx = b - 0.05;
    if (alongX) {
      g.add(soft(hx - 0.007, hx + 0.007, hy - 0.06, hy + 0.06, face + 0.035, face + 0.047, 0.005, M.knob));
      for (const dy of [-0.05, 0.05]) g.add(cyl(0.004, 0.004, 0.02, M.knob, hx, hy + dy, face + 0.028, 8).rotateX(Math.PI / 2));
    } else {
      g.add(soft(face + 0.035, face + 0.047, hy - 0.06, hy + 0.06, hx - 0.007, hx + 0.007, 0.005, M.knob));
      for (const dy of [-0.05, 0.05]) g.add(cyl(0.004, 0.004, 0.02, M.knob, face + 0.028, hy + dy, hx, 8).rotateZ(Math.PI / 2));
    }
  };
  /** A run of base cupboards with its worktop; `gaps`: stretches left out of the worktop (for a sink). */
  const baseRun = (a, b, alongX, doors, worktop = true, hole = null) => {
    if (alongX) {
      if (hole) {
        // the sink's cupboard: open under the bowl (user, 2026-10-17: its top showed across the sink like a lid)
        const [hx0, hx1, hz0, hz1] = hole, low = TOP - 0.2;
        g.add(slab(a, b, 0.1, low, 0, DEEP - 0.02, M.woodCabinet));
        for (const [x0, x1, z0, z1] of [[a, hx0, 0, DEEP - 0.02], [hx1, b, 0, DEEP - 0.02], [hx0, hx1, 0, hz0], [hx0, hx1, hz1, DEEP - 0.02]]) if (x1 > x0 && z1 > z0) g.add(slab(x0, x1, low, TOP - 0.03, z0, z1, M.woodCabinet));
      } else g.add(slab(a, b, 0.1, TOP - 0.03, 0, DEEP - 0.02, M.woodCabinet));
      g.add(slab(a, b, 0, 0.1, 0, DEEP - 0.07, M.underBed));
      for (let i = 0; i < doors; i++) cupboard(a + ((b - a) * i) / doors, a + ((b - a) * (i + 1)) / doors, 0.12, TOP - 0.05, DEEP - 0.02, true);
      if (worktop) g.add(soft(a, b, TOP - 0.035, TOP, 0, DEEP + 0.025, 0.012, mat.counter));
    } else {
      g.add(slab(X0, X0 + DEEP - 0.02, 0.1, TOP - 0.03, a, b, M.woodCabinet));
      g.add(slab(X0, X0 + DEEP - 0.07, 0, 0.1, a, b, M.underBed));
      for (let i = 0; i < doors; i++) cupboard(a + ((b - a) * i) / doors, a + ((b - a) * (i + 1)) / doors, 0.12, TOP - 0.05, X0 + DEEP - 0.02, false);
      if (worktop) g.add(soft(X0, X0 + DEEP + 0.025, TOP - 0.035, TOP, a, b, 0.012, mat.counter));
    }
  };
  const wallRun = (a, b, alongX, doors) => {
    if (alongX) {
      g.add(slab(a, b, 1.45, 2.15, 0, 0.33, M.woodCabinet));
      for (let i = 0; i < doors; i++) cupboard(a + ((b - a) * i) / doors, a + ((b - a) * (i + 1)) / doors, 1.47, 2.13, 0.33, true, 'bottom');
    } else {
      g.add(slab(X0, X0 + 0.33, 1.45, 2.15, a, b, M.woodCabinet));
      for (let i = 0; i < doors; i++) cupboard(a + ((b - a) * i) / doors, a + ((b - a) * (i + 1)) / doors, 1.47, 2.13, X0 + 0.33, false, 'bottom');
    }
  };

  // ---- along the north wall, west of the back door: cupboards either side of the cooker
  const run1 = [X0, -3.1], cooker = [-4.45, -3.85];
  baseRun(run1[0], cooker[0], true, 2);
  baseRun(cooker[1], run1[1], true, 1);
  wallRun(run1[0], cooker[0] - 0.02, true, 2);
  wallRun(cooker[1] + 0.02, run1[1], true, 1);
  g.add(slab(X0, run1[1], TOP, 1.45, 0, 0.006, faces(M.wall, { pz: mat.kitchenTile }))); // tiles behind the worktop
  ctx.colliders.push({ type: 'box', x0: X0, x1: run1[1], z0: 0, z1: DEEP + 0.025, top: TOP, stand: true, surface: 'wood' });
  cookerAt(g, M, mat, ctx, cooker[0], cooker[1], TOP, DEEP);

  // ---- down the west wall from the corner
  const run2 = [DEEP, 2.3];
  baseRun(run2[0], run2[1], false, 3);
  wallRun(run2[0], run2[1], false, 3);
  g.add(slab(X0, X0 + 0.006, TOP, 1.45, 0.006, run2[1], faces(M.wall, { px: mat.kitchenTile }))); // (from the corner: they began where this run does, and over the other run's end the wall showed bare — user, 2026-10-18: "a hole")
  ctx.colliders.push({ type: 'box', x0: X0, x1: X0 + DEEP + 0.025, z0: run2[0], z1: run2[1], top: TOP, stand: true, surface: 'wood' });
  // on it: the kettle, the toaster, the microwave
  kettle(g, mat, X0 + 0.32, TOP, 1.0);
  const toaster = toasterAt(g, M, X0 + 0.22, 1.38, TOP);
  const micro = microwaveAt(g, M, X0, TOP, 1.92);
  wallSocket(g, M, X0 + 0.006, TOP, 1.622, toaster, micro); // (on the tiles between them, both plugged into it: user, 2026-11-03)
  airConditioner(g, ctx, -4.42, 1.6, -t); // (outside, on this wall: over the hose's tap and to its right, seen from the yard — clear of the downpipe by the corner)
  // right of the cooker, a wooden chopping board with a kitchen knife left lying on it; in the corner a pot
  // of what you cook with, a ladle and a wooden spatula standing in it (user, 2026-10-18)
  const board = choppingBoard(g, mat, cooker[1] + 0.37, TOP, 0.31);
  utensilPot(g, mat, X0 + 0.097, TOP, 0.086);

  // ---- east of the back door: the sink under the window
  const run3 = [-2.05, -0.86], sinkX = -1.45, sinkZ = 0.31, sw = 0.86, sd = 0.5;
  baseRun(run3[0], run3[1], true, 2, false, [sinkX - sw / 2 + 0.03, sinkX + sw / 2 - 0.03, sinkZ - sd / 2 + 0.03, sinkZ + sd / 2 - 0.03]);
  for (const [a0, a1, c0, c1] of [[run3[0], sinkX - sw / 2 + 0.02, 0, DEEP + 0.025], [sinkX + sw / 2 - 0.02, run3[1], 0, DEEP + 0.025], [sinkX - sw / 2 + 0.02, sinkX + sw / 2 - 0.02, 0, sinkZ - sd / 2 + 0.02], [sinkX - sw / 2 + 0.02, sinkX + sw / 2 - 0.02, sinkZ + sd / 2 - 0.02, DEEP + 0.025]]) {
    g.add(soft(a0, a1, TOP - 0.035, TOP, c0, c1, 0.006, mat.counter));
  }
  // plain aluminium, the everyday kind (user, 2026-10-17: the brushed steel was too fancy): pale, satin, a
  // little dulled and scratched with use, not a mirror
  const sinkMetal = std({ color: 0xb2b5b7, metalness: 0.5, roughness: 0.46, bumpMap: T.noiseBump(251, [8, 8]), bumpScale: 0.12 });
  const sink = F.kitchenSink(sinkMetal, M.chrome, TOP - 0.002);
  sink.position.set(sinkX, 0, sinkZ);
  g.add(sink);
  ctx.colliders.push({ type: 'box', x0: run3[0], x1: run3[1], z0: 0, z1: DEEP + 0.025, top: TOP, stand: true, surface: 'wood' });
  // the plates left to drain, and a mug left by them (the coffee long dried in it)
  for (let i = 0; i < 4; i++) {
    const plateMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.012, 32), std({ color: 0xcdc7ba, roughness: 0.6 })); // everyday china, not snow
    plateMesh.rotation.set(Math.PI / 2 - 0.25, 0, 0);
    plateMesh.position.set(sinkX - 0.33 + i * 0.045, TOP + 0.12, sinkZ - 0.02);
    plateMesh.rotation.order = 'YXZ';
    plateMesh.rotation.y = Math.PI / 2;
    plateMesh.castShadow = true;
    g.add(plateMesh);
  }
  mug(g, sinkX - 0.17, TOP + 0.012, sinkZ + 0.17, 0xc6bdab, 'dried');

  // ---- the fridge, in the corner against the bedroom wall
  const fridge = fridgeAt(g, M, mat, ctx, -0.84, -t - 0.01, 0.7);
  // ---- the calendar on the empty wall by it, clear of its door when it is open (user, 2026-10-19)
  calendar(g, -t - 0.0045, 1.86, 1.84);

  // ---- the table and its four chairs, a bowl of fruit on it
  const tx = -3.0, tz = 2.35;
  const table = F.kitchenTable(M.woodDesk);
  table.position.set(tx, 0, tz);
  g.add(table);
  ctx.colliders.push({ type: 'box', x0: tx - 0.6, x1: tx + 0.6, z0: tz - 0.4, z1: tz + 0.4, top: 0.75 });
  // the chairs pushed in to the table, each facing it (their front is +z), the seats under the top — not
  // quite square, nor all as far in; one left pulled out, half turned away, where someone got up from it
  // (user, 2026-10-17). In at 0.5 m from the middle the seat's front is 0.29 under the top, the front
  // legs between the table's (0.1 clear), the back posts 0.27 off its edge.
  for (const [cx, cz, face] of [[tx - 0.28, tz - 0.5, 0.04], [tx + 0.29, tz - 0.55, -0.07], [tx - 0.25, tz + 0.52, Math.PI + 0.03], [tx + 0.98, tz + 0.12, -Math.PI / 2 + 0.38]]) {
    const ch = F.kitchenChair(M.woodDesk);
    ch.position.set(cx, 0, cz);
    ch.rotation.y = face;
    g.add(ch);
    ctx.colliders.push({ type: 'box', x0: cx - 0.22, x1: cx + 0.22, z0: cz - 0.22, z1: cz + 0.22, top: 0.47 });
  }
  // the bowl of fruit, on its foot on the table's top (0.7525: it had been set 3 mm into the wood, its
  // shadow with it, where nothing showed — user, 2026-10-17)
  const TOP_Y = 0.7525, bowl = F.fruitBowl();
  bowl.position.set(tx + 0.15, TOP_Y, tz - 0.05);
  bowl.rotation.y = deg(-12);
  g.add(bowl);
  const contact = (size, dark, x, z, lift) => { // its shadow on the table: the lamp's is taken 2 cm off every surface, and a bowl that low casts none of its own
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: canvasTex(64, 64, (c, w, h) => {
        const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gr.addColorStop(0, `rgba(0,0,0,${dark})`);
        gr.addColorStop(0.55, `rgba(0,0,0,${dark * 0.8})`);
        gr.addColorStop(0.75, `rgba(0,0,0,${dark * 0.3})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gr;
        c.fillRect(0, 0, w, h);
      }),
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    m.position.set(x, TOP_Y + lift, z);
    m.renderOrder = 1;
    g.add(m);
    return m;
  };
  // its shadow (user, 2026-10-17): the sun's shadows are taken 3 cm up off every surface (outdoorLight's
  // normalBias, so the walls never speckle), and a bowl that low cast none at all — so a shape of it, unseen,
  // 3 cm higher, casts the shadow it would; and a little dark close under its foot
  const caster = bowl.children[0].clone();
  caster.material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  caster.material.shadowSide = THREE.BackSide; // (its far side: so it never shades the bowl's own inside, so close under it)
  caster.position.y += 0.03;
  caster.castShadow = true;
  caster.receiveShadow = false;
  caster.userData.live = true; // (not baked into the room: it draws nothing)
  bowl.add(caster);
  contact(0.12, 0.55, bowl.position.x, bowl.position.z, 0.001);

  // a clock over the back door that stopped at twenty to four
  const clock = new THREE.Group();
  clock.position.set((DOORS.back.x0 + DOORS.back.x1) / 2, 2.28, 0.01);
  const rim = cyl(0.14, 0.14, 0.035, std({ color: 0x2b2b2e, roughness: 0.5 }), 0, 0, 0.018, 32);
  rim.rotation.x = Math.PI / 2;
  clock.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.125, 32), std({ color: 0xdfd9cc, roughness: 0.6 }));
  face.position.z = 0.0365;
  clock.add(face);
  for (let i = 0; i < 12; i++) {
    const tick = box(0.004, 0.014, 0.002, M.blackPlastic, Math.sin((i / 12) * Math.PI * 2) * 0.108, Math.cos((i / 12) * Math.PI * 2) * 0.108, 0.038);
    tick.rotation.z = -(i / 12) * Math.PI * 2;
    clock.add(tick);
  }
  for (const [len, turn, wdt] of [[0.07, deg(-120 + 180), 0.012], [0.1, deg(-240 + 180), 0.008]]) {
    const hand = box(wdt, len, 0.003, M.blackPlastic, 0, 0, 0.04);
    hand.geometry.translate(0, len / 2, 0);
    hand.rotation.z = turn;
    clock.add(hand);
  }
  g.add(clock);
  // a hand towel over the oven door's bar (user, 2026-10-20: it read as a sheet of paper laid there): its old
  // blue plaid, in terry like the bathroom's towel — that one's material (with the house's reflection, not the
  // bathroom's), not its look — stained (T.kitchenTowelTex); folded over the bar unevenly, one half behind it against the door, the longer in front,
  // creased, gathered where it goes over, its corners hanging their own ways
  {
    const W = 0.26, LB = 0.33, LF = 0.41, RR = 0.014, yc = 0.645, zc = DEEP + 0.048, xc = -4.08, ARC = Math.PI * RR, LEN = LB + ARC + LF;
    const geo = new THREE.PlaneGeometry(W, LEN, 22, 90), P = geo.attributes.position, UV = geo.attributes.uv, col = [];
    const r = mulberry32(7731), folds = [0, 1, 2, 3].map(() => [0.6 + r() * 1.2, r() * 6.3, 0.0035 + r() * 0.004]);
    const creases = [0, 1, 2, 3].map(() => [r() * LEN, (r() - 0.5) * 0.3, 0.003 + r() * 0.004]);
    for (let i = 0; i < P.count; i++) {
      const u = UV.getX(i), s = (1 - UV.getY(i)) * LEN; // s: from the back half's foot, up over the bar, down the front
      const nearBar = Math.exp(-(((s - LB - ARC / 2) / 0.09) ** 2)); // gathered and creased where it goes over
      const x = xc + (u - 0.5) * W * (1 - 0.12 * nearBar) + 0.004 * Math.sin(s * 9 + u * 3);
      let d = 0; // out of its plane: soft vertical folds, a few creases across, its corners lifting
      for (const [k, ph, amp] of folds) d += amp * (0.5 + nearBar) * Math.sin((u * W) * (40 + k * 25) + ph + s * k);
      for (const [s0, slope, amp] of creases) d += amp * Math.exp(-(((s - s0 - slope * (u - 0.5)) / 0.012) ** 2));
      d += 0.004 * Math.sin(s * 11 + u * 2.4) * Math.sin(u * 5.1 + 1.3); // (not lying flat anywhere: it was hung up crumpled)
      const foot = Math.min(s, LEN - s), corner = Math.max(0, 1 - foot / 0.06) * Math.abs(2 * u - 1);
      d += 0.012 * corner * (u < 0.5 ? 1 : 0.6);
      let y, z;
      if (s < LB) { // behind the bar, against the door: pushed off it towards the bar by its folds
        const k = Math.min(1, (LB - s) / 0.05); // (meeting the turn over the bar smoothly)
        y = yc - (LB - s); z = Math.max(DEEP + 0.018, zc - RR - (0.006 + Math.abs(d)) * k); // (never into the door)
      } else if (s < LB + ARC) { // over it
        const p = (s - LB) / RR;
        y = yc + Math.sin(p) * RR; z = zc - Math.cos(p) * RR;
      } else { // down the front, hanging a little out at its foot
        const q = s - LB - ARC;
        y = yc - q; z = zc + RR + (0.002 + Math.abs(d)) * Math.min(1, q / 0.05) + 0.012 * (q / LF) ** 2;
      }
      P.setXYZ(i, x, y, z);
      const grime = 0.94 + 0.06 * Math.min(1, foot / 0.1);
      col.push(grime, grime, grime);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const cloth = mat.towel.clone();
    Object.assign(cloth, { map: T.kitchenTowelTex(LEN, W), alphaTest: 0.5, envMap: M.env, envMapIntensity: 0.3, side: THREE.DoubleSide }); // (alphaTest: its two torn holes)
    cloth.color.setHex(0xe6e2da);
    const towel = new THREE.Mesh(geo, cloth);
    towel.castShadow = towel.receiveShadow = true;
    towel.userData.live = true; // (out of the bake: it drops vertex colours)
    g.add(towel);
  }
  return { fridge, board };
}

/** A rounded box's geometry from its corners, where it is (its UVs to set: uvBy, front). */
function rbox(x0, x1, y0, y1, z0, z1, r) {
  return new RoundedBoxGeometry(x1 - x0, y1 - y0, z1 - z0, 3, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}
/** A piece's UVs from where each corner is (p) and which way it faces (n): `fn(p, n)` → [u, v]. */
function uvBy(geo, fn) {
  const P = geo.attributes.position, N = geo.attributes.normal, uv = new Float32Array(P.count * 2), p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { p.fromBufferAttribute(P, i); n.fromBufferAttribute(N, i); [uv[i * 2], uv[i * 2 + 1]] = fn(p, n); }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
/** ...for a piece seen from the front: its picture over x0…x1 by y0…y1, folded round its edges from its face at z1. */
function front(geo, x0, x1, y0, y1, z1) {
  return uvBy(geo, (p, n) => [(p.x - x0 - n.x * (z1 - p.z)) / (x1 - x0), (p.y - y0 - n.y * (z1 - p.z)) / (y1 - y0)]);
}
/** Pieces made one, indexed or not (RoundedBoxGeometry has no index). */
function merge(list) {
  return mergeGeometries(list.map((q) => (q.index ? q.toNonIndexed() : q)));
}
/** Worn enamel or paint (T.cookerEnamelTex): its picture, how it stands out, how rough. */
function enamel(part, o) {
  const t = T.cookerEnamelTex(part, o);
  return std({ map: t.map, bumpMap: t.bump, bumpScale: 0.7, roughnessMap: t.rough, roughness: 1 });
}

/**
 * The toaster (user, 2026-10-29, with a photo of an old one — its shape, not its name): chrome, rounded like a loaf,
 * two slots in its top with rims round them, its lever up in a slot in its end and a browning knob under it, on a
 * black bakelite base on four feet. Old: the chrome smudged and swirled with scratches, pitted (T.chromeWearTex),
 * browned round the slots by the heat, grimy along its foot, a dent in its front; crumbs round it on the worktop,
 * most in front. Long side to the room, turned out from the wall; x, z: its middle. Returns its group.
 */
function toasterAt(g, M, x, z, TOP) {
  const ts = new THREE.Group();
  ts.position.set(x, TOP, z);
  ts.rotation.y = Math.PI / 2 - deg(14); // (pulled out from the wall and left turned, its lever end out towards you — user, 2026-11-03: "too straight")
  g.add(ts);
  const put = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; ts.add(o); return o; };
  const LEN = 0.26, WID = 0.135, BH = 0.018, HB = 0.165, BV = 0.03, hx = LEN / 2, TOPY = BH + HB;
  // the body: its side's outline (round at the top, less at the foot) drawn out across it, its long edges rounded
  const R0 = 0.026, R1 = 0.065, s = new THREE.Shape();
  s.moveTo(-hx + R0, 0); s.lineTo(hx - R0, 0); s.quadraticCurveTo(hx, 0, hx, R0); s.lineTo(hx, HB - R1); s.quadraticCurveTo(hx, HB, hx - R1, HB);
  s.lineTo(-hx + R1, HB); s.quadraticCurveTo(-hx, HB, -hx, HB - R1); s.lineTo(-hx, R0); s.quadraticCurveTo(-hx, 0, -hx + R0, 0);
  let body = new THREE.ExtrudeGeometry(s, { depth: WID - 2 * BV, bevelEnabled: true, bevelThickness: BV, bevelSize: 0.024, bevelOffset: -0.024, bevelSegments: 8, curveSegments: 16 }).translate(0, BH, -(WID - 2 * BV) / 2);
  body.deleteAttribute('normal');
  body.deleteAttribute('uv');
  body = mergeVertices(body); // (smooth all round: drawn out, it came in facets)
  const P = body.attributes.position, col = [];
  for (let i = 0; i < P.count; i++) {
    let px = P.getX(i), py = P.getY(i), pz = P.getZ(i);
    pz -= 0.003 * Math.exp(-(((px - 0.055) / 0.022) ** 2 + ((py - BH - 0.06) / 0.022) ** 2)) * Math.max(0, pz / (WID / 2)); // the dent in its front
    P.setXYZ(i, px, py, pz);
    const heat = Math.max(0, 1 - Math.abs(px) / 0.11) * THREE.MathUtils.smoothstep(py, TOPY - 0.03, TOPY) * Math.max(0, 1 - Math.abs(pz) / 0.07); // browned by the heat round the slots
    const foot = 1 - 0.3 * (1 - THREE.MathUtils.smoothstep(py, BH, BH + 0.02)); // grimy along its foot
    col.push(foot * (1 - 0.06 * heat), foot * (1 - 0.16 * heat), foot * (1 - 0.32 * heat));
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  body.computeVertexNormals();
  const SP = 0.12; // (the chrome's wear repeats this often)
  uvBy(body, (p, n) => { const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z); return ay >= ax && ay >= az ? [p.x / SP, p.z / SP] : ax >= az ? [p.z / SP, p.y / SP] : [p.x / SP, p.y / SP]; });
  const wear = T.chromeWearTex();
  const chrome = std({ map: wear.map, roughnessMap: wear.rough, roughness: 1, metalness: 1, color: 0xe4e4e4, envMap: M.env, envMapIntensity: 1.5, vertexColors: true });
  put(body, chrome).userData.live = true; // (its colours: the bake would drop them)
  const rimChrome = chrome.clone();
  rimChrome.vertexColors = false;
  const black = std({ color: 0x0c0b0a, roughness: 0.8 }), bakelite = std({ color: 0x17130f, roughness: 0.5 });
  const ring = (sh, w, d, rr) => {
    sh.moveTo(-w / 2 + rr, -d / 2); sh.lineTo(w / 2 - rr, -d / 2); sh.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + rr); sh.lineTo(w / 2, d / 2 - rr); sh.quadraticCurveTo(w / 2, d / 2, w / 2 - rr, d / 2);
    sh.lineTo(-w / 2 + rr, d / 2); sh.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - rr); sh.lineTo(-w / 2, -d / 2 + rr); sh.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + rr, -d / 2);
    return sh;
  };
  for (const zc of [-0.019, 0.019]) { // the slots: dark down into it, a chrome rim round each
    put(rbox(-0.06, 0.06, TOPY - 0.07, TOPY + 0.0008, zc - 0.013, zc + 0.013, 0.003), black);
    const rim = ring(new THREE.Shape(), 0.132, 0.034, 0.008);
    rim.holes.push(ring(new THREE.Path(), 0.12, 0.026, 0.004));
    const rg = new THREE.ExtrudeGeometry(rim, { depth: 0.0012, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelOffset: -0.0008, bevelSegments: 2, curveSegments: 4 }).rotateX(-Math.PI / 2).translate(0, TOPY - 0.0004, zc);
    uvBy(rg, (p) => [p.x / SP, p.z / SP]);
    put(rg, rimChrome);
  }
  // its end: the lever up in its slot, the browning knob below
  put(rbox(hx - 0.004, hx + 0.0008, BH + 0.028, BH + 0.098, 0.0145, 0.0215, 0.0015), black);
  put(rbox(hx - 0.002, hx + 0.024, BH + 0.08, BH + 0.093, 0.005, 0.031, 0.004), bakelite);
  put(new THREE.CylinderGeometry(0.0105, 0.0115, 0.012, 20).rotateZ(-Math.PI / 2).translate(hx + 0.005, BH + 0.05, -0.022), bakelite);
  put(new THREE.BoxGeometry(0.001, 0.008, 0.0016).translate(hx + 0.0112, BH + 0.054, -0.022), std({ color: 0xbdb5a3, roughness: 0.6 })); // its mark, worn
  // the base it stands on, on four feet
  put(rbox(-hx - 0.008, hx + 0.008, 0.006, BH + 0.001, -WID / 2 - 0.008, WID / 2 + 0.008, 0.008), bakelite);
  for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ts.add(cyl(0.009, 0.01, 0.0065, bakelite, fx * (hx - 0.01), 0.003, fz * (WID / 2 - 0.004), 12));
  // crumbs round it on the worktop, more in front where the toast comes out
  const r = mulberry32(8811), bits = [];
  while (bits.length < 28) {
    const cx = (r() - 0.5) * (LEN + 0.1), cz = WID / 2 - 0.02 + Math.pow(r(), 1.6) * 0.12 * (r() < 0.8 ? 1 : -1.4);
    if (Math.abs(cx) < hx + 0.016 && Math.abs(cz) < WID / 2 + 0.016) continue;
    const sz = 0.001 + r() * 0.0022;
    bits.push(new THREE.IcosahedronGeometry(1, 0).scale(sz * (0.7 + r() * 0.6), sz * 0.5, sz * (0.7 + r() * 0.6)).rotateY(r() * 6.3).translate(cx, sz * 0.35, cz));
  }
  put(mergeGeometries(bits), std({ color: 0xa8824e, roughness: 0.9 }));
  return ts;
}

/**
 * The air conditioner's outside part, high on the kitchen's back wall (user, 2026-10-29, after his photo — its
 * shape and its wear, not its maker): a dirty cream case on two angle-iron brackets, its fan in a round opening going
 * into it, behind a domed grille of white wire gone dark with dirt (three pale blades, one with its tip broken off,
 * the motor on its struts, the coil's fins behind), its maker's plate rusted blank, a slot, the service
 * panel pressed into its side; streaked by the rain, its screws and foot rusting (T.cookerEnamelTex 'acFront'); its
 * pipes, taped, out of its end and into the wall; its drain hose hanging under it. Not quite level on its brackets.
 * x: its middle; y: its foot; wall: the wall's outer face (z, the yard beyond it at −z).
 */
function airConditioner(g, ctx, x, y, wall) {
  const ac = new THREE.Group(); // (its own front is +z: turned to the yard)
  ac.position.set(x, y, wall - 0.205);
  ac.rotation.y = Math.PI;
  g.add(ac);
  const unit = new THREE.Group();
  unit.rotation.set(0.006, deg(1), -0.004); // (not quite square on its brackets)
  ac.add(unit);
  const put = (geo, m, parent = unit) => { const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const W = 0.76, H = 0.54, D = 0.27, FX = 0.13, FY = 0.27, FR = 0.205, ZF = D / 2; // its size; the fan's middle and radius
  const screws = [0.25, 0.75, 1.25, 1.75].map((a) => [W / 2 + FX + Math.cos(a * Math.PI) * (FR + 0.02), H - FY - Math.sin(a * Math.PI) * (FR + 0.02)]);
  const face = enamel('acFront', { W, H, base: [212, 203, 172], dense: 1340, seed: 9411, fan: [W / 2 + FX, H - FY, FR], plate: [0.05, 0.04, 0.15, 0.035], slot: [0.07, 0.13, 0.05, 0.014], panel: [0.05, 0.21, 0.14, 0.26], screws });
  // the case: dirty cream (user, 2026-10-29), the fan's round opening going right in through it — what is in there is
  // the same cream in its own shadow, not black (user, 2026-10-29)
  const outline = new THREE.Shape(), cr = 0.012;
  outline.moveTo(-W / 2 + cr, 0); outline.lineTo(W / 2 - cr, 0); outline.quadraticCurveTo(W / 2, 0, W / 2, cr); outline.lineTo(W / 2, H - cr); outline.quadraticCurveTo(W / 2, H, W / 2 - cr, H);
  outline.lineTo(-W / 2 + cr, H); outline.quadraticCurveTo(-W / 2, H, -W / 2, H - cr); outline.lineTo(-W / 2, cr); outline.quadraticCurveTo(-W / 2, 0, -W / 2 + cr, 0);
  outline.holes.push(new THREE.Path().absarc(FX, FY, FR, 0, Math.PI * 2, true));
  let shell = new THREE.ExtrudeGeometry(outline, { depth: D - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelOffset: -0.006, bevelSegments: 3, curveSegments: 48 }).translate(0, 0, -D / 2 + 0.006);
  shell.deleteAttribute('normal');
  shell.deleteAttribute('uv');
  shell = mergeVertices(shell); // (smooth round its edges and its opening: drawn out, it came in facets)
  shell.computeVertexNormals();
  put(front(shell, -W / 2, W / 2, 0, H, ZF), face);
  // inside it, 14 cm in: the coil's fins behind, the motor on its three struts, the three blades on their hub (one
  // with its tip broken off), all grimy; the grille domed over the opening — white wire, so dirty it reads dark
  const inner = std({ map: T.acInsideTex(), color: 0xe0d6bc, roughness: 0.85 });
  put(new THREE.CircleGeometry(FR + 0.002, 48).translate(FX, FY, ZF - 0.14), inner);
  const cream = std({ color: 0xbfb69c, roughness: 0.75 });
  put(new THREE.CylinderGeometry(0.052, 0.055, 0.085, 28).rotateX(Math.PI / 2).translate(FX, FY, ZF - 0.0975), cream);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.9, strut = new THREE.BoxGeometry(FR - 0.045, 0.012, 0.008).translate((FR + 0.045) / 2, 0, 0).rotateZ(a).translate(FX, FY, ZF - 0.105);
    put(strut, cream);
  }
  const blade = std({ color: 0xb7af98, roughness: 0.65, side: THREE.DoubleSide });
  const fan = new THREE.Group(); // (it turns: never baked; its shadow left out, or the still one would stay on the coil)
  fan.position.set(FX, FY, ZF - 0.045);
  fan.userData.live = true;
  unit.add(fan);
  for (let k = 0; k < 3; k++) {
    const bs = new THREE.Shape(), tip = k === 1 ? 0.15 : 0.185; // (one with its tip broken off)
    bs.moveTo(0.03, -0.018);
    bs.quadraticCurveTo(0.11, -0.05, tip, -0.04);
    bs.quadraticCurveTo(tip + 0.012, 0.0, tip - 0.01, 0.045);
    bs.quadraticCurveTo(0.1, 0.05, 0.03, 0.018);
    bs.closePath();
    const bg = new THREE.ShapeGeometry(bs, 8), BP = bg.attributes.position;
    for (let i = 0; i < BP.count; i++) BP.setZ(i, 0.008 * (BP.getY(i) / 0.05)); // (pitched)
    bg.computeVertexNormals();
    put(bg.rotateZ((k / 3) * Math.PI * 2 + 0.4), blade, fan).castShadow = false;
  }
  put(new THREE.CylinderGeometry(0.042, 0.044, 0.02, 32).rotateX(Math.PI / 2), std({ color: 0xd2cab2, roughness: 0.6 }), fan).castShadow = false; // the hub, pale
  // it turns slowly, on its own, never quite evenly; every so often, after no set time, it jams (fanJam). Only its speed is ever set:
  // sharp as a catch is, the blades never skip from one place to another
  fan.name = 'ac-fan';
  let angle = 0, jam = null, jamT = 0, next = 5 + Math.random() * 10;
  ctx.animated.push((t, dt) => {
    if (!dt) return;
    if (!jam && t > next) { jam = fanJam(Math.random); jamT = 0; }
    let speed = FAN_SPEED;
    if (jam) {
      jamT += dt;
      speed = fanJamSpeed(jam, jamT);
      if (speed === null) { speed = FAN_SPEED; jam = null; next = t + 4 + 30 * Math.random() ** 1.6; }
    }
    angle += speed * (1 + 0.05 * Math.sin(t * 0.7) + 0.03 * Math.sin(t * 1.9 + 1)) * dt;
    fan.rotation.z = -angle;
  });
  const wire = [], dome = (rr) => ZF + 0.004 + 0.016 * (1 - (rr / FR) ** 2);
  for (let rr = 0.035; rr <= FR + 0.001; rr += 0.019) wire.push(new THREE.TorusGeometry(rr, 0.0017, 4, Math.max(24, Math.round(rr * 300))).translate(FX, FY, dome(rr)));
  for (let k = 0; k < 8; k++) { // the spokes, bowed with the dome
    const a = (k / 8) * Math.PI * 2 + 0.2, pts = [];
    for (let j = 0; j <= 6; j++) { const rr = 0.03 + (j / 6) * (FR - 0.03); pts.push(new THREE.Vector3(FX + Math.cos(a) * rr, FY + Math.sin(a) * rr, dome(rr) + 0.002)); }
    wire.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.0021, 4));
  }
  for (const a of [0.25, 0.75, 1.25, 1.75]) wire.push(new THREE.BoxGeometry(0.032, 0.012, 0.003).translate(FR + 0.012, 0, 0).rotateZ(a * Math.PI).translate(FX, FY, ZF + 0.0025)); // its tabs, from its rim to the screws
  const grime = T.dirtyWireTex();
  put(merge(wire), std({ map: grime, color: 0xffffff, roughness: 0.75 }));
  // the brackets on the wall, and rubber pads between them and it; its pipes; its drain
  const iron = std({ map: T.rustyMetalTex(73), color: 0xa8a49a, metalness: 0.4, roughness: 0.8 }), rubber = std({ color: 0x151413, roughness: 0.9 });
  const WALLZ = -0.205;
  for (const bx of [-0.27, 0.27]) {
    for (const geo of [
      new THREE.BoxGeometry(0.03, 0.004, 0.33).translate(bx, -0.01, WALLZ + 0.165), new THREE.BoxGeometry(0.004, 0.03, 0.33).translate(bx + 0.013, -0.025, WALLZ + 0.165), // its arm, an angle
      new THREE.BoxGeometry(0.03, 0.32, 0.004).translate(bx, -0.17, WALLZ + 0.003), new THREE.BoxGeometry(0.004, 0.32, 0.03).translate(bx + 0.013, -0.17, WALLZ + 0.016), // up the wall
    ]) put(geo, iron, ac);
    const brace = put(new THREE.BoxGeometry(0.022, 0.004, 0.36).translate(0, 0, 0), iron, ac);
    brace.position.set(bx, -0.165, WALLZ + 0.14);
    brace.rotation.x = -Math.atan2(0.3, 0.26); // (from low on the wall up to the arm's front)
    for (const pz of [-0.08, 0.09]) put(new THREE.CylinderGeometry(0.014, 0.016, 0.011, 12).translate(bx, -0.0025, pz), rubber, ac); // (squashed a little under it)
  }
  const tape = std({ color: 0xa9a598, roughness: 0.85 });
  const pipe = new THREE.CatmullRomCurve3([[0.365, 0.08, -0.085], [0.41, 0.075, -0.1], [0.445, 0.02, -0.14], [0.45, -0.08, -0.18], [0.452, -0.14, -0.2]].map((v) => new THREE.Vector3(...v)));
  put(new THREE.TubeGeometry(pipe, 24, 0.019, 10), tape, ac);
  const cable = new THREE.CatmullRomCurve3([[0.365, 0.05, -0.06], [0.42, 0.04, -0.075], [0.47, -0.02, -0.12], [0.475, -0.1, -0.175], [0.473, -0.15, -0.199]].map((v) => new THREE.Vector3(...v)));
  put(new THREE.TubeGeometry(cable, 20, 0.004, 6), std({ color: 0x5e5c57, roughness: 0.7 }), ac);
  put(new THREE.CylinderGeometry(0.032, 0.034, 0.012, 20).rotateX(Math.PI / 2).translate(0.458, -0.142, WALLZ + 0.007), tape, ac); // where they go into the wall
  const drain = new THREE.CatmullRomCurve3([[-0.25, 0.01, 0.02], [-0.252, -0.04, 0.03], [-0.24, -0.1, 0.045], [-0.215, -0.13, 0.04]].map((v) => new THREE.Vector3(...v)));
  put(new THREE.TubeGeometry(drain, 16, 0.0065, 8), rubber, ac);
}

/**
 * The microwave on the worktop by the table, where the bread bin was (user, 2026-10-29, with a picture of one — its
 * look, not its print): old, in sage-green painted steel, its door's window in a black frame, its keys down the
 * right, a little green clock, vents in its left side, on four feet; a little askew, 5 cm off the wall. Worn like the cooker (T.cookerEnamelTex), but never rusting (user, 2026-10-29): the paint rubbed
 * paler at its edges and where the door is pushed shut, chipped to its undercoat, grime along its foot and round the
 * keys most pressed, its top faded and dusty. On it, left there (from his picture): a carton of biscuits, opened; a
 * box of tea bags; a jar of peanut butter, half eaten; a clear bag of flour, some of it spilt. Its front is +z of its
 * own; `zc`: its middle along the wall.
 */
function microwaveAt(g, M, wall, TOP, zc) {
  const mw = new THREE.Group();
  mw.position.set(wall + 0.23, TOP, zc);
  mw.rotation.y = Math.PI / 2 + deg(2); // (its front to the room, not quite square to the wall)
  g.add(mw);
  const put = (geo, m, parent = mw) => { const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const GREEN = [160, 176, 150], W = 0.47, X1 = W / 2, Y0 = 0.012, Y1 = 0.28, ZB = -0.18, ZF = 0.165, S = Y1 - Y0, D = ZF - ZB;
  const on = (x, z) => [S + x + X1, z - ZB]; // a place on its top, on the case's picture

  // the case, top and sides in one, its picture unfolded across them; four feet under it
  const marks = [[...on(-0.158, -0.064), 0.065, 'clean'], [...on(-0.15, -0.035), 0.05, 'slide'], [...on(-0.126, 0.079), 0.045, 'clean'], [...on(0.004, 0.062), 0.042, 'clean'],
    [...on(-0.032, 0.028), 0.041, 'ring'], [...on(0.112, -0.083), 0.07, 'clean'], [...on(0.122, -0.028), 0.05, 'flour'], [...on(0.062, 0.018), 0.022, 'flour'], [...on(0.17, 0.09), 0.038, 'ring']];
  put(uvBy(rbox(-X1, X1, Y0, Y1, ZB, ZF, 0.012), (p, n) => [(S + p.x + X1 + n.x * (Y1 - p.y)) / (2 * S + W), 1 - (p.z - ZB) / D]), enamel('mwShell', { W: 2 * S + W, H: D, side: S, base: GREEN, rustless: true, marks, dense: 1000, seed: 9371 }));
  for (const [x, z] of [[-0.19, -0.14], [0.19, -0.14], [-0.19, 0.13], [0.19, 0.13]]) mw.add(cyl(0.011, 0.012, Y0 + 0.002, M.blackPlastic, x, Y0 / 2, z, 12));

  // the door, its window: a black plastic frame round dark glass, the dish's dark beyond the screen in it
  const DX0 = -0.229, DX1 = 0.113, DY0 = 0.02, DY1 = 0.272, DZ = 0.186;
  put(front(rbox(DX0, DX1, DY0, DY1, 0.16, DZ, 0.006), DX0, DX1, DY0, DY1, DZ), enamel('mwDoor', { W: DX1 - DX0, H: DY1 - DY0, base: GREEN, rustless: true, dense: 1800, seed: 9381 }));
  const ring = (s, x0, y0, x1, y1, rr) => {
    s.moveTo(x0 + rr, y0); s.lineTo(x1 - rr, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rr); s.lineTo(x1, y1 - rr); s.quadraticCurveTo(x1, y1, x1 - rr, y1);
    s.lineTo(x0 + rr, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rr); s.lineTo(x0, y0 + rr); s.quadraticCurveTo(x0, y0, x0 + rr, y0);
    return s;
  };
  const frame = ring(new THREE.Shape(), -0.205, 0.05, 0.089, 0.245, 0.016);
  frame.holes.push(ring(new THREE.Path(), -0.187, 0.068, 0.071, 0.227, 0.01));
  put(new THREE.ExtrudeGeometry(frame, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelOffset: -0.001, bevelSegments: 2, curveSegments: 6 }).translate(0, 0, DZ - 0.0005), std({ color: 0x1a1a1a, roughness: 0.42 }));
  const pane = T.cookerGlassTex(0.264, 0.165, 0, 3313);
  put(front(new THREE.BoxGeometry(0.264, 0.165, 0.0075).translate(-0.058, 0.1475, DZ - 0.00225), -0.19, 0.074, 0.065, 0.23, DZ + 0.0015), std({ map: pane.map, roughness: 0.14 }));

  // the keys' side: the clock in its black window, the keys, the button that opens the door
  const PX0 = 0.117, PX1 = 0.229, PY0 = 0.02, PY1 = 0.272, PZ = 0.183;
  const keys = []; // x, y, width, height, label, how much it is pressed
  [['1', 0.6], ['2', 0.5], ['3', 0.75], ['4', 0.2], ['5', 0.3], ['6', 0.15], ['7', 0.15], ['8', 0.2], ['9', 0.15], ['POWER', 0.2], ['0', 0.8], ['CLOCK', 0.03]].forEach(([l, u], i) => keys.push([0.149 + (i % 3) * 0.024, 0.2 - Math.floor(i / 3) * 0.017, 0.02, 0.012, l, u]));
  keys.push([0.1495, 0.128, 0.044, 0.014, 'STOP', 0.7], [0.1965, 0.128, 0.044, 0.014, 'START', 1], [0.173, 0.062, 0.07, 0.026, 'OPEN', 0.9]);
  const onPanel = keys.map(([x, y, kw, kh, l, u]) => [x - PX0, PY1 - y, kw, kh, l, u]);
  put(front(rbox(PX0, PX1, PY0, PY1, 0.16, PZ, 0.004), PX0, PX1, PY0, PY1, PZ), enamel('mwPanel', { W: PX1 - PX0, H: PY1 - PY0, base: GREEN, rustless: true, keys: onPanel, dense: 2400, seed: 9391 }));
  put(merge(keys.map(([x, y, kw, kh]) => front(rbox(x - kw / 2, x + kw / 2, y - kh / 2, y + kh / 2, PZ - 0.003, PZ + 0.0035, 0.0025), PX0, PX1, PY0, PY1, PZ + 0.0035))), enamel('mwKeys', { W: PX1 - PX0, H: PY1 - PY0, base: [204, 196, 174], keys: onPanel, dense: 2400, seed: 9401 }));
  put(rbox(0.135, 0.211, 0.222, 0.256, PZ - 0.002, PZ + 0.0025, 0.003), std({ color: 0x121412, roughness: 0.25 }));
  const clock = T.cookerClockTex([null, 6, 0, 4], [150, 212, 142], 3701); // (the time, as on the cooker's and the PC's: user, 2026-10-29)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.0213), std({ map: clock, emissiveMap: clock, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.3 }));
  face.position.set(0.173, 0.239, PZ + 0.0037);
  face.receiveShadow = true;
  mw.add(face);

  // what was left on it, as it was put down (user, 2026-10-29: "too perfect" — nothing square to anything, handled)
  const top = (x, z, turn) => { const o = new THREE.Group(); o.position.set(x, Y1, z); o.rotation.y = deg(turn); mw.add(o); return o; };
  const add = (parent, o) => { o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  /** Set down on its lowest point (what is tipped rests on a corner, not in the top). */
  const settle = (o) => {
    mw.updateMatrixWorld(true);
    const inv = mw.matrixWorld.clone().invert(), v = new THREE.Vector3();
    let low = Infinity;
    o.traverse((m) => { if (!m.isMesh) return; const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i++) low = Math.min(low, v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv).y); });
    o.position.y += Y1 + 0.0005 - low;
  };
  /**
   * A carton from its print laid flat (T.cartonTex: front, right, back, left along the top row, its top under
   * them), handled: its sides bowed, one upright edge dented in halfway up (`crush`: which, ±1 ±1, and how far),
   * its foot pushed up at a corner (`foot`, the same), leaning a little (`lean` at its top).
   */
  const carton = (w, h, d, map, { crush = [1, 1, 0.008], foot = null, lean = 0.003 } = {}) => {
    const geo = new THREE.BoxGeometry(w, h, d, 4, 8, 3).translate(0, h / 2, 0), P = geo.attributes.position, N = geo.attributes.normal, uv = geo.attributes.uv, TW = 2 * (w + d), TH = h + d;
    for (let i = 0; i < P.count; i++) {
      const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
      const [ax, ay, aw, ah] = nx > 0.5 ? [w, 0, d, h] : nx < -0.5 ? [2 * w + d, 0, d, h] : Math.abs(ny) > 0.5 ? [0, h, w, d] : nz > 0.5 ? [0, 0, w, h] : [w + d, 0, w, h];
      uv.setXY(i, (ax + uv.getX(i) * aw) / TW, 1 - (ay + (1 - uv.getY(i)) * ah) / TH);
      let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const t = y / h, ex = x / (w / 2), ez = z / (d / 2);
      x += Math.sign(x) * 0.0022 * Math.sin(Math.PI * t) * (1 - ez * ez);
      z += Math.sign(z) * 0.003 * Math.sin(Math.PI * t) * (1 - ex * ex);
      const c = Math.max(0, 1 - Math.hypot(x / w - crush[0] * 0.5, z / d - crush[1] * 0.5, (y - h * 0.55) / (h * 0.3)) / 0.55);
      x -= crush[0] * crush[2] * 0.7 * c;
      z -= crush[1] * crush[2] * 0.7 * c;
      if (foot) { const f = Math.max(0, 1 - Math.hypot(x / w - foot[0] * 0.5, z / d - foot[1] * 0.5, y / (h * 0.35)) / 0.5); y += foot[2] * f; }
      P.setXYZ(i, x + lean * t, y, z);
    }
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, std({ map, roughness: 0.82 }));
  };
  /** A carton's flap, its free edge torn uneven, curling a little. */
  const flapGeo = (len, wid, seed, curl = 0.004) => {
    const r = mulberry32(seed), s = new THREE.Shape();
    s.moveTo(-wid / 2, 0);
    s.lineTo(wid / 2, 0);
    s.lineTo(wid / 2 - 0.002, len * (0.85 + r() * 0.15));
    for (let i = 7; i >= 1; i--) s.lineTo(-wid / 2 + (i / 8) * wid, len * (0.72 + r() * 0.28));
    s.lineTo(-wid / 2 + 0.002, len * (0.8 + r() * 0.2));
    s.closePath();
    const geo = new THREE.ShapeGeometry(s), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const f = P.getY(i) / len; P.setZ(i, curl * f * f + 0.0015 * Math.sin(P.getX(i) * 90) * f); }
    geo.computeVertexNormals();
    return geo;
  };
  const flapMat = std({ color: 0xc9bc9e, roughness: 0.88, side: THREE.DoubleSide });
  // the biscuits, pushed to the back on the left, turned: opened, its front flap torn short and bent out, the back
  // one folded in over it, a short one crooked, the other short one torn off
  const bw = 0.105, bh = 0.185, bd = 0.07, biscuits = top(-0.158, -0.064, 24);
  add(biscuits, carton(bw, bh, bd, T.cartonTex('biscuits', bw, bh, bd), { crush: [1, 1, 0.01], lean: 0.004 }));
  for (const [z, tilt, len, seed, curl] of [[bd / 2, 0.8, 0.026, 11, 0.006], [-bd / 2, 1.38, 0.033, 12, -0.005]]) {
    const f = add(biscuits, new THREE.Mesh(flapGeo(len, bw - 0.004, seed, curl), flapMat));
    f.position.set(0.002, bh - 0.001, z);
    f.rotation.x = tilt; // (round its hinge on the carton's edge)
  }
  const tuck = add(biscuits, new THREE.Mesh(flapGeo(0.024, bd * 0.85, 13, 0.003), flapMat));
  tuck.position.set(-bw / 2 + 0.002, bh - 0.001, 0);
  tuck.rotation.set(0, Math.PI / 2, 0.42, 'ZYX');
  // the tea bags, in front of it, turned the other way: its foot crushed at a corner, so it stands tipped; its
  // top's fin pulled open
  const tw = 0.075, th = 0.1, td = 0.055, tea = top(-0.126, 0.079, -33);
  add(tea, carton(tw, th, td, T.cartonTex('tea', tw, th, td), { crush: [1, -1, 0.004], foot: [-1, 1, 0.006], lean: -0.002 }));
  const roof = new THREE.Shape([new THREE.Vector2(-td / 2, th), new THREE.Vector2(td / 2, th), new THREE.Vector2(0.003, th + 0.023), new THREE.Vector2(-0.003, th + 0.023)]);
  const cream = std({ color: 0xc9bf9f, roughness: 0.85, side: THREE.DoubleSide });
  add(tea, new THREE.Mesh(new THREE.ExtrudeGeometry(roof, { depth: tw, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(tw / 2 - 0.002, -0.0015, 0), cream));
  for (const [s, open, seed] of [[-1, 0.15, 21], [1, 0.62, 22]]) { const fin = add(tea, new THREE.Mesh(flapGeo(0.013, tw - 0.006, seed, 0.002), cream)); fin.position.set(0, th + 0.021, s * 0.0024); fin.rotation.x = s * open; }
  tea.rotation.x = 0.045;
  tea.rotation.z = 0.03;
  settle(tea);
  // the peanut butter, nearer the front, its label turned half away, its lid put back on crooked and not screwed down
  const prof = [[0.036, 0], [0.0397, 0.004], [0.04, 0.01], [0.04, 0.086], [0.0385, 0.093], [0.0345, 0.098], [0.0338, 0.104]];
  const lens = [0];
  for (let i = 1; i < prof.length; i++) lens.push(lens[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const L = lens[lens.length - 1], pts = [];
  for (let j = 0; j <= 30; j++) { // (evenly along it, so the label's v is its height)
    const s = (j / 30) * L;
    let i = 1;
    while (i < prof.length - 1 && lens[i] < s) i++;
    const t = (s - lens[i - 1]) / (lens[i] - lens[i - 1]);
    pts.push(new THREE.Vector2(prof[i - 1][0] + (prof[i][0] - prof[i - 1][0]) * t, prof[i - 1][1] + (prof[i][1] - prof[i - 1][1]) * t));
  }
  const along = (y) => { let i = 1; while (i < prof.length - 1 && prof[i][1] < y) i++; const t = (y - prof[i - 1][1]) / (prof[i][1] - prof[i - 1][1]); return (lens[i - 1] + t * (lens[i] - lens[i - 1])) / L; };
  const jar = top(0.004, 0.062, 180 + 68);
  add(jar, new THREE.Mesh(new THREE.LatheGeometry(pts, 40), std({ map: T.jarLabelTex(along(0.014), along(0.08)), roughness: 0.32 })));
  const lidMat = std({ color: 0x66798a, roughness: 0.5 }), lid = new THREE.Group();
  lid.add(cyl(0.0372, 0.0375, 0.019, lidMat, 0, 0.0095, 0, 40));
  lid.add(new THREE.Mesh(new THREE.TorusGeometry(0.0372, 0.0012, 6, 40).rotateX(Math.PI / 2), lidMat));
  lid.position.set(0.0012, 0.0995, 0);
  lid.rotation.set(0.07, 0.4, 0.02);
  lid.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  jar.add(lid);
  // the flour, at the back on the right: a clear bag, the flour slumped in its foot, the bag gone over to one side and
  // its empty top folded back over itself, the plastic dusty with it inside
  const bag = top(0.112, -0.083, -9);
  const flour = new THREE.SphereGeometry(1, 22, 12), FP = flour.attributes.position; // (a slumped lump, flat under it)
  for (let i = 0; i < FP.count; i++) { const x = FP.getX(i), y = FP.getY(i), z = FP.getZ(i); FP.setXYZ(i, x * 0.062 * (1 + 0.05 * Math.sin(y * 5 + z * 4)), (Math.max(y, -0.35) + 0.35) * 0.05 * (1 - 0.25 * Math.max(0, x)) + 0.0005, z * 0.027); }
  flour.computeVertexNormals();
  add(bag, new THREE.Mesh(flour, std({ color: 0xd0cabd, roughness: 0.95 })));
  const bagAt = (x, y, z) => { // where a point of the bag, as made, ends up: leant over to the right, its top folded back
    const t = y / 0.175, s = THREE.MathUtils.smoothstep(t, 0.45, 0.95);
    let yy = y, zz = z * (1 - 0.9 * s) - 0.006 * s;
    const a = 1.15 * THREE.MathUtils.smoothstep(y, 0.098, 0.16);
    if (a > 0) { const dy = yy - 0.098, dz = zz + 0.003; yy = 0.098 + dy * Math.cos(a) + dz * Math.sin(a); zz = -0.003 - dy * Math.sin(a) + dz * Math.cos(a); }
    return [x * (1 - 0.05 * s) + 0.03 * s * s, yy + 0.001, zz];
  };
  const film = new THREE.BoxGeometry(0.142, 0.175, 0.062, 14, 22, 4), BP = film.attributes.position, dusty = [];
  for (let i = 0; i < BP.count; i++) {
    const x = BP.getX(i), y = BP.getY(i) + 0.0875, z = BP.getZ(i), t = y / 0.175;
    const crinkle = 0.0016 * Math.sin(x * 140 + y * 60) * Math.sin(y * 95 - x * 30) * (0.4 + t);
    BP.setXYZ(i, ...bagAt(x, y, z + crinkle * Math.sign(z || 1)));
    const f = Math.max(0, 1 - t / 0.6); // (flour clinging inside it, low down)
    dusty.push(0.94, 0.93, 0.9, 0.1 + 0.3 * f);
  }
  film.setAttribute('color', new THREE.Float32BufferAttribute(dusty, 4));
  film.computeVertexNormals();
  const filmMat = std({ color: 0xffffff, vertexColors: true, transparent: true, roughness: 0.14, side: THREE.DoubleSide, depthWrite: false });
  filmMat.forceSinglePass = true;
  const bagFilm = new THREE.Mesh(film, filmMat);
  bagFilm.receiveShadow = true;
  bag.add(bagFilm);
  const [zx, zy, zz] = bagAt(0, 0.172, 0); // its zip, at the folded top's end
  const zip = add(bag, new THREE.Mesh(rbox(-0.066, 0.066, -0.003, 0.003, -0.0035, 0.0035, 0.001), std({ color: 0x92abbd, roughness: 0.45 })));
  zip.position.set(zx, zy, zz);
  zip.rotation.x = -1.15;
  return mw;
}

/**
 * The socket the toaster and the microwave are plugged into (user, 2026-11-03): an old double one on the tiles between
 * them, its plate gone the yellow of old plastic, grimy round its edges and greasy where hands go for the plugs; not
 * quite level. The toaster's plug, black, straight, in the top; the microwave's, three-pinned, dirty white, its lead
 * out of its foot, in the bottom. Their leads down the tiles and over the worktop to the back of each, slack.
 * `wall`: the tiles' face; `zc`: its middle along the wall; `toaster`, `micro`: their groups.
 */
function wallSocket(g, M, wall, TOP, zc, toaster, micro) {
  const sk = new THREE.Group();
  sk.position.set(wall, TOP + 0.19, zc);
  sk.rotation.set(0, Math.PI / 2, deg(1.7)); // (its face to the room, its x along the wall towards −z)
  g.add(sk);
  const put = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; sk.add(o); return o; };
  const PW = 0.07, PH = 0.115;
  const plate = canvasTex(140, 230, (c, w, h) => {
    const r = mulberry32(6203);
    c.fillStyle = '#d4caaf'; // old plastic, gone a little yellow
    c.fillRect(0, 0, w, h);
    const blot = (x, y, rx, ry, rgba) => {
      const gr = c.createRadialGradient(x, y, 0, x, y, rx);
      gr.addColorStop(0, `rgba(${rgba})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = gr; c.fillRect(x - rx, y - rx, rx * 2, rx * 2); c.restore();
    };
    for (let i = 0; i < 26; i++) blot(r() * w, r() * h, 10 + r() * 30, 8 + r() * 24, r() < 0.7 ? '150,124,78,0.07' : '220,212,190,0.1'); // yellower here, paler there
    // grime in along its edges, most along the foot (what runs down the tiles stops there) and the wall side's
    for (let y = 0; y < h; y += 2) for (const [x, k] of [[0, 1], [w - 1, 0.7]]) { c.fillStyle = `rgba(84,66,40,${(0.05 + r() * 0.06) * k})`; c.fillRect(x - 3, y, 5 + r() * 3, 2); }
    let gr = c.createLinearGradient(0, h, 0, h - 26);
    gr.addColorStop(0, 'rgba(78,60,36,0.28)'); gr.addColorStop(1, 'rgba(78,60,36,0)');
    c.fillStyle = gr; c.fillRect(0, h - 26, w, 26);
    gr = c.createLinearGradient(0, 0, 0, 14);
    gr.addColorStop(0, 'rgba(78,60,36,0.14)'); gr.addColorStop(1, 'rgba(78,60,36,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, 14);
    // greasy fingers round the plugs, pulling them out and pushing them in: the lower one more (the toaster's is
    // left in; the microwave's comes out when the fuse goes)
    for (const [cy, n] of [[0.33, 5], [0.67, 8]]) for (let k = 0; k < n; k++) blot(w * (0.5 + (r() - 0.5) * 0.75), h * (cy + (r() - 0.5) * 0.22), 6 + r() * 7, 5 + r() * 5, `102,82,50,${0.07 + r() * 0.09}`);
    for (let k = 0; k < 2; k++) blot(w * (0.2 + r() * 0.6), h * (0.85 + r() * 0.1), 1.5 + r() * 1.5, 1.5 + r() * 1.5, '92,62,30,0.4'); // spatters, dried
    c.strokeStyle = 'rgba(70,56,40,0.14)'; c.lineWidth = 0.6; // a scratch or two
    for (let k = 0; k < 2; k++) { const x = r() * w, y = r() * h, a = r() * 6.3, l = 6 + r() * 14; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  });
  const ivory = std({ map: plate, roughness: 0.5 });
  const faceMat = std({ color: 0xbfb193, roughness: 0.45 }); // (the outlets' faces: the same plastic, less faded where the plate covered nothing)
  // the plate: a hair off the tiles (it sits on their glaze), its edges rounded, a chip out of its foot at the wall end
  const pg = rbox(-PW / 2, PW / 2, -PH / 2, PH / 2, 0.0006, 0.0066, 0.0024);
  const pp = pg.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
    const chip = Math.max(0, 1 - Math.hypot(x - 0.027, y + PH / 2) / 0.007); // (its corner knocked off, from below)
    pp.setXYZ(i, x - 0.0018 * chip * Math.sign(x), y + 0.0026 * chip, z - 0.0016 * chip * (z > 0.004 ? 1 : 0));
  }
  pg.computeVertexNormals();
  put(pg, ivory);
  // the outlets, through the plate, their faces a little proud of it; the screw between them, its slot turned as it was left
  for (const y of [0.0195, -0.0195]) put(rbox(-0.017, 0.017, y - 0.0155, y + 0.0155, 0.004, 0.0089, 0.005), faceMat);
  put(new THREE.CylinderGeometry(0.0038, 0.0042, 0.0016, 16).rotateX(Math.PI / 2).translate(0, 0, 0.0072), std({ color: 0x9a8f78, metalness: 0.6, roughness: 0.5 }));
  put(new THREE.BoxGeometry(0.0064, 0.0008, 0.0008).rotateZ(deg(38)).translate(0, 0, 0.0081), std({ color: 0x2a2620, roughness: 0.8 }));
  // the plugs, home in their outlets: the toaster's black and straight, its lead out of its back; the microwave's a
  // flat one, dirty white, its lead out of its foot
  const black = M.rubber, white = std({ color: 0xb4ab98, roughness: 0.55 });
  put(rbox(-0.0125, 0.0125, 0.0195 - 0.0115, 0.0195 + 0.0115, 0.0089, 0.027, 0.004), black);
  put(new THREE.CylinderGeometry(0.0034, 0.0046, 0.012, 12).rotateX(Math.PI / 2).translate(0, 0.0195, 0.032), black); // (the sleeve the lead comes out of)
  put(rbox(-0.0155, 0.0155, -0.0195 - 0.0165, -0.0195 + 0.0125, 0.0089, 0.0235, 0.005), white);
  put(new THREE.CylinderGeometry(0.0046, 0.0036, 0.011, 12).translate(0.002, -0.0195 - 0.0205, 0.017), white);
  sk.updateMatrixWorld(true);
  toaster.updateMatrixWorld(true);
  micro.updateMatrixWorld(true);
  const at = (o, x, y, z) => g.worldToLocal(o.localToWorld(new THREE.Vector3(x, y, z))).toArray();
  const lie = TOP + 0.0034; // (on the worktop)
  // the toaster's: out of the plug, down the tiles in a slack curve, over the worktop and in under the back of its base
  g.add(cable([
    at(sk, 0, 0.0195, 0.037), at(sk, 0.001, 0.012, 0.047), at(sk, 0.004, -0.03, 0.05), at(sk, 0.008, -0.11, 0.04), at(sk, 0.012, -0.175, 0.045),
    [wall + 0.05, lie, zc + 0.02], [wall + 0.075, lie, zc - 0.035], at(toaster, -0.128, 0, -0.118), at(toaster, -0.1, 0, -0.098), at(toaster, -0.09, 0.006, -0.079),
  ], 0.0032, black, { floor: TOP }));
  // the microwave's: out of the back of its case, down behind it, along the worktop out past its end, up to the plug
  g.add(cable([
    at(micro, 0.17, 0.05, -0.181), at(micro, 0.185, 0.02, -0.196), at(micro, 0.2, 0, -0.207), at(micro, 0.255, 0, -0.205),
    at(sk, -0.02, -0.19, 0.03), at(sk, -0.004, -0.16, 0.022), at(sk, 0.004, -0.1, 0.024), at(sk, 0.002, -0.058, 0.018), at(sk, 0.002, -0.0465, 0.017),
  ], 0.0035, white, { floor: TOP }));
}

/**
 * A freestanding gas cooker in cream enamel (user, 2026-10-29, with a photo of an old one — its shape and its wear,
 * not its name: nothing is written on it): four burners in burnt-on rings under two cast-iron grates; a panel with
 * a timer knob, two orange lamps, a little blue clock in a black bezel with four buttons under it, and five knobs —
 * the oven's, then one to each burner; the oven door's black-bordered window and its long ivory handle across the
 * top; a drawer at its foot; all of it worn like the photo's (T.cookerEnamelTex). Each burner's knob turns it on
 * and off (user, 2026-10-15), lighting a ring of blue gas flame under the grate; the oven's lights the lamp behind
 * the glass and the left orange lamp, and the right one, the thermostat's, which then goes off and on by itself for
 * as long as the oven is left on.
 */
function cookerAt(g, M, mat, ctx, a, b, TOP, DEEP) {
  // where it all is: 2 mm off the cupboard on its left, 4 off the one on its right (never dead in the middle of
  // its gap); its hob 1.5 cm under the worktops; the door's face 1.5 cm proud of the cupboard doors
  const X0 = a + 0.002, X1 = b - 0.004, XM = (a + b) / 2, ZB = 0.03, ZF = 0.6, ZP = 0.615, ZD = DEEP + 0.015, YH = 0.905;
  const put = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; g.add(o); return o; };

  // the body, on four feet
  put(front(rbox(X0, X1, 0.02, 0.88, ZB, ZF, 0.006), X0, X1, 0, 0.9, ZF), enamel('body', { W: X1 - X0, H: 0.9, seed: 9311 }));
  for (const [x, z] of [[X0 + 0.035, 0.07], [X1 - 0.035, 0.07], [X0 + 0.035, 0.56], [X1 - 0.035, 0.56]]) g.add(cyl(0.012, 0.013, 0.02, M.blackPlastic, x, 0.01, z, 12));

  // the burners, in the knobs' order (back left, front left, front right, back right): x, z, the crown's radius,
  // how much it is used — the big one front right most, the small one at the back right hardly
  const burners = [[a + 0.15, 0.19, 0.036, 0.55], [a + 0.15, 0.465, 0.027, 0.8], [a + 0.45, 0.465, 0.044, 1], [a + 0.45, 0.19, 0.031, 0.3]];
  // the grates: one each side, a frame on six feet, a bar across between its two burners, four fingers in towards
  // each where the pan sits; neither quite square on the hob, the gap between them not even
  const ZM = (burners[0][1] + burners[1][1]) / 2, GZ0 = 0.045, GZ1 = 0.61, B = 0.014, F = 0.012;
  const G0 = YH + 0.031, G1 = YH + 0.045, G2 = YH + 0.048; // the frame's foot and top, the fingers' tops
  const grates = [], feet = [];
  for (const [gx0, gx1, turn, dx, dz] of [[X0 + 0.008, XM - 0.003, 0.4, 0.0005, -0.0015], [XM + 0.003, X1 - 0.008, 0.25, -0.001, 0.001]]) {
    const pieces = [], bar = (x0, x1, z0, z1, y1 = G1) => pieces.push(rbox(x0, x1, G0, y1, z0, z1, 0.0035));
    bar(gx0, gx1, GZ0, GZ0 + B);
    bar(gx0, gx1, GZ1 - B, GZ1);
    bar(gx0, gx0 + B, GZ0, GZ1);
    bar(gx1 - B, gx1, GZ0, GZ1);
    bar(gx0, gx1, ZM - B / 2, ZM + B / 2);
    const legs = [[gx0 + 0.007, GZ0 + 0.007], [gx1 - 0.007, GZ0 + 0.007], [gx0 + 0.007, GZ1 - 0.007], [gx1 - 0.007, GZ1 - 0.007], [gx0 + 0.007, ZM], [gx1 - 0.007, ZM]];
    for (const [x, z] of legs) pieces.push(new THREE.CylinderGeometry(0.006, 0.007, G0 + 0.002 - (YH - 0.001), 10).translate(x, (G0 + 0.002 + YH - 0.001) / 2, z));
    for (const [bx, bz, rc] of burners) {
      if (bx < gx0 || bx > gx1) continue;
      const re = rc + 0.016, c0 = bz < ZM ? GZ0 + B : ZM + B / 2, c1 = bz < ZM ? ZM - B / 2 : GZ1 - B; // (its cell, inside the frame)
      bar(gx0 + B - 0.002, bx - re, bz - F / 2, bz + F / 2, G2);
      bar(bx + re, gx1 - B + 0.002, bz - F / 2, bz + F / 2, G2);
      bar(bx - F / 2, bx + F / 2, c0 - 0.002, bz - re, G2);
      bar(bx - F / 2, bx + F / 2, bz + re, c1 + 0.002, G2);
    }
    const cx = (gx0 + gx1) / 2, cz = (GZ0 + GZ1) / 2;
    const m = new THREE.Matrix4().makeTranslation(cx + dx, 0, cz + dz).multiply(new THREE.Matrix4().makeRotationY(deg(turn))).multiply(new THREE.Matrix4().makeTranslation(-cx, 0, -cz));
    for (const geo of pieces) grates.push(geo.applyMatrix4(m));
    for (const [x, z] of legs) { const v = new THREE.Vector3(x, 0, z).applyMatrix4(m); feet.push([v.x, v.z]); }
  }
  // the hob, its picture seen from above (the back at its top), folded down over its front edge
  const HX0 = X0 - 0.001, HX1 = X1 + 0.001, HZ1 = DEEP + 0.002, HW = HX1 - HX0, HD = HZ1 - ZB;
  const hob = enamel('hob', { W: HW, H: HD, burners: burners.map(([x, z, rc, use]) => [x - HX0, z - ZB, rc + 0.017, use]), feet: feet.map(([x, z]) => [x - HX0, z - ZB]), seed: 9321 });
  put(uvBy(rbox(HX0, HX1, 0.879, YH, ZB, HZ1, 0.006), (p, n) => [(p.x - HX0 - n.x * (YH - p.y)) / HW, (HZ1 - p.z + n.z * (YH - p.y)) / HD]), hob);
  const iron = std({ map: T.cookerGrateTex(HW, HD, burners.map(([x, z, rc, use]) => [x - HX0, z - ZB, rc + 0.016, use])), roughness: 0.75, metalness: 0.25 });
  for (const geo of grates) put(uvBy(geo, (p) => [(p.x - HX0) / HW, (HZ1 - p.z) / HD]), iron);
  // each burner: an aluminium cup sat in the hob, the crown with its ports round the top, a black enamel cap a
  // little domed on it (the back right one not put back quite right: tipped onto the crown's edge)
  const alu = std({ color: 0x7c7870, metalness: 0.5, roughness: 0.6 }), capBlack = std({ color: 0x1c1a19, roughness: 0.38 });
  const flames = [];
  burners.forEach(([x, z, rc], i) => {
    const n = Math.round((18 * (rc + 0.001)) / 0.04);
    g.add(cyl(rc + 0.014, rc + 0.017, 0.008, alu, x, YH + 0.003, z, 32));
    g.add(cyl(rc, rc, 0.012, std({ map: T.burnerCrownTex(n), metalness: 0.45, roughness: 0.62 }), x, YH + 0.013, z, 32));
    const cap = new THREE.Group();
    cap.add(cyl(rc + 0.001, rc + 0.001, 0.004, capBlack, 0, 0, 0, 32));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(rc + 0.001, 32, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.16, 1), capBlack);
    dome.position.y = 0.002;
    dome.castShadow = dome.receiveShadow = true;
    cap.add(dome);
    cap.position.set(x, YH + 0.021, z);
    if (i === 3) { cap.position.x += 0.0015; cap.position.y += 0.0015; cap.rotation.z = deg(2.5); }
    g.add(cap);
    const flame = gasFlame(rc + 0.001, n);
    flame.position.set(x, YH + 0.016, z);
    flame.visible = false;
    g.add(flame);
    flames.push(flame);
  });

  // the panel: the print (T.cookerEnamelTex), the clock, the lamps, the knobs
  const PX0 = X0 + 0.001, PX1 = X1 - 0.001, PY0 = 0.68, PY1 = 0.882, KY = 0.775, ICON = 0.848, KR = 0.02;
  const knobX = [0, 1, 2, 3, 4].map((i) => a + 0.235 + i * 0.07), timer = [a + 0.07, ICON, 0.012], lampX = [a + 0.135, a + 0.168];
  const use = [0.5, 0.55, 0.8, 1, 0.3], corners = [null, 'bl', 'fl', 'fr', 'br']; // (the oven's knob, then the burners')
  const panel = enamel('panel', { W: PX1 - PX0, H: PY1 - PY0, seed: 9331, icons: PY1 - ICON, timer: [timer[0] - PX0, PY1 - timer[1], timer[2]], knobs: knobX.map((x, i) => [x - PX0, PY1 - KY, KR, use[i], corners[i]]) });
  put(front(rbox(PX0, PX1, PY0, PY1, 0.588, ZP, 0.005), PX0, PX1, PY0, PY1, ZP), panel);
  g.add(soft(a + 0.03, a + 0.155, 0.728, 0.802, 0.606, ZP + 0.003, 0.004, std({ color: 0x141414, roughness: 0.3 }))); // the clock's bezel
  const clock = T.cookerClockTex();
  // the time in the middle of its bezel, soft (user, 2026-10-29), under a window of scuffed, milky plastic
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.03), std({ map: clock, emissiveMap: clock, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.2 }));
  face.position.set(a + 0.0925, 0.765, ZP + 0.0042); // (clear of its bezel's face: half a millimetre flickered)
  face.receiveShadow = true;
  g.add(face);
  const cover = std({ map: T.clockCoverTex(), transparent: true, depthWrite: false, roughness: 0.28 });
  put(front(rbox(a + 0.0425, a + 0.1425, 0.745, 0.785, ZP + 0.003, ZP + 0.0062, 0.0015), a + 0.0425, a + 0.1425, 0.745, 0.785, ZP + 0.0062), cover).castShadow = false; // (see-through: no shadow)
  const button = std({ color: 0x2c2c2e, roughness: 0.5 });
  for (let i = 0; i < 4; i++) g.add(soft(a + 0.044 + i * 0.025, a + 0.056 + i * 0.025, 0.733, 0.7405, ZP, ZP + 0.0055, 0.0015, button));
  const lamps = lampX.map((x) => { // orange, unlit until the oven is on
    const m = std({ color: 0xd6721e, roughness: 0.32, emissive: 0xff5a0a, emissiveIntensity: 0 });
    const lens = put(merge([
      new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 20).rotateX(Math.PI / 2).translate(0, 0, 0.001),
      new THREE.SphereGeometry(0.0065, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.4).translate(0, 0, 0.003),
    ]).translate(x, ICON, ZP), m);
    lens.userData.live = true;
    return m;
  });
  // the knobs: cream plastic gone yellow, a grip across each, its mark; none left quite straight; the back right
  // burner's a spare, not as yellowed as the rest
  const cream = std({ color: 0xd3c9ac, roughness: 0.48 }), spare = std({ color: 0xdcd7c8, roughness: 0.42 }), mark = std({ color: 0x3a3733, roughness: 0.6 });
  const knob = (x, y, r0, m, rest) => {
    const k = new THREE.Group();
    const shell = merge([ // (one piece: a knob turns, so it is never baked into the room)
      new THREE.CylinderGeometry(r0 + 0.002, r0 + 0.003, 0.005, 28).rotateX(Math.PI / 2).translate(0, 0, 0.0025), // its skirt, against the panel
      new THREE.CylinderGeometry(r0 * 0.93, r0, 0.014, 28).rotateX(Math.PI / 2).translate(0, 0, 0.012),
      new THREE.SphereGeometry(r0 * 0.93, 24, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.22).translate(0, 0, 0.019),
      new RoundedBoxGeometry(0.0084, r0 * 1.72, 0.0115, 3, 0.003).translate(0, 0, 0.02275), // the grip across it
    ]);
    for (const o of [new THREE.Mesh(shell, m), box(0.0014, r0 * 0.55, 0.0012, mark, 0, r0 * 0.5, 0.0287)]) { o.castShadow = o.receiveShadow = true; k.add(o); }
    k.position.set(x, y, ZP);
    k.rotation.z = deg(rest);
    g.add(k);
    return k;
  };
  const rests = [2, -3, 1, 4, -2];
  const knobs = knobX.map((x, i) => knob(x, KY, KR, i === 4 ? spare : cream, rests[i]));
  knob(timer[0], timer[1], timer[2], cream, 6); // the timer, a little past where it ran down
  knobs.slice(1).forEach((k, i) => {
    let on = false;
    const rest = k.rotation.z;
    k.userData.interact = {
      label: () => (on ? 'Turn the burner off' : 'Turn the burner on'),
      use: () => {
        on = !on;
        k.rotation.z = rest + (on ? deg(95) : 0);
        flames[i].visible = on;
        ctx.sound.sample(on ? 'cooker-on' : 'cooker-off', k.position); // silent until there is a recording
      },
    };
    ctx.interact.push(k);
  });

  // the oven door: a frame round its window, the glass set 4 mm back in it, the handle across the top
  const DX0 = a + 0.004, DW = 0.59, DY0 = 0.17, DH = 0.505, HOLE = [0.04, 0.085, DW - 0.04, 0.44], bev = 0.004;
  const outline = (s, x0, y0, x1, y1, rr) => {
    s.moveTo(x0 + rr, y0);
    s.lineTo(x1 - rr, y0);
    s.quadraticCurveTo(x1, y0, x1, y0 + rr);
    s.lineTo(x1, y1 - rr);
    s.quadraticCurveTo(x1, y1, x1 - rr, y1);
    s.lineTo(x0 + rr, y1);
    s.quadraticCurveTo(x0, y1, x0, y1 - rr);
    s.lineTo(x0, y0 + rr);
    s.quadraticCurveTo(x0, y0, x0 + rr, y0);
    return s;
  };
  const shape = outline(new THREE.Shape(), 0, 0, DW, DH, 0.01);
  shape.holes.push(outline(new THREE.Path(), ...HOLE, 0.014));
  const doorGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.035 - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 3, curveSegments: 8 }).translate(DX0, DY0, ZD - 0.035 + bev);
  const yc = 0.645, zc = ZD + 0.033; // the handle's middle (the towel hangs over it: kitchen())
  put(front(doorGeo, DX0, DX0 + DW, DY0, DY0 + DH, ZD), enamel('door', { W: DW, H: DH, hole: [HOLE[0], DH - HOLE[3], HOLE[2], DH - HOLE[1]], handle: DY0 + DH - yc, seed: 9341 }));
  const GX0 = DX0 + HOLE[0] - 0.004, GX1 = DX0 + HOLE[2] + 0.004, GY0 = DY0 + HOLE[1] - 0.004, GY1 = DY0 + HOLE[3] + 0.004;
  const pane = T.cookerGlassTex(GX1 - GX0, GY1 - GY0, 0.026);
  const glass = std({ map: pane.map, roughness: 0.14, emissive: 0xffb36b, emissiveMap: pane.glow, emissiveIntensity: 0 });
  put(front(new THREE.BoxGeometry(GX1 - GX0, GY1 - GY0, 0.02).translate((GX0 + GX1) / 2, (GY0 + GY1) / 2, ZD - 0.014), GX0, GX1, GY0, GY1, ZD - 0.004), glass);
  const HA = a + 0.024, HB = b - 0.028, ivory = enamel('handle', { W: HB - HA, H: 0.024, seed: 9351 });
  put(front(rbox(HA, HB, yc - 0.012, yc + 0.012, zc - 0.01, zc + 0.01, 0.009), HA, HB, yc - 0.012, yc + 0.012, zc + 0.01), ivory);
  for (const [x0, x1] of [[HA, HA + 0.024], [HB - 0.024, HB]]) put(front(rbox(x0, x1, yc - 0.0105, yc + 0.0105, ZD - 0.003, zc, 0.006), HA, HB, yc - 0.012, yc + 0.012, zc + 0.01), ivory); // its feet, into the door
  let ovenOn = false, since = null;
  const oven = knobs[0], ovenRest = oven.rotation.z;
  oven.userData.interact = {
    label: () => (ovenOn ? 'Turn the oven off' : 'Turn the oven on'),
    use: () => {
      ovenOn = !ovenOn;
      since = null;
      oven.rotation.z = ovenRest - (ovenOn ? deg(120) : 0);
      lamps[0].emissiveIntensity = ovenOn ? 0.9 : 0;
      if (!ovenOn) lamps[1].emissiveIntensity = 0;
      glass.emissiveIntensity = ovenOn ? 0.5 : 0;
      ctx.sound.sample(ovenOn ? 'cooker-on' : 'cooker-off', oven.position); // silent until there is a recording
    },
  };
  ctx.interact.push(oven);

  // the drawer at its foot: its front bowed out, a hollow along its top to take hold of it by
  const prof = new THREE.Shape(); // (x here is z in the room, y is y)
  prof.moveTo(0.585, 0.025);
  prof.lineTo(0.62, 0.025);
  prof.quadraticCurveTo(0.632, 0.03, 0.633, 0.07);
  prof.quadraticCurveTo(0.634, 0.112, 0.627, 0.127);
  prof.quadraticCurveTo(0.611, 0.138, 0.616, 0.152);
  prof.quadraticCurveTo(0.619, 0.158, 0.627, 0.158);
  prof.lineTo(0.627, 0.162);
  prof.lineTo(0.585, 0.162);
  prof.closePath();
  const RX0 = X0 + 0.003, RX1 = X1 - 0.003, bd = 0.002;
  const drawerGeo = new THREE.ExtrudeGeometry(prof, { depth: RX1 - RX0 - 2 * bd, bevelEnabled: true, bevelThickness: bd, bevelSize: bd, bevelOffset: -bd, bevelSegments: 2, curveSegments: 10 }).rotateY(-Math.PI / 2);
  drawerGeo.computeBoundingBox();
  drawerGeo.translate(RX0 - drawerGeo.boundingBox.min.x, 0, 0);
  put(uvBy(drawerGeo, (p) => [(p.x - RX0) / (RX1 - RX0), (p.y - 0.025) / 0.137]), enamel('drawer', { W: RX1 - RX0, H: 0.137, groove: [0.162 - 0.152, 0.162 - 0.126], seed: 9361 }));

  // the flames never still: each tongue of them rising and falling on its own; the thermostat's lamp on while the
  // oven heats, then off and on by itself
  ctx.animated.push((t) => {
    for (const f of flames) {
      if (!f.visible) continue;
      f.children.forEach((c, k) => { c.scale.y = 0.85 + 0.25 * Math.sin(t * 23 + k * 2.3) * Math.sin(t * 9.7 + k); });
    }
    if (!ovenOn) return;
    if (since === null) since = t;
    const s = t - since;
    lamps[1].emissiveIntensity = s < 40 || (s - 40) % 24 > 15 ? 0.9 : 0;
  });
  // the hood over it, brushed steel
  g.add(soft(a - 0.02, b + 0.02, 1.62, 1.8, 0, 0.5, 0.01, mat.brushed));
  g.add(slab(a + 0.12, b - 0.12, 1.8, TOP_WALL, 0.05, 0.3, mat.brushed));
}
const TOP_WALL = 2.5;

/**
 * A gas burner's flame: a ring of `n` small blue tongues out of the ports under the cap, `rad` out from the
 * middle, leaning out and up, each with a paler core. Centred on 0, at the height of the ports.
 */
function gasFlame(rad = 0.039, n = 18) {
  const g = new THREE.Group();
  g.userData.live = true; // it comes and goes: never baked into the room
  const outer = new THREE.MeshBasicMaterial({ color: 0x3f63e8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const inner = new THREE.MeshBasicMaterial({ color: 0x9ec4ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const tongue = new THREE.ConeGeometry(0.0045, 0.018, 8, 1, true).translate(0, 0.009, 0);
  const core = new THREE.ConeGeometry(0.0022, 0.009, 6, 1, true).translate(0, 0.0045, 0);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, at = new THREE.Group();
    at.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
    at.rotation.set(0, -a, 0);
    const lean = new THREE.Group();
    lean.rotation.z = -0.55; // out from the burner
    for (const [geo, m] of [[tongue, outer], [core, inner]]) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.renderOrder = 3;
      lean.add(mesh);
    }
    at.add(lean);
    g.add(at);
  }
  return g;
}

/**
 * The fridge: white gone cream, rounded, freezer over fridge, long handles, a grille at its foot, a drawing
 * on the door. Both doors open (user, 2026-10-15), hinged on the right by the wall, 88° at most (any more
 * and the door would go into the bedroom's wall). Inside, a white plastic liner; in the fridge two wire
 * shelves, a crisper drawer, a little lamp at the top that comes on as the door opens (its light shadowed,
 * so it lights the inside and spills out of the front, nowhere else), not much on the shelves, bins in the
 * door; in the freezer frost, an ice tray, a box, a tub. Returns { doors, segs, light }: the doors to swing
 * like the house's (state, apply, lights), their leaves as segment colliders, the lamp.
 */
function fridgeAt(g, M, mat, ctx, x0, x1, deep) {
  const Tk = 0.035, front = deep - 0.04, H = 1.78, SPLIT = [1.235, 1.275];
  const add = (parent, mesh) => { mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; };
  const liner = std({ color: 0xd8d4ca, roughness: 0.5 }), frost = std({ color: 0xd2d9dc, roughness: 0.85 });
  const wire = std({ color: 0xcfcbc1, roughness: 0.45 });
  // the cabinet: sides, top and base rounded, the back, the shelf between freezer and fridge
  add(g, soft(x0, x0 + Tk, 0, H, 0.02, front, 0.012, mat.enamel));
  add(g, soft(x1 - Tk, x1, 0, H, 0.02, front, 0.012, mat.enamel));
  add(g, soft(x0, x1, H - Tk, H, 0.02, front, 0.012, mat.enamel));
  add(g, soft(x0, x1, 0, 0.12, 0.02, front, 0.012, mat.enamel));
  add(g, slab(x0 + Tk, x1 - Tk, 0.12, H - Tk, 0.02, 0.04, liner));
  add(g, slab(x0 + Tk, x1 - Tk, SPLIT[0], SPLIT[1], 0.04, front, faces(liner, { pz: mat.enamel })));
  g.add(slab(x0 + 0.03, x1 - 0.03, 0.02, 0.1, front, front + 0.004, std({ map: T.grilleTex(), roughness: 0.6 })));
  // the liner over the inside faces: white plastic in the fridge, frosted in the freezer
  const ix0 = x0 + Tk + 0.003, ix1 = x1 - Tk - 0.003;
  for (const [y0, y1, m] of [[0.12, SPLIT[0], liner], [SPLIT[1], H - Tk, frost]]) {
    add(g, slab(x0 + Tk, ix0, y0, y1, 0.04, front, m));
    add(g, slab(ix1, x1 - Tk, y0, y1, 0.04, front, m));
    add(g, slab(ix0, ix1, y1 - 0.003, y1, 0.04, front, m));
    add(g, slab(ix0, ix1, y0, y0 + 0.003, 0.04, front, m));
    add(g, slab(ix0, ix1, y0, y1, 0.04, 0.043, m));
  }
  const cx = (x0 + x1) / 2, sz0 = 0.06, sz1 = deep - 0.135; // shelves stop short of the door's bins
  // wire shelves: a frame and the wires front to back
  const shelf = (y) => {
    for (const z of [sz0, sz1]) add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, ix1 - ix0, 8).rotateZ(Math.PI / 2), wire)).position.set(cx, y, z);
    for (let i = 0; i <= 18; i++) add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, sz1 - sz0, 6).rotateX(Math.PI / 2), wire)).position.set(ix0 + 0.01 + (i / 18) * (ix1 - ix0 - 0.02), y + 0.004, (sz0 + sz1) / 2);
  };
  for (const y of [0.52, 0.87]) shelf(y);
  // the crisper: a drawer at the foot, its front frosted, a shelf over it
  add(g, soft(ix0 + 0.01, ix1 - 0.01, 0.13, 0.33, sz1 - 0.012, sz1, 0.006, std({ color: 0xc4ccc8, roughness: 0.35 })));
  add(g, slab(ix0 + 0.01, ix1 - 0.01, 0.13, 0.135, sz0, sz1, liner));
  add(g, slab(ix0, ix1, 0.345, 0.352, sz0, sz1 + 0.01, std({ color: 0xb9c6c2, roughness: 0.12 })));
  // the lamp: a little ribbed cover under the freezer's floor, at the back; its light, shadowed
  const glow = std({ color: 0xe6e0d2, roughness: 0.4, emissive: 0xfff1d6, emissiveIntensity: 0 });
  add(g, soft(cx - 0.05, cx + 0.05, SPLIT[0] - 0.03, SPLIT[0], 0.1, 0.17, 0.008, glow));
  const light = new THREE.PointLight(0xfff0d8, 0, 1.25, 2);
  light.position.set(cx, SPLIT[0] - 0.06, 0.24);
  light.castShadow = true;
  light.shadow.mapSize.set(256, 256);
  light.shadow.camera.near = 0.02;
  light.shadow.camera.far = 1.25;
  light.shadow.bias = -0.002;
  light.shadow.normalBias = 0.008;
  light.shadow.autoUpdate = false;
  g.add(light);
  // what is in it: not much
  const thing = (geo, color, x, y, z, rough = 0.5) => {
    const m = add(g, new THREE.Mesh(geo, std({ color, roughness: rough })));
    m.position.set(x, y, z);
    return m;
  };
  thing(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 20), 0x6f7d3a, ix0 + 0.09, 0.874 + 0.065, 0.17, 0.2); // a jar of gherkins
  thing(new THREE.CylinderGeometry(0.047, 0.047, 0.012, 20), 0x8a8a86, ix0 + 0.09, 0.874 + 0.136, 0.17, 0.4); // its lid
  thing(new THREE.CylinderGeometry(0.1, 0.085, 0.07, 24), 0xc9c4b8, cx + 0.07, 0.874 + 0.035, 0.3, 0.6); // a bowl of leftovers…
  thing(new THREE.CylinderGeometry(0.104, 0.104, 0.008, 24), 0xa9acb0, cx + 0.07, 0.874 + 0.074, 0.3, 0.35); // …under foil
  for (const [dx, dz, c] of [[0, 0, 0xe9e3d6], [0.065, 0.01, 0xe9e3d6], [0.03, 0.07, 0xd9a3b0]]) { // yogurts
    thing(new THREE.CylinderGeometry(0.03, 0.026, 0.07, 14), 0xddd8cc, ix0 + 0.1 + dx, 0.524 + 0.035, 0.38 + dz, 0.5);
    thing(new THREE.CylinderGeometry(0.031, 0.031, 0.003, 14), c, ix0 + 0.1 + dx, 0.524 + 0.0715, 0.38 + dz, 0.3);
  }
  thing(new THREE.BoxGeometry(0.11, 0.05, 0.075), 0xe6d48a, ix1 - 0.12, 0.524 + 0.025, 0.2, 0.6); // butter, in its paper
  // the freezer: frost, an ice tray, a box of something, a tub
  thing(new THREE.BoxGeometry(0.28, 0.03, 0.11), 0xd6dde0, cx - 0.1, SPLIT[1] + 0.018, 0.33, 0.3);
  thing(new THREE.BoxGeometry(0.22, 0.06, 0.15), 0x3a5e8a, cx + 0.14, SPLIT[1] + 0.033, 0.25, 0.6);
  thing(new THREE.CylinderGeometry(0.075, 0.07, 0.11, 20), 0xe2d9c4, cx - 0.08, SPLIT[1] + 0.088, 0.16, 0.5);

  // ---- the doors, each on its hinge at the front right corner (the wall side)
  const doors = [], segs = [], A = new THREE.Vector3(), Bv = new THREE.Vector3();
  const makeDoor = (y0, y1, label, bins) => {
    const W = x1 - x0 - 0.01;
    const hinge = new THREE.Group();
    hinge.position.set(x1 - 0.005, 0, deep);
    hinge.userData.live = true;
    g.add(hinge);
    add(hinge, soft(-W, 0, y0, y1, -0.04, 0, 0.02, mat.enamel));
    add(hinge, slab(-W + 0.02, -0.02, y0 + 0.02, y1 - 0.02, -0.046, -0.04, liner)); // its inside, white plastic
    // the handle, along its free edge
    const [h0, h1] = y1 > 1.3 ? [1.32, 1.6] : [0.7, 1.18];
    add(hinge, soft(-W + 0.035, -W + 0.06, h0, h1, 0, 0.035, 0.008, M.knob));
    // bins on its inside: a floor and a front lip each
    for (const by of bins) {
      add(hinge, slab(-W + 0.045, -0.04, by, by + 0.006, -0.125, -0.046, liner));
      add(hinge, slab(-W + 0.045, -0.04, by, by + 0.07, -0.13, -0.124, liner));
    }
    const seg = { type: 'seg', ax: 0, az: 0, bx: 0, bz: 0, r: 0.03, base: y0, top: y1 };
    segs.push(seg);
    const door = {
      state: { angle: 0, target: 0 },
      lights: [],
      apply() {
        hinge.rotation.y = this.state.angle;
        hinge.updateMatrixWorld(true);
        hinge.localToWorld(A.set(0, 0, -0.02));
        hinge.localToWorld(Bv.set(-W, 0, -0.02));
        Object.assign(seg, { ax: A.x, az: A.z, bx: Bv.x, bz: Bv.z });
        this.after?.();
      },
    };
    hinge.userData.interact = {
      label: () => `${door.state.target > 0.5 ? 'Close' : 'Open'} the ${label}`,
      use: () => {
        const opening = door.state.target < 0.5;
        door.state.target = opening ? deg(88) : 0;
        ctx.sound.sample(opening ? 'fridge-open' : 'fridge-close', hinge.getWorldPosition(new THREE.Vector3()));
      },
    };
    ctx.interact.push(hinge);
    door.apply();
    doors.push(door);
    return { hinge, door, W };
  };
  const freezer = makeDoor(SPLIT[1] - 0.005, H - 0.02, 'freezer', [1.36]);
  const main = makeDoor(0.12, SPLIT[0] + 0.015, 'fridge', [0.3, 0.62, 0.95]);
  // in the fridge door's bins: milk, juice, eggs
  const inDoor = (geo, color, x, y, z, rough = 0.5) => {
    const m = add(main.hinge, new THREE.Mesh(geo, std({ color, roughness: rough })));
    m.position.set(x, y, z);
    return m;
  };
  inDoor(new THREE.BoxGeometry(0.07, 0.19, 0.07), 0xe4e1d8, -0.16, 0.306 + 0.095, -0.088); // a carton of milk
  inDoor(new THREE.ConeGeometry(0.05, 0.04, 4).rotateY(Math.PI / 4), 0xe4e1d8, -0.16, 0.306 + 0.21, -0.088);
  inDoor(new THREE.BoxGeometry(0.072, 0.07, 0.072), 0x3f6aa8, -0.16, 0.306 + 0.12, -0.088); // its blue band
  inDoor(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 16), 0xd98a2a, -0.3, 0.306 + 0.11, -0.088, 0.25); // orange juice
  inDoor(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 12), 0xf0efe8, -0.3, 0.306 + 0.235, -0.088, 0.4);
  for (let i = 0; i < 6; i++) { // eggs, one gone
    if (i === 4) continue;
    const egg = inDoor(new THREE.SphereGeometry(0.022, 14, 10), 0xd9c4a2, -0.12 - (i % 3) * 0.05, 0.956 + 0.026, -0.068 - Math.floor(i / 3) * 0.036, 0.6);
    egg.scale.set(0.8, 1, 0.8);
  }
  // the drawing and its magnets, on the fridge door's front (they open with it)
  const drawing = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), std({ map: T.fridgeDrawingTex(), roughness: 0.9 }));
  drawing.position.set(cx + 0.05 - (x1 - 0.005), 1.0, 0.002);
  drawing.rotation.z = deg(-4);
  add(main.hinge, drawing);
  for (const [dx, dy, c] of [[-0.07, 0.12, 0xd8402c], [0.08, 0.11, 0x2f6fc0], [0.12, -0.6, 0xe0b52a]]) {
    add(main.hinge, soft(drawing.position.x + dx - 0.014, drawing.position.x + dx + 0.014, 1.0 + dy - 0.014, 1.0 + dy + 0.014, 0.002, 0.014, 0.005, std({ color: c, roughness: 0.4 })));
  }
  // the lamp comes on as the fridge's door opens
  main.door.after = () => {
    const on = THREE.MathUtils.smoothstep(main.door.state.angle, 0.02, 0.25);
    light.intensity = 0.55 * on;
    glow.emissiveIntensity = 0.9 * on;
  };
  main.door.apply();
  return { doors, segs, light };
}

/** A kettle: a squat steel body, a spout, a black handle over the top. */
function kettle(g, mat, x, y, z) {
  const k = new THREE.Group();
  k.position.set(x, y, z);
  const body = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.085, 0], [0.095, 0.03], [0.095, 0.12], [0.075, 0.18], [0.03, 0.2], [0, 0.2]].map(([a, b]) => new THREE.Vector2(a, b)), 32), mat.steel);
  body.castShadow = true;
  k.add(body);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.12, 12), mat.steel);
  spout.position.set(0.1, 0.12, 0);
  spout.rotation.z = -0.9;
  k.add(spout);
  // the handle over the top, on two black feet set into the shoulder (user, 2026-10-18: its ends hung in the
  // air over the lid, the handle floating)
  const black = std({ color: 0x1b1b1d, roughness: 0.5 });
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.011, 8, 24, Math.PI), black);
  handle.position.set(0, 0.207, 0);
  k.add(handle);
  for (const sx of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.04, 12), black);
    foot.position.set(sx * 0.058, 0.192, 0); // (from inside the shoulder, 0.188 at that radius, up past the handle's ends)
    k.add(foot);
  }
  k.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.add(k);
}

/** A chopping board on the worktop, not quite square to it, a kitchen knife left on it at a slant. */
function choppingBoard(g, mat, x, y, z) {
  const W = 0.4, D = 0.27, TH = 0.02;
  const b = new THREE.Group();
  b.position.set(x, y, z);
  b.rotation.y = deg(-6);
  g.add(b);
  const edge = std({ color: 0x9c8260, roughness: 0.8 });
  const top = new THREE.Mesh(new RoundedBoxGeometry(W, TH, D, 2, 0.006), [edge, edge, std({ map: T.choppingBoardTex(W, D), roughness: 0.72 }), edge, edge, edge]);
  top.position.y = TH / 2;
  b.add(top);
  // the knife, lying on its side: its blade (x from the bolster to the tip, its spine at z = 0, the edge
  // towards −z), the bolster, the handle with its three rivets. It rests on the bolster and the tip.
  const knife = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.18, 0); // (a fifth longer than it was, as tall: user, 2026-10-25)
  shape.quadraticCurveTo(0.218, -0.002, 0.232, -0.017);
  shape.quadraticCurveTo(0.192, -0.034, 0.12, -0.036);
  shape.lineTo(0, -0.036);
  shape.lineTo(0, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.0016, bevelEnabled: false, curveSegments: 10 });
  bladeGeo.rotateX(Math.PI / 2); // (flat: its outline across x and z, its thickness down from y = 0)
  const blade = new THREE.Mesh(bladeGeo, mat.steel);
  blade.position.y = 0.0088;
  knife.add(blade);
  const black = std({ color: 0x1d1a18, roughness: 0.45 });
  const handle = new THREE.Mesh(new RoundedBoxGeometry(0.115, 0.016, 0.024, 2, 0.006), black);
  handle.position.set(-0.0605, 0.008, -0.014);
  knife.add(handle);
  const bolster = new THREE.Mesh(new RoundedBoxGeometry(0.01, 0.013, 0.03, 1, 0.003), mat.steel);
  bolster.position.set(-0.003, 0.008, -0.016);
  knife.add(bolster);
  for (const rx of [-0.028, -0.064, -0.1]) for (const ry of [0, 0.016]) knife.add(cyl(0.003, 0.003, 0.002, mat.steel, rx, ry, -0.014, 10)); // (through it: a head each side)
  // put down as a right hand leaves it, for Mum to take up again (mother.js): face down (its y down), the blade off to
  // the left of the board's back, the edge away, the handle to the right towards the front; its tip down onto the
  // board, the handle's end lifted off it a few millimetres
  knife.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - deg(12))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -deg(2)))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
  knife.position.set(0.042, TH + 0.017, 0.022);
  knife.userData.live = true; // (she takes it up: out of the bake)
  b.add(knife);
  b.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return { board: b, knife, top: TH };
}

/** A stoneware pot in the corner of the worktop, a steel ladle and a wooden spatula standing in it, leaning on its rim. */
function utensilPot(g, mat, x, y, z) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  g.add(p);
  const prof = [[0.0005, 0], [0.05, 0], [0.054, 0.004], [0.057, 0.04], [0.056, 0.11], [0.052, 0.14], [0.054, 0.148], [0.053, 0.152], [0.049, 0.151], [0.047, 0.142], [0.05, 0.11], [0.051, 0.04], [0.046, 0.012], [0.0005, 0.011]];
  p.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), 32), std({ color: 0x7a5232, roughness: 0.38 })));
  // each from the floor of the pot on the corner's side, leaning out over the rim on the other (27°: resting on it)
  const stand = (tool, a, spin) => {
    const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), tilt = deg(27);
    tool.position.set(-d.x * 0.025, 0.012, -d.z * 0.025);
    tool.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d.x * Math.sin(tilt), Math.cos(tilt), d.z * Math.sin(tilt))).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
    p.add(tool);
  };
  // the ladle: a flat steel handle, its bowl at the top, open to one side
  const ladle = new THREE.Group(), L = 0.25;
  ladle.add(new THREE.Mesh(new THREE.BoxGeometry(0.012, L, 0.003).translate(0, L / 2, 0), mat.steel));
  const bowlGeo = new THREE.SphereGeometry(0.036, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).rotateX(-Math.PI / 2); // (open towards −z, its rim round y = 0)
  const steel2 = mat.steel.clone();
  steel2.side = THREE.DoubleSide;
  const bowl = new THREE.Mesh(bowlGeo, steel2);
  bowl.position.set(0, L + 0.036, 0.0015);
  ladle.add(bowl);
  stand(ladle, deg(28), deg(160));
  // the spatula: plain wood, its blade worn thin at the end
  const wood = std({ color: 0xbf9d72, roughness: 0.78 });
  const spat = new THREE.Group();
  spat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.2, 10).translate(0, 0.1, 0), wood));
  spat.add(new THREE.Mesh(new RoundedBoxGeometry(0.056, 0.09, 0.006, 2, 0.0025).translate(0, 0.24, 0), wood));
  stand(spat, deg(68), deg(-20));
  p.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
}

/**
 * A mug (user, 2026-10-17: it was a cylinder with no inside): turned, its wall thick, its rim rounded, a
 * hollow in it down to an inner bottom, a C of a handle. `left`: what is in it — 'cold' coffee a third of
 * the way up, gone flat, or 'dried', the brown ring of what was drunk long ago.
 */
function mug(g, x, y, z, color, left = null) {
  const m = new THREE.Group();
  m.position.set(x, y, z);
  m.rotation.y = 0.6 + Math.abs(x * 7) % 1.5; // its handle wherever it was put down
  const glaze = std({ color, roughness: 0.32 });
  const prof = [[0.0005, 0], [0.033, 0], [0.037, 0.003], [0.0395, 0.012], [0.0405, 0.088], [0.0402, 0.094], [0.038, 0.0965], [0.0358, 0.095], [0.0352, 0.088], [0.0347, 0.014], [0.032, 0.0095], [0.0005, 0.009]];
  const cup = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), 40), glaze);
  cup.castShadow = cup.receiveShadow = true;
  m.add(cup);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.038, 0.078, 0), new THREE.Vector3(0.062, 0.08, 0), new THREE.Vector3(0.071, 0.058, 0), new THREE.Vector3(0.064, 0.03, 0), new THREE.Vector3(0.038, 0.024, 0)]), 20, 0.0062, 8), glaze);
  handle.castShadow = handle.receiveShadow = true;
  m.add(handle);
  if (left === 'cold') {
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.0349, 32).rotateX(-Math.PI / 2), std({ color: 0x2a1a10, roughness: 0.15 }));
    coffee.position.y = 0.04;
    coffee.receiveShadow = true;
    m.add(coffee);
  } else if (left === 'dried') {
    const ring = new THREE.Mesh(new THREE.CircleGeometry(0.0318, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: canvasTex(64, 64, (c, w, h) => {
      c.fillStyle = 'rgba(96,62,34,0.55)'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(60,36,18,0.85)'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2); c.stroke();
    }), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }));
    ring.position.y = 0.0096;
    ring.receiveShadow = true;
    m.add(ring);
  }
  g.add(m);
}

// ---------------------------------------------------------------- living room

/**
 * The living room's set can be switched on (user, 2026-10-15) — and shows only snow: grey static, the
 * classic, its lines drawn across, a darker band rolling up through it, now and then a line torn sideways.
 * On, the picture opens out of a bright line across the middle; off, it falls back to the line and then
 * to a dot. Its flicker lights the room a little, cold. Sound: `tv-on`/`tv-off`, `tv-static` (recordings).
 */
function crtStatic(g, ctx, tv, screen) {
  const U = { uTime: { value: 0 }, uOpen: { value: 0 }, uWide: { value: 1 }, uFlash: { value: 0 } };
  const mat = screen.material, before = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    before?.call(mat, sh, r);
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uOpen, uWide, uFlash;\nfloat snowHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }')
      .replace('#include <emissivemap_fragment>', `
        #ifdef USE_EMISSIVEMAP
          vec2 suv = vEmissiveMapUv;
        #else
          vec2 suv = vec2(0.5);
        #endif
        float tick = floor(mod(uTime, 97.0) * 50.0);
        float line = floor(suv.y * 240.0);
        float torn = step(0.975, snowHash(vec2(line, floor(mod(uTime, 97.0) * 14.0))));
        float shift = torn * (snowHash(vec2(line + 3.1, tick)) - 0.5) * 0.25;
        float n = snowHash(vec2(floor((suv.x + shift) * 330.0), line) + tick * vec2(0.37, 1.13));
        float roll = fract(suv.y * 0.9 - uTime * 0.23);
        float band = 1.0 - 0.3 * smoothstep(0.0, 0.06, roll) * (1.0 - smoothstep(0.06, 0.2, roll));
        float scan = 0.8 + 0.2 * sin(suv.y * 240.0 * 3.14159);
        float v = (0.15 + 0.85 * n) * scan * band * (1.0 - 0.4 * length(suv - 0.5));
        float inside = step(abs(suv.y - 0.5), 0.5 * uOpen + 0.004) * step(abs(suv.x - 0.5), 0.5 * uWide + 0.004);
        totalEmissiveRadiance *= vec3(0.84, 0.88, 0.95) * (v * uOpen + uFlash) * inside;`);
  };
  mat.customProgramCacheKey = () => 'crt-static';
  mat.needsUpdate = true;
  // its glow on the room: cold, flickering, from just behind the glass (in front of it, the glass caught
  // it as a bright spot in the middle of the picture)
  const glow = new THREE.PointLight(0xc6d0e2, 0, 3.2, 2);
  tv.add(glow);
  glow.position.set(0, 0.4, 0.03);
  const at = tv.localToWorld(new THREE.Vector3(0, 0.4, 0.1));
  const hiss = ctx.sound.steady('tv-static', at);
  let on = false, since = 9;
  tv.userData.interact = {
    label: () => (on ? 'Turn off the TV' : 'Turn on the TV'),
    use: () => {
      on = !on;
      since = 0;
      ctx.sound.crt(on, at);
    },
  };
  ctx.interact.push(tv);
  const ss = THREE.MathUtils.smoothstep;
  ctx.animated.push((time, dt) => {
    since += dt;
    U.uTime.value = time;
    if (on) {
      U.uOpen.value = ss(since, 0.06, 0.3);
      U.uWide.value = 1;
      U.uFlash.value = 0.7 * (1 - ss(since, 0.0, 0.4));
    } else {
      U.uOpen.value = 1 - ss(since, 0.0, 0.12);
      U.uWide.value = 1 - ss(since, 0.12, 0.24);
      U.uFlash.value = 0.9 * ss(since, 0.0, 0.1) * (1 - ss(since, 0.22, 0.42));
    }
    const lit = on || since < 0.45;
    mat.emissiveIntensity = lit ? 1.15 : 0;
    glow.intensity = on ? 0.4 * U.uOpen.value * (0.75 + 0.25 * Math.random()) : 0;
    hiss.set(on ? U.uOpen.value : 0);
  });
}

function livingRoom(g, M, mat, ctx) {
  // the rug, the coffee table on it, the sofa under the window, the set against the far wall
  const pile = new THREE.MeshPhysicalMaterial({ map: T.rugTex(), bumpMap: T.rugTex(true), bumpScale: 1.4, roughness: 1, sheen: 0.6, sheenRoughness: 0.85, sheenColor: new THREE.Color(0x8a5a4a) });
  const binding = std({ color: 0x2a2f42, roughness: 1 });
  const fringe = std({ map: T.fringeTex(), alphaTest: 0.4, roughness: 1, side: THREE.DoubleSide });
  const rug = F.rug(pile, binding, fringe, 2.7, 2.2);
  rug.rotation.y = deg(-1.5); // never quite square to the room
  rug.position.set(-2.75, 0, 7.15);
  g.add(rug);

  // the sofa (user, 2026-10-20, with a photo of one: "like this, the same size … it's cloth, not leather any
  // more", the cuts kept, old and worn): a two-seater in a faded teal plaid, rolled arms, loose cushions, oak feet
  const plaid = new THREE.MeshPhysicalMaterial({ map: T.sofaPlaidTex(), bumpMap: T.sofaPlaidTex('bump'), bumpScale: 0.6, roughness: 1, sheen: 0.4, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x6f8f92) });
  const sofa = F.plaidSofa(plaid, std({ map: T.woodTex('#8f6a40', '#4a3018', 961), roughness: 0.6 }));
  sofa.userData.live = true; // (out of the bake: it drops the wear the cloth keeps in its vertices)
  sofa.rotation.y = Math.PI / 2;
  sofa.position.set(L.x0 + 0.47, 0, 7.15);
  g.add(sofa);
  {
    const { seats: [s0, s1], arms, backs } = sofa.userData, rip = { roughness: 1, lift: 0.003 };
    // the leather's tears, in the cloth now: a split in the top of the worn seat, where an elbow went through the
    // left arm, a long cut across the right back cushion (user, 2026-10-17), a split in the front of the worn seat
    F.projectDecal(s0, { at: [0.1, 0.24], size: [0.24, 0.24], map: T.plaidTearTex(901, { len: 0.32, gape: 0.07 }), ...rip });
    F.projectDecal(arms[0], { at: [0.0, 0.3], size: [0.16, 0.16], map: T.plaidTearTex(902, { len: 0.26, gape: 0.13 }), ...rip });
    F.projectDecal(backs[1], { at: [-0.05, 0.07], size: [0.34, 0.34], map: T.plaidTearTex(903, { len: 0.42, gape: 0.045, fill: 'fibre', cut: true }), ...rip, front: true, turn: 0.16 });
    F.projectDecal(s0, { at: [-0.13, -0.008], size: [0.2, 0.2], map: T.plaidTearTex(904, { len: 0.34, gape: 0.06 }), ...rip, front: true, turn: -0.07 });
    // two old stains, and a cigarette burn on the right arm near its front (the ashtray on the table)
    F.projectDecal(s1, { at: [-0.12, 0.05], size: [0.12, 0.1], map: T.stainTex(951), lift: 0.002 });
    F.projectDecal(backs[0], { at: [0.1, -0.08], size: [0.09, 0.08], map: T.stainTex(952), lift: 0.002, front: true });
    F.projectDecal(arms[1], { at: [-0.01, 0.33], size: [0.035, 0.035], map: T.burnTex(941), lift: 0.002 });
  }
  // you can get up on it (user, 2026-10-28): onto its seat (the cushions' tops, where they sag) and its arms, as onto
  // the bed; its back, between the arms, up to the window's sill, only stops you
  {
    const z0 = 7.15 - sofa.userData.long / 2, z1 = 7.15 + sofa.userData.long / 2, arm = 0.285, back = L.x0 + 0.425, front = L.x0 + 0.92;
    ctx.colliders.push(
      { type: 'box', x0: L.x0, x1: back, z0: z0 + arm, z1: z1 - arm }, // (all the way up: at 0.97 a hop off an arm cleared it, a frame being long, and there was no way out of the gap behind — user, 2026-10-28)
      { type: 'box', x0: back, x1: front, z0: z0 + arm, z1: z1 - arm, top: 0.46, stand: true, surface: 'bed' },
      ...[[z0, z0 + arm], [z1 - arm, z1]].map(([a, b]) => ({ type: 'box', x0: L.x0, x1: front, z0: a, z1: b, top: 0.655, stand: true, surface: 'bed' })),
    );
  }
  // the curtains, open: each pulled back to its side and gathered there, past the ends of the sofa (2026-10-21:
  // just over the edge of the glass they hung down into its back)
  const bunch = 0.4, past = sofa.userData.long / 2 + 0.04 + bunch / 2;
  const rod = cyl(0.012, 0.012, 2 * past + bunch + 0.1, M.brass, L.x0 + 0.1, LWIN.y1 + 0.16, 7.15, 10);
  rod.rotation.x = Math.PI / 2;
  g.add(rod);
  for (const [mid, seed] of [[7.15 - past, 3], [7.15 + past, 7]]) {
    const c = curtain(bunch, LWIN.y1 + 0.15 - 0.6, mat.curtain, seed, { folds: 6, depth: 0.05 });
    c.position.set(L.x0 + 0.1, (LWIN.y1 + 0.15 + 0.6) / 2, mid);
    c.rotation.y = Math.PI / 2;
    g.add(c);
  }

  // coffee table: rounded top, a shelf under it with papers, a remote and a mug on top
  const tableFrom = g.children.length;
  const cx = -2.9, cz = 7.15;
  g.add(soft(cx - 0.45, cx + 0.45, 0.4, 0.44, cz - 0.6, cz + 0.6, 0.015, M.woodCabinet));
  g.add(soft(cx - 0.4, cx + 0.4, 0.12, 0.14, cz - 0.55, cz + 0.55, 0.008, M.woodCabinet));
  for (const [dx, dz] of [[-0.4, -0.55], [0.4, -0.55], [-0.4, 0.55], [0.4, 0.55]]) g.add(cyl(0.022, 0.016, 0.4, M.woodCabinet, cx + dx, 0.2, cz + dz, 12));
  const remote = soft(cx - 0.12, cx - 0.07, 0.44, 0.46, cz - 0.1, cz + 0.08, 0.008, M.blackPlastic);
  remote.rotation.y = deg(12);
  g.add(remote);
  for (let i = 0; i < 5; i++) g.add(box(0.025, 0.004, 0.008, std({ color: [0xcc3333, 0x33aa44, 0xdddd44, 0x3366cc, 0x888888][i], roughness: 0.4 }), cx - 0.095 + (i % 2) * 0.01, 0.462, cz - 0.06 + i * 0.025));
  const cover = T.coverTex('HOME', '#d9cfb8', '#2a3550', '#b8522c', 251);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.006, 0.28), [M.paper, M.paper, std({ map: cover, roughness: 0.4 }), M.paper, M.paper, M.paper]);
  mag.position.set(cx + 0.18, 0.443, cz + 0.22);
  mag.rotation.y = deg(-20);
  g.add(mag);
  const papers = std({ color: 0xd9d3c6, roughness: 0.9 }); // old papers, not bright white
  for (let i = 0; i < 3; i++) {
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.008, 0.4), papers);
    paper.position.set(cx + 0.05, 0.145 + i * 0.008, cz - 0.1 + i * 0.02);
    paper.rotation.y = deg(-6 + i * 5);
    g.add(paper);
  }
  mug(g, cx + 0.25, 0.44, cz - 0.3, 0x2f4f7a, 'cold');
  // an ashtray on the sofa's side, a cigarette left in it half smoked, still alight (user, 2026-10-16) —
  // in a house with nobody in it
  const tray = F.ashtray();
  tray.position.set(cx - 0.25, 0.44, cz + 0.33);
  tray.rotation.y = 0.7;
  g.add(tray);
  const { ember, smoke } = tray.userData;
  ctx.animated.push((time) => {
    ember.emissiveIntensity = 0.55 + 0.25 * Math.sin(time * 2.3) * Math.sin(time * 0.71 + 1); // breathing, as embers do
    smoke.forEach((m, k) => {
      m.rotation.z = Math.sin(time * 0.6 + k * 1.7) * 0.09;
      m.scale.x = 1 + Math.sin(time * 1.1 + k) * 0.18;
      m.material.opacity = 0.22 + 0.06 * Math.sin(time * 0.8 + 0.5);
    });
  });
  ctx.colliders.push({ type: 'box', x0: cx - 0.45, x1: cx + 0.45, z0: cz - 0.6, z1: cz + 0.6, top: 0.44, stand: true, surface: 'wood' });
  turnAbout(g, tableFrom, cx, cz, deg(-4)).updateMatrixWorld(true); // pushed askew by someone getting up from the sofa
  { // Luna never walks over the ashtray (user, 2026-10-17): it stands in her way up there, cigarette and all (Cat.keepClear)
    const at = tray.getWorldPosition(new THREE.Vector3()), r = 0.09;
    ctx.colliders.push({ type: 'box', x0: at.x - r, x1: at.x + r, z0: at.z - r, z1: at.z + r, base: 0.44, top: 0.5 });
  }

  // the set: a big silver CRT on a black stand with glass doors, the video under it
  const tz = 7.15;
  const stand = F.tvStand(M);
  stand.rotation.y = -Math.PI / 2;
  stand.position.set(-t - 0.25, 0, tz);
  g.add(stand);
  const { group: tv, screen } = F.television(M);
  tv.rotation.y = -Math.PI / 2;
  tv.position.set(-t - 0.485, 0.5, tz);
  g.add(tv);
  crtStatic(g, ctx, tv, screen);
  ctx.colliders.push({ type: 'box', x0: -t - 0.55, x1: -t, z0: tz - 0.66, z1: tz + 0.66 });
  frame(g, T.landscapeTex(), 0.7, 0.5, [-t, 1.75, tz], -Math.PI / 2, M).rotation.z = deg(1.4); // hanging a little crooked

  // an old longcase clock in the corner by the set (user, 2026-10-16; made again, old and used, 2026-10-28). Its
  // pendulum swings and it ticks, its seconds hand goes round — but its hands stand at twenty to four, as the
  // kitchen's clock has stopped at
  const clock = F.longcaseClock((w, h, shape) => M.pane(w, h, true, undefined, shape), M.env);
  clock.rotation.y = Math.PI + 0.012;
  clock.position.set(-t - 0.48, 0, L.z1 - 0.165);
  g.add(clock);
  clock.userData.live = true; // (its pendulum moves: kept out of the bake)
  ctx.colliders.push({ type: 'box', x0: -t - 0.75, x1: -t - 0.21, z0: L.z1 - 0.32, z1: L.z1, top: 2.1 });
  {
    const { pendulum, hands } = clock.userData;
    hands.seconds.rotation.z = -(23 / 60) * Math.PI * 2;
    hands.hour.rotation.z = -((3 + 40 / 60) / 12) * Math.PI * 2;
    hands.minute.rotation.z = -(40 / 60) * Math.PI * 2;
    clock.updateMatrixWorld(true);
    const at = clock.localToWorld(clock.userData.ticksAt.clone());
    let side = 1;
    ctx.animated.push((time) => {
      const swing = Math.sin(Math.PI * time); // a seconds pendulum: two seconds there and back
      pendulum.rotation.z = 0.07 * swing;
      // tick… tock (a recording, when there is one); the seconds hand goes on round with it, the others never move
      if (Math.sign(swing) !== side) { side = Math.sign(swing); ctx.sound.sample('clock-tick', at); hands.seconds.rotation.z -= Math.PI / 30; }
    });
  }

  // the standard lamp, on
  const lx = -4.62, lz = 8.55;
  const base = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.17, 0], [0.17, 0.012], [0.12, 0.03], [0.03, 0.05], [0.015, 0.06], [0, 0.06]].map(([a, b]) => new THREE.Vector2(a, b)), 32), M.brass);
  base.position.set(lx, 0, lz);
  base.castShadow = true;
  g.add(base);
  // the pole, and on it, in the shade (user, 2026-10-28: "only the pole in there"), a brass lampholder, the spider
  // that carries the shade, a pearl bulb lit. None of it shades its own bulb's light: the pole's top, 2 cm under
  // the light as it was, threw a wide dark ring round the base on the floor
  const lathe = (profile, mat, seg) => new THREE.Mesh(new THREE.LatheGeometry(profile.map(([a, b]) => new THREE.Vector2(a, b)), seg), mat);
  const own = [cyl(0.012, 0.012, 1.36, M.brass, lx, 0.72, lz, 10)];
  own.push(lathe([[0, 0], [0.013, 0], [0.016, 0.006], [0.016, 0.045], [0.018, 0.048], [0.018, 0.055], [0.0135, 0.058], [0, 0.058]], M.brass, 20));
  own[1].position.set(lx, 1.4, lz);
  for (let i = 0; i < 3; i++) { // (the spider: three wires from a ring round the holder up to the shade's top ring)
    const a = (i / 3) * Math.PI * 2 + 0.4, from = new THREE.Vector3(lx + Math.cos(a) * 0.02, 1.455, lz + Math.sin(a) * 0.02), to = new THREE.Vector3(lx + Math.cos(a) * 0.147, 1.643, lz + Math.sin(a) * 0.147);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, from.distanceTo(to), 5), M.brass);
    wire.position.copy(from).lerp(to, 0.5);
    wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    own.push(wire);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0022, 6, 20).rotateX(Math.PI / 2), M.brass);
  ring.position.set(lx, 1.455, lz);
  own.push(ring);
  const cap = lathe([[0, 0], [0.0135, 0], [0.0135, 0.022], [0, 0.022]], std({ color: 0xa9a49a, metalness: 0.8, roughness: 0.4 }), 16);
  cap.position.set(lx, 1.443, lz);
  const bulb = lathe([[0, 0.02], [0.013, 0.022], [0.016, 0.035], [0.026, 0.06], [0.03, 0.08], [0.029, 0.095], [0.022, 0.11], [0.012, 0.117], [0, 0.119]], std({ color: 0xfff1dc, emissive: 0xffd6a0, emissiveIntensity: 1.5, roughness: 0.45 }), 24);
  bulb.position.set(lx, 1.443, lz);
  own.push(cap, bulb);
  for (const m of own) { m.castShadow = false; m.receiveShadow = true; g.add(m); }
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.3, 32, 1, true), std({ color: 0xefdcb4, emissive: 0xffa85a, emissiveIntensity: 0.75, side: THREE.DoubleSide, roughness: 0.9 }));
  shade.position.set(lx, 1.5, lz);
  g.add(shade);
  for (const y of [1.355, 1.645]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(y < 1.5 ? 0.24 : 0.15, 0.005, 6, 32), std({ color: 0xc8a870, roughness: 0.8 }));
    band.rotation.x = Math.PI / 2;
    band.position.set(lx, y, lz);
    g.add(band);
  }
  ctx.colliders.push({ type: 'box', x0: lx - 0.18, x1: lx + 0.18, z0: lz - 0.18, z1: lz + 0.18 });

  // a bookcase against the end wall: books, a photo, a plant — and in your way (user, 2026-10-28: you walked through it)
  bookcase(g, M, mat, -2.6, L.z1);
  ctx.colliders.push({ type: 'box', x0: -2.6 - 0.45, x1: -2.6 + 0.45, z0: L.z1 - 0.3, z1: L.z1, top: 1.62 });

  // a mat inside the front door, kicked a little crooked, a child's trainers left on it, one fallen over
  const matFrom = g.children.length;
  g.add(slab(L.x0 + 0.02, L.x0 + 0.62, 0, 0.012, DOORS.front.z0 + 0.05, DOORS.front.z1 - 0.05, std({ color: 0x6b5a40, roughness: 1, bumpMap: T.noiseBump(252, [6, 6]), bumpScale: 0.8 })));
  const fz = (DOORS.front.z0 + DOORS.front.z1) / 2;
  turnAbout(g, matFrom, L.x0 + 0.32, fz, deg(6));
  const left = trainer(0x2b3d63);
  left.rotation.y = deg(160);
  left.position.set(L.x0 + 0.34, 0.012, fz - 0.16);
  g.add(left);
  const right = trainer(0x2b3d63);
  right.rotation.set(deg(84), deg(-130), 0, 'YXZ'); // on its side
  right.position.set(L.x0 + 0.52, 0.036, fz + 0.12);
  g.add(right);
  // a throw folded on the end of the sofa
  const throwMat = std({ map: T.weaveTex('#6a7350', '#454d33', '#99a07c'), roughness: 1 });
  const blanket = F.foldedThrow(0.3, 0.045, 0.36, throwMat);
  blanket.rotation.y = deg(12);
  blanket.position.set(L.x0 + 0.66, 0.483, 7.15 + 0.44); // lying on the seat cushion in front of the cushion, not over it, not in it
  blanket.castShadow = blanket.receiveShadow = true;
  g.add(blanket);
  { // (the seat sags under it: its underside down into the dip, a hair into the cushion, not a board across it)
    g.updateMatrixWorld(true);
    const p = blanket.geometry.attributes.position, v = new THREE.Vector3(), ray = new THREE.Raycaster(), { seats } = sofa.userData;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(blanket.matrixWorld);
      ray.set(v.setY(1), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(seats, false)[0];
      if (hit) p.setY(i, p.getY(i) + hit.point.y - 0.002 - (blanket.position.y - 0.0225));
    }
  }
}

/** Everything added to `g` since child `from`, turned by `yaw` about the upright through x, z: things are never left square. */
function turnAbout(g, from, x, z, yaw) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0, z);
  g.updateMatrixWorld(true);
  const moved = g.children.slice(from);
  g.add(pivot);
  pivot.updateMatrixWorld(true);
  for (const c of moved) pivot.attach(c);
  pivot.rotation.y = yaw;
  return pivot;
}

/**
 * A child's trainer, 19 cm: a white rubber sole cut to the shape of a foot, the upper in `colour` low at
 * the toe and rising to the heel, the dark opening, the laces across the top. Toe towards +x, on y = 0.
 */
function trainer(colour) {
  const s = new THREE.Group();
  // the outline of the sole: broad at the ball of the foot, rounded toe, narrower heel
  const foot = (k) => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.095 * k, 0);
    sh.bezierCurveTo(-0.095 * k, 0.03 * k, -0.06 * k, 0.032 * k, -0.02 * k, 0.034 * k);
    sh.bezierCurveTo(0.04 * k, 0.038 * k, 0.095 * k, 0.034 * k, 0.095 * k, 0.0);
    sh.bezierCurveTo(0.095 * k, -0.034 * k, 0.04 * k, -0.036 * k, -0.02 * k, -0.03 * k);
    sh.bezierCurveTo(-0.06 * k, -0.028 * k, -0.095 * k, -0.028 * k, -0.095 * k, 0);
    return sh;
  };
  const extrude = (shape, depth, bevel) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 24 }).rotateX(-Math.PI / 2);
  const sole = new THREE.Mesh(extrude(foot(1), 0.012, 0.005), std({ color: 0xe2ddd2, roughness: 0.85 }));
  sole.position.y = 0.005;
  // the upper: the same outline a little in, shaped by hand — low over the toes, high at the heel
  const upperGeo = extrude(foot(0.94), 0.05, 0.016);
  const p = upperGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const k = THREE.MathUtils.clamp((0.08 - x) / 0.1, 0, 1), rise = 0.42 + 0.58 * k * k * (3 - 2 * k); // toe low, rising to the ankle
    p.setY(i, y * rise);
  }
  upperGeo.computeVertexNormals();
  const upper = new THREE.Mesh(upperGeo, std({ color: colour, roughness: 0.78 }));
  upper.position.y = 0.022;
  for (const m of [sole, upper]) {
    m.castShadow = m.receiveShadow = true;
    s.add(m);
  }
  // where the foot goes in, and the laces
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.024, 20).rotateX(-Math.PI / 2).scale(1.35, 1, 0.9), std({ color: 0x18181a, roughness: 0.9 }));
  hole.position.set(-0.05, 0.0905, 0);
  s.add(hole);
  for (let i = 0; i < 4; i++) {
    const lace = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.042), std({ color: 0xeeeeea, roughness: 0.8 }));
    lace.position.set(-0.012 + i * 0.016, 0.086 - i * 0.008, 0);
    lace.rotation.z = -0.5;
    s.add(lace);
  }
  return s;
}

/** A bookcase with its back to a wall facing −z (its back at z = `back`), centred on x. */
function bookcase(g, M, mat, x, back) {
  const w = 0.9, h = 1.62, d = 0.3, wood = M.woodCabinet;
  g.add(slab(x - w / 2, x + w / 2, 0, h, back - 0.012, back, wood));
  for (const s of [-1, 1]) g.add(soft(x + s * (w / 2 - 0.01) - 0.01, x + s * (w / 2 - 0.01) + 0.01, 0, h, back - d, back, 0.004, wood));
  const shelves = [0.06, 0.44, 0.82, 1.2, h - 0.02];
  for (const y of shelves) g.add(soft(x - w / 2, x + w / 2, y - 0.02, y, back - d, back, 0.004, wood));
  const r = mulberry32(281);
  const spines = [0x6b2a22, 0x2a3b5c, 0x5a5a3a, 0xc8b88a, 0x3a5a3a, 0x8a3a2a, 0x22222a, 0xb89a5a, 0x4a2a4a];
  for (const y of shelves.slice(0, 3)) {
    let at = x - w / 2 + 0.03;
    while (at < x + w / 2 - 0.12) {
      const bw = 0.025 + r() * 0.035, bh = 0.22 + r() * 0.1, bd = 0.17 + r() * 0.06;
      if (r() < 0.08) { at += 0.06; continue; }
      const book = soft(at, at + bw, y, y + bh, back - 0.02 - bd, back - 0.02, 0.003, std({ color: spines[Math.floor(r() * spines.length)], roughness: 0.75 }));
      book.rotation.z = r() < 0.1 ? 0.18 : 0;
      g.add(book);
      at += bw + 0.002;
    }
  }
  // on the top shelf: a framed photo and a plant
  frame(g, T.landscapeTex(), 0.16, 0.12, [x - 0.2, 1.2 + 0.1, back - 0.12], Math.PI, M).rotation.x = -0.15;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.12, 20), std({ color: 0xa8583a, roughness: 0.8 }));
  pot.position.set(x + 0.22, 1.26, back - 0.15);
  pot.castShadow = true;
  g.add(pot);
  const leaf = std({ color: 0x3d6a2e, roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.26), leaf);
    blade.geometry.translate(0, 0.13, 0);
    blade.position.set(x + 0.22, 1.32, back - 0.15);
    blade.rotation.set((r() - 0.5) * 0.9, r() * Math.PI * 2, (r() - 0.5) * 0.9);
    g.add(blade);
  }
}

/** A curtain: a sheet hanging in folds, `w` wide as it hangs. `folds`: how many across it (else 9–11); `depth`: how deep they are. */
function curtain(w, h, mat, seed, { folds, depth = 0.035 } = {}) {
  const geo = new THREE.PlaneGeometry(w, h, 40, 8);
  const p = geo.attributes.position, r = mulberry32(seed);
  const n = folds ?? 9 + Math.floor(r() * 3), ph = r() * 6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.sin((x / w) * n * Math.PI * 2 + ph) * (depth + 0.01 * (0.5 - y / h)));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- roof

/** The roof's flat pieces, [x0, x1, z0, z1] each, overhanging the walls all round. */
function roofPieces() {
  const main = W + t + 0.3, back = L.z1 + t + 0.3, side = C.z1 + t + 0.3;
  return [
    [L.x0 - t - 0.3, main, -t - 0.32, back], // the bedroom, Mum's room, the kitchen and the living room
    [main, C.x1 + t + 0.3, D - 0.3, side], // the corridor's far end
    [main, B.x1 + t + 0.3, side, B.z1 + t + 0.3], // the bathroom, where it runs past the main roof's edge...
    [B.x0 - t - 0.3, main, back, B.z1 + t + 0.3], // ...and past its back
  ];
}

function roof(g, M, mat) {
  // the flat pieces: the wings' roofs, and under the main roof its eaves — their undersides the soffit,
  // their edges the fascia boards
  for (const [x0, x1, z0, z1] of roofPieces()) g.add(slab(x0, x1, EAVE, EAVE + 0.18, z0, z1, faces(M.trim, { py: mat.roof })));
  // over the main block a hipped roof of old asphalt shingles, grey-brown, its hips and ridge capped
  // (user, 2026-10-17: "add a roof to our house")
  const [x0, x1, z0, z1] = roofPieces()[0];
  const shingles = std({ map: T.shingleTex(), color: 0xb5ada2, roughness: 0.95 });
  shingles.shadowSide = THREE.DoubleSide; // (one-sided: it still shades what is under it)
  const ridgeCap = std({ map: T.shingleTex(), color: 0x958d84, roughness: 0.95 });
  const hip = hipRoof(x0 - 0.03, x1 + 0.03, z0 - 0.03, z1 + 0.03, EAVE + 0.175, Math.tan(deg(24)));
  const roofMesh = new THREE.Mesh(hip.geo, shingles);
  roofMesh.castShadow = roofMesh.receiveShadow = true;
  g.add(roofMesh);
  for (const [a, b, up] of hip.caps) { // a cap of shingles bent over each hip and the ridge
    const len = a.distanceTo(b), X = b.clone().sub(a).normalize(), Yv = up.clone().addScaledVector(X, -up.dot(X)).normalize(), Z = new THREE.Vector3().crossVectors(X, Yv);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.035, 0.24), ridgeCap);
    cap.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Yv, Z));
    cap.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(Yv, 0.012);
    cap.castShadow = cap.receiveShadow = true;
    g.add(cap);
  }
  // the gutters, galvanised steel gone rusty, along the yard side and the street side, hung on straps;
  // downpipes at the yard's corners, off the gutter, back to the wall and down it, kicked out at the foot
  const rust = std({ map: T.rustyMetalTex(), metalness: 0.35, roughness: 0.72, envMap: M.env, envMapIntensity: 0.5, side: THREE.DoubleSide });
  const lipY = EAVE + 0.135, R = 0.065;
  gutter(g, rust, [x0 - 0.06, lipY, z0 - 0.025 - R], [x1 - 0.02, lipY, z0 - 0.025 - R], R); // the yard side
  gutter(g, rust, [x0 - 0.005 - R, lipY, z0 - 0.06], [x0 - 0.005 - R, lipY, z1 + 0.02], R); // the street side
  for (const x of [L.x0 - t + 0.28, W + t - 0.67]) { // (the east one clear of the house's line, hooked by the corner)
    const zw = -t - 0.045, zg = z0 - 0.025 - R;
    // straight runs joined by bends, each bend inside its corner: a curve drawn through the points swung out
    // past them and the pipe went 4 cm into the wall at 1.9 m (user, 2026-10-18)
    const V = (b, c) => new THREE.Vector3(x, b, c);
    const path = new THREE.CurvePath();
    const run = (a, b) => path.add(new THREE.LineCurve3(a, b));
    const bend = (a, corner, b) => path.add(new THREE.QuadraticBezierCurve3(a, corner, b));
    const ground = x < PORCH_X1 ? 0 : -LIFT; // (on the porch, its boards; past it, down to the lawn — the house is raised: user, 2026-10-20)
    const k1 = V(lipY - 0.2, zg), k2 = V(lipY - 0.47, zw), k3 = V(ground + 0.2, zw), dk = k2.clone().sub(k1).normalize();
    run(V(lipY - R + 0.01, zg), V(k1.y + 0.07, zg));
    bend(V(k1.y + 0.07, zg), k1, k1.clone().addScaledVector(dk, 0.07));
    run(k1.clone().addScaledVector(dk, 0.07), k2.clone().addScaledVector(dk, -0.07));
    bend(k2.clone().addScaledVector(dk, -0.07), k2, V(k2.y - 0.07, zw));
    run(V(k2.y - 0.07, zw), V(k3.y + 0.07, zw));
    const shoe = V(k3.y - 0.035, zw - 0.061); // the shoe at the foot, kicked out from the wall, 60° off the plumb
    bend(V(k3.y + 0.07, zw), k3, shoe);
    run(shoe, V(shoe.y - 0.06, shoe.z - 0.104));
    const pipe = new THREE.Mesh(new THREE.TubeGeometry(path, 96, 0.038, 12, false), rust);
    pipe.castShadow = pipe.receiveShadow = true;
    g.add(pipe);
    for (const y of [ground + 0.55, 1.45, 2.05]) g.add(slab(x - 0.05, x + 0.05, y, y + 0.025, -t - 0.088, -t - 0.004, rust)); // its straps to the wall
  }
}

/**
 * A hipped roof over the rectangle x0–x1, z0–z1, its eaves at y0, rising `pitch` (rise per run) to a ridge
 * along its longer side. `geo`: the four slopes, UVs measured on each (rows along its eaves, 1.12 m a tile);
 * `caps`: [from, to, up] along each hip and the ridge.
 */
function hipRoof(x0, x1, z0, z1, y0, pitch) {
  const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2, h = Math.min(hx, hz), top = y0 + h * pitch, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const A = V(x0, y0, z0), B = V(x1, y0, z0), C = V(x1, y0, z1), D = V(x0, y0, z1);
  const [r0, r1] = hx >= hz ? [V(x0 + h, top, mz), V(x1 - h, top, mz)] : [V(mx, top, z0 + h), V(mx, top, z1 - h)];
  // each slope: its eave from a to b, and the ridge points over it (the slope rising to the left of a→b seen from above)
  const slopes = hx >= hz ? [[A, B, [r1, r0]], [B, C, [r1]], [C, D, [r0, r1]], [D, A, [r0]]] : [[A, B, [r0]], [B, C, [r1, r0]], [C, D, [r1]], [D, A, [r0, r1]]];
  const pos = [], uv = [], P = 1.12;
  for (const [a, b, ridge] of slopes) {
    const e = b.clone().sub(a).normalize(), poly = [a, b, ...ridge];
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), ridge[0].clone().sub(a)).normalize();
    if (n.y < 0) n.negate();
    const s = new THREE.Vector3().crossVectors(n, e).normalize(); // up the slope
    const at = (p) => [p.clone().sub(a).dot(e) / P, p.clone().sub(a).dot(s) / P];
    for (let i = 1; i < poly.length - 1; i++) {
      const tri = [poly[0], poly[i], poly[i + 1]];
      const tn = new THREE.Vector3().crossVectors(tri[1].clone().sub(tri[0]), tri[2].clone().sub(tri[0]));
      if (tn.y < 0) tri.reverse(); // facing up and out
      for (const p of tri) { pos.push(p.x, p.y, p.z); uv.push(...at(p)); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const up = (p, q) => V(0, 1, 0).add(V(p, 0, q).normalize().multiplyScalar(pitch * 0.7)).normalize(); // a hip's: between its two slopes
  const caps = [[A, r0, up(-1, -1)], [D, r0, up(-1, 1)], [B, r1, up(1, -1)], [C, r1, up(1, 1)]];
  if (hx < hz) { caps[1][1] = r1; caps[2][1] = r0; }
  if (r0.distanceTo(r1) > 0.05) caps.push([r0, r1, V(0, 1, 0)]);
  return { geo, caps };
}

/** A half-round gutter from a to b (its lip's middle line), `R` round, a bead along its front lip, end caps, on straps. */
function gutter(g, mat, a, b, R) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), len = A.distanceTo(Bv);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R, Math.PI, 2 * Math.PI, false); // the trough, open at the top
  shape.absarc(0, 0, R - 0.003, 2 * Math.PI, Math.PI, true);
  const trough = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 16 });
  const along = Bv.clone().sub(A).normalize();
  const grp = new THREE.Group();
  grp.position.copy(A);
  grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), along);
  const m = new THREE.Mesh(trough, mat);
  m.castShadow = m.receiveShadow = true;
  grp.add(m);
  // the front lip rolled into a bead (front: away from the house — its side is the one away from the roof's middle)
  const out = along.z !== 0 ? -1 : 1; // (along x: the yard side, away is −z → local −x after the turn; along z: the street side, −x)
  const bead = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 8).rotateX(Math.PI / 2).translate(out * R, 0, len / 2), mat);
  bead.receiveShadow = true;
  grp.add(bead);
  for (const z of [0, len]) { const end = new THREE.Mesh(new THREE.CircleGeometry(R, 16, Math.PI, Math.PI), mat); end.position.z = z; end.receiveShadow = true; grp.add(end); }
  for (let z = 0.25; z < len; z += 0.72) { // the straps over it, nailed under the shingles
    const strap = new THREE.Mesh(new THREE.BoxGeometry(2 * R + 0.02, 0.004, 0.018), mat);
    strap.position.set(0, 0.003, z);
    strap.receiveShadow = true;
    grp.add(strap);
  }
  g.add(grp);
}
