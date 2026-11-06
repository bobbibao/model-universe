'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import Api from '@/core/client/api/Api';
import ContactApi from '@/core/client/api/Contact';
import OrderApi from '@/core/client/api/Order';
import ProductApi from '@/core/client/api/Product';
import { formatVND } from '@/shared/server/utils/utils';
import './attention-board.css';

// "What needs doing now" at the top of the admin dashboard: live counts from the existing list endpoints, each one a
// link to the list already filtered. A count that failed to load shows "—", never a made-up zero.
type Counts = {
  processing?: number;
  shipping?: number;
  unpaidOrders?: number;
  receivableVnd?: number;
  cancellations?: number;
  newMessages?: number;
  openAlerts?: number;
  outOfStock?: number;
};

type Tile = {
  key: keyof Counts;
  icon: string;
  label: string;
  hint: (counts: Counts) => string;
  href: string;
  // A positive count is something to act on (amber); otherwise it is informational.
  urgent: boolean;
};

const settled = <T,>(promise: Promise<T>) => promise.catch(() => undefined);

export default function AttentionBoard({ en }: { en: boolean }) {
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date>();

  const load = useCallback(async () => {
    setLoading(true);
    const [orders, messages, alerts, stock] = await Promise.all([
      settled(OrderApi.overview()),
      settled(ContactApi.getMessages({ status: 'NEW', page: 1, per_page: 1 })),
      settled(Api.get('/admin/pricing/alerts', { params: { status: 'open' } }).then((response) => response.data)),
      settled(ProductApi.getInventoryStats()),
    ]);
    setCounts({
      processing: orders?.processing,
      shipping: orders?.shipping,
      unpaidOrders: orders?.unpaidOrders,
      receivableVnd: orders?.receivableVnd,
      cancellations: orders?.cancellationRequests,
      newMessages: messages?.pagination?.total,
      openAlerts: Array.isArray(alerts) ? alerts.length : undefined,
      outOfStock: stock?.totals?.unitsOutOfStock,
    });
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tiles: Tile[] = [
    {
      key: 'processing',
      icon: 'orders',
      label: en ? 'Orders to process' : 'Đơn chờ xử lý',
      hint: () => (en ? 'Confirm, pack and hand over' : 'Xác nhận, đóng gói, giao vận chuyển'),
      href: '/admin/orders?status=PROCESSING',
      urgent: true,
    },
    {
      key: 'unpaidOrders',
      icon: 'chart',
      label: en ? 'Not fully paid' : 'Chưa thu đủ tiền',
      hint: (c) =>
        c.receivableVnd === undefined
          ? en
            ? 'Outstanding balance'
            : 'Số tiền còn phải thu'
          : `${en ? 'Outstanding' : 'Còn phải thu'} ${formatVND(c.receivableVnd)}`,
      href: '/admin/orders?attention=unpaid',
      urgent: true,
    },
    {
      key: 'cancellations',
      icon: 'close',
      label: en ? 'Cancellation requests' : 'Yêu cầu huỷ đơn',
      hint: () => (en ? 'Customers waiting for an answer' : 'Khách đang chờ phản hồi'),
      href: '/admin/orders?attention=cancellation',
      urgent: true,
    },
    {
      key: 'newMessages',
      icon: 'users',
      label: en ? 'New contact messages' : 'Tin nhắn liên hệ mới',
      hint: () => (en ? 'From the contact page' : 'Từ trang Liên hệ, chưa xử lý'),
      href: '/admin/contacts?status=NEW',
      urgent: true,
    },
    {
      key: 'openAlerts',
      icon: 'shield',
      label: en ? 'Open alerts' : 'Cảnh báo vận hành',
      hint: () => (en ? 'Delivery, payment, pricing' : 'Giao hàng, thanh toán, giá'),
      href: '/admin/alerts',
      urgent: true,
    },
    {
      key: 'shipping',
      icon: 'truck',
      label: en ? 'Out for delivery' : 'Đang giao',
      hint: () => (en ? 'Track carrier updates' : 'Theo dõi trạng thái vận chuyển'),
      href: '/admin/orders?status=SHIPPED',
      urgent: false,
    },
    {
      key: 'outOfStock',
      icon: 'box',
      label: en ? 'Out-of-stock options' : 'Lựa chọn đã hết hàng',
      hint: () => (en ? 'Restock or hide' : 'Nhập thêm hoặc ẩn khỏi cửa hàng'),
      href: '/admin/products',
      urgent: false,
    },
  ];

  const waiting = tiles.filter((tile) => tile.urgent && (counts[tile.key] ?? 0) > 0).length;
  const actions = [
    { href: '/admin/orders/new', icon: 'bag', label: en ? 'New sale' : 'Tạo đơn bán' },
    { href: '/admin/products/new', icon: 'box', label: en ? 'Add a kit' : 'Thêm mô hình' },
    { href: '/admin/stock', icon: 'truck', label: en ? 'Receive stock' : 'Nhập kho' },
    { href: '/admin/coupons', icon: 'spark', label: en ? 'Vouchers' : 'Voucher' },
    { href: '/admin/buyback', icon: 'exchange', label: en ? 'Buyback' : 'Thu mua' },
    { href: '/admin/reservations', icon: 'calendar', label: en ? 'Holds' : 'Giữ hàng' },
  ];

  return (
    <section className="attention-board" aria-labelledby="attention-title" aria-busy={loading}>
      <header className="attention-head">
        <div>
          <h2 id="attention-title">{en ? 'Needs your attention' : 'Việc cần xử lý'}</h2>
          <p role="status">
            {loading
              ? en
                ? 'Checking orders, messages and alerts…'
                : 'Đang kiểm tra đơn, tin nhắn và cảnh báo…'
              : waiting === 0
                ? en
                  ? 'All clear: nothing is waiting on you.'
                  : 'Mọi thứ đã ổn: không có việc nào đang chờ.'
                : en
                  ? `${waiting} kinds of work are waiting.`
                  : `${waiting} nhóm việc đang chờ bạn.`}
          </p>
        </div>
        <button type="button" className="attention-refresh" onClick={load} disabled={loading}>
          <AdminIcon name="refresh" size={15} />
          <span>
            {updatedAt
              ? `${en ? 'Updated' : 'Cập nhật'} ${updatedAt.toLocaleTimeString(en ? 'en-GB' : 'vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}`
              : en
                ? 'Refresh'
                : 'Làm mới'}
          </span>
        </button>
      </header>

      <ul className="attention-grid">
        {tiles.map((tile) => {
          const value = counts[tile.key];
          const tone = loading
            ? 'loading'
            : value === undefined
              ? 'unknown'
              : tile.urgent && value > 0
                ? 'urgent'
                : 'calm';
          return (
            <li key={tile.key}>
              <Link href={tile.href} className="attention-tile" data-tone={tone}>
                <span className="attention-icon">
                  <AdminIcon name={tile.icon} size={18} />
                </span>
                <span className="attention-value">{loading ? '·' : value === undefined ? '—' : value}</span>
                <span className="attention-label">{tile.label}</span>
                <span className="attention-hint">{tile.hint(counts)}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <nav className="attention-actions" aria-label={en ? 'Quick actions' : 'Thao tác nhanh'}>
        {actions.map((action) => (
          <Link key={action.href} href={action.href}>
            <AdminIcon name={action.icon} size={16} />
            {action.label}
          </Link>
        ))}
        <a href="/" target="_blank" rel="noopener noreferrer">
          <AdminIcon name="arrow" size={16} />
          {en ? 'Open the shop' : 'Xem cửa hàng'}
        </a>
      </nav>
    </section>
  );
}
