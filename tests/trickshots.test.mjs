// Rules of the trick-shots mini-game (src/scripts/hero/TrickShots.ts).
// Node runs the TypeScript source directly (type stripping), so the game is
// tested exactly as it ships, with a scripted ball and a seeded random.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrickShots } from '../src/scripts/hero/TrickShots.ts';

const STEP = 1 / 60;
const FAR = { x: -1000, y: -1000, radius: 10 };

/** A deterministic random, so ring placement and movement repeat exactly. */
function seeded(seed = 7) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function game() {
  const spots = [
    { x: 200, y: 200 },
    { x: 500, y: 300 },
    { x: 300, y: 400 },
    { x: 650, y: 180 }
  ];
  let next = 0;
  return new TrickShots({
    findSpot: () => spots[next++ % spots.length],
    ringRadius: () => 40,
    bounds: () => ({ width: 800, height: 600 }),
    random: seeded()
  });
}

/** Runs the countdown so the round is live. */
function begin(shots) {
  shots.start();
  let now = 0;
  while (shots.phase === 'countdown') shots.update(STEP, (now += STEP * 1000), FAR, 0);
  return now;
}

function live(shots) {
  return shots.rings.filter((ring) => ring.hitAt < 0);
}

test('a round counts down 3, 2, 1, then goes live with two rings', () => {
  const shots = game();
  shots.start();
  const counts = [];
  let go = false;
  let now = 0;
  while (shots.phase === 'countdown') {
    const events = shots.update(STEP, (now += STEP * 1000), FAR, 0);
    if (events.count) counts.push(events.count);
    if (events.go) go = true;
  }
  assert.deepEqual(counts, [2, 1]);
  assert.ok(go);
  assert.equal(shots.phase, 'playing');
  assert.equal(live(shots).length, 2);
  assert.equal(shots.timeLeft, TrickShots.ROUND_S);
});

test('hitting rings scores 100 × the combo, and the combo grows with each ring', () => {
  const shots = game();
  let now = begin(shots);
  const scores = [];
  for (let i = 0; i < 3; i++) {
    const ring = live(shots)[0];
    const events = shots.update(STEP, (now += STEP * 1000), { x: ring.x, y: ring.y, radius: 10 }, 0);
    assert.ok(events.hit, `ring ${i + 1} should be hit`);
    scores.push(events.hit.points);
  }
  assert.deepEqual(scores, [100, 200, 300]);
  assert.equal(shots.score, 600);
  assert.equal(shots.combo, 4);
  assert.equal(shots.hits, 3);
});

test('a floor touch resets the combo but not the score', () => {
  const shots = game();
  let now = begin(shots);
  const ring = live(shots)[0];
  shots.update(STEP, (now += STEP * 1000), { x: ring.x, y: ring.y, radius: 10 }, 0);
  assert.equal(shots.combo, 2);
  const events = shots.update(STEP, (now += STEP * 1000), FAR, 1);
  assert.ok(events.comboLost);
  assert.equal(shots.combo, 1);
  assert.equal(shots.score, 100);
});

test('every fourth ring is gold and adds five seconds', () => {
  const shots = game();
  let now = begin(shots);
  let gold = null;
  for (let i = 0; i < 6 && !gold; i++) {
    const ring = live(shots)[0];
    const before = shots.timeLeft;
    const events = shots.update(STEP, (now += STEP * 1000), { x: ring.x, y: ring.y, radius: 10 }, 0);
    if (events.hit?.ring.gold) gold = { before, after: shots.timeLeft };
  }
  assert.ok(gold, 'a gold ring should appear within the first rings');
  assert.ok(Math.abs(gold.after - (gold.before - STEP + TrickShots.GOLD_BONUS_S)) < 1e-9);
});

test('the round ends at zero and clears the board', () => {
  const shots = game();
  let now = begin(shots);
  let ended = false;
  for (let t = 0; t < TrickShots.ROUND_S + 1 && !ended; t += STEP) {
    ended = Boolean(shots.update(STEP, (now += STEP * 1000), FAR, 0).ended);
  }
  assert.ok(ended);
  assert.equal(shots.phase, 'over');
  assert.equal(shots.timeLeft, 0);
  assert.equal(shots.rings.length, 0);
});

test('at half time a third ring appears, smaller than the first ones', () => {
  const shots = game();
  let now = begin(shots);
  const firstRadius = live(shots)[0].r;
  for (let t = 0; t < TrickShots.ROUND_S / 2 - 1; t += STEP) shots.update(STEP, (now += STEP * 1000), FAR, 0);
  assert.equal(live(shots).length, 2, 'two rings in the first half');
  for (let t = 0; t < 2; t += STEP) shots.update(STEP, (now += STEP * 1000), FAR, 0);
  const rings = live(shots);
  assert.equal(rings.length, 3);
  assert.ok(rings[2].r < firstRadius);
});

test('the combo is capped', () => {
  const shots = game();
  let now = begin(shots);
  for (let i = 0; i < TrickShots.MAX_COMBO + 4; i++) {
    const ring = live(shots)[0];
    shots.update(STEP, (now += STEP * 1000), { x: ring.x, y: ring.y, radius: 10 }, 0);
  }
  assert.equal(shots.combo, TrickShots.MAX_COMBO);
});
