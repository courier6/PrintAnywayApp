import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Header } from './components/Header';
import { EmptyState } from './components/EmptyState';
import { ProcessingState } from './components/ProcessingState';
import { PreviewState } from './components/PreviewState';
import { PrntrHost, prefetchPrntr } from './components/PrntrHost';
import { prntrAudioContext } from './components/prntrAudio';
import type { Certificate } from './prntr/types';
import { ErrorState, type ErrorKind } from './components/ErrorState';
import { t, useLocale } from './i18n';
import { GOLD_INK, INKS } from './lib/inks';
import { fileKind, loadDocument } from './lib/loadDocument';
import { classifyError, logAppError, type ErrorCode } from './lib/errors';
import { PageStore } from './lib/pageStore';
import { exportFormat, exportRecolored, type ExportFormat } from './lib/exportFile';

type AppState = 'empty' | 'processing' | 'preview' | 'error' | 'prntr';

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
  // Gold, the secret ink, is on offer once Prntr's room has been won, until the page is reloaded.
  const [goldUnlocked, setGoldUnlocked] = useState(false);
  const inks = goldUnlocked ? [...INKS, GOLD_INK] : INKS;
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [pageCount, setPageCount] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [holding, setHolding] = useState(false);
  const [showPrintReminder, setShowPrintReminder] = useState(false);
  const [printImages, setPrintImages] = useState<string[]>([]);
  const [busy, setBusy] = useState<'print' | 'download' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, setPagesVersion] = useState(0);
  const [prntrStage, setPrntrStage] = useState(0);
  const prntrPage = useRef<{ source: HTMLCanvasElement; recolored: HTMLCanvasElement } | null>(null);
  const prntrAudio = useRef<AudioContext | null>(null);
  const prntrReturn = useRef<AppState>('preview');
  // Set while the app's UI falls back into place over Prntr's last frame: the sky
  // drop after the room is cleared, the Tetris drop after a game over.
  const [prntrDrop, setPrntrDrop] = useState<'sky' | 'tetris' | null>(null);

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

  // While a document is loaded, a refresh or tab close asks first: the file
  // lives only in memory, so leaving drops it. The browser shows its own
  // wording. iOS Safari never fires beforeunload, so this covers desktop only.
  const hasDocument =
    appState === 'processing' || appState === 'preview' || (appState === 'prntr' && prntrReturn.current === 'preview');
  useEffect(() => {
    if (!hasDocument) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Safari and older Chrome need returnValue set
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasDocument]);

  // Dev-only entrance: ?prntr=N opens Prntr at stage N as soon as the app loads,
  // with a stand-in page so nothing has to be uploaded first.
  // import.meta.env.DEV is a build-time constant, so builds drop this whole block;
  // vite.config.ts fails the build if its marker string survives.
  const devSkipUsed = useRef(false);
  useEffect(() => {
    if (import.meta.env.DEV) {
      if (appState !== 'empty' || devSkipUsed.current) return;
      const raw = new URLSearchParams(location.search).get('prntr');
      if (raw === null) return;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) return;
      devSkipUsed.current = true;
      console.info('prntr-dev-skip', n);
      // A letter-size page of "text" lines: black for the source, the ink for the recolored copy.
      const standIn = (ink: string) => {
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
      };
      enterPrntr(n, { source: standIn('#000000'), recolored: standIn(inkRef.current) });
    }
  }, [appState]);

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
    const kind = fileKind(file);
    if (kind) setFormat(exportFormat(kind));
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
    const hex = inks[index].hex;
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

  // Prntr takes over the viewport with the page shown now (or a page it is handed,
  // which only the dev entrance does); see PRNTR-ARCHITECTURE.md.
  function enterPrntr(stage: number, page?: { source: HTMLCanvasElement; recolored: HTMLCanvasElement }) {
    if (!page) {
      if (appState !== 'preview') return;
      const recolored = store.ensureRecolored(currentPage, inkRef.current);
      const source = store.getSource(currentPage);
      if (!recolored || !source) return;
      page = { source, recolored };
    }
    prntrReturn.current = appState;
    prntrAudio.current = prntrAudioContext();
    setHolding(false);
    prntrPage.current = page;
    setPrntrStage(stage);
    setAppState('prntr');
  }

  function exitPrntr() {
    setAppState(prntrReturn.current);
  }

  // The drops (PRNTR-STAGE-1.md §4.10): after the room is cleared the app's UI falls
  // into place from the sky in one piece; after a game over its blocks fall in one by
  // one like Tetris pieces. Either way over the frozen last frame of Prntr, which stays
  // mounted until the drop has landed. Reduced motion is a plain cut, as is any exit.
  // The room cleared, the page the app comes back to is the certificate of completion,
  // in place of whatever document it had (Edgar, 2026-10-20).
  function finishPrntr(outcome: 'cleared' | 'over', certificate?: Certificate) {
    if (certificate) loadCertificate(certificate);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      exitPrntr();
      return;
    }
    setPrntrDrop(outcome === 'over' ? 'tetris' : 'sky');
    setAppState(prntrReturn.current);
  }

  // The certificate becomes the loaded document: one page, a PDF to download, recoloured
  // in the chosen ink like any other. A document still processing is dropped.
  function loadCertificate({ id, page }: Certificate) {
    runToken.current++;
    lastFile.current = null;
    setShowPrintReminder(false);
    setPrintImages([]);
    setHolding(false);
    setFileName(`prntr-certificate-${id.slice(-9).replace('-', '')}.pdf`);
    setFormat('pdf');
    // the certificate comes up in gold, the secret ink, which stays on offer from here on
    setGoldUnlocked(true);
    setInkIndex(INKS.length);
    inkRef.current = GOLD_INK.hex;
    store.reset(1);
    store.setSource(0, page);
    store.ensureRecolored(0, inkRef.current);
    setPageCount(1);
    setProcessedCount(1);
    setCurrentPage(0);
    setPagesVersion((v) => v + 1);
    prntrReturn.current = 'preview';
  }

  // Safety net: Prntr never stays mounted if the drop's animationend does not arrive.
  useEffect(() => {
    if (!prntrDrop) return;
    const id = window.setTimeout(() => setPrntrDrop(null), prntrDrop === 'tetris' ? 2000 : 1200);
    return () => window.clearTimeout(id);
  }, [prntrDrop]);

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
      await exportRecolored(canvases, fileName || 'document', format);
    } finally {
      setBusy(null);
    }
  }

  function handleRetry() {
    if (lastFile.current) void handleFile(lastFile.current);
    else setAppState('empty');
  }

  const inkHex = inks[inkIndex].hex;
  const recoloredCanvas = appState === 'preview' ? store.getRecolored(currentPage, inkHex) : null;
  const sourceCanvas = appState === 'preview' ? store.getSource(currentPage) : null;
  const firstPage = appState === 'processing' ? store.getRecolored(0, inkHex) : null;

  return (
    <div
      className={'app' + (printImages.length > 0 ? ' has-print-pages' : '')}
      style={{ '--ink': INKS[0].hex } as CSSProperties}
    >
      <div
        className={'no-print' + (prntrDrop === 'sky' ? ' is-sky-drop' : prntrDrop === 'tetris' ? ' is-tetris-drop' : '')}
        onAnimationEnd={(e) => {
          // The sky drop animates .no-print itself; the Tetris drop's last piece is the header.
          const landed = prntrDrop === 'tetris' ? (e.target as HTMLElement).classList.contains('header') : e.target === e.currentTarget;
          if (landed) setPrntrDrop(null);
        }}
      >
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
            downloadFormat={format}
            pageCount={pageCount}
            currentPage={currentPage}
            onPageChange={goToPage}
            inks={inks}
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
            onOpenPrntr={() => enterPrntr(0)}
            onPrefetchPrntr={prefetchPrntr}
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
      {/* Outside .no-print: the sky drop transforms .no-print, which would carry the fixed
          Prntr layer along with it. */}
      {(appState === 'prntr' || prntrDrop !== null) && prntrPage.current && (
        <PrntrHost
          source={prntrPage.current.source}
          recolored={prntrPage.current.recolored}
          inkHex={inkHex}
          stage={prntrStage}
          audioContext={prntrAudio.current}
          onExit={exitPrntr}
          onDone={finishPrntr}
        />
      )}
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
