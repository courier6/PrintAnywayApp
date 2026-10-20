export interface Ink {
  /** Key in src/i18n/en.properties. */
  nameKey: string;
  hex: string;
  /** The swatch's face when it is not just the hex (gold's shine). */
  swatch?: string;
}

/** User-selectable substitute inks; navy is the default. */
export const INKS: readonly Ink[] = [
  { nameKey: 'ink.navy', hex: '#1e3a5f' },
  { nameKey: 'ink.teal', hex: '#0f4c47' },
  { nameKey: 'ink.maroon', hex: '#5e1f2e' },
  { nameKey: 'ink.purple', hex: '#44286b' },
];

/**
 * The secret ink (Edgar, 2026-10-20): gold, unlocked when Prntr's room is won and shown after
 * the other four until the page is reloaded. The certificate of completion comes up in it. Not
 * a printable thing: the recolouring gives it a shine (src/lib/recolor.ts).
 */
export const GOLD_INK: Ink = { nameKey: 'ink.gold', hex: '#c9a227', swatch: 'linear-gradient(135deg, #fff3b8 0%, #f3c64a 35%, #a8821c 60%, #ffe98a 100%)' };
