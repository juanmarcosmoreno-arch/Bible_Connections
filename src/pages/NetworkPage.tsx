/**
 * NETWORK — Network Explorer. Book (66 nodes) and chapter (1,189 nodes) graphs with
 * precomputed exact metrics, optional recomputation for the active filters in a Web Worker,
 * and a verse-level ego network.
 */
import { useMemo, useRef, useState } from 'react';
import { referencesTouching } from '../analysis/filters.ts';
import { Button, Field, Icon, Segmented, Spinner, Toggle } from '../components/ui/index.tsx';
import { BOOKS, CHAPTERS, NT_START, VERSE_BOOK, formatChapter, formatRange, type Lang } from '../data/bibleStructure.ts';
import { GENRES } from '../data/books.ts';
import type { NetworkFile, NetworkNode } from '../graph/networkTypes.ts';
import { useData } from '../hooks/useData.tsx';
import { useNetwork } from '../hooks/useNetwork.ts';
import { formatNumber, useT } from '../i18n/index.ts';
import { useApp } from '../state/appState.ts';
import { focusBook, focusChapter, goToVerse } from '../state/navigation.ts';
import { categorical } from '../utils/colors.ts';
import { downloadDataUrl } from '../utils/download.ts';
import { graphCanvasDataUrl, NetworkGraph, type GraphLink, type GraphNode } from '../visualizations/NetworkExplorer/NetworkGraph.tsx';

type Level = 'book' | 'chapter' | 'verse';
type ColorBy = 'community' | 'testament' | 'genre';
type SizeBy = 'weightedDegree' | 'pageRank' | 'betweenness';
type SortKey = 'weightedDegree' | 'degree' | 'betweenness' | 'pageRank' | 'clustering' | 'community';

const TESTAMENT_COLORS = { OT: '#f59e0b', NT: '#4f7cff' };
const LINK_STEPS = [25, 50, 100, 200, 400, 800, 1600, 3200, 6400];

function nodeLabel(level: 'book' | 'chapter', id: number, lang: Lang) {
  return level === 'book' ? BOOKS[id].short[lang] : formatChapter(id, lang, true);
}
function nodeBookId(level: 'book' | 'chapter', id: number) {
  return level === 'book' ? id : CHAPTERS[id].bookId;
}

export default function NetworkPage() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const theme = useApp((s) => s.theme);
  const [level, setLevel] = useState<Level>('book');
  const [colorBy, setColorBy] = useState<ColorBy>('community');
  const [sizeBy, setSizeBy] = useState<SizeBy>('weightedDegree');
  const [useFilters, setUseFilters] = useState(false);
  const [linkIdx, setLinkIdx] = useState({ book: 3, chapter: 6 });
  const [selected, setSelected] = useState<number | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const netLevel = level === 'chapter' ? 'chapter' : 'book';
  const { file, computing, ms, error } = useNetwork(netLevel, useFilters);

  const changeLevel = (l: Level) => {
    setLevel(l);
    setSelected(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row" data-testid="network-page">
      <div className="relative min-h-[55vh] flex-1 overflow-hidden lg:min-h-0" ref={graphRef}>
        {level === 'verse' ? (
          <EgoNetwork theme={theme} useFilters={useFilters} />
        ) : file ? (
          <LevelGraph file={file} level={netLevel} colorBy={colorBy} sizeBy={sizeBy} maxLinks={LINK_STEPS[linkIdx[netLevel]]} selected={selected} onSelect={setSelected} theme={theme} />
        ) : null}
        {(computing || error) && level !== 'verse' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-bg/40 text-sm text-muted">
            {error ? error : (
              <>
                <Spinner /> {t('network.computing')}
              </>
            )}
          </div>
        )}
        <div className="absolute left-3 top-3 z-20 w-[260px] space-y-3 rounded-xl border border-line bg-panel/90 p-3 shadow-[var(--shadow)] backdrop-blur max-sm:w-[calc(100%-1.5rem)]">
          <Field label={t('network.level')}>
            <Segmented value={level} onChange={changeLevel} label={t('network.level')} size="xs" options={(['book', 'chapter', 'verse'] as const).map((v) => ({ value: v, label: t(`network.level.${v}`) }))} />
          </Field>
          {level !== 'verse' && (
            <>
              <Field label={t('network.colorBy')}>
                <Segmented value={colorBy} onChange={setColorBy} label={t('network.colorBy')} size="xs" options={(['community', 'testament', 'genre'] as const).map((v) => ({ value: v, label: t(`network.colorBy.${v}`) }))} />
              </Field>
              <Field label={t('network.sizeBy')}>
                <Segmented
                  value={sizeBy}
                  onChange={setSizeBy}
                  label={t('network.sizeBy')}
                  size="xs"
                  options={[
                    { value: 'weightedDegree', label: t('panel.weightedDegree') },
                    { value: 'pageRank', label: 'PageRank' },
                    { value: 'betweenness', label: t('panel.betweenness') },
                  ]}
                />
              </Field>
              <Field label={t('network.edgesShown', { n: formatNumber(Math.min(LINK_STEPS[linkIdx[netLevel]], file?.edges.length ?? 0), lang) })}>
                <input
                  type="range"
                  min={0}
                  max={LINK_STEPS.length - 1}
                  value={linkIdx[netLevel]}
                  onChange={(e) => setLinkIdx((s) => ({ ...s, [netLevel]: Number(e.target.value) }))}
                  className="w-full"
                  aria-label={t('network.edges')}
                  data-testid="link-slider"
                />
              </Field>
            </>
          )}
          <Toggle checked={useFilters} onChange={setUseFilters} label={<span className="text-xs">{t('network.useFilters')}</span>} />
          {useFilters && ms != null && <p className="text-[11px] text-muted">{t('network.recompute')}: {Math.round(ms)} ms</p>}
          <Button variant="outline" className="w-full !py-1 text-xs" onClick={() => { const url = graphCanvasDataUrl(graphRef.current); if (url) downloadDataUrl(url, `bible-connections-network-${level}.png`); }}>
            <Icon name="download" size={14} /> PNG
          </Button>
        </div>
      </div>

      <aside className="scroll-thin w-full shrink-0 overflow-y-auto border-line bg-panel/60 px-4 py-4 lg:w-[380px] lg:border-l" data-testid="network-side">
        {level === 'verse' ? (
          <p className="text-sm text-muted">{t('network.egoHint')}</p>
        ) : file ? (
          <NetworkSide file={file} level={netLevel} selected={selected} onSelect={setSelected} />
        ) : null}
        <p className="mt-6 text-[11px] leading-relaxed text-muted">{t('network.methods')}</p>
      </aside>
    </div>
  );
}

function nodeColor(colorBy: ColorBy, level: 'book' | 'chapter', n: NetworkNode): string {
  const b = BOOKS[nodeBookId(level, n.id)];
  if (colorBy === 'community') return categorical(n.community);
  if (colorBy === 'testament') return TESTAMENT_COLORS[b.testament];
  return categorical(GENRES.indexOf(b.genre));
}

function LevelGraph({ file, level, colorBy, sizeBy, maxLinks, selected, onSelect, theme }: { file: NetworkFile; level: 'book' | 'chapter'; colorBy: ColorBy; sizeBy: SizeBy; maxLinks: number; selected: number | null; onSelect: (id: number | null) => void; theme: 'dark' | 'light' }) {
  const lang = useApp((s) => s.lang);
  const nodes = useMemo<GraphNode[]>(() => {
    const max = Math.max(...file.nodes.map((n) => n[sizeBy])) || 1;
    const order = [...file.nodes].sort((a, b) => b[sizeBy] - a[sizeBy]);
    const important = new Set(order.slice(0, level === 'book' ? 66 : 24).map((n) => n.id));
    return file.nodes.map((n) => ({
      id: n.id,
      label: nodeLabel(level, n.id, lang),
      radius: (level === 'book' ? 4 : 1.6) + (level === 'book' ? 22 : 9) * Math.sqrt(n[sizeBy] / max),
      color: nodeColor(colorBy, level, n),
      important: important.has(n.id),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, level, sizeBy, colorBy]);
  // Labels change with the language without restarting the layout.
  nodes.forEach((n) => (n.label = nodeLabel(level, n.id, lang)));
  const links = useMemo<GraphLink[]>(() => {
    // Global top-K links, plus each node's strongest link so that no node is left isolated.
    const shown = file.edges.slice(0, maxLinks);
    const deg = new Map<number, number>();
    for (const [a, b] of shown) {
      deg.set(a, (deg.get(a) ?? 0) + 1);
      deg.set(b, (deg.get(b) ?? 0) + 1);
    }
    for (const e of file.edges.slice(maxLinks)) {
      if (!deg.get(e[0]) || !deg.get(e[1])) {
        shown.push(e);
        deg.set(e[0], (deg.get(e[0]) ?? 0) + 1);
        deg.set(e[1], (deg.get(e[1]) ?? 0) + 1);
      }
    }
    const max = shown[0]?.[2] ?? 1;
    return shown.map(([a, b, w]) => ({ source: a, target: b, weight: w, strength: Math.sqrt(w / max) }));
  }, [file, maxLinks]);
  return <NetworkGraph nodes={nodes} links={links} selected={selected} onSelect={onSelect} theme={theme} distance={level === 'book' ? 130 : 30} testId="network-graph" />;
}

function NetworkSide({ file, level, selected, onSelect }: { file: NetworkFile; level: 'book' | 'chapter'; selected: number | null; onSelect: (id: number | null) => void }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const [sort, setSort] = useState<SortKey>('weightedDegree');
  const g = file.graph;
  const node = selected != null ? file.nodes[selected] : null;
  const neighbours = useMemo(() => {
    if (selected == null) return [];
    return file.edges
      .filter(([a, b]) => a === selected || b === selected)
      .map(([a, b, w]) => ({ id: a === selected ? b : a, w }))
      .sort((x, y) => y.w - x.w)
      .slice(0, 12);
  }, [file, selected]);
  const communities = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const n of file.nodes) m.set(n.community, [...(m.get(n.community) ?? []), n.id]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [file]);
  const sorted = useMemo(() => [...file.nodes].sort((a, b) => (sort === 'community' ? a.community - b.community || b.weightedDegree - a.weightedDegree : b[sort] - a[sort])).slice(0, level === 'book' ? 66 : 60), [file, sort, level]);
  const rank = (key: SortKey, n: NetworkNode) => 1 + file.nodes.filter((m) => m[key] > n[key]).length;

  const H = ({ children }: { children: string }) => <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted first:mt-0">{children}</h3>;
  return (
    <div className="text-sm">
      <H>{t('network.graph')}</H>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt className="text-muted">{t('network.nodes')}</dt>
        <dd className="tabular-nums">{formatNumber(g.nodes, lang)}</dd>
        <dt className="text-muted">{t('network.edges')}</dt>
        <dd className="tabular-nums">{formatNumber(g.edges, lang)}</dd>
        <dt className="text-muted">{t('unit.references')}</dt>
        <dd className="tabular-nums">{formatNumber(g.totalWeight, lang)}</dd>
        <dt className="text-muted">{t('network.density')}</dt>
        <dd className="tabular-nums">{g.density.toFixed(3)}</dd>
        <dt className="text-muted">{t('network.modularity')}</dt>
        <dd className="tabular-nums">{g.modularity.toFixed(3)}</dd>
        <dt className="text-muted">{t('network.communities')}</dt>
        <dd className="tabular-nums">{g.communities}</dd>
        <dt className="text-muted">{t('panel.betweenness')}</dt>
        <dd>{g.betweenness.exact ? t('network.betweennessExact') : t('network.betweennessApprox', { k: g.betweenness.sources })}</dd>
      </dl>
      {file.edgesPruned && <p className="mt-2 text-[11px] text-muted">{t('network.prunedNote', { k: file.edgesPruned.perNode, total: formatNumber(file.edgesPruned.total, lang) })}</p>}

      {node && (
        <div className="mt-4 rounded-xl border border-line bg-bg/40 p-3" data-testid="network-node">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: categorical(node.community) }} />
            <h3 className="flex-1 text-base font-semibold">{level === 'book' ? BOOKS[node.id].name[lang] : formatChapter(node.id, lang)}</h3>
            <button type="button" className="text-muted hover:text-fg" onClick={() => onSelect(null)} aria-label={t('action.close')}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {(
              [
                ['weightedDegree', t('panel.weightedDegree'), formatNumber(node.weightedDegree, lang)],
                ['degree', t('panel.degree'), formatNumber(node.degree, lang)],
                ['pageRank', 'PageRank', node.pageRank.toFixed(4)],
                ['betweenness', t('panel.betweenness'), node.betweenness.toFixed(4)],
                ['clustering', t('panel.clustering'), node.clustering.toFixed(3)],
              ] as const
            ).map(([k, label, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd className="tabular-nums">
                  {v} <span className="text-muted">#{rank(k, node)}</span>
                </dd>
              </div>
            ))}
            <dt className="text-muted">{t('panel.community')}</dt>
            <dd>{node.community + 1}</dd>
          </dl>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('panel.topBooks')}</div>
          <ul className="mt-1 space-y-0.5">
            {neighbours.map((nb) => (
              <li key={nb.id} className="flex items-center justify-between text-xs">
                <button type="button" className="hover:text-accent" onClick={() => onSelect(nb.id)}>
                  {level === 'book' ? BOOKS[nb.id].name[lang] : formatChapter(nb.id, lang)}
                </button>
                <span className="tabular-nums text-muted">{formatNumber(nb.w, lang)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="!py-1 text-xs" onClick={() => (level === 'book' ? focusBook(node.id) : focusChapter(node.id))}>
              <Icon name="arc" size={14} /> {t('action.openArc')}
            </Button>
          </div>
        </div>
      )}

      <H>{t('network.communities')}</H>
      <ul className="space-y-2">
        {communities.map(([c, ids]) => (
          <li key={c}>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: categorical(c) }} />
              <span className="font-medium">
                {t('panel.community')} {c + 1}
              </span>
              <span className="text-muted">{t('network.members', { n: ids.length })}</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              {level === 'book'
                ? ids.map((id, k) => (
                    <button key={id} type="button" className="hover:text-fg" onClick={() => onSelect(id)}>
                      {BOOKS[id].short[lang]}
                      {k < ids.length - 1 ? ', ' : ''}
                    </button>
                  ))
                : summariseChapters(ids, lang)}
            </p>
          </li>
        ))}
      </ul>

      <H>{t('network.metrics')}</H>
      <div className="mb-2">
        <Segmented
          value={sort}
          onChange={setSort}
          label={t('network.sortBy')}
          size="xs"
          options={[
            { value: 'weightedDegree', label: t('panel.weightedDegree').split(' ')[0] },
            { value: 'pageRank', label: 'PR' },
            { value: 'betweenness', label: t('panel.betweenness').slice(0, 6) + '.' },
            { value: 'clustering', label: t('panel.clustering').slice(0, 5) + '.' },
          ]}
        />
      </div>
      <table className="w-full text-xs tabular-nums" data-testid="metrics-table">
        <thead className="text-left text-muted">
          <tr>
            <th className="py-1 font-medium">#</th>
            <th className="font-medium">{level === 'book' ? t('unit.book') : t('unit.chapter')}</th>
            <th className="text-right font-medium">{t('panel.weightedDegree').split(' ')[0]}</th>
            <th className="text-right font-medium">PR</th>
            <th className="text-right font-medium">BC</th>
            <th className="text-right font-medium">CC</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((n, k) => (
            <tr key={n.id} className={`cursor-pointer border-t border-line/60 hover:bg-panel-2/60 ${n.id === selected ? 'bg-panel-2' : ''}`} onClick={() => onSelect(n.id)}>
              <td className="py-1 text-muted">{k + 1}</td>
              <td className="flex items-center gap-1.5 py-1">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: categorical(n.community) }} />
                {nodeLabel(level, n.id, lang)}
              </td>
              <td className="text-right">{formatNumber(n.weightedDegree, lang)}</td>
              <td className="text-right">{(n.pageRank * 100).toFixed(2)}</td>
              <td className="text-right">{n.betweenness.toFixed(3)}</td>
              <td className="text-right">{n.clustering.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted">PR = PageRank × 100 · BC = {t('panel.betweenness')} · CC = {t('panel.clustering')}</p>
    </div>
  );
}

/** "Gen 1–50, Exod 1–12, …" summary of chapter ids grouped by book. */
function summariseChapters(ids: number[], lang: Lang): string {
  const byBook = new Map<number, number[]>();
  for (const id of ids) byBook.set(CHAPTERS[id].bookId, [...(byBook.get(CHAPTERS[id].bookId) ?? []), CHAPTERS[id].number]);
  const parts: string[] = [];
  for (const [b, chs] of [...byBook.entries()].sort((x, y) => y[1].length - x[1].length).slice(0, 14)) {
    parts.push(chs.length === BOOKS[b].chapterCount ? BOOKS[b].short[lang] : `${BOOKS[b].short[lang]} (${chs.length})`);
  }
  return parts.join(', ') + (byBook.size > 14 ? ', …' : '');
}

/* ------------------------------------------------------------- ego network */

function EgoNetwork({ theme, useFilters }: { theme: 'dark' | 'light'; useFilters: boolean }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const selection = useApp((s) => s.selection);
  const { cols, filtered } = useData();
  const [picked, setPicked] = useState<number | null>(null);
  const span = selection?.kind === 'passage' ? [selection.start, selection.end] : selection?.kind === 'reference' && cols ? [cols.sourceStart[selection.index], cols.sourceEnd[selection.index]] : null;
  const N = 40;

  const graph = useMemo(() => {
    if (!cols || !span) return null;
    const [s, e] = span;
    const refs = referencesTouching(cols, useFilters ? filtered ?? null : null, s, e, 'both');
    const others = new Map<number, { start: number; end: number; w: number }>();
    for (const i of refs) {
      const srcIn = cols.sourceStart[i] <= e && cols.sourceEnd[i] >= s;
      const os = srcIn ? cols.targetStart[i] : cols.sourceStart[i];
      const oe = srcIn ? cols.targetEnd[i] : cols.sourceEnd[i];
      if (os >= s && os <= e) continue;
      const cur = others.get(os);
      if (cur) cur.w += Math.max(1, cols.votes[i]);
      else if (others.size < N) others.set(os, { start: os, end: oe, w: Math.max(1, cols.votes[i]) });
    }
    const center: GraphNode = { id: -1, label: formatRange(s, e, lang, true), radius: 16, color: '#ffffff', important: true };
    const maxW = Math.max(1, ...[...others.values()].map((o) => o.w));
    const nodes: GraphNode[] = [center];
    const links: GraphLink[] = [];
    for (const o of others.values()) {
      nodes.push({ id: o.start, label: formatRange(o.start, o.end, lang, true), radius: 4 + 9 * Math.sqrt(o.w / maxW), color: o.start >= NT_START ? TESTAMENT_COLORS.NT : TESTAMENT_COLORS.OT, important: true });
      links.push({ source: -1, target: o.start, weight: o.w, strength: Math.sqrt(o.w / maxW) });
    }
    // Links between the neighbours themselves.
    const idx = new Map<number, number>();
    for (const o of others.values()) for (let g = o.start; g <= o.end; g++) idx.set(g, o.start);
    const seen = new Set<string>();
    for (let i = 0; i < cols.count; i++) {
      const a = idx.get(cols.sourceStart[i]);
      if (a === undefined) continue;
      const b = idx.get(cols.targetStart[i]);
      if (b === undefined || a === b) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: a, target: b, weight: 1, strength: 0.15, muted: true });
    }
    return { nodes, links, count: others.size, center: [s, e] as const };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, filtered, useFilters, span?.[0], span?.[1], lang]);

  if (!graph) return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">{t('network.egoHint')}</div>;
  if (graph.nodes[0]) graph.nodes[0].color = theme === 'dark' ? '#f5f5f5' : '#14161c';
  return (
    <>
      <NetworkGraph
        nodes={graph.nodes}
        links={graph.links}
        selected={picked}
        onSelect={(id) => {
          setPicked(id);
          if (id != null && id >= 0) {
            const n = graph.nodes.find((x) => x.id === id);
            if (n) goToVerse(id);
          }
        }}
        theme={theme}
        distance={110}
        testId="ego-graph"
      />
      <p className="absolute bottom-3 left-3 right-3 z-10 text-center text-[11px] text-muted">
        {t('network.egoNote', { n: graph.count })} · {BOOKS[VERSE_BOOK[graph.center[0]]].name[lang]}
      </p>
    </>
  );
}
