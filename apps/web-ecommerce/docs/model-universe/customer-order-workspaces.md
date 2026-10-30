# Khách hàng và Đơn hàng — tổng quan vận hành

Hai danh sách dùng chung phép đo bảng với trang Sản phẩm: desktop tự tính số dòng và lấp kín vùng hiển thị; mobile cuộn tự nhiên, 10 dòng mỗi trang. Không có heading hoặc tab danh sách thừa, công cụ được gộp vào một thanh. KPI là số toàn hệ thống, không tính từ trang dữ liệu đang xem; bấm KPI để lọc danh sách tương ứng.

## Khách hàng

- **Khách có tài khoản**: tài khoản `USER`, gồm cả tài khoản đang khoá. Không đếm quản trị viên hoặc khách lẻ chưa đăng ký.
- **Khách mới · 30 ngày**: tài khoản khách được tạo trong 30 ngày gần nhất, tính theo thời điểm truy vấn.
- **Khách đã mua hàng**: có ít nhất một đơn `DELIVERED`.
- **Khách quay lại**: có ít nhất hai đơn `DELIVERED`.

Đơn đã huỷ hoặc chưa giao không làm tăng số khách đã mua/quay lại. Bảng bổ sung số đơn đã giao và thời điểm gần nhất; dùng ngày giao, nếu lịch sử chưa ghi ngày giao thì dùng ngày tạo đơn. Tìm kiếm hỗ trợ họ tên đầy đủ. Các thao tác khoá/mở khoá và đổi vai trò được giữ nguyên, chặn sửa chính mình và khoá thao tác khi đang lưu. Bộ lọc vai trò/trạng thái hỗ trợ nhiều lựa chọn; các nhóm từ KPI chỉ áp dụng tài khoản khách.

## Đơn hàng

- **Chờ xử lý**: đơn `PROCESSING`.
- **Đang giao**: đơn `SHIPPED`.
- **Tiền còn phải thu**: tổng `max(total − prepaidVnd − khoản thu đã xác nhận, 0)` cho đơn chưa huỷ và chưa được đánh dấu thanh toán đủ. Đơn `PAID` được tính còn thu bằng 0, kể cả lịch sử chưa có sổ thu mới. Đây là khoản phải thu theo đơn, không phải doanh thu hoặc tiền đã về tài khoản ngân hàng.
- **Yêu cầu huỷ**: `cancelRequest.status = PENDING` trên đơn chưa huỷ.

Bộ lọc trạng thái đơn và kênh bán cho phép chọn nhiều (HOẶC trong cùng nhóm, VÀ giữa các nhóm). KPI khoản phải thu lọc đúng các đơn còn tiền phải thu; KPI yêu cầu huỷ chỉ lọc yêu cầu đang chờ. Không sửa dữ liệu đơn, giao hàng hoặc tiền đã thu khi xem/chuyển bộ lọc. Đơn có số dư bằng 0 nhưng trạng thái chưa xác nhận được ghi “Chờ xác nhận”, không ghi còn thu 0đ.

API mới: `GET /api/admin/users/stats`, `GET /api/admin/orders/stats`; cùng quyền Admin như các danh sách hiện có. Danh sách tài khoản thêm `completedOrders`, `lastDeliveredAt`; danh sách đơn thêm `outstandingVnd`. Không thay schema hoặc chạy seed trên dữ liệu cửa hàng.

Kiểm tra database riêng: thống kê không đếm quản trị viên/khách lẻ thành khách đăng ký; đơn đã giao, mua lại, khách mới; khoản thu và trả trước không tính hai lần; đơn huỷ, đã trả đủ và trả dư; bộ lọc và dữ liệu mật của tài khoản. Kiểm tra UI thật bằng `node scripts/verify-customer-order-lists.cjs` với tài khoản Admin qua biến môi trường; script chỉ đọc dữ liệu và chặn các thao tác ghi.
