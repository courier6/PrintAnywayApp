/**
 * The safe in the wall behind the print (PRNTR-SAFE.md): its layout on the room's grid, the keypad painted on the print's
 * finer canvas (ART_SUB cells to a room px), and the key under a shot. The room draws the safe's steel, its door and what is
 * inside (scene.ts drawWallHole); the keys and the display are cells on the art canvas, seen through the rects the room
 * clears over them, so their digits read at the room's scale.
 */
import { ART_AT, ART_SUB } from './art';
import { PAL, type PalKey } from './palette';
import { parseSprite, type Sprite } from './pixels';

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
/**
 * The long rifle magazine inside once the door is open (the magazine sheet's #9, PRNTR-SAFE.md §13): upright on its base
 * plate, curved, turning about its own axis like a pickup (MAG_STEPS frames a turn, one turn every MAG_SPIN_MS) and
 * hovering MAG_BOB px over MAG_BOB_MS. Its frames are rendered once at load: each body row is a rounded steel box in
 * cross-section, ray-cast under a light from the upper left front, so the pale edge, the steel and the shadow slide
 * across the face as it turns; the round a brass cylinder across the feed lips, copper at its tip; the plate wider and
 * darker; a lighter witness strip up the face; a plum outline grown round the silhouette. MAG_FRAME_AT is the frame's
 * top-left at the top of the hover (the lips' axis is column 113); MAG_BOX is the safe's black interior, which the frame
 * is clipped to and where a shot takes the magazine.
 */
export const MAG_STEPS = 32;
export const MAG_SPIN_MS = 2400;
export const MAG_BOB = 1;
export const MAG_BOB_MS = 1400;
export const MAG_BOX = { x0: 106, y0: 43, x1: 121, y1: 61 };
const MAG_SPEC = { H: 15, a: 3, b: 1.4, rad: 1, curve: 4, plate: 3 };
/** The frame spans the lips' axis ± MAG_R columns. */
const MAG_R = 12;
export const MAG_FRAME_AT = { x: 113 - MAG_R, y: 43 };
const STEEL: PalKey[] = ['X', 'G', 'x', 'g', 'w'];
const PLATE: PalKey[] = ['i', 'i', 'X', 'G', 'x'];
const BRASS: PalKey[] = ['p', 'p', 'y', 'y', 's'];
/** The tones' cuts on the shade (−1 facing away from the light … 1 facing it squarely). */
const CUTS = [-0.4, 0.2, 0.6, 0.95];
const LX = -0.55, LZ = -0.835;
/** A rounded rectangle's signed distance: half extents a, b, corner radius rad. */
function sdf(u: number, v: number, a: number, b: number, rad: number): number {
  const qx = Math.abs(u) - a + rad, qy = Math.abs(v) - b + rad;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
}
/** Frame `step` of the turn as sprite rows ('.' transparent). */
function renderMagFrame(step: number): string[] {
  const { H, a, b, rad, curve, plate } = MAG_SPEC;
  const theta = (step / MAG_STEPS) * 2 * Math.PI, c = Math.cos(theta), sn = Math.sin(theta);
  const cols = 2 * MAG_R + 1;
  // the ray through a pixel's centre px (relative to the axis), toward +z from the viewer, into a section offset offU along
  // the face: the shade where it first hits, and the hit in the section's own coordinates
  const cast = (px: number, offU: number, ha: number, hb: number, hr: number): { shade: number; u: number; v: number } | null => {
    for (let z = -(ha + hb + 1); z <= ha + hb + 1; z += 0.04) {
      const u = px * c + z * sn - offU, v = -px * sn + z * c;
      if (sdf(u, v, ha, hb, hr) < 0) {
        const e = 0.02;
        const nu = sdf(u + e, v, ha, hb, hr) - sdf(u - e, v, ha, hb, hr), nv = sdf(u, v + e, ha, hb, hr) - sdf(u, v - e, ha, hb, hr);
        const nl = Math.hypot(nu, nv) || 1;
        const nx = (nu * c - nv * sn) / nl, nz = (nu * sn + nv * c) / nl;
        return { shade: nx * LX + nz * LZ, u, v };
      }
    }
    return null;
  };
  const ramp = (arr: PalKey[], shade: number, bias: number): PalKey => {
    let i = 0;
    while (i < CUTS.length && shade >= CUTS[i]) i++;
    return arr[Math.max(0, Math.min(arr.length - 1, i + bias))];
  };
  const body1 = H - 1 - plate;
  const grid: (PalKey | null)[][] = [];
  for (let r = 0; r < H; r++) {
    const row: (PalKey | null)[] = new Array(cols).fill(null);
    const uu = r / (H - 1), offU = curve * uu * uu;
    for (let i = 0; i < cols; i++) {
      const px = i - MAG_R + 0.5;
      if (r === 0) {
        const hit = cast(px, offU, a - 1.2, b * 0.7, 0.4);
        const rd = cast(px, offU, a - 0.6, 0.75, 0.75);
        if (rd) row[i] = rd.u > a - 1.9 ? 'o' : ramp(BRASS, rd.shade, 0);
        else if (hit) row[i] = ramp(STEEL, hit.shade, -1);
      } else if (r > body1) {
        const hit = cast(px, offU, a + 0.7, b + 0.4, 0.6);
        if (hit) row[i] = ramp(PLATE, hit.shade, r === body1 + 1 ? 1 : 0);
      } else {
        const hit = cast(px, offU, a, b, rad);
        if (hit) {
          const bias = Math.abs(hit.u) < 0.45 && Math.abs(hit.v) > b - 0.3 ? 1 : 0;
          row[i] = hit.shade > 0.985 ? 'W' : ramp(STEEL, hit.shade, bias);
        }
      }
    }
    grid.push(row);
  }
  // the outline: plum grown round the silhouette (4-neighbour), one row above and below too
  const H2 = H + 2;
  const out: (PalKey | null)[][] = Array.from({ length: H2 }, () => new Array(cols).fill(null));
  for (let r = 0; r < H; r++) for (let i = 0; i < cols; i++) if (grid[r][i]) out[r + 1][i] = grid[r][i];
  for (let r = 0; r < H2; r++) {
    for (let i = 0; i < cols; i++) {
      if (out[r][i]) continue;
      const n = (rr: number, ii: number) => rr >= 0 && rr < H2 && ii >= 0 && ii < cols && out[rr][ii] !== null && out[rr][ii] !== 'K';
      if (n(r - 1, i) || n(r + 1, i) || n(r, i - 1) || n(r, i + 1)) out[r][i] = 'K';
    }
  }
  return out.map((row) => row.map((k) => k ?? '.').join(''));
}
/** The turn's MAG_STEPS frames, 25 × 17 each. */
export const MAG_FRAMES: Sprite[] = Array.from({ length: MAG_STEPS }, (_, s) => parseSprite(renderMagFrame(s).join('\n')));
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
