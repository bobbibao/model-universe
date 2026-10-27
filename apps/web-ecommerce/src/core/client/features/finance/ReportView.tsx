'use client';
import { useLocale } from 'next-intl';
import Link from '@/i18n/navigation';
import { amount, type Report } from './api';
import { FinanceTrend, FinanceCostChart, FinancePromoChart, FinanceProductChart } from './FinanceCharts';

export default function ReportView({ report, onReconcile }: { report: Report; onReconcile: () => void }) {
  const en = useLocale() === 'en',
    t = (vi: string, english: string) => (en ? english : vi);
  const current = report.current,
    previous = report.previous,
    q = current.quality;
  const warning =
    q.missingCostUnits +
    q.missingRestockUnits +
    q.unreviewedOrders +
    q.partnerUnits +
    q.mismatchOrders +
    q.missingDeliveryDates;
  const delta = (now: number | null, then: number | null) =>
    now === null || then === null || then === 0
      ? t('Chưa có kỳ gốc để so sánh', 'No comparable baseline')
      : `${now >= then ? '+' : ''}${(((now - then) / Math.abs(then)) * 100).toLocaleString(en ? 'en-GB' : 'vi-VN', { maximumFractionDigits: 1 })}% ${t('so với kỳ trước', 'vs prior period')}`;
  const exportReport = () => {
    const data = [
      ['MODEL UNIVERSE', `${report.from} → ${report.to}`],
      ['Chỉ tiêu', 'VND / số lượng'],
      ['Doanh thu thuần', current.netRevenueVnd],
      ['Tiền thu ròng đã xác nhận', current.verifiedCashNetVnd],
      ['Giá vốn đã đối soát', current.cogsVnd ?? 'Chưa đủ dữ liệu'],
      ['Chi phí đã ghi nhận', current.expenseVnd],
      ['Lợi nhuận theo chi phí đã ghi nhận', current.profitVnd ?? 'Chưa đủ dữ liệu'],
      ['Đơn đã giao', current.orders],
      ['Đơn chưa rà soát chi phí', q.unreviewedOrders],
      ['Ngày tạo báo cáo', report.generatedAt],
    ];
    const blob = new Blob(
      ['\uFEFF', data.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n')],
      { type: 'text/csv;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = `model-universe-finance-${report.from}-${report.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="finance-report">
      <div className="finance-report-meta">
        <span>
          {t('So sánh', 'Compared with')} {report.previousFrom} → {report.previousTo}
        </span>
        <button className="finance-link" onClick={exportReport}>
          {t('↓ Xuất báo cáo CSV', '↓ Export CSV')}
        </button>
      </div>
      <div className="finance-kpis">
        {[
          {
            title: t('Doanh thu thuần', 'Net revenue'),
            value: current.netRevenueVnd,
            prior: previous.netRevenueVnd,
            detail: t('Hàng đã giao + phí ship khách trả − hoàn', 'Delivered goods + customer shipping − refunds'),
          },
          {
            title: t('Tiền thu ròng đã xác nhận', 'Verified net receipts'),
            value: current.verifiedCashNetVnd,
            prior: previous.verifiedCashNetVnd,
            detail: t('Gồm cọc / giữ chỗ; không phải doanh thu', 'Includes deposits; distinct from revenue'),
          },
          {
            title: t('Chi phí đã ghi nhận', 'Recorded expenses'),
            value: current.expenseVnd,
            prior: previous.expenseVnd,
            detail: t(
              'Vận chuyển, đóng gói và vận hành; chưa gồm giá vốn',
              'Shipping, packing and operations; excludes COGS',
            ),
          },
          {
            title: t('Lợi nhuận theo chi phí ghi nhận', 'Profit on recorded costs'),
            value: current.profitVnd,
            prior: previous.profitVnd,
            detail:
              current.profitVnd === null
                ? current.orders === 0 &&
                  current.refundedOrders === 0 &&
                  current.expenseVnd === 0 &&
                  q.missingDeliveryDates === 0
                  ? t(
                      'Chưa có hàng giao hoặc chi phí ghi nhận trong kỳ',
                      'No deliveries or recorded expenses in this period',
                    )
                  : t('Chưa đủ hồ sơ đối soát', 'Incomplete reconciliation records')
                : t('Chưa bao gồm thuế thu nhập và chi phí chưa nhập', 'Before income tax and unrecorded costs'),
          },
        ].map((metric, i) => (
          <article className={`finance-kpi${i === 3 ? ' is-emphasis' : ''}`} key={metric.title}>
            <span>{metric.title}</span>
            <strong>{amount(metric.value, en)}</strong>
            <p>{metric.detail}</p>
            <small>{delta(metric.value, metric.prior)}</small>
          </article>
        ))}
      </div>
      <div className="finance-mini-metrics">
        <span>
          <strong>{current.orders}</strong>
          {t(' đơn đã giao', ' delivered orders')}
        </span>
        <span>
          {t('Giá trị đơn TB', 'Average order')} <strong>{amount(current.aovVnd, en)}</strong>
        </span>
        <span>
          {t('Biên lợi nhuận', 'Profit margin')}{' '}
          <strong>{current.marginPercent === null ? '—' : `${current.marginPercent.toFixed(1)}%`}</strong>
        </span>
        <span>
          <strong>{current.cancelledOrders}</strong> {t('đơn tạo trong kỳ đã hủy', 'created in period, cancelled')} ·{' '}
          <strong>{current.refundedOrders}</strong> {t('đơn phát sinh hoàn tiền', 'orders refunded')}
        </span>
      </div>
      {warning > 0 && (
        <div className="finance-notice">
          <div>
            <strong>{t('Báo cáo còn điểm cần đối chiếu', 'Records need reconciliation')}</strong>
            <p>
              {q.missingCostUnits} {t('sản phẩm thiếu giá vốn', 'units missing costs')} · {q.unreviewedOrders}{' '}
              {t('đơn chưa rà soát chi phí', 'orders not reviewed')}
              {q.missingRestockUnits
                ? ` · ${q.missingRestockUnits} ${t('sản phẩm nhập trả thiếu giá vốn', 'restocked units missing costs')}`
                : ''}
              {q.missingDeliveryDates
                ? ` · ${q.missingDeliveryDates} ${t('đơn thiếu ngày giao, chưa ghi doanh thu', 'orders without delivery dates, excluded from revenue')}`
                : ''}
              {q.partnerUnits
                ? ` · ${q.partnerUnits} ${t('sản phẩm đối tác chưa có quyết toán', 'partner units without settlement')}`
                : ''}
              {q.mismatchOrders
                ? ` · ${q.mismatchOrders} ${t('đơn lệch tổng tiền', 'orders with amount mismatches')}`
                : ''}
            </p>
          </div>
          <button className="finance-button" onClick={onReconcile}>
            {t('Đối soát ngay', 'Reconcile')}
          </button>
        </div>
      )}
      <div className="finance-grid">
        <FinanceTrend report={report} />
        <section className="finance-card">
          <div className="finance-card-heading">
            <h2>{t('Từ hàng bán đến lợi nhuận', 'Revenue to profit')}</h2>
          </div>
          <dl className="finance-bridge">
            {[
              [t('Tiền hàng trước voucher', 'Merchandise before vouchers'), current.soldMerchandiseVnd],
              [t('Giảm giá đơn / thành viên', 'Order & membership discounts'), -current.orderDiscountVnd],
              [t('Hoàn tiền hàng trong kỳ', 'Merchandise refunds in period'), -current.merchandiseRefundVnd],
              [t('Phí ship thu khách, sau ưu đãi / hoàn', 'Net customer shipping fees'), current.netShippingVnd],
              [t('Doanh thu thuần', 'Net revenue'), current.netRevenueVnd],
              [
                t('Giá vốn, trừ hàng đã nhập trả', 'COGS less restocked returns'),
                current.cogsVnd === null ? null : -current.cogsVnd,
              ],
              [t('Chi phí đã ghi nhận', 'Recorded expenses'), -current.expenseVnd],
              [t('Lợi nhuận theo chi phí ghi nhận', 'Profit on recorded costs'), current.profitVnd],
            ].map(([name, value], i) => (
              <div key={String(name)} className={i === 4 || i === 7 ? 'is-total' : ''}>
                <dt>{name}</dt>
                <dd>{amount(value as number | null, en)}</dd>
              </div>
            ))}
          </dl>
          <p className="finance-caption">
            {t(
              'Giảm trực tiếp trên sản phẩm đã nằm trong tiền hàng, không bị trừ lần hai.',
              'Product markdowns are already reflected in merchandise totals and are not subtracted twice.',
            )}
          </p>
        </section>
      </div>
      <div className="finance-grid is-halves">
        <section className="finance-card">
          <div className="finance-card-heading">
            <h2>{t('Ưu đãi đã sử dụng', 'Benefits used')}</h2>
            <span>{t('Theo đơn đã giao', 'Delivered orders')}</span>
          </div>
          <FinancePromoChart report={report} />
          <dl className="finance-bridge">
            <div className="is-total">
              <dt>Tổng giá trị ưu đãi</dt>
              <dd>{amount(current.promotions.totalVnd, en)}</dd>
            </div>
            <div>
              <dt>Shop tài trợ xác nhận từ snapshot</dt>
              <dd>{amount(current.promotions.confirmedShopFundedVnd, en)}</dd>
            </div>
          </dl>
          <p className="finance-caption">
            {q.missingListUnits
              ? t(
                  `${q.missingListUnits} sản phẩm thiếu snapshot giá gốc; chưa thể tính tổng ưu đãi.`,
                  `${q.missingListUnits} units lack list-price snapshots; total benefits are unavailable.`,
                )
              : t(
                  'Giá trị ưu đãi không phải một khoản chi phí cộng thêm vào cầu lợi nhuận.',
                  'Benefit value is not added again as an expense.',
                )}{' '}
            {t('Không suy đoán nguồn tài trợ của dữ liệu cũ.', 'Historical funding is never inferred.')}
          </p>
        </section>
        <section className="finance-card">
          <div className="finance-card-heading">
            <h2>{t('Cơ cấu chi phí', 'Recorded cost mix')}</h2>
            <span>{amount(current.expenseVnd, en)}</span>
          </div>
          <FinanceCostChart report={report} />
          <p className="finance-caption">
            {t(
              'Ghi nhận cả chi phí đơn hủy và chi phí vận hành độc lập. Chứng từ đảo được bù trừ đúng kỳ gốc.',
              'Includes cancelled-order and operating costs. Reversals offset the original period.',
            )}
          </p>
        </section>
      </div>
      <div className="finance-grid is-halves">
        <section className="finance-card">
          <div className="finance-card-heading">
            <h2>{t('Mô hình bán chạy', 'Best-selling models')}</h2>
            <span>
              {current.soldUnits} {t('sản phẩm', 'units')}
            </span>
          </div>
          <FinanceProductChart report={report} />
          <p className="finance-caption">
            {t(
              'Tiền hàng trước voucher cấp đơn và hoàn tiền; không dùng để xếp hạng lợi nhuận SKU.',
              'Merchandise before order vouchers and refunds; not a SKU profit ranking.',
            )}
          </p>
        </section>
        <section className="finance-card">
          <div className="finance-card-heading">
            <h2>{t('Vốn đang nằm trong kho', 'Capital tied up in inventory')}</h2>
            <Link className="finance-link" href="/admin/stock">
              {t('Mở kho →', 'Inventory →')}
            </Link>
          </div>
          <div className="finance-inventory">
            <div>
              <strong>{report.inventory.units}</strong>
              <span>{t('sản phẩm trong kho hiện tại', 'units currently in stock')}</span>
            </div>
            <div>
              <strong>{amount(report.inventory.referenceValueVnd, en)}</strong>
              <span>
                {t(
                  'Giá trị tham chiếu đã biết, chưa phải định giá tồn kho',
                  'Known reference value, not an inventory valuation',
                )}
              </span>
            </div>
          </div>
          <p className="finance-caption">
            {report.inventory.uncostedUnits} {t('sản phẩm thiếu giá vốn', 'units without cost')} ·{' '}
            {report.inventory.undatedUnits}{' '}
            {t('sản phẩm chưa có ngày nhập xác nhận', 'units without a verified receipt date')}
          </p>
          {report.inventory.aging.length ? (
            <ul className="finance-aging">
              {report.inventory.aging.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                  <span>
                    {p.stock} · {p.lastReceiptAt.slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="finance-empty">
              {t(
                'Chưa có mẫu ngừng nhập bổ sung trên 90 ngày được xác định từ hồ sơ.',
                'No models without replenishment for over 90 days are identified.',
              )}
            </p>
          )}
          <p className="finance-caption">
            {t(
              'Tín hiệu chậm nhập bổ sung dùng ngày nhập gần nhất có chứng từ, không suy ra tuổi từng món. Số tồn là hiện tại, không phải cuối kỳ đã chọn.',
              'Replenishment age uses the latest verified receipt, not the age of individual units. Inventory is current, not a historical period-end balance.',
            )}
          </p>
        </section>
      </div>
      <details className="finance-card finance-method">
        <summary>{t('Công thức & nguồn dữ liệu', 'Methodology & sources')}</summary>
        <p>
          {t(
            'Doanh thu ghi theo deliveredAt của đơn DELIVERED. Hoàn hàng dùng order_refund đã xác nhận theo ngày phát sinh; return_item.refundAmount chỉ là đề xuất, không được trừ thêm. Giá vốn chỉ đảo khi có restockedAt. Tiền thu ròng cộng các sổ order_receipt, order_prepayment và reservation_payment rồi trừ khoản hoàn đã xác nhận; không dùng paymentStatus làm bằng chứng tiền về. Thuế thu hộ không phải doanh thu. Giá vốn chỉ gồm tiền mua hàng; đóng gói, sửa chữa, vận chuyển ghi riêng để tránh trùng.',
            'Revenue uses deliveredAt on DELIVERED orders. Verified order_refund events reduce revenue when posted; proposed return amounts do not. COGS reverses only on confirmed restocking. Net receipts sum verified receipt, prepayment and reservation ledgers less refunds; paymentStatus is not proof of cash. Tax collected is excluded from revenue. COGS contains acquisition costs only; packing, repairs and shipping are recorded separately.',
          )}
        </p>
        <p>
          {t(
            'Báo cáo quản trị theo dữ liệu hiện có, không thay thế báo cáo kế toán/thuế. Sửa đối soát hoặc đảo chi phí có thể cập nhật kết quả kỳ cũ, luôn giữ lịch sử phiên bản.',
            'A management report based on available records, not statutory accounts. Reconciliations and reversals may restate past periods with version history retained.',
          )}
        </p>
      </details>
    </div>
  );
}
