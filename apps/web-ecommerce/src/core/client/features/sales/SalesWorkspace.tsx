'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/i18n/navigation';
import Image from 'next/image';
import Api from '@/core/client/api/Api';
import TextField from '@/components/FormElements/TextField';
import AdminIcon from '@/components/Admin/AdminIcon';
import { formatVND } from '@/shared/server/utils/utils';
import { primaryButtonClassName } from '@/core/client/features/auth/components/AuthCard';
import './sales-admin.css';

interface Candidate {
  id: number;
  name: string;
  sku: string;
  imageUrl: string;
  price: number;
  costVnd: number;
  stock: number;
  ageDays: number;
  scale?: string;
  currentDiscount: number;
  maximumSafePercent: number;
}
interface Campaign {
  id: number;
  title: string;
  description: string;
  kind: string;
  startsAt: string;
  endsAt: string;
  revokedAt?: string;
  settings: { products?: { id: number; sku: string; percent: number; price: number }[] };
}
interface WeeklyRule {
  enabled: boolean;
  minAgeDays: number;
  productLimit: number;
  maxPercent: number;
}
const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();

export default function SalesWorkspace() {
  const [products, setProducts] = useState<Candidate[]>([]),
    [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [rule, setRule] = useState<WeeklyRule>({ enabled: false, minAgeDays: 60, productLimit: 12, maxPercent: 25 });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState(''),
    [oldOnly, setOldOnly] = useState(false);
  const [title, setTitle] = useState(''),
    [description, setDescription] = useState('');
  const [percent, setPercent] = useState(10);
  const [start, setStart] = useState(() => localDate(new Date()));
  const [end, setEnd] = useState(() => localDate(new Date(Date.now() + 7 * 86400_000)));
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [stoppingId, setStoppingId] = useState<number>();
  const requestKey = useRef('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, events] = await Promise.all([Api.get('/admin/sales/candidates'), Api.get('/admin/sales')]);
      setProducts(catalog.data);
      setSelected((current) => new Set([...current].filter((id) => catalog.data.some((p: Candidate) => p.id === id))));
      setCampaigns(events.data.campaigns);
      setRule(events.data.weeklyRule);
      setError('');
    } catch {
      setError('Chưa thể tải dữ liệu ưu đãi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const shown = useMemo(
    () =>
      products.filter(
        (p) =>
          (!oldOnly || p.ageDays >= 60) && fold(`${p.name} ${p.sku} ${p.scale || ''}`).includes(fold(search.trim())),
      ),
    [products, oldOnly, search],
  );
  const chosen = products.filter((p) => selected.has(p.id));
  const invalid = chosen.filter((p) => p.maximumSafePercent < percent);
  const eligible = shown.filter((p) => p.maximumSafePercent >= percent);
  const all = eligible.length > 0 && eligible.every((p) => selected.has(p.id));
  const toggle = (id: number) => {
    requestKey.current = '';
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    requestKey.current = '';
    setSelected((current) => {
      const next = new Set(current);
      eligible.forEach((p) => (all ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  };
  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!title.trim() || !chosen.length || invalid.length || !start || !end || new Date(end) <= new Date(start)) {
      setError('Cần tên sự kiện, sản phẩm đủ điều kiện và thời gian hợp lệ.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    requestKey.current ||= crypto.randomUUID();
    try {
      await Api.post('/admin/sales', {
        title,
        description,
        percent,
        productIds: chosen.map((p) => p.id),
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        requestKey: requestKey.current,
      });
      requestKey.current = '';
      setTitle('');
      setDescription('');
      setSelected(new Set());
      await load();
      setNotice('Đã lưu sự kiện. Ưu đãi xuất hiện trên shop khi đến thời gian bắt đầu.');
    } catch {
      setError('Chưa thể lưu. Kiểm tra lại giá sản phẩm, giá vốn và mức giảm cho phép.');
    } finally {
      setBusy(false);
    }
  };
  const saveRule = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await Api.post('/admin/sales/weekly-rule', rule);
      setNotice('Đã lưu lịch chọn hàng. Hệ thống kiểm tra trong vòng một phút.');
    } catch {
      setError('Chưa thể lưu thiết lập hàng tuần.');
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (id: number) => {
    setBusy(true);
    try {
      await Api.post(`/admin/sales/${id}/cancel`);
      setStoppingId(undefined);
      await load();
      setNotice('Đã dừng sự kiện. Đơn đã xác nhận giữ nguyên giá.');
    } catch {
      setError('Chưa thể dừng sự kiện.');
    } finally {
      setBusy(false);
    }
  };
  const brief = async (campaign: Campaign) => {
    const lines = (campaign.settings.products || [])
      .map((p) => `${p.sku}: -${p.percent}% · ${formatVND(p.price - Math.round((p.price * p.percent) / 100), 'vi')}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(
        `${campaign.title}\n${campaign.description || ''}\n${new Date(campaign.startsAt).toLocaleString('vi-VN')} → ${new Date(campaign.endsAt).toLocaleString('vi-VN')}\n${lines}\n${window.location.origin}/vi/su-kien/${campaign.id}\nMã thành viên áp dụng theo điều kiện. Số lượng theo tồn kho thực tế.`,
      );
      setNotice('Đã sao chép brief để tạo bài marketing.');
    } catch {
      setError('Trình duyệt chưa cho phép sao chép.');
    }
  };
  return (
    <div className="admin-page sales-admin">
      <header className="sa-heading">
        <div>
          <p>MARKETING / SALES STUDIO</p>
          <h1>Ưu đãi khiến khách muốn quay lại</h1>
          <span>Lên lịch sự kiện, đẩy hàng tồn lâu và kiểm soát mức giảm an toàn.</span>
        </div>
        <Link href="/uu-dai" className="sa-outline">
          Xem ưu đãi trên shop ↗
        </Link>
      </header>
      <div className="sa-stats">
        <div>
          <span>Đang chạy / sắp diễn ra</span>
          <strong>{campaigns.filter((c) => !c.revokedAt && new Date(c.endsAt).getTime() > Date.now()).length}</strong>
        </div>
        <div>
          <span>Sản phẩm tồn từ 60 ngày</span>
          <strong>{products.filter((p) => p.ageDays >= 60).length}</strong>
        </div>
        <div>
          <span>Đã chọn cho sự kiện</span>
          <strong>
            {chosen.length}
            <small> mô hình</small>
          </strong>
        </div>
      </div>
      {notice && (
        <p className="sa-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="sa-error" role="alert">
          {error}
          {!products.length && (
            <button type="button" onClick={load}>
              Thử lại
            </button>
          )}
        </div>
      )}
      <form onSubmit={publish} className="sa-composer" aria-busy={loading || busy}>
        <section className="sa-panel">
          <div className="sa-panel-head">
            <div>
              <span className="sa-step">01</span>
              <h2>Chọn dàn kit lên sóng</h2>
            </div>
            <span>
              {selected.size} đã chọn
            </span>
          </div>
          <div className="sa-search">
            <AdminIcon name="search" size={19} />
            <input
              aria-label="Tìm sản phẩm"
              type="search"
              placeholder="Tìm tên, mã SKU, tỉ lệ…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sa-picker-toolbar">
            <button type="button" onClick={toggleAll} disabled={!eligible.length || loading}>
              {all ? 'Bỏ chọn kết quả' : 'Chọn tất cả phù hợp'}
            </button>
            <label>
              <input type="checkbox" checked={oldOnly} onChange={(e) => setOldOnly(e.target.checked)} />
              Tồn ≥ 60 ngày
            </label>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())}>
                Bỏ chọn hết
              </button>
            )}
          </div>
          <div className="sa-product-list">
            {loading ? (
              <p role="status">Đang tải sản phẩm…</p>
            ) : shown.length === 0 ? (
              <p>Không có sản phẩm phù hợp. Thử từ khóa khác.</p>
            ) : (
              shown.map((p) => (
                <label
                  key={p.id}
                  className={`sa-product ${selected.has(p.id) ? 'is-selected' : ''} ${p.maximumSafePercent < percent ? 'is-limited' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    disabled={p.maximumSafePercent === 0}
                  />
                  <Image unoptimized src={p.imageUrl} alt="" width={56} height={56} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.sku} · {p.stock} còn lại · {p.ageDays} ngày tồn
                    </small>
                    <small>
                      {formatVND(p.price, 'vi')} →{' '}
                      <b>{formatVND(p.price - Math.round((p.price * percent) / 100), 'vi')}</b>
                    </small>
                  </span>
                  {p.currentDiscount > 0 && (
                    <small className="sa-existing-offer">
                      Đang sale {p.currentDiscount}%
                    </small>
                  )}
                  <span className="sa-safe">
                    <b>
                      Tối đa {p.maximumSafePercent}%
                    </b>
                    <small>
                      {p.maximumSafePercent < percent
                        ? 'Cần giảm mức sale'
                        : 'Đủ biên lợi nhuận'}
                    </small>
                  </span>
                </label>
              ))
            )}
          </div>
        </section>
        <section className="sa-panel sa-settings">
          <div className="sa-panel-head">
            <div>
              <span className="sa-step">02</span>
              <h2>Tạo lý do để chốt đơn</h2>
            </div>
          </div>
          <TextField
            label="Tên sự kiện"
            name="saleTitle"
            value={title}
            maxLength={120}
            required
            placeholder="Cuối tuần lên kit mới"
            onChange={(e) => {
              setTitle(e.target.value);
              requestKey.current = '';
            }}
          />
          <label className="sa-label">
            Thông điệp ngắn
            <textarea
              value={description}
              maxLength={1000}
              rows={2}
              placeholder="Điều gì làm dàn kit này đáng chốt?"
              onChange={(e) => {
                setDescription(e.target.value);
                requestKey.current = '';
              }}
            />
          </label>
          <div className="sa-discount">
            <label htmlFor="sale-percent">Giảm trực tiếp</label>
            <div>
              <input
                id="sale-percent"
                type="number"
                min={1}
                max={25}
                step={1}
                value={percent}
                onChange={(e) => {
                  setPercent(Number(e.target.value));
                  requestKey.current = '';
                }}
              />
              <span>%</span>
            </div>
            <div className="sa-presets">
              {[10, 12, 15, 20, 25].map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={percent === p}
                  onClick={() => {
                    setPercent(p);
                    requestKey.current = '';
                  }}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
          <TextField
            label="Bắt đầu lúc"
            type="datetime-local"
            name="saleStart"
            value={start}
            required
            onChange={(e) => {
              setStart(e.target.value);
              requestKey.current = '';
            }}
          />
          <TextField
            label="Kết thúc lúc"
            type="datetime-local"
            name="saleEnd"
            value={end}
            min={start}
            required
            onChange={(e) => {
              setEnd(e.target.value);
              requestKey.current = '';
            }}
          />
          <div className={`sa-summary ${invalid.length ? 'has-error' : ''}`}>
            <strong>
              {invalid.length
                ? `${invalid.length} sản phẩm vượt mức giảm an toàn`
                : `${chosen.length} mô hình sẵn sàng cho sự kiện`}
            </strong>
            <p>
              Hệ thống kiểm tra giá vốn hiện tại, giữ ít nhất 80% lợi nhuận chuẩn. Mã thành viên có thể cộng thêm khi tổng ưu đãi vẫn đủ điều kiện.
            </p>
          </div>
          <button
            className={primaryButtonClassName}
            disabled={busy || loading || !chosen.length || Boolean(invalid.length) || !title.trim()}
            type="submit"
          >
            {busy ? 'Đang lưu…' : 'Lên lịch sự kiện sale'}
          </button>
        </section>
      </form>
      <section className="sa-panel sa-weekly">
        <div>
          <p className="sa-eyebrow">SMART WEEKLY PICKS</p>
          <h2>Để kit tồn lâu tìm được chủ mới</h2>
          <p>
            Mỗi tuần từ thứ Hai, giờ Việt Nam. Hàng tồn lâu được ưu tiên mức giảm sâu hơn khi đủ biên lợi nhuận. Lần nhập mới nhất quyết định tuổi tồn.
          </p>
        </div>
        <label className="sa-toggle">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
          />
          Bật chọn sale hàng tuần
        </label>
        <div className="sa-weekly-fields">
          <TextField
            label="Tuổi tồn tối thiểu (ngày)"
            type="number"
            min={30}
            max={730}
            value={rule.minAgeDays}
            onChange={(e) => setRule({ ...rule, minAgeDays: Number(e.target.value) })}
          />
          <TextField
            label="Số mô hình mỗi tuần"
            type="number"
            min={1}
            max={100}
            value={rule.productLimit}
            onChange={(e) => setRule({ ...rule, productLimit: Number(e.target.value) })}
          />
          <TextField
            label="Mức giảm tối đa (%)"
            type="number"
            min={11}
            max={25}
            value={rule.maxPercent}
            onChange={(e) => setRule({ ...rule, maxPercent: Number(e.target.value) })}
          />
          <button type="button" className="sa-outline" disabled={busy || loading} onClick={saveRule}>
            Lưu lịch hàng tuần
          </button>
        </div>
      </section>
      <section className="sa-panel">
        <div className="sa-panel-head">
          <h2>Lịch sự kiện của shop</h2>
          <Link href="/admin/marketing" className="sa-text-link">
            Studio marketing ↗
          </Link>
        </div>
        <div className="sa-events">
          {!campaigns.length && (
            <p className="sa-empty">
              Sự kiện đầu tiên bắt đầu từ đây. Chọn sản phẩm và lên lịch ở trên.
            </p>
          )}
          {campaigns.map((c) => {
            const stopped = Boolean(c.revokedAt),
              ended = new Date(c.endsAt).getTime() <= Date.now(),
              future = new Date(c.startsAt).getTime() > Date.now();
            return (
              <article key={c.id}>
                <div>
                  <span className={`sa-status ${stopped || ended ? 'is-ended' : ''}`}>
                    {stopped
                      ? 'Đã dừng'
                      : ended
                        ? 'Đã kết thúc'
                        : future
                          ? 'Đã lên lịch'
                          : 'Đang chạy'}
                  </span>
                  <h3>{c.title}</h3>
                  <p>
                    {new Date(c.startsAt).toLocaleString('vi-VN')} → {new Date(c.endsAt).toLocaleString('vi-VN')}
                  </p>
                  <small>
                    {c.settings.products?.length || 0} mô hình tuyển chọn ·{' '}
                    {c.kind === 'weekly'
                      ? 'Tự động hàng tuần'
                      : 'Shop tuyển chọn'}
                  </small>
                </div>
                <div className="sa-event-actions">
                  <button type="button" onClick={() => brief(c)}>
                    Sao chép brief marketing
                  </button>
                  <Link href={`/su-kien/${c.id}`} target="_blank">
                    Xem sự kiện ↗
                  </Link>
                  {!stopped &&
                    !ended &&
                    (stoppingId === c.id ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => cancel(c.id)}>
                          Xác nhận dừng
                        </button>
                        <button type="button" onClick={() => setStoppingId(undefined)}>
                          Tiếp tục chạy
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setStoppingId(c.id)}>
                        Dừng sự kiện
                      </button>
                    ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}