import { reducedMotion, wait } from '../anim';
import { BOARD_NAME_MAX, clearBoard, pinRow, rankOf, readBoard, rowLine, today, type BoardRow } from '../board';
import type { Handoff, Stage } from '../types';
import { createRoomSounds } from './room/sounds';

/** The card waits for the burst's pieces to land under the tune, or for GAME OVER to be seen. */
const BOARD_AFTER_MS = 1200;
/** CLEAR THE BOARD reads SURE? this long; unpressed, it disarms. */
const CLEAR_ARM_MS = 3000;
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
 * Stage 2, the board (PRNTR-BOARD.md §14): over the room's last frame, the local leader board with
 * the run already on it when it ranks (written the moment the card comes up), its row in the HUD's
 * yellow; a run that does not rank is a grey line under the rows. CONTINUE hands the room's handoff
 * on unchanged. Runs after a game over too (afterOver). Started by the dev entrance (`start`) it
 * shows the board with no run.
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
    dim.setAttribute('aria-label', 'Local leader board');
    const card = el('div', 'prntr-board-card');
    if (reducedMotion()) card.classList.add('is-still');
    const title = el('div', 'prntr-board-title', 'LOCAL LEADER BOARD');
    const rowsEl = el('ol', 'prntr-board-rows');
    const emptyEl = el('div', 'prntr-board-empty', 'NOBODY YET.');
    // the run's line when it is not on the board: under the rows, in the rows' column
    const outEl = el('div', 'prntr-board-run is-out');
    const buttons = el('div', 'prntr-board-buttons');
    const goBtn = button('prntr-board-go', 'CONTINUE');
    const clearBtn = button('prntr-board-clear', 'CLEAR THE BOARD');
    const note = el('div', 'prntr-board-note');
    buttons.append(goBtn, clearBtn);
    card.append(title, rowsEl, emptyEl, outEl, buttons, note);
    dim.append(card);
    // a press on the dim or the card is nothing: never the room's reload
    dim.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
    root.append(dim);

    // ---- the board ---------------------------------------------------------
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
    /** The run's line under the rows: three blanks for the rank column, then the name and the score as a row has them. */
    const outLine = (r: BoardRow, word: string) => `   ${r.name.padEnd(BOARD_NAME_MAX)} ${String(r.score).padStart(4, '0')} ${word}`;
    const showBoard = (rows: BoardRow[], newRank: number, outText: string, noteText: string, say: string) => {
      showRows(rows, newRank);
      outEl.textContent = outText;
      outEl.hidden = outText === '';
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

    // ---- the first paint: the run written first, when it ranks -------------
    const rows = readBoard();
    if (run && rankOf(rows, run.score) !== -1) {
      const kept = pinRow(run);
      if (kept) showBoard(kept.rows, kept.rank, '', '', `Local leader board. ${run.name}, ${run.score}, number ${kept.rank + 1}.`);
      else showBoard(rows, -1, outLine(run, 'NOT KEPT.'), NOTE_REFUSED, `Local leader board. ${run.name}, ${run.score}. ${NOTE_REFUSED}`);
    } else if (run) {
      showBoard(rows, -1, outLine(run, 'NOT ON IT.'), '', `Local leader board. ${run.name}, ${run.score}, not on it.`);
    } else {
      showBoard(rows, -1, '', '', rowsWord(rows.length));
    }

    // ---- the answer -------------------------------------------------------
    return new Promise<Handoff>((resolve) => {
      signal.addEventListener('abort', () => resolve({ kind: 'start' }), { once: true });
      goBtn.addEventListener('click', () => { sounds.uiClick(); resolve(input); }, { signal });
    });
  },
};
