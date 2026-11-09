/**
 * Dataset-wide statistics for the Insights view. Computed at build time from the full
 * table (scripts/generate-statistics.ts) with the default anchoring rule ('start').
 */
import { BOOKS, CHAPTERS, NT_START, TOTAL_CHAPTERS, TOTAL_VERSES, VERSE_BOOK, VERSE_CHAPTER, osisRange } from '../data/bibleStructure.ts';
import type { ReferenceColumns } from '../data/references.ts';
import { distanceClass } from './distance.ts';

export interface HistogramBin {
  label: string;
  from: number; // inclusive
  to: number; // exclusive (Infinity for the last bin)
  count: number;
}

export interface BookStat {
  id: number;
  out: number; // references whose source is in the book
  in: number; // references whose (anchored) target is in the book
  intra: number; // both ends in the book
  votes: number; // sum of positive votes of references touching the book (as source or target)
  versesConnected: number; // verses of the book with at least one connection
}

export interface Statistics {
  anchor: 'start';
  totals: {
    references: number;
    books: number;
    chapters: number;
    verses: number;
    versesWithConnections: number;
    versesAsSource: number;
    avgConnectionsPerVerse: number; // (out + in incidences) / all verses
    avgConnectionsPerConnectedVerse: number;
    rangeReferences: number;
    negativeVotes: number;
    zeroVotes: number;
  };
  testaments: { 'OT-OT': number; 'NT-NT': number; 'OT-NT': number; 'NT-OT': number };
  scope: { sameChapter: number; sameBook: number; otherBook: number };
  votes: { mean: number; median: number; p90: number; p99: number; min: number; max: number; histogram: HistogramBin[] };
  distance: { median: number; classes: { near: number; mid: number; far: number }; histogram: HistogramBin[] };
  books: BookStat[];
  topChapters: { chapter: number; count: number }[];
  topVerses: { verse: number; out: number; in: number; total: number }[];
  topReferences: { index: number; source: string; target: string; votes: number }[];
  matrix: { counts: number[]; votes: number[] }; // 66 x 66 row-major, rows = source book
  chapterTouch: number[]; // per chapter: references with an end in the chapter
}

const VOTE_BINS: [string, number, number][] = [
  ['< 0', -Infinity, 0],
  ['0', 0, 1],
  ['1', 1, 2],
  ['2–4', 2, 5],
  ['5–9', 5, 10],
  ['10–19', 10, 20],
  ['20–49', 20, 50],
  ['50–99', 50, 100],
  ['100–199', 100, 200],
  ['200–499', 200, 500],
  ['≥ 500', 500, Infinity],
];

// Distance in verses, roughly logarithmic.
const DIST_BINS: [string, number, number][] = [
  ['0', 0, 1],
  ['1–9', 1, 10],
  ['10–99', 10, 100],
  ['100–999', 100, 1000],
  ['1k–5k', 1000, 5000],
  ['5k–10k', 5000, 10000],
  ['10k–20k', 10000, 20000],
  ['≥ 20k', 20000, Infinity],
];

function histogram(values: ArrayLike<number>, bins: [string, number, number][]): HistogramBin[] {
  const out = bins.map(([label, from, to]) => ({ label, from, to, count: 0 }));
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const b = out.find((x) => v >= x.from && v < x.to);
    if (b) b.count++;
  }
  return out;
}

function quantile(sorted: ArrayLike<number>, p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

export function computeStatistics(cols: ReferenceColumns, top = 50): Statistics {
  const n = cols.count;
  const outV = new Int32Array(TOTAL_VERSES);
  const inDiff = new Int32Array(TOTAL_VERSES + 1);
  const testaments = { 'OT-OT': 0, 'NT-NT': 0, 'OT-NT': 0, 'NT-OT': 0 };
  const scope = { sameChapter: 0, sameBook: 0, otherBook: 0 };
  const books: BookStat[] = BOOKS.map((b) => ({ id: b.id, out: 0, in: 0, intra: 0, votes: 0, versesConnected: 0 }));
  const counts = new Array(66 * 66).fill(0);
  const mvotes = new Array(66 * 66).fill(0);
  const chapterTouch = new Array(TOTAL_CHAPTERS).fill(0);
  const dist = new Float64Array(n);
  const classes = { near: 0, mid: 0, far: 0 };
  let ranges = 0, neg = 0, zero = 0, sumVotes = 0;

  for (let i = 0; i < n; i++) {
    const s = cols.sourceStart[i];
    const t = cols.targetStart[i];
    const v = cols.votes[i];
    sumVotes += v;
    if (v < 0) neg++;
    else if (v === 0) zero++;
    if (cols.targetEnd[i] !== t || cols.sourceEnd[i] !== s) ranges++;
    for (let x = s; x <= cols.sourceEnd[i]; x++) outV[x]++;
    inDiff[t]++;
    inDiff[cols.targetEnd[i] + 1]--;
    const sn = s >= NT_START, tn = t >= NT_START;
    testaments[sn ? (tn ? 'NT-NT' : 'NT-OT') : tn ? 'OT-NT' : 'OT-OT']++;
    const sb = VERSE_BOOK[s], tb = VERSE_BOOK[t];
    const sc = VERSE_CHAPTER[s], tc = VERSE_CHAPTER[t];
    if (sc === tc) scope.sameChapter++;
    else if (sb === tb) scope.sameBook++;
    else scope.otherBook++;
    books[sb].out++;
    books[tb].in++;
    if (sb === tb) books[sb].intra++;
    const pv = Math.max(0, v);
    books[sb].votes += pv;
    if (tb !== sb) books[tb].votes += pv;
    counts[sb * 66 + tb]++;
    mvotes[sb * 66 + tb] += pv;
    chapterTouch[sc]++;
    if (tc !== sc) chapterTouch[tc]++;
    const d = Math.abs(t - s);
    dist[i] = d;
    classes[distanceClass(d / TOTAL_VERSES)]++;
  }

  const inV = new Int32Array(TOTAL_VERSES);
  let acc = 0;
  let connected = 0, asSource = 0, incidences = 0;
  for (let g = 0; g < TOTAL_VERSES; g++) {
    acc += inDiff[g];
    inV[g] = acc;
    const total = outV[g] + inV[g];
    incidences += total;
    if (outV[g]) asSource++;
    if (total) {
      connected++;
      books[VERSE_BOOK[g]].versesConnected++;
    }
  }

  const sortedVotes = Int16Array.from(cols.votes).sort();
  const sortedDist = Float64Array.from(dist).sort();

  const verseOrder = Array.from({ length: TOTAL_VERSES }, (_, g) => g).sort(
    (a, b) => outV[b] + inV[b] - (outV[a] + inV[a]) || a - b,
  );
  const chapterOrder = CHAPTERS.map((c) => c.id).sort((a, b) => chapterTouch[b] - chapterTouch[a] || a - b);

  return {
    anchor: 'start',
    totals: {
      references: n,
      books: BOOKS.length,
      chapters: TOTAL_CHAPTERS,
      verses: TOTAL_VERSES,
      versesWithConnections: connected,
      versesAsSource: asSource,
      avgConnectionsPerVerse: incidences / TOTAL_VERSES,
      avgConnectionsPerConnectedVerse: connected ? incidences / connected : 0,
      rangeReferences: ranges,
      negativeVotes: neg,
      zeroVotes: zero,
    },
    testaments,
    scope,
    votes: {
      mean: sumVotes / n,
      median: quantile(sortedVotes, 0.5),
      p90: quantile(sortedVotes, 0.9),
      p99: quantile(sortedVotes, 0.99),
      min: sortedVotes[0],
      max: sortedVotes[n - 1],
      histogram: histogram(cols.votes, VOTE_BINS),
    },
    distance: { median: quantile(sortedDist, 0.5), classes, histogram: histogram(dist, DIST_BINS) },
    books,
    topChapters: chapterOrder.slice(0, top).map((c) => ({ chapter: c, count: chapterTouch[c] })),
    topVerses: verseOrder.slice(0, top).map((g) => ({ verse: g, out: outV[g], in: inV[g], total: outV[g] + inV[g] })),
    topReferences: Array.from({ length: Math.min(top, n) }, (_, i) => ({
      index: i,
      source: osisRange(cols.sourceStart[i], cols.sourceEnd[i]),
      target: osisRange(cols.targetStart[i], cols.targetEnd[i]),
      votes: cols.votes[i],
    })),
    matrix: { counts, votes: mvotes },
    chapterTouch,
  };
}
