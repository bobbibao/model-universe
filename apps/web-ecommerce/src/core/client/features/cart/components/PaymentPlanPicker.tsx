'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCheckoutDraft } from '@/shared/client/providers/CheckoutDraftProvider';
import { formatVND } from '@/shared/server/utils/utils';
import { depositDueVnd, type PaymentPlan } from '@/shared/payment';

// The upfront payment and COD balance for the draft's payment plan and an order total. The deposit is 10% of the
// merchandise (`basis`), at least `floor` (the shipping fee, or what the carrier cannot collect).
export function useUpfrontPayment(total: number, basis = total, floor = 0) {
  const { paymentPlan } = useCheckoutDraft();
  const upfront = paymentPlan === 'full' ? total : depositDueVnd(total, basis, floor);
  return {
    paymentPlan,
    depositVnd: paymentPlan === 'deposit' ? upfront : undefined,
    upfrontVnd: upfront,
    balanceVnd: total - upfront,
  };
}

// Checkout payment choice: the deposit (10%, at least the shipping fee; rest COD) or the full amount.
export default function PaymentPlanPicker({
  total,
  basis = total,
  floor = 0,
  compact = false,
  inPerson = false,
  inline = false,
  disabled = false,
  lockedPayment,
}: {
  total: number;
  disabled?: boolean;
  lockedPayment?: {
    paymentPlan: PaymentPlan;
    totalVnd: number;
    upfrontDueVnd: number;
    balanceVnd: number;
    depositAmountVnd: number;
  };
  basis?: number;
  floor?: number;
  compact?: boolean;
  // Collected at the shop: the deposit holds the model and the rest is paid there.
  inPerson?: boolean;
  // The bag: the two plans side by side, without the split (the order summary next to it already shows it).
  inline?: boolean;
}) {
  const t = useTranslations('checkout.payment'),
    locale = useLocale();
  const money = (amount: number) => formatVND(amount, locale);
  const { paymentPlan: draftPlan, setPaymentPlan } = useCheckoutDraft();
  const draftPayment = useUpfrontPayment(total, basis, floor);
  const paymentPlan = lockedPayment?.paymentPlan ?? draftPlan;
  const upfrontVnd = lockedPayment?.upfrontDueVnd ?? draftPayment.upfrontVnd;
  const balanceVnd = lockedPayment?.balanceVnd ?? draftPayment.balanceVnd;
  const locked = disabled || !!lockedPayment;
  const option = (plan: PaymentPlan, title: string, detail: string) => (
    <label className={`payment-plan-option${paymentPlan === plan ? ' is-selected' : ''}`}>
      <input type="radio" name="payment-plan" checked={paymentPlan === plan} onChange={() => setPaymentPlan(plan)} />
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </label>
  );
  return (
    <fieldset disabled={locked} className={`payment-plan${compact ? ' is-compact' : ''}${inline ? ' is-inline' : ''}`}>
      <legend>{t('title')}</legend>
      {option(
        'deposit',
        `${t('deposit')} · ${money(lockedPayment?.depositAmountVnd ?? depositDueVnd(total, basis, floor))}`,
        t(inPerson ? 'depositHintInPerson' : 'depositHint'),
      )}
      {option(
        'full',
        `${t('full')} · ${money(lockedPayment?.totalVnd ?? total)}`,
        t(inPerson ? 'fullHintInPerson' : 'fullHint'),
      )}
      {!inline && (
        <dl className="payment-plan-split" aria-live="polite">
          <div>
            <dt>{t('transferNow')}</dt>
            <dd>{money(upfrontVnd)}</dd>
          </div>
          <div>
            <dt>{t(inPerson ? 'payAtShop' : 'codLater')}</dt>
            <dd>{balanceVnd > 0 ? money(balanceVnd) : t('nothingLater')}</dd>
          </div>
        </dl>
      )}
      <p className="payment-plan-note">
        {locked ? t('locked') : t(inPerson ? 'noteInPerson' : 'note')} <strong>{t('cancelPolicy')}</strong>
      </p>
    </fieldset>
  );
}
