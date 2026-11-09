import { useEffect, useRef, useState } from 'react';
import type { NodeLevel } from '../analysis/aggregate.ts';
import { loadNetwork } from '../data/loader.ts';
import type { NetworkFile } from '../graph/networkTypes.ts';
import { useData } from './useData.tsx';

let worker: Worker | null = null;
let seq = 0;

/**
 * Network data for a level. Uses the precomputed (exact, unfiltered) file, or recomputes in
 * a Web Worker for the currently filtered references when `useFilters` is true.
 */
export function useNetwork(level: NodeLevel, useFilters: boolean): { file: NetworkFile | null; computing: boolean; ms: number | null; error: string | null } {
  const { cols, filtered } = useData();
  const [state, setState] = useState<{ file: NetworkFile | null; computing: boolean; ms: number | null; error: string | null }>({ file: null, computing: true, ms: null, error: null });
  const reqId = useRef(0);

  useEffect(() => {
    let alive = true;
    if (!useFilters || !cols || !filtered) {
      setState((s) => ({ ...s, computing: true }));
      loadNetwork(level)
        .then((file) => alive && setState({ file, computing: false, ms: null, error: null }))
        .catch((e) => alive && setState({ file: null, computing: false, ms: null, error: String(e) }));
      return () => {
        alive = false;
      };
    }
    worker ??= new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
    const id = ++seq;
    reqId.current = id;
    setState((s) => ({ ...s, computing: true }));
    const onMsg = (e: MessageEvent) => {
      if (e.data.id !== reqId.current || !alive) return;
      if (e.data.error) setState({ file: null, computing: false, ms: null, error: e.data.error });
      else setState({ file: e.data.file, computing: false, ms: e.data.ms, error: null });
    };
    worker.addEventListener('message', onMsg);
    worker.postMessage({ id, level, cols, indices: filtered });
    return () => {
      alive = false;
      worker?.removeEventListener('message', onMsg);
    };
  }, [level, useFilters, cols, filtered]);
  return state;
}
