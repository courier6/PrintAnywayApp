import { t } from '../i18n';
import { PageCanvas } from './PageCanvas';

interface Props {
  firstPage: HTMLCanvasElement | null;
  done: number;
  total: number;
}

export function ProcessingState({ firstPage, done, total }: Props) {
  const pct = total > 0 ? Math.max(4, Math.round((done / total) * 100)) : 4;
  const label =
    total === 0
      ? t('processing.reading')
      : done >= total
        ? t('processing.finishing')
        : t('processing.page', { page: done + 1, total });

  return (
    <div className="processing-area">
      {firstPage && <PageCanvas canvas={firstPage} className="processing-page" />}
      <div className="progress-unit" role="status">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-label">{label}</div>
        {firstPage && (
          <div className="progress-sub">{t('processing.firstPage')}</div>
        )}
      </div>
    </div>
  );
}
