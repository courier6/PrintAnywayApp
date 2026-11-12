/**
 * Prntr's world board: the ten best cleared runs, for everyone who plays (PRNTR-WORLD-BOARD.md).
 *
 *   GET  /top   the ten rows, best first
 *   POST /run   { "name": "EDGAR 7", "score": 1346 }: a cleared run, kept only when it is among the ten
 *
 * A row is a name the player typed, a score and the UTC date it arrived. Nothing about the sender is stored or
 * logged: no address, no user agent, no cookie. The sender's address is used once, as the rate limiter's key, and
 * Cloudflare keeps that count in memory for a minute.
 *
 * The score comes from the player's browser, so nothing here proves a run was played. What this does is keep the
 * table well-formed and small, and keep other websites and floods out.
 */

import { BOARD_NAME_MAX, BOARD_SCORE_MAX, CLEARED_SCORE_MIN, cleanName } from '../../src/prntr/boardRules';
import { isBlocked, parseBlocked } from './blocked';

export interface Env {
  DB: D1Database;
  /** Per address: POST /run. */
  WRITES: RateLimit;
  /** Per address: GET /top. */
  READS: RateLimit;
  /** The origins whose pages may call this, separated by commas. */
  ALLOWED_ORIGINS: string;
  /** "1" while runs are accepted. Anything else answers POST /run with 503: the switch for a board under abuse. */
  ACCEPTING: string;
  /** The refused names (blocked.ts). A secret; while it is not set, no run is accepted. */
  BLOCKED?: string;
}

/** The rows shown. */
const SHOWN = 10;
/** The rows kept: the ten and the twenty they pushed off, so a row deleted by hand is replaced by a real run. */
const KEPT = 30;
/** A run's body is about 35 bytes. */
const BODY_MAX = 200;

interface Row {
  name: string;
  score: number;
  at: string;
}

const HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000',
  Vary: 'Origin',
};

/** The request's origin when its pages may call this, or null. */
function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (origin === null) return null;
  return env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).includes(origin) ? origin : null;
}

/** No answer may be cached: a board read just after a run was sent has to show it. */
function answer(status: number, body: unknown, origin: string | null, more: Record<string, string> = {}): Response {
  const headers = new Headers({ ...HEADERS, 'Cache-Control': 'no-store', ...more });
  if (origin !== null) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

/** An error never repeats what was sent. */
const refuse = (status: number, error: string, origin: string | null, more: Record<string, string> = {}) =>
  answer(status, { error }, origin, more);

/** The body as text, or null when it is longer than `max` bytes or not UTF-8. Stops reading at the limit. */
async function readCapped(request: Request, max: number): Promise<string | null> {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && !(Number(declared) <= max)) return null;
  if (request.body === null) return '';
  const reader = request.body.getReader();
  const bytes = new Uint8Array(max);
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (length + value.byteLength > max) {
      await reader.cancel();
      return null;
    }
    bytes.set(value, length);
    length += value.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes.subarray(0, length));
  } catch {
    return null;
  }
}

/** The run in a body, or null: an object with exactly `name` and `score`, a clean board name and a cleared run's score. */
function parseRun(text: string): { name: string; score: number } | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  if (Object.keys(value).length !== 2 || !Object.hasOwn(value, 'name') || !Object.hasOwn(value, 'score')) return null;
  const { name, score } = value as { name: unknown; score: unknown };
  if (typeof name !== 'string' || name === '' || name.length > BOARD_NAME_MAX || cleanName(name) !== name) return null;
  if (typeof score !== 'number' || !Number.isInteger(score)) return null;
  if (score < CLEARED_SCORE_MIN || score > BOARD_SCORE_MAX) return null;
  return { name, score };
}

/** The sender's address, the rate limiter's key. Never stored. */
const sender = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'unknown';

const TOP = `SELECT id, name, score, at FROM runs ORDER BY score DESC, id ASC LIMIT ${SHOWN}`;
const bare = (rows: (Row & { id: number })[]): Row[] => rows.map(({ name, score, at }) => ({ name, score, at }));

async function top(request: Request, env: Env, origin: string | null): Promise<Response> {
  if (!(await env.READS.limit({ key: sender(request) })).success) return refuse(429, 'slow down', origin);
  const { results } = await env.DB.prepare(TOP).all<Row & { id: number }>();
  return answer(200, { rows: bare(results) }, origin);
}

async function run(request: Request, env: Env, origin: string | null): Promise<Response> {
  // Only the game's own pages write. (A script can claim any origin: this keeps other websites out, not scripts.)
  if (origin === null) return refuse(403, 'origin', null);
  if (!(await env.WRITES.limit({ key: sender(request) })).success) return refuse(429, 'slow down', origin);
  if (env.ACCEPTING !== '1' || env.BLOCKED === undefined) return refuse(503, 'closed', origin);
  const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') return refuse(415, 'type', origin);
  const text = await readCapped(request, BODY_MAX);
  if (text === null) return refuse(413, 'size', origin);
  const sent = parseRun(text);
  if (sent === null) return refuse(400, 'run', origin);
  if (isBlocked(sent.name, parseBlocked(env.BLOCKED))) return refuse(422, 'name', origin);

  const at = new Date().toISOString().slice(0, 10);
  // One transaction. The run goes in only when fewer than ten rows have its score or better (an equal score ranks
  // below the earlier one, so a run that only equals a full board's number ten is not on it); then the table is cut
  // back to the rows kept; then the ten are read.
  const [inserted, , shown] = await env.DB.batch<Row & { id: number }>([
    env.DB.prepare(
      `INSERT INTO runs (name, score, at) SELECT ?1, ?2, ?3
       WHERE (SELECT COUNT(*) FROM runs WHERE score >= ?2) < ${SHOWN}`,
    ).bind(sent.name, sent.score, at),
    env.DB.prepare(`DELETE FROM runs WHERE id NOT IN (SELECT id FROM runs ORDER BY score DESC, id ASC LIMIT ${KEPT})`),
    env.DB.prepare(TOP),
  ]);
  const rows = shown.results;
  const rank = inserted.meta.changes === 1 ? rows.findIndex((r) => r.id === inserted.meta.last_row_id) : -1;
  return answer(200, { rank, rows: bare(rows) }, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env);
    const { pathname } = new URL(request.url);
    const allow = pathname === '/top' ? 'GET, OPTIONS' : pathname === '/run' ? 'POST, OPTIONS' : null;
    if (allow === null) return refuse(404, 'not found', origin);
    try {
      if (request.method === 'OPTIONS') {
        // The preflight of the game's POST (its JSON content type makes the browser ask first).
        if (origin === null) return refuse(403, 'origin', null);
        return answer(204, null, origin, {
          'Access-Control-Allow-Methods': allow,
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        });
      }
      if (pathname === '/top' && request.method === 'GET') return await top(request, env, origin);
      if (pathname === '/run' && request.method === 'POST') return await run(request, env, origin);
      return refuse(405, 'method', origin, { Allow: allow });
    } catch {
      return refuse(500, 'server', origin);
    }
  },
} satisfies ExportedHandler<Env>;
