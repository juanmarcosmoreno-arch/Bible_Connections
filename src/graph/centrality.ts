import { seededRandom, type UndirectedGraph } from './graph.ts';

/** Binary min-heap keyed by float priority. */
class MinHeap {
  keys: number[] = [];
  vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(key: number, val: number) {
    const k = this.keys, v = this.vals;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): [number, number] {
    const k = this.keys, v = this.vals;
    const topK = k[0], topV = v[0];
    const lastK = k.pop()!, lastV = v.pop()!;
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        let mk = lastK;
        if (l < n && k[l] < mk) { m = l; mk = k[l]; }
        if (r < n && k[r] < mk) { m = r; mk = k[r]; }
        if (m === i) break;
        k[i] = k[m];
        v[i] = v[m];
        i = m;
      }
      k[i] = lastK;
      v[i] = lastV;
    }
    return [topK, topV];
  }
}

export interface BetweennessOptions {
  /** Number of pivot sources for the approximation; undefined = exact (all sources). */
  samples?: number;
  seed?: number;
  /** Edge length from weight. Default: 1 / weight (stronger ties are shorter). */
  length?: (w: number) => number;
}

/**
 * Brandes betweenness centrality for undirected weighted graphs.
 * Exact when `samples` is omitted or >= n; otherwise Brandes–Pich pivot sampling
 * (deterministic seed), scaled by n / samples. Normalised to [0, 1] by (n-1)(n-2)/2.
 */
export function betweenness(g: UndirectedGraph, opts: BetweennessOptions = {}): { values: Float64Array; exact: boolean; sources: number } {
  const { n, offsets, neighbors, weights } = g;
  const len = opts.length ?? ((w: number) => 1 / w);
  let sources = Array.from({ length: n }, (_, i) => i);
  const exact = !opts.samples || opts.samples >= n;
  if (!exact) {
    const rnd = seededRandom(opts.seed ?? 42);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [sources[i], sources[j]] = [sources[j], sources[i]];
    }
    sources = sources.slice(0, opts.samples);
  }
  const cb = new Float64Array(n);
  const dist = new Float64Array(n);
  const sigma = new Float64Array(n);
  const delta = new Float64Array(n);
  const preds: number[][] = Array.from({ length: n }, () => []);
  const order: number[] = [];
  const EPS = 1e-12;
  for (const s of sources) {
    dist.fill(Infinity);
    sigma.fill(0);
    delta.fill(0);
    for (const p of preds) p.length = 0;
    order.length = 0;
    dist[s] = 0;
    sigma[s] = 1;
    const heap = new MinHeap();
    heap.push(0, s);
    const done = new Uint8Array(n);
    while (heap.size) {
      const [d, v] = heap.pop();
      if (done[v] || d > dist[v] + EPS) continue;
      done[v] = 1;
      order.push(v);
      for (let e = offsets[v]; e < offsets[v + 1]; e++) {
        const w = neighbors[e];
        const nd = d + len(weights[e]);
        if (nd < dist[w] - EPS) {
          dist[w] = nd;
          sigma[w] = sigma[v];
          preds[w].length = 0;
          preds[w].push(v);
          heap.push(nd, w);
        } else if (Math.abs(nd - dist[w]) <= EPS && !done[w]) {
          sigma[w] += sigma[v];
          preds[w].push(v);
        }
      }
    }
    for (let i = order.length - 1; i >= 0; i--) {
      const w = order[i];
      for (const v of preds[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) cb[w] += delta[w];
    }
  }
  const scale = (exact ? 1 : n / sources.length) / 2; // undirected: each pair counted twice
  const norm = n > 2 ? ((n - 1) * (n - 2)) / 2 : 1;
  for (let i = 0; i < n; i++) cb[i] = (cb[i] * scale) / norm;
  return { values: cb, exact, sources: sources.length };
}
