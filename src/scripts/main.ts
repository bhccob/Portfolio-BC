import { App } from './core/App';
import { FlapBoard } from './ui/FlapBoard';
import { LoadingScreen } from './ui/LoadingScreen';
import { BlueprintGrid } from './ui/BlueprintGrid';
import { HeroMascot } from './ui/HeroMascot';
import { NameReveal } from './hero/NameReveal';
import { CursorTrail } from './ui/CursorTrail';
import { SiteHeader } from './ui/SiteHeader';
import { ScrollEffects } from './ui/ScrollEffects';
import { TiltCards } from './ui/TiltCards';
import { ProjectSwitcher } from './ui/ProjectSwitcher';
import { AgeUpdater } from './ui/AgeUpdater';
import { ContactForm } from './contact/ContactForm';
import { Terminal } from './fun/Terminal';
import { StationClock } from './fun/StationClock';

/** Entry point: every feature is a Component; each one checks for its own markup and bows out if absent. */
export function bootstrap(): void {
  const app = new App()
    .use(new FlapBoard())
    .use(new LoadingScreen())
    .use(new BlueprintGrid())
    .use(new HeroMascot())
    .use(new NameReveal())
    .use(new ScrollEffects())
    .use(new TiltCards())
    .use(new ProjectSwitcher())
    .use(new SiteHeader())
    .use(new CursorTrail())
    .use(new AgeUpdater())
    .use(new StationClock())
    .use(new Terminal())
    .use(new ContactForm());

  app.start();
}
