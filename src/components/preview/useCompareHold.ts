import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

/** A press on the compare button let go within this latches: the original stays until the next press. */
const LATCH_MS = 350;
/** A click this soon after a press came from that press, and is not a click of its own. */
const CLICK_AFTER_PRESS_MS = 500;

interface Options {
  holding: boolean;
  onHoldChange: (holding: boolean) => void;
  /** False on the certificate: there the hold runs the vortex, which stays a hold. */
  canLatch: boolean;
  /** A change of either ends a latch: what is shown next is the recolored page. */
  inkIndex: number;
  currentPage: number;
}

/**
 * The compare button. Held, it shows the original until it is let go. Pressed and let go within LATCH_MS,
 * the original stays until the next press: a click, a tap, Enter, a switch or a voice command cannot hold.
 * Returns whether it is latched and the button's handlers.
 */
export function useCompareHold({ holding, onHoldChange, canLatch, inkIndex, currentPage }: Options) {
  const [latched, setLatched] = useState(false);
  const latchedRef = useRef(false);
  latchedRef.current = latched;
  const press = useRef<{ at: number; unlatches: boolean; mayLatch: boolean } | null>(null);
  const lastPressAt = useRef(0);

  function pressStart() {
    if (press.current) return;
    const at = performance.now();
    lastPressAt.current = at;
    if (latched) {
      // the press that ends a latch: its release does nothing more
      press.current = { at, unlatches: true, mayLatch: false };
      setLatched(false);
      onHoldChange(false);
      return;
    }
    // decided as the press starts: one that began on the certificate brings the original back and must not latch on it
    press.current = { at, unlatches: false, mayLatch: canLatch };
    onHoldChange(true);
  }

  /** `mayLatch`: the press ended on the button (let go), not by leaving it. */
  function pressEnd(mayLatch: boolean) {
    const p = press.current;
    press.current = null;
    if (!p) {
      // a hold nobody is pressing (the vortex hands the original back held): any release ends it
      if (holding && !latched) onHoldChange(false);
      return;
    }
    const now = performance.now();
    lastPressAt.current = now;
    if (p.unlatches) return;
    if (mayLatch && p.mayLatch && now - p.at < LATCH_MS) setLatched(true);
    else onHoldChange(false);
  }

  // The hold ended from outside (a new document, Prntr): the latch goes with it.
  useEffect(() => {
    if (!holding) setLatched(false);
  }, [holding]);

  const onHoldChangeRef = useRef(onHoldChange);
  onHoldChangeRef.current = onHoldChange;
  useEffect(() => {
    if (!latchedRef.current) return;
    setLatched(false);
    onHoldChangeRef.current(false);
  }, [inkIndex, currentPage]);

  return {
    latched,
    buttonProps: {
      onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        pressStart();
      },
      onPointerUp: () => pressEnd(true),
      onPointerLeave: () => pressEnd(false),
      onPointerCancel: () => pressEnd(false),
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          pressStart();
        }
      },
      onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          pressEnd(true);
        }
      },
      // A click no pointer or key press produced (a screen reader, voice control, a switch) toggles the latch.
      onClick: (e: MouseEvent<HTMLButtonElement>) => {
        if (e.detail !== 0 || performance.now() - lastPressAt.current < CLICK_AFTER_PRESS_MS) return;
        if (latched) {
          setLatched(false);
          onHoldChange(false);
        } else if (canLatch) {
          setLatched(true);
          onHoldChange(true);
        }
      },
      onBlur: () => pressEnd(false),
      onContextMenu: (e: MouseEvent<HTMLButtonElement>) => e.preventDefault(),
    },
  };
}
