import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildInstrument, type InstrumentPose } from '../../src/scripts/three/instrument/Instrument';
import { DRIVE, TRACKS, headBearing, type TrackId } from '../../src/scripts/three/instrument/drive';
import { buildTracks, HOVER_LIT, tpBearing } from '../../src/scripts/three/instrument/Tracks';
import { palette } from '../../src/scripts/three/palette';

const DEG = Math.PI / 180;
const PINNED: readonly TrackId[] = ['funcial', 'jontai-energy', 'cookies-clicker'];

/** Every track at the same brightness. */
const all = (value: number): Record<TrackId, number> => ({ funcial: value, 'jontai-energy': value, 'cookies-clicker': value, next: value });

/** The radii and the bearings (degrees clockwise from north, in [0, 360)) of a mesh's vertices, in its own frame. */
function polar(mesh: THREE.Mesh): { radii: number[]; bearings: number[] } {
  const position = mesh.geometry.getAttribute('position');
  const radii: number[] = [];
  const bearings: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    radii.push(Math.hypot(x, z));
    bearings.push((((Math.atan2(x, -z) / DEG) % 360) + 360) % 360);
  }
  return { radii, bearings };
}

const named = (group: THREE.Object3D, name: string): THREE.Mesh => {
  const found = group.getObjectByName(name);
  if (!found) throw new Error(`no ${name}`);
  return found as THREE.Mesh;
};
const ringOf = (group: THREE.Object3D, id: TrackId): THREE.Mesh => named(group, `tracks:ring-${id}`);
const pinOf = (group: THREE.Object3D, id: TrackId, k: number): THREE.Mesh => named(group, `tracks:pin-${id}-${k}`);
const pinsOf = (group: THREE.Object3D): THREE.Mesh[] => {
  const pins: THREE.Mesh[] = [];
  group.traverse((o) => { if (o.name.startsWith('tracks:pin-')) pins.push(o as THREE.Mesh); });
  return pins;
};
const sectorsOf = (group: THREE.Object3D): THREE.Mesh[] => {
  const sectors: THREE.Mesh[] = [];
  group.traverse((o) => { if (o.name.startsWith('tracks:sector-')) sectors.push(o as THREE.Mesh); });
  return sectors;
};
const material = (mesh: THREE.Mesh): THREE.MeshBasicMaterial & THREE.MeshStandardMaterial => mesh.material as THREE.MeshBasicMaterial & THREE.MeshStandardMaterial;

/** The hit ring, if any, a ray straight down at (x, z) finds; the group sits in a frame of its own. */
function pick(hits: THREE.Mesh[], x: number, z: number): TrackId | null {
  hits[0].parent!.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
  const found = raycaster.intersectObjects(hits, false)[0];
  return found ? (found.object.userData.track as TrackId) : null;
}
const at = (radius: number, bearing: number): [number, number] => [radius * Math.sin(bearing * DEG), -radius * Math.cos(bearing * DEG)];

describe('the test points', () => {
  it('sit on the track, 90 degrees apart, from where the head stands', () => {
    for (const id of TRACKS) {
      expect(tpBearing(id, 0)).toBeCloseTo(headBearing(DRIVE.tracks[id]), 9);
      for (const k of [1, 2, 3]) expect(tpBearing(id, k) - tpBearing(id, 0)).toBeCloseTo(90 * k, 9);
    }
  });
  it('are 90 degrees apart on every track and finite', () => {
    for (const id of TRACKS) for (const k of [0, 1, 2, 3]) expect(Number.isFinite(tpBearing(id, k))).toBe(true);
  });
});

describe('the tracks', () => {
  const tracks = buildTracks();

  it('lays four rings at the track radii, a track wide', () => {
    for (const id of TRACKS) {
      const { radii } = polar(ringOf(tracks.group, id));
      expect(Math.min(...radii)).toBeCloseTo(DRIVE.tracks[id] - DRIVE.trackWidth / 2, 6);
      expect(Math.max(...radii)).toBeCloseTo(DRIVE.tracks[id] + DRIVE.trackWidth / 2, 6);
    }
  });
  it('sits 0.001 above the platter face', () => expect(tracks.group.position.y).toBeCloseTo(0.001, 9));
  it('draws the rings in signal yellow, added to what is under them', () => {
    for (const id of TRACKS) {
      const m = material(ringOf(tracks.group, id));
      expect(m.blending).toBe(THREE.AdditiveBlending);
      expect(m.transparent).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.color.getHex()).toBe(palette.yellow);
    }
  });
  it('gives each track a material of its own, so each can be lit alone', () => {
    const rings = TRACKS.map((id) => ringOf(tracks.group, id).material);
    expect(new Set(rings).size).toBe(TRACKS.length);
  });

  it('stands three tracks of four gold pins, and none on the empty one', () => {
    expect(pinsOf(tracks.group)).toHaveLength(12);
    for (const id of PINNED) {
      for (const k of [0, 1, 2, 3]) {
        const pin = pinOf(tracks.group, id, k);
        expect(pin.userData).toMatchObject({ track: id, index: k });
        expect(material(pin).color.getHex()).toBe(palette.gold);
      }
    }
    for (const k of [0, 1, 2, 3]) expect(tracks.group.getObjectByName(`tracks:pin-next-${k}`)).toBeUndefined();
  });
  it('puts every pin on its track at its bearing, 0.012 wide and 0.02 tall', () => {
    for (const id of PINNED) {
      for (const k of [0, 1, 2, 3]) {
        const pin = pinOf(tracks.group, id, k);
        const [x, , z] = pin.position.toArray();
        expect(Math.hypot(x, z)).toBeCloseTo(DRIVE.tracks[id], 6);
        const want = ((tpBearing(id, k) % 360) + 360) % 360;
        const got = ((Math.atan2(x, -z) / DEG) % 360 + 360) % 360;
        expect(Math.abs(((got - want + 540) % 360) - 180)).toBeLessThan(1e-6);
        pin.geometry.computeBoundingBox();
        const box = pin.geometry.boundingBox!;
        expect(box.max.x - box.min.x).toBeCloseTo(0.024, 3);
        expect(box.max.y - box.min.y).toBeCloseTo(0.02, 6);
        // The foot reaches the platter's face, 0.001 under the group.
        expect(box.min.y).toBeCloseTo(-0.001, 6);
      }
    }
  });

  it('lets a ray straight down onto a track find that track\'s hit ring', () => {
    expect(tracks.hits).toHaveLength(TRACKS.length);
    expect(pick(tracks.hits, ...at(0.76, 33))).toBe('jontai-energy');
    for (const id of TRACKS) for (const bearing of [0, 72, 144, 215, 301]) expect(pick(tracks.hits, ...at(DRIVE.tracks[id], bearing))).toBe(id);
  });
  it('answers a ray within half a hit width of the track, and not beyond', () => {
    const near = DRIVE.hitWidth / 2 - 0.005;
    expect(pick(tracks.hits, ...at(0.76 + near, 90))).toBe('jontai-energy');
    expect(pick(tracks.hits, ...at(0.76 - near, 90))).toBe('jontai-energy');
    expect(pick(tracks.hits, ...at(0.76 + DRIVE.hitWidth / 2 + 0.005, 90))).toBeNull();
    // Midway between two tracks, and off the platter, nothing answers.
    expect(pick(tracks.hits, ...at(0.82, 200))).toBeNull();
    expect(pick(tracks.hits, ...at(0.3, 200))).toBeNull();
    expect(pick(tracks.hits, ...at(0.95, 200))).toBeNull();
  });
  it('draws no hit ring, though it can be picked', () => {
    for (const hit of tracks.hits) {
      expect(hit.visible).toBe(true);
      expect(hit.parent).toBe(tracks.group);
      expect((hit.material as THREE.Material).visible).toBe(false);
      // Transparent like the rings, so were it ever compiled it shares their program rather than adding one.
      expect((hit.material as THREE.Material).transparent).toBe(true);
      const { radii } = polar(hit);
      expect(Math.max(...radii) - Math.min(...radii)).toBeCloseTo(DRIVE.hitWidth, 6);
    }
    expect(tracks.hits.map((h) => h.userData.track)).toEqual([...TRACKS]);
  });
  it('keeps answering the pointer on a track that is dark', () => {
    const dark = buildTracks();
    dark.set(all(0), { track: null, index: null }, null);
    expect(ringOf(dark.group, 'jontai-energy').visible).toBe(false);
    expect(pick(dark.hits, ...at(0.76, 10))).toBe('jontai-energy');
    dark.dispose();
  });

  it('cuts the empty track into 24 dashes by angle, in its shader', () => {
    const next = material(ringOf(tracks.group, 'next'));
    const key = next.customProgramCacheKey();
    expect(key).toBe(next.customProgramCacheKey());
    expect(key).not.toBe('');
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    next.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, undefined as never);
    expect(shader.vertexShader).toContain('vTrackPos');
    expect(shader.fragmentShader).toMatch(/atan\(\s*vTrackPos\.x,\s*-vTrackPos\.z\s*\)/);
    expect(shader.fragmentShader).toContain('24.0');
    expect(shader.fragmentShader).toContain('discard');
    // The other rings are plain.
    for (const id of PINNED) expect(material(ringOf(tracks.group, id)).onBeforeCompile.toString()).toBe(new THREE.MeshBasicMaterial().onBeforeCompile.toString());
  });

  it('builds finite geometry', () => {
    tracks.group.traverse((o) => {
      const position = (o as THREE.Mesh).geometry?.getAttribute('position');
      if (position) for (let i = 0; i < position.array.length; i++) expect(Number.isFinite(position.array[i]), o.name).toBe(true);
    });
  });
});

describe('the sectors', () => {
  it('light one of five at a time, each 72 degrees wide', () => {
    const tracks = buildTracks();
    expect(DRIVE.sectors).toBe(5);
    expect(sectorsOf(tracks.group)).toHaveLength(5);
    expect(sectorsOf(tracks.group).filter((s) => s.visible)).toHaveLength(0);
    tracks.setSector(2);
    const lit = sectorsOf(tracks.group).filter((s) => s.visible);
    expect(lit).toHaveLength(1);
    expect(lit[0].userData.sector).toBe(2);
    const { radii, bearings } = polar(lit[0]);
    expect(Math.min(...radii)).toBeCloseTo(0.3, 6);
    expect(Math.max(...radii)).toBeCloseTo(0.95, 6);
    // Centred at 144 degrees: 72 either side.
    const offsets = bearings.map((b) => ((b - 144 + 540) % 360) - 180);
    expect(Math.min(...offsets)).toBeCloseTo(-36, 4);
    expect(Math.max(...offsets)).toBeCloseTo(36, 4);
    tracks.dispose();
  });
  it('is centred on 72 degrees times its index, and moving the light moves it', () => {
    const tracks = buildTracks();
    for (let k = 0; k < DRIVE.sectors; k++) {
      tracks.setSector(k);
      const lit = sectorsOf(tracks.group).filter((s) => s.visible);
      expect(lit.map((s) => s.userData.sector)).toEqual([k]);
      const offsets = polar(lit[0]).bearings.map((b) => ((b - 72 * k + 540) % 360) - 180);
      expect(Math.min(...offsets)).toBeCloseTo(-36, 4);
      expect(Math.max(...offsets)).toBeCloseTo(36, 4);
    }
    tracks.dispose();
  });
  it('hides them all on null, and on an index that names none', () => {
    const tracks = buildTracks();
    for (const index of [null, -1, 5, 1.5, Number.NaN]) {
      tracks.setSector(3);
      tracks.setSector(index);
      expect(sectorsOf(tracks.group).filter((s) => s.visible), String(index)).toHaveLength(0);
    }
    tracks.dispose();
  });
  it('wears signal yellow added to the platter, at 0.32', () => {
    const tracks = buildTracks();
    for (const sector of sectorsOf(tracks.group)) {
      const m = material(sector);
      expect(m.blending).toBe(THREE.AdditiveBlending);
      expect(m.transparent).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.opacity).toBeCloseTo(0.32, 9);
      expect(m.color.getHex()).toBe(palette.yellow);
    }
    tracks.dispose();
  });
  it('faces up, so the camera over the platter sees them', () => {
    const tracks = buildTracks();
    for (const k of [0, 2, 4]) {
      const [x, z] = at(0.6, 72 * k + 10.3);
      const raycaster = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
      const found = raycaster.intersectObject(sectorsOf(tracks.group)[k], false);
      expect(found, `sector ${k}`).toHaveLength(1);
    }
    tracks.dispose();
  });
});

describe('setting the tracks', () => {
  it('lights each ring by its own value, and a hovered one up to HOVER_LIT at least', () => {
    const tracks = buildTracks();
    tracks.set({ funcial: 1, 'jontai-energy': 0.5, 'cookies-clicker': 0.2, next: 0 }, { track: null, index: null }, null);
    const opacity = (id: TrackId): number => material(ringOf(tracks.group, id)).opacity;
    expect(opacity('funcial')).toBe(1);
    expect(opacity('jontai-energy')).toBeCloseTo(0.5, 9);
    expect(opacity('cookies-clicker')).toBeCloseTo(0.2, 9);
    expect(opacity('next')).toBe(0);
    // A dim track under the pointer comes up to HOVER_LIT, however dim (0.5 and 0.2 here), and no other track moves.
    tracks.set({ funcial: 1, 'jontai-energy': 0.5, 'cookies-clicker': 0.2, next: 0.4 }, { track: null, index: null }, 'jontai-energy');
    expect(opacity('jontai-energy')).toBeCloseTo(HOVER_LIT, 9);
    expect(opacity('cookies-clicker')).toBeCloseTo(0.2, 9);
    expect(opacity('next')).toBeCloseTo(0.4, 9);
    tracks.set({ funcial: 1, 'jontai-energy': 0.3, 'cookies-clicker': 0.3, next: 0.3 }, { track: null, index: null }, 'cookies-clicker');
    expect(opacity('cookies-clicker')).toBeCloseTo(HOVER_LIT, 9);
    expect(opacity('jontai-energy')).toBeCloseTo(0.3, 9);
    // One already brighter than that stays as it is: the light is never lowered, and the lit current track is full.
    tracks.set({ funcial: 1, 'jontai-energy': 0.9, 'cookies-clicker': 0.2, next: 0.4 }, { track: null, index: null }, 'jontai-energy');
    expect(opacity('jontai-energy')).toBeCloseTo(0.9, 9);
    tracks.set({ funcial: 1, 'jontai-energy': 0.5, 'cookies-clicker': 0.2, next: 0.4 }, { track: null, index: null }, 'funcial');
    expect(opacity('funcial')).toBe(1);
    expect(opacity('jontai-energy')).toBeCloseTo(0.5, 9);
    tracks.set(all(0.9), { track: null, index: null }, 'next');
    expect(opacity('next')).toBeCloseTo(0.9, 9);
    tracks.dispose();
  });
  it('lights a hovered dim track visibly: well above its own light', () => {
    // The finding this pins: a hover of x1.2 took a dim track from 0.3 to 0.36 and left the lit one at 1, so it read as no change.
    expect(HOVER_LIT).toBeGreaterThanOrEqual(0.6);
    expect(HOVER_LIT).toBeLessThan(1);
    const tracks = buildTracks();
    tracks.set(all(0.3), { track: null, index: null }, 'jontai-energy');
    expect(material(ringOf(tracks.group, 'jontai-energy')).opacity - 0.3).toBeGreaterThan(0.3);
    tracks.dispose();
  });
  it('keeps a dark track dark under the pointer: nothing lights it', () => {
    const tracks = buildTracks();
    tracks.set({ funcial: 1, 'jontai-energy': 0, 'cookies-clicker': 0.3, next: 0.3 }, { track: null, index: null }, 'jontai-energy');
    expect(material(ringOf(tracks.group, 'jontai-energy')).opacity).toBe(0);
    expect(ringOf(tracks.group, 'jontai-energy').visible).toBe(false);
    tracks.dispose();
  });
  it('hides a ring at nothing and shows it again with any light', () => {
    const tracks = buildTracks();
    tracks.set(all(0), { track: null, index: null }, 'funcial');
    for (const id of TRACKS) expect(ringOf(tracks.group, id).visible, id).toBe(false);
    tracks.set(all(0.01), { track: null, index: null }, null);
    for (const id of TRACKS) expect(ringOf(tracks.group, id).visible, id).toBe(true);
    tracks.dispose();
  });
  it('reads a value that is not a number as dark, and one out of range as held to it', () => {
    const tracks = buildTracks();
    tracks.set({ funcial: Number.NaN, 'jontai-energy': -1, 'cookies-clicker': 7, next: Number.POSITIVE_INFINITY }, { track: null, index: null }, null);
    const opacity = (id: TrackId): number => material(ringOf(tracks.group, id)).opacity;
    expect(opacity('funcial')).toBe(0);
    expect(opacity('jontai-energy')).toBe(0);
    expect(opacity('cookies-clicker')).toBe(1);
    expect(opacity('next')).toBe(0);
    tracks.dispose();
  });
  it('glows only the pin under the head, and none between test points', () => {
    const tracks = buildTracks();
    const glowing = (): string[] => pinsOf(tracks.group).filter((p) => material(p).emissiveIntensity > 0).map((p) => p.name);
    expect(glowing()).toEqual([]);
    tracks.set(all(1), { track: 'jontai-energy', index: 2 }, null);
    expect(glowing()).toEqual(['tracks:pin-jontai-energy-2']);
    const pin = material(pinOf(tracks.group, 'jontai-energy', 2));
    expect(pin.emissiveIntensity).toBe(1.6);
    expect(pin.emissive.getHex()).toBe(palette.yellow);
    tracks.set(all(1), { track: 'funcial', index: 0 }, null);
    expect(glowing()).toEqual(['tracks:pin-funcial-0']);
    tracks.set(all(1), { track: 'funcial', index: null }, null);
    expect(glowing()).toEqual([]);
    tracks.set(all(1), { track: null, index: 1 }, null);
    expect(glowing()).toEqual([]);
    // The empty track has no pins to glow.
    tracks.set(all(1), { track: 'next', index: 0 }, null);
    expect(glowing()).toEqual([]);
    tracks.dispose();
  });
  it('changes no material version, and no flag that would recompile one', () => {
    const tracks = buildTracks();
    const state = (): Map<THREE.Material, unknown[]> =>
      new Map(tracks.materials().map((m) => [m, [m.version, m.transparent, m.depthWrite, m.blending, m.side]]));
    const before = state();
    tracks.set(all(1), { track: 'funcial', index: 0 }, null);
    tracks.set(all(0), { track: null, index: null }, 'jontai-energy');
    tracks.set({ funcial: 0.3, 'jontai-energy': 1, 'cookies-clicker': 0, next: 0.5 }, { track: 'cookies-clicker', index: 3 }, 'next');
    tracks.set(all(Number.NaN), { track: 'jontai-energy', index: 1 }, 'funcial');
    for (let k = 0; k < DRIVE.sectors; k++) tracks.setSector(k);
    tracks.setSector(null);
    tracks.setSector(2);
    const after = state();
    before.forEach((was, m) => expect(after.get(m), m.name).toEqual(was));
    tracks.dispose();
  });
});

describe('where a test point is', () => {
  it('is the pin\'s world position, through whatever the group hangs from', () => {
    const tracks = buildTracks();
    const parent = new THREE.Group();
    parent.position.set(0.3, -0.2, 0.7);
    parent.rotation.set(0.4, 1.1, -0.3);
    parent.scale.setScalar(1.5);
    parent.add(tracks.group);
    const target = new THREE.Vector3();
    for (const id of PINNED) {
      for (const k of [0, 1, 2, 3]) {
        const pin = pinOf(tracks.group, id, k);
        const want = pin.getWorldPosition(new THREE.Vector3());
        expect(tracks.pointOf(id, k, target)).toBe(target);
        expect(target.distanceTo(want), `${id} ${k}`).toBeLessThan(1e-9);
      }
    }
    tracks.dispose();
  });
  it('is read from fresh matrices, though nothing has updated them', () => {
    const tracks = buildTracks();
    const parent = new THREE.Group();
    parent.add(tracks.group);
    parent.position.x = 5;
    const target = tracks.pointOf('funcial', 0, new THREE.Vector3());
    expect(target.x).toBeGreaterThan(4);
    tracks.dispose();
  });
  it('is still a point on the empty track, where there is no pin', () => {
    const tracks = buildTracks();
    const target = tracks.pointOf('next', 1, new THREE.Vector3());
    const [x, z] = at(DRIVE.tracks.next, tpBearing('next', 1));
    expect(target.x).toBeCloseTo(x, 9);
    expect(target.z).toBeCloseTo(z, 9);
    expect(target.y).toBeCloseTo(0.001, 9);
    tracks.dispose();
  });
  it('comes under the read head as the platter turns 90 degrees per test point', () => {
    const instrument = buildInstrument();
    const tracks = buildTracks();
    instrument.topPlatter().add(tracks.group);
    const target = new THREE.Vector3();
    const head = new THREE.Vector3();
    for (const id of PINNED) {
      for (const k of [0, 1, 2, 3]) {
        const pose: InstrumentPose = {
          bearing: 0, lift: 0, portrait: 0, threads: 1, head: DRIVE.tracks[id], park: 0, platter: 90 * k,
          drive: { stack: 1, mirror: 1, grow: 1, clamp: 1, arm: 1, chassis: 1 }
        };
        instrument.applyPose(pose);
        instrument.root.updateMatrixWorld(true);
        const local = instrument.dial.worldToLocal(tracks.pointOf(id, k, target).clone());
        const headLocal = instrument.dial.worldToLocal(instrument.headWorld(head).clone());
        expect(local.x, `${id} ${k}`).toBeCloseTo(headLocal.x, 6);
        expect(local.z, `${id} ${k}`).toBeCloseTo(headLocal.z, 6);
        // On the top platter, a little above the face.
        expect(local.y).toBeCloseTo(DRIVE.platter.rise + 0.001, 6);
      }
    }
    tracks.dispose();
    instrument.dispose();
  });
});

describe('the tracks\' parts', () => {
  it('lists every material once, and frees them with the geometries', () => {
    const tracks = buildTracks();
    const listed = tracks.materials();
    expect(new Set(listed).size).toBe(listed.length);
    const used = new Set<THREE.Material>();
    tracks.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) used.add((o as THREE.Mesh).material as THREE.Material); });
    expect(new Set(listed)).toEqual(used);
    const geometries = new Set<THREE.BufferGeometry>();
    tracks.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) geometries.add((o as THREE.Mesh).geometry); });
    let freed = 0;
    geometries.forEach((g) => g.addEventListener('dispose', () => freed++));
    const disposed: THREE.Material[] = [];
    listed.forEach((m) => m.addEventListener('dispose', () => disposed.push(m)));
    const parent = new THREE.Group();
    parent.add(tracks.group);
    tracks.dispose();
    expect(freed).toBe(geometries.size);
    expect(new Set(disposed).size).toBe(listed.length);
    expect(tracks.group.parent).toBeNull();
    expect(() => tracks.dispose()).not.toThrow();
  });
});
