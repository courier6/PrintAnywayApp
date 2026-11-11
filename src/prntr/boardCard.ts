import { BOARD_MAX, BOARD_NAME_MAX, rowLine, type BoardRow } from './board';
import { CUT_MARK } from './stages/opening';

/** The card's two views (PRNTR-BOARD.md §18): the board kept in this browser, and the world's top ten. */
export type BoardView = 'local' | 'world';
const TITLES: Record<BoardView, string> = { local: 'LOCAL LEADERBOARD', world: 'WORLD TOP 10' };
/** The opening's cut mark, small, in the card's colours: its black as the title's yellow, its dark red as the mat. */
const BOARD_MARK = CUT_MARK.replace('prntr-card-cutmark', 'prntr-board-mark')
  .replace(/prntr-cut-sil/g, 'prntr-board-sil')
  .replace(/#000/g, '#FFD91A')
  .replace(/#5C0A12/g, '#1E1433');

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
  /** The switch under the title (§18): LOCAL, the view the card comes up on, and WORLD. */
  localTab: HTMLButtonElement;
  worldTab: HTMLButtonElement;
  /** Shows a view: its title, its tab pressed. WORLD is COMING SOON over the cut mark, with CONTINUE alone. */
  showView: (view: BoardView) => void;
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
  /** The clear's question in the buttons' place, or the buttons back. WORLD cannot be pressed while it is asked. */
  asking: (on: boolean) => void;
  /** The board as it will be with `run` on it at `rank`: its row marked, the name's field in the name's place, and OK
   * alone in the buttons' place; WORLD cannot be pressed meanwhile. showRows ends it. */
  askName: (rows: BoardRow[], rank: number, run: { score: number; at: string; won: boolean }) => void;
}

/**
 * The board's card (PRNTR-BOARD.md §14–§18): the title, the LOCAL / WORLD switch, then the view. LOCAL: the rows (or
 * NOBODY YET.), the run's out line, the name's field in its row with OK, CONTINUE, CLEAR THE BOARD and the clear's
 * question (YOU SURE?, YES, CANCEL), then the note. WORLD (WORLD TOP 10): COMING SOON over the cut mark, and CONTINUE.
 */
export function buildBoardCard(): BoardCard {
  const card = el('div', 'prntr-board-card');
  const title = el('div', 'prntr-board-title', TITLES.local);
  const tabsEl = el('div', 'prntr-board-tabs');
  const localTab = button('prntr-board-tab', 'LOCAL');
  const worldTab = button('prntr-board-tab', 'WORLD');
  tabsEl.append(localTab, worldTab);
  // the local view's own parts, in a box that lays out as if it were not there, so one class on the card hides them
  const localEl = el('div', 'prntr-board-local');
  // the world's place until there is a world board: a ribbon over the cut mark
  const soonEl = el('div', 'prntr-board-soon');
  soonEl.append(el('div', 'prntr-board-ribbon', 'COMING SOON'));
  soonEl.insertAdjacentHTML('beforeend', BOARD_MARK);
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
  localEl.append(rowsEl, emptyEl, outEl, sureEl);
  card.append(title, tabsEl, localEl, soonEl, buttonsEl, note);
  sureEl.hidden = yesBtn.hidden = cancelBtn.hidden = okBtn.hidden = true;

  const showView = (view: BoardView) => {
    card.classList.toggle('is-world', view === 'world');
    title.textContent = TITLES[view];
    localTab.setAttribute('aria-pressed', String(view === 'local'));
    worldTab.setAttribute('aria-pressed', String(view === 'world'));
  };
  showView('local');

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
    worldTab.disabled = false;
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
    // a question is the local board's: it is answered before the view can change
    worldTab.disabled = on;
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
    worldTab.disabled = true;
  };
  return { card, localTab, worldTab, showView, goBtn, clearBtn, yesBtn, cancelBtn, nameInput, okBtn, showRows, showOut, asking, askName };
}
