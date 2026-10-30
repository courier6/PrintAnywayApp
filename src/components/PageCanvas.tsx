import { useEffect, useRef } from 'react';

interface Props {
  canvas: HTMLCanvasElement | null;
  className?: string;
  /** What the page is, for a screen reader: the layer is then an image with this name. */
  label?: string;
  /** A layer that duplicates another (the original under the recolored page): not read out. */
  hidden?: boolean;
}

/** Mounts a live canvas element (owned by the PageStore) into the tree. */
export function PageCanvas({ canvas, className, label, hidden }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (canvas) {
      if (canvas.parentElement !== el) el.replaceChildren(canvas);
    } else {
      el.replaceChildren();
    }
  }, [canvas]);

  return <div ref={ref} className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={hidden || undefined} />;
}
