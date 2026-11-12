import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from './anim';
import { cleanName, clearBoard, pinRow, rankOf, readBoard, today, type BoardRow, type BoardWrite } from './board';
import { NOTE_NOT_CLEARED, NOTE_REFUSED, WORLD_NAME_REFUSED, WORLD_NOT_SENT, buildBoardCard, outLine, worldLine, type BoardView, type WorldView } from './boardCard';
import { BOARD_FRAME_BAND, frameShades, paintBoardFrame } from './boardFrame';
import { beatsWorld, readWorld, sendRun, type WorldRow } from './worldBoard';

/** A finished run as the app side gets it: won or lost, its score, the badge's name (NULL when none was given), and
 * what became of it on the board when the room ended (`board`, from settleRun). */
export interface BoardRun {
  won: boolean;
  score: number;
  player: string;
  board: BoardWrite;
}

/** A frame cell is this many CSS px on a desktop, and on a narrow viewport (under NARROW_PX wide). */
const CELL_PX = 3;
const CELL_NARROW_PX = 2;
const NARROW_PX = 600;

interface Props {
  /** The run the room handed on. */
  run: BoardRun;
  /** The ink the frame is drawn in: gold after a win, the app's ink after a game over. */
  inkHex: string;
  onClose: () => void;
}

/**
 * The board over the app (PRNTR-BOARD.md §15.2, §16, §17), after the app has dropped in under the jingle: the local
 * leaderboard's card in a gilded pixel frame in the ink (the board-frame sheet's #5), no dim, so the certificate and the
 * gold swatch stay in sight around it. A ranking run the room has not written (the badge left
 * it NULL) asks for the name first (§15.3): OK or Enter writes it, with NULL for an empty field. CONTINUE, a press
 * outside the card or Esc closes it (unanswered, the name's run is not written); CLEAR THE BOARD asks YOU SURE?, YES
 * clears and closes, CANCEL is the board again. The switch under the title (§18) changes the view to WORLD TOP 10 and
 * back. Silent: the run's audio has gone with Prntr.
 *
 * The world's ten (PRNTR-WORLD-BOARD.md §4) are read once per board: for a cleared run as soon as it has its name, for
 * any other board when WORLD is first pressed. A cleared run that would be on them is sent, once, with the name the
 * local board shows; a run whose name was asked and never given is not sent. A send that fails is not tried again.
 */
export function PrntrBoard({ run, inkHex, onClose }: Props) {
  const dimRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState('');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // what the board shows, kept so CANCEL can show it again: the first paint, then the board once the name is in
  const shownRef = useRef<Paint | null>(null);
  if (shownRef.current === null) shownRef.current = firstPaint(run);
  // the world's side of this run, kept outside the effect so a rebuilt card neither asks nor sends twice
  const worldRef = useRef<World | null>(null);
  if (worldRef.current === null || worldRef.current.run !== run) worldRef.current = { run, view: { kind: 'wait' }, read: null, settled: false };
  const paintWorldRef = useRef<(say: string) => void>(() => {});

  useEffect(() => {
    const dim = dimRef.current;
    if (!dim) return;
    const controller = new AbortController();
    const { signal } = controller;
    const c = buildBoardCard();
    const card = c.card;
    if (reducedMotion()) card.classList.add('is-still');
    // the run's own row in the frame's colour: its gold after a win, the ink's light tone after a game over
    const shades = frameShades(inkHex);
    card.style.setProperty('--prntr-board-own', run.won ? shades.y : shades.s);
    const frame = document.createElement('canvas');
    frame.className = 'prntr-board-frame';
    frame.setAttribute('aria-hidden', 'true');
    card.append(frame);
    // a press on the card is the card's; on the frame around it, the overlay's (it closes)
    card.addEventListener('click', (e) => e.stopPropagation(), { signal });
    dim.prepend(card);

    const show = ({ rows, rank, out, note, say }: Paint) => {
      c.asking(false);
      c.showRows(rows, rank);
      c.showOut(out, note);
      c.goBtn.focus();
      setLive(say);
    };
    // ---- the world's ten ----
    const world = worldRef.current!;
    const setWorld = (view: WorldView, say = '') => {
      world.view = view;
      paintWorldRef.current(say);
    };
    paintWorldRef.current = (say) => {
      c.showWorld(world.view);
      if (say) setLive(say);
    };
    c.showWorld(world.view);
    /** Asks the server for the ten, once. */
    const readOnce = () =>
      (world.read ??= readWorld().then((rows) => {
        setWorld(rows ? { kind: 'rows', rows, rank: -1, out: '', own: false } : { kind: 'down' });
        return rows;
      }));
    /** A cleared run, once it has the name the local board shows: sent when it would be on the ten, once. */
    const settleWorld = (name: string) => {
      if (world.settled) return;
      world.settled = true;
      void readOnce().then(async (rows) => {
        if (rows === null) return;
        const off = (shown: WorldRow[], out: string, say = '') => setWorld({ kind: 'rows', rows: shown, rank: -1, out, own: false }, say);
        const notOn = outLine({ name, score: run.score }, 'NOT ON IT.');
        if (!beatsWorld(rows, run.score)) return off(rows, notOn);
        const sent = await sendRun(name, run.score);
        if (sent === null) off(rows, WORLD_NOT_SENT, 'The world board gave no answer. The run was not sent.');
        else if (sent.kind === 'name') off(rows, WORLD_NAME_REFUSED, 'The world board does not take that name. The run stays local.');
        else if (sent.kind === 'off') off(sent.rows, notOn);
        else setWorld({ kind: 'rows', rows: sent.rows, rank: sent.rank, out: worldLine(sent.rank), own: true }, `Number ${sent.rank + 1} in the world.`);
      });
    };

    const first = shownRef.current!;
    if (first.ask) {
      c.showOut('', '');
      c.askName(first.rows, first.rank, { score: run.score, at: today(), won: run.won });
      c.nameInput.focus();
      setLive(first.say);
    } else {
      show(first);
      // named by the badge, or NULL and not on the local board (so its name is not asked)
      if (run.won) settleWorld(run.player);
    }

    // the name: written once, with the rank it gets; then the board as after any write
    const answer = () => {
      if (!shownRef.current?.ask) return;
      const row: BoardRow = { name: cleanName(c.nameInput.value) || 'NULL', score: run.score, at: today(), won: run.won };
      const kept = pinRow(row);
      const how = run.won ? '' : ', game over';
      shownRef.current = kept
        ? { rows: kept.rows, rank: kept.rank, out: '', note: '', say: `${row.name}, ${row.score}${how}, number ${kept.rank + 1}.`, ask: false }
        : { rows: readBoard(), rank: -1, out: outLine(row, 'NOT KEPT.'), note: NOTE_REFUSED, say: `${row.name}, ${row.score}${how}. ${NOTE_REFUSED}`, ask: false };
      show(shownRef.current);
      if (run.won) settleWorld(row.name);
    };
    c.okBtn.addEventListener('click', answer, { signal });
    c.nameInput.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          answer();
        }
      },
      { signal },
    );

    // the switch (§18): the view changes in place; the run's row, a note and the clear stay with LOCAL
    const view = (v: BoardView) => {
      c.showView(v);
      if (v === 'world') void readOnce();
      setLive(v === 'world' ? sayWorld(world.view) : 'Local leaderboard.');
    };
    c.localTab.addEventListener('click', () => view('local'), { signal });
    c.worldTab.addEventListener('click', () => view('world'), { signal });

    c.goBtn.addEventListener('click', () => onCloseRef.current(), { signal });
    c.clearBtn.addEventListener(
      'click',
      () => {
        c.showOut(shownRef.current!.out, '');
        c.asking(true);
        c.cancelBtn.focus();
        setLive('Clear the board? Yes or cancel.');
      },
      { signal },
    );
    c.cancelBtn.addEventListener('click', () => show({ ...shownRef.current!, rows: readBoard(), note: '', say: 'The board.' }), { signal });
    c.yesBtn.addEventListener(
      'click',
      () => {
        if (clearBoard()) onCloseRef.current();
        else show({ ...shownRef.current!, rows: readBoard(), note: NOTE_NOT_CLEARED, say: NOTE_NOT_CLEARED });
      },
      { signal },
    );
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') onCloseRef.current();
      },
      { signal },
    );

    // the frame: BOARD_FRAME_BAND cells outside the card's box, redrawn whenever the card's size changes
    const draw = () => {
      const cell = window.innerWidth < NARROW_PX ? CELL_NARROW_PX : CELL_PX;
      const w = Math.ceil(card.offsetWidth / cell) + 2 * BOARD_FRAME_BAND;
      const h = Math.ceil(card.offsetHeight / cell) + 2 * BOARD_FRAME_BAND;
      paintBoardFrame(frame, w, h, inkHex);
      frame.style.left = frame.style.top = `${-BOARD_FRAME_BAND * cell}px`;
      frame.style.width = `${w * cell}px`;
      frame.style.height = `${h * cell}px`;
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(card);
    return () => {
      paintWorldRef.current = () => {};
      controller.abort();
      ro.disconnect();
      card.remove();
    };
  }, [inkHex, run]);

  return (
    <div
      className="prntr-board"
      ref={dimRef}
      role="dialog"
      aria-modal="true"
      aria-label="Local leaderboard"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
    >
      <span className="prntr-live" aria-live="polite">
        {live}
      </span>
    </div>
  );
}

/** The world's side of one finished run: what the WORLD view shows, the one read of the ten, and whether the run has
 * been settled (sent, or found not to be on them). */
interface World {
  run: BoardRun;
  view: WorldView;
  read: Promise<WorldRow[] | null> | null;
  settled: boolean;
}

/** The WORLD view, said. */
function sayWorld(w: WorldView): string {
  if (w.kind === 'wait') return 'World top 10. Calling.';
  if (w.kind === 'down') return 'World top 10. No answer.';
  const rows = w.rows.length === 0 ? 'Nobody yet.' : `${w.rows.length} ${w.rows.length === 1 ? 'row' : 'rows'}.`;
  return `World top 10. ${rows}${w.out === '' ? '' : ` ${w.out.trim()}`}`;
}

interface Paint {
  rows: BoardRow[];
  rank: number;
  out: string;
  note: string;
  say: string;
  /** A run the room left unwritten (NULL) that ranks: the name is asked, in its row at `rank`, before it is written. */
  ask: boolean;
}

/** The board as it first comes up over the app. It writes nothing: a named run was written as the room ended, and a
 * NULL one waits for its name. */
function firstPaint(run: BoardRun): Paint {
  const rows = readBoard();
  const said = (s: string) => `Local leaderboard. ${s}`;
  const row: BoardRow = { name: run.player, score: run.score, at: today(), won: run.won };
  const how = run.won ? '' : ', game over';
  if (run.player === 'NULL') {
    const rank = rankOf(rows, run.score);
    if (rank === -1) return { rows, rank: -1, out: outLine(row, 'NOT ON IT.'), note: '', say: said(`${row.score}${how}, not on it.`), ask: false };
    return { rows, rank, out: '', note: '', say: said(`${row.score}${how}, number ${rank + 1}. Your name?`), ask: true };
  }
  // it was written as the room ended, or not, and `board` says which (the row is not looked up again: its date stamp
  // could differ from today's across midnight)
  const write = run.board;
  if (write.kind === 'kept') return { rows, rank: write.rank, out: '', note: '', say: said(`${row.name}, ${row.score}${how}, number ${write.rank + 1}.`), ask: false };
  if (write.kind === 'refused') return { rows, rank: -1, out: outLine(row, 'NOT KEPT.'), note: NOTE_REFUSED, say: said(`${row.name}, ${row.score}${how}. ${NOTE_REFUSED}`), ask: false };
  return { rows, rank: -1, out: outLine(row, 'NOT ON IT.'), note: '', say: said(`${row.name}, ${row.score}${how}, not on it.`), ask: false };
}
