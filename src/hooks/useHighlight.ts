import { useMemo } from 'react';
import { referencesTouching } from '../analysis/filters.ts';
import { useApp } from '../state/appState.ts';
import { useData } from './useData.tsx';

/** Reference indices to highlight for the current selection (within the filtered set). */
export function useHighlight(): Uint32Array | null {
  const { cols, filtered } = useData();
  const selection = useApp((s) => s.selection);
  const direction = useApp((s) => s.selectionDirection);
  return useMemo(() => {
    if (!cols || !filtered || !selection) return null;
    if (selection.kind === 'reference') return Uint32Array.of(selection.index);
    return referencesTouching(cols, filtered, selection.start, selection.end, direction);
  }, [cols, filtered, selection, direction]);
}
