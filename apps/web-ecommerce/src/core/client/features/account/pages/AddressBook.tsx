'use client';

import '@/css/address-book.css';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import Api from '@/core/client/api/Api';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import ConfirmModal from '@/components/Modal/ConfirmModal';
import TextField from '@/components/FormElements/TextField';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import type { CustomerAddress } from '@/shared/types/customer-tools';
import type { ShippingInfo } from '@/shared/types/order';
import CheckoutForm, { validateShipping, type ShippingErrors } from '../../cart/components/CheckoutForm';
import AddressPicker, { type AddressDraft } from '@/components/Address/AddressPicker';
import { formatDeliveryAddress } from '@/shared/fulfillment';

const empty: ShippingInfo = { recipientName: '', phone: '', address: '', ward: '', district: '', city: '', note: '' };
const complete = (address: AddressDraft) =>
  !!address.provinceCode &&
  !!address.districtCode &&
  !!address.communeCode &&
  (address.street || '').trim().length >= 4;
const draftOf = (row: CustomerAddress): AddressDraft =>
  row.delivery ?? {
    street: row.shipping.address,
    communeName: row.shipping.ward || undefined,
    districtName: row.shipping.district || undefined,
    provinceName: row.shipping.city,
  };

// Retain checkout's address contract, version checks and retry key; editing is opened only when needed.
export default function AddressBook({ embedded = false }: { embedded?: boolean } = {}) {
  const Heading = embedded ? 'h2' : 'h1',
    ItemHeading = embedded ? 'h3' : 'h2';
  const t = useTranslations('customerTools'),
    common = useTranslations('common');
  const { user, loading } = useCurrentUser();
  const [rows, setRows] = useState<CustomerAddress[]>([]),
    [selected, setSelected] = useState<CustomerAddress | null>(null);
  const [shipping, setShipping] = useState(empty),
    [label, setLabel] = useState(''),
    [errors, setErrors] = useState<ShippingErrors>({});
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [delivery, setDelivery] = useState<AddressDraft>({}),
    [addressError, setAddressError] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false),
    [removing, setRemoving] = useState<CustomerAddress | null>(null);
  const pending = useRef<{ digest: string; key: string } | undefined>(undefined);
  const submitting = useRef(false),
    editorHeading = useRef<HTMLHeadingElement>(null),
    addButton = useRef<HTMLButtonElement>(null);
  const load = useCallback(async () => {
    if (!user) return;
    try {
      setRows((await Api.get('/addresses')).data);
      setFailed(false);
      setLoaded(true);
    } catch {
      setFailed(true);
    }
  }, [user]);
  useEffect(() => {
    setRows([]);
    setLoaded(false);
    void load();
  }, [load]);
  useEffect(() => {
    if (editorOpen) editorHeading.current?.focus();
  }, [editorOpen, selected?.id]);
  const reset = () => {
    setSelected(null);
    setShipping(empty);
    setDelivery({});
    setLabel('');
    setErrors({});
    setAddressError(false);
    pending.current = undefined;
  };
  const closeEditor = () => {
    if (submitting.current) return;
    reset();
    setEditorOpen(false);
    requestAnimationFrame(() => addButton.current?.focus());
  };
  const edit = (row: CustomerAddress) => {
    reset();
    setSelected(row);
    setLabel(row.label);
    setShipping(
      Object.fromEntries(
        Object.entries(row.shipping).map(([key, value]) => [key, value || '']),
      ) as unknown as ShippingInfo,
    );
    setDelivery(draftOf(row));
    setEditorOpen(true);
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const lines = {
      ...shipping,
      address: delivery.street || '',
      ward: delivery.communeName || '',
      district: delivery.districtName || '',
      city: delivery.provinceName || '',
    };
    const validation = validateShipping(lines);
    setErrors(validation);
    setAddressError(!complete(delivery));
    if (Object.keys(validation).length || !complete(delivery)) return;
    const body = { label: label || formatDeliveryAddress(delivery).slice(0, 80), shipping: lines, delivery },
      digest = JSON.stringify(body);
    if (pending.current?.digest !== digest) pending.current = { digest, key: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    try {
      await Api.post('/addresses', {
        ...body,
        ...(selected ? { id: selected.id, expectedVersion: selected.version } : { requestKey: pending.current.key }),
      });
      await load();
      reset();
      setEditorOpen(false);
      requestAnimationFrame(() => addButton.current?.focus());
    } catch {
      /* Keep the form and request identity after an uncertain response. */
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await Api.post(`/addresses/${removing.id}/remove`, { expectedVersion: removing.version });
      if (selected?.id === removing.id) {
        reset();
        setEditorOpen(false);
      }
      setRemoving(null);
      await load();
    } catch {
      /* The confirmation remains open until removal is confirmed. */
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  if (loading)
    return (
      <p role="status" className="mu-note">
        {common('loading')}
      </p>
    );
  if (!user)
    return (
      <section className="mu-wrap mu-section">
        <Heading className="mu-heading">{t('addresses')}</Heading>
        <Link className="mu-button mt-6" href="/auth/signin?redirect=%2Faccount%2Faddresses">
          {common('signIn')}
        </Link>
      </section>
    );
  return (
    <section
      className={`address-book ${embedded ? 'is-embedded' : 'mu-wrap mu-section'}`}
      aria-labelledby="address-book-title"
    >
      <header className="address-book-header">
        <div>
          <Heading id="address-book-title">{t('addresses')}</Heading>
          <p>{t('addressBookIntro')}</p>
        </div>
        <button
          ref={addButton}
          className="mu-button"
          type="button"
          disabled={!loaded || busy || editorOpen || rows.length >= 20}
          onClick={() => {
            reset();
            setEditorOpen(true);
          }}
        >
          <AdminIcon name="plus" size={17} />
          {t('addAddress')}
        </button>
      </header>
      {failed && (
        <div role="alert" className="address-book-notice">
          <span>{t('addressLoadFailed')}</span>
          <button className="underline" onClick={() => void load()} disabled={busy}>
            {common('retry')}
          </button>
        </div>
      )}
      {!loaded && !failed && (
        <p role="status" className="mu-note">
          {common('loading')}
        </p>
      )}
      <div className={`address-book-layout ${editorOpen ? 'is-editing' : ''}`}>
        <div className="address-book-list">
          {loaded && <p className="address-book-count">{t('addressCount', { count: rows.length })}</p>}
          {loaded && rows.length === 0 && (
            <div className="address-book-empty">
              <AdminIcon name="truck" size={30} />
              <p>{t('noAddresses')}</p>
            </div>
          )}
          {rows.map((row) => (
            <article className={`address-book-card ${selected?.id === row.id ? 'is-selected' : ''}`} key={row.id}>
              <div className="address-book-card-heading">
                <span className="address-book-icon" aria-hidden="true">
                  <AdminIcon name="truck" size={19} />
                </span>
                <ItemHeading>{row.label}</ItemHeading>
              </div>
              <p className="address-book-contact">
                <strong>{row.shipping.recipientName}</strong>
                <span>{row.shipping.phone}</span>
              </p>
              <p className="address-book-location">
                {row.delivery
                  ? formatDeliveryAddress(row.delivery)
                  : [row.shipping.address, row.shipping.ward, row.shipping.district, row.shipping.city]
                      .filter(Boolean)
                      .join(', ')}
              </p>
              {row.shipping.note && <p className="address-book-location">{row.shipping.note}</p>}
              <div className="address-book-actions">
                <button type="button" disabled={busy} onClick={() => edit(row)}>
                  <AdminIcon name="edit" size={15} />
                  {t('editAddress')}
                </button>
                <button type="button" className="is-danger" disabled={busy} onClick={() => setRemoving(row)}>
                  <AdminIcon name="close" size={15} />
                  {common('remove')}
                </button>
              </div>
            </article>
          ))}
          {loaded && <p className="address-book-policy">{t('addressNote')}</p>}
        </div>
        {loaded && editorOpen && (
          <form className="address-book-editor" aria-label={t('addressForm')} onSubmit={(event) => void save(event)}>
            <ItemHeading tabIndex={-1} ref={editorHeading}>
              {selected ? t('editAddress') : t('addAddress')}
            </ItemHeading>
            <fieldset disabled={busy}>
              <TextField
                label={t('addressLabel')}
                name="addressLabel"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={80}
                placeholder={t('addressLabelHint')}
              />
              <CheckoutForm
                shipping={shipping}
                errors={errors}
                onChange={setShipping}
                showSavedAddresses={false}
                contactOnly
              />
              <AddressPicker value={delivery} onChange={setDelivery} idPrefix="address-book" compact />
              {addressError && (
                <p role="alert" className="text-sm text-danger">
                  {t('addressIncomplete')}
                </p>
              )}
              <div className="address-book-form-actions">
                <button type="submit" className="mu-button" disabled={!selected && rows.length >= 20}>
                  {busy ? common('processing') : common('submit')}
                </button>
                <button type="button" className="mu-button-secondary" onClick={closeEditor}>
                  {common('cancel')}
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </div>
      <ConfirmModal
        open={!!removing}
        danger
        title={t('removeAddressTitle')}
        message={removing?.label}
        confirmLabel={common('remove')}
        onConfirm={remove}
        onClose={() => {
          if (!submitting.current) setRemoving(null);
        }}
      />
    </section>
  );
}
