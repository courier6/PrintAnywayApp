import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Header } from './components/Header';
import { EmptyState } from './components/EmptyState';
import { ProcessingState } from './components/ProcessingState';
import { PreviewState } from './components/PreviewState';
import { ErrorState, type ErrorKind } from './components/ErrorState';
import { t, useLocale } from './i18n';
import { INKS } from './lib/inks';
import { loadDocument } from './lib/loadDocument';
import { classifyError, logAppError, type ErrorCode } from './lib/errors';
import { PageStore } from './lib/pageStore';
import { exportRecoloredPdf } from './lib/exportPdf';

type AppState = 'empty' | 'processing' | 'preview' | 'error';

const KIND_BY_CODE: Record<ErrorCode, ErrorKind> = {
  'PA-100': 'processing',
  'PA-101': 'unsupported',
  'PA-102': 'password',
  'PA-103': 'damaged-pdf',
  'PA-104': 'heic',
  'PA-105': 'image',
  'PA-106': 'memory',
};

const scheduleIdle: (cb: () => void) => number =
  typeof window.requestIdleCallback === 'function'
    ? (cb) => window.requestIdleCallback(cb)
    : (cb) => window.setTimeout(cb, 16);
const cancelIdle: (handle: number) => void =
  typeof window.cancelIdleCallback === 'function'
    ? (handle) => window.cancelIdleCallback(handle)
    : (handle) => window.clearTimeout(handle);

export default function App() {
  // Re-render everything when the language picker switches locale.
  useLocale();
  const [appState, setAppState] = useState<AppState>('empty');
  const [errorInfo, setErrorInfo] = useState<{ code: ErrorCode; kind: ErrorKind }>({
    code: 'PA-100',
    kind: 'processing',
  });
  const [inkIndex, setInkIndex] = useState(0);
  const [fileName, setFileName] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [holding, setHolding] = useState(false);
  const [showPrintReminder, setShowPrintReminder] = useState(false);
  const [printImages, setPrintImages] = useState<string[]>([]);
  const [busy, setBusy] = useState<'print' | 'download' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, setPagesVersion] = useState(0);

  const storeRef = useRef(new PageStore());
  const store = storeRef.current;
  const inkRef = useRef(INKS[0].hex);
  const runToken = useRef(0);
  const lastFile = useRef<File | null>(null);
  const idleHandle = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const handleFileRef = useRef<(file: File) => void>(() => {});
  handleFileRef.current = (file) => void handleFile(file);

  // Window-level drag-and-drop: dropping a file anywhere, in any state,
  // replaces the loaded document without confirmation. The depth counter
  // keeps the overlay from flickering as the drag crosses child elements.
  useEffect(() => {
    const depth = { current: 0 };
    const isFileDrag = (e: globalThis.DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onDragEnter = (e: globalThis.DragEvent) => {
      if (!isFileDrag(e)) return;
      depth.current++;
      setDragging(true);
    };
    const onDragLeave = (e: globalThis.DragEvent) => {
      if (!isFileDrag(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const onDragOver = (e: globalThis.DragEvent) => {
      if (isFileDrag(e)) e.preventDefault();
    };
    const onDrop = (e: globalThis.DragEvent) => {
      depth.current = 0;
      setDragging(false);
      if (!isFileDrag(e)) return;
      // The empty/error DropZone handles its own drops (and prevents default);
      // don't process the same file twice.
      if (e.defaultPrevented) return;
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFileRef.current(file);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  function openPicker() {
    fileInput.current?.click();
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleFile(file);
  }

  async function handleFile(file: File) {
    const token = ++runToken.current;
    lastFile.current = file;
    setShowPrintReminder(false);
    setPrintImages([]);
    setHolding(false);
    setFileName(file.name);
    setPageCount(0);
    setProcessedCount(0);
    setCurrentPage(0);
    setAppState('processing');
    try {
      const doc = await loadDocument(file);
      if (token !== runToken.current) return;
      store.reset(doc.pageCount);
      setPageCount(doc.pageCount);
      for (let i = 0; i < doc.pageCount; i++) {
        const source = await doc.renderPage(i);
        if (token !== runToken.current) return;
        store.setSource(i, source);
        store.ensureRecolored(i, inkRef.current);
        setProcessedCount(i + 1);
        setPagesVersion((v) => v + 1);
        if (i === 0) setAppState('preview');
        // Yield to the UI between pages so progress and preview stay live.
        await new Promise((r) => setTimeout(r, 0));
        if (token !== runToken.current) return;
      }
    } catch (err) {
      if (token !== runToken.current) return;
      const code = classifyError(err);
      logAppError(code, err, lastFile.current);
      setErrorInfo({ code, kind: KIND_BY_CODE[code] });
      setAppState('error');
    }
  }

  function selectInk(index: number) {
    setInkIndex(index);
    const hex = INKS[index].hex;
    inkRef.current = hex;
    // Visible page synchronously; the rest catch up in idle time.
    store.ensureRecolored(currentPage, hex);
    setPagesVersion((v) => v + 1);
    queueBackgroundRecolor(hex);
  }

  function queueBackgroundRecolor(hex: string) {
    if (idleHandle.current !== null) cancelIdle(idleHandle.current);
    const step = () => {
      idleHandle.current = null;
      for (let i = 0; i < store.pageCount; i++) {
        if (store.hasSource(i) && !store.getRecolored(i, hex)) {
          store.ensureRecolored(i, hex);
          idleHandle.current = scheduleIdle(step);
          return;
        }
      }
    };
    idleHandle.current = scheduleIdle(step);
  }

  function goToPage(page: number) {
    const clamped = Math.max(0, Math.min(pageCount - 1, page));
    if (store.hasSource(clamped)) store.ensureRecolored(clamped, inkRef.current);
    setCurrentPage(clamped);
  }

  async function collectAllRecolored(): Promise<HTMLCanvasElement[]> {
    const out: HTMLCanvasElement[] = [];
    for (let i = 0; i < store.pageCount; i++) {
      await store.whenSourceReady(i);
      const canvas = store.ensureRecolored(i, inkRef.current);
      if (canvas) out.push(canvas);
    }
    return out;
  }

  async function handlePrint() {
    if (busy) return;
    setShowPrintReminder(true);
    setBusy('print');
    try {
      const canvases = await collectAllRecolored();
      setPrintImages(canvases.map((c) => c.toDataURL('image/png')));
      // Let React commit the print pages before opening the dialog.
      await new Promise((r) => setTimeout(r, 60));
      window.print();
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    if (busy) return;
    setBusy('download');
    try {
      const canvases = await collectAllRecolored();
      await exportRecoloredPdf(canvases, fileName || 'document');
    } finally {
      setBusy(null);
    }
  }

  function handleRetry() {
    if (lastFile.current) void handleFile(lastFile.current);
    else setAppState('empty');
  }

  const inkHex = INKS[inkIndex].hex;
  const recoloredCanvas = appState === 'preview' ? store.getRecolored(currentPage, inkHex) : null;
  const sourceCanvas = appState === 'preview' ? store.getSource(currentPage) : null;
  const firstPage = appState === 'processing' ? store.getRecolored(0, inkHex) : null;

  return (
    <div
      className={'app' + (printImages.length > 0 ? ' has-print-pages' : '')}
      style={{ '--ink': INKS[0].hex } as CSSProperties}
    >
      <div className="no-print">
        <Header />
        {appState === 'empty' && (
          <EmptyState onFile={(f) => void handleFile(f)} onChoose={openPicker} />
        )}
        {appState === 'processing' && (
          <ProcessingState firstPage={firstPage} done={processedCount} total={pageCount} />
        )}
        {appState === 'preview' && (
          <PreviewState
            fileName={fileName}
            pageCount={pageCount}
            currentPage={currentPage}
            onPageChange={goToPage}
            inkIndex={inkIndex}
            onSelectInk={selectInk}
            onChooseFile={openPicker}
            sourceCanvas={sourceCanvas}
            recoloredCanvas={recoloredCanvas}
            holding={holding}
            onHoldChange={setHolding}
            onPrint={() => void handlePrint()}
            onDownload={() => void handleDownload()}
            busy={busy}
            showReminder={showPrintReminder}
            onDismissReminder={() => setShowPrintReminder(false)}
          />
        )}
        {appState === 'error' && (
          <ErrorState
            kind={errorInfo.kind}
            code={errorInfo.code}
            onFile={(f) => void handleFile(f)}
            onChoose={openPicker}
            onRetry={handleRetry}
          />
        )}
        {dragging && appState !== 'empty' && (
          <div className="drag-overlay">
            <div className="drag-overlay-frame" aria-hidden="true" />
            <div className="drag-overlay-headline">
              {t('dragOverlay.headline', { fileName })}
            </div>
            <div className="drag-overlay-subline">{t('dragOverlay.subline')}</div>
          </div>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.heic,.heif,application/pdf,image/png,image/jpeg,image/heic,image/heif"
        style={{ display: 'none' }}
        onChange={onInputChange}
      />
      <div className="print-root" aria-hidden="true">
        {printImages.map((src, i) => (
          <img key={i} src={src} alt="" />
        ))}
      </div>
    </div>
  );
}
