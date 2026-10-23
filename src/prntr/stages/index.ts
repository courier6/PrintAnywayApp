import type { Stage } from '../types';
import { board } from './board';
import { opening } from './opening';
import { room } from './room';

/** The chain, in play order. The dev entrance ?prntr=N starts at index N. */
export const STAGES: readonly Stage[] = [opening, room, board];
