import { describe, expect, it } from 'vitest';
import { projects } from '../../src/data/projects';
import { trackCopy } from '../../src/data/tracks';
import { Translator, locales, type Locale } from '../../src/i18n/Translator';
import { TRACKS, type TrackId } from '../../src/scripts/three/instrument/drive';

const PROJECT_TRACKS: readonly TrackId[] = ['funcial', 'jontai-energy', 'cookies-clicker'];

/** Every string a track hands the page. */
function strings(id: TrackId, locale: Locale): string[] {
  const copy = trackCopy(id, locale);
  return [copy.name, copy.category, copy.kind, copy.line, ...copy.tps, ...(copy.link ? [copy.link.href, copy.link.label] : [])];
}

describe('trackCopy', () => {
  it('returns all four tracks, filled, in both locales', () => {
    for (const locale of locales) {
      for (const id of TRACKS) {
        const copy = trackCopy(id, locale);
        expect(copy.name.length).toBeGreaterThan(0);
        expect(copy.category.length).toBeGreaterThan(0);
        expect(copy.line.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives the three projects exactly four test points and the next track none', () => {
    for (const locale of locales) {
      for (const id of PROJECT_TRACKS) {
        const copy = trackCopy(id, locale);
        expect(copy.tps).toHaveLength(4);
        for (const label of copy.tps) expect(label.length).toBeGreaterThan(0);
        expect(copy.kind.length).toBeGreaterThan(0);
      }
      const next = trackCopy('next', locale);
      expect(next.tps).toEqual([]);
      expect(next.kind).toBe('');
    }
  });

  it('links Funcial to its repository, outside the site', () => {
    expect(trackCopy('funcial', 'en').link).toEqual({ href: 'https://github.com/bhccob/Funcial', label: 'View on GitHub', external: true });
    expect(trackCopy('funcial', 'nl').link).toEqual({ href: 'https://github.com/bhccob/Funcial', label: 'Bekijk op GitHub', external: true });
  });

  it('links Jontai and Cookies to their project pages, inside the site', () => {
    const labels: Record<Locale, string> = { en: 'Open project', nl: 'Bekijk project' };
    for (const locale of locales) {
      for (const slug of ['jontai-energy', 'cookies-clicker'] as const) {
        const project = projects.bySlug(slug);
        expect(project).toBeDefined();
        expect(trackCopy(slug, locale).link).toEqual({
          href: new Translator(locale).path(projects.route(project!)),
          label: labels[locale],
          external: false
        });
      }
    }
  });

  it('gives the next track no link', () => {
    for (const locale of locales) expect(trackCopy('next', locale).link).toBeNull();
  });

  it('never describes Funcial with AI', () => {
    for (const locale of locales) {
      for (const text of strings('funcial', locale)) {
        expect(text).not.toMatch(/\bAI\b|artificial|kunstmatig/i);
      }
    }
  });

  it('keeps the brief’s wording', () => {
    expect(trackCopy('funcial', 'en')).toMatchObject({
      name: 'Funcial',
      category: 'Secure element',
      kind: 'Personal project · 2026',
      tps: ['Log', 'Game layer', 'Money rules', 'Vault']
    });
    expect(trackCopy('jontai-energy', 'nl')).toMatchObject({
      name: 'Jontai Energy',
      category: 'Front panel',
      kind: 'Eigen project · 2026',
      tps: ['Pagina’s', 'Designsysteem', 'Talen', 'Offerte']
    });
    expect(trackCopy('cookies-clicker', 'en')).toMatchObject({ category: 'Feedback loop', kind: 'School project · 2025' });
    expect(trackCopy('cookies-clicker', 'nl')).toMatchObject({ kind: 'Schoolproject · 2025', tps: ['Klikken', 'Producenten', 'Boosts', 'Opslaan'] });
    expect(trackCopy('next', 'en')).toMatchObject({ name: 'Bare metal', category: 'Next' });
    expect(trackCopy('next', 'nl')).toMatchObject({ name: 'Bare metal', category: 'Volgende' });
    expect(trackCopy('jontai-energy', 'nl').line).toBe(
      'Een website met meerdere pagina’s voor een zonne-energiebedrijf, die bezoekers door de diensten leidt en het aanvragen van een offerte moeiteloos maakt.'
    );
    expect(trackCopy('funcial', 'nl').line).toBe(
      'Een gamified app voor persoonlijke financiën op Android: leg een uitgave in seconden vast, stijg in level en houd je financiële gegevens versleuteld op je telefoon.'
    );
  });
});

describe('the compass copy for the drive', () => {
  it('has the new keys in English', () => {
    const c = new Translator('en').t.compass;
    expect(c.work.title).toBe('What I work with');
    expect(c.work.caption).toBe('1820: an electric current moved a compass needle.');
    expect(c.change).toBe('The same force that guided ships now stores data.');
    expect(c.projects).toBe('Projects');
    expect(c.tp).toBe('TP{n} · {label}');
    expect(c.offduty).toEqual({ title: 'Off duty', spin: 'What keeps me spinning' });
    expect(c.qa.title).toBe('Questions');
    expect(c.hello).toBe('Say hello');
    expect(c.stills.drive).toBe('The compass turned into a hard drive, its tracks lit');
    expect(c.stills.offduty).toBe("The drive's spindle, close up");
  });

  it('has the new keys in Dutch', () => {
    const c = new Translator('nl').t.compass;
    expect(c.work.title).toBe('Waar ik mee werk');
    expect(c.work.caption).toBe('1820: een elektrische stroom liet een kompasnaald bewegen.');
    expect(c.change).toBe('Dezelfde kracht die schepen de weg wees, slaat nu data op.');
    expect(c.projects).toBe('Projecten');
    expect(c.tp).toBe('TP{n} · {label}');
    expect(c.offduty).toEqual({ title: 'Buiten dienst', spin: 'Wat mij draaiende houdt' });
    expect(c.qa.title).toBe('Vragen');
    expect(c.hello).toBe('Zeg hallo');
    expect(c.stills.drive).toBe('Het kompas als harde schijf, met verlichte sporen');
    expect(c.stills.offduty).toBe('De spindel van de schijf, van dichtbij');
  });

  it('asks the same five questions in both languages', () => {
    expect(new Translator('en').t.compass.qa.items).toEqual([
      'What do you do now?',
      'What comes after MBO 4?',
      'Which roles interest you?',
      'Why these directions?',
      'Where does it lead?'
    ]);
    expect(new Translator('nl').t.compass.qa.items).toEqual([
      'Wat doe je nu?',
      'Wat komt er na MBO 4?',
      'Welke rollen interesseren je?',
      'Waarom deze richtingen?',
      'Waar leidt het naartoe?'
    ]);
  });

  it('fills the head label with a number and a label', () => {
    const t = new Translator('en');
    expect(t.format(t.t.compass.tp, { n: 2, label: 'Design system' })).toBe('TP2 · Design system');
  });
});
