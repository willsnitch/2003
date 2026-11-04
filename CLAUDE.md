# 2003 — instructions for Claude

The project is called **2003** (not "Room 2000"). A first-person horror game in Three.js r180 (vendored in `vendor/`,
no build step), meant to be published and sold. The player is Lucas Goodwin (provisional name), 8, in his 2003
bedroom; around it the rest of the house and the back yard; inside the TV a playable parody game, "Zelpa". Story:
`LORE.md`. **Reply to him in the language he writes in.** All text inside the game is **English**.

Reasons behind decisions and lessons: `notes/history.md`. Approved state of the yard, the end of the garden and the
house: `notes/world.md`. Read only the part you need.

## His rules — always

1. **Style coherence above all.** Everything new looks like the bedroom: realistic early-2000s, PBR materials,
   canvas-drawn textures, real sizes in metres, worn and lived-in, same level of detail. Zelpa's 1998 low-poly look
   stays **only inside the TV**. Before building, look at the neighbours (helpers, palette, detail) and compare old
   and new side by side.
2. **No copyright problems.** New content is original and unbranded. His reference photos are for shape/feel only,
   never copied into the game. Branded items still in the build (poster texts: Linkin Park/Meteora, Eminem, Gorillaz,
   jackass; reference photos in the folder; Spider-Man files in `assets/`): flag, don't touch unless told. The
   Strongvilla font (`assets/fonts/`) is **personal-use only**: licence or swap before sale. An image or model he sends
   *to be used* goes in as asked; flag its licence once and add it to the licence list in Open items.
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
    session ends, or for a lesson worth keeping.
14. **Versions** (`notes/versions.md`): one decimal per new playable block (0.5, …), a third number per batch of
    refinements (0.4.3, …). Write them **once every 5 rounds of edits**: at the 5th, add the points of all 5, in
    English and short, to the version in progress (the one exception to rule 13); in between, say in the reply which
    round of the 5 it was. Counting restarts after each write: the last was 2026-11-04 (rounds 1–5 of 3–4 Nov, written
    as 0.5.10, accepted 2026-11-04 with 0.5.8 and 0.5.9); next is round 1. When a round brings a new playable block or
    completes a batch, propose the next number and let him decide. Current: **0.5.10** (user, 2026-11-04; 0.5.8: lighter + breeze; 0.5.9: fixes, pool bubbles; 0.5.10: the lawn's grass; 0.5.1–0.5.3: Mum; 0.5.6:
    the end of the garden; 0.5.7: the bath's cycle and the stone angel).
15. **Repeated details are each different** ("they all have the same cut"): cracks, breaks, chips, placements of
    anything there are many of get their own dice one by one, unless he fixes counts and places (rule 12).

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
  rung); textures canvas-drawn at real scale (metric UVs); whatever is at hand height holds up at 30–50 cm. Keep the
  frame rate (measure; `outdoorLit`, no hidden cards).

## Look and light (current, approved)

- **18:00**: every light colour, sun position and sky comes from `js/daytime.js` (`DAY = EVENING`: sun 15° up,
  golden; the lawn mostly in shade). `DUSK` holds the original approved evening light. Every clock reads
  **6:04 PM** (owner, 2026-11-04), the stopped ones too. In the build the stopped clocks still show twenty to four:
  the owner will change them later (docs only for now).
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
  (cut out of the bathroom in bath.js); unlit (Basic) things like steam are scaled by the room's light. Diagnose by
  switching lights off one at a time (pin `intensity` with a getter: `house.update` resets some each frame) and
  raycasting the pixel. Don't guess. Lines that come and go as you move, at corners and along edges seen side-on,
  worse in a small window: the multisampled picture works a surface's point out past its edge (shadow lookups landed
  outside the walls, in the sun; position boxes like the bath's dim or `corridorFill` read "outside"). Shadow coords
  are `centroid` (main.js); any new varying position used for a box test or a lookup must be `centroid` too, and a
  box must reach into the walls as far as the ceilings do (13.5 cm). Reproduce at 760×450, not full size.
- Window daylight = `RectAreaLight` panels the size of the glass, never a point/spot light near white things.
- Window glass = two layers (`T.windowDirtTex` dirt, unlit, + an additive black glossy sheen): bedroom in `room.js`
  (moved to `house.scene`), the house's via `glassPane` / `M.pane`. Never `M.glass` on a window. Anything transparent
  in the bedroom with the yard behind it goes in `house.scene` (the yard is drawn after the bedroom).
- A light in front of a glossy screen or glass shows as a bright spot: put it behind the glass.

## How it is built

- `index.html`, `styles.css`; `js/main.js` (renderer, two-scene compositing, HUD, loop, worlds). The bedroom
  (`scene`) and the house + yard (`house.scene`) are **separate scenes** drawn into one picture with shared depth,
  each with its own lights and static shadow maps: this keeps the bedroom's approved lighting untouched.
- Bedroom: `room.js` (shell, materials `M`, lights), `props.js` (furniture, clutter, `takeable()` with the blue-white
  rim), `inventory.js` (I), `player.js`, `pc.js` (Macrofrost XD desktop), `cat.js` Luna (A* over the whole house,
  follows you room to room, perches, `keepClear`, `ride`, `dive`/`swimAlong`), `fur.js`, `audio.js`.
- House: `house.js` (`PLAN`; bathroom, kitchen + living room, corridor with the attic hatch, locked front door, Mum's
  door; `hingedDoor` takes `before(opening)` and `turn(open)`), `fixtures.js` (toilet, bath, basin, taps, sofa, TV,
  rug, ceiling lights…), `build.js` (metric UVs, walls with holes, `bakeStatic`, shadow helpers), `bath.js` (taps: E
  on either turns both on, never off; filling, flood, underwater, the floating towel; `drain`: all of it back down the
  plug hole; two planar reflections while the floor's water and the bath's are apart, `floorMirror`), `boat.js` (Luna's boat, sou'wester, diving gear; on a drain the boat is sucked into the bath and she
  shakes the suit off in a poof), `uvtorch.js` (beam held = on; the basin's traces with the light off, switch by the
  bathroom door), `water.js` (the water's look; `RippleSim` — stir it with `bath.disturb(x, z, amp, r)`), `mother.js`
  (Mum in the kitchen; how to work on her: `notes/history.md`, "Mum").
- Outside: `yard.js` (garden, neighbours, street, flamingos, tap), `hose.js` (verlet rope), `grove.js` (the wood),
  `pool.js` (the end of the garden, past the wood; bubbles and the ripples they leave, `poolBubbles`/`poolRipples`), `basement.js`. The angel is his Meshy model, `assets/models/angel.glb`, shrunk once in Blender
  (decimate 30 %, the texture's seams and everything up to the feet locked — unlocked, the plinth's texture warped:
  660k → 198k triangles; colour 8192 → 4096 px, normal 2048, roughness 1024; 80 → 15 MB).
- The breeze (2026-11-03): `WIND` in grove.js, its time from `house.update`. Leaf cards, the neighbours' crowns and
  the moss move only in a breeze now and then (`breeze`: ~24 % of the time, ~6 s each, ~20 s apart, slow); the
  willow's shoots all the time (`windGust`, `steady`; "the only movement I like", slowed a little). In their shaders
  (`windVertex`); their shadows stay at rest and they are lit as if at rest (no flicker). The light under the crowns
  moves on the lawn in the breezes (`dappled`, mask from `leafLight`: sun and sky, leaves 3 m+ up only; at 18:00 the
  sun doesn't reach the lawn: it is the sky's light that moves). New leaves made another way need `windy(mat)` and
  `userData.leaves = true`. Random numbers in shaders: no `sin` of big numbers (the GPU's differs): `windDice`.
- Others: `daytime.js`, `textures.js` (all textures, canvas-drawn), `zelpa.js`, `zelpa-hud.js`.
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
- **Traps**:
  - `bakeStatic` takes baked meshes out of their parents, children included (attach decals to the parent:
    `projectDecal` does) and drops vertex colours (such meshes need `userData.live`).
  - A transparent `DoubleSide` material draws in two passes and in the back one `gl_FrontFacing` is true: decide the
    side by the camera's position (water.js) or set `forceSinglePass`.
  - A DoubleSide cut-out with a set normal (grass, leaves) needs `bothFacesLit` (yard.js); canvas cut-outs need
    `bleed()` (textures.js). A twig drawn into a leaf-spray texture reads as a dark stick near the eye: keep it thin.
  - Small objects under a ceiling lamp get its cube shadow as dashes: skip `getPointShadow` in their shader (the fruit
    bowl), don't turn shadows off.
  - A raycast from the camera first hits helper planes 0.3–0.5 m out: filter `distance > 0.8`.
  - `AnimationMixer` writes a bone only when its value changes: turns added on a held pose pile up. mother.js sets her
    pose by hand each frame. Her shader uses 15 of the 16 textures a fragment shader may read: one more shadowed light
    in the house scene and she stops drawing; merge or drop a map first.
  - A mesh from surface nets or any generated field: check the winding against the normals (in the game you see its
    inside: "the face has gone"). `Math.hypot` is slow in a hot field. Custom samplers on sRGB textures return linear.
  - Metric UVs count tiles and boards from world zero: a room whose walls are off that grid gets cut tiles at them —
    give it its own material with the texture offset to its wall (house.js `fromWall`, the bathroom's `tileX`).
  - Under the floor (`basement.js`): Luna's `Nav` skips colliders with top ≤ 0.03; whatever the house scene has below
    the floor shows inside the basement (`cellar.passes`), so it keeps out of `UNDER`. basement.js burns 2711 draws of
    its shared RNG where the wooden doors were: anything new before the steps uses its own RNG, or the basement moves.
  - Drawing (2026-11-03, for speed, same picture): the scenes go into one multisampled picture resolved once
    (`sharedPicture`, main.js); the grade pass tone-maps itself (no OutputPass). The bedroom's pass is left out when
    neither its door nor its window (`OPENINGS`) is in view: anything of the bedroom's scene showing outside its walls
    must lie inside those boxes. The kitchen lamp's shadow is two layers (`layeredShadow`, build.js): only Mum is
    drawn again as she moves; anything else that moves in its reach must `mark()` it. A surface facing away from a
    light skips that light's shadow lookup (build.js, exact). From inside the bedroom, house meshes seen through
    neither its window nor its door (`GAPS`) are left out of the picture, not the shadows (`hideUnseen`): a new
    opening in the bedroom goes in `GAPS`. The porch's boards are cut in 1.2 m pieces (`inPieces`).

## The yard, the end of the garden, the house outside and inside → `notes/world.md`

**Before touching any of these, read the matching bullet there** (only that part): yard size/`DZ`, power line, the
wood, play things, ground and leaf heaps, grass, the hose, flamingos, the fence, Luna out of sight, speed and light
outdoors, the house's outside, the porch, the bedroom window from the yard, the end of the garden (pool, paving,
table, bushes, angel, AC fan), inside the house (bathroom, corridor, attic hatch, Luna's boat). Rules from there for
any new work: anything new for outdoors needs `outdoorLit(m)`; keep foliage to what can be seen; measure fps with no
other preview of the game open; things fixed in a place he chose stay exactly there.

## Working cheaply (he is on a usage limit)

- Run: launch config `2003` in `.claude/launch.json` (port 8141, `serve.py`); `2003-alt` (8142), `2003-3` (8143) when
  8141 is taken. `?shot=1` skips the start window.
- Syntax check: copy the file to a `.mjs` in the scratchpad and `node --check` it.
- Check visually with `tools/harness.js` + `tools/snap-receiver.py` (the routine is at its top). **Few images**: one
  `grid()` of 2–4 views per change; prefer reading values in JS (counts, distances, collider lists).
- **Never read a big js file whole** (textures.js 410 KB, house.js 230, yard.js 160, mother.js 110, fixtures.js 110,
  props.js, bath.js, pool.js, zelpa.js, boat.js, cat.js, basement.js, grove.js: 55–85 KB each): grep for the name,
  then read only the lines you need — the function, its helpers and the neighbours rule 1 asks you to compare with.
- Filter long command output (harness, console, logs) with grep/tail.
- A `javascript_tool` call that steps more than ~120 rendered frames of the house can time out halfway: step in
  chunks, keep results in `window`.
- Edit with exact, unique markers; when splicing with a script, search the end marker *after* the start.
- Speed: measure in the real loop with the pane shown, switching old/new in the same page a second or two at a time,
  several rounds (the M2 heats up: fps drift 30 % over minutes, so before/after runs lie). A `readPixels` sync does
  not reliably wait for the GPU here. In the bedroom the GPU is bound by the yard's geometry (porch, trees, grass).

## Open items (waiting on him)

- **No sounds of the game's own** (2026-10-15: he found everything generated bad, kept only his pigeon). Every sound
  is silent until a recording of that name is in `assets/sounds/` (`README.txt` has the list). Missing above all:
  `room-tone` (a looping base for every room), steps, doors, water, Luna, the PC and TV.
- Clocks (2026-11-04): every clock should read 6:04 PM; the stopped clocks in the build still show twenty to four.
  Docs updated, the game not yet (later).
- Noticed, not asked: the fence boards (`fenceBoardTex`) look blotchy up close. Luna's eyes in the living room fixed in
  code (`cat.housed`) but never seen in an image.
- Deploy to Netlify (needs his go-ahead; the whole folder, not just `index.html`).
- Before sale, licences for: `assets/family-portrait.jpg` (the corridor's photo; his edit with a black cat on the
  father's lap), `assets/calendar-photo.jpg` (a postcard credited "Photo by Frank Ogsbury"), `assets/hell-writing.jpg`
  (the UV writing, stock-looking), `assets/models/mother.glb` (Meshy AI: terms depend on his plan), the font, and
  `assets/models/angel.glb` (Meshy AI, like Mum).
- The angel at the pool: his model in (2026-11-02), 2.05 m to the wing tips on its plinth (size mine), not yet judged
  by him. Not checked yet: Luna in the end of the garden; fps there on his M2; the
  drowned flamingo's empty eye in a close-up; the flamingos' eyes in direct sun.
- The bath's cycle (2026-11-02), not yet seen by him in play: the lines "It won't turn." / "It won't budge." (mine),
  the water running back up the bath's front and the whirl over the plug (mine), Luna's shake close up, the poof with
  the light off. A 2 cm sliver of tile is left along the bathroom's door wall (only the sides were asked).
- The breeze (2026-11-03, his second notes: "light, slow, random, now and then; the willow only a little slower"):
  not yet seen by him in play. Still: the long grass, tufts, weeds and the leaf litter. Mum costs ~5 ms in the
  kitchen whatever her shader (her geometry, cause not found).
- Not yet seen by him in play (2026-11-03): the bath's floor water now reflecting from the first centimetre; the
  pool's bubbles (darker green, the water rippling where they come up and burst; from ~4 m at a slant the ripples
  hardly show); the grass going on under the porch's skirt and 30–40 cm past the lawn's fences, the long grass along
  the skirt (mine: the mower can't get there), the 14 lawn weeds. Not measured: fps with the extra grass.
- Mum's right fist (2026-10-25/27): not yet judged by him, above all the wrist, cocked ~45° towards the little
  finger while she cuts, up to ~60° as she puts the knife down.
