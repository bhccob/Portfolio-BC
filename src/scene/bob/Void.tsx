import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ProjectId } from '~/data/projects';
import { debugBridge } from '~/debug/needleDebug';
import type { CompassModel } from '~/engine/bob/build/compass';
import { buildEngraved, type EngravedModel } from '~/engine/bob/build/engraved';
import type { LightModel } from '~/engine/bob/build/light';
import { buildNebula, type NebulaModel } from '~/engine/bob/build/nebula';
import { buildVoid, VOID_LOOK, type VoidModel } from '~/engine/bob/build/void';
import { buildWorld, type WorldModel } from '~/engine/bob/build/world';
import { lowerTier, type QualityTier } from '~/engine/quality';
import { areasOnPath } from '~/state/chapters';
import { frame, type ObjectOnScreen } from '~/state/frame';
import { useScene, type VoidState } from '~/state/store';
import { showLightFacts } from '~/ui/LightFacts';
import { showsSkip, writeSkip } from '~/ui/SkipButton';
import { showTouchPoints } from '~/ui/TouchPoints';
import { motion } from '../motion';
import { engravedLevels, shaftRings } from './engravedWay';
import type { Handover } from './Home';
import { type LightPose, WORLD_PROJECTS } from './journey';
import { LOOK } from './look';
import { cloudLayout, nebulaLevels } from './nebulaWay';
import { needleFor, needleGlowFor, voidShownAt } from './voidPose';
import { loadVoid, type VoidLoadSteps } from './voidLoad';
import { uploadTextures, warm } from './warm';
import { worldPlaces } from './worldLayout';
import { type WorldPath, worldPathFor } from './worldPath';

/** The longest step the void's clocks take in one frame, seconds: a wake from sleep jumps nothing. */
const MAX_STEP = 0.1;

/** The materials a mesh wears. */
function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** The textures a material holds (its maps and its shader's uniforms), each once. */
function texturesOf(material: THREE.Material): THREE.Texture[] {
  const found = Object.values(material).filter((value): value is THREE.Texture => (value as THREE.Texture | null)?.isTexture === true);
  const uniforms = (material as THREE.ShaderMaterial).uniforms;
  if (uniforms) for (const u of Object.values(uniforms)) if ((u.value as THREE.Texture | null)?.isTexture === true) found.push(u.value as THREE.Texture);
  return [...new Set(found)];
}

/** Every texture the meshes under `root` wear. */
function texturesUnder(root: THREE.Object3D): Set<THREE.Texture> {
  const found = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) for (const material of materialsOf(mesh)) for (const texture of texturesOf(material)) found.add(texture);
  });
  return found;
}

/** The void once built: its model, the tier it stands at, and whether it is shown now (null before the first frame). */
interface SpaceParts {
  model: VoidModel;
  standing: QualityTier;
  shown: boolean | null;
}

/** The hologram world once built, and whether it is shown now (null before the first frame). */
interface WorldParts {
  model: WorldModel;
  shown: boolean | null;
}

/** The Void's running state: plain values, written per frame and by the load. */
interface VoidRun {
  state: VoidState;
  /** The void, from the hand-over on; null before it is built. */
  space: SpaceParts | null;
  /** The hologram world, once built; null before (and for good if it failed). */
  world: WorldParts | null;
  /** The engraved way (the compass's shaft), for the tier it was built at; null before. */
  engraved: { tier: QualityTier; model: EngravedModel } | null;
  /**
   * The nebula (./nebulaWay.ts, ../../engine/bob/build/nebula.ts) for the world's path and the tier it was built for, null
   * before; and the build asked for and not yet made (`asked`), which a later ask for another path or tier, or the
   * unmount, replaces.
   */
  nebula: { world: WorldPath; tier: QualityTier; model: NebulaModel } | null;
  nebulaAsked: { world: WorldPath; tier: QualityTier } | null;
  /** The void's drift clock (its mist and dust), seconds of frames drawn while it showed. */
  time: number;
  /** `<html data-skip>` as last written: the skip button shows (src/ui/SkipButton.tsx). */
  skip: { shown: boolean };
}

/** No screen: the words are taken away. */
const NO_SIZE = { width: 0, height: 0 };

/** The light out: no glow, so its body and its trail are hidden and its lamp is at 0. */
const DARK: LightPose = { position: [0, 0, 0], radius: 0, glow: 0, stretch: 0, yaw: 0, trail: [], trailLevel: 0, filaments: [], sparks: [] };

/** Below this the camera is under the void's glass sky (the previs's SKY_Z, a hair under the ceiling), which shows from there. */
const UNDER_SKY = VOID_LOOK.ceiling.y - 0.1;

const DEG = Math.PI / 180;

/** No project open. */
const NONE_OPEN: Readonly<Record<ProjectId, number>> = {} as Record<ProjectId, number>;

/** Shows or hides the void. */
function showSpace(space: SpaceParts, shown: boolean): void {
  if (space.shown === shown) return;
  space.shown = shown;
  space.model.group.visible = shown;
}

/** Shows or hides the world. */
function showWorld(world: WorldParts, shown: boolean): void {
  if (world.shown === shown) return;
  world.shown = shown;
  world.model.group.visible = shown;
}

// Scratch for the frame: nothing is made per frame.
const lightAt = new THREE.Vector3();
const centre = new THREE.Vector3();
/** The camera's place, for the nebula's bands (scratch, written each frame). */
const eyeAt: [number, number, number] = [0, 0, 0];
/** The light's centre on the screen, NDC: `frame.journey.light` while there is a light. */
const lightPoint = { x: 0, y: 0 };

/** Each project's object on the screen for the proof harness: its click's sphere's middle (CSS px) and radius there. */
function objectsOnScreen(model: WorldModel, camera: THREE.Camera, size: { width: number; height: number }, visible: boolean): ObjectOnScreen[] {
  return model.hits.map((hit) => {
    hit.getWorldPosition(centre);
    const distance = centre.distanceTo(camera.position);
    centre.project(camera);
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const radius = (hit as THREE.Mesh<THREE.SphereGeometry>).geometry.parameters.radius;
    return {
      id: hit.userData.id as string,
      x: ((centre.x + 1) / 2) * size.width,
      y: ((1 - centre.y) / 2) * size.height,
      r: (radius / (distance * Math.tan((fov * DEG) / 2))) * (size.height / 2),
      visible
    };
  });
}

export interface VoidProps {
  /** The compass, whose needle the Void gives to the light (`setNeedleWorld`). */
  compass: CompassModel;
  /** The light the needle becomes in the light dive, the Opening's (built with the loader's parts); the Void poses it. */
  light: LightModel;
  /** The Opening's hand-over: whether the journey is live, and the one pose of this frame (`pose`). */
  handover: Handover;
  /** The ladder's tier now: the void and the world are built at it, the void stepping down with it after, never up. */
  tier: QualityTier;
  /**
   * A click (or tap) on a project on the world: the Opening hands it `openAt` (src/ui/projectOpen.tsx), which opens the
   * project on the world or its page. Without it, a click does nothing.
   */
  onOpen?(id: ProjectId): void;
}

/**
 * The void under the glass and the hologram world below it, on the home's scroll: the light dive's void, then the
 * world's path (spec 2026-10-27-bob-hologram-world-design.md).
 *
 * **Loading.** It mounts with Home, once the compass is there, and does nothing until the home has landed (the first
 * frame `handover.live` is true). Then it runs `loadVoid` (./voidLoad.ts): it builds the void (`buildVoid`) at the
 * ladder's tier at once, warms it and puts it in, so the light dive has its band and its dust from its first frame; then
 * it builds the world (`buildWorld`, its canvases drawn there) and warms it: its textures uploaded and its programs
 * compiled lit and shown, as the scene will draw them, then puts it in, hidden. `voidState` (the store, `frame.journey`,
 * `<html data-void>`) says `loading`, then `ready` with the world in; any throw says `failed` instead, logged as a
 * warning, and the void stays. The home's scroll holds by it (src/scene/bob/landingHold.ts): at the hand-over until the
 * world is ready, and there for good if it failed, where the home's project links show (src/styles/base.css).
 *
 * **Each frame** (after Home's) it applies the Opening's one pose of the frame (`handover.pose`):
 * - the needle (`setNeedleWorld(needleFor(pose))`, ./voidPose.ts) and the light (`LightModel.setPose`), Bob's fact riding
 *   beside it (src/ui/LightFacts.tsx), the skip button (src/ui/SkipButton.tsx), as before;
 * - the void shows from the light dive's frame 20 (`voidShownAt`); its glass sky only from under it and not in the look
 *   back; the fog the path's; its band, mist, dust and stream from the journey's \`void\`, the band and mist giving way to the
 *   nebula's clouds;
 * - the engraved shaft round the fall (./engravedWay.ts) and the nebula round the world (./nebulaWay.ts), built off the
 *   frame for the world's path at this aspect;
 * - the world, with the path: shown from the hand-over on, posed by the path's power, flash and each project's light.
 *
 * **Sleeping.** Nothing on the world moves by itself here: the canvas sleeps whenever the scroll rests.
 *
 * Unmounting frees the void, the world, the shaft and the nebula, gives the needle back and says `idle`.
 */
export function Void({ compass, light, handover, tier }: VoidProps): null {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  // Behind `?proof` the world on the screen is reported to the debug bridge. Asked once, at mount.
  const [proof] = useState(() => debugBridge() !== null);
  const [run] = useState<VoidRun>(() => ({
    state: 'idle',
    space: null,
    world: null,
    engraved: null,
    nebula: null,
    nebulaAsked: null,
    time: 0,
    skip: { shown: false }
  }));
  /** Starts the load, once: set by the mount below, called by the first frame the home has landed. */
  const start = useRef<() => void>(() => {});
  /** The latest props, for the load, which outlives the render that started it. */
  const latest = useRef({ tier });
  useLayoutEffect(() => {
    latest.current = { tier };
  });

  useEffect(() => {
    let disposed = false;

    /** Says where the void stands: the store (the scroll's hold reads it), the debug bridge's journey and <html data-void>. */
    const say = (state: VoidState): void => {
      run.state = state;
      frame.journey.voidState = state;
      document.documentElement.setAttribute('data-void', state);
      useScene.getState().setVoidState(state);
    };

    const steps: VoidLoadSteps<SpaceParts, WorldParts> = {
      // The void, at the hand-over: built, and warmed shown and lit as the scene will draw it, beside the scene.
      buildVoid: async () => {
        const built = latest.current.tier;
        const model = buildVoid(built);
        const holder = new THREE.Group();
        holder.add(model.group);
        model.group.visible = true;
        model.setBand({ shown: true, y: 0.4, sigma: 0.075, strength: 1 }, camera);
        model.setRingMist(0.5);
        model.setDust(1);
        try {
          uploadTextures(gl, texturesUnder(holder));
          await warm(gl, holder, camera, 'the void', scene);
        } catch (error) {
          model.dispose();
          throw error;
        }
        holder.remove(model.group);
        model.setBand({ shown: false, y: 0.4, sigma: 0.075, strength: 0 }, camera);
        model.setRingMist(0);
        model.setDust(0);
        return { model, standing: built, shown: null };
      },
      freeVoid: (space) => space.model.dispose(),
      onVoid: (space) => {
        showSpace(space, false);
        scene.add(space.model.group);
        run.space = space;
        const now = lowerTier(space.standing, latest.current.tier);
        if (now !== space.standing) {
          space.standing = now;
          space.model.setTier(now);
        }
        // A camera already under the glass sees the void now; nothing draws on a page without a scene.
        if (useScene.getState().scene !== null) invalidate();
      },
      // The world: built, and warmed powered and shown as the scene will draw it, beside the scene.
      buildWorld: async () => {
        const model = buildWorld(worldPlaces(areasOnPath()), latest.current.tier);
        const holder = new THREE.Group();
        holder.add(model.group);
        model.pose({ power: 1, flash: 0, clock: 0, levels: Object.fromEntries(WORLD_PROJECTS.map((id) => [id, 1])) as Record<ProjectId, number>, open: NONE_OPEN, float: 0 });
        try {
          uploadTextures(gl, texturesUnder(holder));
          await warm(gl, holder, camera, 'the world', scene);
        } catch (error) {
          model.dispose();
          throw error;
        }
        holder.remove(model.group);
        if (disposed) {
          model.dispose();
          return null;
        }
        return { model, shown: null };
      },
      onWorld: (world) => {
        showWorld(world, false);
        scene.add(world.model.group);
        run.world = world;
        if (useScene.getState().scene !== null) invalidate();
      },
      say,
      gone: () => disposed
    };

    start.current = () => {
      if (run.state !== 'idle' || disposed) return;
      void loadVoid(steps);
    };

    return () => {
      disposed = true;
      start.current = () => {};
      const space = run.space;
      const world = run.world;
      run.space = null;
      run.world = null;
      motion.beads = false;
      showTouchPoints(null, 0);
      showLightFacts(null, NO_SIZE);
      frame.journey.light = null;
      frame.journey.objects = null;
      frame.journey.world = null;
      writeSkip(document.documentElement, false, run.skip);
      compass.setNeedleWorld(null);
      if (space) {
        scene.remove(space.model.group);
        space.model.dispose();
      }
      if (world) {
        scene.remove(world.model.group);
        world.model.dispose();
      }
      const engraved = run.engraved;
      run.engraved = null;
      if (engraved) {
        scene.remove(engraved.model.group);
        engraved.model.dispose();
      }
      const nebula = run.nebula;
      run.nebula = null;
      run.nebulaAsked = null;
      if (nebula) {
        scene.remove(nebula.model.group);
        nebula.model.dispose();
      }
      frame.journey.engraved = null;
      frame.journey.nebula = null;
      say('idle');
      document.documentElement.removeAttribute('data-void');
    };
  }, [gl, scene, camera, invalidate, compass, run]);

  // The ladder steps down while the scene is up: the void sheds its ring of mist and dust, in place; never back up.
  useEffect(() => {
    const space = run.space;
    if (!space) return;
    const to = lowerTier(space.standing, tier);
    if (to === space.standing) return;
    space.standing = to;
    space.model.setTier(to);
    invalidate();
  }, [tier, invalidate, run]);

  useFrame(({ size }, delta) => {
    const pose = handover.pose;
    const space = run.space;
    const world = run.world;
    if (!handover.live || pose === null) {
      // The Opening poses the scene itself (the loader, a held seek): the needle is the armillary's, the void is not there.
      compass.setNeedleWorld(null);
      light.setPose(DARK, camera);
      frame.journey.light = null;
      showLightFacts(null, size);
      writeSkip(document.documentElement, false, run.skip);
      if (space) showSpace(space, false);
      if (world) showWorld(world, false);
      if (run.engraved) run.engraved.model.group.visible = false;
      if (run.nebula) run.nebula.model.group.visible = false;
      frame.journey.engraved = null;
      frame.journey.nebula = null;
      frame.journey.objects = null;
      frame.journey.world = null;
      motion.beads = false;
      showTouchPoints(null, size.width);
      return;
    }
    // The home has landed: the void loads now, once.
    start.current();
    // The needle gives itself to the light as it ignites (way frames 2-8); the compass holds it on the rise.
    compass.setNeedleWorld(needleFor(pose));
    const glow = needleGlowFor(pose.at);
    if (glow !== null) compass.setNeedleGlow(glow);
    camera.updateMatrixWorld();
    light.setPose(pose.light ?? DARK, camera);
    // The light's centre on the screen (for the debug bridge too), and the fact riding with it.
    if (pose.light !== null) {
      lightAt.set(...pose.light.position).project(camera);
      lightPoint.x = lightAt.x;
      lightPoint.y = lightAt.y;
      frame.journey.light = lightPoint;
    } else {
      frame.journey.light = null;
    }
    const fact = pose.fact;
    if (pose.light !== null && fact !== null && fact.index !== null && fact.side !== null) {
      showLightFacts({ index: fact.index, side: fact.side, opacity: fact.opacity, glow: pose.light.glow, light: lightPoint }, size);
    } else {
      showLightFacts(null, size);
    }
    // The skip button, from the world's stop through the look back on the home page, and not while a project is close or
    // the camera flies to one.
    writeSkip(document.documentElement, useScene.getState().scene === 'home' && !handover.focus && showsSkip(pose), run.skip);
    showTouchPoints(null, size.width);
    motion.beads = false;
    if (!space) return;

    const shown = voidShownAt(pose);
    showSpace(space, shown);
    const path = pose.path;
    // The glass sky only from under it, and not in the look back, which looks up toward it.
    space.model.setSky((path?.sky ?? true) && camera.position.y < UNDER_SKY);
    // The fog the path's (it draws back as the camera pulls back), the studio's own before it.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = path?.fog.near ?? LOOK.fog.near;
      scene.fog.far = path?.fog.far ?? LOOK.fog.far;
    }
    const reduced = useScene.getState().reducedMotion;
    // The engraved shaft round the fall, as the pose has it, glowing near the light.
    const engraved = engravedFor();
    const levels = engravedLevels(pose.at);
    engraved.model.update(levels, pose.light?.position ?? null, scene.fog instanceof THREE.Fog ? scene.fog : LOOK.fog);
    if (proof) frame.journey.engraved = levels;
    // The nebula round the world at this aspect, as the pose has it (./nebulaWay.ts); the void's own violet band and ring
    // of mist give way to it.
    const clouds = nebulaLevels(pose.at, path);
    camera.position.toArray(eyeAt);
    nebulaFor(worldPathFor(size.width / Math.max(size.height, 1)))?.update(clouds, handover.shown, eyeAt);
    if (proof) frame.journey.nebula = clouds;

    // The world, with the path: its power, its flash and each project's light.
    if (world) {
      const on = shown && path !== null;
      showWorld(world, on);
      if (on) world.model.pose({ power: path.power, flash: path.flash, clock: 0, levels: path.levels, open: NONE_OPEN, float: 0 });
      if (proof) {
        world.model.group.updateMatrixWorld();
        frame.journey.objects = on ? objectsOnScreen(world.model, camera, size, true) : null;
      }
    }
    if (proof) frame.journey.world = path ? { power: path.power, names: path.names, caption: path.caption ? { ...path.caption } : null, dots: path.dots } : null;
    if (!shown) return;
    const dt = Math.min(Math.max(delta, 0), MAX_STEP);

    // The void from the journey: the band held to the camera, the ring of mist, the dust's glow and the stream; and its
    // slow drift.
    const v = pose.void;
    const giving = 1 - clouds.clouds;
    space.model.setBand({ shown: v !== null, y: v?.bandY ?? 0, sigma: v?.bandSigma ?? 0, strength: (v?.band ?? 0) * giving, distance: v?.bandDistance }, camera);
    space.model.setRingMist((v?.ringMist ?? 0) * giving);
    space.model.setDust(v?.dust ?? 0);
    space.model.setStream(v?.stream ?? 0);
    if (!reduced) run.time += dt;
    space.model.setTime(run.time);
  });

  /**
   * The nebula for the world's path `world` at the ladder's tier, or the last one built while it is being made (null
   * before the first): its build is asked for on the first frame that needs it and made apart from the frame (a timeout),
   * so its textures and its points never stall a frame of the scroll; it is needed only from the fall's frame 50, seconds
   * of scrolling after the landing. A new path (a new aspect) or a lower tier asks for it afresh, and the new one takes the
   * old one's place, which is freed.
   */
  function nebulaFor(world: WorldPath): NebulaModel | null {
    const kept = run.nebula;
    if (kept && kept.world === world && kept.tier === tier) return kept.model;
    const asked = run.nebulaAsked;
    if (!asked || asked.world !== world || asked.tier !== tier) {
      const ask = { world, tier };
      run.nebulaAsked = ask;
      setTimeout(() => {
        if (run.nebulaAsked !== ask) return;
        run.nebulaAsked = null;
        const made = { world, tier: ask.tier, model: buildNebula(cloudLayout(world, ask.tier), world.centre, ask.tier) };
        const old = run.nebula;
        if (old) {
          scene.remove(old.model.group);
          old.model.dispose();
        }
        scene.add(made.model.group);
        void warm(gl, made.model.group, camera, 'the nebula', scene);
        run.nebula = made;
        invalidate();
      }, 0);
    }
    return kept?.model ?? null;
  }

  /** The engraved shaft at the ladder's tier, built afresh for a lower tier. */
  function engravedFor(): NonNullable<VoidRun['engraved']> {
    const kept = run.engraved;
    if (kept && kept.tier === tier) return kept;
    if (kept) {
      scene.remove(kept.model.group);
      kept.model.dispose();
    }
    const made = { tier, model: buildEngraved(shaftRings(), [], tier) };
    scene.add(made.model.group);
    // Built at the home, hidden until the light ignites: its shaders compiled now, so that frame does not stall.
    void warm(gl, made.model.group, camera, 'the engraved way', scene);
    run.engraved = made;
    return made;
  }
  return null;
}
