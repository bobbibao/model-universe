# Gửi mail và hoàn tiền thực tế — 28/10/2026

## Email

- Gmail SMTP cổng 465/TLS, dùng mật khẩu ứng dụng trong `.env`, không đưa bí mật vào Git hoặc frontend.
- Đã xác thực SMTP và được Gmail chấp nhận một email kiểm tra gửi về chính tài khoản chủ shop. Đây là xác nhận nhà cung cấp nhận gửi, không khẳng định thư đã vào Inbox.
- OTP, đặt lại mật khẩu, đơn hàng, giao nhận, voucher và thông báo dịch vụ dùng SMTP thật. Không còn trả thành công giả hoặc ghi OTP ra log khi thiếu SMTP, kể cả development.
- `CommerceEmailService` bổ sung email cho sự kiện giữ hàng/cầm cố đã commit, các thông báo chỉ có inbox, thông báo quản trị và tin liên hệ mới. Không gửi giấy tờ, ảnh riêng tư hoặc OTP trong email thông báo chung.
- Hàng đợi có lịch gửi, chống tạo trùng và retry. `SMTP_ENABLED_AT` là mốc kích hoạt; thư demo cũ từng thất bại do chưa có SMTP được đánh dấu hủy, không phát lại cho khách.

## Hoàn qua payOS Chi hộ

Nhận tiền và Chi hộ là hai kênh cấu hình riêng. Các biến bắt buộc: `PAYOS_PAYOUT_CLIENT_ID`, `PAYOS_PAYOUT_API_KEY`, `PAYOS_PAYOUT_CHECKSUM_KEY`.

1. Khách/admin lập hồ sơ hoàn; chọn ngân hàng trong dropdown chung, nhập tài khoản, tên người nhận và lý do.
2. Finance khác người lập đối chiếu và duyệt khoản phải hoàn.
3. Finance xác nhận người nhận/số tiền, bấm **Chuyển tiền thật qua payOS** trong Tài chính → Duyệt hoàn tiền.
4. Server gửi lệnh Chi hộ, dùng tham chiếu và idempotency key ổn định theo hồ sơ. Không thay số tiền/tài khoản sau duyệt.
5. SDK kiểm chữ ký phản hồi; adapter bổ sung từ chối phản hồi thành công thiếu chữ ký. Chỉ giao dịch `SUCCEEDED`, đúng một khoản chuyển và khớp tham chiếu/số tiền/BIN/tài khoản mới được ghi hoàn vào sổ.
6. `PROCESSING`/timeout giữ nghĩa vụ chờ đối soát. **Kiểm tra payOS** và background job chỉ tra cứu, không phát lệnh mới. Gửi lại dùng cùng mã; server tìm lệnh cũ trước khi tạo.
7. `FAILED`/`CANCELLED` có xác nhận từ nhà cung cấp đóng yêu cầu không thành công, không tạo bút toán hoàn. Khách có thể lập hồ sơ mới. Kết quả sai tài khoản/số tiền không được ghi thành công.

Áp dụng cho cọc giữ hàng, trả trước đơn hủy, credit cầm dư và tiền dư xử lý tài sản. Hồ sơ cũ chứa tên ngân hàng tự do thay vì BIN cần đối soát ngân hàng hoặc lập hồ sơ phù hợp, không sửa dữ liệu đã duyệt.

Tài liệu nhà cung cấp: [payOS API](https://payos.vn/docs/api/). Danh mục ngân hàng lấy từ [VietQR](https://api.vietqr.io/v2/banks).

## Kiểm tra thực tế và giới hạn hiện tại

- Đã bổ sung bộ khóa Chi hộ riêng. Sau khi chủ shop thêm IP public IPv4 vào danh sách được phép, đã đọc thành công số dư và danh sách lệnh chi; cả hai phản hồi có chữ ký được SDK xác minh. Không lưu số dư, số tài khoản hoặc bí mật trong tài liệu/log bàn giao.
- Công cụ đọc Chrome lỗi khởi tạo (mã 3); chủ shop tự điền khóa vào `.env`. Lỗi 403 ban đầu được xác định do máy ưu tiên IPv6 trong khi chỉ IPv4 được cho phép. Bản chạy dùng `NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"` để đi qua IPv4 đã được chủ shop cho phép; không mở quyền cho mọi IP. Nếu IP public thay đổi, cập nhật danh sách IP trong payOS.
- Không phát lệnh chuyển tiền thử, không ghi hoàn thành giả. Kiểm thử tiền dùng provider double trong database riêng.


## Kiểm chứng bàn giao

- 1.066 unit tests đạt; 27 database cases đạt trên cả mã làm việc và bản source commit độc lập, database riêng. Các ca auth recovery (13 ca) đạt trong lượt riêng.
- Production build, typecheck frontend/backend và lint các file thay đổi đạt.
- Click thật desktop/mobile: kiểm giấy tờ, QR giữ hàng khóa số tiền, yêu cầu hủy/hoàn, dropdown ngân hàng, xác nhận người nhận, chuyển trạng thái payOS PROCESSING → SUCCEEDED. Các thao tác tiền trong browser test được chặn bằng fixture; không tạo giao dịch giả vào DB shop.
- Gmail chấp nhận hai email tự kiểm tra gửi về chính tài khoản chủ shop: một thử SMTP và một đi qua MailService đã build. Các thư dev cũ thất bại do thiếu SMTP đã được hủy lịch, không gửi lại.
- Kết nối payOS thật đã được kiểm bằng truy vấn đọc có chữ ký. Không phát lệnh chuyển tiền thử; chỉ hồ sơ được Finance duyệt và thao tác gửi tiền rõ ràng mới phát lệnh thật.
