import { Component } from '../core/Component';
import { $, escapeHtml, format, readJson } from '../core/dom';
import { StationClock } from './StationClock';

interface TerminalConfig {
  strings: {
    title: string;
    welcome: string;
    notFound: string;
    help: Record<string, string>;
    whoami: string;
    careerNow: string;
    careerHbo: string;
    careerNext: string;
    opening: string;
    sudo: string;
    moreSoon: string;
  };
  routes: { home: string; contact: string; en: string; nl: string };
  categories: { label: string; title: string; url: string; projects: { label: string; title: string; type: string; url: string }[] }[];
  socials: { label: string; handle: string; url: string }[];
}

type CommandHandler = (args: string[]) => void;

/**
 * bob-shell: a tiny command palette. Open it with `/`, Ctrl/⌘+K or the
 * header button. Every command is a method registered in `commands`.
 */
export class Terminal extends Component {
  private readonly dialog = $<HTMLDialogElement>('[data-terminal]');
  private readonly log = $('[data-terminal-log]');
  private readonly input = $<HTMLInputElement>('[data-terminal-input]');
  private config!: TerminalConfig;
  private history: string[] = [];
  private historyIndex = -1;
  private greeted = false;

  private readonly commands: Record<string, CommandHandler> = {
    help: () => this.help(),
    whoami: () => this.print(escapeHtml(this.config.strings.whoami)),
    projects: () => this.projects(),
    career: () => this.print([this.config.strings.careerNow, this.config.strings.careerHbo, this.config.strings.careerNext].map(escapeHtml).join('\n')),
    socials: () => this.socials(),
    contact: () => this.navigate(this.config.routes.contact, 'contact'),
    time: () => this.time(),
    lang: (args) => this.language(args[0]),
    clear: () => this.clear(),
    exit: () => this.close(),
    sudo: (args) => this.sudo(args)
  };

  mount(): void {
    if (!this.dialog || !this.log || !this.input) return;
    this.config = readJson<TerminalConfig>(this.dialog, 'data-config', {} as TerminalConfig);

    document.querySelectorAll('[data-terminal-open]').forEach((button) => this.listen(button, 'click', () => this.open()));
    this.listen($('[data-terminal-close]', this.dialog)!, 'click', () => this.close());
    this.listen<KeyboardEvent>(document, 'keydown', (event) => this.handleGlobalKey(event));
    this.listen<SubmitEvent>($('[data-terminal-form]', this.dialog)!, 'submit', (event) => {
      event.preventDefault();
      this.run(this.input!.value);
    });
    this.listen<KeyboardEvent>(this.input, 'keydown', (event) => this.handleInputKey(event));
    this.listen(this.dialog, 'close', () => document.dispatchEvent(new CustomEvent('scroll:lock', { detail: false })));
    // Clicking the backdrop closes the dialog.
    this.listen<MouseEvent>(this.dialog, 'click', (event) => {
      if (event.target === this.dialog) this.close();
    });
  }

  private handleGlobalKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
    const shortcut = (event.key === 'k' || event.key === 'K') && (event.ctrlKey || event.metaKey);
    if (shortcut || (event.key === '/' && !typing)) {
      event.preventDefault();
      this.dialog!.open ? this.close() : this.open();
    }
  }

  private handleInputKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.history.length) return;
      this.historyIndex = Math.min(Math.max(this.historyIndex + (event.key === 'ArrowUp' ? 1 : -1), -1), this.history.length - 1);
      this.input!.value = this.historyIndex === -1 ? '' : this.history[this.historyIndex];
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const partial = this.input!.value.trim().toLowerCase();
      const match = Object.keys(this.commands).find((name) => name.startsWith(partial));
      if (partial && match) this.input!.value = match;
    }
  }

  open(): void {
    if (!this.dialog || this.dialog.open) return;
    this.dialog.showModal();
    document.dispatchEvent(new CustomEvent('scroll:lock', { detail: true }));
    if (!this.greeted) {
      this.greeted = true;
      this.print(`<span class="dim">${escapeHtml(this.config.strings.welcome)}</span>`);
    }
    this.input!.focus();
  }

  close(): void {
    if (this.dialog?.open) this.dialog.close();
  }

  private run(raw: string): void {
    const line = raw.trim();
    this.input!.value = '';
    this.historyIndex = -1;
    if (!line) return;
    this.history.unshift(line);
    this.print(`<span class="cmd"><b>$</b> ${escapeHtml(line)}</span>`);

    const [name, ...args] = line.split(/\s+/);
    const command = this.commands[name.toLowerCase()];
    if (command) command(args);
    else this.print(`<span class="err">${escapeHtml(format(this.config.strings.notFound, { cmd: name }))}</span>`);
  }

  private print(html: string): void {
    const entry = document.createElement('div');
    entry.innerHTML = html;
    this.log!.append(entry);
    this.log!.scrollTop = this.log!.scrollHeight;
  }

  private help(): void {
    const rows = Object.entries(this.config.strings.help)
      .map(([name, text]) => `<b class="ok">${name.padEnd(9)}</b> ${escapeHtml(text)}`)
      .join('\n');
    this.print(rows);
  }

  private projects(): void {
    const rows = this.config.categories.flatMap((category) => [
      `<b class="ok">${category.label}</b> <a href="${category.url}">${escapeHtml(category.title)}</a>`,
      ...category.projects.map((project) => `    ${project.label}  <a href="${project.url}">${escapeHtml(project.title)}</a>  <span class="dim">${escapeHtml(project.type)}</span>`)
    ]);
    rows.push(`<span class="dim">${escapeHtml(this.config.strings.moreSoon)}</span>`);
    this.print(rows.join('\n'));
  }

  private socials(): void {
    this.print(
      this.config.socials
        .map((social) => `${social.label.padEnd(10)} <a href="${social.url}"${social.url.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(social.handle)}</a>`)
        .join('\n')
    );
  }

  private time(): void {
    const now = new Date();
    const zones = [
      ['Rotterdam', 'Europe/Amsterdam'],
      ['Aruba', 'America/Aruba']
    ];
    const rows = zones.map(([city, zone]) => {
      const time = new Intl.DateTimeFormat(document.documentElement.lang, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone }).format(now);
      const offset = StationClock.offsetHours(zone, now);
      return `${city.padEnd(10)} ${time}  <span class="dim">UTC${offset >= 0 ? '+' : ''}${offset}</span>`;
    });
    this.print(rows.join('\n'));
  }

  private language(code?: string): void {
    const target = code?.toLowerCase() === 'nl' ? 'nl' : code?.toLowerCase() === 'en' ? 'en' : null;
    if (!target) {
      this.print('<span class="dim">usage: lang en | lang nl</span>');
      return;
    }
    const link = document.querySelector<HTMLAnchorElement>(`[data-lang-switch] a[hreflang="${target}"]`);
    this.navigate(link?.href ?? this.config.routes[target], target.toUpperCase());
  }

  private sudo(args: string[]): void {
    if (args.join(' ').toLowerCase() === 'hire-bob') {
      this.print(`<span class="ok">${escapeHtml(this.config.strings.sudo)}</span>`);
      window.setTimeout(() => (window.location.href = this.config.routes.contact), 1100);
      return;
    }
    this.print('<span class="err">bob is not in the sudoers file. This incident will be reported. (try: sudo hire-bob)</span>');
  }

  private navigate(url: string, label: string): void {
    this.print(`<span class="dim">${escapeHtml(format(this.config.strings.opening, { page: label }))}</span>`);
    window.setTimeout(() => (window.location.href = url), 450);
  }

  private clear(): void {
    this.log!.innerHTML = '';
  }
}
