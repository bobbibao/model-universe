'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatVND } from '@/shared/server/utils/utils';
import ServiceIcon from './ServiceIcon';

type SummaryRow = {
  key: string;
  name: string;
  type: 'new' | 'preowned';
  conditions: string[];
  conditionCount: number;
  hasNote: boolean;
  price: number | null;
  pending: boolean;
};

export default function ServiceSummary({
  kind,
  rows,
  shopItems,
  canContinue,
  requestOpen,
  onContinue,
  onEdit,
}: {
  kind: 'sell' | 'trade' | 'pawn';
  rows: SummaryRow[];
  shopItems: { id: number; name: string; price: number }[];
  canContinue: boolean;
  requestOpen: boolean;
  onContinue: () => void;
  onEdit: (key: string) => void;
}) {
  const locale = useLocale(),
    en = locale === 'en',
    id = useId();
  const t = useTranslations('serviceBasket');
  const money = (value: number) => formatVND(value, locale);
  const root = useRef<HTMLElement>(null);
  const [showTrack, setShowTrack] = useState(false);
  const [navHeight, setNavHeight] = useState(72);
  useEffect(() => {
    const summary = root.current,
      basket = summary?.closest('.qv');
    if (!summary || !basket) return;
    let inBasket = false,
      inSummary = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === basket) inBasket = entry.isIntersecting;
          else inSummary = entry.isIntersecting;
        }
        setShowTrack(inBasket && !inSummary);
      },
      { rootMargin: '-80px 0px -100px 0px' },
    );
    observer.observe(summary);
    observer.observe(basket);
    const nav = document.querySelector('.mu-mobile-nav');
    const resize = new ResizeObserver(() => setNavHeight(nav?.getBoundingClientRect().height || 0));
    if (nav) resize.observe(nav);
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, []);
  const priced = rows.filter((row) => row.price !== null && !row.pending);
  const pending = rows.filter((row) => row.pending).length;
  const unpriced = rows.length - priced.length - pending;
  const subtotal = priced.reduce((sum, row) => sum + row.price!, 0);
  const shopTotal = shopItems.reduce((sum, row) => sum + row.price, 0);
  const allPriced = rows.length > 0 && priced.length === rows.length;
  const tradeReady = kind === 'trade' && allPriced && shopItems.length > 0;
  const difference = shopTotal - subtotal;
  const ready = canContinue && !pending;
  const totalLabel = tradeReady
    ? difference > 0
      ? en
        ? 'You would pay'
        : 'Bạn dự kiến bù thêm'
      : difference < 0
        ? en
          ? 'The shop would pay you'
          : 'Shop dự kiến trả lại bạn'
        : en
          ? 'Estimated exchange'
          : 'Chênh lệch dự kiến'
    : allPriced
      ? kind === 'pawn'
        ? en
          ? 'Estimated pawn amount'
          : 'Giá cầm dự kiến'
        : en
          ? 'Estimated buyback amount'
          : 'Giá thu dự kiến'
      : priced.length
        ? en
          ? `Subtotal · ${priced.length} priced models`
          : `Tạm tính · ${priced.length} mô hình có giá`
        : pending
          ? en
            ? 'Checking conditions'
            : 'Đang đối chiếu tình trạng'
          : en
            ? 'Individual quote after inspection'
            : 'Báo giá riêng sau kiểm hàng';
  const totalValue = tradeReady
    ? difference === 0
      ? en
        ? 'Even exchange'
        : 'Ngang giá'
      : money(Math.abs(difference))
    : priced.length
      ? money(subtotal)
      : pending
        ? en
          ? 'Checking prices…'
          : 'Đang đối chiếu giá…'
        : en
          ? 'The shop will quote'
          : 'Shop sẽ báo giá';
  const missingName = rows.some((row) => !row.name.trim());
  const reveal = () => {
    root.current?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    root.current?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
  };
  return (
    <>
      <aside ref={root} className={`qv-result${ready ? ' is-ready' : ''}`} aria-labelledby={id}>
        <header className="qv-summary-heading">
          <h3 id={id} tabIndex={-1}>
            {en ? 'Your request' : 'Tóm tắt yêu cầu'}
          </h3>
          <span>
            {rows.length} {en ? 'models' : 'mô hình'}
          </span>
        </header>
        <ol className="qv-summary-steps" aria-label={en ? 'Request steps' : 'Các bước gửi yêu cầu'}>
          <li aria-current={!requestOpen ? 'step' : undefined}>
            <span>{requestOpen ? <ServiceIcon name="check" size={12} /> : '1'}</span>
            {en ? 'Models & condition' : 'Mô hình & tình trạng'}
          </li>
          <li aria-current={requestOpen ? 'step' : undefined}>
            <span>2</span>
            {en ? 'Photos & confirmation' : 'Ảnh & xác nhận'}
          </li>
        </ol>
        {!rows.length ? (
          <p className="qv-summary-empty">
            {en
              ? 'Choose a catalog model or add one the shop does not carry.'
              : 'Chọn mô hình trong danh mục, hoặc thêm mẫu shop chưa có.'}
          </p>
        ) : (
          <>
            <ol className="qv-summary-items" aria-label={en ? 'Your models' : 'Các mô hình trong yêu cầu'}>
              {rows.map((row, index) => (
                <li key={row.key}>
                  <button
                    type="button"
                    className={`qv-summary-item${!row.name.trim() ? ' needs-name' : ''}`}
                    onClick={() => onEdit(row.key)}
                    aria-label={`${en ? 'Edit' : 'Chỉnh sửa'} ${row.name.trim() || `${en ? 'model' : 'mô hình'} ${index + 1}`}`}
                  >
                    <span className="qv-summary-index">{index + 1}</span>
                    <span className="qv-summary-copy">
                      <strong>{row.name.trim() || (en ? 'Model name needed' : 'Chưa nhập tên mô hình')}</strong>
                      <small>
                        {row.type === 'new' ? 'New' : '2hand'} ·{' '}
                        {row.conditions.length
                          ? row.conditions.join(' · ')
                          : row.conditionCount
                            ? `${row.conditionCount} ${en ? 'conditions' : 'mục tình trạng'}`
                            : en
                              ? 'No issues recorded'
                              : 'Không ghi nhận lỗi'}
                        {row.hasNote && ` · ${en ? 'Has a note' : 'Có ghi chú'}`}
                      </small>
                    </span>
                    <span className={`qv-summary-price${row.price === null ? ' is-pending' : ''}`}>
                      {row.pending
                        ? en
                          ? 'Checking…'
                          : 'Đang kiểm tra…'
                        : row.price !== null
                          ? money(row.price)
                          : en
                            ? 'Individual quote'
                            : 'Chờ báo giá'}
                      <small>{en ? 'Edit' : 'Chỉnh sửa'}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {kind === 'trade' && (
              <section className="qv-summary-trade">
                <h4>{en ? 'Items from the shop' : 'Món bạn muốn nhận'}</h4>
                {shopItems.length ? (
                  <ul>
                    {shopItems.map((item) => (
                      <li key={item.id}>
                        <span>{item.name}</span>
                        <strong>{money(item.price)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {en ? 'Choose an item to see the exchange difference.' : 'Chọn món của shop để xem chênh lệch.'}
                  </p>
                )}
              </section>
            )}
            <div className="qv-summary-total" role="status" aria-live="polite">
              <span>{totalLabel}</span>
              <strong>{totalValue}</strong>
              {!!unpriced && (
                <p className="qv-summary-quote">
                  {en
                    ? `${unpriced} model(s) await an individual quote.`
                    : `${unpriced} mô hình cần shop báo giá riêng.`}
                  {priced.length > 0 && ` ${en ? 'Not included in the subtotal.' : 'Chưa tính vào số tiền trên.'}`}
                </p>
              )}
              {!!pending && <p>{en ? `Checking ${pending} model(s)…` : `Đang đối chiếu ${pending} mô hình…`}</p>}
              {kind === 'trade' && shopItems.length > 0 && (
                <dl>
                  <div>
                    <dt>{en ? 'Shop items' : 'Giá món của shop'}</dt>
                    <dd>{money(shopTotal)}</dd>
                  </div>
                  <div>
                    <dt>{en ? 'Priced buyback models' : 'Giá thu đã có'}</dt>
                    <dd>{priced.length ? money(subtotal) : '—'}</dd>
                  </div>
                </dl>
              )}
            </div>
            <p className="qv-summary-note">
              {t(`${kind}.note`)}
              {kind === 'trade' &&
                !allPriced &&
                ` ${en ? 'The exchange difference follows the final quote.' : 'Chênh lệch được tính sau khi có đủ báo giá.'}`}
            </p>
          </>
        )}
        <button type="button" className="qv-cta" disabled={!ready} onClick={onContinue}>
          {requestOpen
            ? en
              ? 'View photos step'
              : 'Xem bước thêm ảnh'
            : en
              ? 'Continue: add photos'
              : 'Tiếp tục: thêm ảnh'}
          <ServiceIcon name="arrow" size={17} />
        </button>
        <p className="qv-summary-next">
          {!rows.length
            ? en
              ? 'Add a model to continue.'
              : 'Thêm mô hình để tiếp tục.'
            : missingName
              ? en
                ? 'Enter a name for each model.'
                : 'Nhập tên cho mô hình ngoài danh mục.'
              : kind === 'trade' && !shopItems.length
                ? en
                  ? 'Choose an item from the shop.'
                  : 'Chọn món bạn muốn nhận từ shop.'
                : en
                  ? 'Nothing is sent until you add photos and confirm.'
                  : 'Chỉ gửi yêu cầu sau khi bạn thêm ảnh và xác nhận.'}
        </p>
      </aside>
      {rows.length > 0 && (
        <button
          type="button"
          className="qv-mobile-track"
          hidden={!showTrack}
          style={{ bottom: navHeight + 10 }}
          onClick={reveal}
        >
          <span>
            <strong>
              {rows.length} {en ? 'models' : 'mô hình'}
              {unpriced > 0 && ` · ${unpriced} ${en ? 'await quote' : 'chờ báo giá'}`}
            </strong>
            <small>
              {priced.length
                ? `${en ? 'Priced' : 'Đã có giá'}: ${money(subtotal)}`
                : pending
                  ? en
                    ? 'Checking prices…'
                    : 'Đang đối chiếu giá…'
                  : en
                    ? 'The shop will quote'
                    : 'Shop sẽ báo giá'}
            </small>
          </span>
          <b>
            {en ? 'Summary' : 'Xem tóm tắt'} <ServiceIcon name="arrow" size={15} />
          </b>
        </button>
      )}
    </>
  );
}
