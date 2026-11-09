import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeStatistics } from '../../src/analysis/statistics.ts';
import { loadColumns } from './helpers.ts';

describe('statistics (full dataset)', () => {
  const cols = loadColumns();
  const s = computeStatistics(cols);
  it('totals are consistent', () => {
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    expect(s.totals.references).toBe(cols.count);
    expect(sum(s.testaments)).toBe(cols.count);
    expect(sum(s.scope)).toBe(cols.count);
    expect(sum(s.distance.classes)).toBe(cols.count);
    expect(s.matrix.counts.reduce((a, b) => a + b, 0)).toBe(cols.count);
    expect(s.votes.histogram.reduce((a, b) => a + b.count, 0)).toBe(cols.count);
    expect(s.distance.histogram.reduce((a, b) => a + b.count, 0)).toBe(cols.count);
    expect(s.books.reduce((a, b) => a + b.out, 0)).toBe(cols.count);
  });
  it('rankings are sorted', () => {
    for (let i = 1; i < s.topVerses.length; i++) expect(s.topVerses[i].total).toBeLessThanOrEqual(s.topVerses[i - 1].total);
    for (let i = 1; i < s.topReferences.length; i++) expect(s.topReferences[i].votes).toBeLessThanOrEqual(s.topReferences[i - 1].votes);
    expect(s.topReferences[0].votes).toBe(1317);
  });
  it('matches the published statistics file', () => {
    const published = JSON.parse(readFileSync('public/data/statistics/statistics.json', 'utf8'));
    expect(published.totals).toEqual(JSON.parse(JSON.stringify(s.totals)));
    expect(published.testaments).toEqual(s.testaments);
  });
});
