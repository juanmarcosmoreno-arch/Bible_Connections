/** Shared types for the arc renderers. */

export interface ViewDomain {
  x0: number; // normalised (0..1) left edge of the visible window
  x1: number;
}

export interface ArcLayout {
  width: number; // CSS px
  height: number;
  baseline: number; // y of the axis line (CSS px)
  arcHeight: number; // vertical room above the baseline for the tallest arc in view
  ratio: number; // ellipse ratio b / a = 2 * arcHeight / width
}

/** Per-arc attributes for the currently filtered set, in draw order. */
export interface ArcBuffers {
  count: number;
  /** Interleaved [sourcePos, targetPos, colorT, weight] per arc (Float32). */
  data: Float32Array;
  /** Reference index of each arc. */
  indices: Uint32Array;
  /**
   * Optional grouping by normalised distance (contiguous ranges, vote order kept inside
   * each group). Lets the GPU renderer pick a segment count per group for the zoom level.
   */
  buckets?: { start: number; count: number; maxDist: number }[];
}

export interface RenderParams {
  view: ViewDomain;
  layout: ArcLayout;
  dpr: number;
  theme: 'dark' | 'light';
  /** Intensity: base alpha (direct blending) or exposure (tone-mapped accumulation). */
  alpha: number;
  /** User intensity multiplier (settings). */
  intensity: number;
  /** True while the user zooms/pans (renderer may lower resolution). */
  interacting: boolean;
  /** Line width in CSS px. */
  lineWidth: number;
  /** Draw only the first N arcs of the base set (level of detail); null = all. */
  limit: number | null;
  /** 0..1: intro animation progress (arcs grow from the axis). */
  grow: number;
  /** Whether a highlight set is active (base arcs are dimmed). */
  dimmed: boolean;
  /** Transparent background (export). */
  transparent?: boolean;
  background: string;
}

export interface ArcRenderer {
  readonly kind: 'webgl' | 'canvas';
  setArcs(buffers: ArcBuffers): void;
  setHighlight(buffers: ArcBuffers | null): void;
  setHover(buffers: ArcBuffers | null): void;
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  /** Draws a frame. Returns false while a progressive render is still incomplete. */
  render(params: RenderParams): boolean;
  /** True while the previous frame is still being processed by the GPU (frame pacing). */
  busy?(): boolean;
  /** Approximate duration (ms) of the last completed GPU frame. */
  lastFrameMs?(): number;
  dispose(): void;
}
