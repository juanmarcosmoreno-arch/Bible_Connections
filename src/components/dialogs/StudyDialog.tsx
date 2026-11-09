import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { referencesTouching } from '../../analysis/filters.ts';
import { formatRange } from '../../data/bibleStructure.ts';
import type { ReferenceColumns } from '../../data/format.ts';
import { parseSpan } from '../../data/parser.ts';
import { textProvider, type VerseText } from '../../data/textProvider.ts';
import { useData } from '../../hooks/useData.tsx';
import { useTranslationCode } from '../../hooks/useText.ts';
import { useT } from '../../i18n/index.ts';
import { actions, useApp } from '../../state/appState.ts';
import { focusPassage, focusReference, unitForSpan } from '../../state/navigation.ts';
import { study, useStudyItems, type StudyItem } from '../../state/study.ts';
import { resolveReference } from '../../state/url.ts';
import { downloadText } from '../../utils/download.ts';
import { ATTRIBUTION } from '../../utils/export.ts';
import { useSourceLabel } from '../SourceTag.tsx';
import { Button, Icon, IconButton, Modal } from '../ui/index.tsx';
import { VerseString } from '../panels/PassageText.tsx';

interface Resolved {
  item: StudyItem;
  kind: 'passage' | 'reference';
  start: number;
  end: number;
  ref?: number; // reference index
  label: string;
}

function resolve(item: StudyItem, cols: ReferenceColumns | undefined, lang: 'en' | 'es'): Resolved | null {
  if (item.id.startsWith('p:')) {
    const r = parseSpan(item.id.slice(2));
    if (!r.ok) return null;
    return { item, kind: 'passage', start: r.span.start, end: r.span.end, label: formatRange(r.span.start, r.span.end, lang) };
  }
  if (!cols) return null;
  const i = resolveReference(item.id.slice(2), cols);
  if (i < 0) return null;
  return {
    item,
    kind: 'reference',
    start: cols.sourceStart[i],
    end: cols.sourceEnd[i],
    ref: i,
    label: `${formatRange(cols.sourceStart[i], cols.sourceEnd[i], lang)} → ${formatRange(cols.targetStart[i], cols.targetEnd[i], lang)}`,
  };
}

export function StudyDialog() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const open = useApp((s) => s.dialog === 'study');
  const { cols } = useData();
  const items = useStudyItems();
  const [status, setStatus] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const resolved = items.map((i) => resolve(i, cols, lang)).filter((r): r is Resolved => !!r);

  const openItem = (r: Resolved) => {
    actions.closeDialog();
    if (r.kind === 'reference' && cols && r.ref != null) {
      actions.setRoute('arc');
      focusReference(cols, r.ref);
    } else focusPassage(r.item.unit ?? unitForSpan(r.start, r.end), r.start, r.end);
  };

  return (
    <>
      <Modal open={open} onClose={actions.closeDialog} title={t('study.title')} wide>
        <div className="space-y-4" data-testid="study-dialog">
          {resolved.length === 0 ? (
            <p className="text-sm text-muted">{t('study.empty')}</p>
          ) : (
            <ul className="divide-y divide-line" data-testid="study-items">
              {resolved.map((r) => (
                <li key={r.item.id} className="flex items-start gap-2 py-2">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openItem(r)}>
                    <div className="text-sm font-medium hover:text-accent">{r.label}</div>
                    {r.item.note && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{r.item.note}</div>}
                  </button>
                  <IconButton label={t('study.remove')} onClick={() => study.remove(r.item.id)}>
                    <Icon name="trash" size={16} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="solid" disabled={!resolved.length} onClick={() => setPrinting(true)} data-testid="study-print">
              <Icon name="print" size={14} /> {t('study.print')}
            </Button>
            <Button variant="outline" disabled={!items.length} onClick={() => downloadText(study.export(), 'bible-connections-study.json', 'application/json')} data-testid="study-export">
              {t('study.export')}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              {t('study.import')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setStatus(t('study.imported', { n: study.import(await f.text()) }));
                } catch (err) {
                  setStatus(String(err));
                }
                e.target.value = '';
              }}
            />
            {items.length > 0 && (
              <Button variant="ghost" onClick={() => window.confirm(t('study.confirmClear')) && study.clear()}>
                {t('study.clear')}
              </Button>
            )}
          </div>
          {status && <p className="text-xs text-muted">{status}</p>}
          <p className="text-[11px] text-muted">{t('study.storage')}</p>
        </div>
      </Modal>
      {printing && <StudySheet items={resolved} onDone={() => setPrinting(false)} />}
    </>
  );
}

/** Printable study sheet (rendered into #print-root, shown only when printing). */
function StudySheet({ items, onDone }: { items: Resolved[]; onDone: () => void }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const code = useTranslationCode();
  const { cols } = useData();
  const sourceLabel = useSourceLabel();
  const [texts, setTexts] = useState<Map<string, VerseText[]> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const m = new Map<string, VerseText[]>();
      for (const r of items) {
        const spans: [number, number][] = [[r.start, Math.min(r.end, r.start + 39)]];
        if (r.kind === 'reference' && cols && r.ref != null) spans.push([cols.targetStart[r.ref], Math.min(cols.targetEnd[r.ref], cols.targetStart[r.ref] + 39)]);
        for (const [a, b] of spans) m.set(`${a}-${b}`, await textProvider.getRange(code, a, b));
      }
      if (alive) setTexts(m);
    })();
    return () => {
      alive = false;
    };
  }, [items, code, cols]);

  useEffect(() => {
    if (!texts) return;
    const after = () => onDone();
    window.addEventListener('afterprint', after, { once: true });
    const id = setTimeout(() => window.print(), 300);
    return () => {
      clearTimeout(id);
      window.removeEventListener('afterprint', after);
    };
  }, [texts, onDone]);

  const root = document.getElementById('print-root');
  if (!root) return null;
  const Text = ({ a, b }: { a: number; b: number }) => (
    <div className="sheet-text">
      {(texts?.get(`${a}-${Math.min(b, a + 39)}`) ?? []).map((v) => (
        <span key={v.verse}>{v.text ? <VerseString text={v.text} /> : '—'} </span>
      ))}
    </div>
  );
  return createPortal(
    <article className="study-sheet" data-testid="study-sheet">
      {!texts && <p className="screen-only">{t('study.preparing')}</p>}
      <h1>Bible Connections — {t('study.sheetTitle')}</h1>
      <p className="meta">
        {new Date().toLocaleDateString(lang === 'es' ? 'es-AR' : 'en-US', { dateStyle: 'long' })} · {code}
      </p>
      {items.map((r) => {
        const top =
          r.kind === 'passage' && cols
            ? Array.from(referencesTouching(cols, null, r.start, r.end, 'both')).slice(0, 8)
            : [];
        return (
          <section key={r.item.id}>
            <h2>{r.label}</h2>
            <Text a={r.start} b={r.end} />
            {r.kind === 'reference' && cols && r.ref != null && (
              <>
                <h3>{formatRange(cols.targetStart[r.ref], cols.targetEnd[r.ref], lang)}</h3>
                <Text a={cols.targetStart[r.ref]} b={cols.targetEnd[r.ref]} />
                <p className="meta">
                  {t('source.label')}: {sourceLabel(cols.origin[r.ref])}
                </p>
              </>
            )}
            {r.item.note && (
              <div className="note">
                <strong>{t('study.notes')}:</strong> {r.item.note}
              </div>
            )}
            {top.length > 0 && cols && (
              <>
                <h3>{t('study.connections')}</h3>
                <ul>
                  {top.map((i) => {
                    const srcIn = cols.sourceStart[i] <= r.end && cols.sourceEnd[i] >= r.start;
                    return <li key={i}>{srcIn ? formatRange(cols.targetStart[i], cols.targetEnd[i], lang) : formatRange(cols.sourceStart[i], cols.sourceEnd[i], lang)}</li>;
                  })}
                </ul>
              </>
            )}
          </section>
        );
      })}
      <p className="meta footer">{ATTRIBUTION}</p>
    </article>,
    root,
  );
}
