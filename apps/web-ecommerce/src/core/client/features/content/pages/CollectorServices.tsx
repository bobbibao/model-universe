'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import { ServiceTerms } from '@/components/Services/ServiceExperience';
import ServiceChapters from '@/components/Services/ServiceChapters';
import ServiceFigures from '@/components/Services/ServiceFigures';
import ServiceVisit from '@/components/Services/ServiceVisit';
import type { ShowcasePhoto } from '@/shared/types/showcase';
import ServiceHistoryHub from '@/components/Services/ServiceHistoryHub';
import ServiceFaq from '@/components/Services/ServiceFaq';
import ServicesHero from '../components/ServicesHero';

type Tab = 'services' | 'history' | 'faq';
const TABS: { key: Tab; label: 'tabServices' | 'tabHistory' | 'tabFaq' }[] = [
  { key: 'services', label: 'tabServices' },
  { key: 'history', label: 'tabHistory' },
  { key: 'faq', label: 'tabFaq' },
];

// /services: the hero, then the tabs. The services tab reads top to bottom as the page's story: the three numbers set
// large, every service as a photographed chapter, how every request goes (the one navy band), where to bring a kit,
// the terms and the questions people ask.
export default function CollectorServices({ photos = [] }: { photos?: ShowcasePhoto[] }) {
  const t = useTranslations('services');
  const experience = useTranslations('experience');
  const g = useTranslations('serviceGuide');
  const [activeTab, setActiveTab] = useState<Tab>('services');

  // ?tab=history or ?tab=faq opens that tab (links from the account, the footer and the assistant).
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'history' || tab === 'faq') setActiveTab(tab);
  }, []);

  return (
    <>
      <ServicesHero photos={photos} />
      <div className="mu-wrap store-workspace sv-body">
        <nav className="sg-tabs" aria-label={t('title')}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {g(tab.label)}
            </button>
          ))}
        </nav>

        {activeTab === 'services' && (
          <>
            <ServiceFigures />
            <section className="sv-hub" aria-labelledby="services-hub-title">
              <header className="sv-section-head">
                <h2 id="services-hub-title">{experience('hubTitle')}</h2>
                <p>{experience('hubIntro')}</p>
              </header>
              <ServiceChapters photos={photos} />
            </section>
            <section className="svx-process" aria-labelledby="services-process">
              <div className="svx-process-head">
                <h2 id="services-process">{g('processTitle')}</h2>
                <Link className="svx-button is-light" href="/services/sell">
                  {g('heroPrimary')}
                  <AdminIcon name="arrow" size={18} />
                </Link>
              </div>
              <ol>
                {([1, 2, 3, 4] as const).map((step) => (
                  <li key={step}>
                    <span className="svx-step">{String(step).padStart(2, '0')}</span>
                    <span>{g(`processStep${step}`)}</span>
                  </li>
                ))}
              </ol>
              <ul className="svx-trust">
                {(['trustRules', 'trustTracking', 'trustMoney'] as const).map((key) => (
                  <li key={key}>
                    <AdminIcon name="check" size={16} />
                    {g(key)}
                  </li>
                ))}
              </ul>
            </section>
            <ServiceVisit />
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
