import { describe, expect, it } from 'vitest';
import { aggregateEdges } from '../../src/analysis/aggregate.ts';
import { betweenness } from '../../src/graph/centrality.ts';
import { louvain, modularity } from '../../src/graph/communities.ts';
import { buildUndirected, type Edge } from '../../src/graph/graph.ts';
import { computeNetworkMetrics, weightedClustering } from '../../src/graph/metrics.ts';
import { pageRank } from '../../src/graph/pagerank.ts';
import { loadColumns } from './helpers.ts';

const e = (source: number, target: number, weight = 1): Edge => ({ source, target, weight });

describe('PageRank', () => {
  it('is uniform on a directed cycle and sums to 1', () => {
    const pr = pageRank(4, [e(0, 1), e(1, 2), e(2, 3), e(3, 0)]);
    for (const v of pr) expect(v).toBeCloseTo(0.25, 9);
  });
  it('ranks the hub of a star highest', () => {
    const pr = pageRank(5, [e(1, 0), e(2, 0), e(3, 0), e(4, 0)]);
    expect(pr[0]).toBeGreaterThan(pr[1]);
    expect(pr.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
});

describe('betweenness', () => {
  it('is 1 for the centre of a 3-node path (normalised)', () => {
    const g = buildUndirected(3, [e(0, 1), e(1, 2)]);
    const { values } = betweenness(g);
    expect(values[1]).toBeCloseTo(1, 9);
    expect(values[0]).toBe(0);
  });
  it('uses weights as connection strength (length = 1/weight)', () => {
    // 0-1-2 strongly connected, 0-2 weak: the path through 1 is shorter.
    const g = buildUndirected(3, [e(0, 1, 10), e(1, 2, 10), e(0, 2, 1)]);
    expect(betweenness(g).values[1]).toBeCloseTo(1, 9);
  });
  it('pivot sampling approximates the exact values', () => {
    const edges: Edge[] = [];
    for (let i = 0; i < 40; i++) edges.push(e(i, (i + 1) % 40), e(i, (i + 7) % 40, 2));
    const g = buildUndirected(40, edges);
    const exact = betweenness(g).values;
    const approx = betweenness(g, { samples: 20, seed: 1 });
    expect(approx.exact).toBe(false);
    const mean = (a: Float64Array) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(Math.abs(mean(approx.values) - mean(exact)) / mean(exact)).toBeLessThan(0.25);
  });
});

describe('communities', () => {
  it('Louvain separates two cliques joined by a bridge', () => {
    const edges: Edge[] = [];
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) edges.push(e(a, b), e(a + 5, b + 5));
    edges.push(e(4, 5));
    const g = buildUndirected(10, edges);
    const r = louvain(g);
    expect(new Set(r.communities).size).toBe(2);
    expect(r.communities[0]).toBe(r.communities[4]);
    expect(r.communities[0]).not.toBe(r.communities[9]);
    expect(r.modularity).toBeGreaterThan(0.4);
    expect(modularity(g, new Int32Array(10))).toBeCloseTo(0, 9);
  });
});

describe('clustering', () => {
  it('is 1 in a triangle and 0 at the centre of a star', () => {
    expect(Array.from(weightedClustering(buildUndirected(3, [e(0, 1), e(1, 2), e(0, 2)])))).toEqual([1, 1, 1]);
    expect(weightedClustering(buildUndirected(4, [e(0, 1), e(0, 2), e(0, 3)]))[0]).toBe(0);
  });
});

describe('book network from the full dataset', () => {
  const cols = loadColumns();
  const agg = aggregateEdges(cols, 'book');
  it('aggregates every reference exactly once', () => {
    const total = agg.edges.reduce((a, x) => a + x.weight, 0) + agg.selfLoops.reduce((a, x) => a + x, 0);
    expect(total).toBe(cols.count);
  });
  it('computes metrics for all 66 books', () => {
    const m = computeNetworkMetrics(66, agg.edges);
    expect(m.nodes).toHaveLength(66);
    expect(m.graph.communities).toBeGreaterThan(1);
    expect(m.nodes.reduce((a, n) => a + n.pageRank, 0)).toBeCloseTo(1, 6);
  });
});
