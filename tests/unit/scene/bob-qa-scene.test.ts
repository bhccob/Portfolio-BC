import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RING_MARKS, RING_QUESTIONS } from '~/data/qa';
import { buildDecorStars } from '~/engine/bob/build/decorStars';
import { buildRing } from '~/engine/bob/build/ring';
import { RING_DRIFT, ringTurnFor } from '~/scene/bob/qaRing';
import { makeQaScene, type QaScenePose } from '~/scene/bob/qaScene';
import { worldPathFor } from '~/scene/bob/worldPath';
import { HOME_CHAPTERS, lookStop, pathStart, qaStop } from '~/state/chapters';

/**
 * A fake of the page: <html>, the Q&A's section with its frame, its list's questions (each its button and reply), the end.
 * Each question's button stands 56 px tall, the first 1 px down the frame (under its rule), as the list stands closed.
 */
function fakePage() {
  const attributes = new Map<string, string>();
  const vars = new Map<string, string>();
  const style = { setProperty: (n: string, v: string) => vars.set(n, v), removeProperty: (n: string) => vars.delete(n) };
  const expanded = Array.from({ length: RING_QUESTIONS }, () => 'false');
  const items = expanded.map((_, k) => ({
    querySelector: (sel: string) =>
      sel === '.qa-ask'
        ? { setAttribute: (n: string, v: string) => n === 'aria-expanded' && (expanded[k] = v), offsetTop: 1 + 57 * k, offsetHeight: 56 }
        : sel === '.qa-reply'
          ? replies[k]
          : null
  }));
  const replies = expanded.map(() => ({ hidden: true }));
  const end = { hidden: true };
  let measured = 0;
  const frame = { style, getBoundingClientRect: () => (measured++, { left: 900, top: 160, width: 440, height: 520 }) };
  const section = {
    isConnected: true,
    inert: true,
    querySelector: (sel: string) => (sel === '.qa-frame' ? frame : sel === '.qa-end' ? end : null),
    querySelectorAll: (sel: string) => (sel === '.qa-item' ? items : [])
  };
  const doc = {
    documentElement: { setAttribute: (n: string, v: string) => attributes.set(n, v), removeAttribute: (n: string) => attributes.delete(n) },
    getElementById: (id: string) => (id === 'qa' ? section : null)
  };
  const open = (): number[] => expanded.flatMap((v, k) => (v === 'true' ? [k] : []));
  return { doc: doc as unknown as Document, attributes, vars, replies, end, section, open, measures: () => measured };
}

function cameraFor(shot: { position: readonly number[]; target: readonly number[]; fov: number }, aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(shot.fov, aspect, 0.1, 500);
  camera.position.set(shot.position[0]!, shot.position[1]!, shot.position[2]!);
  camera.lookAt(shot.target[0]!, shot.target[1]!, shot.target[2]!);
  camera.updateMatrixWorld();
  return camera;
}

/** The Q&A's scene as the Void poses it at place `p` on the home's story, on a screen of `size`. */
function poseAt(q: ReturnType<typeof makeQaScene>, p: number, size: { width: number; height: number }, page: ReturnType<typeof fakePage>, over: Partial<QaScenePose> = {}) {
  const aspect = size.width / size.height;
  const path = worldPathFor(aspect).frameAt(p - pathStart(HOME_CHAPTERS));
  return q.pose({ path, on: true, clock: 0, dt: 1 / 60, reduced: false, camera: cameraFor(path.shot, aspect), size, doc: page.doc, ...over });
}

const DESK = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const make = () => makeQaScene(buildRing(RING_MARKS, null), buildDecorStars('high', [0, 0, 0], -9));

// The Q&A in the scene (spec 2026-10-29-bob-stack-2-design.md, goal 1): the ring and its stars posed from the path, the
// list's open question and the end written on the page (round 10).
describe("the Q&A's scene", () => {
  // Round 10 (Bob picked "A · One list"): the list beside the tower, the question the ring stands at open.
  it('opens the question the ring stands at in the list, and shows the list whole', () => {
    const page = fakePage();
    const q = make();
    const seen = poseAt(q, qaStop(HOME_CHAPTERS, 2), DESK, page);
    expect(seen).toMatchObject({ at: 2, close: 1 });
    expect(page.attributes.get('data-qa')).toBe('');
    expect(page.attributes.get('data-qa-at')).toBe('2');
    expect(page.open()).toEqual([2]);
    expect(page.replies.map((r) => r.hidden)).toEqual([true, true, false, true, true, true]);
    expect(page.end.hidden).toBe(true);
    expect(page.vars.get('--qa-show')).toBe('1');
    q.dispose();
  });

  // Round 13 (Bob picked "C · The light"): between two questions the list stands closed, the gold light on its way down
  // it; the next opens as the light arrives.
  it('closes the list while the light runs to the next question, and opens that one as it arrives', () => {
    const page = fakePage();
    const q = make();
    const a = qaStop(HOME_CHAPTERS, 1);
    const b = qaStop(HOME_CHAPTERS, 2);
    poseAt(q, a, DESK, page);
    expect(page.open()).toEqual([1]);
    poseAt(q, (a + b) / 2, DESK, page);
    expect(page.vars.get('--qa-show')).toBe('1');
    expect(page.open()).toEqual([]);
    expect(page.replies.every((r) => r.hidden)).toBe(true);
    poseAt(q, b - 0.05 * (b - a), DESK, page);
    expect(page.open()).toEqual([2]);
    q.dispose();
  });

  it('runs the light down the list with the scroll, question to question, and says which way it goes', () => {
    const page = fakePage();
    const q = make();
    const at = (k: number): number => qaStop(HOME_CHAPTERS, k);
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
    // Coming in from the look back it waits at the first question, as the list shows.
    poseAt(q, lookStop(HOME_CHAPTERS) + 0.9 * (at(0) - lookStop(HOME_CHAPTERS)), DESK, page);
    expect(y()).toBeCloseTo(29, 1);
    q.dispose();
  });

  it('lets the list go as the ring turns on past the last question, and shows the end at its mark', () => {
    const page = fakePage();
    const q = make();
    poseAt(q, (qaStop(HOME_CHAPTERS, RING_QUESTIONS - 1) + qaStop(HOME_CHAPTERS, RING_QUESTIONS)) / 2, DESK, page);
    expect(Number(page.vars.get('--qa-show'))).toBeCloseTo(0.5, 2);
    poseAt(q, qaStop(HOME_CHAPTERS, RING_QUESTIONS), DESK, page);
    expect(page.attributes.has('data-qa-end')).toBe(true);
    expect(page.end.hidden).toBe(false);
    q.dispose();
  });

  it('measures the words once per open question and screen, for the stars to keep out of them', () => {
    const page = fakePage();
    const q = make();
    poseAt(q, qaStop(HOME_CHAPTERS, 1), DESK, page);
    poseAt(q, qaStop(HOME_CHAPTERS, 1), DESK, page);
    expect(page.measures()).toBe(1);
    poseAt(q, qaStop(HOME_CHAPTERS, 1), PHONE, page);
    expect(page.measures()).toBe(2);
    q.dispose();
  });

  // Round 13 (Bob, 2026-10-31: "can you also make the background ring also move around a bit when theyre on the Q&A"):
  // the scroll no longer turns it; on its own clock it drifts a little round and back, in as the stack closes.
  it('drifts the ring a little on its own in the Q&A, and holds it still with reduced motion and at the look back', () => {
    const page = fakePage();
    const spinOf = (s: ReturnType<typeof make>): number => s.ring.group.getObjectByName('ring:spin')!.rotation.y;
    const frames = (s: ReturnType<typeof make>, p: number, n: number, over: Partial<QaScenePose> = {}): number[] =>
      Array.from({ length: n }, () => (poseAt(s, p, DESK, page, { dt: 1 / 30, ...over }), spinOf(s)));
    const rest = ringTurnFor(-1, RING_MARKS);
    const q = make();
    const turns = frames(q, qaStop(HOME_CHAPTERS, 2), 120);
    expect(Math.max(...turns) - Math.min(...turns)).toBeGreaterThan(0.01);
    for (const t of turns) expect(Math.abs(t - rest)).toBeLessThanOrEqual(RING_DRIFT.turn + 1e-9);
    const r = make();
    expect(new Set(frames(r, qaStop(HOME_CHAPTERS, 2), 60, { reduced: true }))).toEqual(new Set([rest]));
    const l = make();
    expect(new Set(frames(l, lookStop(HOME_CHAPTERS), 60))).toEqual(new Set([rest]));
    q.dispose();
    r.dispose();
    l.dispose();
  });

  it('names no answer at the look back, and lights the stars in as the stack closes', () => {
    const page = fakePage();
    const q = make();
    const seen = poseAt(q, lookStop(HOME_CHAPTERS), DESK, page);
    expect(seen!.at).toBeNull();
    expect(page.attributes.has('data-qa-at')).toBe(false);
    expect(q.decor.group.visible).toBe(false);
    poseAt(q, qaStop(HOME_CHAPTERS, 0), DESK, page);
    expect(q.decor.group.visible).toBe(true);
    q.dispose();
  });

  it("clears the Q&A's attributes when the scene goes", () => {
    const page = fakePage();
    const q = make();
    poseAt(q, qaStop(HOME_CHAPTERS, 4), DESK, page);
    q.hide();
    expect(page.attributes.size).toBe(0);
    expect(page.vars.size).toBe(0);
    expect(page.section.inert).toBe(true);
    expect(q.ring.group.visible).toBe(false);
    expect(q.decor.group.visible).toBe(false);
    // Posed off (3D going, a project's page up): the same.
    poseAt(q, qaStop(HOME_CHAPTERS, 4), DESK, page);
    poseAt(q, qaStop(HOME_CHAPTERS, 4), DESK, page, { on: false });
    expect(page.attributes.size).toBe(0);
    q.dispose();
  });
});
