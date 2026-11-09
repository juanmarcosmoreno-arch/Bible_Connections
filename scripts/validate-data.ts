/**
 * Validates the generated data in public/data against the original source file:
 *  - every source record is present exactly once in the binary (identifiers + votes),
 *  - referential integrity of verse indices and ranges,
 *  - gzip and raw binaries are identical,
 *  - statistics totals and translation files are consistent with the Bible structure.
 *
 *   npm run data:validate        (exit code 1 on failure)
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { BOOKS, CHAPTERS, TOTAL_VERSES, osisRange } from '../src/data/bibleStructure.ts';
import { decodeReferences, type DataManifest } from '../src/data/format.ts';
import type { Statistics } from '../src/analysis/statistics.ts';
import { OUT_DIR, isMain } from './lib/io.ts';

export interface ValidationResult {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
}

export function validateData(): ValidationResult {
  const checks: ValidationResult['checks'] = [];
  const check = (name: string, ok: boolean, detail = '') => checks.push({ name, ok, detail });

  const manifest: DataManifest = JSON.parse(readFileSync(`${OUT_DIR}/manifest.json`, 'utf8'));
  const raw = readFileSync(`${OUT_DIR}/${manifest.references.file}`);
  const gz = gunzipSync(readFileSync(`${OUT_DIR}/${manifest.references.gzFile}`));
  check('gzip payload equals raw binary', Buffer.compare(raw, gz) === 0);
  const cols = decodeReferences(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), manifest.references.count);

  // Independent re-read of the source (does not use the import parser's output).
  const lines = readFileSync('data-source/cross_references.txt', 'utf8').split('\n').slice(1).filter((l) => l.trim());
  const expected = new Map<string, number>();
  for (const l of lines) {
    const [from, to, votes] = l.split('\t');
    const key = `${from.trim()}\t${to.trim()}\t${Number(votes)}`;
    expected.set(key, (expected.get(key) ?? 0) + 1);
  }
  const report = JSON.parse(readFileSync(`${OUT_DIR}/${manifest.importReport}`, 'utf8'));
  check(
    'record count = source lines − invalid − duplicates',
    cols.count === lines.length - report.invalid.count - report.duplicates.count,
    `${cols.count} vs ${lines.length} lines (${report.invalid.count} invalid, ${report.duplicates.count} duplicates)`,
  );

  let integrity = 0, missing = 0, sorted = 0;
  for (let i = 0; i < cols.count; i++) {
    const s0 = cols.sourceStart[i], s1 = cols.sourceEnd[i], t0 = cols.targetStart[i], t1 = cols.targetEnd[i];
    if (!(s0 <= s1 && s1 < TOTAL_VERSES && t0 <= t1 && t1 < TOTAL_VERSES)) integrity++;
    const key = `${osisRange(s0, s1)}\t${osisRange(t0, t1)}\t${cols.votes[i]}`;
    const c = expected.get(key);
    if (!c) missing++;
    else expected.set(key, c - 1);
    if (i > 0 && cols.votes[i] > cols.votes[i - 1]) sorted++;
  }
  check('all verse indices and ranges valid', integrity === 0, `${integrity} invalid`);
  check('every binary record matches a source line', missing === 0, `${missing} unmatched`);
  const leftover = [...expected.values()].reduce((a, c) => a + c, 0);
  check('every valid source line is in the binary', leftover === report.invalid.count + report.duplicates.count, `${leftover} left over`);
  check('records sorted by votes (desc)', sorted === 0, `${sorted} order violations`);

  const stats: Statistics = JSON.parse(readFileSync(`${OUT_DIR}/${manifest.statistics}`, 'utf8'));
  const tsum = Object.values(stats.testaments).reduce((a, b) => a + b, 0);
  const ssum = stats.scope.sameChapter + stats.scope.sameBook + stats.scope.otherBook;
  const msum = stats.matrix.counts.reduce((a, b) => a + b, 0);
  check('statistics totals consistent', stats.totals.references === cols.count && tsum === cols.count && ssum === cols.count && msum === cols.count, `${tsum}/${ssum}/${msum}`);

  const pv = report.provenance;
  let origins = 0;
  for (let i = 0; i < cols.count; i++) if (cols.origin[i] <= 2) origins++;
  check('every record has a provenance (TSK / TSK reverse / OpenBible)', origins === cols.count && pv.tsk + pv.tskReverse + pv.openbible === cols.count, `TSK ${pv.tsk}, reverse ${pv.tskReverse}, OpenBible ${pv.openbible}`);

  for (const t of manifest.translations) {
    let bad = 0;
    for (const b of BOOKS) {
      const data = JSON.parse(readFileSync(`${OUT_DIR}/${t.path}/${b.code}.json`, 'utf8'));
      if (data.chapters.length !== b.chapterCount) bad++;
      data.chapters.forEach((vs: string[], ci: number) => {
        if (vs.length !== CHAPTERS[b.firstChapter + ci].verseCount) bad++;
      });
    }
    check(`translation ${t.code} matches versification`, bad === 0, `${bad} mismatched chapters`);
  }
  return { ok: checks.every((c) => c.ok), checks };
}

if (isMain(import.meta.url)) {
  const r = validateData();
  for (const c of r.checks) console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  if (!r.ok) process.exit(1);
}
