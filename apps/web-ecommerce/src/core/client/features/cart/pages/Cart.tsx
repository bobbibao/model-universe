'use client';

import FreeshipProgress from '../components/FreeshipProgress';
import VoucherSection from '../components/VoucherSection';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

import { toast } from 'react-toastify';
import ConfirmModal from '@/components/Modal/ConfirmModal';
import AdminIcon from '@/components/Admin/AdminIcon';
import WorkspaceHeader from '@/components/Store/WorkspaceHeader';
import EmptyState from '@/components/Store/EmptyState';
import OrderApi from '@/core/client/api/Order';
import CheckoutApi, { type CheckoutSession } from '@/core/client/api/Checkout';
import CartApi from '@/core/client/api/Cart';
import Api from '@/core/client/api/Api';
import type { CartQuote } from '@/shared/types/cart';
import { useCart } from '@/shared/client/providers/CartProvider';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import { useCheckoutDraft } from '@/shared/client/providers/CheckoutDraftProvider';
import { formatVND } from '@/shared/server/utils/utils';
import { isMemberCode, memberPrice } from '@/shared/pricing';
import CartLineItem from '../components/CartLineItem';
import { ShippingErrors, validateShipping } from '../components/CheckoutForm';
import MeetingSection, { type Showroom } from '../components/MeetingSection';
import OrderConfirmSummary from '../components/OrderConfirmSummary';
import PaymentPlanPicker, { useUpfrontPayment } from '../components/PaymentPlanPicker';
import FulfillmentPicker, { CarrierQuoteLine, type FeeQuote } from '../components/FulfillmentPicker';
import DeliveryAddressSection from '../components/DeliveryAddressSection';
import CheckoutPaymentModal from '../components/CheckoutPaymentModal';
import { clock, useCountdown } from '@/components/Payment/PaymentQr';
import SmartRecommendationRail from '@/core/client/features/recommendations/components/SmartRecommendationRail';

// The browser's last QR checkout: when it was paid elsewhere (another tab, the banking app, a webhook), the bag that
// still holds its items is emptied on the next visit. The open checkout itself always comes from the server.
const SESSION_STORAGE_KEY = 'model-universe.checkout-session.v2';
const storedSession = () => {
  try {
    return Number(localStorage.getItem(SESSION_STORAGE_KEY)) || null;
  } catch {
    return null;
  }
};
const storeSession = (id: number | null) => {
  try {
    if (id) localStorage.setItem(SESSION_STORAGE_KEY, String(id));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* Storage may be disabled. */
  }
};

// The open checkout above the bag (like a marketplace's "waiting for payment" bar): its countdown, pay now, or cancel
// it to check out the bag again.
function PendingCheckoutBar({
  session,
  onPay,
  onCancel,
}: {
  session: CheckoutSession;
  onPay: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('checkoutPayment'),
    locale = useLocale();
  const seconds = useCountdown(session.expiresAt, session.serverTime);
  return (
    <div className="pending-checkout-bar" role="status">
      <span>
        <strong>{t('pendingTitle', { code: `MUC${session.id}` })}</strong>
        <small>
          {t('pendingDetail', {
            amount: formatVND(session.upfrontDueVnd, locale),
            total: formatVND(session.totalVnd, locale),
          })}
          {seconds > 0 ? ` · ${t('timeLeft', { time: clock(seconds) })}` : ''}
        </small>
      </span>
      <span className="flex flex-wrap gap-2">
        <button type="button" className="mu-button" onClick={onPay}>
          {t('openQr')}
        </button>
        <button type="button" className="store-text-link" onClick={onCancel}>
          {t('cancelPayment')}
        </button>
      </span>
    </div>
  );
}

// A summary line with its parts folded under it (TikTok-style): "Goods" with the list price and each benefit.
function SummaryGroup({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  if (!children) return <SummaryRow label={label} value={value} strong />;
  return (
    <details className="cart-summary-group-lines" open>
      <summary className="cart-summary-row is-strong">
        <span>
          {label}
          <AdminIcon name="arrow" size={12} />
        </span>
        <span>{value}</span>
      </summary>
      <div className="cart-summary-sub">{children}</div>
    </details>
  );
}

const SummaryRow = ({
  label,
  value,
  saving,
  strong,
}: {
  label: string;
  value: string;
  saving?: boolean;
  strong?: boolean;
}) => (
  <div className={`cart-summary-row${saving ? ' is-saving' : ''}${strong ? ' is-strong' : ''}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const Cart = () => {
  const t = useTranslations('checkout'),
    locale = useLocale();
  const money = (amount: number) => formatVND(amount, locale);
  const router = useRouter();
  const { user } = useCurrentUser();
  const { entries, count, subtotal, hasIssues, quoting, removeUnavailable, clearCart, refreshQuote } = useCart();
  const benefitSubtotalVnd = entries
    .filter((entry) => entry.line?.status === 'OK' && !entry.line.product?.partnerId)
    .reduce((sum, entry) => sum + (entry.line?.lineTotal || 0), 0);
  const hasPartnerItems = entries.some((entry) => !!entry.line?.product?.partnerId);
  // What the member price saves on the shop's items outside a sale: R − S per unit (the member code, 10% of R).
  const memberSavingVnd = entries.reduce((sum, { item, line }) => {
    const product = line?.product;
    if (
      line?.status !== 'OK' ||
      !product ||
      product.partnerId ||
      (product.discountPercent > 0 && product.salePrice < product.price)
    )
      return sum;
    return sum + (product.price - memberPrice(product.price)) * item.quantity;
  }, 0);
  const {
    setPaymentPlan,
    coupon,
    setCoupon,
    shipping,
    setShipping,
    freeship,
    setFreeship,
    fulfillmentMethod,
    meeting,
    deliveryAddress,
    setDeliveryAddress,
  } = useCheckoutDraft();
  const fulfillment = useTranslations('fulfillment');
  const tierNames = useTranslations('tiers');
  const vouchers = useTranslations('voucherPicker');
  const courier = fulfillmentMethod === 'COURIER_COD';
  const addressComplete =
    !!deliveryAddress.provinceCode &&
    !!deliveryAddress.districtCode &&
    !!deliveryAddress.communeCode &&
    (deliveryAddress.street || '').trim().length >= 4;
  const [onlinePayment, setOnlinePayment] = useState(false);
  const [codLimitVnd, setCodLimitVnd] = useState<number | null>(null);
  useEffect(() => {
    void Api.get('/shipping/config')
      .then((response) => {
        setOnlinePayment(!!response.data.onlinePayment);
        setCodLimitVnd(typeof response.data.codLimitVnd === 'number' ? response.data.codLimitVnd : null);
      })
      .catch(() => undefined);
  }, []);
  // Every carrier's price for this bag and address and the cheapest one (the order uses it); quoted again on change.
  const [feeQuote, setFeeQuote] = useState<{ key: string; quote: FeeQuote | null }>();
  const feeKey = JSON.stringify({
    items: entries.map(({ item }) => [item.productId, item.quantity]),
    address: [
      deliveryAddress.provinceCode,
      deliveryAddress.districtCode,
      deliveryAddress.communeCode,
      deliveryAddress.street?.trim(),
    ],
  });
  useEffect(() => {
    if (!courier || !addressComplete || entries.length === 0) return;
    let active = true;
    const timer = setTimeout(() => {
      void Api.post('/shipping/quote', {
        items: entries.map(({ item }) => ({ productId: item.productId, quantity: item.quantity })),
        address: deliveryAddress,
      })
        .then((response) => active && setFeeQuote({ key: feeKey, quote: response.data }))
        .catch(() => active && setFeeQuote({ key: feeKey, quote: null }));
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeKey, courier, addressComplete]);
  const currentFee = courier && addressComplete && feeQuote?.key === feeKey ? feeQuote.quote : null;
  const feeQuoting = courier && addressComplete && feeQuote?.key !== feeKey;
  const [shippingErrors, setShippingErrors] = useState<ShippingErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [couponQuote, setCouponQuote] = useState<{ signature: string; quote: CartQuote }>();
  // The benefits quoted together (src/shared/promotions.ts, rules v6.2): the main voucher with the member's rank benefit
  // when both profit checks pass, and the free-shipping code against the carrier fee.
  const benefitShippingFee = courier ? (currentFee?.feeVnd ?? 0) : 0;
  const checkoutSignature = JSON.stringify({
    items: entries.map(({ item }) => ({ productId: item.productId, quantity: item.quantity })),
    code: coupon?.code,
    freeship: freeship?.code,
    fee: benefitShippingFee,
  });
  // Quoted even without a code: the quote carries the points the order earns and the signed quote id checkout sends.
  useEffect(() => {
    if (!entries.length) {
      setCouponQuote(undefined);
      return;
    }
    let cancelled = false;
    const request = JSON.parse(checkoutSignature) as {
      items: { productId: number; quantity: number }[];
      code?: string;
      freeship?: string;
      fee: number;
    };
    void CartApi.getQuote(request.items, {
      couponCode: request.code,
      freeshipCode: request.freeship,
      shippingFeeVnd: request.fee,
    }).then((quote) => {
      if (cancelled) return;
      if (quote) setCouponQuote({ signature: checkoutSignature, quote });
      else {
        setCoupon(null);
        setFreeship(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [checkoutSignature, coupon, freeship, entries.length, setCoupon, setFreeship]);

  // Pre-fill the shipping details from the profile once the user is known.
  useEffect(() => {
    if (user) {
      setShipping((current) => ({
        ...current,
        recipientName: current.recipientName || `${user.lastName} ${user.firstName}`.trim(),
        phone: current.phone || user.phone || '',
        address: current.address || user.address || '',
      }));
    }
  }, [user, setShipping]);

  // A coupon with a minimum order stops applying when the cart drops below it (checkout checks it again).
  useEffect(() => {
    if (coupon && !quoting && entries.every((entry) => !!entry.line) && benefitSubtotalVnd < coupon.minOrderVnd) {
      setCoupon(null);
      toast.info(t('couponMinimum', { code: coupon.code, amount: formatVND(coupon.minOrderVnd, locale) }));
    }
  }, [coupon, benefitSubtotalVnd, quoting, entries, setCoupon, t, locale]);

  const checkedQuote = couponQuote?.signature === checkoutSignature ? couponQuote.quote : undefined;
  const couponPending = (!!coupon || !!freeship) && !checkedQuote;
  const discount = checkedQuote?.discount ?? 0;
  const merchandiseTotal = checkedQuote?.total ?? subtotal;
  const shippingFee = courier ? (currentFee?.feeVnd ?? 0) : 0;
  const shippingDiscount = checkedQuote?.shippingDiscountVnd ?? 0;
  const total = merchandiseTotal + shippingFee - shippingDiscount;
  const voucherVnd = checkedQuote?.voucherDiscountVnd ?? 0;
  const memberApplied = isMemberCode(checkedQuote?.couponCode) && voucherVnd > 0;
  const saved = discount + shippingDiscount;
  // Lines show the member price once it applies (or while a member's code is being applied), the list price otherwise.
  const memberPriced = !!user && (memberApplied || couponPending || !checkedQuote);
  // The deposit covers at least the shipping fee and what the carrier cannot collect (above the COD limit).
  const codFloor = courier && codLimitVnd !== null ? Math.max(0, total - codLimitVnd) : 0;
  const depositFloor = Math.max(codFloor, Math.min(shippingFee, total));
  const { paymentPlan, depositVnd, upfrontVnd, balanceVnd } = useUpfrontPayment(total, merchandiseTotal, depositFloor);
  const hasRemovable = entries.some(({ line }) => line && ['UNAVAILABLE', 'OUT_OF_STOCK'].includes(line.status));

  // For courier delivery the address lines come from the address picker; an in-person order is collected at the shop.
  const [showroom, setShowroom] = useState<Showroom | null>(null);
  const orderShipping = courier
    ? {
        ...shipping,
        address: deliveryAddress.street || '',
        ward: deliveryAddress.communeName || '',
        district: deliveryAddress.districtName || '',
        city: deliveryAddress.provinceName || '',
      }
    : { ...shipping, address: showroom?.address || '', ward: '', district: '', city: showroom?.city || '' };

  // Online payment: the QR checkout (the order is created only once the payment arrives).
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const checkoutSubmitting = useRef(false);
  const [recoveringCheckout, setRecoveringCheckout] = useState(true);
  const pendingCheckout = session && ['OPEN', 'PAID'].includes(session.status) ? session : null;
  useEffect(() => {
    if (pendingCheckout) setPaymentPlan(pendingCheckout.paymentPlan);
  }, [pendingCheckout, setPaymentPlan]);
  const onSession = useCallback((next: CheckoutSession | null) => {
    if (!next || ['CANCELLED', 'EXPIRED', 'FAILED'].includes(next.status)) {
      storeSession(null);
      CheckoutApi.forget();
      if (next?.status === 'CANCELLED') {
        setSession(null);
        setPaymentOpen(false);
        return;
      }
    }
    setSession(next);
  }, []);
  const onPaid = useCallback(
    (orderId: number) => {
      storeSession(null);
      CheckoutApi.forget();
      clearCart();
      setPaymentOpen(false);
      toast.success(t('paidToast'));
      router.push(`/thank-you?orderId=${orderId}`);
    },
    [clearCart, router, t],
  );
  // The customer's open checkout, from the server (any tab or device): shown above the bag instead of a second
  // "Thanh toán". The browser's last checkout, when it was paid meanwhile, empties the bag and shows its order.
  useEffect(() => {
    if (!user) {
      setRecoveringCheckout(false);
      return;
    }
    setRecoveringCheckout(true);
    let active = true;
    void (async () => {
      const id = storedSession();
      if (id) {
        const last = await CheckoutApi.status(id).catch(() => null);
        if (!active) return;
        if (last?.status === 'COMPLETED' && last.orderId) return onPaid(last.orderId);
        if (!last || !['OPEN', 'PAID'].includes(last.status)) {
          storeSession(null);
          CheckoutApi.forget();
        }
      }
      const open = await CheckoutApi.open().catch(() => []);
      if (active && open[0]) setSession(open[0]);
      if (active) setRecoveringCheckout(false);
    })();
    return () => {
      active = false;
    };
    // Once per signed-in user; onPaid changes with the cart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  const cancelPending = async () => {
    if (!session) return;
    try {
      onSession(await CheckoutApi.cancel(session.id));
      CheckoutApi.forget();
    } catch {
      /* The toast explains it. */
    }
  };
  const startCheckout = () => {
    if (courier && (!addressComplete || !currentFee)) {
      toast.error(fulfillment(addressComplete ? 'feeQuoting' : 'addressRequired'));
      return;
    }
    const errors = validateShipping(orderShipping);
    setShippingErrors(errors);
    if (fulfillmentMethod === 'DIRECT_MEETING' && !meeting.date) {
      toast.error(fulfillment('meetingDateRequired'));
      return;
    }
    if (Object.keys(errors).length === 0) setConfirming(true);
    else
      requestAnimationFrame(() => {
        const invalid = document.querySelector<HTMLElement>('#checkout [aria-invalid="true"]');
        invalid?.focus();
        (invalid || document.getElementById('checkout'))?.scrollIntoView({
          block: 'center',
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      });
  };

  const placeOrder = async () => {
    if (checkoutSubmitting.current) return;
    checkoutSubmitting.current = true;
    setPlacing(true);
    try {
      const input = {
        items: entries.map(({ item }) => ({ productId: item.productId, quantity: item.quantity })),
        shipping: orderShipping,
        // Only the benefits the quote accepted; a refused code is shown in the cart, not sent.
        couponCode: checkedQuote?.couponCode || undefined,
        freeshipCode: checkedQuote?.freeshipCode || undefined,
        expectedTotal: total,
        // The signed quote of the shown prices and benefits; the server refuses the order if anything changed since.
        quoteId: checkedQuote?.quote?.id,
        paymentPlan,
        depositVnd,
        fulfillmentMethod,
        ...(courier ? { deliveryAddress } : { meeting: { date: meeting.date, slot: meeting.slot } }),
      };
      if (onlinePayment) {
        // The QR dialog: the order is created once the payment arrives; the cart stays until then.
        try {
          const opened = await CheckoutApi.start(input, locale);
          setConfirming(false);
          storeSession(opened.id);
          setSession(opened);
          setPaymentOpen(true);
        } catch {
          const pending = await CheckoutApi.open().catch(() => []);
          if (pending[0]) setSession(pending[0]);
          setConfirming(false);
          refreshQuote();
        }
        return;
      }
      const order = await OrderApi.placeOrder(input);
      setConfirming(false);
      if (order) {
        clearCart();
        router.push(`/thank-you?orderId=${order.id}`);
      } else {
        // Stock or prices may have changed: refresh the cart check.
        refreshQuote();
      }
    } finally {
      checkoutSubmitting.current = false;
      setPlacing(false);
    }
  };

  // The one checkout action (resume a payment, place the order, or sign in), in the summary and the mobile bar.
  const checkoutButton = (className: string) =>
    user && session && (session.status === 'OPEN' || session.status === 'PAID') ? (
      <button onClick={() => setPaymentOpen(true)} className={className}>
        {t('resumePayment')}
        <AdminIcon name="arrow" size={17} />
      </button>
    ) : user ? (
      <button onClick={startCheckout} disabled={hasIssues || quoting || couponPending} className={className}>
        {t(onlinePayment ? 'payNow' : 'placeNow')}
        <AdminIcon name="arrow" size={17} />
      </button>
    ) : (
      <Link href="/auth/signin?redirect=/cart" className={className}>
        {t('signIn')}
        <AdminIcon name="arrow" size={17} />
      </Link>
    );

  if (count === 0) {
    return (
      <section className="mu-wrap store-workspace cart-workspace">
        <WorkspaceHeader title={t('title')} icon="bag" />
        <EmptyState icon="bag" title={t('emptyTitle')} description={t('empty')}>
          <Link href="/cua-hang" className="mu-button">
            {t('continue')}
            <AdminIcon name="arrow" size={16} />
          </Link>
        </EmptyState>
        <SmartRecommendationRail surface="cart" defaultStrategy="for_you" limit={4} eager />
      </section>
    );
  }

  return (
    <section className="mu-wrap store-workspace cart-workspace">
      <WorkspaceHeader
        title={t('title')}
        count={t('countChip', { count })}
        actions={
          <Link href="/cua-hang" className="store-text-link">
            {t('continue')}
            <AdminIcon name="arrow" size={16} />
          </Link>
        }
      />
      {session && (session.status === 'OPEN' || session.status === 'PAID') && (
        <PendingCheckoutBar
          session={session}
          onPay={() => setPaymentOpen(true)}
          onCancel={() => void cancelPending()}
        />
      )}
      <div className="cart-workspace-layout">
        <div className="cart-main">
          <section className="cart-items-panel" aria-label={t('itemsTitle')}>
            <div className="cart-panel-heading">
              <h2>{t('itemsTitle')}</h2>
              <span>{entries.length}</span>
            </div>
            {hasIssues && (
              <div className="cart-issues" role="alert">
                <span>{t('issues')}</span>
                {hasRemovable && <button onClick={removeUnavailable}>{t('removeUnavailable')}</button>}
              </div>
            )}
            {entries.map((entry) => (
              <CartLineItem key={entry.item.productId} entry={entry} memberPriced={memberPriced} />
            ))}
          </section>
          {user && (
            <section id="checkout" className="cart-delivery">
              <div className="cart-panel-heading">
                <h2>
                  <AdminIcon name="pin" size={18} />
                  {t('shippingTitle')}
                </h2>
                {/* The method switch sits on the heading row: one line less before the address. */}
                <FulfillmentPicker />
              </div>
              <div className="cart-delivery-body">
                {courier ? (
                  <>
                    <DeliveryAddressSection
                      shipping={shipping}
                      errors={shippingErrors}
                      onShippingChange={setShipping}
                      address={deliveryAddress}
                      onAddressChange={setDeliveryAddress}
                    >
                      <CarrierQuoteLine quote={currentFee} quoting={feeQuoting} />
                    </DeliveryAddressSection>
                  </>
                ) : (
                  <MeetingSection
                    shipping={shipping}
                    errors={shippingErrors}
                    onShippingChange={setShipping}
                    onShowroom={setShowroom}
                  />
                )}
              </div>
              <PaymentPlanPicker
                disabled={confirming || placing || recoveringCheckout || !!pendingCheckout}
                lockedPayment={pendingCheckout ?? undefined}
                total={total}
                basis={merchandiseTotal}
                floor={depositFloor}
                inPerson={!courier}
                inline
              />
              {codFloor > 0 && codLimitVnd !== null && (
                <p className="payment-plan-note">
                  {fulfillment('codLimitNote', {
                    limit: money(codLimitVnd),
                    minimum: money(Math.max(codFloor, upfrontVnd)),
                  })}
                </p>
              )}
              {onlinePayment && <p className="payment-plan-note">{fulfillment('onlinePaymentNote')}</p>}
            </section>
          )}
        </div>
        <aside className="cart-sidebar" aria-label={t('summaryTitle')}>
          {/* One sticky card that fits a laptop screen: offers, the lines they change, the total and the button. */}
          <section className="cart-order-summary" aria-busy={quoting || couponPending}>
            <header className="cart-summary-head">
              <h2>{t('summaryTitle')}</h2>
              <span>{t('countChip', { count })}</span>
            </header>
            {courier && benefitSubtotalVnd > 0 && (
              <FreeshipProgress
                subtotal={benefitSubtotalVnd}
                appliedVnd={checkedQuote?.shippingDiscountVnd ?? 0}
                loggedIn={!!user}
                hasFee={benefitShippingFee > 0}
              />
            )}
            <div className="cart-summary-group">
              <h3>{t('couponTitle')}</h3>
              {user && (
                <Link href="/uu-dai" className="cart-summary-link">
                  {vouchers('huntShort')}
                </Link>
              )}
            </div>
            <VoucherSection
              loggedIn={!!user}
              items={entries.map(({ item }) => ({
                productId: item.productId,
                quantity: item.quantity,
              }))}
              subtotal={benefitSubtotalVnd}
              shippingFeeVnd={benefitShippingFee}
              coupon={coupon}
              freeship={freeship}
              onCoupon={setCoupon}
              onFreeship={setFreeship}
              quote={checkedQuote}
            />
            {memberSavingVnd > 0 && !memberApplied && !(user && (couponPending || quoting)) && (
              <p className="cart-member-hint">
                <AdminIcon name="spark" size={14} />
                {user ? (
                  <span>{t('memberHint.other', { amount: money(memberSavingVnd) })}</span>
                ) : (
                  <Link href="/auth/signin?redirect=/cart">
                    {t('memberHint.guest', { amount: money(memberSavingVnd) })}
                  </Link>
                )}
              </p>
            )}
            <div className="cart-summary-lines">
              <SummaryGroup label={t('goods')} value={money(subtotal - discount)}>
                {discount > 0 && (
                  <>
                    <SummaryRow label={t('originalPrice')} value={money(subtotal)} />
                    {voucherVnd > 0 && (
                      <SummaryRow
                        label={
                          memberApplied
                            ? t('benefits.member')
                            : `${t('benefits.voucher')} ${checkedQuote?.couponCode ?? ''}`.trim()
                        }
                        value={`-${money(voucherVnd)}`}
                        saving
                      />
                    )}
                    {(checkedQuote?.rankDiscountVnd ?? 0) > 0 && checkedQuote?.rank && (
                      <SummaryRow
                        label={t('benefits.rank', { tier: tierNames(checkedQuote.rank.tier) })}
                        value={`-${money(checkedQuote.rankDiscountVnd!)}`}
                        saving
                      />
                    )}
                  </>
                )}
              </SummaryGroup>
              {hasPartnerItems && (
                <p className="cart-summary-note">{t('shopBenefitsOnly', { amount: money(benefitSubtotalVnd) })}</p>
              )}
              <SummaryGroup
                label={t('shippingFee')}
                value={
                  !courier
                    ? fulfillment('meetingFree')
                    : currentFee
                      ? money(shippingFee - shippingDiscount)
                      : fulfillment(feeQuoting ? 'feeQuoting' : 'feeNeedsAddress')
                }
              >
                {shippingDiscount > 0 && currentFee && (
                  <>
                    <SummaryRow label={t('shippingLine')} value={money(shippingFee)} />
                    <SummaryRow label={t('benefits.freeship')} value={`-${money(shippingDiscount)}`} saving />
                  </>
                )}
              </SummaryGroup>
            </div>
            <div className="cart-summary-total">
              <span>{t('total')}</span>
              <strong>{money(total)}</strong>
              {(saved > 0 || (checkedQuote?.earnedPoints ?? 0) > 0) && (
                <small>
                  {saved > 0 && (
                    <b>
                      {t('savedPercent', {
                        amount: money(saved),
                        percent: Math.round((saved * 100) / Math.max(1, subtotal + shippingFee)),
                      })}
                    </b>
                  )}
                  {saved > 0 && (checkedQuote?.earnedPoints ?? 0) > 0 && ' · '}
                  {(checkedQuote?.earnedPoints ?? 0) > 0 && t('pointsLine', { points: checkedQuote!.earnedPoints! })}
                </small>
              )}
            </div>
            {user && (
              <dl className="cart-pay-split">
                <div>
                  <dt>{t('payment.transferNow')}</dt>
                  <dd>{money(upfrontVnd)}</dd>
                </div>
                <div>
                  <dt>{t(courier ? 'payment.codLater' : 'payment.payAtShop')}</dt>
                  <dd>{balanceVnd > 0 ? money(balanceVnd) : t('payment.nothingLater')}</dd>
                </div>
              </dl>
            )}
            {checkoutButton('mu-button cart-review-button')}
            <p className="cart-checkout-note" role="status">
              {quoting || couponPending ? t('quotePending') : t('reviewNote')}
            </p>
          </section>
        </aside>
      </div>
      <SmartRecommendationRail
        surface="cart"
        defaultStrategy="cart_addon"
        cartProductIds={entries.map(({ item }) => item.productId)}
        cartSubtotalVnd={merchandiseTotal}
        limit={4}
      />
      {/* Phones: the total and the action stay on screen above the tab bar (TikTok-style). */}
      <div className="cart-mobile-bar">
        <div>
          <span>{t('mobileTotal', { count })}</span>
          <strong>{money(total)}</strong>
          {saved > 0 && (
            <small>
              {t('savedShort', { percent: Math.round((saved * 100) / Math.max(1, subtotal + shippingFee)) })}
            </small>
          )}
        </div>
        {checkoutButton('mu-button cart-mobile-bar-button')}
      </div>
      <ConfirmModal
        open={confirming}
        title={t('confirmTitle')}
        message={
          <OrderConfirmSummary
            items={entries.map(({ item, line }) => ({
              key: String(item.productId),
              name: line?.product?.name || item.name,
              imageUrl: line?.product?.imageUrl || item.imageUrl,
              quantity: item.quantity,
            }))}
            count={count}
            courier={courier}
            recipient={`${orderShipping.recipientName} · ${orderShipping.phone}`}
            address={
              courier
                ? [orderShipping.address, orderShipping.ward, orderShipping.district, orderShipping.city]
                    .filter(Boolean)
                    .join(', ')
                : orderShipping.address
            }
            carrierName={currentFee?.carrier?.carrierName}
            parcels={currentFee?.parcels}
            visit={
              courier
                ? undefined
                : `${meeting.date.split('-').reverse().join('/')} · ${fulfillment(`slots.${meeting.slot}`)}`
            }
            shippingFeeVnd={shippingFee}
            totalVnd={total}
            upfrontVnd={upfrontVnd}
            balanceVnd={balanceVnd}
            onlinePayment={onlinePayment}
            benefits={{
              listVnd: subtotal,
              voucherCode: checkedQuote?.couponCode ?? null,
              voucherVnd: checkedQuote?.voucherDiscountVnd ?? 0,
              rankTier: checkedQuote?.rank?.tier ?? null,
              rankVnd: checkedQuote?.rankDiscountVnd ?? 0,
              shippingDiscountVnd: shippingDiscount,
              earnedPoints: checkedQuote?.earnedPoints ?? 0,
            }}
          />
        }
        confirmLabel={t(onlinePayment ? 'confirmPay' : 'confirm')}
        onConfirm={placeOrder}
        onClose={() => {
          if (!placing) setConfirming(false);
        }}
      />
      {session && (
        <CheckoutPaymentModal
          session={session}
          open={paymentOpen}
          onSession={onSession}
          onPaid={onPaid}
          onClose={() => setPaymentOpen(false)}
        />
      )}
    </section>
  );
};

export default Cart;
