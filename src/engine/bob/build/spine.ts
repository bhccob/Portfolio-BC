/**
 * The quantum spine, built in code (spec 2026-10-28-bob-quantum-stack-design.md; after the mock-up Bob approved,
 * .superpowers/holo-world-4-mockup/spine.ts): the machine the boards are threaded on. Dark gunmetal flanges with thin
 * gold edges, bundles of dark and copper cables bowing out between them, small connectors round every flange, a glass
 * core with cold violet light in it and the gold light from the fall running down its middle, a violet lamp in each span.
 *
 * Each span (from under one board to the top of the next; the last one a tip under the last board) is its own piece,
 * made at the open gap and squeezed to the gap of the moment (`pose`), so the stack can start closed and explode open,
 * the spine telescoping out between the boards (its dashed gold guide lines from rim to rim went with the gyroscope's
 * dashes, Bob 2026-10-30: the tower's strings "too busy"). The light runs down it from the top as the power does (`set`).
 * It reads no clock of its own.
 */
import * as THREE from 'three';
import type { QualityTier } from '~/engine/quality';
import { seeded } from './plate';

/**
 * How the spine looks: its cable bundles a span by tier (the tip half as many); how far the tip hangs below the last
 * board, m; a lamp's light at full power.
 */
export const SPINE_LOOK = {
  bundles: { high: 24, medium: 16, low: 10 },
  tip: 3.4,
  lamp: 3.6
} as const;

const GOLD = 0xd9a520;
const GOLD_LIGHT = new THREE.Color(0xffbf6f);
const HAZE = new THREE.Color(0x8a6cf2);
/** The space left between a span's foot and the board below it, m. */
const FOOT = 0.1;
/** How far past the spine's foot the power's reach runs at full power, m: every lamp whole by then. */
const OVERSHOOT = 2;

const CORE_VERTEX = /* glsl */ `
  varying float vFacing;
  varying float vY;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vY = w.y;
    vec3 n = normalize(mat3(modelMatrix) * normal);
    vFacing = abs(dot(n, normalize(cameraPosition - w.xyz)));
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const CORE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uReach;
  uniform vec3 uViolet;
  uniform vec3 uGold;
  varying float vFacing;
  varying float vY;
  void main() {
    // Lit from the top down as far as the power has reached.
    float on = 1.0 - smoothstep(uReach - 1.0, uReach, -vY);
    float edge = pow(clamp(1.0 - vFacing, 0.0, 1.0), 1.4);
    float pulse = pow(max(0.0, sin(vY * 1.3 + uTime * 2.2)), 18.0);
    float off = (vFacing - 1.0) * 9.0;
    float axis = exp(-off * off);
    vec3 c = uViolet * (0.18 + 0.7 * edge + 0.5 * pulse) + uGold * axis * (0.35 + 0.8 * pulse);
    gl_FragColor = vec4(c * on * uLevel, 1.0);
  }
`;

export interface SpineSpec {
  /** The boards' tops with the stack open, world y, the power board's first: the spine hangs under it. */
  tops: number[];
  hole: number;
  thick: number;
}

export interface SpineModel {
  group: THREE.Group;
  /** Places each span between the boards whose tops are at `tops` (world y), squeezing it to fit; the tip under the last. */
  pose(tops: number[]): void;
  /** `power` 0..1 how far down the light has reached, `level` the whole spine's (dim while a project is open). */
  set(clock: number, power: number, level: number): void;
  /** Turns what its metal reflects with the camera's azimuth. */
  turn(azimuth: number): void;
  dispose(): void;
}

/** A flange: a flat dark ring of metal with gold lips, `r0` to `r1` across, `h` thick. */
function flange(r0: number, r1: number, h: number, metal: THREE.Material, edge: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(r0, -h / 2),
        new THREE.Vector2(r1, -h / 2),
        new THREE.Vector2(r1 + 0.02, -h / 4),
        new THREE.Vector2(r1 + 0.02, h / 4),
        new THREE.Vector2(r1, h / 2),
        new THREE.Vector2(r0, h / 2),
        new THREE.Vector2(r0, -h / 2)
      ],
      72
    ),
    metal
  );
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r1 + 0.02, 0.008, 6, 96).rotateX(Math.PI / 2), edge);
  lip.position.y = h / 4;
  const lip2 = new THREE.Mesh(lip.geometry.clone(), edge);
  lip2.position.y = -h / 4;
  g.add(body, lip, lip2);
  return g;
}

/** The spine for the boards of `spec` at this tier, its metal reflecting `room` (none: unlit by a room). */
export function buildSpine(spec: SpineSpec, tier: QualityTier, room: THREE.Texture | null): SpineModel {
  const { tops, hole, thick } = spec;
  const group = new THREE.Group();
  group.name = 'spine';
  const random = seeded(808);
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2833, metalness: 0.9, roughness: 0.3, envMap: room, envMapIntensity: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141019, metalness: 0.75, roughness: 0.4, envMap: room, envMapIntensity: 0.35 });
  const edge = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.4, envMap: room, envMapIntensity: 0.5 });
  const cableDark = new THREE.MeshStandardMaterial({ color: 0x17121d, metalness: 0.55, roughness: 0.38, envMap: room, envMapIntensity: 0.4 });
  const cableCopper = new THREE.MeshStandardMaterial({ color: 0x8a5634, metalness: 1, roughness: 0.32, envMap: room, envMapIntensity: 0.45 });
  const coreMaterial = new THREE.ShaderMaterial({
    vertexShader: CORE_VERTEX,
    fragmentShader: CORE_FRAGMENT,
    uniforms: { uTime: { value: 0 }, uLevel: { value: 1 }, uReach: { value: 0 }, uViolet: { value: HAZE.clone() }, uGold: { value: GOLD_LIGHT.clone() } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const TIP = SPINE_LOOK.tip;
  const spans: { piece: THREE.Group; height: number; lamp: THREE.PointLight }[] = [];
  for (let k = 0; k < tops.length; k++) {
    const last = k === tops.length - 1;
    // Made at the open gap, from 0 (under the board above) down to -height (over the board below).
    const height = last ? TIP : tops[k]! - thick - tops[k + 1]! - FOOT;
    const piece = new THREE.Group();
    piece.name = `spine:span${k}`;
    const pins: THREE.Vector3[] = [];
    // The power board has no hole: under it the spine is narrower.
    const neck = k === 0 ? hole - 0.1 : hole - 0.06;
    const levels: [number, number, number][] = [
      [-0.05, 0.36, neck],
      [-height * 0.3, 0.36, last ? 1.2 : 1.95],
      [-height * 0.62, 0.36, last ? 0.9 : 1.6],
      [-height + 0.12, 0.34, last ? 0.42 : hole - 0.06]
    ];
    levels.forEach(([y, r0, r1], n) => {
      const f = flange(r0, r1, n === 1 ? 0.09 : 0.06, n === 0 ? dark : metal, edge);
      f.position.y = y;
      piece.add(f);
      if (n > 0 && n < 3) {
        const count = Math.round(r1 * 22);
        for (let i = 0; i < count; i++) {
          const t = (i / count) * Math.PI * 2 + n * 0.2;
          pins.push(new THREE.Vector3(Math.sin(t) * (r1 - 0.12), y - 0.1, Math.cos(t) * (r1 - 0.12)));
        }
      }
    });
    const plate = flange(0.36, last ? 1.0 : 1.45, 0.05, dark, edge);
    plate.position.y = -height * 0.16;
    piece.add(plate);
    const bundles = last ? Math.round(SPINE_LOOK.bundles[tier] / 2) : SPINE_LOOK.bundles[tier];
    for (let b = 0; b < bundles; b++) {
      const t0 = (b / bundles) * Math.PI * 2 + k * 0.3;
      for (let c = 0; c < 4; c++) {
        const t = t0 + (c - 1.5) * 0.05;
        const yTop = levels[1]![0] - 0.06;
        const yMid = levels[2]![0] + 0.06;
        const yEnd = levels[3]![0] + 0.08;
        const rTop = levels[1]![2] - 0.22;
        const rEnd = Math.max(0.36, levels[3]![2] - 0.1);
        const bulge = rTop + 0.46 + random() * 0.2;
        const pts = [
          [rTop, yTop],
          [bulge, yTop - (yTop - yMid) * 0.5],
          [levels[2]![2] - 0.15, yMid + 0.02],
          [levels[2]![2] - 0.1, yMid - 0.14],
          [Math.max(rEnd, (levels[2]![2] + rEnd) / 2 + 0.15), (yMid + yEnd) / 2],
          [rEnd, yEnd]
        ].map(([r, y]) => new THREE.Vector3(Math.sin(t) * r!, y!, Math.cos(t) * r!));
        piece.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.032, 6), c === 1 && b % 3 === 0 ? cableCopper : cableDark));
      }
    }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, height, 48, 1, true).translate(0, -height / 2, 0), coreMaterial);
    core.name = `spine:core${k}`;
    core.renderOrder = 3;
    piece.add(core);
    if (last) {
      for (let n = 0; n < 5; n++) {
        const f = flange(0.14, 0.8 - n * 0.14, 0.06, n % 2 ? dark : metal, edge);
        f.position.y = -height + 0.6 - n * 0.22;
        piece.add(f);
      }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 24).rotateX(Math.PI), metal);
      tip.name = 'spine:tip';
      tip.position.y = -height - 0.35;
      piece.add(tip);
    }
    const pinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), edge, Math.max(1, pins.length));
    const m = new THREE.Matrix4();
    pins.forEach((p, i) => pinMesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    pinMesh.count = pins.length;
    piece.add(pinMesh);
    const lamp = new THREE.PointLight(HAZE, 0, 8, 1.6);
    lamp.name = `spine:lamp${k}`;
    lamp.position.y = -height / 2;
    piece.add(lamp);
    piece.position.y = tops[k]! - thick;
    group.add(piece);
    spans.push({ piece, height, lamp });
  }

  let reachTop = (tops[0] ?? 0) - thick;
  let reachBottom = (tops[tops.length - 1] ?? 0) - thick - TIP;
  const dims = [metal, dark, edge, cableDark, cableCopper].map((mat) => ({ mat, colour: mat.color.clone(), reflects: mat.envMapIntensity }));
  return {
    group,
    pose(now) {
      spans.forEach(({ piece, height }, k) => {
        piece.position.y = now[k]! - thick;
        const gap = k + 1 < now.length ? now[k]! - thick - now[k + 1]! - FOOT : height;
        piece.scale.y = Math.max(0.02, gap / height);
      });
      reachTop = now[0]! - thick;
      reachBottom = now[now.length - 1]! - thick - TIP;
    },
    set(clock, power, level) {
      // How far down the light has reached, as −y: from the spine's top at no power to past its foot at full power.
      const reach = power * (reachTop - reachBottom + OVERSHOOT) - reachTop;
      coreMaterial.uniforms.uTime!.value = clock;
      coreMaterial.uniforms.uReach!.value = reach;
      coreMaterial.uniforms.uLevel!.value = 0.4 + 0.6 * level;
      spans.forEach(({ piece, height, lamp }) => {
        const bottom = piece.position.y - height * piece.scale.y;
        const lit = Math.min(1, Math.max(0, (reach + bottom) / 2));
        lamp.intensity = SPINE_LOOK.lamp * lit * (0.3 + 0.7 * level) * piece.scale.y;
      });
      const lit = 0.25 + 0.75 * level;
      for (const { mat, colour, reflects } of dims) {
        mat.color.copy(colour).multiplyScalar(lit);
        mat.envMapIntensity = reflects * lit;
      }
    },
    turn(azimuth) {
      for (const { mat } of dims) mat.envMapRotation.y = azimuth;
    },
    dispose() {
      const materials = new Set<THREE.Material>();
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.geometry) return;
        mesh.geometry.dispose();
        for (const mat of ([] as THREE.Material[]).concat(mesh.material)) materials.add(mat);
      });
      for (const mat of materials) mat.dispose();
      for (const { lamp } of spans) lamp.dispose();
    }
  };
}
