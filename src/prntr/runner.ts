import type { Handoff, Stage, StageContext } from './types';

/** Runs the stages from `startAt` on, feeding each one's handoff to the next. */
export async function runChain(
  ctx: StageContext,
  stages: readonly Stage[],
  startAt: number,
): Promise<'finished' | 'aborted'> {
  let handoff: Handoff = { kind: 'start' };
  for (let i = startAt; i < stages.length; i++) {
    handoff = await stages[i].run(ctx, handoff);
    if (ctx.signal.aborted) return 'aborted';
  }
  return 'finished';
}
