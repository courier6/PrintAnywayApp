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

/** One clear pixel, for a texture that has nothing to show. An ImageData like the layers themselves: Firefox writes
 * a console warning for every texture given no data at all, and another for every upload of plain bytes while
 * premultiplying is on. */
const CLEAR_PIXEL = new ImageData(1, 1);

/** The context every ripple canvas asks for. */
const CONTEXT: WebGLContextAttributes = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };

/** The ripple's program, linked and in use on `gl`, its two triangles over the whole canvas bound. Throws if the
 * browser cannot compile it. */
function build(gl: WebGLRenderingContext): WebGLProgram {
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
  return prog;
}

/** A layer's pixels (an ImageData uploads without a read back from the GPU) and the rect it covers, in virtual px. */
export interface RippleLayer {
  src: ImageData | HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  /** True in a frame that has drawn nothing on the layer: its texture is then one clear pixel and the layer is not
   * uploaded. A canvas the size of the frame that nothing has drawn on is the slowest thing a browser can be asked to
   * upload (some 3.5 ms a frame at 2640 × 1760), and the page layer is that for most of every ripple. */
  empty?: () => boolean;
}

/**
 * A WebGL canvas that redraws `top` (and `under` where `top` is see-through) bent by the ripple.
 * It is on the page for the whole room and shown for the 1.6 s of a slam's ripple. Its context and program are made
 * with the room, before the room shows, so that work never falls in a frame the player is watching. The canvas is one
 * pixel large until a slam begins (wake), when it takes the frame's size and draws once unbent, out of sight, so
 * the textures are on the GPU before the landing shows them. After the ripple it is one pixel again and its
 * textures are emptied (rest): at the screen's resolution the canvas is the size of the whole frame, twice over
 * with its front buffer, and the page layer's texture is as large again.
 */
export class RippleView {
  readonly canvas: HTMLCanvasElement;
  /** Null when the browser gives no WebGL (or the program fails): the slam goes without its ripple. */
  private readonly gl: WebGLRenderingContext | null;
  private lost = false;
  private awake = false;
  private px = 1;
  private readonly u: Record<string, WebGLUniformLocation | null> = {};
  private readonly tex: WebGLTexture[] = [];

  /** The view, its canvas ready for the page. Without WebGL it is a canvas that never shows. */
  static create(className: string, top: RippleLayer, under?: RippleLayer): RippleView {
    return new RippleView(className, top, under);
  }

  private constructor(
    className: string,
    private readonly top: RippleLayer,
    private readonly under?: RippleLayer,
  ) {
    const canvas = document.createElement('canvas');
    canvas.className = className;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = canvas.height = 1;
    canvas.addEventListener('webglcontextlost', () => {
      this.lost = true;
    });
    this.canvas = canvas;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = this.setup();
    } catch {
      gl = null;
    }
    this.gl = gl;
  }

  private setup(): WebGLRenderingContext | null {
    const { top, under } = this;
    const gl = this.canvas.getContext('webgl', CONTEXT);
    if (!gl) return null;
    const prog = build(gl);
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
      // The grid the under layer is bent on is its size now, when the view is made. For the page layer that is
      // before the room has sized it (a canvas's own 300 × 150): the grid the page has always had in the ripple.
      gl.uniform2f(this.u.uUnderSize, under.src.width, under.src.height);
    }
    return gl;
  }

  /** `px` device px to the virtual px: awake, the canvas is the frame's size at the screen's resolution. */
  resize(px: number): void {
    this.px = px;
    if (this.awake) this.size();
  }

  private size(): void {
    const w = Math.round(this.top.w * this.px);
    const h = Math.round(this.top.h * this.px);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  /** A slam has begun: the canvas takes its size and one frame is drawn unbent, while it is still out of sight. */
  wake(): void {
    if (this.awake || !this.gl || this.lost) return;
    this.awake = true;
    this.size();
    this.paint(0, 0, -1);
  }

  /** The ripple is over: the canvas and its textures give their pixels back. */
  rest(): void {
    if (!this.awake) return;
    this.awake = false;
    this.canvas.width = this.canvas.height = 1;
    const gl = this.gl;
    if (!gl || this.lost || gl.isContextLost()) return;
    for (let i = 0; i < this.tex.length; i++) this.clear(gl, i);
  }

  /** Texture `i` as one clear pixel. */
  private clear(gl: WebGLRenderingContext, i: number): void {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, CLEAR_PIXEL);
  }

  /** Releases the context (a browser allows a handful at once; the room is entered and left over and over in one
   * session). The view draws nothing after. */
  dispose(): void {
    const gl = this.gl;
    this.rest();
    this.lost = true;
    if (!gl || gl.isContextLost()) return;
    for (const t of this.tex) gl.deleteTexture(t);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /** Draws the layers bent by the ripple `t` ms after a landing at virtual (cx, cy). False if it could not. */
  draw(cx: number, cy: number, t: number): boolean {
    if (this.lost) return false;
    this.wake();
    return this.paint(cx, cy, t);
  }

  private paint(cx: number, cy: number, t: number): boolean {
    const gl = this.gl;
    if (!gl || this.lost || gl.isContextLost()) return false;
    const upload = (i: number, from: ImageData | HTMLCanvasElement) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, from);
    };
    upload(0, this.top.src);
    if (this.under) {
      if (this.under.empty?.()) this.clear(gl, 1);
      else upload(1, this.under.src);
    }
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
