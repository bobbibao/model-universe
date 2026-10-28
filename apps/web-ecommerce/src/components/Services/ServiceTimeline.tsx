'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import AdminIcon from '@/components/Admin/AdminIcon';
import { formatVND } from '@/shared/server/utils/utils';

export interface ServiceEvent {
  id: number;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ServiceTimelineProps {
  status: string;
  events?: ServiceEvent[];
  mode?: 'buyback' | 'trade' | 'pawn';
  className?: string;
}

const BUYBACK_STEPS = [
  { key: 'submitted', titleVi: 'Gửi yêu cầu', descVi: 'Khách gửi mô tả & ảnh' },
  { key: 'quoted', titleVi: 'Báo giá sơ bộ', descVi: 'Shop thẩm định từ xa' },
  { key: 'awaiting_item', titleVi: 'Gửi hàng về shop', descVi: 'Khách gửi hiện vật' },
  { key: 'inspecting', titleVi: 'Shop kiểm định', descVi: 'Mở hộp & kiểm tra QC' },
  { key: 'awaiting_acceptance', titleVi: 'Chốt giá cuối', descVi: 'Hai bên duyệt giá' },
  { key: 'completed', titleVi: 'Chi trả & Hoàn tất', descVi: 'Tất toán giao dịch' },
];

function getStepIndex(status: string): number {
  switch (status) {
    case 'submitted':
    case 'need_more_evidence':
      return 0;
    case 'quoted':
      return 1;
    case 'awaiting_item':
      return 2;
    case 'inspecting':
    case 'reinspection_requested':
      return 3;
    case 'awaiting_acceptance':
      return 4;
    case 'awaiting_payout':
      return 5;
    case 'completed':
      return 6;
    default:
      return 0;
  }
}

export default function ServiceTimeline({
  status,
  events = [],
  mode = 'buyback',
  className = '',
}: ServiceTimelineProps) {
  const t = useTranslations('buyback');
  const locale = useLocale();
  const [showAllEvents, setShowAllEvents] = useState(false);

  const currentStep = getStepIndex(status);
  const isCancelled = status === 'cancelled';
  const isReturning = status === 'returning';

  return (
    <div className={`service-timeline rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-strokedark dark:bg-boxdark ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-strokedark">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            <AdminIcon name="refresh" size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Tiến trình xử lý dịch vụ
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quy trình chuẩn hóa 6 bước từ định giá đến tất toán
            </p>
          </div>
        </div>

        {isCancelled && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-meta-4 dark:text-slate-300">
            Đã kết thúc
          </span>
        )}
        {isReturning && (
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            Đang hoàn trả
          </span>
        )}
      </div>

      {/* Visual Stepper Bar */}
      <div className="py-5 overflow-x-auto">
        <div className="min-w-[620px] flex items-center justify-between relative px-2">
          {/* Connector Line Background */}
          <div className="absolute left-6 right-6 top-4 h-0.5 bg-slate-200 dark:bg-slate-700 -z-0" />

          {/* Active Connector Line Fill */}
          <div
            className="absolute left-6 top-4 h-0.5 bg-emerald-500 transition-all duration-500 -z-0"
            style={{
              width: `${Math.min(100, Math.max(0, (currentStep / (BUYBACK_STEPS.length - 1)) * 96))}%`,
            }}
          />

          {BUYBACK_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep || (idx === 5 && status === 'completed');
            const isCurrent = idx === currentStep && status !== 'completed' && !isCancelled;

            return (
              <div
                key={step.key}
                className="flex flex-col items-center text-center relative z-10 max-w-[96px]"
              >
                {/* Node Circle */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : isCurrent
                      ? 'bg-purple-600 text-white ring-4 ring-purple-600/20 shadow-md'
                      : 'bg-white border-2 border-slate-300 text-slate-400 dark:bg-boxdark dark:border-slate-600'
                  }`}
                >
                  {isCompleted ? '✓' : idx + 1}
                </div>

                {/* Step Labels */}
                <span
                  className={`mt-2 text-xs font-semibold ${
                    isCurrent
                      ? 'text-purple-600 dark:text-purple-400 font-bold'
                      : isCompleted
                      ? 'text-slate-800 dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {step.titleVi}
                </span>
                <span className="text-[10px] text-slate-400 line-clamp-1 dark:text-slate-500">
                  {step.descVi}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Events Activity Feed */}
      {events && events.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-3 dark:border-strokedark">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowAllEvents(!showAllEvents)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400"
            >
              <span>{showAllEvents ? '▼ Thu gọn lịch sử sự kiện' : '▶ Xem chi tiết nhật ký sự kiện'}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 dark:bg-meta-4 dark:text-slate-300">
                {events.length}
              </span>
            </button>
            <span className="text-[11px] text-slate-400">
              Cập nhật gần nhất: {new Date(events[events.length - 1]?.createdAt || Date.now()).toLocaleTimeString(locale)}
            </span>
          </div>

          {showAllEvents && (
            <ol className="mt-4 space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700 pl-8">
              {events.map((event) => {
                const offer = (event.details.offer || event.details.acceptedOffer) as
                  | { amountVnd: number; details: string }
                  | undefined;
                const returnTerms = (event.details.returnTerms ||
                  event.details.acceptedReturnTerms) as { details: string } | undefined;
                const notes = [
                  event.details.reason,
                  event.details.inspection,
                  event.details.note,
                  returnTerms?.details,
                ].filter((v): v is string => typeof v === 'string');

                return (
                  <li key={event.id} className="relative text-xs">
                    {/* Event Dot */}
                    <span className="absolute -left-8 top-1 h-3 w-3 rounded-full border-2 border-white bg-purple-600 dark:border-boxdark" />

                    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 dark:border-strokedark dark:bg-meta-4/30">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {t(`events.${event.action}`)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(event.createdAt).toLocaleString(locale)}
                        </span>
                      </div>

                      {offer && (
                        <p className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          Giá thỏa thuận: {formatVND(offer.amountVnd, locale)}
                          {offer.details ? ` · ${offer.details}` : ''}
                        </p>
                      )}

                      {typeof event.details.amountVnd === 'number' && (
                        <p className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          Số tiền: {formatVND(event.details.amountVnd, locale)}
                        </p>
                      )}

                      {notes.map((note, nIdx) => (
                        <p key={nIdx} className="mt-1 text-slate-600 dark:text-slate-300 whitespace-pre-line">
                          {note}
                        </p>
                      ))}

                      {[
                        event.details.externalReference,
                        event.details.inboundReference,
                        event.details.tracking,
                      ]
                        .filter((v): v is string => typeof v === 'string')
                        .map((ref, rIdx) => (
                          <p key={rIdx} className="mt-1 font-mono text-[11px] text-slate-500">
                            Mã vận đơn / tham chiếu: {ref}
                          </p>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

