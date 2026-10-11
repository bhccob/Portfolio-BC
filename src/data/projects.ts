import type { ImageMetadata } from 'astro';
import type { Locale } from '../i18n/Translator';
import cookiesImage from '../assets/cookies.png';
import jontaiImage from '../assets/jontai-energy.png';

export interface ProjectCopy {
  /** Kind of work and context, e.g. "Web game · School project". */
  type: string;
  /** Skill area and kind of build, shown on the project card, e.g. "Web development · Browser game". */
  category: string;
  role: string;
  summary: string;
  overview: string;
  build: string;
  focus: string;
  imageAlt: string;
  metaDescription: string;
}

export interface ProjectData {
  slug: string;
  number: number;
  title: string;
  year: number;
  repo: string;
  image: ImageMetadata;
  /**
   * How the screenshot sits in its 4:3 card: the focal point, and how far the
   * crop magnifies it (so a large enough source image is requested).
   */
  crop?: { position: string; zoom: number };
  stack: string[];
  copy: Record<Locale, ProjectCopy>;
}

export class Project {
  constructor(private readonly data: ProjectData) {}

  get slug() { return this.data.slug; }
  get number() { return this.data.number; }
  get title() { return this.data.title; }
  get year() { return this.data.year; }
  get repo() { return this.data.repo; }
  get image() { return this.data.image; }
  get crop() { return this.data.crop; }
  get stack() { return this.data.stack; }

  /** "#01", "#02", … */
  get label(): string {
    return `#${String(this.data.number).padStart(2, '0')}`;
  }

  /** Anchor of the project's chapter on the home page. */
  get anchor(): string {
    return `project-${this.data.slug}`;
  }

  /** Short repository path, e.g. "bhccob/JE". */
  get repoPath(): string {
    return this.data.repo.replace(/^https?:\/\/github\.com\//, '');
  }

  route(): string {
    return `/projects/${this.data.slug}/`;
  }

  copy(locale: Locale): ProjectCopy {
    return this.data.copy[locale];
  }
}

export class ProjectCatalog {
  private readonly items: Project[];

  constructor(data: ProjectData[]) {
    this.items = data.map((entry) => new Project(entry)).sort((a, b) => a.number - b.number);
  }

  all(): Project[] {
    return [...this.items];
  }

  bySlug(slug: string): Project | undefined {
    return this.items.find((project) => project.slug === slug);
  }

  /** The project after this one, wrapping around to the first. */
  next(project: Project): Project {
    const index = this.items.indexOf(project);
    return this.items[(index + 1) % this.items.length];
  }

  /** Number shown on the "next build" placeholder. */
  get upcomingLabel(): string {
    return `#${String(this.items.length + 1).padStart(2, '0')}`;
  }
}

export const projects = new ProjectCatalog([
  {
    slug: 'cookies-clicker',
    number: 1,
    title: 'Cookies Clicker',
    year: 2025,
    repo: 'https://github.com/bhccob/Cookies-Clicker',
    image: cookiesImage,
    crop: { position: '6% 50%', zoom: 2.8 },
    stack: ['HTML', 'CSS', 'JavaScript', 'localStorage'],
    copy: {
      en: {
        type: 'Web game · School project',
        category: 'Web development · Browser game',
        role: 'Design & development',
        summary:
          'A browser-based incremental game, built as a school project around one satisfying loop: click, earn cookies, reinvest in upgrades and watch production compound.',
        overview:
          'Cookies Clicker turns a single action into a progression system. Players bake cookies by clicking, then spend them on producers, from grandmas and suppliers to pastry chefs, bakeries and beyond, that keep baking automatically and build momentum over time.',
        build:
          'Written in HTML, CSS and JavaScript. Producers share a reusable AutoClicker class, timed boosts and random bonus events keep the loop lively, and progress is saved in the browser with localStorage so players can pick up where they left off.',
        focus:
          'Game feel and economy balancing: making every click, purchase and boost give clear feedback, and pacing upgrade costs so progress stays rewarding without becoming trivial.',
        imageAlt: 'Cookies Clicker interface with the cookie counter, the store of producers and the boosts panel',
        metaDescription:
          'Cookies Clicker, a browser-based incremental game Bob Chung built as a school project with HTML, CSS and JavaScript: producers, boosts and saved progress.'
      },
      nl: {
        type: 'Webgame · Schoolproject',
        category: 'Webontwikkeling · Browsergame',
        role: 'Ontwerp & ontwikkeling',
        summary:
          'Een incrementele browsergame, gebouwd als schoolproject rond één bevredigende loop: klik, verdien koekjes, investeer in upgrades en zie de productie groeien.',
        overview:
          'Cookies Clicker maakt van één simpele actie een voortgangssysteem. Spelers bakken koekjes door te klikken en besteden ze aan producenten, van oma’s en leveranciers tot banketbakkers, bakkerijen en verder, die automatisch doorbakken en zo momentum opbouwen.',
        build:
          'Geschreven in HTML, CSS en JavaScript. Producenten delen een herbruikbare AutoClicker-klasse, tijdelijke boosts en willekeurige bonussen houden de loop levendig, en de voortgang wordt in de browser opgeslagen met localStorage zodat spelers verder kunnen waar ze gebleven waren.',
        focus:
          'Gamefeel en economiebalans: elke klik, aankoop en boost duidelijke feedback geven, en upgradeprijzen zo afstemmen dat voortgang lonend blijft zonder te makkelijk te worden.',
        imageAlt: 'Interface van Cookies Clicker met de koekjesteller, de winkel met producenten en het boostpaneel',
        metaDescription:
          'Cookies Clicker, een incrementele browsergame die Bob Chung als schoolproject bouwde met HTML, CSS en JavaScript: producenten, boosts en opgeslagen voortgang.'
      }
    }
  },
  {
    slug: 'jontai-energy',
    number: 2,
    title: 'Jontai Energy',
    year: 2026,
    repo: 'https://github.com/bhccob/JE',
    image: jontaiImage,
    crop: { position: '50% 58%', zoom: 1.7 },
    stack: ['HTML', 'Tailwind CSS', 'JavaScript', 'PowerShell'],
    copy: {
      en: {
        type: 'Company website · Personal project',
        category: 'Web development · Company website',
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
        category: 'Webontwikkeling · Bedrijfswebsite',
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
  }
]);
