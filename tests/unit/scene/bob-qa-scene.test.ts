import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RING_MARKS, RING_QUESTIONS } from '~/data/qa';
import { buildDecorStars } from '~/engine/bob/build/decorStars';
import { buildRing } from '~/engine/bob/build/ring';
import { makeQaScene, type QaScenePose } from '~/scene/bob/qaScene';
import { worldPathFor } from '~/scene/bob/worldPath';
import { HOME_CHAPTERS, lookStop, pathStart, qaStop } from '~/state/chapters';

/** A fake of the page: <html>, the Q&A's section with its frame, its list's questions (each its button and reply), the end. */
function fakePage() {
  const attributes = new Map<string, string>();
  const vars = new Map<string, string>();
  const style = { setProperty: (n: string, v: string) => vars.set(n, v), removeProperty: (n: string) => vars.delete(n) };
  const expanded = Array.from({ length: RING_QUESTIONS }, () => 'false');
  const items = expanded.map((_, k) => ({
    querySelector: (sel: string) =>
      sel === '.qa-ask' ? { setAttribute: (n: string, v: string) => n === 'aria-expanded' && (expanded[k] = v) } : sel === '.qa-reply' ? replies[k] : null
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

  it('keeps the list whole while the ring turns from one question to another, the open one open until it lands', () => {
    const page = fakePage();
    const q = make();
    poseAt(q, qaStop(HOME_CHAPTERS, 1), DESK, page);
    poseAt(q, (qaStop(HOME_CHAPTERS, 1) + qaStop(HOME_CHAPTERS, 2)) / 2, DESK, page);
    expect(page.vars.get('--qa-show')).toBe('1');
    expect(page.open()).toEqual([1]);
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
