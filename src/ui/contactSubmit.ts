import { profile } from '../data/profile';

/** Where a message goes when the site has an access key; the CSP allows this host in `connect-src` and `form-action`. */
export const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

export type ContactField = 'name' | 'email' | 'message';

export interface ContactFields {
  name: string;
  email: string;
  message: string;
  /** The visitor's own subject line; the form leaves it out when it is empty. */
  subject?: string;
}

/** Either the body to post to Web3Forms, or the link that hands the message to the visitor's email app. */
export type ContactPayload = { mode: 'web3forms'; body: Record<string, string> } | { mode: 'mailto'; href: string };

// The site's own labels on a message, as the first form of the portfolio wrote them (they are for Bob's inbox, not shown on the page).
export const FROM_NAME = 'bhccob.me portfolio';
const SUBJECT_PREFIX = 'Portfolio: ';
const SUBJECT_DEFAULT = 'New message';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_LENGTH: Record<Exclude<ContactField, 'email'>, number> = { name: 2, message: 10 };
export const MESSAGE_MAX = 3000;

/** Nobody reads the page and writes a message in under this many milliseconds. */
export const MIN_FILL_MS = 3000;
/** After a message has gone out, the next one waits this long. */
export const COOLDOWN_MS = 60_000;
/** A post that Web3Forms has not answered in this long has failed (the visitor can send again). */
export const SEND_TIMEOUT_MS = 15_000;

/** True where the text, without the spaces around it, is good enough for the field. */
export function fieldIsValid(field: ContactField, value: string): boolean {
  const text = value.trim();
  return field === 'email' ? EMAIL_PATTERN.test(text) : text.length >= MIN_LENGTH[field];
}

/** The fields that are not good enough yet, in the order of the form. */
export function invalidFields(fields: ContactFields): ContactField[] {
  return (['name', 'email', 'message'] as const).filter((field) => !fieldIsValid(field, fields[field]));
}

/** A ticked honeypot box or a form filled in too fast is a script, not a person. */
export function looksAutomated({ honeypot, elapsedMs }: { honeypot: boolean; elapsedMs: number }): boolean {
  return honeypot || elapsedMs < MIN_FILL_MS;
}

/** True while the pause after the last sent message (`lastSent`, 0 for none) has not run out. */
export function coolingDown(lastSent: number, now: number): boolean {
  return lastSent > 0 && now - lastSent < COOLDOWN_MS;
}

/**
 * What to do with a valid message. With an access key it is the body to post to Web3Forms; without one
 * (a local build) it is a `mailto:` link to Bob with the subject and the message ready, so the form
 * still works before the key is set.
 */
export function contactPayload(fields: ContactFields, key: string | undefined): ContactPayload {
  const name = fields.name.trim();
  const email = fields.email.trim();
  const message = fields.message.trim();
  const subject = `${SUBJECT_PREFIX}${fields.subject?.trim() || SUBJECT_DEFAULT}`;

  const accessKey = key?.trim();
  if (accessKey) {
    return { mode: 'web3forms', body: { access_key: accessKey, from_name: FROM_NAME, subject, name, email, message } };
  }

  const body = `${message}\n\n— ${name} (${email})`;
  return { mode: 'mailto', href: `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}

/**
 * Posts a `web3forms` body in the background. It resolves when Web3Forms says the message was sent, and
 * rejects when the network fails, the answer is an error or says it did not succeed, or nothing answers in
 * `timeoutMs`: then the request is aborted, so a hung connection ends as a failure the visitor can retry.
 */
export async function sendToWeb3Forms(
  body: Record<string, string>,
  { fetchImpl = fetch, timeoutMs = SEND_TIMEOUT_MS }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const result = (await response.json().catch(() => ({}))) as { success?: boolean };
    if (!response.ok || !result.success) throw new Error(`Web3Forms answered ${response.status}`);
  } finally {
    clearTimeout(timer);
  }
}
