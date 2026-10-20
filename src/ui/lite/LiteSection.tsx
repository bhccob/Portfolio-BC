import type { JSX, ReactNode } from 'react';
import { Markup } from '../Markup';

/**
 * One section of the Lite page: a landmark named by its own heading. The `id` is the address of the
 * section (`/lite/#career`), so it never changes once a link points at it. The title may carry `<em>`.
 */
export function LiteSection({ id, title, children }: { id: string; title: string; children: ReactNode }): JSX.Element {
  return (
    <section id={id} className="lite-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="lite-heading">
        <Markup text={title} />
      </h2>
      {children}
    </section>
  );
}
