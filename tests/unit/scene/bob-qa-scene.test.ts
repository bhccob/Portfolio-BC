import { describe, expect, it } from 'vitest';
import { RING_QUESTIONS } from '~/data/qa';
import { easeInOutQuart } from '~/input/scrollLoop';
import { grabWanted } from '~/scene/frameGrab';
import { makeQaScene, type QaScenePose } from '~/scene/bob/qaScene';
import { WAY_OUT } from '~/scene/bob/wayOut';
import { worldPathFor } from '~/scene/bob/worldPath';
import { HOME_CHAPTERS, pathStart, qaDoor, qaStop } from '~/state/chapters';

/**
 * A fake of the page: <html>, the Q&A's section with its frame, its list's questions (each its button and reply), the
 * light's line, the end. Each question's button stands 56 px tall, the first 1 px down the frame (under its rule), as the
 * list stands closed; the frame stands at 900, 160 on the screen, the line 6 px into it.
 */
function fakePage({ sky = false }: { sky?: boolean } = {}) {
  const attributes = new Map<string, string>();
  const vars = new Map<string, string>();
  const style = { setProperty: (n: string, v: string) => vars.set(n, v), removeProperty: (n: string) => vars.delete(n) };
  const expanded = Array.from({ length: RING_QUESTIONS }, () => 'false');
  const replies = expanded.map(() => ({ hidden: true }));
  const items = expanded.map((_, k) => ({
    querySelector: (sel: string) =>
      sel === '.qa-ask'
        ? { setAttribute: (n: string, v: string) => n === 'aria-expanded' && (expanded[k] = v), offsetTop: 1 + 57 * k, offsetHeight: 56 }
        : sel === '.qa-reply'
          ? replies[k]
          : null
  }));
  const end = { hidden: true };
  let measured = 0;
  const frame = { style, getBoundingClientRect: () => (measured++, { left: 900, top: 160, width: 440, height: 520 }) };
  const rail = { getBoundingClientRect: () => ({ left: 906, top: 168, width: 1, height: 400 }) };
  // The sky's canvas, with no 2D context here: the sky draws nothing, but asks for what it needs.
  const canvas = sky ? { width: 0, height: 0, getContext: () => null } : null;
  const section = {
    isConnected: true,
    inert: true,
    querySelector: (sel: string) =>
      sel === '.qa-frame' ? frame : sel === '.qa-end' ? end : sel === '.qa-rail' ? rail : sel === '.qa-sky' ? canvas : null,
    querySelectorAll: (sel: string) => (sel === '.qa-item' ? items : [])
  };
  const doc = {
    documentElement: { setAttribute: (n: string, v: string) => attributes.set(n, v), removeAttribute: (n: string) => attributes.delete(n) },
    getElementById: (id: string) => (id === 'qa' ? section : null)
  };
  const open = (): number[] => expanded.flatMap((v, k) => (v === 'true' ? [k] : []));
  return { doc: doc as unknown as Document, attributes, vars, replies, end, section, open, measures: () => measured };
}

/** The Q&A's scene as the Void poses it at place `p` on the home's story, on a screen of `size`. */
function poseAt(q: ReturnType<typeof makeQaScene>, p: number, size: { width: number; height: number }, page: ReturnType<typeof fakePage>, over: Partial<QaScenePose> = {}) {
  const path = worldPathFor(size.width / size.height).frameAt(p - pathStart(HOME_CHAPTERS));
  return q.pose({ path, on: true, clock: 0, reduced: false, tier: 'high', size, doc: page.doc, ...over });
}

const DESK = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const DOOR = qaDoor(HOME_CHAPTERS);
const at = (k: number): number => qaStop(HOME_CHAPTERS, k);
/** The place the way in's turn has reached `s` seconds in, and the flight's. */
const blueprint = (s: number): number => DOOR + easeInOutQuart(s / WAY_OUT.blueprint) * (at(0) - DOOR);
const flight = (s: number): number => at(RING_QUESTIONS - 1) + easeInOutQuart(s / WAY_OUT.flight) * (at(RING_QUESTIONS) - at(RING_QUESTIONS - 1));

// The Q&A in the stars (round 14, the way out; round 10's one list, round 13's light): the list's open question, how much
// it shows and the light down its line written on the page, the end's words at the end.
describe("the Q&A's scene", () => {
  it('writes nothing at the door, the last floor: the Q&A is not on yet', () => {
    const page = fakePage();
    const q = makeQaScene();
    const seen = poseAt(q, DOOR, DESK, page);
    expect(seen).toMatchObject({ place: -1, stretch: 'floor', at: null });
    expect(page.attributes.size).toBe(0);
    expect(page.section.inert).toBe(true);
    expect(poseAt(q, DOOR - 0.3, DESK, page)).toBeNull();
    q.dispose();
  });

  it('opens the first question as the blueprint begins, and brings the list in from 4.9 s, whole by 5.7 s', () => {
    const page = fakePage();
    const q = makeQaScene();
    expect(poseAt(q, blueprint(1), DESK, page)).toMatchObject({ stretch: 'blueprint' });
    expect(page.attributes.get('data-qa')).toBe('');
    expect(page.open()).toEqual([0]);
    expect(page.vars.get('--qa-show')).toBe('0');
    poseAt(q, blueprint(4.8), DESK, page);
    expect(page.vars.get('--qa-show')).toBe('0');
    poseAt(q, blueprint(5.3), DESK, page);
    expect(Number(page.vars.get('--qa-show'))).toBeCloseTo(0.5, 2);
    poseAt(q, blueprint(5.7), DESK, page);
    expect(Number(page.vars.get('--qa-show'))).toBeCloseTo(1, 2);
    // The light waits at the first question while the list comes in.
    expect(Number.parseFloat(page.vars.get('--qa-light')!)).toBeCloseTo(29, 1);
    q.dispose();
  });

  it('opens the question it stands at in the list, and shows the list whole', () => {
    const page = fakePage();
    const q = makeQaScene();
    expect(poseAt(q, at(2), DESK, page)).toMatchObject({ place: 2, stretch: 'qa', at: 2 });
    expect(page.attributes.get('data-qa-at')).toBe('2');
    expect(page.open()).toEqual([2]);
    expect(page.replies.map((r) => r.hidden)).toEqual([true, true, false, true, true, true]);
    expect(page.end.hidden).toBe(true);
    expect(page.vars.get('--qa-show')).toBe('1');
    expect(page.vars.has('--qa-past')).toBe(false);
    q.dispose();
  });

  // Round 13 (Bob picked "C · The light"): between two questions the list stands closed, the gold light on its way down
  // it; the next opens as the light arrives.
  it('closes the list while the light runs to the next question, and opens that one as it arrives', () => {
    const page = fakePage();
    const q = makeQaScene();
    poseAt(q, at(1), DESK, page);
    expect(page.open()).toEqual([1]);
    poseAt(q, (at(1) + at(2)) / 2, DESK, page);
    expect(page.vars.get('--qa-show')).toBe('1');
    expect(page.open()).toEqual([]);
    expect(page.replies.every((r) => r.hidden)).toBe(true);
    poseAt(q, at(2) - 0.05 * (at(2) - at(1)), DESK, page);
    expect(page.open()).toEqual([2]);
    q.dispose();
  });

  it('runs the light down the list with the scroll, question to question, and says which way it goes', () => {
    const page = fakePage();
    const q = makeQaScene();
    const y = (): number => Number.parseFloat(page.vars.get('--qa-light')!);
    // Each question's middle with the list closed: the first's 1 + 28 px down the frame, then 57 px a question.
    poseAt(q, at(1), DESK, page);
    expect(y()).toBeCloseTo(29 + 57, 1);
    expect(page.attributes.has('data-qa-moving')).toBe(false);
    poseAt(q, at(1) + 0.25 * (at(2) - at(1)), DESK, page);
    expect(y()).toBeCloseTo(29 + 57 * 1.25, 1);
    expect(page.attributes.get('data-qa-moving')).toBe('down');
    poseAt(q, at(1) + 0.6 * (at(2) - at(1)), DESK, page);
    poseAt(q, at(1) + 0.4 * (at(2) - at(1)), DESK, page);
    expect(page.attributes.get('data-qa-moving')).toBe('up');
    poseAt(q, at(4), DESK, page);
    expect(y()).toBeCloseTo(29 + 57 * 4, 1);
    expect(page.attributes.has('data-qa-moving')).toBe(false);
    q.dispose();
  });

  it('lets the list drift away as the flight sets off, its light taken off it, and shows the end from 2.8 s', () => {
    const page = fakePage();
    const q = makeQaScene();
    poseAt(q, at(RING_QUESTIONS - 1), DESK, page);
    const going = poseAt(q, flight(0.5), DESK, page);
    expect(going).toMatchObject({ stretch: 'flight' });
    expect(Number(page.vars.get('--qa-past'))).toBeGreaterThan(0.2);
    expect(Number(page.vars.get('--qa-show'))).toBeLessThan(0.6);
    expect(page.vars.has('--qa-light')).toBe(false);
    expect(page.attributes.has('data-qa-end')).toBe(false);
    expect(page.open()).toEqual([RING_QUESTIONS - 1]);
    poseAt(q, flight(2.9), DESK, page);
    expect(page.attributes.has('data-qa-end')).toBe(true);
    expect(page.end.hidden).toBe(false);
    expect(poseAt(q, at(RING_QUESTIONS), DESK, page)).toMatchObject({ stretch: 'end', at: RING_QUESTIONS });
    expect(page.vars.get('--qa-past')).toBe('1');
    // Back up from the end: the last question again, the list where it stood.
    poseAt(q, at(RING_QUESTIONS - 1), DESK, page);
    expect([page.attributes.has('data-qa-end'), page.vars.has('--qa-past'), page.vars.get('--qa-show')]).toEqual([false, false, '1']);
    q.dispose();
  });

  it('says where the list\'s light stands on the screen, for the flight to take it from', () => {
    const page = fakePage();
    const q = makeQaScene();
    poseAt(q, at(RING_QUESTIONS - 1), DESK, page);
    // The line's middle, and the last question's middle down the frame.
    expect(q.lightOnScreen()).toEqual({ x: 906.5, y: 160 + 29 + 57 * (RING_QUESTIONS - 1) });
    q.dispose();
  });

  it('asks for the frame on the screen as the blueprint begins, for the drawing of the last floor, and not before or after', () => {
    const page = fakePage({ sky: true });
    const q = makeQaScene();
    poseAt(q, DOOR, DESK, page);
    expect(grabWanted()).toBe(false);
    poseAt(q, at(2), DESK, page);
    expect(grabWanted()).toBe(false);
    poseAt(q, blueprint(0.3), DESK, page);
    expect(grabWanted()).toBe(true);
    q.dispose();
  });

  it('measures the words once per open question and screen', () => {
    const page = fakePage();
    const q = makeQaScene();
    poseAt(q, at(1), DESK, page);
    poseAt(q, at(1), DESK, page);
    expect(page.measures()).toBe(1);
    poseAt(q, at(1), PHONE, page);
    expect(page.measures()).toBe(2);
    q.dispose();
  });

  it("clears the Q&A's attributes when the scene goes", () => {
    const page = fakePage();
    const q = makeQaScene();
    poseAt(q, at(4), DESK, page);
    q.hide();
    expect(page.attributes.size).toBe(0);
    expect(page.vars.size).toBe(0);
    expect(page.section.inert).toBe(true);
    // Posed off (3D going, a project's page up): the same.
    poseAt(q, at(4), DESK, page);
    poseAt(q, at(4), DESK, page, { on: false });
    expect(page.attributes.size).toBe(0);
    q.dispose();
  });
});
