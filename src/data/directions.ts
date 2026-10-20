import { PAGES, type PageId } from './pages';

export type DirId = 'east' | 'north' | 'west' | 'south';
export type CountryId = 'china' | 'netherlands' | 'aruba';

/** The three countries, in the order the pages and the home navigation list them. */
export const COUNTRY_IDS: readonly CountryId[] = ['china', 'netherlands', 'aruba'];

export interface Direction {
  id: DirId;
  /** A country arm leads to a page about that country; the portal arm leads to the projects. */
  kind: 'country' | 'portal';
  country?: CountryId;
  /** What is engraved on the arm of the compass; geometry in the scene, never a webfont. */
  engraving: string;
  /** The arm's accent colour (docs/art-direction.md § Country accents). */
  accent: string;
}

/**
 * The four arms of the compass. East, north and west are countries; south is
 * the portal into the project void, in track gold.
 */
export const DIRECTIONS: readonly Direction[] = [
  { id: 'east', kind: 'country', country: 'china', engraving: '東', accent: '#a8352a' },
  { id: 'north', kind: 'country', country: 'netherlands', engraving: 'Noord', accent: '#1d5fa8' },
  { id: 'west', kind: 'country', country: 'aruba', engraving: '[FILL: Papiamento word for west]', accent: '#2db3a8' },
  { id: 'south', kind: 'portal', engraving: '南', accent: '#efb53d' },
];

/**
 * The country whose page a route is (`/about/china/`), or undefined for any other route, which
 * includes a real page under another spelling (`/About/China/`): the page lives at one URL.
 */
export function countryFromRoute(route: string): CountryId | undefined {
  return COUNTRY_IDS.find((id) => {
    const page: PageId = `about-${id}`;
    return PAGES[page] === route;
  });
}

/** The arm that stands for a country. */
export function countryDirection(id: CountryId): Direction {
  const direction = DIRECTIONS.find((entry) => entry.country === id);
  if (!direction) throw new Error(`No direction for country: ${id}`);
  return direction;
}
