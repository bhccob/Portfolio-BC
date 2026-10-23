/**
 * The armillary compass as the home shows it: the GLB from Blender
 * (public/models/bob-compass.glb, tools/blender/export_compass.py) with its
 * materials applied here, since the file carries geometry, UVs and the rise
 * and no materials (spec §2.2). Four bands of smoked violet glass, each
 * engraved with its own strip (~/engine/bob/paintBand), turn slowly on their
 * own axes round a gold needle, pivot and axis, and the whole armillary rises
 * out of the opening along the file's `rise` clip. As the visitor scrolls, the
 * bands open like an iris and the needle turns down into the tunnel (`setIris`,
 * `setNeedleDip`, the preview's tools/blender/bob_scroll.py). No React: the
 * Opening and the Home (Task 10) mount the group and pose it through the setters.
 *
 * Lengths are world units. The armillary rests at the origin in the file;
 * `setRise` puts it `COMPASS_LOOK.homeY` above the glass at home. The camera
 * sits at +z looking toward -z, so a turn about +Z is anticlockwise on screen.
 */
import * as THREE from 'three';
import { BAND_STRIP, paintBandStrip } from '~/engine/bob/paintBand';
import { palette } from '~/engine/palette';
import { lowerTier, type QualityTier } from '~/engine/quality';
import type { NeedleOverride } from '~/scene/bob/journey';

/**
 * How the compass looks and turns. Task 12 tuned the numbers against the
 * Blender preview's stills (docs/design/bob-compass/p01-p05) under the
 * luminance gate; each change says why.
 *
 * - `bandGlass`: the bands' smoked glass, the palette's lilac, seen through
 *   by physical transmission (`transmission`, by tier: all of it on high, 0.6
 *   on medium), glossy (`roughness`), refracting as glass (`ior`) through the
 *   band's own `thickness`, with a thin-film sheen (`iridescence`) and a faint
 *   violet light of its own (the haze, `emissive` at `emissiveIntensity`) so a
 *   band still reads where the room gives it nothing to transmit. The low tier
 *   has no transmission, so no transmission pass runs (Ruling 16): its glass is
 *   plain see-through glass of the same tint at `opacity`. Task 12: the
 *   preview's glass is a pale lavender (base (0.52, 0.4, 0.86), lilac is the
 *   nearest token) glowing a blue violet (0.42, 0.26, 0.9), and reads as smoked
 *   slate-violet; the palette's violet tinted the bands a deep magenta purple.
 * - `bandMarks`: the engraving, the palette's gold light at `intensity`, lit
 *   where the painted strip covers the band (it is the band glass's emissive
 *   map, see `patchMarks`), read at `anisotropy` so the fine ticks stay sharp
 *   on a band seen edge on, as v3's gold did. Task 12: the hot amber at 1.6 read
 *   as bright orange marks, where the preview's are gold at a quarter of the
 *   letters' strength (emission 0.45 against 3.0).
 * - `gold`: the rims, the needle, the pivot and the axis, one brass metal,
 *   with a faint light of its own (`emissive` at `emissiveIntensity`, the
 *   preview's needle 0.15 and rims 0.25): metal shows only its reflections, and
 *   seen against the dark room the needle read black where the preview's is
 *   gold (Task 12). At 0.22 the needle reads gold rather than khaki; the
 *   preview's broad warm key does the rest of that there.
 * - `homeY`: the armillary's height over the glass at home (the preview's
 *   ARM_Z), added to the clip's own height, which ends at 0.
 * - `spin`: band `k` (0 for band_1 up to 3 for band_4) turns at `base` +
 *   `step` * k degrees a second about its own axis, band_1 one way and each
 *   next band the other, as the preview's rings do (tools/blender/bob_animate.py
 *   turns them (0.25 + 0.1k) degrees a frame, four times this pace; Ruling 17).
 * - `iris`: the scroll's opening (`setIris`), the preview's (tools/blender/bob_scroll.py): band `k` lies flat, turned
 *   `k` × `turn` radians about the up, and widens in its own plane until the middle of its wall is `radii[k]` from the
 *   axis (the preview's IRIS_R), and the armillary sinks to `flatY` above the glass (its ARM_FLAT_Z).
 */
export const COMPASS_LOOK = {
  bandGlass: {
    colour: palette.lilac,
    transmission: { high: 1, medium: 0.6, low: 0 },
    opacity: { high: 1, medium: 1, low: 0.35 },
    roughness: 0.04,
    ior: 1.5,
    thickness: 0.045,
    iridescence: 0.35,
    emissive: palette.haze,
    emissiveIntensity: 0.06
  },
  bandMarks: { colour: palette.goldLight, intensity: 0.6, anisotropy: 4 },
  gold: { colour: palette.brass, metalness: 1, roughness: 0.22, emissive: palette.goldLight, emissiveIntensity: 0.22 },
  homeY: 0.55,
  spin: { base: 1.5, step: 0.6 },
  iris: { radii: [1.66, 1.74, 1.82, 1.9], turn: 0.4, flatY: 0.09 }
} as const;

/** The GLB's parts, each a node `loadCompass` needs: the armillary, its four bands, their rims, the needle, the pivot and the axis. */
export const COMPASS_PARTS = ['armillary', 'band_1', 'band_2', 'band_3', 'band_4', 'rim_1', 'rim_2', 'rim_3', 'rim_4', 'needle', 'pivot', 'axis'] as const;

/** The compass as the scene holds it. */
export interface CompassModel {
  /**
   * `compass`: the armillary (`armillary`, from the GLB) with its bands
   * `band_1`..`band_4` (each holding its `rim_k`), the `needle`, the `pivot`
   * and the `axis`. Built at home: risen, shown, the needle up the screen and
   * the bands at rest.
   *
   * While the bands are drawn on the high and medium tiers, their
   * transmission costs three a second render of the opaque scene every frame,
   * so the group is best hidden while the opening is shut over it.
   */
  group: THREE.Group;
  /**
   * The gold pivot the needle turns on (`pivot`), at the armillary's origin: where the home aims the needle from. It
   * goes with the needle while `setNeedleWorld` holds it out of the armillary.
   */
  pivot: THREE.Object3D;
  /**
   * Poses the rise, 0..1 (NaN reads as 0): the `rise` clip at `t` of its length, the armillary `homeY` higher. 0 is
   * 2.7 below the glass, 1 is home. An open iris (`setIris`) sinks the armillary from there.
   */
  setRise(t: number): void;
  /**
   * Turns every band by its own pace over `time` seconds (NaN reads as 0), about its own axis, on top of the pose the
   * iris gives it (its rest, at an iris of 0); the same time is the same picture.
   */
  setSpin(time: number): void;
  /**
   * Opens the compass like an iris, 0..1 (NaN reads as 0), eased by smoothstep. Each band swings from its rest to
   * lying flat, its own Y on the armillary's up (the world's: the rise turns the armillary about the up alone) and
   * turned k × `look.iris.turn` about it, and widens in its own plane from its rest to `look.iris.radii[k]`; the
   * armillary sinks from the height the rise gives it to `look.iris.flatY` above the glass. 0 is exactly the rest.
   * The spin keeps turning each band in its own plane, and the rise and the iris compose in either order.
   */
  setIris(t: number): void;
  /**
   * Turns the needle to `angle` radians about the view axis, the world's Z,
   * whatever the rise has turned the armillary to: 0 up the screen, positive
   * clockwise as the camera sees it. A value that is not finite reads as 0.
   * `setRise` keeps the needle at its angle as it turns the armillary; a move
   * of the group itself is taken up at the next call.
   */
  setNeedle(angle: number): void;
  /**
   * Turns the needle down into the tunnel, 0..1 (NaN reads as 0), eased by smoothstep: its world pose goes, at a
   * steady turn about one world axis, from the one `setNeedle` gives to its up pose turned half about the world's X,
   * the tip on the world's down, as the preview's needle ends. The tip swings toward the camera on the way, as the
   * preview's does, the same way whatever the angle, so an aim that moves mid-dip moves the needle smoothly; one that
   * moves across straight down while it dips goes on round, the roll unflipped. 0 is exactly the `setNeedle` pose;
   * `setNeedle` and `setRise` keep the dip.
   */
  setNeedleDip(t: number): void;
  /**
   * Takes the needle out of the armillary into the world (M2b's dive and void: it leads the camera down through the
   * O, grows, and points at the beads), or gives it back with `null`.
   *
   * An override puts the needle's origin, the point it turns about, at `position` in world coordinates and its size
   * at `scale` times its own, and turns its tip (+Y) toward the world point `aim`, or straight down when `aim` is
   * null (or on the position itself, which has no direction). The pivot goes with it, to the same position and
   * size, as the preview's does (tools/blender/bob_scroll.py moves `bob_pivot` with `bob_needle`); the bands, rims
   * and axis stay in the armillary. It is a pose in the world, whatever the group or the armillary is doing.
   *
   * The roll is the dipped needle's. With `aim` null the needle stands exactly as `setNeedleDip(1)` leaves it at the
   * rise's end (the up pose turned half about the world's X, whatever `setNeedle` said), so the override at the
   * dive's start, (0, 0.09, 0) at scale 1, takes over from the armillary's needle with no jump in position, size or
   * roll. An aim turns it from there by the shortest arc from straight down, so the roll keeps still as the aim
   * leaves straight down along any great circle; the one aim with no such arc is straight up the world from the
   * pivot, where the roll is arbitrary.
   *
   * **Which wins.** The override, while it is set. `setNeedle`, `setNeedleDip`, `setRise` and `setIris` go on
   * recording their values (and the armillary goes on moving under the needle), and the needle holds its place in
   * the world through them; `null` poses the needle and the pivot from what they recorded, exactly as a compass
   * that never had an override would have them. `null` with no override set changes nothing, so it may be handed in
   * every frame of the rise.
   *
   * A value that is not finite reads as 0 (as 1 for `scale`); an `aim` with such a component reads as null.
   * Scratch only: no allocation, and the override is copied, never kept.
   */
  setNeedleWorld(override: NeedleOverride | null): void;
  /**
   * The needle's glow as a share of its rest (`look.gold.emissiveIntensity`):
   * the home's breath (~/scene/bob/look `needleGlowAt`). The needle wears a
   * brass of its own for it, so the rims, the pivot and the axis hold still.
   * A value that is not finite, or below 0, reads as 1.
   */
  setNeedleGlow(level: number): void;
  /**
   * Fades the whole compass in, 0..1 (NaN reads as 0), for the quick and
   * reduced paths: opacity only, so a frame of the fade compiles nothing. At 0
   * nothing is drawn.
   */
  setReveal(level: number): void;
  /**
   * Steps the bands' glass down to `tier`'s (the quality ladder's step, Ruling 25), as a compass built for it would
   * have: its transmission, its opacity (at the reveal it shows) and whether it writes depth. Dropping to the low tier
   * turns transmission off, so the bands compile once more and three runs no transmission pass after it (Ruling 16);
   * medium only lowers the transmission. A tier above the one it stands at changes nothing: the ladder never climbs
   * back within a page view.
   */
  setTier(tier: QualityTier): void;
  /** Frees the materials it made and the strips it asked for; the glTF's geometries stay the loader's. */
  dispose(): void;
}

/** `x` held to [0, 1]; NaN reads as 0. */
function clamp01(x: number): number {
  return x > 0 ? (x < 1 ? x : 1) : 0;
}

/** `x`, or `fallback` when it is not a finite number. */
function finiteOr(x: number, fallback: number): number {
  return Number.isFinite(x) ? x : fallback;
}

/** `x` held to [0, 1] and eased in and out, 3x² - 2x³ (the preview's ease_io); NaN reads as 0. */
function smoothstep01(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

/**
 * A band's radius in its own plane, its local XZ (each band lies round its local Y): midway between the farthest and
 * the nearest of its vertices from that axis, so the middle of its wall, where its rim runs and the radius the
 * preview's rings are made with (export_compass.py's RINGS). The bounding sphere would read the band's height in too
 * (1.545 for band_1's 1.52), and the bounding box only its outer wall (1.5425). Read once, at load.
 */
function ringRadius(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  let outer = 0;
  let inner = Infinity;
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i));
    if (r > outer) outer = r;
    if (r < inner) inner = r;
  }
  return (outer + inner) / 2;
}

/**
 * A band's strip, painted: a canvas of BAND_STRIP's size with band `band`'s
 * engraving (0..3 for band_1..band_4, as paintBandStrip numbers them) as a
 * texture, for `loadCompass`'s `strip`. The canvas is the browser's unless one
 * is handed in.
 *
 * The texture keeps three's default `flipY` (see `loadCompass`).
 *
 * @throws TypeError when the canvas gives no 2D context.
 */
export function bandStrip(band: number, canvas: HTMLCanvasElement = document.createElement('canvas')): THREE.CanvasTexture {
  canvas.width = BAND_STRIP.width;
  canvas.height = BAND_STRIP.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new TypeError('the band strip needs a 2D canvas context, and the canvas gave none');
  paintBandStrip(ctx, band);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `compass:strip:${band}`;
  return texture;
}

/**
 * The marks ride on the band glass itself, as its emissive map: one surface
 * has one emissive colour, so three's own `emissivemap_fragment` (which
 * multiplies the glass's violet by the map) is replaced by adding the marks'
 * gold light where the strip covers the band. Coverage is the strip's alpha: the
 * canvas is uploaded un-premultiplied, so an anti-aliased edge pixel arrives
 * as full white at part alpha, and its colour would draw every mark bold (the
 * same reason v3's gold read its masks' alpha).
 *
 * Where a mark covers the band, its alpha is raised from the glass's own
 * opacity to the reveal (`uReveal`), so the low tier's thin glass (0.35) still
 * shows its engraving whole. On the other tiers the glass's opacity is the
 * reveal, and the raise changes nothing.
 */
function patchMarks(marks: THREE.IUniform<THREE.Color>, reveal: THREE.IUniform<number>) {
  return (shader: { uniforms: Record<string, THREE.IUniform>; fragmentShader: string }): void => {
    shader.uniforms.uMarks = marks;
    shader.uniforms.uReveal = reveal;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uMarks;\nuniform float uReveal;')
      .replace(
        '#include <emissivemap_fragment>',
        [
          '#ifdef USE_EMISSIVEMAP',
          '\tfloat markCover = texture2D( emissiveMap, vEmissiveMapUv ).a;',
          '\ttotalEmissiveRadiance += uMarks * markCover;',
          '\tdiffuseColor.a = mix( diffuseColor.a, uReveal, markCover );',
          '#endif'
        ].join('\n')
      );
  };
}

/**
 * Readies a strip for its band. The GLB's v runs from 0 at a band's bottom
 * edge to 1 at its top (export_compass.py writes it so, and GLTFLoader keeps
 * the file's UVs as they are). The painter puts v at canvas y = (1 - v) *
 * height, so the band's bottom (v = 0) is the canvas's last row. A texture
 * uploaded with `flipY` puts the canvas's last row at v = 0, so the strip
 * must keep flipY on. GLTFLoader turns flipY off on the textures it loads
 * (glTF's v runs down the image), and with it off here every band would wear
 * its engraving upside down: the ticks along the bottom edge. It is set
 * outright, whatever the texture came with, and uploaded again.
 */
function readyStrip(texture: THREE.Texture): void {
  texture.flipY = true;
  // u runs once round the band, and a mark crossing 0 degrees is painted at both ends of the strip.
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Coverage, not a colour: nothing to decode.
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = Math.max(texture.anisotropy, COMPASS_LOOK.bandMarks.anisotropy);
  texture.needsUpdate = true;
}

/**
 * The compass from the glTF GLTFLoader (or drei's useGLTF) handed over, with
 * every material applied for `tier`, built at home. `strip(i)` is called once
 * for each band, i = 0..3 for band_1..band_4, and the compass owns the
 * texture it returns: in the browser `bandStrip`, a painted canvas; in a test,
 * a stub. Only the high tier sees all the way through the glass, and the low
 * tier's glass has no transmission at all.
 *
 * The glTF's scene is copied, sharing its geometries, so a cached model (drei
 * keeps one per URL) builds the same compass every time: the spin, the needle
 * and the rise move the copy, and the rest poses are read from the file's.
 *
 * Materials:
 * - Each band has its own glass (it carries its own strip), all four one
 *   program. The glass is `transparent` at every reveal, so the fade changes
 *   no program: three draws transmissive objects in a list of their own
 *   whatever `transparent` says, and at full reveal their alpha is 1. The low
 *   tier's thin glass writes no depth: the four bands share one centre, so
 *   three cannot sort them, and a near band drawn first would hide the far
 *   ones behind it.
 * - The gold is opaque, since transmission sees only opaque objects: a
 *   see-through needle would vanish behind every band. It fades by hashed
 *   alpha instead (`alphaHash`), which at full opacity discards nothing.
 *
 * @throws TypeError naming every part the glTF lacks or that is not a mesh
 *   (a part exported with more than one primitive arrives as a Group), or its
 *   missing `rise` clip.
 */
export function loadCompass(
  gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] },
  tier: QualityTier,
  strip: (band: number) => THREE.Texture
): CompassModel {
  const look = COMPASS_LOOK;
  const scene = gltf.scene.clone();
  const parts = new Map<string, THREE.Object3D>();
  for (const name of COMPASS_PARTS) {
    const found = scene.getObjectByName(name);
    if (found) parts.set(name, found);
  }
  const missing = COMPASS_PARTS.filter((name) => !parts.has(name));
  if (missing.length > 0) throw new TypeError(`the compass glTF has no ${missing.map((name) => `"${name}"`).join(', ')}`);
  const flat = COMPASS_PARTS.filter((name) => name !== 'armillary' && (parts.get(name) as THREE.Mesh).isMesh !== true);
  if (flat.length > 0) throw new TypeError(`the compass glTF's ${flat.map((name) => `"${name}"`).join(', ')} must each be one mesh`);
  const clip = gltf.animations.find((c) => c.name === 'rise');
  if (!clip) throw new TypeError('the compass glTF has no "rise" animation');
  const part = (name: (typeof COMPASS_PARTS)[number]) => parts.get(name) as THREE.Mesh;

  const armillary = parts.get('armillary')!;
  const group = new THREE.Group();
  group.name = 'compass';
  group.add(armillary);

  const marks: THREE.IUniform<THREE.Color> = { value: new THREE.Color(look.bandMarks.colour).multiplyScalar(look.bandMarks.intensity) };
  const reveal: THREE.IUniform<number> = { value: 1 };
  const onBeforeCompile = patchMarks(marks, reveal);
  let standing: QualityTier = tier;
  const transmission = look.bandGlass.transmission[tier];
  let glassOpacity: number = look.bandGlass.opacity[tier];
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const bands = [1, 2, 3, 4].map((k, i) => {
    const mesh = part(`band_${k}` as (typeof COMPASS_PARTS)[number]);
    const map = strip(i);
    readyStrip(map);
    const glass = new THREE.MeshPhysicalMaterial({
      name: `compass:band_${k}`,
      color: look.bandGlass.colour,
      metalness: 0,
      roughness: look.bandGlass.roughness,
      transmission,
      ior: look.bandGlass.ior,
      thickness: look.bandGlass.thickness,
      iridescence: look.bandGlass.iridescence,
      emissive: look.bandGlass.emissive,
      emissiveIntensity: look.bandGlass.emissiveIntensity,
      emissiveMap: map,
      transparent: true,
      opacity: glassOpacity,
      depthWrite: transmission > 0
    });
    glass.onBeforeCompile = onBeforeCompile;
    glass.customProgramCacheKey = () => 'bob-band';
    mesh.material = glass;
    const rest = mesh.quaternion.clone();
    return {
      mesh,
      glass,
      map,
      rest,
      restScale: mesh.scale.clone(),
      // Lying flat in the armillary, which stands upright at home: its own Y on the up, turned k × turn about it.
      flat: new THREE.Quaternion().setFromAxisAngle(Y, i * look.iris.turn),
      // The pose the iris gives it, which the spin turns on top of: its rest until the iris opens.
      base: rest.clone(),
      // Its scale in its own plane at the full iris: the middle of its wall at the preview's radius.
      widen: look.iris.radii[i] / ringRadius(mesh.geometry),
      sign: i % 2 === 0 ? -1 : 1,
      pace: ((look.spin.base + look.spin.step * i) * Math.PI) / 180
    };
  });

  const gold = new THREE.MeshStandardMaterial({
    name: 'compass:gold',
    color: look.gold.colour,
    metalness: look.gold.metalness,
    roughness: look.gold.roughness,
    emissive: look.gold.emissive,
    emissiveIntensity: look.gold.emissiveIntensity,
    alphaHash: true
  });
  for (const name of ['rim_1', 'rim_2', 'rim_3', 'rim_4', 'pivot', 'axis'] as const) part(name).material = gold;
  // The same brass, its own copy: the needle breathes at home (setNeedleGlow) and the rest of the gold holds still.
  const needleGold = gold.clone();
  needleGold.name = 'compass:needle';

  const needle = part('needle');
  needle.material = needleGold;
  const needleRest = needle.quaternion.clone();
  const pivot = part('pivot');

  // The mixer poses a stand-in, never the armillary itself: three's bindings write a value only when it has changed
  // since they last wrote it, so the home height added on top would pile up on a repeated moment. The stand-in holds
  // the clip's pose as it is, and the armillary takes it with `homeY` added.
  const stand = new THREE.Object3D();
  stand.name = 'armillary';
  const mixer = new THREE.AnimationMixer(stand);
  const action = mixer.clipAction(clip);
  action.play();

  const turn = new THREE.Quaternion();
  const holder = new THREE.Quaternion();
  const dip = new THREE.Quaternion();
  const dipAxis = new THREE.Vector3();
  const TAU = 2 * Math.PI;
  let needleAngle = 0;
  // What the setters share: the needle's dip and the iris, eased (shares 0..1 of the way), and the spin's time.
  let needleDip = 0;
  let iris = 0;
  let spinTime = 0;
  /** The angle the dip last took its side from (see `poseNeedle`), and whether the needle has been dipping since. */
  let dipAngle = 0;
  let dipping = false;

  // The needle out of the armillary (`setNeedleWorld`). What it gives back on null: the needle's and the pivot's own
  // place and size in the armillary, as the file has them.
  const needleHome = { position: needle.position.clone(), scale: needle.scale.clone() };
  const pivotHome = { position: pivot.position.clone(), quaternion: pivot.quaternion.clone(), scale: pivot.scale.clone() };
  // Where the dip leaves the needle, in the world, once the armillary has risen: the up pose turned half about the
  // world's X (see `poseNeedle`), whatever `setNeedle` said. It is the pose of an override with no aim, so the dive's
  // first override takes over from the dipped needle in roll as well as in place; an aim swings it from there.
  const downPose = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI).multiply(needleRest);
  // Where the tip points in that pose: the world's down, the direction every aim is swung from.
  const tipDown = Y.clone().applyQuaternion(downPose);
  // The override as it was handed in (copied, never kept) and whether one is held.
  const heldAt = new THREE.Vector3();
  const heldAim = new THREE.Vector3();
  let heldAimed = false;
  let heldScale = 1;
  let held = false;
  // Scratch for holding the needle: the aim as a direction, the swing to it, and the armillary's world pose.
  const toAim = new THREE.Vector3();
  const swing = new THREE.Quaternion();
  const parentAt = new THREE.Vector3();
  const parentScale = new THREE.Vector3();
  const parentTurn = new THREE.Quaternion();

  /**
   * Holds the needle and the pivot where the override puts them in the world, in the armillary's frame: the armillary
   * has risen, sunk and turned, and the group may have been moved, so every part is brought back from the world
   * through the armillary's world pose, as `poseNeedle` does for the turns. Run from `poseNeedle`, after it, so the
   * armillary's world matrix is current.
   *
   * The needle's world orientation is the dipped one (`downPose`) swung by the shortest arc from straight down to the
   * aim, so its roll is the dipped needle's at no aim, and is continuous as the aim leaves straight down; an aim on the
   * position has no direction, and reads as no aim. The pivot goes to the same place and size and keeps its own world
   * orientation (the file's, as at home with the armillary risen), so nothing of either turns with the armillary.
   * The armillary's scale is taken as one all over, as the group's is.
   *
   * Scratch only: no allocation.
   */
  const holdInWorld = (): void => {
    (needle.parent ?? armillary).matrixWorld.decompose(parentAt, parentTurn, parentScale);
    parentTurn.invert();
    swing.identity();
    if (heldAimed) {
      toAim.copy(heldAim).sub(heldAt);
      const length = toAim.length();
      if (length > 1e-9) swing.setFromUnitVectors(tipDown, toAim.divideScalar(length));
    }
    needle.quaternion.copy(parentTurn).multiply(swing).multiply(downPose);
    needle.position.copy(heldAt).sub(parentAt).applyQuaternion(parentTurn).divide(parentScale);
    needle.scale.copy(needleHome.scale).multiplyScalar(heldScale).divide(parentScale);
    pivot.position.copy(needle.position);
    pivot.quaternion.copy(parentTurn).multiply(pivotHome.quaternion);
    pivot.scale.copy(pivotHome.scale).multiplyScalar(heldScale).divide(parentScale);
  };

  /**
   * The needle at `needleAngle` about the world's Z, dipped `needleDip` of the
   * way down. Its parent (the armillary) turns as it rises, so the turns are
   * taken in the world and brought back into the parent's frame:
   * local = P^-1 * D * Rz(-angle) * P * rest, P the parent's world rotation.
   *
   * D is the dip, a turn about one world axis, so the world pose slerps from
   * the `setNeedle` pose to the dip's end. Its axis, (cos(a/2), -sin(a/2), 0),
   * is the bisector between the tip, (sin a, cos a, 0), and the down: a half
   * turn about it takes the tip to the down, through (0, 0, cos(a/2)), toward
   * the camera, as the preview's needle goes, and D * Rz(-a) is then the half turn
   * about the world's X for every a: the end pose is the preview's whatever the
   * aim. Every `setNeedle` pose is that half turn from the end, where the two
   * ways round tie and a plain slerp would pick one by rounding; the axis picks
   * the camera's side. As the dip starts the angle is wrapped to [-pi, pi], so
   * the side holds a turn on; it changes only at straight down, where the tip
   * already is and only the needle's roll differs. While the needle dips the
   * angle is taken on the turn nearest the one the dip last took, so an angle
   * that moves across straight down (a spring settling there, Ruling 9) goes on
   * round instead of flipping the roll halfway down; out of the dip it starts
   * from [-pi, pi] again.
   *
   * Scratch quaternions only: no allocation.
   */
  const poseNeedle = (): void => {
    (needle.parent ?? armillary).getWorldQuaternion(holder);
    turn.setFromAxisAngle(Z, -needleAngle);
    if (needleDip > 0) {
      const from = dipping ? dipAngle : 0;
      const off = needleAngle - from;
      dipAngle = from + off - TAU * Math.round(off / TAU);
      dipping = true;
      const half = dipAngle / 2;
      dipAxis.set(Math.cos(half), -Math.sin(half), 0);
      turn.premultiply(dip.setFromAxisAngle(dipAxis, needleDip * Math.PI));
    } else {
      dipping = false;
    }
    needle.quaternion.copy(holder).invert().multiply(turn).multiply(holder).multiply(needleRest);
    // An override replaces the whole of it. The pose above is still worked out first, so the dip's side is kept up
    // through the override as through the home, and null finds the needle as the home's calls alone left it.
    if (held) holdInWorld();
  };

  /** Band `band` in the pose the iris gives it, turned by the spin about its own Y on top. */
  const poseBand = (band: (typeof bands)[number]): void => {
    band.mesh.quaternion.copy(band.base).multiply(turn.setFromAxisAngle(Y, band.sign * band.pace * spinTime));
  };

  /** The one place the armillary's position is written: the height the rise gives it, sunk toward the iris's. */
  const placeArmillary = (): void => {
    const y = stand.position.y + look.homeY;
    armillary.position.set(stand.position.x, y + (look.iris.flatY - y) * iris, stand.position.z);
  };

  const model: CompassModel = {
    group,
    pivot,
    setRise(t) {
      // With no time passing, the mixer samples the clip at the action's own time and nothing else: no looping, no
      // clamping at the end, so the rise can be posed back down after it has reached the top.
      action.time = clamp01(t) * clip.duration;
      mixer.update(0);
      placeArmillary();
      armillary.quaternion.copy(stand.quaternion);
      // The armillary has turned under the needle: hold the needle where it points in the world.
      poseNeedle();
    },
    setSpin(time) {
      spinTime = Number.isFinite(time) ? time : 0;
      // Called every frame at home: an indexed loop, so it makes no iterator. About the band's own Y (Blender's local
      // Z, round which the band lies), after its rest tilt or the iris's pose.
      for (let i = 0; i < bands.length; i++) poseBand(bands[i]);
    },
    setIris(t) {
      iris = smoothstep01(t);
      for (let i = 0; i < bands.length; i++) {
        const band = bands[i];
        // three's slerp hands back the rest itself at 0 and the flat itself at 1.
        band.base.slerpQuaternions(band.rest, band.flat, iris);
        const s = band.restScale;
        band.mesh.scale.set(s.x + (band.widen - s.x) * iris, s.y, s.z + (band.widen - s.z) * iris);
        poseBand(band);
      }
      placeArmillary();
      // The armillary has sunk under a needle that is held in the world.
      if (held) poseNeedle();
    },
    setNeedle(angle) {
      // Clockwise on screen is a negative turn about +Z.
      needleAngle = Number.isFinite(angle) ? angle : 0;
      poseNeedle();
    },
    setNeedleDip(t) {
      needleDip = smoothstep01(t);
      poseNeedle();
    },
    setNeedleWorld(override) {
      if (override === null) {
        if (!held) return;
        held = false;
        needle.position.copy(needleHome.position);
        needle.scale.copy(needleHome.scale);
        pivot.position.copy(pivotHome.position);
        pivot.quaternion.copy(pivotHome.quaternion);
        pivot.scale.copy(pivotHome.scale);
        poseNeedle();
        return;
      }
      held = true;
      const { position, scale, aim } = override;
      heldAt.set(finiteOr(position[0], 0), finiteOr(position[1], 0), finiteOr(position[2], 0));
      heldScale = finiteOr(scale, 1);
      heldAimed = aim !== null && Number.isFinite(aim[0] + aim[1] + aim[2]);
      if (heldAimed && aim !== null) heldAim.set(aim[0], aim[1], aim[2]);
      poseNeedle();
    },
    setReveal(level) {
      const r = clamp01(level);
      gold.opacity = r;
      needleGold.opacity = r;
      for (let i = 0; i < bands.length; i++) bands[i].glass.opacity = glassOpacity * r;
      reveal.value = r;
      armillary.visible = r > 0;
    },
    setNeedleGlow(level) {
      const share = Number.isFinite(level) && level >= 0 ? level : 1;
      needleGold.emissiveIntensity = look.gold.emissiveIntensity * share;
    },
    setTier(next) {
      const to = lowerTier(standing, next);
      if (to === standing) return;
      standing = to;
      glassOpacity = look.bandGlass.opacity[to];
      const passes = look.bandGlass.transmission[to];
      for (let i = 0; i < bands.length; i++) {
        const glass = bands[i].glass;
        // Transmission on or off is another program; a lower amount of it is a uniform.
        if ((glass.transmission > 0) !== (passes > 0)) glass.needsUpdate = true;
        glass.transmission = passes;
        glass.depthWrite = passes > 0;
        glass.opacity = glassOpacity * reveal.value;
      }
    },
    dispose() {
      gold.dispose();
      needleGold.dispose();
      for (const band of bands) {
        band.glass.dispose();
        band.map.dispose();
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(stand);
    }
  };
  model.setRise(1);
  model.setSpin(0);
  model.setNeedle(0);
  model.setReveal(1);
  return model;
}
