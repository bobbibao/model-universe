'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import Api from '@/core/client/api/Api';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import AdminIcon from '@/components/Admin/AdminIcon';
import ServiceStatusBadge from './ServiceStatusBadge';
import ServiceMediaGallery from './ServiceMediaGallery';
import ServiceTimeline from './ServiceTimeline';
import Modal from '@/components/Modal/Modal';
import { formatVND } from '@/shared/server/utils/utils';
import type { BuybackRequest } from '@/shared/types/buyback';
import type { PawnContract } from '@/shared/types/pawn';

type UnifiedServiceItem = {
  id: number;
  serviceType: 'sell' | 'trade' | 'pawn';
  status: string;
  assetName: string;
  modelCode: string;
  version: string;
  createdAt: string;
  offerAmountVnd: number | null;
  offerLabel: string | null;
  rawBuyback?: BuybackRequest;
  rawPawn?: PawnContract;
};

export default function ServiceHistoryHub() {
  const { user } = useCurrentUser();
  const locale = useLocale();
  const tBuyback = useTranslations('buyback');
  const tPawn = useTranslations('pawn');

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UnifiedServiceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'sell' | 'trade' | 'pawn'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'action_needed' | 'completed' | 'closed'>('all');
  const [previewItem, setPreviewItem] = useState<UnifiedServiceItem | null>(null);
  const [hubPage, setHubPage] = useState(1);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [buybackRes, pawnRes] = await Promise.allSettled([
        Api.get('/buyback'),
        Api.get('/pawn'),
      ]);

      const unified: UnifiedServiceItem[] = [];

      if (buybackRes.status === 'fulfilled' && Array.isArray(buybackRes.value.data)) {
        buybackRes.value.data.forEach((row: BuybackRequest) => {
          const isTrade = row.tradeProductId !== null;
          const offer = row.finalOffer || row.preliminaryOffer;
          unified.push({
            id: row.id,
            serviceType: isTrade ? 'trade' : 'sell',
            status: row.status,
            assetName: row.asset?.name || 'Mô hình',
            modelCode: row.asset?.modelCode || '',
            version: row.asset?.version || '',
            createdAt: row.createdAt,
            offerAmountVnd: offer?.amountVnd || (row.tradeQuote?.differenceVnd ?? null),
            offerLabel: row.finalOffer ? 'Giá chốt' : row.preliminaryOffer ? 'Báo giá sơ bộ' : row.tradeQuote ? 'Chênh lệch' : null,
            rawBuyback: row,
          });
        });
      }

      if (pawnRes.status === 'fulfilled' && Array.isArray(pawnRes.value.data)) {
        pawnRes.value.data.forEach((row: PawnContract) => {
          unified.push({
            id: row.id,
            serviceType: 'pawn',
            status: row.status,
            assetName: row.asset?.name || 'Mô hình cầm cố',
            modelCode: row.asset?.modelCode || '',
            version: row.asset?.version || '',
            createdAt: row.custodyAt || new Date().toISOString(),
            offerAmountVnd: row.terms?.principalVnd || null,
            offerLabel: row.terms?.principalVnd ? 'Hạn mức' : null,
            rawPawn: row,
          });
        });
      }

      // Sort newest first
      unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(unified);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Counts
  const counts = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((i) =>
        ['submitted', 'need_more_evidence', 'awaiting_item', 'inspecting', 'reinspection_requested', 'contract_confirmed', 'in_custody', 'active'].includes(i.status)
      ).length,
      actionNeeded: items.filter((i) =>
        ['quoted', 'awaiting_acceptance', 'returning', 'accepted', 'DUE_GRACE', 'OVERDUE_REVIEW'].includes(i.status)
      ).length,
      completed: items.filter((i) =>
        ['completed', 'awaiting_payout', 'repaid', 'returned'].includes(i.status)
      ).length,
    };
  }, [items]);

  // Filtered
  const filteredItems = useMemo(() => {
    let list = items;

    if (serviceFilter !== 'all') {
      list = list.filter((i) => i.serviceType === serviceFilter);
    }

    if (statusFilter === 'active') {
      list = list.filter((i) =>
        ['submitted', 'need_more_evidence', 'awaiting_item', 'inspecting', 'reinspection_requested', 'contract_confirmed', 'in_custody', 'active'].includes(i.status)
      );
    } else if (statusFilter === 'action_needed') {
      list = list.filter((i) =>
        ['quoted', 'awaiting_acceptance', 'returning', 'accepted', 'DUE_GRACE', 'OVERDUE_REVIEW'].includes(i.status)
      );
    } else if (statusFilter === 'completed') {
      list = list.filter((i) =>
        ['completed', 'awaiting_payout', 'repaid', 'returned'].includes(i.status)
      );
    } else if (statusFilter === 'closed') {
      list = list.filter((i) =>
        ['cancelled', 'disposed'].includes(i.status)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((i) => {
        const idStr = `${i.serviceType === 'pawn' ? '#' : 'tm'}${i.id}`.toLowerCase();
        return (
          idStr.includes(q) ||
          String(i.id).includes(q) ||
          i.assetName.toLowerCase().includes(q) ||
          i.modelCode.toLowerCase().includes(q) ||
          i.version.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [items, serviceFilter, statusFilter, searchQuery]);

  const HUB_PAGE_SIZE = 9;
  useEffect(() => {
    setHubPage(1);
  }, [searchQuery, serviceFilter, statusFilter]);

  const totalHubPages = Math.ceil(filteredItems.length / HUB_PAGE_SIZE) || 1;
  const paginatedItems = useMemo(() => {
    const start = (hubPage - 1) * HUB_PAGE_SIZE;
    return filteredItems.slice(start, start + HUB_PAGE_SIZE);
  }, [filteredItems, hubPage]);

  return (
    <section className="service-history-hub mt-12 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark sm:p-8">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-strokedark">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            <AdminIcon name="refresh" size={14} />
            <span>THEO DÕI TIẾN ĐỘ & LỊCH SỬ</span>
          </div>
          <h2 className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl dark:text-white">
            Tra cứu yêu cầu dịch vụ của bạn
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Xem ảnh unboxing, biên bản kiểm hàng, tiến trình định giá và nhận báo giá trực tiếp
          </p>
        </div>

        {user && (
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-strokedark dark:bg-meta-4 dark:text-slate-200"
          >
            <AdminIcon name="refresh" size={14} />
            <span>{loading ? 'Đang cập nhật...' : 'Làm mới'}</span>
          </button>
        )}
      </div>

      {!user ? (
        <div className="my-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center dark:border-strokedark dark:bg-meta-4/20">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-xs dark:bg-boxdark">
            <AdminIcon name="users" size={24} />
          </div>
          <h3 className="mt-3 text-base font-bold text-slate-800 dark:text-white">
            Bạn đã gửi yêu cầu thu mua hoặc trade mô hình?
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            Đăng nhập tài khoản để tra cứu chi tiết tiến trình thẩm định thực tế, xem video kiểm tra hiện vật và quản lý các giao dịch của bạn.
          </p>
          <div className="mt-4">
            <Link
              href="/auth/signin?redirect=/services"
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700"
            >
              <AdminIcon name="users" size={16} />
              <span>Đăng nhập để xem lịch sử</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Quick Metrics Bar */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-strokedark dark:bg-meta-4/20">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tổng số yêu cầu</span>
              <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{counts.total}</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3.5 dark:border-sky-950/40 dark:bg-sky-950/20">
              <span className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider dark:text-sky-400">Đang xử lý</span>
              <p className="mt-1 text-2xl font-black text-sky-800 dark:text-sky-300">{counts.active}</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3.5 dark:border-amber-950/40 dark:bg-amber-950/20">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider dark:text-amber-400">Cần bạn duyệt</span>
              <p className="mt-1 text-2xl font-black text-amber-800 dark:text-amber-300">{counts.actionNeeded}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 dark:border-emerald-950/40 dark:bg-emerald-950/20">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider dark:text-emerald-400">Hoàn tất</span>
              <p className="mt-1 text-2xl font-black text-emerald-800 dark:text-emerald-300">{counts.completed}</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-6 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              {/* Search Box */}
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <AdminIcon name="search" size={16} />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo mã TM, tên mô hình hoặc phiên bản..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none dark:border-strokedark dark:bg-boxdark dark:text-white"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Service Type Switcher */}
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-meta-4">
                {[
                  { key: 'all', label: 'Tất cả' },
                  { key: 'sell', label: 'Thu mua' },
                  { key: 'trade', label: 'Trade' },
                  { key: 'pawn', label: 'Cầm cố' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setServiceFilter(s.key as any)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      serviceFilter === s.key
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-boxdark dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {[
                { key: 'all', label: 'Tất cả trạng thái' },
                { key: 'active', label: 'Đang xử lý' },
                { key: 'action_needed', label: 'Cần duyệt' },
                { key: 'completed', label: 'Đã hoàn tất' },
                { key: 'closed', label: 'Đã đóng' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setStatusFilter(st.key as any)}
                  className={`rounded-lg px-3 py-1.5 font-semibold whitespace-nowrap transition-all ${
                    statusFilter === st.key
                      ? 'bg-purple-600 text-white shadow-xs ring-1 ring-purple-600'
                      : 'border border-slate-200/80 bg-slate-100 text-slate-700 hover:bg-slate-200/90 dark:border-strokedark dark:bg-meta-4/40 dark:text-slate-300 dark:hover:bg-meta-4'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Items Grid */}
          <div className="mt-6">
            {filteredItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center text-xs text-slate-500 dark:border-strokedark dark:bg-meta-4/10">
                <div className="mx-auto mb-2 text-slate-300 dark:text-slate-600">
                  <AdminIcon name="box" size={32} />
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  {items.length === 0 ? 'Bạn chưa có yêu cầu dịch vụ nào' : 'Không có yêu cầu phù hợp với bộ lọc'}
                </p>
                <p className="mt-1 text-slate-400">
                  {items.length === 0
                    ? 'Bắt đầu gửi thông tin mô hình để shop thẩm định và báo giá ngay trên web.'
                    : 'Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.'}
                </p>
                {items.length === 0 ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <Link
                      href="/services/sell"
                      className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700"
                    >
                      Bán mô hình (Thu mua)
                    </Link>
                    <Link
                      href="/services/trade"
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-strokedark dark:bg-boxdark dark:text-slate-200"
                    >
                      Đổi mô hình (Trade)
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setServiceFilter('all');
                      setStatusFilter('all');
                    }}
                    className="mt-3 font-semibold text-purple-600 hover:underline dark:text-purple-400"
                  >
                    Đặt lại tất cả bộ lọc
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-3">
                  <span>
                    Hiển thị {(hubPage - 1) * HUB_PAGE_SIZE + 1} -{' '}
                    {Math.min(hubPage * HUB_PAGE_SIZE, filteredItems.length)} / {filteredItems.length} yêu cầu
                  </span>
                  {totalHubPages > 1 && (
                    <span>
                      Trang {hubPage}/{totalHubPages}
                    </span>
                  )}
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedItems.map((item) => {
                    const serviceLabel =
                      item.serviceType === 'sell'
                        ? 'Thu mua'
                        : item.serviceType === 'trade'
                        ? 'Trade đổi hàng'
                        : 'Cầm cố';

                    const detailRoute =
                      item.serviceType === 'sell'
                        ? '/services/sell'
                        : item.serviceType === 'trade'
                        ? '/services/trade'
                        : '/services/pawn';

                    return (
                      <div
                        key={`${item.serviceType}-${item.id}`}
                        className="group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:border-purple-500/50 hover:shadow-md dark:border-strokedark dark:bg-boxdark"
                      >
                        <div>
                          {/* Top Row: Service Badge + TM Code + Status Badge */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-meta-4 dark:text-slate-200">
                                {item.serviceType === 'pawn' ? `#${item.id}` : `TM${item.id}`}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-meta-4 dark:text-slate-300">
                                {serviceLabel}
                              </span>
                            </div>
                            <ServiceStatusBadge
                              status={item.status}
                              label={
                                item.serviceType === 'pawn'
                                  ? tPawn(`status.${item.status}`)
                                  : tBuyback(`status.${item.status}`)
                              }
                            />
                          </div>

                          {/* Model Title */}
                          <h3 className="mt-3 text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors line-clamp-2 leading-snug dark:text-white">
                            {item.assetName}
                          </h3>

                          {/* Subtitle / Model Code & Version */}
                          <p className="mt-1 text-xs text-slate-500 line-clamp-1 dark:text-slate-400">
                            {item.modelCode} · {item.version}
                          </p>

                          {/* Price Tag if available */}
                          {item.offerAmountVnd !== null && (
                            <div className="mt-3 flex items-baseline justify-between rounded-lg bg-slate-50 p-2 text-xs dark:bg-meta-4/20">
                              <span className="text-slate-500">{item.offerLabel || 'Giá thỏa thuận'}:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {formatVND(item.offerAmountVnd, locale)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Footer Actions */}
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-strokedark">
                          <span className="text-[11px] text-slate-400">
                            {new Date(item.createdAt).toLocaleDateString(locale)}
                          </span>

                          <div className="flex items-center gap-2">
                            {item.rawBuyback && (
                              <button
                                type="button"
                                onClick={() => setPreviewItem(item)}
                                className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-meta-4 dark:text-slate-200"
                              >
                                Xem nhanh
                              </button>
                            )}
                            <Link
                              href={detailRoute}
                              className="inline-flex items-center gap-1 font-bold text-purple-600 hover:underline dark:text-purple-400"
                            >
                              <span>Vào trang</span>
                              <span>→</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hub Pagination */}
                {totalHubPages > 1 && (
                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs dark:border-strokedark">
                    <button
                      type="button"
                      onClick={() => setHubPage((p) => Math.max(1, p - 1))}
                      disabled={hubPage === 1}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none dark:border-strokedark dark:bg-boxdark dark:text-slate-300 dark:hover:bg-meta-4"
                    >
                      ← Trang trước
                    </button>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: totalHubPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setHubPage(page)}
                          className={`min-w-[32px] rounded-lg px-2.5 py-1 font-bold transition-all ${
                            hubPage === page
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-strokedark dark:bg-boxdark dark:text-slate-300 dark:hover:bg-meta-4'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setHubPage((p) => Math.min(totalHubPages, p + 1))}
                      disabled={hubPage === totalHubPages}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none dark:border-strokedark dark:bg-boxdark dark:text-slate-300 dark:hover:bg-meta-4"
                    >
                      Trang sau →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Quick Modal Preview */}
      {previewItem?.rawBuyback && (
        <Modal
          open={Boolean(previewItem)}
          onClose={() => setPreviewItem(null)}
          title={`Chi tiết yêu cầu TM${previewItem.id} · ${previewItem.assetName}`}
          size="lg"
        >
          <div className="space-y-5 p-1 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                TM{previewItem.id}
              </span>
              <ServiceStatusBadge
                status={previewItem.status}
                label={tBuyback(`status.${previewItem.status}`)}
                size="md"
              />
            </div>

            {/* Visual Process Timeline */}
            <ServiceTimeline
              status={previewItem.status}
              events={previewItem.rawBuyback.events}
              mode={previewItem.serviceType as any}
            />

            {/* Customer Evidence */}
            <ServiceMediaGallery
              files={previewItem.rawBuyback.evidence || []}
              title="Ảnh & Video thực tế khách cung cấp"
              subtitle="Ảnh chụp các góc mô hình do bạn gửi"
              badge="Khách cung cấp"
            />

            {/* Shop Inspection Evidence */}
            {previewItem.rawBuyback.inspectionEvidence && previewItem.rawBuyback.inspectionEvidence.length > 0 && (
              <ServiceMediaGallery
                files={previewItem.rawBuyback.inspectionEvidence}
                title="Video & Ảnh mở kiện, kiểm hàng của shop"
                subtitle="Biên bản unboxing và kiểm tra chi tiết của kỹ thuật viên"
                badge="Biên bản shop"
              />
            )}

            {/* CTA */}
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Link
                href={previewItem.serviceType === 'sell' ? '/services/sell' : '/services/trade'}
                className="mu-button"
              >
                Mở không gian xử lý đầy đủ →
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

