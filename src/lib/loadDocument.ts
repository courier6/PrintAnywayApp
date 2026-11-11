import { get2d } from './canvas2d';
import type { ExportFormat } from './exportFile';
import { BrowserTooOldError, EmptyPdfError, HeicDecodeError, ImageDecodeError, OfficeFileError, UnsupportedFileError } from './errors';

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

// What the legacy build itself calls without a polyfill (pdf.js 6 states Chrome 125,
// Firefox ESR and Safari 18 as its minimum). A browser without these opens no PDF.
function canRunPdfjs(): boolean {
  return (
    'withResolvers' in Promise &&
    typeof AbortSignal !== 'undefined' &&
    'any' in AbortSignal &&
    'transferToFixedLength' in ArrayBuffer.prototype &&
    'toSpliced' in Array.prototype
  );
}

// pdfjs is loaded on demand so the landing screen doesn't pay for it.
async function getPdfjs() {
  if (!canRunPdfjs()) throw new BrowserTooOldError();
  let loaded;
  try {
    loaded = needsLegacyPdfjs()
      ? await Promise.all([
          import('pdfjs-dist/legacy/build/pdf.mjs'),
          import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
        ])
      : await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  } catch (err) {
    // A chunk the browser cannot parse is its age too; one it could not fetch is a TypeError.
    if (err instanceof SyntaxError) throw new BrowserTooOldError(err.message);
    throw err;
  }
  const [pdfjsLib, worker] = loaded;
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

/** A page's size in PDF points (1/72 in). */
export interface PageSize {
  width: number;
  height: number;
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  /** The page's own size, for a PDF; null for an image, which has none. */
  sizePt: PageSize | null;
}

export interface SourceDocument {
  pageCount: number;
  renderPage(index: number): Promise<RenderedPage>;
  /** Frees the parsed document; a render still running rejects. Call when it is replaced. */
  destroy(): void;
}

export type FileKind = 'pdf' | 'png' | 'jpg' | 'heic';

/** HEIF brands that hold a HEVC-coded photo (ISO 23008-12); the file names it at byte 8, after "ftyp". */
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];
/** A PDF's "%PDF-" may follow junk; readers look for it in the first kilobyte. */
const SNIFF_BYTES = 1024;

interface Format {
  kind: FileKind;
  mimes: readonly string[];
  /** Lower case, without the dot. */
  extensions: readonly string[];
  /** What a download of it is saved as: browsers cannot encode HEIC, so it leaves as JPG. */
  exportAs: ExportFormat;
  /** Whether the file's first SNIFF_BYTES bytes (also given as Latin-1 text) are this format's. */
  magic: (head: Uint8Array, ascii: string) => boolean;
}

/**
 * The input formats, one row each: everything that depends on the list (the kind a name claims, the kind
 * the bytes show, the download format, the picker's filter) is built from it. A new format is a row here
 * and its loader in loadDocument. Where a name and a MIME type disagree, the earlier row wins.
 */
const FORMATS: readonly Format[] = [
  { kind: 'pdf', mimes: ['application/pdf'], extensions: ['pdf'], exportAs: 'pdf', magic: (_, ascii) => ascii.includes('%PDF-') },
  {
    kind: 'heic',
    mimes: ['image/heic', 'image/heif'],
    extensions: ['heic', 'heif'],
    exportAs: 'jpg',
    magic: (_, ascii) => ascii.slice(4, 8) === 'ftyp' && HEIC_BRANDS.includes(ascii.slice(8, 12)),
  },
  { kind: 'png', mimes: ['image/png'], extensions: ['png'], exportAs: 'png', magic: (head) => head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 },
  { kind: 'jpg', mimes: ['image/jpeg'], extensions: ['jpg', 'jpeg'], exportAs: 'jpg', magic: (head) => head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff },
];

/** The file picker's filter: every format's extensions and MIME types. */
export const ACCEPT = [...FORMATS.flatMap((f) => f.extensions.map((e) => `.${e}`)), ...FORMATS.flatMap((f) => f.mimes)].join(',');

/** What a download of a file of this kind is saved as. */
export function exportFormat(kind: FileKind): ExportFormat {
  return FORMATS.find((f) => f.kind === kind)!.exportAs;
}

/** The supported format `file` claims to be, from its MIME type or extension. */
export function fileKind(file: File): FileKind | null {
  const name = file.name.toLowerCase();
  return FORMATS.find((f) => f.mimes.includes(file.type) || f.extensions.some((e) => name.endsWith(`.${e}`)))?.kind ?? null;
}

/** The format the file's first bytes say it is, whatever its name says; null when they say nothing known. */
export async function sniffKind(file: Blob): Promise<FileKind | null> {
  let head: Uint8Array;
  try {
    head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  } catch {
    return null; // unreadable now: the load reports it
  }
  const ascii = String.fromCharCode(...head);
  // Last row first: the signatures at a fixed place are asked before the PDF's, which may sit anywhere in these bytes.
  for (let i = FORMATS.length - 1; i >= 0; i--) if (FORMATS[i].magic(head, ascii)) return FORMATS[i].kind;
  return null;
}

/**
 * The file's format: what its bytes say (a PNG named .pdf is a PNG), else what its name and MIME type claim
 * (a damaged PDF is still a PDF, and is reported as one).
 */
export async function detectKind(file: File): Promise<FileKind | null> {
  return (await sniffKind(file)) ?? fileKind(file);
}

const OFFICE_EXTENSIONS = /\.(docx?|odt|rtf|txt|pages|xlsx?|ods|numbers|pptx?|odp|key)$/;
const OFFICE_MIME = /^(application\/(msword|rtf|vnd\.openxmlformats-officedocument|vnd\.oasis\.opendocument|vnd\.ms-)|text\/(plain|rtf))/;

/** A word processor, spreadsheet, presentation or text file: every app that makes one can save it as a PDF. */
export function isOfficeFile(file: File): boolean {
  return OFFICE_EXTENSIONS.test(file.name.toLowerCase()) || OFFICE_MIME.test(file.type);
}

/** The error for a file that is none of the formats: its own for an office file, which has a way forward. */
export function unsupportedError(file: File): Error {
  return isOfficeFile(file) ? new OfficeFileError() : new UnsupportedFileError();
}

/** `kind` is detectKind's answer for the file. */
export async function loadDocument(file: File, kind: FileKind | null): Promise<SourceDocument> {
  if (kind === 'pdf') return loadPdf(file);
  if (kind === 'heic') return fromBitmap(await decodeHeic(file));
  if (kind === 'png' || kind === 'jpg') return loadImage(file);
  throw unsupportedError(file);
}

// Safari decodes HEIC itself, and iPhones, where most HEIC files come from,
// mostly use it: no decoder to download there. Elsewhere heic-to (about 730 KB
// gzipped) is imported only when a HEIC file actually arrives, and decodes
// straight to a bitmap.
async function decodeHeic(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    // not a browser that reads HEIC
  }
  // Outside the try: a decoder that fails to load (offline, or a deploy since
  // the page opened) is PA-100, worth a retry, not a damaged photo.
  // The csp build: the default one compiles code from strings, which the page's Content-Security-Policy refuses.
  const { heicTo } = await import('heic-to/csp');
  try {
    return await heicTo({ blob: file, type: 'bitmap' });
  } catch (err) {
    throw new HeicDecodeError(err instanceof Error ? err.message : String(err));
  }
}

async function loadPdf(file: File): Promise<SourceDocument> {
  const { pdfjsLib, worker } = await getPdfWorker();
  const data = await file.arrayBuffer();
  const assets = `${import.meta.env.BASE_URL}${__PDFJS_PATH__}`;
  const task = pdfjsLib.getDocument({
    data,
    worker,
    // Fetched only when a page needs them: the decoders for scanned images
    // (JBIG2, CCITT, JPEG 2000), CMaps for CJK text, the 14 standard fonts.
    wasmUrl: `${assets}wasm/`,
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    iccUrl: `${assets}iccs/`,
  });
  let pdf: Awaited<typeof task.promise>;
  try {
    pdf = await task.promise;
  } catch (err) {
    // A load that fails (a password, a damaged file) still holds what the worker parsed
    // until its task is destroyed, and nothing else holds the task.
    void task.destroy().catch(() => undefined);
    // The worker itself gone: the next file starts a fresh one instead of failing too.
    if (worker.destroyed) pdfWorker = null;
    throw err;
  }
  if (pdf.numPages === 0) {
    void task.destroy().catch(() => undefined);
    throw new EmptyPdfError();
  }
  return {
    pageCount: pdf.numPages,
    async renderPage(index: number): Promise<RenderedPage> {
      const page = await pdf.getPage(index + 1);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: fitScale(natural.width, natural.height, RENDER_DPI / 72) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = get2d(canvas, { willReadFrequently: true });
      // PDF pages may not paint their own background; force paper white.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } finally {
        // The canvas holds the result; drop pdf.js's operator list and decoded images.
        page.cleanup();
      }
      return { canvas, sizePt: { width: natural.width, height: natural.height } };
    },
    destroy: () => void task.destroy().catch(() => undefined),
  };
}

async function loadImage(file: Blob): Promise<SourceDocument> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new ImageDecodeError(err instanceof Error ? err.message : String(err));
  }
  return fromBitmap(bitmap);
}

/** One page: the bitmap on paper white, within MAX_DIM. Closes the bitmap. */
function fromBitmap(bitmap: ImageBitmap): SourceDocument {
  const scale = fitScale(bitmap.width, bitmap.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = get2d(canvas, { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return {
    pageCount: 1,
    renderPage: () => Promise.resolve({ canvas, sizePt: null }),
    destroy: () => undefined,
  };
}
