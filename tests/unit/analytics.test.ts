import { describe, expect, it } from 'vitest';
import { cspFor } from '../../tools/build/csp.mjs';
import { CF_BEACON_SRC, cfBeacon } from '../../src/seo/analytics';

describe('the Cloudflare Web Analytics beacon', () => {
  it('is left out without a site token, so no analytics script loads', () => {
    expect(cfBeacon(undefined)).toBeNull();
    expect(cfBeacon('')).toBeNull();
    expect(cfBeacon('   ')).toBeNull();
  });

  it('loads Cloudflare’s beacon with the token as its data-cf-beacon, as the Astro site did', () => {
    expect(cfBeacon(' 0123abcd ')).toEqual({ src: 'https://static.cloudflareinsights.com/beacon.min.js', 'data-cf-beacon': '{"token":"0123abcd"}' });
  });

  it('comes from a host the policy allows for scripts, over https, and reports to one it allows to connect', () => {
    const policy = cspFor('<html></html>');
    const directive = (name: string) => policy.split('; ').find((part) => part.startsWith(`${name} `)) ?? '';
    expect(new URL(CF_BEACON_SRC).protocol).toBe('https:');
    expect(directive('script-src').split(' ')).toContain(new URL(CF_BEACON_SRC).origin);
    expect(directive('connect-src').split(' ')).toContain('https://cloudflareinsights.com');
  });
});
