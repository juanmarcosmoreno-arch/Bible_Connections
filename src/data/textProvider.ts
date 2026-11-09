/**
 * BibleTextProvider: loads Bible translations from local static files.
 *
 * Each translation lives in public/data/texts/<CODE>/ with a meta.json (name, language,
 * licence, versification, provenance) and one JSON file per book. Texts are never
 * generated: if a verse has no text in an edition, the provider says so.
 * New translations are added by placing a VPL file and translation.json in
 * data-source/texts/<id>/ and running `npm run data`.
 */
import { BOOKS, CHAPTERS, VERSE_BOOK, VERSE_CHAPTER, VERSE_NUMBER } from './bibleStructure.ts';
import { DATA_BASE, loadJSON, loadManifest } from './loader.ts';
import type { BookText, TranslationMeta, VerseNote } from './textTypes.ts';

export type { BookText, TranslationMeta, VerseNote };

export interface VerseText {
  verse: number; // global verse index
  text: string; // '' when the edition has no text for this verse
  note?: VerseNote;
}

export class BibleTextProvider {
  private books = new Map<string, Promise<BookText>>();
  private metas = new Map<string, Promise<TranslationMeta>>();

  async listTranslations(): Promise<TranslationMeta[]> {
    const m = await loadManifest();
    return Promise.all(m.translations.map((t) => this.getMeta(t.code)));
  }

  getMeta(code: string): Promise<TranslationMeta> {
    if (!this.metas.has(code)) this.metas.set(code, loadJSON<TranslationMeta>(`texts/${code}/meta.json`));
    return this.metas.get(code)!;
  }

  getBook(code: string, bookId: number): Promise<BookText> {
    const key = `${code}/${bookId}`;
    if (!this.books.has(key)) {
      const p = loadJSON<BookText>(`texts/${code}/${BOOKS[bookId].code}.json`);
      p.catch(() => this.books.delete(key));
      this.books.set(key, p);
    }
    return this.books.get(key)!;
  }

  /** Texts for every verse in [start, end] (global indices, inclusive). */
  async getRange(code: string, start: number, end: number): Promise<VerseText[]> {
    const bookIds = new Set<number>();
    for (let b = VERSE_BOOK[start]; b <= VERSE_BOOK[end]; b++) bookIds.add(b);
    const loaded = new Map<number, BookText>();
    await Promise.all([...bookIds].map(async (b) => loaded.set(b, await this.getBook(code, b))));
    const out: VerseText[] = [];
    for (let g = start; g <= end; g++) {
      const bt = loaded.get(VERSE_BOOK[g])!;
      const ch = CHAPTERS[VERSE_CHAPTER[g]];
      const v = VERSE_NUMBER[g];
      out.push({ verse: g, text: bt.chapters[ch.number - 1]?.[v - 1] ?? '', note: bt.notes[`${ch.number}:${v}`] });
    }
    return out;
  }

  async getVerse(code: string, g: number): Promise<VerseText> {
    return (await this.getRange(code, g, g))[0];
  }
}

export const textProvider = new BibleTextProvider();

export const textUrl = (code: string, bookId: number) => `${DATA_BASE}texts/${code}/${BOOKS[bookId].code}.json`;
