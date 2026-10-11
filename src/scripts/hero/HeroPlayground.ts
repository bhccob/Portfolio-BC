import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { SafeStorage } from '../core/SafeStorage';
import { signals } from '../core/Signal';
import { $, $$, format, readJson } from '../core/dom';
import { Toast } from '../ui/Toast';
import { ScrollEffects } from '../ui/ScrollEffects';
import { BodyFlag, PhysicsWorld } from './PhysicsWorld';
import { Chip, Controller, Glyph, PingPongBall, Stopwatch, WeightPlate, type Sprite } from './sprites';

interface Item {
  sprite: Sprite;
  /** Home position as a fraction of the stage, per layout. */
  home: { wide: [number, number]; narrow: [number, number] };
  id: number;
  radius: number;
  appearAt: number;
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface HeroStrings {
  rallyOver: string;
  newBest: string;
  hint: string;
  hintTouch: string;
}

/**
 * The playable hero. Line-art objects float around the name; visitors can
 * grab and throw them (mouse) or flick them (touch), and every letter of the
 * name is a solid collider. Hitting the ping-pong ball starts a rally: gravity
 * switches on for the ball and each hit counts until it touches the floor.
 *
 * All simulation happens in C (native/physics.c → WebAssembly); this class
 * only handles input, layout measurement, game rules and drawing.
 */
export class HeroPlayground extends Component {
  private static readonly WASM_URL = '/wasm/physics.wasm';
  private static readonly BEST_KEY = 'bob-rally-best';
  private static readonly GRAVITY = 1150;

  private readonly hero = $('[data-play]');
  private readonly stage = $('[data-play-stage]');
  private readonly canvas = $<HTMLCanvasElement>('[data-play-canvas]');
  private readonly title = $('[data-play-title]');
  private readonly gravityButton = $<HTMLButtonElement>('[data-gravity]');
  private readonly rallyLabel = $('[data-rally]');
  private readonly bestLabel = $('[data-best]');
  private readonly storage = SafeStorage.local();
  private ctx!: CanvasRenderingContext2D;
  private world: PhysicsWorld | null = null;
  private strings!: HeroStrings;

  private items: Item[] = [];
  private stormBalls: { id: number; radius: number }[] = [];
  private readonly ball = new PingPongBall();
  private width = 0;
  private height = 0;
  private ratio = 1;
  private unit = 40;

  private pointer = { x: 0, y: 0, inside: false, mouse: false };
  private samples: { x: number; y: number; t: number }[] = [];
  private heldId = -1;
  private hoverId = -1;
  private cursorState = 'default';
  private tapHits = 0;

  private rally = 0;
  private best = 0;
  private rallyActive = false;
  private rallyStill = 0;
  private gravityOn = false;

  private visible = true;
  private frame = 0;
  private lastTime = 0;
  private startTime = 0;
  private lastScrollY = -1;
  private settled = false;

  async mount(): Promise<void> {
    if (!this.hero || !this.stage || !this.canvas || !this.title) {
      signals.physicsReady.fire(true);
      return;
    }
    this.ctx = this.canvas.getContext('2d')!;
    this.strings = readJson<HeroStrings>(this.hero, 'data-strings', { rallyOver: '{n}', newBest: '{n}', hint: '', hintTouch: '' });
    this.best = this.storage.getNumber(HeroPlayground.BEST_KEY, 0);
    this.renderHud();
    if (!Motion.finePointer) {
      const hint = $('[data-play-hint]', this.hero);
      if (hint) hint.textContent = this.strings.hintTouch;
    }

    this.defineItems();
    this.resize();

    if (Motion.reduced) {
      // No autonomous motion: draw the objects once, in place.
      signals.physicsReady.fire(true);
      signals.heroSettled.then(() => this.drawStatic());
      this.observeResize(() => this.drawStatic());
      return;
    }

    try {
      this.world = await PhysicsWorld.load(HeroPlayground.WASM_URL);
      signals.physicsReady.fire(true);
    } catch (error) {
      console.warn('[hero] physics unavailable, showing static objects', error);
      signals.physicsReady.fire(false);
      signals.heroSettled.then(() => this.drawStatic());
      return;
    }

    this.world.init(this.width, this.height);
    this.world.gravity = HeroPlayground.GRAVITY;
    this.spawnItems();
    this.bindInput();
    this.observeResize(() => this.layout());
    this.observeVisibility();

    signals.heroSettled.then(() => {
      this.settled = true;
      this.measureAndResolve();
      const now = performance.now();
      this.items.forEach((item, index) => (item.appearAt = now + 120 * index));
    });
    this.startTime = performance.now();
    this.start();
    if (import.meta.env.DEV) (window as unknown as { __hero: HeroPlayground }).__hero = this;
  }

  // ---------- setup ----------

  private defineItems(): void {
    const items: Omit<Item, 'id' | 'radius' | 'appearAt'>[] = [
      { sprite: this.ball, home: { wide: [0.52, 0.42], narrow: [0.8, 0.36] } },
      { sprite: new Glyph('π', 0.95, 'serif'), home: { wide: [0.26, 0.2], narrow: [0.18, 0.16] } },
      { sprite: new WeightPlate(), home: { wide: [0.8, 0.2], narrow: [0.78, 0.16] } },
      { sprite: new Glyph('Σ', 0.85, 'display'), home: { wide: [0.07, 0.72], narrow: [0.14, 0.73] } },
      { sprite: new Chip(), home: { wide: [0.93, 0.6], narrow: [0.5, 0.76] } },
      { sprite: new Controller(), home: { wide: [0.52, 0.18], narrow: [0.84, 0.72] } },
      { sprite: new Stopwatch(), home: { wide: [0.07, 0.24], narrow: [0.48, 0.12] } }
    ];
    this.items = items.map((item) => ({ ...item, id: -1, radius: 0, appearAt: Infinity }));
  }

  private get layoutKey(): 'wide' | 'narrow' {
    return this.width >= 900 ? 'wide' : 'narrow';
  }

  private homeOf(item: Item): [number, number] {
    const [fx, fy] = item.home[this.layoutKey];
    return [fx * this.width, fy * this.height];
  }

  private spawnItems(): void {
    const world = this.world!;
    this.items.forEach((item) => {
      item.radius = this.radiusFor(item.sprite);
      const [x, y] = this.homeOf(item);
      item.id = world.addBody(x, y, item.radius, item.sprite.mass, item.sprite.restitution);
      world.setVelocity(item.id, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120);
      world.setSpin(item.id, (Math.random() - 0.5) * 0.8);
    });
  }

  private radiusFor(sprite: Sprite): number {
    const radius = sprite.size * this.unit;
    return sprite === this.ball ? Math.max(radius, Motion.finePointer ? 14 : 16) : radius;
  }

  private resize(): void {
    const rect = this.stage!.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas!.width = Math.round(this.width * this.ratio);
    this.canvas!.height = Math.round(this.height * this.ratio);
    this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    this.unit = Math.min(Math.max(Math.min(this.width, this.height * 1.6) / 30, 24), 52);
  }

  private layout(): void {
    this.resize();
    this.world?.resize(this.width, this.height);
    this.measureAndResolve();
  }

  private observeResize(callback: () => void): void {
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(callback, 120);
    });
    observer.observe(this.stage!);
    this.onCleanup(() => observer.disconnect());
    document.fonts?.ready.then(() => callback());
  }

  private observeVisibility(): void {
    const observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.start();
    });
    observer.observe(this.hero!);
    this.listen(document, 'visibilitychange', () => {
      if (!document.hidden) this.start();
    });
    this.onCleanup(() => observer.disconnect());
  }

  // ---------- layout measurement ----------

  /** Ink bounds of every letter of the name, in stage coordinates. */
  private measureLetters(): Box[] {
    const stageRect = this.stage!.getBoundingClientRect();
    const style = getComputedStyle(this.title!);
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const upper = style.textTransform === 'uppercase';

    return $$('[data-letter]', this.title!).map((letter) => {
      const rect = letter.getBoundingClientRect();
      const char = upper ? (letter.textContent ?? '').toUpperCase() : (letter.textContent ?? '');
      const m = measure.measureText(char);
      const contentHeight = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent || rect.height;
      // An inline box spans the font's ascent + descent; the baseline sits at the ascent.
      const baseline = rect.top + m.fontBoundingBoxAscent * (rect.height / contentHeight);
      return {
        minX: rect.left - m.actualBoundingBoxLeft - stageRect.left,
        maxX: rect.left + m.actualBoundingBoxRight - stageRect.left,
        minY: baseline - m.actualBoundingBoxAscent - stageRect.top,
        maxY: baseline + m.actualBoundingBoxDescent - stageRect.top
      };
    });
  }

  /** Text the floating objects should not park on top of (eyebrow, tagline, controls). */
  private avoidZones(): Box[] {
    const stageRect = this.stage!.getBoundingClientRect();
    return $$('[data-play-avoid]', this.hero!).map((element) => {
      const rect = element.getBoundingClientRect();
      return { minX: rect.left - stageRect.left, maxX: rect.right - stageRect.left, minY: rect.top - stageRect.top, maxY: rect.bottom - stageRect.top };
    });
  }

  /** The letters are the only solid colliders; the stage edges are the world's walls. */
  private colliders(letters: Box[]): Box[] {
    return letters;
  }

  private measureAndResolve(): void {
    if (!this.world || !this.settled) return;
    const letters = this.measureLetters();
    this.world.setStatics(this.colliders(letters));
    this.lastScrollY = window.scrollY;
    const blocked = [...letters, ...this.avoidZones()];
    this.items.forEach((item) => {
      const [x, y] = this.resolveHome(this.homeOf(item), item.radius, blocked);
      this.world!.setHome(item.id, x, y);
    });
  }

  /** Moves a home position out of any blocked area, searching outward in a spiral. */
  private resolveHome([x, y]: [number, number], radius: number, blocked: Box[]): [number, number] {
    const margin = radius + 10;
    const isFree = (px: number, py: number) =>
      px > margin && px < this.width - margin && py > margin + 40 && py < this.height - margin - 70 &&
      blocked.every((box) => px < box.minX - margin || px > box.maxX + margin || py < box.minY - margin || py > box.maxY + margin);
    if (isFree(x, y)) return [x, y];
    for (let ring = 1; ring <= 24; ring++) {
      const distance = ring * 14;
      for (let step = 0; step < 16; step++) {
        const angle = (step / 16) * Math.PI * 2 - Math.PI / 2;
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance;
        if (isFree(px, py)) return [px, py];
      }
    }
    return [x, y];
  }

  // ---------- input ----------

  private bindInput(): void {
    const stage = this.stage!;
    this.listen<PointerEvent>(stage, 'pointermove', (event) => this.onMove(event), { passive: true });
    this.listen<PointerEvent>(stage, 'pointerdown', (event) => this.onDown(event));
    this.listen<PointerEvent>(stage, 'pointerup', (event) => this.onUp(event));
    this.listen<PointerEvent>(stage, 'pointercancel', (event) => this.onUp(event));
    this.listen<PointerEvent>(stage, 'pointerleave', () => {
      this.pointer.inside = false;
      this.setCursor('default');
    });
    this.listen(this.gravityButton ?? document.createElement('button'), 'click', () => this.toggleGravity());
    this.listen<KeyboardEvent>(document, 'keydown', (event) => {
      const typing = (event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"], dialog');
      if (!typing && this.visible && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'g') this.toggleGravity();
    });
    this.listen(document, 'hero:konami', () => this.ballStorm());
  }

  private local(event: PointerEvent): { x: number; y: number } {
    const rect = this.stage!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private onMove(event: PointerEvent): void {
    const { x, y } = this.local(event);
    this.pointer = { x, y, inside: true, mouse: event.pointerType === 'mouse' };
    const now = performance.now();
    this.samples.push({ x, y, t: now });
    while (this.samples.length && now - this.samples[0].t > 90) this.samples.shift();

    if (this.pointer.mouse && this.heldId < 0 && this.world) {
      this.hoverId = this.world.pick(x, y, 6);
      this.setCursor(this.hoverId >= 0 ? 'grab' : 'default');
    }
  }

  private onDown(event: PointerEvent): void {
    if (!this.world || (event.target as Element).closest('a, button')) return;
    const { x, y } = this.local(event);

    if (event.pointerType === 'mouse') {
      if (event.button !== 0) return;
      const id = this.world.pick(x, y, 8);
      if (id < 0) return;
      event.preventDefault();
      this.heldId = id;
      this.world.hold(id);
      this.stage!.setPointerCapture(event.pointerId);
      this.setCursor('grabbing');
      if (id === this.items[0].id && this.rallyActive) this.endRally(false);
      return;
    }

    // Touch and pen: a tap flicks the nearest object upward, without blocking page scroll.
    const id = this.world.pick(x, y, 30);
    if (id < 0) return;
    const body = this.world.body(id);
    const dx = body.x - x;
    const dy = body.y - y;
    const length = Math.hypot(dx, dy) || 1;
    this.world.addVelocity(id, (dx / length) * 260, -720 + (dy / length) * 120);
    this.world.setSpin(id, (dx / length) * 6);
    if (id === this.items[0].id) this.tapHits += 1;
  }

  private onUp(event: PointerEvent): void {
    if (this.heldId < 0 || !this.world) return;
    const { vx, vy } = this.velocity();
    this.world.release(this.heldId, vx, vy);
    this.heldId = -1;
    if (this.stage!.hasPointerCapture(event.pointerId)) this.stage!.releasePointerCapture(event.pointerId);
    this.setCursor(this.pointer.inside ? 'grab' : 'default');
  }

  /** Pointer velocity (px/s) over the last ~90 ms. */
  private velocity(): { vx: number; vy: number } {
    const now = performance.now();
    const recent = this.samples.filter((sample) => now - sample.t < 90);
    if (recent.length < 2) return { vx: 0, vy: 0 };
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = Math.max((last.t - first.t) / 1000, 1 / 240);
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
  }

  private setCursor(state: string): void {
    if (state === this.cursorState) return;
    this.cursorState = state;
    document.dispatchEvent(new CustomEvent('cursor:state', { detail: state }));
  }

  // ---------- game rules ----------

  private updateRally(dt: number): void {
    const world = this.world!;
    const ball = this.items[0];
    const hits = world.takePointerHits(ball.id) + this.tapHits;
    this.tapHits = 0;
    if (hits > 0 && this.heldId !== ball.id) {
      if (!this.rallyActive) this.startRally();
      else this.rally += hits;
      this.renderHud(true);
    }

    const floorHits = world.takeFloorHits(ball.id);
    if (!this.rallyActive) return;
    if (floorHits > 0) {
      this.endRally(true);
      return;
    }
    // A ball that comes to rest on a letter also ends the rally.
    const { vx, vy } = world.body(ball.id);
    this.rallyStill = Math.hypot(vx, vy) < 25 ? this.rallyStill + dt : 0;
    if (this.rallyStill > 1.2) this.endRally(true);
  }

  private startRally(): void {
    this.rallyActive = true;
    this.rally = 1;
    this.rallyStill = 0;
    this.world!.setFlags(this.items[0].id, BodyFlag.Active | BodyFlag.Gravity);
  }

  private endRally(counts: boolean): void {
    this.rallyActive = false;
    const score = this.rally;
    if (counts && score > 0) {
      if (score > this.best) {
        this.best = score;
        this.storage.set(HeroPlayground.BEST_KEY, String(score));
        Toast.show(format(this.strings.newBest, { n: `<b>${score}</b>` }));
      } else if (score > 1) {
        Toast.show(format(this.strings.rallyOver, { n: `<b>${score}</b>` }));
      }
    }
    this.renderHud();
    window.setTimeout(() => {
      if (this.rallyActive) return;
      this.rally = 0;
      this.renderHud();
      if (!this.gravityOn && this.heldId !== this.items[0].id) this.world!.setFlags(this.items[0].id, BodyFlag.Active | BodyFlag.Homing);
    }, 1400);
  }

  private renderHud(bump = false): void {
    const pad = (value: number) => String(value).padStart(2, '0');
    if (this.rallyLabel) {
      this.rallyLabel.textContent = pad(this.rally);
      if (bump) {
        this.rallyLabel.classList.remove('is-bumped');
        void this.rallyLabel.offsetWidth;
        this.rallyLabel.classList.add('is-bumped');
      }
    }
    if (this.bestLabel) this.bestLabel.textContent = pad(this.best);
  }

  private toggleGravity(): void {
    if (!this.world) return;
    this.gravityOn = !this.gravityOn;
    this.gravityButton?.setAttribute('aria-pressed', String(this.gravityOn));
    this.items.forEach((item, index) => {
      if (index === 0 && this.rallyActive) return;
      const flags = BodyFlag.Active | (this.gravityOn ? BodyFlag.Gravity : BodyFlag.Homing) | (item.id === this.heldId ? BodyFlag.Held : 0);
      this.world!.setFlags(item.id, flags);
      if (!this.gravityOn) this.world!.addVelocity(item.id, 0, -160);
    });
  }

  /** Konami code reward: a burst of extra ping-pong balls. */
  private ballStorm(): void {
    if (!this.world) return;
    const radius = this.radiusFor(this.ball) * 0.8;
    for (let i = 0; i < 14; i++) {
      const id = this.world.addBody(this.width * (0.1 + Math.random() * 0.8), radius + 10 + Math.random() * 40, radius, 0.25, 0.85);
      if (id < 0) break;
      this.world.setFlags(id, BodyFlag.Active | BodyFlag.Gravity);
      this.world.setVelocity(id, (Math.random() - 0.5) * 600, Math.random() * 200);
      this.stormBalls.push({ id, radius });
    }
    if (ScrollEffects.lenis) ScrollEffects.lenis.scrollTo(this.stage!, { offset: -120, duration: 1.2 });
    else window.scrollTo({ top: 0 });
    const strings = readJson<{ konami: string }>($('[data-toast-region]') ?? document.body, 'data-strings', { konami: 'Ball storm!' });
    Toast.show(strings.konami);
  }

  // ---------- loop & drawing ----------

  private start(): void {
    if (this.frame || !this.world) return;
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.frame = 0;
    if (!this.visible || document.hidden) return;
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;
    const world = this.world!;

    // The name moves with the scroll-out effect, so keep its colliders in sync.
    if (this.settled && window.scrollY !== this.lastScrollY) {
      world.setStatics(this.colliders(this.measureLetters()));
      this.lastScrollY = window.scrollY;
    }

    const { vx, vy } = this.velocity();
    world.setPointer(this.pointer.x, this.pointer.y, vx, vy, 18, this.pointer.inside && this.pointer.mouse);
    world.step(dt);
    this.updateRally(dt);
    this.draw(now);
    this.frame = requestAnimationFrame(this.tick);
  };

  private draw(now: number): void {
    const ctx = this.ctx;
    const world = this.world!;
    const time = (now - this.startTime) / 1000;
    ctx.clearRect(0, 0, this.width, this.height);

    for (const item of this.items) {
      const scale = this.appearScale(now, item.appearAt);
      if (scale <= 0) continue;
      const body = world.body(item.id);
      ctx.save();
      ctx.translate(body.x, body.y);
      ctx.rotate(body.angle);
      ctx.scale(scale, scale);
      item.sprite.draw(ctx, body.radius, {
        highlighted: item.id === this.hoverId || item.id === this.heldId,
        time,
        active: item.sprite === this.ball && this.rallyActive
      });
      ctx.restore();
    }

    for (const storm of this.stormBalls) {
      const body = world.body(storm.id);
      ctx.save();
      ctx.translate(body.x, body.y);
      ctx.rotate(body.angle);
      this.ball.draw(ctx, body.radius, { highlighted: false, time, active: false });
      ctx.restore();
    }
  }

  /** Pop-in with a little overshoot when the hero first appears. */
  private appearScale(now: number, appearAt: number): number {
    const t = Math.min(Math.max((now - appearAt) / 700, 0), 1);
    if (t === 0) return 0;
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  /** Reduced motion / no WebAssembly: objects drawn once at their (resolved) homes. */
  private drawStatic(): void {
    this.resize();
    const blocked = [...this.measureLetters(), ...this.avoidZones()];
    this.ctx.clearRect(0, 0, this.width, this.height);
    for (const item of this.items) {
      const radius = this.radiusFor(item.sprite);
      const [x, y] = this.resolveHome(this.homeOf(item), radius, blocked);
      this.ctx.save();
      this.ctx.translate(x, y);
      item.sprite.draw(this.ctx, radius, { highlighted: false, time: 0, active: false });
      this.ctx.restore();
    }
  }
}
