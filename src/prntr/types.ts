/** Downscaled copies of the page as it was when Prntr started (long side ≤ 960px). */
export interface PageBitmaps {
  source: HTMLCanvasElement;
  recolored: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * What a stage gets to work with. `g` is already scaled by devicePixelRatio, so
 * stages draw in CSS pixels: the visible canvas is `width` × `height` units and
 * that size is fixed for the whole run (the CSS scales the element if the
 * viewport changes).
 */
export interface StageContext {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  width: number;
  height: number;
  page: PageBitmaps;
  inkHex: string;
  /** Aborted when the user leaves (Esc, ✕) or the component unmounts. */
  signal: AbortSignal;
  /** The one line of text under the canvas. Empty string hides it. */
  setCaption(text: string): void;
  /** Client (pointer event) coordinates → canvas units. */
  toLocal(clientX: number, clientY: number): { x: number; y: number };
}

/**
 * What one stage passes to the next. Every stage MUST accept `{ kind: 'start' }`
 * and build its own input from `ctx.page` (that is what lets the dev entrance
 * `?prntr=N` begin at any stage), plus the kind its predecessor emits. New kinds
 * are added here as stages land.
 */
export type Handoff =
  | { kind: 'start' }
  /** A cols×rows sliding-puzzle layout: slots[i] = tile index shown at slot i, -1 = the gap. */
  | { kind: 'tiles'; cols: number; rows: number; slots: number[] };

export interface Stage {
  name: string;
  run(ctx: StageContext, input: Handoff): Promise<Handoff>;
}
