/**
 * Bible structure: books, chapters and verses positioned on a single global axis.
 *
 * Every verse gets a global index `g` (0 … TOTAL_VERSES-1) in canonical Protestant order.
 * Its normalised position on the axis is `(g + 0.5) / TOTAL_VERSES`, so each book and
 * chapter occupies a width proportional to its real number of verses.
 *
 * The chapter/verse table comes from `versification.json` (KJV + 3 John 1:15, see that file
 * and scripts/derive-versification.ts for provenance).
 */
import versification from './versification.json' with { type: 'json' };
import { BOOK_META, type Genre, type Testament } from './books.ts';

export type Lang = 'en' | 'es';

export interface Book {
  id: number; // 0-based canonical order
  code: string; // OSIS code (as used by OpenBible.info)
  name: { en: string; es: string };
  short: { en: string; es: string };
  testament: Testament;
  genre: Genre;
  order: number; // 1-based canonical order
  chapterCount: number;
  verseCount: number;
  firstChapter: number; // global chapter id of chapter 1
  firstVerse: number; // global verse index of 1:1
}

export interface Chapter {
  id: number; // global chapter id (0 … 1188)
  bookId: number;
  number: number; // 1-based chapter number
  verseCount: number;
  globalPosition: number; // global verse index of the chapter's first verse
}

export interface Verse {
  id: number; // global verse index
  bookId: number;
  chapter: number; // 1-based
  verse: number; // 1-based
  chapterId: number;
  globalPosition: number; // normalised 0..1 centre position on the axis
}

interface VersificationDoc {
  books: { osis: string; verses: number[] }[];
  additions: { osis: string; chapter: number; verse: number; mapsTo: { osis: string; chapter: number; verse: number }; note: string }[];
}

const doc = versification as VersificationDoc;

function buildCounts(): number[][] {
  const counts = doc.books.map((bk, i) => {
    if (bk.osis !== BOOK_META[i].osis) throw new Error(`Versification order mismatch at ${bk.osis}`);
    return bk.verses.slice();
  });
  for (const add of doc.additions) {
    const bi = BOOK_META.findIndex((m) => m.osis === add.osis);
    const ch = counts[bi];
    if (ch[add.chapter - 1] !== add.verse - 1) throw new Error(`Addition ${add.osis}.${add.chapter}.${add.verse} is not contiguous`);
    ch[add.chapter - 1] = add.verse;
  }
  return counts;
}

const COUNTS = buildCounts();

export const BOOKS: readonly Book[] = (() => {
  let chapterCursor = 0;
  let verseCursor = 0;
  return BOOK_META.map((m, i) => {
    const verseCount = COUNTS[i].reduce((a, c) => a + c, 0);
    const book: Book = {
      id: i,
      code: m.osis,
      name: { en: m.nameEn, es: m.nameEs },
      short: { en: m.shortEn, es: m.shortEs },
      testament: m.testament,
      genre: m.genre,
      order: i + 1,
      chapterCount: COUNTS[i].length,
      verseCount,
      firstChapter: chapterCursor,
      firstVerse: verseCursor,
    };
    chapterCursor += COUNTS[i].length;
    verseCursor += verseCount;
    return book;
  });
})();

export const CHAPTERS: readonly Chapter[] = (() => {
  const out: Chapter[] = [];
  let g = 0;
  BOOKS.forEach((bk) => {
    COUNTS[bk.id].forEach((n, ci) => {
      out.push({ id: out.length, bookId: bk.id, number: ci + 1, verseCount: n, globalPosition: g });
      g += n;
    });
  });
  return out;
})();

export const TOTAL_VERSES = CHAPTERS.reduce((a, c) => a + c.verseCount, 0);
export const TOTAL_CHAPTERS = CHAPTERS.length;
export const TOTAL_BOOKS = BOOKS.length;

/** Book id of each verse. */
export const VERSE_BOOK = new Uint8Array(TOTAL_VERSES);
/** Global chapter id of each verse. */
export const VERSE_CHAPTER = new Uint16Array(TOTAL_VERSES);
/** 1-based verse number of each verse. */
export const VERSE_NUMBER = new Uint16Array(TOTAL_VERSES);

for (const ch of CHAPTERS) {
  for (let v = 0; v < ch.verseCount; v++) {
    const g = ch.globalPosition + v;
    VERSE_BOOK[g] = ch.bookId;
    VERSE_CHAPTER[g] = ch.id;
    VERSE_NUMBER[g] = v + 1;
  }
}

/** First verse index of the New Testament (Matthew 1:1). */
export const NT_START = BOOKS.find((b) => b.testament === 'NT')!.firstVerse;

export const VERSIFICATION_ADDITIONS = doc.additions;

const BOOK_BY_CODE = new Map(BOOKS.map((b) => [b.code, b]));

export function bookByCode(code: string): Book | undefined {
  return BOOK_BY_CODE.get(code);
}

/** Global verse index, or -1 when the reference does not exist in the versification. */
export function verseIndex(bookId: number, chapter: number, verse: number): number {
  const bk = BOOKS[bookId];
  if (!bk || !Number.isInteger(chapter) || !Number.isInteger(verse)) return -1;
  if (chapter < 1 || chapter > bk.chapterCount) return -1;
  const ch = CHAPTERS[bk.firstChapter + chapter - 1];
  if (verse < 1 || verse > ch.verseCount) return -1;
  return ch.globalPosition + verse - 1;
}

export function chapterIndex(bookId: number, chapter: number): number {
  const bk = BOOKS[bookId];
  if (!bk || chapter < 1 || chapter > bk.chapterCount) return -1;
  return bk.firstChapter + chapter - 1;
}

export function getVerse(g: number): Verse {
  return {
    id: g,
    bookId: VERSE_BOOK[g],
    chapter: CHAPTERS[VERSE_CHAPTER[g]].number,
    verse: VERSE_NUMBER[g],
    chapterId: VERSE_CHAPTER[g],
    globalPosition: versePosition(g),
  };
}

/** Normalised centre position (0..1) of a verse on the global axis. */
export function versePosition(g: number): number {
  return (g + 0.5) / TOTAL_VERSES;
}

/** OSIS-style identifier, identical to the OpenBible.info notation: "Gen.1.1". */
export function osisId(g: number): string {
  return `${BOOKS[VERSE_BOOK[g]].code}.${CHAPTERS[VERSE_CHAPTER[g]].number}.${VERSE_NUMBER[g]}`;
}

/** OpenBible notation for a (possibly single-verse) range: "John.1.1-John.1.3". */
export function osisRange(start: number, end: number): string {
  return start === end ? osisId(start) : `${osisId(start)}-${osisId(end)}`;
}

/** Parses "Gen.1.1" into a global verse index (-1 when invalid). */
export function parseOsisVerse(id: string): number {
  const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(id);
  if (!m) return -1;
  const bk = BOOK_BY_CODE.get(m[1]);
  if (!bk) return -1;
  return verseIndex(bk.id, Number(m[2]), Number(m[3]));
}

export function bookName(bookId: number, lang: Lang, short = false): string {
  const bk = BOOKS[bookId];
  return short ? bk.short[lang] : bk.name[lang];
}

/** Human-readable verse label: "John 3:16" / "Juan 3:16". */
export function formatVerse(g: number, lang: Lang, short = false): string {
  return `${bookName(VERSE_BOOK[g], lang, short)} ${CHAPTERS[VERSE_CHAPTER[g]].number}:${VERSE_NUMBER[g]}`;
}

/** Human-readable range: "John 1:1–3", "Gen 11:32–12:1", "2 John 1:1 – 3 John 1:15". */
export function formatRange(start: number, end: number, lang: Lang, short = false): string {
  if (start === end) return formatVerse(start, lang, short);
  const [a, b] = start <= end ? [start, end] : [end, start];
  if (VERSE_BOOK[a] !== VERSE_BOOK[b]) return `${formatVerse(a, lang, short)} – ${formatVerse(b, lang, short)}`;
  if (VERSE_CHAPTER[a] !== VERSE_CHAPTER[b]) {
    return `${formatVerse(a, lang, short)}–${CHAPTERS[VERSE_CHAPTER[b]].number}:${VERSE_NUMBER[b]}`;
  }
  return `${formatVerse(a, lang, short)}–${VERSE_NUMBER[b]}`;
}

export function formatChapter(chapterId: number, lang: Lang, short = false): string {
  const ch = CHAPTERS[chapterId];
  return `${bookName(ch.bookId, lang, short)} ${ch.number}`;
}

export function testamentOfVerse(g: number): Testament {
  return g < NT_START ? 'OT' : 'NT';
}

/** Verse-index interval [start, end] (inclusive) of a book. */
export function bookSpan(bookId: number): [number, number] {
  const bk = BOOKS[bookId];
  return [bk.firstVerse, bk.firstVerse + bk.verseCount - 1];
}

export function chapterSpan(chapterId: number): [number, number] {
  const ch = CHAPTERS[chapterId];
  return [ch.globalPosition, ch.globalPosition + ch.verseCount - 1];
}

export function testamentSpan(t: Testament): [number, number] {
  return t === 'OT' ? [0, NT_START - 1] : [NT_START, TOTAL_VERSES - 1];
}
