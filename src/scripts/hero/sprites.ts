/**
 * Line-art sprites for the hero playground. Each sprite draws itself centred
 * on the origin inside a circle of radius `r` (its collision shape); the
 * renderer handles translation and rotation.
 */
export interface DrawState {
  /** Pointer is over the body (mouse) or the body is held. */
  highlighted: boolean;
  /** Seconds since start, for small idle animations. */
  time: number;
  /** Extra emphasis, e.g. the ball during a rally. */
  active: boolean;
}

const INK = 'rgba(214, 200, 245, 0.92)';
const INK_SOFT = 'rgba(214, 200, 245, 0.35)';
const YELLOW = '#ffcf33';

export abstract class Sprite {
  /** Physical properties handed to the engine when the body is created. */
  abstract readonly mass: number;
  abstract readonly restitution: number;
  /** Radius relative to the playground's base unit. */
  abstract readonly size: number;

  abstract draw(ctx: CanvasRenderingContext2D, r: number, state: DrawState): void;

  protected stroke(ctx: CanvasRenderingContext2D, state: DrawState, width = 1.5): void {
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = state.highlighted ? YELLOW : INK;
  }

  /** Faint dashed outline of the collision circle, shown on hover. */
  protected halo(ctx: CanvasRenderingContext2D, r: number, state: DrawState): void {
    if (!state.highlighted) return;
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export class PingPongBall extends Sprite {
  readonly mass = 0.25;
  readonly restitution = 0.88;
  readonly size = 0.42;

  draw(ctx: CanvasRenderingContext2D, r: number, state: DrawState): void {
    ctx.save();
    ctx.shadowColor = 'rgba(255, 210, 63, 0.55)';
    ctx.shadowBlur = state.active ? 26 : 14;
    const gradient = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    gradient.addColorStop(0, '#fff6c9');
    gradient.addColorStop(0.55, YELLOW);
    gradient.addColorStop(1, '#d9a400');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Seam
    ctx.strokeStyle = 'rgba(120, 80, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.98, r * 0.28, 0, 0, Math.PI);
    ctx.stroke();
    this.halo(ctx, r, state);
  }
}

export class WeightPlate extends Sprite {
  readonly mass = 6;
  readonly restitution = 0.3;
  readonly size = 1.25;

  draw(ctx: CanvasRenderingContext2D, r: number, state: DrawState): void {
    this.stroke(ctx, state);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = INK_SOFT;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = state.highlighted ? YELLOW : INK;
    ctx.font = `600 ${Math.round(r * 0.26)}px "Martian Mono Variable", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('20', 0, -r * 0.68 + r * 0.02);
    ctx.font = `500 ${Math.round(r * 0.14)}px "Martian Mono Variable", monospace`;
    ctx.fillText('KG', 0, r * 0.68);
  }
}

export class Glyph extends Sprite {
  readonly mass = 1.4;
  readonly restitution = 0.55;

  constructor(
    private readonly symbol: string,
    readonly size: number,
    private readonly font: 'serif' | 'display' | 'mono'
  ) {
    super();
  }

  draw(ctx: CanvasRenderingContext2D, r: number, state: DrawState): void {
    const family = {
      serif: '"Sofia Sans Variable", Georgia, serif',
      display: '"Sofia Sans Extra Condensed Variable", system-ui, sans-serif',
      mono: '"Martian Mono Variable", monospace'
    }[this.font];
    const weight = this.font === 'serif' ? 'italic 400' : '600';
    ctx.fillStyle = state.highlighted ? YELLOW : INK;
    ctx.font = `${weight} ${Math.round(r * 1.7)}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.symbol, 0, r * 0.08);
    this.halo(ctx, r, state);
  }
}

export class Chip extends Sprite {
  readonly mass = 2;
  readonly restitution = 0.45;
  readonly size = 0.95;

  draw(ctx: CanvasRenderingContext2D, r: number, state: DrawState): void {
    this.stroke(ctx, state);
    const half = r * 0.52;
    ctx.beginPath();
    ctx.roundRect(-half, -half, half * 2, half * 2, r * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-half * 0.45, -half * 0.45, half * 0.9, half * 0.9, r * 0.04);
    ctx.stroke();
    const pins = [-0.55, 0, 0.55];
    ctx.beginPath();
    for (const offset of pins) {
      const p = offset * half;
      ctx.moveTo(p, -half);
      ctx.lineTo(p, -r * 0.88);
      ctx.moveTo(p, half);
      ctx.lineTo(p, r * 0.88);
      ctx.moveTo(-half, p);
      ctx.lineTo(-r * 0.88, p);
      ctx.moveTo(half, p);
      ctx.lineTo(r * 0.88, p);
    }
    ctx.stroke();
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(-half * 0.7, -half * 0.7, r * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Controller extends Sprite {
  readonly mass = 3;
  readonly restitution = 0.4;
  readonly size = 1.1;

  draw(ctx: CanvasRenderingContext2D, r: number, state: DrawState): void {
    this.stroke(ctx, state);
    const w = r * 0.92;
    const h = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(-w + h, -h);
    ctx.lineTo(w - h, -h);
    ctx.arc(w - h, 0, h, -Math.PI / 2, Math.PI / 2 + 0.6);
    ctx.lineTo(r * 0.28, h * 0.45);
    ctx.lineTo(-r * 0.28, h * 0.45);
    ctx.arc(-w + h, 0, h, Math.PI / 2 - 0.6, -Math.PI / 2);
    ctx.closePath();
    ctx.stroke();
    // D-pad
    const dx = -w + h;
    ctx.beginPath();
    ctx.moveTo(dx - h * 0.4, 0);
    ctx.lineTo(dx + h * 0.4, 0);
    ctx.moveTo(dx, -h * 0.4);
    ctx.lineTo(dx, h * 0.4);
    ctx.stroke();
    // Buttons
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(w - h - h * 0.25, -h * 0.18, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = state.highlighted ? YELLOW : INK;
    ctx.beginPath();
    ctx.arc(w - h + h * 0.25, h * 0.18, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Stopwatch extends Sprite {
  readonly mass = 2;
  readonly restitution = 0.5;
  readonly size = 0.95;

  draw(ctx: CanvasRenderingContext2D, r: number, state: DrawState): void {
    this.stroke(ctx, state);
    const face = r * 0.74;
    const cy = r * 0.12;
    ctx.beginPath();
    ctx.arc(0, cy, face, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, cy - face);
    ctx.lineTo(0, -r * 0.82);
    ctx.moveTo(-r * 0.16, -r * 0.88);
    ctx.lineTo(r * 0.16, -r * 0.88);
    ctx.moveTo(face * 0.72, cy - face * 0.72);
    ctx.lineTo(face * 0.88, cy - face * 0.88);
    ctx.stroke();
    // Ticks
    ctx.save();
    ctx.strokeStyle = INK_SOFT;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.moveTo(Math.sin(a) * face * 0.8, cy - Math.cos(a) * face * 0.8);
      ctx.lineTo(Math.sin(a) * face * 0.9, cy - Math.cos(a) * face * 0.9);
    }
    ctx.stroke();
    ctx.restore();
    // A seconds hand that actually ticks.
    const seconds = new Date().getSeconds();
    const angle = (seconds / 60) * Math.PI * 2;
    ctx.strokeStyle = YELLOW;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(Math.sin(angle) * face * 0.7, cy - Math.cos(angle) * face * 0.7);
    ctx.stroke();
  }
}
