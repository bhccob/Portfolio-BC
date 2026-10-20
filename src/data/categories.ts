import type { Locale } from '../i18n/Translator';

export type CategoryId = 'web-development' | 'game-development';

export interface CategoryCopy {
  title: string;
  /** One or two sentences about the kind of work on this shelf. */
  intro: string;
  metaDescription: string;
}

export interface CategoryData {
  id: CategoryId;
  number: number;
  /** Short code shown on flap tiles, e.g. "WEB". */
  code: string;
  copy: Record<Locale, CategoryCopy>;
}

/**
 * A software discipline the projects are grouped under. The home page shows
 * one print per category; each category has its own page where visitors
 * switch between the projects on that shelf.
 */
export class Category {
  constructor(private readonly data: CategoryData) {}

  get id() { return this.data.id; }
  get number() { return this.data.number; }
  get code() { return this.data.code; }

  /** "#01", "#02", … */
  get label(): string {
    return `#${String(this.data.number).padStart(2, '0')}`;
  }

  route(): string {
    return `/projects/${this.data.id}/`;
  }

  copy(locale: Locale): CategoryCopy {
    return this.data.copy[locale];
  }
}

export class CategoryCatalog {
  private readonly items: Category[];

  constructor(data: CategoryData[]) {
    this.items = data.map((entry) => new Category(entry)).sort((a, b) => a.number - b.number);
  }

  all(): Category[] {
    return [...this.items];
  }

  byId(id: CategoryId): Category {
    const category = this.items.find((item) => item.id === id);
    if (!category) throw new Error(`Unknown project category: ${id}`);
    return category;
  }
}

export const categories = new CategoryCatalog([
  {
    id: 'web-development',
    number: 1,
    code: 'WEB',
    copy: {
      en: {
        title: 'Web development',
        intro:
          'Websites and browser applications, from a multi-page company website to a game that runs in the browser. Built with HTML, CSS and JavaScript, with Tailwind CSS where it fits.',
        metaDescription:
          'Web development projects by Bob Chung, student software engineer in Rotterdam: what each project is, how it was built and what he focused on.'
      },
      nl: {
        title: 'Webontwikkeling',
        intro:
          'Websites en browserapplicaties, van een bedrijfswebsite met meerdere pagina’s tot een game die in de browser draait. Gebouwd met HTML, CSS en JavaScript, met Tailwind CSS waar dat past.',
        metaDescription:
          'Webontwikkelingsprojecten van Bob Chung, student software engineer in Rotterdam: wat elk project is, hoe het gebouwd is en waar hij op focuste.'
      }
    }
  },
  {
    id: 'game-development',
    number: 2,
    code: 'GAME',
    copy: {
      en: {
        title: 'Game development',
        intro: 'Games and the systems behind them: the game loop, progression and economy, and the feel of every click.',
        metaDescription:
          'Game development projects by Bob Chung, student software engineer in Rotterdam: what each game is, how it was built and what he focused on.'
      },
      nl: {
        title: 'Gameontwikkeling',
        intro: 'Games en de systemen erachter: de gameloop, voortgang en economie, en het gevoel van elke klik.',
        metaDescription:
          'Gameontwikkelingsprojecten van Bob Chung, student software engineer in Rotterdam: wat elke game is, hoe die gebouwd is en waar hij op focuste.'
      }
    }
  }
]);
