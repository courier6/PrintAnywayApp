/**
 * The vortex (PRNTR-VORTEX.md). On the certificate of completion, "Press and hold to see the
 * original" opens a pixel galaxy in the middle of the page: held long enough it swallows the
 * certificate and leaves the original document; let go early it thins back out and a puff of dark
 * smoke drifts up. Design sheet prntr/design/sheets/vortex/round2.html, card #12 "Storm eye over
 * the place", puff a: every number here is that card's (its option object is `O` below).
 *
 * The galaxy is drawn on 2 css px cells (190 × 246 over the 380 px page) into one ImageData and
 * quantised with the room's 4×4 Bayer dither, in the certificate's gold with the storm's door-light
 * reds as veins; no arms, a slow drifting cloud bank. Gravitational lensing: a thin photon ring on
 * the horizon, beamed to one side, and the cloud and the certificate's own pixels bent inwards
 * around the eye. The eye is a window onto the opening's storm (storm.ts's shades) on its own
 * 32-cell grid: the night sky, the cloud bank with its lit top edge, rain, bolts from the bank's
 * underside with the intro's double flicker and a flash that lights the whole bank, far lightning
 * between, and the intro's place as a silhouette the flash shows. The certificate stays crisp and
 * still (a 3 % pull) until the suck beat at 60 % of the swirl, then shrinks, spins and goes to 4 px
 * pixels as it is pulled in; from 86 % everything collapses into the point.
 *
 * Part of the Prntr chunk (PrntrHost.loadVortex: after a win the chunk is in already); the app's
 * VortexCanvas drives it frame by frame.
 */
import { GOLD_INK } from '../lib/inks';
import { PAL } from './stages/room/palette';
import { CLOUD_LIT, RED as DOOR_RED, STORM } from './stages/storm';

export interface VortexPainter {
  /**
   * Paints one frame: the certificate (unless `cert` is false: the page's own layer shows it again)
   * and the galaxy at `p`, 0..1 through the swirl (0: nothing), then the puff at `puff`, 0..1 from
   * the release (null: none).
   */
  frame(p: number, puff: number | null, cert: boolean): void;
}

type RGB = readonly [number, number, number];
const rgbOf = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

// ---- the grid: 4 css px to a base cell over the 380 × 492 page; the galaxy at K pixels per cell ----
const CELL = 4;
const GW = 95;
const GH = 123;
const CX = GW / 2;
const CY = GH / 2;
const PW = GW * CELL;
const PH = GH * CELL;
const K = 2;
const IW = GW * K;
const IH = GH * K;
/** The suck beat: from here the eye widens and the certificate is pulled in. */
const SUCK_AT = 0.6;

/** Card #12's option object, the sheet's `o` (no arms, so no arm terms). Radii in base cells. */
const O = {
  R: 38, core: 10, coreSoft: 9, twist: 3.4, twistPow: 1.1, spin: 1.3, freq: 0.07, drift: 2.4, fall: 0.7,
  lo: 0.36, hi: 0.6, cover: 1.4, haze: 0.45, ditherBite: 1, gain: 1.4, coreGlow: 0.5, red: 0.3,
  stars: 55, starSpeed: 1.1, seed: 21, rot: 170, pix: 4, bend: 0.55, wrap: 0.35, ring: 1.4,
};

// ---- the palette: the room's keys (palette.ts), the storm's shades (storm.ts), the gold ink ----
/** The void: black up to the cloud bank's blue. */
const VOID: RGB[] = [PAL.z, PAL.J, PAL.N, PAL.M].map(rgbOf);
/** The deep red veins: the door light's shades, deep to lit, then the room's red. */
const RED: RGB[] = [...DOOR_RED].reverse().concat(PAL.R).map(rgbOf);
/** The cloud: dark bronze up to the gold swatch's shine (inks.ts GOLD_INK.swatch). */
const GOLD: RGB[] = ['#1C1406', '#4A3608', '#8A6A14', GOLD_INK.hex, '#F3C64A'].map(rgbOf);
/** The flecks riding the cloud inwards. */
const FLECK_WARM = rgbOf(PAL.s);
const FLECK_GOLD = GOLD[3];
const FLECK_RED = RED[4];
/** The storm in the eye. */
const SKY = rgbOf(PAL.N);
const BANK: RGB[] = STORM.map(rgbOf);
const BANK_LIT = rgbOf(CLOUD_LIT);
const BANK_FAR = rgbOf(PAL.U);
const BOLT = rgbOf(PAL.W);
const BOLT_EDGE = rgbOf(PAL.j);
const FAR_BOLT = rgbOf(PAL.u);
const WATER = rgbOf(PAL.h);
const SIL_BUILDING = SKY;
const SIL_WINDOW = rgbOf(PAL.M);
const SIL_TREE = rgbOf(PAL.J);
/** The lot under the flash: the opening draws it as 55 % black over the flash; the sheet's flat shade. */
const SIL_LOT = rgbOf('#06070C');

// ---- maths ----
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number, a: number, b: number) => {
  const t = seg(x, a, b);
  return t * t * (3 - 2 * t);
};
const easeIn = (x: number) => x * x * x;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
/** The room's ordered dither (art.ts). */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const thr = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;
/** A cheap hash to 0..1 (storm.ts's). */
function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (i: number, j: number) => hash01((i * 73856093) ^ (j * 19349663) ^ seed);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), sx), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), sx), sy);
}
function fbm(x: number, y: number, seed: number, oct: number): number {
  let a = 0.5;
  let s = 0;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x, y, seed + i * 101);
    n += a;
    x = x * 2.1 + 3.7;
    y = y * 2.1 - 1.3;
    a *= 0.5;
  }
  return s / n;
}
/** Lensing: a point at radius r (base cells) shows what lies at bendR(r); diverges towards the horizon (at most 2k·core there). */
const bendR = (r: number, core: number, k: number) => r + (k * core * core) / Math.max(r - core * 0.6, core * 0.5);
/** The galaxy's radius and its eye's at p, and the suck. */
function shape(p: number): { R: number; core: number; u: number } {
  const grow = easeOut(clamp(p / 0.45));
  const collapse = easeIn(seg(p, 0.86, 1));
  const u = seg(p, SUCK_AT, 1);
  return { R: O.R * grow * (1 - collapse), core: Math.max(0, O.core * grow * (1 + 2.4 * easeIn(u)) * (1 - collapse)), u };
}

// ---- the storm in the eye: scene cells, 32 across the eye, origin at its centre ----
const STRIKE_EVERY = 420;
const STRIKE_FIRST = 120;
const FLASH_MS = 220;
const BANK_PUFFS = [
  { cx: -9, cy: -12, r: 5.5 },
  { cx: -1, cy: -13, r: 7 },
  { cx: 8, cy: -12, r: 5 },
];
const inBank = (sx: number, sy: number) =>
  sy <= -7 && sy >= -17 && Math.abs(sx) <= 15 && (sy >= -9 || BANK_PUFFS.some((q) => (sx + 0.5 - q.cx) ** 2 + (sy + 0.5 - q.cy) ** 2 <= q.r * q.r));
const bankTop = (sx: number) => {
  for (let y = -17; y <= -7; y++) if (inBank(sx, y)) return y;
  return 99;
};
/** Each strike's bolt: its column per scene row, from the bank's underside (-6) down to 14. */
const bolts = new Map<number, Record<number, number>>();
function boltOf(n: number): Record<number, number> {
  let xs = bolts.get(n);
  if (xs) return xs;
  xs = {};
  let x = -8 + Math.floor(hash01(n * 13 + 1) * 16);
  for (let y = -6, j = 0; y <= 14; y++, j++) {
    xs[y] = x;
    if (j % 2 === 1) {
      const h = hash01(n * 101 + j);
      x += h < 0.33 ? -1 : h > 0.66 ? 1 : 0;
    }
  }
  bolts.set(n, xs);
  return xs;
}
/** The trees along the horizon: column and height. */
const TREES: [number, number][] = [[-14, 5], [-11, 4], [-8, 3], [10, 3], [13, 5], [15, 4]];
/** What scene cell (sx, sy) shows t ms into the swirl; null outside the storm's disc. (px, py) is the galaxy pixel, for the dither. */
function stormCell(sx: number, sy: number, t: number, px: number, py: number): RGB | null {
  if (sx * sx + sy * sy > 16.5 * 16.5) return null;
  const n = Math.floor((t - STRIKE_FIRST) / STRIKE_EVERY);
  const tn = t - (STRIKE_FIRST + n * STRIKE_EVERY + hash01(n * 7) * 90);
  const near = n >= 0 && tn >= 0;
  const lit = near && (tn < 60 || (tn >= 130 && tn < 190));
  const flashI = near && tn < FLASH_MS ? 0.8 * (1 - tn / FLASH_MS) : 0;
  const blue = n % 2 === 1;
  const tf = t - (STRIKE_FIRST + n * STRIKE_EVERY + 230);
  const farLit = n >= 0 && tf >= 0 && tf < 110;
  const flashOn = flashI > thr(px, py);
  let rgb: RGB = flashOn ? (blue ? BOLT_EDGE : BOLT) : SKY;
  // the intro's place, a silhouette the flash shows: the office block with its floors of windows and
  // its rooftop units, the sign on its pole, the trees along the horizon, the lot
  if (sy >= 6 && sy <= 13 && Math.abs(sx) <= 6) rgb = flashOn && (sx + 6) % 3 === 1 && (sy - 6) % 2 === 1 ? SIL_WINDOW : SIL_BUILDING;
  else if (sy === 5 && (sx === -3 || sx === -2 || sx === 2)) rgb = SIL_BUILDING;
  else if ((sx === 8 && sy >= 8 && sy <= 13) || (sy === 7 && sx >= 7 && sx <= 9)) rgb = SIL_BUILDING;
  else if (sy > 13) rgb = flashOn ? (blue ? BANK_FAR : BANK[1]) : SIL_LOT;
  else for (const [tx, th] of TREES) if (sy > 13 - th && Math.abs(sx - tx) <= (sy - (13 - th)) * 0.6) rgb = SIL_TREE;
  if (inBank(sx, sy)) {
    // the bank: its lit top edge, its body, its underside
    if (lit) return BANK_LIT;
    const depth = sy - bankTop(sx);
    const under = !inBank(sx, sy + 1);
    return farLit && under ? BANK_FAR : BANK[depth <= 0 ? 0 : under ? 3 : !inBank(sx, sy + 2) ? 2 : 1];
  }
  if (sy > -7) {
    const bx = boltOf(Math.max(0, n))[sy];
    if (lit && bx !== undefined) {
      if (sx === bx) return BOLT;
      if (Math.abs(sx - bx) === 1) return BOLT_EDGE;
    }
    if (farLit && sy < 2) {
      const fx = -10 + Math.floor(hash01(n * 17 + 3) * 20) + Math.floor(Math.sin(sy * 1.7 + n) * 1.2);
      if (sx === fx) return FAR_BOLT;
    }
    // the rain: columns, each drop a cell falling straight down
    if (!flashOn && sy < 14) {
      const col = hash01(sx * 919 + 1);
      if (col < 0.35) {
        const ph = (t * 0.022 + col * 40) % 9;
        if (Math.floor(ph) === (sy + 7) % 9) return WATER;
      }
    }
  }
  return rgb;
}

// ---- the galaxy ----
function put(img: ImageData, x: number, y: number, rgb: RGB): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = rgb[0];
  img.data[i + 1] = rgb[1];
  img.data[i + 2] = rgb[2];
  img.data[i + 3] = 255;
}
/** A ramp's shade for v (0..1), dithered. */
function pick(ramp: RGB[], v: number, x: number, y: number): RGB {
  const k = v * (ramp.length - 1) + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.9;
  return ramp[clamp(Math.round(k), 0, ramp.length - 1)];
}

/** The galaxy at p into `img` (IW × IH, cleared); t is the storm's clock, ms into the swirl. */
function galaxy(img: ImageData, p: number, t: number): void {
  const { R, core, u } = shape(p);
  const reveal = clamp(p * 3);
  if (R < 1) return;
  const warp = O.twist * (1 + 1.6 * u);
  for (let y = 0; y < IH; y++) {
    for (let x = 0; x < IW; x++) {
      const dx = (x + 0.5) / K - CX;
      const dy = (y + 0.5) / K - CY;
      const r = Math.hypot(dx, dy);
      if (r > R) continue;
      const rn = r / R;
      const th = Math.atan2(dy, dx);
      if (r < core) {
        // the eye: the storm, with a dark rim
        const S = 16 / core;
        const c = stormCell(Math.floor(dx * S), Math.floor(dy * S), t, x, y);
        put(img, x, y, Math.pow(r / core, 6) * 0.9 > thr(x, y) || !c ? VOID[0] : c);
        continue;
      }
      if (r < core + O.ring) {
        // the photon ring: thin, bright, beamed to one side
        const q = (1 - (r - core) / O.ring) * (0.5 + 0.5 * Math.cos(th - 0.9 + p * O.spin * 0.3));
        put(img, x, y, q > thr(x, y) * 0.8 ? FLECK_WARM : q > thr(x, y) * 0.3 ? GOLD[4] : GOLD[3]);
        continue;
      }
      const rb = bendR(r, core, O.bend); // the cloud bends around the eye too
      const a = th + warp * Math.pow(1 - clamp(rb / R), O.twistPow) + p * O.spin + (O.wrap * core) / Math.max(r - core * 0.5, 0.5);
      const nx = Math.cos(a) * rb * O.freq;
      const ny = Math.sin(a) * rb * O.freq;
      const n = fbm(nx + p * O.drift, ny - p * O.drift * 0.4, O.seed, 3);
      const d = smooth(n, O.lo, O.hi); // cloud masses, with dithered fringes
      const fall = Math.pow(1 - rn, O.fall);
      const dens = d * fall;
      const edge = seg(r, core, core + O.coreSoft); // thins into the eye
      const cover = clamp((dens * O.cover + O.haze * fall * fall) * reveal * (0.35 + 0.65 * edge) + (1 - edge) * 0.9 * reveal);
      if (cover < thr(x, y) * O.ditherBite) continue;
      const heat = clamp((n - 0.2) * O.gain + O.coreGlow * Math.pow(1 - rn, 3) * (1 - edge * 0.6) + u * 0.25 * (1 - rn));
      const hue = fbm(nx * 0.45 + 17, ny * 0.45 - 9, O.seed + 999, 2);
      if (!edge) put(img, x, y, VOID[1]);
      else put(img, x, y, pick(hue < O.red ? RED : GOLD, heat, x, y));
    }
  }
  // flecks: faint stars riding the cloud inwards, one base cell each
  for (let i = 0; i < O.stars; i++) {
    const s1 = hash01(i * 31 + 7);
    const s2 = hash01(i * 17 + 3);
    const s3 = hash01(i * 53 + 11);
    const life = (p * O.starSpeed * (0.6 + s3) + s1) % 1;
    const rr = R * (1 - life) * (0.3 + 0.7 * s2);
    if (rr < core + 1 || rr > R * 0.95) continue;
    const ang = s1 * 40 + life * warp * 1.4 + p * O.spin;
    const x = Math.floor((CX + Math.cos(ang) * rr) * K);
    const y = Math.floor((CY + Math.sin(ang) * rr) * K);
    if (Math.sin(life * Math.PI) * reveal < thr(x, y) * 1.1) continue;
    const rgb = s3 > 0.8 ? FLECK_GOLD : s3 > 0.4 ? FLECK_WARM : FLECK_RED;
    for (let j = 0; j < K; j++) for (let q = 0; q < K; q++) put(img, x + q, y + j, rgb);
  }
}

// ---- puff a: dark smoke blobs, each on its own delay, drifting up and apart ----
/** A blob of smoke: a dithered disc whose cover comes from the noise, in a ramp. (cx, cy, r) in base cells. */
function blob(img: ImageData, cx: number, cy: number, r: number, alpha: number, seed: number, ramp: RGB[]): void {
  for (let y = Math.floor((cy - r) * K); y <= (cy + r) * K; y++) {
    for (let x = Math.floor((cx - r) * K); x <= (cx + r) * K; x++) {
      const bx = (x + 0.5) / K;
      const by = (y + 0.5) / K;
      const d = Math.hypot(bx - cx, by - cy) / r;
      if (d > 1) continue;
      const n = fbm(bx * 0.18 + seed, by * 0.18 - seed, seed, 2);
      const cover = (1 - d * d) * alpha * (0.3 + 1.1 * smooth(n, 0.3, 0.6));
      if (cover < thr(x, y)) continue;
      put(img, x, y, pick(ramp, clamp(n * 1.1 - d * 0.4), x, y));
    }
  }
}
/** The blobs: offset from the centre, radius, delay (as a share of the puff). */
const PUFF_PARTS: [number, number, number, number][] = [
  [-6, 2, 8, 0],
  [5, 0, 9, 0.08],
  [-1, -5, 7, 0.16],
  [7, -6, 5, 0.26],
  [-8, -3, 5, 0.3],
];
function puff(img: ImageData, t: number): void {
  PUFF_PARTS.forEach(([x, y, r, d], i) => {
    const u = clamp((t - d) / (1 - d));
    if (u <= 0) return;
    blob(img, CX + x + 7 * u + Math.sin(u * 5 + i) * 1.5, CY + y - 30 * easeOut(u), r * (0.5 + 0.9 * easeOut(u)), (1 - easeIn(u)) * 0.95, 11 + i * 7, i % 3 === 0 ? RED : GOLD);
  });
}

/**
 * A painter for `certificate` (the page as shown, recoloured) onto `canvas`, which it sizes to the
 * 380 × 492 page at the device's pixel ratio (capped at 2: the certificate stays as crisp as the
 * page's own layer until it pixelates); CSS scales it with the page stack. `swirlMs` is the
 * swirl's length, the storm's clock.
 */
export function createVortex(certificate: HTMLCanvasElement, canvas: HTMLCanvasElement, swirlMs: number): VortexPainter {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(PW * dpr);
  canvas.height = Math.round(PH * dpr);
  const out = canvas.getContext('2d');
  const gal = document.createElement('canvas');
  gal.width = IW;
  gal.height = IH;
  const galG = gal.getContext('2d');
  const scratch = document.createElement('canvas');
  const scratchG = scratch.getContext('2d', { willReadFrequently: true });
  // no 2D context: the hold still restores on its timer, with nothing drawn
  if (!out || !galG || !scratchG) return { frame() {} };
  out.imageSmoothingEnabled = false;

  /** The certificate while it is being pulled in: spun, shrunk, lensed, and drawn at ever coarser pixels. */
  const drawCert = (p: number) => {
    const u = easeIn(seg(p, SUCK_AT - 0.05, 1));
    const f = 1 + (O.pix - 1) * seg(u, 0.05, 0.8); // css px per drawn px: 1 → 4, only once it is being pulled
    const w = Math.max(2, Math.round((PW * dpr) / f));
    const h = Math.max(2, Math.round((PH * dpr) / f));
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w;
      scratch.height = h;
    }
    const g = scratchG;
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    const pull = seg(p, 0, SUCK_AT); // a slight draw inwards while the galaxy gathers
    const sc = (1 - 0.035 * pull) * (1 - u); // it shrinks first, then spins down fast
    const rot = ((-3 * pull + Math.pow(seg(u, 0.12, 1), 1.3) * O.rot * 3) * Math.PI) / 180;
    if (sc <= 0.002) return;
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(rot);
    g.scale(sc, sc);
    g.drawImage(certificate, -w / 2, -h / 2, w, h);
    g.restore();
    // lens the page: inside the galaxy's radius every pixel shows what lies further out along its ray
    const { R, core } = shape(p);
    if (R >= 2) {
      const cw = GW / w; // base cells per scratch px
      const x0 = Math.max(0, Math.floor((CX - R) / cw));
      const x1 = Math.min(w, Math.ceil((CX + R) / cw));
      const y0 = Math.max(0, Math.floor((CY - R) / cw));
      const y1 = Math.min(h, Math.ceil((CY + R) / cw));
      const src = g.getImageData(0, 0, w, h);
      const lensed = g.createImageData(w, h);
      lensed.data.set(src.data);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const dx = (x + 0.5) * cw - CX;
          const dy = (y + 0.5) * cw - CY;
          const r = Math.hypot(dx, dy);
          if (r >= R || r < core * 0.5) continue;
          const f2 = (r + (bendR(r, core, O.bend) - r) * Math.pow(1 - r / R, 1.5)) / r;
          const sx = Math.floor((CX + dx * f2) / cw);
          const sy = Math.floor((CY + dy * f2) / cw);
          const di = (y * w + x) * 4;
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) {
            lensed.data[di + 3] = 0;
            continue;
          }
          const si = (sy * w + sx) * 4;
          lensed.data[di] = src.data[si];
          lensed.data[di + 1] = src.data[si + 1];
          lensed.data[di + 2] = src.data[si + 2];
          lensed.data[di + 3] = src.data[si + 3];
        }
      }
      g.putImageData(lensed, 0, 0);
    }
    out.drawImage(scratch, 0, 0, canvas.width, canvas.height);
  };

  return {
    frame(p, puffT, cert) {
      out.clearRect(0, 0, canvas.width, canvas.height);
      if (cert) drawCert(p);
      const img = galG.createImageData(IW, IH);
      galaxy(img, p, p * swirlMs);
      if (puffT !== null) puff(img, puffT);
      galG.putImageData(img, 0, 0);
      out.drawImage(gal, 0, 0, canvas.width, canvas.height);
    },
  };
}
