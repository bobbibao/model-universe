# Báo cáo quản trị bán hàng và chi phí

Phạm vi: đơn bán website, tại quầy và chốt qua chat/điện thoại. Đơn giao hàng và tiền thu được theo dõi riêng. Đây là kết quả quản trị theo chi phí đã ghi nhận, trước thuế thu nhập; không gộp doanh thu dịch vụ cầm, tiền giải ngân, thanh lý tài sản hoặc công nợ đối tác thành doanh thu bán lẻ.

## Không gian quản trị

`/vi/admin/dashboard` và `/vi/admin/finance` dùng cùng workspace. Bốn chỉ số chính: doanh thu thuần, tiền thu ròng đã xác nhận, chi phí ghi nhận và lợi nhuận theo chi phí đã ghi nhận. Chọn kỳ tối đa 366 ngày, so với khoảng liền trước có cùng số ngày, theo Asia/Ho_Chi_Minh. Có CSV tổng hợp và bảng số liệu tương ứng biểu đồ.

- **Tổng quan:** cầu nối tiền hàng → doanh thu → giá vốn/chi phí → lợi nhuận, cơ cấu ưu đãi, chi phí, các SKU bán chạy và vốn tồn kho tham chiếu.
- **Đối soát đơn:** nhập giá mua thực tế cho từng dòng, xác nhận đã rà soát chi phí liên quan, lưu căn cứ và phiên bản. Không sửa giá bán, số lượng hoặc tồn kho. Sửa dựa trên `expectedVersion`; dữ liệu cũ không bị ghi đè.
- **Chi phí & định mức:** chủ shop tự thêm, sửa, phân loại hoặc ngừng dùng loại chi phí. Hỗ trợ theo đơn, theo kiện, lượng vật tư (3 chữ số thập phân) và số thực chi. Định mức chỉ gợi ý, không tự biến thành chi phí. Theo đơn bắt buộc liên kết đơn, theo kiện chỉ nhận số nguyên, theo đơn/thực chi có lượng bằng 1.

Tồn kho được chọn để chỉ ra vốn chưa được xác minh; không giả định giá niêm yết là giá trị tồn. Mẫu bán chạy được xếp theo số lượng giao, tiền hàng trước voucher cấp đơn/hoàn, không giả xếp hạng lợi nhuận khi chưa phân bổ hoàn tiền. Không thêm biểu đồ giới tính hoặc tỷ lệ chuyển đổi khi không phục vụ quyết định và chưa có nguồn đáng tin cậy.

## Công thức và nguồn

| Chỉ tiêu | Nguồn / công thức |
|---|---|
| Hàng bán ghi nhận | Chỉ `order.status = DELIVERED`, theo `deliveredAt`; thiếu ngày giao không tự dùng ngày tạo đơn |
| Tiền hàng trước voucher | `sum(order.subtotal)` của đơn đã giao trong kỳ; đối chiếu `sum(order_item.quantity × unitPrice)` |
| Giá trị trước giảm trực tiếp | Snapshot `modelSnapshot.financeListUnitVnd × quantity` khi chốt giá; thiếu snapshot trả `null`, không đọc giá catalog hôm nay |
| Doanh thu hàng thuần | Tiền hàng − `order.discount` − `order_refund.merchandiseVnd` đã xác nhận trong kỳ |
| Phí ship thuần thu khách | `order.shippingFee − shippingDiscountVnd` của đơn giao trong kỳ − `order_refund.shippingVnd` trong kỳ |
| Doanh thu thuần | Doanh thu hàng thuần + phí ship thuần thu khách; không gồm thuế thu hộ |
| Tiền thu ròng xác nhận | `order_receipt` + `order_prepayment` receipt/topup − refund + `reservation_payment` receipt − refund − `order_refund` (cả hàng/ship/thuế), theo ngày từng bút toán |
| Giá vốn | Giá mua thực tế đã nhập trong phiên bản đối soát mới nhất × lượng giao trong kỳ, trừ giá vốn hàng thực nhập trả có `return_item.restockedAt` trong kỳ |
| Chi phí | Tổng bút toán `finance_expense.amountVnd` theo `incurredAt`, gồm cả chi phí đơn hủy và chi phí vận hành không gắn đơn |
| Lợi nhuận theo chi phí ghi nhận | Doanh thu thuần − giá vốn − chi phí; `null` nếu thiếu giá vốn, thiếu đối soát, có hàng đối tác chưa quyết toán, đơn lệch tiền hoặc thiếu ngày giao |
| Giá trị đơn trung bình | `(tiền hàng − giảm đơn) ÷ số đơn giao`; không gồm ship và hoàn phát sinh của các kỳ khác |
| Tỷ suất lợi nhuận | Lợi nhuận / doanh thu thuần; chỉ có khi dữ liệu đủ và doanh thu dương |

Giảm trực tiếp đã nằm trong unitPrice/subtotal. Voucher/thành viên nằm trong `discount`. Freeship giảm phần ship thu khách. Các khoản này không được trừ tiếp như chi phí lần hai. Sổ chi phí chỉ nhập tiền shop thực chịu, ví dụ toàn bộ hóa đơn cước phải trả hãng vận chuyển. Cước lúc tạo vận đơn chỉ là tham khảo, không tự xác nhận là chi phí cuối cùng. Giá vốn chỉ gồm tiền mua hàng; không dùng tổng cost profile định giá (có đóng gói, xử lý, dự phòng) làm COGS rồi lại trừ các khoản đó.

Snapshot `benefitSnapshot.voucher`, `rank`, `scope` phân loại MEMBER10/voucher/hạng/nguồn tài trợ. Phần không phân loại vẫn được ghi đủ vào giảm đơn. “Shop tài trợ đã xác nhận” chỉ cộng ưu đãi có snapshot `scope=shop_owned`; không suy đoán nguồn tài trợ lịch sử hay coi toàn bộ giá trị ưu đãi là chi phí mới.

Hoàn của đơn kỳ cũ được giảm doanh thu trong kỳ bút toán hoàn, không biến mất khi lọc kỳ. `return_item.refundAmount` là đề xuất, không thay thế tiền hoàn đã xác nhận và không trừ hai lần. Giá vốn không tự đảo theo số tiền hoàn: chỉ đảo lượng thực nhập kho. Hủy đơn không tạo doanh thu; hoàn cọc đi qua sổ tiền. Phí giữ cọc và lãi/phí cầm chưa được gộp thành lợi nhuận bán lẻ.

## Lịch sử và phân quyền

Migration `2026-10-27-57-finance-workspace` thêm:

- `finance_cost_type`: cấu hình có version; không xóa loại đã sử dụng.
- `finance_expense`: tên/nhóm/cách tính/đơn giá/lượng/phiên bản được chụp tại lúc ghi. `requestKey` + digest + transaction/advisory lock chống gửi lại. Đảo duy nhất qua `reversesId`, cùng ngày phát sinh gốc, lượng/tiền đối dấu.
- `finance_order_review`: phiên bản đối soát bất biến, khóa order và kiểm tra phiên bản trước khi ghi.
- `finance_config_audit`: phiên bản cấu hình chi phí và người thay đổi.

Trigger PostgreSQL chặn UPDATE/DELETE sổ chi phí, phiên bản đối soát và audit. Các sửa sai tạo bút toán đảo/phiên bản mới, không sửa chứng từ cũ. Việc này có thể điều chỉnh kết quả kỳ quá khứ; ngày ghi và nội dung gốc luôn còn. Không phải cơ chế khóa sổ kế toán.

API `/api/admin/finance`: report, orders, orders/:id/reconcile, cost-types, expenses và expenses/:id/reverse. Đọc/ghi chỉ ADMIN, ngoài quy tắc `/admin` còn kiểm tra role ngay tại controller. Không đưa giá vốn vào API công khai. Đọc báo cáo trong transaction REPEATABLE READ, truy vấn riêng từng sổ để tránh nhân tiền do JOIN nhiều-nhiều. Có index ngày, order-item/order, version đối soát và nguồn hàng. Ngày/ID/lượng/tiền/enums được kiểm tại server; VND nguyên, tiền mỗi chứng từ tối đa 1.000 tỷ, từ chối vượt số nguyên an toàn.

Snapshot giá gốc thêm vào cả đơn web, bán trực tiếp và giữ chỗ tại lúc chốt giá. Không sửa dữ liệu lịch sử hoặc đọc giá mới để lấp snapshot cũ.

## Seed và xem trực tiếp dữ liệu phát triển

Database shop đang dùng là `web_ecommerce_ci_verify`: tên lịch sử, dữ liệu catalog thật, không phải nơi để seed. Không thêm đơn/khách/chi phí giả vào đó. Đã sao lưu riêng trước migration tại `D:/ModelUniverseRuntime/backups/shop-before-finance-*.dump`.

```powershell
cd apps/web-ecommerce
yarn seed:finance --database=model_universe_finance_acceptance_test
yarn finance:review --database=model_universe_finance_acceptance_test
yarn test:finance:ui
```

Mở `http://localhost:6050/vi/admin/finance`. Đăng nhập tài khoản **chỉ có trong database phát triển**: `finance.admin@model-universe.test` / `Finance-Check-2026!`.

Launcher tạm dừng runtime shop trước khi mở cùng source/build ở đúng cổng 6050, không chạy website thứ hai. Có banner dữ liệu phát triển. Khóa JWT riêng mỗi lần chạy, không dùng phiên đăng nhập kiểm thử vào shop. Khóa thanh toán/vận chuyển/email/Agent và background jobs bị tắt trong phiên kiểm tra, không tạo giao dịch thật hoặc tunnel public. Không đổi file `.env` của shop.

```powershell
yarn finance:review:stop
yarn start:production
```

Hai lệnh trên đưa ứng dụng về database shop; đăng nhập lại nếu phiên cũ đã hết hiệu lực. Khi bàn giao, runtime mặc định vẫn là shop localhost, không phải fixture.

Seed có manifest cố định `finance-linked-fixture-v1`, khóa chống chạy đồng thời và transaction cho toàn bộ dữ liệu. Chạy lại trả manifest cũ, không ghi đè các thao tác kiểm tra đã có. Từ chối database không đúng đuôi `_test`, database shop mặc định hoặc database đã có catalog/đơn không thuộc fixture.

Dữ liệu liên kết: **12 SKU, 6 hãng, 8 khách, 54 đơn qua nhiều tháng, 173 bút toán chi phí, 3 hoàn tiền đã xác nhận**, nhiều lần nhập có giá vốn khác nhau, MEMBER10/voucher/hạng/freeship, quầy/web/chat, hủy và hoàn cọc, hoàn của đơn kỳ cũ, nhập trả/chưa nhập trả, thiếu giá vốn và chi phí đảo. Ngày 27/10/2026 là mốc kiểm thử tổng hợp, không phải ngày nhập thật của catalog shop.

## Kiểm thử và giới hạn

Unit: công thức doanh thu/COGS/lợi nhuận, không trừ giảm/ship hai lần, hủy/cọc, hoàn khác kỳ, nhập trả, thiếu dữ liệu, giá 0 khác chưa biết, đối tác, timezone và kỳ so sánh. Database integration: seed lặp, đơn giá cũ, ngừng loại chi phí, gửi đồng thời, key khác nội dung, đảo một lần, trigger bất biến, phiên bản cũ, quyền và đối chiếu SQL độc lập. Bộ test tài chính tự tạo database riêng, không trộn seed với suite khác.

Tồn hiện tại không phải tồn cuối kỳ. Giá trị theo `product.importPrice` là tham chiếu, có đếm số lượng chưa có giá vốn. Ngày nhập gần nhất chỉ là tín hiệu chưa nhập bổ sung, không suy ra tuổi từng món còn trong kho khi chưa có phân bổ xuất theo lô. Không tự dùng ngày tạo catalog hoặc ngày baseline 25/10/2026 làm bằng chứng nhập hàng.

Chưa có tự động xác minh hóa đơn chi phí, phân bổ chi phí vận hành theo SKU, khóa sổ, thuế thu nhập, lợi nhuận theo lô FIFO hay quyết toán đối tác. Những giới hạn này được giữ rõ để tránh hiển thị lợi nhuận chính xác giả tạo.
