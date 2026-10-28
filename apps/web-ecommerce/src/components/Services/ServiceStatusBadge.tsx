'use client';

import React from 'react';

export interface ServiceStatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const statusStyles: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
    defaultLabelVi: string;
  }
> = {
  submitted: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
    dot: 'bg-amber-500',
    defaultLabelVi: 'Đã gửi yêu cầu',
  },
  need_more_evidence: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-800/60',
    dot: 'bg-orange-500 animate-pulse',
    defaultLabelVi: 'Cần bổ sung ảnh/video',
  },
  quoted: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-800 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800/60',
    dot: 'bg-sky-500',
    defaultLabelVi: 'Có báo giá sơ bộ',
  },
  awaiting_item: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    text: 'text-cyan-800 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800/60',
    dot: 'bg-cyan-500',
    defaultLabelVi: 'Chờ mô hình gửi tới',
  },
  inspecting: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800/60',
    dot: 'bg-purple-500 animate-pulse',
    defaultLabelVi: 'Đang thẩm định hiện vật',
  },
  reinspection_requested: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-800 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-800/60',
    dot: 'bg-rose-500',
    defaultLabelVi: 'Yêu cầu thẩm định lại',
  },
  awaiting_acceptance: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-800 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    dot: 'bg-indigo-500',
    defaultLabelVi: 'Chờ bạn chốt giá cuối',
  },
  awaiting_payout: {
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-800 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800/60',
    dot: 'bg-teal-500',
    defaultLabelVi: 'Chờ chi trả / Tất toán',
  },
  completed: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    defaultLabelVi: 'Hoàn tất giao dịch',
  },
  returning: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-800/60',
    dot: 'bg-orange-500',
    defaultLabelVi: 'Đang trả lại hiện vật',
  },
  cancelled: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    defaultLabelVi: 'Đã đóng yêu cầu',
  },
  // Pawn specific
  accepted: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800/60',
    dot: 'bg-blue-500',
    defaultLabelVi: 'Đã chấp nhận',
  },
  contract_confirmed: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-800 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    dot: 'bg-indigo-500',
    defaultLabelVi: 'Đã ký thỏa thuận',
  },
  in_custody: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
    dot: 'bg-amber-500',
    defaultLabelVi: 'Đang lưu kho an toàn',
  },
  active: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    defaultLabelVi: 'Hợp đồng đang hiệu lực',
  },
  repaid: {
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    text: 'text-teal-800 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800/60',
    dot: 'bg-teal-500',
    defaultLabelVi: 'Đã chuộc / Chờ nhận lại',
  },
  returned: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    defaultLabelVi: 'Đã trả tài sản',
  },
  disposed: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    defaultLabelVi: 'Đã thanh lý theo hợp đồng',
  },
  DUE_GRACE: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-800 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-800/60',
    dot: 'bg-rose-500 animate-ping',
    defaultLabelVi: 'Ân hạn 48 giờ',
  },
  OVERDUE_REVIEW: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-300 dark:border-red-800/60',
    dot: 'bg-red-500',
    defaultLabelVi: 'Chờ xem xét quá hạn',
  },
};

export default function ServiceStatusBadge({
  status,
  label,
  size = 'sm',
  className = '',
}: ServiceStatusBadgeProps) {
  const style = statusStyles[status] || {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
    defaultLabelVi: status,
  };

  const displayText = label || style.defaultLabelVi;

  const sizeClasses =
    size === 'md'
      ? 'px-3 py-1 text-xs gap-2'
      : 'px-2.5 py-0.5 text-[11px] gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border shadow-2xs whitespace-nowrap transition-colors ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} aria-hidden="true" />
      <span>{displayText}</span>
    </span>
  );
}

