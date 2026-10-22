import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
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
import { fileKind, loadDocument, prefetchPdfjs, type SourceDocument } from './lib/loadDocument';
import { classifyError, logAppError, type ErrorCode } from './lib/errors';
import { DocumentReplacedError, PageStore, type PageSnapshot } from './lib/pageStore';
import { exportFormat, exportRecolored, type ExportFormat, type ExportPage } from './lib/exportFile';

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

/** The document the certificate replaced, as the vortex brings it back (PRNTR-VORTEX.md). */
interface OriginalDocument {
  pages: PageSnapshot;
  file: File | null;
  fileName: string;
  format: ExportFormat;
  page: number;
}

/** Print waits this long at most for the print pages to decode, then prints what has. */
const PRINT_DECODE_MS = 5000;
/** Under reduced motion, how long the GAME OVER card stays up before the plain cut back to the app. */
const REDUCED_OVER_HOLD_MS = 2000;

const scheduleIdle: (cb: () => void) => number =
  typeof window.requestIdleCallback === 'function'
    ? (cb) => window.requestIdleCallback(cb)
    : (cb) => window.setTimeout(cb, 16);
const cancelIdle: (handle: number) => void =
  typeof window.cancelIdleCallback === 'function'
    ? (handle) => window.cancelIdleCallback(handle)
    : (handle) => window.clearTimeout(handle);

// Dev only: the side panel with jumps and fight controls. A constant-false branch in builds, so the
// import() is dropped and no chunk is made.
const DevPanel = import.meta.env.DEV ? lazy(() => import('./components/DevPanel')) : null;

// Dev only (see the ?prntr entrance below): a letter-size page of "text" lines, black for the
// source, the ink for the recolored copy.
function devStandIn(ink: string): HTMLCanvasElement {
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
}

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
  // A print or download that failed (not one stopped by a new document).
  const [exportError, setExportError] = useState<ErrorCode | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, setPagesVersion] = useState(0);
  const [prntrStage, setPrntrStage] = useState(0);
  const prntrPage = useRef<{ source: HTMLCanvasElement; recolored: HTMLCanvasElement } | null>(null);
  const prntrAudio = useRef<AudioContext | null>(null);
  const prntrReturn = useRef<AppState>('preview');
  // Set while the app's UI falls back into place over Prntr's last frame: the sky
  // drop after the room is cleared, the Tetris drop after a game over.
  const [prntrDrop, setPrntrDrop] = useState<'sky' | 'tetris' | null>(null);
  // The document the certificate replaced, kept so the vortex can bring it back (PRNTR-VORTEX.md):
  // its rendered pages, name, format and the page that was open. Dropped by the next document.
  const [vortexOriginal, setVortexOriginal] = useState<OriginalDocument | null>(null);

  const storeRef = useRef(new PageStore());
  const store = storeRef.current;
  const inkRef = useRef(INKS[0].hex);
  const runToken = useRef(0);
  const lastFile = useRef<File | null>(null);
  const docRef = useRef<SourceDocument | null>(null);
  const idleHandle = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const printRoot = useRef<HTMLDivElement>(null);
  const handleFileRef = useRef<(file: File) => void>(() => {});
  handleFileRef.current = (file) => void handleFile(file);
  // Prntr has the screen: a file dragged over it is not taken (it would end the game
  // and replace the document unseen). Nor while the app's UI is still dropping back in
  // over its last frame: the state is back already, but Prntr is still mounted.
  const inPrntr = useRef(false);
  inPrntr.current = appState === 'prntr' || prntrDrop !== null;

  // Window-level drag-and-drop: dropping a file anywhere, in any state but
  // Prntr, replaces the loaded document without confirmation. The depth counter
  // keeps the overlay from flickering as the drag crosses child elements.
  useEffect(() => {
    const depth = { current: 0 };
    const isFileDrag = (e: globalThis.DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onDragEnter = (e: globalThis.DragEvent) => {
      if (!isFileDrag(e) || inPrntr.current) return;
      prefetchPdfjs();
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
      if (inPrntr.current) {
        e.preventDefault(); // nor may the browser open the file in place of the app
        return;
      }
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

  // Cmd/Ctrl+P on a document is the Print button: every page, in the ink chosen,
  // rather than the browser printing the app itself.
  const printRef = useRef<() => void>(() => {});
  printRef.current = () => void handlePrint();
  useEffect(() => {
    if (appState !== 'preview') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        printRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [appState]);

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
      enterPrntr(n, { source: devStandIn('#000000'), recolored: devStandIn(inkRef.current) });
    }
  }, [appState]);

  // Dev only: the dev panel's hooks (src/components/DevPanel.tsx). loadStandIn makes the stand-in a
  // real one-page document, so a won room has an original for the vortex to bring back; enter needs
  // that document (appState 'preview'). Bound again every render so they never see stale state.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as { __prntrApp?: unknown }).__prntrApp = {
        appState: () => appState,
        loadStandIn: () => {
          lastFile.current = null;
          startDocument('stand-in.pdf', 'pdf');
          store.reset(1);
          store.setSource(0, devStandIn('#000000'), { width: 612, height: 792 });
          store.ensureRecolored(0, inkRef.current);
          setPageCount(1);
          setProcessedCount(1);
          setPagesVersion((v) => v + 1);
          setAppState('preview');
        },
        enter: (stage: number) => enterPrntr(stage),
      };
    }
  });
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info('prntr-dev-app');
      return () => {
        delete (window as unknown as { __prntrApp?: unknown }).__prntrApp;
      };
    }
  }, []);

  function openPicker() {
    prefetchPdfjs();
    fileInput.current?.click();
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleFile(file);
  }

  // What every new document replaces, a file or the certificate: work still running
  // for the old one (the token tells it to stop), its parsed file, its print pages.
  function startDocument(name: string, exportAs: ExportFormat | null): number {
    const token = ++runToken.current;
    if (idleHandle.current !== null) {
      cancelIdle(idleHandle.current);
      idleHandle.current = null;
    }
    releaseDocument();
    setShowPrintReminder(false);
    setPrintImages([]);
    setHolding(false);
    setBusy(null);
    setExportError(null);
    setVortexOriginal(null);
    setFileName(name);
    if (exportAs) setFormat(exportAs);
    setCurrentPage(0);
    return token;
  }

  async function handleFile(file: File) {
    lastFile.current = file;
    const kind = fileKind(file);
    const token = startDocument(file.name, kind && exportFormat(kind));
    setPageCount(0);
    setProcessedCount(0);
    setAppState('processing');
    try {
      const doc = await loadDocument(file);
      if (token !== runToken.current) {
        doc.destroy();
        return;
      }
      docRef.current = doc;
      store.reset(doc.pageCount);
      setPageCount(doc.pageCount);
      for (let i = 0; i < doc.pageCount; i++) {
        const { canvas, sizePt } = await doc.renderPage(i);
        if (token !== runToken.current) return;
        store.setSource(i, canvas, sizePt);
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
      // A print or download waiting on the pages that will never come gives up.
      store.reset(0);
      const code = classifyError(err);
      logAppError(code, err, lastFile.current);
      setErrorInfo({ code, kind: KIND_BY_CODE[code] });
      setAppState('error');
    }
  }

  // The pages already rendered stay in the store; only the parsed file goes.
  function releaseDocument() {
    docRef.current?.destroy();
    docRef.current = null;
  }

  function selectInk(index: number) {
    setInkIndex(index);
    // The print pages are in the old ink; the next Print makes them again.
    setPrintImages([]);
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

  // Prntr takes over the viewport with the document's first page, whatever page is shown (or a page it is
  // handed, which only the dev entrance does); see PRNTR-ARCHITECTURE.md. The room prints it (PRNTR-FIRE.md §14).
  function enterPrntr(stage: number, page?: { source: HTMLCanvasElement; recolored: HTMLCanvasElement }) {
    if (!page) {
      if (appState !== 'preview') return;
      const recolored = store.ensureRecolored(0, inkRef.current);
      const source = store.getSource(0);
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
    prntrPage.current = null; // the page it was handed goes with it
    setAppState(prntrReturn.current);
  }

  // The drop has landed (or its safety net fired): Prntr unmounts, and its page goes.
  function landPrntrDrop() {
    prntrPage.current = null;
    setPrntrDrop(null);
  }

  // The drops (PRNTR-STAGE-1.md §4.10): after the room is cleared the app's UI falls
  // into place from the sky in one piece; after a game over its blocks fall in one by
  // one like Tetris pieces. Either way over the frozen last frame of Prntr, which stays
  // mounted until the drop has landed. Reduced motion is a plain cut, as is any exit.
  // The room cleared, the page the app comes back to is the certificate of completion,
  // in place of whatever document it had.
  function finishPrntr(outcome: 'cleared' | 'over', certificate?: Certificate) {
    if (certificate) {
      try {
        loadCertificate(certificate);
      } catch (err) {
        // The old document is already gone: say so on the error card rather than
        // drop back onto an empty preview.
        const code = classifyError(err);
        logAppError(code, err, null);
        setErrorInfo({ code, kind: KIND_BY_CODE[code] });
        setAppState('error');
        return;
      }
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (outcome === 'over') {
        // a plain cut, but not on the very frame the card went up: the GAME OVER card is held for a moment first (an Esc
        // in that moment, or a new document, has already left, and is not overridden)
        window.setTimeout(() => {
          prntrPage.current = null;
          setAppState((s) => (s === 'prntr' ? prntrReturn.current : s));
        }, REDUCED_OVER_HOLD_MS);
        return;
      }
      exitPrntr();
      return;
    }
    setPrntrDrop(outcome === 'over' ? 'tetris' : 'sky');
    setAppState(prntrReturn.current);
  }

  // The certificate becomes the loaded document: one page, a PDF to download, recoloured
  // in the chosen ink like any other. A document still processing is dropped (only its
  // rendered pages are kept for the vortex); one entered from nothing (the dev entrance) has
  // nothing to keep.
  function loadCertificate({ id, page }: Certificate) {
    const original: OriginalDocument | null = store.hasSource(currentPage)
      ? { pages: store.snapshot(), file: lastFile.current, fileName, format, page: currentPage }
      : null;
    lastFile.current = null;
    startDocument(`prntr-certificate-${id.slice(-9).replace('-', '')}.pdf`, 'pdf');
    // the certificate comes up in gold, the secret ink, which stays on offer from here on
    setGoldUnlocked(true);
    setInkIndex(INKS.length);
    inkRef.current = GOLD_INK.hex;
    store.reset(1);
    store.setSource(0, page, { width: 612, height: 792 }); // US Letter
    store.ensureRecolored(0, inkRef.current);
    setPageCount(1);
    setProcessedCount(1);
    setPagesVersion((v) => v + 1);
    setVortexOriginal(original);
    prntrReturn.current = 'preview';
  }

  // The vortex has swallowed the certificate: the original document comes back in its place, the
  // hold still on (startDocument clears it), so it shows in its own colours until the button is let
  // go; the chosen ink, gold, stays. Only the pages that had rendered are there to come back.
  function restoreOriginal() {
    const original = vortexOriginal;
    if (!original) return;
    lastFile.current = original.file;
    startDocument(original.fileName, original.format);
    setHolding(true);
    store.restore(original.pages);
    setPageCount(original.pages.length);
    setProcessedCount(original.pages.length);
    const page = Math.min(original.page, original.pages.length - 1);
    setCurrentPage(page);
    store.ensureRecolored(page, inkRef.current);
    setPagesVersion((v) => v + 1);
    queueBackgroundRecolor(inkRef.current);
  }

  // Safety net: Prntr never stays mounted if the drop's animationend does not arrive.
  useEffect(() => {
    if (!prntrDrop) return;
    const id = window.setTimeout(landPrntrDrop, prntrDrop === 'tetris' ? 2000 : 1200);
    return () => window.clearTimeout(id);
  }, [prntrDrop]);

  // Throws DocumentReplacedError once the document it started on is replaced.
  async function collectAllRecolored(token: number): Promise<ExportPage[]> {
    const out: ExportPage[] = [];
    for (let i = 0; i < store.pageCount; i++) {
      await store.whenSourceReady(i);
      if (token !== runToken.current) throw new DocumentReplacedError();
      const canvas = store.ensureRecolored(i, inkRef.current);
      if (canvas) out.push({ canvas, sizePt: store.getSizePt(i) });
    }
    return out;
  }

  async function handlePrint() {
    if (busy) return;
    const token = runToken.current;
    setShowPrintReminder(true);
    setExportError(null);
    setBusy('print');
    try {
      const pages = await collectAllRecolored(token);
      flushSync(() => setPrintImages(pages.map((p) => p.canvas.toDataURL('image/png'))));
      // The dialog snapshots the page: every image must be decoded by then, or it prints blank.
      // A decode that never settles would otherwise hold both buttons until the next file.
      const images = Array.from(printRoot.current?.querySelectorAll('img') ?? []);
      await Promise.race([
        Promise.all(images.map((img) => img.decode().catch(() => undefined))),
        new Promise((resolve) => setTimeout(resolve, PRINT_DECODE_MS)),
      ]);
      if (token !== runToken.current) return;
      window.print();
    } catch (err) {
      if (token !== runToken.current || err instanceof DocumentReplacedError) return;
      setShowPrintReminder(false);
      reportExportError(err);
    } finally {
      // A new document has already reset busy, and may be exporting itself.
      if (token === runToken.current) setBusy(null);
    }
  }

  async function handleDownload() {
    if (busy) return;
    const token = runToken.current;
    setExportError(null);
    setBusy('download');
    try {
      const pages = await collectAllRecolored(token);
      await exportRecolored(pages, fileName || 'document', format);
    } catch (err) {
      if (token !== runToken.current || err instanceof DocumentReplacedError) return;
      reportExportError(err);
    } finally {
      if (token === runToken.current) setBusy(null);
    }
  }

  // An encoder out of memory, a canvas too large to export, a chunk that would not load.
  function reportExportError(err: unknown) {
    const code = classifyError(err);
    logAppError(code, err, lastFile.current);
    setExportError(code);
  }

  function handleRetry() {
    if (lastFile.current) void handleFile(lastFile.current);
    else setAppState('empty');
  }

  const inkHex = inks[inkIndex].hex;
  const recoloredCanvas = appState === 'preview' ? store.getRecolored(currentPage, inkHex) : null;
  const sourceCanvas = appState === 'preview' ? store.getSource(currentPage) : null;

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
          if (landed) landPrntrDrop();
        }}
      >
        <Header />
        {appState === 'empty' && (
          <EmptyState onFile={(f) => void handleFile(f)} onChoose={openPicker} />
        )}
        {appState === 'processing' && (
          <ProcessingState done={processedCount} total={pageCount} />
        )}
        {appState === 'preview' && (
          <PreviewState
            fileName={fileName}
            downloadFormat={format}
            pageCount={pageCount}
            renderedCount={processedCount}
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
            originalPage={vortexOriginal ? (vortexOriginal.pages[vortexOriginal.page]?.source ?? null) : null}
            onVortexDone={restoreOriginal}
            onPrint={() => void handlePrint()}
            onDownload={() => void handleDownload()}
            busy={busy}
            exportError={exportError && { code: exportError, kind: KIND_BY_CODE[exportError] }}
            onDismissExportError={() => setExportError(null)}
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
      {import.meta.env.DEV && DevPanel && (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.heic,.heif,application/pdf,image/png,image/jpeg,image/heic,image/heif"
        style={{ display: 'none' }}
        onChange={onInputChange}
      />
      <div className="print-root" ref={printRoot} aria-hidden="true">
        {printImages.map((src, i) => (
          <img key={i} src={src} alt="" />
        ))}
      </div>
    </div>
  );
}
