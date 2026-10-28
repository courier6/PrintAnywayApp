import qrcode from 'qrcode-generator';
import type { Certificate, RunStats } from './types';

/**
 * The certificate of completion: the page the app comes back to once the room is won, in place of
 * the document it had. A US Letter page at 2×, black on white, set like a corporate certificate
 * that has been through something: a black header band with the Simple Products mark that runs
 * down past the title, the title an ANSI Shadow banner in paper, the three honours the run earned
 * best, a QR code, a seal made of pixels, a hex dump, a barcode, the last four from the
 * certificate's own id, which is unique to this win. The app recolours it like any page, so it
 * prints in the chosen ink (gold, when it comes up).
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
/** A pale gold in the gold ink: the status line inside the band. */
const LIGHT = '#B4B4B4';
/** The band's lower edge; the title's spacing inside the band is computed from it. */
const BAND_BOTTOM = 268;
const NAME_BASELINE = 72;
/** The QR code's payload. */
const RICK = 'https://youtu.be/dQw4w9WgXcQ';

/** The title, FIGlet's ANSI Shadow, drawn as rectangles (§4.3 of PRNTR-CERTIFICATE.md). */
const TITLE_A = [
  ' ██████╗███████╗██████╗ ████████╗██╗███████╗██╗ ██████╗ █████╗ ████████╗███████╗',
  '██╔════╝██╔════╝██╔══██╗╚══██╔══╝██║██╔════╝██║██╔════╝██╔══██╗╚══██╔══╝██╔════╝',
  '██║     █████╗  ██████╔╝   ██║   ██║█████╗  ██║██║     ███████║   ██║   █████╗  ',
  '██║     ██╔══╝  ██╔══██╗   ██║   ██║██╔══╝  ██║██║     ██╔══██║   ██║   ██╔══╝  ',
  '╚██████╗███████╗██║  ██║   ██║   ██║██║     ██║╚██████╗██║  ██║   ██║   ███████╗',
  ' ╚═════╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝╚═╝     ╚═╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝',
];
const TITLE_B = [
  ' ██████╗ ███████╗     ██████╗ ██████╗ ███╗   ███╗██████╗ ██╗     ███████╗████████╗██╗ ██████╗ ███╗   ██╗',
  '██╔═══██╗██╔════╝    ██╔════╝██╔═══██╗████╗ ████║██╔══██╗██║     ██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║',
  '██║   ██║█████╗      ██║     ██║   ██║██╔████╔██║██████╔╝██║     █████╗     ██║   ██║██║   ██║██╔██╗ ██║',
  '██║   ██║██╔══╝      ██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██║     ██╔══╝     ██║   ██║██║   ██║██║╚██╗██║',
  '╚██████╔╝██║         ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ███████╗███████╗   ██║   ██║╚██████╔╝██║ ╚████║',
  ' ╚═════╝ ╚═╝          ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚══════╝╚══════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝',
];
const COL = 4.2;
const STEP = COL * 1.4;
const GAP = STEP * 0.6;
const LINE_T = 0.9;

/** The honours' icons, one character per cell: '#' ink, '.' nothing. */
const ICON = {
  WINDOW:  ['#########', '#.......#', '#########', '#..#.#..#', '####.####', '#..#.#..#', '#########', '#.......#', '#########'],
  DOOR:    ['.#######.', '.#.....#.', '.#..#..#.', '.#.#..##.', '.#....##.', '.#.#..##.', '.#..#..#.', '.#.....#.', '.#######.'],
  FLAME:   ['....#....', '...##....', '..###.#..', '..####.#.', '.#######.', '.###.###.', '.###.###.', '..#####..', '...###...'],
  PYRE:    ['...#.#...', '..##.##..', '.#######.', '#########', '#.......#', '#.#####.#', '#.......#', '#########', '.#.....#.'],
  CROSS:   ['....#....', '....#....', '..#####..', '.#..#..#.', '####.####', '.#..#..#.', '..#####..', '....#....', '....#....'],
  NOZZLES: ['.#..#..#..#', '.#..#..#..#', '###########', '#.........#', '#.........#', '#.........#', '###########', '...........', '...........'],
  PAGE:    ['.######..', '.#....##.', '.#....###', '.#......#', '.#.####.#', '.#......#', '.#.####.#', '.#......#', '.########'],
  HEART:   ['.##...##.', '###.#.###', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....', '.........'],
  CLOCK:   ['..#####..', '.#.....#.', '#...#...#', '#...#...#', '#...##..#', '#.......#', '#...#...#', '.#.....#.', '..#####..'],
};

interface Honour {
  rank: number;
  icon: string[];
  title: string;
  line: string;
  earned: boolean;
}

/** Every honour, ranked; the certificate prints the three earned ones that rank lowest. */
export function honours(s: RunStats): Honour[] {
  const acc = s.shotsFired === 0 ? 0 : Math.round((100 * s.hits) / s.shotsFired);
  const tier = acc >= 90 ? 'FIRST ORDER' : acc >= 75 ? 'SECOND ORDER' : 'THIRD ORDER';
  const m = Math.floor(s.seconds / 60);
  const ss = String(s.seconds % 60).padStart(2, '0');
  return [
    { rank: 1, icon: ICON.PYRE, title: 'THE PYRE', line: 'BURNED TO ITS BURST. THE GUN WAS NOT THE END OF IT', earned: s.wonBy === 'fire' },
    { rank: 2, icon: ICON.HEART, title: 'UNBROKEN', line: 'NO LIFE LOST. NO CONTINUE TAKEN', earned: s.livesLost === 0 && s.continues === 0 },
    { rank: acc >= 90 ? 2.5 : 6, icon: ICON.CROSS, title: `MARKSMAN, ${tier}`, line: `${s.hits} OF ${s.shotsFired} SHOTS LANDED, ${acc} PER CENT`, earned: true },
    { rank: 3, icon: ICON.NOZZLES, title: 'THE FOUR NOZZLES', line: 'EVERY INK TUBE SHOT OFF THE HEAD', earned: s.tubes === 4 },
    { rank: 4, icon: ICON.DOOR, title: 'THE DOOR, UNMADE', line: 'THE DOOR SHOT TO PLANKS. THE EXIT WAS NOT NEEDED', earned: s.door },
    { rank: 5, icon: ICON.WINDOW, title: 'THE BLIND, UNDRAWN', line: 'THE WINDOW BLOWN OUT ONTO THE STORM', earned: s.window },
    { rank: 5.5, icon: ICON.FLAME, title: 'THE RITE OF FIRE', line: `THE MACHINE SET ALIGHT, STOKED ${s.stokes} TIMES`, earned: s.fire },
    { rank: 7, icon: ICON.CLOCK, title: 'IN GOOD TIME', line: `CLEARED IN ${m}:${ss}. UNDER THREE MINUTES`, earned: s.seconds < 180 },
    { rank: 8, icon: ICON.PAGE, title: 'ALL PAGES RETURNED', line: `${s.pages} PAGES AND ${s.staples} STAPLES SHOT OUT OF THE AIR`, earned: s.pages > 0 },
  ];
}

/** PRNTR-XXXX-XXXX-XXXX-XXXX, 64 random bits in hex. */
export function certificateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
  return `PRNTR-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

/** A stream of bits seeded by a string (xorshift32), for the dump, the signature and the barcode. */
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

/** Greedy word wrap: no line longer than `max` characters. */
/**
 * A rounded rectangle as a sub-path. CanvasRenderingContext2D.roundRect is missing before Safari 16 and Firefox 112, and a
 * certificate that threw there would drop the win back to the preview with nothing; arcTo has been everywhere for good.
 */
function roundedRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

export function makeCertificate(player: string, score: number, hi: number, stats: RunStats): Certificate {
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
  /** A bitmap of '#' cells, `cell` pt each. */
  const icon = (bm: string[], x: number, y: number, cell: number, color: string) => {
    bm.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') rect(x + c * cell, y + r * cell, cell, cell, color);
    });
  };
  /** The Simple Products mark (opening.ts's SVG, viewBox 160 × 96) centred on (cx, cy), `w` pt wide. */
  const neuron = (cx: number, cy: number, w: number, fg: string, bg: string) => {
    const s = w / 160;
    g.save();
    // the scale stays fractional: rounding it to whole pixels hides the mark
    g.translate(px(cx - w / 2), px(cy - 48 * s));
    g.scale(s * K, s * K);
    g.fillStyle = fg;
    g.beginPath();
    for (const [x, y, rw, rh, r] of [
      [14, 20, 9, 42, 4.5],
      [27, 28, 9, 34, 4.5],
      [40, 18, 9, 44, 4.5],
      [53, 32, 9, 30, 4.5],
      [66, 24, 9, 38, 4.5],
      [79, 30, 9, 32, 4.5],
      [94, 28, 11, 34, 2],
      [110, 38, 30, 22, 5],
    ])
      roundedRect(g, x, y, rw, rh, r);
    g.fill();
    g.fillRect(139, 46, 8, 5);
    g.beginPath();
    g.arc(150, 48.5, 7, 0, 2 * Math.PI);
    g.fill();
    g.fillRect(6, 58, 146, 22);
    g.fillRect(0, 80, 158, 5);
    g.strokeStyle = fg;
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(18, 20);
    g.bezierCurveTo(30, 4, 70, 6, 99, 28);
    g.moveTo(44, 18);
    g.bezierCurveTo(60, 6, 96, 14, 114, 38);
    g.stroke();
    g.fillStyle = bg;
    g.beginPath();
    g.arc(30, 69, 6.5, 0, 2 * Math.PI);
    g.fill();
    g.fillStyle = fg;
    g.beginPath();
    g.arc(32.5, 66.5, 1.6, 0, 2 * Math.PI);
    g.fill();
    g.fillStyle = bg;
    g.fillRect(60, 65, 24, 3);
    g.fillRect(60, 71, 24, 3);
    g.restore();
  };
  /** One cell of the title banner, added to the current path on unrounded px (the banner fills it once). */
  const cellOf = (ch: string, x: number, y: number) => {
    const fr = (rx: number, ry: number, rw: number, rh: number) => g.rect(rx * K, ry * K, rw * K, rh * K);
    const mx = x + COL / 2 - LINE_T / 2;
    const my = y + STEP / 2 - LINE_T / 2;
    switch (ch) {
      case '█':
        fr(x, y, COL, STEP);
        break;
      case '║':
        fr(mx, y, LINE_T, STEP);
        break;
      case '═':
        fr(x, my, COL, LINE_T);
        break;
      case '╗':
        fr(x, my, COL / 2 + LINE_T / 2, LINE_T);
        fr(mx, my, LINE_T, STEP / 2 + LINE_T / 2);
        break;
      case '╔':
        fr(mx, my, COL / 2 + LINE_T / 2, LINE_T);
        fr(mx, my, LINE_T, STEP / 2 + LINE_T / 2);
        break;
      case '╝':
        fr(x, my, COL / 2 + LINE_T / 2, LINE_T);
        fr(mx, y, LINE_T, STEP / 2 + LINE_T / 2);
        break;
      case '╚':
        fr(mx, my, COL / 2 + LINE_T / 2, LINE_T);
        fr(mx, y, LINE_T, STEP / 2 + LINE_T / 2);
        break;
    }
  };
  /** A real QR code, `size` pt square, a four-module quiet zone cleared around it. */
  const qr = (x: number, y: number, size: number, data: string, color: string) => {
    const q = qrcode(0, 'M');
    q.addData(data);
    q.make();
    const n = q.getModuleCount();
    const cell = size / n;
    rect(x - cell * 4, y - cell * 4, size + cell * 8, size + cell * 8, PAPER);
    g.fillStyle = color;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!q.isDark(r, c)) continue;
        // each edge rounded on its own, so the modules abut
        const x0 = px(x + c * cell);
        const y0 = px(y + r * cell);
        g.fillRect(x0, y0, px(x + (c + 1) * cell) - x0, px(y + (r + 1) * cell) - y0);
      }
    }
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
  // the band, down past the title; the mark on the name's baseline at its cap height, the name after it
  rect(42.5, 42.5, 527, BAND_BOTTOM - 42.5, INK);
  g.font = `${px(13)}px ${FONT}`;
  const cap = g.measureText('SIMPLE PRODUCTS').actualBoundingBoxAscent / K;
  // the mark's units 18 (the tube tops) to 85 (its base) span the capitals
  const ns = cap / 67;
  const nw = 160 * ns;
  neuron(60 + nw / 2, NAME_BASELINE - 37 * ns, nw, PAPER, INK);
  text('SIMPLE PRODUCTS', 60 + nw + 9, NAME_BASELINE, 13, PAPER, 'left', 1.5);
  text('SYS.PRNTR // CERT.02', 552, 70, 6, PAPER, 'right', 0.5);
  // the title: the banner, its three gaps in the band equal (name to title, title to status line, status line to edge)
  const inkH = (TITLE_A.length + TITLE_B.length) * STEP + GAP;
  const G = (BAND_BOTTOM - NAME_BASELINE - inkH - 6) / 3;
  const titleTop = NAME_BASELINE + G;
  // one path, one fill: blocks filled one by one each smooth their own edges, and seams show where they abut
  const banner = (rows: string[], top: number) => {
    const x0 = 306 - (rows[0].length * COL) / 2;
    g.beginPath();
    rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) cellOf(row[c], x0 + c * COL, top + r * STEP);
    });
    g.fillStyle = PAPER;
    g.fill();
  };
  banner(TITLE_A, titleTop);
  banner(TITLE_B, titleTop + TITLE_A.length * STEP + GAP);
  text('// STAGE 01 : THE ROOM :: STATUS = CLEARED', 306, titleTop + inkH + G + 6, 6.5, LIGHT, 'center', 0.3);
  // who, and what they did
  text('THIS CERTIFIES THAT', 306, 300, 7.5, DIM, 'center', 0.5);
  text(player.toUpperCase(), 306, 342, 24, INK);
  rect(160, 352, 292, 1, INK);
  text('HAS BEATEN THE PRINTER', 306, 384, 9, INK, 'center', 0.5);
  text(`MODEL SP-7331 · SCORE ${String(score).padStart(4, '0')} · HI ${String(hi).padStart(4, '0')}`, 306, 410, 6.5, DIM, 'center', 0.3);
  text('THE MACHINE IS IN PIECES. THE OFFICE HAS BEEN EVACUATED.', 306, 428, 6.5, DIM, 'center', 0.3);
  // the honours: the three earned ones that rank lowest, each framed, its title and two lines of evidence
  const top = honours(stats)
    .filter((h) => h.earned)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);
  text('HONOURS', 306, 458, 5.5, DIM, 'center', 1);
  rect(60, 462, 200, 0.5, INK);
  rect(352, 462, 200, 0.5, INK);
  top.forEach((h, i) => {
    const cx = 60 + 164 * (i + 0.5);
    rect(cx - 17, 468, 34, 34, INK);
    rect(cx - 15.5, 469.5, 31, 31, PAPER);
    icon(h.icon, cx - (h.icon[0].length * 2.6) / 2, 485 - (h.icon.length * 2.6) / 2, 2.6, INK);
    text(h.title, cx, 514, Math.min(5.5, 156 / h.title.length), INK, 'center', 0.3);
    wrap(h.line, 34)
      .slice(0, 2)
      .forEach((l, k) => text(l, cx, 525 + k * 8, 4.2, DIM, 'center', 0.2));
  });
  // the QR code where the data glyph was
  qr(66, 548, 88, RICK, INK);
  text('DATA', 110, 650, 5, DIM, 'center', 0.5);
  // the seal: two rings of pixels around the score
  for (const [r, n] of [
    [46, 40],
    [34, 26],
  ]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI;
      rect(500 + Math.cos(a) * r - 1.75, 592 + Math.sin(a) * r - 1.75, 3.5, 3.5, INK);
    }
  }
  text(String(hi), 500, 597, 9, INK);
  text('CERTIFIED', 500, 650, 5, DIM, 'center', 0.5);
  // the id, and a dump of it
  text('CERTIFICATE NO.', 306, 562, 5.5, DIM, 'center', 0.5);
  text(id, 306, 584, 10.5, INK, 'center', 0.5);
  for (let row = 0; row < 2; row++) {
    const pairs: string[] = [];
    for (let i = 0; i < 12; i++) {
      let v = 0;
      for (let b = 0; b < 8; b++) v = (v << 1) | bit();
      pairs.push(v.toString(16).padStart(2, '0').toUpperCase());
    }
    text(`0x${(0x7331 + row * 12).toString(16).toUpperCase()}  ${pairs.join(' ')}`, 306, 606 + row * 13, 5, DIM, 'center', 0.3);
  }
  // issued, and signed off by the machine: a jagged line in its hand
  text(`ISSUED ${date}`, 60, 680, 6.5, INK, 'left', 0.3);
  g.strokeStyle = INK;
  g.lineWidth = px(1.2);
  g.lineCap = 'square';
  g.beginPath();
  let sx = 400;
  let sy = 666;
  g.moveTo(px(sx), px(sy));
  for (let i = 0; i < 18; i++) {
    sx += 8;
    sy = 666 + (bit() ? -9 : 7) * (bit() ? 1 : 0.5) + (i % 3 === 0 ? 3 : 0);
    g.lineTo(px(sx), px(sy));
  }
  g.stroke();
  rect(400, 678, 152, 0.75, INK);
  text('AUTHORIZED · SP-7331', 552, 690, 5.5, DIM, 'right', 0.5);
  // the barcode along the bottom, the id spelled under it
  for (let x = 60; x < 552; x += 2) if (bit()) rect(x, 704, 2, 26, INK);
  rect(60, 704, 2, 26, INK);
  rect(550, 704, 2, 26, INK);
  text(id.replace(/-/g, '  '), 306, 743, 6, INK, 'center', 2);
  // the footer, under the frame
  text('© 2026 SIMPLE PRODUCTS.', 306, 775, 5.5, DIM, 'center', 0.3);
  return { id, page: canvas };
}
