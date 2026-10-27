# Một source, một website

Từ 27/10/2026, source vận hành là `C:/Users/ACER/Desktop/projects/model-universe`, branch `main`. Không chạy website từ các worktree cũ. Workspace Antigravity được giữ nguyên để đối chiếu; thay đổi đang có đã được lưu bằng commit trước khi hợp nhất.

Website dùng Express + Next.js production build, cổng **6050**, database shop hiện hữu và thư mục ảnh/evidence của source chính. Đây không phải server mô phỏng API. Database shop hiện có tên lịch sử `web_ecommerce_ci_verify`; tên này không phản ánh vai trò hiện tại. Không reset, seed lại hoặc đổi sang database fixture khi khởi động.

Agent nội bộ dùng Aegra production, custom authentication, PostgreSQL/pgvector và Redis; LLM lấy profile thật từ cấu hình agent. Trên máy này supervisor khởi động Agent ở `127.0.0.1:2026` và trỏ gateway web vào đó. Đây là cổng backend nội bộ, không phải website thứ hai; chỉ cổng web 6050 được tunnel đưa ra Internet. PostgreSQL 5432/55432, Redis 6379 và Ollama 11434 là các phụ thuộc nội bộ, không đưa lên tunnel. Không dùng `langgraph dev`, model scripted hay SHOP_ADAPTER=fake.

## Vận hành trên máy này

Chạy trong `apps/web-ecommerce`:

```powershell
yarn start:production
yarn production:status
yarn production:restart
yarn production:stop
```

Theo lựa chọn mới của chủ shop, `yarn start:production` mặc định chỉ chạy web/Agent thật trên localhost, không tạo tunnel. `production:status` ghi `localOnly: true`. Chỉ mở public khi chủ shop yêu cầu sau; không tự tạo lại Quick Tunnel đã mất.

`start:production` mở supervisor ẩn, kiểm tra khóa chống chạy trùng và cổng 6050 trước khi mở server. `production:status` hiển thị URL đang chạy, source, commit và PID. `production:restart` chỉ thay process web bằng release đã build, giữ Agent và tunnel (nếu có). `production:stop` dừng web và Agent do supervisor sở hữu, giữ tunnel nếu có; không dừng PostgreSQL hoặc Antigravity.

`START_AGENT_RUNTIME=true`, `AGENT_POSTGRES_CONTAINER` và `AGENT_REDIS_CONTAINER` trong cấu hình riêng máy bật phần Agent. PostgreSQL/Redis được khởi động từ container đã cấu hình, giữ volume hiện có; dừng website không xóa database hoặc queue. Supervisor dừng process Agent mà nó sở hữu khi dừng runtime; restart riêng web giữ Agent. Python và thư viện dùng từ `apps/agent-service/.venv`; Aegra chạy uvicorn không reload, với SelectorEventLoop theo cấu hình Windows của Aegra. Ollama cần đang hoạt động với model `bge-m3`; log Agent ở `D:/ModelUniverseRuntime/agent.log`. Không tự cài lịch monitor/ingest trong đợt triển khai này.

Cấu hình riêng máy nằm trong `.env` và `.env.production.local` (git-ignored). Build/cache ở `D:/ModelUniverseRuntime/dist`, liên kết qua `apps/web-ecommerce/dist`; log, backup và trạng thái ở `D:/ModelUniverseRuntime`. `MODEL_UNIVERSE_RUNTIME_DIR` cho phép đổi nơi lưu trạng thái. Không đưa các file này, ảnh kiểm hàng riêng hoặc bí mật vào Git/image Docker.

Để triển khai lại: commit đúng các file của tác vụ, chạy `yarn build:production` khi website cũ vẫn hoạt động, sau đó `yarn production:restart`. Không khởi động lại cloudflared khi cập nhật web. Tunnel được lưu riêng trong `tunnel-state.json`; start tái sử dụng PID/link đó. Nếu tunnel đã dừng, runtime báo lỗi và không tự tạo link thay thế. Quick Tunnel đã mất không thể đăng ký lại đúng tên; chỉ xóa trạng thái tunnel khi chủ shop chấp nhận tạo link mới. Các URL webhook sinh cho giao dịch mới sử dụng URL runtime hiện tại; callback Google OAuth và webhook đã đăng ký cố định ở nhà cung cấp phải được cập nhật khi đổi URL.

Build production được đóng gói thành bản phát hành riêng ở `D:/ModelUniverseRuntime/releases/<commit>-<timestamp>`, liên kết qua `dist/.next-live-*`. `release.json` chỉ được thay sau khi Next/Express build thành công và kiểm tra các import backend. Runtime không đọc `dist/.next` đang được các công cụ phát triển build lại.

Nếu source có thay đổi chưa commit của editor khác, `yarn build:production` tự tạo bản sao build từ đúng commit HEAD bằng `git archive` trong thư mục artifact `build-sources`, dùng dependencies hiện có. Đây chỉ là đầu vào build, không phải worktree/source chỉnh sửa mới. Thay đổi chưa commit không được đưa vào bản phát hành, không bị stash hoặc ghi đè. Khi source sạch, script build trực tiếp và từ chối phát hành nếu source đổi giữa chừng. `production:status` báo commit của bản thực sự đang chạy. Chế độ REAL_COMMERCE từ chối mở website trên cổng khác 6050.

Theo yêu cầu chủ shop, chỉ commit các file thuộc tác vụ đang làm; không tự commit/merge phần của Antigravity. Antigravity tự merge công việc của mình vào `main`.

## Dữ liệu và kết nối thật

- Có bản sao lưu PostgreSQL trước chuyển đổi tại `D:/ModelUniverseRuntime/backups`. Báo cáo và quyết định đối chiếu lưu tại `D:/ModelUniverseRuntime/catalog-*.json`.
- Đã đối chiếu 101 sản phẩm: giữ loại hàng được lưu, ánh xạ `assembled` sang nhánh `assembled`. Không suy diễn hàng đã lắp thành 2hand. Giữ nguyên ID, UUID, SKU, URL, giá S/giá niêm yết, tồn và số đã bán. Không gộp SKU hoặc tạo SKU theo 101 giá tham chiếu 2hand cũ; các giá cũ vẫn đọc được trong báo cáo/lịch sử.
- Sáu database demo condition đã được xác minh chứa fixture `DEMO-COND-*`, sao lưu rồi gỡ. Không có server demo đang chạy. Fixture/seed dành riêng cho kiểm thử vẫn nằm trong repo, không được runtime production gọi.
- Runtime ép `SEED_DATA=false`, `DROP_TABLES=false`, cookie Secure và vận chuyển `live`. Startup từ chối database `_demo`/`_test`, seed/reset dữ liệu và vận đơn mô phỏng.
- Quảng cáo/Facebook chưa kết nối live sẽ trả lỗi chưa cấu hình, không tạo kết quả giả. Conversion chưa kết nối live không ghi thành sự kiện gửi thành công. Khóa payOS và vận chuyển được lấy từ cấu hình shop; không tạo thanh toán hay gọi xe thật trong kiểm thử triển khai.
- SMTP chưa được cấu hình trong source này. Website không giả lập gửi email thành công. Cần cấu hình SMTP thật để gửi OTP, khôi phục mật khẩu và thông báo email.

## Truy cập Internet

Theo lựa chọn của chủ shop, runtime hiện dùng Cloudflare Quick Tunnel. Link HTTPS truy cập được ngoài LAN khi máy, PostgreSQL, supervisor và Internet còn hoạt động. Link hiện được giữ qua các lần restart website bằng cách giữ process cloudflared. Tắt máy hoặc tunnel chết vẫn có thể làm mất link; không thể cam kết cùng URL Quick Tunnel qua những trường hợp đó. Đây là URL tạm, không phải hosting 24/7 hoặc tên miền cố định; Quick Tunnel không hỗ trợ SSE và không có cam kết uptime. Luồng Agent streaming cần named tunnel trước khi nghiệm thu vận hành lâu dài.

Khi có tên miền/named tunnel, đặt `TUNNEL_TOKEN` và `SHOP_PUBLIC_URL=https://ten-mien` trong cấu hình riêng rồi khởi động lại. Token được truyền qua environment, không đưa vào command line hay Git. Không mở PostgreSQL qua tunnel. Tham khảo [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Xác minh đợt hợp nhất

Đã đạt 1.003 unit test, 14 bài PostgreSQL cây/SKU và 3 bài PostgreSQL gợi ý sản phẩm; type check, Next production build, Express build và lint phạm vi thay đổi. Trình duyệt thật đã truy cập qua URL Cloudflare: 5 trang khách hàng, 2 trang Admin và 2 trang mobile 390px; kiểm tra login/cookie Secure–HttpOnly, API Admin từ chối khách chưa đăng nhập, gợi ý không trả lại chính SKU đang xem và danh sách tổ hợp đúng mẫu. Không có lỗi JavaScript hoặc 5xx trong lượt kiểm tra đạt. Gateway Agent gọi Aegra `/threads/search` trả 200 qua custom auth; không gọi LLM trả phí hay tạo giao dịch thanh toán/vận chuyển thật để kiểm thử.

Ảnh và log kiểm tra nằm ở `D:/ModelUniverseRuntime`, không public từ web. Đã kiểm tra toàn bộ 101 SKU không đổi ID, UUID, SKU, slug, giá, tồn hoặc số đã bán sau đối chiếu. Database shop không chứa SKU fixture `DEMO-COND-*`.
