/**
 * THE ARC — global arc diagram of every cross-reference.
 *
 * Rendering: WebGL2 instanced arcs (Canvas 2D fallback) + a Canvas 2D axis overlay, drawn
 * on demand in a requestAnimationFrame loop. Interaction: wheel / pinch zoom around the
 * cursor, drag to pan, hover hit-testing, click to select an arc or a passage on the axis,
 * keyboard shortcuts. Zoom requests from other components arrive via `arcController`.
 */
import { interpolateZoom } from 'd3';
import { useEffect, useRef, useState } from 'react';
import { BOOKS, CHAPTERS, TOTAL_VERSES, VERSE_BOOK, VERSE_CHAPTER, formatRange } from '../../data/bibleStructure.ts';
import { useData } from '../../hooks/useData.tsx';
import { useHighlight } from '../../hooks/useHighlight.ts';
import { formatNumber, useT } from '../../i18n/index.ts';
import { actions, useApp } from '../../state/appState.ts';
import { arcColor } from '../../utils/colors.ts';
import { useSourceLabel } from '../../components/SourceTag.tsx';
import { drawAxis, readAxisColors, type AxisColors, type AxisMarker } from './axis.ts';
import { CanvasArcRenderer } from './canvasRenderer.ts';
import { arcController } from './controller.ts';
import { autoExposure, buildArcBuffers, clampView, computeLayout, hitTest, pxToPos } from './geometry.ts';
import type { ArcBuffers, ArcLayout, ArcRenderer, ViewDomain } from './types.ts';
import { WebGLArcRenderer } from './webglRenderer.ts';

const LOD_MAX = 150_000;
const LOD_MIN = 15_000;
const INTERACTION_IDLE_MS = 160;

interface Tip {
  x: number;
  y: number;
  kind: 'arc' | 'verse';
  index: number; // reference index or verse index
}

interface Anim {
  from: ViewDomain;
  to: ViewDomain;
  start: number;
  duration: number;
  interp: (t: number) => [number, number, number];
}

export function ArcView({ onRenderer }: { onRenderer?: (kind: 'webgl' | 'canvas') => void }) {
  const t = useT();
  const data = useData();
  const highlight = useHighlight();
  const theme = useApp((s) => s.theme);
  const lang = useApp((s) => s.lang);
  const settings = useApp((s) => s.settings);
  const selection = useApp((s) => s.selection);
  const introDismissed = useApp((s) => s.introDismissed);

  const containerRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ArcRenderer | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const st = useRef({
    view: { x0: 0, x1: 1 } as ViewDomain,
    layout: computeLayout(800, 500, false) as ArcLayout,
    dpr: 1,
    compact: false,
    dirty: true,
    complete: true,
    lastInteract: 0,
    wasInteracting: false,
    anim: null as Anim | null,
    grow: 1,
    growStart: -1,
    base: null as ArcBuffers | null,
    hl: null as ArcBuffers | null,
    hoverArc: -1,
    hoverVerse: null as number | null,
    mouse: null as { x: number; y: number } | null,
    hoverPending: false,
    lod: LOD_MAX,
    colors: null as AxisColors | null,
    pointers: new Map<number, { x: number; y: number }>(),
    drag: null as null | { x: number; y: number; view: ViewDomain; moved: boolean; pinch?: { d: number; mid: number; view: ViewDomain } },
  });

  const cols = data.cols;
  const derived = data.derived;

  const chapterRefs = data.chapterRefs ?? null;

  const props = useRef({ settings, theme, lang, selection, chapterRefs, derived, weight: data.weight });
  props.current = { settings, theme, lang, selection, chapterRefs, derived, weight: data.weight };

  // Renderer setup.
  useEffect(() => {
    const canvas = glRef.current!;
    let r: ArcRenderer | null = WebGLArcRenderer.create(canvas);
    if (!r) r = new CanvasArcRenderer(canvas);
    rendererRef.current = r;
    onRenderer?.(r.kind);
    st.current.dirty = true;
    return () => {
      r?.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme colours for the axis.
  useEffect(() => {
    st.current.colors = readAxisColors();
    st.current.dirty = true;
  }, [theme]);

  useEffect(() => {
    st.current.dirty = true;
  }, [settings, lang, selection, chapterRefs]);

  // Arc buffers for the filtered set.
  useEffect(() => {
    if (!cols || !derived || !data.filtered || !data.weight) return;
    const b = buildArcBuffers(data.filtered, derived.sourcePos, derived.targetPos, derived.colorT, data.weight, true);
    st.current.base = b;
    st.current.hoverArc = -1;
    rendererRef.current?.setArcs(b);
    rendererRef.current?.setHover(null);
    st.current.dirty = true;
  }, [cols, derived, data.filtered, data.weight]);

  // Intro animation once data is ready.
  useEffect(() => {
    if (data.status !== 'ready') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && !introDismissed) {
      st.current.grow = 0;
      st.current.growStart = -1;
    }
    st.current.dirty = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.status]);

  // Highlight buffers.
  useEffect(() => {
    if (!derived || !data.weight) return;
    const hl = highlight && highlight.length ? buildArcBuffers(highlight, derived.sourcePos, derived.targetPos, derived.colorT, data.weight) : null;
    st.current.hl = hl;
    rendererRef.current?.setHighlight(hl);
    st.current.hoverArc = -1;
    rendererRef.current?.setHover(null);
    st.current.dirty = true;
  }, [highlight, derived, data.weight]);

  // Resize handling.
  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const s = st.current;
      s.dpr = dpr;
      s.compact = w < 640;
      s.layout = computeLayout(w, h, s.compact);
      for (const c of [glRef.current!, overlayRef.current!]) {
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
      overlayRef.current!.width = Math.round(w * dpr);
      overlayRef.current!.height = Math.round(h * dpr);
      rendererRef.current?.resize(w, h, dpr);
      s.dirty = true;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Zoom requests.
  useEffect(
    () =>
      arcController.attach((req) => {
        const s = st.current;
        const to = clampView(req);
        const duration = req.duration ?? 750;
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (!duration || reduce) {
          s.view = to;
          s.anim = null;
        } else {
          const f = s.view;
          const interp = interpolateZoom([(f.x0 + f.x1) / 2, 0, f.x1 - f.x0], [(to.x0 + to.x1) / 2, 0, to.x1 - to.x0]);
          s.anim = { from: f, to, start: performance.now(), duration: Math.max(duration, Math.min(1600, interp.duration * 0.6)), interp };
        }
        s.dirty = true;
      }),
    [],
  );

  // Main render loop.
  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = st.current;
      const r = rendererRef.current;
      if (!r) return;
      if (s.anim) {
        const k = Math.min(1, (now - s.anim.start) / s.anim.duration);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        const [c, , w] = s.anim.interp(e);
        s.view = clampView({ x0: c - w / 2, x1: c + w / 2 });
        if (k >= 1) {
          s.view = s.anim.to;
          s.anim = null;
        }
        s.lastInteract = now;
        s.dirty = true;
      }
      if (s.grow < 1 && s.base) {
        if (s.growStart < 0) s.growStart = now;
        const k = Math.min(1, (now - s.growStart) / 1600);
        s.grow = 1 - Math.pow(1 - k, 3);
        s.dirty = true;
      }
      const interacting = now - s.lastInteract < INTERACTION_IDLE_MS || s.grow < 1;
      if (s.wasInteracting && !interacting) s.dirty = true; // final full-detail frame
      s.wasInteracting = interacting;
      arcController.setCurrentView(s.view);

      if (s.hoverPending) {
        s.hoverPending = false;
        updateHover();
      }
      if (!s.dirty && s.complete) return;
      // Frame pacing: never queue a new frame while the GPU is still busy with the last one.
      if (r.busy?.()) return;
      // Adaptive level of detail while moving: aim for ~30 ms GPU frames.
      const gpu = r.lastFrameMs?.() ?? 0;
      if (gpu > 45) s.lod = Math.max(LOD_MIN, Math.round(s.lod * 0.6));
      else if (gpu > 0 && gpu < 20) s.lod = Math.min(LOD_MAX, Math.round(s.lod * 1.25));
      s.dirty = false;
      const { settings: set, theme: th, lang: lg, selection: sel, chapterRefs: chRefs } = props.current;
      const count = s.base?.count ?? 0;
      const limit = set.lod && interacting && count > s.lod ? s.lod : null;
      const alpha = autoExposure(count, s.view.x1 - s.view.x0, set.arcOpacity);
      s.complete = r.render({
        view: s.view,
        layout: s.layout,
        dpr: s.dpr,
        theme: th,
        alpha,
        intensity: set.arcOpacity,
        interacting,
        lineWidth: set.arcWidth,
        limit,
        grow: s.grow,
        dimmed: !!s.hl,
        hoverDim: s.hoverArc >= 0,
        background: s.colors?.bg ?? '#08090d',
      });
      // Read-only performance probe (used by the end-to-end performance test).
      const perf = ((window as unknown as { __bcPerf?: Record<string, unknown> }).__bcPerf ??= {});
      perf.renderer = r.kind;
      perf.frames = ((perf.frames as number) ?? 0) + 1;
      perf.arcs = count;
      perf.drawn = limit ?? count;
      perf.gpuMs = r.lastFrameMs?.() ?? null;
      perf.lod = s.lod;
      perf.view = [s.view.x0, s.view.x1];
      perf.complete = s.complete;
      const oc = overlayRef.current!;
      const ctx = oc.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, oc.width, oc.height);
      if (s.colors) {
        const markers: AxisMarker[] = [];
        if (sel?.kind === 'passage') markers.push({ start: sel.start, end: sel.end });
        else if (sel?.kind === 'reference' && cols) {
          markers.push({ start: cols.sourceStart[sel.index], end: cols.sourceEnd[sel.index] });
          markers.push({ start: cols.targetStart[sel.index], end: cols.targetEnd[sel.index], color: s.colors.fg });
        }
        drawAxis(ctx, {
          view: s.view,
          layout: s.layout,
          dpr: s.dpr,
          colors: s.colors,
          lang: lg,
          compact: s.compact,
          bars: set.bars,
          chapterRefs: chRefs,
          selection: markers,
          hoverVerse: s.hoverVerse,
          showLabels: true,
        });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols]);

  function updateHover() {
    const s = st.current;
    const r = rendererRef.current;
    const m = s.mouse;
    let arc = -1;
    let verse: number | null = null;
    if (m && !s.drag?.moved) {
      if (m.y > s.layout.baseline + 2) {
        verse = Math.min(TOTAL_VERSES - 1, Math.max(0, Math.floor(pxToPos(m.x, s.view, s.layout.width) * TOTAL_VERSES)));
      } else {
        const set = s.hl ?? s.base;
        if (set) {
          const pos = hitTest(set, s.view, s.layout, m.x, m.y, s.compact ? 8 : 4);
          arc = pos >= 0 ? set.indices[pos] : -1;
          const { derived: dv, weight: wt } = props.current;
          if (arc !== s.hoverArc && r && dv && wt) {
            r.setHover(arc >= 0 ? buildArcBuffers(Uint32Array.of(arc), dv.sourcePos, dv.targetPos, dv.colorT, wt) : null);
          }
        }
      }
    }
    if (arc !== s.hoverArc || verse !== s.hoverVerse) {
      s.hoverArc = arc;
      s.hoverVerse = verse;
      s.dirty = true;
      setTip(m && arc >= 0 ? { x: m.x, y: m.y, kind: 'arc', index: arc } : m && verse != null ? { x: m.x, y: m.y, kind: 'verse', index: verse } : null);
    } else if (m && (arc >= 0 || verse != null)) {
      setTip((tp) => (tp ? { ...tp, x: m.x, y: m.y } : tp));
    }
  }

  // Pointer / wheel / keyboard interaction.
  useEffect(() => {
    const el = overlayRef.current!;
    const s = st.current;
    const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const zoomAt = (px: number, factor: number) => {
      const v = s.view;
      const anchor = pxToPos(px, v, s.layout.width);
      const span = (v.x1 - v.x0) * factor;
      const f = px / s.layout.width;
      s.view = clampView({ x0: anchor - f * span, x1: anchor - f * span + span });
      s.anim = null;
      s.lastInteract = performance.now();
      s.dirty = true;
      dismiss();
    };
    const dismiss = () => {
      if (s.grow < 1) s.grow = 1;
      actions.dismissIntro();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
        const v = s.view;
        const dx = ((e.deltaX * unit) / s.layout.width) * (v.x1 - v.x0);
        s.view = clampView({ x0: v.x0 + dx, x1: v.x1 + dx });
        s.anim = null;
        s.lastInteract = performance.now();
        s.dirty = true;
        dismiss();
      } else {
        zoomAt(p.x, Math.exp(e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015)));
      }
    };
    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      const p = local(e);
      s.pointers.set(e.pointerId, p);
      if (s.pointers.size === 1) s.drag = { x: p.x, y: p.y, view: s.view, moved: false };
      else if (s.pointers.size === 2 && s.drag) {
        const [a, b] = [...s.pointers.values()];
        s.drag.pinch = { d: Math.max(10, Math.abs(a.x - b.x)), mid: (a.x + b.x) / 2, view: s.view };
        s.drag.moved = true;
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      s.mouse = p;
      if (s.pointers.has(e.pointerId)) s.pointers.set(e.pointerId, p);
      const d = s.drag;
      if (d && s.pointers.size >= 1) {
        if (d.pinch && s.pointers.size >= 2) {
          const [a, b] = [...s.pointers.values()];
          const dist = Math.max(10, Math.abs(a.x - b.x));
          const v = d.pinch.view;
          const span = (v.x1 - v.x0) * (d.pinch.d / dist);
          const anchor = pxToPos(d.pinch.mid, v, s.layout.width);
          const mid = (a.x + b.x) / 2;
          const f = mid / s.layout.width;
          s.view = clampView({ x0: anchor - f * span, x1: anchor - f * span + span });
          s.anim = null;
          s.lastInteract = performance.now();
          s.dirty = true;
          dismiss();
        } else if (!d.pinch) {
          const dx = p.x - d.x;
          if (Math.abs(dx) > 3 || Math.abs(p.y - d.y) > 3) d.moved = true;
          if (d.moved) {
            const span = d.view.x1 - d.view.x0;
            const off = (-dx / s.layout.width) * span;
            s.view = clampView({ x0: d.view.x0 + off, x1: d.view.x1 + off });
            s.anim = null;
            s.lastInteract = performance.now();
            s.dirty = true;
            if (s.hoverArc >= 0 || s.hoverVerse != null) {
              s.hoverArc = -1;
              s.hoverVerse = null;
              rendererRef.current?.setHover(null);
              setTip(null);
            }
            dismiss();
          }
        }
      }
      s.hoverPending = true;
    };
    const onUp = (e: PointerEvent) => {
      const d = s.drag;
      s.pointers.delete(e.pointerId);
      if (s.pointers.size > 0) return;
      s.drag = null;
      if (d && !d.moved) handleClick(local(e));
      s.hoverPending = true;
    };
    const onLeave = () => {
      s.mouse = null;
      s.hoverPending = true;
    };
    const onDbl = (e: MouseEvent) => {
      const p = local(e);
      const v = s.view;
      const anchor = pxToPos(p.x, v, s.layout.width);
      const span = (v.x1 - v.x0) / 4;
      arcController.zoomTo({ x0: anchor - span / 2, x1: anchor + span / 2, duration: 500 });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('dblclick', onDbl);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('dblclick', onDbl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, derived]);

  function handleClick(p: { x: number; y: number }) {
    const s = st.current;
    actions.dismissIntro();
    if (s.grow < 1) s.grow = 1;
    if (p.y > s.layout.baseline - 4) {
      const g = Math.min(TOTAL_VERSES - 1, Math.max(0, Math.floor(pxToPos(p.x, s.view, s.layout.width) * TOTAL_VERSES)));
      const pxPerVerse = s.layout.width / ((s.view.x1 - s.view.x0) * TOTAL_VERSES);
      const ch = CHAPTERS[VERSE_CHAPTER[g]];
      if (pxPerVerse >= 4) actions.selectPassage('verse', g, g);
      else if (ch.verseCount * pxPerVerse >= 5) actions.selectPassage('chapter', ch.globalPosition, ch.globalPosition + ch.verseCount - 1);
      else {
        const b = BOOKS[VERSE_BOOK[g]];
        actions.selectPassage('book', b.firstVerse, b.firstVerse + b.verseCount - 1);
      }
      return;
    }
    const set = s.hl ?? s.base;
    if (!set) return;
    const pos = hitTest(set, s.view, s.layout, p.x, p.y, s.compact ? 10 : 5);
    if (pos >= 0) actions.selectReference(set.indices[pos]);
  }

  function onKey(e: React.KeyboardEvent) {
    const s = st.current;
    const v = s.view;
    const span = v.x1 - v.x0;
    const c = (v.x0 + v.x1) / 2;
    const go = (x0: number, x1: number) => arcController.zoomTo({ x0, x1, duration: 250 });
    if (e.key === 'ArrowLeft') go(v.x0 - span * 0.2, v.x1 - span * 0.2);
    else if (e.key === 'ArrowRight') go(v.x0 + span * 0.2, v.x1 + span * 0.2);
    else if (e.key === '+' || e.key === '=') go(c - span / 3, c + span / 3);
    else if (e.key === '-' || e.key === '_') go(c - span * 0.75, c + span * 0.75);
    else if (e.key === '0') arcController.reset();
    else if (e.key === 'Escape') actions.clearSelection();
    else return;
    e.preventDefault();
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none select-none outline-none"
      tabIndex={0}
      onKeyDown={onKey}
      role="img"
      aria-label={`${t('nav.arc')}: ${t('arc.hint')}`}
      data-testid="arc-view"
    >
      <canvas ref={glRef} className="absolute inset-0" data-testid="arc-canvas" />
      <canvas ref={overlayRef} className="absolute inset-0 cursor-crosshair" data-testid="arc-overlay" />
      {tip && cols && derived && <ArcTooltip tip={tip} width={st.current.layout.width} />}
    </div>
  );
}

function ArcTooltip({ tip, width }: { tip: Tip; width: number }) {
  const t = useT();
  const sourceLabel = useSourceLabel();
  const lang = useApp((s) => s.lang);
  const { cols, derived, degrees } = useData();
  if (!cols || !derived) return null;
  const left = Math.min(Math.max(8, tip.x + 14), width - 248);
  const top = Math.max(8, tip.y - (tip.kind === 'arc' ? 92 : 64));
  let body: React.ReactNode;
  if (tip.kind === 'arc') {
    const i = tip.index;
    const cls = ['near', 'mid', 'far'][derived.distClass[i]] as 'near' | 'mid' | 'far';
    body = (
      <>
        <div className="flex items-center gap-2 font-medium">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: arcColor(derived.colorT[i]) }} />
          <span>{formatRange(cols.sourceStart[i], cols.sourceEnd[i], lang)}</span>
          <span className="text-muted">→</span>
          <span>{formatRange(cols.targetStart[i], cols.targetEnd[i], lang)}</span>
        </div>
        <div className="mt-1 text-xs text-muted">
          {t('panel.distance')}: {t(`filters.distance.${cls}`)}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {t('source.label')}: {sourceLabel(cols.origin[i])}
        </div>
        <div className="mt-1 text-[11px] text-muted/80">{t('arc.tooltip.click')}</div>
      </>
    );
  } else {
    const g = tip.index;
    body = (
      <>
        <div className="font-medium">{formatRange(g, g, lang)}</div>
        {degrees && (
          <div className="mt-1 text-xs text-muted">
            {formatNumber(degrees.total[g], lang)} {t('unit.connections')}
          </div>
        )}
      </>
    );
  }
  return (
    <div
      className="pointer-events-none absolute z-10 w-60 rounded-lg border border-line bg-panel/95 px-3 py-2 text-sm shadow-[var(--shadow)] backdrop-blur"
      style={{ left, top }}
      role="tooltip"
      data-testid="arc-tooltip"
    >
      {body}
    </div>
  );
}
