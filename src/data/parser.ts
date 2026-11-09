/**
 * Parser for the OpenBible.info cross-reference export (tab separated):
 *
 *   From Verse <TAB> To Verse <TAB> Votes
 *   Gen.1.1        John.1.1-John.1.3   387
 *
 * Both columns may hold a single verse ("Book.C.V") or a range ("Book.C.V-Book.C.V").
 * Ranges are kept as ranges (start/end verse indices); they are never expanded into
 * several independent connections.
 */
import { BOOKS, bookByCode, verseIndex } from './bibleStructure.ts';

export interface VerseSpan {
  start: number; // global verse index
  end: number; // global verse index (== start for a single verse)
}

export interface RawCrossReference {
  line: number; // 1-based line number in the source file
  sourceId: string; // original identifier, untouched
  targetId: string;
  source: VerseSpan;
  target: VerseSpan;
  votes: number;
}

export type ParseErrorKind =
  | 'malformed-line'
  | 'malformed-reference'
  | 'unknown-book'
  | 'invalid-chapter'
  | 'invalid-verse'
  | 'reversed-range'
  | 'invalid-votes';

export interface ParseError {
  line: number;
  kind: ParseErrorKind;
  detail: string;
  raw: string;
}

const VERSE_RE = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/;

type VerseResult = { ok: true; index: number } | { ok: false; kind: ParseErrorKind; detail: string };

export function parseVerseId(id: string): VerseResult {
  const m = VERSE_RE.exec(id);
  if (!m) return { ok: false, kind: 'malformed-reference', detail: id };
  const bk = bookByCode(m[1]);
  if (!bk) return { ok: false, kind: 'unknown-book', detail: m[1] };
  const chapter = Number(m[2]);
  const verse = Number(m[3]);
  if (chapter < 1 || chapter > bk.chapterCount) return { ok: false, kind: 'invalid-chapter', detail: id };
  const idx = verseIndex(bk.id, chapter, verse);
  if (idx < 0) return { ok: false, kind: 'invalid-verse', detail: id };
  return { ok: true, index: idx };
}

type SpanResult = { ok: true; span: VerseSpan } | { ok: false; kind: ParseErrorKind; detail: string };

/** Parses "Gen.1.1" or "Gen.1.1-Gen.1.3" (also tolerates the short form "Gen.1.1-3"). */
export function parseSpan(id: string): SpanResult {
  const parts = id.split('-');
  if (parts.length > 2 || parts.some((p) => p.length === 0)) return { ok: false, kind: 'malformed-reference', detail: id };
  const a = parseVerseId(parts[0]);
  if (!a.ok) return a;
  if (parts.length === 1) return { ok: true, span: { start: a.index, end: a.index } };
  let endId = parts[1];
  if (/^\d+$/.test(endId)) endId = parts[0].replace(/\d+$/, endId); // "Gen.1.1-3"
  else if (/^\d+\.\d+$/.test(endId)) endId = `${parts[0].split('.')[0]}.${endId}`; // "Gen.1.1-2.3"
  const b = parseVerseId(endId);
  if (!b.ok) return b;
  if (b.index < a.index) return { ok: false, kind: 'reversed-range', detail: id };
  return { ok: true, span: { start: a.index, end: b.index } };
}

export type LineResult =
  | { ok: true; record: RawCrossReference }
  | { ok: false; error: ParseError }
  | { ok: 'skip' };

export function parseLine(raw: string, line: number): LineResult {
  const text = raw.replace(/\r$/, '');
  if (text.trim() === '') return { ok: 'skip' };
  const cols = text.split('\t');
  if (cols.length < 3) return { ok: false, error: { line, kind: 'malformed-line', detail: `${cols.length} columns`, raw } };
  const [from, to, votesStr] = cols.map((c) => c.trim());
  if (!/^-?\d+$/.test(votesStr)) return { ok: false, error: { line, kind: 'invalid-votes', detail: votesStr, raw } };
  const s = parseSpan(from);
  if (!s.ok) return { ok: false, error: { line, kind: s.kind, detail: s.detail, raw } };
  const t = parseSpan(to);
  if (!t.ok) return { ok: false, error: { line, kind: t.kind, detail: t.detail, raw } };
  return {
    ok: true,
    record: { line, sourceId: from, targetId: to, source: s.span, target: t.span, votes: Number(votesStr) },
  };
}

export interface ParseResult {
  header: string;
  records: RawCrossReference[];
  errors: ParseError[];
  totalLines: number;
  dataLines: number;
}

/** Parses the whole file. The first line must be the header ("From Verse ..."). */
export function parseCrossReferences(content: string): ParseResult {
  const lines = content.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const header = lines[0] ?? '';
  if (!/^From Verse\tTo Verse\tVotes/.test(header)) throw new Error(`Unexpected header: ${header.slice(0, 60)}`);
  const records: RawCrossReference[] = [];
  const errors: ParseError[] = [];
  let dataLines = 0;
  for (let i = 1; i < lines.length; i++) {
    const r = parseLine(lines[i], i + 1);
    if (r.ok === 'skip') continue;
    dataLines++;
    if (r.ok) records.push(r.record);
    else errors.push(r.error);
  }
  return { header, records, errors, totalLines: lines.length, dataLines };
}

export const BOOK_CODES = BOOKS.map((b) => b.code);
