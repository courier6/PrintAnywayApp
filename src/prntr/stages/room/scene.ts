import { ART_AT } from './art';
import { SPRITES, type PalKey } from './palette';
import { H, Pix, W, parseSprite, rotateSprite, sliceRect, type Sprite } from './pixels';

export const SPR = {
  INFO: parseSprite(SPRITES.INFO),
  USB: parseSprite(SPRITES.USB),
  BADGE: parseSprite(SPRITES.BADGE),
  BADGE_SHOT: parseSprite(SPRITES.BADGE_SHOT),
  PHOTO: parseSprite(SPRITES.PHOTO),
  POINTER: parseSprite(SPRITES.POINTER),
  CROSS_V: parseSprite(SPRITES.CROSS_V),
  CROSS_H: parseSprite(SPRITES.CROSS_H),
  STAPLE: parseSprite(SPRITES.STAPLE),
  NUT: parseSprite(SPRITES.NUT),
  BOLT: parseSprite(SPRITES.BOLT),
  COOLER: parseSprite(SPRITES.COOLER),
  MONSTERA: parseSprite(SPRITES.MONSTERA),
  POSTER: parseSprite(SPRITES.POSTER),
  CLOCK: parseSprite(SPRITES.CLOCK),
  EXIT: parseSprite(SPRITES.EXIT),
  PAGE_SMALL: parseSprite(SPRITES.PAGE_SMALL),
  PAGE_PRINTED: parseSprite(SPRITES.PAGE_PRINTED),
  POSTER_TORN: parseSprite(SPRITES.POSTER_TORN),
  COOLER_SHOT: parseSprite(SPRITES.COOLER_SHOT),
  MONSTERA_BARE: parseSprite(SPRITES.MONSTERA_BARE),
  MONSTERA_DOWN: parseSprite(SPRITES.MONSTERA_DOWN),
  FIG: parseSprite(SPRITES.FIG),
  FIG_BARE: parseSprite(SPRITES.FIG_BARE),
  FIG_POT: parseSprite(SPRITES.FIG_POT),
  FIG_SHARDS: parseSprite(SPRITES.FIG_SHARDS),
  EXIT_BROKEN: parseSprite(SPRITES.EXIT_BROKEN),
  SPLAT: parseSprite(SPRITES.SPLAT),
  TUBE_HEAD: parseSprite(SPRITES.TUBE_HEAD),
  KIT: parseSprite(SPRITES.KIT),
  KIT_OPEN: parseSprite(SPRITES.KIT_OPEN),
};
/** The clock at each quarter turn, for rolling. */
const CLOCK_ROT = [0, 1, 2, 3].map((q) => rotateSprite(SPR.CLOCK, q));
/** The cooler below its bottle, the plant's leaves and its pot, so each half can break alone. */

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
  /** The first aid kit (a pouch), shot open: it gave the player full health, once. */
  kit: boolean;
  /** The fig's leaves, shot off. */
  fig: boolean;
  /** The fig's planter, shot: the tree collapses toward the machine. */
  figPot: boolean;
}

/** The fig after its planter is shot: how far it has fallen (0 standing … 1 leaning on the machine), and
 * whether it has caught from the fire and burns. */
export interface Fig {
  fall: number;
  burning: boolean;
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
  /** The frame's time in ms, for the angry display's flicker (0 = still). */
  t: number;
  /** The black cartridge has failed: ms the NO BLACK INK error has been up, or null. */
  error: number | null;
  /** Lifted off the carpet for the slam, px (the body goes up with `shake`; the shadow stays down
   * and spreads a px a side for each). */
  lift: number;
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
/** The ink reservoirs on the back ledge, by their nozzle's x: the tubes rise from them, in their colour.
 * The fourth is black, and empty: its tube comes up, coughs, and the display says so. */
export const NOZZLES: { x: number; color: 'c' | 'm' | 'y' | 'z' }[] = [
  { x: 108, color: 'c' },
  { x: 120, color: 'm' },
  { x: 132, color: 'y' },
  { x: 144, color: 'z' },
];

/** An ink particle on the far half of its flight, drawn behind the machine. */
export interface InkDot {
  x: number;
  y: number;
  size: number;
  color: PalKey;
}

/** Where a shot hit nothing to break: a dark hole in the wall or the ceiling,
 * a hole through the door or the window's blind (the storm shows through those). */
export interface Hole {
  x: number;
  y: number;
  kind: 'wall' | 'door' | 'window';
}

/** A mark on the glass, the player's side: a staple that punched in and stayed, or a bolt that stuck
 * point first (PRNTR-PLANNING.md P1.A, P1.C). Drawn on the front layer; the oldest go past the cap. */
export interface Mark {
  kind: 'staple' | 'bolt';
  x: number;
  y: number;
}

/** Where a mark on the glass can be shot off: a staple's crown and its legs, a bolt's head (±1 px). */
export function markBox(m: Mark): { x0: number; y0: number; x1: number; y1: number } {
  const cx = Math.floor(m.x);
  const cy = Math.floor(m.y);
  return m.kind === 'staple' ? { x0: cx - 18, y0: cy - 5, x1: cx + 18, y1: cy + 9 } : { x0: cx - 15, y0: cy - 15, x1: cx + 15, y1: cy + 15 };
}

/** The blind's slats: one every BLIND_PITCH rows from BLIND_TOP, three rows of slat and a 2 px gap on the storm. */
export const BLIND_TOP = 39;
export const BLIND_PITCH = 5;

/** The door's knob, a 3×3 brass ball with a highlight and a shadow (4×4 drawn): near the door's free (left) edge,
 * moving with it as the door swings in on its right hinge. */
export const KNOB = { y: 76, w: 3, h: 3 };
export const knobX = (doorGap: number): number => 16 + Math.min(doorGap, 22);

/** A hole in the door that the open door has swung away from: it is in the black doorway now. */
export function inDoorway(h: Hole, doorGap: number): boolean {
  return h.kind === 'door' && h.x + 1 > 13 && h.x - 1 <= 13 + doorGap;
}

/** An ink tube up from behind the machine: its nozzle's x, its head's top row, the ink in its
 * mouth, and its reach: how far the head has turned toward the cross (px, either side of the cap),
 * the hose bending after it from the cap in a smooth curve (0 = straight; PRNTR-PLANNING.md P1.D). */
export interface Tube {
  x: number;
  top: number;
  color: PalKey;
  reach: number;
}

/** The hose's centre at row y: straight at the machine's edge (90), bent toward the head by the square of the way up. */
export const tubeX = (tb: Tube, y: number): number => {
  const u = Math.max(0, Math.min(1, (90 - y) / Math.max(1, 90 - tb.top)));
  return Math.round(tb.x + tb.reach * u * u);
};

export interface SceneState {
  /** Left, right fluorescent panel. */
  lights: [boolean, boolean];
  /** The lit panels are red (the mad machine's shaking at RED_LIGHTS_FROM of its damage), not white. */
  lightsRed: boolean;
  /** The weeping fig by the window. */
  fig: Fig;
  printer: PrinterPose;
  /** The machine's power light red (the beat after the USB goes in; the handoff reddened its sticker). */
  ledRed: boolean;
  trayPage: boolean;
  /** The USB stick still on the carpet (it starts the fight). */
  usb: boolean;
  /** The badge: on the carpet, clipped on (the name set), or shot to pieces. */
  badge: 'floor' | 'taken' | 'shot';
  /** The machine's lid, lamp and panel this frame (`printer === 'up'`). */
  machine: Machine;
  /** The machine drawn all white (the hit flash). */
  flashWhite: boolean;
  /** The red button on the panel, lit bright for a blink. */
  buttonBright: boolean;
  broken: Broken;
  clock: Clock;
  /** The clock's hands spinning out of control while the machine shakes: ms into the spin, or null (still, 1:37). */
  clockSpin: number | null;
  exit: ExitSign;
  /** How wide the door stands open on the storm, in px: 0 shut; up to 22 swung in (its knob shot, or the sign down). */
  doorGap: number;
  /** The door shot apart (the twelfth hole): gone, its planks on the carpet, the doorway full of storm. */
  doorBroken: boolean;
  /** The storm outside this frame. */
  storm: StormView;
  fire: Fire | null;
  /** The mad machine's tremble (and the pounce's landing): the machine and everything attached to
   * it (the tubes, the stumps, the ink still behind it) are drawn this far off their place. */
  shake: { x: number; y: number };
  /** The ink in the air behind the machine this frame: the jets come up from behind it. */
  inkBehind: InkDot[];
  /** The ink tubes up this frame; drawn before the ink behind the machine and the machine. */
  tubes: Tube[];
  /** The x of each tube shot to pieces: its stump stays over the machine's top edge. */
  stubs: number[];
  /** The bullet holes, oldest first. */
  holes: Hole[];
  /** The marks on the glass (staples stuck in, bolts stuck point first), oldest first; the front layer. */
  marks: Mark[];
  /** The window's blind shot to pieces: a gaping hole, the storm behind it. */
  windowOpen: boolean;
  /** The burst machine's pieces, where they are this frame (printer `wreck`). */
  pieces: Piece[];
  /** How much of the machine's health is gone, 0..1: it wears with it. */
  damage: number;
}

/** Where the clock hangs (16×15) and where the post-it board does (20×18): swapped, the
 * board lower than the clock and next to the window. liminal.py had the
 * board at 66,40 and the clock at 112,36. */
export const CLOCK_AT = { x: 50, y: 41 };
export const BOARD_AT = { x: 136, y: 46 };
/** The water cooler (22×46), and with its bottle shot (22×33): at the room's own resolution. */
export const COOLER_AT = { x: 51, y: 90 };
export const COOLER_SHOT_AT = { x: 51, y: 103 };
/** The weeping fig by the window, behind the monstera: its tree (or bare) and its planter (or the shards); it
 * falls about FIG_AT.pivot, the foot of its trunk, by up to FIG_LEAN radians toward the machine, and comes to
 * rest against the machine's back right corner (the machine is drawn after it, in front). */
export const FIG_AT = { tree: { x: 166, y: 52 }, bare: { x: 166, y: 52 }, pot: { x: 181, y: 116 }, shards: { x: 177, y: 121 }, pivot: { x: 192, y: 126 } };
export const FIG_LEAN = 0.5;
/** The fig's crown, for the flames when it burns: its centre on the standing tree. */
const FIG_CROWN = { x: 192, y: 72 };
/** A leaf of the standing fig at (x, y), or within a px of it: its crown is shot only there, and a shot through its
 * gaps goes on to the blind behind. */
export function figLeaf(x: number, y: number): boolean {
  const s = SPR.FIG;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const k = s.rows[Math.floor(y) + dy - FIG_AT.tree.y]?.[Math.floor(x) + dx - FIG_AT.tree.x];
      if (k === 'V' || k === 'v' || k === 'n') return true;
    }
  }
  return false;
}

/** Blits a sprite turned by a radians toward the left (its top going left) about a pivot: each pixel of the
 * turned box takes the sprite pixel that turns onto it (nearest), so nothing gaps. */
export function blitLeaning(p: Pix, x0: number, y0: number, s: Sprite, pivot: { x: number; y: number }, a: number): void {
  const c = Math.cos(a), sn = Math.sin(a);
  const corners = [[x0, y0], [x0 + s.w, y0], [x0, y0 + s.h], [x0 + s.w, y0 + s.h]].map(([x, y]) => { const dx = x - pivot.x, dy = y - pivot.y; return [pivot.x + dx * c + dy * sn, pivot.y - dx * sn + dy * c]; });
  const bx0 = Math.floor(Math.min(...corners.map((q) => q[0]))), bx1 = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const by0 = Math.floor(Math.min(...corners.map((q) => q[1]))), by1 = Math.ceil(Math.max(...corners.map((q) => q[1])));
  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      const dx = x + 0.5 - pivot.x, dy = y + 0.5 - pivot.y;
      const sx = Math.floor(pivot.x + dx * c - dy * sn) - x0, sy = Math.floor(pivot.y + dx * sn + dy * c) - y0;
      if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
      const k = s.rows[sy][sx];
      if (k !== '.') p.set(x, y, k as PalKey);
    }
  }
}

/** The monstera by the window, whole, its leaves shot off, and down with its pot shot: at the room's own resolution. */
export const MONSTERA_AT = { whole: { x: 191, y: 94 }, bare: { x: 194, y: 101 }, down: { x: 183, y: 125 } };
/** The USB stick on the carpet, its lanyard and its shadow (39×8, at the room's own resolution). */
export const USB_AT = { x: 157, y: 138 };
/** The staff badge on the carpet by the door (PRNTR-BADGE.md). */
export const BADGE_AT = { x: 8, y: 120 };
/** The first aid kit (13×10), a green pouch hanging on the wall at the lower right of the window. */
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

/** The storm this frame: the rain's time (0 = still), the near flash 0..1, the far flicker 0..1, the bolt. */
export interface StormView {
  t: number;
  near: number;
  far: number;
  bolt: { x: number; seed: number } | null;
}
/** A half-open rect in room px. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** The horizon outside, in room px: the forest stands on it, the lot is below it. */
const HORIZON = 66;

/**
 * The storm seen through an opening `r` (the storm sheet's S3, PRNTR-PLANNING.md P5): the night sky
 * (white under a near flash, then pale blue, the afterglow's dark blue), a bank of cloud across the
 * top drifting right (its underside lit by far lightning), under a near flash the title's place (the
 * forest along the horizon, the lot with its stalls and light poles, the office block off to the
 * right, a road in from the left), the bolt down to the horizon, and the rain: steep streaks in water
 * blue, lit in a flash. The world outside is one world: the same place whichever opening shows it.
 */
export function drawStorm(p: Pix, r: Rect, s: StormView): void {
  const { t, near, far } = s;
  const sky: PalKey = near > 0.6 ? 'W' : near > 0.25 ? 'j' : near > 0 ? 'U' : 'N';
  p.rect(r.x0, r.y0, r.x1, r.y1, sky);
  const inR = (x: number, y: number) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
  // the lines (the road, the bolt) clipped to the opening, so none of them lands on the door or the wall around a hole
  const q = { set: (px: number, py: number, k: PalKey) => inR(px, py) && p.set(px, py, k) };
  // the clouds
  const lit = far > 0 && near === 0;
  const d = Math.floor(t / 120);
  for (let y = r.y0; y < Math.min(r.y1, 56); y++) {
    for (let x = r.x0; x < r.x1; x++) {
      const hsh = hash(Math.floor((x - d * 0.25) / 6) * 31 + Math.floor(y / 4) * 7);
      const bottom = 44 + Math.round(8 * hash(Math.floor((x - d * 0.25) / 8)));
      if (y < bottom && hsh < 0.85) p.set(x, y, near > 0.25 ? 'U' : lit && y > bottom - 4 ? 'U' : 'M');
    }
  }
  if (near > 0) {
    // the place: the forest on the horizon, the lot, the block, the road, the poles
    for (let x = r.x0; x < r.x1; x++) {
      const tree = 58 + Math.round(6 * hash(Math.floor(x / 5) * 13)) + (hash(x * 7) < 0.3 ? -2 : 0);
      for (let y = Math.max(r.y0, tree); y <= Math.min(r.y1 - 1, HORIZON); y++) p.set(x, y, 'J');
    }
    p.rect(r.x0, Math.max(r.y0, HORIZON), r.x1, r.y1, 'M');
    for (let y = HORIZON + 3; y < r.y1; y += 6) for (let x = r.x0 + (Math.floor(y / 6) % 2); x < r.x1; x += 4) if (y >= r.y0) p.set(x, y, 'u');
    const bx0 = 190;
    const bx1 = 212;
    const by0 = 46;
    p.rect(Math.max(r.x0, bx0), Math.max(r.y0, by0), Math.min(r.x1, bx1), Math.min(r.y1, HORIZON + 1), 'N');
    for (let y = by0 + 3; y < HORIZON - 2; y += 4) for (let x = bx0 + 2; x < bx1 - 1; x += 3) if (inR(x, y)) p.set(x, y, near > 0.6 ? 'M' : 'J');
    for (let y = by0 - 6; y < by0; y++) if (inR(bx0 + 6, y)) p.set(bx0 + 6, y, 'N');
    if (r.x0 < 50) {
      line(q, r.x0, r.y1 - 1, Math.min(r.x1 - 1, r.x0 + 24), HORIZON, 'N');
      line(q, r.x0 + 4, r.y1 - 1, Math.min(r.x1 - 1, r.x0 + 26), HORIZON, 'N');
    }
    for (const px of [172, 186, 206, 20, 30]) {
      if (px < r.x0 || px >= r.x1) continue;
      for (let y = HORIZON - 6; y <= HORIZON + 2; y++) if (inR(px, y)) p.set(px, y, 'N');
      if (inR(px, HORIZON - 7)) p.set(px, HORIZON - 7, near > 0.6 ? 'H' : 'u');
    }
  }
  if (near > 0.25 && s.bolt) {
    // the bolt: a jagged line from the top of the sky to the horizon, with a pale edge
    let x = s.bolt.x;
    let y = r.y0;
    let i = 0;
    while (y < HORIZON) {
      const ny = Math.min(HORIZON, y + 4 + Math.floor(hash(s.bolt.seed + i) * 6));
      const nx = x + Math.floor(hash(s.bolt.seed + i * 3 + 1) * 9) - 4;
      line(q, x, y, nx, ny, 'j');
      line(q, x + 1, y, nx + 1, ny, 'W');
      if (i === 2) line(q, nx, ny, nx + 6, ny + 8, 'j');
      x = nx;
      y = ny;
      i++;
    }
  }
  // the rain: short streaks falling steeply, a little to the left; brighter in a flash
  const k: PalKey = near > 0.25 ? 'H' : 'h';
  const n = Math.round((r.x1 - r.x0) * 1.2);
  for (let i = 0; i < n; i++) {
    const col = r.x0 + Math.floor(hash(i * 17 + r.x0) * (r.x1 - r.x0));
    const speed = 55 + 25 * hash(i * 5);
    const yy = r.y0 + (((t * speed) / 1000 + hash(i * 11) * 200) % (r.y1 - r.y0 + 6)) - 6;
    const xx = col - Math.floor((yy - r.y0) * 0.12);
    for (let dd = 0; dd < 3; dd++) {
      const y = Math.floor(yy) + dd;
      if (inR(xx, y)) p.set(xx, y, k);
    }
  }
}

/**
 * What is left of the blind once it is shot open, drawn over the storm (on the stage's front
 * layer): the head rail, a strip hanging at each side, a slat torn loose and
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

/**
 * The marks on the glass (the front layer). A staple stuck in: the crown proud at 4× (32×8) with its
 * bright edge, the two legs' holes dark, a short crack off each. A bolt stuck point first: its head
 * end-on at 4× (the nut's shape in dark steel) with a slot, and a star of five cracks.
 */
export function drawMarks(p: Pix, marks: Mark[]): void {
  for (const m of marks) {
    const cx = Math.floor(m.x);
    const cy = Math.floor(m.y);
    if (m.kind === 'staple') {
      const x = cx - 16;
      const y = cy - 4;
      p.rect(x, y, x + 32, y + 8, 'G');
      p.rect(x + 4, y + 2, x + 28, y + 4, 'W');
      p.rect(x - 1, y + 8, x + 5, y + 12, 'K');
      p.rect(x + 27, y + 8, x + 33, y + 12, 'K');
      line(p, x - 1, y + 12, x - 7, y + 18, 'K');
      line(p, x + 32, y + 12, x + 38, y + 17, 'K');
      line(p, x + 32, y + 12, x + 35, y + 21, 'K');
    } else {
      p.blit(cx - 14, cy - 14, SPR.NUT, 4, { remap: { g: 'G' } });
      p.rect(cx - 6, cy - 2, cx + 6, cy + 2, 'K');
      for (const [dx, dy] of [[-18, -8], [16, -12], [14, 14], [-12, 16], [-20, 4]] as const) line(p, cx, cy, cx + dx, cy + dy, 'K');
    }
  }
}

/** A one-pixel line from (x0,y0) to (x1,y1). */
export function line(p: Pick<Painter, 'set'>, x0: number, y0: number, x1: number, y1: number, key: PalKey): void {
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
export type MachineScene = Pick<SceneState, 'machine' | 'shake' | 'flashWhite' | 'ledRed' | 'buttonBright' | 'trayPage' | 'damage'>;

/** 3×5 warning glyphs for the display: !, ?, a triangle, a box, an X, bars. */
const GLYPHS: string[][] = [
  ['.#.', '.#.', '.#.', '...', '.#.'],
  ['##.', '..#', '.#.', '...', '.#.'],
  ['.#.', '.#.', '#.#', '#.#', '###'],
  ['###', '#.#', '#.#', '#.#', '###'],
  ['#.#', '#.#', '.#.', '#.#', '#.#'],
  ['###', '...', '###', '...', '###'],
];
const INK_WHITE: PalKey[] = ['c', 'm', 'y', 'W'];
const STRAY: PalKey[] = ['c', 'm', 'y', 'W', 'z'];

/** The empty black cartridge's error, a word at a time: the display is 26 px wide. */
const ERROR_WORDS = ['NO', 'BLACK', 'INK'];
const ERROR_WORD_MS = 500;
/** 3×5 letters for the error (N is 4 wide, or it reads as an H). */
const FONT: Record<string, string[]> = {
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  L: ['#..', '#..', '#..', '#..', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
};

/**
 * The display's text, 26×9 inside 79–105 × 93–102 (PRNTR-FIGHT-DESIGN.md §9.8, the sheet's C1–C4).
 * Quiet: three green lines. Angry: three red lines each a new length every 80 ms, jumping about,
 * one flashing white now and then, a cursor blinking. From 30% damage the middle line gives way
 * to three warning glyphs, a new set every 220 ms, in yellow and red: it wants to scare you off
 * and does not know with what. From 50% the glyphs come every 100 ms, some in the inks and white,
 * with stray pixels, a noise bar sliding through, the lines doubled, and the screen black about
 * one tick in ten; past 80% twice the noise, black one tick in five. At t 0 (reduced motion) it
 * holds one frame, never black.
 */
function drawScreen(set: (x: number, y: number, k: PalKey) => void, rect: (x0: number, y0: number, x1: number, y1: number, k: PalKey) => void, m: Machine, damage: number): void {
  if (m.error !== null) {
    // the black cartridge is empty: NO, BLACK, INK in yellow on the dark screen, a word every ERROR_WORD_MS
    rect(79, 93, 105, 102, 'i');
    const word = [...ERROR_WORDS[Math.floor(m.error / ERROR_WORD_MS) % ERROR_WORDS.length]];
    const w = word.reduce((n, ch) => n + FONT[ch][0].length + 1, -1);
    let x = 79 + Math.floor((26 - w) / 2);
    for (const ch of word) {
      FONT[ch].forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') set(x + rx, 95 + ry, 'y');
      });
      x += FONT[ch][0].length + 1;
    }
    return;
  }
  if (!m.angry) {
    rect(80, 94, 96, 95, 'n');
    rect(80, 97, 102, 98, 'n');
    rect(80, 100, 90, 101, 'n');
    return;
  }
  const t = m.t;
  const tick = Math.floor(t / 80);
  const warn = damage >= 0.3;
  const dying = damage >= 0.5;
  const bad = damage >= 0.8 ? 3 : dying ? 2 : warn ? 1 : 0;
  if (dying && t > 0 && hash(tick * 3 + 1) < (bad === 3 ? 0.22 : 0.1)) {
    rect(79, 93, 105, 102, 'z');
    return;
  }
  [94, 97, 100].forEach((y, i) => {
    const seed = tick * 7 + i * 13;
    const len = 6 + Math.floor(hash(seed) * 18);
    const x0 = 80 + (hash(seed + 1) < 0.25 ? Math.floor(hash(seed + 2) * 4) : 0);
    rect(x0, y, Math.min(104, x0 + len), y + 1, hash(seed + 3) < 0.08 ? 'W' : 'Q');
    if (bad >= 2 && hash(seed + 4) < 0.3) rect(x0, y + 1, Math.min(104, x0 + len), y + 2, 'R');
  });
  if (tick % 4 < 2) rect(101, 100, 103, 101, 'Q');
  if (warn) {
    const gs = Math.floor(t / (bad >= 2 ? 100 : 220));
    rect(80, 96, 104, 101, 'i');
    for (let i = 0; i < 3; i++) {
      const g = GLYPHS[Math.floor(hash(gs * 5 + i * 11) * GLYPHS.length)];
      const k: PalKey = bad >= 2 && hash(gs * 9 + i) < 0.4 ? INK_WHITE[Math.floor(hash(gs + i * 3) * 4)] : hash(gs + i) < 0.5 ? 'y' : 'Q';
      g.forEach((row, ry) => {
        for (let rx = 0; rx < 3; rx++) if (row[rx] === '#') set(88 + i * 6 + rx, 96 + ry, k);
      });
    }
    if (bad === 1) rect(80, 94, 88 + Math.floor(hash(tick) * 12), 95, 'Q');
  }
  if (dying) {
    const n = bad === 3 ? 22 : 10;
    for (let i = 0; i < n; i++) set(80 + Math.floor(hash(tick * 31 + i * 7) * 25), 94 + Math.floor(hash(tick * 17 + i * 5) * 8), STRAY[Math.floor(hash(tick + i * 13) * 5)]);
    if (hash(tick * 5 + 2) < 0.35) {
      const by = 94 + Math.floor(hash(tick * 11) * 8);
      rect(80, by, 104, by + 1, hash(tick) < 0.5 ? 'W' : 'c');
    }
  }
}

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
  p.rect(84 + ox - m.lift, 146 + oy + m.lift, 176 + ox + m.lift, 152 + oy + m.lift, 'X');
  rect(74, 143, 82, 146, 'K');
  rect(158, 143, 166, 146, 'K');
  // the front face, and the top surface we look slightly down on
  panel(72, 89, 168, 143, 'b');
  panel(72, 80, 168, 90, 'd');
  // the panel: a bar across the top of the face with the display, the keys, the power light, the button
  rect(73, 104, 167, 105, 'K');
  panel(78, 92, 106, 103, m.power ? 'i' : 'G');
  if (m.power) drawScreen(set, rect, m, s.damage);
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
 * least one px). Where two source pixels land on one cell a plum outline already there stays
 * (the outline wins), so the one-pixel lines never drop out. Nearest neighbour; the shake
 * applies after.
 */
function drawMachineBack(p: Pix, s: MachineScene): void {
  const { sc, foot } = machineBack(s.machine.back);
  BACK_PIX.clear();
  drawMachine(BACK_PIX, { ...s, shake: { x: 0, y: 0 } });
  const cx = 120;
  const { x: ox, y: oy } = s.shake;
  // which cells this machine has put down so far, and whether with plum (2) or anything else (1)
  const mine = new Uint8Array(W * H);
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
      for (let yy = dy + oy; yy < dy + h + oy; yy++) {
        for (let xx = dx + ox; xx < dx + w + ox; xx++) {
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const i = yy * W + xx;
          if (mine[i] === 2 && k !== 'K') continue;
          p.set(xx, yy, k as PalKey);
          mine[i] = k === 'K' ? 2 : 1;
        }
      }
    }
  }
}

/** The machine as it is drawn in the fight, shut and angry, as a sprite: what bursts. */
const MACHINE_SPRITE: Sprite = (() => {
  const lp = new LetterPix(MACHINE_AT.x0, MACHINE_AT.y0, MACHINE_AT.x1 - MACHINE_AT.x0, MACHINE_AT.y1 - MACHINE_AT.y0);
  drawMachine(lp, {
    machine: { lid: 0, lamp: null, lampOut: false, flash: false, power: true, angry: true, back: 0, t: 0, error: null, lift: 0 },
    shake: { x: 0, y: 0 },
    flashWhite: false,
    ledRed: true,
    buttonBright: false,
    trayPage: false,
    damage: 0,
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

/** A wall hole is a dark cross; a door or blind hole goes through to the storm behind. */
function drawHoles(p: Pix, s: SceneState): void {
  for (const h of s.holes) {
    if (h.kind === 'wall') {
      // through the print: the hole is in the print's own cells (the stage draws it there); the room draws no mark
      if (h.x >= ART_AT.x && h.x < ART_AT.x + ART_AT.w && h.y >= ART_AT.y && h.y < ART_AT.y + ART_AT.h) continue;
      p.set(h.x - 1, h.y, 'X');
      p.set(h.x + 1, h.y, 'X');
      p.set(h.x, h.y - 1, 'X');
      p.set(h.x, h.y + 1, 'X');
      p.set(h.x, h.y, 'K');
    } else if (!inDoorway(h, s.doorGap) && !(h.kind === 'door' && s.doorBroken) && !(h.kind === 'window' && s.windowOpen)) {
      drawStorm(p, { x0: h.x - 1, y0: h.y - 1, x1: h.x + 1, y1: h.y + 1 }, s.storm);
    }
  }
}

/**
 * The room, a port of room() in prntr/design/stage1/art/liminal.py, the authoritative
 * layout. Every number is a virtual pixel.
 */
export function drawRoom(p: Pix, s: SceneState): void {
  p.fill('A');
  // the ceiling, exposed (the objects sheet's #4): a dark deck with its ribs, a fat duct along it with its
  // seams, a pipe and a rust-red line under it, a shadow where it meets the wall; the two lights are bare
  // tube fixtures hanging on two cords each, the tube white when lit (with a glow row under it), grey when out,
  // red when the mad machine's shaking has brought them back (lightsRed)
  p.rect(0, 0, W, 29, 'B');
  p.rect(0, 0, W, 3, 'X');
  for (let x = 0; x < W; x += 12) p.rect(x, 0, x + 1, 3, 'G');
  p.rect(0, 4, W, 10, 'g');
  p.rect(0, 4, W, 5, 'e');
  p.rect(0, 9, W, 10, 'G');
  for (let x = 30; x < W; x += 40) p.rect(x, 4, x + 1, 10, 'G');
  p.rect(0, 21, W, 23, 'G');
  p.rect(0, 21, W, 22, 'x');
  p.rect(0, 25, W, 26, 'p');
  p.rect(0, 27, W, 29, 'X');
  [44, 148].forEach((x0, i) => {
    const on = s.lights[i];
    line(p, x0 + 8, 0, x0 + 8, 12, 'K');
    line(p, x0 + 40, 0, x0 + 40, 12, 'K');
    p.rect(x0 + 2, 12, x0 + 46, 15, 'g');
    p.rect(x0 + 2, 15, x0 + 46, 16, 'K');
    p.rect(x0 + 4, 16, x0 + 44, 18, on ? (s.lightsRed ? 'Q' : 'W') : 'f');
    if (on) p.rect(x0 + 4, 18, x0 + 44, 19, s.lightsRed ? 'R' : 'F');
  });
  // the wall darkens under a tube that is out
  if (!s.lights[0]) p.rect(0, 29, 120, 108, 'a');
  if (!s.lights[1]) p.rect(120, 29, W, 108, 'a');
  // baseboard, then the carpet: a 2×2 dither of C and x
  p.rect(0, 106, W, 109, 'B');
  for (let y = 109; y < H; y++) {
    for (let x = 0; x < W; x++) p.set(x, y, (x + y) % 2 === 0 ? 'C' : 'x');
  }
  // the door in its frame, shut on the storm, hinged on the right; swung in (its knob shot, or the
  // sign down) it shows the storm at its left; shot apart, it is gone and the doorway is the storm
  p.rect(10, 40, 44, 108, 'E');
  if (s.doorBroken) {
    drawStorm(p, { x0: 13, y0: 43, x1: 41, y1: 108 }, s.storm);
    // the door in pieces: two planks on the carpet, one leaning on the frame, a splinter on the hinge
    p.rect(2, 112, 30, 115, 'D');
    p.rect(2, 112, 30, 113, 'E');
    p.rect(20, 117, 46, 120, 'D');
    p.rect(20, 119, 46, 120, 'E');
    line(p, 41, 70, 47, 112, 'D');
    line(p, 42, 70, 48, 112, 'D');
    line(p, 40, 70, 46, 112, 'E');
    p.rect(39, 43, 41, 50, 'D');
  } else {
    p.rect(13, 43, 41, 108, 'D');
    if (s.doorGap > 0) {
      drawStorm(p, { x0: 13, y0: 43, x1: 13 + s.doorGap, y1: 108 }, s.storm);
      // the door's leading edge
      p.rect(13 + s.doorGap, 43, 14 + s.doorGap, 108, 'E');
    }
    // the knob: brass, lit from the upper left, its shadow down and to the right
    const kx = knobX(s.doorGap);
    p.rect(kx + 1, KNOB.y + 1, kx + KNOB.w + 1, KNOB.y + KNOB.h + 1, 'K');
    p.rect(kx, KNOB.y, kx + KNOB.w, KNOB.y + KNOB.h, 'y');
    p.set(kx, KNOB.y, 'W');
  }
  // the EXIT sign: on the wall, hanging loose, falling, or on the floor in front of the door
  const sign = s.exit;
  if (sign.state === 'down') p.blit(Math.round(sign.x), Math.round(sign.y), SPR.EXIT_BROKEN);
  else p.blit(Math.round(sign.x), Math.round(sign.y), SPR.EXIT, 1, { remap: { n: sign.lit ? 'R' : 'G' }, tilt: sign.tilt });
  // the wall art between the clock and the board: a wooden frame with a pale mat around a hole
  // in the wall; the print itself is the stage's art canvas under the room canvas, seen through
  // the hole, so everything drawn into the room from here on covers it (PRNTR-PLANNING.md P4)
  p.rect(ART_AT.x - 2, ART_AT.y - 2, ART_AT.x + ART_AT.w + 2, ART_AT.y + ART_AT.h + 2, 'K');
  p.rect(ART_AT.x - 1, ART_AT.y - 1, ART_AT.x + ART_AT.w + 1, ART_AT.y + ART_AT.h + 1, 'D');
  p.clearRect(ART_AT.x, ART_AT.y, ART_AT.x + ART_AT.w, ART_AT.y + ART_AT.h);
  // the clock where the board was, the post-it board lower and by the window
  if (s.clock.state === 'up') {
    if (s.clockSpin === null) p.blit(CLOCK_AT.x, CLOCK_AT.y, SPR.CLOCK);
    else {
      // the face without its hands, and the hands spinning: the long one fast and lurching, the short one backwards
      p.blit(CLOCK_AT.x, CLOCK_AT.y, SPR.CLOCK, 1, { remap: { i: 'r' } });
      const t = s.clockSpin;
      const cx = CLOCK_AT.x + 7;
      const cy = CLOCK_AT.y + 7;
      const am = t * 0.03 + 2 * Math.sin(t / 230);
      const ah = -t * 0.006;
      line(p, cx, cy, Math.round(cx + 5 * Math.sin(am)), Math.round(cy - 5 * Math.cos(am)), 'i');
      line(p, cx, cy, Math.round(cx + 3 * Math.sin(ah)), Math.round(cy - 3 * Math.cos(ah)), 'i');
    }
  }
  p.blit(BOARD_AT.x, BOARD_AT.y, s.broken.poster ? SPR.POSTER_TORN : SPR.POSTER);
  // the window: the blind down over the storm, its slat gaps lit by every strike; shot open, the storm itself
  p.rect(160, 36, 224, 90, 'e');
  if (s.windowOpen) {
    drawStorm(p, { x0: 163, y0: 39, x1: 221, y1: 87 }, s.storm);
    // the slats that came down, on the baseboard and the carpet under the window
    p.rect(170, 108, 178, 109, 's');
    p.rect(181, 111, 186, 112, 'a');
    p.rect(188, 109, 196, 110, 's');
    p.rect(176, 113, 181, 114, 's');
  } else {
    // the blind half open: the storm behind it, and over it ten slats tilted toward the room, each a
    // lit top, its face and the shadowed underside the tilt shows, with a 2 px gap under each where the
    // storm is seen (its rain, its clouds, its lightning); a near strike lights the undersides. Two
    // ladder cords run down through them.
    drawStorm(p, { x0: 163, y0: 39, x1: 221, y1: 87 }, s.storm);
    const under: PalKey = s.storm.near > 0.3 ? 'l' : 'a';
    for (let y = BLIND_TOP; y < 87; y += BLIND_PITCH) {
      p.rect(163, y, 221, y + 1, 'W');
      p.rect(163, y + 1, 221, y + 2, 's');
      p.rect(163, y + 2, 221, y + 3, under);
    }
    for (const cx of [176, 208]) for (let y = 39; y < 87; y++) if ((y - BLIND_TOP) % BLIND_PITCH >= 3) p.set(cx, y, 'e');
  }
  // the first aid kit by the window's lower right corner: a green pouch, its cross white
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
    p.blit(COOLER_SHOT_AT.x, COOLER_SHOT_AT.y, SPR.COOLER_SHOT);
  } else {
    p.blit(COOLER_AT.x, COOLER_AT.y, SPR.COOLER);
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
  // the weeping fig behind the monstera: standing in its planter, or falling (then leaning) toward the machine
  // with the planter in shards; burning once it has caught from the fire
  p.rect(170, 127, 184, 130, 'X');
  const figTree = s.broken.fig ? SPR.FIG_BARE : SPR.FIG;
  const figAt = s.broken.fig ? FIG_AT.bare : FIG_AT.tree;
  if (s.fig.fall <= 0) p.blit(figAt.x, figAt.y, figTree);
  else blitLeaning(p, figAt.x, figAt.y, figTree, FIG_AT.pivot, FIG_LEAN * s.fig.fall);
  if (s.broken.figPot) p.blit(FIG_AT.shards.x, FIG_AT.shards.y, SPR.FIG_SHARDS);
  else p.blit(FIG_AT.pot.x, FIG_AT.pot.y, SPR.FIG_POT);
  if (s.fig.burning) {
    const a = FIG_LEAN * s.fig.fall, dx = FIG_CROWN.x - FIG_AT.pivot.x, dy = FIG_CROWN.y - FIG_AT.pivot.y;
    const cx = FIG_AT.pivot.x + dx * Math.cos(a) + dy * Math.sin(a), cy = FIG_AT.pivot.y - dx * Math.sin(a) + dy * Math.cos(a);
    drawFlame(p, cx, 14, 20, cy + 10, 300, s.fire?.t ?? 0);
    drawFlame(p, (cx + FIG_AT.pivot.x) / 2, 6, 12, (cy + FIG_AT.pivot.y) / 2 + 6, 310, s.fire?.t ?? 0);
  }
  // the monstera in its pot; its leaves shot off, the bare stalks; the pot shot, the plant lies on the carpet
  if (s.broken.vase) p.blit(MONSTERA_AT.down.x, MONSTERA_AT.down.y, SPR.MONSTERA_DOWN);
  else if (s.broken.plant) p.blit(MONSTERA_AT.bare.x, MONSTERA_AT.bare.y, SPR.MONSTERA_BARE);
  else p.blit(MONSTERA_AT.whole.x, MONSTERA_AT.whole.y, SPR.MONSTERA);
  // the ink tubes up from behind the machine: a ribbed hose (row by row, so it can snake), its
  // head, the ink in its mouth; the machine covers the hose's foot, the ink in the air is drawn over
  // them. They are attached to the machine, so they shake with it (PRNTR-PLANNING.md P3).
  const { x: sx, y: sy } = s.shake;
  for (const tb of s.tubes) {
    for (let y = tb.top + 4; y < 90; y++) {
      const cx = tubeX(tb, y) + sx;
      p.rect(cx - 2, y + sy, cx + 2, y + sy + 1, 'K');
      p.rect(cx - 1, y + sy, cx + 1, y + sy + 1, (y - tb.top) % 2 === 0 ? 'G' : 'i');
    }
    p.blit(tubeX(tb, tb.top) - 3 + sx, tb.top + sy, SPR.TUBE_HEAD, 1, { remap: { c: tb.color } });
  }
  // the stumps of the tubes shot to pieces: a ragged end of hose just over the edge
  for (const x0 of s.stubs) {
    const x = x0 + sx;
    p.rect(x - 2, 77 + sy, x + 2, 90 + sy, 'K');
    p.rect(x - 1, 78 + sy, x + 1, 90 + sy, 'i');
    p.set(x - 2, 77 + sy, 'A');
    p.set(x + 1, 77 + sy, 'A');
    p.set(x, 78 + sy, 'G');
  }
  // the ink sprayed from behind the machine, where it is still behind it: it has not left yet
  for (const d of s.inkBehind) p.rect(d.x + sx, d.y + sy, d.x + d.size + sx, d.y + d.size + sy, d.color);
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
    // the flash whites the print too: a white rect over the hole, in the room's grid
    if (s.machine.flash && !s.flashWhite) p.rect(ART_AT.x, ART_AT.y, ART_AT.x + ART_AT.w, ART_AT.y + ART_AT.h, 'W');
  }
  // the staff badge by the door, or its pieces
  if (s.badge === 'floor') p.blit(BADGE_AT.x, BADGE_AT.y, SPR.BADGE);
  else if (s.badge === 'shot') p.blit(BADGE_AT.x, BADGE_AT.y + 1, SPR.BADGE_SHOT);
  // the USB stick on the carpet, right of the machine, with its shadow
  if (s.usb) p.blit(USB_AT.x, USB_AT.y, SPR.USB);
}
