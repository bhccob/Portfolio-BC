import { App } from './core/App';
import { AgeUpdater } from './ui/AgeUpdater';
import { CompassStageController } from './compass/CompassStageController';

/** Entry point of the redesign's pages (BenchLayout): every feature is a Component that bows out when its markup is absent. */
export function bootstrap(): void {
  const app = new App().use(new AgeUpdater()).use(new CompassStageController());

  app.start();
}
