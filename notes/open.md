# 2003 — open items (waiting on him)

Read before reworking anything recent (he may not have judged it yet) and before reporting something as new (it may
be listed here). The licence list stays in `CLAUDE.md`. Keep it current: add what is left waiting at the end of a
round, remove what he has settled.

## Not yet judged or seen by him in play (newest first; "mine" = my choice, not his)

- **2026-11-12 (round 1 of 5 for 0.5.21)**: the pool's waterline — the water's scum green carried up the wall 4–17 cm,
  fading unevenly, as dark as the scum where they meet; a fringe 2–7 cm on the water against the wall; duckweed stuck
  to the wall in the first few cm (colour, heights, amount mine; seen only at 2–5 m: nowhere lets you nearer). Shutting
  the bathroom door yourself from outside with Luna in: she comes out first, then it shuts as a hand shuts it (mine).
  At your heel with the taps on she sits no nearer than 0.47 m and gets up only if you step at her within 0.42 m.
- **2026-11-12, the corridor's far right corner and the hatch's line**: the south wall stops at the end wall's face
  (the end wall owns the corner); the hatch's ceiling cut 3 cm back under the frame. Checked by numbers and two
  pictures only.
- **2026-11-12, the rehearsal** (the freeze as the taps open; on by default, `?norehearsal` = as before). The loading
  waits ~3 s more on a first visit for the water's mirror: **kept (his, 2026-11-12)**. The rest (~10 s of the card's
  time on a first visit) runs behind the start window and, once playing, one shader a second while the eye is still
  (0.08–0.45 s each; a held frame if something moves in view): a player who presses Start at once and never stops still
  meets what is left. Not measured: any machine but the M2, the real page on Netlify. Offered, not done: the mirror in
  the screen's own kind (4 samples) would need no readying, but smooths its edges and costs more per frame — a change
  to the picture, his call.
- **2026-11-11, the eye going out into the yard**: one exposure for all out of doors. Also changed to the eye: the yard
  seen from indoors is now as it is out there ×1.8 (its shade was near black); the kitchen's tiles on the outer walls,
  the socket's plate and the corridor end wall's stain are lit by the lamps now (0.1 % of the picture); a line of
  daylight under the shut back door (its 1.5 cm gap). Paces mine: out 0.3 s + ~3 s, in 6–8 s. Left as they were: the
  rooms seen from the yard as bright as from inside (his, 2026-10-20); coming indoors the room does not start dark.
  GPU ms after: lawn → house 20.5, lawn → trees 19.2, kitchen 28.3, bedroom 14.7.
- **2026-11-11 (round 2)**: Luna at your heel while the taps run (0.7 m off, her own walk); watching the boat (body
  turned only as far as her head needs); the dive's water (drops, white water gone in 1.8 s, bubbles: sizes and times
  mine); the greeting (5 s; with your head out of the water her eyes stay ~0.35 m below yours); the door slamming going
  out (mine: he said "closes"); the stream and sheet 20% faster too (my reading of "flows"; the 8 s drain unchanged);
  the loading bar (period-style green blocks in CSS, unbranded) and its Start button.
- **2026-11-10, speed for players**: not judged by him or a player. Not measured: any Windows machine (shader
  compiling likely the largest part of a first visit there). Offered, not done: textures drawn on several cores at
  once; fewer draws for the bedroom (490, one per small thing).
- **2026-11-03**: the bath's floor water reflecting from the first centimetre; the pool's bubbles (from ~4 m at a slant
  the ripples hardly show); the grass under the porch's skirt and 30–40 cm past the lawn's fences, the long grass along
  the skirt (mine), the 14 lawn weeds. Not measured: fps with the extra grass.
- **The breeze** (2026-11-03: "light, slow, random, now and then; the willow only a little slower"). Still to do: the
  long grass, tufts, weeds and leaf litter.
- **The bath's cycle** (2026-11-02): the lines "It won't turn." / "It won't budge." (mine), the water running back up
  the bath's front and the whirl over the plug (mine), Luna's shake close up, the poof with the light off. A 2 cm
  sliver of tile is left along the door wall (only the sides were asked).
- **The angel** (2.05 m to the wing tips on its plinth, size mine). Not checked: Luna in the end of the garden; fps
  there on his M2; the drowned flamingo's empty eye in a close-up; the flamingos' eyes in direct sun.
- **Mum's right fist** (2026-10-25/27), above all the wrist: ~45° towards the little finger while she cuts, up to ~60°
  as she puts the knife down.

## Noticed, not touched

- The pool's square east end, near corner: a thin pale-blue line in the joint between two coping stones (the tile band
  behind, through the gap?).
- Coming out of the bathroom to stand right outside its door, Luna sometimes arrives under your feet and trots off down
  the corridor (her `bolt`) instead of sitting by you.
- With the boat lying across the room when she suits up, her leap "off the bow" is only ~0.3 m, towards the wall; a
  fix would turn her in the boat first. You can walk through her (the player doesn't collide with Luna).
- First-visit costs elsewhere: the same first-draw cost as the taps' is everywhere (~9.5 s over house and yard, small
  stops on first looking at each room; ~6 s of it behind the start window for the bedroom); the page waits 8 s after
  the build for Mum's and the angel's shaders. The room's mirror draws the short grass every frame (`hideForReflection`
  takes only what `hideUnseen` lists). With water in the bathroom a frame costs 2–2.5×. Luna carries the bathroom's
  patch into the TV's game: not looked at there.
- Mum costs ~5 ms in the kitchen whatever her shader (her geometry, cause not found).
- The fence boards (`fenceBoardTex`) look blotchy up close. Luna's eyes in the living room fixed in code (`cat.housed`)
  but never seen in an image. Mum's shadow in the sun's and sky's maps is thrown away with a `discard` (mother.js): the
  browser warns "Active draw buffers with missing fragment shader outputs" each time — harmless, noisy.

## Waiting on him otherwise

- **No sounds of the game's own** (2026-10-15: he found everything generated bad, kept only his pigeon). Every sound is
  silent until a recording of that name is in `assets/sounds/` (`README.txt` has the list). Missing above all:
  `room-tone`, steps, doors, water, Luna, the PC and TV.
- Clocks (2026-11-04): every clock should read 6:04 PM; the stopped clocks still show twenty to four.
- Deploy to Netlify (needs his go-ahead; the whole folder, not just `index.html`).
