/**
 * Where the hologram world stands (spec 2026-10-27-bob-hologram-world-design.md, after the mock-up Bob approved,
 * .superpowers/holo-world-mockup/data.ts): the round board level below the fall, the CPU at its centre, an area per
 * category on a ring round it, a pad per project on its area. Pure: it imports nothing of three or React, so the path,
 * the builder and the tests read the very same places.
 */
import type { CategoryId } from '~/data/categories';
import type { ProjectId } from '~/data/projects';
import { type AreaSpec, HAND_F } from '~/state/chapters';
import { lightAt } from './lightDive';

export type Vec3 = [number, number, number];

/**
 * The board's sizes, m (my calls in the spec, the mock-up's): its radius; how far below the light's height at the
 * hand-over it lies, so the whole fall stays above it; how high a project floats above its pad; how far apart two pads
 * of one area stand along its ring; and how far each object turns toward where its views stand (rad).
 */
export const BOARD = { radius: 4, drop: 9, hover: 0.5, apart: 1.3, turn: 0.5 } as const;

/** The ring the areas stand on, m from the board's centre. */
export const AREA_RING = 2.65;

/**
 * Each category's place on the ring, as the angle from the board's +x toward its +z (seen from above): the mock-up's
 * first area at (-2.55, 0.75), the second at (2.55, 0.75) and the third at (0, -2.6). Seen from the front (+z), the
 * apps' area is at the left, the websites' at the right and game development's behind the CPU.
 */
export const AREA_ANGLE: Readonly<Record<CategoryId, number>> = {
  app: Math.atan2(0.75, -2.55),
  website: Math.atan2(0.75, 2.55),
  game: -Math.PI / 2
};

/**
 * The board's centre: on the fall's axis, `BOARD.drop` below the light's height at the hand-over. The light there is a
 * few centimetres off the axis, by the screen's shape; the world is one place for every screen.
 */
export function boardCentre(): Vec3 {
  return [0, lightAt(HAND_F, 16 / 10).position[1] - BOARD.drop, 0];
}

/** A project's pad: where it stands on the board, and the level way out from the CPU through it. */
export interface PadPlace {
  id: ProjectId;
  pad: Vec3;
  out: Vec3;
}

export interface AreaPlace {
  category: CategoryId;
  /** The area's middle on the ring. */
  centre: Vec3;
  projects: PadPlace[];
}

const onRing = (c: Vec3, angle: number): Vec3 => [c[0] + Math.cos(angle) * AREA_RING, c[1], c[2] + Math.sin(angle) * AREA_RING];

/** Each area's place and its projects' pads: one project at the area's middle, more `BOARD.apart` apart along the ring. */
export function worldPlaces(areas: readonly AreaSpec[]): AreaPlace[] {
  const c = boardCentre();
  const step = BOARD.apart / AREA_RING;
  return areas.map(({ category, projects }) => {
    const middle = AREA_ANGLE[category];
    return {
      category,
      centre: onRing(c, middle),
      projects: projects.map((id, k) => {
        const angle = middle + (k - (projects.length - 1) / 2) * step;
        return { id, pad: onRing(c, angle), out: [Math.cos(angle), 0, Math.sin(angle)] };
      })
    };
  });
}

const DEG = Math.PI / 180;

/**
 * The quantum stack's sizes (spec 2026-10-28-bob-quantum-stack-design.md, the mock-up Bob approved,
 * .superpowers/holo-world-4-mockup/data.ts), m unless named: the power board's radius under the CPU; a category board's
 * radius, the hole the spine runs through, the drop from one board's top to the next, a board's thickness, the space
 * between two boards while the stack is closed; the ring a board's sockets stand on and how far apart along it; how high
 * a project floats over its socket and how big it stands against its own model; the way the first category board faces
 * and how much further round each next one turns (rad; Bob: "rotate a bit more").
 */
export const STACK = {
  core: 3.8,
  radius: 6.2,
  hole: 1.4,
  gap: 5.6,
  thick: 0.2,
  closed: 0.32,
  ring: 4.4,
  apart: 3.4,
  hover: 0.62,
  scale: 1.9,
  first: -40 * DEG,
  turn: 75 * DEG
} as const;

/** A project's socket on its board: where it stands, (x, z) from the spine, and the level way out through it. */
export interface SocketPlace {
  id: ProjectId;
  at: [number, number];
  out: Vec3;
}

/**
 * A board of the stack: index 0 the power board, with the CPU and no hole; then one per category on the way. `top` is
 * its top in world y with the stack open; `facing` the way round the stack its projects stand (rad, 0 toward +z, the
 * mock-up's (x, z) = (sin a, cos a) · r).
 */
export interface BoardPlace {
  index: number;
  category: CategoryId | null;
  top: number;
  radius: number;
  hole: number;
  facing: number;
  sockets: SocketPlace[];
}

/** The stack's boards: the power board at the board centre, then a board per area, `STACK.gap` below the one above. */
export function stackPlaces(areas: readonly AreaSpec[]): BoardPlace[] {
  const top = boardCentre()[1];
  const step = STACK.apart / STACK.ring;
  const power: BoardPlace = { index: 0, category: null, top, radius: STACK.core, hole: 0, facing: 0, sockets: [] };
  return [
    power,
    ...areas.map(({ category, projects }, k): BoardPlace => {
      const facing = STACK.first + k * STACK.turn;
      return {
        index: k + 1,
        category,
        top: top - (k + 1) * STACK.gap,
        radius: STACK.radius,
        hole: STACK.hole,
        facing,
        sockets: projects.map((id, i) => {
          const a = facing + (i - (projects.length - 1) / 2) * step;
          return { id, at: [Math.sin(a) * STACK.ring, Math.cos(a) * STACK.ring], out: [Math.sin(a), 0, Math.cos(a)] };
        })
      };
    })
  ];
}

/**
 * Each board's top as the stack opens, `open` 0 (closed: the boards a hand's width apart under the power board) to 1
 * (each at its place). The power board stays; the rest come down in a straight line, the easing being the caller's.
 */
export function boardTops(boards: readonly BoardPlace[], open: number): number[] {
  const top0 = boards[0]?.top ?? 0;
  return boards.map((b, k) => {
    const closed = top0 - k * (STACK.thick + STACK.closed);
    return closed + (b.top - closed) * open;
  });
}

/** The top of the CPU's lid above the power board, m: where the light comes to rest. */
export const LID_TOP = 0.2;

export type ObjectKind = 'streak' | 'portfolio' | 'solar' | 'crystal' | 'chip';

/** How high each kind of object's middle stands above its float, m: where its views look, and its click's sphere. */
export const OBJECT_MIDDLE: Readonly<Record<ObjectKind, number>> = { streak: 0.2, portfolio: 0.3, chip: 0.26, solar: 0.16, crystal: 0.38 };

const KINDS: Readonly<Partial<Record<string, ObjectKind>>> = {
  steady: 'streak',
  porfael: 'portfolio',
  'jontai-energy': 'solar',
  'cookies-clicker': 'crystal'
};

/**
 * Each project's object on its socket: Steady's streak path, Porfael's ring and relic, Jontai Energy's solar module,
 * Cookies Clicker's crystal; any other a plain chip.
 */
export function objectKind(id: ProjectId): ObjectKind {
  return KINDS[id] ?? 'chip';
}
