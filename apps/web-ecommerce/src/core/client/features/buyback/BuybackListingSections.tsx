'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import { formatVND } from '@/shared/server/utils/utils';
import { LISTING_QC_CHECKS, SYSTEM_QC_CHECKS } from '@/shared/listing-qc';
import type { BuybackRequest } from '@/shared/types/buyback';
import ProductPicker, { type PickedProduct } from '@/core/client/features/inventory/components/ProductPicker';

type Post = (endpoint: string, data: Record<string, unknown>) => Promise<void>;

// A trade's quote (owner specification of 2026-10-25, §9): the shop item, its price, the approved buy-back price and
// the difference D, with the admin's approval of a negative D.
export function TradeQuotePanel({
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
  const t = useTranslations('buybackTrade'),
    locale = useLocale();
  const quote = selected.tradeQuote;
  if (!quote) return null;
  const money = (amount: number) => formatVND(amount, locale);
  const difference = quote.differenceVnd;
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-bold">{t('title', { revision: quote.revision })}</h3>
      <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
        <dt>{t('item')}</dt>
        <dd>
          {selected.tradeProduct
            ? `${selected.tradeProduct.name} (${selected.tradeProduct.sku})`
            : `#${quote.productId}`}
        </dd>
        <dt>{t('itemPrice')}</dt>
        <dd>{money(quote.itemPriceVnd)}</dd>
        <dt>{t('buyback')}</dt>
        <dd>{quote.buybackVnd !== null ? money(quote.buybackVnd) : t('pending')}</dd>
        <dt className="font-bold">{t('difference')}</dt>
        <dd className="font-bold">
          {difference === null
            ? t('incomplete')
            : difference > 0
              ? t('customerPays', { amount: money(difference) })
              : difference < 0
                ? t('shopPays', { amount: money(-difference) })
                : t('even')}
        </dd>
      </dl>
      <p className="mu-note mt-2">{t(`status.${quote.status}`)}</p>
      {difference !== null && difference < 0 && quote.status === 'ready' && (
        <p className="mu-note">{quote.refundApprovedByUserId ? t('refundApproved') : t('refundPending')}</p>
      )}
      <p className="mu-note">{t('noPoints')}</p>
      {admin &&
        selected.status === 'awaiting_acceptance' &&
        quote.status === 'ready' &&
        difference !== null &&
        difference < 0 &&
        !quote.refundApprovedByUserId && (
          <button
            className="mu-button mt-3"
            disabled={busy}
            onClick={() => void post('actions', { action: 'approve_trade_refund' })}
          >
            {t('approveRefund', { amount: money(-difference) })}
          </button>
        )}
    </div>
  );
}

// After the settlement: the pre-listing QC review (§12), stock intake as a DRAFT listing and the final publication
// check (§13). The system checks are verified by the server; the reviewer ticks the others.
export function ListingSteps({ selected, busy, post }: { selected: BuybackRequest; busy: boolean; post: Post }) {
  const t = useTranslations('listingQc'),
    b = useTranslations('buyback');
  const [product, setProduct] = useState<PickedProduct | null>(null);
  if (selected.status !== 'completed') return null;
  const review = selected.qcReview;
  const passed = review?.result === 'passed' && !review.invalidatedAt;
  const listing = selected.listing;
  const productId = listing?.id ?? product?.id ?? review?.productId;
  const formData = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    return new FormData(event.currentTarget);
  };
  return (
    <div className="space-y-5 border-t border-slate-200 pt-5">
      <h3 className="font-bold">{t('title')}</h3>
      {review && (
        <div className={`rounded-md p-3 text-sm ${passed ? 'bg-cyan-50' : 'border border-dashed border-brand-hover'}`}>
          <p className="font-semibold">
            {review.invalidatedAt
              ? t(`void.${review.invalidatedReason ?? 'superseded'}`)
              : t(`result.${review.result}`)}
          </p>
          {review.failed.length > 0 && <p className="mu-note">{t('failed', { checks: review.failed.join(', ') })}</p>}
          <p className="mu-note whitespace-pre-line">{review.notes}</p>
        </div>
      )}
      {!(listing && !listing.isArchived) && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            const data = formData(event);
            void post('qc', {
              productId,
              details: data.get('details'),
              checks: Object.fromEntries(LISTING_QC_CHECKS.map((check) => [check, data.has(check)])),
            });
          }}
        >
          {!listing && (
            <>
              <p className="mu-note">{b('intakeNote')}</p>
              <Link href="/admin/products/new" className="inline-block underline">
                {b('createDraft')}
              </Link>
              <ProductPicker value={product} onChange={setProduct} excludeIds={[]} />
            </>
          )}
          <ul className="space-y-2">
            {LISTING_QC_CHECKS.map((check) => {
              const system = SYSTEM_QC_CHECKS.includes(check);
              return (
                <li key={check}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      className="mt-1"
                      type="checkbox"
                      name={check}
                      disabled={system}
                      checked={system ? (review?.checks[check] ?? false) : undefined}
                      readOnly={system}
                    />
                    <span>
                      <b>{check}</b> {t(`checks.${check}`)}
                      {system && <span className="mu-note"> · {t('system')}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <label className="mu-field">
            {t('notes')}
            <textarea name="details" required maxLength={1500} />
          </label>
          <button className="mu-button" disabled={busy || !productId}>
            {t('submit')}
          </button>
        </form>
      )}
      {!listing && passed && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            const data = formData(event);
            void post('intake', {
              productId: review.productId,
              details: data.get('details'),
              actualPhotosVerified: data.has('actualPhotosVerified'),
            });
          }}
        >
          <h4 className="font-semibold">{t('intake')}</h4>
          <p className="mu-note">{t('intakeNote')}</p>
          <label className="mu-field">
            {b('details')}
            <textarea name="details" required maxLength={1500} />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input name="actualPhotosVerified" type="checkbox" required />
            {b('actualPhotosVerified')}
          </label>
          <button className="mu-button" disabled={busy}>
            {t('intake')}
          </button>
        </form>
      )}
      {listing?.isArchived && (
        <div className="space-y-3">
          <h4 className="font-semibold">{t('publish')}</h4>
          <p className="mu-note">{t('publishNote')}</p>
          <button className="mu-button" disabled={busy || !passed} onClick={() => void post('publish', {})}>
            {t('publish')}
          </button>
        </div>
      )}
      {listing && !listing.isArchived && <p className="mu-note">{t('published')}</p>}
    </div>
  );
}
