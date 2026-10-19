import { HUB_LAYERS, type HubLayerId } from '../three/HubChoreography';

/** Where a layer's callout attaches, in CSS pixels on the stage. */
export interface CalloutAnchor {
  x: number;
  y: number;
  visible: boolean;
}

export type CalloutAnchors = Record<HubLayerId, CalloutAnchor>;

/** One callout laid out: its leader's path, the dot on the anchor, and the label's left middle. */
export interface CalloutPlace {
  path: string;
  dot: readonly [number, number];
  label: readonly [number, number];
}

/** The callouts' geometry on a wide stage, in CSS pixels. */
export const CALLOUT_LAYOUT = {
  /** The leaders' horizontal runs end at this share of the stage's width (the labels' column)... */
  column: 0.72,
  /** ...or further left, so the widest label still ends this far inside the right edge. */
  edge: 24,
  /** Between a run's end and its label. */
  gap: 14,
  /** A label sits this far above its anchor, so its leader starts with a short rise. */
  rise: 28,
  /** The diagonal's shortest horizontal reach. */
  run: 32,
  /** Labels keep at least this far apart, top to bottom. */
  spacing: 30,
  /** Labels stay this far inside the stage's top and bottom. */
  margin: 24
} as const;

/** Rounded to the middle of a pixel, so a 1px line along it lands on one row of pixels. */
function crisp(value: number): number {
  return Math.round(value - 0.5) + 0.5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Lays the callouts out on a wide stage, as in the approved hub image: from
 * each anchor a short diagonal, then a horizontal run to a column at about
 * 72% of the width, the label just after it. Labels go top to bottom in
 * `ids`' order and keep `spacing` apart. A callout whose anchor is off the
 * canvas, or too far right to lead off to the column, is left out (absent
 * from the answer). Pure, so it can be tested without a page.
 */
export function placeCallouts(
  anchors: CalloutAnchors,
  ids: readonly HubLayerId[],
  width: number,
  height: number,
  labelWidth: number
): Partial<Record<HubLayerId, CalloutPlace>> {
  const { column: share, edge, gap, rise, run, spacing, margin } = CALLOUT_LAYOUT;
  const places: Partial<Record<HubLayerId, CalloutPlace>> = {};
  if (width <= 0 || height <= 0) return places;
  const column = Math.round(Math.min(width * share, width - edge - labelWidth - gap));
  let previous = -Infinity;
  for (const id of ids) {
    const anchor = anchors[id];
    if (!anchor?.visible || anchor.x > column - run) continue;
    const y = crisp(clamp(Math.max(anchor.y - rise, previous + spacing), margin, height - margin));
    previous = y;
    const knee = Math.min(anchor.x + Math.max(run, Math.abs(anchor.y - y)), column);
    places[id] = {
      path: `M${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)}L${knee.toFixed(1)} ${y}H${column}`,
      dot: [anchor.x, anchor.y],
      label: [column + gap, y]
    };
  }
  return places;
}

interface Item {
  id: HubLayerId;
  element: HTMLElement;
  label: HTMLButtonElement;
  path: SVGPathElement | null;
  dot: SVGCircleElement | null;
  /** What was last written, so a still frame writes nothing. */
  placed: string;
  off: boolean;
}

/**
 * The hub's callouts (HubStage.astro): one per layer that has one, each a
 * label (a real button) and a gold leader drawn from the layer's projected
 * anchor. `update` runs once a frame, after the scene has drawn: it reads
 * the anchors it is handed and writes transforms, paths and opacity only,
 * never reading layout (sizes are measured by a ResizeObserver, off the
 * frame). On a narrow stage the labels are a list under the device instead
 * (`data-narrow`, laid out by CSS), with short leaders of their own; so they
 * are, too, on a stage too cramped for them to lead off to the right of the
 * device, until the stage is resized or the callouts fade out.
 *
 * The root starts hidden (`data-gone`) and every callout unplaced
 * (`data-off`), so nothing shows before the first frame places it.
 */
export class Callouts {
  private readonly items: Item[];
  private readonly ids: HubLayerId[];
  private readonly hoverHandlers: ((id: HubLayerId | null) => void)[] = [];
  private readonly clickHandlers: ((id: HubLayerId) => void)[] = [];
  private readonly cleanups: (() => void)[] = [];
  private width = 0;
  private height = 0;
  private labelWidth = 0;
  private opacity = Number.NaN;
  private narrow: boolean | null = null;
  /** The labels did not fit beside the device at this size: a list until the stage is resized. */
  private cramped = false;
  private disposed = false;

  constructor(private readonly root: HTMLElement) {
    this.items = Array.from(root.querySelectorAll<HTMLElement>('[data-callout]')).flatMap((element): Item[] => {
      const id = element.dataset.callout as HubLayerId;
      const label = element.querySelector('button');
      if (!HUB_LAYERS.includes(id) || !label) return [];
      return [{ id, element, label, path: element.querySelector('path'), dot: element.querySelector('circle'), placed: '', off: true }];
    });
    // Top to bottom, as the layers stack.
    this.items.sort((a, b) => HUB_LAYERS.indexOf(a.id) - HUB_LAYERS.indexOf(b.id));
    this.ids = this.items.map((item) => item.id);

    for (const item of this.items) {
      item.element.setAttribute('data-off', '');
      const enter = (): void => this.hover(item.id);
      const leave = (): void => this.hover(null);
      const click = (): void => this.clickHandlers.forEach((handler) => handler(item.id));
      const pairs: [string, EventListener][] = [
        ['pointerenter', enter],
        ['pointerleave', leave],
        ['focus', enter],
        ['blur', leave],
        ['click', click]
      ];
      for (const [type, listener] of pairs) item.label.addEventListener(type, listener);
      this.cleanups.push(() => pairs.forEach(([type, listener]) => item.label.removeEventListener(type, listener)));
    }

    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      // The stage's size and the labels' widths (which change when the font arrives), measured off the frame loop.
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(root);
      this.items.forEach((item) => observer.observe(item.label));
      this.cleanups.push(() => observer.disconnect());
    }
  }

  /**
   * Places the callouts for this frame: at the anchors on a wide stage, as a
   * list on a narrow one, shown at `opacity` (0..1). Interactive only when
   * nearly opaque (`data-shown`), and out of the page's focus order when
   * fully transparent (`data-gone`).
   */
  update(anchors: CalloutAnchors, opacity: number, narrow: boolean): void {
    if (this.disposed) return;
    this.setOpacity(opacity);
    // Faded out, the callouts try the column again when they come back.
    if (this.opacity === 0) this.cramped = false;
    this.setNarrow(narrow || this.cramped);
    if (this.narrow || this.opacity === 0 || this.width === 0) return;
    const places = placeCallouts(anchors, this.ids, this.width, this.height, this.labelWidth);
    if (this.items.some((item) => anchors[item.id]?.visible && !places[item.id])) {
      this.cramped = true;
      this.setNarrow(true);
      return;
    }
    for (const item of this.items) {
      const place = places[item.id];
      this.setOff(item, !place);
      if (!place) continue;
      const key = `${place.path}|${place.label[0]}|${place.label[1]}`;
      if (key === item.placed) continue;
      item.placed = key;
      item.path?.setAttribute('d', place.path);
      item.dot?.setAttribute('cx', place.dot[0].toFixed(1));
      item.dot?.setAttribute('cy', place.dot[1].toFixed(1));
      item.label.style.transform = `translate(${place.label[0]}px, ${place.label[1]}px) translateY(-50%)`;
    }
  }

  /** Marks the callout of the layer that is highlighted (null: none), as its layer is. */
  highlight(id: HubLayerId | null): void {
    for (const item of this.items) item.element.toggleAttribute('data-active', item.id === id);
  }

  /** Marks the callout whose highlight is pinned (null: none) as pressed. */
  pin(id: HubLayerId | null): void {
    for (const item of this.items) item.label.setAttribute('aria-pressed', String(item.id === id));
  }

  /** Calls `handler` when a label is hovered or focused, and with null when it is left. */
  onHover(handler: (id: HubLayerId | null) => void): void {
    this.hoverHandlers.push(handler);
  }

  /** Calls `handler` when a label is clicked (or pressed with Enter or Space). */
  onClick(handler: (id: HubLayerId) => void): void {
    this.clickHandlers.push(handler);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.hoverHandlers.length = 0;
    this.clickHandlers.length = 0;
  }

  private hover(id: HubLayerId | null): void {
    this.hoverHandlers.forEach((handler) => handler(id));
  }

  private measure(): void {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    if (width !== this.width || height !== this.height) this.cramped = false;
    this.width = width;
    this.height = height;
    // The labels' widths on one line, as the column needs them; the list may wrap them.
    if (!this.narrow) this.labelWidth = Math.max(0, ...this.items.map((item) => item.label.offsetWidth));
  }

  private setNarrow(narrow: boolean): void {
    if (narrow === this.narrow) return;
    this.narrow = narrow;
    this.root.toggleAttribute('data-narrow', narrow);
    for (const item of this.items) {
      // The list is laid out by CSS: the labels leave their places, the leaders their paths.
      item.placed = '';
      item.label.style.transform = '';
      item.path?.removeAttribute('d');
      this.setOff(item, !narrow);
    }
  }

  private setOpacity(opacity: number): void {
    const value = Number.isNaN(opacity) ? 0 : Math.round(clamp(opacity, 0, 1) * 1000) / 1000;
    if (value === this.opacity) return;
    this.opacity = value;
    this.root.style.opacity = String(value);
    this.root.toggleAttribute('data-gone', value === 0);
    this.root.toggleAttribute('data-shown', value > 0.9);
  }

  private setOff(item: Item, off: boolean): void {
    if (off === item.off) return;
    item.off = off;
    item.element.toggleAttribute('data-off', off);
  }
}
