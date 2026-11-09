import { useMemo, useState } from 'react';
import { searchReferences, type SearchResult } from '../../data/search.ts';
import { useT } from '../../i18n/index.ts';
import { useApp } from '../../state/appState.ts';
import { resultLabel } from './SearchBox.tsx';

/** Passage picker with suggestions (Spanish/English names and abbreviations). */
export function RefInput({ value, onChange, placeholder, testId }: { value: SearchResult | null; onChange: (r: SearchResult | null) => void; placeholder: string; testId?: string }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchReferences(q, lang, 6), [q, lang]);
  const shown = open ? q : value ? resultLabel(value, lang) : q;
  return (
    <div className="relative">
      <input
        value={shown}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQ(value ? resultLabel(value, lang) : q);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) {
            onChange(results[0]);
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm outline-none focus:border-accent/70"
        data-testid={testId}
      />
      {open && q.trim() && (
        <ul className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow)]">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t('search.noResults')}</li>}
          {results.map((r) => (
            <li key={`${r.kind}-${r.start}-${r.end}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(r);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-panel-2"
              >
                {resultLabel(r, lang)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
