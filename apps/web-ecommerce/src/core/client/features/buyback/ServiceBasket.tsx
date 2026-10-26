'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import Api from '@/core/client/api/Api';
import ProductImage from '@/components/ProductImage';
import { formatVND } from '@/shared/server/utils/utils';
import { memberPrice } from '@/shared/pricing';
import { NEW_ITEM_CONDITION, type ItemCondition } from '@/shared/item-condition';
import type { BuybackEstimate } from '@/shared/buyback-pricing';
import type { PawnEstimate } from '@/shared/pawn-rules';
import type { ReferenceCondition } from '@/shared/sale-pricing';
import type { ProductSummary } from '@/shared/types/product';
import CatalogCombobox from './CatalogCombobox';
import ConditionFields, {
  NameField,
  NEW_CONDITION_VALUE,
  useConditionPayload,
  type ConditionValue,
} from './ConditionFields';
import EvidenceUploader, { type UploadedEvidence } from './EvidenceUploader';
import ServiceRequestPanel from './ServiceRequestPanel';
import './quick-valuation.css';

export type ServiceKind = 'sell' | 'trade' | 'pawn';
// New and 2hand are priced on the web; "other" (anything more complicated) is described and quoted by the shop.
type RowCondition = ReferenceCondition | 'other';

interface Quote {
  buyback: BuybackEstimate;
  pawn: PawnEstimate;
}
interface Valuation {
  product: { id: number; name: string; brandName: string; imageUrl: string; listPriceVnd: number; modelCode?: string };
  conditions: Record<ReferenceCondition, Quote>;
}
interface Row {
  key: string;
  // Null: a model the shop does not sell, described by the customer.
  product: ProductSummary | null;
  condition: RowCondition;
  valuation?: Valuation | null;
  details: ConditionValue;
  files: UploadedEvidence[];
}

// The plain 2hand unit priced from S 2hand: used, boxed, complete, without defects or repairs.
const PREOWNED_CONDITION: ItemCondition = { ...NEW_ITEM_CONDITION, assemblyState: 'assembled', box: 'opened' };

let nextKey = 0;
const newRow = (product: ProductSummary | null): Row => ({
  key: `row-${++nextKey}`,
  product,
  condition: product ? 'new' : 'other',
  details: NEW_CONDITION_VALUE,
  files: [],
});

// A service page's basket (owner request of 2026-10-26): the customer adds one or more models, chooses New, 2hand or
// Other for each, and sees each price and the total (buyback S − margin, pawn C50, or the trade difference against the
// shop items at member price). Then one request per model is sent with its photos; only "Other" asks for a description.
export default function ServiceBasket({
  kind,
  initialProductId = null,
  onSent,
}: {
  kind: ServiceKind;
  initialProductId?: number | null;
  onSent: () => Promise<void>;
}) {
  const t = useTranslations('serviceBasket'),
    locale = useLocale();
  const money = (amount: number) => formatVND(amount, locale);
  const [rows, setRows] = useState<Row[]>([]);
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [requesting, setRequesting] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [failures, setFailures] = useState<string[]>([]);
  const keys = useRef(new Map<string, { digest: string; key: string }>());
  const payload = useConditionPayload();

  const update = (key: string, change: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const chosen = useRef(new Set<number>());
  const add = (product: ProductSummary | null) => {
    if (product && chosen.current.has(product.id)) return;
    if (product) chosen.current.add(product.id);
    const row = newRow(product);
    setRows((current) => [...current, row]);
    if (!product) return;
    Api.get(`/valuation/${product.id}`)
      .then(({ data }) => update(row.key, { valuation: data }))
      .catch(() => update(row.key, { valuation: null }));
  };

  useEffect(() => {
    if (!initialProductId) return;
    Api.get(`/valuation/${initialProductId}`)
      .then(({ data }: { data: Valuation }) =>
        add({
          id: data.product.id,
          name: data.product.name,
          brandName: data.product.brandName,
          imageUrl: data.product.imageUrl,
          price: data.product.listPriceVnd,
          modelCode: data.product.modelCode,
        } as ProductSummary),
      )
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId]);

  // The web price of one row in this service, or null when the shop quotes it.
  const priceOf = (row: Row) => {
    if (row.condition === 'other' || !row.valuation) return null;
    const quote = row.valuation.conditions[row.condition];
    if (kind === 'pawn') return quote.pawn.amountVnd;
    return quote.buyback.manualReview ? null : quote.buyback.estimateVnd;
  };
  const priced = rows.map(priceOf);
  const known = priced.filter((price): price is number => price !== null);
  const quotedByShop = priced.length - known.length;
  const itemsTotal = items.reduce((sum, item) => sum + memberPrice(item.price), 0);
  const ownTotal = known.reduce((sum, price) => sum + price, 0);
  const difference = itemsTotal - ownTotal;

  const copy = {
    sell: { title: t('sell.title'), total: t('sell.total'), action: t('sell.action') },
    trade: { title: t('trade.title'), total: t('trade.total'), action: t('trade.action') },
    pawn: { title: t('pawn.title'), total: t('pawn.total'), action: t('pawn.action') },
  }[kind];
  const canRequest = rows.length > 0 && (kind !== 'trade' || items.length > 0);

  const send = async () => {
    setBusy(true);
    const failed: string[] = [];
    for (const [index, row] of rows.entries()) {
      const reference = row.product ? { name: row.product.name, modelCode: row.product.modelCode ?? null } : null;
      const described = row.condition === 'other';
      const built = payload(
        described
          ? row.details
          : {
              ...NEW_CONDITION_VALUE,
              condition: row.condition === 'preowned' ? PREOWNED_CONDITION : NEW_ITEM_CONDITION,
            },
        reference,
      );
      const referenceCondition: ReferenceCondition = row.condition === 'preowned' ? 'preowned' : 'new';
      const common = {
        asset: built.asset,
        evidenceIds: row.files.map((file) => file.id),
        referenceProductId: row.product?.id ?? null,
        referenceCondition,
      };
      const data =
        kind === 'pawn'
          ? { ...common, issuesDeclared: described }
          : {
              ...common,
              declaredIssues: described ? built.issues : [],
              seriousDamage: described && built.seriousDamage,
              ...(kind === 'trade' && items[index] ? { tradeProductId: items[index].id } : {}),
              confirmations: true,
            };
      const digest = JSON.stringify(data);
      const pending = keys.current.get(row.key);
      const requestKey = pending?.digest === digest ? pending.key : crypto.randomUUID();
      keys.current.set(row.key, { digest, key: requestKey });
      try {
        await Api.post(kind === 'pawn' ? '/pawn' : '/buyback', { ...data, requestKey });
      } catch {
        failed.push(row.key);
      }
    }
    setBusy(false);
    setFailures(failed);
    // Sent rows (and their trade items) leave the basket; a failed one stays with its photos for another try under the
    // same request key.
    const kept = rows.map((row) => failed.includes(row.key));
    setItems((current) => current.filter((_, index) => kept[index]));
    setRows((current) => current.filter((row) => failed.includes(row.key)));
    for (const row of rows) if (row.product && !failed.includes(row.key)) chosen.current.delete(row.product.id);
    if (!failed.length) {
      setRequesting(0);
      setAgreed(false);
    }
    await onSent();
  };

  const ready =
    rows.length > 0 &&
    agreed &&
    !busy &&
    uploading === 0 &&
    rows.every((row) => row.files.filter((file) => !file.video).length >= 3);

  return (
    <>
      <section className={`qv is-${kind}`} aria-label={copy.title}>
        <header className="qv-head">
          <span className="qv-kicker">{t(`${kind}.kicker`)}</span>
          <h2>{copy.title}</h2>
          <p>{t('intro')}</p>
        </header>

        <div className="qv-grid">
          <div className="sb-lists">
            <div className="sb-list">
              <h3>{kind === 'trade' ? t('yourModels') : t('models')}</h3>
              {rows.map((row, index) => (
                <article key={row.key} className="sb-row">
                  <span className="cc-thumb">
                    {row.product && (
                      <ProductImage src={row.product.imageUrl} alt="" sizes="44px" className="object-contain" />
                    )}
                  </span>
                  <div className="sb-row-copy">
                    <strong>{row.product?.name ?? t('otherModel')}</strong>
                    {row.product ? (
                      <div className="sb-segment" role="radiogroup" aria-label={t('condition')}>
                        {(['new', 'preowned', 'other'] as const).map((condition) => (
                          <button
                            key={condition}
                            type="button"
                            role="radio"
                            aria-checked={row.condition === condition}
                            onClick={() => update(row.key, { condition })}
                          >
                            {t(`conditions.${condition}`)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <small>{t('otherModelNote')}</small>
                    )}
                  </div>
                  <span className={`sb-row-price${priced[index] === null ? ' is-quote' : ''}`}>
                    {row.product && row.valuation === undefined
                      ? '…'
                      : priced[index] !== null
                        ? money(priced[index]!)
                        : t('shopQuotes')}
                  </span>
                  <button
                    type="button"
                    className="sb-remove"
                    aria-label={t('remove')}
                    onClick={() => {
                      if (row.product) chosen.current.delete(row.product.id);
                      setRows((current) => current.filter((item) => item.key !== row.key));
                    }}
                  >
                    ×
                  </button>
                </article>
              ))}
              <CatalogCombobox
                label={rows.length ? t('addAnother') : t('addFirst')}
                value={null}
                onChange={(product) => product && add(product)}
              />
              <button type="button" className="sb-link" onClick={() => add(null)}>
                {t('addOther')}
              </button>
            </div>

            {kind === 'trade' && (
              <div className="sb-list">
                <h3>{t('shopItems')}</h3>
                {items.map((item) => (
                  <article key={item.id} className="sb-row">
                    <span className="cc-thumb">
                      <ProductImage src={item.imageUrl} alt="" sizes="44px" className="object-contain" />
                    </span>
                    <div className="sb-row-copy">
                      <strong>{item.name}</strong>
                      <small>{t('memberPrice')}</small>
                    </div>
                    <span className="sb-row-price">{money(memberPrice(item.price))}</span>
                    <button
                      type="button"
                      className="sb-remove"
                      aria-label={t('remove')}
                      onClick={() => setItems((current) => current.filter((other) => other.id !== item.id))}
                    >
                      ×
                    </button>
                  </article>
                ))}
                {items.length < Math.max(1, rows.length) ? (
                  <CatalogCombobox
                    label={t('addItem')}
                    value={null}
                    onChange={(product) =>
                      product && !items.some((item) => item.id === product.id) && setItems([...items, product])
                    }
                    showPrice
                    inStockOnly
                  />
                ) : (
                  <p className="service-form-hint">{t('oneItemPerModel')}</p>
                )}
              </div>
            )}
          </div>

          <aside className={`qv-result${canRequest ? ' is-ready' : ''}`} aria-live="polite">
            <span className="qv-result-label">{copy.total}</span>
            {!rows.length ? (
              <p className="qv-result-empty">{t('empty')}</p>
            ) : (
              <>
                <strong className="qv-amount">
                  {kind === 'trade'
                    ? quotedByShop
                      ? t('afterQuote')
                      : difference === 0
                        ? t('even')
                        : money(Math.abs(difference))
                    : money(ownTotal)}
                </strong>
                {kind === 'trade' && !quotedByShop && difference !== 0 && items.length > 0 && (
                  <span className="qv-direction">{t(difference > 0 ? 'youPay' : 'shopPays')}</span>
                )}
                <p className="qv-fineprint">
                  {t('count', { count: rows.length })}
                  {quotedByShop > 0 && ` · ${t('quotedCount', { count: quotedByShop })}`}
                </p>
                <p className="qv-fineprint">{t(`${kind}.note`)}</p>
              </>
            )}
            <button
              type="button"
              className="qv-cta"
              disabled={!canRequest}
              onClick={() => setRequesting((count) => count + 1)}
            >
              {copy.action}
            </button>
            {kind === 'trade' && rows.length > 0 && !items.length && (
              <small className="qv-cta-hint">{t('chooseItem')}</small>
            )}
          </aside>
        </div>
        <p className="qv-manual-line">
          {t('help')}{' '}
          <Link href="/contact" className="qv-link">
            {t('contact')}
          </Link>
        </p>
      </section>

      {requesting > 0 && rows.length > 0 && (
        <ServiceRequestPanel revision={String(requesting)} onClose={() => setRequesting(0)}>
          <div className="service-form">
            {rows.map((row, index) => (
              <section key={row.key} className="service-form-section">
                <h3 className="sb-request-title">
                  {index + 1}. {row.product?.name ?? t('otherModel')} · {t(`conditions.${row.condition}`)}
                  {priced[index] !== null && ` · ${money(priced[index]!)}`}
                  {kind === 'trade' && items[index] && ` → ${items[index].name}`}
                </h3>
                {failures.includes(row.key) && (
                  <p role="alert" className="service-form-error">
                    {t('failed')}
                  </p>
                )}
                {!row.product && <NameField value={row.details} onChange={(details) => update(row.key, { details })} />}
                {row.condition === 'other' && (
                  <ConditionFields
                    value={row.details}
                    onChange={(details) => update(row.key, { details })}
                    reference={row.product}
                  />
                )}
                <EvidenceUploader
                  purpose={kind === 'pawn' ? 'pawn' : 'buyback'}
                  files={row.files}
                  onFiles={(change) =>
                    setRows((current) =>
                      current.map((item) => (item.key === row.key ? { ...item, files: change(item.files) } : item)),
                    )
                  }
                  allowVideo={kind !== 'pawn'}
                  onBusy={(on) => setUploading((count) => count + (on ? 1 : -1))}
                />
              </section>
            ))}
            <section className="service-form-section service-form-submit">
              <div className="service-form-agree">
                <label>
                  <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
                  <span>{t('agree')}</span>
                </label>
                <details>
                  <summary>{t('terms')}</summary>
                  <p>{t(`${kind}.terms`)}</p>
                </details>
              </div>
              <button type="button" className="mu-button" disabled={!ready} onClick={() => void send()}>
                {busy ? t('sending') : t('send', { count: rows.length })}
              </button>
            </section>
          </div>
        </ServiceRequestPanel>
      )}
    </>
  );
}
