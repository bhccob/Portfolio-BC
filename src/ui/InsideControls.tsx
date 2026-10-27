import { type JSX, useEffect, useRef } from 'react';
import type { ProjectId } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { type KeyTarget, keyDelta } from '~/input/keyDelta';
import { useScene } from '~/state/store';
import { closeInside, viewInside } from './BeadLabel';

/** The attribute on <html> while the visitor is inside a bead (the store's `inside`): the styles show the two buttons. */
export const INSIDE_ATTRIBUTE = 'data-inside';

/** How far a finger must travel up or down the glass inside a bead before it takes the visitor out, px. */
export const SWIPE_OUT_PX = 40;

/**
 * Listens on `target` for the ways out of a bead's inside other than its button, and calls `leave` for each: Escape;
 * a key that would scroll the story (`keyDelta`: the arrows, Page Up and Down, Space but not on a button it presses,
 * Home and End), with no ctrl, meta or alt held; a turn of the wheel up or down the page, not the browser's zoom (ctrl)
 * and not a sideways one; and a swipe of one finger SWIPE_OUT_PX up or down the glass, more than across it, once per
 * touch (a tap that wavers is still a tap, and a second finger is a pinch). Answers its taking down.
 */
export function leaveInsideOn(target: EventTarget, leave: () => void): () => void {
  let touch: { x: number; y: number } | null = null;
  const key = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.key === 'Escape' || keyDelta({ key: e.key, shiftKey: e.shiftKey, target: e.target as KeyTarget | null }, 1) !== null) leave();
  };
  const wheel = (event: Event): void => {
    const e = event as WheelEvent;
    if (!e.ctrlKey && e.deltaY !== 0 && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) leave();
  };
  const start = (event: Event): void => {
    const touches = (event as TouchEvent).touches;
    touch = touches.length === 1 ? { x: touches[0]!.clientX, y: touches[0]!.clientY } : null;
  };
  const move = (event: Event): void => {
    const touches = (event as TouchEvent).touches;
    if (touch === null) return;
    if (touches.length !== 1) {
      touch = null;
      return;
    }
    const dx = touches[0]!.clientX - touch.x;
    const dy = touches[0]!.clientY - touch.y;
    if (Math.abs(dy) >= SWIPE_OUT_PX && Math.abs(dy) > Math.abs(dx)) {
      touch = null;
      leave();
    }
  };
  target.addEventListener('keydown', key);
  target.addEventListener('wheel', wheel, { passive: true });
  target.addEventListener('touchstart', start, { passive: true });
  target.addEventListener('touchmove', move, { passive: true });
  return () => {
    target.removeEventListener('keydown', key);
    target.removeEventListener('wheel', wheel);
    target.removeEventListener('touchstart', start);
    target.removeEventListener('touchmove', move);
  };
}

/**
 * The two buttons inside a bead (spec 2026-10-27-bob-nebula-space-design.md, goal 6): "Terug" ("Back"), which takes the
 * visitor back out (`closeInside`), and "Bekijk project" ("View project"), which opens the bead's page (`viewInside`),
 * big and at the foot of the screen, centred, for one thumb; "Terug" first, so Tab reaches the way out first. They are
 * in the page from the start and hidden (and out of Tab's reach) unless the visitor is inside a bead: while the store's
 * `inside` is set, `<html data-inside>` shows them, the back button takes the focus, and Escape, a scroll key, the wheel
 * and a swipe also go back out (`leaveInsideOn`). When the inside closes with the focus on a button, the focus goes to
 * <main>, so the keyboard goes on from the page.
 */
export function InsideControls(): JSX.Element {
  const { t } = useTranslator();
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    let stopLeaving: (() => void) | null = null;
    const apply = (inside: ProjectId | null, was: ProjectId | null): void => {
      root.toggleAttribute(INSIDE_ATTRIBUTE, inside !== null);
      if (inside !== null && stopLeaving === null) stopLeaving = leaveInsideOn(window, closeInside);
      if (inside === null && stopLeaving !== null) {
        stopLeaving();
        stopLeaving = null;
      }
      if (inside !== null && was === null) back.current?.focus({ preventScroll: true });
      const controls = back.current?.parentElement;
      if (inside === null && controls?.contains(document.activeElement)) document.getElementById('main')?.focus({ preventScroll: true });
    };
    apply(useScene.getState().inside, null);
    const unsubscribe = useScene.subscribe((state, previous) => {
      if (state.inside !== previous.inside) apply(state.inside, previous.inside);
    });
    return () => {
      unsubscribe();
      stopLeaving?.();
      root.removeAttribute(INSIDE_ATTRIBUTE);
    };
  }, []);
  return (
    <div className="inside-controls">
      <button type="button" className="inside-button inside-back" ref={back} onClick={() => closeInside()}>
        {t.needle.inside.back}
      </button>
      <button type="button" className="inside-button inside-view" onClick={() => viewInside()}>
        {t.needle.inside.view}
      </button>
    </div>
  );
}
