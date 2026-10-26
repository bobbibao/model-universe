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
    <section className="service-condition-case">
      <div className="catalog-section-toolbar">
        <h3>{en ? 'Condition combination' : 'Tổ hợp tình trạng'}</h3>
        <span className={`catalog-status ${status !== 'resolved' ? 'is-draft' : ''}`}>
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
      <p>
        <b>{snapshot.itemTypeKey === 'new' ? 'New' : '2hand'}</b> ·{' '}
        {snapshot.labels.join(' · ') || (en ? 'No issues recorded' : 'Không ghi nhận lỗi')}
      </p>
      {reviewNote && <p className="catalog-inline-notice">{reviewNote}</p>}
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
      {snapshot.productId && (
        <Link href={admin ? `/admin/products/${snapshot.productId}` : `/shop/product/${snapshot.productId}`}>
          SKU #{snapshot.productId}
          {snapshot.salePriceVnd ? ` · S ${formatVND(snapshot.salePriceVnd, locale)}` : ''} ↗
        </Link>
      )}
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
    </section>
  );
}
