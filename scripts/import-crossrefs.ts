/**
 * Imports data-source/cross_references.txt (OpenBible.info) into the optimised binary
 * format used by the app, and writes a detailed import report.
 *
 *   node scripts/import-crossrefs.ts
 */
import { readFileSync } from 'node:fs';
import { parseCrossReferences, type RawCrossReference } from '../src/data/parser.ts';
import { compareRecords, decodeReferences, encodeReferences } from '../src/data/format.ts';
import { VERSE_BOOK, VERSE_CHAPTER, osisId, VERSIFICATION_ADDITIONS, parseOsisVerse } from '../src/data/bibleStructure.ts';
import { OUT_DIR, gzip, isMain, resetDir, sha256, writeBinary, writeJson } from './lib/io.ts';

export const SOURCE_FILE = 'data-source/cross_references.txt';

export interface ImportResult {
  records: RawCrossReference[]; // sorted, de-duplicated
  report: ImportReport;
  binFile: string;
  gzFile: string;
  bytes: number;
  gzBytes: number;
  sourceSha256: string;
  header: string;
  buffer: Uint8Array;
  gzBuffer: Uint8Array;
}

export interface ImportReport {
  sourceFile: string;
  sourceSha256: string;
  header: string;
  totalLines: number;
  dataLines: number;
  parsed: number;
  invalid: { count: number; byKind: Record<string, number>; examples: unknown[] };
  duplicates: { count: number; examples: { line: number; firstLine: number; raw: string }[] };
  imported: number;
  ranges: { sourceRanges: number; targetRanges: number; crossChapterTargetRanges: number; crossBookTargetRanges: number; maxTargetSpan: number };
  votes: { min: number; max: number; negative: number; zero: number; positive: number };
  selfReferences: number;
  reciprocalPairs: number;
  versificationAdditionsUsed: { verse: string; references: number }[];
  roundTrip: { checked: number; mismatches: number };
}

export function importCrossReferences(path = SOURCE_FILE): ImportResult {
  const content = readFileSync(path, 'utf8');
  const sourceSha256 = sha256(content);
  const parsed = parseCrossReferences(content);

  // Duplicate detection on the canonical key (source span + target span).
  const seen = new Map<string, number>();
  const unique: RawCrossReference[] = [];
  const duplicates: ImportReport['duplicates']['examples'] = [];
  let dupCount = 0;
  for (const r of parsed.records) {
    const key = `${r.source.start}:${r.source.end}>${r.target.start}:${r.target.end}`;
    const first = seen.get(key);
    if (first !== undefined) {
      dupCount++;
      if (duplicates.length < 50) duplicates.push({ line: r.line, firstLine: first, raw: `${r.sourceId}\t${r.targetId}\t${r.votes}` });
      continue;
    }
    seen.set(key, r.line);
    unique.push(r);
  }

  const byKind: Record<string, number> = {};
  for (const e of parsed.errors) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

  let sourceRanges = 0, targetRanges = 0, crossChapter = 0, crossBook = 0, maxSpan = 0;
  let neg = 0, zero = 0, pos = 0, min = Infinity, max = -Infinity, self = 0;
  const pairKeys = new Set<string>();
  for (const r of unique) {
    if (r.source.end !== r.source.start) sourceRanges++;
    if (r.target.end !== r.target.start) {
      targetRanges++;
      if (VERSE_CHAPTER[r.target.start] !== VERSE_CHAPTER[r.target.end]) crossChapter++;
      if (VERSE_BOOK[r.target.start] !== VERSE_BOOK[r.target.end]) crossBook++;
      maxSpan = Math.max(maxSpan, r.target.end - r.target.start + 1);
    }
    if (r.votes < 0) neg++; else if (r.votes === 0) zero++; else pos++;
    min = Math.min(min, r.votes);
    max = Math.max(max, r.votes);
    if (r.source.start <= r.target.end && r.target.start <= r.source.end) self++;
    pairKeys.add(`${r.source.start}>${r.target.start}`);
  }
  let reciprocal = 0;
  for (const r of unique) if (r.source.start !== r.target.start && pairKeys.has(`${r.target.start}>${r.source.start}`)) reciprocal++;

  const additionsUsed = VERSIFICATION_ADDITIONS.map((a) => {
    const id = `${a.osis}.${a.chapter}.${a.verse}`;
    const g = parseOsisVerse(id);
    const n = unique.filter((r) => [r.source.start, r.source.end, r.target.start, r.target.end].includes(g)).length;
    return { verse: id, references: n };
  });

  const sorted = unique.slice().sort(compareRecords);
  const buf = new Uint8Array(encodeReferences(sorted));
  const gz = gzip(buf);
  const hash = sha256(buf).slice(0, 10);

  // Round-trip check: decode the binary and rebuild every original identifier.
  const cols = decodeReferences(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), sorted.length);
  let mismatches = 0;
  const span = (s: number, e: number) => (s === e ? osisId(s) : `${osisId(s)}-${osisId(e)}`);
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (
      span(cols.sourceStart[i], cols.sourceEnd[i]) !== r.sourceId ||
      span(cols.targetStart[i], cols.targetEnd[i]) !== r.targetId ||
      cols.votes[i] !== r.votes
    ) mismatches++;
  }
  if (mismatches) throw new Error(`Round-trip failed for ${mismatches} records`);

  const report: ImportReport = {
    sourceFile: path,
    sourceSha256,
    header: parsed.header,
    totalLines: parsed.totalLines,
    dataLines: parsed.dataLines,
    parsed: parsed.records.length,
    invalid: { count: parsed.errors.length, byKind, examples: parsed.errors.slice(0, 50) },
    duplicates: { count: dupCount, examples: duplicates },
    imported: sorted.length,
    ranges: { sourceRanges, targetRanges, crossChapterTargetRanges: crossChapter, crossBookTargetRanges: crossBook, maxTargetSpan: maxSpan },
    votes: { min, max, negative: neg, zero, positive: pos },
    selfReferences: self,
    reciprocalPairs: reciprocal,
    versificationAdditionsUsed: additionsUsed,
    roundTrip: { checked: sorted.length, mismatches },
  };

  return {
    records: sorted,
    report,
    binFile: `references/refs.${hash}.bin`,
    // Neutral extension: some servers would otherwise add "Content-Encoding: gzip".
    gzFile: `references/refs.${hash}.gzbin`,
    bytes: buf.byteLength,
    gzBytes: gz.byteLength,
    sourceSha256,
    header: parsed.header,
    buffer: buf,
    gzBuffer: gz,
  };
}

export function writeImport(result: ImportResult): void {
  resetDir(`${OUT_DIR}/references`);
  writeBinary(`${OUT_DIR}/${result.binFile}`, result.buffer);
  writeBinary(`${OUT_DIR}/${result.gzFile}`, result.gzBuffer);
  writeJson(`${OUT_DIR}/import-report.json`, result.report, true);
}

if (isMain(import.meta.url)) {
  const t0 = performance.now();
  const res = importCrossReferences();
  writeImport(res);
  const { report } = res;
  console.log(
    `Imported ${report.imported} of ${report.dataLines} records ` +
      `(${report.invalid.count} invalid, ${report.duplicates.count} duplicates) in ${(performance.now() - t0).toFixed(0)} ms; ` +
      `binary ${res.bytes} B, gzip ${res.gzBytes} B`,
  );
}
