import { locale, t } from '../i18n';
import { LOCALES, localePath } from '../i18n/locales';

/** Links to each language's page. index.html's static copy has the same markup (vite.config.ts). */
export function LanguageNav() {
  if (LOCALES.length < 2) return null;
  return (
    <nav className="lang-nav" aria-label={t('lang.label')}>
      {LOCALES.map((l) => (
        <a
          key={l.code}
          href={localePath(l)}
          hrefLang={l.code}
          lang={l.code}
          aria-current={l === locale ? 'page' : undefined}
        >
          {l.name}
        </a>
      ))}
    </nav>
  );
}
