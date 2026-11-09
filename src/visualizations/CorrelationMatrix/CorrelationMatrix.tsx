/**
 * Correlation chart of the whole Bible: an n × n matrix (66 books or 1,189 chapters) coloured
 * by Pearson's r between connection profiles. Drawn pixel-per-cell into an ImageData and
 * scaled up without smoothing, so 1.4 million cells render instantly.
 */
import { interpolateLab, piecewise, rgb } from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CorrLevel } from '../../analysis/correlation.ts';
import { BOOKS, CHAPTERS, VERSE_CHAPTER, formatChapter, formatVerse, type Lang } from '../../data/bibleStructure.ts';

export function correlationColor(theme: 'dark' | 'light'): (r: number) => string {
  const neutral = theme === 'dark' ? '#14161d' : '#f2f2ee';
  const neg = piecewise(interpolateLab, [neutral, '#3b6fe0', '#7fb2ff']);
  const pos = piecewise(interpolateLab, [neutral, '#7a3a8c', '#e0475b', '#f59e0b', '#fde68a']);
  return (r: number) => (Number.isNaN(r) ? neutral : r >= 0 ? pos(Math.min(1, r)) : neg(Math.min(1, -r)));
}

/** Name of a node by its global id (book id, chapter id or verse index). */
export function nodeName(level: CorrLevel, i: number, lang: Lang, short = false): string {
  if (level === 'book') return short ? BOOKS[i].short[lang] : BOOKS[i].name[lang];
  if (level === 'chapter') return formatChapter(i, lang, short);
  return formatVerse(i, lang, short);
}

export function CorrelationMatrix({
  matrix,
  n,
  offset = 0,
  level,
  order,
  theme,
  lang,
  selected,
  onSelect,
}: {
  matrix: Float32Array;
  n: number;
  offset?: number;
  level: CorrLevel;
  order: Int32Array;
  theme: 'dark' | 'light';
  lang: Lang;
  selected: [number, number] | null;
  onSelect: (cell: [number, number]) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(600);
  const [hover, setHover] = useState<{ a: number; b: number; x: number; y: number } | null>(null);
  const LABEL = level === 'book' ? 44 : 34;
  const color = useMemo(() => correlationColor(theme), [theme]);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setSize(Math.max(280, Math.min(820, el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cell image (n × n pixels) in the requested order.
  const image = useMemo(() => {
    const lut = Array.from({ length: 256 }, (_, i) => rgb(color(i / 127.5 - 1)));
    const nan = rgb(color(NaN));
    const c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const r = matrix[order[y] * n + order[x]];
        const col = Number.isNaN(r) ? nan : lut[Math.max(0, Math.min(255, Math.round((r + 1) * 127.5)))];
        const o = (y * n + x) * 4;
        img.data[o] = col.r;
        img.data[o + 1] = col.g;
        img.data[o + 2] = col.b;
        img.data[o + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return c;
  }, [matrix, n, order, color]);

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
    const area = size - LABEL;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, LABEL, LABEL, area, area);
    const cs = getComputedStyle(document.documentElement);
    const muted = cs.getPropertyValue('--muted').trim();
    const fg = cs.getPropertyValue('--fg').trim();
    const cell = area / n;
    ctx.fillStyle = muted;
    ctx.font = `${Math.max(7, Math.min(10, level === 'book' ? cell * 0.9 : 10))}px "Inter Variable", Inter, system-ui, sans-serif`;
    if (level === 'book') {
      const step = cell >= 8 ? 1 : 2;
      for (let i = 0; i < n; i += step) {
        const label = BOOKS[order[i]].short[lang];
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
    } else if (level === 'verse') {
      // Chapter boundaries inside the book.
      ctx.strokeStyle = fg;
      ctx.lineWidth = 0.5;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      let last = -Infinity;
      for (let i = 0; i < n; i++) {
        const g = offset + i;
        if (i > 0 && VERSE_CHAPTER[g] === VERSE_CHAPTER[g - 1]) continue;
        const p = LABEL + i * cell;
        ctx.globalAlpha = 0.15;
        ctx.beginPath();
        ctx.moveTo(p, LABEL);
        ctx.lineTo(p, size);
        ctx.moveTo(LABEL, p);
        ctx.lineTo(size, p);
        ctx.stroke();
        const len = CHAPTERS[VERSE_CHAPTER[g]].verseCount;
        const mid = p + (len * cell) / 2;
        if (mid - last > 13) {
          ctx.globalAlpha = 1;
          ctx.fillText(String(CHAPTERS[VERSE_CHAPTER[g]].number), LABEL - 3, mid);
          last = mid;
        }
      }
      ctx.globalAlpha = 1;
    } else {
      // Book boundaries (when in canonical order) with labels where they fit.
      const canonical = order.every((v, i) => v === i);
      if (canonical) {
        ctx.strokeStyle = fg;
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 0.5;
        let last = -Infinity;
        for (const b of BOOKS) {
          const p = LABEL + b.firstChapter * cell;
          ctx.beginPath();
          ctx.moveTo(p, LABEL);
          ctx.lineTo(p, size);
          ctx.moveTo(LABEL, p);
          ctx.lineTo(size, p);
          ctx.stroke();
          const mid = LABEL + (b.firstChapter + b.chapterCount / 2) * cell;
          if (mid - last > 16) {
            ctx.globalAlpha = 1;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(b.short[lang], LABEL - 3, mid);
            ctx.globalAlpha = 0.18;
            last = mid;
          }
        }
        ctx.globalAlpha = 1;
      }
    }
    if (selected) {
      const ia = order.indexOf(selected[0]), ib = order.indexOf(selected[1]);
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.5;
      const w = Math.max(4, cell);
      ctx.strokeRect(LABEL + ib * cell - (w - cell) / 2 - 1, LABEL + ia * cell - (w - cell) / 2 - 1, w + 2, w + 2);
    }
  }, [image, size, LABEL, n, order, lang, level, selected, theme, offset]);

  const cellAt = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    const area = size - LABEL;
    const x = Math.floor(((e.clientX - r.left - LABEL) / area) * n), y = Math.floor(((e.clientY - r.top - LABEL) / area) * n);
    if (x < 0 || y < 0 || x >= n || y >= n) return null;
    return { a: order[y], b: order[x], x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div ref={wrap} className="relative w-full" data-testid="correlation-matrix">
      <canvas
        ref={canvas}
        className="cursor-crosshair"
        role="img"
        aria-label="Correlation matrix"
        onPointerMove={(e) => setHover(cellAt(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const c = cellAt(e);
          if (c) onSelect([c.a, c.b]);
        }}
      />
      {hover && (
        <div className="pointer-events-none absolute z-10 rounded-md border border-line bg-panel/95 px-2 py-1 text-xs shadow" style={{ left: Math.min(hover.x + 12, size - 190), top: hover.y + 12 }}>
          <div className="font-medium">
            {nodeName(level, offset + hover.a, lang)} ↔ {nodeName(level, offset + hover.b, lang)}
          </div>
          <div className="tabular-nums text-muted">r = {Number.isNaN(matrix[hover.a * n + hover.b]) ? '—' : matrix[hover.a * n + hover.b].toFixed(3)}</div>
        </div>
      )}
    </div>
  );
}

export { CHAPTERS };
