import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { nl } from '../../src/i18n/nl';
import { Markup, stripMarkup } from '../../src/ui/Markup';

const render = (text: string): string => renderToStaticMarkup(createElement(Markup, { text }));

describe('Markup', () => {
  it('turns <em> in a piece of copy into an element and leaves the rest as text', () => {
    expect(render('Off <em>duty.</em>')).toBe('Off <em>duty.</em>');
    expect(render('Current build <em>& roadmap.</em>')).toBe('Current build <em>&amp; roadmap.</em>');
  });

  it('shows text with no markup as it is, and escapes what looks like a tag', () => {
    expect(render('Questions')).toBe('Questions');
    expect(render('a <script>x</script> b')).toBe('a &lt;script&gt;x&lt;/script&gt; b');
  });

  it('handles more than one <em>', () => {
    expect(render('<em>a</em> b <em>c</em>')).toBe('<em>a</em> b <em>c</em>');
  });
});

describe('stripMarkup', () => {
  it('is the copy without its tags, the form a heading is checked against', () => {
    expect(stripMarkup('Off <em>duty.</em>')).toBe('Off duty.');
    expect(stripMarkup('a <span data-age>{age}</span>-year-old')).toBe('a {age}-year-old');
  });

  // GitHub's code scanning (js/incomplete-multi-character-sanitization): one pass can leave a tag that two halves made.
  it('leaves no tag and no angle bracket, however the tags are nested', () => {
    for (const text of ['<scr<script>ipt>alert(1)</script>', '<<em>em>x<</em>/em>', 'a <b', 'b> c']) {
      expect(stripMarkup(text), text).not.toMatch(/[<>]/);
    }
    // The words stay; only the tags and a stray bracket go.
    expect(stripMarkup('Off <em>duty.</em> <b')).toBe('Off duty. b');
  });

  it('leaves the titles of the Lite sections as plain sentences in both languages', () => {
    for (const t of [en, nl]) {
      for (const title of [t.about.title, t.skills.title, t.career.title, t.life.title, t.cta.title]) {
        expect(stripMarkup(title)).not.toMatch(/[<>]/);
        expect(stripMarkup(title).length).toBeGreaterThan(3);
      }
    }
  });
});
