// Error codes surface subtly in the error card so a user report ("it said
// PA-102") is enough for the owner to know what failed. Diagnostics stay in
// the browser console — this app makes no network calls. (Prntr's global
// leaderboard, once built, will be the first: see CONTENT_SECURITY_POLICY in vite.config.ts.)
export type ErrorCode =
  | 'PA-100' // unknown / unclassified
  | 'PA-101' // unsupported file type
  | 'PA-102' // password-protected PDF
  | 'PA-103' // damaged / unreadable PDF
  | 'PA-104' // HEIC decode failure
  | 'PA-105' // image decode failure
  | 'PA-106' // out of memory / canvas unavailable
  | 'PA-107' // browser too old for pdf.js
  | 'PA-108'; // an office or text document: it has to be saved as a PDF first

/** Which message the error card and the notices show: error.<kind>.title / .body in the .properties files. */
export type ErrorKind =
  | 'unsupported'
  | 'password'
  | 'damaged-pdf'
  | 'heic'
  | 'image'
  | 'memory'
  | 'old-browser'
  | 'office'
  | 'processing';

const KIND_BY_CODE: Record<ErrorCode, ErrorKind> = {
  'PA-100': 'processing',
  'PA-101': 'unsupported',
  'PA-102': 'password',
  'PA-103': 'damaged-pdf',
  'PA-104': 'heic',
  'PA-105': 'image',
  'PA-106': 'memory',
  'PA-107': 'old-browser',
  'PA-108': 'office',
};

/** The message for a code: each code has exactly one, so only the code is ever stored. */
export function kindOf(code: ErrorCode): ErrorKind {
  return KIND_BY_CODE[code];
}

export class UnsupportedFileError extends Error {
  constructor() {
    super('Unsupported file type');
    this.name = 'UnsupportedFileError';
  }
}

/** A Word, Excel, PowerPoint, OpenDocument, iWork or text file: not opened here, but one "Save as PDF" away. */
export class OfficeFileError extends Error {
  constructor() {
    super('Office or text document');
    this.name = 'OfficeFileError';
  }
}

export class HeicDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeicDecodeError';
  }
}

export class ImageDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageDecodeError';
  }
}

/** A PDF that parses but has no pages: as good as damaged. */
export class EmptyPdfError extends Error {
  constructor() {
    super('PDF has no pages');
    this.name = 'EmptyPdfError';
  }
}

/** The browser gave a canvas no 2D context: the page is too large for it, or memory has run out. */
export class CanvasUnavailableError extends Error {
  constructor() {
    super('Canvas 2D context unavailable');
    this.name = 'CanvasUnavailableError';
  }
}

/** The browser lacks what pdf.js needs: no PDF will open in it, whatever the file. */
export class BrowserTooOldError extends Error {
  constructor(message = 'Browser too old for pdf.js') {
    super(message);
    this.name = 'BrowserTooOldError';
  }
}

// pdf.js rejections are matched by name rather than instanceof so its
// exception classes never need to be imported on the happy path.
export function classifyError(err: unknown): ErrorCode {
  if (err instanceof UnsupportedFileError) return 'PA-101';
  if (err instanceof OfficeFileError) return 'PA-108';
  if (err instanceof HeicDecodeError) return 'PA-104';
  if (err instanceof ImageDecodeError) return 'PA-105';
  if (err instanceof BrowserTooOldError) return 'PA-107';
  // pdf.js's BaseException doesn't reliably extend Error, so match by name
  // on anything object-shaped.
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'PasswordException') return 'PA-102';
  if (name === 'InvalidPDFException' || err instanceof EmptyPdfError) return 'PA-103';
  if (
    err instanceof CanvasUnavailableError ||
    err instanceof RangeError ||
    (err instanceof DOMException && err.name === 'QuotaExceededError')
  ) {
    return 'PA-106';
  }
  // Any other DOMException is not memory: a file moved or deleted since it was
  // picked, or a cloud placeholder not downloaded yet (NotReadableError,
  // NotFoundError) reads fine on a second try.
  return 'PA-100';
}

export function logAppError(code: ErrorCode, err: unknown, file: File | null): void {
  const shaped = err as { name?: unknown; message?: unknown } | null;
  console.error(
    '[PrintAnyway App]',
    {
      code,
      errorName: typeof shaped?.name === 'string' ? shaped.name : typeof err,
      message: typeof shaped?.message === 'string' ? shaped.message : String(err),
      fileName: file?.name,
      fileType: file?.type,
      fileSizeKB: file ? Math.round(file.size / 1024) : undefined,
      ua: navigator.userAgent,
      when: new Date().toISOString(),
    },
    err,
  );
}
