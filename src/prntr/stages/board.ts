import { reducedMotion, wait } from '../anim';
import { BOARD_MAX, pinRow, rankOf, readBoard, today, type BoardRow, type BoardWrite } from '../board';
import { NOTE_REFUSED, buildBoardCard, outLine } from '../boardCard';
import type { Handoff, Stage } from '../types';

/** The card waits for the burst's pieces to land under the tune, or for GAME OVER to be seen. */
const BOARD_AFTER_MS = 1200;
/** Then the glimpse holds this long and the stage ends on its own: the app drops in, the board riding down with the room. */
export const BOARD_HOLD_MS = 1000;

/**
 * Stage 2, the board's glimpse (PRNTR-BOARD.md §14, §15): over the room's last frame, the local leader board for
 * BOARD_HOLD_MS, then the handoff passed on unchanged and the app drops in; the board comes up again over the app
 * (PrntrBoard), where its buttons are. A cleared run with a name is written the moment the card comes up, its row in the
 * HUD's yellow; a cleared run without one (NULL) shows at its rank, not yet written (the app side writes it); a run that
 * does not rank, or a game over (never written), is a grey line under the rows. Runs after a game over too (afterOver).
 * Started by the dev entrance (`start`) it shows the board with no run.
 */
export const board: Stage = {
  name: 'board',
  afterOver: true,
  async run(ctx, input) {
    const { root, signal } = ctx;
    if (input.kind !== 'start') await wait(BOARD_AFTER_MS, signal);
    if (signal.aborted) return { kind: 'start' };
    const run: BoardRow | null =
      input.kind === 'start' ? null : { name: input.player, score: input.score, at: today(), won: input.kind === 'cleared' };

    const dim = document.createElement('div');
    dim.className = 'prntr-board';
    dim.setAttribute('role', 'dialog');
    dim.setAttribute('aria-label', 'Local leader board');
    const { card, showRows, showOut } = buildBoardCard({ buttons: false });
    if (reducedMotion()) card.classList.add('is-still');
    dim.append(card);
    // a press on the dim or the card is nothing: never the room's reload
    dim.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
    root.append(dim);

    const rows = readBoard();
    const rank = run ? rankOf(rows, run.score) : -1;
    let say: string;
    // what became of a cleared run, for the board over the app (it does not look the row up again)
    let write: BoardWrite = { kind: 'unranked' };
    if (run && run.won && rank !== -1 && run.name !== 'NULL') {
      // only a cleared run gets on the board; with a name it is written now
      const kept = pinRow(run);
      if (kept) {
        write = { kind: 'kept', rank: kept.rank };
        showRows(kept.rows, kept.rank);
        showOut('', '');
        say = `Local leader board. ${run.name}, ${run.score}, number ${kept.rank + 1}.`;
      } else {
        write = { kind: 'refused' };
        showRows(rows, -1);
        showOut(outLine(run, 'NOT KEPT.'), NOTE_REFUSED);
        say = `Local leader board. ${run.name}, ${run.score}. ${NOTE_REFUSED}`;
      }
    } else if (run && run.won && rank !== -1) {
      // no name yet: the row where it would go, written on the app side once the name is answered
      write = { kind: 'unnamed' };
      showRows([...rows.slice(0, rank), run, ...rows.slice(rank)].slice(0, BOARD_MAX), rank);
      showOut('', '');
      say = `Local leader board. ${run.score}, number ${rank + 1}.`;
    } else if (run) {
      showRows(rows, -1);
      showOut(outLine(run, 'NOT ON IT.'), '');
      say = `Local leader board. ${run.name}, ${run.score}${run.won ? '' : ', game over'}, not on it.`;
    } else {
      showRows(rows, -1);
      showOut('', '');
      say = rows.length === 0 ? 'The board is empty.' : `The board: ${rows.length} row${rows.length === 1 ? '' : 's'}.`;
    }
    ctx.announce(say);

    await wait(BOARD_HOLD_MS, signal);
    if (signal.aborted) return { kind: 'start' };
    return input.kind === 'cleared' ? { ...input, board: write } : (input as Handoff);
  },
};
