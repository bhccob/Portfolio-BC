import { App } from './core/App';
import { FlapBoard } from './ui/FlapBoard';
import { LoadingScreen } from './ui/LoadingScreen';
import { BlueprintGrid } from './ui/BlueprintGrid';
import { CursorTrail } from './ui/CursorTrail';
import { SiteHeader } from './ui/SiteHeader';
import { ScrollEffects } from './ui/ScrollEffects';
import { AgeUpdater } from './ui/AgeUpdater';
import { HeroPlayground } from './hero/HeroPlayground';
import { ContactForm } from './contact/ContactForm';
import { Terminal } from './fun/Terminal';
import { StationClock } from './fun/StationClock';
import { Konami } from './fun/Konami';

/** Entry point: every feature is a Component; each one checks for its own markup and bows out if absent. */
export function bootstrap(): void {
  const app = new App()
    .use(new FlapBoard())
    .use(new LoadingScreen())
    .use(new BlueprintGrid())
    .use(new HeroPlayground())
    .use(new ScrollEffects())
    .use(new SiteHeader())
    .use(new CursorTrail())
    .use(new AgeUpdater())
    .use(new StationClock())
    .use(new Terminal())
    .use(new Konami())
    .use(new ContactForm());

  app.start();
}
