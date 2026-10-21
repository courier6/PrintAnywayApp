import { useEffect, useRef, useState } from 'react';

/** What rises above the link, and what sinks below it. */
const ABOVE = '⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁺⁻^~*\'°˙˘∆∴▲░▒#%&@=/\\|<>';
const BELOW = '₀₁₂₃₄₅₆₇₈₉₊₋₌ₓₑₐ,._∇∵▼░▒#%&@=/\\|<>';
/** How often a glyph starts while the link has the pointer or the focus, and how many start at once at first. */
const SPAWN_MS = 50;
const BURST = 6;
/** A glyph's life, from nothing to nothing, in ms. */
const LIFE_MIN = 900;
const LIFE_MAX = 1600;
/** The share of glyphs split red and cyan, as Prntr's own glitches are. */
const SPLIT = 0.3;

interface Glyph {
  id: number;
  ch: string;
  /** Across the link, 0 to 1. */
  x: number;
  up: boolean;
  life: number;
  split: boolean;
}

/**
 * Glyphs rising above and sinking below the link while it has the pointer or the focus: superscripts,
 * subscripts and ASCII in the ink colour, each fading in and out over its life, a burst at first and
 * then one every SPAWN_MS. They are absolutely placed, so the text never moves; when the link loses the
 * pointer the glyphs already on show finish their lives and nothing follows. Decoration (aria-hidden).
 */
export default function RisingGlyphs({ active }: { active: boolean }) {
  const [glyphs, setGlyphs] = useState<Glyph[]>([]);
  const next = useRef(0);
  useEffect(() => {
    if (!active) return;
    const spawn = (n: number) =>
      setGlyphs((g) => [
        ...g,
        ...Array.from({ length: n }, () => {
          const up = Math.random() < 0.5;
          const set = up ? ABOVE : BELOW;
          return {
            id: next.current++,
            ch: set[(Math.random() * set.length) | 0],
            x: Math.random(),
            up,
            life: LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN),
            split: Math.random() < SPLIT,
          };
        }),
      ]);
    spawn(BURST);
    const id = window.setInterval(() => spawn(1), SPAWN_MS);
    return () => window.clearInterval(id);
  }, [active]);
  const gone = (id: number) => setGlyphs((g) => g.filter((x) => x.id !== id));
  return (
    <span className="omen" aria-hidden="true">
      {glyphs.map((g) => (
        <span
          key={g.id}
          className={`omen-glyph ${g.up ? 'is-up' : 'is-down'}${g.split ? ' is-split' : ''}`}
          style={{ left: `${g.x * 100}%`, animationDuration: `${g.life}ms` }}
          onAnimationEnd={() => gone(g.id)}
        >
          {g.ch}
        </span>
      ))}
    </span>
  );
}
