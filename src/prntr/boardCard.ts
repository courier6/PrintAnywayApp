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
  /** The name asked for (§15.3): the field in the run's row, and OK. */
  nameInput: HTMLInputElement;
  okBtn: HTMLButtonElement;
  /** The rows, the run's yellow row at newRank (-1: none). */
  showRows: (rows: BoardRow[], newRank: number) => void;
  /** The grey line under the rows ('' hides it) and the note. */
  showOut: (text: string, note: string) => void;
  /** The clear's question in the buttons' place, or the buttons back. */
  asking: (on: boolean) => void;
  /** The name's row (`   [name] 1341`) in the out line's place and OK alone in the buttons' (a score), or the board's
   * buttons back (null). */
  naming: (score: number | null) => void;
}

/**
 * The board's card (PRNTR-BOARD.md §14–§16): LOCAL LEADER BOARD, the rows (or NOBODY YET.), the run's out line, the
 * name's row with OK, CONTINUE, CLEAR THE BOARD and the clear's question (YOU SURE?, YES, CANCEL), then the note.
 */
export function buildBoardCard(): BoardCard {
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
  // the name asked for a ranking run the badge left NULL: a field in a row's place, the score after it, and OK
  const nameEl = el('div', 'prntr-board-run is-name');
  const nameInput = document.createElement('input');
  nameInput.className = 'prntr-board-name';
  nameInput.type = 'text';
  nameInput.maxLength = BOARD_NAME_MAX;
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;
  nameInput.setAttribute('autocapitalize', 'characters');
  nameInput.enterKeyHint = 'done';
  nameInput.placeholder = 'NULL';
  nameInput.setAttribute('aria-label', 'Your name');
  const nameScore = el('span', '');
  nameEl.append('   ', nameInput, nameScore);
  const okBtn = button('prntr-board-ok', 'OK');
  const note = el('div', 'prntr-board-note');
  buttonsEl.append(okBtn, goBtn, clearBtn, yesBtn, cancelBtn);
  card.append(title, rowsEl, emptyEl, outEl, nameEl, sureEl, buttonsEl, note);
  sureEl.hidden = yesBtn.hidden = cancelBtn.hidden = nameEl.hidden = okBtn.hidden = true;

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
  const naming = (score: number | null) => {
    const on = score !== null;
    nameEl.hidden = !on;
    okBtn.hidden = !on;
    goBtn.hidden = on;
    if (on) {
      // blanks where a row has its date, so the line is a row's width and centres into the rows' column
      nameScore.textContent = ` ${String(score).padStart(4, '0')}${' '.repeat(11)}`;
      outEl.hidden = true;
      clearBtn.hidden = true;
    }
  };
  return { card, goBtn, clearBtn, yesBtn, cancelBtn, nameInput, okBtn, showRows, showOut, asking, naming };
}
