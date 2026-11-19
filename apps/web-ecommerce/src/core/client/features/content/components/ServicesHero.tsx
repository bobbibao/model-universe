'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ContactIcon from '@/components/Contact/ContactIcon';
import ProductImage from '@/components/ProductImage';
import { SERVICE_FACTS } from '@/components/Services/serviceFacts';
import { CONTACT } from '@/shared/contact-channels';
import { useCountUp } from '@/shared/client/hooks/useReveal';
import type { ShowcasePhoto } from '@/shared/types/showcase';

function Stat({ value, label, active }: { value: string; label: string; active: boolean }) {
  const shown = useCountUp(value, active);
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span aria-hidden="true">{shown}</span>
        <span className="sr-only">{value}</span>
      </dd>
    </div>
  );
}

// The top of /services: a soft aura on the paper, the pitch with the two fastest ways in (a buyback quote, or a
// question on Zalo), the three numbers people ask first counting up once, and a stage of real kits from the shop with
// two glass notes floating on it (prices follow published rules; opening hours). Where and when to come sits below.
export default function ServicesHero({ photos }: { photos: ShowcasePhoto[] }) {
  const g = useTranslations('serviceGuide');
  const [counting, setCounting] = useState(false);
  useEffect(() => setCounting(true), []);
  const stats = [
    { value: `${SERVICE_FACTS.sellMaxPercent}%`, label: g('statSell') },
    { value: `${SERVICE_FACTS.pawnPercent}%`, label: g('statPawn') },
    { value: `${SERVICE_FACTS.holdMinDays}–${SERVICE_FACTS.holdMaxDays}`, label: g('statHold') },
  ];
  return (
    <section className="svx-hero" aria-labelledby="services-title">
      <div className="svx-aura" aria-hidden="true" />
      <div className="mu-wrap svx-hero-grid">
        <div className="svx-hero-copy">
          <p className="svx-where">
            <span className="svx-where-dot" aria-hidden="true" />
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
              <Stat key={stat.label} value={stat.value} label={stat.label} active={counting} />
            ))}
          </dl>
        </div>
        {photos.length >= 3 && (
          <div className="svx-stage">
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
            <p className="svx-float is-rules">
              <span className="svx-float-icon" aria-hidden="true">
                <AdminIcon name="shield" size={18} />
              </span>
              {g('trustRules')}
            </p>
            <p className="svx-float is-hours">
              <span className="svx-live" aria-hidden="true" />
              {CONTACT.hours}
            </p>
          </div>
        )}
      </div>
      <div className="mu-wrap">
        <ul className="svx-visit">
          <li>
            <span className="svx-visit-icon" aria-hidden="true">
              <ContactIcon name="pin" size={16} />
            </span>
            <a href={CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer">
              {CONTACT.addressLine}
            </a>
          </li>
          <li>
            <span className="svx-visit-icon" aria-hidden="true">
              <ContactIcon name="clock" size={16} />
            </span>
            {g('visitHoursValue', { hours: CONTACT.hours })}
          </li>
          <li>
            <span className="svx-visit-icon" aria-hidden="true">
              <ContactIcon name="phone" size={16} />
            </span>
            <a href={CONTACT.tel}>{CONTACT.phoneDisplay}</a>
          </li>
        </ul>
      </div>
    </section>
  );
}
