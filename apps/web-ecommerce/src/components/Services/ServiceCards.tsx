'use client';

import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import { collectorServices, useServiceFact } from './ServiceExperience';

type GuideService = Exclude<(typeof collectorServices)[number]['key'], 'loyalty'>;

// The services hub: the three money services (buyback, trade, pawn) three across, then holds and partner selling two
// across. One quiet card style: the service's icon and number, its name, what it does, and its key fact by the way in;
// real kit photos stay in the hero above.
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
          <span className="svx-card-top" aria-hidden="true">
            <span className="svx-card-icon">
              <AdminIcon name={service.icon} size={24} />
            </span>
            <span className="svx-card-num">{String(index + 1).padStart(2, '0')}</span>
          </span>
          <strong className="svx-card-title">{t(`serviceNames.${service.key}`)}</strong>
          <span className="svx-card-text">{t(`serviceSummary.${service.key}`)}</span>
          <span className="svx-card-foot">
            <span className="svx-card-fact">{fact(service.key as GuideService)}</span>
            <span className="svx-card-go">
              <span className="sr-only">{g('start')}</span>
              <AdminIcon name="arrow" size={18} />
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
