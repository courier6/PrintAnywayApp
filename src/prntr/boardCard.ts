import { BOARD_MAX, BOARD_NAME_MAX, rowLine, type BoardRow } from './board';

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
  /** The name asked for (§15.3, §17): the field, in the run's row where it will stand on the board, and OK. */
  nameInput: HTMLInputElement;
  okBtn: HTMLButtonElement;
  /** The rows, the run's own row marked at newRank (-1: none); a game over's row is grey, a cleared one has a star. */
  showRows: (rows: BoardRow[], newRank: number) => void;
  /** The grey line under the rows ('' hides it) and the note. */
  showOut: (text: string, note: string) => void;
  /** The clear's question in the buttons' place, or the buttons back. */
  asking: (on: boolean) => void;
  /** The board as it will be with `run` on it at `rank`: its row marked, the name's field in the name's place, and OK
   * alone in the buttons' place. showRows ends it. */
  askName: (rows: BoardRow[], rank: number, run: { score: number; at: string; won: boolean }) => void;
}

/**
 * The board's card (PRNTR-BOARD.md §14–§17): LOCAL LEADERBOARD, the rows (or NOBODY YET.), the run's out line, the
 * name's field in its row with OK, CONTINUE, CLEAR THE BOARD and the clear's question (YOU SURE?, YES, CANCEL), then the note.
 */
export function buildBoardCard(): BoardCard {
  const card = el('div', 'prntr-board-card');
  const title = el('div', 'prntr-board-title', 'LOCAL LEADERBOARD');
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
  // the name asked for a ranking run the badge left NULL: a field in the name's place of the run's row, and OK
  const nameInput = document.createElement('input');
  nameInput.className = 'prntr-board-name';
  nameInput.type = 'text';
  nameInput.maxLength = BOARD_NAME_MAX;
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;
  nameInput.setAttribute('autocapitalize', 'characters');
  nameInput.enterKeyHint = 'done';
  nameInput.placeholder = 'ENTER NAME';
  nameInput.setAttribute('aria-label', 'Your name');
  const okBtn = button('prntr-board-ok', 'OK');
  const note = el('div', 'prntr-board-note');
  buttonsEl.append(okBtn, goBtn, clearBtn, yesBtn, cancelBtn);
  card.append(title, rowsEl, emptyEl, outEl, sureEl, buttonsEl, note);
  sureEl.hidden = yesBtn.hidden = cancelBtn.hidden = okBtn.hidden = true;

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
    okBtn.hidden = true;
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
  const askName = (rows: BoardRow[], rank: number, run: { score: number; at: string; won: boolean }) => {
    // the board as the write will leave it: the run in at its rank, the row it pushes off the tenth place gone
    showRows([...rows.slice(0, rank), { name: '', ...run }, ...rows.slice(rank)].slice(0, BOARD_MAX), rank);
    const li = rowsEl.children[rank];
    const line = li.textContent ?? '';
    // `02 ` and ` 0420 11-11-2026` around the field, which is the name's twelve glyphs wide
    li.replaceChildren(line.slice(0, 3), nameInput, line.slice(3 + BOARD_NAME_MAX));
    outEl.hidden = true;
    okBtn.hidden = false;
    goBtn.hidden = true;
    clearBtn.hidden = true;
  };
  return { card, goBtn, clearBtn, yesBtn, cancelBtn, nameInput, okBtn, showRows, showOut, asking, askName };
}
