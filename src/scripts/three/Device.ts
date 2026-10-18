import * as THREE from 'three';
import { chip, PIN_REACH, pinOffsets, socket } from './parts/chip';
import { caseGeometry, gold, panelGeometry, satin, slab, slabGeometry } from './parts/slab';
import { trace } from './parts/trace';
import { palette } from './palette';
import { LAYERS, poseAt, type LayerId, type Pose } from './Teardown';

/**
 * The handheld dev kit: a purple, toy-like landscape handheld built from a
 * few rounded parts, in the five layers the teardown lifts apart. It lies
 * flat in the XZ plane with y up, x across its width and +z towards the
 * viewer. Each layer's parts sit just above that layer's origin, so at the
 * closed heights the stack reads as one body, with the shell's walls hanging
 * down over the rest. Built without a renderer or the DOM; textures come from
 * the caller, and without them the screen is dark and the label plain.
 */

export const CHIP_SLUGS = ['funcial', 'jontai-energy', 'cookies-clicker', 'next'] as const;

export interface DeviceTextures {
  /** Shown on the display, glowing; drawn upright for a viewer in front of the device. */
  screen?: THREE.Texture;
  /** Printed on the back plate's label. */
  spec?: THREE.Texture;
}

export interface DeviceModel {
  group: THREE.Group;
  layers: Record<LayerId, THREE.Object3D>;
  /** In CHIP_SLUGS order, each with `userData.slug`; the last is the empty socket. */
  chips: THREE.Mesh[];
  /** The yellow ball, the site's mark. */
  powerButton: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  /** Sets each layer's height from the pose. */
  applyPose(pose: Pose): void;
}

/** The display's size, so a screen texture can be drawn at its aspect (1.675 : 1). */
export const SCREEN_DISPLAY = { width: 1.34, depth: 0.8 } as const;

/** The back plate's label, so a spec texture can be drawn at its aspect (3.6 : 1). */
export const SPEC_LABEL = { width: 1.8, depth: 0.5 } as const;

/** The body seen from above. */
const BODY = { width: 3.2, depth: 1.8, radius: 0.32 };

/** The finish of the case parts: satin with a light clear coat. */
const CASE_FINISH = { clearcoat: 0.3 };

/** Lifts a flat part off the surface under it, so the two never fight for the same depth. */
const DECAL = 0.0015;

/** Each layer's resting height, which the parts are sized to fit between. */
const CLOSED = poseAt(0).offsets;

/** The back plate, at the bottom of the stack. */
const BACK = { height: 0.04 };

/** The top case: its top, its walls (down to the back plate when closed) and the window over the display. */
const SHELL = {
  top: 0.06,
  wall: 0.06,
  drop: CLOSED.shell - (CLOSED.back + BACK.height),
  opening: { width: 1.42, depth: 0.87, radius: 0.07 }
};

/** The controls on the shell's top, which they sink into a little. */
const CONTROL = { sink: 0.02, height: 0.05 };
const DPAD = { x: -1.155, z: 0.04, span: 0.42, arm: 0.14 };
const BUTTONS = { radius: 0.1, a: [1.28, -0.05], b: [1.03, 0.13] } as const;
/** The power ball, at the top right: its centre this far above the top, in a collar of this radius. */
const POWER = { radius: 0.09, x: 1.22, z: -0.6, rise: 0.04, collar: 0.115 };

/** The display module under the window. */
const SCREEN = { width: 1.5, depth: 0.95, height: 0.05, radius: 0.07 };

/** The PCB, inside the shell's walls. */
const BOARD = { width: 2.9, depth: 1.5, height: 0.04, radius: 0.2 };

/** The chips sit in a row, in CHIP_SLUGS order, centred across the board. */
const CHIP_ROW = { z: -0.1, gap: 0.17 };
const CHIP_SIZES: Record<(typeof CHIP_SLUGS)[number], { width: number; depth: number }> = {
  funcial: { width: 0.55, depth: 0.4 },
  'jontai-energy': { width: 0.55, depth: 0.34 },
  'cookies-clicker': { width: 0.45, depth: 0.4 },
  next: { width: 0.45, depth: 0.4 }
};

/** The front bus every chip feeds, and the back line the bridges between neighbours run along. */
const TRACES = { bus: 0.5, busEnd: 1.2, drop: 0.36, back: -0.5, rise: -0.42, bend: 0.08 };

/** The cell, its band and its tabs. */
const BATTERY = { width: 2.3, depth: 1.1, height: 0.07, radius: 0.18 };
const BAND = { x: -0.6, width: 0.44 };
const TABS = { width: 0.14, height: 0.012, depth: 0.12, z: 0.24 };

/** Four screws, one in each corner of the back plate inside the walls. */
const SCREWS = { x: 1.36, z: 0.66, radius: 0.05, height: 0.02 };

function named<T extends THREE.Object3D>(object: T, name: string): T {
  object.name = name;
  return object;
}

/** Shell: the top case with the D-pad, the two buttons and the yellow power ball. Returns the ball. */
function buildShell(layer: THREE.Object3D): DeviceModel['powerButton'] {
  const shell = new THREE.Mesh(caseGeometry({ ...BODY, ...SHELL }), satin(palette.pcb, CASE_FINISH));
  layer.add(named(shell, 'shell:case'));

  const base = SHELL.top - CONTROL.sink;
  // Two crossed bars; the upright one sits a hair lower, so their tops never share a plane.
  const across = slab(DPAD.span, CONTROL.height, DPAD.arm, 0.025, palette.cream);
  across.position.set(DPAD.x, base + CONTROL.height / 2, DPAD.z);
  const upright = new THREE.Mesh(slabGeometry(DPAD.arm, CONTROL.height, DPAD.span, 0.025), across.material);
  upright.position.set(DPAD.x, base + CONTROL.height / 2 - 0.003, DPAD.z);
  layer.add(named(across, 'shell:dpad-across'), named(upright, 'shell:dpad-upright'));

  const size = BUTTONS.radius * 2;
  const buttonA = slab(size, CONTROL.height, size, BUTTONS.radius, palette.cream);
  buttonA.position.set(BUTTONS.a[0], base + CONTROL.height / 2, BUTTONS.a[1]);
  const buttonB = buttonA.clone();
  buttonB.position.set(BUTTONS.b[0], base + CONTROL.height / 2, BUTTONS.b[1]);
  layer.add(named(buttonA, 'shell:button-a'), named(buttonB, 'shell:button-b'));

  // The ball sits in a dark collar, rising well clear of the top.
  const collarHeight = 0.014;
  const collar = slab(POWER.collar * 2, collarHeight, POWER.collar * 2, POWER.collar, palette.boardDeep);
  collar.position.set(POWER.x, SHELL.top - 0.004 + collarHeight / 2, POWER.z);
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(POWER.radius, 32, 20),
    satin(palette.yellow, { roughness: 0.45, ...CASE_FINISH })
  );
  ball.position.set(POWER.x, SHELL.top + POWER.rise, POWER.z);
  layer.add(named(collar, 'shell:power-collar'), named(ball, 'shell:power'));
  return ball;
}

function displayMaterial(texture: THREE.Texture | undefined): THREE.MeshPhysicalMaterial {
  const glass = { roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.2 };
  if (!texture) return new THREE.MeshPhysicalMaterial({ color: palette.ink, ...glass });
  // The image glows on its own, untouched by the lights and the tone mapping, so its colours stay true.
  return new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: texture, toneMapped: false, ...glass });
}

/** Screen: the display module, its display glowing with the screen texture. */
function buildScreen(layer: THREE.Object3D, texture: THREE.Texture | undefined): void {
  const housing = slab(SCREEN.width, SCREEN.height, SCREEN.depth, SCREEN.radius, palette.boardDeep, CASE_FINISH);
  housing.position.y = SCREEN.height / 2;
  const display = new THREE.Mesh(panelGeometry(SCREEN_DISPLAY.width, SCREEN_DISPLAY.depth, 0.035), displayMaterial(texture));
  display.position.y = SCREEN.height + DECAL;
  layer.add(named(housing, 'screen:module'), named(display, 'screen:display'));
}

/** The pin offset of a chip nearest to `offset`. */
function nearestPin(width: number, offset: number): number {
  return pinOffsets(width).reduce((best, x) => (Math.abs(x - offset) < Math.abs(best - offset) ? x : best));
}

/** Board: the PCB with its chips in a row and the traces between them. Returns the chips. */
function buildBoard(layer: THREE.Object3D): THREE.Mesh[] {
  const pcb = slab(BOARD.width, BOARD.height, BOARD.depth, BOARD.radius, palette.pcb, { roughness: 0.6 });
  pcb.position.y = BOARD.height / 2;
  layer.add(named(pcb, 'board:pcb'));

  const sizes = CHIP_SLUGS.map((slug) => CHIP_SIZES[slug]);
  const rowWidth = sizes.reduce((sum, size) => sum + size.width, 0) + CHIP_ROW.gap * (sizes.length - 1);
  let left = -rowWidth / 2;
  const row = sizes.map((size) => {
    const x = left + size.width / 2;
    left += size.width + CHIP_ROW.gap;
    return { ...size, x, front: CHIP_ROW.z + size.depth / 2 + PIN_REACH, back: CHIP_ROW.z - size.depth / 2 - PIN_REACH };
  });

  const chips = CHIP_SLUGS.map((slug, i) => {
    const { width, depth, x } = row[i];
    const part = slug === 'next' ? socket(slug, width, depth) : chip(slug, width, depth);
    part.position.set(x, BOARD.height, CHIP_ROW.z);
    layer.add(part);
    return part;
  });

  const y = BOARD.height + DECAL;
  const paths: [number, number][][] = [
    [
      [-TRACES.busEnd, TRACES.bus],
      [TRACES.busEnd, TRACES.bus]
    ]
  ];
  // Every chip drops a trace to the bus at the front, bending onto it at 45°.
  for (const { width, x, front } of row) {
    const pin = x + nearestPin(width, 0);
    const bend = TRACES.bus - TRACES.drop;
    paths.push([
      [pin, front],
      [pin, TRACES.drop],
      [pin + bend, TRACES.bus]
    ]);
  }
  // Behind the row, each chip is bridged to the next: the projects in order, then the empty socket.
  for (let i = 0; i + 1 < row.length; i++) {
    const from = row[i].x + nearestPin(row[i].width, 0.17);
    const to = row[i + 1].x + nearestPin(row[i + 1].width, -0.17);
    paths.push([
      [from, row[i].back],
      [from, TRACES.rise],
      [from + TRACES.bend, TRACES.back],
      [to - TRACES.bend, TRACES.back],
      [to, TRACES.rise],
      [to, row[i + 1].back]
    ]);
  }
  paths.forEach((path, i) => layer.add(named(trace(path, y), `board:trace-${i}`)));

  return chips;
}

/** Battery: a cream cell with a yellow band round it and two gold tabs at one end. */
function buildBattery(layer: THREE.Object3D): void {
  const cell = slab(BATTERY.width, BATTERY.height, BATTERY.depth, BATTERY.radius, palette.cream, { roughness: 0.55 });
  cell.position.y = BATTERY.height / 2;

  // A little proud of the cell on every side but the bottom, where it stops just short.
  const bandHeight = BATTERY.height + 0.004;
  const band = slab(BAND.width, bandHeight, BATTERY.depth + 0.016, bandHeight / 2, palette.yellow);
  band.position.set(BAND.x, 0.001 + bandHeight / 2, 0);

  const tab = new THREE.Mesh(slabGeometry(TABS.width, TABS.height, TABS.depth, TABS.height / 2), gold());
  tab.position.set(BATTERY.width / 2 + TABS.width / 2 - 0.03, BATTERY.height / 2, TABS.z);
  const otherTab = tab.clone();
  otherTab.position.z = -TABS.z;

  layer.add(named(cell, 'battery:cell'), named(band, 'battery:band'), named(tab, 'battery:tab-front'), named(otherTab, 'battery:tab-back'));
}

function labelMaterial(texture: THREE.Texture | undefined): THREE.MeshPhysicalMaterial {
  if (!texture) return satin(palette.boardDeep, { roughness: 0.55 });
  return new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.55 });
}

/** Back: the plate, its spec label and four screws at the corners. */
function buildBack(layer: THREE.Object3D, texture: THREE.Texture | undefined): void {
  const plate = slab(BODY.width, BACK.height, BODY.depth, BODY.radius, palette.board, { roughness: 0.55, ...CASE_FINISH });
  plate.position.y = BACK.height / 2;

  const label = new THREE.Mesh(panelGeometry(SPEC_LABEL.width, SPEC_LABEL.depth, 0.04), labelMaterial(texture));
  label.position.y = BACK.height + DECAL;

  const screwSize = SCREWS.radius * 2;
  const screws = new THREE.InstancedMesh(
    slabGeometry(screwSize, SCREWS.height, screwSize, SCREWS.radius),
    satin(palette.cream),
    4
  );
  const place = new THREE.Matrix4();
  [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1]
  ].forEach(([sx, sz], i) => screws.setMatrixAt(i, place.makeTranslation(sx * SCREWS.x, BACK.height + SCREWS.height / 2, sz * SCREWS.z)));

  layer.add(named(plate, 'back:plate'), named(label, 'back:label'), named(screws, 'back:screws'));
}

/** Builds the device closed, every layer at its resting height. */
export function buildDevice(textures: DeviceTextures = {}): DeviceModel {
  const group = named(new THREE.Group(), 'device');
  const layers = {} as Record<LayerId, THREE.Group>;
  for (const id of LAYERS) {
    layers[id] = named(new THREE.Group(), id);
    group.add(layers[id]);
  }

  const powerButton = buildShell(layers.shell);
  buildScreen(layers.screen, textures.screen);
  const chips = buildBoard(layers.board);
  buildBattery(layers.battery);
  buildBack(layers.back, textures.spec);

  const device: DeviceModel = {
    group,
    layers,
    chips,
    powerButton,
    applyPose(pose) {
      for (const id of LAYERS) layers[id].position.y = pose.offsets[id];
    }
  };
  device.applyPose(poseAt(0));
  return device;
}
