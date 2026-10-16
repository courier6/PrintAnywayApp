import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/** Throws unless every translation has exactly the English keys and placeholders. */
function validateLocales(): void {
  const en = loadStrings(DEFAULT_LOCALE);
  const problems: string[] = [];
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const strings = loadStrings(locale);
    for (const key of Object.keys(en)) {
      if (!(key in strings)) problems.push(`${locale.code}: missing "${key}"`);
      else if (strings[key] === '') problems.push(`${locale.code}: empty "${key}"`);
      else if (placeholders(strings[key]) !== placeholders(en[key]))
        problems.push(`${locale.code}: "${key}" placeholders differ from English`);
    }
    for (const key of Object.keys(strings)) {
      if (!(key in en)) problems.push(`${locale.code}: unknown key "${key}"`);
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

function sitemap(): string {
  const lastmod = new Date().toISOString().slice(0, 10);
  const alternates = [
    ...LOCALES.flatMap((l) => l.hreflang.map((h) => [h, absoluteUrl(l)])),
    ['x-default', absoluteUrl(DEFAULT_LOCALE)],
  ]
    .map(([h, href]) => `    <xhtml:link rel="alternate" hreflang="${h}" href="${href}"/>`)
    .join('\n');
  const urls = LOCALES.map(
    (l) => `  <url>\n    <loc>${absoluteUrl(l)}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alternates}\n  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

/** The locale for a dev-server request: /es/ or ?lang=es, else English. */
function devLocale(url: string): Locale {
  const { pathname, searchParams } = new URL(url, 'http://localhost');
  const segment = pathname.split('/')[1];
  const lang = searchParams.get('lang');
  return (
    LOCALES.find((l) => l.code === lang || (l.path !== '' && l.path === segment)) ?? DEFAULT_LOCALE
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
    closeBundle() {
      if (!isBuild) return;
      const template = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      for (const locale of LOCALES) {
        const dir = resolve(outDir, locale.path);
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, 'index.html'), renderHtml(template, locale, loadStrings(locale)));
      }
      writeFileSync(resolve(outDir, 'sitemap.xml'), sitemap());
    },
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('.properties')) return;
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
