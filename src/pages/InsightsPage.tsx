/**
 * INSIGHTS — statistics computed from the full dataset (build time), the 66 × 66 connection
 * matrix and the Old ↔ New Testament comparison.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Statistics } from '../analysis/statistics.ts';
import { ConnectionList, type ConnectionItem } from '../components/panels/ConnectionList.tsx';
import { Button, Icon, Segmented, Spinner, Toggle } from '../components/ui/index.tsx';
import { BOOKS, CHAPTERS, VERSE_BOOK, bookName, bookSpan, formatChapter, formatRange } from '../data/bibleStructure.ts';
import { loadNetwork, loadStatistics } from '../data/loader.ts';
import { nodeOf, type CorrLevel } from '../analysis/correlation.ts';
import { useCorrelation } from '../hooks/useCorrelation.ts';
import { CorrelationMatrix, correlationColor, nodeName } from '../visualizations/CorrelationMatrix/CorrelationMatrix.tsx';
import { ChordDiagram, symmetricCounts } from '../visualizations/ChordDiagram/ChordDiagram.tsx';
import { GENRES } from '../data/books.ts';
import { categorical } from '../utils/colors.ts';
import { useData } from '../hooks/useData.tsx';
import { formatNumber, useT } from '../i18n/index.ts';
import { actions, useApp } from '../state/appState.ts';
import { focusBook, focusChapter, focusPassage } from '../state/navigation.ts';
import { BarChart, RankBars } from '../visualizations/charts/BarChart.tsx';
import { Heatmap, matrixValues, type MatrixScale } from '../visualizations/ConnectionMatrix/Heatmap.tsx';
import { NT_BOOKS, OT_BOOKS, TestamentFlow, flowCounts, type FlowDirection } from '../visualizations/TestamentComparison/TestamentFlow.tsx';
import { arcColor } from '../utils/colors.ts';
import { downloadText } from '../utils/download.ts';

type Tab = 'overview' | 'matrix' | 'correlation' | 'chord' | 'testaments';

export default function InsightsPage() {
  const t = useT();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => {
    loadStatistics().then(setStats).catch(() => {});
  }, []);
  return (
    <div className="scroll-thin h-full overflow-y-auto" data-testid="insights-page">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('insights.title')}</h1>
            <p className="mt-1 text-sm text-muted">{t('insights.note.anchor')}</p>
          </div>
          <div className="w-full max-w-2xl">
            <Segmented
              value={tab}
              onChange={setTab}
              label={t('insights.title')}
              options={[
                { value: 'overview', label: t('insights.overview') },
                { value: 'matrix', label: t('insights.matrix') },
                { value: 'correlation', label: t('insights.correlation') },
                { value: 'chord', label: t('insights.chord') },
                { value: 'testaments', label: t('insights.testaments') },
              ]}
            />
          </div>
        </div>
        {!stats ? (
          <div className="mt-16 flex justify-center">
            <Spinner />
          </div>
        ) : tab === 'overview' ? (
          <Overview stats={stats} />
        ) : tab === 'matrix' ? (
          <Matrix stats={stats} />
        ) : tab === 'correlation' ? (
          <Correlation />
        ) : tab === 'chord' ? (
          <Chords stats={stats} />
        ) : (
          <Testaments stats={stats} />
        )}
      </div>
    </div>
  );
}

function Card({ title, children, className = '', action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel/60 p-4 sm:p-5 ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/60 px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function pct(n: number, d: number) {
  return `${((n / d) * 100).toFixed(1)}%`;
}

function Overview({ stats }: { stats: Statistics }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const T = stats.totals;
  const cross = stats.testaments['OT-NT'] + stats.testaments['NT-OT'];
  const books = [...stats.books].sort((a, b) => b.out + b.in - (a.out + a.in)).slice(0, 15);
  const exportStats = () => downloadText(JSON.stringify(stats, null, 2), 'bible-connections-statistics.json', 'application/json');
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="kpis">
        <Kpi label={t('insights.kpi.references')} value={formatNumber(T.references, lang)} />
        <Kpi label={t('insights.kpi.books')} value={formatNumber(T.books, lang)} sub={`${formatNumber(T.chapters, lang)} ${t('unit.chapters')}`} />
        <Kpi label={t('insights.kpi.verses')} value={formatNumber(T.versesWithConnections, lang)} sub={`${pct(T.versesWithConnections, T.verses)} ${t('misc.of')} ${formatNumber(T.verses, lang)}`} />
        <Kpi label={t('insights.kpi.avg')} value={T.avgConnectionsPerVerse.toFixed(1)} sub={`${t('panel.outgoing')} + ${t('panel.incoming').toLowerCase()}`} />
        <Kpi label={t('insights.kpi.cross')} value={formatNumber(cross, lang)} sub={pct(cross, T.references)} />
        <Kpi label={t('insights.kpi.tsk')} value={formatNumber(stats.origin.tsk + stats.origin.tskReverse, lang)} sub={pct(stats.origin.tsk + stats.origin.tskReverse, T.references)} />
        <Kpi label={t('insights.kpi.openbible')} value={formatNumber(stats.origin.openbible, lang)} sub={pct(stats.origin.openbible, T.references)} />
        <Kpi label={t('insights.kpi.ranges')} value={formatNumber(T.rangeReferences, lang)} sub={pct(T.rangeReferences, T.references)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t('insights.rank.books')}>
          <RankBars lang={lang} items={books.map((b) => ({ key: b.id, label: bookName(b.id, lang), value: b.out + b.in, sub: `${b.out} → · ${b.in} ←` }))} onPick={(k) => focusBook(Number(k))} />
        </Card>
        <Card title={t('insights.rank.chapters')}>
          <RankBars lang={lang} items={stats.topChapters.slice(0, 15).map((c) => ({ key: c.chapter, label: formatChapter(c.chapter, lang), value: c.count }))} onPick={(k) => focusChapter(Number(k))} />
        </Card>
        <Card title={t('insights.rank.verses')}>
          <RankBars lang={lang} items={stats.topVerses.slice(0, 15).map((v) => ({ key: v.verse, label: formatRange(v.verse, v.verse, lang), value: v.total, sub: `${v.out} → · ${v.in} ←` }))} onPick={(k) => focusPassage('verse', Number(k), Number(k))} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t('insights.dist.distance')}>
          <BarChart
            title={t('insights.dist.distance')}
            lang={lang}
            bars={stats.distance.histogram.map((h, i, arr) => ({ label: h.label, value: h.count, color: arcColor(i / (arr.length - 1)) }))}
          />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            {(['near', 'mid', 'far'] as const).map((k, i) => (
              <div key={k} className="rounded-lg border border-line px-2 py-1.5">
                <div className="flex items-center justify-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: arcColor([0.15, 0.5, 0.88][i]) }} />
                  {t(`filters.distance.${k}`)}
                </div>
                <div className="font-semibold tabular-nums">{pct(stats.distance.classes[k], T.references)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t('insights.sources')}>
          <StackBar
            parts={[
              { label: t('source.tsk'), value: stats.origin.tsk, color: '#4f7cff' },
              { label: t('source.tsk-reverse'), value: stats.origin.tskReverse, color: '#22b8cf' },
              { label: t('source.openbible'), value: stats.origin.openbible, color: '#f59e0b' },
            ]}
          />
        </Card>
        <Card title={t('insights.dist.scope')}>
          <StackBar
            parts={[
              { label: t('insights.scope.sameChapter'), value: stats.scope.sameChapter, color: arcColor(0.05) },
              { label: t('insights.scope.sameBook'), value: stats.scope.sameBook, color: arcColor(0.35) },
              { label: t('insights.scope.otherBook'), value: stats.scope.otherBook, color: arcColor(0.8) },
            ]}
          />
        </Card>
        <Card title={t('insights.dist.testaments')}>
          <StackBar
            parts={[
              { label: t('filters.testament.OT-OT'), value: stats.testaments['OT-OT'], color: '#f59e0b' },
              { label: t('insights.testaments.otnt'), value: stats.testaments['OT-NT'], color: '#ec4899' },
              { label: t('insights.testaments.ntot'), value: stats.testaments['NT-OT'], color: '#a855f7' },
              { label: t('filters.testament.NT-NT'), value: stats.testaments['NT-NT'], color: '#4f7cff' },
            ]}
          />
        </Card>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={exportStats}>
          <Icon name="download" size={14} /> {t('export.stats')}
        </Button>
      </div>
    </div>
  );
}

function StackBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const lang = useApp((s) => s.lang);
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
            <span className="text-muted">{p.label}</span>
            <span className="ml-auto tabular-nums">
              {formatNumber(p.value, lang)} · {pct(p.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Matrix({ stats }: { stats: Statistics }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const { cols } = useData();
  const [scale, setScale] = useState<MatrixScale>('absolute');
  const [cell, setCell] = useState<[number, number] | null>(null);
  const values = useMemo(() => matrixValues(stats.matrix.counts, scale), [stats, scale]);
  const items: ConnectionItem[] = useMemo(() => {
    if (!cols || !cell) return [];
    const out: ConnectionItem[] = [];
    for (let i = 0; i < cols.count; i++) if (VERSE_BOOK[cols.sourceStart[i]] === cell[0] && VERSE_BOOK[cols.targetStart[i]] === cell[1]) out.push({ index: i, other: 'target' });
    return out;
  }, [cols, cell]);
  const help = { absolute: t('insights.matrix.help.absolute'), normalized: t('insights.matrix.help.normalized') }[scale];
  const showInArc = () => {
    if (!cell) return;
    actions.setFilters({ books: [cell[0]], targetBooks: [cell[1]], bookDirection: 'out' });
    actions.setRoute('arc');
  };
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted">
            {t('insights.matrix.rows')} · {t('insights.matrix.cols')}
          </div>
          <div className="w-full max-w-sm">
            <Segmented value={scale} onChange={setScale} label={t('insights.matrix.scale')} size="xs" options={(['absolute', 'normalized'] as const).map((v) => ({ value: v, label: t(`insights.matrix.${v}`) }))} />
          </div>
        </div>
        <Heatmap counts={stats.matrix.counts} scale={scale} selected={cell} onSelect={setCell} />
        <p className="mt-3 text-[11px] leading-relaxed text-muted">{help} Colour: log scale.</p>
      </Card>
      <Card title={cell ? t('insights.matrix.cell', { a: bookName(cell[0], lang), b: bookName(cell[1], lang) }) : t('insights.matrix')}>
        {cell ? (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-line px-2 py-1.5">
                <div className="text-muted">{t('unit.references')}</div>
                <div className="text-lg font-semibold tabular-nums">{formatNumber(stats.matrix.counts[cell[0] * 66 + cell[1]], lang)}</div>
              </div>
              <div className="rounded-lg border border-line px-2 py-1.5">
                <div className="text-muted">{t(`insights.matrix.${scale}`)}</div>
                <div className="text-lg font-semibold tabular-nums">{scale === 'normalized' ? values[cell[0] * 66 + cell[1]].toFixed(2) : formatNumber(values[cell[0] * 66 + cell[1]], lang)}</div>
              </div>
            </div>
            <Button variant="outline" className="mb-3 w-full" onClick={showInArc} data-testid="matrix-show-arc">
              <Icon name="arc" size={14} /> {t('action.openArc')}
            </Button>
            <ConnectionList items={items} pageSize={25} showSelf />
          </>
        ) : (
          <p className="text-sm text-muted">{t('insights.matrix.selectCell')}</p>
        )}
      </Card>
    </div>
  );
}

function Testaments({ stats }: { stats: Statistics }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const [direction, setDirection] = useState<FlowDirection>('both');
  const [selected, setSelected] = useState<number | null>(BOOKS.find((b) => b.code === 'Isa')!.id);
  const flows = useMemo(() => flowCounts(stats.matrix.counts, direction), [stats, direction]);
  const partners = useMemo(() => {
    if (selected == null) return [];
    const oi = OT_BOOKS.findIndex((b) => b.id === selected);
    if (oi >= 0) return NT_BOOKS.map((b, j) => ({ id: b.id, v: flows[oi][j] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const ni = NT_BOOKS.findIndex((b) => b.id === selected);
    return OT_BOOKS.map((b, i) => ({ id: b.id, v: flows[i][ni] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  }, [selected, flows]);
  const showInArc = () => {
    if (selected == null) return;
    actions.setFilters({ testament: 'cross', books: [selected], targetBooks: [], bookDirection: 'both' });
    actions.setRoute('arc');
  };
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted">{t('insights.testaments.select')}</div>
          <div className="w-full max-w-xs">
            <Segmented
              value={direction}
              onChange={setDirection}
              label={t('insights.testaments.direction')}
              size="xs"
              options={[
                { value: 'ot-nt', label: t('insights.testaments.otnt') },
                { value: 'nt-ot', label: t('insights.testaments.ntot') },
                { value: 'both', label: t('insights.testaments.both') },
              ]}
            />
          </div>
        </div>
        <div className="flex justify-center text-fg">
          <TestamentFlow counts={stats.matrix.counts} direction={direction} selected={selected} onSelect={setSelected} lang={lang} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] uppercase tracking-wider text-muted">
          <span>{t('testament.OT')}</span>
          <span>{t('testament.NT')}</span>
        </div>
      </Card>
      <Card title={selected != null ? t('insights.testaments.top', { name: bookName(selected, lang) }) : t('insights.testaments')}>
        {selected != null ? (
          <>
            <RankBars lang={lang} items={partners.slice(0, 20).map((p) => ({ key: p.id, label: bookName(p.id, lang), value: p.v }))} onPick={(k) => setSelected(Number(k))} color="var(--accent)" />
            <Button variant="outline" className="mt-4 w-full" onClick={showInArc} data-testid="testament-show-arc">
              <Icon name="arc" size={14} /> {t('action.openArc')}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">{t('insights.testaments.select')}</p>
        )}
      </Card>
    </div>
  );
}


function Correlation() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const theme = useApp((s) => s.theme);
  const { cols } = useData();
  const [level, setLevel] = useState<CorrLevel>('book');
  const [bookId, setBookId] = useState(BOOKS.find((b) => b.code === 'John')!.id);
  const [orderBy, setOrderBy] = useState<'canonical' | 'communities'>('canonical');
  const [useFilters, setUseFilters] = useState(false);
  const [cell, setCell] = useState<[number, number] | null>(null);
  const range = useMemo<[number, number] | undefined>(() => (level === 'verse' ? bookSpan(bookId) : undefined), [level, bookId]);
  const { result, computing } = useCorrelation(level, useFilters, range);
  const [communities, setCommunities] = useState<number[] | null>(null);
  useEffect(() => {
    setCommunities(null);
    if (level !== 'verse') loadNetwork(level).then((f) => setCommunities(f.nodes.map((n) => n.community))).catch(() => {});
  }, [level]);
  const n = level === 'book' ? 66 : level === 'chapter' ? CHAPTERS.length : range![1] - range![0] + 1;
  const offset = range ? range[0] : 0;
  const order = useMemo(() => {
    const o = Int32Array.from({ length: n }, (_, i) => i);
    if (orderBy === 'communities' && communities && level !== 'verse') o.sort((a, b) => communities[a] - communities[b] || a - b);
    return o;
  }, [n, orderBy, communities, level]);

  // Pair details; a and b are row indices (global id = offset + index).
  const pair = useMemo(() => {
    if (!cell || !result || !cols || result.n !== n) return null;
    const [a, b] = cell;
    const ga = offset + a, gb = offset + b;
    let between = 0;
    for (let i = 0; i < cols.count; i++) {
      const s = nodeOf(level, cols.sourceStart[i]), tt = nodeOf(level, cols.targetStart[i]);
      if ((s === ga && tt === gb) || (s === gb && tt === ga)) between++;
    }
    const similar = Array.from({ length: result.n }, (_, k) => k)
      .filter((k) => k !== a && !Number.isNaN(result.matrix[a * result.n + k]))
      .sort((x, y) => result.matrix[a * result.n + y] - result.matrix[a * result.n + x])
      .slice(0, 10);
    return { a, b, ga, gb, r: result.matrix[a * result.n + b], between, similar };
  }, [cell, result, cols, level, n, offset]);

  const showInArc = () => {
    if (!pair) return;
    if (level === 'book') {
      actions.setFilters({ books: [pair.ga], targetBooks: [pair.gb], bookDirection: 'both' });
      actions.setRoute('arc');
    } else if (level === 'chapter') focusChapter(pair.ga);
    else focusPassage('verse', pair.ga, pair.ga);
  };
  const color = correlationColor(theme);
  const legend = `linear-gradient(90deg, ${Array.from({ length: 11 }, (_, i) => color(i / 5 - 1)).join(', ')})`;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" data-testid="correlation-tab">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="w-full max-w-lg">
            <Segmented
              value={level}
              onChange={(v) => {
                setLevel(v);
                setCell(null);
              }}
              label={t('insights.corr.level')}
              size="xs"
              options={[
                { value: 'book', label: t('insights.corr.books') },
                { value: 'chapter', label: t('insights.corr.chapters') },
                { value: 'verse', label: t('insights.corr.verses') },
              ]}
            />
          </div>
          {level === 'verse' ? (
            <select
              value={bookId}
              onChange={(e) => {
                setBookId(Number(e.target.value));
                setCell(null);
              }}
              className="rounded-lg border border-line bg-bg px-2 py-1 text-xs"
              aria-label={t('explore.chooseBook')}
              data-testid="correlation-book"
            >
              {BOOKS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name[lang]} ({formatNumber(b.verseCount, lang)})
                </option>
              ))}
            </select>
          ) : (
            <div className="w-56">
              <Segmented
                value={orderBy}
                onChange={setOrderBy}
                label={t('insights.corr.order')}
                size="xs"
                options={[
                  { value: 'canonical', label: t('insights.corr.canonical') },
                  { value: 'communities', label: t('insights.corr.communities') },
                ]}
              />
            </div>
          )}
          <div className="w-64">
            <Toggle checked={useFilters} onChange={setUseFilters} label={<span className="text-xs">{t('network.useFilters')}</span>} />
          </div>
        </div>
        {result && !computing && result.n === n ? (
          <CorrelationMatrix matrix={result.matrix} n={result.n} offset={offset} level={level} order={order} theme={theme} lang={lang} selected={cell} onSelect={setCell} />
        ) : (
          <div className="flex h-80 items-center justify-center gap-2 text-sm text-muted">
            <Spinner /> {t('insights.corr.computing', { n: formatNumber(n, lang) })}
          </div>
        )}
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted">
          <span>−1</span>
          <span className="h-2 w-48 rounded-full" style={{ background: legend }} />
          <span>+1</span>
          <span className="ml-auto">r (Pearson)</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">{t('insights.corr.help')}</p>
        {level === 'verse' && <p className="mt-1 text-[11px] leading-relaxed text-muted">{t('insights.corr.verseNote')}</p>}
      </Card>
      <Card title={pair ? `${nodeName(level, pair.ga, lang)} ↔ ${nodeName(level, pair.gb, lang)}` : t('insights.correlation')}>
        {pair && result ? (
          <div data-testid="correlation-pair">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-line px-2 py-1.5">
                <div className="text-muted">r</div>
                <div className="text-lg font-semibold tabular-nums">{Number.isNaN(pair.r) ? '—' : pair.r.toFixed(3)}</div>
              </div>
              <div className="rounded-lg border border-line px-2 py-1.5">
                <div className="text-muted">{t('insights.corr.between')}</div>
                <div className="text-lg font-semibold tabular-nums">{formatNumber(pair.between, lang)}</div>
              </div>
            </div>
            <Button variant="outline" className="mt-3 w-full" onClick={showInArc}>
              <Icon name="arc" size={14} /> {t('action.openArc')}
            </Button>
            <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('insights.corr.similar', { name: nodeName(level, pair.ga, lang) })}</h3>
            <ol className="space-y-1">
              {pair.similar.map((k) => (
                <li key={k} className="flex items-center justify-between text-sm">
                  <button type="button" className="hover:text-accent" onClick={() => setCell([pair.a, k])}>
                    {nodeName(level, offset + k, lang)}
                  </button>
                  <span className="tabular-nums text-xs text-muted">{result.matrix[pair.a * result.n + k].toFixed(3)}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="text-sm text-muted">{t('insights.corr.select')}</p>
        )}
      </Card>
    </div>
  );
}

function Chords({ stats }: { stats: Statistics }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const { cols, filtered } = useData();
  const [selected, setSelected] = useState<number | null>(BOOKS.find((b) => b.code === 'Isa')!.id);
  const [useFilters, setUseFilters] = useState(false);
  const [minRibbon, setMinRibbon] = useState(20);
  const counts = useMemo(() => {
    if (!useFilters || !cols || !filtered) return stats.matrix.counts;
    const c = new Array(66 * 66).fill(0);
    for (const i of filtered) c[VERSE_BOOK[cols.sourceStart[i]] * 66 + VERSE_BOOK[cols.targetStart[i]]]++;
    return c;
  }, [useFilters, cols, filtered, stats]);
  const partners = useMemo(() => {
    if (selected == null) return [];
    const sym = symmetricCounts(counts);
    return sym[selected].map((v, b) => ({ b, v })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 15);
  }, [counts, selected]);
  const showInArc = () => {
    if (selected == null) return;
    actions.setFilters({ books: [selected], targetBooks: [], bookDirection: 'both' });
    actions.setRoute('arc');
  };
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="chord-tab">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-muted">
            {t('insights.chord.min')}: {minRibbon}
            <input type="range" min={0} max={300} step={10} value={minRibbon} onChange={(e) => setMinRibbon(Number(e.target.value))} aria-label={t('insights.chord.min')} />
          </label>
          <div className="w-64">
            <Toggle checked={useFilters} onChange={setUseFilters} label={<span className="text-xs">{t('network.useFilters')}</span>} />
          </div>
        </div>
        <div className="flex justify-center text-fg">
          <ChordDiagram counts={counts} selected={selected} onSelect={setSelected} lang={lang} minRibbon={minRibbon} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          {GENRES.map((g, i) => (
            <span key={g} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: categorical(i) }} />
              {t(`genre.${g}`)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">{t('insights.chord.help')}</p>
      </Card>
      <Card title={selected != null ? t('insights.testaments.top', { name: bookName(selected, lang) }) : t('insights.chord')}>
        {selected != null ? (
          <>
            <RankBars lang={lang} items={partners.map((p) => ({ key: p.b, label: bookName(p.b, lang), value: p.v }))} onPick={(k) => setSelected(Number(k))} />
            <Button variant="outline" className="mt-4 w-full" onClick={showInArc}>
              <Icon name="arc" size={14} /> {t('action.openArc')}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">{t('insights.chord.select')}</p>
        )}
      </Card>
    </div>
  );
}
