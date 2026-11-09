/// <reference lib="webworker" />
/** Off-main-thread network metrics for filtered subsets (Network Explorer). */
import type { NodeLevel } from '../analysis/aggregate.ts';
import type { ReferenceColumns } from '../data/format.ts';
import { buildNetworkFile } from '../graph/networkFile.ts';
import { connectionProfiles, correlationMatrix } from '../analysis/correlation.ts';

export interface NetworkRequest {
  id: number;
  task?: 'network' | 'correlation';
  level: NodeLevel;
  cols: ReferenceColumns;
  indices: Uint32Array | null;
}

/** Betweenness pivots for chapter-level graphs computed in the browser (exact for books). */
export const CHAPTER_PIVOTS = 128;

self.onmessage = (e: MessageEvent<NetworkRequest>) => {
  const { id, level, cols, indices, task } = e.data;
  try {
    const t0 = performance.now();
    if (task === 'correlation') {
      const prof = connectionProfiles(cols, level, indices);
      const matrix = correlationMatrix(prof, level);
      self.postMessage({ id, matrix, profiles: prof, ms: performance.now() - t0 }, [matrix.buffer, prof.buffer]);
      return;
    }
    const file = buildNetworkFile(cols, level, {
      edgesPerNode: level === 'book' ? 66 : 8,
      indices,
      betweennessSamples: level === 'chapter' ? CHAPTER_PIVOTS : undefined,
    });
    self.postMessage({ id, file, ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
