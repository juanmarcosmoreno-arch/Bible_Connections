/** Compact weighted graph structures used by the network metrics. */

export interface Edge {
  source: number;
  target: number;
  weight: number;
}

/** Undirected weighted graph in CSR form (self-loops removed, parallel edges merged). */
export interface UndirectedGraph {
  n: number;
  offsets: Int32Array; // length n+1
  neighbors: Int32Array;
  weights: Float64Array;
  totalWeight: number; // sum of edge weights (each undirected edge counted once)
}

export function buildUndirected(n: number, edges: readonly Edge[]): UndirectedGraph {
  const maps: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  let total = 0;
  for (const e of edges) {
    if (e.source === e.target || e.weight <= 0) continue;
    const a = e.source, b = e.target;
    maps[a].set(b, (maps[a].get(b) ?? 0) + e.weight);
    maps[b].set(a, (maps[b].get(a) ?? 0) + e.weight);
    total += e.weight;
  }
  const offsets = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) offsets[i + 1] = offsets[i] + maps[i].size;
  const neighbors = new Int32Array(offsets[n]);
  const weights = new Float64Array(offsets[n]);
  for (let i = 0; i < n; i++) {
    const sorted = [...maps[i].entries()].sort((x, y) => x[0] - y[0]);
    sorted.forEach(([j, w], k) => {
      neighbors[offsets[i] + k] = j;
      weights[offsets[i] + k] = w;
    });
  }
  return { n, offsets, neighbors, weights, totalWeight: total };
}

/** Merges parallel directed edges (a→b) and drops self-loops. */
export function mergeDirected(edges: readonly Edge[]): Edge[] {
  const m = new Map<string, Edge>();
  for (const e of edges) {
    if (e.source === e.target) continue;
    const k = `${e.source}>${e.target}`;
    const cur = m.get(k);
    if (cur) cur.weight += e.weight;
    else m.set(k, { ...e });
  }
  return [...m.values()];
}

/** Deterministic pseudo-random generator (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
