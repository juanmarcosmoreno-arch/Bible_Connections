import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOKS, CHAPTERS, NT_START, TOTAL_CHAPTERS, TOTAL_VERSES, bookSpan, formatRange, osisId, parseOsisVerse, versePosition, verseIndex } from '../../src/data/bibleStructure.ts';
import versification from '../../src/data/versification.json' with { type: 'json' };

describe('Bible structure', () => {
  it('has the Protestant canon in order', () => {
    expect(BOOKS).toHaveLength(66);
    expect(BOOKS[0].code).toBe('Gen');
    expect(BOOKS[38].code).toBe('Mal');
    expect(BOOKS[39].code).toBe('Matt');
    expect(BOOKS[65].code).toBe('Rev');
    expect(BOOKS.filter((b) => b.testament === 'OT')).toHaveLength(39);
  });
  it('matches the KJV totals plus 3 John 1:15', () => {
    expect(TOTAL_CHAPTERS).toBe(1189);
    expect(TOTAL_VERSES).toBe(31102 + 1);
    expect(versification.totals).toEqual({ books: 66, chapters: 1189, verses: 31102 });
    expect(osisId(parseOsisVerse('3John.1.15'))).toBe('3John.1.15');
    expect(BOOKS.find((b) => b.code === 'Ps')!.chapterCount).toBe(150);
    expect(CHAPTERS.find((c) => BOOKS[c.bookId].code === 'Ps' && c.number === 119)!.verseCount).toBe(176);
  });
  it('agrees with the independent RV1909 verse list', () => {
    const lines = readFileSync('data-source/texts/spaRV1909/spaRV1909_vpl.txt', 'utf8').split('\n').filter((l) => l.trim());
    expect(lines).toHaveLength(31102);
  });
  it('starts the New Testament at Matthew 1:1', () => {
    expect(osisId(NT_START)).toBe('Matt.1.1');
    expect(osisId(NT_START - 1)).toBe('Mal.4.6');
  });
  it('round-trips every verse id', () => {
    for (let g = 0; g < TOTAL_VERSES; g++) expect(parseOsisVerse(osisId(g))).toBe(g);
  });
  it('positions verses by their real order (not uniformly per book)', () => {
    for (let g = 1; g < TOTAL_VERSES; g++) expect(versePosition(g)).toBeGreaterThan(versePosition(g - 1));
    const ps = BOOKS.find((b) => b.code === 'Ps')!;
    const obad = BOOKS.find((b) => b.code === 'Obad')!;
    const width = (b: typeof ps) => versePosition(bookSpan(b.id)[1]) - versePosition(bookSpan(b.id)[0]);
    expect(width(ps) / width(obad)).toBeCloseTo((ps.verseCount - 1) / (obad.verseCount - 1), 6);
    expect(versePosition(0)).toBeGreaterThan(0);
    expect(versePosition(TOTAL_VERSES - 1)).toBeLessThan(1);
  });
  it('rejects verses outside the table', () => {
    expect(verseIndex(0, 1, 32)).toBe(-1);
    expect(verseIndex(0, 51, 1)).toBe(-1);
    expect(verseIndex(70, 1, 1)).toBe(-1);
  });
  it('formats ranges', () => {
    const j = parseOsisVerse('John.1.1');
    expect(formatRange(j, j + 2, 'en')).toBe('John 1:1–3');
    expect(formatRange(j, j + 2, 'es')).toBe('Juan 1:1–3');
    expect(formatRange(parseOsisVerse('Gen.11.32'), parseOsisVerse('Gen.12.1'), 'en')).toBe('Genesis 11:32–12:1');
    expect(formatRange(parseOsisVerse('2John.1.1'), parseOsisVerse('3John.1.15'), 'es')).toBe('2 Juan 1:1 – 3 Juan 1:15');
  });
});
