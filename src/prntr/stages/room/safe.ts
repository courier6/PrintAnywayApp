/**
 * The safe in the wall behind the print (PRNTR-SAFE.md): its layout on the room's grid, the keypad painted on the print's
 * finer canvas (ART_SUB cells to a room px), and the key under a shot. The room draws the safe's steel, its door and what is
 * inside (scene.ts drawWallHole); the keys and the display are cells on the art canvas, seen through the rects the room
 * clears over them, so their digits read at the room's scale.
 */
import { ART_AT, ART_SUB } from './art';
import { PAL, type PalKey } from './palette';

/** The code that opens it. */
export const SAFE_CODE = '1234';
/** The safe's door in room px (half-open), hinged on its left, inside the cavity with the dark showing round it; REVEAL is
 * the rect the tear is always open to, so the keys and the display are never under the rim. */
export const SAFE = { x0: 104, y0: 42, x1: 123, y1: 63 };
export const REVEAL = { x0: 106, y0: 43, x1: 121, y1: 61 };
/** The keypad: its top-left and a key's size; 3 columns × 4 rows. */
export const PAD = { x: 107, y: 48, kw: 4, kh: 3 };
/** The four-slot display above the keys and the handle beside it. */
export const DISPLAY = { x: 108, y: 44, w: 8, h: 3 };
export const HANDLE = { x: 118, y: 44, w: 3 };
/** The drum magazine inside once the door is open: its centre and radius, and the box a shot takes it in. */
export const DRUM = { cx: 114, cy: 52, r: 3.6 };
export const DRUM_BOX = { x0: 110, y0: 48, x1: 119, y1: 58 };
const KEYS = ['123', '456', '789', '*0#'];

/** The key under a room point, or null; '*' and '#' press but enter nothing. */
export function keyAt(x: number, y: number): string | null {
  const c = Math.floor((x - PAD.x) / PAD.kw);
  const r = Math.floor((y - PAD.y) / PAD.kh);
  if (c < 0 || c > 2 || r < 0 || r > 3) return null;
  return KEYS[r][c];
}

/** What the keypad shows: the digits entered so far, the key pressed right now (null: none), the verdict on a full code. */
export interface Keypad {
  entry: string;
  press: string | null;
  verdict: 'none' | 'err' | 'ok';
  /** The ERR's blink phase (on/off every 150 ms). */
  blink: boolean;
}

/** A 3 × 5 font: the digits, the two corner keys, the empty slot, and the letters of ERR and OPEN. */
const FONT: Record<string, string[]> = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '001', '001', '001'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], '*': ['101', '010', '111', '010', '101'], '#': ['101', '111', '101', '111', '101'],
  '-': ['000', '000', '111', '000', '000'], E: ['111', '100', '111', '100', '111'], R: ['111', '101', '111', '110', '101'],
  O: ['111', '101', '101', '101', '111'], P: ['111', '101', '111', '100', '100'], N: ['101', '111', '111', '111', '101'],
};

/**
 * The keypad and the display on the art canvas: grey keys with dark digits (a 3 × 5 glyph at 2 cells per glyph px), a lit
 * top and left edge, a darker seam between them, the pressed key dark with a white digit; the display's four slots show the
 * digits entered (`12--`), `ERR` blinking on a wrong code, `OPEN` on the right one. Painted over the print's cells where the
 * room clears its canvas (the keypad's and the display's rects), so it is what shows there.
 */
export function paintKeypad(ag: CanvasRenderingContext2D, k: Keypad): void {
  const S = ART_SUB;
  const cell = (cx: number, cy: number, w: number, h: number, key: PalKey) => {
    ag.fillStyle = PAL[key];
    ag.fillRect(cx, cy, w, h);
  };
  const glyph = (cx: number, cy: number, ch: string, cp: number, key: PalKey) => {
    const g = FONT[ch];
    if (!g) return;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '1') cell(cx + c * cp, cy + r * cp, cp, cp, key);
  };
  const KW = PAD.kw * S, KH = PAD.kh * S, KX = (PAD.x - ART_AT.x) * S, KY = (PAD.y - ART_AT.y) * S;
  KEYS.forEach((row, r) => {
    for (let c = 0; c < 3; c++) {
      const ch = row[c], x = KX + c * KW, y = KY + r * KH, pressed = k.press === ch;
      cell(x, y, KW, KH, pressed ? 'G' : 'd');
      cell(x + KW - 1, y, 1, KH, 'g');
      cell(x, y + KH - 1, KW, 1, 'g');
      cell(x, y, KW - 1, 1, 'w');
      cell(x, y, 1, KH - 1, 'w');
      glyph(x + Math.floor((KW - 1 - 6) / 2), y + Math.floor((KH - 1 - 10) / 2), ch, 2, pressed ? 'W' : 'K');
    }
  });
  const DX = (DISPLAY.x - ART_AT.x) * S, DY = (DISPLAY.y - ART_AT.y) * S;
  cell(DX, DY, DISPLAY.w * S, DISPLAY.h * S, 'z');
  const text = k.verdict === 'ok' ? 'OPEN' : k.verdict === 'err' ? (k.blink ? 'ERR ' : '    ') : k.entry.padEnd(4, '-');
  for (let i = 0; i < 4; i++) {
    const ch = text[i];
    glyph(DX + 1 + i * 8, DY + 1, ch, 2, k.verdict === 'ok' ? 'n' : k.verdict === 'err' ? 'Q' : ch === '-' ? 'G' : 'c');
  }
}
