import type { ArcBuffers, ArcLayout, ViewDomain } from './types.ts';

export const MIN_VIEW_SPAN = 24 / 31103; // about 24 verses

export function computeLayout(width: number, height: number, compact: boolean): ArcLayout {
  const axis = compact ? 50 : 64;
  const top = compact ? 8 : 16;
  const baseline = Math.max(40, height - axis);
  const arcHeight = Math.max(20, baseline - top);
  // Semicircles (ratio 1) as in the original; flattened only when the canvas is wider than 2:1.
  return { width, height, baseline, arcHeight, ratio: Math.min(1, (2 * arcHeight) / Math.max(1, width)) };
}

export function posToPx(pos: number, view: ViewDomain, width: number): number {
  return ((pos - view.x0) / (view.x1 - view.x0)) * width;
}

export function pxToPos(px: number, view: ViewDomain, width: number): number {
  return view.x0 + (px / width) * (view.x1 - view.x0);
}

export function clampView(v: ViewDomain): ViewDomain {
  let span = Math.min(1, Math.max(MIN_VIEW_SPAN, v.x1 - v.x0));
  let x0 = v.x0;
  if (span >= 1) return { x0: 0, x1: 1 };
  x0 = Math.min(1 - span, Math.max(0, x0));
  return { x0, x1: x0 + span };
}

/** Distance group edges (normalised) used to choose a per-group segment count. */
export const DISTANCE_BUCKETS = [0.002, 0.008, 0.03, 0.1, 0.3, 1.01];

/**
 * Builds interleaved GPU-ready buffers for a list of reference indices.
 * With `bucketed`, arcs are grouped by distance (stable, so vote order is kept per group).
 */
export function buildArcBuffers(
  indices: Uint32Array,
  sourcePos: Float32Array,
  targetPos: Float32Array,
  colorT: Float32Array,
  weight: Float32Array,
  bucketed = false,
): ArcBuffers {
  const n = indices.length;
  let order = indices;
  let buckets: ArcBuffers['buckets'];
  if (bucketed) {
    const nb = DISTANCE_BUCKETS.length;
    const bucketOf = new Uint8Array(n);
    const counts = new Array(nb).fill(0);
    for (let k = 0; k < n; k++) {
      const i = indices[k];
      const d = Math.abs(targetPos[i] - sourcePos[i]);
      let b = 0;
      while (b < nb - 1 && d > DISTANCE_BUCKETS[b]) b++;
      bucketOf[k] = b;
      counts[b]++;
    }
    const starts = counts.map((_, b) => counts.slice(0, b).reduce((a, c) => a + c, 0));
    const cursor = starts.slice();
    order = new Uint32Array(n);
    for (let k = 0; k < n; k++) order[cursor[bucketOf[k]]++] = indices[k];
    buckets = counts.map((count, b) => ({ start: starts[b], count, maxDist: DISTANCE_BUCKETS[b] }));
  }
  const data = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const i = order[k];
    data[k * 4] = sourcePos[i];
    data[k * 4 + 1] = targetPos[i];
    data[k * 4 + 2] = colorT[i];
    data[k * 4 + 3] = weight[i];
  }
  return { count: n, data, indices: order, buckets };
}

/**
 * Finds the arc closest to (mx, my) (CSS px), within `tol` px. Arcs are half-ellipses with
 * semi-axes a = |x2 - x1| / 2 and b = a * ratio. Distance is approximated with the
 * first-order formula |F| / |∇F| for F(x, y) = (x/a)² + (y/b)² - 1.
 * Earlier arcs (more votes) win ties. Returns the position in `buffers`, or -1.
 */
export function hitTest(buffers: ArcBuffers, view: ViewDomain, layout: ArcLayout, mx: number, my: number, tol = 4, limit = Infinity): number {
  const { data } = buffers;
  const n = Math.min(buffers.count, limit);
  const k = layout.width / (view.x1 - view.x0);
  const dy = layout.baseline - my;
  if (dy < -tol) return -1;
  let best = -1;
  let bestD = Infinity;
  let bestW = -1;
  for (let i = 0; i < n; i++) {
    const p1 = (data[i * 4] - view.x0) * k;
    const p2 = (data[i * 4 + 1] - view.x0) * k;
    const cx = (p1 + p2) * 0.5;
    const a = Math.abs(p2 - p1) * 0.5;
    if (a < 0.5) continue;
    const dx = mx - cx;
    if (dx < -a - tol || dx > a + tol) continue;
    const b = a * layout.ratio;
    if (dy > b + tol) continue;
    const u = dx / a, v = dy / b;
    const F = u * u + v * v - 1;
    const gx = (2 * dx) / (a * a), gy = (2 * dy) / (b * b);
    const g = Math.sqrt(gx * gx + gy * gy);
    if (g === 0) continue;
    const d = Math.abs(F) / g;
    if (d > tol) continue;
    // Prefer the closer arc; within half a pixel prefer the more voted one (larger weight).
    const w = data[i * 4 + 3];
    if (best < 0 || d < bestD - 0.5 || (d <= bestD + 0.5 && w > bestW)) {
      best = i;
      bestD = d;
      bestW = w;
    }
  }
  return best;
}

/** Default alpha so that the overall density looks similar for any number of arcs. */
export function autoAlpha(n: number, userScale: number): number {
  if (n <= 0) return 0.8;
  return Math.min(0.9, Math.max(0.02, 0.85 * Math.sqrt(1200 / n))) * userScale;
}

/** Exposure for the tone-mapped accumulation renderer. */
export function autoExposure(n: number, span: number, userScale: number): number {
  if (n <= 0) return 1;
  // Calibrated visually: white point for the full dataset, rising as fewer arcs are drawn.
  const density = Math.min(0.6, 0.0052 * Math.pow(345000 / n, 0.75));
  const zoom = Math.min(4, Math.pow(1 / Math.max(1e-6, span), 0.3));
  return density * zoom * userScale;
}
