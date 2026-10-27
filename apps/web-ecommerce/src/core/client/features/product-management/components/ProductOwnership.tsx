'use client';
import { useState } from 'react';
import Api from '@/core/client/api/Api';
export default function ProductOwnership({ productId }: { productId: number }) {
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  return (
    <details className="mt-4 rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">Quyền sở hữu · điều kiện nhận cọc giữ hàng</summary>
      <p className="mu-note mt-2">
        Compliance đối chiếu nguồn hàng và quyền định đoạt. Tài sản còn cầm cố hoặc tranh chấp bị chặn; không tự xác
        minh dữ liệu cũ.
      </p>
      {saved ? (
        <p role="status" className="mt-3 text-sm">
          Đã lưu căn cứ xác minh và audit log.
        </p>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await Api.post(`/admin/products/${productId}/verify-ownership`, {
                ownershipVerified: f.has('ownershipVerified'),
                reference: f.get('reference'),
              });
              setSaved(true);
            } catch {
              /* The shared API displays the verified server error. */
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="mu-field">
            Căn cứ nguồn hàng / hồ sơ quyền sở hữu
            <input name="reference" required minLength={8} maxLength={1000} />
          </label>
          <label className="flex gap-2 text-sm">
            <input name="ownershipVerified" type="checkbox" required />
            Đã kiểm tra quyền sở hữu hợp lệ để bán và giữ hàng
          </label>
          <button type="submit" className="mu-button" disabled={busy}>
            Lưu xác minh quyền sở hữu
          </button>
        </form>
      )}
    </details>
  );
}
