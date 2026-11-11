# 2003 — open items (waiting on him)

Moved out of `CLAUDE.md` on 2026-11-11. Read before reworking anything recent (he may not have judged it yet) and
before reporting something as new (it may be listed here already). The licence list stays in `CLAUDE.md`.
Keep this up to date: add what is left waiting at the end of a round, remove what he has settled.

- **No sounds of the game's own** (2026-10-15: he found everything generated bad, kept only his pigeon). Every sound
  is silent until a recording of that name is in `assets/sounds/` (`README.txt` has the list). Missing above all:
  `room-tone` (a looping base for every room), steps, doors, water, Luna, the PC and TV.
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
