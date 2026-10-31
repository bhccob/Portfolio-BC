/**
 * The Q&A in the stars, a frame at a time (round 14, the way out; spec 2026-10-31-bob-way-out-design.md): from the path's
 * place in the Q&A and the way out's stage there (./wayOut.ts), on the page the list of questions (round 10, Bob picked
 * "A · One list"), the one it stands at open, none on the way between two while the gold light runs down the list to the
 * next (round 13, Bob picked "C · The light"); the list coming in late in the blueprint and drifting toward the camera as
 * the flight sets off, the end's words from the flight's 2.8 s (src/ui/qaWriters.ts), only what has changed; and the sky
 * under it all (src/ui/outSky.ts), the frame grabbed for the blueprint's drawing (../frameGrab.ts) and the panel measured
 * for its sparks. The Void makes it with the world and calls `pose` each frame, `hide` when the world goes off the screen,
 * `dispose` with the world.
 */
import type { QualityTier } from '~/engine/quality';
import { makeOutSky, type OutSky, type SparkBoxes, sparkTargets } from '~/ui/outSky';
import { clearQa, qaLightAnchors, qaLightY, type QaParts, qaWritten, writeQa, writeQaLight } from '~/ui/qaWriters';
import { requestGrab } from '../frameGrab';
import type { WayOutStretch } from './wayOut';
import type { WorldFrame } from './worldPath';

/** What the Q&A is posed by, each frame. */
export interface QaScenePose {
  /** The world's path at this frame; null off it. */
  path: WorldFrame | null;
  /** Whether the Q&A may show: the world on the home page, no project close. */
  on: boolean;
  /** The world's clock, s: the stars' twinkle, still with reduced motion. */
  clock: number;
  reduced: boolean;
  tier: QualityTier;
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
  /** Each question's button and reply as elements, for the sparks' places; the sky, where the page has its canvas. */
  elements: { ask: Element; reply: Element }[];
  sky: OutSky | null;
}

/** A question is the one it stands at within this much of its mark. */
const NEAR_MARK = 0.18;
/** The panel's sparks have their places measured from here in the blueprint, s: the first answer long open, before they fly. */
const MEASURE_AT = 2.6;
/** The panel's dark round the list (src/styles/base.css `.qa-frame::before`), each way, px: a laptop's and a phone's. */
const PANEL_INSET = { desk: { x: 36, y: 30 }, phone: { x: 12, y: 16 } } as const;

/** The panel's parts on the screen for its sparks (src/ui/outSky.ts `sparkTargets`), the question `open` open; null unmeasurable. */
function measurePanel(f: Found, open: number | null, size: { width: number }): SparkBoxes | null {
  if (!f.frame) return null;
  const frame = f.frame.getBoundingClientRect();
  const inset = size.width <= 700 ? PANEL_INSET.phone : PANEL_INSET.desk;
  const questions = f.elements.map(({ ask }) => {
    const r = ask.getBoundingClientRect();
    const range = ask.ownerDocument.createRange();
    range.selectNodeContents(ask);
    const text = range.getBoundingClientRect().width;
    return { x: r.left, y: r.top, w: r.width, h: r.height, text: Math.min(text > 0 ? text : r.width * 0.6, r.width) };
  });
  const reply = open === null ? null : f.elements[open]?.reply.getBoundingClientRect();
  return {
    box: { x: frame.left - inset.x, y: frame.top - inset.y, w: frame.width + 2 * inset.x, h: frame.height + 2 * inset.y },
    questions,
    answer: reply && reply.height > 0 ? { x: reply.left, y: reply.top, w: reply.width, h: reply.height } : null
  };
}

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
    const canvas = section.querySelector('.qa-sky') as HTMLCanvasElement | null;
    found = {
      section,
      frame,
      rail: section.querySelector('.qa-rail') as unknown as Found['rail'],
      asks: items.map((item) => item.querySelector('.qa-ask') as unknown as Found['asks'][number]),
      anchors: { key: '', at: [] },
      elements: items.map((item) => ({ ask: item.querySelector('.qa-ask')!, reply: item.querySelector('.qa-reply')! })),
      sky: canvas && typeof canvas.getContext === 'function' ? makeOutSky(canvas) : null,
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
    if (f) {
      clearQa(f.parts, written);
      f.sky?.clear();
    } else if (doc) clearQa({ root: doc.documentElement, section: null, frame: null, items: [], end: null }, written);
    going.last = Number.NaN;
  };

  return {
    hide,
    lightOnScreen: () => light,
    pose({ path, on, clock, reduced, tier, size, doc: d }) {
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
        // The sky: the floor's drawing grabbed as the blueprint needs it (the scene still holds the floor under the dark),
        // the panel measured for its sparks before they fly, and the whole drawn from the way out's stage.
        const sky = f.sky;
        if (sky && showing) {
          if (out.stretch === 'blueprint' && !sky.hasEdges(size)) requestGrab((source, w, h) => sky.takeGrab(source, w, h, size));
          const panelKey = `${key}:${written.open}`;
          if (out.stretch === 'blueprint' && out.s >= MEASURE_AT && !sky.hasTargets(panelKey)) {
            const boxes = measurePanel(f, written.open, size);
            if (boxes) sky.setTargets(panelKey, sparkTargets(boxes));
          }
          sky.draw({ out, marks: questions + 1, clock: reduced ? 0 : clock, size, tier, light });
        } else sky?.clear();
        return { place, stretch: out.stretch, s: out.s, at };
      }
      return { place, stretch: out.stretch, s: out.s, at: null };
    },
    dispose() {
      hide();
    }
  };
}
