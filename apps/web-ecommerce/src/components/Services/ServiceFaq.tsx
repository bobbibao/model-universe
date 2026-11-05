'use client';

import React, { useMemo, useState } from 'react';
import { FAQ_LIST } from './serviceFaqItems';

type CategoryFilter = 'all' | 'buyback' | 'hold' | 'pawn' | 'valuation';

export default function ServiceFaq() {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    'buyback-flow': true,
    'hold-policy': true,
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredFaqs = useMemo(() => {
    return FAQ_LIST.filter((item) => {
      const matchCat = activeCategory === 'all' || item.category === activeCategory;
      const matchQuery =
        !searchTerm.trim() ||
        item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.badge.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [activeCategory, searchTerm]);

  return (
    <div className="service-faq-section py-4">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-strokedark sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Câu hỏi thường gặp
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Thông tin chi tiết về quy trình thẩm định, điều kiện thu mua, dịch vụ cầm đồ và giữ mô hình.
          </p>
        </div>

        {/* Clean Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm câu hỏi..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-hidden dark:border-strokedark dark:bg-meta-4 dark:text-white"
          />
          <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="my-4 flex flex-wrap gap-1.5">
        {(
          [
            ['all', 'Tất cả'],
            ['buyback', 'Thu mua'],
            ['hold', 'Giữ mô hình'],
            ['pawn', 'Cầm đồ'],
            ['valuation', 'Định giá & Giải ngân'],
          ] as const
        ).map(([key, label]) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-meta-4'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Accordion Divider List */}
      <div className="divide-y divide-slate-200 dark:divide-strokedark">
        {filteredFaqs.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            Không tìm thấy câu hỏi phù hợp.
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isExpanded = !!expandedIds[faq.id];
            return (
              <div key={faq.id} className="py-4">
                <button
                  type="button"
                  onClick={() => toggleExpand(faq.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-start justify-between gap-4 text-left"
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-meta-4 dark:text-slate-400">
                      {faq.badge}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white sm:text-base">
                      {faq.question}
                    </h3>
                  </div>
                  <span className="mt-0.5 text-base font-bold text-slate-400">
                    {isExpanded ? '−' : '+'}
                  </span>
                </button>

                {/* Collapsed answers stay in the HTML (hidden) so search engines read every answer. */}
                <div
                  hidden={!isExpanded}
                  className="mt-2.5 pl-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm"
                >
                  {faq.answer}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Clean Footnote */}
      <div className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-strokedark dark:text-slate-400">
        <span>Vẫn còn thắc mắc? Liên hệ Hotline </span>
        <a href="tel:+84373725104" className="font-bold text-slate-900 hover:underline dark:text-white">
          0373 725 104
        </a>
        <span> hoặc </span>
        <a
          href="https://zalo.me/0373725104"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-slate-900 hover:underline dark:text-white"
        >
          Nhắn tin Zalo ↗
        </a>
        <span> để được hỗ trợ trực tiếp.</span>
      </div>
    </div>
  );
}
