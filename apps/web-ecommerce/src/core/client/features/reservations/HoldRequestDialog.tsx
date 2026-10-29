'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Api from '@/core/client/api/Api';
import FinanceDialog from '../finance/FinanceDialog';
import { formatVND } from '@/shared/server/utils/utils';
import { useRouter } from '@/i18n/navigation';

interface Quote {
  eligible: boolean;
  blockedReason?: string;
  totalVnd: number;
  merchandiseVnd: number;
  discountVnd: number;
  minimumInitialVnd: number;
  ruleVersion: string;
  terms: string;
}

export interface HoldRequestDialogProps {
  productId: number;
  quantity: number;
  productName?: string;
  productImage?: string | null;
  unitPrice?: number;
  onClose: () => void;
}

export default function HoldRequestDialog({
  productId,
  quantity,
  productName,
  productImage,
  unitPrice,
  onClose,
}: HoldRequestDialogProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const key = useRef<string | null>(null);
  const router = useRouter();

  const preview = useCallback(
    async (code: string) => {
      setBusy(true);
      setFailed(false);
      try {
        const response = await Api.post('/reservations/quote', {
          productId,
          quantity,
          couponCode: code.trim(),
        });
        setQuote(response.data);
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
        setInitialLoading(false);
      }
    },
    [productId, quantity],
  );

  useEffect(() => {
    void preview('');
  }, [preview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote || !quote.eligible) return;

    key.current ||= crypto.randomUUID();
    setBusy(true);
    try {
      const result = (
        await Api.post('/reservations', {
          productId,
          quantity,
          couponCode: coupon.trim(),
          expectedTotal: quote.totalVnd,
          requestKey: key.current,
          termsAccepted: true,
          termsVersion: quote.ruleVersion,
        })
      ).data;
      router.push(`/reservations?hold=${result.id}`);
      onClose();
    } catch {
      /* Shared API modal/toaster displays the verified server error */
    } finally {
      setBusy(false);
    }
  };

  return (
    <FinanceDialog
      title="Giữ mô hình này"
      subtitle={productName ? `Đặt cọc bảo lưu sản phẩm · Số lượng: ${quantity}` : undefined}
      onClose={onClose}
      maxWidth={620}
      footer={
        quote && (
          <div className="hold-footer-actions">
            <label className="hold-checkbox-label">
              <input
                type="checkbox"
                required
                form="hold-request-form"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="hold-checkbox"
              />
              <span>Tôi đã đọc và chấp thuận điều khoản giữ hàng ở trên.</span>
            </label>

            <button
              type="submit"
              form="hold-request-form"
              className="hold-submit-btn"
              disabled={busy || !quote.eligible}
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                  Đang xử lý yêu cầu...
                </span>
              ) : (
                'Tạo yêu cầu giữ hàng'
              )}
            </button>
          </div>
        )
      }
    >
      <form id="hold-request-form" onSubmit={handleSubmit} className="hold-dialog-content">
        {/* Product Brief if available */}
        {productName && (
          <div className="hold-product-banner">
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                className="hold-product-thumb"
                loading="lazy"
              />
            ) : (
              <div className="hold-product-thumb flex items-center justify-center text-slate-400 bg-slate-100 dark:bg-slate-800">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {productName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span>Số lượng: <strong className="text-slate-800 dark:text-slate-200">{quantity}</strong></span>
                {unitPrice && (
                  <>
                    <span>·</span>
                    <span>Đơn giá: <strong className="text-slate-800 dark:text-slate-200">{formatVND(unitPrice, 'vi')}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notice Info Card */}
        <div className="hold-notice-card">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div>
            Cọc giữ hàng là khoản đặt cọc bảo lưu sản phẩm. Sau khi thanh toán cọc thành công, tồn kho sẽ được khóa giữ riêng cho bạn và tiền cọc được trừ thẳng vào tổng đơn khi nhận hàng.
          </div>
        </div>

        {/* Coupon Code Bar */}
        <div className="hold-coupon-box">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
            Mã ưu đãi / Coupon (không bắt buộc)
          </label>
          <div className="hold-coupon-row">
            <input
              type="text"
              className="hold-input"
              placeholder="Nhập mã ưu đãi..."
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  key.current = null;
                  void preview(coupon);
                }
              }}
              maxLength={100}
            />
            <button
              type="button"
              className="hold-apply-btn"
              disabled={busy}
              onClick={() => {
                key.current = null;
                void preview(coupon);
              }}
            >
              {busy ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                  Đang tính
                </span>
              ) : (
                'Tính lại'
              )}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {failed && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
            <span>Chưa lấy được báo giá giữ hàng. Vui lòng thử lại.</span>
            <button
              type="button"
              className="underline font-semibold hover:text-rose-900"
              onClick={() => void preview(coupon)}
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Skeleton while initial loading */}
        {initialLoading && !quote && (
          <div className="space-y-3 py-4 animate-pulse">
            <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          </div>
        )}

        {/* Active Quote Content */}
        {quote && (
          <div className="space-y-4">
            {/* Pricing Summary Card */}
            <div className={`hold-quote-card ${busy ? 'opacity-70 transition-opacity' : ''}`}>
              <div className="hold-quote-row">
                <span className="hold-quote-label">Tiền hàng</span>
                <span className="hold-quote-value">{formatVND(quote.merchandiseVnd, 'vi')}</span>
              </div>

              {quote.discountVnd > 0 && (
                <div className="hold-quote-row text-emerald-600 dark:text-emerald-400">
                  <span className="hold-quote-label flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    Ưu đãi hợp lệ
                  </span>
                  <span className="hold-quote-value font-medium">−{formatVND(quote.discountVnd, 'vi')}</span>
                </div>
              )}

              <div className="hold-quote-divider" />

              <div className="hold-quote-row">
                <span className="font-semibold text-slate-800 dark:text-slate-100">Tổng tính cọc</span>
                <span className="font-bold text-slate-900 dark:text-white text-base">{formatVND(quote.totalVnd, 'vi')}</span>
              </div>

              {/* Deposit Highlight Banner */}
              <div className="hold-deposit-highlight">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                      Cọc tối thiểu 20%
                    </div>
                    <div className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-0.5">
                      Được giữ hàng trong 10 ngày đầu tiên
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-purple-700 dark:text-purple-300">
                      {formatVND(quote.minimumInitialVnd, 'vi')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hold Duration Matrix */}
            <div className="hold-tiers-container">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Thời gian giữ hàng theo mức thanh toán cọc
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Càng cọc nhiều, thời hạn càng dài
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {[
                  { tier: '20% – dưới 40%', days: '10 ngày', tag: 'Tối thiểu' },
                  { tier: '40% – dưới 50%', days: '15 ngày' },
                  { tier: '50% – dưới 60%', days: '25 ngày' },
                  { tier: '60% – dưới 70%', days: '30 ngày' },
                  { tier: '70% – dưới 100%', days: '45 ngày' },
                  { tier: 'Đúng 100%', days: 'Đã trả đủ', tag: 'Chờ giao' },
                ].map((item, idx) => (
                  <div
                    key={item.tier}
                    className={`hold-tier-item ${idx === 0 ? 'is-active' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="hold-tier-percent">{item.tier}</span>
                      {item.tag && <span className="hold-tier-tag">{item.tag}</span>}
                    </div>
                    <div className="hold-tier-days">{item.days}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terms Accordion */}
            <details className="hold-terms-accordion group">
              <summary className="hold-terms-summary">
                <span className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600 dark:text-purple-400"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  Xem điều khoản giữ hàng & chính sách hoàn cọc
                </span>
                <svg className="hold-terms-chevron group-open:rotate-180 transition-transform duration-200" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </summary>
              <div className="hold-terms-body">
                <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {quote.terms}
                </p>
              </div>
            </details>

            {/* Ineligible alert if blocked */}
            {!quote.eligible && (
              <div
                role="status"
                className="rounded-xl bg-amber-50 border border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100 p-3.5 text-xs flex items-start gap-2.5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600 flex-shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span>{quote.blockedReason}</span>
              </div>
            )}
          </div>
        )}
      </form>
    </FinanceDialog>
  );
}
