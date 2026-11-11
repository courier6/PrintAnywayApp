import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from '../../prntr/anim';
import { PUFF_MS, THIN_MS, VORTEX_MS } from '../VortexCanvas';

export interface Vortex {
  key: number;
  startedAt: number;
  releasedAt: number | null;
  thinned: boolean;
}

/**
 * The vortex (PRNTR-VORTEX.md): a hold on the certificate starts the swirl; VORTEX_MS later the
 * original is back (onVortexDone). Let go before that, the swirl thins out (THIN_MS) while the
 * puff plays (PUFF_MS). `originalPage` is null when there is nothing to bring back.
 */
export function useVortex(holding: boolean, originalPage: HTMLCanvasElement | null, onVortexDone: () => void) {
  // The ref mirrors the state for the effect and the timers.
  const [vortex, setVortexState] = useState<Vortex | null>(null);
  const vortexRef = useRef<Vortex | null>(null);
  const timers = useRef<number[]>([]);
  const onVortexDoneRef = useRef(onVortexDone);
  onVortexDoneRef.current = onVortexDone;
  const setVortex = (v: Vortex | null) => {
    vortexRef.current = v;
    setVortexState(v);
  };
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    if (!originalPage) {
      // the original is back (or there never was one): nothing to swirl
      if (vortexRef.current) {
        clearTimers();
        setVortex(null);
      }
      return;
    }
    if (holding) {
      if (reducedMotion()) {
        onVortexDoneRef.current();
        return;
      }
      clearTimers();
      setVortex({ key: (vortexRef.current?.key ?? 0) + 1, startedAt: performance.now(), releasedAt: null, thinned: false });
      timers.current = [
        window.setTimeout(() => {
          setVortex(null);
          onVortexDoneRef.current();
        }, VORTEX_MS),
      ];
    } else if (vortexRef.current && vortexRef.current.releasedAt === null) {
      clearTimers();
      setVortex({ ...vortexRef.current, releasedAt: performance.now() });
      timers.current = [
        window.setTimeout(() => {
          if (vortexRef.current) setVortex({ ...vortexRef.current, thinned: true });
        }, THIN_MS),
        window.setTimeout(() => setVortex(null), PUFF_MS),
      ];
    }
  }, [holding, originalPage]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  /** Swirling: the hold is on and the certificate is being swallowed. */
  return { vortex, swirling: vortex !== null && vortex.releasedAt === null };
}
