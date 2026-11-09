/** Path between two passages: shortest chains of cross-references, drawn on the Arc on demand. */
import { useMemo, useState } from 'react';
import { buildVerseGraph, findChains, type ChainPath } from '../../analysis/path.ts';
import { PathSteps } from '../../components/panels/DetailPanel.tsx';
import { RefInput } from '../../components/search/RefInput.tsx';
import { Button, Icon, Segmented, Toggle } from '../../components/ui/index.tsx';
import { formatVerse } from '../../data/bibleStructure.ts';
import { parseReference, type SearchResult } from '../../data/search.ts';
import { useData } from '../../hooks/useData.tsx';
import { useT } from '../../i18n/index.ts';
import { actions, useApp } from '../../state/appState.ts';
import { arcController, viewForConnection } from '../ArcVisualization/controller.ts';

export function PathFinder() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const { cols, filtered } = useData();
  const [from, setFrom] = useState<SearchResult | null>(() => parseReference('Genesis 1:1'));
  const [to, setTo] = useState<SearchResult | null>(() => parseReference('John 3:16'));
  const [useFilters, setUseFilters] = useState(false);
  const [result, setResult] = useState<{ chains: ChainPath[]; key: string } | null>(null);
  const [pick, setPick] = useState('0');

  const graph = useMemo(() => (cols ? buildVerseGraph(cols, useFilters ? filtered ?? null : null) : null), [cols, filtered, useFilters]);

  const find = () => {
    if (!graph || !from || !to) return;
    const chains = findChains(graph, [from.start, from.end], [to.start, to.end]);
    setResult({ chains, key: `${from.start}-${to.start}` });
    setPick('0');
  };
  const chosen = result?.chains[Number(pick)] ?? null;
  const same = from && to && from.start === to.start && from.end === to.end;

  const showInArc = () => {
    if (!chosen) return;
    actions.selectPath(chosen.verses, chosen.refs);
    const lo = Math.min(...chosen.verses), hi = Math.max(...chosen.verses);
    actions.setRoute('arc');
    arcController.zoomTo({ ...viewForConnection(lo, hi), duration: 900 });
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto" data-testid="path-finder">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-24 pt-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('path.title')}</h1>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <RefInput value={from} onChange={setFrom} placeholder={t('path.from')} testId="path-from" />
            <RefInput value={to} onChange={setTo} placeholder={t('path.to')} testId="path-to" />
            <Button variant="solid" onClick={find} disabled={!graph || !from || !to || !!same} data-testid="path-find">
              {t('path.find')}
            </Button>
          </div>
          <div className="mt-3 w-72">
            <Toggle checked={useFilters} onChange={setUseFilters} label={<span className="text-xs">{t('network.useFilters')}</span>} />
          </div>
          {same && <p className="mt-3 text-sm text-muted">{t('path.same')}</p>}
          {result && result.chains.length === 0 && <p className="mt-6 text-sm text-muted">{t('path.none')}</p>}
          {result && result.chains.length > 0 && chosen && (
            <div className="mt-6">
              {result.chains.length > 1 && (
                <div className="mb-3 max-w-md">
                  <Segmented
                    value={pick}
                    onChange={setPick}
                    label={t('path.title')}
                    size="xs"
                    options={result.chains.map((c, k) => ({ value: String(k), label: `${k === 0 ? t('path.shortest') : t('path.alternative', { n: k })} · ${c.refs.length}` }))}
                  />
                </div>
              )}
              <PathSteps verses={chosen.verses} refs={chosen.refs} />
              <Button variant="outline" className="mt-4" onClick={showInArc} data-testid="path-show-arc">
                <Icon name="arc" size={14} /> {t('path.showArc')}
              </Button>
            </div>
          )}
        </div>
        <aside className="text-sm leading-relaxed text-muted">
          <p>{t('path.help')}</p>
          {chosen && (
            <p className="mt-3 text-fg">
              {formatVerse(chosen.verses[0], lang)} → {formatVerse(chosen.verses[chosen.verses.length - 1], lang)}: {t('path.steps', { n: chosen.refs.length })}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
