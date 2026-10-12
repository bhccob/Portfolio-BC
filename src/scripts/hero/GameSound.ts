import { SafeStorage } from '../core/SafeStorage';

/**
 * The mini-game's sounds, synthesised with the Web Audio API so there are no
 * files to download: a wooden "tok" for a ring, a brighter chime for a gold
 * one, and a soft low note when the combo is lost. Sound is off until the
 * visitor turns it on; the choice is remembered.
 */
export class GameSound {
  private static readonly KEY = 'bob-game-sound';

  private readonly storage = SafeStorage.local();
  private context: AudioContext | null = null;
  enabled = this.storage.get(GameSound.KEY) === '1';

  toggle(): boolean {
    this.enabled = !this.enabled;
    this.storage.set(GameSound.KEY, this.enabled ? '1' : '0');
    if (this.enabled) this.tok();
    return this.enabled;
  }

  /** A ring: a short, dry knock, a little higher with every step of the combo. */
  tok(combo = 1): void {
    this.note(720 + combo * 70, 0.09, 'triangle', 0.32);
  }

  chime(): void {
    this.note(880, 0.16, 'sine', 0.24);
    this.note(1320, 0.22, 'sine', 0.18, 0.07);
  }

  thud(): void {
    this.note(150, 0.18, 'sine', 0.22);
  }

  private audio(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    } catch {
      return null;
    }
  }

  private note(frequency: number, length: number, type: OscillatorType, volume: number, delay = 0): void {
    const audio = this.audio();
    if (!audio) return;
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.6, start + length);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + length + 0.02);
  }
}
