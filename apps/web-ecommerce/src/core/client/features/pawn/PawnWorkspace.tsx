'use client';

import DateTimeInput from '@/components/DateTimeInput';
import PawnGovernancePanel from './PawnGovernancePanel';
import { ServiceHeader, ServiceTerms, ServiceEmpty } from '@/components/Services/ServiceExperience';

import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Api from '@/core/client/api/Api';
import Link from '@/i18n/navigation';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import { formatVND } from '@/shared/server/utils/utils';
import { PAWN_DAY_MS, pawnInterest } from '@/shared/pawn-rules';
import type { PawnContract, PawnTerms } from '@/shared/types/pawn';
import { COLLECTIBLE_ASSET_FIELDS } from '@/core/client/features/buyback/ConditionFields';
import ProductPicker, { type PickedProduct } from '@/core/client/features/inventory/components/ProductPicker';
import PawnDisposalPanel from './PawnDisposalPanel';
import ServiceConditionCasePanel from '@/core/client/features/buyback/ServiceConditionCasePanel';
import ServiceBasket from '@/core/client/features/buyback/ServiceBasket';
import { useSearchParams } from 'next/navigation';
import ServiceStatusBadge from '@/components/Services/ServiceStatusBadge';
import ServiceMediaGallery from '@/components/Services/ServiceMediaGallery';

export default function PawnWorkspace({ admin = false }: { admin?: boolean }) {
  const t = useTranslations('pawn'),
    assetLabels = useTranslations('buyback'),
    common = useTranslations('common'),
    catalog = useTranslations('catalog'),
    policyLabels = useTranslations('policy'),
    locale = useLocale();
  const { user } = useCurrentUser();
  const [rows, setRows] = useState<PawnContract[]>([]),
    [selected, setSelected] = useState<PawnContract | null>(null);
  const [notifications, setNotifications] = useState<
    { id: number; entityId: number; kind: 'pawn_due' | 'pawn_overdue'; details: { dueAt: string; days: number } }[]
  >([]);
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const [contractUploads, setContractUploads] = useState<{ id: number; name: string }[]>([]),
    [product, setProduct] = useState<PickedProduct | null>(null);
  const root = admin ? '/admin/pawn' : '/pawn';
  const chosenModel = Number(useSearchParams().get('mau')) || null;
  const load = useCallback(async () => {
    if (!user) return;
    try {
      setRows((await Api.get(root)).data);
      if (!admin) setNotifications((await Api.get('/pawn/notifications')).data);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [admin, root, user]);
  useEffect(() => {
    setRows([]);
    setNotifications([]);
    setSelected(null);
    setContractUploads([]);
    setProduct(null);
    void load();
  }, [load]);

  const PAGE_SIZE = 6;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  useEffect(() => {
    if (selected?.id && rows.length > 0) {
      const idx = rows.findIndex((r) => r.id === selected.id);
      if (idx !== -1) {
        const page = Math.floor(idx / PAGE_SIZE) + 1;
        setCurrentPage((prev) => (prev !== page ? page : prev));
      }
    }
  }, [selected?.id, rows]);
  useEffect(() => {
    if (admin || busy || !selected || !['active', 'DUE_GRACE', 'OVERDUE_REVIEW', 'repaid'].includes(selected.status))
      return;
    const id = selected.id;
    let cancelled = false;
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const updated = (await Api.get(`${root}/${id}`)).data;
        if (!cancelled) setSelected((current) => (current?.id === id ? updated : current));
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [admin, busy, root, selected, user?.id]);
  useEffect(() => {
    if (selected?.id && matchMedia('(max-width: 1023px)').matches)
      document.getElementById('pawn-detail')?.scrollIntoView({ block: 'start' });
  }, [selected?.id]);
  const open = async (id: number) => {
    setBusy(true);
    try {
      setSelected((await Api.get(`${root}/${id}`)).data);
      setContractUploads([]);
      setProduct(null);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const post = async (endpoint: string, data: Record<string, unknown>) => {
    if (!selected) return;
    setBusy(true);
    try {
      setSelected(
        (await Api.post(`${root}/${selected.id}/${endpoint}`, { ...data, expectedVersion: selected.version })).data,
      );
      setContractUploads([]);
      await load();
    } catch {
      await open(selected.id);
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: React.FormEvent<HTMLFormElement>, action: string, endpoint = 'actions') => {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      data: Record<string, unknown> = { ...Object.fromEntries(form), action };
    for (const key of ['appraisalVnd', 'principalVnd', 'termDays', 'amountVnd'])
      if (form.has(key)) data[key] = Number(form.get(key));
    for (const key of [
      'moneyVerified',
      'handoverVerified',
      'conditionMatchesAgreement',
      'bilateralSignatureVerified',
      'termsAccepted',
      'disposalTermsAccepted',
      'contractEligibilityVerified',
      'authorized',
      'actualPhotosVerified',
    ])
      data[key] = form.has(key);
    if (action === 'quote') data.disposalAfterGrace = form.get('disposalAfterGrace') === 'yes';
    if (action === 'extension_decision') data.accepted = form.get('accepted') === 'yes';
    if (action === 'request_extension') data.proposedDueAt = new Date(String(form.get('proposedDueAt'))).toISOString();
    if (endpoint === 'intake') data.productId = product?.id;
    void post(endpoint, data);
  };
  const uploadContract = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target,
      file = input.files?.[0];
    if (!file || !selected) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('purpose', 'pawn');
      const saved = (await Api.post('/evidence', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
      setContractUploads((current) => [...current, { id: saved.id, name: file.name }]);
    } catch {
      /* Shared API reports the validated private document upload error. */
    } finally {
      setBusy(false);
      input.value = '';
    }
  };
  const detailsField = (
    <label className="mu-field">
      {t('details')}
      <textarea name="details" maxLength={1500} required />
    </label>
  );
  const verifyHandover = (
    <label className="flex items-start gap-3 text-sm">
      <input name="handoverVerified" type="checkbox" required />
      {t('handoverVerified')}
    </label>
  );
  const button = (key: string) => (
    <button className="mu-button" disabled={busy}>
      {t(key)}
    </button>
  );
  const terms = selected?.terms;
  const forecast = terms
    ? pawnInterest(terms.principalVnd, terms.policy, new Date(0), new Date(terms.termDays * PAWN_DAY_MS)).interestVnd
    : 0;
  return (
    <section className={`service-workspace ${admin ? 'py-6' : 'mu-wrap py-12'}`}>
      <ServiceHeader service="pawn" admin={admin} title={t(admin ? 'adminTitle' : 'title')} />
      <ServiceTerms>
        <p>{t('intro')}</p>
        <p className="font-bold">{t('custodyNote')}</p>
        <p>{t('capNote')}</p>
      </ServiceTerms>
      {!user ? (
        <Link className="mu-button" href="/auth/signin?redirect=/services/pawn">
          {t('signIn')}
        </Link>
      ) : (
        <>
          {failed && (
            <button className="mu-button mb-5" onClick={() => void load()}>
              {common('retry')}
            </button>
          )}
          {!admin && <ServiceBasket key={user.id} kind="pawn" initialProductId={chosenModel} onSent={load} />}
          {!admin &&
            notifications.map((notification) => (
              <button
                key={notification.id}
                className="mu-panel mb-3 block w-full p-4 text-left"
                onClick={() => void open(notification.entityId)}
              >
                {t(notification.kind === 'pawn_overdue' ? 'overdueReminder' : 'dueReminder', {
                  id: notification.entityId,
                  days: notification.details.days,
                  date: new Date(notification.details.dueAt).toLocaleString(locale),
                })}
              </button>
            ))}
          {!failed && !rows.length && <ServiceEmpty>{t('empty')}</ServiceEmpty>}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(330px,380px)_minmax(0,1fr)]">
            <div className="space-y-3 lg:sticky lg:top-24">
              {/* Summary & Page Info */}
              <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-400">
                <span>
                  Hiển thị {(currentPage - 1) * PAGE_SIZE + 1} -{' '}
                  {Math.min(currentPage * PAGE_SIZE, rows.length)} / {rows.length} hồ sơ
                </span>
                {totalPages > 1 && (
                  <span>
                    Trang {currentPage}/{totalPages}
                  </span>
                )}
              </div>

              {/* Compact Card List */}
              <div className="space-y-2">
                {paginatedRows.map((row) => (
                  <button
                    className={`group relative w-full text-left rounded-xl p-2.5 sm:p-3 transition-all duration-150 border ${
                      selected?.id === row.id
                        ? 'border-2 border-purple-600 bg-purple-50/50 shadow-xs ring-2 ring-purple-600/15 dark:bg-purple-950/30 dark:border-purple-500'
                        : 'border-slate-200/80 bg-white hover:border-purple-300 hover:shadow-2xs hover:bg-slate-50/50 dark:border-strokedark dark:bg-boxdark dark:hover:border-slate-500'
                    }`}
                    key={row.id}
                    onClick={() => void open(row.id)}
                    disabled={busy}
                    aria-pressed={selected?.id === row.id}
                  >
                    {/* Left active highlight bar */}
                    {selected?.id === row.id && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-purple-600 dark:bg-purple-400" />
                    )}

                    {/* Top row: ID badge + Type + Status badge */}
                    <div className="flex items-center justify-between gap-1.5 pl-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[11px] font-black tracking-wide text-purple-900 bg-purple-100 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200/80 dark:border-purple-800">
                          #{row.id}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded dark:bg-meta-4 dark:text-slate-300">
                          Cầm cố
                        </span>
                      </div>
                      <ServiceStatusBadge status={row.status} label={t(`status.${row.status}`)} size="sm" />
                    </div>

                    {/* Middle row: Model Name (single line, truncate) */}
                    <h4 className="mt-1.5 pl-1 text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors truncate dark:text-white">
                      {row.asset.name}
                    </h4>

                    {/* Bottom Row: Date / Model Code + Principal/Status */}
                    <div className="mt-1.5 pl-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate max-w-[170px]">
                        {row.asset.modelCode ? `${row.asset.modelCode} · ` : ''}{new Date(row.createdAt).toLocaleDateString(locale)}
                      </span>
                      {row.terms?.principalVnd ? (
                        <div className="flex items-baseline gap-1 shrink-0 ml-2">
                          <span className="text-[9px] font-medium text-slate-400">Hạn mức:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                            {formatVND(row.terms.principalVnd, locale)}
                          </span>
                        </div>
                      ) : row.overdue ? (
                        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 shrink-0">
                          {t('overdue')}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic shrink-0">Chờ định giá</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Compact Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs dark:border-strokedark/50">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none dark:border-strokedark dark:bg-boxdark dark:text-slate-300 dark:hover:bg-meta-4"
                  >
                    ← Trước
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                      .map((page, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <React.Fragment key={page}>
                            {prev && page - prev > 1 && <span className="px-0.5 text-slate-400">…</span>}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(page)}
                              className={`min-w-[28px] rounded-lg px-2 py-1 text-xs font-bold transition-all ${
                                currentPage === page
                                  ? 'bg-purple-600 text-white shadow-2xs'
                                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-strokedark dark:bg-boxdark dark:text-slate-300 dark:hover:bg-meta-4'
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none dark:border-strokedark dark:bg-boxdark dark:text-slate-300 dark:hover:bg-meta-4"
                  >
                    Sau →
                  </button>
                </div>
              )}
            </div>
            {selected && (
              <div
                id="pawn-detail"
                className="order-first min-w-0 scroll-mt-24 space-y-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-7 lg:order-none dark:border-strokedark dark:bg-boxdark"
              >
                <div className="border-b border-slate-100 pb-5 dark:border-strokedark">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 dark:bg-meta-4 dark:text-slate-200 px-2.5 py-1 rounded-md">
                        #{selected.id}
                      </span>
                      <ServiceStatusBadge status={selected.status} label={t(`status.${selected.status}`)} size="md" />
                    </div>
                    {selected.terms?.principalVnd && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Hạn mức: {formatVND(selected.terms.principalVnd, locale)}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                    {selected.asset.name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {assetLabels('version', { version: selected.version })}
                  </p>
                </div>
                <PawnGovernancePanel
                  key={selected.id}
                  row={selected}
                  admin={admin}
                  onUpdated={() => {
                    void open(selected.id);
                    void load();
                  }}
                />
                <ServiceConditionCasePanel
                  kind="pawn"
                  reviewNote={selected.conditionCaseReviewNote}
                  key={selected.id}
                  snapshot={selected.conditionCase}
                  status={selected.conditionCaseStatus}
                  admin={admin}
                  editable={['submitted', 'quoted'].includes(selected.status)}
                  busy={busy}
                  post={post}
                />
                <dl className="grid gap-3 sm:grid-cols-2">
                  {COLLECTIBLE_ASSET_FIELDS.filter((key) => key !== 'name').map((key) => (
                    <div key={key}>
                      <dt className="mu-note">{assetLabels(`asset.${key}`)}</dt>
                      <dd className="break-words whitespace-pre-line">
                        {key === 'assemblyState' ? catalog(selected.asset[key]) : selected.asset[key]}
                      </dd>
                    </div>
                  ))}
                </dl>
                <ServiceMediaGallery
                  files={selected.evidence || []}
                  title={assetLabels('photos')}
                  subtitle="Ảnh chụp thực tế tài sản cầm cố từ khách hàng"
                  badge="Tài sản cầm cố"
                  emptyMessage="Chưa có ảnh bằng chứng nào được tải lên."
                />
                {terms && (
                  <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                    <h3 className="text-xl font-bold">{t('terms')}</h3>
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="mu-note">{t('appraisal')}</dt>
                        <dd>{formatVND(terms.appraisalVnd, locale)}</dd>
                      </div>
                      <div>
                        <dt className="mu-note">{t('principal')}</dt>
                        <dd className="text-xl font-bold">{formatVND(terms.principalVnd, locale)}</dd>
                      </div>
                      <div>
                        <dt className="mu-note">{t('dailyRate')}</dt>
                        <dd>{terms.policy.dailyRateBasisPoints / 100}%</dd>
                      </div>
                      <div>
                        <dt className="mu-note">{t('termDays')}</dt>
                        <dd>{terms.termDays}</dd>
                      </div>
                      <div>
                        <dt className="mu-note">{t('forecast')}</dt>
                        <dd>{formatVND(forecast, locale)}</dd>
                      </div>
                      <div>
                        <dt className="mu-note">{policyLabels('fields.graceDays')}</dt>
                        <dd>{terms.policy.graceDays}</dd>
                      </div>
                    </dl>
                    <p className="mu-note">
                      {policyLabels(`values.${terms.policy.dayCount}`)} ·{' '}
                      {policyLabels(`values.${terms.policy.rounding}`)}
                    </p>
                    <p className="mu-note">{policyLabels(`values.${terms.policy.interestStopEvent}`)}</p>
                    <p className="whitespace-pre-line">{terms.contractText}</p>
                    <p className="mu-note">{t(terms.disposalAfterGrace ? 'disposalAgreed' : 'disposalNotAgreed')}</p>
                    <p className="mu-note">{t('startNote')}</p>
                  </div>
                )}
                {selected.contractReference && (
                  <p className="mu-note">
                    {t('contractReference')}: {selected.contractReference}
                  </p>
                )}
                {selected.custodyReference && (
                  <p className="mu-note">
                    {t('custodyReference')}: {selected.custodyReference}
                  </p>
                )}
                {selected.disbursedAt && (
                  <div className="rounded-lg bg-cyan-50 p-4">
                    <h3 className="font-bold">{t('redemptionEstimate')}</h3>
                    <p className="mt-3 text-3xl font-bold">{formatVND(selected.estimate.remainingVnd, locale)}</p>
                    <p className="mu-note">
                      {t('interest')}: {formatVND(selected.estimate.interestVnd, locale)} ·{' '}
                      {t('chargedDays', { days: selected.estimate.days })}
                    </p>
                    <p className="mu-note">
                      {t('collected')}: {formatVND(selected.estimate.collectedVnd, locale)}
                    </p>
                    <p className="mu-note">
                      {t('asOf', { date: new Date(selected.estimate.asOf).toLocaleString(locale) })}
                    </p>
                    <p className="mu-note">
                      {t('dueAt')}: {selected.dueAt ? new Date(selected.dueAt).toLocaleString(locale) : '—'}
                    </p>
                    {selected.overdue && <p className="mt-2 font-semibold text-red-700">{t('overdue')}</p>}
                    <button className="mt-3 underline" disabled={busy} onClick={() => void open(selected.id)}>
                      {t('refreshEstimate')}
                    </button>
                  </div>
                )}
                {!admin && selected.status === 'quoted' && (
                  <form aria-label={t('accept')} className="space-y-4" onSubmit={(event) => submit(event, 'accept')}>
                    <label className="flex items-start gap-3 text-sm">
                      <input name="termsAccepted" type="checkbox" required />
                      {t('termsAccepted')}
                    </label>
                    {terms?.disposalAfterGrace && (
                      <label className="flex items-start gap-3 text-sm">
                        <input name="disposalTermsAccepted" type="checkbox" required />
                        {t('disposalTermsAccepted')}
                      </label>
                    )}
                    {button('accept')}
                  </form>
                )}
                {!admin && selected.status === 'accepted' && !selected.contractEvidenceIds.length && (
                  <div className="space-y-4">
                    <h3 className="font-bold">{t('signedContract')}</h3>
                    <p className="mu-note">{t('signedContractNote')}</p>
                    <label className="mu-field">
                      {t('uploadContract')}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy || contractUploads.length >= 12}
                        onChange={(event) => void uploadContract(event)}
                      />
                    </label>
                    {contractUploads.map((file) => (
                      <p className="mu-note" key={file.id}>
                        {file.name}
                      </p>
                    ))}
                    <button
                      className="mu-button"
                      disabled={busy || !contractUploads.length}
                      onClick={() =>
                        void post('actions', {
                          action: 'attach_contract',
                          evidenceIds: contractUploads.map((file) => file.id),
                        })
                      }
                    >
                      {t('attachContract')}
                    </button>
                  </div>
                )}
                {!admin && ['active', 'DUE_GRACE'].includes(selected.status) && !selected.extensionRequest && (
                  <form
                    aria-label={t('requestExtension')}
                    className="space-y-4"
                    onSubmit={(event) => submit(event, 'request_extension')}
                  >
                    <h3 className="font-bold">{t('requestExtension')}</h3>
                    <label className="mu-field">
                      {t('proposedDueAt')}
                      <DateTimeInput name="proposedDueAt" type="datetime-local" required />
                    </label>
                    {detailsField}
                    <p className="mu-note">{t('extensionNote')}</p>
                    {button('requestExtension')}
                  </form>
                )}
                {!admin && !selected.disbursedAt && !selected.custodyAt && selected.status !== 'cancelled' && (
                  <form
                    aria-label={t('cancelRequest')}
                    className="space-y-4 border-t border-slate-200 pt-4"
                    onSubmit={(event) => submit(event, 'cancel')}
                  >
                    {detailsField}
                    {button('cancelRequest')}
                  </form>
                )}
                {selected.extensionRequest && (
                  <div>
                    <h3 className="font-bold">{t('pendingExtension')}</h3>
                    <p className="mu-note">
                      {new Date(selected.extensionRequest.proposedDueAt).toLocaleString(locale)} ·{' '}
                      {selected.extensionRequest.reason}
                    </p>
                  </div>
                )}
                {selected.webQuote && (
                  <div className="rounded-lg border border-slate-200 p-4 text-sm">
                    <h3 className="font-bold">{t('webQuote')}</h3>
                    {selected.webQuote.amountVnd !== null ? (
                      <p className="mt-1 text-xl font-bold">{formatVND(selected.webQuote.amountVnd, locale)}</p>
                    ) : (
                      <p className="mu-note">{t('webQuoteManual')}</p>
                    )}
                    <p className="mu-note">{t('webQuoteNote')}</p>
                  </div>
                )}
                {admin &&
                  !selected.disbursedAt &&
                  ['submitted', 'quoted', 'accepted', 'contract_confirmed', 'in_custody'].includes(selected.status) && (
                    <form aria-label={t('quote')} className="space-y-4" onSubmit={(event) => submit(event, 'quote')}>
                      <h3 className="font-bold">{t('quote')}</h3>
                      <label className="mu-field">
                        {t('appraisal')}
                        <input
                          name="appraisalVnd"
                          type="number"
                          min="1"
                          step="1"
                          required
                          defaultValue={terms?.appraisalVnd ?? selected.webQuote?.referencePriceVnd ?? undefined}
                        />
                      </label>
                      <label className="mu-field">
                        {t('principal')}
                        <input
                          name="principalVnd"
                          type="number"
                          min="1"
                          step="1"
                          required
                          defaultValue={terms?.principalVnd ?? selected.webQuote?.amountVnd ?? undefined}
                        />
                      </label>
                      <label className="mu-field">
                        {t('termDays')}
                        <input
                          name="termDays"
                          type="number"
                          min="1"
                          max="365"
                          step="1"
                          required
                          defaultValue={terms?.termDays}
                        />
                      </label>
                      <label className="mu-field">
                        {t('details')}
                        <textarea name="details" maxLength={5000} required defaultValue={terms?.contractText} />
                      </label>
                      <label className="mu-field">
                        {t('disposalChoice')}
                        <select name="disposalAfterGrace" required defaultValue="">
                          <option value="" disabled>
                            {common('select')}
                          </option>
                          <option value="yes">{t('disposalAgreed')}</option>
                          <option value="no">{t('disposalNotAgreed')}</option>
                        </select>
                      </label>
                      <p className="mu-note">{t('quoteNote')}</p>
                      {button('quote')}
                    </form>
                  )}
                {admin && selected.status === 'accepted' && !!selected.contractEvidenceIds.length && (
                  <form
                    aria-label={t('confirmContract')}
                    className="space-y-4"
                    onSubmit={(event) => submit(event, 'confirm_contract')}
                  >
                    <label className="mu-field">
                      {t('contractReference')}
                      <input name="contractReference" maxLength={255} required />
                    </label>
                    <label className="flex items-start gap-3 text-sm">
                      <input name="bilateralSignatureVerified" type="checkbox" required />
                      {t('signatureVerified')}
                    </label>
                    {button('confirmContract')}
                  </form>
                )}
                {admin && selected.status === 'contract_confirmed' && (
                  <form
                    aria-label={t('receiveAsset')}
                    className="space-y-4"
                    onSubmit={(event) => submit(event, 'receive_asset')}
                  >
                    <label className="mu-field">
                      {t('custodyReference')}
                      <input name="custodyReference" maxLength={255} required />
                    </label>
                    {detailsField}
                    {verifyHandover}
                    <label className="flex items-start gap-3 text-sm">
                      <input name="conditionMatchesAgreement" type="checkbox" required />
                      {t('conditionMatches')}
                    </label>
                    {button('receiveAsset')}
                  </form>
                )}
                {admin &&
                  terms?.policy.legalMode === 'approved' &&
                  terms &&
                  (selected.status === 'in_custody' ||
                    (['active', 'DUE_GRACE', 'OVERDUE_REVIEW', 'repaid'].includes(selected.status) &&
                      selected.estimate.remainingVnd > 0)) && (
                    <form
                      aria-label={t(selected.status === 'in_custody' ? 'disbursement' : 'redemption')}
                      className="space-y-4"
                      key={`${selected.id}:${selected.version}:${selected.estimate.remainingVnd}`}
                      onSubmit={(event) =>
                        submit(
                          event,
                          selected.status === 'in_custody' ? 'disbursement' : 'redemption',
                          selected.status === 'in_custody' ? 'disbursement' : 'redemption',
                        )
                      }
                    >
                      <h3 className="font-bold">
                        {t(selected.status === 'in_custody' ? 'disbursement' : 'redemption')}
                      </h3>
                      <label className="mu-field">
                        {t('amount')}
                        <input
                          name="amountVnd"
                          type="number"
                          min="1"
                          step="1"
                          required
                          defaultValue={
                            selected.status === 'in_custody' ? terms.principalVnd : selected.estimate.remainingVnd
                          }
                        />
                      </label>
                      <label className="mu-field">
                        {t('paymentReference')}
                        <input name="externalReference" minLength={8} maxLength={128} required />
                      </label>
                      {detailsField}
                      <label className="flex items-start gap-3 text-sm">
                        <input name="moneyVerified" type="checkbox" required />
                        {t('moneyVerified')}
                      </label>
                      {button(selected.status === 'in_custody' ? 'disbursement' : 'redemption')}
                    </form>
                  )}
                {admin &&
                  ['active', 'DUE_GRACE', 'OVERDUE_REVIEW'].includes(selected.status) &&
                  selected.extensionRequest && (
                    <form
                      aria-label={t('extensionDecision')}
                      className="space-y-4"
                      onSubmit={(event) => submit(event, 'extension_decision')}
                    >
                      <label className="mu-field">
                        {t('extensionDecision')}
                        <select name="accepted" required defaultValue="">
                          <option value="" disabled>
                            {common('select')}
                          </option>
                          <option value="yes" disabled={selected.status === 'OVERDUE_REVIEW'}>
                            {t('approveExtension')}
                          </option>
                          <option value="no">{t('rejectExtension')}</option>
                        </select>
                      </label>
                      {detailsField}
                      {button('extensionDecision')}
                    </form>
                  )}
                {admin &&
                  (selected.status === 'repaid' ||
                    (!!selected.custodyAt &&
                      !selected.disbursedAt &&
                      ['quoted', 'accepted', 'contract_confirmed', 'in_custody'].includes(selected.status))) && (
                    <form
                      aria-label={t('handback')}
                      className="space-y-4"
                      onSubmit={(event) => submit(event, 'handback')}
                    >
                      {detailsField}
                      {verifyHandover}
                      <p className="mu-note">{t('handbackNote')}</p>
                      {button('handback')}
                    </form>
                  )}
                {admin && selected.status === 'OVERDUE_REVIEW' && selected.overdue && terms?.disposalAfterGrace && (
                  <form aria-label={t('dispose')} className="space-y-4" onSubmit={(event) => submit(event, 'dispose')}>
                    <h3 className="font-bold">{t('dispose')}</h3>
                    <label className="mu-field">
                      {t('disposalReference')}
                      <input name="disposalReference" maxLength={255} required />
                    </label>
                    {detailsField}
                    <label className="flex items-start gap-3 text-sm">
                      <input name="contractEligibilityVerified" type="checkbox" required />
                      {t('eligibilityVerified')}
                    </label>
                    <label className="flex items-start gap-3 text-sm">
                      <input name="authorized" type="checkbox" required />
                      {t('disposalAuthorized')}
                    </label>
                    <p className="mu-note">{t('capNote')}</p>
                    {button('dispose')}
                  </form>
                )}
                {admin && selected.status === 'disposed' && !selected.productId && (
                  <form
                    aria-label={assetLabels('intake')}
                    className="space-y-4"
                    onSubmit={(event) => submit(event, 'intake', 'intake')}
                  >
                    <h3 className="font-bold">{assetLabels('intake')}</h3>
                    <p className="mu-note">{assetLabels('intakeNote')}</p>
                    <Link className="inline-block underline" href="/admin/products/new">
                      {assetLabels('createDraft')}
                    </Link>
                    <ProductPicker value={product} onChange={setProduct} excludeIds={[]} />
                    {detailsField}
                    <label className="flex items-start gap-3 text-sm">
                      <input name="actualPhotosVerified" type="checkbox" required />
                      {assetLabels('actualPhotosVerified')}
                    </label>
                    <button className="mu-button" disabled={busy || !product}>
                      {assetLabels('intake')}
                    </button>
                  </form>
                )}
                {selected.status === 'disposed' && (
                  <PawnDisposalPanel
                    key={`${selected.id}:${selected.version}`}
                    row={selected}
                    admin={admin}
                    onUpdated={(row) => {
                      setSelected(row);
                      void load();
                    }}
                  />
                )}
                {admin && selected.status === 'disposed' && selected.productId && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void post('publish', { actualPhotosVerified: true });
                    }}
                    className="space-y-3"
                  >
                    <label className="flex items-start gap-3">
                      <input type="checkbox" required />
                      {locale === 'en'
                        ? 'I verified the received combination and its actual photos.'
                        : 'Đã kiểm tra tổ hợp nhập kho và ảnh thật.'}
                    </label>
                    <button className="mu-button" disabled={busy}>
                      {locale === 'en' ? 'Publish received product' : 'Xuất bản sản phẩm đã nhập'}
                    </button>
                  </form>
                )}
                {selected.productId && (
                  <Link
                    className="mu-button"
                    href={admin ? `/admin/products/${selected.productId}` : `/shop/product/${selected.productId}`}
                  >
                    {assetLabels('listedModel')}
                  </Link>
                )}
                {!!selected.payments.length && (
                  <div>
                    <h3 className="font-bold">{t('payments')}</h3>
                    <ol className="mt-3 space-y-3">
                      {selected.payments.map((payment) => (
                        <li className="mu-note" key={payment.id}>
                          {t.has(payment.kind)
                            ? t(payment.kind)
                            : payment.kind === 'extension_credit'
                              ? 'Credit gia hạn đã nhận'
                              : 'Hoàn credit dư'}{' '}
                          · {formatVND(payment.amountVnd, locale)} ·{' '}
                          {new Date(payment.createdAt).toLocaleString(locale)}
                          <p className="break-all">{payment.externalReference}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-5">
                  <h3 className="font-bold">{assetLabels('history')}</h3>
                  <ol className="mt-3 space-y-3">
                    {selected.events.map((event) => {
                      const historicalTerms = (event.details.terms || event.details.acceptedTerms) as
                        PawnTerms | undefined;
                      const notes = [event.details.reason, event.details.inspection].filter(
                        (value): value is string => typeof value === 'string',
                      );
                      const references = [
                        event.details.contractReference,
                        event.details.custodyReference,
                        event.details.externalReference,
                        event.details.disposalReference,
                      ].filter((value): value is string => typeof value === 'string');
                      return (
                        <li className="mu-note" key={event.id}>
                          <span className="font-semibold">
                            {t.has('events.' + event.action) ? t('events.' + event.action) : event.action}
                          </span>{' '}
                          · {new Date(event.createdAt).toLocaleString(locale)} ·{' '}
                          {assetLabels('version', { version: Number(event.details.version) })}
                          {Boolean(
                            historicalTerms || notes.length > 0 || references.length > 0 || event.details.oldDueAt,
                          ) && (
                            <details className="mt-2">
                              <summary className="cursor-pointer underline">{t('historyDetails')}</summary>
                              <div className="mt-2 space-y-2">
                                {historicalTerms && (
                                  <>
                                    <p>
                                      {t('principal')}: {formatVND(historicalTerms.principalVnd, locale)} ·{' '}
                                      {t('dailyRate')}: {historicalTerms.policy.dailyRateBasisPoints / 100}% ·{' '}
                                      {t('termDays')}: {historicalTerms.termDays}
                                    </p>
                                    <p>
                                      {policyLabels('values.' + historicalTerms.policy.dayCount)} ·{' '}
                                      {policyLabels('values.' + historicalTerms.policy.rounding)} ·{' '}
                                      {policyLabels('values.' + historicalTerms.policy.interestStopEvent)}
                                    </p>
                                    <p className="whitespace-pre-line">{historicalTerms.contractText}</p>
                                    <p>
                                      {t(historicalTerms.disposalAfterGrace ? 'disposalAgreed' : 'disposalNotAgreed')}
                                    </p>
                                  </>
                                )}
                                {typeof event.details.amountVnd === 'number' && (
                                  <p>{formatVND(event.details.amountVnd, locale)}</p>
                                )}
                                {notes.map((note, index) => (
                                  <p className="whitespace-pre-line" key={index}>
                                    {note}
                                  </p>
                                ))}
                                {references.map((reference, index) => (
                                  <p className="break-all" key={index}>
                                    {reference}
                                  </p>
                                ))}
                                {typeof event.details.oldDueAt === 'string' &&
                                  typeof event.details.newDueAt === 'string' && (
                                    <p>
                                      {new Date(event.details.oldDueAt).toLocaleString(locale)} →{' '}
                                      {new Date(event.details.newDueAt).toLocaleString(locale)}
                                    </p>
                                  )}
                              </div>
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
