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
  const lut = inkLut(inkHex);
  const canvas = target ?? document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  const img = ctx.createImageData(width, height);
  const d = img.data;
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
