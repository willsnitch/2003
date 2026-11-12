# 2003

A first-person horror puzzle game set in a family house in 2003.

You play Lucas, an 8-year-old who just got home from school. Every room represents a different level, and each one gets more difficult and creepier as you progress.

## Story

The lore so far, decided and open, is in `LORE.md`.

## Status

Work in progress, version 0.5.21. Changes by version are in `notes/versions.md`.

## Run it

The game is plain HTML and JavaScript with no build step. It needs a local web server because it uses ES modules.

```
python3 serve.py
```

Then open http://localhost:8141. Add `?shot=1` to skip the start window. A different port can be passed as an argument: `python3 serve.py 8142`.

## Controls

- W A S D: move
- Mouse: look around
- Click or E: interact
- Space: jump
- Shift: run
- C: crouch
- I: inventory
- Esc: pause
- M: sound on/off

## Project layout

- `index.html`, `styles.css`: page and HUD
- `js/`: the game. `main.js` runs the renderer and the main loop; `room.js` and `props.js` are the bedroom; `house.js`, `fixtures.js`, `yard.js`, `grove.js` and `basement.js` are the rest of the house and the outside; `zelpa.js` is the TV game.
- `vendor/`: Three.js r180, included as-is
- `assets/`: fonts, images, the 3D model of the mother and the sound recordings
- `tools/`: helpers for taking screenshots during development
- `notes/`: design notes and history

All textures are drawn in code on canvases. Sounds are real recordings only; a sound without a recording in `assets/sounds/` stays silent (see `assets/sounds/README.txt`).

## Before release

Some assets are not cleared for commercial use yet: the handwriting font (personal-use licence), some photos in `assets/`, the mother's 3D model, and branded poster art. They need to be licensed or replaced before the game is sold.

## Licence

All rights reserved. This code and its assets may not be copied, redistributed or used without the author's permission.
