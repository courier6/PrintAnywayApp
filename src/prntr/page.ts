import type { PageBitmaps } from './types';

const MAX_SIDE = 960;

/** Copies both store canvases, downscaled so the long side is at most MAX_SIDE. */
export function capturePage(source: HTMLCanvasElement, recolored: HTMLCanvasElement): PageBitmaps {
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const copy = (from: HTMLCanvasElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('prntr: no 2d context');
    g.drawImage(from, 0, 0, width, height);
    return canvas;
  };
  return { source: copy(source), recolored: copy(recolored), width, height };
}
