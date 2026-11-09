/**
 * Hash-based URL state (works on GitHub Pages without server rewrites):
 *   #/arc?sel=v:John.3.16&t=cross&b=Isa&dir=out&mv=10&d=nm&top=10000
 * Selection codes: v (verse), r (range), c (chapter), b (book), t (testament), x (reference "src>tgt").
 */
import { DEFAULT_FILTERS, type FilterState } from '../analysis/filters.ts';
import { BOOKS, CHAPTERS, VERSE_CHAPTER, bookByCode, osisId, osisRange, parseOsisVerse, testamentSpan } from '../data/bibleStructure.ts';
import { parseSpan } from '../data/parser.ts';
import type { ReferenceColumns } from '../data/format.ts';
import type { Route, Selection } from './appState.ts';

const ROUTES: Route[] = ['arc', 'explore', 'network', 'insights'];

export interface UrlState {
  route: Route;
  selection: Selection | null | undefined; // undefined: unresolved reference (data not loaded yet)
  pendingReference?: string;
  filters: FilterState;
}

export function encodeSelection(sel: Selection | null, cols?: ReferenceColumns): string | null {
  if (!sel) return null;
  if (sel.kind === 'reference') {
    if (!cols) return null;
    const i = sel.index;
    return `x:${osisRange(cols.sourceStart[i], cols.sourceEnd[i])}~${osisRange(cols.targetStart[i], cols.targetEnd[i])}`;
  }
  switch (sel.unit) {
    case 'verse':
      return `v:${osisId(sel.start)}`;
    case 'range':
      return `r:${osisRange(sel.start, sel.end)}`;
    case 'chapter': {
      const c = CHAPTERS[VERSE_CHAPTER[sel.start]];
      return `c:${BOOKS[c.bookId].code}.${c.number}`;
    }
    case 'book':
      return `b:${BOOKS[CHAPTERS[VERSE_CHAPTER[sel.start]].bookId].code}`;
    case 'testament':
      return `t:${sel.start === 0 ? 'OT' : 'NT'}`;
  }
}

export function decodeSelection(code: string | null): { selection: Selection | null; pendingReference?: string } {
  if (!code) return { selection: null };
  const [kind, value] = [code.slice(0, 1), code.slice(2)];
  if (kind === 'v') {
    const g = parseOsisVerse(value);
    return { selection: g >= 0 ? { kind: 'passage', unit: 'verse', start: g, end: g } : null };
  }
  if (kind === 'r') {
    const r = parseSpan(value);
    return { selection: r.ok ? { kind: 'passage', unit: 'range', start: r.span.start, end: r.span.end } : null };
  }
  if (kind === 'c') {
    const [code2, ch] = value.split('.');
    const b = bookByCode(code2);
    const c = b && Number(ch) >= 1 && Number(ch) <= b.chapterCount ? CHAPTERS[b.firstChapter + Number(ch) - 1] : null;
    return { selection: c ? { kind: 'passage', unit: 'chapter', start: c.globalPosition, end: c.globalPosition + c.verseCount - 1 } : null };
  }
  if (kind === 'b') {
    const b = bookByCode(value);
    return { selection: b ? { kind: 'passage', unit: 'book', start: b.firstVerse, end: b.firstVerse + b.verseCount - 1 } : null };
  }
  if (kind === 't' && (value === 'OT' || value === 'NT')) {
    const [s, e] = testamentSpan(value);
    return { selection: { kind: 'passage', unit: 'testament', start: s, end: e } };
  }
  if (kind === 'x') return { selection: null, pendingReference: value };
  return { selection: null };
}

/** Finds the reference index for "src>tgt" (OpenBible notation). */
export function resolveReference(code: string, cols: ReferenceColumns): number {
  const [a, b] = code.split(/[~>]/);
  const s = parseSpan(a ?? ''), t = parseSpan(b ?? '');
  if (!s.ok || !t.ok) return -1;
  for (let i = 0; i < cols.count; i++) {
    if (cols.sourceStart[i] === s.span.start && cols.sourceEnd[i] === s.span.end && cols.targetStart[i] === t.span.start && cols.targetEnd[i] === t.span.end) return i;
  }
  return -1;
}

const codes = (ids: number[]) => ids.map((i) => BOOKS[i].code).join(',');
const ids = (s: string | null) => (s ? s.split(',').map((c) => bookByCode(c)?.id).filter((x): x is number => x !== undefined) : []);

export function encodeFilters(f: FilterState, p: URLSearchParams) {
  const d = DEFAULT_FILTERS;
  if (f.testament !== d.testament) p.set('t', f.testament);
  if (f.books.length) p.set('b', codes(f.books));
  if (f.targetBooks.length) p.set('tb', codes(f.targetBooks));
  if (f.bookDirection !== d.bookDirection) p.set('dir', f.bookDirection);
  if (f.minVotes !== d.minVotes) p.set('mv', String(f.minVotes));
  const dist = `${f.distance.near ? 'n' : ''}${f.distance.mid ? 'm' : ''}${f.distance.far ? 'f' : ''}`;
  if (dist !== 'nmf') p.set('d', dist || '-');
  if (f.top != null) p.set('top', String(f.top));
}

export function decodeFilters(p: URLSearchParams): FilterState {
  const t = p.get('t');
  const dir = p.get('dir');
  const d = p.get('d');
  const mv = Number(p.get('mv'));
  const top = Number(p.get('top'));
  return {
    testament: t === 'OT-OT' || t === 'NT-NT' || t === 'cross' ? t : 'all',
    books: ids(p.get('b')),
    targetBooks: ids(p.get('tb')),
    bookDirection: dir === 'out' || dir === 'in' ? dir : 'both',
    minVotes: p.has('mv') && Number.isFinite(mv) ? mv : DEFAULT_FILTERS.minVotes,
    distance: d ? { near: d.includes('n'), mid: d.includes('m'), far: d.includes('f') } : { near: true, mid: true, far: true },
    top: p.has('top') && top > 0 ? top : null,
  };
}

export function buildHash(route: Route, sel: Selection | null, filters: FilterState, cols?: ReferenceColumns): string {
  const p = new URLSearchParams();
  const s = encodeSelection(sel, cols);
  if (s) p.set('sel', s);
  encodeFilters(filters, p);
  const q = p.toString();
  return `#/${route}${q ? `?${q.replace(/%3A/gi, ':').replace(/%2C/gi, ',').replace(/%3E/gi, '>')}` : ''}`;
}

export function parseHash(hash: string): UrlState {
  const h = hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const route = (ROUTES as string[]).includes(path) ? (path as Route) : 'arc';
  const p = new URLSearchParams(query);
  const { selection, pendingReference } = decodeSelection(p.get('sel'));
  return { route, selection: pendingReference ? undefined : selection, pendingReference, filters: decodeFilters(p) };
}
