import { useEffect, useRef, useState, type ReactNode } from 'react';
import './devPanel.css';

// Dev only (mounted from App.tsx behind import.meta.env.DEV): a DevTools-style side panel with
// jumps to the late phases and the fight's controls. It drives window.__prntrApp (App.tsx) and
// window.__prntrRoom (stages/room/index.ts); vite.config.ts fails the build if its marker survives.

const STORAGE_KEY = 'prntr-dev-panel';
const ATTACKS = ['scan', 'staples', 'pages', 'ink', 'bolts', 'black', 'slam'] as const;
const LIVES_MAX = 3;
const SCORE_MAX = 1336;

interface Room {
  phase: () => string;
  stats: () => unknown;
  health: () => number;
  isGod: () => boolean;
  isSteady: () => boolean;
  god: (on: boolean) => void;
  steady: (on: boolean) => void;
  setScore: (n: number) => void;
  setHealth: (n: number) => void;
  setLives: (n: number) => void;
  attack: (kind: string) => void;
  strike: () => void;
  fight: () => void;
  win: () => void;
  over: () => void;
}
interface App {
  appState: () => string;
  loadStandIn: () => void;
  enter: (stage: number) => void;
}
const w = window as unknown as { __prntrRoom?: Room; __prntrApp?: App };

/** The room's hook while a room is on screen, else null (the hook outlives nothing, but be sure). */
const room = (): Room | null => (document.querySelector('.prntr-room-frame') ? (w.__prntrRoom ?? null) : null);

function waitFor(what: string, pred: () => boolean, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const tick = () => {
      if (pred()) resolve();
      else if (performance.now() - t0 > timeoutMs) reject(new Error(`timed out waiting for ${what}`));
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

/** From wherever it is to the room's look: a stand-in document, then Prntr at stage 1. */
async function toRoom(): Promise<void> {
  if (room()) return;
  const app = w.__prntrApp;
  if (!app) throw new Error('no app hook');
  if (app.appState() !== 'preview') {
    app.loadStandIn();
    await waitFor('the document', () => w.__prntrApp?.appState() === 'preview');
    await new Promise((r) => setTimeout(r, 50)); // let the render commit before it reads the store
  }
  w.__prntrApp?.enter(1);
  await waitFor('the room', () => room()?.phase() === 'look');
}

async function toFight(): Promise<void> {
  await toRoom();
  await waitFor('the fight', () => {
    const r = room();
    if (!r) return false;
    if (r.phase() !== 'fight') r.fight();
    return r.phase() === 'fight';
  });
}

function readStore(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
function writeStore(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  } catch {
    // private window or blocked storage: the panel just starts closed next time
  }
}

interface Reading {
  app: string;
  phase: string | null;
  health: number | null;
  god: boolean;
  steady: boolean;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dev-sec">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function NumberSet({ label, max, min, onSet, disabled }: { label: string; max: number; min: number; onSet: (n: number) => void; disabled: boolean }) {
  const [v, setV] = useState('');
  return (
    <div className="dev-row">
      <label>{label}</label>
      <input type="number" min={min} max={max} value={v} placeholder={`${min}–${max}`} onChange={(e) => setV(e.target.value)} />
      <button
        disabled={disabled || v === ''}
        onClick={() => {
          const n = Number(v);
          if (Number.isFinite(n)) onSet(n);
        }}
      >
        Set
      </button>
    </div>
  );
}

export default function DevPanel() {
  const [open, setOpen] = useState(readStore);
  const [reading, setReading] = useState<Reading>({ app: '—', phase: null, health: null, god: false, steady: false });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    console.info('prntr-dev-panel');
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '`' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      setOpen((o) => {
        writeStore(!o);
        return !o;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The live readout, once a frame, only while the panel is open.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const tick = () => {
      const r = room();
      const next: Reading = {
        app: w.__prntrApp?.appState() ?? '—',
        phase: r ? r.phase() : null,
        health: r ? r.health() : null,
        god: r ? r.isGod() : false,
        steady: r ? r.isSteady() : false,
      };
      setReading((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(true);
    setNote(`${label}…`);
    try {
      await job();
      if (mounted.current) setNote(`${label}: done`);
    } catch (err) {
      if (mounted.current) setNote(`${label}: ${err instanceof Error ? err.message : 'failed'}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const phase = reading.phase;
  const fighting = phase === 'fight';
  const r = () => room();

  return (
    <aside
      className="dev-panel"
      aria-label="Prntr dev panel"
      onKeyDown={(e) => e.nativeEvent.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header>
        <strong>Prntr dev</strong>
        <button className="dev-x" onClick={() => { writeStore(false); setOpen(false); }} aria-label="Close">×</button>
      </header>

      <Section title="State">
        <dl className="dev-read">
          <dt>app</dt><dd>{reading.app}</dd>
          <dt>room</dt><dd>{phase ?? '—'}</dd>
          <dt>health</dt><dd>{reading.health ?? '—'}</dd>
        </dl>
        {note && <p className="dev-note">{note}</p>}
      </Section>

      <Section title="Jump">
        <button
          disabled={busy}
          onClick={() =>
            void run('win → certificate', async () => {
              await toFight();
              r()?.god(true);
              r()?.win();
              setNote('win → certificate: hold Print on the certificate for the vortex');
            })
          }
        >
          Win → certificate
        </button>
        <button disabled={busy} onClick={() => void run('to the fight', toFight)}>To the fight</button>
        <button disabled={!fighting} onClick={() => r()?.win()}>Win now</button>
        <button disabled={!fighting} onClick={() => r()?.setLives(0)}>CONTINUE?</button>
        <button disabled={!(fighting || phase === 'continue')} onClick={() => r()?.over()}>Game over</button>
      </Section>

      <Section title="Fight">
        <label className="dev-check">
          <input type="checkbox" checked={reading.god} disabled={!phase} onChange={(e) => r()?.god(e.target.checked)} />
          god (nothing costs health)
        </label>
        <label className="dev-check">
          <input type="checkbox" checked={reading.steady} disabled={!phase} onChange={(e) => r()?.steady(e.target.checked)} />
          steady (no kick or bloom)
        </label>
        <NumberSet label="score" min={0} max={SCORE_MAX} disabled={!fighting} onSet={(n) => r()?.setScore(n)} />
        <NumberSet label="health" min={1} max={100} disabled={!fighting} onSet={(n) => r()?.setHealth(n)} />
        <NumberSet label="lives" min={0} max={LIVES_MAX} disabled={!fighting} onSet={(n) => r()?.setLives(n)} />
        <div className="dev-grid">
          {ATTACKS.map((a) => (
            <button key={a} disabled={!fighting} onClick={() => r()?.attack(a)}>{a}</button>
          ))}
          <button disabled={!phase} onClick={() => r()?.strike()}>strike</button>
        </div>
      </Section>

      <Section title="Keys">
        <p className="dev-keys">
          <kbd>`</kbd> this panel · <kbd>Esc</kbd> leave Prntr<br />
          <code>/?prntr=0</code> opening · <code>/?prntr=1</code> room
        </p>
      </Section>
    </aside>
  );
}
