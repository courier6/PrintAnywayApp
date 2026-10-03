import { PRINTER_TIPS } from '../lib/printerTips';
import { DropZone } from './DropZone';

interface Props {
  onFile: (file: File) => void;
  onChoose: () => void;
}

export function EmptyState({ onFile, onChoose }: Props) {
  return (
    <div className="state-pad">
      <DropZone onFile={onFile} onChoose={onChoose}>
        <h1 className="hero-headline">Out of black ink? Drop your document here.</h1>
        <p className="hero-subline">
          It gets re-inked in a dark color your printer can still print — every page, every
          photo, still readable.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={onChoose}>
            Choose a file
          </button>
          <span className="hero-formats">PDF, PNG, JPG, or HEIC</span>
        </div>
      </DropZone>
      <div className="below-zone">
        <span className="privacy-line">
          Your file never leaves your device — everything happens in your browser.
        </span>
      </div>
      <details className="printer-tips">
        <summary>
          For HP, Epson, Canon and most other color printers ·{' '}
          <span className="printer-tips-link">Printer still refusing? See tips</span>
        </summary>
        <dl className="printer-tips-list">
          {PRINTER_TIPS.map((t) => (
            <div key={t.brand}>
              <dt>{t.brand}</dt>
              <dd>{t.tip}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
