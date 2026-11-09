/**
 * Provenance of each cross-reference.
 *
 * OpenBible.info states that its data "draws primarily from public-domain sources, especially
 * the Treasury of Scripture Knowledge" (TSK, c. 1880), plus data from its Topical Bible and
 * Twitter Bible Search. The export does not say which record comes from where, so Bible
 * Connections compares every record with the TSK itself (CrossWire SWORD module "TSK",
 * public domain):
 *
 *  - TSK          the TSK lists the target under the source verse;
 *  - TSK_REVERSE  the TSK lists the pair in the opposite direction (target → source);
 *  - OPENBIBLE    the pair is not in the TSK: added by OpenBible.info (Topical Bible,
 *                 Twitter Bible Search or user contributions; not distinguishable further).
 */
export const ORIGIN = { OPENBIBLE: 0, TSK: 1, TSK_REVERSE: 2 } as const;

export type OriginCode = (typeof ORIGIN)[keyof typeof ORIGIN];

export type SourceFilter = 'all' | 'tsk' | 'openbible';

export function isTsk(code: number): boolean {
  return code === ORIGIN.TSK || code === ORIGIN.TSK_REVERSE;
}

export const ORIGIN_KEYS = ['openbible', 'tsk', 'tsk-reverse'] as const;
