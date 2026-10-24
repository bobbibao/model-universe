'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import ProductApi from '@/core/client/api/Product';
import { formatVND } from '@/shared/server/utils/utils';
import type { InventoryStats as Stats } from '@/shared/types/product';

const Kpi = ({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' }) => (
  <div className={`inventory-kpi${tone === 'warn' ? ' is-warn' : ''}`}>
    <p className="inventory-kpi-label">{label}</p>
    <p className="inventory-kpi-value">{value}</p>
    {hint && <p className="inventory-kpi-hint">{hint}</p>}
  </div>
);

// "Thống kê kho" above the product list: units on hand, products declared, stock at cost and at the suggested selling
// price, and the same per brand and per condition.
const InventoryStats = () => {
  const t = useTranslations('adminProducts.stats'),
    catalog = useTranslations('catalog'),
    locale = useLocale();
  const [stats, setStats] = useState<Stats>();
  useEffect(() => {
    ProductApi.getInventoryStats().then(setStats);
  }, []);
  if (!stats) return null;
  const count = (value: number) => value.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN');
  const { totals } = stats;
  return (
    <details className="inventory-stats">
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
            {t('costValue')} <strong>{formatVND(totals.costValue, locale)}</strong>
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
        <Kpi label={t('costValue')} value={formatVND(totals.costValue, locale)} hint={t('costValueHint')} />
        <Kpi
          label={t('memberValue')}
          value={formatVND(totals.memberValue, locale)}
          hint={`${t('memberValueHint')} · ${t('listValue', { value: formatVND(totals.listValue, locale) })}`}
        />
        <Kpi label={t('marginValue')} value={formatVND(totals.marginValue, locale)} hint={t('marginValueHint')} />
        <Kpi label={t('averageDays')} value={count(totals.averageDaysInStock)} hint={t('averageDaysHint')} />
        {totals.missingCost > 0 && <Kpi label={t('missingCost')} value={count(totals.missingCost)} tone="warn" />}
      </div>
      <div className="inventory-tables">
        <table>
          <caption>{t('byBrand')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('brand')}</th>
              <th scope="col">{t('rows')}</th>
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
                <td>{formatVND(row.costValue, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table>
          <caption>{t('byCondition')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('condition')}</th>
              <th scope="col">{t('rows')}</th>
              <th scope="col">{t('rowsInStock')}</th>
              <th scope="col">{t('stockUnits')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.conditions.map((row) => (
              <tr key={row.condition}>
                <th scope="row">
                  <span className={`condition-chip is-${row.condition}`}>{catalog(row.condition)}</span>
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
