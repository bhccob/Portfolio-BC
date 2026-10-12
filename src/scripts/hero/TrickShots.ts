/**
 * Trick shots: the rules of the off-duty mini-game. Keep the ping-pong ball
 * in the air and knock it through rings for points within 60 seconds. Every
 * ring in a row raises the combo multiplier; letting the ball touch the floor
 * resets it. Every fourth ring is gold and adds five seconds. After half time
 * the rings shrink and some of them start to move.
 *
 * This class owns only the game state and how it is drawn on the canvas. It
 * knows nothing about the DOM or the physics engine: the playground feeds it
 * the ball's position and floor contacts each frame and reacts to the events
 * it returns. That keeps it small enough to unit-test in plain Node
 * (tests/trickshots.test.mjs), so it avoids TypeScript-only runtime syntax.
 */

export type GamePhase = 'idle' | 'countdown' | 'playing' | 'over';

export interface Point {
  x: number;
  y: number;
}

export interface BallState extends Point {
  radius: number;
}

export interface Ring extends Point {
  r: number;
  vx: number;
  vy: number;
  gold: boolean;
  /** Time (ms) the ring appeared, for its pop-in. */
  born: number;
  /** Time (ms) it was hit, or -1 while it is still live. */
  hitAt: number;
}

export interface FrameEvents {
  /** The countdown reached a new whole number (3, 2, 1). */
  count?: number;
  /** The round started. */
  go?: boolean;
  /** A ring was hit. */
  hit?: { ring: Ring; points: number; combo: number };
  /** The ball touched the floor while a combo was running. */
  comboLost?: boolean;
  /** The whole seconds left changed. */
  second?: number;
  /** The round is over. */
  ended?: boolean;
}

export interface TrickShotsOptions {
  /** A free spot for a new ring of this radius (clear of the letters, the HUD and the ball), or null. */
  findSpot: (radius: number, ball: Point) => Point | null;
  /** Ring radius at the start of a round, in px. */
  ringRadius: () => number;
  bounds: () => { width: number; height: number };
  random?: () => number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  gold: boolean;
}

interface Popup extends Point {
  text: string;
  born: number;
}

const YELLOW = '#ffcf33';
const LILAC = '#b8aad8';
const PAPER = '#f4ecda';

export class TrickShots {
  static ROUND_S = 60;
  static COUNTDOWN_S = 3;
  static GOLD_EVERY = 4;
  static GOLD_BONUS_S = 5;
  static MAX_COMBO = 9;
  static POINTS = 100;
  static MAX_PARTICLES = 40;

  phase: GamePhase = 'idle';
  score = 0;
  combo = 1;
  bestCombo = 1;
  hits = 0;
  timeLeft = TrickShots.ROUND_S;
  countdown = 0;
  rings: Ring[] = [];

  private options: TrickShotsOptions;
  private random: () => number;
  private elapsed = 0;
  private spawned = 0;
  private particles: Particle[] = [];
  private popups: Popup[] = [];

  constructor(options: TrickShotsOptions) {
    this.options = options;
    this.random = options.random ?? Math.random;
  }

  get active(): boolean {
    return this.phase === 'countdown' || this.phase === 'playing';
  }

  start(): void {
    this.phase = 'countdown';
    this.countdown = TrickShots.COUNTDOWN_S;
    this.score = 0;
    this.combo = 1;
    this.bestCombo = 1;
    this.hits = 0;
    this.elapsed = 0;
    this.spawned = 0;
    this.timeLeft = TrickShots.ROUND_S;
    this.rings = [];
  }

  /** Stops a round early (e.g. when the visitor leaves the section). */
  cancel(): void {
    this.phase = 'idle';
    this.rings = [];
  }

  /** Advances the game by `dt` seconds. `floorHits` is the number of floor contacts since the last frame. */
  update(dt: number, now: number, ball: BallState, floorHits: number): FrameEvents {
    const events: FrameEvents = {};
    this.updateEffects(dt);

    if (this.phase === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after > 0) events.count = after;
      if (this.countdown <= 0) {
        this.phase = 'playing';
        events.go = true;
        this.fill(now, ball);
      }
      return events;
    }

    if (this.phase !== 'playing') return events;

    const secondBefore = Math.ceil(this.timeLeft);
    this.elapsed += dt;
    this.timeLeft -= dt;

    this.moveRings(dt);

    for (const ring of this.rings) {
      if (ring.hitAt >= 0) continue;
      if (Math.hypot(ball.x - ring.x, ball.y - ring.y) < ring.r) {
        events.hit = this.hit(ring, now);
        break;
      }
    }

    if (floorHits > 0 && this.combo > 1) {
      this.combo = 1;
      events.comboLost = true;
    }

    // Rings that were hit linger briefly for their burst, then make way for new ones.
    this.rings = this.rings.filter((ring) => ring.hitAt < 0 || now - ring.hitAt < 360);
    this.fill(now, ball);

    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.phase = 'over';
      this.rings = [];
      events.ended = true;
    }
    const secondAfter = Math.ceil(this.timeLeft);
    if (secondAfter !== secondBefore) events.second = secondAfter;
    return events;
  }

  private hit(ring: Ring, now: number): { ring: Ring; points: number; combo: number } {
    ring.hitAt = now;
    const combo = this.combo;
    const points = TrickShots.POINTS * combo;
    this.score += points;
    this.hits += 1;
    this.bestCombo = Math.max(this.bestCombo, combo);
    this.combo = Math.min(this.combo + 1, TrickShots.MAX_COMBO);
    if (ring.gold) this.timeLeft += TrickShots.GOLD_BONUS_S;
    this.burst(ring);
    this.popups.push({ x: ring.x, y: ring.y - ring.r, text: ring.gold ? `+${points} +${TrickShots.GOLD_BONUS_S}s` : `+${points} ×${combo}`, born: now });
    return { ring, points, combo };
  }

  /** Keeps two live rings on the board, three in the second half. */
  private fill(now: number, ball: Point): void {
    const wanted = this.elapsed >= TrickShots.ROUND_S / 2 ? 3 : 2;
    let live = this.rings.filter((ring) => ring.hitAt < 0).length;
    let attempts = 0;
    while (live < wanted && attempts++ < 4) {
      const ring = this.spawn(now, ball);
      if (!ring) break;
      this.rings.push(ring);
      live += 1;
    }
  }

  private spawn(now: number, ball: Point): Ring | null {
    const late = this.elapsed >= TrickShots.ROUND_S / 2;
    const shrink = 1 - 0.3 * Math.min(this.elapsed / TrickShots.ROUND_S, 1);
    const r = this.options.ringRadius() * shrink;
    const spot = this.options.findSpot(r, ball);
    if (!spot) return null;
    this.spawned += 1;
    const gold = this.spawned % TrickShots.GOLD_EVERY === 0;
    // In the second half, ordinary rings drift slowly and bounce off the edges.
    const moving = late && !gold && this.random() < 0.6;
    const angle = this.random() * Math.PI * 2;
    const speed = moving ? 40 + this.random() * 40 : 0;
    return { x: spot.x, y: spot.y, r, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gold, born: now, hitAt: -1 };
  }

  private moveRings(dt: number): void {
    const { width, height } = this.options.bounds();
    for (const ring of this.rings) {
      if (ring.hitAt >= 0 || (!ring.vx && !ring.vy)) continue;
      ring.x += ring.vx * dt;
      ring.y += ring.vy * dt;
      if (ring.x < ring.r || ring.x > width - ring.r) ring.vx *= -1;
      if (ring.y < ring.r + 40 || ring.y > height - ring.r - 90) ring.vy *= -1;
      ring.x = Math.min(Math.max(ring.x, ring.r), width - ring.r);
      ring.y = Math.min(Math.max(ring.y, ring.r + 40), height - ring.r - 90);
    }
  }

  private burst(ring: Ring): void {
    const count = ring.gold ? 18 : 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + this.random() * 0.4;
      const speed = 160 + this.random() * 220;
      this.particles.push({
        x: ring.x + Math.cos(angle) * ring.r * 0.8,
        y: ring.y + Math.sin(angle) * ring.r * 0.8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        life: 0,
        max: 0.5 + this.random() * 0.35,
        size: 3 + this.random() * 4,
        gold: ring.gold || i % 3 === 0
      });
    }
    if (this.particles.length > TrickShots.MAX_PARTICLES) this.particles.splice(0, this.particles.length - TrickShots.MAX_PARTICLES);
  }

  private updateEffects(dt: number): void {
    for (const particle of this.particles) {
      particle.life += dt;
      particle.vy += 900 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life < particle.max);
  }

  /** True while anything is still animating, so the playground knows to keep drawing. */
  get busy(): boolean {
    return this.rings.length > 0 || this.particles.length > 0 || this.popups.length > 0;
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    for (const ring of this.rings) this.drawRing(ctx, ring, now);

    for (const particle of this.particles) {
      const fade = 1 - particle.life / particle.max;
      ctx.save();
      ctx.globalAlpha = Math.max(fade, 0);
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.vx * 0.002);
      ctx.fillStyle = particle.gold ? YELLOW : LILAC;
      ctx.fillRect(-particle.size / 2, -particle.size * 0.7, particle.size, particle.size * 1.4);
      ctx.restore();
    }

    this.popups = this.popups.filter((popup) => now - popup.born < 900);
    for (const popup of this.popups) {
      const t = (now - popup.born) / 900;
      ctx.save();
      ctx.globalAlpha = 1 - t * t;
      ctx.font = '400 22px "Bagel Fat One", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = YELLOW;
      ctx.fillText(popup.text, popup.x, popup.y - 10 - t * 46);
      ctx.restore();
    }
  }

  private drawRing(ctx: CanvasRenderingContext2D, ring: Ring, now: number): void {
    ctx.save();
    ctx.translate(ring.x, ring.y);

    if (ring.hitAt >= 0) {
      // The hit ring bursts outward and fades.
      const t = Math.min((now - ring.hitAt) / 360, 1);
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = YELLOW;
      ctx.lineWidth = 3 * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, ring.r * (1 + 0.7 * t), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Pop in with a little overshoot, then breathe gently.
    const t = Math.min((now - ring.born) / 380, 1);
    const c = 1.70158;
    const pop = t === 0 ? 0 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    const breathe = 1 + Math.sin(now / 260 + ring.born) * 0.03;
    ctx.scale(pop * breathe, pop * breathe);

    if (ring.gold) {
      ctx.fillStyle = 'rgba(255, 207, 51, 0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = ring.gold ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dashed ring and tick marks, like a target on a technical drawing.
    ctx.strokeStyle = ring.gold ? YELLOW : LILAC;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, ring.r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * ring.r * 1.08, Math.sin(angle) * ring.r * 1.08);
      ctx.lineTo(Math.cos(angle) * ring.r * 1.24, Math.sin(angle) * ring.r * 1.24);
      ctx.stroke();
    }

    if (ring.gold) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAPER;
      ctx.font = '500 11px "Martian Mono Variable", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`+${TrickShots.GOLD_BONUS_S}s`, 0, 0);
    }
    ctx.restore();
  }
}
