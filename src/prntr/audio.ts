export type DiscoveryName = 'discoverBLow' | 'discoverD' | 'discoverDLow';
export type CueName = DiscoveryName | 'creditA';

export interface Cue {
  name: CueName;
  buffer: AudioBuffer | null;
  /** Seconds. Known even when there is no AudioContext. */
  duration: number;
}

export interface PrntrAudio {
  context: AudioContext | null;
  cues: Record<CueName, Cue>;
  /** One of the three discovery cues, never the same one twice in a row (per session). */
  pickDiscovery(): Cue;
  /** Plays now (or at `when`, in AudioContext time). Silent without a context. */
  play(cue: Cue, when?: number): void;
  setGain(v: number): void;
}

const DISCOVERY_NAMES: DiscoveryName[] = ['discoverBLow', 'discoverD', 'discoverDLow'];
let lastDiscovery: DiscoveryName | null = null;

/** Silent stand-in until the synthesized cues land: right durations, no sound. */
export function createPrntrAudio(context: AudioContext | null): PrntrAudio {
  const cue = (name: CueName, duration: number): Cue => ({ name, buffer: null, duration });
  const cues: Record<CueName, Cue> = {
    discoverBLow: cue('discoverBLow', 1.0),
    discoverD: cue('discoverD', 1.2),
    discoverDLow: cue('discoverDLow', 1.2),
    creditA: cue('creditA', 0.25),
  };
  return {
    context,
    cues,
    pickDiscovery() {
      const pool = DISCOVERY_NAMES.filter((n) => n !== lastDiscovery);
      const name = pool[Math.floor(Math.random() * pool.length)];
      lastDiscovery = name;
      return cues[name];
    },
    play() {},
    setGain() {},
  };
}
