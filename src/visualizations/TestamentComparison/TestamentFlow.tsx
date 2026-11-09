/**
 * Testament comparison: Old Testament books (left) and New Testament books (right), linked by
 * ribbons whose width is proportional to the number of cross-references between them.
 * A bipartite flow keeps 39 × 27 relations legible better than a chord diagram.
 */
import { useMemo } from 'react';
import { BOOKS, type Lang } from '../../data/bibleStructure.ts';
import { GENRES } from '../../data/books.ts';
import { formatNumber } from '../../i18n/index.ts';
import { categorical } from '../../utils/colors.ts';

export type FlowDirection = 'ot-nt' | 'nt-ot' | 'both';

const OT = BOOKS.filter((b) => b.testament === 'OT');
const NT = BOOKS.filter((b) => b.testament === 'NT');

export function flowCounts(counts: number[], dir: FlowDirection): number[][] {
  return OT.map((o) =>
    NT.map((n) => (dir === 'ot-nt' ? counts[o.id * 66 + n.id] : dir === 'nt-ot' ? counts[n.id * 66 + o.id] : counts[o.id * 66 + n.id] + counts[n.id * 66 + o.id])),
  );
}

export function TestamentFlow({ counts, direction, selected, onSelect, lang }: { counts: number[]; direction: FlowDirection; selected: number | null; onSelect: (bookId: number | null) => void; lang: Lang }) {
  const flows = useMemo(() => flowCounts(counts, direction), [counts, direction]);
  const W = 640, H = 720, PAD = 14, COL = 96;
  const otTotals = flows.map((row) => row.reduce((a, b) => a + b, 0));
  const ntTotals = NT.map((_, j) => flows.reduce((a, row) => a + row[j], 0));
  const total = otTotals.reduce((a, b) => a + b, 0) || 1;
  const GAP = 2;
  const avail = (n: number) => H - 2 * PAD - GAP * (n - 1);
  const layout = (totals: number[]) => {
    let y = PAD;
    const k = avail(totals.length) / total;
    return totals.map((v) => {
      const h = Math.max(2, v * k);
      const r = { y, h };
      y += h + GAP;
      return r;
    });
  };
  const L = layout(otTotals), R = layout(ntTotals);
  const k = avail(OT.length) / total;
  const lOff = L.map((r) => r.y), rOff = R.map((r) => r.y);
  const ribbons: { i: number; j: number; d: string; v: number }[] = [];
  OT.forEach((_, i) =>
    NT.forEach((__, j) => {
      const v = flows[i][j];
      if (!v) return;
      const h = v * k * (L[i].h / Math.max(1, otTotals[i] * k));
      const h2 = v * k * (R[j].h / Math.max(1, ntTotals[j] * k));
      const y1 = lOff[i], y2 = rOff[j];
      lOff[i] += h;
      rOff[j] += h2;
      const x1 = PAD + COL, x2 = W - PAD - COL, xm = (x1 + x2) / 2;
      ribbons.push({ i, j, v, d: `M${x1},${y1} C${xm},${y1} ${xm},${y2} ${x2},${y2} L${x2},${y2 + h2} C${xm},${y2 + h2} ${xm},${y1 + h} ${x1},${y1 + h} Z` });
    }),
  );
  const isSel = (bookId: number) => selected === bookId;
  const active = (i: number, j: number) => selected == null || OT[i].id === selected || NT[j].id === selected;
  const genreColor = (bookId: number) => categorical(GENRES.indexOf(BOOKS[bookId].genre));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[640px]" role="img" aria-label="Old Testament ↔ New Testament cross-references" data-testid="testament-flow">
      <g>
        {ribbons
          .sort((a, b) => Number(active(a.i, a.j)) - Number(active(b.i, b.j)))
          .map((r) => (
            <path key={`${r.i}-${r.j}`} d={r.d} fill={genreColor(selected != null && NT.some((n) => n.id === selected) ? NT[r.j].id : OT[r.i].id)} opacity={active(r.i, r.j) ? (selected != null ? 0.75 : 0.32) : 0.04}>
              <title>{`${OT[r.i].name[lang]} ↔ ${NT[r.j].name[lang]}: ${formatNumber(r.v, lang)}`}</title>
            </path>
          ))}
      </g>
      {[
        { books: OT, rects: L, x: PAD, align: 'end' as const },
        { books: NT, rects: R, x: W - PAD - COL, align: 'start' as const },
      ].map(({ books, rects, x, align }) =>
        books.map((b, i) => (
          <g key={b.id} className="cursor-pointer" onClick={() => onSelect(isSel(b.id) ? null : b.id)}>
            <rect x={align === 'end' ? x + COL - 8 : x} y={rects[i].y} width={8} height={rects[i].h} fill={genreColor(b.id)} opacity={selected == null || isSel(b.id) ? 1 : 0.35} rx={1.5} />
            {rects[i].h >= 7 || isSel(b.id) ? (
              <text
                x={align === 'end' ? x + COL - 12 : x + 12}
                y={rects[i].y + rects[i].h / 2}
                dominantBaseline="middle"
                textAnchor={align}
                fontSize={Math.min(12, Math.max(9, rects[i].h * 0.8))}
                fill="currentColor"
                opacity={selected == null || isSel(b.id) ? 0.9 : 0.4}
                fontWeight={isSel(b.id) ? 700 : 500}
              >
                {b.short[lang]}
              </text>
            ) : null}
            <title>{b.name[lang]}</title>
          </g>
        )),
      )}
    </svg>
  );
}

export const OT_BOOKS = OT;
export const NT_BOOKS = NT;
