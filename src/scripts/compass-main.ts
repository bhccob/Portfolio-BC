import { App } from './core/App';
import { settlesWithin } from './core/deadline';
import { AgeUpdater } from './ui/AgeUpdater';
import { CompassLoader, stackPage } from './ui/CompassLoader';
import { LOADING } from './compass/loading';

/**
 * Entry point of the redesign's pages (BenchLayout): every feature is a
 * Component that bows out when its markup is absent. It stays small, and
 * imports nothing of three.js, GSAP or Lenis, so the loader draws at once;
 * the live compass (./compass/live) follows as its own chunk. Ten seconds
 * (LOADING.giveUp) without it and the page is stacked: the loader's own
 * give-up on a first visit, this module's on a later one.
 */
export function bootstrap(): void {
  // Tells the boot script's failsafe (BenchLayout) that this module runs; the controller or the loader marks the outcome.
  document.documentElement.dataset.bench = 'loading';
  const root = document.documentElement;

  const loader = new CompassLoader();
  void new App().use(new AgeUpdater()).use(loader).start();

  const live = import('./compass/live');
  if (!loader.showing) {
    // No loader (a later visit, or none wanted): nothing else gives up on a chunk that is slow to come, and the
    // boot script's failsafe is already satisfied, so a stalled chunk would leave the stage black for good.
    void settlesWithin(live, LOADING.giveUp * 1000).then((inTime) => {
      if (inTime || root.dataset.bench !== 'loading') return;
      console.warn(`[portfolio] the compass did not load within ${LOADING.giveUp} s; showing the stacked page`);
      stackPage();
    });
  }

  live
    .then(({ startCompass }) => {
      // Too late: the loader, or the wait above, has already left the stacked page.
      if (loader.gaveUp || root.dataset.bench === 'fallback') return;
      loader.loaded('scene', 1);
      startCompass(loader.showing ? loader.handOver : undefined);
      // A controller that did not start (no WebGL, an error) handed the loader nothing to wait for.
      if (loader.showing && !loader.handed) loader.giveUp();
      // One that never marked the root (it found no stage) leaves the page stacked rather than pinned and empty.
      if (root.dataset.bench === 'loading') stackPage();
    })
    .catch((error: unknown) => {
      console.warn('[portfolio] the compass could not load; showing the stacked page', error);
      loader.giveUp();
    });
}
