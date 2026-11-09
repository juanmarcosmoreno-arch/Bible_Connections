import { BOOKS } from '../../data/bibleStructure.ts';
import { useT } from '../../i18n/index.ts';
import { useApp } from '../../state/appState.ts';

/** Compact grid of the 66 books (OT then NT) with multi-selection. */
export function BookPicker({ selected, onChange, testId }: { selected: number[]; onChange: (ids: number[]) => void; testId?: string }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const set = new Set(selected);
  const toggle = (id: number) => onChange(set.has(id) ? selected.filter((x) => x !== id) : [...selected, id].sort((a, b) => a - b));
  const group = (testament: 'OT' | 'NT') => {
    const books = BOOKS.filter((b) => b.testament === testament);
    const allOn = books.every((b) => set.has(b.id));
    return (
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] text-muted">{t(`testament.${testament}`)}</span>
          <button
            type="button"
            className="text-[11px] text-muted hover:text-fg"
            onClick={() => onChange(allOn ? selected.filter((x) => !books.some((b) => b.id === x)) : [...new Set([...selected, ...books.map((b) => b.id)])].sort((a, b) => a - b))}
          >
            {allOn ? '−' : '+'} {t('filters.testament.all')}
          </button>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {books.map((b) => (
            <button
              key={b.id}
              type="button"
              title={b.name[lang]}
              aria-pressed={set.has(b.id)}
              onClick={() => toggle(b.id)}
              className={`truncate rounded-md px-1 py-1 text-[11px] font-medium transition ${set.has(b.id) ? 'bg-accent text-accent-fg' : 'bg-bg/50 text-muted hover:text-fg'}`}
            >
              {b.short[lang]}
            </button>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-2" data-testid={testId}>
      {group('OT')}
      {group('NT')}
    </div>
  );
}
