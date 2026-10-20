import { nextInput, reducedMotion, wait } from '../anim';
import type { Stage } from '../types';
import { H, W } from './room/pixels';
import { startStorm, type StormSlot } from './storm';

/** 0 = every letter on the baseline, 1 = approved, 2 = twice as messy. */
const WOBBLE = 1;
const POP_MS = 200;
/** The Simple Products card, fades included. */
const CARD_MS = 1250;
/** From the last letter landing to the credit flip and its coin cue. */
const CREDIT_AFTER_TITLE_MS = 2000;
/** Length of the credit glow (must match prntr-glow in prntr.css). */
const GLOW_MS = 1500;
/**
 * The flicker before the flip (Edgar, 2026-10-19; not in the design handoff):
 * the same view, corrupted, shown twice for a few frames. Pairs of
 * [on, off] in ms before the flip.
 */
const FLICKER: [number, number][] = [
  [250, 180],
  [130, 40],
];
const COPYRIGHT = '© 2026 SIMPLE PRODUCTS';
/** What the copyright line reads in the corrupted frame. */
const COPYRIGHT_CORRUPT = '© 1951 simple products llc';

const LETTERS = [
  { ch: 'p', color: '#19B8F0', y: 0, rot: 0 },
  { ch: 'r', color: '#F0288C', y: 0, rot: 0 },
  { ch: 'n', color: '#FFD91A', y: -0.08, rot: -5 },
  { ch: 't', color: '#FF6A2B', y: 0.1, rot: 6 },
  { ch: 'r', color: '#46D36E', y: -0.17, rot: -9 },
];

/** The Simple Products mark: the surviving SNARC neuron, verbatim from the storyboard. */
const LOGO =
  '<svg class="prntr-card-logo" viewBox="0 0 160 96" role="img" aria-label="Simple Products logo: silhouette of a SNARC neuron" fill="#EDEDED">' +
  '<rect x="14" y="20" width="9" height="42" rx="4.5"></rect>' +
  '<rect x="27" y="28" width="9" height="34" rx="4.5"></rect>' +
  '<rect x="40" y="18" width="9" height="44" rx="4.5"></rect>' +
  '<rect x="53" y="32" width="9" height="30" rx="4.5"></rect>' +
  '<rect x="66" y="24" width="9" height="38" rx="4.5"></rect>' +
  '<rect x="79" y="30" width="9" height="32" rx="4.5"></rect>' +
  '<rect x="94" y="28" width="11" height="34" rx="2"></rect>' +
  '<rect x="110" y="38" width="30" height="22" rx="5"></rect>' +
  '<rect x="139" y="46" width="8" height="5"></rect>' +
  '<circle cx="150" cy="48.5" r="7"></circle>' +
  '<rect x="6" y="58" width="146" height="22"></rect>' +
  '<rect x="0" y="80" width="158" height="5"></rect>' +
  '<path d="M18 20 C 30 4, 70 6, 99 28" fill="none" stroke="#EDEDED"></path>' +
  '<path d="M44 18 C 60 6, 96 14, 114 38" fill="none" stroke="#EDEDED"></path>' +
  '<circle cx="30" cy="69" r="6.5" fill="#000000"></circle>' +
  '<circle cx="32.5" cy="66.5" r="1.6"></circle>' +
  '<rect x="60" y="65" width="24" height="3" fill="#000000"></rect>' +
  '<rect x="60" y="71" width="24" height="3" fill="#000000"></rect>' +
  '</svg>';

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Stage 0, the opening: Simple Products presents prntr. Plays it completely
 * straight; the only cracks are the detuned note in the cue and the credit
 * event. Design: prntr/design/PRNTR-HANDOFF.md §3–§7 (local), spec: PRNTR-STAGE-0.md.
 */
export const opening: Stage = {
  name: 'opening',
  async run(ctx) {
    const { root, signal, audio } = ctx;
    const reduced = reducedMotion();
    root.replaceChildren();

    // Beats 1–2: the card, 1.25s in total (in 250ms, hold, out 250ms).
    const card = el('div', 'prntr-card');
    card.innerHTML =
      `<div class="prntr-card-brand">${LOGO}<div class="prntr-card-name">SIMPLE PRODUCTS</div></div>` +
      '<div class="prntr-card-presents">presents…</div>';
    root.append(card);
    const t0 = performance.now();
    await wait(Math.max(0, t0 + CARD_MS - performance.now()), signal);
    // The title must not flash a fallback face: hold (black) until the fonts are in, at most 1.5s more.
    await Promise.race([ctx.fontsReady, wait(1500, signal)]);
    if (signal.aborted) return { kind: 'start' };
    card.remove();

    // Beat 3: the title. The cue and the first letter start together; the last
    // letter lands exactly as the cue's first pass ends. The cue then keeps
    // going, winding down like a tape stop, until the coin cue cuts it off.
    const cue = audio.pickDiscovery();
    const cutCue = audio.playSlowing(cue, cue.duration, cue.duration + CREDIT_AFTER_TITLE_MS / 1000);
    const d = Math.round(cue.duration * 1000);
    const t1 = performance.now();
    const at = (ms: number) => wait(Math.max(0, t1 + ms - performance.now()), signal);
    const wrap = el('div', 'prntr-title-wrap');
    const h1 = el('h1', 'prntr-title');
    h1.setAttribute('aria-label', 'prntr');
    const stormSlots: StormSlot[] = [];
    /** When each letter is solid (its pop done), so the rain lands on it only then. */
    const inAt: number[] = [];
    LETTERS.forEach((l, i) => {
      const slot = el('span', 'prntr-title-slot');
      stormSlots.push({ el: slot, ch: l.ch, rot: l.rot * WOBBLE });
      inAt.push(reduced ? d : Math.round((i * (d - POP_MS)) / 4) + POP_MS);
      slot.setAttribute('aria-hidden', 'true');
      slot.style.color = l.color;
      if (l.y !== 0 || l.rot !== 0) {
        // A custom property, not an inline transform, so the corrupted frame can override it.
        slot.style.setProperty('--prntr-wobble', `translateY(${l.y * WOBBLE}em) rotate(${l.rot * WOBBLE}deg)`);
      }
      const letter = el('span', 'prntr-letter', l.ch);
      letter.style.animation = reduced
        ? `prntr-fade ${d}ms linear forwards`
        : `prntr-pop ${POP_MS}ms ease-out ${Math.round((i * (d - POP_MS)) / 4)}ms forwards`;
      slot.append(letter);
      h1.append(slot);
    });
    wrap.append(h1);
    root.append(wrap);
    // The cloud over the word (Edgar, 2026-10-19): white now, red through the flicker, the storm
    // from the flip on (2026-10-20). Stopped with the stage.
    const storm = startStorm(root, h1, stormSlots, (i) => performance.now() >= t1 + inAt[i], reduced);
    signal.addEventListener('abort', () => storm.stop(), { once: true });
    ctx.announce('Simple Products presents prntr');

    // Beat 4: INSERT COIN, half a second after the last letter lands. Input does nothing.
    await at(d + 500);
    // The arcade layer is the room's frame (240×160 at the largest whole-number scale,
    // centred), so INSERT COIN and the footer sit where the room's HUD will put its caption
    // and CREDIT, and nothing jumps at the cut (Edgar, 2026-10-19).
    const arcade = el('div', 'prntr-arcade');
    const fit = () => arcade.style.setProperty('--s', String(Math.max(1, Math.floor(Math.min(root.clientWidth / W, root.clientHeight / H)))));
    fit();
    window.addEventListener('resize', fit, { signal });
    const promptRow = el('div', 'prntr-prompt-row');
    const prompt = el('div', 'prntr-prompt', 'INSERT COIN');
    if (!reduced) prompt.classList.add('is-blinking');
    promptRow.append(prompt);
    const footer = el('div', 'prntr-footer');
    const credit = el('div', 'prntr-credit', 'CREDIT 00');
    const corruptLine = el('div', 'prntr-copyright-corrupt', COPYRIGHT_CORRUPT);
    corruptLine.setAttribute('aria-hidden', 'true');
    footer.append(credit, el('div', 'prntr-copyright', COPYRIGHT), corruptLine);
    arcade.append(promptRow, footer);
    root.append(arcade);
    ctx.announce('Insert coin');

    // Beat 5: the credit event, two seconds after the title is fully in: 1.5s of
    // silent glow (starting as the prompt appears), then everything flips on one tick.
    await at(d + CREDIT_AFTER_TITLE_MS - GLOW_MS);
    credit.classList.add('is-glowing');
    // The flicker: something shows through. Under reduced motion one steady
    // corrupted frame instead of two flashes.
    const corrupt = (on: boolean) => root.classList.toggle('is-corrupt', on);
    for (const [on, off] of reduced ? [[250, 90]] : FLICKER) {
      await at(d + CREDIT_AFTER_TITLE_MS - on);
      corrupt(true);
      storm.setWeather('red');
      await at(d + CREDIT_AFTER_TITLE_MS - off);
      corrupt(false);
    }
    await at(d + CREDIT_AFTER_TITLE_MS);
    if (signal.aborted) return { kind: 'start' };
    credit.textContent = 'CREDIT 01';
    credit.classList.remove('is-glowing');
    credit.classList.add('is-after');
    storm.setWeather('storm');
    prompt.textContent = 'PRESS START BUTTON';
    if (!reduced) {
      // Restart the blink so the new prompt is visible on the flip, not mid-"off".
      prompt.classList.remove('is-blinking');
      void prompt.offsetWidth;
      prompt.classList.add('is-blinking');
    }
    cutCue();
    audio.play(audio.cues.creditA);
    ctx.announce('Credit 1. Press start button.');

    await nextInput(root, signal);
    storm.stop();
    root.replaceChildren();
    return { kind: 'start' };
  },
};
