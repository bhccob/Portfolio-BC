/**
 * Cloudflare Web Analytics' beacon: counts visits without cookies, so no consent banner is needed. The policy
 * (tools/build/csp.mjs) allows its script host in `script-src` and its report host in `connect-src`.
 */
export const CF_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/**
 * The beacon's script attributes for the site's token (`PUBLIC_CF_ANALYTICS_TOKEN`, read at build time), or null
 * without one: then no analytics script loads at all. It is a script with a `src`, so the policy needs no hash for it.
 */
export function cfBeacon(token: string | undefined): { src: string; 'data-cf-beacon': string } | null {
  const site = token?.trim();
  return site ? { src: CF_BEACON_SRC, 'data-cf-beacon': JSON.stringify({ token: site }) } : null;
}
