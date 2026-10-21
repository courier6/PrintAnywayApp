import type { PrntrAudio } from '../../audio';

/**
 * The room's sounds: a port of prntr/design/stage1/audio/sounds.js (the spec; the
 * .wav files beside it are renders for listening). Same recipes and numbers, played
 * live through Prntr's master gain instead of the context's destination. Without an
 * AudioContext every sound is a no-op. pageFeed, staplePunch, panic, death, gameOver,
 * shatter, tear, rustle, the sign's three and doorCreak are not in sounds.js.
 */

export interface Hum {
  /** One semitone down (the sticker beat) and back. */
  setFlat(flat: boolean): void;
  stop(): void;
}

export interface FireSound {
  /** 0 just lit … 1 the full blaze. */
  setLevel(u: number): void;
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
  /** A tube flickering on for `dur` s: its tick and a 120 Hz buzz. */
  lightBuzz(dur: number): void;
  lidOpen(): void;
  lidShut(): void;
  /** The machine pouncing forward: a swelling whoosh, then its landing thump at 0.35 s. */
  pounce(): void;
  /** The slam's lift: a motor straining up off the carpet over `dur` s, a creak near the top. */
  slamLift(dur: number): void;
  /** The slam's landing: a deep boom and a rattle, then a low wobble going down like water over `dur` s.
   * stop() fades the wobble out (a death or the burst ending the slam). */
  slamLand(dur: number): { stop(): void };
  /** The scan's whine, rising over the 1.2 s sweep. */
  scanSweep(): void;
  /** The flash: an 80 ms white burst. */
  scanBurst(): void;
  /** The lamp's bulb shot: a pop and a tinkle of glass. */
  bulbPop(): void;
  stapleHit(): void;
  /** A nut or a bolt hitting the glass: a clang. */
  boltHit(): void;
  /** A nut or a bolt thrown out of the slot: a heavier clack than a staple's. */
  boltPunch(): void;
  /** Gun shot: a pistol (the designer's candidates A and B are in sounds.js). */
  shot(): void;
  /** Firing an empty gun. */
  dryClick(): void;
  /** Magazine out, in, and the slide racked, over 0.33 s; the stage fills the pips right after. */
  reload(): void;
  /** A page landing on the glass. */
  paperSlap(): void;
  /** After the first shot: a scream somewhere off, faint, and people running out, about 2.5 s. */
  panic(): void;
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
  /** The EXIT sign knocked loose: a clank, then its letters buzzing in each ms window they come back on. */
  signHit(flicker: [number, number][]): void;
  /** The sign's last corner giving. */
  signSnap(): void;
  /** The sign hitting the floor. */
  signCrash(): void;
  /** The door creaking open, 1.3 s, faint under everything else. */
  doorCreak(): void;
  /** The door's knob shot: a dull metal clank and the latch giving. */
  knobHit(): void;
  /** The door shot apart: a crack of wood and its planks hitting the carpet. */
  doorBreak(): void;
  /** The machine shorting out when the water reaches it: one burst of zaps. */
  zap(): void;
  /** The short before the fire: a zap at each of these ms, each its own, with a sizzle between. */
  short(zapsMs: number[]): void;
  /** A jet of ink from a nozzle: a hiss for the jet's 1.4 s. */
  inkSpray(): void;
  /** The black cartridge, empty: three dry coughs, the last one weakest, and two low error beeps. */
  inkDud(): void;
  /** A splat completing on the glass. */
  inkSplat(): void;
  /** The fire's roar and crackle; loops until stop(), at the level set. */
  fire(): FireSound;
  /** A heart's ghost shot: a balloon's pop. */
  pop(): void;
  /** The clock shot off its hook: a knock. */
  knock(): void;
  /** The clock landing on the floor and bouncing. */
  clatter(): void;
  /** The clock catching fire: a whoosh. */
  whoosh(): void;
  /** The engulfed machine bursting apart: a bang, then its pieces coming down. */
  burst(): void;
  /** The first aid kit shot: a clasp's snap and a rising three-note chime. */
  heal(): void;
  /** A tube shot to pieces: a pop, the hose's hiss, its bits clattering down. */
  tubeBurst(): void;
  /** Ink landing in the fire: a hiss of steam. */
  sizzle(): void;
  /** The stage won: a triumphant tune in squares, about 3.2 s. */
  fanfare(): void;
}

const noop = () => undefined;
const SILENT: RoomSounds = {
  hum: () => ({ setFlat: noop, stop: noop }),
  printerTick: noop,
  uiClick: noop,
  lightTick: noop,
  lightBuzz: noop,
  lidOpen: noop,
  lidShut: noop,
  pounce: noop,
  slamLift: noop,
  slamLand: () => ({ stop: noop }),
  scanSweep: noop,
  scanBurst: noop,
  bulbPop: noop,
  stapleHit: noop,
  boltHit: noop,
  boltPunch: noop,
  shot: noop,
  dryClick: noop,
  reload: noop,
  paperSlap: noop,
  panic: noop,
  pageFeed: noop,
  staplePunch: noop,
  death: noop,
  gameOver: noop,
  shatter: noop,
  tear: noop,
  rustle: noop,
  signHit: noop,
  signSnap: noop,
  signCrash: noop,
  doorCreak: noop,
  knobHit: noop,
  doorBreak: noop,
  zap: noop,
  short: noop,
  inkSpray: noop,
  inkDud: noop,
  inkSplat: noop,
  fire: () => ({ setLevel: noop, stop: noop }),
  pop: noop,
  knock: noop,
  clatter: noop,
  whoosh: noop,
  burst: noop,
  sizzle: noop,
  tubeBurst: noop,
  heal: noop,
  fanfare: noop,
};

/** Two seconds of white noise, made once per context. */
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>();
/** Two seconds of white noise, one buffer per context (the storm over the title uses it too). */
export function noiseBuffer(ctx: AudioContext): AudioBuffer {
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
  /** Where it plays into: the master by default, or a gain of the cue's own, so the cue can be cut short. */
  to?: AudioNode;
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
  /** Where it plays into: the master by default, or a gain of the cue's own, so the cue can be cut short. */
  to?: AudioNode;
}

export function createRoomSounds(audio: PrntrAudio): RoomSounds {
  const ctx = audio.context;
  const out = audio.master;
  if (!ctx || !out) return SILENT;
  const now = () => ctx.currentTime;
  const NOISE = noiseBuffer(ctx);

  function noise(when: number, dur: number, { hp = 0, lp = 20000, gain = 1, decay = null, to = out! }: NoiseOpts = {}) {
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
    g.connect(to);
    src.start(when);
    src.stop(when + dur);
  }

  function tone(
    when: number,
    dur: number,
    { type = 'sine', f0 = 440, f1 = null, curve = 'exp', gain = 0.5, attack = 0.002, decay = null, release = 0.01, to = out! }: ToneOpts = {},
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
    g.connect(to);
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
    // the tick, then a square 120 Hz buzz under high noise for as long as the tube is lit
    lightBuzz(dur) {
      const t = now();
      tone(t, 0.09, { f0: 3200, gain: 0.35, decay: 0.012 });
      tone(t, dur, { type: 'square', f0: 120, gain: 0.06, attack: 0.01, release: 0.02 });
      noise(t, dur, { hp: 4000, gain: 0.06 });
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
    // a whoosh swelling over 0.35 s (two bands of low noise, the second louder and brighter), then
    // a thump: a tone falling 120 → 35 Hz with a burst of low noise
    pounce() {
      const t = now();
      noise(t, 0.25, { lp: 500, gain: 0.15 });
      noise(t + 0.15, 0.2, { lp: 1200, gain: 0.3 });
      tone(t + 0.35, 0.18, { f0: 120, f1: 35, gain: 0.7, decay: 0.06 });
      noise(t + 0.35, 0.1, { lp: 800, gain: 0.4, decay: 0.03 });
    },
    slamLift(dur: number) {
      const t = now();
      tone(t, dur, { type: 'sawtooth', f0: 45, f1: 110, gain: 0.07, attack: 0.08, release: 0.04 });
      noise(t, dur, { lp: 380, gain: 0.08 });
      tone(t + dur * 0.7, 0.16, { type: 'square', f0: 320, f1: 190, gain: 0.03, release: 0.05 });
    },
    // the boom under everything, the room's rattle on top, then a wobble falling in steps under the ripple
    // The boom and the rattle are over in half a second and stand; the wobble has a gain of its own so a slam
    // ended early (a death, the burst) takes its sound with it.
    slamLand(dur: number) {
      const t = now();
      tone(t, 0.6, { f0: 95, f1: 26, gain: 0.9, decay: 0.14 });
      noise(t, 0.35, { lp: 700, gain: 0.6, decay: 0.08 });
      noise(t + 0.02, 0.25, { hp: 1800, gain: 0.12, decay: 0.05 });
      const wobble = ctx!.createGain();
      wobble.connect(out!);
      for (let i = 0; i < 6; i++) {
        const at = t + 0.12 + (i * dur) / 7;
        tone(at, dur / 6, { f0: 150 - i * 14, f1: 95 - i * 9, curve: 'linear', gain: 0.1 * (1 - i / 7), attack: 0.03, decay: dur / 14, to: wobble });
      }
      return {
        stop() {
          const at = now();
          wobble.gain.cancelScheduledValues(at);
          wobble.gain.setTargetAtTime(0, at, 0.02);
          window.setTimeout(() => wobble.disconnect(), 200);
        },
      };
    },
    // a whine rising 800 → 2400 Hz over the 1.2 s sweep
    scanSweep() {
      tone(now(), 1.2, { f0: 800, f1: 2400, gain: 0.22, attack: 0.05, release: 0.05 });
    },
    // the flash: an 80 ms white burst
    scanBurst() {
      noise(now(), 0.09, { hp: 3000, gain: 0.6, decay: 0.015 });
    },
    // a pop (a short thump) and the bulb's glass: two high rings dying in 60 ms
    bulbPop() {
      const t = now();
      tone(t, 0.08, { f0: 900, f1: 200, gain: 0.5, decay: 0.02 });
      noise(t, 0.05, { hp: 2000, gain: 0.5, decay: 0.008 });
      tone(t + 0.01, 0.06, { f0: 5200, gain: 0.2, decay: 0.012 });
      tone(t + 0.02, 0.06, { f0: 6800, gain: 0.12, decay: 0.01 });
    },
    stapleHit() {
      const t = now();
      tone(t, 0.05, { f0: 4200, gain: 0.3, decay: 0.006 });
      tone(t, 0.05, { f0: 6300, gain: 0.15, decay: 0.004 });
      noise(t, 0.03, { hp: 4000, gain: 0.25, decay: 0.003 });
    },
    // a clang: two rings falling from 2.4 and 3.6 kHz over a 60 ms thud
    boltHit() {
      const t = now();
      noise(t, 0.04, { hp: 2500, gain: 0.4, decay: 0.006 });
      tone(t, 0.25, { f0: 2400, f1: 1900, gain: 0.3, decay: 0.05 });
      tone(t, 0.2, { f0: 3600, f1: 3000, gain: 0.15, decay: 0.035 });
      tone(t, 0.06, { f0: 200, f1: 80, gain: 0.4, decay: 0.015 });
    },
    // a nut or a bolt out of the slot: a metal tick over a heavier 80 ms thud, 240 → 70 Hz
    boltPunch() {
      const t = now();
      tone(t, 0.04, { f0: 3000, f1: 2000, gain: 0.25, decay: 0.008 });
      noise(t, 0.08, { lp: 1200, gain: 0.55, decay: 0.015 });
      tone(t, 0.08, { f0: 240, f1: 70, gain: 0.5, decay: 0.02 });
    },
    // a pistol: a 30 ms crack on a 90 ms bang, a thump dropping 160 → 45 Hz, and a lowpassed tail
    shot() {
      const t = now();
      noise(t, 0.03, { hp: 2500, gain: 0.7, decay: 0.006 });
      noise(t, 0.09, { lp: 6000, gain: 0.6, decay: 0.018 });
      tone(t, 0.12, { f0: 160, f1: 45, gain: 0.6, decay: 0.035 });
      noise(t + 0.04, 0.2, { lp: 900, gain: 0.25, decay: 0.05 });
    },
    dryClick() {
      noise(now(), 0.03, { hp: 2500, gain: 0.3, decay: 0.003 });
    },
    // a weapon's reload (the designer's was two clicks): the magazine out
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
    // a woman's scream at 0.25 s, far off, then running feet from 0.5 s: quick uneven steps that
    // fade out by 2.6 s, a low shuffle under them. Nobody is seen.
    panic() {
      const t = now();
      scream(t + 0.25);
      for (let at = t + 0.5; at < t + 2.6; at += 0.1 + Math.random() * 0.09) {
        const k = 1 - (at - t - 0.5) / 2.1;
        noise(at, 0.03, { lp: 500 + Math.random() * 400, gain: 0.45 * k, decay: 0.008 });
      }
      noise(t + 0.4, 2.0, { lp: 300, gain: 0.1, decay: 0.6 });
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
    // a metal tick under two rings falling from 1.8 and 2.7 kHz, then a 120 Hz square with hiss
    // for each window the letters are on
    // a clank lower and duller than a bolt's on the glass, then the latch's click 60 ms later
    knobHit() {
      const t = now();
      noise(t, 0.04, { hp: 1500, lp: 6000, gain: 0.4, decay: 0.008 });
      tone(t, 0.2, { f0: 1300, f1: 1050, gain: 0.25, decay: 0.04 });
      tone(t, 0.08, { f0: 180, f1: 90, gain: 0.35, decay: 0.02 });
      noise(t + 0.06, 0.02, { hp: 3000, gain: 0.3, decay: 0.003 });
    },
    signHit(flicker) {
      const t = now();
      noise(t, 0.04, { hp: 3000, gain: 0.5, decay: 0.006 });
      tone(t, 0.25, { f0: 1800, f1: 900, gain: 0.3, decay: 0.05 });
      tone(t, 0.3, { f0: 2700, f1: 1400, gain: 0.12, decay: 0.04 });
      for (const [a, b] of flicker) {
        tone(t + a / 1000, (b - a) / 1000, { type: 'square', f0: 120, gain: 0.05, attack: 0.004, release: 0.01 });
        noise(t + a / 1000, (b - a) / 1000, { hp: 4000, gain: 0.08 });
      }
    },
    // a snap: a 40 ms crack and a short ring falling 900 → 300 Hz
    signSnap() {
      const t = now();
      noise(t, 0.04, { hp: 2000, gain: 0.5, decay: 0.006 });
      tone(t, 0.08, { f0: 900, f1: 300, gain: 0.25, decay: 0.015 });
    },
    // a 0.12 s crash with a thump falling 140 → 40 Hz, two glass pings, and two clatters after
    signCrash() {
      const t = now();
      noise(t, 0.12, { lp: 2500, gain: 0.7, decay: 0.03 });
      tone(t, 0.12, { f0: 140, f1: 40, gain: 0.5, decay: 0.04 });
      [4600, 3700].forEach((f0, i) => tone(t + 0.03 + i * 0.07, 0.12, { f0, f1: f0 * 0.8, gain: 0.12, decay: 0.025 }));
      for (const d of [0.18, 0.3]) noise(t + d, 0.03, { lp: 3000, gain: 0.25, decay: 0.006 });
    },
    // two sawtooths a fifth apart sliding 70 → 115 Hz over 1.3 s through a 600 Hz lowpass, the
    // gain catching three times on the way; faint, so it sits under the fight
    doorCreak() {
      const t = now();
      for (const [f0, f1, gain] of [
        [70, 115, 0.06],
        [105, 172, 0.035],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f0, t);
        o.frequency.linearRampToValueAtTime(f1, t + 1.3);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.1);
        for (const d of [0.35, 0.7, 1.0]) {
          g.gain.setValueAtTime(gain * 0.3, t + d);
          g.gain.linearRampToValueAtTime(gain, t + d + 0.08);
        }
        g.gain.setValueAtTime(gain, t + 1.15);
        g.gain.linearRampToValueAtTime(0, t + 1.3);
        o.connect(lp);
        lp.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + 1.32);
      }
    },
    // the door breaking: a wood crack (a short burst and a 90 → 40 Hz thud), a second crack 90 ms
    // on, and two planks landing at 0.35 and 0.55 s, each a low thud with a knock
    doorBreak() {
      const t = now();
      noise(t, 0.06, { hp: 800, lp: 5000, gain: 0.7, decay: 0.012 });
      tone(t, 0.14, { f0: 90, f1: 40, gain: 0.6, decay: 0.04 });
      noise(t + 0.09, 0.05, { hp: 1000, lp: 6000, gain: 0.5, decay: 0.01 });
      for (const d of [0.35, 0.55]) {
        noise(t + d, 0.08, { lp: 1500, gain: 0.5, decay: 0.015 });
        tone(t + d, 0.1, { f0: 160, f1: 70, gain: 0.4, decay: 0.025 });
      }
    },
    // the short: five bursts 90 ms apart of a 60 → 120 Hz square with a crackle on each
    zap() {
      const t = now();
      for (let i = 0; i < 5; i++) {
        tone(t + i * 0.09, 0.06, { type: 'square', f0: 60 + i * 15, gain: 0.25, attack: 0.003, release: 0.01 });
        noise(t + i * 0.09, 0.05, { hp: 3000, gain: 0.5, decay: 0.008 });
      }
    },
    // the short-out before the fire: at each moment a zap of its own, two to four bursts of a
    // 50–180 Hz square with a crackle on each, 60–80 ms apart, and a short hum of mains buzz under
    // them; a faint sizzle runs through the whole of it
    short(zapsMs) {
      const t = now();
      const last = zapsMs[zapsMs.length - 1] / 1000 + 0.4;
      noise(t, last, { hp: 3000, lp: 9000, gain: 0.07 });
      for (const ms of zapsMs) {
        const z = t + ms / 1000;
        const n = 2 + Math.floor(Math.random() * 3);
        const step = 0.06 + Math.random() * 0.02;
        for (let i = 0; i < n; i++) {
          tone(z + i * step, 0.05, { type: 'square', f0: 50 + Math.random() * 130, gain: 0.22, attack: 0.002, release: 0.01 });
          noise(z + i * step, 0.04, { hp: 2500, gain: 0.55, decay: 0.006 });
        }
        tone(z, n * step + 0.05, { type: 'sawtooth', f0: 60, gain: 0.08, attack: 0.005, release: 0.03 });
      }
    },
    // a spit at the front, then a 1.4 s hiss
    inkSpray() {
      const t = now();
      tone(t, 0.03, { f0: 900, f1: 300, gain: 0.15, decay: 0.006 });
      noise(t, 1.4, { hp: 3000, gain: 0.16 });
    },
    // three 60 ms puffs of high noise (0, 0.45, 0.9 s; the last weakest) and two 120 ms square beeps at 520 Hz
    inkDud() {
      const t = now();
      [0, 0.45, 0.9].forEach((d, i) => noise(t + d, 0.06, { hp: 1800, lp: 7000, gain: i === 2 ? 0.12 : 0.22, decay: 0.02 }));
      tone(t + 0.2, 0.12, { type: 'square', f0: 520, gain: 0.07, attack: 0.004, release: 0.02 });
      tone(t + 0.4, 0.12, { type: 'square', f0: 520, gain: 0.07, attack: 0.004, release: 0.02 });
    },
    // a wet slap: low noise, a 140 → 50 Hz thump, and a short blip falling 600 → 200 Hz
    inkSplat() {
      const t = now();
      noise(t, 0.08, { lp: 900, gain: 0.6, decay: 0.015 });
      tone(t, 0.1, { f0: 140, f1: 50, gain: 0.45, decay: 0.03 });
      tone(t + 0.02, 0.06, { f0: 600, f1: 200, gain: 0.2, decay: 0.012 });
    },
    // a roar (looping noise through a 220 Hz lowpass) under crackles every 40–160 ms,
    // both scaled by the level; scheduled a quarter second ahead from a 100 ms timer
    fire() {
      const master = ctx.createGain();
      master.gain.value = 0;
      const src = ctx.createBufferSource();
      src.buffer = NOISE;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      src.connect(lp);
      lp.connect(master);
      master.connect(out);
      src.start();
      let level = 0;
      let next = now();
      const timer = window.setInterval(() => {
        const t = now();
        if (next < t) next = t;
        while (next < t + 0.25) {
          noise(next, 0.03, { hp: 1200, lp: 6000, gain: 0.3 * level * (0.4 + 0.6 * Math.random()), decay: 0.004 });
          next += 0.04 + Math.random() * 0.12;
        }
      }, 100);
      let stopped = false;
      return {
        setLevel(u) {
          level = u;
          master.gain.setTargetAtTime(0.14 * u, now(), 0.2);
        },
        stop() {
          if (stopped) return;
          stopped = true;
          window.clearInterval(timer);
          master.gain.cancelScheduledValues(now());
          master.gain.setTargetAtTime(0, now(), 0.05);
          window.setTimeout(() => {
            try {
              src.stop();
            } catch {
              // already stopped
            }
            master.disconnect();
          }, 400);
        },
      };
    },
    pop,
    // a knock on wood: a 50 ms low burst and a 180 → 90 Hz thud
    knock() {
      const t = now();
      noise(t, 0.05, { lp: 1200, gain: 0.5, decay: 0.01 });
      tone(t, 0.08, { f0: 180, f1: 90, gain: 0.4, decay: 0.02 });
    },
    // the clock on the floor: a thud and a tin ring, then two smaller bounces 110 and 190 ms on
    clatter() {
      const t = now();
      [0, 0.11, 0.19].forEach((d, i) => {
        const k = 1 - i * 0.35;
        noise(t + d, 0.06, { lp: 2500, gain: 0.5 * k, decay: 0.012 });
        tone(t + d, 0.1, { f0: 130, f1: 50, gain: 0.4 * k, decay: 0.03 });
        tone(t + d, 0.12, { f0: 2900, f1: 2300, gain: 0.1 * k, decay: 0.03 });
      });
    },
    // a bang: a crack, a 0.3 s burst, a thump falling 120 → 30 Hz, and three clatters of the pieces
    // coming down between 0.45 and 0.9 s
    burst() {
      const t = now();
      noise(t, 0.04, { hp: 1500, gain: 0.9, decay: 0.008 });
      noise(t, 0.3, { lp: 3000, gain: 0.8, decay: 0.06 });
      tone(t, 0.35, { f0: 120, f1: 30, gain: 0.7, decay: 0.09 });
      noise(t + 0.05, 0.6, { lp: 600, gain: 0.3, decay: 0.15 });
      for (const d of [0.45, 0.62, 0.9]) {
        noise(t + d, 0.08, { lp: 2500, gain: 0.45, decay: 0.015 });
        tone(t + d, 0.1, { f0: 140, f1: 50, gain: 0.35, decay: 0.03 });
      }
    },
    // the win: a D major fanfare in squares over a triangle bass, a rising arpeggio to D6, a
    // step up to E6, a turn down from F#6, and D6 held a second over a D–F# pad, with a
    // noise hit on each downbeat; about 3.2 s
    fanfare() {
      const t = now();
      const lead: [number, number, number][] = [
        [0, 587.3, 0.11],
        [0.13, 740, 0.11],
        [0.26, 880, 0.11],
        [0.39, 1174.7, 0.3],
        [0.8, 1108.7, 0.14],
        [0.96, 1174.7, 0.14],
        [1.12, 1318.5, 0.42],
        [1.66, 1480, 0.14],
        [1.82, 1318.5, 0.14],
        [1.98, 1108.7, 0.14],
        [2.14, 1174.7, 1.0],
      ];
      for (const [at, f0, dur] of lead) {
        tone(t + at, dur, { type: 'square', f0, gain: 0.14, attack: 0.005, release: 0.03 });
        if (dur >= 0.3) tone(t + at, dur, { type: 'square', f0: f0 * 1.004, gain: 0.07, attack: 0.005, release: 0.03 });
      }
      const bass: [number, number, number][] = [
        [0, 146.8, 0.38],
        [0.39, 146.8, 0.38],
        [0.8, 220, 0.3],
        [1.12, 220, 0.5],
        [1.66, 196, 0.45],
        [2.14, 146.8, 1.0],
      ];
      for (const [at, f0, dur] of bass) tone(t + at, dur, { type: 'triangle', f0, gain: 0.22, attack: 0.005, release: 0.04 });
      for (const f0 of [293.7, 370]) tone(t + 2.14, 1.0, { type: 'square', f0, gain: 0.05, attack: 0.02, release: 0.2 });
      for (const at of [0.39, 1.12, 2.14]) noise(t + at, 0.06, { lp: 3000, gain: 0.3, decay: 0.02 });
    },
    // the kit: a snap of its clasp, then G5, B5, D6 sines 90 ms apart with a soft square under each
    heal() {
      const t = now();
      noise(t, 0.03, { hp: 2000, gain: 0.4, decay: 0.005 });
      [784, 987.8, 1174.7].forEach((f0, i) => {
        tone(t + 0.06 + i * 0.09, 0.3, { f0, gain: 0.22, attack: 0.005, decay: 0.08 });
        tone(t + 0.06 + i * 0.09, 0.12, { type: 'square', f0: f0 / 2, gain: 0.06, attack: 0.005, release: 0.03 });
      });
    },
    // a tube blown up: a crack and a 120 ms burst, a short hiss of the hose venting, and two
    // small clatters of its bits coming down at 0.25 and 0.4 s
    tubeBurst() {
      const t = now();
      noise(t, 0.03, { hp: 2000, gain: 0.7, decay: 0.005 });
      noise(t, 0.12, { lp: 2500, gain: 0.6, decay: 0.025 });
      tone(t, 0.1, { f0: 300, f1: 60, gain: 0.4, decay: 0.03 });
      noise(t + 0.03, 0.3, { hp: 3000, gain: 0.2, decay: 0.08 });
      for (const d of [0.25, 0.4]) noise(t + d, 0.03, { hp: 1500, lp: 7000, gain: 0.25, decay: 0.006 });
    },
    // water on the fire: a bright hiss over 0.7 s with a low puff under it
    sizzle() {
      const t = now();
      noise(t, 0.7, { hp: 2500, lp: 9000, gain: 0.35, decay: 0.18 });
      noise(t, 0.25, { lp: 500, gain: 0.3, decay: 0.06 });
    },
    // a whoosh: low noise rising and a brighter breath over it, 0.4 s
    whoosh() {
      const t = now();
      noise(t, 0.4, { lp: 700, gain: 0.3, decay: 0.12 });
      noise(t + 0.05, 0.3, { hp: 400, lp: 2500, gain: 0.15, decay: 0.08 });
    },
  };

  // a balloon's pop: an 8 ms crack, a 60 ms burst through a 1.5 kHz lowpass, and a hollow
  // thump falling 220 → 70 Hz
  function pop() {
    const t = now();
    noise(t, 0.008, { hp: 2000, gain: 0.7, decay: 0.002 });
    noise(t, 0.06, { lp: 1500, gain: 0.5, decay: 0.012 });
    tone(t, 0.09, { f0: 220, f1: 70, gain: 0.4, decay: 0.025 });
  }

  // A scream, faint and far: a sawtooth with a 6.5 Hz wobble, 700 Hz up to 1100 and down to
  // 500 over 0.9 s, lowpassed at 2.2 kHz, breath noise under it.
  function scream(when: number) {
    const o = ctx!.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(700, when);
    o.frequency.exponentialRampToValueAtTime(1100, when + 0.25);
    o.frequency.exponentialRampToValueAtTime(900, when + 0.6);
    o.frequency.exponentialRampToValueAtTime(500, when + 0.9);
    const lfo = ctx!.createOscillator();
    lfo.frequency.value = 6.5;
    const lfoG = ctx!.createGain();
    lfoG.gain.value = 40;
    lfo.connect(lfoG);
    lfoG.connect(o.frequency);
    const lp = ctx!.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    const g = ctx!.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.07, when + 0.08);
    g.gain.setValueAtTime(0.07, when + 0.6);
    g.gain.linearRampToValueAtTime(0, when + 0.9);
    o.connect(lp);
    lp.connect(g);
    g.connect(out!);
    o.start(when);
    lfo.start(when);
    o.stop(when + 0.92);
    lfo.stop(when + 0.92);
    noise(when, 0.9, { hp: 1500, lp: 5000, gain: 0.03, decay: 0.4 });
  }

  function deathNotes(t: number) {
    [440, 392, 349.2].forEach((f0, i) => tone(t + i * 0.15, 0.12, { type: 'square', f0, gain: 0.2, attack: 0.005, release: 0.03 }));
  }
}
