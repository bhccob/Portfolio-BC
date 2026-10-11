import { Component } from '../core/Component';
import { $$ } from '../core/dom';
import { profile } from '../../data/profile';

/**
 * The age is rendered at build time; this keeps it correct between deploys
 * (for example right after a birthday) without a rebuild.
 */
export class AgeUpdater extends Component {
  mount(): void {
    const age = String(profile.ageOn());
    $$('[data-age]').forEach((element) => {
      if (element.textContent !== age) element.textContent = age;
    });
    $$('[data-year]').forEach((element) => (element.textContent = String(new Date().getFullYear())));
  }
}
