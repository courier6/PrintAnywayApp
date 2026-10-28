import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { Header } from './components/Header';
import { EmptyState } from './components/EmptyState';
import { ProcessingState } from './components/ProcessingState';
import { PreviewState } from './components/PreviewState';
import { PrntrBoardHost, PrntrHost, prefetchPrntr } from './components/PrntrHost';
import type { BoardRun } from './prntr/PrntrBoard';
import type { Certificate } from './prntr/types';
import { usePrntrSession } from './usePrntrSession';
import { useDevHooks } from './devHooks';
import { ErrorState } from './components/ErrorState';
import { t, tPlural, useLocale } from './i18n';
import { GOLD_INK, INKS } from './lib/inks';
import { ACCEPT, detectKind, exportFormat, loadDocument, prefetchPdfjs, unsupportedError, type SourceDocument } from './lib/loadDocument';
import { classifyError, logAppError, type ErrorCode } from './lib/errors';
import { DocumentReplacedError, PageStore, type PageSnapshot } from './lib/pageStore';
import { exportRecolored, type ExportFormat, type ExportPage } from './lib/exportFile';
import { canvasBlob } from './lib/canvasBlob';

export type AppState = 'empty' | 'processing' | 'preview' | 'error' | 'prntr';

/** A notice over the preview: a print or download that failed (not one stopped by a new document), an
 * unsupported file dropped on the document, or a document cut short by a page that would not render. */
export type Notice =
  | { kind: 'error'; code: ErrorCode }
  | { kind: 'partial'; rendered: number; total: number };

/** The document the certificate replaced, as the vortex brings it back (PRNTR-VORTEX.md). */
interface OriginalDocument {
  pages: PageSnapshot;
  pageCount: number; // the whole document's: more than pages.length when it was won while still rendering
  file: File | null;
  fileName: string;
  format: ExportFormat;
  page: number;
}

/** Print waits this long at most for the print pages to decode, then prints what has. */
const PRINT_DECODE_MS = 5000;

/** A page as a PNG object URL for the print root, encoded off the main thread (toDataURL would hold it
 * for every page at once: a 20-page print froze it for 0.3–2 s). */
async function pngUrl(canvas: HTMLCanvasElement): Promise<string> {
  return URL.createObjectURL(await canvasBlob(canvas, 'image/png'));
}

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

export default function App() {
  // Re-render everything when the language picker switches locale.
  useLocale();
  const [appState, setAppState] = useState<AppState>('empty');
  const [errorCode, setErrorCode] = useState<ErrorCode>('PA-100');
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
  // The print root's pages: an object URL each, and whether the sheet turns landscape for it.
  const [printImages, setPrintImages] = useState<{ src: string; landscape: boolean }[]>([]);
  const [busy, setBusy] = useState<'print' | 'download' | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);
  // What a screen reader is told when a document's preview is ready (a live region kept mounted).
  const [status, setStatus] = useState('');
  const [, setPagesVersion] = useState(0);
  // The board over the app after a run (PRNTR-BOARD.md §15.2), with the run Prntr finished with: null for a
  // chain started past the room (the dev entrance)
  const [prntrBoard, setPrntrBoard] = useState<{ run: BoardRun | null; inkHex: string } | null>(null);
  // The document the certificate replaced, kept so the vortex can bring it back (PRNTR-VORTEX.md):
  // its rendered pages, name, format and the page that was open. Dropped by the next document.
  const [vortexOriginal, setVortexOriginal] = useState<OriginalDocument | null>(null);

  const storeRef = useRef(new PageStore());
  const store = storeRef.current;
  const inkRef = useRef(INKS[0].hex);
  const runToken = useRef(0);
  const pickToken = useRef(0);
  const appStateRef = useRef(appState);
  appStateRef.current = appState;
  const lastFile = useRef<File | null>(null);
  const docRef = useRef<SourceDocument | null>(null);
  const idleHandle = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const printRoot = useRef<HTMLDivElement>(null);
  const handleFileRef = useRef<(file: File) => void>(() => {});
  handleFileRef.current = (file) => void handleFile(file);
  // The easter egg's run: entered from the preview's help, it hands the app back with or without a certificate.
  const prntr = usePrntrSession({
    appState,
    setAppState,
    firstPage: () => {
      const recolored = store.ensureRecolored(0, inkRef.current);
      const source = store.getSource(0);
      return recolored && source ? { source, recolored } : null;
    },
    onEnter: () => {
      setHolding(false);
      setPrntrBoard(null);
    },
    onCertificate: loadCertificate,
    // The board comes up over the app once Prntr has gone: in the ink the app landed on after a win (the
    // certificate's), in gold after a game over, which leaves no certificate.
    onGone: (run) => setPrntrBoard({ run, inkHex: run?.won ? inkRef.current : GOLD_INK.hex }),
    onError: (err) => failTo(err, null),
  });
  // Prntr has the screen: a file dragged over it is not taken (it would end the game
  // and replace the document unseen). Nor while the app's UI is still dropping back in
  // over its last frame: the state is back already, but Prntr is still mounted.
  const inPrntr = useRef(false);
  inPrntr.current = prntr.active || prntrBoard !== null;

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
    appState === 'processing' || appState === 'preview' || (appState === 'prntr' && prntr.returnsToPreview);
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

  // Dev only: the ?prntr=N entrance and the dev panel's hooks (src/devHooks.ts). import.meta.env.DEV is a
  // build-time constant, so the hook is called on every render or on none, and a build drops the call,
  // this block and the module; vite.config.ts fails the build if its marker strings survive.
  if (import.meta.env.DEV) {
    useDevHooks({
      appState,
      inkHex: () => inkRef.current,
      enterPrntr: prntr.enter,
      loadStandIn: (page) => {
        lastFile.current = null;
        startDocument('stand-in.pdf', 'pdf');
        showSinglePage(page);
        setAppState('preview');
      },
    });
  }

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
    prntr.clearOverHold();
    if (idleHandle.current !== null) {
      cancelIdle(idleHandle.current);
      idleHandle.current = null;
    }
    releaseDocument();
    setShowPrintReminder(false);
    clearPrintImages();
    setHolding(false);
    setBusy(null);
    setNotice(null);
    setVortexOriginal(null);
    setStatus('');
    setFileName(name);
    if (exportAs) setFormat(exportAs);
    setCurrentPage(0);
    return token;
  }

  async function handleFile(file: File) {
    // The kind is read from the file's first bytes, which takes a moment: a file picked meanwhile wins.
    const pick = ++pickToken.current;
    const kind = await detectKind(file);
    if (pick !== pickToken.current) return;
    if (kind === null && appStateRef.current === 'preview') {
      // A document is open: an unsupported file is a notice over it, not the end of it.
      const err = unsupportedError(file);
      const code = classifyError(err);
      logAppError(code, err, file);
      setNotice({ kind: 'error', code });
      return;
    }
    lastFile.current = file;
    const token = startDocument(file.name, kind && exportFormat(kind));
    setPageCount(0);
    setProcessedCount(0);
    setAppState('processing');
    try {
      const doc = await loadDocument(file, kind);
      if (token !== runToken.current) {
        doc.destroy();
        return;
      }
      docRef.current = doc;
      store.reset(doc.pageCount);
      setPageCount(doc.pageCount);
      await renderPages(doc, 0, token);
    } catch (err) {
      if (token !== runToken.current) return;
      // A print or download waiting on the pages that will never come gives up.
      store.reset(0);
      failTo(err, lastFile.current);
    } finally {
      // Every page is a canvas in the store now (or the file failed): the parsed file, which pdf.js's
      // worker holds whole, has no further use. A newer document has released this one already.
      if (token === runToken.current) releaseDocument();
    }
  }

  // The document could not be opened (or the certificate could not replace it): the error card, with the
  // code that says why, and the details in the console.
  function failTo(err: unknown, file: File | null) {
    const code = classifyError(err);
    logAppError(code, err, file);
    setErrorCode(code);
    setAppState('error');
  }

  // Pages `from` to the end, in order, into the store; the first one shows the preview. Stops when a newer document starts.
  async function renderPages(doc: SourceDocument, from: number, token: number) {
    for (let i = from; i < doc.pageCount; i++) {
      let rendered;
      try {
        rendered = await doc.renderPage(i);
      } catch (err) {
        if (token !== runToken.current || i === 0) throw err;
        // A page that will not render after pages that did: the document is the pages before it, and a
        // notice says which are missing, rather than the error card over everything already rendered.
        logAppError(classifyError(err), err, lastFile.current);
        store.truncate(i);
        setPageCount(i);
        // The pager reaches pages still on their way: one opened past the cut no longer exists.
        setCurrentPage((p) => Math.min(p, i - 1));
        setNotice({ kind: 'partial', rendered: i, total: doc.pageCount });
        return;
      }
      const { canvas, sizePt } = rendered;
      if (token !== runToken.current) return;
      store.setSource(i, canvas, sizePt);
      store.ensureRecolored(i, inkRef.current);
      setProcessedCount(i + 1);
      setPagesVersion((v) => v + 1);
      if (i === 0) {
        setAppState('preview');
        setStatus(t('status.ready', { name: lastFile.current?.name ?? '', pages: tPlural('preview.pages', doc.pageCount) }));
      }
      // Yield to the UI between pages so progress and preview stay live.
      await new Promise((r) => setTimeout(r, 0));
      if (token !== runToken.current) return;
    }
  }

  // The vortex brought back a document that was won while still rendering: its file is parsed again and the pages after
  // the snapshot render behind the preview as on an upload. If that fails, the document is the pages that came back.
  async function resumeDocument(original: OriginalDocument, token: number) {
    if (!original.file) return;
    try {
      const doc = await loadDocument(original.file, await detectKind(original.file));
      if (token !== runToken.current) {
        doc.destroy();
        return;
      }
      docRef.current = doc;
      await renderPages(doc, original.pages.length, token);
    } catch (err) {
      if (token !== runToken.current) return;
      logAppError(classifyError(err), err, original.file);
      store.restore(original.pages);
      setPageCount(original.pages.length);
      setPagesVersion((v) => v + 1);
    } finally {
      if (token === runToken.current) releaseDocument();
    }
  }

  // The print root's object URLs go with the pages they showed: replaced by the next Print's, or
  // cleared by a new document or a new ink. Each holds its page's PNG until revoked.
  function replacePrintImages(next: { src: string; landscape: boolean }[]) {
    setPrintImages((pages) => {
      pages.forEach((p) => URL.revokeObjectURL(p.src));
      return next.length || pages.length ? next : pages;
    });
  }

  function clearPrintImages() {
    replacePrintImages([]);
  }

  // The pages already rendered stay in the store; only the parsed file goes.
  function releaseDocument() {
    docRef.current?.destroy();
    docRef.current = null;
  }

  // The chosen ink is a state (what the UI shows) and a ref (what the page loops read between renders):
  // the only place either is written, so they cannot drift apart.
  function chooseInk(index: number, hex: string) {
    setInkIndex(index);
    inkRef.current = hex;
  }

  function selectInk(index: number) {
    const hex = inks[index].hex;
    chooseInk(index, hex);
    // The print pages are in the old ink; the next Print makes them again.
    clearPrintImages();
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
    // Read out by a screen reader, however the page was reached (the buttons, the keys, the page field).
    if (clamped !== currentPage) setStatus(t('preview.pageOf', { page: clamped + 1, total: pageCount }));
  }

  // A document that is one ready-made page (the certificate, the dev stand-in): US Letter, in the chosen ink.
  function showSinglePage(page: HTMLCanvasElement) {
    store.reset(1);
    store.setSource(0, page, { width: 612, height: 792 });
    store.ensureRecolored(0, inkRef.current);
    setPageCount(1);
    setProcessedCount(1);
    setPagesVersion((v) => v + 1);
  }

  // The certificate becomes the loaded document: one page, a PDF to download, recoloured
  // in the chosen ink like any other. A document still processing is dropped (only its
  // rendered pages are kept for the vortex); one entered from nothing (the dev entrance) has
  // nothing to keep. A win from a certificate keeps the document the first win replaced, so the
  // vortex never brings back a certificate. The run then returns to the preview (usePrntrSession).
  function loadCertificate({ id, page }: Certificate) {
    const original: OriginalDocument | null =
      vortexOriginal ??
      (store.hasSource(currentPage)
        ? { pages: store.snapshot(), pageCount, file: lastFile.current, fileName, format, page: currentPage }
        : null);
    lastFile.current = null;
    startDocument(`prntr-certificate-${id.slice(-9).replace('-', '')}.pdf`, 'pdf');
    // the certificate comes up in gold, the secret ink, which stays on offer from here on
    setGoldUnlocked(true);
    chooseInk(INKS.length, GOLD_INK.hex);
    showSinglePage(page);
    setVortexOriginal(original);
  }

  // The vortex has swallowed the certificate: the original document comes back in its place, the
  // hold still on (startDocument clears it), so it shows in its own colours until the button is let
  // go; the chosen ink, gold, stays. The pages that had rendered come back at once; a document won while still rendering
  // renders the rest from its file (one entered without a file, the dev stand-in, is only those pages).
  function restoreOriginal() {
    const original = vortexOriginal;
    if (!original) return;
    lastFile.current = original.file;
    const token = startDocument(original.fileName, original.format);
    setHolding(true);
    const whole = original.file ? original.pageCount : original.pages.length;
    store.restore(original.pages, whole);
    setPageCount(whole);
    setProcessedCount(original.pages.length);
    const page = Math.min(original.page, original.pages.length - 1);
    setCurrentPage(page);
    store.ensureRecolored(page, inkRef.current);
    setPagesVersion((v) => v + 1);
    queueBackgroundRecolor(inkRef.current);
    if (whole > original.pages.length) void resumeDocument(original, token);
  }

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
    setShowPrintReminder(false);
    setNotice(null);
    setBusy('print');
    try {
      const pages = await collectAllRecolored(token);
      const urls = await Promise.all(pages.map((p) => pngUrl(p.canvas)));
      if (token !== runToken.current) {
        urls.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      flushSync(() => replacePrintImages(urls.map((src, i) => ({ src, landscape: pages[i].canvas.width > pages[i].canvas.height }))));
      // The dialog snapshots the page: every image must be decoded by then, or it prints blank.
      // A decode that never settles would otherwise hold both buttons until the next file.
      const images = Array.from(printRoot.current?.querySelectorAll('img') ?? []);
      await Promise.race([
        Promise.all(images.map((img) => img.decode().catch(() => undefined))),
        new Promise((resolve) => setTimeout(resolve, PRINT_DECODE_MS)),
      ]);
      if (token !== runToken.current) return;
      window.print();
      // Back from the dialog (at once where the browser does not wait): the fallback for a grey print.
      if (token === runToken.current) setShowPrintReminder(true);
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
    setNotice(null);
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
    setNotice({ kind: 'error', code });
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
        className={'no-print' + (prntr.drop === 'sky' ? ' is-sky-drop' : prntr.drop === 'tetris' ? ' is-tetris-drop' : '')}
        onAnimationEnd={(e) => {
          // The sky drop animates .no-print itself; the Tetris drop's last piece is the header.
          const landed = prntr.drop === 'tetris' ? (e.target as HTMLElement).classList.contains('header') : e.target === e.currentTarget;
          if (landed) prntr.land();
        }}
      >
        <Header />
        <div className="sr-only" role="status">
          {status}
        </div>
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
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            showReminder={showPrintReminder}
            onDismissReminder={() => setShowPrintReminder(false)}
            onOpenPrntr={() => prntr.enter(0)}
            onPrefetchPrntr={prefetchPrntr}
          />
        )}
        {appState === 'error' && (
          <ErrorState
            code={errorCode}
            onFile={(f) => void handleFile(f)}
            onChoose={openPicker}
            onRetry={handleRetry}
          />
        )}
        {dragging && appState === 'preview' && (
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
      {prntr.active && prntr.page && (
        <PrntrHost
          source={prntr.page.source}
          recolored={prntr.page.recolored}
          inkHex={inkHex}
          stage={prntr.stage}
          audioContext={prntr.audio}
          onExit={prntr.exit}
          onDone={prntr.finish}
        />
      )}
      {prntrBoard && <PrntrBoardHost run={prntrBoard.run} inkHex={prntrBoard.inkHex} onClose={() => setPrntrBoard(null)} />}
      {import.meta.env.DEV && DevPanel && (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      )}
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={onInputChange}
      />
      <div className="print-root" ref={printRoot} aria-hidden="true">
        {printImages.map((p, i) => (
          <img key={i} src={p.src} alt="" className={p.landscape ? 'is-landscape' : undefined} />
        ))}
      </div>
    </div>
  );
}
