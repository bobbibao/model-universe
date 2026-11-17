'use client';

import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ProductImage from '@/components/ProductImage';
import type { ShowcasePhoto } from '@/shared/types/showcase';
import { collectorServices, useServiceFact } from './ServiceExperience';

type GuideService = Exclude<(typeof collectorServices)[number]['key'], 'loyalty'>;

// The services hub: the three money services (buyback, trade, pawn) as large cards topped by a photo of a real kit
// from the shop, then holds and partner selling as wide cards. Without photos the cards keep a dark band with their
// number, so the layout does not depend on the catalog.
export default function ServiceCards({ photos }: { photos: ShowcasePhoto[] }) {
  const t = useTranslations('experience');
  const g = useTranslations('serviceGuide');
  const fact = useServiceFact();
  return (
    <div className="svx-cards">
      {collectorServices.map((service, index) => {
        const photo = photos[index];
        return (
          <Link
            key={service.key}
            href={service.route}
            className={`svx-card service-${service.key}${index < 3 ? ' is-main' : ' is-wide'}`}
          >
            <span className="svx-card-photo" aria-hidden="true">
              {photo ? (
                <ProductImage src={photo.src} alt="" sizes="(min-width: 1024px) 30vw, 90vw" className="object-cover" />
              ) : null}
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
        );
      })}
    </div>
  );
}
