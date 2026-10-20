import type { JSX } from 'react';
import hero from '~/assets/renders/compass-hero.webp';

/** The render's size in pixels, so the browser reserves its box before it loads. */
const WIDTH = 1600;
const HEIGHT = 900;

/**
 * The first paint: the hero render, as a plain image behind the canvas. It is in the
 * prerendered HTML, so the page has its picture before any script runs, and it is what
 * stays visible when 3D is off or WebGL is missing. The canvas covers it once it draws.
 */
export function Poster(): JSX.Element {
  return (
    <div className="poster">
      <img src={hero} alt="" width={WIDTH} height={HEIGHT} fetchPriority="high" decoding="async" />
    </div>
  );
}
