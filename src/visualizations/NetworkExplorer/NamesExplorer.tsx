/**
 * People & places: a co-occurrence network (two names are linked when they are named in the
 * same verse), from STEPBible's TIPNR (CC BY 4.0). Overview of the most mentioned names, or the
 * ego network of one name; details list the verses where it occurs.
 */
import { useEffect, useMemo, useState } from 'react';
import { Field, Icon, Segmented, Spinner } from '../../components/ui/index.tsx';
import { formatVerse } from '../../data/bibleStructure.ts';
import { loadJSON } from '../../data/loader.ts';
import type { NameType, NamesFile } from '../../data/namesTypes.ts';
import { normalize } from '../../data/search.ts';
import { formatNumber, useT } from '../../i18n/index.ts';
import { actions, useApp } from '../../state/appState.ts';
import { goToVerse } from '../../state/navigation.ts';
import { NetworkGraph, type GraphLink, type GraphNode } from './NetworkGraph.tsx';

const TYPE_COLOR: Record<NameType, string> = { person: '#4f7cff', place: '#f59e0b', other: '#22c55e' };
const TOP_STEPS = [40, 80, 150, 250, 400];

interface Entry {
  id: number;
  name: string;
  type: NameType;
  brief: string;
  verses: number[];
}

export function NamesExplorer() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const theme = useApp((s) => s.theme);
  const [file, setFile] = useState<NamesFile | null>(null);
  const [kind, setKind] = useState<'all' | 'person' | 'place'>('all');
  const [topIdx, setTopIdx] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [ego, setEgo] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    loadJSON<NamesFile>('names/names.json').then(setFile).catch(() => {});
  }, []);

  const entries = useMemo<Entry[]>(() => (file ? file.entries.map(([name, , type, brief, verses], id) => ({ id, name, type, brief, verses })) : []), [file]);
  const byVerse = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const e of entries) for (const v of e.verses) m.set(v, [...(m.get(v) ?? []), e.id]);
    return m;
  }, [entries]);
  /** Display names, disambiguated by first occurrence when several entries share a name. */
  const labels = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of entries) count.set(e.name, (count.get(e.name) ?? 0) + 1);
    return entries.map((e) => ((count.get(e.name) ?? 0) > 1 ? `${e.name} (${formatVerse(e.verses[0], lang, true)})` : e.name));
  }, [entries, lang]);

  const coCount = (id: number): Map<number, number> => {
    const m = new Map<number, number>();
    for (const v of entries[id].verses) for (const o of byVerse.get(v) ?? []) if (o !== id) m.set(o, (m.get(o) ?? 0) + 1);
    return m;
  };

  const graph = useMemo(() => {
    if (!entries.length) return null;
    const allowed = (e: Entry) => (kind === 'all' ? e.type !== 'other' : e.type === kind);
    let ids: number[];
    if (ego && selected != null) {
      const co = coCount(selected);
      ids = [selected, ...[...co.entries()].filter(([o]) => allowed(entries[o]) || o === selected).sort((a, b) => b[1] - a[1]).slice(0, 35).map(([o]) => o)];
    } else {
      ids = entries.filter(allowed).sort((a, b) => b.verses.length - a.verses.length).slice(0, TOP_STEPS[topIdx]).map((e) => e.id);
    }
    const set = new Set(ids);
    const pair = new Map<string, number>();
    for (const id of ids)
      for (const v of entries[id].verses)
        for (const o of byVerse.get(v) ?? [])
          if (o > id && set.has(o)) pair.set(`${id}-${o}`, (pair.get(`${id}-${o}`) ?? 0) + 1);
    const maxMentions = Math.max(...ids.map((i) => entries[i].verses.length));
    const nodes: GraphNode[] = ids.map((i) => ({
      id: i,
      label: labels[i],
      radius: 3 + 16 * Math.sqrt(entries[i].verses.length / maxMentions),
      color: TYPE_COLOR[entries[i].type],
      important: ego || entries[i].verses.length >= maxMentions / 6,
    }));
    const maxPair = Math.max(1, ...pair.values());
    const minCo = ego ? 1 : ids.length > 150 ? 3 : 2;
    const links: GraphLink[] = [...pair.entries()]
      .filter(([, w]) => w >= minCo)
      .map(([k, w]) => {
        const [a, b] = k.split('-').map(Number);
        return { source: a, target: b, weight: w, strength: Math.sqrt(w / maxPair) };
      });
    return { nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, byVerse, labels, kind, topIdx, ego, selected]);

  const matches = useMemo(() => {
    const k = normalize(q);
    if (!k) return [];
    return entries
      .filter((e) => normalize(e.name).startsWith(k))
      .sort((a, b) => b.verses.length - a.verses.length)
      .slice(0, 8);
  }, [q, entries]);

  const sel = selected != null ? entries[selected] : null;
  const related = useMemo(() => (sel ? [...coCount(sel.id).entries()].sort((a, b) => b[1] - a[1]).slice(0, 12) : []), [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!file || !graph)
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
        <Spinner /> {t('loading.generic')}
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row" data-testid="names-explorer">
      <div className="relative min-h-[55vh] flex-1 overflow-hidden lg:min-h-0">
        <NetworkGraph
          nodes={graph.nodes}
          links={graph.links}
          selected={selected}
          onSelect={(id) => setSelected(id)}
          theme={theme}
          distance={ego ? 120 : 80}
          testId="names-graph"
        />
        <div className="absolute left-3 top-3 z-20 w-[260px] space-y-3 rounded-xl border border-line bg-panel/90 p-3 shadow-[var(--shadow)] backdrop-blur max-sm:w-[calc(100%-1.5rem)]">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('names.search')}
              className="w-full rounded-lg border border-line bg-bg/60 px-3 py-1.5 text-sm outline-none focus:border-accent/70"
              data-testid="names-search"
            />
            {matches.length > 0 && (
              <ul className="absolute left-0 right-0 top-9 z-30 overflow-hidden rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full justify-between px-3 py-1.5 text-left text-sm hover:bg-panel-2"
                      onClick={() => {
                        setSelected(m.id);
                        setEgo(true);
                        setQ('');
                      }}
                    >
                      <span>{labels[m.id]}</span>
                      <span className="text-xs text-muted">{m.verses.length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Field label={t('names.show')}>
            <Segmented
              value={kind}
              onChange={setKind}
              label={t('names.show')}
              size="xs"
              options={[
                { value: 'all', label: t('names.all') },
                { value: 'person', label: t('names.people') },
                { value: 'place', label: t('names.places') },
              ]}
            />
          </Field>
          {!ego && (
            <Field label={t('names.top', { n: TOP_STEPS[topIdx] })}>
              <input type="range" min={0} max={TOP_STEPS.length - 1} value={topIdx} onChange={(e) => setTopIdx(Number(e.target.value))} className="w-full" aria-label={t('names.top', { n: TOP_STEPS[topIdx] })} />
            </Field>
          )}
          {ego && (
            <button type="button" className="text-xs text-accent hover:underline" onClick={() => setEgo(false)}>
              ← {t('names.overview')}
            </button>
          )}
          <div className="flex gap-3 text-[11px] text-muted">
            {(['person', 'place'] as const).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLOR[k] }} />
                {t(k === 'person' ? 'names.people' : 'names.places')}
              </span>
            ))}
          </div>
        </div>
      </div>
      <aside className="scroll-thin w-full shrink-0 overflow-y-auto border-line bg-panel/60 px-4 py-4 lg:w-[380px] lg:border-l" data-testid="names-side">
        {sel ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t(sel.type === 'person' ? 'names.person' : sel.type === 'place' ? 'names.place' : 'names.other')}</div>
            <h2 className="text-xl font-semibold tracking-tight" data-testid="names-title">
              {labels[sel.id]}
            </h2>
            {sel.brief && (
              <p className="mt-1 text-sm text-fg/85" lang="en">
                {sel.brief}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">{t('names.mentions', { n: formatNumber(sel.verses.length, lang) })}</p>
            {!ego && (
              <button type="button" className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline" onClick={() => setEgo(true)}>
                <Icon name="network" size={14} /> {t('names.egoOf', { name: sel.name })}
              </button>
            )}
            <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('names.related')}</h3>
            <ul className="space-y-0.5">
              {related.map(([o, c]) => (
                <li key={o} className="flex items-center justify-between text-sm">
                  <button type="button" className="hover:text-accent" onClick={() => setSelected(o)}>
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[entries[o].type] }} />
                    {labels[o]}
                  </button>
                  <span className="text-xs tabular-nums text-muted">{c}</span>
                </li>
              ))}
            </ul>
            <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('names.verses')}</h3>
            <div className="flex flex-wrap gap-1" data-testid="names-verses">
              {sel.verses.slice(0, 60).map((v) => (
                <button
                  key={v}
                  type="button"
                  className="rounded-md bg-bg/50 px-1.5 py-0.5 text-xs hover:text-accent"
                  onClick={() => {
                    actions.setRoute('explore');
                    goToVerse(v);
                  }}
                >
                  {formatVerse(v, lang, true)}
                </button>
              ))}
              {sel.verses.length > 60 && <span className="px-1 text-xs text-muted">+{sel.verses.length - 60}</span>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">{t('names.hint')}</p>
        )}
        <p className="mt-6 text-[11px] leading-relaxed text-muted">{t('names.source')}</p>
      </aside>
    </div>
  );
}
