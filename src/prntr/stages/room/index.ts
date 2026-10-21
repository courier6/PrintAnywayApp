import { reducedMotion, wait } from '../../anim';
import type { Handoff, Stage } from '../../types';
import { H, Pix, W, rotateSprite } from './pixels';
import { CLOCK_AT, KIT_AT, KNOB, MACHINE_AT, MACHINE_PIECES, NOZZLES, SPR, drawFireFront, drawFlame, drawMarks, drawRoom, drawWindowWreck, fireRect, inDoorway, knobX, lampX, markBox, tubeX, type Broken, type ExitSign, type Hole, type Mark, type SceneState, type Tube } from './scene';
import { ART_AT, ART_SUB, renderVictory } from './art';
import { PAL, type PalKey } from './palette';
import { createRoomSounds, type FireSound, type Hum } from './sounds';
import { startStormSound } from '../storm';

// ---------------------------------------------------------------------------
// Tunables. The attack cycle is "tune freely" (handoff §2.7), slowed down and made
// shootable so the player has time to fight back; the
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
/** The hearts are lives, as in the arcade: slots, lives at the start, and the
 * one life a continue buys. A hit costs a life: the room freezes under a red dim for DEATH_MS
 * with the three notes and everything in the air gone, then the fight goes on, the next attack
 * RESPAWN_MS later. */
const LIVES_MAX = 3;
const LIVES_START = 2;
const LIVES_CONTINUE = 1;
const DEATH_MS = 1200;
const RESPAWN_MS = 2000;
/** The player's health, a green bar like the machine's: each attack that
 * lands takes HIT_DAMAGE of it and the room flashes red for HURT_MS; the hit that empties it
 * costs a life (the death beat above), and the bar is full again when the beat is over. */
const PLAYER_HEALTH = 100;
const HIT_DAMAGE = { staple: 25, page: 34, firePage: 43, ink: 50, nut: 25, bolt: 50 } as const;
const HURT_MS = 150;
/** A lost heart's ghost floating up can be shot (± GHOST_HIT_PAD virtual px around it): it pops
 * like a balloon, its bits gone after POP_MS. No points: it was the player's. */
const GHOST_HIT_PAD = 3;
const POP_MS = 450;
/** The player's name under their bar: NEW PLAYER until there is a login. At
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
 * after the slide is racked (the sound in sounds.ts ends at 330 ms). */
const RELOAD_STEP_MS = 360;
/** The cross reports the gun, not the mouse (PRNTR-FIGHT-DESIGN.md §3). A shot throws it up
 * KICK_UP and KICK_SIDE either way at random, easing back over KICK_MS; the shot goes where
 * the cross is. A shot also opens the four lines by BLOOM_PER_SHOT over the BLOOM_BASE gap,
 * at most BLOOM_MAX, cooling at BLOOM_COOL px/s; the gap is the spread, and the round lands
 * at a random point inside it. A reload cools it at once. */
const KICK_UP = 3;
const KICK_SIDE = 1;
const KICK_MS = 150;
const BLOOM_BASE = 1;
const BLOOM_PER_SHOT = 3;
const BLOOM_MAX = 12;
const BLOOM_COOL = 6;
/** On touch there is no hover cross: it shows at the tap for this long, so the kick and the bloom show. */
const TOUCH_CROSS_MS = 500;
/** Slowed to 2.5 / 3 / 2 s, then made a quarter faster. */
const FIRST_ATTACK_MS = 2000;
const ATTACK_GAP_MS = 2250;
const ATTACK_GAP_LATE_MS = 1500;
/** From this score on, the attacks come faster. */
const LATE_SCORE = 900;
/** The scan: the lid rises over LID_MS, the lamp sweeps the glass for SWEEP_MS (the window:
 * PRNTR-FIGHT-DESIGN.md §5), the flash washes the screen for WASH_MS, the lid falls over LID_MS.
 * A shot on the lamp during the sweep pops the bulb (LAMP_POINTS): the sweep stops where it is,
 * dead, and there is no flash; the lid still falls on time. The bulb is not replaced: the scan leaves the
 * rotation for the rest of the stage, deaths and continues included. */
const LID_MS = 450;
const SWEEP_MS = 1200;
const WASH_MS = 300;
/** The flash whites the whole glass: the wash at 100% fading over WHITEOUT_MS as (1 − u)²; half as
 * long under reduced motion (PRNTR-PLANNING.md P1.B). What is in the air is inside the white. */
const WHITEOUT_MS = 1200;
const SCAN_TOTAL_MS = LID_MS + SWEEP_MS + WASH_MS + LID_MS;
const LAMP_POINTS = 40;
const LAMP_HIT_PAD = 1;
const STAPLE_MS = 1500;
const STAPLE_STAGGER_MS = 500;
/** The staple's hit box: its sprite at the current scale, plus this many virtual px around. */
const STAPLE_HIT_PAD = 3;
/** A staple tumbles a quarter turn every STAPLE_SPIN_MS in flight (a nut or a bolt every BOLT_SPIN_MS). */
const STAPLE_SPIN_MS = 180;
/** The marks on the glass (a staple stuck in, a bolt stuck point first): the oldest go past this many. */
const GLASS_MARKS_MAX = 40;
/** At half health or less the machine throws nuts and bolts too: out of the
 * slot and at the camera like the staples, spinning, a little quicker. A nut bounces off the glass
 * for HIT_DAMAGE.nut and drops out of the frame; a bolt sticks for HIT_DAMAGE.bolt and stays as a
 * mark (PRNTR-PLANNING.md P1.C). BOLT_POINTS when shot. */
const BOLT_HEALTH = 0.5;
const BOLT_MS = 1300;
const BOLT_STAGGER_MS = 400;
const BOLT_POINTS = 2;
const BOLT_SPIN_MS = 100;
/** A nut that landed, or a staple or a bolt shot off the glass, drops out of the bottom of the frame:
 * a nut at 3×, a staple or a bolt at 4× as it was stuck, a quarter turn every DROP_SPIN_MS, under
 * DROP_GRAVITY px/s², gone after DROP_MS. */
const DROP_MS = 900;
const DROP_SPIN_MS = 90;
const DROP_GRAVITY = 260;
/** 1.8 s, then a quarter longer: they were landing too fast. */
const PAGE_MS = 2250;
/** While the machine burns, the pages it throws are on fire: a quarter more
 * damage (HIT_DAMAGE.firePage, 34 × 1.25) and twice the points when shot. */
const FIRE_PAGE_POINTS = PAGE_POINTS * 2;
const PAGE_STAGGER_MS = 450;
const PAGE_LANDED_MS = 1500;
const PAGE_SLIDE_MS = 400;
const HIT_FLASH_FRAMES = 2;
/** CONTINUE? counts 9 → 0, a second each; unanswered, it is a game over. */
const CONTINUE_MS = 10_000;
/** Clicks this soon after death do not count as yes: the shot that died must not answer. */
const CONTINUE_ARM_MS = 300;
/** A game over: GAME OVER giant in Comic Sans across the frozen, dimmed room; the stage ends the
 * moment it goes up, so the host's Tetris drop falls over the card while the sting plays. */
/** PROTECT YOURSELF. and the binding under it stay this long, then fade (HINT_FADE_MS, as in prntr.css). */
const HINT_MS = 2000;
const HINT_FADE_MS = 500;
/** The open machine's button blinks bright red twice, rarely, so it looks like a target. */
const BLINK_MIN_MS = 4000;
const BLINK_MAX_MS = 9000;
const BLINK_FIRST_MS = 1500;
/** Virtual px of the button on the panel (scene.ts drawMachine). */
const BUTTON = { x: 146, y: 93, w: 16, h: 9 };
/** A hit on the button (± BUTTON_HIT_PAD): more damage than the machine (15, then a quarter more: 19),
 * and the attacks come sooner, the gap × RAGE_STEP per hit, at most RAGE_MAX times. */
const BUTTON_POINTS = 19;
const BUTTON_HIT_PAD = 1;
const RAGE_STEP = 0.85;
const RAGE_MAX = 4;
/** Shooting one of the room's things breaks it, once, for this many points. */
const BREAK_POINTS = 5;
/** The water jug breaking shorts the machine: for SHORT_MS it zaps and sparks,
 * a burst of sparks off its wet side at each of SHORT_ZAPS_MS with a crackle and a flash of the
 * machine, before the fire takes. Then a fire on its wet side grows over the cooler for
 * FIRE_GROW_MS, and burns on at that size. */
const SHORT_MS = 1800;
const SHORT_ZAPS_MS = [0, 380, 700, 1050, 1400];
/** Where the sparks come from: the machine's wet left foot on the 3× pose. */
const SHORT_AT = { x: 74, y: 140 };
const FIRE_GROW_MS = 12_000;
/** This long after the fire starts the machine is mad: its slot glows red like
 * the door, its button stays bright, and it trembles (a new offset every SHAKE_FRAMES frames). */
const MAD_AFTER_MS = 1500;
const SHAKE_FRAMES = 3;
/** Once the machine's health is down to SPREAD_HEALTH and the fire is burning, it spreads onto the
 * machine over FIRE_SPREAD_MS; engulfed, the machine's health runs out over DEPLETE_MS and the
 * player wins, unless the machine gets them first (three quarters). */
const SPREAD_HEALTH = 0.75;
const FIRE_SPREAD_MS = 20_000;
const DEPLETE_MS = 1500;
/** Shooting the machine where it burns stokes the fire: every FIRE_STOKE_SHOTS
 * hits in the flames, the spread onto the machine takes STOKE_STEP of the time it had left, at
 * most STOKE_MAX times (about twice as fast); stoked before it spreads, it spreads faster when it
 * does. The shot does its damage as usual; the crackle flares for STOKE_FLARE_MS. */
const FIRE_STOKE_SHOTS = 3;
const STOKE_STEP = 0.8;
const STOKE_MAX = 3;
const STOKE_FLARE_MS = 400;
/** The burning machine's fourth attack, from the moment it catches fire at any health (a volley at once,
 * then in the rotation, on after the fire is out): ink sprayed from behind the machine,
 * cyan, magenta or yellow, never black (it cannot do that). Each jet comes out of a tube that
 * rises from behind the machine's top edge out of one of the three ink caps (NOZZLES, scene.ts),
 * in that cap's colour: its head
 * comes up to TUBE_TOP over TUBE_RISE_MS before the jet starts and sinks back as long after it
 * ends; the tube is drawn behind the machine and the ink, and the first half of a particle's
 * flight behind the machine too. SPRAY_COUNT jets a volley, SPRAY_STAGGER_MS apart; a jet runs
 * SPRAY_MS, a particle every SPRAY_EVERY_MS, each flying SPRAY_FLIGHT_MS along an arc SPRAY_ARC
 * px high from the tube's mouth to the jet's target, where the splat builds up as they land.
 * Shooting the tube over the edge (± NOZZLE_HIT_PAD) blows it up; a splat that completes is a hit.
 * The splat blinds: it builds to 4× (64×56 of the 240×160), stays
 * INK_LANDED_MS, then runs down the glass and out of the bottom of the view over INK_SLIDE_MS,
 * leaving INK_DRIPS streaks of ink above it as it goes. */
const SPRAY_COUNT = 3;
const SPRAY_STAGGER_MS = 600;
const SPRAY_MS = 1400;
const SPRAY_EVERY_MS = 40;
const SPRAY_FLIGHT_MS = 700;
const SPRAY_ARC = 24;
/** The colour nozzles; the black one is a dud (BLACK_X). */
const NOZZLES_X = NOZZLES.filter((n) => n.color !== 'z').map((n) => n.x);
/** The black cartridge, the fourth cap: it is empty. The first ink attack the rotation picks (after the
 * fire's own volley, which is always in colour) tries it,
 * and then one in BLACK_CHANCE of them: its tube comes up and hunts like the others, coughs out a few
 * specks that fall back onto the machine (DUD_COUGHS_MS from the jet's start), and the display reads
 * NO BLACK INK until DUD_ERROR_TAIL_MS after the tube starts to sink. Nothing reaches the glass. It can
 * be shot apart like the others (TUBE_POINTS), and then it is never tried again. */
const BLACK_X = NOZZLES.find((n) => n.color === 'z')!.x;
const BLACK_CHANCE = 0.25;
const DUD_COUGHS_MS = [150, 600, 1050];
const DUD_ERROR_TAIL_MS = 1200;
/** The machine's top edge (MACHINE.y0) and the tube's head when it is up; its mouth is 2 px into the head. */
const TUBE_BASE = 80;
const TUBE_TOP = 72;
const TUBE_RISE_MS = 250;
const NOZZLE_HIT_PAD = 4;
/** The tubes only come up while the lid is shut (up, it would cover them): an ink attack waits for a
 * scan to end, and a scan for the tubes to sink. As the machine nears half health (SNAKE_FROM to
 * SNAKE_FULL of the damage) the tubes come up longer, to TUBE_TOP_SNAKE, and hunt the cross
 * (PRNTR-PLANNING.md P1.D): the head turns toward where the cross was HUNT_LAG_MS ago, HUNT_GAIN of
 * the way, at most HUNT_REACH px either side of its cap, the hose bending after it; and the jet goes
 * where the head points: every particle aims at the cross HUNT_LAG_MS before its launch, so the
 * stream follows a moving player. On touch the cross is the last tap. Under reduced motion the hose
 * stands straight and the jet is still lagged. */
const SNAKE_FROM = 0.4;
const SNAKE_FULL = 0.5;
const TUBE_TOP_SNAKE = 52;
const HUNT_LAG_MS = 500;
const HUNT_GAIN = 0.6;
const HUNT_REACH = 28;
/** How long the cross's trail is kept, for the lagged aim. */
const TRAIL_MS = 3000;
/** A tube shot blows up: the jet stops, its bits fly, the nozzle is dead for
 * the rest of the stage (its stump stays); with every nozzle dead the ink attack is gone. */
const TUBE_POINTS = 5;
const INK_LANDED_MS = 1500;
const INK_SLIDE_MS = 1800;
const INK_DRIPS = 4;
/** While the fire burns, the last jet of a volley goes at it instead of the player: where it
 * lands the flames go out. The fire loses SNUFF_U of its growth and grows back from there; left
 * with less than SNUFF_OUT, it is out for good. A jet that is stopped does nothing to it. */
const SNUFF_U = 0.35;
const SNUFF_OUT = 0.1;
/** The EXIT sign, BREAK_POINTS a hit: its hit box (the sprite plus 2 px, and the
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
/** The door: shut on the storm (PRNTR-PLANNING.md P5), hinged on the right, its knob on the left.
 * It swings open to DOOR_OPEN px over DOOR_OPEN_MS with the creak when its knob is shot (± KNOB_HIT_PAD,
 * BREAK_POINTS) or DOOR_DELAY_MS after the sign hits the floor; any other shot only holes it, and at
 * the DOOR_BREAK_SHOTS-th hole it breaks apart (BREAK_POINTS, once) and the doorway is full of storm.
 * It never closes again. */
const DOOR_OPEN = 22;
const DOOR_DELAY_MS = 400;
const DOOR_OPEN_MS = 1400;
const DOOR_BREAK_SHOTS = 12;
const KNOB_HIT_PAD = 2;
/** The storm outside (PRNTR-PLANNING.md P5; the timing is stage 0's storm.ts): a near strike the first
 * STRIKE_FIRST_MS in and then every STRIKE_MIN–STRIKE_MAX ms, its flash FLASH_MS long with an afterglow
 * of AFTERGLOW_MS; far lightning the first FAR_FIRST_MS in and then every FAR_MIN–FAR_MAX ms, never within
 * FAR_GAP_MS of a near strike, FAR_MS long; thunder right behind a near strike, THUNDER_MIN–THUNDER_MAX s
 * after a far one. The storm's sound is heard through the shut walls at STORM_SHUT, more with every opening. */
const STRIKE_FIRST_MS = 2500;
const STRIKE_MIN_MS = 4000;
const STRIKE_MAX_MS = 9000;
const FLASH_MS = 220;
const AFTERGLOW_MS = 600;
const FAR_FIRST_MS = 4500;
const FAR_MIN_MS = 3000;
const FAR_MAX_MS = 7000;
const FAR_GAP_MS = 1500;
const FAR_MS = 400;
const THUNDER_MIN_S = 0.5;
const THUNDER_MAX_S = 1;
const STORM_SHUT = 0.12;
/** A shot that hits nothing to break leaves a hole: dark in the wall and the
 * ceiling, the storm showing through the door and the window's blind. The oldest go past HOLES_MAX.
 * The carpet takes no mark. */
const HOLES_MAX = 150;
const DOOR = { x0: 10, y0: 40, x1: 44, y1: 108 };
const WINDOW = { x0: 160, y0: 36, x1: 224, y1: 90 };
/** The carpet starts here. */
const FLOOR_Y = 109;
/** This many holes in the blind and it comes apart, for BREAK_POINTS (six, then half again as many). */
const WINDOW_BREAK_SHOTS = 9;
/** Beaten, the machine bursts apart: engulfed by the fire, or at 1337 by the
 * gun. Its eight pieces fly out and up and fall under PIECE_GRAVITY px/s² to the floor, each a
 * little nearer than the last; if there is a fire it rages on, its flames on the machine growing
 * by RAGE_MORE over the second after the score runs out instead of dying down; without one the
 * machine just falls apart in the dark room. A triumphant tune starts FANFARE_AFTER_MS after the
 * bang (the stage is won: there is no stage after this one), and the stage ends as the tune
 * starts, so the host's sky drop plays over it. */
const PIECE_GRAVITY = 260;
const RAGE_MORE = 0.25;
const FANFARE_AFTER_MS = 500;

/** The machine: the gun's target. */
const MACHINE = MACHINE_AT;
/** The machine's output slot (inside the opening drawMachine draws at 78,107–162,115): pages and staples come out of it. */
const SLOT = { x0: 84, x1: 153, y: 113 };
/** The first part of a page's flight is spent rising out of the slot, row by row. */
const PAGE_EJECT = 0.2;
/** The first part of a staple's flight is spent punching up out of the slot, with a clack. */
const STAPLE_EJECT = 0.15;
const PAGE_TARGETS_X = [30, 75, 120, 165, 210];
/** Where each of the five pages comes out, left to right along the slot. */
const PAGE_ORIGINS_X = [94, 107, 120, 133, 146];
/** The beat after the USB goes in: the machine pounces from the back of the room at POUNCE_AT, growing
 * to its place over POUNCE_MS (a cut under reduced motion), lands two px low for LAND_MS and shakes for
 * POUNCE_SHAKE_MS; then it wakes (a scan from WAKE_AT), and the fight starts as the flash ends. */
const POUNCE_AT = 1600;
const POUNCE_MS = 350;
const LAND_MS = 100;
const POUNCE_SHAKE_MS = 350;
const WAKE_AT = POUNCE_AT + POUNCE_MS + POUNCE_SHAKE_MS;
/** The USB stick on the carpet (USB at USB_AT, scene.ts): its body's centre, and what finding it says before
 * the beat starts USB_PLUG_MS later (the handoff started the fight from the sticker). */
const USB = { x: 184, y: 142 };
const USB_CAPTION = "A SIMPLE PRODUCTS USB. IT'S STILL WARM. YOU PLUG IT INTO THE PRINTER.";
const USB_PLUG_MS = 2200;
/** The first aid kit's hotspot and hit box: its sprite (KIT_AT in scene.ts) plus 3 px. Shot, it gives
 * the player full health, once, and hangs open and empty after. No points. */
const KIT_HIT = { x0: KIT_AT.x - 3, y0: KIT_AT.y - 3, x1: KIT_AT.x + 16, y1: KIT_AT.y + 13 };
/** The clock's and the post-it board's hotspots: their sprites (CLOCK_AT, BOARD_AT in scene.ts) plus 4 px. */
const CLOCK_HIT = { x0: CLOCK_AT.x - 4, y0: CLOCK_AT.y - 4, x1: CLOCK_AT.x + 20, y1: CLOCK_AT.y + 19 };
const BOARD_HIT = { x0: 132, y0: 42, x1: 160, y1: 68 };
/** What the gun can break and where (virtual px, half-open rects): the clock and the board (the
 * poster) as their hotspots; the cooler's bottle (COOLER_AT, scene.ts, its top 18 rows), the monstera's
 * leaves and its pot (MONSTERA_AT, scene.ts), about a px of margin. Not the door, not the machine. */
const BREAKABLES: { id: keyof Broken; x0: number; y0: number; x1: number; y1: number; sound: 'shatter' | 'tear' | 'rustle' | 'knock' }[] = [
  { id: 'clock', ...CLOCK_HIT, sound: 'knock' },
  { id: 'poster', ...BOARD_HIT, sound: 'tear' },
  { id: 'tank', x0: 48, y0: 90, x1: 76, y1: 108, sound: 'shatter' },
  { id: 'plant', x0: 190, y0: 93, x1: 239, y1: 119, sound: 'rustle' },
  { id: 'vase', x0: 203, y0: 119, x1: 226, y1: 136, sound: 'shatter' },
  // the fig behind the monstera (which is in front, so it is tried first): its crown, then its planter
  { id: 'fig', x0: 172, y0: 56, x1: 213, y1: 90, sound: 'rustle' },
  { id: 'figPot', x0: 180, y0: 115, x1: 204, y1: 131, sound: 'shatter' },
];
/** The clock shot: it falls off the wall over CLOCK_FALL_MS, drifting to
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
/** While the machine shakes (the pounce and its landing, the mad tremble) the clock's hands spin out of
 * control, and for CLOCK_SPIN_TAIL_MS after; then they are back at 1:37. Still under reduced motion. */
const CLOCK_SPIN_TAIL_MS = 600;
/** The fig's planter shot: the tree collapses toward the machine over FIG_FALL_MS, faster as it goes
 * (a cut under reduced motion), and lands leaning on the machine's back corner with a crash of leaves.
 * Leaning there while the fire burns, it catches FIG_CATCH_MS later and burns, and the burning tree
 * sets the machine going: the fire's spread onto it starts at once whatever its health, or, already
 * spreading, goes a stoke faster. */
const FIG_FALL_MS = 700;
const FIG_CATCH_MS = 1200;
/** The lights, out since the pounce, flicker back on at random once the machine has FLICKER_FROM of its
 * damage (20% of its health or less): one panel at a time (now and then both), on for FLICKER_ON_MIN–
 * FLICKER_ON_MAX ms with a buzz, then out with a click, the next coming FLICKER_GAP_MIN–FLICKER_GAP_MAX ms
 * later. Never closer than FLICKER_GAP_MIN, so under three flashes a second. Off under reduced motion,
 * and off for good once the machine has burst. */
const FLICKER_FROM = 0.8;
const FLICKER_ON_MIN = 60;
const FLICKER_ON_MAX = 220;
const FLICKER_GAP_MIN = 350;
const FLICKER_GAP_MAX = 1600;
const FLICKER_BOTH = 0.2;
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

/** Sprite bounds plus 4 virtual px; tested in this order (the tray page before the printer). The
 * machine stands back while the room is looked at (machineBack: 88–152 × 88–134, the page in its
 * opening at 98–142 × 110–112). */
const HOTSPOTS: Hotspot[] = [
  { id: 'page', x0: 96, y0: 108, x1: 144, y1: 114, captions: ['A PAGE. BLANK.', 'A PAGE. BLANK.'] },
  { id: 'printer', x0: 84, y0: 86, x1: 156, y1: 138, captions: ["A PRINTER. IT'S ON.", "IT'S WARM."] },
  // Too frightening to go through (the handoff had LOCKED. / STILL LOCKED.).
  { id: 'door', x0: 6, y0: 27, x1: 48, y1: 112, captions: ['NOT IN THERE.', "IT KNOWS YOU'RE HERE."] },
  { id: 'poster', ...BOARD_HIT, captions: ['SIMPLE PRODUCTS. WE PRINT.', 'SIMPLE PRODUCTS. WE PRINT.'] },
  { id: 'clock', ...CLOCK_HIT, captions: ['1:37.', '1:37.'] },
  // The blind is down over it (the handoff had IT'S BRIGHT OUT.).
  { id: 'kit', ...KIT_HIT, captions: ['A FIRST AID KIT. GREEN.', 'A FIRST AID KIT. GREEN.'] },
  // The print between the clock and the board.
  { id: 'art', x0: ART_AT.x - 4, y0: ART_AT.y - 4, x1: ART_AT.x + ART_AT.w + 4, y1: ART_AT.y + ART_AT.h + 4, captions: ['THE WINGED VICTORY. A PRINT.', 'SHE HAS NO HEAD.'] },
  // the monstera is in front of the fig, the fig in front of the window: tried in that order
  { id: 'plant', x0: 190, y0: 92, x1: 240, y1: 138, captions: ["A PLANT. IT'S REAL.", "A PLANT. IT'S REAL."] },
  { id: 'fig', x0: 172, y0: 56, x1: 213, y1: 131, captions: ['A FIG. OLDER THAN THE OFFICE.', 'IT LEANS TOWARD THE PRINTER.'] },
  { id: 'window', x0: 156, y0: 32, x1: 228, y1: 94, captions: ['UNABLE TO OPEN.', 'STILL UNABLE TO OPEN.'] },
  { id: 'cooler', x0: 46, y0: 88, x1: 78, y1: 140, captions: ['WATER COOLER. FULL.', 'STILL FULL.'] },
];

const ROOM_ALT =
  'A quiet office: an exposed ceiling, a duct along it and two bare tube lights hanging on cords, a door shut under an EXIT sign, a clock, a Simple Products board with notes on it by a window with its blind down on a storm outside, a tall fig tree before it and a green first aid kit at its lower right, a water cooler, a plant, one large copier in the middle, and a USB stick on the carpet beside it';

type Phase = 'look' | 'sticker' | 'fight' | 'continue' | 'over' | 'end';
type AttackKind = 'scan' | 'staples' | 'pages' | 'ink' | 'bolts' | 'black';

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
  color: (typeof NOZZLES)[number]['color'];
  /** Aimed at the fire, not the player: landing, it puts out what it touches. */
  fire: boolean;
  /** The nozzle was shot at this moment: the jet stops, what is in the air still lands. */
  stoppedAt: number | null;
  /** The whole jet has landed: the hit has been taken. */
  done: boolean;
  /** The hiss has played. */
  fed: boolean;
  /** From the black cartridge: it coughs and nothing lands. */
  dud: boolean;
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

/** A nut bouncing off the glass, or a staple or a bolt shot off it: what, where it was, and when. */
interface Drop {
  kind: 'nut' | 'staple' | 'bolt';
  x: number;
  y: number;
  at: number;
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
    // light, the spill and the glows, so the cursor is never behind them.
    const cursor = document.createElement('canvas');
    cursor.className = 'prntr-room-cursor';
    cursor.width = W;
    cursor.height = H;
    cursor.setAttribute('aria-hidden', 'true');
    const cg = cursor.getContext('2d');
    if (!cg) throw new Error('prntr: no 2d context');
    // The things the machine throws (pages, staples, ink) on a transparent canvas of their own,
    // above the slot's red light, so the glow is behind the paper.
    const front = document.createElement('canvas');
    front.className = 'prntr-room-front';
    front.width = W;
    front.height = H;
    front.setAttribute('aria-hidden', 'true');
    const fg = front.getContext('2d', { willReadFrequently: true });
    if (!fg) throw new Error('prntr: no 2d context');
    // The print on the wall: its own canvas under the room canvas, seen through the hole the
    // room leaves over the print's rect, at ART_SUB cells to the room's pixel, so it is finer
    // than anything around it and behind everything the room draws (the lid, the tubes).
    const art = document.createElement('canvas');
    art.className = 'prntr-room-art';
    art.width = ART_AT.w * ART_SUB;
    art.height = ART_AT.h * ART_SUB;
    art.setAttribute('aria-hidden', 'true');
    const ag = art.getContext('2d');
    if (!ag) throw new Error('prntr: no 2d context');
    ag.drawImage(renderVictory(), 0, 0);
    const light = el('div', 'prntr-room-light');
    const spill = el('div', 'prntr-room-spill');
    // The fire's light: an unpixelated orange glow sized to the flames each frame.
    const fireLight = el('div', 'prntr-room-fire-light');
    fireLight.hidden = true;
    // The mad machine's slot, lit red like the door (.is-mad on the frame fades it in).
    const slotLight = el('div', 'prntr-room-slot-light');
    // The storm's light through the holes in the door and the blind, one box per hole.
    const holeLights = el('div', 'prntr-room-hole-lights');
    // The window shot open: the storm's light pours through it (a glow, and the fill clipped off the
    // machine's corner).
    const windowLight = el('div', 'prntr-room-window-light');
    windowLight.append(el('div', 'prntr-room-window-fill'));
    // A near strike reaching into the room: a pale wash over everything, its opacity the storm's.
    const stormWash = el('div', 'prntr-room-storm-wash');
    const wash = el('div', 'prntr-room-wash');
    // The red glow on everything that can be shot: DOM boxes over the pixel layer,
    // unpixelated like the door's light. One per projectile, pooled.
    const glows = el('div', 'prntr-room-glows');
    // The inside of the glows of what the machine throws, under the front layer, so its sprites stay crisp
    // over it and the glow has no hollow where a sprite is open (a staple's loop, a burning page's edges).
    const glowFills = el('div', 'prntr-room-glow-fills');
    for (const n of [light, spill, fireLight, slotLight, holeLights, windowLight, stormWash, wash, glows, glowFills]) n.setAttribute('aria-hidden', 'true');
    const hud = el('div', 'prntr-room-hud');
    const scoreEl = el('div', 'prntr-room-score', 'SCORE 0000');
    const hiEl = el('div', 'prntr-room-hi', 'HI 1337');
    const creditEl = el('div', 'prntr-room-credit', 'CREDIT 01');
    // Read out through ctx.announce instead, so it is not read twice.
    const captionEl = el('div', 'prntr-room-caption');
    captionEl.setAttribute('aria-hidden', 'true');
    // Set like an old TV's closed captions: white letters on a black box.
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
    // When the fight starts: what to do, and the one binding that matters.
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
    // GAME OVER across the room, giant, in the title's face.
    const overText = el('div', 'prntr-room-over-text');
    overText.append(el('span', '', 'GAME'), el('span', '', 'OVER'));
    overEl.append(overText);
    // A hit that leaves health: the room flashes red, nothing stops.
    const hurtEl = el('div', 'prntr-room-hurt');
    hurtEl.setAttribute('aria-hidden', 'true');
    hurtEl.hidden = true;
    // The death beat's red dim (a life lost, more to come).
    const deathEl = el('div', 'prntr-room-death');
    deathEl.setAttribute('aria-hidden', 'true');
    deathEl.hidden = true;
    frame.append(art, canvas, light, spill, fireLight, slotLight, holeLights, windowLight, glowFills, front, stormWash, wash, glows, hud, cursor, hurtEl, deathEl, continueEl, overEl);
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
      printer: 'up',
      ledRed: false,
      trayPage: true,
      usb: true,
      machine: { lid: 0, lamp: null, lampOut: false, flash: false, power: true, angry: false, back: 1, t: 0, error: null },
      flashWhite: false,
      buttonBright: false,
      broken: { clock: false, poster: false, tank: false, plant: false, vase: false, kit: false, fig: false, figPot: false },
      fig: { fall: 0, burning: false },
      clock: { state: 'up', x: CLOCK_AT.x, y: CLOCK_AT.y, rot: 0 },
      clockSpin: null,
      exit: { state: 'up', x: EXIT_WALL.x, y: EXIT_WALL.y, tilt: 0, lit: true },
      doorGap: 0,
      doorBroken: false,
      storm: { t: 0, near: 0, far: 0, bolt: null },
      fire: null,
      shake: { x: 0, y: 0 },
      inkBehind: [],
      tubes: [],
      stubs: [],
      holes: [],
      marks: [],
      windowOpen: false,
      pieces: [],
      damage: 0,
    };
    /** Holes in the blind so far, and in the door. */
    let windowShots = 0;
    let doorShots = 0;
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
    /** The last shot's moment and the cross's sideways kick then; it eases back over KICK_MS. */
    let kickAt = -Infinity;
    let kickDx = 0;
    /** The bloom over the base gap at `heatAt`; it cools from there. */
    let heat = 0;
    let heatAt = 0;
    /** The gun held steady (no kick, no bloom): the harness's, for checks that are not about the gun. */
    let steady = false;
    /** On touch, the last tap and its moment: the cross shows there for TOUCH_CROSS_MS. */
    let tap: { x: number; y: number; at: number } | null = null;
    /** On touch, the last tap of the fight: the point the snakes hunt. */
    let lastTap: { x: number; y: number } | null = null;
    /** The cross's trail: where it was each frame it was in the frame, newest last, TRAIL_MS deep. */
    const trail: { at: number; x: number; y: number }[] = [];
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
    let drops: Drop[] = [];
    let attackIndex = 0;
    /** Ink attacks the rotation has picked: the first tries the black cartridge. */
    let inkTries = 0;
    let nextAttackAt = 0;
    let scanAt: number | null = null;
    /** The flash's moment (0 = no white-out); the wash fades from it over WHITEOUT_MS (half under reduced motion). */
    let washAt = 0;
    /** The scan's sound and flash steps run so far (SCAN_STEPS), and the bulb: shot (for good: a dead bulb is not
     * replaced), and where the lamp was then. */
    let scanStep = 0;
    let bulbOut = false;
    let lampStop = 0;
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
    /** The clock's hands: spinning since spinFrom, until spinUntil. */
    let spinFrom = 0;
    let spinUntil = -Infinity;
    /** The fig: when its planter was shot (it falls from then), and when it catches from the fire. */
    let figFallAt: number | null = null;
    let figCatchAt: number | null = null;
    /** The flicker: when the next panel comes on, and when each lit one goes out (null: out). */
    let flickerNext = 0;
    const flickerOff: (number | null)[] = [null, null];
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
    /** The fire has just caught: the next attack is a colour volley, whatever the rotation says. */
    let inkNow = false;
    let frameCount = 0;
    /** When the door starts to open (set as the sign lands), and when it did. */
    let doorAt: number | null = null;
    let doorOpenAt: number | null = null;
    /** The width the door's light is drawn at, so the style is set only when it changes (-1: not yet). */
    let lightGap = -1;
    /** The gap the door's swing started from. */
    let doorFrom = 0;
    /** The storm: the next near strike and the last, its bolt; the next far flicker and the last. */
    let nextStrike = phaseAt + STRIKE_FIRST_MS;
    let strikeAt = -Infinity;
    let bolt = { x: 0, seed: 0 };
    let nextFar = phaseAt + FAR_FIRST_MS;
    let farAt = -Infinity;
    let lastNear = -Infinity;
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
    // The storm's sound (stage 0's: rain and wind, thunder on request) through a gain of its own, faint
    // through the shut walls and louder with every opening (poseStorm sets it).
    const stormGain = audio.context && audio.master ? audio.context.createGain() : null;
    if (stormGain && audio.master) {
      stormGain.gain.value = 0;
      stormGain.connect(audio.master);
    }
    const stormSound = stormGain && audio.context ? startStormSound(audio.context, stormGain) : null;
    let stormLevel = -1;
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
    // frame; --rise is how far that is.
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
      // the credit left from the two the coin gave is what the CONTINUE? asks for: it blinks
      creditEl.classList.remove('is-glowing', 'is-after');
      if (!reduced) creditEl.classList.add('is-blinking');
      countEl.textContent = '9';
      continueEl.hidden = false;
      sounds.death();
      ctx.announce('Continue? Credit 1.');
    };
    // Yes: the last credit is spent, the fight resumes with the last heart. No credit, no second CONTINUE?.
    const continueYes = (now: number) => {
      creditEl.textContent = 'CREDIT 00';
      creditEl.classList.remove('is-blinking');
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
      drops = [];
      scanAt = null;
      wash.classList.remove('is-on');
      washAt = 0;
      wash.style.opacity = '';
      drawPips();
      drawShots();
      phase = 'fight';
      phaseAt = now;
      nextAttackAt = now + ATTACK_GAP_MS;
      scheduleBlink(now, BLINK_MIN_MS);
      ctx.announce('Credit 0. Last life.');
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
      // the count ran out: the credit is left unspent, and stops blinking
      creditEl.classList.remove('is-blinking');
      overEl.hidden = false;
      overText.hidden = false;
      sounds.gameOver();
      ctx.announce('Game over.');
      // the stage ends here: the loop stops on this frame and the card stays painted under the host's drop
      finish();
    };
    // Engulfed: the machine bursts into its pieces, thrown out and up from its middle, and the
    // fight is as good as won. Nothing more comes out of it.
    const burst = (now: number) => {
      scene.printer = 'wreck';
      burstAt = now;
      thrown = MACHINE_PIECES.map((pc, i) => {
        const cx = pc.hx + pc.spr.w / 2;
        const vx = ((cx - 48) / 3) * (2.5 + Math.random() * 2) + (Math.random() - 0.5) * 20;
        const vy = -(50 + Math.random() * 110) - (pc.hy === 0 ? 60 : 0);
        const floor = 146 + 2 + ((i * 5) % 9);
        const hy = MACHINE.y0 + pc.hy;
        const h = pc.spr.h;
        // when its bottom reaches its floor: ½g t² + vy t + (hy + h − floor) = 0
        const land = (-vy + Math.sqrt(vy * vy - 2 * PIECE_GRAVITY * (hy + h - floor))) / PIECE_GRAVITY;
        return { hx: MACHINE.x0 + pc.hx, hy, vx, vy, floor, land };
      });
      staples = [];
      pages = [];
      sprays = [];
      drops = [];
      scanAt = null;
      scene.shake = { x: 0, y: 0 };
      nextAttackAt = Infinity;
      frame.classList.remove('is-mad');
      wash.classList.remove('is-on');
      washAt = 0;
      wash.style.opacity = '';
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
        return { spr: pc.spr, x: q.hx + q.vx * tt, y: tt >= q.land ? q.floor - pc.spr.h : q.hy + q.vy * tt + 0.5 * PIECE_GRAVITY * tt * tt };
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
      drops = [];
      scanAt = null;
      wash.classList.remove('is-on');
      washAt = 0;
      wash.style.opacity = '';
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
    /** A thrown thing's sprite: a staple tumbles a quarter turn every STAPLE_SPIN_MS, a nut or a bolt every BOLT_SPIN_MS. */
    const thrownSprite = (s: Staple, now: number) => {
      const spr = SPR[THROWN_SPR[s.kind]];
      if (reduced) return spr;
      return rotateSprite(spr, Math.floor((now - s.at) / (s.kind === 'staple' ? STAPLE_SPIN_MS : BOLT_SPIN_MS)) % 4);
    };
    // A staple (or a nut or a bolt) punches up out of the slot at 1× for the first part of its
    // flight (the rect is the rows showing), then flies out of it at the camera: 1× → 2× → 3× → 4×,
    // in four equal steps.
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
      const sc = 1 + Math.min(3, Math.floor(v * 4));
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
    /** How much of a snake the tubes are now, 0 (a straight stub) to 1. */
    const snakeU = () => Math.max(0, Math.min(1, (scene.damage - SNAKE_FROM) / (SNAKE_FULL - SNAKE_FROM)));
    /** Where the cross was `ago` ms before `now`, or null if it was not in the frame then (no sample within 100 ms). */
    const crossAgo = (ago: number, now: number) => {
      const t = now - ago;
      let best: { at: number; x: number; y: number } | null = null;
      for (const s of trail) if (s.at <= t) best = s;
      return best && t - best.at <= 100 ? best : null;
    };
    /** The tube on nozzle `nx` risen `up` (0 … 1) at `now`: its head's top, and its reach toward the lagged cross. */
    const poseTube = (nx: number, up: number, now: number): Tube => {
      const su = snakeU();
      const top = TUBE_TOP + (TUBE_TOP_SNAKE - TUBE_TOP) * su;
      const c = reduced ? null : crossAgo(HUNT_LAG_MS, now);
      const reach = c ? Math.max(-HUNT_REACH, Math.min(HUNT_REACH, (c.x - nx) * HUNT_GAIN)) * su * up : 0;
      return { x: nx, top: Math.round(TUBE_BASE - (TUBE_BASE - top) * up), color: NOZZLES.find((n) => n.x === nx)!.color, reach };
    };
    /** Where a jet's ink comes out now: the mouth of its tube, up and turned as it is. */
    const mouthOf = (s: Spray, now: number) => {
      const tb = poseTube(s.nx, 1, now);
      return { x: tubeX(tb, tb.top), y: tb.top + 2 };
    };
    /** Where the particle launched at τ goes: at the cross as it was HUNT_LAG_MS before, while the tubes
     * snake and there was a cross; else the jet's own point (random, or the fire). */
    const aimAt = (s: Spray, tau: number) => {
      if (s.fire || snakeU() <= 0) return { x: s.x, y: s.y };
      const c = crossAgo(HUNT_LAG_MS, tau);
      return c ? { x: c.x, y: c.y } : { x: s.x, y: s.y };
    };
    /** Where the jet is landing now: the target of the particle landing at `now` (the last one's once the jet has ended). */
    const landingOf = (s: Spray, now: number) => aimAt(s, Math.max(s.at, Math.min(jetEnd(s), now - SPRAY_FLIGHT_MS)));
    /** Where the particle launched at τ is at `now`: along an arc from the mouth to its target, spreading a little. */
    const particlePose = (s: Spray, tau: number, now: number) => {
      const v = (now - tau) / SPRAY_FLIGHT_MS;
      const spread = (((tau * 7919) % 97) / 97 - 0.5) * 6 * v;
      const size = v < 0.4 ? 1 : v < 0.75 ? 2 : 3;
      const m = mouthOf(s, now);
      const a = aimAt(s, tau);
      const x = m.x + (a.x - m.x) * v + spread;
      const y = m.y + (a.y - m.y) * v - SPRAY_ARC * Math.sin(Math.PI * v);
      return { x: Math.floor(x - size / 2), y: Math.floor(y - size / 2), size };
    };
    /** The splat's scale from how much of the jet has landed: 0 (nothing yet) to 4. */
    const splatScale = (s: Spray, now: number) => {
      const landed = Math.max(0, Math.min(jetEnd(s), now - SPRAY_FLIGHT_MS) - s.at);
      const f = landed / SPRAY_MS;
      return f <= 0 ? 0 : f < 0.3 ? 2 : f < 0.7 ? 3 : 4;
    };
    /** How far a splat has run down the glass: from where it landed (`ly`) to past the bottom of the view. */
    const splatSlide = (s: Spray, sc: number, ly: number, now: number) => {
      const lt = now - splatAt(s);
      if (lt <= INK_LANDED_MS) return 0;
      const u = Math.min(1, (lt - INK_LANDED_MS) / INK_SLIDE_MS);
      return (H + 7 * sc - ly) * u * u;
    };
    /** The cross's gap now: the base plus what is left of the bloom, cooling since the last shot. */
    const spreadNow = (now: number) => BLOOM_BASE + Math.max(0, heat - ((now - heatAt) / 1000) * BLOOM_COOL);
    /** The cross's offset from the mouse now: the kick, easing back. None under reduced motion. */
    const kickNow = (now: number) => {
      if (reduced) return { x: 0, y: 0 };
      const u = Math.min(1, (now - kickAt) / KICK_MS);
      const k = (1 - u) * (1 - u);
      return { x: kickDx * k, y: -KICK_UP * k };
    };
    /** Where a shot at `v` goes: where the cross is (the kick), scattered inside its gap (the bloom). */
    const aim = (v: { x: number; y: number }, now: number) => {
      const k = kickNow(now);
      const r = (spreadNow(now) - BLOOM_BASE) * Math.sqrt(Math.random());
      const a = Math.random() * 2 * Math.PI;
      return { x: v.x + k.x + r * Math.cos(a), y: v.y + k.y + r * Math.sin(a) };
    };
    /** The shot's recoil: the lines open and the cross kicks. */
    const recoil = (now: number) => {
      heat = Math.min(BLOOM_MAX - BLOOM_BASE, spreadNow(now) - BLOOM_BASE + BLOOM_PER_SHOT);
      heatAt = now;
      kickAt = now;
      kickDx = (Math.floor(Math.random() * 3) - 1) * KICK_SIDE;
    };
    /** The cross on the cursor layer: a dot at (cx, cy) and four lines, `spread` empty px between the dot and each cap. */
    const drawCross = (cx: number, cy: number, spread: number) => {
      cpix.set(cx, cy, 'W');
      cpix.blit(cx - 1, cy - spread - 5, SPR.CROSS_V);
      cpix.blit(cx - 1, cy + spread + 1, SPR.CROSS_V);
      cpix.blit(cx - spread - 5, cy - 1, SPR.CROSS_H);
      cpix.blit(cx + spread + 1, cy - 1, SPR.CROSS_H);
    };
    const reload = (now: number) => {
      if (phase !== 'fight' || frozenAt !== null) return;
      if (shots === SHOTS || reloadSecondAt !== null) return;
      sounds.reload();
      heat = 0;
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
      if (!steady) recoil(now);
      // The first shot: a woman screams somewhere off and people run out. Nobody is seen,
      // and nothing else changes.
      if (!panicked) {
        panicked = true;
        sounds.panic();
      }
      if (shots === 0) autoReloadAt = now + AUTO_RELOAD_MS;
      // A heart's ghost floating up, above everything: it pops.
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
      // Shootable (the handoff had them unshootable).
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
      // On the glass, on the player's side of it: a landed page slides off at once; a staple or a bolt
      // stuck in it is knocked out and drops out of the frame. No points: it is about seeing. The ink
      // cannot be shot off (a shot through it goes on to what is behind).
      const stuck = pages.find((p) => {
        if (p.shot || p.landedAt === null || now - p.landedAt >= PAGE_LANDED_MS) return false;
        const lx = Math.floor(p.x1 - 20);
        const ly = Math.floor(p.y1 - 26);
        return x >= lx - 2 && x < lx + 52 && y >= ly - 2 && y < ly + 54;
      });
      if (stuck) {
        stuck.landedAt = now - PAGE_LANDED_MS;
        sounds.whoosh();
        return;
      }
      for (let i = scene.marks.length - 1; i >= 0; i--) {
        const mk = scene.marks[i];
        const b = markBox(mk);
        if (x < b.x0 || x >= b.x1 || y < b.y0 || y >= b.y1) continue;
        scene.marks.splice(i, 1);
        drops.push({ kind: mk.kind, x: mk.x, y: mk.y, at: now });
        if (mk.kind === 'staple') sounds.stapleHit();
        else sounds.boltHit();
        return;
      }
      // A spraying tube, its head or the hose over the edge: it blows up. The jet stops (what is
      // already in the air still lands), the tube's bits fly, and that nozzle never comes back.
      const jet = sprays.find((s) => {
        if (!spraying(s, now)) return false;
        const tb = poseTube(s.nx, 1, now);
        const { x: sx, y: sy } = scene.shake;
        const hx = tubeX(tb, tb.top);
        return x >= Math.min(s.nx, hx) - 3 - NOZZLE_HIT_PAD + sx && x < Math.max(s.nx, hx) + 3 + NOZZLE_HIT_PAD + sx && y >= tb.top - NOZZLE_HIT_PAD + sy && y < TUBE_BASE + NOZZLE_HIT_PAD + sy;
      });
      if (jet) {
        explodeTube(jet, now);
        addScore(TUBE_POINTS, now);
        return;
      }
      // The lamp during the sweep: the bulb pops, the sweep stops where it is, and there is no flash.
      const m = scene.machine;
      if (scanAt !== null && !bulbOut && m.lamp !== null && m.lid >= 1) {
        const hx = lampX(m.lamp) + scene.shake.x;
        if (x >= hx - 2 - LAMP_HIT_PAD && x < hx + 5 + LAMP_HIT_PAD && y >= 81 + scene.shake.y - LAMP_HIT_PAD && y < 89 + scene.shake.y + LAMP_HIT_PAD) {
          bulbOut = true;
          lampStop = m.lamp;
          popBulb(hx, now);
          flashFrames = HIT_FLASH_FRAMES;
          addScore(LAMP_POINTS, now);
          return;
        }
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
      // The door's knob, while the door is shut or ajar: it swings open.
      const kx = knobX(scene.doorGap);
      if (!scene.doorBroken && doorOpenAt === null && scene.doorGap < DOOR_OPEN && x >= kx - KNOB_HIT_PAD && x < kx + KNOB.w + KNOB_HIT_PAD && y >= KNOB.y - KNOB_HIT_PAD && y < KNOB.y + KNOB.h + KNOB_HIT_PAD) {
        sounds.knobHit();
        swingDoor(now);
        addScore(BREAK_POINTS, now);
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
      const thing = BREAKABLES.find((b) => !scene.broken[b.id] && !(b.id === 'fig' && scene.broken.figPot) && x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1);
      if (thing) {
        scene.broken[thing.id] = true;
        // the pot shot takes the plant with it (one break's points); the leaves shot leave the pot
        if (thing.id === 'vase') scene.broken.plant = true;
        // the fig's planter: the tree goes over toward the machine
        if (thing.id === 'figPot') figFallAt = now;
        sounds[thing.sound]();
        addScore(BREAK_POINTS, now);
        if (thing.id === 'tank') startShort(now);
        if (thing.id === 'clock') {
          scene.clock.state = 'falling';
          clockAt = now;
        }
        return;
      }
      // Nothing to hit: the shot marks what it lands on. Into the storm through the doorway, nothing.
      if (x >= 13 && x < 41 && y >= 43 && y < DOOR.y1 && (scene.doorBroken || x < 13 + scene.doorGap)) return;
      if (x >= DOOR.x0 && x < DOOR.x1 && y >= DOOR.y0 && y < DOOR.y1) addHole('door', x, y, now);
      else if (x >= WINDOW.x0 && x < WINDOW.x1 && y >= WINDOW.y0 && y < WINDOW.y1) windowShot(x, y, now);
      else if (y < FLOOR_Y) addHole('wall', x, y);
    };
    // A hole where the shot landed; through the door or the blind, the storm's light in it. Every hole in
    // the door counts toward its breaking.
    const addHole = (kind: Hole['kind'], x: number, y: number, now = 0) => {
      const hole: Hole = { x: Math.floor(x), y: Math.floor(y), kind }; // the pixel under the shot
      scene.holes.push(hole);
      if (scene.holes.length > HOLES_MAX) {
        const old = scene.holes.shift()!;
        holeLightOf.get(old)?.remove();
        holeLightOf.delete(old);
      }
      if (kind === 'wall') {
        // through the print: a dark cross on the art canvas too, in its finer cells
        if (hole.x >= ART_AT.x && hole.x < ART_AT.x + ART_AT.w && hole.y >= ART_AT.y && hole.y < ART_AT.y + ART_AT.h) {
          const ax = (hole.x - ART_AT.x) * ART_SUB;
          const ay = (hole.y - ART_AT.y) * ART_SUB;
          ag.fillStyle = PAL.X;
          ag.fillRect(ax - ART_SUB, ay, 3 * ART_SUB, ART_SUB);
          ag.fillRect(ax, ay - ART_SUB, ART_SUB, 3 * ART_SUB);
          ag.fillStyle = PAL.K;
          ag.fillRect(ax, ay, ART_SUB, ART_SUB);
        }
        return;
      }
      const box = el('div', 'prntr-room-hole-light');
      box.style.left = `calc(${hole.x - 1}px * var(--s))`;
      box.style.top = `calc(${hole.y - 1}px * var(--s))`;
      box.hidden = inDoorway(hole, scene.doorGap);
      holeLightOf.set(hole, box);
      holeLights.append(box);
      if (kind === 'door') {
        doorShots++;
        if (doorShots === DOOR_BREAK_SHOTS) breakDoor(now);
      }
    };
    // The knob shot, or the sign down: the door swings in to DOOR_OPEN from where it is, with the creak.
    const swingDoor = (now: number) => {
      if (scene.doorBroken || doorOpenAt !== null || scene.doorGap >= DOOR_OPEN) return;
      doorFrom = scene.doorGap;
      doorOpenAt = now;
      sounds.doorCreak();
      frame.classList.add('is-open');
    };
    // The twelfth hole: the door breaks apart; its holes go with it; the doorway is the storm.
    const breakDoor = (now: number) => {
      scene.doorBroken = true;
      doorOpenAt = null;
      scene.doorGap = DOOR_OPEN;
      for (const [hole, box] of holeLightOf) if (hole.kind === 'door') box.hidden = true;
      frame.classList.add('is-open');
      sounds.doorBreak();
      addScore(BREAK_POINTS, now);
    };
    // A mark on the glass where a thrown thing landed; the oldest go past the cap. (Cover, when it
    // comes: a thing that lands while the player is covered clanks off and leaves nothing.)
    const addMark = (kind: Mark['kind'], x: number, y: number) => {
      scene.marks.push({ kind, x, y });
      if (scene.marks.length > GLASS_MARKS_MAX) scene.marks.shift();
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
    // The bulb shot: a pop, and its glass and filament thrown up out of the lid in sparks.
    const popBulb = (hx: number, now: number) => {
      sounds.bulbPop();
      if (reduced) return;
      for (let i = 0; i < 12 + Math.floor(Math.random() * 6); i++) {
        const a = -Math.PI * (0.2 + Math.random() * 0.6);
        const v = 40 + Math.random() * 80;
        bits.push({ x: hx + 1 + (Math.random() - 0.5) * 4, y: 84, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 220, born: now, life: 250 + Math.random() * 300, size: 1, color: Math.random() < 0.5 ? 'W' : Math.random() < 0.5 ? 'c' : 'L' });
      }
    };
    const startFire = (now: number) => {
      shortAt = null;
      fireAt = now;
      // the machine sprays its ink the moment it catches fire, whatever its health: a volley now, ink in the rotation after
      inkNow = true;
      nextAttackAt = Math.min(nextAttackAt, now);
      flashFrames = HIT_FLASH_FRAMES * 2;
      fireSound = sounds.fire();
    };
    // A tube shot: every jet on that nozzle stops, the head and the hose fly
    // apart in bits of plum, grey and its ink, and the stump stays; the nozzle is dead for good.
    const explodeTube = (jet: Spray, now: number) => {
      for (const s of sprays) if (s.nx === jet.nx && s.stoppedAt === null) s.stoppedAt = now;
      if (!scene.stubs.includes(jet.nx)) scene.stubs.push(jet.nx);
      sounds.tubeBurst();
      flashFrames = 1;
      if (reduced) return;
      const m = mouthOf(jet, now);
      m.x += scene.shake.x;
      m.y += scene.shake.y;
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI * (0.1 + Math.random() * 0.8);
        const v = 30 + Math.random() * 90;
        const color: PalKey = i < 5 ? 'K' : i < 9 ? 'g' : i < 12 ? 'i' : jet.color;
        bits.push({ x: m.x - 3 + Math.random() * 6, y: m.y - 2 + Math.random() * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 240, born: now, life: 350 + Math.random() * 450, size: 1 + (i % 3 === 0 ? 1 : 0), color });
      }
    };
    // The ink lands in the fire: a hiss and steam, and the fire is smaller by
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
    const runSteps = (steps: [number, () => void][], index: number, t: number): number => {
      while (index < steps.length && t >= steps[index][0]) steps[index++][1]();
      return index;
    };
    // A scan: the lid rises, the lamp sweeps the glass, the flash, the lid falls (SCAN_STEPS are
    // its sounds and the flash, by ms from scanAt). Used by the sticker beat too (the wake-up).
    const startScan = (now: number) => {
      scanAt = now;
      scanStep = 0;
      sounds.lidOpen();
    };
    const SCAN_STEPS: [number, () => void][] = [
      [LID_MS, () => sounds.scanSweep()],
      [
        LID_MS + SWEEP_MS,
        () => {
          if (bulbOut) return;
          if (!reduced) invertFrame = true;
          wash.classList.add('is-on');
          washAt = performance.now();
          sounds.scanBurst();
        },
      ],
      [SCAN_TOTAL_MS - 60, () => sounds.lidShut()],
    ];
    /** The machine's lid, lamp and flash from where the scan is; shut and dark when there is none. */
    const poseScan = (now: number) => {
      const m = scene.machine;
      if (scanAt === null) {
        m.lid = 0;
        m.lamp = null;
        m.lampOut = false;
        m.flash = false;
        return;
      }
      const st = now - scanAt;
      scanStep = runSteps(SCAN_STEPS, scanStep, st);
      const falls = LID_MS + SWEEP_MS + WASH_MS;
      m.lid = reduced ? (st < falls ? 1 : 0) : st < LID_MS ? st / LID_MS : st < falls ? 1 : Math.max(0, 1 - (st - falls) / LID_MS);
      m.lampOut = bulbOut;
      if (bulbOut) m.lamp = st < falls ? lampStop : null;
      else m.lamp = st >= LID_MS && st < LID_MS + SWEEP_MS ? (st - LID_MS) / SWEEP_MS : null;
      m.flash = !bulbOut && st >= LID_MS + SWEEP_MS && st < falls;
      if (st >= SCAN_TOTAL_MS) scanAt = null;
    };
    /** The next attack the dev hook asked for, if any. */
    let forcedKind: AttackKind | null = null;
    // The machine does not move. Scan, staples, pages, in rotation; once it has caught fire, ink too; at
    // half health or less, nuts and bolts too.
    const launchAttack = (now: number) => {
      const gap = attackGap();
      // the bulb shot, the scan is over for good: nothing to sweep with, nothing to flash
      const kinds: AttackKind[] = bulbOut ? ['staples', 'pages'] : ['scan', 'staples', 'pages'];
      const nozzles = NOZZLES_X.filter((x) => !scene.stubs.includes(x));
      if ((fireAt !== null || mad) && nozzles.length) kinds.push('ink');
      if (score >= HI * BOLT_HEALTH) kinds.push('bolts');
      // Nothing while the lid is up (a scan is on), and no scan while a tube is up: the lid would
      // cover it. The attack waits; a forced one keeps.
      const tubesUp = sprays.some((s) => now >= s.at - TUBE_RISE_MS && now < jetEnd(s) + TUBE_RISE_MS);
      if (scanAt !== null || ((forcedKind ?? kinds[attackIndex % kinds.length]) === 'scan' && tubesUp)) {
        nextAttackAt = now + 100;
        return;
      }
      // the fire's volley comes first, unless an attack was forced (it waits for the next)
      const fireVolley = forcedKind === null && inkNow && nozzles.length > 0;
      if (fireVolley) inkNow = false;
      let kind = forcedKind ?? (fireVolley ? 'ink' : kinds[attackIndex++ % kinds.length]);
      // the rotation's ink tries the black cartridge first, then now and then (a forced 'ink' never does)
      if (kind === 'ink' && forcedKind === null && !fireVolley && !scene.stubs.includes(BLACK_X) && (inkTries++ === 0 || Math.random() < BLACK_CHANCE)) kind = 'black';
      forcedKind = null;
      if (kind === 'black') {
        if (scene.stubs.includes(BLACK_X)) {
          nextAttackAt = now + gap;
          return;
        }
        sprays.push({ nx: BLACK_X, x: BLACK_X, y: TUBE_TOP, at: now + TUBE_RISE_MS, color: 'z', fire: false, stoppedAt: null, done: true, fed: false, dud: true });
        nextAttackAt = now + TUBE_RISE_MS + SPRAY_MS + TUBE_RISE_MS + gap;
        return;
      }
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
        for (let i = 0; i < SPRAY_COUNT; i++) {
          // the last jet goes at the fire while it burns: into the middle of the main flame (not the fire's
          // own first volley: just caught, the fire would go out for good under it)
          const atFire = fireAt !== null && i === SPRAY_COUNT - 1 && !fireVolley;
          let x = 16 + Math.random() * 208;
          let y = 24 + Math.random() * 112;
          if (atFire) {
            const r = fireRect(fireU(now));
            x = (r.x0 + r.x1) / 2 + (Math.random() - 0.5) * 6;
            y = r.y0 + (r.y1 - r.y0) * 0.6 + (Math.random() - 0.5) * 8;
          }
          const nx = nozzles[Math.floor(Math.random() * nozzles.length)];
          sprays.push({ nx, x, y, at: now + TUBE_RISE_MS + i * SPRAY_STAGGER_MS, color: NOZZLES.find((n) => n.x === nx)!.color, fire: atFire, stoppedAt: null, done: false, fed: false, dud: false });
        }
        nextAttackAt = now + TUBE_RISE_MS + (SPRAY_COUNT - 1) * SPRAY_STAGGER_MS + SPRAY_MS + SPRAY_FLIGHT_MS + gap;
      } else if (kind === 'scan') {
        startScan(now);
        nextAttackAt = now + SCAN_TOTAL_MS + gap;
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
        else if (phase === 'fight' && frozenAt === null) {
          if (e.pointerType === 'touch') {
            tap = { x: v.x, y: v.y, at: now };
            lastTap = { x: v.x, y: v.y };
          }
          const a = aim(v, now);
          fire(a.x, a.y, now);
        }
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
        door: () => (scene.doorBroken ? 'broken' : scene.doorGap >= DOOR_OPEN ? 'open' : scene.doorGap > 0 ? 'cracked' : 'closed'),
        doorShots: () => doorShots,
        /** The storm this frame, and a near strike now. */
        storm: () => ({ ...scene.storm }),
        stormLevel: () => stormLevel,
        strike: () => strike(performance.now()),
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
        /** Each jet's nozzle, start and where it is landing now (the hunt's lagged target). */
        jets: () => sprays.map((s) => ({ nx: s.nx, at: s.at, landing: landingOf(s, performance.now()) })),
        holes: () => scene.holes.map((h) => h.kind),
        marks: () => scene.marks.map((m) => ({ ...m })),
        drops: () => drops.length,
        /** The pages on the glass: where each landed, and whether it is sliding off yet. */
        landed: () => pages.filter((p) => p.landedAt !== null).map((p) => ({ x: p.x1, y: p.y1, sliding: performance.now() - p.landedAt! >= PAGE_LANDED_MS })),
        thrown: () => staples.map((s) => ({ kind: s.kind, x: s.x, y: s.y, at: s.at, shot: s.shot, hit: s.hit })),
        ghosts: () => ghosts.length,
        name: () => lifeName.textContent,
        clock: () => ({ ...scene.clock }),
        clockSpin: () => scene.clockSpin,
        lights: () => [...scene.lights],
        fig: () => ({ ...scene.fig, leaves: scene.broken.fig, pot: scene.broken.figPot }),
        wreck: () => scene.printer === 'wreck',
        pieces: () => scene.pieces.map((q) => [Math.round(q.x), Math.round(q.y)]),
        windowOpen: () => scene.windowOpen,
        /** The x of a nozzle spraying right now, or null. */
        nozzle: () => sprays.find((s) => spraying(s, performance.now()))?.nx ?? null,
        /** The cross's gap and its offset from the mouse now (the bloom and the kick). `spread` is taken by the fire. */
        gap: () => spreadNow(performance.now()),
        kick: () => kickNow(performance.now()),
        /** Hold the gun steady (no kick, no bloom) so clicks land where they are aimed. */
        steady: (on: boolean) => {
          steady = on;
        },
        /** A shot at a virtual point through the gun (the kick, the bloom, the recoil): where it went
         * and the shots left, or null outside the fight. */
        shoot: (x: number, y: number) => {
          if (phase !== 'fight' || frozenAt !== null) return null;
          const now = performance.now();
          const a = aim({ x, y }, now);
          fire(a.x, a.y, now);
          return { x: a.x, y: a.y, shots };
        },
        /** The machine's lid (0 shut … 1 standing), the lamp's left edge in virtual px while it is on, and the bulb shot. */
        lid: () => scene.machine.lid,
        lamp: () => (scene.machine.lamp === null ? null : lampX(scene.machine.lamp)),
        bulb: () => bulbOut,
        /** The machine's shake this frame (the tremble, the landing): what is attached to it moves with it. */
        shake: () => ({ ...scene.shake }),
      };
    }

    // ---- timelines (ms from the start of the phase) -----------------------
    // The power light goes red and the lights go out; the machine pounces from the back of the
    // room to its place (poseBack) and lands; then it wakes: the lid rises, the lamp sweeps, the
    // flash (a scan, startScan); as the lid falls the display and the button go red and the
    // fight is on.
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
      [POUNCE_AT, () => sounds.pounce()],
      [WAKE_AT, () => startScan(performance.now())],
      [
        WAKE_AT + LID_MS + SWEEP_MS + WASH_MS,
        () => {
          scene.machine.angry = true;
          scene.trayPage = false;
          startFight(performance.now());
        },
      ],
    ];
    /** How far back the machine stands and its landing this frame: all the way back until the
     * pounce, forward over POUNCE_MS easing in (a cut under reduced motion), then two px low for
     * LAND_MS and shaking for POUNCE_SHAKE_MS. Null shake = none from the pounce. */
    const poseBack = (now: number): { x: number; y: number } | null => {
      const m = scene.machine;
      if (phase !== 'look' && phase !== 'sticker') {
        m.back = 0;
        return null;
      }
      const t = phase === 'sticker' ? now - phaseAt - POUNCE_AT : -Infinity;
      if (t < 0) {
        m.back = 1;
        return null;
      }
      const u = reduced ? 1 : Math.min(1, t / POUNCE_MS);
      m.back = 1 - u * u;
      if (reduced || t < POUNCE_MS || t >= POUNCE_MS + POUNCE_SHAKE_MS) return null;
      const lt = t - POUNCE_MS;
      if (frameCount % SHAKE_FRAMES === 0 || lt < 16) landShake = { x: Math.floor(Math.random() * 5) - 2, y: Math.floor(Math.random() * 5) - 2 + (lt < LAND_MS ? 2 : 0) };
      return landShake;
    };
    let landShake = { x: 0, y: 0 };
    // The end: the machine in pieces, the fire (if there is one) raging on in the dark room, the
    // HUD gone; out as the tune starts, FANFARE_AFTER_MS after the burst (the tune plays on under
    // the host's drop). The lights stay off and nothing comes back.
    const END_STEPS: [number, () => void][] = [[0, () => showFightUi(false)]];

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
        swingDoor(now);
      }
      // The storm: a near strike now and then, far lightning between.
      if (now >= nextStrike) strike(now);
      if (now >= nextFar) farStrike(now);
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
        poseScan(now);
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
        poseScan(now);
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
            // the mark it leaves: a staple or a bolt sticks in the glass; a nut bounces off and drops out of the frame
            if (s.kind === 'nut') drops.push({ kind: 'nut', x: s.x, y: s.y, at: now });
            else addMark(s.kind, s.x, s.y);
          }
        }
        staples = staples.filter((s) => !s.hit && !s.shot);
        drops = drops.filter((d) => now - d.at < DROP_MS);
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
            if (s.dud) sounds.inkDud();
            else sounds.inkSpray();
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
      } else if (phase === 'end') {
        endStep = runSteps(END_STEPS, endStep, t);
        if (now - burstAt >= FANFARE_AFTER_MS) finish();
      }
    };

    // ---- render -----------------------------------------------------------
    // A glow box per projectile in flight (never a landed page: it cannot be shot),
    // in screen px over the frame; spare boxes are hidden.
    const drawGlows = (now: number) => {
      const rects: { x: number; y: number; w: number; h: number }[] = [];
      for (const s of staples) if (now >= s.at && !s.hit && !s.shot) rects.push(staplePose(s, now));
      for (const p of pages) if (now >= p.at && !p.shot && p.landedAt === null) rects.push(pagePose(p, now));
      for (const s of sprays) {
        if (!spraying(s, now)) continue;
        const tb = poseTube(s.nx, 1, now);
        const hx = tubeX(tb, tb.top);
        rects.push({ x: Math.min(s.nx, hx) - 3 + scene.shake.x, y: tb.top + scene.shake.y, w: Math.abs(hx - s.nx) + 6, h: TUBE_BASE - tb.top });
      }
      // the thrown things (the staples, nuts and bolts, then the pages) get a filled inside too
      const thrown = rects.slice(0, staples.filter((s) => now >= s.at && !s.hit && !s.shot).length + pages.filter((p) => now >= p.at && !p.shot && p.landedAt === null).length);
      if (scene.buttonBright) rects.push({ ...BUTTON, x: BUTTON.x + scene.shake.x, y: BUTTON.y + scene.shake.y });
      placeGlows(glows, 'prntr-room-glow', rects);
      placeGlows(glowFills, 'prntr-room-glow-fill', thrown);
    };
    const placeGlows = (layer: HTMLElement, cls: string, rects: { x: number; y: number; w: number; h: number }[]) => {
      while (layer.children.length < rects.length) layer.append(el('div', cls));
      Array.from(layer.children).forEach((n, i) => {
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
    // The door swings in from where it stands, easing out, a pixel at a time; the light in it is drawn as wide.
    const poseDoor = (now: number) => {
      if (doorOpenAt !== null) {
        const u = reduced ? 1 : Math.min(1, (now - doorOpenAt) / DOOR_OPEN_MS);
        scene.doorGap = doorFrom + Math.floor((DOOR_OPEN - doorFrom) * (1 - (1 - u) * (1 - u)));
      }
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
    // The storm outside: a near strike (its bolt in the door's or the window's view), far lightning
    // between, and what the room sees of it this frame.
    const strike = (now: number) => {
      strikeAt = now;
      lastNear = now;
      bolt = { x: Math.random() < 0.5 ? 16 + Math.floor(Math.random() * 22) : 166 + Math.floor(Math.random() * 52), seed: Math.floor(now) };
      nextStrike = now + STRIKE_MIN_MS + Math.random() * (STRIKE_MAX_MS - STRIKE_MIN_MS);
      if (nextFar < now + FAR_GAP_MS) nextFar = now + FAR_GAP_MS;
      stormSound?.thunder(0.15, true);
    };
    const farStrike = (now: number) => {
      if (now - lastNear < FAR_GAP_MS) {
        nextFar = lastNear + FAR_GAP_MS;
        return;
      }
      farAt = now;
      nextFar = now + FAR_MIN_MS + Math.random() * (FAR_MAX_MS - FAR_MIN_MS);
      stormSound?.thunder(THUNDER_MIN_S + Math.random() * (THUNDER_MAX_S - THUNDER_MIN_S), false);
    };
    const poseStorm = (now: number) => {
      const st = now - strikeAt;
      const u = st / FLASH_MS;
      const near = reduced ? (st < 20 ? 1 : 0) : u < 0.15 ? 1 : u < 1 ? 1 - u : st < FLASH_MS + AFTERGLOW_MS ? 0.12 * (1 - (st - FLASH_MS) / AFTERGLOW_MS) : 0;
      const fu = (now - farAt) / FAR_MS;
      const far = reduced ? 0 : fu < 0.2 ? 1 : fu < 0.35 ? 0.4 : fu < 0.5 ? 0.9 : fu < 1 ? 1 - fu : 0;
      scene.storm = { t: reduced ? 0 : now, near, far, bolt: near > 0.25 ? bolt : null };
      // the light into the room: the glow of the light boxes, how open each opening is, and the pale
      // wash of a near flash by how open the room is (no flare under reduced motion)
      const glow = reduced ? 0.06 : Math.max(near * 0.8, far * 0.18, 0.06);
      setVar('--storm-glow', glow);
      setVar('--storm-door', scene.doorBroken || scene.doorGap >= DOOR_OPEN ? 1 : scene.doorGap > 0 ? 0.5 : 0);
      setVar('--storm-window', scene.windowOpen ? 1 : near > 0.3 ? 0.25 : 0);
      setVar('--storm-room', !reduced && near > 0.3 ? 0.18 * near * openness() : 0);
      // its sound: through the walls when shut, more with every opening
      const level = Math.max(STORM_SHUT, openness());
      if (level !== stormLevel) {
        stormLevel = level;
        if (stormGain && audio.context) stormGain.gain.setTargetAtTime(level, audio.context.currentTime, 0.3);
      }
    };
    /** How open the room is to the storm, 0..1: the door's state and the window's. Its light scales with it. */
    const openness = () => Math.min(1, (scene.doorBroken ? 1 : scene.doorGap >= DOOR_OPEN ? 0.6 : scene.doorGap > 0 ? 0.3 : 0) + (scene.windowOpen ? 0.4 : 0));
    /** A CSS variable on the frame, set only when its value (to two decimals) changes. */
    const vars = new Map<string, string>();
    const setVar = (name: string, v: number) => {
      const s = v.toFixed(2);
      if (vars.get(name) === s) return;
      vars.set(name, s);
      frame.style.setProperty(name, s);
    };
    const render = (now: number) => {
      poseSign(now);
      poseClock(now);
      poseDoor(now);
      poseStorm(now);
      poseFire(now);
      scene.flashWhite = flashFrames > 0;
      scene.damage = score / HI;
      // the black cartridge's error on the display, from the cough until a while after
      const dud = sprays.find((s) => s.dud && now >= s.at && now < jetEnd(s) + DUD_ERROR_TAIL_MS);
      scene.machine.error = dud ? now - dud.at : null;
      // the angry display's flicker runs on the frame's time (still under reduced motion)
      scene.machine.t = reduced ? 0 : now;
      if (flashFrames > 0) flashFrames--;
      scene.buttonBright = phase === 'fight' && scene.printer === 'up' && (mad || buttonBright(now));
      if (scene.printer === 'wreck') posePieces(now);
      // The tremble: a new offset of ±1 px every few frames while the mad machine fights; the
      // pounce's landing before that.
      frameCount++;
      const landing = poseBack(now);
      if (landing) scene.shake = landing;
      else if (mad && phase === 'fight' && scene.printer === 'up' && frozenAt === null && !reduced) {
        if (frameCount % SHAKE_FRAMES === 0) scene.shake = { x: Math.floor(Math.random() * 3) - 1, y: -Math.floor(Math.random() * 2) };
      } else {
        scene.shake = { x: 0, y: 0 };
      }
      // The fig going over, and catching from the fire once it leans on the machine.
      if (figFallAt !== null && scene.fig.fall < 1) {
        const u = reduced ? 1 : Math.min(1, (now - figFallAt) / FIG_FALL_MS);
        scene.fig.fall = u * u;
        if (u >= 1) {
          sounds.knock();
          sounds.rustle();
        }
      }
      if (scene.fig.fall >= 1 && !scene.fig.burning && fireAt !== null && scene.printer === 'up' && frozenAt === null) {
        figCatchAt ??= now + FIG_CATCH_MS;
        if (now >= figCatchAt) {
          scene.fig.burning = true;
          sounds.whoosh();
          if (spreadAt === null) spreadAt = now;
          else if (stokes < STOKE_MAX) {
            const v = spreadU(now);
            stokes++;
            spreadMs = Math.round(FIRE_SPREAD_MS * Math.pow(STOKE_STEP, stokes));
            spreadAt = now - v * spreadMs;
          }
        }
      }
      // The clock's hands spin while the machine moves: forward in the pounce, shaking as it lands, trembling mad.
      const moving = landing !== null || (scene.machine.back > 0 && scene.machine.back < 1) || scene.shake.x !== 0 || scene.shake.y !== 0;
      if (moving && !reduced && frozenAt === null) {
        if (now >= spinUntil) spinFrom = now;
        spinUntil = now + CLOCK_SPIN_TAIL_MS;
      }
      scene.clockSpin = now < spinUntil ? now - spinFrom : null;
      // The lights flicker back on now and then while the machine is nearly dead.
      const flickering = phase === 'fight' && scene.printer === 'up' && scene.damage >= FLICKER_FROM && !reduced;
      if (frozenAt === null) {
        for (let i = 0; i < 2; i++) {
          const off = flickerOff[i];
          if (off !== null && (now >= off || !flickering)) {
            flickerOff[i] = null;
            scene.lights[i] = false;
            sounds.lightTick();
          }
        }
        if (flickering && now >= flickerNext) {
          const on = FLICKER_ON_MIN + Math.random() * (FLICKER_ON_MAX - FLICKER_ON_MIN);
          const which = Math.random() < FLICKER_BOTH ? [0, 1] : [Math.floor(Math.random() * 2)];
          for (const i of which) {
            scene.lights[i] = true;
            flickerOff[i] = now + on;
          }
          sounds.lightBuzz(on / 1000);
          flickerNext = now + on + FLICKER_GAP_MIN + Math.random() * (FLICKER_GAP_MAX - FLICKER_GAP_MIN);
        }
      }
      // The slot's red light is a DOM box over the canvas: it trembles with the machine.
      slotLight.style.transform = scene.shake.x || scene.shake.y ? `translate(${scene.shake.x * scale}px, ${scene.shake.y * scale}px)` : '';
      // The cross's trail, for the snakes' lagged hunt: the pointer, or on touch the last tap.
      const seen = pointer ?? lastTap;
      if (seen && phase === 'fight') trail.push({ at: now, x: seen.x, y: seen.y });
      while (trail.length && trail[0].at < now - TRAIL_MS) trail.shift();
      // The tubes up behind the machine: rising before the jet, sinking after it, one per nozzle
      // (the most risen of its jets), turned after the cross as the machine's health goes.
      const tubes = new Map<number, number>();
      for (const s of sprays) {
        const from = s.at - TUBE_RISE_MS;
        const to = jetEnd(s) + TUBE_RISE_MS;
        if (now < from || now >= to) continue;
        const up = reduced ? 1 : now < s.at ? (now - from) / TUBE_RISE_MS : now < jetEnd(s) ? 1 : (to - now) / TUBE_RISE_MS;
        tubes.set(s.nx, Math.max(up, tubes.get(s.nx) ?? 0));
      }
      scene.tubes = [];
      for (const [nx, up] of tubes) scene.tubes.push(poseTube(nx, up, now));
      // The ink on the far half of its flight goes behind the machine: it is sprayed from behind it.
      scene.inkBehind = [];
      for (const s of sprays) {
        if (now < s.at || s.dud) continue;
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
      // The marks on the glass, under the things in flight, the landed pages and the ink.
      drawMarks(fpix, scene.marks);
      // Out of the slot: only the top rows of the sprite so far, then the whole thing.
      for (const s of staples) {
        if (now < s.at || s.hit || s.shot) continue;
        const r = staplePose(s, now);
        const spr = thrownSprite(s, now);
        if (r.h < spr.h) fpix.blit(r.x, r.y, { w: spr.w, h: r.h, rows: spr.rows.slice(0, r.h) });
        else fpix.blit(r.x, r.y, spr, r.w / spr.w);
      }
      // A nut that bounced off, a staple or a bolt shot off: falling and turning out of the bottom of the
      // frame (gone at once under reduced motion).
      for (const d of drops) {
        const a = reduced ? DROP_MS : now - d.at;
        if (a >= DROP_MS) continue;
        const k = a / 1000;
        const sc = d.kind === 'nut' ? 3 : 4;
        const spr = rotateSprite(d.kind === 'nut' ? SPR.NUT : d.kind === 'staple' ? SPR.STAPLE : SPR.BOLT, Math.floor(a / DROP_SPIN_MS) % 4);
        fpix.blit(Math.floor(d.x - (spr.w * sc) / 2 + 8 * k), Math.floor(d.y + DROP_GRAVITY * k * k + 10 * k - (spr.h * sc) / 2), spr, sc);
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
        if (s.dud) {
          // the black cartridge coughs: a speck hops out of the mouth and falls back onto the machine
          DUD_COUGHS_MS.forEach((c, i) => {
            const at = s.at + c;
            if (now < at || at >= jetEnd(s)) return;
            const k = (now - at) / 1000;
            const m = mouthOf(s, at);
            const y = Math.floor(m.y - 60 * k + 200 * k * k) + scene.shake.y;
            if (y >= TUBE_BASE + scene.shake.y) return;
            const x = Math.floor(m.x + (i - 1) * 2 + (i - 1) * 10 * k) + scene.shake.x;
            fpix.rect(x, y, x + 2, y + 2 - (i === 2 ? 1 : 0), 'z');
          });
          continue;
        }
        const end = Math.min(now, jetEnd(s));
        for (let tau = s.at; tau < end; tau += SPRAY_EVERY_MS) {
          if (now - tau >= SPRAY_FLIGHT_MS || now - tau < SPRAY_FLIGHT_MS / 2) continue;
          const q = particlePose(s, tau, now);
          fpix.rect(q.x, q.y, q.x + q.size, q.y + q.size, s.color);
        }
        const sc = splatScale(s, now);
        if (sc === 0) continue;
        // the splat builds where the jet is landing: where the player was, half a second behind (the hunt)
        const L = landingOf(s, now);
        const slide = splatSlide(s, sc, L.y, now);
        const top = Math.floor(L.y - 7 * sc + slide);
        // the drips it leaves running down the glass above it, each its own length
        if (slide > 0) {
          for (let i = 0; i < INK_DRIPS; i++) {
            const k = ((i + 1) / (INK_DRIPS + 1)) * 16 * sc - 8 * sc + (((s.at * 31 + i * 17) % 7) - 3) * (sc / 2);
            const x = Math.floor(L.x + k);
            const from = Math.floor(L.y - 7 * sc + 3 * sc + (((s.at * 13 + i * 29) % 5) * sc) / 2);
            fpix.rect(x, from, x + 1 + (i % 2), top + 4 * sc, s.color);
          }
        }
        fpix.blit(Math.floor(L.x - 8 * sc), top, SPR.SPLAT, sc, { remap: { c: s.color } });
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
      const aiming = phase === 'fight' || phase === 'continue' || phase === 'over';
      const at = pointer ?? (aiming && tap && now - tap.at < TOUCH_CROSS_MS ? tap : null);
      if (at && aiming) {
        const k = kickNow(now);
        drawCross(Math.floor(at.x + k.x), Math.floor(at.y + k.y), Math.round(spreadNow(now)));
      } else if (pointer) cpix.blit(Math.floor(pointer.x) - 2, Math.floor(pointer.y), SPR.POINTER);
      pix.present(g);
      fpix.present(fg);
      cpix.present(cg);
      drawGlows(now);
      // The white-out: the flash's wash from 100%, fading fast then with a tail; under the HUD and the cross.
      if (washAt) {
        const u = (now - washAt) / (reduced ? WHITEOUT_MS / 2 : WHITEOUT_MS);
        if (u >= 1) {
          washAt = 0;
          wash.classList.remove('is-on');
          wash.style.opacity = '';
        } else wash.style.opacity = String((1 - u) * (1 - u));
      }
      canvas.classList.toggle('is-inverted', invertFrame);
      art.classList.toggle('is-inverted', invertFrame);
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
        stormSound?.stop(0.5);
        window.setTimeout(() => stormGain?.disconnect(), 1000);
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
