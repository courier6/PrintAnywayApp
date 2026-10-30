import { ART_AT } from './art';
import { DISPLAY, HANDLE, MAG_BOX, MAG_FRAMES, MAG_FRAME_AT, PAD, REVEAL, SAFE } from './safe';
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
  /** The print, torn open by the fifth shot into it: the wall behind it shot through, dripping (PRNTR-FIRE.md §12). */
  art: boolean;
}

/** The fig after its planter is shot: how far it has fallen (0 standing … 1 leaning on the machine), whether
 * it has caught from the fire and burns, and how far along the burning is: 0 just caught, 1 lit from the crown
 * to the foot (FIG_LIGHT_MS later), on past 1 as it burns down (PRNTR-FIRE.md). */
export interface Fig {
  fall: number;
  burning: boolean;
  burn: number;
}
/** The monstera once it lies at the burning fig's foot and has caught: whether it burns, and how far along
 * (0 just caught, 1 lit from the fig's end to the pot's MONSTERA_LIGHT_MS later, on past 1 as it burns down). */
export interface Burning {
  burning: boolean;
  burn: number;
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
/** The machine's ink caps' top row: from here down a tube's hose is behind its cap and the machine. */
export const CAPS_TOP = 77;

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

/** The safe as the room draws it: the door 0 shut … 1 open, the magazine still inside, the take's white flash, the
 * magazine turning and how far it has sunk in its hover. The keypad and the display are the art canvas (safe.ts). */
export interface SafeView {
  open: number;
  magIn: boolean;
  flash: boolean;
  /** The frame of the magazine's turn, 0 (face on) … MAG_STEPS − 1. */
  spin: number;
  /** How far down the hover it is, 0 … MAG_BOB px. */
  bob: number;
}
export interface SceneState {
  /** Left, right fluorescent panel. */
  lights: [boolean, boolean];
  /** The lit panels are red (the mad machine's shaking at RED_LIGHTS_FROM of its damage), not white. */
  lightsRed: boolean;
  /** The weeping fig by the window. */
  fig: Fig;
  /** The fallen monstera's burning (PRNTR-FIRE.md §11.3); drawn only while `broken.vase`. */
  monstera: Burning;
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
  /** Ms since the print was torn open (0 until it is); the leak's clock (PRNTR-FIRE.md §12). */
  tornSince: number;
  /** The safe in the wall behind the print, seen once it is torn (PRNTR-SAFE.md). */
  safe: SafeView;
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
export function hash(n: number): number {
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

/** A later flame's own growth: 0 until the fire reaches `from`, 1 when it is full. */
const later = (u: number, from: number) => Math.max(0, Math.min(1, (u - from) / (1 - from)));

// ---- The fire (PRNTR-FIRE.md): 90s sprite flames on the room's grid, stepped at 10 frames a second ----

/** One flame: a tongue of half-width w and height h standing at (x, floor), in room px. */
export interface Emitter {
  x: number;
  floor: number;
  w: number;
  h: number;
  seed: number;
  /** Standing on the machine: its foot rides the machine's shake, its tip lags (none of it). */
  ride?: boolean;
}

/** The fire's frame rate: each frame is held this long, the next is a step. The glows flicker in step. */
export const FIRE_TICK_MS = 100;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Value noise: a 128×128 lattice of fixed randoms (an LCG from 12345), smoothstep between them, wrapping. */
const LAT = 128;
const lat = new Float32Array(LAT * LAT);
{
  let s = 12345;
  for (let i = 0; i < lat.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    lat[i] = s / 4294967296;
  }
}
export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const i0 = (((yi % LAT) + LAT) % LAT) * LAT, i1 = ((((yi + 1) % LAT) + LAT) % LAT) * LAT;
  const x0 = ((xi % LAT) + LAT) % LAT, x1 = (((xi + 1) % LAT) + LAT) % LAT;
  const a = lat[i0 + x0] + (lat[i0 + x1] - lat[i0 + x0]) * sx;
  const b = lat[i1 + x0] + (lat[i1 + x1] - lat[i1 + x0]) * sx;
  return a + (b - a) * sy;
}
/** Two octaves of it: the body of the tongues and the finer cuts. */
const noise2 = (x: number, y: number) => 0.65 * vnoise(x, y) + 0.35 * vnoise(x * 2.1 + 7.3, y * 2.1 + 3.1);

/** The scratch field one layer's flames are summed into (max), room-sized; `cells` are its banded result. */
const field = new Float32Array(W * H);
/** Per cell, how much of the machine's shake it rides, 0..255: 255 at a riding flame's foot, 0 at its tip and for every other flame. */
const rideField = new Uint8Array(W * H);
interface FlameCache {
  tick: number;
  key: string;
  cells: Uint8Array;
  ride: Uint8Array;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const flameCaches = new Map<string, FlameCache>();
/** Cell codes 1..4 → the palette: the rim, the outside, the body, the core. */
const FLAME_KEYS: readonly PalKey[] = ['R', 'o', 'y', 's'];

/**
 * One emitter into the field at the tick's time tq: a teardrop envelope (a dome at the foot, narrowing
 * faster toward the tip), swaying and pulsing with time, with the noise scrolling up through it so it cuts
 * fat lobes that pinch off above the nominal tip. Cells keep the highest value of any flame in the layer.
 */
function emitInto(e: Emitter, tq: number): void {
  const w = e.w, h = e.h;
  if (w < 0.5 || h < 1) return;
  const x0 = Math.max(0, Math.floor(e.x - w - 2)), x1 = Math.min(W - 1, Math.ceil(e.x + w + 2));
  const y1 = Math.min(H - 1, Math.ceil(e.floor) - 1), y0 = Math.max(0, Math.floor(e.floor - h * 1.35));
  const ts = tq * 0.016, seed = e.seed;
  const fq = Math.min(0.42, Math.max(0.09, 1.3 / w)) * 0.7; // the noise's grain follows the flame's size; coarse, for fat lobes
  const pulse = 1 + 0.1 * Math.sin(tq / 170 + seed);
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5, q = (e.floor - sy) / (h * pulse); // 0 at the floor … 1 at the nominal tip, beyond for the licks
    const sway = Math.sin(tq / 260 + seed + sy * 0.18) * 0.9 * q * (1 + 0.6 * q);
    const qq = Math.min(1, q);
    const half = w * (1 - 0.3 * qq - 0.45 * qq * qq) + 0.4;
    for (let x = x0; x <= x1; x++) {
      const sx = x + 0.5, k = (sx - e.x - sway) / half;
      if (k <= -1 || k >= 1) continue;
      const across = Math.sqrt(1 - k * k);
      const n0 = noise2(sx * fq + seed * 0.11, sy * fq * 0.75 - ts + seed * 0.07);
      const n = clamp01((n0 - 0.5) * 3 + 0.5); // the noise stretched, so it cuts the lobes apart
      let v = across * (1.05 - 0.7 * q) * (0.3 + 1.05 * n) - 0.08 - 0.22 * q;
      if (q > 1) v -= (q - 1) * 1.5; // what is above the nominal tip dies quickly
      const i = y * W + x;
      if (v > field[i]) {
        field[i] = v;
        rideField[i] = e.ride ? Math.round(255 * Math.max(0, 1 - q)) : 0;
      }
    }
  }
}

/**
 * Draws a layer of flames: the emitters summed into one field at the current tick, banded to the palette
 * (a one-px dark rim where the fire meets air to the left, right and above; orange inside it, a yellow body,
 * a cream core; the yellow/orange edge shifting every other tick like a cycled palette) and put on `p`.
 * The banded cells are cached per layer and rebuilt only when the tick changes or the emitters' rounded
 * sizes and places do, so the fire steps at 10 fps whatever the frame rate, and is still under reduced
 * motion (t = 0) but still grows. On the blit a riding cell (a flame on the machine) moves with the machine by
 * its share of `shake`: all of it at the foot, none at the tip, so the flames ride the trembling machine
 * at their feet and lag at their tips rather than hanging in the air or jittering with it.
 */
export function drawFlames(p: Pix, layer: string, emitters: Emitter[], t: number, shake: { x: number; y: number } = { x: 0, y: 0 }): void {
  const tick = Math.floor(t / FIRE_TICK_MS);
  let key = '';
  for (const e of emitters) key += `${Math.round(e.x)},${Math.round(e.floor)},${Math.round(e.w)},${Math.round(e.h)};`;
  let c = flameCaches.get(layer);
  if (!c) {
    c = { tick: -1, key: '', cells: new Uint8Array(W * H), ride: new Uint8Array(W * H), x0: 0, y0: 0, x1: -1, y1: -1 };
    flameCaches.set(layer, c);
  }
  if (c.tick !== tick || c.key !== key) {
    c.tick = tick;
    c.key = key;
    field.fill(0);
    rideField.fill(0);
    c.cells.fill(0);
    c.ride.fill(0);
    const tq = tick * FIRE_TICK_MS;
    for (const e of emitters) emitInto(e, tq);
    const shift = tick & 1 ? 0.05 : -0.05;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, v = field[i];
        if (v < 0.2) continue;
        const rim = x === 0 || x === W - 1 || y === 0 || field[i - 1] < 0.2 || field[i + 1] < 0.2 || field[i - W] < 0.2;
        const u = v + shift;
        c.cells[i] = rim ? 1 : u > 0.92 ? 4 : u > 0.5 ? 3 : 2;
        c.ride[i] = rideField[i];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    c.x0 = x0;
    c.y0 = y0;
    c.x1 = x1;
    c.y1 = y1;
  }
  const { x: sx, y: sy } = shake;
  for (let y = c.y0; y <= c.y1; y++) {
    for (let x = c.x0; x <= c.x1; x++) {
      const i = y * W + x, k = c.cells[i];
      if (!k) continue;
      const r = c.ride[i] / 255;
      p.set(x + Math.round(sx * r), y + Math.round(sy * r), FLAME_KEYS[k - 1]);
    }
  }
}

/**
 * The fire's flames by layer, from its state: `back`, two flames behind the cooler on the floor further in
 * (they come as the fire grows); `mid`, the main fire as three licks inside fireRect (the footprint the glow
 * and the snuffing jet use), in front of the cooler and behind the machine; `front`, a low lick at the
 * machine's foot; `machine`, the flames on the machine once the fire spreads (v > 0): up its left side,
 * along its foot and, past 45 %, over its top edge. Once the machine has burst (`pieces` given) the side
 * and the top row go with it: the foot row burns on along the carpet and every piece carries a flame on
 * its top edge, thrown with it and lying with it. `front` and `machine` go on the front canvas.
 */
export function fireEmitters(f: Fire, pieces: Piece[] | null = null): { back: Emitter[]; mid: Emitter[]; front: Emitter[]; machine: Emitter[] } {
  const r = fireRect(f.u), hh = r.y1 - r.y0, w = (r.x1 - r.x0) / 2, cx = (r.x0 + r.x1) / 2;
  const back = [
    { x: 50, floor: 142, w: 7 * later(f.u, 0.35), h: 0.9 * hh * later(f.u, 0.35), seed: 100 },
    { x: 70, floor: 142, w: 6 * later(f.u, 0.55), h: 0.95 * hh * later(f.u, 0.55), seed: 200 },
  ];
  const mid = [
    { x: cx, floor: r.y1, w: w * 0.8, h: hh, seed: 0 },
    { x: cx - w * 0.55, floor: r.y1, w: w * 0.5, h: hh * 0.7, seed: 11 },
    { x: cx + w * 0.5, floor: r.y1, w: w * 0.5, h: hh * 0.78, seed: 23 },
  ];
  const front = [{ x: 76, floor: 146, w: 5 * later(f.u, 0.2), h: 0.3 * hh * later(f.u, 0.2), seed: 300 }];
  const machine: Emitter[] = [];
  if (f.v > 0) {
    const v = Math.min(1, f.v);
    if (pieces === null) machine.push({ x: 73, floor: 146, w: 4 + 3 * v, h: 20 + 46 * v, seed: 400, ride: true });
    const reach = 72 + 96 * v;
    for (let x = 84; x < reach; x += 13) {
      const age = Math.min(1, (reach - x) / 40), rr = hash(x * 3);
      machine.push({ x: x + 4 * Math.sin(x), floor: 146, w: (6 + 4 * age) * (0.8 + 0.4 * rr), h: (12 + 40 * age) * (0.6 + 0.8 * hash(x * 5)), seed: 500 + x, ride: pieces === null });
    }
    if (pieces === null && v > 0.45) {
      const top = (v - 0.45) / 0.55, reachTop = 72 + 96 * top;
      for (let x = 74; x < reachTop; x += 12) {
        machine.push({ x: x + 3 * hash(x), floor: 80, w: 4 + 2 * hash(x + 1), h: (7 + 11 * Math.min(1, (reachTop - x) / 30)) * (0.6 + 0.8 * hash(x * 7)), seed: 700 + x, ride: true });
      }
    }
    // the burst machine: a flame on every piece, standing two rows into its top edge (so its foot sits on the
    // piece, which the room canvas draws behind it), the wider pieces with the bigger flames, each its own size
    if (pieces !== null) {
      pieces.forEach((pc, i) => {
        const w = Math.min(12, 3 + pc.spr.w * 0.12) * (0.8 + 0.4 * hash(800 + i));
        machine.push({ x: Math.round(pc.x) + pc.spr.w / 2, floor: Math.round(pc.y) + 2, w, h: (12 + w * 1.6) * (0.7 + 0.6 * hash(801 + i)), seed: 800 + i });
      });
    }
  }
  return { back, mid, front, machine };
}

/** The fig's crown once the tree leans on the machine (FIG_CROWN turned by FIG_LEAN about the pivot). */
const FIG_TURNED_CROWN = (() => {
  const a = FIG_LEAN, dx = FIG_CROWN.x - FIG_AT.pivot.x, dy = FIG_CROWN.y - FIG_AT.pivot.y;
  return { x: FIG_AT.pivot.x + dx * Math.cos(a) + dy * Math.sin(a), y: FIG_AT.pivot.y - dx * Math.sin(a) + dy * Math.cos(a) };
})();
/** A cell of the leaning fig a flame stands on: its foot, how far it is from the crown (0) toward the foot
 * of the trunk (1), whether it is mostly leaves, its seed. */
interface FigCell {
  x: number;
  y: number;
  d: number;
  leafy: boolean;
  seed: number;
}
/**
 * The leaning tree's opaque pixels (the same turn as blitLeaning at FIG_LEAN) bucketed into 7×7 cells; a cell
 * with six or more pixels is a flame standing on its lowest pixel at its mean x. Computed once per sprite.
 */
function figCells(s: Sprite): FigCell[] {
  const a = FIG_LEAN, c = Math.cos(a), sn = Math.sin(a), x0 = FIG_AT.tree.x, y0 = FIG_AT.tree.y, pv = FIG_AT.pivot;
  const corners = [[x0, y0], [x0 + s.w, y0], [x0, y0 + s.h], [x0 + s.w, y0 + s.h]].map(([x, y]) => { const dx = x - pv.x, dy = y - pv.y; return [pv.x + dx * c + dy * sn, pv.y - dx * sn + dy * c]; });
  const bx0 = Math.floor(Math.min(...corners.map((q) => q[0]))), bx1 = Math.ceil(Math.max(...corners.map((q) => q[0])));
  const by0 = Math.floor(Math.min(...corners.map((q) => q[1]))), by1 = Math.ceil(Math.max(...corners.map((q) => q[1])));
  const cells = new Map<string, { n: number; sx: number; floor: number; wood: number }>();
  for (let y = by0; y <= by1; y++) {
    for (let x = bx0; x <= bx1; x++) {
      const dx = x + 0.5 - pv.x, dy = y + 0.5 - pv.y;
      const sx = Math.floor(pv.x + dx * c - dy * sn) - x0, sy = Math.floor(pv.y + dx * sn + dy * c) - y0;
      if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
      const k = s.rows[sy][sx];
      if (k === '.') continue;
      const key = `${Math.floor(x / 7)},${Math.floor(y / 7)}`;
      const cell = cells.get(key) ?? { n: 0, sx: 0, floor: -1, wood: 0 };
      cell.n++;
      cell.sx += x + 0.5;
      cell.floor = Math.max(cell.floor, y + 1);
      if (k === 'E' || k === 'D') cell.wood++;
      cells.set(key, cell);
    }
  }
  const out: FigCell[] = [];
  const reach = Math.hypot(FIG_AT.pivot.x - FIG_TURNED_CROWN.x, FIG_AT.pivot.y - FIG_TURNED_CROWN.y);
  for (const cell of cells.values()) {
    if (cell.n < 6) continue;
    const x = cell.sx / cell.n, y = cell.floor;
    const d = Math.min(1, Math.hypot(x - FIG_TURNED_CROWN.x, y - FIG_TURNED_CROWN.y) / reach);
    out.push({ x, y, d, leafy: cell.wood < cell.n / 2, seed: out.length * 37 + 900 });
  }
  return out;
}
const FIG_CELLS = { tree: figCells(SPR.FIG), bare: figCells(SPR.FIG_BARE) };
/**
 * A sprite lying as it is drawn (no turn) bucketed into 7×7 cells, like figCells: a cell with six or more
 * opaque pixels is a flame standing on its lowest pixel at its mean x; `d` is its distance from `from`
 * over the farthest cell's, 0 at the near end, 1 at the far end; leafy where most of it is leaf (V, v, n).
 */
function lyingCells(s: Sprite, at: { x: number; y: number }, from: { x: number; y: number }, seed0: number): FigCell[] {
  const cells = new Map<string, { n: number; sx: number; floor: number; leaf: number }>();
  s.rows.forEach((row, sy) => {
    for (let sx = 0; sx < s.w; sx++) {
      const k = row[sx];
      if (k === '.') continue;
      const x = at.x + sx, y = at.y + sy, key = `${Math.floor(x / 7)},${Math.floor(y / 7)}`;
      const cell = cells.get(key) ?? { n: 0, sx: 0, floor: -1, leaf: 0 };
      cell.n++;
      cell.sx += x + 0.5;
      cell.floor = Math.max(cell.floor, y + 1);
      if (k === 'V' || k === 'v' || k === 'n') cell.leaf++;
      cells.set(key, cell);
    }
  });
  const out: FigCell[] = [];
  for (const cell of cells.values()) if (cell.n >= 6) out.push({ x: cell.sx / cell.n, y: cell.floor, d: 0, leafy: cell.leaf > cell.n / 2, seed: seed0 + out.length * 37 });
  const reach = Math.max(...out.map((c) => Math.hypot(c.x - from.x, c.y - from.y)));
  for (const c of out) c.d = Math.hypot(c.x - from.x, c.y - from.y) / reach;
  return out;
}
/** The fallen monstera's cells, lit from the fig's foot (its pivot) outward: 12 cells, 3 leafy. */
const MONSTERA_CELLS = lyingCells(SPR.MONSTERA_DOWN, MONSTERA_AT.down, FIG_AT.pivot, 1200);

/**
 * The burning fig's flames at `burn` (Fig.burn): every other cell of the leaning tree (by its seed) gets one,
 * lit from the crown down the trunk as burn goes 0 → 1, bigger on leafy cells, and dying back by up to 45 %
 * as burn goes 1 → 2. `bare` picks the tree with its leaves shot off.
 */
export function figEmitters(burn: number, bare: boolean): Emitter[] {
  const out: Emitter[] = [];
  const dieback = 1 - 0.45 * clamp01(burn - 1);
  for (const c of bare ? FIG_CELLS.bare : FIG_CELLS.tree) {
    if (hash(c.seed + 3) > 0.5) continue;
    const g = clamp01((burn - c.d * 0.75) / 0.25);
    if (g <= 0) continue;
    const rw = (0.75 + 0.5 * hash(c.seed)) * 1.5, rh = (0.7 + 0.7 * hash(c.seed + 1)) * 1.35;
    out.push({ x: c.x, floor: c.y, w: (c.leafy ? 3.6 : 2.8) * rw * g * dieback, h: (c.leafy ? 13 : 9) * rh * g * dieback, seed: c.seed });
  }
  return out;
}

/**
 * The burning monstera's flames at `burn` (Burning.burn): one on every cell of the fallen plant, lit from the
 * fig's end outward as burn goes 0 → 1 (smaller than the fig's: it is a low plant on the carpet), dying back by
 * up to 45 % as burn goes 1 → 2.
 */
export function monsteraEmitters(burn: number): Emitter[] {
  const out: Emitter[] = [];
  const dieback = 1 - 0.45 * clamp01(burn - 1);
  for (const c of MONSTERA_CELLS) {
    const g = clamp01((burn - c.d * 0.75) / 0.25);
    if (g <= 0) continue;
    const rw = (0.75 + 0.5 * hash(c.seed)) * 1.5, rh = (0.7 + 0.7 * hash(c.seed + 1)) * 1.35;
    out.push({ x: c.x, floor: c.y, w: (c.leafy ? 3 : 2.6) * rw * g * dieback, h: (c.leafy ? 9 : 7) * rh * g * dieback, seed: c.seed });
  }
  return out;
}

/** The fire's back and mid layers in the room (drawRoom); the front canvas gets drawFireFront. */
function drawFire(p: Pix, f: Fire, layer: 'back' | 'mid'): void {
  drawFlames(p, layer, fireEmitters(f)[layer], f.t);
}

/**
 * The fire's front layer: the low lick at the machine's foot and the flames on the machine once it
 * spreads. Drawn on the front canvas, so they are in front of the slot's red light like the pages, under
 * the things the machine throws; once it has burst, on its pieces (`pieces`).
 */
export function drawFireFront(p: Pix, f: Fire, pieces: Piece[] | null, shake = { x: 0, y: 0 }): void {
  const e = fireEmitters(f, pieces);
  drawFlames(p, 'front', e.front.concat(e.machine), f.t, shake);
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
 * white for the hit flash. Its shadow is drawMachineShadow's, drawn before it (the pieces' buffer
 * must not carry it).
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
  // the feet
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
  for (const n of NOZZLES) panel(n.x - 3, CAPS_TOP, n.x + 3, 81, n.color);
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

/** A shadow on the carpet (half-open rect): the carpet's light pixels darkened to X, its dark ones left, so it
 * reads as a shadow on the fabric rather than a slab. The window is the room's light: every shadow lies on
 * its object's foot rows and runs off to the left. */
function shade(p: Painter, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (((x + y) & 1) === 0) p.set(x, y, 'X');
}

/** How far the machine's shadow runs left of its body, px. */
const MACHINE_SHADOW_REACH = 12;

/** The machine's shadow: under its feet (rows 143–146, the feet's rows) across the body and MACHINE_SHADOW_REACH
 * off to the left, the window being the light; swelling and dropping by `lift` under the slam's lifted body (the
 * body goes up with `shake`, the shadow stays on the carpet). Drawn before the machine, which covers its middle. */
export function drawMachineShadow(p: Painter, s: Pick<SceneState, 'machine' | 'shake'>): void {
  const { x: ox, y: oy } = s.shake, lift = s.machine.lift;
  shade(p, MACHINE_AT.x0 - MACHINE_SHADOW_REACH + ox - lift, 143 + oy + lift, MACHINE_AT.x1 + ox + lift, 147 + oy + lift);
}

/** The machine drawn full size here (its standing lid included), to be sampled smaller when it stands back. */
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
  // its shadow at the same scale, on the carpet under its foot line; the body goes over its middle
  shade(p, Math.round(cx + (MACHINE_AT.x0 - MACHINE_SHADOW_REACH - cx) * sc) + ox, Math.round(foot - 3 * sc) + oy, Math.round(cx + (MACHINE_AT.x1 - cx) * sc) + ox, foot + 1 + oy);
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
      // through the print: the hole is in the print's own cells (the stage draws it there); the room draws no mark;
      // torn open, the room draws them like any wall hole, over the cavity
      if (!s.broken.art && h.x >= ART_AT.x && h.x < ART_AT.x + ART_AT.w && h.y >= ART_AT.y && h.y < ART_AT.y + ART_AT.h) continue;
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

// ---- The print shot out (PRNTR-FIRE.md §12): the tear, the drywall's rim, the cavity with its studs, the roof leak ----
/** Shots into the print before the fifth tears it open. */
export const ART_BREAK_SHOTS = 5;
/** The tear through the print and the wall: a ragged ellipse, its centre and half-sizes, always open to the safe's REVEAL rect
 * (PRNTR-SAFE.md); the studs' left edges (STUD_W wide, 16 on centre); the second stud shot out, only its stubs STUB_FROM rows
 * and more from the tear's centre are left. */
const TEAR = { cx: 111, cy: 52, rx: 19, ry: 13, seed: 31 };
const STUB_FROM = 10;
const STUDS = [99, 115] as const;
const STUD_W = 4;
/** The leak: the water runs down the left stud's right face (LEAK_X) from LEAK_TOP to LEAK_BOTTOM, a drop every DROP_MS, the
 * first DRIP_AFTER_MS after the break; the wall under the frame darkens up to DROPS_MAX drops. */
const LEAK_X = 102;
const LEAK_TOP = 44;
const LEAK_BOTTOM = 60;
const DROP_MS = 1800;
const DRIP_AFTER_MS = 1500;
const DROPS_MAX = 12;
/** The tear's edge: 16 spokes, each up to 14 % off round. */
const TEAR_R = Array.from({ length: 16 }, (_, i) => 1 + 0.28 * (hash(TEAR.seed + i * 7) - 0.5));
/** The tear's edge in a direction: the 16 spokes blended. */
function ragAt(dx: number, dy: number): number {
  const a = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) * 16, i = Math.floor(a) % 16, f = a - Math.floor(a);
  return TEAR_R[i] + (TEAR_R[(i + 1) % 16] - TEAR_R[i]) * f;
}
/** How far a pixel is from the tear's centre: 0 there, 1 on the torn edge, more outside. Inside the safe's REVEAL rect it is
 * 0.8 at most (the cavity), the rect's rim as ragged as the ellipse's; the ellipse is big enough that the rect only matters
 * at its corners. */
function tearDist(x: number, y: number): number {
  const dx = (x + 0.5 - TEAR.cx) / TEAR.rx, dy = (y + 0.5 - TEAR.cy) / TEAR.ry;
  const d = Math.hypot(dx, dy) / ragAt(dx, dy);
  const rcx = (REVEAL.x0 + REVEAL.x1) / 2, rcy = (REVEAL.y0 + REVEAL.y1) / 2, hw = (REVEAL.x1 - REVEAL.x0) / 2, hh = (REVEAL.y1 - REVEAL.y0) / 2;
  const ex = (x + 0.5 - rcx) / hw, ey = (y + 0.5 - rcy) / hh;
  return Math.min(d, (0.8 * Math.max(Math.abs(ex), Math.abs(ey))) / ragAt(ex, ey));
}
/** Whether a room point is in the cavity (the tear's inside, within the print's rect): where the safe's steel can be hit. */
export function inCavity(x: number, y: number): boolean {
  return x >= ART_AT.x && x < ART_AT.x + ART_AT.w && y >= ART_AT.y && y < ART_AT.y + ART_AT.h && tearDist(x, y) <= 0.8;
}
/** The leak's beat `t` ms into the dripping, stepped at 100 ms like the fire: the drops so far, the phase of the one forming, how far into it. */
function dripAt(t: number): { n: number; phase: 'form' | 'run' | 'fall' | 'splash'; u: number } {
  t = Math.floor(t / 100) * 100;
  const n = Math.floor(t / DROP_MS), q = (t % DROP_MS) / DROP_MS;
  if (q < 0.3) return { n, phase: 'form', u: q / 0.3 };
  if (q < 0.72) return { n, phase: 'run', u: (q - 0.3) / 0.42 };
  if (q < 0.84) return { n, phase: 'fall', u: (q - 0.72) / 0.12 };
  return { n, phase: 'splash', u: (q - 0.84) / 0.16 };
}
/**
 * The print torn open and the wall behind it shot through, `since` ms after the break (the wall sheet's #2, 2026-10-22; the
 * safe sheet's #5, PRNTR-SAFE.md: the tear bigger, the second stud in stubs, the safe in the cavity):
 * the paper's torn edge (white, curling), the gypsum's rim, the cavity dark behind it with two studs lit from the left, a
 * noggin between them and a cable looped across; from DRIP_AFTER_MS on, the roof leak: a bead forms at the top of the
 * hole, runs down the left stud's face, drops out of the bottom of the tear (behind the frame's rail) onto the wall under
 * the frame and stains it, wider with every drop; the water glints in a near strike (`near`). Plaster dust falls for the
 * first half second. Drawn over the print's rect, so it covers the print wherever the paper is gone; `lit` is the left
 * light, which the wall under the frame is drawn by.
 */
export function drawWallHole(p: Pix, since: number, near: number, lit: boolean, safe: SafeView): void {
  const { cx, cy, rx, ry } = TEAR;
  // never outside the print's rect: the frame round it stays whole
  const x0 = Math.max(ART_AT.x, Math.floor(cx - rx * 1.3)), x1 = Math.min(ART_AT.x + ART_AT.w - 1, Math.ceil(cx + rx * 1.3));
  const y0 = Math.max(ART_AT.y, Math.floor(cy - ry * 1.3)), y1 = Math.min(ART_AT.y + ART_AT.h - 1, Math.ceil(cy + ry * 1.3));
  const inside = inCavity;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = tearDist(x, y);
      if (d > 1) continue;
      if (d > 0.9) p.set(x, y, hash(x * 3 + y * 7) > 0.8 ? 'P' : 'w');
      else if (d > 0.8) p.set(x, y, hash(x * 5 + y * 3) > 0.7 ? 'W' : 'T');
      else p.set(x, y, 'i');
    }
  }
  // the safe (PRNTR-SAFE.md): the inside once the door is off its face (black, a steel lining, a shelf; the rifle magazine
  // turning and hovering over it; the inside white for a beat when it is taken), then the door, hinged
  // on its left: shut, the whole face; opening, the face narrows to a 2 px slab at the hinge, its thickness seen edge on
  const inSafe = (x: number, y: number) => x >= SAFE.x0 && x < SAFE.x1 && y >= SAFE.y0 && y < SAFE.y1;
  if (safe.open > 0) {
    for (let y = SAFE.y0; y < SAFE.y1; y++) {
      for (let x = SAFE.x0; x < SAFE.x1; x++) {
        if (!inside(x, y)) continue;
        const edge = x === SAFE.x0 || x === SAFE.x1 - 1 || y === SAFE.y0 || y === SAFE.y1 - 1;
        p.set(x, y, safe.flash ? 'W' : edge ? 'X' : y === SAFE.y1 - 2 ? 'G' : 'z');
      }
    }
    if (safe.magIn && !safe.flash) {
      const f = MAG_FRAMES[safe.spin], fy = MAG_FRAME_AT.y + safe.bob;
      f.rows.forEach((row, dy) => {
        for (let dx = 0; dx < f.w; dx++) {
          const ch = row[dx], x = MAG_FRAME_AT.x + dx, y = fy + dy;
          if (ch === '.' || !inside(x, y) || x < MAG_BOX.x0 || x >= MAG_BOX.x1 || y < MAG_BOX.y0 || y >= MAG_BOX.y1) continue;
          p.set(x, y, ch as PalKey);
        }
      });
    }
  }
  const dw = safe.open === 0 ? SAFE.x1 - SAFE.x0 : Math.max(2, Math.round((SAFE.x1 - SAFE.x0) * (1 - safe.open)));
  const doorX1 = SAFE.x0 + dw;
  for (let y = SAFE.y0; y < SAFE.y1; y++) {
    for (let x = SAFE.x0; x < doorX1; x++) {
      if (!inside(x, y)) continue;
      let k: PalKey = 'x';
      if (x === SAFE.x0 || y === SAFE.y0) k = 'C';
      else if (x === doorX1 - 1 || y === SAFE.y1 - 1) k = 'G';
      else if (x === SAFE.x0 + 1 || y === SAFE.y0 + 1 || x === doorX1 - 2 || y === SAFE.y1 - 2) k = 'X';
      if (safe.open > 0 && x >= doorX1 - 2) k = 'G';
      p.set(x, y, k);
    }
  }
  if (safe.open === 0) {
    // the keypad's and the display's bezels, dark; the keys and the display themselves are the art canvas (safe.ts
    // paintKeypad), seen through the rects cleared here; the handle beside the display
    for (let y = PAD.y - 1; y <= PAD.y + PAD.kh * 4; y++) for (let x = PAD.x - 1; x <= PAD.x + PAD.kw * 3; x++) if (inside(x, y)) p.set(x, y, 'i');
    for (let y = DISPLAY.y - 1; y <= DISPLAY.y + DISPLAY.h; y++) for (let x = DISPLAY.x - 1; x <= DISPLAY.x + DISPLAY.w; x++) if (inside(x, y)) p.set(x, y, 'i');
    p.clearRect(PAD.x, PAD.y, PAD.x + PAD.kw * 3, PAD.y + PAD.kh * 4);
    p.clearRect(DISPLAY.x, DISPLAY.y, DISPLAY.x + DISPLAY.w, DISPLAY.y + DISPLAY.h);
    for (let x = HANDLE.x; x < HANDLE.x + HANDLE.w; x++) {
      if (inside(x, HANDLE.y)) p.set(x, HANDLE.y, x === HANDLE.x ? 'z' : 'i');
      if (inside(x, HANDLE.y + 1)) p.set(x, HANDLE.y + 1, 'G');
    }
  }
  // the studs, lit from the left, a grain mark now and then; the second one shot out: its stubs at the top and the bottom
  // of the hole, their ends splintered pale, a few chips beside them; the noggin between them low down and the cable
  // looped across, both stopping at the safe
  for (const sx of STUDS) {
    const out = sx === STUDS[1];
    for (let y = y0; y <= y1; y++) {
      if (out && Math.abs(y - cy) < STUB_FROM) continue;
      for (let x = sx; x < sx + STUD_W; x++) {
        if (!inside(x, y)) continue;
        let k: PalKey = x === sx ? 'E' : x === sx + STUD_W - 1 ? 'D' : y % 5 === 0 && hash(x + y * 13) > 0.5 ? 'D' : 'p';
        if (out && Math.abs(y - cy) === STUB_FROM && hash(x * 7 + y) > 0.4) k = 's';
        p.set(x, y, k);
      }
    }
    if (out) {
      for (let i = 0; i < 6; i++) {
        const x = sx + Math.floor(hash(i * 3) * STUD_W), y = cy + (i < 3 ? -STUB_FROM - 1 : STUB_FROM + 1) + (i % 3);
        if (inside(x, y) && !inSafe(x, y)) p.set(x, y, 'p');
      }
    }
  }
  for (let x = STUDS[0] + STUD_W; x < STUDS[1]; x++) for (let y = cy + 6; y < cy + 9; y++) if (inside(x, y) && !inSafe(x, y)) p.set(x, y, y === cy + 6 ? 'D' : 'E');
  for (let i = 0; i <= 16; i++) {
    const x = STUDS[0] + STUD_W + i, y = Math.round(cy - 4 + 3 * Math.sin((i / 16) * Math.PI));
    if (inside(x, y) && !(x >= STUDS[1] && x < STUDS[1] + STUD_W) && !inSafe(x, y)) p.set(x, y, 'G');
  }
  // the leak: the streak it has left, the bead forming, running, falling, splashing; the stain under the frame
  const wk: PalKey = near > 0.3 ? 'H' : 'h', bk: PalKey = near > 0.3 ? 'W' : 'H';
  const railY = ART_AT.y + ART_AT.h, floorY = MACHINE_AT.y0 - 1;
  if (since >= DRIP_AFTER_MS) {
    const drip = dripAt(since - DRIP_AFTER_MS);
    for (let y = LEAK_TOP; y <= LEAK_BOTTOM; y++) if (hash(y * 3 + 5) > 0.45 && inside(LEAK_X, y)) p.set(LEAK_X, y, wk);
    if (drip.phase === 'form') {
      p.set(LEAK_X, LEAK_TOP, bk);
      if (drip.u >= 0.5) {
        p.set(LEAK_X + 1, LEAK_TOP, bk);
        p.set(LEAK_X, LEAK_TOP + 1, bk);
      }
    } else if (drip.phase === 'run') {
      const y = Math.round(LEAK_TOP + (LEAK_BOTTOM - LEAK_TOP) * drip.u);
      p.set(LEAK_X, y, bk);
      p.set(LEAK_X, y + 1, bk);
      p.set(LEAK_X + 1, y + 1, wk);
    } else if (drip.phase === 'fall') {
      // behind the frame's rail (the two K/D rows under the print) it is not seen
      const y = Math.round(LEAK_BOTTOM + (floorY - LEAK_BOTTOM) * drip.u);
      if (y < railY || y >= railY + 2) {
        p.set(LEAK_X, y, bk);
        p.set(LEAK_X, y - 1, wk);
      }
    } else {
      const sp = drip.u < 0.5 ? 1 : 2;
      p.set(LEAK_X - sp, floorY - 1, wk);
      p.set(LEAK_X + sp, floorY - 1, wk);
      if (drip.u < 0.5) p.set(LEAK_X, floorY, bk);
    }
    const n = Math.min(DROPS_MAX, drip.n), hw = Math.min(6, 1 + n * 0.5);
    const stain: PalKey = lit ? 'a' : 'e', core: PalKey = lit ? 'e' : 'B';
    for (let y = railY + 2; y <= floorY; y++) {
      for (let x = Math.round(LEAK_X - hw); x <= Math.round(LEAK_X + hw); x++) {
        if (x === LEAK_X) p.set(x, y, core);
        else if (hash(x * 7 + y * 3 + n) < 0.95 - (Math.abs(x - LEAK_X) / (hw + 1)) * 0.7) p.set(x, y, stain);
      }
    }
  }
  // plaster dust at the break: pale grains falling out of the hole for half a second
  if (since < 500) {
    for (let i = 0; i < 9; i++) {
      const x = cx - rx + Math.floor(hash(i * 5) * 2 * rx);
      const y = Math.floor(cy + ry * 0.6 + (since / 500) * (6 + hash(i) * 10) * (0.5 + hash(i * 3)));
      if (y <= floorY) p.set(x, y, hash(i * 7) > 0.5 ? 'T' : 'w');
    }
  }
}

/** The ink tubes up from behind the machine, their rows above `below`: a ribbed hose (row by row, so it can snake),
 * its head, the ink in its mouth. They are attached to the machine, so they shake with it (PRNTR-PLANNING.md P3).
 * The room draws them to 90, under the machine; the lit layer's mask to CAPS_TOP (PRNTR-GLOWS.md). */
export function drawTubes(p: Pix, s: Pick<SceneState, 'tubes' | 'shake'>, below: number): void {
  const { x: sx, y: sy } = s.shake;
  for (const tb of s.tubes) {
    for (let y = tb.top + 4; y < below; y++) {
      const cx = tubeX(tb, y) + sx;
      p.rect(cx - 2, y + sy, cx + 2, y + sy + 1, 'K');
      p.rect(cx - 1, y + sy, cx + 1, y + sy + 1, (y - tb.top) % 2 === 0 ? 'G' : 'i');
    }
    p.blit(tubeX(tb, tb.top) - 3 + sx, tb.top + sy, SPR.TUBE_HEAD, 1, { remap: { c: tb.color } });
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
    // the knob: brass, lit from the upper right like the room, its shadow down and to the left
    const kx = knobX(s.doorGap);
    p.rect(kx - 1, KNOB.y + 1, kx + KNOB.w - 1, KNOB.y + KNOB.h + 1, 'K');
    p.rect(kx, KNOB.y, kx + KNOB.w, KNOB.y + KNOB.h, 'y');
    p.set(kx + KNOB.w - 1, KNOB.y, 'W');
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
  // torn open by the fifth shot into it: the wall behind it, shot through and dripping, over the print (PRNTR-FIRE.md §12)
  if (s.broken.art) drawWallHole(p, s.tornSince, s.storm.near, s.lights[0], s.safe);
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
  // cooler and plants, their shadows on their feet's rows, off to the left (the window is the light)
  shade(p, 40, 132, 52, 136);
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
    if (ck.state === 'burning') drawFlames(p, 'clock', [{ x: x + spr.w / 2, floor: y + spr.h, w: spr.w / 2 - 1, h: 14, seed: 500 }], s.fire?.t ?? s.storm.t);
  }
  if (s.fire) drawFire(p, s.fire, 'mid');
  shade(p, 194, 132, 208, 135);
  // the weeping fig behind the monstera: standing in its planter, or falling (then leaning) toward the machine
  // with the planter in shards; burning once it has caught from the fire
  shade(p, 172, 128, 185, 131);
  const figTree = s.broken.fig ? SPR.FIG_BARE : SPR.FIG;
  const figAt = s.broken.fig ? FIG_AT.bare : FIG_AT.tree;
  if (s.fig.fall <= 0) p.blit(figAt.x, figAt.y, figTree);
  else blitLeaning(p, figAt.x, figAt.y, figTree, FIG_AT.pivot, FIG_LEAN * s.fig.fall);
  if (s.broken.figPot) p.blit(FIG_AT.shards.x, FIG_AT.shards.y, SPR.FIG_SHARDS);
  else p.blit(FIG_AT.pot.x, FIG_AT.pot.y, SPR.FIG_POT);
  // its flames stand on the leaning tree's cells, lit from the crown down (PRNTR-FIRE.md); it burns on after the
  // fire is out, so its time is the storm's when there is no fire
  if (s.fig.burning) drawFlames(p, 'fig', figEmitters(s.fig.burn, s.broken.fig), s.fire?.t ?? s.storm.t);
  // the monstera in its pot; its leaves shot off, the bare stalks; the pot shot, the plant lies on the carpet
  if (s.broken.vase) {
    p.blit(MONSTERA_AT.down.x, MONSTERA_AT.down.y, SPR.MONSTERA_DOWN);
    // caught from the burning fig at its foot: its flames on its own cells, lit from the fig's end outward (PRNTR-FIRE.md §11.3)
    if (s.monstera.burning) drawFlames(p, 'monstera', monsteraEmitters(s.monstera.burn), s.fire?.t ?? s.storm.t);
  }
  else if (s.broken.plant) p.blit(MONSTERA_AT.bare.x, MONSTERA_AT.bare.y, SPR.MONSTERA_BARE);
  else p.blit(MONSTERA_AT.whole.x, MONSTERA_AT.whole.y, SPR.MONSTERA);
  // the ink tubes up from behind the machine; the machine covers the hose's foot, the ink in the air is drawn over them
  drawTubes(p, s, 90);
  const { x: sx, y: sy } = s.shake;
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
  // the printer, on its shadow
  if (s.printer === 'wreck') {
    // the burst machine: its pieces in the air and on the floor, the fire raging where it stood
    for (const pc of s.pieces) p.blit(Math.round(pc.x), Math.round(pc.y), pc.spr);
  } else if (s.machine.back > 0) {
    // standing back, before the pounce: smaller, higher on the carpet (no wear yet)
    drawMachineBack(p, s);
  } else {
    drawMachineShadow(p, s);
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
