import type { APIRoute } from 'astro';
import { locales, Translator, type Locale } from '../../../i18n/Translator';
import { projects } from '../../../data/projects';
import { projectImage } from '../../../og/ShareImage';

// One share image per project and language, rendered at build time: /og/nl/cookies-clicker.png.
export function getStaticPaths() {
  return locales.flatMap((locale) => projects.all().map((project) => ({ params: { locale, slug: project.slug } })));
}

export const GET: APIRoute = async ({ params }) => {
  const locale = params.locale as Locale;
  const project = projects.bySlug(params.slug!)!;
  const copy = project.copy(locale);
  const { t } = new Translator(locale);
  const png = await projectImage({
    title: project.title,
    label: `${project.primaryCategory.copy(locale).title} · ${t.work.project} ${project.label}`,
    type: copy.type,
    screenshot: project.imageFile,
    focus: project.crop?.position
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
