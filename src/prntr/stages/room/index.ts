import { reducedMotion, wait } from '../../anim';
import type { Handoff, Stage } from '../../types';
import { H, Pix, W } from './pixels';
import { SPR, drawRoom, type SceneState } from './scene';
import { createRoomSounds, type Hum } from './sounds';

// ---------------------------------------------------------------------------
// Tunables. The attack cycle is "tune freely" (handoff §2.7), slowed down and made
// shootable on Edgar's review (2026-10-19) so the player has time to fight back; the
// rest is designed.
// ---------------------------------------------------------------------------

/** The high score that already exists, and the machine's life. */
const HI = 1337;
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
/** A reload refills the shot pips in two steps this far apart. */
const RELOAD_STEP_MS = 160;
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
const PAGE_MS = 1800;
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
/** The quiet room after 1337, before Prntr ends: 0.5 s of lights coming back, then a full second of nothing. */
const HOLD_END_MS = 1500;

/** The machine at 3×: the gun's target. */
const MACHINE = { x0: 72, y0: 80, x1: 168, y1: 146 };
/** Where the pages come out. */
const LID = { x: 120, y: 92 };
const PAGE_TARGETS_X = [30, 75, 120, 165, 210];
const STICKER = { x: 134.5, y: 112.5 };
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
  { id: 'door', x0: 6, y0: 27, x1: 48, y1: 112, captions: ['LOCKED.', 'STILL LOCKED.'] },
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
  x: number;
  y: number;
  at: number;
  hit: boolean;
  shot: boolean;
}

interface Page {
  x1: number;
  y1: number;
  at: number;
  landedAt: number | null;
  shot: boolean;
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
    const light = el('div', 'prntr-room-light');
    const spill = el('div', 'prntr-room-spill');
    const wash = el('div', 'prntr-room-wash');
    // The red glow on everything that can be shot: DOM boxes over the pixel layer,
    // unpixelated like the door's light (Edgar, 2026-10-19). One per projectile, pooled.
    const glows = el('div', 'prntr-room-glows');
    for (const n of [light, spill, wash, glows]) n.setAttribute('aria-hidden', 'true');
    const hud = el('div', 'prntr-room-hud');
    const scoreEl = el('div', 'prntr-room-score', 'SCORE 0000');
    const hiEl = el('div', 'prntr-room-hi', 'HI 1337');
    const creditEl = el('div', 'prntr-room-credit', 'CREDIT 01');
    // Read out through ctx.announce instead, so it is not read twice.
    const captionEl = el('div', 'prntr-room-caption');
    captionEl.setAttribute('aria-hidden', 'true');
    const healthEl = el('div', 'prntr-room-health prntr-room-fight-ui');
    healthEl.setAttribute('role', 'img');
    healthEl.setAttribute('aria-label', 'Printer health');
    const healthFill = el('div', 'prntr-room-health-fill');
    healthEl.append(healthFill);
    const pipsEl = el('div', 'prntr-room-pips prntr-room-fight-ui');
    pipsEl.setAttribute('role', 'img');
    for (let i = 0; i < HEARTS_MAX; i++) pipsEl.append(el('span', ''));
    const shotsBtn = document.createElement('button');
    shotsBtn.type = 'button';
    shotsBtn.className = 'prntr-room-shots prntr-room-fight-ui';
    for (let i = 0; i < SHOTS; i++) shotsBtn.append(el('span', ''));
    for (const n of [healthEl, pipsEl, shotsBtn]) n.hidden = true;
    // When the fight starts: what to do, and the one binding that matters (Edgar, 2026-10-19).
    const hintEl = el('div', 'prntr-room-hint');
    hintEl.setAttribute('aria-hidden', 'true');
    const touch = window.matchMedia('(hover: none)').matches;
    hintEl.append(el('div', 'prntr-room-hint-title', 'PROTECT YOURSELF.'), el('div', 'prntr-room-hint-keys', touch ? 'TAP TO SHOOT' : 'CLICK TO SHOOT'));
    hintEl.hidden = true;
    hud.append(scoreEl, hiEl, creditEl, captionEl, healthEl, pipsEl, shotsBtn, hintEl);
    const continueEl = el('div', 'prntr-room-continue');
    const countEl = el('div', 'prntr-room-continue-count', '9');
    continueEl.append(el('div', 'prntr-room-continue-label', 'CONTINUE?'), countEl);
    continueEl.hidden = true;
    // The game-over dim: the same wash as CONTINUE?, with nothing written on it.
    const overEl = el('div', 'prntr-room-over');
    overEl.setAttribute('aria-hidden', 'true');
    overEl.hidden = true;
    frame.append(canvas, light, spill, wash, glows, hud, continueEl, overEl);
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
    const scene: SceneState = {
      lights: [true, true],
      printer: 'idle',
      stickerRed: false,
      trayPage: true,
      scanRow: 0,
      flashWhite: false,
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
      for (const n of [healthEl, pipsEl, shotsBtn]) {
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
      scanAt = null;
      scene.scanRow = 0;
      wash.classList.remove('is-on');
      washUntil = 0;
      drawPips();
      drawShots();
      phase = 'fight';
      phaseAt = now;
      nextAttackAt = now + ATTACK_GAP_MS;
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
      ctx.announce('Game over.');
    };
    const startEnd = (now: number) => {
      phase = 'end';
      phaseAt = now;
      endStep = 0;
      hideHint();
      staples = [];
      pages = [];
      scanAt = null;
      scene.scanRow = 0;
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
    const pagePose = (p: Page, now: number) => {
      const u = Math.min(1, (now - p.at) / PAGE_MS);
      const sc = u < 0.5 ? 1 : 2;
      const x = LID.x + (p.x1 - LID.x) * u;
      const y = LID.y + (p.y1 - LID.y) * u;
      return { x: Math.floor(x - 5 * sc), y: Math.floor(y - 6.5 * sc), w: 10 * sc, h: 13 * sc };
    };
    // Staples fly at the camera: 1× → 2× → 4×.
    const staplePose = (s: Staple, now: number) => {
      const st = now - s.at;
      const sc = st < STAPLE_MS / 3 ? 1 : st < (2 * STAPLE_MS) / 3 ? 2 : 4;
      return { x: Math.floor(s.x - 3 * sc), y: Math.floor(s.y - 2.5 * sc), w: 6 * sc, h: 5 * sc };
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
      if (x >= MACHINE.x0 && x < MACHINE.x1 && y >= MACHINE.y0 && y < MACHINE.y1) {
        flashFrames = HIT_FLASH_FRAMES;
        addScore(HIT_POINTS, now);
      }
    };
    // The machine does not move. Scan, staples, pages, in rotation.
    const launchAttack = (now: number) => {
      const gap = score >= LATE_SCORE ? ATTACK_GAP_LATE_MS : ATTACK_GAP_MS;
      const kind = attackIndex++ % 3;
      if (kind === 0) {
        scanAt = now;
        sounds.scanFlash();
        nextAttackAt = now + SCAN_MS + WASH_MS + gap;
      } else if (kind === 1) {
        for (let i = 0; i < 3; i++) {
          staples.push({ x: 20 + Math.random() * 180, y: 40 + Math.random() * 70, at: now + i * STAPLE_STAGGER_MS, hit: false, shot: false });
        }
        nextAttackAt = now + 2 * STAPLE_STAGGER_MS + STAPLE_MS + gap;
      } else {
        PAGE_TARGETS_X.forEach((x1, i) => {
          pages.push({ x1, y1: 60 + Math.random() * 70, at: now + i * PAGE_STAGGER_MS, landedAt: null, shot: false });
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
          if (!s.hit && !s.shot && now - s.at >= STAPLE_MS) {
            s.hit = true;
            sounds.stapleHit();
            damage(now);
          }
        }
        staples = staples.filter((s) => !s.hit && !s.shot);
        for (const p of pages) {
          if (!p.shot && p.landedAt === null && now - p.at >= PAGE_MS) {
            p.landedAt = now;
            sounds.paperSlap();
            damage(now);
          }
        }
        pages = pages.filter((p) => !p.shot && (p.landedAt === null || now - p.landedAt < PAGE_LANDED_MS + PAGE_SLIDE_MS));
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
    const render = (now: number) => {
      scene.flashWhite = flashFrames > 0;
      if (flashFrames > 0) flashFrames--;
      drawRoom(pix, scene);
      for (const s of staples) {
        if (now < s.at || s.hit || s.shot) continue;
        const r = staplePose(s, now);
        pix.blit(r.x, r.y, SPR.STAPLE, r.w / 6);
      }
      for (const p of pages) {
        if (p.shot || now < p.at || p.landedAt !== null) continue;
        const r = pagePose(p, now);
        pix.blit(r.x, r.y, SPR.PAGE_SMALL, r.w / 10);
      }
      // A page on the glass: big, at a slight angle, then it slides off. All pages are blank.
      for (const p of pages) {
        if (p.landedAt === null) continue;
        const lt = now - p.landedAt;
        const slide = lt > PAGE_LANDED_MS ? ((lt - PAGE_LANDED_MS) / PAGE_SLIDE_MS) * 80 : 0;
        pix.blit(Math.floor(p.x1 - 20), Math.floor(p.y1 - 26 + slide), SPR.PAGE_SMALL, 4, { skew: 10 });
      }
      if (pointer) {
        const aim = phase === 'fight' || phase === 'continue' || phase === 'over';
        if (aim) pix.blit(Math.floor(pointer.x) - 5, Math.floor(pointer.y) - 6, SPR.CROSSHAIR);
        else pix.blit(Math.floor(pointer.x) - 2, Math.floor(pointer.y), SPR.POINTER);
      }
      pix.present(g);
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
