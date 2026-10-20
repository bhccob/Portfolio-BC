import type { JSX } from 'react';
import portrait from '~/assets/portrait.jpg';
import { profile } from '~/data/profile';
import { useTranslator } from '~/i18n/useTranslator';
import { stripMarkup } from '../Markup';
import { LiteSection } from './LiteSection';

/** The portrait file's size in pixels (tests/unit/lite.test.ts compares it with the file), so the browser reserves its box before it loads. */
export const PORTRAIT_SIZE = { width: 572, height: 1024 } as const;

/**
 * Bob's age. It is worked out when the page is built and again in the browser, so on his birthday the two
 * can differ for a day; the page keeps the built number rather than treating that as an error.
 */
function Age(): JSX.Element {
  return <span suppressHydrationWarning>{profile.ageOn()}</span>;
}

/** About: the real portrait, the lead and the text, the quote, the facts, the origin route and the rule he keeps. */
export function LiteAbout(): JSX.Element {
  const { t } = useTranslator();
  const a = t.about;
  const facts = [
    { label: a.facts.age, value: <Age /> },
    { label: a.facts.born, value: a.facts.bornValue },
    { label: a.facts.heritage, value: a.facts.heritageValue },
    { label: a.facts.based, value: a.facts.basedValue },
    { label: a.facts.studying, value: a.facts.studyingValue },
  ];
  const route = [
    { label: a.route.heritage, place: a.route.heritagePlace },
    { label: a.route.born, place: a.route.bornPlace },
    { label: a.route.now, place: a.route.nowPlace },
  ];
  // The lead holds the age as `<span data-age>{age}</span>`: shown as the same number the facts show.
  const [beforeAge, afterAge] = stripMarkup(a.lead).split('{age}');

  return (
    <LiteSection id="about" title={a.title}>
      <figure className="portrait">
        <img src={portrait} alt={a.portraitAlt} width={PORTRAIT_SIZE.width} height={PORTRAIT_SIZE.height} loading="lazy" decoding="async" />
        <figcaption className="label">{`${profile.name} · ${a.facts.basedValue}`}</figcaption>
      </figure>

      <p className="lead">
        {beforeAge}
        <Age />
        {afterAge}
      </p>
      <p>{a.body}</p>

      <blockquote className="quote">
        <p>{a.quote}</p>
      </blockquote>

      <dl className="facts">
        {facts.map(({ label, value }) => (
          <div key={label}>
            <dt className="label">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <ol className="origin" aria-label={a.route.label}>
        {route.map(({ label, place }) => (
          <li key={label}>
            <span className="label">{label}</span>
            <span>{place}</span>
          </li>
        ))}
      </ol>

      <p className="thought">
        <span className="label">{a.thoughtLabel}</span>
        <span>{a.thought}</span>
      </p>
    </LiteSection>
  );
}
