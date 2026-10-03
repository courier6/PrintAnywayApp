// Error codes surface subtly in the error card so a user report ("it said
// PA-102") is enough for the owner to know what failed. Diagnostics stay in
// the browser console — this app makes no network calls.
export type ErrorCode =
  | 'PA-100' // unknown / unclassified
  | 'PA-101' // unsupported file type
  | 'PA-102' // password-protected PDF
  | 'PA-103' // damaged / unreadable PDF
  | 'PA-104' // HEIC decode failure
  | 'PA-105' // image decode failure
  | 'PA-106'; // out of memory / canvas unavailable

export class UnsupportedFileError extends Error {
  constructor() {
    super('Unsupported file type');
    this.name = 'UnsupportedFileError';
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

// pdf.js rejections are matched by name rather than instanceof so its
// exception classes never need to be imported on the happy path.
export function classifyError(err: unknown): ErrorCode {
  if (err instanceof UnsupportedFileError) return 'PA-101';
  if (err instanceof HeicDecodeError) return 'PA-104';
  if (err instanceof ImageDecodeError) return 'PA-105';
  // pdf.js's BaseException doesn't reliably extend Error, so match by name
  // on anything object-shaped.
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'PasswordException') return 'PA-102';
  if (name === 'InvalidPDFException') return 'PA-103';
  if (
    (err instanceof Error && err.message === 'Canvas 2D context unavailable') ||
    err instanceof RangeError ||
    err instanceof DOMException
  ) {
    return 'PA-106';
  }
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
