import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyPose } from '~/engine/applyPose';
import { layoutFor, placeCamera } from '~/engine/CameraRig';
import { poseAt, type CompassPose, type SectionId } from '~/engine/Choreography';
import { DIAL } from '~/engine/instrument/dialSpec';
import { buildInstrument } from '~/engine/instrument/Instrument';
import { buildTracks } from '~/engine/instrument/Tracks';
import { buildWire } from '~/engine/instrument/Wire';
import { overlayOf, rimOf, SPINDLE_REACH, toScreen } from '~/engine/overlay';

const W = 1440;
const H = 900;
const DEG = Math.PI / 180;

/** The scene's parts posed at `id` `local`, the camera placed for that pose's framing on a W × H canvas. */
function posed(id: SectionId, local: number, spin = 0): { pose: CompassPose; camera: THREE.PerspectiveCamera; model: ReturnType<typeof buildInstrument> } {
  const model = buildInstrument();
  const wire = buildWire();
  const tracks = buildTracks();
  model.dial.add(wire.mesh);
  model.topPlatter().add(tracks.group);
  const pose = poseAt(id, local);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  placeCamera(camera, { layout: layoutFor(W, H, pose.framing.side), tilt: pose.framing.tilt, zoom: pose.framing.zoom, near: pose.framing.near }, W, H);
  model.spin.rotation.y = spin;
  model.root.updateMatrixWorld(true);
  applyPose(model, wire, tracks, pose, pose.needle.bearing * DEG, null);
  model.root.updateMatrixWorld(true);
  return { pose, camera, model };
}

describe('toScreen', () => {
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
  placeCamera(camera, { layout: layoutFor(W, H, 0), tilt: 0, zoom: 1, near: 0.1 }, W, H);

  it("puts the face centre where the layout has it, in CSS px, and shows it", () => {
    const layout = layoutFor(W, H, 0);
    const at = toScreen(new THREE.Vector3(0, 0, 0), camera, W, H);
    expect(at.x).toBeCloseTo(layout.x, 6);
    expect(at.y).toBeCloseTo(layout.y, 6);
    expect(at.visible).toBe(true);
  });

  it('hides a point behind the camera, off the canvas, or on a canvas with no size', () => {
    const behind = camera.position.clone().multiplyScalar(2);
    expect(toScreen(behind, camera, W, H).visible).toBe(false);
    expect(toScreen(new THREE.Vector3(40, 0, 0), camera, W, H).visible).toBe(false);
    expect(toScreen(new THREE.Vector3(0, -40, 0), camera, W, H).visible).toBe(false);
    expect(toScreen(new THREE.Vector3(0, 0, 0), camera, 0, H).visible).toBe(false);
    const nowhere = toScreen(new THREE.Vector3(Number.NaN, 0, 0), camera, W, H);
    expect(nowhere.visible).toBe(false);
    expect(Number.isFinite(nowhere.x) && Number.isFinite(nowhere.y)).toBe(true);
  });
});

describe('the overlay', () => {
  it('rides the read head on a track, with the track and the test point under it', () => {
    const { pose, camera, model } = posed('funcial', 0.3);
    expect(pose.tracks.tp).toBe(0);
    const overlay = overlayOf(model, pose, camera, W, H, null);
    const head = model.headWorld(new THREE.Vector3()).project(camera);
    expect(overlay.head.x).toBeCloseTo(((head.x + 1) / 2) * W, 6);
    expect(overlay.head.y).toBeCloseTo(((1 - head.y) / 2) * H, 6);
    expect(overlay.head).toMatchObject({ visible: true, track: 'funcial', tp: 0 });
    expect(overlay.hover).toBeNull();
    expect(overlay.spindle.visible).toBe(false);
  });

  it('hides the head where the needle is not yet the arm, and between test points has none', () => {
    const compass = posed('hero', 0.5);
    expect(overlayOf(compass.model, compass.pose, compass.camera, W, H, null).head).toMatchObject({ visible: false, track: null, tp: null });
    const changing = posed('change', 0.6);
    expect(changing.pose.drive.arm).toBeLessThan(1);
    expect(overlayOf(changing.model, changing.pose, changing.camera, W, H, null).head.visible).toBe(false);
    const between = posed('jontai-energy', 0.36);
    expect(overlayOf(between.model, between.pose, between.camera, W, H, 'next').head).toMatchObject({ visible: true, track: 'jontai-energy', tp: null });
    expect(overlayOf(between.model, between.pose, between.camera, W, H, 'next').hover).toBe('next');
  });

  it('hides the head where it is over no track: parked in Off duty, in the Q&A, and where the change has just formed the arm', () => {
    for (const [id, local] of [['offduty', 0.1], ['offduty', 0.6], ['qa', 0.5], ['change', 1]] as const) {
      const { pose, camera, model } = posed(id, local);
      expect(pose.drive.arm, id).toBe(1);
      expect(pose.tracks.current, id).toBeNull();
      expect(overlayOf(model, pose, camera, W, H, null).head.visible, `${id} ${local}`).toBe(false);
    }
  });

  it('centres the spindle on the hub in Off duty, its radius 0.42 world units across, turning with the platter and the spin', () => {
    const { pose, camera, model } = posed('offduty', 0.5, 0.5);
    const overlay = overlayOf(model, pose, camera, W, H, null);
    expect(overlay.spindle.visible).toBe(true);
    // The hub stands on the dial's axis, a little above the face, so it projects close to where the face centre does.
    const centre = toScreen(model.dial.getWorldPosition(new THREE.Vector3()), camera, W, H);
    expect(Math.hypot(overlay.spindle.x - centre.x, overlay.spindle.y - centre.y)).toBeLessThan(0.1 * overlay.spindle.radius);
    // At about the face's depth, 0.42 units are 0.42 / DIAL.rim of the rim's radius.
    const rim = rimOf(model.dial, camera, W, H);
    expect(overlay.spindle.radius / (((rim.diameter / 2) * SPINDLE_REACH) / DIAL.rim)).toBeCloseTo(1, 1);
    expect(overlay.spindle.angle).toBeCloseTo(pose.platter + 0.5 / DEG, 9);
  });

  it('has no spindle outside Off duty', () => {
    for (const [id, local] of [['funcial', 0.5], ['qa', 0.5], ['hero', 0.5]] as const) {
      const { pose, camera, model } = posed(id, local);
      expect(overlayOf(model, pose, camera, W, H, null).spindle.visible, id).toBe(false);
    }
  });

  it('measures the rim as drawn, and nothing on a canvas with no size', () => {
    const { camera, model } = posed('hero', 0);
    const rim = rimOf(model.dial, camera, W, H);
    const layout = layoutFor(W, H, 0);
    expect(rim.x).toBeCloseTo(layout.x, 3);
    expect(rim.y).toBeCloseTo(layout.y, 3);
    expect(rim.diameter / layout.diameter).toBeCloseTo(1, 1);
    expect(rimOf(model.dial, camera, 0, 0)).toEqual({ x: 0, y: 0, diameter: 0 });
  });
});
