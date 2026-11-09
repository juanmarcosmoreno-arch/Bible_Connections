import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from '../../src/analysis/filters.ts';
import { bookByCode, parseOsisVerse } from '../../src/data/bibleStructure.ts';
import { buildHash, parseHash, resolveReference } from '../../src/state/url.ts';
import { loadColumns } from './helpers.ts';

describe('URL state', () => {
  it('round-trips route, selection and filters', () => {
    const g = parseOsisVerse('John.3.16');
    const filters = { ...DEFAULT_FILTERS, testament: 'cross' as const, books: [bookByCode('Isa')!.id], bookDirection: 'out' as const, minVotes: 10, distance: { near: false, mid: true, far: true }, top: 10000 };
    const hash = buildHash('arc', { kind: 'passage', unit: 'verse', start: g, end: g }, filters);
    expect(hash).toContain('sel=v:John.3.16');
    const back = parseHash(hash);
    expect(back.route).toBe('arc');
    expect(back.selection).toEqual({ kind: 'passage', unit: 'verse', start: g, end: g });
    expect(back.filters).toEqual(filters);
  });
  it('defaults gracefully on unknown input', () => {
    const r = parseHash('#/nowhere?sel=v:Foo.1.1&t=zzz');
    expect(r.route).toBe('arc');
    expect(r.selection).toBeNull();
    expect(r.filters).toEqual(DEFAULT_FILTERS);
  });
  it('encodes connections by their original identifiers', () => {
    const cols = loadColumns();
    const hash = buildHash('arc', { kind: 'reference', index: 0 }, DEFAULT_FILTERS, cols);
    const code = decodeURIComponent(hash.split('sel=x:')[1]);
    expect(resolveReference(code, cols)).toBe(0);
  });
});
