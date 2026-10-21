import type { Handoff, Stage, StageContext } from './types';

/**
 * Runs the stages from `startAt` on, feeding each one's handoff to the next. Resolves
 * the last handoff (a game over ends the chain early), or null when the run was aborted.
 */
export async function runChain(
  ctx: StageContext,
  stages: readonly Stage[],
  startAt: number,
): Promise<Handoff | null> {
  let handoff: Handoff = { kind: 'start' };
  for (let i = startAt; i < stages.length; i++) {
    handoff = await stages[i].run(ctx, handoff);
    if (ctx.signal.aborted) return null;
    if (handoff.kind === 'over') break;
  }
  return handoff;
}
