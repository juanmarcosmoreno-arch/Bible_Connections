import { useEffect, useState } from 'react';
import type { CorrLevel } from '../analysis/correlation.ts';
import { useData } from './useData.tsx';
import { OFFLINE, later } from '../data/offline.ts';
import { connectionProfiles, correlationMatrix } from '../analysis/correlation.ts';

let worker: Worker | null = null;
let seq = 0;

export interface CorrelationResult {
  level: CorrLevel;
  /** Node id of row 0 (first verse of the book for the verse level). */
  offset: number;
  n: number;
  matrix: Float32Array; // n × n Pearson r
  profiles: Float64Array; // n × 66 reference counts
  ms: number;
}

/** Correlation matrix of connection profiles, computed in a Web Worker. */
export function useCorrelation(level: CorrLevel, useFilters: boolean, range?: [number, number]): { result: CorrelationResult | null; computing: boolean } {
  const { cols, filtered } = useData();
  const [state, setState] = useState<{ key: string; result: CorrelationResult | null }>({ key: '', result: null });
  const key = `${level}:${range ? range.join('-') : ''}:${useFilters ? filtered?.length : 'all'}`;
  useEffect(() => {
    if (!cols) return;
    if (OFFLINE) {
      let alive = true;
      const t0 = performance.now();
      later(() => {
        const profiles = connectionProfiles(cols, level, useFilters ? filtered ?? null : null, range);
        return { profiles, matrix: correlationMatrix(profiles, level, range ? range[0] : 0) };
      }).then(({ profiles, matrix }) => {
        if (alive) setState({ key, result: { level, offset: range ? range[0] : 0, n: Math.round(Math.sqrt(matrix.length)), matrix, profiles, ms: performance.now() - t0 } });
      });
      return () => {
        alive = false;
      };
    }
    worker ??= new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
    const id = ++seq;
    let alive = true;
    const onMsg = (e: MessageEvent) => {
      if (e.data.id !== id || !alive || !e.data.matrix) return;
      const n = Math.round(Math.sqrt(e.data.matrix.length));
      setState({ key, result: { level, offset: range ? range[0] : 0, n, matrix: e.data.matrix, profiles: e.data.profiles, ms: e.data.ms } });
    };
    worker.addEventListener('message', onMsg);
    worker.postMessage({ id, task: 'correlation', level: level === 'verse' ? 'book' : level, corrLevel: level, range, cols, indices: useFilters ? filtered ?? null : null });
    return () => {
      alive = false;
      worker?.removeEventListener('message', onMsg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, key]);
  return { result: state.key === key ? state.result : null, computing: state.key !== key };
}
