'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import { collectorServices, ServiceTerms } from '@/components/Services/ServiceExperience';
import ServiceHistoryHub from '@/components/Services/ServiceHistoryHub';
import ServiceFaq from '@/components/Services/ServiceFaq';
import type { ProductSummary } from '@/shared/types/product';
import Hero from '../components/Hero';

export default function CollectorServices({ product }: { product?: ProductSummary }) {
  const t = useTranslations('services');
  const experience = useTranslations('experience');
  const [activeTab, setActiveTab] = useState<'services' | 'history' | 'faq'>('services');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'history') {
        setActiveTab('history');
      } else if (tabParam === 'faq') {
        setActiveTab('faq');
      }
    }
  }, []);

  return (
    <>
      <Hero product={product} />
      <div className="mu-wrap store-workspace service-hub-compact">
        {/* Top-Level Navigation Tabs */}
        <div className="my-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-strokedark">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-meta-4">
            <button
              type="button"
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all sm:px-5 ${
                activeTab === 'services'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-boxdark dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>✨ Danh mục Dịch vụ</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all sm:px-5 ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-boxdark dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>📋 Tra cứu & Lịch sử</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('faq')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all sm:px-5 ${
                activeTab === 'faq'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-boxdark dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <span>❓ Câu hỏi thường gặp (FAQ)</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== 'faq' && (
              <button
                type="button"
                onClick={() => setActiveTab('faq')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400"
              >
                <span>Cần giải đáp thắc mắc?</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">Xem FAQ →</span>
              </button>
            )}
            {activeTab === 'history' ? (
              <button
                type="button"
                onClick={() => setActiveTab('services')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400"
              >
                <span>← Xem danh mục dịch vụ</span>
              </button>
            ) : activeTab === 'services' ? (
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400"
              >
                <span>Tra cứu yêu cầu của tôi →</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('services')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400"
              >
                <span>← Danh mục Dịch vụ</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Services Directory */}
        {activeTab === 'services' && (
          <>
            <section className="studio-service-hub-grid" aria-label={t('title')}>
              <div className="mu-section-head">
                <div>
                  <h2 className="mu-heading">{experience('hubTitle')}</h2>
                  <p className="mu-note">{experience('hubIntro')}</p>
                </div>
              </div>
              <div className="studio-service-grid">
                {collectorServices.map((service) => (
                  <Link href={service.route} key={service.key} className={`studio-service-card service-${service.key}`}>
                    <div className="studio-service-symbol">
                      <AdminIcon name={service.icon} size={32} />
                    </div>
                    <h2>{experience(`serviceNames.${service.key}`)}</h2>
                    <p>{experience(`serviceSummary.${service.key}`)}</p>
                    <span className="studio-service-arrow">
                      <AdminIcon name="arrow" size={20} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
            <ServiceTerms>
              <p>{t('subtitle')}</p>
              <p>{t('agreementNote')}</p>
            </ServiceTerms>

            {/* Inline FAQ section preview */}
            <div className="mt-12 pt-6 border-t border-slate-200/80 dark:border-strokedark">
              <ServiceFaq />
            </div>
          </>
        )}

        {/* Tab 2: Service History Hub */}
        {activeTab === 'history' && (
          <div className="pt-2">
            <ServiceHistoryHub />
          </div>
        )}

        {/* Tab 3: Dedicated FAQ Tab */}
        {activeTab === 'faq' && (
          <div className="pt-2">
            <ServiceFaq />
          </div>
        )}
      </div>
    </>
  );
}
