import type { UndirectedGraph } from './graph.ts';

export interface LouvainResult {
  communities: Int32Array; // community id per node, ids sorted by community size (0 = largest)
  modularity: number;
  levels: number;
}

interface Level {
  n: number;
  adj: Map<number, number>[]; // includes self-loops (weight counted once in adj[i].get(i))
}

/**
 * Louvain community detection (Blondel et al., 2008) with a deterministic node order.
 * Maximises weighted modularity; `resolution` = 1 gives the standard definition.
 */
export function louvain(g: UndirectedGraph, resolution = 1): LouvainResult {
  let level: Level = {
    n: g.n,
    adj: Array.from({ length: g.n }, (_, i) => {
      const m = new Map<number, number>();
      for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) m.set(g.neighbors[e], g.weights[e]);
      return m;
    }),
  };
  let membership = Int32Array.from({ length: g.n }, (_, i) => i);
  const m2 = 2 * g.totalWeight; // 2m
  if (m2 === 0) return { communities: new Int32Array(g.n), modularity: 0, levels: 0 };
  let levels = 0;

  for (;;) {
    const { n, adj } = level;
    // degree k_i (self-loops count twice)
    const k = new Float64Array(n);
    for (let i = 0; i < n; i++) for (const [j, w] of adj[i]) k[i] += i === j ? 2 * w : w;
    const comm = Int32Array.from({ length: n }, (_, i) => i);
    const tot = Float64Array.from(k);
    let improved = false;
    let moved = true;
    let passes = 0;
    while (moved && passes < 100) {
      moved = false;
      passes++;
      for (let i = 0; i < n; i++) {
        const ci = comm[i];
        const links = new Map<number, number>();
        for (const [j, w] of adj[i]) if (j !== i) links.set(comm[j], (links.get(comm[j]) ?? 0) + w);
        tot[ci] -= k[i];
        const gain = (c: number) => (links.get(c) ?? 0) - (resolution * tot[c] * k[i]) / m2;
        let best = ci;
        let bestGain = gain(ci);
        for (const c of [...links.keys()].sort((a, b) => a - b)) {
          const gc = gain(c);
          if (gc > bestGain + 1e-12) {
            bestGain = gc;
            best = c;
          }
        }
        tot[best] += k[i];
        if (best !== ci) {
          comm[i] = best;
          moved = true;
          improved = true;
        }
      }
    }
    if (!improved) break;
    levels++;
    // Renumber communities and aggregate.
    const ids = new Map<number, number>();
    for (let i = 0; i < n; i++) if (!ids.has(comm[i])) ids.set(comm[i], ids.size);
    membership = membership.map((c) => ids.get(comm[c])!);
    const nn = ids.size;
    const nadj: Map<number, number>[] = Array.from({ length: nn }, () => new Map());
    for (let i = 0; i < n; i++) {
      const a = ids.get(comm[i])!;
      for (const [j, w] of adj[i]) {
        const b = ids.get(comm[j])!;
        // Each undirected edge appears twice (i→j, j→i); self-loops appear once.
        const add = i === j ? w : w / 2;
        if (a === b) nadj[a].set(a, (nadj[a].get(a) ?? 0) + add);
        else {
          nadj[a].set(b, (nadj[a].get(b) ?? 0) + add);
          nadj[b].set(a, (nadj[b].get(a) ?? 0) + add);
        }
      }
    }
    level = { n: nn, adj: nadj };
    if (nn === n) break;
  }

  // Relabel by size (largest community = 0), ties broken by smallest member id.
  const sizes = new Map<number, { size: number; first: number }>();
  membership.forEach((c, i) => {
    const s = sizes.get(c);
    if (s) s.size++;
    else sizes.set(c, { size: 1, first: i });
  });
  const orderIds = [...sizes.entries()].sort((a, b) => b[1].size - a[1].size || a[1].first - b[1].first).map(([c]) => c);
  const relabel = new Map(orderIds.map((c, i) => [c, i]));
  const communities = membership.map((c) => relabel.get(c)!);
  return { communities, modularity: modularity(g, communities, resolution), levels };
}

/** Weighted modularity Q of a partition. */
export function modularity(g: UndirectedGraph, communities: ArrayLike<number>, resolution = 1): number {
  const m2 = 2 * g.totalWeight;
  if (!m2) return 0;
  const inW = new Map<number, number>();
  const tot = new Map<number, number>();
  for (let i = 0; i < g.n; i++) {
    const ci = communities[i];
    for (let e = g.offsets[i]; e < g.offsets[i + 1]; e++) {
      const w = g.weights[e];
      tot.set(ci, (tot.get(ci) ?? 0) + w);
      if (communities[g.neighbors[e]] === ci) inW.set(ci, (inW.get(ci) ?? 0) + w);
    }
  }
  let q = 0;
  for (const [c, t] of tot) q += (inW.get(c) ?? 0) / m2 - resolution * (t / m2) ** 2;
  return q;
}
