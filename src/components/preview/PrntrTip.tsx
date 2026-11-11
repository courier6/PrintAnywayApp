import { useState } from 'react';
import { OTHER_TIP } from '../../lib/printerTips';
import RisingGlyphs from '../RisingGlyphs';

interface Props {
  /** The chosen ink: the link's colour. */
  inkHex: string;
  onOpen: () => void;
  /** The item was opened: time to warm Prntr's chunk. */
  onPrefetch: () => void;
}

/**
 * The fourth help item: cross-brand advice, and the way into Prntr (PRNTR-TRIGGER.md). English only, so
 * not in PRINTER_TIPS (shared with the landing page) nor localized. Hidden on touch screens until
 * Prntr's touch form is done (.help-other).
 */
export function PrntrTip({ inkHex, onOpen, onPrefetch }: Props) {
  // The link's glyphs run while it has the pointer or the focus: two flags, so one leaving does not end the other's.
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <details
      className="help-item help-other"
      onToggle={(e) => {
        if (e.currentTarget.open) onPrefetch();
      }}
    >
      <summary>{OTHER_TIP.label}</summary>
      <div className="help-body">
        <p>{OTHER_TIP.body1}</p>
        <p>{OTHER_TIP.body2}</p>
        <p>
          {OTHER_TIP.lead}
          {/* The link reads as plain text until it has the pointer or the focus; then glyphs
              rise above and sink below it (RisingGlyphs) and stop when it loses them. */}
          <span className="help-omen" style={{ color: inkHex }}>
            <button
              type="button"
              className="help-link"
              onClick={onOpen}
              onPointerEnter={() => setHover(true)}
              onPointerLeave={() => setHover(false)}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
            >
              {OTHER_TIP.link}
            </button>
            <RisingGlyphs active={hover || focus} />
          </span>
          {OTHER_TIP.tail}
        </p>
      </div>
    </details>
  );
}
