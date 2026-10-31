/**
 * The Q&A in the scene, a frame at a time (spec 2026-10-29-bob-stack-2-design.md, goal 1): the gold ring and the decor
 * stars posed from the path (./worldPath.ts `RingFrame`, `QaFrame`), the ring's slow drift on a clock of its own while the
 * Q&A shows (./qaRing.ts `ringDriftAt`; round 13, none with reduced motion) and its mark's flash as it lands on one, and
 * on the page the list of questions beside the tower, the one the ring stands at open, none on the way between two while
 * the gold light runs down the list to the next (round 13, Bob picked "C · The light"), and the end's words at the end's
 * mark (src/ui/qaWriters.ts; round 10, Bob picked "A · One list"), only what has changed. The Void builds it with the world and calls `pose` each
 * frame, `hide` when the world goes off the screen, `dispose` with the world.
 */
import * as THREE from 'three';
import type { DecorModel } from '~/engine/bob/build/decorStars';
import type { RingModel } from '~/engine/bob/build/ring';
import { clearQa, qaLightAnchors, qaLightY, type QaParts, qaWritten, writeQa, writeQaLight } from '~/ui/qaWriters';
import { ringDriftAt } from './qaRing';
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

/** The page's Q&A parts, as found in the document. */
interface Found {
  section: Element & { isConnected: boolean };
  parts: QaParts;
  frame: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } } | null;
  /** The questions' buttons, as laid out in the frame, and the light's places at them, measured once per screen. */
  asks: { offsetTop: number; offsetHeight: number }[];
  anchors: { key: string; at: number[] };
}

/** A frame's step is never taken as longer than this on the drift's clock, s: a tab back from the background does not lurch it. */
const MAX_DRIFT_STEP = 0.1;

/** A mark landed on this close to a whole place is on it. */
const ON_MARK = 1e-4;
/** An answer is the mark's within this much of it (./qaRing.ts `answerShown` is gone beyond 0.18). */
const NEAR_MARK = 0.18;

/** The Q&A's scene for the ring and the decor the Void built with the world. */
export function makeQaScene(ring: RingModel, decor: DecorModel): QaScene {
  const written = qaWritten();
  /** The landing: the mark the ring last came onto, when (the world's clock) and which way it was turning. */
  const landing = { mark: null as number | null, at: 0, way: 1, last: Number.NaN };
  /** The drift's own clock, s: it runs while the Q&A shows, and holds still with reduced motion. */
  let drifting = 0;
  let found: Found | null = null;
  let doc: Document | null = null;
  /** The words' frame's box on the screen, measured once per open question, end and screen. */
  const box = { key: '', x: 0, y: 0, w: 0, h: 0 };

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
    const items = [...section.querySelectorAll('.qa-item')];
    found = {
      section,
      frame,
      asks: items.map((item) => item.querySelector('.qa-ask') as unknown as Found['asks'][number]),
      anchors: { key: '', at: [] },
      parts: {
        root: d.documentElement,
        section: section as unknown as { inert: boolean },
        frame,
        items: items.map((item) => ({
          ask: item.querySelector('.qa-ask') as unknown as QaParts['items'][number]['ask'],
          reply: item.querySelector('.qa-reply') as unknown as QaParts['items'][number]['reply']
        })),
        end: section.querySelector('.qa-end') as unknown as QaParts['end']
      }
    };
    return found;
  };

  const hide = (): void => {
    ring.group.visible = false;
    decor.group.visible = false;
    const f = found;
    if (f) clearQa(f.parts, written);
    else if (doc) clearQa({ root: doc.documentElement, section: null, frame: null, items: [], end: null }, written);
    landing.mark = null;
    landing.last = Number.NaN;
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
      // The drift, in as the stack closes over the way in (`close`), on its own clock while the Q&A shows.
      if (path.part === 'qa' && !reduced) drifting += Math.min(Math.max(dt, 0), MAX_DRIFT_STEP);
      const drift = reduced ? { turn: 0, tip: 0 } : ringDriftAt(drifting);
      const settled = qa?.close ?? 0;
      ring.pose({
        centre: r.centre,
        scale: r.scale,
        turn: r.turn + drift.turn * settled,
        tip: drift.tip * settled,
        level: r.level,
        close: qa?.close ?? 0,
        place,
        lit: qa?.lit ?? 0,
        flash: landed ? { mark: landing.mark!, amount: Math.exp(-after * 5) } : null,
        clock
      });

      // The list beside the tower, the question the ring stands at open; the end's words at the end's mark.
      const inQa = path.part === 'qa';
      const mark = inQa && nearest >= 0 && Math.abs(place - nearest) < NEAR_MARK ? nearest : null;
      let keepOut: { x: number; y: number; w: number; h: number } | null = null;
      if (f) {
        const questions = f.parts.items.length;
        // The list comes in with the ring onto the first question and stays while it turns from one to another; it goes
        // as the ring turns on past the last to the end's mark, where the end's words show.
        const show = !inQa ? 0 : mark === questions || place < 0 ? (qa?.answer ?? 0) : Math.min(1, Math.max(0, questions - place));
        const between = inQa && place >= 0 && mark === null;
        writeQa(f.parts, { on: inQa, at: mark, answer: show, between }, written);
        // The light beside the list: at the question the ring stands at, on its way between two with the scroll (round 13).
        if (inQa && show > 0 && mark !== questions && f.asks.length === questions) {
          const key = `${size.width}x${size.height}`;
          if (f.anchors.key !== key) f.anchors = { key, at: qaLightAnchors(f.asks) };
          writeQaLight(f.parts, { y: qaLightY(f.anchors.at, place), way: between ? (landing.way > 0 ? 1 : -1) : 0 }, written);
        } else writeQaLight(f.parts, null, written);
        if (f.frame && show > 0) {
          const key = `${written.open}:${mark === questions}:${size.width}x${size.height}`;
          if (box.key !== key) {
            const rect = f.frame.getBoundingClientRect();
            Object.assign(box, { key, x: rect.left, y: rect.top, w: rect.width, h: rect.height });
          }
          keepOut = { x: box.x, y: box.y, w: box.w, h: box.h };
        }
      }
      decor.pose({ level: qa?.close ?? 0, clock, dt, camera, keepOut, size });
      return { place, close: qa?.close ?? 0, lit: qa?.lit ?? 0, at: mark };
    },
    dispose() {
      hide();
      ring.dispose();
      decor.dispose();
    }
  };
}
