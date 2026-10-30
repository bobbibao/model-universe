'use client';

import { useEffect, useRef, useState } from 'react';
import DataTable, { DataTableColumn } from '@/components/Tables/DataTable';
import AdminListKpis from '@/components/Admin/AdminListKpis';
import FilterMultiSelect from '@/components/FormElements/FilterMultiSelect';
import SelectField from '@/components/FormElements/SelectField';
import { inputClassName } from '@/components/FormElements/TextField';
import UserApi from '@/core/client/api/User';
import useAdminTableLayout from '@/shared/client/hooks/useAdminTableLayout';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';
import type { CustomerOverview } from '@/shared/admin-list-overview';
import type { Pagination, SortState } from '@/shared/types/pagination';
import type { User, UserRole } from '@/shared/types/user';

export default function CustomerList() {
  const ref = useRef<HTMLDivElement>(null);
  const pageSize = useAdminTableLayout(ref);
  const { user: actor } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]),
    [pagination, setPagination] = useState<Pagination>();
  const [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  const [overview, setOverview] = useState<CustomerOverview>(),
    [statsLoading, setStatsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(''),
    [search, setSearch] = useState('');
  const [roles, setRoles] = useState<UserRole[]>(['USER']),
    [states, setStates] = useState<string[]>([]);
  const [segment, setSegment] = useState(''),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  const [sort, setSort] = useState<SortState>({ key: 'id', direction: 'desc' }),
    [mutating, setMutating] = useState<number>();
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
    UserApi.overview().then((value) => {
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
    UserApi.getUsers({
      q: search,
      role: roles,
      status: states,
      segment,
      page,
      per_page: pageSize,
      sort: sort.key,
      direction: sort.direction,
    }).then((result) => {
      if (cancelled) return;
      setUsers(result?.data ?? []);
      setPagination(result?.pagination);
      setFailed(!result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [search, roles, states, segment, page, pageSize, sort, refresh]);
  const retry = () => setRefresh((value) => value + 1);
  const pickSegment = (value: string) => {
    setSegment(value);
    setRoles(['USER']);
    setStates([]);
    setSearchInput('');
    setSearch('');
    setPage(1);
  };
  const mutate = async (user: User, role?: UserRole) => {
    if (mutating !== undefined) return;
    setMutating(user.id);
    try {
      const updated = role
        ? await UserApi.updateRole(user.id, role)
        : await UserApi.updateStatus(user.id, !user.isActive);
      if (updated) retry();
    } finally {
      setMutating(undefined);
    }
  };
  const roleField = (user: User, mobile = false) => (
    <div className={mobile ? 'customer-mobile-role list-inline-select' : 'list-inline-select'}>
      <SelectField
        label={`Vai trò của ${user.firstName} ${user.lastName}`}
        name={`role-${mobile ? 'mobile' : 'desktop'}-${user.id}`}
        value={user.role}
        disabled={user.id === actor?.id || mutating !== undefined}
        options={[
          { value: 'USER', label: 'Khách hàng' },
          { value: 'ADMIN', label: 'Quản trị viên' },
        ]}
        onChange={(event) => void mutate(user, event.target.value as UserRole)}
      />
    </div>
  );
  const columns: DataTableColumn<User>[] = [
    {
      key: 'firstName',
      header: 'Khách hàng',
      sortable: true,
      essential: true,
      className: 'list-identity-cell',
      render: (user) => (
        <div>
          <strong className="list-primary-text" title={[user.lastName, user.firstName].filter(Boolean).join(' ')}>
            {[user.lastName, user.firstName].filter(Boolean).join(' ')}
          </strong>
          <span className="list-secondary-text" title={user.email}>
            {user.email}
          </span>
          <span className="list-mobile-contact">{user.phone || 'Chưa có số điện thoại'}</span>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Liên hệ',
      className: 'customer-contact-cell',
      render: (user) => (
        <div>
          <span>{user.phone || 'Chưa có số điện thoại'}</span>
          <span className="list-secondary-text list-clamp" title={user.address || undefined}>
            {user.address || 'Chưa có địa chỉ'}
          </span>
        </div>
      ),
    },
    {
      key: 'completedOrders',
      header: 'Đơn đã giao',
      className: 'customer-purchases-cell',
      render: (user) => (
        <div>
          <strong>{user.completedOrders ?? 0}</strong>
          <span className="list-secondary-text">
            {user.lastDeliveredAt
              ? `Gần nhất ${new Date(user.lastDeliveredAt).toLocaleDateString('vi-VN')}`
              : 'Chưa có đơn đã giao'}
          </span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày đăng ký',
      sortable: true,
      className: 'customer-created-cell',
      render: (user) => new Date(user.createdAt).toLocaleDateString('vi-VN'),
    },
    { key: 'role', header: 'Vai trò', className: 'customer-role-cell', render: (user) => roleField(user) },
    {
      key: 'isActive',
      header: 'Tài khoản',
      className: 'customer-state-cell',
      render: (user) => (
        <div>
          <div className="list-account-status">
            <span className={`list-status-chip ${user.isActive ? 'is-positive' : 'is-muted'}`}>
              {user.isActive ? 'Đang hoạt động' : 'Đã khoá'}
            </span>
            {user.id !== actor?.id && (
              <button type="button" disabled={mutating !== undefined} onClick={() => void mutate(user)}>
                {mutating === user.id ? 'Đang lưu…' : user.isActive ? 'Khoá' : 'Mở khoá'}
              </button>
            )}
          </div>
          {roleField(user, true)}
        </div>
      ),
    },
  ];
  const count = (value: number | undefined) => value?.toLocaleString('vi-VN') ?? '—';
  return (
    <div
      ref={ref}
      className={`compact-admin-catalog-page catalog-workspace admin-list-workspace customer-workspace${!loading && users.length === pageSize ? ' has-full-page' : ''}`}
    >
      <h1 className="sr-only">Khách hàng</h1>
      <AdminListKpis
        loading={statsLoading}
        failed={!statsLoading && !overview}
        onRetry={retry}
        items={[
          {
            label: 'Khách có tài khoản',
            value: count(overview?.total),
            hint: 'Không gồm tài khoản quản trị',
            icon: 'users',
            active: !segment && roles.length === 1 && roles[0] === 'USER',
            onClick: () => pickSegment(''),
          },
          {
            label: 'Khách mới · 30 ngày',
            value: count(overview?.new30Days),
            hint: 'Đăng ký trong 30 ngày gần nhất',
            icon: 'calendar',
            active: segment === 'new',
            onClick: () => pickSegment('new'),
          },
          {
            label: 'Khách đã mua hàng',
            value: count(overview?.purchased),
            hint: 'Có ít nhất một đơn đã giao',
            icon: 'bag',
            active: segment === 'purchased',
            onClick: () => pickSegment('purchased'),
          },
          {
            label: 'Khách quay lại',
            value: count(overview?.repeat),
            hint: 'Có từ hai đơn đã giao',
            icon: 'heart',
            active: segment === 'repeat',
            onClick: () => pickSegment('repeat'),
          },
        ]}
      />
      <div className="compact-catalog-results">
        {failed && (
          <div className="admin-load-error" role="alert">
            Không tải được danh sách khách hàng. <button onClick={retry}>Thử lại</button>
          </div>
        )}
        <DataTable
          title="Danh sách khách hàng"
          compactRows
          mergeToolbar
          summary={
            <span className="catalog-product-count">
              <strong>{count(pagination?.total)}</strong> tài khoản
              {segment && (
                <small>
                  {segment === 'new'
                    ? 'Khách mới trong 30 ngày'
                    : segment === 'repeat'
                      ? 'Khách quay lại'
                      : 'Khách đã mua hàng'}
                </small>
              )}
            </span>
          }
          paginationSummary={
            pagination
              ? `Trang ${page} / ${Math.max(1, pagination.totalPages)} · ${pagination.total.toLocaleString('vi-VN')} tài khoản`
              : undefined
          }
          actions={
            <>
              <input
                type="search"
                className={inputClassName}
                aria-label="Tìm khách hàng"
                placeholder="Tìm tên, email, số điện thoại…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <FilterMultiSelect
                label="Loại tài khoản"
                placeholder="Tất cả tài khoản"
                clearLabel="Bỏ lựa chọn"
                values={roles}
                options={[
                  { value: 'USER', label: 'Khách hàng' },
                  { value: 'ADMIN', label: 'Quản trị viên' },
                ]}
                onChange={(values) => {
                  setRoles(values as UserRole[]);
                  setSegment('');
                  setPage(1);
                }}
              />
              <FilterMultiSelect
                label="Trạng thái tài khoản"
                placeholder="Mọi trạng thái"
                clearLabel="Bỏ lựa chọn"
                values={states}
                options={[
                  { value: 'active', label: 'Đang hoạt động' },
                  { value: 'blocked', label: 'Đã khoá' },
                ]}
                onChange={(values) => {
                  setStates(values);
                  setPage(1);
                }}
              />
              {(segment || searchInput || states.length > 0 || roles.length !== 1 || roles[0] !== 'USER') && (
                <button className="list-clear-filter" onClick={() => pickSegment('')}>
                  Xoá lọc
                </button>
              )}
            </>
          }
          columns={columns}
          data={users}
          rowKey={(user) => user.id}
          loading={loading}
          emptyText={failed ? 'Không tải được dữ liệu' : 'Không có tài khoản phù hợp'}
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
