# Kế hoạch triển khai Giai đoạn K: Xác thực và khôi phục mật khẩu

## 1. Kết luận thiết kế

Triển khai K1–K5 theo hướng cookie HttpOnly, JWT có kiểm tra `token_version`, giới hạn đăng nhập và khôi phục mật khẩu bằng token một lần. Kế hoạch được điều chỉnh để tránh các điểm sau:

- Cookie xác thực yêu cầu CORS allowlist thực sự và kiểm tra Origin/CSRF cho request thay đổi dữ liệu. `SameSite=Lax` chỉ là lớp bảo vệ bổ sung.
- JWT không được trả trong JSON hay lưu ở `localStorage`. Chấp nhận phiên trình duyệt bằng cookie; loại cơ chế Bearer khỏi frontend và các endpoint trình duyệt.
- Hạn JWT phải khớp chính sách cookie: 24 giờ cho phiên thường, 30 ngày khi chọn ghi nhớ. Cookie session không được coi là cơ chế hết hạn phía server.
- Không khóa vĩnh viễn hoặc đặt cờ khóa user sau các lần đăng nhập sai; dùng giới hạn tần suất theo IP và email chuẩn hóa, có `Retry-After`.
- Link reset dùng HTTPS và token trong URL fragment; trang đọc token rồi xóa fragment ngay. Thêm `Referrer-Policy: no-referrer`, không tải script bên thứ ba trên trang reset.
- Reset mật khẩu, tiêu thụ token, tăng `token_version` và vô hiệu các token reset còn lại phải nằm trong một transaction.
- Nếu SMTP chưa cấu hình hoặc gửi mail lỗi, API vẫn trả phản hồi chung; token không được ghi log và token chưa gửi thành công phải bị vô hiệu.
- K6/2FA để giai đoạn riêng, chưa thêm cột bí mật TOTP chưa được sử dụng.

## 2. Hiện trạng cần chuyển đổi

- `AuthController.login` đang đặt cookie nhưng vẫn trả JWT trong JSON.
- `login.js`, `api.js`, `storage.js`, `orders.js`, `checkout.js`, `utils.js` và `admin.js` còn lưu/đọc Bearer token trong `localStorage`.
- `authMiddleware` nhận Bearer trước cookie; chưa kiểm tra phiên bản token trong CSDL.
- Đăng ký chưa tự cấp phiên; JWT hiện có TTL cố định 24 giờ.
- `rateLimiter.js` hiện chỉ giới hạn theo IP trong bộ nhớ và lỗi Auth chưa dùng chung schema.
- CORS trong `server.js` có nhánh chấp nhận origin bất kỳ; cần bỏ nhánh này trước khi dựa vào cookie.
- `users` chưa có `token_version`; chưa có bảng token đặt lại mật khẩu.
- `test-auth-http.js` hiện phụ thuộc JWT trong JSON/Bearer và cleanup CSDL. Chỉ chạy sau khi cấu hình DB kiểm thử cô lập.

## 3. Các giai đoạn và tiêu chí nghiệm thu

### K0 — Chốt nền tảng và an toàn triển khai

1. Lập danh sách mọi route Auth, route cần đăng nhập và các call site token ở frontend.
2. Xác nhận cookie same-origin ở production; cấu hình allowlist origin chính xác cho môi trường dev.
3. Thêm Origin/Fetch-Metadata guard cho endpoint đăng nhập, đăng ký, đăng xuất và endpoint ghi dữ liệu có cookie.
4. Xác nhận `.env` trỏ tới DB dev/test; không chạy migration hoặc cleanup lên DB chưa xác định.

**Nghiệm thu:** CORS không phản chiếu origin tùy ý; mọi API thay đổi dữ liệu có cookie từ origin lạ bị từ chối; DB test tách biệt.

### K2 — Cookie-only và vô hiệu hóa phiên

1. Thêm `users.token_version INT NOT NULL DEFAULT 1` và ánh xạ qua Prisma/Domain.
2. JWT mang claim `tokenVersion`; middleware bắt buộc claim khớp `user.token_version`. Token cũ thiếu claim sẽ buộc đăng nhập lại.
2a. `POST /api/auth/logout-all` tăng version và xóa cookie hiện tại, vô hiệu mọi phiên đang tồn tại.
3. Cookie `shophoa_session`: `HttpOnly`, `SameSite=Lax`, `Path=/`, không có `Domain`, `Secure` ở production.
4. Remember-me: phiên thường có JWT tối đa 24 giờ và session cookie; remember-me có JWT/cookie 30 ngày.
5. Xóa JWT khỏi response body. Dọn `token`/`auth_token` cũ một lần trên trình duyệt; bỏ mọi đọc/ghi và header Bearer trong frontend.
6. Chuyển test/API nội bộ sang cookie jar. Không giữ một đường Bearer ngầm cho cùng endpoint trình duyệt.

**Nghiệm thu:** Không còn JWT trong JSON, localStorage hoặc header Authorization từ frontend; cookie có thuộc tính đúng; token thiếu/sai version nhận 401; sau khi tăng version mọi phiên cũ bị từ chối.

### K1 — Đăng ký tự đăng nhập và return URL

1. Sau khi user được tạo thành công, AuthService phát JWT version 1; controller đặt cookie và trả DTO không có token/hash.
2. Đăng ký thành công trả 201 và chuyển đến `returnUrl` hợp lệ hoặc `index.html`.
3. Dùng một hàm validate return URL chung cho login/register. Chỉ nhận path cùng origin; từ chối protocol, host ngoài, `//`, backslash và các trang auth gây vòng lặp.
4. User lưu trong localStorage chỉ phục vụ hiển thị nhanh; server `/api/auth/me` là nguồn quyền hạn.

**Nghiệm thu:** Đăng ký không cần đăng nhập lại; role luôn là `customer`; `returnUrl` ngoài origin bị bỏ qua; response không lộ token hoặc `password_hash`.

### K3 — Rate limit và lỗi Auth thống nhất

1. Tách giới hạn IP và email đã chuẩn hóa; trả 429 kèm `Retry-After` khi vượt hạn.
2. Không đặt `is_locked` lên user chỉ vì người khác gửi sai mật khẩu. Giới hạn email cần có TTL/dọn key và giới hạn dung lượng Map; nếu triển khai nhiều instance phải chuyển sang store dùng chung.
3. Lỗi Auth dùng `{ error: { code, message } }`; lỗi sai email/mật khẩu cùng thông báo trung tính; lỗi 500 không gửi `err.message` ra client.

**Nghiệm thu:** Email không tồn tại và sai mật khẩu có cùng status/message; limit IP/email đúng; lỗi 429 có `Retry-After`; không lộ stack/chi tiết DB.

### K4 — UX đăng nhập

1. Thêm Remember me và link quên mật khẩu.
2. Thêm nút SVG ẩn/hiện mật khẩu cho login/register/reset; nút có `aria-label`, `aria-pressed`, thao tác bàn phím được.
3. Giữ `returnUrl` qua luồng login/register; khi 401, điều hướng tới login kèm path nội bộ hiện tại.

**Nghiệm thu:** Toggle không làm mất focus/giá trị; redirect an toàn và đúng trang; hiển thị lỗi thân thiện theo schema mới.

### K5 — Quên và đặt lại mật khẩu

1. Tạo `password_reset_tokens`: user FK, `token_hash` SHA-256 unique, `expires_at`, `used_at`, `created_at`, index theo user/thời hạn.
2. Token từ `crypto.randomBytes(32)`; chỉ lưu hash; TTL 30 phút; mỗi token dùng tối đa một lần.
3. Tạo `EmailSenderPort` riêng và `SmtpEmailAdapter`; SMTP lấy cấu hình từ env, không ghi email/token/URL chứa token vào log.
4. `POST /forgot-password` trả cùng status/body cho email tồn tại/không tồn tại, không khóa user, có rate limit. Lỗi gửi mail phải vô hiệu token mới tạo.
5. `POST /reset-password` trong transaction: kiểm tra hash, thời hạn, chưa dùng; cập nhật password hash; tăng `token_version`; đánh dấu token đã dùng và vô hiệu token còn lại.
6. Trang reset nhận token từ fragment, xóa fragment ngay, đặt `Referrer-Policy: no-referrer`, xác nhận mật khẩu và dùng chính sách mật khẩu hiện tại.
7. Sau reset yêu cầu đăng nhập lại; gửi email thông báo đã đổi mật khẩu, không gửi mật khẩu.

**Nghiệm thu:** Không dò được tài khoản qua phản hồi; DB không có token thô; token hết hạn/dùng lại bị từ chối; chỉ một request đồng thời có thể tiêu thụ token; phiên cũ bị từ chối; lỗi SMTP không làm lộ token hoặc email tồn tại.

## 4. Bản đồ file dự kiến

- Prisma: `prisma/schema.prisma`, migration SQL.
- Domain/Ports: `User.js`, `AuthUseCase.js`, `UserRepositoryPort.js`, `PasswordResetRepositoryPort.js`, `EmailSenderPort.js`, `DomainErrors.js`.
- Application/Adapters: `AuthService.js`, `AuthController.js`, `PrismaUserRepository.js`, password reset repository, SMTP adapter, JWT adapter, middleware và auth routes.
- Infrastructure: `container.js`, `env.js`, `.env.example`, dependency Nodemailer.
- Frontend: `login.html/js/login.js`, `register.html/js/register.js`, `forgot-password.html/js/forgot-password.js`, `reset-password.html/js/reset-password.js`, `api.js`, `storage.js`, `orders.js`, `checkout.js`, `admin.js`, `utils.js`, `css/auth.css`.

## 5. Thứ tự triển khai

1. K0: chốt DB test, CORS/CSRF và hợp đồng lỗi.
2. K2 backend: migration, token version, cookie-only, remember-me, middleware.
3. K1: auto-login và return URL.
4. K3: rate-limit và lỗi API.
5. K4: cập nhật UI login/register.
6. K5 backend: port, repository, transaction, mail adapter và endpoints.
7. K5 frontend: forgot/reset pages; sau đó rà call sites và cập nhật test contract.
8. Review bảo mật, migration trên DB dev đã xác nhận, kiểm thử tích hợp và UAT.

## 6. Ràng buộc vận hành

- Không chạy migration hoặc test có ghi/xóa dữ liệu cho đến khi xác nhận DB test cô lập.
- Không ghi reset token, JWT, SMTP password hoặc reset URL vào log.
- Không đưa secrets vào Git; `.env.example` chỉ chứa giá trị mẫu.
- K6/2FA không thuộc phạm vi K1–K5.

## 7. Tình trạng triển khai source (11/11/2026)

- Đã triển khai trong working tree: cookie-only, token version, auto-login đăng ký, Remember me, return URL an toàn, giới hạn tần suất, lỗi Auth dạng object, UI hiện/ẩn mật khẩu, trang forgot/reset, token một lần và SMTP adapter.
- Hai trang forgot/reset không nạp thư viện script bên thứ ba; reset token nằm trong URL fragment và bị xóa ngay khi trang mở.
- Đã chạy `npx prisma generate` thành công và kiểm tra cú pháp 31 file JavaScript bằng `node --check`.
- Chưa chạy migration lên DB; cần xác nhận DB đích là dev/test trước. Chưa chạy integration/E2E; test HTTP hiện tại còn kỳ vọng Bearer/JWT trong JSON và cần chuyển sang cookie jar.
- `.env.example` đã có trường SMTP mẫu; môi trường hiện chưa được xác nhận cấu hình SMTP nên email thật chưa thể gửi.
- Rate limiter hiện lưu trong bộ nhớ một tiến trình; triển khai nhiều instance cần store dùng chung.
- `npm install nodemailer` báo tổng cộng 5 dependency advisories (2 moderate, 3 high); chưa thực hiện cập nhật dependency ngoài phạm vi.
