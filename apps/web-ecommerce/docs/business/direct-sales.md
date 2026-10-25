# Bán trực tiếp và đơn chốt ngoài website

Admin → Đơn hàng → **Tạo đơn bán trực tiếp** (`/[locale]/admin/orders/new`). Đây là luồng nhân viên lập đơn cho khách tại shop hoặc qua chat/điện thoại, khác với lịch hẹn nhận hàng được khách đặt trên website.

## Phạm vi hiện tại

- Chọn SKU thực tế, bao gồm từng tình trạng New / 2hand / thiếu phụ kiện / lỗi. Mỗi SKU giữ giá, tồn kho và ảnh riêng. Chỉ bán hàng của shop đang được phép bán, còn tồn; hàng đối tác dùng quy trình marketplace.
- Khách lẻ không bắt buộc có tài khoản, tên hay SĐT khi nhận ngay. Không tạo tài khoản giả và không gán doanh số, điểm hoặc thông báo của khách cho nhân viên. Có thể tìm và liên kết tài khoản USER đang hoạt động; thông tin người nhận lưu trên đơn độc lập với tài khoản.
- Nguồn đơn: `COUNTER` (tại shop), `ASSISTED` (chat/điện thoại); đơn cũ và checkout giữ `WEBSITE`. Nguồn đơn khác với cách giao nhận.
- Bàn giao ngay: phải xác nhận đã thực nhận đủ tiền mặt hoặc chuyển khoản. Đơn `DELIVERED`, có thời điểm bàn giao và phiếu thu bất biến trong `order_receipt`; không giả lập COD đang chờ thu.
- Giao hàng thủ công: bắt buộc tên, SĐT, địa chỉ, tỉnh/thành. Đơn `PROCESSING`; có thể chưa thu tiền hoặc đã nhận đủ tiền. Tiền nhận trước vào `order_prepayment` để còn xử lý hoàn tiền khi hủy. Chưa thu tiền thì không ghi nhận khoản thu hoặc doanh thu đã thanh toán. Shop cập nhật `SHIPPED` → `DELIVERED`, rồi xác nhận tiền thu theo luồng chung.
- Danh sách đơn có cột và bộ lọc nguồn. Chi tiết đơn thể hiện nguồn, nhân viên lập đơn, cách giao nhận và lựa chọn thu tiền ban đầu. Trạng thái và sổ tiền là căn cứ cho số đã thu hiện tại.

## Toàn vẹn dữ liệu

`DirectSaleService.create` xác thực ADMIN đang hoạt động. Một database transaction ghi đơn, snapshot các dòng, cập nhật stock/sold và khoản thu. Dùng cùng `CartService.resolveLines` và khóa sản phẩm theo ID như checkout để tránh bán trùng với website. Không ghi đè tồn kho tuyệt đối từ trình duyệt.

Giá tính từ server; `expectedTotal` bắt buộc để từ chối giá đã thay đổi. Không nhận giá tùy ý, discount, tax hoặc tổng tiền do client quyết định. Giá bán dưới giá vốn hiệu lực từ `PricingApprovalService` bị chặn. Snapshot giữ SKU, tình trạng, phụ kiện/lỗi và giá vốn lúc lập đơn.

`directSaleKey = actorId:requestKey` duy nhất và advisory lock chống tạo trùng, kể cả các yêu cầu đồng thời. Digest chuẩn hóa bảo đảm cùng key khác nội dung bị từ chối. Client lưu key cùng nội dung đã gửi trong sessionStorage cho lần thử lại; nội dung thay đổi có key mới. Khóa mã giao dịch dùng chung `MoneyReferenceService`, từ chối dùng lại mã giữa các sổ tiền. Checkbox xác nhận phải đi kèm mã phiếu thu tiền mặt hoặc mã giao dịch đã kiểm tra thực tế; không suy ra đã trả tiền từ việc hiện QR.

Hủy đơn chưa giao dùng `OrderService` hiện có: trả tồn một lần, lưu lý do/người hủy; tiền nhận trước được hoàn qua sổ prepayment và chính sách hủy hiện hành. Đơn đã bàn giao không sửa/xóa để làm mất lịch sử. Đơn liên kết tài khoản dùng quy tắc tích điểm/đổi trả hiện có; đơn khách lẻ không có inbox hoặc điểm thưởng.

## Schema và triển khai

Migration `2026-10-25-47-admin-direct-sales` bổ sung nguồn đơn, người lập, snapshot bán trực tiếp và key chống trùng; cho phép `order.userId` null cho khách lẻ. Giữ foreign key đối với tài khoản có liên kết. Đơn website vẫn được tạo với userId và nguồn mặc định WEBSITE. Không đổi enum `paymentMethod` cũ (COD là trường tương thích); phương tiện thanh toán thực tế nằm ở `paymentSource` cùng sổ thu tiền.

Server chạy migration khi khởi động; có thể dùng `yarn db:migrate` trước triển khai. Migration thêm cột/index có thể chạy lại; không seed hoặc thay đổi dữ liệu khách hàng. Báo cáo doanh số/tồn kho đọc chung bảng order/order_item nên nhận cả đơn bán trực tiếp; top khách hàng chỉ bao gồm tài khoản đã liên kết. Chưa thêm phân tích doanh thu theo nguồn vào các analytics view của agent.

## Giới hạn được thể hiện trong UI

Luồng này áp dụng giá bán hiện hành, chưa có voucher/điểm dùng tại quầy, sửa giá thủ công, đặt cọc một phần, phí ship riêng, tạo vận đơn SuperAI tự động, ca thu ngân hoặc in phiếu bán hàng. Giao hàng thủ công phải được shop theo dõi và cập nhật. Không tự tạo đơn hàng vận chuyển hay gửi email/SMS cho khách lẻ. API đổi trả hiện tại yêu cầu tài khoản khách: cần bổ sung luồng nhân viên tiếp nhận đổi trả cho khách lẻ trước khi dùng đầy đủ dịch vụ hậu mãi tại quầy. Không phải hệ thống hóa đơn điện tử.

## Kiểm chứng

- Unit: dữ liệu khách lẻ, giới hạn/kiểu số, giao nhận, xác nhận tiền thực thu, chuẩn hóa SKU và key.
- PostgreSQL dùng riêng: đơn khách lẻ + phiếu thu, retry đồng thời, cạnh tranh sản phẩm cuối, không ghi dữ liệu khi giá/tồn/khách/quyền không hợp lệ, chống dùng lại mã khoản thu giữa các sổ, giao hàng đã thu/chưa thu, hủy hoàn tồn, liên kết tài khoản và migration.
- Browser: VI/EN, desktop/mobile, chọn tình trạng, hạn chế số lượng, xác nhận phiếu thu, retry giữ key, giao hàng cần địa chỉ và chọn tài khoản. Các lần ghi được mock, không tạo đơn thử trong dữ liệu shop.

Kết quả phiên triển khai: **927 unit test, 9 PostgreSQL integration test và 52 browser test qua**; đã thử thêm luồng UI → API → đơn bàn giao đã thanh toán trên database dùng riêng. Production Next build (`--no-lint`) và server TypeScript compile qua. ESLint cho các module mới qua; lint toàn repo vẫn có lỗi cũ ở plugin enum / các lazy require, không thuộc phạm vi này. Preview dùng database thử riêng, không phải dữ liệu vận hành của shop.
