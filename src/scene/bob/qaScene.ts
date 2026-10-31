/**
 * The Q&A in the stars, a frame at a time (round 14, the way out; spec 2026-10-31-bob-way-out-design.md): from the path's
 * place in the Q&A and the way out's stage there (./wayOut.ts), on the page the list of questions (round 10, Bob picked
 * "A · One list"), the one it stands at open, none on the way between two while the gold light runs down the list to the
 * next (round 13, Bob picked "C · The light"); the list coming in late in the blueprint and drifting toward the camera as
 * the flight sets off, the end's words from the flight's 2.8 s (src/ui/qaWriters.ts), only what has changed. The Void
 * makes it with the world and calls `pose` each frame, `hide` when the world goes off the screen, `dispose` with the world.
 */
import { clearQa, qaLightAnchors, qaLightY, type QaParts, qaWritten, writeQa, writeQaLight } from '~/ui/qaWriters';
import type { WayOutStretch } from './wayOut';
import type { WorldFrame } from './worldPath';

/** What the Q&A is posed by, each frame. */
export interface QaScenePose {
  /** The world's path at this frame; null off it. */
  path: WorldFrame | null;
  /** Whether the Q&A may show: the world on the home page, no project close. */
  on: boolean;
  /** The world's clock, s. */
  clock: number;
  reduced: boolean;
  /** The screen, CSS px. */
  size: { width: number; height: number };
  /** The page (null where there is none). */
  doc: Document | null;
}

/** Where the Q&A stands this frame, for the debug bridge (`frame.journey.qa`). */
export interface QaJourney {
  place: number;
  stretch: WayOutStretch;
  /** The way out's clock in the blueprint or the flight, s. */
  s: number;
  /** The mark whose question is open, or the end's once its words are on; null between and on the way. */
  at: number | null;
}

export interface QaScene {
  /** Poses the Q&A for this frame; answers where it stands, or null where it does not show. */
  pose(p: QaScenePose): QaJourney | null;
  /** The list's light on the screen, CSS px, where it last rested at a question; null before it has. */
  lightOnScreen(): { x: number; y: number } | null;
  /** Clears the page of all the writer wrote. */
  hide(): void;
  dispose(): void;
}

/** The page's Q&A parts, as found in the document. */
interface Found {
  section: Element & { isConnected: boolean };
  parts: QaParts;
  frame: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } } | null;
  rail: { getBoundingClientRect(): { left: number; width: number } } | null;
  /** The questions' buttons, as laid out in the frame, and the light's places at them, measured once per screen. */
  asks: { offsetTop: number; offsetHeight: number }[];
  anchors: { key: string; at: number[] };
}

/** A question is the one it stands at within this much of its mark. */
const NEAR_MARK = 0.18;

/** The Q&A's scene: the page's list, written from the path. */
export function makeQaScene(): QaScene {
  const written = qaWritten();
  /** The way the light last ran (1 down, -1 up) and the place it was at. */
  const going = { way: 1, last: Number.NaN };
  let found: Found | null = null;
  let doc: Document | null = null;
  /** The list's frame and its light's line on the screen, measured once per open question, end and screen. */
  const box = { key: '', x: 0, y: 0, w: 0, h: 0, rail: Number.NaN };
  let light: { x: number; y: number } | null = null;

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
      rail: section.querySelector('.qa-rail') as unknown as Found['rail'],
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
    const f = found;
    if (f) clearQa(f.parts, written);
    else if (doc) clearQa({ root: doc.documentElement, section: null, frame: null, items: [], end: null }, written);
    going.last = Number.NaN;
  };

  return {
    hide,
    lightOnScreen: () => light,
    pose({ path, on, size, doc: d }) {
      const qa = path?.qa;
      const f = find(d);
      if (!on || !qa) {
        hide();
        return null;
      }
      const { place, out } = qa;
      if (Number.isFinite(going.last) && place !== going.last) going.way = Math.sign(place - going.last) || going.way;
      going.last = place;
      const nearest = Math.round(place);
      const resting = out.stretch === 'qa' && Math.abs(place - nearest) < NEAR_MARK;
      const showing = place > -1;
      if (f) {
        const questions = f.parts.items.length;
        const at = out.endOn ? questions : resting ? nearest : null;
        const between = out.stretch === 'qa' && !resting;
        writeQa(f.parts, { on: showing, at, answer: out.panel, between, past: out.past }, written);
        // The light beside the list: at the first question as the list comes in, then at the one it stands at and on its
        // way between two with the scroll (round 13); the flight takes it off the list (the sky draws it, src/ui/outSky.ts).
        const listed = showing && (out.stretch === 'blueprint' || out.stretch === 'qa') && f.asks.length === questions;
        const key = `${size.width}x${size.height}`;
        if (listed) {
          if (f.anchors.key !== key) f.anchors = { key, at: qaLightAnchors(f.asks) };
          writeQaLight(f.parts, { y: qaLightY(f.anchors.at, place), way: between ? (going.way > 0 ? 1 : -1) : 0 }, written);
        } else writeQaLight(f.parts, null, written);
        if (f.frame && showing && out.panel > 0) {
          const boxKey = `${written.open}:${at === questions}:${key}`;
          if (box.key !== boxKey) {
            const rect = f.frame.getBoundingClientRect();
            const rail = f.rail?.getBoundingClientRect();
            Object.assign(box, { key: boxKey, x: rect.left, y: rect.top, w: rect.width, h: rect.height, rail: rail ? rail.left + rail.width / 2 : Number.NaN });
          }
          if (resting && listed && Number.isFinite(box.rail)) light = { x: box.rail, y: box.y + qaLightY(f.anchors.at, nearest) };
        }
        return { place, stretch: out.stretch, s: out.s, at };
      }
      return { place, stretch: out.stretch, s: out.s, at: null };
    },
    dispose() {
      hide();
    }
  };
}
