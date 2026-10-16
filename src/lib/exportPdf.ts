const PAGE_WIDTH_PT = 612; // US Letter width; height follows each page's aspect

/** Build a PDF from the recolored page canvases and trigger a download. */
export async function exportRecoloredPdf(
  canvases: HTMLCanvasElement[],
  sourceName: string,
): Promise<void> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  for (const canvas of canvases) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const bytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
    const image = await doc.embedJpg(bytes);
    const height = PAGE_WIDTH_PT * (canvas.height / canvas.width);
    const page = doc.addPage([PAGE_WIDTH_PT, height]);
    page.drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH_PT, height });
  }
  const pdfBytes = await doc.save();
  // Copy into a fresh ArrayBuffer-backed view: pdf-lib types its output as
  // Uint8Array<ArrayBufferLike>, which BlobPart no longer accepts.
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sourceName.replace(/\.[^.]+$/, '') + '-recolored.pdf';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
