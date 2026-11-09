/**
 * Chord diagram of the 66 books: each book is an arc on a circle (size = references touching
 * the book), each ribbon joins two books (width = references between them, both directions).
 * References inside a single book are left out.
 */
import { arc, chord, ribbon, type Chord } from 'd3';
import { useMemo, useState } from 'react';
import { BOOKS, type Lang } from '../../data/bibleStructure.ts';
import { GENRES } from '../../data/books.ts';
import { categorical } from '../../utils/colors.ts';

export function symmetricCounts(counts: number[]): number[][] {
  return Array.from({ length: 66 }, (_, i) => Array.from({ length: 66 }, (_, j) => (i === j ? 0 : counts[i * 66 + j] + counts[j * 66 + i])));
}

export function ChordDiagram({ counts, selected, onSelect, lang, minRibbon = 0 }: { counts: number[]; selected: number | null; onSelect: (b: number | null) => void; lang: Lang; minRibbon?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const size = 720;
  const outer = size / 2 - 70;
  const inner = outer - 12;
  const layout = useMemo(() => chord().padAngle(0.004).sortSubgroups((a, b) => b - a)(symmetricCounts(counts)), [counts]);
  const arcGen = arc<{ startAngle: number; endAngle: number }>().innerRadius(inner).outerRadius(outer);
  const ribbonGen = ribbon<Chord, { startAngle: number; endAngle: number }>().radius(inner - 1);
  const focus = hover ?? selected;
  const color = (b: number) => categorical(GENRES.indexOf(BOOKS[b].genre));
  const max = Math.max(...layout.map((c) => c.source.value));
  return (
    <svg viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} className="h-auto w-full max-w-[720px]" role="img" aria-label="Chord diagram of the 66 books" data-testid="chord-diagram">
      <g>
        {layout
          .filter((c) => c.source.value >= minRibbon)
          .sort((a, b) => Number(focus != null && (a.source.index === focus || a.target.index === focus)) - Number(focus != null && (b.source.index === focus || b.target.index === focus)))
          .map((c) => {
            const on = focus == null || c.source.index === focus || c.target.index === focus;
            const owner = focus != null && c.target.index === focus ? c.source.index : c.source.index === focus ? c.target.index : c.source.index;
            return (
              <path
                key={`${c.source.index}-${c.target.index}`}
                d={ribbonGen(c) as unknown as string}
                fill={color(focus != null ? owner : c.source.value >= c.target.value ? c.source.index : c.target.index)}
                opacity={on ? (focus != null ? 0.8 : 0.15 + 0.55 * Math.sqrt(c.source.value / max)) : 0.03}
              >
                <title>{`${BOOKS[c.source.index].name[lang]} ↔ ${BOOKS[c.target.index].name[lang]}: ${c.source.value}`}</title>
              </path>
            );
          })}
      </g>
      <g>
        {layout.groups.map((g) => {
          const mid = (g.startAngle + g.endAngle) / 2;
          const deg = (mid * 180) / Math.PI - 90;
          const flip = mid > Math.PI;
          const active = focus == null || focus === g.index;
          return (
            <g
              key={g.index}
              className="cursor-pointer"
              onMouseEnter={() => setHover(g.index)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(selected === g.index ? null : g.index)}
              data-book={BOOKS[g.index].code}
            >
              <path d={arcGen(g) as string} fill={color(g.index)} opacity={active ? 1 : 0.4} />
              <text
                transform={`rotate(${deg}) translate(${outer + 6},0) ${flip ? 'rotate(180)' : ''}`}
                textAnchor={flip ? 'end' : 'start'}
                dominantBaseline="middle"
                fontSize={10}
                fill="currentColor"
                opacity={active ? 0.9 : 0.4}
                fontWeight={focus === g.index ? 700 : 500}
              >
                {BOOKS[g.index].short[lang]}
              </text>
              <title>{`${BOOKS[g.index].name[lang]}: ${g.value}`}</title>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
