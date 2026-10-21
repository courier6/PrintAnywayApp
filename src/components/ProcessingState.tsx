import { t } from '../i18n';

interface Props {
  done: number;
  total: number;
}

// Shown only until page 1 is ready: the preview takes over then, and tracks the rest.
export function ProcessingState({ done, total }: Props) {
  const pct = total > 0 ? Math.max(4, Math.round((done / total) * 100)) : 4;
  const label = total === 0 ? t('processing.reading') : t('processing.page', { page: done + 1, total });

  return (
    <div className="processing-area">
      <div className="progress-unit" role="status">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-label">{label}</div>
      </div>
    </div>
  );
}
