import * as THREE from 'three';
import type { DeviceMaterials } from './materials';
import { ALUMINIUM_TILE } from './materials';
import { centre, fillet, panel, ringAt, ringsAt, sweep, type UvLayout } from './shapes';
import { canPaint, paintEtching } from './print';
import { DEVICE, SCREW_SPOTS, SCREW_TURNS, instanced, screwHeadGeometry, screwSlotGeometry } from './hardware';

/**
 * The back plate: a 3.2 × 1.83 × 0.05 slab of the same anodised aluminium,
 * its bottom edge a polished chamfer like the frame's top one, its top edge a
 * small round (so the seam with the frame reads as a fine line), and four
 * brass screws in the corners where the frame's standoffs land. Where a
 * canvas can be drawn, a small mark is laser-etched in the middle of its top.
 */

export const BACK_THICKNESS = 0.05;

const CHAMFER = 0.012;
const CHAMFER_ROUND = 0.003;
const TOP_EDGE = 0.006;

/** The screw heads are sunk this far into the plate. */
const SCREW_SINK = 0.002;

/** The etched mark on the plate's top: its size, centred. */
const MARK = { width: 0.56, depth: 0.28 };

export interface BackPlateParts {
  object: THREE.Group;
  /** Paints the etched mark again (once the font has loaded); a no-op without a canvas. */
  redraw(): void;
}

function plateGeometry(): THREE.BufferGeometry {
  const quarter = Math.PI / 2;
  const H = BACK_THICKNESS;
  // The chamfer cuts the bottom outer corner at −45°, with a small round at each end.
  const chamferLow = fillet(-CHAMFER, 0, -quarter, -quarter / 2, CHAMFER_ROUND, 3);
  const chamferHigh = fillet(0, CHAMFER, -quarter / 2, 0, CHAMFER_ROUND, 3);
  const topEdge = fillet(0, H, 0, quarter, TOP_EDGE, 4);
  const wrap: UvLayout = { kind: 'wrap', tile: ALUMINIUM_TILE };
  const flat: UvLayout = { kind: 'world', tile: ALUMINIUM_TILE };
  return sweep([
    { rings: [centre(0, -1), ringAt(DEVICE, chamferLow[0])], uv: flat },
    { rings: ringsAt(DEVICE, [...chamferLow, ...chamferHigh]), uv: wrap, group: 1 },
    { rings: ringsAt(DEVICE, [chamferHigh[chamferHigh.length - 1], ...topEdge]), uv: wrap },
    { rings: [ringAt(DEVICE, topEdge[topEdge.length - 1]), centre(H, 1)], uv: flat }
  ]);
}

export function buildBackPlate(m: DeviceMaterials): BackPlateParts {
  const object = new THREE.Group();
  object.name = 'back';

  const slab = new THREE.Mesh(plateGeometry(), [m.anodised, m.chamfer]);
  slab.name = 'back:plate';

  const spots = SCREW_SPOTS.map(([x, z]) => [x, BACK_THICKNESS - SCREW_SINK, z] as const);
  const turns = SCREW_TURNS.map((turn) => turn + 0.4);
  object.add(
    slab,
    instanced(screwHeadGeometry(), m.brass, spots, 'back:screws', turns),
    instanced(screwSlotGeometry(), m.recess, spots, 'back:slots', turns)
  );

  // The etched mark: matte, paler metal where the laser took the anodising off.
  let redraw = (): void => {};
  if (canPaint()) {
    const etching = paintEtching(MARK.width / MARK.depth);
    const mark = new THREE.Mesh(
      panel({ width: MARK.width, depth: MARK.depth, radius: 0 }),
      new THREE.MeshStandardMaterial({
        name: 'etching',
        color: 0x9d8cc4,
        metalness: 0.5,
        roughness: 0.62,
        alphaMap: etching.texture,
        transparent: true,
        depthWrite: false
      })
    );
    mark.position.y = BACK_THICKNESS + 0.0004;
    mark.name = 'back:mark';
    object.add(mark);
    redraw = etching.draw;
  }
  return { object, redraw };
}
