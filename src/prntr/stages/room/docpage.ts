import type { PageBitmaps } from '../../types';
import type { Sprite } from './pixels';

/** A cell is ink when the ink covers more than this of it (the stand-in's 10-px lines in 18-px cells are 0.55). */
export const DOC_INK_MIN = 0.33;

/**
 * The player's page as the thrown page's sprite at 2× (20×26: a 2-px K outline round 16×22 cells of the
 * document) and as the page on the glass at 4× (40×52: a 4-px outline round 32×44 cells), both blitted at
 * scale 1 in place of PAGE_PRINTED scaled. The bitmap is fitted into the cells keeping its shape (a landscape
 * image sits in a band across the middle, paper above and below); each cell is I where the ink's coverage of
 * its box is over DOC_INK_MIN, w else. Coverage is 1 − luminance, relative to the ink's own (so a pale ink
 * such as gold still reads as ink). Built once when the room starts.
 */
export function docSprites(page: PageBitmaps, inkHex: string): { flying: Sprite; landed: Sprite } {
  const { width: W, height: H } = page;
  const g = page.recolored.getContext('2d', { willReadFrequently: true });
  const d = g ? g.getImageData(0, 0, W, H).data : new Uint8ClampedArray(W * H * 4).fill(255);
  const lum = (r: number, gg: number, b: number) => (0.299 * r + 0.587 * gg + 0.114 * b) / 255;
  const n = parseInt(inkHex.slice(1), 16);
  const inkCov = Math.max(0.05, 1 - lum((n >> 16) & 255, (n >> 8) & 255, n & 255));
  const make = (scale: number): Sprite => {
    const cw = 8 * scale, ch = 11 * scale, w = 10 * scale, h = 13 * scale;
    const f = Math.min(cw / W, ch / H), dw = Math.max(1, Math.round(W * f)), dh = Math.max(1, Math.round(H * f));
    const ox = Math.floor((cw - dw) / 2), oy = Math.floor((ch - dh) / 2);
    const rows: string[] = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) {
        const i = x - scale - ox, j = y - scale - oy;
        if (x < scale || y < scale || x >= w - scale || y >= h - scale) { row += 'K'; continue; }
        if (i < 0 || j < 0 || i >= dw || j >= dh) { row += 'w'; continue; }
        const x0 = Math.floor((i * W) / dw), x1 = Math.max(x0 + 1, Math.floor(((i + 1) * W) / dw));
        const y0 = Math.floor((j * H) / dh), y1 = Math.max(y0 + 1, Math.floor(((j + 1) * H) / dh));
        let s = 0, c = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const o = (yy * W + xx) * 4; s += 1 - lum(d[o], d[o + 1], d[o + 2]); c++; }
        row += s / c / inkCov > DOC_INK_MIN ? 'I' : 'w';
      }
      rows.push(row);
    }
    return { w, h, rows };
  };
  return { flying: make(2), landed: make(4) };
}
