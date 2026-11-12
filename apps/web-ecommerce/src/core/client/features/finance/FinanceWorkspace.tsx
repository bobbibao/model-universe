'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import FinancePeriod, { currentFinanceRange } from './FinancePeriod';
import MoneyOperationsWorkspace from './MoneyOperationsWorkspace';
import ExpenseWorkspace from './ExpenseWorkspace';
import ReconcileOrders from './ReconcileOrders';

export type FinanceTab = 'expenses' | 'orders' | 'payments';
const TABS: readonly FinanceTab[] = ['expenses', 'orders', 'payments'];

// Refunds waiting for a person (review or payout), for the tab badge. Plain fetch: staff without the Finance scope get
// 403 and simply see no badge, without an error toast.
const openRefundCount = async () => {
  const response = await fetch('/api/admin/commerce/money-operations', { credentials: 'same-origin' });
  if (!response.ok) return undefined;
  const data = (await response.json()) as { operations?: { status: string }[] };
  return data.operations?.filter((row) => ['requested', 'approved', 'reconciliation'].includes(row.status)).length;
};

export default function FinanceWorkspace({ initialTab = 'expenses' }: { initialTab?: FinanceTab }) {
  const en = useLocale() === 'en';
  const [range, setRange] = useState(currentFinanceRange),
    [tab, setTab] = useState<FinanceTab>(initialTab),
    [openRefunds, setOpenRefunds] = useState<number>();
  useEffect(() => {
    openRefundCount()
      .then(setOpenRefunds)
      .catch(() => setOpenRefunds(undefined));
  }, [tab]);
  // The open tab is part of the address, so a link (dashboard, alert, email) or a reload lands on the same tab.
  const select = (next: FinanceTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'expenses') url.searchParams.delete('tab');
    else url.searchParams.set('tab', next);
    window.history.replaceState(window.history.state, '', url);
  };
  const labels: Record<FinanceTab, string> = {
    expenses: en ? 'Costs & rates' : 'Chi phí & định mức',
    orders: en ? 'Order reconciliation' : 'Đối soát đơn hàng',
    payments: en ? 'Refund approvals' : 'Duyệt hoàn tiền',
  };
  return (
    <div className="finance-workspace">
      <header className="finance-heading">
        <div>
          <p className="finance-eyebrow">MODEL UNIVERSE / {en ? 'FINANCE OPERATIONS' : 'QUẢN LÝ TÀI CHÍNH'}</p>
          <h1>{en ? 'Costs & reconciliation' : 'Chi phí & đối soát'}</h1>
          <p>
            {en
              ? 'Record costs, reconcile each order and handle refunds owed to customers.'
              : 'Ghi nhận chi phí, đối soát từng đơn và xử lý các khoản hoàn tiền cho khách.'}
          </p>
        </div>
        <Link href="/admin/dashboard" className="finance-button">
          {en ? 'View reports →' : 'Xem báo cáo →'}
        </Link>
      </header>
      {/* The period drives costs and reconciliation; the refund queue is every open refund, whatever its date. */}
      {tab !== 'payments' && <FinancePeriod range={range} onChange={setRange} />}
      <div
        className="finance-tabs"
        role="tablist"
        aria-label={en ? 'Finance sections' : 'Mục tài chính'}
        onKeyDown={(e) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
          e.preventDefault();
          const next =
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? TABS.length - 1
                : (TABS.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
          select(TABS[next]);
          e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}
      >
        {TABS.map((key) => (
          <button
            role="tab"
            id={`finance-tab-${key}`}
            aria-controls={`finance-panel-${key}`}
            aria-selected={tab === key}
            tabIndex={tab === key ? 0 : -1}
            key={key}
            onClick={() => select(key)}
          >
            {labels[key]}
            {key === 'payments' && !!openRefunds && (
              <span
                className="finance-tab-badge"
                aria-label={en ? `${openRefunds} waiting` : `${openRefunds} khoản đang chờ`}
              >
                {openRefunds}
              </span>
            )}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`finance-panel-${tab}`} aria-labelledby={`finance-tab-${tab}`}>
        {tab === 'expenses' ? (
          <ExpenseWorkspace range={range} onChange={() => {}} />
        ) : tab === 'payments' ? (
          <MoneyOperationsWorkspace onChange={() => openRefundCount().then(setOpenRefunds, () => undefined)} />
        ) : (
          <ReconcileOrders range={range} onChange={() => {}} />
        )}
      </section>
    </div>
  );
}
