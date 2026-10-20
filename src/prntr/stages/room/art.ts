/**
 * The wall art: a print of the Winged Victory of Samothrace, the headless,
 * armless Nike of the Louvre striding into the wind on the prow of a ship, between the clock
 * and the post-it board. Pixel art, but oddly finer than the room around it: it is drawn on a
 * canvas of its own at ART_SUB cells to the room's pixel, from vector shapes with gradients,
 * then quantized to a few marble greys and a few navy blues with an ordered dither, so it
 * reads as a highly detailed pixel picture. The room draws its frame; the stage lays this
 * canvas over the picture's rect.
 */

/** The picture inside the frame, in the room's px, and how many cells of it to a room px. */
export const ART_AT = { x: 88, y: 36, w: 44, h: 32 };
export const ART_SUB = 4;

/** Marble, lit from the right: shadow to highlight. */
const MARBLE = ['#4A463F', '#6E6960', '#8F8A7E', '#B3ADA0', '#D2CCBE', '#E9E4D8', '#FBF8F0'];
/** The wall behind her in the print: a deep blue, darker at the top. */
const NAVY = ['#141A2C', '#1E2640', '#2A3350', '#36405E'];
/** The ship's prow and its deck. */
const STONE = ['#2E2E33', '#44454C', '#5C5D65', '#75767E'];
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function renderVictory(): HTMLCanvasElement {
  const W = ART_AT.w * ART_SUB;
  const H = ART_AT.h * ART_SUB;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  };
  // three layers, lit and shaded as vector shapes: the figure, the prow, the wall
  const fig = make();
  const prow = make();
  const out = make();
  const g = fig.getContext('2d');
  const pg = prow.getContext('2d');
  const og = out.getContext('2d', { willReadFrequently: true });
  if (!g || !pg || !og) return out;
  const u = W / 176; // the shapes below are drawn in a 176 × 128 space
  g.scale(u, u);
  pg.scale(u, u);

  // the prow: a wedge low on the left with its deck rising to the right, the figure's base on it
  pg.fillStyle = '#5a5b63';
  pg.beginPath();
  pg.moveTo(-2, 130);
  pg.lineTo(-2, 94);
  pg.lineTo(60, 98);
  pg.lineTo(124, 102);
  pg.lineTo(136, 130);
  pg.closePath();
  pg.fill();
  const deck = pg.createLinearGradient(0, 90, 0, 130);
  deck.addColorStop(0, 'rgba(255,255,255,0.35)');
  deck.addColorStop(0.3, 'rgba(255,255,255,0)');
  deck.addColorStop(1, 'rgba(0,0,0,0.5)');
  pg.fillStyle = deck;
  pg.fill();
  pg.fillStyle = 'rgba(0,0,0,0.35)';
  pg.beginPath();
  pg.moveTo(-2, 118);
  pg.lineTo(130, 123);
  pg.lineTo(136, 130);
  pg.lineTo(-2, 130);
  pg.closePath();
  pg.fill();

  // the wings, swept back and up behind her (she faces right): the far one first, paler
  const wing = (sx: number, sy: number, tipX: number, tipY: number, drop: number, shade: number) => {
    g.beginPath();
    g.moveTo(sx, sy);
    g.bezierCurveTo(sx - 20, sy - 30, tipX + 30, tipY - 8, tipX, tipY);
    // the feathered lower edge, in scallops back to the shoulder
    const n = 5;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = tipX + (sx - tipX) * t;
      const y = tipY + (sy + drop - tipY) * t + Math.sin(t * Math.PI) * 10;
      g.quadraticCurveTo(x - 6, y + 9, x, y);
    }
    g.closePath();
    const grad = g.createLinearGradient(tipX, tipY, sx, sy + drop);
    grad.addColorStop(0, `rgba(${shade},${shade},${shade - 6},1)`);
    grad.addColorStop(1, `rgba(${shade + 50},${shade + 48},${shade + 40},1)`);
    g.fillStyle = grad;
    g.fill();
    // feather lines from the shoulder out to the edge
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7;
      g.beginPath();
      g.moveTo(sx - 4, sy + drop * 0.5);
      g.quadraticCurveTo(sx - 30 - 10 * t, sy - 10 + 30 * t, tipX + (sx - tipX) * t * 0.9, tipY + (sy + drop - tipY) * t * 0.95 + 6);
      g.stroke();
    }
  };
  wing(88, 40, 6, 6, 18, 150);
  wing(78, 54, 28, 36, 24, 100);

  // the body: the torso leaning into the wind, the drapery pressed to it and streaming behind
  g.beginPath();
  g.moveTo(80, 36); // the neck
  g.lineTo(94, 38);
  g.quadraticCurveTo(110, 48, 106, 62); // the chest forward
  g.quadraticCurveTo(98, 70, 104, 78); // the waist in, the hip out
  g.quadraticCurveTo(114, 90, 112, 104); // the leading leg down to the deck
  g.lineTo(62, 104);
  g.quadraticCurveTo(48, 92, 58, 78); // the drapery streaming back and down
  g.quadraticCurveTo(66, 64, 70, 54);
  g.quadraticCurveTo(70, 44, 74, 40);
  g.closePath();
  const body = g.createLinearGradient(56, 0, 110, 0);
  body.addColorStop(0, '#5a564e');
  body.addColorStop(0.55, '#c9c3b5');
  body.addColorStop(1, '#f6f2e8');
  g.fillStyle = body;
  g.fill();
  // the stumps of the arms and the neck, in shadow
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(84, 36, 10, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath();
  g.ellipse(70, 46, 5, 3, 0.6, 0, Math.PI * 2);
  g.fill();
  // the folds: curves pressed across the belly and legs, and streaming back off the hip
  g.strokeStyle = 'rgba(0,0,0,0.32)';
  g.lineWidth = 1.1;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(70 + i * 2, 54 + i * 8);
    g.quadraticCurveTo(86 + i * 2, 58 + i * 8, 104 + (i > 2 ? 4 : 0), 66 + i * 7);
    g.stroke();
  }
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(76, 74 + i * 6);
    g.quadraticCurveTo(64, 84 + i * 5, 58 + i * 3, 104);
    g.stroke();
  }
  // the leading leg's edge through the cloth
  g.beginPath();
  g.moveTo(96, 80);
  g.quadraticCurveTo(104, 92, 100, 104);
  g.stroke();
  // a highlight down the chest and the leading thigh
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(98, 42);
  g.quadraticCurveTo(106, 60, 100, 76);
  g.quadraticCurveTo(98, 88, 104, 100);
  g.stroke();

  // quantize: each cell takes its layer's palette by its luminance, dithered
  const figD = g.getImageData(0, 0, W, H).data;
  const prowD = pg.getImageData(0, 0, W, H).data;
  const img = og.createImageData(W, H);
  const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const pick = (pal: string[], lum: number, x: number, y: number) => {
    const v = (lum * (pal.length - 1) + (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.9);
    return hex(pal[Math.max(0, Math.min(pal.length - 1, Math.round(v)))]);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let rgb: number[];
      if (figD[i + 3] > 100) {
        rgb = pick(MARBLE, (0.299 * figD[i] + 0.587 * figD[i + 1] + 0.114 * figD[i + 2]) / 255, x, y);
      } else if (prowD[i + 3] > 100) {
        rgb = pick(STONE, (0.299 * prowD[i] + 0.587 * prowD[i + 1] + 0.114 * prowD[i + 2]) / 255 / 0.55, x, y);
      } else {
        // the wall: darker at the top and towards the left, a soft light where she is
        const dx = (x - W * 0.62) / W;
        const dy = (y - H * 0.5) / H;
        rgb = pick(NAVY, 0.72 - Math.sqrt(dx * dx * 1.6 + dy * dy) * 0.9 + y / H / 5, x, y);
      }
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}
