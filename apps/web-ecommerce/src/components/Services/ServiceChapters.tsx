'use client';

import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ProductImage from '@/components/ProductImage';
import type { ShowcasePhoto } from '@/shared/types/showcase';
import { collectorServices, useServiceFact } from './ServiceExperience';

type GuideService = Exclude<(typeof collectorServices)[number]['key'], 'loyalty'>;

// The services as chapters: each one a kit photographed in the shop, the width of the page, with the service on a
// white panel at its lower left (its number, name, what it does, its key fact and the way in). On a wide screen each
// chapter holds under the header while the next one slides up over it; on a phone and for visitors who reduce motion
// they simply follow each other, each photo above its words.
export default function ServiceChapters({ photos }: { photos: ShowcasePhoto[] }) {
  const t = useTranslations('experience');
  const g = useTranslations('serviceGuide');
  const fact = useServiceFact();
  const total = String(collectorServices.length).padStart(2, '0');
  return (
    <ol className="svc-chapters">
      {collectorServices.map((service, index) => {
        const photo = photos.length ? photos[(index + 3) % photos.length] : undefined;
        return (
          <li key={service.key} className={`svc-chapter service-${service.key}`} style={{ zIndex: index + 1 }}>
            {photo && (
              <span className="svc-chapter-photo" aria-hidden="true">
                <ProductImage src={photo.src} alt="" sizes="(min-width: 768px) 92vw, 100vw" className="object-cover" />
              </span>
            )}
            <div className="svc-chapter-panel">
              <span className="svc-chapter-num">
                {String(index + 1).padStart(2, '0')} / {total}
              </span>
              <h3>{t(`serviceNames.${service.key}`)}</h3>
              <p>{t(`serviceSummary.${service.key}`)}</p>
              <p className="svc-chapter-fact">{fact(service.key as GuideService)}</p>
              <Link href={service.route} className="svc-chapter-go">
                {g('start')}
                <AdminIcon name="arrow" size={18} />
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
