import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { useScene } from '~/state/store';

/**
 * The header's 3D switch. The choice is the scene store's `threeD`: it is kept in storage (`needle-3d`,
 * "on" or "off") and put on <html> as `data-3d` by `useThreeDAttribute` in the Shell, which the styles read.
 *
 * The prerendered HTML says "on" (there is no storage on the server). The store hands React its defaults
 * while it hydrates, so the first client render says "on" as well, and the stored choice shows right after.
 */
export function ThreeDToggle(): JSX.Element {
  const { t } = useTranslator();
  const threeD = useScene((state) => state.threeD);
  const setThreeD = useScene((state) => state.setThreeD);

  return (
    <button type="button" role="switch" aria-checked={threeD} className="header-control" onClick={() => setThreeD(!threeD)}>
      {threeD ? t.needle.toggle.on : t.needle.toggle.off}
    </button>
  );
}
