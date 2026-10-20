import type { PrntrAudio } from '../../audio';

/**
 * The room's sounds: a port of prntr/design/stage1/audio/sounds.js (the spec; the
 * .wav files beside it are renders for listening). Same recipes and numbers, played
 * live through Prntr's master gain instead of the context's destination. Without an
 * AudioContext every sound is a no-op.
 */

export interface Hum {
  /** One semitone down (the sticker beat) and back. */
  setFlat(flat: boolean): void;
  stop(): void;
}

export interface RoomSounds {
  /** The fluorescent hum; loops until stop(). */
  hum(): Hum;
  /** The printer's standby tick, every 4 s while the room is idle. */
  printerTick(): void;
  /** A click on anything. */
  uiClick(): void;
  /** A fluorescent tube going off or on. */
  lightTick(): void;
  lidOpen(): void;
  lidShut(): void;
  /** The scan's whine; the flash burst is scheduled 0.6 s later by the same call. */
  scanFlash(): void;
  stapleHit(): void;
  /** Gun shot, candidate A (the crack). Candidate B is in sounds.js if ever wanted. */
  shot(): void;
  /** Firing an empty gun. */
  dryClick(): void;
  reload(): void;
  /** A page landing on the glass. */
  paperSlap(): void;
}

const noop = () => undefined;
const SILENT: RoomSounds = {
  hum: () => ({ setFlat: noop, stop: noop }),
  printerTick: noop,
  uiClick: noop,
  lightTick: noop,
  lidOpen: noop,
  lidShut: noop,
  scanFlash: noop,
  stapleHit: noop,
  shot: noop,
  dryClick: noop,
  reload: noop,
  paperSlap: noop,
};

/** Two seconds of white noise, made once per context. */
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    const n = Math.floor(ctx.sampleRate * 2);
    buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

interface NoiseOpts {
  hp?: number;
  lp?: number;
  gain?: number;
  decay?: number | null;
}

interface ToneOpts {
  type?: OscillatorType;
  f0?: number;
  f1?: number | null;
  curve?: 'exp' | 'linear';
  gain?: number;
  attack?: number;
  decay?: number | null;
  release?: number;
}

export function createRoomSounds(audio: PrntrAudio): RoomSounds {
  const ctx = audio.context;
  const out = audio.master;
  if (!ctx || !out) return SILENT;
  const now = () => ctx.currentTime;
  const NOISE = noiseBuffer(ctx);

  function noise(when: number, dur: number, { hp = 0, lp = 20000, gain = 1, decay = null }: NoiseOpts = {}) {
    const src = ctx!.createBufferSource();
    src.buffer = NOISE;
    let node: AudioNode = src;
    if (hp > 0) {
      const f = ctx!.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      node.connect(f);
      node = f;
    }
    if (lp < 20000) {
      const f = ctx!.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      node.connect(f);
      node = f;
    }
    const g = ctx!.createGain();
    g.gain.setValueAtTime(gain, when);
    if (decay) g.gain.setTargetAtTime(0, when, decay);
    node.connect(g);
    g.connect(out!);
    src.start(when);
    src.stop(when + dur);
  }

  function tone(
    when: number,
    dur: number,
    { type = 'sine', f0 = 440, f1 = null, curve = 'exp', gain = 0.5, attack = 0.002, decay = null, release = 0.01 }: ToneOpts = {},
  ) {
    const o = ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, when);
    if (f1 !== null) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + dur);
      else o.frequency.linearRampToValueAtTime(f1, when + dur);
    }
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    if (decay) g.gain.setTargetAtTime(0, when + attack, decay);
    else g.gain.setValueAtTime(gain, when + dur - release);
    g.gain.linearRampToValueAtTime(0, when + dur);
    o.connect(g);
    g.connect(out!);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  function uiClick() {
    noise(now(), 0.015, { lp: 3500, gain: 0.35, decay: 0.002 });
  }

  return {
    // 60 Hz and three harmonics, a whisper of noise, a slow unevenness.
    hum() {
      const t0 = now();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.gain.linearRampToValueAtTime(0.12, t0 + 0.4);
      const parts = (
        [
          [1, 0.5],
          [2, 0.35],
          [3, 0.12],
          [4, 0.06],
        ] as const
      ).map(([m, gain]) => {
        const o = ctx.createOscillator();
        o.frequency.value = 60 * m;
        const gn = ctx.createGain();
        gn.gain.value = gain;
        o.connect(gn);
        gn.connect(master);
        o.start();
        return o;
      });
      const src = ctx.createBufferSource();
      src.buffer = NOISE;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      const ng = ctx.createGain();
      ng.gain.value = 0.06;
      src.connect(lp);
      lp.connect(ng);
      ng.connect(master);
      src.start();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.004;
      lfo.connect(lfoG);
      lfoG.connect(master.gain);
      lfo.start();
      master.connect(out);
      let stopped = false;
      return {
        setFlat(flat) {
          const k = flat ? Math.pow(2, -1 / 12) : 1;
          parts.forEach((o, i) => o.frequency.setTargetAtTime(60 * (i + 1) * k, now(), 0.05));
        },
        stop() {
          if (stopped) return;
          stopped = true;
          master.gain.cancelScheduledValues(now());
          master.gain.setTargetAtTime(0, now(), 0.05);
          window.setTimeout(() => {
            for (const node of [...parts, src, lfo]) {
              try {
                node.stop();
              } catch {
                // already stopped
              }
            }
            master.disconnect();
          }, 400);
        },
      };
    },
    printerTick() {
      noise(now(), 0.02, { hp: 1500, lp: 6000, gain: 0.5, decay: 0.003 });
    },
    uiClick,
    lightTick() {
      const t = now();
      tone(t, 0.09, { f0: 3200, gain: 0.35, decay: 0.012 });
      noise(t, 0.03, { hp: 2500, gain: 0.3, decay: 0.004 });
    },
    // a rising creak, 0.45 s
    lidOpen() {
      const t = now();
      tone(t, 0.45, { type: 'square', f0: 140, f1: 200, curve: 'linear', gain: 0.12, attack: 0.02, release: 0.1 });
      tone(t, 0.45, { f0: 281, f1: 402, curve: 'linear', gain: 0.12, attack: 0.02, release: 0.1 });
      noise(t + 0.1, 0.35, { lp: 400, gain: 0.15, decay: 0.2 });
    },
    // a thunk, 0.22 s
    lidShut() {
      const t = now();
      tone(t, 0.22, { f0: 150, f1: 40, gain: 0.6, decay: 0.07 });
      noise(t, 0.12, { lp: 1200, gain: 0.3, decay: 0.025 });
    },
    // a whine rising 800 → 2400 Hz over 0.6 s, then an 80 ms white burst
    scanFlash() {
      const t = now();
      tone(t, 0.6, { f0: 800, f1: 2400, gain: 0.25, attack: 0.05, release: 0.02 });
      noise(t + 0.6, 0.09, { hp: 3000, gain: 0.6, decay: 0.015 });
    },
    stapleHit() {
      const t = now();
      tone(t, 0.05, { f0: 4200, gain: 0.3, decay: 0.006 });
      tone(t, 0.05, { f0: 6300, gain: 0.15, decay: 0.004 });
      noise(t, 0.03, { hp: 4000, gain: 0.25, decay: 0.003 });
    },
    shot() {
      const t = now();
      noise(t, 0.09, { hp: 1200, gain: 0.6, decay: 0.012 });
      tone(t, 0.08, { f0: 1020, f1: 120, gain: 0.5, decay: 0.03 });
    },
    dryClick() {
      noise(now(), 0.03, { hp: 2500, gain: 0.3, decay: 0.003 });
    },
    // two clicks 160 ms apart, the second a little louder
    reload() {
      const t = now();
      uiClick();
      noise(t + 0.16, 0.015, { lp: 3500, gain: 0.45, decay: 0.002 });
    },
    // a 50 ms flutter, then an 80 ms slap with a 180 Hz thwap
    paperSlap() {
      const t = now();
      noise(t, 0.05, { lp: 900, gain: 0.08 });
      noise(t + 0.05, 0.08, { lp: 2200, gain: 0.7, decay: 0.012 });
      tone(t + 0.05, 0.025, { f0: 180, gain: 0.6, decay: 0.008 });
    },
  };
}
