/**
 * Bible reference search, in Spanish and English.
 *
 * Accepts e.g. "Genesis 1:1", "Gen 1:1", "Gn 1,1", "John 3:16", "Juan 3:16", "Salmos 23",
 * "Romanos 8:28", "1 Juan 4:8", "1Jn 4:8", "I Juan 4", "Sal 23:1-4", "John.3.16".
 * Accents, case, dots and extra spaces are ignored.
 */
import { BOOK_META } from './books.ts';
import { BOOKS, CHAPTERS, chapterIndex, verseIndex, type Lang } from './bibleStructure.ts';

export type SearchKind = 'book' | 'chapter' | 'verse' | 'range';

export interface SearchResult {
  kind: SearchKind;
  bookId: number;
  chapter?: number;
  verse?: number;
  verseEnd?: number;
  /** Global verse interval covered by the result. */
  start: number;
  end: number;
  /** How the book part matched: exact alias or name prefix. */
  match: 'exact' | 'prefix';
}

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/([a-z])\./g, '$1 ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

const ORDINALS: [RegExp, string][] = [
  [/^(iii|3rd|third|tercera|tercero|3ra|3ro|3a|3o)\s+/, '3 '],
  [/^(ii|2nd|second|segunda|segundo|2da|2do|2a|2o)\s+/, '2 '],
  [/^(i|1st|first|primera|primero|1ra|1ro|1a|1o)\s+/, '1 '],
];

/** Collapses a book phrase into a lookup key: "1 juan" → "1juan", "cantar de los cantares" → "cantardeloscantares". */
function bookKey(s: string): string {
  let x = s.trim();
  for (const [re, rep] of ORDINALS) x = x.replace(re, rep);
  return x.replace(/\s+/g, '');
}

interface AliasEntry {
  key: string;
  bookId: number;
  lang: Lang;
}

const ALIASES: AliasEntry[] = (() => {
  const out: AliasEntry[] = [];
  const seen = new Set<string>();
  BOOK_META.forEach((m, bookId) => {
    const add = (s: string, lang: Lang) => {
      const key = bookKey(normalize(s));
      const id = `${key}|${bookId}|${lang}`;
      if (key && !seen.has(id)) {
        seen.add(id);
        out.push({ key, bookId, lang });
      }
    };
    [m.nameEn, m.shortEn, m.osis, ...m.aliasesEn].forEach((s) => add(s, 'en'));
    [m.nameEs, m.shortEs, ...m.aliasesEs].forEach((s) => add(s, 'es'));
  });
  return out;
})();

/** Candidate books for a (normalised) book phrase, best first. */
export function matchBooks(phrase: string, lang: Lang = 'en'): { bookId: number; match: 'exact' | 'prefix' }[] {
  const key = bookKey(phrase);
  if (!key) return [];
  const score = (e: AliasEntry, exact: boolean) => (exact ? 0 : 100) + (e.lang === lang ? 0 : 10) + e.bookId / 100;
  const best = new Map<number, { s: number; match: 'exact' | 'prefix' }>();
  for (const e of ALIASES) {
    const exact = e.key === key;
    if (!exact && !e.key.startsWith(key)) continue;
    const s = score(e, exact);
    const cur = best.get(e.bookId);
    if (!cur || s < cur.s) best.set(e.bookId, { s, match: exact ? 'exact' : 'prefix' });
  }
  const list = [...best.entries()].sort((a, b) => a[1].s - b[1].s);
  // If any exact match exists, prefix matches are only suggestions after it.
  return list.map(([bookId, v]) => ({ bookId, match: v.match }));
}

const QUERY_RE = /^((?:[1-3]|i{1,3}|1st|2nd|3rd|first|second|third|primera|primero|segunda|segundo|tercera|tercero|1ra|1ro|2da|2do|3ra|3ro|1a|2a|3a|1o|2o|3o)?\s*[a-zñ][a-zñ ]*?)\s*(?:(\d+)(?:\s*[:., ]\s*(\d+)(?:\s*-\s*(\d+))?)?)?$/;

/** Parses a query into ranked results (empty when nothing valid matches). */
export function searchReferences(query: string, lang: Lang = 'en', limit = 8): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const m = QUERY_RE.exec(q);
  if (!m) return [];
  const [, bookPart, chStr, vStr, vEndStr] = m;
  const books = matchBooks(bookPart, lang);
  const out: SearchResult[] = [];
  for (const { bookId, match } of books) {
    const bk = BOOKS[bookId];
    if (!chStr) {
      out.push({ kind: 'book', bookId, start: bk.firstVerse, end: bk.firstVerse + bk.verseCount - 1, match });
      continue;
    }
    // Single-chapter books accept "Jude 3" as a verse reference.
    let chapter = Number(chStr);
    let verse = vStr ? Number(vStr) : undefined;
    let verseEnd = vEndStr ? Number(vEndStr) : undefined;
    if (!vStr && bk.chapterCount === 1 && chapter > 1) {
      verse = chapter;
      chapter = 1;
    }
    const ci = chapterIndex(bookId, chapter);
    if (ci < 0) continue;
    const ch = CHAPTERS[ci];
    if (verse === undefined) {
      out.push({ kind: 'chapter', bookId, chapter, start: ch.globalPosition, end: ch.globalPosition + ch.verseCount - 1, match });
      continue;
    }
    const g = verseIndex(bookId, chapter, verse);
    if (g < 0) continue;
    if (verseEnd !== undefined && verseEnd > verse) {
      const ge = verseIndex(bookId, chapter, Math.min(verseEnd, ch.verseCount));
      out.push({ kind: 'range', bookId, chapter, verse, verseEnd: Math.min(verseEnd, ch.verseCount), start: g, end: ge, match });
    } else {
      out.push({ kind: 'verse', bookId, chapter, verse, start: g, end: g, match });
    }
  }
  return out.slice(0, limit);
}

/** Best single result, or null. */
export function parseReference(query: string, lang: Lang = 'en'): SearchResult | null {
  return searchReferences(query, lang, 1)[0] ?? null;
}
