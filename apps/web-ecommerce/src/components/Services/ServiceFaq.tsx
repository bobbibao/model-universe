'use client';

import React, { useMemo, useState } from 'react';
import AdminIcon from '@/components/Admin/AdminIcon';

interface FaqItem {
  id: string;
  category: 'buyback' | 'pawn' | 'hold' | 'valuation';
  question: string;
  answer: string;
  badge: string;
}

const FAQ_LIST: FaqItem[] = [
  {
    id: 'buyback-flow',
    category: 'buyback',
    badge: 'Thu mua & Ký gửi',
    question: 'Quy trình gửi yêu cầu thu mua mô hình diễn ra như thế nào?',
    answer:
      'Quy trình gồm 4 bước tinh gọn: 1) Bạn điền thông tin và tải ảnh chụp mô hình qua form online; 2) Shop gửi Báo giá sơ bộ trong vòng 2-4 giờ; 3) Bạn mang mô hình đến showroom hoặc gửi qua bưu điện/shipper; 4) Chuyên viên kiểm định thực tế và chuyển khoản thanh toán ngay trong 15-30 phút sau khi chốt giá.',
  },
  {
    id: 'valuation-criteria',
    category: 'valuation',
    badge: 'Định giá & Kiểm định',
    question: 'Định giá thu mua mô hình dựa trên các tiêu chí nào?',
    answer:
      'Model Universe áp dụng hệ thống định giá minh bạch dựa trên 5 yếu tố: Độ nguyên vẹn của phụ kiện & vũ khí; Tình trạng khớp/nhựa (lỏng khớp, gãy chốt, dán keo 502); Tình trạng hộp & sách hướng dẫn; Mức độ hoàn thiện (nguyên bản, ráp chay, kẻ lằn, sơn dặm hay full repaint); và giá trị thị trường thực tế của kit.',
  },
  {
    id: 'hold-policy',
    category: 'hold',
    badge: 'Giữ hàng & Đặt cọc',
    question: 'Dịch vụ Giữ mô hình (Hold / Reservation) hoạt động ra sao? Cọc bao nhiêu?',
    answer:
      'Bạn chỉ cần cọc tối thiểu 20% giá trị sản phẩm để giữ mô hình yêu thích từ 15 ngày đến 90 ngày. Trong suốt thời gian này, sản phẩm được niêm phong khóa kho riêng cho bạn và cam kết không bán cho bất kỳ khách hàng nào khác. Bạn có thể thanh toán phần còn lại bất kỳ lúc nào để nhận hàng.',
  },
  {
    id: 'pawn-safety',
    category: 'pawn',
    badge: 'Cầm đồ & Bảo quản',
    question: 'Dịch vụ Cầm đồ mô hình có bảo quản an toàn không? Biểu phí ra sao?',
    answer:
      'Mô hình ký gửi cầm đồ được bảo quản trong tủ chống ẩm chuyên dụng với camera an ninh 24/7 và dán tem niêm phong có chữ ký hai bên. Phí dịch vụ chỉ 0.3%/ngày, minh bạch tuyệt đối, không phát sinh chi phí ẩn. Bạn có thể chuộc lại mô hình bất cứ lúc nào trong thời hạn hợp đồng.',
  },
  {
    id: 'imperfect-models',
    category: 'buyback',
    badge: 'Thu mua & Ký gửi',
    question: 'Mô hình bị gãy, dán keo, thiếu phụ kiện hoặc mất hộp shop có nhận không?',
    answer:
      'Có! Model Universe nhận thu mua cả mô hình 2hand, ráp dở, thiếu part hoặc không hộp. Hệ thống có bảng đối chiếu khấu trừ công khai, minh bạch theo từng lỗi thực tế và vẫn đưa ra mức giá tốt nhất, hợp lý nhất cho người chơi.',
  },
  {
    id: 'payout-speed',
    category: 'valuation',
    badge: 'Thanh toán & Giải ngân',
    question: 'Thời gian giải ngân tiền thu mua là bao lâu? Nhận tiền qua đâu?',
    answer:
      'Ngay sau khi bạn nhấn xác nhận chuyển quyền sở hữu trên báo giá kiểm định thực tế, tiền sẽ được chuyển khoản nhanh 24/7 qua VietQR trong vòng 15-30 phút hoặc nhận tiền mặt trực tiếp tại quầy theo nhu cầu của bạn.',
  },
  {
    id: 'cancel-policy',
    category: 'buyback',
    badge: 'Hủy & Thay đổi',
    question: 'Tôi có thể hủy yêu cầu thu mua/ký gửi giữa chừng được không?',
    answer:
      'Hoàn toàn được! Bạn có toàn quyền hủy yêu cầu bất kỳ lúc nào trước khi xác nhận chuyển quyền sở hữu. Nếu mô hình đã gửi đến showroom mà bạn đổi ý, shop sẽ hoàn trả nguyên vẹn mô hình cho bạn.',
  },
  {
    id: 'remote-shipping',
    category: 'valuation',
    badge: 'Giao nhận toàn quốc',
    question: 'Shop có hỗ trợ nhận mô hình từ xa qua bưu điện hoặc shipper không?',
    answer:
      'Có. Khách hàng ngoài TP.HCM có thể gửi bưu kiện qua Viettel Post, GHTK, VNPost hoặc các đơn vị chuyển phát nhanh. Khi nhận kiện hàng, kỹ thuật viên sẽ quay video khui hộp đối chiếu và cập nhật hình ảnh kiểm định trực tiếp lên trang tra cứu cá nhân của bạn.',
  },
];

type CategoryFilter = 'all' | 'buyback' | 'pawn' | 'hold' | 'valuation';

export default function ServiceFaq() {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    'buyback-flow': true,
    'hold-policy': true,
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredFaqs = useMemo(() => {
    return FAQ_LIST.filter((item) => {
      const matchCat = activeCategory === 'all' || item.category === activeCategory;
      const matchQuery =
        !searchTerm.trim() ||
        item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.badge.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [activeCategory, searchTerm]);

  return (
    <section className="service-faq-container rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-strokedark dark:bg-boxdark sm:p-8">
      {/* FAQ Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 dark:border-strokedark sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
            <AdminIcon name="spark" size={14} />
            <span>Hỏi đáp & Hướng dẫn dịch vụ</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Câu hỏi thường gặp (FAQ)
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Giải đáp nhanh chóng, minh bạch về quy trình thu mua, cầm đồ, giữ hàng và kiểm định mô hình.
          </p>
        </div>

        {/* Live Search Input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm câu hỏi..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:outline-hidden dark:border-strokedark dark:bg-meta-4 dark:text-white"
          />
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="my-5 flex flex-wrap gap-2">
        {(
          [
            ['all', 'Tất cả câu hỏi'],
            ['buyback', 'Thu mua & Ký gửi'],
            ['hold', 'Giữ hàng & Đặt cọc'],
            ['pawn', 'Cầm đồ & Bảo quản'],
            ['valuation', 'Định giá & Giải ngân'],
          ] as const
        ).map(([key, label]) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-meta-4 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* FAQ Accordion List */}
      <div className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-strokedark">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Không tìm thấy câu hỏi phù hợp với từ khóa &ldquo;{searchTerm}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setActiveCategory('all');
              }}
              className="mt-2 text-xs font-bold text-purple-600 hover:underline dark:text-purple-400"
            >
              Xóa bộ lọc & xem tất cả câu hỏi
            </button>
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isExpanded = !!expandedIds[faq.id];
            return (
              <div
                key={faq.id}
                className={`overflow-hidden rounded-xl border transition-all ${
                  isExpanded
                    ? 'border-purple-200 bg-purple-50/20 shadow-xs dark:border-purple-900/60 dark:bg-purple-950/10'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-strokedark dark:bg-boxdark dark:hover:border-slate-600'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(faq.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-meta-4 dark:text-slate-300">
                      {faq.badge}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white sm:text-base">
                      {faq.question}
                    </h3>
                  </div>
                  <span
                    className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-transform dark:bg-meta-4 dark:text-slate-400 ${
                      isExpanded ? 'rotate-180 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' : ''
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-purple-100/60 px-4 pb-5 pt-3 dark:border-purple-900/40 sm:px-5">
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-sm">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Still Have Questions CTA */}
      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-strokedark dark:bg-meta-4 sm:flex-row sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-purple-600 text-white shadow-xs">
            <AdminIcon name="support" size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Bạn cần hỗ trợ thêm trường hợp riêng?</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đội ngũ kỹ thuật viên và chuyên viên định giá sẵn sàng giải đáp 1:1 qua Zalo hoặc Hotline.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="https://zalo.me/0373498729"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0068FF] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0055d4]"
          >
            <span>Nhắn Zalo tư vấn</span>
            <span>↗</span>
          </a>
          <a
            href="tel:+84373498729"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-100 dark:border-strokedark dark:bg-boxdark dark:text-white"
          >
            <span>Hotline: 0373 498 729</span>
          </a>
        </div>
      </div>
    </section>
  );
}
