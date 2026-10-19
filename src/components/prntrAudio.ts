let shared: AudioContext | null | undefined;

/**
 * The one AudioContext Prntr plays through. Browsers only let audio start after a
 * user gesture, so the host calls this from the gesture that opens Prntr (the
 * future trigger's click). Without a gesture (the dev entrance) the context stays
 * suspended and Prntr runs silent, with the same timing.
 */
export function prntrAudioContext(): AudioContext | null {
  if (shared === undefined) shared = typeof AudioContext === 'undefined' ? null : new AudioContext();
  if (shared && shared.state === 'suspended') void shared.resume().catch(() => undefined);
  return shared;
}
