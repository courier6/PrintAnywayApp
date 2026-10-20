import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { t, tPlural, useLocale } from '../i18n';
import type { ExportFormat } from '../lib/exportFile';
import { INKS } from '../lib/inks';
import { OTHER_TIP, PRINTER_TIPS } from '../lib/printerTips';
import { PageCanvas } from './PageCanvas';
import { PrintReminder } from './PrintReminder';

interface Props {
  fileName: string;
  downloadFormat: ExportFormat;
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
  onOpenPrntr: () => void;
  onPrefetchPrntr: () => void;
}

export function PreviewState({
  fileName,
  downloadFormat,
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
  onOpenPrntr,
  onPrefetchPrntr,
}: Props) {
  const pageReady = recoloredCanvas !== null;
  const locale = useLocale();
  const inkHex = INKS[inkIndex].hex;

  // Transient confirmation after a swatch click; flashKey restarts the
  // glow animation even when clicks come in quick succession.
  const [justInked, setJustInked] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const inkTimer = useRef<number | null>(null);
  const prevInk = useRef(inkIndex);

  // Delayed nudge toward the download button: starts after the page flash and
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
            {fileName} · {tPlural('preview.pages', pageCount)}
          </span>
          <button className="btn-text" onClick={onChooseFile}>
            {t('preview.chooseDifferent')}
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
            {busy === 'download'
              ? t('preview.preparing')
              : t('preview.download', { format: downloadFormat.toUpperCase() })}
          </button>
          <button className="btn-primary toolbar-print" onClick={onPrint} disabled={busy !== null}>
            {t('preview.print')}
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
              ? t('preview.captionOriginal')
              : justInked
                ? t('preview.captionInked', { ink: t(INKS[inkIndex].nameKey) })
                : t('preview.captionDefault')}
          </span>
          {pageCount > 1 && (
            <div className="pager">
              <button
                className="pager-btn"
                aria-label={t('preview.prevPage')}
                disabled={currentPage === 0}
                onClick={() => onPageChange(currentPage - 1)}
              >
                ‹
              </button>
              <span className="pager-label">
                {t('preview.pageOf', { page: currentPage + 1, total: pageCount })}
              </span>
              <button
                className="pager-btn"
                aria-label={t('preview.nextPage')}
                disabled={currentPage >= pageCount - 1}
                onClick={() => onPageChange(currentPage + 1)}
              >
                ›
              </button>
            </div>
          )}
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
            <div className="page-placeholder">{t('preview.recoloringPage')}</div>
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
            {t('preview.hold')}
          </button>
        </div>

        <aside className="sidebar">
          <div>
            <div className="side-label">{t('preview.inkLabel')}</div>
            <div className="swatch-row">
              {INKS.map((ink, i) => (
                <button
                  key={ink.hex}
                  className="swatch"
                  aria-label={t(ink.nameKey)}
                  title={t(ink.nameKey)}
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
            <div className="ink-name">{t(INKS[inkIndex].nameKey)}</div>
          </div>

          <p className="side-note">{t('preview.sideNote')}</p>

          <div className="help-section">
            <div className="side-label">{t('preview.helpLabel')}</div>
            {PRINTER_TIPS.map((tip) => (
              <details className="help-item" key={tip.brand}>
                <summary>{tip.brand}</summary>
                <div className="help-body">{t(tip.tipKey)}</div>
              </details>
            ))}
            {/* Cross-brand advice, and the way into Prntr (PRNTR-TRIGGER.md). English
                only, so not in PRINTER_TIPS (shared with the landing page) nor localized. */}
            {locale.code === 'en' && (
              <details
                className="help-item"
                onToggle={(e) => {
                  if (e.currentTarget.open) onPrefetchPrntr();
                }}
              >
                <summary>{OTHER_TIP.label}</summary>
                <div className="help-body">
                  <p>{OTHER_TIP.body1}</p>
                  <p>{OTHER_TIP.body2}</p>
                  <p>
                    {OTHER_TIP.lead}
                    <button
                      type="button"
                      className="help-link"
                      style={{ color: inkHex }}
                      onClick={onOpenPrntr}
                    >
                      {OTHER_TIP.link}
                    </button>
                    {OTHER_TIP.tail}
                  </p>
                </div>
              </details>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
