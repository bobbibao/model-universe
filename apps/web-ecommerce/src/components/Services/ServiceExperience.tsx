'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';

export type CollectorService = 'sell' | 'trade' | 'pawn' | 'partner' | 'reserve' | 'loyalty';
const services: { key: CollectorService; icon: string; route: string }[] = [
  { key: 'sell', icon: 'bag', route: '/services/sell' },
  { key: 'trade', icon: 'exchange', route: '/services/trade' },
  { key: 'pawn', icon: 'shield', route: '/services/pawn' },
  { key: 'partner', icon: 'users', route: '/services/partner' },
  { key: 'reserve', icon: 'calendar', route: '/services/reserve' },
  { key: 'loyalty', icon: 'spark', route: '/services/loyalty' },
];
// The service tabs (owner request of 2026-10-26: buyback, trade, pawn and partner; reserve is no longer offered and
// loyalty lives under membership, but both pages keep their header).
export const collectorServices = services.slice(0, 4);

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
  return (
    <header className={`service-experience-header service-${service} ${admin ? 'is-operations' : ''}`}>
      <div className="service-header-copy">
        <h1>
          <span className="store-heading-icon" aria-hidden="true">
            <AdminIcon name={item.icon} size={22} />
          </span>
          {title}
        </h1>
        <p>{t(`serviceSummary.${service}`)}</p>
        {!admin && (
          <nav className="service-switcher" aria-label={t('collectorServices')}>
            {collectorServices.map((item) => (
              <Link key={item.key} href={item.route} aria-current={item.key === service ? 'page' : undefined}>
                <AdminIcon name={item.icon} size={15} />
                {t(`serviceNames.${item.key}`)}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

export function ServiceTerms({ children, title }: { children: ReactNode; title?: string }) {
  const t = useTranslations('experience');
  return (
    <details className="service-terms">
      <summary>
        <span>
          <AdminIcon name="shield" size={17} />
          {title || t('serviceTerms')}
        </span>
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
