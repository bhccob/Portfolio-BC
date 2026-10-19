import * as THREE from 'three';

/**
 * The one beam of light: an open cone from a point above the stage down to
 * the floor, drawn additively in yellow-gold and over everything (it is the
 * lit air between the camera and the stage). Brightest just under its
 * source and fading as it falls, soft at its edges (a cone seen side-on is
 * thin at its rims), with faint rays of noise drifting slowly down it.
 */

export interface BeamOptions {
  /** The source, at the top of the cone. */
  apex: readonly [number, number, number];
  /** The floor's height, where the cone ends. */
  floor: number;
  /** The cone's radius at the floor. */
  radius: number;
  /** Shared noise (studio/noise.ts), not disposed by the beam. */
  noise: THREE.Texture;
}

export interface Beam {
  mesh: THREE.Mesh;
  /** Seconds since the studio began, for the drift. */
  setTime(seconds: number): void;
  dispose(): void;
}

export const BEAM = {
  color: 0xffcf33,
  /** The radius at the source: not a point, so the top is a soft spot, not a needle. */
  top: 0.14,
  intensity: 0.16
} as const;

const vertexShader = /* glsl */ `
uniform float uHeight;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;
varying float vAround;
void main() {
  vHeight = position.y / uHeight + 0.5;
  // The cylinder's own u runs once round it, with the seam's vertices doubled, so the rays do not pinch there.
  vAround = uv.x;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform sampler2D tNoise;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;
varying float vAround;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  // Face-on through the middle of the cone, grazing at its rims: soft edges.
  float facing = abs(dot(normalize(vNormal), V));
  // A bright core inside a broader glow.
  float edge = 0.55 * pow(facing, 6.0) + 0.45 * pow(facing, 2.0);
  // Bright under the source, falling away down the cone, faint where it lands.
  // Its very top fades too, so a camera backed far off sees a glow there, not the cone's tip.
  float fall = pow(vHeight, 1.5) * smoothstep(0.0, 0.45, vHeight) * (1.0 - smoothstep(0.8, 1.0, vHeight));
  // Rays: noise stretched down the cone, drifting slowly.
  float rays = texture2D(tNoise, vec2(vAround * 5.0, vHeight * 0.35 + uTime * 0.012)).g;
  float drift = texture2D(tNoise, vec2(vAround * 2.0 - uTime * 0.004, vHeight * 0.8 - uTime * 0.02)).r;
  float light = uIntensity * edge * fall * (0.35 + 1.1 * rays * rays * rays + 0.35 * drift);
  gl_FragColor = vec4(uColor * light, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function buildBeam(options: BeamOptions): Beam {
  const [x, y, z] = options.apex;
  const height = y - options.floor;
  const geometry = new THREE.CylinderGeometry(BEAM.top, options.radius, height, 64, 1, true);
  const material = new THREE.ShaderMaterial({
    name: 'studio:beam',
    uniforms: {
      uColor: { value: new THREE.Color(BEAM.color) },
      uIntensity: { value: BEAM.intensity },
      uTime: { value: 0 },
      uHeight: { value: height },
      tNoise: { value: options.noise }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    // Light in the air, over whatever it passes: depth-tested, the cone would cut a hard line where it
    // goes through the device.
    depthTest: false,
    side: THREE.DoubleSide,
    fog: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, options.floor + height / 2, z);
  mesh.name = 'studio:beam';
  mesh.renderOrder = 5;
  mesh.raycast = () => {};
  return {
    mesh,
    setTime: (seconds) => (material.uniforms.uTime.value = seconds),
    dispose: () => {
      geometry.dispose();
      material.dispose();
    }
  };
}
