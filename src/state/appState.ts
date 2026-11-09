/**
 * Global UI state: route, language, theme, filters, selection and settings.
 */
import type { AnchorRule } from '../analysis/anchor.ts';
import { DEFAULT_FILTERS, type BookDirection, type FilterState } from '../analysis/filters.ts';
import type { Lang } from '../data/bibleStructure.ts';
import { createStore, safeStorage, useStoreValue } from './store.ts';

export type Route = 'arc' | 'explore' | 'network' | 'insights';
export type Theme = 'dark' | 'light';
export type PassageUnit = 'verse' | 'range' | 'chapter' | 'book' | 'testament';

export type Selection =
  | { kind: 'passage'; unit: PassageUnit; start: number; end: number }
  | { kind: 'reference'; index: number };

export interface Settings {
  anchor: AnchorRule;
  arcOpacity: number; // multiplier, 0.25 … 3
  arcWidth: number; // CSS px, 0.5 … 2.5
  lod: boolean;
  bars: 'verses' | 'refs';
}

export type Dialog = null | 'settings' | 'about' | 'export' | 'search';

export interface AppState {
  route: Route;
  lang: Lang;
  theme: Theme;
  translation: 'auto' | string;
  settings: Settings;
  filters: FilterState;
  selection: Selection | null;
  /** Which connections of a selected passage to highlight. */
  selectionDirection: BookDirection;
  panelOpen: boolean;
  filtersOpen: boolean;
  dialog: Dialog;
  introDismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = { anchor: 'start', arcOpacity: 1, arcWidth: 1, lod: true, bars: 'verses' };

const storage = safeStorage();

function initialLang(): Lang {
  const saved = storage.get('bc.lang');
  if (saved === 'en' || saved === 'es') return saved;
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function initialSettings(): Settings {
  try {
    const raw = storage.get('bc.settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const appStore = createStore<AppState>({
  route: 'arc',
  lang: initialLang(),
  theme: storage.get('bc.theme') === 'light' ? 'light' : 'dark',
  translation: storage.get('bc.translation') ?? 'auto',
  settings: initialSettings(),
  filters: DEFAULT_FILTERS,
  selection: null,
  selectionDirection: 'both',
  panelOpen: false,
  filtersOpen: false,
  dialog: null,
  introDismissed: storage.get('bc.intro') === '1',
});

// Persist user preferences.
appStore.subscribe(() => {
  const s = appStore.get();
  storage.set('bc.lang', s.lang);
  storage.set('bc.theme', s.theme);
  storage.set('bc.translation', s.translation);
  storage.set('bc.settings', JSON.stringify(s.settings));
  if (s.introDismissed) storage.set('bc.intro', '1');
});

export function useApp<S>(selector: (s: AppState) => S): S {
  return useStoreValue(appStore, selector);
}

export const actions = {
  setRoute: (route: Route) => appStore.set({ route }),
  setLang: (lang: Lang) => appStore.set({ lang }),
  setTranslation: (translation: string) => appStore.set({ translation }),
  toggleTheme: () => appStore.set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setFilters: (patch: Partial<FilterState>) => appStore.set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => appStore.set({ filters: DEFAULT_FILTERS }),
  setSettings: (patch: Partial<Settings>) => appStore.set((s) => ({ settings: { ...s.settings, ...patch } })),
  select: (selection: Selection | null) => appStore.set((s) => ({ selection, panelOpen: selection ? true : s.panelOpen })),
  selectPassage: (unit: PassageUnit, start: number, end: number) =>
    appStore.set({ selection: { kind: 'passage', unit, start, end }, panelOpen: true }),
  selectReference: (index: number) => appStore.set({ selection: { kind: 'reference', index }, panelOpen: true }),
  clearSelection: () => appStore.set({ selection: null }),
  setSelectionDirection: (selectionDirection: BookDirection) => appStore.set({ selectionDirection }),
  setPanelOpen: (panelOpen: boolean) => appStore.set({ panelOpen }),
  setFiltersOpen: (filtersOpen: boolean) => appStore.set({ filtersOpen }),
  openDialog: (dialog: Dialog) => appStore.set({ dialog }),
  closeDialog: () => appStore.set({ dialog: null }),
  dismissIntro: () => appStore.set({ introDismissed: true }),
};

/** Effective Bible translation code for the current settings. */
export function effectiveTranslation(s: Pick<AppState, 'translation' | 'lang'>): string {
  if (s.translation !== 'auto') return s.translation;
  return s.lang === 'es' ? 'RV1909' : 'WEB';
}
