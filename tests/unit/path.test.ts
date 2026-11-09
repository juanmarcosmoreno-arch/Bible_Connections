import { describe, expect, it } from 'vitest';
import { buildVerseGraph, findChains, shortestChain } from '../../src/analysis/path.ts';
import { osisId, parseOsisVerse } from '../../src/data/bibleStructure.ts';
import { loadColumns } from './helpers.ts';

describe('path between passages', () => {
  const cols = loadColumns();
  const g = buildVerseGraph(cols);
  const v = (id: string) => parseOsisVerse(id);
  it('finds a chain where each step is a real reference', () => {
    const p = shortestChain(g, [v('Ruth.1.16'), v('Ruth.1.16')], [v('John.3.16'), v('John.3.16')])!;
    expect(p.verses[0]).toBe(v('Ruth.1.16'));
    expect(p.verses[p.verses.length - 1]).toBe(v('John.3.16'));
    expect(p.refs).toHaveLength(p.verses.length - 1);
    p.refs.forEach((i, k) => {
      const a = p.verses[k], b = p.verses[k + 1];
      const inSrc = (x: number) => x >= cols.sourceStart[i] && x <= cols.sourceEnd[i];
      const inTgt = (x: number) => x >= cols.targetStart[i] && x <= cols.targetEnd[i];
      expect((inSrc(a) && inTgt(b)) || (inSrc(b) && inTgt(a))).toBe(true);
    });
  });
  it('returns a direct reference as a one-step chain', () => {
    const p = shortestChain(g, [v('Gen.1.1'), v('Gen.1.1')], [v('Rev.4.11'), v('Rev.4.11')])!;
    expect(p.refs).toHaveLength(1);
  });
  it('alternatives avoid the intermediate verses of earlier chains', () => {
    const chains = findChains(g, [v('Obad.1.1'), v('Obad.1.1')], [v('Phlm.1.1'), v('Phlm.1.1')]);
    expect(chains.length).toBeGreaterThan(1);
    const first = new Set(chains[0].verses.slice(1, -1));
    expect(chains[1].verses.slice(1, -1).some((x) => first.has(x))).toBe(false);
    expect(chains.map((c) => c.verses.map(osisId)[0])).toEqual(chains.map(() => 'Obad.1.1'));
  });
});
