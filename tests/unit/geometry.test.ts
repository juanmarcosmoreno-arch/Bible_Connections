import { describe, expect, it } from 'vitest';
import { distanceClass, distanceToT } from '../../src/analysis/distance.ts';
import { buildArcBuffers, clampView, computeLayout, hitTest } from '../../src/visualizations/ArcVisualization/geometry.ts';

describe('arc geometry', () => {
  it('uses semicircles unless the canvas is wider than 2:1', () => {
    expect(computeLayout(1000, 800, false).ratio).toBe(1);
    expect(computeLayout(2000, 500, false).ratio).toBeLessThan(1);
  });
  it('finds an arc at its apex and ignores empty space', () => {
    const idx = Uint32Array.of(7);
    const b = buildArcBuffers(idx, new Float32Array(8).fill(0.2), new Float32Array(8).fill(0.6), new Float32Array(8), new Float32Array(8));
    const layout = computeLayout(1000, 700, false);
    const view = { x0: 0, x1: 1 };
    // centre x = 400 px, radius a = 200 px, apex at baseline - 200 * ratio
    expect(hitTest(b, view, layout, 400, layout.baseline - 200 * layout.ratio)).toBe(0);
    expect(hitTest(b, view, layout, 400, layout.baseline - 100)).toBe(-1);
  });
  it('buckets arcs by distance without losing any', () => {
    const n = 1000;
    const idx = Uint32Array.from({ length: n }, (_, i) => i);
    const src = Float32Array.from({ length: n }, () => 0.1);
    const tgt = Float32Array.from({ length: n }, (_, i) => 0.1 + (i / n) * 0.8);
    const b = buildArcBuffers(idx, src, tgt, new Float32Array(n), new Float32Array(n), true);
    expect(b.buckets!.reduce((a, x) => a + x.count, 0)).toBe(n);
    expect([...b.indices].sort((a, c) => a - c)).toEqual([...idx]);
  });
  it('clamps the view domain', () => {
    expect(clampView({ x0: -0.5, x1: 0.2 })).toEqual({ x0: 0, x1: 0.7 });
    expect(clampView({ x0: -1, x1: 3 })).toEqual({ x0: 0, x1: 1 });
  });
  it('maps distances to colour classes consistently', () => {
    expect(distanceClass(0.01)).toBe('near');
    expect(distanceClass(0.1)).toBe('mid');
    expect(distanceClass(0.5)).toBe('far');
    expect(distanceToT(0)).toBe(0);
    expect(distanceToT(0.03)).toBeCloseTo(1 / 3);
    expect(distanceToT(0.2)).toBeCloseTo(2 / 3);
    expect(distanceToT(1)).toBe(1);
  });
});
