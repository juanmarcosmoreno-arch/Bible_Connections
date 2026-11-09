import { useState } from 'react';
import { isDefaultFilters } from '../analysis/filters.ts';
import { FilterPanel } from '../components/filters/FilterPanel.tsx';
import { DetailPanel } from '../components/panels/DetailPanel.tsx';
import { Button, Icon, IconButton, Spinner } from '../components/ui/index.tsx';
import { useData } from '../hooks/useData.tsx';
import { formatNumber, useT } from '../i18n/index.ts';
import { actions, useApp } from '../state/appState.ts';
import { focusTestament } from '../state/navigation.ts';
import { ArcView } from '../visualizations/ArcVisualization/ArcView.tsx';
import { arcController } from '../visualizations/ArcVisualization/controller.ts';
import { ArcLegend } from '../visualizations/ArcVisualization/Legend.tsx';

export function ArcPage() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const filtersOpen = useApp((s) => s.filtersOpen);
  const filters = useApp((s) => s.filters);
  const introDismissed = useApp((s) => s.introDismissed);
  const sheetOpen = useApp((s) => s.panelOpen && s.selection != null);
  const data = useData();
  const [renderer, setRenderer] = useState<'webgl' | 'canvas' | null>(null);

  const zoom = (factor: number) => {
    const v = arcController.getCurrentView();
    const c = (v.x0 + v.x1) / 2, span = (v.x1 - v.x0) * factor;
    arcController.zoomTo({ x0: c - span / 2, x1: c + span / 2, duration: 350 });
  };

  return (
    <div className="relative flex h-full min-h-0">
      {filtersOpen && (
        <aside className="z-30 border-line bg-panel/95 backdrop-blur max-lg:fixed max-lg:inset-0 max-lg:top-14 lg:relative lg:w-[300px] lg:shrink-0 lg:border-r">
          <FilterPanel onClose={() => actions.setFiltersOpen(false)} />
        </aside>
      )}

      {/* On small screens the details sheet sits below the arcs instead of covering the axis. */}
      <div className={`relative min-w-0 flex-1 overflow-hidden ${sheetOpen ? 'max-lg:mb-[46dvh]' : ''}`} data-testid="arc-page">
        <ArcView onRenderer={setRenderer} />

        {data.status === 'ready' && !introDismissed && (
          <div className="pointer-events-none absolute inset-x-0 top-[9%] z-10 flex flex-col items-center px-6 text-center animate-fade-in">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-fg sm:text-5xl">{t('tagline')}</h1>
            <p className="mt-3 max-w-xl text-sm text-muted sm:text-lg">{t('subtitle')}</p>
            <Button variant="outline" className="pointer-events-auto mt-6 bg-bg/40 backdrop-blur" onClick={actions.dismissIntro} data-testid="intro-dismiss">
              {t('intro.dismiss')} <Icon name="arrow" size={16} />
            </Button>
          </div>
        )}

        {data.status !== 'ready' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4" data-testid="arc-loading">
            {data.status === 'error' ? (
              <p className="text-sm text-danger">
                {t('error.data')} {data.error}
              </p>
            ) : (
              <>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{t('tagline')}</h1>
                <div className="flex items-center gap-3 text-sm text-muted">
                  <Spinner /> {t('loading.data')}
                </div>
                <div className="h-1 w-56 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(data.progress * 100)}%` }} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Top-left: filters */}
        <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
          <Button
            variant="outline"
            className={`bg-panel/80 backdrop-blur ${filtersOpen ? 'max-lg:hidden' : ''}`}
            onClick={() => actions.setFiltersOpen(!filtersOpen)}
            aria-pressed={filtersOpen}
            data-testid="filters-toggle"
          >
            <Icon name="filter" size={15} /> {t('action.filters')}
            {!isDefaultFilters(filters) && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-accent" />}
          </Button>
          {data.filtered && data.cols && (
            <span className="hidden rounded-md bg-bg/50 px-2 py-1 text-xs tabular-nums text-muted backdrop-blur sm:inline" data-testid="arc-count">
              {t('arc.arcsShown', { n: formatNumber(data.filtered.length, lang) })}
              {renderer === 'canvas' && ` · ${t('arc.renderer.canvas')}`}
            </span>
          )}
        </div>

        {/* Top-right: legend and view controls (the top corners are empty above the semicircles). */}
        <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-line bg-panel/80 p-1 backdrop-blur">
          {(['OT', 'NT'] as const).map((tt) => (
            <button
              key={tt}
              type="button"
              onClick={() => focusTestament(tt)}
              title={t(`testament.${tt}`)}
              aria-label={t(`testament.${tt}`)}
              className="h-9 rounded-lg px-2 text-xs font-semibold tracking-wider text-muted hover:bg-panel-2 hover:text-fg"
              data-testid={`zoom-${tt}`}
            >
              {t(`testament.${tt}.short`)}
            </button>
          ))}
          <IconButton label={t('action.zoomIn')} onClick={() => zoom(1 / 3)} data-testid="zoom-in">
            <Icon name="plus" />
          </IconButton>
          <IconButton label={t('action.zoomOut')} onClick={() => zoom(3)} data-testid="zoom-out">
            <Icon name="minus" />
          </IconButton>
          <IconButton label={t('action.resetView')} onClick={() => arcController.reset()} data-testid="zoom-reset">
            <Icon name="expand" />
          </IconButton>
          <IconButton label={t('action.export')} onClick={() => actions.openDialog('export')} data-testid="open-export">
            <Icon name="download" />
          </IconButton>
            <IconButton label={t('action.showPanel')} onClick={() => actions.setPanelOpen(true)} className="hidden lg:inline-flex" data-testid="panel-open-inline">
              <Icon name="panel" />
            </IconButton>
          </div>
          <div className="hidden sm:block">
            <ArcLegend />
          </div>
        </div>
        {renderer === 'canvas' && <div className="absolute bottom-20 left-3 z-10 max-w-xs rounded-lg bg-panel/80 px-2 py-1 text-[11px] text-muted">{t('error.webgl')}</div>}
      </div>

      <DetailPanel />
    </div>
  );
}
