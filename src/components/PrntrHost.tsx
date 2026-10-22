import { Component, Suspense, lazy, type ReactNode } from 'react';
import type { Certificate } from '../prntr/types';

const loadPrntr = () => import('../prntr/Prntr');
const Prntr = lazy(loadPrntr);

/**
 * Warms the Prntr chunk (JS + CSS + @font-face) and its two fonts, so the opening
 * starts at once when the trigger is clicked. Called when the "Other" help item
 * opens. Failures are ignored: the real import retries on entry.
 */
export function prefetchPrntr(): void {
  void loadPrntr()
    .then(() =>
      Promise.all([
        document.fonts.load('700 220px "Comic Neue"'),
        document.fonts.load('16px "Press Start 2P"'),
      ]),
    )
    .catch(() => undefined);
}

/**
 * The vortex painter (PRNTR-VORTEX.md), from the Prntr chunk: by the time there is a certificate
 * to hold on, the chunk is loaded, so this resolves at once.
 */
export const loadVortex = () => loadPrntr().then((m) => m.createVortex);

export interface PrntrHostProps {
  source: HTMLCanvasElement;
  recolored: HTMLCanvasElement;
  inkHex: string;
  stage: number;
  audioContext: AudioContext | null;
  onExit: () => void;
  /** The chain finished: the room was cleared (with the certificate to load as the page), or it was a game over. */
  onDone: (outcome: 'cleared' | 'over', certificate?: Certificate) => void;
}

/** Whatever breaks inside Prntr, the user lands back on the preview. */
class PrntrBoundary extends Component<{ onExit: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error('[prntr]', err);
    this.props.onExit();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function PrntrHost(props: PrntrHostProps) {
  return (
    <PrntrBoundary onExit={props.onExit}>
      <Suspense fallback={null}>
        <Prntr {...props} />
      </Suspense>
    </PrntrBoundary>
  );
}
