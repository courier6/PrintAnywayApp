import { SPRITES, type PalKey } from './palette';
import { H, Pix, W, parseSprite, sliceRows } from './pixels';

export const SPR = {
  MFC: parseSprite(SPRITES.MFC),
  MFC_MAD: parseSprite(SPRITES.MFC_MAD),
  INFO: parseSprite(SPRITES.INFO),
  USB: parseSprite(SPRITES.USB),
  POINTER: parseSprite(SPRITES.POINTER),
  CROSSHAIR: parseSprite(SPRITES.CROSSHAIR),
  STAPLE: parseSprite(SPRITES.STAPLE),
  COOLER: parseSprite(SPRITES.COOLER),
  PLANT: parseSprite(SPRITES.PLANT),
  POSTER: parseSprite(SPRITES.POSTER),
  CLOCK: parseSprite(SPRITES.CLOCK),
  EXIT: parseSprite(SPRITES.EXIT),
  PAGE_SMALL: parseSprite(SPRITES.PAGE_SMALL),
  PAGE_PRINTED: parseSprite(SPRITES.PAGE_PRINTED),
  CLOCK_BROKEN: parseSprite(SPRITES.CLOCK_BROKEN),
  POSTER_TORN: parseSprite(SPRITES.POSTER_TORN),
  TANK_BROKEN: parseSprite(SPRITES.TANK_BROKEN),
  PLANT_BARE: parseSprite(SPRITES.PLANT_BARE),
  POT_BROKEN: parseSprite(SPRITES.POT_BROKEN),
  EXIT_BROKEN: parseSprite(SPRITES.EXIT_BROKEN),
  SPLAT: parseSprite(SPRITES.SPLAT),
};
/** The cooler below its bottle, the plant's leaves and its pot, so each half can break alone. */
const COOLER_BODY = sliceRows(SPR.COOLER, 8, 22);
const PLANT_TOP = sliceRows(SPR.PLANT, 0, 10);
const PLANT_POT = sliceRows(SPR.PLANT, 10, 16);

/** What the gun has broken (Edgar, 2026-10-19): each stays broken for the rest of the stage. */
export interface Broken {
  clock: boolean;
  poster: boolean;
  /** The cooler's bottle. */
  tank: boolean;
  /** The leaves. */
  plant: boolean;
  /** The pot. */
  vase: boolean;
}

/**
 * The fire once the water jug has broken (Edgar, 2026-10-19): it starts in the gap between
 * the cooler and the machine and grows over the cooler, then burns on. `u` is its growth,
 * `t` the frame's time for the flicker (0 = still).
 */
export interface Fire {
  u: number;
  t: number;
  /** How far it has spread onto the machine (0 none … 1 engulfed), once the machine is weak. */
  v: number;
}

/** The EXIT sign (Edgar, 2026-10-19): shot once it hangs loose from its left corner, shot again it falls. */
export interface ExitSign {
  state: 'up' | 'loose' | 'falling' | 'down';
  /** Its top-left corner (falling: on the way down). */
  x: number;
  y: number;
  /** How far its right end hangs below its left, in px; the stage swings it. */
  tilt: number;
  /** The letters' red light; loose, they flicker, then go out for good. */
  lit: boolean;
}

/**
 * idle: closed, 2× at 88,100. lid: lid up, still 2× at 88,100 (1.1 s into the sticker
 * beat). between: lid up, 2× at 80,90 (the first of the two steps forward).
 * mad: 3× at 72,80.
 */
export type PrinterPose = 'idle' | 'lid' | 'between' | 'mad';

/** An ink particle on the far half of its flight, drawn behind the machine (Edgar, 2026-10-20). */
export interface InkDot {
  x: number;
  y: number;
  size: number;
  color: PalKey;
}

export interface SceneState {
  /** Left, right fluorescent panel. */
  lights: [boolean, boolean];
  printer: PrinterPose;
  /** The machine's power light red (the beat after the USB goes in; the handoff reddened its sticker). */
  ledRed: boolean;
  trayPage: boolean;
  /** The USB stick still on the carpet (Edgar, 2026-10-19: it starts the fight). */
  usb: boolean;
  /** 0 = at rest; 5, 6, 7 = the scan bar's sprite row during the sweep (mad only). */
  scanRow: 0 | 5 | 6 | 7;
  /** The machine drawn all white (the hit flash). */
  flashWhite: boolean;
  /** The red button on the open machine's panel, lit bright for a blink (mad only). */
  buttonBright: boolean;
  broken: Broken;
  exit: ExitSign;
  /** How wide the door stands open on black, in px: ajar at 6; once the sign is down it swings in (Edgar, 2026-10-19). */
  doorGap: number;
  fire: Fire | null;
  /** The mad machine's tremble: the 3× pose drawn this far off its place (Edgar, 2026-10-19). */
  shake: { x: number; y: number };
  /** The ink in the air behind the machine this frame: the jets come up from behind it. */
  inkBehind: InkDot[];
}

/** A cheap hash to 0..1, so a flame column flickers on its own without random state. */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** The main flame's footprint at growth u: from a lick in the gap to a blaze over the cooler. */
export function fireRect(u: number): { x0: number; x1: number; y0: number; y1: number } {
  const cx = 74 - 12 * u;
  const w = 4 + 16 * u;
  const h = 8 + 52 * u;
  return { x0: Math.round(cx - w), x1: Math.round(cx + w), y0: 146 - Math.round(h), y1: 146 };
}

/**
 * One flame: a dome of columns of height h over half-width w, standing on `floor`, each
 * column flickering by its own hash (seeded) every 50 ms; yellow at the floor, orange, red
 * at the tips, a spark now and then above them.
 */
function drawFlame(p: Pix, cx: number, w: number, h: number, floor: number, seed: number, t: number): void {
  if (h < 1 || w < 1) return;
  const tick = Math.floor(t / 50);
  for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
    const k = (x - cx) / w;
    const n = 0.5 * (hash(x * 31 + tick * 7 + seed) + hash((x + 1) * 31 + tick * 7 + seed));
    const col = h * Math.sqrt(Math.max(0, 1 - k * k)) * (0.65 + 0.35 * n);
    if (col < 1) continue;
    const top = floor - col;
    for (let y = Math.ceil(top); y < floor; y++) {
      const q = (floor - y) / col;
      p.set(x, y, q < 0.35 ? 'y' : q < 0.7 ? 'o' : 'R');
    }
    if (n > 0.93) p.set(x, Math.ceil(top) - 2 - (Math.floor(n * 100) % 4), 'o');
  }
}

/** A later flame's own growth: 0 until the fire reaches `from`, 1 when it is full. */
const later = (u: number, from: number) => Math.max(0, Math.min(1, (u - from) / (1 - from)));

/**
 * The fire in three layers, so it sits among the things it burns rather than in front of
 * them (Edgar): `back`, two smaller flames behind the cooler on the floor further in (they
 * come as the fire grows and round it out); `mid`, the main flame, in front of the cooler
 * and behind the machine; `front`, a low lick at the machine's foot and the cooler's base.
 */
function drawFire(p: Pix, f: Fire, layer: 'back' | 'mid' | 'front'): void {
  const r = fireRect(f.u);
  const h = r.y1 - r.y0;
  if (layer === 'mid') drawFlame(p, (r.x0 + r.x1) / 2, (r.x1 - r.x0) / 2, h, r.y1, 0, f.t);
  else if (layer === 'back') {
    drawFlame(p, 50, 7 * later(f.u, 0.35), 0.9 * h * later(f.u, 0.35), 142, 100, f.t);
    drawFlame(p, 70, 6 * later(f.u, 0.55), 0.95 * h * later(f.u, 0.55), 142, 200, f.t);
  } else {
    drawFlame(p, 76, 5 * later(f.u, 0.2), 0.3 * h * later(f.u, 0.2), 146, 300, f.t);
    // onto the machine from its left side, until the whole of it is in flames (72–168 × 80–146)
    if (f.v > 0) drawFlame(p, 80 + 40 * f.v, 8 + 42 * f.v, 20 + 48 * f.v, 146, 400, f.t);
  }
}

/**
 * The room, a port of room() in prntr/design/stage1/art/liminal.py, the authoritative
 * layout. Every number is a virtual pixel.
 */
export function drawRoom(p: Pix, s: SceneState): void {
  p.fill('A');
  // ceiling: tiles with a grid, two fluorescent panels, a shadow line under it
  p.rect(0, 0, W, 28, 'T');
  for (let x = 0; x < W; x += 24) p.rect(x, 0, x + 1, 28, 't');
  for (let y = 0; y < 28; y += 9) p.rect(0, y, W, y + 1, 't');
  p.rect(0, 27, W, 29, 'a');
  [44, 148].forEach((x0, i) => {
    const on = s.lights[i];
    p.rect(x0, 9, x0 + 48, 18, 't');
    p.rect(x0 + 1, 10, x0 + 47, 17, on ? 'F' : 'f');
    if (on) p.rect(x0 + 6, 12, x0 + 42, 15, 'W');
  });
  // the wall darkens under a tube that is out
  if (!s.lights[0]) p.rect(0, 29, 120, 108, 'a');
  if (!s.lights[1]) p.rect(120, 29, W, 108, 'a');
  // baseboard, then the carpet: a 2×2 dither of C and x
  p.rect(0, 106, W, 109, 'B');
  for (let y = 109; y < H; y++) {
    for (let x = 0; x < W; x++) p.set(x, y, (x + y) % 2 === 0 ? 'C' : 'x');
  }
  // the door, ajar on black, EXIT above it
  p.rect(10, 40, 44, 108, 'E');
  p.rect(13, 43, 41, 108, 'D');
  p.rect(13, 43, 13 + s.doorGap, 108, 'z');
  // the door's leading edge, once it has swung further in
  if (s.doorGap > 6) p.rect(13 + s.doorGap, 43, 14 + s.doorGap, 108, 'E');
  p.rect(36, 76, 38, 78, 'K');
  // the EXIT sign: on the wall, hanging loose, falling, or on the floor in front of the door
  const sign = s.exit;
  if (sign.state === 'down') p.blit(Math.round(sign.x), Math.round(sign.y), SPR.EXIT_BROKEN);
  else p.blit(Math.round(sign.x), Math.round(sign.y), SPR.EXIT, 1, { remap: { n: sign.lit ? 'R' : 'G' }, tilt: sign.tilt });
  p.blit(66, 40, s.broken.poster ? SPR.POSTER_TORN : SPR.POSTER);
  p.blit(112, 36, s.broken.clock ? SPR.CLOCK_BROKEN : SPR.CLOCK);
  // the window: light, blinds, nothing outside
  p.rect(160, 36, 224, 90, 'e');
  p.rect(163, 39, 221, 87, 's');
  for (let y = 41; y < 87; y += 4) p.rect(163, y, 221, y + 1, 'a');
  // cooler and plant, their shadows to the left (the window is the light)
  p.rect(42, 128, 56, 131, 'X');
  if (s.fire) drawFire(p, s.fire, 'back');
  if (s.broken.tank) {
    // the water on the carpet, the stump of the bottle, the cooler itself
    p.rect(46, 135, 78, 137, 'L');
    p.rect(42, 137, 82, 139, 'l');
    p.blit(50, 92, SPR.TANK_BROKEN, 2);
    p.blit(50, 108, COOLER_BODY, 2);
  } else {
    p.blit(50, 92, SPR.COOLER, 2);
  }
  if (s.fire) drawFire(p, s.fire, 'mid');
  p.rect(190, 132, 206, 135, 'X');
  p.blit(200, 103, s.broken.plant ? SPR.PLANT_BARE : PLANT_TOP, 2);
  p.blit(200, 123, s.broken.vase ? SPR.POT_BROKEN : PLANT_POT, 2);
  if (s.broken.plant) {
    // leaves on the carpet
    p.rect(194, 134, 196, 136, 'v');
    p.rect(198, 136, 200, 138, 'V');
    p.rect(230, 133, 232, 135, 'V');
    p.rect(226, 136, 228, 138, 'v');
  }
  // the ink sprayed from behind the machine, where it is still behind it
  for (const d of s.inkBehind) p.rect(d.x, d.y, d.x + d.size, d.y + d.size, d.color);
  // the printer; its shadow falls the other way. Nothing points it out.
  const white = s.flashWhite;
  switch (s.printer) {
    case 'mad': {
      const { x, y } = s.shake;
      p.rect(84 + x, 146 + y, 176 + x, 152 + y, 'X');
      p.blit(72 + x, 80 + y, SPR.MFC_MAD, 3, { white, remap: s.buttonBright ? { R: 'Q' } : undefined });
      if (s.scanRow && !white) p.rect(72 + x + 3 * 2, 80 + y + 3 * s.scanRow, 72 + x + 3 * 23, 80 + y + 3 * (s.scanRow + 1), 'c');
      break;
    }
    case 'between':
      p.rect(90, 144, 168, 149, 'X');
      p.blit(80, 90, SPR.MFC_MAD, 2, { white });
      break;
    case 'lid':
      p.rect(96, 142, 160, 146, 'X');
      p.blit(88, 100, SPR.MFC_MAD, 2);
      break;
    default:
      p.rect(96, 142, 160, 146, 'X');
      p.blit(88, 100, SPR.MFC, 2, s.ledRed ? { remap: { n: 'R' } } : {});
  }
  // the tray page exists only while the machine is at 2× in place
  if ((s.printer === 'idle' || s.printer === 'lid') && s.trayPage) p.blit(98, 118, SPR.PAGE_SMALL);
  // the USB stick on the carpet, right of the machine, with its shadow
  if (s.usb) {
    p.rect(168, 146, 184, 148, 'X');
    p.blit(166, 136, SPR.USB, 2);
  }
  if (s.fire) drawFire(p, s.fire, 'front');
}
