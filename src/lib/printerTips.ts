export interface PrinterTip {
  brand: string;
  tip: string;
}

/** Per-brand ways to get a printer past an empty black cartridge. */
export const PRINTER_TIPS: readonly PrinterTip[] = [
  {
    brand: 'HP',
    tip: 'HP printers may block printing when any cartridge reads empty. In the HP Smart app, set the black cartridge to “ignore,” or look for ink backup mode.',
  },
  {
    brand: 'Epson',
    tip: 'Press and hold Stop/Cancel while the ink light is on to print in backup mode (varies by model).',
  },
  {
    brand: 'Canon',
    tip: 'Press and hold Stop for 5+ seconds to disable the ink level check.',
  },
];
