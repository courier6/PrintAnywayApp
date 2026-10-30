import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { t, tPlural, useLocale } from '../i18n';
import type { ExportFormat } from '../lib/exportFile';
import type { Ink } from '../lib/inks';
import { OTHER_TIP, PRINTER_TIPS } from '../lib/printerTips';
import RisingGlyphs from './RisingGlyphs';
import { PageCanvas } from './PageCanvas';
import type { Notice } from '../App';
import { PrintReminder } from './PrintReminder';
import { PUFF_MS, THIN_MS, VORTEX_MS, VortexCanvas } from './VortexCanvas';
import { reducedMotion } from '../prntr/anim';

interface Props {
  fileName: string;
  downloadFormat: ExportFormat;
  pageCount: number;
  /** Pages rendered so far; the rest are still on their way. */
  renderedCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  /** The inks on offer (the four, and gold once Prntr's room is won). */
  inks: readonly Ink[];
  inkIndex: number;
  onSelectInk: (index: number) => void;
  onChooseFile: () => void;
  sourceCanvas: HTMLCanvasElement | null;
  recoloredCanvas: HTMLCanvasElement | null;
  holding: boolean;
  onHoldChange: (holding: boolean) => void;
  /**
   * On the certificate with a document behind it: that document's current page in its own colours
   * (PRNTR-VORTEX.md). The hold then runs the vortex, and `onVortexDone` brings the document back.
   */
  originalPage: HTMLCanvasElement | null;
  onVortexDone: () => void;
  onPrint: () => void;
  onDownload: () => void;
  busy: 'print' | 'download' | null;
  /** A failed print or download, an unsupported file dropped, a document cut short: shown above the page until dismissed. */
  notice: Notice | null;
  onDismissNotice: () => void;
  showReminder: boolean;
  onDismissReminder: () => void;
  onOpenPrntr: () => void;
  onPrefetchPrntr: () => void;
}

export function PreviewState({
  fileName,
  downloadFormat,
  pageCount,
  renderedCount,
  currentPage,
  onPageChange,
  inks,
  inkIndex,
  onSelectInk,
  onChooseFile,
  sourceCanvas,
  recoloredCanvas,
  holding,
  onHoldChange,
  originalPage,
  onVortexDone,
  onPrint,
  onDownload,
  busy,
  notice,
  onDismissNotice,
  showReminder,
  onDismissReminder,
  onOpenPrntr,
  onPrefetchPrntr,
}: Props) {
  const pageReady = recoloredCanvas !== null;
  const locale = useLocale();
  // The preview takes the focus the picker's button had before it unmounted: a hidden heading naming the
  // document, so a keyboard or screen-reader user lands on what just opened rather than on the page body.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const inkHex = inks[inkIndex].hex;

  // Transient confirmation after a swatch click; flashKey restarts the
  // glow animation even when clicks come in quick succession.
  const [justInked, setJustInked] = useState(false);
  // The way into Prntr has the pointer or the focus: glyphs rise above and below it only then.
  // The link's glyphs run while it has the pointer or the focus: two flags, so one leaving does not end the other's.
  const [omenHover, setOmenHover] = useState(false);
  const [omenFocus, setOmenFocus] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const inkTimer = useRef<number | null>(null);
  const prevInk = useRef(inkIndex);

  // Delayed nudge toward the download button: starts after the page flash and
  // caption have settled so it reads as a second, quieter cue.
  const [downloadHint, setDownloadHint] = useState(false);
  const hintTimers = useRef<number[]>([]);

  // The vortex (PRNTR-VORTEX.md): a hold on the certificate starts the swirl; VORTEX_MS later the
  // original is back (onVortexDone). Let go before that, the swirl thins out (THIN_MS) while the
  // puff plays (PUFF_MS). The ref mirrors the state for the effect and the timers.
  interface Vortex {
    key: number;
    startedAt: number;
    releasedAt: number | null;
    thinned: boolean;
  }
  const [vortex, setVortexState] = useState<Vortex | null>(null);
  const vortexRef = useRef<Vortex | null>(null);
  const vortexTimers = useRef<number[]>([]);
  const onVortexDoneRef = useRef(onVortexDone);
  onVortexDoneRef.current = onVortexDone;
  const setVortex = (v: Vortex | null) => {
    vortexRef.current = v;
    setVortexState(v);
  };
  const clearVortexTimers = () => {
    vortexTimers.current.forEach((t) => window.clearTimeout(t));
    vortexTimers.current = [];
  };

  useEffect(() => {
    if (!originalPage) {
      // the original is back (or there never was one): nothing to swirl
      if (vortexRef.current) {
        clearVortexTimers();
        setVortex(null);
      }
      return;
    }
    if (holding) {
      if (reducedMotion()) {
        onVortexDoneRef.current();
        return;
      }
      clearVortexTimers();
      setVortex({ key: (vortexRef.current?.key ?? 0) + 1, startedAt: performance.now(), releasedAt: null, thinned: false });
      vortexTimers.current = [
        window.setTimeout(() => {
          setVortex(null);
          onVortexDoneRef.current();
        }, VORTEX_MS),
      ];
    } else if (vortexRef.current && vortexRef.current.releasedAt === null) {
      clearVortexTimers();
      setVortex({ ...vortexRef.current, releasedAt: performance.now() });
      vortexTimers.current = [
        window.setTimeout(() => {
          if (vortexRef.current) setVortex({ ...vortexRef.current, thinned: true });
        }, THIN_MS),
        window.setTimeout(() => setVortex(null), PUFF_MS),
      ];
    }
  }, [holding, originalPage]);

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
      vortexTimers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // Esc closes the after-print reminder.
  useEffect(() => {
    if (!showReminder) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onDismissReminder();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showReminder, onDismissReminder]);

  function holdKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      onHoldChange(true);
    }
  }

  function holdKeyUp(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') onHoldChange(false);
  }

  const swirling = vortex !== null && vortex.releasedAt === null;

  return (
    <>
      <h1 className="sr-only" tabIndex={-1} ref={heading}>
        {fileName}, {tPlural('preview.pages', pageCount)}
      </h1>
      <div className="toolbar">
        <div className="toolbar-file">
          <span className="file-chip" title={fileName}>
            <span className="file-name">{fileName}</span>
            <span className="file-pages">{'\u00a0· '}{tPlural('preview.pages', pageCount)}</span>
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
            aria-disabled={busy !== null}
          >
            {busy === 'download'
              ? t('preview.preparing')
              : t('preview.download', { format: downloadFormat.toUpperCase() })}
          </button>
          <button className="btn-primary toolbar-print" onClick={onPrint} aria-disabled={busy !== null}>
            {busy === 'print' ? t('preview.preparing') : t('preview.print')}
          </button>
        </div>
      </div>

      <div className="preview-grid">
        <div className={'preview-stage' + (pageCount > 1 ? ' is-paged' : '')}>
          {showReminder && <PrintReminder onDismiss={onDismissReminder} />}
          {notice && (
            <div className="print-reminder" role="alert">
              <div className="print-reminder-text">
                {notice.kind === 'error' ? (
                  <>
                    <strong>{t(`error.${notice.errorKind}.title`)}</strong> {t(`error.${notice.errorKind}.body`)}
                    <span className="export-error-code">{t('error.code', { code: notice.code })}</span>
                  </>
                ) : (
                  <>
                    <strong>{t('preview.partialTitle', { from: notice.rendered + 1, total: notice.total })}</strong>{' '}
                    {t('preview.partialBody')}
                  </>
                )}
              </div>
              <button className="btn-outline-small" onClick={onDismissNotice}>
                {t('printReminder.dismiss')}
              </button>
            </div>
          )}
          <span
            className="compare-caption"
            aria-live="polite"
            style={justInked && !holding ? { color: inkHex } : undefined}
          >
            {holding && !swirling
              ? t('preview.captionOriginal')
              : justInked
                ? t('preview.captionInked', { ink: t(inks[inkIndex].nameKey) })
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
          {/* The rest of a long document is still rendering: say so, as Print and Download
              wait for it. Kept in the layout once done so the page does not jump; not a live
              region, which would read out every page. */}
          {pageCount > 1 && (
            <div className={'preview-progress' + (renderedCount >= pageCount ? ' is-done' : '')}>
              {t('processing.page', { page: Math.min(renderedCount + 1, pageCount), total: pageCount })}
            </div>
          )}
          {pageReady ? (
            <div
              className="page-stack"
              style={{ '--page-aspect': recoloredCanvas.width / recoloredCanvas.height } as CSSProperties}
            >
              <PageCanvas
                canvas={recoloredCanvas}
                className={'page-layer' + (vortex && !vortex.thinned ? ' is-swallowed' : '')}
                label={t('preview.pageAlt', { page: currentPage + 1, total: pageCount, ink: t(inks[inkIndex].nameKey) })}
              />
              {/* While the vortex swirls this layer is the original underneath, in its own colours, fitted
                  to the certificate's frame; restored, the same canvas is the document's own original. */}
              <PageCanvas
                canvas={swirling ? originalPage : sourceCanvas}
                className={'page-layer page-original' + (holding ? ' visible' : '') + (swirling ? ' is-under' : '')}
                hidden
              />
              {flashKey > 0 && (
                <div key={flashKey} className="page-flash" style={{ color: inkHex }} />
              )}
              {vortex && recoloredCanvas && (
                <VortexCanvas
                  key={vortex.key}
                  certificate={recoloredCanvas}
                  startedAt={vortex.startedAt}
                  releasedAt={vortex.releasedAt}
                  thinned={vortex.thinned}
                />
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
              {inks.map((ink, i) => (
                <button
                  key={ink.hex}
                  className="swatch"
                  aria-label={t(ink.nameKey)}
                  title={t(ink.nameKey)}
                  aria-pressed={i === inkIndex}
                  style={{
                    background: ink.swatch ?? ink.hex,
                    boxShadow:
                      i === inkIndex
                        ? `0 0 0 2px #ffffff, 0 0 0 4px ${ink.hex}`
                        : '0 0 0 1px rgba(0,0,0,.15)',
                  }}
                  onClick={() => onSelectInk(i)}
                />
              ))}
            </div>
            <div className="ink-name">{t(inks[inkIndex].nameKey)}</div>
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
                only, so not in PRINTER_TIPS (shared with the landing page) nor localized.
                Hidden on touch screens until Prntr's touch form is done (.help-other). */}
            {locale.code === 'en' && (
              <details
                className="help-item help-other"
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
                    {/* The link reads as plain text until it has the pointer or the focus; then glyphs
                        rise above and sink below it (RisingGlyphs) and stop when it loses them. */}
                    <span className="help-omen" style={{ color: inkHex }}>
                      <button
                        type="button"
                        className="help-link"
                        onClick={onOpenPrntr}
                        onPointerEnter={() => setOmenHover(true)}
                        onPointerLeave={() => setOmenHover(false)}
                        onFocus={() => setOmenFocus(true)}
                        onBlur={() => setOmenFocus(false)}
                      >
                        {OTHER_TIP.link}
                      </button>
                      <RisingGlyphs active={omenHover || omenFocus} />
                    </span>
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
