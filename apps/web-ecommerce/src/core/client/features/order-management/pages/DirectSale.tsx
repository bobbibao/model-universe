'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useProductConditions } from '@/shared/client/hooks/useProductConditions';
import { useLocale, useTranslations } from 'next-intl';
import Link, { useRouter } from '@/i18n/navigation';
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb';
import TextField from '@/components/FormElements/TextField';
import SelectField from '@/components/FormElements/SelectField';
import TextAreaField from '@/components/FormElements/TextAreaField';
import Api from '@/core/client/api/Api';
import { formatVND } from '@/shared/server/utils/utils';
import type { DirectSaleCustomer, DirectSaleInput, DirectSaleProduct } from '@/shared/direct-sales';
import type { Order } from '@/shared/types/order';

type SaleLine = DirectSaleProduct & { quantity: number };
const RETRY_STORAGE = 'model-universe.direct-sale.retry.v1';

export default function DirectSale() {
  const t = useTranslations('directSales'),
    condition = useTranslations('catalog'),
    locale = useLocale();
  const conditionTypes = useProductConditions();
  const router = useRouter();
  const [query, setQuery] = useState(''),
    [products, setProducts] = useState<DirectSaleProduct[]>([]);
  const [loading, setLoading] = useState(true),
    [searchFailed, setSearchFailed] = useState(false);
  const [refresh, setRefresh] = useState(0),
    [lines, setLines] = useState<SaleLine[]>([]);
  const [customerQuery, setCustomerQuery] = useState(''),
    [customers, setCustomers] = useState<DirectSaleCustomer[]>([]);
  const [customer, setCustomer] = useState<DirectSaleCustomer | null>(null);
  const [recipientName, setRecipientName] = useState(''),
    [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<DirectSaleInput['channel']>('COUNTER');
  const [fulfillment, setFulfillment] = useState<DirectSaleInput['fulfillment']>('HANDOVER');
  const [payment, setPayment] = useState<DirectSaleInput['payment']>('CASH');
  const [verified, setVerified] = useState(false),
    [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const [refreshingLines, setRefreshingLines] = useState(false);
  const submitting = useRef(false);
  const retry = useRef<{ digest: string; key: string } | null>(null);
  const money = (amount: number) => formatVND(amount, locale);
  const total = lines.reduce((sum, line) => sum + line.salePrice * line.quantity, 0);
  const invalidLines = lines.some(
    (line) => !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > line.stock,
  );

  const refreshSale = async () => {
    setRefresh((value) => value + 1);
    setVerified(false);
    if (!lines.length) return;
    setRefreshingLines(true);
    try {
      const response = await Api.get('/admin/orders/direct-sale/products', {
        params: { ids: lines.map((line) => line.id).join(',') },
      });
      const current = new Map((response.data as DirectSaleProduct[]).map((product) => [product.id, product]));
      setLines((previous) =>
        previous.map((line) => ({ ...line, ...(current.get(line.id) || { stock: 0 }), quantity: line.quantity })),
      );
    } catch {
      setFailed(true);
    } finally {
      setRefreshingLines(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await Api.get('/admin/orders/direct-sale/products', { params: { q: query } });
        if (active) {
          setProducts(response.data);
          setSearchFailed(false);
        }
      } catch {
        if (active) setSearchFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, refresh]);

  useEffect(() => {
    let active = true;
    setCustomers([]);
    if (customer || customerQuery.trim().length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const response = await Api.get('/admin/orders/direct-sale/customers', { params: { q: customerQuery } });
        if (active) setCustomers(response.data);
      } catch {
        /* API displays the error; guest entry remains available. */
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customerQuery, customer]);

  const add = (product: DirectSaleProduct) => {
    setLines((current) => {
      const existing = current.find((line) => line.id === product.id);
      return existing
        ? current.map((line) =>
            line.id === product.id ? { ...product, quantity: Math.min(product.stock, 999, line.quantity + 1) } : line,
          )
        : [...current, { ...product, quantity: 1 }];
    });
    setVerified(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || refreshingLines || invalidLines || !lines.length) return;
    const form = new FormData(event.currentTarget);
    const input: Omit<DirectSaleInput, 'requestKey'> = {
      channel,
      fulfillment,
      customerId: customer?.id ?? null,
      recipientName,
      phone,
      address: String(form.get('address') || ''),
      city: String(form.get('city') || ''),
      note: String(form.get('note') || ''),
      items: lines.map((line) => ({ productId: line.id, quantity: line.quantity })),
      expectedTotal: total,
      payment,
      moneyVerified: payment !== 'UNPAID' && verified,
      externalReference: payment === 'UNPAID' ? '' : reference.trim(),
    };
    submitting.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const digest = JSON.stringify(input);
      try {
        retry.current ??= JSON.parse(sessionStorage.getItem(RETRY_STORAGE) || 'null');
      } catch {
        /* Storage optional. */
      }
      if (retry.current?.digest !== digest) retry.current = { digest, key: crypto.randomUUID() };
      try {
        sessionStorage.setItem(RETRY_STORAGE, JSON.stringify(retry.current));
      } catch {
        /* Memory retry remains. */
      }
      const result = (await Api.post('/admin/orders/direct-sale', { ...input, requestKey: retry.current.key }))
        .data as Order;
      try {
        sessionStorage.removeItem(RETRY_STORAGE);
      } catch {
        /* Storage optional. */
      }
      router.push(`/admin/orders/${result.id}`);
    } catch {
      setFailed(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName={t('title')} />
      <form onSubmit={submit} className="direct-sale-workspace" aria-label={t('title')}>
        <fieldset disabled={busy} className="direct-sale-fields">
          <div className="direct-sale-catalog">
            <section className="mu-panel p-4 sm:p-5" aria-labelledby="sale-products">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 id="sale-products" className="font-bold text-lg">
                  {t('products')}
                </h2>
                <button
                  type="button"
                  className="text-sm text-primary underline"
                  disabled={refreshingLines}
                  onClick={() => void refreshSale()}
                >
                  {t('refresh')}
                </button>
              </div>
              <TextField
                label={t('search')}
                name="productSearch"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <p className="mu-note mt-2">{t('pricesNote')}</p>
              <div className="direct-sale-results" aria-busy={loading}>
                {loading ? (
                  <p className="mu-note py-4" role="status">
                    {t('loading')}
                  </p>
                ) : searchFailed ? (
                  <p role="alert" className="text-danger py-4">
                    {t('searchError')}
                  </p>
                ) : products.length === 0 ? (
                  <p className="mu-note py-4">{t('noProducts')}</p>
                ) : (
                  products.map((product) => {
                    const inCart = lines.find((line) => line.id === product.id)?.quantity || 0;
                    return (
                      <div key={product.id} className="direct-sale-product">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.imageUrl} alt="" width={52} height={60} loading="lazy" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{product.name}</p>
                          <p className="mu-note break-all">{product.sku}</p>
                          <span className={`condition-chip is-${product.condition}`}>
                            {conditionTypes.label(product.condition)}
                          </span>
                          {product.conditionNote && <p className="mu-note line-clamp-2">{product.conditionNote}</p>}
                        </div>
                        <div className="direct-sale-product-action">
                          <strong className="text-sm">{money(product.salePrice)}</strong>
                          <span className="mu-note">{t('stock', { count: product.stock })}</span>
                          <button
                            type="button"
                            className="mu-button-secondary text-sm"
                            disabled={inCart >= Math.min(product.stock, 999)}
                            onClick={() => add(product)}
                            aria-label={t('addProduct', { name: product.name, sku: product.sku })}
                          >
                            {t('add')}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
            <section className="mu-panel p-4 sm:p-5" aria-labelledby="sale-lines">
              <h2 id="sale-lines" className="font-bold text-lg mb-3">
                {t('selected', { count: lines.length })}
              </h2>
              {lines.length === 0 ? (
                <p className="mu-note">{t('empty')}</p>
              ) : (
                lines.map((line) => (
                  <div className="direct-sale-line" key={line.id}>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{line.name}</p>
                      <p className="mu-note break-all">
                        {line.sku} · {conditionTypes.label(line.condition)}
                      </p>
                      <p className="mu-note">{money(line.salePrice)}</p>
                      {line.quantity > line.stock && (
                        <p className="text-danger text-sm">{t('stock', { count: line.stock })}</p>
                      )}
                    </div>
                    <TextField
                      label={t('quantityShort')}
                      aria-label={t('quantity', { sku: line.sku })}
                      name={`quantity-${line.id}`}
                      type="number"
                      min={1}
                      max={Math.min(line.stock, 999)}
                      step={1}
                      required
                      value={line.quantity || ''}
                      onChange={(event) => {
                        setLines((current) =>
                          current.map((item) =>
                            item.id === line.id ? { ...item, quantity: Number(event.target.value) } : item,
                          ),
                        );
                        setVerified(false);
                      }}
                    />
                    <div className="text-right">
                      <strong className="text-sm">{money(line.salePrice * line.quantity)}</strong>
                      <br />
                      <button
                        type="button"
                        className="text-danger text-sm underline"
                        aria-label={t('removeProduct', { sku: line.sku })}
                        onClick={() => {
                          setLines((current) => current.filter((item) => item.id !== line.id));
                          setVerified(false);
                        }}
                      >
                        {t('remove')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
          <div className="direct-sale-checkout">
            <section className="mu-panel p-4 sm:p-5 space-y-4" aria-labelledby="sale-customer">
              <h2 id="sale-customer" className="font-bold text-lg">
                {t('customer')}
              </h2>
              <SelectField
                label={t('channel')}
                name="channel"
                value={channel}
                onChange={(event) => setChannel(event.target.value as DirectSaleInput['channel'])}
                options={['COUNTER', 'ASSISTED'].map((value) => ({ value, label: t(value) }))}
              />
              {customer ? (
                <div className="direct-sale-customer">
                  <strong>{customer.name}</strong>
                  <p className="mu-note break-all">{customer.email}</p>
                  <button
                    type="button"
                    className="underline text-sm"
                    onClick={() => {
                      setCustomer(null);
                      setCustomerQuery('');
                      setRecipientName('');
                      setPhone('');
                    }}
                  >
                    {t('guest')}
                  </button>
                </div>
              ) : (
                <>
                  <TextField
                    label={t('findCustomer')}
                    name="customerSearch"
                    type="search"
                    value={customerQuery}
                    onChange={(event) => setCustomerQuery(event.target.value)}
                    hint={t('guestHint')}
                  />
                  {customers.length > 0 && (
                    <ul className="direct-sale-customer-results" aria-label={t('customerResults')}>
                      {customers.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomer(item);
                              setRecipientName(item.name);
                              setPhone(item.phone || '');
                            }}
                          >
                            <strong>{item.name}</strong>
                            <span>
                              {item.phone} · {item.email}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={t('name')}
                  name="recipientName"
                  autoComplete="off"
                  maxLength={150}
                  required={fulfillment === 'DELIVERY'}
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                />
                <TextField
                  label={t('phone')}
                  name="phone"
                  type="tel"
                  autoComplete="off"
                  maxLength={20}
                  required={fulfillment === 'DELIVERY'}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <SelectField
                label={t('fulfillment')}
                name="fulfillment"
                value={fulfillment}
                onChange={(event) => {
                  const next = event.target.value as DirectSaleInput['fulfillment'];
                  setFulfillment(next);
                  if (next === 'HANDOVER' && payment === 'UNPAID') setPayment('CASH');
                  setVerified(false);
                }}
                options={['HANDOVER', 'DELIVERY'].map((value) => ({ value, label: t(value) }))}
              />
              {fulfillment === 'DELIVERY' && (
                <>
                  <TextField label={t('address')} name="address" required minLength={4} maxLength={500} />
                  <TextField label={t('city')} name="city" required maxLength={150} />
                  <p className="mu-note">{t('deliveryNote')}</p>
                </>
              )}
              <TextAreaField label={t('note')} name="note" rows={2} maxLength={500} />
            </section>
            <section className="mu-panel p-4 sm:p-5 space-y-4" aria-labelledby="sale-payment">
              <h2 id="sale-payment" className="font-bold text-lg">
                {t('payment')}
              </h2>
              <SelectField
                label={t('paymentMethod')}
                name="payment"
                value={payment}
                onChange={(event) => {
                  setPayment(event.target.value as DirectSaleInput['payment']);
                  setVerified(false);
                  setReference('');
                }}
                options={(fulfillment === 'HANDOVER'
                  ? ['CASH', 'BANK_TRANSFER']
                  : ['CASH', 'BANK_TRANSFER', 'UNPAID']
                ).map((value) => ({ value, label: t(value) }))}
              />
              {payment !== 'UNPAID' && (
                <>
                  <TextField
                    label={t('reference')}
                    name="externalReference"
                    required
                    minLength={8}
                    maxLength={128}
                    pattern="[A-Za-z0-9:_.\-]{8,128}"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    hint={t(payment === 'CASH' ? 'cashHint' : 'bankHint')}
                  />
                  <label className="direct-sale-verification">
                    <input
                      type="checkbox"
                      name="moneyVerified"
                      required
                      checked={verified}
                      onChange={(event) => setVerified(event.target.checked)}
                    />
                    <span>{t('verified', { total: money(total) })}</span>
                  </label>
                </>
              )}
              <div className="direct-sale-total">
                <span>{t('total')}</span>
                <strong>{money(total)}</strong>
              </div>
              <p className="mu-note">{t('totalNote')}</p>
              {failed && (
                <p className="text-danger text-sm" role="alert">
                  {t('failed')}
                </p>
              )}
              <button
                type="submit"
                className="mu-button w-full"
                disabled={
                  busy ||
                  refreshingLines ||
                  invalidLines ||
                  lines.length === 0 ||
                  total < 1 ||
                  (payment !== 'UNPAID' && !verified)
                }
              >
                {busy ? t('saving') : t(fulfillment === 'HANDOVER' ? 'complete' : 'create')}
              </button>
              <Link href="/admin/orders" className="block text-center text-sm underline">
                {t('back')}
              </Link>
            </section>
          </div>
        </fieldset>
      </form>
    </>
  );
}
