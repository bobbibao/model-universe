'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useProductConditions } from '@/shared/client/hooks/useProductConditions';
import { useEffect, useState } from 'react';
import Link from '@/i18n/navigation';
import { useRouter } from '@/i18n/navigation';

import WorkspaceTabs from '@/components/Store/WorkspaceTabs';
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb';
import DataTable, { DataTableColumn } from '@/components/Tables/DataTable';
import { inputClassName } from '@/components/FormElements/TextField';
import ProductImage from '@/components/ProductImage';
import ProductApi, { AdminProductListParams } from '@/core/client/api/Product';
import CategoryApi from '@/core/client/api/Category';
import InventoryStats from '../components/InventoryStats';
import { formatVND } from '@/shared/server/utils/utils';
import type { Pagination, SortState } from '@/shared/types/pagination';
import type { AdminProductListItem, Category } from '@/shared/types/product';

const PAGE_SIZE = 10;

// Set by the shop agent's inventory adjustments; such products are hidden from the storefront.
const SEARCH_DEBOUNCE_MS = 400;

const ProductList = () => {
  const router = useRouter();
  const [catalogTab, setCatalogTab] = useState('catalog');
  const t = useTranslations('adminProducts'),
    catalog = useTranslations('catalog'),
    locale = useLocale();
  const conditionTypes = useProductConditions();
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState<Pagination>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const ux = useTranslations('commerceUX');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [status, setStatus] = useState<AdminProductListParams['status']>('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'id', direction: 'desc' });

  useEffect(() => {
    CategoryApi.getAdminCategories().then((result) => setCategories(result || []));
  }, []);

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
        categoryId,
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
      setLoading(false);
    };
    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [search, categoryId, status, page, sort, retry]);

  const columns: DataTableColumn<AdminProductListItem>[] = [
    {
      key: 'imageUrl',
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
      // Every condition the model is stocked in (main listing and condition options), with its units.
      key: 'conditions',
      header: t('conditionColumn'),
      render: (product) => (
        <div className="catalog-condition-summary">
          {(product.conditions ?? []).map((summary) => (
            <div key={summary.condition}>
              <span className={`condition-chip is-${summary.condition}`}>
                {conditionTypes.label(summary.condition)}
              </span>
              <span className={summary.stock === 0 ? 'is-empty' : ''} aria-label={`${t('stock')}: ${summary.stock}`}>
                {summary.stock}
              </span>
              <small>
                {summary.stock > 0
                  ? catalog('fromPrice', { price: formatVND(summary.minSalePrice, locale) })
                  : catalog('conditionSoldOut')}
              </small>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'price',
      header: t('price'),
      sortable: true,
      render: (product) => (
        <div className="catalog-price-summary">
          <p>{formatVND(product.salePrice, locale)}</p>
          {product.discountPercent > 0 && (
            <p className="text-xs text-body">
              <span className="line-through">{formatVND(product.price, locale)}</span> -
              {Math.round(product.discountPercent)}%
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'stock',
      header: t('stock'),
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
    { key: 'sold', header: t('sold'), sortable: true },
    {
      key: 'productionDate',
      header: t('receivedDate'),
      sortable: true,
      render: (product) =>
        product.productionDate
          ? new Date(product.productionDate).toLocaleDateString(locale === 'en' ? 'en-GB' : 'vi-VN')
          : '—',
    },
    {
      key: 'isArchived',
      header: t('status'),
      render: (product) => (
        <div className="flex flex-wrap gap-1">
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

  return (
    <div className="compact-admin-catalog-page">
      <Breadcrumb pageName={t('title')} />
      <WorkspaceTabs
        className="compact-catalog-tabs"
        label={ux('catalogWorkspace')}
        value={catalogTab}
        onChange={setCatalogTab}
        tabs={[
          {
            id: 'catalog',
            label: t('list'),
            content: (
              <div className="compact-catalog-results">
                {' '}
                {failed && (
                  <div role="alert" className="admin-load-error">
                    <span>{ux('loadFailed')}</span>
                    <button type="button" onClick={() => setRetry((value) => value + 1)}>
                      {ux('retry')}
                    </button>
                  </div>
                )}
                {(searchInput || categoryId || status) && (
                  <div className="admin-filter-summary">
                    <span>{ux('filteredRecords')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        setSearch('');
                        setCategoryId('');
                        setStatus('');
                        setPage(1);
                      }}
                    >
                      {ux('clearFilters')}
                    </button>
                  </div>
                )}
                <DataTable
                  title={t('list')}
                  actions={
                    <>
                      <input
                        className={`${inputClassName} !py-2 sm:w-64`}
                        placeholder={t('search')}
                        aria-label={t('search')}
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                      />
                      <select
                        className={`${inputClassName} !py-2 sm:w-44`}
                        aria-label={t('category')}
                        value={categoryId}
                        onChange={(event) => {
                          setCategoryId(event.target.value ? Number(event.target.value) : '');
                          setPage(1);
                        }}
                      >
                        <option value="">{t('allCategories')}</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
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
                      <Link
                        href="/admin/products/new"
                        className="rounded-md bg-brand px-4 py-2 font-semibold text-brand-ink hover:bg-brand-hover"
                      >
                        {t('create')}
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
            ),
          },
          { id: 'inventory', label: t('stats.title'), content: <InventoryStats expanded /> },
        ]}
      />
    </div>
  );
};

export default ProductList;
