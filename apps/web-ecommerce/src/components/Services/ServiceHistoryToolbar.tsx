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
    { key: 'action_needed', label: 'Cần bạn duyệt', count: counts.action_needed, alert: counts.action_needed > 0 },
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
          placeholder="Tìm theo mã TM, tên mô hình, phiên bản..."
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

      {/* Filter Tabs / Pills with Solid High Contrast & Bulletproof Inline Styles */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {tabs.map((tab) => {
          const isSelected = selectedTab === tab.key;

          // Determine bulletproof background and text styling
          let pillStyle: React.CSSProperties = {
            backgroundColor: '#f1f5f9',
            color: '#334155',
            borderColor: 'rgba(226, 232, 240, 0.9)',
          };
          let badgeStyle: React.CSSProperties = {
            backgroundColor: '#e2e8f0',
            color: '#1e293b',
          };

          if (isSelected) {
            pillStyle = {
              backgroundColor: '#1e1b2e',
              color: '#ffffff',
              borderColor: '#1e1b2e',
            };
            badgeStyle = {
              backgroundColor: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
            };
          } else if (tab.alert) {
            pillStyle = {
              backgroundColor: '#fffbeb',
              color: '#92400e',
              borderColor: '#fcd34d',
            };
            badgeStyle = {
              backgroundColor: '#fde68a',
              color: '#78350f',
            };
          }

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelectTab(tab.key)}
              style={pillStyle}
              className={`toolbar-tab inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-2xs transition-all duration-150 hover:opacity-95 ${
                isSelected ? 'is-active ring-1 ring-slate-900/10' : tab.alert ? 'is-alert' : ''
              }`}
            >
              <span className="font-semibold">{tab.label}</span>
              <span
                style={badgeStyle}
                className="tab-badge rounded-full px-1.5 py-0.2 text-[10px] font-bold"
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

