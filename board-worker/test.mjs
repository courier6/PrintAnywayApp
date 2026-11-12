// The world board's tests: every rule of src/index.ts once, against the Worker running on this machine
// (`wrangler dev --env dev`) with an empty local database. Nothing here reaches Cloudflare or the real board.
//   npm test
import { spawn, execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const STATE = '.wrangler/test-state';
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const SITE = 'http://localhost:5173'; // an origin the dev environment allows
const WRANGLER = ['wrangler'];
const ENV = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' };

let failed = 0;
let passed = 0;
function check(name, ok, detail = '') {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === '' ? '' : `  (${detail})`}`);
}

const npx = (args) => execFileSync('npx', [...WRANGLER, ...args], { cwd: HERE, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

async function serve(extra = []) {
  const child = spawn('npx', [...WRANGLER, 'dev', '--env', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', STATE, ...extra], {
    cwd: HERE,
    env: ENV,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 150; i += 1) {
    try {
      const r = await fetch(`${BASE}/top`);
      if (r.status === 200) return child;
    } catch {
      // not up yet
    }
    if (child.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`wrangler dev did not come up:\n${log}`);
}
const stop = (child) =>
  new Promise((done) => {
    child.once('exit', done);
    child.kill('SIGTERM');
  });

const post = (body, headers = {}) =>
  fetch(`${BASE}/run`, {
    method: 'POST',
    headers: { Origin: SITE, 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const top = async () => (await (await fetch(`${BASE}/top`)).json()).rows;
const today = new Date().toISOString().slice(0, 10);

rmSync(new URL(STATE, import.meta.url), { recursive: true, force: true });
npx(['d1', 'migrations', 'apply', 'DB', '--local', '--env', 'dev', '--persist-to', STATE]);

let server = await serve();
try {
  // ---- reading -----------------------------------------------------------
  let r = await fetch(`${BASE}/top`, { headers: { Origin: SITE } });
  let j = await r.json();
  check('GET /top on an empty board: 200, no rows', r.status === 200 && Array.isArray(j.rows) && j.rows.length === 0);
  check('GET /top echoes an allowed origin', r.headers.get('access-control-allow-origin') === SITE);
  check(
    'the hardening headers are on the answer',
    r.headers.get('x-content-type-options') === 'nosniff' &&
      r.headers.get('content-security-policy') === "default-src 'none'; frame-ancestors 'none'" &&
      r.headers.get('x-frame-options') === 'DENY' &&
      r.headers.get('referrer-policy') === 'no-referrer' &&
      (r.headers.get('strict-transport-security') ?? '').startsWith('max-age=') &&
      (r.headers.get('content-type') ?? '').startsWith('application/json') &&
      (r.headers.get('vary') ?? '').includes('Origin'),
  );
  check('GET /top is not cached (a read after a send must show the run)', r.headers.get('cache-control') === 'no-store');
  r = await fetch(`${BASE}/top`, { headers: { Origin: 'https://evil.example' } });
  check('GET /top gives another origin no CORS header', r.status === 200 && r.headers.get('access-control-allow-origin') === null);

  // ---- the preflight, the paths, the methods -------------------------------
  r = await fetch(`${BASE}/run`, { method: 'OPTIONS', headers: { Origin: SITE, 'Access-Control-Request-Method': 'POST' } });
  check(
    'OPTIONS /run from an allowed origin: 204 with POST and Content-Type allowed',
    r.status === 204 &&
      r.headers.get('access-control-allow-origin') === SITE &&
      (r.headers.get('access-control-allow-methods') ?? '').includes('POST') &&
      r.headers.get('access-control-allow-headers') === 'Content-Type',
  );
  r = await fetch(`${BASE}/run`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  check('OPTIONS /run from another origin: 403, no CORS header', r.status === 403 && r.headers.get('access-control-allow-origin') === null);
  for (const path of ['/', '/runs', '/top/1', '/admin']) {
    r = await fetch(`${BASE}${path}`);
    check(`GET ${path}: 404`, r.status === 404);
  }
  r = await fetch(`${BASE}/top`, { method: 'POST', headers: { Origin: SITE }, body: '{}' });
  check('POST /top: 405', r.status === 405 && r.headers.get('allow') === 'GET, OPTIONS');
  r = await fetch(`${BASE}/run`, { headers: { Origin: SITE } });
  check('GET /run: 405', r.status === 405 && r.headers.get('allow') === 'POST, OPTIONS');
  r = await fetch(`${BASE}/run`, { method: 'DELETE', headers: { Origin: SITE } });
  check('DELETE /run: 405', r.status === 405);

  // ---- who may write -------------------------------------------------------
  const good = { name: 'EDGAR 7', score: 1400 };
  r = await fetch(`${BASE}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(good) });
  check('POST /run with no origin: 403', r.status === 403);
  r = await post(good, { Origin: 'https://evil.example' });
  check('POST /run from another origin: 403, no CORS header', r.status === 403 && r.headers.get('access-control-allow-origin') === null);
  r = await post(good, { 'Content-Type': 'text/plain' });
  check('POST /run as text/plain: 415', r.status === 415);
  r = await post(JSON.stringify({ name: 'EDGAR 7', score: 1400, pad: 'x'.repeat(300) }));
  check('POST /run over 200 bytes: 413', r.status === 413);

  // ---- what a run must be --------------------------------------------------
  const bad = {
    'not JSON': '{name',
    'an array': '[1,2]',
    'a string': '"EDGAR"',
    null: 'null',
    'a third field': JSON.stringify({ ...good, at: '2026-01-01' }),
    'no score': JSON.stringify({ name: 'EDGAR' }),
    'no name': JSON.stringify({ score: 1400 }),
    'a lower-case name': JSON.stringify({ name: 'edgar', score: 1400 }),
    'a thirteen-letter name': JSON.stringify({ name: 'ABCDEFGHIJKLM', score: 1400 }),
    'an empty name': JSON.stringify({ name: '', score: 1400 }),
    'a name of one space': JSON.stringify({ name: ' ', score: 1400 }),
    'a doubled space': JSON.stringify({ name: 'A  B', score: 1400 }),
    'a leading space': JSON.stringify({ name: ' AB', score: 1400 }),
    'markup in the name': JSON.stringify({ name: '<B>X</B>', score: 1400 }),
    'a name that is a number': JSON.stringify({ name: 1234, score: 1400 }),
    'a score of 1336': JSON.stringify({ name: 'EDGAR', score: 1336 }),
    'a score of 10000': JSON.stringify({ name: 'EDGAR', score: 10000 }),
    'a score of 1400.5': JSON.stringify({ name: 'EDGAR', score: 1400.5 }),
    'a score as text': JSON.stringify({ name: 'EDGAR', score: '1400' }),
    'a score of null': JSON.stringify({ name: 'EDGAR', score: null }),
  };
  for (const [what, body] of Object.entries(bad)) {
    r = await post(body);
    j = await r.json();
    check(`POST /run with ${what}: 400`, r.status === 400 && j.error === 'run' && Object.keys(j).length === 1, `${r.status}`);
  }
  check('nothing was stored by any of those', (await top()).length === 0);

  // ---- refused names (the dev list: BADWORD anywhere; NOPE and 42 as whole words; a comment naming NOPENOPE) ---
  for (const name of ['BADWORD', 'XBADWORDX', 'BAD WORD', 'B4DW0RD', 'NOPE', 'OH NOPE', '42', 'AB 42']) {
    r = await post({ name, score: 1400 });
    j = await r.json();
    check(`POST /run named "${name}": 422`, r.status === 422 && j.error === 'name', `${r.status}`);
  }
  check('nothing was stored by those either', (await top()).length === 0);

  // ---- the ten -------------------------------------------------------------
  r = await post(good);
  j = await r.json();
  check(
    'a first run: 200, number 1, one row of name, score and today in UTC',
    r.status === 200 &&
      j.rank === 0 &&
      j.rows.length === 1 &&
      JSON.stringify(j.rows[0]) === JSON.stringify({ name: 'EDGAR 7', score: 1400, at: today }) &&
      r.headers.get('cache-control') === 'no-store' &&
      r.headers.get('access-control-allow-origin') === SITE,
    JSON.stringify(j),
  );
  j = await (await post({ name: 'NOPENOPE', score: 1400 })).json();
  check('an equal score ranks below the earlier one (and a name a whole-word entry is inside of, named only in a comment of the list, passes)', j.rank === 1 && j.rows[0].name === 'EDGAR 7' && j.rows[1].name === 'NOPENOPE', JSON.stringify(j));
  j = await (await post({ name: 'EDGAR 7', score: 1500 })).json();
  check('one name may hold several rows', j.rank === 0 && j.rows.filter((x) => x.name === 'EDGAR 7').length === 2);
  for (let i = 0; i < 7; i += 1) await post({ name: `P${i}`, score: 1600 + i });
  let rows = await top();
  check('ten rows, best first', rows.length === 10 && rows.every((x, i) => i === 0 || rows[i - 1].score >= x.score) && rows[9].name === 'NOPENOPE');
  j = await (await post({ name: 'TIE TEN', score: 1400 })).json();
  check('a run that only equals a full board\'s number ten is not on it', j.rank === -1 && j.rows.length === 10 && !j.rows.some((x) => x.name === 'TIE TEN'), JSON.stringify(j.rank));
  j = await (await post({ name: 'LOW', score: 1337 })).json();
  check('a lower run is not on it', j.rank === -1 && !j.rows.some((x) => x.name === 'LOW'));
  j = await (await post({ name: 'BEATS TEN', score: 1401 })).json();
  check(
    'a run that beats number ten is on it (number nine here, above the 1400 it beat) and the old number ten is off',
    j.rank === 8 && j.rows.length === 10 && j.rows[8].name === 'BEATS TEN' && j.rows[9].score === 1400 && !j.rows.some((x) => x.name === 'NOPENOPE'),
    JSON.stringify(j.rank),
  );
  j = await (await post({ name: 'TOP', score: 9999 })).json();
  check('the highest score a run can have is taken', j.rank === 0 && j.rows[0].score === 9999);

  // ---- the rows kept (30) ---------------------------------------------------
  for (let i = 0; i < 25; i += 1) await post({ name: `Q${i}`, score: 2000 + i });
  await stop(server);
  server = null;
  const count = JSON.parse(npx(['d1', 'execute', 'DB', '--local', '--env', 'dev', '--persist-to', STATE, '--json', '--command', 'SELECT COUNT(*) AS n, MIN(score) AS low FROM runs']));
  const { n, low } = count[0].results[0];
  check('37 runs went on the ten, 30 rows are kept, the lowest seven are gone', n === 30 && low === 1603, `n=${n} low=${low}`);
  const columns = JSON.parse(npx(['d1', 'execute', 'DB', '--local', '--env', 'dev', '--persist-to', STATE, '--json', '--command', "SELECT group_concat(name) AS c FROM pragma_table_info('runs')"]));
  check('a row has four columns: id, name, score, at', columns[0].results[0].c === 'id,name,score,at', columns[0].results[0].c);

  // ---- the switch -------------------------------------------------------------
  server = await serve(['--var', 'ACCEPTING:0']);
  r = await fetch(`${BASE}/top`, { headers: { Origin: SITE } });
  const reads = r.status;
  r = await post({ name: 'CLOSED', score: 5000 });
  j = await r.json();
  check('with ACCEPTING off: POST /run 503, GET /top still 200', r.status === 503 && j.error === 'closed' && reads === 200, `${r.status}`);
  check('and nothing was stored', !(await top()).some((x) => x.name === 'CLOSED'));
  await stop(server);
  server = null;

  // ---- the limiter -----------------------------------------------------------
  server = await serve();
  let limited = -1;
  for (let i = 0; i < 160 && limited === -1; i += 1) {
    r = await post('{name');
    if (r.status === 429) limited = i;
    else if (r.status !== 400) break;
  }
  check('POST /run is limited per sender: a 429 within 160 bad runs (the dev limit is 100 a minute)', limited !== -1, `last status ${r.status}`);
} catch (e) {
  failed += 1;
  console.log(`FAIL  the run stopped: ${e.stack ?? e}`);
} finally {
  if (server) await stop(server);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
