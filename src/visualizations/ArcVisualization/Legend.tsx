import { DISTANCE_BREAKS } from '../../analysis/distance.ts';
import { useT } from '../../i18n/index.ts';
import { arcColor } from '../../utils/colors.ts';

export function gradientCss(): string {
  const stops = Array.from({ length: 13 }, (_, i) => `${arcColor(i / 12)} ${((i / 12) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export function ArcLegend() {
  const t = useT();
  return (
    <div className="pointer-events-none select-none" data-testid="arc-legend">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">{t('arc.legend.title')}</div>
      <div className="h-1.5 w-56 rounded-full" style={{ background: gradientCss() }} />
      <div className="relative mt-1 h-3 w-56 text-[10px] text-muted">
        <span className="absolute left-0">{t('filters.distance.near')}</span>
        <span className="absolute left-1/3 -translate-x-1/2">{Math.round(DISTANCE_BREAKS.near * 100)}%</span>
        <span className="absolute left-2/3 -translate-x-1/2">{Math.round(DISTANCE_BREAKS.mid * 100)}%</span>
        <span className="absolute right-0">{t('filters.distance.far')}</span>
      </div>
    </div>
  );
}
