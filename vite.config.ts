import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { parseProperties } from './src/i18n/properties';
import { DEFAULT_LOCALE, LOCALES, SITE, localePath, type Locale } from './src/i18n/locales';

const I18N_DIR = fileURLToPath(new URL('./src/i18n/', import.meta.url));

type Strings = Record<string, string>;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Escapes `s` for use inside a JSON string literal (the JSON-LD block). */
function escapeJson(s: string): string {
  return JSON.stringify(s).slice(1, -1).replace(/</g, '\\u003c');
}

function loadStrings(locale: Locale): Strings {
  return parseProperties(readFileSync(resolve(I18N_DIR, `${locale.code}.properties`), 'utf8'));
}

function placeholders(value: string): string {
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
}

const PLURAL_FORM = /^(.+)\.(zero|one|two|few|many|other)$/;

/**
 * The plural forms a locale must translate: every CLDR category a whole
 * number reaches (es/fr/pt "many" starts at 1,000,000, so it isn't required),
 * plus "other", which tPlural falls back to.
 */
function requiredPluralForms(code: string): Set<string> {
  const rules = new Intl.PluralRules(code);
  const forms = new Set(['other']);
  for (let n = 0; n <= 1000; n++) forms.add(rules.select(n));
  return forms;
}

/**
 * Throws unless every locale file (English included) has the English keys
 * with the same placeholders and no empty values. Plural keys (base.one,
 * base.other, …) follow each locale's own CLDR categories instead.
 */
function validateLocales(): void {
  const en = loadStrings(DEFAULT_LOCALE);
  // Plural bases: keys like preview.pages that have a .other form in English.
  const pluralBases = new Set(
    Object.keys(en).flatMap((key) => {
      const m = PLURAL_FORM.exec(key);
      return m && `${m[1]}.other` in en ? [m[1]] : [];
    }),
  );
  const pluralBase = (key: string) => {
    const m = PLURAL_FORM.exec(key);
    return m && pluralBases.has(m[1]) ? { base: m[1], form: m[2] } : null;
  };
  const problems: string[] = [];
  for (const locale of LOCALES) {
    const strings = loadStrings(locale);
    const allowed = new Intl.PluralRules(locale.code).resolvedOptions().pluralCategories as string[];
    for (const key of Object.keys(en)) {
      if (!pluralBase(key) && !(key in strings)) problems.push(`${locale.code}: missing "${key}"`);
    }
    for (const base of pluralBases) {
      for (const form of requiredPluralForms(locale.code)) {
        if (!(`${base}.${form}` in strings)) problems.push(`${locale.code}: missing "${base}.${form}"`);
      }
    }
    for (const [key, value] of Object.entries(strings)) {
      const plural = pluralBase(key);
      // Every plural form is checked against the English "other" form.
      const english = plural ? en[`${plural.base}.other`] : en[key];
      if (english === undefined) problems.push(`${locale.code}: unknown key "${key}"`);
      else if (plural && !allowed.includes(plural.form))
        problems.push(`${locale.code}: "${key}" is not a plural form of ${locale.code} (${allowed.join(', ')})`);
      else if (value === '') problems.push(`${locale.code}: empty "${key}"`);
      else if (placeholders(value) !== placeholders(english))
        problems.push(`${locale.code}: "${key}" placeholders differ from English`);
    }
  }
  if (problems.length) throw new Error(`Translation check failed:\n  ${problems.join('\n  ')}`);
}

const absoluteUrl = (locale: Locale) => SITE + localePath(locale);

/** Same markup as src/components/LanguageNav.tsx. */
function languageNav(current: Locale, strings: Strings): string {
  if (LOCALES.length < 2) return '';
  const links = LOCALES.map((l) => {
    const currentAttr = l === current ? ' aria-current="page"' : '';
    return `<a href="${localePath(l)}" hreflang="${l.code}" lang="${l.code}"${currentAttr}>${escapeHtml(l.name)}</a>`;
  });
  return `<nav class="lang-nav" aria-label="${escapeHtml(strings['lang.label'])}">${links.join('')}</nav>`;
}

/**
 * Fills index.html's tokens for one locale:
 * {{t:key}} (HTML-escaped string), {{tj:key}} (JSON-escaped string), {{lang}},
 * {{url}}, {{og_locale}}, {{og_locale_alternates}}, {{alternates}}, {{lang_nav}}.
 */
function renderHtml(html: string, locale: Locale, strings: Strings): string {
  return html.replace(/\{\{(\w+)(?::([\w.-]+))?\}\}/g, (token, name: string, key?: string) => {
    if (name === 't' || name === 'tj') {
      if (!key || !(key in strings)) throw new Error(`index.html: unknown string key in ${token}`);
      return name === 't' ? escapeHtml(strings[key]) : escapeJson(strings[key]);
    }
    switch (name) {
      case 'lang':
        return locale.code;
      case 'url':
        return absoluteUrl(locale);
      case 'og_locale':
        return locale.ogLocale;
      case 'og_locale_alternates':
        return LOCALES.filter((l) => l !== locale)
          .map((l) => `<meta property="og:locale:alternate" content="${l.ogLocale}" />`)
          .join('\n    ');
      case 'alternates':
        return [
          ...LOCALES.flatMap((l) => l.hreflang.map((h) => [h, absoluteUrl(l)])),
          ['x-default', absoluteUrl(DEFAULT_LOCALE)],
        ]
          .map(([h, href]) => `<link rel="alternate" hreflang="${h}" href="${href}" />`)
          .join('\n    ');
      case 'lang_nav':
        return languageNav(locale, strings);
      default:
        throw new Error(`index.html: unknown token ${token}`);
    }
  });
}

/**
 * The date a locale's page last changed: the newest commit touching index.html
 * or its .properties file. Needs full git history (deploy.yml fetch-depth: 0);
 * falls back to today without git.
 */
function lastModified(locale: Locale): string {
  try {
    const date = execFileSync(
      'git',
      ['log', '-1', '--format=%cs', '--', 'index.html', `src/i18n/${locale.code}.properties`],
      { encoding: 'utf8' },
    ).trim();
    if (date) return date;
  } catch {
    // No git (e.g. a source tarball).
  }
  return new Date().toISOString().slice(0, 10);
}

function sitemap(): string {
  const alternates = [
    ...LOCALES.flatMap((l) => l.hreflang.map((h) => [h, absoluteUrl(l)])),
    ['x-default', absoluteUrl(DEFAULT_LOCALE)],
  ]
    .map(([h, href]) => `    <xhtml:link rel="alternate" hreflang="${h}" href="${href}"/>`)
    .join('\n');
  const urls = LOCALES.map(
    (l) => `  <url>\n    <loc>${absoluteUrl(l)}</loc>\n    <lastmod>${lastModified(l)}</lastmod>\n${alternates}\n  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

/** The locale for a dev-server request: ?lang=es overrides the /es/ path; else English. */
function devLocale(url: string): Locale {
  const { pathname, searchParams } = new URL(url, 'http://localhost');
  const segment = pathname.split('/')[1];
  const lang = searchParams.get('lang');
  return (
    LOCALES.find((l) => l.code === lang) ??
    LOCALES.find((l) => l.path !== '' && l.path === segment) ??
    DEFAULT_LOCALE
  );
}

/**
 * Lets the app `import strings from './en.properties'`, checks translations,
 * and builds one page per locale from index.html: dist/index.html for English
 * and dist/<path>/index.html for the others, plus dist/sitemap.xml.
 */
function i18nPlugin(): Plugin {
  let outDir = '';
  let isBuild = false;
  return {
    name: 'i18n',
    configResolved(config) {
      if (config.base !== '/') throw new Error('i18n: locale URLs assume base "/"; see localePath() in src/i18n/locales.ts');
      outDir = resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },
    buildStart() {
      validateLocales();
    },
    transform(code, id) {
      if (!id.endsWith('.properties')) return null;
      return { code: `export default ${JSON.stringify(parseProperties(code))};`, map: null };
    },
    transformIndexHtml(html, ctx) {
      // In a build the tokens are filled per locale in closeBundle.
      if (!ctx.server) return html;
      const locale = devLocale(ctx.originalUrl ?? ctx.path);
      return renderHtml(html, locale, loadStrings(locale));
    },
    // Also called on failed builds (with the error) and when the dev server
    // closes; only a finished build has a dist/index.html to copy.
    closeBundle(error?: Error) {
      if (!isBuild || error) return;
      const file = resolve(outDir, 'index.html');
      if (!existsSync(file)) throw new Error(`i18n: ${file} was not written`);
      const template = readFileSync(file, 'utf8');
      for (const locale of LOCALES) {
        const dir = resolve(outDir, locale.path);
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, 'index.html'), renderHtml(template, locale, loadStrings(locale)));
      }
      writeFileSync(resolve(outDir, 'sitemap.xml'), sitemap());
    },
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('.properties')) return;
      // Report translation problems in the terminal without stopping the dev server.
      try {
        validateLocales();
      } catch (e) {
        server.config.logger.error(e instanceof Error ? e.message : String(e));
      }
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

export default defineConfig({
  // Served from https://printanyway.app/
  base: '/',
  plugins: [i18nPlugin(), react()],
});
