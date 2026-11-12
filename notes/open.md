# 2003 — open items (waiting on him)

Moved out of `CLAUDE.md` on 2026-11-11. Read before reworking anything recent (he may not have judged it yet) and
before reporting something as new (it may be listed here already). The licence list stays in `CLAUDE.md`.
Keep this up to date: add what is left waiting at the end of a round, remove what he has settled.

- **No sounds of the game's own** (2026-10-15: he found everything generated bad, kept only his pigeon). Every sound
  is silent until a recording of that name is in `assets/sounds/` (`README.txt` has the list). Missing above all:
  `room-tone` (a looping base for every room), steps, doors, water, Luna, the PC and TV.
- **The eye going out into the yard** (2026-11-11, not judged yet): one exposure for all that is out of doors. What
  changed to the eye besides the passage itself: **the yard seen from indoors** (open back door, kitchen window) is
  now the yard as it is out there but 1.8× brighter — its shade used to be near black from inside; the kitchen's
  tiles on the two outer walls, the socket's plate beside them and the paper's wear on the corridor's end wall (the
  leak's stain) are lit by the lamps now, like what is under them (they had none; the end wall measured: 0.1 % of
  the picture changes, not visible); a line of daylight shows under the shut back door (its 1.5 cm gap). Paces mine: out
  0.3 s + ~3 s, in 6–8 s. Left as they were: the rooms seen from the yard as bright as from inside (his,
  2026-10-20 — a real eye would see them darker by the same 1.8); coming indoors the room does not start dark and
  lighten (indoors nothing changes); the hose's drops and the window panes' sheen and dust the same to every eye.
  GPU ms after the fix to the short grass: lawn → house 20.5, lawn → trees 19.2, kitchen 28.3, bedroom 14.7.
- **The freeze as the taps open, the rehearsal** (2026-11-12, not judged by him or by a player yet; on by default,
  `?norehearsal` = as it was). **The loading waits for the water's mirror, ~3 s more on a first
  visit: kept (his, 2026-11-12)** (the last stretch 12.3–14.2 s against 9.5–10.4 s, three pairs; later visits the same, 14.3 s) — without
  that wait the loading is as it was and the mirror is readied behind the start window like the rest (done if the
  player stays ~9 s on it or stands still ~16 s in all before the taps; else a shorter freeze there). The rest —
  the water itself, the boat, Luna in the house, her suit: ~10 s of the card's time on a first visit — goes on
  behind the start window and, once playing, one shader a second while the eye is still (0.08–0.45 s each, seen as a
  held frame if something moves in view; not at the PC): a player who presses Start at once and never stops still
  meets what is left as before. Not measured: any machine but the M2 (on Windows the cost is likely in the shaders,
  which are made side by side now); the real page on Netlify. Offered, not done: the mirror drawn in the screen's
  own kind (4 samples) would need no readying at all, but its edges would be smoothed and each frame with water
  cost more — a change to the picture, his call. Noticed, not touched: the same first-draw cost is everywhere on a
  first visit (~9.5 s over the house and yard, in small stops on first looking at each room; ~6 s of it behind
  the start window for the bedroom); the room's mirror draws the short grass every frame (it is never left out:
  `hideForReflection` takes only what `hideUnseen` lists); with water in the bathroom a frame costs 2–2.5× (mirror,
  the falling water's see-through pass); on a first visit the page waits 8 s after the build for Mum and the angel
  (their shaders, behind all the others); Luna carries the bathroom's patch into the TV's game (as she did after
  her first walk through the house): not looked at there.
- **The corridor's far right corner, the hatch's line** (2026-11-12, not judged yet): the south wall now stops at the
  end wall's face (the end wall owns that corner, siding on its outer corner); the hatch's ceiling cut 3 cm back under
  the frame, the black over the hole carried out to the walls. Checked by numbers and two pictures, not by him at play.
- Clocks (2026-11-04): every clock should read 6:04 PM; the stopped clocks in the build still show twenty to four.
- Noticed, not asked: the fence boards (`fenceBoardTex`) look blotchy up close. Luna's eyes in the living room fixed in
  code (`cat.housed`) but never seen in an image. Mum's shadow in the sun's and sky's maps is thrown away with a
  `discard` in her depth material (mother.js): the browser warns "Active draw buffers with missing fragment shader
  outputs" each time the maps are redrawn — harmless, noisy; cleaner not to draw her there at all.
- Speed for players (2026-11-10), not judged by him or by a player yet. Not measured: any Windows machine (shader
  compiling is likely the largest part of a first visit there). Offered, not done: textures drawn on several cores
  at once; fewer draws for the bedroom (490, one per small thing).
- Deploy to Netlify (needs his go-ahead; the whole folder, not just `index.html`).
- Not yet judged or seen by him in play:
  - 2026-11-12 (round 1 of 5 for 0.5.21): the pool's waterline — the water's scum green carried up the wall 4–17 cm,
    fading out unevenly, as dark as the scum where they meet; a fringe of it 2–7 cm wide on the water against the wall;
    duckweed fronds stuck to the wall in the first few cm (colour, heights and amount mine; seen at 2–5 m only: nowhere
    lets you get nearer the waterline). Shutting the bathroom door yourself from outside with Luna in there: she comes
    out to you first, then it shuts as a hand shuts it (mine; before, it shut on her). At your heel with the taps on she
    sits no nearer than 0.47 m and gets up only if you step at her within 0.42 m (was: sat from 0.40, got up within
    0.55 — by a wall that was every frame).
  - Noticed, not touched (2026-11-12): at the pool's square east end, near corner, a thin pale-blue line shows in the
    joint between two coping stones (the tile band behind, through the gap?) — not looked into. Coming out of the
    bathroom to stand right outside its door, Luna sometimes arrives under your feet and trots off down the corridor
    (her `bolt`), instead of sitting by you.
  - 2026-11-11 (round 2): Luna at your heel while the taps run (0.7 m off you, at her walk, up a moment after you move
    a step); her watching the boat (body turned only as far as her head needs, the head the rest); the dive's water
    (drops, white water gone in 1.8 s, bubbles: sizes and times mine); the greeting (5 s; with your head out of the
    water she can come no higher than her helmet under the surface: her eyes ~0.35 m below yours); the door slamming going
    out (mine: he said "closes"); the stream and the sheet over the bath's front 20% faster too (my reading of
    "flows"; the 8 s drain unchanged); the loading bar (an imitation of the period's green block bar, drawn in CSS,
    unbranded) and its Start button.
  - Noticed, not touched (2026-11-11): with the boat lying across the room when she suits up, her leap "off the bow"
    is only ~0.3 m, towards the wall (the bow points at it); a fix would turn her in the boat first. You can still walk
    through her (the player doesn't collide with Luna).
  - The angel (2.05 m to the wing tips on its plinth, size mine). Not checked: Luna in the end of the garden; fps
    there on his M2; the drowned flamingo's empty eye in a close-up; the flamingos' eyes in direct sun.
  - The bath's cycle (2026-11-02): the lines "It won't turn." / "It won't budge." (mine), the water running back up
    the bath's front and the whirl over the plug (mine), Luna's shake close up, the poof with the light off. A 2 cm
    sliver of tile is left along the bathroom's door wall (only the sides were asked).
  - The breeze (2026-11-03: "light, slow, random, now and then; the willow only a little slower"). Still to do: the
    long grass, tufts, weeds and the leaf litter. Mum costs ~5 ms in the kitchen whatever her shader (her geometry,
    cause not found).
  - 2026-11-03: the bath's floor water reflecting from the first centimetre; the pool's bubbles (from ~4 m at a
    slant the ripples hardly show); the grass under the porch's skirt and 30–40 cm past the lawn's fences, the long
    grass along the skirt (mine), the 14 lawn weeds. Not measured: fps with the extra grass.
  - Mum's right fist (2026-10-25/27), above all the wrist, cocked ~45° towards the little finger while she cuts, up
    to ~60° as she puts the knife down.
