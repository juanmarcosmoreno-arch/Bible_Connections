/**
 * High-resolution PNG export of the current arc view. Re-renders off-screen with the same
 * renderer (WebGL2, or the progressive Canvas renderer as fallback), then composites the
 * axis, legend and attribution.
 */
import type { DerivedReferences, ReferenceColumns } from '../../data/references.ts';
import type { Lang } from '../../data/bibleStructure.ts';
import { ATTRIBUTION } from '../../utils/export.ts';
import { arcColor } from '../../utils/colors.ts';
import { drawAxis, type AxisColors, type AxisMarker } from './axis.ts';
import { CanvasArcRenderer } from './canvasRenderer.ts';
import { autoExposure, buildArcBuffers, computeLayout } from './geometry.ts';
import type { ArcRenderer, ViewDomain } from './types.ts';
import { WebGLArcRenderer } from './webglRenderer.ts';

export interface PngExportOptions {
  cols: ReferenceColumns;
  derived: DerivedReferences;
  weight: Float32Array;
  indices: Uint32Array;
  highlight: Uint32Array | null;
  markers: AxisMarker[];
  view: ViewDomain;
  cssWidth: number;
  cssHeight: number;
  scale: number;
  theme: 'dark' | 'light';
  transparent: boolean;
  labels: boolean;
  legend: boolean;
  lang: Lang;
  colors: AxisColors;
  intensity: number;
  lineWidth: number;
  bars: 'verses' | 'refs';
  chapterRefs: number[] | null;
  legendTitle: string;
  onProgress?: (fraction: number) => void;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

export async function exportArcPng(o: PngExportOptions): Promise<Blob> {
  const maxSide = 8192;
  const scale = Math.min(o.scale, maxSide / o.cssWidth, maxSide / o.cssHeight);
  const W = Math.round(o.cssWidth * scale), H = Math.round(o.cssHeight * scale);
  const glCanvas = document.createElement('canvas');
  let r: ArcRenderer | null = WebGLArcRenderer.create(glCanvas, true);
  if (!r) r = new CanvasArcRenderer(glCanvas);
  r.resize(o.cssWidth, o.cssHeight, scale);
  const layout = computeLayout(o.cssWidth, o.cssHeight, o.cssWidth < 640);
  r.setArcs(buildArcBuffers(o.indices, o.derived.sourcePos, o.derived.targetPos, o.derived.colorT, o.weight, true));
  r.setHighlight(o.highlight && o.highlight.length ? buildArcBuffers(o.highlight, o.derived.sourcePos, o.derived.targetPos, o.derived.colorT, o.weight) : null);
  const params = {
    view: o.view,
    layout,
    dpr: scale,
    theme: o.theme,
    alpha: autoExposure(o.indices.length, o.view.x1 - o.view.x0, o.intensity),
    intensity: o.intensity,
    interacting: false,
    lineWidth: o.lineWidth,
    limit: null,
    grow: 1,
    dimmed: !!(o.highlight && o.highlight.length),
    transparent: o.transparent,
    background: o.colors.bg,
  };
  let done = r.render(params);
  while (!done) {
    o.onProgress?.(0.5);
    await nextFrame();
    done = r.render(params);
  }
  o.onProgress?.(0.9);

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d')!;
  if (!o.transparent) {
    ctx.fillStyle = o.colors.bg;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.drawImage(glCanvas, 0, 0);
  drawAxis(ctx, {
    view: o.view,
    layout,
    dpr: scale,
    colors: o.colors,
    lang: o.lang,
    compact: o.cssWidth < 640,
    bars: o.bars,
    chapterRefs: o.chapterRefs,
    selection: o.markers,
    hoverVerse: null,
    showLabels: o.labels,
  });
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (o.legend) {
    const g = ctx.createLinearGradient(16, 0, 216, 0);
    for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, arcColor(i / 12));
    ctx.fillStyle = o.colors.muted;
    ctx.font = '500 10px "Inter Variable", Inter, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText(o.legendTitle.toUpperCase(), 16, 22);
    ctx.fillStyle = g;
    ctx.fillRect(16, 30, 200, 6);
  }
  ctx.fillStyle = o.colors.muted;
  ctx.globalAlpha = 0.8;
  ctx.font = '9px "Inter Variable", Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(ATTRIBUTION, o.cssWidth - 8, o.cssHeight - 6);
  ctx.globalAlpha = 1;
  r.dispose();
  (glCanvas.getContext('webgl2') as WebGL2RenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
  o.onProgress?.(1);
  return await new Promise<Blob>((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
}
