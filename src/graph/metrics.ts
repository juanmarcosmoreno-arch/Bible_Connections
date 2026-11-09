import { betweenness } from './centrality.ts';
import { louvain } from './communities.ts';
import { buildUndirected, mergeDirected, type Edge, type UndirectedGraph } from './graph.ts';
import { pageRank } from './pagerank.ts';

export interface NodeMetrics {
  degree: number; // distinct neighbours (undirected)
  weightedDegree: number; // strength: total weight of incident edges (in + out)
  outStrength: number;
  inStrength: number;
  betweenness: number; // normalised 0..1
  pageRank: number; // sums to 1 over the graph
  community: number;
  clustering: number; // weighted clustering coefficient (Onnela et al. 2005)
}

export interface NetworkMetrics {
  nodes: NodeMetrics[];
  graph: {
    nodes: number;
    edges: number; // undirected node pairs with at least one reference
    directedEdges: number;
    totalWeight: number;
    density: number;
    modularity: number;
    communities: number;
    betweenness: { exact: boolean; sources: number };
  };
}

/**
 * Weighted clustering coefficient (Onnela et al., 2005):
 *   c_i = 1 / (k_i (k_i - 1)) * Σ_{j,h} (ŵ_ij ŵ_ih ŵ_jh)^(1/3),  ŵ = w / max(w)
 * Uses a dense weight matrix, intended for graphs up to a few thousand nodes.
 */
export function weightedClustering(g: UndirectedGraph): Float64Array {
  const { n, offsets, neighbors, weights } = g;
  let maxW = 0;
  for (let e = 0; e < weights.length; e++) maxW = Math.max(maxW, weights[e]);
  const dense = new Float32Array(n * n);
  for (let i = 0; i < n; i++) for (let e = offsets[i]; e < offsets[i + 1]; e++) dense[i * n + neighbors[e]] = Math.cbrt(weights[e] / maxW);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = offsets[i + 1] - offsets[i];
    if (k < 2) continue;
    let s = 0;
    for (let a = offsets[i]; a < offsets[i + 1]; a++) {
      const j = neighbors[a];
      const wij = dense[i * n + j];
      for (let b = a + 1; b < offsets[i + 1]; b++) {
        const h = neighbors[b];
        const wjh = dense[j * n + h];
        if (wjh) s += wij * dense[i * n + h] * wjh;
      }
    }
    out[i] = (2 * s) / (k * (k - 1));
  }
  return out;
}

export interface MetricsOptions {
  betweennessSamples?: number; // undefined = exact
  seed?: number;
}

/** Computes every node and graph metric for a directed weighted edge list. */
export function computeNetworkMetrics(n: number, directed: readonly Edge[], opts: MetricsOptions = {}): NetworkMetrics {
  const merged = mergeDirected(directed);
  const und = buildUndirected(n, merged);
  const pr = pageRank(n, merged);
  const bc = betweenness(und, { samples: opts.betweennessSamples, seed: opts.seed });
  const comm = louvain(und);
  const cl = weightedClustering(und);
  const outS = new Float64Array(n), inS = new Float64Array(n);
  for (const e of merged) {
    outS[e.source] += e.weight;
    inS[e.target] += e.weight;
  }
  const nodes: NodeMetrics[] = Array.from({ length: n }, (_, i) => ({
    degree: und.offsets[i + 1] - und.offsets[i],
    weightedDegree: outS[i] + inS[i],
    outStrength: outS[i],
    inStrength: inS[i],
    betweenness: bc.values[i],
    pageRank: pr[i],
    community: comm.communities[i],
    clustering: cl[i],
  }));
  const edges = und.neighbors.length / 2;
  return {
    nodes,
    graph: {
      nodes: n,
      edges,
      directedEdges: merged.length,
      totalWeight: merged.reduce((a, e) => a + e.weight, 0),
      density: n > 1 ? edges / ((n * (n - 1)) / 2) : 0,
      modularity: comm.modularity,
      communities: new Set(comm.communities).size,
      betweenness: { exact: bc.exact, sources: bc.sources },
    },
  };
}
