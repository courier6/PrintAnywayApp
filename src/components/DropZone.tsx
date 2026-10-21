import { prefetchPdfjs } from '../lib/loadDocument';
import { useState, type DragEvent, type ReactNode } from 'react';

interface Props {
  onFile: (file: File) => void;
  children: ReactNode;
}

/**
 * The full-screen dashed drop target. Not a tab stop of its own: the button
 * inside it opens the picker for keyboard and screen-reader users.
 */
export function DropZone({ onFile, children }: Props) {
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={'drop-zone' + (dragOver ? ' drag-over' : '')}
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
