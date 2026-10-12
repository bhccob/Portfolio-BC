import { Component } from '../core/Component';
import { Motion } from '../core/Motion';
import { SafeStorage } from '../core/SafeStorage';
import { $, $$, format, readJson } from '../core/dom';
import { Toast } from '../ui/Toast';
import { ScrollEffects } from '../ui/ScrollEffects';
import { BodyFlag, PhysicsWorld } from './PhysicsWorld';
import { Chip, Controller, Glyph, PingPongBall, Stopwatch, WeightPlate, type Sprite } from './sprites';
import { TrickShots, type FrameEvents, type Point } from './TrickShots';
import { GameSound } from './GameSound';

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

interface PlayStrings {
  hint: string;
  hintTouch: string;
  hintPlaying: string;
  go: string;
  resultTitle: string;
  result: string;
  newBest: string;
  best: string;
}

/**
 * The off-duty playground. Line-art objects float around the words
 * TRAIN · RUN · PLAY; visitors grab and throw them (mouse) or flick them
 * (touch), and every letter is a solid collider. Pressing Start begins a
 * 60-second round of trick shots (rules in TrickShots.ts): keep the ping-pong
 * ball up and knock it through the rings.
 *
 * All simulation happens in C (native/physics.c → WebAssembly). This class
 * handles loading, input, layout measurement and drawing, and wires the game
 * to the HUD. The engine only loads once the section scrolls near, so it
 * costs nothing while the visitor is at the top of the page.
 */
export class Playground extends Component {
  private static readonly WASM_URL = '/wasm/physics.wasm';
  private static readonly BEST_KEY = 'bob-trickshot-best';
  private static readonly GRAVITY = 1150;

  private readonly section = $('[data-play]');
  private readonly stage = $('[data-play-stage]');
  private readonly canvas = $<HTMLCanvasElement>('[data-play-canvas]');
  private readonly title = $('[data-play-title]');
  private readonly hint = $('[data-play-hint]');
  private readonly gravityButton = $<HTMLButtonElement>('[data-gravity]');
  private readonly startButton = $<HTMLButtonElement>('[data-start]');
  private readonly soundButton = $<HTMLButtonElement>('[data-sound]');
  private readonly panel = $('[data-panel]');
  private readonly countLabel = $('[data-countdown]');
  private readonly result = $('[data-result]');
  private readonly announcer = $('[data-announce]');
  private readonly stats = {
    time: $('[data-time]'),
    score: $('[data-score]'),
    combo: $('[data-combo]'),
    best: $('[data-best]')
  };
  private readonly storage = SafeStorage.local();
  private readonly sound = new GameSound();
  private readonly game = new TrickShots({
    findSpot: (radius, ball) => this.findSpot(radius, ball),
    ringRadius: () => Math.max(this.radiusFor(this.ball) * 2.5, 30),
    bounds: () => ({ width: this.width, height: this.height })
  });

  private ctx!: CanvasRenderingContext2D;
  private world: PhysicsWorld | null = null;
  private booting: Promise<boolean> | null = null;
  private strings!: PlayStrings;

  private items: Item[] = [];
  private stormBalls: { id: number; radius: number }[] = [];
  private readonly ball = new PingPongBall();
  private width = 0;
  private height = 0;
  private ratio = 1;
  private unit = 40;
  private letters: Box[] = [];
  private avoid: Box[] = [];

  private pointer = { x: 0, y: 0, inside: false, mouse: false };
  private samples: { x: number; y: number; t: number }[] = [];
  private heldId = -1;
  private hoverId = -1;
  private cursorState = 'default';
  private lastBump = 0;

  private best = 0;
  private gravityOn = false;
  private visible = false;
  private frame = 0;
  private lastTime = 0;
  private startTime = 0;
  private settled = false;

  mount(): void {
    if (!this.section || !this.stage || !this.canvas || !this.title) return;
    this.ctx = this.canvas.getContext('2d')!;
    this.strings = readJson<PlayStrings>(this.section, 'data-strings', {
      hint: '',
      hintTouch: '',
      hintPlaying: '',
      go: 'Go!',
      resultTitle: '',
      result: '{score}',
      newBest: '{n}',
      best: '{n}'
    });
    this.best = this.storage.getNumber(Playground.BEST_KEY, 0);
    this.setHint(false);
    this.renderHud();
    this.bindControls();

    this.defineItems();
    this.resize();

    if (Motion.reduced) {
      // No autonomous motion: the objects are drawn once, in place, until the visitor presses Start.
      document.fonts?.ready.then(() => this.drawStatic());
      this.observeResize(() => (this.world ? this.layout() : this.drawStatic()));
      return;
    }

    // Load and start the physics only when the section comes near the viewport.
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        near.disconnect();
        void this.boot();
      },
      { rootMargin: '800px 0px' }
    );
    near.observe(this.stage);
    this.onCleanup(() => near.disconnect());
  }

  // ---------- setup ----------

  private boot(): Promise<boolean> {
    this.booting ??= this.load();
    return this.booting;
  }

  private async load(): Promise<boolean> {
    try {
      this.world = await PhysicsWorld.load(Playground.WASM_URL);
    } catch (error) {
      console.warn('[playground] physics unavailable, showing static objects', error);
      this.drawStatic();
      if (this.startButton) this.startButton.hidden = true;
      return false;
    }

    this.world.init(this.width, this.height);
    this.world.gravity = Playground.GRAVITY;
    this.spawnItems();
    this.bindInput();
    this.observeResize(() => this.layout());
    this.observeVisibility();

    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      this.settled = true;
      this.measureAndResolve();
      const now = performance.now();
      this.items.forEach((item, index) => (item.appearAt = now + 120 * index));
    });
    this.startTime = performance.now();
    this.start();
    if (import.meta.env.DEV) (window as unknown as { __play: Playground }).__play = this;
    return true;
  }

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
  }

  private observeVisibility(): void {
    const observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.start();
    });
    observer.observe(this.stage!);
    this.listen(document, 'visibilitychange', () => {
      if (!document.hidden) this.start();
    });
    this.onCleanup(() => observer.disconnect());
  }

  // ---------- layout measurement ----------

  /**
   * Ink bounds of every letter of the words, in stage coordinates. The words
   * sit inside the stage, so these only change when the layout does: they are
   * measured on resize and font load, never per frame.
   */
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

  /** Text the floating objects and rings should keep clear of (the HUD). */
  private avoidZones(): Box[] {
    const stageRect = this.stage!.getBoundingClientRect();
    return $$('[data-play-avoid]', this.section!).map((element) => {
      const rect = element.getBoundingClientRect();
      return { minX: rect.left - stageRect.left, maxX: rect.right - stageRect.left, minY: rect.top - stageRect.top, maxY: rect.bottom - stageRect.top };
    });
  }

  private measureAndResolve(): void {
    if (!this.world || !this.settled) return;
    this.letters = this.measureLetters();
    this.avoid = this.avoidZones();
    this.world.setStatics(this.letters);
    const blocked = [...this.letters, ...this.avoid];
    this.items.forEach((item, index) => {
      if (index === 0 && this.game.active) return;
      const [x, y] = this.resolveHome(this.homeOf(item), item.radius, blocked);
      this.world!.setHome(item.id, x, y);
    });
  }

  private isFree(px: number, py: number, margin: number, blocked: Box[]): boolean {
    return (
      px > margin && px < this.width - margin && py > margin + 40 && py < this.height - margin - 70 &&
      blocked.every((box) => px < box.minX - margin || px > box.maxX + margin || py < box.minY - margin || py > box.maxY + margin)
    );
  }

  /** Moves a home position out of any blocked area, searching outward in a spiral. */
  private resolveHome([x, y]: [number, number], radius: number, blocked: Box[]): [number, number] {
    const margin = radius + 10;
    if (this.isFree(x, y, margin, blocked)) return [x, y];
    for (let ring = 1; ring <= 24; ring++) {
      const distance = ring * 14;
      for (let step = 0; step < 16; step++) {
        const angle = (step / 16) * Math.PI * 2 - Math.PI / 2;
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance;
        if (this.isFree(px, py, margin, blocked)) return [px, py];
      }
    }
    return [x, y];
  }

  /** A random spot for a new ring: clear of the letters, the HUD, the other rings and the ball. */
  private findSpot(radius: number, ball: Point): Point | null {
    const rings = this.game.rings.filter((ring) => ring.hitAt < 0);
    const objects = this.world ? this.items.slice(1).map((item) => this.world!.body(item.id)) : [];
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = radius + 20 + Math.random() * (this.width - 2 * radius - 40);
      const y = radius + 50 + Math.random() * (this.height - 2 * radius - 150);
      // Letters may sit inside a ring (the ball can still pass beside them), but not cover its middle.
      if (!this.isFree(x, y, radius * 0.45, this.letters) || !this.isFree(x, y, radius + 8, this.avoid)) continue;
      if (Math.hypot(x - ball.x, y - ball.y) < radius + 120) continue;
      if (rings.some((ring) => Math.hypot(x - ring.x, y - ring.y) < radius + ring.r + 30)) continue;
      // Rings keep clear of the floating objects too (relaxed on the last tries, since the objects move).
      if (attempt < 45 && objects.some((body) => Math.hypot(x - body.x, y - body.y) < radius + body.radius + 12)) continue;
      return { x, y };
    }
    return null;
  }

  // ---------- input ----------

  private bindControls(): void {
    if (this.startButton) this.listen(this.startButton, 'click', () => void this.play());
    $$('[data-again]', this.section!).forEach((button) => this.listen(button, 'click', () => void this.play()));
    $$('[data-close]', this.section!).forEach((button) => this.listen(button, 'click', () => this.closePanel()));
    if (this.soundButton) {
      this.soundButton.setAttribute('aria-pressed', String(this.sound.enabled));
      this.listen(this.soundButton, 'click', () => this.soundButton!.setAttribute('aria-pressed', String(this.sound.toggle())));
    }
    if (this.gravityButton) this.listen(this.gravityButton, 'click', () => void this.toggleGravity());
    this.listen<KeyboardEvent>(document, 'keydown', (event) => this.onKey(event));
    this.listen(document, 'hero:konami', () => void this.ballStorm());
  }

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
  }

  private onKey(event: KeyboardEvent): void {
    const typing = (event.target as HTMLElement | null)?.closest('input, textarea, select, button, a, [contenteditable="true"], dialog');
    if (typing || event.metaKey || event.ctrlKey || event.altKey || !this.visible) return;
    const key = event.key.toLowerCase();
    if (key === 'g' && !this.game.active) void this.toggleGravity();
    // Space bumps the ball for keyboard players during a round.
    if (key === ' ' && this.game.phase === 'playing') {
      event.preventDefault();
      this.bump();
    }
  }

  private bump(): void {
    const now = performance.now();
    if (!this.world || now - this.lastBump < 250) return;
    this.lastBump = now;
    const id = this.items[0].id;
    const body = this.world.body(id);
    this.world.setVelocity(id, body.vx * 0.5 + (Math.random() - 0.5) * 160, -760);
    this.world.setSpin(id, (Math.random() - 0.5) * 8);
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
      // During a round the ball is hit, not grabbed.
      if (this.game.active && this.hoverId === this.items[0].id) this.hoverId = -1;
      this.setCursor(this.hoverId >= 0 ? 'grab' : 'default');
    }
  }

  private onDown(event: PointerEvent): void {
    if (!this.world || (event.target as Element).closest('a, button')) return;
    const { x, y } = this.local(event);

    if (event.pointerType === 'mouse') {
      if (event.button !== 0) return;
      const id = this.world.pick(x, y, 8);
      if (id < 0 || (this.game.active && id === this.items[0].id)) return;
      event.preventDefault();
      this.heldId = id;
      this.world.hold(id);
      this.stage!.setPointerCapture(event.pointerId);
      this.setCursor('grabbing');
      return;
    }

    // Touch and pen: a tap flicks the nearest object upward, without blocking page scroll.
    const id = this.world.pick(x, y, this.game.active ? 60 : 30);
    if (id < 0) return;
    const body = this.world.body(id);
    const dx = body.x - x;
    const dy = body.y - y;
    const length = Math.hypot(dx, dy) || 1;
    this.world.addVelocity(id, (dx / length) * 260, -720 + (dy / length) * 120);
    this.world.setSpin(id, (dx / length) * 6);
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

  // ---------- the game ----------

  private async play(): Promise<void> {
    if (!(await this.boot())) return;
    const world = this.world!;
    const ball = this.items[0];
    this.closePanel();
    this.game.start();
    // The ball waits at the top centre during the countdown.
    if (this.heldId === ball.id) this.heldId = -1;
    world.setHome(ball.id, this.width / 2, this.height * 0.3);
    world.setFlags(ball.id, BodyFlag.Active | BodyFlag.Homing);
    world.setVelocity(ball.id, 0, 0);
    world.takeFloorHits(ball.id);
    if (this.startButton) this.startButton.hidden = true;
    this.setHint(true);
    this.showCount(String(TrickShots.COUNTDOWN_S));
    this.renderHud();
    // Bring the whole stage into view if the round starts with it half off-screen.
    const rect = this.stage!.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      if (ScrollEffects.lenis) ScrollEffects.lenis.scrollTo(this.stage!, { offset: -90, duration: 0.9 });
      else this.stage!.scrollIntoView({ block: 'center' });
    }
    this.start();
  }

  private handle(events: FrameEvents): void {
    const world = this.world!;
    const ball = this.items[0];
    if (events.count) this.showCount(String(events.count));
    if (events.go) {
      this.showCount(this.strings.go);
      window.setTimeout(() => this.hideCount(), 600);
      world.setFlags(ball.id, BodyFlag.Active | BodyFlag.Gravity);
      world.setVelocity(ball.id, (Math.random() - 0.5) * 120, -620);
      this.announce(this.strings.go);
    }
    if (events.hit) {
      if (events.hit.ring.gold) this.sound.chime();
      else this.sound.tok(events.hit.combo);
      this.renderHud(true);
    }
    if (events.comboLost) {
      this.sound.thud();
      this.renderHud();
    }
    if (events.second !== undefined) this.renderHud();
    if (events.ended) this.end();
  }

  private end(): void {
    const score = this.game.score;
    const record = score > this.best;
    if (record) {
      this.best = score;
      this.storage.set(Playground.BEST_KEY, String(score));
    }
    const text = format(this.strings.result, { score, combo: this.game.bestCombo, rings: this.game.hits });
    const bestLine = record ? format(this.strings.newBest, { n: score }) : format(this.strings.best, { n: this.best });
    this.showResult(text, bestLine);
    this.announce(`${this.strings.resultTitle} ${text}. ${bestLine}`);
    this.setHint(false);
    this.renderHud();
    if (this.startButton) this.startButton.hidden = false;

    // The ball floats back home after a moment.
    window.setTimeout(() => {
      if (this.game.active || !this.world) return;
      const ball = this.items[0];
      const [x, y] = this.resolveHome(this.homeOf(ball), ball.radius, [...this.letters, ...this.avoid]);
      this.world.setHome(ball.id, x, y);
      if (!this.gravityOn) this.world.setFlags(ball.id, BodyFlag.Active | BodyFlag.Homing);
    }, 1200);
  }

  private showCount(text: string): void {
    if (!this.panel || !this.countLabel) return;
    this.panel.hidden = false;
    this.result?.setAttribute('hidden', '');
    this.countLabel.hidden = false;
    this.countLabel.textContent = text;
    this.countLabel.classList.remove('is-pop');
    void this.countLabel.offsetWidth;
    this.countLabel.classList.add('is-pop');
  }

  private hideCount(): void {
    if (this.panel && this.game.phase === 'playing') this.panel.hidden = true;
  }

  private showResult(text: string, bestLine: string): void {
    if (!this.panel || !this.result) return;
    this.panel.hidden = false;
    if (this.countLabel) this.countLabel.hidden = true;
    this.result.hidden = false;
    const title = $('[data-result-title]', this.result);
    const body = $('[data-result-text]', this.result);
    const best = $('[data-result-best]', this.result);
    if (title) title.textContent = this.strings.resultTitle;
    if (body) body.textContent = text;
    if (best) best.textContent = bestLine;
  }

  private closePanel(): void {
    if (this.panel) this.panel.hidden = true;
  }

  private announce(text: string): void {
    if (this.announcer) this.announcer.textContent = text;
  }

  private setHint(playing: boolean): void {
    if (!this.hint) return;
    this.hint.textContent = playing ? this.strings.hintPlaying : Motion.finePointer ? this.strings.hint : this.strings.hintTouch;
  }

  private renderHud(bump = false): void {
    const { time, score, combo, best } = this.stats;
    if (time) {
      time.textContent = String(Math.ceil(this.game.timeLeft)).padStart(2, '0');
      time.classList.toggle('is-low', this.game.phase === 'playing' && this.game.timeLeft <= 10);
    }
    if (score) {
      score.textContent = String(this.game.score).padStart(4, '0');
      if (bump) {
        score.classList.remove('is-bumped');
        void score.offsetWidth;
        score.classList.add('is-bumped');
      }
    }
    if (combo) combo.textContent = `×${this.game.combo}`;
    if (best) best.textContent = String(this.best).padStart(4, '0');
  }

  private async toggleGravity(): Promise<void> {
    if (!(await this.boot())) return;
    this.gravityOn = !this.gravityOn;
    this.gravityButton?.setAttribute('aria-pressed', String(this.gravityOn));
    this.items.forEach((item, index) => {
      if (index === 0 && this.game.active) return;
      const flags = BodyFlag.Active | (this.gravityOn ? BodyFlag.Gravity : BodyFlag.Homing) | (item.id === this.heldId ? BodyFlag.Held : 0);
      this.world!.setFlags(item.id, flags);
      if (!this.gravityOn) this.world!.addVelocity(item.id, 0, -160);
    });
    this.start();
  }

  /** Konami code reward: a burst of extra ping-pong balls. */
  private async ballStorm(): Promise<void> {
    if (!(await this.boot())) return;
    const world = this.world!;
    const radius = this.radiusFor(this.ball) * 0.8;
    for (let i = 0; i < 14; i++) {
      const id = world.addBody(this.width * (0.1 + Math.random() * 0.8), radius + 10 + Math.random() * 40, radius, 0.25, 0.85);
      if (id < 0) break;
      world.setFlags(id, BodyFlag.Active | BodyFlag.Gravity);
      world.setVelocity(id, (Math.random() - 0.5) * 600, Math.random() * 200);
      this.stormBalls.push({ id, radius });
    }
    if (ScrollEffects.lenis) ScrollEffects.lenis.scrollTo(this.stage!, { offset: -120, duration: 1.2 });
    else this.stage!.scrollIntoView();
    const strings = readJson<{ konami: string }>($('[data-toast-region]') ?? document.body, 'data-strings', { konami: 'Ball storm!' });
    Toast.show(strings.konami);
    this.start();
  }

  // ---------- loop & drawing ----------

  private start(): void {
    if (this.frame || !this.world) return;
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.frame = 0;
    // A round keeps its clock running only while it can be seen; it simply pauses otherwise.
    if (!this.visible || document.hidden) return;
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;
    const world = this.world!;
    const ball = this.items[0];

    const { vx, vy } = this.velocity();
    world.setPointer(this.pointer.x, this.pointer.y, vx, vy, 18, this.pointer.inside && this.pointer.mouse);
    world.step(dt);

    world.takePointerHits(ball.id);
    const floorHits = world.takeFloorHits(ball.id);
    const body = world.body(ball.id);
    this.handle(this.game.update(dt, now, { x: body.x, y: body.y, radius: body.radius }, floorHits));

    this.draw(now);
    this.frame = requestAnimationFrame(this.tick);
  };

  private draw(now: number): void {
    const ctx = this.ctx;
    const world = this.world!;
    const time = (now - this.startTime) / 1000;
    ctx.clearRect(0, 0, this.width, this.height);

    // Rings sit behind the objects, so the ball visibly passes through them.
    this.game.draw(ctx, now);

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
        active: item.sprite === this.ball && this.game.active
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

  /** Pop-in with a little overshoot when the playground first appears. */
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
