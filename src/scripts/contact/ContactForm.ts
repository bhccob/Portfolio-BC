import { Component } from '../core/Component';
import { $, readJson } from '../core/dom';
import { FlapBoard } from '../ui/FlapBoard';

interface FormStrings {
  errors: { name: string; email: string; message: string; generic: string };
  send: string;
  sending: string;
}

type FieldName = 'name' | 'email' | 'message';

/**
 * Contact form. With a Web3Forms access key it posts the message in the
 * background and shows a success state; without one it falls back to the
 * visitor's email app with everything pre-filled. Without JavaScript the
 * form still submits natively (Web3Forms redirects back with `?sent=1`).
 */
export class ContactForm extends Component {
  private static readonly ENDPOINT = 'https://api.web3forms.com/submit';
  private static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  private readonly form = $<HTMLFormElement>('[data-contact-form]');
  private readonly done = $('[data-form-done]');
  private strings!: FormStrings;

  mount(): void {
    if (!this.form || !this.done) return;
    this.strings = readJson<FormStrings>(this.form, 'data-strings', {} as FormStrings);

    this.listen<SubmitEvent>(this.form, 'submit', (event) => this.submit(event));
    this.listen(this.form, 'input', (event) => this.onInput(event));
    this.listen($('[data-form-again]', this.done)!, 'click', () => this.reset());

    if (new URLSearchParams(location.search).get('sent') === '1') {
      this.showDone('sent');
      history.replaceState(null, '', location.pathname);
    }
  }

  private field(name: string): HTMLInputElement | HTMLTextAreaElement {
    return this.form!.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  }

  private value(name: string): string {
    return this.field(name).value.trim();
  }

  private validate(): FieldName[] {
    const invalid: FieldName[] = [];
    if (this.value('name').length < 2) invalid.push('name');
    if (!ContactForm.EMAIL_PATTERN.test(this.value('email'))) invalid.push('email');
    if (this.value('message').length < 10) invalid.push('message');
    (['name', 'email', 'message'] as FieldName[]).forEach((name) => this.setError(name, invalid.includes(name)));
    return invalid;
  }

  private setError(name: FieldName, hasError: boolean): void {
    const field = this.field(name);
    const message = $(`[data-error-for="${name}"]`, this.form!);
    field.setAttribute('aria-invalid', String(hasError));
    if (message) message.textContent = hasError ? this.strings.errors[name] : '';
  }

  private onInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (target.name === 'message') {
      const counter = $('[data-count]', this.form!);
      if (counter) counter.textContent = `${target.value.length} / ${counter.dataset.max}`;
    }
    // Clear an error as soon as the field becomes valid.
    if (target.getAttribute('aria-invalid') === 'true') {
      const name = target.name as FieldName;
      const valid = name === 'email' ? ContactForm.EMAIL_PATTERN.test(target.value.trim()) : target.value.trim().length >= (name === 'name' ? 2 : 10);
      if (valid) this.setError(name, false);
    }
  }

  private async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.setStatus('');
    const invalid = this.validate();
    if (invalid.length) {
      this.field(invalid[0]).focus();
      return;
    }

    // Honeypot: real people never tick the hidden box.
    if ((this.field('botcheck') as HTMLInputElement).checked) {
      this.showDone('sent');
      return;
    }

    const accessKey = (this.form!.elements.namedItem('access_key') as HTMLInputElement | null)?.value;
    if (!accessKey) {
      this.openMailClient();
      return;
    }

    this.setSending(true);
    try {
      const response = await fetch(ContactForm.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: accessKey,
          from_name: 'bhccob.me portfolio',
          subject: `Portfolio: ${this.value('subject') || 'New message'}`,
          name: this.value('name'),
          email: this.value('email'),
          message: this.value('message'),
          botcheck: false
        })
      });
      const result = (await response.json().catch(() => ({}))) as { success?: boolean };
      if (!response.ok || !result.success) throw new Error(`Web3Forms responded with ${response.status}`);
      this.showDone('sent');
    } catch (error) {
      console.error(error);
      this.setStatus(this.strings.errors.generic);
    } finally {
      this.setSending(false);
    }
  }

  /** No access key configured yet: hand the message to the visitor's email app. */
  private openMailClient(): void {
    const subject = `Portfolio: ${this.value('subject') || 'New message'}`;
    const body = `${this.value('message')}\n\n— ${this.value('name')} (${this.value('email')})`;
    const href = `mailto:${this.form!.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    this.showDone('mailto');
  }

  private setSending(sending: boolean): void {
    const button = $<HTMLButtonElement>('[data-submit]', this.form!);
    const label = $('[data-submit-label]', this.form!);
    this.form!.classList.toggle('is-sending', sending);
    if (button) button.disabled = sending;
    if (label) label.textContent = sending ? this.strings.sending : this.strings.send;
  }

  private setStatus(message: string): void {
    const status = $('[data-form-status]', this.form!);
    if (status) status.textContent = message;
  }

  private showDone(mode: 'sent' | 'mailto'): void {
    const title = $('[data-done-title]', this.done!);
    const text = $('[data-done-text]', this.done!);
    if (title) title.textContent = title.dataset[mode] ?? title.textContent;
    if (text) text.textContent = text.dataset[mode] ?? text.textContent;
    this.form!.hidden = true;
    this.done!.hidden = false;
    this.done!.focus();
    const flap = $('[data-flap]', this.done!);
    if (flap) FlapBoard.row(flap).shuffle({ spins: 5, jitter: 4, stagger: 60 });
  }

  private reset(): void {
    this.form!.reset();
    const counter = $('[data-count]', this.form!);
    if (counter) counter.textContent = `0 / ${counter.dataset.max}`;
    this.done!.hidden = true;
    this.form!.hidden = false;
    this.field('name').focus();
  }
}
