'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { MAX_PRODUCT_BULK } from '@/shared/product-bulk';
import ProductBulkActions, { BulkCheckbox, type SelectedBulkProduct } from '../components/ProductBulkActions';
import { useProductConditions } from '@/shared/client/hooks/useProductConditions';
import { useEffect, useState } from 'react';
import Link from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';

import DataTable, { DataTableColumn } from '@/components/Tables/DataTable';
import { inputClassName } from '@/components/FormElements/TextField';
import ProductImage from '@/components/ProductImage';
import ProductApi, { AdminProductListParams } from '@/core/client/api/Product';
import InventoryStats from '../components/InventoryStats';
import { formatVND } from '@/shared/server/utils/utils';
import type { Pagination, SortState } from '@/shared/types/pagination';
import type { AdminProductListItem, AdminCatalogSummary } from '@/shared/types/product';

const PAGE_SIZE = 10;

// Set by the shop agent's inventory adjustments; such products are hidden from the storefront.
const SEARCH_DEBOUNCE_MS = 400;

const ProductList = () => {
  const router = useRouter();
  const t = useTranslations('adminProducts');
  const conditionTypes = useProductConditions();
  const bulk = useTranslations('productBulk');
  const [selected, setSelected] = useState<Record<number, SelectedBulkProduct>>({});
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [summary, setSummary] = useState<AdminCatalogSummary>();
  const [pagination, setPagination] = useState<Pagination>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const ux = useTranslations('commerceUX');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminProductListParams['status']>('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'id', direction: 'desc' });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    const loadProducts = async () => {
      setLoading(true);
      setFailed(false);
      const result = await ProductApi.getAdminProducts({
        q: search,
        status,
        page,
        per_page: PAGE_SIZE,
        sort: sort.key,
        direction: sort.direction,
      });
      if (cancelled) return;
      setFailed(!result);
      setProducts(result?.data || []);
      setPagination(result?.pagination);
      setSummary(result?.summary);
      setLoading(false);
    };
    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [search, status, page, sort, retry]);

  useEffect(() => {
    setSelected({});
  }, [searchInput, status]);
  const selectionBusy = loading || searchInput.trim() !== search;
  const eligible = products.filter((product) => !product.partnerId && !!product.updatedAt);
  const checkedOnPage = eligible.filter((product) => !!selected[product.id]).length;
  const selectProducts = (rows: AdminProductListItem[], checked: boolean) => {
    const next = { ...selected };
    for (const product of rows) {
      if (checked && !next[product.id] && !product.partnerId && product.updatedAt)
        next[product.id] = { id: product.id, name: product.name, expectedUpdatedAt: product.updatedAt };
      else if (!checked) delete next[product.id];
    }
    if (Object.keys(next).length > MAX_PRODUCT_BULK) {
      toast.error(bulk('limit', { count: MAX_PRODUCT_BULK }));
      return;
    }
    setSelected(next);
  };
  const columns: DataTableColumn<AdminProductListItem>[] = [
    {
      key: 'selection',
      essential: true,
      selection: true,
      className: 'product-bulk-select-cell',
      header: (
        <BulkCheckbox
          label={bulk('selectPage')}
          checked={eligible.length > 0 && checkedOnPage === eligible.length}
          mixed={checkedOnPage > 0 && checkedOnPage < eligible.length}
          disabled={selectionBusy || !eligible.length}
          onChange={(checked) => selectProducts(eligible, checked)}
        />
      ),
      render: (product) => (
        <BulkCheckbox
          label={bulk('selectProduct', { name: product.name })}
          checked={!!selected[product.id]}
          disabled={selectionBusy || !!product.partnerId || !product.updatedAt}
          onChange={(checked) => selectProducts([product], checked)}
        />
      ),
    },
    {
      key: 'imageUrl',
      essential: true,
      header: t('image'),
      render: (product) => (
        <div className="relative h-14 w-14 overflow-hidden rounded bg-gray-2 dark:bg-meta-4">
          <ProductImage src={product.imageUrl} alt={product.name} sizes="56px" />
        </div>
      ),
    },
    { key: 'id', header: 'ID', sortable: true },
    {
      key: 'name',
      essential: true,
      header: t('name'),
      sortable: true,
      className: 'min-w-[240px]',
      render: (product) => (
        <div>
          <Link
            href={`/admin/products/${product.id}`}
            onClick={(event) => event.stopPropagation()}
            className="font-medium hover:underline"
          >
            {product.name}
          </Link>
          <p className="text-sm text-body">SKU: {product.sku}</p>
        </div>
      ),
    },
    {
      // Every condition the model is stocked in (main listing and condition options), with a price only when available.
      key: 'conditions',
      header: t('conditionColumn'),
      render: (product) => (
        <div className="catalog-condition-summary">
          {(product.conditions ?? []).map((summary) => (
            <div key={summary.condition}>
              <span
                className={`condition-chip is-${summary.condition}`}
                title={conditionTypes.label(summary.condition)}
              >
                {conditionTypes.label(summary.condition)}
              </span>
            </div>
          ))}
          {!!product.conditionLabels?.length && (
            <span className="catalog-combination-label" title={product.conditionLabels.join(' · ')}>
              {product.conditionLabels.join(' · ')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Giá bán thực S',
      className: 'catalog-price-cell',
      sortable: true,
      render: (product) => (
        <div className="catalog-price-summary">
          <p>{formatVND(product.pricingReferenceMemberVnd ?? product.salePrice, 'vi')}</p>
          {product.discountPercent > 0 && (
            <p className="text-xs text-body">
              <span className="line-through">{formatVND(product.price, 'vi')}</span> -
              {Math.round(product.discountPercent)}%
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'stock',
      header: t('stock'),
      className: 'catalog-stock-cell',
      sortable: true,
      render: (product) => (
        <div>
          <span className={product.stock === 0 ? 'text-danger' : ''}>{product.stock}</span>
          {product.groupStock !== undefined && product.groupStock !== product.stock && (
            <p className="text-xs text-body">
              {t('groupStock')}: {product.groupStock}
            </p>
          )}
        </div>
      ),
    },
    { key: 'sold', header: t('sold'), sortable: true, className: 'catalog-number-cell' },
    {
      key: 'productionDate',
      className: 'catalog-date-cell',
      header: t('receivedDate'),
      sortable: true,
      render: (product) =>
        product.productionDate ? new Date(product.productionDate).toLocaleDateString('vi-VN') : '—',
    },
    {
      key: 'isArchived',
      header: t('status'),
      className: 'catalog-status-cell',
      render: (product) => (
        <div className="catalog-status-badges">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              product.isArchived ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
            }`}
          >
            {product.isArchived ? t('archived') : t('active')}
          </span>
          {product.isFeatured && (
            <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
              {t('featured')}
            </span>
          )}
          {product.inventoryStatus !== 'available' && (
            <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger">
              {t(`inventoryStates.${product.inventoryStatus}`)}
            </span>
          )}
          {product.salesChannel === 'outlet' && (
            <span className="rounded-full bg-meta-5/10 px-3 py-1 text-xs font-medium text-meta-5">Outlet</span>
          )}
        </div>
      ),
    },
  ];

  const count = (value: number) => value.toLocaleString('vi-VN');
  return (
    <div className="compact-admin-catalog-page catalog-workspace">
      <h1 className="sr-only">{t('title')}</h1>
      <InventoryStats compact refreshKey={retry} />
      <div className="compact-catalog-results">
        {failed && (
          <div role="alert" className="admin-load-error">
            <span>{ux('loadFailed')}</span>
            <button type="button" onClick={() => setRetry((value) => value + 1)}>
              {ux('retry')}
            </button>
          </div>
        )}
        <DataTable
          title={t('list')}
          compactRows
          mergeToolbar
          summary={
            summary ? (
              <span className="catalog-product-count">
                <strong>{count(summary.models)}</strong> mẫu / <strong>{count(summary.products)}</strong> sản phẩm{' '}
                <small>theo tình trạng</small>
              </span>
            ) : (
              '0 sản phẩm'
            )
          }
          paginationSummary={
            pagination
              ? `Trang ${pagination.page} / ${Math.max(1, pagination.totalPages)} · ${count(pagination.total)} sản phẩm`
              : undefined
          }
          actions={
            <>
              <input
                type="search"
                className={`${inputClassName} !py-2 sm:w-64`}
                placeholder={t('search')}
                aria-label={t('search')}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <select
                className={`${inputClassName} !py-2 sm:w-40`}
                aria-label={t('status')}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AdminProductListParams['status']);
                  setPage(1);
                }}
              >
                <option value="">{t('allStatuses')}</option>
                <option value="active">{t('active')}</option>
                <option value="archived">{t('archived')}</option>
                <option value="featured">{t('featured')}</option>
                <option value="held">{t('held')}</option>
              </select>
              <Link href="/admin/products/new" className="catalog-create-button">
                + {t('create')}
              </Link>
            </>
          }
          columns={columns}
          data={products}
          rowKey={(product) => product.id}
          loading={loading}
          emptyText={failed ? ux('loadFailed') : t('empty')}
          onRowClick={(product) => router.push(`/admin/products/${product.id}`)}
          sort={sort}
          onSortChange={(nextSort) => {
            setSort(nextSort);
            setPage(1);
          }}
          pagination={pagination}
          onPageChange={setPage}
        />
      </div>
      <ProductBulkActions
        selected={Object.values(selected)}
        onClear={() => setSelected({})}
        onFinished={() => {
          setSelected({});
          setRetry((value) => value + 1);
        }}
      />
    </div>
  );
};

export default ProductList;
