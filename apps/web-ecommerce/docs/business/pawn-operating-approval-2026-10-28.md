> **Bản lịch sử v2 — đã được thay thế đối với hồ sơ mới:** chủ shop yêu cầu khôi phục 0,3%/ngày. Xem [bản sửa đổi](pawn-rate-0-3-amendment-2026-10-28.md). Giữ nội dung dưới đây để đối chiếu các snapshot 0%.

# MU-PAWN-OPS-20261028 — Phê duyệt vận hành nội bộ

Nguồn ủy quyền: chủ shop yêu cầu trong phiên làm việc ngày 28/10/2026 tự đề xuất và tạo hồ sơ, hướng tới nghiệp vụ thật, thuận tiện và an toàn. Đây là quyết định cấu hình vận hành nội bộ; không phải giấy phép kinh doanh, chứng nhận cơ quan nhà nước hoặc ý kiến của luật sư.

## Quyết định áp dụng cho hồ sơ mới

- Khoản cầm dự kiến: C50 = ROUND(S × 50%), đúng SKU/tổ hợp được shop duyệt; kiểm hàng và quyền sở hữu trước khoản cầm cuối.
- Chính sách mở đầu: **0% lãi, không phí ẩn**. Không thu mức lãi kép 0,3%/ngày từng dùng để tính tham khảo. Giữ mã bộ máy tính cũ để tương thích API, nhưng snapshot `dailyRateBasisPoints=0` là giá trị thực sự quyết định không phát sinh lãi ở cả bảng kê và lịch sử dòng tiền.
- `approvalType=owner_operational`; trường tương thích `legalMode=approved` có nghĩa đã mở cổng nghiệp vụ theo phê duyệt nội bộ này, không chứng nhận pháp lý bên ngoài. Người chịu trách nhiệm trên audit là tài khoản chủ shop theo ủy quyền; không tạo người phê duyệt giả.
- Không tự giải ngân. Shop kiểm giấy tờ, quyền sở hữu, ký điều khoản, nhận hàng và Finance ghi nhận khoản tiền thực chuyển có tham chiếu ngân hàng.
- Gia hạn phải được duyệt; mức lãi hiện tại 0% nên không yêu cầu credit lãi không tồn tại. Chuộc trước hạn chỉ trả gốc còn lại. Không tự phạt, tịch thu hoặc thanh lý.
- Hàng đang cầm không được bán. Tranh chấp, thông báo, chuyển quyền sở hữu và kiểm duyệt nhập kho vẫn có lịch sử và bước duyệt riêng.
- Hợp đồng cũ giữ nguyên snapshot, không sửa số tiền/lãi đã thỏa thuận. Hồ sơ chưa giải ngân có thể được shop báo giá lại theo chính sách mới và khách chấp thuận lại.

## Căn cứ lựa chọn mức 0%

Mức lãi 0,3%/ngày vượt xa mức trần dân sự thông thường 20%/năm, nên không tự chuyển công thức tham khảo đó thành khoản thu thực tế. [Hướng dẫn Chính phủ về lãi suất dân sự](https://baochinhphu.vn/huong-dan-ap-dung-phap-luat-ve-lai-suat-trong-giao-dich-dan-su-102248799.htm).

Mọi thay đổi lãi/phí sau này phải có phiên bản, điều khoản minh bạch và sự chấp thuận của khách, không ghi ngược vào hợp đồng đã giải ngân.
