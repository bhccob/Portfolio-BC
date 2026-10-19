import { HUB_LAYERS, type HubLayerId } from '../three/HubChoreography';

/** Where a layer's callout attaches, in CSS pixels on the stage. */
export interface CalloutAnchor {
  x: number;
  y: number;
  visible: boolean;
}

export type CalloutAnchors = Record<HubLayerId, CalloutAnchor>;

/** Where the callouts can go at the hub, at rest (HubScene.hubFrame()). */
export interface HubRest {
  bounds: DeviceRect | null;
  anchors: CalloutAnchors;
}

/** The device's extent on the stage, in CSS pixels (HubScene.bounds()). */
export interface DeviceRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * How the callouts lie: leaders to a column right of the device (`column`),
 * or a list in the free band on the device's right (`right`, a short or
 * cramped stage) or under it (`bottom`, a tall stage).
 */
export type CalloutLayout = 'column' | 'right' | 'bottom';

/** One callout laid out: its leader's path, the dot on the anchor, and the label's left middle. */
export interface CalloutPlace {
  path: string;
  dot: readonly [number, number];
  label: readonly [number, number];
}

/** The callouts' geometry, in CSS pixels. */
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
  margin: 24,
  /** The column's labels start at least this far right of the device. */
  clear: 12,
  /** The list on the device's right: this far from it, and never narrower than `min` (it wraps). */
  list: { gap: 24, min: 140 },
  /** The list under the device: the band the scene keeps free reaches this far above it. */
  below: 20,
  /**
   * A stage narrower than `narrow` pixels, or than `landscape` times its
   * height (where the scene centres the device), is narrow: its callouts are
   * a list. As wide as `landscape` or wider, a list goes on the device's
   * right; narrower, under it.
   */
  narrow: 760,
  landscape: 1.2
} as const;

/** Rounded to the middle of a pixel, so a 1px line along it lands on one row of pixels. */
function crisp(value: number): number {
  return Math.round(value - 0.5) + 0.5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Where the column's runs end: at 72% of the width, or further left so the widest label fits. */
export function columnAt(width: number, labelWidth: number): number {
  const { column, edge, gap } = CALLOUT_LAYOUT;
  return Math.round(Math.min(width * column, width - edge - labelWidth - gap));
}

/**
 * Whether the column fits the device as it stands in `hub`: every visible
 * anchor reaches the column with a diagonal, and the labels start clear of
 * the device (`clear` right of its extent), so no label covers it.
 */
export function columnFits(hub: HubRest, ids: readonly HubLayerId[], width: number, labelWidth: number): boolean {
  const { gap, run, clear } = CALLOUT_LAYOUT;
  if (width <= 0) return false;
  const column = columnAt(width, labelWidth);
  if (ids.some((id) => hub.anchors[id]?.visible && hub.anchors[id].x > column - run)) return false;
  return !hub.bounds || column + gap >= hub.bounds.right + clear;
}

/**
 * How the callouts lie on a stage of this size (the stage's own, not the
 * viewport's, which counts a scrollbar), given whether the column fits the
 * device at rest at the hub without any reserved band (`columnFitsAtRest`).
 * A narrow stage always takes a list; a wide one the column where it fits.
 * The list goes under the device only on a stage narrower than `landscape`,
 * which is narrow whatever the column does: so the band the scene then
 * reserves, which changes the device's framing, can never feed back into
 * the choice. Pure.
 */
export function chooseLayout(width: number, height: number, columnFitsAtRest: boolean): CalloutLayout {
  const { narrow, landscape } = CALLOUT_LAYOUT;
  const wide = width >= height * landscape;
  if (wide && width >= narrow && columnFitsAtRest) return 'column';
  return wide ? 'right' : 'bottom';
}

/**
 * Lays the callouts out in the column, as in the approved hub image: from
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
  const { gap, rise, run, spacing, margin } = CALLOUT_LAYOUT;
  const places: Partial<Record<HubLayerId, CalloutPlace>> = {};
  if (width <= 0 || height <= 0) return places;
  const column = columnAt(width, labelWidth);
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

/** The width of the free band on the device's right, for the list there (never under `list.min`). */
export function rightBand(device: DeviceRect, width: number): number {
  const { edge, list } = CALLOUT_LAYOUT;
  return Math.max(list.min, Math.floor(width - edge - Math.ceil(device.right + list.gap)));
}

/** The list's top left in that band: just right of the device, inside the right edge, centred top to bottom. */
export function placeRightList(device: DeviceRect, width: number, height: number, listWidth: number, listHeight: number): [number, number] {
  const { edge, margin, list } = CALLOUT_LAYOUT;
  const x = Math.min(Math.ceil(device.right + list.gap), width - edge - listWidth);
  const y = Math.round(clamp(height / 2 - listHeight / 2, margin, Math.max(margin, height - margin - listHeight)));
  return [x, y];
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
 * the anchors and the device's extent it is handed and writes transforms,
 * paths, opacity and attributes only, never reading layout (sizes are
 * measured by a ResizeObserver, off the frame).
 *
 * The callouts never cover the device at rest. In the column (`data-list`
 * absent) the labels start right of it. Where the column does not fit the
 * device as it stands at the hub (judged from that rest pose for the stage's
 * size, so a pose it is passing through, after a jump in the scroll or in a
 * drag, never decides), and on a narrow stage, they are a list (`data-list`,
 * laid out by CSS) with short leaders of their own: in the free band on the
 * device's right on a wide or short stage, under it on a tall one, where
 * `bottomBand` tells the scene how much to keep free.
 *
 * The root starts hidden (`data-gone`) and every callout unplaced
 * (`data-off`), so nothing shows before the first frame places it.
 */
export class Callouts {
  private readonly stage: HTMLElement;
  private readonly items: Item[];
  private readonly ids: HubLayerId[];
  private readonly hoverHandlers: ((id: HubLayerId | null) => void)[] = [];
  private readonly clickHandlers: ((id: HubLayerId) => void)[] = [];
  private readonly bandHandlers: ((pixels: number) => void)[] = [];
  /** The band last announced (bottomBand), so a change is announced once. */
  private announced = 0;
  private readonly cleanups: (() => void)[] = [];
  private width = 0;
  private height = 0;
  /** The widest label on one line, as the column lays it out. */
  private labelWidth = 0;
  private listWidth = 0;
  private listHeight = 0;
  private listPlaced = '';
  /** Under the device: from the list's top to the stage's bottom, and `below` more (0 until measured so). */
  private band = 0;
  private opacity = Number.NaN;
  private layout: CalloutLayout | null = null;
  private disposed = false;

  constructor(private readonly root: HTMLElement) {
    this.stage = root.parentElement ?? root;
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
    // A narrow stage's list is laid out before the first frame, so its band is measured by then.
    if (this.width > 0) this.setLayout(chooseLayout(this.width, this.height, true));
    if (typeof ResizeObserver !== 'undefined') {
      // The stage's size, the list's, and the labels' (which change with the layout and when the font
      // arrives), measured off the frame loop.
      const observer = new ResizeObserver(() => this.measure());
      for (const element of [this.stage, root, ...this.items.flatMap((item) => [item.element, item.label])]) observer.observe(element);
      this.cleanups.push(() => observer.disconnect());
    }
  }

  /** CSS pixels at the stage's bottom the scene keeps free of the device: the list's band, while it lies under the device. */
  get bottomBand(): number {
    return this.layout === 'bottom' ? this.band : 0;
  }

  /**
   * Places the callouts for this frame, shown at `opacity` (0..1): in the
   * column, or as a list where the stage is narrow or the column does not
   * fit the device at rest at the `hub` (chooseLayout); the list on its
   * right follows `device` (its extent in the frame just drawn). Interactive
   * only when nearly opaque (`data-shown`), and out of the page's focus order
   * when fully transparent (`data-gone`).
   */
  update(anchors: CalloutAnchors, opacity: number, device: DeviceRect | null = null, hub: HubRest | null = null): void {
    if (this.disposed) return;
    this.setOpacity(opacity);
    const shown = this.opacity > 0 && this.width > 0;
    const fits = hub === null || columnFits(hub, this.ids, this.width, this.labelWidth);
    this.setLayout(chooseLayout(this.width, this.height, fits));
    if (!shown) return;
    if (this.layout === 'column') this.placeColumn(anchors);
    else if (this.layout === 'right' && device) this.placeRight(device);
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

  /**
   * Calls `handler` with `bottomBand` whenever it changes: as soon as it is
   * measured (off the frame loop), so the scene can keep the band free from
   * the next frame it draws, the very first included.
   */
  onBand(handler: (pixels: number) => void): void {
    this.bandHandlers.push(handler);
    handler(this.bottomBand);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.hoverHandlers.length = 0;
    this.clickHandlers.length = 0;
    this.bandHandlers.length = 0;
  }

  private hover(id: HubLayerId | null): void {
    this.hoverHandlers.forEach((handler) => handler(id));
  }

  private placeColumn(anchors: CalloutAnchors): void {
    const places = placeCallouts(anchors, this.ids, this.width, this.height, this.labelWidth);
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

  /** The list in the band on the device's right: its width set when the band changes, its place every frame. */
  private placeRight(device: DeviceRect): void {
    const band = rightBand(device, this.width);
    // A drag sways the band a little; the list keeps its wrapping until the band really changes.
    if (Math.abs(band - this.listWidth) > 16) {
      this.listWidth = band;
      this.root.style.setProperty('--callouts-width', `${band}px`);
    }
    const [x, y] = placeRightList(device, this.width, this.height, this.listWidth, this.listHeight);
    const key = `${x}|${y}`;
    if (key === this.listPlaced) return;
    this.listPlaced = key;
    this.root.style.transform = `translate(${x}px, ${y}px)`;
  }

  private measure(): void {
    this.width = this.stage.clientWidth;
    this.height = this.stage.clientHeight;
    // The labels on one line, as the column needs them; a list may wrap them.
    if (this.layout === null || this.layout === 'column') this.labelWidth = Math.max(0, ...this.items.map((item) => item.label.offsetWidth));
    this.listHeight = this.root.offsetHeight;
    // Only the bottom layout's list says where the band starts.
    const first = this.items[0]?.element;
    if (this.layout === 'bottom' && first) this.band = Math.max(0, this.height - first.offsetTop + CALLOUT_LAYOUT.below);
    this.announce();
  }

  private announce(): void {
    const band = this.bottomBand;
    if (band === this.announced) return;
    this.announced = band;
    this.bandHandlers.forEach((handler) => handler(band));
  }

  private setLayout(layout: CalloutLayout): void {
    if (layout === this.layout) return;
    this.layout = layout;
    if (layout === 'column') this.root.removeAttribute('data-list');
    else this.root.setAttribute('data-list', layout);
    // Each layout places the callouts afresh: a list is laid out by CSS, without the leaders' paths.
    this.root.style.transform = '';
    this.listPlaced = '';
    this.listWidth = 0;
    // Unknown until the new layout is measured: no band rather than a stale one.
    this.band = 0;
    for (const item of this.items) {
      item.placed = '';
      item.label.style.transform = '';
      item.path?.removeAttribute('d');
      this.setOff(item, layout === 'column');
    }
    this.announce();
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
