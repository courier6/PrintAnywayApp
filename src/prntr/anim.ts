export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Resolves after `ms`, or at once when `signal` aborts. */
export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const id = window.setTimeout(done, ms);
    function done() {
      signal.removeEventListener('abort', done);
      window.clearTimeout(id);
      resolve();
    }
    signal.addEventListener('abort', done);
  });
}

/**
 * Calls draw(t) once per frame for `ms`, t going 0 → 1, always ending with
 * draw(1) unless aborted. Under prefers-reduced-motion it draws t = 1 at once.
 */
export function frames(ms: number, signal: AbortSignal, draw: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    if (reducedMotion()) {
      draw(1);
      return resolve();
    }
    const start = performance.now();
    let raf = 0;
    const abort = () => {
      cancelAnimationFrame(raf);
      resolve();
    };
    signal.addEventListener('abort', abort, { once: true });
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      draw(t);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        signal.removeEventListener('abort', abort);
        resolve();
      }
    };
    raf = requestAnimationFrame(tick);
  });
}

/** Resolves on the next pointer press on the canvas or key press anywhere. */
export function nextInput(canvas: HTMLCanvasElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      canvas.removeEventListener('pointerdown', done);
      window.removeEventListener('keydown', done);
      signal.removeEventListener('abort', done);
      resolve();
    };
    canvas.addEventListener('pointerdown', done);
    window.addEventListener('keydown', done);
    signal.addEventListener('abort', done);
  });
}

/** A controller that aborts when `parent` aborts; abort it yourself to cut short. */
export function linked(parent: AbortSignal): AbortController {
  const child = new AbortController();
  if (parent.aborted) child.abort();
  else parent.addEventListener('abort', () => child.abort(), { once: true });
  return child;
}
