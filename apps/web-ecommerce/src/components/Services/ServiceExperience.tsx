'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ContactIcon from '@/components/Contact/ContactIcon';
import { CONTACT } from '@/shared/contact-channels';
import { SERVICE_FACTS } from './serviceFacts';
import './service-guide.css';

export type CollectorService = 'sell' | 'trade' | 'pawn' | 'partner' | 'reserve' | 'loyalty';
const services: { key: CollectorService; icon: string; route: string }[] = [
  { key: 'sell', icon: 'bag', route: '/services/sell' },
  { key: 'trade', icon: 'exchange', route: '/services/trade' },
  { key: 'pawn', icon: 'shield', route: '/services/pawn' },
  { key: 'partner', icon: 'users', route: '/services/partner' },
  { key: 'reserve', icon: 'calendar', route: '/services/reserve' },
  { key: 'loyalty', icon: 'spark', route: '/services/loyalty' },
];
// Hold deposits are available alongside collector services; loyalty stays under membership.
export const collectorServices = services.filter((service) => service.key !== 'loyalty');

export function ServiceHeader({
  service,
  title,
  admin = false,
}: {
  service: CollectorService;
  title: string;
  admin?: boolean;
}) {
  const t = useTranslations('experience');
  const item = services.find((item) => item.key === service)!;
  if (admin)
    return (
      <header className={`service-experience-header service-${service} is-operations`}>
        <div className="service-header-copy">
          <h1>
            <span className="store-heading-icon" aria-hidden="true">
              <AdminIcon name={item.icon} size={22} />
            </span>
            {title}
          </h1>
          <p>{t(`serviceSummary.${service}`)}</p>
        </div>
      </header>
    );
  // Storefront: a plain page head (back to all services, the title, one line on what it does) and the other services
  // as text tabs.
  return (
    <header className="sv-page-head">
      <Link href="/services" className="sv-back">
        ← {t('collectorServices')}
      </Link>
      <h1>{title}</h1>
      <p>{t(`serviceSummary.${service}`)}</p>
      <nav className="sv-switcher" aria-label={t('collectorServices')}>
        {collectorServices.map((item) => (
          <Link key={item.key} href={item.route} aria-current={item.key === service ? 'page' : undefined}>
            {t(`serviceNames.${item.key}`)}
          </Link>
        ))}
      </nav>
    </header>
  );
}

// Every collector service as one ruled row: number, name and what it does, its key fact, and the way in.
export function ServiceIndex({ items = collectorServices }: { items?: typeof collectorServices }) {
  const t = useTranslations('experience');
  const g = useTranslations('serviceGuide');
  const fact = useServiceFact();
  return (
    <ul className="sv-index">
      {items.map((service, index) => (
        <li key={service.key}>
          <Link href={service.route} className="sv-row">
            <span className="sv-num" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="sv-name">
              <strong>{t(`serviceNames.${service.key}`)}</strong>
              <span>{t(`serviceSummary.${service.key}`)}</span>
            </span>
            <span className="sv-fact">{fact(service.key as GuideService)}</span>
            <span className="sv-go">
              {g('start')}
              <AdminIcon name="arrow" size={16} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ServiceTerms({ children, title }: { children: ReactNode; title?: string }) {
  const t = useTranslations('experience');
  return (
    <details className="service-terms">
      <summary>
        <span>{title || t('serviceTerms')}</span>
        <span className="service-terms-toggle" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="service-terms-content">{children}</div>
    </details>
  );
}

export function ServiceEmpty({ children }: { children: ReactNode }) {
  const t = useTranslations('experience');
  return (
    <div className="service-empty">
      <div className="service-empty-art" aria-hidden="true">
        <AdminIcon name="box" size={34} />
      </div>
      <div>
        <h2>{t('emptyTitle')}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}

type GuideService = Exclude<CollectorService, 'loyalty'>;

// The key fact of each service, with its numbers computed from the pricing rules (serviceFacts.ts).
export function useServiceFact() {
  const g = useTranslations('serviceGuide');
  return (service: GuideService) =>
    ({
      sell: g('factSell', { percent: SERVICE_FACTS.sellMaxPercent }),
      trade: g('factTrade'),
      pawn: g('factPawn', { percent: SERVICE_FACTS.pawnPercent }),
      reserve: g('factReserve', {
        percent: SERVICE_FACTS.holdMinPercent,
        minDays: SERVICE_FACTS.holdMinDays,
        maxDays: SERVICE_FACTS.holdMaxDays,
      }),
      partner: g('factPartner'),
    })[service];
}

// Signed-out visitors of a service page: how it works in four steps, its key terms, then sign in or ask first.
export function ServiceGuestPanel({
  service,
  signInHref,
  signInLabel,
}: {
  service: GuideService;
  signInHref: string;
  signInLabel: string;
}) {
  const g = useTranslations('serviceGuide');
  const fact = useServiceFact();
  const numbers = {
    percent: SERVICE_FACTS.holdMinPercent,
    minDays: SERVICE_FACTS.holdMinDays,
    maxDays: SERVICE_FACTS.holdMaxDays,
  };
  return (
    <section className="sg-guest" aria-labelledby={`guest-${service}`}>
      <div className="sg-guest-main">
        <h2 id={`guest-${service}`}>{g('guestTitle')}</h2>
        <ol className="sg-steps">
          {[1, 2, 3, 4].map((step) => (
            <li key={step}>
              <span className="sv-step">{String(step).padStart(2, '0')}</span>
              <span>{g(`${service}Step${step}`, numbers)}</span>
            </li>
          ))}
        </ol>
      </div>
      <aside className="sg-guest-side">
        <ul className="sg-facts">
          <li>{fact(service)}</li>
          <li>{g(`${service}Fact2`)}</li>
        </ul>
        <p>{g('guestIntro')}</p>
        <div className="sg-guest-actions">
          <Link className="sg-button is-primary" href={signInHref}>
            {signInLabel}
          </Link>
          <a className="sg-button" href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
            <ContactIcon name="zalo" size={22} />
            {g('guestZalo')}
          </a>
          <a className="sg-button is-quiet" href={CONTACT.tel}>
            <ContactIcon name="phone" size={16} />
            {g('guestCall', { phone: CONTACT.phoneDisplay })}
          </a>
        </div>
      </aside>
    </section>
  );
}
