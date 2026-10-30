/**
 * Brushed metal (round 8, spec 2026-10-30-bob-moonlit-3d-design.md: Bob found the compass and the tower "doesnt look
 * polished"): its highlight streaked and broken up, as metal turned on a lathe is.
 *
 * - `patchBrushed`: fine rings of roughness round a part's own Y axis, from its position in its own frame, so they need
 *   no UVs (the compass's gold tubes carry none, and the file's budget has no room for them).
 * - `roundTangents`: tangents running round the part's Y axis, so three's anisotropy (MeshPhysicalMaterial's
 *   `anisotropy`, which reads a geometry's `tangent`) streaks the highlight along the rings.
 *
 * No React; pure but for the geometry it is handed.
 */
import * as THREE from 'three';

/** How many rings to the metre, out from the axis and up it. */
const RINGS = { out: 900, up: 600 } as const;

/** The patch for a standard or physical material's `onBeforeCompile`: its roughness between `range`, ring by ring. */
export function patchBrushed(range: readonly [number, number]): (shader: { vertexShader: string; fragmentShader: string }) => void {
  const [lo, hi] = range;
  return (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBrushPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvBrushPos = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBrushPos;').replace(
      '#include <roughnessmap_fragment>',
      [
        '#include <roughnessmap_fragment>',
        `\tvec2 brushRing = floor( vec2( length( vBrushPos.xz ) * ${RINGS.out}.0, vBrushPos.y * ${RINGS.up}.0 ) );`,
        '\tfloat brush = fract( sin( dot( brushRing, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );',
        `\troughnessFactor = mix( ${lo.toFixed(3)}, ${hi.toFixed(3)}, brush );`
      ].join('\n')
    );
  };
}

/** Sets `geometry`'s tangents round its own Y axis (a point on the axis gets +X). */
export function roundTangents(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute('position');
  const tangents = new Float32Array(position.count * 4);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const r = Math.hypot(x, z);
    tangents.set(r > 1e-9 ? [-z / r, 0, x / r, 1] : [1, 0, 0, 1], i * 4);
  }
  geometry.setAttribute('tangent', new THREE.BufferAttribute(tangents, 4));
}
