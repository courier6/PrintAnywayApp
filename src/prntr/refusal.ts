/**
 * The ✕ that won't let you go. Prntr is an easter egg only the curious find, so its close button is a joke: a press
 * plays a game-show "wrong answer" buzzer and the whole view glitches and runs red for a moment (prntr.css,
 * `.is-refused`). Once the buzzer has ended the ✕ pops by itself and is gone for the rest of the run (`.is-popping`).
 * Escape still leaves; on a touch screen, which has no Escape, the ✕ stays and its second press leaves instead.
 */

/** How long the view stays refused: the glitch's ~0.3 s, then the red fading back out. Matches prntr-refuse in prntr.css. */
export const REFUSE_MS = 900;

/** From the press to the pop, where a keyboard has Escape: the buzzer's last note ends at 0.53 s, then a short beat. */
export const POP_DELAY_MS = 650;
/** How long the pop takes before the ✕ leaves the page. Matches prntr-exit-swell and prntr-exit-burst in prntr.css. */
export const POP_MS = 260;

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

/** The pop's levels: the click, the body and the thump under them. */
const POP_CLICK = 0.1;
const POP_BODY = 0.16;
const POP_THUMP = 0.2;

/**
 * Plays the ✕'s pop through `out`: a small balloon. An 8 ms click of noise above 3 kHz, 50 ms of noise under 1.5 kHz
 * and a sine falling from 320 to 90 Hz over 70 ms.
 */
export function playPop(ctx: AudioContext, out: AudioNode): void {
  const t0 = ctx.currentTime + 0.005;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.08), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const burst = (type: BiquadFilterType, hz: number, level: number, len: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start(t0);
    src.stop(t0 + len + 0.01);
    src.onended = () => g.disconnect();
  };
  burst('highpass', 3000, POP_CLICK, 0.008);
  burst('lowpass', 1500, POP_BODY, 0.05);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(320, t0);
  o.frequency.exponentialRampToValueAtTime(90, t0 + 0.07);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(POP_THUMP, t0 + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
  o.connect(g);
  g.connect(out);
  o.start(t0);
  o.stop(t0 + 0.08);
  o.onended = () => g.disconnect();
}
