import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, applyFilters, referencesTouching, type FilterState } from '../../src/analysis/filters.ts';
import { BOOKS, NT_START, VERSE_BOOK, bookByCode, parseOsisVerse } from '../../src/data/bibleStructure.ts';
import { deriveReferences } from '../../src/data/references.ts';
import { computeDegrees } from '../../src/analysis/degrees.ts';
import { loadColumns } from './helpers.ts';

const cols = loadColumns();
const d = deriveReferences(cols, 'start');
const run = (patch: Partial<FilterState>) => applyFilters(cols, d, { ...DEFAULT_FILTERS, ...patch });

describe('filters on the full dataset', () => {
  it('default filters keep everything (including negative votes)', () => {
    expect(run({}).length).toBe(cols.count);
  });

  it('testament filters partition the data', () => {
    const otot = run({ testament: 'OT-OT' }), ntnt = run({ testament: 'NT-NT' }), cross = run({ testament: 'cross' });
    expect(otot.length + ntnt.length + cross.length).toBe(cols.count);
    for (const i of otot) expect(cols.sourceStart[i] < NT_START && cols.targetStart[i] < NT_START).toBe(true);
    for (const i of ntnt) expect(cols.sourceStart[i] >= NT_START && cols.targetStart[i] >= NT_START).toBe(true);
    for (const i of cross) expect(cols.sourceStart[i] < NT_START !== cols.targetStart[i] < NT_START).toBe(true);
  });

  it('filters by book and direction', () => {
    const isa = bookByCode('Isa')!.id;
    const out = run({ books: [isa], bookDirection: 'out' });
    const inn = run({ books: [isa], bookDirection: 'in' });
    const both = run({ books: [isa], bookDirection: 'both' });
    expect(out.length).toBeGreaterThan(0);
    for (const i of out) expect(VERSE_BOOK[cols.sourceStart[i]]).toBe(isa);
    for (const i of inn) expect(VERSE_BOOK[cols.targetStart[i]] === isa || VERSE_BOOK[cols.targetEnd[i]] === isa).toBe(true);
    const intra = [...out].filter((i) => VERSE_BOOK[cols.targetStart[i]] === isa || VERSE_BOOK[cols.targetEnd[i]] === isa).length;
    expect(both.length).toBe(out.length + inn.length - intra);
  });

  it('filters connections between two book groups', () => {
    const isa = bookByCode('Isa')!.id, matt = bookByCode('Matt')!.id;
    const pair = run({ books: [isa], targetBooks: [matt], bookDirection: 'out' });
    expect(pair.length).toBeGreaterThan(0);
    for (const i of pair) expect([VERSE_BOOK[cols.sourceStart[i]], VERSE_BOOK[cols.targetStart[i]]]).toEqual([isa, matt]);
    const sym = run({ books: [isa], targetBooks: [matt], bookDirection: 'both' });
    expect(sym.length).toBeGreaterThan(pair.length);
  });

  it('handles negative votes with the minimum-votes filter', () => {
    const nonNeg = run({ minVotes: 0 });
    let negatives = 0;
    for (let i = 0; i < cols.count; i++) if (cols.votes[i] < 0) negatives++;
    expect(nonNeg.length).toBe(cols.count - negatives);
    for (const i of run({ minVotes: 100 })) expect(cols.votes[i]).toBeGreaterThanOrEqual(100);
  });

  it('distance classes partition the data', () => {
    const near = run({ distance: { near: true, mid: false, far: false } }).length;
    const mid = run({ distance: { near: false, mid: true, far: false } }).length;
    const far = run({ distance: { near: false, mid: false, far: true } }).length;
    expect(near + mid + far).toBe(cols.count);
    expect(run({ distance: { near: false, mid: false, far: false } }).length).toBe(0);
  });

  it('Top N is the deterministic, most-voted prefix', () => {
    const top = run({ top: 1000 });
    expect(top.length).toBe(1000);
    expect(Array.from(top)).toEqual(Array.from({ length: 1000 }, (_, i) => i));
    expect(Array.from(run({ top: 1000 }))).toEqual(Array.from(top));
    for (let k = 1; k < top.length; k++) expect(cols.votes[top[k]]).toBeLessThanOrEqual(cols.votes[top[k - 1]]);
    const otTop = run({ testament: 'OT-OT', top: 500 });
    expect(otTop.length).toBe(500);
  });

  it('verse selection matches the per-verse degrees (ranges included)', () => {
    const deg = computeDegrees(cols);
    const g = parseOsisVerse('John.3.16');
    const out = referencesTouching(cols, null, g, g, 'out');
    const inn = referencesTouching(cols, null, g, g, 'in');
    expect(out.length).toBe(deg.out[g]);
    expect(inn.length).toBe(deg.in[g]);
    // A verse inside a target range (John 1:2 in John.1.1-John.1.3) is found as incoming.
    const j12 = parseOsisVerse('John.1.2');
    const genesis = referencesTouching(cols, null, j12, j12, 'in');
    expect([...genesis].some((i) => cols.sourceStart[i] === 0)).toBe(true);
  });

  it('every book appears as a source', () => {
    const seen = new Set<number>();
    for (let i = 0; i < cols.count; i++) seen.add(VERSE_BOOK[cols.sourceStart[i]]);
    expect(seen.size).toBe(BOOKS.length);
  });
});
