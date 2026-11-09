/**
 * EXPLORE — structured navigator (Bible → Testament → Book → Chapter → Verse) with a reading
 * view. Each verse shows how many cross-references touch it; selecting a verse opens the
 * same details panel as the Arc view.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { DetailPanel } from '../components/panels/DetailPanel.tsx';
import { VerseNoteLine, VerseString } from '../components/panels/PassageText.tsx';
import { Icon, IconButton, Segmented, Spinner } from '../components/ui/index.tsx';
import { BOOKS, CHAPTERS, VERSE_CHAPTER, type Book } from '../data/bibleStructure.ts';
import { GENRES, type Genre } from '../data/books.ts';
import { useData } from '../hooks/useData.tsx';
import { useVerseTexts } from '../hooks/useText.ts';
import { formatNumber, useT } from '../i18n/index.ts';
import { actions, useApp } from '../state/appState.ts';
import { focusPassage } from '../state/navigation.ts';
import { viewForPassage, arcController } from '../visualizations/ArcVisualization/controller.ts';

export default function ExplorePage() {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const selection = useApp((s) => s.selection);
  const { chapterRefs, degrees } = useData();
  const selStart = selection?.kind === 'passage' ? selection.start : null;
  const [chapterId, setChapterId] = useState(() => (selStart != null ? VERSE_CHAPTER[selStart] : 0));
  const [testament, setTestament] = useState<'OT' | 'NT'>(() => BOOKS[CHAPTERS[chapterId].bookId].testament);

  useEffect(() => {
    if (selStart != null) {
      const c = VERSE_CHAPTER[selStart];
      setChapterId(c);
      setTestament(BOOKS[CHAPTERS[c].bookId].testament);
    }
  }, [selStart]);

  const chapter = CHAPTERS[chapterId];
  const book = BOOKS[chapter.bookId];
  const goChapter = (id: number) => {
    setChapterId(id);
    setTestament(BOOKS[CHAPTERS[id].bookId].testament);
  };

  const maxChapterRefs = useMemo(() => (chapterRefs ? Math.max(...chapterRefs.slice(book.firstChapter, book.firstChapter + book.chapterCount)) : 1), [chapterRefs, book]);

  return (
    <div className="flex h-full min-h-0" data-testid="explore-page">
      {/* Navigator */}
      <aside className="scroll-thin hidden w-[300px] shrink-0 overflow-y-auto border-r border-line bg-panel/40 px-4 py-4 md:block" aria-label={t('explore.title')}>
        <Segmented value={testament} onChange={setTestament} label={t('filters.testament')} options={[{ value: 'OT', label: t('testament.OT') }, { value: 'NT', label: t('testament.NT') }]} />
        <BookList testament={testament} current={book.id} onPick={(b) => goChapter(BOOKS[b].firstChapter)} />
      </aside>

      {/* Reading view */}
      <section className="scroll-thin min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-8">
          <MobilePicker chapterId={chapterId} onChange={goChapter} />
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {t(`testament.${book.testament}`)} · {t(`genre.${book.genre}`)}
          </div>
          <div className="flex items-center gap-2">
            <h1 className="min-w-0 flex-1 text-3xl font-semibold tracking-tight sm:text-4xl" data-testid="explore-title">
              {book.name[lang]} {chapter.number}
            </h1>
            <IconButton label={t('action.prevChapter')} disabled={chapterId === 0} onClick={() => goChapter(chapterId - 1)} data-testid="explore-prev">
              <Icon name="left" />
            </IconButton>
            <IconButton label={t('action.nextChapter')} disabled={chapterId === CHAPTERS.length - 1} onClick={() => goChapter(chapterId + 1)} data-testid="explore-next">
              <Icon name="right" />
            </IconButton>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>
              {formatNumber(chapter.verseCount, lang)} {t('unit.verses')}
            </span>
            {chapterRefs && (
              <span>
                {formatNumber(chapterRefs[chapterId], lang)} {t('unit.references')}
              </span>
            )}
            <button type="button" className="inline-flex items-center gap-1 text-accent hover:underline" onClick={() => focusPassage('chapter', chapter.globalPosition, chapter.globalPosition + chapter.verseCount - 1, { zoom: false })}>
              {t('panel.connections')}
            </button>
            <a
              href="#/arc"
              className="inline-flex items-center gap-1 text-accent hover:underline"
              onClick={() => {
                focusPassage('chapter', chapter.globalPosition, chapter.globalPosition + chapter.verseCount - 1, { zoom: false, route: false });
                arcController.zoomTo({ ...viewForPassage(chapter.globalPosition, chapter.globalPosition + chapter.verseCount - 1, 'chapter'), duration: 900 });
              }}
            >
              <Icon name="arc" size={14} /> {t('action.openArc')}
            </a>
          </div>

          {/* Chapter grid of the book */}
          <div className="mt-4 flex flex-wrap gap-1" aria-label={t('explore.chooseChapter')}>
            {Array.from({ length: book.chapterCount }, (_, i) => {
              const id = book.firstChapter + i;
              const heat = chapterRefs ? chapterRefs[id] / maxChapterRefs : 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => goChapter(id)}
                  aria-current={id === chapterId ? 'true' : undefined}
                  className={`h-7 min-w-7 rounded-md px-1 text-[11px] tabular-nums transition ${id === chapterId ? 'bg-accent text-accent-fg' : 'text-fg/80 hover:text-fg'}`}
                  style={id === chapterId ? undefined : { background: `color-mix(in srgb, var(--accent) ${Math.round(8 + heat * 40)}%, transparent)` }}
                  title={chapterRefs ? `${chapterRefs[id]} ${t('unit.references')}` : undefined}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-muted">{t('explore.heat')}</p>

          <ChapterText chapterId={chapterId} degrees={degrees} />
        </div>
      </section>

      <DetailPanel />
    </div>
  );
}

function BookList({ testament, current, onPick }: { testament: 'OT' | 'NT'; current: number; onPick: (b: number) => void }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const groups = GENRES.map((g) => ({ g, books: BOOKS.filter((b) => b.testament === testament && b.genre === g) })).filter((x) => x.books.length);
  return (
    <div className="mt-4 space-y-4" data-testid="book-list">
      {groups.map(({ g, books }) => (
        <div key={g}>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{t(`genre.${g as Genre}`)}</div>
          <ul>
            {books.map((b: Book) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onPick(b.id)}
                  aria-current={b.id === current ? 'true' : undefined}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm ${b.id === current ? 'bg-panel-2 text-fg' : 'text-fg/80 hover:bg-panel-2/60 hover:text-fg'}`}
                >
                  <span>{b.name[lang]}</span>
                  <span className="text-[11px] tabular-nums text-muted">{b.chapterCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MobilePicker({ chapterId, onChange }: { chapterId: number; onChange: (id: number) => void }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const ch = CHAPTERS[chapterId];
  return (
    <div className="mb-4 grid grid-cols-[1fr_auto] gap-2 md:hidden">
      <select value={ch.bookId} onChange={(e) => onChange(BOOKS[Number(e.target.value)].firstChapter)} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm" aria-label={t('explore.chooseBook')}>
        {BOOKS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name[lang]}
          </option>
        ))}
      </select>
      <select value={ch.number} onChange={(e) => onChange(BOOKS[ch.bookId].firstChapter + Number(e.target.value) - 1)} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm" aria-label={t('explore.chooseChapter')}>
        {Array.from({ length: BOOKS[ch.bookId].chapterCount }, (_, i) => (
          <option key={i} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChapterText({ chapterId, degrees }: { chapterId: number; degrees: ReturnType<typeof useData>['degrees'] }) {
  const t = useT();
  const lang = useApp((s) => s.lang);
  const selection = useApp((s) => s.selection);
  const ch = CHAPTERS[chapterId];
  const { status, verses, code } = useVerseTexts(ch.globalPosition, ch.globalPosition + ch.verseCount - 1);
  const ref = useRef<HTMLOListElement>(null);
  const max = useMemo(() => {
    if (!degrees) return 1;
    let m = 1;
    for (let g = ch.globalPosition; g < ch.globalPosition + ch.verseCount; g++) m = Math.max(m, degrees.total[g]);
    return m;
  }, [degrees, ch]);
  const sel = selection?.kind === 'passage' ? selection : null;

  useEffect(() => {
    if (sel && sel.unit === 'verse' && ref.current) {
      ref.current.querySelector(`[data-verse="${sel.start}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [sel, status]);

  if (status !== 'ready')
    return (
      <div className="mt-8 flex items-center gap-2 text-sm text-muted">
        <Spinner /> {t('loading.text')}
      </div>
    );
  return (
    <>
      <ol ref={ref} className="mt-6 space-y-0.5" lang={code === 'RV1909' ? 'es' : 'en'} data-testid="chapter-text">
        {verses.map((v, k) => {
          const n = degrees ? degrees.total[v.verse] : 0;
          const active = sel && v.verse >= sel.start && v.verse <= sel.end && sel.unit !== 'book' && sel.unit !== 'testament' && sel.unit !== 'chapter';
          return (
            <li key={v.verse} data-verse={v.verse}>
              <button
                type="button"
                onClick={() => actions.selectPassage('verse', v.verse, v.verse)}
                className={`group grid w-full grid-cols-[2rem_1fr_3.5rem] items-start gap-2 rounded-lg px-2 py-1.5 text-left transition ${active ? 'bg-accent/15 ring-1 ring-accent/50' : 'hover:bg-panel-2/60'}`}
                data-testid="verse-row"
              >
                <span className="pt-1 text-right text-[11px] font-semibold tabular-nums text-muted">{k + 1}</span>
                <span className="font-serif text-[16px] leading-relaxed text-fg/90">
                  {v.text ? <VerseString text={v.text} /> : <span className="italic text-muted">—</span>}
                  <VerseNoteLine v={v} />
                </span>
                <span className="flex flex-col items-end pt-1" title={`${n} ${t('unit.connections')}`}>
                  <span className="text-[11px] tabular-nums text-muted group-hover:text-fg">{formatNumber(n, lang)}</span>
                  <span className="mt-1 h-1 rounded-full bg-accent/70" style={{ width: `${Math.max(2, (n / max) * 100)}%` }} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-[11px] uppercase tracking-wider text-muted/70">{code}</p>
    </>
  );
}
