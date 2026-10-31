// Sound. Things in the room are heard from where they are; the listener follows the camera.
//
// Every sound is a recording, dropped into assets/sounds/ and picked up by name (see BANK). With no
// recording there is simply no sound: nothing is generated or faked, organic or electronic (user,
// 2026-10-15: the synthesised ones "they suck" — only real recordings stay). What is done here is
// placing them (3D position, distance, the street heard through glass) and playing them.
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);

const WINDOW = [1.975, 1.6, -5], PC = [3.5, 0.9, 1.66], TV = [0.55, 0.9, 1.85];

// Recordings, by file name: assets/sounds/<name>.ogg, or <name>-1.ogg, <name>-2.ogg … for takes
// that are picked from at random (.mp3, .wav, .m4a and .flac work too).
// gain: playback level (every recording is first brought to the same peak, so this is relative);
// vary: random pitch change either way, so repeats don't sound stamped;
// cycle: play the takes in file order (-1, -2, …) instead of at random — left foot, right foot;
// cut: everything below this many Hz is stripped when the file loads (default 70) — field
//      recordings carry rumble far louder than the sound itself, and levelling must ignore it;
// soften: a low-pass at this many Hz, to take the edge off;
// fade: [in, out] seconds, so a clip's own background doesn't switch on and off audibly.
const SOUND_DIR = 'assets/sounds/';
const BANK = {
  'step-carpet': { gain: 0.056, vary: 0.03, cycle: true, soften: 2200 }, 'step-bed': { gain: 0.45, vary: 0.03, cycle: true }, 'step-wood': { gain: 0.5, vary: 0.03, cycle: true },
  'land-carpet': { gain: 0.7, vary: 0.04 }, 'land-bed': { gain: 0.7, vary: 0.04 }, 'land-wood': { gain: 0.7, vary: 0.04 },
  'step-tile': { gain: 0.45, vary: 0.03, cycle: true }, 'step-grass': { gain: 0.45, vary: 0.04, cycle: true },
  'land-tile': { gain: 0.7, vary: 0.04 }, 'land-grass': { gain: 0.7, vary: 0.04 },
  'cat-meow': { gain: 0.55, vary: 0.04 }, 'cat-purr': { gain: 0.5, vary: 0 }, 'cat-lick': { gain: 0.25, vary: 0.05 }, 'cat-land': { gain: 0.4, vary: 0.05 },
  bird: { gain: 0.6, vary: 0.02, cut: 400, fade: [0.3, 0.6] }, pigeon: { gain: 0.15, vary: 0.01, cut: 120, fade: [0.3, 0.6] },
  'door-open': { gain: 0.7, vary: 0.02 }, 'door-close': { gain: 0.7, vary: 0.02 }, blinds: { gain: 0.6, vary: 0.03 },
  'chair-sit': { gain: 0.5, vary: 0.04 }, 'chair-stand': { gain: 0.5, vary: 0.04 },
  'bag-open': { gain: 0.5, vary: 0.03 }, 'bag-spill': { gain: 0.5, vary: 0.03 }, take: { gain: 0.4, vary: 0.05 },
  // the bathroom: a tap turned, the bath running and running over (both played round and round), the toilet lid
  'tap-turn': { gain: 0.5, vary: 0.04 }, 'bath-run': { gain: 0.5, vary: 0 }, 'bath-spill': { gain: 0.45, vary: 0 }, 'toilet-lid': { gain: 0.6, vary: 0.03 }, 'toilet-flush': { gain: 0.7, vary: 0.02 }, 'hose-run': { gain: 0.45, vary: 0 },
  'basin-tap': { gain: 0.45, vary: 0.04 }, 'basin-run': { gain: 0.45, vary: 0 },
  'sand-dig': { gain: 0.5, vary: 0.05 }, 'slide': { gain: 0.5, vary: 0.03 }, // the yard: a spadeful of sand; going down the slide
  // the storm cellar: its steel doors tugged against the lock, the rusted metal giving, the doors swinging open onto their stops; down
  // there, concrete underfoot, a locked door tried, the bulb's chain pulled
  'cellar-rattle': { gain: 0.7, vary: 0.03 }, 'cellar-give': { gain: 0.75, vary: 0.02 }, 'cellar-open': { gain: 0.7, vary: 0.02 },
  'step-concrete': { gain: 0.45, vary: 0.03, cycle: true }, 'land-concrete': { gain: 0.7, vary: 0.04 }, 'door-locked': { gain: 0.6, vary: 0.03 }, 'chain-pull': { gain: 0.5, vary: 0.04 },
  'step-water': { gain: 0.45, vary: 0.04, cycle: true }, 'land-water': { gain: 0.7, vary: 0.04 },
  // the house: slammed and shut doors, the cabinet, the cooker, and the standing tone of a room
  'door-slam': { gain: 0.8, vary: 0.02 }, 'cabinet-open': { gain: 0.5, vary: 0.03 }, 'cabinet-close': { gain: 0.5, vary: 0.03 },
  'cooker-on': { gain: 0.5, vary: 0.03 }, 'cooker-off': { gain: 0.5, vary: 0.03 }, 'room-tone': { gain: 0.35, vary: 0 },
  'fridge-open': { gain: 0.5, vary: 0.03 }, 'fridge-close': { gain: 0.55, vary: 0.03 },
  'clock-tick': { gain: 0.3, vary: 0.01, cycle: true }, // tick, tock: -1 and -2, in turn
  'knife-chop': { gain: 0.45, vary: 0.05 }, 'knife-down': { gain: 0.4, vary: 0.04 }, // Mum at the chopping board: a slice of carrot cut through onto the wood; the knife put down on it
  // electronics
  switch: { gain: 0.6, vary: 0.03 }, 'tv-on': { gain: 0.6, vary: 0 }, 'tv-off': { gain: 0.6, vary: 0 }, 'tv-static': { gain: 0.35, vary: 0 },
  'pc-on': { gain: 0.6, vary: 0 }, 'pc-off': { gain: 0.6, vary: 0 }, 'pc-seek': { gain: 0.5, vary: 0.04 }, 'pc-floppy': { gain: 0.5, vary: 0 },
  key: { gain: 0.45, vary: 0.06 }, 'mouse-click': { gain: 0.4, vary: 0.04 },
  'pc-chime': { gain: 0.5, vary: 0 }, 'pc-bye': { gain: 0.5, vary: 0 }, 'pc-open': { gain: 0.4, vary: 0.03 }, 'pc-beep': { gain: 0.4, vary: 0 },
  'pc-boom': { gain: 0.6, vary: 0.02 }, 'pc-win': { gain: 0.5, vary: 0 }, 'pc-tick': { gain: 0.3, vary: 0.05 },
};

/** Strips everything below `hz` from a recording, in place (two passes of a second-order high-pass). */
function removeRumble(buffer, hz) {
  const w = (2 * Math.PI * hz) / buffer.sampleRate, cos = Math.cos(w), alpha = Math.sin(w) / Math.SQRT2;
  const b0 = (1 + cos) / 2 / (1 + alpha), b1 = -(1 + cos) / (1 + alpha), a1 = (-2 * cos) / (1 + alpha), a2 = (1 - alpha) / (1 + alpha);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let pass = 0; pass < 2; pass++) {
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < d.length; i++) {
        const x = d[i], y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        d[i] = y;
      }
    }
  }
}


export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.paused = false;
    this.tvOn = false;
    this.pcOn = false;
    this.life = { bird: rnd(10, 30), pigeon: rnd(40, 100) };
    this.samples = {}; // name → { takes: [AudioBuffer], last }
  }

  /** Has to be called from a user gesture (the Enter button), or the browser keeps it silent. */
  start() {
    if (this.ctx) return this.ctx.resume();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
    this.buildAmbience();
    this.loadSamples();
  }

  // ---------------- recordings

  /** Finds whatever is in assets/sounds/ (folder listing while developing, list.json when published). */
  async loadSamples() {
    let files = [];
    try {
      const res = await fetch(SOUND_DIR);
      if (res.ok) files = [...(await res.text()).matchAll(/href="([^"?#]+\.(?:ogg|mp3|wav|m4a|flac))"/gi)].map((m) => decodeURIComponent(m[1]));
      else files = await (await fetch(`${SOUND_DIR}list.json`)).json();
    } catch { /* no recordings available: the room is just quieter */ }
    const found = [];
    await Promise.all(files.map(async (file) => {
      const name = file.replace(/^.*\//, '').replace(/(-\d+)?\.\w+$/, '');
      if (!BANK[name]) return;
      try {
        const buffer = await this.ctx.decodeAudioData(await (await fetch(SOUND_DIR + file)).arrayBuffer());
        // recordings arrive with rumble, at any level, and with dead air in front: deal with all three
        removeRumble(buffer, BANK[name].cut ?? 70);
        let peak = 0, onset = buffer.length;
        for (let c = 0; c < buffer.numberOfChannels; c++) for (const v of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
        for (let c = 0; c < buffer.numberOfChannels; c++) onset = Math.min(onset, buffer.getChannelData(c).findIndex((v) => Math.abs(v) > peak * 0.1));
        found.push({ name, file, buffer, level: Math.min(0.5 / Math.max(peak, 1e-4), 400), skip: Math.max(onset / buffer.sampleRate - 0.005, 0) });
      } catch { console.warn(`sound: could not read ${file}`); }
    }));
    found.sort((p, q) => p.file.localeCompare(q.file, undefined, { numeric: true }));
    for (const take of found) (this.samples[take.name] ??= { takes: [], last: -1, next: 0 }).takes.push(take);
    this.steady('room-tone', null).set(1); // the room's own tone, if there is a recording of it
  }

  /**
   * A recording played round and round from `pos` for as long as something keeps going (a running tap).
   * `set(level)`: 0…1, faded to; at 0 it falls silent. Nothing if there is no recording of it.
   */
  steady(name, pos) {
    let vol = null;
    return {
      set: (level) => {
        const s = this.samples[name];
        if (!this.ctx || !s) return;
        const take = s.takes[0], t = this.ctx.currentTime;
        if (!vol) {
          if (level <= 0) return;
          const src = this.ctx.createBufferSource();
          src.buffer = take.buffer;
          src.loop = true;
          src.loopStart = take.skip;
          src.loopEnd = take.buffer.duration;
          vol = this.ctx.createGain();
          vol.gain.value = 0;
          this.chain(src, vol, this.at(pos, 1.2));
          src.start(t, take.skip);
        }
        const to = BANK[name].gain * take.level * level;
        if (Math.abs(vol.gain.value - to) > 1e-3) vol.gain.setTargetAtTime(to, t, 0.25);
      },
    };
  }

  /**
   * Plays a recording if there is one and returns how long it will last (false if there is
   * none). `where` is a point in the room ([x, y, z] or a Vector3) or an audio node to play into.
   */
  sample(name, where, level = 1) {
    const s = this.samples[name];
    if (!this.ctx || !s) return false;
    const dest = where instanceof AudioNode ? where : this.at(where);
    let i;
    if (BANK[name].cycle) {
      i = s.next;
      s.next = (s.next + 1) % s.takes.length;
    } else {
      i = Math.floor(Math.random() * s.takes.length);
      if (s.takes.length > 1 && i === s.last) i = (i + 1) % s.takes.length; // never the same take twice running
    }
    s.last = i;
    const take = s.takes[i], bank = BANK[name], t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = take.buffer;
    src.playbackRate.value = 1 + rnd(-bank.vary, bank.vary);
    const seconds = (take.buffer.duration - take.skip) / src.playbackRate.value;
    const vol = this.ctx.createGain(), loud = bank.gain * take.level * level;
    if (bank.fade) {
      vol.gain.setValueAtTime(0, t);
      vol.gain.linearRampToValueAtTime(loud, t + bank.fade[0]);
      vol.gain.setValueAtTime(loud, t + seconds - bank.fade[1]);
      vol.gain.linearRampToValueAtTime(0, t + seconds);
    } else vol.gain.value = loud;
    this.chain(...[src, bank.soften && this.filter('lowpass', bank.soften, 0.6), vol, dest].filter(Boolean));
    src.start(t, take.skip);
    return seconds;
  }

  setPaused(on) {
    this.paused = on;
    this.applyVolume();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyVolume();
    return this.muted;
  }

  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted || this.paused ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  // ---------------- building blocks

  /** Where a sound plays from: a point in the room, or straight to the ears if `pos` is omitted. */
  at(pos, reach = 0.8) {
    if (!pos) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = reach; // how far away it still sounds full: small for a switch, large for the street
    p.rolloffFactor = 1.3;
    const [x, y, z] = pos.isVector3 ? pos.toArray() : pos;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    p.connect(this.master);
    return p;
  }

  /** Impulse response of open air between buildings: a dense, dulling tail `tail` seconds long. */
  distance(seconds, tail) {
    const rate = this.ctx.sampleRate, n = Math.floor(rate * seconds);
    const ir = this.ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let smooth = 0;
      for (let i = 0; i < n; i++) {
        const t = i / rate;
        // later echoes have lost more of their treble
        smooth += (Math.random() * 2 - 1 - smooth) * Math.max(0.08, 0.6 - t * 0.9);
        d[i] = t < 0.012 ? 0 : smooth * Math.exp(-t / tail);
      }
    }
    return ir;
  }

  chain(...nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[0];
  }

  filter(type, freq, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  gain(value) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    return g;
  }

  // ---------------- the room's standing sounds

  buildAmbience() {
    const ctx = this.ctx;
    // the street, well beyond closed glass. Three things make it sound far off rather than
    // quiet-but-near: nearly all of it arrives as echo off the buildings instead of directly, the
    // top end is gone, and it comes from well out past the window — a tree, a roof across the
    // road (outsideFrom) — rather than from the sill.
    this.outside = this.gain(1);
    const echo = ctx.createConvolver();
    echo.buffer = this.distance(1.6, 0.4);
    this.outsideTone = this.filter('lowpass', 2000, 0.5);
    this.chain(this.outside, this.gain(0.12), this.outsideTone);
    this.chain(this.outside, echo, this.gain(0.88), this.outsideTone);
    this.outsideAt = this.at(WINDOW, 6);
    this.outsideGlass = this.filter('lowpass', 2400, 0.5);
    // and where you are in the house (user, 2026-10-20: "the pigeon as it is only in my room"): out of the
    // bedroom its window is behind walls — far off, dull; in the bathroom, at the back of the house, nothing
    this.outsideWalls = this.filter('lowpass', 20000, 0.5);
    this.outsideRoom = this.gain(1);
    this.chain(this.outsideTone, this.outsideGlass, this.outsideWalls, this.outsideRoom, this.outsideAt);
  }

  setTv(on) {
    this.tvOn = on;
  }

  /** The machine switched on or off: its recording, if there is one. */
  pcPower(on) {
    this.pcOn = on;
    if (this.ctx) this.sample(on ? 'pc-on' : 'pc-off', PC);
  }

  /** The blind takes a little more off the street: 1 with it open, 0 with it shut. `outdoors`: 1 out in the yard, where nothing is in the way. */
  setOutside(open, outdoors = 0, room = 'bedroom') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.outsideTone.frequency.setTargetAtTime(THREE.MathUtils.lerp(1400 + 400 * open, 9000, outdoors), t, 0.2);
    this.outsideGlass.frequency.setTargetAtTime(THREE.MathUtils.lerp(2400, 12000, outdoors), t, 0.2);
    // `room` (house.roomAt): the bedroom and the yard hear it as it is; the other rooms faintly, through walls;
    // the bathroom not at all
    const [loud, top] = room === 'bath' || room === 'cellar' ? [0, 400] : room === 'bedroom' || room === 'yard' ? [1, 20000] : [0.18, 650]; // (under the house, nothing of it either)
    this.outsideRoom.gain.setTargetAtTime(loud, t, 0.25);
    this.outsideWalls.frequency.setTargetAtTime(top, t, 0.25);
  }

  /** Where the next thing heard out there is: up in a tree or on a roof, some way off to either side. */
  outsideFrom() {
    const p = this.outsideAt, x = WINDOW[0] + rnd(-7, 7), y = rnd(3, 7), z = -rnd(9, 16);
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    return this.outside;
  }

  // ---------------- every frame

  update(dt, camera) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    // ears
    const l = ctx.listener;
    camera.getWorldPosition(_p);
    camera.getWorldDirection(_f);
    _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (l.positionX) {
      l.positionX.value = _p.x; l.positionY.value = _p.y; l.positionZ.value = _p.z;
      l.forwardX.value = _f.x; l.forwardY.value = _f.y; l.forwardZ.value = _f.z;
      l.upX.value = _u.x; l.upY.value = _u.y; l.upZ.value = _u.z;
    } else {
      l.setPosition(_p.x, _p.y, _p.z);
      l.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z);
    }
    if (this.paused) return;

    // life outside: a bird now and then, a pigeon more rarely, never a chorus
    // (each wait starts when the clip ends, so two never pile up)
    if ((this.life.bird -= dt) <= 0) this.life.bird = (this.sample('bird', this.outsideFrom(), rnd(0.5, 1)) || 0) + rnd(20, 75);
    if ((this.life.pigeon -= dt) <= 0) this.life.pigeon = (this.sample('pigeon', this.outsideFrom(), rnd(0.6, 1)) || 0) + rnd(70, 200);
  }

  // ---------------- things that happen

  click(pos, loud = 1) {
    if (this.ctx) this.sample('switch', pos, loud);
  }

  /** A picture tube coming on or going off. */
  crt(on, pos) {
    if (this.ctx) this.sample(on ? 'tv-on' : 'tv-off', pos);
  }

  blinds(pos) {
    this.sample('blinds', pos);
  }

  door(opening, pos) {
    this.sample(opening ? 'door-open' : 'door-close', pos);
  }

  /** The backpack: 'open' as the flap goes and it flops over, 'spill' as its contents slide out. */
  bag(stage, pos) {
    this.sample(`bag-${stage}`, pos);
  }

  /** Something small picked up off the floor. */
  take(pos) {
    this.sample('take', pos);
  }

  chair(sitting, pos) {
    this.sample(sitting ? 'chair-sit' : 'chair-stand', pos);
  }

  /** A recording for a surface, or the nearest one there is: water underfoot sounds of the tiles under it until there is a recording of water. */
  underfoot(kind, surface) {
    return this.samples[`${kind}-${surface}`] || surface !== 'water' ? surface : 'tile';
  }

  /** A footfall. `first`: the first of a new walk, which always starts again from take 1. */
  step(surface, speed, first) {
    surface = this.underfoot('step', surface);
    const s = this.samples[`step-${surface}`];
    if (s && first) s.next = 0;
    this.sample(`step-${surface}`, this.master, THREE.MathUtils.clamp(speed / 1.7, 0.7, 1.4));
  }

  land(speed, surface) {
    surface = this.underfoot('land', surface);
    this.sample(`land-${surface}`, this.master, THREE.MathUtils.clamp(speed / 3, 0.5, 1.3));
  }

  // ---------------- Luna

  meow(pos) {
    this.sample('cat-meow', pos);
  }

  purr(pos) {
    this.sample('cat-purr', pos);
  }

  lick(pos) {
    this.sample('cat-lick', pos);
  }

  /** Paws hitting the carpet after a jump down. */
  catLand(pos) {
    this.sample('cat-land', pos);
  }

  // ---------------- the PC

  ui(name) {
    if (!this.ctx) return;
    const recording = { click: 'mouse-click', key: 'key', seek: 'pc-seek', floppy: 'pc-floppy' }[name] ?? `pc-${name}`;
    this.sample(recording, PC);
  }
}

const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3();
