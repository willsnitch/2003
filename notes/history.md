# 2003 — history and reasons

Why things are the way they are, and the lessons learned building them (2026-10-03 → 2026-10-27). Condensed on
2026-11-02: superseded attempts were cut, the full old text is in the repo's Git history. `CLAUDE.md` has the rules
and the current state; `notes/world.md` the approved state of the yard and the house. Read only the part you need.

## Rules and where they came from

- **Style coherence first** (2026-10-10: "any asset or environment I ask you to compose, you must keep the same
  style, coherent with what we've done so far. even when you clear the context, remember this… coherence at the base
  of everything"). Then: "the game in the tv won't be replicated as a style, it will stay only there." So the style to
  carry forward is the bedroom's (PBR props from the helpers in `util.js`/`props.js`, canvas textures, real sizes,
  worn, "human touch", the same lighting and grade, no bloom); Zelpa's 1998 look lives only inside the TV. Before
  building, look at the neighbours and compare side by side; if a request pulls away from the look, say so and ask.
- **Specs stated as facts.** He describes the wanted result in the present tense ("the character is definitely
  shorter in zelpa"). On 2026-10-09 I read that as a complaint and made the character feel *taller*; he had wanted
  it shorter. Again on 2026-10-15 with the blind ("the blinds snap down in a sudden movement, as if falling": a spec,
  I first made it slower). Bare statements are specs; complaints carry an evaluative word ("too much", "looks like",
  "doesn't make sense"). If both readings fit and lead to opposite changes, ask once or say which reading you took.
- **Approved bedroom lighting** (2026-10-03: "the lights are perfect like this"): `buildLights()` in room.js,
  environment, exposure and grade. Time of day later moved (16:00 on 10-14, 18:00 on 10-18) through `js/daytime.js`
  only; `DUSK` keeps the original approved values whole. Don't retune unless asked.
- **No third-party IP in the final build** (2026-10-04: "so no copyright strikes"), but "I'll tell you how to
  proceed, for now don't do anything": I had started a sweep of real names and was stopped. New content is original
  from the start; existing branded items are flagged once and left until he says. He has his own plan (parody
  versions: the Spider-Man title is a separate layer `assets/spiderman-logo.png` on purpose — "you'll understand why
  later" — never merge it into the poster). The Dr Pepper can was deleted; the hero figure became an original diver
  doll "inspired by Action Man" (`buildActionFigure`, built from `lump()`; no logo on the arm, no scar — keep it so).
- **The handwriting font** (Strongvilla Fun Cute Cursive, CSS family `Kid Hand`): spoken lines (`#say`, 48px) and
  the inventory's words (36px). The grey prompt boxes, `kbd` and the start window stay in the Win98 system font at
  13px ("put the same font back when you have to select something, in the grey box"). Licence (1001Fonts FFP, copied
  beside it): personal use only — commercial licence or a swap (one `@font-face`) before sale. It lacks `· … × —`.
- **An 8-year-old** (2026-10-04: "let's remember he's an 8-year-old kid"): eyes 1.22 m (crouch 0.78), a deliberate
  middle (a real 8-year-old is nearer 1.17). Scale, reach and the tone of any text follow from this.
- **All in-game text is English** (2026-10-03, after a first UI in another language): start window, prompts,
  subtitles, the cat's lines, text drawn into textures.
- **"Human touch"** (2026-10-05: "remember to have a human touch when you place objects"): nothing a child put down
  is straight, centred or evenly spaced.
- **It is a horror game** (2026-10-05: "the atmosphere is still a horror game's, I remind you"); 2026-10-16: creepy
  horror puzzle, uncanny, a sort of Backrooms, ordinary places that make you anxious. Minimal and restrained.
- **Sound is recordings only.** 2026-10-05: my synthesised footsteps were "senseless", the cat sitting down made a
  noise. 2026-10-15: "the sounds that are there were made by Claude and are awful; the only one I'll keep is the
  pigeon I put in" — every generated sound was removed (see Sound below).
- **Never fix "slow" with physics** (Zelpa, 2026-10-09: "too slow"): speeds and jump were identical in both worlds
  (1.70 / 2.89 m/s, 0.25 m jump); the Hollow had been laid out 3.5× too big. Resize the space. Likewise a jump that
  "doesn't reach the platform": shorten the gap (a walking jump carries 0.78 m).
- **Size is judged against familiar things**: in Zelpa the eye was 1.22 m as in the room, but the glass sat 22 cm
  higher than the TV screen it stands for, so you seemed shorter. Keep reference things (the glass, Luna, floor
  detail) at their bedroom heights and scales.

## The bedroom (2026-10-03 → 10)

- First-person recreation of his reference photo (`reference.webp`, early-2000s teen bedroom). Conventions: metres,
  x east, y up, z south, window wall z = 0, west wall (TV, posters) x = 0, room 3.8 × 4.2 × 2.5. Static shadows
  (`shadowMap.autoUpdate = false`): anything that moves marks them. `?shot=1` hides the start window (a click on the
  picture then starts the game); `window.GAME` exposes scene, camera, player (`setPose(x, z, yawDeg, pitchDeg)`),
  lights, blind, door. Look: the view follows the mouse with no button held (he rejected click-and-drag); without
  pointer lock, the cursor at a screen edge keeps turning.
- **Luna** (female, "Luna/she" in all text), from his photo `cat-reference.webp`: long-haired black, yellow-green
  eyes, pink collar. `cat.js` (procedural rig, A* nav, a queue of steps filled by `plan()`), shell fur in `fur.js`
  (shared with the teddy bear). Bolts if stepped on; E pets her. Test behaviour fast by calling
  `GAME.cat.update(dt, t)` in a loop from the console.
- **Ceiling stars** (`buildStars()`): a deliberately wobbly letter A over the bed; they glow only with the blind closed.
- Console and TV: an unbranded N64-style console with a blank cartridge and one blue pad; the TV square to the wall,
  the console beside it. The TV shows his parody title "The Legend of Zelpa: Kazoo of Space", "©1998 Noentiendo"
  (`assets/tv-title.webp`; the real-game/emulator idea dropped for the commercial release). The TV and the PC start
  **off**.
- **Cables connected at both ends** (pads to ports, mouse/keyboard/monitor to the PC, everything to the power strip,
  strip to the wall): `worldPt()` anchors cable ends; `cable()` clamps samples above a `floor` height.
- Furniture you can jump onto (bed, desk, TV cabinet): colliders carry `top`, `base`, `stand`; the scramble onto
  furniture only when moving towards it.
- Shelf on the headboard (west) wall at 1.3 m with the pine LUCAS letter train (engine, five wagons, rear van). The
  Spider-Man poster came down by mistake when the shelf went up and was not put back (the item he flagged): ask
  before re-adding it.
- Blue swivel chair after his photo: E sits you at the PC (fixed view, fov 36), Tab gets up. **The PC** (`pc.js`):
  "Macrofrost XD" (his parody name; he asked for XP, not 98), original frost-crystal logo (`FROST`, restyled "so that
  it's more of a logo"). Boots slowly (POST, logo, welcome, desktop), shuts down, windows lost. Notepad, Minesweeper,
  My Computer, My Documents, Recycle Bin. Its lights dark when off, green when on.
- Knobs: brass was "too glossy"; then "the furniture knobs are grey" (spec) → `M.knob`, dull grey; door knob,
  ceiling rose and backpack buckle stay brass.
- **The backpack** (2026-10-05/06): "it has a zip that goes from side to side, and the front, after the zip has
  opened, slumps down letting everything out". The pull runs the zip, the front folds down along its bottom seam;
  the notebook rides it out; the pencil case is thrown off, rolls 270° and loses its contents through its half-open
  zip as it falls ("it falls straight and things jump out with no logic" was the first version). Everything lands
  within ~35 cm ("too far" at half a metre). The dark-brown yoke with straps stays "just for looks"; inside dark
  brown, not black. His images: notebook "Name: Lucas, Grade: 3rd, Subject: history"; case "MATH SUCKS" /
  "PROPERTY OF L.G.".
- **Inventory** (2026-10-10): "I opens the inventory, it's a semi-transparent black overlay like for the text, but
  with three-dimensional grey borders. the objects inside are 3d exactly as in the game. you can select the object to
  hold in your hand." The sheet is drawn by the renderer; each item's real model renders live in its slot; the chosen
  slot's border is yellow (he disliked a dotted one). The held thing follows the camera, `gl.depthRange(0, 0.1)`.
  `takeable()` in props.js; "the objects you can pick up have a thin glowing blue/white rim" (`rimOf`, 2 mm; brighter
  went white), shown only while you look at the thing. Nothing uses the items yet.
- Stepping the game for screenshots: replace `requestAnimationFrame` so it stores the callback, take one screenshot,
  then call it yourself after advancing a fake `performance.now` (works even when the pane isn't drawing).

## Zelpa, inside the TV (2026-10-09/10)

- Entered by jumping at the switched-on TV ("Space jump into the screen"). An original room, **the Hollow**, inside a
  giant tree (it must not copy the real game). The look of 1998: drawn to a 240-line target, low-poly with lighting
  baked into vertex colours, tiny bilinear canvas textures, fog. "remember to think visually like a game released in
  1998… the button at the top and the hearts are too advanced": HUD sprites set down pixel by pixel, a 5×7 bitmap
  font (`zelpa-hud.js`) — test anything new there against "would a cartridge of the time have had it?".
- **The way out** is a glass the TV screen's size (0.45 × 0.345 m, at the screen's real height) showing the bedroom
  live "as if we were on the other side": a cube map rendered from in front of the TV, through a fisheye lens
  (`r*1.05 + r³*0.17`). Stronger lens and colour fringes were rejected ("no blue-red effect… bring the fisheye back");
  "opacity" means the milky veil, and he wants little (`uVeil` 0.04). The room through the glass is not pixelated
  (the low-res picture has a hole in its alpha over a full-res render).
- The hero is shorter on purpose: eyes 0.80 m (his title art's hero is a garden gnome). The item on top of the
  heartwood is a **wooden ladle** (his logo's stand-in for a sword). Peg ladder to a loft (nothing in it yet), guarded
  by an original **rooted man-eating plant**: a toadstool on a hunched stalk, the mouth a seam up the stalk laced with
  teeth, never leaving its post 0.52 m from the ladder; it bites, then is slow to lift (the moment to hit it with the
  ladle); three hits. Its mouth "breathes" open now and then, red inside. Keep enemies original even when he names
  another game's creature as the reference for behaviour.
- HUD: three hearts, a map, and an action badge — a flat dark primary blue disc (#0b2aa8) with a black edge, one word
  across it. No planet in the sky, no blue beam over the ladle, no gallery posts.
- Past the gallery a passage runs east towards the bark ("rotate it 90 degrees") to a vault with a pit and a hanging
  slab (gaps 0.35 m); a second guard over a chest that holds a **key** (nothing uses it yet).
- **Luna follows through the glass** both ways ("luna jumps after us inside, she becomes all pixelated"): drawn flat
  (`setFlat`, `lowPoly`), each part swollen by the **full** fur length so her face stays round ("more scraggly and
  small… in the room the face was rounder"). Compare her in both worlds from the same camera.
- Gotchas: `node --check` misses duplicate `const` in these modules — check a `.mjs` copy; a state machine's terminal
  state must stop running. Console: `GAME.warpTo('zelpa' | 'room')`.

## The rest of the house (2026-10-14 → 15)

- From his hand-drawn plan (drawn rotated: plan-right = north). Corridor along the bedroom's south wall; Mum's door
  (locked, her room "will not be accessible"); the bathroom "long and narrow", all small white tiles, no window; the
  kitchen + living room as one room; the front door locked ("goes nowhere"); the back door to the yard.
- **Why two scenes**: the house is a separate scene drawn after the bedroom with shared depth, each with its own
  lights and static shadow maps — the only way to keep the approved bedroom lighting untouched (no house lamp lights
  the bedroom, no bedroom point light leaks into the house). Consequences: walls block interaction rays; Luna moves
  into `house.scene` outside the bedroom; `zelpa.lookOut` renders both.
- **Light leaks, causes found** (the rules are in CLAUDE.md): walls must reach into the roof and the roof cover
  every room; three.js picks shadow casters by the *viewing* camera's layers, so a layer-only shadow mesh casts
  nothing — use `shadowOnly`; the sun's bias ate through the inner wall face — `shadowTwin` puts the shadow at the
  outer face (attic volume included); doorway light strips were the sky seen through the missing floor in wall
  openings (`hingedDoor({ sill })` + a dark slab under the house); a SpotLight's bias is in perspective depth
  (`near` 0.5, bias −0.0001 for the bedroom's spill); RectAreaLight window panels light through walls (skipped
  inside the bathroom). Method: pin each light's intensity with a getter (`house.update` resets some each frame) and
  read pixel averages — never guess.
- **White things glowing**: daylight from spots near the glass blasted anything white nearby → `RectAreaLight`
  panels the size of each window (never a point/spot light within reach of white things). No bloom: "the problem is
  this glow around light objects, even the cat's eyes have it, which absolutely shouldn't be". On 10-15 the kitchen
  whites were "as if lit differently, too bright… the only thing that works is the plates": small things without
  `receiveShadow` were lit by the sun through the roof; the kitchen tiles had the bathroom's bright `cool` env;
  bedroom white under the house's flat hemisphere fill looked self-lit. Fix: every opaque house mesh receives
  shadows; house whites no lighter than the plates (≈0xd5cfc2, rough ≥ 0.45). `envMapIntensity` is ignored with
  `scene.environment` — give a material its own `envMap`.
- Bathroom: lit by flush drum ceiling lights (pendants and wall sconces were rejected); now 14.5 m with three. The
  toilet lid lifts with E; flush. Wall cabinet (grey enamelled steel, knob on the left, opens, two shelves) over the
  basin. The door starts shut and **slams** behind you once you're in (and Luna is in): "shuts faster and less softly,
  a real slam" (`state.slam`: falls shut with acceleration, a small bounce). The switch is on the latch side.
- **The UV torch** ("in the cabinet there is a UV torch, for finding traces of blood in the bathroom… They show only
  when you turn the light off; there is a switch at the entrance"): unbranded, on the cabinet's lower shelf; held =
  on, a violet SpotLight from beside your eyes (from the torch's end it lit through the basin). The traces in the
  basin (`basinTraceTex`) glow only in its beam with the light off. Light off: the room's ambient scaled to 0.025
  (0.095 with the door open); water, steam and the underwater overlay scaled by the room's light too.
- The basin tap runs ("it doesn't clog"), never fills. Kitchen cooker: the clock centred above the knobs, each burner
  lit by its knob (blue flames, no light). Fridge and freezer open (a real cabinet, contents, its own small shadowed
  lamp). The living-room TV gives grey static, its flicker light placed *behind* the glass (in front, the glossy screen
  showed it as a spot).
- Gotcha: a Python splice between markers duplicated a third of house.js when the end marker was found before the
  start — search the end marker from the start position.

## Water, the bath, Luna's boat and dive (2026-10-14 → 17)

- **The bath works**: hot and cold taps (E on either turns both), fills, steams, overflows over the front, then the
  bathroom floods up to just under the ceiling; the water stops in the doorway like a glass wall (its face behind the
  shut leaf). You float once it covers you (no gravity, WASD slower, Space up, C down, crouch on the bottom).
  Underwater overlay, your breath's bubbles, bubbles from the tap under water ("so you can tell the water is still
  coming").
- What water looks like (`water.js`): waves, Fresnel, planar reflection, caustics; from below, Snell's window and
  the water's own blue-green getting darker with distance ("not black", "darker little by little"). The side is
  decided by the camera's height, not `gl_FrontFacing` (transparent DoubleSide draws twice). `RippleSim`: the wave
  equation on the GPU; anything that stirs the water calls `bath.disturb`. A volume patch on every house material
  tints what is under the water by the length of the sight line (the near surface falls inside the near plane when
  your eye is just above it), with a dry region inside the floating boat. **Water running down a wall shows as what it
  reflects and the wall darker under it** — a pale film read as "white ropes".
- Sanitary white 0xf1f0ec, env 0.45 (he hated brighter). A grey band in the bath/basin bottoms was the geometry (a
  crease and a fan of thin triangles): smooth profile, rings across the bottom.
- Towel: hangs to the waterline, then lifts off and floats as a doubled sheet. The rubber duck (unbranded) floats
  off its corner of the bath, drifts slowly, can be pushed.
- **Luna's boat** (his sou'wester photo; design my own): a small wooden rowing boat comes up beside her once the
  water passes the first tile row; she jumps in, wears the sou'wester (brim turned up in front, ears hidden) and
  **sits facing the bow**, never lies down or turns round (looks about, at you, washes). It drifts bow first, turning
  first towards where she looks, clear of walls, fixtures, the door's sweep, the towel and the duck.
- **"Her body must never pass through any material or object"** (2026-10-15): `Cat.keepClear` pushes every probe
  sphere (fur included) out of colliders and moving obstacles; in the boat, clip planes (`cat.clips`) hide fur
  beyond the hull so it reads as pressed against the wood.
- **Full** (her hat would touch the ceiling light): she suits up in the boat, leaps off the bow, and swims; the boat
  sinks onto its side, never onto a fixture. The suit (his picture of a cat in a wetsuit and bubble helmet, look only):
  dark petrol blue (0x285a66) following her own furred silhouette ("the tail mustn't be skinny"), orange piping and
  cuffs, yellow tank, a glass bubble resting on her shoulders with no neck piece ("no squashed, stretched neck like a
  tube"), bubbles from the regulator that run round the glass. She swims anywhere from the floor to the top, now and
  then to you, hovering to look at you; leaving, she swims out under the doorway's water and the suit comes off.
- Lessons: check the winding of every hand-built surface (the suit, the flamingos' lofts were inside out — you see
  through them); clip planes on all her materials cut her paws too — give clipped parts their own materials; a boat
  "stuck" test must count only real movement (a deadlock with Luna in the doorway); Luna's off-limits cells that
  nobody can reach are traps she walks into.
- **2026-11-02, the cycle** (state in `notes/world.md`, "The bath's cycle"): "when you open the bath's water you can't
  close it" was a spec, not a bug report (rule 3) — a long test hunting a bug came first. The drain is a rewind: what
  the water carried goes back where it was. The poof is cartoon on purpose ("cartoonish, not realistic vapour… little
  clouds around, the classic animation of something vanishing"); a soft vapour cloud was turned down.
- Lessons from it: swimming, the "head just breaks the surface" clamp ran after the floor clamp, so water going down
  fast took you down through the floor ("the character crouches for some reason") — the floor clamp comes last. A
  landing spot for Luna needs room for her helmet (0.42 m), not her walking radius (0.17): the toilet's cistern held
  her up in the air. A boat righting itself as it slides needs its lowest hull point checked (a corner went 3 cm into
  the tiles). Metric tiles count from world zero, so a room whose walls are off the grid gets cut tiles: its own
  material, texture offset to its wall (`fromWall`). Soft canvas sprites: white on black as an `alphaMap` (a colour
  map drawn on a cleared canvas gives dark rims).

## Sound (2026-10-05 → 15)

- `js/audio.js` only places and plays recordings, by name (`BANK`; `assets/sounds/README.txt` is his list; takes as
  `name-1`, `name-2`). Missing file = silence. The generated version is kept in `notes/removed-sounds/`.
- Only `pigeon-1.wav` is in. His earlier `bird-1/2` and `step-carpet-1/2` are in `notes/removed-sounds/` (he said to
  keep only the pigeon; put them back if he meant only what I had generated). His source folder:
  `~/Downloads/ROOM HORROR GAME/`.
- Street sounds come from outside, far and muffled ("the bird sounds have to come more from outside"): 9–16 m beyond
  the window, mostly echo, low-passed. The pigeon is loud only in the bedroom, faint elsewhere, silent in the bathroom.
- His recordings: very quiet with sub-audible rumble — high-pass before levelling; clean with band-limit, gain,
  `afftdn`, a gate set per file, trim. On low tonal sounds (the pigeon) `afftdn` sounded "metallic": band-limit and a
  gentle gate only. Check with a 20 ms RMS envelope. Footsteps (his design): two takes in turn, left then right, every
  walk restarts at take 1, the first footfall after 8 cm.
- Test audio with a real click (a scripted `.click()` leaves the AudioContext suspended).

## The yard (2026-10-14 → 20) — approved state in `notes/world.md`

- The yard, the street out front, neighbours, the grove, play things, hose, porch: built round after round from his
  photos and notes. What to keep from it, beyond `world.md`:
- Lessons: `bakeStatic` drops vertex colours (`userData.live`); a DoubleSide cut-out with a set normal goes black on
  its back face (`bothFacesLit`); canvas cut-outs get dark rims (`bleed()`); a Catmull-Rom through a corner
  overshoots (build bends as Bézier inside the corner); metal reflecting the dome's blue reads as plastic; a Voronoi
  bark with round cells looks like rope (flatten the tops, long cells); a twig in a leaf texture reads as a stick
  near the eye. A rope against a thin pole needs its *lengths* kept off it and a drag limit. Leaning instanced boards
  in one plane z-fight. To trim a grown tree, cut it back *after* growing (its RNG shapes everything).
- **Speed** ("it lags since the willow": ~9 fps on his M2): every outdoor pixel computed all 12 house lights;
  `outdoorsOnly` gives outdoor materials only sun/sky/hemisphere (~19–26 fps). three.js writes light counts into the
  shader before compiling, so patch the conditions in the text. Luna's fur behind walls cost frames (`catInSight`).
  Measure with no other preview of the game open. The old `grid()` (240 frames in one task) lost the WebGL context
  and Chrome blocked WebGL for localhost: yield between frames.
- **The raised house** (2026-10-20): "the rooms look lit differently from the yard" — the yard's eye dimming was on
  the sun itself; now `twoFills`, `outdoorSun`, `splitOutdoor`. The porch was worn round after round ("too new",
  "random scratches", "edges too perfect"): `wornWood()`. Lessons he set then: "faded" is a lighter shade of the same
  colour, not white; wear only where use is; marks must read at 2–3 m; counts he gives never come from an RNG.

## Mum (`js/mother.js`, 2026-10-23/27): how we worked on her

- **The figure.** His Meshy AI model (`assets/models/mother.glb`; licence to clear before sale). Prepared once in
  Blender: colour 4096 px, the rest 1024, 188k → 66k triangles, welded and smoothed, no normal map (8 MB instead of
  90). Mixamo-named rig with walk/run/shout clips; the hands have no finger bones. Skin found per UV island
  (`skinOf`), lone specks mended (`mendSpecks`: the "orange specks"), a 15 % cold filter on the skin.
- **How a round on her went.** He sends a screenshot and one short line ("the arm goes into her body", "look at the
  thumb", "fix these scars and that index"). Find the cause in numbers first, change one thing, check the *whole
  motion* with a metric, then 2–4 close-ups (25–50 cm, four sides) plus one at 1 m from where he stands. The first
  fix was often wrong for a reason only the next look showed — one change, measure, look, again.
- **Her pose is set by hand every frame** (the AnimationMixer writes a bone only when its value changes, so turns
  added on a held pose piled up — her neck spun). Folded arms after his photo (`FOLD`, found by search and measured:
  no arm inside her). Head follows you (`SHARE`, `LOOK` 75°, ahead again behind her), with lag and ease. Breathing
  (`BREATH`, chest 4.5 mm — he halved it), never two breaths alike.
- **Moving like a person, not in parts** ("it looks divided into parts that start one after the other"): one
  continuous plan — a Bézier path, turning as she sets off, slowing into the stop, reaching while still arriving,
  shorter steps at the end, the walk clip locked to her speed, a real step back before turning home. Two-bone IK
  arms, twist in the forearm. Timing in `ERRAND`/`LOOKS`.
- **The hand** (no finger bones, the shape itself is bent): `curlHand` reads the hand's axes from its points; the fist
  is staged morph targets (thumb first) — a straight blend cut the fingertips through the handle. Each finger bent at
  its own three joints in its own plane (`wrapFingers`, angles found by search against the real handle): one curl round
  a slanted line wound them into helices ("that index"). Thumb flood-filled from its tip, its root eased into the
  palm (held rigid, the skin stretched — "scars"); points split at a seam move as one.
- **The grip is geometry, all of a piece**: handle 32° across the palm, the hand rolled round it, wrist cocked to the
  little finger (`ULNAR`), her stance turned 30° (`STANCE`). Change one and the elbow and feet move — re-run every
  metric over a whole errand.
- **Checks** (numbers before pictures): skin stretch over the morph; seam gaps; fist points against the handle's box;
  arm points against the torso over a whole errand; legs against the cupboard doors and plinth; wrist angle from the
  forearm bone. Fast loop: `curlHand` on a clone rendered alone with a box for the handle (30 ms a try); the module
  imported again from the console is the game's own instance; never add a HemisphereLight to `house.scene` in a
  test render (the baked house goes black).

## Speed and the breeze (2026-11-02 → 03)

- He asked for "lighter, where possible, without losing quality or details": every change was checked against the
  old picture pixel by pixel (mean 0.01/255) and measured old against new **in the same page, switched back and forth**
  — the M2 heats up and before/after runs drift 30 %; a `readPixels` sync doesn't wait for the GPU here. In the real
  loop the GPU was the limit, and mostly by geometry: from the bedroom, 3.3 M triangles of yard and house behind the
  walls (porch 1.2 M, trees 1 M). Fixed, all with the same picture: the multisampled picture resolved once instead of
  three times with depth (`sharedPicture`); the kitchen lamp's cube shadow, redrawn whole every frame Mum moved
  (6.6 M triangles), now two layers (`layeredShadow`); the bedroom pass left out when unseen; from inside the bedroom,
  what can't be seen through its window or door left out of the house's picture, not its shadows (`hideUnseen`);
  shadow lookups skipped on surfaces facing away from a light. The porch in pieces (`inPieces`) alone gave 1–2 fps.
- The breeze: first a steady wind on everything; he liked only the willow ("the only movement I like, a little
  slower") and wanted the rest "light, slow and random, not too repeated, as if a breeze moved the leaves now and
  then, not all the time". So a `breeze` that is zero most of the time, from value noise (no beat), crossing the
  garden. Leaves move only where they are seen; their shadow lookups use where they hang at rest, or they flicker in
  their own shadows. His "shimmer on the lawn": at 18:00 the sun lights only the crowns' tops (checked with the sun
  alone switched off), so what moves is the sky light's spots under the crowns (`dappled`), and only where leaves 3 m+
  up are what's in the way (not a fence's or the shed's shadow, nor the grass's own).
- Lesson: a `sin`-based hash of large numbers differs between the GPU and JS — a test picking "a gusty moment" in JS
  found the trees still. Use an arithmetic hash (`windDice`).

## The bath's film, the pool's bubbles, grass at the edges (2026-11-03, later)

- "Up to the sixth tile a pale film on the water": the bathroom had one planar reflection, and while the floor's water
  was still apart from the bath's (under the rim, 0.55 m) it went to the bath; the floor's showed the white room it
  reflects when there is none. Each now has its own while both show (`floorMirror`, `floorU`; ~95k triangles more for
  those seconds). Found by reading `bath.look.roomRefl` / `bathRefl` at a level, not by guessing.
- The pool's bubbles: "horrible — not white, the rings too perfect; realistic, soft, a movement of the water that
  spreads; light green, in keeping with the pool", then "darker". The ring is now the water's own slope in its
  shader. Its sky is flat, so a ripple shows only where its slope runs along your view, the very parts a pixel's
  footprint thins out at a slant: fading by the whole footprint killed them past 2 m; by each ring's own (`fwidth(r)`)
  and slightly longer waves they hold to ~3 m.
- The pool wall's worn patches ("too AI, not realistic"): a careful redo was turned down outright — "put it back
  exactly as before" — and was put back, dice and all. With a look he complains about, show a small step before a
  remake, and keep the old code to hand.
- The line where the grass ended at the porch was a black box 4 cm behind its skirt; grass going on under a deck
  needs its light taken away too (`underDeck`), or it glows in there.

## Testing

- The Browser pane forwards his real input: set `GAME.player.setPose(...)` before measuring; aim rays at object
  centres. A raycast from the camera first hits helper planes 0.3–0.5 m out: filter `distance > 0.8`.
- With the pane hidden, screenshots are stale: copy the canvas to a 2D canvas right after a frame, POST it to a small
  local receiver, Read the JPEG (`tools/harness.js` + `tools/snap-receiver.py` do this). If the pane is closed the
  page can have zero size: `resize_window` first.
- Check motion frame by frame with a fake `performance.now` advanced 50 ms a frame.
- A `javascript_tool` call stepping a few hundred rendered frames of the house times out ("Internal error") and may
  stop halfway: step ≤ ~120 frames a call, keep results in `window`. Real keys in the pane work (`computer` key), but
  unlocked the view follows the mouse: set yaw/pitch in the same batch, right before the key. `say('')` leaves the
  last line up for its 3 s.
- Copying the canvas after an `await` gives black (the picture is already handed over): step one frame right before
  `drawImage`, as `grid()` does. To judge something small at play distance, crop the full-size canvas round its
  projected point instead of zooming the camera.
