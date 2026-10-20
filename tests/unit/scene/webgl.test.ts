import { describe, expect, it, vi } from 'vitest';
import { webglSupport } from '~/scene/webgl';

const RENDERER = 0x1f01;
const UNMASKED_RENDERER_WEBGL = 0x9246;

interface FakeOptions {
  /** What RENDERER answers: Chromium masks it, Firefox gives the real one. */
  masked?: string;
  /** What WEBGL_debug_renderer_info answers; undefined: the extension is missing. */
  unmasked?: string;
}

/** A WebGL2 context with just what webglSupport reads, and a record of the probe being let go. */
function fakeContext({ masked = 'WebKit WebGL', unmasked }: FakeOptions) {
  const lose = { loseContext: vi.fn() };
  const context = {
    RENDERER,
    getParameter: (name: number) => (name === RENDERER ? masked : name === UNMASKED_RENDERER_WEBGL ? unmasked : null),
    getExtension: (name: string) => {
      if (name === 'WEBGL_debug_renderer_info') return unmasked === undefined ? null : { UNMASKED_RENDERER_WEBGL };
      if (name === 'WEBGL_lose_context') return lose;
      return null;
    },
  };
  return { context, lose };
}

/** A canvas whose getContext('webgl2') answers `context`, and nothing for any other kind. */
const canvasWith = (context: unknown) => () => ({ getContext: (kind: string) => (kind === 'webgl2' ? context : null) }) as unknown as HTMLCanvasElement;

describe('webglSupport', () => {
  it("says 'none' where the browser gives no WebGL2 context", () => {
    expect(webglSupport(canvasWith(null))).toBe('none');
  });

  it("says 'none' where asking for one throws", () => {
    const throwing = () =>
      ({
        getContext: () => {
          throw new Error('blocked');
        },
      }) as unknown as HTMLCanvasElement;
    expect(webglSupport(throwing)).toBe('none');
  });

  it("says 'software' for a software rasteriser: SwiftShader, llvmpipe", () => {
    for (const unmasked of ['Google SwiftShader', 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'llvmpipe (LLVM 15.0.7, 256 bits)']) {
      expect(webglSupport(canvasWith(fakeContext({ unmasked }).context)), unmasked).toBe('software');
    }
  });

  it("says 'software' for Windows' WARP, the Basic Render Driver, too", () => {
    const unmasked = 'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)';
    expect(webglSupport(canvasWith(fakeContext({ unmasked }).context))).toBe('software');
  });

  it("says 'ok' for a GPU", () => {
    const unmasked = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)';
    expect(webglSupport(canvasWith(fakeContext({ unmasked }).context))).toBe('ok');
  });

  it('reads the renderer from RENDERER where the browser does not mask it (Firefox), without the extension', () => {
    expect(webglSupport(canvasWith(fakeContext({ masked: 'llvmpipe, or similar' }).context))).toBe('software');
    expect(webglSupport(canvasWith(fakeContext({ masked: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 980 Direct3D11 vs_5_0 ps_5_0)' }).context))).toBe('ok');
  });

  it("says 'ok' where the renderer cannot be told: a masked name and no extension", () => {
    expect(webglSupport(canvasWith(fakeContext({}).context))).toBe('ok');
  });

  it('lets the probe context go, whatever it found', () => {
    for (const unmasked of ['Google SwiftShader', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070)']) {
      const { context, lose } = fakeContext({ unmasked });
      webglSupport(canvasWith(context));
      expect(lose.loseContext).toHaveBeenCalledOnce();
    }
  });
});
