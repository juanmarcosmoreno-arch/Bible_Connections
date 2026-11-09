/**
 * Builds a NetworkFile (metrics + display edges) from the reference table. Shared by the
 * build script (exact metrics) and the analysis worker (filtered, sampled betweenness).
 */
import { aggregateEdges, nodeCount, type NodeLevel } from '../analysis/aggregate.ts';
import type { ReferenceColumns } from '../data/format.ts';
import { computeNetworkMetrics } from './metrics.ts';
import type { NetworkFile } from './networkTypes.ts';

const round = (x: number, digits = 6) => (x === 0 ? 0 : Number(x.toPrecision(digits)));

export interface NetworkBuildOptions {
  edgesPerNode: number;
  indices?: ArrayLike<number> | null;
  betweennessSamples?: number;
}

export function buildNetworkFile(cols: ReferenceColumns, level: NodeLevel, opts: NetworkBuildOptions): NetworkFile {
  const agg = aggregateEdges(cols, level, opts.indices ?? null);
  const n = nodeCount(level);
  const metrics = computeNetworkMetrics(n, agg.edges, { betweennessSamples: opts.betweennessSamples });
  // Undirected display edges: merge both directions, keep the strongest `edgesPerNode` per node.
  const und = new Map<number, number>();
  for (const e of agg.edges) {
    const a = Math.min(e.source, e.target), b = Math.max(e.source, e.target);
    und.set(a * n + b, (und.get(a * n + b) ?? 0) + e.weight);
  }
  const all = [...und.entries()].map(([k, w]) => [Math.floor(k / n), k % n, w] as [number, number, number]);
  let display = all;
  if (opts.edgesPerNode < n) {
    const keep = new Set<number>();
    const byNode: [number, number][][] = Array.from({ length: n }, () => []);
    all.forEach((e, idx) => {
      byNode[e[0]].push([idx, e[2]]);
      byNode[e[1]].push([idx, e[2]]);
    });
    for (const list of byNode) list.sort((x, y) => y[1] - x[1]).slice(0, opts.edgesPerNode).forEach((x) => keep.add(x[0]));
    display = all.filter((_, idx) => keep.has(idx));
  }
  display.sort((x, y) => y[2] - x[2] || x[0] - y[0] || x[1] - y[1]);
  return {
    level,
    anchor: 'start',
    graph: { ...metrics.graph, density: round(metrics.graph.density), modularity: round(metrics.graph.modularity) },
    nodes: metrics.nodes.map((m, id) => ({
      id,
      degree: m.degree,
      weightedDegree: m.weightedDegree,
      outStrength: m.outStrength,
      inStrength: m.inStrength,
      selfLoops: agg.selfLoops[id],
      betweenness: round(m.betweenness),
      pageRank: round(m.pageRank),
      community: m.community,
      clustering: round(m.clustering),
    })),
    edges: display,
    edgesPruned: opts.edgesPerNode < n ? { perNode: opts.edgesPerNode, total: all.length } : null,
  };
}
