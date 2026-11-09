/**
 * Export builders (pure functions, unit-tested). Every export reflects the active filters and
 * keeps the original OpenBible identifiers, with attribution.
 */
import type { FilterState } from '../analysis/filters.ts';
import { BOOKS, NT_START, TOTAL_VERSES, VERSE_BOOK, osisRange } from '../data/bibleStructure.ts';
import type { DerivedReferences, ReferenceColumns } from '../data/references.ts';

export const ATTRIBUTION = 'Cross-reference data: OpenBible.info (https://www.openbible.info/labs/cross-references/), CC BY 4.0. Generated with Bible Connections.';

const CLASS = ['near', 'mid', 'far'] as const;

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function connectionsToCSV(cols: ReferenceColumns, derived: DerivedReferences, indices: ArrayLike<number>): string {
  const header = ['rank', 'source', 'target', 'votes', 'source_book', 'target_book', 'source_testament', 'target_testament', 'distance_verses', 'distance_class'];
  const lines = [header.join(',')];
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    const s = cols.sourceStart[i], t = cols.targetStart[i];
    lines.push(
      [
        k + 1,
        osisRange(s, cols.sourceEnd[i]),
        osisRange(t, cols.targetEnd[i]),
        cols.votes[i],
        BOOKS[VERSE_BOOK[s]].code,
        BOOKS[VERSE_BOOK[t]].code,
        s >= NT_START ? 'NT' : 'OT',
        t >= NT_START ? 'NT' : 'OT',
        Math.round(derived.distance[i] * TOTAL_VERSES),
        CLASS[derived.distClass[i]],
      ]
        .map(csvField)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export interface JsonExport {
  attribution: string;
  generatedAt: string;
  filters: FilterState;
  anchor: string;
  count: number;
  connections: { source: string; target: string; votes: number; distanceVerses: number; distanceClass: string }[];
}

export function connectionsToJSON(cols: ReferenceColumns, derived: DerivedReferences, indices: ArrayLike<number>, filters: FilterState, now = new Date()): JsonExport {
  const connections = [];
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    connections.push({
      source: osisRange(cols.sourceStart[i], cols.sourceEnd[i]),
      target: osisRange(cols.targetStart[i], cols.targetEnd[i]),
      votes: cols.votes[i],
      distanceVerses: Math.round(derived.distance[i] * TOTAL_VERSES),
      distanceClass: CLASS[derived.distClass[i]],
    });
  }
  return { attribution: ATTRIBUTION, generatedAt: now.toISOString(), filters, anchor: derived.anchor, count: connections.length, connections };
}

export interface FilteredStatistics {
  attribution: string;
  filters: FilterState;
  count: number;
  testaments: Record<'OT-OT' | 'OT-NT' | 'NT-OT' | 'NT-NT', number>;
  distanceClasses: Record<'near' | 'mid' | 'far', number>;
  votes: { min: number; max: number; mean: number; median: number };
  bySourceBook: Record<string, number>;
  byTargetBook: Record<string, number>;
}

export function filteredStatistics(cols: ReferenceColumns, derived: DerivedReferences, indices: ArrayLike<number>, filters: FilterState): FilteredStatistics {
  const testaments = { 'OT-OT': 0, 'OT-NT': 0, 'NT-OT': 0, 'NT-NT': 0 };
  const distanceClasses = { near: 0, mid: 0, far: 0 };
  const bySourceBook: Record<string, number> = {};
  const byTargetBook: Record<string, number> = {};
  const votes: number[] = [];
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    const s = cols.sourceStart[i], t = cols.targetStart[i];
    testaments[`${s >= NT_START ? 'NT' : 'OT'}-${t >= NT_START ? 'NT' : 'OT'}` as keyof typeof testaments]++;
    distanceClasses[CLASS[derived.distClass[i]]]++;
    const sb = BOOKS[VERSE_BOOK[s]].code, tb = BOOKS[VERSE_BOOK[t]].code;
    bySourceBook[sb] = (bySourceBook[sb] ?? 0) + 1;
    byTargetBook[tb] = (byTargetBook[tb] ?? 0) + 1;
    votes.push(cols.votes[i]);
  }
  votes.sort((a, b) => a - b);
  const n = votes.length;
  return {
    attribution: ATTRIBUTION,
    filters,
    count: n,
    testaments,
    distanceClasses,
    votes: { min: n ? votes[0] : 0, max: n ? votes[n - 1] : 0, mean: n ? votes.reduce((a, b) => a + b, 0) / n : 0, median: n ? votes[Math.floor((n - 1) / 2)] : 0 },
    bySourceBook,
    byTargetBook,
  };
}

/** SVG export is limited to keep files usable in editors and browsers. */
export const SVG_MAX_ARCS = 20000;

export interface SvgOptions {
  width: number;
  height: number;
  baseline: number;
  ratio: number;
  view: { x0: number; x1: number };
  background: string | null;
  colorOf: (t: number) => string;
  fg: string;
  labels: boolean;
  legend: boolean;
  lang: 'en' | 'es';
  /** Arcs to emphasise (drawn on top, full opacity). */
  highlight?: ArrayLike<number> | null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildArcSVG(derived: DerivedReferences, weight: Float32Array, indices: ArrayLike<number>, o: SvgOptions): string {
  if (indices.length > SVG_MAX_ARCS) throw new Error(`Too many arcs for SVG (${indices.length} > ${SVG_MAX_ARCS})`);
  const k = o.width / (o.view.x1 - o.view.x0);
  const px = (p: number) => (p - o.view.x0) * k;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}">`);
  out.push(`<title>Bible Connections</title><desc>${esc(ATTRIBUTION)}</desc>`);
  if (o.background) out.push(`<rect width="100%" height="100%" fill="${o.background}"/>`);
  const baseOpacity = Math.min(0.9, Math.max(0.06, 0.9 * Math.sqrt(400 / Math.max(1, indices.length))));
  const hl = o.highlight && o.highlight.length ? new Set(Array.from(o.highlight)) : null;
  const arc = (i: number, opacity: number, width: number) => {
    const a = px(derived.sourcePos[i]), b = px(derived.targetPos[i]);
    const x1 = Math.min(a, b), x2 = Math.max(a, b);
    const r = (x2 - x1) / 2;
    if (r < 0.2 || x2 < 0 || x1 > o.width) return '';
    return `<path d="M${x1.toFixed(2)} ${o.baseline}A${r.toFixed(2)} ${(r * o.ratio).toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${o.baseline}" stroke="${o.colorOf(derived.colorT[i])}" stroke-opacity="${opacity.toFixed(3)}" stroke-width="${width}"/>`;
  };
  out.push(`<g fill="none" stroke-linecap="round">`);
  for (let n = indices.length - 1; n >= 0; n--) {
    const i = indices[n];
    if (hl?.has(i)) continue;
    out.push(arc(i, (hl ? 0.25 : 1) * baseOpacity * (0.35 + 0.65 * weight[i]), 0.8));
  }
  if (hl) for (const i of hl) out.push(arc(i, 0.95, 1.4));
  out.push(`</g>`);
  out.push(`<line x1="0" y1="${o.baseline}" x2="${o.width}" y2="${o.baseline}" stroke="${o.fg}" stroke-opacity="0.4"/>`);
  if (o.labels) {
    out.push(`<g font-family="Inter, Helvetica, Arial, sans-serif" font-size="11" fill="${o.fg}" text-anchor="middle">`);
    let last = -Infinity;
    for (const bk of BOOKS) {
      const x0 = px(bk.firstVerse / TOTAL_VERSES), x1 = px((bk.firstVerse + bk.verseCount) / TOTAL_VERSES);
      if (x1 < 0 || x0 > o.width) continue;
      const label = bk.short[o.lang];
      const cx = (Math.max(0, x0) + Math.min(o.width, x1)) / 2;
      const w = label.length * 6;
      if (x1 - x0 < w * 0.6 || cx - w / 2 < last + 4) continue;
      out.push(`<text x="${cx.toFixed(1)}" y="${o.baseline + 18}" fill-opacity="0.75">${esc(label)}</text>`);
      last = cx + w / 2;
    }
    out.push(`</g>`);
  }
  if (o.legend) {
    const stops = Array.from({ length: 9 }, (_, i) => `<stop offset="${i / 8}" stop-color="${o.colorOf(i / 8)}"/>`).join('');
    out.push(`<defs><linearGradient id="lg">${stops}</linearGradient></defs>`);
    out.push(`<rect x="16" y="16" width="180" height="6" rx="3" fill="url(#lg)"/>`);
    out.push(`<g font-family="Inter, Helvetica, Arial, sans-serif" font-size="10" fill="${o.fg}" fill-opacity="0.7"><text x="16" y="36">${o.lang === 'es' ? 'cerca' : 'near'}</text><text x="196" y="36" text-anchor="end">${o.lang === 'es' ? 'lejos' : 'far'}</text></g>`);
  }
  out.push(`<text x="${o.width - 8}" y="${o.height - 6}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="9" fill="${o.fg}" fill-opacity="0.5" text-anchor="end">${esc(ATTRIBUTION)}</text>`);
  out.push(`</svg>`);
  return out.join('\n');
}
