'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import Link from '@/i18n/navigation';
import DataTable, { DataTableColumn } from '@/components/Tables/DataTable';
import AdminListKpis from '@/components/Admin/AdminListKpis';
import FilterMultiSelect from '@/components/FormElements/FilterMultiSelect';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { inputClassName } from '@/components/FormElements/TextField';
import OrderApi from '@/core/client/api/Order';
import useAdminTableLayout from '@/shared/client/hooks/useAdminTableLayout';
import { formatVND } from '@/shared/server/utils/utils';
import type { OrderOverview } from '@/shared/admin-list-overview';
import type { Pagination, SortState } from '@/shared/types/pagination';
import type { Order, OrderStatus } from '@/shared/types/order';

const statusNames: Record<OrderStatus, string> = {
  PROCESSING: 'Chờ xử lý',
  SHIPPED: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
};
const channelNames: Record<string, string> = {
  WEBSITE: 'Website',
  COUNTER: 'Tại cửa hàng',
  ASSISTED: 'Chat / điện thoại',
};
const shortDate = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const remaining = (order: Order) => Number(order.outstandingVnd ?? Math.max(0, order.total - (order.prepaidVnd ?? 0)));
const paymentLabel = (order: Order) =>
  order.status === 'CANCELLED'
    ? 'Đơn đã huỷ'
    : order.paymentStatus === 'PAID'
      ? 'Đã thanh toán'
      : remaining(order) > 0
        ? 'Chưa thu đủ'
        : 'Chờ xác nhận';

export default function OrderList() {
  const router = useRouter(),
    ref = useRef<HTMLDivElement>(null),
    pageSize = useAdminTableLayout(ref);
  const [orders, setOrders] = useState<Order[]>([]),
    [pagination, setPagination] = useState<Pagination>();
  const [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  const [overview, setOverview] = useState<OrderOverview>(),
    [statsLoading, setStatsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(''),
    [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<OrderStatus[]>([]),
    [channels, setChannels] = useState<string[]>([]);
  const [attention, setAttention] = useState(''),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', direction: 'desc' });
  useEffect(() => {
    setPage(1);
  }, [pageSize]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    OrderApi.overview().then((value) => {
      if (!cancelled) {
        setOverview(value);
        setStatsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  useEffect(() => {
    if (!pageSize) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    OrderApi.getOrders({
      q: search,
      status: statuses,
      channel: channels,
      attention,
      page,
      per_page: pageSize,
      sort: sort.key,
      direction: sort.direction,
    }).then((result) => {
      if (cancelled) return;
      setOrders(result?.data ?? []);
      setPagination(result?.pagination);
      setFailed(!result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [search, statuses, channels, attention, page, pageSize, sort, refresh]);
  const retry = () => setRefresh((value) => value + 1);
  const reset = () => {
    setSearchInput('');
    setSearch('');
    setStatuses([]);
    setChannels([]);
    setAttention('');
    setPage(1);
  };
  const pick = (value: string) => {
    reset();
    if (value === 'PROCESSING' || value === 'SHIPPED') setStatuses([value]);
    else setAttention(value);
  };
  const columns: DataTableColumn<Order>[] = [
    {
      key: 'createdAt',
      header: 'Đơn hàng',
      sortable: true,
      essential: true,
      className: 'order-identity-cell',
      render: (order) => (
        <div>
          <strong className="list-primary-text">#{order.id}</strong>
          <span className="list-secondary-text">{shortDate(order.createdAt)}</span>
          <span className="list-mobile-contact">{channelNames[order.salesChannel || 'WEBSITE']}</span>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Khách hàng',
      className: 'order-customer-cell',
      essential: true,
      render: (order) => (
        <div>
          <strong className="list-primary-text">{order.recipientName}</strong>
          <span className="list-secondary-text" title={order.user?.email || order.phone}>
            {order.phone || order.user?.email || 'Khách mua trực tiếp'}
          </span>
          <span className="order-mobile-status">
            <OrderStatusBadge status={order.status} />
          </span>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Giá trị đơn',
      sortable: true,
      className: 'order-total-cell',
      essential: true,
      render: (order) => (
        <div>
          <strong>{formatVND(order.total, 'vi')}</strong>
          <span className="order-mobile-payment">
            {order.status !== 'CANCELLED' && order.paymentStatus !== 'PAID' && remaining(order) > 0
              ? `Còn thu ${formatVND(remaining(order), 'vi')}`
              : paymentLabel(order)}
          </span>
        </div>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Thanh toán',
      className: 'order-payment-cell',
      render: (order) => (
        <div>
          <span
            className={`list-status-chip ${order.status === 'CANCELLED' ? 'is-muted' : order.paymentStatus === 'PAID' ? 'is-positive' : 'is-warning'}`}
          >
            {paymentLabel(order)}
          </span>
          {order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED' && remaining(order) > 0 && (
            <span className="list-secondary-text">Còn {formatVND(remaining(order), 'vi')}</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái đơn',
      sortable: true,
      className: 'order-status-cell',
      render: (order) => (
        <div>
          <OrderStatusBadge status={order.status} />
          {order.cancelRequest?.status === 'PENDING' && order.status !== 'CANCELLED' && (
            <span className="list-secondary-text list-warning-text">Khách yêu cầu huỷ</span>
          )}
        </div>
      ),
    },
    {
      key: 'salesChannel',
      header: 'Kênh bán',
      className: 'order-channel-cell',
      render: (order) => channelNames[order.salesChannel || 'WEBSITE'],
    },
    {
      key: 'updatedAt',
      header: 'Cập nhật',
      sortable: true,
      className: 'order-updated-cell',
      render: (order) => shortDate(order.updatedAt),
    },
  ];
  const count = (value: number | undefined) => value?.toLocaleString('vi-VN') ?? '—';
  const activeFilter =
    attention === 'unpaid' ? 'Chưa thu đủ tiền' : attention === 'cancellation' ? 'Yêu cầu huỷ đang chờ' : undefined;
  return (
    <div
      ref={ref}
      className={`compact-admin-catalog-page catalog-workspace admin-list-workspace order-workspace${!loading && orders.length === pageSize ? ' has-full-page' : ''}`}
    >
      <h1 className="sr-only">Đơn hàng</h1>
      <AdminListKpis
        loading={statsLoading}
        failed={!statsLoading && !overview}
        onRetry={retry}
        items={[
          {
            label: 'Chờ xử lý',
            value: count(overview?.processing),
            hint: 'Đơn đang chờ cửa hàng xử lý',
            icon: 'orders',
            active: statuses.length === 1 && statuses[0] === 'PROCESSING' && !attention,
            onClick: () => pick('PROCESSING'),
          },
          {
            label: 'Đang giao',
            value: count(overview?.shipping),
            hint: 'Theo dõi đơn đang vận chuyển',
            icon: 'truck',
            active: statuses.length === 1 && statuses[0] === 'SHIPPED' && !attention,
            onClick: () => pick('SHIPPED'),
          },
          {
            label: 'Tiền còn phải thu',
            value: overview ? formatVND(overview.receivableVnd, 'vi') : '—',
            hint: `${count(overview?.unpaidOrders)} đơn chưa thu đủ · không gồm đơn huỷ`,
            icon: 'bag',
            tone: 'warning',
            active: attention === 'unpaid',
            onClick: () => pick('unpaid'),
          },
          {
            label: 'Yêu cầu huỷ',
            value: count(overview?.cancellationRequests),
            hint: 'Yêu cầu của khách đang chờ xử lý',
            icon: 'shield',
            tone: overview?.cancellationRequests ? 'warning' : undefined,
            active: attention === 'cancellation',
            onClick: () => pick('cancellation'),
          },
        ]}
      />
      <div className="compact-catalog-results">
        {failed && (
          <div className="admin-load-error" role="alert">
            Không tải được danh sách đơn hàng. <button onClick={retry}>Thử lại</button>
          </div>
        )}
        <DataTable
          title="Danh sách đơn hàng"
          compactRows
          mergeToolbar
          summary={
            <span className="catalog-product-count">
              <strong>{count(pagination?.total)}</strong> đơn hàng{activeFilter && <small>{activeFilter}</small>}
            </span>
          }
          paginationSummary={
            pagination
              ? `Trang ${page} / ${Math.max(1, pagination.totalPages)} · ${pagination.total.toLocaleString('vi-VN')} đơn hàng`
              : undefined
          }
          actions={
            <>
              <input
                type="search"
                className={inputClassName}
                placeholder="Tìm mã đơn, tên, số điện thoại…"
                aria-label="Tìm đơn hàng"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <FilterMultiSelect
                label="Trạng thái đơn"
                placeholder="Mọi trạng thái"
                clearLabel="Bỏ lựa chọn"
                values={statuses}
                options={(Object.keys(statusNames) as OrderStatus[]).map((value) => ({
                  value,
                  label: statusNames[value],
                }))}
                onChange={(values) => {
                  setStatuses(values as OrderStatus[]);
                  setPage(1);
                }}
              />
              <FilterMultiSelect
                label="Kênh bán"
                placeholder="Mọi kênh bán"
                clearLabel="Bỏ lựa chọn"
                values={channels}
                options={Object.entries(channelNames).map(([value, label]) => ({ value, label }))}
                onChange={(values) => {
                  setChannels(values);
                  setPage(1);
                }}
              />
              {attention || searchInput || statuses.length || channels.length ? (
                <button className="list-clear-filter" onClick={reset}>
                  Xoá lọc
                </button>
              ) : null}
              <Link href="/admin/orders/new" className="catalog-create-button">
                + Tạo đơn
              </Link>
            </>
          }
          columns={columns}
          data={orders}
          rowKey={(order) => order.id}
          loading={loading}
          emptyText={failed ? 'Không tải được dữ liệu' : 'Không có đơn hàng phù hợp'}
          onRowClick={(order) => router.push(`/admin/orders/${order.id}`)}
          sort={sort}
          onSortChange={(value) => {
            setSort(value);
            setPage(1);
          }}
          pagination={pagination}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
