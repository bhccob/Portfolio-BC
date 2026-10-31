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
 * as. The tags are taken out again until none is left, so none can stay that two halves round a removed one made; then
 * a stray angle bracket goes too.
 */
export function stripMarkup(text: string): string {
  let plain = text;
  let before: string;
  do {
    before = plain;
    plain = plain.replace(/<[^>]*>/g, '');
  } while (plain !== before);
  return plain.replace(/[<>]/g, '');
}
