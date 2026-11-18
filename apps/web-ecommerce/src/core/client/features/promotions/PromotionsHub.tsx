'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { showToast } from '@/shared/client/utils/toast';
import Link from '@/i18n/navigation';
import PromoIcon, { type PromoIconName } from '@/components/PromoIcon';
import PromotionApi, { type PromotionsHub as Hub, type VoucherDrop } from '@/core/client/api/Promotion';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import { CHECKIN_POINTS, TIER_ORDER } from '@/shared/promotions';
import { RANK_BENEFITS } from '@/shared/voucher-stack';
import { LOYALTY_TIERS } from '@/shared/loyalty-rules';
import { formatVND } from '@/shared/server/utils/utils';
import VoucherTicket from './VoucherTicket';
import LuckyWheel from './LuckyWheel';
import MemberCard from './MemberCard';

const SECTIONS = ['vouchers', 'daily', 'missions', 'tiers'] as const;
const MISSION_ICONS: Record<string, PromoIconName> = {
  complete_profile: 'user',
  first_order: 'bag',
  review: 'star',
  share: 'share',
};

// The offers page: a navy band with today's quick wins and the member's standing (or the sign-in panel), then
// everything that saves money, each in its own section that the band's links jump to — vouchers (codes anyone can use
// and timed drops to save), the daily check-in and wheel, one-off missions, and a table of what each tier gets.
export default function PromotionsHub() {
  const t = useTranslations('promotions'),
    tiers = useTranslations('tiers'),
    locale = useLocale();
  const { user } = useCurrentUser();
  const [hub, setHub] = useState<Hub | null>();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'discount' | 'freeship'>('all');
  const load = useCallback(() => void PromotionApi.hub().then(setHub), []);
  useEffect(load, [load, user?.id]);
  const money = (value: number) => formatVND(value, locale);

  const act = async <T,>(action: () => Promise<T>, success: (value: T) => string) => {
    if (!user) {
      showToast.info(t('signInFirst'), {
        href: '/auth/signin',
      });
      return null;
    }
    setBusy(true);
    try {
      const value = await action();
      showToast.success(success(value), {
        href: '/cart',
      });
      load();
      return value;
    } catch {
      return null; // The toast explains it.
    } finally {
      setBusy(false);
    }
  };

  const anchors = (
    <nav className="promo-anchors" aria-label={t('sections')}>
      {SECTIONS.map((section) => (
        <a key={section} href={`#${section}`}>
          {t(`nav.${section}`)}
        </a>
      ))}
    </nav>
  );
  // The navy band: the heading (rendered before the data so the server HTML has the page's H1), today's three quick
  // wins, and the member's card or the sign-in panel beside them.
  const hero = (today: ReactNode, aside: ReactNode) => (
    <section className="promo-hero" aria-labelledby="promo-title">
      <div className="promo-hero-inner">
        <div className="promo-hero-copy">
          <h1 id="promo-title">{t('title')}</h1>
          <p>{t('intro')}</p>
          {today}
        </div>
        {aside}
      </div>
      <div className="promo-hero-inner">{anchors}</div>
    </section>
  );
  if (hub === undefined)
    return (
      <div className="promo-screen">
        {hero(null, <div className="promo-hero-aside promo-skeleton is-dark" aria-hidden="true" />)}
        <div className="promo-page">
          <div className="promo-skeleton" aria-busy="true" />
        </div>
      </div>
    );
  if (!hub) return <div className="promo-screen">{hero(null, null)}</div>;
  const member = hub.member;
  const tierIndex = member ? TIER_ORDER.indexOf(member.tier as (typeof TIER_ORDER)[number]) : -1;
  const vouchers = [...hub.standing, ...hub.drops].filter((drop) => filter === 'all' || drop.benefitType === filter);
  const openDrops = hub.drops.filter((drop) => new Date(drop.startsAt).getTime() <= Date.now() && !drop.claimed);
  const missionsDone = hub.missions.filter((mission) => mission.claimed).length;
  const streak = Math.min(CHECKIN_POINTS.length, hub.checkin.streak);
  const claim = (target: VoucherDrop) =>
    void act(
      () => PromotionApi.claim(target.id),
      (value) => t('savedCode', { code: value.code }),
    );

  const today = (
    <ul className="promo-today" aria-label={t('todayTitle')}>
      <li className={hub.checkin.doneToday ? 'is-done' : ''}>
        <a href="#daily">
          <span className="promo-today-icon">
            <PromoIcon name={hub.checkin.doneToday ? 'check' : 'calendar'} size={20} />
          </span>
          <strong>{t('checkinTitle')}</strong>
          <small>
            {hub.checkin.doneToday
              ? t('checkedInStreak', { streak: hub.checkin.streak })
              : t('checkinNow', { points: hub.checkin.nextReward.points })}
          </small>
        </a>
      </li>
      <li className={hub.wheel.spunToday ? 'is-done' : ''}>
        <a href="#daily">
          <span className="promo-today-icon">
            <PromoIcon name={hub.wheel.spunToday ? 'check' : 'wheel'} size={20} />
          </span>
          <strong>{t('wheelTitle')}</strong>
          <small>{hub.wheel.spunToday ? t('spunToday') : t('wheelReady')}</small>
        </a>
      </li>
      <li>
        <a href="#vouchers">
          <span className="promo-today-icon">
            <PromoIcon name="ticket" size={20} />
          </span>
          <strong>{t('dropsTitle')}</strong>
          <small>{t('openVouchers', { count: openDrops.length })}</small>
        </a>
      </li>
    </ul>
  );
  const aside = member ? (
    <div className="promo-hero-aside">
      <MemberCard member={member} />
    </div>
  ) : (
    <div className="promo-hero-aside promo-join">
      <span className="promo-join-icon" aria-hidden="true">
        <PromoIcon name="crown" size={22} />
      </span>
      <h2>{t('joinTitle')}</h2>
      <p>{t('joinText')}</p>
      <ol className="promo-join-tiers" aria-label={t('tiersTitle')}>
        {LOYALTY_TIERS.map((tier) => (
          <li key={tier.name} className={`tier-${tier.name.toLowerCase()}`}>
            {tiers(tier.name)}
          </li>
        ))}
      </ol>
      <Link href="/auth/signin?redirect=/uu-dai" className="promo-button is-gold">
        {t('signIn')}
        <PromoIcon name="arrow" size={18} />
      </Link>
    </div>
  );

  return (
    <div className="promo-screen">
      {hero(today, aside)}
      <div className="promo-page">
        <section id="vouchers" className="promo-section">
          <header className="promo-section-head">
            <div>
              <h2>{t('dropsTitle')}</h2>
              <p>{t('dropsText')}</p>
            </div>
            <div className="promo-segments" role="tablist">
              {(['all', 'discount', 'freeship'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  className={filter === key ? 'is-active' : ''}
                  onClick={() => setFilter(key)}
                >
                  {t(`filter.${key}`)}
                </button>
              ))}
            </div>
          </header>
          {vouchers.length ? (
            <div className="voucher-grid">
              {vouchers.map((drop, index) => (
                <div key={`${drop.kind}-${drop.id}`} className="promo-reveal" style={{ ['--i' as string]: index }}>
                  <VoucherTicket drop={drop} busy={busy} onClaim={claim} />
                </div>
              ))}
            </div>
          ) : (
            <p className="promo-empty">{t('noDrops')}</p>
          )}
        </section>

        <section id="daily" className="promo-section promo-daily">
          <article className="promo-card promo-checkin">
            <header>
              <h2>{t('checkinTitle')}</h2>
              <p>{t('checkinText')}</p>
            </header>
            <div className="checkin-streak">
              <span>{t('streakLabel', { streak, total: CHECKIN_POINTS.length })}</span>
              <i>
                <em style={{ width: `${(streak / CHECKIN_POINTS.length) * 100}%` }} />
              </i>
            </div>
            <ol className="checkin-days">
              {CHECKIN_POINTS.map((points, index) => {
                const day = index + 1;
                const done = day <= hub.checkin.streak;
                const today = !hub.checkin.doneToday && day === hub.checkin.streak + 1;
                return (
                  <li
                    key={day}
                    className={`${done ? 'is-done' : ''}${today ? ' is-today' : ''}${day === 7 ? ' is-gift' : ''}`}
                  >
                    <span className="checkin-mark">
                      {done ? (
                        <PromoIcon name="check" size={16} />
                      ) : day === 7 ? (
                        <PromoIcon name="gift" size={16} />
                      ) : (
                        `+${points}`
                      )}
                    </span>
                    <small>{t('day', { day })}</small>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              className="promo-button"
              disabled={busy || hub.checkin.doneToday || !hub.loyaltyOpen}
              onClick={() =>
                void act(
                  () => PromotionApi.checkin(),
                  (value) =>
                    value.couponCode
                      ? t('checkinGift', { code: value.couponCode })
                      : t('checkinDone', { points: value.points }),
                )
              }
            >
              {!hub.loyaltyOpen
                ? t('comingSoon')
                : hub.checkin.doneToday
                  ? t('checkedIn')
                  : t('checkinNow', { points: hub.checkin.nextReward.points })}
            </button>
          </article>

          <article className="promo-card promo-wheel">
            <header>
              <h2>{t('wheelTitle')}</h2>
              <p>{t('wheelText')}</p>
            </header>
            <LuckyWheel
              prizes={hub.wheel.prizes}
              disabled={!hub.loyaltyOpen || hub.wheel.spunToday || busy}
              onSpin={async () => {
                const result = await act(
                  () => PromotionApi.spin(),
                  (value) =>
                    value.couponCode
                      ? t('wheelWonCode', { prize: value.label, code: value.couponCode })
                      : t('wheelWon', { prize: value.label }),
                );
                return result ? result.index : null;
              }}
            />
          </article>
        </section>

        <section id="missions" className="promo-section">
          <header className="promo-section-head">
            <div>
              <h2>{t('missionsTitle')}</h2>
              <p>{t('missionsText')}</p>
            </div>
            <span className="mission-progress">
              <b>
                {missionsDone}/{hub.missions.length}
              </b>
              <i>
                <em style={{ width: `${(missionsDone / Math.max(1, hub.missions.length)) * 100}%` }} />
              </i>
            </span>
          </header>
          <ul className="mission-grid">
            {hub.missions.map((mission) => {
              const ready = mission.ready || mission.key === 'share';
              return (
                <li key={mission.key} className={mission.claimed ? 'is-done' : ready ? 'is-ready' : ''}>
                  <span className="mission-icon" aria-hidden="true">
                    <PromoIcon name={mission.claimed ? 'check' : (MISSION_ICONS[mission.key] ?? 'star')} size={22} />
                  </span>
                  <span className="mission-points">+{mission.points}</span>
                  <span className="mission-copy">
                    <strong>{t(`missions.${mission.key}.title`)}</strong>
                    <small>{t(`missions.${mission.key}.text`)}</small>
                  </span>
                  <button
                    type="button"
                    disabled={busy || mission.claimed || !hub.loyaltyOpen || !ready}
                    onClick={() => {
                      if (mission.key === 'share' && typeof navigator !== 'undefined' && navigator.share)
                        void navigator
                          .share({ title: 'Model Universe', url: window.location.origin })
                          .catch(() => undefined);
                      void act(
                        () => PromotionApi.mission(mission.key),
                        (value) => t('missionDone', { points: value.points }),
                      );
                    }}
                  >
                    {mission.claimed ? t('claimed') : ready ? t('claim') : t('notYet')}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="tiers" className="promo-section">
          <header className="promo-section-head">
            <div>
              <h2>{t('tiersTitle')}</h2>
              <p>{t('tiersText')}</p>
            </div>
          </header>
          <div className="tier-table-wrap">
            <table className="tier-table">
              <thead>
                <tr>
                  <th scope="col">{t('tierColumn')}</th>
                  {LOYALTY_TIERS.map((tier, index) => (
                    <th
                      key={tier.name}
                      scope="col"
                      className={`tier-${tier.name.toLowerCase()}${index === tierIndex ? ' is-current' : ''}`}
                    >
                      <span className="tier-chip">{tiers(tier.name)}</span>
                      {index === tierIndex && <small>{t('youAreHere')}</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t('rowPoints')}</th>
                  {LOYALTY_TIERS.map((tier, index) => (
                    <td key={tier.name} className={index === tierIndex ? 'is-current' : ''}>
                      {tier.points.toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN')}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{t('rowSpend')}</th>
                  {LOYALTY_TIERS.map((tier, index) => (
                    <td key={tier.name} className={index === tierIndex ? 'is-current' : ''}>
                      {tier.points ? money(tier.points * 40_000) : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{t('rowRank')}</th>
                  {LOYALTY_TIERS.map((tier, index) => {
                    const rank = RANK_BENEFITS.find((benefit) => benefit.tier === tier.name);
                    return (
                      <td key={tier.name} className={index === tierIndex ? 'is-current' : ''}>
                        {rank
                          ? t('rankCell', {
                              percent: (rank.bps / 100).toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN'),
                              cap: money(rank.capVnd),
                            })
                          : '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="promo-footnote">{t('rules')}</p>
        </section>
      </div>
    </div>
  );
}
