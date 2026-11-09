import type { NodeLevel } from '../analysis/aggregate.ts';

export interface NetworkNode {
  id: number;
  degree: number;
  weightedDegree: number;
  outStrength: number;
  inStrength: number;
  selfLoops: number;
  betweenness: number;
  pageRank: number;
  community: number;
  clustering: number;
}

export interface NetworkFile {
  level: NodeLevel;
  anchor: 'start';
  graph: {
    nodes: number;
    edges: number;
    directedEdges: number;
    totalWeight: number;
    density: number;
    modularity: number;
    communities: number;
    betweenness: { exact: boolean; sources: number };
  };
  nodes: NetworkNode[];
  /** Undirected display edges [a, b, weight], strongest first. */
  edges: [number, number, number][];
  /** When not null, only the strongest `perNode` edges of each node are listed (metrics use all edges). */
  edgesPruned: { perNode: number; total: number } | null;
}
