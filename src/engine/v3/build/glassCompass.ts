/**
 * The v3 compass's glass as three.js objects: four rings of dark smoked glass,
 * each floating at its own height over the chip city with its own band of the
 * luopan engraved in gold on its top, and the small gold boss at the hub the
 * needle stands over (spec §2.2, frame 05). The rings' measurements are Task
 * 1's (compassSpec) and the engraving is Task 9's masks (paintRings), which
 * the Stage paints and hands in as textures, so this module never makes a
 * canvas and the node tests can build it. No React: Task 12a mounts the group
 * and fades it in at the end of the loader's circuit.
 */
import * as THREE from 'three';
import { buildAnnulus } from '~/engine/instrument/Annulus';
import { palette } from '~/engine/palette';
import { CHIP } from '~/engine/v3/chipSpec';
import { GLASS_RINGS, HUB, type GlassRing, type RingId } from '~/engine/v3/compassSpec';

/** The chip's top face, where the hub's stem stands. */
const CHIP_TOP = CHIP.board + CHIP.height;

/**
 * How the glass and the gold look.
 *
 * - `glass`: smoked glass in the palette's near-black violet, glossy
 *   (roughness 0.08) and seen through at `opacity`, its reflections of the
 *   room damped by `envMapIntensity` (Task 14b: low, as the home's camera now
 *   sees the glass at a grazing angle, where it mirrors most, and a stronger
 *   sheen laid a lavender veil over the city under it). It has a clearcoat on
 *   the quality ladder's rungs that keep one (`setClearcoat`), and no
 *   transmission: that would cost a second render of the scene and brighten
 *   what lies under the glass.
 * - `gold`: the engraving on each ring's top, metal gold that the room's light
 *   cards catch, with a little light of its own (`emissive`, at most 0.15) so
 *   the marks still read where the room is dark. It lies `lift` over the glass
 *   so the two never fight for a pixel. `anisotropy` keeps the fine ticks
 *   sharp across a ring seen nearly edge on, as the home's low camera sees it
 *   (three holds it to what the GPU allows). Each ring's gold shows at its
 *   own `level` (its opacity once formed), brightest at the hub and dimmest
 *   on the wide hexagram ring nearest the camera (Task 14b): seen low and
 *   close, that ring's marks fill the foreground, and at full strength they
 *   drew the eye from the needle, the one focal point (spec §4).
 * - `hub`: the boss turned from `profile` (radius, height), its stem standing
 *   on the chip and its top at `HUB.y`, under the needle's pivot; far narrower
 *   than the hub's own radius, so the chip around it shows.
 * - `segments`: steps round every ring. Even, so the walls' rims and the
 *   tops' edges (the Annulus starts at north, three's lathe at +Z) fall on the
 *   same points of the circle and meet without a crack.
 */
export const GLASS_LOOK = {
  glass: { colour: palette.glass, roughness: 0.08, opacity: 0.55, envMapIntensity: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 },
  gold: {
    colour: palette.gold,
    metalness: 1,
    roughness: 0.32,
    emissive: 0.08,
    lift: 0.0004,
    anisotropy: 4,
    level: { trigram: 1, direction: 0.95, degree: 0.8, hexagram: 0.55 }
  },
  hub: {
    roughness: 0.3,
    emissive: 0.1,
    profile: [
      [0, CHIP_TOP],
      [0.014, CHIP_TOP],
      [0.014, -0.032],
      [0.026, -0.026],
      [0.058, -0.018],
      [0.062, -0.012],
      [0.05, -0.008],
      [0.05, 0.028],
      [0.056, 0.032],
      [0.056, 0.039],
      [0.047, 0.043],
      [0.04, HUB.y],
      [0, HUB.y]
    ] as readonly (readonly [radius: number, height: number])[]
  },
  segments: 256
} as const;

/** The glass compass as the scene holds it. */
export interface GlassCompassModel {
  /**
   * In the dial's frame, the compass's centre at the origin: the `hub` and,
   * for each ring, its walls `glass:ring:<id>` (with its top `glass:top:<id>`
   * as a child) and its gold `gold:ring:<id>`. A ring's walls and gold are
   * siblings, so a later milestone that opens the rings moves the two
   * together.
   */
  group: THREE.Group;
  /**
   * Engraves each ring with its mask: Task 9's strip as a texture, white marks
   * on transparent, which this sets up to wrap round north and to be read as
   * data. Until a ring has its mask its gold shows nothing. The textures stay
   * the caller's: `dispose` leaves them.
   */
  setRingMasks(masks: Readonly<Record<RingId, THREE.Texture>>): void;
  /**
   * Fades the glass, the gold and the hub in, 0..1 (NaN reads as 0): 0 at the
   * end of the loader's circuit draws nothing at all, 1 is the home. Uniforms
   * only, so a frame of the fade compiles nothing.
   */
  setFormed(t: number): void;
  /** The glass's clearcoat, as the quality ladder's rung says: three compiles the glass once more when it changes. */
  setClearcoat(on: boolean): void;
  /** Frees every geometry, material and texture the compass made; not the masks it was handed. */
  dispose(): void;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/**
 * A ring's walls as a profile for three's lathe, in the ring's own frame (its
 * mid-plane at y = 0): down the inner wall, out along the bottom, up the outer
 * wall, so every face looks out of the solid. The top is left open for the
 * Annulus that carries the engraving. Each corner is given twice, because the
 * lathe averages the normals of the two sides meeting at a point: doubled,
 * each side keeps its own and the glass's edges stay sharp (the zero-length
 * step between the two leaves a strip that draws nothing).
 */
function wallProfile(ring: GlassRing): THREE.Vector2[] {
  const half = ring.thickness / 2;
  return [
    new THREE.Vector2(ring.inner, half),
    new THREE.Vector2(ring.inner, -half),
    new THREE.Vector2(ring.inner, -half),
    new THREE.Vector2(ring.outer, -half),
    new THREE.Vector2(ring.outer, -half),
    new THREE.Vector2(ring.outer, half)
  ];
}

/**
 * A lathe of `profile`, its normals made unit length: three's lathe leaves
 * the last point's normal as long as the profile's last step, which the tests
 * and anything else reading the buffer would trip on.
 */
function lathe(profile: THREE.Vector2[], segments: number): THREE.LatheGeometry {
  const geometry = new THREE.LatheGeometry(profile, segments);
  geometry.normalizeNormals();
  return geometry;
}

/**
 * three's alphaMap reads the mask's green channel. The masks are white marks
 * on transparent canvases, and a canvas is uploaded un-premultiplied, so an
 * anti-aliased edge pixel arrives as full white at part alpha: read as green,
 * every edge would be opaque and the marks would come out bold. This reads
 * the alpha channel, the mark's real coverage, instead.
 */
function readMaskAlpha(shader: { fragmentShader: string }): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <alphamap_fragment>',
    ['#ifdef USE_ALPHAMAP', '\tdiffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).a;', '#endif'].join('\n')
  );
}

/**
 * Where ring `index` (of GLASS_RINGS, inside out) starts in the compass's draw
 * order; its walls draw at this order, its top at the next and its gold at
 * the one after. The hub is 0, before every ring (see buildGlassCompass).
 */
function ringOrder(index: number): number {
  return 1 + 3 * (GLASS_RINGS.length - 1 - index);
}

/**
 * Builds the compass formed, as the home shows it (the opening fades it in
 * from `setFormed(0)`), with the clearcoat on, and its gold blank until
 * `setRingMasks`.
 *
 * The glass is seen through and writes no depth, so what draws first matters,
 * and three sorts see-through objects by their centres, which for rings round
 * one axis are all but equal. The order is therefore set: the hub first (it
 * is solid and writes depth, so glass behind it is hidden and glass in front
 * of it lies over it), then the rings from the outermost (the lowest, which
 * the higher inner rings stand over) in, and within a ring its walls (the far
 * inner wall is seen through the top), its top, then its gold on the top.
 * These orders sort within the compass's group, which no group interrupts.
 *
 * The gold starts with a blank mask of its own, so its program is compiled
 * with an alpha map from the first frame and the real masks arrive as
 * uniforms, compiling nothing.
 */
export function buildGlassCompass(): GlassCompassModel {
  const group = new THREE.Group();
  group.name = 'glass-compass';
  const look = GLASS_LOOK;

  const glass = new THREE.MeshPhysicalMaterial({
    name: 'glass',
    color: look.glass.colour,
    metalness: 0,
    roughness: look.glass.roughness,
    transparent: true,
    opacity: look.glass.opacity,
    envMapIntensity: look.glass.envMapIntensity,
    clearcoat: look.glass.clearcoat,
    clearcoatRoughness: look.glass.clearcoatRoughness,
    depthWrite: false
  });

  // One transparent texel: the gold's mask until the real ones come.
  const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  blank.name = 'glass:mask:blank';
  blank.needsUpdate = true;

  const hubGeometry = lathe(
    look.hub.profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
    64
  );
  const hubMaterial = new THREE.MeshStandardMaterial({
    name: 'hub',
    color: look.gold.colour,
    metalness: look.gold.metalness,
    roughness: look.hub.roughness,
    emissive: look.gold.colour,
    emissiveIntensity: look.hub.emissive,
    // Faded in with the glass; solid once formed, so it still writes depth.
    transparent: true
  });
  const hub = new THREE.Mesh(hubGeometry, hubMaterial);
  hub.name = 'hub';
  hub.renderOrder = 0;
  group.add(hub);

  const rings = GLASS_RINGS.map((ring, index) => {
    const order = ringOrder(index);
    const walls = new THREE.Mesh(lathe(wallProfile(ring), look.segments), glass);
    walls.name = `glass:ring:${ring.id}`;
    walls.position.y = ring.y;
    walls.renderOrder = order;

    const top = buildAnnulus({ inner: ring.inner, outer: ring.outer, uv: 'polar', segments: look.segments, material: glass }).mesh;
    top.name = `glass:top:${ring.id}`;
    top.position.y = ring.thickness / 2;
    top.renderOrder = order + 1;
    walls.add(top);

    const goldMaterial = new THREE.MeshStandardMaterial({
      name: `gold:ring:${ring.id}`,
      color: look.gold.colour,
      metalness: look.gold.metalness,
      roughness: look.gold.roughness,
      emissive: look.gold.colour,
      emissiveIntensity: look.gold.emissive,
      alphaMap: blank,
      opacity: look.gold.level[ring.id],
      transparent: true,
      depthWrite: false
    });
    goldMaterial.onBeforeCompile = readMaskAlpha;
    goldMaterial.customProgramCacheKey = () => 'gold:ring';
    // The top's own surface, a hair above it.
    const gold = new THREE.Mesh(top.geometry, goldMaterial);
    gold.name = `gold:ring:${ring.id}`;
    gold.position.y = ring.y + ring.thickness / 2 + look.gold.lift;
    gold.renderOrder = order + 2;

    group.add(walls, gold);
    return { id: ring.id, walls, top, gold: goldMaterial };
  });

  return {
    group,
    setRingMasks(masks) {
      for (const ring of rings) {
        const mask = masks[ring.id];
        if (!mask) continue;
        // Marks that cross north are painted at both ends of the strip; the strip only tiles if it repeats round.
        mask.wrapS = THREE.RepeatWrapping;
        mask.wrapT = THREE.ClampToEdgeWrapping;
        // Coverage, not a colour: nothing to decode.
        mask.colorSpace = THREE.NoColorSpace;
        mask.anisotropy = Math.max(mask.anisotropy, look.gold.anisotropy);
        mask.needsUpdate = true;
        ring.gold.alphaMap = mask;
      }
    },
    setFormed(t) {
      // Called every frame of the fade: indexed loops, so it makes no iterator.
      const formed = clamp01(t);
      glass.opacity = look.glass.opacity * formed;
      hubMaterial.opacity = formed;
      for (let i = 0; i < rings.length; i++) rings[i].gold.opacity = formed * look.gold.level[rings[i].id];
      // Unformed, nothing draws: the loader pays nothing for the compass. three compiles hidden objects all the same.
      const children = group.children;
      for (let i = 0; i < children.length; i++) children[i].visible = formed > 0;
    },
    setClearcoat(on) {
      glass.clearcoat = on ? look.glass.clearcoat : 0;
    },
    dispose() {
      hubGeometry.dispose();
      hubMaterial.dispose();
      glass.dispose();
      blank.dispose();
      for (const ring of rings) {
        ring.walls.geometry.dispose();
        ring.top.geometry.dispose();
        ring.gold.dispose();
      }
    }
  };
}
