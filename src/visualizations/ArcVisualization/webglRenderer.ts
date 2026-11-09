/**
 * WebGL2 arc renderer.
 *
 *  - One instanced triangle strip per arc; the half-ellipse is computed in the vertex shader,
 *    so the GPU stores 16 bytes per reference and zoom/pan never touches the CPU-side data.
 *  - Arcs are grouped by distance; each group is drawn with a segment count suited to its
 *    on-screen size (8 … 128 segments), keeping curves smooth at any zoom without wasting
 *    vertices on tiny arcs.
 *  - The base layer is accumulated additively in a half-float framebuffer and tone-mapped
 *    (hue-preserving exposure curve), so 345k overlapping arcs keep their colours instead of
 *    saturating to white. In light mode the buffer accumulates absorbance ("ink").
 *  - While the user interacts on high-DPI screens the accumulation runs at half resolution.
 *  - Falls back to direct alpha blending when float render targets are unavailable.
 */
import { arcColorLUT } from '../../utils/colors.ts';
import type { ArcBuffers, ArcRenderer, RenderParams } from './types.ts';

const SEGMENT_LEVELS = [8, 16, 24, 32, 48, 64, 96, 128];

const ARC_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;   // x: t along the arc (0..1), y: side (-1 / +1)
layout(location = 1) in vec4 aArc;      // sourcePos, targetPos, colorT, weight
uniform vec2 uView;
uniform vec2 uSize;
uniform float uBaseline;
uniform float uRatio;
uniform float uHalf;
uniform float uGrow;
uniform float uMode;   // 0 base, 1 highlight, 2 hover
uniform vec3 uHoverColor;
uniform sampler2D uLut;
out vec4 vColor;
out float vEdge;

void main() {
  float span = uView.y - uView.x;
  float p1 = (aArc.x - uView.x) / span * uSize.x;
  float p2 = (aArc.y - uView.x) / span * uSize.x;
  float cx = 0.5 * (p1 + p2);
  float a = 0.5 * abs(p2 - p1);
  float b = a * uRatio * uGrow;
  bool cull = a < 0.3 || cx + a < -uHalf || cx - a > uSize.x + uHalf;
  // An arc wider than the view is visible only near its top: cull it when even its lowest
  // visible point lies above the canvas.
  float far = max(abs(cx), abs(uSize.x - cx));
  if (!cull && far < a) {
    float yEdge = b * sqrt(max(0.0, 1.0 - (far * far) / (a * a)));
    if (yEdge > uBaseline + uHalf) cull = true;
  }
  if (cull) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec4(0.0);
    vEdge = 0.0;
    return;
  }
  float th = 3.14159265 * aCorner.x;
  float c = cos(th);
  float s = sin(th);
  vec2 P = vec2(cx + a * c, uBaseline - b * s);
  vec2 T = vec2(-a * s, -b * c);
  float tl = length(T);
  vec2 N = tl > 1e-5 ? vec2(-T.y, T.x) / tl : vec2(1.0, 0.0);
  P += N * aCorner.y * uHalf;
  gl_Position = vec4(P.x / uSize.x * 2.0 - 1.0, 1.0 - P.y / uSize.y * 2.0, 0.0, 1.0);
  vec3 col = texture(uLut, vec2(aArc.z, 0.5)).rgb;
  // Votes drive intensity: ~7x contrast between the median (3 votes) and the top 1% (59+).
  float w = 0.04 + 0.96 * pow(aArc.w, 1.6);
  if (uMode > 1.5) { col = uHoverColor; w = 1.0; }
  else if (uMode > 0.5) { w = mix(0.55, 1.0, aArc.w); }
  vColor = vec4(col, w);
  vEdge = aCorner.y;
}`;

const ARC_FS = `#version 300 es
precision highp float;
in vec4 vColor;
in float vEdge;
uniform float uHalf;
uniform float uAlpha;
uniform float uCoverage;
uniform float uOutput; // 0: premultiplied colour, 1: absorbance (ink accumulation), 2: ink colour (direct)
out vec4 outColor;
void main() {
  float d = abs(vEdge) * uHalf;
  float aa = clamp(uHalf - d, 0.0, 1.0) * uCoverage;
  float a = clamp(vColor.a * uAlpha, 0.0, 1e4) * aa;
  if (uOutput > 1.5) {
    vec3 ink = vColor.rgb * 0.82;
    outColor = vec4(ink * min(a, 1.0), min(a, 1.0));
  } else if (uOutput > 0.5) {
    outColor = vec4((vec3(1.0) - vColor.rgb * 0.9) * a, a);
  } else {
    outColor = vec4(vColor.rgb * a, a);
  }
}`;

const QUAD_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const TONE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uAcc;
uniform float uExposure;
uniform float uInk;
uniform float uDim;
uniform vec3 uBg;
out vec4 outColor;
void main() {
  vec3 acc = texture(uAcc, vUv).rgb;
  if (uDim > 0.0) {
    float g = dot(acc, vec3(0.299, 0.587, 0.114));
    acc = mix(acc, vec3(g), 0.85) * uDim;
  }
  if (uInk > 0.5) {
    vec3 tr = exp(-1.7 * log(1.0 + 8.0 * uExposure * acc) / log(9.0));
    outColor = vec4(uBg * tr, 1.0);
    return;
  }
  float L = max(max(acc.r, acc.g), acc.b);
  if (L <= 1e-6) { outColor = vec4(0.0); return; }
  // Logarithmic, hue-preserving tone curve: white point at L = 1 / exposure.
  float b = clamp(log(1.0 + 8.0 * uExposure * L) / log(9.0), 0.0, 1.0);
  vec3 col = acc / L * b;
  outColor = vec4(col, b);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader error');
  return sh;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
  return p;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface InstanceSet {
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  count: number;
  buckets: ArcBuffers['buckets'];
  /** CPU data waiting to be uploaded (uploads happen only when the GPU is idle). */
  pending: ArcBuffers | null | undefined;
  version: number;
}

export class WebGLArcRenderer implements ArcRenderer {
  readonly kind = 'webgl' as const;
  private gl: WebGL2RenderingContext;
  private arcProg: WebGLProgram;
  private toneProg: WebGLProgram;
  private emptyVao: WebGLVertexArrayObject;
  private corners: Map<number, WebGLBuffer> = new Map();
  private lut: WebGLTexture;
  private sets: Record<'base' | 'highlight' | 'hover', InstanceSet>;
  private ua: Record<string, WebGLUniformLocation | null> = {};
  private ut: Record<string, WebGLUniformLocation | null> = {};
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private fbo: WebGLFramebuffer | null = null;
  private accTex: WebGLTexture | null = null;
  private accSize = [0, 0];
  private fence: WebGLSync | null = null;
  /** Progressive accumulation: what the FBO currently holds. */
  private acc = { key: '', done: 0 };
  private step = 0.25;
  private fenceStart = 0;
  private gpuMs = 0;
  readonly toneMapped: boolean;

  static create(canvas: HTMLCanvasElement | OffscreenCanvas, preserve = false): WebGLArcRenderer | null {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: preserve }) as WebGL2RenderingContext | null;
    if (!gl) return null;
    try {
      return new WebGLArcRenderer(canvas, gl);
    } catch (err) {
      console.warn('WebGL renderer failed to initialise', err);
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement | OffscreenCanvas, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    this.arcProg = program(gl, ARC_VS, ARC_FS);
    this.toneProg = program(gl, QUAD_VS, TONE_FS);
    for (const n of ['uView', 'uSize', 'uBaseline', 'uRatio', 'uHalf', 'uGrow', 'uMode', 'uHoverColor', 'uLut', 'uAlpha', 'uCoverage', 'uOutput']) this.ua[n] = gl.getUniformLocation(this.arcProg, n);
    for (const n of ['uAcc', 'uExposure', 'uInk', 'uDim', 'uBg']) this.ut[n] = gl.getUniformLocation(this.toneProg, n);
    this.emptyVao = gl.createVertexArray()!;
    for (const seg of SEGMENT_LEVELS) {
      const corners = new Float32Array((seg + 1) * 4);
      for (let i = 0; i <= seg; i++) corners.set([i / seg, -1, i / seg, 1], i * 4);
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
      this.corners.set(seg, buf);
    }
    this.lut = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.lut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, arcColorLUT(256));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.sets = { base: this.makeSet(), highlight: this.makeSet(), hover: this.makeSet() };
    this.toneMapped = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_float_blend');
  }

  private makeSet(): InstanceSet {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    const buffer = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, 16, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    return { vao, buffer, count: 0, buckets: undefined, pending: undefined, version: 0 };
  }

  /** Uploads pending data. Called from render(), i.e. only when the previous frame is done. */
  private flush(set: InstanceSet) {
    if (set.pending === undefined) return;
    const b = set.pending;
    set.pending = undefined;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, set.buffer);
    if (b && b.count) gl.bufferData(gl.ARRAY_BUFFER, b.data.subarray(0, b.count * 4), gl.STATIC_DRAW);
    set.count = b ? b.count : 0;
    set.buckets = b?.buckets;
    set.version++;
  }

  setArcs(b: ArcBuffers) {
    this.sets.base.pending = b;
  }
  setHighlight(b: ArcBuffers | null) {
    this.sets.highlight.pending = b;
  }
  setHover(b: ArcBuffers | null) {
    this.sets.hover.pending = b;
  }

  resize(w: number, h: number, dpr: number) {
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== W) this.canvas.width = W;
    if (this.canvas.height !== H) this.canvas.height = H;
  }

  private ensureFbo(w: number, h: number): boolean {
    const gl = this.gl;
    if (this.fbo && this.accSize[0] === w && this.accSize[1] === h) return true;
    if (this.accTex) gl.deleteTexture(this.accTex);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    this.accTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.accTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.accTex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.accSize = [w, h];
    return ok;
  }

  /**
   * Draws the slice [from, to) (fractions 0..1) of every distance group of `set`. Groups keep
   * vote order, so drawing increasing fractions refines from the most to the least voted arcs.
   */
  private drawSet(set: InstanceSet, p: RenderParams, W: number, to: number, from = 0) {
    const gl = this.gl;
    gl.bindVertexArray(set.vao);
    const groups = set.buckets ?? [{ start: 0, count: set.count, maxDist: 1 }];
    const pxPerUnit = W / (p.view.x1 - p.view.x0);
    for (const g of groups) {
      const a = Math.floor(g.count * from);
      const b = to >= 1 ? g.count : Math.ceil(g.count * to);
      const count = b - a;
      if (count <= 0) continue;
      const maxPx = Math.min(W * 4, g.maxDist * pxPerUnit);
      const want = Math.sqrt(Math.max(1, maxPx)) * 2.4;
      const seg = SEGMENT_LEVELS.find((s) => s >= want) ?? SEGMENT_LEVELS[SEGMENT_LEVELS.length - 1];
      gl.bindBuffer(gl.ARRAY_BUFFER, this.corners.get(seg)!);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, set.buffer);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, (g.start + a) * 16);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (seg + 1) * 2, count);
    }
    gl.bindVertexArray(null);
  }

  private setArcUniforms(p: RenderParams, W: number, H: number, scale: number) {
    const gl = this.gl;
    const u = this.ua;
    gl.useProgram(this.arcProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.lut);
    gl.uniform1i(u.uLut, 0);
    gl.uniform2f(u.uView, p.view.x0, p.view.x1);
    gl.uniform2f(u.uSize, W, H);
    gl.uniform1f(u.uBaseline, p.layout.baseline * p.dpr * scale);
    gl.uniform1f(u.uRatio, p.layout.ratio);
    gl.uniform1f(u.uGrow, p.grow);
  }

  private lineUniforms(width: number, dpr: number, alpha: number, mode: number, output: number) {
    const gl = this.gl;
    const u = this.ua;
    const core = Math.max(1, width * dpr);
    gl.uniform1f(u.uHalf, core / 2 + 0.6);
    gl.uniform1f(u.uCoverage, Math.min(1, width * dpr));
    gl.uniform1f(u.uAlpha, alpha);
    gl.uniform1f(u.uMode, mode);
    gl.uniform1f(u.uOutput, output);
  }

  busy(): boolean {
    if (!this.fence) return false;
    const gl = this.gl;
    const status = gl.clientWaitSync(this.fence, 0, 0);
    if (status === gl.TIMEOUT_EXPIRED) return true;
    gl.deleteSync(this.fence);
    this.fence = null;
    this.gpuMs = performance.now() - this.fenceStart;
    return false;
  }

  lastFrameMs(): number {
    return this.gpuMs;
  }

  render(p: RenderParams): boolean {
    const gl = this.gl;
    this.flush(this.sets.base);
    this.flush(this.sets.highlight);
    this.flush(this.sets.hover);
    const W = this.canvas.width, H = this.canvas.height;
    const light = p.theme === 'light';
    const ink = light && !p.transparent;
    const target = p.limit == null || !this.sets.base.count ? 1 : Math.min(1, p.limit / this.sets.base.count);
    const bg = hexToRgb(p.background);
    gl.enable(gl.BLEND);

    let toneOk = this.toneMapped;
    // Accumulation resolution: half while interacting on HiDPI screens, and capped at ~4 Mpx.
    const cap = Math.min(1, Math.sqrt(4.2e6 / (W * H)));
    const scale = Math.min(cap, p.interacting && p.dpr > 1.25 ? 0.5 : 1);
    const aw = Math.max(1, Math.round(W * scale)), ah = Math.max(1, Math.round(H * scale));
    if (toneOk) toneOk = this.ensureFbo(aw, ah);
    let complete = true;

    if (toneOk) {
      // 1. Accumulate the base layer progressively (persistent across frames).
      const key = JSON.stringify([p.view.x0, p.view.x1, aw, ah, ink, p.lineWidth, p.grow, p.layout.baseline, p.layout.ratio, p.dpr, this.sets.base.version, target]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, aw, ah);
      if (key !== this.acc.key) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.acc = { key, done: 0 };
      }
      if (this.acc.done < target && this.sets.base.count) {
        // Interaction frames draw their whole (reduced) set at once; idle frames refine in
        // slices sized from the measured GPU time.
        if (this.gpuMs > 60) this.step = Math.max(0.02, this.step * 0.5);
        else if (this.gpuMs > 0 && this.gpuMs < 25) this.step = Math.min(1, this.step * 1.6);
        const next = p.interacting ? target : Math.min(target, this.acc.done + this.step);
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFunc(gl.ONE, gl.ONE);
        this.setArcUniforms(p, aw, ah, scale);
        this.lineUniforms(p.lineWidth, p.dpr * scale, 1, 0, ink ? 1 : 0);
        this.drawSet(this.sets.base, p, aw, next, this.acc.done);
        this.acc.done = next;
      }
      complete = this.acc.done >= target;
      // 2. Tone-map to the canvas (exposure compensates for the fraction drawn so far).
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);
      gl.useProgram(this.toneProg);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.accTex);
      gl.uniform1i(this.ut.uAcc, 1);
      gl.uniform1f(this.ut.uExposure, p.alpha / Math.max(1e-3, this.acc.done || 1));
      gl.uniform1f(this.ut.uInk, ink ? 1 : 0);
      gl.uniform1f(this.ut.uDim, p.dimmed ? 0.07 : 0);
      gl.uniform3f(this.ut.uBg, bg[0], bg[1], bg[2]);
      gl.bindVertexArray(this.emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.enable(gl.BLEND);
    } else {
      // Fallback: direct blending with a small per-arc alpha (single pass).
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      if (ink) gl.clearColor(bg[0], bg[1], bg[2], 1);
      else gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.blendEquation(ink ? gl.FUNC_REVERSE_SUBTRACT : gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, light && !ink ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
      this.setArcUniforms(p, W, H, 1);
      const a = Math.min(0.9, Math.max(0.015, 0.05 * Math.sqrt(345000 / Math.max(1, this.sets.base.count * target)))) * p.intensity * (p.dimmed ? 0.25 : 1);
      this.lineUniforms(p.lineWidth, p.dpr, a, 0, ink ? 1 : light ? 2 : 0);
      if (this.sets.base.count) this.drawSet(this.sets.base, p, W, target);
    }

    // 3. Highlighted connections and hovered arc, on top at full resolution.
    gl.viewport(0, 0, W, H);
    this.setArcUniforms(p, W, H, 1);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const hl = this.sets.highlight;
    if (hl.count) {
      const a = Math.min(0.95, Math.max(0.16, 2.2 / Math.sqrt(hl.count))) * Math.min(1.5, Math.max(0.7, p.intensity));
      this.lineUniforms(Math.max(1.2, p.lineWidth * 1.4), p.dpr, a, 1, light ? 2 : 0);
      this.drawSet(hl, p, W, 1);
    }
    if (this.sets.hover.count) {
      gl.useProgram(this.arcProg);
      gl.uniform3f(this.ua.uHoverColor, light ? 0.05 : 1, light ? 0.06 : 1, light ? 0.09 : 1);
      this.lineUniforms(2.4, p.dpr, 1, 2, 0);
      this.drawSet(this.sets.hover, p, W, 1);
    }
    if (this.fence) gl.deleteSync(this.fence);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    this.fenceStart = performance.now();
    gl.flush();
    return complete;
  }

  dispose() {
    const gl = this.gl;
    for (const s of Object.values(this.sets)) {
      gl.deleteBuffer(s.buffer);
      gl.deleteVertexArray(s.vao);
    }
    for (const b of this.corners.values()) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.emptyVao);
    gl.deleteTexture(this.lut);
    if (this.accTex) gl.deleteTexture(this.accTex);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    gl.deleteProgram(this.arcProg);
    gl.deleteProgram(this.toneProg);
  }
}
