'use client';

import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ContactIcon from '@/components/Contact/ContactIcon';
import ProductImage from '@/components/ProductImage';
import { SERVICE_FACTS } from '@/components/Services/serviceFacts';
import { CONTACT } from '@/shared/contact-channels';
import type { ShowcasePhoto } from '@/shared/types/showcase';

// The top of /services on the page's own paper: what the shop does, the two fastest ways in (a buyback quote, or a
// question on Zalo), the three numbers people ask first, photos of real kits in the shop, and where and when to come.
export default function ServicesHero({ photos }: { photos: ShowcasePhoto[] }) {
  const g = useTranslations('serviceGuide');
  const stats = [
    { value: `${SERVICE_FACTS.sellMaxPercent}%`, label: g('statSell') },
    { value: `${SERVICE_FACTS.pawnPercent}%`, label: g('statPawn') },
    { value: `${SERVICE_FACTS.holdMinDays}–${SERVICE_FACTS.holdMaxDays}`, label: g('statHold') },
  ];
  return (
    <section className="svx-hero" aria-labelledby="services-title">
      <div className="mu-wrap svx-hero-grid">
        <div className="svx-hero-copy">
          <p className="svx-where">
            <ContactIcon name="pin" size={16} />
            {g('heroWhere')}
          </p>
          <h1 id="services-title">{g('heroTitle')}</h1>
          <p className="svx-lead">{g('heroIntro')}</p>
          <div className="svx-actions">
            <Link className="svx-button is-primary" href="/services/sell">
              {g('heroPrimary')}
              <AdminIcon name="arrow" size={18} />
            </Link>
            <a className="svx-button is-outline" href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
              <ContactIcon name="zalo" size={22} />
              {g('heroSecondary')}
            </a>
          </div>
          <dl className="svx-stats">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {photos.length >= 3 && (
          <div className="svx-gallery">
            {photos.slice(0, 3).map((photo, index) => (
              <Link key={photo.src} href={photo.href} className={`svx-shot is-${index}`} title={photo.alt}>
                <ProductImage
                  src={photo.src}
                  alt={photo.alt}
                  priority={index === 0}
                  sizes="(min-width: 1024px) 24vw, 50vw"
                  className="object-cover"
                />
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="mu-wrap">
        <ul className="svx-visit">
          <li>
            <ContactIcon name="pin" size={16} />
            <a href={CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer">
              {CONTACT.addressLine}
            </a>
          </li>
          <li>
            <ContactIcon name="clock" size={16} />
            {g('visitHoursValue', { hours: CONTACT.hours })}
          </li>
          <li>
            <ContactIcon name="phone" size={16} />
            <a href={CONTACT.tel}>{CONTACT.phoneDisplay}</a>
          </li>
        </ul>
      </div>
    </section>
  );
}
