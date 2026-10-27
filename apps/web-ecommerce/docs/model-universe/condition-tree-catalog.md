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

## Dữ liệu kiểm thử (không triển khai)

Fixture gồm 12 mẫu thuộc 6 hãng, 64 SKU, 62 nhánh, tổ hợp 5 cấp, hàng hết/nháp/chưa duyệt giá, nhiều nguồn nhập cùng SKU, đề xuất mới, thiếu bằng chứng, trade và tài sản cầm. Đây là dữ liệu giả chỉ cho database kiểm thử riêng; không chạy seed trên database shop.

Runtime demo và lệnh khởi động demo đã được gỡ. Hướng dẫn chạy website thật, cấu hình và đối chiếu dữ liệu nằm tại [single-production-runtime.md](single-production-runtime.md). Database integration có thể chạy độc lập, tự tạo và gỡ database `_test`:

```powershell
node scripts/test-condition-catalog.cjs
```

Các kiểm tra phải bao phủ: chuẩn hóa cây/tổ hợp, ràng buộc duy nhất khi tạo đồng thời, quyền và phiên bản, giá đúng tổ hợp, duyệt không nhập kho, bằng chứng/QC riêng từng nguồn, nhập/di chuyển lặp, bán/giữ/hoàn cùng tồn, snapshot chứng từ, báo cáo cũ rollback, alias giữ URL và giao diện desktop/mobile/VI/EN.

## Kết quả bàn giao 27/10/2026

- 989 unit tests (62 suites), 13 bài integration PostgreSQL về cây/tổ hợp/nguồn nhập/chuyển dữ liệu 9 bài integration bán trực tiếp và 26 bài giữ hàng/checkout/cọc–giao hàng đã đạt trên database dùng riêng.
- 8 bài E2E kiểm tra thêm/sửa/xóa nhánh, VI/EN, trường kho chỉ đọc, cây, tổ hợp trùng, URL/giỏ hàng đúng SKU, chọn nhiều bộ lọc, nhóm mẫu và mobile đã đạt. Rà soát thực tế các trang shop, chi tiết, cây Admin, SKU Admin và dịch vụ: không có lỗi JavaScript hoặc tràn ngang toàn trang ở 390px.
- Type check backend, production Next.js build và Express TypeScript build đã đạt. ESLint phạm vi thay đổi không có lỗi; còn warning kiểu dữ liệu/hook từ các module đang dùng. Full-project lint có hạn chế cấu hình plugin cũ, nên build xác minh dùng `next build --no-lint` cùng lint riêng và `tsc --project tsconfig.server.json`.
- Trạng thái lịch sử của đợt demo: khi đó chưa chuyển catalog thật. Đợt hợp nhất source chính sau đó đã đối chiếu 101 SKU; xem single-production-runtime.md và báo cáo riêng trên máy.


## Cập nhật trải nghiệm chọn tình trạng

- Khách dùng **tổ hợp có báo giá** của đúng mẫu/loại hàng trước; dropdown tùy chỉnh theo nhóm và các cấp chi tiết chỉ xuất hiện khi nhánh tương ứng được chọn. Tất cả các cấp chi tiết đều tùy chọn. Không dựng cây quản trị cho khách.
- Dropdown dùng dòng chữ + dấu tích, chọn nhiều và khách chủ động đóng/mở. Chọn một nhánh loại trừ tự bỏ nhánh đối nghịch cùng các con của nó. Các lỗi độc lập vẫn được giữ.
- Dấu tích nhánh cha là trạng thái giao diện suy ra khi tất cả con đã chọn; không tự thay ID lỗi cụ thể bằng ID cha, vì như vậy sẽ đổi nghĩa tổ hợp/SKU và giá. Chọn/bỏ lựa chọn không tự tạo SKU.
- Cây Admin mặc định thu gọn, phân biệt lựa chọn nhánh và chỉnh sửa từng nhánh. Có thể chọn/bỏ nhiều nhánh để đối chiếu; form bên phải luôn sửa **một** nhánh đang mở, không ngầm áp dụng sửa hàng loạt. Thao tác thêm con chuyển lên form, không đặt dấu cộng trên mọi dòng.
- Bỏ ô **Hướng dẫn nhận biết** khỏi form: đó là mô tả phụ nội bộ, không dùng để xác định tổ hợp, giá hoặc tồn. Dữ liệu mô tả cũ vẫn được giữ nguyên.
- Chưa có S được duyệt: thông báo rõ báo giá riêng sau nhận/kiểm hàng, không hiển thị 0đ. Tổng có món cần báo giá cũng hiển thị trạng thái chờ; phần đã biết chỉ là tạm tính, không ngầm coi món chưa có giá bằng 0.
- Card chỉ hiện tên lỗi cụ thể dưới dạng tag có màu (ví dụ **Thiếu súng**); vị trí như **Tay trái** giữ ngữ cảnh **Lỏng khớp · Tay trái**. Giới hạn một tag và số lỗi còn lại để hàng card đồng đều; tooltip/chi tiết giữ đầy đủ thông tin.
- Kiểm thử click thật trên database demo riêng bao phủ gửi nhiều món New/2hand, tổ hợp mới, bổ sung bằng chứng, duyệt S tồn 0, nhận hàng, kiểm hàng, xác nhận khách, đối soát, QC và nhập SKU. Trade kiểm tra khách trả thêm, shop trả chênh lệch và đổi ngang giá.
- Đổi ngang giá không tạo phiếu chi 0đ. QC07 xác minh lịch sử đối soát của chính giao dịch và chuyển quyền sở hữu; thiếu lịch sử đối soát vẫn bị chặn.

Lệnh kiểm thử browser (chỉ dùng database demo riêng, có thể tạo một database `_condition_demo` mới để có tồn/đề xuất ban đầu):

```powershell
$env:E2E_BASE_URL="http://localhost:<test-port>"
$env:CONDITION_DEMO_E2E="true"
yarn e2e e2e/condition-tree.spec.ts e2e/service-condition-journeys.spec.ts
```

Các hồ sơ/ảnh/chứng từ trong E2E đều là dữ liệu minh họa. Mọi thay đổi nghiệp vụ trong bài hành trình được thực hiện qua giao diện; API chỉ phục vụ đăng nhập và đọc kết quả để kiểm chứng.


Xác minh bản UX: **994 unit tests / 62 suites, 14 integration PostgreSQL và 12 E2E đã đạt**. Production build Next.js (kèm type check) và Express TypeScript build đạt; ESLint phạm vi thay đổi không có lỗi, còn cảnh báo kiểu dữ liệu trong test. Các lượt thất bại do hết dung lượng cache ban đầu đã được chạy lại sau khi xử lý môi trường.

Bản preview cổng 6080 của đợt kiểm thử đã được dừng và database fixture đã được gỡ sau khi sao lưu. Website vận hành hiện tại chỉ dùng source chính, dữ liệu shop và cổng 6050. Không chạy E2E có ghi dữ liệu trên website này.

## Chủ shop đính chính loại hàng — 27/10/2026

Theo xác nhận mới của chủ shop, toàn bộ 101 SKU ban đầu thuộc loại `2hand`: sửa 100 SKU đang gắn New, giữ SKU đã là 2hand. Đối chiếu bằng transaction và khóa danh mục; giữ ID, UUID, SKU, slug, giá, tồn và số đã bán. Chứng từ/snapshot giao dịch cũ không bị viết lại. Có bản sao lưu PostgreSQL trước thay đổi và audit `owner_type_correction` / `owner_2hand_and_options_20261027`.

Đã thêm sáu tổ hợp tham khảo ở ba mẫu ngẫu nhiên, mỗi tổ hợp có SKU/URL riêng, S được chủ shop cho phép tự đặt. Tồn tất cả SKU mới bằng **0**, không tạo chứng từ nhập hoặc tăng tồn giả. Ảnh kế thừa được ghi rõ là ảnh của mẫu gốc, chưa phải ảnh kiểm hàng của tổ hợp này.

| Mẫu | Tổ hợp tham khảo | Giá S |
|---|---|---:|
| Ngao Bính | Thiếu hộp / Thiếu hộp + lỏng khớp tay trái | 550.000 / 450.000đ |
| Blade King | Móp hộp / Thiếu khiên + trầy phần tay | 310.000 / 260.000đ |
| Triệu Vân & Bạch Long Mã | Thiếu đế / Thiếu hướng dẫn + lỏng khớp chân phải + tróc sơn | 1.160.000 / 910.000đ |

Manifest trên máy: `D:/ModelUniverseRuntime/owner-2hand-options.json`; SKU mới #287–292. Thao tác có mã phiên ổn định; chạy lại không nhân bản SKU. Icon mở cây dùng chung SVG 16px, xoay theo `aria-expanded`, căn giữa ô bấm 26 × tối thiểu 44px, áp dụng cả picker và cây quản trị.
