import type { Locale } from '../i18n/Translator';
import { categories, type Category, type CategoryId } from './categories';
import { PAGES, type PageId } from './pages';

// Screenshots live in src/assets. A project names its file once; that name
// gives the built image URL. Only under Vite (and Vitest), which rewrites the
// glob: plain Node has neither, and the proof harness (tools/proof/needle.mjs)
// reads the chapters, built from these projects, through tsx.
const screenshots: Record<string, string> = import.meta.env
  ? import.meta.glob<string>('../assets/*.{png,jpg,jpeg,webp}', { query: '?url', import: 'default', eager: true })
  : {};

export type ProjectId = 'funcial' | 'jontai-energy' | 'cookies-clicker';

/** A pin on the project's object: the layer of the build it marks. The position is a placeholder in the object's local frame (units of about the object's radius), tuned in M5. */
export interface TestPoint {
  id: string;
  /** A technical label, translated like the rest of the HUD. */
  label: Record<Locale, string>;
  position: readonly [number, number, number];
}

export interface ProjectCopy {
  /** Kind of work and context, e.g. "Web game · School project". */
  type: string;
  role: string;
  /** One line about the project, for the page and the Lite list. */
  summary: string;
  metaDescription: string;
  /** The longer case-study text; a project without it shows only the summary. */
  overview?: string;
  build?: string;
  focus?: string;
  imageAlt?: string;
}

export interface ProjectData {
  id: ProjectId;
  title: string;
  year: number;
  categoryId: CategoryId;
  /** Position among the projects: the order of the void and of every list. */
  order: number;
  /** What stands in the void; `fallbackGeometry` is built in three.js until a rendered plate or mesh replaces it. */
  object: { glb?: string; plate?: string; video?: string; fallbackGeometry: string };
  testPoints: TestPoint[];
  palette: { accent: string; glow: string };
  /** How the object moves, in words: the brief for the animation. */
  motion: string;
  stack: string[];
  links: { live?: string; repo?: string };
  /** Screenshot file name in src/assets, e.g. "cookies.png"; a project without one has none. */
  image?: string;
  /**
   * On the light's way through the projects (`ProjectCatalog.onPath`): read only once there are more than `PATH_LIMIT`
   * projects, where the way takes the flagged ones. Up to the limit every project is on it.
   */
  onPath?: boolean;
  copy: Record<Locale, ProjectCopy>;
}

/** The most projects the light's way visits (spec 2026-10-27-bob-light-path-design.md, goal 6: Way 2). */
export const PATH_LIMIT = 5;

export class Project {
  constructor(private readonly data: ProjectData) {}

  get id() { return this.data.id; }
  get title() { return this.data.title; }
  get year() { return this.data.year; }
  get order() { return this.data.order; }
  get categoryId() { return this.data.categoryId; }
  get object() { return this.data.object; }
  get testPoints() { return this.data.testPoints; }
  get palette() { return this.data.palette; }
  get motion() { return this.data.motion; }
  get stack() { return this.data.stack; }
  get links() { return this.data.links; }
  get onPath() { return this.data.onPath === true; }

  /** The built URL of the screenshot, if the project has one. */
  get image(): string | undefined {
    if (!this.data.image) return undefined;
    const url = screenshots[`../assets/${this.data.image}`];
    if (!url) throw new Error(`Missing screenshot src/assets/${this.data.image} for ${this.data.id}`);
    return url;
  }

  get category(): Category {
    return categories.byId(this.data.categoryId);
  }

  testPointLabels(locale: Locale): string[] {
    return this.data.testPoints.map((point) => point.label[locale]);
  }

  copy(locale: Locale): ProjectCopy {
    return this.data.copy[locale];
  }
}

export class ProjectCatalog {
  private readonly items: Project[];

  constructor(data: ProjectData[]) {
    this.items = data.map((entry) => new Project(entry)).sort((a, b) => a.order - b.order);
  }

  all(): Project[] {
    return [...this.items];
  }

  /**
   * The projects the light's way visits, in order: every project while there are `PATH_LIMIT` or fewer, else the ones
   * flagged `onPath`, of which there must be at least one and at most `PATH_LIMIT`.
   */
  onPath(): Project[] {
    if (this.items.length <= PATH_LIMIT) return [...this.items];
    const flagged = this.items.filter((project) => project.onPath);
    if (flagged.length === 0 || flagged.length > PATH_LIMIT) {
      throw new TypeError(`past ${PATH_LIMIT} projects the way takes the flagged ones: at most ${PATH_LIMIT}, at least 1`);
    }
    return flagged;
  }

  /** The projects the light's way does not visit, in order: small lights beside its trail in the look back. */
  offPath(): Project[] {
    const on = new Set(this.onPath());
    return this.items.filter((project) => !on.has(project));
  }

  byId(id: string): Project | undefined {
    return this.items.find((project) => project.id === id);
  }

  /**
   * The project whose page a route is (`/projects/funcial/`), or undefined for any other route,
   * which includes a real page under another spelling (`/Projects/Funcial/`): the page lives at one URL.
   */
  byRoute(route: string): Project | undefined {
    return this.items.find((project) => this.route(project) === route);
  }

  /** The locale-neutral route of a project's page (see `PAGES`). */
  route(project: Project): string {
    // Typed as a PageId: a project without a page in PAGES does not compile.
    const page: PageId = `project-${project.id}`;
    return PAGES[page];
  }
}

/**
 * The three projects, in the order of the void. The object, test points, palette,
 * motion and links are the ones Bob approved on 2026-10-20 (docs/projects-discovery.md);
 * the words are in each project's `copy`.
 */
export const projects = new ProjectCatalog([
  {
    id: 'funcial',
    title: 'Funcial',
    year: 2026,
    categoryId: 'secure-element',
    order: 1,
    object: { fallbackGeometry: 'platter-track+abacus+phone' },
    testPoints: [
      { id: 'tp1', label: { en: 'LOG', nl: 'LOG' }, position: [-0.62, 0.02, 0.48] },
      { id: 'tp2', label: { en: 'GAME LAYER', nl: 'SPELLAAG' }, position: [-0.31, 0.02, 0.71] },
      { id: 'tp3', label: { en: 'MONEY RULES', nl: 'GELDREGELS' }, position: [0.05, 0.02, 0.78] },
      { id: 'tp4', label: { en: 'VAULT', nl: 'KLUIS' }, position: [0.4, 0.02, 0.66] },
      // The buy-meter verdict (Bob, 2026-10-20).
      { id: 'result', label: { en: 'RESULT', nl: 'UITKOMST' }, position: [0.7, 0.02, 0.38] }
    ],
    // The glow is the art direction's track gold (--gold-glow).
    palette: { accent: '#7c5cff', glow: '#efb53d' },
    motion: 'slow platter spin + track pulse TP1→TP4; abacus beads slide up one by one on focus',
    stack: ['React 19', 'TypeScript', 'Tailwind CSS v4', 'Zustand', 'Capacitor', 'SQLCipher', 'Web Crypto', 'Vercel Functions'],
    links: { live: 'https://funcial.vercel.app/get', repo: 'https://github.com/bhccob/Funcial' },
    copy: {
      en: {
        type: 'Android app · Personal project',
        role: 'Sole developer',
        // docs/art-direction.md § Projects, "Focus: one line (Funcial)".
        summary: 'A finance tracker with game elements, local-first and encrypted on your phone.',
        // The line of the first drafts of the drive's tracks (src/data/tracks.ts, merged into this file).
        metaDescription:
          'A gamified personal-finance app for Android: log a spend in seconds, level up, and keep your money data encrypted on your phone.'
      },
      nl: {
        type: 'Android-app · Eigen project',
        role: 'Enige ontwikkelaar',
        summary: 'Een financiële tracker met spelelementen, lokaal en versleuteld op je telefoon.',
        metaDescription:
          'Een gamified app voor persoonlijke financiën op Android: leg een uitgave in seconden vast, stijg in level en houd je financiële gegevens versleuteld op je telefoon.'
      }
    }
  },
  {
    id: 'jontai-energy',
    title: 'Jontai Energy',
    year: 2026,
    categoryId: 'front-panel',
    order: 2,
    object: { fallbackGeometry: 'pv-module-4x4+junction-box' },
    testPoints: [
      { id: 'tp1', label: { en: '16 PAGES', nl: '16 PAGINA’S' }, position: [-0.45, 0.03, -0.2] },
      { id: 'tp2', label: { en: 'DESIGN SYSTEM', nl: 'DESIGNSYSTEEM' }, position: [0.0, 0.03, 0.05] },
      { id: 'tp3', label: { en: 'THREE LANGUAGES', nl: 'DRIE TALEN' }, position: [0.62, 0.06, 0.55] },
      { id: 'tp4', label: { en: 'QUOTE PATH', nl: 'OFFERTEPAD' }, position: [0.95, 0.0, 0.8] }
    ],
    palette: { accent: '#00a650', glow: '#00d16a' },
    motion: 'sun sweep: a light arc crosses the module, cells charge in page order; single-axis tracker tilt',
    stack: ['HTML', 'Tailwind CSS v4', 'JavaScript', 'PowerShell'],
    // No live link: jontaienergy.com is not Bob's build.
    links: { repo: 'https://github.com/bhccob/JE' },
    image: 'jontai-energy.png',
    copy: {
      en: {
        type: 'Company website · Personal project',
        role: 'Design & front-end development',
        summary:
          'A multi-page website for a solar-energy company, built as a personal project: it introduces the business, guides visitors through its services and makes requesting a quote effortless.',
        overview:
          'Jontai Energy presents sustainable energy in a direct, approachable way. The site spans more than fifteen pages, from services, inventory and location to a quote request, FAQ, news and the legal pages a real business needs.',
        build:
          'Built with HTML, Tailwind CSS and JavaScript, with a focus on responsive layouts, clear navigation and a clean visual identity for a modern energy brand. The site is available in English, Spanish and Chinese, with small PowerShell scripts automating the translation markup across pages.',
        focus:
          'Structure and consistency: keeping visitors oriented across a large site, holding one design system together on every page, and making the most important action, requesting a quote, easy to find.',
        imageAlt: 'Jontai Energy homepage with the headline “Power Your Future” over a field of solar panels',
        metaDescription:
          'Jontai Energy, a multi-page solar-energy company website Bob Chung built as a personal project with HTML, Tailwind CSS and JavaScript, in three languages.'
      },
      nl: {
        type: 'Bedrijfswebsite · Eigen project',
        role: 'Ontwerp & front-end-ontwikkeling',
        summary:
          'Een website met meerdere pagina’s voor een zonne-energiebedrijf, gebouwd als eigen project: de site stelt het bedrijf voor, leidt bezoekers door de diensten en maakt een offerte aanvragen moeiteloos.',
        overview:
          'Jontai Energy presenteert duurzame energie op een directe, toegankelijke manier. De site telt meer dan vijftien pagina’s, van diensten, voorraad en locatie tot een offerteaanvraag, FAQ, nieuws en de juridische pagina’s die een echt bedrijf nodig heeft.',
        build:
          'Gebouwd met HTML, Tailwind CSS en JavaScript, met de focus op responsieve layouts, duidelijke navigatie en een strakke visuele identiteit voor een modern energiemerk. De site is beschikbaar in het Engels, Spaans en Chinees, waarbij kleine PowerShell-scripts de vertaalmarkup over alle pagina’s automatiseren.',
        focus:
          'Structuur en consistentie: bezoekers op een grote site laten weten waar ze zijn, één designsysteem op elke pagina vasthouden, en de belangrijkste actie, een offerte aanvragen, makkelijk vindbaar maken.',
        imageAlt: 'Homepagina van Jontai Energy met de kop “Power Your Future” boven een veld met zonnepanelen',
        metaDescription:
          'Jontai Energy, een bedrijfswebsite voor zonne-energie met meerdere pagina’s, die Bob Chung als eigen project bouwde met HTML, Tailwind CSS en JavaScript, in drie talen.'
      }
    }
  },
  {
    id: 'cookies-clicker',
    title: 'Cookies Clicker',
    year: 2025,
    categoryId: 'oscillator',
    order: 3,
    object: { fallbackGeometry: 'clockwork-movement-8-wheels' },
    testPoints: [
      { id: 'tp1', label: { en: 'CLICK LOOP', nl: 'KLIKLUS' }, position: [0.92, 0.0, 0.0] },
      { id: 'tp2', label: { en: '8 PRODUCERS', nl: '8 PRODUCENTEN' }, position: [-0.2, 0.08, 0.3] },
      { id: 'tp3', label: { en: 'BOOSTS & EVENTS', nl: 'BOOSTS & EVENTS' }, position: [0.35, 0.1, -0.45] },
      { id: 'tp4', label: { en: 'SAVE', nl: 'OPSLAG' }, position: [-0.55, 0.06, -0.35] },
      { id: 'tp5', label: { en: 'STATS', nl: 'STATISTIEKEN' }, position: [0.0, 0.14, 0.0] }
    ],
    // The glow, ember orange, is provisional: it has not been checked against the art direction's palette yet.
    palette: { accent: '#c69255', glow: '#ff8a3d' },
    motion: 'discrete 1 Hz escapement tick, gear train steps per beat; beat doubles briefly on boost',
    stack: ['HTML', 'CSS', 'JavaScript', 'Bootstrap 5', 'localStorage'],
    links: { repo: 'https://github.com/bhccob/Cookies-Clicker' },
    image: 'cookies.png',
    copy: {
      en: {
        // Made for the school subject Web Game Development, together with a classmate (never named).
        type: 'School project · Web Game Development',
        // Bob's own part in it is not known yet, so the role says only that he made it with a classmate.
        role: 'With a classmate',
        summary:
          'A browser-based incremental game, built as a school project around one satisfying loop: click, earn cookies, reinvest in upgrades and watch production compound.',
        overview:
          'Cookies Clicker turns a single action into a progression system. Players bake cookies by clicking, then spend them on producers, from grandmas and suppliers to pastry chefs, bakeries and beyond, that keep baking automatically and build momentum over time.',
        build:
          'Written in HTML, CSS and JavaScript, with Bootstrap 5. Producers share a reusable AutoClicker class, timed boosts and random bonus events keep the loop lively, and progress is saved in the browser with localStorage so players can pick up where they left off.',
        focus:
          'Game feel and economy balancing: making every click, purchase and boost give clear feedback, and pacing upgrade costs so progress stays rewarding without becoming trivial.',
        imageAlt: 'Cookies Clicker interface with the cookie counter, the store of producers and the boosts panel',
        metaDescription:
          'Cookies Clicker, a browser-based incremental game Bob Chung built as a school project with HTML, CSS and JavaScript: producers, boosts and saved progress.'
      },
      nl: {
        type: 'Schoolproject · Web Game Development',
        role: 'Samen met een klasgenoot',
        summary:
          'Een incrementele browsergame, gebouwd als schoolproject rond één bevredigende loop: klik, verdien koekjes, investeer in upgrades en zie de productie groeien.',
        overview:
          'Cookies Clicker maakt van één simpele actie een voortgangssysteem. Spelers bakken koekjes door te klikken en besteden ze aan producenten, van oma’s en leveranciers tot banketbakkers, bakkerijen en verder, die automatisch doorbakken en zo momentum opbouwen.',
        build:
          'Geschreven in HTML, CSS en JavaScript, met Bootstrap 5. Producenten delen een herbruikbare AutoClicker-klasse, tijdelijke boosts en willekeurige bonussen houden de loop levendig, en de voortgang wordt in de browser opgeslagen met localStorage zodat spelers verder kunnen waar ze gebleven waren.',
        focus:
          'Gamefeel en economiebalans: elke klik, aankoop en boost duidelijke feedback geven, en upgradeprijzen zo afstemmen dat voortgang lonend blijft zonder te makkelijk te worden.',
        imageAlt: 'Interface van Cookies Clicker met de koekjesteller, de winkel met producenten en het boostpaneel',
        metaDescription:
          'Cookies Clicker, een incrementele browsergame die Bob Chung als schoolproject bouwde met HTML, CSS en JavaScript: producenten, boosts en opgeslagen voortgang.'
      }
    }
  }
]);
