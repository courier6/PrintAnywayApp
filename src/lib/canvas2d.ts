import { CanvasUnavailableError } from './errors';

/**
 * The canvas's 2D context. A browser hands out null when it cannot back the canvas (too large, or
 * out of memory): that is reported as PA-106 rather than as an unknown failure.
 */
export function get2d(canvas: HTMLCanvasElement, options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', options);
  if (!ctx) throw new CanvasUnavailableError();
  return ctx;
}
