/**
 * The way out's sky (round 14, spec 2026-10-31-bob-way-out-design.md), drawn as the mock-up Bob picked drew it
 * (.superpowers/r14/all.html): one canvas over the scene and under the Q&A's list (src/ui/QaRing.tsx `.qa-sky`), drawn
 * from the way out's stage (src/scene/bob/wayOut.ts) each frame the scene draws:
 * - the blueprint: the dark coming over the last floor, the floor's edges drawn in gold down the screen (a Sobel of the
 *   very frame on the screen, `edgesOf`), and the sparks off them, half becoming the Q&A's stars, half building its panel;
 * - the Q&A: the stars twinkling, and the circle round the middle closing a seventh a question, a mark for each;
 * - the flight: the list's light flown to the circle's head and run round the rest, then the one sky flown through, the
 *   stars streaking past and slowing to a drift (`deepStars`).
 * Its sizes are the mock-up's at 1440x900, its counts by the screen's area (half on the low tier).
 */
import type { QualityTier } from '~/engine/quality';
import { aheadAgain, circleFor, flightTravel, hash01, starDepth, type WayOutView } from '~/scene/bob/wayOut';

type Size = { width: number; height: number };
/** The stars' gold, and the circle's. */
const GOLD = '239, 181, 61';
const RING_GOLD = '226, 165, 74';
/** The dark that comes over the scene. */
const DARK = '#05030a';
/** The mock-up's screen, which its numbers are for. */
const MOCK = { width: 1440, height: 900 } as const;
/** How wide the frame is grabbed for its edges, px (a phone's narrower); its height by the screen's shape. */
const GRAB_WIDTH = { desk: 600, phone: 400 } as const;
/** A star's twinkle, rad a second. */
const TWINKLE = 1.3;
/** The streak's tail: where a star stood a frame ago at 60 frames a second. */
const FRAME_S = 1 / 60;

const clamp = (x: number, a = 0, b = 1): number => Math.min(Math.max(x, a), b);
const seg = (x: number, a: number, b: number): number => clamp((x - a) / (b - a));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ease = (x: number): number => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

/** How many of a thing the mock-up had `n` of at 1440x900, on a screen of `size` and tier: by area, half on the low tier. */
const countFor = (n: number, size: Size, tier: QualityTier): number =>
  Math.round(n * ((size.width * size.height) / (MOCK.width * MOCK.height)) * (tier === 'low' ? 0.5 : 1));

/** The frame's edges: each pixel's strength (0..255), and the strong ones' x, y and strength (0..1) in threes, the grab's px. */
export interface Edges {
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
  points: Float32Array;
}

/** The edges of a grabbed frame `w` by `h` (RGBA), the mock-up's Sobel of its luminance: a pixel's strength (|∇| − 0.06) · 4. */
export function edgesOf(rgba: Uint8ClampedArray, w: number, h: number): Edges {
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (0.2126 * rgba[4 * i]! + 0.7152 * rgba[4 * i + 1]! + 0.0722 * rgba[4 * i + 2]!) / 255;
  const alpha = new Uint8ClampedArray(w * h);
  const points: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const L = (dx: number, dy: number): number => lum[(y + dy) * w + x + dx]!;
      const gx = -L(-1, -1) - 2 * L(-1, 0) - L(-1, 1) + L(1, -1) + 2 * L(1, 0) + L(1, 1);
      const gy = -L(-1, -1) - 2 * L(0, -1) - L(1, -1) + L(-1, 1) + 2 * L(0, 1) + L(1, 1);
      const a = clamp((Math.hypot(gx, gy) - 0.06) * 4);
      alpha[y * w + x] = Math.round(255 * a);
      if (a > 0.35) points.push(x, y, a);
    }
  }
  return { width: w, height: h, alpha, points: Float32Array.from(points) };
}

/** A star of the Q&A's sky: where it stands (CSS px), its brightness and its twinkle's phase. */
export interface SkyStar {
  x: number;
  y: number;
  b: number;
  phase: number;
}

/** The Q&A's sky on a screen of `size`: the mock-up's 1300 at 1440x900, spread over it, the same each time. */
export function skyStars(size: Size, tier: QualityTier): SkyStar[] {
  const { width: w, height: h } = size;
  return Array.from({ length: countFor(1300, size, tier) }, (_, k) => ({
    x: ((10 + hash01(k, 1) * 1420) / MOCK.width) * w,
    y: ((10 + hash01(k, 2) * 880) / MOCK.height) * h,
    b: 0.25 + 0.75 * hash01(k, 3) ** 2,
    phase: hash01(k, 4) * Math.PI * 2
  }));
}

/** The panel's parts on the screen, CSS px: its box (with the dark round it), each question (its words' width), the open answer. */
export interface SparkBoxes {
  box: { x: number; y: number; w: number; h: number };
  questions: { x: number; y: number; w: number; h: number; text: number }[];
  answer: { x: number; y: number; w: number; h: number } | null;
}

/** Where the sparks that build the panel land (the mock-up's `measureSparks`): round its box, along each question, on the answer. */
export function sparkTargets({ box, questions, answer }: SparkBoxes): [number, number][] {
  const targets: [number, number][] = [];
  const along = (x0: number, y0: number, x1: number, y1: number, n: number): void => {
    for (let i = 0; i < n; i++) targets.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]);
  };
  along(box.x, box.y, box.x + box.w, box.y, 90);
  along(box.x + box.w, box.y, box.x + box.w, box.y + box.h, 70);
  along(box.x + box.w, box.y + box.h, box.x, box.y + box.h, 90);
  along(box.x, box.y + box.h, box.x, box.y, 70);
  questions.forEach((q, k) => {
    along(q.x, q.y, q.x + q.w, q.y, 60);
    for (let i = 0; i < 90; i++) targets.push([q.x + hash01(i + k * 97, 7) * q.text, q.y + q.h / 2 + (hash01(i + k * 97, 8) - 0.5) * 16]);
  });
  if (answer) {
    for (let ly = answer.y + 24; ly < answer.y + answer.h - 10; ly += 34) {
      for (let i = 0; i < 40; i++) targets.push([answer.x + hash01(i + ly, 9) * answer.w * 0.95, ly + (hash01(i + ly, 10) - 0.5) * 12]);
    }
  }
  return targets;
}

/** A spark: from a point of the drawing (CSS px, its strength) to its place, a star of the sky's (its number) or the panel's. */
export interface Spark {
  fromX: number;
  fromY: number;
  fromA: number;
  toX: number;
  toY: number;
  star: number | null;
  delay: number;
  lift: number;
}

/**
 * The sparks (the mock-up's 2400 at 1440x900, by area): off the drawing's points (`edges`, their scale to CSS px; round the
 * middle without them), the first 1100 of them to the sky's own stars (they are those stars), the rest to `targets`.
 */
export function sparksFor(edges: { points: Float32Array; scale: number } | null, targets: readonly [number, number][], stars: readonly SkyStar[], size: Size, tier: QualityTier): Spark[] {
  const count = countFor(2400, size, tier);
  const sky = Math.min(stars.length, Math.round((count * 1100) / 2400));
  const n = edges ? edges.points.length / 3 : 0;
  const { width: w, height: h } = size;
  return Array.from({ length: count }, (_, k) => {
    const p = (k * 7919) % Math.max(n, 1);
    const from =
      n > 0
        ? [edges!.points[3 * p]! * edges!.scale, edges!.points[3 * p + 1]! * edges!.scale, edges!.points[3 * p + 2]!]
        : [w / 2 + (hash01(k, 41) - 0.5) * w * 0.5, h / 2 + (hash01(k, 42) - 0.5) * h * 0.6, 0.5];
    const toStar = k < sky || targets.length === 0;
    const star = toStar ? k % stars.length : null;
    const to = star !== null ? [stars[star]!.x, stars[star]!.y] : targets[(k * 131) % targets.length]!;
    return {
      fromX: from[0]!,
      fromY: from[1]!,
      fromA: from[2]!,
      toX: to[0]!,
      toY: to[1]!,
      star,
      delay: ((k * 53) % 1000) / 1000,
      lift: (60 + ((k * 37) % 140)) * (h / MOCK.height)
    };
  });
}

/** A star of the flight: its place off the circle's middle at depth `z` (1 the Q&A's own sky), its brightness and twinkle. */
export interface DeepStar {
  dx: number;
  dy: number;
  z: number;
  b: number;
  phase: number;
  /** One of those further ahead, which come in as the flight sets off. */
  extra: boolean;
  /** Its number, for where it comes round again. */
  k: number;
}

/** The one sky the flight goes through: the Q&A's own stars where they stood, and the mock-up's 1400 more ahead (by area). */
export function deepStars(stars: readonly SkyStar[], size: Size, tier: QualityTier): DeepStar[] {
  const c = circleFor(size);
  const own = stars.map((s, k) => ({ dx: s.x - c.x, dy: s.y - c.y, z: 1, b: s.b, phase: s.phase, extra: false, k }));
  const ahead = Array.from({ length: countFor(1400, size, tier) }, (_, j): DeepStar => {
    const z = 1.4 + hash01(j, 21) * 2.8;
    return {
      dx: (hash01(j, 22) - 0.5) * (1560 / MOCK.width) * size.width * z,
      dy: (hash01(j, 23) - 0.5) * (1000 / MOCK.height) * size.height * z,
      z,
      b: 0.25 + 0.75 * hash01(j, 24) ** 2,
      phase: hash01(j, 25) * Math.PI * 2,
      extra: true,
      k: stars.length + j
    };
  });
  return [...own, ...ahead];
}

/** What the sky is drawn from, a frame. */
export interface SkyView {
  out: WayOutView;
  /** The Q&A's marks: the questions and the end's. */
  marks: number;
  /** The twinkle's clock, s (held still with reduced motion). */
  clock: number;
  size: Size;
  tier: QualityTier;
  /** The list's light on the screen, where the flight takes it from; null before it has rested at a question. */
  light: { x: number; y: number } | null;
}

export interface OutSky {
  draw(view: SkyView): void;
  /** Takes the frame on the screen (`source`, `width` by `height` px) for its edges, on a screen of `size`. */
  takeGrab(source: CanvasImageSource, width: number, height: number, size: Size): void;
  /** Whether it has the edges of a frame of this screen. */
  hasEdges(size: Size): boolean;
  /** Where the panel's sparks land, for the panel as it stands (`key`: its screen and open question). */
  setTargets(key: string, targets: [number, number][]): void;
  hasTargets(key: string): boolean;
  /** Draws nothing: the canvas cleared, once. */
  clear(): void;
}

/** The sky on `canvas`. */
export function makeOutSky(canvas: HTMLCanvasElement): OutSky {
  const ctx = canvas.getContext('2d');
  /** What is made per screen and tier: the stars, the flight's sky, and the sparks (made again when the targets come). */
  let made: { key: string; stars: SkyStar[]; deep: DeepStar[] } | null = null;
  let sparks: { key: string; list: Spark[] } | null = null;
  let edges: { key: string; data: Edges; image: HTMLCanvasElement | null; scale: number } | null = null;
  let targets: { key: string; list: [number, number][] } | null = null;
  let cleared = false;
  /** A star's glow, drawn once (the mock-up's radial gradient, four times the star's size). */
  let glow: HTMLCanvasElement | null = null;

  const sizeKey = (size: Size): string => `${size.width}x${size.height}`;
  const glowSprite = (): HTMLCanvasElement | null => {
    if (glow) return glow;
    const g = document.createElement('canvas');
    g.width = g.height = 64;
    const c = g.getContext('2d');
    if (!c) return null;
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${GOLD}, 0.35)`);
    grad.addColorStop(1, `rgba(${GOLD}, 0)`);
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
    glow = g;
    return g;
  };

  return {
    draw({ out, marks, clock, size, tier, light }) {
      if (!ctx) return;
      const { width: w, height: h } = size;
      const dpr = Math.min(globalThis.devicePixelRatio || 1, tier === 'low' ? 1 : 2);
      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);
      cleared = out.stretch === 'floor';
      if (cleared) return;
      const key = `${sizeKey(size)}:${tier}`;
      if (made?.key !== key) {
        const stars = skyStars(size, tier);
        made = { key, stars, deep: deepStars(stars, size, tier) };
        sparks = null;
      }
      const { stars, deep } = made;
      const twinkle = (b: number, phase: number): number => b * (0.65 + 0.35 * Math.sin(clock * TWINKLE + phase));
      const sprite = glowSprite();
      const star = (x: number, y: number, s: number, alpha: number): void => {
        if (alpha <= 0.01) return;
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(${GOLD}, ${alpha.toFixed(3)})`;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        if (s > 2.4 && sprite) {
          ctx.globalAlpha = alpha;
          ctx.drawImage(sprite, x - s * 4, y - s * 4, s * 8, s * 8);
          ctx.globalAlpha = 1;
        }
      };
      const c = circleFor(size);
      const on = (share: number, r: number): [number, number] => [c.x + Math.cos(-Math.PI / 2 - share * Math.PI * 2) * r, c.y + Math.sin(-Math.PI / 2 - share * Math.PI * 2) * r];
      const arc = (share: number, alpha: number, width: number, r: number): void => {
        if (share <= 0.001 || alpha <= 0.01 || r > 3 * Math.hypot(w, h)) return;
        ctx.save();
        ctx.strokeStyle = `rgba(${RING_GOLD}, ${0.95 * alpha})`;
        ctx.shadowColor = `rgba(${RING_GOLD}, ${0.5 * alpha})`;
        ctx.shadowBlur = 24;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, -Math.PI / 2, -Math.PI / 2 - Math.min(share, 1) * Math.PI * 2, true);
        ctx.stroke();
        ctx.restore();
      };
      /** The circle in the Q&A (the mock-up's `qaCircle`): drawn so far, a mark for each, lit once passed, its head bright. */
      const circle = (share: number, alpha: number): void => {
        arc(share, 0.8 * alpha, 1.6, c.r);
        for (let k = 0; k < marks; k++) {
          const passed = k / marks <= share - 1e-3;
          star(...on(k / marks, c.r), passed ? 4 : 2.5, (passed ? 0.95 : 0.3) * alpha);
        }
        star(...on(share, c.r), 4.5, alpha);
      };

      // The dark over the scene.
      if (out.dark > 0) {
        ctx.globalAlpha = out.dark;
        ctx.fillStyle = DARK;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'lighter';

      if (out.stretch === 'blueprint') {
        // The floor drawn in gold, down the screen.
        const image = edges?.key === sizeKey(size) ? edgeImage(edges) : null;
        if (out.lines > 0 && image) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, w, h * out.sweep);
          ctx.clip();
          ctx.globalAlpha = out.lines;
          ctx.drawImage(image, 0, 0, w, h);
          ctx.restore();
        }
        // The sparks: off the drawing, over in an arc; half build the Q&A, half become its stars.
        const sparkKey = `${key}:${targets?.key ?? ''}:${edges?.key ?? ''}`;
        if (sparks?.key !== sparkKey) {
          const from = edges?.key === sizeKey(size) ? { points: edges.data.points, scale: edges.scale } : null;
          sparks = { key: sparkKey, list: sparksFor(from, targets?.list ?? [], stars, size, tier) };
        }
        const sky = new Set<number>();
        if (out.fly > 0 || out.lines > 0) {
          for (const s of sparks.list) {
            const e = ease(seg(out.fly, s.delay * 0.45, s.delay * 0.45 + 0.55));
            const x = lerp(s.fromX, s.toX, e);
            const y = lerp(s.fromY, s.toY, e) - Math.sin(Math.PI * e) * s.lift;
            const before = e > 0 ? 0.85 : 0.5 * s.fromA;
            if (s.star !== null) {
              const st = stars[s.star]!;
              sky.add(s.star);
              star(x, y, lerp(2, 1 + st.b * 1.6, out.skyRest), lerp(before, twinkle(st.b, st.phase) * 0.85, out.skyRest));
            } else star(x, y, 2, before * out.frameFade);
          }
        }
        // The rest of the sky, and the circle's first part, come in as the sparks land.
        stars.forEach((st, k) => {
          if (!sky.has(k)) star(st.x, st.y, 1 + st.b * 1.6, twinkle(st.b, st.phase) * 0.85 * out.skyIn);
        });
        circle(out.share, out.circleIn);
        return;
      }
      if (out.stretch === 'qa') {
        for (const st of stars) star(st.x, st.y, 1 + st.b * 1.6, twinkle(st.b, st.phase) * 0.85);
        circle(out.share, 1);
        return;
      }

      // The flight (the mock-up's `flight`): the light to the circle's head and round it, then through it.
      const last = (marks - 1) / marks;
      const rz = c.r / out.ringZ;
      arc(out.share, out.round > 0 ? 1 : 0.85, out.round > 0 ? 2 : 1.6, rz);
      if (out.round <= 0 && light) {
        const head = on(last, c.r);
        const lift = Math.sin(Math.PI * out.lightFly) * 110 * (h / MOCK.height);
        star(lerp(light.x, head[0], out.lightFly), lerp(light.y, head[1], out.lightFly) - lift, 5, 1);
      } else if (out.round < 1) star(...on(out.share, c.r), 5, 1);
      if (out.ringZ > 0.6) for (let k = 0; k < marks; k++) star(...on(k / marks, rz), 4, 0.95 * seg(out.ringZ, 0.6, 0.9));
      // One sky, flown through: each star nearer as the camera goes on, a streak while it is fast; one flown past comes
      // round again far ahead, so the sky never empties and never cuts.
      const before = flightTravel(Math.max(0, out.s - FRAME_S));
      for (const d of deep) {
        const now = starDepth(d.z, out.travel, d.k);
        const spread = (again: boolean): [number, number] =>
          again ? [(hash01(d.k, 32) - 0.5) * (1560 / MOCK.width) * w * aheadAgain(d.k), (hash01(d.k, 33) - 0.5) * (1000 / MOCK.height) * h * aheadAgain(d.k)] : [d.dx, d.dy];
        const [dx, dy] = spread(now.again);
        const x = c.x + dx / now.z;
        const y = c.y + dy / now.z;
        const near = clamp(1 / now.z, 0, 3);
        const alpha = twinkle(d.b, d.phase) * 0.85 * clamp(1.3 - (now.z - 1) * 0.22, 0.45, 1) * (d.extra && !now.again ? out.extraIn : 1);
        const was = starDepth(d.z, before, d.k);
        if (out.speed > 0.25 && was.again === now.again) {
          if (alpha <= 0.01) continue;
          ctx.strokeStyle = `rgba(${GOLD}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 0.6 + d.b * near;
          ctx.beginPath();
          ctx.moveTo(c.x + dx / was.z, c.y + dy / was.z);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else star(x, y, (1 + d.b * 1.6) * clamp(near, 0.75, 1.6), alpha);
      }
    },
    takeGrab(source, width, height, size) {
      if (!(width > 0 && height > 0)) return;
      const gw = size.width <= 700 ? GRAB_WIDTH.phone : GRAB_WIDTH.desk;
      const gh = Math.max(1, Math.round((gw * size.height) / size.width));
      const small = document.createElement('canvas');
      small.width = gw;
      small.height = gh;
      const c = small.getContext('2d', { willReadFrequently: true });
      if (!c) return;
      c.drawImage(source, 0, 0, gw, gh);
      edges = { key: sizeKey(size), data: edgesOf(c.getImageData(0, 0, gw, gh).data, gw, gh), image: null, scale: size.width / gw };
    },
    hasEdges: (size) => edges?.key === sizeKey(size),
    setTargets(key, list) {
      targets = { key, list };
    },
    hasTargets: (key) => targets?.key === key,
    clear() {
      if (cleared || !ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cleared = true;
    }
  };
}

/** The edges as a picture, gold where they are strong, made once from their strengths. */
function edgeImage(edges: { data: Edges; image: HTMLCanvasElement | null }): HTMLCanvasElement | null {
  if (edges.image) return edges.image;
  const { width: w, height: h, alpha } = edges.data;
  const image = document.createElement('canvas');
  image.width = w;
  image.height = h;
  const c = image.getContext('2d');
  if (!c) return null;
  const pixels = c.createImageData(w, h);
  for (let i = 0; i < w * h; i++) pixels.data.set([239, 181, 61, alpha[i]!], 4 * i);
  c.putImageData(pixels, 0, 0);
  edges.image = image;
  return image;
}
