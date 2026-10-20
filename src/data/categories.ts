import type { Locale } from '../i18n/Translator';

export type CategoryId = 'secure-element' | 'front-panel' | 'oscillator';

export interface CategoryData {
  id: CategoryId;
  number: number;
  /** The technical label shown with the number, per language (a HUD label, so it is translated too). */
  label: Record<Locale, string>;
}

/**
 * A kind of device part that a project is filed under in the void: the secure
 * element keeps keys, the front panel is what the public touches, the
 * oscillator makes a device tick (docs/projects-discovery.md).
 */
export class Category {
  constructor(private readonly data: CategoryData) {}

  get id() { return this.data.id; }
  get number() { return this.data.number; }

  label(locale: Locale): string {
    return this.data.label[locale];
  }

  /** "01 — SECURE ELEMENT": the number and the label, as the focus screen shows them. */
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

// The English labels are the approved ones (docs/projects-discovery.md); the Dutch ones follow the
// copy budget (docs/art-direction.md: BEVEILIGD ELEMENT) and the discovery's suggested Dutch labels.
export const categories = new CategoryCatalog([
  { id: 'secure-element', number: 1, label: { en: 'SECURE ELEMENT', nl: 'BEVEILIGD ELEMENT' } },
  { id: 'front-panel', number: 2, label: { en: 'FRONT PANEL', nl: 'FRONTPANEEL' } },
  { id: 'oscillator', number: 3, label: { en: 'OSCILLATOR', nl: 'OSCILLATOR' } }
]);
