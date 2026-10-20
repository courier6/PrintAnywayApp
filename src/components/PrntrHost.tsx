import { Component, Suspense, lazy, type ReactNode } from 'react';

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

export interface PrntrHostProps {
  source: HTMLCanvasElement;
  recolored: HTMLCanvasElement;
  inkHex: string;
  stage: number;
  audioContext: AudioContext | null;
  onExit: () => void;
  /** The chain finished (stage 1 cleared). */
  onDone: () => void;
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
