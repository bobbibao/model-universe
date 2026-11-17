'use client';

import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ContactIcon from '@/components/Contact/ContactIcon';
import { CONTACT } from '@/shared/contact-channels';

// The top of /services: what the shop does, the two fastest ways in (a buyback quote, or a question on Zalo), where
// and when to bring a kit, and the four steps every request follows.
export default function ServicesHero() {
  const g = useTranslations('serviceGuide');
  return (
    <section className="sv-hero" aria-labelledby="services-title">
      <div className="mu-wrap">
        <div className="sv-hero-grid">
          <div>
            <h1 id="services-title">{g('heroTitle')}</h1>
            <p className="sv-lead">{g('heroIntro')}</p>
            <div className="sv-actions">
              <Link className="sg-button is-primary is-large" href="/services/sell">
                {g('heroPrimary')}
                <AdminIcon name="arrow" size={18} />
              </Link>
              <a className="sg-button is-large" href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
                <ContactIcon name="zalo" size={22} />
                {g('heroSecondary')}
              </a>
            </div>
          </div>
          <dl className="sv-visit">
            <div>
              <dt>{g('visitShowroom')}</dt>
              <dd>
                <a href={CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer">
                  {CONTACT.addressLine}
                </a>
              </dd>
            </div>
            <div>
              <dt>{g('visitHours')}</dt>
              <dd>{g('visitHoursValue', { hours: CONTACT.hours })}</dd>
            </div>
            <div>
              <dt>{g('visitPhone')}</dt>
              <dd>
                <a href={CONTACT.tel}>{CONTACT.phoneDisplay}</a>
              </dd>
            </div>
          </dl>
        </div>
        <div className="sv-process" aria-labelledby="services-process">
          <h2 id="services-process">{g('processTitle')}</h2>
          <ol>
            {([1, 2, 3, 4] as const).map((step) => (
              <li key={step}>
                <span className="sv-step">{String(step).padStart(2, '0')}</span>
                {g(`processStep${step}`)}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
