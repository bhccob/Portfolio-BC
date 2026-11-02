import type { JSX } from 'react';
import { SIGNAL, signalBytes } from '~/engine/bob/signalFrames';
import { useTranslator } from '~/i18n/useTranslator';

/**
 * The signal's read-out (round 17, spec 2026-11-01-bob-signal-loader-design.md; Bob: "B · Signal"): the analyzer's words
 * under the loader's line, for the eye only (`aria-hidden`): the channel's label, a box per byte of the hero's name with
 * its letter and its code, and the name as far as it has been read. Hidden until the Opening writes it each frame of the
 * full path (src/scene/bob/signalReadout.ts), and hidden again from the home on.
 */
export function SignalReadout(): JSX.Element {
  const { t } = useTranslator();
  return (
    <div className="signal-readout" aria-hidden="true" hidden>
      <span className="signal-label">{SIGNAL.label}</span>
      {signalBytes(t.needle.hero.name).map(({ char, code }, i) => (
        <span key={i} className="signal-byte" data-code="shown">
          <span className="signal-char">{char === ' ' ? '␣' : char}</span>
          <span className="signal-code">{code.toString(16).toUpperCase().padStart(2, '0')}</span>
        </span>
      ))}
      <span className="signal-name" />
    </div>
  );
}
