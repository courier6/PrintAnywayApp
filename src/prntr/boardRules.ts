/**
 * The board's name and score rules, with no DOM, no storage and no imports: the game (board.ts, the room) and the
 * world board's server (board-worker/src/index.ts) both read them here, so the server refuses exactly what the game
 * would never write.
 */

/** As the badge's name (PRNTR-BADGE.md §8.3): A–Z, 0–9 and spaces, twelve at most. */
export const BOARD_NAME_MAX = 12;
export const BOARD_SCORE_MAX = 9999;
/** The machine's life, so the lowest score a cleared run can have: every point off the machine goes on the score. */
export const CLEARED_SCORE_MIN = 1337;

/** A name as the badge and the board take it: upper case, A–Z, 0–9 and single spaces, trimmed, BOARD_NAME_MAX at most. */
export const cleanName = (s: string) =>
  s.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/ +/g, ' ').trim().slice(0, BOARD_NAME_MAX);
