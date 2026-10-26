import { Fragment, type JSX, type ReactNode, useEffect, useRef } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { placeFact } from './factPlace';

// ---------------------------------------------------------------- the scene shows them

/** One fact's label as the page holds it: the label, its fine gold line and its words. */
export interface LightFactParts {
  root: HTMLElement;
  line: HTMLElement;
  words: HTMLElement;
}

/** The labels on the page, by fact (0 to 4), as React mounts them. */
const labels = new Map<number, LightFactParts>();

/** What each label shows now, as last written to the DOM: nothing is written that has not changed. */
const written = new Map<LightFactParts, { opacity: number; glow: string; side: string; text: string; width: number }>();

/** Puts fact `index`'s label where `showLightFacts` finds it (its refs do). Answers its taking away. */
export function registerLightFact(index: number, parts: LightFactParts): () => void {
  labels.set(index, parts);
  return () => {
    if (labels.get(index) === parts) labels.delete(index);
    written.delete(parts);
  };
}

/** What the scene says of the facts on a frame (src/scene/bob/Void.tsx, from the journey's pose). */
export interface LightFactsView {
  /** The fact riding with the light, 0 to 4, or none. */
  index: number | null;
  /** The side the light's move takes it to (-1 left, 1 right): the label rides on the other. */
  side: -1 | 1;
  /** Its opacity, 0..1: in over 6 way frames, out over 6. */
  opacity: number;
  /** The light's brightness, 0..1: the words glow with it. */
  glow: number;
  /** The light's centre on the screen, NDC. */
  light: { x: number; y: number };
}

/**
 * The widest line an element's text sets, CSS px: read off a Range's line boxes (a wrapped box stays at its max-width,
 * and a phone's label centred on that box would sit off its line).
 */
function widestLine(el: Element): { width: number; lines: number } {
  const range = document.createRange();
  range.selectNodeContents(el);
  const lines = new Map<number, { left: number; right: number }>();
  for (const r of range.getClientRects()) {
    if (r.width < 0.5) continue; // a <br>
    const key = Math.round(r.top);
    const line = lines.get(key);
    if (line) {
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
    } else lines.set(key, { left: r.left, right: r.right });
  }
  let width = 0;
  for (const line of lines.values()) width = Math.max(width, line.right - line.left);
  return { width, lines: lines.size };
}

/** Shrinks a label's words box to its widest line, if its text keeps its lines at that width (the mock-up's measure). */
function fitWords(words: HTMLElement): void {
  words.style.width = '';
  const text = words.querySelector('.light-fact-text');
  const number = words.querySelector('.light-fact-n');
  if (!text || !number) return;
  const set = widestLine(text);
  const pad = (el: Element): number => Number.parseFloat(getComputedStyle(el).paddingLeft) || 0;
  const width = Math.ceil(Math.max(set.width, widestLine(number).width + pad(number)) + pad(words)) + 1;
  if (set.width > 0 && width < words.offsetWidth) {
    words.style.width = `${width}px`;
    if (widestLine(text).lines !== set.lines) words.style.width = '';
  }
}

/**
 * Shows the fact `view` names beside the light on a screen of `size` (CSS px), at its opacity and with the light's
 * glow (`--glow`), and every other label at 0; null shows none. The Void calls it on each frame it poses the scene.
 * The shown label's line and words stand where `placeFact` says (src/ui/factPlace.ts), by transforms set through the
 * CSSOM (the CSP allows no style attribute), with `[data-side]` for the line's direction and `[data-align]` for the
 * words'; a phone's words are held inside the screen by their width, measured again (shrunk to their widest line) when
 * their text or the screen changes.
 */
export function showLightFacts(view: LightFactsView | null, size: { width: number; height: number }): void {
  for (const [index, parts] of labels) {
    let was = written.get(parts);
    if (!was) written.set(parts, (was = { opacity: Number.NaN, glow: '', side: '', text: '', width: 0 }));
    const opacity = view !== null && view.index === index ? Math.round(Math.min(Math.max(view.opacity, 0), 1) * 1000) / 1000 : 0;
    if (opacity !== was.opacity) {
      parts.root.style.opacity = String(opacity);
      was.opacity = opacity;
    }
    if (opacity <= 0 || view === null) continue;
    const glow = Math.min(Math.max(view.glow, 0), 1).toFixed(3);
    if (glow !== was.glow) {
      parts.root.style.setProperty('--glow', glow);
      was.glow = glow;
    }
    const light = { x: ((view.light.x + 1) / 2) * size.width, y: ((1 - view.light.y) / 2) * size.height };
    const viewport = { w: size.width, h: size.height };
    let at = placeFact(light, view.side, viewport);
    // The side first: it sets the words' max-width, which their measure reads.
    const side = at.words.align === 'center' ? 'below' : at.words.align === 'left' ? 'right' : 'left';
    if (side !== was.side) {
      parts.root.setAttribute('data-side', side);
      parts.words.setAttribute('data-align', at.words.align);
      was.side = side;
      was.text = '';
    }
    const text = parts.words.textContent ?? '';
    if (typeof document !== 'undefined' && parts.words.isConnected && (text !== was.text || size.width !== was.width)) fitWords(parts.words);
    was.text = text;
    was.width = size.width;
    // Below the light, the words are held inside the screen by their measured width.
    if (at.words.align === 'center') at = placeFact(light, view.side, viewport, parts.words.offsetWidth);
    parts.line.style.transform = `translate3d(${at.line.x.toFixed(1)}px, ${at.line.y.toFixed(1)}px, 0)`;
    parts.line.style.width = `${at.line.w.toFixed(2)}px`;
    parts.line.style.height = `${at.line.h.toFixed(2)}px`;
    parts.words.style.transform = `translate3d(${at.words.x.toFixed(1)}px, ${at.words.y.toFixed(1)}px, 0)`;
  }
}

// ---------------------------------------------------------------- the labels and the list

/** A fact's words with its "/" as line breaks. */
function lines(fact: string): ReactNode {
  return fact.split(' / ').map((part, k) => (
    <Fragment key={part}>
      {k > 0 && <br />}
      {part}
    </Fragment>
  ));
}

/** Fact `index`'s label beside the light: its number above, the fine gold line, its words. */
function LightFactLabel({ index, fact }: { index: number; fact: string }): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const words = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!root.current || !line.current || !words.current) return;
    return registerLightFact(index, { root: root.current, line: line.current, words: words.current });
  }, [index]);
  return (
    <div className="light-fact" ref={root}>
      <span className="light-fact-line" ref={line} />
      <span className="light-fact-words" ref={words}>
        <span className="light-fact-n">{String(index + 1).padStart(2, '0')}</span>
        <span className="light-fact-text">{lines(fact)}</span>
      </span>
    </div>
  );
}

/**
 * Bob's five facts beside the light in the light dive (spec §3): small, thin labels in the site's label face, one at a
 * time, each riding with the light while it is shown and glowing with it. They are drawn for the eye only: the list
 * (`LightFactList`) is what a screen reader reads. Hidden until the scene shows one (`showLightFacts`).
 */
export function LightFactLabels(): JSX.Element {
  const { t } = useTranslator();
  return (
    <div className="light-fact-layer" aria-hidden="true">
      {t.lightDive.facts.map((fact, index) => (
        <LightFactLabel key={index} index={index} fact={fact} />
      ))}
    </div>
  );
}

/**
 * Bob's five facts as a list in the page (spec §8): server-rendered, so screen readers and crawlers have them and they
 * exist without JavaScript. Visually hidden while 3D is on, where the scene shows them beside the light; in the flow
 * with 3D off (src/styles/base.css).
 */
export function LightFactList(): JSX.Element {
  const { t } = useTranslator();
  return (
    <ol className="light-facts" aria-label={t.nav.about}>
      {t.lightDive.facts.map((fact) => (
        <li key={fact}>{lines(fact)}</li>
      ))}
    </ol>
  );
}
