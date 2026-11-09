/**
 * Axis overlay (Canvas 2D): chapter bars, testament/book/chapter/verse labels with level
 * of detail, and markers for the selection and the hovered verse.
 *
 * Homage to Harrison & Römhild: each bar below the axis is a chapter; books alternate
 * light and dark grey, the first book of each testament is highlighted; bar length is the
 * number of verses (or, optionally, of cross-references) in the chapter.
 */
import { BOOKS, CHAPTERS, NT_START, TOTAL_VERSES, VERSE_NUMBER, type Lang } from '../../data/bibleStructure.ts';
import type { ArcLayout, ViewDomain } from './types.ts';

export interface AxisColors {
  a: string;
  b: string;
  hi: string;
  fg: string;
  muted: string;
  line: string;
  accent: string;
  bg: string;
}

export interface AxisMarker {
  start: number; // verse index
  end: number;
  color?: string;
  label?: string;
}

export interface AxisParams {
  view: ViewDomain;
  layout: ArcLayout;
  dpr: number;
  colors: AxisColors;
  lang: Lang;
  compact: boolean;
  bars: 'verses' | 'refs';
  chapterRefs: number[] | null;
  selection: AxisMarker[];
  hoverVerse: number | null;
  showLabels: boolean;
  /** Draws a solid background (exports). */
  background?: string | null;
}

const MAX_VERSES = 176; // Psalm 119

export function readAxisColors(): AxisColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { a: v('--axis-a'), b: v('--axis-b'), hi: v('--axis-hi'), fg: v('--fg'), muted: v('--muted'), line: v('--line'), accent: v('--accent'), bg: v('--bg') };
}

export function drawAxis(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, p: AxisParams) {
  const { view, layout, dpr, colors } = p;
  const W = layout.width;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (p.background) {
    ctx.fillStyle = p.background;
    ctx.fillRect(0, layout.baseline, W, layout.height - layout.baseline);
  }
  const span = view.x1 - view.x0;
  const pxPerVerse = W / (span * TOTAL_VERSES);
  const x = (verse: number) => ((verse / TOTAL_VERSES - view.x0) / span) * W;
  const base = layout.baseline;
  const barMax = p.compact ? 18 : 26;
  const firstVisible = Math.max(0, Math.floor(view.x0 * TOTAL_VERSES));
  const lastVisible = Math.min(TOTAL_VERSES - 1, Math.ceil(view.x1 * TOTAL_VERSES));

  // Selection bands (behind everything else).
  for (const m of p.selection) {
    const x0 = x(m.start), x1 = Math.max(x(m.end + 1), x0 + 2);
    ctx.fillStyle = m.color ?? colors.accent;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(x0, 0, x1 - x0, base);
    ctx.globalAlpha = 1;
  }

  // Chapter bars.
  const maxRefs = p.chapterRefs ? Math.max(1, ...p.chapterRefs) : 1;
  const gap = pxPerVerse * 20 > 6 ? 1 : 0;
  for (const ch of CHAPTERS) {
    const end = ch.globalPosition + ch.verseCount;
    if (end < firstVisible || ch.globalPosition > lastVisible) continue;
    const bk = BOOKS[ch.bookId];
    const x0 = x(ch.globalPosition), x1 = x(end);
    const value = p.bars === 'refs' && p.chapterRefs ? p.chapterRefs[ch.id] / maxRefs : ch.verseCount / MAX_VERSES;
    const h = Math.max(1, value * barMax);
    const isFirst = bk.id === 0 || bk.firstVerse === NT_START;
    ctx.fillStyle = isFirst ? colors.hi : bk.id % 2 === 0 ? colors.a : colors.b;
    ctx.globalAlpha = isFirst ? 0.95 : 0.8;
    ctx.fillRect(x0, base + 3, Math.max(0.6, x1 - x0 - gap), h);
  }
  ctx.globalAlpha = 1;

  // Axis line.
  ctx.fillStyle = colors.fg;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, base, W, 1);
  ctx.globalAlpha = 1;

  // Selection markers on the axis.
  for (const m of p.selection) {
    const x0 = x(m.start), x1 = Math.max(x(m.end + 1), x0 + 2);
    ctx.fillStyle = m.color ?? colors.accent;
    ctx.fillRect(x0, base - 1.5, x1 - x0, 3);
    ctx.beginPath();
    const cx = (x0 + x1) / 2;
    ctx.moveTo(cx, base + 1);
    ctx.lineTo(cx - 5, base + 8);
    ctx.lineTo(cx + 5, base + 8);
    ctx.closePath();
    ctx.fill();
  }

  // Testament divider.
  const xnt = x(NT_START);
  if (xnt > 0 && xnt < W) {
    ctx.fillStyle = colors.muted;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(xnt, base - 6, 1, barMax + 12);
    ctx.globalAlpha = 1;
  }

  if (!p.showLabels) return;
  const fontPx = p.compact ? 10 : 11;
  ctx.font = `500 ${fontPx}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  const labelY = base + barMax + 8;
  const chapterRow = pxPerVerse * 12 > 22;

  // Book labels (centred on the visible part of the book; skipped when they do not fit).
  let lastRight = -Infinity;
  for (const bk of BOOKS) {
    const bx0 = x(bk.firstVerse), bx1 = x(bk.firstVerse + bk.verseCount);
    if (bx1 < 0 || bx0 > W) continue;
    const vis0 = Math.max(0, bx0), vis1 = Math.min(W, bx1);
    const full = bk.name[p.lang];
    const short = bk.short[p.lang];
    let label = full;
    let w = ctx.measureText(label).width;
    if (w > vis1 - vis0 - 4) {
      label = short;
      w = ctx.measureText(label).width;
    }
    if (w > vis1 - vis0 - 2 && !(vis1 - vis0 > 6 && w < 40 && bx1 - bx0 > 2 && !chapterRow)) continue;
    let cx = (vis0 + vis1) / 2;
    cx = Math.min(Math.max(cx, w / 2 + 2), W - w / 2 - 2);
    if (cx - w / 2 < lastRight + 3) continue;
    ctx.fillStyle = bk.id === 0 || bk.firstVerse === NT_START ? colors.fg : colors.muted;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, chapterRow ? labelY + fontPx + 3 : labelY);
    lastRight = cx + w / 2;
  }

  // Chapter numbers when there is room.
  if (chapterRow) {
    ctx.fillStyle = colors.fg;
    ctx.textAlign = 'center';
    let last = -Infinity;
    for (const ch of CHAPTERS) {
      const end = ch.globalPosition + ch.verseCount;
      if (end < firstVisible || ch.globalPosition > lastVisible) continue;
      const x0 = x(ch.globalPosition), x1 = x(end);
      const label = String(ch.number);
      const w = ctx.measureText(label).width;
      const cx = Math.min(Math.max((Math.max(0, x0) + Math.min(W, x1)) / 2, w / 2), W - w / 2);
      if (x1 - x0 < w + 6 || cx - w / 2 < last + 4) continue;
      ctx.globalAlpha = 0.85;
      ctx.fillText(label, cx, labelY);
      last = cx + w / 2;
    }
    ctx.globalAlpha = 1;
  }

  // Verse ticks and numbers at high zoom.
  if (pxPerVerse > 5) {
    ctx.fillStyle = colors.fg;
    ctx.textAlign = 'center';
    for (let g = firstVisible; g <= lastVisible; g++) {
      const gx = x(g);
      ctx.globalAlpha = VERSE_NUMBER[g] === 1 ? 0.9 : 0.35;
      ctx.fillRect(gx, base - 3, 1, VERSE_NUMBER[g] === 1 ? 8 : 4);
      if (pxPerVerse > 16) {
        ctx.globalAlpha = 0.7;
        ctx.font = `${fontPx - 1}px "Inter Variable", Inter, system-ui, sans-serif`;
        ctx.fillText(String(VERSE_NUMBER[g]), gx + pxPerVerse / 2, base - 16);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Hovered verse marker.
  if (p.hoverVerse != null) {
    const hx = x(p.hoverVerse + 0.5);
    ctx.fillStyle = colors.fg;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(hx - 0.5, base - 10, 1, barMax + 14);
    ctx.globalAlpha = 1;
  }
}
