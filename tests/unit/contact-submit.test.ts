import { afterEach, describe, expect, it, vi } from 'vitest';
import { profile } from '../../src/data/profile';
import {
  COOLDOWN_MS,
  MESSAGE_MAX,
  MIN_FILL_MS,
  SEND_TIMEOUT_MS,
  WEB3FORMS_ENDPOINT,
  contactPayload,
  coolingDown,
  fieldIsValid,
  fillWait,
  invalidFields,
  looksAutomated,
  sendToWeb3Forms,
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
  it('takes a ticked honeypot for a script, however long the form took', () => {
    expect(looksAutomated({ honeypot: true })).toBe(true);
    expect(looksAutomated({ honeypot: false })).toBe(false);
  });

  it('never drops a message for being quick: one sent within three seconds of the page opening waits out the rest', () => {
    expect(MIN_FILL_MS).toBe(3000);
    expect(fillWait(0)).toBe(3000);
    expect(fillWait(1_200)).toBe(1_800);
    expect(fillWait(2_999)).toBe(1);
    expect(fillWait(3_000)).toBe(0);
    expect(fillWait(60_000)).toBe(0);
  });

  it('waits no longer than the three seconds, whatever the clock says', () => {
    expect(fillWait(-500)).toBe(3000);
    expect(fillWait(Number.NaN)).toBe(3000);
  });

  it('asks the visitor to wait a minute after a message has gone out', () => {
    expect(COOLDOWN_MS).toBe(60_000);
    expect(coolingDown(1_000_000, 1_000_000 + 59_999)).toBe(true);
    expect(coolingDown(1_000_000, 1_000_000 + 60_000)).toBe(false);
    expect(coolingDown(0, 1_000_000)).toBe(false); // never sent
  });
});

describe('sendToWeb3Forms', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const body = { access_key: 'k', name: 'Ada', email: 'ada@example.com', message: 'Hello Bob, a message.' };
  const answer = (init: { ok: boolean; status: number; json: () => Promise<unknown> }) => vi.fn(async () => init as unknown as Response);
  /** A fetch that never answers on its own and fails the way the browser's does when its signal aborts. */
  const silent = () =>
    vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
        }),
    );

  it('waits no longer than fifteen seconds for an answer', () => {
    expect(SEND_TIMEOUT_MS).toBe(15_000);
  });

  it('posts the body as JSON to the endpoint and resolves when Web3Forms says success', async () => {
    const fetchImpl = answer({ ok: true, status: 200, json: async () => ({ success: true }) });
    await expect(sendToWeb3Forms(body, { fetchImpl })).resolves.toBeUndefined();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(WEB3FORMS_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual(body);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('fails on an error status, on success: false and on an answer that is not JSON', async () => {
    await expect(sendToWeb3Forms(body, { fetchImpl: answer({ ok: false, status: 500, json: async () => ({ success: false }) }) })).rejects.toThrow('Web3Forms answered 500');
    await expect(sendToWeb3Forms(body, { fetchImpl: answer({ ok: true, status: 200, json: async () => ({ success: false }) }) })).rejects.toThrow('Web3Forms answered 200');
    const notJson = answer({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('not JSON');
      },
    });
    await expect(sendToWeb3Forms(body, { fetchImpl: notJson })).rejects.toThrow('Web3Forms answered 200');
  });

  it('fails when the network does', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(sendToWeb3Forms(body, { fetchImpl })).rejects.toThrow('Failed to fetch');
  });

  it('gives up when nothing answers in time: the request is aborted at the timeout and not before', async () => {
    vi.useFakeTimers();
    const fetchImpl = silent();
    let outcome: 'pending' | 'resolved' | 'rejected' = 'pending';
    const sending = sendToWeb3Forms(body, { fetchImpl, timeoutMs: 1_000 }).then(
      () => (outcome = 'resolved'),
      () => (outcome = 'rejected'),
    );
    await vi.advanceTimersByTimeAsync(999);
    expect(outcome).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    await sending;
    expect(outcome).toBe('rejected');
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true);
  });

  it('waits the fifteen seconds by default', async () => {
    vi.useFakeTimers();
    const settled = expect(sendToWeb3Forms(body, { fetchImpl: silent() })).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS);
    await settled;
  });

  it('stops its timer once Web3Forms has answered, so an answered post is never aborted later', async () => {
    vi.useFakeTimers();
    await sendToWeb3Forms(body, { fetchImpl: answer({ ok: true, status: 200, json: async () => ({ success: true }) }) });
    expect(vi.getTimerCount()).toBe(0);
    await expect(sendToWeb3Forms(body, { fetchImpl: answer({ ok: false, status: 429, json: async () => ({}) }) })).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
