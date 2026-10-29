import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RING_MARKS, RING_QUESTIONS } from '~/data/qa';
import { buildDecorStars } from '~/engine/bob/build/decorStars';
import { buildRing } from '~/engine/bob/build/ring';
import { makeQaScene, type QaScenePose } from '~/scene/bob/qaScene';
import { worldPathFor } from '~/scene/bob/worldPath';
import { HOME_CHAPTERS, lookStop, pathStart, qaStop } from '~/state/chapters';

/** A fake of the page: <html>, the ring's section with its frame, its answers and its marks' buttons. */
function fakePage() {
  const attributes = new Map<string, string>();
  const vars = new Map<string, string>();
  const style = { setProperty: (n: string, v: string) => vars.set(n, v), removeProperty: (n: string) => vars.delete(n) };
  const answers = Array.from({ length: RING_QUESTIONS + 1 }, () => ({ hidden: true }));
  // The frame has the size of the answer it shows: none while every answer is hidden.
  const frame = { style, getBoundingClientRect: () => (answers.some((a) => !a.hidden) ? { width: 540, height: 600 } : { width: 540, height: 0 }) };
  const marks = Array.from({ length: RING_MARKS }, () => ({ hidden: true, vars: new Map<string, string>(), style: { setProperty(n: string, v: string) { (this as unknown as { owner: Map<string, string> }).owner.set(n, v); } } as never }));
  for (const m of marks) (m.style as unknown as { owner: Map<string, string> }).owner = m.vars;
  const section = {
    isConnected: true,
    inert: true,
    querySelector: (s: string) => (s === '.qa-frame' ? frame : null),
    querySelectorAll: (s: string) => (s === '.qa-answer' ? answers : s === '.qa-mark' ? marks : [])
  };
  const doc = {
    documentElement: { setAttribute: (n: string, v: string) => attributes.set(n, v), removeAttribute: (n: string) => attributes.delete(n) },
    getElementById: (id: string) => (id === 'qa' ? section : null)
  };
  return { doc: doc as unknown as Document, attributes, vars, answers, marks, section };
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
// answer and the marks' buttons written on the page where the ring has them.
describe("the Q&A's scene", () => {
  it('shows the answer at its mark, and names the near half of the marks', () => {
    const page = fakePage();
    const q = make();
    const seen = poseAt(q, qaStop(HOME_CHAPTERS, 2), DESK, page);
    expect(seen).toMatchObject({ at: 2, close: 1 });
    expect(page.attributes.get('data-qa')).toBe('');
    expect(page.attributes.get('data-qa-at')).toBe('2');
    expect(page.answers.map((a) => a.hidden)).toEqual([true, true, false, true, true, true, true]);
    expect(page.vars.get('--qa-show')).toBe('1');
    // The mark at the front is named; at least one on the far half is not.
    expect(page.marks[2]!.hidden).toBe(false);
    expect(page.marks.some((m) => m.hidden)).toBe(true);
    q.dispose();
  });

  it('measures the answer once it shows, so a long one stays on the screen', () => {
    const page = fakePage();
    const q = make();
    poseAt(q, qaStop(HOME_CHAPTERS, 5), DESK, page);
    // Measured hidden it would be 0 px tall and hang off the bottom; measured shown it is held 70 px above it.
    const y = Number.parseFloat(page.vars.get('--qa-y')!);
    expect(y + 600).toBeLessThanOrEqual(DESK.height - 70 + 1);
    q.dispose();
  });

  it('re-places the marks and the answer on a resize, the place kept', () => {
    const page = fakePage();
    const q = make();
    poseAt(q, qaStop(HOME_CHAPTERS, 1), DESK, page);
    const desk = { x: page.vars.get('--qa-x'), y: page.vars.get('--qa-y'), mark: page.marks[1]!.vars.get('--x') };
    const seen = poseAt(q, qaStop(HOME_CHAPTERS, 1), PHONE, page);
    expect(seen!.at).toBe(1);
    expect(page.vars.get('--qa-x')).toBe('20px'); // on a phone, under the ring
    expect(page.vars.get('--qa-y')).not.toBe(desk.y);
    expect(page.marks[1]!.vars.get('--x')).not.toBe(desk.mark);
    q.dispose();
  });

  it('clicks a little past and back as it lands, with no click with reduced motion', () => {
    const page = fakePage();
    const q = make();
    const at = qaStop(HOME_CHAPTERS, 3);
    poseAt(q, at - 0.5, DESK, page, { clock: 0 });
    poseAt(q, at, DESK, page, { clock: 1 });
    const spin = q.ring.group.getObjectByName('ring:spin')!;
    const landed = spin.rotation.y;
    poseAt(q, at, DESK, page, { clock: 1.05 });
    expect(spin.rotation.y).not.toBe(landed);
    poseAt(q, at, DESK, page, { clock: 3 });
    const still = spin.rotation.y;
    const r = make();
    poseAt(r, at - 0.5, DESK, page, { clock: 0, reduced: true });
    poseAt(r, at, DESK, page, { clock: 1, reduced: true });
    poseAt(r, at, DESK, page, { clock: 1.05, reduced: true });
    expect(r.ring.group.getObjectByName('ring:spin')!.rotation.y).toBeCloseTo(still, 9);
    q.dispose();
    r.dispose();
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
