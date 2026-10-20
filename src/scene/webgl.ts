/**
 * Whether this browser can draw the scene: a WebGL2 context (three.js needs WebGL2), and not a software
 * rasteriser, where the scene would crawl at a few frames a second. The page shows the poster and the fallback
 * card for anything but 'ok' (SceneHost).
 */
export type WebGLSupport = 'ok' | 'none' | 'software';

/**
 * Renderer names of software rasterisers: Chromium's SwiftShader, Mesa's llvmpipe (and softpipe), and Windows'
 * WARP, the "Microsoft Basic Render Driver" a machine without a GPU driver falls back to.
 */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render driver/i;

/** What Chromium and Safari answer to RENDERER: a mask, not the GPU. */
const MASKED = /^webkit webgl$/i;

const RENDERER = 0x1f01;
const UNMASKED_RENDERER_WEBGL = 0x9246;

/** The GPU's name as far as the browser tells it: RENDERER where it is not masked (Firefox), else the debug extension. */
function rendererName(gl: WebGL2RenderingContext): string {
  const plain = String(gl.getParameter(gl.RENDERER ?? RENDERER) ?? '');
  if (plain && !MASKED.test(plain)) return plain;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL ?? UNMASKED_RENDERER_WEBGL) ?? '') : plain;
}

/**
 * Probes a fresh canvas for a WebGL2 context and lets it go again. 'none': no context (WebGL off, blocked, or
 * WebGL1 only); 'software': a software rasteriser draws it; 'ok': a GPU, or a GPU the browser will not name.
 * Never throws.
 */
export function webglSupport(create: () => HTMLCanvasElement = () => document.createElement('canvas')): WebGLSupport {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = create().getContext('webgl2');
  } catch {
    return 'none';
  }
  if (!gl) return 'none';
  try {
    return SOFTWARE.test(rendererName(gl)) ? 'software' : 'ok';
  } catch {
    return 'ok';
  } finally {
    // Browsers cap live contexts: the probe's is given back at once rather than when it is collected.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
