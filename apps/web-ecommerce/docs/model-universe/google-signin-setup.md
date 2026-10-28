# Thiết lập đăng nhập Google cho Model Universe

Code hiện có dùng OAuth authorization-code flow phía server, PKCE, state/nonce và kiểm chữ ký ID token. Chỉ yêu cầu `openid email profile`.

## Tạo credential

1. Vào [Google Cloud Console](https://console.cloud.google.com/), chọn hoặc tạo project **Model Universe**.
2. Mở **Google Auth Platform → Branding**, bấm **Get started** nếu chưa thiết lập. Đặt tên app, support email và contact email của shop.
3. Trong **Audience**, chọn **External** cho khách dùng Gmail cá nhân. Khi thử nghiệm, thêm Gmail cần thử vào **Test users**.
4. Giữ quyền đăng nhập cơ bản `openid`, email và profile. Không cần cấp quyền đọc Gmail/Drive cho đăng nhập.
5. Vào **Clients → Create client**, chọn **Web application**, đặt tên **Model Universe Local**.
6. Điền cấu hình dưới đây rồi tạo client. Lưu ngay Client ID và Client Secret được Google cấp.

| Trường | Giá trị local |
|---|---|
| Authorized redirect URIs — bắt buộc | `http://localhost:6050/api/auth/google/callback` |
| Authorized JavaScript origins — tùy chọn với luồng server hiện tại | `http://localhost:6050` |

Callback không có `/vi` hoặc `/en`, không phải URL trang đăng nhập. Dùng thống nhất `localhost`; nếu dùng `127.0.0.1` thì phải đăng ký callback riêng khớp chính xác và cấu hình origin tương ứng.

## Cấu hình repo

Điền trong `apps/web-ecommerce/.env` (file riêng, không commit):

```dotenv
GOOGLE_CLIENT_ID=<Client ID kết thúc bằng .apps.googleusercontent.com>
GOOGLE_CLIENT_SECRET=<Client Secret của OAuth web client>
SHOP_PUBLIC_URL=http://localhost:6050
```

Dùng hai biến Google OAuth này; các biến `GOOGLE_ADS_*` phục vụ quảng cáo. Client Secret chỉ ở server, không thêm tiền tố `NEXT_PUBLIC_`, không dùng mật khẩu Gmail làm secret.

Sau khi lưu, từ thư mục `apps/web-ecommerce` chạy:

```powershell
node scripts/production-runtime.cjs restart
```

Runtime đọc lại hai credential Google trong `.env` khi restart web; không cần build lại chỉ để đổi credential. `SHOP_PUBLIC_URL` của bản local vẫn là `http://localhost:6050` theo supervisor.

## Kiểm tra

1. Mở `http://localhost:6050/vi/auth/signin`. Nút Google chỉ xuất hiện khi server có đủ hai credential.
2. Bấm Google, chọn tài khoản, chấp thuận và trở về website. Phải có phiên đăng nhập thực tế sau callback.
3. `/api/auth/providers` báo `google: true` chỉ chứng minh server có cấu hình, không chứng minh trao đổi token/login đã thành công.
4. `redirect_uri_mismatch`: so URL callback Google Cloud với URL server sinh, bao gồm giao thức, host, cổng và path.
5. `invalid_client`: kiểm đúng cặp ID/Secret của cùng web client, còn hiệu lực, đã restart web.

Khi mở shop qua tên miền public, thêm `https://ten-mien-cua-shop/api/auth/google/callback` vào cùng client hoặc dùng client production riêng; cập nhật origin phía server và hoàn tất Branding/Audience theo yêu cầu Google. Nên dùng project/client riêng cho local và production.

Tài liệu chính thức: [Google Auth Platform](https://support.google.com/cloud/answer/15544987), [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [quản lý OAuth clients](https://support.google.com/cloud/answer/15549257), [Audience](https://support.google.com/cloud/answer/15549945).
