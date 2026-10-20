import type { Certificate } from './types';

/**
 * The certificate of completion (Edgar, 2026-10-20): the page the app comes back to once the
 * room is won, in place of the document it had. A US Letter page at 2×, black on white, set
 * like a corporate certificate that has been through something: a black header band, the title
 * glitched in slices, a data glyph and a seal made of pixels, a hex dump, a barcode, all of
 * them from the certificate's own id, which is unique to this win. The app recolours it like
 * any page, so it prints in the chosen ink.
 */

/** Points on the page (US Letter, 612 × 792) are drawn at this many px. */
const K = 2;
const PAGE_W = 612;
const PAGE_H = 792;
const FONT = '"Press Start 2P", "Courier New", monospace';
const INK = '#000000';
const PAPER = '#FFFFFF';
const DIM = '#3A3A3A';
const FAINT = '#C8C8C8';

/** PRNTR-XXXX-XXXX-XXXX-XXXX, 64 random bits in hex. */
export function certificateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
  return `PRNTR-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

/** A stream of bits seeded by a string (xorshift32), for the glyph, the dump and the barcode. */
function bitsOf(seed: string): () => number {
  let x = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) x = Math.imul(x ^ seed.charCodeAt(i), 0x85ebca6b) | 0;
  if (x === 0) x = 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) & 1;
  };
}

export function makeCertificate(player: string, score: number, hi: number): Certificate {
  const id = certificateId();
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W * K;
  canvas.height = PAGE_H * K;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('prntr: no 2d context');
  const bit = bitsOf(id);
  const date = new Date().toISOString().slice(0, 10);
  const px = (v: number) => Math.round(v * K);
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color;
    g.fillRect(px(x), px(y), px(w), px(h));
  };
  const text = (s: string, x: number, y: number, pt: number, color = INK, align: CanvasTextAlign = 'center', spacing = 0) => {
    g.fillStyle = color;
    g.font = `${px(pt)}px ${FONT}`;
    g.textAlign = align;
    g.textBaseline = 'alphabetic';
    const c = g as CanvasRenderingContext2D & { letterSpacing?: string };
    if ('letterSpacing' in c) c.letterSpacing = `${px(spacing)}px`;
    g.fillText(s, px(x), px(y));
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  };

  // the paper, the frame, the registration marks in the corners
  rect(0, 0, PAGE_W, PAGE_H, PAPER);
  rect(36, 36, 540, 1.5, INK);
  rect(36, 754.5, 540, 1.5, INK);
  rect(36, 36, 1.5, 720, INK);
  rect(574.5, 36, 1.5, 720, INK);
  rect(42, 42, 528, 0.5, INK);
  rect(42, 749.5, 528, 0.5, INK);
  rect(42, 42, 0.5, 708, INK);
  rect(569.5, 42, 0.5, 708, INK);
  for (const [cx, cy] of [
    [22, 22],
    [590, 22],
    [22, 770],
    [590, 770],
  ]) {
    rect(cx - 8, cy - 0.5, 16, 1, INK);
    rect(cx - 0.5, cy - 8, 1, 16, INK);
  }
  // a dot grid over the body of the page
  for (let y = 108; y < 740; y += 12) for (let x = 54; x < 566; x += 12) rect(x - 0.5, y - 0.5, 1, 1, FAINT);
  // the header band
  rect(42.5, 42.5, 527, 48, INK);
  text('SIMPLE PRODUCTS', 60, 72, 13, PAPER, 'left', 1.5);
  text('SYS.PRNTR // CERT.01', 552, 70, 6, PAPER, 'right', 0.5);
  // the title, then torn in slices
  text('CERTIFICATE', 306, 192, 30, INK);
  text('OF COMPLETION', 306, 236, 30, INK);
  for (const [y, h, dx] of [
    [168, 7, 5],
    [181, 4, -8],
    [214, 6, 7],
    [228, 3, -5],
  ]) {
    const band = g.getImageData(px(60), px(y), px(492), px(h));
    g.putImageData(band, px(60 + dx), px(y));
  }
  text('// STAGE 01 : THE ROOM :: STATUS = CLEARED', 306, 266, 6.5, DIM, 'center', 0.3);
  // who, and what they did
  text('THIS CERTIFIES THAT', 306, 322, 7.5, DIM, 'center', 0.5);
  text(player.toUpperCase(), 306, 366, 24, INK);
  rect(160, 376, 292, 1, INK);
  text('HAS BEATEN THE PRINTER', 306, 410, 9, INK, 'center', 0.5);
  text(`MODEL SP-7331 · SCORE ${String(score).padStart(4, '0')} · HI ${String(hi).padStart(4, '0')}`, 306, 438, 6.5, DIM, 'center', 0.3);
  text('THE MACHINE IS IN PIECES. THE OFFICE HAS BEEN EVACUATED.', 306, 456, 6.5, DIM, 'center', 0.3);
  text('NO FURTHER STAGES ARE AVAILABLE AT THIS TIME.', 306, 474, 6.5, DIM, 'center', 0.3);
  // the data glyph: 16 × 16 cells from the id, a solid corner to read it by
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const corner = (r < 4 && c < 4) || (r < 4 && c > 11) || (r > 11 && c < 4);
      const on = corner ? !((r === 1 || r === 2 || r === 13 || r === 14) && (c === 1 || c === 2 || c === 13 || c === 14)) : bit() === 1;
      if (on) rect(66 + c * 5.5, 520 + r * 5.5, 5, 5, INK);
    }
  }
  text('DATA', 110, 622, 5, DIM, 'center', 0.5);
  // the seal: two rings of pixels around the score
  for (const [r, n] of [
    [46, 40],
    [34, 26],
  ]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI;
      rect(500 + Math.cos(a) * r - 1.75, 564 + Math.sin(a) * r - 1.75, 3.5, 3.5, INK);
    }
  }
  text(String(hi), 500, 569, 9, INK);
  text('CERTIFIED', 500, 622, 5, DIM, 'center', 0.5);
  // the id, and a dump of it
  text('CERTIFICATE NO.', 306, 532, 5.5, DIM, 'center', 0.5);
  text(id, 306, 554, 10.5, INK, 'center', 0.5);
  for (let row = 0; row < 2; row++) {
    const pairs: string[] = [];
    for (let i = 0; i < 12; i++) {
      let v = 0;
      for (let b = 0; b < 8; b++) v = (v << 1) | bit();
      pairs.push(v.toString(16).padStart(2, '0').toUpperCase());
    }
    text(`0x${(0x7331 + row * 12).toString(16).toUpperCase()}  ${pairs.join(' ')}`, 306, 576 + row * 13, 5, DIM, 'center', 0.3);
  }
  // issued, and signed off by the machine: a jagged line in its hand
  text(`ISSUED ${date}`, 60, 664, 6.5, INK, 'left', 0.3);
  g.strokeStyle = INK;
  g.lineWidth = px(1.2);
  g.lineCap = 'square';
  g.beginPath();
  let sx = 400;
  let sy = 650;
  g.moveTo(px(sx), px(sy));
  for (let i = 0; i < 18; i++) {
    sx += 8;
    sy = 650 + (bit() ? -9 : 7) * (bit() ? 1 : 0.5) + (i % 3 === 0 ? 3 : 0);
    g.lineTo(px(sx), px(sy));
  }
  g.stroke();
  rect(400, 662, 152, 0.75, INK);
  text('AUTHORIZED · SP-7331', 552, 674, 5.5, DIM, 'right', 0.5);
  // the barcode along the bottom, the id spelled under it
  for (let x = 60; x < 552; x += 2) if (bit()) rect(x, 700, 2, 28, INK);
  rect(60, 700, 2, 28, INK);
  rect(550, 700, 2, 28, INK);
  text(id.replace(/-/g, '  '), 306, 742, 6, INK, 'center', 2);
  // the footer, under the frame
  text('© 2026 SIMPLE PRODUCTS. WE PRINT. PRINTED IN BLACK.', 306, 775, 5.5, DIM, 'center', 0.3);
  return { id, page: canvas };
}
