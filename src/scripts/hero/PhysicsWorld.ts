/** Mirrors `enum BodyFlags` in native/physics.h. */
export const BodyFlag = {
  Active: 1 << 0,
  Gravity: 1 << 1,
  Homing: 1 << 2,
  Held: 1 << 3
} as const;

/** Field offsets inside one Body struct (native/physics.h), in 4-byte units. */
const BODY_FIELDS = { x: 0, y: 1, vx: 2, vy: 3, angle: 4, spin: 5, radius: 6 } as const;

interface PhysicsExports {
  memory: WebAssembly.Memory;
  world_init(width: number, height: number): void;
  world_resize(width: number, height: number): void;
  world_set_gravity(gravity: number): void;
  world_set_drift(drift: number): void;
  world_add_body(x: number, y: number, radius: number, mass: number, restitution: number): number;
  world_set_home(id: number, x: number, y: number): void;
  world_set_position(id: number, x: number, y: number): void;
  world_set_velocity(id: number, vx: number, vy: number): void;
  world_add_velocity(id: number, dvx: number, dvy: number): void;
  world_set_spin(id: number, spin: number): void;
  world_set_flags(id: number, flags: number): void;
  world_get_flags(id: number): number;
  world_clear_statics(): void;
  world_add_static(minX: number, minY: number, maxX: number, maxY: number): number;
  world_set_pointer(x: number, y: number, vx: number, vy: number, radius: number, active: number): void;
  world_pick(x: number, y: number, slop: number): number;
  world_hold(id: number): void;
  world_release(id: number, vx: number, vy: number): void;
  world_take_pointer_hits(id: number): number;
  world_take_floor_hits(id: number): number;
  world_step(dt: number): void;
  world_bodies_ptr(): number;
  world_body_stride(): number;
  world_body_count(): number;
}

export interface BodyState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
}

/**
 * TypeScript face of the C engine. Body state is read straight out of the
 * module's linear memory through a Float32Array: no copying, no glue code.
 */
export class PhysicsWorld {
  private view: Float32Array;
  private readonly stride: number;

  private constructor(private readonly native: PhysicsExports) {
    this.stride = native.world_body_stride();
    this.view = new Float32Array(native.memory.buffer);
  }

  static async load(url: string): Promise<PhysicsWorld> {
    const response = fetch(url);
    let instance: WebAssembly.Instance;
    try {
      ({ instance } = await WebAssembly.instantiateStreaming(response));
    } catch {
      // Some servers send the wrong MIME type; fall back to a plain buffer.
      const bytes = await (await fetch(url)).arrayBuffer();
      ({ instance } = await WebAssembly.instantiate(bytes));
    }
    return new PhysicsWorld(instance.exports as unknown as PhysicsExports);
  }

  init(width: number, height: number): void {
    this.native.world_init(width, height);
  }

  resize(width: number, height: number): void {
    this.native.world_resize(width, height);
  }

  set gravity(value: number) {
    this.native.world_set_gravity(value);
  }

  set drift(value: number) {
    this.native.world_set_drift(value);
  }

  addBody(x: number, y: number, radius: number, mass: number, restitution: number): number {
    return this.native.world_add_body(x, y, radius, mass, restitution);
  }

  setHome(id: number, x: number, y: number): void {
    this.native.world_set_home(id, x, y);
  }

  setPosition(id: number, x: number, y: number): void {
    this.native.world_set_position(id, x, y);
  }

  setVelocity(id: number, vx: number, vy: number): void {
    this.native.world_set_velocity(id, vx, vy);
  }

  addVelocity(id: number, dvx: number, dvy: number): void {
    this.native.world_add_velocity(id, dvx, dvy);
  }

  setSpin(id: number, spin: number): void {
    this.native.world_set_spin(id, spin);
  }

  flags(id: number): number {
    return this.native.world_get_flags(id);
  }

  setFlags(id: number, flags: number): void {
    this.native.world_set_flags(id, flags);
  }

  addFlag(id: number, flag: number): void {
    this.setFlags(id, this.flags(id) | flag);
  }

  removeFlag(id: number, flag: number): void {
    this.setFlags(id, this.flags(id) & ~flag);
  }

  setStatics(boxes: { minX: number; minY: number; maxX: number; maxY: number }[]): void {
    this.native.world_clear_statics();
    boxes.forEach((box) => this.native.world_add_static(box.minX, box.minY, box.maxX, box.maxY));
  }

  setPointer(x: number, y: number, vx: number, vy: number, radius: number, active: boolean): void {
    this.native.world_set_pointer(x, y, vx, vy, radius, active ? 1 : 0);
  }

  pick(x: number, y: number, slop = 0): number {
    return this.native.world_pick(x, y, slop);
  }

  hold(id: number): void {
    this.native.world_hold(id);
  }

  release(id: number, vx: number, vy: number): void {
    this.native.world_release(id, vx, vy);
  }

  takePointerHits(id: number): number {
    return this.native.world_take_pointer_hits(id);
  }

  takeFloorHits(id: number): number {
    return this.native.world_take_floor_hits(id);
  }

  step(dt: number): void {
    this.native.world_step(dt);
  }

  get count(): number {
    return this.native.world_body_count();
  }

  body(id: number): BodyState {
    if (this.view.buffer !== this.native.memory.buffer) this.view = new Float32Array(this.native.memory.buffer);
    const base = this.native.world_bodies_ptr() / 4 + id * this.stride;
    return {
      x: this.view[base + BODY_FIELDS.x],
      y: this.view[base + BODY_FIELDS.y],
      vx: this.view[base + BODY_FIELDS.vx],
      vy: this.view[base + BODY_FIELDS.vy],
      angle: this.view[base + BODY_FIELDS.angle],
      radius: this.view[base + BODY_FIELDS.radius]
    };
  }
}
