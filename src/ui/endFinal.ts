/**
 * Whether the credits' message part is up (src/ui/EndPage.tsx). As the credits roll at rest, their text fades in at the
 * screen's foot and out at its top (src/styles/base.css, "the credits over the scene"). The message part is the
 * contact page's own form, taller than half a screen, and on a phone taller than the screen. Under the fades its title
 * and its last links would stay dim wherever the scroll stops. So once the part reaches the screen's top half, #end is
 * marked (`data-final`) and the fades lift. They come back as the part goes back down the screen.
 *
 * An IntersectionObserver against the screen's top half reads where the part stands, with no scroll handler. While the
 * credits move over the sheet, the page clips the part below the screen, so the mark stays off.
 */

/** The attribute on #end while its message part is up. */
export const FINAL_ATTRIBUTE = 'data-final';

/** The screen's top half: the part is up once any of it stands there. */
export const FINAL_MARGIN = '0px 0px -50% 0px';

/** What `watchFinal` needs of #end: its message part, and its mark. */
export interface FinalSection {
  querySelector(selector: string): object | null;
  toggleAttribute(name: string, force: boolean): boolean;
}

/** What `watchFinal` needs of an IntersectionObserver. */
export interface FinalObserver {
  observe(target: object): void;
  disconnect(): void;
}

/** An IntersectionObserver's constructor, as far as `watchFinal` uses it. */
export type FinalObserverClass = new (
  callback: (entries: { isIntersecting: boolean }[]) => void,
  options?: { rootMargin?: string }
) => FinalObserver;

/**
 * Marks `section` (#end) while its message part (`.end-final`) is up, and answers the cleanup, which lets go and
 * clears the mark. With no section, no part or no `Observer` (the server, an old browser) it does nothing, and the
 * fades stay as the stylesheet draws them.
 */
export function watchFinal(
  section: FinalSection | null,
  Observer: FinalObserverClass | undefined = typeof IntersectionObserver === 'undefined' ? undefined : (IntersectionObserver as unknown as FinalObserverClass)
): () => void {
  const final = section?.querySelector('.end-final') ?? null;
  if (!section || !final || !Observer) return () => {};
  const observer = new Observer(
    (entries) => {
      const last = entries.at(-1);
      if (last) section.toggleAttribute(FINAL_ATTRIBUTE, last.isIntersecting);
    },
    { rootMargin: FINAL_MARGIN }
  );
  observer.observe(final);
  return () => {
    observer.disconnect();
    section.toggleAttribute(FINAL_ATTRIBUTE, false);
  };
}
