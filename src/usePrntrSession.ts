import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AppState } from './App';
import { prntrAudioContext } from './components/prntrAudio';
import { reducedMotion } from './prntr/anim';
import type { Certificate } from './prntr/types';

/** The page Prntr is handed: the document's first page as it was and in the chosen ink. */
export interface PrntrPage {
  source: HTMLCanvasElement;
  recolored: HTMLCanvasElement;
}

/** Under reduced motion, how long the GAME OVER card stays up before the plain cut back to the app. */
const REDUCED_OVER_HOLD_MS = 2000;

interface Options {
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  /** The open document's first page, recolored in the chosen ink; null when there is none to hand over. */
  firstPage: () => PrntrPage | null;
  /** Prntr is about to take the screen. */
  onEnter: () => void;
  /** The room was cleared: the certificate becomes the document. May throw. */
  onCertificate: (certificate: Certificate) => void;
  /** onCertificate threw: the old document is gone, so the app shows the error card. */
  onError: (err: unknown) => void;
}

/**
 * The app's side of a Prntr run (PRNTR-ARCHITECTURE.md): what the game is handed, where the app goes
 * back to, and how its UI comes back over the game's last frame.
 */
export function usePrntrSession({ appState, setAppState, firstPage, onEnter, onCertificate, onError }: Options) {
  const [stage, setStage] = useState(0);
  const page = useRef<PrntrPage | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const returnTo = useRef<AppState>('preview');
  const overHold = useRef<number | null>(null); // the reduced-motion GAME OVER hold before the cut
  // Set while the app's UI falls back into place over Prntr's last frame: the sky
  // drop after the room is cleared, the Tetris drop after a game over.
  const [drop, setDrop] = useState<'sky' | 'tetris' | null>(null);

  // Prntr takes over the viewport with the document's first page, whatever page is shown (or a page it is
  // handed, which only the dev entrance does); see PRNTR-ARCHITECTURE.md. The room prints it (PRNTR-FIRE.md §14).
  function enter(toStage: number, handed?: PrntrPage) {
    let entering = handed ?? null;
    if (!entering) {
      if (appState !== 'preview') return;
      entering = firstPage();
      if (!entering) return;
    }
    clearOverHold();
    returnTo.current = appState;
    audio.current = prntrAudioContext();
    onEnter();
    page.current = entering;
    setStage(toStage);
    setAppState('prntr');
  }

  function exit() {
    clearOverHold();
    page.current = null; // the page it was handed goes with it
    setAppState(returnTo.current);
  }

  function clearOverHold() {
    if (overHold.current === null) return;
    window.clearTimeout(overHold.current);
    overHold.current = null;
  }

  // The drop has landed (or its safety net fired): Prntr unmounts, and its page goes.
  function land() {
    page.current = null;
    setDrop(null);
  }

  // The drops (PRNTR-STAGE-1.md §4.10): after the room is cleared the app's UI falls
  // into place from the sky in one piece; after a game over its blocks fall in one by
  // one like Tetris pieces. Either way over the frozen last frame of Prntr, which stays
  // mounted until the drop has landed. Reduced motion is a plain cut, as is any exit.
  // The room cleared, the page the app comes back to is the certificate of completion,
  // in place of whatever document it had.
  function finish(outcome: 'cleared' | 'over', certificate?: Certificate) {
    if (certificate) {
      try {
        onCertificate(certificate);
      } catch (err) {
        // The old document is already gone: say so on the error card rather than
        // drop back onto an empty preview.
        onError(err);
        return;
      }
      returnTo.current = 'preview';
    }
    if (reducedMotion()) {
      if (outcome === 'over') {
        // a plain cut, but not on the very frame the card went up: the GAME OVER card is held for a moment first (an Esc
        // in that moment, a new document or a new run clears the hold, so it never cuts away from what came after)
        overHold.current = window.setTimeout(() => {
          overHold.current = null;
          page.current = null;
          setAppState((s) => (s === 'prntr' ? returnTo.current : s));
        }, REDUCED_OVER_HOLD_MS);
        return;
      }
      exit();
      return;
    }
    setDrop(outcome === 'over' ? 'tetris' : 'sky');
    setAppState(returnTo.current);
  }

  // Safety net: Prntr never stays mounted if the drop's animationend does not arrive.
  useEffect(() => {
    if (!drop) return;
    const id = window.setTimeout(land, drop === 'tetris' ? 2000 : 1200);
    return () => window.clearTimeout(id);
  }, [drop]);

  return {
    /** Prntr has the screen, or the app's UI is still dropping back in over its last frame. */
    active: appState === 'prntr' || drop !== null,
    /** The page Prntr was handed; null once it is gone. Read during render, like the state around it. */
    page: page.current,
    stage,
    audio: audio.current,
    drop,
    /** A run that started from a document goes back to it. */
    returnsToPreview: returnTo.current === 'preview',
    enter,
    exit,
    finish,
    land,
    clearOverHold,
  };
}
