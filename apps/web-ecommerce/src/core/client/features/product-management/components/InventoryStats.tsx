'use client';

import { useTranslations } from 'next-intl';
import { useProductConditions } from '@/shared/client/hooks/useProductConditions';
import { useEffect, useState } from 'react';
import ProductApi from '@/core/client/api/Product';
import { formatVND } from '@/shared/server/utils/utils';
import type { InventoryStats as Stats } from '@/shared/types/product';
import AdminIcon from '@/components/Admin/AdminIcon';

const Kpi = ({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn';
  icon?: string;
}) => (
  <div className={`inventory-kpi${tone === 'warn' ? ' is-warn' : ''}${icon ? ` has-icon is-${icon}` : ''}`}>
    <p className="inventory-kpi-label">
      {icon && (
        <span className="inventory-kpi-icon">
          <AdminIcon name={icon} size={16} />
        </span>
      )}
      {label}
    </p>
    <p className="inventory-kpi-value">{value}</p>
    {hint && <p className="inventory-kpi-hint">{hint}</p>}
  </div>
);

// "Thống kê kho" above the product list: units on hand, products declared, stock at cost and at the suggested selling
// price, and the same per brand and per condition.
const InventoryStats = ({
  expanded = false,
  compact = false,
  refreshKey = 0,
}: {
  expanded?: boolean;
  compact?: boolean;
  refreshKey?: number;
}) => {
  const t = useTranslations('adminProducts.stats');
  const conditionTypes = useProductConditions();
  const [stats, setStats] = useState<Stats>();
  useEffect(() => {
    let cancelled = false;
    ProductApi.getInventoryStats().then((value) => {
      if (!cancelled) setStats(value);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  if (!stats)
    return (
      <div className="inventory-kpis inventory-kpis-loading" role="status">
        Đang tải thống kê tồn kho…
      </div>
    );
  const count = (value: number) => value.toLocaleString('vi-VN');
  const { totals } = stats;
  if (compact)
    return (
      <section className="catalog-inventory-overview" aria-label="Tổng quan tồn kho">
        <div className="inventory-kpis">
          <Kpi
            icon="box"
            label="Số lượng tồn kho"
            value={count(totals.stock)}
            hint={`${count(totals.listings)} mẫu · ${count(totals.listings + totals.options)} sản phẩm theo tình trạng`}
          />
          <Kpi
            icon="bag"
            label="Giá trị bán dự kiến"
            value={formatVND(totals.memberValue, 'vi')}
            hint="Theo giá bán hiện tại"
          />
          <Kpi
            icon="shield"
            label="Vốn hàng tồn kho"
            value={formatVND(totals.costValue, 'vi')}
            hint={
              totals.missingCost ? `${count(totals.missingCost)} sản phẩm tồn chưa nhập vốn` : 'Theo giá vốn đã nhập'
            }
            tone={totals.missingCost ? 'warn' : undefined}
          />
          <Kpi
            icon="chart"
            label="Lãi gộp dự kiến"
            value={formatVND(totals.marginValue, 'vi')}
            hint="Chưa trừ ưu đãi và chi phí"
          />
        </div>
      </section>
    );
  return (
    <details className="inventory-stats" open={expanded}>
      <summary>
        <span>{t('title')}</span>
        <small>{t('note')}</small>
        <span className="inventory-summary-snapshot">
          <span>
            {t('stock')} <strong>{count(totals.stock)}</strong>
          </span>
          <span>
            {t('listings')} <strong>{count(totals.listings)}</strong>
          </span>
          <span>
            {t('costValue')} <strong>{formatVND(totals.costValue, 'vi')}</strong>
          </span>
        </span>
      </summary>
      <div className="inventory-kpis">
        <Kpi label={t('stock')} value={count(totals.stock)} hint={t('stockHint')} />
        <Kpi
          label={t('listings')}
          value={count(totals.listings)}
          hint={t('listingsHint', { options: totals.options, names: totals.names })}
        />
        <Kpi
          label={t('unitsInStock')}
          value={count(totals.unitsInStock)}
          hint={t('unitsInStockHint', { out: totals.unitsOutOfStock })}
        />
        <Kpi label={t('brands')} value={count(totals.brands)} />
        <Kpi label={t('costValue')} value={formatVND(totals.costValue, 'vi')} hint={t('costValueHint')} />
        <Kpi
          label={t('memberValue')}
          value={formatVND(totals.memberValue, 'vi')}
          hint={`${t('memberValueHint')} · ${t('listValue', { value: formatVND(totals.listValue, 'vi') })}`}
        />
        <Kpi label={t('marginValue')} value={formatVND(totals.marginValue, 'vi')} hint={t('marginValueHint')} />
        <Kpi label={t('averageDays')} value={count(totals.averageDaysInStock)} hint={t('averageDaysHint')} />
        {totals.missingCost > 0 && <Kpi label={t('missingCost')} value={count(totals.missingCost)} tone="warn" />}
      </div>
      <div className="inventory-tables">
        <table>
          <caption>{t('byBrand')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('brand')}</th>
              <th scope="col">Mẫu</th>
              <th scope="col">{t('rowsInStock')}</th>
              <th scope="col">{t('stockUnits')}</th>
              <th scope="col">{t('value')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.brands.map((row) => (
              <tr key={row.brand}>
                <th scope="row">{row.brand}</th>
                <td>{count(row.listings)}</td>
                <td>{count(row.unitsInStock)}</td>
                <td>{count(row.stock)}</td>
                <td>{formatVND(row.costValue, 'vi')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <caption>{t('byCondition')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('condition')}</th>
              <th scope="col">Sản phẩm</th>
              <th scope="col">{t('rowsInStock')}</th>
              <th scope="col">{t('stockUnits')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.conditions.map((row) => (
              <tr key={row.condition}>
                <th scope="row">
                  <span className={`condition-chip is-${row.condition}`}>{conditionTypes.label(row.condition)}</span>
                </th>
                <td>{count(row.units)}</td>
                <td>{count(row.unitsInStock)}</td>
                <td>{count(row.stock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
};

export default InventoryStats;
