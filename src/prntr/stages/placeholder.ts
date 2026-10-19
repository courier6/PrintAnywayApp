import { nextInput } from '../anim';
import type { Stage } from '../types';

/** Stands in for stage 0 until "The crack" lands: shows the page, waits for a click. */
export const placeholder: Stage = {
  name: 'placeholder',
  async run(ctx) {
    const { g, width, height, page } = ctx;
    g.drawImage(page.recolored, 0, 0, width, height);
    ctx.setCaption('Prntr');
    await nextInput(ctx.canvas, ctx.signal);
    return { kind: 'start' };
  },
};
