import { App } from './core/App';
import { AgeUpdater } from './ui/AgeUpdater';
import { CompassLoader, stackPage } from './ui/CompassLoader';

/**
 * Entry point of the redesign's pages (BenchLayout): every feature is a
 * Component that bows out when its markup is absent. It stays small, and
 * imports nothing of three.js, GSAP or Lenis, so the loader draws at once;
 * the live compass (./compass/live) follows as its own chunk.
 */
export function bootstrap(): void {
  // Tells the boot script's failsafe (BenchLayout) that this module runs; the controller or the loader marks the outcome.
  document.documentElement.dataset.bench = 'loading';
  const root = document.documentElement;

  const loader = new CompassLoader();
  void new App().use(new AgeUpdater()).use(loader).start();

  import('./compass/live')
    .then(({ startCompass }) => {
      // Too late: the loader has already left the stacked page.
      if (loader.gaveUp) return;
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
