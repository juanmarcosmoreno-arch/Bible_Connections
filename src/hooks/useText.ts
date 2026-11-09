import { useEffect, useState } from 'react';
import { textProvider, type TranslationMeta, type VerseText } from '../data/textProvider.ts';
import { effectiveTranslation, useApp } from '../state/appState.ts';

export function useTranslationCode(): string {
  const translation = useApp((s) => s.translation);
  const lang = useApp((s) => s.lang);
  return effectiveTranslation({ translation, lang });
}

const MAX_VERSES = 200;

/** Loads the text of [start, end] (capped at 200 verses) in the active translation. */
export function useVerseTexts(start: number | null, end: number | null): { status: 'idle' | 'loading' | 'ready' | 'error'; verses: VerseText[]; truncated: boolean; code: string } {
  const code = useTranslationCode();
  const [state, setState] = useState<{ key: string; status: 'loading' | 'ready' | 'error'; verses: VerseText[] }>({ key: '', status: 'loading', verses: [] });
  const key = start == null || end == null ? '' : `${code}:${start}:${end}`;
  useEffect(() => {
    if (start == null || end == null) return;
    let alive = true;
    const e = Math.min(end, start + MAX_VERSES - 1);
    textProvider
      .getRange(code, start, e)
      .then((verses) => alive && setState({ key, status: 'ready', verses }))
      .catch(() => alive && setState({ key, status: 'error', verses: [] }));
    return () => {
      alive = false;
    };
  }, [code, start, end, key]);
  if (!key) return { status: 'idle', verses: [], truncated: false, code };
  if (state.key !== key) return { status: 'loading', verses: [], truncated: false, code };
  return { status: state.status, verses: state.verses, truncated: end! - start! + 1 > MAX_VERSES, code };
}

export function useTranslations(): TranslationMeta[] {
  const [list, setList] = useState<TranslationMeta[]>([]);
  useEffect(() => {
    textProvider.listTranslations().then(setList).catch(() => setList([]));
  }, []);
  return list;
}
