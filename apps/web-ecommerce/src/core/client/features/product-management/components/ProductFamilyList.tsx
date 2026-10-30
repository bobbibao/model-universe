'use client';
import { useEffect, useState } from 'react';
import ProductApi from '@/core/client/api/Product';
import type { AdminProductListItem, AdminProductUnit } from '@/shared/types/product';
import type { Pagination } from '@/shared/types/pagination';
import ProductImage from '@/components/ProductImage';
import Link from '@/i18n/navigation';
import { inputClassName } from '@/components/FormElements/TextField';
import { formatVND } from '@/shared/server/utils/utils';
import { itemTypeLabel } from '@/shared/condition-tree';

export default function ProductFamilyList() {
  const [rows, setRows] = useState<(AdminProductListItem & { familyUnits?: AdminProductUnit[] })[]>([]);
  const [pagination, setPagination] = useState<Pagination>();
  const [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    setLoading(true);
    const timer = setTimeout(() => {
      ProductApi.getAdminProducts({ groupByModel: true, q: query, page, per_page: 10 }).then((response) => {
        if (current) {
          setRows(response?.data ?? []);
          setPagination(response?.pagination);
          setFailed(!response);
          setLoading(false);
        }
      });
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, page, retry]);
  return (
    <div className="catalog-family-list">
      <div className="catalog-section-toolbar">
        <input
          type="search"
          className={`${inputClassName} max-w-md`}
          aria-label="Tìm mẫu mô hình hoặc SKU"
          placeholder="Tìm mẫu mô hình hoặc SKU…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
        <Link className="mu-button" href="/admin/products/new">
          + Thêm sản phẩm
        </Link>
      </div>
      {loading ? (
        <p role="status" className="condition-tree-empty">
          Đang tải…
        </p>
      ) : failed ? (
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          Không tải được. Thử lại
        </button>
      ) : !rows.length ? (
        <p className="condition-tree-empty">Không tìm thấy mẫu mô hình</p>
      ) : (
        rows.map((row) => (
          <details className="catalog-family-card" key={row.modelFamilyId ?? -row.id} open={rows.length === 1}>
            <summary>
              <span className="catalog-model-thumb">
                <ProductImage src={row.imageUrl} alt="" sizes="56px" className="object-contain" />
              </span>
              <div>
                <strong>{row.name}</strong>
                <p>
                  {row.brandName} · {row.scale} · {row.modelCode}
                </p>
              </div>
              <small>
                {row.familyUnits?.length ?? 1} SKU ·{' '}
                {row.familyUnits?.reduce((sum, unit) => sum + unit.stock, 0) ?? row.stock} tồn kho{' '}
                ⌄
              </small>
            </summary>
            <div className="catalog-variant-table-wrap">
              <table className="catalog-variant-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Loại hàng / tình trạng</th>
                    <th>Giá bán thực S</th>
                    <th>Tồn kho</th>
                    <th>Hiển thị</th>
                    <th>
                      <Link href={`/admin/products/${row.id}?section=conditions&create=1`}>
                        + Thêm tổ hợp
                      </Link>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(row.familyUnits ?? []).map((unit) => (
                    <tr key={unit.id}>
                      <td>{unit.sku}</td>
                      <td>
                        <span className={`condition-chip is-${unit.itemTypeKey ?? unit.condition}`}>
                          {itemTypeLabel(unit.itemTypeKey ?? unit.condition)}
                        </span>
                        <span className="catalog-combination-label">
                          {unit.conditionLabels?.join(' · ') || 'Không ghi nhận lỗi'}
                        </span>
                      </td>
                      <td className="catalog-money">{formatVND(unit.pricingReferenceMemberVnd ?? 0, 'vi')}</td>
                      <td>{unit.stock}</td>
                      <td>
                        <span className={`catalog-status ${unit.isArchived ? 'is-draft' : ''}`}>
                          {unit.isArchived ? 'Ẩn / nháp' : 'Đang bán'}
                        </span>
                      </td>
                      <td>
                        <Link href={`/admin/products/${unit.id}`}>Sửa ↗</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))
      )}
      {pagination && (
        <div className="catalog-pagination">
          <span>
            {pagination.page} / {Math.max(1, pagination.totalPages)}
          </span>
          <button
            type="button"
            disabled={loading || !pagination.hasPreviousPage}
            onClick={() => setPage((value) => value - 1)}
          >
            Trước
          </button>
          <button
            type="button"
            disabled={loading || !pagination.hasNextPage}
            onClick={() => setPage((value) => value + 1)}
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
