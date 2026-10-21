import { t } from '../i18n';
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

// Title and body come from error.<kind>.title / .body in src/i18n/en.properties.
// retry: offered only where trying the same file again can plausibly help.
const RETRY: Record<ErrorKind, boolean> = {
  unsupported: false,
  password: false,
  'damaged-pdf': false,
  heic: false,
  image: true,
  memory: true,
  processing: true,
};

export function ErrorState({ kind, code, onFile, onChoose, onRetry }: Props) {
  const retry = RETRY[kind];
  return (
    <div className="state-pad">
      <DropZone onFile={onFile} onChoose={onChoose}>
        <div className="error-card">
          <div className="error-title">{t(`error.${kind}.title`)}</div>
          <div className="error-body">{t(`error.${kind}.body`)}</div>
          <div className="error-actions">
            {retry ? (
              <>
                <button className="btn-primary" onClick={onRetry}>
                  {t('error.tryAgain')}
                </button>
                <button className="btn-secondary" onClick={onChoose}>
                  {t('error.chooseDifferent')}
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={onChoose}>
                {t('error.chooseDifferent')}
              </button>
            )}
          </div>
          <div className="error-code">{t('error.code', { code })}</div>
        </div>
      </DropZone>
    </div>
  );
}
