# Quản lý sản phẩm gọn — 30/10/2026

`/vi/admin/products` hiển thị 4 KPI và bảng SKU; không có tab danh sách, chọn danh mục hoặc nút đổi mật độ hàng.

- Tổng số lượng tồn: tổng `stock` của SKU của shop, không gồm nháp/ẩn và bản ghi đã hợp nhất.
- Tổng giá bán: tổng giá bán thực S × tồn; không phải doanh thu.
- Tổng vốn đang tồn: tổng giá vốn đã lưu × tồn.
- Chênh lệch bán − vốn: tổng giá bán trừ vốn; chưa trừ chi phí vận hành hoặc ưu đãi. Các SKU tồn có vốn bằng 0 được cảnh báo, không coi đây là lợi nhuận đã xác nhận.

KPI là tổng quan toàn kho theo phạm vi trên, không thay đổi theo tìm kiếm trong bảng. Số đếm bảng áp dụng tìm kiếm/trạng thái và tính trên toàn bộ kết quả trước phân trang:

- **Mẫu**: một `modelFamilyId` trong cùng nguồn đối tác; SKU cũ chưa có mẫu được tính riêng.
- **Sản phẩm theo tình trạng**: mỗi SKU là một sản phẩm, dù cùng mẫu.
- **Số lượng tồn**: số chiếc, không phải số SKU.

Ví dụ 1 mẫu có 3 SKU New/2hand khác tình trạng và tồn lần lượt 2/3/1: bảng có 1 mẫu / 3 sản phẩm, kho có 6 chiếc.

Thao tác hàng loạt chỉ hiện trong thanh nổi giữa đáy khi có lựa chọn. Phạm vi cập nhật và kiểm tra trùng tổ hợp/lịch sử giữ nguyên.

Thống kê hãng và tình trạng chuyển sang `/vi/admin/products/report`, có đường dẫn từ tổng quan và menu sản phẩm. Form tạo/sửa sản phẩm không yêu cầu hoặc hiển thị danh mục/nhà cung cấp. Cấu trúc dữ liệu lịch sử vẫn được giữ.

Theo yêu cầu chủ shop, đã xóa 5 nhà cung cấp hiện hữu trên database local, sau khi kiểm tra không có phiếu nhập liên quan và kiểm tra liên kết sản phẩm. Không xóa sản phẩm, tồn kho hoặc giao dịch. Bản sao trước thao tác được lưu riêng ngoài Git trong thư mục runtime.

Kiểm tra: unit form sản phẩm, database integration cho số mẫu/SKU trước phân trang và theo bộ lọc; script `node scripts/verify-catalog-workspace.cjs` kiểm tra UI thực desktop/mobile, selection, modal bulk, báo cáo và form. Script UI không gửi cập nhật sản phẩm.
