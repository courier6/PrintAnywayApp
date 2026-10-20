/**
 * The jingle under the Simple Products card (Edgar, 2026-10-20): as long as the card is on
 * (1.25 s), jolly and far too much, and pitched an octave up from its first draft. A square
 * arpeggio bouncing up and down the C major chord at fourteen notes a second, a sawtooth an octave under it, a slide whistle swooping up and
 * back down, a bell ringing twice, a party horn at each end, a kick every quarter second and
 * a tick every eighth, and a cymbal at the end, all in the room's style (oscillators and
 * filtered noise through Prntr's master). Stopped early on abort.
 */

/** Everything an octave up from the first draft: Edgar wanted it pitched up twice at least (2026-10-20). */
const UP = 2;
/** Twenty-two steps up and down C6–C8, in Hz. */
const ARP = [523.3, 659.3, 784, 1046.5, 1318.5, 1568, 2093, 1568, 1318.5, 1046.5, 784, 659.3, 523.3, 659.3, 784, 1046.5, 1318.5, 1568, 2093, 2637, 3136, 4186].map((f) => f * UP);
const STEP_S = 0.07;

export function playCardJingle(ctx: AudioContext, out: AudioNode, durationS: number): { stop(): void } {
  const t0 = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(1, t0 + 0.02);
  master.gain.setValueAtTime(1, t0 + durationS - 0.12);
  master.gain.linearRampToValueAtTime(0, t0 + durationS);
  master.connect(out);
  const nodes: AudioScheduledSourceNode[] = [];
  const tone = (at: number, dur: number, type: OscillatorType, f0: number, f1: number | null, gain: number, lp = 20000) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0 + at);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(f1, t0 + at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0 + at);
    g.gain.linearRampToValueAtTime(gain, t0 + at + 0.005);
    g.gain.setValueAtTime(gain, t0 + at + dur - 0.015);
    g.gain.linearRampToValueAtTime(0, t0 + at + dur);
    let node: AudioNode = o;
    if (lp < 20000) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(master);
    o.start(t0 + at);
    o.stop(t0 + at + dur + 0.01);
    nodes.push(o);
  };
  const noise = (at: number, dur: number, hp: number, lp: number, gain: number, decay: number) => {
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const h = ctx.createBiquadFilter();
    h.type = 'highpass';
    h.frequency.value = hp;
    const l = ctx.createBiquadFilter();
    l.type = 'lowpass';
    l.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0 + at);
    g.gain.setTargetAtTime(0, t0 + at, decay);
    src.connect(h);
    h.connect(l);
    l.connect(g);
    g.connect(master);
    src.start(t0 + at);
    src.stop(t0 + at + dur);
    nodes.push(src);
  };
  // the arpeggio and its sawtooth shadow an octave down
  ARP.forEach((f, i) => {
    const at = i * STEP_S;
    if (at + STEP_S > durationS) return;
    tone(at, STEP_S * 0.9, 'square', f, null, 0.09);
    tone(at, STEP_S * 0.9, 'sawtooth', f / 2, null, 0.05, 2500);
  });
  // the slide whistle: up over the first half, down over the second, with a wobble
  tone(0.05, 0.55, 'sine', 500 * UP, 1900 * UP, 0.16);
  tone(0.62, 0.5, 'sine', 1900 * UP, 620 * UP, 0.16);
  // the bell, twice
  for (const at of [0.3, 0.95]) {
    tone(at, 0.3, 'sine', 2093 * UP, null, 0.14);
    tone(at, 0.2, 'sine', 5274 * UP, null, 0.04);
  }
  // the party horn: a buzzing sawtooth with a lowpass sweep, at each end
  for (const at of [0.0, 0.85]) tone(at, 0.28, 'sawtooth', 294 * UP, 330 * UP, 0.12, 1800 * UP);
  // the kick and the ticks
  for (let at = 0; at < durationS - 0.1; at += 0.25) tone(at, 0.09, 'sine', 150 * UP, 45 * UP, 0.5);
  for (let at = 0.125; at < durationS - 0.05; at += 0.125) noise(at, 0.03, 6000, 12000, 0.3, 0.004);
  // the cymbal at the end
  noise(1.05, 0.25, 4000, 10000, 0.35, 0.06);
  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(0, t, 0.01);
      window.setTimeout(() => {
        for (const n of nodes) {
          try {
            n.stop();
          } catch {
            // already stopped
          }
        }
        master.disconnect();
      }, 100);
    },
  };
}
