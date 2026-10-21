import { type JSX, useEffect } from 'react';
import { Link, type NavigateFunction, useNavigate } from 'react-router';
import { PAGES } from '~/data/pages';
import type { Translator } from '~/i18n/Translator';
import { useTranslator } from '~/i18n/useTranslator';
import { arrivedDirectly, backTarget } from '~/state/routeSync';

/** The home page of the visitor's language: the link's address, which works without script and is what crawlers see. */
export function homeTarget(translator: Translator): string {
  return translator.path(PAGES.home);
}

/**
 * Back, for a click and for Escape: one step back through the history when the visitor came here from
 * another page of the site, and to the home page when this page is where the visit began.
 */
export function goBack(navigate: NavigateFunction, home: string): void {
  if (backTarget(arrivedDirectly()) === 'history') void navigate(-1);
  else void navigate(home);
}

/** True for a left click with no modifier key; any other click (a new tab, a download) is left to the browser. */
export function isPlainClick(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * The approved copy is one string, "Esc · back": the key hint, a separator, then the label.
 * The hint is shown to people with a keyboard and kept out of the link's name.
 */
export function splitBackLabel(text: string): { hint: string | null; label: string } {
  const separator = ' · ';
  const at = text.indexOf(separator);
  return at === -1 ? { hint: null, label: text } : { hint: text.slice(0, at), label: text.slice(at + separator.length) };
}

/** True where a key press belongs to the field: an input, a textarea, a select or editable content. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!element) return false;
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT' || element.isContentEditable === true;
}

/**
 * The link back from a project, Lite or contact page, and the Escape key that does the same
 * while the page is open (not while someone types, and not if something has already handled the key).
 * Both go where `goBack` says; the link's own address stays the home page. The visible "Esc" is a hint
 * for keyboards: it is hidden from screen readers and, on a touch screen, from sight.
 */
export function BackLink(): JSX.Element {
  const i18n = useTranslator();
  const navigate = useNavigate();
  const home = homeTarget(i18n);
  const { hint, label } = splitBackLabel(i18n.t.needle.project.back);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.defaultPrevented || isEditableTarget(event.target)) return;
      goBack(navigate, home);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, home]);

  return (
    <Link
      className="back"
      to={home}
      aria-keyshortcuts="Escape"
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        goBack(navigate, home);
      }}
    >
      {hint && (
        <span className="back-hint" aria-hidden="true">
          {`${hint} ·`}
        </span>
      )}
      {label}
    </Link>
  );
}
