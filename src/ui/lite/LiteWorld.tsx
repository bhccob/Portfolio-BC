import type { CSSProperties, JSX } from 'react';
import { Link } from 'react-router';
import { DIRECTIONS } from '~/data/directions';
import { PAGES, type PageId } from '~/data/pages';
import { useTranslator } from '~/i18n/useTranslator';
import { LiteSection } from './LiteSection';

/** The three countries of the compass, each with its line and a link to its page. */
export function LiteWorld(): JSX.Element {
  const i18n = useTranslator();
  const { t } = i18n;

  return (
    <LiteSection id="world" title={t.nav.about}>
      <ul className="lite-list">
        {DIRECTIONS.flatMap((direction) => {
          if (!direction.country) return [];
          const page: PageId = `about-${direction.country}`;
          const country = t.needle.countries[direction.country];
          return [
            // The country's own accent marks its entry, as it marks its arm and its page.
            <li key={direction.country} style={{ '--accent': direction.accent } as CSSProperties}>
              <h3 className="lite-item-title">
                <Link to={i18n.path(PAGES[page])}>{country.name}</Link>
              </h3>
              <p>{country.teaser}</p>
            </li>,
          ];
        })}
      </ul>
    </LiteSection>
  );
}
