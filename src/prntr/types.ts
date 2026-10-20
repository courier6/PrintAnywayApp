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
 * are added here as stages land: `cleared` is what the room (stage 1) ends with.
 */
export type Handoff = { kind: 'start' } | { kind: 'cleared'; score: number };

export interface Stage {
  name: string;
  run(ctx: StageContext, input: Handoff): Promise<Handoff>;
}
