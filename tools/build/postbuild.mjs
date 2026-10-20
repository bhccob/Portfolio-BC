// Runs after `react-router build` (npm run build): turns dist/client into the
// site GitHub Pages serves. In order:
//
//   1. __spa-fallback.html becomes 404.html, marked noindex
//   2. a redirect page for every old URL (src/data/redirects.ts)
//   3. sitemap-index.xml and sitemap-0.xml
//   4. og.jpg, the share image
//   5. the Content-Security-Policy, written into every .html file
//   6. CNAME
//
// It imports src/data/*.ts, so it runs under tsx: `tsx tools/build/postbuild.mjs`.
import { copyFile, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCsp } from './csp.mjs';
import { writeOg } from './og.mjs';
import { writeRedirects } from './redirects.mjs';
import { writeSitemap } from './sitemap.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DIST = join(ROOT, 'dist', 'client');

/** @param {string} dir @returns {Promise<string[]>} every .html file under `dir` */
async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith('.html')) found.push(path);
  }
  return found;
}

/** React Router's SPA fallback is the page GitHub Pages serves for an unknown URL; it must not be indexed. */
async function makeNotFound() {
  const from = join(DIST, '__spa-fallback.html');
  const to = join(DIST, '404.html');
  await rename(from, to).catch((error) => {
    throw error?.code === 'ENOENT' ? new Error('dist/client/__spa-fallback.html is missing: run `react-router build` first (ssr must be false)') : error;
  });
  const html = await readFile(to, 'utf8');
  if (!html.includes('</head>')) throw new Error('404.html has no </head> to put the noindex meta in');
  await writeFile(to, html.replace('</head>', '<meta name="robots" content="noindex"/></head>'), 'utf8');
}

await stat(DIST).catch(() => {
  throw new Error('dist/client does not exist: run `react-router build` first');
});

await makeNotFound();
const stubs = await writeRedirects(DIST);
const listed = await writeSitemap(DIST);
const ogBytes = await writeOg(DIST);

const pages = await htmlFiles(DIST);
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  try {
    await writeFile(file, applyCsp(html), 'utf8');
  } catch (error) {
    throw new Error(`${file.slice(DIST.length + 1)}: ${error instanceof Error ? error.message : error}`);
  }
}

await copyFile(join(ROOT, 'CNAME'), join(DIST, 'CNAME'));

console.log(
  `postbuild: 404.html, ${stubs} redirect pages, sitemap (${listed} pages), og.jpg (${Math.round(ogBytes / 1024)} KB), CSP on ${pages.length} pages, CNAME`,
);
