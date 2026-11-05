// The service FAQ shown on /services; the page's FAQPage data is built from the same list so both always match.
export interface FaqItem {
  id: string;
  category: 'buyback' | 'pawn' | 'hold' | 'valuation';
  question: string;
  answer: string;
  badge: string;
}

export const FAQ_LIST: FaqItem[] = [
  {
    id: 'buyback-flow',
    category: 'buyback',
    badge: 'Thu mua',
    question: 'Quy trình gửi yêu cầu thu mua mô hình diễn ra như thế nào?',
    answer:
      'Quy trình gồm 4 bước: 1) Điền thông tin và tải ảnh chụp mô hình qua form online; 2) Nhận Báo giá sơ bộ trong vòng 2-4 giờ; 3) Mang mô hình đến showroom hoặc gửi qua bưu điện/shipper; 4) Chuyên viên kiểm tra thực tế và chuyển khoản thanh toán trong 15-30 phút sau khi chốt giá.',
  },
  {
    id: 'valuation-criteria',
    category: 'valuation',
    badge: 'Định giá',
    question: 'Định giá thu mua mô hình dựa trên những tiêu chí nào?',
    answer:
      'Định giá dựa trên 5 tiêu chí rõ ràng: Độ nguyên vẹn của phụ kiện & vũ khí; Tình trạng khớp và nhựa (khớp lỏng, gãy chốt, dán keo); Tình trạng hộp & sách hướng dẫn; Mức độ hoàn thiện (nguyên bản, ráp chay, kẻ lằn, sơn dặm hay sơn toàn phần); và giá thị trường thực tế của kit.',
  },
  {
    id: 'hold-policy',
    category: 'hold',
    badge: 'Giữ hàng',
    question: 'Dịch vụ Giữ mô hình (Hold / Reservation) hoạt động ra sao? Cọc bao nhiêu?',
    answer:
      'Khách hàng cọc tối thiểu 20% giá trị sản phẩm để giữ mô hình từ 15 ngày đến 90 ngày. Sản phẩm được niêm phong giữ riêng cho bạn và cam kết không bán cho khách hàng khác. Bạn có thể tất toán phần còn lại bất kỳ lúc nào để nhận hàng.',
  },
  {
    id: 'pawn-safety',
    category: 'pawn',
    badge: 'Cầm đồ',
    question: 'Dịch vụ Cầm đồ mô hình có bảo quản an toàn không? Biểu phí ra sao?',
    answer:
      'Mô hình được lưu giữ trong tủ chống ẩm chuyên dụng với camera giám sát 24/7 và niêm phong có chữ ký hai bên. Phí dịch vụ 0.3%/ngày, minh bạch, không phụ phí ẩn. Bạn có thể chuộc lại mô hình bất cứ lúc nào trong thời hạn hợp đồng.',
  },
  {
    id: 'imperfect-models',
    category: 'buyback',
    badge: 'Thu mua',
    question: 'Mô hình bị gãy, dán keo, thiếu phụ kiện hoặc mất hộp shop có nhận không?',
    answer:
      'Có. Model Universe nhận thu mua cả mô hình 2hand, ráp dở, thiếu part hoặc không hộp. Hệ thống có bảng đối chiếu khấu trừ cụ thể theo từng lỗi thực tế để đưa ra mức giá hợp lý nhất.',
  },
  {
    id: 'payout-speed',
    category: 'valuation',
    badge: 'Thanh toán',
    question: 'Thời gian giải ngân tiền thu mua là bao lâu? Nhận tiền qua đâu?',
    answer:
      'Sau khi bạn xác nhận đồng ý với báo giá kiểm tra thực tế, tiền sẽ được chuyển khoản nhanh 24/7 qua VietQR trong 15-30 phút hoặc nhận tiền mặt trực tiếp tại showroom.',
  },
  {
    id: 'cancel-policy',
    category: 'buyback',
    badge: 'Hủy yêu cầu',
    question: 'Tôi có thể hủy yêu cầu thu mua giữa chừng được không?',
    answer:
      'Có. Bạn có quyền hủy yêu cầu bất kỳ lúc nào trước khi ký biên bản chuyển quyền sở hữu. Nếu mô hình đã gửi đến showroom mà bạn đổi ý, shop sẽ hoàn trả nguyên vẹn mô hình cho bạn.',
  },
  {
    id: 'remote-shipping',
    category: 'valuation',
    badge: 'Giao nhận',
    question: 'Shop có hỗ trợ nhận mô hình từ xa qua bưu điện hoặc shipper không?',
    answer:
      'Có. Khách hàng ngoài TP.HCM có thể gửi bưu kiện qua Viettel Post, GHTK, VNPost hoặc các đơn vị chuyển phát nhanh. Kỹ thuật viên sẽ quay video khui hộp đối chiếu và cập nhật hình ảnh kiểm tra trực tiếp lên trang tra cứu.',
  },
];
