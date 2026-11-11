import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../../i18n';

interface Props {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

/** Previous and next, the page label that opens a page field, and the keys. Mounted for a document of several pages. */
export function Pager({ currentPage, pageCount, onPageChange }: Props) {
  // The keys, wherever the focus is: ← and → turn the page, Home and End reach the ends. Not with a
  // modifier (the browser's own shortcuts), nor while typing in a field.
  const latest = useRef({ currentPage, pageCount, onPageChange });
  latest.current = { currentPage, pageCount, onPageChange };
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
      const { currentPage, pageCount, onPageChange } = latest.current;
      const to =
        e.key === 'ArrowLeft' ? currentPage - 1
        : e.key === 'ArrowRight' ? currentPage + 1
        : e.key === 'Home' ? 0
        : e.key === 'End' ? pageCount - 1
        : null;
      if (to === null) return;
      e.preventDefault();
      onPageChange(to);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The page field: a click on "Page 3 of 40" swaps it for a number field. Enter goes to that page (the
  // app clamps it), Esc or leaving the field closes it. The focus goes back to the label after the keys.
  const [pageField, setPageField] = useState<string | null>(null);
  const label = useRef<HTMLButtonElement>(null);
  const refocusLabel = useRef(false);
  useEffect(() => {
    if (pageField === null && refocusLabel.current) {
      refocusLabel.current = false;
      label.current?.focus({ preventScroll: true });
    }
  }, [pageField]);

  function pageFieldKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' && e.key !== 'Escape') return;
    e.preventDefault();
    if (e.key === 'Enter' && pageField) onPageChange(Number(pageField) - 1);
    refocusLabel.current = true;
    setPageField(null);
  }

  return (
    <div className="pager">
      <button
        className="pager-btn"
        aria-label={t('preview.prevPage')}
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
      >
        ‹
      </button>
      {pageField === null ? (
        <button
          type="button"
          className="pager-label"
          ref={label}
          title={t('preview.goToPage')}
          onClick={() => setPageField(String(currentPage + 1))}
        >
          {t('preview.pageOf', { page: currentPage + 1, total: pageCount })}
        </button>
      ) : (
        <input
          className="pager-input"
          type="text"
          inputMode="numeric"
          aria-label={t('preview.pageInput')}
          autoFocus
          value={pageField}
          onChange={(e) => setPageField(e.target.value.replace(/\D/g, '').slice(0, 5))}
          onFocus={(e) => e.target.select()}
          onKeyDown={pageFieldKeyDown}
          onBlur={() => setPageField(null)}
        />
      )}
      <button
        className="pager-btn"
        aria-label={t('preview.nextPage')}
        disabled={currentPage >= pageCount - 1}
        onClick={() => onPageChange(currentPage + 1)}
      >
        ›
      </button>
    </div>
  );
}
