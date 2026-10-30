import { t } from '../i18n';
import { PRINTER_TIPS } from '../lib/printerTips';
import { DropZone } from './DropZone';

interface Props {
  onFile: (file: File) => void;
  onChoose: () => void;
}

export function EmptyState({ onFile, onChoose }: Props) {
  return (
    <div className="state-pad">
      <DropZone onFile={onFile} onChoose={onChoose}>
        <h1 className="hero-headline">{t('empty.headline')}</h1>
        <p className="hero-subline">{t('empty.subline')}</p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={onChoose}>
            {t('empty.choose')}
          </button>
          <span className="hero-formats">{t('empty.formats')}</span>
        </div>
      </DropZone>
      <div className="below-zone">
        <span className="privacy-line">{t('empty.privacy')}</span>
      </div>
      <details className="printer-tips">
        <summary>
          {t('empty.tipsLead')}{' '}
          <span className="printer-tips-link">{t('empty.tipsLink')}</span>
        </summary>
        <dl className="printer-tips-list">
          {PRINTER_TIPS.map((tip) => (
            <div key={tip.brand}>
              <dt>{tip.brand}</dt>
              <dd>{t(tip.tipKey)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
