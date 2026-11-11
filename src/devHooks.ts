// Dev only: the app's back doors for development and the test harness. App.tsx calls useDevHooks behind
// import.meta.env.DEV, a build-time constant, so a build drops the call and with it this whole module;
// vite.config.ts's prntrGuard fails the build if one of the marker strings below reaches the output.
import { useEffect, useRef } from 'react';
import type { AppState } from './App';
import type { PrntrPage } from './usePrntrSession';

export interface DevApi {
  appState: AppState;
  /** The chosen ink, read when a hook runs. */
  inkHex: () => string;
  enterPrntr: (stage: number, page?: PrntrPage) => void;
  /** Makes `page` the open document, one page long, named stand-in.pdf. */
  loadStandIn: (page: HTMLCanvasElement) => void;
}

/** A letter-size page of "text" lines, black for the source, the ink for the recolored copy. */
function devStandIn(ink: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 612;
  canvas.height = 792;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 612, 792);
  g.fillStyle = ink;
  g.fillRect(72, 80, 300, 28);
  for (let y = 140; y < 700; y += 24) g.fillRect(72, y, 300 + ((y * 7) % 170), 10);
  return canvas;
}

export function useDevHooks(api: DevApi): void {
  // The entrance: ?prntr=N opens Prntr at stage N as soon as the app loads, with a stand-in page so
  // nothing has to be uploaded first. Once per page load, so leaving Prntr lands on the empty app.
  const skipUsed = useRef(false);
  useEffect(() => {
    if (api.appState !== 'empty' || skipUsed.current) return;
    const raw = new URLSearchParams(location.search).get('prntr');
    if (raw === null) return;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) return;
    skipUsed.current = true;
    console.info('prntr-dev-skip', n);
    api.enterPrntr(n, { source: devStandIn('#000000'), recolored: devStandIn(api.inkHex()) });
  }, [api.appState]);

  // The dev panel's hooks (src/components/DevPanel.tsx). loadStandIn makes the stand-in a real one-page
  // document, so a won room has an original for the vortex to bring back; enter needs that document
  // (appState 'preview'). Bound again every render so they never see stale state.
  useEffect(() => {
    (window as unknown as { __prntrApp?: unknown }).__prntrApp = {
      appState: () => api.appState,
      loadStandIn: () => api.loadStandIn(devStandIn('#000000')),
      enter: (stage: number) => api.enterPrntr(stage),
    };
  });
  useEffect(() => {
    console.info('prntr-dev-app');
    return () => {
      delete (window as unknown as { __prntrApp?: unknown }).__prntrApp;
    };
  }, []);
}
