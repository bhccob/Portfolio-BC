/**
 * How fast this GPU is, measured in a few ms before the scene is built, so the scene starts at the quality it can hold
 * (src/engine/quality.ts `startStep`) instead of stuttering for seconds and then rebuilding itself mid-story. The name of a
 * GPU says little (browsers mask it, and a laptop's own power plan moves it by a factor of three), so it is timed at the
 * work the scene spends most of its time on: a fragment shader reading a 3D texture many times, as the gas does. This
 * module is in the entry bundle: raw WebGL2, no three.js.
 */

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D uNoise;
uniform float uSeed;
out vec4 colour;
void main() {
  vec3 p = vec3(gl_FragCoord.xy / 512.0, uSeed);
  float sum = 0.0;
  // Each read depends on the last, so no driver can fold them away.
  for (int i = 0; i < 32; i++) {
    float n = texture(uNoise, p).r;
    sum += n;
    p = p * 1.07 + vec3(n, 1.0 - n, n * 0.5) * 0.11;
  }
  colour = vec4(fract(sum));
}`;

/** The work timed: this many pixels square, this many draws, each pixel `32` reads. */
const SIZE = 512;
const DRAWS = 12;
/** How many times it is timed, the fastest kept: anything else the machine was doing only ever makes it slower. */
const RUNS = 3;
/** Past this the GPU is so slow that the rest of the timing would itself be felt, ms. */
const ENOUGH_MS = 60;

const NOISE = 16;

function compiled(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

/**
 * The ms this GPU takes for the fixed work, on `gl`, a context nobody else draws with; null where it cannot tell (anything
 * missing or failing: the scene then starts at its best and the governor judges it by its frames). Never throws.
 */
export function gpuBench(gl: WebGL2RenderingContext, now: () => number = () => performance.now()): number | null {
  try {
    const vertex = compiled(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compiled(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);

    const noise = new Uint8Array(NOISE * NOISE * NOISE);
    let seed = 12345;
    for (let i = 0; i < noise.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[i] = seed >> 16;
    }
    gl.bindTexture(gl.TEXTURE_3D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, NOISE, NOISE, NOISE, 0, gl.RED, gl.UNSIGNED_BYTE, noise);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);

    gl.bindRenderbuffer(gl.RENDERBUFFER, gl.createRenderbuffer());
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, SIZE, SIZE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer());
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, gl.getParameter(gl.RENDERBUFFER_BINDING));
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
    gl.viewport(0, 0, SIZE, SIZE);
    gl.bindVertexArray(gl.createVertexArray());

    const uSeed = gl.getUniformLocation(program, 'uSeed');
    const pixel = new Uint8Array(4);
    const once = (run: number): number => {
      const began = now();
      for (let d = 0; d < DRAWS; d++) {
        gl.uniform1f(uSeed, (run + d * 0.1) * 0.37);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      // Waits for all of it: nothing else in WebGL says when a draw is really done.
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return now() - began;
    };
    // The first draw pays for what the driver put off; it is not the GPU's speed.
    once(0);
    let best = Number.POSITIVE_INFINITY;
    for (let run = 1; run <= RUNS; run++) {
      const took = once(run);
      best = Math.min(best, took);
      if (took > ENOUGH_MS) break;
    }
    return Number.isFinite(best) && best >= 0 ? best : null;
  } catch {
    return null;
  }
}
