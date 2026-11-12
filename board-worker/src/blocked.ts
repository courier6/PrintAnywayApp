/**
 * The names the world board refuses. The list itself is not in this repository: it is the Worker's secret BLOCKED
 * (`wrangler secret put BLOCKED`), entries separated by commas, spaces or new lines; a `#` starts a comment that runs
 * to the end of its line. An entry is refused wherever
 * it appears in a name with the spaces taken out; an entry written with a leading `=` is refused only as a whole
 * word of the name (for short entries that are also the inside of ordinary words). A name is tried as typed and with
 * its digits read as the letters they stand in for.
 */

export interface Blocked {
  inside: string[];
  whole: string[];
}

/** Digits written for letters: 0 O, 1 I, 3 E, 4 A, 5 S, 7 T, 8 B. */
const SWAPS: Record<string, string> = { '0': 'O', '1': 'I', '3': 'E', '4': 'A', '5': 'S', '7': 'T', '8': 'B' };
const swapped = (s: string) => s.replace(/[0134578]/g, (d) => SWAPS[d]);

/** The list read from the secret's text. Entries are upper-cased; anything but A–Z and 0–9 is dropped from them. */
export function parseBlocked(text: string): Blocked {
  const inside: string[] = [];
  const whole: string[] = [];
  for (const raw of text.replace(/#.*$/gm, '').toUpperCase().split(/[\s,]+/)) {
    const isWhole = raw.startsWith('=');
    const entry = raw.replace(/[^A-Z0-9]/g, '');
    if (entry === '') continue;
    (isWhole ? whole : inside).push(entry);
  }
  return { inside, whole };
}

/** Whether `name` (already a clean board name: A–Z, 0–9, single spaces) holds an entry of the list. */
export function isBlocked(name: string, list: Blocked): boolean {
  for (const form of [name, swapped(name)]) {
    const joined = form.replace(/ /g, '');
    if (list.inside.some((e) => joined.includes(e))) return true;
    const words = form.split(' ');
    if (list.whole.some((e) => words.includes(e) || joined === e)) return true;
  }
  return false;
}
