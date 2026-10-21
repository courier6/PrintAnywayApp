import type { PrntrAudio } from './audio';

/** Downscaled copies of the page as it was when Prntr started (long side ≤ 960px). */
export interface PageBitmaps {
  source: HTMLCanvasElement;
  recolored: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * What a stage gets to work with. `root` is the full-viewport element the stage
 * owns: build DOM (or a canvas) inside it and leave it empty when resolving.
 * Everything else is shared for the whole run.
 */
export interface StageContext {
  root: HTMLElement;
  page: PageBitmaps;
  inkHex: string;
  audio: PrntrAudio;
  /** Resolves once Prntr's web fonts are usable (never rejects). */
  fontsReady: Promise<void>;
  /** Aborted when the user leaves (Esc, ✕) or the component unmounts. */
  signal: AbortSignal;
  /** Screen-reader announcement through Prntr's one aria-live="polite" region. */
  announce(text: string): void;
}

/**
 * What one stage passes to the next. Every stage MUST accept `{ kind: 'start' }`
 * and build its own input from `ctx.page` (that is what lets the dev entrance
 * `?prntr=N` begin at any stage), plus the kind its predecessor emits. New kinds
 * are added here as stages land: the room (stage 1) ends with `cleared` (and who
 * cleared it), or with `over` (a game over), which ends the chain whatever follows.
 */
export type Handoff = { kind: 'start' } | { kind: 'cleared'; score: number; player: string; stats: RunStats } | { kind: 'over'; score: number };

/** What the room counted while it was won; the certificate turns it into honours. */
export interface RunStats {
  /** By the gun (1337 reached while the machine stood) or by the fire (it burst as the score ran out). */
  wonBy: 'gun' | 'fire';
  /** The blind shot out (`breakWindow`), the door shot to planks (`breakDoor`). */
  window: boolean;
  door: boolean;
  /** The fire was started at least once (it may have been put out), and how often it was stoked. */
  fire: boolean;
  stokes: number;
  /** Shots fired, and the ones that hit something (anything the room reacts to: not the wall, the carpet, or out through the open door or window). */
  shotsFired: number;
  hits: number;
  livesLost: number;
  continues: number;
  /** Ink tubes blown off the head (`explodeTube`), 0–4. */
  tubes: number;
  /** Pages and staples shot out of the air. */
  pages: number;
  staples: number;
  /** From the fight's start to the burst. */
  seconds: number;
}

/**
 * The certificate of completion: the page the app loads in place of
 * its document when the chain ends cleared, with the id printed on it, unique to that win.
 */
export interface Certificate {
  id: string;
  /** US Letter at 2× (1224 × 1584), black on white; the app recolours it like any page. */
  page: HTMLCanvasElement;
}

export interface Stage {
  name: string;
  run(ctx: StageContext, input: Handoff): Promise<Handoff>;
}
