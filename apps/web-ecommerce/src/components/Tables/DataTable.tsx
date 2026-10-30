'use client';

import React, { useEffect, useId, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import useLocalStorage from '@/hooks/useLocalStorage';
import type { Pagination, SortState } from '@/shared/types/pagination';
import AdminIcon from '@/components/Admin/AdminIcon';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  sortable?: boolean;
  className?: string;
  essential?: boolean;
  selection?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  compactRows?: boolean;
  mergeToolbar?: boolean;
  summary?: React.ReactNode;
  paginationSummary?: React.ReactNode;
}

const SortIndicator = ({ direction }: { direction?: 'asc' | 'desc' }) => (
  <span className="ml-1 inline-flex flex-col text-[8px] leading-[8px]">
    <span className={direction === 'asc' ? 'text-brand-hover' : 'opacity-40'}>▲</span>
    <span className={direction === 'desc' ? 'text-brand-hover' : 'opacity-40'}>▼</span>
  </span>
);

// Sorting and pagination remain server-driven through the parent's callbacks.
function DataTable<T>({
  columns,
  data,
  rowKey,
  title,
  actions,
  loading = false,
  emptyText,
  onRowClick,
  sort,
  onSortChange,
  pagination,
  onPageChange,
  compactRows = false,
  mergeToolbar = false,
  summary,
  paginationSummary,
}: DataTableProps<T>) {
  const t = useTranslations('dataTable');
  const ux = useTranslations('commerceUX');
  const pathname = usePathname();
  const tableId = useId();
  const pickerRef = useRef<HTMLDetailsElement>(null);
  const [compact, setCompact] = useLocalStorage('mu-admin-table-compact', false);
  // Store presentation preferences only. The schema suffix prevents preferences leaking between tables on a route.
  const [hidden, setHidden] = useLocalStorage<string[]>(
    `mu-table-columns:${pathname}:${columns.map((c) => c.key).join(',')}`,
    [],
  );
  const hiddenKeys = Array.isArray(hidden) ? hidden : [];
  const visibleColumns = columns.filter(
    (column, index) => index === 0 || column.essential || !hiddenKeys.includes(column.key),
  );
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) pickerRef.current.open = false;
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);
  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable || !onSortChange) return;
    const direction = sort?.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ key: column.key, direction });
  };

  return (
    <div
      className={`admin-table${compactRows || compact === true ? ' is-compact' : ''}${mergeToolbar ? ' has-merged-toolbar' : ''}`}
      aria-busy={loading}
    >
      {!mergeToolbar && (title || actions) && (
        <div className="admin-table-toolbar">
          {title && <h2>{title}</h2>}
          {actions && <div className="admin-table-actions">{actions}</div>}
        </div>
      )}

      <div className="admin-table-viewbar">
        <span role="status" aria-live="polite">
          {loading ? t('loading') : (summary ?? ux('recordCount', { count: pagination?.total ?? data.length }))}
        </span>
        {mergeToolbar && actions && <div className="admin-table-actions">{actions}</div>}
        <div className="admin-table-viewtools">
          {!compactRows && (
            <button type="button" aria-pressed={compact === true} onClick={() => setCompact(compact !== true)}>
              <AdminIcon name="density" size={16} />
              {ux('compactRows')}
            </button>
          )}
          <details
            ref={pickerRef}
            className="admin-column-picker"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
              }
            }}
          >
            <summary>
              <AdminIcon name="columns" size={16} />
              {ux('columns')}
            </summary>
            <fieldset>
              <legend className="sr-only">{ux('columns')}</legend>
              {columns
                .filter((column) => !column.selection)
                .map((column, index) => (
                  <label key={column.key}>
                    <input
                      type="checkbox"
                      checked={index === 0 || column.essential || !hiddenKeys.includes(column.key)}
                      disabled={index === 0 || column.essential}
                      onChange={(event) =>
                        setHidden(
                          event.target.checked
                            ? hiddenKeys.filter((key) => key !== column.key)
                            : [...hiddenKeys, column.key],
                        )
                      }
                    />
                    <span>{column.header}</span>
                  </label>
                ))}
              <button type="button" onClick={() => setHidden([])}>
                {ux('restoreColumns')}
              </button>
            </fieldset>
          </details>
        </div>
      </div>

      <div
        className="admin-table-scroll max-w-full overflow-x-auto"
        role="region"
        aria-label={typeof title === 'string' ? title : ux('tableRegion')}
        tabIndex={0}
      >
        <table id={tableId} className="w-full table-auto">
          {typeof title === 'string' && <caption className="sr-only">{title}</caption>}
          <thead>
            <tr className="bg-gray-2 text-left dark:bg-meta-4">
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    column.sortable
                      ? sort?.key === column.key
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                  className={`px-4 py-4 font-medium text-black dark:text-white ${
                    column.sortable && onSortChange ? 'cursor-pointer select-none' : ''
                  } ${column.className || ''}`}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      disabled={loading}
                      className="inline-flex items-center text-left"
                      onClick={() => handleSort(column)}
                    >
                      {column.header}
                      <SortIndicator direction={sort?.key === column.key ? sort.direction : undefined} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-10 text-center">
                  <span
                    role="status"
                    aria-label={t('loading')}
                    className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-t-transparent"
                  />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-10 text-center text-body dark:text-bodydark">
                  <div className="admin-table-empty">
                    <AdminIcon name="box" size={32} />
                    <p>{emptyText ?? t('empty')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-stroke dark:border-strokedark ${
                    onRowClick ? 'cursor-pointer hover:bg-gray-2 dark:hover:bg-meta-4' : ''
                  }`}
                >
                  {visibleColumns.map((column, index) => (
                    <td
                      key={column.key}
                      className={`px-4 py-4 text-black dark:text-bodydark1 ${column.className || ''}`}
                    >
                      {onRowClick && index === visibleColumns.findIndex((item) => !item.selection) ? (
                        <button
                          type="button"
                          aria-label={t('openRecord', { id: String(rowKey(row)) })}
                          className="text-left underline decoration-dotted underline-offset-4 focus-visible:outline focus-visible:outline-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRowClick(row);
                          }}
                        >
                          {column.render
                            ? column.render(row)
                            : String((row as Record<string, unknown>)[column.key] ?? '')}
                        </button>
                      ) : column.render ? (
                        column.render(row)
                      ) : (
                        String((row as Record<string, unknown>)[column.key] ?? '')
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && onPageChange && (
        <div className="admin-table-pagination">
          <span className="text-body dark:text-bodydark">
            {paginationSummary ??
              t('pagination', {
                page: pagination.page,
                pages: Math.max(1, pagination.totalPages),
                total: pagination.total,
              })}
          </span>
          <div className="flex items-center gap-2">
            <PageButton disabled={loading || !pagination.hasPreviousPage} onClick={() => onPageChange(1)}>
              <span aria-label={t('first')}>«</span>
            </PageButton>
            <PageButton
              disabled={loading || !pagination.hasPreviousPage}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              {t('previous')}
            </PageButton>
            <PageButton disabled={loading || !pagination.hasNextPage} onClick={() => onPageChange(pagination.page + 1)}>
              {t('next')}
            </PageButton>
            <PageButton
              disabled={loading || !pagination.hasNextPage}
              onClick={() => onPageChange(pagination.totalPages)}
            >
              <span aria-label={t('last')}>»</span>
            </PageButton>
          </div>
        </div>
      )}
    </div>
  );
}

const PageButton = ({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className="rounded border border-stroke px-3 py-1.5 font-medium text-black hover:border-brand-hover hover:text-brand-hover disabled:cursor-not-allowed disabled:opacity-40 dark:border-strokedark dark:text-white"
  >
    {children}
  </button>
);

export default DataTable;
