'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from '@/i18n/navigation';
import ContactIcon from '@/components/Contact/ContactIcon';
import { CONTACT } from '@/shared/contact-channels';
import { FAQ_LIST, type FaqItem } from './serviceFaqItems';
import './service-guide.css';

type CategoryFilter = 'all' | FaqItem['category'];
const FILTERS: { key: CategoryFilter; label: 'faqAll' | 'faqBuyback' | 'faqHold' | 'faqPawn' | 'faqValuation' }[] = [
  { key: 'all', label: 'faqAll' },
  { key: 'buyback', label: 'faqBuyback' },
  { key: 'hold', label: 'faqHold' },
  { key: 'pawn', label: 'faqPawn' },
  { key: 'valuation', label: 'faqValuation' },
];

// Accent-insensitive search, so "giu hang" finds "giữ hàng".
const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export default function ServiceFaq() {
  const g = useTranslations('serviceGuide');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({ 'buyback-flow': true });

  const matchesSearch = useMemo(() => {
    const query = fold(searchTerm.trim());
    return (item: FaqItem) => !query || fold(`${item.question} ${item.answer} ${item.badge}`).includes(query);
  }, [searchTerm]);
  const visible = FAQ_LIST.filter(
    (item) => (activeCategory === 'all' || item.category === activeCategory) && matchesSearch(item),
  );
  const count = (key: CategoryFilter) =>
    FAQ_LIST.filter((item) => (key === 'all' || item.category === key) && matchesSearch(item)).length;

  return (
    <section className="sg-faq" aria-labelledby="faq-title">
      <div className="sg-faq-side">
        <h2 id="faq-title">{g('faqTitle')}</h2>
        <p className="sg-faq-intro">{g('faqIntro')}</p>
        <label className="sg-faq-search">
          <span className="sr-only">{g('faqSearch')}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={g('faqSearch')}
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} aria-label={g('faqClear')}>
              ✕
            </button>
          )}
        </label>
        <div className="sg-faq-filters" role="group" aria-label={g('faqTitle')}>
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              aria-pressed={activeCategory === filter.key}
              onClick={() => setActiveCategory(filter.key)}
            >
              {g(filter.label)}
              <span>{count(filter.key)}</span>
            </button>
          ))}
        </div>
        <div className="sg-faq-help">
          <strong>{g('faqHelpTitle')}</strong>
          <p>{g('faqHelpText', { hours: CONTACT.hours })}</p>
          <div>
            <a href={CONTACT.zalo} target="_blank" rel="noopener noreferrer">
              <ContactIcon name="zalo" size={22} />
              {g('guestZalo')}
            </a>
            <a href={CONTACT.tel}>
              <ContactIcon name="phone" size={15} />
              {CONTACT.phoneDisplay}
            </a>
          </div>
          <Link href="/contact" className="sg-faq-help-link">
            {g('faqContact')} →
          </Link>
        </div>
      </div>

      <div className="sg-faq-list">
        <p className="sg-faq-count" role="status">
          {g('faqCount', { count: visible.length })}
        </p>
        {visible.length === 0 ? (
          <p className="sg-faq-empty">{g('faqEmpty')}</p>
        ) : (
          visible.map((faq) => {
            const open = !!expandedIds[faq.id];
            return (
              <article key={faq.id} id={`faq-${faq.id}`} className="sg-faq-item" data-open={open}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`faq-answer-${faq.id}`}
                    onClick={() => setExpandedIds((current) => ({ ...current, [faq.id]: !current[faq.id] }))}
                  >
                    <span className={`sg-faq-badge is-${faq.category}`}>{faq.badge}</span>
                    <span className="sg-faq-question">{faq.question}</span>
                    <span className="sg-faq-chevron" aria-hidden="true">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </button>
                </h3>
                {/* Collapsed answers stay in the HTML (hidden) so search engines read every answer. */}
                <div id={`faq-answer-${faq.id}`} className="sg-faq-answer" hidden={!open}>
                  {faq.answer}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
