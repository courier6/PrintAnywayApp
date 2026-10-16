/**
 * The languages the site ships in. Each one gets its own page at /<path>/,
 * built from index.html and src/i18n/<code>.properties (see vite.config.ts).
 * Shared by the browser bundle and vite.config.ts, so it must stay import-free.
 * Add a row only once its .properties file is fully translated.
 */
export interface Locale {
  /** BCP 47 tag: <html lang>, Intl.PluralRules and the .properties file name. */
  code: string;
  /** URL path segment; '' for the English root. */
  path: string;
  /** Values for <link rel="alternate" hreflang>. */
  hreflang: readonly string[];
  /** Open Graph locale, language_TERRITORY. */
  ogLocale: string;
  /** Native name, shown in the language picker. */
  name: string;
}

export const LOCALES: readonly Locale[] = [
  { code: 'en', path: '', hreflang: ['en'], ogLocale: 'en_US', name: 'English' },
  { code: 'es', path: 'es', hreflang: ['es'], ogLocale: 'es_ES', name: 'Español' },
  { code: 'pt-BR', path: 'pt-br', hreflang: ['pt-BR', 'pt'], ogLocale: 'pt_BR', name: 'Português' },
  { code: 'fr', path: 'fr', hreflang: ['fr'], ogLocale: 'fr_FR', name: 'Français' },
  { code: 'de', path: 'de', hreflang: ['de'], ogLocale: 'de_DE', name: 'Deutsch' },
];

export const DEFAULT_LOCALE = LOCALES[0];

export const SITE = 'https://printanyway.app';

/** Root-relative URL of a locale's page, always with a trailing slash. */
export function localePath(locale: Locale): string {
  return locale.path ? `/${locale.path}/` : '/';
}
