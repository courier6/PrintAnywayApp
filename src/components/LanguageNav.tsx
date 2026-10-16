import type { MouseEvent } from 'react';
import { setLocale, t, useLocale } from '../i18n';
import { LOCALES, localePath, type Locale } from '../i18n/locales';

/**
 * Links to each language's page. index.html's static copy has the same markup
 * (vite.config.ts). A plain click switches language in place instead of
 * loading the page, so a document the user has open isn't lost.
 */
export function LanguageNav() {
  const current = useLocale();
  if (LOCALES.length < 2) return null;

  function onClick(e: MouseEvent<HTMLAnchorElement>, l: Locale) {
    // Let the browser handle new-tab/window clicks.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (l === current) return;
    history.pushState(null, '', localePath(l));
    setLocale(l);
  }

  return (
    <nav className="lang-nav" aria-label={t('lang.label')}>
      {LOCALES.map((l) => (
        <a
          key={l.code}
          href={localePath(l)}
          hrefLang={l.code}
          lang={l.code}
          aria-current={l === current ? 'page' : undefined}
          onClick={(e) => onClick(e, l)}
        >
          {l.name}
        </a>
      ))}
    </nav>
  );
}
