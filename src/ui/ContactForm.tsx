import { type FormEvent, type JSX, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { PAGES } from '~/data/pages';
import { profile } from '~/data/profile';
import { useTranslator } from '~/i18n/useTranslator';
import {
  type ContactField,
  FROM_NAME,
  MESSAGE_MAX,
  WEB3FORMS_ENDPOINT,
  contactPayload,
  coolingDown,
  fieldIsValid,
  invalidFields,
  looksAutomated,
} from './contactSubmit';

type Status = 'idle' | 'sending' | 'sent' | 'mailto';
type Errors = Partial<Record<ContactField, boolean>>;

/** The tab remembers when a message last went out (`sessionStorage`, which may be missing or refused: then there is no pause). */
const SENT_KEY = 'bob-contact-sent';

function readLastSent(): number {
  try {
    return Number(sessionStorage.getItem(SENT_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastSent(time: number): void {
  try {
    sessionStorage.setItem(SENT_KEY, String(time));
  } catch {
    // The pause is a courtesy to the inbox, not something the visitor needs.
  }
}

/**
 * The contact form. With an access key it posts the message to Web3Forms in the background and shows
 * a success state; without one (a local build) it hands the message to the visitor's email app.
 *
 * Without JavaScript the form is plain HTML: native validation, and with a key a normal post to
 * Web3Forms that comes back to this page with `?sent=1`. Without a key a form cannot reach Bob without
 * script (the page's policy lets a form post only to itself and Web3Forms, so a `mailto:` action is
 * refused), and a form that posts to its own address only ends in an error page. So the prerendered page
 * leaves the form out, and shows it once the page has hydrated; the direct links below it (the
 * `mailto:` link among them) are the way until then.
 *
 * The guards against scripts are invisible to people: a honeypot box, a minimum time between opening
 * the page and sending, and a pause of a minute after a message has gone out.
 */
export function ContactForm({ accessKey }: { accessKey?: string }): JSX.Element | null {
  const i18n = useTranslator();
  const c = i18n.t.contact;
  const key = accessKey?.trim() || undefined;
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState('');
  // False in the prerendered HTML and until the page has hydrated: then the browser validates, with its own messages.
  const [scripted, setScripted] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);
  const refocus = useRef(false);

  useEffect(() => {
    openedAt.current = performance.now();
    setScripted(true);
  }, []);

  // Web3Forms sends a visitor who posted without JavaScript back here with ?sent=1.
  useEffect(() => {
    if (new URLSearchParams(search).get('sent') !== '1') return;
    setStatus('sent');
    navigate({ pathname, search: '' }, { replace: true });
  }, [search, pathname, navigate]);

  // The success panel takes focus, so a screen reader reads it; Send another message puts focus back in the form.
  useEffect(() => {
    if (status === 'sent' || status === 'mailto') doneRef.current?.focus();
    if (status === 'idle' && refocus.current) {
      refocus.current = false;
      formRef.current?.querySelector<HTMLElement>('[name="name"]')?.focus();
    }
  }, [status]);

  function onInput(event: FormEvent<HTMLFormElement>): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const field = target.name as ContactField;
    // An error goes as soon as the field is good enough.
    if (errors[field] && fieldIsValid(field, target.value)) setErrors((current) => ({ ...current, [field]: false }));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string): string => String(data.get(name) ?? '');
    const fields = { name: text('name'), email: text('email'), message: text('message'), subject: text('subject') };

    setNotice('');
    const invalid = invalidFields(fields);
    setErrors(Object.fromEntries(invalid.map((field) => [field, true])));
    if (invalid.length > 0) {
      form.querySelector<HTMLElement>(`[name="${invalid[0]}"]`)?.focus();
      return;
    }

    const payload = contactPayload(fields, key);
    if (payload.mode === 'mailto') {
      window.location.href = payload.href;
      setStatus('mailto');
      return;
    }

    // A script ticked the honeypot or filled the form at once: it is told it worked, and nothing is sent.
    if (looksAutomated({ honeypot: data.has('botcheck'), elapsedMs: performance.now() - openedAt.current })) {
      setStatus('sent');
      return;
    }
    if (coolingDown(readLastSent(), Date.now())) {
      setNotice(c.errors.cooldown);
      return;
    }

    setStatus('sending');
    try {
      const response = await fetch(WEB3FORMS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload.body),
      });
      const result = (await response.json().catch(() => ({}))) as { success?: boolean };
      if (!response.ok || !result.success) throw new Error(`Web3Forms answered ${response.status}`);
      writeLastSent(Date.now());
      setStatus('sent');
    } catch (error) {
      console.error(error);
      setNotice(c.errors.generic);
      setStatus('idle');
    }
  }

  function again(): void {
    refocus.current = true;
    setErrors({});
    setNotice('');
    setStatus('idle');
  }

  if (status === 'sent' || status === 'mailto') {
    return (
      <section className="form-done" ref={doneRef} tabIndex={-1} aria-labelledby="contact-done-title">
        <h2 id="contact-done-title" className="form-title">
          {status === 'mailto' ? c.mailtoTitle : c.successTitle}
        </h2>
        <p>{status === 'mailto' ? c.mailtoText : c.successText}</p>
        <button type="button" className="button" onClick={again}>
          {c.again}
        </button>
      </section>
    );
  }

  if (!key && !scripted) return null;

  const sending = status === 'sending';
  const redirect = `${profile.site}${i18n.path(PAGES.contact)}?sent=1`;

  return (
    <section aria-labelledby="contact-form-title">
      <h2 id="contact-form-title" className="form-title">
        {c.formTitle}
      </h2>
      <form
        ref={formRef}
        className="form"
        method="post"
        action={key ? WEB3FORMS_ENDPOINT : undefined}
        noValidate={scripted}
        onSubmit={(event) => void submit(event)}
        onInput={onInput}
      >
        {key && <input type="hidden" name="access_key" defaultValue={key} />}
        {key && <input type="hidden" name="from_name" defaultValue={FROM_NAME} />}
        {key && <input type="hidden" name="redirect" defaultValue={redirect} />}
        <input className="honey" type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" aria-hidden="true" />

        <div className="field">
          <label className="label" htmlFor="contact-name">
            {c.name}
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            placeholder={c.namePlaceholder}
            aria-invalid={errors.name || undefined}
            aria-describedby="contact-name-error"
          />
          <p id="contact-name-error" className="field-error">
            {errors.name ? c.errors.name : null}
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor="contact-email">
            {c.email}
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={120}
            placeholder={c.emailPlaceholder}
            aria-invalid={errors.email || undefined}
            aria-describedby="contact-email-error"
          />
          <p id="contact-email-error" className="field-error">
            {errors.email ? c.errors.email : null}
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor="contact-subject">
            {c.subject} <span className="optional">({c.optional})</span>
          </label>
          <input id="contact-subject" name="subject" type="text" maxLength={120} placeholder={c.subjectPlaceholder} />
        </div>

        <div className="field">
          <label className="label" htmlFor="contact-message">
            {c.message}
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={6}
            required
            minLength={10}
            maxLength={MESSAGE_MAX}
            placeholder={c.messagePlaceholder}
            aria-invalid={errors.message || undefined}
            aria-describedby="contact-message-error"
          />
          <p id="contact-message-error" className="field-error">
            {errors.message ? c.errors.message : null}
          </p>
        </div>

        <div className="form-actions">
          <button type="submit" className="button" disabled={sending}>
            {sending ? c.sending : c.send}
          </button>
          <p className="form-privacy">{c.privacy}</p>
        </div>
        <p className="form-status" role="alert">
          {notice}
        </p>
      </form>
    </section>
  );
}
