/**
 * Deterministic filtering of the cross-reference table.
 *
 * The table is sorted by (votes desc, source asc, target asc), so every filtered result
 * preserves that order and "Top N" is simply the first N matches — reproducible and
 * never a random sample.
 */
import type { DerivedReferences, ReferenceColumns } from '../data/references.ts';

export type TestamentFilter = 'all' | 'OT-OT' | 'NT-NT' | 'cross';
export type BookDirection = 'out' | 'in' | 'both';

export interface FilterState {
  testament: TestamentFilter;
  /** Selected books (ids). Empty = every book. */
  books: number[];
  /** Optional second book set: when non-empty, keep only connections between `books` and `targetBooks`. */
  targetBooks: number[];
  /** Whether the book constraint applies to the source, the target, or either end. */
  bookDirection: BookDirection;
  /** Minimum number of votes (inclusive). */
  minVotes: number;
  distance: { near: boolean; mid: boolean; far: boolean };
  /** Keep only the N most-voted matching connections (null = all). */
  top: number | null;
}

export const DEFAULT_FILTERS: FilterState = {
  testament: 'all',
  books: [],
  targetBooks: [],
  bookDirection: 'both',
  minVotes: -1000,
  distance: { near: true, mid: true, far: true },
  top: null,
};

export const DENSITY_OPTIONS: (number | null)[] = [1000, 10000, 50000, 100000, null];

export function isDefaultFilters(f: FilterState): boolean {
  return JSON.stringify(f) === JSON.stringify(DEFAULT_FILTERS);
}

/** Returns indices (ascending = votes order) of the references that pass every filter. */
export function applyFilters(cols: ReferenceColumns, d: DerivedReferences, f: FilterState): Uint32Array {
  const n = cols.count;
  const out = new Uint32Array(n);
  let k = 0;
  const bookSet = new Uint8Array(66);
  const targetSet = new Uint8Array(66);
  for (const b of f.books) bookSet[b] = 1;
  for (const b of f.targetBooks) targetSet[b] = 1;
  const hasBooks = f.books.length > 0;
  const hasPair = hasBooks && f.targetBooks.length > 0;
  const distOk = [f.distance.near, f.distance.mid, f.distance.far];
  const limit = f.top ?? Infinity;
  const votes = cols.votes;
  for (let i = 0; i < n && k < limit; i++) {
    if (votes[i] < f.minVotes) continue;
    if (!distOk[d.distClass[i]]) continue;
    const t = d.testaments[i];
    if (f.testament === 'OT-OT' && t !== 0) continue;
    if (f.testament === 'NT-NT' && t !== 3) continue;
    if (f.testament === 'cross' && (t === 0 || t === 3)) continue;
    if (hasBooks) {
      const sb = d.sourceBook[i];
      const tb = d.targetBook[i];
      const te = d.targetEndBook[i];
      if (hasPair) {
        const fwd = bookSet[sb] === 1 && (targetSet[tb] === 1 || targetSet[te] === 1);
        const rev = f.bookDirection === 'both' && targetSet[sb] === 1 && (bookSet[tb] === 1 || bookSet[te] === 1);
        if (!fwd && !rev) continue;
      } else {
        const srcIn = bookSet[sb] === 1;
        const tgtIn = bookSet[tb] === 1 || bookSet[te] === 1;
        if (f.bookDirection === 'out' && !srcIn) continue;
        if (f.bookDirection === 'in' && !tgtIn) continue;
        if (f.bookDirection === 'both' && !srcIn && !tgtIn) continue;
      }
    }
    out[k++] = i;
  }
  return out.slice(0, k);
}

/** Verse-interval selection: references touching [start, end] as source and/or target. */
export function referencesTouching(
  cols: ReferenceColumns,
  candidates: ArrayLike<number> | null,
  start: number,
  end: number,
  direction: BookDirection = 'both',
): Uint32Array {
  const n = candidates ? candidates.length : cols.count;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const i = candidates ? candidates[k] : k;
    const asSource = cols.sourceStart[i] <= end && cols.sourceEnd[i] >= start;
    const asTarget = cols.targetStart[i] <= end && cols.targetEnd[i] >= start;
    if (direction === 'out' ? asSource : direction === 'in' ? asTarget : asSource || asTarget) out.push(i);
  }
  return Uint32Array.from(out);
}
