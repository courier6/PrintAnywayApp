import { DropZone } from './DropZone';
import type { ErrorCode } from '../lib/errors';

export type ErrorKind =
  | 'unsupported'
  | 'password'
  | 'damaged-pdf'
  | 'heic'
  | 'image'
  | 'memory'
  | 'processing';

interface Props {
  kind: ErrorKind;
  code: ErrorCode;
  onFile: (file: File) => void;
  onChoose: () => void;
  onRetry: () => void;
}

// retry: offered only where trying the same file again can plausibly help.
const COPY: Record<ErrorKind, { title: string; body: string; retry: boolean }> = {
  unsupported: {
    title: "This file type isn't supported yet.",
    body: 'PrintAnyway App works with PDF, PNG, JPG, and HEIC (iPhone photos).',
    retry: false,
  },
  password: {
    title: 'This PDF is password-protected.',
    body: 'Open it in your PDF viewer, use "Print → Save as PDF" to make an unlocked copy, then drop that here.',
    retry: false,
  },
  'damaged-pdf': {
    title: "This PDF couldn't be read.",
    body: 'The file may be incomplete or damaged. Try re-downloading or re-exporting it.',
    retry: true,
  },
  heic: {
    title: "This photo couldn't be converted.",
    body: 'The HEIC file may be damaged. Screenshot the photo, or export it as JPG, and try that instead.',
    retry: false,
  },
  image: {
    title: "This image couldn't be read.",
    body: 'The file may be damaged. Re-export or re-save the image and try again.',
    retry: true,
  },
  memory: {
    title: 'This file is too large for this device.',
    body: "Close other tabs or try a smaller file — big page sizes need more memory than the browser could give.",
    retry: true,
  },
  processing: {
    title: 'Something went wrong while recoloring.',
    body: "It's usually temporary — try the same file again, or choose a different one.",
    retry: true,
  },
};

export function ErrorState({ kind, code, onFile, onChoose, onRetry }: Props) {
  const { title, body, retry } = COPY[kind];
  return (
    <div className="state-pad">
      <DropZone onFile={onFile} onChoose={onChoose}>
        <div className="error-card">
          <div className="error-title">{title}</div>
          <div className="error-body">{body}</div>
          <div className="error-actions">
            {retry ? (
              <>
                <button className="btn-primary" onClick={onRetry}>
                  Try again
                </button>
                <button className="btn-secondary" onClick={onChoose}>
                  Choose a different file
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={onChoose}>
                Choose a different file
              </button>
            )}
          </div>
          <div className="error-code">Error code {code}</div>
        </div>
      </DropZone>
    </div>
  );
}
