import { describe, expect, it } from 'vitest';
import { profile } from '../../src/data/profile';
import {
  COOLDOWN_MS,
  MESSAGE_MAX,
  MIN_FILL_MS,
  WEB3FORMS_ENDPOINT,
  contactPayload,
  coolingDown,
  fieldIsValid,
  invalidFields,
  looksAutomated,
} from '../../src/ui/contactSubmit';

const fields = { name: 'Ada Lovelace', email: 'ada@example.com', message: 'Hello Bob, I would like to talk about a project.' };

describe('contactPayload with an access key', () => {
  it('posts to Web3Forms: the key and the three fields are in the body', () => {
    const payload = contactPayload(fields, 'k');
    expect(payload.mode).toBe('web3forms');
    if (payload.mode !== 'web3forms') throw new Error('unreachable');
    expect(payload.body.access_key).toBe('k');
    expect(payload.body.name).toBe(fields.name);
    expect(payload.body.email).toBe(fields.email);
    expect(payload.body.message).toBe(fields.message);
  });

  it('sends only strings, so the body can be JSON', () => {
    const payload = contactPayload(fields, 'k');
    if (payload.mode !== 'web3forms') throw new Error('unreachable');
    for (const value of Object.values(payload.body)) expect(typeof value).toBe('string');
  });

  it('names the site as the sender and gives a message without a subject the default subject', () => {
    const payload = contactPayload(fields, 'k');
    if (payload.mode !== 'web3forms') throw new Error('unreachable');
    expect(payload.body.from_name).toBe('bhccob.me portfolio');
    expect(payload.body.subject).toBe('Portfolio: New message');
  });

  it('puts the visitor’s own subject after the site prefix, and trims every field', () => {
    const payload = contactPayload({ name: '  Ada  ', email: ' ada@example.com ', message: `  ${fields.message}  `, subject: '  A question  ' }, 'k');
    if (payload.mode !== 'web3forms') throw new Error('unreachable');
    expect(payload.body.subject).toBe('Portfolio: A question');
    expect(payload.body.name).toBe('Ada');
    expect(payload.body.email).toBe('ada@example.com');
    expect(payload.body.message).toBe(fields.message);
  });

  it('knows the endpoint the policy allows', () => {
    expect(WEB3FORMS_ENDPOINT).toBe('https://api.web3forms.com/submit');
  });
});

describe('contactPayload without an access key', () => {
  it('falls back to the visitor’s email app: a mailto link to Bob', () => {
    const payload = contactPayload(fields, undefined);
    expect(payload.mode).toBe('mailto');
    if (payload.mode !== 'mailto') throw new Error('unreachable');
    expect(payload.href.startsWith('mailto:bhccob@gmail.com?subject=')).toBe(true);
    expect(payload.href.startsWith(`mailto:${profile.email}?subject=`)).toBe(true);
  });

  it('carries the encoded message, then who it is from, in the body', () => {
    const payload = contactPayload(fields, undefined);
    if (payload.mode !== 'mailto') throw new Error('unreachable');
    expect(payload.href).toContain(encodeURIComponent(fields.message));
    const body = new URL(payload.href).searchParams.get('body');
    expect(body).toBe(`${fields.message}\n\n— ${fields.name} (${fields.email})`);
  });

  it('encodes the subject too, so a subject with & or # cannot cut the link short', () => {
    const payload = contactPayload({ ...fields, subject: 'Q&A #1' }, undefined);
    if (payload.mode !== 'mailto') throw new Error('unreachable');
    expect(payload.href).toContain(`subject=${encodeURIComponent('Portfolio: Q&A #1')}`);
    expect(new URL(payload.href).searchParams.get('subject')).toBe('Portfolio: Q&A #1');
  });

  it('treats an empty or blank key as no key', () => {
    expect(contactPayload(fields, '').mode).toBe('mailto');
    expect(contactPayload(fields, '   ').mode).toBe('mailto');
  });
});

describe('invalidFields', () => {
  it('accepts a name of two letters, a plausible address and a message of ten characters', () => {
    expect(invalidFields({ name: 'Al', email: 'a@b.nl', message: '0123456789' })).toEqual([]);
  });

  it('lists what is wrong in the order of the form', () => {
    expect(invalidFields({ name: 'A', email: 'not an address', message: 'short' })).toEqual(['name', 'email', 'message']);
    expect(invalidFields({ ...fields, email: 'ada@example' })).toEqual(['email']);
    expect(invalidFields({ ...fields, message: '123456789' })).toEqual(['message']);
  });

  it('judges the text without the spaces around it', () => {
    expect(invalidFields({ name: ' A ', email: fields.email, message: '          ' })).toEqual(['name', 'message']);
  });

  it('judges a single field the same way', () => {
    expect(fieldIsValid('name', 'Al')).toBe(true);
    expect(fieldIsValid('name', 'A')).toBe(false);
    expect(fieldIsValid('email', 'a@b.nl')).toBe(true);
    expect(fieldIsValid('email', 'a@b')).toBe(false);
    expect(fieldIsValid('message', '0123456789')).toBe(true);
    expect(fieldIsValid('message', '012345678')).toBe(false);
    expect(MESSAGE_MAX).toBe(3000);
  });
});

describe('the guards against scripts', () => {
  it('takes a ticked honeypot, or a form filled in under three seconds, for a script', () => {
    expect(MIN_FILL_MS).toBe(3000);
    expect(looksAutomated({ honeypot: true, elapsedMs: 60_000 })).toBe(true);
    expect(looksAutomated({ honeypot: false, elapsedMs: 2_999 })).toBe(true);
    expect(looksAutomated({ honeypot: false, elapsedMs: 3_000 })).toBe(false);
  });

  it('asks the visitor to wait a minute after a message has gone out', () => {
    expect(COOLDOWN_MS).toBe(60_000);
    expect(coolingDown(1_000_000, 1_000_000 + 59_999)).toBe(true);
    expect(coolingDown(1_000_000, 1_000_000 + 60_000)).toBe(false);
    expect(coolingDown(0, 1_000_000)).toBe(false); // never sent
  });
});
