import type { PageBitmaps } from '../../types';
import { PAL, type PalKey } from './palette';

/** The thrown page's content cells: PAGE_PRINTED's printed lines sit in columns 2–7 and rows 2–10 of its 10×13, inside the K outline and a 1-px paper margin. */
export const DOC_CELLS = { x: 2, y: 2, w: 6, h: 9 };

/** Whether output px (ox, oy) of the page blitted at `sc` is one of the content cells. */
export const inDocCells = (ox: number, oy: number, sc: number): boolean =>
  ox >= DOC_CELLS.x * sc && ox < (DOC_CELLS.x + DOC_CELLS.w) * sc && oy >= DOC_CELLS.y * sc && oy < (DOC_CELLS.y + DOC_CELLS.h) * sc;

/**
 * The blit hook for the player's page: the frame (outline and margin) is drawn as PAGE_PRINTED says, or as the
 * burn hook says; the content cells are left to the doc canvas (nothing drawn) unless the burn hook says
 * otherwise there (eaten, char or scorch), so the front layer has a hole where the content goes.
 */
export function docFine(sc: number, burn?: (ox: number, oy: number, key: PalKey) => PalKey | null | undefined): (ox: number, oy: number, key: PalKey) => PalKey | null | undefined {
  return (ox, oy, key) => {
    const f = burn?.(ox, oy, key);
    if (!inDocCells(ox, oy, sc)) return f;
    return f === undefined ? null : f;
  };
}

/** A rendering of the page fitted into the content cells: `w` × `h` virtual px at `x`, `y` from the cells' top-left. */
interface Fitted {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The player's page as it was loaded (PageBitmaps.recolored, the first page in the player's ink), drawn at the
 * screen's own resolution into the content cells of the thrown page's sprite (PRNTR-FIRE.md §18). The bitmap is
 * fitted into the cells keeping its shape (a landscape image sits in a band across the middle), rendered once per
 * sprite scale and screen scale, and multiplied onto the paper colour so its white is the page's paper.
 */
export class DocContent {
  private readonly fits = new Map<string, Fitted>();

  constructor(private readonly page: PageBitmaps) {}

  /** The page fitted for the sprite at `sc` with `k` device px to the virtual px; the offset is on the device grid. */
  private at(sc: number, k: number): Fitted {
    const key = `${sc}/${k}`;
    const had = this.fits.get(key);
    if (had) return had;
    const cw = DOC_CELLS.w * sc, ch = DOC_CELLS.h * sc;
    const f = Math.min(cw / this.page.width, ch / this.page.height);
    const pw = Math.max(1, Math.round(this.page.width * f * k)), ph = Math.max(1, Math.round(this.page.height * f * k));
    const canvas = document.createElement('canvas');
    canvas.width = pw;
    canvas.height = ph;
    const g = canvas.getContext('2d');
    if (g) {
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(this.page.recolored, 0, 0, pw, ph);
    }
    const fit = { canvas, x: Math.round((cw * k - pw) / 2) / k, y: Math.round((ch * k - ph) / 2) / k, w: pw / k, h: ph / k };
    this.fits.set(key, fit);
    return fit;
  }

  /**
   * Draws the content of the page whose sprite's top-left is (x, y) at scale `sc`, on `g` with `k` device px to the
   * virtual px: the content cells in `paper`, the bitmap multiplied onto them; only the first `rows` output rows
   * (the page rising out of the slot); shifted right one px every `skew` rows like the blit; and cleared wherever
   * `fine` draws something or nothing of its own (the burn's eaten, charred and scorched cells are the front's).
   */
  draw(g: CanvasRenderingContext2D, k: number, x: number, y: number, sc: number, paper: PalKey, opts: { rows?: number; skew?: number; fine?: (ox: number, oy: number, key: PalKey) => PalKey | null | undefined } = {}): void {
    const fit = this.at(sc, k);
    const h = 13 * sc, rows = Math.min(h, opts.rows ?? h), band = opts.skew ?? h;
    const cx = DOC_CELLS.x * sc, cy = DOC_CELLS.y * sc, cw = DOC_CELLS.w * sc, ch = DOC_CELLS.h * sc;
    g.save();
    g.setTransform(k, 0, 0, k, 0, 0);
    for (let oy0 = 0; oy0 < rows; oy0 += band) {
      const oy1 = Math.min(rows, oy0 + band), shift = Math.floor(oy0 / band) * (opts.skew ? 1 : 0);
      const top = Math.max(oy0, cy), bottom = Math.min(oy1, cy + ch);
      if (bottom <= top) continue;
      g.save();
      g.beginPath();
      g.rect(x + shift + cx, y + top, cw, bottom - top);
      g.clip();
      g.fillStyle = PAL[paper];
      g.fillRect(x + shift + cx, y + top, cw, bottom - top);
      g.globalCompositeOperation = 'multiply';
      g.imageSmoothingEnabled = false;
      g.drawImage(fit.canvas, x + shift + cx + fit.x, y + cy + fit.y, fit.w, fit.h);
      g.restore();
    }
    if (opts.fine) {
      for (let oy = cy; oy < Math.min(rows, cy + ch); oy++) {
        const shift = opts.skew ? Math.floor(oy / opts.skew) : 0;
        for (let ox = cx; ox < cx + cw; ox++) if (opts.fine(ox, oy, 'w') !== undefined) g.clearRect(x + ox + shift, y + oy, 1, 1);
      }
    }
    g.restore();
  }
}
