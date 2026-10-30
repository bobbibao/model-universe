'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { showToast } from '@/shared/client/utils/toast';
import Link from '@/i18n/navigation';
import Carousel from '@/components/Carousel';
import ProductImage from '@/components/ProductImage';
import PromoIcon, { type PromoIconName } from '@/components/PromoIcon';
import PromotionApi, { type PromotionsHub, type VoucherDrop } from '@/core/client/api/Promotion';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import { useCountdown } from '@/components/PriceTag';
import { FREESHIP_TIERS, TIER_ORDER } from '@/shared/promotions';
import { formatVND } from '@/shared/server/utils/utils';
import type { ProductSummary } from '@/shared/types/product';
import { productPath } from '@/shared/slug';
import VoucherTicket from './VoucherTicket';

// Up to three product photos arranged as a still life on the right of a banner; each opens its product.
function Collage({ products }: { products: ProductSummary[] }) {
  return (
    <div className="banner-collage">
      {products.slice(0, 3).map((product, index) => (
        <Link key={product.id} href={productPath(product)} className={`banner-photo is-${index}`} title={product.name}>
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            sizes="(min-width: 1024px) 22vw, 40vw"
            className="object-contain"
          />
        </Link>
      ))}
    </div>
  );
}

// A banner slide: its copy and call to action lead to `href`; its product photos lead to their products.
function Slide({
  href,
  tone,
  copy,
  products,
}: {
  href: string;
  tone: string;
  copy: React.ReactNode;
  products: ProductSummary[];
}) {
  return (
    <div className={`home-banner ${tone}`}>
      <Link href={href} className="banner-copy">
        {copy}
      </Link>
      <Collage products={products} />
    </div>
  );
}

function Clock({ endsAt, label }: { endsAt: string; label: string }) {
  const countdown = useCountdown(endsAt);
  if (!countdown) return null;
  return (
    <span className="banner-clock">
      <small>{label}</small>
      {countdown.days > 0 && <b>{countdown.days}d</b>}
      {countdown.clock.split(':').map((part, index) => (
        <b key={index}>{part}</b>
      ))}
    </span>
  );
}

// The top of the home page: a banner carousel (the running sale, vouchers, free shipping, membership), each
// slide pictured with real kits from the catalogue; quick links into the offers; and today's vouchers to save.
export default function HomePromotions({ products = [] }: { products?: ProductSummary[] }) {
  const t = useTranslations('homePromotions'),
    p = useTranslations('promotions'),
    tiers = useTranslations('tiers'),
    locale = useLocale();
  const { user } = useCurrentUser();
  const [hub, setHub] = useState<PromotionsHub | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => void PromotionApi.hub().then(setHub), []);
  useEffect(load, [load, user?.id]);
  const money = (value: number) => formatVND(value, locale);
  // Real photos only: a catalogue placeholder (no photo yet) is not shown in a banner.
  const pictured = products.filter(
    (product) =>
      product.imageUrl && !product.imageUrl.includes('placehold.co') && (product.groupStock ?? product.stock) > 0,
  );
  const pick = (offset: number) =>
    [0, 1, 2].map((i) => pictured[(offset + i) % Math.max(1, pictured.length)]).filter(Boolean);
  const event = hub?.events[0];
  const vouchers = [...(hub?.standing ?? []), ...(hub?.drops.filter((drop) => drop.remaining !== 0) ?? [])].slice(
    0,
    10,
  );

  const claim = async (drop: VoucherDrop) => {
    if (!user) {
      showToast.info(p('signInFirst'), {
        action: { label: 'Đăng nhập ngay', href: '/auth/signin' },
      });
      return;
    }
    setBusy(true);
    try {
      const value = await PromotionApi.claim(drop.id);
      showToast.success(p('savedCode', { code: value.code }), {
        action: { label: 'Dùng ngay', href: '/cart' },
      });
      load();
    } catch {
      /* The toast explains it. */
    } finally {
      setBusy(false);
    }
  };

  const doors: { icon: PromoIconName; label: string; href: string }[] = [
    { icon: 'ticket', label: t('doorVouchers'), href: '/uu-dai#vouchers' },
    { icon: 'truck', label: t('doorFreeship'), href: '/uu-dai#vouchers' },
    { icon: 'calendar', label: hub?.checkin.doneToday ? t('doorCheckedIn') : t('doorCheckin'), href: '/uu-dai#daily' },
    { icon: 'wheel', label: t('doorWheel'), href: '/uu-dai#daily' },
    { icon: 'bolt', label: t('doorFlash'), href: event ? `/su-kien/${event.id}` : '/uu-dai#sale' },
    { icon: 'crown', label: t('doorMember'), href: '/services/loyalty' },
  ];

  return (
    <section className="home-promos mu-wrap">
      <Carousel label={t('bannerLabel')} className="home-banner-carousel" autoplayMs={6000} loop>
        {event ? (
          <Slide
            href={`/su-kien/${event.id}`}
            tone="is-sale"
            products={event.products.length ? event.products : pick(0)}
            copy={
              <>
                <span className="banner-kicker">
                  <PromoIcon name="bolt" size={16} />
                  Flash Sale
                </span>
                <h2>{event.title}</h2>
                <p>{t('flashUpTo', { percent: event.maximumPercent })}</p>
                <Clock endsAt={event.endsAt} label={t('endsIn')} />
                <span className="banner-cta">
                  {t('shopNow')} <PromoIcon name="arrow" size={16} />
                </span>
              </>
            }
          />
        ) : null}
        <Slide
          href="/uu-dai#vouchers"
          tone="is-vouchers"
          products={pick(3)}
          copy={
            <>
              <span className="banner-kicker">
                <PromoIcon name="ticket" size={16} />
                {t('vouchersKicker')}
              </span>
              <h2>{t('vouchersTitle')}</h2>
              <p>{t('vouchersText')}</p>
              <span className="banner-cta">
                {t('collect')} <PromoIcon name="arrow" size={16} />
              </span>
            </>
          }
        />
        <Slide
          href="/uu-dai#vouchers"
          tone="is-ship"
          products={pick(6)}
          copy={
            <>
              <span className="banner-kicker">
                <PromoIcon name="truck" size={16} />
                {t('freeshipKicker')}
              </span>
              <h2>{t('freeshipTitle', { amount: money(FREESHIP_TIERS[FREESHIP_TIERS.length - 1].maxShippingVnd) })}</h2>
              <ul className="banner-steps">
                {FREESHIP_TIERS.map((tier) => (
                  <li key={tier.code}>
                    <span>{t('fromOrder', { amount: money(tier.minOrderVnd) })}</span>
                    <b>−{money(tier.maxShippingVnd)}</b>
                  </li>
                ))}
              </ul>
              <span className="banner-cta">
                {t('seeCodes')} <PromoIcon name="arrow" size={16} />
              </span>
            </>
          }
        />
        <Slide
          href="/services/loyalty"
          tone="is-member"
          products={pick(9)}
          copy={
            <>
              <span className="banner-kicker">
                <PromoIcon name="crown" size={16} />
                {t('memberKicker')}
              </span>
              <h2>{t('memberTitle')}</h2>
              <p>{t('memberText')}</p>
              <ol className="banner-tiers">
                {TIER_ORDER.map((tier) => (
                  <li key={tier} className={`tier-${tier.toLowerCase()}`}>
                    {tiers(tier)}
                  </li>
                ))}
              </ol>
              <span className="banner-cta">
                {t('memberCta')} <PromoIcon name="arrow" size={16} />
              </span>
            </>
          }
        />
      </Carousel>

      <nav className="home-doors" aria-label={t('doors')}>
        {doors.map((door) => (
          <Link key={door.icon} href={door.href} className="home-door">
            <span className="home-door-icon">
              <PromoIcon name={door.icon} size={22} />
            </span>
            <small>{door.label}</small>
          </Link>
        ))}
      </nav>

      {vouchers.length > 0 && (
        <div className="home-vouchers">
          <header>
            <h2>{t('todayVouchers')}</h2>
            <Link href="/uu-dai#vouchers">
              {t('seeAll')} <PromoIcon name="arrow" size={14} />
            </Link>
          </header>
          <Carousel
            label={t('todayVouchers')}
            className="voucher-carousel"
            autoplayMs={3800}
            loop={vouchers.length > 3}
            dots={false}
          >
            {vouchers.map((drop) => (
              <VoucherTicket
                key={`${drop.kind}-${drop.id}`}
                drop={drop}
                busy={busy}
                onClaim={(target) => void claim(target)}
              />
            ))}
          </Carousel>
        </div>
      )}
    </section>
  );
}
