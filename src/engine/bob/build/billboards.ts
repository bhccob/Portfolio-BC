/**
 * Many small camera-facing pictures in one draw: what a `THREE.Sprite` each would look like (the same quad, the same
 * size in world metres, the same picture by its alpha, added to what lies behind), without an object, a material and a
 * draw call each. The stars ran to 484 sprites and the light's vias to 120, each a draw of its own every frame: on a
 * laptop those draws alone can take most of a frame. No React, and nothing here is done per frame.
 */
import * as THREE from 'three';

const QUAD_POSITIONS = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0];
const QUAD_UVS = [0, 0, 1, 0, 1, 1, 0, 1];
const QUAD_INDEX = [0, 1, 2, 0, 2, 3];

/** A geometry of `count` camera-facing quads: the instanced attributes are the caller's. */
export function billboardGeometry(count: number): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(QUAD_POSITIONS, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(QUAD_UVS, 2));
  geometry.setIndex(QUAD_INDEX);
  geometry.instanceCount = count;
  return geometry;
}

/** The picture's colour and alpha, added to the scene, tone-mapped and encoded as a sprite's would be. */
export const BILLBOARD_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vColour;
  varying float vOpacity;
  void main() {
    vec4 picture = texture2D(uMap, vUv);
    gl_FragColor = vec4(vColour * picture.rgb, vOpacity * picture.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** A mesh that lets rays through, as the sprites in the light and the stars never took a click. */
export function billboardMesh(name: string, geometry: THREE.InstancedBufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  // The quads are spread over the whole field: there is no bound worth testing, and a few hundred quads cost nothing.
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  return mesh;
}
