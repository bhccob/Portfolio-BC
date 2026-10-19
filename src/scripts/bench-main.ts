import { App } from './core/App';
import { HubStageController } from './bench/HubStageController';

/** Entry point of the redesign's pages (BenchLayout): every feature is a Component that bows out when its markup is absent. */
export function bootstrap(): void {
  const app = new App().use(new HubStageController());

  app.start();
}
