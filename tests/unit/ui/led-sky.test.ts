import { describe, expect, it } from 'vitest';
import { LED, LED_TINTS, ledCell, ledLevel, makeLedSky } from '~/ui/ledSky';

/** A WebGL2 context that records what is drawn. */
function recorder() {
  const uniforms: Record<string, unknown> = {};
  const sources: string[] = [];
  const counts = { draw: 0, clear: 0, upload: 0, compile: 0, status: 0 };
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    LINK_STATUS: 3,
    createProgram: () => ({}),
    createShader: () => ({}),
    shaderSource: (_: unknown, source: string) => sources.push(source),
    compileShader: () => {
      counts.compile++;
    },
    attachShader: () => undefined,
    linkProgram: () => undefined,
    getProgramParameter: () => {
      counts.status++;
      return true;
    },
    useProgram: () => undefined,
    bindVertexArray: () => undefined,
    createVertexArray: () => ({}),
    bindTexture: () => undefined,
    createTexture: () => ({}),
    texParameteri: () => undefined,
    pixelStorei: () => undefined,
    getUniformLocation: (_: unknown, name: string) => name,
    uniform3fv: (name: string, v: number[]) => (uniforms[name] = v),
    uniform1f: (name: string, v: number) => (uniforms[name] = v),
    uniform2f: (name: string, a: number, b: number) => (uniforms[name] = [a, b]),
    uniform3f: (name: string, a: number, b: number, c: number) => (uniforms[name] = [a, b, c]),
    clearColor: () => undefined,
    clear: () => {
      counts.clear++;
    },
    viewport: () => undefined,
    texImage2D: () => {
      counts.upload++;
    },
    drawArrays: () => {
      counts.draw++;
    }
  };
  return { gl, uniforms, sources, counts };
}

function setup() {
  const screen = recorder();
  const asked: unknown[] = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: (_: string, options: unknown) => {
      asked.push(options);
      return screen.gl;
    }
  } as unknown as HTMLCanvasElement;
  return { sky: makeLedSky(canvas), canvas, asked, ...screen };
}

const SIZE = { width: 1440, height: 900 };
const SOURCE = { width: 1800, height: 1125 } as unknown as HTMLCanvasElement;

describe('the LED screen: the digitize, from the frame grab (round 15)', () => {
  it('has 6 px cells, 5 on a phone', () => {
    expect(ledCell(1440)).toBe(6);
    expect(ledCell(700)).toBe(5);
    expect(ledCell(390)).toBe(5);
  });

  it("reads a cell's level off its brightness: 1.1 √l of twelve", () => {
    expect(ledLevel(0)).toBe(0);
    expect(ledLevel(0.25)).toBe(6);
    expect(ledLevel(1)).toBe(11);
    expect(ledLevel(2)).toBe(11);
  });

  it('keeps its tints, dark violet to warm white', () => {
    expect(LED_TINTS).toHaveLength(LED.levels);
    expect(LED_TINTS[0]).toBe('rgb(38,26,92)');
    expect(LED_TINTS[11]).toBe('rgb(255,238,205)');
  });

  it('asks for no context until the Q&A is under way, and keeps its pixels when it has one', () => {
    const { sky, asked, counts } = setup();
    expect(asked).toEqual([]);
    sky.prepare();
    sky.prepare();
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
    // Compiling, not waited for: only the first draw asks how it went.
    expect(counts.compile).toBe(2);
    expect(counts.status).toBe(0);
    sky.draw({ source: SOURCE, line: 0.5, end: 0, size: SIZE, core: null });
    expect(counts.status).toBe(1);
  });

  it('draws nothing while the line has not come', () => {
    const { sky, counts } = setup();
    sky.draw({ source: SOURCE, line: 0, end: 0, size: SIZE, core: null });
    expect(counts.draw).toBe(0);
    expect(counts.upload).toBe(0);
    // Nothing stood on the canvas, so nothing is cleared either.
    expect(counts.clear).toBe(0);
  });

  it('draws the frame as one draw, sized to the screen', () => {
    const { sky, canvas, counts, uniforms } = setup();
    sky.draw({ source: SOURCE, line: 0.5, end: 0, size: SIZE, core: null });
    expect([canvas.width, canvas.height]).toEqual([1440, 900]);
    expect(counts.draw).toBe(1);
    expect(counts.upload).toBe(1);
    expect(uniforms.uSize).toEqual([1440, 900]);
    expect(uniforms.uCell).toBe(6);
    expect(uniforms.uOver).toBe(450);
    expect(uniforms.uLaser).toBe(1);
    expect(uniforms.uEnd).toBe(0);
    expect(uniforms.uTints).toHaveLength(LED.levels * 3);
  });

  it('writes the numbers of the mock-up into its shader', () => {
    const { sky, sources } = setup();
    sky.prepare();
    const fragment = sources[1]!;
    expect(fragment).toContain(`uTints[${LED.levels}]`);
    expect(fragment).toContain(`level >= ${LED.skip}`);
    expect(fragment).toContain(LED.gain.toFixed(3));
    expect(fragment).toContain(LED.hush.radius.toFixed(1));
    expect(fragment).toContain(LED.ripple.width.toFixed(1));
  });

  it('holds the line over the screen, and the laser goes once it is past', () => {
    const { sky, uniforms } = setup();
    sky.draw({ source: SOURCE, line: 1.4, end: 0.6, size: SIZE, core: { x: 720, y: 500 } });
    expect(uniforms.uOver).toBe(900);
    expect(uniforms.uLaser).toBe(0);
    expect(uniforms.uEnd).toBe(0.6);
    expect(uniforms.uCore).toEqual([720, 500, 1]);
    expect(uniforms.uWave).toBeCloseTo(0.6 * LED.ripple.reach * Math.hypot(1440, 900), 9);
  });

  it('clears when the grab gives nothing, and only what it drew', () => {
    const { sky, counts } = setup();
    sky.draw({ source: SOURCE, line: 0.5, end: 0, size: SIZE, core: null });
    sky.draw({ source: null, line: 0.8, end: 0, size: SIZE, core: null });
    expect(counts.draw).toBe(1);
    expect(counts.clear).toBe(1);
    // Once clear, it stays clear with no more work: the scene clears it every frame it does not draw it.
    sky.clear();
    expect(counts.clear).toBe(1);
  });

  it('stands aside where there is no context', () => {
    const canvas = { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
    const sky = makeLedSky(canvas);
    expect(() => {
      sky.prepare();
      sky.draw({ source: SOURCE, line: 0.5, end: 0, size: SIZE, core: null });
      sky.clear();
    }).not.toThrow();
  });
});
