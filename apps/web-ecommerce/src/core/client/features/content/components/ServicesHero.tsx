'use client';

import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ContactIcon from '@/components/Contact/ContactIcon';
import ProductImage from '@/components/ProductImage';
import { CONTACT } from '@/shared/contact-channels';
import type { ShowcasePhoto } from '@/shared/types/showcase';

// The first screen of /services: where the shop takes kits in, what it does in one line, the two fastest ways in (a
// buyback quote, or a question on Zalo), and three real kits photographed in the shop. The words rise once on load
// and the photos settle; nothing loops. The figures, the services and the visit follow in their own sections.
export default function ServicesHero({ photos }: { photos: ShowcasePhoto[] }) {
  const g = useTranslations('serviceGuide');
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
        </div>
        {photos.length >= 3 && (
          <div className="svx-gallery">
            {photos.slice(0, 3).map((photo, index) => (
              <Link key={photo.src} href={photo.href} className={`svx-shot is-${index}`} title={photo.alt}>
                <ProductImage
                  src={photo.src}
                  alt={photo.alt}
                  priority={index === 0}
                  sizes="(min-width: 1024px) 26vw, 50vw"
                  className="object-cover"
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
