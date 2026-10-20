import { type JSX, useEffect, useState } from 'react';
import { SafeStorage } from '~/engine/core/SafeStorage';
import { useTranslator } from '~/i18n/useTranslator';

/** The storage key of the visitor's choice. */
export const THREE_D_KEY = 'needle-3d';

export type ThreeDMode = 'on' | 'off';

/**
 * The header's 3D switch. It keeps the choice in storage (`needle-3d`: "on" or "off")
 * and puts it on <html> as `data-3d`, which the styles read. The scene's store reads the
 * same key from Task 5 on; here the switch only reads and writes storage and the attribute.
 *
 * The prerendered HTML and the first client render both say "on" (there is no storage on the
 * server), and the stored choice is applied after hydration.
 */
export function ThreeDToggle(): JSX.Element {
  const { t } = useTranslator();
  const [mode, setMode] = useState<ThreeDMode | null>(null);

  useEffect(() => {
    setMode(SafeStorage.local().get(THREE_D_KEY) === 'off' ? 'off' : 'on');
  }, []);

  useEffect(() => {
    if (mode) document.documentElement.setAttribute('data-3d', mode);
  }, [mode]);

  const shown: ThreeDMode = mode ?? 'on';

  function toggle(): void {
    const next: ThreeDMode = shown === 'on' ? 'off' : 'on';
    SafeStorage.local().set(THREE_D_KEY, next);
    setMode(next);
  }

  return (
    <button type="button" role="switch" aria-checked={shown === 'on'} className="header-control" onClick={toggle}>
      {shown === 'on' ? t.needle.toggle.on : t.needle.toggle.off}
    </button>
  );
}
