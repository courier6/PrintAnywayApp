import { t } from '../i18n';
import { useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';

interface Props {
  onFile: (file: File) => void;
  onChoose: () => void;
  children: ReactNode;
}

/** The full-screen dashed drop target. Focusable; Enter/Space opens the picker. */
export function DropZone({ onFile, onChoose, children }: Props) {
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      onChoose();
    }
  }

  return (
    <div
      className={'drop-zone' + (dragOver ? ' drag-over' : '')}
      tabIndex={0}
      aria-label={t('dropZone.ariaLabel')}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
