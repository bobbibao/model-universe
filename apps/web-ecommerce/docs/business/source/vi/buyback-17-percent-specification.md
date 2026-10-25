<!-- Archived from Google Drive: "Đặc tả thu mua 17%, ba mức giá và kiểm duyệt trước đăng bán – MODEL UNIVERSE"
     (docs.google.com/document/d/15KBaG53zQKpIuejytfHZivk4Ee5i1RQrUI3yTSpH610), updated 25/10/2026, read on 2026-10-25.
     Referenced by the header added on 2026-10-25 to every business document in the Drive folder
     ("THAM CHIẾU GIÁ THU MỚI: B17 = ROUND(0,17 × S, 0) ..."). Text as in the source, headings normalised. -->

# ĐẶC TẢ THU MUA 17%, BA MỨC GIÁ VÀ KIỂM DUYỆT TRƯỚC ĐĂNG BÁN

MODEL UNIVERSE | BRD + SRS + kiểm thử. Ngày cập nhật: 25/10/2026. Tên file ổn định, lịch sử sửa tại CHANGELOG.
Trạng thái: quy định/đặc tả để triển khai; các chức năng web/Zalo chưa được chứng minh đã chạy.

## I. Nguồn quy tắc & định nghĩa ba giá

1. Chính sách thu mới: B17 = ROUND(0,17 × S, 0) đồng, tương đương 17% của giá bán thực mục tiêu S, KHÔNG phải giảm 17%.
   Không áp dụng bảng trừ theo 9 bậc, không có phụ phí cố định 50.000đ/lỗi, không khấu trừ lỗi tự động. Chỉ đưa B17 dự
   kiến khi đã khớp đúng SKU/màu, có S được Admin duyệt và hàng khách khai không có vấn đề. Nếu có lỗi/thiếu phụ kiện,
   chưa xác minh mã, S chưa duyệt hoặc thiếu dữ liệu, giữ B17 = NULL và chuyển ADMIN_REVIEW.
2. B = giá thu dự kiến hoặc giá thu cuối được Admin xác nhận (phải có status/provisional flag và quote revision). Với hàng
   shop đã mua, H trong danh mục là giá nhập/thu đã GHI NHẬN, chỉ coi là giá vốn thực tế sau khi đối soát chứng từ từng
   lô; không bị tính lại theo 17%; giá thu B17 của yêu cầu mới không thay thế dữ liệu lịch sử.
3. S = giá bán THỰC MỤC TIÊU của shop cho đúng SKU/phiên bản, phải được Admin duyệt độc lập theo vốn, thị trường, phí,
   lợi nhuận. Có thể là giá thanh toán chuẩn sau mã thành viên 10% khi chính sách áp dụng lên R thật:
   S = ROUND(0,90 × R, 0). Không mặc định công thức này khi SKU chưa có giá công khai hoặc chưa được duyệt.
4. R = giá niêm yết công khai THẬT trên web đã được Admin xác minh. KHÔNG tạo R = S/0,90 giả và không tự đưa S hoặc B lên
   web như giá công khai. Checkout dùng giá khách thanh toán cuối P sau voucher, khác S và R khi có quyền ưu đãi. Nếu R
   thiếu, listing không thể ACTIVE.
5. Ví dụ: S = 1.000.000 → B17 = 170.000; S = 2.000.000 → 340.000; S = 5.000.000 → 850.000; S = 5.000.001 → 850.000 (làm
   tròn); S = 10.000.000 → 1.700.000; S = 20.000.000 → 3.400.000. Không có bước nhảy tại 5/10/20 triệu. Nếu R = 2.500.000
   và MEMBER10 thật sự áp dụng → S = 2.250.000, B17 = 382.500; không lấy 17% của R.
6. S có thể được duyệt lại sau kiểm hàng để đảm bảo vốn/lợi nhuận, nhưng báo giá đã gửi khách chỉ thay đổi bằng quote
   revision mới và khách đồng ý lại; không chỉnh giá hồi tố. Các hợp đồng và giao dịch đã chốt giữ nguyên theo thỏa thuận.

## II. Quy trình thu/Trade/cầm

7. Form thu: khách nhập/chọn SKU, hãng, màu, tỉ lệ, tình trạng, ảnh/video thật, phụ kiện, số lượng, SĐT, phương thức
   giao. Gợi ý autocomplete không tự xác nhận variant. Hàng có vấn đề → không tự áp tỷ lệ/chế tài lỗi, chuyển Admin; hàng
   không lỗi đủ SKU và S duyệt → B17 dự kiến có nhãn CHƯA CHỐT.
8. Luồng: SUBMITTED → WAITING_SHIPMENT → RECEIVED → INSPECTING → ADMIN_REVIEW/INSPECTION_PASSED → OFFER_SENT →
   CUSTOMER_ACCEPTED hoặc REJECTED → SETTLEMENT_COMPLETED → READY_FOR_QC → QC_PASSED hoặc QC_FAILED →
   INVENTORY_TRANSFERRED → LISTING_DRAFT → LISTING_ACTIVE sau duyệt xuất bản. Khách từ chối/hủy/trả hàng dừng luồng, không
   cộng kho.
9. TRADE: phần hàng khách đưa dùng B17 làm tham khảo khi đủ điều kiện; món shop khách muốn nhận dùng S/R/checkout thật;
   D = giá mua món shop − tổng giá thu được Admin duyệt, D > 0 khách trả thêm, D < 0 Admin phải duyệt khoản shop trả lại,
   không tự trả. Báo giá nhiều món thiếu một nguồn giá thì trạng thái INCOMPLETE; Admin/khách xác nhận phiên bản báo giá
   cuối.
10. CẦM CỐ: B17 chỉ là giá tham khảo thanh lý khi Admin định giá tài sản; giá trị cầm do Admin thẩm định riêng theo tình
    trạng/khả năng thanh khoản. Giữ tỷ lệ giải ngân 50%–80% giá trị tài sản thẩm định; không tự cho vay 17% của S. Lãi kép
    0,3%/ngày chỉ là mô phỏng chưa được bật thu do trạng thái LEGAL_REVIEW_REQUIRED và phải kiểm tra pháp lý; giữ toàn bộ
    điều kiện/giới hạn cầm cố khác.
11. Hai luồng đặt cọc HOLD_DEPOSIT 50% để giữ hàng và PURCHASE_DEPOSIT 10% để thanh toán trước đơn mua vẫn tách biệt.
    Voucher, quyền hạng, chạm đáy 24H, dự phòng điểm và biên lời vẫn theo bộ quy tắc riêng; giá B17 không phải voucher và
    không sinh điểm.

## III. Kiểm tra bắt buộc trước đăng bán

12. Gate kiểm duyệt QC chỉ mở khi hoàn thành mọi điều kiện:
    - QC01 Đã nhận hàng vật lý có chứng cứ, không chỉ có tracking.
    - QC02 Đã kiểm hàng có video/ảnh thật, góc chụp xác minh từng chiếc; ảnh mẫu chỉ để tham khảo.
    - QC03 Đúng SKU, hãng, mã kit, biến thể, màu, tỉ lệ và UnitID hoặc LotID; nghi giả mạo phải QUARANTINED.
    - QC04 Kiểm phụ kiện, hộp, part, khớp, sơn/custom, lỗi, tình trạng, mức độ nguyên bản; mô tả công khai trung thực.
    - QC05 Khách có quyền bán hoặc đổi, nguồn gốc và chứng từ hợp lệ; không sử dụng hàng đang cầm/chưa giải chấp hoặc tranh
      chấp.
    - QC06 Admin đã kiểm định và xác nhận giá thu cuối, khách đã chấp nhận, không coi im lặng là đồng ý.
    - QC07 Shop đã thanh toán/settle giao dịch thu hoặc Trade, kèm chứng từ và đối soát tiền cọc/credit, không thanh toán
      trùng.
    - QC08 Số lượng > 0, hàng đúng chiếc/lô và không bị nhập/đăng trùng; khóa theo source_item_id.
    - QC09 Giá vốn H phải được xác nhận bằng phiếu nhập/chi trả theo lô, phí sửa/đóng gói/ship shop chịu có chứng từ, không
      ghi đè vốn hàng cũ.
    - QC10 Admin duyệt S > 0 độc lập với B và vốn, kiểm chi phí và biên lợi nhuận theo SKU.
    - QC11 Admin duyệt R > 0 là giá niêm yết THẬT, có nguồn; không tự lấy S/0,9 để tạo giảm giá ảo.
    - QC12 Rule engine kiểm lợi nhuận sau voucher/hạng/quà/phí vận chuyển/dự phòng điểm; nếu thiếu dữ liệu thì CHẶN.
    - QC13 Tồn thực khả dụng, khóa reservation chống bán trùng, sở hữu của shop đã xác nhận; seller không tự tham gia.
    - QC14 Khối lượng/kích thước kiện hàng kiểm thực khi cần; số mặc định từ tỉ lệ model chỉ là ước tính.
    - QC15 Ảnh/tên mô tả không lộ số điện thoại, hóa đơn, địa chỉ, giá vốn và thông tin khách.
    - QC16 Người duyệt QC (ID), timestamp, lý do/bằng chứng ngoại lệ được lưu, hậu kiểm có thể truy vết.
13. Nếu thiếu BẤT KỲ điều kiện: QC_FAILED/CHƯA ĐỦ. Khi QC đủ: Admin tạo inventory_receipt và product_listing DRAFT trong
    transaction có idempotency; sau đó PUBLISHER kiểm cuối ảnh/S/R/stock/trạng thái rồi mới ACTIVE. Sửa ảnh, giá, SKU hoặc
    tình trạng sau duyệt phải vô hiệu QC và duyệt lại.
14. Trong bảng Sheets: Hàng thu tạm có checklist AA:AM; AI tự kiểm cờ AA:AD/AG:AH, giá AE = S/AF = R, người duyệt AJ, thời
    gian AK, UnitID AL và S/T/U/V/Y/Z. Tab Hàng thu chờ đăng lọc AI = ĐỦ ĐIỀU KIỆN, mã đăng W còn trống. Đây chỉ là bảng mẫu
    quản trị, KHÔNG tự cộng kho/đăng web; backend phải kiểm lại tất cả điều kiện trong transaction.

## IV. Cơ sở dữ liệu & API

15. Dữ liệu: pricing_rules(rate = 0.17, rounding, approved_at, enabled, effective_from), product_prices(sku_id,
    variant_id, S, R, approval_state, price_verification_ref), buyback_requests, buyback_items, buyback_quotes(revision),
    buyback_inspections, qc_reviews(checklist/actor/time), inventory_units, inventory_lots, inventory_receipts(source_item_id
    UNIQUE), listing_drafts, listing_publication_audit, payments/settlements, notification_outbox.
16. API: GET /pricing/buyback-preview?sku&variant&condition; POST /buyback/requests; PATCH /admin/buyback/{id}/inspection;
    POST /admin/buyback/{id}/quote; POST /me/buyback/{id}/accept-quote; GET /admin/listing-qc/{id};
    PATCH /admin/listing-qc/{id}; POST /admin/listing-qc/{id}/approve; POST /internal/inventory/transfer-from-buyback;
    POST /admin/listings/{id}/publish. Tất cả cần auth/RBAC/idempotency/price revision/audit. Zalo OA/ZNS hợp lệ + consent +
    provider receipt, fallback thông báo tài khoản.
17. Chống trùng: unique(source_buyback_item_id, receipt_type), transaction lock quantity, SKU/variant matching, immutable
    quote snapshot; frontend không được cập nhật H, trạng thái Admin, coupon profit, giá R nếu chưa được Admin duyệt. Ngày
    nhập kho DATE/stocked_at bất biến, nhiều lô có ngày khác nhau.

## V. Bộ kiểm thử nghiệm thu

18. Giá: S 2m → B 340k; S 5m → 850k; S 5.000.001 → 850k; 10m → 1,7m; 20m → 3,4m; hàng lỗi/giá S thiếu/variant chưa xác
    nhận → chờ Admin, không trừ tự động. R khác S khi MEMBER10 hợp lệ; R rỗng không được tự suy từ S.
19. Dữ liệu: không sửa vốn H lịch sử; 100 SKU, 26 chiếc và 15 dòng tồn hiện có không thay đổi sau cập nhật; J là số nguyên
    không có ₫, không âm; M là ngày theo chuẩn; I cũ được chụp thành số tĩnh chờ duyệt; P tự tính 17% của I; O trống chờ
    Admin xác minh R.
20. Kiểm duyệt: thiếu bất kỳ điều kiện QC, thiếu chứng từ nhận hàng, số lượng, ảnh thật, quyền sở hữu, biên lợi nhuận, R/S,
    Admin ID, duyệt quote, settle → CHẶN; đủ QC vẫn chỉ listing DRAFT; sau publish kiểm lần hai mới ACTIVE. Chuyển lại cùng
    một request không cộng tồn hai lần.
21. Trade: quote A chưa đầy đủ ⇒ D chưa đủ; trade credit không sinh điểm; sửa quote yêu cầu khách đồng ý lại; seller/pawn
    không tự cho vào kho.
22. Pháp lý: lãi cầm cố 0,3% kép vẫn mô phỏng và bị khóa chờ thẩm định; đơn cầm cũ không tính lại; nhãn 17% không được hiểu
    là giảm 17%.
23. Đặt test bảng phụ: tab Giá thu 17% – Kiểm thử và Bộ kiểm tra trước đăng trong workbook Bảng mã voucher, tích điểm và
    kiểm thử nghiệp vụ. Tab Lưu trữ – Bậc thu cũ ẩn, chỉ audit, không được dùng trong hệ thống mới.

## VI. Bảo trì, hiệu lực và quản trị

24. Pricing rule 0.17 chỉ được cấu hình ở backend; tài liệu và Google Sheets là minh họa cùng nguồn rule, không phải hai
    engine độc lập. S/R phê duyệt bởi Admin; trừ khi có nguồn quote và chi phí đã duyệt, không đồng bộ lên web. Không tự
    đổi giá đơn đã chốt, hoàn/huỷ theo chính sách giao dịch đã xác nhận. Mọi chỉnh sửa có ID, thời điểm VN/UTC, trước-sau,
    người thực hiện, status test trong CHANGELOG.
25. Chính sách mới tác động lớn đến giá thu; trước khi công bố, shop cần xem lại khả năng chấp nhận của khách, vốn nhập tồn
    cũ, và giá S được duyệt độc lập; không đổi nghĩa vụ giao dịch đang thực hiện mà chưa thông báo khách.

## Đầu tài liệu chung trên Drive (25/10/2026)

Mọi tài liệu nghiệp vụ trong thư mục được thêm hai đoạn đầu:

- **THAM CHIẾU GIÁ THU MỚI:** B17 = ROUND(0,17 × S, 0) chỉ dùng cho thu/Trade mới có S được Admin duyệt và hàng không lỗi;
  H là vốn thu thực tế, R là giá web THẬT đã được duyệt, S là giá bán mục tiêu. Không dùng biểu trừ bậc cũ hoặc mức trừ
  50k/lỗi. Giữ toàn bộ điều kiện cọc, voucher, ship, phí seller, tích điểm và những chính sách không liên quan.
- **CHÍNH SÁCH NGUỒN DUY NHẤT / TÊN FILE ỔN ĐỊNH:** tên file trên Drive không chứa hậu tố v5/v6/v7; CHANGELOG ghi ID thay
  đổi, thời gian, người sửa, file, nội dung trước-sau và phiên bản quy tắc nội bộ. Tiêu đề phiên bản còn sót trong thân tài
  liệu là lịch sử. Nếu hai tài liệu mâu thuẫn, lấy phụ lục nghiệp vụ được duyệt mới nhất và bộ test tương ứng; nội dung lưu
  trữ không được dùng để lập trình. Hợp đồng đã chốt không hồi tố.

Workbook "MODEL UNIVERSE - Danh mục 6 hãng và phiên bản" (25/10/2026): cột H = giá nhập/thu ghi nhận (cần đối soát), I =
giá bán mục tiêu S (chờ Admin duyệt), O = giá niêm yết web R (trống, chờ duyệt), P = B17 = 17% × S, Q = trạng thái duyệt giá &
đăng bán (tất cả "CHỜ DUYỆT"); tab "Cấu hình giá thu 17%" (17%, HALF_UP, không hồi tố), "Hàng thu tạm" (checklist QC
AA:AM), "Hàng thu chờ đăng", "Quy tắc ngày nhập" (M = 25/10/2026 là mốc bắt đầu theo dõi, không phải ngày nhập thực) và
"Snapshot giá trước thay đổi".
