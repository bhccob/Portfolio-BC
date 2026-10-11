/*
 * physics.h: a tiny 2D physics engine for the hero playground.
 *
 * Bodies are circles; static colliders are axis-aligned boxes (the letters
 * of the name and the hero walls). Everything lives in one statically
 * allocated World, so the engine needs no allocator and no libc: it is
 * compiled freestanding to WebAssembly and driven from TypeScript.
 */
#ifndef BOB_PHYSICS_H
#define BOB_PHYSICS_H

#define MAX_BODIES 64
#define MAX_STATICS 48

enum BodyFlags {
  BODY_ACTIVE = 1 << 0,  /* simulated and collidable */
  BODY_GRAVITY = 1 << 1, /* falls under world gravity */
  BODY_HOMING = 1 << 2,  /* floats back toward its home position */
  BODY_HELD = 1 << 3     /* dragged by the pointer (kinematic) */
};

/*
 * Memory layout is read directly by src/scripts/hero/PhysicsWorld.ts:
 * 16 four-byte fields per body. Keep the order in sync with BODY_FIELDS there.
 */
typedef struct {
  float x, y;           /*  0, 1  position (px) */
  float vx, vy;         /*  2, 3  velocity (px/s) */
  float angle, spin;    /*  4, 5  rotation (rad) and angular velocity (rad/s) */
  float radius;         /*  6 */
  float inv_mass;       /*  7 */
  float restitution;    /*  8  bounciness, 0..1 */
  float home_x, home_y; /*  9, 10 */
  float phase;          /* 11  offsets the ambient drift per body */
  int flags;            /* 12  BodyFlags */
  int touching_pointer; /* 13  1 while overlapping the pointer */
  int pointer_hits;     /* 14  new pointer contacts since last read */
  int floor_hits;       /* 15  floor impacts since last read */
} Body;

typedef struct {
  float min_x, min_y, max_x, max_y;
} Box;

typedef struct {
  float x, y;   /* position at the end of the current step */
  float vx, vy; /* velocity over the current step */
  float radius;
  int active;
} Pointer;

typedef struct {
  Body bodies[MAX_BODIES];
  Box statics[MAX_STATICS];
  int body_count;
  int static_count;
  float width, height;
  float gravity; /* px/s^2 */
  float drift;   /* strength of the ambient floating motion */
  float time;
  Pointer pointer;
} World;

#endif
