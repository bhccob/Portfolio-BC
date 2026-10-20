import type { JSX } from 'react';
import { useTranslator } from '~/i18n/useTranslator';
import { LiteSection } from './LiteSection';

/**
 * Career: the build as it stands, the study after it, the possible future roles and the sector (folded
 * away behind one row), the goal, and why these directions. The section is `#career`: the old
 * /career/ addresses redirect here.
 */
export function LiteCareer(): JSX.Element {
  const { t } = useTranslator();
  const c = t.career;
  const roleCount = c.roleGroups.reduce((count, group) => count + group.roles.length, 0);

  return (
    <LiteSection id="career" title={c.title}>
      <p className="lead">{c.roadmapNote}</p>

      <ol className="lite-rows">
        <li>
          <p className="label">{c.currentStatus}</p>
          <h3 className="lite-item-title">{c.currentRole}</h3>
          <p className="label">{c.currentOrg}</p>
          <p>{c.currentText}</p>
        </li>
        <li>
          <p className="label">{c.hboStatus}</p>
          <h3 className="lite-item-title">{c.hboRole}</h3>
          <p className="label">{c.hboOrg}</p>
          <p>{c.hboText}</p>
        </li>
        <li>
          <details className="lite-details">
            <summary>
              <span className="summary-text">
                <span className="label">{c.nextStatus}</span>
                <span>{c.rolesToggle}</span>
                <span className="label">{`${roleCount} · ${c.rolesHint}`}</span>
              </span>
            </summary>
            <div className="details-body">
              {c.roleGroups.map((group) => (
                <div key={group.field} className="role-group">
                  <p className="label">{group.field}</p>
                  <ul>
                    {group.roles.map((role) => (
                      <li key={role.title}>
                        <h3 className="lite-item-title">{role.title}</h3>
                        <p>{role.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="role-group is-sector">
                <p className="label">{c.sector.label}</p>
                <h3 className="lite-item-title">{c.sector.title}</h3>
                <p>{c.sector.text}</p>
              </div>
            </div>
          </details>
        </li>
        <li>
          <p className="label">{c.goalStatus}</p>
          <h3 className="lite-item-title">{c.goalRole}</h3>
          <p className="label">{c.goalOrg}</p>
          <p>{c.goalText}</p>
        </li>
      </ol>

      <details className="lite-details">
        <summary>
          <span className="summary-text">
            <span>{c.whyToggle}</span>
          </span>
        </summary>
        <div className="details-body">
          {c.why.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </details>
    </LiteSection>
  );
}
