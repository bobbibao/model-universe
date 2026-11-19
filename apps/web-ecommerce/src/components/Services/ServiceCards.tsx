'use client';

import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ProductImage from '@/components/ProductImage';
import type { ShowcasePhoto } from '@/shared/types/showcase';
import { collectorServices, useServiceFact } from './ServiceExperience';

type GuideService = Exclude<(typeof collectorServices)[number]['key'], 'loyalty'>;

// The services hub as a bento: buyback, the service most people come for, is the tall navy card with a real kit from
// the shop; the other four sit two by two beside it. Every card: its icon and number, name, what it does, and its key
// fact by the way in.
export default function ServiceCards({ photo }: { photo?: ShowcasePhoto }) {
  const t = useTranslations('experience');
  const g = useTranslations('serviceGuide');
  const fact = useServiceFact();
  return (
    <div className="svx-cards">
      {collectorServices.map((service, index) => {
        const feature = index === 0;
        return (
          <Link
            key={service.key}
            href={service.route}
            className={`svx-card service-${service.key}${feature ? ' is-feature' : ''}`}
          >
            {feature && photo && (
              <span className="svx-card-photo" aria-hidden="true">
                <ProductImage src={photo.src} alt="" sizes="(min-width: 1024px) 32vw, 90vw" className="object-cover" />
              </span>
            )}
            <span className="svx-card-top" aria-hidden="true">
              <span className="svx-card-icon">
                <AdminIcon name={service.icon} size={feature ? 26 : 24} />
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
        );
      })}
    </div>
  );
}
