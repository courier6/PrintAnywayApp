import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from './anim';
import { clearBoard, pinRow, rankOf, readBoard, today, type BoardRow } from './board';
import { NOTE_NOT_CLEARED, NOTE_REFUSED, buildBoardCard, outLine } from './boardCard';
import { BOARD_FRAME_BAND, paintBoardFrame } from './boardFrame';

/** A finished run as the app side gets it: won or lost, its score, the badge's name (NULL when none was given). */
export interface BoardRun {
  won: boolean;
  score: number;
  player: string;
}

/** A frame cell is this many CSS px on a desktop, and on a narrow viewport (under NARROW_PX wide). */
const CELL_PX = 3;
const CELL_NARROW_PX = 2;
const NARROW_PX = 600;

interface Props {
  /** The run the room handed on; null for the dev entrance's view of the board. */
  run: BoardRun | null;
  /** The ink the frame is drawn in: the certificate's after a win, gold after a loss. */
  inkHex: string;
  onClose: () => void;
}

/**
 * The board over the app (PRNTR-BOARD.md §15.2), after the app has dropped in under the jingle: the card the room's
 * glimpse showed, now with its buttons, in a gilded pixel frame in the ink (the board-frame sheet's #5), no dim, so
 * the certificate and the gold swatch stay in sight around it. A cleared run the room has not written yet (no name:
 * NULL) is written here. CONTINUE, a press outside the card or Esc closes it; CLEAR THE BOARD asks YOU SURE?, YES
 * clears and closes, CANCEL is the board again. Silent: the run's audio has gone with Prntr.
 */
export function PrntrBoard({ run, inkHex, onClose }: Props) {
  const dimRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState('');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // what the first paint shows, kept so CANCEL can show it again
  const first = useRef<Paint | null>(null);
  if (first.current === null) first.current = firstPaint(run);

  useEffect(() => {
    const dim = dimRef.current;
    if (!dim) return;
    const controller = new AbortController();
    const { signal } = controller;
    const c = buildBoardCard({ buttons: true });
    const card = c.card;
    if (reducedMotion()) card.classList.add('is-still');
    const frame = document.createElement('canvas');
    frame.className = 'prntr-board-frame';
    frame.setAttribute('aria-hidden', 'true');
    card.append(frame);
    // a press on the card is the card's; on the frame around it, the overlay's (it closes)
    card.addEventListener('click', (e) => e.stopPropagation(), { signal });
    dim.prepend(card);

    const shown = first.current!;
    const show = (rows: BoardRow[], rank: number, out: string, note: string, say: string) => {
      c.asking(false);
      c.showRows(rows, rank);
      c.showOut(out, note);
      c.goBtn.focus();
      setLive(say);
    };
    show(shown.rows, shown.rank, shown.out, shown.note, shown.say);

    c.goBtn.addEventListener('click', () => onCloseRef.current(), { signal });
    c.clearBtn.addEventListener(
      'click',
      () => {
        c.showOut(shown.out, '');
        c.asking(true);
        c.cancelBtn.focus();
        setLive('Clear the board? Yes or cancel.');
      },
      { signal },
    );
    c.cancelBtn.addEventListener('click', () => show(readBoard(), shown.rank, shown.out, '', 'The board.'), { signal });
    c.yesBtn.addEventListener(
      'click',
      () => {
        if (clearBoard()) onCloseRef.current();
        else show(readBoard(), shown.rank, shown.out, NOTE_NOT_CLEARED, NOTE_NOT_CLEARED);
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
  }, [inkHex]);

  return (
    <div
      className="prntr-board is-app"
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
}

/** Each run's first paint, so its write happens once however often React renders the board for it. */
const painted = new WeakMap<BoardRun, Paint>();

/** The board as it first comes up over the app, writing a cleared run the room left unwritten (no name). */
function firstPaint(run: BoardRun | null): Paint {
  if (!run) return paint(null);
  let p = painted.get(run);
  if (!p) painted.set(run, (p = paint(run)));
  return p;
}

function paint(run: BoardRun | null): Paint {
  const rows = readBoard();
  if (!run) return { rows, rank: -1, out: '', note: '', say: rows.length === 0 ? 'The board is empty.' : `The board: ${rows.length} row${rows.length === 1 ? '' : 's'}.` };
  const row: BoardRow = { name: run.player, score: run.score, at: today(), won: run.won };
  if (!run.won) return { rows, rank: -1, out: outLine(row, 'NOT ON IT.'), note: '', say: `Local leader board. ${row.name}, ${row.score}, game over, not on it.` };
  if (rankOf(rows, run.score) === -1 && !rows.some((r) => r.name === row.name && r.score === row.score && r.at === row.at)) {
    return { rows, rank: -1, out: outLine(row, 'NOT ON IT.'), note: '', say: `Local leader board. ${row.name}, ${row.score}, not on it.` };
  }
  if (run.player !== 'NULL') {
    // the room wrote it: the newest of its equals, so the first row that matches
    const rank = rows.findIndex((r) => r.name === row.name && r.score === row.score && r.at === row.at && r.won);
    if (rank !== -1) return { rows, rank, out: '', note: '', say: `Local leader board. ${row.name}, ${row.score}, number ${rank + 1}.` };
    return { rows, rank: -1, out: outLine(row, 'NOT KEPT.'), note: NOTE_REFUSED, say: `Local leader board. ${row.name}, ${row.score}. ${NOTE_REFUSED}` };
  }
  const kept = pinRow(row);
  if (kept) return { rows: kept.rows, rank: kept.rank, out: '', note: '', say: `Local leader board. ${row.name}, ${row.score}, number ${kept.rank + 1}.` };
  return { rows, rank: -1, out: outLine(row, 'NOT KEPT.'), note: NOTE_REFUSED, say: `Local leader board. ${row.name}, ${row.score}. ${NOTE_REFUSED}` };
}
