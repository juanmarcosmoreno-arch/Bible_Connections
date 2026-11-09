import { describe, expect, it } from 'vitest';
import { parseCrossReferences, parseLine, parseSpan, parseVerseId } from '../../src/data/parser.ts';
import { osisId, parseOsisVerse } from '../../src/data/bibleStructure.ts';

describe('verse identifiers', () => {
  it('parses OpenBible verse ids', () => {
    const r = parseVerseId('Gen.1.1');
    expect(r).toEqual({ ok: true, index: 0 });
    const j = parseVerseId('John.3.16');
    expect(j.ok && osisId(j.index)).toBe('John.3.16');
  });
  it('rejects unknown books, chapters and verses', () => {
    expect(parseVerseId('Foo.1.1')).toMatchObject({ ok: false, kind: 'unknown-book' });
    expect(parseVerseId('Gen.51.1')).toMatchObject({ ok: false, kind: 'invalid-chapter' });
    expect(parseVerseId('Gen.1.32')).toMatchObject({ ok: false, kind: 'invalid-verse' });
    expect(parseVerseId('Gen.1')).toMatchObject({ ok: false, kind: 'malformed-reference' });
    expect(parseVerseId('Gen.0.1')).toMatchObject({ ok: false });
  });
});

describe('verse ranges', () => {
  it('keeps ranges as ranges', () => {
    const r = parseSpan('John.1.1-John.1.3');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(osisId(r.span.start)).toBe('John.1.1');
      expect(osisId(r.span.end)).toBe('John.1.3');
      expect(r.span.end - r.span.start).toBe(2);
    }
  });
  it('handles cross-chapter and cross-book ranges', () => {
    const a = parseSpan('Gen.11.32-Gen.12.1');
    expect(a.ok && a.span.end - a.span.start).toBe(1);
    const b = parseSpan('2John.1.1-3John.1.15');
    expect(b.ok && osisId(b.span.start)).toBe('2John.1.1');
    expect(b.ok && osisId(b.span.end)).toBe('3John.1.15');
  });
  it('accepts short range forms', () => {
    const r = parseSpan('Ps.23.1-4');
    expect(r.ok && [osisId(r.span.start), osisId(r.span.end)]).toEqual(['Ps.23.1', 'Ps.23.4']);
    const c = parseSpan('Gen.1.31-2.3');
    expect(c.ok && osisId(c.span.end)).toBe('Gen.2.3');
  });
  it('rejects reversed and malformed ranges', () => {
    expect(parseSpan('John.1.3-John.1.1')).toMatchObject({ ok: false, kind: 'reversed-range' });
    expect(parseSpan('John.1.1--John.1.3')).toMatchObject({ ok: false, kind: 'malformed-reference' });
  });
});

describe('lines and files', () => {
  it('parses votes, including negative ones', () => {
    const r = parseLine('Gen.1.1\tExod.31.18\t-40', 5);
    expect(r.ok === true && r.record.votes).toBe(-40);
    const z = parseLine('Gen.1.1\tRev.4.11\t0', 6);
    expect(z.ok === true && z.record.votes).toBe(0);
  });
  it('keeps the original identifiers', () => {
    const r = parseLine('Gen.1.1\tJohn.1.1-John.1.3\t387', 2);
    expect(r.ok === true && [r.record.sourceId, r.record.targetId, r.record.line]).toEqual(['Gen.1.1', 'John.1.1-John.1.3', 2]);
  });
  it('reports invalid lines with their line number', () => {
    expect(parseLine('Gen.1.1\tRev.4.11', 9)).toMatchObject({ ok: false, error: { line: 9, kind: 'malformed-line' } });
    expect(parseLine('Gen.1.1\tRev.4.11\tabc', 9)).toMatchObject({ ok: false, error: { kind: 'invalid-votes' } });
    expect(parseLine('', 3)).toEqual({ ok: 'skip' });
  });
  it('parses a whole file and requires the header', () => {
    const txt = 'From Verse\tTo Verse\tVotes\t#comment\nGen.1.1\tRev.4.11\t209\nGen.1.1\tFoo.1.1\t3\n\n';
    const r = parseCrossReferences(txt);
    expect(r.records).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.dataLines).toBe(2);
    expect(() => parseCrossReferences('nope\n')).toThrow();
  });
  it('round-trips OSIS ids', () => {
    expect(osisId(parseOsisVerse('Rev.22.21'))).toBe('Rev.22.21');
  });
});
