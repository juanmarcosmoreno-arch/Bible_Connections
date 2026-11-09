import { useCallback } from 'react';
import type { Lang } from '../data/bibleStructure.ts';
import { useApp } from '../state/appState.ts';
import { STRINGS, type StringKey } from './strings.ts';

export type { StringKey };

export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function useT() {
  const lang = useApp((s) => s.lang);
  return useCallback((key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

export function formatNumber(n: number, lang: Lang, digits = 0): string {
  return n.toLocaleString(lang === 'es' ? 'es-AR' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
