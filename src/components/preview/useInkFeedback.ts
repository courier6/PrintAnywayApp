import { useEffect, useRef, useState } from 'react';

/** How long the caption confirms a new ink. */
const INKED_MS = 2000;
/** The download button's nudge starts this long after an ink change, once the flash and the caption have settled… */
const HINT_DELAY_MS = 1600;
/** …and lasts this long. */
const HINT_MS = 3600;

/**
 * What the preview shows for a moment after a swatch click: the caption's confirmation (`justInked`), a
 * glow on the page (`flashKey` changes with every click, so the animation restarts on quick ones), and a
 * later, quieter nudge toward the download button (`downloadHint`).
 */
export function useInkFeedback(inkIndex: number) {
  const [justInked, setJustInked] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [downloadHint, setDownloadHint] = useState(false);
  const inkTimer = useRef<number | null>(null);
  const hintTimers = useRef<number[]>([]);
  const prevInk = useRef(inkIndex);

  useEffect(() => {
    if (prevInk.current === inkIndex) return;
    prevInk.current = inkIndex;
    setFlashKey((k) => k + 1);
    setJustInked(true);
    if (inkTimer.current !== null) window.clearTimeout(inkTimer.current);
    inkTimer.current = window.setTimeout(() => setJustInked(false), INKED_MS);
    setDownloadHint(false);
    hintTimers.current.forEach((t) => window.clearTimeout(t));
    hintTimers.current = [
      window.setTimeout(() => setDownloadHint(true), HINT_DELAY_MS),
      window.setTimeout(() => setDownloadHint(false), HINT_DELAY_MS + HINT_MS),
    ];
  }, [inkIndex]);

  useEffect(
    () => () => {
      if (inkTimer.current !== null) window.clearTimeout(inkTimer.current);
      hintTimers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  return { justInked, flashKey, downloadHint };
}
