/**
 * Parser for the cross-references of the Treasury of Scripture Knowledge (TSK, c. 1880,
 * public domain) as distributed in the CrossWire SWORD module "TSK" (ThML markup).
 *
 * Each verse entry lists keywords followed by references inside <scripRef>…</scripRef>:
 *   <br />God.<br /><scripRef>Ps 33:6,9; 148:5; Mt 8:3; Joh 11:43</scripRef>
 * Book and chapter carry over inside a list ("Ps 33:6,9; 148:5"). A bare verse list
 * ("10,12,18") refers to the chapter in context. A new keyword resets the context to the
 * entry's own book and chapter; a line that merely continues a list keeps it.
 * <scripRef passage="…"> tags are chapter outlines, not cross-references, and are ignored.
 */
import { BOOKS, CHAPTERS, verseIndex } from './bibleStructure.ts';

export const TSK_BOOKS: Record<string, string> = {
  Ge: 'Gen', Ex: 'Exod', Le: 'Lev', Nu: 'Num', De: 'Deut', Jos: 'Josh', Jud: 'Judg', Ru: 'Ruth', '1Sa': '1Sam', '2Sa': '2Sam',
  '1Ki': '1Kgs', '2Ki': '2Kgs', '1Ch': '1Chr', '2Ch': '2Chr', Ezr: 'Ezra', Ne: 'Neh', Es: 'Esth', Job: 'Job', Ps: 'Ps', Pr: 'Prov',
  Ec: 'Eccl', So: 'Song', Isa: 'Isa', Jer: 'Jer', La: 'Lam', Eze: 'Ezek', Da: 'Dan', Ho: 'Hos', Joe: 'Joel', Am: 'Amos',
  Ob: 'Obad', Jon: 'Jonah', Mic: 'Mic', Na: 'Nah', Hab: 'Hab', Zep: 'Zeph', Hag: 'Hag', Zec: 'Zech', Mal: 'Mal',
  Mt: 'Matt', Mr: 'Mark', Lu: 'Luke', Joh: 'John', Ac: 'Acts', Ro: 'Rom', '1Co': '1Cor', '2Co': '2Cor', Ga: 'Gal', Eph: 'Eph',
  Php: 'Phil', Col: 'Col', '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim', '2Ti': '2Tim', Tit: 'Titus', Phm: 'Phlm', Heb: 'Heb',
  Jas: 'Jas', '1Pe': '1Pet', '2Pe': '2Pet', '1Jo': '1John', '2Jo': '2John', '3Jo': '3John', Jude: 'Jude', Re: 'Rev',
};

const BOOK_ID = new Map(BOOKS.map((b) => [b.code, b.id]));

export interface Span {
  start: number;
  end: number;
}

export interface TskParseStats {
  parts: number;
  unparsed: number;
}

/** Global verse index of book/chapter/verse, clamping a verse past the chapter end (-1 if invalid). */
function idx(book: number, chapter: number, verse: number): number {
  return verseIndex(book, chapter, verse);
}

/**
 * Extracts the referenced spans of one TSK entry. `book` and `chapter` are the entry's own
 * position (used for bare verse numbers).
 */
export function parseTskEntry(html: string, book: number, chapter: number, stats?: TskParseStats): Span[] {
  const out: Span[] = [];
  const re = /<scripRef>([\s\S]*?)<\/scripRef>/g;
  let ctxBook = book;
  let ctxChapter = chapter;
  let last = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    // Keyword text between the previous list and this one starts a new context.
    const between = html.slice(last, m.index).replace(/<[^>]*>/g, '');
    if (/[A-Za-z]/.test(between)) {
      ctxBook = book;
      ctxChapter = chapter;
    }
    last = m.index + m[0].length;
    for (const rawPart of m[1].split(';')) {
      const part = rawPart.trim();
      // "*marg:", "*title", "*Heb:" … are editorial markers, not references.
      if (!part || part.startsWith('*')) continue;
      if (stats) stats.parts++;
      const bm = /^([1-3]?[A-Za-z]+)\.?\s+(.*)$/.exec(part);
      let rest = part;
      if (bm) {
        const code = TSK_BOOKS[bm[1]];
        const id = code ? BOOK_ID.get(code) : undefined;
        if (id === undefined) {
          if (stats) stats.unparsed++;
          continue;
        }
        ctxBook = id;
        rest = bm[2];
      }
      // Items separated by commas: "33:6", "9", "8:22-30", "1:1-2:3", "10".
      let ok = false;
      for (const item of rest.split(',')) {
        const t = item.trim();
        let mm = /^(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/.exec(t);
        if (mm) {
          ctxChapter = Number(mm[1]);
          const s = idx(ctxBook, ctxChapter, Number(mm[2]));
          const endChapter = mm[3] ? Number(mm[3]) : ctxChapter;
          const e = mm[4] ? idx(ctxBook, endChapter, Number(mm[4])) : s;
          if (mm[3]) ctxChapter = endChapter;
          if (s >= 0) {
            out.push({ start: s, end: e >= s ? e : s });
            ok = true;
          }
          continue;
        }
        mm = /^(\d+)(?:-(\d+))?$/.exec(t);
        if (mm) {
          // A bare number is a verse of the chapter in context; for one-chapter books it is a verse too.
          const s = idx(ctxBook, ctxChapter, Number(mm[1]));
          const e = mm[2] ? idx(ctxBook, ctxChapter, Number(mm[2])) : s;
          if (s >= 0) {
            out.push({ start: s, end: e >= s ? e : s });
            ok = true;
          }
        }
      }
      if (!ok && stats) stats.unparsed++;
    }
  }
  return out;
}

/** Book/chapter of every KJV verse in SWORD index order, for one testament. */
export function swordVerseKeys(testament: 'OT' | 'NT'): { index: number; book: number; chapter: number; verse: number }[] {
  // SWORD KJV layout: [0] module heading, [1] testament heading, then per book a book
  // heading, and per chapter a chapter heading followed by its verses.
  const out: { index: number; book: number; chapter: number; verse: number }[] = [];
  let i = 2;
  for (const b of BOOKS) {
    if (b.testament !== testament) continue;
    i++; // book heading
    for (let c = 1; c <= b.chapterCount; c++) {
      i++; // chapter heading
      const kjvVerses = CHAPTERS[b.firstChapter + c - 1].verseCount - (b.code === '3John' ? 1 : 0); // 3 John 1:15 is not KJV
      for (let v = 1; v <= kjvVerses; v++) out.push({ index: i++, book: b.id, chapter: c, verse: v });
    }
  }
  return out;
}
