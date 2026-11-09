/** High-level navigation helpers shared by search, panels, Explore and Insights. */
import { BOOKS, CHAPTERS, VERSE_BOOK, VERSE_CHAPTER, testamentSpan } from '../data/bibleStructure.ts';
import type { ReferenceColumns } from '../data/format.ts';
import type { SearchResult } from '../data/search.ts';
import { arcController, viewForConnection, viewForPassage } from '../visualizations/ArcVisualization/controller.ts';
import { actions, appStore, type PassageUnit } from './appState.ts';

export function focusPassage(unit: PassageUnit, start: number, end: number, opts: { zoom?: boolean; route?: boolean } = {}) {
  actions.selectPassage(unit, start, end);
  if (opts.route !== false && appStore.get().route !== 'arc' && appStore.get().route !== 'explore') actions.setRoute('arc');
  if (opts.zoom !== false) arcController.zoomTo({ ...viewForPassage(start, end, unit), duration: 900 });
}

export function focusSearchResult(r: SearchResult, opts: { route?: 'arc' | 'explore' | null } = {}) {
  const unit: PassageUnit = r.kind === 'book' ? 'book' : r.kind === 'chapter' ? 'chapter' : r.kind === 'range' ? 'range' : 'verse';
  if (opts.route) actions.setRoute(opts.route);
  focusPassage(unit, r.start, r.end, { route: false });
}

export function focusReference(cols: ReferenceColumns, index: number, opts: { zoom?: boolean } = {}) {
  actions.selectReference(index);
  if (opts.zoom !== false) arcController.zoomTo({ ...viewForConnection(cols.sourceStart[index], cols.targetStart[index]), duration: 900 });
}

/** Selects a verse and pans to it, keeping the zoom level ("go to the other end"). */
export function goToVerse(verse: number, end = verse) {
  actions.selectPassage(end > verse ? 'range' : 'verse', verse, end);
  const v = arcController.getCurrentView();
  if (v.x1 - v.x0 > 0.999) arcController.zoomTo({ ...viewForPassage(verse, end, 'verse'), duration: 900 });
  else arcController.centerOn(Math.round((verse + end) / 2));
}

export function focusBook(bookId: number) {
  const b = BOOKS[bookId];
  focusPassage('book', b.firstVerse, b.firstVerse + b.verseCount - 1);
}

export function focusChapter(chapterId: number) {
  const c = CHAPTERS[chapterId];
  focusPassage('chapter', c.globalPosition, c.globalPosition + c.verseCount - 1);
}

export function focusTestament(t: 'OT' | 'NT') {
  const [s, e] = testamentSpan(t);
  focusPassage('testament', s, e);
}

/** Unit of a passage: chapter/book when the span matches exactly. */
export function unitForSpan(start: number, end: number): PassageUnit {
  if (start === end) return 'verse';
  const c = CHAPTERS[VERSE_CHAPTER[start]];
  if (c.globalPosition === start && c.globalPosition + c.verseCount - 1 === end) return 'chapter';
  const b = BOOKS[VERSE_BOOK[start]];
  if (b.firstVerse === start && b.firstVerse + b.verseCount - 1 === end) return 'book';
  return 'range';
}
