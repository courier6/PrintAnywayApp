import { useEffect, useRef, useState } from 'react';
import './prntr.css';
import { createPrntrAudio } from './audio';
import { capturePage } from './page';
import { runChain } from './runner';
import { STAGES } from './stages';
import type { StageContext } from './types';

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
   * The chain finished (the room was cleared): `prntr:done` with reason complete.
   * The host drops its UI over the last frame, then unmounts Prntr.
   */
  onDone: () => void;
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
    const ctx: StageContext = {
      root,
      page: capturePage(source, recolored),
      inkHex,
      audio: createPrntrAudio(audioContext),
      fontsReady,
      signal: controller.signal,
      announce: setLive,
    };
    const startAt = Math.min(Math.max(0, stage), STAGES.length - 1);
    // After the last stage the frame stays painted: the host drops its UI over it
    // and unmounts us (PRNTR-STAGE-1.md §4.10).
    void runChain(ctx, STAGES, startAt).then((result) => {
      if (result !== 'finished') return;
      setDone(true);
      onDoneRef.current();
    });
    return () => {
      controller.abort();
      root.remove();
      document.body.style.overflow = prevOverflow;
    };
  }, [source, recolored, inkHex, stage, audioContext]);

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
