/**
 * Compact columnar binary format for the cross-reference table.
 *
 * Records are sorted by (votes desc, source asc, target start asc, target end asc), so
 * "Top N" is always the deterministic prefix of length N.
 *
 * Layout: 6 consecutive little-endian 16-bit columns of `count` values each:
 *   0 sourceDelta  uint16  source start minus previous source start (mod 65536)
 *   1 sourceLen    uint16  source end - source start (0 for single verses)
 *   2 targetStart  uint16
 *   3 targetLen    uint16  target end - target start
 *   4 votes        int16
 *   5 origin       uint16  provenance code (see sources.ts)
 * Delta-encoding the source column makes it highly compressible because, within each
 * group of equal votes, sources are ascending.
 */
export const FORMAT_VERSION = 2;
const COLUMNS = 6;

export interface ReferenceColumns {
  count: number;
  sourceStart: Uint16Array;
  sourceEnd: Uint16Array;
  targetStart: Uint16Array;
  targetEnd: Uint16Array;
  votes: Int16Array;
  /** Provenance code per reference (see sources.ts). */
  origin: Uint8Array;
}

export interface EncodableRecord {
  source: { start: number; end: number };
  target: { start: number; end: number };
  votes: number;
  origin?: number;
}

export function compareRecords(a: EncodableRecord, b: EncodableRecord): number {
  return (
    b.votes - a.votes ||
    a.source.start - b.source.start ||
    a.source.end - b.source.end ||
    a.target.start - b.target.start ||
    a.target.end - b.target.end
  );
}

/** Encodes records (which must already be sorted with `compareRecords`). */
export function encodeReferences(records: readonly EncodableRecord[]): ArrayBuffer {
  const n = records.length;
  const buf = new ArrayBuffer(n * 2 * COLUMNS);
  const view = new DataView(buf);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const r = records[i];
    if (r.votes < -32768 || r.votes > 32767) throw new Error(`votes out of int16 range: ${r.votes}`);
    view.setUint16((0 * n + i) * 2, (r.source.start - prev) & 0xffff, true);
    view.setUint16((1 * n + i) * 2, r.source.end - r.source.start, true);
    view.setUint16((2 * n + i) * 2, r.target.start, true);
    view.setUint16((3 * n + i) * 2, r.target.end - r.target.start, true);
    view.setInt16((4 * n + i) * 2, r.votes, true);
    view.setUint16((5 * n + i) * 2, r.origin ?? 0, true);
    prev = r.source.start;
  }
  return buf;
}

export function decodeReferences(buf: ArrayBuffer, count: number): ReferenceColumns {
  if (buf.byteLength !== count * 2 * COLUMNS) {
    throw new Error(`Reference buffer has ${buf.byteLength} bytes, expected ${count * 2 * COLUMNS}`);
  }
  const view = new DataView(buf);
  const sourceStart = new Uint16Array(count);
  const sourceEnd = new Uint16Array(count);
  const targetStart = new Uint16Array(count);
  const targetEnd = new Uint16Array(count);
  const votes = new Int16Array(count);
  const origin = new Uint8Array(count);
  let prev = 0;
  for (let i = 0; i < count; i++) {
    const s = (prev + view.getUint16(i * 2, true)) & 0xffff;
    sourceStart[i] = s;
    sourceEnd[i] = s + view.getUint16((count + i) * 2, true);
    const t = view.getUint16((2 * count + i) * 2, true);
    targetStart[i] = t;
    targetEnd[i] = t + view.getUint16((3 * count + i) * 2, true);
    votes[i] = view.getInt16((4 * count + i) * 2, true);
    origin[i] = view.getUint16((5 * count + i) * 2, true);
    prev = s;
  }
  return { count, sourceStart, sourceEnd, targetStart, targetEnd, votes, origin };
}

/** Manifest written next to the binary data (public/data/manifest.json). */
export interface DataManifest {
  formatVersion: number;
  generatedAt: string;
  source: { file: string; sha256: string; license: string; attribution: string; url: string; header: string };
  references: { count: number; file: string; gzFile: string; bytes: number; gzBytes: number; sort: string };
  versification: string;
  totals: { books: number; chapters: number; verses: number };
  translations: { code: string; name: string; language: string; path: string }[];
  statistics: string;
  importReport: string;
}
