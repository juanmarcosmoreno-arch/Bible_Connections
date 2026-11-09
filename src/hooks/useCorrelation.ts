import { useEffect, useState } from 'react';
import type { NodeLevel } from '../analysis/aggregate.ts';
import { useData } from './useData.tsx';

let worker: Worker | null = null;
let seq = 0;

export interface CorrelationResult {
  level: NodeLevel;
  n: number;
  matrix: Float32Array; // n × n Pearson r
  profiles: Float64Array; // n × 66 reference counts
  ms: number;
}

/** Correlation matrix of connection profiles, computed in a Web Worker. */
export function useCorrelation(level: NodeLevel, useFilters: boolean): { result: CorrelationResult | null; computing: boolean } {
  const { cols, filtered } = useData();
  const [state, setState] = useState<{ key: string; result: CorrelationResult | null }>({ key: '', result: null });
  const key = `${level}:${useFilters ? filtered?.length : 'all'}`;
  useEffect(() => {
    if (!cols) return;
    worker ??= new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
    const id = ++seq;
    let alive = true;
    const onMsg = (e: MessageEvent) => {
      if (e.data.id !== id || !alive || !e.data.matrix) return;
      const n = Math.round(Math.sqrt(e.data.matrix.length));
      setState({ key, result: { level, n, matrix: e.data.matrix, profiles: e.data.profiles, ms: e.data.ms } });
    };
    worker.addEventListener('message', onMsg);
    worker.postMessage({ id, task: 'correlation', level, cols, indices: useFilters ? filtered ?? null : null });
    return () => {
      alive = false;
      worker?.removeEventListener('message', onMsg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, key]);
  return { result: state.key === key ? state.result : null, computing: state.key !== key };
}
