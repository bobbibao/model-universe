# Cầm cố và cọc giữ hàng — quy tắc ngày 28/10/2026

Tài liệu vận hành hiện hành theo yêu cầu chủ shop. Thay quy tắc giữ hàng 50%/15 ngày/cộng 10 ngày mỗi 5% và lựa chọn lãi đơn cũ cho **hồ sơ mới**. Snapshot hợp đồng và sổ tiền lịch sử không bị viết lại. Đây không phải chứng nhận pháp lý hoặc xác nhận tích hợp ngân hàng đã triển khai.

## Phân biệt mục đích tiền

| Mục đích         | Cơ sở tính                                                                               | Quyền giữ hàng                              | Ghi nhận doanh thu                                    |
| ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| HOLD_DEPOSIT     | Tiền hàng sau ưu đãi hợp lệ, chưa gồm phí giao/COD chưa chốt                             | Sau xác nhận tiền và reservation thành công | Không; là nghĩa vụ phải đối soát                      |
| PURCHASE_DEPOSIT | Trả trước đơn mua tối thiểu 10%, có mức tối thiểu vận chuyển/COD theo checkout hiện hành | Không tự tạo quyền giữ dài ngày             | Chỉ khi hoàn tất mua/giao hàng theo quy tắc báo cáo   |
| Trả góp đối tác  | Hợp đồng với đối tác hợp lệ                                                              | Theo hợp đồng riêng                         | Không có luồng tự giả lập trả góp trong tính năng này |

Cọc giữ hàng được chuyển sang một đơn mua tối đa một lần. Hủy đơn liên kết không tạo lại giữ hàng, không chuyển cọc sang đơn thứ hai. Xử lý hoàn tiền trên đúng nơi đang giữ nghĩa vụ tiền (đơn mua hoặc hồ sơ giữ hàng).

## Cọc giữ hàng

Đặt `M` là tiền hàng sau ưu đãi đã khóa, `D` là tiền xác nhận đã phân bổ. Tất cả là số nguyên VND. So sánh bằng nhân chéo BigInt, không dùng phần trăm hiển thị đã làm tròn.

| Khoản đã trả   | Trạng thái / thời hạn                                               |
| -------------- | ------------------------------------------------------------------- |
| D < 20% M      | Chưa kích hoạt, không giữ tồn, không có giờ bắt đầu                 |
| 20% ≤ D < 40%  | 10 ngày                                                             |
| 40% ≤ D < 50%  | 15 ngày                                                             |
| 50% ≤ D < 60%  | 25 ngày                                                             |
| 60% ≤ D < 70%  | 30 ngày                                                             |
| 70% ≤ D < 100% | 45 ngày                                                             |
| D = M          | PAID_IN_FULL, không có hạn giữ theo bảng                            |
| D > M          | Không phân bổ vượt tiền hàng; ghi khoản thực nhận chờ đối soát/hoàn |

Ví dụ M = 1.000.001đ: 200.000đ chưa đủ 20%; cần ít nhất 200.001đ. 500.000đ vẫn dưới 50%, hưởng 15 ngày.

Khách xem báo giá net và chấp thuận điều khoản có phiên bản trước khi tạo yêu cầu. Tạo yêu cầu hoặc tạo QR chưa giữ tồn. Tiền đến được xác minh bởi payOS qua SDK/webhook có chữ ký hoặc Finance đối chiếu giao dịch thực tế kèm căn cứ. Server khóa hồ sơ và sản phẩm trong cùng transaction: chỉ hàng của shop sẵn bán, đã xác minh quyền sở hữu, còn tồn khả dụng mới được đặt giữ. Khách cùng giữ đơn vị cuối chỉ một người nhận reservation; khoản nhận của người còn lại vào đối soát.

`hold_start_at` (cột hiện có `startedAt`) là thời điểm tiền hợp lệ và reservation cùng hoàn tất. Một ngày = 86.400.000 ms. Hạn = thời điểm bắt đầu ban đầu + số ngày theo mốc + gia hạn thủ công được ghi nhận. Nạp thêm vượt mốc mới dùng ngày mới từ giờ bắt đầu cũ; trong cùng mốc không đổi hạn. Đến hạn (`now >= expiresAt`), job giải phóng tồn đúng một lần, giữ tiền là nghĩa vụ đối soát. Tiền đến sau hạn không tự kích hoạt lại, kể cả lúc job chưa chạy.

`cancel_requested` dành cho yêu cầu hủy đã có tiền, cần shop xử lý; không tịch thu cọc. Hủy được duyệt hoặc hết hạn giải phóng tồn nguyên tử, idempotent. Tranh chấp, đảo giao dịch, sai SKU, không giao hàng được ghi riêng; hồ sơ có cờ tranh chấp/đảo tiền/đối soát không được tiếp tục mua hoặc tự mở lại. Quyết định giải quyết tranh chấp cần Compliance và căn cứ. Tiền đã chuyển vào đơn mua được hoàn theo nghĩa vụ của đơn mua.

Voucher được kiểm tra theo chính sách lợi nhuận hiện có; quota/budget được đặt trước, không dùng lại cho đơn khác. Hủy/hết hạn trả quota/budget một lần. Khi chuyển thành đơn mua, voucher và ưu đãi đi theo snapshot; không tính tiền ưu đãi hoặc số lượt sử dụng lần hai.

## Cầm cố

Giá ước tính mỗi chiếc `C50 = ROUND(S × 0,5, 0)`; làm tròn half-up đến VND. S là giá bán thực đã được duyệt đúng mẫu/SKU/hãng/phiên bản và tổ hợp tình trạng. Không dùng R niêm yết hoặc B thu mua; không trừ lỗi lần hai. Chưa có S được duyệt thì báo giá riêng, không hiện 0đ thành báo giá. C50 không phải cam kết khoản cầm. Khoản cuối cần kiểm hàng, giấy tờ, quyền sở hữu và các phê duyệt có thẩm quyền; hạn mức thẩm định 50–80% V hiện có vẫn là kiểm tra bổ sung, không thay thế C50 trên cửa hàng.

Chỉ định hiện hành của chủ shop khôi phục **lãi kép 0,3%/ngày (30 bps), trần tổng lãi bằng gốc ban đầu**, theo [bản sửa đổi chính sách](../business/pawn-rate-0-3-amendment-2026-10-28.md). Chính sách 0% v2 trở thành lịch sử; không sửa snapshot hợp đồng đã tồn tại. Mã phê duyệt `owner_rate_0_3` ghi chỉ định nội bộ, không chứng nhận pháp lý bên ngoài. Kiểm danh tính, quyền sở hữu, hợp đồng và bàn giao vật vẫn bắt buộc trước khi Finance ghi khoản chuyển tiền thật.

### Kỳ dòng tiền, trả gốc và gia hạn

Thời gian tính theo số ms thực tế / 24h; dùng decimal.js precision 48, half-up đến số nguyên VND tại điểm thanh toán. Không làm tròn mỗi ngày. Credit nhận/hoàn không làm khởi động lại kỳ lãi. Mỗi khoản trả gốc đã xác nhận chia thành một kỳ: kỳ sau tính trên gốc còn lại và lãi chưa thanh toán; không tính cả kỳ trên gốc ban đầu hoặc gốc giảm hồi tố. Gốc ban đầu vẫn là trần tổng lãi cả hợp đồng, tính cả phần làm tròn đã ghi ở những lần trả trước. Trả sớm tính tới thời điểm trả thực tế; trả hết dừng lãi, bàn giao vật được theo dõi riêng.

Gia hạn cần ngày mới muộn hơn hạn cũ. Tính lãi dự kiến ở cả hai hạn theo cùng lịch sử dòng tiền; credit cần trả trước = MAX(0, lãi dự kiến hạn mới − lãi dự kiến hạn cũ). Khoản nhận phải được xác nhận và gắn đúng lần yêu cầu gia hạn. Có thể nhận nhiều giao dịch cho một lần gia hạn và nhiều lần gia hạn nối tiếp. Credit không tăng gốc, không được trừ hai lần; khi chuộc được dùng trả lãi, phần dư đi qua yêu cầu hoàn/đối soát.

Trước khi trừ credit, chặn nếu `P_outstanding + I_projected > FLOOR(0,8 × V)`. Việc có nhiều credit không giúp vượt trần. Finance tính lại trần và khoản nhận trước khi duyệt hạn mới; sửa hạn hủy lịch nhắc cũ và tạo T−10/T−5 mới. Khi đã chuyển OVERDUE_REVIEW, Finance vẫn có thể từ chối đề nghị gia hạn đang treo để tiếp tục xử lý hồ sơ và credit, không tự gia hạn hoặc tịch thu khoản đã nhận. Lịch có dedupe theo hợp đồng + hạn + mốc; outbox chưa đến giờ không được gửi hoặc hiện sớm trong inbox. Thư đã gửi không thể thu hồi.

### Quá hạn và tài sản

Đến hạn chuyển `DUE_GRACE`, đúng 48h chuyển `OVERDUE_REVIEW`. Không tự phạt, không tự thanh lý và không tự nhập tồn bán. Admin/Finance/Compliance phải:

1. Kiểm hồ sơ, điều khoản xử lý và tranh chấp; xác nhận thông báo đã tống đạt hợp lệ, căn cứ và ngày sớm nhất được xử lý.
2. Compliance duyệt căn cứ; Finance là người khác đối chiếu nghĩa vụ/credit/tiền. Quyết định bị vô hiệu khi có giao dịch mới, đổi thông báo hoặc tranh chấp.
3. Admin ghi quyết định xử lý có căn cứ và điều kiện hợp đồng. Compliance xác nhận chuyển quyền sở hữu bằng bằng chứng riêng.
4. Chỉ sau đó mới kiểm hàng, nhập kho một lần và duyệt đăng bán. Tài sản còn cầm, tranh chấp hoặc chưa đủ quyền sở hữu không được xuất bản qua form sản phẩm thông thường.

Phân bổ tiền bán tài sản theo biên bản khách chấp thuận: chi phí có chứng từ → gốc → lãi → tiền dư trả khách. Bán phải có xác nhận thu đủ tiền, không lấy vận đơn/giao hàng làm bằng chứng đã thu. Tiền bán và khoản trả thêm chia kỳ dòng tiền; mỗi nguồn bán được theo dõi riêng, nên hoàn đơn bán chỉ đảo phần phân bổ của nguồn đó, không mở lại lãi đã được trả bằng credit hoặc khoản trả khác; hoàn tiền của đơn bán cần đối soát và biên bản điều chỉnh, không viết lại ledger cũ. Với hợp đồng lãi kép, khách xác nhận rõ số liệu biên bản là dự kiến tại thời điểm báo giá và lãi tiếp tục theo hợp đồng tới khi thực trả đủ. Khi thực hiện, kiểm lại biên bản theo thời điểm đã báo giá để không bắt ký lại mỗi khi lãi làm tròn thay đổi; sổ lưu cả ước tính đã ký và phân bổ thực tế lúc thực hiện, phần thiếu vẫn cần thanh toán. Hồ sơ xử lý chưa có phê duyệt pháp lý bị chặn nghiệp vụ tiền thật.

Hệ thống hiện chỉ tự gắn một dòng bán số lượng 1 với tài sản cụ thể; lô hàng trộn nhiều tài sản cần đối chiếu riêng.

## Hoàn tiền và phân quyền

`money_operation`: requested → approved / rejected → completed khi bộ tiếp nhận ngân hàng xác nhận. Người duyệt Finance phải khác người lập. Kiểm số dư sau khi trừ các yêu cầu đang chờ, khóa hồ sơ để tránh hoàn chồng. Số tiền, tài khoản nhận, mục đích và căn cứ được khóa; muốn sửa phải từ chối và lập yêu cầu mới. Hoàn tiền dư xử lý tài sản dùng đúng tài khoản đã chấp thuận trong biên bản.

`POST /api/payments/bank/confirmation` nhận HMAC SHA-256 qua `x-bank-signature`, khóa `BANK_EVENT_SIGNING_SECRET` tối thiểu 32 ký tự. Envelope cố định theo thứ tự:

```json
{
  "operationId": 123,
  "amountVnd": 200000,
  "reference": "BANK-REFERENCE",
  "status": "SUCCEEDED",
  "accountHash": "sha256-of-canonical-account",
  "timestamp": 1793150000,
  "nonce": "provider-event-id"
}
```

Chữ ký trên JSON.stringify(envelope), timestamp giây trong ±5 phút. Adapter tin cậy phải kiểm chữ ký/sự kiện của chính nhà cung cấp trước khi ký envelope. Khóa này chỉ ở server; không gửi browser. So khớp số tiền và hash tài khoản đã duyệt, chống replay theo nonce và tham chiếu tiền dùng chung các ledger. Gửi lại cùng giao dịch không hoàn hai lần. Đã chuyển thật vẫn phải được ghi nhận nếu sau lúc duyệt xuất hiện tranh chấp; các cờ kiểm soát vẫn giữ để đối soát.

Đã có adapter payOS Chi hộ dùng bộ khóa riêng `PAYOS_PAYOUT_*`: Finance bấm gửi lệnh chi, server đối chiếu phản hồi có chữ ký, chỉ ghi hoàn khi giao dịch SUCCEEDED khớp đủ dữ liệu. Timeout/PROCESSING không hoàn tất hoàn tiền; job và nút kiểm tra chỉ tra cứu. Có chữ ký xác nhận FAILED/CANCELLED thì đóng yêu cầu không thành công, không ghi bút toán hoàn. Xem [hướng dẫn live email/payOS](live-email-payos.md). Bộ tiếp nhận HMAC nói trên vẫn là adapter tùy chọn; không dùng phản hồi giả trên dữ liệu shop.

Chủ shop được xác định bằng tài khoản ADMIN khớp ADMIN_EMAIL, có thể cấp `finance`/`compliance` cho ADMIN khác trong hàng đợi tài chính. Các nhân viên chỉ có quyền được cấp; đổi role xóa quyền nhạy cảm. Duyệt xử lý tài sản vẫn cần hai người độc lập. Tất cả thay đổi quyền có audit.

## Dữ liệu, API và chuyển đổi

Migration 60 thêm governance, credit ledger, mục đích tiền/điều khoản cọc, nghĩa vụ hoàn, quyền nhân viên, xác minh sở hữu và lịch outbox; cập nhật CHECK constraint cũ. Migration 61 đặt DEFAULT CURRENT_TIMESTAMP ở DB cho lịch thông báo để tiến trình cũ chưa biết các cột mới vẫn ghi được; migration 60 cũng backfill an toàn khi bảng cũ đã có dữ liệu. Không reset, gộp hoặc tự chứng nhận quyền sở hữu cho hàng cũ. Hồ sơ giữ hàng theo quy tắc cũ cần đối chiếu riêng; tiền nạp mới không tự đổi điều khoản cũ. Hợp đồng cầm cũ giữ snapshot công thức để đọc/đối chiếu, không tự coi là đã được duyệt pháp lý.

- Hold: `/reservations/quote`, tạo với termsAccepted + termsVersion, `/:id/payment-link`, `sync-payment`, `delivery`, `cancel`, `dispute`, `refund-request`.
- Pawn: action xác minh giấy tờ/thông báo/duyệt xử lý/chuyển quyền; `extension-credit`, trả gốc từng phần, `credit-refund-request`.
- Finance: `/admin/commerce/money-operations`, quyết định theo expectedVersion; `/admin/commerce/access` cấp quyền.
- Sở hữu hàng: `/admin/products/:id/verify-ownership`, Compliance + căn cứ; không dùng bulk để tự xác minh.

Các ledger cũ giữ append-only; không sửa/xóa khoản tiền đã ghi. Refund terms có trigger khóa sửa. Job quá hạn và tiền nhận đều dùng transaction và khóa bản ghi; chuyển cọc có dấu mốc duy nhất. Doanh thu bán chỉ theo hoàn tất giao dịch, không cộng cọc/credit vào doanh thu lần nữa.
