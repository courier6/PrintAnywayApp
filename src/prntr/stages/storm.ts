/**
 * The storm over the title (Edgar, 2026-10-19; not in the design handoff): a pixel cloud as
 * far above the word as the word is tall. It is a plain white cloud while the title comes in,
 * turns the red of the door's light while the credit flickers, and from the flip on it is a
 * dark storm cloud raining straight down on the word (Edgar, 2026-10-20). The rain wets the
 * letters: water sits on their top edges and pools in the corners, and drips off their
 * undersides. Now and then lightning strikes and the screen flashes white or blue. Everything
 * is drawn on one canvas over the viewport in whole "pixels" of P screen px (P from the
 * title's font size). Under reduced motion only the cloud is drawn, in its weather's colours.
 * While the title comes in (and, glitched, through the flicker) the cloud is one small cute
 * one; the dark bank of three is the storm's alone (Edgar, 2026-10-20). The clouds are drawn in
 * cells half the size of the rain's pixel, so their puffs are round and thin where they meet. While the credit
 * flickers the cute cloud is red and torn: cut into bands and blocks that jump along random
 * angles, some tilted, re-rolled every few frames.
 * The storm sounds like one, in the room's style: rain, a gusting wind, thunder after each
 * strike (Edgar, 2026-10-20). Between the near strikes, lightning flickers far off behind the
 * clouds, seen only below them and its thunder comes half a second to a second later, a distant roll.
 */

import type { PrntrAudio } from '../audio';
import { noiseBuffer } from './room/sounds';

export interface StormSlot {
  /** The letter's slot (an inline-block the size of its advance, wobbled by a transform). */
  el: HTMLElement;
  ch: string;
  /** Its wobble rotation in degrees, so the mask matches the letter on screen. */
  rot: number;
}

/** The cloud's weather (Edgar, 2026-10-20): calm while the title comes in, red through the
 * credit's flicker, the storm from the flip on. */
export type Weather = 'calm' | 'red' | 'storm';

export interface Storm {
  setWeather(w: Weather): void;
  /** One last strike as the title is left (Edgar, 2026-10-20): the bolt, the flash and a loud
   * thunder that rolls on into the room. Returns how many ms to hold the frame (0 if still). */
  finale(): number;
  stop(): void;
}

/** The storm's sound: the rain and wind loop from the storm's start; thunder on request. */
export interface StormSound {
  /** Thunder `delaySec` after now: a crack and a clap when near, only a distant roll when far. */
  thunder(delaySec: number, near: boolean): void;
  /** The finale's thunder: louder than any strike, its roll outlasting the sound's stop. */
  finale(): void;
  /** Fades the rain and wind out over `fadeS`. */
  stop(fadeS?: number): void;
}

/** The glitch's pulse (Edgar, 2026-10-20): a low tone, PULSE_HZ, gated on and off PULSE_RATE
 * times a second like a synthesizer's fastest pulse, lowpassed at PULSE_LP, while the screen
 * and the cloud are glitched; it stops the moment the glitch does. */
const PULSE_HZ = 55;
const PULSE_RATE = 26;
const PULSE_LP = 480;
const PULSE_GAIN = 0.16;

/** A very fast pulse of a low tone, from now until stop(): the sound of the opening's glitch. */
export function startGlitchPulse(ctx: AudioContext, out: AudioNode): { stop(): void } {
  const t0 = ctx.currentTime;
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = PULSE_HZ;
  const sub = ctx.createOscillator();
  sub.type = 'square';
  sub.frequency.value = PULSE_HZ / 2;
  const subG = ctx.createGain();
  subG.gain.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = PULSE_LP;
  // the gate: 0.5 plus a square wave of ±0.5, so the tone is all on or all off
  const gate = ctx.createGain();
  gate.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = PULSE_RATE;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.5;
  lfo.connect(lfoG);
  lfoG.connect(gate.gain);
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(PULSE_GAIN, t0 + 0.01);
  saw.connect(lp);
  sub.connect(subG);
  subG.connect(lp);
  lp.connect(gate);
  gate.connect(master);
  master.connect(out);
  saw.start(t0);
  sub.start(t0);
  lfo.start(t0);
  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(0, t, 0.006);
      const end = t + 0.08;
      saw.stop(end);
      sub.stop(end);
      lfo.stop(end);
      saw.onended = () => master.disconnect();
    },
  };
}

/** The rain's and the wind's gain, and how long each takes to come in. */
const RAIN_GAIN = 0.07;
const RAIN_IN_S = 1.5;
const WIND_GAIN = 0.09;
const WIND_IN_S = 2.5;

/**
 * The storm's sound, in the room's style (noise shaped by filters, through Prntr's master
 * gain): the rain a hiss above 2.5 kHz swelling a little at 0.3 Hz, the wind a rush below a
 * lowpass that gusts between 100 and 540 Hz at 0.11 Hz, and thunder as bursts of low noise:
 * a short crack and a clap for a near strike, a long roll for every strike.
 */
export function startStormSound(ctx: AudioContext, out: AudioNode): StormSound {
  const NOISE = noiseBuffer(ctx);
  const t0 = ctx.currentTime;
  const loop = () => {
    const src = ctx.createBufferSource();
    src.buffer = NOISE;
    src.loop = true;
    src.loopStart = Math.random();
    return src;
  };
  const filter = (type: BiquadFilterType, frequency: number) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    return f;
  };
  const lfo = (hz: number, depth: number, target: AudioParam) => {
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g);
    g.connect(target);
    o.start();
    return o;
  };
  // the rain
  const rain = loop();
  const rainG = ctx.createGain();
  rainG.gain.setValueAtTime(0, t0);
  rainG.gain.linearRampToValueAtTime(RAIN_GAIN, t0 + RAIN_IN_S);
  const rainHp = filter('highpass', 2500);
  const rainLp = filter('lowpass', 8000);
  rain.connect(rainHp);
  rainHp.connect(rainLp);
  rainLp.connect(rainG);
  rainG.connect(out);
  const swell = lfo(0.3, RAIN_GAIN * 0.35, rainG.gain);
  // the wind
  const wind = loop();
  const windG = ctx.createGain();
  windG.gain.setValueAtTime(0, t0);
  windG.gain.linearRampToValueAtTime(WIND_GAIN, t0 + WIND_IN_S);
  const windLp = filter('lowpass', 320);
  wind.connect(windLp);
  windLp.connect(windG);
  windG.connect(out);
  const gust = lfo(0.11, 220, windLp.frequency);
  rain.start();
  wind.start();
  // a burst of noise: in over `attack`, out at `decay`, shaped by the filters
  const burst = (when: number, dur: number, hp: number, lp: number, gain: number, attack: number, decay: number) => {
    const src = ctx.createBufferSource();
    src.buffer = NOISE;
    src.loop = true;
    let node: AudioNode = src;
    if (hp > 0) {
      const f = filter('highpass', hp);
      node.connect(f);
      node = f;
    }
    if (lp < 20000) {
      const f = filter('lowpass', lp);
      node.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    g.gain.setTargetAtTime(0, when + attack, decay);
    node.connect(g);
    g.connect(out);
    src.start(when);
    src.stop(when + dur);
  };
  let stopped = false;
  return {
    thunder(delaySec, near) {
      if (stopped) return;
      const when = ctx.currentTime + delaySec;
      if (near) {
        burst(when, 0.4, 400, 5000, 0.5, 0.004, 0.08);
        burst(when + 0.1, 3.5, 0, 160, 5, 0.04, 0.7);
      }
      if (near) burst(when + 0.5, 5, 0, 80, 4, 0.6, 1.3);
      else {
        // far off: a long low roll that builds slowly, with a soft grumble above it so small speakers carry it
        burst(when, 6, 0, 70, 2, 0.8, 1.6);
        burst(when + 0.1, 4, 0, 220, 0.4, 0.5, 1);
      }
    },
    finale() {
      if (stopped) return;
      const when = ctx.currentTime + 0.05;
      burst(when, 0.4, 400, 5000, 0.3, 0.004, 0.08);
      burst(when + 0.1, 3.5, 0, 160, 2.5, 0.04, 0.9);
      burst(when + 0.5, 8, 0, 90, 2.5, 0.4, 2.4);
    },
    stop(fadeS = 0.05) {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      for (const g of [rainG, windG]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, fadeS / 3);
      }
      window.setTimeout(() => {
        for (const n of [rain, wind, swell, gust]) {
          try {
            n.stop();
          } catch {
            // already stopped
          }
        }
        rainG.disconnect();
        windG.disconnect();
      }, fadeS * 1000 + 400);
    },
  };
}

/** The rain and the water on the letters. */
const RAIN_PER_S = 44;
const RAIN_SPEED = 520;
const WET_MAX = 12;
/** Lightning: the first strike this soon after the storm starts, then every STRIKE_MIN–STRIKE_MAX ms. */
const STRIKE_FIRST_MS = 2500;
const STRIKE_MIN_MS = 4000;
const STRIKE_MAX_MS = 9000;
const FLASH_MS = 220;
/** Far lightning: the first this soon after the storm starts, then every FAR_MIN–FAR_MAX ms,
 * never within FAR_GAP_MS of a near strike; its thunder comes THUNDER_MIN–THUNDER_MAX s later. */
const FAR_FIRST_MS = 4500;
const FAR_MIN_MS = 3000;
const FAR_MAX_MS = 7000;
const FAR_GAP_MS = 1500;
const THUNDER_MIN_S = 0.5;
const THUNDER_MAX_S = 1;

/** A cloud's shades: its lit top edge, its body, the shade in its saddles and above its
 * underside, its underside. */
type Shades = readonly [string, string, string, string];
const STORM: Shades = ['#575770', '#3C3C50', '#343446', '#2C2C3C'];
/** A storm cloud lit all over by a strike. */
const CLOUD_LIT = '#8C8CB4';
const CALM: Shades = ['#F4F4F8', '#DCDCE4', '#C8C8D4', '#B4B4C0'];
/** The door's light (`.prntr-room-light`): its gradient's stops, and its glow. */
const RED: Shades = ['#8A1410', '#5A0A0A', '#420707', '#2A0404'];
const RED_GLOW = 'rgba(138, 20, 16, 0.6)';
const WATER = '#7FC8FF';
const WATER_LIGHT = '#BFE7FF';
const BOLT = '#FFFFFF';
const BOLT_EDGE = '#9FD8FF';
/** Far lightning: a thin dim bolt in a faint glow, behind the clouds. */
const FAR_BOLT = '#6A7A9C';
const FAR_GLOW = 'rgba(150, 170, 220, 0.18)';
const FAR_FLASH = 'rgba(150, 170, 220, 0.1)';

/** A cloud as a union of round puffs on a flat base with rounded ends (`baseH` rows deep):
 * `cols` wide and `rows` high in cells of U. Where two puffs meet the cloud thins to a saddle,
 * unless `core` (a row) fills the strip between the first and last puff from there down. */
function makePuffs(cols: number, rows: number, baseH: number, puffs: { cx: number; cy: number; r: number }[], core = rows): boolean[][] {
  const cells = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  const br = baseH / 2;
  const by = rows - br;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c + 0.5;
      const y = r + 0.5;
      const sx = Math.min(cols - br, Math.max(br, x));
      const inCore = r >= core && x >= Math.min(...puffs.map((p) => p.cx)) && x <= Math.max(...puffs.map((p) => p.cx));
      cells[r][c] = inCore || (x - sx) ** 2 + (y - by) ** 2 <= br * br || puffs.some((p) => (x - p.cx) ** 2 + (y - p.cy) ** 2 <= p.r * p.r);
    }
  }
  return cells;
}

/** A storm cloud (Edgar, 2026-10-20): fat peaks, big then small, with thin saddles between
 * them; `seed` varies the radii and which end starts big. */
function makeBank(cols: number, rows: number, seed: number): boolean[][] {
  const baseH = Math.max(3, Math.round(rows * 0.28));
  const n = Math.max(3, Math.round(cols / (rows * 0.62)));
  const puffs: { cx: number; cy: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = rows * ((i + seed) % 2 === 0 ? 0.38 : 0.24) * (0.9 + hash(i * 13 + seed * 101) * 0.2);
    const cx = Math.min(cols - r - 0.5, Math.max(r + 0.5, ((i + 0.5) / n) * cols));
    puffs.push({ cx, cy: rows - baseH - r * 0.55, r });
  }
  return makePuffs(cols, rows, baseH, puffs);
}

/** The cute cloud (Edgar, 2026-10-20): `cols` wide, three round puffs, the middle one the
 * biggest, on a flat base with rounded ends. */
function makeCute(cols: number): boolean[][] {
  const R = Math.max(2.5, cols * 0.2);
  const baseH = Math.max(3, Math.round(R * 0.5));
  const rows = Math.round(2 * R + baseH);
  return makePuffs(cols, rows, baseH, [
    { cx: cols * 0.5, cy: R + 0.5, r: R },
    { cx: cols * 0.24, cy: rows - baseH / 2 - 0.75 * R, r: 0.75 * R },
    { cx: cols * 0.76, cy: rows - baseH / 2 - 0.65 * R, r: 0.65 * R },
  ], rows - baseH - Math.round(R * 0.4));
}

/** A cheap hash to 0..1. */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function startStorm(root: HTMLElement, h1: HTMLElement, slots: StormSlot[], letterIn: (i: number) => boolean, reduced: boolean, audio: PrntrAudio): Storm {
  const canvas = document.createElement('canvas');
  canvas.className = 'prntr-storm';
  canvas.setAttribute('aria-hidden', 'true');
  const flash = document.createElement('div');
  flash.className = 'prntr-flash';
  flash.setAttribute('aria-hidden', 'true');
  root.append(canvas, flash);
  const g = canvas.getContext('2d');
  if (!g) return { setWeather: () => undefined, finale: () => 0, stop: () => undefined };

  // ---- geometry: the word's mask, the cloud ------------------------------
  let W = 0;
  let H = 0;
  /** The "pixel". */
  let P = 4;
  /** Per screen column: the word's top and bottom edge (−1 = no letter) and which letter. */
  let top = new Int16Array(0);
  let bottom = new Int16Array(0);
  let letter = new Int8Array(0);
  let wordLeft = 0;
  let wordRight = 0;
  let wordTop = 0;
  let wordBottom = 0;
  /** The cloud: its cells (true = cloud) in units of U, half a pixel, and where it sits. */
  let cloud: boolean[][] = [];
  let U = 8;
  let cloudX = 0;
  let cloudY = 0;
  /** Two more clouds for the storm, behind the first and a row lower (Edgar, 2026-10-20). */
  let extras: { cells: boolean[][]; x: number; y: number }[] = [];
  /** The cute cloud of the calm and the red weather, its bottom on the bank's bottom line. */
  let cute: boolean[][] = [];
  let cuteX = 0;
  let cuteY = 0;
  let ready = false;

  const measure = () => {
    W = root.clientWidth;
    H = root.clientHeight;
    canvas.width = W;
    canvas.height = H;
    const style = getComputedStyle(h1);
    const F = parseFloat(style.fontSize) || 100;
    P = Math.max(2, Math.round(F / 24));
    U = Math.max(2, Math.round(P / 2));
    // the mask: each letter drawn as the page draws it (same face, size, place and wobble)
    const m = document.createElement('canvas');
    m.width = W;
    m.height = H;
    const mg = m.getContext('2d');
    if (!mg) return;
    mg.font = `${style.fontWeight} ${F}px ${style.fontFamily}`;
    mg.textBaseline = 'alphabetic';
    mg.fillStyle = '#fff';
    slots.forEach((s) => {
      const r = s.el.getBoundingClientRect();
      const lw = s.el.offsetWidth;
      const lh = s.el.offsetHeight;
      const met = mg.measureText(s.ch);
      const A = met.fontBoundingBoxAscent ?? F * 0.8;
      const D = met.fontBoundingBoxDescent ?? F * 0.2;
      const baseline = (lh - (A + D)) / 2 + A;
      mg.save();
      mg.translate(r.left + r.width / 2, r.top + r.height / 2);
      mg.rotate((s.rot * Math.PI) / 180);
      mg.fillText(s.ch, -lw / 2, -lh / 2 + baseline);
      mg.restore();
    });
    const d = mg.getImageData(0, 0, W, H).data;
    top = new Int16Array(W).fill(-1);
    bottom = new Int16Array(W).fill(-1);
    letter = new Int8Array(W).fill(-1);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        if (d[(y * W + x) * 4 + 3] > 128) {
          if (top[x] < 0) top[x] = y;
          bottom[x] = y;
        }
      }
    }
    const rects = slots.map((s) => s.el.getBoundingClientRect());
    wordLeft = W;
    wordRight = 0;
    wordTop = H;
    wordBottom = 0;
    for (let x = 0; x < W; x++) {
      if (top[x] < 0) continue;
      const i = rects.findIndex((r) => x >= r.left && x < r.right);
      letter[x] = i;
      if (x < wordLeft) wordLeft = x;
      if (x > wordRight) wordRight = x;
      if (top[x] < wordTop) wordTop = top[x];
      if (bottom[x] > wordBottom) wordBottom = bottom[x];
    }
    if (wordRight <= wordLeft) return;
    // the cloud: a slab with a few bumps on top, as wide as most of the word, one word-height above it
    const wordH = wordBottom - wordTop;
    const wordW = wordRight - wordLeft;
    const cols = Math.max(8, Math.round((0.85 * wordW) / U));
    const rows = Math.round((14 * P) / U);
    cloud = makeBank(cols, rows, 0);
    cloudX = Math.round((wordLeft + wordRight) / 2 - (cols * U) / 2);
    cloudY = wordTop - wordH - rows * U;
    // two more for the storm, one each side, behind the first and a pixel-row lower: together they
    // cover the word and a tenth of its width beyond each end. The rain is the first one's.
    const side = Math.max(6, Math.round((0.4 * wordW) / U));
    extras = [
      { cells: makeBank(side, rows - 2, 1), x: Math.round(wordLeft - 0.1 * wordW), y: cloudY + 2 * U },
      { cells: makeBank(side, rows - 2, 2), x: Math.round(wordRight + 0.1 * wordW - side * U), y: cloudY + 2 * U },
    ];
    // about a third of the word wide, but never so tall that its top leaves the viewport
    const bankBottom = cloudY + cloud.length * U;
    const maxRows = Math.max(6, Math.floor((bankBottom - 2 * P) / U));
    cute = makeCute(Math.max(8, Math.min(Math.round((0.35 * wordW) / U), Math.floor((maxRows - 3) / 0.4))));
    cuteX = Math.round((wordLeft + wordRight) / 2 - (cute[0].length * U) / 2);
    cuteY = cloudY + cloud.length * U - cute.length * U;
    ready = true;
  };

  // ---- state --------------------------------------------------------------
  interface Drop {
    x: number;
    y: number;
  }
  interface Splash {
    x: number;
    y: number;
    until: number;
  }
  interface Drip {
    x: number;
    y: number;
    born: number;
  }
  const drops: Drop[] = [];
  const splashes: Splash[] = [];
  const drips: Drip[] = [];
  let wet = new Uint8Array(0);
  let rainDue = 0;
  let weather: Weather = 'calm';
  let nextStrike = Infinity;
  let sound: StormSound | null = null;
  let bolt: { pts: [number, number][]; until: number; again: number } | null = null;
  /** The far lightning: a zigzag behind the clouds, on 0–60 ms, off, on 130–190 ms. */
  let far: { pts: [number, number][]; at: number } | null = null;
  let nextFar = Infinity;
  let lastNear = -Infinity;
  let flashAt = 0;
  let flashBlue = false;
  let last = performance.now();
  let raf = 0;
  let stopped = false;
  let finaled = false;

  const px = (x: number, y: number, color: string, w = P, h = P) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  /** Snap to the pixel grid. */
  const snap = (v: number) => Math.floor(v / P) * P;
  /** A cloud's cells drawn into a buffer in its shades, then put on the canvas: in the red
   * weather with the door's glow around it. */
  const buf = document.createElement('canvas');
  const bg = buf.getContext('2d');
  const paint = (cells: boolean[][], shades: Shades, lit: boolean) => {
    if (!bg) return;
    const rows = cells.length;
    const cols = cells[0].length;
    buf.width = cols * U;
    buf.height = rows * U;
    // each column's top and bottom row, to light the top edges and shade the saddles and the underside
    const tops = new Array<number>(cols).fill(rows);
    const bottoms = new Array<number>(cols).fill(-1);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (!cells[r][c]) continue;
        if (tops[c] === rows) tops[c] = r;
        bottoms[c] = r;
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!cells[r][c]) continue;
        const depth = r - tops[c];
        const above = bottoms[c] - r;
        const valley = tops[c] > (tops[Math.max(0, c - 4)] ?? rows) && tops[c] > (tops[Math.min(cols - 1, c + 4)] ?? rows);
        const tone = depth <= 1 ? 0 : above <= 1 ? 3 : above <= 3 || (valley && depth <= 3) ? 2 : 1;
        bg.fillStyle = lit ? CLOUD_LIT : shades[tone];
        bg.fillRect(c * U, r * U, U, U);
      }
    }
  };
  const drawCloud = (cells: boolean[][], x: number, y: number, shades: Shades, lit: boolean) => {
    paint(cells, shades, lit);
    g.drawImage(buf, x, y);
  };

  // ---- the torn red cloud ------------------------------------------------
  /** A piece of the cloud's picture: a source rectangle, and where and how it is shown now. */
  interface Piece {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
    vx: number;
    vy: number;
    rot: number;
    ghost: boolean;
  }
  let pieces: Piece[] = [];
  let rollAt = 0;
  /** Cut the picture into 6–9 bands of random height and 2–3 blocks cut across them. */
  const tear = () => {
    const w = buf.width;
    const h = buf.height;
    pieces = [];
    const bands = 6 + Math.floor(Math.random() * 4);
    const cuts = [0];
    for (let i = 1; i < bands; i++) cuts.push(Math.round((i / bands) * h + (Math.random() - 0.5) * (h / bands) * 0.8));
    cuts.push(h);
    for (let i = 0; i < bands; i++) {
      if (cuts[i + 1] > cuts[i]) pieces.push({ sx: 0, sy: cuts[i], sw: w, sh: cuts[i + 1] - cuts[i], dx: 0, dy: 0, vx: 0, vy: 0, rot: 0, ghost: false });
    }
    const blocks = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < blocks; i++) {
      const sw = Math.max(U, Math.round(w * (0.25 + Math.random() * 0.15)));
      const sh = Math.max(U, Math.round(h * (0.25 + Math.random() * 0.15)));
      pieces.push({ sx: Math.round(Math.random() * (w - sw)), sy: Math.round(Math.random() * (h - sh)), sw, sh, dx: 0, dy: 0, vx: 0, vy: 0, rot: 0, ghost: false });
    }
  };
  /** Throw every piece along a random angle (diagonals too): mostly a short way, one in four far;
   * a third are tilted, now and then one leaves a ghost. */
  const roll = (now: number) => {
    rollAt = now;
    for (const p of pieces) {
      const a = Math.random() * 2 * Math.PI;
      const len = (Math.random() < 0.25 ? 6 + Math.random() * 8 : Math.random() * 6) * P;
      p.dx = Math.cos(a) * len;
      p.dy = Math.sin(a) * len;
      p.vx = Math.cos(a) * 3 * P;
      p.vy = Math.sin(a) * 3 * P;
      p.rot = Math.random() < 0.33 ? ((Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 12) * Math.PI) / 180 : 0;
      p.ghost = Math.random() < 0.08;
    }
  };
  const drawTorn = (now: number) => {
    paint(cute, RED, false);
    if (!pieces.length) tear();
    // re-rolled every ~60 ms; under reduced motion once
    if (now - rollAt >= 60 && (!reduced || rollAt === 0)) roll(now);
    const t = reduced ? 0 : (now - rollAt) / 1000;
    g.imageSmoothingEnabled = false;
    g.shadowColor = RED_GLOW;
    g.shadowBlur = 6 * P;
    for (const p of pieces) {
      for (const ghost of p.ghost ? [true, false] : [false]) {
        const k = ghost ? -1.2 : 1;
        g.save();
        g.globalAlpha = ghost ? 0.5 : 1;
        g.translate(cuteX + p.sx + p.sw / 2 + (p.dx + p.vx * t) * k, cuteY + p.sy + p.sh / 2 + (p.dy + p.vy * t) * k);
        g.rotate(p.rot * k);
        g.drawImage(buf, p.sx, p.sy, p.sw, p.sh, -p.sw / 2, -p.sh / 2, p.sw, p.sh);
        g.restore();
      }
    }
    g.shadowBlur = 0;
  };

  const strike = (now: number, quiet = false) => {
    // from a random point on the cloud's underside down to the word (or past it)
    const x0 = snap(cloudX + U + Math.random() * (cloud[0].length - 2) * U);
    const pts: [number, number][] = [];
    let x = x0;
    let y = cloudY + cloud.length * U;
    const target = top[Math.min(W - 1, Math.max(0, x0))] >= 0 ? top[x0] : wordBottom;
    while (y < target) {
      pts.push([x, y]);
      y += 2 * P;
      x += snap((Math.random() - 0.5) * 3 * P + P / 2);
    }
    pts.push([x, target]);
    bolt = { pts, until: now + 60, again: now + 130 };
    // the thunder: right behind the flash
    if (!quiet) sound?.thunder(0.15, true);
    lastNear = now;
    if (nextFar < now + FAR_GAP_MS) nextFar = now + FAR_GAP_MS;
    flashAt = now;
    flashBlue = !flashBlue;
    nextStrike = now + STRIKE_MIN_MS + Math.random() * (STRIKE_MAX_MS - STRIKE_MIN_MS);
  };

  /** Lightning far behind the clouds, from under them down to about the word's top line, at a
   * random place along the bank; its top is hidden by the clouds drawn over it, so it comes out
   * of their underside. Its thunder is a half to a whole second later. */
  const farStrike = (now: number) => {
    if (now - lastNear < FAR_GAP_MS) {
      nextFar = lastNear + FAR_GAP_MS;
      return;
    }
    const pts: [number, number][] = [];
    const left = extras[0].x + 3 * U;
    const right = extras[1].x + extras[1].cells[0].length * U - 3 * U;
    let x = snap(left + Math.random() * (right - left));
    for (let y = cloudY + cloud.length * U - 2 * U; y < wordTop - P; y += 2 * U) {
      pts.push([x, y]);
      x += Math.round(((Math.random() - 0.5) * 3 * U) / U) * U;
    }
    far = { pts, at: now };
    sound?.thunder(THUNDER_MIN_S + Math.random() * (THUNDER_MAX_S - THUNDER_MIN_S), false);
    nextFar = now + FAR_MIN_MS + Math.random() * (FAR_MAX_MS - FAR_MIN_MS);
  };

  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (reduced) return;
    // rain, once it storms: so many a second, each a column of the grid over the word
    if (weather === 'storm') rainDue += RAIN_PER_S * dt;
    while (rainDue >= 1) {
      rainDue--;
      drops.push({ x: snap(wordLeft + Math.random() * (wordRight - wordLeft)), y: cloudY + cloud.length * U });
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += RAIN_SPEED * dt;
      const x = Math.min(W - 1, Math.max(0, d.x));
      const t = top[x];
      if (t >= 0 && letterIn(letter[x]) && d.y + 3 * P >= t) {
        // it lands on a letter: a splash, and the letter a little wetter there
        if (wet[x] < WET_MAX) wet[x]++;
        splashes.push({ x: d.x, y: t, until: now + 90 });
        drops.splice(i, 1);
      } else if (d.y > wordBottom + 4 * P) drops.splice(i, 1);
    }
    for (let i = splashes.length - 1; i >= 0; i--) if (now >= splashes[i].until) splashes.splice(i, 1);
    // drips: off the lowest points of a wet letter's underside, now and then
    if (Math.random() < dt * 3) {
      const x = snap(wordLeft + Math.random() * (wordRight - wordLeft));
      const b = bottom[x];
      if (b >= 0 && wet[x] >= 4 && b >= (bottom[Math.max(0, x - 3 * P)] ?? -1) && b >= (bottom[Math.min(W - 1, x + 3 * P)] ?? -1) && !drips.some((d) => Math.abs(d.x - x) < 4 * P)) {
        drips.push({ x, y: b, born: now });
      }
    }
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      const age = now - d.born;
      if (age > 600) d.y += 300 * dt;
      if (age > 600 && d.y > bottom[Math.min(W - 1, Math.max(0, d.x))] + 8 * P) drips.splice(i, 1);
    }
    // lightning, once it storms
    if (weather === 'storm' && now >= nextStrike) strike(now);
    if (weather === 'storm' && now >= nextFar) farStrike(now);
  };

  const draw = (now: number) => {
    g.clearRect(0, 0, W, H);
    if (!ready) return;
    const lit = bolt !== null && (now < bolt.until || (now >= bolt.again && now < bolt.again + 60));
    // the far lightning, behind the clouds
    if (far) {
      const ft = now - far.at;
      if (ft >= 190) far = null;
      else if (ft < 60 || ft >= 130) {
        const [mx, my] = far.pts[Math.floor(far.pts.length / 2)];
        const glow = g.createRadialGradient(mx, my, 0, mx, my, 10 * P);
        glow.addColorStop(0, FAR_GLOW);
        glow.addColorStop(1, 'rgba(150, 170, 220, 0)');
        g.fillStyle = FAR_FLASH;
        g.fillRect(0, 0, W, H);
        g.fillStyle = glow;
        g.fillRect(mx - 10 * P, my - 10 * P, 20 * P, 20 * P);
        g.fillStyle = FAR_BOLT;
        for (const [x, y] of far.pts) g.fillRect(x, y, U, 2 * U);
      }
    }
    // the clouds, in the weather's shades: the cute one while calm or red, in the storm the
    // two more behind, then the first
    if (weather === 'storm') {
      for (const e of extras) drawCloud(e.cells, e.x, e.y, STORM, lit);
      drawCloud(cloud, cloudX, cloudY, STORM, lit);
    } else if (weather === 'red') {
      drawTorn(now);
    } else {
      // it bobs a pixel up and down
      const bob = reduced ? 0 : Math.round(Math.sin((now / 2400) * 2 * Math.PI) * 1.4) * P;
      drawCloud(cute, cuteX, cuteY + bob, CALM, false);
    }
    if (reduced) return;
    // the rain
    for (const d of drops) px(d.x, snap(d.y), WATER, P, 3 * P);
    for (const s of splashes) {
      px(s.x - P, s.y - P, WATER_LIGHT);
      px(s.x + P, s.y - P, WATER_LIGHT);
    }
    // the water on the letters: a film on the wet top edges, deeper where the edge dips
    const tick = Math.floor(now / 120);
    for (let x = snap(wordLeft); x <= wordRight; x += P) {
      const t = top[x];
      if (t < 0 || wet[x] < 2 || !letterIn(letter[x])) continue;
      const color = hash(x + tick * 7) > 0.85 ? WATER_LIGHT : WATER;
      px(x, t - P, color);
      const l = top[Math.max(0, x - 2 * P)];
      const r = top[Math.min(W - 1, x + 2 * P)];
      if (wet[x] >= 6 && l >= 0 && r >= 0 && t >= l && t >= r) px(x, t - 2 * P, color);
    }
    // the drips
    for (const d of drips) {
      const age = now - d.born;
      const h = age < 600 ? P + Math.round(((age / 600) * P) / P) * P : 2 * P;
      px(d.x, snap(d.y), WATER, P, h);
    }
    // the bolt
    if (bolt && lit) {
      for (const [x, y] of bolt.pts) {
        px(x - P, y, BOLT_EDGE, 3 * P, 2 * P);
        px(x, y, BOLT, P, 2 * P);
      }
    }
    if (bolt && now >= bolt.again + 60) bolt = null;
    // the flash
    const ft = now - flashAt;
    if (flashAt && ft < FLASH_MS) {
      flash.style.background = flashBlue ? '#BFE7FF' : '#FFFFFF';
      flash.style.opacity = String(0.8 * (1 - ft / FLASH_MS));
    } else flash.style.opacity = '0';
  };

  const loop = (now: number) => {
    if (stopped) return;
    step(now);
    draw(now);
    raf = requestAnimationFrame(loop);
  };
  const onResize = () => {
    measure();
    wet = new Uint8Array(W);
    drops.length = 0;
    drips.length = 0;
  };
  onResize();
  window.addEventListener('resize', onResize);
  raf = requestAnimationFrame(loop);

  return {
    setWeather(w) {
      if (w === weather) return;
      weather = w;
      pieces = [];
      rollAt = 0;
      if (w === 'storm') {
        nextStrike = performance.now() + STRIKE_FIRST_MS;
        nextFar = performance.now() + FAR_FIRST_MS;
        if (audio.context && audio.master && !sound) sound = startStormSound(audio.context, audio.master);
      }
    },
    finale() {
      if (stopped || finaled) return 0;
      finaled = true;
      nextStrike = Infinity;
      nextFar = Infinity;
      sound?.finale();
      if (reduced || weather !== 'storm') return 0;
      strike(performance.now(), true);
      return 400;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      sound?.stop(finaled ? 1.5 : 0.05);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.remove();
      flash.remove();
    },
  };
}
