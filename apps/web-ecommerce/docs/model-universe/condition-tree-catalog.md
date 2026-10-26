# Catalog: loại hàng, cây tình trạng và tổ hợp SKU

## Quy tắc vận hành

- **Mẫu mô hình** giữ thông tin chung. **SKU** giữ loại hàng `New`/`2hand`, tổ hợp tình trạng, ảnh đại diện, một giá S và tồn kho. **Lần nhập** giữ nguồn, số lượng, giá vốn và bằng chứng riêng.
- Cùng mẫu, cùng chủ hàng, cùng loại và cùng tập tình trạng thì dùng chung SKU. Đảo thứ tự chọn hoặc ghi chú khác không tạo SKU mới. Không sinh sẵn tích Descartes của các nhánh.
- Tình trạng cụ thể thay lựa chọn cha rộng hơn. Nhóm có thể cho chọn nhiều hoặc chỉ một nhánh con. Ví dụ “thiếu hộp” loại trừ “móp hộp”; “thiếu hộp” kết hợp được với “lỏng khớp tay trái”.
- Nhánh có ID cố định. Đổi nhãn/thứ tự không đổi SKU. Di chuyển có xem trước ảnh hưởng; không cho thao tác làm tổ hợp đang dùng trở nên vô hiệu. Nhánh đã có lịch sử chỉ được ngừng dùng.
- Giá nhập duy nhất trên sản phẩm là **S**. R, giá thu và C50 vẫn tính theo công thức hiện hành. Giá vốn lấy từ phiếu nhập; không phải giá thu dự kiến. Trường S 2hand cũ chỉ còn phục vụ đối chiếu dữ liệu lịch sử.
- SKU đã có tồn/giao dịch không đổi âm thầm tổ hợp. Tạo/chọn SKU đích và dùng **Chuyển tình trạng** để chuyển số lượng sẵn bán, giữ lịch sử và tổng tồn.

Ví dụ cùng một mẫu:

| Loại | Tình trạng | S | Tồn |
|---|---|---:|---:|
| New | Không ghi nhận lỗi | 1.200.000 | 8 |
| 2hand | Thiếu hộp | 850.000 | 2 |
| 2hand | Lỏng khớp tay trái | 800.000 | 1 |
| 2hand | Thiếu hộp và lỏng khớp tay trái | 700.000 | 3 |

Nhận thêm đúng tổ hợp cuối làm tồn 3 → 4. Nếu còn thiếu khiên thì đó là tổ hợp khác. Ảnh công khai đại diện cho SKU; ảnh kiểm tra từng món nằm ở hồ sơ lần nhập, không ngụ ý khách được chọn một món vật lý riêng.

## Admin và cửa hàng

- Admin → Sản phẩm → **Tình trạng** (`/vi/admin/products/conditions`): cây dùng chung, tìm kiếm, nhóm/tình trạng, nhánh cha, kéo thả hoặc chọn đích bằng dropdown, thứ tự, quy tắc loại trừ và loại hàng áp dụng. Thả vào phần trên của dòng (hoặc giữ Shift) để sắp trước nhánh đó; thả vào giữa để chuyển thành con. Luôn xem lại nhánh cha/thứ tự rồi lưu; bàn phím/mobile dùng các trường tương ứng.
- Danh sách có tab **Nhóm theo mẫu**. Chi tiết Admin có bảng SKU, giá S/tồn/hiển thị, lịch sử nhập và thao tác tạo tổ hợp. Tổ hợp trùng dẫn đến SKU cũ và phiếu nhập.
- Form tạo tổ hợp kế thừa thông tin/ảnh mẫu, chỉ yêu cầu chọn loại/tình trạng và S. Luôn tạo nháp tồn 0. 2hand cần ảnh thật tải lên trước xuất bản; bằng chứng dịch vụ vẫn có yêu cầu riêng.
- Giá vốn và tồn là trường chỉ đọc trên form thông tin sản phẩm. Bulk chỉ cho nổi bật, loại hàng và tập tình trạng; không đổi giá/tồn, không bỏ qua khóa định danh hay tổ hợp duy nhất.
- Mỗi SKU có card, URL và tồn riêng ngoài shop. Chi tiết có lựa chọn các SKU cùng mẫu; chuyển lựa chọn đổi URL, ảnh, giá, tồn và ID trong giỏ hàng. Bộ lọc loại/tình trạng chọn nhiều, OR trong mỗi bộ lọc, AND giữa các bộ lọc trên cùng SKU. Chọn một nhánh lọc bao gồm các nhánh con.
- Giỏ hàng, đơn bán web, đơn trực tiếp và giữ hàng mang theo tổ hợp; chứng từ lưu ID và nhãn snapshot tại thời điểm khách xác nhận.

## Thu / trade / cầm

Khách chọn mẫu trong thư viện (kể cả mẫu hiện chưa có hàng bán), loại hàng, các nhánh và mô tả trường hợp chưa có. Chỉ **đúng tổ hợp có S đã duyệt, bật tham chiếu dịch vụ và không bị giữ** mới được báo giá. Không dùng tổ hợp gần giống hoặc tự trừ lỗi thêm lần nữa.

Với S = 700.000đ của tổ hợp đã duyệt: thu = 560.000đ, C50 = 350.000đ. Đây vẫn là báo giá dự kiến; không phải chứng từ chi tiền.

Trường hợp mới tạo đề xuất gắn với yêu cầu và thông báo Admin. Admin có thể yêu cầu bổ sung, từ chối, hoặc ánh xạ nhánh/tạo nhánh trong thư viện và duyệt S. Nếu tổ hợp đã có, tái sử dụng giá S; không ghi đè giá SKU khi nhận thêm hàng. Nếu chưa có, tạo nháp tồn 0. Báo giá/điều kiện mới phải được khách xác nhận theo luồng hiện có.

Nhập thu/trade chỉ xảy ra sau nhận hàng, bằng chứng kiểm tra, đồng ý báo giá, đối soát tiền và QC của **chính yêu cầu đó**. Một nguồn chỉ nhập một lần; nhiều nguồn được nhập cùng SKU. Nhập thêm không ẩn SKU đang bán. SKU mới xuất bản qua bước kiểm tra của hồ sơ nguồn; không bật công khai trước bằng form thông thường.

Tài sản cầm đang giữ, giải ngân hoặc chờ chuộc không thuộc tồn bán. Chỉ xử lý tài sản đủ điều kiện theo hợp đồng hiện hữu mới cho nhập; sau kiểm tra ảnh/giá/tồn mới xuất bản. Việc bổ sung cây không tự phê duyệt chính sách tài chính, hợp đồng hoặc dịch vụ bên ngoài.

## Chuyển đổi và tương thích

Migration schema `54`/`55` bổ sung bảng/cột và thư viện tình trạng; không tự viết lại giá/tồn hay suy đoán tình trạng các sản phẩm cũ. Giữ `product.id`, UUID, SKU, URL, các khóa chứng từ và snapshot báo giá cũ. `condition` cũ là trường tương thích; SKU đã đối chiếu dùng `itemTypeKey` và `conditionNodeIds` làm nguồn chính.

Chạy báo cáo vào **một file mới**, xem source snapshot và các mục cần quyết định:

```powershell
yarn catalog:tree:migrate --report=../../.artifacts/catalog-review.json
```

Schema migration phải được áp dụng trước báo cáo; lệnh trên khởi tạo kết nối như `db:migrate`, không seed hoặc reset dữ liệu. Không chạy `seed-dev`/`seed-prod` để chuyển đổi.

Ví dụ file quyết định:

```json
{
  "products": {
    "285": {
      "itemTypeKey": "preowned",
      "conditionNodeKeys": ["missing-box", "loose-left-arm"]
    },
    "286": {
      "itemTypeKey": "preowned",
      "conditionNodeKeys": ["missing-box", "loose-left-arm"],
      "mergeIntoId": 285
    }
  },
  "secondaryReferences": {
    "285": { "action": "ignore" },
    "287": { "action": "create", "approvePrice": false }
  }
}
```

Đây là **ví dụ định dạng**, không phải quyết định cho các sản phẩm thực #285–287. `salePriceVnd` có thể được chốt rõ ở SKU đích khi cần giải quyết xung đột giá. Giá S 2hand do migration cũ đặt placeholder không được mặc nhiên trở thành giá tham chiếu đã duyệt.

```powershell
yarn catalog:tree:migrate --apply=../../.artifacts/catalog-review.json --decisions=../../.artifacts/catalog-decisions.json --actor=<admin-id>
```

Áp dụng trong một transaction, đối chiếu fingerprint trước khi ghi, có audit. Tổ hợp trùng không tự gộp. Gộp đã duyệt chuyển tồn và giữ bản ghi cũ làm alias URL/ID, không xóa chứng từ. Nếu có đơn/giữ hàng/thông báo tồn đang tham chiếu SKU cần gộp, lệnh dừng để đối chiếu liên kết trước. Báo cáo lỗi thời hoặc còn quyết định thiếu sẽ rollback toàn bộ. Không bật luồng mới cho catalog thực khi chưa giải quyết báo cáo.

Import workbook không được xóa các SKU tổ hợp đã quản lý độc lập. Ngày 25/10/2026 của dữ liệu catalog lịch sử vẫn là ngày mốc theo dõi; không dùng nó để suy diễn đã nhận hàng hoặc làm bằng chứng nhập kho.

API mới: `/api/product-condition-tree` (đọc), `/families` (tìm mẫu), `/match` (đối chiếu tổ hợp); `/api/admin/product-condition-tree` (quản trị); tạo tổ hợp qua `/api/admin/products/:id/conditions`; chuyển tồn qua `/:id/transfer-condition`; duyệt đề xuất qua `.../buyback/:id/condition-case` hoặc `.../pawn/:id/condition-case`. Các API ghi giữ kiểm tra quyền, phiên bản và khóa chống thực hiện lặp. API tình trạng phẳng còn lại dùng cho tương thích lịch sử/luồng đối tác, không phải cấu hình cây mới.

## Demo và xác minh

```powershell
yarn seed:condition-demo --database=model_universe_tree_condition_demo
yarn build
yarn start:condition-demo --database=model_universe_tree_condition_demo --port=6080
# Trong terminal khác:
node scripts/test-condition-catalog.cjs
$env:E2E_BASE_URL="http://localhost:6080"
$env:CONDITION_DEMO_E2E="true"
yarn e2e e2e/condition-tree.spec.ts
```

Seed chỉ nhận database có hậu tố `_condition_demo` (test helper chỉ nhận `_test`), không có mặc định trỏ về database shop. Schema demo được tạo từ models hiện hành rồi baseline lịch sử; không replay các migration nhập catalog/giá placeholder cũ vào demo riêng. Seed lặp không nhân bản và không reset các thay đổi đang có.

Bộ dữ liệu gồm 12 mẫu thuộc 6 hãng, 64 SKU, 62 nhánh, tổ hợp 5 cấp, hàng hết/nháp/chưa duyệt giá, nhiều nguồn nhập cùng SKU, đề xuất mới, thiếu bằng chứng, trade và tài sản cầm. Ảnh và hồ sơ tài chính là **minh họa giả lập**, không phải giao dịch hoặc hàng thật của shop.

Tài khoản chỉ trong database demo: `admin@condition.demo` và `customer@condition.demo`; mật khẩu mặc định `Demo@2026!`, đổi bằng `CONDITION_DEMO_PASSWORD` trước lần seed đầu. Khi chạy preview phải đặt tên database/cổng và `DISABLE_BACKGROUND_JOBS=true`, tắt SMTP/Zalo/PayOS và dùng vận chuyển mô phỏng **trước khi khởi tạo Next.js**; không ghi cấu hình này vào `.env` của shop.

Các kiểm tra phải bao phủ: chuẩn hóa cây/tổ hợp, ràng buộc duy nhất khi tạo đồng thời, quyền và phiên bản, giá đúng tổ hợp, duyệt không nhập kho, bằng chứng/QC riêng từng nguồn, nhập/di chuyển lặp, bán/giữ/hoàn cùng tồn, snapshot chứng từ, báo cáo cũ rollback, alias giữ URL và giao diện desktop/mobile/VI/EN.

## Kết quả bàn giao 27/10/2026

- 989 unit tests (62 suites), 13 bài integration PostgreSQL về cây/tổ hợp/nguồn nhập/chuyển dữ liệu 9 bài integration bán trực tiếp và 26 bài giữ hàng/checkout/cọc–giao hàng đã đạt trên database dùng riêng.
- 8 bài E2E kiểm tra thêm/sửa/xóa nhánh, VI/EN, trường kho chỉ đọc, cây, tổ hợp trùng, URL/giỏ hàng đúng SKU, chọn nhiều bộ lọc, nhóm mẫu và mobile đã đạt. Rà soát thực tế các trang shop, chi tiết, cây Admin, SKU Admin và dịch vụ: không có lỗi JavaScript hoặc tràn ngang toàn trang ở 390px.
- Type check backend, production Next.js build và Express TypeScript build đã đạt. ESLint phạm vi thay đổi không có lỗi; còn warning kiểu dữ liệu/hook từ các module đang dùng. Full-project lint có hạn chế cấu hình plugin cũ, nên build xác minh dùng `next build --no-lint` cùng lint riêng và `tsc --project tsconfig.server.json`.
- Chưa áp dụng quyết định chuyển catalog thật. Giá tham chiếu cũ, ghi chú chưa phân loại, tổ hợp trùng và xung đột giá vẫn phải qua báo cáo/đối chiếu trước khi bật nghiệp vụ mới cho dữ liệu shop. Không triển khai hoặc xác minh dịch vụ thanh toán/vận chuyển bên ngoài trong demo.
