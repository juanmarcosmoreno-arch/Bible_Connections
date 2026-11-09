import { describe, expect, it } from 'vitest';
import { osisId, osisRange } from '../../src/data/bibleStructure.ts';
import { parseReference, searchReferences } from '../../src/data/search.ts';

const id = (q: string, lang: 'en' | 'es' = 'en') => {
  const r = parseReference(q, lang);
  return r ? osisRange(r.start, r.end) : null;
};

describe('reference search', () => {
  it('recognises the examples from the specification', () => {
    expect(id('Genesis 1:1')).toBe('Gen.1.1');
    expect(id('Gen 1:1')).toBe('Gen.1.1');
    expect(id('John 3:16')).toBe('John.3.16');
    expect(id('Juan 3:16', 'es')).toBe('John.3.16');
    expect(parseReference('Salmos 23', 'es')).toMatchObject({ kind: 'chapter', chapter: 23 });
    expect(id('Romanos 8:28', 'es')).toBe('Rom.8.28');
  });
  it('accepts accents, abbreviations, numbered books and OSIS ids', () => {
    expect(id('Éxodo 20:3', 'es')).toBe('Exod.20.3');
    expect(id('exodo 20:3', 'es')).toBe('Exod.20.3');
    expect(id('1 Juan 4:8', 'es')).toBe('1John.4.8');
    expect(id('1Jn 4:8')).toBe('1John.4.8');
    expect(id('I Juan 4:8', 'es')).toBe('1John.4.8');
    expect(id('Gn 1,1', 'es')).toBe('Gen.1.1');
    expect(id('John.3.16')).toBe('John.3.16');
    expect(id('Apocalipsis 22:21', 'es')).toBe('Rev.22.21');
    expect(id('Cantar de los Cantares 2:1', 'es')).toBe('Song.2.1');
    expect(id('Song of Solomon 2:1')).toBe('Song.2.1');
  });
  it('supports verse ranges and single-chapter books', () => {
    expect(id('Sal 23:1-4', 'es')).toBe('Ps.23.1-Ps.23.4');
    expect(id('Jude 3')).toBe('Jude.1.3');
  });
  it('returns book suggestions for partial names', () => {
    const r = searchReferences('jo', 'en');
    expect(r.length).toBeGreaterThan(1);
    expect(r.every((x) => x.kind === 'book')).toBe(true);
  });
  it('rejects passages that do not exist', () => {
    expect(parseReference('Genesis 51')).toBeNull();
    expect(parseReference('Juan 3:99', 'es')).toBeNull();
    expect(parseReference('xyz 1:1')).toBeNull();
    expect(parseReference('')).toBeNull();
  });
  it('ranks the interface language first for ambiguous abbreviations', () => {
    const es = parseReference('so 1', 'es');
    const en = parseReference('so 1', 'en');
    expect(osisId(es!.start)).toBe('Zeph.1.1');
    expect(osisId(en!.start)).toBe('Song.1.1');
  });
});
