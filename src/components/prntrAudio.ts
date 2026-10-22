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
  if (shared && shared.state !== 'running' && shared.state !== 'closed') void shared.resume().catch(() => undefined);
  return shared;
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
