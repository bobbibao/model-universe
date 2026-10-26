'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Api from '@/core/client/api/Api';
import { formatVND } from '@/shared/server/utils/utils';
import {
  B17_RULE_VERSION,
  BUYBACK_RATE_PERCENT,
  BUYBACK_RULE_VERSION,
  buybackMargin,
  buybackRateBps,
  type BuybackEstimate,
} from '@/shared/buyback-pricing';
import type { ProductSummary } from '@/shared/types/product';
import CatalogCombobox from './CatalogCombobox';
import ConditionFields, {
  NameField,
  NEW_CONDITION_VALUE,
  useConditionPayload,
  type ConditionValue,
} from './ConditionFields';
import EvidenceUploader, { type UploadedEvidence } from './EvidenceUploader';

// "Sell to Model Universe" in one short form: the catalogue model (or its name), its condition as choices with one note
// when it is not new, the shop item on the trade page, real photos and a video, one confirmation. The expected price is
// the shop's real selling price S minus its margin (30% / 20% / 17% of S, at least 100,000 VND), only for a model the
// shop sells declared new; anything else is priced by an admin. The server recomputes the estimate and checks the media.
// `initialReference` / `initialTradeItem`: the catalogue model and the shop item chosen in QuickValuation.
export default function BuybackSubmissionForm({
  onCreated,
  initialReference = null,
  initialTradeItem = null,
  trade = false,
}: {
  onCreated: (id: number) => Promise<void>;
  // The trade page: the shop item to trade for is part of the request.
  trade?: boolean;
  initialReference?: ProductSummary | null;
  initialTradeItem?: ProductSummary | null;
}) {
  const v2 = useTranslations('buybackV2'),
    form = useTranslations('itemCondition'),
    common = useTranslations('common');
  const [reference, setReference] = useState<ProductSummary | null>(initialReference);
  const [tradeItem, setTradeItem] = useState<ProductSummary | null>(initialTradeItem);
  const [condition, setCondition] = useState<ConditionValue>(NEW_CONDITION_VALUE);
  const [estimate, setEstimate] = useState<BuybackEstimate>();
  const [files, setFiles] = useState<UploadedEvidence[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ digest: string; key: string } | undefined>(undefined);
  const payload = useConditionPayload();
  const { asset, issues, seriousDamage } = payload(condition, reference);
  const issueKey = JSON.stringify([issues, seriousDamage]);

  useEffect(() => {
    const [declaredIssues, serious] = JSON.parse(issueKey);
    const timer = setTimeout(() => {
      void Api.post('/buyback/estimate', {
        referenceProductId: reference?.id ?? null,
        declaredIssues,
        seriousDamage: serious,
      })
        .then((response) => setEstimate(response.data.estimate))
        .catch(() => undefined);
    }, 200);
    return () => clearTimeout(timer);
  }, [reference, issueKey]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      return;
    }
    const data = {
      asset,
      evidenceIds: files.map((file) => file.id),
      declaredIssues: issues,
      referenceProductId: reference?.id ?? null,
      seriousDamage,
      ...(trade && tradeItem ? { tradeProductId: tradeItem.id } : {}),
      confirmations: true,
    };
    const digest = JSON.stringify(data);
    if (pending.current?.digest !== digest) pending.current = { digest, key: crypto.randomUUID() };
    setBusy(true);
    try {
      const saved = (await Api.post('/buyback', { ...data, requestKey: pending.current.key })).data;
      await onCreated(saved.id);
    } catch {
      /* Keep the same submission key after an uncertain response. */
    } finally {
      setBusy(false);
    }
  };

  const photos = files.filter((file) => !file.video).length;
  const ready = photos >= 3 && agreed && (!trade || !!tradeItem);
  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="service-form">
      <section className="service-form-section">
        <CatalogCombobox label={v2('catalogSearch')} value={reference} onChange={setReference} />
        {!reference && <p className="service-form-hint">{v2('catalogHint')}</p>}
        {!reference && <NameField value={condition} onChange={setCondition} />}
        {trade && (
          <CatalogCombobox label={v2('trade.search')} value={tradeItem} onChange={setTradeItem} showPrice inStockOnly />
        )}
      </section>

      <section className="service-form-section">
        <h3>{form('conditionTitle')}</h3>
        <ConditionFields value={condition} onChange={setCondition} reference={reference} />
        {estimate && estimate.estimateVnd !== null && !estimate.manualReview && <EstimateCard estimate={estimate} />}
      </section>

      <section className="service-form-section">
        <EvidenceUploader purpose="buyback" files={files} onFiles={setFiles} allowVideo onBusy={setBusy} />
      </section>

      <section className="service-form-section service-form-submit">
        <div className="service-form-agree">
          <label>
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>{form('agree')}</span>
          </label>
          <details>
            <summary>{form('terms')}</summary>
            <p>{v2('warning')}</p>
            {trade && <p>{v2('trade.note')}</p>}
          </details>
        </div>
        <button type="submit" className="mu-button" disabled={busy || !ready}>
          {common('submit')}
        </button>
      </section>
    </form>
  );
}

// A request shows S and the shop's margin B (30% / 20% / 17% of S, at least 100,000) taken off it; one quoted under B17
// shows the 17% of S it is bought at, and one quoted under the former tier table keeps its deduction lines.
export function EstimateCard({ estimate }: { estimate: BuybackEstimate }) {
  const v2 = useTranslations('buybackV2'),
    locale = useLocale();
  const money = (amount: number) => formatVND(amount, locale);
  const legacy = estimate.ruleVersion !== BUYBACK_RULE_VERSION && estimate.ruleVersion !== B17_RULE_VERSION;
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
