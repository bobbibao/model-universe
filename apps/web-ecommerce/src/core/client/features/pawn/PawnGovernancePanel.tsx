'use client';
import DateTimeInput from '@/components/DateTimeInput';
import { useState } from 'react';
import Api from '@/core/client/api/Api';
import type { PawnContract } from '@/shared/types/pawn';
import EvidenceUploader, { type UploadedEvidence } from '../buyback/EvidenceUploader';
import RefundRequest, { RefundHistory } from '../finance/RefundRequest';
import { formatVND } from '@/shared/server/utils/utils';
const money = (v = 0) => formatVND(v, 'vi');
const titles: Record<string, string> = {
  verify_documents: 'Kiểm tra giấy tờ & quyền sở hữu',
  record_notice: 'Ghi nhận thông báo hợp lệ',
  compliance_disposal: 'Compliance duyệt xử lý',
  finance_disposal: 'Finance duyệt đối soát',
  title_transfer: 'Xác nhận chuyển quyền sở hữu',
  mark_dispute: 'Ghi nhận tranh chấp',
  resolve_dispute: 'Giải quyết tranh chấp',
};
export default function PawnGovernancePanel({
  row,
  admin,
  onUpdated,
}: {
  row: PawnContract;
  admin: boolean;
  onUpdated: () => void;
}) {
  const [action, setAction] = useState(
      !row.disbursedAt
        ? 'verify_documents'
        : row.status === 'OVERDUE_REVIEW'
          ? 'record_notice'
          : row.status === 'disposed'
            ? 'title_transfer'
            : 'mark_dispute',
    ),
    [files, setFiles] = useState<UploadedEvidence[]>([]),
    [busy, setBusy] = useState(false);
  const root = admin ? '/admin/pawn' : '/pawn',
    legal = row.terms?.policy.legalMode === 'approved';
  const post = async (endpoint: string, data: Record<string, unknown>) => {
    setBusy(true);
    try {
      await Api.post(`${root}/${row.id}/${endpoint}`, { ...data, expectedVersion: row.version });
      setFiles([]);
      onUpdated();
    } catch {
      /* The shared API displays the verified server error. */
    } finally {
      setBusy(false);
    }
  };
  const needsFiles = ['verify_documents', 'record_notice', 'title_transfer', 'resolve_dispute'].includes(action);
  const choices = [
    !row.disbursedAt && 'verify_documents',
    row.status === 'OVERDUE_REVIEW' && 'record_notice',
    row.status === 'OVERDUE_REVIEW' && 'compliance_disposal',
    row.status === 'OVERDUE_REVIEW' && 'finance_disposal',
    row.status === 'disposed' && 'title_transfer',
    'mark_dispute',
    row.governance?.disputed && 'resolve_dispute',
  ].filter(Boolean) as string[];
  return (
    <div className="space-y-4">
      <div
        role="status"
        className={`rounded-xl border p-4 text-sm ${legal ? 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100' : 'border-amber-200 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'}`}
      >
        <strong>
          {legal
            ? row.terms?.policy.approvalType?.startsWith('owner_')
              ? 'Cầm cố thực tế · chính sách vận hành chủ shop đã duyệt'
              : 'Hồ sơ áp dụng chính sách đã ghi nhận phê duyệt'
            : 'Hồ sơ chưa đủ điều kiện giải ngân'}
        </strong>
        <p className="mt-1">
          C50 = 50% giá S đúng SKU đã duyệt.{' '}
          {row.terms?.policy.dailyRateBasisPoints === 0
            ? 'Lãi suất 0%, không phí ẩn theo chính sách hiện tại.'
            : row.terms?.policy.calculation === 'compound_0_3_v2'
              ? 'Lãi kép 0,3%/ngày; tổng lãi tối đa bằng gốc ban đầu.'
              : 'Lãi và kỳ hạn áp dụng đúng điều khoản đã chấp thuận trong hồ sơ.'}{' '}
          Kiểm giấy tờ và quyền sở hữu trước khi quyết định.
        </p>
        {row.governance?.disputed && (
          <p className="mt-2 font-bold text-red-700">Đang tranh chấp · khóa xử lý tài sản, nhập kho và đăng bán.</p>
        )}
      </div>
      {row.disbursedAt && (
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4 text-sm">
          {[
            ['Gốc còn lại', row.estimate.principalOutstandingVnd ?? row.terms?.principalVnd],
            ['Lãi còn lại', row.estimate.interestOutstandingVnd ?? row.estimate.interestVnd],
            ['Credit trả trước còn lại', row.estimate.availableCreditVnd],
            ['Credit dư cần đối soát', row.estimate.surplusCreditVnd],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="mu-note">{label}</dt>
              <dd className="mt-1 font-bold">{money(Number(value || 0))}</dd>
            </div>
          ))}
        </dl>
      )}
      {row.extensionRequest && (
        <div className="space-y-2 rounded-xl border border-violet-200 p-4 text-sm">
          <h3 className="font-bold">Dự kiến gia hạn</h3>
          <p>
            Credit cần xác nhận: <b>{money(row.extensionRequest.creditDueVnd)}</b>
          </p>
          <p>
            Gốc + lãi trước credit: <b>{money(row.extensionRequest.projectedDebtVnd)}</b> / trần{' '}
            <b>{money(row.extensionRequest.ceilingVnd)}</b>
          </p>
          <p className="mu-note">Credit không nhập vào gốc; chỉ dùng để khấu trừ khi xác nhận thanh toán chuộc.</p>
          {admin &&
            legal &&
            ['active', 'DUE_GRACE'].includes(row.status) &&
            (row.extensionRequest.creditDueVnd || 0) > 0 && (
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void post('extension-credit', {
                    ...Object.fromEntries(f),
                    amountVnd: Number(f.get('amountVnd')),
                    moneyVerified: f.has('moneyVerified'),
                  });
                }}
              >
                <label className="mu-field">
                  Credit đã thực nhận (VND)
                  <input
                    name="amountVnd"
                    type="number"
                    step="1"
                    min="1"
                    max={row.extensionRequest.creditDueVnd}
                    required
                  />
                </label>
                <label className="mu-field">
                  Mã giao dịch ngân hàng
                  <input name="externalReference" minLength={8} maxLength={128} required />
                </label>
                <label className="mu-field">
                  Căn cứ đối chiếu
                  <input name="details" required maxLength={1000} />
                </label>
                <label className="flex gap-2">
                  <input name="moneyVerified" type="checkbox" required />
                  Đã kiểm tra giao dịch hoàn tất
                </label>
                <button className="mu-button" disabled={busy}>
                  Ghi credit đã nhận
                </button>
              </form>
            )}
        </div>
      )}
      <RefundHistory operations={row.operations} />
      <RefundRequest
        key={`credit-${row.id}`}
        endpoint={`${root}/${row.id}/credit-refund-request`}
        maximum={
          row.paidAt
            ? Math.max(
                0,
                (row.estimate.surplusCreditVnd || 0) -
                  (row.operations || [])
                    .filter((op) => ['requested', 'approved'].includes(op.status))
                    .reduce((s, op) => s + Number(op.amountVnd), 0),
              )
            : 0
        }
        onUpdated={onUpdated}
      />
      {admin ? (
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-semibold">Kiểm soát giấy tờ, tranh chấp & tài sản</summary>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const data: Record<string, unknown> = {
                ...Object.fromEntries(f),
                action,
                evidenceIds: files.map((file) => file.id),
              };
              for (const key of [
                'identityVerified',
                'ownershipVerified',
                'noticeValidityVerified',
                'ownershipTransferVerified',
              ])
                data[key] = f.has(key);
              void post('actions', data);
            }}
          >
            <label className="mu-field">
              Thao tác
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setFiles([]);
                }}
              >
                {choices.map((a) => (
                  <option key={a} value={a}>
                    {titles[a]}
                  </option>
                ))}
              </select>
            </label>
            {action === 'verify_documents' && (
              <>
                {['identityVerified', 'ownershipVerified'].map((name, i) => (
                  <label key={name} className="flex gap-2 text-sm">
                    <input type="checkbox" name={name} required />
                    {i ? 'Đã xác minh chủ sở hữu và quyền định đoạt' : 'Đã đối chiếu giấy tờ và danh tính'}
                  </label>
                ))}
              </>
            )}
            {action === 'record_notice' && (
              <>
                <label className="mu-field">
                  Thời điểm thông báo đã được tống đạt
                  <DateTimeInput name="servedAt" type="datetime-local" required />
                </label>
                <label className="mu-field">
                  Sớm nhất được xử lý theo căn cứ pháp lý
                  <DateTimeInput name="eligibleAt" type="datetime-local" required />
                </label>
                <label className="flex gap-2 text-sm">
                  <input name="noticeValidityVerified" type="checkbox" required />
                  Đã xác minh tính hợp lệ và thời hạn thông báo
                </label>
              </>
            )}
            {action === 'title_transfer' && (
              <label className="flex gap-2 text-sm">
                <input name="ownershipTransferVerified" type="checkbox" required />
                Đã hoàn tất chuyển quyền sở hữu có căn cứ
              </label>
            )}
            {needsFiles && (
              <EvidenceUploader
                minimumPhotos={1}
                title="Giấy tờ và bằng chứng riêng tư"
                hint="Ít nhất một ảnh bằng chứng cho thao tác này. Chỉ người có quyền mới được xem hồ sơ."
                purpose="pawn"
                files={files}
                onFiles={setFiles}
                onBusy={setBusy}
              />
            )}
            <label className="mu-field">
              Căn cứ / nội dung kiểm tra
              <textarea name="details" required rows={2} maxLength={1000} />
            </label>
            <p className="mu-note">
              Compliance và Finance phải duyệt độc lập, sau thông báo hợp lệ. Quá hạn không tự phạt hay thanh lý.
            </p>
            <button className="mu-button" disabled={busy || !choices.includes(action) || (needsFiles && !files.length)}>
              Lưu hồ sơ kiểm soát
            </button>
          </form>
        </details>
      ) : (
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-semibold">Yêu cầu hỗ trợ / tranh chấp</summary>
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void post('actions', { action: 'raise_dispute', details: new FormData(e.currentTarget).get('details') });
            }}
          >
            <label className="mu-field">
              Nội dung
              <textarea name="details" required maxLength={1000} />
            </label>
            <button className="mu-button" disabled={busy}>
              Gửi yêu cầu kiểm tra
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
