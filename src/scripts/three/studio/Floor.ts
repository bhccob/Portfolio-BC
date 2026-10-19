import * as THREE from 'three';

/**
 * The studio floor: a wet black gloss that reads as a surface without
 * mirroring the scene (a real mirror, a Reflector, was tried first: from the
 * hub's camera it showed only the back plate's dark underside, a second
 * render of the scene for almost nothing). One sheet, two noise reads and the
 * key's shadow a pixel, carries three things:
 *   - the beam's pool: a warm disc as wide as the beam where it lands, lit
 *     evenly with wet glints in it, the device's shadow lying in it: dimming
 *     it, not blacking it out, and fainter as the layers rise (setRise), as a
 *     high occluder's shadow spreads and pales;
 *   - the gloss: a purple sheen that brightens towards a grazing view, as a
 *     glossy floor does, and fades out with distance from the stage, so the
 *     floor falls off into a dark horizon in frame;
 *   - the device's reflection: a soft purple where its reflection would lie,
 *     between it and the camera.
 * All three are streaked by wet runs that point at the camera, as light
 * smears on a wet floor, so they stand upright on screen. The floor is a
 * disc whose edge fades, so the studio's backdrop shows past it.
 */

export interface FloorOptions {
  /** World height of the floor. */
  y: number;
  /** Where the beam lands (x, z), the middle of the warm pool. */
  pool: readonly [number, number];
  /** The beam's radius where it lands: the pool's. */
  poolRadius: number;
  /** The device's footprint (half-width, half-depth), whose reflection the sheen is. */
  footprint: readonly [number, number];
  /** Shared noise (studio/noise.ts), not disposed by the floor. */
  noise: THREE.Texture;
}

export interface Floor {
  group: THREE.Group;
  /** How far the device's layers have risen apart (0 closed … 1 at the hub): its shadow pales as they do. */
  setRise(explode: number): void;
  dispose(): void;
}

export const FLOOR = {
  /** The disc's radius; the floor fades out over its outer part. */
  radius: 9,
  /** The film's colour. */
  gloss: 0x0a0612,
  /** The warm pool where the beam lands, and its strength. */
  pool: 0xffc35a,
  poolStrength: 0.28,
  /** How far the pool spills past the beam's radius, as a share of it. */
  spill: 1.5,
  /** The pool's even light and its wet glints, as shares of its strength. */
  even: 0.6,
  glint: 3,
  /** The floor's own purple sheen, at a grazing view, its strength and how sharply it rises (Fresnel power). */
  sheen: 0x6a3aa8,
  glossStrength: 0.8,
  fresnel: 2.5,
  /** The device's reflection (in the sheen's purple), its strength, and the height it is seen from. */
  reflectionStrength: 0.12,
  lift: 0.6,
  /**
   * How much of the pool the device's shadow takes (the sheen loses half as
   * much): with the device closed on the floor, and with its layers risen
   * apart, where it would otherwise put out the pool.
   */
  shadow: { closed: 0.45, apart: 0.15 },
  /** The gloss fades out between these shares of the radius from the middle: the dark horizon. */
  stage: [0.12, 0.55] as const,
  /** The disc fades into the backdrop between these shares of the radius. */
  edge: [0.5, 0.8] as const
} as const;

const SEGMENTS = 64;

// As ShadowMaterial's, with the world position passed on.
const vertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  #include <shadowmap_pars_vertex>
  varying vec3 vWorld;
  void main() {
    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    #include <begin_vertex>
    #include <project_vertex>
    #include <worldpos_vertex>
    #include <shadowmap_vertex>
    #include <fog_vertex>
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  }`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  #include <bsdfs>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>
  uniform sampler2D tNoise;
  uniform vec3 uColor;
  uniform vec3 uPoolColor;
  uniform vec2 uPool;
  uniform float uPoolRadius;
  uniform float uPoolStrength;
  uniform float uSpill;
  uniform float uEven;
  uniform float uGlint;
  uniform vec3 uSheenColor;
  uniform float uGlossStrength;
  uniform float uFresnel;
  uniform vec2 uFootprint;
  uniform float uReflectionStrength;
  uniform float uLift;
  uniform float uShadow;
  uniform vec2 uStage;
  uniform vec2 uEdge;
  uniform float uRadius;
  varying vec3 vWorld;
  void main() {
    // From the stage towards the point on the floor under the camera.
    float reach = max(length(cameraPosition.xz), 1e-3);
    vec2 toward = cameraPosition.xz / reach;
    // Wet patches, fixed on the floor, so they shrink into the distance as a surface's marks do.
    vec2 marks = texture2D(tNoise, vWorld.xz * 0.11).rg;
    float wet = smoothstep(0.3, 0.7, marks.r * 0.7 + marks.g * 0.3);
    // Runs: light on a wet floor smears towards the viewer, so they are fine across the view and long along it,
    // in polar coordinates round the point under the camera (they all point at it, upright on screen). Red the
    // broad runs, green the finer glints.
    vec2 fromFoot = vWorld.xz - cameraPosition.xz;
    float angle = atan(dot(fromFoot, vec2(-toward.y, toward.x)), -dot(fromFoot, toward));
    vec2 runs = texture2D(tNoise, vec2(angle * reach, length(fromFoot)) * vec2(1.2, 0.08)).rg;
    float streak = runs.r;
    float glints = wet * smoothstep(0.6, 0.95, runs.g);
    glints *= glints;

    // The beam's pool: a disc a little wider than the beam where it lands, brighter in the middle, lit evenly
    // with a few wet glints in it.
    float d = length(vWorld.xz - uPool);
    float disc = 1.0 - smoothstep(0.4 * uPoolRadius, uSpill * uPoolRadius, d);
    float core = exp(-d * d / (0.4 * uPoolRadius * uPoolRadius));
    float pool = uPoolStrength * disc * (0.5 + 0.5 * core) * (uEven * (0.85 + 0.3 * streak) + uGlint * glints);

    // The gloss: brighter as the view grazes the floor (Fresnel), faintly streaked and patchy, and gone with
    // distance from the stage, so the floor falls off into a dark horizon.
    vec3 V = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - V.y, uFresnel);
    float stage = 1.0 - smoothstep(uRadius * uStage.x, uRadius * uStage.y, length(vWorld.xz));
    float gloss = uGlossStrength * fresnel * stage * (0.6 + 0.4 * wet) * (0.75 + 0.5 * streak);

    // The device's reflection: its footprint moved towards the camera as far as a mirror would show it
    // (seen from uLift above the floor), soft-edged.
    float height = max(cameraPosition.y - vWorld.y, 1e-3);
    vec2 local = vWorld.xz - toward * reach * uLift / (height + uLift);
    vec2 outside = max(abs(local) - uFootprint, 0.0);
    float reflection = uReflectionStrength * exp(-dot(outside, outside) / 0.35) * (0.6 + 0.6 * streak + 2.0 * glints);

    // The device's shadow from the key (1 lit, 0 in shadow): it dims the pool, and the sheen half as much.
    float lit = getShadowMask();
    pool *= 1.0 - uShadow * (1.0 - lit);
    gloss *= 1.0 - 0.5 * uShadow * (1.0 - lit);

    vec3 floorColor = uColor + uPoolColor * pool + uSheenColor * (gloss + reflection);
    #if defined( USE_FOG ) && defined( FOG_EXP2 )
      // At half the scene's strength: the far floor goes dark, not purple.
      float fogFactor = 0.5 * (1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth));
      floorColor = mix(floorColor, fogColor, fogFactor);
    #endif
    // The disc's edge fades away, so the backdrop shows beyond it (premultiplied).
    float edge = 1.0 - smoothstep(uRadius * uEdge.x, uRadius * uEdge.y, length(vWorld.xz));
    gl_FragColor = vec4(floorColor * edge, edge);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function buildFloor(options: FloorOptions): Floor {
  const group = new THREE.Group();
  group.name = 'studio:floor';
  group.position.y = options.y;

  const geometry = new THREE.CircleGeometry(FLOOR.radius, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    name: 'studio:gloss',
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      THREE.UniformsLib.fog,
      {
        tNoise: { value: null },
        uColor: { value: new THREE.Color(FLOOR.gloss) },
        uPoolColor: { value: new THREE.Color(FLOOR.pool) },
        uPool: { value: new THREE.Vector2(...options.pool) },
        uPoolRadius: { value: options.poolRadius },
        uPoolStrength: { value: FLOOR.poolStrength },
        uSpill: { value: FLOOR.spill },
        uEven: { value: FLOOR.even },
        uGlint: { value: FLOOR.glint },
        uSheenColor: { value: new THREE.Color(FLOOR.sheen) },
        uGlossStrength: { value: FLOOR.glossStrength },
        uFresnel: { value: FLOOR.fresnel },
        uFootprint: { value: new THREE.Vector2(...options.footprint) },
        uReflectionStrength: { value: FLOOR.reflectionStrength },
        uLift: { value: FLOOR.lift },
        uShadow: { value: FLOOR.shadow.closed },
        uStage: { value: new THREE.Vector2(...FLOOR.stage) },
        uEdge: { value: new THREE.Vector2(...FLOOR.edge) },
        uRadius: { value: FLOOR.radius }
      }
    ]),
    vertexShader,
    fragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    fog: true,
    // For the key's shadow (getShadowMask); the floor is not otherwise lit.
    lights: true
  });
  material.uniforms.tNoise.value = options.noise;
  const gloss = new THREE.Mesh(geometry, material);
  gloss.name = 'studio:gloss';
  gloss.receiveShadow = true;
  gloss.renderOrder = -4;
  gloss.raycast = () => {};
  group.add(gloss);

  const dispose = (): void => {
    geometry.dispose();
    material.dispose();
    group.removeFromParent();
  };

  const setRise = (explode: number): void => {
    const t = THREE.MathUtils.clamp(explode, 0, 1);
    material.uniforms.uShadow.value = FLOOR.shadow.closed + (FLOOR.shadow.apart - FLOOR.shadow.closed) * t;
  };

  return { group, setRise, dispose };
}
