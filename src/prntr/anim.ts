/** The game's motion setting: everything moves (`full`), or the cuts and still frames of the reduced mode (`reduced`). */
export type Motion = 'full' | 'reduced';

let motion: Motion | null = null;

/**
 * The game's motion setting, read once per page load from the URL: `?motion=reduced` turns the reduced mode on,
 * anything else (and no parameter) is the full game. The operating system's `prefers-reduced-motion` flag is not
 * consulted (PRNTR-BROWSERS.md §3): Windows machines commonly report it without anyone having chosen it, and the game is
 * opened on purpose and is nothing but motion. The app around the game keeps honouring the flag for its own UI.
 */
export function prntrMotion(): Motion {
  if (motion === null) motion = new URLSearchParams(window.location.search).get('motion') === 'reduced' ? 'reduced' : 'full';
  return motion;
}

/** True in the reduced mode (`prntrMotion() === 'reduced'`): the stages' cuts and still frames. */
export function reducedMotion(): boolean {
  return prntrMotion() === 'reduced';
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
 * draw(1) unless aborted. In the reduced mode it draws t = 1 at once.
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

/**
 * Resolves on the next pointer press on `target` or key press anywhere, except
 * Escape, which is Prntr's exit and must not count as "continue".
 */
export function nextInput(target: HTMLElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') done();
    };
    const done = () => {
      target.removeEventListener('pointerdown', done);
      window.removeEventListener('keydown', onKey);
      signal.removeEventListener('abort', done);
      resolve();
    };
    target.addEventListener('pointerdown', done);
    window.addEventListener('keydown', onKey);
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
