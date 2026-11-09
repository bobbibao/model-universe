'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import { collectorServices, ServiceTerms, useServiceFact } from '@/components/Services/ServiceExperience';
import ServiceHistoryHub from '@/components/Services/ServiceHistoryHub';
import ServiceFaq from '@/components/Services/ServiceFaq';
import ServicesHero from '../components/ServicesHero';

type Tab = 'services' | 'history' | 'faq';
const TABS: { key: Tab; icon: string; label: 'tabServices' | 'tabHistory' | 'tabFaq' }[] = [
  { key: 'services', icon: 'dashboard', label: 'tabServices' },
  { key: 'history', icon: 'orders', label: 'tabHistory' },
  { key: 'faq', icon: 'book', label: 'tabFaq' },
];

export default function CollectorServices() {
  const t = useTranslations('services');
  const experience = useTranslations('experience');
  const g = useTranslations('serviceGuide');
  const fact = useServiceFact();
  const [activeTab, setActiveTab] = useState<Tab>('services');

  // ?tab=history or ?tab=faq opens that tab (links from the account, the footer and the assistant).
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'history' || tab === 'faq') setActiveTab(tab);
  }, []);

  return (
    <>
      <ServicesHero />
      <div className="mu-wrap store-workspace service-hub-compact">
        <nav className="sg-tabs" aria-label={t('title')}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              <AdminIcon name={tab.icon} size={16} />
              {g(tab.label)}
            </button>
          ))}
        </nav>

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
                    <span className="sg-card-fact">
                      <AdminIcon name="check" size={14} />
                      {fact(service.key as Exclude<typeof service.key, 'loyalty'>)}
                    </span>
                    <span className="sg-card-start">
                      {g('start')}
                      <span className="studio-service-arrow">
                        <AdminIcon name="arrow" size={20} />
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
            <ServiceTerms>
              <p>{t('subtitle')}</p>
              <p>{t('agreementNote')}</p>
            </ServiceTerms>
            <div className="sg-faq-divider">
              <ServiceFaq />
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <div className="pt-2">
            <ServiceHistoryHub />
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="pt-2">
            <ServiceFaq />
          </div>
        )}
      </div>
    </>
  );
}
