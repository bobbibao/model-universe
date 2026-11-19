'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ProductImage from '@/components/ProductImage';
import { FREESHIP_TIERS } from '@/shared/promotions';
import { formatVND } from '@/shared/server/utils/utils';
import { productPath } from '@/shared/slug';
import type { ProductSummary } from '@/shared/types/product';
import { heroProduct } from '../heroProduct';

// The first screen of the shop: what it sells and to whom in plain words, one hard fact (the free-shipping tier), the
// two ways in (the catalogue, today's offers) and one real kit photographed in the shop, large. The photo is the one
// the page preloads as its largest paint. The words rise once on load and the photo settles; nothing loops.
export default function HomeHero({ products = [] }: { products?: ProductSummary[] }) {
  const t = useTranslations('home');
  const locale = useLocale();
  const photo = heroProduct(products);
  const top = FREESHIP_TIERS[FREESHIP_TIERS.length - 1];
  return (
    <section className="home-hero mu-wrap" aria-labelledby="home-title">
      <div className="home-hero-copy">
        <h1 id="home-title">{t('heroTitle')}</h1>
        <p className="home-hero-lead">{t('heroLead')}</p>
        <div className="home-hero-actions">
          <Link href="/cua-hang" className="home-button is-primary">
            {t('heroPrimary')}
            <AdminIcon name="arrow" size={18} />
          </Link>
          <Link href="/uu-dai" className="home-button is-secondary">
            {t('heroSecondary')}
          </Link>
        </div>
        <p className="home-hero-fact">
          {t('heroFact', {
            amount: formatVND(top.maxShippingVnd, locale),
            min: formatVND(top.minOrderVnd, locale),
          })}
        </p>
      </div>
      {photo && (
        <Link href={productPath(photo)} className="home-hero-photo" title={photo.name}>
          <ProductImage
            src={photo.imageUrl}
            alt={photo.name}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </Link>
      )}
    </section>
  );
}
