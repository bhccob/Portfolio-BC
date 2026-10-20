// The site's Content-Security-Policy, written into a <meta> tag after the build.
//
// GitHub Pages cannot send response headers, so every page carries its policy
// as <meta http-equiv="Content-Security-Policy">. The root layout renders that
// tag with the placeholder `__CSP__` (src/app/root.tsx); applyCsp swaps in the
// policy, which lists the sha256 of every inline script and style the page
// holds. No page may use 'unsafe-inline' for scripts, 'unsafe-eval' or
// 'wasm-unsafe-eval'.
import { createHash } from 'node:crypto';

export const PLACEHOLDER = '__CSP__';

const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const STYLE_BLOCK = /<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi;
const JSON_LD = /\btype\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json(?=[\s/>]|$))/i;
const HAS_SRC = /\bsrc\s*=/i;

/**
 * The source of a CSP hash. The browser hashes the text it parsed, and the HTML
 * parser turns every CRLF and lone CR into LF first.
 * @param {string} text
 */
function sha256(text) {
  const parsed = text.replace(/\r\n?/g, '\n');
  return `'sha256-${createHash('sha256').update(parsed, 'utf8').digest('base64')}'`;
}

/**
 * The hashes of a page's inline blocks of one kind, each once, in page order.
 * @param {string} html
 * @param {RegExp} block
 * @param {(attributes: string) => boolean} skip
 */
function inlineHashes(html, block, skip) {
  const hashes = new Set();
  for (const [, attributes, text] of html.matchAll(block)) {
    if (!skip(attributes)) hashes.add(sha256(text));
  }
  return [...hashes];
}

/**
 * The policy for one page.
 * @param {string} html
 * @returns {string}
 */
export function cspFor(html) {
  // JSON-LD is data, not script, so the policy never sees it; a script with a
  // src loads a file the 'self' source already allows.
  const scripts = inlineHashes(html, SCRIPT_BLOCK, (attributes) => JSON_LD.test(attributes) || HAS_SRC.test(attributes));
  const styles = inlineHashes(html, STYLE_BLOCK, () => false);

  return [
    "default-src 'self'",
    ["script-src 'self' https://static.cloudflareinsights.com", ...scripts].join(' '),
    ["style-src 'self'", ...styles].join(' '),
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'self'",
    "connect-src 'self' https://api.web3forms.com https://cloudflareinsights.com",
    "form-action 'self' https://api.web3forms.com",
    "worker-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

const TAG = /<([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/**
 * The first inline event handler or `javascript:` URL in the page's markup, or
 * null. Script and style text and comments are not markup, so they are skipped.
 * @param {string} html
 * @returns {string | null}
 */
function unsafeMarkup(html) {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, '$1$3');
  for (const [, tag, attributes] of markup.matchAll(TAG)) {
    for (const [, name, double, single, bare] of attributes.matchAll(ATTRIBUTE)) {
      if (/^on[a-z]+$/i.test(name)) return `the event handler ${name}= on <${tag}>`;
      const value = double ?? single ?? bare ?? '';
      // eslint-disable-next-line no-control-regex -- browsers drop leading whitespace and control characters from a URL
      if (/^[\s\u0000-\u001f]*javascript:/i.test(value)) return `a javascript: URL in ${name}= on <${tag}>`;
    }
  }
  return null;
}

/**
 * Fills the page's `__CSP__` placeholder with its policy. It refuses a page
 * the policy cannot protect: one without exactly one placeholder, one that runs
 * a script before the policy is in force, or one with inline handlers.
 * @param {string} html
 * @returns {string}
 */
export function applyCsp(html) {
  const at = html.indexOf(PLACEHOLDER);
  if (at === -1) throw new Error(`applyCsp: the page has no ${PLACEHOLDER} placeholder`);
  if (html.indexOf(PLACEHOLDER, at + PLACEHOLDER.length) !== -1) throw new Error(`applyCsp: the page has more than one ${PLACEHOLDER}`);

  // The policy only governs what loads after its tag, so no <script> may come first.
  const script = html.search(/<script\b/i);
  if (script !== -1 && script < at) throw new Error(`applyCsp: a <script> comes before the ${PLACEHOLDER} meta`);

  const unsafe = unsafeMarkup(html);
  if (unsafe) throw new Error(`applyCsp: the page has ${unsafe}, which the policy would block`);

  return html.slice(0, at) + cspFor(html) + html.slice(at + PLACEHOLDER.length);
}
