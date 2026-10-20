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
