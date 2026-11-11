import { t } from '../../i18n';
import type { Ink } from '../../lib/inks';

interface Props {
  /** The inks on offer (the four, and gold once Prntr's room is won). */
  inks: readonly Ink[];
  inkIndex: number;
  onSelectInk: (index: number) => void;
}

/** The ink label, a swatch per ink and the chosen ink's name. */
export function InkPicker({ inks, inkIndex, onSelectInk }: Props) {
  return (
    <div className="ink-block">
      <div className="side-label">{t('preview.inkLabel')}</div>
      <div className="swatch-row">
        {inks.map((ink, i) => (
          <button
            key={ink.hex}
            className="swatch"
            aria-label={t(ink.nameKey)}
            title={t(ink.nameKey)}
            aria-pressed={i === inkIndex}
            style={{
              background: ink.swatch ?? ink.hex,
              boxShadow:
                i === inkIndex
                  ? `0 0 0 2px #ffffff, 0 0 0 4px ${ink.hex}`
                  : '0 0 0 1px rgba(0,0,0,.15)',
            }}
            onClick={() => onSelectInk(i)}
          />
        ))}
      </div>
      <div className="ink-name">{t(inks[inkIndex].nameKey)}</div>
    </div>
  );
}
