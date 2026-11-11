// Duotone recoloring, from design_handoff_printanything-new/recolor-reference.js,
// with the §4 darkness fix: sRGB-space mixing, a shadow clamp, and a contrast
// curve (constants below). Per-pixel luminance drives a white→ink ramp;
// near-white clamps to pure paper white so scanned documents don't print a
// faint tint wash, near-black clamps to full ink so photo shadows don't wash out.

const WHITE_CLAMP = 0.94;
// Shadows at or below this luminance saturate to full ink. Photo blacks rarely
// reach luma 0; without this they'd land mid-ramp and print as a pale tint.
const BLACK_CLAMP = 0.1;
// Contrast curve on ink strength (design handoff round 2, §4 candidate a).
// Together with the clamps this makes output luma track SOURCE luma nearly 1:1
// through the midtones — "same darkness, different hue" — instead of
// proportionally compressing everything into the lighter [ink luma, white] range.
const CONTRAST = 0.75;

/** One-time pass per page: 8-bit relative luminance for every pixel. */
export function luminanceMap(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const lum = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]);
  }
  return lum;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Plain sRGB lerp — luma is linear in sRGB channels, so output darkness is a
// direct function of t. A gamma-2.2 linear-space mix here rendered midtones
// (and anti-aliased text) far too light (design handoff round 2, §4).
function mix(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t);
}

/** How much ink a luminance (0–1) gets: none from WHITE_CLAMP up, all of it from BLACK_CLAMP down, the contrast curve between. */
function strength(lum: number): number {
  if (lum >= WHITE_CLAMP) return 0;
  if (lum <= BLACK_CLAMP) return 1;
  return Math.pow((WHITE_CLAMP - lum) / (WHITE_CLAMP - BLACK_CLAMP), CONTRAST);
}

/** A colour of a ramp and the ink strength (0–1) it sits at; a ramp runs from strength 0 to 1. */
type Stop = readonly [at: number, hex: string];

const lutCache = new Map<string, Uint8Array>();

/** 256-entry luminance→RGB lookup table for a ramp: each luminance's strength, placed between the two stops around it. */
function rampLut(stops: readonly Stop[]): Uint8Array {
  const key = stops.map(([at, hex]) => `${at}${hex}`).join();
  const cached = lutCache.get(key);
  if (cached) return cached;
  const colours = stops.map(([, hex]) => hexToRgb(hex));
  const lut = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = strength(v / 255);
    let seg = 0;
    while (seg < stops.length - 2 && t > stops[seg + 1][0]) seg++;
    const k = (t - stops[seg][0]) / (stops[seg + 1][0] - stops[seg][0]);
    lut[v * 3] = mix(colours[seg].r, colours[seg + 1].r, k);
    lut[v * 3 + 1] = mix(colours[seg].g, colours[seg + 1].g, k);
    lut[v * 3 + 2] = mix(colours[seg].b, colours[seg + 1].b, k);
  }
  lutCache.set(key, lut);
  return lut;
}

/** One ink: paper white to the ink. */
function inkLut(inkHex: string): Uint8Array {
  return rampLut([[0, '#ffffff'], [1, inkHex]]);
}

/**
 * Gold (src/lib/inks.ts GOLD_INK) is not one colour: its ramp runs paper → pale gold → gold →
 * deep gold, and a sheen sweeps across the page, so the ink shifts between the two ramps below
 * along diagonal bands SHEEN_PERIOD px wide. Unrealistic on purpose.
 */
const GOLD_HEX = '#c9a227';
const GOLD_RAMPS: [string, string, string][] = [
  ['#fff1b3', '#e2b53a', '#7a5a10'],
  ['#fff8d6', '#f7d262', '#a8821c'],
];
const SHEEN_PERIOD = 420;

/** A gold ramp: paper at strength 0, pale at 0.35, gold at 0.7, deep at 1. */
function goldLut([pale, gold, deep]: [string, string, string]): Uint8Array {
  return rampLut([[0, '#ffffff'], [0.35, pale], [0.7, gold], [1, deep]]);
}

const lut32Cache = new Map<string, Uint32Array>();
// ImageData bytes are R, G, B, A in memory; a Uint32 view reads them in the
// platform's byte order (little-endian on every browser that ships today).
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** inkLut packed as one RGBA word per luminance, for writing a pixel in one store. */
function inkLut32(inkHex: string): Uint32Array {
  const cached = lut32Cache.get(inkHex);
  if (cached) return cached;
  const lut = inkLut(inkHex);
  const packed = new Uint32Array(256);
  for (let v = 0; v < 256; v++) {
    const [r, g, b] = [lut[v * 3], lut[v * 3 + 1], lut[v * 3 + 2]];
    packed[v] = LITTLE_ENDIAN ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  }
  lut32Cache.set(inkHex, packed);
  return packed;
}

/**
 * Recolor a page from its cached luminance map. Reuses `target` when given so
 * the mounted preview canvas updates in place on swatch changes.
 */
export function recolorToCanvas(
  lum: Uint8Array,
  width: number,
  height: number,
  inkHex: string,
  target?: HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = target ?? document.createElement('canvas');
  // Assigning a size, even the same one, reallocates and clears the canvas.
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const img = ctx.createImageData(width, height);
  const d = img.data;
  if (inkHex === GOLD_HEX) {
    // the sheen: a blend of the two gold ramps that sweeps diagonally across the page
    const a = goldLut(GOLD_RAMPS[0]);
    const b = goldLut(GOLD_RAMPS[1]);
    const period = Math.max(60, Math.round((SHEEN_PERIOD * width) / 1224));
    for (let y = 0, p = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, p++, i += 4) {
        const w = 0.5 + 0.5 * Math.sin(((x + y) / period) * 2 * Math.PI);
        const v = lum[p] * 3;
        d[i] = Math.round(a[v] + (b[v] - a[v]) * w);
        d[i + 1] = Math.round(a[v + 1] + (b[v + 1] - a[v + 1]) * w);
        d[i + 2] = Math.round(a[v + 2] + (b[v + 2] - a[v + 2]) * w);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
  const lut = inkLut32(inkHex);
  const out = new Uint32Array(d.buffer, d.byteOffset, lum.length);
  for (let p = 0; p < lum.length; p++) out[p] = lut[lum[p]];
  ctx.putImageData(img, 0, 0);
  return canvas;
}
