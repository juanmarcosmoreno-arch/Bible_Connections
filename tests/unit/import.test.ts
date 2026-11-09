import { describe, expect, it } from 'vitest';
import { importCrossReferences } from '../../scripts/import-crossrefs.ts';
import { osisRange } from '../../src/data/bibleStructure.ts';
import { loadColumns, sourceLines } from './helpers.ts';

describe('full import of cross_references.txt', () => {
  const result = importCrossReferences();
  const lines = sourceLines();

  it('imports every valid record (none lost)', () => {
    const r = result.report;
    expect(r.dataLines).toBe(lines.length);
    expect(r.imported).toBe(r.dataLines - r.invalid.count - r.duplicates.count);
    expect(r.imported).toBe(344799);
    expect(r.invalid.count).toBe(0);
    expect(r.duplicates.count).toBe(0);
    expect(r.roundTrip.mismatches).toBe(0);
  });

  it('keeps ranges and votes as in the source', () => {
    expect(result.report.ranges.targetRanges).toBe(lines.filter((l) => l.split('\t')[1].includes('-')).length);
    expect(result.report.votes.negative).toBe(lines.filter((l) => Number(l.split('\t')[2]) < 0).length);
    expect(result.report.votes.min).toBe(-86);
    expect(result.report.votes.max).toBe(1317);
  });

  it('published binary contains exactly the source records', () => {
    const cols = loadColumns();
    expect(cols.count).toBe(lines.length);
    const expected = new Set(lines.map((l) => l.split('\t').slice(0, 3).map((x) => x.trim()).join('\t')));
    let missing = 0;
    for (let i = 0; i < cols.count; i++) {
      const key = `${osisRange(cols.sourceStart[i], cols.sourceEnd[i])}\t${osisRange(cols.targetStart[i], cols.targetEnd[i])}\t${cols.votes[i]}`;
      if (!expected.delete(key)) missing++;
    }
    expect(missing).toBe(0);
    expect(expected.size).toBe(0);
  });

  it('keeps referential integrity', () => {
    const cols = loadColumns();
    for (let i = 0; i < cols.count; i++) {
      if (cols.sourceStart[i] > cols.sourceEnd[i] || cols.targetStart[i] > cols.targetEnd[i] || cols.targetEnd[i] >= 31103) throw new Error(`bad record ${i}`);
    }
  });
});
