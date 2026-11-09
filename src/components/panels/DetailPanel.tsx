/**
 * Contextual exploration panel with four sections: Passage, Connections, Network, Context.
 * Side panel on large screens, bottom sheet on small ones.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { referencesTouching } from '../../analysis/filters.ts';
import {
  BOOKS,
  CHAPTERS,
  NT_START,
  TOTAL_VERSES,
  VERSE_BOOK,
  VERSE_CHAPTER,
  VERSE_NUMBER,
  bookName,
  formatChapter,
  formatRange,
} from '../../data/bibleStructure.ts';
import { loadNetwork } from '../../data/loader.ts';
import type { NetworkFile } from '../../graph/networkTypes.ts';
import { useData } from '../../hooks/useData.tsx';
import { formatNumber, useT } from '../../i18n/index.ts';
import { actions, useApp, type Selection } from '../../state/appState.ts';
import { focusBook, focusChapter, focusPassage, focusTestament, goToVerse } from '../../state/navigation.ts';
import { arcColor, categorical } from '../../utils/colors.ts';
import { Icon, IconButton, Segmented, Toggle } from '../ui/index.tsx';
import { ConnectionList, type ConnectionItem } from './ConnectionList.tsx';
import { PassageText } from './PassageText.tsx';

type Tab = 'passage' | 'connections' | 'network' | 'context';

export function DetailPanel() {
  const t = useT();
  const open = useApp((s) => s.panelOpen);
  const selection = useApp((s) => s.selection);
  const [tab, setTab] = useState<Tab>('passage');
  const [expanded, setExpanded] = useState(false);

  if (!open) return null;

  const tabs: { value: Tab; label: string }[] = [
    { value: 'passage', label: t('panel.passage') },
    { value: 'connections', label: t('panel.connections') },
    { value: 'network', label: t('panel.network') },
    { value: 'context', label: t('panel.context') },
  ];

  return (
    <aside
      className={`z-20 flex flex-col border-line bg-panel/95 backdrop-blur
        max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:rounded-t-2xl max-lg:border-t max-lg:shadow-[var(--shadow)] max-lg:pb-[env(safe-area-inset-bottom)]
        ${expanded ? 'max-lg:h-[85dvh]' : selection ? 'max-lg:h-[46dvh]' : 'max-lg:hidden'}
        lg:relative lg:h-full lg:w-[400px] lg:shrink-0 lg:border-l`}
      aria-label={t('panel.selection')}
      data-testid="detail-panel"
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-2 lg:pt-3">
        <button type="button" className="mx-auto h-1.5 w-10 rounded-full bg-line lg:hidden" onClick={() => setExpanded((e) => !e)} aria-label="Resize" />
      </div>
      {selection ? (
        <>
          <SelectionHeader selection={selection} />
          <div className="px-4 pb-2">
            <Segmented value={tab} onChange={setTab} options={tabs} label={t('panel.selection')} size="xs" />
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-6" data-testid="panel-body">
            {selection.kind === 'reference' ? <ReferenceBody index={selection.index} tab={tab} /> : <PassageBody sel={selection} tab={tab} />}
          </div>
        </>
      ) : (
        <div className="flex items-start justify-between gap-3 px-4 pb-4">
          <p className="text-sm leading-relaxed text-muted">{t('panel.empty')}</p>
          <IconButton label={t('action.hidePanel')} onClick={() => actions.setPanelOpen(false)}>
            <Icon name="close" />
          </IconButton>
        </div>
      )}
    </aside>
  );
}

function SelectionHeader({ selection }: { selection: Selection }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const { cols } = useData();
  let title: ReactNode = '';
  let unit = '';
  let prev: (() => void) | null = null;
  let next: (() => void) | null = null;
  if (selection.kind === 'reference') {
    if (cols) {
      const i = selection.index;
      title = (
        <>
          {formatRange(cols.sourceStart[i], cols.sourceEnd[i], lang)} <span className="text-muted">→</span> {formatRange(cols.targetStart[i], cols.targetEnd[i], lang)}
        </>
      );
    }
    unit = t('panel.connections');
  } else {
    const { start, end } = selection;
    if (selection.unit === 'verse' || selection.unit === 'range') {
      title = formatRange(start, end, lang);
      unit = selection.unit === 'verse' ? t('unit.verse') : t('panel.range');
      if (start > 0) prev = () => goToVerse(start - 1);
      if (end < TOTAL_VERSES - 1) next = () => goToVerse(end + 1);
    } else if (selection.unit === 'chapter') {
      const c = VERSE_CHAPTER[start];
      title = formatChapter(c, lang);
      unit = t('unit.chapter');
      if (c > 0) prev = () => focusChapter(c - 1);
      if (c < CHAPTERS.length - 1) next = () => focusChapter(c + 1);
    } else if (selection.unit === 'book') {
      const b = VERSE_BOOK[start];
      title = bookName(b, lang);
      unit = t('unit.book');
      if (b > 0) prev = () => focusBook(b - 1);
      if (b < 65) next = () => focusBook(b + 1);
    } else {
      title = start === 0 ? t('testament.OT') : t('testament.NT');
      unit = '';
      prev = start === 0 ? null : () => focusTestament('OT');
      next = start === 0 ? () => focusTestament('NT') : null;
    }
  }
  const prevLabel = selection.kind === 'passage' && selection.unit === 'chapter' ? t('action.prevChapter') : t('action.prevVerse');
  const nextLabel = selection.kind === 'passage' && selection.unit === 'chapter' ? t('action.nextChapter') : t('action.nextVerse');
  return (
    <div className="flex items-start gap-1 px-4 pb-3">
      <div className="min-w-0 flex-1">
        {unit && <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{unit}</div>}
        <h2 className="text-xl font-semibold leading-tight tracking-tight" data-testid="selection-title">
          {title}
        </h2>
      </div>
      <IconButton label={prevLabel} onClick={prev ?? undefined} disabled={!prev} data-testid="prev-passage">
        <Icon name="left" />
      </IconButton>
      <IconButton label={nextLabel} onClick={next ?? undefined} disabled={!next} data-testid="next-passage">
        <Icon name="right" />
      </IconButton>
      <IconButton label={t('action.hidePanel')} onClick={() => actions.setPanelOpen(false)} className="hidden lg:inline-flex" data-testid="hide-panel">
        <Icon name="panel" />
      </IconButton>
      <IconButton label={t('action.clearSelection')} onClick={actions.clearSelection} data-testid="clear-selection">
        <Icon name="close" />
      </IconButton>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-bg/40 px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-lg font-semibold tabular-nums tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted first:mt-1">{children}</h3>;
}

function useNetworkFile(level: 'book' | 'chapter' | null): NetworkFile | null {
  const [file, setFile] = useState<NetworkFile | null>(null);
  useEffect(() => {
    if (!level) return;
    let alive = true;
    loadNetwork(level).then((f) => alive && setFile(f)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [level]);
  return file;
}

/* ------------------------------------------------------------------ passage */

function PassageBody({ sel, tab }: { sel: Extract<Selection, { kind: 'passage' }>; tab: Tab }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const direction = useApp((s) => s.selectionDirection);
  const { cols, filteredMask, degrees } = useData();
  const [onlyVisible, setOnlyVisible] = useState(false);
  const { start, end } = sel;

  const all = useMemo(() => (cols ? referencesTouching(cols, null, start, end, direction) : new Uint32Array()), [cols, start, end, direction]);
  const items: ConnectionItem[] = useMemo(() => {
    if (!cols) return [];
    const out: ConnectionItem[] = [];
    for (const i of all) {
      if (onlyVisible && filteredMask && !filteredMask[i]) continue;
      const srcIn = cols.sourceStart[i] <= end && cols.sourceEnd[i] >= start;
      out.push({ index: i, other: srcIn && direction !== 'in' ? 'target' : 'source' });
    }
    return out;
  }, [all, cols, onlyVisible, filteredMask, start, end, direction]);
  const hidden = useMemo(() => (filteredMask ? all.reduce((a, i) => a + (filteredMask[i] ? 0 : 1), 0) : 0), [all, filteredMask]);

  const directionControl = (
    <div className="mb-3">
      <Segmented
        value={direction}
        onChange={actions.setSelectionDirection}
        label={t('filters.direction')}
        size="xs"
        options={[
          { value: 'both', label: t('filters.direction.both') },
          { value: 'out', label: t('panel.outgoing') },
          { value: 'in', label: t('panel.incoming') },
        ]}
      />
    </div>
  );

  if (tab === 'passage') {
    const showEnd = sel.unit === 'book' || sel.unit === 'testament' ? Math.min(end, start + 9) : end;
    return (
      <div>
        <PassageText start={start} end={showEnd} maxVerses={sel.unit === 'chapter' ? 176 : 40} />
        {showEnd < end && (
          <a href="#/explore" className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
            {t('action.openExplore')} <Icon name="arrow" size={14} />
          </a>
        )}
        <SectionTitle>{t('panel.connections')}</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('panel.total')} value={formatNumber(all.length, lang)} />
          <Stat label={t('panel.maxVotes')} value={formatNumber(all.length && cols ? cols.votes[all[0]] : 0, lang)} />
          <Stat label={t('panel.hidden')} value={formatNumber(hidden, lang)} />
        </div>
        <div className="mt-3">
          {directionControl}
          <ConnectionList items={items.slice(0, 8)} pageSize={8} />
        </div>
      </div>
    );
  }

  if (tab === 'connections') {
    return (
      <div>
        {directionControl}
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
          <span>
            {formatNumber(items.length, lang)} {t('unit.connections')}
            {hidden > 0 && !onlyVisible ? ` · ${t('panel.hiddenByFilters', { n: formatNumber(hidden, lang) })}` : ''}
          </span>
          <div className="w-36">
            <Toggle checked={onlyVisible} onChange={setOnlyVisible} label={<span className="text-xs text-muted">{t('panel.onlyVisible')}</span>} />
          </div>
        </div>
        <ConnectionList items={items} />
      </div>
    );
  }

  if (tab === 'network') return <PassageNetwork sel={sel} all={all} degrees={degrees} />;
  return <PassageContext sel={sel} />;
}

function PassageNetwork({ sel, all, degrees }: { sel: Extract<Selection, { kind: 'passage' }>; all: Uint32Array; degrees: ReturnType<typeof useData>['degrees'] }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const { cols } = useData();
  const level = sel.unit === 'book' ? 'book' : sel.unit === 'chapter' ? 'chapter' : null;
  const net = useNetworkFile(level);
  const { start, end } = sel;

  // Distribution of the other ends by book.
  const byBook = useMemo(() => {
    const c = new Array(66).fill(0);
    if (!cols) return c;
    for (const i of all) {
      const srcIn = cols.sourceStart[i] <= end && cols.sourceEnd[i] >= start;
      const other = srcIn ? cols.targetStart[i] : cols.sourceStart[i];
      c[VERSE_BOOK[other]]++;
    }
    return c;
  }, [all, cols, start, end]);
  const top = byBook.map((n, b) => ({ b, n })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 10);
  const max = top[0]?.n ?? 1;

  let outN = 0, inN = 0;
  if (cols) for (const i of all) {
    if (cols.sourceStart[i] <= end && cols.sourceEnd[i] >= start) outN++;
    if (cols.targetStart[i] <= end && cols.targetEnd[i] >= start) inN++;
  }
  const node = net && level ? net.nodes[level === 'book' ? VERSE_BOOK[start] : VERSE_CHAPTER[start]] : null;
  const rankOf = (key: 'pageRank' | 'betweenness' | 'weightedDegree') => (net && node ? 1 + net.nodes.filter((n) => n[key] > node[key]).length : 0);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('panel.outgoing')} value={formatNumber(outN, lang)} />
        <Stat label={t('panel.incoming')} value={formatNumber(inN, lang)} />
        <Stat label={t('panel.total')} value={formatNumber(all.length, lang)} />
      </div>
      {sel.unit === 'verse' && degrees && (
        <p className="mt-2 text-xs text-muted">
          {t('panel.rank')}: <span className="font-medium text-fg">#{formatNumber(degrees.rank[start], lang)}</span> {t('misc.of')} {formatNumber(TOTAL_VERSES, lang)}
        </p>
      )}
      {node && net && (
        <>
          <SectionTitle>{t('network.metrics')}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('panel.weightedDegree')} value={formatNumber(node.weightedDegree, lang)} sub={`#${rankOf('weightedDegree')} / ${net.nodes.length}`} />
            <Stat label={t('panel.pageRank')} value={node.pageRank.toFixed(4)} sub={`#${rankOf('pageRank')} / ${net.nodes.length}`} />
            <Stat label={t('panel.betweenness')} value={node.betweenness.toFixed(4)} sub={`#${rankOf('betweenness')} / ${net.nodes.length}`} />
            <Stat
              label={t('panel.community')}
              value={
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: categorical(node.community) }} /> {node.community + 1}
                </span>
              }
              sub={`${t('panel.clustering')} ${node.clustering.toFixed(3)}`}
            />
          </div>
          <a href="#/network" className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
            {t('action.openNetwork')} <Icon name="arrow" size={14} />
          </a>
        </>
      )}
      <SectionTitle>{t('panel.topBooks')}</SectionTitle>
      <ul className="space-y-1">
        {top.map(({ b, n }) => (
          <li key={b} className="flex items-center gap-2 text-sm">
            <button type="button" className="w-28 shrink-0 truncate text-left hover:text-accent" onClick={() => focusBook(b)}>
              {bookName(b, lang)}
            </button>
            <span className="h-2 rounded-full" style={{ width: `${(n / max) * 100}%`, background: arcColor(Math.min(1, Math.abs(BOOKS[b].firstVerse - start) / TOTAL_VERSES / 0.6)) }} />
            <span className="ml-auto shrink-0 tabular-nums text-xs text-muted">{formatNumber(n, lang)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PassageContext({ sel }: { sel: Extract<Selection, { kind: 'passage' }> }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const { start, end } = sel;
  const bk = BOOKS[VERSE_BOOK[start]];
  const ch = CHAPTERS[VERSE_CHAPTER[start]];
  const testament = start >= NT_START ? 'NT' : 'OT';
  const pct = ((start / TOTAL_VERSES) * 100).toFixed(1);
  return (
    <div className="space-y-4 text-sm">
      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Breadcrumb">
        <button type="button" className="text-muted hover:text-fg" onClick={() => focusPassage('testament', 0, TOTAL_VERSES - 1)}>
          {t('explore.bible')}
        </button>
        <span className="text-muted">›</span>
        <button type="button" className="text-muted hover:text-fg" onClick={() => focusTestament(testament)}>
          {t(`testament.${testament}`)}
        </button>
        {sel.unit !== 'testament' && (
          <>
            <span className="text-muted">›</span>
            <button type="button" className="hover:text-accent" onClick={() => focusBook(bk.id)}>
              {bk.name[lang]}
            </button>
          </>
        )}
        {(sel.unit === 'verse' || sel.unit === 'range' || sel.unit === 'chapter') && (
          <>
            <span className="text-muted">›</span>
            <button type="button" className="hover:text-accent" onClick={() => focusChapter(ch.id)}>
              {ch.number}
            </button>
          </>
        )}
      </nav>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted">{t('panel.position')}</dt>
        <dd>{t('panel.positionValue', { p: pct })}</dd>
        <dt className="text-muted">{t('panel.genre')}</dt>
        <dd>{t(`genre.${bk.genre}`)}</dd>
        <dt className="text-muted">{t('unit.book')}</dt>
        <dd>
          {bk.order} / 66 · {formatNumber(bk.chapterCount, lang)} {t('unit.chapters')} · {formatNumber(bk.verseCount, lang)} {t('unit.verses')}
        </dd>
        {sel.unit !== 'book' && sel.unit !== 'testament' && (
          <>
            <dt className="text-muted">{t('unit.chapter')}</dt>
            <dd>
              {t('panel.chapterOf', { c: ch.number, n: bk.chapterCount })} · {formatNumber(ch.verseCount, lang)} {t('unit.verses')}
            </dd>
          </>
        )}
        {(sel.unit === 'verse' || sel.unit === 'range') && (
          <>
            <dt className="text-muted">{t('unit.verse')}</dt>
            <dd>{t('panel.verseOf', { v: VERSE_NUMBER[start] + (end > start ? `–${VERSE_NUMBER[end]}` : ''), n: ch.verseCount })}</dd>
          </>
        )}
      </dl>
      <PositionBar start={start} end={end} />
      <div className="flex flex-wrap gap-2">
        <a href="#/explore" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-panel-2">
          <Icon name="book" size={14} /> {t('action.openExplore')}
        </a>
        <a href="#/network" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-panel-2">
          <Icon name="network" size={14} /> {t('action.openNetwork')}
        </a>
      </div>
    </div>
  );
}

/** Miniature of the whole Bible with the passage marked. */
function PositionBar({ start, end, second }: { start: number; end: number; second?: [number, number] }) {
  const pct = (g: number) => `${(g / TOTAL_VERSES) * 100}%`;
  return (
    <div className="relative h-6 w-full overflow-hidden rounded-md border border-line bg-bg/50" aria-hidden>
      {BOOKS.map((b) => (
        <span key={b.id} className="absolute top-2 h-2" style={{ left: pct(b.firstVerse), width: pct(b.verseCount), background: b.id % 2 ? 'var(--axis-b)' : 'var(--axis-a)', opacity: 0.45 }} />
      ))}
      <span className="absolute top-0 h-full w-px bg-muted" style={{ left: pct(NT_START) }} />
      <span className="absolute top-0 h-full rounded-sm bg-accent" style={{ left: pct(start), width: `max(3px, ${pct(end - start + 1)})` }} />
      {second && <span className="absolute top-0 h-full rounded-sm bg-fg" style={{ left: pct(second[0]), width: `max(3px, ${pct(second[1] - second[0] + 1)})` }} />}
    </div>
  );
}

/* ---------------------------------------------------------------- reference */

function ReferenceBody({ index: i, tab }: { index: number; tab: Tab }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const { cols, derived } = useData();
  const net = useNetworkFile(tab === 'network' ? 'book' : null);
  const related = useMemo(() => {
    if (!cols) return null;
    const s0 = cols.sourceStart[i], s1 = cols.sourceEnd[i], t0 = cols.targetStart[i], t1 = cols.targetEnd[i];
    const fromSource: ConnectionItem[] = [];
    const toTarget: ConnectionItem[] = [];
    let reciprocal = -1;
    for (let k = 0; k < cols.count; k++) {
      if (k === i) continue;
      if (cols.sourceStart[k] === s0 && cols.sourceEnd[k] === s1 && fromSource.length < 30) fromSource.push({ index: k, other: 'target' });
      if (cols.targetStart[k] <= t1 && cols.targetEnd[k] >= t0 && toTarget.length < 30) toTarget.push({ index: k, other: 'source' });
      if (reciprocal < 0 && cols.sourceStart[k] <= t1 && cols.sourceStart[k] >= t0 && cols.targetStart[k] <= s1 && cols.targetEnd[k] >= s0) reciprocal = k;
    }
    return { fromSource, toTarget, reciprocal };
  }, [cols, i]);
  if (!cols || !derived || !related) return null;
  const s0 = cols.sourceStart[i], s1 = cols.sourceEnd[i], t0 = cols.targetStart[i], t1 = cols.targetEnd[i];
  const sb = VERSE_BOOK[s0], tb = VERSE_BOOK[t0];
  const dist = Math.round(Math.abs(derived.targetPos[i] - derived.sourcePos[i]) * TOTAL_VERSES);
  const cls = (['near', 'mid', 'far'] as const)[derived.distClass[i]];
  const rel = `${s0 >= NT_START ? 'NT' : 'OT'} → ${t0 >= NT_START ? 'NT' : 'OT'}`;

  if (tab === 'passage')
    return (
      <div className="space-y-4">
        <div>
          <SectionTitle>
            {t('panel.source')} · {formatRange(s0, s1, lang)}
          </SectionTitle>
          <PassageText start={s0} end={s1} />
          <button type="button" onClick={() => goToVerse(s0, s1)} className="mt-1 text-xs text-accent hover:underline">
            {t('action.goTo')} {formatRange(s0, s1, lang, true)}
          </button>
        </div>
        <div>
          <SectionTitle>
            {t('panel.target')} · {formatRange(t0, t1, lang)}
          </SectionTitle>
          <PassageText start={t0} end={t1} maxVerses={30} />
          <button type="button" onClick={() => goToVerse(t0, t1)} className="mt-1 text-xs text-accent hover:underline" data-testid="goto-target">
            {t('action.goTo')} {formatRange(t0, t1, lang, true)}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t('panel.votes')} value={formatNumber(cols.votes[i], lang)} />
          <Stat
            label={t('panel.distance')}
            value={
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: arcColor(derived.colorT[i]) }} />
                {t(`filters.distance.${cls}`)}
              </span>
            }
          />
        </div>
      </div>
    );

  if (tab === 'connections')
    return (
      <div>
        <SectionTitle>{t('panel.reciprocal')}</SectionTitle>
        {related.reciprocal >= 0 ? <ConnectionList items={[{ index: related.reciprocal, other: 'source' }]} showSelf /> : <p className="text-sm text-muted">{t('panel.none')}</p>}
        <SectionTitle>{t('panel.sameSource')}</SectionTitle>
        <ConnectionList items={related.fromSource} pageSize={10} />
        <SectionTitle>{t('panel.sameTarget')}</SectionTitle>
        <ConnectionList items={related.toTarget} pageSize={10} />
      </div>
    );

  if (tab === 'network')
    return (
      <div>
        <SectionTitle>{t('panel.books')}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {[sb, tb].map((b, k) => {
            const node = net?.nodes[b];
            return (
              <div key={k} className="rounded-lg border border-line bg-bg/40 px-3 py-2">
                <div className="text-[11px] text-muted">{k === 0 ? t('panel.source') : t('panel.target')}</div>
                <button type="button" className="font-semibold hover:text-accent" onClick={() => focusBook(b)}>
                  {bookName(b, lang)}
                </button>
                {node && (
                  <dl className="mt-1 space-y-0.5 text-[11px] text-muted">
                    <div>
                      {t('panel.weightedDegree')}: <span className="text-fg">{formatNumber(node.weightedDegree, lang)}</span>
                    </div>
                    <div>
                      {t('panel.pageRank')}: <span className="text-fg">{node.pageRank.toFixed(4)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {t('panel.community')}: <span className="inline-block h-2 w-2 rounded-full" style={{ background: categorical(node.community) }} /> <span className="text-fg">{node.community + 1}</span>
                    </div>
                  </dl>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm">
          <span className="text-muted">{t('panel.relation')}:</span> {rel}
        </p>
      </div>
    );

  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted">{t('panel.distance')}</dt>
        <dd>{t('panel.distanceVerses', { n: formatNumber(dist, lang), p: ((dist / TOTAL_VERSES) * 100).toFixed(1) })}</dd>
        <dt className="text-muted">{t('panel.relativePosition')}</dt>
        <dd>{t0 >= s0 ? t('panel.forward') : t('panel.backward')}</dd>
        <dt className="text-muted">{t('panel.relation')}</dt>
        <dd>{rel}</dd>
        <dt className="text-muted">{t('panel.source')}</dt>
        <dd>{t('panel.positionValue', { p: ((s0 / TOTAL_VERSES) * 100).toFixed(1) })}</dd>
        <dt className="text-muted">{t('panel.target')}</dt>
        <dd>{t('panel.positionValue', { p: ((t0 / TOTAL_VERSES) * 100).toFixed(1) })}</dd>
      </dl>
      <PositionBar start={s0} end={s1} second={[t0, t1]} />
    </div>
  );
}
