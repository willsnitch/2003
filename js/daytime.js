// What time of day it is, and so how the light falls, in the bedroom, the house and the yard alike.
// The game is set at six in the evening (user, 2026-10-18: "it's 6 PM"; before that four in the
// afternoon, `AFTERNOON`): the sun low in the west, about 15° up, gone golden, long shadows across the
// yard; the sky still blue overhead, warm and pale down by the rooftops; a lamp on here and there in
// the neighbours' windows. `DUSK` is the low evening light the bedroom was first lit in and approved
// with, kept whole so it can be brought back by changing `DAY` alone.
//
// Directions are the way the light travels (x east, y up, z south). The sun comes from the same
// quarter in both, over the yard: through the bedroom window and the kitchen's, not the living
// room's, which only ever gets the sky.

/** Four in the afternoon. */
export const AFTERNOON = {
  name: '16:00',
  sun: {
    dir: [-0.676, -0.391, 0.624], // 23° up
    color: 0xffdcb0,
    house: 2.6, // the house's sunlight, before the eye's adaptation indoors
    room: { at: [5.22, 3.45, -3.0], cd: 520 }, // the bedroom's sun: a spot outside the window, aimed at its middle
  },
  // a clear sky: the shade out there is blue and not dark. From high up (70°), on the sun's side, where the sky is
  // brightest: it came from the other side of the sky, opposite the sun, and threw the porch's shadow out across the
  // lawn towards the trees the sun was behind (user, 2026-10-28) — a sky's shadow lies under a thing, or away from the sun
  sky: { dir: [-0.251, -0.94, 0.232], color: 0xa9c1e6, house: 2.3 },
  hemi: { sky: 0x9a8670, ground: 0x5a4a3a, room: 0.7, house: 0.95, yard: { sky: 0xbfd2ec, ground: 0x6f6d55, intensity: 2.6 } }, // ground: what the floor throws back up at the ceiling; yard: the open sky over the garden
  glow: { color: 0xffe4c8, intensity: 10 }, // the lit blind
  bounce: { color: 0xffc58e, intensity: 1.7, at: [0.55, 0.85, 1.75] }, // the sun's patch on the bed and the wall by it
  spill: 0xffcf9e, // the bedroom's light out of its door
  spillPower: 9, // (how strong, the door wide open)
  window: { color: 0xdbe6f5, intensity: 2.0 }, // daylight in through the living room's window (a panel of light the size of the glass)
  kitchen: { color: 0xe6ecf4, intensity: 1.3 }, // and the kitchen's, besides the sun that comes in there
  env: { window: [8.4, 8.0, 7.2], wall: [1.15, 0.86, 0.55] }, // what shiny things in the bedroom reflect
  tint: [1.03, 1.0, 0.95], // the picture's final grade
  dome: [[0, '#3d72bd'], [0.22, '#5b8fcf'], [0.38, '#88b0dc'], [0.46, '#b9d0e3'], [0.5, '#cdd6d6'], [0.51, '#8f8e80'], [1, '#4e4a40']],
  glowDisc: ['rgba(255,250,236,0.55)', 'rgba(255,240,214,0.14)', 'rgba(255,232,200,0)'],
  cloud: ['rgba(255,255,255,0.15)', 'rgba(250,250,255,0)'],
  far: [0.36, 0.42, 0.38], // the treeline, hazy green
  litWindows: 0.18, // a lamp left on in a neighbour's window hardly shows by day
};

/** Six in the evening: between the two, nearer the evening — the sun lower and warmer, the daylight in the windows going. */
export const EVENING = {
  name: '18:00',
  sun: {
    dir: [-0.712, -0.253, 0.655], // 15° up
    color: 0xffc48a,
    house: 2.4,
    room: { at: [5.53, 2.84, -3.28], cd: 470 }, // (outside the window, aimed at its middle along the sun's way)
  },
  sky: { dir: [-0.251, -0.94, 0.232], color: 0x9fb0d4, house: 1.7 },
  hemi: { sky: 0x947a5e, ground: 0x48382a, room: 0.65, house: 0.8, yard: { sky: 0xa8b4cc, ground: 0x5a5642, intensity: 2.0 } },
  glow: { color: 0xffd9b0, intensity: 9.6 },
  bounce: { color: 0xffb070, intensity: 1.65, at: [0.49, 1.35, 1.95] }, // (higher up the wall: the sun lower)
  spill: 0xffc896, // (a shade less orange: the room's light is its window's as much as the sun's)
  spillPower: 1.6, // (the room darker by six: what comes out of its door lit the corridor's carpet three times as bright as the room's own by the door, then still half as bright again — user, 2026-10-19, twice)
  window: { color: 0xd8d4d6, intensity: 1.2 },
  kitchen: { color: 0xdcd6d4, intensity: 0.8 },
  // (what lights the bedroom's walls by their facing alone, near or far: the hot window lit the wall opposite it flat and
  // pale, twice as bright as the rest, blind open or shut — user, 2026-11-02: "the rest is too dark in comparison". The
  // window's light comes in by the glow; here only a warmer, dimmer window, and the room's own bounce: the box, the sunlit
  // west wall, the lit wall facing the window)
  env: { window: [3.6, 2.9, 2.0], wall: [1.9, 1.15, 0.6], box: 0x4a3322, back: [0.9, 0.68, 0.44] },
  tint: [1.04, 0.995, 0.925],
  dome: [[0, '#3a66aa'], [0.22, '#5885c0'], [0.38, '#8ea8cc'], [0.46, '#d2c5b4'], [0.5, '#e8cba4'], [0.51, '#8a8072'], [1, '#4a4339']],
  glowDisc: ['rgba(255,238,206,0.7)', 'rgba(255,214,164,0.26)', 'rgba(255,200,150,0)'],
  cloud: ['rgba(255,246,236,0.16)', 'rgba(255,236,222,0)'],
  far: [0.4, 0.43, 0.38],
  litWindows: 0.45, // a lamp or two on next door already
};

/** The low evening sun the bedroom was first lit and approved in (2026-10-03). */
export const DUSK = {
  name: 'dusk',
  sun: {
    dir: [-0.735, -0.16, 0.678],
    color: 0xffb066,
    house: 2.2,
    room: { at: [5.5, 1.42, -3.25], cd: 380 },
  },
  sky: { dir: [-0.251, -0.94, 0.232], color: 0x93a3c4, house: 0.9 },
  hemi: { sky: 0x8a6a48, ground: 0x2a1b10, room: 0.55, house: 0.55, yard: { sky: 0x7c80a0, ground: 0x3a3424, intensity: 1.1 } },
  glow: { color: 0xffd0a0, intensity: 9 },
  bounce: { color: 0xff9a52, intensity: 1.6, at: [0.45, 1.75, 2.1] },
  spill: 0xff9a52,
  spillPower: 9,
  window: { color: 0xc9b8ae, intensity: 0.15 }, // the last of the daylight
  kitchen: { color: 0xc9b8ae, intensity: 0.1 },
  env: { window: [9, 6.6, 3.8], wall: [1.5, 0.75, 0.3] },
  tint: [1.05, 0.99, 0.9],
  dome: [[0, '#2d3556'], [0.3, '#59587a'], [0.42, '#b98278'], [0.49, '#ffd7a0'], [0.5, '#f2c58e'], [1, '#3a3026']],
  glowDisc: ['rgba(255,214,150,0.9)', 'rgba(255,180,110,0.45)', 'rgba(255,150,90,0)'],
  cloud: ['rgba(255,236,224,0.16)', 'rgba(255,220,200,0)'],
  far: [0.44, 0.44, 0.38],
  litWindows: 0.9,
};

export const DAY = EVENING;
