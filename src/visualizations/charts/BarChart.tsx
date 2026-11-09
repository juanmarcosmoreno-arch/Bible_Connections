/** Minimal accessible SVG bar chart (vertical bars, optional log scale). */
import { formatNumber } from '../../i18n/index.ts';
import type { Lang } from '../../data/bibleStructure.ts';

export interface Bar {
  label: string;
  value: number;
  color?: string;
}

export function BarChart({ bars, lang, height = 160, log = false, color = 'var(--accent)', title }: { bars: Bar[]; lang: Lang; height?: number; log?: boolean; color?: string; title: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const scale = (v: number) => (log ? Math.log10(1 + v) / Math.log10(1 + max) : v / max);
  return (
    <figure aria-label={title}>
      <div className="flex items-end gap-1" style={{ height }} role="img" aria-label={bars.map((b) => `${b.label}: ${b.value}`).join(', ')}>
        {bars.map((b) => (
          <div key={b.label} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <span className="mb-0.5 hidden text-center text-[10px] tabular-nums text-muted group-hover:block">{formatNumber(b.value, lang)}</span>
            <div className="w-full rounded-t-sm transition-[height]" style={{ height: `${Math.max(b.value > 0 ? 1.5 : 0, scale(b.value) * 100)}%`, background: b.color ?? color, opacity: 0.85 }} title={`${b.label}: ${formatNumber(b.value, lang)}`} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {bars.map((b) => (
          <span key={b.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted">
            {b.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Horizontal ranked bars. */
export function RankBars({ items, lang, onPick, color = 'var(--accent)' }: { items: { label: string; value: number; sub?: string; key: string | number }[]; lang: Lang; onPick?: (key: string | number) => void; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="space-y-1">
      {items.map((it, k) => (
        <li key={it.key} className="grid grid-cols-[1.5rem_minmax(0,8rem)_1fr_auto] items-center gap-2 text-sm">
          <span className="text-right text-[11px] tabular-nums text-muted">{k + 1}</span>
          <button type="button" className="truncate text-left hover:text-accent" onClick={() => onPick?.(it.key)} title={it.sub ?? it.label}>
            {it.label}
          </button>
          <span className="h-2 rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: color, opacity: 0.8 }} />
          <span className="text-xs tabular-nums text-muted">{formatNumber(it.value, lang)}</span>
        </li>
      ))}
    </ol>
  );
}
