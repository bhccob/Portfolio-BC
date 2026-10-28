import type { Locale } from '../i18n/Translator';

export type CategoryId = 'app' | 'website' | 'game';

export interface CategoryData {
  id: CategoryId;
  number: number;
  /** The technical label shown with the number, per language (a HUD label, so it is translated too). */
  label: Record<Locale, string>;
}

/**
 * The kind of work a project is, which it is filed under: an app, a website, game development (Bob, 2026-10-28: "can
 * you sort it by category tho like Game Developement, Website, App, etc put projects by category in each board"). Each
 * has its own board in the stack (docs/superpowers/specs/2026-10-28-bob-quantum-stack-design.md). The device-part names
 * of the void before it (secure element, front panel, oscillator) are in docs/projects-discovery.md, as its history.
 */
export class Category {
  constructor(private readonly data: CategoryData) {}

  get id() { return this.data.id; }
  get number() { return this.data.number; }

  label(locale: Locale): string {
    return this.data.label[locale];
  }

  /** "01 — APP": the number and the label, as the focus screen shows them. */
  heading(locale: Locale): string {
    return `${String(this.data.number).padStart(2, '0')} — ${this.label(locale)}`;
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

// Bob's own words for the kinds (2026-10-28); "Game-ontwikkeling" is my Dutch for his "Game Development".
export const categories = new CategoryCatalog([
  { id: 'app', number: 1, label: { en: 'APP', nl: 'APP' } },
  { id: 'website', number: 2, label: { en: 'WEBSITE', nl: 'WEBSITE' } },
  { id: 'game', number: 3, label: { en: 'GAME DEVELOPMENT', nl: 'GAME-ONTWIKKELING' } }
]);
