/** Per-verse connection counts and visual vote weights. */
import { TOTAL_VERSES } from '../data/bibleStructure.ts';
import type { ReferenceColumns } from '../data/format.ts';

export interface VerseDegrees {
  out: Int32Array; // references whose source range contains the verse
  in: Int32Array; // references whose target range contains the verse
  total: Int32Array;
  /** Rank (1 = most connected) of each verse by total degree. */
  rank: Int32Array;
}

export function computeDegrees(cols: ReferenceColumns): VerseDegrees {
  const outD = new Int32Array(TOTAL_VERSES + 1);
  const inD = new Int32Array(TOTAL_VERSES + 1);
  for (let i = 0; i < cols.count; i++) {
    outD[cols.sourceStart[i]]++;
    outD[cols.sourceEnd[i] + 1]--;
    inD[cols.targetStart[i]]++;
    inD[cols.targetEnd[i] + 1]--;
  }
  const out = new Int32Array(TOTAL_VERSES), inn = new Int32Array(TOTAL_VERSES), total = new Int32Array(TOTAL_VERSES);
  let a = 0, b = 0;
  for (let g = 0; g < TOTAL_VERSES; g++) {
    a += outD[g];
    b += inD[g];
    out[g] = a;
    inn[g] = b;
    total[g] = a + b;
  }
  const order = Array.from({ length: TOTAL_VERSES }, (_, g) => g).sort((x, y) => total[y] - total[x] || x - y);
  const rank = new Int32Array(TOTAL_VERSES);
  order.forEach((g, i) => (rank[g] = i + 1));
  return { out, in: inn, total, rank };
}

/** Votes mapped to a 0..1 visual weight on a log scale (negative votes = 0). */
export function voteWeights(cols: ReferenceColumns): Float32Array {
  let max = 1;
  for (let i = 0; i < cols.count; i++) if (cols.votes[i] > max) max = cols.votes[i];
  const lmax = Math.log1p(max);
  const w = new Float32Array(cols.count);
  for (let i = 0; i < cols.count; i++) w[i] = Math.log1p(Math.max(0, cols.votes[i])) / lmax;
  return w;
}

