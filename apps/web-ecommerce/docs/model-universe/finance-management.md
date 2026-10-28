# Báo cáo quản trị bán hàng và chi phí

Phạm vi: đơn bán website, tại quầy và chốt qua chat/điện thoại. Đơn giao hàng và tiền thu được theo dõi riêng. Đây là kết quả quản trị theo chi phí đã ghi nhận, trước thuế thu nhập; không gộp doanh thu dịch vụ cầm, tiền giải ngân, thanh lý tài sản hoặc công nợ đối tác thành doanh thu bán lẻ.

## Không gian quản trị

`/vi/admin/dashboard` là trang báo cáo kinh doanh duy nhất, với biểu đồ tương tác. `/vi/admin/finance` là trang nhập liệu độc lập: quản lý chi phí/định mức và đối soát đơn, không lặp lại dashboard. Bốn chỉ số chính: doanh thu thuần, tiền thu ròng đã xác nhận, chi phí ghi nhận và lợi nhuận theo chi phí đã ghi nhận. Chọn kỳ tối đa 366 ngày, so với khoảng liền trước có cùng số ngày, theo Asia/Ho_Chi_Minh. Có CSV tổng hợp và bảng số liệu tương ứng biểu đồ.

- **Dashboard báo cáo:** cầu nối tiền hàng → doanh thu → giá vốn/chi phí → lợi nhuận, cơ cấu ưu đãi, chi phí, các SKU bán chạy và vốn tồn kho tham chiếu.
- **Đối soát đơn:** nhập giá mua thực tế cho từng dòng, xác nhận đã rà soát chi phí liên quan, lưu căn cứ và phiên bản. Không sửa giá bán, số lượng hoặc tồn kho. Sửa dựa trên `expectedVersion`; dữ liệu cũ không bị ghi đè.
- **Trang chi phí & đối soát — Chi phí & định mức:** chủ shop tự thêm, sửa, phân loại hoặc ngừng dùng loại chi phí. Hỗ trợ theo đơn, theo kiện, lượng vật tư (3 chữ số thập phân) và số thực chi. Định mức chỉ gợi ý, không tự biến thành chi phí. Theo đơn bắt buộc liên kết đơn, theo kiện chỉ nhận số nguyên, theo đơn/thực chi có lượng bằng 1.

Tồn kho được chọn để chỉ ra vốn chưa được xác minh; không giả định giá niêm yết là giá trị tồn. Mẫu bán chạy được xếp theo số lượng giao, tiền hàng trước voucher cấp đơn/hoàn, không giả xếp hạng lợi nhuận khi chưa phân bổ hoàn tiền. Không thêm biểu đồ giới tính hoặc tỷ lệ chuyển đổi khi không phục vụ quyết định và chưa có nguồn đáng tin cậy.

## Công thức và nguồn

| Chỉ tiêu                        | Nguồn / công thức                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hàng bán ghi nhận               | Chỉ `order.status = DELIVERED`, theo `deliveredAt`; thiếu ngày giao không tự dùng ngày tạo đơn                                                                     |
| Tiền hàng trước voucher         | `sum(order.subtotal)` của đơn đã giao trong kỳ; đối chiếu `sum(order_item.quantity × unitPrice)`                                                                   |
| Giá trị trước giảm trực tiếp    | Snapshot `modelSnapshot.financeListUnitVnd × quantity` khi chốt giá; thiếu snapshot trả `null`, không đọc giá catalog hôm nay                                      |
| Doanh thu hàng thuần            | Tiền hàng − `order.discount` − `order_refund.merchandiseVnd` đã xác nhận trong kỳ                                                                                  |
| Phí ship thuần thu khách        | `order.shippingFee − shippingDiscountVnd` của đơn giao trong kỳ − `order_refund.shippingVnd` trong kỳ                                                              |
| Doanh thu thuần                 | Doanh thu hàng thuần + phí ship thuần thu khách; không gồm thuế thu hộ                                                                                             |
| Tiền thu ròng xác nhận          | `order_receipt` + `order_prepayment` receipt/topup − refund + `reservation_payment` receipt − refund − `order_refund` (cả hàng/ship/thuế), theo ngày từng bút toán |
| Giá vốn                         | Giá mua thực tế đã nhập trong phiên bản đối soát mới nhất × lượng giao trong kỳ, trừ giá vốn hàng thực nhập trả có `return_item.restockedAt` trong kỳ              |
| Chi phí                         | Tổng bút toán `finance_expense.amountVnd` theo `incurredAt`, gồm cả chi phí đơn hủy và chi phí vận hành không gắn đơn                                              |
| Lợi nhuận theo chi phí ghi nhận | Doanh thu thuần − giá vốn − chi phí; `null` nếu thiếu giá vốn, thiếu đối soát, có hàng đối tác chưa quyết toán, đơn lệch tiền hoặc thiếu ngày giao                 |
| Giá trị đơn trung bình          | `(tiền hàng − giảm đơn) ÷ số đơn giao`; không gồm ship và hoàn phát sinh của các kỳ khác                                                                           |
| Tỷ suất lợi nhuận               | Lợi nhuận / doanh thu thuần; chỉ có khi dữ liệu đủ và doanh thu dương                                                                                              |

Giảm trực tiếp đã nằm trong unitPrice/subtotal. Voucher/thành viên nằm trong `discount`. Freeship giảm phần ship thu khách. Các khoản này không được trừ tiếp như chi phí lần hai. Sổ chi phí chỉ nhập tiền shop thực chịu, ví dụ toàn bộ hóa đơn cước phải trả hãng vận chuyển. Cước lúc tạo vận đơn chỉ là tham khảo, không tự xác nhận là chi phí cuối cùng. Giá vốn chỉ gồm tiền mua hàng; không dùng tổng cost profile định giá (có đóng gói, xử lý, dự phòng) làm COGS rồi lại trừ các khoản đó.

Snapshot `benefitSnapshot.voucher`, `rank`, `scope` phân loại MEMBER10/voucher/hạng/nguồn tài trợ. Phần không phân loại vẫn được ghi đủ vào giảm đơn. “Shop tài trợ đã xác nhận” chỉ cộng ưu đãi có snapshot `scope=shop_owned`; không suy đoán nguồn tài trợ lịch sử hay coi toàn bộ giá trị ưu đãi là chi phí mới.

Hoàn của đơn kỳ cũ được giảm doanh thu trong kỳ bút toán hoàn, không biến mất khi lọc kỳ. `return_item.refundAmount` là đề xuất, không thay thế tiền hoàn đã xác nhận và không trừ hai lần. Giá vốn không tự đảo theo số tiền hoàn: chỉ đảo lượng thực nhập kho. Hủy đơn không tạo doanh thu; hoàn cọc đi qua sổ tiền. Phí giữ cọc và lãi/phí cầm chưa được gộp thành lợi nhuận bán lẻ.

## Lịch sử và phân quyền

Migration `2026-10-27-57-finance-workspace` thêm:

- `finance_cost_type`: cấu hình có version; xóa khỏi danh mục bằng deletedAt, giữ liên kết lịch sử. Migration 58 cho phép tạo lại cùng tên bằng bản ghi mới, không sửa chứng từ cũ.
- `finance_expense`: tên/nhóm/cách tính/đơn giá/lượng/phiên bản được chụp tại lúc ghi. `requestKey` + digest + transaction/advisory lock chống gửi lại. Đảo duy nhất qua `reversesId`, cùng ngày phát sinh gốc, lượng/tiền đối dấu.
- `finance_order_review`: phiên bản đối soát bất biến, khóa order và kiểm tra phiên bản trước khi ghi.
- `finance_config_audit`: phiên bản cấu hình chi phí và người thay đổi.

Trigger PostgreSQL chặn UPDATE/DELETE sổ chi phí, phiên bản đối soát và audit. Các sửa sai tạo bút toán đảo/phiên bản mới, không sửa chứng từ cũ. Việc này có thể điều chỉnh kết quả kỳ quá khứ; ngày ghi và nội dung gốc luôn còn. Không phải cơ chế khóa sổ kế toán.

API `/api/admin/finance`: report, orders, orders/:id/reconcile, cost-types, expenses và expenses/:id/reverse. Đọc/ghi chỉ ADMIN, ngoài quy tắc `/admin` còn kiểm tra role ngay tại controller. Không đưa giá vốn vào API công khai. Đọc báo cáo trong transaction REPEATABLE READ, truy vấn riêng từng sổ để tránh nhân tiền do JOIN nhiều-nhiều. Có index ngày, order-item/order, version đối soát và nguồn hàng. Ngày/ID/lượng/tiền/enums được kiểm tại server; VND nguyên, tiền mỗi chứng từ tối đa 1.000 tỷ, từ chối vượt số nguyên an toàn.

Snapshot giá gốc thêm vào cả đơn web, bán trực tiếp và giữ chỗ tại lúc chốt giá. Không sửa dữ liệu lịch sử hoặc đọc giá mới để lấp snapshot cũ.

## Seed và xem trực tiếp dữ liệu phát triển

Database đang dùng là `web_ecommerce_ci_verify`. Chủ shop xác nhận toàn bộ hệ thống đang ở giai đoạn phát triển và cho phép thêm đơn/dữ liệu mẫu trực tiếp vào database chính. Chỉ lệnh có cờ `--current-development-database` mới được thực hiện việc này; lệnh seed cô lập mặc định vẫn từ chối database chính. Đã sao lưu riêng trước migration tại `D:/ModelUniverseRuntime/backups/shop-before-finance-*.dump`.

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

## Xác minh ngày 27/10/2026

- Bản ứng dụng chạy: `d1b287b`, production build/Next type check/Express build đạt. 1.042 unit test và 24 bài PostgreSQL (10 tài chính, 14 cây/SKU) đạt.
- Chrome thực: desktop 1440px, mobile 390px và tablet 768px; nhập chi phí, sửa định mức/đơn vị, ngừng dùng, kiểm tra lịch sử, đảo, đối soát, lọc ngày và xuất CSV. Không có lỗi JavaScript hoặc lỗi API tài chính trong lượt đạt. Đã kiểm tra light/dark, Escape của modal và không tràn trang.
- Kỳ chỉ có chi phí 26/10: không ghi doanh thu, chi phí 12.000đ, kết quả −12.000đ. Bộ test còn đối chiếu doanh thu/chi phí bằng truy vấn SQL độc lập.
- Năm lượt báo cáo trên fixture thực mất 65–120ms/lượt ở máy này. Tính toán thuần cho 10.000 đơn tổng hợp mất khoảng 0,9 giây; đây không phải benchmark 10.000 đơn PostgreSQL hay cam kết tải đồng thời.
- Sau kiểm thử đã dừng server fixture và khôi phục database shop. Đối chiếu đủ 103 sản phẩm không đổi ID/UUID/SKU/slug/giá/giá vốn tham chiếu/tồn/số đã bán/loại/tổ hợp. Shop vẫn 27 tài khoản, 0 đơn, 0 bút toán chi phí, 0 loại chi phí và 0 đối soát mẫu. Các bảng/cột và index mới đã có, dữ liệu mẫu chỉ ở database phát triển.
- Cookie QA không dùng được ở shop (401). Agent thật đã khởi động lại; không mở tunnel public, không tạo thanh toán hay vận đơn thật để kiểm tra.

Log, CSV và ảnh kiểm tra ở `D:/ModelUniverseRuntime/finance-*`; không được đưa ra đường dẫn public của ứng dụng. Bản seed ban đầu có 173 bút toán; thao tác kiểm thử UI có thêm bút toán và phiên bản trong database QA, đúng tính chất lịch sử bất biến.

Tham khảo khái niệm: [IFRS 15](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/) phân biệt việc thu tiền với thời điểm chuyển giao hàng/dịch vụ; [IAS 2](https://www.ifrs.org/issued-standards/list-of-standards/ias-2-inventories/) phân biệt giá trị hàng tồn với chi phí khi hàng được bán. `DELIVERED` và cách ghi chi phí ở đây là quy ước quản trị được triển khai cho ứng dụng, không phải tuyên bố tuân thủ toàn bộ các chuẩn mực đó.

## Bổ sung dữ liệu phát triển vào database chính theo yêu cầu chủ shop

```powershell
yarn seed:finance:development --current-development-database
```

Lệnh tạo pg_dump trước khi ghi, không reset hoặc xóa dữ liệu. Nhóm `finance-development-main-v1` có manifest và khóa transaction nên chạy lại không nhân bản. Tạo 54 đơn qua nhiều tháng, 12 SKU lịch sử ẩn có nhãn [DEV], 8 khách mẫu không được đăng nhập, 11 loại chi phí (carton, chống sốc, keo, túi khí, bao bì, nhân công, cước, di chuyển, thuê kho, điện/Internet), 315 bút toán và 3 hoàn tiền. Toàn bộ đơn giao có giá vốn/chi phí đối soát để xem lợi nhuận đầy đủ. Dữ liệu danh mục cũ, giá bán, tồn và thông tin đăng nhập Admin không bị ghi đè. Không gọi cổng thanh toán, vận chuyển, email hay Agent.

Màn hình đang chạy dùng chính database này; dashboard gắn thông báo có dữ liệu phát triển. SKU mẫu được ẩn khỏi cửa hàng công khai. Chứng từ/đơn mẫu được gắn nhãn, không được hiểu là giao dịch thực đã diễn ra. Chạy kiểm tra UI trên dataset chính bằng `yarn test:finance:ui --current-development-data`.

Biểu đồ dashboard gồm doanh thu/lợi nhuận và tiền thu/chi phí theo thời gian; donut cơ cấu chi phí; cột ưu đãi và xếp hạng SKU theo số lượng hoặc tiền hàng. Dữ liệu thiếu không bị thay thành lợi nhuận 0; biểu đồ donut không ép chi phí âm thành một tỷ trọng dương. Bảng số liệu có thể mở để đối chiếu. Khoảng trên 62 ngày gộp theo tháng trong phạm vi lọc.

### Kết quả bàn giao lần cập nhật này — 27/10/2026

- Bản chạy localhost cổng 6050: `7b0b70f`, gồm thay đổi giao diện/tính năng `aadb0c6` và sửa migration dùng chung. Migration tài chính 57 và 58 đã áp dụng; bản chạy này không đưa phần catalog đang được Antigravity phát triển vào deployment.
- Đã chạy seed trực tiếp trên database hiện tại theo ủy quyền mới của chủ shop, thay cho trạng thái database shop rỗng ghi trong biên bản trước. Có 54 đơn: 44 đã giao, 5 hủy, 3 đang xử lý và 2 đang giao; 12 SKU lịch sử ẩn; 8 khách mẫu bị khóa đăng nhập; 11 loại chi phí chưa xóa; 315 bút toán seed và 3 hoàn tiền. Chạy lại không nhân bản đơn hoặc đặt lại dữ liệu đã chỉnh.
- Kiểm thử UI thêm một khoản 6.000đ rồi đảo −6.000đ, nên sổ hiện có 317 bút toán, tổng tiền không tăng. Loại chi phí dùng để kiểm thử đã xóa khỏi danh mục; chứng từ và lịch sử vẫn còn. Phiên bản đối soát mới không thay tổng tiền đơn.
- Đối chiếu sau seed, chạy lại seed và kiểm thử: đủ 103 sản phẩm ban đầu giữ nguyên ID/UUID/SKU/slug/giá/giá vốn tham chiếu/tồn/số đã bán/loại/tổ hợp. Tổng catalog nội bộ 115 sản phẩm; cả 12 SKU `[DEV]` đều ẩn khỏi cửa hàng.
- Backup trước khi thêm dữ liệu: `D:/ModelUniverseRuntime/backups/before-finance-development-1793118796600.dump`, SHA-256 `96a0f4331c2aee51a9f0195aade92d1c8e0c9ff6be3d596622c62598d5c898c7`. Báo cáo đối chiếu cuối: `finance-development-final-db-verification.json` trong cùng thư mục runtime.
- 1.042 unit test, 13 kiểm thử PostgreSQL tài chính, kiểm tra kiểu và production build đạt. Bộ PostgreSQL cuối chạy trên snapshot commit đã chốt, không dùng source đang sửa đồng thời.
- Chrome thực xác minh desktop 1440px, mobile 390px và tablet 768px; bốn biểu đồ, chọn tiêu chí bán chạy, chú giải tương tác, kỳ ngày/tháng, light/dark, xuất CSV, CRUD loại chi phí, nhập lượng thập phân, trường disable/chỉ đọc, đảo bút toán và đối soát. Tab hỗ trợ End/Home, modal đóng bằng Escape. Không tràn trang, không lỗi JavaScript hoặc API tài chính trong lượt đạt.
- Kỳ mẫu 01–27/10/2026 đối chiếu từ database: doanh thu thuần 37.387.000đ, giá vốn 20.350.000đ, chi phí 2.057.000đ, lợi nhuận theo chi phí ghi nhận 14.980.000đ. Đây là kết quả của dữ liệu phát triển được gắn nhãn, không phải doanh số thực của shop.

Bằng chứng: `finance-ui-verification.json`, `finance-v2-chart-verification.json`, ảnh `finance-report-full.png`, `finance-report-light.png`, `finance-types-light.png`, `finance-mobile-390.png` và log `logs/finance-v2-*` tại `D:/ModelUniverseRuntime`. Ứng dụng chạy local, không mở tunnel public. Không tạo thanh toán, vận đơn hoặc email thật từ seed/kiểm thử này.

### Cầm cố, cọc giữ hàng và duyệt hoàn — 28/10/2026

Trang `/vi/admin/finance` bổ sung tab **Duyệt hoàn tiền**: xem khoản cọc giữ hàng, trả trước đơn mua, credit gia hạn cầm và tiền dư xử lý tài sản. Tạo yêu cầu không ghi đã hoàn. Người Finance duyệt phải khác người lập; chỉ xác nhận ngân hàng có chữ ký, đúng tiền/tài khoản/tham chiếu mới ghi hoàn tất. Khoản đang chờ được trừ khỏi số có thể yêu cầu hoàn tiếp để tránh hoàn chồng.

Chủ shop cấp quyền Finance/Compliance cho ADMIN tại tab này; giữ audit các lần cấp/thu quyền. Giấy tờ, thông báo hợp lệ, tranh chấp và chuyển quyền sở hữu được quản lý trong hồ sơ cầm; không đưa tài sản còn cầm hoặc chưa đủ căn cứ ra bán. Cọc và credit là nghĩa vụ tiền, không cộng vào doanh thu hàng bán. Gốc/lãi cầm được theo dõi ở sổ riêng, không coi tiền gốc là doanh thu bán mô hình.

Cấu hình đang chạy: pawn chỉ mô phỏng; bộ tiếp nhận ngân hàng và SMTP chưa cấu hình, nên không khẳng định đã hoàn tiền hoặc gửi email thật. Inbox/outbox vẫn lưu lịch sử. Migrations 60–61 giữ tương thích writer thông báo cũ bằng SQL DEFAULT cho hai trường lịch, không cần gộp chỉnh sửa đang làm dở của workspace khác.

Quy tắc chi tiết: [Cầm cố và giữ hàng](pawn-hold-ledgers.md). Kết quả kiểm chứng và giới hạn: [bàn giao 28/10](pawn-hold-acceptance-2026-10-28.md). Bản ứng dụng local hiện tại là `7a20915` trên cổng 6050; các thông tin bản chạy ở mục bàn giao 27/10 phía trên là lịch sử.


### Cập nhật vận hành thật — 28/10/2026 (thay trạng thái cấu hình ở mục trên)

- Gmail SMTP đã xác thực và Gmail chấp nhận email kiểm tra gửi về chủ shop; không đưa thông tin xác thực vào Git. Các thông báo nghiệp vụ mới dùng outbox thật; thư dev cũ lỗi vì thiếu SMTP không phát lại.
- Chính sách cầm mới v2: 0% lãi, không phí ẩn, theo phê duyệt vận hành nội bộ được chủ shop ủy quyền. Không giả giấy phép/chứng nhận bên ngoài; không tự giải ngân. Hồ sơ cũ giữ snapshot.
- Tab Duyệt hoàn tiền có gửi Chi hộ và kiểm tra payOS; chống chuyển trùng, chỉ SUCCEEDED khớp tài khoản/số tiền mới ghi hoàn, timeout giữ chờ đối soát.
- Đã xác thực bộ khóa Chi hộ riêng sau khi chủ shop cho phép IPv4 của máy chạy web. Truy vấn số dư và danh sách lệnh chi thật đều qua kiểm tra chữ ký. Node ưu tiên IPv4 để tránh lỗi 403 từ IPv6 chưa được cho phép. Không phát lệnh chuyển tiền thử.

Chi tiết: [live email/payOS](live-email-payos.md), [phê duyệt cầm nội bộ](../business/pawn-operating-approval-2026-10-28.md).


### Điều chỉnh theo chỉ định tiếp theo của chủ shop — 28/10/2026

Chính sách cầm cho báo giá mới được khôi phục 0,3%/ngày (30 bps), lãi kép và trần tổng lãi bằng gốc. Chính sách 0% ở mục trên là bản v2 lịch sử; không đổi snapshot hay sổ tiền của hợp đồng cũ. Xem [bản sửa đổi](../business/pawn-rate-0-3-amendment-2026-10-28.md).
