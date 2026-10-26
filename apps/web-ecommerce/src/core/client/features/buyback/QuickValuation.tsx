'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import Api from '@/core/client/api/Api';
import { formatVND } from '@/shared/server/utils/utils';
import { memberPrice } from '@/shared/pricing';
import type { BuybackEstimate } from '@/shared/buyback-pricing';
import type { PawnEstimate } from '@/shared/pawn-rules';
import type { ProductSummary } from '@/shared/types/product';
import CatalogCombobox from './CatalogCombobox';
import './quick-valuation.css';

export type ValuationFocus = 'sell' | 'trade' | 'pawn';

interface Valuation {
  product: {
    id: number;
    name: string;
    sku: string;
    imageUrl: string;
    brandName: string;
    listPriceVnd: number;
    memberPriceVnd: number;
  };
  buyback: BuybackEstimate;
  pawn: PawnEstimate & { simulation: { days: number; owedVnd: number }[] };
}

export type ValuationRequest =
  | { kind: 'buyback' | 'pawn'; product: ProductSummary }
  | { kind: 'trade'; product: ProductSummary; tradeItem: ProductSummary }
  | { kind: 'manual' };

// The quick valuation of one service page (owner rule of 2026-10-26): the customer chooses a model the shop sells,
// confirms their unit is new like the shop's, and sees this page's price only: the buyback price (S minus the shop's
// margin), the pawn amount C50 (interest only simulated until legal review) or the trade difference against a shop item
// at its member price. Anything else (another condition, a model the shop does not sell) is sent with photos.
export default function QuickValuation({
  focus,
  onRequest,
  initialProductId = null,
}: {
  focus: ValuationFocus;
  onRequest: (request: ValuationRequest) => void;
  // A model chosen on another service page (?mau=<id>).
  initialProductId?: number | null;
}) {
  const locale = useLocale(),
    en = locale === 'en';
  const money = (amount: number) => formatVND(amount, locale);
  const [product, setProduct] = useState<ProductSummary | null>(null);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmedNew, setConfirmedNew] = useState(false);
  const [tradeItem, setTradeItem] = useState<ProductSummary | null>(null);

  useEffect(() => {
    if (!initialProductId) return;
    let active = true;
    Api.get(`/valuation/${initialProductId}`)
      .then(({ data }: { data: Valuation }) => {
        if (active)
          setProduct({
            id: data.product.id,
            name: data.product.name,
            brandName: data.product.brandName,
            imageUrl: data.product.imageUrl,
            price: data.product.listPriceVnd,
          } as ProductSummary);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initialProductId]);

  useEffect(() => {
    setValuation(null);
    setFailed(false);
    setConfirmedNew(false);
    if (!product) return;
    let active = true;
    Api.get(`/valuation/${product.id}`)
      .then(({ data }) => active && setValuation(data))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [product]);

  const buyback = valuation?.buyback.manualReview ? null : (valuation?.buyback.estimateVnd ?? null);
  const pawn = valuation?.pawn.amountVnd ?? null;
  // As the server quotes it: the shop item at its member price (R with MEMBER10).
  const tradePrice = tradeItem ? memberPrice(tradeItem.price) : null;
  const difference = tradePrice !== null && buyback !== null ? tradePrice - buyback : null;
  const amount = focus === 'pawn' ? pawn : focus === 'sell' ? buyback : difference;
  const needsShop = !!valuation && (focus === 'pawn' ? pawn === null : buyback === null);
  const ready = !!valuation && confirmedNew && amount !== null;

  const copy = {
    sell: {
      kicker: en ? 'Buyback · quick valuation' : 'Thu mua · định giá nhanh',
      title: en ? 'What will the shop pay for your model?' : 'Shop thu mô hình của bạn giá bao nhiêu?',
      result: en ? 'Expected buyback price' : 'Giá thu dự kiến',
      action: en ? 'Request the buyback' : 'Gửi yêu cầu thu mua',
    },
    trade: {
      kicker: en ? 'Trade · quick valuation' : 'Trade · định giá nhanh',
      title: en ? 'Trade your model for one from the shop' : 'Đổi mô hình của bạn lấy món của shop',
      result: en ? 'Difference' : 'Chênh lệch',
      action: en ? 'Request this trade' : 'Gửi yêu cầu đổi hàng',
    },
    pawn: {
      kicker: en ? 'Pawn · quick valuation' : 'Cầm cố · định giá nhanh',
      title: en ? 'How much can you pawn your model for?' : 'Mô hình của bạn cầm được bao nhiêu?',
      result: en ? 'Expected pawn amount' : 'Giá cầm dự kiến',
      action: en ? 'Request a pawn' : 'Gửi yêu cầu cầm',
    },
  }[focus];

  const emptyText = !valuation
    ? failed
      ? en
        ? 'The valuation could not be loaded. Sign in and try again.'
        : 'Chưa tải được định giá. Hãy đăng nhập rồi thử lại.'
      : en
        ? 'Choose your model to see the price.'
        : 'Chọn mô hình để xem giá.'
    : needsShop
      ? en
        ? 'This model needs the shop to look at it: send its photos below.'
        : 'Mẫu này cần shop xem trực tiếp: gửi ảnh ở bên dưới.'
      : focus === 'trade' && !tradeItem
        ? en
          ? 'Choose the item you want from the shop.'
          : 'Chọn món bạn muốn nhận từ shop.'
        : null;

  return (
    <section className={`qv is-${focus}`} aria-label={copy.title}>
      <header className="qv-head">
        <span className="qv-kicker">{copy.kicker}</span>
        <h2>{copy.title}</h2>
        <p>
          {en
            ? 'Online prices apply to a new unit of a model the shop sells: the same model and version, boxed, complete and without defects.'
            : 'Giá trên web áp dụng cho hàng mới của mẫu shop đang bán: đúng mẫu và phiên bản, còn hộp, đủ phụ kiện, không lỗi.'}
        </p>
      </header>

      <div className="qv-grid">
        <ol className="qv-steps">
          <li className="qv-step">
            <span className="qv-step-number" aria-hidden="true">
              1
            </span>
            <CatalogCombobox label={en ? 'Your model' : 'Mô hình của bạn'} value={product} onChange={setProduct} />
          </li>
          {focus === 'trade' && (
            <li className="qv-step">
              <span className="qv-step-number" aria-hidden="true">
                2
              </span>
              <CatalogCombobox
                label={en ? 'The item you want from the shop' : 'Món bạn muốn nhận từ shop'}
                value={tradeItem}
                onChange={setTradeItem}
                showPrice
              />
            </li>
          )}
          <li className="qv-step">
            <span className="qv-step-number" aria-hidden="true">
              {focus === 'trade' ? 3 : 2}
            </span>
            <label className={`qv-confirm${valuation ? '' : ' is-disabled'}`}>
              <input
                type="checkbox"
                disabled={!valuation}
                checked={confirmedNew}
                onChange={(event) => setConfirmedNew(event.target.checked)}
              />
              <span>
                {en
                  ? 'My unit is new: the same model and version, boxed, with every accessory and without defects.'
                  : 'Mô hình của tôi còn mới: đúng mẫu và phiên bản, còn hộp, đủ phụ kiện, không lỗi.'}
              </span>
            </label>
          </li>
        </ol>

        <aside className={`qv-result${ready ? ' is-ready' : ''}`} aria-live="polite">
          <span className="qv-result-label">{copy.result}</span>
          {emptyText ? (
            <p className="qv-result-empty" role={failed ? 'alert' : undefined}>
              {emptyText}
            </p>
          ) : (
            <>
              <strong className="qv-amount">
                {focus === 'trade' && difference === 0 ? (en ? 'Even' : 'Ngang giá') : money(Math.abs(amount ?? 0))}
              </strong>
              {focus === 'trade' && difference !== null && difference !== 0 && (
                <span className="qv-direction">
                  {difference > 0
                    ? en
                      ? 'you pay the shop'
                      : 'bạn trả thêm'
                    : en
                      ? 'the shop pays you'
                      : 'shop trả lại bạn'}
                </span>
              )}
              {(focus === 'trade' || focus === 'pawn') && (
                <dl className="qv-breakdown">
                  {focus === 'trade' && (
                    <>
                      <div>
                        <dt>{en ? 'Shop item at member price' : 'Món của shop (giá thành viên)'}</dt>
                        <dd>{money(tradePrice!)}</dd>
                      </div>
                      <div>
                        <dt>{en ? 'Buyback price of your model' : 'Giá thu mô hình của bạn'}</dt>
                        <dd>− {money(buyback!)}</dd>
                      </div>
                    </>
                  )}
                  {focus === 'pawn' &&
                    valuation!.pawn.simulation.map((row) => (
                      <div key={row.days}>
                        <dt>{en ? `To redeem after ${row.days} days*` : `Chuộc sau ${row.days} ngày*`}</dt>
                        <dd>{money(row.owedVnd)}</dd>
                      </div>
                    ))}
                </dl>
              )}
              <p className="qv-fineprint">
                {focus === 'pawn'
                  ? en
                    ? '* Simulated 0.3% a day compound interest: not charged until legal review. Confirmed after inspection.'
                    : '* Mô phỏng lãi kép 0,3%/ngày: chưa áp dụng, chờ thẩm định pháp lý. Chốt sau khi kiểm hàng.'
                  : focus === 'trade'
                    ? en
                      ? 'Final after the shop inspects your model. Trade value earns no points.'
                      : 'Chốt sau khi shop kiểm tra hàng. Giá trị đổi hàng không tích điểm.'
                    : en
                      ? 'Final after the shop inspects the actual unit.'
                      : 'Giá chốt sau khi shop kiểm tra hàng thực tế.'}
              </p>
            </>
          )}
          <button
            type="button"
            className="qv-cta"
            disabled={!ready}
            onClick={() =>
              focus === 'trade'
                ? onRequest({ kind: 'trade', product: product!, tradeItem: tradeItem! })
                : onRequest({ kind: focus === 'pawn' ? 'pawn' : 'buyback', product: product! })
            }
          >
            {copy.action}
          </button>
          {valuation && !confirmedNew && !needsShop && (
            <small className="qv-cta-hint">
              {en ? 'Confirm the condition to continue.' : 'Xác nhận tình trạng hàng để tiếp tục.'}
            </small>
          )}
        </aside>
      </div>

      <aside className="qv-manual">
        <div>
          <strong>
            {en
              ? 'Used, missing accessories, faulty, or a model the shop does not sell?'
              : 'Hàng đã qua sử dụng, thiếu phụ kiện, có lỗi hoặc mẫu shop không bán?'}
          </strong>
          <p>
            {en
              ? 'Send its real photos, a video and its condition: the shop will quote it.'
              : 'Gửi ảnh, video thật và tình trạng: shop sẽ báo giá cho bạn.'}
          </p>
        </div>
        <div className="qv-manual-actions">
          <button type="button" className="qv-secondary" onClick={() => onRequest({ kind: 'manual' })}>
            {en ? 'Send my model for a quote' : 'Gửi thông tin để shop định giá'}
          </button>
          <Link href="/contact" className="qv-link">
            {en ? 'Contact the shop' : 'Liên hệ cửa hàng'}
          </Link>
        </div>
      </aside>
    </section>
  );
}
