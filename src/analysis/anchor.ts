/**
 * Anchoring rule: how a verse range becomes a single position for drawing an arc.
 * The canonical data always keeps the full range; anchoring only affects geometry,
 * distance classes and colours.
 *
 *  - 'start'  : first verse of the range (default; matches how OpenBible lists ranges)
 *  - 'center' : midpoint of the range
 *  - 'end'    : last verse of the range
 */
export type AnchorRule = 'start' | 'center' | 'end';

export const DEFAULT_ANCHOR: AnchorRule = 'start';

/** Anchored verse index (may be fractional for 'center'). */
export function anchorIndex(start: number, end: number, rule: AnchorRule): number {
  if (rule === 'start') return start;
  if (rule === 'end') return end;
  return (start + end) / 2;
}
