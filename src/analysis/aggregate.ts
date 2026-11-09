/**
 * Aggregation of verse-level references into book- or chapter-level edges.
 * Each reference contributes one directed edge from the node of its source to the node of
 * its anchored target verse (default anchor: first verse of the range). Ranges are never
 * expanded into several edges.
 */
import { CHAPTERS, TOTAL_CHAPTERS, VERSE_BOOK, VERSE_CHAPTER } from '../data/bibleStructure.ts';
import type { ReferenceColumns } from '../data/references.ts';
import type { Edge } from '../graph/graph.ts';

export type NodeLevel = 'book' | 'chapter';

export function nodeCount(level: NodeLevel): number {
  return level === 'book' ? 66 : TOTAL_CHAPTERS;
}

export function nodeOfVerse(level: NodeLevel, verse: number): number {
  return level === 'book' ? VERSE_BOOK[verse] : VERSE_CHAPTER[verse];
}

export function nodeBook(level: NodeLevel, node: number): number {
  return level === 'book' ? node : CHAPTERS[node].bookId;
}

export interface AggregatedEdges {
  edges: Edge[]; // directed, merged, without self-loops
  selfLoops: Float64Array; // references whose both ends fall in the same node
}

/** Aggregates references (all, or only `indices`) into weighted directed edges. */
export function aggregateEdges(
  cols: ReferenceColumns,
  level: NodeLevel,
  indices: ArrayLike<number> | null = null,
  weightOf: (i: number) => number = () => 1,
): AggregatedEdges {
  const n = nodeCount(level);
  const map = new Map<number, number>();
  const selfLoops = new Float64Array(n);
  const count = indices ? indices.length : cols.count;
  for (let k = 0; k < count; k++) {
    const i = indices ? indices[k] : k;
    const w = weightOf(i);
    if (w <= 0) continue;
    const a = nodeOfVerse(level, cols.sourceStart[i]);
    const b = nodeOfVerse(level, cols.targetStart[i]);
    if (a === b) {
      selfLoops[a] += w;
      continue;
    }
    const key = a * n + b;
    map.set(key, (map.get(key) ?? 0) + w);
  }
  const edges: Edge[] = [];
  for (const [key, weight] of map) edges.push({ source: Math.floor(key / n), target: key % n, weight });
  edges.sort((x, y) => x.source - y.source || x.target - y.target);
  return { edges, selfLoops };
}
