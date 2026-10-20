import { type JSX, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { PAGES } from '~/data/pages';
import type { Translator } from '~/i18n/Translator';
import { useTranslator } from '~/i18n/useTranslator';

/**
 * Where Back goes: the home page of the visitor's language. This is the one place that decides
 * it; the scene's history (Task 5) may later send Back through the history instead.
 */
export function backTarget(translator: Translator): string {
  return translator.path(PAGES.home);
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
 * The link back from a country, project, Lite or contact page, and the Escape key that does the same
 * while the page is open (not while someone types, and not if something has already handled the key).
 * The visible "Esc" is a hint for keyboards: it is hidden from screen readers and, on a touch screen,
 * from sight.
 */
export function BackLink(): JSX.Element {
  const i18n = useTranslator();
  const navigate = useNavigate();
  const target = backTarget(i18n);
  const { hint, label } = splitBackLabel(i18n.t.needle.project.back);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.defaultPrevented || isEditableTarget(event.target)) return;
      navigate(target);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, target]);

  return (
    <Link className="back" to={target} aria-keyshortcuts="Escape">
      {hint && (
        <span className="back-hint" aria-hidden="true">
          {`${hint} ·`}
        </span>
      )}
      {label}
    </Link>
  );
}
