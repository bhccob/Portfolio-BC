import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { applyPose } from '../../src/scripts/three/applyPose';
import { layoutFor, placeCamera } from '../../src/scripts/three/CameraRig';
import { poseAt } from '../../src/scripts/three/Choreography';
import { buildInstrument } from '../../src/scripts/three/instrument/Instrument';
import { buildTracks } from '../../src/scripts/three/instrument/Tracks';
import { buildWire } from '../../src/scripts/three/instrument/Wire';
import { toScreen } from '../../src/scripts/three/overlay';
import { clickOpens, TrackPointer } from '../../src/scripts/three/TrackPointer';

const W = 1440;
const H = 900;

/** The drive in a track section, the camera on it, and a pointer over its tracks. */
function setUp() {
  const model = buildInstrument();
  const wire = buildWire();
  const tracks = buildTracks();
  model.dial.add(wire.mesh);
  model.topPlatter().add(tracks.group);
  const pose = poseAt('funcial', 0.5);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  placeCamera(camera, { layout: layoutFor(W, H, pose.framing.side), tilt: pose.framing.tilt, zoom: pose.framing.zoom, near: pose.framing.near }, W, H);
  applyPose(model, wire, tracks, pose, 0, null);
  model.root.updateMatrixWorld(true);
  const hovered = vi.fn();
  const pointer = new TrackPointer(tracks.hits, camera, hovered);
  const handler = vi.fn();
  pointer.on(handler);
  // Where Jontai's track and the empty space between it and Cookies' draw.
  const jontai = toScreen(tracks.pointOf('jontai-energy', 1, new THREE.Vector3()), camera, W, H);
  const between = toScreen(tracks.pointOf('jontai-energy', 1, new THREE.Vector3()).lerp(tracks.pointOf('cookies-clicker', 1, new THREE.Vector3()), 0.5), camera, W, H);
  return { pointer, handler, hovered, jontai, between, tracks };
}

describe('TrackPointer', () => {
  it('picks the track under a pointer on its pick ring, and tells a hover only as it changes', () => {
    const { pointer, handler, hovered, jontai, between } = setUp();
    expect(jontai.visible && between.visible).toBe(true);
    pointer.move(jontai.x, jontai.y, W, H);
    pointer.step(true);
    pointer.step(true);
    expect(pointer.hovered).toBe('jontai-energy');
    expect(handler.mock.calls).toEqual([['jontai-energy', 'hover']]);
    expect(hovered.mock.calls).toEqual([['jontai-energy']]);
    pointer.move(between.x, between.y, W, H);
    pointer.step(true);
    expect(pointer.hovered).toBeNull();
    expect(handler.mock.calls.at(-1)).toEqual([null, 'hover']);
  });

  it('picks nothing while the tracks do not answer, letting go of a hovered one, though the rings still raycast', () => {
    const { pointer, handler, jontai, tracks } = setUp();
    tracks.group.visible = false;
    pointer.move(jontai.x, jontai.y, W, H);
    pointer.step(false);
    expect(pointer.hovered).toBeNull();
    expect(handler).not.toHaveBeenCalled();
    pointer.step(true);
    expect(pointer.hovered).toBe('jontai-energy');
    pointer.step(false);
    expect(pointer.hovered).toBeNull();
    expect(handler.mock.calls).toEqual([['jontai-energy', 'hover'], [null, 'hover']]);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('loses the pointer off the canvas and when it leaves', () => {
    const { pointer, jontai } = setUp();
    pointer.move(jontai.x, jontai.y, W, H);
    pointer.step(true);
    pointer.move(-5, jontai.y, W, H);
    expect(pointer.hovered).toBeNull();
    pointer.move(jontai.x, jontai.y, W, H);
    pointer.step(true);
    pointer.leave();
    expect(pointer.hovered).toBeNull();
    pointer.step(true);
    expect(pointer.hovered).toBeNull();
  });

  it('answers a click over a track, none off the tracks, and none for the click that ends a turn', () => {
    const { pointer, handler, jontai, between } = setUp();
    pointer.step(true);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler.mock.calls).toEqual([['jontai-energy', 'click']]);
    pointer.click(between.x, between.y, W, H);
    expect(handler).toHaveBeenCalledTimes(1);
    pointer.pressed('mouse');
    pointer.released(true);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler).toHaveBeenCalledTimes(1);
    // Only that one click: the next counts again, as does one after a press that did not turn.
    pointer.click(jontai.x, jontai.y, W, H);
    pointer.pressed('mouse');
    pointer.released(false);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('answers no click for a finger: a tap on a track opens nothing, while a mouse or pen click does', () => {
    const { pointer, handler, jontai } = setUp();
    pointer.step(true);
    // A tap: the finger comes down and goes up without turning the dial, then the click arrives.
    pointer.pressed('touch');
    pointer.released(false);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler).not.toHaveBeenCalled();
    // The next press decides its own click: a pen, then a mouse, open the track; a finger again does not.
    pointer.pressed('pen');
    pointer.released(false);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler.mock.calls).toEqual([['jontai-energy', 'click']]);
    pointer.pressed('touch');
    pointer.released(false);
    pointer.click(jontai.x, jontai.y, W, H);
    pointer.pressed('mouse');
    pointer.released(false);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler.mock.calls).toEqual([['jontai-energy', 'click'], ['jontai-energy', 'click']]);
    expect(clickOpens('mouse')).toBe(true);
    expect(clickOpens('pen')).toBe(true);
    expect(clickOpens('touch')).toBe(false);
  });

  it('opens on a click when no press was told, as a mouse does, and a finger that turned the dial still spends the turn', () => {
    const { pointer, handler, jontai } = setUp();
    pointer.step(true);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler).toHaveBeenCalledTimes(1);
    // A finger's swipe that turned the dial: its click is none, and the next press (a mouse) clicks as usual.
    pointer.pressed('touch');
    pointer.released(true);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler).toHaveBeenCalledTimes(1);
    pointer.pressed('mouse');
    pointer.released(false);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('keeps telling the other handlers when one throws, and lets them go on clear', () => {
    const { pointer, handler, jontai } = setUp();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = pointer.on(() => {
      throw new Error('boom');
    });
    const late = vi.fn();
    pointer.on(late);
    pointer.step(true);
    pointer.click(jontai.x, jontai.y, W, H);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    unsubscribe();
    pointer.clear();
    pointer.click(jontai.x, jontai.y, W, H);
    expect(late).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
