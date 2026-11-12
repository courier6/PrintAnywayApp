// The local copy's database (`--env dev`, kept under .wrangler/state): its table, ten made-up winners, or no rows.
// Every command here is `--local`: nothing reaches Cloudflare or the real board.
//   node local.mjs migrate    the table, if it is not there yet (npm run dev does this first)
//   node local.mjs seed       ten made-up winners in place of whatever is there (npm run seed)
//   node local.mjs reset      no rows (npm run reset)
// seed and reset work while the local copy is running; the game reads the board again when its card next opens.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ENV = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' };

// Made up, in the game's own name rules (A–Z, 0–9, single spaces, 12 at most). The tenth is one point over a bare
// win (1337), so a win with any bonus points takes its place and a bare win is not sent.
const WINNERS = [
  ['PC LOAD LTR', 2412],
  ['TONER KID', 2105],
  ['MAGENTA 7', 1988],
  ['PAPERJAM', 1873],
  ['NULL', 1790],
  ['DRUM UNIT', 1655],
  ['TRAY 2', 1541],
  ['CYAN', 1466],
  ['STAPLES', 1392],
  ['INKJET 99', 1338],
];

function d1(...args) {
  return execFileSync('npx', ['wrangler', 'd1', ...args, '--local', '--env', 'dev'], {
    cwd: HERE,
    env: ENV,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
const migrate = () => d1('migrations', 'apply', 'DB');
const sql = (command) => d1('execute', 'DB', '--command', command);

/** The UTC date `back` days before today, as the Worker writes it. */
const day = (back) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);

const commands = {
  migrate() {
    migrate();
  },
  seed() {
    migrate();
    // the best run is the oldest, the tenth is today's
    const rows = WINNERS.map(([name, score], i) => `('${name}', ${score}, '${day(WINNERS.length - 1 - i)}')`);
    sql(`DELETE FROM runs; INSERT INTO runs (name, score, at) VALUES ${rows.join(', ')};`);
    console.log(`The local board has ${WINNERS.length} made-up winners, ${WINNERS[0][1]} down to ${WINNERS.at(-1)[1]}.`);
  },
  reset() {
    migrate();
    sql('DELETE FROM runs;');
    console.log('The local board is empty.');
  },
};

const run = commands[process.argv[2]];
if (!run) {
  console.error('usage: node local.mjs migrate | seed | reset');
  process.exit(2);
}
try {
  run();
} catch (err) {
  console.error(String(err.stderr || err.stdout || err.message).trim());
  process.exit(1);
}
