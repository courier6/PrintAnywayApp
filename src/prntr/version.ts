/**
 * The game's version, shown under the title from INSERT COIN on (PRNTR-VERSION.md).
 * vMAJOR.MINOR.PATCH: MAJOR is the game's era (1 the room, 2 the fight), MINOR goes up by one
 * per feature (PATCH back to 0), PATCH by one per fix. Bumped by hand in the last commit of
 * every feature or fix branch; nothing derives it. Counted back over develop's merges: thirty
 * features before this one, so the version line itself is the thirty-first.
 */
export const PRNTR_VERSION = 'v1.33.1';

/** What the version reads in the opening's corrupted frame, beside © 1951. */
export const PRNTR_VERSION_CORRUPT = 'v0.19.51';
