import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { applyCsp, cspFor } from '../../tools/build/csp.mjs';

const sha256 = (text: string) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
const META = '<meta http-equiv="Content-Security-Policy" content="__CSP__">';
const page = (head: string, body = '') => `<!doctype html><html><head><meta charset="utf-8">${META}${head}</head><body>${body}</body></html>`;

describe('cspFor', () => {
  it('hashes an inline script', () => {
    expect(cspFor('<script>a()</script>')).toContain(sha256('a()'));
  });

  it('hashes the exact text, whitespace included', () => {
    expect(cspFor('<script type="module" async="">\nimport "/x.js";\n</script>')).toContain(sha256('\nimport "/x.js";\n'));
  });

  it('hashes the text the browser parses: CRLF becomes LF', () => {
    expect(cspFor('<script>a();\r\nb();\rc();</script>')).toContain(sha256('a();\nb();\nc();'));
  });

  // GitHub's code scanning (js/bad-tag-filter): a browser ends a script at </script followed by anything up to ">".
  it('hashes a script whose end tag has more in it, as a browser ends it', () => {
    expect(cspFor('<script>a()</script >')).toContain(sha256('a()'));
    expect(cspFor('<script>b()</SCRIPT\n foo="bar">')).toContain(sha256('b()'));
    expect(cspFor('<style>p{}</style\tx>')).toContain(sha256('p{}'));
  });

  it('hashes each script once, however often it appears', () => {
    const policy = cspFor('<script>a()</script><script>a()</script><script>b()</script>');
    expect(policy.split(sha256('a()')).length - 1).toBe(1);
    expect(policy).toContain(sha256('b()'));
  });

  it('ignores JSON-LD', () => {
    const policy = cspFor('<script type="application/ld+json">{"@type":"Person"}</script>');
    expect(policy).not.toContain('sha256-');
    expect(policy).toContain("script-src 'self' https://static.cloudflareinsights.com;");
  });

  it('ignores a script that loads a file', () => {
    expect(cspFor('<script type="module" src="/a.js"></script>')).not.toContain('sha256-');
  });

  it('hashes inline styles into style-src', () => {
    const policy = cspFor('<style>body{margin:0}</style>');
    expect(policy).toContain(`style-src 'self' ${sha256('body{margin:0}')};`);
    expect(policy).not.toContain(`script-src 'self' https://static.cloudflareinsights.com ${sha256('body{margin:0}')}`);
  });

  it('is the policy the site ships, and nothing more', () => {
    expect(cspFor('<p>no scripts</p>')).toBe(
      [
        "default-src 'self'",
        "script-src 'self' https://static.cloudflareinsights.com",
        "style-src 'self'",
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "media-src 'self'",
        "connect-src 'self' https://api.web3forms.com https://cloudflareinsights.com blob:",
        "form-action 'self' https://api.web3forms.com",
        "worker-src 'none'",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        'upgrade-insecure-requests',
      ].join('; '),
    );
  });

  it("allows blob: only where three's GLTFLoader reads the GLB's embedded images, and never for scripts", () => {
    // GLTFLoader turns each embedded image into a blob: URL and loads it: by fetch (ImageBitmapLoader, connect-src) where
    // the browser has createImageBitmap, else by an <img> (TextureLoader, img-src).
    const directives = cspFor('<p>no scripts</p>').split('; ');
    const withBlob = directives.filter((d) => d.split(' ').includes('blob:')).map((d) => d.split(' ')[0]);
    expect(withBlob).toEqual(['img-src', 'connect-src']);
    expect(directives.find((d) => d.startsWith('script-src'))).not.toContain('blob:');
    expect(directives).toContain("worker-src 'none'");
  });

  it('never allows inline or eval scripts', () => {
    const policy = cspFor('<script>a()</script>');
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("'wasm-unsafe-eval'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });
});

describe('applyCsp', () => {
  it('replaces the placeholder exactly once', () => {
    const out = applyCsp(page('', '<script>a()</script>'));
    expect(out).not.toContain('__CSP__');
    expect(out.split('Content-Security-Policy').length - 1).toBe(1);
    expect(out).toContain(sha256('a()'));
    expect(out).toContain("worker-src 'none'");
  });

  it('keeps the rest of the page as it was', () => {
    const html = page('<title>t</title>', '<p>$& and $1</p>');
    expect(applyCsp(html).replace(/content="[^"]*"/, 'content="__CSP__"')).toBe(html);
  });

  it('throws when a script comes before the policy', () => {
    expect(() => applyCsp(`<script>x</script>${META}`)).toThrow(/script/i);
  });

  it('allows a viewport meta before the policy', () => {
    expect(() => applyCsp(`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width">${META}</head><body></body>`)).not.toThrow();
  });

  it('throws when the page has no placeholder', () => {
    expect(() => applyCsp('<head></head><body><script>a()</script></body>')).toThrow(/__CSP__/);
  });

  it('throws on a second placeholder', () => {
    expect(() => applyCsp(page(META))).toThrow(/__CSP__/);
  });

  it('throws on an inline event handler', () => {
    expect(() => applyCsp(page('', '<a onclick="x">y</a>'))).toThrow(/onclick/);
    expect(() => applyCsp(page('', '<button\n  onMouseOver = "x">y</button>'))).toThrow(/onMouseOver/i);
  });

  // GitHub's code scanning (js/incomplete-multi-character-sanitization): a comment taken out must not join what was
  // round it into a new comment that hides a live handler (a browser ends "<!<!-- -->" at its first ">").
  it('finds a handler that a comment taken out would have hidden', () => {
    expect(() => applyCsp(page('', '<!<!-- -->-- <a onclick="x">y</a> -->'))).toThrow(/onclick/);
    expect(() => applyCsp(page('', '<!-- <a onclick="x">y</a> -->'))).not.toThrow();
  });

  it('throws on a javascript: URL', () => {
    expect(() => applyCsp(page('', '<a href="javascript:void(0)">y</a>'))).toThrow(/javascript:/);
  });

  it('lets words that only look like handlers or javascript: URLs through', () => {
    const body = '<p>JavaScript: the language. one=1 and onion=2</p><a href="/x" data-once="1" title="onclick=">ok</a>';
    expect(() => applyCsp(page('', body))).not.toThrow();
  });

  it('does not take script text for markup', () => {
    expect(() => applyCsp(page('', '<script>const t = "<a onclick=x>"</script>'))).not.toThrow();
  });
});
