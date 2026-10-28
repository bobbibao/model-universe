# Kiểm chứng cầm cố và giữ hàng — 28/10/2026

Nghiệp vụ hiện hành: [pawn-hold-ledgers.md](pawn-hold-ledgers.md). Code ứng dụng: `eae9011`, `662cd42`, `7a20915` trên main. Website production local chạy `7a20915` tại http://localhost:6050; migration 60–61 đã áp dụng. Migration 61 là thay đổi schema tương thích, đã chạy bằng CLI trước khi bàn giao; không cần thay frontend để có hiệu lực.

## Kiểm thử

| Phạm vi                    | Kết quả                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Toàn bộ unit               | 68 bộ, 1.058 kiểm thử qua                                                                                                                        |
| Hồi quy PostgreSQL         | 5 bộ, 57 kiểm thử qua trong lần chạy chung                                                                                                       |
| Kiểm tra bổ sung migration | Bộ pawn-hold có 21 ca qua, gồm ca mới nâng cấp bảng thông báo đã có dữ liệu và writer cũ không truyền trường lịch; tổng phạm vi DB hiện có 58 ca |
| Type check                 | Server và toàn bộ source frontend/server qua                                                                                                     |
| Lint                       | Các file hoàn thiện qua; repo có các cảnh báo cũ ngoài phạm vi                                                                                   |
| Production build           | Next production và backend compile qua; build từ snapshot commit, giữ nguyên thay đổi chưa commit của workspace khác                             |
| UI thật                    | Desktop 1440px, mobile 390px, click các trang production và chụp ảnh kiểm tra                                                                    |

Các bộ DB: `pawn-hold-2026`, `pawn`, `pawn-disposal`, `reservations`, `deposit-delivery`. Chạy trên database riêng có hậu tố `_test`; không reset database shop. Provider thanh toán được thay bằng test double, chữ ký hoàn tiền dùng khóa fixture riêng; không chuyển tiền, gọi hãng vận chuyển hoặc gửi thư thật trong kiểm thử.

Các ca chính: biên tỷ lệ VND lẻ; dưới 20%; kích hoạt/cọc thêm/đúng 100%/tiền dư; hai người tranh đơn vị cuối; hết hạn và tiền đến muộn; chuyển cọc đúng một lần; yêu cầu hủy và duyệt hoàn độc lập; QR khóa số tiền; webhook giả/lặp; C50; lãi kép/cap cả phần làm tròn nhiều lần; trả bớt gốc giữa ngày; nhiều lần gia hạn và credit đã xác nhận; hoàn credit dư; trần 80% trước credit; T−10/T−5; ân hạn 48h; đề nghị gia hạn treo trong quá hạn; thông báo hợp lệ và hai người duyệt; quyền sở hữu, nhập kho một lần; tiền bán/hoàn của từng nguồn; dữ liệu nguồn và bằng chứng riêng tư; migration có dữ liệu và SQL DEFAULT cho writer cũ.

UI runner `node scripts/verify-pawn-hold-ui.cjs` kiểm tra: hàng đợi Finance, phân quyền, chặn giải ngân ở simulation, xác minh giấy tờ, lựa chọn gia hạn bị khóa trong OVERDUE_REVIEW, QR giữ nguyên số tiền, yêu cầu hủy → duyệt hủy → yêu cầu hoàn, tiền chờ đối soát thay số dư mua hàng trên hồ sơ hủy, báo giá và điều khoản trên sản phẩm thật. Các thao tác tài chính của UI được intercept trong browser; không seed tiền hoặc tồn giả vào shop. Kiểm tra không tràn ngang trên mobile, không lỗi JavaScript; đã xem ảnh để sửa tương phản nền tối và tiêu đề dialog cuộn trên mobile.

Ảnh và log local: `D:/ModelUniverseRuntime/qa-pawn-hold/`, `D:/ModelUniverseRuntime/logs/pawn-hold-*.log`. Kết quả UI được lưu ở `qa-pawn-hold/result.json`.

## Database và vận hành

Đã sao lưu trước triển khai ở `D:/ModelUniverseRuntime/backups/pre-pawn-hold-2026-10-28.dump`. Migration được thử trên bản sao trước; đối chiếu ban đầu giữ nguyên 115 sản phẩm, 54 đơn, 35 tài khoản, đồng thời hash nội dung product/order trùng với bản sao. Không tự xác minh quyền sở hữu dữ liệu cũ. Hoạt động độc lập của workspace khác sau thời điểm đối chiếu không bị ghi đè.

Đã ghi nhận chính sách giữ hàng phiên bản 1 theo bảng mới và chính sách pawn phiên bản 1 ở `legalMode=simulation`, kèm căn cứ là yêu cầu của chủ shop. Không ghi nhận phê duyệt pháp lý thật, không giải ngân, không thu lãi hoặc hoàn tiền giả. SKU chưa được Compliance xác minh quyền sở hữu chỉ xem được điều khoản/báo giá, chưa tạo giữ hàng.

- Bộ tiếp nhận xác nhận ngân hàng chưa cấu hình: hoàn tiền dừng ở chờ xử lý, không tự ghi hoàn tất. Hợp đồng adapter HMAC nằm trong tài liệu nghiệp vụ; upstream adapter phải xác minh provider thật.
- SMTP chưa cấu hình: inbox/outbox và lịch nhắc tồn tại, nhưng không khẳng định email đã gửi. Cần cấu hình và vận hành retry cho các lần gửi thất bại.
- Cầm cố chỉ mô phỏng đến khi có hồ sơ pháp lý và quyền hạn cần thiết. Việc nhập một căn cứ vào hệ thống không thay thế thẩm định pháp lý bên ngoài.
- Phân bổ bán tài sản tự gắn một dòng số lượng 1 với tài sản nguồn; lô trộn cần đối chiếu riêng.

Không merge hoặc commit các chỉnh sửa đang làm dở của Antigravity. Các file đó được giữ nguyên trong workspace.
