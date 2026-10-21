import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Locale } from '~/i18n/Translator';
import { wakeScene } from '~/scene/motion';
import { chapterAt, HOME_CHAPTERS } from '~/state/chapters';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { installNeedleDebug, type NeedleDebugState } from './needleDebug';
import { canvasMounts, readStageProbe } from './stageReport';

/** What only the Shell knows: the page the router shows and its language. */
export interface ShellView {
  route: string;
  locale: Locale;
}

/**
 * The whole debug state, read now: the store's discrete state, the per-frame values (`frame`), the chapter they are
 * in (read as the scroll loop reads it, with its hysteresis), what the Stage reports, and the Shell's view. Plain
 * reads: nothing here subscribes to anything, writes anything or runs unless the bridge is called.
 */
export function readNeedleDebugState(view: ShellView): NeedleDebugState {
  const { phase, tier, threeD } = useScene.getState();
  const at = chapterAt(HOME_CHAPTERS, frame.progress, { index: frame.chapterIndex });
  const { dpr, fps, camera, constellations } = readStageProbe();
  const { stage, elapsed, pins } = frame.loader;
  return {
    phase,
    progress: frame.progress,
    target: frame.target,
    velocity: frame.velocity,
    chapter: { index: at.index, id: at.id, local: at.local, category: at.category },
    route: view.route,
    locale: view.locale,
    tier,
    dpr,
    fps,
    camera,
    canvasMounts: canvasMounts(),
    contextLost: frame.contextLost,
    threeD,
    loader: { stage, elapsed, pins },
    pointed: frame.pointed,
    constellations,
  };
}

/**
 * Holds the opening's clock at `seconds` (the bridge's `seekLoader`, Ruling 2), or lets it go: a negative time (-1)
 * or one that is not a finite number goes back to the live clock. The Opening reads the hold on every frame it draws
 * (`frame.loaderHold`), so the scene is woken to draw the held moment, or the live one again.
 */
export function holdLoader(seconds: number): void {
  frame.loaderHold = Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  wakeScene();
}

/**
 * Puts the story at `progress` at once, as a jump would: progress and target there (clamped to the story), nothing
 * moving, the chapter in step and the phase following it (only a phase the scroll moves through takes the chapter).
 * The scene is woken so the canvas draws it.
 */
export function setStoryProgress(progress: number): void {
  const place = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), HOME_CHAPTERS.total) : 0;
  const at = chapterAt(HOME_CHAPTERS, place);
  frame.progress = place;
  frame.target = place;
  frame.velocity = 0;
  frame.chapterIndex = at.index;
  useScene.getState().dispatch({ type: 'CHAPTER', chapter: at.id, category: at.category });
  wakeScene();
}

/**
 * Installs `window.__needleDebug` for the Shell, when the page's first URL has `?proof` (`installNeedleDebug`).
 *
 * Call it before `useHomeScroll`: the scroll loop asks for the bridge when it mounts, and effects run in the order
 * they are declared. The route and language are kept in a ref in a layout effect, so a read after any commit that
 * showed a page already says that page.
 */
export function useNeedleDebug(route: string, locale: Locale): void {
  const view = useRef<ShellView>({ route, locale });
  useLayoutEffect(() => {
    view.current = { route, locale };
  }, [route, locale]);

  useEffect(
    () =>
      installNeedleDebug(window.location.search, () => readNeedleDebugState(view.current), {
        set: ({ progress }) => setStoryProgress(progress),
        dispatch: (event) => useScene.getState().dispatch(event),
        seekLoader: (seconds) => holdLoader(seconds),
      }),
    [],
  );
}
