import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOKS } from '../../src/data/bibleStructure.ts';
import type { BookText } from '../../src/data/textTypes.ts';

const book = (code: string, osis: string): BookText => JSON.parse(readFileSync(`public/data/texts/${code}/${osis}.json`, 'utf8'));

describe('Bible texts', () => {
  it('provides RV1909 text for every verse', () => {
    let empty = 0;
    for (const b of BOOKS) for (const ch of book('RV1909', b.code).chapters) for (const v of ch) if (!v) empty++;
    expect(empty).toBe(0);
  });
  it('aligns shifted RV1909 chapters to KJV numbering', () => {
    const num = book('RV1909', 'Num');
    expect(num.chapters[11][15]).toMatch(/^Y DESPUÉS movió el pueblo de Haseroth/); // KJV Num 12:16 = RV 13:1
    expect(num.chapters[12][0]).toBe('Y Jehová habló á Moisés, diciendo:'); // KJV Num 13:1 = RV 13:2
    expect(num.notes['13:1']).toEqual({ kind: 'remapped', from: 'Num 13:2' });
    const jonah = book('RV1909', 'Jonah');
    expect(jonah.chapters[0][16]).toMatch(/gran pez/); // KJV Jonah 1:17 = RV 2:1
    const job = book('RV1909', 'Job');
    expect(job.chapters[40][0]).toMatch(/^¿SACARÁS tú al leviathán/);
    expect(job.notes['40:1']).toMatchObject({ kind: 'shared', covers: ['Job 39:27', 'Job 40:5'] });
  });
  it('keeps unmodified text where numbering agrees', () => {
    expect(book('RV1909', 'John').chapters[2][15]).toMatch(/^Porque de tal manera amó Dios al mundo/);
    expect(book('WEB', 'John').chapters[2][15]).toMatch(/^For God so loved the world/);
    expect(book('RV1909', 'Gen').chapters[0][0]).toBe('EN el principio crió Dios los cielos y la tierra.');
  });
  it('never invents text: WEB omissions stay empty and are labelled', () => {
    const luke = book('WEB', 'Luke');
    expect(luke.chapters[16][35]).toBe('');
    expect(luke.notes['17:36']).toEqual({ kind: 'empty' });
    const rom = book('WEB', 'Rom');
    expect(rom.notes['16:25']).toEqual({ kind: 'remapped', from: 'Rom 14:24' });
  });
  it('maps the dataset-only verse 3 John 1:15 to 3 John 1:14', () => {
    const j = book('RV1909', '3John');
    expect(j.chapters[0]).toHaveLength(15);
    expect(j.notes['1:15']).toMatchObject({ kind: 'versification', from: '3John 1:14' });
  });
  it('records licence and provenance', () => {
    for (const code of ['RV1909', 'WEB']) {
      const meta = JSON.parse(readFileSync(`public/data/texts/${code}/meta.json`, 'utf8'));
      expect(meta.license).toBe('Public Domain');
      expect(meta.sourceUrl).toMatch(/^https:\/\/ebible\.org\//);
    }
  });
});
