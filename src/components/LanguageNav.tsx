import { useState, type MouseEvent } from 'react';
import { offeredLocale, rememberLanguageChoice, setLocale, stringIn, t, useLocale } from '../i18n';
import { LOCALES, localePath, type Locale } from '../i18n/locales';

/**
 * Links to each language's page. index.html's static copy has the same markup
 * (vite.config.ts). A plain click switches language in place instead of
 * loading the page, so a document the user has open isn't lost.
 *
 * Before the links, once: an offer of the browser's own language when the page is in another one,
 * written in the language it offers. Not in the static copy, which cannot know the browser.
 */
export function LanguageNav() {
  const current = useLocale();
  const [offerClosed, setOfferClosed] = useState(false);
  if (LOCALES.length < 2) return null;
  const offer = offerClosed ? null : offeredLocale(current);

  function onClick(e: MouseEvent<HTMLAnchorElement>, l: Locale) {
    // Either way the visitor has chosen a language: the offer is not made again.
    rememberLanguageChoice();
    // Let the browser handle new-tab/window clicks.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (l === current) return;
    history.pushState(null, '', localePath(l));
    setLocale(l);
  }

  function closeOffer() {
    rememberLanguageChoice();
    setOfferClosed(true);
  }

  return (
    <nav className="lang-nav" aria-label={t('lang.label')}>
      {offer && (
        <span className="lang-offer" lang={offer.code}>
          <a href={localePath(offer)} hrefLang={offer.code} lang={offer.code} onClick={(e) => onClick(e, offer)}>
            {stringIn(offer, 'lang.offer')}
          </a>
          <button type="button" aria-label={stringIn(offer, 'lang.offerDismiss')} onClick={closeOffer}>
            ×
          </button>
        </span>
      )}
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
