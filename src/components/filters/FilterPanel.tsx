import { useState } from 'react';
import { DENSITY_OPTIONS, isDefaultFilters, type FilterState } from '../../analysis/filters.ts';
import { DISTANCE_BREAKS } from '../../analysis/distance.ts';
import { BOOKS } from '../../data/bibleStructure.ts';
import { useData } from '../../hooks/useData.tsx';
import { formatNumber, useT } from '../../i18n/index.ts';
import { actions, useApp } from '../../state/appState.ts';
import { arcColor } from '../../utils/colors.ts';
import { Button, Field, Icon, IconButton, Segmented } from '../ui/index.tsx';
import { BookPicker } from './BookPicker.tsx';

const VOTE_STEPS = [-1000, 0, 1, 2, 5, 10, 20, 50, 100, 200, 500];

export function FilterPanel({ onClose }: { onClose?: () => void }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const f = useApp((s) => s.filters);
  const { cols, filtered } = useData();
  const [pair, setPair] = useState(f.targetBooks.length > 0);
  const set = (patch: Partial<FilterState>) => actions.setFilters(patch);
  const voteIdx = Math.max(0, VOTE_STEPS.findIndex((v) => v >= f.minVotes));

  return (
    <div className="flex h-full flex-col" data-testid="filter-panel">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h2 className="text-sm font-semibold tracking-tight">{t('filters.title')}</h2>
        <div className="flex items-center gap-1">
          <Button onClick={actions.resetFilters} disabled={isDefaultFilters(f)} className="!px-2 !py-1 text-xs" data-testid="filters-reset">
            {t('action.reset')}
          </Button>
          {onClose && (
            <IconButton label={t('action.close')} onClick={onClose}>
              <Icon name="close" />
            </IconButton>
          )}
        </div>
      </div>
      <div className="px-4 pb-3 text-xs text-muted" data-testid="filter-count">
        {cols && filtered ? t('filters.showing', { shown: formatNumber(filtered.length, lang), total: formatNumber(cols.count, lang) }) : t('loading.generic')}
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6">
        <Field label={t('filters.testament')}>
          <Segmented
            value={f.testament}
            onChange={(testament) => set({ testament })}
            label={t('filters.testament')}
            options={(['all', 'OT-OT', 'NT-NT', 'cross'] as const).map((v) => ({ value: v, label: t(`filters.testament.${v}`) }))}
          />
        </Field>

        <Field label={t('filters.books')} hint={pair ? t('filters.pairNote') : undefined}>
          <div className="space-y-2">
            <Segmented
              value={f.bookDirection}
              onChange={(bookDirection) => set({ bookDirection })}
              label={t('filters.direction')}
              size="xs"
              options={(['out', 'in', 'both'] as const).map((v) => ({ value: v, label: t(`filters.direction.${v}`) }))}
            />
            <BookPicker selected={f.books} onChange={(books) => set({ books })} testId="book-picker" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={pair}
                  onChange={(e) => {
                    setPair(e.target.checked);
                    if (!e.target.checked) set({ targetBooks: [] });
                  }}
                />
                {t('filters.between')} …
              </label>
              {(f.books.length > 0 || f.targetBooks.length > 0) && (
                <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => set({ books: [], targetBooks: [] })}>
                  {t('filters.clearBooks')}
                </button>
              )}
            </div>
            {pair && <BookPicker selected={f.targetBooks} onChange={(targetBooks) => set({ targetBooks })} testId="target-book-picker" />}
            {(f.books.length > 0 || f.targetBooks.length > 0) && (
              <p className="text-xs text-fg/80">
                {f.books.map((b) => BOOKS[b].short[lang]).join(', ') || t('filters.booksAny')}
                {f.targetBooks.length > 0 && ` ${f.bookDirection === 'both' ? '↔' : '→'} ${f.targetBooks.map((b) => BOOKS[b].short[lang]).join(', ')}`}
              </p>
            )}
          </div>
        </Field>

        <Field label={`${t('filters.minVotes')}: ${f.minVotes <= -1000 ? t('filters.minVotesAll') : `≥ ${f.minVotes}`}`}>
          <input
            type="range"
            min={0}
            max={VOTE_STEPS.length - 1}
            step={1}
            value={voteIdx}
            onChange={(e) => set({ minVotes: VOTE_STEPS[Number(e.target.value)] })}
            className="w-full"
            aria-label={t('filters.minVotes')}
            data-testid="min-votes"
          />
          <div className="flex justify-between text-[10px] text-muted">
            <span>{t('filters.density.all')}</span>
            <span>0</span>
            <span>10</span>
            <span>100</span>
            <span>500</span>
          </div>
        </Field>

        <Field label={t('filters.distance')} hint={t('filters.distanceHelp')}>
          <div className="grid grid-cols-3 gap-1.5">
            {(['near', 'mid', 'far'] as const).map((k, i) => (
              <button
                key={k}
                type="button"
                aria-pressed={f.distance[k]}
                onClick={() => set({ distance: { ...f.distance, [k]: !f.distance[k] } })}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${f.distance[k] ? 'border-line bg-panel-2 text-fg' : 'border-transparent bg-bg/40 text-muted line-through'}`}
                data-testid={`distance-${k}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: arcColor([0.15, 0.5, 0.88][i]) }} />
                {t(`filters.distance.${k}`)}
              </button>
            ))}
          </div>
          <span className="sr-only">
            {DISTANCE_BREAKS.near} {DISTANCE_BREAKS.mid}
          </span>
        </Field>

        <Field label={t('filters.density')} hint={t('filters.reproducible')}>
          <Segmented
            value={String(f.top)}
            onChange={(v) => set({ top: v === 'null' ? null : Number(v) })}
            label={t('filters.density')}
            size="xs"
            options={DENSITY_OPTIONS.map((n) => ({ value: String(n), label: n == null ? t('filters.density.all') : n >= 1000 ? `${n / 1000}k` : String(n) }))}
          />
        </Field>
      </div>
    </div>
  );
}
