# 2003 — technical notes: traps, drawing, speed, loading, measuring

Moved out of `CLAUDE.md` on 2026-11-10 to keep it light; nothing here was dropped. **Read the matching part before
touching drawing, lights, shadows, materials, textures, loading, the breeze, the angel, or before adding a room, an
opening or a lamp.** The always-rules and the checklist stay in `CLAUDE.md`.

## Traps

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
  in the house scene and she stops drawing; merge or drop a map first. Her body never takes the bathroom's water patch
  (`noWater`): with it she read 17, one over (a warning every frame).
- A mesh from surface nets or any generated field: check the winding against the normals (in the game you see its
  inside: "the face has gone"). `Math.hypot` is slow in a hot field. Custom samplers on sRGB textures return linear.
- Metric UVs count tiles and boards from world zero: a room whose walls are off that grid gets cut tiles at them —
  give it its own material with the texture offset to its wall (house.js `fromWall`, the bathroom's `tileX`).
- Under the floor (`basement.js`): Luna's `Nav` skips colliders with top ≤ 0.03; whatever the house scene has below
  the floor shows inside the basement (`cellar.passes`), so it keeps out of `UNDER`. basement.js burns 2711 draws of
  its shared RNG where the wooden doors were: anything new before the steps uses its own RNG, or the basement moves.
- Random numbers in shaders: no `sin` of big numbers (the GPU's differs): `windDice`.
- A sprite (or mesh) whose scale is set only in an `update` is drawn at scale 1 — a metre across — for the frame it
  is made in if that comes after the update (a bubble let go from `boat.update`): set its size when it is made
  (`bubbles.js` emit does now).
- Luna in the water: the room's water is 0.76 m across and she keeps 0.55 m off you, so she can't swim round you —
  you are a block in `dive.blocks` (boat.js `moving`), her ways go over your head or under your feet. A swim step's
  "getting no nearer" must not count while she is still turning to it (1.65 rad/s: she gave up on you mid-turn,
  over and over). Facing something right beside her (her boat) she turns only as far as her head needs, or her nose
  goes into it and `keepClear` slides her off.
- Indoors or out (build.js `outdoorsOnly`, 2026-11-11): a material is the rooms' if one of its meshes overlaps a room
  by 2 cm, **or lies wholly on the room's side of its walls' faces** (tiles, a socket's plate, a wear layer on a wall:
  under 2 cm proud of an outer wall they had counted as out of doors — no lamp lit them, and they shone once the
  outdoor fill stopped being the house's own for an eye indoors). A thing lying in an outer wall that must be the
  rooms': `userData.indoors = true`. **An empty box passes every "inside" test** (each side ±Infinity): a mesh with
  nothing in it at the bake — the short grass, an `InstancedMesh` at count 0 — counted as wholly inside a room, and the
  lawn's blades took the house's dim fill and all its lamps (black in the shade, the yard 2–4 ms slower). Test
  `box.isEmpty()` first. A thing standing in a doorway with lamps on it (`outdoorSun(m)`): give it
  `userData.indoorSide` (which way is in, how far shut) or its inner face takes the yard's fill. To find what
  changes indoors after touching the yard's light: draw the same instant twice (hold `__now`), old values pinned on
  the lights, and difference the pictures — only what shows through glass and doors may change. The hatch's lamp
  flickers: frames apart, the corridor's end differs by itself.

- **A shader is readied once more for every kind of picture it is drawn into** (format, how many samples), at its
  first draw there: ~0.15 s for each of the rooms' shaders on an M2 on a first visit (0.3 s the see-through ones),
  nothing on later visits — so it is never seen here, only by players (2026-11-11: 2.9 s as the taps opened, the
  room's first time in the water's mirror: half-float ×1, the screen is ×4). The same for whatever waits hidden:
  never drawn anywhere until its moment. A new picture of another kind (a mirror, a cube, a screen in the game), or
  a new thing that waits hidden: into the rehearsal (main.js `rehearse`: its `jobs`), or it stops the game the
  first time. The cost is per shader and kind, not per thing (54 things on one shader: one).
- **`compile` makes a shader for as many clipping planes as the last thing drawn had**, not as the material has
  (three keeps the count from the last draw): all of Luna's (24) and her suit's (16, 17) were made for none, never
  used, and the right ones were made in play, one at a time (~0.4 s each on a first visit). `beginCut` (main.js)
  begins them with the count left right (`planesLeft`: one small thing cut by that many drawn first); after any
  draw of a clipped thing outside a frame, `planesLeft(0)` before the next `compile`. A material with another count
  of planes: add the count to the list by `planesLeft`. And a material patched after its shader was begun
  (`needsUpdate`) is made again where it is next drawn: Luna, her boat and her suit take the bathroom's water at
  the start now (`volume.patch`, `patchThese`), not as they come.
- The card does one thing at a time: readying shaders for a kind of picture does not go on beside the compiling
  (three shaders took 5 s while it compiled), and draws sent all at once hold the page until the card is through
  them (16 s) — send a few, wait for the card (`cardDone`: a fence, asked between frames). A question to the card
  (a shader's uniforms, its link) waits for every draw sent before it: ask first, then send. A shader made in the
  middle of the loading waits its turn behind all the others (7 s for a tiny one).
- Two loads with the same dice (`?seeded`) build the same house only if they make the same three objects in the same
  order: three takes Math.random for each one's id. One render target more in one load and Luna's tail lay elsewhere
  in the other (it looked like a change to her). And once the taps run, two loads of the very same code part ways
  (the boat ends 0.1–0.2 m apart): compare the water by the shaders' text, not by pictures.

## Hooks worth knowing

- `hingedDoor` (house.js) takes `before(opening)` and `turn(open)`. Luna (cat.js): `ride` for her boat, `dive` /
  `swimAlong` when the bathroom is full (`dive.greet`: to your face first), `heel` (at your heel: boat.js sets it while
  the taps run and the boat isn't up), `watch(p)` (stop and watch a point; boat.js keeps `lookPoint` on the boat).
  Her ways (`nav.path`) are worked out once, when she sets off: a door that shuts after that is caught by `wayOpen`
  (cat.js; `cat.doors` = the bedroom door + `house.doorSegs`, every hinged door in the colliders) and she goes round or
  stops this side — a new door her nav goes round is in it by itself. `keepClear` eases her out of things far slower than
  she runs: never rely on it to stop her going through something. The bathroom door (main.js `bathDoorAfter`,
  `lunaInBath`): "in" counts where she is walking or leaping to.
  The bath: `splash(x, z, yaw)` for something diving in (splash.js), `disturb` for a ripple. The bath (bath.js): two planar reflections while the floor's water and the
  bath's are apart (`floorMirror`). The pool (pool.js): `poolBubbles` / `poolRipples`.

## Lines along edges that come and go

Lines that come and go as you move, at corners and along edges seen side-on, worse in a small window: the
multisampled picture works a surface's point out past its edge (shadow lookups landed outside the walls, in the sun;
position boxes like the bath's dim or `corridorFill` read "outside"). Shadow coords are `centroid` (main.js); any new
varying position used for a box test or a lookup must be `centroid` too, and a box must reach into the walls as far
as the ceilings do (13.5 cm). Reproduce at 760×450, not full size.

`centroid` takes a point the triangle covers, not one that is seen: a face that runs on hidden inside another wall
still shades the pixels at the corner from its hidden part. The corridor's south wall ran through the end wall to the
house's corner, its inner face looking at the evening sun; that hidden 14 cm was sunlit and the far right corner
flashed as you walked (2026-11-12). A corner belongs to the wall whose inner face looks away from the sun (or the face
stops at the corner). Found at `renderer.setPixelRatio(0.6)` (what `sharpen` drops to on a slow machine), 2–5 m off,
by scanning the corner's pixels along a walk and switching lights off one at a time; at full size it never showed.
Same family: a face cut flush with a hole shows past a worn-round frame's edge — set its edge back under the frame
(the hatch's ceiling, 3 cm).

## Drawing (2026-11-03 → 10, same picture, faster)

- The scenes go into one multisampled picture resolved once (`sharedPicture`, main.js); the grade pass tone-maps
  itself (no OutputPass). The bedroom's pass is left out when neither its door nor its window (`OPENINGS`) is in
  view: anything of the bedroom's scene showing outside its walls must lie inside those boxes.
- The kitchen lamp's shadow is two layers (`layeredShadow`, build.js): only Mum is drawn again as she moves; anything
  else that moves in its reach must `mark()` it. A surface facing away from a light skips that light's shadow lookup
  (build.js, exact). The porch's boards are cut in 1.2 m pieces (`inPieces`).
- **What the eye can't reach is left out of the picture, not of the shadows** (`hideUnseen`, main.js; 2026-11-10,
  checked against "everything drawn" from ~500 views): the house is `ROOMS` (bedroom, bathroom, corridor, kitchen +
  living room; the basement apart) joined by `GAPS` (doors, windows, the corridor's open end into the living room,
  the attic's hatch, the cellar's mouth). From inside a room only what shows through its gaps is drawn; what stands
  wholly inside another room, only through that room's gaps, wherever the eye is. A shut bedroom or bathroom door is
  no gap; the back door (glazed) always is. A new opening in any wall, or a new room, goes in `GAPS` / `ROOMS`, or
  whatever is seen through it disappears. `?seeall` draws everything (to compare with). The bedroom's window-glow
  shadow follows Luna only while she is in the bedroom, and is looked at again every 8th frame for 3 s after
  anything changes, then every 4 s.
- **A lamp that gives a surface nothing** (out of its `distance`, or the surface turned away) is skipped whole in the
  shader (build.js, `directLight.visible`; `?alllamps` = worked out everywhere, as before). Indoors the frame's time
  is the pixels' lamps (15 in the house's scene), not hidden things or draw calls: this took a third off the GPU's
  time there. So give a new lamp a `distance` no longer than its light really reaches.

## Loading (2026-11-05 → 10; players: "it lags, it froze my browser")

- The build is `async` and stops now and then (`await breathe(share)`, util.js: lets the page answer, moves the
  "Loading… %" line); `buildHouse`, `backYard`, `porch`, `poolGarden` are async — a new step of a second or more gets
  its own `breathe`. Anything arriving over the network waits for `whenBuilt` and goes through `arrive()` (Mum, the
  angel), or it lands mid-build.
- Every shader is compiled before the first frame (`prepareShaders`, main.js, `compileAsync`): something that moves
  to another scene later (Luna into the house) is compiled there too — add new cases to its `jobs`.
- The picture gets less sharp only on slow machines and only if that helps (`sharpen`, main.js; never with `?shot`).
  Uniform arrays are sent only when changed (`keepArrays`). `vnoise` keeps cells' corner values (same numbers, 8×
  faster).
- A first visit (M2): build ~12 s, textures to the GPU ~2.5 s, shaders ~11 s (later visits find the shaders kept by
  the browser: ~15 s in all). The GPU does one thing at a time: shaders overlap only with the page's own work or a
  wait. So Mum and the angel are sent for as the page starts (`fetchEarly`, util.js), and the shaders are begun early
  (build.js `beginShaders`, `standIns`): the bedroom's once the house has set the shared lighting code (`twoFills`;
  `ctx.sharedShaderCodeSet`), the rooms' before the yard is built (`beginRoomShaders`, house.js), lit by stand-ins
  for the lamps not made yet, the rest at `built()`. First visit 25.9 → 20.6 s; all 214 shaders text-for-text as
  before, 2 made for nothing.
- What keeps it right: `ROOM_LAMPS` (main.js) and `HOUSE_LAMPS` (house.js) are each scene's lamps by kind — a lamp
  added or removed: change the count (the console says when it is wrong; only loading time is lost). A change to
  `THREE.ShaderChunk` must come before any shader is begun (same name, older code kept otherwise). The rooms' early
  shaders are only for materials nothing touches later (indoors, not along the corridor) and take bath.js's water
  patch then.
- **The rehearsal** (main.js `rehearse`, 2026-11-12; `?norehearsal` = without, as before): from the moment every lamp
  is in, beside the rest of the loading and on after it, each thing is drawn once into a few pixels of each kind of
  picture it will be drawn into (see Traps) — `jobs`, in order: what stands in the bathroom, in the mirror's kind
  (**the loading waits for this one**: ~3 s on a first visit); what waits hidden in the house, in the screen's; the
  hidden by the water, in the mirror's; Luna as the house has her, with hat and suit, and her suit's paws, in both.
  A thing goes when its shaders say ready, three new shader-kinds a round, the card let finish between rounds; once
  you play (`rehearsed.playing`), one a round, only with the eye still for 0.5 s, a second apart, not at the PC.
  Nothing is left changed (`drawOnce`: the rest hidden by their layers, so lamps on hidden things still count; a
  lamp that is off stays off; shadows untouched). `GAME.rehearsed`: `left`, `steps` (when, ms to send, ms, things,
  new shader-kinds, at most), `finish()` (all of it now: for measuring). Numbers (M2, cold): the whole of it ~13 s
  of the card's time; loading 24.0 s against 21.7–22.6 s; later visits 14.3 s, the rehearsal 2.7 s beside it.

## Textures (lighten.js, 2026-11-05, pixel-identical)

After the build, canvasTex pictures drawn twice the same are shared, maps read in one or two channels (bump .r;
roughness/alpha .g) stored in that many, and every picture is sent to the GPU then and its canvas (or the model's
decoded image) let go of. A canvasTex picture drawn on again after loading must set `tex.userData.redraws = true`
(the TV, the pencil case, the calendar do), or it comes out empty (`onUpdate` logs it). `?heavy` skips all of it (for
comparing); `?texlog` notes which function drew each. A per-pixel loop that allocates (a list per pixel) once cost 1.6 s of loading.

## The breeze (2026-11-03)

`WIND` in grove.js, its time from `house.update`. Leaf cards, the neighbours' crowns and the moss move only in a
breeze now and then (`breeze`: ~24 % of the time, ~6 s each, ~20 s apart, slow); the willow's shoots all the time
(`windGust`, `steady`; "the only movement I like", slowed a little). In their shaders (`windVertex`); their shadows
stay at rest and they are lit as if at rest (no flicker). The light under the crowns moves on the lawn in the
breezes (`dappled`, mask from `leafLight`: sun and sky, leaves 3 m+ up only; at 18:00 the sun doesn't reach the lawn:
it is the sky's light that moves). New leaves made another way need `windy(mat)` and `userData.leaves = true`.

## The angel's file

His Meshy model, `assets/models/angel.glb`, shrunk once in Blender (decimate 30 %, the texture's seams and everything
up to the feet locked — unlocked, the plinth's texture warped: 660k → 198k triangles; colour 8192 → 4096 px, normal
2048, roughness 1024; 80 → 15 MB). Its shape is packed without loss (meshopt, 2026-11-05: 15.2 → 13.3 MB;
`tools/meshopt-pack.mjs`, decoder in `js/lib`): edit `assets/models/source/angel.glb`, then pack it again.

## Speed: the method that worked (when asked to make it faster)

1. Measure before touching anything, and split it: loading by step (`__marks`, the JS profile), a frame into the
   page's time and the graphics card's (timer query), draws by room and by kind. Each guess made without a number
   was wrong (the "slow" tree limbs were the bark; the draws were not the limit indoors; a depth pass gave nothing).
2. Ask of each cost: is this work whose result is never seen or never changes? (drawn behind a wall, a lamp times
   zero, a shadow redrawn with nothing moved, a file asked for late, the GPU idle while the page builds). That is
   where the same-picture gains are. Take the largest first.
3. Give every such change a switch to turn it off in the same page or by URL (`?seeall`, `?alllamps`), and keep it.
4. Prove the picture is the same, by numbers: the same views drawn both ways and compared pixel by pixel (hundreds of
   poses: every room, doorways, both states of each door); for textures and shapes a fingerprint of all of them
   before and after; for shaders their text, program by program under the same key. Know the noise first (two
   frames, two loads with nothing changed) and add a control (hide something by hand: the check must see it).
5. Measure the gain old against new in the same page, switched back and forth, or with the GPU's timer — not from two
   separate runs minutes apart. On a first visit and a slow line too (`?cold`, `?slow`), not only the warm, local
   case that is always seen here.
6. What does not pay, or cannot be shown to be exact, comes out again — and is written down as tried, with why.
7. Tell him plainly: before/after numbers, how sameness was checked, what was not checked (no Windows machine yet).

## Measuring

- In the real loop with the pane shown, switching old/new in the same page a second or two at a time, several rounds
  (the M2 heats up: fps drift 30 % over minutes, so before/after runs lie). A `readPixels` sync does not reliably
  wait for the GPU here. In the bedroom the GPU is bound by the yard's geometry (porch, trees, grass).
- A `javascript_tool` call that steps more than ~120 rendered frames of the house can time out halfway: step in
  chunks, keep results in `window`.
- `tools/measure-server.py <folder> <port>`: the game served with switches for measuring — `?seeded` the same dice at
  every load (the rug's weave and a few more use `Math.random`: two loads differ without it), `?cold` a first visit's
  shaders, `?slow` the two models over a 20 Mbit line, `?gltrace` the first failing draws (`__glerr`); and always
  `__marks` (when the loading line changed) and a JS profile (`__prof.stop()`). GPU time of a frame:
  `EXT_disjoint_timer_query_webgl2` round one tick, the median of ten. Two loads compared pixel for pixel: `?seeded`,
  the clock frozen, the same walk, the hatch's lamp pinned dark (it has fits of its own), grain off.
- A first visit's stops: `2003-measure` in `.claude/launch.json` (port 8151) with `?cold`, the loop handed over, each
  frame ended with `gl.finish()` + one pixel read back, `gl.linkProgram` counted (2026-11-11: ended with `getError`
  only, a frame's time is the backlog of the twenty before it). The same picture in two loads: `tools/same-picture.js`
  (its routine at its top: the same 3808 frames, eight views, hashes kept between loads).

