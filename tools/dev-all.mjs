// The site's dev server and the world board's local copy, together (npm run dev:all). Ctrl-C stops both, and
// either one stopping stops the other. `npm run dev` alone is the site without a board: its WORLD view reads
// NO ANSWER, as it does for a visitor when the real server is down.
//
// Both ports are fixed. The local copy answers http://localhost:5173 only (ALLOWED_ORIGINS of `env.dev` in
// board-worker/wrangler.jsonc) and the game's dev build calls http://localhost:8787 (src/prntr/worldBoard.ts), so
// a server that moved to a free port would show NO ANSWER with nothing saying why. A port in use stops the lot.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BOARD = fileURLToPath(new URL('../board-worker/', import.meta.url));
const SITE_PORT = '5173';

if (!existsSync(`${BOARD}node_modules`)) {
  console.error('board-worker/ has no node_modules: run `npm install` in board-worker/ once, then this again.');
  process.exit(1);
}

const children = [];
let stopping = false;

/** Stops every child with everything it started (each is its own process group), then leaves with `code`. */
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  process.exitCode = code;
}

function start(label, cwd, command, args) {
  const child = spawn(command, args, { cwd, env: { ...process.env, FORCE_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', (line) => console.log(`[${label}] ${line}`));
  }
  child.on('error', (err) => {
    console.error(`[${label}] could not start: ${err.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) console.error(`[${label}] stopped (${signal ?? `exit ${code}`}); stopping the other.`);
    stop(code ?? 1);
  });
  children.push(child);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(0));

start('board', BOARD, 'npm', ['run', 'dev']);
start('site', ROOT, 'npx', ['vite', '--port', SITE_PORT, '--strictPort']);
