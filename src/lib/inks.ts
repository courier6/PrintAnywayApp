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

/** An ink that is not one colour: the page shifts between `ramps` along diagonal bands (src/lib/recolor.ts). */
export interface SheenInk extends Ink {
  /** Each ramp's pale, middle and deep colour; paper white comes before them. */
  ramps: readonly [pale: string, middle: string, deep: string][];
  /** The width of one band, in pixels of a page 1224 px wide. */
  sheenPeriod: number;
}

/**
 * The secret ink: gold, unlocked when Prntr's room is won and shown after
 * the other four until the page is reloaded. The certificate of completion comes up in it. Not
 * a printable thing: its ramp runs paper → pale gold → gold → deep gold, and a sheen sweeps across
 * the page between the two ramps. Unrealistic on purpose.
 */
export const GOLD_INK: SheenInk = {
  nameKey: 'ink.gold',
  hex: '#c9a227',
  swatch: 'linear-gradient(135deg, #fff3b8 0%, #f3c64a 35%, #a8821c 60%, #ffe98a 100%)',
  ramps: [
    ['#fff1b3', '#e2b53a', '#7a5a10'],
    ['#fff8d6', '#f7d262', '#a8821c'],
  ],
  sheenPeriod: 420,
};
