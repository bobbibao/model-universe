<!-- Archived from Google Drive: "Đặc tả ba giá, thu mua theo ngưỡng và QC trước đăng bán – MODEL UNIVERSE"
     (docs.google.com/document/d/15KBaG53zQKpIuejytfHZivk4Ee5i1RQrUI3yTSpH610), updated 26/10/2026 (Drive modified
     2026-10-25T20:36Z), read on 2026-10-26. Replaces buyback-17-percent-specification.md (the same Drive document
     before the owner's change of 26/10). Referenced by the header "QUY TẮC GIÁ HIỆN HÀNH 26/10/2026" added to every
     business document in the Drive folder. Text as in the source, headings normalised. -->

# ĐẶC TẢ BA GIÁ, THU MUA THEO NGƯỠNG, MEMBER10 VÀ QC TRƯỚC ĐĂNG BÁN

MODEL UNIVERSE | BRD + SRS + mô hình giá + dữ liệu + API + kiểm thử. Cập nhật ngày 26/10/2026 | Quản lý lịch sử tại
CHANGELOG. Trạng thái: đặc tả nghiệp vụ. Chưa có backend/website/Zalo production được triển khai bởi việc sửa các file
Drive.

## I. Nguồn quy tắc giá duy nhất

1. Admin chỉ nhập và duyệt S (selling_actual_target_price_vnd), số nguyên VND theo từng SKU/biến thể. S là giá bán
   thực shop mục tiêu thu từ khách có MEMBER10 tiêu chuẩn, trước ưu đãi thành viên cộng thêm. S phải được xét thị
   trường, chi phí vốn theo chiếc/lô, phí thanh toán, công chăm sóc/sửa chữa, quà và điểm thưởng. Những giá S cũ giữ
   nguyên ở danh mục, Q=CHỜ DUYỆT trước khi public.
2. Giá niêm yết R (public_list_price_vnd) phải được hệ thống tính ngược TỪ S: R=ROUND(S/(1−0,10),0), tương đương
   ROUND(S/0,9,0). Nonmember nhìn và có thể mua ở mức R thật sau khi Admin duyệt và listing ACTIVE. Khách có MEMBER10
   hợp lệ: P10=R−ROUND(R×0,10,0); với S nguyên VND, hệ thống phải test P10=S. Không gắn nhãn giá "đã giảm từ giá cũ" nếu
   R chưa từng được giao dịch/niêm yết hợp lệ; cần công khai điều kiện ưu đãi rõ ràng. Web hiện R và giá thành viên khi
   đủ điều kiện, không hiện giá vốn H hoặc báo thu B như giá bán.
3. Giá thu dự kiến B (buyback_provisional_price_vnd) được tính theo S và ba tỷ lệ sau: a. S≤500.000đ: r=30%;
   b. 500.000đ<S≤1.150.000đ: r=20%; c. S>1.150.000đ: r=17%. B=MAX(100.000,ROUND(S×r,0)) cho mỗi chiếc. Tính từng chiếc
   trước khi nhân số lượng.
4. S=200.000→B100.000; S=500.000→B150.000; S=500.001→B100.000; S=1.000.000→B200.000; S=1.150.000→B230.000;
   S=1.150.001→B195.500; S=2.000.000→B340.000; S=5.000.000→B850.000. Hai mức S=500.001 và 1.150.001 tạo bước giảm thu dù
   S tăng 1đ. Đây là quy định cố ý do chủ shop đặt, phải QA, không tự smooth bậc. Giá thu tối thiểu 100.000đ áp cho mọi
   nhóm, không bảo đảm B<S.
5. Với S≤100.000 hoặc B≥S, hoặc thiếu S duyệt, sai SKU/variant, khai lỗi, ảnh không đủ: preview nội bộ vẫn cho kiểm toán
   nhưng KHÔNG tự chốt/báo giá chắc chắn cho khách. Chuyển ADMIN_REVIEW với lý do; Admin có thể từ chối thu hoặc định
   giá thủ công kèm hồ sơ. Không được hứa nhận thu vượt/đúng giá bán khi chưa cân đối chi phí.
6. H (legacy_purchase_value_or_cost) là giá nhập/thu đã ghi trên hàng lịch sử, phải đối soát phiếu nhập/chi trả mới
   được coi là giá vốn thực, không lấy B mới để cập nhật H, không lấy H để tự suy S. Trong nhiều lô, cần
   lot_acquisition_cost thực và unit_id; giữ nguyên dữ liệu và giao dịch đã chốt.

## II. Thành viên, voucher, bảo vệ lợi nhuận

7. MU-MEMBER10 là voucher chính chuẩn 10% trên giá R thật, giảm đến P10≈S, cho thành viên sở hữu mã và SKU shop đủ điều
   kiện (mức đơn tối thiểu, thời hạn, quota, ngân sách, allowlist Admin theo bộ quy chế hiện hành). R vẫn là giá niêm yết
   hiển thị. Khách chưa sở hữu mã không được hứa chắc giá S; website có thể hiển thị giá thành viên với nhãn điều kiện
   rõ ràng. Khi một SKU chưa đủ QC hoặc Q chưa ĐÃ DUYỆT, cả R lẫn giá sau mã chỉ được xem trong Admin; không tự đưa ra
   website.
8. Profit(P)=P×(1−fee_rate)−cost_real_verified−gift_cost−shipping_shop_subsidy−other_shop_cost−
   FLOOR(eligible_merchandise_paid/40.000)×1.120 (dự phòng điểm) và các chi phí hợp lệ khác. L10=Profit(P10), cần L10>0
   mới bật chương trình. Sàn lời tuyệt đối 50.000đ và biên ≥5% tiền hàng sau ưu đãi áp dụng theo cấu hình đã duyệt;
   không tạo voucher nếu thiếu vốn/phí. Mọi tiền tệ là integer VND, không tính float JS; phần trăm lưu basis points.
9. Voucher thông thường (voucher sự kiện, cố định, đổi điểm v.v.) là một lựa chọn thay thế voucher MEMBER10, không được
   ghép hai mã chính. Bước 1 kiểm Profit(Pplain)≥0,80×L10, và các sàn lãi/margin, điều kiện mã, SKU, ngân sách, quota,
   thời hạn, người nhận. Nếu không đạt thì CHẶN mã này, không tự đổi giá đã xác nhận. Khách được chọn phương án hợp lệ có
   giá thanh toán tốt nhất.
10. Voucher thành viên cộng thêm: chỉ một mã/ưu đãi hạng dành riêng hội viên được ghép cùng voucher MEMBER10 đủ điều
    kiện; Profit(Pstack)≥0,75×L10, đồng thời ≥50.000đ và ≥5% Pstack. Không đạt thì bỏ ưu đãi cộng thêm, giữ MEMBER10 nếu
    hợp lệ. Không tự cộng mã thường với MEMBER10, không cộng hai hạng.
11. Ví dụ mô phỏng S=2.000.000, R=2.222.222, vốn/phí cố định 1.500.000, fee=0: P10=2.000.000, L10=444.000. Mã thường
    12% trên R đạt khoảng 90,5% lãi chuẩn; mã thường 18% chỉ giữ 61,2% → CHẶN. MEMBER10 + hạng 1% trên R giữ khoảng
    95,2% → ĐẠT. MEMBER10 + giảm thành viên 15% trên R giữ khoảng 27,2% → CHẶN. Đây chỉ là ca QA dùng vốn GIẢ ĐỊNH.
12. Hạng thành viên, tích điểm, mã chạm đáy 24H, phí, đặt cọc/giữ hàng tiếp tục theo tài liệu liên quan, chỉ sửa nơi
    logic ba giá ảnh hưởng.

## III. Form thu mua, Trade, cầm cố

13. Form khách: autocomplete theo mã kit, tên hãng, phiên bản/màu, scale, ảnh minh họa; xác nhận đúng SKU. Với hàng
    không lỗi, đúng SKU, S đã duyệt, B<S và được shop hỗ trợ: hiển thị B DỰ KIẾN theo ba tỷ lệ/giá sàn. Nếu khai có vấn
    đề, custom, chưa khớp màu, không có S duyệt: chuyển Admin, không trừ lỗi tự động và không hiển thị quote số tiền chắc
    chắn.
14. Luồng: DRAFT → SUBMITTED → RECEIVED → INSPECTING → INSPECTION_PASSED/ISSUE → ADMIN_REVIEW → OFFER_SENT →
    CUSTOMER_ACCEPTED hoặc REJECTED → PAYMENT_SETTLED → READY_FOR_QC → QC_PASSED/FAILED → INVENTORY_RECEIPT →
    LISTING_DRAFT → LISTING_ACTIVE sau Admin publish riêng. Quote có snapshot S/r/B, phiên bản, Admin, ngày hiệu lực;
    sửa giá phải tạo quote revision và khách đồng ý lại.
15. Trade: nguồn hàng khách đưa tính B theo ba ngưỡng nếu đủ điều kiện; hàng lỗi phải qua Admin. Món khách muốn nhận
    dùng giá R niêm yết và tiền hàng sau voucher hợp lệ; D=total_shop_checkout−total_source_buyback_final. D>0 khách trả
    thêm, D<0 Admin duyệt khoản shop bù, không auto payout. Nếu một phần chưa giá, aggregate INCOMPLETE.
16. CẦM CỐ: C50=ROUND(50%×S,0) cho một chiếc là mức cầm dự kiến duy nhất, S phải là giá bán thực đã được Admin duyệt cho
    đúng SKU/phiên bản; R web và B thu mua 30/20/17% không dùng để tính C50. BỎ dải 50–80% thẩm định cũ. Sai SKU, hàng
    lỗi, tranh chấp hoặc S thiếu/đang chờ duyệt → ADMIN_REVIEW/REJECT, không tự báo giá chắc chắn. Lãi kép 0,3%/ngày và
    trần lãi nội bộ giữ nguyên dưới trạng thái mô phỏng LEGAL_REVIEW_REQUIRED; không được giải ngân/thu lãi thực trước
    pháp lý.

## IV. Kiểm duyệt QC trước đăng bán

17. Guard QC01–QC16 như bản trước, với QC10 "S dương do Admin duyệt đúng SKU" và QC11
    "R=ROUND(S/(1−10%),0), P10=R−ROUND(R×10%,0)=S; R là giá shop thực sự chào bán với khách nonmember", QC12 kiểm lợi
    nhuận chuẩn L10>0, mã thường giữ ≥80%, MEMBER10+hạng giữ ≥75%, sàn lãi 50k và ≥5% sau phí/điểm; QC16 invalidate QC
    nếu thay SKU, condition, ảnh hoặc S.
18. Backend phải kiểm tất cả guard lại trong giao dịch atomic, tạo phiếu nhập kho + listing DRAFT có idempotency; sau đó
    PUBLISHER kiểm lần cuối trước ACTIVE.
19. Hàng đã bán cũ không bị áp lại quy tắc giá mới, H/stocked_at và trạng thái đã chốt giữ nguyên. S sửa sau duyệt →
    R/B tự cập nhật dưới dạng dự kiến.

## V. Cơ sở dữ liệu & API

20. pricing_rules(sell_tier_threshold_low=500000, sell_tier_threshold_mid=1150000, buyback_rate_low_bps=3000,
    buyback_rate_mid_bps=2000, buyback_rate_high_bps=1700, min_buyback_vnd=100000, member10_rate_bps=1000,
    regular_profit_keep_bps=8000, member_stack_profit_keep_bps=7500, rounding_policy, effective_from, status,
    approved_by).
22. API đề xuất: GET /catalog/{sku}/prices → trả R và P10 có điều kiện, S/B chỉ cho Admin hoặc khách gửi yêu cầu thu đã
    được xác thực; GET /pricing/buyback-preview → B hoặc ADMIN_REVIEW; POST /checkout/price-preview → công cụ voucher
    80/75 và toàn bộ chi phí. Tất cả endpoint cần auth/RBAC/audit/idempotency, tiền integer.

## VI. QA

24. Bộ kiểm thử giá tối thiểu: S=0→BLOCK; S=90k→B100k (B≥S→ADMIN); S=100k→B100k (ADMIN); S=200k→B100k;
    S=333.333→B100k; S=500k→B150k; S=500.001→B100k; S=1m→B200k; S=1.150.000→B230k; S=1.150.001→B195.500; S=2m→B340k;
    S=2,75m→B467.500; S=5m→B850k; không lỗi + S duyệt mới preview; hàng lỗi không tự quote. Mọi giá R=ROUND(S/0,9), sau
    giảm 10% phải về S. Test voucher thường ≥80% L10, MEMBER10+ưu đãi riêng ≥75% L10, giữ sàn 50k/5%.

## Workbook "MODEL UNIVERSE - Danh mục 6 hãng và phiên bản" (26/10/2026)

Cột H = giá nhập/thu ghi nhận (cần đối soát), I = giá bán thực S (NHẬP), J = giá thu B (tự tính), K = giá web R
(tự tính), L = C50 giá cầm dự kiến = 50% S, M tồn, N tình trạng, O ảnh, P ngày nhập (25/10/2026 là mốc khởi tạo theo
dõi), Q số ngày tồn, R trạng thái duyệt ("CHỜ DUYỆT"). Tab "Cấu hình 3 giá" (500.000 / 1.150.000; 30% / 20% / 17%; tối
thiểu 100.000), "Kiểm thử giá cầm 50%" (PAWN50-00…: S 100.000→50.000, 500.001→250.001, LEGAL_REVIEW_REQUIRED), "Lưu trữ –
Giá thu 17% trước đổi" và "Snapshot giá trước thay đổi" (giá H và S trước đổi, chỉ lưu trữ).
