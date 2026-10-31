// What is drawn over the picture while you are in the game: how many hearts you have left
// (top left), a map of the Hollow (bottom left), and the action badge (top right) that names
// what you can do with whatever is in front of you.
// It is 1998 in there, so this is done the way a cartridge would: a few tiny sprites in a
// handful of flat colours, put down pixel by pixel, and lettering from a 5×7 bitmap font. No
// gradients, no smooth curves, nothing a console of the time couldn't have had in memory.
import * as THREE from 'three';

const MAP = { x: 6, w: 90, h: 50, pad: 6, centreX: 3.85, centreZ: -0.95, scale: 3.9 }; // pixels; `scale`: pixels per metre

// ---------------------------------------------------------------- sprites

// The heart, 11×10: O outline, F fill, H highlight.
const HEART = [
  '..OOO.OOO..',
  '.OFFFOFFFO.',
  'OFHFFFFFFFO',
  'OFHFFFFFFFO',
  'OFFFFFFFFFO',
  '.OFFFFFFFO.',
  '..OFFFFFO..',
  '...OFFFO...',
  '....OFO....',
  '.....O.....',
];
const HEART_FULL = { O: '#2a0608', F: '#d8202c', H: '#ff9a9a' };
const HEART_EMPTY = { O: '#2a0608', F: '#4a161a', H: '#4a161a' };

// The key, once you have it: shown under the hearts.
const KEY = [
  '.OOO.......',
  'O...OOOOOOO',
  'O...O..O.O.',
  '.OOO.......',
];
const KEY_INK = { O: '#f2c94c' };

// Capital letters, 5 wide and 7 tall, rows top to bottom.
const FONT = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.####/#..../#..../#..../#..../#..../.####', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
  G: '.####/#..../#..../#.###/#...#/#...#/.###.', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '#####/..#../..#../..#../..#../..#../#####', J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
};
for (const k in FONT) FONT[k] = FONT[k].split('/');

export function makeHud() {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false })));

  /** Put a sprite down: rows of characters, each looked up in `ink` ('.' is nothing). */
  const sprite = (rows, ink, x, y) => {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = ink[row[i]];
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(x + i, y + j, 1, 1);
      }
    });
  };

  const letter = { '#': '#f4f0dc' }, shade = { '#': '#10161c' };
  /** A word in the bitmap font, centred on x, with a hard shadow so it reads over anything. */
  const word = (text, cx, y) => {
    const glyphs = [...text.toUpperCase()].map((ch) => FONT[ch]).filter(Boolean);
    let x = Math.round(cx - (glyphs.length * 6 - 1) / 2);
    for (const rows of glyphs) {
      for (const [dx, dy] of [[1, 1], [1, 0], [0, 1], [-1, 0], [0, -1]]) sprite(rows, shade, x + dx, y + dy);
      sprite(rows, letter, x, y);
      x += 6;
    }
  };

  function hearts(left, of) {
    for (let i = 0; i < of; i++) sprite(HEART, i < left ? HEART_FULL : HEART_EMPTY, 8 + i * 13, 8);
  }

  /** The badge: a plain disc of dark primary blue with a black edge. The word goes across it when there is something to do. */
  function badge(text, w) {
    const cx = w - 27, cy = 26, R = 16, EDGE = 2;
    const disc = (radius, colour) => {
      g.fillStyle = colour;
      for (let y = -radius; y <= radius; y++) {
        const half = Math.floor(Math.sqrt(radius * radius - y * y) + 0.5);
        g.fillRect(cx - half, cy + y, half * 2, 1);
      }
    };
    disc(R, '#000000');
    disc(R - EDGE, '#0b2aa8');
    if (text) word(text, cx, cy - 3);
  }

  /** The map: north up, as you face when you arrive. `plan` is the place; the rest is who is where. */
  function map(plan, s, h) {
    const x0 = MAP.x, y0 = h - MAP.pad - MAP.h, cx = x0 + MAP.w / 2, cy = y0 + MAP.h / 2;
    const px = (x) => cx + (x - MAP.centreX) * MAP.scale, pz = (z) => cy + (z - MAP.centreZ) * MAP.scale;
    const trace = (pts) => {
      g.beginPath();
      pts.forEach(([x, z], i) => (i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))));
      g.closePath();
    };
    g.fillStyle = 'rgba(6,12,16,0.55)';
    g.fillRect(x0, y0, MAP.w, MAP.h);
    g.save();
    g.beginPath();
    g.rect(x0, y0, MAP.w, MAP.h);
    g.clip();
    for (const part of plan.upstairs) {
      trace(part);
      g.fillStyle = '#92764f';
      g.fill();
    }
    trace(plan.walls);
    g.fillStyle = '#54422c';
    g.fill();
    g.strokeStyle = '#d9c69c';
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = '#b08a58';
    for (const st of plan.steps) g.fillRect(Math.round(px(st.x)) - 1, Math.round(pz(st.z)) - 1, 3, 3);
    const hx = Math.round(px(plan.heart.x)), hz = Math.round(pz(plan.heart.z)), hr = Math.round(plan.heart.r * MAP.scale);
    g.fillStyle = '#3c2a18';
    g.fillRect(hx - hr, hz - hr + 1, hr * 2 + 1, hr * 2 - 1);
    g.fillRect(hx - hr + 1, hz - hr, hr * 2 - 1, hr * 2 + 1);
    g.fillStyle = '#f0e2b8'; // the ladder: two short rungs across the wall
    g.fillRect(Math.round(px(plan.ladder.x)) - 2, Math.round(pz(plan.ladder.z)) - 1, 4, 1);
    g.fillRect(Math.round(px(plan.ladder.x)) - 2, Math.round(pz(plan.ladder.z)) + 1, 4, 1);
    g.fillStyle = '#bff2ff'; // the glass you came in by
    g.fillRect(Math.round(px(plan.hole.x)) - 2, Math.round(pz(plan.hole.z)) - 1, 4, 2);
    g.fillStyle = '#e8c060'; // the chest
    g.fillRect(Math.round(px(plan.chest.x)) - 1, Math.round(pz(plan.chest.z)) - 1, 3, 2);
    g.fillStyle = '#ff4a5c'; // whatever is still standing guard
    for (const foe of s.foes) g.fillRect(Math.round(px(foe.x)) - 1, Math.round(pz(foe.z)) - 1, 3, 3);
    if (s.luna) {
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(px(s.luna.x)), Math.round(pz(s.luna.z)), 2, 2);
    }
    if (s.you) {
      // you, when you are in there: an arrowhead pointing the way you face
      g.translate(Math.round(px(s.you.x)) + 0.5, Math.round(pz(s.you.z)) + 0.5);
      g.rotate(-s.you.yaw);
      g.fillStyle = '#ffe14a';
      g.beginPath();
      g.moveTo(0, -4.5);
      g.lineTo(3.5, 3.5);
      g.lineTo(0, 1.5);
      g.lineTo(-3.5, 3.5);
      g.closePath();
      g.fill();
    }
    g.restore();
    g.fillStyle = '#d9c69c'; // a one-pixel frame
    g.fillRect(x0, y0, MAP.w, 1);
    g.fillRect(x0, y0 + MAP.h - 1, MAP.w, 1);
    g.fillRect(x0, y0, 1, MAP.h);
    g.fillRect(x0 + MAP.w - 1, y0, 1, MAP.h);
  }

  return {
    scene,
    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
      texture.dispose(); // its size is fixed once it has been on the card; start again
    },
    /** `s`: { hearts, maxHearts, key, action, plan, you, foes, luna, white, red } */
    draw(s) {
      const w = canvas.width, h = canvas.height;
      g.clearRect(0, 0, w, h);
      if (s.red > 0) {
        g.fillStyle = `rgba(190,24,34,${Math.min(0.5, s.red * 0.5)})`;
        g.fillRect(0, 0, w, h);
      }
      hearts(s.hearts, s.maxHearts);
      if (s.key) {
        sprite(KEY, { O: '#2a1c00' }, 9, 23); // a hard shadow, then the gold
        sprite(KEY, KEY_INK, 8, 22);
      }
      map(s.plan, s, h);
      badge(s.action, w);
      if (s.white > 0) {
        g.fillStyle = `rgba(255,255,255,${Math.min(1, s.white)})`;
        g.fillRect(0, 0, w, h);
      }
      texture.needsUpdate = true;
    },
  };
}
