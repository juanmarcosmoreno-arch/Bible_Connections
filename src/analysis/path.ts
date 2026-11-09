/**
 * Shortest chains of cross-references between two passages.
 *
 * Graph: one node per verse; each reference links every verse of its source range with
 * every verse of its target range (ranges are short, so this stays small), in both
 * directions. Breadth-first search finds a chain with the fewest references; adjacency lists
 * are in table order, so among equally short chains the more attested references are used.
 */
import { TOTAL_VERSES } from '../data/bibleStructure.ts';
import type { ReferenceColumns } from '../data/format.ts';

export interface VerseGraph {
  offsets: Int32Array;
  neighbors: Int32Array;
  refs: Int32Array; // reference index of each adjacency entry
}

export function buildVerseGraph(cols: ReferenceColumns, indices: ArrayLike<number> | null = null): VerseGraph {
  const n = TOTAL_VERSES;
  const deg = new Int32Array(n + 1);
  const count = indices ? indices.length : cols.count;
  const each = (fn: (a: number, b: number, i: number) => void) => {
    for (let k = 0; k < count; k++) {
      const i = indices ? indices[k] : k;
      for (let s = cols.sourceStart[i]; s <= cols.sourceEnd[i]; s++)
        for (let t = cols.targetStart[i]; t <= cols.targetEnd[i]; t++) if (s !== t) fn(s, t, i);
    }
  };
  each((a, b) => {
    deg[a + 1]++;
    deg[b + 1]++;
  });
  for (let v = 0; v < n; v++) deg[v + 1] += deg[v];
  const offsets = deg;
  const fill = offsets.slice(0, n);
  const neighbors = new Int32Array(offsets[n]);
  const refs = new Int32Array(offsets[n]);
  each((a, b, i) => {
    neighbors[fill[a]] = b;
    refs[fill[a]++] = i;
    neighbors[fill[b]] = a;
    refs[fill[b]++] = i;
  });
  return { offsets, neighbors, refs };
}

export interface ChainPath {
  verses: number[]; // verses[0] in the start passage … last in the end passage
  refs: number[]; // refs[k] links verses[k] and verses[k+1]
}

/** Shortest chain from any verse of [a0, a1] to any verse of [b0, b1]; null if none within `maxSteps`. */
export function shortestChain(g: VerseGraph, a: [number, number], b: [number, number], banned: Set<number> = new Set(), maxSteps = 8): ChainPath | null {
  const n = g.offsets.length - 1;
  const prev = new Int32Array(n).fill(-2);
  const via = new Int32Array(n).fill(-1);
  const depth = new Uint8Array(n);
  let frontier: number[] = [];
  for (let v = a[0]; v <= a[1]; v++) {
    prev[v] = -1;
    frontier.push(v);
  }
  const isTarget = (v: number) => v >= b[0] && v <= b[1];
  for (const v of frontier) if (isTarget(v)) return { verses: [v], refs: [] };
  for (let d = 1; d <= maxSteps && frontier.length; d++) {
    const next: number[] = [];
    for (const v of frontier) {
      for (let e = g.offsets[v]; e < g.offsets[v + 1]; e++) {
        const w = g.neighbors[e];
        if (prev[w] !== -2 || (banned.has(w) && !isTarget(w))) continue;
        prev[w] = v;
        via[w] = g.refs[e];
        depth[w] = d;
        if (isTarget(w)) {
          const verses = [w], refs: number[] = [];
          for (let x = w; prev[x] !== -1; x = prev[x]) {
            refs.unshift(via[x]);
            verses.unshift(prev[x]);
          }
          return { verses, refs };
        }
        next.push(w);
      }
    }
    frontier = next;
  }
  return null;
}

/** The shortest chain plus up to `alternatives` chains that avoid the intermediate verses of earlier ones. */
export function findChains(g: VerseGraph, a: [number, number], b: [number, number], alternatives = 2): ChainPath[] {
  const out: ChainPath[] = [];
  const banned = new Set<number>();
  for (let k = 0; k <= alternatives; k++) {
    const p = shortestChain(g, a, b, banned);
    if (!p) break;
    out.push(p);
    p.verses.slice(1, -1).forEach((v) => banned.add(v));
    if (p.verses.length <= 2) break; // a direct reference has no intermediate verses to avoid
  }
  return out;
}
