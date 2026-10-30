import { prefetchPdfjs } from '../lib/loadDocument';
import { useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';

interface Props {
  onFile: (file: File) => void;
  /** Opens the file picker: a click anywhere on the zone, outside its own controls. */
  onChoose: () => void;
  children: ReactNode;
}

/**
 * The full-screen dashed drop target. A click on it opens the picker, as the big dashed box
 * invites; not a tab stop of its own: the button inside it opens the picker for keyboard and
 * screen-reader users.
 */
export function DropZone({ onFile, onChoose, children }: Props) {
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    // The zone's own controls (the button, the tips) handle their clicks; a click on the text or the space opens the picker.
    if ((e.target as HTMLElement).closest('button, a, summary, details')) return;
    onChoose();
  }

  return (
    <div
      className={'drop-zone' + (dragOver ? ' drag-over' : '')}
      onClick={handleClick}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onPointerEnter={prefetchPdfjs}
      onFocus={prefetchPdfjs}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}
