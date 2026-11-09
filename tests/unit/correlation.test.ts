import { describe, expect, it } from 'vitest';
import { connectionProfiles, correlationMatrix } from '../../src/analysis/correlation.ts';
import { bookByCode } from '../../src/data/bibleStructure.ts';
import { loadColumns } from './helpers.ts';

describe('correlation of connection profiles', () => {
  const cols = loadColumns();
  const prof = connectionProfiles(cols, 'book');
  const m = correlationMatrix(prof, 'book');
  const r = (a: string, b: string) => m[bookByCode(a)!.id * 66 + bookByCode(b)!.id];
  it('profiles count each reference once per end', () => {
    expect(prof.reduce((a, b) => a + b, 0)).toBe(2 * cols.count);
  });
  it('is symmetric, bounded, with 1 on the diagonal', () => {
    for (let a = 0; a < 66; a++) {
      expect(m[a * 66 + a]).toBe(1);
      for (let b = 0; b < 66; b++) {
        expect(m[a * 66 + b]).toBeCloseTo(m[b * 66 + a], 6);
        expect(Math.abs(m[a * 66 + b])).toBeLessThanOrEqual(1.000001);
      }
    }
  });
  it('finds the expected similarities', () => {
    expect(r('Matt', 'Luke')).toBeGreaterThan(0.95);
    expect(r('Eph', 'Col')).toBeGreaterThan(0.9);
    expect(r('Matt', 'Luke')).toBeGreaterThan(r('Matt', 'Lev'));
  });
  it('matches a direct Pearson computation (leaving out both books)', () => {
    const a = bookByCode('Rom')!.id, b = bookByCode('Gal')!.id;
    const xs: number[] = [], ys: number[] = [];
    for (let k = 0; k < 66; k++) if (k !== a && k !== b) {
      xs.push(prof[a * 66 + k]);
      ys.push(prof[b * 66 + k]);
    }
    const mean = (v: number[]) => v.reduce((p, c) => p + c, 0) / v.length;
    const mx = mean(xs), my = mean(ys);
    let num = 0, dx = 0, dy = 0;
    xs.forEach((x, i) => {
      num += (x - mx) * (ys[i] - my);
      dx += (x - mx) ** 2;
      dy += (ys[i] - my) ** 2;
    });
    expect(m[a * 66 + b]).toBeCloseTo(num / Math.sqrt(dx * dy), 5);
  });
  it('scales to the 1,189 chapters of the whole Bible', () => {
    const mc = correlationMatrix(connectionProfiles(cols, 'chapter'), 'chapter');
    expect(mc.length).toBe(1189 * 1189);
  });
});
