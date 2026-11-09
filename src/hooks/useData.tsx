/**
 * Global data context: the decoded reference table, anchor-dependent derived arrays,
 * the filtered index list and per-verse degrees.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { computeDegrees, voteWeights, type VerseDegrees } from '../analysis/degrees.ts';
import { applyFilters } from '../analysis/filters.ts';
import { CHAPTERS, VERSE_CHAPTER } from '../data/bibleStructure.ts';
import type { ReferenceColumns } from '../data/format.ts';
import { loadReferences } from '../data/loader.ts';
import { deriveReferences, type DerivedReferences } from '../data/references.ts';
import { useApp } from '../state/appState.ts';

export type { VerseDegrees };

export interface DataState {
  status: 'loading' | 'ready' | 'error';
  progress: number;
  error?: string;
  cols?: ReferenceColumns;
  derived?: DerivedReferences;
  /** Votes mapped to a 0..1 visual weight (log scale). */
  weight?: Float32Array;
  filtered?: Uint32Array;
  /** 1 when the reference passes the current filters. */
  filteredMask?: Uint8Array;
  degrees?: VerseDegrees;
  /** References with at least one end in each chapter (whole dataset). */
  chapterRefs?: number[];
  loadMs?: number;
}

const DataContext = createContext<DataState>({ status: 'loading', progress: 0 });

export function DataProvider({ children }: { children: ReactNode }) {
  const [base, setBase] = useState<{ status: DataState['status']; progress: number; error?: string; cols?: ReferenceColumns; loadMs?: number }>({
    status: 'loading',
    progress: 0,
  });
  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    loadReferences((progress) => alive && setBase((s) => ({ ...s, progress })))
      .then((cols) => alive && setBase({ status: 'ready', progress: 1, cols, loadMs: performance.now() - t0 }))
      .catch((err) => alive && setBase({ status: 'error', progress: 0, error: String(err?.message ?? err) }));
    return () => {
      alive = false;
    };
  }, []);

  const anchor = useApp((s) => s.settings.anchor);
  const filters = useApp((s) => s.filters);
  const cols = base.cols;
  const derived = useMemo(() => (cols ? deriveReferences(cols, anchor) : undefined), [cols, anchor]);
  const weight = useMemo(() => (cols ? voteWeights(cols) : undefined), [cols]);
  const degrees = useMemo(() => (cols ? computeDegrees(cols) : undefined), [cols]);
  const filtered = useMemo(() => (cols && derived ? applyFilters(cols, derived, filters) : undefined), [cols, derived, filters]);

  const chapterRefs = useMemo(() => {
    if (!cols) return undefined;
    const c = new Array(CHAPTERS.length).fill(0);
    for (let i = 0; i < cols.count; i++) {
      const a = VERSE_CHAPTER[cols.sourceStart[i]], b = VERSE_CHAPTER[cols.targetStart[i]];
      c[a]++;
      if (b !== a) c[b]++;
    }
    return c;
  }, [cols]);

  const filteredMask = useMemo(() => {
    if (!cols || !filtered) return undefined;
    const m = new Uint8Array(cols.count);
    for (let k = 0; k < filtered.length; k++) m[filtered[k]] = 1;
    return m;
  }, [cols, filtered]);

  const value = useMemo<DataState>(
    () => ({ ...base, derived, weight, filtered, filteredMask, degrees, chapterRefs }),
    [base, derived, weight, filtered, filteredMask, degrees, chapterRefs],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  return useContext(DataContext);
}
