import { useEffect } from 'react';
import { debugBridge } from '~/debug/needleDebug';
import { landingHoldFor } from '~/scene/bob/landingHold';
import { wakeScene } from '~/scene/motion';
import { HOME_CHAPTERS, qaStop } from '~/state/chapters';
import { frame } from '~/state/frame';
import { useScene } from '~/state/store';
import { skipSwallower } from './loaderSkip';
import { type HomeScroll, type Smooth, startHomeScroll } from './scrollLoop';
import { scrollEnabled } from './target';

let loadingDamp: Promise<Smooth> | null = null;

/** The home page's scroll while it is connected (`connectHomeScroll`), for `goToEnd`; null while none is. */
let connected: HomeScroll | null = null;

/**
 * The nav's link to the end page (`.end-link` in the home's `.home-nav`, src/app/routes/home.tsx), a keyboard's and a
 * screen reader's way there while 3D is on, and the path's skip button's: the story goes to the end page by the End key's
 * own path (`HomeScroll.toEnd`), the step fade from wherever it is, and while the beads load the follow to the landing
 * hold, then the fade on to the end once they are ready. Answers whether the home's scroll took it: false while none is
 * connected, or while it takes no input (3D off, a phase off the scroll, a skipped loader's tail).
 */
export function goToEnd(): boolean {
  return connected?.toEnd() ?? false;
}

/**
 * Whether the story is headed for the end page now (`HomeScroll.headedToEnd`): what the focus watch after the nav's link
 * (src/ui/endArrival.ts) asks while it waits, so a turn back ends it. False while no home scroll is connected.
 */
export function headedToEnd(): boolean {
  return connected?.headedToEnd() ?? false;
}

/**
 * The header's name clicked on the home page (src/ui/SiteHeader.tsx `nameToTop`): the story goes to its start by the
 * Home key's own path (`HomeScroll.toTop`), the page back at its top first: by the step fade from the path, the sheet
 * and the end page, back up by the follow from the light dive. Answers whether the home's scroll took it: false while none is connected, or while it
 * takes no input (3D off, a bead opening), where the link is left to navigate as any link does.
 */
export function goToTop(): boolean {
  return connected?.toTop() ?? false;
}

/**
 * A place on the home's story asked for by the page (the hologram world's dots, src/ui/AreaDots.tsx): the story goes
 * there by a key's glide (`HomeScroll.toPlace`). Answers whether the home's scroll took it: false while none is connected
 * or while it takes no input.
 */
export function goToPlace(place: number): boolean {
  return connected?.toPlace(place) ?? false;
}

/**
 * A mark on the Q&A's gold ring asked for (its button, src/ui/QaRing.tsx; spec 2026-10-29-bob-stack-2-design.md, goal 1):
 * the ring turns to mark `k` (0 the first question, the last the end's), from elsewhere on the ring by a turn, else by a
 * key's glide (`HomeScroll.toPlace`). Answers whether the home's scroll took it.
 */
export function goToQa(k: number): boolean {
  return goToPlace(qaStop(HOME_CHAPTERS, k));
}

/**
 * The path's skip button ("Snel naar vragen ↓", src/ui/SkipButton.tsx): the story goes to the Q&A's first question by the
 * step fade (`HomeScroll.fadeToPlace`). Answers whether the home's scroll took it.
 */
export function goToQuestions(): boolean {
  return connected?.fadeToPlace(qaStop(HOME_CHAPTERS, 0)) ?? false;
}

/** Whether the story is headed for the Q&A's first question now (`HomeScroll.headedTo`): the skip's watch asks it. */
export function headedToQuestions(): boolean {
  return connected?.headedTo(qaStop(HOME_CHAPTERS, 0)) ?? false;
}

/** The Q&A's ring turned by hand, `units` of the scroll (src/input/ringDrag.ts; `HomeScroll.dragRing`). */
export function dragRing(units: number): void {
  connected?.dragRing(units);
}

/** The hand has let go of the ring: it turns on to the nearest question (`HomeScroll.releaseRing`). */
export function releaseRing(): void {
  connected?.releaseRing();
}

/**
 * maath's `damp`, loaded on the first input rather than with the page. `maath/easing` imports three.js, which
 * the scene keeps out of the page's first load (it is its own chunk, fetched after hydration): a static import
 * here would put all of three.core in front of hydration on every page. Loaded this way it shares that chunk
 * with the scene.
 */
function loadDamp(): Promise<Smooth> {
  loadingDamp ??= import('maath/easing').then(
    (easing) => easing.damp,
    (error: unknown) => {
      loadingDamp = null; // the next mount tries again
      throw error;
    },
  );
  return loadingDamp;
}

/** What `connectHomeScroll` is given of the page: the element it listens on, the unit and the frames. */
export interface HomeScrollPage {
  el: HTMLElement;
  /** Pixels in one unit of scroll: the viewport's height. */
  unitPx: () => number;
  /** requestAnimationFrame and cancelAnimationFrame (the proof bridge's, behind `?proof`). */
  request: (callback: (now: number) => void) => number;
  cancel: (id: number) => void;
  /** Fetches maath's `damp`; `loadDamp` by default. */
  loadSmooth?: () => Promise<Smooth>;
  /** The clock of the Q&A's lock, ms; `performance.now` by default. */
  now?: () => number;
}

/**
 * The home page's scroll (`startHomeScroll`) on `page.el`, wired to the store and to `frame`: what `useHomeScroll` runs
 * while the home page is shown, apart from React so a test runs the very wiring. Answers its taking down.
 *
 * It takes events only while `scrollEnabled` (3D on, the scroll's phases), read live from the store at each event:
 * with 3D off the page scrolls natively and nothing here prevents anything. A failed void's end page at rest (`<html
 * data-end="rest">`, which Home writes) scrolls natively too: there `startHomeScroll` leaves the browser every gesture
 * down and every gesture up while the page is scrolled, each gesture to its end; Home goes to the story's start, the page
 * back at its top first. With the world there the end of the story is the ring's, which never scrolls the page.
 *
 * While a skipped loader's input is still arriving (`skipSwallower`, from `frame.loaderSkipEndsMs`: the fast-forward
 * and `SKIP_SWALLOW_MS` after the landing, then on while the input keeps coming without SKIP_QUIET_MS of quiet, for
 * SKIP_SWALLOW_CAP_MS after the landing at most) the input drops what it hears but still prevents it, so the tail of
 * the wheel or the swipe that skipped neither moves the story nor scrolls the page. It is the input that does this, not
 * `enabled`, because an event `enabled` turns away is left to the browser, and the browser would scroll with it. That is
 * just what a project's own page wants (the store's `inside`, src/ui/ProjectView.tsx): while one is open the input takes
 * nothing, and the page, which scrolls on its own, has the wheel, the keys and a swipe.
 *
 * A requestAnimationFrame loop (not R3F's `useFrame`: the canvas renders on demand) moves `frame.progress`
 * toward `frame.target` (on the rise by M2a's damp, past it by the follow, the sheet's finish and the keys' glides) and
 * sleeps when it arrives and nothing glides; an input wakes it. It dispatches
 * `CHAPTER` when `progress` crosses into another chapter, and keeps `frame.chapterIndex` in step with
 * `chapterAt` (the route sync reads it when a visitor comes back to `/`). Each frame it asks for also wakes the
 * canvas (`wakeScene`), so the scene draws the frames in which the story moves.
 *
 * The beads under the glass hold it (`landingHoldFor` of the store's `voidState`, src/scene/bob/landingHold.ts): until
 * they are ready, the target goes no further than the landing hold, the hand-over just before the first project. When the void's
 * state changes the input is told (`holdChanged`), so a story held there goes on once the beads are ready. With 3D off
 * the void goes with the Stage and nothing holds the visitor's place back; 3D back on (`resume`) holds a story past the
 * hold until the void is ready again, and then takes it back where it was. With the void failed the hold stands, the
 * keys step only among `stopsFor`'s stops, and the end page, past the hold, is reached by a key's step, End or the
 * page's link (`goToEnd`) and left by the step fade (`startHomeScroll`, "A failed void").
 */
export function connectHomeScroll(page: HomeScrollPage): () => void {
  const skipTail = skipSwallower(
    () => performance.now(),
    () => frame.loaderSkipEndsMs,
  );
  const home = startHomeScroll({
    el: page.el,
    frame,
    chapters: HOME_CHAPTERS,
    unitPx: page.unitPx,
    // Live from the store, never a value captured at render: during hydration the hook's `threeD` is the default.
    // A project's own page open: its scroll is the page's (src/ui/ProjectView.tsx).
    enabled: () => scrollEnabled(useScene.getState()) && useScene.getState().inside === null,
    swallow: () => skipTail(),
    reducedMotion: () => useScene.getState().reducedMotion,
    threeD: () => useScene.getState().threeD,
    hold: () => landingHoldFor(useScene.getState().voidState),
    holdWaits: () => useScene.getState().voidState !== 'failed',
    voidState: () => useScene.getState().voidState,
    onChapter: (at) => useScene.getState().dispatch({ type: 'CHAPTER', chapter: at.id, category: at.category }),
    loadSmooth: page.loadSmooth ?? loadDamp,
    ...(page.now ? { now: page.now } : {}),
    request: (callback) => {
      wakeScene();
      return page.request(callback);
    },
    cancel: page.cancel,
  });

  // 3D switched back on: the story is held if it is past the hold, and its move is finished. The void's state moves the hold.
  const unsubscribe = useScene.subscribe((state, previous) => {
    if (!state.threeD && previous.threeD) home.suspend();
    if (state.threeD && !previous.threeD) home.resume();
    if (state.voidState !== previous.voidState) home.holdChanged();
  });
  connected = home;

  return () => {
    if (connected === home) connected = null;
    unsubscribe();
    home.dispose();
  };
}

/**
 * Drives the home page's story from the wheel, touch and keys, while `onHome` is true: `connectHomeScroll` on the
 * document element, for as long as the home page is shown (the page covers the canvas, so the canvas hears nothing).
 */
export function useHomeScroll(onHome: boolean): void {
  useEffect(() => {
    if (!onHome) return;

    // Behind `?proof` there is a debug bridge, and the loop's frames are asked for through it so the harness can count them
    // apart from the canvas's. Looked up here, once, and never again: without a bridge a frame costs no read of anything.
    const bridge = debugBridge();
    const request = bridge ? (callback: FrameRequestCallback) => bridge.scrollRequest(callback) : (callback: FrameRequestCallback) => requestAnimationFrame(callback);

    return connectHomeScroll({
      el: document.documentElement,
      unitPx: () => Math.max(window.innerHeight, 1),
      request,
      cancel: (id) => cancelAnimationFrame(id),
    });
  }, [onHome]);
}
