import { useEffect, useRef } from 'react';
import type { VortexPainter } from '../prntr/vortex';
import { loadVortex } from './PrntrHost';

/** Held this long on the certificate, the vortex swallows it and the original comes back. */
export const VORTEX_MS = 700;
/** Let go early: the galaxy thins back out over this… */
export const THIN_MS = 160;
/** …while a puff of smoke drifts up for this long, from the release. */
export const PUFF_MS = 1000;

interface Props {
  /** The certificate as shown (recoloured): the page the vortex pulls in. */
  certificate: HTMLCanvasElement;
  /** When the hold began, and when it was let go early (performance.now()). */
  startedAt: number;
  releasedAt: number | null;
  /** The thin-out after an early release is over: the page's own layer shows the certificate again. */
  thinned: boolean;
}

/**
 * The vortex over the page stack (PRNTR-VORTEX.md): a canvas painted every frame by the Prntr
 * chunk's painter from the hold's clock. Mounted for the swirl, kept through the thin-out and the
 * puff, remounted (keyed) by every new hold.
 */
export function VortexCanvas({ certificate, startedAt, releasedAt, thinned }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const painter = useRef<VortexPainter | null>(null);
  const state = useRef({ releasedAt, thinned });
  state.current = { releasedAt, thinned };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let gone = false;
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const vx = painter.current;
      if (!vx) return;
      const { releasedAt, thinned } = state.current;
      // p while held, or where the swirl was when let go
      const held = Math.min(1, ((releasedAt ?? now) - startedAt) / VORTEX_MS);
      if (releasedAt === null) {
        vx.frame(held, null, true);
        return;
      }
      const back = Math.min(1, (now - releasedAt) / THIN_MS);
      vx.frame(held * (1 - back), Math.min(1, (now - releasedAt) / PUFF_MS), !thinned);
    };
    void loadVortex().then(
      (create) => {
        if (!gone) painter.current = create(certificate, canvas, VORTEX_MS);
      },
      () => undefined, // the chunk failed to load: the hold still restores on its timer
    );
    raf = requestAnimationFrame(draw);
    return () => {
      gone = true;
      cancelAnimationFrame(raf);
    };
  }, [certificate, startedAt]);

  return <canvas ref={ref} className={'vortex' + (releasedAt !== null ? ' vortex-puff' : '')} aria-hidden="true" />;
}
