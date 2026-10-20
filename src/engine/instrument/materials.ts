import * as THREE from 'three';
import { palette } from '../palette';
import { DIAL } from './dialSpec';
import {
  ALUMINIUM,
  DRIVE_ROOM,
  MAGNET,
  STEEL,
  bladeUniforms,
  mirrorUniforms,
  patchBlade,
  patchMirror,
  patchRoom,
  patchTail,
  type BladeUniforms,
  type MirrorUniforms
} from './DriveParts';
import { TEXTURE_MEANS, type InstrumentTextures } from './textures';

/**
 * The compass's finishes, made once per model and shared by every part that
 * wears them. With no textures every finish is a plain colour. The painted
 * face and the ring strips arrive later as textures; their materials start
 * on 1 x 1 placeholders, so swapping the real ones in only changes a texture
 * and never recompiles a program.
 *
 * The drive's finishes are here too, and every finish that fades in the
 * change to the drive (or crossfades) is transparent from the start, its
 * depth writing fixed, so a pose only moves opacities, colours and uniforms
 * and never recompiles a program.
 */

/** The palette (global constraints): the face's lacquer, the plate's, brass, gilt, signal yellow and thread red. */
const COLOR = {
  lacquer: palette.boardDeep,
  plate: palette.board,
  brass: palette.brass,
  gilt: palette.gold,
  needleTip: palette.yellow,
  thread: palette.thread
} as const;

/** The glass over the pool: this faint while the pool is a pool. */
export const GLASS_OPACITY = 0.12;

/** The pattern ring's sweep: the soft edge sweepCoverage uses, and the seam's strength at the front. */
export const SWEEP = { soft: 0.015, seam: 1.8 } as const;

/**
 * How the aluminium's image is read as a grey: its red and blue alone. The
 * image is anodised purple; its green is a sliver (a mean of 0.018) whose
 * noise a per-channel tint multiplied some eighteen times into green and
 * purple speckle. Red and blue carry the brushing; read as one grey and
 * tinted as a whole, the brushing stays and the speckle goes.
 */
export const ALUMINIUM_GREY = [0.5, 0, 0.5] as const;

/** The face's placeholder roughness (green) and metalness (blue): plain lacquer, as face.ts paints it. */
const FACE_ROUGHNESS = 0.08;

/**
 * The lacquers: a pigment base that barely reflects (specular 0.05 of a plain
 * dielectric's, a little soft), so its purple is not greyed by the key's
 * sheen and renders face-on as its own colour, under a glossy coat that
 * gives the crisp highlights.
 */
const LACQUER = { roughness: 0.5, specular: 0.05, coat: 0.06 } as const;

/** Where three's lights chunk handles the point lights: from this line to the `#endif` after the loop's end. */
const POINT_LIGHTS = { start: '#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )', loopEnd: '#pragma unroll_loop_end', end: '#endif' } as const;

/**
 * three's lights chunk (`lights_fragment_begin`) with the point lights'
 * specular kept out: the direct specular (and the clearcoat's) is put back
 * after the point-light loop as it was before it, so a point light only
 * lights the surface. The scene's one point light is the pearl's: on the
 * glossy lacquers and the glass it warms what it lights rather than shows a
 * second, mirrored pearl. Every other light, and the pearl on the brass, the
 * gilt rules and the needle, is untouched. A chunk without the loop is
 * answered unchanged.
 */
export function withoutPointSpecular(chunk: string): string {
  const start = chunk.indexOf(POINT_LIGHTS.start);
  const loopEnd = start < 0 ? -1 : chunk.indexOf(POINT_LIGHTS.loopEnd, start);
  const end = loopEnd < 0 ? -1 : chunk.indexOf(POINT_LIGHTS.end, loopEnd);
  if (end < 0) return chunk;
  const after = end + POINT_LIGHTS.end.length;
  const keep = ['vec3 pearlSpecular = reflectedLight.directSpecular;', '#ifdef USE_CLEARCOAT', '\tvec3 pearlCoat = clearcoatSpecularDirect;', '#endif', ''].join('\n');
  const restore = ['', 'reflectedLight.directSpecular = pearlSpecular;', '#ifdef USE_CLEARCOAT', '\tclearcoatSpecularDirect = pearlCoat;', '#endif'].join('\n');
  return chunk.slice(0, start) + keep + chunk.slice(start, after) + restore + chunk.slice(after);
}

/** A lit material's onBeforeCompile: its lights chunk spelled out without the pearl's specular (withoutPointSpecular). */
function pearlUnmirrored(shader: { fragmentShader: string }): void {
  shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', withoutPointSpecular(THREE.ShaderChunk.lights_fragment_begin));
}

export interface PatternUniforms {
  mapTo: THREE.IUniform<THREE.Texture>;
  uSweep: THREE.IUniform<number>;
  uOrigin: THREE.IUniform<number>;
  uSoft: THREE.IUniform<number>;
}

export interface InstrumentMaterials {
  /** Deep lacquer: the face's own colour, the pool floor and the bed under the rings. */
  lacquer: THREE.MeshPhysicalMaterial;
  /** The same lacquer in the plate's colour. */
  plate: THREE.MeshPhysicalMaterial;
  /** Brass: the plate's edge band and the pool wall. */
  brass: THREE.MeshStandardMaterial;
  /** The rim's brass, its own so it can fade as the platters turn to mirror. */
  rim: THREE.MeshStandardMaterial;
  /** The needle's pin, in plain brass: it fades with the needle, so a lifted needle leaves the portrait's centre clear. */
  pin: THREE.MeshStandardMaterial;
  /** Gilt: the raised rules between the rings, which fade as the platters turn to mirror. */
  gilt: THREE.MeshStandardMaterial;
  /** The painted face: its canvas as the colour, its mr canvas as roughness (green) and metalness (blue); it wipes to mirror. */
  face: THREE.MeshStandardMaterial;
  /** The pattern ring: `map` is the home it sweeps from, `mapTo` (a uniform) the home it sweeps to; it wipes to mirror. */
  pattern: THREE.MeshPhysicalMaterial;
  /** The needle's tip half, signal yellow and aglow; as the arm forms it turns to steel but for its head. */
  needleTip: THREE.MeshStandardMaterial;
  needleTail: THREE.MeshStandardMaterial;
  threads: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  /** The portrait under the pool's glass, unlit. */
  portrait: THREE.MeshBasicMaterial;
  /** Steel: the platters' edges, the hub, the clamp and the screws, the drive's room in its reflections. */
  steel: THREE.MeshStandardMaterial;
  /** The chassis's brushed aluminium, over the plate's lacquer as it fades in; its image read as a grey (ALUMINIUM_GREY). */
  aluminium: THREE.MeshStandardMaterial;
  /** The magnets' near-black metal, and the park ramp's, with a faint sheen of the drive's room. */
  magnet: THREE.MeshStandardMaterial;
}

/** The uniforms the poses set, each the materials' own object (and their `userData.uniforms`). */
export interface InstrumentUniforms {
  pattern: PatternUniforms;
  /** Shared by the face and the pattern ring. */
  mirror: MirrorUniforms;
  blade: BladeUniforms;
}

export interface Placeholders {
  /** The plain ring: the plate's lacquer, for `map` and `mapTo` until the strips arrive. */
  strip: THREE.DataTexture;
  /** The face's colour until it is painted: lacquer. */
  face: THREE.DataTexture;
  /** The face's roughness/metalness until it is painted: lacquer's (linear). */
  faceMr: THREE.DataTexture;
  /** The portrait's map until it arrives (the disc stays hidden meanwhile). */
  portrait: THREE.DataTexture;
  /** White: the brass's and lacquers' map until the images arrive, so they show their plain colours. */
  image: THREE.DataTexture;
}

/** A 1 x 1 texture of one colour; `srgb` for a colour map, linear for data. */
function pixel(r: number, g: number, b: number, srgb: boolean): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function hexPixel(hex: number): THREE.DataTexture {
  return pixel((hex >> 16) & 255, (hex >> 8) & 255, hex & 255, true);
}

export function createPlaceholders(): Placeholders {
  return {
    strip: hexPixel(COLOR.plate),
    face: hexPixel(COLOR.lacquer),
    faceMr: pixel(0, Math.round(FACE_ROUGHNESS * 255), 0, false),
    portrait: hexPixel(COLOR.lacquer),
    image: hexPixel(0xffffff)
  };
}

/** Writes a linear colour as a GLSL vec3. */
function vec3(color: THREE.Color): string {
  return `vec3( ${color.r.toFixed(5)}, ${color.g.toFixed(5)}, ${color.b.toFixed(5)} )`;
}

/**
 * The pattern ring's material. Its shader mixes `map` (the home it sweeps
 * from) with `mapTo` (the home it sweeps to) by the cover sweepCoverage
 * gives, with u the ring's polar u, and lights a thin gold seam at the
 * sweep's front while the sweep is under way; over that, the mirror wipe
 * (patchMirror). The uniforms are the material's own objects
 * (`userData.uniforms` too), so setting a value needs no recompile.
 */
function createPattern(strip: THREE.Texture, mirror: MirrorUniforms): { material: THREE.MeshPhysicalMaterial; uniforms: PatternUniforms } {
  const material = new THREE.MeshPhysicalMaterial({
    name: 'compass:pattern',
    color: 0xffffff,
    map: strip,
    roughness: 0.3,
    metalness: 0.15,
    clearcoat: 1
  });
  const uniforms: PatternUniforms = {
    mapTo: { value: strip },
    uSweep: { value: 0 },
    uOrigin: { value: 0 },
    uSoft: { value: SWEEP.soft }
  };
  const seam = vec3(new THREE.Color(COLOR.gilt));
  material.userData.uniforms = { ...uniforms, ...mirror };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    pearlUnmirrored(shader);
    patchMirror(shader, mirror);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D mapTo;\nuniform float uSweep;\nuniform float uOrigin;\nuniform float uSoft;'
      )
      .replace(
        '#include <map_fragment>',
        [
          'float sweepSeam = 0.0;',
          '#ifdef USE_MAP',
          '{',
          // sweepCoverage(u, origin, sweep, soft), the same steps.
          '  float around = fract( vMapUv.x - uOrigin );',
          '  float d = min( around, 1.0 - around );',
          '  float front = uSweep * ( 0.5 + uSoft );',
          '  float coverage = 1.0 - smoothstep( front - uSoft, front, d );',
          '  diffuseColor *= mix( texture2D( map, vMapUv ), texture2D( mapTo, vMapUv ), coverage );',
          // A bell over the fade, at its middle, sharpened so the seam stays thin.
          '  if ( uSweep > 0.0 && uSweep < 1.0 ) sweepSeam = pow( 4.0 * coverage * ( 1.0 - coverage ), 3.0 );',
          '}',
          '#endif'
        ].join('\n')
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n  totalEmissiveRadiance += ${seam} * ${SWEEP.seam.toFixed(2)} * sweepSeam;`
      );
  };
  material.customProgramCacheKey = () => 'compass:pattern';
  return { material, uniforms };
}

/** The painted face, with the mirror wipe over it and the pearl kept out of its highlights. */
function createFace(placeholders: Placeholders, mirror: MirrorUniforms): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    name: 'compass:face',
    color: 0xffffff,
    map: placeholders.face,
    roughnessMap: placeholders.faceMr,
    metalnessMap: placeholders.faceMr,
    // The maps rule: three multiplies these by the mr canvas.
    roughness: 1,
    metalness: 1
  });
  material.userData.uniforms = mirror;
  material.onBeforeCompile = (shader) => {
    pearlUnmirrored(shader);
    patchMirror(shader, mirror);
  };
  material.customProgramCacheKey = () => 'compass:face';
  return material;
}

/** A drive metal: `material` with the drive's room in its reflections (patchRoom) as much as `cover` says, in a program of its own (`key`). */
function inRoom<M extends THREE.Material>(material: M, cover: number, key: string): M {
  material.onBeforeCompile = (shader) => patchRoom(shader, cover.toFixed(3));
  material.customProgramCacheKey = () => key;
  return material;
}

/** The chassis's aluminium: its image read as one grey (ALUMINIUM_GREY), so the tint keeps the brushing and adds no speckle. */
function createAluminium(placeholder: THREE.Texture): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    name: 'compass:aluminium',
    color: ALUMINIUM.color,
    map: placeholder,
    metalness: 1,
    roughness: ALUMINIUM.roughness,
    // It fades in over the plate's lacquer, drawn on the same faces: it wins their depth by a hair.
    transparent: true,
    opacity: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const grey = ALUMINIUM_GREY.map((w) => w.toFixed(3)).join(', ');
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      [
        '#ifdef USE_MAP',
        '\tvec4 sampledDiffuseColor = texture2D( map, vMapUv );',
        `\tdiffuseColor *= vec4( vec3( dot( sampledDiffuseColor.rgb, vec3( ${grey} ) ) ), sampledDiffuseColor.a );`,
        '#endif'
      ].join('\n')
    );
  };
  material.customProgramCacheKey = () => 'compass:aluminium';
  return material;
}

/** The needle's tail half and hub: brass, turning to steel with the blade (Needle), the drive's room in it as far as it has (patchTail). */
function createNeedleTail(blade: BladeUniforms): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    name: 'compass:needle-tail',
    color: COLOR.brass,
    // Half metal and a little rough, so the key lights it: polished, it would mirror the dark room and read brown,
    // and faded for the portrait it would be a dark line across it rather than a faint gold one.
    metalness: 0.5,
    roughness: 0.4,
    transparent: true
  });
  material.onBeforeCompile = (shader) => patchTail(shader, blade);
  material.customProgramCacheKey = () => 'compass:needle-tail';
  return material;
}

/** The needle's tip half: signal yellow and aglow, turning to steel but for its head as the arm forms (patchBlade). */
function createNeedleTip(blade: BladeUniforms): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    name: 'compass:needle-tip',
    color: COLOR.needleTip,
    emissive: COLOR.needleTip,
    // About one in all with the key's light, so the tone mapping keeps it signal yellow rather than rolling it to cream.
    emissiveIntensity: 0.8,
    transparent: true
  });
  material.userData.uniforms = blade;
  material.onBeforeCompile = (shader) => patchBlade(shader, blade, DIAL.needle.tip);
  material.customProgramCacheKey = () => 'compass:needle-tip';
  return material;
}

export function createMaterials(placeholders: Placeholders): { materials: InstrumentMaterials; uniforms: InstrumentUniforms } {
  // The glossy finishes light up under the pearl but do not mirror it (withoutPointSpecular). One shared patch, so
  // still one program per kind of material.
  const unmirrored = <M extends THREE.Material>(material: M): M => {
    material.onBeforeCompile = pearlUnmirrored;
    return material;
  };
  // The image-mapped finishes start on a white map, so they show their plain colours and the images only swap a texture.
  const lacquer = (name: string, color: number) =>
    unmirrored(
      new THREE.MeshPhysicalMaterial({ name, color, map: placeholders.image, metalness: 0, roughness: LACQUER.roughness, specularIntensity: LACQUER.specular, clearcoat: 1, clearcoatRoughness: LACQUER.coat })
    );
  const mirror = mirrorUniforms();
  const blade = bladeUniforms();
  const pattern = createPattern(placeholders.strip, mirror);
  const materials: InstrumentMaterials = {
    lacquer: lacquer('compass:lacquer', COLOR.lacquer),
    plate: lacquer('compass:plate', COLOR.plate),
    brass: new THREE.MeshStandardMaterial({ name: 'compass:brass', color: COLOR.brass, map: placeholders.image, metalness: 1, roughness: 0.32 }),
    rim: new THREE.MeshStandardMaterial({ name: 'compass:rim', color: COLOR.brass, map: placeholders.image, metalness: 1, roughness: 0.32, transparent: true }),
    pin: new THREE.MeshStandardMaterial({ name: 'compass:pin', color: COLOR.brass, metalness: 1, roughness: 0.32, transparent: true }),
    gilt: new THREE.MeshStandardMaterial({ name: 'compass:gilt', color: COLOR.gilt, metalness: 1, roughness: 0.3, transparent: true }),
    face: createFace(placeholders, mirror),
    pattern: pattern.material,
    needleTip: createNeedleTip(blade),
    needleTail: createNeedleTail(blade),
    threads: new THREE.MeshStandardMaterial({ name: 'compass:threads', color: COLOR.thread, metalness: 0, roughness: 0.6, transparent: true }),
    glass: unmirrored(
      new THREE.MeshPhysicalMaterial({
        name: 'compass:glass',
        // Glass has no colour of its own: it darkens the pool a little and shows the room's reflections.
        color: 0x000000,
        metalness: 0,
        roughness: 0.05,
        clearcoat: 1,
        transparent: true,
        opacity: GLASS_OPACITY,
        // The needle's lower facets dip below the glass on a tilt: the glass must not clip them.
        depthWrite: false
      })
    ),
    portrait: new THREE.MeshBasicMaterial({ name: 'compass:portrait', map: placeholders.portrait, transparent: true, opacity: 0 }),
    steel: inRoom(new THREE.MeshStandardMaterial({ name: 'compass:steel', color: STEEL.color, metalness: 1, roughness: STEEL.roughness }), DRIVE_ROOM.cover.steel, 'compass:steel'),
    aluminium: createAluminium(placeholders.image),
    magnet: inRoom(
      new THREE.MeshStandardMaterial({ name: 'compass:magnet', color: MAGNET.color, metalness: MAGNET.metalness, roughness: MAGNET.roughness }),
      DRIVE_ROOM.cover.magnet,
      'compass:magnet'
    )
  };
  return { materials, uniforms: { pattern: pattern.uniforms, mirror, blade } };
}

/** Sets a texture's wrapping, flagging it for upload only when it changes. */
function wrap(texture: THREE.Texture, s: THREE.Wrapping, t: THREE.Wrapping): void {
  if (texture.wrapS === s && texture.wrapT === t) return;
  texture.wrapS = s;
  texture.wrapT = t;
  texture.needsUpdate = true;
}

/**
 * Gives `material` the image `map`, its colour divided by the image's mean so
 * the average stays `target`. The material already has a map (the white
 * placeholder), so this swaps a texture and compiles nothing.
 */
function tinted(material: THREE.MeshStandardMaterial, map: THREE.Texture, target: number, mean: readonly [number, number, number]): void {
  const color = new THREE.Color(target);
  material.color.setRGB(color.r / mean[0], color.g / mean[1], color.b / mean[2], THREE.LinearSRGBColorSpace);
  material.map = map;
}

/**
 * Swaps in the image maps that have arrived. Safe to call more than once; a
 * texture left out keeps whatever is there. The brushed brass tiles round
 * (its edges were cross-faded) and mirrors across; the lacquer and the
 * aluminium mirror both ways. The textures stay the caller's.
 */
export function applyTextures(m: InstrumentMaterials, textures: InstrumentTextures): void {
  const { brass, lacquer, aluminium } = textures;
  if (brass) {
    wrap(brass, THREE.RepeatWrapping, THREE.MirroredRepeatWrapping);
    tinted(m.brass, brass, COLOR.brass, TEXTURE_MEANS.brass);
    tinted(m.rim, brass, COLOR.brass, TEXTURE_MEANS.brass);
  }
  if (aluminium) {
    wrap(aluminium, THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping);
    // Read as one grey (createAluminium), so its colour is divided by the grey's mean, the same in every channel.
    const [r, g, b] = TEXTURE_MEANS.aluminium;
    const [wr, wg, wb] = ALUMINIUM_GREY;
    const grey = r * wr + g * wg + b * wb;
    tinted(m.aluminium, aluminium, ALUMINIUM.color, [grey, grey, grey]);
  }
  if (lacquer) {
    wrap(lacquer, THREE.MirroredRepeatWrapping, THREE.MirroredRepeatWrapping);
    tinted(m.lacquer, lacquer, COLOR.lacquer, TEXTURE_MEANS.lacquer);
    tinted(m.plate, lacquer, COLOR.plate, TEXTURE_MEANS.lacquer);
  }
}
