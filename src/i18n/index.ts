import { createElement, Fragment, type ReactNode } from 'react';
import en from './en.properties';

// Only English for now; later, pick by navigator.language with English fallback.
const strings = en;
const plural = new Intl.PluralRules('en');

type Params = Record<string, string | number>;

function lookup(key: string): string {
  const value = strings[key];
  if (value === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key "${key}"`);
    return key;
  }
  return value;
}

/** The string for `key`, with each {name} replaced from `params`. */
export function t(key: string, params?: Params): string {
  const value = lookup(key);
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

/** Picks `key.one`, `key.other`, … for `count`; {count} is filled in. */
export function tPlural(key: string, count: number, params?: Params): string {
  const form = `${key}.${plural.select(count)}`;
  return t(form in strings ? form : `${key}.other`, { count, ...params });
}

/** Like t(), but {name} placeholders are replaced with React nodes. */
export function tRich(key: string, nodes: Record<string, ReactNode>): ReactNode {
  // split() with a capture group puts placeholder names at the odd indexes.
  const parts = lookup(key)
    .split(/\{(\w+)\}/)
    .map((part, i) => (i % 2 === 1 ? (nodes[part] ?? `{${part}}`) : part));
  // Spread as children so React doesn't ask for keys.
  return createElement(Fragment, null, ...parts);
}
