/**
 * The glowing chip under the v3 compass: its body, its 64 pins and the ON that
 * a laser engraves on its top while the loader runs. One table that the 3D
 * parts and the tests read, so the pins the loader fills and the pins the
 * home keeps lit are the same 64. It imports nothing from three.
 *
 * Lengths are world units. The chip sits on the board plane y = CHIP.board at
 * the compass's centre, under the hub. Seen from above (the view of the
 * loader), x runs to the right and z runs toward the viewer, so the top of
 * the screen is -Z, the dial's north (see src/engine/instrument/dialSpec.ts).
 */

/**
 * The chip's measurements: the square body's side and height, the board
 * plane's height, the pins on each side, and each pin's length (how far it
 * reaches out from the body) and width.
 */
export const CHIP = {
  size: 0.28,
  height: 0.035,
  board: -0.15,
  pinsPerSide: 16,
  pinLength: 0.025,
  pinWidth: 0.0055
} as const;

/** How many pins the chip has: 4 sides of 16. The hexagram ring mirrors this count, one hexagram to a pin. */
export const PIN_COUNT = 64;

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/**
 * Where pin `i` (0..63) stands, as the centre of the pin in the chip's top
 * plane, with the side of the body it is on. Pins run clockwise as seen from
 * above, from the top side's left end: 16 on the top left to right, 16 down
 * the right side, 16 along the bottom right to left, 16 up the left side.
 * On each side they are evenly spaced, with half a pitch left at each end,
 * so no pin stands at a corner. The pin's centre is half its length out from
 * the body, so the whole pin is outside the body.
 */
export function pinPosition(i: number): { x: number; z: number; side: 'top' | 'right' | 'bottom' | 'left' } {
  const side = SIDES[Math.floor(i / CHIP.pinsPerSide)];
  const half = CHIP.size / 2;
  const pitch = CHIP.size / CHIP.pinsPerSide;
  // Along the side, in the direction the pins run (clockwise), from -half to +half.
  const along = -half + ((i % CHIP.pinsPerSide) + 0.5) * pitch;
  const out = half + CHIP.pinLength / 2;
  switch (side) {
    case 'top':
      return { x: along, z: -out, side };
    case 'right':
      return { x: out, z: along, side };
    case 'bottom':
      return { x: -along, z: out, side };
    default:
      return { x: -out, z: -along, side };
  }
}

/**
 * How many of the 64 pins are lit at a load progress, 0..1 (NaN reads as 0):
 * the loader fills them with the load. Scaling by 64 is exact, so the count
 * reaches 64 only when progress is 1 and a load that is almost done still
 * shows 63.
 */
export function pinsLit(progress: number): number {
  return Math.floor(clamp01(progress) * PIN_COUNT);
}

/** A point in the chip's top plane: x right, z toward the viewer. */
export type Point2 = readonly [x: number, z: number];

/** One engraved stroke: a polyline in the chip's top plane. */
export interface Stroke {
  points: readonly Point2[];
}

/** The O's points: the loop's 47 steps plus the first point again to close it. */
const O_POINTS = 48;
const O_CENTRE_X = -0.055;
const O_RX = 0.045;
const O_RZ = 0.065;

/**
 * The O as one closed loop: an ellipse, cut from the top and clockwise, whose
 * last point is the first one again so the laser ends where it began.
 */
function ellipse(): Stroke {
  const points: Point2[] = [];
  for (let i = 0; i < O_POINTS - 1; i++) {
    const a = (i / (O_POINTS - 1)) * 2 * Math.PI;
    points.push([O_CENTRE_X + O_RX * Math.sin(a), -O_RZ * Math.cos(a)]);
  }
  // Repeat the first point exactly: sin and cos of a full turn leave rounding error.
  points.push(points[0]);
  return { points };
}

/**
 * The strokes of the ON that the loader engraves, in the order the laser
 * cuts them: the O (one closed loop), then the N's left vertical, diagonal
 * and right vertical. They fit inside |x| <= 0.11, |z| <= 0.07 on the chip's
 * top (the body is 0.28 across), the O in the left half and the N in the
 * right. Every stroke is a real stroke, so the letters are drawn and not
 * faked with a texture.
 */
export const ON_STROKES: readonly Stroke[] = [
  ellipse(),
  {
    points: [
      [0.02, 0.065],
      [0.02, -0.065]
    ]
  },
  {
    points: [
      [0.02, -0.065],
      [0.1, 0.065]
    ]
  },
  {
    points: [
      [0.1, 0.065],
      [0.1, -0.065]
    ]
  }
];

/** The length of each stroke's polyline, in the order given. */
export function strokeLengths(strokes: readonly Stroke[]): number[] {
  return strokes.map((stroke) => {
    let length = 0;
    for (let i = 1; i < stroke.points.length; i++) {
      length += Math.hypot(stroke.points[i][0] - stroke.points[i - 1][0], stroke.points[i][1] - stroke.points[i - 1][1]);
    }
    return length;
  });
}

/**
 * How much of each stroke is cut (0..1) when `t` (0..1, NaN reads as 0) of
 * the strokes' total length has been cut. The laser cuts them in order: a
 * stroke starts only when the one before it is complete. A stroke the cut has
 * passed is exactly 1, so a finished engraving is [1, 1, ...] with no
 * rounding left over.
 */
export function engraved(strokes: readonly Stroke[], t: number): number[] {
  const lengths = strokeLengths(strokes);
  const cut = clamp01(t) * lengths.reduce((sum, length) => sum + length, 0);
  let start = 0;
  return lengths.map((length) => {
    const end = start + length;
    const fraction = cut >= end ? 1 : clamp01((cut - start) / length);
    start = end;
    return fraction;
  });
}
