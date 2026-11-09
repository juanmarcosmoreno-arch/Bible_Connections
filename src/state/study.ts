/**
 * Personal study: saved passages/connections with notes, kept in this browser (localStorage).
 * Items use stable identifiers (OpenBible notation), so they survive data updates and can be
 * exported/imported as JSON to move them between devices.
 */
import { osisRange } from '../data/bibleStructure.ts';
import type { ReferenceColumns } from '../data/format.ts';
import type { Selection } from './appState.ts';
import { createStore, safeStorage, useStoreValue } from './store.ts';

export interface StudyItem {
  id: string; // "p:John.3.16" | "p:Ps.23.1-Ps.23.6" | "x:Gen.1.1~Rev.4.11"
  unit?: 'verse' | 'range' | 'chapter' | 'book' | 'testament';
  note: string;
  added: number;
}

const KEY = 'bc.study';
const storage = safeStorage();

function load(): StudyItem[] {
  try {
    const raw = storage.get(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items.filter((i) => typeof i?.id === 'string') : [];
  } catch {
    return [];
  }
}

export const studyStore = createStore<{ items: StudyItem[] }>({ items: load() });
studyStore.subscribe(() => storage.set(KEY, JSON.stringify(studyStore.get().items)));

export function studyId(sel: Selection | null, cols?: ReferenceColumns): string | null {
  if (!sel) return null;
  if (sel.kind === 'passage') return `p:${osisRange(sel.start, sel.end)}`;
  if (sel.kind === 'reference' && cols) {
    const i = sel.index;
    return `x:${osisRange(cols.sourceStart[i], cols.sourceEnd[i])}~${osisRange(cols.targetStart[i], cols.targetEnd[i])}`;
  }
  return null;
}

export const study = {
  has: (id: string) => studyStore.get().items.some((i) => i.id === id),
  toggle(id: string, unit?: StudyItem['unit']) {
    const items = studyStore.get().items;
    studyStore.set({ items: items.some((i) => i.id === id) ? items.filter((i) => i.id !== id) : [{ id, unit, note: '', added: Date.now() }, ...items] });
  },
  setNote(id: string, note: string, unit?: StudyItem['unit']) {
    const items = studyStore.get().items;
    const found = items.find((i) => i.id === id);
    if (found) studyStore.set({ items: items.map((i) => (i.id === id ? { ...i, note } : i)) });
    else if (note.trim()) studyStore.set({ items: [{ id, unit, note, added: Date.now() }, ...items] });
  },
  remove(id: string) {
    studyStore.set({ items: studyStore.get().items.filter((i) => i.id !== id) });
  },
  clear() {
    studyStore.set({ items: [] });
  },
  /** Merges imported items (imported notes win). Returns the number of items read. */
  import(json: string): number {
    const data = JSON.parse(json);
    const incoming: StudyItem[] = (Array.isArray(data) ? data : data.items ?? []).filter((i: StudyItem) => typeof i?.id === 'string' && /^[px]:/.test(i.id));
    const map = new Map(studyStore.get().items.map((i) => [i.id, i]));
    for (const i of incoming) map.set(i.id, { id: i.id, unit: i.unit, note: String(i.note ?? ''), added: Number(i.added) || Date.now() });
    studyStore.set({ items: [...map.values()].sort((a, b) => b.added - a.added) });
    return incoming.length;
  },
  export(): string {
    return JSON.stringify({ app: 'Bible Connections', exported: new Date().toISOString(), items: studyStore.get().items }, null, 2);
  },
};

export function useStudyItems(): StudyItem[] {
  return useStoreValue(studyStore, (s) => s.items);
}
