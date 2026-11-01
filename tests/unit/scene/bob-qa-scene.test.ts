import { describe, expect, it } from 'vitest';
import { RING_QUESTIONS } from '~/data/qa';
import { grabNow, grabWanted } from '~/scene/frameGrab';
import { makeQaScene, type QaScenePose } from '~/scene/bob/qaScene';
import { worldPathFor } from '~/scene/bob/worldPath';
import { HOME_CHAPTERS, pathStart, qaDoor, qaStop, scrollEnd } from '~/state/chapters';
import { QA_AT_ATTRIBUTE, QA_END_ATTRIBUTE } from '~/ui/qaWriters';

const LAPTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/**
 * A fake of the page's Q&A: <html>'s attributes, the section with its vars, the track, the end, and a block for each
 * question whose words stand `gap` px apart down the track (question k's words' middle at 375 + gap · k).
 */
function fakePage() {
  const attributes = new Map<string, string>();
  const vars = new Map<string, string>();
  const layout = { gap: 400 };
  let measured = 0;
  const blocks = Array.from({ length: RING_QUESTIONS }, (_, k) => {
    const question = {
      get offsetTop() {
        measured++;
        return 300 + layout.gap * k;
      },
      offsetHeight: 40
    };
    const text = {
      get offsetTop() {
        return 350 + layout.gap * k;
      },
      offsetHeight: 100
    };
    return { querySelector: (sel: string) => (sel === '.qa-question' ? question : sel === '.qa-text' ? text : null) };
  });
  const track = { style: { transform: '' } };
  const end = { hidden: true };
  const leds = { width: 0, height: 0, getContext: () => null };
  const section = {
    isConnected: true,
    inert: true,
    style: { setProperty: (n: string, v: string) => vars.set(n, v), removeProperty: (n: string) => vars.delete(n) },
    querySelector: (sel: string) => (sel === '.qa-track' ? track : sel === '.qa-end' ? end : sel === '.qa-leds' ? leds : null),
    querySelectorAll: (sel: string) => (sel === '.qa-block' ? blocks : [])
  };
  const doc = {
    documentElement: { setAttribute: (n: string, v: string) => attributes.set(n, v), removeAttribute: (n: string) => attributes.delete(n) },
    getElementById: (id: string) => (id === 'qa' ? section : null)
  };
  return { doc: doc as unknown as Document, attributes, vars, track, end, section, layout, measures: () => measured };
}

/** The scene posed at `progress` on the home's scroll, on `size`. */
function poseAt(scene: ReturnType<typeof makeQaScene>, page: ReturnType<typeof fakePage>, progress: number, size = LAPTOP, reduced = false) {
  const path = worldPathFor(size.width / size.height).frameAt(progress - pathStart(HOME_CHAPTERS));
  const pose: QaScenePose = { path, on: true, clock: 0, reduced, tier: 'high', size, doc: page.doc, core: null };
  return scene.pose(pose);
}
const between = (k: number): number => qaStop(HOME_CHAPTERS, k) + 0.5 * (qaStop(HOME_CHAPTERS, k + 1) - qaStop(HOME_CHAPTERS, k));

describe("the Q&A's scene: the words with the scroll, the LEDs at the end (round 15)", () => {
  it('shows nothing before the door, and clears the page off it', () => {
    const page = fakePage();
    const scene = makeQaScene();
    expect(poseAt(scene, page, qaDoor(HOME_CHAPTERS) - 0.1)).toBeNull();
    expect(page.attributes.size).toBe(0);
    const at = poseAt(scene, page, qaDoor(HOME_CHAPTERS));
    expect(at!.stretch).toBe('floor');
    expect(page.attributes.has('data-qa')).toBe(false);
  });

  it("moves the track so the question at the place stands on the reading line, and names it", () => {
    const page = fakePage();
    const scene = makeQaScene();
    const at = poseAt(scene, page, qaStop(HOME_CHAPTERS, 3))!;
    expect(at).toMatchObject({ place: 3, stretch: 'qa', at: 3, line: 0 });
    expect(page.track.style.transform).toBe(`translate3d(0, ${(450 - (375 + 3 * 400)).toFixed(1)}px, 0)`);
    expect(page.attributes.get('data-qa')).toBe('');
    expect(page.attributes.get(QA_AT_ATTRIBUTE)).toBe('3');
    expect(page.vars.get('--qa-column')).toBe('1.000');
    expect(page.section.inert).toBe(false);
    // Half way to the next: no question on the line, the track half way.
    poseAt(scene, page, between(3));
    expect(page.attributes.has(QA_AT_ATTRIBUTE)).toBe(false);
    expect(page.track.style.transform).toBe(`translate3d(0, ${(450 - (375 + 3.5 * 400)).toFixed(1)}px, 0)`);
  });

  it('re-measures on a new screen, so the question on the line stays on it; not on every frame', () => {
    const page = fakePage();
    const scene = makeQaScene();
    poseAt(scene, page, qaStop(HOME_CHAPTERS, 2));
    const once = page.measures();
    poseAt(scene, page, qaStop(HOME_CHAPTERS, 2));
    expect(page.measures()).toBe(once);
    page.layout.gap = 520;
    poseAt(scene, page, qaStop(HOME_CHAPTERS, 2), PHONE);
    expect(page.measures()).toBeGreaterThan(once);
    expect(page.track.style.transform).toBe(`translate3d(0, ${(0.62 * 844 - (375 + 2 * 520)).toFixed(1)}px, 0)`);
  });

  it('asks the LEDs a grab only while the line is down the screen', () => {
    grabNow({ width: 1, height: 1 } as HTMLCanvasElement);
    const page = fakePage();
    const scene = makeQaScene();
    poseAt(scene, page, qaStop(HOME_CHAPTERS, 5));
    expect(grabWanted()).toBe(false);
    const at = poseAt(scene, page, between(5))!;
    expect(at.stretch).toBe('digitize');
    expect(at.line).toBeGreaterThan(0);
    expect(grabWanted()).toBe(true);
    grabNow({ width: 1, height: 1 } as HTMLCanvasElement);
  });

  it('stands the end on the LEDs at the end, its words in reach', () => {
    const page = fakePage();
    const scene = makeQaScene();
    const at = poseAt(scene, page, scrollEnd(HOME_CHAPTERS))!;
    expect(at).toMatchObject({ stretch: 'end', at: RING_QUESTIONS, line: 1 });
    expect(page.attributes.get(QA_END_ATTRIBUTE)).toBe('');
    expect(page.attributes.get(QA_AT_ATTRIBUTE)).toBe(String(RING_QUESTIONS));
    expect(page.end.hidden).toBe(false);
    expect(page.vars.get('--qa-column')).toBe('0.000');
    grabNow({ width: 1, height: 1 } as HTMLCanvasElement);
  });

  it('brings the LEDs and the end at once with reduced motion, from half way past question 6', () => {
    const page = fakePage();
    const scene = makeQaScene();
    const at = poseAt(scene, page, between(5), LAPTOP, true)!;
    expect(at.line).toBe(1);
    expect(page.end.hidden).toBe(false);
    grabNow({ width: 1, height: 1 } as HTMLCanvasElement);
  });

  it('clears all of it when hidden', () => {
    const page = fakePage();
    const scene = makeQaScene();
    poseAt(scene, page, scrollEnd(HOME_CHAPTERS));
    scene.hide();
    expect(page.attributes.size).toBe(0);
    expect(page.section.inert).toBe(true);
    expect(page.end.hidden).toBe(true);
    grabNow({ width: 1, height: 1 } as HTMLCanvasElement);
  });
});
