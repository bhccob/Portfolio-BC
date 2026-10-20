import { describe, expect, it } from 'vitest';
import { Handlers } from '~/engine/core/Handlers';

describe('a list of handlers', () => {
  it('calls each handler added, until it unsubscribes', () => {
    const list = new Handlers<(n: number) => void>();
    const seen: string[] = [];
    const offA = list.add((n) => seen.push(`a${n}`));
    list.add((n) => seen.push(`b${n}`));
    list.each((handler) => handler(1));
    offA();
    offA(); // a second call does nothing
    list.each((handler) => handler(2));
    expect(seen).toEqual(['a1', 'b1', 'b2']);
    expect(list.size).toBe(1);
  });

  it('lets a handler unsubscribe itself or another while the list is being called', () => {
    const list = new Handlers<() => void>();
    const seen: string[] = [];
    let offB = (): void => {};
    const offA = list.add(() => {
      seen.push('a');
      offA();
      offB();
    });
    offB = list.add(() => seen.push('b'));
    list.add(() => seen.push('c'));
    list.each((handler) => handler()); // the call goes to the handlers there were when it began
    list.each((handler) => handler());
    expect(seen).toEqual(['a', 'b', 'c', 'c']);
  });

  it('keeps the same function added twice as two entries, and empties on clear', () => {
    const list = new Handlers<() => void>();
    let calls = 0;
    const handler = (): void => void calls++;
    const first = list.add(handler);
    list.add(handler);
    first();
    list.each((h) => h());
    expect(calls).toBe(1);
    list.clear();
    list.each((h) => h());
    expect(calls).toBe(1);
    expect(list.size).toBe(0);
  });
});
