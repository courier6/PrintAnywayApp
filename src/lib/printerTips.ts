export interface PrinterTip {
  brand: string;
  /** Key in src/i18n/en.properties. */
  tipKey: string;
}

/** Per-brand ways to get a printer past an empty black cartridge. */
export const PRINTER_TIPS: readonly PrinterTip[] = [
  { brand: 'HP', tipKey: 'tips.hp' },
  { brand: 'Epson', tipKey: 'tips.epson' },
  { brand: 'Canon', tipKey: 'tips.canon' },
];

/**
 * The fourth item of the preview's help accordion: cross-brand advice ending in the
 * way into Prntr (PRNTR-TRIGGER.md). English only, by decision (2026-10-19): it is
 * shown only while the UI locale is English, so it is not in the .properties files.
 */
export const OTHER_TIP = {
  label: 'Other',
  body1:
    'Most printers refuse for the same reason: one cartridge reports empty, so the printer stops the whole job instead of printing without it. Brother, Lexmark, Samsung and most others have a way past this.',
  body2:
    'Take the black cartridge out and put it back in, then look in the printer\u2019s menu or its app for a setting called \u201ccontinue\u201d, \u201cignore cartridge\u201d or \u201cbackup mode\u201d. If it only started refusing after an update, the maker\u2019s support site usually says how to turn the cartridge check off.',
  /** The last sentence; `link` is the clickable part, rendered as a button after `lead`. The sentence is not
   * advice and should not read as advice; the link looks plain until it has the pointer (RisingGlyphs). */
  lead: 'And if none of that works, we understand. Everyone who has stood over a printer at 11 pm has wanted to do one thing to it, and here, for once, ',
  link: 'you can',
  tail: '.',
} as const;
