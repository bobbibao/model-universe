'use client';

import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import { collectorServices, useServiceFact } from './ServiceExperience';

type GuideService = Exclude<(typeof collectorServices)[number]['key'], 'loyalty'>;

// The services hub: the three money services (buyback, trade, pawn) as large cards, then holds and partner selling as
// wide cards. Each card opens on a navy panel with the service's icon in gold rings and its number, so the five read as
// one set in the logo's colours; real kit photos stay in the hero above.
export default function ServiceCards() {
  const t = useTranslations('experience');
  const g = useTranslations('serviceGuide');
  const fact = useServiceFact();
  return (
    <div className="svx-cards">
      {collectorServices.map((service, index) => (
        <Link
          key={service.key}
          href={service.route}
          className={`svx-card service-${service.key}${index < 3 ? ' is-main' : ' is-wide'}`}
        >
          <span className="svx-card-art" aria-hidden="true">
            <span className="svx-card-icon">
              <AdminIcon name={service.icon} size={32} />
            </span>
            <span className="svx-card-num">{String(index + 1).padStart(2, '0')}</span>
          </span>
          <span className="svx-card-body">
            <strong className="svx-card-title">{t(`serviceNames.${service.key}`)}</strong>
            <span className="svx-card-text">{t(`serviceSummary.${service.key}`)}</span>
            <span className="svx-card-foot">
              <span className="svx-card-fact">{fact(service.key as GuideService)}</span>
              <span className="svx-card-go">
                <span className="sr-only">{g('start')}</span>
                <AdminIcon name="arrow" size={18} />
              </span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
