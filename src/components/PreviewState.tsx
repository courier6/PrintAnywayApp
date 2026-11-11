import { useEffect, useRef, type CSSProperties } from 'react';
import { t, tPlural, useLocale } from '../i18n';
import { kindOf } from '../lib/errors';
import type { ExportFormat } from '../lib/exportFile';
import type { Ink } from '../lib/inks';
import { PRINTER_TIPS } from '../lib/printerTips';
import { PageCanvas } from './PageCanvas';
import type { Notice } from '../App';
import { PrintReminder } from './PrintReminder';
import { VortexCanvas } from './VortexCanvas';
import { InkPicker } from './preview/InkPicker';
import { Pager } from './preview/Pager';
import { PrntrTip } from './preview/PrntrTip';
import { useCompareHold } from './preview/useCompareHold';
import { useInkFeedback } from './preview/useInkFeedback';
import { useVortex } from './preview/useVortex';

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

  const { justInked, flashKey, downloadHint } = useInkFeedback(inkIndex);
  const { vortex, swirling } = useVortex(holding, originalPage, onVortexDone);
  const { latched, buttonProps: holdProps } = useCompareHold({
    holding,
    onHoldChange,
    canLatch: originalPage === null,
    inkIndex,
    currentPage,
  });

  // Esc closes the after-print reminder.
  useEffect(() => {
    if (!showReminder) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onDismissReminder();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showReminder, onDismissReminder]);

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
                    <strong>{t(`error.${kindOf(notice.code)}.title`)}</strong> {t(`error.${kindOf(notice.code)}.body`)}
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
              ? t(latched ? 'preview.captionLatched' : 'preview.captionOriginal')
              : justInked
                ? t('preview.captionInked', { ink: t(inks[inkIndex].nameKey) })
                : t('preview.captionDefault')}
          </span>
          {pageCount > 1 && <Pager currentPage={currentPage} pageCount={pageCount} onPageChange={onPageChange} />}
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
            {...holdProps}
          >
            {t(latched ? 'preview.holdLatched' : 'preview.hold')}
          </button>
        </div>

        <aside className="sidebar">
          <InkPicker inks={inks} inkIndex={inkIndex} onSelectInk={onSelectInk} />

          <p className="side-note">{t('preview.sideNote')}</p>

          <div className="help-section">
            <div className="side-label">{t('preview.helpLabel')}</div>
            {PRINTER_TIPS.map((tip) => (
              <details className="help-item" key={tip.brand}>
                <summary>{tip.brand}</summary>
                <div className="help-body">{t(tip.tipKey)}</div>
              </details>
            ))}
            {locale.code === 'en' && <PrntrTip inkHex={inkHex} onOpen={onOpenPrntr} onPrefetch={onPrefetchPrntr} />}
          </div>
        </aside>
      </div>
    </>
  );
}
