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

const lutCache = new Map<string, Uint8Array>();

/**
 * Gold (src/lib/inks.ts GOLD_INK) is not one colour: its ramp runs paper → pale gold → gold →
 * deep gold, and a sheen sweeps across the page, so the ink shifts between the two ramps below
 * along diagonal bands SHEEN_PERIOD px wide. Unrealistic on purpose (Edgar, 2026-10-20).
 */
const GOLD_HEX = '#c9a227';
const GOLD_RAMPS: [string, string, string][] = [
  ['#fff1b3', '#e2b53a', '#7a5a10'],
  ['#fff8d6', '#f7d262', '#a8821c'],
];
const SHEEN_PERIOD = 420;

function goldLut(ramp: [string, string, string]): Uint8Array {
  const key = `gold:${ramp.join(',')}`;
  const cached = lutCache.get(key);
  if (cached) return cached;
  const stops = [{ r: 255, g: 255, b: 255 }, ...ramp.map(hexToRgb)];
  const lut = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const lum = v / 255;
    let t = lum >= WHITE_CLAMP ? 0 : lum <= BLACK_CLAMP ? 1 : Math.pow((WHITE_CLAMP - lum) / (WHITE_CLAMP - BLACK_CLAMP), CONTRAST);
    // t 0 → paper, 0.35 → pale, 0.7 → gold, 1 → deep
    const seg = t <= 0.35 ? 0 : t <= 0.7 ? 1 : 2;
    const k = seg === 0 ? t / 0.35 : seg === 1 ? (t - 0.35) / 0.35 : (t - 0.7) / 0.3;
    t = k;
    lut[v * 3] = mix(stops[seg].r, stops[seg + 1].r, t);
    lut[v * 3 + 1] = mix(stops[seg].g, stops[seg + 1].g, t);
    lut[v * 3 + 2] = mix(stops[seg].b, stops[seg + 1].b, t);
  }
  lutCache.set(key, lut);
  return lut;
}

/** 256-entry luminance→RGB lookup table for one ink. */
function inkLut(inkHex: string): Uint8Array {
  const cached = lutCache.get(inkHex);
  if (cached) return cached;
  const ink = hexToRgb(inkHex);
  const lut = new Uint8Array(256 * 3);
  for (let v = 0; v < 256; v++) {
    const lum = v / 255;
    if (lum >= WHITE_CLAMP) {
      lut[v * 3] = lut[v * 3 + 1] = lut[v * 3 + 2] = 255;
    } else {
      const t =
        lum <= BLACK_CLAMP
          ? 1
          : Math.pow((WHITE_CLAMP - lum) / (WHITE_CLAMP - BLACK_CLAMP), CONTRAST);
      lut[v * 3] = mix(255, ink.r, t);
      lut[v * 3 + 1] = mix(255, ink.g, t);
      lut[v * 3 + 2] = mix(255, ink.b, t);
    }
  }
  lutCache.set(inkHex, lut);
  return lut;
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
  canvas.width = width;
  canvas.height = height;
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
  const lut = inkLut(inkHex);
  for (let p = 0, i = 0; p < lum.length; p++, i += 4) {
    const v = lum[p] * 3;
    d[i] = lut[v];
    d[i + 1] = lut[v + 1];
    d[i + 2] = lut[v + 2];
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
