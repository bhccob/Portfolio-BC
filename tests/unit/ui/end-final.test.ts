import { describe, expect, it } from 'vitest';
import { FINAL_ATTRIBUTE, FINAL_MARGIN, type FinalObserver, type FinalSection, watchFinal } from '~/ui/endFinal';

/** A fake `#end`: its attributes, and the message part it holds. */
function fakeSection(final: object | null = {}) {
  const attributes = new Set<string>();
  const section = {
    querySelector: (selector: string) => (selector === '.end-final' ? final : null),
    toggleAttribute(name: string, force: boolean): boolean {
      if (force) attributes.add(name);
      else attributes.delete(name);
      return force;
    },
  } satisfies FinalSection;
  return { section, final, has: (): boolean => attributes.has(FINAL_ATTRIBUTE) };
}

/** A fake IntersectionObserver: the options it was made with, what it observes, and its callback to call by hand. */
function fakeObserver() {
  const made: { callback: (entries: { isIntersecting: boolean }[]) => void; options?: { rootMargin?: string }; observed: object[]; disconnected: boolean }[] = [];
  class Observer implements FinalObserver {
    private readonly record: (typeof made)[number];
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void, options?: { rootMargin?: string }) {
      this.record = { callback, options, observed: [], disconnected: false };
      made.push(this.record);
    }
    observe(target: object): void {
      this.record.observed.push(target);
    }
    disconnect(): void {
      this.record.disconnected = true;
    }
  }
  return { Observer, made };
}

describe('watchFinal: #end is marked while its message part is up, so the credits’ edge fades lift', () => {
  it('watches the message part against the screen’s top half', () => {
    expect(FINAL_ATTRIBUTE).toBe('data-final');
    expect(FINAL_MARGIN).toBe('0px 0px -50% 0px');
    const { section, final } = fakeSection();
    const { Observer, made } = fakeObserver();
    watchFinal(section, Observer);
    expect(made).toHaveLength(1);
    expect(made[0].options?.rootMargin).toBe(FINAL_MARGIN);
    expect(made[0].observed).toEqual([final]);
  });

  it('marks the section as the part comes up into the top half, and clears it as it goes back down', () => {
    const fake = fakeSection();
    const { Observer, made } = fakeObserver();
    watchFinal(fake.section, Observer);
    expect(fake.has()).toBe(false);
    made[0].callback([{ isIntersecting: true }]);
    expect(fake.has()).toBe(true);
    made[0].callback([{ isIntersecting: false }]);
    expect(fake.has()).toBe(false);
    // Several entries in one call: the last is where the part stands now.
    made[0].callback([{ isIntersecting: false }, { isIntersecting: true }]);
    expect(fake.has()).toBe(true);
  });

  it('lets go on cleanup, clearing the mark', () => {
    const fake = fakeSection();
    const { Observer, made } = fakeObserver();
    const stop = watchFinal(fake.section, Observer);
    made[0].callback([{ isIntersecting: true }]);
    stop();
    expect(made[0].disconnected).toBe(true);
    expect(fake.has()).toBe(false);
  });

  it('does nothing without a section, a message part or an IntersectionObserver (the server, an old browser)', () => {
    const { Observer, made } = fakeObserver();
    expect(() => watchFinal(null, Observer)()).not.toThrow();
    expect(() => watchFinal(fakeSection(null).section, Observer)()).not.toThrow();
    expect(made).toHaveLength(0);
    const fake = fakeSection();
    expect(() => watchFinal(fake.section, undefined)()).not.toThrow();
    expect(fake.has()).toBe(false);
  });
});
