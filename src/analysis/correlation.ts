/**
 * Correlation between connection profiles ("which books does this passage connect with?").
 *
 * Profile of a node (book or chapter): for each of the 66 books, the number of references
 * between the node and that book, in either direction (ranges anchored at their first verse).
 * Correlation of A and B: Pearson's r between their profiles, leaving out the books of A and
 * of B themselves (otherwise the large number of references inside a book would dominate).
 * r = 1: same pattern of connections; r = 0: unrelated; r < 0: opposite patterns.
 */
import { BOOKS, CHAPTERS, VERSE_BOOK, VERSE_CHAPTER } from '../data/bibleStructure.ts';
import type { ReferenceColumns } from '../data/format.ts';
import type { NodeLevel } from './aggregate.ts';

const NB = 66;

export function connectionProfiles(cols: ReferenceColumns, level: NodeLevel, indices: ArrayLike<number> | null = null): Float64Array {
  const n = level === 'book' ? NB : CHAPTERS.length;
  const node = level === 'book' ? VERSE_BOOK : VERSE_CHAPTER;
  const prof = new Float64Array(n * NB);
  const count = indices ? indices.length : cols.count;
  for (let k = 0; k < count; k++) {
    const i = indices ? indices[k] : k;
    const s = cols.sourceStart[i], t = cols.targetStart[i];
    prof[node[s] * NB + VERSE_BOOK[t]]++;
    prof[node[t] * NB + VERSE_BOOK[s]]++;
  }
  return prof;
}

/** Book of each node. */
function bookOf(level: NodeLevel, n: number): Int32Array {
  return Int32Array.from({ length: n }, (_, i) => (level === 'book' ? i : CHAPTERS[i].bookId));
}

/** n × n Pearson correlations (Float32, symmetric, diagonal 1, NaN when a profile is constant). */
export function correlationMatrix(prof: Float64Array, level: NodeLevel): Float32Array {
  const n = prof.length / NB;
  const own = bookOf(level, n);
  const out = new Float32Array(n * n);
  // Precompute sums over all 66 books so that leaving out two books is O(1).
  const sum = new Float64Array(n), sum2 = new Float64Array(n);
  for (let a = 0; a < n; a++) for (let k = 0; k < NB; k++) {
    const v = prof[a * NB + k];
    sum[a] += v;
    sum2[a] += v * v;
  }
  for (let a = 0; a < n; a++) {
    out[a * n + a] = 1;
    const ba = own[a];
    for (let b = a + 1; b < n; b++) {
      const bb = own[b];
      let sab = 0;
      for (let k = 0; k < NB; k++) sab += prof[a * NB + k] * prof[b * NB + k];
      // Remove the excluded books (ba, and bb if different) from every sum.
      const ex = ba === bb ? [ba] : [ba, bb];
      let m = NB, sa = sum[a], sb = sum[b], saa = sum2[a], sbb = sum2[b];
      for (const k of ex) {
        const x = prof[a * NB + k], y = prof[b * NB + k];
        m--;
        sa -= x;
        sb -= y;
        saa -= x * x;
        sbb -= y * y;
        sab -= x * y;
      }
      const cov = sab - (sa * sb) / m;
      const va = saa - (sa * sa) / m, vb = sbb - (sb * sb) / m;
      const r = va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : NaN;
      out[a * n + b] = r;
      out[b * n + a] = r;
    }
  }
  return out;
}

export function nodeLabelBook(level: NodeLevel, i: number): number {
  return level === 'book' ? i : CHAPTERS[i].bookId;
}

export { BOOKS };
