import { describe, expect, it } from 'vitest';
import { deepStars, edgesOf, sparksFor, skyStars, sparkTargets } from '~/ui/outSky';

/** A grab `w` by `h`, black, with a white square from `x0, y0` to `x1, y1` (exclusive). */
function grabWithSquare(w: number, h: number, [x0, y0, x1, y1]: [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const on = x >= x0 && x < x1 && y >= y0 && y < y1;
      data.set([on ? 255 : 0, on ? 255 : 0, on ? 255 : 0, 255], 4 * (y * w + x));
    }
  }
  return data;
}

describe('edgesOf: the frame on the screen as a gold line drawing (the mock-up\'s Sobel)', () => {
  it('draws the outline of what stands out, and nothing on a flat field', () => {
    const w = 40;
    const h = 30;
    const edges = edgesOf(grabWithSquare(w, h, [10, 8, 30, 22]), w, h);
    expect(edges.width).toBe(w);
    expect(edges.alpha).toHaveLength(w * h);
    const a = (x: number, y: number): number => edges.alpha[y * w + x]!;
    // On the square's sides, strong; inside it and outside it, none.
    expect(a(10, 15)).toBe(255);
    expect(a(20, 8)).toBe(255);
    expect(a(20, 15)).toBe(0);
    expect(a(3, 3)).toBe(0);
    // Its points are the strong ones, x, y and strength in threes.
    expect(edges.points.length % 3).toBe(0);
    expect(edges.points.length / 3).toBeGreaterThan(40);
    for (let k = 0; k < edges.points.length; k += 3) expect(edges.points[k + 2]!).toBeGreaterThan(0.35);
  });

  it('finds nothing in a black frame', () => {
    const edges = edgesOf(new Uint8ClampedArray(20 * 10 * 4), 20, 10);
    expect(edges.points).toHaveLength(0);
    expect(edges.alpha.every((v) => v === 0)).toBe(true);
  });
});

describe("skyStars: the Q&A's sky", () => {
  it("has the mock-up's 1300 stars at 1440x900, as many again for twice the screen, half on the low tier", () => {
    expect(skyStars({ width: 1440, height: 900 }, 'high')).toHaveLength(1300);
    expect(skyStars({ width: 1440 * 2, height: 900 }, 'high')).toHaveLength(2600);
    expect(skyStars({ width: 1440, height: 900 }, 'low')).toHaveLength(650);
  });

  it('spreads them over the screen, each with its brightness and its own twinkle, the same each time', () => {
    const stars = skyStars({ width: 390, height: 844 }, 'medium');
    for (const s of stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(390);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(844);
      expect(s.b).toBeGreaterThanOrEqual(0.25);
      expect(s.b).toBeLessThanOrEqual(1);
    }
    expect(skyStars({ width: 390, height: 844 }, 'medium')).toEqual(stars);
  });
});

describe('sparkTargets: where the sparks that build the Q&A land', () => {
  it('runs round the panel\'s box and along each question, and over the open answer\'s lines', () => {
    const targets = sparkTargets({
      box: { x: 100, y: 50, w: 400, h: 300 },
      questions: [{ x: 130, y: 80, w: 370, h: 56, text: 200 }],
      answer: { x: 130, y: 140, w: 370, h: 100 }
    });
    const onBox = targets.filter(([x, y]) => (y === 50 || y === 350) && x >= 100 && x <= 500);
    expect(onBox.length).toBeGreaterThan(100);
    // Along the question's rule, and on its words (within its text's width).
    expect(targets.some(([x, y]) => y === 80 && x > 130 && x < 500)).toBe(true);
    const words = targets.filter(([x, y]) => y > 90 && y < 126 && x >= 130 && x <= 330);
    expect(words.length).toBeGreaterThanOrEqual(80);
    // The answer's lines.
    expect(targets.some(([, y]) => y > 150 && y < 240)).toBe(true);
  });
});

describe('sparksFor: each spark from the drawing to its place', () => {
  const stars = skyStars({ width: 1440, height: 900 }, 'high');
  const targets: [number, number][] = [[700, 400], [710, 410]];
  const points = new Float32Array([10, 10, 0.9, 20, 30, 0.5]);

  it('sends 2400 at 1440x900, the first 1100 to the sky\'s own stars, the rest to the panel', () => {
    const sparks = sparksFor({ points, scale: 2 }, targets, stars, { width: 1440, height: 900 }, 'high');
    expect(sparks).toHaveLength(2400);
    expect(sparks.filter((s) => s.star !== null)).toHaveLength(1100);
    expect(sparks[0]!.star).toBe(0);
    expect([sparks[0]!.toX, sparks[0]!.toY]).toEqual([stars[0]!.x, stars[0]!.y]);
    expect(sparks[2000]!.star).toBeNull();
    expect(targets.some(([x, y]) => x === sparks[2000]!.toX && y === sparks[2000]!.toY)).toBe(true);
    // From the drawing's points, in the screen's px.
    for (const s of sparks) expect([20, 40]).toContain(s.fromX);
    for (const s of sparks) {
      expect(s.delay).toBeGreaterThanOrEqual(0);
      expect(s.delay).toBeLessThan(1);
      expect(s.lift).toBeGreaterThanOrEqual(60);
      expect(s.lift).toBeLessThan(200);
    }
  });

  it('sets off from round the middle when the frame gave no drawing', () => {
    const sparks = sparksFor(null, targets, stars, { width: 1440, height: 900 }, 'high');
    for (const s of sparks) {
      expect(Math.abs(s.fromX - 720)).toBeLessThanOrEqual(360);
      expect(Math.abs(s.fromY - 450)).toBeLessThanOrEqual(270);
    }
  });
});

describe('deepStars: the one sky the flight goes through', () => {
  it('has the Q&A\'s own stars where they stood, and 1400 more ahead at 1440x900', () => {
    const stars = skyStars({ width: 1440, height: 900 }, 'high');
    const deep = deepStars(stars, { width: 1440, height: 900 }, 'high');
    expect(deep).toHaveLength(1300 + 1400);
    expect(deep[0]).toMatchObject({ z: 1, dx: stars[0]!.x - 720, dy: stars[0]!.y - 450, extra: false });
    for (const d of deep.slice(1300)) {
      expect(d.extra).toBe(true);
      expect(d.z).toBeGreaterThanOrEqual(1.4);
      expect(d.z).toBeLessThanOrEqual(4.2);
      // First seen somewhere on the screen.
      expect(Math.abs(d.dx / d.z)).toBeLessThanOrEqual(780);
      expect(Math.abs(d.dy / d.z)).toBeLessThanOrEqual(500);
    }
  });
});
