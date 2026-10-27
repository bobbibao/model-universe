'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Api from '@/core/client/api/Api';
import FinanceDialog from '../finance/FinanceDialog';
import { formatVND } from '@/shared/server/utils/utils';
import { useRouter } from '@/i18n/navigation';
interface Quote {
  totalVnd: number;
  merchandiseVnd: number;
  discountVnd: number;
  minimumInitialVnd: number;
  ruleVersion: string;
  terms: string;
}
export default function HoldRequestDialog({
  productId,
  quantity,
  onClose,
}: {
  productId: number;
  quantity: number;
  onClose: () => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null),
    [coupon, setCoupon] = useState(''),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const key = useRef<string | null>(null),
    router = useRouter();
  const preview = useCallback(
    async (code: string) => {
      setBusy(true);
      setQuote(null);
      try {
        setQuote((await Api.post('/reservations/quote', { productId, quantity, couponCode: code })).data);
        setFailed(false);
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    },
    [productId, quantity],
  );
  useEffect(() => {
    void preview('');
  }, [preview]);
  return (
    <FinanceDialog title="Giữ mô hình này" onClose={onClose}>
      <div className="space-y-4 p-5">
        <p className="mu-note">
          Cọc giữ hàng khác khoản trả trước 10% khi mua. Chỉ bắt đầu giữ khi tiền hợp lệ và tồn kho đã được đặt giữ
          thành công.
        </p>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            key.current = null;
            void preview(coupon);
          }}
        >
          <label className="mu-field flex-1">
            Mã ưu đãi (không bắt buộc)
            <input
              value={coupon}
              onChange={(e) => {
                setCoupon(e.target.value);
                setQuote(null);
              }}
              maxLength={100}
            />
          </label>
          <button className="mu-button" disabled={busy}>
            Tính lại
          </button>
        </form>
        {failed && <p role="alert">Chưa lấy được báo giá giữ hàng. Vui lòng thử lại.</p>}
        {quote && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              key.current ||= crypto.randomUUID();
              setBusy(true);
              try {
                const result = (
                  await Api.post('/reservations', {
                    productId,
                    quantity,
                    couponCode: coupon,
                    expectedTotal: quote.totalVnd,
                    requestKey: key.current,
                    termsAccepted: true,
                    termsVersion: quote.ruleVersion,
                  })
                ).data;
                router.push(`/reservations?hold=${result.id}`);
                onClose();
              } catch {
                /* The shared API displays the verified server error. */
              } finally {
                setBusy(false);
              }
            }}
          >
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt>Tiền hàng</dt>
              <dd className="text-right">{formatVND(quote.merchandiseVnd, 'vi')}</dd>
              <dt>Ưu đãi hợp lệ</dt>
              <dd className="text-right">−{formatVND(quote.discountVnd, 'vi')}</dd>
              <dt className="font-semibold">Tổng tính cọc</dt>
              <dd className="text-right font-bold">{formatVND(quote.totalVnd, 'vi')}</dd>
              <dt>Cọc tối thiểu 20%</dt>
              <dd className="text-right font-bold">{formatVND(quote.minimumInitialVnd, 'vi')}</dd>
            </dl>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
              {[
                ['20% – dưới 40%', '10 ngày'],
                ['40% – dưới 50%', '15 ngày'],
                ['50% – dưới 60%', '25 ngày'],
                ['60% – dưới 70%', '30 ngày'],
                ['70% – dưới 100%', '45 ngày'],
                ['Đúng 100%', 'Đã trả đủ'],
              ].map(([tier, days]) => (
                <div className="flex flex-wrap justify-between gap-2 border-b border-slate-200 py-2" key={tier}>
                  <span>{tier}</span>
                  <b>{days}</b>
                </div>
              ))}
            </div>
            <p className="mu-note whitespace-pre-line">{quote.terms}</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" required />
              Tôi đã đọc và chấp thuận điều khoản giữ hàng ở trên.
            </label>
            <button className="mu-button w-full" disabled={busy}>
              Tạo yêu cầu giữ hàng
            </button>
          </form>
        )}
      </div>
    </FinanceDialog>
  );
}
