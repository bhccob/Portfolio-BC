import { type JSX, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { type ProjectId, projects } from '~/data/projects';
import { useTranslator } from '~/i18n/useTranslator';
import { WORLD_PROJECTS } from '~/scene/bob/journey';
import { useScene } from '~/state/store';
import { isPlainClick } from './BackLink';
import { closeInside, turnInside, viewInside } from './projectOpen';
import { MASKS, raggedMask } from './tornMask';

// A project's own page over the stack (spec 2026-10-29-bob-stack-2-design.md, goal 2; the mock-up Bob chose, version 4,
// after overworldaudio.com/work/star-wars-survivor): full screen, the top a torn hole in the dark the project's object
// turns in; under it the words to the side, the kind of work and the name on the left, the summary, the facts and the
// links on the right; one picture, or an app's screens standing as phones; the next project far below, quiet; the way
// back pinned at the foot with a thin line for how far down. It replaces the side panel and the touch points.

/** The attribute on <html> while a project is open (the store's `inside`): the styles show the way back. */
export const INSIDE_ATTRIBUTE = 'data-inside';

/**
 * Listens on `target` for the ways about an open project other than its buttons: Escape `leave`s, ← and → `turn` to the
 * previous and the next project, with no ctrl, meta or alt held (alt with an arrow is the browser's Back and Forward).
 * Everything else, the wheel, the arrows up and down, Space and a swipe, is the page's own scroll: none leaves. Answers
 * its taking down.
 */
export function leaveViewOn(target: EventTarget, leave: () => void, turn: (dir: 1 | -1) => void): () => void {
  const key = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.key === 'Escape') leave();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') turn(e.key === 'ArrowRight' ? 1 : -1);
  };
  target.addEventListener('keydown', key);
  return () => target.removeEventListener('keydown', key);
}

/** Where on its opening (0..1) the open project's page comes in, eased: once its object is all but up (the lift first). */
const VIEW_IN = [0.7, 1] as const;
/** Where on its closing the page of the project left goes, eased: early, before the next's comes. */
const VIEW_OUT = [0.75, 1] as const;

/** `x` from `a` to `b` as 0 to 1, held there and smoothstepped. */
function eased(x: number, [a, b]: readonly [number, number]): number {
  const t = x > a ? (x < b ? (x - a) / (b - a) : 1) : 0;
  return t * t * (3 - 2 * t);
}

/**
 * How much of each page shows: the open project's (`id`) as its object opens, and, on the way from one to the next, the
 * one left as its object closes, gone before the next's comes (src/scene/bob/focus.ts `focusOpensAt`).
 */
export function viewLevels(
  id: ProjectId | null,
  opens: { open: number; leaving: { id: ProjectId; amount: number } | null }
): Partial<Record<ProjectId, number>> {
  const levels: Partial<Record<ProjectId, number>> = {};
  if (id !== null) levels[id] = eased(opens.open, VIEW_IN);
  if (opens.leaving !== null) levels[opens.leaving.id] = eased(opens.leaving.amount, VIEW_OUT);
  return levels;
}

const views = new Map<ProjectId, HTMLElement>();

export function registerProjectView(id: ProjectId, el: HTMLElement): () => void {
  views.set(id, el);
  el.style.opacity = '0';
  el.toggleAttribute('inert', true);
  return () => {
    if (views.get(id) === el) views.delete(id);
  };
}

/** Each page at its level (`viewLevels`), none for the rest: inert and out of the way while under half; back at its top once gone. */
export function showProjectViews(levels: Partial<Record<ProjectId, number>>): void {
  for (const [id, el] of views) {
    const level = Math.round(Math.min(Math.max(levels[id] ?? 0, 0), 1) * 1000) / 1000;
    el.style.opacity = String(level);
    el.toggleAttribute('inert', level < 0.5);
    el.toggleAttribute('data-shown', level > 0);
    if (level === 0 && el.scrollTop !== 0) el.scrollTop = 0;
  }
}

/** The masks, drawn once on the client: the hole, the blot and the tall blot as CSS urls. */
let masks: { hole: string; blot: string; tall: string } | null = null;
function masksNow(): typeof masks {
  if (masks === null && typeof document !== 'undefined') {
    const [hole, blot, tall] = [raggedMask(...MASKS.hole), raggedMask(...MASKS.blot), raggedMask(...MASKS.tall)];
    if (hole && blot && tall) masks = { hole: `url(${hole})`, blot: `url(${blot})`, tall: `url(${tall})` };
  }
  return masks;
}

/** One project's own page: in the HTML from the start, inert until the scene shows it. */
function View({ id }: { id: ProjectId }): JSX.Element {
  const i18n = useTranslator();
  const { t, locale } = i18n;
  const project = projects.byId(id)!;
  const copy = project.copy(locale);
  const at = WORLD_PROJECTS.indexOf(id);
  const next = projects.byId(WORLD_PROJECTS[(at + 1) % WORLD_PROJECTS.length]!)!;
  const pictures = project.pictures;
  const phones = project.pictureKind === 'phones';
  const nextPicture = next.pictures[next.pictureKind === 'phones' ? 1 : 0] ?? next.pictures[0];
  const nextUrl = nextPicture ? next.pictureUrl(nextPicture.file) : null;
  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return undefined;
      const stop = registerProjectView(id, el);
      // The torn masks, and each part fading up as it is reached.
      const m = masksNow();
      if (m) {
        el.style.setProperty('--hole', m.hole);
        el.style.setProperty('--blot', m.blot);
        el.style.setProperty('--tall', m.tall);
      }
      const seen = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
        for (const entry of entries) if (entry.isIntersecting) entry.target.classList.add('pv-in');
      }, { root: el, threshold: 0.12 });
      if (seen) for (const part of el.querySelectorAll('.pv-part')) seen.observe(part);
      return () => {
        stop();
        seen?.disconnect();
      };
    },
    [id]
  );
  const scrolled = (event: React.UIEvent<HTMLElement>): void => {
    const el = event.currentTarget;
    const most = el.scrollHeight - el.clientHeight;
    document.documentElement.style.setProperty('--pv-progress', String(most > 0 ? Math.round((el.scrollTop / most) * 1000) / 1000 : 0));
  };
  const swiped = (event: React.UIEvent<HTMLElement>): void => {
    const row = event.currentTarget;
    const k = Math.round(row.scrollLeft / Math.max(row.scrollWidth / pictures.length, 1));
    row.parentElement?.querySelectorAll('.pv-dot').forEach((dot, j) => dot.classList.toggle('pv-on', j === k));
  };

  return (
    <section className="project-view" data-project={id} role="dialog" aria-modal="true" aria-labelledby={`pv-title-${id}`} ref={ref} onScroll={scrolled} inert>
      <div className="pv-top">
        <div className="pv-veil" />
      </div>
      <div className="pv-intro pv-part">
        <div className="pv-heading">
          <p className="pv-kind">{project.category.heading(locale)}</p>
          <h2 id={`pv-title-${id}`} className="pv-title">
            {project.title}
          </h2>
        </div>
        <div className="pv-text">
          <p className="pv-lead">{copy.summary}</p>
          <dl className="pv-facts">
            <div>
              <dt>{t.work.year}</dt>
              <dd>{project.year}</dd>
            </div>
            <div>
              <dt>{t.work.role}</dt>
              <dd>{copy.role}</dd>
            </div>
            {project.stack.length > 0 && (
              <div>
                <dt>{t.work.stack}</dt>
                {project.stack.map((tool) => (
                  <dd key={tool}>{tool}</dd>
                ))}
              </div>
            )}
            <div>
              <dt>{t.work.type}</dt>
              <dd>{copy.type}</dd>
            </div>
          </dl>
          <p className="pv-links">
            {project.links.repo && (
              <a className="pv-link" href={project.links.repo} target="_blank" rel="noopener noreferrer">
                {t.work.github} <span aria-hidden="true">→</span>
              </a>
            )}
            <Link
              className="pv-more"
              to={i18n.path(projects.route(project))}
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                viewInside();
              }}
            >
              {t.needle.page.readMore}
            </Link>
          </p>
        </div>
      </div>
      {pictures.length > 0 && (
        <div className={`pv-media pv-part${phones ? ' pv-apps' : ''}`}>
          {phones ? (
            <>
              <div className="pv-phones" onScroll={swiped}>
                {pictures.map((picture, k) => (
                  <figure key={picture.file} className={k === 1 ? 'pv-phone pv-front' : 'pv-phone'}>
                    <img src={project.pictureUrl(picture.file) ?? undefined} alt={picture.alt[locale]} loading="lazy" decoding="async" />
                  </figure>
                ))}
              </div>
              <div className="pv-dots" aria-hidden="true">
                {pictures.map((picture, k) => (
                  <span key={picture.file} className={k === 0 ? 'pv-dot pv-on' : 'pv-dot'} />
                ))}
              </div>
            </>
          ) : (
            <figure className="pv-card pv-wide">
              <img src={project.pictureUrl(pictures[0]!.file) ?? undefined} alt={pictures[0]!.alt[locale]} loading="lazy" decoding="async" />
            </figure>
          )}
          <p className="pv-caption">{project.pictureCaption(locale)}</p>
        </div>
      )}
      <div className="pv-next pv-part">
        <button type="button" className="pv-onward" onClick={() => turnInside(1)}>
          {nextUrl && <img className={next.pictureKind === 'phones' ? 'pv-tall' : undefined} src={nextUrl} alt="" loading="lazy" decoding="async" />}
          <span className="pv-words">
            <span className="pv-eyebrow">{t.needle.inside.next}</span>
            <span className="pv-name">{next.title}</span>
          </span>
        </button>
      </div>
    </section>
  );
}

/**
 * Every project's own page, one per project on the world, each shown by the scene as its project opens
 * (`showProjectViews`), and the way back pinned at the foot with how far down. While the store's `inside` is set,
 * `<html data-inside>` shows the way back, it takes the focus, and Escape and the arrows leave or turn (`leaveViewOn`);
 * when the page closes with the focus in it, the focus goes to <main>, so the keyboard goes on from the page.
 */
export function ProjectViews(): JSX.Element {
  const { t } = useTranslator();
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    let stopLeaving: (() => void) | null = null;
    const apply = (open: ProjectId | null, was: ProjectId | null): void => {
      root.toggleAttribute(INSIDE_ATTRIBUTE, open !== null);
      if (open !== null && stopLeaving === null) stopLeaving = leaveViewOn(window, closeInside, (dir) => void turnInside(dir));
      if (open === null && stopLeaving !== null) {
        stopLeaving();
        stopLeaving = null;
      }
      if (open !== null && was === null) back.current?.focus({ preventScroll: true });
      if (open === null && (back.current?.contains(document.activeElement) || document.activeElement?.closest('.project-view'))) {
        document.getElementById('main')?.focus({ preventScroll: true });
      }
      if (open === null) root.style.removeProperty('--pv-progress');
    };
    apply(useScene.getState().inside, null);
    const unsubscribe = useScene.subscribe((state, previous) => {
      if (state.inside !== previous.inside) apply(state.inside, previous.inside);
    });
    return () => {
      unsubscribe();
      stopLeaving?.();
      root.removeAttribute(INSIDE_ATTRIBUTE);
      root.style.removeProperty('--pv-progress');
    };
  }, []);
  return (
    <>
      {WORLD_PROJECTS.map((id) => (
        <View key={id} id={id} />
      ))}
      <div className="pv-controls">
        <button type="button" className="pv-back" ref={back} onClick={() => closeInside()}>
          <span aria-hidden="true">←</span> {t.needle.page.back} <kbd aria-hidden="true">Esc</kbd>
        </button>
        <span className="pv-progress" aria-hidden="true">
          <span />
        </span>
      </div>
    </>
  );
}
