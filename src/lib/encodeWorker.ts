// The encoder behind canvasBlob: a page's pixels in as an ImageBitmap, its PNG or JPEG out as a Blob, on this
// worker's thread. The project compiles against the DOM lib only, so the worker's global is reached through
// `self` with just the shape used here.
import type { EncodeReply, EncodeRequest } from './canvasBlob';

const scope = self as unknown as { postMessage(reply: EncodeReply): void };

addEventListener('message', async (e: MessageEvent<EncodeRequest>) => {
  const { id, bitmap, type, quality } = e.data;
  let blob: Blob | null = null;
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('bitmaprenderer');
    if (!ctx) throw new Error('no bitmaprenderer context');
    ctx.transferFromImageBitmap(bitmap);
    blob = await canvas.convertToBlob({ type, quality });
  } catch {
    // null tells the caller to encode on its own thread
  }
  scope.postMessage({ id, blob });
});
