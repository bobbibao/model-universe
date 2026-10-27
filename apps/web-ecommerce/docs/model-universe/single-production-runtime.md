# Một source, một website

Từ 27/10/2026, source vận hành là `C:/Users/ACER/Desktop/projects/model-universe`, branch `main`. Không chạy website từ các worktree cũ. Workspace Antigravity được giữ nguyên để đối chiếu; thay đổi đang có đã được lưu bằng commit trước khi hợp nhất.

Website dùng Express + Next.js production build, cổng **6050**, database shop hiện hữu và thư mục ảnh/evidence của source chính. Đây không phải server mô phỏng API. Database shop hiện có tên lịch sử `web_ecommerce_ci_verify`; tên này không phản ánh vai trò hiện tại. Không reset, seed lại hoặc đổi sang database fixture khi khởi động.

## Vận hành trên máy này

Chạy trong `apps/web-ecommerce`:

```powershell
yarn start:production
yarn production:status
yarn production:stop
```

`start:production` mở supervisor ẩn, kiểm tra khóa chống chạy trùng và cổng 6050 trước khi mở server. `production:status` hiển thị URL HTTPS hiện tại, source, commit và PID. `production:stop` yêu cầu supervisor dừng đúng server/tunnel do nó tạo; không dừng PostgreSQL, Antigravity hay tiến trình khác.

Cấu hình riêng máy nằm trong `.env` và `.env.production.local` (git-ignored). Build/cache ở `D:/ModelUniverseRuntime/dist`, liên kết qua `apps/web-ecommerce/dist`; log, backup và trạng thái ở `D:/ModelUniverseRuntime`. `MODEL_UNIVERSE_RUNTIME_DIR` cho phép đổi nơi lưu trạng thái. Không đưa các file này, ảnh kiểm hàng riêng hoặc bí mật vào Git/image Docker.

Để build lại: dừng runtime, chạy `yarn build:production`, xác minh kiểm thử cần thiết, rồi khởi động lại. Mỗi lần mở Quick Tunnel có thể tạo URL mới; dùng lệnh status để lấy đúng link. Các URL webhook sinh cho giao dịch mới sử dụng URL runtime hiện tại; callback Google OAuth và webhook đã đăng ký cố định ở nhà cung cấp phải được cập nhật khi đổi URL.

## Dữ liệu và kết nối thật

- Có bản sao lưu PostgreSQL trước chuyển đổi tại `D:/ModelUniverseRuntime/backups`. Báo cáo và quyết định đối chiếu lưu tại `D:/ModelUniverseRuntime/catalog-*.json`.
- Đã đối chiếu 101 sản phẩm: giữ loại hàng được lưu, ánh xạ `assembled` sang nhánh `assembled`. Không suy diễn hàng đã lắp thành 2hand. Giữ nguyên ID, UUID, SKU, URL, giá S/giá niêm yết, tồn và số đã bán. Không gộp SKU hoặc tạo SKU theo 101 giá tham chiếu 2hand cũ; các giá cũ vẫn đọc được trong báo cáo/lịch sử.
- Sáu database demo condition đã được xác minh chứa fixture `DEMO-COND-*`, sao lưu rồi gỡ. Không có server demo đang chạy. Fixture/seed dành riêng cho kiểm thử vẫn nằm trong repo, không được runtime production gọi.
- Runtime ép `SEED_DATA=false`, `DROP_TABLES=false`, cookie Secure và vận chuyển `live`. Startup từ chối database `_demo`/`_test`, seed/reset dữ liệu và vận đơn mô phỏng.
- Quảng cáo/Facebook chưa kết nối live sẽ trả lỗi chưa cấu hình, không tạo kết quả giả. Conversion chưa kết nối live không ghi thành sự kiện gửi thành công. Khóa payOS và vận chuyển được lấy từ cấu hình shop; không tạo thanh toán hay gọi xe thật trong kiểm thử triển khai.
- SMTP chưa được cấu hình trong source này. Website không giả lập gửi email thành công. Cần cấu hình SMTP thật để gửi OTP, khôi phục mật khẩu và thông báo email.

## Truy cập Internet

Theo lựa chọn của chủ shop, runtime hiện dùng Cloudflare Quick Tunnel. Link HTTPS truy cập được ngoài LAN khi máy, PostgreSQL, supervisor và Internet còn hoạt động. Đây là URL tạm, không phải hosting 24/7 hoặc tên miền cố định; Quick Tunnel không hỗ trợ SSE và không có cam kết uptime. Luồng Agent streaming cần named tunnel trước khi nghiệm thu vận hành lâu dài.

Khi có tên miền/named tunnel, đặt `TUNNEL_TOKEN` và `SHOP_PUBLIC_URL=https://ten-mien` trong cấu hình riêng rồi khởi động lại. Token được truyền qua environment, không đưa vào command line hay Git. Không mở PostgreSQL qua tunnel. Tham khảo [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
