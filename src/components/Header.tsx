import { t } from '../i18n';

export function Header() {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-square" aria-hidden="true" />
        <span className="wordmark">PrintAnyway App</span>
        {/*   = thin space; the tagline reads as a continuation of the wordmark */}
        <span className="tagline">{' '}{t('header.tagline')}</span>
      </div>
      <span className="header-formats">{t('header.formats')}</span>
    </header>
  );
}
