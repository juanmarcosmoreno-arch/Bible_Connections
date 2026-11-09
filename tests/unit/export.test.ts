import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, applyFilters } from '../../src/analysis/filters.ts';
import { voteWeights } from '../../src/analysis/degrees.ts';
import { bookByCode } from '../../src/data/bibleStructure.ts';
import { deriveReferences } from '../../src/data/references.ts';
import { arcColor } from '../../src/utils/colors.ts';
import { ATTRIBUTION, SVG_MAX_ARCS, buildArcSVG, connectionsToCSV, connectionsToJSON, filteredStatistics } from '../../src/utils/export.ts';
import { loadColumns } from './helpers.ts';

const cols = loadColumns();
const d = deriveReferences(cols, 'start');
const filters = { ...DEFAULT_FILTERS, books: [bookByCode('Jonah')!.id], bookDirection: 'out' as const };
const idx = applyFilters(cols, d, filters);

describe('exports', () => {
  it('CSV lists the filtered connections with original identifiers', () => {
    const csv = connectionsToCSV(cols, d, idx).trim().split('\n');
    expect(csv[0]).toBe('rank,source,target,votes,source_book,target_book,source_testament,target_testament,distance_verses,distance_class');
    expect(csv).toHaveLength(idx.length + 1);
    for (const line of csv.slice(1)) expect(line.split(',')[1]).toMatch(/^Jonah\.\d+\.\d+$/);
  });
  it('JSON reflects the active filters and includes attribution', () => {
    const json = connectionsToJSON(cols, d, idx, filters, new Date('2026-01-01T00:00:00Z'));
    expect(json.count).toBe(idx.length);
    expect(json.filters).toEqual(filters);
    expect(json.attribution).toBe(ATTRIBUTION);
    expect(json.connections[0].votes).toBeGreaterThanOrEqual(json.connections[json.connections.length - 1].votes);
  });
  it('aggregated statistics add up', () => {
    const s = filteredStatistics(cols, d, idx, filters);
    expect(Object.values(s.testaments).reduce((a, b) => a + b, 0)).toBe(idx.length);
    expect(Object.keys(s.bySourceBook)).toEqual(['Jonah']);
  });
  it('SVG export draws one path per visible arc and refuses huge sets', () => {
    const w = voteWeights(cols);
    const svg = buildArcSVG(d, w, idx, { width: 1200, height: 700, baseline: 640, ratio: 1, view: { x0: 0, x1: 1 }, background: '#08090d', colorOf: arcColor, fg: '#fff', labels: true, legend: true, lang: 'en' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<path /g) ?? []).length).toBeLessThanOrEqual(idx.length);
    expect((svg.match(/<path /g) ?? []).length).toBeGreaterThan(idx.length * 0.9);
    expect(svg).toContain('CC BY 4.0');
    const all = applyFilters(cols, d, DEFAULT_FILTERS);
    expect(all.length).toBeGreaterThan(SVG_MAX_ARCS);
    expect(() => buildArcSVG(d, w, all, { width: 10, height: 10, baseline: 5, ratio: 1, view: { x0: 0, x1: 1 }, background: null, colorOf: arcColor, fg: '#fff', labels: false, legend: false, lang: 'en' })).toThrow();
  });
});
