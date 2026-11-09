/**
 * The ✕ that won't let you go. Prntr is an easter egg only the curious find, so its close button is a joke: a press
 * plays a game-show "wrong answer" buzzer and the whole view glitches and runs red for a moment (prntr.css,
 * `.is-refused`). Escape still leaves; on a touch screen, which has no Escape, the second press does.
 */

/** How long the view stays refused: the glitch's ~0.3 s, then the red fading back out. Matches prntr-refuse in prntr.css. */
export const REFUSE_MS = 900;

/** A screen with no keyboard to press Escape on: there the ✕ refuses once and then lets the player go. */
export function touchOnly(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
}

/** The buzzer's two notes, [Hz, start s, length s]: a short F#3 and a longer C#3 a fourth under it ("eh-ehhh"). */
const NOTES: readonly [number, number, number][] = [
  [185.0, 0, 0.13],
  [138.6, 0.19, 0.34],
];
/** Each note is a square and a sawtooth this far apart (a ratio, ~7 cents): the beat between them is the buzz. */
const DETUNE = 1.004;
const LEVEL = 0.12;

/** Plays the buzzer through `out` (the run's master): harsh, low, hard on and hard off, through a 2.2 kHz lowpass. */
export function playWrongAnswer(ctx: AudioContext, out: AudioNode): void {
  const t0 = ctx.currentTime + 0.005;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  filter.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  filter.connect(g);
  g.connect(out);
  let last: OscillatorNode | null = null;
  for (const [f, at, len] of NOTES) {
    const a = t0 + at;
    g.gain.setValueAtTime(0, a);
    g.gain.linearRampToValueAtTime(LEVEL, a + 0.004);
    g.gain.setValueAtTime(LEVEL, a + len - 0.008);
    g.gain.linearRampToValueAtTime(0, a + len);
    for (const [type, freq] of [['square', f], ['sawtooth', f * DETUNE]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(filter);
      o.start(a);
      o.stop(a + len + 0.01);
      last = o;
    }
  }
  if (last) last.onended = () => g.disconnect();
}
