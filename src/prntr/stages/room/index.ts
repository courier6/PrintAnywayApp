import { reducedMotion, wait } from '../../anim';
import type { Handoff, Stage } from '../../types';
import { H, Pix, W } from './pixels';
import { SPR, drawRoom, fireRect, type Broken, type ExitSign, type SceneState } from './scene';
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
/** Heart slots, hearts at the start, and the one heart a continue buys (Edgar, 2026-10-19). */
const HEARTS_MAX = 3;
const HEARTS_START = 2;
const HEARTS_CONTINUE = 1;
/** After a hit nothing else hurts for this long: one volley costs at most one heart. */
const HURT_GRACE_MS = 1500;
/** The printer's standby tick while the room is idle. */
const TICK_MS = 4000;
const AUTO_RELOAD_MS = 800;
/** A reload refills the shot pips in two steps this far apart: half at once, the rest right
 * after the slide is racked (the sound in sounds.ts ends at 330 ms; Edgar, 2026-10-19). */
const RELOAD_STEP_MS = 360;
const FIRST_ATTACK_MS = 2500;
const ATTACK_GAP_MS = 3000;
const ATTACK_GAP_LATE_MS = 2000;
/** From this score on, the attacks come faster. */
const LATE_SCORE = 900;
const SCAN_MS = 600;
const WASH_MS = 300;
const STAPLE_MS = 1500;
const STAPLE_STAGGER_MS = 500;
/** The staple's hit box: its sprite at the current scale, plus this many virtual px around. */
const STAPLE_HIT_PAD = 3;
/** 1.8 s, then a quarter longer on Edgar's review (2026-10-19): they were landing too fast. */
const PAGE_MS = 2250;
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
/** A hit on the button (± BUTTON_HIT_PAD): more damage than the machine, and the attacks come
 * sooner, the gap × RAGE_STEP per hit, at most RAGE_MAX times (Edgar, 2026-10-19). */
const BUTTON_POINTS = 15;
const BUTTON_HIT_PAD = 1;
const RAGE_STEP = 0.85;
const RAGE_MAX = 4;
/** Shooting one of the room's things breaks it, once, for this many points (Edgar, 2026-10-19). */
const BREAK_POINTS = 5;
/** The water jug breaking shorts the machine: a fire on its wet side grows over the cooler for
 * this long, then burns on at that size (Edgar, 2026-10-19). */
const FIRE_GROW_MS = 12_000;
/** This long after the fire starts the machine is mad (Edgar, 2026-10-19): its slot glows red like
 * the door, its button stays bright, and it trembles (a new offset every SHAKE_FRAMES frames). */
const MAD_AFTER_MS = 1500;
const SHAKE_FRAMES = 3;
/** The mad machine's fourth attack (Edgar, 2026-10-19): ink sprayed from the cartridge bay under
 * the open lid (a nozzle at one of NOZZLES_X on the lid line, NOZZLE_Y), cyan, magenta and yellow
 * in turn, never black (it cannot do that). SPRAY_COUNT jets a volley, SPRAY_STAGGER_MS apart; a
 * jet runs SPRAY_MS, a particle every SPRAY_EVERY_MS, each flying SPRAY_FLIGHT_MS along an arc
 * SPRAY_ARC px high to the jet's target, where the splat builds up as they land. Shooting the
 * nozzle (± NOZZLE_HIT_PAD) stops the jet for INK_POINTS; a splat that completes is a hit. The
 * splat stays INK_LANDED_MS, then runs down over INK_SLIDE_MS. */
const SPRAY_COUNT = 3;
const SPRAY_STAGGER_MS = 600;
const SPRAY_MS = 1400;
const SPRAY_EVERY_MS = 40;
const SPRAY_FLIGHT_MS = 700;
const SPRAY_ARC = 24;
const NOZZLES_X = [96, 108, 120, 132, 144];
const NOZZLE_Y = 93.5;
const NOZZLE_HIT_PAD = 4;
const INK_POINTS = 1;
const INK_LANDED_MS = 1500;
const INK_SLIDE_MS = 600;
const INK_COLORS = ['c', 'm', 'y'] as const;
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
/** The quiet room after 1337, before Prntr ends: 0.5 s of lights coming back, then a full second of nothing. */
const HOLD_END_MS = 1500;

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
const STICKER = { x: 134.5, y: 112.5 };
/** What the gun can break and where (virtual px, half-open rects): the clock and poster as
 * their hotspots; the cooler's bottle (COOLER rows 0–7 at 2×), the plant's leaves (PLANT rows
 * 0–9 at 2×) and its pot (rows 10–15), each with a 2 px margin. Not the door, not the machine. */
const BREAKABLES: { id: keyof Broken; x0: number; y0: number; x1: number; y1: number; sound: 'shatter' | 'tear' | 'rustle' }[] = [
  { id: 'clock', x0: 108, y0: 32, x1: 132, y1: 55, sound: 'shatter' },
  { id: 'poster', x0: 62, y0: 36, x1: 90, y1: 62, sound: 'tear' },
  { id: 'tank', x0: 48, y0: 90, x1: 76, y1: 108, sound: 'shatter' },
  { id: 'plant', x0: 198, y0: 101, x1: 230, y1: 123, sound: 'rustle' },
  { id: 'vase', x0: 204, y0: 123, x1: 224, y1: 137, sound: 'shatter' },
];
/** The sticker's hit area in screen px (handoff §2.5), whatever the scale. */
const STICKER_HIT_PX = 44;

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
  { id: 'poster', x0: 62, y0: 36, x1: 90, y1: 62, captions: ['SIMPLE PRODUCTS. WE PRINT.', 'SIMPLE PRODUCTS. WE PRINT.'] },
  { id: 'clock', x0: 108, y0: 32, x1: 132, y1: 55, captions: ['1:37.', '1:37.'] },
  { id: 'window', x0: 156, y0: 32, x1: 228, y1: 94, captions: ["IT'S BRIGHT OUT.", "IT'S BRIGHT OUT."] },
  { id: 'cooler', x0: 46, y0: 88, x1: 78, y1: 140, captions: ['WATER COOLER. FULL.', 'STILL FULL.'] },
  { id: 'plant', x0: 196, y0: 99, x1: 232, y1: 139, captions: ["A PLANT. IT'S REAL.", "A PLANT. IT'S REAL."] },
];

const ROOM_ALT =
  'A quiet office: drop ceiling with two fluorescent panels, a door ajar on black with an EXIT sign, a Simple Products poster, a clock, a bright window with nothing outside, a water cooler, a plant, and one large copier in the middle with a small blue information sticker on its panel';

type Phase = 'look' | 'sticker' | 'fight' | 'continue' | 'over' | 'end';

interface Staple {
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
  /** The nozzle was shot at this moment: the jet stops, what is in the air still lands. */
  stoppedAt: number | null;
  /** The whole jet has landed: the hit has been taken. */
  done: boolean;
  /** The hiss has played. */
  fed: boolean;
}

interface Page {
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
    const light = el('div', 'prntr-room-light');
    const spill = el('div', 'prntr-room-spill');
    // The fire's light: an unpixelated orange glow sized to the flames each frame.
    const fireLight = el('div', 'prntr-room-fire-light');
    fireLight.hidden = true;
    // The mad machine's slot, lit red like the door (.is-mad on the frame fades it in).
    const slotLight = el('div', 'prntr-room-slot-light');
    // The red that reaches into the room once the door is open: a multiply wash, off until then.
    const dread = el('div', 'prntr-room-dread');
    const wash = el('div', 'prntr-room-wash');
    // The red glow on everything that can be shot: DOM boxes over the pixel layer,
    // unpixelated like the door's light (Edgar, 2026-10-19). One per projectile, pooled.
    const glows = el('div', 'prntr-room-glows');
    for (const n of [light, spill, fireLight, slotLight, dread, wash, glows]) n.setAttribute('aria-hidden', 'true');
    const hud = el('div', 'prntr-room-hud');
    const scoreEl = el('div', 'prntr-room-score', 'SCORE 0000');
    const hiEl = el('div', 'prntr-room-hi', 'HI 1337');
    const creditEl = el('div', 'prntr-room-credit', 'CREDIT 01');
    // Read out through ctx.announce instead, so it is not read twice.
    const captionEl = el('div', 'prntr-room-caption');
    captionEl.setAttribute('aria-hidden', 'true');
    const healthEl = el('div', 'prntr-room-health prntr-room-fight-ui');
    healthEl.setAttribute('role', 'img');
    healthEl.setAttribute('aria-label', `${MODEL}, printer health`);
    const healthFill = el('div', 'prntr-room-health-fill');
    healthEl.append(healthFill);
    const healthName = el('div', 'prntr-room-health-name prntr-room-fight-ui', MODEL);
    healthName.setAttribute('aria-hidden', 'true');
    const pipsEl = el('div', 'prntr-room-pips prntr-room-fight-ui');
    pipsEl.setAttribute('role', 'img');
    for (let i = 0; i < HEARTS_MAX; i++) pipsEl.append(el('span', ''));
    const shotsBtn = document.createElement('button');
    shotsBtn.type = 'button';
    shotsBtn.className = 'prntr-room-shots prntr-room-fight-ui';
    for (let i = 0; i < SHOTS; i++) shotsBtn.append(el('span', ''));
    for (const n of [healthEl, healthName, pipsEl, shotsBtn]) n.hidden = true;
    // When the fight starts: what to do, and the one binding that matters (Edgar, 2026-10-19).
    const hintEl = el('div', 'prntr-room-hint');
    hintEl.setAttribute('aria-hidden', 'true');
    const touch = window.matchMedia('(hover: none)').matches;
    hintEl.append(el('div', 'prntr-room-hint-title', 'PROTECT YOURSELF.'), el('div', 'prntr-room-hint-keys', touch ? 'TAP TO SHOOT' : 'CLICK TO SHOOT'));
    hintEl.hidden = true;
    hud.append(scoreEl, hiEl, creditEl, captionEl, healthEl, healthName, pipsEl, shotsBtn, hintEl);
    const continueEl = el('div', 'prntr-room-continue');
    const countEl = el('div', 'prntr-room-continue-count', '9');
    continueEl.append(el('div', 'prntr-room-continue-label', 'CONTINUE?'), countEl);
    continueEl.hidden = true;
    // The game-over dim: the same wash as CONTINUE?, with nothing written on it.
    const overEl = el('div', 'prntr-room-over');
    overEl.setAttribute('aria-hidden', 'true');
    overEl.hidden = true;
    frame.append(canvas, light, spill, fireLight, slotLight, dread, wash, glows, hud, cursor, continueEl, overEl);
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
    const cpix = new Pix();
    const scene: SceneState = {
      lights: [true, true],
      printer: 'idle',
      stickerRed: false,
      trayPage: true,
      scanRow: 0,
      flashWhite: false,
      buttonBright: false,
      broken: { clock: false, poster: false, tank: false, plant: false, vase: false },
      exit: { state: 'up', x: EXIT_WALL.x, y: EXIT_WALL.y, tilt: 0, lit: true },
      doorGap: DOOR_AJAR,
      fire: null,
      shake: { x: 0, y: 0 },
    };
    let phase: Phase = 'look';
    let phaseAt = performance.now();
    /** While CONTINUE? shows, the pixel layer is drawn at this moment. */
    let frozenAt: number | null = null;
    let score = 0;
    let health = HEARTS_START;
    /** Until this moment nothing hurts (the grace after a hit). */
    let hurtUntil = 0;
    let shots = SHOTS;
    /** Virtual px; null on touch or when the mouse is outside the frame. */
    let pointer: { x: number; y: number } | null = null;
    let flashFrames = 0;
    let invertFrame = false;
    let lastTickAt = phaseAt;
    let stickerStep = 0;
    let endStep = 0;
    let staples: Staple[] = [];
    let pages: Page[] = [];
    let sprays: Spray[] = [];
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
    /** When the fire started (the water jug broke), and its crackle. */
    let fireAt: number | null = null;
    let fireSound: FireSound | null = null;
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
      captionEl.textContent = text;
      if (text) ctx.announce(text);
    };
    const drawScore = () => {
      scoreEl.textContent = 'SCORE ' + String(score).padStart(4, '0');
      // The health bar is the score, inverted: HI 1337 was its life all along.
      healthFill.style.width = `${(1 - score / HI) * 100}%`;
    };
    const drawPips = () => {
      Array.from(pipsEl.children).forEach((p, i) => p.classList.toggle('is-off', i >= health));
      pipsEl.setAttribute('aria-label', `Hearts ${health} of ${HEARTS_MAX}`);
    };
    const drawShots = () => {
      Array.from(shotsBtn.children).forEach((p, i) => p.classList.toggle('is-off', i >= shots));
      shotsBtn.setAttribute('aria-label', `Shots ${shots} of ${SHOTS}. Reload`);
    };
    const showFightUi = (on: boolean) => {
      for (const n of [healthEl, healthName, pipsEl, shotsBtn]) {
        n.classList.remove('is-in');
        n.hidden = !on;
        if (on) {
          void n.offsetWidth; // flush, so the fade-in runs from 0
          n.classList.add('is-in');
        }
      }
    };
    drawScore();
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
      health = 0;
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
      health = HEARTS_CONTINUE;
      hurtUntil = 0;
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
    const startEnd = (now: number) => {
      phase = 'end';
      phaseAt = now;
      endStep = 0;
      hideHint();
      staples = [];
      pages = [];
      sprays = [];
      scanAt = null;
      scene.scanRow = 0;
      scene.shake = { x: 0, y: 0 };
      frame.classList.remove('is-mad');
      wash.classList.remove('is-on');
      washUntil = 0;
      setCaption('');
      ctx.announce('1337.');
    };
    const damage = (now: number) => {
      if (phase !== 'fight' || frozenAt !== null || now < hurtUntil) return;
      health--;
      hurtUntil = now + HURT_GRACE_MS;
      pipsEl.classList.remove('is-hurt');
      void pipsEl.offsetWidth; // flush, so the blink restarts
      pipsEl.classList.add('is-hurt');
      drawPips();
      if (health === 0) (continued ? startOver : startContinue)(now);
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
    // A staple punches up out of the slot at 1× for the first part of STAPLE_MS (the rect is
    // the rows showing), then flies out of it at the camera: 1× → 2× → 4×.
    const staplePose = (s: Staple, now: number) => {
      const u = Math.min(1, (now - s.at) / STAPLE_MS);
      if (u < STAPLE_EJECT) {
        const rows = Math.round((u / STAPLE_EJECT) * SPR.STAPLE.h);
        return { x: Math.floor(s.x0 - 3), y: SLOT.y - rows, w: 6, h: rows };
      }
      const v = (u - STAPLE_EJECT) / (1 - STAPLE_EJECT);
      const sc = v < 1 / 3 ? 1 : v < 2 / 3 ? 2 : 4;
      const y0 = SLOT.y - 2.5;
      const x = s.x0 + (s.x - s.x0) * v;
      const y = y0 + (s.y - y0) * v;
      return { x: Math.floor(x - 3 * sc), y: Math.floor(y - 2.5 * sc), w: 6 * sc, h: 5 * sc };
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
      const y = NOZZLE_Y + (s.y - NOZZLE_Y) * v - SPRAY_ARC * Math.sin(Math.PI * v);
      return { x: Math.floor(x - size / 2), y: Math.floor(y - size / 2), size };
    };
    /** The splat's scale from how much of the jet has landed: 0 (nothing yet) to 3. */
    const splatScale = (s: Spray, now: number) => {
      const landed = Math.max(0, Math.min(jetEnd(s), now - SPRAY_FLIGHT_MS) - s.at);
      const f = landed / SPRAY_MS;
      return f <= 0 ? 0 : f < 0.3 ? 1 : f < 0.7 ? 2 : 3;
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
      const page = pages.find((p) => {
        if (p.shot || p.landedAt !== null || now < p.at) return false;
        const r = pagePose(p, now);
        return x >= r.x - 2 && x < r.x + r.w + 2 && y >= r.y - 2 && y < r.y + r.h + 2;
      });
      if (page) {
        page.shot = true;
        addScore(PAGE_POINTS, now);
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
        addScore(STAPLE_POINTS, now);
        return;
      }
      // A spraying nozzle: the jet stops; what is already in the air still lands.
      const jet = sprays.find((s) => spraying(s, now) && Math.abs(x - s.nx) <= 3 + NOZZLE_HIT_PAD && Math.abs(y - NOZZLE_Y) <= 2.5 + NOZZLE_HIT_PAD);
      if (jet) {
        jet.stoppedAt = now;
        addScore(INK_POINTS, now);
        return;
      }
      // The button: more damage, and the machine answers faster. Bright or not.
      if (x >= BUTTON.x - BUTTON_HIT_PAD && x < BUTTON.x + BUTTON.w + BUTTON_HIT_PAD && y >= BUTTON.y - BUTTON_HIT_PAD && y < BUTTON.y + BUTTON.h + BUTTON_HIT_PAD) {
        flashFrames = HIT_FLASH_FRAMES;
        rage = Math.min(RAGE_MAX, rage + 1);
        blinkAt = -Infinity;
        scheduleBlink(now, BLINK_MIN_MS);
        addScore(BUTTON_POINTS, now);
        return;
      }
      if (x >= MACHINE.x0 && x < MACHINE.x1 && y >= MACHINE.y0 && y < MACHINE.y1) {
        flashFrames = HIT_FLASH_FRAMES;
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
      const thing = BREAKABLES.find((b) => !scene.broken[b.id] && x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1);
      if (thing) {
        scene.broken[thing.id] = true;
        sounds[thing.sound]();
        addScore(BREAK_POINTS, now);
        if (thing.id === 'tank') startFire(now);
      }
    };
    // The water reaches the machine: a short, a flash, and a fire on that side that grows.
    const startFire = (now: number) => {
      fireAt = now;
      flashFrames = HIT_FLASH_FRAMES * 2;
      sounds.zap();
      fireSound = sounds.fire();
    };
    // The machine does not move. Scan, staples, pages, in rotation; once it is mad, ink too.
    const launchAttack = (now: number) => {
      const gap = attackGap();
      const kind = attackIndex++ % (mad ? 4 : 3);
      if (kind === 3) {
        const first = Math.floor(Math.random() * INK_COLORS.length);
        for (let i = 0; i < SPRAY_COUNT; i++) {
          sprays.push({ nx: NOZZLES_X[Math.floor(Math.random() * NOZZLES_X.length)], x: 16 + Math.random() * 208, y: 24 + Math.random() * 112, at: now + i * SPRAY_STAGGER_MS, color: INK_COLORS[(first + i) % INK_COLORS.length], stoppedAt: null, done: false, fed: false });
        }
        nextAttackAt = now + (SPRAY_COUNT - 1) * SPRAY_STAGGER_MS + SPRAY_MS + SPRAY_FLIGHT_MS + gap;
      } else if (kind === 0) {
        scanAt = now;
        sounds.scanFlash();
        nextAttackAt = now + SCAN_MS + WASH_MS + gap;
      } else if (kind === 1) {
        for (let i = 0; i < 3; i++) {
          staples.push({ x0: SLOT.x0 + 3 + Math.random() * (SLOT.x1 - SLOT.x0 - 6), x: 20 + Math.random() * 180, y: 40 + Math.random() * 70, at: now + i * STAPLE_STAGGER_MS, hit: false, shot: false, fed: false });
        }
        nextAttackAt = now + 2 * STAPLE_STAGGER_MS + STAPLE_MS + gap;
      } else {
        PAGE_TARGETS_X.forEach((x1, i) => {
          pages.push({ x0: PAGE_ORIGINS_X[i], x1, y1: 60 + Math.random() * 70, at: now + i * PAGE_STAGGER_MS, landedAt: null, shot: false, fed: false });
        });
        nextAttackAt = now + 4 * PAGE_STAGGER_MS + PAGE_MS + gap;
      }
    };

    // ---- looking ----------------------------------------------------------
    const clickRoom = (v: { x: number; y: number }, now: number) => {
      sounds.uiClick();
      const half = Math.max(4.5, STICKER_HIT_PX / 2 / scale);
      if (Math.abs(v.x - STICKER.x) <= half && Math.abs(v.y - STICKER.y) <= half) {
        startSticker(now);
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
        setHealth: (n: number) => {
          health = Math.max(0, Math.min(HEARTS_MAX, n));
          drawPips();
          if (health === 0 && phase === 'fight') (continued ? startOver : startContinue)(performance.now());
        },
        sticker: () => {
          if (phase === 'look') startSticker(performance.now());
        },
        broken: () => BREAKABLES.filter((b) => scene.broken[b.id]).map((b) => b.id),
        attackGap,
        exit: (): ExitSign['state'] => scene.exit.state,
        doorGap: () => scene.doorGap,
        fire: () => fireAt !== null,
        mad: () => mad,
        /** The next attack, now: scan, staples, pages or (mad only) ink. */
        attack: (kind: 'scan' | 'staples' | 'pages' | 'ink') => {
          attackIndex = ['scan', 'staples', 'pages', 'ink'].indexOf(kind);
          nextAttackAt = 0;
        },
        sprays: () => sprays.length,
        /** The x of a nozzle spraying right now, or null. */
        nozzle: () => sprays.find((s) => spraying(s, performance.now()))?.nx ?? null,
      };
    }

    // ---- timelines (ms from the start of the phase) -----------------------
    const STICKER_STEPS: [number, () => void][] = [
      [
        0,
        () => {
          scene.stickerRed = true;
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
    const END_STEPS: [number, () => void][] = [
      [
        0,
        () => {
          sounds.lidShut();
          showFightUi(false);
          scene.trayPage = false;
        },
      ],
      [
        300,
        () => {
          scene.printer = 'idle';
          scene.lights[1] = true;
          sounds.lightTick();
        },
      ],
      [
        500,
        () => {
          scene.lights[0] = true;
          sounds.lightTick();
          hum.setFlat(false);
          scene.stickerRed = false;
          scene.trayPage = true;
        },
      ],
      // One second of the quiet room, exactly as at the start. Do not shorten it.
      [HOLD_END_MS, () => finish()],
    ];
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
      if (fireAt !== null) fireSound?.setLevel(Math.min(1, (now - fireAt) / FIRE_GROW_MS));
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
      if (phase === 'look') {
        if (now - lastTickAt >= TICK_MS) {
          lastTickAt = now;
          sounds.printerTick();
        }
      } else if (phase === 'sticker') {
        stickerStep = runSteps(STICKER_STEPS, stickerStep, t);
      } else if (phase === 'fight') {
        if (shots === 0 && autoReloadAt !== null && now >= autoReloadAt) reload(now);
        if (reloadSecondAt !== null && now >= reloadSecondAt) {
          reloadSecondAt = null;
          shots = SHOTS;
          drawShots();
        }
        if (now >= hurtUntil) pipsEl.classList.remove('is-hurt');
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
            sounds.staplePunch();
          }
          if (!s.hit && !s.shot && now - s.at >= STAPLE_MS) {
            s.hit = true;
            sounds.stapleHit();
            damage(now);
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
            damage(now);
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
            damage(now);
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
      }
    };

    // ---- render -----------------------------------------------------------
    // A glow box per projectile in flight (never a landed page: it cannot be shot),
    // in screen px over the frame; spare boxes are hidden.
    const drawGlows = (now: number) => {
      const rects: { x: number; y: number; w: number; h: number }[] = [];
      for (const s of staples) if (now >= s.at && !s.hit && !s.shot) rects.push(staplePose(s, now));
      for (const p of pages) if (now >= p.at && !p.shot && p.landedAt === null) rects.push(pagePose(p, now));
      for (const s of sprays) if (spraying(s, now)) rects.push({ x: s.nx - 3, y: 91, w: 6, h: 5 });
      if (scene.buttonBright) rects.push(BUTTON);
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
    // The door swings in, easing out, a pixel at a time; the light in it is drawn as wide.
    const poseDoor = (now: number) => {
      if (doorOpenAt === null) return;
      const u = reduced ? 1 : Math.min(1, (now - doorOpenAt) / DOOR_OPEN_MS);
      scene.doorGap = DOOR_AJAR + Math.floor((DOOR_OPEN - DOOR_AJAR) * (1 - (1 - u) * (1 - u)));
      if (scene.doorGap !== lightGap) {
        lightGap = scene.doorGap;
        light.style.width = `calc(${lightGap}px * var(--s))`;
      }
    };
    // The fire grows for FIRE_GROW_MS, then holds; its glow box follows the flames.
    const poseFire = (now: number) => {
      if (fireAt === null) return;
      scene.fire = { u: Math.min(1, (now - fireAt) / FIRE_GROW_MS), t: reduced ? 0 : now };
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
      poseDoor(now);
      poseFire(now);
      scene.flashWhite = flashFrames > 0;
      if (flashFrames > 0) flashFrames--;
      scene.buttonBright = phase === 'fight' && (mad || buttonBright(now));
      // The tremble: a new offset of ±1 px every few frames while the mad machine fights.
      frameCount++;
      if (mad && phase === 'fight' && frozenAt === null && !reduced) {
        if (frameCount % SHAKE_FRAMES === 0) scene.shake = { x: Math.floor(Math.random() * 3) - 1, y: -Math.floor(Math.random() * 2) };
      } else {
        scene.shake = { x: 0, y: 0 };
      }
      drawRoom(pix, scene);
      // Out of the slot: only the top rows of the sprite so far, then the whole thing.
      for (const s of staples) {
        if (now < s.at || s.hit || s.shot) continue;
        const r = staplePose(s, now);
        const spr = SPR.STAPLE;
        if (r.h < spr.h) pix.blit(r.x, r.y, { w: spr.w, h: r.h, rows: spr.rows.slice(0, r.h) });
        else pix.blit(r.x, r.y, spr, r.w / spr.w);
      }
      for (const p of pages) {
        if (p.shot || now < p.at || p.landedAt !== null) continue;
        const r = pagePose(p, now);
        const spr = SPR.PAGE_PRINTED;
        if (r.h < spr.h) pix.blit(r.x, r.y, { w: spr.w, h: r.h, rows: spr.rows.slice(0, r.h) });
        else pix.blit(r.x, r.y, spr, r.w / spr.w);
      }
      // A page on the glass: big, at a slight angle, then it slides off.
      for (const p of pages) {
        if (p.landedAt === null) continue;
        const lt = now - p.landedAt;
        const slide = lt > PAGE_LANDED_MS ? ((lt - PAGE_LANDED_MS) / PAGE_SLIDE_MS) * 80 : 0;
        pix.blit(Math.floor(p.x1 - 20), Math.floor(p.y1 - 26 + slide), SPR.PAGE_PRINTED, 4, { skew: 10 });
      }
      // Ink: the particles in the air, and the splat building up on the glass, then running down.
      for (const s of sprays) {
        if (now < s.at) continue;
        const end = Math.min(now, jetEnd(s));
        for (let tau = s.at; tau < end; tau += SPRAY_EVERY_MS) {
          if (now - tau >= SPRAY_FLIGHT_MS) continue;
          const q = particlePose(s, tau, now);
          pix.rect(q.x, q.y, q.x + q.size, q.y + q.size, s.color);
        }
        const sc = splatScale(s, now);
        if (sc === 0) continue;
        const lt = now - splatAt(s);
        const slide = lt > INK_LANDED_MS ? ((lt - INK_LANDED_MS) / INK_SLIDE_MS) * 60 : 0;
        pix.blit(Math.floor(s.x - 8 * sc), Math.floor(s.y - 7 * sc + slide), SPR.SPLAT, sc, { remap: { c: s.color } });
      }
      cpix.clear();
      if (pointer) {
        const aim = phase === 'fight' || phase === 'continue' || phase === 'over';
        if (aim) cpix.blit(Math.floor(pointer.x) - 5, Math.floor(pointer.y) - 6, SPR.CROSSHAIR);
        else cpix.blit(Math.floor(pointer.x) - 2, Math.floor(pointer.y), SPR.POINTER);
      }
      pix.present(g);
      cpix.present(cg);
      drawGlows(now);
      canvas.classList.toggle('is-inverted', invertFrame);
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
        resolve(outcome === 'over' ? { kind: 'over', score } : { kind: 'cleared', score });
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
