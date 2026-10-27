'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Link from '@/i18n/navigation';
import RecommendationApi, { type AdminRecommendationAnalyticsResponse } from '@/core/client/api/Recommendation';
import {
  DEFAULT_RECOMMENDATION_CONFIG,
  type RecommendationConfig,
} from '@/shared/smart-recommendations';
import { formatVND as formatPrice } from '@/shared/server/utils/utils';

const WEIGHT_KEYS: Array<keyof RecommendationConfig['weights']> = [
  'relevance',
  'preference',
  'cooccurrence',
  'popularity',
  'business',
];

export default function AdminRecommendations() {
  const t = useTranslations('adminRecommendations');
  const tSmart = useTranslations('smartRecs');
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AdminRecommendationAnalyticsResponse | null>(null);
  const [config, setConfig] = useState<RecommendationConfig>(DEFAULT_RECOMMENDATION_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const load = useCallback(async (windowDays: number) => {
    setLoading(true);
    const res = await RecommendationApi.getAdminAnalytics(windowDays);
    if (res) {
      setData(res);
      setConfig(res.config);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const updated = await RecommendationApi.updateAdminConfig(config);
      if (updated) {
        setConfig(updated);
        toast.success(t('saveSuccess'));
        void load(days);
      }
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setConfig({
      ...DEFAULT_RECOMMENDATION_CONFIG,
      weights: { ...DEFAULT_RECOMMENDATION_CONFIG.weights },
    });
  };

  return (
    <div className="admin-recommendations-workspace space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stroke pb-4 dark:border-strokedark">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">{t('eyebrow')}</p>
          <h1 className="text-2xl font-bold text-black dark:text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-body dark:text-bodydark">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                days === d
                  ? 'bg-brand text-white'
                  : 'border border-stroke bg-white text-black hover:bg-gray-2 dark:border-strokedark dark:bg-boxdark dark:text-white'
              }`}
            >
              {d} {t('days')}
            </button>
          ))}
        </div>
      </header>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-lg border border-stroke bg-white p-4 shadow-sm dark:border-strokedark dark:bg-boxdark">
          <span className="text-xs font-medium text-body dark:text-bodydark">{t('kpi.impressions')}</span>
          <p className="mt-1 text-2xl font-bold text-black dark:text-white">
            {loading ? '…' : (data?.totals.impressions ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-stroke bg-white p-4 shadow-sm dark:border-strokedark dark:bg-boxdark">
          <span className="text-xs font-medium text-body dark:text-bodydark">{t('kpi.clicks')}</span>
          <p className="mt-1 text-2xl font-bold text-black dark:text-white">
            {loading ? '…' : (data?.totals.clicks ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-stroke bg-white p-4 shadow-sm dark:border-strokedark dark:bg-boxdark">
          <span className="text-xs font-medium text-body dark:text-bodydark">{t('kpi.ctr')}</span>
          <p className="mt-1 text-2xl font-bold text-brand">
            {loading ? '…' : `${data?.totals.ctrPercent ?? 0}%`}
          </p>
        </div>
        <div className="rounded-lg border border-stroke bg-white p-4 shadow-sm dark:border-strokedark dark:bg-boxdark">
          <span className="text-xs font-medium text-body dark:text-bodydark">{t('kpi.addToCarts')}</span>
          <p className="mt-1 text-2xl font-bold text-black dark:text-white">
            {loading ? '…' : (data?.totals.addToCarts ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-stroke bg-white p-4 shadow-sm dark:border-strokedark dark:bg-boxdark">
          <span className="text-xs font-medium text-body dark:text-bodydark">{t('kpi.behaviorSignals')}</span>
          <p className="mt-1 text-2xl font-bold text-black dark:text-white">
            {loading ? '…' : (data?.totals.behaviorSignals ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-stroke bg-white p-4 shadow-sm dark:border-strokedark dark:bg-boxdark">
          <span className="text-xs font-medium text-body dark:text-bodydark">{t('kpi.uniqueSessions')}</span>
          <p className="mt-1 text-2xl font-bold text-black dark:text-white">
            {loading ? '…' : (data?.totals.uniqueSessions ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Strategy & Surface Breakdown */}
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-lg border border-stroke bg-white p-5 shadow-sm dark:border-strokedark dark:bg-boxdark">
            <h2 className="mb-3 text-lg font-semibold text-black dark:text-white">{t('strategyBreakdownTitle')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stroke text-xs uppercase text-body dark:border-strokedark dark:text-bodydark">
                    <th className="py-2 pr-4">{t('col.strategy')}</th>
                    <th className="py-2 px-3 text-right">{t('col.impressions')}</th>
                    <th className="py-2 px-3 text-right">{t('col.clicks')}</th>
                    <th className="py-2 px-3 text-right">{t('col.addToCarts')}</th>
                    <th className="py-2 pl-3 text-right">{t('col.ctr')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byStrategy ?? []).map((row) => (
                    <tr key={row.strategy} className="border-b border-stroke/60 last:border-0 dark:border-strokedark/60">
                      <td className="py-2.5 pr-4 font-medium text-black dark:text-white">
                        {tSmart(`strategy.${row.strategy}`)}
                      </td>
                      <td className="py-2.5 px-3 text-right">{row.impressions.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right">{row.clicks.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right">{row.addToCarts.toLocaleString()}</td>
                      <td className="py-2.5 pl-3 text-right font-semibold text-brand">{row.ctrPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-stroke bg-white p-5 shadow-sm dark:border-strokedark dark:bg-boxdark">
            <h2 className="mb-3 text-lg font-semibold text-black dark:text-white">{t('topProductsTitle')}</h2>
            {data?.topProducts && data.topProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stroke text-xs uppercase text-body dark:border-strokedark dark:text-bodydark">
                      <th className="py-2 pr-4">{t('col.product')}</th>
                      <th className="py-2 px-3 text-right">{t('col.price')}</th>
                      <th className="py-2 px-3 text-right">{t('col.stock')}</th>
                      <th className="py-2 px-3 text-right">{t('col.impressions')}</th>
                      <th className="py-2 px-3 text-right">{t('col.clicks')}</th>
                      <th className="py-2 pl-3 text-right">{t('col.ctr')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((p) => (
                      <tr key={p.productId} className="border-b border-stroke/60 last:border-0 dark:border-strokedark/60">
                        <td className="py-2.5 pr-4">
                          <Link
                            href={`/san-pham/${p.slug || p.productId}`}
                            className="font-medium text-black hover:text-brand dark:text-white"
                          >
                            {p.name}
                          </Link>
                          <span className="ml-2 text-xs text-body dark:text-bodydark">
                            {[p.brandName, p.scale].filter(Boolean).join(' · ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">{formatPrice(p.price)}</td>
                        <td className="py-2.5 px-3 text-right">{p.stock}</td>
                        <td className="py-2.5 px-3 text-right">{p.impressions}</td>
                        <td className="py-2.5 px-3 text-right">{p.clicks}</td>
                        <td className="py-2.5 pl-3 text-right font-semibold text-brand">{p.ctrPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-body dark:text-bodydark">{t('emptyTopProducts')}</p>
            )}
          </section>

          <section className="rounded-lg border border-stroke bg-white p-5 shadow-sm dark:border-strokedark dark:bg-boxdark">
            <h2 className="mb-3 text-lg font-semibold text-black dark:text-white">{t('topSearchesTitle')}</h2>
            {data?.topSearchQueries && data.topSearchQueries.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.topSearchQueries.map((sq) => (
                  <span
                    key={sq.query}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stroke bg-gray-2 px-3 py-1 text-xs font-medium text-black dark:border-strokedark dark:bg-meta-4 dark:text-white"
                  >
                    <span>“{sq.query}”</span>
                    <strong className="text-brand">×{sq.count}</strong>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-body dark:text-bodydark">{t('emptySearches')}</p>
            )}
          </section>
        </div>

        {/* Configuration Panel */}
        <aside className="rounded-lg border border-stroke bg-white p-5 shadow-sm dark:border-strokedark dark:bg-boxdark">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black dark:text-white">{t('configTitle')}</h2>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs font-medium text-brand hover:underline"
            >
              {t('resetDefaults')}
            </button>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-black dark:text-white">
              <span>{t('config.enabled')}</span>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="h-4 w-4 accent-brand"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm font-medium text-black dark:text-white">
              <span>{t('config.enablePreowned')}</span>
              <input
                type="checkbox"
                checked={config.preferInStockPreowned}
                onChange={(e) => setConfig({ ...config, preferInStockPreowned: e.target.checked })}
                className="h-4 w-4 accent-brand"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm font-medium text-black dark:text-white">
              <span>{t('config.enableFreeshipGap')}</span>
              <input
                type="checkbox"
                checked={config.enableFreeshipGapAddons}
                onChange={(e) => setConfig({ ...config, enableFreeshipGapAddons: e.target.checked })}
                className="h-4 w-4 accent-brand"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-body dark:text-bodydark" htmlFor="rec-default-limit">
                  {t('config.defaultLimit')}
                </label>
                <input
                  id="rec-default-limit"
                  type="number"
                  min={1}
                  max={24}
                  value={config.defaultLimit}
                  onChange={(e) =>
                    setConfig({ ...config, defaultLimit: Math.max(1, Math.min(24, Number(e.target.value) || 8)) })
                  }
                  className="mt-1 w-full rounded border border-stroke bg-transparent px-3 py-1.5 text-sm dark:border-strokedark"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body dark:text-bodydark" htmlFor="rec-diversity-cap">
                  {t('config.maxPerBrandScale')}
                </label>
                <input
                  id="rec-diversity-cap"
                  type="number"
                  min={1}
                  max={8}
                  value={config.maxPerBrandScale}
                  onChange={(e) =>
                    setConfig({ ...config, maxPerBrandScale: Math.max(1, Math.min(8, Number(e.target.value) || 2)) })
                  }
                  className="mt-1 w-full rounded border border-stroke bg-transparent px-3 py-1.5 text-sm dark:border-strokedark"
                />
              </div>
            </div>

            <div className="border-t border-stroke pt-4 dark:border-strokedark">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-body dark:text-bodydark">
                {t('config.weightsTitle')}
              </h3>
              <div className="space-y-3">
                {WEIGHT_KEYS.map((key) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs font-medium text-black dark:text-white">
                      <span>{t(`weights.${key}`)}</span>
                      <span>{config.weights[key].toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={config.weights[key]}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          weights: {
                            ...config.weights,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                      className="mt-1 w-full accent-brand"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSaveConfig}
              className="mt-4 w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
            >
              {saving ? t('saving') : t('saveConfig')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

