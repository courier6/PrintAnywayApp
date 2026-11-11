import { Component, Suspense, lazy, useState, type CSSProperties, type ReactNode } from 'react';
import type { BoardRun } from '../prntr/PrntrBoard';
import type { Certificate } from '../prntr/types';

type PrntrModule = typeof import('../prntr/Prntr');
/** The chunk once it is in (the trigger's prefetch, or an earlier run): rendered directly, not through lazy. */
let loaded: PrntrModule | null = null;
const loadPrntr = () =>
  import('../prntr/Prntr').then((m) => {
    loaded = m;
    return m;
  });
const Prntr = lazy(loadPrntr);

/** What shows while the chunk is still loading: Prntr's black, over the app, so the click never shows the app
 * emptied to white. React reveals a suspended boundary's content no sooner than 300 ms after its fallback. */
const LOADING: CSSProperties = { position: 'fixed', inset: 0, zIndex: 100, background: '#000000' };

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

/** The board over the app after a run (PRNTR-BOARD.md §15.2), from the Prntr chunk, loaded already by then. */
const PrntrBoard = lazy(() => loadPrntr().then((m) => ({ default: m.PrntrBoard })));

export interface PrntrHostProps {
  source: HTMLCanvasElement;
  recolored: HTMLCanvasElement;
  inkHex: string;
  stage: number;
  audioContext: AudioContext | null;
  onExit: () => void;
  /** The chain finished: the room was cleared (with the certificate to load as the page), or it was a game over. */
  onDone: (outcome: 'cleared' | 'over', certificate: Certificate | undefined, run: BoardRun) => void;
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
  // Chosen once per mount: switching from the lazy component to the loaded one would remount the run.
  const [Loaded] = useState(() => loaded?.default ?? null);
  return (
    <PrntrBoundary onExit={props.onExit}>
      {Loaded ? (
        <Loaded {...props} />
      ) : (
        <Suspense fallback={<div style={LOADING} />}>
          <Prntr {...props} />
        </Suspense>
      )}
    </PrntrBoundary>
  );
}

export interface PrntrBoardHostProps {
  run: BoardRun;
  inkHex: string;
  onClose: () => void;
}

/** The board over the app; if it breaks, it is simply gone. */
export function PrntrBoardHost(props: PrntrBoardHostProps) {
  return (
    <PrntrBoundary onExit={props.onClose}>
      <Suspense fallback={null}>
        <PrntrBoard {...props} />
      </Suspense>
    </PrntrBoundary>
  );
}
