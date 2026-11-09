import { describe, expect, it } from 'vitest';
import { compareRecords, decodeReferences, encodeReferences, type EncodableRecord } from '../../src/data/format.ts';

const rec = (s: number, se: number, t: number, te: number, v: number): EncodableRecord => ({ source: { start: s, end: se }, target: { start: t, end: te }, votes: v });

describe('binary format', () => {
  it('round-trips records, including negative votes and ranges', () => {
    const records = [rec(5, 5, 30000, 30002, 1317), rec(31102, 31102, 0, 0, 50), rec(0, 0, 3, 3, 50), rec(10, 12, 20, 20, -86)].sort(compareRecords);
    const cols = decodeReferences(encodeReferences(records), records.length);
    records.forEach((r, i) => {
      expect([cols.sourceStart[i], cols.sourceEnd[i], cols.targetStart[i], cols.targetEnd[i], cols.votes[i]]).toEqual([r.source.start, r.source.end, r.target.start, r.target.end, r.votes]);
    });
  });
  it('sorts by votes, then canonical position', () => {
    const sorted = [rec(9, 9, 1, 1, 3), rec(2, 2, 1, 1, 3), rec(1, 1, 1, 1, 10)].sort(compareRecords);
    expect(sorted.map((r) => r.source.start)).toEqual([1, 2, 9]);
  });
  it('rejects buffers of the wrong size', () => {
    expect(() => decodeReferences(new ArrayBuffer(10), 2)).toThrow();
  });
});
