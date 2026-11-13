import { Component, Suspense, lazy, useState, type CSSProperties, type ReactNode } from 'react';
import { whenIdle } from '../prntr/anim';
import type { BoardRun } from '../prntr/PrntrBoard';
import type { Certificate } from '../prntr/types';
import { warmPrntrAudio } from './prntrAudio';

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
 * Then, in idle moments, the sound: the audio context is made and the opening's cues are rendered one at a
 * time, which the click that opens Prntr would otherwise do in its own frame (some 200 ms before anything
 * shows). A click that comes first finds whatever is missing and makes it, as before.
 * Last, what a GPU builds the first time it is asked for it, each in a moment of its own: the storm's kinds of
 * drawing, the ripple's program, the wall print. Without them a first visit pays for each in the frame that first
 * shows it.
 */
export function prefetchPrntr(): void {
  void loadPrntr()
    .then((m) =>
      Promise.all([
        document.fonts.load('700 220px "Comic Neue"'),
        document.fonts.load('16px "Press Start 2P"'),
      ]).then(() => m),
    )
    .then((m) => {
      whenIdle(() => {
        const looks = () => {
          m.warmStorm(Math.min(220, 0.27 * window.innerWidth, 56 * m.frameScale(window.innerWidth, window.innerHeight)));
          whenIdle(() => {
            m.warmRipple();
            whenIdle(() => void m.warmPrint());
          });
        };
        const rate = warmPrntrAudio();
        // no context yet (no gesture the browser can vouch for, or no Web Audio): the click makes the sound, as before
        if (rate === null) return whenIdle(looks);
        const next = () => whenIdle(m.warmCue(rate) ? next : looks);
        whenIdle(next);
      });
    })
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
