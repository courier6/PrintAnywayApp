let shared: AudioContext | null | undefined;
let suspendTimer: number | undefined;

/**
 * The one AudioContext Prntr plays through. Browsers only let audio start after a
 * user gesture, so the host calls this from the gesture that opens Prntr (the
 * future trigger's click). Without a gesture (the dev entrance) the context stays
 * suspended and Prntr runs silent, with the same timing.
 */
export function prntrAudioContext(): AudioContext | null {
  if (shared === undefined) shared = typeof AudioContext === 'undefined' ? null : new AudioContext();
  keepPrntrAudio();
  // asked for whatever the state reads: a suspend still on its way (warmPrntrAudio's, or a finished run's) leaves the
  // state at 'running' for a moment, and a resume asked for now is carried out after it
  if (shared && shared.state !== 'closed') void shared.resume().catch(() => undefined);
  return shared;
}

/**
 * Makes the context ahead of the click that opens Prntr, and returns its sample rate (null when there is none yet).
 * A page's first AudioContext takes the main thread 100 ms and more while the system's audio is opened; made here,
 * when the host warms the game's chunk, the click's own frame does not pay for it. Only once the page has had a
 * gesture (a browser warns about a context made before one), and suspended at once like the one a run leaves
 * behind: the entrance resumes it.
 */
export function warmPrntrAudio(): number | null {
  if (shared === undefined && typeof AudioContext !== 'undefined' && navigator.userActivation?.hasBeenActive) {
    shared = new AudioContext();
    void shared.suspend().catch(() => undefined);
  }
  return shared?.sampleRate ?? null;
}

/** Prntr is running: cancels a suspend asked for by the run before it. */
export function keepPrntrAudio(): void {
  window.clearTimeout(suspendTimer);
  suspendTimer = undefined;
}

/**
 * Prntr has gone: suspends the context once its last sounds are over, so the audio
 * hardware is not kept awake for the rest of the session (a phone's battery).
 * The next entrance resumes it.
 */
export function releasePrntrAudio(afterMs: number): void {
  window.clearTimeout(suspendTimer);
  suspendTimer = window.setTimeout(() => {
    suspendTimer = undefined;
    if (shared?.state === 'running') void shared.suspend().catch(() => undefined);
  }, afterMs);
}
