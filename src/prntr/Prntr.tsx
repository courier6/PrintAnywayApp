import { useEffect, useRef, useState } from 'react';
import './prntr.css';
import { keepPrntrAudio, releasePrntrAudio } from '../components/prntrAudio';
import { createPrntrAudio, type PrntrAudio } from './audio';
import { makeCertificate } from './certificate';
import { capturePage } from './page';
import { runChain } from './runner';
import { STAGES } from './stages';
import type { Certificate, StageContext } from './types';

/** After a finished run, how long its last sounds (the fanfare, the game-over sting) may play on. */
const FINISHED_TAIL_MS = 4000;
/** Esc or ✕: the fade that silences what the run still had playing or scheduled. */
const CUT_FADE_S = 0.05;

/**
 * Silences one run: everything it plays goes through its own master gain, so fading
 * that out and disconnecting it stops all of it, cues already scheduled included.
 */
function releaseRunAudio({ context, master }: PrntrAudio, finished: boolean): void {
  releasePrntrAudio(finished ? FINISHED_TAIL_MS + 500 : 500);
  if (!context || !master) return;
  const at = context.currentTime + (finished ? FINISHED_TAIL_MS / 1000 : 0);
  master.gain.cancelScheduledValues(at);
  master.gain.setTargetAtTime(0, at, CUT_FADE_S / 3);
  window.setTimeout(() => master.disconnect(), (at - context.currentTime + CUT_FADE_S * 4) * 1000);
}

interface Props {
  source: HTMLCanvasElement;
  recolored: HTMLCanvasElement;
  inkHex: string;
  /** Stage to start at; clamped to the last existing stage. */
  stage: number;
  /** Created by the host inside the user's gesture when there is one; null without Web Audio. */
  audioContext: AudioContext | null;
  /** Esc or ✕: the host cuts straight back. */
  onExit: () => void;
  /**
   * The chain finished: `prntr:done` with reason complete. `cleared` is the room won
   * (the sky drop, with the certificate of completion as the page the app comes back
   * to), `over` a game over (the Tetris drop). Either way the host
   * drops its UI over the last frame, then unmounts Prntr.
   */
  onDone: (outcome: 'cleared' | 'over', certificate?: Certificate) => void;
}

export default function Prntr({ source, recolored, inkHex, stage, audioContext, onExit, onDone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState('');
  const [done, setDone] = useState(false);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  // Read once when a run starts: the host changes them during the drop (the certificate
  // comes up in gold), and a change must not restart the chain under it.
  const startRef = useRef({ source, recolored, inkHex });
  startRef.current = { source, recolored, inkHex };

  // Esc leaves from any stage. Added on mount, removed on unmount: nothing leaks
  // into the host app after Prntr closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExitRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    // Each run builds in its own element: a cancelled run (exit, or React
    // StrictMode's mount–unmount–mount in dev) may still finish its last lines
    // after the abort, and must only ever touch its own, already detached, root.
    const root = document.createElement('div');
    root.className = 'prntr-run';
    stageEl.append(root);
    rootRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controller = new AbortController();
    keepPrntrAudio();
    let finished = false;
    // Without a gesture before Prntr opened (the dev entrance), the browser keeps
    // the context suspended: unlock it on the first press so later cues play.
    if (audioContext?.state === 'suspended') {
      const unlock = () => void audioContext.resume().catch(() => undefined);
      window.addEventListener('pointerdown', unlock, { once: true, signal: controller.signal });
      window.addEventListener('keydown', unlock, { once: true, signal: controller.signal });
    }
    // Start the webfonts now; stage 0 holds its card until they are in.
    const fontsReady = Promise.all([
      document.fonts.load('700 220px "Comic Neue"'),
      document.fonts.load('16px "Press Start 2P"'),
    ]).then(
      () => undefined,
      () => undefined,
    );
    const start = startRef.current;
    const audio = createPrntrAudio(audioContext);
    const ctx: StageContext = {
      root,
      page: capturePage(start.source, start.recolored),
      inkHex: start.inkHex,
      audio,
      fontsReady,
      signal: controller.signal,
      announce: setLive,
    };
    const startAt = Math.min(Math.max(0, stage), STAGES.length - 1);
    // After the last stage the frame stays painted: the host drops its UI over it
    // and unmounts us (PRNTR-STAGE-1.md §4.10).
    runChain(ctx, STAGES, startAt)
      .then((handoff) => {
        if (!handoff) return;
        finished = true;
        // Made before ✕ goes: if it throws, the way out must still be there.
        const certificate = handoff.kind === 'cleared' ? makeCertificate(handoff.player, handoff.score, 1337) : undefined;
        setDone(true);
        if (certificate) onDoneRef.current('cleared', certificate);
        else onDoneRef.current('over');
      })
      // A stage that throws (no 2D context on a phone short of memory, a bug) would
      // leave a black screen, and on a phone there is no Esc: leave as ✕ would.
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error('[prntr]', err);
        onExitRef.current();
      });
    return () => {
      controller.abort();
      releaseRunAudio(audio, finished);
      root.remove();
      document.body.style.overflow = prevOverflow;
    };
  }, [stage, audioContext]);

  return (
    <div className="prntr" ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Prntr">
      <div className="prntr-stage" ref={stageRef} />
      {/* Provisional: the exit's place is not designed (handoff §5.2). Gone once the chain has finished. */}
      {!done && (
        <button className="prntr-exit" aria-label="Leave" onClick={onExit}>
          ✕
        </button>
      )}
      <span className="prntr-live" aria-live="polite">
        {live}
      </span>
    </div>
  );
}
