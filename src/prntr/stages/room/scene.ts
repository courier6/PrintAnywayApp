import { ART_AT } from './art';
import { SPRITES, type PalKey } from './palette';
import { H, Pix, W, parseSprite, rotateSprite, sliceRect, sliceRows, type Sprite } from './pixels';

export const SPR = {
  INFO: parseSprite(SPRITES.INFO),
  USB: parseSprite(SPRITES.USB),
  POINTER: parseSprite(SPRITES.POINTER),
  CROSS_V: parseSprite(SPRITES.CROSS_V),
  CROSS_H: parseSprite(SPRITES.CROSS_H),
  STAPLE: parseSprite(SPRITES.STAPLE),
  NUT: parseSprite(SPRITES.NUT),
  BOLT: parseSprite(SPRITES.BOLT),
  COOLER: parseSprite(SPRITES.COOLER),
  PLANT: parseSprite(SPRITES.PLANT),
  POSTER: parseSprite(SPRITES.POSTER),
  CLOCK: parseSprite(SPRITES.CLOCK),
  EXIT: parseSprite(SPRITES.EXIT),
  PAGE_SMALL: parseSprite(SPRITES.PAGE_SMALL),
  PAGE_PRINTED: parseSprite(SPRITES.PAGE_PRINTED),
  POSTER_TORN: parseSprite(SPRITES.POSTER_TORN),
  TANK_BROKEN: parseSprite(SPRITES.TANK_BROKEN),
  PLANT_BARE: parseSprite(SPRITES.PLANT_BARE),
  POT_BROKEN: parseSprite(SPRITES.POT_BROKEN),
  EXIT_BROKEN: parseSprite(SPRITES.EXIT_BROKEN),
  SPLAT: parseSprite(SPRITES.SPLAT),
  TUBE_HEAD: parseSprite(SPRITES.TUBE_HEAD),
  KIT: parseSprite(SPRITES.KIT),
  KIT_OPEN: parseSprite(SPRITES.KIT_OPEN),
};
/** The clock at each quarter turn, for rolling. */
const CLOCK_ROT = [0, 1, 2, 3].map((q) => rotateSprite(SPR.CLOCK, q));
/** The cooler below its bottle, the plant's leaves and its pot, so each half can break alone. */
const COOLER_BODY = sliceRows(SPR.COOLER, 8, 22);
const PLANT_TOP = sliceRows(SPR.PLANT, 0, 10);
const PLANT_POT = sliceRows(SPR.PLANT, 10, 16);

/** What the gun has broken: each stays broken for the rest of the stage. */
export interface Broken {
  /** Shot off the wall (it falls and rolls: `Clock`). */
  clock: boolean;
  poster: boolean;
  /** The cooler's bottle. */
  tank: boolean;
  /** The leaves. */
  plant: boolean;
  /** The pot. */
  vase: boolean;
  /** The first aid kit, shot open: it gave the player full health, once. */
  kit: boolean;
}

/**
 * The fire once the water jug has broken: it starts in the gap between
 * the cooler and the machine and grows over the cooler, then burns on. `u` is its growth,
 * `t` the frame's time for the flicker (0 = still).
 */
export interface Fire {
  u: number;
  t: number;
  /** How far it has spread onto the machine (0 none … 1 engulfed), once the machine is weak. */
  v: number;
}

/** The clock: shot, it falls off the wall to the floor in front of the cooler and
 * rolls to the left; near the burning cooler it catches fire and rolls on out of the frame. */
export interface Clock {
  state: 'up' | 'falling' | 'rolling' | 'rest' | 'burning' | 'gone';
  /** Its top-left corner once it is off the wall. */
  x: number;
  y: number;
  /** Quarter turns clockwise. */
  rot: number;
}

/** The EXIT sign: shot once it hangs loose from its left corner, shot again it falls. */
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

/** `up`: standing where it stands, drawn by `drawMachine`. `wreck`: burst into `pieces`. */
export type PrinterPose = 'up' | 'wreck';

/** A piece of the burst machine: its part of the machine's drawing and where it is now. */
export interface Piece {
  spr: Sprite;
  x: number;
  y: number;
}

/** Where a machine is drawn: the frame buffer, or a letter buffer for the pieces. */
export interface Painter {
  set(x: number, y: number, key: PalKey): void;
  rect(x0: number, y0: number, x1: number, y1: number, key: PalKey): void;
}

/** The machine this frame: its lid, its lamp, its panel. */
export interface Machine {
  /** The lid on its back hinge: 0 shut … 1 standing. */
  lid: number;
  /** The lamp's place along the glass, 0 (left) … 1 (right); null = off. */
  lamp: number | null;
  /** The bulb has been shot: the lamp is dead where it stopped. */
  lampOut: boolean;
  /** The flash: the glass and the lid white, light over the lid onto the wall. */
  flash: boolean;
  /** The panel is on: the display dark with text, the keys white (off: grey, blank). */
  power: boolean;
  /** The display's text and the button red (from the wake-up on) instead of green. */
  angry: boolean;
  /** How far back it stands: 0 in its place, 1 at the back of the room (two thirds the size, its
   * feet on 134). The beat brings it forward: the pounce. */
  back: number;
}

/** The machine's size and foot line at `back`. */
export const machineBack = (back: number): { sc: number; foot: number } => ({ sc: 1 - back / 3, foot: 146 - Math.round(12 * back) });

/** The machine: 96 wide at x 72, its top edge (the lid's hinge) at y 80, its feet on 146. */
export const MACHINE_AT = { x0: 72, y0: 80, x1: 168, y1: 146 };
/** The glass under the lid, and the standing lid's height. */
export const GLASS = { x0: 80, y0: 82, x1: 160, y1: 88 };
const LID_H = 24;
/** The top row of the standing lid at `lid` open (its hinge is the top edge, 80): it rises in front of the print. */
export const lidTop = (lid: number): number => MACHINE_AT.y0 - Math.round(LID_H * Math.sin((lid * Math.PI) / 2));
/** The lamp's left edge at u along the glass: 82 to 156, 3 px wide with a 2 px halo each side. */
export const lampX = (u: number): number => Math.round(82 + 74 * u);
/** The ink reservoirs on the back ledge, by their nozzle's x: the tubes rise from them, in their colour. */
export const NOZZLES: { x: number; color: 'c' | 'm' | 'y' }[] = [
  { x: 108, color: 'c' },
  { x: 120, color: 'm' },
  { x: 132, color: 'y' },
];

/** An ink particle on the far half of its flight, drawn behind the machine. */
export interface InkDot {
  x: number;
  y: number;
  size: number;
  color: PalKey;
}

/** Where a shot hit nothing to break: a dark hole in the wall or the ceiling,
 * a hole through the door or the window's blind (the stage lights those red). */
export interface Hole {
  x: number;
  y: number;
  kind: 'wall' | 'door' | 'window';
}

/** A hole in the door that the open door has swung away from: it is in the black doorway now. */
export function inDoorway(h: Hole, doorGap: number): boolean {
  return h.kind === 'door' && h.x + 1 > 13 && h.x - 1 <= 13 + doorGap;
}

/** An ink tube up from behind the machine: its x, its head's top row, the ink in its mouth. */
export interface Tube {
  x: number;
  top: number;
  color: PalKey;
}

export interface SceneState {
  /** Left, right fluorescent panel. */
  lights: [boolean, boolean];
  printer: PrinterPose;
  /** The machine's power light red (the beat after the USB goes in; the handoff reddened its sticker). */
  ledRed: boolean;
  trayPage: boolean;
  /** The USB stick still on the carpet (it starts the fight). */
  usb: boolean;
  /** The machine's lid, lamp and panel this frame (`printer === 'up'`). */
  machine: Machine;
  /** The machine drawn all white (the hit flash). */
  flashWhite: boolean;
  /** The red button on the panel, lit bright for a blink. */
  buttonBright: boolean;
  broken: Broken;
  clock: Clock;
  exit: ExitSign;
  /** How wide the door stands open on black, in px: ajar at 6; once the sign is down it swings in. */
  doorGap: number;
  fire: Fire | null;
  /** The mad machine's tremble: it is drawn this far off its place. */
  shake: { x: number; y: number };
  /** The ink in the air behind the machine this frame: the jets come up from behind it. */
  inkBehind: InkDot[];
  /** The ink tubes up this frame; drawn before the ink behind the machine and the machine. */
  tubes: Tube[];
  /** The x of each tube shot to pieces: its stump stays over the machine's top edge. */
  stubs: number[];
  /** The bullet holes, oldest first. */
  holes: Hole[];
  /** The window's blind shot to pieces: a gaping hole, the red behind it. */
  windowOpen: boolean;
  /** The burst machine's pieces, where they are this frame (printer `wreck`). */
  pieces: Piece[];
  /** How much of the machine's health is gone, 0..1: it wears with it. */
  damage: number;
}

/** Where the clock hangs (16×15) and where the post-it board does (20×18): swapped, the
 * board lower than the clock and next to the window. liminal.py had the
 * board at 66,40 and the clock at 112,36. */
export const CLOCK_AT = { x: 68, y: 41 };
export const BOARD_AT = { x: 136, y: 46 };
/** The first aid kit (13×10), on the wall at the lower right of the window. */
export const KIT_AT = { x: 226, y: 79 };

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
export function drawFlame(p: Pix, cx: number, w: number, h: number, floor: number, seed: number, t: number): void {
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
 * them: `back`, two smaller flames behind the cooler on the floor further in (they
 * come as the fire grows and round it out); `mid`, the main flame, in front of the cooler
 * and behind the machine. The third, `drawFireFront`, goes on the stage's front canvas.
 */
function drawFire(p: Pix, f: Fire, layer: 'back' | 'mid'): void {
  const r = fireRect(f.u);
  const h = r.y1 - r.y0;
  if (layer === 'mid') drawFlame(p, (r.x0 + r.x1) / 2, (r.x1 - r.x0) / 2, h, r.y1, 0, f.t);
  else {
    drawFlame(p, 50, 7 * later(f.u, 0.35), 0.9 * h * later(f.u, 0.35), 142, 100, f.t);
    drawFlame(p, 70, 6 * later(f.u, 0.55), 0.95 * h * later(f.u, 0.55), 142, 200, f.t);
  }
}

/**
 * The fire's front layer: a low lick at the machine's foot and the cooler's base, and the
 * flames on the machine once it spreads. Drawn on the front canvas, so
 * they are in front of the slot's red light like the pages, under the things the machine throws.
 */
export function drawFireFront(p: Pix, f: Fire): void {
  const r = fireRect(f.u);
  const h = r.y1 - r.y0;
  drawFlame(p, 76, 5 * later(f.u, 0.2), 0.3 * h * later(f.u, 0.2), 146, 300, f.t);
  // onto the machine from its left side, until the whole of it is in flames (72–168 × 80–146)
  if (f.v > 0) drawFlame(p, 80 + 40 * f.v, 8 + 42 * f.v, 20 + 48 * f.v, 146, 400, f.t);
}

/**
 * What is left of the blind once it is shot open, drawn over the window's red light (on the
 * stage's front layer): the head rail, a strip hanging at each side, a slat torn loose and
 * hanging askew from the top, and a piece of the bottom slat. Nothing left of x 167 below y 79,
 * where the machine's corner stands in front of the window.
 */
export function drawWindowWreck(p: Pix): void {
  p.rect(163, 39, 221, 41, 's');
  p.rect(163, 41, 221, 42, 'a');
  // the left strip, ragged at its end
  p.rect(163, 42, 167, 62, 's');
  for (let y = 45; y < 62; y += 4) p.rect(163, y, 167, y + 1, 'a');
  p.set(164, 62, 's');
  p.set(165, 63, 's');
  // the right strip, shorter
  p.rect(215, 42, 221, 54, 's');
  for (let y = 45; y < 54; y += 4) p.rect(215, y, 221, y + 1, 'a');
  p.set(217, 54, 's');
  p.set(218, 55, 's');
  p.set(220, 54, 's');
  // a slat hanging from its left end, down to the right
  for (let i = 0; i < 18; i++) {
    const y = 42 + Math.floor(i / 2);
    p.set(181 + i, y, 's');
    p.set(181 + i, y + 1, 'a');
  }
  // the bottom slat's right half
  p.rect(196, 85, 221, 87, 's');
  p.rect(196, 85, 221, 86, 'a');
}

/** A one-pixel line from (x0,y0) to (x1,y1). */
function line(p: Pix, x0: number, y0: number, x1: number, y1: number, key: PalKey): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) p.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), key);
}

/** The machine's wear, in px off the 3× pose's corner, by the damage that brings each on. */
const CRACKS: { at: number; pts: [number, number][] }[] = [
  { at: 0.25, pts: [[10, 4], [14, 9], [12, 15], [17, 20], [15, 26]] },
  { at: 0.5, pts: [[80, 30], [76, 36], [79, 42], [74, 48], [77, 55], [73, 61]] },
  { at: 0.5, pts: [[58, 9], [62, 14], [59, 19]] },
  { at: 0.75, pts: [[40, 0], [44, 6], [41, 12], [47, 18], [45, 25]] },
  { at: 0.75, pts: [[20, 28], [26, 34], [22, 41], [30, 47], [27, 55], [33, 62]] },
];
/** Scorch marks on the body, from half the damage on. */
const SCORCH: [number, number][] = [[14, 50], [15, 51], [17, 53], [16, 55], [19, 56], [13, 57], [21, 58], [18, 60], [84, 46], [86, 48], [83, 50]];

/**
 * The machine wearing as its health goes: at a quarter of the damage a crack
 * down the lid's left; at half a crack down the right of the body with a scorched patch on the
 * lower left and a nick in the band; at three quarters a crack through the lid into the body, a
 * long one across the body, and the lid's right corner knocked out to the wall behind.
 */
function drawWear(p: Pix, x: number, y: number, damage: number, wall: PalKey): void {
  if (damage >= 0.75) {
    for (let r = 0; r < 9; r++) p.rect(x + 82 + Math.floor(r * 1.3), y + r, x + 94, y + r + 1, wall);
    line(p, x + 82, y, x + 93, y + 8, 'K');
    line(p, x + 94, y + 8, x + 94, y + 9, 'K');
  }
  if (damage >= 0.5) for (const [sx, sy] of SCORCH) p.set(x + sx, y + sy, 'G');
  for (const c of CRACKS) {
    if (damage < c.at) continue;
    for (let i = 1; i < c.pts.length; i++) {
      line(p, x + c.pts[i - 1][0], y + c.pts[i - 1][1], x + c.pts[i][0], y + c.pts[i][1], 'K');
      line(p, x + c.pts[i - 1][0] + 1, y + c.pts[i - 1][1], x + c.pts[i][0] + 1, y + c.pts[i][1], 'd');
    }
    for (let i = 1; i < c.pts.length; i++) line(p, x + c.pts[i - 1][0], y + c.pts[i - 1][1], x + c.pts[i][0], y + c.pts[i][1], 'K');
  }
}

/** What `drawMachine` reads of the scene. */
export type MachineScene = Pick<SceneState, 'machine' | 'shake' | 'flashWhite' | 'ledRed' | 'buttonBright' | 'trayPage'>;

/**
 * The machine at the room's resolution (the sheet's pick, PRNTR-FIGHT-DESIGN.md §9.8): a top
 * surface with the glass under a lid on its back hinge, the panel with the display, the keys,
 * the power light and the button, the output opening, two drawers, three ink caps on the back
 * ledge. The lid stands up for a scan; the lamp sweeps the glass and lights the lid's
 * underside; the flash whites the top and throws light over the lid. Shifted by `shake`; all
 * white for the hit flash.
 */
export function drawMachine(p: Painter, s: MachineScene): void {
  const { x: ox, y: oy } = s.shake;
  const m = s.machine;
  const q: Painter = s.flashWhite ? { set: (x, y) => p.set(x, y, 'W'), rect: (x0, y0, x1, y1) => p.rect(x0, y0, x1, y1, 'W') } : p;
  const set = (x: number, y: number, k: PalKey) => q.set(x + ox, y + oy, k);
  const rect = (x0: number, y0: number, x1: number, y1: number, k: PalKey) => q.rect(x0 + ox, y0 + oy, x1 + ox, y1 + oy, k);
  const box = (x0: number, y0: number, x1: number, y1: number, k: PalKey) => {
    rect(x0, y0, x1, y0 + 1, k);
    rect(x0, y1 - 1, x1, y1, k);
    rect(x0, y0, x0 + 1, y1, k);
    rect(x1 - 1, y0, x1, y1, k);
  };
  const panel = (x0: number, y0: number, x1: number, y1: number, fill: PalKey) => {
    rect(x0, y0, x1, y1, fill);
    box(x0, y0, x1, y1, 'K');
  };
  const dither = (x0: number, y0: number, x1: number, y1: number, k: PalKey, phase: number) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (((x + y + phase) & 1) === 0) set(x, y, k);
  };
  // the shadow on the carpet (the window is the light), the feet
  p.rect(84 + ox, 146 + oy, 176 + ox, 152 + oy, 'X');
  rect(74, 143, 82, 146, 'K');
  rect(158, 143, 166, 146, 'K');
  // the front face, and the top surface we look slightly down on
  panel(72, 89, 168, 143, 'b');
  panel(72, 80, 168, 90, 'd');
  // the panel: a bar across the top of the face with the display, the keys, the power light, the button
  rect(73, 104, 167, 105, 'K');
  panel(78, 92, 106, 103, m.power ? 'i' : 'G');
  if (m.power) {
    const k: PalKey = m.angry ? 'Q' : 'n';
    rect(80, 94, 96, 95, k);
    rect(80, 97, 102, 98, k);
    rect(80, 100, 90, 101, k);
  }
  for (let i = 0; i < 4; i++) panel(112 + i * 6, 95, 116 + i * 6, 99, m.power ? 'w' : 'T');
  rect(112, 101, 114, 103, s.ledRed ? 'R' : 'K');
  // the button: green while the room is quiet, red once the machine is angry, bright for a blink
  panel(146, 93, 162, 102, s.buttonBright ? 'Q' : m.angry ? 'R' : 'n');
  if (s.buttonBright) rect(148, 94, 160, 95, 'W');
  // the output: a dark opening under the panel, the page in it while there is one
  panel(78, 107, 162, 115, 'G');
  if (s.trayPage) rect(86, 110, 154, 114, 'w');
  // two drawers with handles, and the side seams
  for (const dy of [119, 129]) {
    panel(76, dy, 164, dy + 8, 'b');
    rect(78, dy + 1, 162, dy + 2, 'w');
    rect(110, dy + 4, 130, dy + 6, 'K');
  }
  rect(73, 90, 74, 143, 'd');
  rect(166, 90, 167, 143, 'g');
  // the ink caps on the back ledge; the shut lid covers their lower rows
  for (const n of NOZZLES) panel(n.x - 3, 77, n.x + 3, 81, n.color);
  if (m.lid < 0.05) {
    // shut: a lighter slab on the top with a rim and the handle on its front edge
    panel(76, 80, 164, 90, 'T');
    rect(78, 81, 162, 82, 'w');
    rect(114, 87, 126, 89, 'K');
    rect(115, 87, 125, 88, 'g');
    return;
  }
  // open: the glass, lit while the lamp is on; the lid standing up behind it, its pad showing
  const lit = m.lamp !== null && !m.lampOut;
  rect(GLASS.x0, GLASS.y0, GLASS.x1, GLASS.y1, m.flash ? 'W' : lit ? 'L' : 'l');
  box(79, 81, 161, 89, 'K');
  const ly0 = lidTop(m.lid);
  const h = 80 - ly0;
  if (h > 2) {
    panel(76, ly0, 164, 81, m.flash ? 'W' : 'T');
    rect(79, ly0 + 2, 161, 79, m.flash ? 'W' : 'd');
    // the handle, now on the standing lid's top edge; the hinges at its foot
    rect(114, ly0 - 2, 126, ly0 + 1, 'K');
    rect(115, ly0 - 2, 125, ly0 - 1, 'g');
    rect(78, 80, 82, 82, 'K');
    rect(158, 80, 162, 82, 'K');
  }
  if (m.lamp !== null && !m.flash) {
    const hx = lampX(m.lamp);
    if (m.lampOut) rect(hx, GLASS.y0, hx + 3, GLASS.y1, 'G');
    else {
      // the lamp: a white band with a cyan halo, its light in a cone up the lid's pad
      rect(hx, GLASS.y0, hx + 3, GLASS.y1, 'W');
      rect(Math.max(GLASS.x0, hx - 2), GLASS.y0, hx, GLASS.y1, 'c');
      rect(hx + 3, GLASS.y0, Math.min(GLASS.x1, hx + 5), GLASS.y1, 'c');
      if (h > 2) {
        for (let y = 79; y > ly0 + 1; y--) {
          const sp = Math.round((81 - y) * 0.9) + 2;
          dither(Math.max(79, hx - sp), y, Math.min(161, hx + 3 + sp), y + 1, 'L', y);
          rect(Math.max(79, hx - Math.round(sp / 3)), y, Math.min(161, hx + 3 + Math.round(sp / 3)), y + 1, 'L');
        }
        rect(hx, ly0 + 2, hx + 3, 79, 'W');
      }
      // the light leaking out to the sides, onto the top's corners
      dither(73, 81, 79, 89, 'L', 0);
      dither(161, 81, 167, 89, 'L', 1);
    }
  }
  if (m.flash) {
    // the flash: the whole top white, light over the top of the lid onto the wall and the ceiling
    rect(73, 81, 167, 89, 'W');
    for (let y = ly0 - 1; y > ly0 - 26; y--) {
      const sp = Math.round((ly0 - y) * 1.2);
      dither(80 - sp, y, 160 + sp, y + 1, 'W', y);
    }
    for (let y = ly0 - 1; y > ly0 - 12; y--) {
      const sp = Math.round((ly0 - y) * 0.5);
      rect(88 - sp, y, 152 + sp, y + 1, 'W');
    }
  }
}

/** A letter buffer the machine is drawn into once, for its pieces: the body's 96×66 at 72,80. */
class LetterPix implements Painter {
  readonly rows: string[][];
  constructor(
    private readonly ox: number,
    private readonly oy: number,
    readonly w: number,
    readonly h: number,
  ) {
    this.rows = Array.from({ length: h }, () => new Array<string>(w).fill('.'));
  }
  set(x: number, y: number, key: PalKey): void {
    const px = x - this.ox;
    const py = y - this.oy;
    if (px >= 0 && py >= 0 && px < this.w && py < this.h) this.rows[py][px] = key;
  }
  rect(x0: number, y0: number, x1: number, y1: number, key: PalKey): void {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.set(x, y, key);
  }
  clear(): void {
    for (const r of this.rows) r.fill('.');
  }
  sprite(): Sprite {
    return { w: this.w, h: this.h, rows: this.rows.map((r) => r.join('')) };
  }
}

/** The machine drawn full size here (its shadow and standing lid included), to be sampled smaller when it stands back. */
const BACK_PIX = new LetterPix(MACHINE_AT.x0, 40, 104, 112);

/**
 * The machine standing back: drawn full size into BACK_PIX, then every pixel of that put down
 * at `sc` about the foot line's centre (120, `foot`), each covering the cell it maps onto (at
 * least one px, so the outlines never drop out). Nearest neighbour; the shake applies after.
 */
function drawMachineBack(p: Pix, s: MachineScene): void {
  const { sc, foot } = machineBack(s.machine.back);
  BACK_PIX.clear();
  drawMachine(BACK_PIX, { ...s, shake: { x: 0, y: 0 } });
  const cx = 120;
  const { x: ox, y: oy } = s.shake;
  for (let y = 0; y < BACK_PIX.h; y++) {
    const row = BACK_PIX.rows[y];
    const sy = y + 40;
    const dy = Math.round(foot + (sy - MACHINE_AT.y1) * sc);
    const h = Math.max(1, Math.round(foot + (sy + 1 - MACHINE_AT.y1) * sc) - dy);
    for (let x = 0; x < BACK_PIX.w; x++) {
      const k = row[x];
      if (k === '.') continue;
      const sx = x + MACHINE_AT.x0;
      const dx = Math.round(cx + (sx - cx) * sc);
      const w = Math.max(1, Math.round(cx + (sx + 1 - cx) * sc) - dx);
      p.rect(dx + ox, dy + oy, dx + w + ox, dy + h + oy, k as PalKey);
    }
  }
}

/** The machine as it is drawn in the fight, shut and angry, as a sprite: what bursts. */
const MACHINE_SPRITE: Sprite = (() => {
  const lp = new LetterPix(MACHINE_AT.x0, MACHINE_AT.y0, MACHINE_AT.x1 - MACHINE_AT.x0, MACHINE_AT.y1 - MACHINE_AT.y0);
  drawMachine(lp, {
    machine: { lid: 0, lamp: null, lampOut: false, flash: false, power: true, angry: true, back: 0 },
    shake: { x: 0, y: 0 },
    flashWhite: false,
    ledRed: true,
    buttonBright: false,
    trayPage: false,
  });
  return lp.sprite();
})();

/** The machine cut into eight: the top with the lid, the panel in two, the body in three above
 * and two below, with each part's home offset in px from the machine's corner (72,80). */
export const MACHINE_PIECES: { spr: Sprite; hx: number; hy: number }[] = (
  [
    [0, 0, 96, 10],
    [0, 10, 48, 27],
    [48, 10, 96, 27],
    [0, 27, 33, 48],
    [33, 27, 66, 48],
    [66, 27, 96, 48],
    [0, 48, 48, 66],
    [48, 48, 96, 66],
  ] as const
).map(([x0, y0, x1, y1]) => ({ spr: sliceRect(MACHINE_SPRITE, x0, y0, x1, y1), hx: x0, hy: y0 }));

/** A wall hole is a dark cross; a door or blind hole goes through to the black behind. */
function drawHoles(p: Pix, s: SceneState): void {
  for (const h of s.holes) {
    if (h.kind === 'wall') {
      p.set(h.x - 1, h.y, 'X');
      p.set(h.x + 1, h.y, 'X');
      p.set(h.x, h.y - 1, 'X');
      p.set(h.x, h.y + 1, 'X');
      p.set(h.x, h.y, 'K');
    } else if (!inDoorway(h, s.doorGap) && !(h.kind === 'window' && s.windowOpen)) {
      p.rect(h.x - 1, h.y - 1, h.x + 1, h.y + 1, 'z');
    }
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
  // the wall art between the clock and the board: a wooden frame with a pale
  // mat; the print itself is the stage's art canvas over the rect inside (a plum fallback under it)
  p.rect(ART_AT.x - 2, ART_AT.y - 2, ART_AT.x + ART_AT.w + 2, ART_AT.y + ART_AT.h + 2, 'K');
  p.rect(ART_AT.x - 1, ART_AT.y - 1, ART_AT.x + ART_AT.w + 1, ART_AT.y + ART_AT.h + 1, 'D');
  p.rect(ART_AT.x, ART_AT.y, ART_AT.x + ART_AT.w, ART_AT.y + ART_AT.h, 'K');
  // the clock where the board was, the post-it board lower and by the window
  if (s.clock.state === 'up') p.blit(CLOCK_AT.x, CLOCK_AT.y, SPR.CLOCK);
  p.blit(BOARD_AT.x, BOARD_AT.y, s.broken.poster ? SPR.POSTER_TORN : SPR.POSTER);
  // the window: light, blinds, nothing outside; shot open, the black the red light fills
  p.rect(160, 36, 224, 90, 'e');
  if (s.windowOpen) {
    p.rect(163, 39, 221, 87, 'z');
    // the slats that came down, on the baseboard and the carpet under the window
    p.rect(170, 108, 178, 109, 's');
    p.rect(181, 111, 186, 112, 'a');
    p.rect(188, 109, 196, 110, 's');
    p.rect(176, 113, 181, 114, 's');
  } else {
    p.rect(163, 39, 221, 87, 's');
    for (let y = 41; y < 87; y += 4) p.rect(163, y, 221, y + 1, 'a');
  }
  // the first aid kit by the window's lower right corner, green where a kit is red
  p.blit(KIT_AT.x, KIT_AT.y, s.broken.kit ? SPR.KIT_OPEN : SPR.KIT);
  // the bullet holes, under the cooler, the plant and the machine, which stand in front of the wall
  drawHoles(p, s);
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
  // the clock off the wall: falling, rolling or lying in front of the cooler, burning as it goes
  const ck = s.clock;
  if (ck.state !== 'up' && ck.state !== 'gone') {
    const spr = CLOCK_ROT[((ck.rot % 4) + 4) % 4];
    const x = Math.round(ck.x);
    const y = Math.round(ck.y);
    p.blit(x, y, spr);
    if (ck.state === 'burning') drawFlame(p, x + spr.w / 2, spr.w / 2 - 1, 14, y + spr.h, 500, s.fire?.t ?? 0);
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
  // the ink tubes up from behind the machine: a ribbed hose, its head, the ink in its mouth;
  // the machine covers the hose's foot, the ink in the air is drawn over them
  for (const tb of s.tubes) {
    p.rect(tb.x - 2, tb.top + 4, tb.x - 1, 90, 'K');
    p.rect(tb.x + 1, tb.top + 4, tb.x + 2, 90, 'K');
    for (let y = tb.top + 4; y < 90; y++) p.rect(tb.x - 1, y, tb.x + 1, y + 1, (y - tb.top) % 2 === 0 ? 'G' : 'i');
    p.blit(tb.x - 3, tb.top, SPR.TUBE_HEAD, 1, { remap: { c: tb.color } });
  }
  // the stumps of the tubes shot to pieces: a ragged end of hose just over the edge
  for (const x of s.stubs) {
    p.rect(x - 2, 77, x + 2, 90, 'K');
    p.rect(x - 1, 78, x + 1, 90, 'i');
    p.set(x - 2, 77, 'A');
    p.set(x + 1, 77, 'A');
    p.set(x, 78, 'G');
  }
  // the ink sprayed from behind the machine, where it is still behind it
  for (const d of s.inkBehind) p.rect(d.x, d.y, d.x + d.size, d.y + d.size, d.color);
  // the printer; its shadow falls the other way. Nothing points it out.
  if (s.printer === 'wreck') {
    // the burst machine: its pieces in the air and on the floor, the fire raging where it stood
    for (const pc of s.pieces) p.blit(Math.round(pc.x), Math.round(pc.y), pc.spr);
  } else if (s.machine.back > 0) {
    // standing back, before the pounce: smaller, higher on the carpet (no wear yet)
    drawMachineBack(p, s);
  } else {
    drawMachine(p, s);
    if (!s.flashWhite) drawWear(p, MACHINE_AT.x0 + s.shake.x, MACHINE_AT.y0 + s.shake.y, s.damage, s.lights[1] ? 'A' : 'a');
  }
  // the USB stick on the carpet, right of the machine, with its shadow
  if (s.usb) {
    p.rect(174, 146, 190, 148, 'X');
    p.blit(172, 136, SPR.USB, 2);
  }
}
