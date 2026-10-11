// Behavioural tests for the C physics engine, run against the compiled .wasm.
// `npm test` builds the module first (see the "pretest" script).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ACTIVE = 1;
const GRAVITY = 2;
const HOMING = 4;
const STEP = 1 / 60;

const bytes = await readFile(new URL('../public/wasm/physics.wasm', import.meta.url));
const { instance } = await WebAssembly.instantiate(bytes);
const w = instance.exports;

function body(id) {
  const stride = w.world_body_stride();
  const view = new Float32Array(w.memory.buffer, w.world_bodies_ptr(), w.world_body_count() * stride);
  const base = id * stride;
  return { x: view[base], y: view[base + 1], vx: view[base + 2], vy: view[base + 3], radius: view[base + 6] };
}

function run(seconds) {
  for (let t = 0; t < seconds; t += STEP) w.world_step(STEP);
}

beforeEach(() => {
  w.world_init(800, 600);
  w.world_set_drift(0);
});

test('body layout is 16 four-byte fields', () => {
  assert.equal(w.world_body_stride(), 16);
});

test('gravity accelerates falling bodies', () => {
  const id = w.world_add_body(400, 50, 10, 1, 0.5);
  w.world_set_flags(id, ACTIVE | GRAVITY);
  run(0.25);
  const { y, vy } = body(id);
  assert.ok(vy > 250, `expected downward speed, got ${vy}`);
  assert.ok(y > 70, `expected body to fall, got y=${y}`);
});

test('bodies bounce off the floor, count the impact and come to rest', () => {
  const id = w.world_add_body(400, 100, 20, 1, 0.6);
  w.world_set_flags(id, ACTIVE | GRAVITY);
  run(1.2); // free fall of 460px at 1200px/s² takes ~0.88s
  assert.ok(w.world_take_floor_hits(id) >= 1, 'floor impact was not counted');
  run(5);
  const { y, vy } = body(id);
  assert.ok(Math.abs(y - 580) < 2, `expected to rest on the floor (y≈580), got ${y}`);
  assert.ok(Math.abs(vy) < 5, `expected to be at rest, got vy=${vy}`);
});

test('static boxes (the name letters) act as solid platforms', () => {
  w.world_add_static(300, 400, 500, 440);
  const id = w.world_add_body(400, 100, 20, 1, 0.3);
  w.world_set_flags(id, ACTIVE | GRAVITY);
  run(4);
  const { y } = body(id);
  assert.ok(Math.abs(y - 380) < 2, `expected to rest on top of the box (y≈380), got ${y}`);
});

test('fast bodies do not tunnel through thin colliders', () => {
  w.world_add_static(400, 0, 404, 600);
  const id = w.world_add_body(100, 300, 8, 1, 0.8);
  w.world_set_flags(id, ACTIVE);
  w.world_set_velocity(id, 2600, 0);
  run(0.5);
  const { x } = body(id);
  assert.ok(x < 400, `body tunnelled through the wall (x=${x})`);
});

test('a pointer swipe hits a body exactly once per contact', () => {
  w.world_resize(4000, 600); // no wall for the ball to bounce back from
  const id = w.world_add_body(400, 300, 16, 0.3, 0.9);
  w.world_set_flags(id, ACTIVE);
  // Pointer sweeps in from the left at 900 px/s.
  let px = 300;
  for (let i = 0; i < 20; i++) {
    px += 900 * STEP;
    w.world_set_pointer(px, 300, 900, 0, 20, 1);
    w.world_step(STEP);
  }
  assert.equal(w.world_take_pointer_hits(id), 1);
  assert.ok(body(id).vx > 300, 'body should be knocked to the right');
});

test('floating bodies drift back to their home position', () => {
  const id = w.world_add_body(200, 200, 20, 1, 0.5);
  w.world_set_flags(id, ACTIVE | HOMING);
  w.world_set_position(id, 600, 450);
  run(8);
  const { x, y } = body(id);
  assert.ok(Math.hypot(x - 200, y - 200) < 12, `expected to return home, got (${x}, ${y})`);
});

test('picking finds the body under the pointer', () => {
  const id = w.world_add_body(250, 250, 30, 1, 0.5);
  assert.equal(w.world_pick(260, 240, 0), id);
  assert.equal(w.world_pick(600, 500, 0), -1);
});

test('a held body follows the pointer and keeps its throw velocity', () => {
  const id = w.world_add_body(100, 100, 20, 1, 0.5);
  w.world_set_pointer(300, 200, 0, 0, 20, 1);
  w.world_hold(id);
  run(0.5);
  const held = body(id);
  assert.ok(Math.hypot(held.x - 300, held.y - 200) < 5, 'held body should sit under the pointer');
  w.world_release(id, 800, -400);
  const thrown = body(id);
  assert.equal(thrown.vx, 800);
  assert.equal(thrown.vy, -400);
});
