import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, applyFilters } from '../../src/analysis/filters.ts';
import { bookByCode, osisRange, parseOsisVerse } from '../../src/data/bibleStructure.ts';
import { deriveReferences } from '../../src/data/references.ts';
import { ORIGIN } from '../../src/data/sources.ts';
import { parseTskEntry } from '../../src/data/tsk.ts';
import { loadColumns } from './helpers.ts';

// Excerpt of the TSK entry for Proverbs 4:23 (CrossWire SWORD module, ThML).
const PROV_4_23 =
  '<br />Keep.<br /><scripRef>22:5; 23:19; 28:26; De 4:9; Ps 139:23,24; Jer 17:9; Mr 14:38</scripRef><br /><scripRef>Heb 12:15</scripRef>' +
  '<br />with all diligence.  Heb. above all keeping.<br /><scripRef>7; 3:21; 11:16; 13:3; Ec 5:13</scripRef>' +
  '<br />for.<br /><scripRef>Mt 12:35; 15:19; Mr 7:21-23; Jas 1:14,15</scripRef>';

describe('Treasury of Scripture Knowledge parser', () => {
  const prov = bookByCode('Prov')!.id;
  const spans = parseTskEntry(PROV_4_23, prov, 4).map((s) => osisRange(s.start, s.end));
  it('parses books, chapters, verse lists and ranges', () => {
    expect(spans).toContain('Deut.4.9');
    expect(spans).toContain('Ps.139.24');
    expect(spans).toContain('Mark.7.21-Mark.7.23');
    expect(spans).toContain('Matt.15.19');
  });
  it('resolves bare numbers against the entry and keeps context on continuation lines', () => {
    expect(spans.slice(0, 3)).toEqual(['Prov.22.5', 'Prov.23.19', 'Prov.28.26']);
    expect(spans).toContain('Heb.12.15');
    expect(spans).toContain('Prov.4.7'); // "7" after a new keyword = same chapter as the entry
    expect(spans).toContain('Prov.3.21');
  });
  it('ignores chapter outlines and editorial markers', () => {
    const s = parseTskEntry('<scripRef passage="Ge 1:3">3</scripRef> the light;<br />x.<br /><scripRef>*marg:; Ps 33:6</scripRef>', 0, 1);
    expect(s.map((x) => osisRange(x.start, x.end))).toEqual(['Ps.33.6']);
  });
});

describe('provenance of the full dataset', () => {
  const cols = loadColumns();
  const find = (src: string, tgt: string) => {
    for (let i = 0; i < cols.count; i++) if (osisRange(cols.sourceStart[i], cols.sourceEnd[i]) === src && osisRange(cols.targetStart[i], cols.targetEnd[i]) === tgt) return i;
    return -1;
  };
  it('classifies every record and most come from the TSK', () => {
    const counts = [0, 0, 0];
    for (let i = 0; i < cols.count; i++) counts[cols.origin[i]]++;
    expect(counts.reduce((a, b) => a + b, 0)).toBe(cols.count);
    expect((counts[ORIGIN.TSK] + counts[ORIGIN.TSK_REVERSE]) / cols.count).toBeGreaterThan(0.95);
    const report = JSON.parse(readFileSync('public/data/import-report.json', 'utf8')).provenance;
    expect([report.openbible, report.tsk, report.tskReverse]).toEqual(counts);
  });
  it('matches hand-checked examples', () => {
    expect(cols.origin[find('Gen.1.1', 'Rev.4.11')]).toBe(ORIGIN.TSK);
    expect(cols.origin[find('Prov.4.23', 'Luke.6.45')]).toBe(ORIGIN.OPENBIBLE); // TSK lists Mt 12:35, Mr 7:21-23 only
    expect(cols.origin[find('John.3.16', 'John.3.36')]).toBe(ORIGIN.TSK_REVERSE); // TSK lists it under John 3:36
    expect(parseOsisVerse('John.3.36')).toBeGreaterThan(0);
  });
  it('the source filter partitions the data', () => {
    const d = deriveReferences(cols, 'start');
    const tsk = applyFilters(cols, d, { ...DEFAULT_FILTERS, source: 'tsk' }).length;
    const ob = applyFilters(cols, d, { ...DEFAULT_FILTERS, source: 'openbible' }).length;
    expect(tsk + ob).toBe(cols.count);
    for (const i of applyFilters(cols, d, { ...DEFAULT_FILTERS, source: 'openbible' })) expect(cols.origin[i]).toBe(ORIGIN.OPENBIBLE);
  });
});
