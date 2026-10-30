'use client';
import AdminIcon from './AdminIcon';

export type ListKpi = {
  label: string;
  value: string;
  hint: string;
  icon: string;
  active?: boolean;
  onClick?: () => void;
  tone?: 'warning';
};

export default function AdminListKpis({
  items,
  loading,
  failed,
  onRetry,
}: {
  items: ListKpi[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="admin-list-overview" aria-label="Tổng quan" aria-busy={loading}>
      <div className="inventory-kpis">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`inventory-kpi has-icon${item.active ? ' is-active' : ''}${item.tone === 'warning' ? ' is-attention' : ''}`}
            onClick={item.onClick}
            disabled={loading || failed}
            aria-pressed={item.active ?? false}
          >
            <span className="inventory-kpi-label">
              <span className="inventory-kpi-icon">
                <AdminIcon name={item.icon} size={16} />
              </span>
              {item.label}
              <span className="list-kpi-arrow" aria-hidden="true">
                <AdminIcon name="arrow" size={14} />
              </span>
            </span>
            <span className="inventory-kpi-value">{loading || failed ? '—' : item.value}</span>
            <span className="inventory-kpi-hint">
              {loading ? 'Đang tải thống kê…' : failed ? 'Chưa tải được thống kê' : item.hint}
            </span>
          </button>
        ))}
      </div>
      {failed && (
        <div className="admin-load-error" role="alert">
          Không tải được thống kê. <button onClick={onRetry}>Thử lại</button>
        </div>
      )}
    </section>
  );
}
