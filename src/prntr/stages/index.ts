import type { Stage } from '../types';
import { opening } from './opening';

/** The chain, in play order. The dev entrance ?prntr=N starts at index N. */
export const STAGES: readonly Stage[] = [opening];
