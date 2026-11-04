/**
 * The digitize's LED screen (round 15, spec 2026-11-01-bob-dissolve-digitize-design.md; the mock-up's `scanWorld`, Bob's
 * mix: "digitize for stuur een bericht"): past question 6 a laser line sweeps down the screen and over it the world is
 * drawn as small square LEDs, a cell a pixel of the frame on the screen (grabbed after the render, ../scene/frameGrab.ts),
 * each dot as big and as bright as its cell, dark violet through violet and gold to warm white; behind the end's words
 * the LEDs go dark, and a ripple of light runs out from the core as the end comes. One canvas over the scene, under the
 * Q&A's words (src/ui/QaRing.tsx `.qa-leds`), drawn by the Q&A's scene (src/scene/bob/qaScene.ts).
 *
 * It is drawn by the GPU, in a small WebGL context of its own: the frame goes up as a texture and one fragment shader lays
 * every dot. Reading the frame back and drawing a hundred thousand little rectangles a frame on the CPU took 25 ms on a fast
 * desktop at 1440p, far more on a laptop: the slowest frames of the whole site, at its very end.
 */

/** The LEDs' numbers (the mock-up's): levels, the faintest left out, the brightness's gain, a dot's size by its level, the line's glow, the hush behind the end's words, the ripple. */
export const LED = {
  levels: 12,
  skip: 2,
  gain: 1.1,
  dot: [0.28, 0.6],
  line: { glow: 40 },
  hush: { radius: 420, alpha: 0.82, at: 0.4 },
  ripple: { gain: 0.5, width: 60, reach: 1.4 }
} as const;

/** The tints' stops: dark violet, violet at 60% of the levels, gold at 82%, warm white at the top. */
const STOPS = { dim: [38, 26, 92], violet: [118, 88, 226], gold: [255, 186, 88], white: [255, 238, 205] } as const;

/** A cell's size, CSS px: 6, 5 on a phone. */
export function ledCell(width: number): number {
  return width <= 700 ? 5 : 6;
}

/** A cell's level, 0..11, from its brightness 0..1: 1.1 √l of twelve, the top held. */
export function ledLevel(luminance: number): number {
  return Math.floor(Math.min(LED.gain * Math.sqrt(Math.max(luminance, 0)), 0.999) * LED.levels);
}

const mixed = (a: readonly number[], b: readonly number[], t: number): number[] => a.map((v, i) => Math.round(v + (b[i]! - v) * t));

/** Each level's colour, 0..255. */
export const LED_COLOURS: readonly (readonly number[])[] = Array.from({ length: LED.levels }, (_, k) => {
  const t = k / (LED.levels - 1);
  if (t < 0.6) return mixed(STOPS.dim, STOPS.violet, t / 0.6);
  if (t < 0.82) return mixed(STOPS.violet, STOPS.gold, (t - 0.6) / 0.22);
  return mixed(STOPS.gold, STOPS.white, (t - 0.82) / 0.18);
});

/** Each level's colour, as CSS. */
export const LED_TINTS: readonly string[] = LED_COLOURS.map((c) => `rgb(${c.join(',')})`);

/** What a frame of the LEDs is drawn from. */
export interface LedDraw {
  /** The frame on the screen, grabbed after the render; null when there is none (a lost context). */
  source: TexImageSource | null;
  /** The laser line's place down the screen, 0 (none) .. 1 (past its foot). */
  line: number;
  /** The end's part, 0..1: the hush behind its words, the ripple. */
  end: number;
  /** The screen, CSS px. */
  size: { width: number; height: number };
  /** The core's light on the screen, CSS px: where the ripple runs out from; null unseen. */
  core: { x: number; y: number } | null;
}

export interface LedSky {
  /** Starts its shader compiling, off the main thread where the browser can: the Q&A is under way, the screen comes soon. */
  prepare(): void;
  draw(d: LedDraw): void;
  clear(): void;
}

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uFrame;
uniform vec2 uSize;
uniform float uCell;
uniform float uOver;
uniform float uEnd;
uniform float uLaser;
uniform vec3 uCore;
uniform float uWave;
uniform vec3 uTints[${LED.levels}];
out vec4 colour;

const vec3 DARK = vec3(3.0, 1.0, 8.0) / 255.0;
const vec3 GLOW = vec3(255.0, 196.0, 110.0) / 255.0;
const vec3 LINE = vec3(255.0, 236.0, 196.0) / 255.0;

// Lays a straight colour with its alpha over what is there, premultiplied.
vec4 over(vec4 under, vec3 c, float a) {
  return vec4(c * a + under.rgb * (1.0 - a), a + under.a * (1.0 - a));
}

void main() {
  // From the top left, in the canvas's own pixels, as the screen is read.
  vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  vec2 cell = floor(px / uCell);
  vec2 origin = cell * uCell;
  vec4 out_ = vec4(0.0);
  if (px.y < uOver) out_ = vec4(DARK, 1.0);
  // A row of cells that has begun over the line is all there: its dots may reach a little past it.
  if (origin.y < uOver) {
    vec2 uv = (origin + 0.5 * uCell) / uSize;
    // The frame at the cell's middle alone, not its average: a star on one cell stays a bright dot, the sparkle Bob approved.
    vec3 f = texture(uFrame, vec2(uv.x, 1.0 - uv.y)).rgb;
    float bright = ${LED.gain.toFixed(3)} * sqrt(dot(f, vec3(0.2126, 0.7152, 0.0722)));
    if (uEnd > 0.0 && uCore.z > 0.0) {
      float away = (distance(origin, uCore.xy) - uWave) / ${LED.ripple.width.toFixed(1)};
      bright += ${LED.ripple.gain.toFixed(3)} * exp(-away * away);
    }
    int level = int(floor(min(bright, 0.999) * ${LED.levels.toFixed(1)}));
    if (level >= ${LED.skip}) {
      float size = uCell * (${LED.dot[0].toFixed(3)} + ${LED.dot[1].toFixed(3)} * float(level) / ${(LED.levels - 1).toFixed(1)});
      vec2 d = abs(px - (origin + 0.5 * uCell));
      // Covered as a square of that size is, its edges smoothed over a pixel.
      vec2 inside = clamp(size * 0.5 + 0.5 - d, 0.0, 1.0);
      out_ = over(out_, uTints[level], inside.x * inside.y);
    }
  }
  // Behind the end's words, the LEDs go dark: over the line only, never the scene still under it.
  if (uEnd > 0.0 && px.y < uOver) {
    float fall = 1.0 - clamp(distance(px, vec2(uSize.x * 0.5, ${LED.hush.at.toFixed(3)} * uSize.y)) / ${LED.hush.radius.toFixed(1)}, 0.0, 1.0);
    out_ = over(out_, DARK, ${LED.hush.alpha.toFixed(3)} * uEnd * fall);
  }
  // The laser while it is on its way: its glow above it, then the line.
  if (uLaser > 0.0) {
    if (px.y < uOver && px.y >= uOver - ${LED.line.glow.toFixed(1)}) out_ = over(out_, GLOW, 0.35 * (px.y - (uOver - ${LED.line.glow.toFixed(1)})) / ${LED.line.glow.toFixed(1)});
    if (px.y >= uOver - 1.0 && px.y < uOver + 1.0) out_ = over(out_, LINE, 0.95);
  }
  colour = out_;
}`;

/** Starts the program compiling and answers it; asking how it went (`finish`) is what waits for it. */
function startProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT]
  ] as const) {
    const shader = gl.createShader(type) as WebGLShader;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return program;
}

/** What it draws with, once its program is linked, or null if it did not. */
function finish(gl: WebGL2RenderingContext, program: WebGLProgram): { u: (name: string) => WebGLUniformLocation | null } | null {
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const u = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
  gl.uniform3fv(u('uTints'), LED_COLOURS.flatMap((c) => c.map((v) => v / 255)));
  gl.clearColor(0, 0, 0, 0);
  return { u };
}

/** The LED screen on `canvas`. Its context is made the first time it draws, and is its own: the scene's knows nothing of it. */
export function makeLedSky(canvas: HTMLCanvasElement): LedSky {
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let drawer: ReturnType<typeof finish> = null;
  let tried = false;
  // Whether anything stands on the canvas: the Q&A's scene clears it every frame it does not draw it.
  let drawn = false;
  const clear = (): void => {
    if (!drawn || !gl) return;
    drawn = false;
    gl.clear(gl.COLOR_BUFFER_BIT);
  };
  const prepare = (): void => {
    if (tried) return;
    tried = true;
    // Its pixels stay until they are cleared, as a 2D canvas's: the scene sleeps behind the end page, and the screen stands.
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true }) as WebGL2RenderingContext | null;
    program = gl ? startProgram(gl) : null;
  };
  return {
    prepare,
    clear,
    draw({ source, line, end, size, core }) {
      prepare();
      if (!gl || !program) return;
      drawer ??= finish(gl, program);
      if (!drawer) return;
      const W = Math.round(size.width);
      const H = Math.round(size.height);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
        gl.viewport(0, 0, W, H);
      }
      clear();
      if (source === null || !(line > 0)) return;
      const cell = ledCell(W);
      const over = Math.min(H, line * H);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
      const { u } = drawer;
      gl.uniform2f(u('uSize'), W, H);
      gl.uniform1f(u('uCell'), cell);
      gl.uniform1f(u('uOver'), over);
      gl.uniform1f(u('uEnd'), end);
      gl.uniform1f(u('uLaser'), line < 1 ? 1 : 0);
      gl.uniform3f(u('uCore'), core?.x ?? 0, core?.y ?? 0, core ? 1 : 0);
      gl.uniform1f(u('uWave'), end * LED.ripple.reach * Math.hypot(W, H));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      drawn = true;
    }
  };
}
