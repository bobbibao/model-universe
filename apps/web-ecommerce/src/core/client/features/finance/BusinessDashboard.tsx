'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import Link from '@/i18n/navigation';
import FinancePeriod, { currentFinanceRange } from './FinancePeriod';
import { financeApi, type Report } from './api';
import ReportView from './ReportView';

export default function BusinessDashboard() {
  const en = useLocale() === 'en',
    router = useRouter();
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
          <p className="finance-eyebrow">MODEL UNIVERSE / {en ? 'BUSINESS' : 'KINH DOANH'}</p>
          <h1>{en ? 'Business overview' : 'Tổng quan kinh doanh'}</h1>
          <p>
            {en
              ? 'Revenue, profit and business performance.'
              : 'Doanh thu, lợi nhuận và hiệu quả hoạt động của cửa hàng.'}
          </p>
        </div>
        <Link className="finance-button is-primary" href="/admin/orders/new">
          {en ? 'Create sale' : '+ Tạo đơn bán'}
        </Link>
      </header>
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
