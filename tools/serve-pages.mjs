#!/usr/bin/env node
/**
 * Serves the built site (dist/client) the way GitHub Pages does, for previews
 * and the proof harness:
 *
 *   /x/   serves x/index.html
 *   /x    301 to /x/ when x/index.html exists (the query is kept)
 *   a file is served as is, with its MIME type
 *   anything else gets 404.html with status 404
 *
 * Paths are case-sensitive, as on GitHub Pages: /About/China/ is a 404 even on a
 * Windows or macOS disk, whose file system would find about/china/ for it.
 *
 * Environment: PORT (default 4399). It listens on 127.0.0.1 only.
 */

import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../dist/client', import.meta.url)));
const REAL_ROOT = await realpath(ROOT);
const PORT = Number(process.env.PORT ?? 4399);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

/** The file under ROOT for a URL path, or null if the path leaves ROOT. */
function fileFor(pathname) {
  const file = resolve(join(ROOT, pathname));
  return file === ROOT || file.startsWith(ROOT + sep) ? file : null;
}

/** True if `file` exists under exactly this spelling: its real path under the root reads the same, letter for letter. */
async function isFile(file) {
  try {
    if (!(await stat(file)).isFile()) return false;
    return relative(REAL_ROOT, await realpath(file)) === relative(ROOT, file);
  } catch {
    return false;
  }
}

function send(req, res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

async function notFound(req, res) {
  const page = join(ROOT, '404.html');
  if (await isFile(page)) return send(req, res, 404, page);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found\n');
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  const file = fileFor(pathname);
  if (!file) return notFound(req, res);

  if (pathname.endsWith('/')) {
    const index = join(file, 'index.html');
    return (await isFile(index)) ? send(req, res, 200, index) : notFound(req, res);
  }
  if (await isFile(file)) return send(req, res, 200, file);
  if (await isFile(join(file, 'index.html'))) {
    res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
    return res.end();
  }
  return notFound(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}/`);
});
