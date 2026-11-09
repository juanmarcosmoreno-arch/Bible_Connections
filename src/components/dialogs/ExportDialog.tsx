import { useState } from 'react';
import { useData } from '../../hooks/useData.tsx';
import { useHighlight } from '../../hooks/useHighlight.ts';
import { formatNumber, useT } from '../../i18n/index.ts';
import { actions, useApp } from '../../state/appState.ts';
import { arcColor } from '../../utils/colors.ts';
import { downloadBlob, downloadText } from '../../utils/download.ts';
import { SVG_MAX_ARCS, buildArcSVG, connectionsToCSV, connectionsToJSON, filteredStatistics } from '../../utils/export.ts';
import { readAxisColors, type AxisMarker } from '../../visualizations/ArcVisualization/axis.ts';
import { arcController } from '../../visualizations/ArcVisualization/controller.ts';
import { exportArcPng } from '../../visualizations/ArcVisualization/exportImage.ts';
import { computeLayout } from '../../visualizations/ArcVisualization/geometry.ts';
import { Button, Field, Icon, Modal, Segmented, Toggle } from '../ui/index.tsx';

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export default function ExportDialog() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const theme = useApp((s) => s.theme);
  const filters = useApp((s) => s.filters);
  const settings = useApp((s) => s.settings);
  const selection = useApp((s) => s.selection);
  const { cols, derived, weight, filtered, chapterRefs } = useData();
  const highlight = useHighlight();
  const [scale, setScale] = useState<'1' | '2' | '4'>('2');
  const [transparent, setTransparent] = useState(false);
  const [labels, setLabels] = useState(true);
  const [legend, setLegend] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const ready = !!(cols && derived && weight && filtered);
  const n = filtered?.length ?? 0;

  const size = () => {
    const el = document.querySelector('[data-testid=arc-view]') as HTMLElement | null;
    return { w: el?.clientWidth || 1600, h: el?.clientHeight || 900 };
  };
  const markers = (): AxisMarker[] => {
    if (!selection || !cols) return [];
    if (selection.kind === 'passage') return [{ start: selection.start, end: selection.end }];
    if (selection.kind === 'path') return selection.verses.map((v) => ({ start: v, end: v }));
    return [
      { start: cols.sourceStart[selection.index], end: cols.sourceEnd[selection.index] },
      { start: cols.targetStart[selection.index], end: cols.targetEnd[selection.index] },
    ];
  };

  const png = async () => {
    if (!ready) return;
    const { w, h } = size();
    setStatus(t('export.rendering', { p: 0 }));
    try {
      const blob = await exportArcPng({
        cols: cols!,
        derived: derived!,
        weight: weight!,
        indices: filtered!,
        highlight,
        markers: markers(),
        view: arcController.getCurrentView(),
        cssWidth: w,
        cssHeight: h,
        scale: Number(scale),
        theme,
        transparent,
        labels,
        legend,
        lang,
        colors: readAxisColors(),
        intensity: settings.arcOpacity,
        lineWidth: settings.arcWidth,
        bars: settings.bars,
        chapterRefs: chapterRefs ?? null,
        legendTitle: t('arc.legend.title'),
        onProgress: (p) => setStatus(t('export.rendering', { p: Math.round(p * 100) })),
      });
      const name = `bible-connections-${stamp()}.png`;
      downloadBlob(blob, name);
      setStatus(t('export.done', { name }));
    } catch (e) {
      setStatus(String(e));
    }
  };

  const svg = () => {
    if (!ready || n > SVG_MAX_ARCS) return;
    const { w, h } = size();
    const layout = computeLayout(w, h, w < 640);
    const colors = readAxisColors();
    const text = buildArcSVG(derived!, weight!, filtered!, {
      width: w,
      height: h,
      baseline: layout.baseline,
      ratio: layout.ratio,
      view: arcController.getCurrentView(),
      background: transparent ? null : colors.bg,
      colorOf: arcColor,
      fg: colors.fg,
      labels,
      legend,
      lang,
      highlight,
    });
    const name = `bible-connections-${stamp()}.svg`;
    downloadText(text, name, 'image/svg+xml');
    setStatus(t('export.done', { name }));
  };

  const data = (kind: 'csv' | 'json' | 'stats') => {
    if (!ready) return;
    const name = `bible-connections-${kind === 'stats' ? 'statistics' : 'connections'}-${stamp()}.${kind === 'csv' ? 'csv' : 'json'}`;
    if (kind === 'csv') downloadText(connectionsToCSV(cols!, derived!, filtered!), name, 'text/csv');
    else if (kind === 'json') downloadText(JSON.stringify(connectionsToJSON(cols!, derived!, filtered!, filters)), name, 'application/json');
    else downloadText(JSON.stringify(filteredStatistics(cols!, derived!, filtered!, filters), null, 2), name, 'application/json');
    setStatus(t('export.done', { name }));
  };

  return (
    <Modal open onClose={actions.closeDialog} title={t('export.title')}>
      <div className="space-y-5" data-testid="export-dialog">
        <p className="text-xs text-muted">
          {t('export.filtersNote')} {t('filters.showing', { shown: formatNumber(n, lang), total: formatNumber(cols?.count ?? 0, lang) })}
        </p>
        <Field label={t('export.image')}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-fg/90">{t('export.resolution')}</span>
              <div className="w-40">
                <Segmented value={scale} onChange={setScale} label={t('export.resolution')} size="xs" options={[{ value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '4', label: '4×' }]} />
              </div>
            </div>
            <Toggle checked={transparent} onChange={setTransparent} label={t('export.transparent')} />
            <Toggle checked={labels} onChange={setLabels} label={t('export.labels')} />
            <Toggle checked={legend} onChange={setLegend} label={t('export.legend')} />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="solid" onClick={png} disabled={!ready} data-testid="export-png">
                <Icon name="download" size={14} /> {t('export.png')}
              </Button>
              <Button variant="outline" onClick={svg} disabled={!ready || n > SVG_MAX_ARCS} data-testid="export-svg">
                <Icon name="download" size={14} /> {t('export.svg')}
              </Button>
            </div>
            {n > SVG_MAX_ARCS && <p className="text-[11px] text-muted">{t('export.svgTooMany', { max: formatNumber(SVG_MAX_ARCS, lang), n: formatNumber(n, lang) })}</p>}
          </div>
        </Field>
        <Field label={t('export.data')}>
          <div className="grid gap-2">
            <Button variant="outline" onClick={() => data('csv')} disabled={!ready} data-testid="export-csv">
              {t('export.csv')}
            </Button>
            <Button variant="outline" onClick={() => data('json')} disabled={!ready} data-testid="export-json">
              {t('export.json')}
            </Button>
            <Button variant="outline" onClick={() => data('stats')} disabled={!ready} data-testid="export-stats">
              {t('export.stats')}
            </Button>
          </div>
        </Field>
        {status && (
          <p className="text-xs text-muted" role="status" data-testid="export-status">
            {status}
          </p>
        )}
      </div>
    </Modal>
  );
}
