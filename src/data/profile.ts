export type SocialId = 'github' | 'instagram' | 'email';

export interface SocialLink {
  id: SocialId;
  label: string;
  handle: string;
  url: string;
}

/**
 * The single source of truth for who Bob is. Everything personal on the site
 * (age, links, structured data) is derived from this object.
 */
export class Person {
  readonly name = 'Bob Chung';
  readonly givenName = 'Bob';
  readonly familyName = 'Chung';
  readonly birthDate = '2006-04-27';
  readonly email = 'bhccob@gmail.com';
  readonly city = 'Rotterdam';
  readonly country = 'NL';
  readonly site = 'https://bhccob.me';

  readonly socials: readonly SocialLink[] = [
    { id: 'github', label: 'GitHub', handle: '@bhccob', url: 'https://github.com/bhccob' },
    { id: 'instagram', label: 'Instagram', handle: '@bhccob', url: 'https://www.instagram.com/bhccob/' },
    { id: 'email', label: 'Email', handle: 'bhccob@gmail.com', url: 'mailto:bhccob@gmail.com' }
  ];

  /** Age in whole years on the given date (defaults to now). */
  ageOn(date: Date = new Date()): number {
    const [year, month, day] = this.birthDate.split('-').map(Number);
    let age = date.getFullYear() - year;
    const hadBirthday = date.getMonth() + 1 > month || (date.getMonth() + 1 === month && date.getDate() >= day);
    if (!hadBirthday) age -= 1;
    return age;
  }

  social(id: SocialId): SocialLink {
    const link = this.socials.find((social) => social.id === id);
    if (!link) throw new Error(`Unknown social link: ${id}`);
    return link;
  }
}

export const profile = new Person();
