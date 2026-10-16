export interface Ink {
  /** Key in src/i18n/en.properties. */
  nameKey: string;
  hex: string;
}

/** User-selectable substitute inks; navy is the default. */
export const INKS: readonly Ink[] = [
  { nameKey: 'ink.navy', hex: '#1e3a5f' },
  { nameKey: 'ink.teal', hex: '#0f4c47' },
  { nameKey: 'ink.maroon', hex: '#5e1f2e' },
  { nameKey: 'ink.purple', hex: '#44286b' },
];
