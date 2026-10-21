import { EmptyPdfError, HeicDecodeError, ImageDecodeError, UnsupportedFileError } from './errors';

// pdf.js's modern build calls built-ins only the newest browsers have
// (Map#getOrInsertComputed, Math.sumPrecise, Uint8Array#toHex, …) without
// polyfills, so a browser a release or two behind would fail every PDF.
// Such a browser gets the legacy build, which carries the polyfills.
function needsLegacyPdfjs(): boolean {
  const iterator = (globalThis as { Iterator?: { prototype: object } }).Iterator;
  return !(
    'getOrInsertComputed' in Map.prototype &&
    'getOrInsertComputed' in WeakMap.prototype &&
    'sumPrecise' in Math &&
    'toHex' in Uint8Array.prototype &&
    'fromBase64' in Uint8Array &&
    'try' in Promise &&
    'withResolvers' in Promise &&
    'parse' in URL &&
    !!iterator &&
    'take' in iterator.prototype
  );
}

// pdfjs is loaded on demand so the landing screen doesn't pay for it.
async function getPdfjs() {
  const [pdfjsLib, worker] = needsLegacyPdfjs()
    ? await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
      ])
    : await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjsLib;
}

// One worker thread for every PDF of the session. Without it each getDocument
// starts its own worker, which only that document's destroy() would stop.
type Pdfjs = Awaited<ReturnType<typeof getPdfjs>>;
let pdfWorker: Promise<{ pdfjsLib: Pdfjs; worker: InstanceType<Pdfjs['PDFWorker']> }> | null = null;
function getPdfWorker() {
  if (!pdfWorker) {
    pdfWorker = getPdfjs().then((pdfjsLib) => ({ pdfjsLib, worker: new pdfjsLib.PDFWorker() }));
    // A failed chunk load may succeed on the next file.
    pdfWorker.catch(() => {
      pdfWorker = null;
    });
  }
  return pdfWorker;
}

/**
 * Starts loading pdf.js and its worker (about 480 KB gzipped) before a file
 * arrives, on a sign that one is coming: the pointer on the drop zone, a file
 * dragged in, the picker opened. Failures are left for the real load to report.
 */
export function prefetchPdfjs(): void {
  getPdfWorker().catch(() => undefined);
}

// ~150 DPI: readable in print, fast enough for per-pixel recoloring.
const RENDER_DPI = 150;
// The largest canvas a page gets, for PDF pages and images alike: a poster or
// a panorama is scaled down rather than failing (iOS caps a canvas at 16.7 MP)
// or holding hundreds of megabytes.
const MAX_DIM = 3500;
const MAX_PIXELS = MAX_DIM * MAX_DIM;

/** The scale (≤ want) that fits a width × height page within MAX_DIM and MAX_PIXELS. */
function fitScale(width: number, height: number, want: number): number {
  return Math.min(want, MAX_DIM / Math.max(width, height), Math.sqrt(MAX_PIXELS / (width * height)));
}

export interface SourceDocument {
  pageCount: number;
  renderPage(index: number): Promise<HTMLCanvasElement>;
  /** Frees the parsed document; a render still running rejects. Call when it is replaced. */
  destroy(): void;
}

export type FileKind = 'pdf' | 'png' | 'jpg' | 'heic';

/** The supported format of `file`, from its MIME type or extension. */
export function fileKind(file: File): FileKind | null {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type === 'image/heic' || file.type === 'image/heif' || /\.hei[cf]$/.test(name))
    return 'heic';
  if (file.type === 'image/png' || name.endsWith('.png')) return 'png';
  if (file.type === 'image/jpeg' || /\.jpe?g$/.test(name)) return 'jpg';
  return null;
}

export async function loadDocument(file: File): Promise<SourceDocument> {
  const kind = fileKind(file);
  if (kind === 'pdf') return loadPdf(file);
  if (kind === 'heic') return loadImage(await decodeHeic(file));
  if (kind === 'png' || kind === 'jpg') return loadImage(file);
  throw new UnsupportedFileError();
}

// Browsers (Safari aside) can't decode HEIC natively; the decoder is imported
// only when a HEIC file actually arrives so the common path stays light.
async function decodeHeic(file: File): Promise<Blob> {
  try {
    const { heicTo } = await import('heic-to');
    return await heicTo({ blob: file, type: 'image/png' });
  } catch (err) {
    throw new HeicDecodeError(err instanceof Error ? err.message : String(err));
  }
}

async function loadPdf(file: File): Promise<SourceDocument> {
  const { pdfjsLib, worker } = await getPdfWorker();
  const data = await file.arrayBuffer();
  const assets = `${import.meta.env.BASE_URL}${__PDFJS_PATH__}`;
  const pdf = await pdfjsLib.getDocument({
    data,
    worker,
    // Fetched only when a page needs them: the decoders for scanned images
    // (JBIG2, CCITT, JPEG 2000), CMaps for CJK text, the 14 standard fonts.
    wasmUrl: `${assets}wasm/`,
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    iccUrl: `${assets}iccs/`,
  }).promise;
  if (pdf.numPages === 0) {
    void pdf.destroy();
    throw new EmptyPdfError();
  }
  return {
    pageCount: pdf.numPages,
    async renderPage(index: number): Promise<HTMLCanvasElement> {
      const page = await pdf.getPage(index + 1);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: fitScale(natural.width, natural.height, RENDER_DPI / 72) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      // PDF pages may not paint their own background; force paper white.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } finally {
        // The canvas holds the result; drop pdf.js's operator list and decoded images.
        page.cleanup();
      }
      return canvas;
    },
    destroy: () => void pdf.destroy(),
  };
}

async function loadImage(file: Blob): Promise<SourceDocument> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new ImageDecodeError(err instanceof Error ? err.message : String(err));
  }
  const scale = fitScale(bitmap.width, bitmap.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return {
    pageCount: 1,
    renderPage: () => Promise.resolve(canvas),
    destroy: () => undefined,
  };
}
