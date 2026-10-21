/**
 * The opening's sound cues, synthesized at runtime. No audio files ship: every
 * cue is rendered into sample arrays from the parameters below, cached per
 * sample rate, and wrapped in AudioBuffers when a context exists.
 *
 * A port of the designer's prntr-audio.js (prntr/design bundle, local only);
 * the approved renders live next to it in audio/reference/*.wav. Same recipe,
 * same seeds: identical character, individual crackle impulses may differ.
 *
 * The AudioContext comes from the host (src/components/prntrAudio.ts), created
 * inside the user's gesture when there is one. This module never creates or
 * resumes one. Without a context the player is silent but reports the same
 * durations, so the opening's timing does not change.
 */

/** Sample arrays as the synth makes them (and as AudioBuffer.copyToChannel wants them). */
type Samples = Float32Array<ArrayBuffer>;

export type DiscoveryName = 'discoverBLow' | 'discoverD' | 'discoverDLow';
export type CueName = DiscoveryName | 'creditA';
/** The crackle-only continuation of a discovery cue, for the wind-down. */
type TailName = `${DiscoveryName}Tail`;

export interface Cue {
  name: CueName;
  buffer: AudioBuffer | null;
  /** Seconds. Known even when there is no AudioContext. */
  duration: number;
  /** Discovery cues only: their crackle, continued, for playSlowing. */
  tail?: { buffer: AudioBuffer | null; duration: number };
}

export interface PrntrAudio {
  context: AudioContext | null;
  /** The node every Prntr sound plays through (gain 0.5). Null without a context. */
  master: GainNode | null;
  cues: Record<CueName, Cue>;
  /** One of the three discovery cues, never the same one twice in a row (per session). */
  pickDiscovery(): Cue;
  /** Plays now (or at `when`, in AudioContext time). Silent without a context. */
  play(cue: Cue, when?: number): void;
  /**
   * Plays `cue` once, then from `holdSec` carries its crackle on (the cue's
   * tail) while its speed, loudness and brightness fall, barely at first and
   * steeply at the end, until `stopSec` after the start, when it cuts.
   * Returns a function that cuts it now instead.
   */
  playSlowing(cue: Cue, holdSec: number, stopSec: number, endRate?: number): () => void;
  setGain(v: number): void;
}

// ---------------------------------------------------------------------------
// Tunables — change these, not the synth
// ---------------------------------------------------------------------------

const PEAK = 0.85; // normalization peak of every rendered cue (-1.4 dBFS)
const DEFAULT_GAIN = 0.5; // playback gain; a browser tab is not a cabinet
/**
 * How the wind-down's speed falls: rate = 1 - (1 - endRate) * u^POWER over
 * u = 0..1. Higher = seamless for longer, then a sudden dive at the end
 * (4: still 94% speed at the halfway point, 40% at 90%).
 */
const SLOW_CURVE_POWER = 4;
/** The wind-down's crackle: peak level, how quiet and how dull it ends. */
const TAIL_PEAK = 0.5;
const TAIL_END_GAIN = 0.25;
const TAIL_LOWPASS_FROM = 12000; // Hz
const TAIL_LOWPASS_TO = 500; // Hz

interface Crackle {
  densStart: number;
  densEnd: number;
  lo: number;
  hi: number;
  gain: number;
}
interface CrackleLate extends Crackle {
  at: number;
  dur: number;
}
interface Hiss {
  attack: number;
  decay: number;
  lo: number;
  hi: number;
  gain: number;
}
interface Ping {
  f0: number;
  detune?: number;
  detuneRatio?: number;
  attack: number;
  decay: number;
  gain: number;
}
interface Lofi {
  bits: number;
  hold: number;
}
interface Tail {
  dur: number;
  densStart: number;
  densEnd: number;
  lo: number;
  hi: number;
}
interface DiscoveryParams {
  dur: number;
  crackle?: Crackle;
  crackleLate?: CrackleLate;
  hiss?: Hiss;
  ping?: Ping;
  lofi: Lofi;
  seed: number;
  /** Crackle only, picking up where the cue's crackle leaves off. */
  tail: Tail;
}
interface CreditParams {
  f1: number;
  f2: number;
  blip: number;
  tail: number;
  lofi: Lofi;
  peak: number;
}

const DISCOVERY: Record<DiscoveryName, DiscoveryParams> = {
  // 1 · crackle with a low detuned ping under it
  discoverBLow: {
    dur: 1.0,
    crackle: { densStart: 180, densEnd: 25, lo: 250, hi: 2000, gain: 1.0 },
    hiss: { attack: 0.004, decay: 0.16, lo: 500, hi: 1500, gain: 0.3 },
    ping: { f0: 261.6, detuneRatio: 0.0067, attack: 0.012, decay: 0.32, gain: 0.22 },
    lofi: { bits: 9, hold: 3 },
    seed: 7,
    tail: { dur: 3.0, densStart: 25, densEnd: 10, lo: 250, hi: 2000 },
  },
  // 2 · ping first, crackle swells in late
  discoverD: {
    dur: 1.2,
    crackleLate: { at: 0.25, dur: 0.9, densStart: 40, densEnd: 220, lo: 900, hi: 7000, gain: 1.0 },
    hiss: { attack: 0.3, decay: 0.25, lo: 1800, hi: 5200, gain: 0.25 },
    ping: { f0: 880.0, detune: 11.0, attack: 0.012, decay: 0.5, gain: 0.25 },
    lofi: { bits: 9, hold: 3 },
    seed: 11,
    tail: { dur: 3.0, densStart: 220, densEnd: 60, lo: 900, hi: 7000 },
  },
  // 3 · the same, two octaves down
  discoverDLow: {
    dur: 1.2,
    crackleLate: { at: 0.25, dur: 0.9, densStart: 40, densEnd: 220, lo: 250, hi: 2000, gain: 1.0 },
    hiss: { attack: 0.3, decay: 0.25, lo: 500, hi: 1500, gain: 0.25 },
    ping: { f0: 220.0, detune: 2.75, attack: 0.012, decay: 0.5, gain: 0.25 },
    lofi: { bits: 9, hold: 3 },
    seed: 13,
    tail: { dur: 3.0, densStart: 220, densEnd: 60, lo: 250, hi: 2000 },
  },
};

const CREDIT: Record<'creditA', CreditParams> = {
  // clean 8-bit coin-in: two square blips a fifth apart, D6 -> A6
  creditA: { f1: 1174.7, f2: 1760.0, blip: 0.07, tail: 0.11, lofi: { bits: 8, hold: 2 }, peak: 0.8 },
};

const DISCOVERY_NAMES = Object.keys(DISCOVERY) as DiscoveryName[];

// ---------------------------------------------------------------------------
// Synth primitives (pure functions on Samples)
// ---------------------------------------------------------------------------

interface Rng {
  next(): number;
  gauss(): number;
  uniform(lo: number, hi: number): number;
}

/** Deterministic PRNG (mulberry32) so a cue sounds the same every time. */
function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Box–Muller gaussian
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const uniform = (lo: number, hi: number) => lo + (hi - lo) * next();
  return { next, gauss, uniform };
}

/** Attack/decay envelope. curve 4 = plain exp decay; higher = faster. */
function envelope(n: number, sr: number, attack: number, decay: number, curve = 4): Samples {
  const out = new Float32Array(n);
  const k = curve / (4 * decay);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const a = Math.min(1, t / Math.max(attack, 1e-4));
    out[i] = a * Math.exp(-t * k);
  }
  return out;
}

/** RBJ constant-0dB-peak band-pass biquad, applied `passes` times (2 ≈ 4th-order Butterworth). */
function bandpass(x: Samples, sr: number, lo: number, hi: number, passes = 2): Samples {
  const f0 = Math.sqrt(lo * hi);
  const Q = f0 / (hi - lo);
  const w0 = (2 * Math.PI * f0) / sr;
  const alpha = Math.sin(w0) / (2 * Q);
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;
  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;
  let y = x;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(y.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const xi = y[i];
      const yi = nb0 * xi + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
      x2 = x1;
      x1 = xi;
      y2 = y1;
      y1 = yi;
      out[i] = yi;
    }
    y = out;
  }
  return y;
}

/** Sparse impulse crackle whose rate decays (or grows) over the cue. */
function crackle(
  sr: number,
  r: Rng,
  dur: number,
  densStart: number,
  densEnd: number,
  lo: number,
  hi: number,
): Samples {
  const n = Math.floor(dur * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const rate = densStart * Math.pow(densEnd / densStart, t / dur);
    if (r.next() < rate / sr) {
      const L = Math.max(2, Math.floor(sr * r.uniform(0.0006, 0.004)));
      const amp = r.uniform(-1, 1) * r.uniform(0.3, 1.0);
      const end = Math.min(n, i + L);
      for (let j = i; j < end; j++) out[j] += amp * Math.exp(-(j - i) / (L / 3));
    }
  }
  return bandpass(out, sr, lo, hi);
}

/** Band-limited static burst. */
function hiss(sr: number, r: Rng, dur: number, attack: number, decay: number, lo: number, hi: number): Samples {
  const n = Math.floor(dur * sr);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = r.gauss();
  const y = bandpass(x, sr, lo, hi);
  const e = envelope(n, sr, attack, decay);
  for (let i = 0; i < n; i++) y[i] *= e[i];
  return y;
}

/** Two slightly detuned triangles, pitch drifting down a little — the "strange" part. */
function ping(sr: number, dur: number, f0: number, detune: number, attack: number, decay: number, drift = -0.06): Samples {
  const n = Math.floor(dur * sr);
  const out = new Float32Array(n);
  const e = envelope(n, sr, attack, decay, 5);
  let p1 = 0;
  let p2 = 0;
  const tri = (p: number) => 2 * Math.abs(2 * (p % 1) - 1) - 1;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = f0 * (1 + (drift * t) / dur);
    p1 += f / sr;
    p2 += (f + detune) / sr;
    out[i] = (0.6 * tri(p1) + 0.6 * tri(p2)) * e[i];
  }
  return out;
}

function square(sr: number, f: number, n: number): Samples {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = ((i / sr) * f) % 1 < 0.5 ? 1 : -1;
  return out;
}

/** Cheap radio: sample-and-hold, then bit reduction. */
function lofi(x: Samples, bits: number, hold: number): Samples {
  const out = new Float32Array(x.length);
  const q = Math.pow(2, bits - 1);
  for (let i = 0; i < x.length; i++) {
    const src = x[i - (i % hold)];
    out[i] = Math.round(src * q) / q;
  }
  return out;
}

function mixInto(dst: Samples, src: Samples, gain: number, offsetSamples = 0): void {
  const n = Math.min(src.length, dst.length - offsetSamples);
  for (let i = 0; i < n; i++) dst[i + offsetSamples] += src[i] * gain;
}

function finish(x: Samples, sr: number, peak: number, fadeSec: number): Samples {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  const g = m > 0 ? peak / m : 1;
  for (let i = 0; i < x.length; i++) x[i] *= g;
  const f = Math.floor(fadeSec * sr);
  for (let i = 0; i < f; i++) x[x.length - f + i] *= 1 - i / f;
  return x;
}

// ---------------------------------------------------------------------------
// Cue recipes
// ---------------------------------------------------------------------------

function renderDiscovery(sr: number, p: DiscoveryParams): Samples {
  const r = rng(p.seed);
  const n = Math.floor(p.dur * sr);
  const mix = new Float32Array(n);
  if (p.crackle) {
    const c = p.crackle;
    mixInto(mix, crackle(sr, r, p.dur, c.densStart, c.densEnd, c.lo, c.hi), c.gain);
  }
  if (p.crackleLate) {
    const c = p.crackleLate;
    mixInto(mix, crackle(sr, r, c.dur, c.densStart, c.densEnd, c.lo, c.hi), c.gain, Math.floor(c.at * sr));
  }
  if (p.hiss) {
    const h = p.hiss;
    mixInto(mix, hiss(sr, r, p.dur, h.attack, h.decay, h.lo, h.hi), h.gain);
  }
  if (p.ping) {
    const g = p.ping;
    const detune = g.detune ?? g.f0 * (g.detuneRatio ?? 0);
    mixInto(mix, ping(sr, p.dur, g.f0, detune, g.attack, g.decay), g.gain);
  }
  return finish(lofi(mix, p.lofi.bits, p.lofi.hold), sr, PEAK, 0.008);
}

/** The cue's crackle, carried on: same band, density easing off, a short fade-in so it joins cleanly. */
function renderTail(sr: number, p: DiscoveryParams): Samples {
  const t = p.tail;
  const x = crackle(sr, rng(p.seed + 100), t.dur, t.densStart, t.densEnd, t.lo, t.hi);
  const fadeIn = Math.floor(0.02 * sr);
  for (let i = 0; i < fadeIn && i < x.length; i++) x[i] *= i / fadeIn;
  return finish(lofi(x, p.lofi.bits, p.lofi.hold), sr, TAIL_PEAK, 0.03);
}

function renderCredit(sr: number, p: CreditParams): Samples {
  const n1 = Math.floor(p.blip * sr);
  const n2 = Math.floor((p.blip + p.tail) * sr);
  const a = square(sr, p.f1, n1);
  const ea = envelope(n1, sr, 0.001, 0.06);
  const b = square(sr, p.f2, n2);
  const eb = envelope(n2, sr, 0.001, 0.045);
  const x = new Float32Array(n1 + n2);
  for (let i = 0; i < n1; i++) x[i] = a[i] * ea[i];
  for (let i = 0; i < n2; i++) x[n1 + i] = b[i] * eb[i];
  return finish(lofi(x, p.lofi.bits, p.lofi.hold), sr, p.peak, 0.004);
}

/** Render every cue (and the discovery tails) to raw sample arrays at `sr`. Pure. */
export function renderAllCues(sr = 44100): Record<CueName | TailName, Samples> {
  return {
    discoverBLow: renderDiscovery(sr, DISCOVERY.discoverBLow),
    discoverD: renderDiscovery(sr, DISCOVERY.discoverD),
    discoverDLow: renderDiscovery(sr, DISCOVERY.discoverDLow),
    creditA: renderCredit(sr, CREDIT.creditA),
    discoverBLowTail: renderTail(sr, DISCOVERY.discoverBLow),
    discoverDTail: renderTail(sr, DISCOVERY.discoverD),
    discoverDLowTail: renderTail(sr, DISCOVERY.discoverDLow),
  };
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

/** Rendered once per sample rate; re-entering Prntr never renders again. */
const rendered = new Map<number, Record<CueName | TailName, Samples>>();

/** Lives for the session (this chunk's module scope): never the same discovery cue twice in a row. */
let lastDiscovery: DiscoveryName | null = null;

function samplesFor(sr: number): Record<CueName | TailName, Samples> {
  let all = rendered.get(sr);
  if (!all) {
    all = renderAllCues(sr);
    rendered.set(sr, all);
  }
  return all;
}

export function createPrntrAudio(context: AudioContext | null): PrntrAudio {
  const sr = context?.sampleRate ?? 44100;
  const raw = samplesFor(sr);

  let master: GainNode | null = null;
  if (context) {
    master = context.createGain();
    master.gain.value = DEFAULT_GAIN;
    master.connect(context.destination);
  }

  const toBuffer = (samples: Samples) => {
    if (!context) return { buffer: null, duration: samples.length / sr };
    const buffer = context.createBuffer(1, samples.length, sr);
    buffer.copyToChannel(samples, 0);
    return { buffer, duration: buffer.duration };
  };
  const toCue = (name: CueName): Cue => ({ name, ...toBuffer(raw[name]) });
  const toDiscovery = (name: DiscoveryName): Cue => ({ ...toCue(name), tail: toBuffer(raw[`${name}Tail`]) });
  const cues: Record<CueName, Cue> = {
    discoverBLow: toDiscovery('discoverBLow'),
    discoverD: toDiscovery('discoverD'),
    discoverDLow: toDiscovery('discoverDLow'),
    creditA: toCue('creditA'),
  };

  return {
    context,
    master,
    cues,
    pickDiscovery() {
      const pool = DISCOVERY_NAMES.filter((n) => n !== lastDiscovery);
      const name = pool[Math.floor(Math.random() * pool.length)];
      lastDiscovery = name;
      return cues[name];
    },
    play(cue, when = 0) {
      if (!context || !master || !cue.buffer) return;
      const src = context.createBufferSource();
      src.buffer = cue.buffer;
      src.connect(master);
      src.start(when);
    },
    playSlowing(cue, holdSec, stopSec, endRate = 0.08) {
      if (!context || !master || !cue.buffer || !cue.tail?.buffer) return () => undefined;
      const t = context.currentTime;
      const tailAt = t + holdSec;
      const slowFor = Math.max(0.01, stopSec - holdSec);
      // From 1 to `to` along u^POWER: nothing much happens until late.
      const easeIn = (to: number) => {
        const curve = new Float32Array(256);
        for (let i = 0; i < curve.length; i++) {
          curve[i] = 1 - (1 - to) * Math.pow(i / (curve.length - 1), SLOW_CURVE_POWER);
        }
        return curve;
      };

      const head = context.createBufferSource();
      head.buffer = cue.buffer;
      head.connect(master);
      head.start(t);

      const tail = context.createBufferSource();
      tail.buffer = cue.tail.buffer;
      const lowpass = context.createBiquadFilter();
      lowpass.type = 'lowpass';
      const fade = context.createGain();
      tail.connect(lowpass);
      lowpass.connect(fade);
      fade.connect(master);
      tail.playbackRate.setValueAtTime(1, tailAt);
      tail.playbackRate.setValueCurveAtTime(easeIn(endRate), tailAt, slowFor);
      fade.gain.setValueAtTime(1, tailAt);
      fade.gain.setValueCurveAtTime(easeIn(TAIL_END_GAIN), tailAt, slowFor);
      lowpass.frequency.setValueAtTime(TAIL_LOWPASS_FROM, tailAt);
      lowpass.frequency.setValueCurveAtTime(
        easeIn(TAIL_LOWPASS_TO / TAIL_LOWPASS_FROM).map((v) => v * TAIL_LOWPASS_FROM),
        tailAt,
        slowFor,
      );
      tail.start(tailAt);
      tail.stop(t + stopSec);

      return () => {
        for (const src of [head, tail]) {
          try {
            src.stop();
          } catch {
            // already stopped
          }
        }
      };
    },
    setGain(v) {
      if (master) master.gain.value = Math.max(0, Math.min(1, v));
    },
  };
}
