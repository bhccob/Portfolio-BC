import * as THREE from 'three';

/**
 * The studio's far wall: a large sphere seen from inside, dark all round
 * (#07040d) with a faint purple glow (#1c1030) behind the device. The glow
 * is fixed in the world, low and behind the stand, so turning the device
 * moves it a little, as a lit backdrop would. Its colours are written as
 * given (not tone mapped, not fogged), with a little dither so the dark
 * gradient does not band.
 */

export interface Backdrop {
  mesh: THREE.Mesh;
  dispose(): void;
}

export const BACKDROP = {
  radius: 40,
  glow: 0x1c1030,
  edge: 0x07040d,
  /** Where the glow is centred unless a scene says otherwise, from the middle of the stage: straight on past the device from the hub's camera. */
  direction: [-0.34, -0.53, -0.78] as const,
  /** The glow's half-width, as the cosine of the angle off its centre where it has faded out. */
  spread: 0.86
} as const;

const vertexShader = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uGlow;
uniform vec3 uEdge;
uniform vec3 uDirection;
uniform float uSpread;
varying vec3 vDirection;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 d = normalize(vDirection);
  float facing = dot(d, uDirection);
  float glow = smoothstep(uSpread, 1.0, facing);
  glow *= glow;
  // A touch darker towards the zenith, as a wall rolls off into the ceiling.
  glow *= 1.0 - 0.5 * smoothstep(0.1, 0.8, d.y);
  gl_FragColor = vec4(mix(uEdge, uGlow, glow), 1.0);
  #include <colorspace_fragment>
  gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
}`;

export interface BackdropOptions {
  /** Where the glow is centred, from the sphere's middle (normalised here); BACKDROP.direction by default. */
  direction?: readonly [number, number, number];
}

export function buildBackdrop(options: BackdropOptions = {}): Backdrop {
  const direction = options.direction ?? BACKDROP.direction;
  const geometry = new THREE.SphereGeometry(BACKDROP.radius, 48, 24);
  const material = new THREE.ShaderMaterial({
    name: 'studio:backdrop',
    uniforms: {
      uGlow: { value: new THREE.Color(BACKDROP.glow) },
      uEdge: { value: new THREE.Color(BACKDROP.edge) },
      uDirection: { value: new THREE.Vector3(...direction).normalize() },
      uSpread: { value: BACKDROP.spread }
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'studio:backdrop';
  mesh.renderOrder = -10;
  mesh.raycast = () => {};
  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    }
  };
}
