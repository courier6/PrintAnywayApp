import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from './anim';
import { cleanName, clearBoard, pinRow, rankOf, readBoard, today, type BoardRow, type BoardWrite } from './board';
import { NOTE_NOT_CLEARED, NOTE_REFUSED, buildBoardCard, outLine } from './boardCard';
import { BOARD_FRAME_BAND, paintBoardFrame } from './boardFrame';

/** A finished run as the app side gets it: won or lost, its score, the badge's name (NULL when none was given), and for
 * a win what became of it on the board when the room ended (`board`, from settleRun). */
export interface BoardRun {
  won: boolean;
  score: number;
  player: string;
  board?: BoardWrite;
}

/** A frame cell is this many CSS px on a desktop, and on a narrow viewport (under NARROW_PX wide). */
const CELL_PX = 3;
const CELL_NARROW_PX = 2;
const NARROW_PX = 600;

interface Props {
  /** The run the room handed on. */
  run: BoardRun;
  /** The ink the frame is drawn in: the certificate's after a win, gold after a loss. */
  inkHex: string;
  onClose: () => void;
}

/**
 * The board over the app (PRNTR-BOARD.md §15.2, §16), after the app has dropped in under the jingle: the local leader
 * board's card in a gilded pixel frame in the ink (the board-frame sheet's #5), no dim, so the certificate and the
 * gold swatch stay in sight around it. A cleared run the room has not written (the badge left
 * it NULL) asks for the name first (§15.3): OK or Enter writes it, with NULL for an empty field. CONTINUE, a press
 * outside the card or Esc closes it (unanswered, the name's run is not written); CLEAR THE BOARD asks YOU SURE?, YES
 * clears and closes, CANCEL is the board again. Silent: the run's audio has gone with Prntr.
 */
export function PrntrBoard({ run, inkHex, onClose }: Props) {
  const dimRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState('');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // what the board shows, kept so CANCEL can show it again: the first paint, then the board once the name is in
  const shownRef = useRef<Paint | null>(null);
  if (shownRef.current === null) shownRef.current = firstPaint(run);

  useEffect(() => {
    const dim = dimRef.current;
    if (!dim) return;
    const controller = new AbortController();
    const { signal } = controller;
    const c = buildBoardCard();
    const card = c.card;
    if (reducedMotion()) card.classList.add('is-still');
    const frame = document.createElement('canvas');
    frame.className = 'prntr-board-frame';
    frame.setAttribute('aria-hidden', 'true');
    card.append(frame);
    // a press on the card is the card's; on the frame around it, the overlay's (it closes)
    card.addEventListener('click', (e) => e.stopPropagation(), { signal });
    dim.prepend(card);

    const show = ({ rows, rank, out, note, say }: Paint) => {
      c.asking(false);
      c.naming(null);
      c.showRows(rows, rank);
      c.showOut(out, note);
      c.goBtn.focus();
      setLive(say);
    };
    const first = shownRef.current!;
    if (first.ask) {
      c.showRows(first.rows, -1);
      c.showOut('', '');
      c.naming(run.score);
      c.nameInput.focus();
      setLive(first.say);
    } else {
      show(first);
    }

    // the name: written once, with the rank it gets; then the board as after any write
    const answer = () => {
      if (!shownRef.current?.ask) return;
      const row: BoardRow = { name: cleanName(c.nameInput.value) || 'NULL', score: run.score, at: today(), won: true };
      const kept = pinRow(row);
      shownRef.current = kept
        ? { rows: kept.rows, rank: kept.rank, out: '', note: '', say: `${row.name}, ${row.score}, number ${kept.rank + 1}.`, ask: false }
        : { rows: readBoard(), rank: -1, out: outLine(row, 'NOT KEPT.'), note: NOTE_REFUSED, say: `${row.name}, ${row.score}. ${NOTE_REFUSED}`, ask: false };
      show(shownRef.current);
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
      aria-label="Local leader board"
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

interface Paint {
  rows: BoardRow[];
  rank: number;
  out: string;
  note: string;
  say: string;
  /** A cleared run the room left unwritten (NULL) that ranks: the name is asked before it is written. */
  ask: boolean;
}

/** The board as it first comes up over the app. It writes nothing: a named run was written as the room ended, and a
 * NULL one waits for its name. */
function firstPaint(run: BoardRun): Paint {
  const rows = readBoard();
  const said = (s: string) => `Local leader board. ${s}`;
  const row: BoardRow = { name: run.player, score: run.score, at: today(), won: run.won };
  if (!run.won) return { rows, rank: -1, out: outLine(row, 'NOT ON IT.'), note: '', say: said(`${row.name}, ${row.score}, game over, not on it.`), ask: false };
  if (run.player === 'NULL') {
    const rank = rankOf(rows, run.score);
    if (rank === -1) return { rows, rank: -1, out: outLine(row, 'NOT ON IT.'), note: '', say: said(`${row.score}, not on it.`), ask: false };
    return { rows, rank: -1, out: '', note: '', say: said(`${row.score}, number ${rank + 1}. Your name?`), ask: true };
  }
  // it was written as the room ended, or not, and `board` says which (the row is not looked up again: its date stamp
  // could differ from today's across midnight)
  const write: BoardWrite = run.board ?? { kind: 'unranked' };
  if (write.kind === 'kept') return { rows, rank: write.rank, out: '', note: '', say: said(`${row.name}, ${row.score}, number ${write.rank + 1}.`), ask: false };
  if (write.kind === 'refused') return { rows, rank: -1, out: outLine(row, 'NOT KEPT.'), note: NOTE_REFUSED, say: said(`${row.name}, ${row.score}. ${NOTE_REFUSED}`), ask: false };
  return { rows, rank: -1, out: outLine(row, 'NOT ON IT.'), note: '', say: said(`${row.name}, ${row.score}, not on it.`), ask: false };
}
