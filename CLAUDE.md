# 2003 — instructions for Claude

The project is called **2003** (not "Room 2000"). A first-person horror game in Three.js r180 (vendored in `vendor/`,
no build step), meant to be published and sold. The player is Lucas Goodwin (provisional name), 8, in his 2003
bedroom; around it the rest of the house and the back yard; inside the TV a playable parody game, "Zelpa". Story:
`LORE.md`. **Reply to him in the language he writes in.** All text inside the game is **English**.

Read only the part you need of: `notes/tech.md` (traps, drawing, lamps, loading, textures, the breeze, measuring —
**read the matching part before touching any of these, or adding a room, an opening or a lamp**), `notes/world.md`
(approved state of the yard, the end of the garden and the house), `notes/history.md` (reasons and lessons),
`notes/open.md` (what is waiting on him: things he hasn't judged yet, things noticed but not asked — read it before
reworking anything recent, and before reporting something as new).

## His rules — always

1. **Style coherence above all.** Everything new looks like the bedroom: realistic early-2000s, PBR materials,
   canvas-drawn textures, real sizes in metres, worn and lived-in, same level of detail. Zelpa's 1998 low-poly look
   stays **only inside the TV**. Before building, look at the neighbours (helpers, palette, detail) and compare old
   and new side by side.
2. **No copyright problems.** New content is original and unbranded. His reference photos are for shape/feel only,
   never copied into the game. Branded items still in the build (poster texts: Linkin Park/Meteora, Eminem, Gorillaz,
   jackass; reference photos in the folder; Spider-Man files in `assets/`): flag, don't touch unless told. The
   Strongvilla font (`assets/fonts/`) is **personal-use only**: licence or swap before sale. An image or model he sends
   *to be used* goes in as asked; flag its licence once and add it to the licence list at the end of this file.
3. **He writes wanted changes as facts** ("the toilet seat is white"): specs to build, not bug reports. Words like
   "too much", "looks like", "doesn't make sense" mark complaints.
4. **Human touch — nothing perfect, nothing new** (his most repeated note: "above all I don't want things, when
   they're made, to be perfect and unrealistic"). Nothing a child or family put down is straight, centred or evenly
   spaced; everything lightly or moderately used: edges rounded unevenly and nicked, dents, scratches, faded colours,
   joints not quite flush, one or two pieces broken or missing. Believable, not overdone (see the quality bar).
5. **The vibe: a creepy horror puzzle game, uncanny, a sort of Backrooms.** Ordinary, familiar places that make you
   anxious: what in a plain home feels slightly *off* (someone was just here and isn't, a thing that keeps going in
   an empty room, a detail that doesn't add up). Restrained, sparse, nothing cute or busy.
6. **Sounds are real recordings only** (`assets/sounds/`, listed in `README.txt`, names in `BANK` in `js/audio.js`).
   No recording = silence. Never synthesise organic sounds.
7. **Sizes for an 8-year-old**: eye 1.22 m (0.80 in Zelpa). Never fix "feels slow/far" with physics: resize the space.
8. **Ask before** publishing/deploying (Netlify) or anything outward-facing.
9. **Nothing passes through anything**, above all Luna: body, fur and tail never in walls, doors, furniture or her
   boat (`Cat.keepClear` + `rig.probes`; in the boat `cat.clips`). Check interpenetration numerically before done.
10. **How a round goes**: he sends short points (often several messages while you work: same round). Do them all,
    check each in the game (one `grid()` image per change, numbers where they prove it), then reply in his language:
    a short opening line, one bullet per point — what changed, the cause if a bug, what was checked and how, and
    plainly what was *not* checked or what you changed on your own. Mention what you noticed but didn't touch. Sizes
    in metres, no long theory. A mid-round message correcting something done: redo it, don't argue. On long work, a
    one-line status now and then.
11. **Left / right**: take his frame exactly (from the yard facing the house: left = +x east, right = −x west; from
    the porch looking at the trees: left = −x, right = +x). If he doesn't say, pick the likely reading and state it.
    A "panel" of the corridor wallpaper is the space between two of its drawn vertical lines.
12. **Counts and places he gives are fixed**: place them deterministically (target positions, not RNG draws), so
    they stay put when anything else changes.
13. **Docs**: don't touch `CLAUDE.md` or `notes/history.md` at the end of a normal round; only when he asks, when a
    session ends, or for a lesson worth keeping. New technical lessons go in `notes/tech.md`, not here;
    what is left waiting on him goes in `notes/open.md` (and comes out when he settles it).
14. **Versions** (`notes/versions.md`): one decimal per new playable block (0.5, …), a third number per batch of
    refinements (0.4.3, …). Write them **once every 5 rounds of edits**: at the 5th, add the points of all 5, in
    English and short, to the version in progress (the one exception to rule 13); in between, say in the reply which
    round of the 5 it was. Counting: 0.5.12 opened 2026-11-12 at his request ("update to version 0.5.2", read as
    0.5.12: his to confirm), round 1 written straight away; next is round 2. When a round brings a new playable block
    or completes a batch, propose the next number and let him decide. Current: **0.5.12**.
15. **Repeated details are each different** ("they all have the same cut"): cracks, breaks, chips, placements of
    anything there are many of get their own dice one by one, unless he fixes counts and places (rule 12).
16. **Keep it fast without losing quality** (his standing wish, 2026-11-10: "as I keep working I want Claude to reason
    the same way, so I don't have to go through all this again"). Speed is part of **every** round: whatever is added
    is added the cheap way, and its cost is looked at before it is called done (checklist below). **Never the easy
    way out**: no smaller textures, fewer triangles, lower resolution, simpler lighting, baked or compressed files,
    unless he asks — only changes that give the same picture and leave the game built from its code at every load.
    If only a quality loss would help, say so and let him choose.

## Quality bar — how he judges

- **Wear goes where use goes**: on the path feet take, where hands go, where things are dragged; a light scattering
  elsewhere, never an even all-over pattern ("random scratches where nobody walks don't look real"). Weathering
  (fading, damp low down, moss at feet) goes where weather goes.
- **Faded / worn = a lighter, duller shade of the same colour**, never white or grey.
- **Edges are never perfect**: rounded unevenly, nicked, chipped at the ends, sides not dead straight, gaps uneven;
  heavily used edges (stair nosings, walked boards) rounded right off and hollowed a little.
- **Marks must read at play distance** (check at 30–50 cm *and* 2–3 m), without overdoing it into a ruin.
- **Lit like its neighbours**: anything lit differently from what is beside it is a bug to him (a thing brighter in
  the shade, whites that glow, a window missing the shadows the wall gets, rooms looking different from the yard).
- **Flicker = two faces in one plane** (z-fighting): never leave coplanar faces; set one back ≥ 2–4 mm or merge.
- **References**: photos for shape and feel; when he says "as accurate as possible", redraw the pattern faithfully.
- **Real sizes, real construction**: posts end where the rail ends, legs touch what they stand on, nothing floats,
  handles where a hand would use them.
- **Level of detail**: modelled, not suggested (feet under grates, straps on downpipes, threads on a tap, a split
  rung); textures canvas-drawn at real scale (metric UVs); whatever is at hand height holds up at 30–50 cm.

## Look and light (current, approved)

- **18:00**: every light colour, sun position and sky comes from `js/daytime.js` (`DAY = EVENING`: sun 15° up,
  golden; the lawn mostly in shade). `DUSK` holds the original approved evening light. Every clock reads **6:04 PM**
  (2026-11-04), the stopped ones too; in the build the stopped clocks still show twenty to four (he will change them).
- **No bloom** (`bloom.enabled = false` in `main.js`): he hates halos. Never re-enable.
- Whites must not glow: off-white, not too glossy; in the house no lighter than the plates (≈0xd5cfc2, rough ≥ 0.45).
  `buildHouse` makes its own `M.trim`/`M.door`; never give a house material the bathroom's `cool` env outside the
  bathroom. `envMapIntensity` is ignored with `scene.environment`: give the material its own `envMap`.
- Small meshes made with `new THREE.Mesh` need `receiveShadow = true` (the helpers do it), or the sun lights them
  through walls. See-through meshes too.
- **Light leaks / lines along edges** (he notices every one): walls run into the roof (`TOP` > `EAVE`); the roof
  covers every room; the sun/sky see walls as solid blocks (`shadowTwin` + `shadowOnly` in `build.js`, incl. the
  attic volume and the locked front door); doors have stops on the frame, leaves inside it; a spot's shadow `bias` is
  in perspective depth (large `near`, tiny bias); RectAreaLight window panels have no shadows and light through walls
  (cut out of the bathroom in bath.js); unlit (Basic) things like steam are scaled by the room's light. Lines that
  come and go as you move: `notes/tech.md`, "Lines along edges". Diagnose by switching lights off one at a time (pin
  `intensity` with a getter: `house.update` resets some each frame) and raycasting the pixel. Don't guess.
- Window daylight = `RectAreaLight` panels the size of the glass, never a point/spot light near white things.
- Window glass = two layers (`T.windowDirtTex` dirt, unlit, + an additive black glossy sheen): bedroom in `room.js`
  (moved to `house.scene`), the house's via `glassPane` / `M.pane`. Never `M.glass` on a window. Anything transparent
  in the bedroom with the yard behind it goes in `house.scene` (the yard is drawn after the bedroom).
- A light in front of a glossy screen or glass shows as a bright spot: put it behind the glass.

## How it is built

- `index.html`, `styles.css`; `js/main.js` (renderer, two-scene compositing, HUD, loop, worlds, `hideUnseen`). The
  bedroom (`scene`) and the house + yard (`house.scene`) are **separate scenes** drawn into one picture with shared
  depth, each with its own lights and static shadow maps: this keeps the bedroom's approved lighting untouched.
- Bedroom: `room.js` (shell, materials `M`, lights), `props.js` (furniture, clutter, `takeable()`), `inventory.js`,
  `player.js`, `pc.js` (Macrofrost XD desktop), `cat.js` (Luna: nav over the whole house, `keepClear`, boat, dive),
  `fur.js`, `audio.js`.
- House: `house.js` (`PLAN`, rooms, doors: `hingedDoor`), `fixtures.js` (toilet, bath, basin, taps, sofa, TV, rug,
  ceiling lights…), `build.js` (metric UVs, walls with holes, `bakeStatic`, shadow helpers, early shaders), `bath.js`
  (taps: E on either turns both on, never off; filling, flood, underwater, towel, `drain`), `boat.js` (Luna's boat, sou'wester, diving gear), `uvtorch.js`,
  `water.js` (the water's look; `RippleSim`: stir it with `bath.disturb(x, z, amp, r)`), `splash.js` (something diving
  in: `bath.splash(x, z, yaw)`), `mother.js` (Mum; how to
  work on her: `notes/history.md`, "Mum").
- Outside: `yard.js` (garden, neighbours, street, flamingos, tap), `hose.js`, `grove.js` (the wood, `WIND`), `pool.js`
  (the end of the garden, the angel), `basement.js`.
- Others: `daytime.js`, `textures.js` (all textures, canvas-drawn), `lighten.js`, `util.js` (`breathe`,
  `fetchEarly`), `zelpa.js`, `zelpa-hud.js`.
- **The house is raised** `LIFT` 0.75 over the yard, a porch `PORCH` 1.85 deep along the kitchen's back wall (to
  `PORCH_X1`; cellar doors on the house's wall east of it, hose tap and coil right of the back door). yard.js,
  grove.js and hose.js build in their own frame inside a group at (0, −LIFT, −PORCH): what they push to
  `ctx.colliders`/`ctx.ladders` goes through a shifting proxy ctx; anything computed against the player or camera
  converts with `OY`/`OZ`; anything fixed to the house (roof flamingo, lantern, power line hook) is placed back.
  `player.baseAt` gives the ground's height (0 house and porch, −LIFT yard); `step` colliders are stairs (STEP 0.2).
  Lighting: `twoFills` (build.js) — one hemisphere for indoors, constant; one eye-dependent for outdoor materials
  (`outdoorSun`/`outdoorLit`, which also scale the sun by `YARD_SUN`); `splitOutdoor` gives outdoor meshes their own
  material copies.
- Conventions: metres; x east, y up, z south; bedroom 3.8 × 4.2 × 2.5, window wall z = 0. Colliders in
  `ctx.colliders`; interactables: `userData.interact = { label(), use(), say }` pushed to `ctx.interact`. Shadows are
  static: anything that moves marks its lights (`ctx.touch()` in the bedroom; `mark()` / door `lights` in the house).
- **Traps, drawing, loading, textures, the breeze**: `notes/tech.md`. The ones that break things silently are in the
  checklist below.

## The yard, the end of the garden, the house outside and inside → `notes/world.md`

**Before touching any of these, read the matching bullet there** (only that part): yard size/`DZ`, power line, the
wood, play things, ground and leaf heaps, grass, the hose, flamingos, the fence, Luna out of sight, speed and light
outdoors, the house's outside, the porch, the bedroom window from the yard, the end of the garden (pool, paving,
table, bushes, angel, AC fan), inside the house (bathroom, corridor, attic hatch, Luna's boat). Rules from there for
any new work: anything new for outdoors needs `outdoorLit(m)`; keep foliage to what can be seen; measure fps with no
other preview of the game open; things fixed in a place he chose stay exactly there.

## Speed checklist — when adding anything (rule 16)

- A lamp: a `distance` no longer than its light really reaches (out of reach = skipped in the shader); a shadow only
  if something must be hidden from it (each shadowed lamp is a texture in every indoor shader: Mum has one to spare);
  its shadow redrawn only when something in its reach moves (`mark()` / `ctx.touch()`), never every frame; and the
  scene's lamp count changed (`ROOM_LAMPS` main.js, `HOUSE_LAMPS` house.js).
- A door, window, hole in a wall or a room: into `GAPS` / `ROOMS` (main.js), or whatever is seen through it vanishes.
- A material: reuse one that exists where the look allows (each new combination of maps and patches is one more
  shader: ~50–75 ms of a first visit, 214 now). A patch to a material after the rooms are built, or to
  `THREE.ShaderChunk` after the start, undoes the early shaders: put it with the others, before.
- A texture: no larger than what is seen at 30–50 cm needs; no per-pixel loop that allocates; seeded dice, not
  `Math.random`. One drawn on again after loading needs `tex.userData.redraws = true`.
- Things: what never moves is left to `bakeStatic` (no `interact`/`live` unless needed); many small parts share a
  material; a big mesh seen in part is cut in pieces (`inPieces`); foliage only where it can be seen.
- Something that moves or animates: works only while in view or in use, and wakes shadows only while it moves.
- Something that moves to another scene later: add it to `prepareShaders`' `jobs` (main.js).
- Something that waits hidden until its moment, a new picture drawn off screen (a mirror, a screen in the game), a
  material cut by clipping planes: into the rehearsal (main.js `rehearse`'s `jobs`, `beginCut`; `notes/tech.md`,
  Traps and Loading), or on a first visit the game stops the first time it shows (never seen here: only by players).
- A file over the network: `fetchEarly` + `arrive()`. A build step of a second or more: its own `breathe`.
- Then look: draws and GPU time in the views it shows in, and the loading time, against these numbers (M2,
  1920×1140, 2026-11-10; GPU ms / draws a frame): bedroom 15 / 750 · corridor 19.5 / 550 · kitchen 27 / 430 · living
  room 20 / 250 · lawn → house 22 / 1200–1650 · lawn → trees 18.5 / 140. Loading: first visit 20.5 s, later ~15 s. If
  it made them worse, find out why before finishing, and give the numbers in the reply. How to measure, and the
  method for a speed round: `notes/tech.md`.

## Working cheaply (he is on a usage limit)

- Run: launch config `2003` in `.claude/launch.json` (port 8141, `serve.py`); `2003-alt` (8142), `2003-3` (8143) when
  8141 is taken. `?shot=1` skips the start window. For measuring: `tools/measure-server.py` (`notes/tech.md`), as
  launch config `2003-measure` (8151).
- Syntax check: copy the file to a `.mjs` in the scratchpad and `node --check` it.
- Check visually with `tools/harness.js` + `tools/snap-receiver.py` (the routine is at its top). **Few images**: one
  `grid()` of 2–4 views per change; prefer reading values in JS (counts, distances, collider lists).
- **Never read a big js file whole** (textures.js 410 KB, house.js 245, yard.js 190, mother.js 110, fixtures.js 110,
  bath.js, props.js, pool.js, zelpa.js, boat.js, cat.js, grove.js, main.js, basement.js: 60–90 KB each): grep for the
  name, then read only the lines you need — the function, its helpers and the neighbours rule 1 asks you to compare with.
- Filter long command output (harness, console, logs) with grep/tail.
- Edit with exact, unique markers; when splicing with a script, search the end marker *after* the start.

## Before sale: licences to clear

`assets/family-portrait.jpg` (the corridor's photo; his edit with a black cat on the father's lap),
`assets/calendar-photo.jpg` (a postcard credited "Photo by Frank Ogsbury"), `assets/hell-writing.jpg` (the UV writing,
stock-looking), `assets/models/mother.glb` and `assets/models/angel.glb` (Meshy AI: terms depend on his plan), the
Strongvilla font. Everything else waiting on him: `notes/open.md`.
