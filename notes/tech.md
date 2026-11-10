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
  in the house scene and she stops drawing; merge or drop a map first.
- A mesh from surface nets or any generated field: check the winding against the normals (in the game you see its
  inside: "the face has gone"). `Math.hypot` is slow in a hot field. Custom samplers on sRGB textures return linear.
- Metric UVs count tiles and boards from world zero: a room whose walls are off that grid gets cut tiles at them —
  give it its own material with the texture offset to its wall (house.js `fromWall`, the bathroom's `tileX`).
- Under the floor (`basement.js`): Luna's `Nav` skips colliders with top ≤ 0.03; whatever the house scene has below
  the floor shows inside the basement (`cellar.passes`), so it keeps out of `UNDER`. basement.js burns 2711 draws of
  its shared RNG where the wooden doors were: anything new before the steps uses its own RNG, or the basement moves.
- Random numbers in shaders: no `sin` of big numbers (the GPU's differs): `windDice`.

## Lines along edges that come and go

Lines that come and go as you move, at corners and along edges seen side-on, worse in a small window: the
multisampled picture works a surface's point out past its edge (shadow lookups landed outside the walls, in the sun;
position boxes like the bath's dim or `corridorFill` read "outside"). Shadow coords are `centroid` (main.js); any new
varying position used for a box test or a lookup must be `centroid` too, and a box must reach into the walls as far
as the ceilings do (13.5 cm). Reproduce at 760×450, not full size.

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
