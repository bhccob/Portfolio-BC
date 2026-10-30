/**
 * Two gold gyroscope rings round the stack (spec 2026-10-29-bob-stack-2-design.md, goal 3: "need more gold rings",
 * then "just go with the gyroscope", its outer ring "automatically slow rotates"; the rings mock-up's `gyro`; Bob,
 * 2026-10-30: "make the strings on the tower less since it looks too busy ... where the strings are thick and go past the
 * screen", and of two mock-ups he picked B, .superpowers/strings/): two thick rings round the machine's middle, so large
 * they run past the screen at the world's stop, each tipped its own way and turning slowly on its own axis, as an
 * armillary sphere's, a few small lights riding on them; the outer one carries a dial of ticks and swings slowly round the
 * stack on its own. Gold metal lit by the light above, a little see-through; it fades away where it passes near the
 * camera, so it never stands between the visitor and what is in view.
 *
 * No React: the Void builds it with the world and poses it from the path (src/scene/bob/worldPath.ts `rings`: lit with
 * the power board's power, stepped back at a board's stop and in the Q&A), on the world's clock.
 */
import * as THREE from 'three';
import { palette } from '~/engine/palette';

type Vec3 = readonly [number, number, number];

const D = Math.PI / 180;

/**
 * The gyroscope's measures: each ring's radius, tube, tilt, turn on its own axis (rad/s), lights riding on it and whether
 * it has the dial; the outermost's `swing` round the stack (rad/s, about two minutes a turn); the rings' light at full
 * strength (`level`), how see-through (`alpha`) and how much they catch the light (`spec`). Bob's B: the mock-up's
 * near-upright ring and its near-level dial ring, some three to four times as thick and half as large again, brighter.
 */
export const GYRO_LOOK = {
  rings: [
    { radius: 19, tube: 0.26, tilt: [74 * D, 20 * D, 0] as const, speed: 0.05, riders: 2, dial: false, glow: 0.2 },
    { radius: 23, tube: 0.34, tilt: [10 * D, 0, -6 * D] as const, speed: 0.018, riders: 4, dial: true, glow: 0.24 }
  ],
  swing: 0.05,
  level: 1.1,
  alpha: 0.9,
  spec: 0.6
} as const;

const RING_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const RING_FRAGMENT = /* glsl */ `
  uniform vec3 uGold;
  uniform vec3 uLight;
  uniform float uLevel;
  uniform float uGlow;
  uniform float uSpec;
  uniform float uAlpha;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(cameraPosition - vWorld);
    // Gold metal: dark where it turns away, a warm sheen toward the top light, a bright line where it catches it.
    vec3 l = normalize(vec3(0.3, 1.0, 0.4));
    float key = max(dot(n, l), 0.0);
    float spec = pow(max(dot(n, normalize(v + l)), 0.0), 48.0);
    float rim = pow(max(1.0 - max(dot(n, v), 0.0), 0.0), 2.0);
    vec3 c = uGold * (0.16 + 0.55 * key) + uLight * (spec * 1.6 * uSpec + rim * 0.35) + uGold * uGlow;
    // Away where it passes near the camera.
    float near = smoothstep(12.0, 30.0, distance(cameraPosition, vWorld));
    gl_FragColor = vec4(c * uLevel, near * uLevel * uAlpha);
  }
`;

/** What the gyroscope is posed by, each frame. */
export interface GyroPose {
  /** Its light, 0..1 (the power board's power): 0 hides it. */
  level: number;
  /** How far it stands back, 0..1: 1 at the world and the look back, 0.42 at a board's stop and in the Q&A. */
  focus: number;
  /** The world's clock, s: the turns. */
  clock: number;
}

export interface GyroModel {
  /** `gyro`: each ring's tipped pivot (`gyro:ring:<k>`) and turning part (`gyro:spin:<k>`); the outer's in `gyro:turner`. */
  group: THREE.Group;
  pose(p: GyroPose): void;
  dispose(): void;
}

/** A soft round light for the riders, made on the CPU. */
function glowTexture(size: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.min(1, Math.hypot(x / (size - 1) - 0.5, y / (size - 1) - 0.5) * 2);
      data.set([255, 255, 255, Math.round(255 * Math.pow(Math.max(0, 1 - r), 2.4))], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Builds the gyroscope round the machine's middle `centre`, dark. */
export function buildGyro(centre: Vec3): GyroModel {
  const look = GYRO_LOOK;
  const group = new THREE.Group();
  group.name = 'gyro';
  group.visible = false;
  const glow = glowTexture(64);
  const gold = new THREE.Color(palette.gold);
  const goldLight = new THREE.Color(palette.goldLight);
  const flat = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateX(Math.PI / 2);
  const turner = new THREE.Group();
  turner.name = 'gyro:turner';
  turner.position.set(centre[0], centre[1], centre[2]);
  group.add(turner);
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  const rings = look.rings.map((spec, k) => {
    const pivot = new THREE.Group();
    pivot.name = `gyro:ring:${k}`;
    pivot.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
    const spin = new THREE.Group();
    spin.name = `gyro:spin:${k}`;
    pivot.add(spin);
    const band = new THREE.ShaderMaterial({
      name: `gyro:band:${k}`,
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      uniforms: {
        uGold: { value: gold.clone() },
        uLight: { value: goldLight.clone() },
        uLevel: { value: 0 },
        uGlow: { value: spec.glow },
        uSpec: { value: look.spec },
        uAlpha: { value: look.alpha }
      },
      transparent: true,
      depthWrite: false
    });
    materials.push(band);
    const torus = flat(new THREE.TorusGeometry(spec.radius, spec.tube, 12, 512));
    geometries.push(torus);
    const mesh = new THREE.Mesh(torus, band);
    mesh.name = `gyro:band:${k}`;
    spin.add(mesh);
    // A fine dashed ring beside it, flat in its plane.
    // The outermost's dial: a tick every 2°, longer every 10°, inside the band.
    if (spec.dial) {
      const tick = new THREE.BoxGeometry(0.03, 0.012, 1);
      geometries.push(tick);
      const dial = new THREE.InstancedMesh(tick, band, 180);
      dial.name = `gyro:dial:${k}`;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const p = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < 180; i++) {
        const t = (i / 180) * Math.PI * 2;
        const len = i % 5 === 0 ? 0.5 : 0.22;
        const at = spec.radius - 0.12 - len / 2;
        dial.setMatrixAt(i, m.compose(p.set(Math.sin(t) * at, 0, Math.cos(t) * at), q.setFromAxisAngle(up, t), s.set(1, 1, len)));
      }
      dial.instanceMatrix.needsUpdate = true;
      spin.add(dial);
    }
    // The lights riding on it.
    const riders = Array.from({ length: spec.riders }, (_, j) => {
      const material = new THREE.SpriteMaterial({ map: glow, color: goldLight, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      materials.push(material);
      const rider = new THREE.Sprite(material);
      rider.scale.setScalar(0.9);
      const t = (j / spec.riders) * Math.PI * 2 + 0.6;
      rider.position.set(Math.sin(t) * spec.radius, 0, Math.cos(t) * spec.radius);
      spin.add(rider);
      return material;
    });
    // The outermost swings round the stack inside the turner; the others stand round the middle.
    if (k === look.rings.length - 1) turner.add(pivot);
    else {
      pivot.position.set(centre[0], centre[1], centre[2]);
      group.add(pivot);
    }
    return { spin, band, riders, speed: spec.speed };
  });

  return {
    group,
    pose({ level, focus, clock }) {
      const lit = Math.min(Math.max(level, 0), 1) * Math.min(Math.max(focus, 0), 1);
      group.visible = level > 0.001;
      if (!group.visible) return;
      const ringLevel = look.level * lit;
      // About two minutes a turn: seen to move, never hurried.
      turner.rotation.y = clock * look.swing;
      for (const ring of rings) {
        ring.spin.rotation.y = clock * ring.speed;
        ring.band.uniforms.uLevel!.value = ringLevel;
        ring.riders.forEach((m, j) => {
          m.opacity = ringLevel * (0.55 + 0.45 * Math.sin(clock * 1.3 + j * 2.1));
        });
      }
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      glow.dispose();
    }
  };
}
