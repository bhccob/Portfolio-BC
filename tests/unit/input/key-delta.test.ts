import { describe, expect, it } from 'vitest';
import { keyDelta } from '../../../src/input/keyDelta';

const on = (tagName: string, extra: { isContentEditable?: boolean } = {}) => ({ tagName, ...extra });
const press = (key: string, target: Parameters<typeof keyDelta>[0]['target'] = on('BODY'), shiftKey = false) => keyDelta({ key, shiftKey, target }, 1000);

describe('keyDelta', () => {
  it('leaves a text field its keys', () => {
    expect(press(' ', on('INPUT'))).toBeNull();
    expect(press(' ', on('TEXTAREA'))).toBeNull();
    expect(press('ArrowDown', on('SELECT'))).toBeNull();
    expect(press('Home', on('INPUT'))).toBeNull();
    expect(press('PageDown', on('DIV', { isContentEditable: true }))).toBeNull();
  });

  it('reads the tag whatever its case', () => {
    expect(press(' ', on('input'))).toBeNull();
  });

  it('leaves a button its Space, which presses it', () => {
    expect(press(' ', on('BUTTON'))).toBeNull();
    expect(press(' ', on('SUMMARY'))).toBeNull();
    expect(press('PageDown', on('BUTTON'))).toBe(900);
    expect(press('ArrowDown', on('BUTTON'))).toBe(150);
  });

  it('moves a page for Page Down and Space, and back for Page Up and Shift+Space', () => {
    expect(press('PageDown')).toBe(900);
    expect(press(' ')).toBe(900);
    expect(press('PageUp')).toBe(-900);
    expect(press(' ', on('BODY'), true)).toBe(-900);
  });

  it('moves a line for the arrows', () => {
    expect(press('ArrowDown')).toBe(150);
    expect(press('ArrowUp')).toBe(-150);
  });

  it('jumps for Home and End', () => {
    expect(press('Home')).toBe('home');
    expect(press('End')).toBe('end');
  });

  it('takes no other key', () => {
    expect(press('a')).toBeNull();
    expect(press('Enter')).toBeNull();
    expect(press('Tab')).toBeNull();
    expect(press('ArrowLeft')).toBeNull();
  });

  it('scales with the viewport height', () => {
    expect(keyDelta({ key: 'PageDown', shiftKey: false, target: on('BODY') }, 800)).toBe(720);
    expect(keyDelta({ key: 'ArrowUp', shiftKey: false, target: on('BODY') }, 800)).toBe(-120);
  });

  it('works with no target at all (a key aimed at the window)', () => {
    expect(press('PageDown', null)).toBe(900);
    expect(keyDelta({ key: 'PageDown', shiftKey: false, target: {} }, 1000)).toBe(900);
  });
});
