# Cập nhật sản phẩm hàng loạt

Admin → Sản phẩm: đánh dấu từng dòng hoặc chọn các sản phẩm của shop trên trang hiện tại, rồi chọn **Sửa hàng loạt**. Tối đa 50 sản phẩm; giữ lựa chọn khi phân trang/sắp xếp. Đổi tìm kiếm, danh mục hoặc trạng thái sẽ xóa lựa chọn để tránh sửa nhầm các dòng đã bị lọc khỏi màn hình.

Chỉ hỗ trợ hai trường theo yêu cầu chủ shop:

| Trường | Cách nhập | Phạm vi |
| --- | --- | --- |
| Nổi bật | Chọn bật hoặc tắt | Sản phẩm đã chọn; chỉ bật cho sản phẩm đang được phép bán/hiển thị |
| Tình trạng hàng | Chọn từ danh sách tình trạng đang hoạt động: Mới, 2hand, Thiếu phụ kiện, Có lỗi và các loại shop cấu hình | SKU chính được chọn; không đổi các SKU tình trạng khác của cùng mô hình |

Mỗi trường phải được đánh dấu trước khi chọn giá trị; trường không đánh dấu không được gửi lên API. Giá, tồn kho, SKU, hình ảnh, mô tả lỗi/phụ kiện, thương hiệu và trạng thái bán không được sửa bằng chức năng này. Không chọn sản phẩm của đối tác hoặc bản ghi thiếu phiên bản cập nhật.

## Quy tắc khi đổi tình trạng

Áp dụng các quy tắc hiện có của trang sửa từng sản phẩm. Loại một chiếc (2hand) cần tồn kho tối đa 1 và ảnh chính là ảnh thật đã tải lên. Không đổi loại một chiếc sang loại khác để tránh làm mất định danh của món đã kiểm định. Thiếu phụ kiện cần danh sách phụ kiện thiếu; hàng lỗi cần mô tả lỗi. Chức năng không tự tạo mô tả hoặc tự điều chỉnh tồn kho/giá.

Nếu có món không đáp ứng điều kiện, toàn bộ lô không được lưu. Hộp thoại giữ nguyên lựa chọn và nêu mã sản phẩm, lý do, liên kết mở trang sửa trong tab mới. Sau khi bổ sung dữ liệu, tải lại và chọn lại sản phẩm để nhận phiên bản mới.

## API và tính toàn vẹn

`POST /api/admin/products/bulk` yêu cầu phiên đăng nhập ADMIN đang hoạt động. Payload gồm `requestKey` UUID, `items: [{ id, expectedUpdatedAt }]` và `changes` chỉ nhận `condition`, `isFeatured`. Server từ chối trường ngoài phạm vi và tối đa 50 ID duy nhất.

Toàn bộ thao tác chạy trong một transaction: khóa người thực hiện để tuần tự hóa yêu cầu gửi lại, khóa các sản phẩm theo ID tăng dần, đối chiếu `updatedAt`, kiểm tra quyền sở hữu và quy tắc tình trạng trước khi ghi. Một bản ghi mất, đã đổi hoặc không hợp lệ làm hủy cả lô. Yêu cầu gửi lại cùng khóa và nội dung nhận kết quả cũ; dùng lại khóa với nội dung khác bị từ chối. UI khóa thao tác đóng/gửi khi đang lưu và giữ khóa khi thử lại cùng nội dung.

Tái sử dụng `promotion_audit`: `product_catalog / bulk_update` lưu người sửa và giá trị trước/sau trên từng SKU thực sự thay đổi; `product_bulk_request` lưu mã yêu cầu, digest và kết quả để chống gửi trùng. Không cần migration. Bản ghi không thay đổi không tạo audit sửa sản phẩm.

## Kiểm chứng

Các bộ kiểm thử riêng: `tests/unit/product-bulk.test.ts` (allowlist, dữ liệu sai, chuẩn hóa); `tests/db/product-bulk.test.ts` (Postgres dùng database riêng kết thúc bằng `_test`, rollback, quyền API thực, xung đột, audit, gửi lại đồng thời); `e2e/product-bulk.spec.ts` (API được chặn bằng fixture để không sửa dữ liệu shop, tiếng Việt/Anh và màn hình 1366/390px).

Kết quả: 17 unit, 12 database và 5 browser case cho tính năng đã qua. Thêm 10 browser case hồi quy cho bảng admin (trạng thái không xuống dòng, ẩn/hiện cột, mật độ dòng, giữ tùy chọn sau reload, điều hướng bàn phím). Fixture editor cũ được bổ sung giá S nội bộ, vì API public không trả trường này và validation giá hiện tại yêu cầu S. Scoped ESLint, type check server và build Next.js production với kiểm tra kiểu đã qua; build dùng `--no-lint` do giới hạn lint toàn repo đã được ghi nhận ở tài liệu UI/UX. Kiểm tra preview thật xác nhận danh sách có `updatedAt` và khách chưa đăng nhập nhận 401; không sửa dữ liệu shop.

Bản preview trong worktree riêng sử dụng cổng 6053; API catalog chạy trên 6075 phục vụ danh sách public và controller quản lý sản phẩm (gồm tạo/sửa, SKU tình trạng và bulk update), không chạy migration, seed hay job. Các API còn lại tiếp tục đi qua server hiện có. Hạ tầng preview là công cụ local, không phải cấu hình triển khai production.
