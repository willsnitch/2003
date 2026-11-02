# 2003 — approved state of the yard, the wood, the end of the garden, the house outside and inside

Read the part you need before touching any of these things, and keep it up to date as they change.

## The yard, the wood, the house outside (approved state, 2026-10-20)

- **Yard** `PLAN.yard` x −5.28…3.92, z −14…−0.12 (6.8 m longer than at first); everything past the far fence
  (neighbours' houses, their trees, the alley's poles) is shifted by `DZ` in yard.js. Far trees (`trees()`)
  grow round the houses' volumes (`HOUSES`, `OURS`, `inHouse`), never hang into the yard, keep off the wire.
- **The house's power line** comes from the east pole (7.25, 8.6, −16.2) to a hook on the bedroom's north
  wall under the eaves (3.6, 2.3); `poles()` returns its points; every crown keeps ≥ 1 m from it.
- **The wood** (`grove.js`): five tall trees in `GROVE` (position, crown reach, `foot` = trunk radius at
  the ground; `seed`: kept when a tree moves): oak in the middle (limbs from 0.85 m, nearly level low down:
  `floor: 1.0`, `angleLow`; crooked — `kink`: turns at knots — and parting in two at their ends — `fork` —
  not tapering to points (they looked like early-2000s spikes); leaves down on its low limbs too, thinning near
  the eye; its bark after his two photographs, grey, narrow fissures, lichen dots; `oakWounds()`: openings
  where the bark has come away, wood showing, the lip rolled round them (`aWound`, shader in `barkMat`)),
  maple, at the back on the left a weeping
  willow (they swapped places 2026-10-18; the leaning flamingo right behind its trunk, turned three-quarters
  to the right seen from the house; was a beech; darker leaves; `dropSides`: its great limbs to the west
  and east left off; `willowCurtain()`: tall cards of hanging shoots, the outermost each way round down to
  ~0.5 m, inner ones short, those hidden behind the curtain left off; they thin away near the eye, you walk in
  through them). Oak and willow can't grow into the swing, shed, slide or flamingos (`under`); nothing of the
  oak over the swing at all (`tall`), its limb that went that way turned up (`G.steer`). Silver birch (big trunk,
  long arching branches hanging at the tips), spruce (16.5 m, crown from 1.9 m, a skirt collider). `HABITS`
  holds each one's growth per level; `grow()` cuts a limb where `blocked()` (below `floor`, default 1.95 m;
  low by the fence; the wire; another trunk). Changing how often a tree draws from `r()` reshapes all of it:
  to trim a tree, cut it back *after* growing (`cutBack(G, inside)`: limbs know their parent, `from`) — that is
  how nothing of the oak or the spruce comes within 1.5 m of the birch's trunk (2026-10-18). There is no beech
  any more (he still says "faggio": ask or check which tree he means; it was the oak/spruce branches in the birch).
  Leaves = spray cards (`leafSprayTex`) with bent normals (`aBend`) and an edge-on fade (`vFacing`).
  Bark (2026-10-18): `T.groveBark(kind)` works out heights first (Worley cells, tiling) → colour, normal map,
  and blurred heights that `tube()` pushes the surface out/in with (`RELIEF`, full only on trunks); tubes go
  through a smooth curve, flare into lobed buttresses (`FLARE`) + `roots()`, limbs swell into collars; the
  birch's black fissured foot blends into the white (`aMix`). `userData.live`. Colliders: trunks, the oak's
  low limbs, the skirt. `surfaceRoots()`: a few roots on the oak, maple and willow run out over the ground,
  in and out of the leaf litter, before they go down.
- **Play things**: the slide (`TOWER`): a tower of old timber (`timber()` in yard.js: rounded-off edges, the
  grain of `oldTimberTex` along each piece's length, each from its own part of the texture), wooden ladder, stainless chute turning a
  quarter circle into the sandbox (reflects `M.yardEnv`, a pale sky — the real dome made it look blue
  plastic). You climb it: `ctx.ladders` (player.js ladders; a leaning one: `lean`, `out0`, `over`), the deck
  a `stand` box, rails and posts as colliders; on the deck E "Slide down" rides the chute (`player.ride` with
  `hint: ''`) into the sand, sitting down and standing up eased (no jumps); the spade stuck upright in the sand in the far left corner (seen from the house), a hose `capsule` round its handle until it is taken; the chute's legs hang off cross
  bars under the sheet with straps up its walls; worn (2026-10-18): rust patches and runs on the chute
  (`metalSlideTex`, its own draws so colour and roughness agree), rusty legs, the tower's post feet damp and
  green, rusty bolts, treads rubbed pale. `SANDBOX` 2 × 1.7 m: the sand is its own heightfield, dug
  down to `PIT_FLOOR` (−0.14: a pit under it, the lawn cut away there, lined with earth); the spade is `takeable` ('spade'); held,
  E on the sand digs (`when` on an interact, main.js), sand thrown to your right, volume kept, shadows
  redrawn via `yard.shadowsMoved`. Swing: W leans you in on the forward half, S on the back half (in turn:
  ~70°); eyes 0.72 m over the seat; E drags your feet to a stop, then you get off; empty it only drifts a hair
  (a wandering rest point, integrated — never added on top).
- **Ground**: `woodland(x, z)` fades the lawn into leaf litter towards the trees (painted leaf by leaf in
  `yardGroundTex`, needles under the spruce: `needleFall`); `leafHeaps()` = random lumpy heaps round the
  trunks, root heaps on some sides only, patchy drifts against the fence → a mound mesh (ground texture,
  casts shadow) plus ~instanced curled dead leaves (`deadLeavesTex` atlas) lying on its surface. Never
  floating: every leaf sits on `heapAt()`.
- **Grass** (`longGrass`): short, uneven, mown; long only where the mower can't reach (fence, shed, trunks);
  each tuft coloured from the ground picture under it; in the wood only rare short tufts and a few tall ones
  by the fence. He judges grass hard: no dark contrasty tufts, nothing even or repeated.
- **The hose** never goes into anything (2026-10-18): it lies on `ground(x, z)` (leaf heaps, sand, every
  root), goes over low boxes and round the rest (`hose: false` for colliders it ignores; `extra` hose-only
  shapes: sandbox boards, the ladder, `capsule`s for the swing's and the slide's leaning legs, `trunk`s — each
  tree's own shape ring by ring from tube(), so it lies against the bark with no gap), and the curve drawn
  between its points is pushed out too. Thin poles (swing/slide legs, flamingo legs: `polesOf`) keep off its
  *lengths*, not just its points (`keepLengthOff`, last word after the length constraints, with the side it was
  on a moment ago), and the drawn curve's pieces too (`keepChordOff`); wrapped round something it holds you back
  (no further than 1.04 × its length the way it lies) — pulled on, it had gone straight through a leg. Tested:
  0 frames in a leg over 2139 frames of walking round them. Its water stops at boxes, trunks, flamingos (they
  have colliders now) and the ground. Clicking the wall where it hangs (tap, hook) hangs it back up, held or lying. Taking it or hanging it up redraws the sun's shadows (`moved` → `yard.shadowsMoved`): the coil's shadow stayed on the wall.
- Outside the back door a coir doormat (`coirMatTex`, no words). The bedroom window's glass is one-sided, from the room
  (two-sided, the room's reflection showed from the yard); from the yard a second, outward-facing house pane (`M.pane`, FrontSide, in house.js) shows the glass. Its frame inside is matte with its own dim reflection (it glowed). The blind can't be worked from
  the yard (`when` on its interact: he doesn't want the option there). A flamingo stands on the roof over
  the back door, a little to its left seen from the yard, leaning right, facing the swing; another on the
  birch limb he pointed at (leaves the trunk at 3.15 m, runs west; feet ~3.5 m), facing the far fence, leaning
  forward looking down; placed by a search, each wire leg its own length (`feet()` in `flamingo()`) so both
  stand on the sloping bark. Seen from straight below the limb hides most of it.
- **The fence**: boards that lean overlap their neighbours — never in the same plane (they flickered): every
  board 0/3/6 mm back in turn, the ones leaning well over 22 mm behind. About ten have a knot hole (shader
  discard by instance hash, also in `customDepthMaterial` so the sun comes through).
- **Luna out of sight** is not drawn (main.js `catInSight`, rays against the walls, doors and windows open):
  her fur shells behind the walls made the swing stutter (house render 13.6 → 4.4 ms).
- **Speed out there** (2026-10-18, "it lags"): every pixel of `house.scene` worked out all 12 of its lights
  (lamps with cube shadows, window panels, the corridor's spot). `outdoorsOnly()` (build.js, called after
  `bakeStatic` in house.js) gives every material that is never used inside the rooms lighting code with only
  the sun, the sky and the hemisphere: the yard went from ~9 to ~19–26 fps on his M2, same picture. Anything
  new made for outdoors after the build needs `outdoorLit(m)`. Cut-out cards cost a full shaded layer each:
  keep foliage to what can be seen (the willow drops the shoots hidden behind its curtain). Measure with nothing
  else drawing on the GPU: with another copy of the game open (another chat's preview) even the bedroom fell to
  24 fps; alone, everything ran at 60.
- **Light out there**: `YARD_LIGHT` (house.js, 1 — back from 0.72 on 2026-10-28) dims the yard to the eye while you're out in it (the
  sky dims less); indoors nothing changes. `outdoorLight` fits each shadow box to house + yard + 17.5 m
  crowns. Camera far plane 50.
- **House outside**: hipped shingle roof (`hipRoof`) over the main block, flat pieces = soffit/fascia and
  the wings' roofs; rusty galvanised half-round gutters (yard and street sides) and downpipes
  (`rustyMetalTex`); back door with an aluminium threshold (2026-10-19, after his photo — shape only: opens OUT into the yard over the doormat, its leaf 2.8 cm off the floor; green paint peeling (`peelingPaintTex`), big pane with a lace curtain inside (`laceTex`), below a grille of big squares with a rusted, torn wire screen behind it you half see through (`wireScreenTex` as alphaMap, `wireScreenWearTex`), wide peeling white casing with a drip cap (`worn` in `hingedDoor`); lit by the kitchen lamp too; no sidelights — the kitchen units stand right against both jambs inside); the yard-side walls peeling white clapboard (`peelingSidingTex`, 2.64 m floor to roof, worst low down); the flamingos' eyes keep the 16:00 yellow's hue (`eyeYellow`: compensated by the sun's colour) but at 0.6 of it, rough 0.7, and take shadows (2026-10-20: they looked lit on their own in the shade); the tap (flange, valve, spout down, red wheel)
  with the hose's coupling; the coil's loops side by side on a long hook, the nozzle hanging off the far side.
- **The porch** (2026-10-20, `porch()` in yard.js, all of it `wornWood()`): along the kitchen only, x from the
  yard's west edge to `PX1`, 1.85 deep, level with the floor; 4 steps down to the lawn (stairs walked up via `step`
  colliders), a handrail each side ending on a short post as high as the rail. Light brown-beige wood faded by the
  weather (`BEIGE` multiplies `oldTimberTex`). Posts only at the corners and either side of the head of the steps
  (one too many was taken out), no higher than the rail. Balusters each slightly different (width, set, lean); in
  the front railing three gone (x −4.15, −1.11, −1.59) and five gnawed (−4.89, −4.64, −3.59, −0.43, −1.21), one
  knocked askew. Deck boards in staggered lengths, two snapped with a gap, five gnawed along their sides; edges
  rounded unevenly and nicked, sides wavy (`wob`), gaps 4–10 mm. The path from the doormat to the foot of the steps
  (`rubbed`) is a lighter brown, smoother, edges rounded right off, hollowed ~4 mm; the scratched texture only
  there, on the treads and in a few scattered spots (deck shader: `aWear` = [scuffed, rubbed]). Treads dented,
  chipped and nicked all over. `wornWood` options: `round`, `ends`, `wob`, `nicks`, `chips`, `marks`, `dentK`,
  `gnaw`, `deck`/`tread`, `broken`, `damp`, `lean`, `rot`, `step` (see its comment). The deck is ~250k vertices.
  The hose's tap and coil are on the house wall right of the back door (over the porch); the cellar doors on the
  wall beside the porch, east of it; the east downpipe runs down to the lawn.
- **The bedroom window from the yard**: its sash and blind belong to the bedroom's scene, lit by the bedroom's own
  sun; `outward()` (room.js) lights their outward faces for the yard (`YARD_SUN`) and gives the light coming in the
  house sun's shadows (`HOUSE_SUN`, util.js), sampled where the light enters in front of the wall (to the house's sun
  the bedroom is one solid shadow block). The casing, sill and outer pane are house-scene meshes.
- Indoors, recent: fruit bowl (no lamp shadows, see Traps); kitchen chairs pushed in but one; Luna's eyes
  take the house's shadows in the living room/kitchen (`cat.housed`; not in the bathroom, where they were already right); sofa tears (`projectDecal` `front`/`turn`); the ashtray is a
  collider Luna walks round. Kitchen (2026-10-18): tiles right into the corner (bare wall showed there), kettle
  handle on two feet, a chopping board with a knife right of the cooker (`choppingBoard`), a stoneware pot with
  a ladle and a wooden spatula in the corner (`utensilPot`). Luna and the kitchen table: perches can have
  `edge`/`drop`/`arc` — she goes to the edge and leaps out then down (`out`), or up then in (`rise`); her legs in
  the air never reach below her take-off plane. Check her against furniture with her visible meshes' vertices
  (parents' visibility too: tucked legs are hidden), not `rig.probes` (those include a margin).
- Indoors, 2026-10-19/20: living room, kitchen and corridor ceilings white (`ceilingTex`); the corridor's lamps,
  shadows and the light from the kitchen/living windows made continuous (no hard cut at the doorway), its far end
  darker, its flicker more often and each one different; a brass strip where the corridor's carpet meets the living
  room; the carpet one piece with the bedroom's; the wallpaper worn and faded (`wallpaperWearTex`); the family photo
  (his) 3:4 in an antique brass frame, five panels to the right of where the picture was; the calendar on the empty
  kitchen wall facing the fridge (his postcard, the white strip cut off), a little crooked and used; cooker grey steel,
  evenly worn, smoother (`cookerSteelTex`), hob grates on feet; the tea towel on the oven door terry cloth in its
  plaid, crumpled, halo stains, one torn hole; takeable things show the rim only while you look at them; the kitchen
  tap's lever at the front; the toilet lid down; the sofa's back cushions squarer; the chairs' parts all joined; the
  pigeon loud only in the bedroom, faint through walls elsewhere, silent in the bathroom; no light round the shut
  bathroom door (a shadow-only block in the frame).

## Inside the house

- **`js/house.js`**: `PLAN` constants; kitchen + living room; locked front door and Mum's door.
- **Bathroom**: long and narrow, 14.5 m (`z1` 20.2), the bath far off at its end; three ceiling drums down it (the two
  nearer the door shadowed, the far one not: nothing past its walls), one switch for all.
- **Corridor**: 11 m; inside, wallpaper after his pattern, redrawn (`ditsyFloralTex`: beige, small grey-brown flowers
  and posies, olive leaves), a grey-green tongue-and-groove wainscot to 1.02 m with a rail (`beadboardTex`), stopping
  at the door casings; the bedroom's carpet carried on (same texture and size, across the doorway too), dirt over it
  (`corridorDirtTex`: walls' edges, the trodden middle, stains, dust under the hatch); outside, past the bedroom, its
  walls wear the siding; its picture a matte, faded print.
- **The attic hatch** at the corridor's end (`atticHatch`): old boards; the lid over the hole, pushed 16 cm aside, a
  black slit along the east edge; a heavy old ladder leant across to that slit at ~30°, every rung there (one split),
  scratched and gouged (`oldTimberTex(…, scratched)`), rungs rubbed pale in the middle. A collider fills the corridor
  from the ladder's foot to the end (the pocket behind was free floor nobody could reach; Luna walked into the wall).
  Its lamp: unshadowed, 2.8 m reach, dark most of the time and fighting to come on — a failing supply: the glow
  follows its target with a filament's lag (up 45 ms, down 90 ms) and wavers while lit, never snapping.
- **`js/boat.js`**: Luna's boat comes up right beside her wherever she is in the bathroom (by the door only if she
  isn't in there or there's no room by her). When the bathroom is full: she stands up in the boat, the suit goes on,
  a crouch, a leap off the bow (`splash` jump), and only then swims; `cat.dive` never starts while she rides.

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
