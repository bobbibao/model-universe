'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ServiceTerms } from '@/components/Services/ServiceExperience';
import ServiceCards from '@/components/Services/ServiceCards';
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
            <section className="sv-hub" aria-labelledby="services-hub-title">
              <header className="sv-section-head">
                <h2 id="services-hub-title">{experience('hubTitle')}</h2>
                <p>{experience('hubIntro')}</p>
              </header>
              <ServiceCards photos={photos.slice(3)} />
            </section>
            <section className="svx-process" aria-labelledby="services-process">
              <h2 id="services-process">{g('processTitle')}</h2>
              <ol>
                {([1, 2, 3, 4] as const).map((step) => (
                  <li key={step}>
                    <span className="svx-step">{step}</span>
                    <span>{g(`processStep${step}`)}</span>
                  </li>
                ))}
              </ol>
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
