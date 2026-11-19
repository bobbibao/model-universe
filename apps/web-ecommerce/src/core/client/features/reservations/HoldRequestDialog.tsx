'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Api from '@/core/client/api/Api';
import StoreDialog from '@/components/Store/StoreDialog';
import AdminIcon from '@/components/Admin/AdminIcon';
import { formatVND } from '@/shared/server/utils/utils';
import { reservationDays } from '@/shared/reservation';
import { useRouter } from '@/i18n/navigation';
import './hold-dialog.css';

interface Quote {
  eligible: boolean;
  blockedReason?: string;
  totalVnd: number;
  merchandiseVnd: number;
  discountVnd: number;
  minimumInitialVnd: number;
  ruleVersion: string;
  terms: string;
}

export interface HoldRequestDialogProps {
  productId: number;
  quantity: number;
  productName?: string;
  productImage?: string | null;
  unitPrice?: number;
  onClose: () => void;
}

// The deposit bands of the hold rule (reservationDays): from what share of the total a deposit holds the kit how many
// days, e.g. 20% → 10 days … 70% → 45 days. Read off the rule itself so the table cannot drift from it.
const HOLD_BANDS = (() => {
  const bands: { from: number; days: number }[] = [];
  for (let percent = 1; percent < 100; percent++) {
    const days = reservationDays(100, percent);
    if (days > 0 && days !== bands[bands.length - 1]?.days) bands.push({ from: percent, days });
  }
  return bands;
})();
// The smallest deposit that reaches a band: paid × 100 ≥ total × percent, in whole đồng.
const depositFor = (totalVnd: number, percent: number) =>
  Number((BigInt(totalVnd) * BigInt(percent) + BigInt(99)) / BigInt(100));

// Hold a kit: what it is, the smallest deposit and how long it holds the kit, how a larger deposit holds it longer
// (each band with its amount), an optional discount code, the terms, then accept and create the request.
export default function HoldRequestDialog({
  productId,
  quantity,
  productName,
  productImage,
  unitPrice,
  onClose,
}: HoldRequestDialogProps) {
  const t = useTranslations('holdDialog');
  const locale = useLocale();
  const money = (vnd: number) => formatVND(vnd, locale);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [coupon, setCoupon] = useState('');
  const [couponOpen, setCouponOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const key = useRef<string | null>(null);
  const router = useRouter();

  const preview = useCallback(
    async (code: string) => {
      setBusy(true);
      setFailed(false);
      try {
        const response = await Api.post('/reservations/quote', { productId, quantity, couponCode: code.trim() });
        setQuote(response.data);
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    },
    [productId, quantity],
  );

  useEffect(() => {
    void preview('');
  }, [preview]);

  const applyCoupon = () => {
    key.current = null;
    void preview(coupon);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quote || !quote.eligible || !acceptedTerms) return;
    key.current ||= crypto.randomUUID();
    setBusy(true);
    try {
      const result = (
        await Api.post('/reservations', {
          productId,
          quantity,
          couponCode: coupon.trim(),
          expectedTotal: quote.totalVnd,
          requestKey: key.current,
          termsAccepted: true,
          termsVersion: quote.ruleVersion,
        })
      ).data;
      router.push(`/reservations?hold=${result.id}`);
      onClose();
    } catch {
      /* The shared API toaster shows the verified server error. */
    } finally {
      setBusy(false);
    }
  };

  const firstBand = HOLD_BANDS[0];
  return (
    <StoreDialog
      title={t('title')}
      subtitle={t('subtitle')}
      onClose={onClose}
      width={580}
      className="hold-dialog"
      footer={
        quote && (
          <div className="hold-foot">
            <label className="hold-accept">
              <input
                type="checkbox"
                required
                form="hold-request-form"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>{t('accept')}</span>
            </label>
            <button
              type="submit"
              form="hold-request-form"
              className="hold-submit"
              disabled={busy || !quote.eligible || !acceptedTerms}
            >
              {busy ? t('submitting') : t('submit')}
              {!busy && <AdminIcon name="arrow" size={18} />}
            </button>
          </div>
        )
      }
    >
      <form id="hold-request-form" onSubmit={handleSubmit} className="hold-content">
        {productName && (
          <div className="hold-product">
            {productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productImage} alt="" className="hold-product-photo" />
            ) : (
              <span className="hold-product-photo" aria-hidden="true">
                <AdminIcon name="box" size={22} />
              </span>
            )}
            <div>
              <strong>{productName}</strong>
              <span>
                {t('quantity', { count: quantity })}
                {unitPrice ? ` · ${money(unitPrice)}` : ''}
              </span>
            </div>
          </div>
        )}

        {failed && (
          <div role="alert" className="hold-alert">
            <span>{t('failed')}</span>
            <button type="button" onClick={() => void preview(coupon)}>
              {t('retry')}
            </button>
          </div>
        )}

        {!quote && !failed && (
          <div className="hold-skeleton" aria-hidden="true">
            <span />
            <span />
          </div>
        )}

        {quote && (
          <>
            <section className={`hold-deposit${busy ? ' is-busy' : ''}`} aria-live="polite">
              <div className="hold-deposit-head">
                <span>{t('minimum')}</span>
                <span className="hold-days">{t('holdFor', { days: firstBand.days })}</span>
              </div>
              <strong className="hold-deposit-amount">{money(quote.minimumInitialVnd)}</strong>
              <dl className="hold-deposit-lines">
                {quote.discountVnd > 0 && (
                  <>
                    <div>
                      <dt>{t('merchandise')}</dt>
                      <dd>{money(quote.merchandiseVnd)}</dd>
                    </div>
                    <div className="is-saving">
                      <dt>{t('discount')}</dt>
                      <dd>−{money(quote.discountVnd)}</dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>{t('total')}</dt>
                  <dd>{money(quote.totalVnd)}</dd>
                </div>
              </dl>
            </section>

            <section className="hold-bands" aria-labelledby="hold-bands-title">
              <h3 id="hold-bands-title">{t('bandsTitle')}</h3>
              <ol>
                {HOLD_BANDS.map((band, index) => (
                  <li key={band.from} className={index === 0 ? 'is-first' : undefined}>
                    <span className="hold-band-share">{t('bandFrom', { percent: band.from })}</span>
                    <span className="hold-band-amount">
                      {money(index === 0 ? quote.minimumInitialVnd : depositFor(quote.totalVnd, band.from))}
                    </span>
                    <span className="hold-band-days">{t('days', { days: band.days })}</span>
                  </li>
                ))}
                <li>
                  <span className="hold-band-share">100%</span>
                  <span className="hold-band-amount">{money(quote.totalVnd)}</span>
                  <span className="hold-band-days">{t('paidInFull')}</span>
                </li>
              </ol>
              <p className="hold-note">{t('note')}</p>
            </section>

            <div className="hold-coupon">
              {couponOpen ? (
                <div className="hold-coupon-row">
                  <input
                    type="text"
                    value={coupon}
                    placeholder={t('couponPlaceholder')}
                    aria-label={t('couponPlaceholder')}
                    maxLength={100}
                    autoFocus
                    onChange={(event) => setCoupon(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        applyCoupon();
                      }
                    }}
                  />
                  <button type="button" disabled={busy || !coupon.trim()} onClick={applyCoupon}>
                    {busy ? t('couponApplying') : t('couponApply')}
                  </button>
                </div>
              ) : (
                <button type="button" className="hold-link" onClick={() => setCouponOpen(true)}>
                  {t('couponToggle')}
                </button>
              )}
            </div>

            <details className="hold-terms">
              <summary>
                {t('terms')}
                <span aria-hidden="true" />
              </summary>
              <p>{quote.terms}</p>
            </details>

            {!quote.eligible && quote.blockedReason && (
              <p role="status" className="hold-blocked">
                {quote.blockedReason}
              </p>
            )}
          </>
        )}
      </form>
    </StoreDialog>
  );
}
