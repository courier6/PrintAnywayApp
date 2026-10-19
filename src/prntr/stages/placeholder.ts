import { nextInput } from '../anim';
import type { Stage } from '../types';

/** Stands in until the opening lands: the name, wait for a press. */
export const placeholder: Stage = {
  name: 'placeholder',
  async run(ctx) {
    const p = document.createElement('p');
    p.className = 'prntr-placeholder';
    p.textContent = 'Prntr';
    ctx.root.replaceChildren(p);
    await nextInput(ctx.root, ctx.signal);
    ctx.root.replaceChildren();
    return { kind: 'start' };
  },
};
