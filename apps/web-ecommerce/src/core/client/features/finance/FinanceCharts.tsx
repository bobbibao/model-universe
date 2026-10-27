'use client';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import type { ApexOptions } from 'apexcharts';
import { ApexChart, CHART_FONT } from '@/components/Charts/ChartCard';
import SelectField from '@/components/FormElements/SelectField';
import { amount, categoryLabels, type Report } from './api';

const colors = ['#8b6ce0', '#20ad96', '#e6a24c', '#ec7b9b', '#65a4e8', '#b782e0'];
function useOptions(): ApexOptions {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () => setDark(document.body.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return {
    chart: {
      fontFamily: CHART_FONT,
      background: 'transparent',
      animations: { enabled: false },
      toolbar: { show: false },
      foreColor: dark ? '#b2aec1' : '#666d80',
      parentHeightOffset: 0,
    },
    theme: { mode: dark ? 'dark' : 'light' },
    colors,
    grid: { borderColor: dark ? '#40364f' : '#e8e8ef', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: dark ? 'dark' : 'light' },
    legend: { position: 'top', horizontalAlign: 'left', fontSize: '11px' },
    noData: { text: 'Chưa có số liệu trong kỳ' },
  };
}
const compact = (value: number) =>
  new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export function FinanceTrend({ report }: { report: Report }) {
  const en = useLocale() === 'en',
    base = useOptions(),
    [mode, setMode] = useState('performance');
  const rows = report.series;
  const series =
    mode === 'performance'
      ? [
          { name: en ? 'Net revenue' : 'Doanh thu thuần', data: rows.map((r) => r.netRevenueVnd) },
          {
            name: en ? 'Profit on recorded costs' : 'Lợi nhuận theo chi phí ghi nhận',
            data: rows.map((r) => r.profitVnd),
          },
        ]
      : [
          { name: en ? 'Verified net receipts' : 'Tiền thu ròng', data: rows.map((r) => r.verifiedCashNetVnd) },
          { name: en ? 'Recorded costs' : 'Chi phí ghi nhận', data: rows.map((r) => r.expenseVnd) },
        ];
  const options: ApexOptions = {
    ...base,
    stroke: { width: [3, 2], curve: 'straight' },
    markers: { size: rows.length <= 32 ? 3 : 0 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.18, opacityTo: 0.02 } },
    xaxis: {
      categories: rows.map((r) => r.date),
      tickAmount: Math.min(6, rows.length),
      labels: {
        rotate: 0,
        hideOverlappingLabels: true,
        formatter: (value) => `${String(value).slice(8, 10)}/${String(value).slice(5, 7)}`,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { formatter: compact } },
    tooltip: { ...base.tooltip, shared: true, intersect: false, y: { formatter: (value) => amount(value, en) } },
  };
  return (
    <section className="finance-card finance-chart-card">
      <div className="finance-card-heading">
        <div>
          <h2>{en ? 'Business trends' : 'Xu hướng kinh doanh'}</h2>
          <p>
            {en
              ? 'Switch metrics or click a legend to inspect a series.'
              : 'Chọn nhóm chỉ số, nhấn chú giải để ẩn/hiện đường biểu diễn.'}
          </p>
        </div>
        <div className="finance-segment">
          <button aria-pressed={mode === 'performance'} onClick={() => setMode('performance')}>
            Doanh thu & lợi nhuận
          </button>
          <button aria-pressed={mode === 'cash'} onClick={() => setMode('cash')}>
            Tiền thu & chi phí
          </button>
        </div>
      </div>
      <div role="img" aria-label="Biểu đồ doanh thu, lợi nhuận, tiền thu và chi phí theo thời gian">
        <ApexChart type="area" options={options} series={series} height={290} />
      </div>
      <p className="finance-caption">
        <strong>{report.granularity === 'month' ? 'Theo tháng trong kỳ đã lọc. ' : 'Theo ngày. '}</strong>
        {en
          ? 'Missing profit data remains unavailable. Recorded expenses are distinct from verified cash payments.'
          : 'Khoảng thiếu giá vốn không được vẽ thành lợi nhuận 0. Chi phí ghi nhận khác với tiền thực chi.'}
      </p>
      <details className="finance-method">
        <summary>Xem bảng số liệu</summary>
        <div className="finance-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Doanh thu thuần</th>
                <th>Lợi nhuận</th>
                <th>Tiền thu ròng</th>
                <th>Chi phí</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{amount(row.netRevenueVnd)}</td>
                  <td>{amount(row.profitVnd)}</td>
                  <td>{amount(row.verifiedCashNetVnd)}</td>
                  <td>{amount(row.expenseVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
export function FinanceCostChart({ report }: { report: Report }) {
  const base = useOptions(),
    rows = report.current.expenseGroups.filter((g) => g.amountVnd > 0);
  const options: ApexOptions = {
    ...base,
    labels: rows.map((r) => categoryLabels[r.category]),
    stroke: { width: 2, colors: ['transparent'] },
    legend: { ...base.legend, position: 'bottom' },
    plotOptions: {
      pie: {
        donut: {
          size: '74%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Khoản dương',
              formatter: () => amount(rows.reduce((sum, r) => sum + r.amountVnd, 0)),
            },
          },
        },
      },
    },
    tooltip: { ...base.tooltip, y: { formatter: (value) => amount(value) } },
  };
  return (
    <>
      <div role="img" aria-label="Biểu đồ tròn cơ cấu chi phí">
        {rows.length ? (
          <ApexChart type="donut" options={options} series={rows.map((r) => r.amountVnd)} height={270} />
        ) : (
          <p className="finance-empty">Chưa có khoản chi dương để phân bổ.</p>
        )}
      </div>
      <details className="finance-method">
        <summary>Chi tiết theo nhóm</summary>
        <dl className="finance-bridge">
          {report.current.expenseGroups.map((g) => (
            <div key={g.category}>
              <dt>{categoryLabels[g.category]}</dt>
              <dd>{amount(g.amountVnd)}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="finance-caption">
        Biểu đồ phân bổ các nhóm dương; nhóm âm do điều chỉnh vẫn được tính đầy đủ trong tổng chi phí.
      </p>
    </>
  );
}
export function FinancePromoChart({ report }: { report: Report }) {
  const base = useOptions(),
    c = report.current;
  const rows = [
    { label: 'Giảm trực tiếp sản phẩm', value: c.markdownVnd },
    { label: 'MEMBER10', value: c.promotions.memberVnd },
    { label: 'Voucher khác', value: c.promotions.voucherVnd },
    { label: 'Ưu đãi hạng', value: c.promotions.rankVnd },
    { label: 'Giảm đơn khác', value: c.promotions.unclassifiedVnd },
    { label: 'Hỗ trợ phí ship', value: c.shippingSupportVnd },
  ];
  const options: ApexOptions = {
    ...base,
    plotOptions: { bar: { horizontal: true, barHeight: '50%', borderRadius: 4, distributed: true } },
    legend: { show: false },
    xaxis: { categories: rows.map((r) => r.label), labels: { formatter: (value) => compact(Number(value)) } },
    yaxis: { labels: { maxWidth: 145 } },
    tooltip: { ...base.tooltip, y: { formatter: (value) => amount(value) } },
  };
  return (
    <div role="img" aria-label="Biểu đồ giá trị các hình thức ưu đãi">
      <ApexChart
        type="bar"
        options={options}
        series={[{ name: 'Giá trị ưu đãi', data: rows.map((r) => r.value) }]}
        height={270}
      />
      {c.markdownVnd === null && (
        <p className="finance-caption">Chưa có snapshot đầy đủ để xác định giảm trực tiếp trên sản phẩm.</p>
      )}
    </div>
  );
}
export function FinanceProductChart({ report }: { report: Report }) {
  const base = useOptions(),
    [metric, setMetric] = useState('quantity');
  const rows = metric === 'quantity' ? report.current.topProducts : report.current.topProductsByRevenue;
  const options: ApexOptions = {
    ...base,
    plotOptions: { bar: { horizontal: true, barHeight: '52%', borderRadius: 4 } },
    colors: ['#8b6ce0'],
    xaxis: {
      categories: rows.map((r) => r.name.replace(/[<>]/g, '')),
      labels: { formatter: (value) => compact(Number(value)) },
    },
    yaxis: { labels: { maxWidth: 180, style: { fontSize: '10px' } } },
    tooltip: {
      ...base.tooltip,
      y: { formatter: (value) => (metric === 'quantity' ? `${value} sản phẩm` : amount(value)) },
    },
  };
  return (
    <>
      <div className="finance-ranking-control">
        <SelectField
          label="Xếp theo"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          options={[
            { value: 'quantity', label: 'Số lượng giao' },
            { value: 'revenue', label: 'Tiền hàng trước voucher/hoàn' },
          ]}
        />
      </div>
      <div role="img" aria-label="Biểu đồ xếp hạng sản phẩm bán chạy">
        {rows.length ? (
          <ApexChart
            type="bar"
            options={options}
            series={[
              {
                name: metric === 'quantity' ? 'Số lượng giao' : 'Tiền hàng',
                data: rows.map((r) => (metric === 'quantity' ? r.quantity : r.merchandiseVnd)),
              },
            ]}
            height={Math.max(220, rows.length * 39)}
          />
        ) : (
          <p className="finance-empty">Chưa có hàng giao trong kỳ.</p>
        )}
      </div>
      <details className="finance-method">
        <summary>Xem danh sách sản phẩm</summary>
        <div className="finance-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Đã giao</th>
                <th>Tiền hàng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.productId}>
                  <td>{row.name}</td>
                  <td>{row.quantity}</td>
                  <td>{amount(row.merchandiseVnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
