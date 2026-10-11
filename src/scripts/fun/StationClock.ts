import { Component } from '../core/Component';
import { signals } from '../core/Signal';
import { $, $$, format, readJson } from '../core/dom';
import { FlapBoard } from '../ui/FlapBoard';

type Phase = 'night' | 'dawn' | 'day' | 'dusk';

/**
 * The board's clocks: live local time in Rotterdam and Oranjestad on flap
 * tiles, the hour difference between them, and the time-of-day phase the
 * board shows (night service, first light, day service, evening service),
 * taken from the real time in Rotterdam.
 */
export class StationClock extends Component {
  private readonly clocks = $$('[data-clock]');
  private timer = 0;

  mount(): void {
    const diff = $('[data-clock-diff]');
    if (!this.clocks.length && !diff && !$('[data-phase-label]')) return;

    // The first flip waits for the boot screen, so it is seen.
    signals.loaderDone.then(() => window.setTimeout(() => this.update(), 500));
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    window.setTimeout(() => {
      this.update();
      this.timer = window.setInterval(() => this.update(), 60_000);
    }, msToNextMinute + 50);
    this.onCleanup(() => window.clearInterval(this.timer));
  }

  private update(): void {
    const now = new Date();
    this.clocks.forEach((clock) => {
      const timeZone = clock.dataset.clock!;
      const text = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(now);
      const row = FlapBoard.row(clock);
      if (row.current !== text) row.show(text, { spins: 2, jitter: 2, stagger: 50 });
      const spoken = $('.visually-hidden', clock);
      if (spoken) spoken.textContent = text;
    });

    const diff = $('[data-clock-diff]');
    if (diff) {
      const hours = Math.abs(StationClock.offsetHours('Europe/Amsterdam', now) - StationClock.offsetHours('America/Aruba', now));
      diff.textContent = format(diff.dataset.template ?? '{h}h', { h: hours });
    }

    const phase = StationClock.phaseAt(now);
    document.documentElement.dataset.phase = phase;
    $$('[data-phase-label]').forEach((label) => {
      const names = readJson<Record<Phase, string>>(label, 'data-phases', { night: '', dawn: '', day: '', dusk: '' });
      if (names[phase]) label.textContent = names[phase];
    });
  }

  /** Time of day in Rotterdam, in the four phases the board knows. */
  static phaseAt(at: Date): Phase {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Amsterdam' }).format(at));
    if (hour < 6 || hour >= 22) return 'night';
    if (hour < 9) return 'dawn';
    if (hour < 18) return 'day';
    return 'dusk';
  }

  /** UTC offset of a time zone at a given moment, in hours. */
  static offsetHours(timeZone: string, at: Date): number {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((asUtc - at.getTime()) / 3_600_000);
  }
}
