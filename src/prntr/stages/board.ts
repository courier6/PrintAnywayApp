import { reducedMotion, wait } from '../anim';
import { clearBoard, pinRow, rankOf, readBoard, rowLine, today, type BoardRow } from '../board';
import type { Handoff, Stage } from '../types';
import { createRoomSounds } from './room/sounds';

/** The card waits for the burst's pieces to land under the tune, or for GAME OVER to be seen. */
const BOARD_AFTER_MS = 1200;
/** CLEAR THE BOARD reads SURE? this long; unpressed, it disarms. */
const CLEAR_ARM_MS = 3000;
const NOTE_KEPT = "KEPT IN THIS BROWSER'S LOCALSTORAGE. NOTHING IS SENT.";
const NOTE_REFUSED = "COULDN'T KEEP IT HERE. THE BROWSER SAID NO.";
const NOTE_NOT_CLEARED = "COULDN'T CLEAR IT. THE BROWSER SAID NO.";

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = text;
  return b;
}

/**
 * Stage 2, the board (PRNTR-BOARD.md): over the room's last frame, the question (PIN IT / LEAVE IT)
 * when the run ranks, else the board itself; then CONTINUE hands the room's handoff on unchanged.
 * Runs after a game over too (afterOver). Started by the dev entrance (`start`) it shows the board
 * with nothing to pin.
 */
export const board: Stage = {
  name: 'board',
  afterOver: true,
  async run(ctx, input) {
    const { root, signal } = ctx;
    if (input.kind !== 'start') await wait(BOARD_AFTER_MS, signal);
    if (signal.aborted) return { kind: 'start' };
    const sounds = createRoomSounds(ctx.audio);
    const run: BoardRow | null =
      input.kind === 'start' ? null : { name: input.player, score: input.score, at: today(), won: input.kind === 'cleared' };

    // ---- DOM -------------------------------------------------------------
    const dim = el('div', 'prntr-board');
    dim.setAttribute('role', 'dialog');
    dim.setAttribute('aria-label', 'The board');
    const card = el('div', 'prntr-board-card');
    if (reducedMotion()) card.classList.add('is-still');
    const title = el('div', 'prntr-board-title', 'THE BOARD');
    const runEl = el('div', 'prntr-board-run');
    const rowsEl = el('ol', 'prntr-board-rows');
    const emptyEl = el('div', 'prntr-board-empty', 'NOBODY YET.');
    const buttons = el('div', 'prntr-board-buttons');
    const pinBtn = button('prntr-board-pin', 'PIN IT');
    const leaveBtn = button('prntr-board-leave', 'LEAVE IT');
    const goBtn = button('prntr-board-go', 'CONTINUE');
    const clearBtn = button('prntr-board-clear', 'CLEAR THE BOARD');
    const note = el('div', 'prntr-board-note');
    buttons.append(pinBtn, leaveBtn, goBtn, clearBtn);
    card.append(title, runEl, rowsEl, emptyEl, buttons, note);
    dim.append(card);
    // a press on the dim or the card is nothing: never the room's reload
    dim.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
    root.append(dim);

    // ---- modes -----------------------------------------------------------
    const showRows = (rows: BoardRow[], newRank: number) => {
      rowsEl.replaceChildren();
      rows.forEach((r, i) => {
        const li = el('li', '', rowLine(i, r));
        if (i === newRank) li.classList.add('is-new');
        if (!r.won) li.classList.add('is-lost');
        rowsEl.append(li);
      });
      rowsEl.hidden = rows.length === 0;
      emptyEl.hidden = rows.length > 0;
      clearBtn.hidden = rows.length === 0;
    };
    const runLine = (r: BoardRow) => `${r.name}  ${String(r.score).padStart(4, '0')}  ${r.won ? 'CLEARED' : 'GAME OVER'}`;
    const ask = () => {
      if (!run) return;
      runEl.textContent = runLine(run);
      runEl.hidden = false;
      rowsEl.hidden = true;
      emptyEl.hidden = true;
      pinBtn.hidden = false;
      leaveBtn.hidden = false;
      goBtn.hidden = true;
      clearBtn.hidden = true;
      note.textContent = NOTE_KEPT;
      pinBtn.focus();
      ctx.announce(`The board. ${run.name}, ${run.score}, ${run.won ? 'cleared' : 'game over'}. Pin it to this browser's board?`);
    };
    const showBoard = (rows: BoardRow[], newRank: number, noteText: string, say: string) => {
      pinBtn.hidden = true;
      leaveBtn.hidden = true;
      goBtn.hidden = false;
      showRows(rows, newRank);
      note.textContent = noteText;
      goBtn.focus();
      ctx.announce(say);
    };
    const rowsWord = (n: number) => (n === 0 ? 'The board is empty.' : `The board: ${n} row${n === 1 ? '' : 's'}.`);

    // ---- the clear's two presses ----------------------------------------
    let armed = 0;
    const disarm = () => {
      window.clearTimeout(armed);
      armed = 0;
      clearBtn.textContent = 'CLEAR THE BOARD';
    };
    clearBtn.addEventListener(
      'click',
      () => {
        sounds.uiClick();
        if (!armed) {
          clearBtn.textContent = 'SURE?';
          armed = window.setTimeout(disarm, CLEAR_ARM_MS);
          return;
        }
        disarm();
        if (clearBoard()) {
          showRows([], -1);
          note.textContent = '';
          goBtn.focus();
          ctx.announce('The board is cleared.');
        } else {
          note.textContent = NOTE_NOT_CLEARED;
        }
      },
      { signal },
    );
    signal.addEventListener('abort', disarm, { once: true });

    // ---- the first mode ---------------------------------------------------
    const rows = readBoard();
    if (run && rankOf(rows, run.score) !== -1) ask();
    else if (run) {
      runEl.textContent = `${runLine(run)}. NOT ON IT.`;
      runEl.hidden = false;
      showBoard(rows, -1, '', `${rowsWord(rows.length)} This run, ${run.name}, ${run.score}, is not on it.`);
    } else {
      runEl.hidden = true;
      showBoard(rows, -1, '', rowsWord(rows.length));
    }

    // ---- the answer -------------------------------------------------------
    return new Promise<Handoff>((resolve) => {
      const finish = () => resolve(input);
      signal.addEventListener('abort', () => resolve({ kind: 'start' }), { once: true });
      pinBtn.addEventListener(
        'click',
        () => {
          sounds.uiClick();
          if (!run) return;
          const kept = pinRow(run);
          if (kept) showBoard(kept.rows, kept.rank, '', `Pinned at number ${kept.rank + 1}.`);
          else showBoard(readBoard(), -1, NOTE_REFUSED, NOTE_REFUSED);
        },
        { signal },
      );
      leaveBtn.addEventListener('click', () => { sounds.uiClick(); finish(); }, { signal });
      goBtn.addEventListener('click', () => { sounds.uiClick(); finish(); }, { signal });
    });
  },
};
