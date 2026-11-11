'use client';

import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ContactIcon from '@/components/Contact/ContactIcon';
import { CONTACT } from '@/shared/contact-channels';

// The top of /services: what the shop does for collectors, the four steps every request follows, and the two
// fastest ways in (a buyback quote, or a question on Zalo).
export default function ServicesHero() {
  const g = useTranslations('serviceGuide');
  return (
    <section className="sg-hero" aria-labelledby="services-title">
      <div className="mu-wrap sg-hero-grid">
        <div className="sg-hero-copy">
          <p className="sg-eyebrow">{g('heroEyebrow')}</p>
          <h1 id="services-title">{g('heroTitle')}</h1>
          <p className="sg-hero-intro">{g('heroIntro')}</p>
          <div className="sg-hero-actions">
            <Link className="sg-button is-primary is-large" href="/services/sell">
              {g('heroPrimary')}
              <AdminIcon name="arrow" size={18} />
            </Link>
            <a className="sg-button is-large" href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
              <ContactIcon name="zalo" size={24} />
              {g('heroSecondary')}
            </a>
          </div>
          <ul className="sg-trust">
            {(['trustRules', 'trustTracking', 'trustMoney'] as const).map((key) => (
              <li key={key}>
                <AdminIcon name="shield" size={16} />
                {g(key)}
              </li>
            ))}
          </ul>
        </div>
        <div className="sg-process" aria-labelledby="services-process">
          <h2 id="services-process">{g('processTitle')}</h2>
          <ol className="sg-steps">
            {([1, 2, 3, 4] as const).map((step) => (
              <li key={step}>
                <span className="sg-step-number">{step}</span>
                <span>{g(`processStep${step}`)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
