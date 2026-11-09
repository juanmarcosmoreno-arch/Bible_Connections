/**
 * Correlation between connection profiles ("which books does this passage connect with?").
 *
 * Profile of a node (book or chapter): for each of the 66 books, the number of references
 * between the node and that book, in either direction (ranges anchored at their first verse).
 * Correlation of A and B: Pearson's r between their profiles, leaving out the books of A and
 * of B themselves (otherwise the large number of references inside a book would dominate).
 * r = 1: same pattern of connections; r = 0: unrelated; r < 0: opposite patterns.
 */
import { BOOKS, CHAPTERS, TOTAL_VERSES, VERSE_BOOK, VERSE_CHAPTER } from '../data/bibleStructure.ts';
import type { ReferenceColumns } from '../data/format.ts';

const NB = 66;

/** Book, chapter or verse level. Verse-level matrices are limited to a range (one book). */
export type CorrLevel = 'book' | 'chapter' | 'verse';

export function nodeCountFor(level: CorrLevel): number {
  return level === 'book' ? NB : level === 'chapter' ? CHAPTERS.length : TOTAL_VERSES;
}

/** Node (book, chapter or verse) of a verse index. */
export function nodeOf(level: CorrLevel, verse: number): number {
  return level === 'book' ? VERSE_BOOK[verse] : level === 'chapter' ? VERSE_CHAPTER[verse] : verse;
}

/** Book of a node. */
export function bookOfNode(level: CorrLevel, node: number): number {
  return level === 'book' ? node : level === 'chapter' ? CHAPTERS[node].bookId : VERSE_BOOK[node];
}

/**
 * Profiles of the nodes [start, end] (default: all nodes of the level): n × 66 counts.
 */
export function connectionProfiles(cols: ReferenceColumns, level: CorrLevel, indices: ArrayLike<number> | null = null, range?: [number, number]): Float64Array {
  const [lo, hi] = range ?? [0, nodeCountFor(level) - 1];
  const n = hi - lo + 1;
  const prof = new Float64Array(n * NB);
  const count = indices ? indices.length : cols.count;
  for (let k = 0; k < count; k++) {
    const i = indices ? indices[k] : k;
    const s = cols.sourceStart[i], t = cols.targetStart[i];
    const a = nodeOf(level, s) - lo, b = nodeOf(level, t) - lo;
    if (a >= 0 && a < n) prof[a * NB + VERSE_BOOK[t]]++;
    if (b >= 0 && b < n) prof[b * NB + VERSE_BOOK[s]]++;
  }
  return prof;
}

/**
 * m × m Pearson correlations of the profiles (Float32, symmetric, diagonal 1, NaN when a
 * profile is constant, e.g. a verse without connections). `offset` is the node id of row 0.
 */
export function correlationMatrix(prof: Float64Array, level: CorrLevel, offset = 0): Float32Array {
  const n = prof.length / NB;
  const own = Int32Array.from({ length: n }, (_, i) => bookOfNode(level, offset + i));
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

export { BOOKS };
