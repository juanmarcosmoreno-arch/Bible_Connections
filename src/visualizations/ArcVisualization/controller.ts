/**
 * Small command bus so that any component (search, panels, navigator) can ask the arc view
 * to zoom/pan, even if the view is not mounted yet (the request is kept until it mounts).
 */
import { TOTAL_VERSES } from '../../data/bibleStructure.ts';
import type { PassageUnit } from '../../state/appState.ts';
import { clampView } from './geometry.ts';
import type { ViewDomain } from './types.ts';

export interface ZoomRequest extends ViewDomain {
  duration?: number;
}

type Handler = (req: ZoomRequest) => void;
let handler: Handler | null = null;
let pending: ZoomRequest | null = null;
let currentView: ViewDomain = { x0: 0, x1: 1 };

export const arcController = {
  zoomTo(req: ZoomRequest) {
    const r = { ...clampView(req), duration: req.duration };
    if (handler) handler(r);
    else pending = r;
  },
  reset(duration = 800) {
    this.zoomTo({ x0: 0, x1: 1, duration });
  },
  /** Pans so that `verse` is centred, keeping the current zoom level. */
  centerOn(verse: number, duration = 700) {
    const span = currentView.x1 - currentView.x0;
    const c = (verse + 0.5) / TOTAL_VERSES;
    this.zoomTo({ x0: c - span / 2, x1: c + span / 2, duration });
  },
  attach(fn: Handler) {
    handler = fn;
    if (pending) {
      fn(pending);
      pending = null;
    }
    return () => {
      if (handler === fn) handler = null;
    };
  },
  setCurrentView(v: ViewDomain) {
    currentView = v;
  },
  getCurrentView(): ViewDomain {
    return currentView;
  },
};

/** A comfortable view around a passage. */
export function viewForPassage(start: number, end: number, unit: PassageUnit): ViewDomain {
  const len = end - start + 1;
  const pad: Record<PassageUnit, number> = { verse: 0, range: 3, chapter: 1.5, book: 1.15, testament: 1.02 };
  const minSpan: Record<PassageUnit, number> = { verse: 300, range: 300, chapter: 240, book: 200, testament: 0 };
  const spanVerses = Math.max(minSpan[unit], len * pad[unit]);
  const c = (start + end + 1) / 2;
  return clampView({ x0: (c - spanVerses / 2) / TOTAL_VERSES, x1: (c + spanVerses / 2) / TOTAL_VERSES });
}

/** A view that shows both ends of a connection. */
export function viewForConnection(a: number, b: number): ViewDomain {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const span = Math.max(160, (hi - lo) * 1.25);
  const c = (lo + hi + 1) / 2;
  return clampView({ x0: (c - span / 2) / TOTAL_VERSES, x1: (c + span / 2) / TOTAL_VERSES });
}
