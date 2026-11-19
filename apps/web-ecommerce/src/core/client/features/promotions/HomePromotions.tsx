'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { showToast } from '@/shared/client/utils/toast';
import Link from '@/i18n/navigation';
import PromoIcon, { type PromoIconName } from '@/components/PromoIcon';
import PromotionApi, { type PromotionsHub, type VoucherDrop } from '@/core/client/api/Promotion';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import VoucherTicket from './VoucherTicket';

// Today's offers on the home page: one quiet row of links into the offers (vouchers, free shipping, check-in, wheel,
// the running sale, member tiers), then up to three vouchers to save. No banners and nothing that slides by itself.
export default function HomePromotions() {
  const t = useTranslations('homePromotions'),
    p = useTranslations('promotions');
  const { user } = useCurrentUser();
  const [hub, setHub] = useState<PromotionsHub | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => void PromotionApi.hub().then(setHub), []);
  useEffect(load, [load, user?.id]);
  const event = hub?.events[0];
  const vouchers = [...(hub?.standing ?? []), ...(hub?.drops.filter((drop) => drop.remaining !== 0) ?? [])].slice(0, 3);

  const claim = async (drop: VoucherDrop) => {
    if (!user) {
      showToast.info(p('signInFirst'), {
        href: '/auth/signin',
      });
      return;
    }
    setBusy(true);
    try {
      const value = await PromotionApi.claim(drop.id);
      showToast.success(p('savedCode', { code: value.code }), {
        href: '/cart',
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
      <nav className="home-doors" aria-label={t('doors')}>
        {doors.map((door) => (
          <Link key={door.icon} href={door.href} className="home-door">
            <PromoIcon name={door.icon} size={18} />
            <span>{door.label}</span>
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
          <div className="voucher-grid">
            {vouchers.map((drop) => (
              <VoucherTicket
                key={`${drop.kind}-${drop.id}`}
                drop={drop}
                busy={busy}
                onClaim={(target) => void claim(target)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
