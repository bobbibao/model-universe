'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import Link from '@/i18n/navigation';
import FinancePeriod, { currentFinanceRange } from './FinancePeriod';
import { financeApi, type Report } from './api';
import ReportView from './ReportView';
import AttentionBoard from '../dashboard/components/AttentionBoard';
import { useCurrentUser } from '@/shared/client/providers/CurrentUserProvider';

const greetingFor = (hour: number, en: boolean) => {
  if (en) return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  return hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
};

export default function BusinessDashboard() {
  const en = useLocale() === 'en',
    router = useRouter();
  const { user } = useCurrentUser();
  // Rendered after hydration: the greeting and date depend on the admin's clock, not the server's.
  const [today, setToday] = useState<Date>();
  useEffect(() => setToday(new Date()), []);
  const hour = today
    ? Number(today.toLocaleString('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }))
    : 12;
  const greeting = greetingFor(hour, en);
  const [range, setRange] = useState(currentFinanceRange),
    [report, setReport] = useState<Report>(),
    [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
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
  return (
    <div className="finance-workspace">
      {report?.developmentData && (
        <div className="finance-notice">
          <strong>Dữ liệu phát triển đã được gắn nhãn [DEV]</strong>
          <span>Đơn mẫu nằm trong database hiện tại, không phải thanh toán/giao hàng thật.</span>
        </div>
      )}
      {report?.developmentFixtures && (
        <div className="finance-notice">
          <strong>DỮ LIỆU PHÁT TRIỂN · Không phải giao dịch của shop</strong>
          <span>Database kiểm thử riêng</span>
        </div>
      )}
      <header className="finance-heading">
        <div>
          <p className="finance-eyebrow">
            MODEL UNIVERSE /{' '}
            {today
              ? today
                  .toLocaleDateString(en ? 'en-GB' : 'vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    timeZone: 'Asia/Ho_Chi_Minh',
                  })
                  .toUpperCase()
              : en
                ? 'BUSINESS'
                : 'KINH DOANH'}
          </p>
          <h1>
            {greeting}
            {user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p>
            {en
              ? 'What needs doing first, then revenue, profit and stock for the period.'
              : 'Việc cần xử lý trước, sau đó là doanh thu, lợi nhuận và tồn kho trong kỳ.'}
          </p>
        </div>
        <Link className="finance-button is-primary" href="/admin/orders/new">
          {en ? 'Create sale' : '+ Tạo đơn bán'}
        </Link>
      </header>
      <AttentionBoard en={en} />
      <h2 className="finance-section-title">{en ? 'Business results' : 'Kết quả kinh doanh'}</h2>
      <FinancePeriod range={range} onChange={setRange} loading={loading} />
      <div className="finance-dashboard-content" aria-busy={loading}>
        {loading ? (
          <p className="finance-loading" role="status">
            {en ? 'Loading reports…' : 'Đang tổng hợp báo cáo…'}
          </p>
        ) : error ? (
          <div role="alert" className="finance-notice">
            {en ? 'Could not load the report.' : 'Chưa tải được báo cáo.'}
            <button className="finance-link" onClick={() => setRevision((n) => n + 1)}>
              Thử lại
            </button>
          </div>
        ) : (
          report && <ReportView report={report} onReconcile={() => router.push('/admin/finance?tab=orders')} />
        )}
      </div>
    </div>
  );
}
