import type { PrntrAudio } from '../../audio';

/**
 * The room's sounds: a port of prntr/design/stage1/audio/sounds.js (the spec; the
 * .wav files beside it are renders for listening). Same recipes and numbers, played
 * live through Prntr's master gain instead of the context's destination. Without an
 * AudioContext every sound is a no-op. pageFeed, staplePunch, death, gameOver, shatter,
 * tear and rustle are not in sounds.js: Edgar asked for them after playing the room
 * (2026-10-19).
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
  /** Magazine out, in, and the slide racked, over 0.33 s; the stage fills the pips right after. */
  reload(): void;
  /** A page landing on the glass. */
  paperSlap(): void;
  /** The rollers feeding a page out of the machine's slot. */
  pageFeed(): void;
  /** A staple punched out of the slot: a stapler's clack. */
  staplePunch(): void;
  /** The last heart gone with a continue still to come: three falling notes. */
  death(): void;
  /** Game over: the three notes, then the long fall. About 1.4 s; it plays on through the host's drop. */
  gameOver(): void;
  /** Glass breaking: the clock, the cooler's bottle, the pot. */
  shatter(): void;
  /** Paper tearing: the poster. */
  tear(): void;
  /** Leaves: the plant. */
  rustle(): void;
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
  pageFeed: noop,
  staplePunch: noop,
  death: noop,
  gameOver: noop,
  shatter: noop,
  tear: noop,
  rustle: noop,
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
    // a weapon's reload (Edgar, 2026-10-19; the designer's was two clicks): the magazine out
    // (a click), in (a clunk at 80 ms), then the slide racked at 200 and 290 ms, a scrape and a
    // snap each; it is done at 330 ms, right before the pips fill
    reload() {
      const t = now();
      uiClick();
      noise(t + 0.08, 0.05, { lp: 1200, gain: 0.5, decay: 0.01 });
      tone(t + 0.08, 0.06, { f0: 240, f1: 110, gain: 0.35, decay: 0.014 });
      for (const d of [0.2, 0.29]) {
        noise(t + d, 0.045, { hp: 1800, lp: 7000, gain: 0.35, decay: 0.012 });
        noise(t + d + 0.03, 0.015, { hp: 2500, gain: 0.5, decay: 0.002 });
        tone(t + d + 0.03, 0.03, { f0: 3400, f1: 2200, gain: 0.18, decay: 0.005 });
      }
    },
    // a 50 ms flutter, then an 80 ms slap with a 180 Hz thwap
    paperSlap() {
      const t = now();
      noise(t, 0.05, { lp: 900, gain: 0.08 });
      noise(t + 0.05, 0.08, { lp: 2200, gain: 0.7, decay: 0.012 });
      tone(t + 0.05, 0.025, { f0: 180, gain: 0.6, decay: 0.008 });
    },
    // a 55 Hz motor for 0.3 s under four roller ticks 70 ms apart
    pageFeed() {
      const t = now();
      tone(t, 0.3, { type: 'sawtooth', f0: 55, gain: 0.06, attack: 0.02, release: 0.08 });
      for (let i = 0; i < 4; i++) noise(t + i * 0.07, 0.02, { hp: 1500, lp: 6000, gain: 0.3, decay: 0.003 });
    },
    // a stapler's clack: a metal tick over a 60 ms thud that drops 220 → 90 Hz
    staplePunch() {
      const t = now();
      tone(t, 0.03, { f0: 2600, f1: 1800, gain: 0.3, decay: 0.006 });
      noise(t, 0.06, { lp: 1500, gain: 0.5, decay: 0.012 });
      tone(t, 0.06, { f0: 220, f1: 90, gain: 0.4, decay: 0.015 });
    },
    // A4, G4, F4: square notes of 120 ms, 150 ms apart
    death() {
      deathNotes(now());
    },
    // the three notes, then two squares 1.5% apart sliding from E4 down to 50 Hz over 0.9 s
    gameOver() {
      const t = now();
      deathNotes(t);
      tone(t + 0.45, 0.9, { type: 'square', f0: 329.6, f1: 50, gain: 0.14, attack: 0.01, release: 0.2 });
      tone(t + 0.45, 0.9, { type: 'square', f0: 334.5, f1: 50.7, gain: 0.14, attack: 0.01, release: 0.2 });
    },
    // a bright crack, then three falling glass pings over 0.35 s
    shatter() {
      const t = now();
      noise(t, 0.12, { hp: 2500, gain: 0.6, decay: 0.02 });
      [5200, 4100, 3300].forEach((f0, i) => tone(t + 0.04 + i * 0.09, 0.14, { f0, f1: f0 * 0.8, gain: 0.18, decay: 0.03 }));
    },
    // a 0.18 s rip: band-passed noise, 0.1 s of it louder
    tear() {
      const t = now();
      noise(t, 0.18, { hp: 600, lp: 4000, gain: 0.55, decay: 0.05 });
      noise(t, 0.1, { hp: 1800, lp: 6000, gain: 0.3, decay: 0.03 });
    },
    // a soft 0.25 s rustle: low-passed noise, a slow decay
    rustle() {
      noise(now(), 0.25, { lp: 2200, gain: 0.3, decay: 0.07 });
    },
  };

  function deathNotes(t: number) {
    [440, 392, 349.2].forEach((f0, i) => tone(t + i * 0.15, 0.12, { type: 'square', f0, gain: 0.2, attack: 0.005, release: 0.03 }));
  }
}
