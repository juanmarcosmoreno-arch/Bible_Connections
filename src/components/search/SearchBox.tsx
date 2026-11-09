import { useEffect, useMemo, useRef, useState } from 'react';
import { BOOKS, formatChapter, formatRange } from '../../data/bibleStructure.ts';
import { searchReferences, type SearchResult } from '../../data/search.ts';
import { useT } from '../../i18n/index.ts';
import { actions, useApp } from '../../state/appState.ts';
import { focusSearchResult } from '../../state/navigation.ts';
import { Icon } from '../ui/index.tsx';

export function resultLabel(r: SearchResult, lang: 'en' | 'es'): string {
  if (r.kind === 'book') return BOOKS[r.bookId].name[lang];
  if (r.kind === 'chapter') return formatChapter(BOOKS[r.bookId].firstChapter + r.chapter! - 1, lang);
  return formatRange(r.start, r.end, lang);
}

export function SearchBox({ autoFocus, onDone, className = '' }: { autoFocus?: boolean; onDone?: () => void; className?: string }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const route = useApp((s) => s.route);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchReferences(q, lang, 8), [q, lang]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Global shortcut: "/" or Ctrl/Cmd+K focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (r: SearchResult) => {
    focusSearchResult(r, { route: route === 'explore' ? 'explore' : route === 'network' ? null : 'arc' });
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
    onDone?.();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-bg/60 px-2.5 focus-within:border-accent/70">
        <Icon name="search" size={16} className="text-muted" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              setActive((a) => Math.min(results.length - 1, a + 1));
              e.preventDefault();
            } else if (e.key === 'ArrowUp') {
              setActive((a) => Math.max(0, a - 1));
              e.preventDefault();
            } else if (e.key === 'Enter' && results[active]) choose(results[active]);
            else if (e.key === 'Escape') {
              setQ('');
              inputRef.current?.blur();
              actions.closeDialog();
            }
          }}
          placeholder={t('search.placeholder')}
          aria-label={t('action.search')}
          role="combobox"
          aria-expanded={open && !!q}
          aria-controls="search-results"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted/70"
          data-testid="search-input"
        />
        <kbd className="hidden rounded border border-line px-1.5 text-[10px] text-muted lg:inline">/</kbd>
      </div>
      {open && q.trim() && (
        <ul id="search-results" role="listbox" className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--shadow)]" data-testid="search-results">
          {results.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">{t('search.noResults')}</li>}
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.start}-${r.end}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-panel-2' : ''}`}
              >
                <span className="truncate">{resultLabel(r, lang)}</span>
                <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted">
                  {t(r.kind === 'book' ? 'unit.book' : r.kind === 'chapter' ? 'unit.chapter' : 'unit.verse')}
                </span>
              </button>
            </li>
          ))}
          <li className="border-t border-line px-3 py-1.5 text-[11px] text-muted">{t('search.hint')}</li>
        </ul>
      )}
    </div>
  );
}
