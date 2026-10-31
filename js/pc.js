// The bedroom PC, running "Macrofrost XD": drawn onto the monitor's texture and driven by the
// mouse and keyboard while the player sits at it. It starts switched off and boots the slow,
// noisy way — self-test, logo, welcome — before the desktop (windows, start menu, a text editor,
// a mine game, a couple of folders) turns up. Sounds are requested through `onSound`.
import * as THREE from 'three';
import { crtFinish } from './textures.js';

const W = 800, H = 600, BAR = 38, TITLE = 30;
const FONT = 'Tahoma, "Trebuchet MS", Verdana, sans-serif';
const MOUSE_SPEED = 1.15;

const FILES = {
  'homework.txt': 'MATH  -  due Monday\n\nPage 42, exercises 1 to 10.\nShow your working!!\n\n(do it Sunday night)',
  'luna.txt': 'Things Luna likes:\n- the hoodie on my bed\n- washing her paws\n- staring at me while I play\n\nThings Luna hates:\n- closed doors',
};

const APPS = {
  notepad: { title: 'Untitled - Notepad', w: 430, h: 300 },
  mines: { title: 'Minesweeper', w: 252, h: 330 },
  computer: { title: 'My Computer', w: 420, h: 250 },
  documents: { title: 'My Documents', w: 420, h: 250 },
  bin: { title: 'Recycle Bin', w: 360, h: 210 },
};

const ICONS = [
  { id: 'computer', label: 'My Computer', x: 20, y: 18 },
  { id: 'documents', label: 'My Documents', x: 20, y: 108 },
  { id: 'notepad', label: 'Notepad', x: 20, y: 198 },
  { id: 'mines', label: 'Minesweeper', x: 20, y: 288 },
  { id: 'bin', label: 'Recycle Bin', x: W - 110, y: H - BAR - 96 },
];

const MENU = { x: 0, y: H - BAR - 312, w: 250, h: 312, head: 54, row: 40, foot: 46 };
const MENU_ITEMS = ['notepad', 'mines', 'documents', 'computer'];
const MENU_LABELS = { notepad: 'Notepad', mines: 'Minesweeper', documents: 'My Documents', computer: 'My Computer' };

// ---------------------------------------------------------------- drawing helpers

function wallpaper() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, '#2468d2');
  sky.addColorStop(1, '#a8d0f4');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  for (const [x, y, r] of [[150, 110, 60], [220, 90, 80], [300, 118, 56], [560, 160, 70], [640, 140, 90], [470, 60, 44]]) {
    const cl = g.createRadialGradient(x, y, 4, x, y, r);
    cl.addColorStop(0, 'rgba(255,255,255,0.85)');
    cl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cl;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const hill = g.createLinearGradient(0, 300, 0, H);
  hill.addColorStop(0, '#6cbb3a');
  hill.addColorStop(1, '#2c7a1a');
  g.fillStyle = hill;
  g.beginPath();
  g.moveTo(0, 420);
  g.bezierCurveTo(200, 300, 420, 330, 560, 400);
  g.bezierCurveTo(660, 450, 740, 400, W, 360);
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.fill();
  g.fillStyle = 'rgba(190,240,120,0.25)';
  g.beginPath();
  g.moveTo(60, 400);
  g.bezierCurveTo(220, 320, 380, 340, 500, 390);
  g.bezierCurveTo(360, 360, 200, 360, 60, 400);
  g.fill();
  return c;
}

function glyph(g, id, x, y, s) {
  // small pictures for the desktop and the menus; (x, y) is the top-left of an s×s box
  g.save();
  g.translate(x, y);
  g.scale(s / 40, s / 40);
  g.lineWidth = 1.5;
  g.strokeStyle = '#1b2a4a';
  if (id === 'computer') {
    g.fillStyle = '#d9d6c8';
    g.fillRect(5, 4, 30, 22);
    g.strokeRect(5, 4, 30, 22);
    g.fillStyle = '#3f86e0';
    g.fillRect(9, 8, 22, 14);
    g.fillStyle = '#c4c0b0';
    g.fillRect(2, 29, 36, 7);
    g.strokeRect(2, 29, 36, 7);
  } else if (id === 'documents' || id === 'folder') {
    g.fillStyle = '#e8b93a';
    g.fillRect(3, 8, 15, 6);
    g.fillStyle = '#f6d66a';
    g.fillRect(3, 12, 34, 22);
    g.strokeRect(3, 12, 34, 22);
  } else if (id === 'notepad' || id === 'file') {
    g.fillStyle = '#fff';
    g.fillRect(8, 3, 24, 34);
    g.strokeRect(8, 3, 24, 34);
    g.fillStyle = '#3f86e0';
    g.fillRect(8, 3, 24, 6);
    g.fillStyle = '#8a8f9a';
    for (let i = 0; i < 4; i++) g.fillRect(12, 14 + i * 5, 16, 1.6);
  } else if (id === 'mines') {
    g.fillStyle = '#c0c0c0';
    g.fillRect(4, 4, 32, 32);
    g.strokeRect(4, 4, 32, 32);
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(20, 20, 8, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#111';
    g.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.moveTo(20 - Math.cos(a) * 12, 20 - Math.sin(a) * 12);
      g.lineTo(20 + Math.cos(a) * 12, 20 + Math.sin(a) * 12);
      g.stroke();
    }
  } else if (id === 'bin') {
    g.fillStyle = '#b9c4d2';
    g.beginPath();
    g.moveTo(8, 10); g.lineTo(32, 10); g.lineTo(28, 36); g.lineTo(12, 36);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillRect(6, 6, 28, 4);
    g.strokeRect(6, 6, 28, 4);
  } else if (id === 'disk') {
    g.fillStyle = '#c9cdd4';
    g.fillRect(4, 12, 32, 18);
    g.strokeRect(4, 12, 32, 18);
    g.fillStyle = '#4bd05a';
    g.fillRect(28, 24, 4, 3);
  } else if (id === 'off') {
    g.fillStyle = '#d6452c';
    g.beginPath();
    g.roundRect(4, 4, 32, 32, 6);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 3.4;
    g.beginPath();
    g.arc(20, 21, 9, -1.0, Math.PI + 1.0);
    g.moveTo(20, 9);
    g.lineTo(20, 20);
    g.stroke();
  }
  g.restore();
}

// The system's mark is a snowflake cut down to a logo: six blunt arms round a six-sided hole, one
// pair of barbs each, and every arm folded down its middle into a lit half and a shaded half.
// One arm, pointing up, in units of its reach: the right half of the bar and the barb on that
// side. The left is the mirror of it.
const FROST = (() => {
  const HALF = 0.105, CORE = 0.15, TIP = 0.095; // half the bar's width, where it starts, how far its point is cut back
  const AT = 0.5, THICK = 0.2, OUT = 0.29; // the barb: where it leaves the bar, how thick, how far out it ends
  const rise = (OUT - HALF) * Math.tan(Math.PI / 6); // it runs parallel to the next arm round
  return {
    bar: [[0, CORE], [HALF, CORE], [HALF, 1 - TIP], [0, 1]],
    barb: [[HALF, AT], [OUT, AT + rise], [OUT, AT + THICK + rise], [HALF, AT + THICK]],
  };
})();

function frostMark(g, cx, cy, r) {
  const tone = (top, bottom) => {
    const fill = g.createLinearGradient(0, cy - r, 0, cy + r);
    fill.addColorStop(0, top);
    fill.addColorStop(1, bottom);
    return fill;
  };
  /** Every arm's bar and barb on one side (1: its right, -1: its left), or on both. */
  const arms = (sides, fill) => {
    g.fillStyle = fill;
    for (let i = 0; i < 6; i++) {
      const c = Math.cos((i * Math.PI) / 3), s = Math.sin((i * Math.PI) / 3);
      for (const side of sides) {
        for (const shape of [FROST.bar, FROST.barb]) {
          g.beginPath();
          for (const [x, y] of shape) g.lineTo(cx + (x * side * c + y * s) * r, cy + (x * side * s - y * c) * r);
          g.closePath();
          g.fill();
        }
      }
    }
  };
  const shaded = tone('#a9d7ff', '#62aaf2');
  g.save();
  g.shadowColor = 'rgba(4,14,58,0.55)'; // so it stands off a blue screen as well as a black one
  g.shadowBlur = r * 0.14;
  g.shadowOffsetY = r * 0.07;
  arms([1, -1], shaded);
  g.shadowColor = 'transparent';
  arms([1, -1], shaded); // again, clean: each piece's shadow fell on the ones before it
  arms([-1], tone('#ffffff', '#d6ebff'));
  g.restore();
}

function wordmark(g, x, y, size) {
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.font = `italic 700 ${size}px ${FONT}`;
  g.fillStyle = '#fff';
  g.fillText('Macrofrost', x, y);
  const w = g.measureText('Macrofrost').width;
  g.font = `700 ${size * 0.62}px ${FONT}`;
  g.fillStyle = '#f08a1c';
  g.fillText('XD', x + w + size * 0.12, y - size * 0.42);
  g.textBaseline = 'middle';
}

// Boot: how long each stage lasts (seconds) and when its noises happen.
const STAGES = {
  post: { len: 5.4, glow: 0.12, cues: [['beep', 2.5], ['seek', 2.9], ['seek', 3.3], ['floppy', 3.8], ['seek', 4.8]] },
  logo: { len: 6.5, glow: 0.25, cues: [['seek', 0.4], ['seek', 1.3], ['seek', 1.9], ['seek', 3.0], ['seek', 3.6], ['seek', 4.7], ['seek', 5.6]] },
  welcome: { len: 2.6, glow: 0.9, cues: [['seek', 0.5], ['seek', 1.5]] },
  closing: { len: 2.8, glow: 0.8, cues: [['bye', 0.1], ['seek', 1.2]] },
};
const NEXT = { post: 'logo', logo: 'welcome', welcome: 'on', closing: 'off' };

const inside = (p, x, y, w, h) => p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;

// ---------------------------------------------------------------- mine game

const GRID = 9, MINES = 10, CELL = 24;
const NUM_COLORS = ['', '#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000', '#808080'];

function newMines() {
  return { cells: null, state: 'ready', flags: 0, time: 0 };
}

function layMines(m, safe) {
  m.cells = Array.from({ length: GRID * GRID }, () => ({ mine: false, open: false, flag: false, n: 0 }));
  let left = MINES;
  while (left) {
    const i = Math.floor(Math.random() * GRID * GRID);
    if (i === safe || m.cells[i].mine) continue;
    m.cells[i].mine = true;
    left--;
  }
  for (let i = 0; i < GRID * GRID; i++) m.cells[i].n = around(i).filter((j) => m.cells[j].mine).length;
  m.state = 'play';
}

function around(i) {
  const x = i % GRID, y = Math.floor(i / GRID), out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < GRID && ny < GRID) out.push(ny * GRID + nx);
  }
  return out;
}

function openCell(m, i) {
  if (m.state === 'ready') layMines(m, i);
  if (m.state !== 'play') return;
  const c = m.cells[i];
  if (c.open || c.flag) return;
  c.open = true;
  if (c.mine) {
    m.state = 'lost';
    m.cells.forEach((k) => { if (k.mine) k.open = true; });
    return;
  }
  if (c.n === 0) around(i).forEach((j) => openCell(m, j));
  if (m.cells.every((k) => k.open || k.mine)) m.state = 'won';
}

// ---------------------------------------------------------------- desktop

export class Desktop {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.back = wallpaper();
    this.cursor = { x: W * 0.55, y: H * 0.5 };
    this.windows = []; // back to front
    this.menu = false;
    this.drag = null;
    this.selected = null;
    this.lastClick = { t: -1, id: null };
    this.active = false; // true while someone is sitting at it
    this.time = 0;
    this.minute = -1;
    this.blink = false;
    this.dirty = true;
    this.power = 'off'; // off → post → logo → welcome → on → closing → off
    this.stageT = 0;
    this.fired = 0; // how many of the stage's sound cues have gone off
    this.glow = 0; // how much light the picture throws into the room, 0…1
    this.onPower = null; // (on) — the machine itself starting or stopping
    this.onSound = null; // (name)
    this.draw();
  }

  // ---------------- power

  powerOn() {
    if (this.power !== 'off') return;
    this.enter('post');
    this.onPower?.(true);
  }

  shutdown() {
    if (this.power !== 'on') return;
    this.menu = false;
    this.drag = null;
    this.enter('closing');
  }

  enter(stage) {
    this.power = stage;
    this.stageT = 0;
    this.fired = 0;
    this.memory = -1;
    this.glow = stage === 'on' ? 1 : stage === 'off' ? 0 : STAGES[stage].glow;
    this.dirty = true;
    if (stage === 'on') this.onSound?.('chime');
    if (stage === 'off') {
      this.windows = []; // nothing was saved
      this.selected = null;
      this.onPower?.(false);
    }
  }

  // ---------------- window management

  open(app, extra = {}) {
    const existing = this.windows.find((w) => w.app === app && !extra.file);
    if (existing) return this.raise(existing);
    this.onSound?.('open');
    const def = APPS[app];
    const n = this.windows.length;
    const win = {
      app, title: def.title, w: def.w, h: def.h,
      x: Math.min(150 + n * 26, W - def.w - 10), y: Math.min(50 + n * 24, H - BAR - def.h - 6),
    };
    if (app === 'notepad') {
      win.text = extra.file ? FILES[extra.file] : '';
      if (extra.file) win.title = `${extra.file} - Notepad`;
    }
    if (app === 'mines') win.game = newMines();
    this.windows.push(win);
    this.dirty = true;
  }

  raise(win) {
    this.windows = this.windows.filter((w) => w !== win);
    this.windows.push(win);
    this.dirty = true;
  }

  get front() {
    return this.windows[this.windows.length - 1];
  }

  // ---------------- input (all coordinates are screen pixels of the PC)

  move(dx, dy) {
    if (this.power !== 'on') return;
    const c = this.cursor;
    c.x = THREE.MathUtils.clamp(c.x + dx * MOUSE_SPEED, 0, W - 1);
    c.y = THREE.MathUtils.clamp(c.y + dy * MOUSE_SPEED, 0, H - 1);
    if (this.drag) {
      const w = this.drag.win;
      w.x = THREE.MathUtils.clamp(c.x - this.drag.dx, -w.w + 60, W - 60);
      w.y = THREE.MathUtils.clamp(c.y - this.drag.dy, 0, H - BAR - TITLE);
    }
    this.dirty = true;
  }

  up() {
    this.drag = null;
  }

  down(right = false) {
    if (this.power !== 'on') return;
    const c = this.cursor;
    this.dirty = true;
    this.onSound?.('click');

    const wasOpen = this.menu;
    if (this.menu) {
      this.menu = false;
      if (inside(c, MENU.x, MENU.y, MENU.w, MENU.h)) {
        const row = Math.floor((c.y - MENU.y - MENU.head) / MENU.row);
        if (c.y >= MENU.y + MENU.h - MENU.foot) this.shutdown();
        else if (row >= 0 && row < MENU_ITEMS.length) this.open(MENU_ITEMS[row]);
        return;
      }
    }

    if (c.y >= H - BAR) {
      if (c.x < 104) this.menu = !wasOpen && !right;
      else {
        const i = Math.floor((c.x - 112) / 128);
        if (i >= 0 && i < this.windows.length) this.raise(this.taskOrder()[i]);
      }
      return;
    }

    for (let i = this.windows.length - 1; i >= 0; i--) {
      const w = this.windows[i];
      if (!inside(c, w.x, w.y, w.w, w.h)) continue;
      this.raise(w);
      if (right) { if (w.app === 'mines') this.clickMines(w, true); return; }
      if (c.y < w.y + TITLE) {
        if (c.x > w.x + w.w - 30) this.windows = this.windows.filter((k) => k !== w);
        else this.drag = { win: w, dx: c.x - w.x, dy: c.y - w.y };
      } else this.clickBody(w);
      return;
    }

    if (right) return;
    const icon = ICONS.find((k) => inside(c, k.x, k.y, 90, 78));
    this.selected = icon ? icon.id : null;
    if (icon) this.doubleClick(`icon:${icon.id}`, () => this.open(icon.id));
  }

  /** Runs `action` only on the second click of a quick pair on the same thing. */
  doubleClick(id, action) {
    const twice = this.lastClick.id === id && this.time - this.lastClick.t < 0.5;
    this.lastClick = twice ? { t: -1, id: null } : { t: this.time, id };
    if (twice) action();
  }

  taskOrder() {
    return [...this.windows].sort((a, b) => a.title.localeCompare(b.title));
  }

  clickBody(w) {
    const c = this.cursor;
    if (w.app === 'mines') return this.clickMines(w, false);
    if (w.app === 'documents') {
      Object.keys(FILES).forEach((name, i) => {
        if (inside(c, w.x + 18 + i * 120, w.y + TITLE + 16, 100, 84)) this.doubleClick(`file:${name}`, () => this.open('notepad', { file: name }));
      });
    }
  }

  clickMines(w, right) {
    const c = this.cursor, m = w.game;
    const gx = w.x + 18, gy = w.y + TITLE + 60;
    if (!right && inside(c, w.x + w.w / 2 - 16, w.y + TITLE + 14, 32, 32)) { w.game = newMines(); return; }
    if (!inside(c, gx, gy, GRID * CELL, GRID * CELL)) return;
    const i = Math.floor((c.y - gy) / CELL) * GRID + Math.floor((c.x - gx) / CELL);
    if (right) {
      if (m.state !== 'play' || m.cells[i].open) return;
      m.cells[i].flag = !m.cells[i].flag;
      m.flags += m.cells[i].flag ? 1 : -1;
    } else {
      const before = m.state;
      openCell(m, i);
      if (m.state !== before && m.state === 'lost') this.onSound?.('boom');
      if (m.state !== before && m.state === 'won') this.onSound?.('win');
    }
  }

  key(e) {
    if (this.power !== 'on') return;
    const w = this.front;
    if (!w || w.app !== 'notepad') return;
    if (e.key === 'Backspace') w.text = w.text.slice(0, -1);
    else if (e.key === 'Enter') w.text += '\n';
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) w.text += e.key;
    else return;
    if (w.text.length > 1500) w.text = w.text.slice(0, 1500);
    this.onSound?.('key');
    this.dirty = true;
  }

  // ---------------- time

  update(dt) {
    this.time += dt;
    if (this.power === 'off') {
      if (this.dirty) this.draw();
      return;
    }
    this.stageT += dt;
    const stage = STAGES[this.power];
    if (stage) {
      // a stage of the boot (or of shutting down): fire its noises on time, then move on
      while (this.fired < stage.cues.length && this.stageT >= stage.cues[this.fired][1]) this.onSound?.(stage.cues[this.fired++][0]);
      if (this.power === 'post') {
        const counted = Math.floor(THREE.MathUtils.clamp((this.stageT - 0.9) / 1.5, 0, 1) * 16);
        if (counted !== this.memory) { this.memory = counted; if (counted > 0 && counted < 16) this.onSound?.('tick'); }
      }
      this.dirty = true;
      if (this.stageT >= stage.len) this.enter(NEXT[this.power]);
      if (this.power === 'off') { this.draw(); return; }
    } else if (this.stageT < 3.2) this.dirty = true; // the desktop still filling in
    const minute = Math.floor(this.time / 60);
    if (minute !== this.minute) { this.minute = minute; this.dirty = true; }
    const blink = this.active && Math.floor(this.time * 2) % 2 === 0;
    if (blink !== this.blink) { this.blink = blink; if (this.front?.app === 'notepad') this.dirty = true; }
    for (const w of this.windows) {
      if (w.app !== 'mines' || w.game.state !== 'play') continue;
      const before = Math.floor(w.game.time);
      w.game.time = Math.min(w.game.time + dt, 999);
      if (Math.floor(w.game.time) !== before) this.dirty = true;
    }
    if (this.dirty) this.draw();
  }

  // ---------------- drawing

  draw() {
    const g = this.g;
    this.dirty = false;
    g.textBaseline = 'middle';
    if (this.power !== 'on') {
      g.fillStyle = this.power === 'welcome' || this.power === 'closing' ? '#2a5fc4' : '#020203';
      g.fillRect(0, 0, W, H);
      if (this.power === 'post') this.drawPost();
      else if (this.power === 'logo') this.drawLogo();
      else if (this.power === 'welcome' || this.power === 'closing') this.drawBanner();
      if (this.power !== 'off') crtFinish(g, W, H, 2);
      this.texture.needsUpdate = true;
      return;
    }
    g.drawImage(this.back, 0, 0);

    // just after logging in the desktop turns up piece by piece
    const shown = Math.floor((this.stageT - 0.9) / 0.4);
    for (const [n, icon] of ICONS.entries()) {
      if (n > shown) break;
      if (this.selected === icon.id) {
        g.fillStyle = 'rgba(30,80,200,0.45)';
        g.fillRect(icon.x, icon.y, 90, 78);
      }
      glyph(g, icon.id, icon.x + 23, icon.y + 4, 44);
      g.font = `14px ${FONT}`;
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillText(icon.label, icon.x + 46, icon.y + 64);
      g.fillStyle = '#fff';
      g.fillText(icon.label, icon.x + 45, icon.y + 63);
    }

    this.windows.forEach((w, i) => this.drawWindow(w, i === this.windows.length - 1));
    if (this.stageT > 0.5) this.drawTaskbar();
    if (this.menu) this.drawMenu();
    if (this.active) this.drawCursor();
    crtFinish(g, W, H, 2);
    this.texture.needsUpdate = true;
  }

  /** Power-on self-test: white type on black, a line at a time. */
  drawPost() {
    const g = this.g, t = this.stageT;
    g.font = '16px "Lucida Console", "Courier New", monospace';
    g.textAlign = 'left';
    g.fillStyle = '#c8c8c8';
    const mem = Math.floor(THREE.MathUtils.clamp((t - 0.9) / 1.5, 0, 1) * 16) * 8192;
    const lines = [
      [0.15, 'Tundra BIOS v2.11, an Energy Sipper Ally'],
      [0.15, 'Copyright (C) 1984-2001, Tundra Software, Inc.'],
      [0.5, ''],
      [0.5, 'Main Processor : Quantium III 733MHz'],
      [0.9, `Memory Testing : ${String(mem).padStart(6, ' ')}K${mem >= 131072 ? ' OK' : ''}`],
      [2.7, ''],
      [2.7, 'Detecting Primary Master   ... FROSTBYTE 20.4GB'],
      [3.2, 'Detecting Secondary Master ... CD-ROM 52X'],
      [3.7, 'Floppy Drive A:            ... 1.44MB 3.5in'],
      [4.7, ''],
      [4.7, 'Starting Macrofrost XD...'],
    ];
    lines.forEach(([at, text], i) => { if (t >= at) g.fillText(text, 28, 40 + i * 24); });
    g.fillText('Press DEL to enter SETUP', 28, H - 30);
    frostMark(g, W - 70, 62, 34);
  }

  /** The long wait: logo, and three blocks chasing each other across a bar. */
  drawLogo() {
    const g = this.g;
    frostMark(g, W / 2 - 150, H / 2 - 56, 46);
    wordmark(g, W / 2 - 90, H / 2 - 36, 52);
    g.font = `16px ${FONT}`;
    g.fillStyle = '#b9c2d0';
    g.textAlign = 'left';
    g.fillText('Home Edition', W / 2 - 86, H / 2 - 8);
    const bx = W / 2 - 100, by = H / 2 + 70;
    g.strokeStyle = '#8a93a3';
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(bx, by, 200, 18, 5);
    g.stroke();
    g.save();
    g.beginPath();
    g.rect(bx + 3, by + 3, 194, 12);
    g.clip();
    const head = ((this.stageT * 110) % 260) - 40;
    g.fillStyle = '#3a8bf0';
    for (let i = 0; i < 3; i++) g.fillRect(bx + head - i * 15, by + 4, 11, 10);
    g.restore();
    g.font = `13px ${FONT}`;
    g.fillStyle = '#8a93a3';
    g.textAlign = 'center';
    g.fillText('Copyright © Macrofrost Corporation', W / 2, H - 40);
  }

  /** Blue holding screen on the way in and on the way out. */
  drawBanner() {
    const g = this.g;
    const band = g.createLinearGradient(0, 0, 0, H);
    band.addColorStop(0, '#1b3f9c');
    band.addColorStop(0.14, '#1b3f9c');
    band.addColorStop(0.15, '#5a8fe8');
    band.addColorStop(0.5, '#3f76d8');
    band.addColorStop(0.85, '#2a5fc4');
    band.addColorStop(0.86, '#1b3f9c');
    band.addColorStop(1, '#1b3f9c');
    g.fillStyle = band;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    if (this.power === 'welcome') {
      g.font = `italic 46px ${FONT}`;
      g.fillText('welcome', W / 2 + 60, H / 2);
      frostMark(g, W / 2 - 120, H / 2, 40);
    } else {
      frostMark(g, W / 2, H / 2 - 70, 40);
      g.font = `22px ${FONT}`;
      g.fillText('Macrofrost XD is shutting down...', W / 2, H / 2 + 10);
      g.font = `15px ${FONT}`;
      g.fillStyle = '#cfe0ff';
      g.fillText('Saving your settings', W / 2, H / 2 + 44);
    }
  }

  drawWindow(w, focused) {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(w.x + 5, w.y + 6, w.w, w.h);
    const bar = g.createLinearGradient(0, w.y, 0, w.y + TITLE);
    bar.addColorStop(0, focused ? '#2f86f6' : '#8aa6dc');
    bar.addColorStop(0.5, focused ? '#0a5ae0' : '#7b97d0');
    bar.addColorStop(1, focused ? '#0a4cc8' : '#7a94cc');
    g.fillStyle = bar;
    g.beginPath();
    g.roundRect(w.x, w.y, w.w, w.h, [8, 8, 0, 0]);
    g.fill();
    g.fillStyle = '#ece9d8';
    g.fillRect(w.x + 4, w.y + TITLE, w.w - 8, w.h - TITLE - 4);
    g.font = `700 15px ${FONT}`;
    g.textAlign = 'left';
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillText(w.title, w.x + 11, w.y + TITLE / 2 + 2);
    g.fillStyle = '#fff';
    g.fillText(w.title, w.x + 10, w.y + TITLE / 2 + 1);
    // close button
    g.fillStyle = '#d6452c';
    g.beginPath();
    g.roundRect(w.x + w.w - 27, w.y + 5, 21, 20, 4);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(w.x + w.w - 21, w.y + 10); g.lineTo(w.x + w.w - 12, w.y + 20);
    g.moveTo(w.x + w.w - 12, w.y + 10); g.lineTo(w.x + w.w - 21, w.y + 20);
    g.stroke();

    const bx = w.x + 4, by = w.y + TITLE, bw = w.w - 8, bh = w.h - TITLE - 4;
    g.save();
    g.beginPath();
    g.rect(bx, by, bw, bh);
    g.clip();
    if (w.app === 'notepad') this.drawNotepad(w, bx, by, bw, bh, focused);
    else if (w.app === 'mines') this.drawMines(w);
    else this.drawFolder(w, bx, by, bw, bh);
    g.restore();
  }

  drawNotepad(w, bx, by, bw, bh, focused) {
    const g = this.g;
    g.fillStyle = '#fff';
    g.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
    g.font = '15px "Lucida Console", "Courier New", monospace';
    g.fillStyle = '#111';
    g.textAlign = 'left';
    const lines = [];
    for (const para of w.text.split('\n')) {
      let line = '';
      for (const word of para.split(/(?<= )/)) {
        if (g.measureText(line + word).width > bw - 22 && line) { lines.push(line); line = ''; }
        line += word;
      }
      lines.push(line);
    }
    const rows = Math.floor((bh - 14) / 19);
    const shown = lines.slice(-rows); // always scrolled to the end, where the typing happens
    shown.forEach((line, i) => g.fillText(line, bx + 10, by + 18 + i * 19));
    if (focused && this.blink) {
      const last = shown[shown.length - 1] ?? '';
      g.fillRect(bx + 10 + g.measureText(last).width + 1, by + 9 + (shown.length - 1) * 19, 2, 17);
    }
  }

  drawMines(w) {
    const g = this.g, m = w.game;
    const gx = w.x + 18, gy = w.y + TITLE + 60;
    g.fillStyle = '#c0c0c0';
    g.fillRect(w.x + 4, w.y + TITLE, w.w - 8, w.h - TITLE - 4);
    const lcd = (text, x) => {
      g.fillStyle = '#200';
      g.fillRect(x, w.y + TITLE + 14, 54, 32);
      g.fillStyle = '#ff2a1a';
      g.font = '700 24px "Courier New", monospace';
      g.textAlign = 'center';
      g.fillText(text, x + 27, w.y + TITLE + 31);
    };
    lcd(String(Math.max(MINES - m.flags, 0)).padStart(3, '0'), gx);
    lcd(String(Math.floor(m.time)).padStart(3, '0'), gx + GRID * CELL - 54);
    // face
    const fx = w.x + w.w / 2, fy = w.y + TITLE + 30;
    g.fillStyle = '#ffd83a';
    g.beginPath();
    g.arc(fx, fy, 14, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#111';
    g.lineWidth = 1.6;
    g.stroke();
    g.fillStyle = '#111';
    g.fillRect(fx - 6, fy - 5, 3, 3);
    g.fillRect(fx + 3, fy - 5, 3, 3);
    g.beginPath();
    if (m.state === 'lost') g.arc(fx, fy + 9, 6, Math.PI * 1.15, Math.PI * 1.85);
    else g.arc(fx, fy + 1, 7, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();

    g.textAlign = 'center';
    for (let i = 0; i < GRID * GRID; i++) {
      const x = gx + (i % GRID) * CELL, y = gy + Math.floor(i / GRID) * CELL;
      const c = m.cells?.[i];
      if (c?.open) {
        g.fillStyle = c.mine ? '#e85a4a' : '#bdbdbd';
        g.fillRect(x, y, CELL, CELL);
        g.strokeStyle = '#8a8a8a';
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        if (c.mine) {
          g.fillStyle = '#111';
          g.beginPath();
          g.arc(x + CELL / 2, y + CELL / 2, 6, 0, Math.PI * 2);
          g.fill();
        } else if (c.n) {
          g.fillStyle = NUM_COLORS[c.n];
          g.font = `700 17px ${FONT}`;
          g.fillText(String(c.n), x + CELL / 2, y + CELL / 2 + 1);
        }
      } else {
        g.fillStyle = '#c0c0c0';
        g.fillRect(x, y, CELL, CELL);
        g.fillStyle = '#fff';
        g.fillRect(x, y, CELL, 3);
        g.fillRect(x, y, 3, CELL);
        g.fillStyle = '#7b7b7b';
        g.fillRect(x, y + CELL - 3, CELL, 3);
        g.fillRect(x + CELL - 3, y, 3, CELL);
        if (c?.flag) {
          g.fillStyle = '#d6452c';
          g.beginPath();
          g.moveTo(x + 9, y + 6); g.lineTo(x + 17, y + 10); g.lineTo(x + 9, y + 14);
          g.fill();
          g.fillStyle = '#111';
          g.fillRect(x + 8, y + 6, 2, 13);
        }
      }
    }
    if (m.state === 'won') {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillRect(gx, gy + GRID * CELL / 2 - 18, GRID * CELL, 36);
      g.fillStyle = '#0a4cc8';
      g.font = `700 18px ${FONT}`;
      g.fillText('You win!', gx + (GRID * CELL) / 2, gy + (GRID * CELL) / 2);
    }
  }

  drawFolder(w, bx, by, bw, bh) {
    const g = this.g;
    g.fillStyle = '#fff';
    g.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
    const items = w.app === 'computer'
      ? [['disk', 'Local Disk (C:)'], ['disk', 'CD Drive (D:)'], ['disk', 'Floppy (A:)']]
      : w.app === 'documents' ? Object.keys(FILES).map((name) => ['file', name]) : [];
    g.font = `14px ${FONT}`;
    g.textAlign = 'center';
    items.forEach(([icon, label], i) => {
      glyph(g, icon, bx + 44 + i * 120, by + 20, 44);
      g.fillStyle = '#111';
      g.fillText(label, bx + 66 + i * 120, by + 82);
    });
    if (!items.length) {
      g.fillStyle = '#8a8f9a';
      g.fillText('(empty)', bx + bw / 2, by + bh / 2);
    }
  }

  drawTaskbar() {
    const g = this.g, y = H - BAR;
    const bar = g.createLinearGradient(0, y, 0, H);
    bar.addColorStop(0, '#3b84f2');
    bar.addColorStop(0.12, '#245edb');
    bar.addColorStop(1, '#1c47b0');
    g.fillStyle = bar;
    g.fillRect(0, y, W, BAR);
    const btn = g.createLinearGradient(0, y, 0, H);
    btn.addColorStop(0, '#5cc25c');
    btn.addColorStop(0.2, '#3a9a3a');
    btn.addColorStop(1, '#2a7a2a');
    g.fillStyle = btn;
    g.beginPath();
    g.roundRect(0, y, 104, BAR, [0, 14, 14, 0]);
    g.fill();
    g.font = `italic 700 20px ${FONT}`;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillText('start', 53, y + BAR / 2 + 2);
    g.fillStyle = '#fff';
    g.fillText('start', 52, y + BAR / 2 + 1);

    g.font = `14px ${FONT}`;
    g.textAlign = 'left';
    this.taskOrder().forEach((w, i) => {
      const x = 112 + i * 128;
      g.fillStyle = w === this.front ? '#1b4fc0' : '#3c7ff0';
      g.beginPath();
      g.roundRect(x, y + 5, 122, BAR - 9, 4);
      g.fill();
      g.fillStyle = '#fff';
      g.fillText(w.title.length > 15 ? `${w.title.slice(0, 14)}…` : w.title, x + 8, y + BAR / 2 + 1);
    });

    g.fillStyle = '#1290e8';
    g.fillRect(W - 96, y, 96, BAR);
    const mins = 18 * 60 + 4 + Math.floor(this.time / 60); // (daytime.js: six in the evening)
    const hh = Math.floor(mins / 60) % 24, mm = mins % 60;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.fillText(`${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`, W - 48, y + BAR / 2 + 1);
  }

  drawMenu() {
    const g = this.g, m = MENU, c = this.cursor;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(m.x + 5, m.y + 5, m.w, m.h);
    g.fillStyle = '#245edb';
    g.beginPath();
    g.roundRect(m.x, m.y, m.w, m.h, [8, 8, 0, 0]);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(m.x + 3, m.y + m.head, m.w - 6, m.h - m.head - m.foot);
    g.font = `700 17px ${FONT}`;
    g.textAlign = 'left';
    g.fillText('Me', m.x + 16, m.y + m.head / 2 + 1);
    g.font = `15px ${FONT}`;
    MENU_ITEMS.forEach((id, i) => {
      const y = m.y + m.head + i * m.row;
      if (inside(c, m.x, y, m.w, m.row)) {
        g.fillStyle = '#2f6fe0';
        g.fillRect(m.x + 3, y, m.w - 6, m.row);
      }
      glyph(g, id, m.x + 12, y + 5, 30);
      g.fillStyle = inside(c, m.x, y, m.w, m.row) ? '#fff' : '#111';
      g.fillText(MENU_LABELS[id], m.x + 54, y + m.row / 2 + 1);
    });
    const fy = m.y + m.h - m.foot;
    glyph(g, 'off', m.x + m.w - 172, fy + 9, 28);
    g.fillStyle = '#fff';
    g.fillText('Turn Off Computer', m.x + m.w - 136, fy + m.foot / 2 + 1);
  }

  drawCursor() {
    const g = this.g, { x, y } = this.cursor;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + 19);
    g.lineTo(x + 5, y + 14.5);
    g.lineTo(x + 8.5, y + 22);
    g.lineTo(x + 11.5, y + 20.5);
    g.lineTo(x + 8, y + 13.5);
    g.lineTo(x + 14, y + 13.5);
    g.closePath();
    g.fillStyle = '#fff';
    g.fill();
    g.strokeStyle = '#000';
    g.lineWidth = 1.3;
    g.stroke();
  }
}
