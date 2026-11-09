/**
 * Runtime model of the cross-reference table plus derived, anchor-dependent arrays.
 */
import { anchorIndex, type AnchorRule } from '../analysis/anchor.ts';
import { distanceClass, distanceToT, type DistanceClass } from '../analysis/distance.ts';
import { NT_START, TOTAL_VERSES, VERSE_BOOK, osisRange } from './bibleStructure.ts';
import type { ReferenceColumns } from './format.ts';

export type { ReferenceColumns };

/** CrossReference entity (materialised on demand from the columnar store). */
export interface CrossReference {
  index: number; // rank in (votes desc, source asc, target asc) order
  source: string; // original OpenBible identifier, e.g. "Gen.1.1"
  target: string; // e.g. "John.1.1-John.1.3"
  votes: number;
  sourceRange: [number, number]; // global verse indices (inclusive)
  targetRange: [number, number];
  sourcePosition: number; // anchored, normalised 0..1
  targetPosition: number;
  distance: number; // |targetPosition - sourcePosition|
  distanceClass: DistanceClass;
}

export interface DerivedReferences {
  anchor: AnchorRule;
  /** Anchored normalised positions (0..1). */
  sourcePos: Float32Array;
  targetPos: Float32Array;
  /** Normalised distance (0..1). */
  distance: Float32Array;
  /** Colour parameter t (0..1). */
  colorT: Float32Array;
  /** 0 = near, 1 = intermediate, 2 = far. */
  distClass: Uint8Array;
  sourceBook: Uint8Array;
  targetBook: Uint8Array; // book of the anchored target verse
  targetEndBook: Uint8Array; // book of the last verse of the target range
  /** Bit 0: source in NT, bit 1: target in NT. */
  testaments: Uint8Array;
}

const CLASS_CODE: Record<DistanceClass, number> = { near: 0, mid: 1, far: 2 };

export function deriveReferences(cols: ReferenceColumns, anchor: AnchorRule): DerivedReferences {
  const n = cols.count;
  const sourcePos = new Float32Array(n);
  const targetPos = new Float32Array(n);
  const distance = new Float32Array(n);
  const colorT = new Float32Array(n);
  const distClass = new Uint8Array(n);
  const sourceBook = new Uint8Array(n);
  const targetBook = new Uint8Array(n);
  const targetEndBook = new Uint8Array(n);
  const testaments = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const s = anchorIndex(cols.sourceStart[i], cols.sourceEnd[i], anchor);
    const t = anchorIndex(cols.targetStart[i], cols.targetEnd[i], anchor);
    sourcePos[i] = (s + 0.5) / TOTAL_VERSES;
    targetPos[i] = (t + 0.5) / TOTAL_VERSES;
    const d = Math.abs(t - s) / TOTAL_VERSES;
    distance[i] = d;
    colorT[i] = distanceToT(d);
    distClass[i] = CLASS_CODE[distanceClass(d)];
    sourceBook[i] = VERSE_BOOK[Math.floor(s)];
    targetBook[i] = VERSE_BOOK[Math.floor(t)];
    targetEndBook[i] = VERSE_BOOK[cols.targetEnd[i]];
    testaments[i] = (s >= NT_START ? 1 : 0) | (t >= NT_START ? 2 : 0);
  }
  return { anchor, sourcePos, targetPos, distance, colorT, distClass, sourceBook, targetBook, targetEndBook, testaments };
}

export function getCrossReference(cols: ReferenceColumns, d: DerivedReferences, i: number): CrossReference {
  return {
    index: i,
    source: osisRange(cols.sourceStart[i], cols.sourceEnd[i]),
    target: osisRange(cols.targetStart[i], cols.targetEnd[i]),
    votes: cols.votes[i],
    sourceRange: [cols.sourceStart[i], cols.sourceEnd[i]],
    targetRange: [cols.targetStart[i], cols.targetEnd[i]],
    sourcePosition: d.sourcePos[i],
    targetPosition: d.targetPos[i],
    distance: d.distance[i],
    distanceClass: (['near', 'mid', 'far'] as const)[d.distClass[i]],
  };
}
