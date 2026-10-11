/*
 * physics.c: implementation of the hero playground engine.
 * See physics.h for the data model. Build: `npm run build:wasm`.
 */
#include "physics.h"

#define EXPORT(name) __attribute__((export_name(name)))

#define MAX_SPEED 2600.0f
#define MAX_SUBSTEPS 16
#define MAX_DT (1.0f / 30.0f)
#define SOLVER_ITERATIONS 2

#define HOME_STIFFNESS 2.2f   /* spring pulling floating bodies home (1/s^2) */
#define HOME_DRAG 1.4f        /* damping for floating bodies (1/s) */
#define AIR_DRAG 0.12f        /* damping for falling / thrown bodies (1/s) */
#define SPIN_DRAG 0.8f
#define HOLD_FOLLOW 18.0f     /* how hard a held body chases the pointer */
#define REST_SPEED 40.0f      /* impacts slower than this do not bounce */
#define FLOOR_HIT_SPEED 60.0f /* slower floor contacts are not counted as hits */
#define POINTER_HIT_SPEED 140.0f
#define POINTER_RESTITUTION 0.9f
#define WALL_FRICTION 0.985f

static World world;

/* ---------- freestanding maths (no libm) ---------- */

static float absf(float v) { return __builtin_fabsf(v); }
static float sqrtf_(float v) { return __builtin_sqrtf(v); }
static float minf(float a, float b) { return a < b ? a : b; }
static float maxf(float a, float b) { return a > b ? a : b; }
static float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }

/* Parabolic sine approximation with one refinement step (error < 0.001). */
static float sin_approx(float x) {
  const float PI = 3.14159265f;
  const float TWO_PI = 6.28318531f;
  x -= TWO_PI * __builtin_floorf((x + PI) / TWO_PI); /* wrap to [-PI, PI) */
  float y = (4.0f / PI) * x - (4.0f / (PI * PI)) * x * absf(x);
  return 0.225f * (y * absf(y) - y) + y;
}

static float cos_approx(float x) { return sin_approx(x + 1.57079633f); }

/* ---------- body "methods" ---------- */

static int body_is(const Body *b, int flag) { return (b->flags & flag) != 0; }

/* Held bodies behave as if infinitely heavy while the pointer drives them. */
static float body_inv_mass(const Body *b) { return body_is(b, BODY_HELD) ? 0.0f : b->inv_mass; }

static void body_clamp_speed(Body *b) {
  float speed2 = b->vx * b->vx + b->vy * b->vy;
  if (speed2 > MAX_SPEED * MAX_SPEED) {
    float scale = MAX_SPEED / sqrtf_(speed2);
    b->vx *= scale;
    b->vy *= scale;
  }
}

static void body_damp(Body *b, float drag, float h) {
  float factor = 1.0f / (1.0f + drag * h);
  b->vx *= factor;
  b->vy *= factor;
}

/* Converts sliding along a surface into rolling. */
static void body_roll(Body *b, float tangential_speed) {
  float target = tangential_speed / maxf(b->radius, 1.0f);
  b->spin += (target - b->spin) * 0.3f;
}

static void body_integrate(World *w, Body *b, float h) {
  if (body_is(b, BODY_HELD)) {
    if (w->pointer.active) {
      b->vx = (w->pointer.x - b->x) * HOLD_FOLLOW;
      b->vy = (w->pointer.y - b->y) * HOLD_FOLLOW;
    }
  } else {
    if (body_is(b, BODY_GRAVITY)) b->vy += w->gravity * h;

    if (body_is(b, BODY_HOMING) && !body_is(b, BODY_GRAVITY)) {
      b->vx += (b->home_x - b->x) * HOME_STIFFNESS * h;
      b->vy += (b->home_y - b->y) * HOME_STIFFNESS * h;
      b->vx += cos_approx(w->time * 0.6f + b->phase) * w->drift * h;
      b->vy += sin_approx(w->time * 0.45f + b->phase * 1.3f) * w->drift * h;
      body_damp(b, HOME_DRAG, h);
    } else {
      body_damp(b, AIR_DRAG, h);
    }
  }

  body_clamp_speed(b);
  b->x += b->vx * h;
  b->y += b->vy * h;
  b->angle += b->spin * h;
  b->spin *= 1.0f / (1.0f + SPIN_DRAG * h);
}

/* ---------- collisions ---------- */

static void collide_bodies(Body *a, Body *b) {
  float dx = b->x - a->x;
  float dy = b->y - a->y;
  float reach = a->radius + b->radius;
  float d2 = dx * dx + dy * dy;
  if (d2 >= reach * reach) return;

  float d = sqrtf_(d2);
  float nx = 1.0f, ny = 0.0f;
  if (d > 1e-4f) {
    nx = dx / d;
    ny = dy / d;
  }
  float ima = body_inv_mass(a);
  float imb = body_inv_mass(b);
  float sum = ima + imb;
  if (sum <= 0.0f) return;

  float overlap = reach - d;
  a->x -= nx * overlap * (ima / sum);
  a->y -= ny * overlap * (ima / sum);
  b->x += nx * overlap * (imb / sum);
  b->y += ny * overlap * (imb / sum);

  float rvx = b->vx - a->vx;
  float rvy = b->vy - a->vy;
  float vn = rvx * nx + rvy * ny;
  if (vn >= 0.0f) return; /* already separating */

  float e = absf(vn) < REST_SPEED ? 0.0f : minf(a->restitution, b->restitution);
  float j = -(1.0f + e) * vn / sum;
  a->vx -= j * nx * ima;
  a->vy -= j * ny * ima;
  b->vx += j * nx * imb;
  b->vy += j * ny * imb;

  float vt = rvx * -ny + rvy * nx;
  a->spin -= vt / maxf(a->radius, 1.0f) * 0.25f;
  b->spin += vt / maxf(b->radius, 1.0f) * 0.25f;
}

static void collide_box(Body *b, const Box *box) {
  float cx = clampf(b->x, box->min_x, box->max_x);
  float cy = clampf(b->y, box->min_y, box->max_y);
  float dx = b->x - cx;
  float dy = b->y - cy;
  float d2 = dx * dx + dy * dy;
  if (d2 > b->radius * b->radius) return;

  float nx, ny, penetration;
  if (d2 > 1e-6f) {
    float d = sqrtf_(d2);
    nx = dx / d;
    ny = dy / d;
    penetration = b->radius - d;
  } else {
    /* Centre inside the box: leave along the shortest way out. */
    float left = b->x - box->min_x;
    float right = box->max_x - b->x;
    float top = b->y - box->min_y;
    float bottom = box->max_y - b->y;
    float m = minf(minf(left, right), minf(top, bottom));
    nx = 0.0f;
    ny = 0.0f;
    if (m == left) nx = -1.0f;
    else if (m == right) nx = 1.0f;
    else if (m == top) ny = -1.0f;
    else ny = 1.0f;
    penetration = m + b->radius;
  }

  b->x += nx * penetration;
  b->y += ny * penetration;

  float vn = b->vx * nx + b->vy * ny;
  if (vn < 0.0f) {
    float e = absf(vn) < REST_SPEED ? 0.0f : b->restitution;
    b->vx -= (1.0f + e) * vn * nx;
    b->vy -= (1.0f + e) * vn * ny;
    float tx = -ny, ty = nx;
    float vt = b->vx * tx + b->vy * ty;
    b->vx -= vt * tx * 0.06f;
    b->vy -= vt * ty * 0.06f;
    body_roll(b, vt);
  }
}

static void collide_walls(World *w, Body *b) {
  float r = b->radius;
  float e = b->restitution;

  if (b->x - r < 0.0f) {
    b->x = r;
    if (b->vx < 0.0f) b->vx = absf(b->vx) < REST_SPEED ? 0.0f : -b->vx * e;
  } else if (b->x + r > w->width) {
    b->x = w->width - r;
    if (b->vx > 0.0f) b->vx = absf(b->vx) < REST_SPEED ? 0.0f : -b->vx * e;
  }

  if (b->y - r < 0.0f) {
    b->y = r;
    if (b->vy < 0.0f) b->vy = -b->vy * e;
  } else if (b->y + r > w->height) {
    b->y = w->height - r;
    if (b->vy > 0.0f) {
      if (b->vy > FLOOR_HIT_SPEED) b->floor_hits += 1;
      b->vy = b->vy < REST_SPEED ? 0.0f : -b->vy * e;
      b->vx *= WALL_FRICTION;
      body_roll(b, b->vx);
    }
  }
}

static void collide_pointer(World *w, Body *b) {
  Pointer *p = &w->pointer;
  if (!p->active || body_is(b, BODY_HELD)) {
    b->touching_pointer = 0;
    return;
  }
  float dx = b->x - p->x;
  float dy = b->y - p->y;
  float reach = b->radius + p->radius;
  float d2 = dx * dx + dy * dy;
  if (d2 >= reach * reach) {
    b->touching_pointer = 0;
    return;
  }

  float d = sqrtf_(d2);
  float nx = 0.0f, ny = -1.0f;
  if (d > 1e-4f) {
    nx = dx / d;
    ny = dy / d;
  }
  b->x += nx * (reach - d);
  b->y += ny * (reach - d);

  /* The pointer is an infinitely heavy paddle: reflect the relative velocity. */
  float rvx = b->vx - p->vx;
  float rvy = b->vy - p->vy;
  float vn = rvx * nx + rvy * ny;
  if (vn < 0.0f) {
    b->vx -= (1.0f + POINTER_RESTITUTION) * vn * nx;
    b->vy -= (1.0f + POINTER_RESTITUTION) * vn * ny;
    body_roll(b, rvx * -ny + rvy * nx);
    if (!b->touching_pointer && -vn > POINTER_HIT_SPEED) b->pointer_hits += 1;
  }
  b->touching_pointer = 1;
}

/* ---------- stepping ---------- */

/* Enough substeps that nothing moves more than half its radius per substep (no tunnelling). */
static int substeps_for(const World *w, float dt) {
  float fastest = 0.0f;
  float smallest = 1e9f;
  for (int i = 0; i < w->body_count; i++) {
    const Body *b = &w->bodies[i];
    if (!body_is(b, BODY_ACTIVE)) continue;
    fastest = maxf(fastest, sqrtf_(b->vx * b->vx + b->vy * b->vy));
    smallest = minf(smallest, b->radius);
  }
  if (w->pointer.active) fastest = maxf(fastest, sqrtf_(w->pointer.vx * w->pointer.vx + w->pointer.vy * w->pointer.vy));
  float limit = maxf(smallest * 0.5f, 1.0f);
  int steps = (int)(fastest * dt / limit) + 1;
  return steps < 1 ? 1 : (steps > MAX_SUBSTEPS ? MAX_SUBSTEPS : steps);
}

static void world_integrate(World *w, float h) {
  w->time += h;
  for (int i = 0; i < w->body_count; i++) {
    if (body_is(&w->bodies[i], BODY_ACTIVE)) body_integrate(w, &w->bodies[i], h);
  }

  for (int iteration = 0; iteration < SOLVER_ITERATIONS; iteration++) {
    for (int i = 0; i < w->body_count; i++) {
      Body *a = &w->bodies[i];
      if (!body_is(a, BODY_ACTIVE)) continue;
      for (int j = i + 1; j < w->body_count; j++) {
        Body *b = &w->bodies[j];
        if (body_is(b, BODY_ACTIVE)) collide_bodies(a, b);
      }
      for (int s = 0; s < w->static_count; s++) collide_box(a, &w->statics[s]);
      collide_walls(w, a);
    }
  }

  for (int i = 0; i < w->body_count; i++) {
    if (body_is(&w->bodies[i], BODY_ACTIVE)) collide_pointer(w, &w->bodies[i]);
  }
}

/* ---------- exported API ---------- */

EXPORT("world_init")
void world_init(float width, float height) {
  world.body_count = 0;
  world.static_count = 0;
  world.width = width;
  world.height = height;
  world.gravity = 1200.0f;
  world.drift = 28.0f;
  world.time = 0.0f;
  world.pointer.active = 0;
}

EXPORT("world_resize")
void world_resize(float width, float height) {
  world.width = width;
  world.height = height;
}

EXPORT("world_set_gravity")
void world_set_gravity(float gravity) { world.gravity = gravity; }

EXPORT("world_set_drift")
void world_set_drift(float drift) { world.drift = drift; }

EXPORT("world_add_body")
int world_add_body(float x, float y, float radius, float mass, float restitution) {
  if (world.body_count >= MAX_BODIES) return -1;
  int id = world.body_count++;
  Body *b = &world.bodies[id];
  b->x = x;
  b->y = y;
  b->vx = 0.0f;
  b->vy = 0.0f;
  b->angle = 0.0f;
  b->spin = 0.0f;
  b->radius = radius;
  b->inv_mass = mass > 0.0f ? 1.0f / mass : 0.0f;
  b->restitution = clampf(restitution, 0.0f, 1.0f);
  b->home_x = x;
  b->home_y = y;
  b->phase = (float)id * 2.39996323f; /* golden angle: drifts never sync up */
  b->flags = BODY_ACTIVE | BODY_HOMING;
  b->touching_pointer = 0;
  b->pointer_hits = 0;
  b->floor_hits = 0;
  return id;
}

static Body *body_at(int id) { return (id >= 0 && id < world.body_count) ? &world.bodies[id] : 0; }

EXPORT("world_set_home")
void world_set_home(int id, float x, float y) {
  Body *b = body_at(id);
  if (b) {
    b->home_x = x;
    b->home_y = y;
  }
}

EXPORT("world_set_position")
void world_set_position(int id, float x, float y) {
  Body *b = body_at(id);
  if (b) {
    b->x = x;
    b->y = y;
  }
}

EXPORT("world_set_velocity")
void world_set_velocity(int id, float vx, float vy) {
  Body *b = body_at(id);
  if (b) {
    b->vx = vx;
    b->vy = vy;
    body_clamp_speed(b);
  }
}

EXPORT("world_add_velocity")
void world_add_velocity(int id, float dvx, float dvy) {
  Body *b = body_at(id);
  if (b) world_set_velocity(id, b->vx + dvx, b->vy + dvy);
}

EXPORT("world_set_spin")
void world_set_spin(int id, float spin) {
  Body *b = body_at(id);
  if (b) b->spin = spin;
}

EXPORT("world_set_flags")
void world_set_flags(int id, int flags) {
  Body *b = body_at(id);
  if (b) b->flags = flags;
}

EXPORT("world_get_flags")
int world_get_flags(int id) {
  Body *b = body_at(id);
  return b ? b->flags : 0;
}

EXPORT("world_clear_statics")
void world_clear_statics(void) { world.static_count = 0; }

EXPORT("world_add_static")
int world_add_static(float min_x, float min_y, float max_x, float max_y) {
  if (world.static_count >= MAX_STATICS) return -1;
  Box *box = &world.statics[world.static_count];
  box->min_x = min_x;
  box->min_y = min_y;
  box->max_x = max_x;
  box->max_y = max_y;
  return world.static_count++;
}

EXPORT("world_set_pointer")
void world_set_pointer(float x, float y, float vx, float vy, float radius, int active) {
  world.pointer.x = x;
  world.pointer.y = y;
  world.pointer.vx = vx;
  world.pointer.vy = vy;
  world.pointer.radius = radius;
  world.pointer.active = active;
}

/* Topmost body under (x, y), allowing `slop` extra pixels; -1 if none. */
EXPORT("world_pick")
int world_pick(float x, float y, float slop) {
  for (int i = world.body_count - 1; i >= 0; i--) {
    const Body *b = &world.bodies[i];
    if (!body_is(b, BODY_ACTIVE)) continue;
    float dx = b->x - x, dy = b->y - y, r = b->radius + slop;
    if (dx * dx + dy * dy <= r * r) return i;
  }
  return -1;
}

EXPORT("world_hold")
void world_hold(int id) {
  Body *b = body_at(id);
  if (b) b->flags |= BODY_HELD;
}

EXPORT("world_release")
void world_release(int id, float vx, float vy) {
  Body *b = body_at(id);
  if (!b) return;
  b->flags &= ~BODY_HELD;
  world_set_velocity(id, vx, vy);
  b->spin = clampf(vx * 0.01f, -12.0f, 12.0f);
}

EXPORT("world_take_pointer_hits")
int world_take_pointer_hits(int id) {
  Body *b = body_at(id);
  if (!b) return 0;
  int hits = b->pointer_hits;
  b->pointer_hits = 0;
  return hits;
}

EXPORT("world_take_floor_hits")
int world_take_floor_hits(int id) {
  Body *b = body_at(id);
  if (!b) return 0;
  int hits = b->floor_hits;
  b->floor_hits = 0;
  return hits;
}

EXPORT("world_step")
void world_step(float dt) {
  if (dt <= 0.0f) return;
  dt = minf(dt, MAX_DT);
  int steps = substeps_for(&world, dt);
  float h = dt / (float)steps;

  /* Sweep the pointer across the frame instead of teleporting it, so fast swipes still connect. */
  Pointer end = world.pointer;
  for (int i = 0; i < steps; i++) {
    float remaining = dt - h * (float)(i + 1);
    world.pointer.x = end.x - end.vx * remaining;
    world.pointer.y = end.y - end.vy * remaining;
    world_integrate(&world, h);
  }
  world.pointer = end;
}

EXPORT("world_bodies_ptr")
Body *world_bodies_ptr(void) { return world.bodies; }

EXPORT("world_body_stride")
int world_body_stride(void) { return (int)(sizeof(Body) / 4); }

EXPORT("world_body_count")
int world_body_count(void) { return world.body_count; }
