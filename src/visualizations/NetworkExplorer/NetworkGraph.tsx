/**
 * Force-directed network (D3 force simulation, Canvas 2D rendering, d3-zoom pan/zoom,
 * node dragging, hover and selection). Handles up to a few thousand nodes/links smoothly.
 */
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, select, zoom, zoomIdentity, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum, type ZoomTransform } from 'd3';
import { useEffect, useRef, useState } from 'react';
import { readAxisColors } from '../ArcVisualization/axis.ts';

export interface GraphNode extends SimulationNodeDatum {
  id: number;
  label: string;
  radius: number;
  color: string;
  /** Show the label even when zoomed out. */
  important?: boolean;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  weight: number;
  /** 0..1, used for opacity / width. */
  strength: number;
  muted?: boolean;
}

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  theme: 'dark' | 'light';
  /** Link distance scale. */
  distance?: number;
  testId?: string;
}

export function NetworkGraph({ nodes, links, selected, onSelect, theme, distance = 60, testId }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const transform = useRef<ZoomTransform>(zoomIdentity);
  const size = useRef({ w: 800, h: 600, dpr: 1 });
  const hover = useRef<number | null>(null);
  const [hoverLabel, setHoverLabel] = useState<{ x: number; y: number; label: string } | null>(null);
  const positions = useRef(new Map<number, { x: number; y: number }>());
  const draw = useRef<() => void>(() => {});
  const props = useRef({ selected, theme });
  props.current = { selected, theme };

  // Drawing.
  useEffect(() => {
    draw.current = () => {
      const c = canvas.current;
      if (!c) return;
      const ctx = c.getContext('2d')!;
      const { w, h, dpr } = size.current;
      const colors = readAxisColors();
      const tr = transform.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr * tr.k, 0, 0, dpr * tr.k, dpr * tr.x, dpr * tr.y);
      const sel = props.current.selected;
      const hov = hover.current;
      const focus = hov ?? sel;
      const neighbours = new Set<number>();
      if (focus != null) for (const l of links) {
        const a = (l.source as GraphNode).id, b = (l.target as GraphNode).id;
        if (a === focus) neighbours.add(b);
        if (b === focus) neighbours.add(a);
      }
      // Links
      for (const l of links) {
        const a = l.source as GraphNode, b = l.target as GraphNode;
        if (a.x == null || b.x == null) continue;
        const on = focus != null && (a.id === focus || b.id === focus);
        const alpha = focus != null ? (on ? 0.85 : 0.04) : 0.08 + 0.5 * l.strength;
        ctx.strokeStyle = l.muted ? colors.muted : on ? colors.accent : colors.fg;
        ctx.globalAlpha = l.muted ? alpha * 0.6 : alpha;
        ctx.lineWidth = (0.4 + 3 * l.strength) / Math.sqrt(tr.k);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y!);
        ctx.lineTo(b.x, b.y!);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Nodes
      for (const n of nodes) {
        if (n.x == null) continue;
        const dim = focus != null && n.id !== focus && !neighbours.has(n.id);
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y!, n.radius, 0, Math.PI * 2);
        ctx.fill();
        if (n.id === sel || n.id === hov) {
          ctx.strokeStyle = colors.fg;
          ctx.lineWidth = 2 / tr.k;
          ctx.stroke();
        }
      }
      // Labels
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const n of nodes) {
        if (n.x == null) continue;
        const show = n.id === focus || neighbours.has(n.id) || n.important || n.radius * tr.k > 9;
        if (!show) continue;
        const dim = focus != null && n.id !== focus && !neighbours.has(n.id);
        if (dim && !n.important) continue;
        const fs = Math.max(9, Math.min(13, n.radius * tr.k * 0.9)) / tr.k;
        ctx.font = `600 ${fs}px "Inter Variable", Inter, system-ui, sans-serif`;
        ctx.globalAlpha = dim ? 0.35 : 0.95;
        ctx.fillStyle = colors.fg;
        ctx.strokeStyle = colors.bg;
        ctx.lineWidth = 3 / tr.k;
        const y = n.y! + n.radius + fs * 0.8;
        ctx.strokeText(n.label, n.x, y);
        ctx.fillText(n.label, n.x, y);
      }
      ctx.globalAlpha = 1;
      void w;
      void h;
    };
    draw.current();
  }, [nodes, links, theme, selected]);

  // Simulation.
  useEffect(() => {
    const { w, h } = size.current;
    for (const n of nodes) {
      const p = positions.current.get(n.id);
      if (p) {
        n.x = p.x;
        n.y = p.y;
      }
    }
    const maxW = Math.max(1, ...links.map((l) => l.weight));
    const s = forceSimulation<GraphNode, GraphLink>(nodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((l) => distance * (1.4 - Math.sqrt(l.weight / maxW)))
          .strength((l) => 0.05 + 0.6 * Math.sqrt(l.weight / maxW)),
      )
      .force('charge', forceManyBody<GraphNode>().strength((d) => -40 - d.radius * 8))
      .force('collide', forceCollide<GraphNode>((d) => d.radius + 2))
      .force('center', forceCenter(w / 2, h / 2))
      .force('x', forceX(w / 2).strength(0.03))
      .force('y', forceY(h / 2).strength(0.05))
      .alphaDecay(0.03)
      .on('tick', () => {
        for (const n of nodes) positions.current.set(n.id, { x: n.x!, y: n.y! });
        draw.current();
      });
    sim.current = s;
    return () => {
      s.stop();
    };
  }, [nodes, links, distance]);

  // Size, zoom, pointer interaction.
  useEffect(() => {
    const el = wrap.current!;
    const c = canvas.current!;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w, h, dpr };
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      sim.current?.force('center', forceCenter(w / 2, h / 2)).force('x', forceX(w / 2).strength(0.03)).force('y', forceY(h / 2).strength(0.05)).alpha(0.3).restart();
      draw.current();
    });
    ro.observe(el);

    const find = (px: number, py: number): GraphNode | null => {
      const [x, y] = transform.current.invert([px, py]);
      let best: GraphNode | null = null;
      let bestD = Infinity;
      for (const n of sim.current?.nodes() ?? []) {
        const d = Math.hypot(n.x! - x, n.y! - y) - n.radius;
        if (d < bestD && d < 6 / transform.current.k) {
          bestD = d;
          best = n;
        }
      }
      return best;
    };
    let dragNode: GraphNode | null = null;
    let moved = false;
    const z = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 8])
      .filter((ev: Event) => {
        if (ev.type === 'mousedown' || ev.type === 'pointerdown' || ev.type === 'touchstart') {
          const r = c.getBoundingClientRect();
          const pe = ev as MouseEvent;
          if ('clientX' in pe && find(pe.clientX - r.left, pe.clientY - r.top)) return false;
        }
        return !(ev as MouseEvent).button;
      })
      .on('zoom', (ev) => {
        transform.current = ev.transform;
        draw.current();
      });
    select(c).call(z).on('dblclick.zoom', null);

    const local = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const onDown = (e: PointerEvent) => {
      const [px, py] = local(e);
      const n = find(px, py);
      moved = false;
      if (n) {
        dragNode = n;
        c.setPointerCapture(e.pointerId);
        sim.current?.alphaTarget(0.2).restart();
      }
    };
    const onMove = (e: PointerEvent) => {
      const [px, py] = local(e);
      if (dragNode) {
        const [x, y] = transform.current.invert([px, py]);
        dragNode.fx = x;
        dragNode.fy = y;
        moved = true;
        return;
      }
      const n = find(px, py);
      const id = n ? n.id : null;
      if (id !== hover.current) {
        hover.current = id;
        c.style.cursor = n ? 'pointer' : 'grab';
        draw.current();
      }
      setHoverLabel(n ? { x: px, y: py, label: n.label } : null);
    };
    const onUp = (e: PointerEvent) => {
      const [px, py] = local(e);
      if (dragNode) {
        dragNode.fx = null;
        dragNode.fy = null;
        sim.current?.alphaTarget(0);
        if (!moved) onSelect(dragNode.id);
        dragNode = null;
        return;
      }
      if (!find(px, py)) {
        /* clicks on empty space keep the selection */
      }
    };
    const onLeave = () => {
      hover.current = null;
      setHoverLabel(null);
      draw.current();
    };
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointerleave', onLeave);
    return () => {
      ro.disconnect();
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointerleave', onLeave);
      select(c).on('.zoom', null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0 touch-none" data-testid={testId}>
      <canvas ref={canvas} className="absolute inset-0 cursor-grab" />
      {hoverLabel && (
        <div className="pointer-events-none absolute z-10 rounded-md border border-line bg-panel/95 px-2 py-1 text-xs shadow" style={{ left: hoverLabel.x + 12, top: hoverLabel.y + 12 }}>
          {hoverLabel.label}
        </div>
      )}
    </div>
  );
}

/** Returns the canvas of the graph as a PNG data URL (for export). */
export function graphCanvasDataUrl(container: HTMLElement | null): string | null {
  const c = container?.querySelector('canvas');
  return c ? c.toDataURL('image/png') : null;
}
