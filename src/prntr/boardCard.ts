import { BOARD_MAX, BOARD_NAME_MAX, rowLine, type BoardRow } from './board';
import { CUT_MARK } from './stages/opening';
import type { WorldRow } from './worldBoard';

/** The card's two views (PRNTR-BOARD.md §18): the board kept in this browser, and the world's top ten. */
export type BoardView = 'local' | 'world';
const TITLES: Record<BoardView, string> = { local: 'LOCAL LEADERBOARD', world: 'WORLD TOP 10' };
/** The opening's cut mark in the card's colours: its black as the element's colour (the title's yellow on WORLD, a
 * tone of the mat behind the local rows), its dark red as the mat. */
const BOARD_MARK = CUT_MARK.replace('prntr-card-cutmark', 'prntr-board-mark')
  .replace(/prntr-cut-sil/g, 'prntr-board-sil')
  .replace(/#000/g, 'currentColor')
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

/** What the WORLD view shows (PRNTR-WORLD-BOARD.md §5): the ribbon over the cut mark while the server is asked
 * (`wait`) or when it gave no answer (`down`); or the world's rows, the run's own marked at `rank` (-1: none), and a
 * line under them, in the run's colour when it is `own` (NO. 4 IN THE WORLD) and grey otherwise. */
export type WorldView = { kind: 'wait' } | { kind: 'down' } | { kind: 'rows'; rows: WorldRow[]; rank: number; out: string; own: boolean };
const RIBBON: Record<'wait' | 'down', string> = { wait: 'CALLING...', down: 'NO ANSWER' };
/** The line of a run that is on the world's ten, in the rows' column. */
export const worldLine = (rank: number) => `   NO. ${rank + 1} IN THE WORLD`;
export const WORLD_NOT_SENT = '   NOT SENT. NO ANSWER.';
export const WORLD_NAME_REFUSED = '   THAT NAME STAYS LOCAL.';

/** The run's line under the rows: three blanks for the rank column, then the name and the score as a row has them. */
export const outLine = (r: { name: string; score: number }, word: string) => `   ${r.name.padEnd(BOARD_NAME_MAX)} ${String(r.score).padStart(4, '0')} ${word}`;

export interface BoardCard {
  card: HTMLElement;
  /** The switch under the title (§18): LOCAL, the view the card comes up on, and WORLD. */
  localTab: HTMLButtonElement;
  worldTab: HTMLButtonElement;
  /** Shows a view: its title, its tab pressed. The view not shown keeps its place unseen, so the card is one size on
   * both (§19). */
  showView: (view: BoardView) => void;
  /** What the WORLD view holds. A run on the world's ten also has its line under the local rows, where no other line
   * is. */
  showWorld: (w: WorldView) => void;
  goBtn: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
  yesBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  /** The name asked for (§15.3, §17): the field, in the run's row where it will stand on the board, and OK. */
  nameInput: HTMLInputElement;
  okBtn: HTMLButtonElement;
  /** The rows, the run's own row marked at newRank (-1: none); a game over's row is grey, a cleared one has a star
   * before it. The own row's marker blinks: its star, or an arrow on a game over's. */
  showRows: (rows: BoardRow[], newRank: number) => void;
  /** The grey line under the rows ('' hides it) and the note. */
  showOut: (text: string, note: string) => void;
  /** The clear's question (YOU SURE?, YES, CANCEL) in the buttons' place, or the buttons back. WORLD cannot be pressed
   * while it is asked. */
  asking: (on: boolean) => void;
  /** The board as it will be with `run` on it at `rank`: its row marked, the name's field in the name's place, and OK
   * alone in the buttons' place; WORLD cannot be pressed meanwhile. showRows ends it. */
  askName: (rows: BoardRow[], rank: number, run: { score: number; at: string; won: boolean }) => void;
}

/**
 * The board's card (PRNTR-BOARD.md §14–§19): the title, the LOCAL / WORLD switch, the view, the buttons, the note.
 * LOCAL: the rows (or NOBODY YET.), the run's out line, the name's field in its row. WORLD (WORLD TOP 10): the world's
 * rows and the run's line, or a ribbon over the cut mark while there are none to show. The card is one size on both
 * views and in every state (§19): the views share one place, ten rows and the out line tall, and the buttons are three
 * sets sharing one place (CONTINUE and CLEAR THE BOARD; YOU SURE?, YES and CANCEL; OK), one of them seen.
 */
export function buildBoardCard(): BoardCard {
  const card = el('div', 'prntr-board-card');
  const title = el('div', 'prntr-board-title', TITLES.local);
  const tabsEl = el('div', 'prntr-board-tabs');
  const localTab = button('prntr-board-tab', 'LOCAL');
  const worldTab = button('prntr-board-tab', 'WORLD');
  tabsEl.append(localTab, worldTab);
  // the two views in one place: the local one keeps its room on WORLD, unseen, so the card cannot change size
  const bodyEl = el('div', 'prntr-board-body');
  const localEl = el('div', 'prntr-board-local');
  // the rows, NOBODY YET. and the out line, sharing a left edge
  const listEl = el('div', 'prntr-board-list');
  // the world's place while it has no rows to show: a ribbon over the cut mark. Behind rows, local or the world's,
  // the mark alone stays, larger and dim
  const soonEl = el('div', 'prntr-board-soon');
  const ribbonEl = el('div', 'prntr-board-ribbon', RIBBON.wait);
  soonEl.append(ribbonEl);
  soonEl.insertAdjacentHTML('beforeend', BOARD_MARK);
  // the world's rows, laid out as the local ones
  const worldEl = el('div', 'prntr-board-world');
  const worldListEl = el('div', 'prntr-board-list');
  const worldRowsEl = el('ol', 'prntr-board-rows');
  const worldEmptyEl = el('div', 'prntr-board-empty', 'NOBODY YET.');
  const worldOutEl = el('div', 'prntr-board-run is-out');
  // until there are rows to show, the list is the rows' room alone, as tall as the local one
  worldEmptyEl.hidden = true;
  worldOutEl.hidden = true;
  worldListEl.append(worldRowsEl, worldEmptyEl, worldOutEl);
  worldEl.append(worldListEl);
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
  // the buttons in three sets sharing one place; the two that are not asked for keep their room, unseen
  const goSet = el('div', 'prntr-board-set');
  const sureSet = el('div', 'prntr-board-set');
  const okSet = el('div', 'prntr-board-set');
  goSet.append(goBtn, clearBtn);
  sureSet.append(sureEl, yesBtn, cancelBtn);
  okSet.append(okBtn);
  // WORLD shows CONTINUE alone, so the first set's room (two lines of buttons on a phone) is kept by a copy of it
  // that is never seen, pressed or read out
  const roomSet = el('div', 'prntr-board-set is-off');
  roomSet.setAttribute('aria-hidden', 'true');
  for (const text of [goBtn.textContent, clearBtn.textContent]) {
    const b = button('prntr-board-room', text ?? '');
    b.disabled = true;
    b.tabIndex = -1;
    roomSet.append(b);
  }
  buttonsEl.append(goSet, sureSet, okSet, roomSet);
  listEl.append(rowsEl, emptyEl, outEl);
  localEl.append(listEl);
  bodyEl.append(localEl, worldEl, soonEl);
  card.append(title, tabsEl, bodyEl, buttonsEl, note);

  const showSet = (on: HTMLElement) => {
    for (const set of [goSet, sureSet, okSet]) set.classList.toggle('is-off', set !== on);
  };
  showSet(goSet);
  // CLEAR THE BOARD keeps its place on an empty local board, greyed; on WORLD it is not shown at all (prntr.css),
  // and it stays disabled there
  let world = false;
  let filled = false;
  let worldRows = false;
  const syncClear = () => {
    clearBtn.disabled = world || !filled;
  };
  // behind rows the mark is a backdrop, not a picture to read out; the view not shown is not read out either
  const syncHidden = () => {
    const set = (node: HTMLElement, hidden: boolean) => (hidden ? node.setAttribute('aria-hidden', 'true') : node.removeAttribute('aria-hidden'));
    set(soonEl, !world || worldRows);
    set(worldEl, !world || !worldRows);
  };

  const showView = (view: BoardView) => {
    world = view === 'world';
    syncClear();
    syncHidden();
    card.classList.toggle('is-world', world);
    title.textContent = TITLES[view];
    localTab.setAttribute('aria-pressed', String(view === 'local'));
    worldTab.setAttribute('aria-pressed', String(view === 'world'));
  };
  showView('local');

  // the line under the local rows: the run's own (NOT ON IT., NOT KEPT.), or else its place in the world
  let localOut = '';
  let worldOwn = '';
  const syncOut = () => {
    const text = localOut || worldOwn;
    outEl.textContent = text;
    outEl.hidden = text === '';
    outEl.classList.toggle('is-own', localOut === '' && worldOwn !== '');
  };
  const showWorld = (w: WorldView) => {
    worldRows = w.kind === 'rows';
    card.classList.toggle('has-world', worldRows);
    syncHidden();
    worldOwn = '';
    if (w.kind === 'rows') {
      worldRowsEl.replaceChildren();
      w.rows.forEach((r, i) => {
        const li = el('li', '', rowLine(i, { ...r, won: true }));
        if (i === w.rank) li.classList.add('is-new');
        worldRowsEl.append(li);
      });
      worldRowsEl.hidden = w.rows.length === 0;
      worldEmptyEl.hidden = w.rows.length > 0;
      worldOutEl.textContent = w.out;
      worldOutEl.hidden = w.out === '';
      worldOutEl.classList.toggle('is-own', w.own);
      if (w.own) worldOwn = w.out;
    } else {
      ribbonEl.textContent = RIBBON[w.kind];
    }
    syncOut();
  };

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
    filled = rows.length > 0;
    syncClear();
    showSet(goSet);
    worldTab.disabled = false;
  };
  const showOut = (text: string, noteText: string) => {
    localOut = text;
    syncOut();
    note.textContent = noteText;
  };
  const asking = (on: boolean) => {
    showSet(on ? sureSet : goSet);
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
    showSet(okSet);
    worldTab.disabled = true;
  };
  return { card, localTab, worldTab, showView, showWorld, goBtn, clearBtn, yesBtn, cancelBtn, nameInput, okBtn, showRows, showOut, asking, askName };
}
