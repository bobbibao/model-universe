'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import Api from '@/core/client/api/Api';
import ProductApi from '@/core/client/api/Product';
import ProductImage from '@/components/ProductImage';
import { formatVND } from '@/shared/server/utils/utils';
import { memberPrice } from '@/shared/pricing';
import type { BuybackEstimate } from '@/shared/buyback-pricing';
import type { PawnEstimate } from '@/shared/pawn-rules';
import type { ProductSummary } from '@/shared/types/product';
import './quick-valuation.css';

interface Valuation {
  product: { id: number; name: string; sku: string; imageUrl: string; brandName: string; memberPriceVnd: number };
  buyback: BuybackEstimate;
  pawn: PawnEstimate & { simulation: { days: number; owedVnd: number }[] };
}

export type ValuationRequest =
  | { kind: 'buyback' | 'pawn'; product: ProductSummary }
  | { kind: 'trade'; product: ProductSummary; tradeItem: ProductSummary }
  | { kind: 'manual' };

// Search the shop's own catalogue (main listings the shop sells).
function CatalogSearch({ label, onPick }: { label: string; onPick: (product: ProductSummary) => void }) {
  const en = useLocale() === 'en';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummary[]>([]);
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void ProductApi.getProducts({ q: query.trim(), per_page: 8 }).then((page) =>
        setResults((page?.data || []).filter((row) => !row.partnerId)),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  return (
    <div className="qv-search">
      <label className="mu-field">
        {label}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={en ? 'Kit code, name or brand…' : 'Mã kit, tên mẫu hoặc hãng…'}
        />
      </label>
      {results.length > 0 && (
        <ul className="qv-results">
          {results.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(row);
                  setQuery('');
                }}
              >
                <span className="qv-thumb">
                  <ProductImage src={row.imageUrl} alt="" sizes="48px" className="object-contain" />
                </span>
                <span>
                  <strong>{row.name}</strong>
                  <small>{row.brandName}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The quick valuation of the services (owner rule of 2026-10-26): the customer picks a model the shop sells, confirms
// their unit is new like the shop's, and sees the buyback price B, the pawn amount C50 (interest only simulated until
// legal review) and, for a trade, the difference D against a shop item at its member price. Anything else (another
// condition, a model the shop does not sell) is sent with photos for the shop to price.
export default function QuickValuation({
  focus,
  onRequest,
  initialProductId = null,
}: {
  focus: 'sell' | 'pawn';
  onRequest: (request: ValuationRequest) => void;
  // A model chosen on the other service page (?mau=<id>).
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
      .then(({ data }: { data: Valuation & { product: { listPriceVnd: number } } }) => {
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
  const reviewText = en
    ? 'This model needs the shop to look at it: send its photos and the shop will quote it.'
    : 'Mẫu này cần shop xem trực tiếp: gửi ảnh để shop báo giá.';

  return (
    <section className="qv mu-panel" aria-label={en ? 'Quick valuation' : 'Định giá nhanh'}>
      <header className="qv-head">
        <span className="mu-eyebrow">{en ? 'QUICK VALUATION' : 'ĐỊNH GIÁ NHANH'}</span>
        <h2>
          {focus === 'pawn'
            ? en
              ? 'How much can I pawn my model for?'
              : 'Mô hình của tôi cầm được bao nhiêu?'
            : en
              ? 'How much will the shop pay for my model?'
              : 'Shop thu mô hình của tôi giá bao nhiêu?'}
        </h2>
        <p className="mu-note">
          {en
            ? 'Choose the same model in the shop. The web price applies to a new unit, the same model and version, with its box and accessories and without defects.'
            : 'Chọn đúng mẫu đang có trong cửa hàng. Giá trên web áp dụng cho hàng mới, đúng mẫu và phiên bản, đủ hộp và phụ kiện, không lỗi.'}
        </p>
      </header>

      <CatalogSearch
        label={en ? 'Your model in the shop catalogue' : 'Mẫu của bạn trong cửa hàng'}
        onPick={setProduct}
      />

      {product && (
        <div className="qv-chosen">
          <span className="qv-thumb is-large">
            <ProductImage src={product.imageUrl} alt={product.name} sizes="96px" className="object-contain" />
          </span>
          <div>
            <strong>{product.name}</strong>
            <small>{product.brandName}</small>
            <button type="button" className="underline" onClick={() => setProduct(null)}>
              {en ? 'Choose another model' : 'Chọn mẫu khác'}
            </button>
          </div>
        </div>
      )}
      {failed && (
        <p role="alert" className="mu-note">
          {en
            ? 'The valuation could not be loaded. Sign in and try again.'
            : 'Chưa tải được định giá. Hãy đăng nhập rồi thử lại.'}
        </p>
      )}

      {valuation && (
        <>
          <label className="qv-confirm">
            <input type="checkbox" checked={confirmedNew} onChange={(event) => setConfirmedNew(event.target.checked)} />
            <span>
              {en
                ? 'My unit is new and the same model and version, with its box and every accessory, and without defects.'
                : 'Mô hình của tôi còn mới, đúng mẫu và phiên bản, đủ hộp và phụ kiện, không lỗi.'}
            </span>
          </label>

          <div className={`qv-prices${confirmedNew ? '' : ' is-muted'}`}>
            <article className={focus === 'sell' ? 'is-focus' : ''}>
              <h3>{en ? 'Shop buys it for' : 'Giá thu dự kiến'}</h3>
              {buyback !== null ? <strong>{money(buyback)}</strong> : <p className="mu-note">{reviewText}</p>}
              <small>
                {en ? 'Confirmed after the shop inspects the unit.' : 'Chốt sau khi shop kiểm tra hàng thực tế.'}
              </small>
              <button
                type="button"
                className="mu-button"
                disabled={!confirmedNew || buyback === null}
                onClick={() => onRequest({ kind: 'buyback', product: product! })}
              >
                {en ? 'Sell at this price' : 'Gửi yêu cầu thu mua'}
              </button>
            </article>

            <article className={focus === 'pawn' ? 'is-focus' : ''}>
              <h3>{en ? 'Pawn amount' : 'Giá cầm dự kiến'}</h3>
              {pawn !== null ? <strong>{money(pawn)}</strong> : <p className="mu-note">{reviewText}</p>}
              {pawn !== null && valuation.pawn.simulation.length > 0 && (
                <table className="qv-simulation">
                  <caption>
                    {en
                      ? 'Simulated 0.3% a day compound interest: not charged until legal review'
                      : 'Mô phỏng lãi kép 0,3%/ngày: chưa áp dụng, chờ thẩm định pháp lý'}
                  </caption>
                  <tbody>
                    {valuation.pawn.simulation.map((row) => (
                      <tr key={row.days}>
                        <th>{en ? `${row.days} days` : `${row.days} ngày`}</th>
                        <td>{money(row.owedVnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button
                type="button"
                className="mu-button"
                disabled={!confirmedNew || pawn === null}
                onClick={() => onRequest({ kind: 'pawn', product: product! })}
              >
                {en ? 'Request a pawn' : 'Gửi yêu cầu cầm'}
              </button>
            </article>

            {focus === 'sell' && (
              <article>
                <h3>{en ? 'Trade it for a shop item' : 'Đổi lấy món của shop'}</h3>
                {tradeItem ? (
                  <div className="qv-trade">
                    <p>
                      {tradeItem.name} · {en ? 'member price' : 'giá thành viên'} {money(tradePrice!)}
                    </p>
                    {difference === null ? (
                      <p className="mu-note">{reviewText}</p>
                    ) : (
                      <strong>
                        {difference > 0
                          ? en
                            ? `You pay ${money(difference)}`
                            : `Bạn trả thêm ${money(difference)}`
                          : difference < 0
                            ? en
                              ? `The shop pays you ${money(-difference)}`
                              : `Shop trả lại ${money(-difference)}`
                            : en
                              ? 'Even trade'
                              : 'Ngang giá'}
                      </strong>
                    )}
                    <button type="button" className="underline" onClick={() => setTradeItem(null)}>
                      {en ? 'Choose another item' : 'Chọn món khác'}
                    </button>
                  </div>
                ) : (
                  <CatalogSearch label={en ? 'Item you want' : 'Món bạn muốn nhận'} onPick={setTradeItem} />
                )}
                <small>
                  {en
                    ? 'D = the item at its member price − the final buyback price. Trade value earns no points.'
                    : 'Chênh lệch = giá món shop sau ưu đãi − giá thu cuối. Giá trị đổi hàng không tích điểm.'}
                </small>
                <button
                  type="button"
                  className="mu-button"
                  disabled={!confirmedNew || !tradeItem || buyback === null}
                  onClick={() => onRequest({ kind: 'trade', product: product!, tradeItem: tradeItem! })}
                >
                  {en ? 'Request this trade' : 'Gửi yêu cầu đổi hàng'}
                </button>
              </article>
            )}
          </div>
        </>
      )}

      <aside className="qv-manual">
        <strong>
          {en
            ? 'Used, missing accessories, faulty, or not in the shop?'
            : 'Hàng đã qua sử dụng, thiếu phụ kiện, có lỗi hoặc không có trong cửa hàng?'}
        </strong>
        <p className="mu-note">
          {en
            ? 'The web only prices new units of models the shop sells. Send your model with real photos, a video and its condition, and the shop will quote it.'
            : 'Web chỉ định giá hàng mới của mẫu shop đang bán. Gửi thông tin mô hình kèm ảnh, video thật và tình trạng để shop báo giá.'}
        </p>
        <div className="qv-manual-actions">
          <button type="button" className="mu-button-secondary" onClick={() => onRequest({ kind: 'manual' })}>
            {en ? 'Send my model for a quote' : 'Gửi thông tin để shop định giá'}
          </button>
          <Link href="/contact" className="underline">
            {en ? 'Contact the shop' : 'Liên hệ cửa hàng'}
          </Link>
        </div>
      </aside>
    </section>
  );
}
