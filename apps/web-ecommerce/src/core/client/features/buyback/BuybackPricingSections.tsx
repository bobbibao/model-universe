'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Api from '@/core/client/api/Api';
import { formatVND } from '@/shared/server/utils/utils';
import {
  B17_RULE_VERSION,
  CONDITION_BUYBACK_RULE_VERSION,
  BUYBACK_ISSUE_TYPES,
  BUYBACK_RATE_PERCENT,
  BUYBACK_RULE_VERSION,
  buybackMargin,
  buybackRateBps,
  MAX_ISSUE_QUANTITY,
  type BuybackEstimate,
  type BuybackIssue,
} from '@/shared/buyback-pricing';
import type { BuybackEvidenceFile, BuybackRequest } from '@/shared/types/buyback';
import ServiceMediaGallery from '@/components/Services/ServiceMediaGallery';

type Post = (endpoint: string, data: Record<string, unknown>) => Promise<void>;

const IssueList = ({ issues }: { issues: BuybackIssue[] }) => {
  const v2 = useTranslations('buybackV2');
  if (!issues.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        <span className="text-sm">✓</span>
        <span>{v2('noIssues')}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {issues.map((issue, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          <span>
            {v2(`issueTypes.${issue.type}`)} × {issue.quantity}
          </span>
          {issue.description ? (
            <span className="text-[11px] text-rose-600 dark:text-rose-400">({issue.description})</span>
          ) : null}
        </span>
      ))}
    </div>
  );
};

const Files = ({ files }: { files: BuybackEvidenceFile[] }) => (
  <div className="flex flex-wrap gap-3">
    {files.map((file) => (
      <a key={file.id} href={`/api/evidence/${file.id}`} target="_blank" rel="noreferrer" className="text-sm underline">
        {file.mimeType?.startsWith('video/') ? '🎬 ' : ''}
        {file.originalName}
      </a>
    ))}
  </div>
);

const uploadEvidence = async (input: HTMLInputElement, purpose: 'buyback' | 'buyback_inspection') => {
  const ids: number[] = [];
  for (const file of Array.from(input.files || []).slice(0, 12)) {
    const form = new FormData();
    form.append('file', file);
    form.append('purpose', purpose);
    ids.push((await Api.post('/evidence', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.id);
  }
  input.value = '';
  return ids;
};

// The pricing details of one request: the estimate (three rates of S) and declared issues, missing evidence, the inspection
// comparison and inspection recordings, and the actions (request/add evidence, formula offers, inspected issues, review).
export default function BuybackPricingSections({
  selected,
  admin,
  busy,
  post,
}: {
  selected: BuybackRequest;
  admin: boolean;
  busy: boolean;
  post: Post;
}) {
  const v2 = useTranslations('buybackV2'),
    condition = useTranslations('itemCondition'),
    t = useTranslations('buyback'),
    locale = useLocale();
  const money = (amount: number) => formatVND(amount, locale);
  const [inspected, setInspected] = useState<BuybackIssue[]>(selected.inspectedIssues ?? selected.declaredIssues ?? []);
  const [inspectionIds, setInspectionIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const comparison = selected.comparison;
  const form = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
  };
  return (
    <div className="space-y-4">
      {/* Staff see how the estimate was worked out; the customer sees only the expected price (owner request). */}
      {admin && selected.referenceProduct && (
        <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-meta-4/20 dark:text-slate-300 border border-slate-200/60 dark:border-strokedark">
          {v2('referenceProduct', {
            name: selected.referenceProduct.name,
            sku: selected.referenceProduct.sku,
            price: money(selected.referenceProduct.priceVnd),
          })}
        </div>
      )}
      {selected.estimate && <EstimateCard estimate={selected.estimate} />}
      {!admin && !selected.estimate && (
        <p className="text-xs text-slate-500">
          {condition('shopQuotes')}
        </p>
      )}

      {selected.evidenceRequest && ['need_more_evidence', 'submitted'].includes(selected.status) && (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-bold">{v2('evidenceRequested')}:</span> {selected.evidenceRequest}
        </div>
      )}
      {!admin && !selected.conditionCase && selected.status === 'need_more_evidence' && (
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const input = event.currentTarget.querySelector<HTMLInputElement>('input[type=file]')!;
            setUploading(true);
            try {
              const ids = await uploadEvidence(input, 'buyback');
              if (ids.length) await post('actions', { action: 'add_evidence', evidenceIds: ids });
            } finally {
              setUploading(false);
            }
          }}
        >
          <label className="mu-field">
            {v2('addEvidence')}
            <input
              type="file"
              multiple
              required
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            />
          </label>
          <button className="mu-button" disabled={busy || uploading}>
            {v2('sendEvidence')}
          </button>
        </form>
      )}
      {admin && ['submitted', 'need_more_evidence'].includes(selected.status) && (
        <form
          className="space-y-3"
          onSubmit={(event) => void post('actions', { action: 'request_evidence', details: form(event).details })}
        >
          <label className="mu-field">
            {v2('requestEvidence')}
            <textarea name="details" required maxLength={1500} />
          </label>
          <button className="mu-button-secondary" disabled={busy}>
            {v2('requestEvidenceButton')}
          </button>
        </form>
      )}

      {/* Unified Side-by-Side Comparison Matrix */}
      {comparison ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-strokedark dark:bg-boxdark space-y-3.5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-strokedark">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                ⚖
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Biên bản đối chiếu & Thẩm định
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Đối chiếu giữa thông tin khách tự khai và kết quả kiểm tra hiện vật
                </p>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                comparison.inspectedIssueCount === 0 && comparison.newIssueCount === 0
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  comparison.inspectedIssueCount === 0 && comparison.newIssueCount === 0
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
              {comparison.inspectedIssueCount === 0 && comparison.newIssueCount === 0
                ? '✓ Hoàn toàn trùng khớp (Đạt chuẩn)'
                : `⚠ Có chênh lệch (${comparison.newIssueCount} lỗi phát sinh)`}
            </span>
          </div>

          {/* Side-by-Side 2-Column Comparison Matrix */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Left: Customer Declaration */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-strokedark dark:bg-meta-4/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  1. Khách khai báo ban đầu
                </span>
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-meta-4 dark:text-slate-300">
                  {comparison.declaredIssueCount} lỗi
                </span>
              </div>
              <IssueList issues={selected.declaredIssues || []} />
            </div>

            {/* Right: Shop Actual Inspection */}
            <div
              className={`rounded-xl border p-3 ${
                comparison.inspectedIssueCount === 0
                  ? 'border-emerald-100 bg-emerald-50/40 dark:border-emerald-950/50 dark:bg-emerald-950/20'
                  : 'border-amber-100 bg-amber-50/40 dark:border-amber-950/50 dark:bg-amber-950/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  2. Shop kiểm tra hiện vật
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    comparison.inspectedIssueCount === 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                  }`}
                >
                  {comparison.inspectedIssueCount} lỗi
                </span>
              </div>
              <IssueList issues={selected.inspectedIssues || []} />
            </div>
          </div>

          {/* Bottom Reconciliation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100/80 px-3.5 py-2 text-xs dark:bg-meta-4/40">
            <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400">
              <span>
                Phát sinh thêm: <strong className="text-slate-800 dark:text-slate-200">{comparison.newIssueCount}</strong>
              </span>
              <span>•</span>
              <span>
                Khai thừa bỏ qua: <strong className="text-slate-800 dark:text-slate-200">{comparison.resolvedIssueCount}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <span>Chênh lệch khấu trừ:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {money(comparison.deductionDifferenceVnd)}
              </span>
            </div>
          </div>

          {/* Customer Review Request Note if any */}
          {selected.reviewRequest && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="font-bold">⚠ Khách yêu cầu kiểm tra lại:</span>{' '}
              <span>{selected.reviewRequest}</span>
            </div>
          )}

          {/* Technician Inspection Notes if any */}
          {selected.inspection && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-strokedark dark:bg-meta-4/30 dark:text-slate-300">
              <span className="font-bold text-slate-800 dark:text-white">📝 Ghi chú kiểm hàng KTV:</span>{' '}
              <span className="whitespace-pre-line">{selected.inspection}</span>
            </div>
          )}
        </div>
      ) : (
        /* If no comparison yet (pre-inspection status) */
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-strokedark dark:bg-boxdark space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Tình trạng khách tự khai báo ({selected.declaredIssues?.length || 0})
            </h4>
          </div>
          <IssueList issues={selected.declaredIssues || []} />
        </div>
      )}

      {/* Customer review request (when comparison doesn't exist yet) */}
      {!comparison && selected.reviewRequest && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          <span className="font-bold">⚠ Khách yêu cầu kiểm tra lại:</span> {selected.reviewRequest}
        </div>
      )}
      {!admin && selected.status === 'awaiting_acceptance' && (
        <form
          className="space-y-3"
          onSubmit={(event) => void post('actions', { action: 'request_review', details: form(event).details })}
        >
          <label className="mu-field">
            {v2('requestReview')}
            <textarea name="details" required maxLength={1500} />
          </label>
          <button className="mu-button-secondary" disabled={busy}>
            {v2('requestReviewButton')}
          </button>
        </form>
      )}
      {admin && ['submitted', 'quoted', 'need_more_evidence'].includes(selected.status) && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            const body = form(event);
            void post('actions', {
              action: 'preliminary_offer',
              details: body.details,
              ...(body.amountVnd ? { amountVnd: Number(body.amountVnd) } : {}),
            });
          }}
        >
          <h3 className="font-bold">{t('preliminaryOffer')}</h3>
          <label className="mu-field">
            {v2('manualAmount')}
            <input
              name="amountVnd"
              type="number"
              min={1}
              step={1}
              placeholder={selected.estimate?.estimateVnd ? String(selected.estimate.estimateVnd) : ''}
            />
          </label>
          <p className="mu-note">{v2('formulaNote')}</p>
          <label className="mu-field">
            {t('details')}
            <textarea name="details" required maxLength={1500} />
          </label>
          <button className="mu-button" disabled={busy}>
            {t('preliminaryOffer')}
          </button>
        </form>
      )}
      {admin && ['inspecting', 'awaiting_acceptance', 'reinspection_requested'].includes(selected.status) && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            const body = form(event);
            void post('actions', {
              action: 'final_offer',
              details: body.details,
              inspectedIssues: selected.conditionCase ? [] : inspected,
              conditionMatchesApproved: body.conditionMatchesApproved === 'on',
              inspectionEvidenceIds: inspectionIds,
              seriousDamage: body.seriousDamage === 'on',
              ...(body.amountVnd ? { amountVnd: Number(body.amountVnd) } : {}),
            });
          }}
        >
          <h3 className="font-bold">{t('finalOffer')}</h3>
          <label className="mu-field">
            {v2('inspectionUpload')}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={async (event) => {
                setUploading(true);
                try {
                  const ids = await uploadEvidence(event.target, 'buyback_inspection');
                  setInspectionIds((current) => [...current, ...ids]);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          <p className="mu-note">
            {v2('inspectionUploaded', { count: inspectionIds.length + (selected.inspectionEvidence?.length || 0) })}
          </p>
          {selected.conditionCase ? <label className="flex items-start gap-3 text-sm"><input name="conditionMatchesApproved" type="checkbox" required /><span>Hàng kiểm thực tế khớp tổ hợp tình trạng đã duyệt ở trên. Nếu khác, đối chiếu và duyệt lại tổ hợp trước khi báo giá.</span></label> : <>
          <h4 className="font-semibold">{v2('inspectedIssues')}</h4>
          {inspected.map((issue, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1.2fr_.5fr_2fr_auto]">
              <select
                value={issue.type}
                onChange={(event) =>
                  setInspected(
                    inspected.map((row, at) =>
                      at === index ? { ...row, type: event.target.value as BuybackIssue['type'] } : row,
                    ),
                  )
                }
              >
                {BUYBACK_ISSUE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {v2(`issueTypes.${type}`)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={MAX_ISSUE_QUANTITY}
                value={issue.quantity}
                onChange={(event) =>
                  setInspected(
                    inspected.map((row, at) =>
                      at === index ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) } : row,
                    ),
                  )
                }
              />
              <input
                maxLength={500}
                placeholder={v2('issueDescription')}
                value={issue.description}
                onChange={(event) =>
                  setInspected(
                    inspected.map((row, at) => (at === index ? { ...row, description: event.target.value } : row)),
                  )
                }
              />
              <button
                type="button"
                className="underline"
                onClick={() => setInspected(inspected.filter((_, at) => at !== index))}
              >
                {v2('removeIssue')}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="mu-button-secondary"
            onClick={() => setInspected([...inspected, { type: 'broken_part', quantity: 1, description: '' }])}
          >
            {v2('addIssue')}
          </button>
          </>}
          <label className="flex items-start gap-2 text-sm">
            <input className="mt-1" name="seriousDamage" type="checkbox" />
            {v2('seriousDamage')}
          </label>
          <label className="mu-field">
            {v2('manualAmount')}
            <input name="amountVnd" type="number" min={1} step={1} />
          </label>
          <p className="mu-note">{v2('formulaNote')}</p>
          <label className="mu-field">
            {t('details')}
            <textarea name="details" required maxLength={1500} />
          </label>
          <button className="mu-button" disabled={busy || uploading}>
            {t('finalOffer')}
          </button>
        </form>
      )}
    </div>
  );
}

// A request shows S and the shop's margin B (30% / 20% / 17% of S, at least 100,000) taken off it; one quoted under B17
// shows the 17% of S it is bought at, and one quoted under the former tier table keeps its deduction lines.
export function EstimateCard({ estimate }: { estimate: BuybackEstimate }) {
  const v2 = useTranslations('buybackV2'),
    locale = useLocale();
  const money = (amount: number) => formatVND(amount, locale);
  const [showFormula, setShowFormula] = useState(false);
  const legacy =
    estimate.ruleVersion !== BUYBACK_RULE_VERSION &&
    estimate.ruleVersion !== B17_RULE_VERSION &&
    estimate.ruleVersion !== CONDITION_BUYBACK_RULE_VERSION;
  const reference = estimate.referencePriceVnd;
  const rate =
    estimate.ruleVersion === B17_RULE_VERSION
      ? `${BUYBACK_RATE_PERCENT}% × S`
      : reference
      ? `${buybackRateBps(reference) / 100}% × S (−${money(buybackMargin(reference))})`
      : '—';

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-strokedark dark:bg-boxdark">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {v2('estimate.total')}
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
              {estimate.estimateVnd !== null && !estimate.manualReview
                ? money(estimate.estimateVnd)
                : v2('estimate.manual')}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 block uppercase">
              {v2(legacy ? 'estimate.legacyReference' : 'estimate.reference')}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {estimate.referencePriceVnd !== null ? money(estimate.referencePriceVnd) : '—'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <div>
            <span className="text-[10px] font-semibold text-slate-400 block uppercase">
              {v2(estimate.ruleVersion === B17_RULE_VERSION ? 'estimate.b17Rate' : 'estimate.rate')}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{rate}</span>
          </div>
        </div>
      </div>

      {estimate.manualReview && (
        <div className="mt-2.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {v2(`estimate.reasons.${estimate.manualReview}`)}
        </div>
      )}

      {/* Collapsible rule note */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] dark:border-strokedark">
        <button
          type="button"
          onClick={() => setShowFormula(!showFormula)}
          className="font-semibold text-purple-600 hover:underline dark:text-purple-400"
        >
          {showFormula ? '▲ Ẩn chi tiết công thức định giá' : '▼ Xem chi tiết công thức & quy tắc định giá'}
        </button>
        {showFormula && (
          <p className="mt-1 leading-relaxed text-slate-500 dark:text-slate-400">
            {v2('estimate.note')}
          </p>
        )}
      </div>
    </div>
  );
}
