import { SPRITES } from './palette';
import { H, Pix, W, parseSprite } from './pixels';

export const SPR = {
  MFC: parseSprite(SPRITES.MFC),
  MFC_MAD: parseSprite(SPRITES.MFC_MAD),
  INFO: parseSprite(SPRITES.INFO),
  POINTER: parseSprite(SPRITES.POINTER),
  CROSSHAIR: parseSprite(SPRITES.CROSSHAIR),
  STAPLE: parseSprite(SPRITES.STAPLE),
  COOLER: parseSprite(SPRITES.COOLER),
  PLANT: parseSprite(SPRITES.PLANT),
  POSTER: parseSprite(SPRITES.POSTER),
  CLOCK: parseSprite(SPRITES.CLOCK),
  EXIT: parseSprite(SPRITES.EXIT),
  PAGE_SMALL: parseSprite(SPRITES.PAGE_SMALL),
};

/**
 * idle: closed, 2× at 88,100. lid: lid up, still 2× at 88,100 (1.1 s into the sticker
 * beat). between: lid up, 2× at 80,90 (the first of the two steps forward).
 * mad: 3× at 72,80.
 */
export type PrinterPose = 'idle' | 'lid' | 'between' | 'mad';

export interface SceneState {
  /** Left, right fluorescent panel. */
  lights: [boolean, boolean];
  printer: PrinterPose;
  stickerRed: boolean;
  trayPage: boolean;
  /** 0 = at rest; 5, 6, 7 = the scan bar's sprite row during the sweep (mad only). */
  scanRow: 0 | 5 | 6 | 7;
  /** The machine drawn all white (the hit flash). */
  flashWhite: boolean;
  /** The red button on the open machine's panel, lit bright for a blink (mad only). */
  buttonBright: boolean;
}

/**
 * The room, a port of room() in prntr/design/stage1/art/liminal.py, the authoritative
 * layout. Every number is a virtual pixel.
 */
export function drawRoom(p: Pix, s: SceneState): void {
  p.fill('A');
  // ceiling: tiles with a grid, two fluorescent panels, a shadow line under it
  p.rect(0, 0, W, 28, 'T');
  for (let x = 0; x < W; x += 24) p.rect(x, 0, x + 1, 28, 't');
  for (let y = 0; y < 28; y += 9) p.rect(0, y, W, y + 1, 't');
  p.rect(0, 27, W, 29, 'a');
  [44, 148].forEach((x0, i) => {
    const on = s.lights[i];
    p.rect(x0, 9, x0 + 48, 18, 't');
    p.rect(x0 + 1, 10, x0 + 47, 17, on ? 'F' : 'f');
    if (on) p.rect(x0 + 6, 12, x0 + 42, 15, 'W');
  });
  // the wall darkens under a tube that is out
  if (!s.lights[0]) p.rect(0, 29, 120, 108, 'a');
  if (!s.lights[1]) p.rect(120, 29, W, 108, 'a');
  // baseboard, then the carpet: a 2×2 dither of C and x
  p.rect(0, 106, W, 109, 'B');
  for (let y = 109; y < H; y++) {
    for (let x = 0; x < W; x++) p.set(x, y, (x + y) % 2 === 0 ? 'C' : 'x');
  }
  // the door, ajar on black, EXIT above it
  p.rect(10, 40, 44, 108, 'E');
  p.rect(13, 43, 41, 108, 'D');
  p.rect(13, 43, 19, 108, 'z');
  p.rect(36, 76, 38, 78, 'K');
  p.blit(17, 31, SPR.EXIT, 1, { remap: { n: 'R' } });
  p.blit(66, 40, SPR.POSTER);
  p.blit(112, 36, SPR.CLOCK);
  // the window: light, blinds, nothing outside
  p.rect(160, 36, 224, 90, 'e');
  p.rect(163, 39, 221, 87, 's');
  for (let y = 41; y < 87; y += 4) p.rect(163, y, 221, y + 1, 'a');
  // cooler and plant, their shadows to the left (the window is the light)
  p.rect(42, 128, 56, 131, 'X');
  p.blit(50, 92, SPR.COOLER, 2);
  p.rect(190, 132, 206, 135, 'X');
  p.blit(200, 103, SPR.PLANT, 2);
  // the printer; its shadow falls the other way. Nothing points it out.
  const white = s.flashWhite;
  switch (s.printer) {
    case 'mad':
      p.rect(84, 146, 176, 152, 'X');
      p.blit(72, 80, SPR.MFC_MAD, 3, { white, remap: s.buttonBright ? { R: 'Q' } : undefined });
      if (s.scanRow && !white) p.rect(72 + 3 * 2, 80 + 3 * s.scanRow, 72 + 3 * 23, 80 + 3 * (s.scanRow + 1), 'c');
      break;
    case 'between':
      p.rect(90, 144, 168, 149, 'X');
      p.blit(80, 90, SPR.MFC_MAD, 2, { white });
      break;
    case 'lid':
      p.rect(96, 142, 160, 146, 'X');
      p.blit(88, 100, SPR.MFC_MAD, 2);
      break;
    default:
      p.rect(96, 142, 160, 146, 'X');
      p.blit(88, 100, SPR.MFC, 2);
  }
  // the sticker and the tray page exist only while the machine is at 2× in place
  if (s.printer === 'idle' || s.printer === 'lid') {
    p.blit(132, 110, SPR.INFO, 1, s.stickerRed ? { remap: { c: 'R' } } : {});
    if (s.trayPage) p.blit(98, 118, SPR.PAGE_SMALL);
  }
}
