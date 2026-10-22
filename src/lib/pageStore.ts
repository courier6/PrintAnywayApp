import type { PageSize } from './loadDocument';
import { luminanceMap, recolorToCanvas } from './recolor';

/** What a wait on a page gets when its document is replaced before the page renders. */
export class DocumentReplacedError extends Error {
  constructor() {
    super('The document was replaced');
    this.name = 'DocumentReplacedError';
  }
}

export interface PageEntry {
  source?: HTMLCanvasElement;
  lum?: Uint8Array;
  width: number;
  height: number;
  sizePt: PageSize | null;
  recolored?: HTMLCanvasElement;
  recoloredInk?: string;
}

/** A document's rendered pages, taken out of the store to be put back later (the vortex, PRNTR-VORTEX.md). */
export type PageSnapshot = readonly Readonly<PageEntry>[];

/**
 * In-memory document store: source renders, cached luminance maps, and
 * recolored canvases. Swatch changes only re-run the cheap luminance→ink
 * ramp, never the PDF render. Nothing here ever leaves the device.
 */
export class PageStore {
  private pages: PageEntry[] = [];
  private readyResolvers: Array<() => void> = [];
  private readyRejecters: Array<(err: Error) => void> = [];
  private readyPromises: Array<Promise<void>> = [];

  /** Starts a new document; anything still waiting on the old one's pages rejects. */
  reset(count: number): void {
    for (const reject of this.readyRejecters) reject(new DocumentReplacedError());
    this.pages = Array.from({ length: count }, () => ({ width: 0, height: 0, sizePt: null }));
    this.readyResolvers = new Array<() => void>(count);
    this.readyRejecters = new Array<(err: Error) => void>(count);
    this.readyPromises = Array.from({ length: count }, (_, i) => {
      const ready = new Promise<void>((resolve, reject) => {
        this.readyResolvers[i] = resolve;
        this.readyRejecters[i] = reject;
      });
      // Nobody waiting is the usual case; only a waiter should see the rejection.
      ready.catch(() => undefined);
      return ready;
    });
  }

  /** The pages rendered so far (a prefix: pages render in order), copied out so restore() can put them back. */
  snapshot(): PageSnapshot {
    const n = this.pages.findIndex((p) => !p.source);
    return this.pages.slice(0, n < 0 ? this.pages.length : n).map((p) => ({ ...p }));
  }

  /** The reverse of snapshot(): a reset to the snapshot's pages, each one ready at once. */
  restore(snap: PageSnapshot): void {
    this.reset(snap.length);
    snap.forEach((p, i) => {
      this.pages[i] = { ...p };
      this.readyResolvers[i]?.();
    });
  }

  get pageCount(): number {
    return this.pages.length;
  }

  setSource(index: number, canvas: HTMLCanvasElement, sizePt: PageSize | null): void {
    const page = this.pages[index];
    if (!page) return;
    page.source = canvas;
    page.sizePt = sizePt;
    page.width = canvas.width;
    page.height = canvas.height;
    page.lum = luminanceMap(canvas);
    this.readyResolvers[index]?.();
  }

  hasSource(index: number): boolean {
    return !!this.pages[index]?.source;
  }

  getSource(index: number): HTMLCanvasElement | null {
    return this.pages[index]?.source ?? null;
  }

  /** The page's size in points, when its source had one (a PDF page, the certificate). */
  getSizePt(index: number): PageSize | null {
    return this.pages[index]?.sizePt ?? null;
  }

  /** Resolves once the page's source render (and luminance cache) exists. */
  whenSourceReady(index: number): Promise<void> {
    return this.readyPromises[index] ?? Promise.resolve();
  }

  /** Recolors the page at the given ink if stale; returns null until the source exists. */
  ensureRecolored(index: number, inkHex: string): HTMLCanvasElement | null {
    const page = this.pages[index];
    if (!page?.lum) return null;
    if (!page.recolored || page.recoloredInk !== inkHex) {
      page.recolored = recolorToCanvas(page.lum, page.width, page.height, inkHex, page.recolored);
      page.recoloredInk = inkHex;
    }
    return page.recolored;
  }

  /** The recolored canvas only if it's already at the given ink. */
  getRecolored(index: number, inkHex: string): HTMLCanvasElement | null {
    const page = this.pages[index];
    return page?.recolored && page.recoloredInk === inkHex ? page.recolored : null;
  }
}
