import type { APIRoute } from 'astro';
import { siteImage } from '../og/ShareImage';

// The site-wide share image (home, contact, 404), rendered at build time.
export const GET: APIRoute = async () => {
  const png = await siteImage({ role: 'Student software engineer · Rotterdam, NL', portrait: 'src/assets/portrait.jpg' });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
