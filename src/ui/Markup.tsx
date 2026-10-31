import type { JSX } from 'react';

/**
 * A piece of copy whose only markup is `<em>…</em>` (the dictionaries' headings: "Off <em>duty.</em>"),
 * as React elements. It builds no HTML from the string, so the copy is shown as text whatever it holds.
 */
export function Markup({ text }: { text: string }): JSX.Element {
  // Splitting on a capture group puts what was inside each <em> at the odd places.
  const parts = text.split(/<em>(.*?)<\/em>/);
  return <>{parts.map((part, index) => (index % 2 === 1 ? <em key={index}>{part}</em> : part))}</>;
}

/**
 * The copy without any tag: the plain sentence a heading reads as, and what a longer text with a `<span>` in it is shown
 * as. A stray angle bracket goes too, so no tag can be left that two halves round a removed one made.
 */
export function stripMarkup(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
}
