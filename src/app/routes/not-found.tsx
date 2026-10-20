import type { MetaFunction } from 'react-router';
import { localeFromPath } from '~/i18n/locale';
import { notFoundMeta } from '~/seo/notFound';
import { NotFoundPage } from '~/ui/NotFoundPage';
import type { RouteHandle } from '../handle';

// Any path no other route matches. The build serves this route's page (the SPA fallback) as
// 404.html for every unknown URL, so it is never indexed.
export const meta: MetaFunction = ({ location }) => notFoundMeta(localeFromPath(location.pathname));

export const handle: RouteHandle = { scene: null };

export default NotFoundPage;
