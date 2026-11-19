'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import AdminIcon from '@/components/Admin/AdminIcon';
import { useReveal } from '@/shared/client/hooks/useReveal';
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
  const body = useRef<HTMLDivElement>(null);
  useReveal(body, [activeTab]);

  // ?tab=history or ?tab=faq opens that tab (links from the account, the footer and the assistant).
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'history' || tab === 'faq') setActiveTab(tab);
  }, []);

  return (
    <>
      <ServicesHero photos={photos} />
      <div ref={body} className="mu-wrap store-workspace sv-body">
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
              <header className="sv-section-head" data-reveal>
                <h2 id="services-hub-title">{experience('hubTitle')}</h2>
                <p>{experience('hubIntro')}</p>
              </header>
              <ServiceCards photo={photos[3] ?? photos[0]} />
            </section>
            <section className="svx-process" aria-labelledby="services-process" data-reveal>
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
