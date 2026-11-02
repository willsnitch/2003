# 2003 — instructions for Claude

The project is called **2003** (not "Room 2000"). A first-person horror game in Three.js r180 (vendored in `vendor/`, no build step), meant to be
published and sold. The player is Lucas, an 8-year-old, in his 2003 bedroom; around it the rest of the
house and the back yard; inside the TV a playable parody game, "Zelpa".
**Reply to him in the language he writes in.** All text inside the game is **English**.

Long history and the reasons behind decisions: `notes/history.md` (big — read only the part you need).

## His rules — always

1. **Style coherence above all.** Everything new must look like the bedroom: realistic early-2000s,
   PBR materials, canvas-drawn textures, real sizes in metres, worn and lived-in, same level of detail.
   The 1998 low-poly look of Zelpa stays **only inside the TV**. Before building, look at the
   neighbours (same helpers, palette, detail) and compare old and new side by side.
2. **No copyright problems.** New content is original and unbranded. Reference photos he sends are for
   shape/feel only — never copied into the game. Known branded items still in the build (poster texts:
   Linkin Park/Meteora, Eminem, Gorillaz, jackass; reference photos in the folder; Spider-Man poster
   files in `assets/`): flag, don't touch unless told. The handwriting font (Strongvilla, `assets/fonts/`)
   is **personal-use only**: it needs a commercial licence or a swap before sale. Exception: an image or model he sends
   *to be used* in the game goes in as asked (cropped as he says); flag its licence once and add it to the
   licence list in Open items (all must be cleared or replaced before sale).
3. **He writes wanted changes as facts** ("the toilet seat is white") — they are specs to build, not bug
   reports. Words like "too much", "looks like", "doesn't make sense" mark complaints.
4. **Human touch — nothing perfect, nothing new** (his most repeated note; 2026-10-20: "above all I don't want things,
   when they're made, to be perfect and unrealistic"). Things a child or a family put down are never straight,
   centred or evenly spaced; everything is lightly or moderately *used*, never fresh out of the box: edges rounded
   off unevenly and nicked, surfaces dented and scratched, colours faded, joints not quite flush, pieces a hair out
   of true, one or two broken or missing. But believable, not overdone — and see the quality bar below for how wear
   has to be laid out.
5. **The vibe (user, 2026-10-16): a creepy horror puzzle game, uncanny — a sort of Backrooms.** No
   monsters: ordinary, familiar places that make you anxious. Think this way about every fix and every new
   thing: what in a plain home feels slightly *off* (a sign that someone was just here and isn't, a thing
   that keeps going in an empty room, a detail that doesn't add up), restrained, sparse, nothing cute or busy.
6. **Sounds are real recordings only** (`assets/sounds/`, listed in `README.txt`, names in `BANK` in
   `js/audio.js`). No recording = silence. Never synthesise organic sounds.
7. **Sizes for an 8-year-old**: eye 1.22 m (0.80 in Zelpa). Never fix "feels slow/far" by changing the
   physics — resize the space.
8. **Ask before** publishing/deploying (Netlify) or anything outward-facing.
9. **Nothing passes through anything** — above all Luna: her body, fur and tail never go into walls, doors,
   furniture or her boat (`Cat.keepClear` + `rig.probes`; in the boat `cat.clips`, planes of the hull's inside).
   Check new things for interpenetration numerically before calling them done.
10. **How a round goes**: he sends a list of short points (often several messages while you work — add them
    to the same round). Do them all, check each in the game (one `grid()` image per change, numbers where
    they can prove it), then reply in his language: a short opening line, then one bullet per point — what changed,
    the cause if it was a bug, what was checked and how, and plainly what was *not* checked or what you
    changed on your own (e.g. a species swapped, a wire rerouted). Mention things you noticed but didn't
    touch. Sizes/heights in metres. No long theory. A message that arrives mid-round and corrects something
    already done in the round: redo it, don't argue. On long work, a one-line status now and then.
11. **Left / right / which one**: he says where he is standing ("seen from the yard", "looking towards the trees");
    take his frame exactly (from the yard facing the house: left = +x east, right = −x west; from the porch
    looking at the trees: left = −x, right = +x). If he doesn't say, pick the likely reading and state it in the
    reply. A "panel" of the corridor wallpaper is the space between two of its drawn vertical lines.
12. **Counts and places he gives are fixed**: when he says "three on the left, two on the right", place them
    deterministically (target positions, not RNG draws) so they stay put when anything else changes — a random
    draw added or removed earlier reshuffles everything drawn after it.
13. **Docs**: don't touch `CLAUDE.md` or `notes/history.md` at the end of a normal round; only when he asks, when a
    session ends, or for a lesson worth keeping.
14. **Versions** (`notes/versions.md`, he wants them tracked as we go): one decimal per new playable block (0.5, …),
    a third number per batch of refinements (0.4.3, …). Write them **once every 5 rounds of edits** (user, 2026-10-23:
    not after each one): at the 5th, add the points of all 5, in English and short, to the version in progress (the one
    exception to rule 13); in between, say in the reply which round of the 5 it was. Counting restarts after each write:
    the last was 2026-11-02 (he called the build), so the next round of edits is round 1. When a round brings a new
    playable block, or a batch of refinements is complete, propose the next number and let him decide. Current: **0.5.6**
    (user, 2026-11-02; 0.5.1–0.5.3: Mum; 0.5.6: the end of the garden; he went from 0.5.3 straight to 0.5.6).
15. **Repeated details are each different** (user, 2026-11-02: "they all have the same cut"): cracks, breaks, chips, placements of
    anything there are many of get their own dice one by one, not a few shapes reused — unless he fixes counts and places (rule 12).

## Quality bar — how he judges (learned round after round)

- **Wear goes where use goes.** Scuffs, scratches, dents, a worn-pale dish: on the path feet take (door → steps),
  where hands go (rails, handles, the middle of a rung), where things are dragged; a light scattering elsewhere,
  never an even all-over pattern ("I don't want a uniform pattern"; "random scratches where nobody walks don't look
  real"). Weathering (fading, damp low down, moss/green at feet) goes where weather goes.
- **Faded / worn = a lighter, duller shade of the same colour** (light brown on brown wood), never white or grey.
- **Edges are never perfect**: rounded unevenly along their length, nicked, chipped at the ends, sides not dead
  straight, gaps uneven. Heavily used edges (stair nosings, walked boards) rounded right off and hollowed a little.
- **Marks must read at play distance** (check up close *and* from 2–3 m): if they only show in a close-up, they
  are too faint. Equally, don't overdo it into a ruin.
- **Lit like its neighbours**: anything that looks lit differently from what is beside it is a bug to him — a
  thing brighter in the shade (flamingo eyes without `receiveShadow`), whites that glow, a window that misses the
  shadows the wall beside it gets, the rooms looking different from the yard than from inside.
- **Flicker = two faces in one plane** (z-fighting): he sees it while walking. Never leave coplanar or near-coplanar
  faces (skins, overlays, damp patches, wall pieces overlapping): set one back ≥ 2–4 mm or merge them.
- **References he sends**: photos are for shape and feel; when he says "as accurate as possible" (the wallpaper),
  redraw the pattern faithfully — his complaint was "it looked like dirt specks, not flowers".
- **Real sizes, real construction**: posts end where the rail ends, legs touch what they stand on, nothing floats
  (chair parts), handles where a hand would use them (the tap's lever forward).
- **Level of detail**: modelled, not suggested — feet under grates, straps on downpipes, threads on a tap, a split
  rung, a lace curtain behind a pane; every texture canvas-drawn at its real scale (metric UVs). He walks right up
  to things: whatever is at hand height must hold up in a close-up at 30–50 cm, not only from across the room.
  Keep the frame rate (measure; `outdoorLit`, no hidden cards) while doing it.

## Look and light (current, approved)

- Time of day is **18:00** (user, 2026-10-18; it was 16:00, `AFTERNOON`): every light colour, sun position and
  sky comes from `js/daytime.js` (`DAY = EVENING`: sun 15° up, golden; the lawn mostly in shade). `DUSK` holds
  the original approved evening light — one line to switch. The PC's clock (pc.js) and the cooker's
  (`cookerClockTex`) show the evening too; the stopped clocks stay at twenty to four.
- **No bloom** (`bloom.enabled = false` in `main.js`): he hates halos round bright things. Never re-enable.
- White things must not glow: off-white, not too glossy. Material `envMapIntensity` is IGNORED when the
  material uses `scene.environment` — give it its own `envMap` to control reflection strength.
  Out in the house whites are no lighter than the plates (≈0xd5cfc2, rough ≥ 0.45): the house's fill is an
  unshadowed hemisphere light, and bedroom white (0xe8e1d2) looked lit by itself there. `buildHouse` makes
  its own `M.trim`/`M.door`; never give a house material the bathroom's `cool` env outside the bathroom.
- Small meshes made with `new THREE.Mesh` must get `receiveShadow = true` (the helpers `box`/`cyl`/`slab`
  do it); otherwise the sun lights them through walls (knobs went white this way).
- **Light leaks / lines along edges**: he notices every one. Causes found so far: walls must run into the
  roof (`TOP` > `EAVE`); the roof must cover every room; the sun/sky see walls as solid blocks
  (`shadowTwin` + `shadowOnly` in `js/build.js`, incl. the attic volume and the locked front door);
  doors have stops on the frame and leaves sit inside it; a spot light's shadow `bias` is in perspective
  depth (keep `near` large, bias tiny); see-through meshes need `receiveShadow` too; window panels
  (RectAreaLight) have no shadows and light through walls (cut out of the bathroom in bath.js); unlit
  (Basic) things like steam must be scaled by the room's light. Diagnose by switching lights off one at a
  time (pin `intensity` with a getter: `house.update` resets some each frame) and raycasting the pixel —
  don't guess.
- Window daylight = `RectAreaLight` panels the size of the glass (never a point/spot light near white things).
- Anything transparent in the bedroom that has the yard behind it (the window's glass) must be added to
  `house.scene`: the yard is drawn after the bedroom and paints over it otherwise.
- Window glass = two layers (`T.windowDirtTex` dirt, unlit, + an additive black glossy sheen): bedroom in
  `room.js` (moved to `house.scene`), the house's via `glassPane` / `M.pane` in `house.js`. Never `M.glass` on a window.
- A light on a glossy screen or glass shows as a bright spot: put such a light behind the glass, not in front.

## How it is built

- `index.html`, `styles.css`; `js/main.js` (renderer, two-scene compositing, HUD, loop, worlds).
- The bedroom (`scene`) and the house + yard (`house.scene`) are **separate scenes** drawn into one
  picture with shared depth, each with its own lights and static shadow maps — this keeps the bedroom's
  approved lighting untouched.
- `js/room.js` bedroom shell, materials `M`, bedroom lights · `js/props.js` bedroom furniture/clutter,
  `takeable()` items with the blue-white rim · `js/inventory.js` (I) · `js/player.js` · `js/pc.js`
  (Macrofrost XD desktop) · `js/cat.js` Luna (A* nav over the whole house, follows you room to room,
  perches incl. sofa/tables/bath edge, `keepClear` body push-out, `ride` for her boat, `dive`/`swimAlong` when
  the bathroom is full) · `js/fur.js` · `js/audio.js`
- `js/house.js` the rest of the house (`PLAN` constants; bathroom, kitchen + living room, corridor with the attic hatch, locked front door, Mum's door; their approved details: `notes/world.md`, "Inside the house") · `js/fixtures.js` modelled fittings (toilet,
  bath, basin, taps, sofa, cushions, TV, rug, ceiling drum light…) · `js/build.js` metric UVs, walls with
  holes, `bakeStatic` (merges static meshes), shadow helpers · `js/yard.js` garden, neighbours, street,
  flamingos, the tap · `js/hose.js` the garden hose (verlet rope, coil on its hook) · `js/grove.js` the wood at the
  yard's end · `js/bath.js` working bath (taps — E on either turns both on or off together —, filling, flood that stays in the bathroom, underwater) ·
  `js/boat.js` Luna's boat, sou'wester, diving gear, the boat sinking when the bathroom is full (how it comes up, how she boards, sinks and dives: `notes/world.md`, "Inside the house") (towel floating: `floatingTowel` in bath.js) · `js/uvtorch.js` the UV torch's
  beam (held = on) and what glows under it (the basin's traces, light off: switch by the bathroom door;
  `volume.dim` in bath.js darkens the room) · `js/water.js` how the water looks (waves, planar reflection, from
  below Snell's window, caustics) and `RippleSim`, the wave equation on the GPU over the bathroom floor: anything
  that stirs the water calls `bath.disturb(x, z, amp, r)` · `js/daytime.js` time of day · `js/textures.js` all textures
  (canvas-drawn, no image files) · `js/zelpa.js`, `js/zelpa-hud.js` the TV game · `js/mother.js` Mum in the kitchen
  (pose set by hand each frame, IK arms, the fist as staged morph targets; how we worked on her and how to check her:
  `notes/history.md`, 2026-10-23/27).
- `js/pool.js` the end of the garden, past the wood (2026-10-29/11-02, approved state below) · `tools/bake-angel.mjs` bakes the provisional
  angel once into `assets/models/angel.bin` (`node --max-old-space-size=6000 tools/bake-angel.mjs 0.0065`; pool.js fetches it after the build).
- **The house is raised (2026-10-20)**: `LIFT` 0.75 over the yard, a porch `PORCH` 1.85 deep along the kitchen's back wall
  (to `PORCH_X1`, where the bedroom's wall begins; the cellar doors on the house's wall east of it, the hose's tap and
  coil on the wall right of the back door, over the porch) (house.js).
  yard.js/grove.js/hose.js build in their own frame (the old coordinates), a group at (0, −LIFT, −PORCH): what they
  push to `ctx.colliders`/`ctx.ladders` is shifted by a proxy ctx in house.js; anything they compute against the
  player or the camera (slide, swing, dig, hose) converts with `OY`/`OZ`; anything fixed to the house itself (roof
  flamingo, lantern, power line hook) is placed back with them. `player.baseAt` (house.baseAt) gives the ground's
  height (0 house and porch, −LIFT yard); colliders marked `step` are stairs walked up (player.js STEP 0.2).
  Lighting: `twoFills` (build.js) — the first hemisphere light lights indoors, constant; the second (eye-dependent)
  lights outdoor materials (`outdoorSun`/`outdoorLit`, which also scale the sun by `YARD_SUN`); sun/sky stay at their
  indoor strength, so the rooms look the same seen from the yard. `splitOutdoor` gives outdoor meshes their own
  copies of materials the rooms share.
- Conventions: metres; x east, y up, z south; bedroom 3.8 × 4.2 × 2.5, north wall (window) z = 0.
  Colliders in `ctx.colliders`; interactables: `userData.interact = { label(), use(), say }` pushed to
  `ctx.interact`. Shadows are static: anything that moves must mark its lights (`ctx.touch()` in the
  bedroom; `mark()` / door `lights` in the house).
- Traps: `bakeStatic` takes baked meshes out of their parents, children included — attach decals etc. to
  the parent (`projectDecal` does). three.js draws a transparent `DoubleSide` material in two passes and
  in the back one `gl_FrontFacing` is true: decide the side by the camera's position (water.js) or set
  `forceSinglePass`. `bakeStatic` drops vertex colours: such meshes need `userData.live`. A DoubleSide cut-out
  with a set normal (grass, leaves) needs `bothFacesLit` (yard.js), or its back faces go black; canvas cut-outs
  need `bleed()` (textures.js) against dark rims. A twig drawn into a leaf-spray texture reads as a long dark
  stick when the card is near the eye: keep it thin. Small objects under a ceiling lamp get its coarse cube
  shadow as dashes: skip `getPointShadow` in their shader (the fruit bowl) rather than turning shadows off —
  without shadows the sun lights things through the walls. A raycast from the camera first hits invisible
  helper planes 0.3–0.5 m in front of it: filter `distance > 0.8`. three's `AnimationMixer` writes a bone only
  when its mixed value changes: on a held pose, turns added on top pile up frame on frame (Mum's neck spun) —
  mother.js sets her pose by hand each frame instead. Mum's shader uses 15 of the 16 textures a fragment shader may
  read (the house's 8 shadow maps, the area lights' 2 tables, the ripple map, env, her colour and roughness, the eyes'
  picture — 2026-10-28): one more shadowed light in the house scene and she stops drawing; merge or drop a map first.
- A mesh from surface nets or any generated field: check the triangles' winding against the normals (a preview that doesn't cull won't show it; in the game you see its inside: "the face has gone"). `Math.hypot` is several times slower than sqrt in a hot field. Custom samplers on sRGB textures return linear: no `pow` again.
- Under the floor (the basement, `basement.js`, 2026-10-22): Luna's `Nav` (cat.js) skips colliders with top ≤ 0.03 —
  it ignored heights, and the basement's walls under the bedroom shut her in; whatever the house scene has below the
  floor shows *inside* the basement whenever the house pass is drawn from down there (`cellar.passes`), so it keeps out
  of `UNDER` (the foundation pieces in house.js). basement.js burns 2711 draws of its shared RNG where the wooden doors
  were: anything new before the steps draws from its own RNG, or everything in the basement moves.

## The end of the garden (`js/pool.js`; he laid it out with a sketch, 2026-11-01/02)

- **Shape**: the yard is an L now. `PLAN.yard`: `z0` −22.2, `step` −14 (where the old far fence stood), `x2` 9.3: past `step` it widens east to `x2`,
  the fence turning out along `step`. In yard.js `Y` is still the old yard to `END` (−14: its lawn, grass, leaves, grove, all untouched, same dice)
  and `YF` the whole of it. Where `notes/world.md` says the yard ends at −14, that is this `END`. `DZ` = `YF.z0 + 7.2 − 3` (neighbours further off, room for
  trees behind the fence). The fence's old boards keep their dice; new lengths have their own, after them. Sky bigger (dome 36, tree line 33, centred z −8),
  camera far 62, the neighbours' grass out to ±70 (short of the tree line the sky showed under the fence). The sun's shadow box is bigger: shadows ~25% less sharp than before.
- **The house's power line** runs exactly where it did (the grove grew round it: the grove gets `wire`, the old points) but starts from a pole just outside the step,
  fed from a pole further east and the alley. Anything new keeps off `lines` (`wire` + `wire.span`). `toLine` gives NaN on a repeated point: every leaf went.
- **Pool**: long side across the yard, 8.2 × 4.2 m inside, west end a full half-round ("it was perfect like that"), east end square. Worked out in its own frame, turned a quarter
  (`POOL.at`, `toYard`, `sdPool`/`sdLocal`). Water opaque, level −0.55. Colliders stop you on the coping (walked at from 72 directions: ≥ 11 cm off the water).
  In it `DROWNED`: a flamingo's head and a bit of neck, tilted, mouldy, the eye on the house's side gone (`drownedFlamingo`, yard.js).
- **Paving**: rows of setts (`settGeo`, instanced), up against the coping (cut narrower or shorter, never a row left off); some gone, 7.5% broken, each its own (`brokenStones`).
  Puddles are see-through (`puddleTex`), not black. Fading out of the leaves `paved`/`litter`. Leaves are never mirrored in instancing: lit from the wrong side they go black.
- **Table and chairs**: `TABLE` (−3.5, −16.86), nine rows of paving nearer the house than first; a chair each side and one on the house's side, knocked over (his sketch); iron bars only, no seat boards.
- **Bushes** all along the fence (`hedge`, walked with its own dice): tall, thick, gaps; nothing hanging in the air: long shoots have stems. **Trees** outside the fence (`outsideTrees`, grove.js), boughs sagging in over it.
- **Angel**: PROVISIONAL, he will generate a model and send it (his reference is his frontal photograph of a weathered stone angel, not in the project). At the pool's east end, facing it (`ANGEL`, `marbleAngel`).
  Sculpting a likeness in code didn't satisfy him; a relief built straight from his photo was faithful from the front but broke up from the side, and he had it reverted. Replacing it: swap `marbleAngel`'s geometry; flag the model's licence (rule 2).
- **AC fan** (house.js `fanJam`): only its speed is ever set. Every 4–34 s (`Math.random`) one of three jams; it always struggles first, catches sharply, breaks free sharply. "Take the hose" only on the coil (`loopBox`; the wide `zone` only for hanging it back: layers).

## The yard, the wood, the house outside, recent indoor work → `notes/world.md`

The approved state of all of these is in `notes/world.md`. **Before touching any of them, read the matching
bullet there** (only that part): yard and its size/`DZ`, power line, the wood (`grove.js`, every tree, bark,
leaves), play things (slide, sandbox, spade, swing), ground and leaf heaps, grass, the hose, back door, window
glass from the yard, flamingos, the fence, Luna out of sight, speed outdoors (`outdoorsOnly`), light outdoors
(`YARD_LIGHT`), the house's outside (roof, gutters, siding, back door, tap), the porch (`wornWood`), the bedroom
window from the yard, inside the house (bathroom, corridor, attic hatch and its ladder and lamp, Luna's boat),
and indoor work 2026-10-18/19/20 (kitchen, corridor, living room, bathroom details).
Rules from there that hold for any new work:
- Anything new made for outdoors after the build needs `outdoorLit(m)`; keep foliage to what can be seen;
  measure fps with nothing else drawing on the GPU (no other preview of the game open).
- Things fixed in a place he chose (a flamingo, the spade, gnawed balusters, missing ones) stay exactly there.

## Working cheaply (he is on a usage limit)

- Run: launch config `2003` in `.claude/launch.json` (port 8141, `serve.py`); `2003-alt` (8142) and `2003-3` (8143)
  are the same game on other ports, for when 8141 is taken. `?shot=1` skips the start window.
- Syntax check: copy the file to a `.mjs` in the scratchpad and `node --check` it.
- Check visually with `tools/harness.js` + `tools/snap-receiver.py` (the whole routine is at its top:
  server, receiver, viewport, `grid()`, clean-up). **Take few images**: one `grid()` of 2–4 views per change;
  prefer reading values in JS over screenshots (counts, distances, collider lists).
- `notes/history.md`: add to it only once in a while (several rounds, or a lesson worth keeping), short.
- **Never read a big js file whole** (textures.js 300 KB, house.js 185, yard.js 140, fixtures.js 100, mother.js,
  props.js, bath.js, zelpa.js, boat.js, cat.js, basement.js, grove.js: 50–95 KB each): grep for the function or
  name, then read only the lines you need (offset/limit) — the function, its helpers and the neighbours rule 1
  asks you to compare with.
- Long command output (harness, console, server logs): filter it with grep/tail rather than printing it all.
- Edit with exact, unique markers; when splicing with a script, search the end marker *after* the start.

## Open items (waiting on him)

- **The game makes no sound of its own any more** (2026-10-15: he found everything I generated bad —
  room tone, PC/TV hum, clicks, beeps, the TV tune, chimes — and kept only his pigeon recording). Every
  sound is silent until a recording of that name is in `assets/sounds/` (`README.txt` has the full list,
  `BANK` in `js/audio.js` the names). In now: `pigeon`. Not supplied: everything else (full list in `README.txt`), above all
  `room-tone` (a looping base for every room), steps, doors, water, Luna, the PC and TV.
- What the inventory items are for; what Zelpa's key opens; what goes in the Zelpa loft.
- Noticed, not asked: the fence boards (`fenceBoardTex`) look blotchy, polka-dotted, up close (very visible next
  to the new knot holes). Luna's eyes in
  the living room were fixed in code (`cat.housed`) but never seen in an image.
- Deploy to Netlify (needs his go-ahead; the whole folder must be uploaded, not just `index.html`).
- Before sale: licences for `assets/family-portrait.jpg` (2026-10-19, the corridor's photo; replaced 2026-10-28 by his
  version with a black cat on the father's lap instead of the dog — looks like an edit of the same photo), `assets/calendar-photo.jpg`
  (2026-10-19, the kitchen calendar: a postcard credited "Photo by Frank Ogsbury") and `assets/hell-writing.jpg`
  (2026-10-22, the corridor's UV writing: a stock-looking photo) (see rule 2); and `assets/models/mother.glb`
  (2026-10-23, Mum in the kitchen, `js/mother.js`: a Meshy AI model he sent — its terms depend on the plan it was made on).
- The angel at the pool: his model to come. Not checked yet: Luna in the end of the garden; fps there on his M2; the drowned flamingo's empty eye in a close-up.
- Not seen in an image yet: the flamingos' eyes in direct sun (only checked in shade).
- Mum's right fist remade 2026-10-25/27 (notes/history.md): not yet judged by him — above all the wrist, cocked
  ~45° towards the little finger while she cuts (more than before), up to ~60° for a moment as she puts the knife down.
