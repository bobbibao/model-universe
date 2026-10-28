'use client';

import React from 'react';
import AdminIcon from '@/components/Admin/AdminIcon';

export type ServiceFilterTab = 'all' | 'active' | 'action_needed' | 'completed' | 'closed';

export interface ServiceHistoryToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTab: ServiceFilterTab;
  onSelectTab: (tab: ServiceFilterTab) => void;
  counts: {
    all: number;
    active: number;
    action_needed: number;
    completed: number;
    closed: number;
  };
  className?: string;
}

export default function ServiceHistoryToolbar({
  searchQuery,
  onSearchChange,
  selectedTab,
  onSelectTab,
  counts,
  className = '',
}: ServiceHistoryToolbarProps) {
  const tabs: { key: ServiceFilterTab; label: string; count: number; alert?: boolean }[] = [
    { key: 'all', label: 'Tất cả', count: counts.all },
    { key: 'active', label: 'Đang xử lý', count: counts.active },
    { key: 'action_needed', label: 'Cần duyệt', count: counts.action_needed, alert: counts.action_needed > 0 },
    { key: 'completed', label: 'Hoàn tất', count: counts.completed },
    { key: 'closed', label: 'Đã đóng', count: counts.closed },
  ];

  return (
    <div className={`service-history-toolbar space-y-2.5 ${className}`}>
      {/* Search Input Box */}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <AdminIcon name="search" size={16} />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm mã TM, tên mô hình, phiên bản..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:border-purple-600 focus:bg-white focus:ring-2 focus:ring-purple-600/20 focus:outline-none dark:border-strokedark dark:bg-boxdark dark:text-white"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Xóa tìm kiếm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Tabs / Pills with Wrapping & High Contrast */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {tabs.map((tab) => {
          const isSelected = selectedTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelectTab(tab.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                isSelected
                  ? 'bg-purple-600 text-white shadow-xs ring-1 ring-purple-600 dark:bg-purple-600 dark:text-white'
                  : tab.alert
                  ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100/90 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                  : 'border border-slate-200/80 bg-slate-100 text-slate-700 hover:bg-slate-200/90 dark:border-strokedark dark:bg-meta-4/60 dark:text-slate-200 dark:hover:bg-meta-4'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  isSelected
                    ? 'bg-white/25 text-white'
                    : tab.alert
                    ? 'bg-amber-200 text-amber-950 dark:bg-amber-900/80 dark:text-amber-100'
                    : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
