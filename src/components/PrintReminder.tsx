import { t, tRich } from '../i18n';

interface Props {
  onDismiss: () => void;
}

export function PrintReminder({ onDismiss }: Props) {
  return (
    <div className="print-reminder" role="status">
      <div className="print-reminder-text">
        <strong>{t('printReminder.lead')}</strong>{' '}
        {tRich('printReminder.body', { color: <strong>{t('printReminder.color')}</strong> })}
      </div>
      <button className="btn-outline-small" onClick={onDismiss}>
        {t('printReminder.dismiss')}
      </button>
    </div>
  );
}
