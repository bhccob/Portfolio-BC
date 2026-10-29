/**
 * The Q&A in the scene, a frame at a time (spec 2026-10-29-bob-stack-2-design.md, goal 1): the gold ring and the decor
 * stars posed from the path (./worldPath.ts `RingFrame`, `QaFrame`), the ring's small click and its mark's flash as it
 * lands on a mark (./qaRing.ts `clickAt`, on the world's clock, none with reduced motion), and on the page the answer at
 * its mark and each mark's button over its mark (src/ui/qaWriters.ts), only what has changed. The Void builds it with
 * the world and calls `pose` each frame, `hide` when the world goes off the screen, `dispose` with the world.
 */
import * as THREE from 'three';
import type { DecorModel } from '~/engine/bob/build/decorStars';
import type { RingModel } from '~/engine/bob/build/ring';
import { answerPlace, clearQa, placeMarks, type QaParts, qaWritten, writeQa } from '~/ui/qaWriters';
import { clickAt } from './qaRing';
import type { WorldFrame } from './worldPath';

/** What the Q&A is posed by, each frame. */
export interface QaScenePose {
  /** The world's path at this frame; null off it. */
  path: WorldFrame | null;
  /** Whether the Q&A may show: the world on the home page, no project close. */
  on: boolean;
  /** The world's clock, s; and the frame's step, s. */
  clock: number;
  dt: number;
  reduced: boolean;
  camera: THREE.Camera;
  /** The screen, CSS px. */
  size: { width: number; height: number };
  /** The page (null where there is none). */
  doc: Document | null;
}

/** Where the Q&A stands this frame, for the debug bridge (`frame.journey.qa`). */
export interface QaJourney {
  place: number;
  close: number;
  lit: number;
  /** The mark whose answer shows; null between marks and at the look back. */
  at: number | null;
}

export interface QaScene {
  ring: RingModel;
  decor: DecorModel;
  /** Poses the Q&A for this frame; answers where it stands, or null where it does not show. */
  pose(p: QaScenePose): QaJourney | null;
  /** Hides the ring and the stars and clears the page of all the writer wrote. */
  hide(): void;
  dispose(): void;
}

/** The page's ring parts and its marks' buttons, as found in the document. */
interface Found {
  section: Element & { isConnected: boolean };
  parts: QaParts;
  buttons: { hidden: boolean; style: { setProperty(name: string, value: string): void } }[];
  frame: { getBoundingClientRect(): { width: number; height: number } } | null;
}

/** A mark landed on this close to a whole place is on it. */
const ON_MARK = 1e-4;
/** An answer is the mark's within this much of it (./qaRing.ts `answerShown` is gone beyond 0.18). */
const NEAR_MARK = 0.18;

/** The Q&A's scene for the ring and the decor the Void built with the world. */
export function makeQaScene(ring: RingModel, decor: DecorModel): QaScene {
  const written = qaWritten();
  /** The landing: the mark the ring last came onto, when (the world's clock) and which way it was turning. */
  const landing = { mark: null as number | null, at: 0, way: 1, last: Number.NaN };
  let found: Found | null = null;
  let doc: Document | null = null;
  /** The answers' frame's size, measured once per mark and screen. */
  const box = { key: '', w: 0, h: 0 };
  const at = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const middle = new THREE.Vector3();

  const find = (d: Document | null): Found | null => {
    if (d === null) return null;
    if (found && doc === d && found.section.isConnected) return found;
    doc = d;
    const section = d.getElementById('qa');
    if (!section) {
      found = null;
      return null;
    }
    const frame = section.querySelector('.qa-frame') as unknown as Found['frame'] & QaParts['frame'];
    found = {
      section,
      frame,
      parts: {
        root: d.documentElement,
        section: section as unknown as { inert: boolean },
        frame,
        answers: [...section.querySelectorAll('.qa-answer')] as unknown as { hidden: boolean }[]
      },
      buttons: [...section.querySelectorAll('.qa-mark')] as unknown as Found['buttons']
    };
    return found;
  };

  const hide = (): void => {
    ring.group.visible = false;
    decor.group.visible = false;
    const f = found;
    if (f) {
      clearQa(f.parts, written);
      placeMarks(f.buttons, []);
    } else if (doc) {
      clearQa({ root: doc.documentElement, section: null, frame: null, answers: [] }, written);
    }
    landing.mark = null;
    landing.last = Number.NaN;
  };

  /** Where a world point is on the screen, CSS px, and whether it is in front of the camera. */
  const screen = (point: THREE.Vector3, camera: THREE.Camera, size: { width: number; height: number }): { x: number; y: number; front: boolean } => {
    const p = point.clone().project(camera);
    return { x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height, front: p.z < 1 && p.z > -1 };
  };

  return {
    ring,
    decor,
    hide,
    pose({ path, on, clock, dt, reduced, camera, size, doc: d }) {
      const r = path?.ring;
      const f = find(d);
      if (!on || !path || !r || r.level <= 0) {
        hide();
        return null;
      }
      const qa = path.qa;
      const place = qa?.place ?? -1;
      // The landing: which way the ring turns, and the mark it comes onto, when.
      if (Number.isFinite(landing.last) && place !== landing.last) landing.way = Math.sign(place - landing.last) || landing.way;
      landing.last = place;
      const nearest = Math.round(place);
      const onMark = qa !== null && nearest >= 0 && Math.abs(place - nearest) < ON_MARK;
      if (!onMark) landing.mark = null;
      else if (landing.mark !== nearest) {
        landing.mark = nearest;
        landing.at = clock;
      }
      const after = clock - landing.at;
      const landed = !reduced && landing.mark !== null;
      // The turn goes with -place (./qaRing.ts `ringTurnFor`): a little past the mark is a little further that way.
      const click = landed ? -landing.way * clickAt(after) : 0;
      ring.pose({
        centre: r.centre,
        scale: r.scale,
        turn: r.turn + click,
        level: r.level,
        close: qa?.close ?? 0,
        place,
        lit: qa?.lit ?? 0,
        flash: landed ? { mark: landing.mark!, amount: Math.exp(-after * 5) } : null,
        clock
      });

      // The answer at its mark, and each mark's button where the ring has it, on the page.
      const inQa = path.part === 'qa';
      const mark = inQa && nearest >= 0 && Math.abs(place - nearest) < NEAR_MARK ? nearest : null;
      let placed: { x: number; y: number } | null = null;
      if (f && mark !== null) {
        const key = `${mark}:${size.width}x${size.height}`;
        if (box.key !== key && f.frame) {
          // Its answer shown first, so the frame measures it (hidden, the frame is no height at all).
          writeQa(f.parts, { on: inQa, at: mark, answer: qa?.answer ?? 0, place: null }, written);
          const rect = f.frame.getBoundingClientRect();
          box.key = key;
          box.w = rect.width;
          box.h = rect.height;
        }
        const anchor = screen(ring.markAt(mark, at), camera, size);
        placed = answerPlace(anchor, box, size);
      }
      if (f) {
        writeQa(f.parts, { on: inQa, at: mark, answer: qa?.answer ?? 0, place: placed }, written);
        middle.set(r.centre[0], r.centre[1], r.centre[2]);
        toCamera.copy(camera.position).sub(middle);
        placeMarks(
          f.buttons,
          inQa
            ? f.buttons.map((_, k) => {
                ring.markAt(k, at);
                const s = screen(at, camera, size);
                return { ...s, front: s.front && at.clone().sub(middle).dot(toCamera) > 0 };
              })
            : []
        );
      }
      decor.pose({
        level: qa?.close ?? 0,
        clock,
        dt,
        camera,
        keepOut: placed && mark !== null ? { x: placed.x, y: placed.y, w: box.w, h: box.h } : null,
        size
      });
      return { place, close: qa?.close ?? 0, lit: qa?.lit ?? 0, at: mark };
    },
    dispose() {
      hide();
      ring.dispose();
      decor.dispose();
    }
  };
}
