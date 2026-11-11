import { PAL } from './stages/room/palette';

/**
 * The app-side board's frame (PRNTR-BOARD.md §15.2, the board-frame sheet's #5 of 2026-10-24): a gilded pixel frame
 * BOARD_FRAME_BAND cells deep around the card, in the room's gold keys, recoloured in the ink the app has landed on.
 */
export const BOARD_FRAME_BAND = 12;

type FrameKey = 'K' | 'p' | 'y' | 'o' | 's';

/**
 * The frame as palette keys, w × h cells, the card's box BOARD_FRAME_BAND cells in from each edge (null inside). Rings
 * from the outside: K, p, y, y, a row of beads (s and o, two each), y, an o groove, y, y, y, p, K; a scroll every 20 cells
 * on the flat; a diamond rosette of radius 6 in each corner.
 */
export function drawBoardFrame(w: number, h: number): (FrameKey | null)[] {
  const a: (FrameKey | null)[] = new Array(w * h).fill(null);
  const set = (x: number, y: number, k: FrameKey) => {
    if (x >= 0 && y >= 0 && x < w && y < h) a[y * w + x] = k;
  };
  const ring = (d: number, k: FrameKey) => {
    for (let x = d; x < w - d; x++) {
      set(x, d, k);
      set(x, h - 1 - d, k);
    }
    for (let y = d; y < h - d; y++) {
      set(d, y, k);
      set(w - 1 - d, y, k);
    }
  };
  ring(0, 'K');
  ring(1, 'p');
  ring(2, 'y');
  ring(3, 'y');
  // the beads: s and o alternating, two cells each
  for (let x = 4; x < w - 4; x++) {
    const k = x % 4 < 2 ? 's' : 'o';
    set(x, 4, k);
    set(x, h - 5, k);
  }
  for (let y = 4; y < h - 4; y++) {
    const k = y % 4 < 2 ? 's' : 'o';
    set(4, y, k);
    set(w - 5, y, k);
  }
  ring(5, 'y');
  ring(6, 'o');
  ring(7, 'y');
  ring(8, 'y');
  ring(9, 'y');
  ring(10, 'p');
  ring(11, 'K');
  // the scrolls on the flat (rings 7–9): a curl in o with an s glint and a p shadow
  for (let x = 16; x < w - 16; x += 20) {
    for (const y0 of [7, h - 10]) {
      set(x, y0 + 1, 'o');
      set(x + 1, y0, 'o');
      set(x + 2, y0 + 1, 'o');
      set(x + 1, y0 + 2, 'o');
      set(x + 1, y0 + 1, 's');
      set(x + 3, y0 + 1, 'p');
    }
  }
  for (let y = 16; y < h - 16; y += 20) {
    for (const x0 of [7, w - 10]) {
      set(x0 + 1, y, 'o');
      set(x0, y + 1, 'o');
      set(x0 + 1, y + 2, 'o');
      set(x0 + 2, y + 1, 'o');
      set(x0 + 1, y + 1, 's');
      set(x0 + 1, y + 3, 'p');
    }
  }
  // the rosettes: a diamond in each corner, its rim K, then o, y, an s centre with an o dot
  for (const [cx, cy] of [[6, 6], [w - 7, 6], [6, h - 7], [w - 7, h - 7]]) {
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d <= 6) set(cx + dx, cy + dy, d === 6 ? 'K' : d >= 4 ? 'o' : d >= 2 ? 'y' : 's');
      }
    }
    set(cx, cy, 'o');
  }
  return a;
}

const toHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s * 100, l * 100];
};

const fromHsl = (h: number, s: number, l: number): string => {
  const S = Math.min(100, Math.max(0, s)) / 100;
  const L = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
};

/**
 * The frame's golds in an ink: its hue, lighter and darker. Fitted to the sheet's hand-picked gold (#f3c64a #fff3b8 #a8821c
 * #6b5410 from #c9a227, matched within a few units): y 15 lighter, s 72 % of the way to white, o at 81 % of the
 * lightness, p at half, each a little more saturated.
 */
export function frameShades(inkHex: string): Record<FrameKey, string> {
  const [h, s, l] = toHsl(inkHex);
  return {
    K: PAL.K,
    y: fromHsl(h, s + 20, l + 15),
    s: fromHsl(h, s + 20, l + 0.72 * (100 - l)),
    o: fromHsl(h, s + 3, l * 0.81),
    p: fromHsl(h, s + 6, l * 0.5),
  };
}

/** The card's mat (sheet #5), painted inside the frame too: the card's box is rounded up to whole cells, so up to a cell of
 * the frame's inside shows past the card's edge. */
const MAT = '#1E1433';

/** Paints the frame onto `canvas` at one canvas px a cell; the caller sizes it in CSS (cells × the cell's CSS px). */
export function paintBoardFrame(canvas: HTMLCanvasElement, w: number, h: number, inkHex: string): void {
  const cells = drawBoardFrame(w, h);
  const colours = frameShades(inkHex);
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) return;
  const img = g.createImageData(w, h);
  for (let i = 0; i < cells.length; i++) {
    const k = cells[i];
    const n = parseInt((k ? colours[k] : MAT).slice(1), 16);
    img.data[i * 4] = n >> 16;
    img.data[i * 4 + 1] = (n >> 8) & 255;
    img.data[i * 4 + 2] = n & 255;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
