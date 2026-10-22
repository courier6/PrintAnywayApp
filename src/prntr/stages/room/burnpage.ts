import { hash, vnoise, type Emitter } from './scene';
import type { PalKey } from './palette';

/** The paper eaten from the bottom at sprite column c, in output px: the burn b (0 whole … 1 gone) of hRows × sc px, ragged by a slow noise per column, never past the top. */
export function eatenAt(c: number, b: number, hRows: number, sc: number, seed: number, tick: number): number {
  return Math.min(hRows * sc, Math.floor(b * hRows * sc * (0.72 + 0.56 * vnoise(c * 0.9 + seed * 0.013, tick * 0.08 + seed))));
}

/** The blit hook for a burning page: nothing below the front, black char (z) on the last row with an ember-red glint on every other column each other tick, scorch (G) on the one or two rows above here and there. */
export function burnFine(hRows: number, sc: number, b: number, seed: number, tick: number): (ox: number, oy: number, key: PalKey) => PalKey | null | undefined {
  return (ox, oy) => {
    const c = Math.floor(ox / sc), e = eatenAt(c, b, hRows, sc, seed, tick), top = hRows * sc - e;
    if (oy >= top) return null;
    if (e === 0) return undefined;
    if (oy === top - 1) return (tick + c) & 1 ? 'R' : 'z';
    if (oy === top - 2 && hash(c * 13 + seed + Math.floor(oy / 2)) < 0.6) return 'G';
    if (oy === top - 3 && hash(c * 17 + seed) < 0.3) return 'G';
    return undefined;
  };
}

/** §13's three flames with their floors on the front (the middle one at the page's middle column, the licks at its quarters) and their heights scaled by 0.45 + 0.55 (1 − b): nothing once the page is gone. */
export function frontFire(x: number, y: number, w: number, h: number, sc: number, b: number, seed: number, tick: number): Emitter[] {
  if (b >= 1) return [];
  const live = 0.45 + 0.55 * (1 - b), hRows = h / sc;
  const at = (fx: number) => y + h - eatenAt(Math.min(9, Math.floor(fx / sc)), b, hRows, sc, seed, tick);
  return [
    { x: x + w / 2, floor: at(w / 2), w: w / 2 - 1, h: h * 0.8 * live, seed },
    { x: x + w * 0.25, floor: at(w * 0.25), w: w * 0.22, h: h * 0.5 * live, seed: seed + 1 },
    { x: x + w * 0.75, floor: at(w * 0.75), w: w * 0.22, h: h * 0.55 * live, seed: seed + 2 },
  ];
}

/** Ash off a page on the glass: up to two grey flecks a tick (g and G by turns) shed at the front and falling for 700 ms, each a function of time alone. `burnAt(t)` is the page's burn at time t; (x, y) the landed page's top-left, h its height. */
export function ashFlecks(set: (x: number, y: number, k: PalKey) => void, landedAt: number, now: number, x: number, y: number, h: number, seed: number, burnAt: (t: number) => number): void {
  const tick0 = Math.floor(landedAt / 100), tick = Math.floor(now / 100);
  for (let T = Math.max(tick0, tick - 8); T <= tick; T++) {
    for (let j = 0; j < 2; j++) {
      if (hash(T * 41 + j * 5 + seed) > 0.7) continue;
      const age = now - T * 100;
      if (age < 0 || age > 700) continue;
      const c = Math.floor(hash(T * 11 + j + seed) * 10), e = eatenAt(c, burnAt(T * 100), h / 4, 4, seed, T), s = age / 1000;
      set(Math.round(x + c * 4 + 2 + (hash(T + j) - 0.5) * 8 * s), Math.round(y + h - e + 60 * s * s + 6 * s), (T + j) & 1 ? 'g' : 'G');
    }
  }
}
