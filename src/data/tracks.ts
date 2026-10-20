import { Translator, type Locale } from '../i18n/Translator';
import type { TrackId } from '../scripts/three/instrument/drive';
import { projects } from './projects';

export interface TrackLink {
  href: string;
  label: string;
  /** True when the link leaves the site. */
  external: boolean;
}

export interface TrackCopy {
  name: string;
  /** The track's electronics nickname, e.g. "Secure element". */
  category: string;
  /** Kind of work and year, e.g. "Personal project · 2026"; empty for the unwritten track. */
  kind: string;
  line: string;
  /** The four test-point labels, in order; empty for the unwritten track. */
  tps: readonly string[];
  link: TrackLink | null;
}

type TrackText = Omit<TrackCopy, 'link'>;

/** The repository behind the Funcial track, which has no page of its own on the site. */
const FUNCIAL_REPOSITORY = 'https://github.com/bhccob/Funcial';

const OPEN_PROJECT: Record<Locale, string> = { en: 'Open project', nl: 'Bekijk project' };

// First drafts of the lines and the test-point labels; Bob approves them with milestone 6.
const text: Record<TrackId, Record<Locale, TrackText>> = {
  funcial: {
    en: {
      name: 'Funcial',
      category: 'Secure element',
      kind: 'Personal project · 2026',
      line: 'A gamified personal-finance app for Android: log a spend in seconds, level up, and keep your money data encrypted on your phone.',
      tps: ['Log', 'Game layer', 'Money rules', 'Vault']
    },
    nl: {
      name: 'Funcial',
      category: 'Secure element',
      kind: 'Eigen project · 2026',
      line: 'Een gamified app voor persoonlijke financiën op Android: leg een uitgave in seconden vast, stijg in level en houd je financiële gegevens versleuteld op je telefoon.',
      tps: ['Vastleggen', 'Spellaag', 'Geldregels', 'Kluis']
    }
  },
  'jontai-energy': {
    en: {
      name: 'Jontai Energy',
      category: 'Front panel',
      kind: 'Personal project · 2026',
      line: 'A multi-page website for a solar-energy company that guides visitors through its services and makes requesting a quote effortless.',
      tps: ['Pages', 'Design system', 'Languages', 'Quote']
    },
    nl: {
      name: 'Jontai Energy',
      category: 'Front panel',
      kind: 'Eigen project · 2026',
      line: 'Een website met meerdere pagina’s voor een zonne-energiebedrijf, die bezoekers door de diensten leidt en het aanvragen van een offerte moeiteloos maakt.',
      tps: ['Pagina’s', 'Designsysteem', 'Talen', 'Offerte']
    }
  },
  'cookies-clicker': {
    en: {
      name: 'Cookies Clicker',
      category: 'Feedback loop',
      kind: 'School project · 2025',
      line: 'A browser game built around one loop: click, earn cookies, reinvest in upgrades and watch production compound.',
      tps: ['Click', 'Producers', 'Boosts', 'Save']
    },
    nl: {
      name: 'Cookies Clicker',
      category: 'Feedback loop',
      kind: 'Schoolproject · 2025',
      line: 'Een browsergame rond één lus: klikken, koekjes verdienen, investeren in upgrades en de productie zien groeien.',
      tps: ['Klikken', 'Producenten', 'Boosts', 'Opslaan']
    }
  },
  next: {
    en: {
      name: 'Bare metal',
      category: 'Next',
      kind: '',
      line: 'The next track is not written yet: embedded systems, closer to the hardware.',
      tps: []
    },
    nl: {
      name: 'Bare metal',
      category: 'Volgende',
      kind: '',
      line: 'Het volgende spoor is nog niet geschreven: embedded systemen, dichter bij de hardware.',
      tps: []
    }
  }
};

/** A project track opens its page on this site, in the visitor's language. */
function projectLink(slug: string, locale: Locale): TrackLink {
  const project = projects.bySlug(slug);
  if (!project) throw new Error(`No project "${slug}" for its track`);
  return { href: new Translator(locale).path(projects.route(project)), label: OPEN_PROJECT[locale], external: false };
}

function linkFor(id: TrackId, locale: Locale): TrackLink | null {
  switch (id) {
    case 'funcial':
      return { href: FUNCIAL_REPOSITORY, label: new Translator(locale).t.work.github, external: true };
    case 'jontai-energy':
    case 'cookies-clicker':
      return projectLink(id, locale);
    case 'next':
      return null;
  }
}

/** The words of one track on the drive's platter, in one language. */
export function trackCopy(id: TrackId, locale: Locale): TrackCopy {
  return { ...text[id][locale], link: linkFor(id, locale) };
}
