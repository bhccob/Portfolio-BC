/**
 * The Q&A a frame at a time (round 15, spec 2026-11-01-bob-dissolve-digitize-design.md; Bob's mix: "dissolve for the
 * tower and digitize for stuur een bericht make everything smooth and blend well together"): from the path's place in
 * the Q&A and the way out's stage there (./wayOut.ts), on the page the column of plain words moved so the question at the
 * place stands on the reading line, the band behind it and the end's words, only what has changed (src/ui/qaWriters.ts);
 * and past question 6 the LED screen (src/ui/ledSky.ts), drawn from the frame grabbed after the render
 * (../frameGrab.ts). The Void makes it with the world and calls `pose` each frame, `hide` when the world goes off the
 * screen, `dispose` with the world.
 */
import { RING_QUESTIONS } from '~/data/qa';
import type { QualityTier } from '~/engine/quality';
import { type LedSky, makeLedSky } from '~/ui/ledSky';
import { clearQa, type QaParts, qaNearest, qaOffset, qaReadingLine, qaWritten, writeQa } from '~/ui/qaWriters';
import { requestGrab } from '../frameGrab';
import { type WayOutStretch, wayOutAt } from './wayOut';
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
  tier: QualityTier;
  /** The screen, CSS px. */
  size: { width: number; height: number };
  /** The page (null where there is none). */
  doc: Document | null;
  /** The core's light on the screen, CSS px (the LEDs' ripple runs out from it); null unseen. */
  core: { x: number; y: number } | null;
}

/** Where the Q&A stands this frame, for the debug bridge (`frame.journey.qa`). */
export interface QaJourney {
  place: number;
  stretch: WayOutStretch;
  /** The dissolve's clock, s. */
  g: number;
  /** The question on the reading line, or the end's mark once its words are on; null between and on the way. */
  at: number | null;
  /** The laser line's place down the screen, 0..1. */
  line: number;
}

export interface QaScene {
  /** Poses the Q&A for this frame; answers where it stands, or null where it does not show. */
  pose(p: QaScenePose): QaJourney | null;
  /** Clears the page of all the writer wrote, and the LEDs. */
  hide(): void;
  dispose(): void;
}

/** A block's words as laid out down the track: its question's top, its answer's top and height, px. */
interface Block {
  question: { offsetTop: number } | null;
  text: { offsetTop: number; offsetHeight: number } | null;
}

/** The page's Q&A parts, as found in the document, and the words' middles measured once per screen. */
interface Found {
  section: Element & { isConnected: boolean };
  parts: QaParts;
  blocks: Block[];
  leds: LedSky | null;
  key: string;
  centres: number[];
}

/** The Q&A's scene: the page's words and the LEDs, written from the path. */
export function makeQaScene(): QaScene {
  const written = qaWritten();
  let found: Found | null = null;
  let doc: Document | null = null;

  const find = (d: Document | null): Found | null => {
    if (d === null) return null;
    if (found && doc === d && found.section.isConnected) return found;
    doc = d;
    const section = d.getElementById('qa');
    if (!section) {
      found = null;
      return null;
    }
    const canvas = section.querySelector('.qa-leds') as HTMLCanvasElement | null;
    found = {
      section,
      parts: {
        root: d.documentElement,
        section: section as unknown as QaParts['section'],
        track: section.querySelector('.qa-track') as unknown as QaParts['track'],
        end: section.querySelector('.qa-end') as unknown as QaParts['end']
      },
      blocks: [...section.querySelectorAll('.qa-block')].map((b) => ({
        question: b.querySelector('.qa-question') as unknown as Block['question'],
        text: b.querySelector('.qa-text') as unknown as Block['text']
      })),
      leds: canvas && typeof canvas.getContext === 'function' ? makeLedSky(canvas) : null,
      key: '',
      centres: []
    };
    return found;
  };

  /** The words' middles down the track, measured once per screen size (and again after the Q&A was hidden). */
  const measure = (f: Found, size: { width: number; height: number }): void => {
    const key = `${size.width}x${size.height}`;
    if (f.key === key && f.centres.length > 0) return;
    f.key = key;
    f.centres = f.blocks.map(({ question, text }) => (question && text ? (question.offsetTop + text.offsetTop + text.offsetHeight) / 2 : 0));
  };

  const hide = (): void => {
    const f = found;
    if (f) {
      clearQa(f.parts, written);
      f.leds?.clear();
      f.key = '';
    } else if (doc) clearQa({ root: doc.documentElement, section: null, track: null, end: null }, written);
  };

  return {
    hide,
    pose({ path, on, reduced, size, doc: d, core }) {
      const qa = path?.qa;
      const f = find(d);
      if (!on || !qa) {
        hide();
        return null;
      }
      // With reduced motion the LEDs and the end come at once (the scroll never rests between two places there).
      const out = reduced ? wayOutAt(qa.place, true) : qa.out;
      const showing = qa.place > -1;
      const questions = f ? f.blocks.length : RING_QUESTIONS;
      const at = !showing ? null : out.endOn ? questions : out.column > 0 ? qaNearest(qa.place, questions) : null;
      if (f) {
        if (showing) measure(f, size);
        const offset = qaOffset(f.centres, Math.max(qa.place, 0), qaReadingLine(size));
        writeQa(f.parts, { on: showing, column: out.column, band: out.band, offset, at, endOn: out.endOn }, written);
        const leds = f.leds;
        if (leds) {
          if (showing) leds.prepare();
          if (showing && out.line > 0) requestGrab((source) => leds.draw({ source, line: out.line, end: out.end, size, core }));
          else leds.clear();
        }
      }
      return { place: qa.place, stretch: out.stretch, g: out.g, at: f ? at : null, line: out.line };
    },
    dispose() {
      hide();
    }
  };
}
