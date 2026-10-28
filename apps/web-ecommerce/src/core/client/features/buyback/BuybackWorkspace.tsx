'use client';

import { ServiceHeader, ServiceTerms, ServiceEmpty } from '@/components/Services/ServiceExperience';
import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import Api from '@/core/client/api/Api';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import { COLLECTIBLE_ASSET_FIELDS as ASSET_FIELDS } from './ConditionFields';
import ServiceBasket from './ServiceBasket';
import { useSearchParams } from 'next/navigation';
import ServiceConditionCasePanel from './ServiceConditionCasePanel';
import BuybackPricingSections from './BuybackPricingSections';
import { formatVND } from '@/shared/server/utils/utils';
import type { BuybackRequest } from '@/shared/types/buyback';
import { ListingSteps, TradeQuotePanel } from './BuybackListingSections';
import ServiceStatusBadge from '@/components/Services/ServiceStatusBadge';
import ServiceMediaGallery from '@/components/Services/ServiceMediaGallery';
import ServiceTimeline from '@/components/Services/ServiceTimeline';
import ServiceHistoryToolbar, { type ServiceFilterTab } from '@/components/Services/ServiceHistoryToolbar';
import AdminIcon from '@/components/Admin/AdminIcon';

// The buyback page (`sell`) and the trade page (`trade`) share the buyback request; a customer sees on each page only
// its own requests (a trade request carries the shop item), an admin sees them all.
export default function BuybackWorkspace({
  admin = false,
  mode = 'sell',
}: {
  admin?: boolean;
  mode?: 'sell' | 'trade';
}) {
  const t = useTranslations('buyback'),
    common = useTranslations('common'),
    catalog = useTranslations('catalog'),
    v2 = useTranslations('buybackV2'),
    locale = useLocale();
  const { user } = useCurrentUser();
  const [rows, setRows] = useState<BuybackRequest[]>([]),
    [selected, setSelected] = useState<BuybackRequest | null>(null);
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<ServiceFilterTab>('all');
  const root = admin ? '/admin/buyback' : '/buyback';
  const chosenModel = Number(useSearchParams().get('mau')) || null;
  const [activeViewTab, setActiveViewTab] = useState<'requests' | 'new_request'>(
    chosenModel ? 'new_request' : 'requests',
  );
  const [detailTab, setDetailTab] = useState<'inspection' | 'media' | 'actions'>('inspection');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const all: BuybackRequest[] = (await Api.get(root)).data;
      setRows(admin ? all : all.filter((row) => (row.tradeProductId !== null) === (mode === 'trade')));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [admin, mode, root, user]);

  useEffect(() => {
    setRows([]);
    setSelected(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (selected?.id && matchMedia('(max-width: 1023px)').matches)
      document.getElementById('buyback-detail')?.scrollIntoView({ block: 'start' });
  }, [selected?.id]);

  const open = async (id: number) => {
    setBusy(true);
    try {
      setSelected((await Api.get(`${root}/${id}`)).data);
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
      await load();
    } catch {
      await open(selected.id);
    } finally {
      setBusy(false);
    }
  };

  const submitAction = (event: React.FormEvent<HTMLFormElement>, action: string, endpoint = 'actions') => {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      data: Record<string, unknown> = { ...Object.fromEntries(form), action };
    if (form.has('amountVnd')) data.amountVnd = Number(form.get('amountVnd'));
    for (const key of ['moneyVerified', 'handoverVerified']) if (form.has(key)) data[key] = true;
    if (action === 'send_item') data.inboundCod = false;
    void post(endpoint, data);
  };

  const detailsField = (
    <label className="mu-field">
      {t('details')}
      <textarea name="details" required maxLength={1500} />
    </label>
  );

  const referenceField = (
    <label className="mu-field">
      {t('tracking')}
      <input name="inboundReference" maxLength={255} required />
    </label>
  );

  const verifyHandover = (
    <label className="flex items-start gap-3 text-sm">
      <input name="handoverVerified" type="checkbox" required />
      {t('handoverVerified')}
    </label>
  );

  const button = (name: string) => (
    <button className="mu-button" disabled={busy}>
      {t(name)}
    </button>
  );

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: rows.length,
      active: rows.filter((r) =>
        ['submitted', 'need_more_evidence', 'awaiting_item', 'inspecting', 'reinspection_requested'].includes(r.status),
      ).length,
      action_needed: rows.filter((r) =>
        ['quoted', 'awaiting_acceptance', 'returning'].includes(r.status),
      ).length,
      completed: rows.filter((r) =>
        ['completed', 'awaiting_payout'].includes(r.status),
      ).length,
      closed: rows.filter((r) => r.status === 'cancelled').length,
    };
  }, [rows]);

  // Filtered rows by search and tab
  const filteredRows = useMemo(() => {
    let list = rows;
    if (selectedTab === 'active') {
      list = list.filter((r) =>
        ['submitted', 'need_more_evidence', 'awaiting_item', 'inspecting', 'reinspection_requested'].includes(r.status),
      );
    } else if (selectedTab === 'action_needed') {
      list = list.filter((r) =>
        ['quoted', 'awaiting_acceptance', 'returning'].includes(r.status),
      );
    } else if (selectedTab === 'completed') {
      list = list.filter((r) =>
        ['completed', 'awaiting_payout'].includes(r.status),
      );
    } else if (selectedTab === 'closed') {
      list = list.filter((r) => r.status === 'cancelled');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((r) => {
        const idStr = `tm${r.id}`.toLowerCase();
        const rawId = String(r.id);
        const name = (r.asset?.name || '').toLowerCase();
        const code = (r.asset?.modelCode || '').toLowerCase();
        const ver = (r.asset?.version || '').toLowerCase();
        return (
          idStr.includes(q) ||
          rawId.includes(q) ||
          name.includes(q) ||
          code.includes(q) ||
          ver.includes(q)
        );
      });
    }
    return list;
  }, [rows, selectedTab, searchQuery]);

  // Compact pagination (6 items per page) to prevent giant vertical scrolling
  const PAGE_SIZE = 6;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTab]);

  useEffect(() => {
    if (selected?.id && filteredRows.length > 0) {
      const idx = filteredRows.findIndex((r) => r.id === selected.id);
      if (idx !== -1) {
        const page = Math.floor(idx / PAGE_SIZE) + 1;
        setCurrentPage((prev) => (prev !== page ? page : prev));
      }
    }
  }, [selected?.id, filteredRows]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  return (
    <section className={`service-workspace ${admin ? 'py-6' : 'mu-wrap py-12'}`}>
      <ServiceHeader
        service={admin ? 'sell' : mode}
        admin={admin}
        title={t(admin ? 'adminTitle' : mode === 'trade' ? 'tradeTitle' : 'title')}
      />

      {!user ? (
        <div className="my-8 text-center">
          <Link className="mu-button" href={`/auth/signin?redirect=/services/${mode}`}>
            {t('signIn')}
          </Link>
        </div>
      ) : (
        <>
          {failed && (
            <button className="mu-button mb-5" onClick={() => void load()}>
              {common('retry')}
            </button>
          )}

          {/* User Service Navigation Tabs to eliminate vertical scrolling */}
          {!admin && (
            <div className="my-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-strokedark">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-meta-4">
                <button
                  type="button"
                  onClick={() => setActiveViewTab('requests')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                    activeViewTab === 'requests'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-boxdark dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <span>📋 Yêu cầu của bạn</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      activeViewTab === 'requests'
                        ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {rows.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveViewTab('new_request')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                    activeViewTab === 'new_request'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-boxdark dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <span>➕ {mode === 'trade' ? 'Tạo yêu cầu Trade' : 'Gửi yêu cầu Thu mua'}</span>
                </button>
              </div>

              {activeViewTab === 'requests' ? (
                <button
                  type="button"
                  onClick={() => setActiveViewTab('new_request')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition-colors"
                >
                  <span>+ Gửi yêu cầu mới</span>
                </button>
              ) : rows.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveViewTab('requests')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400"
                >
                  <span>← Xem lại yêu cầu đã gửi ({rows.length})</span>
                </button>
              ) : null}
            </div>
          )}

          {/* View Tab 1: New Request Intake Form & Guidelines */}
          {!admin && activeViewTab === 'new_request' && (
            <div className="space-y-6">
              <ol className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t('process')}>
                {['submit', 'inspect', 'agree', 'getPaid'].map((step, index) => (
                  <li className="mu-panel p-4 rounded-xl border border-slate-200/80 shadow-2xs dark:border-strokedark" key={step}>
                    <span className="mu-eyebrow">0{index + 1}</span>
                    <p className="mt-2 font-bold text-slate-900 dark:text-white">{t(`steps.${step}`)}</p>
                  </li>
                ))}
              </ol>

              <ServiceTerms>
                <p>{t('intro')}</p>
                <p className="font-semibold">{t('ownershipNote')}</p>
                <p>{t('codNote')}</p>
              </ServiceTerms>

              <ServiceBasket
                key={user.id}
                kind={mode}
                initialProductId={chosenModel}
                onSent={async () => {
                  await load();
                  setActiveViewTab('requests');
                }}
              />
            </div>
          )}

          {/* View Tab 2: Existing Requests Workspace (or Admin Mode) */}
          {(admin || activeViewTab === 'requests') && (
            <>
              {!failed && !rows.length && (
                <div className="my-8 rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center dark:border-strokedark dark:bg-boxdark">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-meta-4">
                    <AdminIcon name="box" size={24} />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    {t(mode === 'trade' && !admin ? 'tradeEmpty' : 'empty')}
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                    Bạn chưa có bản ghi nào trong hệ thống. Hãy gửi yêu cầu đầu tiên để shop định giá ngay.
                  </p>
                  {!admin && (
                    <button
                      type="button"
                      onClick={() => setActiveViewTab('new_request')}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700"
                    >
                      <span>+ Gửi yêu cầu ngay</span>
                    </button>
                  )}
                </div>
              )}

              {rows.length > 0 && (
                <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(330px,380px)_minmax(0,1fr)]">
                  {/* Left Column: History & Search Toolbar + Requests List */}
                  <div className="space-y-3 lg:sticky lg:top-24">
                    <ServiceHistoryToolbar
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      selectedTab={selectedTab}
                      onSelectTab={setSelectedTab}
                      counts={counts}
                    />

                    {filteredRows.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-strokedark dark:bg-boxdark dark:text-slate-400">
                        <div className="flex justify-center text-slate-300 dark:text-slate-600 mb-2">
                          <AdminIcon name="search" size={28} />
                        </div>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">Không tìm thấy yêu cầu nào</p>
                        <p className="mt-1 text-slate-400">Thử tìm kiếm bằng từ khóa hoặc bộ lọc khác.</p>
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="mt-3 inline-block rounded-md bg-slate-100 px-3 py-1 font-semibold text-purple-600 hover:bg-slate-200 dark:bg-meta-4 dark:text-purple-300"
                          >
                            Xóa bộ lọc tìm kiếm
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Summary & Page Info */}
                        <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-400">
                          <span>
                            Hiển thị {(currentPage - 1) * PAGE_SIZE + 1} -{' '}
                            {Math.min(currentPage * PAGE_SIZE, filteredRows.length)} / {filteredRows.length} yêu cầu
                          </span>
                          {totalPages > 1 && (
                            <span>
                              Trang {currentPage}/{totalPages}
                            </span>
                          )}
                        </div>

                        {/* Compact Card List */}
                        <div className="space-y-2">
                          {paginatedRows.map((row) => {
                            const isSelected = selected?.id === row.id;
                            const offer = row.finalOffer || row.preliminaryOffer;

                            return (
                              <button
                                key={row.id}
                                disabled={busy}
                                aria-pressed={isSelected}
                                onClick={() => void open(row.id)}
                                className={`group relative w-full text-left rounded-xl p-2.5 sm:p-3 transition-all duration-150 border ${
                                  isSelected
                                    ? 'border-2 border-purple-600 bg-purple-50/50 shadow-xs ring-2 ring-purple-600/15 dark:bg-purple-950/30 dark:border-purple-500'
                                    : 'border-slate-200/80 bg-white hover:border-purple-300 hover:shadow-2xs hover:bg-slate-50/50 dark:border-strokedark dark:bg-boxdark dark:hover:border-slate-500'
                                }`}
                              >
                                {/* Left active highlight bar */}
                                {isSelected && (
                                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-purple-600 dark:bg-purple-400" />
                                )}

                                {/* Top row: TM badge + Mode Tag + Status badge */}
                                <div className="flex items-center justify-between gap-1.5 pl-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-mono text-[11px] font-black tracking-wide text-purple-900 bg-purple-100 dark:bg-purple-950 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200/80 dark:border-purple-800">
                                      TM{row.id}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded dark:bg-meta-4 dark:text-slate-300">
                                      {row.tradeProductId !== null ? 'Trade' : 'Thu mua'}
                                    </span>
                                  </div>
                                  <ServiceStatusBadge status={row.status} label={t(`status.${row.status}`)} size="sm" />
                                </div>

                                {/* Middle Row: Model Name (single line truncated) */}
                                <h4 className="mt-1.5 pl-1 text-xs sm:text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors truncate dark:text-white">
                                  {row.asset.name}
                                </h4>

                                {/* Bottom Row: Date / Model Code + Price */}
                                <div className="mt-1.5 pl-1 flex items-center justify-between text-[11px] text-slate-400">
                                  <span className="truncate max-w-[170px]">
                                    {row.asset.modelCode ? `${row.asset.modelCode} · ` : ''}{new Date(row.createdAt).toLocaleDateString(locale)}
                                  </span>
                                  {offer ? (
                                    <div className="flex items-baseline gap-1 shrink-0 ml-2">
                                      <span className="text-[9px] font-medium text-slate-400">
                                        {row.finalOffer ? 'Chốt:' : 'Báo:'}
                                      </span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                                        {formatVND(offer.amountVnd, locale)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="italic text-[10px] text-slate-400 shrink-0">Chờ định giá</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
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
                      </>
                    )}
                  </div>

              {/* Right Column: Detail Panel */}
              {selected ? (
                <div
                  id="buyback-detail"
                  className="order-first min-w-0 scroll-mt-24 space-y-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-7 lg:order-none dark:border-strokedark dark:bg-boxdark"
                >
                  {/* Detail Header */}
                  <div className="border-b border-slate-100 pb-5 dark:border-strokedark">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 dark:bg-meta-4 dark:text-slate-200 px-2.5 py-1 rounded-md">
                          TM{selected.id}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-meta-4 dark:text-slate-300">
                          {selected.tradeProductId !== null ? 'Dịch vụ Trade' : 'Dịch vụ Thu mua'}
                        </span>
                        <ServiceStatusBadge status={selected.status} label={t(`status.${selected.status}`)} size="md" />
                      </div>
                      <span className="text-xs text-slate-400">
                        Khởi tạo: {new Date(selected.createdAt).toLocaleString(locale)}
                      </span>
                    </div>

                    <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                      {selected.asset.name}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Mã sản phẩm:{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {selected.asset.modelCode}
                      </span>{' '}
                      · Phiên bản:{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {selected.asset.version}
                      </span>{' '}
                      (v{selected.version})
                    </p>
                  </div>

                  {/* Glanceable Value & Status Banner */}
                  {(() => {
                    const offer = selected.finalOffer || selected.preliminaryOffer;
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-4 text-white shadow-xs">
                        <div>
                          <span className="text-[10px] font-semibold tracking-wider text-purple-200 uppercase">
                            {selected.finalOffer
                              ? 'Giá chốt giao dịch'
                              : selected.preliminaryOffer
                              ? 'Báo giá sơ bộ'
                              : 'Trạng thái xử lý'}
                          </span>
                          <div className="mt-0.5 flex items-baseline gap-2">
                            {offer ? (
                              <span className="font-mono text-2xl font-black text-emerald-400">
                                {formatVND(offer.amountVnd, locale)}
                              </span>
                            ) : (
                              <span className="text-base font-bold text-slate-200">
                                {t(`status.${selected.status}`)}
                              </span>
                            )}
                            {selected.tradeProductId !== null && (
                              <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                Trade đổi hàng
                              </span>
                            )}
                          </div>
                        </div>

                        {selected.inboundReference && (
                          <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs backdrop-blur-xs">
                            <AdminIcon name="truck" size={16} />
                            <div>
                              <span className="text-[9px] text-purple-200 block leading-tight">Vận đơn gửi shop</span>
                              <span className="font-mono font-bold">{selected.inboundReference}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Visual Process Stepper & Activity Timeline */}
                  <ServiceTimeline
                    status={selected.status}
                    events={selected.events}
                    mode={selected.tradeProductId !== null ? 'trade' : 'buyback'}
                  />

                  {/* Inner Detail Navigation Tabs */}
                  {(() => {
                    const totalMedia =
                      (selected.evidence?.length || 0) + (selected.inspectionEvidence?.length || 0);
                    const needsAction = ['quoted', 'awaiting_acceptance', 'need_more_evidence'].includes(
                      selected.status,
                    );

                    return (
                      <div className="flex border-b border-slate-200 dark:border-strokedark text-xs">
                        <button
                          type="button"
                          onClick={() => setDetailTab('inspection')}
                          className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-bold transition-all ${
                            detailTab === 'inspection'
                              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-300'
                              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                          }`}
                        >
                          <span>🔍 Thẩm định & Tình trạng</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDetailTab('media')}
                          className={`flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-bold transition-all ${
                            detailTab === 'media'
                              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-300'
                              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                          }`}
                        >
                          <span>📸 Ảnh & Video</span>
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600 dark:bg-meta-4 dark:text-slate-300">
                            {totalMedia}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDetailTab('actions')}
                          className={`relative flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 font-bold transition-all ${
                            detailTab === 'actions'
                              ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-300'
                              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                          }`}
                        >
                          <span>⚡ Thao tác & Quyết định</span>
                          {needsAction && (
                            <span className="flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
                          )}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Detail Tab 1: Inspection & Condition */}
                  {detailTab === 'inspection' && (
                    <div className="space-y-4 pt-1">
                      {/* Pricing Comparison Matrix & Estimate Card */}
                      <BuybackPricingSections
                        key={`${selected.id}:${selected.version}`}
                        selected={selected}
                        admin={admin}
                        busy={busy}
                        post={post}
                      />

                      {/* Condition Case Panel */}
                      <ServiceConditionCasePanel
                        kind="buyback"
                        reviewNote={selected.conditionCaseReviewNote}
                        key={selected.id}
                        snapshot={selected.conditionCase}
                        status={selected.conditionCaseStatus}
                        admin={admin}
                        editable={[
                          'submitted',
                          'need_more_evidence',
                          'quoted',
                          'awaiting_item',
                          'inspecting',
                          'reinspection_requested',
                        ].includes(selected.status)}
                        busy={busy}
                        post={post}
                      />

                      {/* Asset Condition Specifications */}
                      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 dark:border-strokedark dark:bg-meta-4/20">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 dark:text-slate-400">
                          Thông số khai báo ban đầu
                        </h3>
                        <dl className="grid gap-2.5 sm:grid-cols-2">
                          {ASSET_FIELDS.filter((key) => key !== 'name').map((key) => (
                            <div
                              key={key}
                              className="rounded-xl bg-white p-2.5 border border-slate-100 dark:bg-boxdark dark:border-strokedark"
                            >
                              <dt className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                {t(`asset.${key}`)}
                              </dt>
                              <dd className="mt-0.5 text-xs font-medium text-slate-800 break-words whitespace-pre-line dark:text-slate-200">
                                {key === 'assemblyState' ? catalog(selected.asset[key]) : selected.asset[key]}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>

                      {/* Inspection Summary from Shop */}
                      {selected.inspection && (
                        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 dark:border-strokedark dark:bg-meta-4/20">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 dark:text-slate-400">
                            {t('inspection')}
                          </h3>
                          <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed dark:text-slate-300">
                            {selected.inspection}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detail Tab 2: Photos & Videos Media Galleries */}
                  {detailTab === 'media' && (
                    <div className="space-y-4 pt-1">
                      {/* Customer Photos & Video Gallery */}
                      <ServiceMediaGallery
                        files={selected.evidence || []}
                        title="Ảnh & Video thực tế do khách hàng cung cấp"
                        subtitle="Chụp các góc, chi tiết mô hình, phụ kiện và tình trạng hộp"
                        badge="Khách cung cấp"
                        emptyMessage="Chưa có hình ảnh bằng chứng nào được tải lên."
                      />

                      {/* Shop Inspection Video & Photos Gallery */}
                      {selected.inspectionEvidence && selected.inspectionEvidence.length > 0 ? (
                        <ServiceMediaGallery
                          files={selected.inspectionEvidence}
                          title="Video & Ảnh mở kiện, kiểm hàng của shop"
                          subtitle="Biên bản unboxing, kiểm tra chi tiết và đối chiếu từ kỹ thuật viên"
                          badge="Biên bản shop"
                          emptyMessage="Shop chưa tải lên ảnh/video kiểm tra."
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400 dark:border-strokedark dark:bg-meta-4/10">
                          Shop sẽ tải lên video mở hộp và ảnh kiểm tra thực tế sau khi nhận được hàng.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detail Tab 3: Action Forms & Decisions */}
                  {detailTab === 'actions' && (
                    <div className="space-y-4 pt-1">
                      {/* Preliminary / Final Offers Details */}
                      {(['preliminaryOffer', 'finalOffer'] as const).map(
                        (key) =>
                          selected[key] && (
                            <div
                              key={key}
                              className={`rounded-xl border p-4 shadow-2xs ${
                                key === 'finalOffer'
                                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20'
                                  : 'border-sky-200 bg-sky-50/50 dark:border-sky-800/40 dark:bg-sky-950/20'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                  {t(key)}
                                </h3>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    key === 'finalOffer'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                                      : 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300'
                                  }`}
                                >
                                  {key === 'finalOffer' ? 'Giá chốt' : 'Giá sơ bộ'}
                                </span>
                              </div>
                              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                                {formatVND(selected[key]!.amountVnd, locale)}
                              </p>
                              <p className="mt-1 text-xs text-slate-600 whitespace-pre-line dark:text-slate-300">
                                {selected[key]!.details}
                              </p>
                              <p className="mt-2 text-[11px] text-slate-400">
                                {t(key === 'preliminaryOffer' ? 'preliminaryNote' : 'finalNote')}
                              </p>
                            </div>
                          ),
                      )}

                      <TradeQuotePanel selected={selected} admin={admin} busy={busy} post={post} />

                      {/* Payout Details */}
                      {selected.payout && (
                        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-800/40 dark:bg-teal-950/30">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                            {t(selected.payout.direction === 'customer_pays' ? 'paidByCustomer' : 'paid')}
                          </h3>
                          <p className="mt-2 text-2xl font-black text-teal-900 dark:text-white">
                            {formatVND(selected.payout.amountVnd, locale)}
                          </p>
                          <p className="mt-1 font-mono text-xs text-teal-700 break-all dark:text-teal-400">
                            Mã giao dịch: {selected.payout.externalReference} · {new Date(selected.payout.createdAt).toLocaleString(locale)}
                          </p>
                        </div>
                      )}

                      {/* Return Terms */}
                      {selected.returnTerms && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-800/40 dark:bg-rose-950/30">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                            {t('returnTerms')}
                          </h3>
                          <p className="mt-2 text-xs text-rose-900 leading-relaxed dark:text-rose-200">
                            {selected.returnTerms.details}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
                            {t(selected.returnTerms.accepted ? 'returnAccepted' : 'returnPending')}
                          </p>
                          {selected.returnTerms.tracking && (
                            <p className="mt-1 font-mono text-xs text-rose-600 dark:text-rose-400">
                              Vận đơn: {selected.returnTerms.tracking}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action Forms */}
                      {!admin && selected.status === 'quoted' && (
                        <form className="space-y-4 rounded-xl border border-slate-200 p-4" onSubmit={(event) => submitAction(event, 'send_item')}>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Gửi hiện vật về shop
                          </h3>
                          {referenceField}
                          <p className="mu-note">{t('codNote')}</p>
                          {button('sendItem')}
                        </form>
                      )}

                      {!admin && ['awaiting_acceptance', 'reinspection_requested'].includes(selected.status) && (
                        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Quyết định giá cuối
                          </h3>
                          <p className="mu-note">{t('acceptNote')}</p>
                          {selected.status === 'awaiting_acceptance' && (
                            <button
                              className="mu-button"
                              disabled={busy}
                              onClick={() => void post('actions', { action: 'accept' })}
                            >
                              {t('accept')}
                            </button>
                          )}
                          <form className="space-y-3" onSubmit={(event) => submitAction(event, 'reject')}>
                            {detailsField}
                            {button('reject')}
                          </form>
                        </div>
                      )}

                      {!admin &&
                        ['submitted', 'need_more_evidence', 'quoted', 'awaiting_item', 'inspecting'].includes(
                          selected.status,
                        ) && (
                          <form
                            className="space-y-4 border-t border-slate-200 pt-4"
                            onSubmit={(event) => submitAction(event, 'cancel')}
                          >
                            {detailsField}
                            {button('cancelRequest')}
                          </form>
                        )}

                      {!admin &&
                        selected.status === 'returning' &&
                        selected.returnTerms &&
                        !selected.returnTerms.accepted && (
                          <button
                            className="mu-button"
                            disabled={busy}
                            onClick={() => void post('actions', { action: 'accept_return' })}
                          >
                            {t('acceptReturn')}
                          </button>
                        )}

                      {admin && selected.status === 'awaiting_item' && (
                        <form className="space-y-4" onSubmit={(event) => submitAction(event, 'received')}>
                          {detailsField}
                          {verifyHandover}
                          {button('inspect')}
                        </form>
                      )}

                      {admin && selected.status === 'awaiting_payout' && (
                        <form className="space-y-4" onSubmit={(event) => submitAction(event, 'payout', 'payout')}>
                          <p className="mu-note">{t(selected.tradeQuote ? 'tradeSettlementNote' : 'payoutNote')}</p>
                          <label className="mu-field">
                            {t('amount')}
                            <input
                              name="amountVnd"
                              type="number"
                              step="1"
                              min={selected.tradeQuote ? 0 : 1}
                              required
                              defaultValue={
                                selected.tradeQuote
                                  ? Math.abs(selected.tradeQuote.differenceVnd ?? 0)
                                  : selected.finalOffer?.amountVnd
                              }
                            />
                          </label>
                          <label className="mu-field">
                            {t('reference')}
                            <input name="externalReference" minLength={8} maxLength={128} required />
                          </label>
                          {detailsField}
                          <label className="flex items-start gap-3 text-sm">
                            <input name="moneyVerified" type="checkbox" required />
                            {t('moneyVerified')}
                          </label>
                          {button('pay')}
                        </form>
                      )}

                      {admin && selected.status === 'returning' && !selected.returnTerms?.accepted && (
                        <form className="space-y-4" onSubmit={(event) => submitAction(event, 'return_offer')}>
                          {detailsField}
                          <p className="mu-note">{t('returnNote')}</p>
                          {button('returnTerms')}
                        </form>
                      )}

                      {admin && selected.status === 'returning' && selected.returnTerms?.accepted && (
                        <form className="space-y-4" onSubmit={(event) => submitAction(event, 'return_dispatched')}>
                          {referenceField}
                          {verifyHandover}
                          {button('returnDispatch')}
                        </form>
                      )}

                      {admin && (
                        <ListingSteps
                          key={`${selected.id}:${selected.version}`}
                          selected={selected}
                          busy={busy}
                          post={post}
                        />
                      )}

                      {selected.productId && (
                        <Link
                          className="mu-button"
                          href={admin ? `/admin/products/${selected.productId}` : `/shop/product/${selected.productId}`}
                        >
                          {t('listedModel')}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden lg:flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center dark:border-strokedark dark:bg-meta-4/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-meta-4 dark:text-slate-500 mb-3">
                    <AdminIcon name="orders" size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Chọn một yêu cầu để xem chi tiết
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-xs">
                    Theo dõi đầy đủ tiến trình, ảnh kiểm hàng, thẩm định và lịch sử quyết định bên tay phải.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  )}
</section>
  );
}
