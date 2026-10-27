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
 * Funcial at (-2.55, 0.75), Jontai Energy at (2.55, 0.75) and Cookies Clicker at (0, -2.6). Seen from the front (+z),
 * the secure element's area is at the left, the front panel's at the right and the oscillator's behind the CPU.
 */
export const AREA_ANGLE: Readonly<Record<CategoryId, number>> = {
  'secure-element': Math.atan2(0.75, -2.55),
  'front-panel': Math.atan2(0.75, 2.55),
  oscillator: -Math.PI / 2
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

export type ObjectKind = 'lock-chip' | 'solar' | 'crystal' | 'chip';

const KINDS: Readonly<Partial<Record<string, ObjectKind>>> = { funcial: 'lock-chip', 'jontai-energy': 'solar', 'cookies-clicker': 'crystal' };

/** Each project's object on its pad: Funcial's chip with a lock, Jontai Energy's solar module, Cookies Clicker's crystal; any other a plain chip. */
export function objectKind(id: ProjectId): ObjectKind {
  return KINDS[id] ?? 'chip';
}
