'use client';

import { useCallback, useEffect, useState } from 'react';
import Api from '@/core/client/api/Api';
import { formatVND } from '@/shared/server/utils/utils';
import { SOURCE_REASON_TEXT } from '@/shared/refund-to-source';

type Preview =
  | {
      ok: true;
      amountVnd: number;
      bankName: string | null;
      maskedAccount: string;
      accountName: string | null;
      automatic: boolean;
      perRefundCapVnd: number;
      dailyLeftVnd: number;
    }
  | { ok: false; reason: string; amountVnd: number };

const OTHER_REASONS: Record<string, string> = {
  existing_refund: 'Đã có yêu cầu hoàn cho khoản này. Xem lịch sử hoàn tiền.',
  nothing_owed: 'Không còn khoản nào phải hoàn.',
};

// Admin panel on a cancelled order or hold: refund to the account that paid, as payOS reported it. Within the owner's
// automatic limits the refund is sent at once; above them it waits for another reviewer.
export default function RefundToSource({
  purpose,
  entityId,
  onUpdated,
}: {
  purpose: 'purchase_refund' | 'hold_refund';
  entityId: number;
  onUpdated: () => void;
}) {
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setPreview((await Api.get('/admin/commerce/money-operations/source', { params: { purpose, entityId } })).data);
    } catch {
      setPreview(undefined);
    }
  }, [purpose, entityId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!preview || (!preview.ok && preview.reason === 'nothing_owed')) return null;

  if (!preview.ok)
    return (
      <div className="rounded-xl border border-slate-200 p-4 text-sm">
        <strong>Hoàn về tài khoản đã thanh toán: không dùng được</strong>
        <p className="mu-note mt-1">
          {SOURCE_REASON_TEXT[preview.reason as keyof typeof SOURCE_REASON_TEXT] ||
            OTHER_REASONS[preview.reason] ||
            preview.reason}{' '}
          {preview.reason !== 'existing_refund' && 'Dùng form "Yêu cầu hoàn tiền" để nhập tài khoản nhận.'}
        </p>
      </div>
    );

  return (
    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-slate-800">
      <strong className="block text-base">Hoàn về tài khoản đã thanh toán</strong>
      <p className="mt-1">
        {preview.bankName || 'Ngân hàng'} {preview.maskedAccount}
        {preview.accountName ? ` · ${preview.accountName}` : ''} · <strong>{formatVND(preview.amountVnd, 'vi')}</strong>
      </p>
      <p className="mt-1 text-slate-700">
        {preview.automatic
          ? 'Trong hạn mức tự động: tiền được gửi ngay qua payOS, không cần người duyệt.'
          : `Vượt hạn mức tự động (${formatVND(preview.perRefundCapVnd, 'vi')}/lệnh, còn ${formatVND(preview.dailyLeftVnd, 'vi')} hôm nay): tạo yêu cầu, người khác duyệt rồi mới gửi.`}{' '}
        Tài khoản lấy từ dữ liệu có chữ ký của payOS, không ai sửa được.
      </p>
      <button
        type="button"
        className="mu-button mt-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await Api.post('/admin/commerce/money-operations/refund-to-source', { purpose, entityId });
            onUpdated();
          } catch {
            /* The shared API shows the server's message. */
          } finally {
            setBusy(false);
            void load();
          }
        }}
      >
        {preview.automatic ? 'Hoàn ngay về tài khoản này' : 'Tạo yêu cầu hoàn về tài khoản này'}
      </button>
    </div>
  );
}
