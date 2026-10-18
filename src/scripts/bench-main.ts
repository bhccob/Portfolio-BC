import { App } from './core/App';
import { DeviceStageController } from './bench/DeviceStageController';

/** Entry point of the redesign's pages (BenchLayout): every feature is a Component that bows out when its markup is absent. */
export function bootstrap(): void {
  const app = new App().use(new DeviceStageController());

  app.start();
}
