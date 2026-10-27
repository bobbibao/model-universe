'use client';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import FinancePeriod, { currentFinanceRange } from './FinancePeriod';
import ExpenseWorkspace from './ExpenseWorkspace';
import ReconcileOrders from './ReconcileOrders';
export default function FinanceWorkspace({ initialTab = 'expenses' }: { initialTab?: 'expenses' | 'orders' }) {
  const en = useLocale() === 'en';
  const [range, setRange] = useState(currentFinanceRange),
    [tab, setTab] = useState(initialTab);
  return (
    <div className="finance-workspace">
      <header className="finance-heading">
        <div>
          <p className="finance-eyebrow">MODEL UNIVERSE / {en ? 'FINANCE OPERATIONS' : 'QUẢN LÝ TÀI CHÍNH'}</p>
          <h1>{en ? 'Costs & reconciliation' : 'Chi phí & đối soát'}</h1>
          <p>
            {en
              ? 'Manage packaging, consumables, actual costs and order acquisition costs.'
              : 'Quản lý vật tư, bao bì, đơn giá và chi phí thực tế từng đơn.'}
          </p>
        </div>
        <Link href="/admin/dashboard" className="finance-button">
          {en ? 'View reports →' : 'Xem báo cáo →'}
        </Link>
      </header>
      <FinancePeriod range={range} onChange={setRange} />
      <div
        className="finance-tabs"
        role="tablist"
        aria-label="Quản lý chi phí"
        onKeyDown={(e) => {
          const keys = ['expenses', 'orders'] as const;
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
          e.preventDefault();
          const next = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : tab === 'expenses' ? 1 : 0;
          setTab(keys[next]);
          e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}
      >
        {(
          [
            ['expenses', en ? 'Costs & rates' : 'Chi phí & định mức'],
            ['orders', en ? 'Order reconciliation' : 'Đối soát đơn hàng'],
          ] as const
        ).map(([key, label]) => (
          <button
            role="tab"
            id={`finance-tab-${key}`}
            aria-controls={`finance-panel-${key}`}
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`finance-panel-${tab}`} aria-labelledby={`finance-tab-${tab}`}>
        {tab === 'expenses' ? (
          <ExpenseWorkspace range={range} onChange={() => {}} />
        ) : (
          <ReconcileOrders range={range} onChange={() => {}} />
        )}
      </section>
    </div>
  );
}
