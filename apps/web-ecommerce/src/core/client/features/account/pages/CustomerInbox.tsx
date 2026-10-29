'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Api from '@/core/client/api/Api';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import { formatVND } from '@/shared/server/utils/utils';
import type { CustomerNotification, RestockPreference } from '@/shared/types/customer-tools';

const KNOWN_KINDS = [
  'restock',
  'order_cancel_rejected',
  'order_cancelled',
  'reservation_deadline',
  'pawn_due',
  'pawn_overdue',
  'order_meeting_deposit',
  'order_cod_deposit',
  'order_meeting_confirmed',
  'order_handover_completed',
  'order_shipment_created',
  'order_shipment_picked_up',
  'order_shipment_in_transit',
  'order_shipment_out_for_delivery',
  'order_shipment_delivered',
  'order_shipment_failed',
  'order_shipment_returning',
  'order_shipment_returned',
  'buyback_need_evidence',
  'buyback_preliminary_quote',
  'buyback_received',
  'buyback_final_quote',
  'buyback_final_quote_adjusted',
  'voucher_expiring',
];

type InboxCategory = 'all' | 'unread' | 'services' | 'orders' | 'promos';

export default function CustomerInbox({ embedded = false }: { embedded?: boolean } = {}) {
  const Heading = embedded ? 'h2' : 'h1';
  const t = useTranslations('customerTools'),
    common = useTranslations('common'),
    locale = useLocale(),
    { user } = useCurrentUser();

  const [rows, setRows] = useState<CustomerNotification[]>([]);
  const [subscriptions, setSubscriptions] = useState<RestockPreference[]>([]);
  const [activeCategory, setActiveCategory] = useState<InboxCategory>('all');
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [notifications, alerts] = await Promise.all([
        Api.get('/notifications', { params: { offset } }),
        Api.get('/notifications/restocks'),
      ]);
      setRows(notifications.data.rows);
      setCount(notifications.data.count);
      setSubscriptions(alerts.data);
      setFailed(false);
      setLoaded(true);
    } catch {
      setFailed(true);
    }
  }, [user, offset]);

  useEffect(() => {
    setLoaded(false);
    setRows([]);
    setSubscriptions([]);
    void load();
  }, [load]);

  const unreadCount = useMemo(() => {
    return rows.filter((r) => !r.readAt).length;
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (activeCategory === 'unread') return !row.readAt;
      if (activeCategory === 'services') {
        return (
          row.kind.startsWith('buyback_') ||
          row.kind.startsWith('pawn_') ||
          row.kind === 'reservation_deadline'
        );
      }
      if (activeCategory === 'orders') {
        return row.kind.startsWith('order_');
      }
      if (activeCategory === 'promos') {
        return row.kind === 'voucher_expiring' || row.kind === 'restock';
      }
      return true;
    });
  }, [rows, activeCategory]);

  const markAllAsRead = async () => {
    const unreadItems = rows.filter((r) => !r.readAt);
    if (unreadItems.length === 0 || busy) return;
    setBusy(true);
    try {
      await Promise.allSettled(unreadItems.map((r) => Api.post(`/notifications/${r.id}/read`)));
      await load();
    } catch {
      /* Keep current state */
    } finally {
      setBusy(false);
    }
  };

  const getKindVisual = (kind: string) => {
    if (kind === 'voucher_expiring') {
      return {
        badge: 'Ưu đãi & Voucher',
        bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="5" x2="5" y2="19" />
            <circle cx="6.5" cy="6.5" r="2.5" />
            <circle cx="17.5" cy="17.5" r="2.5" />
          </svg>
        ),
      };
    }
    if (kind.startsWith('buyback_')) {
      return {
        badge: 'Thu mua & Định giá',
        bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        ),
      };
    }
    if (kind.startsWith('pawn_') || kind === 'reservation_deadline') {
      return {
        badge: 'Cầm đồ & Giữ hàng',
        bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
      };
    }
    if (kind.startsWith('order_')) {
      return {
        badge: 'Đơn hàng & Giao vận',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ),
      };
    }
    return {
      badge: 'Thông báo',
      bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    };
  };

  if (!user) {
    return (
      <section className={embedded ? 'p-6' : 'mu-wrap mu-section'}>
        <Heading className="mu-heading">{t('inbox')}</Heading>
        <p className="mt-2 text-sm text-slate-500">Vui lòng đăng nhập để xem thông báo cá nhân của bạn.</p>
        <Link className="mu-button mt-6 inline-block" href="/auth/signin?redirect=%2Faccount%2Fnotifications">
          {common('signIn')}
        </Link>
      </section>
    );
  }

  return (
    <div className={`customer-inbox-workspace ${embedded ? '' : 'mu-wrap mu-section'}`}>
      {/* Inbox Header & Summary */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-strokedark sm:flex-row sm:items-center sm:justify-between">
        <div>
          {!embedded && <p className="studio-kicker mb-1">MODEL UNIVERSE / ACCOUNT</p>}
          <div className="flex items-center gap-3">
            <Heading className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {t('inbox')}
            </Heading>
            {unreadCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                <span className="h-2 w-2 rounded-full bg-purple-600 animate-pulse" />
                {unreadCount} chưa đọc
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            {t('inboxNote')}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-xs font-bold text-purple-700 transition-all hover:bg-purple-100 hover:shadow-xs disabled:opacity-50 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/40"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Đánh dấu tất cả đã đọc</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="my-5 flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'Tất cả'],
            ['unread', `Chưa đọc (${unreadCount})`],
            ['services', 'Dịch vụ & Ký gửi'],
            ['orders', 'Đơn hàng'],
            ['promos', 'Voucher & Tồn kho'],
          ] as const
        ).map(([key, label]) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-meta-4 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Notification Feed & Sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Left Column: Notifications Feed */}
        <div className="space-y-3.5">
          {failed && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 text-center dark:border-rose-900 dark:bg-rose-950/20">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Không thể tải thông báo lúc này.</p>
              <button
                type="button"
                className="mu-button mt-3 px-4 py-2 text-xs"
                onClick={() => void load()}
              >
                {common('retry')}
              </button>
            </div>
          )}

          {!loaded && !failed && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center dark:border-strokedark dark:bg-boxdark">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" role="status">
                {common('loading')}
              </p>
            </div>
          )}

          {loaded && filteredRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center dark:border-strokedark dark:bg-boxdark">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-meta-4">
                <AdminIcon name="spark" size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {activeCategory === 'unread' ? 'Không có thông báo chưa đọc' : t('noNotifications')}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Khi có cập nhật về đơn hàng, định giá dịch vụ hoặc khuyến mãi, bạn sẽ nhận được thông báo tại đây.
              </p>
              {activeCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className="mt-3 text-xs font-bold text-purple-600 hover:underline dark:text-purple-400"
                >
                  Xem tất cả thông báo
                </button>
              )}
            </div>
          )}

          {filteredRows.map((row) => {
            const known = KNOWN_KINDS.includes(row.kind);
            const isUnread = !row.readAt;
            const visual = getKindVisual(row.kind);

            const href =
              row.kind === 'restock'
                ? `/shop/product/${row.entityId}`
                : row.kind === 'reservation_deadline'
                  ? '/reservations'
                  : row.kind.startsWith('pawn_')
                    ? '/services/pawn'
                    : row.kind.startsWith('order_')
                      ? '/order-history'
                      : row.kind.startsWith('buyback_')
                        ? '/services/sell'
                        : row.kind === 'voucher_expiring'
                          ? '/cart'
                          : null;

            const facts = [row.details.orderCode, row.details.code, row.details.trackingNumber].filter(
              (value): value is string => typeof value === 'string',
            );
            const amounts = (['amountVnd', 'confirmedPaidVnd', 'remainingVnd', 'codAmountVnd'] as const).filter(
              (key) => typeof row.details[key] === 'number',
            );

            return (
              <article
                key={row.id}
                className={`relative rounded-2xl border p-5 transition-all ${
                  isUnread
                    ? 'border-l-4 border-l-purple-600 border-purple-200/80 bg-purple-50/20 shadow-xs dark:border-l-purple-500 dark:border-purple-900/60 dark:bg-purple-950/10'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-strokedark dark:bg-boxdark dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Icon Indicator */}
                  <div className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl border ${visual.bg}`}>
                    {visual.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Header: Title + Timestamp */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-meta-4 dark:text-slate-300">
                          {visual.badge}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                          {known ? t(`kinds.${row.kind}`) : t('notification')}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {isUnread && (
                          <span className="flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                            Mới
                          </span>
                        )}
                        <span>{new Date(row.createdAt).toLocaleString(locale)}</span>
                      </div>
                    </div>

                    {/* Details content */}
                    <div className="mt-2.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {row.kind === 'restock' && (
                        <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-meta-4">
                          <strong className="block text-slate-900 dark:text-white">
                            {String(row.details.productName || '')}
                          </strong>
                          <span className="text-slate-500 dark:text-slate-400">
                            {t('stockObserved', { count: Number(row.details.observedStock || 0) })}
                          </span>
                        </div>
                      )}

                      {facts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wider text-slate-400">Mã liên quan:</span>
                          {facts.map((code) => (
                            <span key={code} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800 dark:bg-meta-4 dark:text-white">
                              {code}
                            </span>
                          ))}
                        </div>
                      )}

                      {amounts.map((key) => (
                        <div key={key} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <span>{t(`amounts.${key}`, { amount: formatVND(Number(row.details[key]), locale) })}</span>
                        </div>
                      ))}

                      {['reason', 'request', 'address', 'description'].map((key) =>
                        typeof row.details[key] === 'string' && row.details[key] ? (
                          <p key={key} className="rounded-lg bg-slate-50 p-2.5 whitespace-pre-line text-slate-700 dark:bg-meta-4 dark:text-slate-200">
                            {String(row.details[key])}
                          </p>
                        ) : null,
                      )}

                      {typeof row.details.expiresAt === 'string' && row.kind === 'voucher_expiring' && (
                        <p className="font-semibold text-amber-700 dark:text-amber-400">
                          Hạn chót sử dụng: {new Date(row.details.expiresAt).toLocaleString(locale)}
                        </p>
                      )}

                      {typeof row.details.dueAt === 'string' && (
                        <p className="font-semibold text-rose-700 dark:text-rose-400">
                          Hạn thanh toán: {new Date(row.details.dueAt).toLocaleString(locale)}
                        </p>
                      )}
                    </div>

                    {/* Actions: View Details / Mark Read */}
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-strokedark">
                      {href && (
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                        >
                          <span>{t('view')}</span>
                          <span>→</span>
                        </Link>
                      )}

                      {isUnread ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await Api.post(`/notifications/${row.id}/read`);
                              await load();
                            } catch {
                              /* Keep unread state */
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-strokedark dark:bg-meta-4 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{t('markRead')}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{t('read')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Pagination */}
          {count > 30 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-strokedark">
              <span className="text-xs text-slate-500">
                Hiển thị {offset + 1} - {Math.min(offset + 30, count)} trên {count} thông báo
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-strokedark dark:text-slate-200"
                  disabled={busy || offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 30))}
                >
                  {common('previous')}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-strokedark dark:text-slate-200"
                  disabled={busy || offset + 30 >= count}
                  onClick={() => setOffset(offset + 30)}
                >
                  {common('next')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Restock Preferences Aside */}
        <aside className="h-fit rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-strokedark dark:bg-boxdark sm:p-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 dark:border-strokedark">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
              <AdminIcon name="spark" size={17} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {t('restockPreferences')}
              </h2>
              <p className="text-[11px] text-slate-400">Theo dõi sản phẩm chờ hàng về</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {loaded && subscriptions.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-strokedark">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('noAlerts')}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Nhấn nút &ldquo;Báo khi có hàng&rdquo; trên bất kỳ mô hình hết hàng nào để nhận thông báo tức thì.
                </p>
              </div>
            )}

            {subscriptions.map((row) => (
              <div
                key={row.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition-all dark:border-strokedark dark:bg-meta-4"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {row.product?.name || t('unavailableItem')}
                  </h4>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        row.active ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {row.active ? t('alertActive') : row.notifiedAt ? t('alertSent') : t('alertOff')}
                    </span>
                  </div>
                </div>

                {row.active && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await Api.post(`/notifications/restocks/${row.productId}`, { active: false });
                        await load();
                      } catch {
                        /* Retain state */
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="self-start text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
                  >
                    {t('stopAlert')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
