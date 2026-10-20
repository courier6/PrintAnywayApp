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
 * one; the dark bank of three is the storm's alone (Edgar, 2026-10-20).
 * The storm sounds like one, in the room's style: rain, a gusting wind, thunder after each
 * strike (Edgar, 2026-10-20).
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
  stop(): void;
}

/** The storm's sound: the rain and wind loop from the storm's start; thunder on request. */
export interface StormSound {
  /** Thunder `delaySec` after now: a crack and a clap when near, only the roll when far. */
  thunder(delaySec: number, near: boolean): void;
  stop(): void;
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
      burst(when + (near ? 0.5 : 0), 5, 0, 80, near ? 4 : 2.5, 0.6, 1.3);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      for (const g of [rainG, windG]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.05);
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
      }, 400);
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

/** A cloud's shades: its top edge, its body, its underside. */
type Shades = readonly [string, string, string];
const STORM: Shades = ['#575770', '#3C3C50', '#2C2C3C'];
/** A storm cloud lit all over by a strike. */
const CLOUD_LIT = '#8C8CB4';
const CALM: Shades = ['#F4F4F8', '#DCDCE4', '#B4B4C0'];
/** The door's light (`.prntr-room-light`): its gradient's stops, and its glow. */
const RED: Shades = ['#8A1410', '#5A0A0A', '#2A0404'];
const RED_GLOW = 'rgba(138, 20, 16, 0.6)';
const WATER = '#7FC8FF';
const WATER_LIGHT = '#BFE7FF';
const BOLT = '#FFFFFF';
const BOLT_EDGE = '#9FD8FF';

/** A cloud's cells (true = cloud): a slab four rows deep with bumps on top, `rows` high and
 * `cols` wide in units of U; `seed` varies the bumps. */
function makeCloud(cols: number, rows: number, seed: number): boolean[][] {
  const cells = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  const slab = rows - 4;
  for (let r = slab; r < rows; r++) for (let c = 0; c < cols; c++) cells[r][c] = r < rows - 1 || (c > 0 && c < cols - 1);
  const bumps = Math.max(3, Math.round(cols / 5));
  for (let b = 0; b < bumps; b++) {
    const cx = ((b + 0.5) / bumps) * cols + (hash(b * 13 + seed * 101) - 0.5) * 2;
    const rad = 2 + Math.round(hash(b * 29 + seed * 101) * 1.5);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = c + 0.5 - cx;
        const dy = r + 0.5 - (slab + 0.5);
        if (dx * dx + dy * dy <= rad * rad) cells[r][c] = true;
      }
    }
  }
  return cells;
}

/** The cute cloud (Edgar, 2026-10-20): `cols` wide, three round puffs, the middle one the
 * biggest, on a flat base with rounded ends. */
function makeCute(cols: number): boolean[][] {
  const R = Math.max(2.5, cols * 0.2);
  const rows = Math.round(2 * R + 3);
  const cells = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  const puffs = [
    { cx: cols * 0.5, cy: R + 0.5, r: R },
    { cx: cols * 0.24, cy: rows - 1.5 - 0.75 * R, r: 0.75 * R },
    { cx: cols * 0.76, cy: rows - 1.5 - 0.65 * R, r: 0.65 * R },
  ];
  const baseY = rows - 1.5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c + 0.5;
      const y = r + 0.5;
      const sx = Math.min(cols - 1.5, Math.max(1.5, x));
      const inBase = (x - sx) ** 2 + (y - baseY) ** 2 <= 2.25;
      cells[r][c] = inBase || puffs.some((p) => (x - p.cx) ** 2 + (y - p.cy) ** 2 <= p.r * p.r);
    }
  }
  return cells;
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
  if (!g) return { setWeather: () => undefined, stop: () => undefined };

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
  /** The cloud: its cells (true = cloud) in units of U = 2P, and where it sits. */
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
    U = 2 * P;
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
    const rows = 7;
    cloud = makeCloud(cols, rows, 0);
    cloudX = Math.round((wordLeft + wordRight) / 2 - (cols * U) / 2);
    cloudY = wordTop - wordH - rows * U;
    // two more for the storm, one each side, behind the first and a row lower: together they
    // cover the word and a tenth of its width beyond each end. The rain is the first one's.
    const side = Math.max(6, Math.round((0.4 * wordW) / U));
    extras = [
      { cells: makeCloud(side, rows - 1, 1), x: Math.round(wordLeft - 0.1 * wordW), y: cloudY + U },
      { cells: makeCloud(side, rows - 1, 2), x: Math.round(wordRight + 0.1 * wordW - side * U), y: cloudY + U },
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
  /** The first strike is near; after that, half of them. */
  let strikes = 0;
  let bolt: { pts: [number, number][]; until: number; again: number } | null = null;
  let flashAt = 0;
  let flashBlue = false;
  let last = performance.now();
  let raf = 0;
  let stopped = false;

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
  const drawCloud = (cells: boolean[][], x: number, y: number, shades: Shades, lit: boolean) => {
    if (!bg) return;
    const rows = cells.length;
    const cols = cells[0].length;
    buf.width = cols * U;
    buf.height = rows * U;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!cells[r][c]) continue;
        const topmost = r === 0 || !cells[r - 1][c];
        bg.fillStyle = lit ? CLOUD_LIT : shades[r >= rows - 2 ? 2 : topmost ? 0 : 1];
        bg.fillRect(c * U, r * U, U, U);
      }
    }
    if (weather === 'red') {
      g.shadowColor = RED_GLOW;
      g.shadowBlur = 6 * P;
    }
    g.drawImage(buf, x, y);
    g.shadowBlur = 0;
  };

  const strike = (now: number) => {
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
    // the thunder: right on a near strike, a second or so after a far one
    const near = strikes++ === 0 || Math.random() < 0.5;
    sound?.thunder(near ? 0.15 : 0.6 + Math.random() * 0.8, near);
    flashAt = now;
    flashBlue = !flashBlue;
    nextStrike = now + STRIKE_MIN_MS + Math.random() * (STRIKE_MAX_MS - STRIKE_MIN_MS);
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
  };

  const draw = (now: number) => {
    g.clearRect(0, 0, W, H);
    if (!ready) return;
    const lit = bolt !== null && (now < bolt.until || (now >= bolt.again && now < bolt.again + 60));
    // the clouds, in the weather's shades: the cute one while calm or red, in the storm the
    // two more behind, then the first
    if (weather === 'storm') {
      for (const e of extras) drawCloud(e.cells, e.x, e.y, STORM, lit);
      drawCloud(cloud, cloudX, cloudY, STORM, lit);
    } else {
      // it bobs a pixel up and down
      const bob = reduced ? 0 : Math.round(Math.sin((now / 2400) * 2 * Math.PI) * 1.4) * P;
      drawCloud(cute, cuteX, cuteY + bob, weather === 'red' ? RED : CALM, false);
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
      if (w === 'storm') {
        nextStrike = performance.now() + STRIKE_FIRST_MS;
        if (audio.context && audio.master && !sound) sound = startStormSound(audio.context, audio.master);
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      sound?.stop();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.remove();
      flash.remove();
    },
  };
}
