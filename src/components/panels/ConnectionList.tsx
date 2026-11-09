import { useState } from 'react';
import { formatRange } from '../../data/bibleStructure.ts';
import { useData } from '../../hooks/useData.tsx';
import { formatNumber, useT } from '../../i18n/index.ts';
import { useApp } from '../../state/appState.ts';
import { focusReference, goToVerse } from '../../state/navigation.ts';
import { arcColor } from '../../utils/colors.ts';
import { Icon } from '../ui/index.tsx';
import { PassageText } from './PassageText.tsx';

export interface ConnectionItem {
  index: number;
  /** Which end is "the other passage" relative to the context. */
  other: 'source' | 'target';
}

/** A list of connections (most relevant first) with the other end, colour and actions. */
export function ConnectionList({ items, pageSize = 40, showSelf = false }: { items: ConnectionItem[]; pageSize?: number; showSelf?: boolean }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const { cols, derived, filteredMask } = useData();
  const [limit, setLimit] = useState(pageSize);
  const [open, setOpen] = useState<number | null>(null);
  if (!cols || !derived) return null;
  if (!items.length) return <p className="py-2 text-sm text-muted">{t('panel.none')}</p>;
  return (
    <div>
      <ul className="divide-y divide-line/70" data-testid="connection-list">
        {items.slice(0, limit).map(({ index: i, other }) => {
          const os = other === 'target' ? cols.targetStart[i] : cols.sourceStart[i];
          const oe = other === 'target' ? cols.targetEnd[i] : cols.sourceEnd[i];
          const visible = filteredMask ? filteredMask[i] === 1 : true;
          const expanded = open === i;
          return (
            <li key={`${i}-${other}`} className={`py-1.5 ${visible ? '' : 'opacity-50'}`}>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: arcColor(derived.colorT[i]) }} />
                <span className="w-3 shrink-0 text-center text-xs text-muted" title={other === 'target' ? t('panel.outgoing') : t('panel.incoming')}>
                  {other === 'target' ? '→' : '←'}
                </span>
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm hover:text-accent" onClick={() => goToVerse(os, oe)} title={t('action.goTo')}>
                  {showSelf && <span className="text-muted">{formatRange(other === 'target' ? cols.sourceStart[i] : cols.targetStart[i], other === 'target' ? cols.sourceEnd[i] : cols.targetEnd[i], lang, true)} → </span>}
                  {formatRange(os, oe, lang)}
                </button>
                <button type="button" className="shrink-0 rounded p-0.5 text-muted hover:text-fg" onClick={() => focusReference(cols, i)} aria-label={t('arc.tooltip.click')} title={t('arc.tooltip.click')}>
                  <Icon name="arc" size={14} />
                </button>
                <button type="button" className="shrink-0 rounded p-0.5 text-muted hover:text-fg" onClick={() => setOpen(expanded ? null : i)} aria-expanded={expanded} aria-label={t('panel.passage')}>
                  <Icon name={expanded ? 'up' : 'down'} size={14} />
                </button>
              </div>
              {expanded && (
                <div className="mt-1.5 rounded-lg bg-bg/50 px-3 py-2">
                  <PassageText start={os} end={oe} compact maxVerses={12} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > limit && (
        <button type="button" className="mt-2 w-full rounded-lg border border-line py-1.5 text-xs text-muted hover:text-fg" onClick={() => setLimit((l) => l + pageSize * 2)}>
          {t('action.showMore')} ({formatNumber(items.length - limit, lang)})
        </button>
      )}
    </div>
  );
}
