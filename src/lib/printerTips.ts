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
