'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import TextField from '@/components/FormElements/TextField';
import { shopDay } from '@/shared/finance';
import { financeApi, type Report } from './api';
import ReportView from './ReportView';
import ExpenseWorkspace from './ExpenseWorkspace';
import ReconcileOrders from './ReconcileOrders';

export default function FinanceWorkspace() {
  const en = useLocale() === 'en';
  const today = shopDay(new Date());
  const [draft, setDraft] = useState({ from: `${today.slice(0, 7)}-01`, to: today });
  const [range, setRange] = useState(draft);
  const [tab, setTab] = useState('overview');
  const [report, setReport] = useState<Report>();
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(false);
    financeApi
      .report(range)
      .then((data) => {
        if (current) setReport(data);
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [range, revision]);
  const refresh = () => setRevision((n) => n + 1);
  return (
    <div className="finance-workspace">
      {report?.developmentFixtures && (
        <div className="finance-notice">
          <strong>DỮ LIỆU PHÁT TRIỂN · Không phải giao dịch của shop</strong>
          <span>Database riêng · Thanh toán và vận chuyển thật đã tắt</span>
        </div>
      )}
      <header className="finance-heading">
        <div>
          <p className="finance-eyebrow">MODEL UNIVERSE / {en ? 'BUSINESS' : 'KINH DOANH'}</p>
          <h1>{en ? 'Business overview' : 'Tình hình kinh doanh'}</h1>
          <p>
            {en
              ? 'Delivered sales, verified cash and recorded costs.'
              : 'Hàng đã giao · Tiền đã thu · Chi phí đã ghi nhận'}
          </p>
        </div>
        <Link href="/admin/orders/new" className="finance-button is-primary">
          {en ? 'Create sale' : '+ Tạo đơn bán'}
        </Link>
      </header>
      <form
        className="finance-period"
        onSubmit={(e) => {
          e.preventDefault();
          setRange({ ...draft });
        }}
      >
        <div className="finance-presets">
          {[0, 30, 90].map((days) => (
            <button
              type="button"
              key={days}
              onClick={() => {
                const next = {
                  from: days
                    ? new Date(Date.parse(today) - (days - 1) * 86400000).toISOString().slice(0, 10)
                    : `${today.slice(0, 7)}-01`,
                  to: today,
                };
                setDraft(next);
                setRange(next);
              }}
            >
              {days ? `${days} ${en ? 'days' : 'ngày'}` : en ? 'This month' : 'Tháng này'}
            </button>
          ))}
        </div>
        <TextField
          label={en ? 'From' : 'Từ ngày'}
          type="date"
          required
          value={draft.from}
          max={draft.to}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
        />
        <TextField
          label={en ? 'To' : 'Đến ngày'}
          type="date"
          required
          value={draft.to}
          min={draft.from}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
        />
        <button className="finance-button" disabled={loading}>
          {en ? 'Apply' : 'Áp dụng'}
        </button>
        <span className="finance-caption">GMT+7 · VND</span>
      </form>
      <div className="finance-tabs" role="tablist" aria-label={en ? 'Finance workspaces' : 'Không gian tài chính'}>
        {[
          ['overview', en ? 'Overview' : 'Tổng quan'],
          ['orders', en ? 'Order reconciliation' : 'Đối soát đơn hàng'],
          ['expenses', en ? 'Costs & categories' : 'Chi phí & định mức'],
        ].map(([key, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            aria-controls={`finance-panel-${key}`}
            id={`finance-tab-${key}`}
            key={key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <section id={`finance-panel-${tab}`} role="tabpanel" aria-labelledby={`finance-tab-${tab}`}>
        {tab === 'overview' &&
          (loading ? (
            <div className="finance-loading" role="status">
              {en ? 'Loading verified records…' : 'Đang tổng hợp sổ giao dịch…'}
            </div>
          ) : error ? (
            <div role="alert" className="finance-notice">
              {en ? 'Could not load this period.' : 'Chưa tải được báo cáo kỳ này.'}{' '}
              <button className="finance-link" onClick={refresh}>
                {en ? 'Retry' : 'Thử lại'}
              </button>
            </div>
          ) : (
            report && <ReportView report={report} onReconcile={() => setTab('orders')} />
          ))}
        {tab === 'orders' && <ReconcileOrders range={range} onChange={refresh} />}
        {tab === 'expenses' && <ExpenseWorkspace range={range} onChange={refresh} />}
      </section>
    </div>
  );
}
