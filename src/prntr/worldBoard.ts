/**
 * The world board (PRNTR-WORLD-BOARD.md): the ten best cleared runs of everyone who plays, kept by a small server
 * (board-worker/). This is the one place the page calls anything but itself, and what it sends is a cleared run's
 * name and score, nothing else: no cookie, no referrer, nothing of the app's documents. No DOM here.
 *
 * Neither call throws or waits long: a server that cannot be reached, answers late or answers with anything but a
 * well-formed board reads as null, and the local board goes on without it.
 */

import { BOARD_SCORE_MAX, CLEARED_SCORE_MIN } from './boardRules';

/** The server. On the dev server it is the copy running on this machine (`npm run dev` in board-worker/). The built
 * page may call the first only: CONTENT_SECURITY_POLICY in vite.config.ts names it. */
export const WORLD_URL = import.meta.env.DEV ? 'http://localhost:8787' : 'https://board.printanyway.app';
export const WORLD_MAX = 10;
const TIMEOUT_MS = 4000;

export interface WorldRow {
  name: string;
  score: number;
  /** The UTC date the server took the run, YYYY-MM-DD. */
  at: string;
}

/** What became of a run sent: on the ten at `rank` (0-based), not on it, or its name refused by the server. */
export type WorldSent = { kind: 'on'; rank: number; rows: WorldRow[] } | { kind: 'off'; rows: WorldRow[] } | { kind: 'name' };

const NAME_RE = /^[A-Z0-9 ]{1,12}$/;
const AT_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRow(x: unknown): x is WorldRow {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.name === 'string' &&
    NAME_RE.test(r.name) &&
    typeof r.score === 'number' &&
    Number.isInteger(r.score) &&
    r.score >= CLEARED_SCORE_MIN &&
    r.score <= BOARD_SCORE_MAX &&
    typeof r.at === 'string' &&
    AT_RE.test(r.at)
  );
}

/** The rows of an answer, as plain rows, or null unless they are ten at most, every one a row, best first. */
function rowsOf(body: unknown): WorldRow[] | null {
  if (typeof body !== 'object' || body === null) return null;
  const rows = (body as { rows?: unknown }).rows;
  if (!Array.isArray(rows) || rows.length > WORLD_MAX || !rows.every(isRow)) return null;
  if (rows.some((r, i) => i > 0 && rows[i - 1].score < r.score)) return null;
  return rows.map(({ name, score, at }) => ({ name, score, at }));
}

function call(path: string, init: RequestInit): Promise<Response> {
  return fetch(WORLD_URL + path, {
    ...init,
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** The world's ten, best first, or null when the server cannot be reached or does not answer with a board. */
export async function readWorld(): Promise<WorldRow[] | null> {
  try {
    const res = await call('/top', { method: 'GET' });
    if (res.status !== 200) return null;
    return rowsOf(await res.json());
  } catch {
    return null;
  }
}

/** Whether a cleared run of `score` would get on `rows`: there is room, or it beats the tenth (an equal score ranks
 * below the earlier one, so it does not). The server decides again when the run arrives. */
export const beatsWorld = (rows: WorldRow[], score: number) =>
  score >= CLEARED_SCORE_MIN && (rows.length < WORLD_MAX || score > rows[WORLD_MAX - 1].score);

/** Sends a cleared run. What became of it, or null when it could not be sent or the answer was no board (the run is
 * then not sent again). */
export async function sendRun(name: string, score: number): Promise<WorldSent | null> {
  try {
    const res = await call('/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score }),
    });
    if (res.status === 422) return { kind: 'name' };
    if (res.status !== 200) return null;
    const body: unknown = await res.json();
    const rows = rowsOf(body);
    if (rows === null) return null;
    const rank = (body as { rank?: unknown }).rank;
    if (rank === -1) return { kind: 'off', rows };
    if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 0 || rank >= rows.length) return null;
    // the row at the rank is the run sent, or the answer is not about it
    if (rows[rank].name !== name || rows[rank].score !== score) return null;
    return { kind: 'on', rank, rows };
  } catch {
    return null;
  }
}
