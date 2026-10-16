import type { FileKind } from './loadDocument';

const PAGE_WIDTH_PT = 612; // US Letter width; height follows each page's aspect

/** What a download is saved as: PDFs stay PDFs, photos stay photos. */
export type ExportFormat = 'pdf' | 'png' | 'jpg';

/** HEIC downloads as JPG: browsers can't encode HEIC. */
export function exportFormat(kind: FileKind): ExportFormat {
  return kind === 'heic' ? 'jpg' : kind;
}

/** Saves the recolored pages as `format` and triggers a download. */
export async function exportRecolored(
  canvases: HTMLCanvasElement[],
  sourceName: string,
  format: ExportFormat,
): Promise<void> {
  const blob =
    format === 'pdf'
      ? await buildPdf(canvases)
      : await canvasBlob(canvases[0], format === 'png' ? 'image/png' : 'image/jpeg');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sourceName.replace(/\.[^.]+$/, '')}-recolored.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** One PDF page per canvas, each US Letter wide. */
async function buildPdf(canvases: HTMLCanvasElement[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  for (const canvas of canvases) {
    const bytes = await (await canvasBlob(canvas, 'image/jpeg')).arrayBuffer();
    const image = await doc.embedJpg(bytes);
    const height = PAGE_WIDTH_PT * (canvas.height / canvas.width);
    const page = doc.addPage([PAGE_WIDTH_PT, height]);
    page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH_PT, height });
  }
  const pdfBytes = await doc.save();
  // Copy into a fresh ArrayBuffer-backed view: pdf-lib types its output as
  // Uint8Array<ArrayBufferLike>, which BlobPart no longer accepts.
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/** JPEG at quality 0.92; PNG is lossless. */
function canvasBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg'): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), type, 0.92),
  );
}
