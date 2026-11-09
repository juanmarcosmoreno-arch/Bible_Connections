/**
 * Canvas 2D arc renderer (fallback when WebGL2 is unavailable, and for some exports).
 * Arcs are batched by colour bucket (one path + one stroke per bucket) and drawn
 * progressively in ~12 ms slices, so the main thread is never blocked.
 */
import { arcColorLUT } from '../../utils/colors.ts';
import type { ArcBuffers, ArcRenderer, RenderParams } from './types.ts';

const BUCKETS = 48;
const ALPHA_LEVELS = 3;
const SLICE_MS = 12;

export class CanvasArcRenderer implements ArcRenderer {
  readonly kind = 'canvas' as const;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private base: ArcBuffers | null = null;
  private highlight: ArcBuffers | null = null;
  private hover: ArcBuffers | null = null;
  private lut = arcColorLUT(BUCKETS);
  private progressKey = '';
  private cursor = 0;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  /** Off-screen copy of the finished base layer, reused for hover/highlight changes. */
  private baseCache: HTMLCanvasElement | OffscreenCanvas;
  private baseCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private screenCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private baseDone = false;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) throw new Error('2D canvas unavailable');
    this.screenCtx = ctx;
    this.baseCache = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
    this.baseCtx = this.baseCache.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    this.ctx = this.baseCtx;
  }

  setArcs(b: ArcBuffers) {
    this.base = b;
    this.progressKey = '';
  }
  setHighlight(b: ArcBuffers | null) {
    this.highlight = b;
  }
  setHover(b: ArcBuffers | null) {
    this.hover = b;
  }

  resize(w: number, h: number, dpr: number) {
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== W) this.canvas.width = W;
    if (this.canvas.height !== H) this.canvas.height = H;
    if (this.baseCache.width !== W) this.baseCache.width = W;
    if (this.baseCache.height !== H) this.baseCache.height = H;
    this.progressKey = '';
  }

  private color(t: number, alpha: number, invert: boolean): string {
    const i = Math.min(BUCKETS - 1, Math.max(0, Math.round(t * (BUCKETS - 1))));
    let r = this.lut[i * 4], g = this.lut[i * 4 + 1], b = this.lut[i * 4 + 2];
    if (invert) [r, g, b] = [r * 0.75, g * 0.75, b * 0.75];
    return `rgba(${r | 0},${g | 0},${b | 0},${alpha.toFixed(3)})`;
  }

  /** Strokes arcs [from, to) of `set`, batched by colour/alpha bucket. */
  private strokeRange(set: ArcBuffers, from: number, to: number, p: RenderParams, alpha: number, width: number, dim: boolean) {
    const ctx = this.ctx;
    const dpr = p.dpr;
    const k = this.canvas.width / (p.view.x1 - p.view.x0);
    const base = p.layout.baseline * dpr;
    const W = this.canvas.width;
    const ratio = p.layout.ratio * p.grow;
    const buckets = new Map<number, number[]>();
    const d = set.data;
    for (let i = from; i < to; i++) {
      const p1 = (d[i * 4] - p.view.x0) * k;
      const p2 = (d[i * 4 + 1] - p.view.x0) * k;
      const cx = (p1 + p2) / 2;
      const a = Math.abs(p2 - p1) / 2;
      if (a < 0.3 || cx + a < 0 || cx - a > W) continue;
      const key = Math.round(d[i * 4 + 2] * (BUCKETS - 1)) * ALPHA_LEVELS + Math.min(ALPHA_LEVELS - 1, Math.floor(d[i * 4 + 3] * ALPHA_LEVELS));
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push(cx, a);
    }
    ctx.lineWidth = Math.max(0.5, width * dpr);
    const invert = p.theme === 'light';
    for (const [key, list] of buckets) {
      const t = Math.floor(key / ALPHA_LEVELS) / (BUCKETS - 1);
      const lvl = (key % ALPHA_LEVELS) / (ALPHA_LEVELS - 1);
      let a = Math.min(1, alpha * (0.3 + 0.7 * lvl));
      let style = this.color(t, a, invert);
      if (dim) {
        a *= 0.18;
        style = invert ? `rgba(90,94,104,${a.toFixed(3)})` : `rgba(150,154,165,${a.toFixed(3)})`;
      }
      ctx.strokeStyle = style;
      ctx.beginPath();
      for (let j = 0; j < list.length; j += 2) {
        const cx = list[j], a2 = list[j + 1];
        ctx.moveTo(cx + a2, base);
        ctx.ellipse(cx, base, a2, a2 * ratio, 0, 0, Math.PI, true);
      }
      ctx.stroke();
    }
  }

  render(p: RenderParams): boolean {
    const key = JSON.stringify([p.view, p.layout.width, p.layout.height, p.theme, p.alpha, p.lineWidth, p.limit, p.grow, p.dimmed, this.canvas.width, p.transparent]);
    const base = this.base;
    const total = base ? (p.limit == null ? base.count : Math.min(p.limit, base.count)) : 0;
    this.ctx = this.baseCtx;
    const ctx = this.baseCtx;
    if (key !== this.progressKey) {
      this.progressKey = key;
      this.cursor = 0;
      this.baseDone = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, this.baseCache.width, this.baseCache.height);
      if (p.theme === 'light' && !p.transparent) {
        ctx.fillStyle = p.background;
        ctx.fillRect(0, 0, this.baseCache.width, this.baseCache.height);
      }
    }
    if (!this.baseDone) {
      const t0 = performance.now();
      ctx.globalCompositeOperation = p.theme === 'light' ? 'multiply' : 'lighter';
      while (base && this.cursor < total && performance.now() - t0 < SLICE_MS) {
        const next = Math.min(total, this.cursor + 8000);
        const a = Math.min(0.9, Math.max(0.02, 0.06 * Math.sqrt(345000 / Math.max(1, total)))) * p.intensity;
        this.strokeRange(base, this.cursor, next, p, a, p.lineWidth, p.dimmed);
        this.cursor = next;
      }
      ctx.globalCompositeOperation = 'source-over';
      this.baseDone = this.cursor >= total;
    }
    // Composite the (possibly partial) base layer, then highlight and hover on top.
    const out = this.screenCtx;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.globalCompositeOperation = 'copy';
    out.drawImage(this.baseCache as CanvasImageSource, 0, 0);
    out.globalCompositeOperation = 'source-over';
    this.ctx = out;
    if (this.highlight && this.highlight.count) {
      const n = this.highlight.count;
      const a = Math.min(0.95, Math.max(0.15, 1.6 / Math.sqrt(n)));
      this.strokeRange(this.highlight, 0, n, p, a, Math.max(1.2, p.lineWidth * 1.4), false);
    }
    if (this.hover && this.hover.count) {
      const h = this.hover;
      const k = this.canvas.width / (p.view.x1 - p.view.x0);
      const p1 = (h.data[0] - p.view.x0) * k, p2 = (h.data[1] - p.view.x0) * k;
      const cx = (p1 + p2) / 2, a = Math.abs(p2 - p1) / 2;
      out.strokeStyle = p.theme === 'light' ? '#0d0f17' : '#ffffff';
      out.lineWidth = 2.4 * p.dpr;
      out.beginPath();
      out.ellipse(cx, p.layout.baseline * p.dpr, Math.max(0.1, a), Math.max(0.1, a * p.layout.ratio * p.grow), 0, 0, Math.PI, true);
      out.stroke();
    }
    this.ctx = this.baseCtx;
    return this.baseDone;
  }

  dispose() {
    this.base = this.highlight = this.hover = null;
  }
}
