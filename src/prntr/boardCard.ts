import { BOARD_NAME_MAX, rowLine, type BoardRow } from './board';

export const NOTE_REFUSED = "COULDN'T KEEP IT HERE. THE BROWSER SAID NO.";
export const NOTE_NOT_CLEARED = "COULDN'T CLEAR IT. THE BROWSER SAID NO.";

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

/** The run's line under the rows: three blanks for the rank column, then the name and the score as a row has them. */
export const outLine = (r: { name: string; score: number }, word: string) => `   ${r.name.padEnd(BOARD_NAME_MAX)} ${String(r.score).padStart(4, '0')} ${word}`;

export interface BoardCard {
  card: HTMLElement;
  goBtn: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
  yesBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  /** The rows, the run's yellow row at newRank (-1: none). */
  showRows: (rows: BoardRow[], newRank: number) => void;
  /** The grey line under the rows ('' hides it) and the note. */
  showOut: (text: string, note: string) => void;
  /** The clear's question in the buttons' place, or the buttons back. */
  asking: (on: boolean) => void;
}

/**
 * The board's card (PRNTR-BOARD.md §14, §15): LOCAL LEADER BOARD, the rows (or NOBODY YET.), the run's out line, and,
 * unless it is the room's glimpse, CONTINUE, CLEAR THE BOARD and the clear's question (YOU SURE?, YES, CANCEL), then
 * the note. Built by the room's board stage (the glimpse) and by the app-side board.
 */
export function buildBoardCard({ buttons }: { buttons: boolean }): BoardCard {
  const card = el('div', 'prntr-board-card');
  const title = el('div', 'prntr-board-title', 'LOCAL LEADER BOARD');
  const rowsEl = el('ol', 'prntr-board-rows');
  const emptyEl = el('div', 'prntr-board-empty', 'NOBODY YET.');
  // the run's line when it is not on the board: under the rows, in the rows' column
  const outEl = el('div', 'prntr-board-run is-out');
  const buttonsEl = el('div', 'prntr-board-buttons');
  const goBtn = button('prntr-board-go', 'CONTINUE');
  const clearBtn = button('prntr-board-clear', 'CLEAR THE BOARD');
  // the clear's question, in the buttons' place: YES clears and leaves, CANCEL is the board again
  const sureEl = el('div', 'prntr-board-sure', 'YOU SURE?');
  const yesBtn = button('prntr-board-yes', 'YES');
  const cancelBtn = button('prntr-board-cancel', 'CANCEL');
  const note = el('div', 'prntr-board-note');
  buttonsEl.append(goBtn, clearBtn, yesBtn, cancelBtn);
  card.append(title, rowsEl, emptyEl, outEl);
  if (buttons) card.append(sureEl, buttonsEl);
  card.append(note);
  sureEl.hidden = yesBtn.hidden = cancelBtn.hidden = true;

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
  const showOut = (text: string, noteText: string) => {
    outEl.textContent = text;
    outEl.hidden = text === '';
    note.textContent = noteText;
  };
  const asking = (on: boolean) => {
    sureEl.hidden = !on;
    yesBtn.hidden = !on;
    cancelBtn.hidden = !on;
    goBtn.hidden = on;
    if (on) clearBtn.hidden = true;
  };
  return { card, goBtn, clearBtn, yesBtn, cancelBtn, showRows, showOut, asking };
}
