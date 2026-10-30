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

// The pictures on a project's own page over the stack (spec 2026-10-29-bob-stack-2-design.md, goal 2), in
// src/assets/projects, made by tools/pictures.mjs from each project's own code. Under Vite alone, as the screenshots.
const pictureFiles: Record<string, string> = import.meta.env
  ? import.meta.glob<string>('../assets/projects/*.webp', { query: '?url', import: 'default', eager: true })
  : {};

/** A picture on a project's own page: its file in src/assets/projects, and what it shows in words. */
export interface Picture {
  file: string;
  alt: Record<Locale, string>;
}

export type ProjectId = 'steady' | 'portle' | 'jontai-energy' | 'cookies-clicker';

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
   * The pictures on its own page over the stack, in the order they stand (an app's screens left to right, the middle
   * one forward), with how they stand (`phones`, or one `wide` card) and the one line under them. None for a project
   * with no pictures yet: its page goes from its words to the next project.
   */
  pictures?: Picture[];
  pictureKind?: 'phones' | 'wide';
  pictureCaption?: Record<Locale, string>;
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
  get pictures(): readonly Picture[] { return this.data.pictures ?? []; }
  get pictureKind(): 'phones' | 'wide' | null { return this.data.pictures?.length ? (this.data.pictureKind ?? 'wide') : null; }

  /** The one line under its pictures, or '' with none. */
  pictureCaption(locale: Locale): string {
    return this.data.pictureCaption?.[locale] ?? '';
  }

  /** The built URL of one of its pictures; null under plain Node, which has no glob (as the screenshots). */
  pictureUrl(file: string): string | null {
    if (!import.meta.env) return null;
    const url = pictureFiles[`../assets/projects/${file}`];
    if (!url) throw new Error(`Missing picture src/assets/projects/${file} for ${this.data.id}`);
    return url;
  }

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
   * The project whose page a route is (`/projects/steady/`), or undefined for any other route,
   * which includes a real page under another spelling (`/Projects/Steady/`): the page lives at one URL.
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
 * The four projects, in the order of the stack: Steady and Portle (apps), Jontai Energy (a website), Cookies Clicker
 * (game development). Jontai Energy's and Cookies Clicker's objects, palettes, motion and links are the ones Bob
 * approved on 2026-10-20 (docs/projects-discovery.md); Steady's and Portle's come from their own README and product spec
 * (Bob, 2026-10-28, who took Funcial off the site; Porfael renamed Portle, 2026-10-29); Jontai Energy's words, tools,
 * test points and picture from its concept redesign's own notes (Bob, 2026-10-30); the words are in each project's
 * `copy`.
 */
export const projects = new ProjectCatalog([
  {
    id: 'steady',
    title: 'Steady',
    year: 2026,
    categoryId: 'app',
    order: 1,
    object: { fallbackGeometry: 'streak-path-7-blocks+trophy' },
    // Its README's own list (github.com/bhccob/steady), in that order.
    testPoints: [
      { id: 'reminders', label: { en: 'REMINDERS', nl: 'HERINNERINGEN' }, position: [-0.4, 0.1, 0] },
      { id: 'streak', label: { en: 'STREAK PATH', nl: 'STREAKPAD' }, position: [-0.16, 0.16, -0.14] },
      { id: 'insights', label: { en: 'INSIGHTS', nl: 'INZICHTEN' }, position: [0.08, 0.21, -0.28] },
      { id: 'support', label: { en: 'SUPPORT LEVELS', nl: 'STEUNNIVEAUS' }, position: [0.32, 0.27, -0.42] },
      { id: 'privacy', label: { en: 'PRIVACY', nl: 'PRIVACY' }, position: [0.46, 0.3, -0.49] }
    ],
    // Its logo kit's Mark Bronze and Steady Beige.
    palette: { accent: '#7f6440', glow: '#e8d5b5' },
    motion: "the streak path's blocks mark one after another, as days do; the trophy at the week's end lights",
    stack: ['Expo (SDK 58)', 'React Native', 'TypeScript', 'SQLite'],
    links: { repo: 'https://github.com/bhccob/steady' },
    // Run from a copy of its last commit on the web, with stand-in details only (the app's own example name, one reminder).
    pictures: [
      { file: 'steady-welcome.webp', alt: { nl: 'Steady: het welkomstscherm', en: 'Steady: the welcome screen' } },
      { file: 'steady-home.webp', alt: { nl: 'Steady: het beginscherm met de streak', en: 'Steady: the home screen with the streak' } },
      { file: 'steady-reminders.webp', alt: { nl: 'Steady: zachte herinneringen', en: 'Steady: gentle reminders' } }
    ],
    pictureKind: 'phones',
    pictureCaption: {
      nl: 'Steady op Android: het welkomstscherm, het beginscherm en de zachte herinneringen',
      en: 'Steady on Android: the welcome screen, the home screen and the gentle reminders'
    },
    copy: {
      en: {
        type: 'Android app · Personal project',
        role: 'Sole developer',
        // Its README's first line.
        summary: 'A calm, private medication reminder for people working through hard things.',
        metaDescription:
          'Steady: a calm, private medication reminder for Android, with gentle reminders, a streak path, and everything kept on your phone.'
      },
      nl: {
        type: 'Android-app · Eigen project',
        role: 'Enige ontwikkelaar',
        summary: 'Een rustige, privé medicatieherinnering voor mensen die door moeilijke dingen gaan.',
        metaDescription:
          'Steady: een rustige, privé medicatieherinnering voor Android, met zachte herinneringen, een streakpad en alles op je telefoon.'
      }
    }
  },
  {
    id: 'portle',
    title: 'Portle',
    year: 2026,
    categoryId: 'app',
    order: 2,
    object: { fallbackGeometry: 'allocation-ring-5+relic' },
    // Its product spec's features (Porfael.md, before it was renamed Portle; Bob, 2026-10-28).
    testPoints: [
      { id: 'portfolio', label: { en: 'PORTFOLIO', nl: 'PORTEFEUILLE' }, position: [0.32, 0.3, 0] },
      { id: 'paper', label: { en: 'PAPER TRADES', nl: 'OEFENTRADES' }, position: [-0.1, 0.3, 0.3] },
      { id: 'theses', label: { en: 'THESES', nl: 'THESES' }, position: [-0.3, 0.3, -0.1] },
      { id: 'guilds', label: { en: 'GUILDS', nl: 'GILDES' }, position: [0.1, 0.3, -0.3] },
      { id: 'relics', label: { en: 'RELICS', nl: 'RELICS' }, position: [0, 0.3, 0] }
    ],
    palette: { accent: '#7c5cff', glow: '#efb53d' },
    motion: 'the ring of shares parts a little; the relic at its middle turns and lights',
    // Its README and package.json (github.com/bhccob/Portle, 2026-10-29).
    stack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Drizzle', 'PostgreSQL', 'Better Auth'],
    links: { repo: 'https://github.com/bhccob/Portle', live: 'https://portle-azure.vercel.app' },
    // Run from a copy of its last commit with its own example members and settings, signed in as one of them.
    pictures: [
      {
        file: 'portle-portfolio.webp',
        alt: { nl: 'Portle: het portfolio-overzicht van een voorbeeldlid', en: "Portle: an example member's portfolio overview" }
      }
    ],
    pictureKind: 'wide',
    pictureCaption: { nl: 'Portle in early access, met voorbeeldgegevens', en: 'Portle in early access, with example data' },
    copy: {
      en: {
        type: 'Web app · Personal project, in early access',
        role: 'Sole developer',
        // Its README's own words, nothing added.
        summary:
          'A private archive for your portfolio, your investment theses and the friends you trust with them: one portfolio across your accounts, theses with their revisions, a paper-trading lab, a journal, and Guilds and Relics. In early access.',
        metaDescription: 'Portle: a private archive for your portfolio, your investment theses and the friends you trust with them.'
      },
      nl: {
        type: 'Webapp · Eigen project, in early access',
        role: 'Enige ontwikkelaar',
        summary:
          'Een privé archief voor je portefeuille, je beleggingstheses en de vrienden die je ermee vertrouwt: één portefeuille over je rekeningen heen, theses met hun revisies, een oefenlab voor trades, een dagboek, en Gildes en Relics. In early access.',
        metaDescription: 'Portle: een privé archief voor je portefeuille, je beleggingstheses en de vrienden die je ermee vertrouwt.'
      }
    }
  },
  {
    id: 'jontai-energy',
    title: 'Jontai Energy',
    year: 2026,
    categoryId: 'website',
    order: 3,
    object: { fallbackGeometry: 'pv-module-4x4+junction-box' },
    // What the redesign has (its design spec and PRODUCT.md): the day film, the product panels, the 3000 K to 6500 K bulb
    // slider and the quote request.
    testPoints: [
      { id: 'tp1', label: { en: 'DAY FILM', nl: 'DAGFILM' }, position: [-0.45, 0.03, -0.2] },
      { id: 'tp2', label: { en: 'PRODUCT PANELS', nl: 'PRODUCTPANELEN' }, position: [0.0, 0.03, 0.05] },
      { id: 'tp3', label: { en: 'LIGHT SLIDER', nl: 'LICHTSCHUIF' }, position: [0.62, 0.06, 0.55] },
      { id: 'tp4', label: { en: 'QUOTE PATH', nl: 'OFFERTEPAD' }, position: [0.95, 0.0, 0.8] }
    ],
    palette: { accent: '#00a650', glow: '#00d16a' },
    motion: 'sun sweep: a light arc crosses the module, cells charge in page order; single-axis tracker tilt',
    // Its package.json and PRODUCT.md (github.com/bhccob/Jontai-Energy, 9546f43): the film rendered in Blender Cycles.
    stack: ['Next.js', 'React', 'TypeScript', 'GSAP', 'Lenis', 'Blender'],
    // No live link: jontaienergy.com is not Bob's build, and the redesign is not published.
    // Bob, 2026-10-29: the repository the pictures came from.
    links: { repo: 'https://github.com/bhccob/Jontai-Energy' },
    // The old static site's screenshot, which no page shows now; `imageAlt` is its text.
    image: 'jontai-energy.png',
    // The redesign's last commit (9546f43), run from a scratch copy: its first screen once the sunrise has played.
    pictures: [
      {
        file: 'jontai-dawn.webp',
        alt: {
          nl: 'Herontwerp van Jontai Energy: “Aruba sunlight, made useful.” naast een zonnepaneel op een gestucte muur bij zonsopgang',
          en: 'Jontai Energy redesign: “Aruba sunlight, made useful.” beside a solar panel on a plaster wall at dawn'
        }
      }
    ],
    pictureKind: 'wide',
    pictureCaption: { nl: 'Het eerste scherm van het herontwerp, bij zonsopgang', en: "The redesign's first screen, at dawn" },
    copy: {
      en: {
        type: 'Concept website redesign · Personal project',
        role: 'Design & front-end development',
        summary:
          'A concept redesign of the website for Jontai Energy, a store in Oranjestad, Aruba, for solar, power, lighting and furniture: its home page is one Aruban day that plays as you scroll.',
        overview:
          "One continuous film of a single day on one plaster wall: scrolling moves the sun, and each product does its work at its hour, from the solar panel catching first light to the generator taking over in a night-time outage and the furniture upstairs the morning after. Products open a panel that tells them in full, with figures only from their manufacturers' documents; a slider shows a bulb from 3000 K to 6500 K, and a quote request names the product chosen.",
        build:
          'Built with Next.js, React and TypeScript. The film is rendered in Blender Cycles from a set built in Python, published as image frames and played on one canvas as you scroll, with GSAP ScrollTrigger and Lenis. Visitors who prefer reduced motion, use Save-Data or have no JavaScript get one still per chapter with its words.',
        focus:
          'Honesty and pace: every figure traced to a manufacturer document, no prices or stock made up, the renders never presented as the real store, and the scroll resting on each product long enough to read it.',
        imageAlt: 'Jontai Energy homepage with the headline “Power Your Future” over a field of solar panels',
        metaDescription:
          'Jontai Energy: a concept redesign Bob Chung built for a solar, power and furniture store in Aruba, its home page one day of sun that plays as you scroll.'
      },
      nl: {
        type: 'Concept-herontwerp van een website · Eigen project',
        role: 'Ontwerp & front-end-ontwikkeling',
        summary:
          'Een concept-herontwerp van de website van Jontai Energy, een winkel in Oranjestad, Aruba, voor zonne-energie, stroom, verlichting en meubels: de homepagina is één Arubaanse dag die meespeelt terwijl je scrolt.',
        overview:
          'Eén doorlopende film van één dag op één gestucte muur: scrollen beweegt de zon, en elk product doet zijn werk op zijn eigen uur, van het zonnepaneel dat het eerste licht vangt tot de generator die het overneemt bij een stroomstoring in de nacht en de meubels boven, de ochtend erna. Producten openen een paneel dat ze volledig toelicht, met cijfers alleen uit de documenten van hun fabrikant; een schuif toont een lamp van 3000 K tot 6500 K, en een offerteaanvraag noemt het gekozen product.',
        build:
          'Gebouwd met Next.js, React en TypeScript. De film is in Blender Cycles gerenderd uit een set die in Python is opgebouwd, als losse beelden gepubliceerd en op één canvas afgespeeld terwijl je scrolt, met GSAP ScrollTrigger en Lenis. Wie minder beweging wil, Save-Data gebruikt of geen JavaScript heeft, krijgt per hoofdstuk één stilstaand beeld met de tekst.',
        focus:
          'Eerlijkheid en tempo: elk cijfer herleid tot een document van de fabrikant, geen verzonnen prijzen of voorraad, de renders nooit gepresenteerd als de echte winkel, en de scroll die bij elk product lang genoeg stilstaat om het te lezen.',
        imageAlt: 'Homepagina van Jontai Energy met de kop “Power Your Future” boven een veld met zonnepanelen',
        metaDescription:
          'Jontai Energy: een concept-herontwerp dat Bob Chung bouwde voor een winkel in zonne-energie, stroom en meubels op Aruba, met één dag zon die meespeelt als je scrolt.'
      }
    }
  },
  {
    id: 'cookies-clicker',
    title: 'Cookies Clicker',
    year: 2025,
    categoryId: 'game',
    order: 4,
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
    // The game from its public repository, played a while.
    pictures: [{ file: 'cookies-playing.webp', alt: { nl: 'Cookies Clicker tijdens het spelen', en: 'Cookies Clicker being played' } }],
    pictureKind: 'wide',
    pictureCaption: { nl: 'Cookies Clicker tijdens het spelen', en: 'Cookies Clicker being played' },
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
