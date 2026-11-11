/**
 * The board (PRNTR-BOARD.md): the player's own top ten, kept in this browser's localStorage under
 * one key, written when a finished run ranks (cleared or a game over) and removed when they clear
 * it. Nothing here touches the network. Every storage access is guarded: private browsing, a full quota or storage
 * switched off throw, and the board then simply reads as empty or refuses to keep a row.
 */

export const BOARD_KEY = 'prntr.board';
export const BOARD_MAX = 10;
/** As the badge's name (PRNTR-BADGE.md §8.3): A–Z, 0–9 and spaces, twelve at most. */
export const BOARD_NAME_MAX = 12;
export const BOARD_SCORE_MAX = 9999;

/** A name as the badge and the board take it: upper case, A–Z, 0–9 and single spaces, trimmed, BOARD_NAME_MAX at most. */
export const cleanName = (s: string) =>
  s.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/ +/g, ' ').trim().slice(0, BOARD_NAME_MAX);

export interface BoardRow {
  name: string;
  score: number;
  /** The local date the run ended, YYYY-MM-DD. */
  at: string;
  /** Cleared (true) or a game over (false). */
  won: boolean;
}

interface BoardFile {
  v: 1;
  rows: BoardRow[];
}

const NAME_RE = /^[A-Z0-9 ]{1,12}$/;
const AT_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRow(x: unknown): x is BoardRow {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.name === 'string' &&
    NAME_RE.test(r.name) &&
    typeof r.score === 'number' &&
    Number.isInteger(r.score) &&
    r.score >= 0 &&
    r.score <= BOARD_SCORE_MAX &&
    typeof r.at === 'string' &&
    AT_RE.test(r.at) &&
    typeof r.won === 'boolean'
  );
}

/** Best first; equal scores keep the order they were stored in, newest first (sort is stable; rankOf puts a tie above). Ten at most. */
function sorted(rows: BoardRow[]): BoardRow[] {
  return rows.slice().sort((a, b) => b.score - a.score).slice(0, BOARD_MAX);
}

/** The rows kept, best first: empty when nothing is kept, the key cannot be read, or its value is not a board. */
export function readBoard(): BoardRow[] {
  try {
    const raw = window.localStorage.getItem(BOARD_KEY);
    if (raw === null) return [];
    const file: unknown = JSON.parse(raw);
    if (typeof file !== 'object' || file === null) return [];
    const f = file as { v?: unknown; rows?: unknown };
    if (f.v !== 1 || !Array.isArray(f.rows)) return [];
    return sorted(f.rows.filter(isRow));
  } catch {
    return [];
  }
}

/** Where `score` would go on `rows` (0-based; a tie goes above the rows it ties: newest first), or -1 when it would not
 * make the board: ten better rows, or a run without a point. */
export function rankOf(rows: BoardRow[], score: number): number {
  if (score <= 0) return -1;
  const i = rows.findIndex((r) => r.score <= score);
  const at = i === -1 ? rows.length : i;
  return at < BOARD_MAX ? at : -1;
}

/** Today in local time, YYYY-MM-DD. */
export function today(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * What became of a finished run when the room ended (settleRun), carried to the board over the app: written at `rank`,
 * refused by the browser, not ranking, or still unnamed (NULL: the board asks the name and writes the row itself).
 */
export type BoardWrite = { kind: 'kept'; rank: number } | { kind: 'refused' } | { kind: 'unranked' } | { kind: 'unnamed' };

/**
 * Keeps `row` on the board. Resolves the board as kept and the row's rank on it; null when the row
 * does not rank (rankOf) or the browser would not keep it, in which case nothing has changed.
 */
export function pinRow(row: BoardRow): { rows: BoardRow[]; rank: number } | null {
  const before = readBoard();
  const rank = rankOf(before, row.score);
  if (rank === -1) return null;
  const rows = [...before.slice(0, rank), row, ...before.slice(rank)].slice(0, BOARD_MAX);
  const file: BoardFile = { v: 1, rows };
  try {
    window.localStorage.setItem(BOARD_KEY, JSON.stringify(file));
  } catch {
    return null;
  }
  return { rows, rank };
}

/**
 * A run the room has just ended with, cleared or a game over, settled once: one that ranks gets on the board, and
 * with a name it is written now; without one (NULL) it waits for the name.
 */
export function settleRun(run: BoardRow): BoardWrite {
  if (rankOf(readBoard(), run.score) === -1) return { kind: 'unranked' };
  if (run.name === 'NULL') return { kind: 'unnamed' };
  const kept = pinRow(run);
  return kept ? { kind: 'kept', rank: kept.rank } : { kind: 'refused' };
}

/** Takes the board down: the key is removed. True when it is gone (or was never there). */
export function clearBoard(): boolean {
  try {
    window.localStorage.removeItem(BOARD_KEY);
    return true;
  } catch {
    return false;
  }
}

/** A row's line on the board, 31 characters, the date as month-day-year: `01 EDGAR 7      1337 10-22-2026`. */
export function rowLine(rank: number, row: BoardRow): string {
  const date = `${row.at.slice(5)}-${row.at.slice(0, 4)}`;
  return `${String(rank + 1).padStart(2, '0')} ${row.name.padEnd(BOARD_NAME_MAX)} ${String(row.score).padStart(4, '0')} ${date}`;
}
