import { reducedMotion, wait } from '../../anim';
import type { Handoff, Stage } from '../../types';
import { H, Pix, W, rotateSprite } from './pixels';
import { CLOCK_AT, KIT_AT, MACHINE_PIECES, SPR, drawFireFront, drawFlame, drawRoom, drawWindowWreck, fireRect, inDoorway, type Broken, type ExitSign, type Hole, type SceneState } from './scene';
import type { PalKey } from './palette';
import { createRoomSounds, type FireSound, type Hum } from './sounds';

// ---------------------------------------------------------------------------
// Tunables. The attack cycle is "tune freely" (handoff §2.7), slowed down and made
// shootable on Edgar's review (2026-10-19) so the player has time to fight back; the
// rest is designed.
// ---------------------------------------------------------------------------

/** The high score that already exists, and the machine's life. */
const HI = 1337;
/** The machine's model number, on its health bar. Invented (Simple Products; 1337 backwards). */
const MODEL = 'SP-7331';
const HIT_POINTS = 10;
const PAGE_POINTS = 1;
const STAPLE_POINTS = 1;
const SHOTS = 6;
/** The hearts are lives, as in the arcade (Edgar, 2026-10-19): slots, lives at the start, and the
 * one life a continue buys. A hit costs a life: the room freezes under a red dim for DEATH_MS
 * with the three notes and everything in the air gone, then the fight goes on, the next attack
 * RESPAWN_MS later. */
const LIVES_MAX = 3;
const LIVES_START = 2;
const LIVES_CONTINUE = 1;
const DEATH_MS = 1200;
const RESPAWN_MS = 2000;
/** The player's health, a green bar like the machine's (Edgar, 2026-10-20): each attack that
 * lands takes HIT_DAMAGE of it and the room flashes red for HURT_MS; the hit that empties it
 * costs a life (the death beat above), and the bar is full again when the beat is over. */
const PLAYER_HEALTH = 100;
const HIT_DAMAGE = { staple: 25, page: 34, firePage: 43, ink: 50, nut: 68, bolt: 68 } as const;
const HURT_MS = 150;
/** A lost heart's ghost floating up can be shot (± GHOST_HIT_PAD virtual px around it): it pops
 * like a balloon, its bits gone after POP_MS (Edgar, 2026-10-20). No points: it was the player's. */
const GHOST_HIT_PAD = 3;
const POP_MS = 450;
/** The player's name under their bar (Edgar, 2026-10-20): NEW PLAYER until there is a login. At
 * WORN_HEALTH or less it shivers now and then (a letter flipping for a tick every NAME_FLIP_MS or
 * so); at ROUGH_HEALTH or less it is rough: jittering, split into red and cyan, its letters
 * breaking up every NAME_GLITCH_MS or so. */
const PLAYER_NAME = 'NEW PLAYER';
const WORN_HEALTH = 50;
const ROUGH_HEALTH = 25;
const NAME_FLIP_MS = 700;
const NAME_GLITCH_MS = 110;
const NAME_GLITCH_CHARS = '#%&/?!0X';
/** The printer's standby tick while the room is idle. */
const TICK_MS = 4000;
const AUTO_RELOAD_MS = 800;
/** A reload refills the shot pips in two steps this far apart: half at once, the rest right
 * after the slide is racked (the sound in sounds.ts ends at 330 ms; Edgar, 2026-10-19). */
const RELOAD_STEP_MS = 360;
/** Slowed to 2.5 / 3 / 2 s on Edgar's review of 2026-10-19, then a quarter faster on 2026-10-20. */
const FIRST_ATTACK_MS = 2000;
const ATTACK_GAP_MS = 2250;
const ATTACK_GAP_LATE_MS = 1500;
/** From this score on, the attacks come faster. */
const LATE_SCORE = 900;
const SCAN_MS = 600;
const WASH_MS = 300;
const STAPLE_MS = 1500;
const STAPLE_STAGGER_MS = 500;
/** The staple's hit box: its sprite at the current scale, plus this many virtual px around. */
const STAPLE_HIT_PAD = 3;
/** At half health or less the machine throws nuts and bolts too (Edgar, 2026-10-20): out of the
 * slot and at the camera like the staples, spinning, a little quicker, twice a page's damage
 * (HIT_DAMAGE), BOLT_POINTS when shot. */
const BOLT_HEALTH = 0.5;
const BOLT_MS = 1300;
const BOLT_STAGGER_MS = 400;
const BOLT_POINTS = 2;
const BOLT_SPIN_MS = 100;
/** 1.8 s, then a quarter longer on Edgar's review (2026-10-19): they were landing too fast. */
const PAGE_MS = 2250;
/** While the machine burns, the pages it throws are on fire (Edgar, 2026-10-20): a quarter more
 * damage (HIT_DAMAGE.firePage, 34 × 1.25) and twice the points when shot. */
const FIRE_PAGE_POINTS = PAGE_POINTS * 2;
const PAGE_STAGGER_MS = 450;
const PAGE_LANDED_MS = 1500;
const PAGE_SLIDE_MS = 400;
const HIT_FLASH_FRAMES = 2;
/** CONTINUE? counts 9 → 0, a second each; unanswered, it is a game over (Edgar, 2026-10-19). */
const CONTINUE_MS = 10_000;
/** Clicks this soon after death do not count as yes: the shot that died must not answer. */
const CONTINUE_ARM_MS = 300;
/** The frozen, dimmed room before Prntr ends on a game over. */
const OVER_HOLD_MS = 500;
/** PROTECT YOURSELF. and the binding under it stay this long, then fade (HINT_FADE_MS, as in prntr.css). */
const HINT_MS = 2000;
const HINT_FADE_MS = 500;
/** The open machine's button blinks bright red twice, rarely, so it looks like a target (Edgar, 2026-10-19). */
const BLINK_MIN_MS = 4000;
const BLINK_MAX_MS = 9000;
const BLINK_FIRST_MS = 1500;
/** Virtual px of the button on the 3× pose (MFC_MAD row 7, columns 24–26). */
const BUTTON = { x: 144, y: 101, w: 9, h: 3 };
/** A hit on the button (± BUTTON_HIT_PAD): more damage than the machine (15, then a quarter more:
 * Edgar, 2026-10-20), and the attacks come sooner, the gap × RAGE_STEP per hit, at most RAGE_MAX
 * times (Edgar, 2026-10-19). */
const BUTTON_POINTS = 19;
const BUTTON_HIT_PAD = 1;
const RAGE_STEP = 0.85;
const RAGE_MAX = 4;
/** Shooting one of the room's things breaks it, once, for this many points (Edgar, 2026-10-19). */
const BREAK_POINTS = 5;
/** The water jug breaking shorts the machine (Edgar, 2026-10-20): for SHORT_MS it zaps and sparks,
 * a burst of sparks off its wet side at each of SHORT_ZAPS_MS with a crackle and a flash of the
 * machine, before the fire takes. Then a fire on its wet side grows over the cooler for
 * FIRE_GROW_MS, and burns on at that size (Edgar, 2026-10-19). */
const SHORT_MS = 1800;
const SHORT_ZAPS_MS = [0, 380, 700, 1050, 1400];
/** Where the sparks come from: the machine's wet left foot on the 3× pose. */
const SHORT_AT = { x: 74, y: 140 };
const FIRE_GROW_MS = 12_000;
/** This long after the fire starts the machine is mad (Edgar, 2026-10-19): its slot glows red like
 * the door, its button stays bright, and it trembles (a new offset every SHAKE_FRAMES frames). */
const MAD_AFTER_MS = 1500;
const SHAKE_FRAMES = 3;
/** Once the machine's health is down to SPREAD_HEALTH and the fire is burning, it spreads onto the
 * machine over FIRE_SPREAD_MS; engulfed, the machine's health runs out over DEPLETE_MS and the
 * player wins, unless the machine gets them first (Edgar, 2026-10-19; three quarters, 2026-10-20). */
const SPREAD_HEALTH = 0.75;
const FIRE_SPREAD_MS = 20_000;
const DEPLETE_MS = 1500;
/** Shooting the machine where it burns stokes the fire (Edgar, 2026-10-20): every FIRE_STOKE_SHOTS
 * hits in the flames, the spread onto the machine takes STOKE_STEP of the time it had left, at
 * most STOKE_MAX times (about twice as fast); stoked before it spreads, it spreads faster when it
 * does. The shot does its damage as usual; the crackle flares for STOKE_FLARE_MS. */
const FIRE_STOKE_SHOTS = 3;
const STOKE_STEP = 0.8;
const STOKE_MAX = 3;
const STOKE_FLARE_MS = 400;
/** The mad machine's fourth attack (Edgar, 2026-10-19): ink sprayed from behind the machine,
 * cyan, magenta and yellow in turn, never black (it cannot do that). Each jet comes out of a tube
 * that rises from behind the machine's top edge at one of NOZZLES_X (Edgar, 2026-10-20): its head
 * comes up to TUBE_TOP over TUBE_RISE_MS before the jet starts and sinks back as long after it
 * ends; the tube is drawn behind the machine and the ink, and the first half of a particle's
 * flight behind the machine too. SPRAY_COUNT jets a volley, SPRAY_STAGGER_MS apart; a jet runs
 * SPRAY_MS, a particle every SPRAY_EVERY_MS, each flying SPRAY_FLIGHT_MS along an arc SPRAY_ARC
 * px high from the tube's mouth to the jet's target, where the splat builds up as they land.
 * Shooting the tube over the edge (± NOZZLE_HIT_PAD) blows it up; a splat that completes is a hit.
 * The splat blinds (Edgar, 2026-10-20): it builds to 4× (64×56 of the 240×160), stays
 * INK_LANDED_MS, then runs down the glass and out of the bottom of the view over INK_SLIDE_MS,
 * leaving INK_DRIPS streaks of ink above it as it goes. */
const SPRAY_COUNT = 3;
const SPRAY_STAGGER_MS = 600;
const SPRAY_MS = 1400;
const SPRAY_EVERY_MS = 40;
const SPRAY_FLIGHT_MS = 700;
const SPRAY_ARC = 24;
const NOZZLES_X = [96, 108, 120, 132, 144];
/** The machine's top edge on the 3× pose (MACHINE.y0), the tube's head when it is up, and its mouth. */
const TUBE_BASE = 80;
const TUBE_TOP = 72;
const TUBE_MOUTH = TUBE_TOP + 2;
const TUBE_RISE_MS = 250;
const NOZZLE_HIT_PAD = 4;
/** A tube shot blows up (Edgar, 2026-10-20): the jet stops, its bits fly, the nozzle is dead for
 * the rest of the stage (its stump stays); with every nozzle dead the ink attack is gone. */
const TUBE_POINTS = 5;
const INK_LANDED_MS = 1500;
const INK_SLIDE_MS = 1800;
const INK_DRIPS = 4;
const INK_COLORS = ['c', 'm', 'y'] as const;
/** While the fire burns, the last jet of a volley goes at it instead of the player (Edgar,
 * 2026-10-20): where it lands the flames go out. The fire loses SNUFF_U of its growth and grows
 * back from there; left with less than SNUFF_OUT, it is out for good. A jet that is stopped
 * does nothing to it. */
const SNUFF_U = 0.35;
const SNUFF_OUT = 0.1;
/** The EXIT sign (Edgar, 2026-10-19), BREAK_POINTS a hit: its hit box (the sprite plus 2 px, and the
 * room it swings in); the first hit knocks it loose and its letters are on only in these ms windows
 * after it, then out; the second brings it down over EXIT_FALL_MS from the wall to the floor. */
const EXIT_HIT = { x0: 15, y0: 29, x1: 36, y1: 45 };
const EXIT_FLICKER: [number, number][] = [
  [0, 140],
  [280, 400],
  [620, 700],
];
const EXIT_FALL_MS = 550;
const EXIT_WALL = { x: 17, y: 31 };
const EXIT_FLOOR = { x: 20, y: 108 };
/** The door (Edgar, 2026-10-19): ajar DOOR_AJAR px on black; DOOR_DELAY_MS after the sign hits the
 * floor it creaks open to DOOR_OPEN px over DOOR_OPEN_MS, and the red from inside reaches into
 * the room (.prntr-room-frame.is-open, prntr.css). It never closes again. */
const DOOR_AJAR = 6;
const DOOR_OPEN = 22;
const DOOR_DELAY_MS = 400;
const DOOR_OPEN_MS = 1400;
/** A shot that hits nothing to break leaves a hole (Edgar, 2026-10-20): dark in the wall and the
 * ceiling, lit red through the door and the window's blind, as if the red behind the door were
 * behind everything. The oldest go past HOLES_MAX. The carpet takes no mark. */
const HOLES_MAX = 150;
const DOOR = { x0: 10, y0: 40, x1: 44, y1: 108 };
const WINDOW = { x0: 160, y0: 36, x1: 224, y1: 90 };
/** The carpet starts here. */
const FLOOR_Y = 109;
/** This many holes in the blind and it comes apart, for BREAK_POINTS (Edgar, 2026-10-20; six, then half again as many). */
const WINDOW_BREAK_SHOTS = 9;
/** Beaten, the machine bursts apart (Edgar, 2026-10-20): engulfed by the fire, or at 1337 by the
 * gun. Its eight pieces fly out and up and fall under PIECE_GRAVITY px/s² to the floor, each a
 * little nearer than the last; if there is a fire it rages on, its flames on the machine growing
 * by RAGE_MORE over the second after the score runs out instead of dying down; without one the
 * machine just falls apart in the dark room. A triumphant tune starts FANFARE_AFTER_MS after the
 * bang (the stage is won: there is no stage after this one), and the stage ends WIN_END_MS after
 * the burst, once the tune is over. */
const PIECE_GRAVITY = 260;
const RAGE_MORE = 0.25;
const FANFARE_AFTER_MS = 500;
const WIN_END_MS = 4300;

/** The machine at 3×: the gun's target. */
const MACHINE = { x0: 72, y0: 80, x1: 168, y1: 146 };
/** The machine's output slot on the 3× pose (MFC_MAD row 11): pages and staples come out of it (Edgar, 2026-10-19). */
const SLOT = { x0: 84, x1: 153, y: 113 };
/** The first part of a page's flight is spent rising out of the slot, row by row. */
const PAGE_EJECT = 0.2;
/** The first part of a staple's flight is spent punching up out of the slot, with a clack. */
const STAPLE_EJECT = 0.15;
const PAGE_TARGETS_X = [30, 75, 120, 165, 210];
/** Where each of the five pages comes out, left to right along the slot. */
const PAGE_ORIGINS_X = [94, 107, 120, 133, 146];
/** The USB stick on the carpet (USB at 2× at 166,136): its centre, and what finding it says before
 * the beat starts USB_PLUG_MS later (Edgar, 2026-10-19; the handoff started the fight from the sticker). */
const USB = { x: 176, y: 141 };
const USB_CAPTION = 'YOU FOUND A USB. YOU PLUG IT INTO THE PRINTER.';
const USB_PLUG_MS = 2200;
/** The first aid kit's hotspot and hit box: its sprite (KIT_AT in scene.ts) plus 3 px. Shot, it gives
 * the player full health, once, and hangs open and empty after (Edgar, 2026-10-20). No points. */
const KIT_HIT = { x0: KIT_AT.x - 3, y0: KIT_AT.y - 3, x1: KIT_AT.x + 16, y1: KIT_AT.y + 13 };
/** The clock's and the post-it board's hotspots: their sprites (CLOCK_AT, BOARD_AT in scene.ts) plus 4 px. */
const CLOCK_HIT = { x0: 64, y0: 37, x1: 88, y1: 60 };
const BOARD_HIT = { x0: 132, y0: 42, x1: 160, y1: 68 };
/** What the gun can break and where (virtual px, half-open rects): the clock and the board (the
 * poster) as their hotspots; the cooler's bottle (COOLER rows 0–7 at 2×), the plant's leaves (PLANT
 * rows 0–9 at 2×) and its pot (rows 10–15), each with a 2 px margin. Not the door, not the machine. */
const BREAKABLES: { id: keyof Broken; x0: number; y0: number; x1: number; y1: number; sound: 'shatter' | 'tear' | 'rustle' | 'knock' }[] = [
  { id: 'clock', ...CLOCK_HIT, sound: 'knock' },
  { id: 'poster', ...BOARD_HIT, sound: 'tear' },
  { id: 'tank', x0: 48, y0: 90, x1: 76, y1: 108, sound: 'shatter' },
  { id: 'plant', x0: 198, y0: 101, x1: 230, y1: 123, sound: 'rustle' },
  { id: 'vase', x0: 204, y0: 123, x1: 224, y1: 137, sound: 'shatter' },
];
/** The clock shot (Edgar, 2026-10-20): it falls off the wall over CLOCK_FALL_MS, drifting to
 * CLOCK_LAND_X, to the floor in front of the cooler (its top at CLOCK_FLOOR_Y, its bottom at 140,
 * nearer than the cooler's base), bounces, and rolls to the left over CLOCK_ROLL_MS, slowing,
 * to rest at CLOCK_REST_X, a quarter turn every CLOCK_ROLL_PX. Rolling or at rest within
 * CLOCK_IGNITE_PAD of the burning cooler's flames, it catches fire and rolls on to the left at
 * CLOCK_BURN_SPEED px/s until it is out of the frame. */
const CLOCK_FALL_MS = 550;
const CLOCK_LAND_X = 70;
const CLOCK_FLOOR_Y = 125;
const CLOCK_ROLL_MS = 2000;
const CLOCK_REST_X = 28;
const CLOCK_ROLL_PX = 12;
const CLOCK_IGNITE_PAD = 2;
const CLOCK_BURN_SPEED = 28;
/** The USB stick's hit area in screen px (the handoff's 44 px for the sticker), whatever the scale. */
const USB_HIT_PX = 44;

interface Hotspot {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Odd clicks show the first, even clicks the second. */
  captions: [string, string];
}

/** Sprite bounds plus 4 virtual px; tested in this order (the tray page before the printer). */
const HOTSPOTS: Hotspot[] = [
  { id: 'page', x0: 94, y0: 114, x1: 112, y1: 135, captions: ['A PAGE. BLANK.', 'A PAGE. BLANK.'] },
  { id: 'printer', x0: 84, y0: 96, x1: 156, y1: 148, captions: ["A PRINTER. IT'S ON.", "IT'S WARM."] },
  // Too frightening to go through (Edgar, 2026-10-19; the handoff had LOCKED. / STILL LOCKED.).
  { id: 'door', x0: 6, y0: 27, x1: 48, y1: 112, captions: ['NOT IN THERE.', "IT KNOWS YOU'RE HERE."] },
  { id: 'poster', ...BOARD_HIT, captions: ['SIMPLE PRODUCTS. WE PRINT.', 'SIMPLE PRODUCTS. WE PRINT.'] },
  { id: 'clock', ...CLOCK_HIT, captions: ['1:37.', '1:37.'] },
  // The blind is down over it (Edgar, 2026-10-20; the handoff had IT'S BRIGHT OUT.).
  { id: 'kit', ...KIT_HIT, captions: ['A FIRST AID KIT. GREEN.', 'A FIRST AID KIT. GREEN.'] },
  { id: 'window', x0: 156, y0: 32, x1: 228, y1: 94, captions: ['UNABLE TO OPEN.', 'STILL UNABLE TO OPEN.'] },
  { id: 'cooler', x0: 46, y0: 88, x1: 78, y1: 140, captions: ['WATER COOLER. FULL.', 'STILL FULL.'] },
  { id: 'plant', x0: 196, y0: 99, x1: 232, y1: 139, captions: ["A PLANT. IT'S REAL.", "A PLANT. IT'S REAL."] },
];

const ROOM_ALT =
  'A quiet office: drop ceiling with two fluorescent panels, a door ajar on black with an EXIT sign, a clock, a Simple Products board with notes on it by a window with its blind down and a green first aid kit at its lower right, a water cooler, a plant, one large copier in the middle, and a USB stick on the carpet beside it';

type Phase = 'look' | 'sticker' | 'fight' | 'continue' | 'over' | 'end';
type AttackKind = 'scan' | 'staples' | 'pages' | 'ink' | 'bolts';

/** A staple, or a nut or a bolt: all thrown out of the slot at the camera. */
type ThrownKind = 'staple' | 'nut' | 'bolt';
const THROWN_SPR: Record<ThrownKind, keyof typeof SPR> = { staple: 'STAPLE', nut: 'NUT', bolt: 'BOLT' };

interface Staple {
  kind: ThrownKind;
  /** Its flight time, from the slot to the camera. */
  ms: number;
  /** Where it leaves the slot, and where it arrives. */
  x0: number;
  x: number;
  y: number;
  at: number;
  hit: boolean;
  shot: boolean;
  /** The clack has played. */
  fed: boolean;
}

interface Spray {
  /** The nozzle's x on the lid line, and where the jet lands. */
  nx: number;
  x: number;
  y: number;
  at: number;
  color: (typeof INK_COLORS)[number];
  /** Aimed at the fire, not the player: landing, it puts out what it touches. */
  fire: boolean;
  /** The nozzle was shot at this moment: the jet stops, what is in the air still lands. */
  stoppedAt: number | null;
  /** The whole jet has landed: the hit has been taken. */
  done: boolean;
  /** The hiss has played. */
  fed: boolean;
}

interface Page {
  /** Thrown while the machine burns: it is on fire. */
  burning: boolean;
  /** Where it leaves the slot, and where it lands. */
  x0: number;
  x1: number;
  y1: number;
  at: number;
  landedAt: number | null;
  shot: boolean;
  /** The feed sound has played. */
  fed: boolean;
}

/** A particle on the front layer (steam off the snuffed fire): thrown from x,y at born, under gravity g, for life ms. */
interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  born: number;
  life: number;
  size: number;
  color: PalKey;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Stage 1, the room: look around, click the sticker, fight the machine to 1337, one
 * second of quiet, out; or run out of hearts and it is over. Design: prntr/design/PRNTR-HANDOFF-STAGE-1.md §2–§3 (local);
 * spec: PRNTR-STAGE-1.md. The page in ctx.page is not used: the room is not about it.
 */
export const room: Stage = {
  name: 'room',
  async run(ctx) {
    const { root, signal, audio } = ctx;
    // The dev entrance can land here before the fonts are in (stage 0 waits for them).
    await Promise.race([ctx.fontsReady, wait(1500, signal)]);
    if (signal.aborted) return { kind: 'start' };
    const reduced = reducedMotion();
    const sounds = createRoomSounds(audio);
    root.replaceChildren();

    // ---- DOM: the pixel layer, the three overlays, the HUD ----------------
    const wrap = el('div', 'prntr-room');
    const frame = el('div', 'prntr-room-frame');
    const canvas = document.createElement('canvas');
    canvas.className = 'prntr-room-canvas';
    canvas.width = W;
    canvas.height = H;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', ROOM_ALT);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (!g) throw new Error('prntr: no 2d context');
    // The pointer and crosshair on a transparent canvas of their own, above the door's
    // light, the spill and the glows, so the cursor is never behind them (Edgar, 2026-10-19).
    const cursor = document.createElement('canvas');
    cursor.className = 'prntr-room-cursor';
    cursor.width = W;
    cursor.height = H;
    cursor.setAttribute('aria-hidden', 'true');
    const cg = cursor.getContext('2d');
    if (!cg) throw new Error('prntr: no 2d context');
    // The things the machine throws (pages, staples, ink) on a transparent canvas of their own,
    // above the slot's red light, so the glow is behind the paper (Edgar, 2026-10-20).
    const front = document.createElement('canvas');
    front.className = 'prntr-room-front';
    front.width = W;
    front.height = H;
    front.setAttribute('aria-hidden', 'true');
    const fg = front.getContext('2d', { willReadFrequently: true });
    if (!fg) throw new Error('prntr: no 2d context');
    const light = el('div', 'prntr-room-light');
    const spill = el('div', 'prntr-room-spill');
    // The fire's light: an unpixelated orange glow sized to the flames each frame.
    const fireLight = el('div', 'prntr-room-fire-light');
    fireLight.hidden = true;
    // The mad machine's slot, lit red like the door (.is-mad on the frame fades it in).
    const slotLight = el('div', 'prntr-room-slot-light');
    // The red light through the holes in the door and the blind, one box per hole.
    const holeLights = el('div', 'prntr-room-hole-lights');
    // The window shot open: the red pours through it (a glow, and the fill clipped off the
    // machine's corner), and reaches that side of the room with a multiply wash of its own.
    const windowLight = el('div', 'prntr-room-window-light');
    windowLight.append(el('div', 'prntr-room-window-fill'));
    const dreadWindow = el('div', 'prntr-room-dread-window');
    // The red that reaches into the room once the door is open: a multiply wash, off until then.
    const dread = el('div', 'prntr-room-dread');
    const wash = el('div', 'prntr-room-wash');
    // The red glow on everything that can be shot: DOM boxes over the pixel layer,
    // unpixelated like the door's light (Edgar, 2026-10-19). One per projectile, pooled.
    const glows = el('div', 'prntr-room-glows');
    for (const n of [light, spill, fireLight, slotLight, holeLights, windowLight, dread, dreadWindow, wash, glows]) n.setAttribute('aria-hidden', 'true');
    const hud = el('div', 'prntr-room-hud');
    const scoreEl = el('div', 'prntr-room-score', 'SCORE 0000');
    const hiEl = el('div', 'prntr-room-hi', 'HI 1337');
    const creditEl = el('div', 'prntr-room-credit', 'CREDIT 01');
    // Read out through ctx.announce instead, so it is not read twice.
    const captionEl = el('div', 'prntr-room-caption');
    captionEl.setAttribute('aria-hidden', 'true');
    // Set like an old TV's closed captions: white letters on a black box (Edgar, 2026-10-20).
    const captionText = el('span', 'prntr-room-caption-text');
    captionEl.append(captionText);
    const healthEl = el('div', 'prntr-room-health prntr-room-fight-ui');
    healthEl.setAttribute('role', 'img');
    healthEl.setAttribute('aria-label', `${MODEL}, printer health`);
    const healthFill = el('div', 'prntr-room-health-fill');
    healthEl.append(healthFill);
    const healthName = el('div', 'prntr-room-health-name prntr-room-fight-ui', MODEL);
    healthName.setAttribute('aria-hidden', 'true');
    const lifeEl = el('div', 'prntr-room-life prntr-room-fight-ui');
    lifeEl.setAttribute('role', 'img');
    const lifeFill = el('div', 'prntr-room-life-fill');
    lifeEl.append(lifeFill);
    // The player's name under the bar's left end, as the machine's is over its own.
    const lifeName = el('div', 'prntr-room-life-name prntr-room-fight-ui', PLAYER_NAME);
    lifeName.setAttribute('aria-hidden', 'true');
    const pipsEl = el('div', 'prntr-room-pips prntr-room-fight-ui');
    pipsEl.setAttribute('role', 'img');
    for (let i = 0; i < LIVES_MAX; i++) pipsEl.append(el('span', ''));
    const shotsBtn = document.createElement('button');
    shotsBtn.type = 'button';
    shotsBtn.className = 'prntr-room-shots prntr-room-fight-ui';
    for (let i = 0; i < SHOTS; i++) shotsBtn.append(el('span', ''));
    for (const n of [healthEl, healthName, lifeEl, lifeName, pipsEl, shotsBtn]) n.hidden = true;
    // When the fight starts: what to do, and the one binding that matters (Edgar, 2026-10-19).
    const hintEl = el('div', 'prntr-room-hint');
    hintEl.setAttribute('aria-hidden', 'true');
    const touch = window.matchMedia('(hover: none)').matches;
    hintEl.append(el('div', 'prntr-room-hint-title', 'PROTECT YOURSELF.'), el('div', 'prntr-room-hint-keys', touch ? 'TAP TO SHOOT' : 'CLICK TO SHOOT'));
    hintEl.hidden = true;
    hud.append(scoreEl, hiEl, creditEl, captionEl, healthEl, healthName, lifeEl, lifeName, pipsEl, shotsBtn, hintEl);
    const continueEl = el('div', 'prntr-room-continue');
    const countEl = el('div', 'prntr-room-continue-count', '9');
    continueEl.append(el('div', 'prntr-room-continue-label', 'CONTINUE?'), countEl);
    continueEl.hidden = true;
    // The game-over dim: the same wash as CONTINUE?, with nothing written on it.
    const overEl = el('div', 'prntr-room-over');
    overEl.setAttribute('aria-hidden', 'true');
    overEl.hidden = true;
    // A hit that leaves health: the room flashes red, nothing stops.
    const hurtEl = el('div', 'prntr-room-hurt');
    hurtEl.setAttribute('aria-hidden', 'true');
    hurtEl.hidden = true;
    // The death beat's red dim (a life lost, more to come).
    const deathEl = el('div', 'prntr-room-death');
    deathEl.setAttribute('aria-hidden', 'true');
    deathEl.hidden = true;
    frame.append(canvas, light, spill, fireLight, slotLight, holeLights, windowLight, front, dread, dreadWindow, wash, glows, hud, cursor, hurtEl, deathEl, continueEl, overEl);
    wrap.append(frame);
    root.append(wrap);

    // ---- fit: the largest whole-number scale, letterboxed in black --------
    let scale = 1;
    const fit = () => {
      scale = Math.max(1, Math.floor(Math.min(root.clientWidth / W, root.clientHeight / H)));
      frame.style.width = `${W * scale}px`;
      frame.style.height = `${H * scale}px`;
      frame.style.setProperty('--s', String(scale));
      frame.classList.toggle('is-small', scale <= 3);
    };
    fit();
    window.addEventListener('resize', fit, { signal });
    const toVirtual = (e: PointerEvent) => {
      const r = frame.getBoundingClientRect();
      return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    };

    // ---- state ------------------------------------------------------------
    const pix = new Pix();
    const fpix = new Pix();
    const cpix = new Pix();
    const scene: SceneState = {
      lights: [true, true],
      printer: 'idle',
      ledRed: false,
      trayPage: true,
      usb: true,
      scanRow: 0,
      flashWhite: false,
      buttonBright: false,
      broken: { clock: false, poster: false, tank: false, plant: false, vase: false, kit: false },
      clock: { state: 'up', x: CLOCK_AT.x, y: CLOCK_AT.y, rot: 0 },
      exit: { state: 'up', x: EXIT_WALL.x, y: EXIT_WALL.y, tilt: 0, lit: true },
      doorGap: DOOR_AJAR,
      fire: null,
      shake: { x: 0, y: 0 },
      inkBehind: [],
      tubes: [],
      stubs: [],
      holes: [],
      windowOpen: false,
      pieces: [],
      damage: 0,
    };
    /** Holes in the blind so far. */
    let windowShots = 0;
    /** The red light of each hole through the door or the blind. */
    const holeLightOf = new Map<Hole, HTMLElement>();
    let phase: Phase = 'look';
    let phaseAt = performance.now();
    /** While CONTINUE? shows, the pixel layer is drawn at this moment. */
    let frozenAt: number | null = null;
    let score = 0;
    let lives = LIVES_START;
    let health = PLAYER_HEALTH;
    /** The hurt flash shows until this moment (0 = none). */
    let hurtUntil = 0;
    /** The death beat runs until this moment (0 = none). */
    let deathUntil = 0;
    let shots = SHOTS;
    /** Virtual px; null on touch or when the mouse is outside the frame. */
    let pointer: { x: number; y: number } | null = null;
    let flashFrames = 0;
    let invertFrame = false;
    let lastTickAt = phaseAt;
    /** The USB has been found; the beat starts at this moment. */
    let plugAt: number | null = null;
    let stickerStep = 0;
    let endStep = 0;
    let staples: Staple[] = [];
    let pages: Page[] = [];
    let sprays: Spray[] = [];
    let bits: Bit[] = [];
    let attackIndex = 0;
    let nextAttackAt = 0;
    let scanAt: number | null = null;
    let washUntil = 0;
    let autoReloadAt: number | null = null;
    let reloadSecondAt: number | null = null;
    /** The one continue has been used: the next death is the end. */
    let continued = false;
    let outcome: 'cleared' | 'over' = 'cleared';
    let hintFadeAt = 0;
    let hintHideAt = 0;
    let blinkAt = -Infinity;
    let nextBlinkAt = Infinity;
    /** Hits on the button so far (capped): each one brings the attacks closer together. */
    let rage = 0;
    /** The first shot has been fired: the office has emptied out. */
    let panicked = false;
    /** When the EXIT sign was last hit (its flicker, swing and fall count from here). */
    let exitAt = 0;
    /** When the clock's current state began, and where it was and how it lay then. */
    let clockAt = 0;
    let clockX0 = CLOCK_AT.x;
    let clockRot0 = 0;
    /** The machine is shorting out from this moment (the water jug broke); the fire takes SHORT_MS later. */
    let shortAt: number | null = null;
    let shortZaps = 0;
    /** When the fire started, and its crackle. */
    let fireAt: number | null = null;
    let fireSound: FireSound | null = null;
    /** The fire's growth, 0 (just lit) to 1 (full), from when it was lit (or last snuffed back). */
    const fireU = (now: number) => (fireAt === null ? 0 : Math.min(1, (now - fireAt) / FIRE_GROW_MS));
    /** When the fire began spreading onto the machine, and when its health began to run out (from this score). */
    let spreadAt: number | null = null;
    let depleteAt: number | null = null;
    let depleteFrom = 0;
    /** The machine burst at this moment (engulfed), its pieces thrown like this. */
    let burstAt = 0;
    let thrown: { hx: number; hy: number; vx: number; vy: number; floor: number; land: number }[] = [];
    /** How long the spread onto the machine takes, shortened by each stoke. */
    let spreadMs = FIRE_SPREAD_MS;
    let fireShots = 0;
    let stokes = 0;
    let stokeAt = -Infinity;
    /** The machine is mad (MAD_AFTER_MS into the fire): the cues above, and the ink to come. */
    let mad = false;
    let frameCount = 0;
    /** When the door starts to open (set as the sign lands), and when it did. */
    let doorAt: number | null = null;
    let doorOpenAt: number | null = null;
    /** The width the door's light is drawn at, so the style is set only when it changes. */
    let lightGap = DOOR_AJAR;
    const attackGap = () => Math.round((score >= LATE_SCORE ? ATTACK_GAP_LATE_MS : ATTACK_GAP_MS) * Math.pow(RAGE_STEP, rage));
    const scheduleBlink = (from: number, delay: number) => {
      nextBlinkAt = from + delay + Math.random() * (BLINK_MAX_MS - BLINK_MIN_MS);
    };
    /** Two short flashes: on 0–120 ms, off, on 220–340 ms. */
    const buttonBright = (now: number) => {
      const bt = now - blinkAt;
      return bt < 120 || (bt >= 220 && bt < 340);
    };
    const clicks = new Map<string, number>();
    const hum: Hum = sounds.hum();
    /** Set inside the promise at the bottom: stops the loop and resolves `outcome`. */
    let finish: () => void = () => undefined;

    // ---- HUD --------------------------------------------------------------
    const setCaption = (text: string) => {
      captionText.textContent = text;
      if (text) ctx.announce(text);
    };
    const drawScore = () => {
      scoreEl.textContent = 'SCORE ' + String(score).padStart(4, '0');
      // The health bar is the score, inverted: HI 1337 was its life all along.
      healthFill.style.width = `${(1 - score / HI) * 100}%`;
    };
    const drawHealth = () => {
      lifeFill.style.width = `${health}%`;
      lifeEl.setAttribute('aria-label', `${PLAYER_NAME}, health ${health} of ${PLAYER_HEALTH}`);
      // the name wears with the bar: worn at half, rough near the end
      lifeName.classList.toggle('is-worn', health <= WORN_HEALTH && health > ROUGH_HEALTH);
      lifeName.classList.toggle('is-rough', health <= ROUGH_HEALTH);
      nameAt = 0;
    };
    /** The name's next flip or glitch, and when a flipped letter goes back (0 = none). */
    let nameAt = 0;
    let nameBackAt = 0;
    /** The name with `n` of its letters broken (a glitch character or a gap). */
    const brokenName = (n: number) => {
      const chars = PLAYER_NAME.split('');
      for (let k = 0; k < n; k++) {
        const i = Math.floor(Math.random() * chars.length);
        if (chars[i] === ' ') continue;
        chars[i] = Math.random() < 0.25 ? ' ' : NAME_GLITCH_CHARS[Math.floor(Math.random() * NAME_GLITCH_CHARS.length)];
      }
      return chars.join('');
    };
    // Worn: a letter flips for a tick now and then. Rough: the letters break up over and over.
    // Under reduced motion the rough name is broken once and stays so, and the worn one is plain.
    const poseName = (now: number) => {
      if (lifeName.hidden) return;
      const rough = lifeName.classList.contains('is-rough');
      const worn = lifeName.classList.contains('is-worn');
      if (!rough && !worn) {
        if (lifeName.textContent !== PLAYER_NAME) lifeName.textContent = PLAYER_NAME;
        return;
      }
      if (reduced) {
        if (nameAt === 0) {
          nameAt = now;
          lifeName.textContent = rough ? brokenName(2) : PLAYER_NAME;
        }
        return;
      }
      if (nameBackAt && now >= nameBackAt) {
        nameBackAt = 0;
        lifeName.textContent = PLAYER_NAME;
      }
      if (now < nameAt) return;
      if (rough) {
        nameAt = now + NAME_GLITCH_MS * (0.6 + Math.random() * 0.8);
        lifeName.textContent = Math.random() < 0.2 ? PLAYER_NAME : brokenName(1 + Math.floor(Math.random() * 3));
      } else {
        nameAt = now + NAME_FLIP_MS * (0.7 + Math.random() * 0.8);
        lifeName.textContent = brokenName(1);
        nameBackAt = now + 80;
      }
    };
    const drawPips = () => {
      Array.from(pipsEl.children).forEach((p, i) => p.classList.toggle('is-off', i >= lives));
      pipsEl.setAttribute('aria-label', `Lives ${lives} of ${LIVES_MAX}`);
    };
    // The heart just lost turns into its ghost and floats up from the hearts to the top of the
    // frame (Edgar, 2026-10-20); --rise is how far that is.
    const heartGhost = (i: number) => {
      const heart = pipsEl.children[i] as HTMLElement | undefined;
      if (!heart) return;
      const hr = heart.getBoundingClientRect();
      const fr = frame.getBoundingClientRect();
      const ghost = el('span', reduced ? 'prntr-room-heart-ghost is-still' : 'prntr-room-heart-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.left = `${hr.left - fr.left}px`;
      ghost.style.top = `${hr.top - fr.top}px`;
      ghost.style.width = `${hr.width}px`;
      ghost.style.height = `${hr.height}px`;
      ghost.style.setProperty('--rise', `${hr.bottom - fr.top}px`);
      ghost.addEventListener(
        'animationend',
        () => {
          ghost.remove();
          ghosts.splice(ghosts.indexOf(ghost), 1);
        },
        { once: true },
      );
      hud.append(ghost);
      ghosts.push(ghost);
    };
    /** The ghosts still floating, oldest first. */
    const ghosts: HTMLElement[] = [];
    // A ghost shot pops like a balloon: the heart swells and is gone, six pale bits fly out.
    const popGhost = (ghost: HTMLElement) => {
      ghosts.splice(ghosts.indexOf(ghost), 1);
      const gr = ghost.getBoundingClientRect();
      const fr = frame.getBoundingClientRect();
      ghost.remove();
      sounds.pop();
      if (reduced) return;
      const pop = el('span', 'prntr-room-heart-pop');
      pop.setAttribute('aria-hidden', 'true');
      pop.style.left = `${gr.left - fr.left}px`;
      pop.style.top = `${gr.top - fr.top}px`;
      pop.style.width = `${gr.width}px`;
      pop.style.height = `${gr.height}px`;
      pop.append(el('span', 'prntr-room-heart-pop-heart'));
      for (let i = 0; i < 6; i++) {
        const shard = el('span', 'prntr-room-heart-shard');
        const a = (i / 6) * 2 * Math.PI + Math.random() * 0.5;
        const d = (5 + Math.random() * 4) * scale;
        shard.style.setProperty('--dx', `${Math.cos(a) * d}px`);
        shard.style.setProperty('--dy', `${Math.sin(a) * d - 2 * scale}px`);
        pop.append(shard);
      }
      hud.append(pop);
      window.setTimeout(() => pop.remove(), POP_MS);
    };
    const drawShots = () => {
      Array.from(shotsBtn.children).forEach((p, i) => p.classList.toggle('is-off', i >= shots));
      shotsBtn.setAttribute('aria-label', `Shots ${shots} of ${SHOTS}. Reload`);
    };
    const showFightUi = (on: boolean) => {
      for (const n of [healthEl, healthName, lifeEl, lifeName, pipsEl, shotsBtn]) {
        n.classList.remove('is-in');
        n.hidden = !on;
        if (on) {
          void n.offsetWidth; // flush, so the fade-in runs from 0
          n.classList.add('is-in');
        }
      }
    };
    drawScore();
    drawHealth();
    drawPips();
    drawShots();

    // ---- phases -----------------------------------------------------------
    const startSticker = (now: number) => {
      phase = 'sticker';
      phaseAt = now;
      stickerStep = 0;
    };
    const startFight = (now: number) => {
      phase = 'fight';
      phaseAt = now;
      showFightUi(true);
      hintEl.hidden = false;
      void hintEl.offsetWidth;
      hintEl.classList.add('is-in');
      hintFadeAt = now + HINT_MS;
      hintHideAt = now + HINT_MS + HINT_FADE_MS;
      nextAttackAt = now + FIRST_ATTACK_MS;
      scheduleBlink(now, BLINK_FIRST_MS);
      ctx.announce(`The printer is open. Protect yourself. ${touch ? 'Tap' : 'Click'} to shoot.`);
    };
    const startContinue = (now: number) => {
      phase = 'continue';
      phaseAt = now;
      frozenAt = now;
      lives = 0;
      drawPips();
      creditEl.textContent = 'CREDIT 00';
      creditEl.classList.remove('is-glowing', 'is-after');
      countEl.textContent = '9';
      continueEl.hidden = false;
      sounds.death();
      ctx.announce('Continue?');
    };
    // Yes: the credit comes back, the fight resumes with the last heart.
    const continueYes = (now: number) => {
      creditEl.textContent = 'CREDIT 01';
      creditEl.classList.add('is-after');
      audio.play(audio.cues.creditA);
      continueEl.hidden = true;
      continued = true;
      frozenAt = null;
      lives = LIVES_CONTINUE;
      health = PLAYER_HEALTH;
      drawHealth();
      shots = SHOTS;
      autoReloadAt = null;
      reloadSecondAt = null;
      staples = [];
      pages = [];
      sprays = [];
      scanAt = null;
      scene.scanRow = 0;
      wash.classList.remove('is-on');
      washUntil = 0;
      drawPips();
      drawShots();
      phase = 'fight';
      phaseAt = now;
      nextAttackAt = now + ATTACK_GAP_MS;
      scheduleBlink(now, BLINK_MIN_MS);
      ctx.announce('Credit 1. Last life.');
    };
    const hideHint = () => {
      hintEl.hidden = true;
      hintEl.classList.remove('is-in');
      hintFadeAt = hintHideAt = 0;
    };
    // A click in the first moments after death is the shot that died, not an answer.
    const answerContinue = (now: number) => {
      if (phase === 'continue' && now - phaseAt >= CONTINUE_ARM_MS) continueYes(now);
    };
    // The last heart gone, or the count run out: the frozen, dimmed room, then out.
    const startOver = (now: number) => {
      phase = 'over';
      phaseAt = now;
      frozenAt ??= now;
      outcome = 'over';
      hideHint();
      continueEl.hidden = true;
      overEl.hidden = false;
      sounds.gameOver();
      ctx.announce('Game over.');
    };
    // Engulfed: the machine bursts into its pieces, thrown out and up from its middle, and the
    // fight is as good as won. Nothing more comes out of it.
    const burst = (now: number) => {
      scene.printer = 'wreck';
      burstAt = now;
      thrown = MACHINE_PIECES.map((pc, i) => {
        const cx = pc.hx + pc.spr.w / 2;
        const vx = (cx - 16) * (2.5 + Math.random() * 2) + (Math.random() - 0.5) * 20;
        const vy = -(50 + Math.random() * 110) - (pc.hy === 0 ? 60 : 0);
        const floor = 146 + 2 + ((i * 5) % 9);
        const hy = MACHINE.y0 + pc.hy * 3;
        const h = pc.spr.h * 3;
        // when its bottom reaches its floor: ½g t² + vy t + (hy + h − floor) = 0
        const land = (-vy + Math.sqrt(vy * vy - 2 * PIECE_GRAVITY * (hy + h - floor))) / PIECE_GRAVITY;
        return { hx: MACHINE.x0 + pc.hx * 3, hy, vx, vy, floor, land };
      });
      staples = [];
      pages = [];
      sprays = [];
      scanAt = null;
      scene.scanRow = 0;
      scene.shake = { x: 0, y: 0 };
      nextAttackAt = Infinity;
      frame.classList.remove('is-mad');
      wash.classList.remove('is-on');
      washUntil = 0;
      flashFrames = HIT_FLASH_FRAMES * 2;
      sounds.burst();
      // the tune, once the pieces are coming down
      window.setTimeout(() => {
        if (!signal.aborted) sounds.fanfare();
      }, FANFARE_AFTER_MS);
      ctx.announce('The printer bursts apart.');
    };
    const posePieces = (now: number) => {
      const t = reduced ? Infinity : (now - burstAt) / 1000;
      scene.pieces = thrown.map((q, i) => {
        const pc = MACHINE_PIECES[i];
        const tt = Math.min(t, q.land);
        return { spr: pc.spr, x: q.hx + q.vx * tt, y: tt >= q.land ? q.floor - pc.spr.h * 3 : q.hy + q.vy * tt + 0.5 * PIECE_GRAVITY * tt * tt };
      });
    };
    // 1337: the machine is beaten. By the gun it bursts apart now; by the fire it already has.
    const startEnd = (now: number) => {
      phase = 'end';
      phaseAt = now;
      endStep = 0;
      hideHint();
      if (scene.printer !== 'wreck') burst(now);
      setCaption('');
      ctx.announce('1337.');
    };
    /** Dev only: nothing costs a life (the harness, to watch the fire take the machine). */
    let god = false;
    // A hit is a life. Everything in the air goes with it; with lives left, the death beat.
    const die = (now: number) => {
      if (phase !== 'fight' || frozenAt !== null || god) return;
      lives--;
      health = 0;
      drawHealth();
      hurtUntil = 0;
      hurtEl.hidden = true;
      heartGhost(lives);
      drawPips();
      staples = [];
      pages = [];
      sprays = [];
      scanAt = null;
      scene.scanRow = 0;
      wash.classList.remove('is-on');
      washUntil = 0;
      if (lives === 0) {
        (continued ? startOver : startContinue)(now);
        return;
      }
      frozenAt = now;
      deathUntil = now + DEATH_MS;
      deathEl.hidden = false;
      sounds.death();
      ctx.announce(`Hit. ${lives} ${lives === 1 ? 'life' : 'lives'} left.`);
    };
    // An attack lands: it takes its damage; the one that empties the bar is a life.
    const hurt = (kind: keyof typeof HIT_DAMAGE, now: number) => {
      if (phase !== 'fight' || frozenAt !== null || god) return;
      health = Math.max(0, health - HIT_DAMAGE[kind]);
      drawHealth();
      if (health === 0) {
        die(now);
        return;
      }
      lifeEl.classList.remove('is-hurt');
      void lifeEl.offsetWidth; // flush, so the blink restarts
      lifeEl.classList.add('is-hurt');
      hurtEl.hidden = false;
      hurtUntil = now + HURT_MS;
      ctx.announce(`Hit. Health ${health}.`);
    };
    const addScore = (n: number, now: number) => {
      // The counter never passes 1337, whatever the last hit was worth.
      score = Math.min(HI, score + n);
      drawScore();
      if (score >= HI) startEnd(now);
    };

    // ---- the gun ----------------------------------------------------------
    // A page rises out of the slot row by row for the first fifth of PAGE_MS (the rect
    // is the rows showing), then flies from the slot to its target, 2× from halfway.
    const pagePose = (p: Page, now: number) => {
      const u = Math.min(1, (now - p.at) / PAGE_MS);
      if (u < PAGE_EJECT) {
        const rows = Math.max(1, Math.ceil((u / PAGE_EJECT) * SPR.PAGE_PRINTED.h));
        return { x: p.x0 - 5, y: SLOT.y - rows, w: 10, h: rows };
      }
      const v = (u - PAGE_EJECT) / (1 - PAGE_EJECT);
      const sc = v < 0.5 ? 1 : 2;
      const y0 = SLOT.y - 6.5;
      const x = p.x0 + (p.x1 - p.x0) * v;
      const y = y0 + (p.y1 - y0) * v;
      return { x: Math.floor(x - 5 * sc), y: Math.floor(y - 6.5 * sc), w: 10 * sc, h: 13 * sc };
    };
    /** A thrown thing's sprite: a nut or a bolt spins a quarter turn every BOLT_SPIN_MS. */
    const thrownSprite = (s: Staple, now: number) => {
      const spr = SPR[THROWN_SPR[s.kind]];
      if (s.kind === 'staple' || reduced) return spr;
      return rotateSprite(spr, Math.floor((now - s.at) / BOLT_SPIN_MS) % 4);
    };
    // A staple (or a nut or a bolt) punches up out of the slot at 1× for the first part of its
    // flight (the rect is the rows showing), then flies out of it at the camera: 1× → 2× → 4×.
    const staplePose = (s: Staple, now: number) => {
      const spr = thrownSprite(s, now);
      const hw = spr.w / 2;
      const hh = spr.h / 2;
      const u = Math.min(1, (now - s.at) / s.ms);
      if (u < STAPLE_EJECT) {
        const rows = Math.round((u / STAPLE_EJECT) * spr.h);
        return { x: Math.floor(s.x0 - hw), y: SLOT.y - rows, w: spr.w, h: rows };
      }
      const v = (u - STAPLE_EJECT) / (1 - STAPLE_EJECT);
      const sc = v < 1 / 3 ? 1 : v < 2 / 3 ? 2 : 4;
      const y0 = SLOT.y - hh;
      const x = s.x0 + (s.x - s.x0) * v;
      const y = y0 + (s.y - y0) * v;
      return { x: Math.floor(x - hw * sc), y: Math.floor(y - hh * sc), w: spr.w * sc, h: spr.h * sc };
    };
    // A jet: its end (the nozzle shot, or SPRAY_MS), when its last particle lands, and whether
    // the nozzle is still spraying (and so can be shot).
    const jetEnd = (s: Spray) => s.stoppedAt ?? s.at + SPRAY_MS;
    const splatAt = (s: Spray) => jetEnd(s) + SPRAY_FLIGHT_MS;
    const spraying = (s: Spray, now: number) => now >= s.at && s.stoppedAt === null && now < s.at + SPRAY_MS;
    /** Where the particle launched at τ is at `now`: along an arc from the nozzle to the target, spreading a little. */
    const particlePose = (s: Spray, tau: number, now: number) => {
      const v = (now - tau) / SPRAY_FLIGHT_MS;
      const spread = (((tau * 7919) % 97) / 97 - 0.5) * 6 * v;
      const size = v < 0.4 ? 1 : v < 0.75 ? 2 : 3;
      const x = s.nx + (s.x - s.nx) * v + spread;
      const y = TUBE_MOUTH + (s.y - TUBE_MOUTH) * v - SPRAY_ARC * Math.sin(Math.PI * v);
      return { x: Math.floor(x - size / 2), y: Math.floor(y - size / 2), size };
    };
    /** The splat's scale from how much of the jet has landed: 0 (nothing yet) to 4. */
    const splatScale = (s: Spray, now: number) => {
      const landed = Math.max(0, Math.min(jetEnd(s), now - SPRAY_FLIGHT_MS) - s.at);
      const f = landed / SPRAY_MS;
      return f <= 0 ? 0 : f < 0.3 ? 2 : f < 0.7 ? 3 : 4;
    };
    /** How far a splat has run down the glass: from where it landed to past the bottom of the view. */
    const splatSlide = (s: Spray, sc: number, now: number) => {
      const lt = now - splatAt(s);
      if (lt <= INK_LANDED_MS) return 0;
      const u = Math.min(1, (lt - INK_LANDED_MS) / INK_SLIDE_MS);
      return (H + 7 * sc - s.y) * u * u;
    };
    const reload = (now: number) => {
      if (phase !== 'fight' || frozenAt !== null) return;
      if (shots === SHOTS || reloadSecondAt !== null) return;
      sounds.reload();
      autoReloadAt = null;
      shots = Math.max(shots, SHOTS / 2);
      drawShots();
      reloadSecondAt = now + RELOAD_STEP_MS;
    };
    const fire = (x: number, y: number, now: number) => {
      if (shots === 0) {
        sounds.dryClick();
        return;
      }
      shots--;
      drawShots();
      sounds.shot();
      // The first shot: a woman screams somewhere off and people run out. Nobody is seen,
      // and nothing else changes (Edgar, 2026-10-19).
      if (!panicked) {
        panicked = true;
        sounds.panic();
      }
      if (shots === 0) autoReloadAt = now + AUTO_RELOAD_MS;
      // A heart's ghost floating up, above everything: it pops (Edgar, 2026-10-20).
      if (ghosts.length) {
        const fr = frame.getBoundingClientRect();
        const sx = fr.left + x * scale;
        const sy = fr.top + y * scale;
        const pad = GHOST_HIT_PAD * scale;
        const ghost = ghosts.find((gh) => {
          const b = gh.getBoundingClientRect();
          return sx >= b.left - pad && sx < b.right + pad && sy >= b.top - pad && sy < b.bottom + pad;
        });
        if (ghost) {
          popGhost(ghost);
          return;
        }
      }
      const page = pages.find((p) => {
        if (p.shot || p.landedAt !== null || now < p.at) return false;
        const r = pagePose(p, now);
        return x >= r.x - 2 && x < r.x + r.w + 2 && y >= r.y - 2 && y < r.y + r.h + 2;
      });
      if (page) {
        page.shot = true;
        addScore(page.burning ? FIRE_PAGE_POINTS : PAGE_POINTS, now);
        return;
      }
      // Shootable since Edgar's review (the handoff had them unshootable).
      const staple = staples.find((s) => {
        if (s.shot || s.hit || now < s.at) return false;
        const r = staplePose(s, now);
        return x >= r.x - STAPLE_HIT_PAD && x < r.x + r.w + STAPLE_HIT_PAD && y >= r.y - STAPLE_HIT_PAD && y < r.y + r.h + STAPLE_HIT_PAD;
      });
      if (staple) {
        staple.shot = true;
        addScore(staple.kind === 'staple' ? STAPLE_POINTS : BOLT_POINTS, now);
        return;
      }
      // A spraying tube, its head or the hose over the edge: it blows up. The jet stops (what is
      // already in the air still lands), the tube's bits fly, and that nozzle never comes back.
      const jet = sprays.find((s) => spraying(s, now) && x >= s.nx - 3 - NOZZLE_HIT_PAD && x < s.nx + 3 + NOZZLE_HIT_PAD && y >= TUBE_TOP - NOZZLE_HIT_PAD && y < TUBE_BASE + NOZZLE_HIT_PAD);
      if (jet) {
        explodeTube(jet, now);
        addScore(TUBE_POINTS, now);
        return;
      }
      // The button: more damage, and the machine answers faster. Bright or not.
      if (x >= BUTTON.x - BUTTON_HIT_PAD && x < BUTTON.x + BUTTON.w + BUTTON_HIT_PAD && y >= BUTTON.y - BUTTON_HIT_PAD && y < BUTTON.y + BUTTON.h + BUTTON_HIT_PAD) {
        flashFrames = HIT_FLASH_FRAMES;
        stoke(x, y, now);
        rage = Math.min(RAGE_MAX, rage + 1);
        blinkAt = -Infinity;
        scheduleBlink(now, BLINK_MIN_MS);
        addScore(BUTTON_POINTS, now);
        return;
      }
      if (x >= MACHINE.x0 && x < MACHINE.x1 && y >= MACHINE.y0 && y < MACHINE.y1) {
        flashFrames = HIT_FLASH_FRAMES;
        stoke(x, y, now);
        addScore(HIT_POINTS, now);
        return;
      }
      // The EXIT sign: the first hit knocks it loose, the second brings it down.
      const sign = scene.exit;
      if ((sign.state === 'up' || sign.state === 'loose') && x >= EXIT_HIT.x0 && x < EXIT_HIT.x1 && y >= EXIT_HIT.y0 && y < EXIT_HIT.y1) {
        exitAt = now;
        if (sign.state === 'up') {
          sign.state = 'loose';
          sounds.signHit(EXIT_FLICKER);
        } else {
          sign.state = 'falling';
          sounds.signSnap();
        }
        addScore(BREAK_POINTS, now);
        return;
      }
      // The first aid kit: shot open, it is the player's full health, once; no points for it.
      if (!scene.broken.kit && x >= KIT_HIT.x0 && x < KIT_HIT.x1 && y >= KIT_HIT.y0 && y < KIT_HIT.y1) {
        scene.broken.kit = true;
        health = PLAYER_HEALTH;
        drawHealth();
        sounds.heal();
        ctx.announce('First aid. Health full.');
        return;
      }
      const thing = BREAKABLES.find((b) => !scene.broken[b.id] && x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1);
      if (thing) {
        scene.broken[thing.id] = true;
        sounds[thing.sound]();
        addScore(BREAK_POINTS, now);
        if (thing.id === 'tank') startShort(now);
        if (thing.id === 'clock') {
          scene.clock.state = 'falling';
          clockAt = now;
        }
        return;
      }
      // Nothing to hit: the shot marks what it lands on. Into the black of the doorway, nothing.
      if (x >= 13 && x < 13 + scene.doorGap && y >= 43 && y < DOOR.y1) return;
      if (x >= DOOR.x0 && x < DOOR.x1 && y >= DOOR.y0 && y < DOOR.y1) addHole('door', x, y);
      else if (x >= WINDOW.x0 && x < WINDOW.x1 && y >= WINDOW.y0 && y < WINDOW.y1) windowShot(x, y, now);
      else if (y < FLOOR_Y) addHole('wall', x, y);
    };
    // A hole where the shot landed; through the door or the blind, a red light in it.
    const addHole = (kind: Hole['kind'], x: number, y: number) => {
      const hole: Hole = { x: Math.floor(x), y: Math.floor(y), kind }; // the pixel under the shot
      scene.holes.push(hole);
      if (scene.holes.length > HOLES_MAX) {
        const old = scene.holes.shift()!;
        holeLightOf.get(old)?.remove();
        holeLightOf.delete(old);
      }
      if (kind === 'wall') return;
      const box = el('div', 'prntr-room-hole-light');
      box.style.left = `calc(${hole.x - 1}px * var(--s))`;
      box.style.top = `calc(${hole.y - 1}px * var(--s))`;
      box.hidden = inDoorway(hole, scene.doorGap);
      holeLightOf.set(hole, box);
      holeLights.append(box);
    };
    // Shot open, the window takes no more holes: the shots go into the red.
    const windowShot = (x: number, y: number, now: number) => {
      if (scene.windowOpen) return;
      addHole('window', x, y);
      if (++windowShots >= WINDOW_BREAK_SHOTS) breakWindow(now);
    };
    const breakWindow = (now: number) => {
      scene.windowOpen = true;
      frame.classList.add('is-window-open');
      for (const [hole, box] of holeLightOf) if (hole.kind === 'window') box.hidden = true;
      sounds.shatter();
      // the slats clattering down after the crack
      window.setTimeout(() => {
        if (!signal.aborted) sounds.signCrash();
      }, 120);
      addScore(BREAK_POINTS, now);
    };
    // A hit on the machine inside its flames: the flame at its foot (the main flame's footprint)
    // or, once it spreads, the flames on it (drawFire's front layer in scene.ts).
    const inFlames = (x: number, y: number, now: number) => {
      if (fireAt === null) return false;
      const r = fireRect(fireU(now));
      if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) return true;
      const v = spreadU(now);
      if (v <= 0) return false;
      const cx = 80 + 40 * v;
      const w = 8 + 42 * v;
      return x >= cx - w && x < cx + w && y >= 146 - (20 + 48 * v) && y < 146;
    };
    // Every few shots into the flames, the spread goes faster from where it is (no jump in the flames).
    const stoke = (x: number, y: number, now: number) => {
      if (!inFlames(x, y, now)) return;
      fireShots++;
      stokeAt = now;
      if (fireShots % FIRE_STOKE_SHOTS !== 0 || stokes >= STOKE_MAX) return;
      const v = spreadU(now);
      stokes++;
      spreadMs = Math.round(FIRE_SPREAD_MS * Math.pow(STOKE_STEP, stokes));
      if (spreadAt !== null) spreadAt = now - v * spreadMs;
    };
    // The water reaches the machine: it shorts out, zapping and sparking for a couple of moments,
    // and then the fire takes on that side and grows.
    const startShort = (now: number) => {
      shortAt = now;
      shortZaps = 0;
      sounds.short(SHORT_ZAPS_MS);
    };
    // One zap: the machine flashes for a frame and sparks fly off its wet foot, out and up, falling.
    const zap = (now: number) => {
      flashFrames = 1;
      if (reduced) return;
      for (let i = 0; i < 10 + Math.floor(Math.random() * 6); i++) {
        const a = -Math.PI * (0.15 + Math.random() * 0.7);
        const v = 40 + Math.random() * 90;
        bits.push({ x: SHORT_AT.x + (Math.random() - 0.5) * 6, y: SHORT_AT.y - Math.random() * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 220, born: now, life: 250 + Math.random() * 350, size: 1, color: Math.random() < 0.6 ? 'W' : Math.random() < 0.5 ? 'y' : 'c' });
      }
    };
    const startFire = (now: number) => {
      shortAt = null;
      fireAt = now;
      flashFrames = HIT_FLASH_FRAMES * 2;
      fireSound = sounds.fire();
    };
    // A tube shot (Edgar, 2026-10-20): every jet on that nozzle stops, the head and the hose fly
    // apart in bits of plum, grey and its ink, and the stump stays; the nozzle is dead for good.
    const explodeTube = (jet: Spray, now: number) => {
      for (const s of sprays) if (s.nx === jet.nx && s.stoppedAt === null) s.stoppedAt = now;
      if (!scene.stubs.includes(jet.nx)) scene.stubs.push(jet.nx);
      sounds.tubeBurst();
      flashFrames = 1;
      if (reduced) return;
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI * (0.1 + Math.random() * 0.8);
        const v = 30 + Math.random() * 90;
        const color: PalKey = i < 5 ? 'K' : i < 9 ? 'g' : i < 12 ? 'i' : jet.color;
        bits.push({ x: jet.nx - 3 + Math.random() * 6, y: TUBE_TOP + Math.random() * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 240, born: now, life: 350 + Math.random() * 450, size: 1 + (i % 3 === 0 ? 1 : 0), color });
      }
    };
    // The ink lands in the fire (Edgar, 2026-10-20): a hiss and steam, and the fire is smaller by
    // SNUFF_U of its growth, growing back from there; too little left and it is out for good. The
    // burst machine's fire is past putting out.
    const snuff = (s: Spray, now: number) => {
      if (fireAt === null || scene.printer === 'wreck') return;
      sounds.sizzle();
      steam(s.x, s.y, now);
      const u = fireU(now) - SNUFF_U;
      if (u < SNUFF_OUT) {
        putOutFire();
        return;
      }
      fireAt = now - u * FIRE_GROW_MS;
    };
    const putOutFire = () => {
      fireAt = null;
      fireSound?.stop();
      fireSound = null;
      scene.fire = null;
      fireLight.hidden = true;
      spreadAt = null;
      ctx.announce('The fire is out.');
    };
    // Steam off the snuffed fire: pale bits rising from where the ink landed, gone within a second.
    const steam = (x: number, y: number, now: number) => {
      if (reduced) return;
      for (let i = 0; i < 8; i++) {
        bits.push({ x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 16, vy: -20 - Math.random() * 30, g: 0, born: now, life: 500 + Math.random() * 400, size: 1 + Math.floor(Math.random() * 2), color: Math.random() < 0.5 ? 'l' : 'T' });
      }
    };
    /** The next attack the dev hook asked for, if any. */
    let forcedKind: AttackKind | null = null;
    // The machine does not move. Scan, staples, pages, in rotation; once it is mad, ink too; at
    // half health or less, nuts and bolts too.
    const launchAttack = (now: number) => {
      const gap = attackGap();
      const kinds: AttackKind[] = ['scan', 'staples', 'pages'];
      const nozzles = NOZZLES_X.filter((x) => !scene.stubs.includes(x));
      if (mad && nozzles.length) kinds.push('ink');
      if (score >= HI * BOLT_HEALTH) kinds.push('bolts');
      const kind = forcedKind ?? kinds[attackIndex++ % kinds.length];
      forcedKind = null;
      if (kind === 'bolts') {
        for (let i = 0; i < 3; i++) {
          staples.push({ kind: Math.random() < 0.5 ? 'nut' : 'bolt', ms: BOLT_MS, x0: SLOT.x0 + 4 + Math.random() * (SLOT.x1 - SLOT.x0 - 8), x: 20 + Math.random() * 180, y: 40 + Math.random() * 70, at: now + i * BOLT_STAGGER_MS, hit: false, shot: false, fed: false });
        }
        nextAttackAt = now + 2 * BOLT_STAGGER_MS + BOLT_MS + gap;
      } else if (kind === 'ink') {
        if (!nozzles.length) {
          nextAttackAt = now + gap;
          return;
        }
        const first = Math.floor(Math.random() * INK_COLORS.length);
        for (let i = 0; i < SPRAY_COUNT; i++) {
          // the last jet goes at the fire while it burns: into the middle of the main flame
          const atFire = fireAt !== null && i === SPRAY_COUNT - 1;
          let x = 16 + Math.random() * 208;
          let y = 24 + Math.random() * 112;
          if (atFire) {
            const r = fireRect(fireU(now));
            x = (r.x0 + r.x1) / 2 + (Math.random() - 0.5) * 6;
            y = r.y0 + (r.y1 - r.y0) * 0.6 + (Math.random() - 0.5) * 8;
          }
          sprays.push({ nx: nozzles[Math.floor(Math.random() * nozzles.length)], x, y, at: now + TUBE_RISE_MS + i * SPRAY_STAGGER_MS, color: INK_COLORS[(first + i) % INK_COLORS.length], fire: atFire, stoppedAt: null, done: false, fed: false });
        }
        nextAttackAt = now + TUBE_RISE_MS + (SPRAY_COUNT - 1) * SPRAY_STAGGER_MS + SPRAY_MS + SPRAY_FLIGHT_MS + gap;
      } else if (kind === 'scan') {
        scanAt = now;
        sounds.scanFlash();
        nextAttackAt = now + SCAN_MS + WASH_MS + gap;
      } else if (kind === 'staples') {
        for (let i = 0; i < 3; i++) {
          staples.push({ kind: 'staple', ms: STAPLE_MS, x0: SLOT.x0 + 3 + Math.random() * (SLOT.x1 - SLOT.x0 - 6), x: 20 + Math.random() * 180, y: 40 + Math.random() * 70, at: now + i * STAPLE_STAGGER_MS, hit: false, shot: false, fed: false });
        }
        nextAttackAt = now + 2 * STAPLE_STAGGER_MS + STAPLE_MS + gap;
      } else {
        PAGE_TARGETS_X.forEach((x1, i) => {
          pages.push({ burning: fireAt !== null, x0: PAGE_ORIGINS_X[i], x1, y1: 60 + Math.random() * 70, at: now + i * PAGE_STAGGER_MS, landedAt: null, shot: false, fed: false });
        });
        nextAttackAt = now + 4 * PAGE_STAGGER_MS + PAGE_MS + gap;
      }
    };

    // ---- looking ----------------------------------------------------------
    const clickRoom = (v: { x: number; y: number }, now: number) => {
      sounds.uiClick();
      if (plugAt !== null) return;
      const half = Math.max(10, USB_HIT_PX / 2 / scale);
      if (scene.usb && Math.abs(v.x - USB.x) <= half && Math.abs(v.y - USB.y) <= half) {
        scene.usb = false;
        plugAt = now + USB_PLUG_MS;
        setCaption(USB_CAPTION);
        return;
      }
      // The ceiling, wall, carpet and the light: nothing, and the caption stays.
      const h = HOTSPOTS.find((h) => v.x >= h.x0 && v.x < h.x1 && v.y >= h.y0 && v.y < h.y1);
      if (!h) return;
      const n = (clicks.get(h.id) ?? 0) + 1;
      clicks.set(h.id, n);
      setCaption(h.captions[(n - 1) % 2]);
    };

    // ---- input ------------------------------------------------------------
    frame.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'touch') pointer = toVirtual(e);
      },
      { signal },
    );
    frame.addEventListener('pointerleave', () => (pointer = null), { signal });
    frame.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    frame.addEventListener(
      'pointerdown',
      (e) => {
        const now = performance.now();
        const v = toVirtual(e);
        pointer = e.pointerType === 'touch' ? null : v;
        if (e.button === 2) {
          reload(now);
          return;
        }
        if (e.button !== 0) return;
        if (phase === 'look') clickRoom(v, now);
        else if (phase === 'fight' && frozenAt === null) fire(v.x, v.y, now);
        else if (phase === 'continue') answerContinue(now);
      },
      { signal },
    );
    // The arcade's off-screen reload: a press on the black around the frame (or yes).
    wrap.addEventListener(
      'pointerdown',
      (e) => {
        if (e.target !== wrap) return;
        if (phase === 'continue') answerContinue(performance.now());
        else reload(performance.now());
      },
      { signal },
    );
    // The shot pips are also the reload button (phones).
    shotsBtn.addEventListener(
      'pointerdown',
      (e) => {
        e.stopPropagation();
        reload(performance.now());
      },
      { signal },
    );
    window.addEventListener(
      'keydown',
      (e) => {
        if (phase === 'continue' && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault();
          answerContinue(performance.now());
        } else if (e.key === ' ' || e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          reload(performance.now());
        }
      },
      { signal },
    );

    if (import.meta.env.DEV) {
      // Harness hook (PRNTR-STAGE-1.md §5). Compiled out of builds; vite.config.ts
      // fails the build if its marker survives.
      console.info('prntr-dev-room');
      (window as unknown as { __prntrRoom?: unknown }).__prntrRoom = {
        phase: () => phase,
        setScore: (n: number) => {
          score = Math.min(HI - 1, Math.max(0, n));
          drawScore();
        },
        health: () => health,
        setHealth: (n: number) => {
          health = Math.max(1, Math.min(PLAYER_HEALTH, Math.round(n)));
          drawHealth();
        },
        god: (on: boolean) => {
          god = on;
        },
        setLives: (n: number) => {
          lives = Math.max(0, Math.min(LIVES_MAX, n));
          drawPips();
          if (lives === 0 && phase === 'fight') (continued ? startOver : startContinue)(performance.now());
        },
        usb: () => {
          if (phase === 'look' && plugAt === null) {
            scene.usb = false;
            plugAt = performance.now();
          }
        },
        broken: () => BREAKABLES.filter((b) => scene.broken[b.id]).map((b) => b.id),
        kit: () => scene.broken.kit,
        attackGap,
        exit: (): ExitSign['state'] => scene.exit.state,
        doorGap: () => scene.doorGap,
        short: () => shortAt !== null,
        fire: () => fireAt !== null,
        fireU: () => fireU(performance.now()),
        /** The x of a tube spraying at the fire right now, or null. */
        fireJet: () => sprays.find((s) => s.fire && spraying(s, performance.now()))?.nx ?? null,
        mad: () => mad,
        spread: () => spreadAt !== null,
        stokes: () => stokes,
        spreadMs: () => spreadMs,
        /** The next attack, now: scan, staples, pages, ink or bolts, whatever the machine's state. */
        attack: (kind: AttackKind) => {
          forcedKind = kind;
          nextAttackAt = 0;
        },
        bolts: () => staples.filter((s) => s.kind !== 'staple').length,
        burningPages: () => pages.filter((p) => p.burning && !p.shot).length,
        deadTubes: () => [...scene.stubs],
        sprays: () => sprays.length,
        tubes: () => scene.tubes.map((t) => ({ ...t })),
        holes: () => scene.holes.map((h) => h.kind),
        ghosts: () => ghosts.length,
        name: () => lifeName.textContent,
        clock: () => ({ ...scene.clock }),
        wreck: () => scene.printer === 'wreck',
        pieces: () => scene.pieces.map((q) => [Math.round(q.x), Math.round(q.y)]),
        windowOpen: () => scene.windowOpen,
        /** The x of a nozzle spraying right now, or null. */
        nozzle: () => sprays.find((s) => spraying(s, performance.now()))?.nx ?? null,
      };
    }

    // ---- timelines (ms from the start of the phase) -----------------------
    const STICKER_STEPS: [number, () => void][] = [
      [
        0,
        () => {
          scene.ledRed = true;
          scene.lights[1] = false;
          sounds.lightTick();
          hum.setFlat(true);
          setCaption('?');
        },
      ],
      [
        1000,
        () => {
          scene.lights[0] = false;
          sounds.lightTick();
          setCaption('');
        },
      ],
      [
        1100,
        () => {
          scene.printer = 'lid';
          sounds.lidOpen();
        },
      ],
      // The machine comes forward: 2× one step closer, then 3× (a cut under reduced motion).
      [1300, () => (scene.printer = reduced ? 'mad' : 'between')],
      [1600, () => (scene.printer = 'mad')],
      [1900, () => startFight(performance.now())],
    ];
    // The end (Edgar, 2026-10-20): the machine in pieces, the fire (if there is one) raging on in
    // the dark room, the HUD gone, the tune; then out, WIN_END_MS after the burst. The lights stay
    // off and nothing comes back. (Until then it ended on the quiet room, lit again, the lid shut.)
    const END_STEPS: [number, () => void][] = [[0, () => showFightUi(false)]];
    const runSteps = (steps: [number, () => void][], index: number, t: number): number => {
      while (index < steps.length && t >= steps[index][0]) steps[index++][1]();
      return index;
    };

    // ---- update -----------------------------------------------------------
    const update = (now: number) => {
      const t = now - phaseAt;
      if (hintFadeAt && now >= hintFadeAt) {
        hintEl.classList.remove('is-in');
        hintFadeAt = 0;
      }
      if (hintHideAt && now >= hintHideAt) hideHint();
      poseName(now);
      // The short: a zap at each of its moments, then the fire.
      if (shortAt !== null) {
        while (shortZaps < SHORT_ZAPS_MS.length && now - shortAt >= SHORT_ZAPS_MS[shortZaps]) {
          shortZaps++;
          zap(now);
        }
        if (now - shortAt >= SHORT_MS) startFire(now);
      }
      if (fireAt !== null) fireSound?.setLevel(fireU(now) + 0.5 * spreadU(now) + (now - stokeAt < STOKE_FLARE_MS ? 0.3 : 0));
      if (fireAt !== null && !mad && now - fireAt >= MAD_AFTER_MS) {
        mad = true;
        frame.classList.add('is-mad');
      }
      // The falling sign lands (not while the room is frozen).
      if (scene.exit.state === 'falling' && frozenAt === null && now - exitAt >= (reduced ? 0 : EXIT_FALL_MS)) {
        scene.exit.state = 'down';
        scene.exit.x = EXIT_FLOOR.x;
        scene.exit.y = EXIT_FLOOR.y;
        sounds.signCrash();
        doorAt = now + DOOR_DELAY_MS;
      }
      if (doorAt !== null && now >= doorAt) {
        doorAt = null;
        doorOpenAt = now;
        sounds.doorCreak();
        frame.classList.add('is-open');
      }
      // The clock: lands, comes to rest, catches fire by the burning cooler, rolls out (not while frozen).
      if (frozenAt === null) {
        const ck = scene.clock;
        if (ck.state === 'falling' && now - clockAt >= (reduced ? 0 : CLOCK_FALL_MS)) {
          ck.state = 'rolling';
          clockAt = now;
          sounds.clatter();
        } else if (ck.state === 'rolling' && now - clockAt >= (reduced ? 0 : CLOCK_ROLL_MS)) {
          ck.state = 'rest';
        }
        if ((ck.state === 'rolling' || ck.state === 'rest') && fireAt !== null) {
          const r = fireRect(fireU(now));
          if (r.x0 - CLOCK_IGNITE_PAD <= ck.x + SPR.CLOCK.w && ck.x <= r.x1 + CLOCK_IGNITE_PAD) {
            ck.state = 'burning';
            clockAt = now;
            clockX0 = ck.x;
            clockRot0 = ck.rot;
            sounds.whoosh();
            if (reduced) ck.state = 'gone';
          }
        }
        if (ck.state === 'burning' && ck.x + SPR.CLOCK.w < 0) ck.state = 'gone';
      }
      if (phase === 'look') {
        if (now - lastTickAt >= TICK_MS) {
          lastTickAt = now;
          sounds.printerTick();
        }
        if (plugAt !== null && now >= plugAt) startSticker(now);
      } else if (phase === 'sticker') {
        stickerStep = runSteps(STICKER_STEPS, stickerStep, t);
      } else if (phase === 'fight') {
        if (hurtUntil && now >= hurtUntil) {
          hurtUntil = 0;
          hurtEl.hidden = true;
        }
        // The death beat: nothing moves until it is over, then the fight goes on, health full.
        if (deathUntil) {
          if (now < deathUntil) return;
          deathUntil = 0;
          frozenAt = null;
          deathEl.hidden = true;
          health = PLAYER_HEALTH;
          drawHealth();
          nextAttackAt = now + RESPAWN_MS;
        }
        // The fire takes the weak machine; engulfed, its health runs out and the fight is won.
        if (fireAt !== null && spreadAt === null && score >= HI * (1 - SPREAD_HEALTH)) spreadAt = now;
        if (spreadAt !== null && depleteAt === null && now - spreadAt >= spreadMs) {
          depleteAt = now;
          depleteFrom = score;
          burst(now);
        }
        if (depleteAt !== null) {
          const k = Math.min(1, (now - depleteAt) / DEPLETE_MS);
          score = Math.max(score, Math.round(depleteFrom + (HI - depleteFrom) * k));
          drawScore();
          if (k >= 1) {
            addScore(0, now);
            return;
          }
        }
        if (shots === 0 && autoReloadAt !== null && now >= autoReloadAt) reload(now);
        if (reloadSecondAt !== null && now >= reloadSecondAt) {
          reloadSecondAt = null;
          shots = SHOTS;
          drawShots();
        }
        if (now >= nextAttackAt) launchAttack(now);
        if (now >= nextBlinkAt) {
          blinkAt = now;
          scheduleBlink(now, BLINK_MIN_MS);
        }
        if (scanAt !== null) {
          // The bar sweeps the lid in 4 steps, then one inverted frame and the white wash.
          const st = now - scanAt;
          scene.scanRow = st < 150 ? 0 : st < 300 ? 5 : st < 450 ? 6 : st < SCAN_MS ? 7 : 0;
          if (st >= SCAN_MS) {
            scanAt = null;
            if (!reduced) invertFrame = true;
            wash.classList.add('is-on');
            washUntil = now + WASH_MS;
          }
        }
        if (washUntil && now >= washUntil) {
          wash.classList.remove('is-on');
          washUntil = 0;
        }
        for (const s of staples) {
          if (!s.fed && now >= s.at) {
            s.fed = true;
            if (s.kind === 'staple') sounds.staplePunch();
            else sounds.boltPunch();
          }
          if (!s.hit && !s.shot && now - s.at >= s.ms) {
            s.hit = true;
            if (s.kind === 'staple') sounds.stapleHit();
            else sounds.boltHit();
            hurt(s.kind, now);
          }
        }
        staples = staples.filter((s) => !s.hit && !s.shot);
        for (const p of pages) {
          if (!p.fed && now >= p.at) {
            p.fed = true;
            sounds.pageFeed();
          }
          if (!p.shot && p.landedAt === null && now - p.at >= PAGE_MS) {
            p.landedAt = now;
            sounds.paperSlap();
            hurt(p.burning ? 'firePage' : 'page', now);
          }
        }
        pages = pages.filter((p) => !p.shot && (p.landedAt === null || now - p.landedAt < PAGE_LANDED_MS + PAGE_SLIDE_MS));
        for (const s of sprays) {
          if (!s.fed && now >= s.at) {
            s.fed = true;
            sounds.inkSpray();
          }
          if (!s.done && s.stoppedAt === null && now >= splatAt(s)) {
            s.done = true;
            sounds.inkSplat();
            if (s.fire) snuff(s, now);
            else hurt('ink', now);
          }
        }
        sprays = sprays.filter((s) => now < splatAt(s) + INK_LANDED_MS + INK_SLIDE_MS);
      } else if (phase === 'continue') {
        // 9 → 0, a second each; 0 gets its full second, then it is over.
        countEl.textContent = String(Math.max(0, 9 - Math.floor(t / 1000)));
        if (t >= CONTINUE_MS) startOver(now);
      } else if (phase === 'over') {
        if (t >= OVER_HOLD_MS) finish();
      } else if (phase === 'end') {
        endStep = runSteps(END_STEPS, endStep, t);
        if (now - burstAt >= WIN_END_MS) finish();
      }
    };

    // ---- render -----------------------------------------------------------
    // A glow box per projectile in flight (never a landed page: it cannot be shot),
    // in screen px over the frame; spare boxes are hidden.
    const drawGlows = (now: number) => {
      const rects: { x: number; y: number; w: number; h: number }[] = [];
      for (const s of staples) if (now >= s.at && !s.hit && !s.shot) rects.push(staplePose(s, now));
      for (const p of pages) if (now >= p.at && !p.shot && p.landedAt === null) rects.push(pagePose(p, now));
      for (const s of sprays) if (spraying(s, now)) rects.push({ x: s.nx - 3, y: TUBE_TOP, w: 6, h: TUBE_BASE - TUBE_TOP });
      if (scene.buttonBright) rects.push({ ...BUTTON, x: BUTTON.x + scene.shake.x, y: BUTTON.y + scene.shake.y });
      while (glows.children.length < rects.length) glows.append(el('div', 'prntr-room-glow'));
      Array.from(glows.children).forEach((n, i) => {
        const r = rects[i];
        const box = n as HTMLElement;
        box.hidden = !r;
        if (!r) return;
        box.style.left = `${r.x * scale}px`;
        box.style.top = `${r.y * scale}px`;
        box.style.width = `${r.w * scale}px`;
        box.style.height = `${r.h * scale}px`;
      });
    };
    // The sign: loose, it hangs from its left corner and swings a little while its letters
    // flicker and go out; falling, it tumbles from the wall to the floor in front of the door.
    const poseSign = (now: number) => {
      const sign = scene.exit;
      const t = now - exitAt;
      if (sign.state === 'loose') {
        sign.lit = EXIT_FLICKER.some(([a, b]) => t >= a && t < b);
        sign.tilt = reduced ? 4 : Math.round(4 + 2 * Math.sin((2 * Math.PI * t) / 700) * Math.exp(-t / 1200));
      } else if (sign.state === 'falling') {
        const u = reduced ? 1 : Math.min(1, t / EXIT_FALL_MS);
        sign.x = EXIT_WALL.x + (EXIT_FLOOR.x - EXIT_WALL.x) * u;
        sign.y = EXIT_WALL.y + (EXIT_FLOOR.y - EXIT_WALL.y) * u * u;
        sign.tilt = Math.round(4 + 5 * u);
      }
    };
    // The clock off the wall: a fall with a half turn, a hop as it lands, then a roll to the left
    // that slows to a stop, or on and out of the frame once it burns (cuts under reduced motion).
    const poseClock = (now: number) => {
      const ck = scene.clock;
      const t = now - clockAt;
      if (ck.state === 'falling') {
        const u = reduced ? 1 : Math.min(1, t / CLOCK_FALL_MS);
        ck.x = CLOCK_AT.x + (CLOCK_LAND_X - CLOCK_AT.x) * u;
        ck.y = CLOCK_AT.y + (CLOCK_FLOOR_Y - CLOCK_AT.y) * u * u;
        ck.rot = Math.floor(u * 2) % 4;
      } else if (ck.state === 'rolling') {
        const u = reduced ? 1 : Math.min(1, t / CLOCK_ROLL_MS);
        ck.x = CLOCK_LAND_X + (CLOCK_REST_X - CLOCK_LAND_X) * (1 - (1 - u) * (1 - u));
        ck.y = CLOCK_FLOOR_Y - (!reduced && t < 160 ? Math.round(2 * Math.sin((Math.PI * t) / 160)) : 0);
        ck.rot = 2 - Math.floor((CLOCK_LAND_X - ck.x) / CLOCK_ROLL_PX);
      } else if (ck.state === 'burning') {
        ck.x = clockX0 - (CLOCK_BURN_SPEED * t) / 1000;
        ck.y = CLOCK_FLOOR_Y;
        ck.rot = clockRot0 - Math.floor((clockX0 - ck.x) / CLOCK_ROLL_PX);
      }
    };
    // The door swings in, easing out, a pixel at a time; the light in it is drawn as wide.
    const poseDoor = (now: number) => {
      if (doorOpenAt === null) return;
      const u = reduced ? 1 : Math.min(1, (now - doorOpenAt) / DOOR_OPEN_MS);
      scene.doorGap = DOOR_AJAR + Math.floor((DOOR_OPEN - DOOR_AJAR) * (1 - (1 - u) * (1 - u)));
      if (scene.doorGap !== lightGap) {
        lightGap = scene.doorGap;
        light.style.width = `calc(${lightGap}px * var(--s))`;
        for (const [hole, box] of holeLightOf) box.hidden = inDoorway(hole, scene.doorGap);
      }
    };
    /** The spread onto the machine, 0..1; once the machine has burst it rages on, up to 1 + RAGE_MORE
     * over the second after its score has run out. */
    const spreadU = (now: number) => {
      if (spreadAt === null) return 0;
      const v = Math.min(1, (now - spreadAt) / spreadMs);
      return scene.printer === 'wreck' ? v + RAGE_MORE * Math.min(1, Math.max(0, now - burstAt - DEPLETE_MS) / 1000) : v;
    };
    // The fire grows for FIRE_GROW_MS, then holds; its glow box follows the flames.
    const poseFire = (now: number) => {
      if (fireAt === null) return;
      scene.fire = { u: fireU(now), t: reduced ? 0 : now, v: spreadU(now) };
      const r = fireRect(scene.fire.u);
      fireLight.hidden = false;
      fireLight.style.left = `${r.x0 * scale}px`;
      fireLight.style.top = `${r.y0 * scale}px`;
      fireLight.style.width = `${(r.x1 - r.x0) * scale}px`;
      fireLight.style.height = `${(r.y1 - r.y0) * scale}px`;
      fireLight.style.opacity = reduced ? '0.8' : String(0.65 + 0.35 * Math.abs(Math.sin(now / 90)));
    };
    const render = (now: number) => {
      poseSign(now);
      poseClock(now);
      poseDoor(now);
      poseFire(now);
      scene.flashWhite = flashFrames > 0;
      scene.damage = score / HI;
      if (flashFrames > 0) flashFrames--;
      scene.buttonBright = phase === 'fight' && scene.printer === 'mad' && (mad || buttonBright(now));
      if (scene.printer === 'wreck') posePieces(now);
      // The tremble: a new offset of ±1 px every few frames while the mad machine fights.
      frameCount++;
      if (mad && phase === 'fight' && scene.printer === 'mad' && frozenAt === null && !reduced) {
        if (frameCount % SHAKE_FRAMES === 0) scene.shake = { x: Math.floor(Math.random() * 3) - 1, y: -Math.floor(Math.random() * 2) };
      } else {
        scene.shake = { x: 0, y: 0 };
      }
      // The slot's red light is a DOM box over the canvas: it trembles with the machine (Edgar, 2026-10-20).
      slotLight.style.transform = scene.shake.x || scene.shake.y ? `translate(${scene.shake.x * scale}px, ${scene.shake.y * scale}px)` : '';
      // The tubes up behind the machine: rising before the jet, sinking after it, one per nozzle.
      const tubes = new Map<number, number>();
      for (const s of sprays) {
        const from = s.at - TUBE_RISE_MS;
        const to = jetEnd(s) + TUBE_RISE_MS;
        if (now < from || now >= to) continue;
        const up = reduced ? 1 : now < s.at ? (now - from) / TUBE_RISE_MS : now < jetEnd(s) ? 1 : (to - now) / TUBE_RISE_MS;
        const top = Math.round(TUBE_BASE - (TUBE_BASE - TUBE_TOP) * up);
        tubes.set(s.nx, Math.min(top, tubes.get(s.nx) ?? Infinity));
      }
      scene.tubes = [];
      for (const [x, top] of tubes) scene.tubes.push({ x, top, color: sprays.find((s) => s.nx === x && now >= s.at - TUBE_RISE_MS && now < jetEnd(s) + TUBE_RISE_MS)!.color });
      // The ink on the far half of its flight goes behind the machine: it is sprayed from behind it.
      scene.inkBehind = [];
      for (const s of sprays) {
        if (now < s.at) continue;
        const end = Math.min(now, jetEnd(s));
        for (let tau = s.at; tau < end; tau += SPRAY_EVERY_MS) {
          if (now - tau >= SPRAY_FLIGHT_MS / 2) continue;
          const q = particlePose(s, tau, now);
          scene.inkBehind.push({ x: q.x, y: q.y, size: q.size, color: s.color });
        }
      }
      drawRoom(pix, scene);
      // What the machine throws goes on the front layer, over the slot's light, and the fire's
      // front flames with it: the flames on the burning machine were behind that glow too.
      fpix.clear();
      if (scene.windowOpen) drawWindowWreck(fpix);
      if (scene.fire) drawFireFront(fpix, scene.fire);
      // Out of the slot: only the top rows of the sprite so far, then the whole thing.
      for (const s of staples) {
        if (now < s.at || s.hit || s.shot) continue;
        const r = staplePose(s, now);
        const spr = thrownSprite(s, now);
        if (r.h < spr.h) fpix.blit(r.x, r.y, { w: spr.w, h: r.h, rows: spr.rows.slice(0, r.h) });
        else fpix.blit(r.x, r.y, spr, r.w / spr.w);
      }
      // A burning page (thrown while the machine burns) carries flames up its face, from its
      // bottom edge, scaled with it; its paper is scorched at the edges.
      const pageFire = (x: number, y: number, w: number, h: number, seed: number) => {
        drawFlame(fpix, x + w / 2, w / 2 - 1, h * 0.8, y + h, seed, reduced ? 0 : now);
      };
      for (const p of pages) {
        if (p.shot || now < p.at || p.landedAt !== null) continue;
        const r = pagePose(p, now);
        const spr = SPR.PAGE_PRINTED;
        if (r.h < spr.h) fpix.blit(r.x, r.y, { w: spr.w, h: r.h, rows: spr.rows.slice(0, r.h) });
        else fpix.blit(r.x, r.y, spr, r.w / spr.w, p.burning ? { remap: { K: 'G', w: 'r' } } : {});
        if (p.burning && r.h >= spr.h) pageFire(r.x, r.y, r.w, r.h, 600 + p.x1);
      }
      // A page on the glass: big, at a slight angle, then it slides off.
      for (const p of pages) {
        if (p.landedAt === null) continue;
        const lt = now - p.landedAt;
        const slide = lt > PAGE_LANDED_MS ? ((lt - PAGE_LANDED_MS) / PAGE_SLIDE_MS) * 80 : 0;
        const lx = Math.floor(p.x1 - 20);
        const ly = Math.floor(p.y1 - 26 + slide);
        fpix.blit(lx, ly, SPR.PAGE_PRINTED, 4, { skew: 10, ...(p.burning ? { remap: { K: 'G', w: 'r' } } : {}) });
        if (p.burning) pageFire(lx + 3, ly, 40, 52, 700 + p.x1);
      }
      // Ink: the particles on the near half of their flight (the far half is behind the machine),
      // and the splat building up on the glass, then running down.
      for (const s of sprays) {
        if (now < s.at) continue;
        const end = Math.min(now, jetEnd(s));
        for (let tau = s.at; tau < end; tau += SPRAY_EVERY_MS) {
          if (now - tau >= SPRAY_FLIGHT_MS || now - tau < SPRAY_FLIGHT_MS / 2) continue;
          const q = particlePose(s, tau, now);
          fpix.rect(q.x, q.y, q.x + q.size, q.y + q.size, s.color);
        }
        const sc = splatScale(s, now);
        if (sc === 0) continue;
        const slide = splatSlide(s, sc, now);
        const top = Math.floor(s.y - 7 * sc + slide);
        // the drips it leaves running down the glass above it, each its own length
        if (slide > 0) {
          for (let i = 0; i < INK_DRIPS; i++) {
            const k = ((i + 1) / (INK_DRIPS + 1)) * 16 * sc - 8 * sc + (((s.at * 31 + i * 17) % 7) - 3) * (sc / 2);
            const x = Math.floor(s.x + k);
            const from = Math.floor(s.y - 7 * sc + 3 * sc + (((s.at * 13 + i * 29) % 5) * sc) / 2);
            fpix.rect(x, from, x + 1 + (i % 2), top + 4 * sc, s.color);
          }
        }
        fpix.blit(Math.floor(s.x - 8 * sc), top, SPR.SPLAT, sc, { remap: { c: s.color } });
      }
      // The bits in the air (steam), over everything else on the front layer.
      bits = bits.filter((b) => now - b.born < b.life);
      for (const b of bits) {
        const bt = (now - b.born) / 1000;
        const x = Math.floor(b.x + b.vx * bt);
        const y = Math.floor(b.y + b.vy * bt + 0.5 * b.g * bt * bt);
        fpix.rect(x, y, x + b.size, y + b.size, b.color);
      }
      cpix.clear();
      if (pointer) {
        const aim = phase === 'fight' || phase === 'continue' || phase === 'over';
        if (aim) cpix.blit(Math.floor(pointer.x) - 5, Math.floor(pointer.y) - 6, SPR.CROSSHAIR);
        else cpix.blit(Math.floor(pointer.x) - 2, Math.floor(pointer.y), SPR.POINTER);
      }
      pix.present(g);
      fpix.present(fg);
      cpix.present(cg);
      drawGlows(now);
      canvas.classList.toggle('is-inverted', invertFrame);
      front.classList.toggle('is-inverted', invertFrame);
      invertFrame = false;
    };

    // ---- loop and exit ----------------------------------------------------
    return new Promise<Handoff>((resolve) => {
      let raf = 0;
      let done = false;
      const stop = () => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        hum.stop();
        fireSound?.stop();
      };
      // On abort the host removes the root. On finish the frame stays painted until
      // the host's drop (sky or Tetris) has covered it (PRNTR-STAGE-1.md §4.10).
      signal.addEventListener(
        'abort',
        () => {
          stop();
          resolve({ kind: 'start' });
        },
        { once: true },
      );
      finish = () => {
        stop();
        resolve(outcome === 'over' ? { kind: 'over', score } : { kind: 'cleared', score, player: PLAYER_NAME });
      };
      const loop = (now: number) => {
        if (done) return;
        update(now);
        render(frozenAt ?? now);
        raf = requestAnimationFrame(loop);
      };
      render(performance.now());
      raf = requestAnimationFrame(loop);
    });
  },
};
