'use client';
import EvidenceUploader, { type UploadedEvidence } from './EvidenceUploader';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import ConditionTreePicker from '@/components/Store/ConditionTreePicker';
import TextField from '@/components/FormElements/TextField';
import TextAreaField from '@/components/FormElements/TextAreaField';
import SelectField from '@/components/FormElements/SelectField';
import ProductPicker, { type PickedProduct } from '@/core/client/features/inventory/components/ProductPicker';
import Api from '@/core/client/api/Api';
import type { ConditionCaseSnapshot, ItemTypeKey } from '@/shared/condition-tree';
import { formatVND } from '@/shared/server/utils/utils';

export default function ServiceConditionCasePanel({
  snapshot,
  kind,
  reviewNote,
  status,
  admin,
  editable,
  busy,
  post,
}: {
  snapshot?: ConditionCaseSnapshot | null;
  kind: 'buyback' | 'pawn';
  reviewNote?: string | null;
  status?: string | null;
  admin: boolean;
  editable: boolean;
  busy: boolean;
  post: (endpoint: string, data: Record<string, unknown>) => Promise<void>;
}) {
  const locale = useLocale(),
    en = locale === 'en';
  const [files, setFiles] = useState<UploadedEvidence[]>([]);
  const [uploading, setUploading] = useState(false);
  const [ids, setIds] = useState(snapshot?.conditionNodeIds ?? []);
  const [type, setType] = useState<ItemTypeKey>(snapshot?.itemTypeKey ?? 'new');
  const [source, setSource] = useState<PickedProduct | null>(null);
  const [familyId, setFamilyId] = useState(snapshot?.modelFamilyId ?? null);
  const [price, setPrice] = useState('');
  const [details, setDetails] = useState('');
  const [match, setMatch] = useState<ConditionCaseSnapshot | null>(null);
  useEffect(() => {
    setIds(snapshot?.conditionNodeIds ?? []);
    setType(snapshot?.itemTypeKey ?? 'new');
    setFamilyId(snapshot?.modelFamilyId ?? null);
    setPrice('');
    setDetails('');
    setSource(null);
  }, [snapshot]);
  useEffect(() => {
    if (!source) return;
    let current = true;
    Api.get(`/admin/products/${source.id}`)
      .then((response) => {
        if (current) setFamilyId(response.data.modelFamilyId);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [source]);
  useEffect(() => {
    if (!admin || !familyId) return;
    let current = true;
    setMatch(null);
    Api.post('/product-condition-tree/match', { modelFamilyId: familyId, itemTypeKey: type, conditionNodeIds: ids })
      .then((response) => {
        if (current) setMatch(response.data);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [admin, familyId, type, ids]);
  if (!snapshot) return null;
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-2xs dark:border-strokedark dark:bg-boxdark">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-strokedark">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
            🏷
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
            {en ? 'Condition combination' : 'Tổ hợp tình trạng định giá'}
          </h3>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
            status === 'resolved'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
              : status === 'rejected'
              ? 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300'
              : status === 'needs_evidence'
              ? 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'
              : 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-strokedark dark:bg-meta-4 dark:text-slate-300'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'resolved'
                ? 'bg-emerald-500'
                : status === 'rejected'
                ? 'bg-rose-500'
                : status === 'needs_evidence'
                ? 'bg-amber-500'
                : 'bg-slate-400'
            }`}
          />
          {status === 'resolved'
            ? en
              ? 'Approved'
              : 'Đã duyệt'
            : status === 'rejected'
            ? en
              ? 'Rejected'
              : 'Từ chối'
            : status === 'needs_evidence'
            ? en
              ? 'More evidence needed'
              : 'Cần bổ sung'
            : en
            ? 'Awaiting appraisal'
            : 'Chờ thẩm định'}
        </span>
      </div>

      {/* Condition chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs">
          {snapshot.itemTypeKey === 'new' ? 'New (Mới)' : '2hand (Đã qua sử dụng)'}
        </span>
        {snapshot.labels.length > 0 ? (
          snapshot.labels.map((lbl, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-strokedark dark:bg-meta-4/40 dark:text-slate-200"
            >
              {lbl}
            </span>
          ))
        ) : (
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            {en ? 'No issues recorded' : 'Không ghi nhận lỗi'}
          </span>
        )}
      </div>

      {/* Reference SKU & Real sale price S */}
      {snapshot.productId && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-2.5 text-xs dark:border-indigo-950 dark:bg-indigo-950/20">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-900 dark:text-indigo-200">Mẫu định giá:</span>
            <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">SKU #{snapshot.productId}</span>
          </div>
          {snapshot.salePriceVnd && (
            <span className="font-mono font-extrabold text-indigo-900 dark:text-indigo-200">
              Giá bán niêm yết (S): {formatVND(snapshot.salePriceVnd, locale)}
            </span>
          )}
          <Link
            href={admin ? `/admin/products/${snapshot.productId}` : `/shop/product/${snapshot.productId}`}
            className="font-bold text-purple-600 hover:underline dark:text-purple-400"
            target="_blank"
          >
            Xem mô hình ↗
          </Link>
        </div>
      )}

      {reviewNote && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-bold">Ghi chú đối chiếu: </span>
          <span>{reviewNote}</span>
        </div>
      )}
      {!admin && status === 'needs_evidence' && (
        <div>
          <EvidenceUploader
            purpose={kind}
            files={files}
            onFiles={(change) => setFiles((current) => change(current))}
            onBusy={setUploading}
          />
          <button
            type="button"
            className="mu-button"
            disabled={busy || uploading || !files.length}
            onClick={() =>
              void post(kind === 'pawn' ? 'condition-evidence' : 'actions', {
                action: 'add_evidence',
                evidenceIds: files.map((file) => file.id),
              })
            }
          >
            {en ? 'Send additional evidence' : 'Gửi bằng chứng bổ sung'}
          </button>
        </div>
      )}
      {snapshot.otherCondition && <blockquote>{snapshot.otherCondition}</blockquote>}
      {admin && editable && (
        <details open={status !== 'resolved'}>
          <summary>{en ? 'Review / map conditions and approve S' : 'Đối chiếu tình trạng và duyệt S'}</summary>
          <div className="grid gap-4">
            <p className="catalog-form-note">
              {en
                ? 'New branches are created in the condition library, then selected here. Approval never increases stock.'
                : 'Thêm nhánh trong thư viện rồi chọn tại đây. Duyệt không làm tăng tồn kho.'}{' '}
              <Link href="/admin/products/conditions" target="_blank">
                {en ? 'Open library' : 'Mở thư viện'} ↗
              </Link>
            </p>
            <ProductPicker value={source} onChange={setSource} excludeIds={[]} />
            <SelectField
              label={en ? 'Item type' : 'Loại hàng'}
              name="caseType"
              value={type}
              options={[
                { value: 'new', label: 'New' },
                { value: 'preowned', label: '2hand' },
              ]}
              onChange={(event) => {
                setType(event.target.value as ItemTypeKey);
                setIds([]);
              }}
            />
            <ConditionTreePicker value={ids} itemType={type} onChange={setIds} />
            {match?.productId ? (
              <p className="catalog-inline-notice">
                {en ? 'Existing combination' : 'Tổ hợp đã có'} #{match.productId} · S{' '}
                {match.salePriceVnd
                  ? formatVND(match.salePriceVnd, locale)
                  : en
                    ? 'Approve in catalog first'
                    : 'Cần duyệt trong danh mục'}
              </p>
            ) : (
              <TextField
                label={en ? 'Real selling price S for the new combination' : 'Giá bán thực S cho tổ hợp mới'}
                name="casePrice"
                type="number"
                min={1}
                step={1}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            )}
            <TextAreaField
              label={en ? 'Review / evidence request / rejection reason' : 'Lý do duyệt / yêu cầu bổ sung / từ chối'}
              name="caseDetails"
              maxLength={2000}
              rows={3}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {(['approve', 'request_evidence', 'reject'] as const).map((action) => (
                <button
                  type="button"
                  key={action}
                  className={`mu-button ${action !== 'approve' ? 'mu-button-secondary' : ''}`}
                  disabled={
                    busy || !details.trim() || (action === 'approve' && (!familyId || (!match?.productId && !price)))
                  }
                  onClick={() =>
                    void post('condition-case', {
                      action,
                      modelFamilyId: familyId,
                      baseProductId: source?.id,
                      itemTypeKey: type,
                      conditionNodeIds: ids,
                      ...(match?.productId ? {} : { salePriceVnd: Number(price) }),
                      details,
                    })
                  }
                >
                  {action === 'approve'
                    ? en
                      ? 'Approve · stock 0'
                      : 'Duyệt · chưa nhập kho'
                    : action === 'request_evidence'
                      ? en
                        ? 'Request evidence'
                        : 'Yêu cầu bổ sung'
                      : en
                        ? 'Reject'
                        : 'Từ chối'}
                </button>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
