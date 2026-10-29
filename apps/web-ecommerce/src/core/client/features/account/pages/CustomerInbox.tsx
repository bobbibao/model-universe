'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Api from '@/core/client/api/Api';
import Link from '@/i18n/navigation';
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

  const getCategoryLabel = (kind: string) => {
    if (kind === 'voucher_expiring') return 'Ưu đãi & Voucher';
    if (kind.startsWith('buyback_')) return 'Thu mua & Thẩm định';
    if (kind.startsWith('pawn_')) return 'Cầm đồ & Bảo quản';
    if (kind === 'reservation_deadline') return 'Giữ mô hình';
    if (kind.startsWith('order_')) return 'Đơn hàng';
    if (kind === 'restock') return 'Tồn kho';
    return 'Thông báo';
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
    <div className={`customer-inbox-clean ${embedded ? '' : 'mu-wrap mu-section'}`}>
      {/* Inbox Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 dark:border-strokedark sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Heading className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {t('inbox')}
            </Heading>
            {unreadCount > 0 && (
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-meta-4 dark:text-slate-300">
                {unreadCount} chưa đọc
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('inboxNote')}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={markAllAsRead}
            className="self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-strokedark dark:bg-meta-4 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="my-4 flex flex-wrap items-center gap-1.5">
        {(
          [
            ['all', 'Tất cả'],
            ['unread', `Chưa đọc (${unreadCount})`],
            ['services', 'Dịch vụ & Thẩm định'],
            ['orders', 'Đơn hàng'],
            ['promos', 'Ưu đãi & Tồn kho'],
          ] as const
        ).map(([key, label]) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-meta-4'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Feed & Sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] items-start">
        {/* Left Column: Notifications Feed */}
        <div className="space-y-3">
          {failed && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 text-center dark:border-rose-900 dark:bg-rose-950/20">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Không thể tải thông báo lúc này.</p>
              <button
                type="button"
                className="mt-2 text-xs font-bold text-slate-900 underline dark:text-white"
                onClick={() => void load()}
              >
                {common('retry')}
              </button>
            </div>
          )}

          {!loaded && !failed && (
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 text-center dark:border-strokedark dark:bg-boxdark">
              <p className="text-xs text-slate-400" role="status">
                {common('loading')}
              </p>
            </div>
          )}

          {loaded && filteredRows.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-10 text-center dark:border-strokedark dark:bg-boxdark">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {activeCategory === 'unread' ? 'Không có thông báo chưa đọc' : t('noNotifications')}
              </p>
              {activeCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className="mt-2 text-xs font-bold text-slate-800 underline dark:text-slate-200"
                >
                  Xem tất cả
                </button>
              )}
            </div>
          )}

          {filteredRows.map((row) => {
            const known = KNOWN_KINDS.includes(row.kind);
            const isUnread = !row.readAt;
            const categoryLabel = getCategoryLabel(row.kind);

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
                className={`rounded-xl border p-4 transition-colors ${
                  isUnread
                    ? 'border-slate-300 bg-slate-50/60 dark:border-slate-600 dark:bg-meta-4/40'
                    : 'border-slate-200/80 bg-white dark:border-strokedark dark:bg-boxdark'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isUnread && (
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-900 dark:bg-white" />
                    )}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-meta-4 dark:text-slate-300">
                      {categoryLabel}
                    </span>
                    <h3 className={`text-xs sm:text-sm ${isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                      {known ? t(`kinds.${row.kind}`) : t('notification')}
                    </h3>
                  </div>

                  <span className="text-[11px] text-slate-400 flex-shrink-0">
                    {new Date(row.createdAt).toLocaleString(locale)}
                  </span>
                </div>

                {/* Details */}
                <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pl-3.5">
                  {row.kind === 'restock' && (
                    <div className="text-slate-800 dark:text-slate-200">
                      <strong>{String(row.details.productName || '')}</strong> · {t('stockObserved', { count: Number(row.details.observedStock || 0) })}
                    </div>
                  )}

                  {facts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Mã:</span>
                      {facts.map((code) => (
                        <span key={code} className="font-mono text-xs font-semibold text-slate-800 dark:text-white">
                          {code}
                        </span>
                      ))}
                    </div>
                  )}

                  {amounts.map((key) => (
                    <div key={key} className="font-semibold text-slate-900 dark:text-white">
                      {t(`amounts.${key}`, { amount: formatVND(Number(row.details[key]), locale) })}
                    </div>
                  ))}

                  {['reason', 'request', 'address', 'description'].map((key) =>
                    typeof row.details[key] === 'string' && row.details[key] ? (
                      <p key={key} className="whitespace-pre-line text-slate-500 dark:text-slate-400">
                        {String(row.details[key])}
                      </p>
                    ) : null,
                  )}

                  {typeof row.details.expiresAt === 'string' && row.kind === 'voucher_expiring' && (
                    <p className="text-slate-500">
                      Hạn chót sử dụng: {new Date(row.details.expiresAt).toLocaleString(locale)}
                    </p>
                  )}

                  {typeof row.details.dueAt === 'string' && (
                    <p className="text-slate-500">
                      Hạn thanh toán: {new Date(row.details.dueAt).toLocaleString(locale)}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2.5 pl-3.5 dark:border-strokedark">
                  {href && (
                    <Link
                      href={href}
                      className="text-xs font-bold text-slate-900 hover:underline dark:text-white"
                    >
                      {t('view')} ↗
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
                          /* Retain */
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      {t('markRead')}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">{t('read')}</span>
                  )}
                </div>
              </article>
            );
          })}

          {/* Pagination */}
          {count > 30 && (
            <div className="mt-3 flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                {offset + 1} - {Math.min(offset + 30, count)} / {count}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-strokedark dark:text-slate-300"
                  disabled={busy || offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 30))}
                >
                  {common('previous')}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-strokedark dark:text-slate-300"
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
        <aside className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-strokedark dark:bg-boxdark sm:p-5">
          <div className="border-b border-slate-100 pb-3 dark:border-strokedark">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('restockPreferences')}
            </h2>
            <p className="text-[11px] text-slate-400">Thông báo khi sản phẩm có hàng lại</p>
          </div>

          <div className="mt-3 space-y-2.5">
            {loaded && subscriptions.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">{t('noAlerts')}</p>
            )}

            {subscriptions.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2.5 dark:border-strokedark dark:bg-meta-4/30"
              >
                <div className="min-w-0 pr-2">
                  <h4 className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {row.product?.name || t('unavailableItem')}
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {row.active ? t('alertActive') : row.notifiedAt ? t('alertSent') : t('alertOff')}
                  </span>
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
                        /* Retain */
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="flex-shrink-0 text-[11px] text-slate-500 hover:text-rose-600 hover:underline"
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
