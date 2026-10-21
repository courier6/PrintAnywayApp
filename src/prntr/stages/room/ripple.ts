/**
 * The slam's ripple (PRNTR-SLAM.md §4.2): the pixel world bent like water, out from where the machine
 * landed. One WebGL fragment shader redraws a 2D layer of the room per screen pixel, its cells
 * nearest-neighbour and bent smoothly, so the bend is finer than the pixels it moves. The same
 * displacement is computed in JS (rippleAt) for the HUD's tear and the dev hook; the shader's
 * constants are written into its source from the ones here, so the two cannot drift apart.
 */

export const RIPPLE_MS = 1600;
/** How fast the front goes out, virtual px per ms. */
export const RIPPLE_SPEED = 0.2;
/** The largest displacement, virtual px; its wavelength; how far behind the front the rings fade to 1/e. */
const RIPPLE_AMP = 5;
const RIPPLE_WAVE = 28;
const RIPPLE_TAIL = 60;

/** How far the front has gone `t` ms after the landing, virtual px. */
export const rippleFront = (t: number) => RIPPLE_SPEED * t;

/** The displacement at virtual (x, y), `t` ms after a landing at (cx, cy): the picture at (x, y) is taken
 * from (x, y) plus this. Nothing ahead of the front, and nothing outside the ripple's time. */
export function rippleAt(x: number, y: number, cx: number, cy: number, t: number): { x: number; y: number } {
  if (t < 0 || t >= RIPPLE_MS) return { x: 0, y: 0 };
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.hypot(dx, dy);
  const s = r - rippleFront(t);
  if (s > 0) return { x: 0, y: 0 };
  const u = t / RIPPLE_MS;
  const k = (RIPPLE_AMP * (1 - u * u) * Math.exp(s / RIPPLE_TAIL) * Math.sin((2 * Math.PI * s) / RIPPLE_WAVE)) / Math.max(r, 1);
  return { x: dx * k, y: dy * k };
}

const f = (n: number) => n.toFixed(4);

const VERT = `attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

// The layer on top (the room, or the front layer), and under it, where it is see-through, an optional
// finer layer over a rect of it (the print under the room's hole). Premultiplied throughout.
const FRAG = `precision highp float;
uniform sampler2D uTop;
uniform sampler2D uUnder;
uniform vec2 uTopSize;
uniform vec4 uUnderRect;
uniform vec2 uUnderSize;
uniform float uHasUnder;
uniform float uPx;
uniform float uViewH;
uniform vec2 uC;
uniform float uT;
vec2 ripple(vec2 p) {
  vec2 d = p - uC;
  float r = length(d);
  float s = r - ${f(RIPPLE_SPEED)} * uT;
  if (s > 0.0 || uT < 0.0 || uT >= ${f(RIPPLE_MS)}) return vec2(0.0);
  float u = uT / ${f(RIPPLE_MS)};
  return d * (${f(RIPPLE_AMP)} * (1.0 - u * u) * exp(s / ${f(RIPPLE_TAIL)}) * sin(6.2831853 * s / ${f(RIPPLE_WAVE)}) / max(r, 1.0));
}
vec4 cell(sampler2D tex, vec2 size, vec2 q) {
  vec2 c = clamp(floor(q), vec2(0.0), size - 1.0);
  return texture2D(tex, (c + 0.5) / size);
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uViewH - gl_FragCoord.y) / uPx;
  vec2 q = p + ripple(p);
  vec4 c = cell(uTop, uTopSize, q);
  if (uHasUnder > 0.5 && c.a < 1.0) {
    vec2 a = (q - uUnderRect.xy) / uUnderRect.zw;
    if (a.x >= 0.0 && a.y >= 0.0 && a.x < 1.0 && a.y < 1.0) c += cell(uUnder, uUnderSize, a * uUnderSize) * (1.0 - c.a);
  }
  gl_FragColor = c;
}`;

/** A layer's pixels (an ImageData uploads without a read back from the GPU) and the rect it covers, in virtual px. */
export interface RippleLayer {
  src: ImageData | HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A WebGL canvas that redraws `top` (and `under` where `top` is see-through) bent by the ripple. */
export class RippleView {
  readonly canvas: HTMLCanvasElement;
  private lost = false;
  private px = 1;
  private readonly u: Record<string, WebGLUniformLocation | null> = {};
  private readonly tex: WebGLTexture[] = [];

  /** Null when the browser gives no WebGL: the slam goes without its ripple. */
  static create(className: string, top: RippleLayer, under?: RippleLayer): RippleView | null {
    const canvas = document.createElement('canvas');
    canvas.className = className;
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return null;
    try {
      return new RippleView(canvas, gl, top, under);
    } catch {
      return null;
    }
  }

  private constructor(
    canvas: HTMLCanvasElement,
    private readonly gl: WebGLRenderingContext,
    private readonly top: RippleLayer,
    private readonly under?: RippleLayer,
  ) {
    this.canvas = canvas;
    canvas.addEventListener('webglcontextlost', () => {
      this.lost = true;
    });
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`prntr: ripple shader: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`prntr: ripple program: ${gl.getProgramInfoLog(prog)}`);
    gl.useProgram(prog);
    // two triangles over the whole canvas
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const name of ['uTop', 'uUnder', 'uTopSize', 'uUnderRect', 'uUnderSize', 'uHasUnder', 'uPx', 'uViewH', 'uC', 'uT']) this.u[name] = gl.getUniformLocation(prog, name);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tex.push(t);
    }
    gl.uniform1i(this.u.uTop, 0);
    gl.uniform1i(this.u.uUnder, 1);
    gl.uniform2f(this.u.uTopSize, top.src.width, top.src.height);
    gl.uniform1f(this.u.uHasUnder, under ? 1 : 0);
    if (under) {
      gl.uniform4f(this.u.uUnderRect, under.x, under.y, under.w, under.h);
      gl.uniform2f(this.u.uUnderSize, under.src.width, under.src.height);
    }
  }

  /** `px` device px to the virtual px: the canvas is the frame's size at the screen's resolution. */
  resize(px: number): void {
    this.px = px;
    this.canvas.width = Math.round(this.top.w * px);
    this.canvas.height = Math.round(this.top.h * px);
  }

  /** Draws the layers bent by the ripple `t` ms after a landing at virtual (cx, cy). False if it could not. */
  draw(cx: number, cy: number, t: number): boolean {
    const gl = this.gl;
    if (this.lost || gl.isContextLost()) return false;
    const upload = (i: number, from: ImageData | HTMLCanvasElement) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, from);
    };
    upload(0, this.top.src);
    if (this.under) upload(1, this.under.src);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uPx, this.px);
    gl.uniform1f(this.u.uViewH, this.canvas.height);
    gl.uniform2f(this.u.uC, cx, cy);
    gl.uniform1f(this.u.uT, t);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
  }
}
