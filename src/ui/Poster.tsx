import type { JSX } from 'react';

/**
 * The first paint: a dark panel behind the canvas, the scene's own night with a faint violet glow (src/styles/base.css,
 * `.poster`), so the page opens as dark as the loader that fades in over it and nothing bright shows first. It is in
 * the prerendered HTML and loads nothing, and it is what stays when 3D is off or WebGL is missing, under the page's
 * scrim on a page of text. The canvas covers it once the loader can show.
 */
export function Poster(): JSX.Element {
  return <div className="poster" />;
}
