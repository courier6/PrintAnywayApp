import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { INKS } from '../lib/inks';
import { PRINTER_TIPS } from '../lib/printerTips';
import { PageCanvas } from './PageCanvas';
import { PrintReminder } from './PrintReminder';

interface Props {
  fileName: string;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  inkIndex: number;
  onSelectInk: (index: number) => void;
  onChooseFile: () => void;
  sourceCanvas: HTMLCanvasElement | null;
  recoloredCanvas: HTMLCanvasElement | null;
  holding: boolean;
  onHoldChange: (holding: boolean) => void;
  onPrint: () => void;
  onDownload: () => void;
  busy: 'print' | 'download' | null;
  showReminder: boolean;
  onDismissReminder: () => void;
}

export function PreviewState({
  fileName,
  pageCount,
  currentPage,
  onPageChange,
  inkIndex,
  onSelectInk,
  onChooseFile,
  sourceCanvas,
  recoloredCanvas,
  holding,
  onHoldChange,
  onPrint,
  onDownload,
  busy,
  showReminder,
  onDismissReminder,
}: Props) {
  const pageReady = recoloredCanvas !== null;
  const inkHex = INKS[inkIndex].hex;

  // Transient confirmation after a swatch click; flashKey restarts the
  // glow animation even when clicks come in quick succession.
  const [justInked, setJustInked] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const inkTimer = useRef<number | null>(null);
  const prevInk = useRef(inkIndex);

  // Delayed nudge toward Download PDF: starts after the page flash and
  // caption have settled so it reads as a second, quieter cue.
  const [downloadHint, setDownloadHint] = useState(false);
  const hintTimers = useRef<number[]>([]);

  useEffect(() => {
    if (prevInk.current === inkIndex) return;
    prevInk.current = inkIndex;
    setFlashKey((k) => k + 1);
    setJustInked(true);
    if (inkTimer.current !== null) window.clearTimeout(inkTimer.current);
    inkTimer.current = window.setTimeout(() => setJustInked(false), 2000);
    setDownloadHint(false);
    hintTimers.current.forEach((t) => window.clearTimeout(t));
    hintTimers.current = [
      window.setTimeout(() => setDownloadHint(true), 1600),
      window.setTimeout(() => setDownloadHint(false), 1600 + 3600),
    ];
  }, [inkIndex]);

  useEffect(() => {
    return () => {
      if (inkTimer.current !== null) window.clearTimeout(inkTimer.current);
      hintTimers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  function holdKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      onHoldChange(true);
    }
  }

  function holdKeyUp(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') onHoldChange(false);
  }

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-file">
          <span className="file-chip">
            {fileName} · {pageCount} {pageCount === 1 ? 'page' : 'pages'}
          </span>
          <button className="btn-text" onClick={onChooseFile}>
            Choose a different file
          </button>
        </div>
        <div className="pager">
          <button
            className="pager-btn"
            aria-label="Previous page"
            disabled={currentPage === 0}
            onClick={() => onPageChange(currentPage - 1)}
          >
            ‹
          </button>
          <span className="pager-label">
            Page {currentPage + 1} of {pageCount}
          </span>
          <button
            className="pager-btn"
            aria-label="Next page"
            disabled={currentPage >= pageCount - 1}
            onClick={() => onPageChange(currentPage + 1)}
          >
            ›
          </button>
        </div>
        <div className="toolbar-actions">
          <button
            className={
              'btn-secondary' +
              (downloadHint && pageReady && busy === null ? ' btn-shimmer' : '')
            }
            onClick={onDownload}
            disabled={busy !== null}
          >
            {busy === 'download' ? 'Preparing…' : 'Download PDF'}
          </button>
          <button className="btn-primary toolbar-print" onClick={onPrint} disabled={busy !== null}>
            Print
          </button>
        </div>
      </div>

      <div className="preview-grid">
        <div className="preview-stage">
          {showReminder && <PrintReminder onDismiss={onDismissReminder} />}
          <span
            className="compare-caption"
            aria-live="polite"
            style={justInked && !holding ? { color: inkHex } : undefined}
          >
            {holding
              ? 'Original — black ink'
              : justInked
                ? `✓ Re-inked in ${INKS[inkIndex].name} — ready to print or download`
                : 'Re-inked preview — what will print'}
          </span>
          {pageReady ? (
            <div className="page-stack">
              <PageCanvas canvas={recoloredCanvas} className="page-layer" />
              <PageCanvas
                canvas={sourceCanvas}
                className={'page-layer page-original' + (holding ? ' visible' : '')}
              />
              {flashKey > 0 && (
                <div key={flashKey} className="page-flash" style={{ color: inkHex }} />
              )}
            </div>
          ) : (
            <div className="page-placeholder">Recoloring this page…</div>
          )}
          <button
            className="pill-btn"
            disabled={!pageReady}
            aria-pressed={holding}
            onPointerDown={(e) => {
              e.preventDefault();
              onHoldChange(true);
            }}
            onPointerUp={() => onHoldChange(false)}
            onPointerLeave={() => onHoldChange(false)}
            onPointerCancel={() => onHoldChange(false)}
            onKeyDown={holdKeyDown}
            onKeyUp={holdKeyUp}
            onBlur={() => onHoldChange(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            Press and hold to see the original
          </button>
        </div>

        <aside className="sidebar">
          <div>
            <div className="side-label">Ink color</div>
            <div className="swatch-row">
              {INKS.map((ink, i) => (
                <button
                  key={ink.hex}
                  className="swatch"
                  aria-label={ink.name}
                  title={ink.name}
                  aria-pressed={i === inkIndex}
                  style={{
                    background: ink.hex,
                    boxShadow:
                      i === inkIndex
                        ? `0 0 0 2px #ffffff, 0 0 0 4px ${ink.hex}`
                        : '0 0 0 1px rgba(0,0,0,.15)',
                  }}
                  onClick={() => onSelectInk(i)}
                />
              ))}
            </div>
            <div className="ink-name">{INKS[inkIndex].name}</div>
          </div>

          <p className="side-note">
            Colored content becomes one ink — a red line and a green line of the same darkness
            will look the same.
          </p>

          <div className="help-section">
            <div className="side-label">If it still won't print</div>
            {PRINTER_TIPS.map((t, i) => (
              <details className="help-item" key={t.brand} open={i === 0}>
                <summary>{t.brand}</summary>
                <div className="help-body">{t.tip}</div>
              </details>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
