import { App } from '../core/App';
import { CompassStageController, type CompassStageOptions } from './CompassStageController';

/**
 * The live compass, the chunk the entry (compass-main) loads on its own:
 * three.js, GSAP, Lenis, the scene and the stage controller. Starts the
 * controller, with the loader's hand-over when the loader is showing, and
 * answers it. Its mount runs before this returns (App mounts at once), so the
 * root is marked `data-bench` by then, unless the page has no stage.
 */
export function startCompass(handOver?: CompassStageOptions['handOver']): CompassStageController {
  const controller = new CompassStageController({ handOver });
  void new App().use(controller).start();
  return controller;
}
