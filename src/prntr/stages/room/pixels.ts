import { PAL, type PalKey } from './palette';

/** The room's virtual resolution; it is shown at a whole-number scale, never stretched. */
export const W = 240;
export const H = 160;

export interface Sprite {
  w: number;
  h: number;
  rows: string[];
}

/** Parses a string sprite map; throws on a ragged map so a copy error fails at once. */
export function parseSprite(map: string): Sprite {
  const rows = map.trim().split('\n');
  const w = rows[0].length;
  if (rows.some((r) => r.length !== w)) throw new Error('prntr: ragged sprite');
  return { w, h: rows.length, rows };
}

/** Rows from..to-1 of a sprite as a sprite of their own (the plant's top and its pot). */
export function sliceRows(s: Sprite, from: number, to: number): Sprite {
  return { w: s.w, h: to - from, rows: s.rows.slice(from, to) };
}

/** A sprite turned a quarter turn clockwise `quarters` times (the clock rolling). */
export function rotateSprite(s: Sprite, quarters: number): Sprite {
  let out = s;
  for (let q = 0; q < ((quarters % 4) + 4) % 4; q++) {
    const rows: string[] = [];
    for (let y = 0; y < out.w; y++) {
      let row = '';
      for (let x = 0; x < out.h; x++) row += out.rows[out.h - 1 - x][y];
      rows.push(row);
    }
    out = { w: out.h, h: out.w, rows };
  }
  return out;
}

const RGB = Object.fromEntries(
  (Object.keys(PAL) as PalKey[]).map((k) => {
    const n = parseInt(PAL[k].slice(1), 16);
    return [k, [(n >> 16) & 255, (n >> 8) & 255, n & 255]];
  }),
) as Record<PalKey, [number, number, number]>;

export interface BlitOptions {
  /** Draw one palette key as another (the EXIT sign's n → R, the sticker's c → R). */
  remap?: Partial<Record<string, PalKey>>;
  /** Every opaque pixel white (the machine's hit flash). */
  white?: boolean;
  /** Shift right by one output pixel every `skew` output rows (a landed page's angle). */
  skew?: number;
  /** Lower the right end by this many output pixels, the left end fixed (the EXIT sign hanging from a corner). */
  tilt?: number;
}

/**
 * A 240×160 RGBA frame buffer, written pixel by pixel and put on the canvas in one
 * putImageData. The canvas is 240×160 and CSS scales it up with nearest-neighbour
 * (`image-rendering: pixelated`), so nothing in the pixel layer is ever smoothed.
 */
export class Pix {
  readonly image = new ImageData(W, H);
  private readonly d = this.image.data;

  set(x: number, y: number, key: PalKey): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    const c = RGB[key];
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = 255;
  }

  fill(key: PalKey): void {
    this.rect(0, 0, W, H, key);
  }

  /** Every pixel transparent (the cursor layer starts each frame empty). */
  clear(): void {
    this.d.fill(0);
  }

  /** Half-open like the designer's Python: x0..x1-1, y0..y1-1. */
  rect(x0: number, y0: number, x1: number, y1: number, key: PalKey): void {
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) this.set(x, y, key);
    }
  }

  blit(x: number, y: number, sprite: Sprite, scale = 1, opts: BlitOptions = {}): void {
    for (let dy = 0; dy < sprite.h; dy++) {
      const row = sprite.rows[dy];
      for (let dx = 0; dx < sprite.w; dx++) {
        const ch = row[dx];
        if (ch === '.') continue;
        const key = opts.white ? 'W' : ((opts.remap?.[ch] ?? ch) as PalKey);
        const drop = opts.tilt ? Math.round((dx / (sprite.w - 1)) * opts.tilt) : 0;
        for (let sy = 0; sy < scale; sy++) {
          const oy = dy * scale + sy;
          const shift = opts.skew ? Math.floor(oy / opts.skew) : 0;
          for (let sx = 0; sx < scale; sx++) this.set(x + dx * scale + sx + shift, y + oy + drop, key);
        }
      }
    }
  }

  present(g: CanvasRenderingContext2D): void {
    g.putImageData(this.image, 0, 0);
  }
}
