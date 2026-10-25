'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import Api from '@/core/client/api/Api';
import ProductCard from '@/core/client/features/shop/components/ProductCard';
import { useCountdown } from '@/components/PriceTag';
import type { ProductSummary } from '@/shared/types/product';
import './sales.css';

interface SaleEvent {
  id: number;
  title: string;
  description: string | null;
  status: 'running' | 'upcoming' | 'ended';
  startsAt: string;
  endsAt: string | null;
  maximumPercent: number;
  products: (ProductSummary & { plannedPercent?: number })[];
}

// One sale event's own page (/su-kien/<id>), where every "Shop now" / "View event" link leads: the event, its
// countdown and every model in it. An upcoming event shows what will be discounted; an ended one points to the shop.
export default function SaleEventPage({ id }: { id: number }) {
  const en = useLocale() === 'en';
  const [event, setEvent] = useState<SaleEvent | null>();
  useEffect(() => {
    let active = true;
    Api.get(`/sales/${id}`)
      .then(({ data }) => active && setEvent(data))
      .catch(() => active && setEvent(null));
    return () => {
      active = false;
    };
  }, [id]);
  const countdown = useCountdown(
    event?.status === 'upcoming' ? event.startsAt : event?.status === 'running' ? event.endsAt : null,
  );

  if (event === undefined)
    return (
      <p role="status" className="sale-message mu-wrap mu-section">
        {en ? 'Loading the event…' : 'Đang tải sự kiện…'}
      </p>
    );
  if (!event || event.status === 'ended')
    return (
      <section className="sale-zone mu-wrap mu-section">
        <div className="sale-message">
          <h1 className="text-2xl font-bold">
            {event ? event.title : en ? 'Event not found' : 'Không tìm thấy sự kiện'}
          </h1>
          <p>{en ? 'This sale event has ended.' : 'Sự kiện ưu đãi này đã kết thúc.'}</p>
          <div className="sale-hero-links">
            <Link href="/uu-dai#sale">{en ? 'Current offers' : 'Ưu đãi đang diễn ra'} →</Link>
            <Link href="/cua-hang">{en ? 'Explore all models' : 'Khám phá tất cả mô hình'} ↗</Link>
          </div>
        </div>
      </section>
    );

  const upcoming = event.status === 'upcoming';
  return (
    <section className="sale-zone mu-wrap mu-section" aria-label={event.title}>
      <div className="sale-hero">
        <div className="sale-hero-copy">
          <span className="sale-kicker">
            <span className="sale-live-dot" />{' '}
            {upcoming ? (en ? 'COMING SOON' : 'SẮP DIỄN RA') : en ? 'SALE EVENT' : 'SỰ KIỆN SALE'}
          </span>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          {event.description && <p>{event.description}</p>}
          {countdown && (
            <div className="sale-time" aria-label={en ? 'Time remaining' : 'Thời gian còn lại'}>
              <span>{upcoming ? (en ? 'Starts in' : 'Bắt đầu sau') : en ? 'Ends in' : 'Kết thúc sau'}</span>
              {countdown.days > 0 && (
                <strong>
                  {countdown.days}
                  {en ? 'd' : ' ngày'}
                </strong>
              )}
              <strong>{countdown.clock}</strong>
            </div>
          )}
          <div className="sale-hero-links">
            <Link href="/cua-hang">{en ? 'Explore all models' : 'Khám phá tất cả mô hình'} ↗</Link>
            <Link href="/uu-dai">{en ? 'Other offers' : 'Ưu đãi khác'} →</Link>
          </div>
        </div>
        <div className="sale-hero-mark" aria-label={en ? 'Maximum discount' : 'Mức ưu đãi cao nhất'}>
          <span>{en ? 'SAVE UP TO' : 'GIẢM ĐẾN'}</span>
          <strong>
            {event.maximumPercent}
            <small>%</small>
          </strong>
          <span>{en ? 'Selected models · real stock' : 'Mô hình tuyển chọn · Tồn kho thực'}</span>
        </div>
      </div>
      <div className="sale-section-label">
        <h2>
          {upcoming
            ? en
              ? 'On sale when the event starts'
              : 'Giảm giá khi sự kiện bắt đầu'
            : en
              ? 'Every model in this event'
              : 'Tất cả mô hình trong sự kiện'}
        </h2>
        <span>
          {event.products.length} {en ? 'models' : 'mô hình'}
        </span>
      </div>
      {event.products.length ? (
        <div className="sale-products">
          {event.products.map((product) => (
            <div key={product.id} className="relative">
              {upcoming && product.plannedPercent ? (
                <span className="absolute left-2 top-2 z-10 rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
                  −{product.plannedPercent}%
                </span>
              ) : null}
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <p className="sale-message">
          {en ? 'The models of this event are sold out.' : 'Các mô hình của sự kiện đã bán hết.'}
        </p>
      )}
    </section>
  );
}
