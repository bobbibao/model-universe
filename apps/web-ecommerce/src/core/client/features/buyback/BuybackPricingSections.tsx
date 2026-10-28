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
    <div className="space-y-5">
      {/* Staff see how the estimate was worked out; the customer sees only the expected price (owner request). */}
      {admin && selected.referenceProduct && (
        <p className="mu-note">
          {v2('referenceProduct', {
            name: selected.referenceProduct.name,
            sku: selected.referenceProduct.sku,
            price: money(selected.referenceProduct.priceVnd),
          })}
        </p>
      )}
      {admin && selected.estimate && <EstimateCard estimate={selected.estimate} />}
      {!admin && selected.estimate && (
        <p className="text-sm">
          {selected.estimate.estimateVnd !== null && !selected.estimate.manualReview ? (
            <>
              {condition('expected')}: <b>{money(selected.estimate.estimateVnd)}</b>
            </>
          ) : (
            condition('shopQuotes')
          )}
        </p>
      )}
      {!selected.conditionCase && <div>
        <h3 className="font-bold">{v2('declaredIssues')}</h3>
        <IssueList issues={selected.declaredIssues || []} />
      </div>}
      {selected.evidenceRequest && ['need_more_evidence', 'submitted'].includes(selected.status) && (
        <p className="rounded-md border border-dashed border-brand-hover p-3 text-sm whitespace-pre-line">
          {v2('evidenceRequested')}: {selected.evidenceRequest}
        </p>
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
      {comparison && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-2xs dark:border-strokedark dark:bg-boxdark">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-strokedark">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                ⚖
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                {v2('comparison.title')}
              </h3>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                comparison.inspectedIssueCount === 0
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  comparison.inspectedIssueCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {comparison.inspectedIssueCount === 0 ? 'Trùng khớp / Đạt chuẩn' : 'Có chênh lệch lỗi'}
            </span>
          </div>

          {/* 4 Stats Chips Matrix */}
          <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-center dark:border-strokedark dark:bg-meta-4/20">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Lỗi khách báo
              </span>
              <p className="mt-0.5 font-mono text-base font-black text-slate-800 dark:text-slate-200">
                {comparison.declaredIssueCount}
              </p>
            </div>
            <div
              className={`rounded-xl border p-2.5 text-center ${
                comparison.inspectedIssueCount === 0
                  ? 'border-emerald-100 bg-emerald-50/50 text-emerald-900 dark:border-emerald-950/50 dark:bg-emerald-950/20 dark:text-emerald-300'
                  : 'border-amber-100 bg-amber-50/50 text-amber-900 dark:border-amber-950/50 dark:bg-amber-950/20 dark:text-amber-300'
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Lỗi thực tế
              </span>
              <p className="mt-0.5 font-mono text-base font-black">
                {comparison.inspectedIssueCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-center dark:border-strokedark dark:bg-meta-4/20">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Phát sinh thêm
              </span>
              <p className="mt-0.5 font-mono text-base font-black text-slate-800 dark:text-slate-200">
                {comparison.newIssueCount}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5 text-center dark:border-emerald-950/40 dark:bg-emerald-950/20">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Khấu trừ
              </span>
              <p className="mt-0.5 font-mono text-xs font-black text-emerald-800 dark:text-emerald-300 truncate">
                {money(comparison.deductionDifferenceVnd)}
              </p>
            </div>
          </div>

          {/* Inspected Issues List */}
          <div className="mt-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 dark:text-slate-400">
              {v2('inspectedIssues')}
            </h4>
            <IssueList issues={selected.inspectedIssues || []} />
          </div>
        </div>
      )}
      {selected.reviewRequest && <p className="mu-note">{v2('reviewRequested', { reason: selected.reviewRequest })}</p>}
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
          {selected.conditionCase ? <label className="flex items-start gap-3 text-sm"><input name="conditionMatchesApproved" type="checkbox" required /><span>{locale === 'en' ? 'The actual inspected item matches the approved condition combination above. Resolve any differences before quoting.' : 'Hàng kiểm thực tế khớp tổ hợp tình trạng đã duyệt ở trên. Nếu khác, đối chiếu và duyệt lại tổ hợp trước khi báo giá.'}</span></label> : <>
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
  const legacy = estimate.ruleVersion !== BUYBACK_RULE_VERSION && estimate.ruleVersion !== B17_RULE_VERSION && estimate.ruleVersion !== CONDITION_BUYBACK_RULE_VERSION;
  const reference = estimate.referencePriceVnd;
  const rate =
    estimate.ruleVersion === B17_RULE_VERSION
      ? `${BUYBACK_RATE_PERCENT}% × S`
      : reference
        ? `${buybackRateBps(reference) / 100}% × S: −${money(buybackMargin(reference))}`
        : '—';
  return (
    <dl className="grid gap-1 rounded-md bg-gray-2 p-4 text-sm dark:bg-store-panel sm:grid-cols-2">
      <dt>{v2(legacy ? 'estimate.legacyReference' : 'estimate.reference')}</dt>
      <dd>{estimate.referencePriceVnd !== null ? money(estimate.referencePriceVnd) : '—'}</dd>
      {legacy ? (
        <>
          <dt>{v2('estimate.base')}</dt>
          <dd>{estimate.baseDeductionVnd !== null ? `−${money(estimate.baseDeductionVnd)}` : '—'}</dd>
          <dt>{v2('estimate.issues', { count: estimate.issueCount, each: money(estimate.deductionPerIssueVnd) })}</dt>
          <dd>−{money(estimate.issueDeductionVnd)}</dd>
        </>
      ) : (
        <>
          <dt>{v2(estimate.ruleVersion === B17_RULE_VERSION ? 'estimate.b17Rate' : 'estimate.rate')}</dt>
          <dd>{rate}</dd>
        </>
      )}
      <dt className="font-bold">{v2('estimate.total')}</dt>
      <dd className="text-lg font-bold">
        {estimate.estimateVnd !== null && !estimate.manualReview ? money(estimate.estimateVnd) : v2('estimate.manual')}
      </dd>
      {estimate.manualReview && (
        <dd className="mu-note sm:col-span-2">{v2(`estimate.reasons.${estimate.manualReview}`)}</dd>
      )}
      <dd className="mu-note sm:col-span-2">{v2('estimate.note')}</dd>
    </dl>
  );
}
