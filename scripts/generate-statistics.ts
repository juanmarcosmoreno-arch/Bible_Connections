/**
 * Generates dataset statistics and precomputed network metrics (exact) for the Insights
 * and Network views.
 */
import { aggregateEdges, nodeCount, type NodeLevel } from '../src/analysis/aggregate.ts';
import { computeStatistics, type Statistics } from '../src/analysis/statistics.ts';
import type { ReferenceColumns } from '../src/data/references.ts';
import { computeNetworkMetrics } from '../src/graph/metrics.ts';
import type { NetworkFile } from '../src/graph/networkTypes.ts';
import { OUT_DIR, writeJson } from './lib/io.ts';

const round = (x: number, digits = 6) => (x === 0 ? 0 : Number(x.toPrecision(digits)));

export function buildNetworkFile(cols: ReferenceColumns, level: NodeLevel, edgesPerNode: number): NetworkFile {
  const agg = aggregateEdges(cols, level);
  const n = nodeCount(level);
  const metrics = computeNetworkMetrics(n, agg.edges);
  // Undirected display edges: merge both directions, keep the strongest `edgesPerNode` per node.
  const und = new Map<number, number>();
  for (const e of agg.edges) {
    const a = Math.min(e.source, e.target), b = Math.max(e.source, e.target);
    und.set(a * n + b, (und.get(a * n + b) ?? 0) + e.weight);
  }
  const all = [...und.entries()].map(([k, w]) => [Math.floor(k / n), k % n, w] as [number, number, number]);
  let display = all;
  if (edgesPerNode < n) {
    const keep = new Set<number>();
    const byNode: [number, number, number][][] = Array.from({ length: n }, () => []);
    all.forEach((e, idx) => {
      byNode[e[0]].push([idx, e[2], 0]);
      byNode[e[1]].push([idx, e[2], 0]);
    });
    for (const list of byNode) list.sort((x, y) => y[1] - x[1]).slice(0, edgesPerNode).forEach((x) => keep.add(x[0]));
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
    edgesPruned: edgesPerNode < n ? { perNode: edgesPerNode, total: all.length } : null,
  };
}

export function generateStatistics(cols: ReferenceColumns): { stats: Statistics; books: NetworkFile; chapters: NetworkFile } {
  const stats = computeStatistics(cols);
  const books = buildNetworkFile(cols, 'book', 66);
  const chapters = buildNetworkFile(cols, 'chapter', 8);
  writeJson(`${OUT_DIR}/statistics/statistics.json`, stats);
  writeJson(`${OUT_DIR}/statistics/network-books.json`, books);
  writeJson(`${OUT_DIR}/statistics/network-chapters.json`, chapters);
  return { stats, books, chapters };
}
