// Redirect pages for the URLs the site used to have (src/data/redirects.ts).
//
// GitHub Pages cannot send a 301, so each old URL is a small static page that
// forwards the visitor with <meta http-equiv="refresh">, names its target in a
// canonical link, and stays out of search results. They are generated, never
// kept in public/, and take the same policy as every other page (postbuild.mjs).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { redirects } from '../../src/data/redirects.ts';

const ORIGIN = 'https://bhccob.com';

const WORDS = {
  nl: { title: 'Verplaatst | Bob Chung', moved: 'Deze pagina is verplaatst naar' },
  en: { title: 'Moved | Bob Chung', moved: 'This page has moved to' },
};

const STYLE = 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1c1030;color:#f4ecda;font:16px/1.5 system-ui,sans-serif}a{color:#ffcf33}';

/** @param {string} text */
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The page for one redirect. It still holds the `__CSP__` placeholder.
 * @param {{ from: string; to: string; locale: 'nl' | 'en' }} redirect
 * @returns {string}
 */
export function stubHtml({ to, locale }) {
  const words = WORDS[locale];
  const target = escapeHtml(to);
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="__CSP__" />
  <title>${words.title}</title>
  <meta name="robots" content="noindex, follow" />
  <link rel="canonical" href="${ORIGIN}${target}" />
  <meta http-equiv="refresh" content="0; url=${target}" />
  <style>${STYLE}</style>
</head>
<body>
  <p>${words.moved} <a href="${target}">bhccob.com${target}</a>.</p>
</body>
</html>
`;
}

/**
 * Where an old URL's page goes, relative to the site folder: a folder URL gets
 * its index.html, a legacy file keeps its name.
 * @param {string} from
 * @returns {string}
 */
export function stubFile(from) {
  const relative = from.replace(/^\//, '');
  return relative.endsWith('/') ? `${relative}index.html` : relative;
}

/**
 * Writes every redirect page under `dist`. A page that already exists is a
 * real page, and a redirect must never replace one: that stops the build.
 * @param {string} dist
 * @returns {Promise<number>} how many pages it wrote
 */
export async function writeRedirects(dist) {
  for (const redirect of redirects) {
    const file = join(dist, stubFile(redirect.from));
    await mkdir(dirname(file), { recursive: true });
    // Written only if no file is there (flag "wx"), in the one call, so nothing can come between a check and the write.
    await writeFile(file, stubHtml(redirect), { encoding: 'utf8', flag: 'wx' }).catch((error) => {
      if (error?.code === 'EEXIST') throw new Error(`redirect ${redirect.from} would overwrite a built page (${file})`);
      throw error;
    });
  }
  return redirects.length;
}
