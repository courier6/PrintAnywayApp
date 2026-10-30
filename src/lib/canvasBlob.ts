/**
 * A canvas encoded as PNG or JPEG, off the main thread.
 *
 * canvas.toBlob encodes in the browser's idle time, and Chromium finds none while a focused button is busy
 * (its attributes changed under the focus, as Print's and Download's are), so every page then waits out the
 * encoder's one-second fallback: a 40-page download took 41 s instead of half a second. The pixels go to a
 * worker as an ImageBitmap and come back as a Blob from OffscreenCanvas.convertToBlob, which runs on the
 * worker's own thread at once. Where a worker can't draw (no OffscreenCanvas: Safari before 16.4), or the
 * worker fails, toBlob on this thread.
 */

export type ImageType = 'image/png' | 'image/jpeg';
/** JPEG at quality 0.92; PNG is lossless. */
const JPEG_QUALITY = 0.92;

export interface EncodeRequest {
  id: number;
  bitmap: ImageBitmap;
  type: ImageType;
  quality: number | undefined;
}
export interface EncodeReply {
  id: number;
  /** null when the worker could not encode: the caller encodes on its own thread. */
  blob: Blob | null;
}

const CAN_WORK =
  typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function';

let worker: Worker | null = null;
let nextId = 0;
const waiting = new Map<number, { resolve: (blob: Blob) => void; reject: (err: Error) => void }>();

function encoder(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./encodeWorker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<EncodeReply>) => {
    const call = waiting.get(e.data.id);
    if (!call) return;
    waiting.delete(e.data.id);
    if (e.data.blob) call.resolve(e.data.blob);
    else call.reject(new Error('convertToBlob failed in the encode worker'));
  };
  w.onerror = () => {
    // The worker is gone (its script would not load, or it threw): everyone waiting falls back to this
    // thread, and the next call starts a fresh one.
    for (const call of waiting.values()) call.reject(new Error('the encode worker failed'));
    waiting.clear();
    w.terminate();
    if (worker === w) worker = null;
  };
  worker = w;
  return w;
}

export async function canvasBlob(canvas: HTMLCanvasElement, type: ImageType): Promise<Blob> {
  const quality = type === 'image/jpeg' ? JPEG_QUALITY : undefined;
  if (CAN_WORK) {
    try {
      const bitmap = await createImageBitmap(canvas);
      return await new Promise<Blob>((resolve, reject) => {
        const id = ++nextId;
        waiting.set(id, { resolve, reject });
        encoder().postMessage({ id, bitmap, type, quality } satisfies EncodeRequest, [bitmap]);
      });
    } catch {
      // encoded on this thread instead
    }
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), type, quality),
  );
}
