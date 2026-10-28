# MU-PAWN-RATE-20261028 — Khôi phục 0,3%/ngày theo chỉ định chủ shop

Nguồn quyết định: chủ shop yêu cầu rõ trong phiên làm việc ngày 28/10/2026 áp dụng lại 0,3%/ngày theo tài liệu. Thay chính sách mặc định 0% v2 đối với **báo giá/hợp đồng mới**. Không sửa snapshot hoặc khoản tiền của hợp đồng đã tồn tại.

- Lãi suất: **0,3%/ngày = 30 basis points/ngày**, không phải 0,03% (3 bps).
- Theo kế hoạch chi tiết đã chốt ngày 28/10: lãi kép; chia kỳ theo lịch sử dòng tiền thực tế, thời gian thực / 24 giờ; half-up đến VND khi thanh toán; tổng lãi không vượt gốc ban đầu. Với khoản chưa có dòng tiền: `ROUND(P × MIN(2, 1.003^days))` là tổng gốc và lãi.
- Ví dụ P = 1.000.000đ, chưa trả gốc/credit: một ngày lãi 3.000đ, hai ngày 6.009đ, 30 ngày 94.027đ. Không nhập nhầm 0,3 thành 3%.
- C50 vẫn là ROUND(S × 50%) cho đúng SKU/tổ hợp có S được duyệt. Giá trị cầm cuối đi qua kiểm hàng và xác nhận.
- Gia hạn, credit, trả gốc từng kỳ, chuộc trước hạn, kiểm trần 80% V trước credit, T−10/T−5, grace 48h và kiểm soát tài sản giữ nguyên.
- Mã phê duyệt `owner_rate_0_3` ghi **chỉ định chính sách của chủ shop**, không chứng nhận thẩm định pháp lý bên ngoài. `legalMode=approved` là trường tương thích của cổng nghiệp vụ nội bộ; không thay giấy tờ, thỏa thuận của khách hay kiểm chứng tiền thực chuyển. Không tự giải ngân/thu tiền chỉ vì thay cấu hình.

Nguồn cũ có mâu thuẫn giữa câu 0,03% và công thức 0,3%, đồng thời có diễn giải lãi đơn. Giữ nguyên bản nguồn để đối chiếu; yêu cầu rõ 0,3% của chủ shop và kế hoạch lãi kép ngày 28/10 là quy tắc hiện hành.

## Lưu ý pháp lý

0,3%/ngày cao hơn mức trần dân sự thông thường 20%/năm, trừ trường hợp có quy định khác áp dụng. Việc triển khai công thức và ghi chỉ định không khẳng định mức thu này hợp pháp. Cần đánh giá căn cứ áp dụng thực tế với người có chuyên môn trước khi thu; không có giấy phép hoặc ý kiến luật sư giả trong hồ sơ này. [Nguồn Chính phủ](https://baochinhphu.vn/huong-dan-ap-dung-phap-luat-ve-lai-suat-trong-giao-dich-dan-su-102248799.htm).
