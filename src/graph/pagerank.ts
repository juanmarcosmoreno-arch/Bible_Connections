import type { Edge } from './graph.ts';

/**
 * Weighted PageRank on a directed graph (power iteration).
 * Dangling nodes redistribute their rank uniformly. Returns scores that sum to 1.
 */
export function pageRank(n: number, edges: readonly Edge[], damping = 0.85, tol = 1e-12, maxIter = 500): Float64Array {
  const outW = new Float64Array(n);
  for (const e of edges) outW[e.source] += e.weight;
  let rank = new Float64Array(n).fill(1 / n);
  let next = new Float64Array(n);
  for (let it = 0; it < maxIter; it++) {
    let dangling = 0;
    for (let i = 0; i < n; i++) if (outW[i] === 0) dangling += rank[i];
    next.fill((1 - damping) / n + (damping * dangling) / n);
    for (const e of edges) next[e.target] += (damping * rank[e.source] * e.weight) / outW[e.source];
    let diff = 0;
    for (let i = 0; i < n; i++) diff += Math.abs(next[i] - rank[i]);
    [rank, next] = [next, rank];
    if (diff < tol) break;
  }
  return rank;
}
