/**
 * Distance between the two ends of a connection, as a fraction of the whole Bible
 * (|anchor(target) - anchor(source)| / total verses), in [0, 1].
 *
 * Classes are chosen close to the terciles of the full OpenBible dataset
 * (33rd percentile ≈ 0.035, 66th ≈ 0.20):
 *   near  ≤ 0.03   intermediate ≤ 0.20   far > 0.20
 */
export type DistanceClass = 'near' | 'mid' | 'far';

export const DISTANCE_BREAKS = { near: 0.03, mid: 0.2 } as const;

export function distanceClass(d: number): DistanceClass {
  if (d <= DISTANCE_BREAKS.near) return 'near';
  if (d <= DISTANCE_BREAKS.mid) return 'mid';
  return 'far';
}

/** Maps a normalised distance to the colour-scale parameter t in [0, 1] (piecewise linear). */
export function distanceToT(d: number): number {
  const { near, mid } = DISTANCE_BREAKS;
  if (d <= near) return (d / near) / 3;
  if (d <= mid) return 1 / 3 + ((d - near) / (mid - near)) / 3;
  return Math.min(1, 2 / 3 + ((d - mid) / (1 - mid)) / 3);
}
