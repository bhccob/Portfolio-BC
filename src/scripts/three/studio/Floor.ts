import * as THREE from 'three';

/**
 * The studio floor, a wet black gloss, in two sheets a hair apart:
 *   - the gloss: a dark film with, streaked into wet runs that point at the
 *     viewer, a warm pool where the beam lands and a faint purple sheen where
 *     the device's own reflection would lie. A real mirror (a Reflector) was
 *     tried first: from the hub's camera it showed only the back plate's dark
 *     underside, a second render of the scene for almost nothing;
 *   - the shadow catcher: a ShadowMaterial taking the device's shadow.
 * The floor is a disc whose edge fades, so the studio's backdrop shows past
 * it rather than a floor running to the horizon.
 */

export interface FloorOptions {
  /** World height of the floor. */
  y: number;
  /** Where the beam lands (x, z), the middle of the warm pool. */
  pool: readonly [number, number];
  /** The device's footprint (half-width, half-depth), under which the sheen lies. */
  footprint: readonly [number, number];
  /** Shared noise (studio/noise.ts), not disposed by the floor. */
  noise: THREE.Texture;
}

export interface Floor {
  group: THREE.Group;
  dispose(): void;
}

export const FLOOR = {
  /** The disc's radius; the floor fades out over its outer part. */
  radius: 9,
  /** The film's colour. */
  gloss: 0x0a0612,
  /** The warm pool where the beam lands, and its strength. */
  pool: 0xffd98a,
  poolStrength: 0.2,
  /** The device's purple, as a soft reflection in the wet runs, and its strength. */
  sheen: 0x6a3aa8,
  sheenStrength: 0.07,
  /** The shadow's darkness. */
  shadow: 0.4
} as const;

const SEGMENTS = 64;

const vertexShader = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const fragmentShader = /* glsl */ `
  #include <fog_pars_fragment>
  uniform sampler2D tNoise;
  uniform vec3 uColor;
  uniform vec3 uPoolColor;
  uniform vec2 uPool;
  uniform float uPoolStrength;
  uniform vec3 uSheenColor;
  uniform vec2 uFootprint;
  uniform float uSheenStrength;
  uniform float uRadius;
  varying vec3 vWorld;
  void main() {
    // Light smears towards the viewer on a wet floor: the runs are fine across the view and long along it.
    vec2 view = normalize(cameraPosition.xz + vec2(1e-4, 0.0));
    vec2 q = vec2(dot(vWorld.xz, vec2(view.y, -view.x)), dot(vWorld.xz, view));
    float broad = texture2D(tNoise, q * vec2(0.9, 0.04)).r;
    float fine = texture2D(tNoise, q * vec2(3.1, 0.13)).g;
    float wet = smoothstep(0.3, 0.75, broad * 0.6 + fine * 0.4);
    float runs = wet * fine;
    float streaks = 0.2 + 2.2 * runs * sqrt(runs);
    // The warm pool where the beam lands.
    float d = length(vWorld.xz - uPool);
    float pool = exp(-d * d / 2.4) * uPoolStrength * streaks;
    // The device's reflection lies just in front of its footprint, as seen from above: a soft purple there.
    vec2 local = vWorld.xz - view * 0.8;
    vec2 outside = max(abs(local) - uFootprint, 0.0);
    float sheen = exp(-dot(outside, outside) / 0.35) * uSheenStrength * streaks;
    vec3 floorColor = uColor + uPoolColor * pool + uSheenColor * sheen;
    #if defined( USE_FOG ) && defined( FOG_EXP2 )
      // At half the scene's strength: the far floor goes dark, not purple.
      float fogFactor = 0.5 * (1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth));
      floorColor = mix(floorColor, fogColor, fogFactor);
    #endif
    // The disc's edge fades away, so the backdrop shows beyond it (premultiplied).
    float edge = 1.0 - smoothstep(uRadius * 0.3, uRadius * 0.75, length(vWorld.xz));
    gl_FragColor = vec4(floorColor * edge, edge);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function buildFloor(options: FloorOptions): Floor {
  const group = new THREE.Group();
  group.name = 'studio:floor';
  group.position.y = options.y;

  const disc = (lift: number): THREE.BufferGeometry => {
    const geometry = new THREE.CircleGeometry(FLOOR.radius, SEGMENTS);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, lift, 0);
    return geometry;
  };

  const glossMaterial = new THREE.ShaderMaterial({
    name: 'studio:gloss',
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        tNoise: { value: null },
        uColor: { value: new THREE.Color(FLOOR.gloss) },
        uPoolColor: { value: new THREE.Color(FLOOR.pool) },
        uPool: { value: new THREE.Vector2(...options.pool) },
        uPoolStrength: { value: FLOOR.poolStrength },
        uSheenColor: { value: new THREE.Color(FLOOR.sheen) },
        uFootprint: { value: new THREE.Vector2(...options.footprint) },
        uSheenStrength: { value: FLOOR.sheenStrength },
        uRadius: { value: FLOOR.radius }
      }
    ]),
    vertexShader,
    fragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    fog: true
  });
  glossMaterial.uniforms.tNoise.value = options.noise;
  const gloss = new THREE.Mesh(disc(0), glossMaterial);
  gloss.name = 'studio:gloss';
  gloss.renderOrder = -4;
  gloss.raycast = () => {};

  const shadowMaterial = new THREE.ShadowMaterial({ name: 'studio:shadow', opacity: FLOOR.shadow, depthWrite: false });
  const shadow = new THREE.Mesh(disc(0.002), shadowMaterial);
  shadow.name = 'studio:shadow';
  shadow.receiveShadow = true;
  shadow.renderOrder = -3;
  shadow.raycast = () => {};

  group.add(gloss, shadow);

  const dispose = (): void => {
    gloss.geometry.dispose();
    glossMaterial.dispose();
    shadow.geometry.dispose();
    shadowMaterial.dispose();
    group.removeFromParent();
  };

  return { group, dispose };
}
