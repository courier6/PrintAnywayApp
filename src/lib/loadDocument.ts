import { HeicDecodeError, ImageDecodeError, UnsupportedFileError } from './errors';

// pdfjs is loaded on demand so the landing screen doesn't pay for it.
async function getPdfjs() {
  const [pdfjsLib, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjsLib;
}

// ~150 DPI: readable in print, fast enough for per-pixel recoloring.
const RENDER_DPI = 150;
const MAX_IMAGE_DIM = 3500;

export interface SourceDocument {
  pageCount: number;
  renderPage(index: number): Promise<HTMLCanvasElement>;
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
  const pdfjsLib = await getPdfjs();
  const data = await file.arrayBuffer();
  const assets = `${import.meta.env.BASE_URL}${__PDFJS_PATH__}`;
  const pdf = await pdfjsLib.getDocument({
    data,
    // Fetched only when a page needs them: the decoders for scanned images
    // (JBIG2, CCITT, JPEG 2000), CMaps for CJK text, the 14 standard fonts.
    wasmUrl: `${assets}wasm/`,
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    iccUrl: `${assets}iccs/`,
  }).promise;
  return {
    pageCount: pdf.numPages,
    async renderPage(index: number): Promise<HTMLCanvasElement> {
      const page = await pdf.getPage(index + 1);
      const viewport = page.getViewport({ scale: RENDER_DPI / 72 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas 2D context unavailable');
      // PDF pages may not paint their own background; force paper white.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      return canvas;
    },
  };
}

async function loadImage(file: Blob): Promise<SourceDocument> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new ImageDecodeError(err instanceof Error ? err.message : String(err));
  }
  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height));
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
  };
}
