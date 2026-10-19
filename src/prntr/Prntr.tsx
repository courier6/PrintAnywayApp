import { useEffect, useRef, useState } from 'react';
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
  onExit: () => void;
}

export default function Prntr({ source, recolored, inkHex, stage, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [caption, setCaption] = useState('');
  const [finished, setFinished] = useState(false);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExitRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const page = capturePage(source, recolored);
    // The CSS fixes the width (≤ 380px) and the aspect ratio; the backing store
    // follows devicePixelRatio and stays at this size for the whole run.
    const width = canvas.clientWidth;
    const height = Math.round((width * page.height) / page.width);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d');
    if (!g) throw new Error('prntr: no 2d context');
    g.scale(dpr, dpr);
    const controller = new AbortController();
    const ctx: StageContext = {
      canvas,
      g,
      width,
      height,
      page,
      inkHex,
      signal: controller.signal,
      setCaption,
      toLocal(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        return { x: ((clientX - r.left) / r.width) * width, y: ((clientY - r.top) / r.height) * height };
      },
    };
    const startAt = Math.min(Math.max(0, stage), STAGES.length - 1);
    void runChain(ctx, STAGES, startAt).then((result) => {
      if (result === 'finished') setFinished(true);
    });
    return () => controller.abort();
  }, [source, recolored, inkHex, stage]);

  return (
    <div className="prntr">
      <button className="prntr-exit" aria-label="Leave" onClick={onExit}>
        ✕
      </button>
      <canvas
        ref={canvasRef}
        className="prntr-canvas"
        style={{ aspectRatio: `${recolored.width} / ${recolored.height}` }}
      />
      <span className="prntr-caption" aria-live="polite">
        {caption}
      </span>
      {finished && (
        <div className="prntr-end">
          <p>That's all for now.</p>
          <button className="btn-secondary" onClick={onExit}>
            Back to your page
          </button>
        </div>
      )}
    </div>
  );
}
