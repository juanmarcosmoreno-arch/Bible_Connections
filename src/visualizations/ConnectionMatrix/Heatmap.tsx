/**
 * 66 × 66 connection matrix (rows: source book, columns: target book), drawn on canvas.
 * Scales: absolute count, normalised by book sizes, or weighted by votes.
 */
import { interpolateInferno, interpolateMagma } from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, NT_START } from '../../data/bibleStructure.ts';
import { formatNumber, useT } from '../../i18n/index.ts';
import { useApp } from '../../state/appState.ts';

export type MatrixScale = 'absolute' | 'normalized' | 'votes';

export function matrixValues(counts: number[], votes: number[], scale: MatrixScale): number[] {
  if (scale === 'absolute') return counts;
  if (scale === 'votes') return votes;
  // References per 1,000,000 possible verse pairs.
  return counts.map((c, k) => (c / (BOOKS[Math.floor(k / 66)].verseCount * BOOKS[k % 66].verseCount)) * 1e6);
}

export function Heatmap({ counts, votes, scale, selected, onSelect }: { counts: number[]; votes: number[]; scale: MatrixScale; selected: [number, number] | null; onSelect: (cell: [number, number]) => void }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const theme = useApp((s) => s.theme);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(520);
  const [hover, setHover] = useState<{ r: number; c: number; x: number; y: number } | null>(null);
  const values = useMemo(() => matrixValues(counts, votes, scale), [counts, votes, scale]);
  const max = useMemo(() => Math.max(...values), [values]);
  const LABEL = 44;

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setSize(Math.max(280, Math.min(760, el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const cell = (size - LABEL) / 66;
    const interp = theme === 'dark' ? interpolateInferno : interpolateMagma;
    const cs = getComputedStyle(document.documentElement);
    const muted = cs.getPropertyValue('--muted').trim();
    const fg = cs.getPropertyValue('--fg').trim();
    for (let r = 0; r < 66; r++)
      for (let col = 0; col < 66; col++) {
        const v = values[r * 66 + col];
        const x = Math.log1p(v) / Math.log1p(max || 1);
        ctx.fillStyle = v === 0 ? (theme === 'dark' ? '#0d0f15' : '#f0f0ec') : interp(theme === 'dark' ? 0.08 + 0.92 * x : 0.97 - 0.85 * x);
        ctx.fillRect(LABEL + col * cell, LABEL + r * cell, Math.ceil(cell), Math.ceil(cell));
      }
    // Testament separators
    const ntBook = BOOKS.find((b) => b.firstVerse === NT_START)!.id;
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LABEL + ntBook * cell, LABEL - 4);
    ctx.lineTo(LABEL + ntBook * cell, size);
    ctx.moveTo(LABEL - 4, LABEL + ntBook * cell);
    ctx.lineTo(size, LABEL + ntBook * cell);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Labels (every book if room, else every other)
    ctx.fillStyle = muted;
    ctx.font = `${Math.max(7, Math.min(10, cell * 0.9))}px "Inter Variable", Inter, system-ui, sans-serif`;
    const step = cell >= 8 ? 1 : 2;
    for (let i = 0; i < 66; i += step) {
      const label = BOOKS[i].short[lang];
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, LABEL - 4, LABEL + (i + 0.5) * cell);
      ctx.save();
      ctx.translate(LABEL + (i + 0.5) * cell, LABEL - 4);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'left';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    if (selected) {
      ctx.strokeStyle = fg;
      ctx.lineWidth = 2;
      ctx.strokeRect(LABEL + selected[1] * cell - 1, LABEL + selected[0] * cell - 1, cell + 2, cell + 2);
    }
  }, [values, max, size, theme, lang, selected]);

  const cellAt = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    const x = e.clientX - r.left - LABEL, y = e.clientY - r.top - LABEL;
    const cell = (size - LABEL) / 66;
    const col = Math.floor(x / cell), row = Math.floor(y / cell);
    if (col < 0 || row < 0 || col >= 66 || row >= 66) return null;
    return { r: row, c: col, x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const fmt = (v: number) => (scale === 'normalized' ? v.toFixed(2) : formatNumber(v, lang));
  return (
    <div ref={wrap} className="relative w-full" data-testid="heatmap">
      <canvas
        ref={canvas}
        className="cursor-crosshair"
        onPointerMove={(e) => setHover(cellAt(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const c = cellAt(e);
          if (c) onSelect([c.r, c.c]);
        }}
        aria-label={`${t('insights.matrix')}: ${t('insights.matrix.rows')}, ${t('insights.matrix.cols')}`}
        role="img"
      />
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-md border border-line bg-panel/95 px-2 py-1 text-xs shadow" style={{ left: Math.min(hover.x + 12, size - 180), top: hover.y + 12 }}>
          <div className="font-medium">{t('insights.matrix.cell', { a: BOOKS[hover.r].name[lang], b: BOOKS[hover.c].name[lang] })}</div>
          <div className="text-muted">
            {fmt(values[hover.r * 66 + hover.c])} · {formatNumber(counts[hover.r * 66 + hover.c], lang)} {t('unit.references')}
          </div>
        </div>
      )}
    </div>
  );
}
