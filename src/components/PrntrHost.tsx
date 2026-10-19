import { Component, Suspense, lazy, type ReactNode } from 'react';

const Prntr = lazy(() => import('../prntr/Prntr'));

export interface PrntrHostProps {
  source: HTMLCanvasElement;
  recolored: HTMLCanvasElement;
  inkHex: string;
  stage: number;
  audioContext: AudioContext | null;
  onExit: () => void;
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
