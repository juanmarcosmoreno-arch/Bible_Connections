import { interpolateLab, piecewise, rgb } from 'd3';

/**
 * Continuous colour scale for arc distance:
 * violet → blue (near) → green → yellow (intermediate) → orange → red (far).
 * Interpolated in CIELAB for perceptually smooth transitions.
 */
export const ARC_COLOR_STOPS = ['#8b5cf6', '#4f7cff', '#22b8cf', '#3ddc84', '#f5d547', '#fb923c', '#ef4444'];

export const arcColor = piecewise(interpolateLab, ARC_COLOR_STOPS);

/** 256-entry RGBA lookup table (Uint8) for the GPU and canvas renderers. */
export function arcColorLUT(size = 256): Uint8Array {
  const lut = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const c = rgb(arcColor(i / (size - 1)));
    lut[i * 4] = Math.round(c.r);
    lut[i * 4 + 1] = Math.round(c.g);
    lut[i * 4 + 2] = Math.round(c.b);
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

/** Categorical palette for communities / genres (validated for dark and light backgrounds). */
export const CATEGORICAL = [
  '#4f7cff', '#f59e0b', '#22c55e', '#ec4899', '#06b6d4', '#a855f7', '#ef4444', '#84cc16', '#f97316', '#14b8a6', '#eab308', '#6366f1',
];

export function categorical(i: number): string {
  return CATEGORICAL[((i % CATEGORICAL.length) + CATEGORICAL.length) % CATEGORICAL.length];
}
